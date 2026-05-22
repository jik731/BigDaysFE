// src/components/molecules/TableCard.tsx
import React, { useState } from "react";
import { XIcon, PencilIcon, TrashIcon } from "@heroicons/react/solid";

const categoryDisplayNames: Record<string, string> = {
  vip: "VIP",
  "family-bride": "Family — Bride",
  "family-groom": "Family — Groom",
  friends: "Friends",
  colleagues: "Colleagues",
};

export interface TableCardProps {
  table: {
    id: string;
    name: string;
    capacity: number;
    assignedCount: number;
    guests: Array<{ id: string; guestName: string; paxCount?: number }>;
    category?: "vip" | "family-bride" | "family-groom" | "friends" | "colleagues";
  };
  onDrop?: (guestId: string, tableId: string) => void;
  onEdit?: (tableId: string) => void;
  onDelete?: (tableId: string) => void;
  onUnassignGuest?: (guestId: string) => void;
  onGuestDragStart?: (guestId: string, sourceTableId: string) => void;
  onGuestDragEnd?: () => void;
  /** Tap/click an internal guest to pick them up (mobile-friendly alt to drag). */
  onGuestPick?: (guestId: string, sourceTableId: string) => void;
  /** Tap/click this whole card to assign the currently-picked guest to it. */
  onTableClick?: (tableId: string) => void;
  isDropTarget?: boolean;
  draggedGuest?: { id: string; paxCount: number; sourceTableId?: string | null } | null;
  /** The currently-picked guest, if any. Used to show a "selectable" highlight. */
  pickedGuest?: { id: string; paxCount: number; sourceTableId: string | null } | null;
}

