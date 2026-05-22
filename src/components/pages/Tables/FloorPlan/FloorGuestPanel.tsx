import React, { useState, useMemo } from "react";
import type { Guest } from "../../../../api/hooks/useGuestsApi";

interface Props {
  guests: Guest[];
  tables: { id: string; name: string }[];
}

export const FloorGuestPanel: React.FC<Props> = ({ guests, tables }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const unassigned = useMemo(
    () => guests.filter((g) => !g.tableId),
    [guests]
  );
  const assignedGuests = useMemo(
    () => guests.filter((g) => !!g.tableId),
    [guests]
  );

  const filtered = useMemo(() => {
    if (!searchTerm) return unassigned;
    const term = searchTerm.toLowerCase();
    return unassigned.filter(
      (g) =>
        g.name.toLowerCase().includes(term) ||
        g.phoneNo?.toLowerCase().includes(term)
    );
  }, [unassigned, searchTerm]);

  const tableNameMap = useMemo(() => new Map(tables.map(t => [t.id, t.name])), [tables]);

  return (
    <div className="w-80 flex-shrink-0 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4 text-primary">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Guests</h3>
        </div>
        <div className="flex gap-1">
          <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
            {assignedGuests.length} seated
          </span>
          <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
            {unassigned.length} pending
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
        <div className="relative">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            placeholder="Search guests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-slate-800 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
          />
        </div>
      </div>

      {/* Guest list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ scrollbarWidth: "thin" }}>
        {/* Unassigned section */}
        <p className="text-[10px] uppercase tracking-wider text-yellow-600 dark:text-yellow-400 font-semibold flex items-center gap-1 mb-2">
          {"\u26a0\ufe0f"} Unassigned ({unassigned.length})
        </p>

        {filtered.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-slate-400">
              {searchTerm ? "No matches found" : "All guests are assigned!"}
            </p>
          </div>
        ) : (
          filtered.map((guest) => (
            <div
              key={guest.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("guestId", guest.id);
                setDraggingId(guest.id);
              }}
              onDragEnd={() => setDraggingId(null)}
              className={`p-3 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-slate-800 cursor-grab hover:border-primary hover:bg-primary/5 transition-all ${
                draggingId === guest.id ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm text-slate-800 dark:text-white">{guest.name}</span>
                {(guest.pax ?? 1) > 0 && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                    {guest.pax ?? 1} pax
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                {guest.phoneNo && <span>{"\ud83d\udcf1"} {guest.phoneNo}</span>}
                {guest.flag === "VIP" && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-400 text-white text-[10px] font-bold">VIP</span>
                )}
              </div>
            </div>
          ))
        )}

        {/* Assigned section */}
        {assignedGuests.length > 0 && (
          <>
            <p className="text-[10px] uppercase tracking-wider text-green-600 dark:text-green-400 font-semibold flex items-center gap-1 mt-4 mb-2">
              {"\u2705"} Assigned ({assignedGuests.length})
            </p>
            {assignedGuests.slice(0, 5).map((guest) => (
              <div key={guest.id} className="p-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-slate-800 dark:text-white">{guest.name}</p>
                    <p className="text-[10px] text-green-600 dark:text-green-400">
                      {tableNameMap.get(guest.tableId ?? "") ?? "Table"} {"\u2022"} Seat {guest.seatIndex ?? "?"}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                    {guest.pax ?? 1} pax
                  </span>
                </div>
              </div>
            ))}
            {assignedGuests.length > 5 && (
              <p className="text-center text-xs text-gray-400 py-2">
                + {assignedGuests.length - 5} more assigned...
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};
