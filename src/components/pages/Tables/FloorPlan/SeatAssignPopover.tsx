import React from "react";
import type { Guest } from "../../../../api/hooks/useGuestsApi";

interface SeatPopoverState {
  tableId: string;
  seatIndex: number;
  guestId: string | null;
  anchorX: number;
  anchorY: number;
}

interface Props {
  popover: SeatPopoverState;
  guests: Guest[];
  onAssign: (guestId: string) => void;
  onClose: () => void;
}

export const SeatAssignPopover: React.FC<Props> = ({ popover, guests, onAssign, onClose }) => {
  const unassigned = guests.filter((g) => !g.tableId);

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className="absolute bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-64 max-h-72 overflow-hidden flex flex-col animate-fade-in"
        style={{
          left: Math.min(popover.anchorX - 128, window.innerWidth - 272),
          top: Math.max(8, popover.anchorY - 280),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-slate-900">
          <p className="text-sm font-semibold text-slate-800 dark:text-white">Assign Guest to Seat</p>
          <p className="text-xs text-gray-500">Seat #{popover.seatIndex + 1}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5" style={{ scrollbarWidth: "thin" }}>
          {unassigned.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No unassigned guests</p>
          ) : (
            unassigned.map((g) => (
              <button
                key={g.id}
                onClick={() => onAssign(g.id)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-primary/5 dark:hover:bg-slate-700 transition flex items-center justify-between group"
              >
                <div>
                  <span className="text-sm font-medium text-slate-800 dark:text-white">{g.name}</span>
                  {g.flag === "VIP" && (
                    <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-400 text-white text-[10px] font-bold">VIP</span>
                  )}
                </div>
                <span className="text-xs text-gray-400 group-hover:text-primary">{g.pax ?? 1} pax</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
