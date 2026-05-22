// src/components/molecules/GuestCard.tsx
import React, { useState } from "react";
import { MenuIcon } from "@heroicons/react/solid";

export interface GuestCardProps {
  guest: {
    id: string;
    guestName: string;
    paxCount?: number;
    phoneNo?: string;
    isVip?: boolean;
    dietaryRestrictions?: string[];
  };
  onDragStart?: (guestId: string) => void;
  onDragEnd?: () => void;
  /** Tap/click to pick this guest up — alternate to drag (mobile-friendly). */
  onPick?: (guestId: string) => void;
  isDragging?: boolean;
  /** Highlights this card as the currently-picked guest. */
  isPicked?: boolean;
}

export const GuestCard: React.FC<GuestCardProps> = ({
  guest,
  onDragStart,
  onDragEnd,
  onPick,
  isDragging = false,
  isPicked = false,
}) => {
  const [isHovering, setIsHovering] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("guestId", guest.id);
    onDragStart?.(guest.id);
  };

  const handleDragEnd = () => {
    onDragEnd?.();
  };

  return (
    <div
      draggable="true"
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={onPick ? () => onPick(guest.id) : undefined}
      onKeyDown={onPick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(guest.id); } } : undefined}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={`
        p-3 rounded-lg border border-gray-200
        bg-white dark:bg-accent/50 dark:border-gray-600
        transition-all ${onPick ? "cursor-pointer" : "cursor-grab"} active:cursor-grabbing
        touch-none select-none
        ${isHovering && !isPicked ? "border-primary bg-primary/5 shadow-md" : ""}
        ${isPicked ? "ring-2 ring-primary ring-offset-1 bg-primary/10 dark:bg-primary/20 border-primary shadow-md" : ""}
        ${isDragging ? "opacity-50" : "opacity-100"}
      `}
      role="button"
      tabIndex={0}
      aria-label={onPick ? `Tap to pick up ${guest.guestName}, then tap a table to seat` : `Drag ${guest.guestName} to assign to a table`}
      aria-pressed={isPicked}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <MenuIcon className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
          <h4 className="font-semibold text-sm text-gray-900 dark:text-white truncate">
            {guest.guestName}
          </h4>
        </div>
        {guest.paxCount && guest.paxCount > 1 && (
          <span className="ml-2 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 rounded">
            +{guest.paxCount - 1}
          </span>
        )}
      </div>

      {guest.phoneNo && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {guest.phoneNo.startsWith("+") ? guest.phoneNo : "+" + guest.phoneNo}
        </p>
      )}

      <div className="flex flex-wrap gap-1">
        {guest.isVip && (
          <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-xs font-medium rounded-full">
            VIP
          </span>
        )}
        {guest.dietaryRestrictions?.map((restriction, idx) => (
          <span
            key={idx}
            className="px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 text-xs font-medium rounded-full"
          >
            {restriction}
          </span>
        ))}
      </div>
    </div>
  );
};
