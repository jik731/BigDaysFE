// src/components/molecules/ImportRsvpsModal.tsx
import React, { useState, useRef } from "react";
import { saveAs } from "file-saver";
import toast from "react-hot-toast";
import { Modal } from "./Modal";
import { Button } from "../atoms/Button";
import { Spinner } from "../atoms/Spinner";
import { useCreateRsvp, useUpdateRsvp, type Rsvp } from "../../api/hooks/useRsvpsApi";
import type { FormFieldConfig } from "../../api/hooks/useFormFieldsApi";

interface ParsedRow {
  guestName: string;
  payload: {
    eventId: string;
    guestName: string;
    phoneNo: string;
    noOfPax: number;
    remarks: string;
    answers?: Array<{ questionId: string; text: string }>;
    [key: string]: unknown;
  };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventTitle: string;
  formFields: FormFieldConfig[];
  formFieldsLoading: boolean;
  existingRsvps: Rsvp[];
  actor: string;
  onImportComplete: () => void;
}

const STANDARD_HEADERS = ["Guest Name", "Phone No", "No of Pax", "Remarks"];

export const ImportRsvpsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  eventId,
  eventTitle,
  formFields,
  formFieldsLoading,
  existingRsvps,
  actor,
  onImportComplete,
}) => {
  const createRsvp = useCreateRsvp(eventId);
  const updateRsvp = useUpdateRsvp(eventId);

  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    if (isImporting) return;
    setParsedRows([]);
    setSkippedCount(0);
    setProgress(0);
    onClose();
  };

  // ─── Template Download ───────────────────────────────────────────────────────

  const handleDownloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const customHeaders = formFields.map((f) => f.label ?? f.name ?? "");
    const allHeaders = [...STANDARD_HEADERS, ...customHeaders];

    const ws = XLSX.utils.aoa_to_sheet([allHeaders]);

    const headerRange = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
    for (let c = headerRange.s.c; c <= headerRange.e.c; c++) {
      const headerCell = XLSX.utils.encode_cell({ r: 0, c });
      if (ws[headerCell]) {
        ws[headerCell].s = { font: { bold: true }, fill: { fgColor: { rgb: "4F81BD" } } };
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "RSVPs");

    const safeName = eventTitle.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    const blob = new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, `rsvp-template-${safeName}.xlsx`);
  };

  // ─── File Parsing ────────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const XLSX = await import("xlsx");
        const arr = ev.target?.result;
        if (!arr) throw new Error("Empty file");

        const wb = XLSX.read(arr, { type: "array", cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" }) as unknown[][];

        if (rawRows.length === 0) {
          toast.error("File is empty");
          return;
        }

        // Row 0: headers; Rows 1-2 may be guidance (type hints / option hints)
        const headerRow = (rawRows[0] as string[]).map((h) => String(h).trim().toLowerCase());

        // Detect guidance rows: if row[1] contains "text"/"number"/"textarea" etc., it's a hint row
        const HINT_KEYWORDS = ["text", "number", "textarea", "select", "radio", "checkbox", "email", "date"];
        const isGuidanceRow = (row: unknown[]) =>
          row.some((cell) => HINT_KEYWORDS.includes(String(cell).trim().toLowerCase()));

        let dataStartIndex = 1;
        if (rawRows.length > 1 && isGuidanceRow(rawRows[1])) {
          dataStartIndex = 2; // skip type hint row
        }
        if (rawRows.length > dataStartIndex && isGuidanceRow(rawRows[dataStartIndex])) {
          dataStartIndex++; // skip options hint row
        }

        // Build column index → field key map
        const colMap: Array<{ key: string; isCustom?: boolean; fieldName?: string; questionId?: string }> = headerRow.map((h) => {
          const normalized = h.replace(/\s+/g, "");
          if (normalized === "guestname" || normalized === "name") return { key: "guestName" };
          if (normalized === "phoneno" || normalized === "phone") return { key: "phoneNo" };
          if (normalized === "noofpax" || normalized === "pax") return { key: "noOfPax" };
          if (normalized === "remarks" || normalized === "notes") return { key: "remarks" };

          // Try to match against custom form fields by label
          const matchedField = formFields.find(
            (f) => (f.label ?? "").toLowerCase() === h || (f.name ?? "").toLowerCase() === h
          );
          if (matchedField) {
            return { key: matchedField.name ?? h, isCustom: true, fieldName: matchedField.name ?? h, questionId: matchedField.questionId };
          }

          return { key: h, isCustom: true };
        });

        const parsed: ParsedRow[] = [];
        let skipped = 0;

        for (let i = dataStartIndex; i < rawRows.length; i++) {
          const row = rawRows[i] as unknown[];
          const obj: Record<string, unknown> = {};
          colMap.forEach((col, ci) => {
            obj[col.key] = row[ci] ?? "";
          });

          const rawName = String(obj["guestName"] ?? "").trim();
          if (!rawName) {
            skipped++;
            continue;
          }

          // Build standard fields
          const rawPax = obj["noOfPax"];
          let noOfPax = 1;
          if (rawPax !== "" && rawPax !== undefined) {
            const parsed = Number(rawPax);
            if (!isNaN(parsed)) noOfPax = parsed;
          }

          // Build answers array from custom fields (BE expects { questionId, text }[])
          const answers: Array<{ questionId: string; text: string }> = [];
          colMap.forEach((col) => {
            if (col.isCustom && col.fieldName && col.questionId) {
              let val = String(obj[col.key] ?? "").trim();
              const fieldDef = formFields.find((f) => f.name === col.fieldName);
              if (fieldDef?.typeKey === "checkbox") {
                const lower = val.toLowerCase();
                val = lower === "yes" || lower === "1" || lower === "true" ? "true" : "false";
              } else if (fieldDef?.typeKey === "date" && obj[col.key] instanceof Date) {
                const d = obj[col.key] as Date;
                val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
              } else if ((fieldDef?.typeKey === "select" || fieldDef?.typeKey === "radio") && fieldDef.options) {
                const opts = (Array.isArray(fieldDef.options) ? fieldDef.options : fieldDef.options.split(",")).map((o) => String(o).trim());
                const n = parseInt(val, 10);
                if (!isNaN(n) && n >= 1 && n <= opts.length) {
                  val = opts[n - 1];
                }
              }
              answers.push({ questionId: col.questionId, text: val });
            }
          });

          parsed.push({
            guestName: rawName,
            payload: {
              eventId,
              guestName: rawName,
              phoneNo: String(obj["phoneNo"] ?? "").trim(),
              noOfPax,
              remarks: String(obj["remarks"] ?? "").trim(),
              ...(answers.length > 0 ? { answers } : {}),
            },
          });
        }

        setParsedRows(parsed);
        setSkippedCount(skipped);
        setProgress(0);
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "Failed to parse file");
      }
    };
    reader.onerror = () => toast.error("File read error");
    reader.readAsArrayBuffer(file);

    // Reset file input so the same file can be re-selected
    e.target.value = "";
  };

  // ─── Import Execution ────────────────────────────────────────────────────────

  const handleImport = async () => {
    setIsImporting(true);
    setProgress(0);
    let success = 0;

    try {
      for (let i = 0; i < parsedRows.length; i++) {
        const row = parsedRows[i];
        const existing = existingRsvps.find(
          (r) => (r.guestName ?? "").toLowerCase() === row.guestName.toLowerCase()
        );

        try {
          if (existing) {
            const guid = existing.rsvpGuid ?? existing.rsvpId ?? existing.id;
            await updateRsvp.mutateAsync({ rsvpGuid: guid, ...row.payload, updatedBy: actor });
          } else {
            await createRsvp.mutateAsync({ ...row.payload, createdBy: actor });
          }
          success++;
        } catch (err) {
          console.error(`Failed to import row ${i + 1} (${row.guestName}):`, err);
        }

        setProgress(i + 1);
      }

      toast.success(`Imported ${success} of ${parsedRows.length} rows`);
      onImportComplete();
      handleClose();
    } finally {
      setIsImporting(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  const hasFile = parsedRows.length > 0 || skippedCount > 0;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import RSVPs">
      <div className="space-y-6">
        {/* Step 1 */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Step 1 — Get the template
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Download the Excel template for this event. It includes columns for all custom questions.
          </p>
          <Button
            variant="secondary"
            onClick={handleDownloadTemplate}
            disabled={formFieldsLoading}
          >
            {formFieldsLoading ? (
              <>
                <Spinner /> Loading…
              </>
            ) : (
              "↓ Download Template (.xlsx)"
            )}
          </Button>

          {!formFieldsLoading && (() => {
            type ColDef = { label: string; type: string; options: string[] | null };
            const cols: ColDef[] = [
              { label: "Guest Name", type: "text", options: null },
              { label: "Phone No", type: "text", options: null },
              { label: "No of Pax", type: "number", options: null },
              { label: "Remarks", type: "text", options: null },
              ...formFields.map((f) => {
                const options =
                  (f.typeKey === "select" || f.typeKey === "radio") && f.options
                    ? (Array.isArray(f.options) ? f.options : f.options.split(",")).map((o) => String(o).trim())
                    : null;
                return { label: f.label ?? f.name ?? "", type: f.typeKey ?? "text", options };
              }),
            ];

            const typeBadge = (type: string, options: string[] | null) => {
              if (options) return { text: options.map((_, i) => i + 1).join(" / "), className: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-700" };
              if (type === "number") return { text: "number", className: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-700" };
              if (type === "checkbox") return { text: "yes / no", className: "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 ring-1 ring-green-200 dark:ring-green-700" };
              if (type === "date") return { text: "date", className: "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 ring-1 ring-purple-200 dark:ring-purple-700" };
              return { text: "text", className: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 ring-1 ring-gray-200 dark:ring-gray-600" };
            };

            return (
              <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="bg-gray-50 dark:bg-gray-800/80 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-[10px] font-semibold tracking-widest uppercase text-gray-400 dark:text-gray-500">
                    Template columns
                  </p>
                </div>
                <div className="max-h-52 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/50">
                  {cols.map((col, i) => {
                    const badge = typeBadge(col.type, col.options);
                    return (
                      <div key={i} className="px-3 py-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 min-w-0 truncate">
                            {col.label}
                          </span>
                          <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${badge.className}`}>
                            {badge.text}
                          </span>
                        </div>
                        {col.options && (
                          <div className="mt-1 space-y-0.5 pl-1">
                            {col.options.map((opt, j) => (
                              <p key={j} className="text-[10px] text-gray-400 dark:text-gray-500">
                                <span className="font-semibold text-amber-500 dark:text-amber-400 mr-1">{j + 1}</span>
                                {opt}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {cols.some((c) => c.options) && (
                  <div className="px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-100 dark:border-amber-800/40">
                    <p className="text-[10px] text-amber-700 dark:text-amber-400">
                      For fields showing <span className="font-semibold">1 / 2 / 3…</span>, enter the number in your Excel file — e.g. type <span className="font-semibold">1</span> for the first option.
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        <div className="border-t border-gray-100 dark:border-gray-700" />

        {/* Step 2 */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Step 2 — Upload your filled file
          </p>
          <label className="flex items-center gap-3 cursor-pointer">
            <span className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Choose file…
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">.xlsx, .csv</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={handleFileChange}
              disabled={isImporting}
            />
          </label>

          {hasFile && (
            <p className="text-sm text-gray-600 dark:text-gray-300">
              <span className="font-medium text-green-600 dark:text-green-400">{parsedRows.length} rows found</span>
              {skippedCount > 0 && (
                <span className="ml-2 text-gray-400 dark:text-gray-500">{skippedCount} skipped</span>
              )}
            </p>
          )}

          {isImporting && (
            <div className="space-y-1">
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${parsedRows.length > 0 ? (progress / parsedRows.length) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Importing {progress} of {parsedRows.length}…
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          <Button variant="secondary" onClick={handleClose} disabled={isImporting}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={parsedRows.length === 0 || isImporting}
          >
            {isImporting ? (
              <>
                <Spinner /> Importing…
              </>
            ) : (
              `Import ${parsedRows.length > 0 ? `${parsedRows.length} rows` : ""}`
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