export const TableCard: React.FC<TableCardProps> = ({
  table,
  onDrop,
  onEdit,
  onDelete,
  onUnassignGuest,
  onGuestDragStart,
  onGuestDragEnd,
  onGuestPick,
  onTableClick,
  draggedGuest,
  pickedGuest,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const isSourceTable = !!draggedGuest && draggedGuest.sourceTableId === table.id;
  // Picked-state helpers (separate from drag state):
  const isPickSource = !!pickedGuest && pickedGuest.sourceTableId === table.id;
  const pickedFits = pickedGuest
    ? pickedGuest.paxCount <= (table.capacity - (isPickSource ? table.assignedCount - pickedGuest.paxCount : table.assignedCount))
    : true;
  // When the dragged guest originates from this table, exclude their pax from the
  // current assigned count so the capacity hint reflects the post-move state.
  const effectiveAssignedCount = isSourceTable
    ? table.assignedCount - (draggedGuest?.paxCount || 0)
    : table.assignedCount;
  const availableSeats = table.capacity - effectiveAssignedCount;
  const isOverCapacity = table.assignedCount > table.capacity;
  // Only block drop if table is strictly full with no room at all during drag hint
  const canAcceptDrop = draggedGuest
    ? draggedGuest.paxCount <= availableSeats
    : availableSeats > 0;

  // Color scheme based on category
  const categoryColors = {
    vip: {
      header: "from-purple-50 to-white dark:from-purple-900/20 dark:to-accent",
      icon: "from-purple-500 to-purple-700",
      badge: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
    },
    "family-bride": {
      header: "from-pink-50 to-white dark:from-pink-900/20 dark:to-accent",
      icon: "from-pink-500 to-rose-600",
      badge: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",
    },
    "family-groom": {
      header: "from-blue-50 to-white dark:from-blue-900/20 dark:to-accent",
      icon: "from-blue-500 to-blue-700",
      badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    },
    friends: {
      header: "from-green-50 to-white dark:from-green-900/20 dark:to-accent",
      icon: "from-green-500 to-emerald-600",
      badge: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    },
    colleagues: {
      header: "from-orange-50 to-white dark:from-orange-900/20 dark:to-accent",
      icon: "from-orange-500 to-amber-600",
      badge: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    },
  };

  const colors = categoryColors[table.category || "friends"];
  const progress = (table.assignedCount / table.capacity) * 100;
  const isFull = table.assignedCount >= table.capacity;
  const isOver = table.assignedCount > table.capacity;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const guestId = e.dataTransfer.getData("guestId");
    if (guestId && onDrop) {
      onDrop(guestId, table.id);
    }
  };

  // Wrapper click only does something when a guest is currently picked.
  // Clicking the same table the guest came from = cancel pickup.
  const handleWrapperClick = pickedGuest
    ? () => onTableClick?.(table.id)
    : undefined;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleWrapperClick}
      className={`
        relative rounded-xl shadow-sm overflow-hidden transition-all
        ${isDragOver && canAcceptDrop ? "ring-4 ring-primary ring-offset-2 shadow-lg scale-[1.02]" : ""}
        ${!canAcceptDrop && draggedGuest ? "opacity-50 cursor-not-allowed" : ""}
        ${pickedGuest && !isPickSource && pickedFits ? "ring-2 ring-primary/50 ring-offset-1 cursor-pointer" : ""}
        ${pickedGuest && !isPickSource && !pickedFits ? "ring-2 ring-red-300 opacity-60" : ""}
        ${isPickSource ? "ring-2 ring-amber-300 ring-offset-1 cursor-pointer" : ""}
        hover:shadow-md
      `}
      role="region"
      aria-label={`${table.name} - ${table.assignedCount} of ${table.capacity} seats filled`}
    >
      {/* Header with gradient */}
      <div className={`bg-gradient-to-r ${colors.header} p-4 border-b`}>
        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1">
          {table.name}
        </h3>
        {table.category && (
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors.badge}`}>
              {categoryDisplayNames[table.category] ?? table.category}
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="bg-white dark:bg-accent p-4">
        {/* Seat count with progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              Seats
            </span>
            <span className={`font-semibold ${isOver ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"}`}>
              {table.assignedCount} / {table.capacity}
              {isOver && <span className="ml-1.5 text-xs font-bold">Over capacity</span>}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isOver
                  ? "bg-red-500"
                  : isFull
                  ? "bg-green-500"
                  : progress > 80
                  ? "bg-amber-500"
                  : "bg-primary"
              }`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>

        {/* Guest list */}
        <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
          {table.guests.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-4">
              No guests assigned yet
            </p>
          ) : (
            table.guests.map((guest) => {
              const isGuestDraggable = !!onGuestDragStart;
              const isGuestPickable = !!onGuestPick;
              const isBeingDragged = draggedGuest?.id === guest.id;
              const isBeingPicked = pickedGuest?.id === guest.id;
              return (
                <div
                  key={guest.id}
                  draggable={isGuestDraggable}
                  onDragStart={
                    isGuestDraggable
                      ? (e) => {
                          e.stopPropagation();
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("guestId", guest.id);
                          onGuestDragStart?.(guest.id, table.id);
                        }
                      : undefined
                  }
                  onDragEnd={
                    isGuestDraggable
                      ? () => onGuestDragEnd?.()
                      : undefined
                  }
                  onClick={
                    isGuestPickable
                      ? (e) => {
                          e.stopPropagation();
                          onGuestPick?.(guest.id, table.id);
                        }
                      : undefined
                  }
                  onKeyDown={
                    isGuestPickable
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            onGuestPick?.(guest.id, table.id);
                          }
                        }
                      : undefined
                  }
                  role={isGuestPickable ? "button" : undefined}
                  tabIndex={isGuestPickable ? 0 : undefined}
                  title={
                    isGuestPickable
                      ? "Tap to pick up, then tap another table to move or the Unassigned panel to remove"
                      : isGuestDraggable
                      ? "Drag to reassign to another table"
                      : undefined
                  }
                  className={`
                    flex items-center gap-2 p-2 rounded bg-gray-50 dark:bg-gray-800 group
                    hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors
                    ${isGuestPickable ? "cursor-pointer" : isGuestDraggable ? "cursor-grab active:cursor-grabbing" : ""}
                    ${isGuestDraggable || isGuestPickable ? "select-none" : ""}
                    ${isBeingDragged ? "opacity-50" : ""}
                    ${isBeingPicked ? "ring-2 ring-primary bg-primary/10 dark:bg-primary/20" : ""}
                  `}
                >
                  {/* Initial avatar */}
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {guest.guestName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {guest.guestName}
                    </p>
                    {guest.paxCount && guest.paxCount > 1 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        +{guest.paxCount - 1} guests
                      </p>
                    )}
                  </div>
                  {onUnassignGuest && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUnassignGuest(guest.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                      title="Unassign guest"
                    >
                      <XIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Action buttons — hidden entirely for read-only (crew) users */}
        {(onEdit || onDelete) && (
          <div className="flex gap-2 pt-3 border-t dark:border-gray-700">
            {onEdit && (
              <button
                title="Edit"
                onClick={(e) => { e.stopPropagation(); onEdit(table.id); }}
                className="p-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-accent dark:border-white/10 dark:text-white dark:hover:bg-white/10 transition-colors"
              >
                <PencilIcon className="h-4 w-4" />
              </button>
            )}
            {onDelete && (
              <button
                title="Delete"
                onClick={(e) => { e.stopPropagation(); onDelete(table.id); }}
                className="p-2 rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50 dark:bg-accent dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Drop indicator overlay */}
      {isDragOver && canAcceptDrop && !isSourceTable && (
        <div className="absolute inset-0 bg-primary/10 border-4 border-dashed border-primary rounded-xl flex items-center justify-center pointer-events-none">
          <div className="bg-white dark:bg-accent px-4 py-2 rounded-lg shadow-lg">
            <p className="text-primary font-semibold">Drop guest here</p>
          </div>
        </div>
      )}
      
      {/* Insufficient capacity indicator */}
      {draggedGuest && !canAcceptDrop && !isSourceTable && (
        <div className="absolute inset-0 bg-red-500/10 border-2 border-red-500 rounded-xl flex items-center justify-center pointer-events-none">
          <div className="bg-white dark:bg-accent px-4 py-2 rounded-lg shadow-lg border-2 border-red-500">
            <p className="text-red-600 font-semibold text-sm">
              Not enough seats
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Need {draggedGuest.paxCount}, only {availableSeats} available
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
