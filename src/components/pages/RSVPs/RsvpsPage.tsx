// src/components/pages/Rsvps/RsvpsPage.tsx
import { PageLoader } from "../../atoms/PageLoader";
import { ErrorState } from "../../atoms/ErrorState";
import React, { useState } from "react";
import { saveAs } from "file-saver";
import { ClipboardListIcon, UserGroupIcon, PencilIcon, TrashIcon } from "@heroicons/react/solid";
import {
  useRsvpsApi,
  useCreateRsvp,
  useUpdateRsvp,
  useDeleteRsvp,
  type Rsvp,
} from "../../../api/hooks/useRsvpsApi";
import type { AnswerItem } from "../../../api/hooks/useAnswersApi";
import { useEventRsvpInternal } from "../../../api/hooks/useEventsApi";
import { useTablesApi } from "../../../api/hooks/useTablesApi";
import { useGuestsApi } from "../../../api/hooks/useGuestsApi";
import { RsvpFormModal } from "../../molecules/RsvpFormModal";
import { ImportRsvpsModal } from "../../molecules/ImportRsvpsModal";
import { DeleteConfirmationModal } from "../../molecules/DeleteConfirmationModal";
import { Button } from "../../atoms/Button";
import { Dropdown, DropdownItem } from "../../atoms/Dropdown";
import { useEventContext } from "../../../context/EventContext";
import { useAuth } from "../../../api/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { NoEventsState } from "../../molecules/NoEventsState";
import { StatsCard } from "../../atoms/StatsCard";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RsvpsPage() {
  const { eventId, event, eventsLoading } = useEventContext()!;
  const { data: rsvps = [], isLoading, isError } = useRsvpsApi(eventId!);
  const createRsvp = useCreateRsvp(eventId!);
  const updateRsvp = useUpdateRsvp(eventId!);
  const deleteRsvp = useDeleteRsvp(eventId!);
  const { data: formFields = [], isLoading: formFieldsLoading } = useEventRsvpInternal(eventId ?? undefined);
  const { data: tables = [] } = useTablesApi(eventId!);
  const { data: guests = [] } = useGuestsApi(eventId!);
  const { user } = useAuth();
  const actor = user?.id ?? user?.name ?? "System";
  const qc = useQueryClient();

  const [modal, setModal] = useState<{ open: boolean; rsvp?: Rsvp }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; rsvp: Rsvp | null }>({ open: false, rsvp: null });

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  if (eventsLoading) return <PageLoader message="Loading..." />;
  if (!eventId) return <NoEventsState title="No Events to Manage RSVPs" message="Create your first event to start managing guest responses and invitations." />;
  if (isLoading) return <PageLoader message="Loading RSVPs..." />;
  if (isError) return <ErrorState message="Failed to load RSVPs." onRetry={() => window.location.reload()} />;

  const handleDelete = (rsvp: Rsvp) => setDeleteModal({ open: true, rsvp });
  const handleCancelDelete = () => setDeleteModal({ open: false, rsvp: null });
  const handleConfirmDelete = async () => {
    if (!deleteModal.rsvp) return;
    try {
      await deleteRsvp.mutateAsync({
        rsvpGuid: deleteModal.rsvp.rsvpGuid ?? deleteModal.rsvp.rsvpId ?? deleteModal.rsvp.id,
        eventId: eventId!,
      });
      setDeleteModal({ open: false, rsvp: null });
    } catch (error) {
      console.error("Failed to delete RSVP:", error);
    }
  };

  const filtered = rsvps.filter((r) =>
    (r.guestName ?? "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totals = rsvps.reduce(
    (acc, r) => {
      acc.total += 1;
      acc.pax += r.noOfPax ?? 0;
      return acc;
    },
    { total: 0, pax: 0 }
  );

  const buildRsvpRows = () => {
    const tableMap = new Map(tables.map((t) => [t.id, t.name]));
    const guestCodeMap = new Map<string, string>();
    for (const g of guests) {
      if (g.rsvpId && g.guestCode) guestCodeMap.set(g.rsvpId, g.guestCode);
    }
    return rsvps.map((r, idx) => {
      const row: Record<string, unknown> = {
        "No.": idx + 1,
        "Guest Code": guestCodeMap.get(r.rsvpId ?? r.id) ?? "",
        "Guest Name": r.guestName,
        "No. of Pax": r.noOfPax ?? "",
        "Table": r.tableId ? (tableMap.get(r.tableId) ?? "") : "",
      };
      for (const field of formFields) {
        const answer = (r.answers ?? []).find((a) => a.questionId === field.questionId);
        const key = field.label || field.questionId;
        if (key) row[key] = answer?.text ?? "";
      }
      return row;
    });
  };

  const handleExportXlsx = async () => {
    const XLSX = await import("xlsx");
    const rows = buildRsvpRows();
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "RSVPs");
    saveAs(new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })]), `rsvps-event-${eventId}.xlsx`);
  };

  const handleExportCsv = () => {
    const rows = buildRsvpRows();
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const escape = (v: unknown) => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };
    let csv = headers.map(escape).join(",") + "\n";
    rows.forEach((row) => { csv += headers.map((h) => escape(row[h])).join(",") + "\n"; });
    saveAs(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8;" }), `rsvps-event-${eventId}.csv`);
  };

  const renderAnswers = (answers: AnswerItem[]) =>
    answers
      .filter((a) => a.text)
      .map((a) => {
        const field = formFields.find((f) => f.questionId === a.questionId);
        return field ? { label: field.label, text: a.text } : null;
      })
      .filter(Boolean) as { label: string; text: string }[];

  return (
    <>
      {/* ─── HEADER + ACTIONS ─────────────────────────────────────────── */}
      <div data-tour="rsvps-header" className="flex flex-col md:flex-row md:justify-between md:items-center mb-5 gap-3">
        <div>
          <h1 className="text-3xl font-display font-semibold text-primary">RSVPs</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track guest responses and manage invitations</p>
        </div>
        <div data-tour="rsvps-actions" className="flex flex-wrap gap-2">
          <Button onClick={() => setModal({ open: true })}>+ New RSVP</Button>
          <Button variant="secondary" onClick={() => setImportModalOpen(true)}>
            Import
          </Button>
          <Dropdown trigger={<Button variant="secondary">Export ▾</Button>}>
            <DropdownItem onClick={handleExportXlsx}>Export as XLSX</DropdownItem>
            <DropdownItem onClick={handleExportCsv}>Export as CSV</DropdownItem>
          </Dropdown>
        </div>
      </div>

      {/* ─── STAT CARDS ───────────────────────────────────────────────── */}
      <div data-tour="rsvps-stats" className="grid grid-cols-2 gap-3 mb-6">
        <StatsCard label="Total RSVPs" value={totals.total} variant="primary" size="sm" icon={<ClipboardListIcon className="w-4 h-4" />} />
        <StatsCard label="Total Pax" value={totals.pax} variant="success" size="sm" icon={<UserGroupIcon className="w-4 h-4" />} />
      </div>

      {/* ─── FILTERS ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-5">
        <input
          data-tour="rsvps-search"
          type="text"
          placeholder="Search guests…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="md:ml-auto w-full md:w-64 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {/* View toggle hidden — only grid view is implemented. Re-enable when list/Q&A layout is ready. */}
      </div>

      {/* ─── EMPTY STATE ──────────────────────────────────────────────── */}
      {filtered.length === 0 && (
        <div className="text-center py-20 text-gray-400 dark:text-gray-600">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium text-gray-500 dark:text-gray-400">
            {searchTerm ? "No RSVPs match your search." : "No RSVPs yet."}
          </p>
          {!searchTerm && (
            <p className="text-sm mt-1 text-gray-400 dark:text-gray-500">Add your first guest using the button above.</p>
          )}
        </div>
      )}

      {/* ─── GRID VIEW ────────────────────────────────────────────────── */}
      {viewMode === "grid" && filtered.length > 0 && (
        <ul className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((r) => (
            <li
              key={r.id}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 flex flex-col gap-3 hover:shadow-md dark:hover:shadow-gray-900/40 transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 leading-snug">{r.guestName}</h3>
                {r.noOfPax != null && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full shrink-0">
                    {r.noOfPax} pax
                  </span>
                )}
              </div>
              {r.phoneNo && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{r.phoneNo.startsWith("+") ? r.phoneNo : "+" + r.phoneNo}</p>
              )}
              {r.remarks && (
                <p className="text-xs text-gray-400 dark:text-gray-500 line-clamp-2">{r.remarks}</p>
              )}
              {(() => {
                const qa = renderAnswers(r.answers ?? []);
                if (qa.length === 0) return null;
                const visible = qa.slice(0, 3);
                const extra = qa.length - visible.length;
                return (
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                      {visible.map((item) => (
                        <React.Fragment key={item.label}>
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">{item.label}</span>
                          <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{item.text}</span>
                        </React.Fragment>
                      ))}
                    </div>
                    {extra > 0 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">+{extra} more</p>
                    )}
                  </div>
                );
              })()}
              <div className="mt-auto flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <button title="Edit" onClick={() => setModal({ open: true, rsvp: r })} className="p-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-accent dark:border-white/10 dark:text-white dark:hover:bg-white/10 transition-colors"><PencilIcon className="h-4 w-4" /></button>
                <button title="Delete" onClick={() => handleDelete(r)} className="p-2 rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50 dark:bg-accent dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"><TrashIcon className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ─── LIST VIEW ────────────────────────────────────────────────── */}
      {viewMode === "list" && filtered.length > 0 && (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-xs">RSVP</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-xs">Phone</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-xs">Pax</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-xs">Remarks</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/60 bg-white dark:bg-gray-900">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/60 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800 dark:text-gray-100">{r.guestName}</p>
                    {renderAnswers(r.answers ?? []).map((item) => (
                      <p key={item.label} className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[180px]">
                        {item.label}: {item.text}
                      </p>
                    ))}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{r.phoneNo ? (r.phoneNo.startsWith("+") ? r.phoneNo : "+" + r.phoneNo) : "—"}</td>
                  <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">{r.noOfPax ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[220px] truncate">{r.remarks || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button title="Edit" onClick={() => setModal({ open: true, rsvp: r })} className="p-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-accent dark:border-white/10 dark:text-white dark:hover:bg-white/10 transition-colors"><PencilIcon className="h-4 w-4" /></button>
                      <button title="Delete" onClick={() => handleDelete(r)} className="p-2 rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50 dark:bg-accent dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"><TrashIcon className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RsvpFormModal
        isOpen={modal.open}
        onClose={() => setModal({ open: false })}
        initial={modal.rsvp}
        initialAnswers={modal.rsvp?.answers ?? []}
        eventId={eventId!}
        onSave={async (data, id) => {
          try {
            if (id) {
              await updateRsvp.mutateAsync({ rsvpGuid: id, ...data });
            } else {
              await createRsvp.mutateAsync(data);
            }
            qc.invalidateQueries({ queryKey: ["rsvps", eventId] });
          } catch (err) {
            console.error("RSVP save error", err);
          } finally {
            setModal({ open: false });
          }
        }}
      />

      <DeleteConfirmationModal
        isOpen={deleteModal.open}
        isDeleting={deleteRsvp.isPending}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        title="Delete RSVP?"
        description="Are you sure you want to delete this RSVP? This will permanently remove it from your guest list."
      >
        {deleteModal.rsvp && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <p className="font-medium text-gray-800 dark:text-gray-100 mb-1">{deleteModal.rsvp.guestName}</p>
            {deleteModal.rsvp.phoneNo && (
              <p className="text-xs text-gray-500 dark:text-gray-400">Phone: {deleteModal.rsvp.phoneNo.startsWith("+") ? deleteModal.rsvp.phoneNo : "+" + deleteModal.rsvp.phoneNo}</p>
            )}
            {deleteModal.rsvp.noOfPax != null && (
              <p className="text-xs text-gray-500 dark:text-gray-400">Pax: {deleteModal.rsvp.noOfPax}</p>
            )}
          </div>
        )}
      </DeleteConfirmationModal>

      <ImportRsvpsModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        eventId={eventId!}
        eventTitle={event?.title ?? "event"}
        formFields={formFields}
        formFieldsLoading={formFieldsLoading}
        existingRsvps={rsvps}
        actor={actor}
        onImportComplete={() => qc.invalidateQueries({ queryKey: ["rsvps", eventId] })}
      />
    </>
  );
}
