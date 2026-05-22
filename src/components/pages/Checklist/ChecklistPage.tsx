// src/components/pages/Checklist/ChecklistPage.tsx
import { useState } from "react";
import { PageLoader } from "../../atoms/PageLoader";
import { Button } from "../../atoms/Button";
import { StatsCard } from "../../atoms/StatsCard";
import { DeleteConfirmationModal } from "../../molecules/DeleteConfirmationModal";
import { NoEventsState } from "../../molecules/NoEventsState";
import { useEventContext } from "../../../context/EventContext";
import {
  useChecklistApi,
  useUpdateChecklistItem,
  useDeleteChecklistItem,
  useSeedChecklist,
  CHECKLIST_CATEGORIES,
  type ChecklistItem,
} from "../../../api/hooks/useChecklistApi";
import { ChecklistItemFormModal } from "./ChecklistItemFormModal";
import {
  ClipboardCheckIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  ClockIcon,
} from "@heroicons/react/solid";
import toast from "react-hot-toast";

function formatDueDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

const CATEGORY_COLORS: Record<string, string> = {
  "Venue": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "Catering": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  "Attire": "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  "Photography": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  "Flowers & Décor": "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  "Music": "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  "Invitations": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  "Logistics": "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  "General": "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-white/60",
};

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null;
  const cls = CATEGORY_COLORS[category] ?? "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-white/60";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${cls}`}>
      {category}
    </span>
  );
}

export default function ChecklistPage() {
  const { eventId, event, eventsLoading } = useEventContext()!;
  const { data: items = [], isLoading, isError } = useChecklistApi(eventId);
  const updateItem = useUpdateChecklistItem(eventId);
  const deleteItem = useDeleteChecklistItem(eventId);
  const seedChecklist = useSeedChecklist(eventId);

  const [modal, setModal] = useState<{ open: boolean; item?: ChecklistItem }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; item: ChecklistItem | null }>({
    open: false,
    item: null,
  });
  const [activeCategory, setActiveCategory] = useState<string>("All");

  if (eventsLoading) return <PageLoader message="Loading..." />;
  if (!eventId) return <NoEventsState title="No Events" message="Create your first event to use the checklist." />;
  if (isLoading) return <PageLoader message="Loading checklist..." />;
  if (isError) return <div className="text-red-500 p-4">Failed to load checklist.</div>;

  const total = items.length;
  const completed = items.filter((i) => i.isCompleted).length;
  const remaining = total - completed;
  const progressPct = total === 0 ? 0 : Math.round((completed / total) * 100);

  const usedCategories = Array.from(new Set(items.map((i) => i.category).filter(Boolean) as string[]));
  const filterTabs = ["All", ...CHECKLIST_CATEGORIES.filter((c) => usedCategories.includes(c))];

  const visibleItems =
    activeCategory === "All"
      ? items
      : items.filter((i) => i.category === activeCategory);

  const handleToggle = async (item: ChecklistItem) => {
    try {
      await updateItem.mutateAsync({
        id: item.id,
        title: item.title,
        isCompleted: !item.isCompleted,
        category: item.category,
        dueDate: item.dueDate,
        notes: item.notes,
      });
    } catch {
      toast.error("Failed to update item.");
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.item) return;
    try {
      await deleteItem.mutateAsync(deleteModal.item.id);
      toast.success("Item deleted.");
      setDeleteModal({ open: false, item: null });
    } catch {
      toast.error("Failed to delete item.");
    }
  };

  const handleSeed = async () => {
    try {
      await seedChecklist.mutateAsync();
      toast.success("Starter checklist loaded!");
    } catch {
      toast.error("Could not load starter checklist.");
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-primary">Checklist</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Wedding to-dos for{" "}
            <span className="font-medium text-text dark:text-white">{event?.title}</span>
          </p>
        </div>
        <Button variant="primary" onClick={() => setModal({ open: true })}>
          + Add Item
        </Button>
      </div>

      {/* Stats */}
      {total > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <StatsCard
            label="Total"
            value={total}
            variant="primary"
            size="sm"
            icon={<ClipboardCheckIcon />}
          />
          <StatsCard
            label="Done"
            value={completed}
            variant="success"
            size="sm"
            icon={<CheckCircleIcon />}
          />
          <StatsCard
            label="Remaining"
            value={remaining}
            variant="warning"
            size="sm"
            icon={<ClockIcon />}
          />
        </div>
      )}

      {/* Progress bar */}
      {total > 0 && (
        <div className="mb-5">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>Progress</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Category filter tabs */}
      {total > 0 && filterTabs.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {filterTabs.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                activeCategory === cat
                  ? "bg-primary text-white border-primary"
                  : "bg-white dark:bg-accent border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:border-primary/40"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {total === 0 && (
        <div className="text-center py-16">
          <ClipboardCheckIcon className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400 mb-2">No checklist items yet.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-5">
            Start from scratch or load our suggested wedding checklist.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="primary" onClick={() => setModal({ open: true })}>
              + Add Item
            </Button>
            <Button
              variant="secondary"
              onClick={handleSeed}
              disabled={seedChecklist.isPending}
            >
              {seedChecklist.isPending ? "Loading…" : "Load Starter Checklist"}
            </Button>
          </div>
        </div>
      )}

      {/* Item list */}
      {visibleItems.length > 0 && (
        <div className="space-y-2">
          {visibleItems.map((item) => (
            <div
              key={item.id}
              className={`flex items-start gap-3 p-3.5 rounded-xl border transition-colors ${
                item.isCompleted
                  ? "border-green-200 bg-green-50/50 dark:border-green-800/30 dark:bg-green-900/10"
                  : "border-primary/10 dark:border-white/10 bg-white dark:bg-accent hover:border-primary/20"
              }`}
            >
              {/* Checkbox */}
              <button
                type="button"
                onClick={() => handleToggle(item)}
                className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  item.isCompleted
                    ? "border-green-500 bg-green-500"
                    : "border-gray-300 dark:border-white/30 hover:border-primary"
                }`}
                aria-label={item.isCompleted ? "Mark incomplete" : "Mark complete"}
              >
                {item.isCompleted && (
                  <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium leading-snug ${item.isCompleted ? "line-through text-gray-400 dark:text-white/30" : "text-text dark:text-white"}`}>
                  {item.title}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <CategoryBadge category={item.category} />
                  {item.dueDate && (
                    <span className="text-[10px] text-gray-400 dark:text-white/40">
                      Due {formatDueDate(item.dueDate)}
                    </span>
                  )}
                  {item.notes && (
                    <span className="text-[10px] text-gray-400 dark:text-white/40 italic truncate max-w-xs">
                      {item.notes}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  title="Edit"
                  onClick={() => setModal({ open: true, item })}
                  className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-slate-800 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/10 transition-colors"
                >
                  <PencilIcon className="h-3.5 w-3.5" />
                </button>
                <button
                  title="Delete"
                  onClick={() => setDeleteModal({ open: true, item })}
                  className="p-1.5 rounded-lg bg-white border border-red-200 text-red-500 hover:bg-red-50 dark:bg-slate-800 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No results for active filter */}
      {total > 0 && visibleItems.length === 0 && (
        <div className="text-center py-10 text-sm text-gray-400 dark:text-white/40">
          No items in this category.
        </div>
      )}

      {/* Form modal */}
      <ChecklistItemFormModal
        isOpen={modal.open}
        onClose={() => setModal({ open: false })}
        eventGuid={eventId!}
        initialData={modal.item}
      />

      {/* Delete confirmation */}
      <DeleteConfirmationModal
        isOpen={deleteModal.open}
        isDeleting={deleteItem.isPending}
        title="Delete Item"
        description="This checklist item will be permanently removed."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal({ open: false, item: null })}
      >
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Delete <strong>{deleteModal.item?.title}</strong>?
        </p>
      </DeleteConfirmationModal>
    </>
  );
}
