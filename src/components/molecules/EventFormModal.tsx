// src/components/molecules/EventFormModal.tsx
import React, { useContext, useEffect, useState } from "react";
import { Modal } from "./Modal";
import { FormField } from "./FormField";
import { Button } from "../atoms/Button";
import {
  useCreateEvent,
  useUpdateEvent,
  type Event,
} from "../../api/hooks/useEventsApi";
import { FormError } from "./FormError";
import { AuthContext } from "../../context/AuthProvider";

interface EventFormModalProps {
  isOpen: boolean;
  title?: string;
  onClose: () => void;
  onSuccess?: (evt: Event) => void;
  initial?: Event;
  className?: string;
}


export const EventFormModal: React.FC<EventFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initial,
  className = "",
}) => {
  // Event date/time is stored as local (GMT+8) in the DB — use raw values directly.
  const [title, setTitle] = useState(initial?.title || "");
  const [date, setDate] = useState<string>(initial?.date?.slice(0, 10) ?? "");
  const [time, setTime] = useState<string>(initial?.time?.slice(0, 5) ?? "");
  const [noOfTable, setNoOfTable] = useState<number>(
    initial?.noOfTable ? Number(initial.noOfTable) : 0
  );
  const [description, setDescription] = useState(initial?.description || "");
  const [location, setLocation] = useState(initial?.location || "");
  const [rsvpDueDate, setRsvpDueDate] = useState<string>(initial?.rsvpDueDate?.slice(0, 10) ?? "");

  const { userGuid } = useContext(AuthContext);
  const createEvt = useCreateEvent();
  const updateEvt = useUpdateEvent();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    date?: string;
    time?: string;
    noOfTable?: string;
    location?: string;
  }>({});

  useEffect(() => {
    if (isOpen) {
      setTitle(initial?.title || "");
      setDate(initial?.date?.slice(0, 10) ?? "");
      setTime(initial?.time?.slice(0, 5) ?? "");
      setNoOfTable(initial?.noOfTable ? Number(initial.noOfTable) : 0);
      setDescription(initial?.description || "");
      setLocation(initial?.location || "");
      setRsvpDueDate(initial?.rsvpDueDate?.slice(0, 10) ?? "");
      setError(null);
      setFieldErrors({});
    }
  }, [isOpen, initial]);

  const isEdit = Boolean(initial);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof fieldErrors = {};
    if (!title.trim()) errs.title = "Title cannot be empty.";
    if (!date) errs.date = "Date cannot be empty.";
    if (!time) errs.time = "Time cannot be empty.";
    if (!noOfTable || noOfTable <= 0) errs.noOfTable = "Number of tables cannot be empty.";
    if (!location.trim()) errs.location = "Location cannot be empty.";
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    // Event date/time is stored as local (GMT+8) in the DB — send values as-is.
    try {
      if (isEdit && initial) {
        const updated = await updateEvt.mutateAsync({
          eventGuid: initial.id,
          name: title,
          date,
          time,
          description,
          location,
          userGuid: userGuid ?? "",
          noOfTable,
          rsvpDueDate: rsvpDueDate || null,
        });
        onSuccess?.(updated);
      } else {
        const created = await createEvt.mutateAsync({
          name: title,
          date,
          time,
          description,
          location,
          userGuid: userGuid ?? "",
          noOfTable: noOfTable.toString(),
          rsvpDueDate: rsvpDueDate || null,
        });
        onSuccess?.(created);
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      if (err?.response?.status === 401) {
        try {
          if (isEdit && initial) {
            const updated = await updateEvt.mutateAsync({
              eventGuid: initial.id,
              name: title,
              date,
              time,
              description,
              location,
              userGuid: userGuid ?? "",
              noOfTable,
              rsvpDueDate: rsvpDueDate || null,
            });
            onSuccess?.(updated);
          } else {
            const created = await createEvt.mutateAsync({
              name: title,
              date,
              time,
              description,
              location,
              userGuid: userGuid ?? "",
              noOfTable: noOfTable.toString(),
              rsvpDueDate: rsvpDueDate || null,
            });
            onSuccess?.(created);
          }
          onClose();
          return;
        } catch { /* fall through to show error */ }
      }
      setError(err.response?.data?.message || "Something went wrong.");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Event" : "New Event"}
      className={className}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <FormError message={error} />}
        <FormField
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          error={fieldErrors.title}
        />
        <FormField
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          error={fieldErrors.date}
        />
        <div className="relative">
          <FormField
            label="RSVP Due Date"
            type="date"
            value={rsvpDueDate}
            onChange={(e) => setRsvpDueDate(e.target.value)}
            hint="If left blank, the event date will be used as the RSVP expiry date."
          />
          {rsvpDueDate && (
            <button
              type="button"
              onClick={() => setRsvpDueDate("")}
              className="absolute top-0 right-0 text-xs text-primary hover:underline"
            >
              Clear
            </button>
          )}
        </div>
        <div className="space-y-1">
          <label className="block font-medium">
            Time <span className="ml-1 text-red-600">*</span>
          </label>
          <div className="flex gap-2">
            <select
              value={time ? time.split(":")[0] : ""}
              onChange={(e) => {
                const h = e.target.value;
                const m = time ? (time.split(":")[1] ?? "00") : "00";
                setTime(h ? `${h}:${m}` : "");
              }}
              className={`w-1/2 border rounded p-2 ${fieldErrors.time ? "border-red-500" : "border-gray-300"}`}
            >
              <option value="">-- Hour --</option>
              {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            <select
              value={time ? (time.split(":")[1] ?? "") : ""}
              onChange={(e) => {
                const m = e.target.value;
                const h = time ? (time.split(":")[0] ?? "00") : "00";
                setTime(`${h}:${m}`);
              }}
              className={`w-1/2 border rounded p-2 ${fieldErrors.time ? "border-red-500" : "border-gray-300"}`}
            >
              <option value="">-- Min --</option>
              {["00", "15", "30", "45"].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          {fieldErrors.time && (
            <p className="text-xs text-red-600">{fieldErrors.time}</p>
          )}
        </div>
        <FormField
          label="Number of Tables"
          type="number"
          value={noOfTable.toString()}
          onChange={(e) => setNoOfTable(Number(e.target.value))}
          required
          error={fieldErrors.noOfTable}
        />
        {!isEdit && noOfTable > 0 && (
          <p className="text-xs text-gray-500 -mt-2">
            {noOfTable} table{noOfTable > 1 ? "s" : ""} will be auto-created (e.g. "Table 1", "Table 2"…).
            You can rename or add more tables later.
          </p>
        )}
        {isEdit && (
          <p className="text-xs text-amber-600 -mt-2">
            ⚠ Changing this number won't add or remove tables automatically.
            To adjust your tables, go to the Table Arrangement section.
          </p>
        )}
        <FormField
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <FormField
          label="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          required
          error={fieldErrors.location}
        />
        <div className="flex justify-end space-x-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={createEvt.isPending || updateEvt.isPending}
          >
            {isEdit
              ? updateEvt.isPending
                ? "Saving…"
                : "Save"
              : createEvt.isPending
              ? "Creating…"
              : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
