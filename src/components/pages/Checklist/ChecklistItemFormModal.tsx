// src/components/pages/Checklist/ChecklistItemFormModal.tsx
import { useState, useEffect } from "react";
import { Modal } from "../../molecules/Modal";
import { FormField } from "../../molecules/FormField";
import { Button } from "../../atoms/Button";
import {
  useCreateChecklistItem,
  useUpdateChecklistItem,
  CHECKLIST_CATEGORIES,
  type ChecklistItem,
} from "../../../api/hooks/useChecklistApi";
import toast from "react-hot-toast";

interface ChecklistItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventGuid: string;
  initialData?: ChecklistItem;
}

export function ChecklistItemFormModal({
  isOpen,
  onClose,
  eventGuid,
  initialData,
}: ChecklistItemFormModalProps) {
  const isEdit = !!initialData;
  const createItem = useCreateChecklistItem(eventGuid);
  const updateItem = useUpdateChecklistItem(eventGuid);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialData?.title ?? "");
      setCategory(initialData?.category ?? "");
      setDueDate(
        initialData?.dueDate
          ? initialData.dueDate.split("T")[0]
          : ""
      );
      setNotes(initialData?.notes ?? "");
      setError(null);
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    try {
      if (isEdit) {
        await updateItem.mutateAsync({
          id: initialData!.id,
          title: title.trim(),
          isCompleted: initialData!.isCompleted,
          category: category || null,
          dueDate: dueDate || null,
          notes: notes.trim() || null,
        });
        toast.success("Item updated.");
      } else {
        await createItem.mutateAsync({
          eventGuid,
          title: title.trim(),
          category: category || null,
          dueDate: dueDate || null,
          notes: notes.trim() || null,
          sortOrder: 0,
        });
        toast.success("Item added.");
      }
      onClose();
    } catch {
      setError("Something went wrong. Please try again.");
    }
  };

  const isPending = createItem.isPending || updateItem.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Item" : "Add Checklist Item"}
      className="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField
          label="Title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Book the venue"
          required
        />

        <div className="space-y-1">
          <label className="block text-sm font-medium text-text dark:text-white">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-accent text-text dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">— No category —</option>
            {CHECKLIST_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <FormField
          label="Due Date"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />

        <div className="space-y-1">
          <label className="block text-sm font-medium text-text dark:text-white">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional details…"
            rows={3}
            className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-accent text-text dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
          />
        </div>

        {error && <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isPending} className="flex-1">
            {isPending ? (isEdit ? "Saving…" : "Adding…") : isEdit ? "Save Changes" : "Add Item"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
