// src/components/pages/Tables/TablesRedesignPage.tsx
// Full-screen table assignment builder — covers the whole viewport (fixed inset-0 z-50),
// same pattern as RsvpDesignV2Page. Opens in a new tab.

import { useState, useMemo } from "react";
import { PageLoader } from "../../atoms/PageLoader";
import { ErrorState } from "../../atoms/ErrorState";
import { NoEventsState } from "../../molecules/NoEventsState";
import { Dropdown, DropdownItem } from "../../atoms/Dropdown";
import { QuickSetupModal } from "../../molecules/QuickSetupModal";
import { TableFormModal } from "../../molecules/TableFormModal";
import { DeleteConfirmationModal } from "../../molecules/DeleteConfirmationModal";
import {
  useTablesApi,
  useDeleteTable,
  useBulkDeleteTables,
} from "../../../api/hooks/useTablesApi";
import {
  useGuestsApi,
  useAssignGuestToTable,
  useUnassignGuestFromTable,
  useAutoAssignGuests,
} from "../../../api/hooks/useGuestsApi";
import { useEventContext } from "../../../context/EventContext";
import { useAuth } from "../../../api/hooks/useAuth";
import toast from "react-hot-toast";
import { ChevronDownIcon, XIcon, MenuIcon, PencilIcon, TrashIcon } from "@heroicons/react/solid";

// ── Colour helpers ────────────────────────────────────────────────────────────
function barFill(a: number, c: number) {
  if (a > c) return "#ef4444";
  if (a >= c) return "#22c55e";
  if (a / c > 0.8) return "#f59e0b";
  return "#6366f1";
}
function dotCls(a: number, c: number) {
  if (a > c) return "bg-red-500";
  if (a >= c) return "bg-green-500";
  if (a / c > 0.6) return "bg-amber-400";
  return "bg-gray-300";
}
function countCls(a: number, c: number) {
  if (a > c) return "text-red-600";
  if (a >= c) return "text-green-600";
  return "text-gray-700";
}

export default function TablesRedesignPage() {
  // ── API hooks (all before early returns) ──────────────────────────────────
  const { userRole } = useAuth();
  const isReadOnly = userRole === 6;
  const { event, eventId, eventsLoading } = useEventContext()!;

  const { data: tables = [], isLoading: tablesLoading, isError: tablesError } = useTablesApi(eventId!);
  const { data: guests = [], isLoading: guestsLoading, isError: guestsError } = useGuestsApi(eventId!);

  const deleteTable      = useDeleteTable(eventId);
  const bulkDeleteTables = useBulkDeleteTables(eventId);
  const assignGuest      = useAssignGuestToTable(eventId || "");
  const unassignGuest    = useUnassignGuestFromTable(eventId || "");
  const autoAssign       = useAutoAssignGuests(eventId || "");

  // ── UI state ──────────────────────────────────────────────────────────────
  const [guestSearch,     setGuestSearch]     = useState("");
  const [guestFilter,     setGuestFilter]     = useState<"all" | "vip" | "large">("all");
  const [tableSearch,     setTableSearch]     = useState("");
  const [tableFilter,     setTableFilter]     = useState<"all" | "hasEmpty" | "full">("all");
  const [density,         setDensity]         = useState<"compact" | "detailed">("compact");
  const [draggedGuestId,  setDraggedGuestId]  = useState<string | null>(null);
  const [draggedGuest,    setDraggedGuest]    = useState<{ id: string; paxCount: number } | null>(null);
  const [dragOverTableId, setDragOverTableId] = useState<string | null>(null);
  const [openTableId,     setOpenTableId]     = useState<string | null>(null);
  const [showQuickSetup,  setShowQuickSetup]  = useState(false);
  const [showCreateTable, setShowCreateTable] = useState(false);
  const [editingTable,    setEditingTable]    = useState<{ id: string; name: string; capacity: number } | null>(null);
  const [deletingTable,   setDeletingTable]   = useState<{ id: string; name: string } | null>(null);
  const [selectMode,      setSelectMode]      = useState(false);
  const [selectedTableIds,setSelectedTableIds]= useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // ── Computed values ───────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const seated   = guests.filter(g =>  g.tableId).reduce((s, g) => s + (g.pax || g.noOfPax || 1), 0);
    const unseated = guests.filter(g => !g.tableId).reduce((s, g) => s + (g.pax || g.noOfPax || 1), 0);
    const cap      = tables.reduce((s, t) => s + t.capacity, 0);
    return { totalTables: tables.length, seated, unseated, cap };
  }, [tables, guests]);

  const tablesWithGuests = useMemo(() => tables.map(table => {
    const tg = guests.filter(g => g.tableId === table.id);
    return {
      ...table,
      guests: tg.map(g => ({
        id:        g.id,
        guestName: g.guestName || g.name,
        paxCount:  g.pax || g.noOfPax || 1,
        isVip:     !!(g.remarks || g.notes)?.toLowerCase().includes("vip"),
      })),
      assignedCount: tg.reduce((s, g) => s + (g.pax || g.noOfPax || 1), 0),
    };
  }), [tables, guests]);

  const filteredTables = useMemo(() => tablesWithGuests.filter(t => {
    if (tableFilter === "hasEmpty" && t.assignedCount >= t.capacity) return false;
    if (tableFilter === "full"     && t.assignedCount <  t.capacity) return false;
    if (tableSearch) {
      const lo = tableSearch.toLowerCase();
      if (!t.name.toLowerCase().includes(lo) && !t.guests.some(g => g.guestName.toLowerCase().includes(lo))) return false;
    }
    return true;
  }), [tablesWithGuests, tableFilter, tableSearch]);

  const filteredUnassigned = useMemo(() => guests.filter(g => {
    if (g.tableId) return false;
    if (guestFilter === "vip"   && !(g.remarks || g.notes)?.toLowerCase().includes("vip")) return false;
    if (guestFilter === "large" && (g.pax || g.noOfPax || 1) < 2) return false;
    if (guestSearch) {
      const n = g.guestName || g.name;
      if (!n.toLowerCase().includes(guestSearch.toLowerCase())) return false;
    }
    return true;
  }), [guests, guestFilter, guestSearch]);

  const openTable = useMemo(
    () => openTableId ? tablesWithGuests.find(t => t.id === openTableId) ?? null : null,
    [tablesWithGuests, openTableId]
  );

  const unassignedPax = useMemo(
    () => guests.filter(g => !g.tableId).reduce((s, g) => s + (g.pax || g.noOfPax || 1), 0),
    [guests]
  );

  // ── Early returns ─────────────────────────────────────────────────────────
  if (eventsLoading) return <div className="fixed inset-0 z-50 bg-white flex items-center justify-center"><PageLoader message="Loading…" /></div>;
  if (!eventId)      return <div className="fixed inset-0 z-50 bg-white flex items-center justify-center"><NoEventsState title="No Events" message="Create an event first." /></div>;
  if (tablesLoading || guestsLoading) return <div className="fixed inset-0 z-50 bg-white flex items-center justify-center"><PageLoader message="Loading tables…" /></div>;
  if (tablesError   || guestsError)   return <div className="fixed inset-0 z-50 bg-white flex items-center justify-center"><ErrorState message="Failed to load data." onRetry={() => window.location.reload()} /></div>;

  // ── Drag & drop ───────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, guestId: string) => {
    const g = guests.find(x => x.id === guestId);
    if (!g) return;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("guestId", guestId);
    setDraggedGuestId(guestId);
    setDraggedGuest({ id: guestId, paxCount: g.pax || g.noOfPax || 1 });
  };
  const handleDragEnd = () => { setDraggedGuestId(null); setDraggedGuest(null); setDragOverTableId(null); };

  const handleDrop = (e: React.DragEvent, tableId: string) => {
    e.preventDefault();
    setDragOverTableId(null);
    const guestId = e.dataTransfer.getData("guestId");
    if (guestId) doAssign(guestId, tableId);
  };

  const doAssign = (guestId: string, tableId: string) => {
    const g = guests.find(x => x.id === guestId);
    const t = tablesWithGuests.find(x => x.id === tableId);
    if (!g || !t) return;
    const pax = g.pax || g.noOfPax || 1;
    if (pax > t.capacity - t.assignedCount) {
      toast(`⚠️ ${t.name} is over capacity. Guest assigned anyway.`, {
        duration: 4000, style: { background: "#fef3c7", color: "#92400e" },
      });
    }
    assignGuest.mutate({ guestId, tableId }, { onError: () => toast.error("Failed to assign guest") });
  };

  const handleUnassign = (guestId: string) => {
    unassignGuest.mutate(guestId, { onError: () => toast.error("Failed to unassign guest") });
  };

  // ── Table CRUD ────────────────────────────────────────────────────────────
  const handleEditTable = (tableId: string) => {
    const t = tablesWithGuests.find(x => x.id === tableId);
    if (t) setEditingTable({ id: t.id, name: t.name, capacity: t.capacity });
  };
  const handleDeleteTable = (tableId: string) => {
    const t = tablesWithGuests.find(x => x.id === tableId);
    if (t) setDeletingTable({ id: t.id, name: t.name });
  };
  const confirmDelete = () => {
    if (!deletingTable) return;
    deleteTable.mutate(deletingTable.id, {
      onSuccess: () => { if (openTableId === deletingTable.id) setOpenTableId(null); },
      onError: () => toast.error("Failed to delete table"),
    });
    setDeletingTable(null);
  };
  const toggleSelectMode = () => { setSelectMode(p => !p); setSelectedTableIds(new Set()); };
  const toggleTableSelection = (id: string) => {
    setSelectedTableIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const confirmBulkDelete = () => {
    bulkDeleteTables.mutate({ tableIds: Array.from(selectedTableIds) }, {
      onSuccess: () => {
        toast.success(`${selectedTableIds.size} tables deleted.`);
        setShowBulkDeleteConfirm(false); setSelectMode(false); setSelectedTableIds(new Set());
      },
      onError: () => toast.error("Failed to delete tables"),
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background"
      style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}
    >

      {/* ══════════════════════════════════════════════════════════
          TOP TOOLBAR  (52 px, same style as RsvpDesignV2)
      ══════════════════════════════════════════════════════════ */}
      <header
        className="flex items-center gap-3 px-4 shrink-0 bg-white border-b border-primary/20"
        style={{ height: 52, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", zIndex: 10 }}
      >
        {/* Close tab */}
        <button
          onClick={() => window.close()}
          className="flex items-center justify-center w-7 h-7 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition shrink-0"
          title="Close"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="13" y2="13" /><line x1="13" y1="1" x2="1" y2="13" />
          </svg>
        </button>

        <div className="w-px h-6 bg-gray-200 shrink-0" />

        {/* Title */}
        <div className="min-w-0 shrink-0">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest leading-none mb-0.5">Table Arrangement</p>
          <p className="text-sm font-semibold text-gray-800 truncate leading-tight max-w-[180px]">
            {event?.title ?? "Untitled event"}
          </p>
        </div>

        <div className="w-px h-6 bg-gray-200 shrink-0" />

        {/* Inline stats */}
        <div className="hidden md:flex items-center gap-4 text-xs">
          {[
            { dot: "bg-primary",   val: stats.totalTables, label: "tables"     },
            { dot: "bg-green-500", val: stats.seated,      label: "seated"     },
            { dot: "bg-amber-400", val: stats.unseated,    label: "unassigned" },
            { dot: "bg-gray-400",  val: stats.cap,         label: "capacity"   },
          ].map(s => (
            <span key={s.label} className="flex items-center gap-1 text-gray-500">
              <span className={`w-2 h-2 rounded-full ${s.dot} inline-block`} />
              <strong className="text-gray-700 font-semibold">{s.val}</strong> {s.label}
            </span>
          ))}
        </div>

        {/* Density toggle */}
        <div className="hidden sm:flex items-center gap-1 bg-primary/10 rounded-md p-0.5 ml-auto">
          {(["compact", "detailed"] as const).map(d => (
            <button
              key={d}
              onClick={() => setDensity(d)}
              className={`text-xs px-2.5 py-1.5 rounded font-medium transition ${
                density === d ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {d === "compact" ? "Compact" : "Detailed"}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-gray-200 shrink-0 hidden sm:block" />

        {/* Actions */}
        {!isReadOnly && (
          <div className="flex items-center gap-2">
            <button
              disabled={autoAssign.isPending}
              onClick={() => autoAssign.mutate(undefined, {
                onSuccess: res => {
                  const d = res?.data;
                  toast.success(d ? `Auto-assign complete. Assigned: ${d.assignedCount}, Skipped: ${d.skippedCount}.` : "Auto-assign complete.");
                },
                onError: () => toast.error("Auto-assign failed."),
              })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-primary/20 rounded-md text-gray-600 hover:border-primary hover:text-primary transition bg-white disabled:opacity-50"
            >
              {autoAssign.isPending ? (
                <><svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg> Assigning…</>
              ) : "Auto-Assign"}
            </button>

            {selectMode ? (
              <>
                {selectedTableIds.size > 0 && (
                  <button
                    onClick={() => setShowBulkDeleteConfirm(true)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-md bg-red-500 text-white hover:bg-red-600 transition"
                  >
                    Delete ({selectedTableIds.size})
                  </button>
                )}
                <button onClick={toggleSelectMode} className="px-3 py-1.5 text-xs font-medium border border-primary/20 rounded-md text-gray-600 hover:bg-primary/5 transition">
                  Cancel
                </button>
              </>
            ) : (
              <button onClick={toggleSelectMode} className="px-3 py-1.5 text-xs font-medium border border-primary/20 rounded-md text-gray-600 hover:bg-primary/5 transition">
                Select
              </button>
            )}

            <Dropdown
              trigger={
                <button className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md bg-primary text-white hover:bg-primary/90 transition">
                  + New Table <ChevronDownIcon className="w-3.5 h-3.5" />
                </button>
              }
            >
              <DropdownItem onClick={() => setShowCreateTable(true)}>
                <div>
                  <div className="font-medium">Create Single Table</div>
                  <div className="text-xs text-gray-500">Create one table at a time</div>
                </div>
              </DropdownItem>
              <DropdownItem onClick={() => setShowQuickSetup(true)}>
                <div>
                  <div className="font-medium">Bulk Create <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">Recommended</span></div>
                  <div className="text-xs text-gray-500">Create by category or custom prefix</div>
                </div>
              </DropdownItem>
            </Dropdown>
          </div>
        )}
      </header>

      {/* ══════════════════════════════════════════════════════════
          MAIN — left panel | center grid | right detail
      ══════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT PANEL — unassigned guest list ───────────────── */}
        <aside
          className="flex flex-col overflow-hidden bg-background border-r border-primary/10 shrink-0"
          style={{ width: 240 }}
        >
          {/* Header */}
          <div className="px-3 pt-3 pb-2.5 border-b border-primary/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Unassigned</span>
              <span className="text-xs font-bold bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">{unassignedPax}</span>
            </div>
            <input
              type="text"
              placeholder="Search guests…"
              value={guestSearch}
              onChange={e => setGuestSearch(e.target.value)}
              className="w-full text-xs border border-primary/20 rounded-md px-2.5 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            <div className="flex gap-1 mt-2">
              {(["all", "vip", "large"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setGuestFilter(f)}
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold transition ${
                    guestFilter === f ? "bg-primary/10 text-primary" : "text-gray-400 hover:bg-primary/5"
                  }`}
                >
                  {f === "all" ? "All" : f === "vip" ? "VIP" : "Pax ≥2"}
                </button>
              ))}
            </div>
          </div>

          {/* Guest rows */}
          <div className="flex-1 overflow-y-auto py-1">
            {filteredUnassigned.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-8 px-3">
                {guests.filter(g => !g.tableId).length === 0 ? "All guests assigned!" : "No guests match filter"}
              </p>
            ) : (
              filteredUnassigned.map(guest => {
                const name  = guest.guestName || guest.name;
                const pax   = guest.pax || guest.noOfPax || 1;
                const isVip = !!(guest.remarks || guest.notes)?.toLowerCase().includes("vip");
                return (
                  <div
                    key={guest.id}
                    draggable={!isReadOnly}
                    onDragStart={e => handleDragStart(e, guest.id)}
                    onDragEnd={handleDragEnd}
                    className={`
                      flex items-center gap-2 px-3 py-1.5 mx-1 rounded-lg text-xs border border-transparent select-none transition-colors
                      ${!isReadOnly ? "cursor-grab active:cursor-grabbing hover:bg-primary/5 hover:border-primary/20" : ""}
                      ${draggedGuestId === guest.id ? "opacity-40" : ""}
                    `}
                  >
                    {!isReadOnly && <MenuIcon className="w-3 h-3 text-gray-300 flex-shrink-0" />}
                    <span className="flex-1 truncate font-medium text-gray-800">{name}</span>
                    {isVip && <span className="text-[10px] bg-amber-100 text-amber-700 rounded-full px-1.5 font-semibold flex-shrink-0">VIP</span>}
                    {pax > 1 && <span className="text-[10px] bg-gray-100 text-gray-500 rounded-full px-1.5 font-semibold flex-shrink-0">+{pax - 1}</span>}
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* ── CENTER — toolbar + scrollable table grid ─────────── */}
        <div className="flex flex-1 flex-col overflow-hidden">

          {/* Sub-toolbar */}
          <div
            className="flex items-center gap-3 px-4 py-2 shrink-0 bg-background border-b border-primary/10 flex-wrap"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
          >
            <input
              type="text"
              placeholder="Search tables or guests…"
              value={tableSearch}
              onChange={e => setTableSearch(e.target.value)}
              className="text-xs border border-primary/20 rounded-md px-2.5 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 w-48"
            />
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-gray-400 font-medium">Show:</span>
              {(["all", "hasEmpty", "full"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setTableFilter(f)}
                  className={`px-2 py-0.5 rounded-full font-semibold transition text-[11px] ${
                    tableFilter === f ? "bg-primary/10 text-primary" : "text-gray-400 hover:bg-primary/5"
                  }`}
                >
                  {f === "all" ? "All" : f === "hasEmpty" ? "Has Space" : "Full"}
                </button>
              ))}
            </div>
            <span className="ml-auto text-xs text-gray-400">{filteredTables.length} table{filteredTables.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-5">
            {filteredTables.length === 0 ? (
              <div className="p-8 rounded-xl border-2 border-dashed border-primary/20 text-center space-y-2 bg-white">
                <p className="text-base font-semibold text-gray-700">No tables found.</p>
                <p className="text-sm text-gray-400">
                  {tableSearch ? "Try a different search term." : "Use + New Table to get started."}
                </p>
              </div>
            ) : (
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(172px, 1fr))" }}>
                {filteredTables.map(table => {
                  const pct     = Math.min((table.assignedCount / table.capacity) * 100, 100);
                  const bc      = barFill(table.assignedCount, table.capacity);
                  const isOpen  = openTableId === table.id;
                  const isOver  = dragOverTableId === table.id && !!draggedGuest;
                  const dropOk  = isOver && draggedGuest!.paxCount <= (table.capacity - table.assignedCount);
                  const dropBad = isOver && draggedGuest!.paxCount >  (table.capacity - table.assignedCount);

                  const base = [
                    "relative rounded-xl bg-white cursor-pointer transition-all select-none group",
                    isOpen    ? "ring-2 ring-primary shadow-md"
                    : dropOk  ? "ring-2 ring-primary ring-offset-1 bg-primary/5"
                    : dropBad ? "ring-2 ring-red-400 bg-red-50"
                    : "border border-primary/20 hover:border-primary/40 hover:shadow-sm",
                  ].join(" ");

                  const dnd = !isReadOnly && !selectMode ? {
                    onDragOver:  (e: React.DragEvent) => { e.preventDefault(); setDragOverTableId(table.id); },
                    onDragLeave: () => setDragOverTableId(null),
                    onDrop:      (e: React.DragEvent) => handleDrop(e, table.id),
                  } : {};

                  const onClick = () => {
                    if (selectMode) { toggleTableSelection(table.id); return; }
                    setOpenTableId(p => p === table.id ? null : table.id);
                  };

                  return density === "compact" ? (
                    /* ── Compact tile ─────────────────────────── */
                    <div key={table.id} className={base} style={{ minHeight: 114 }} onClick={onClick} {...dnd}>
                      {selectMode && (
                        <div className="absolute top-2 left-2 z-10" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" className="w-4 h-4 accent-primary cursor-pointer"
                            checked={selectedTableIds.has(table.id)} onChange={() => toggleTableSelection(table.id)} />
                        </div>
                      )}
                      <div className="p-3">
                        <div className="flex items-start justify-between mb-1.5">
                          <span className="font-semibold text-gray-900 text-sm leading-tight pr-1">{table.name}</span>
                          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                            <span className={`w-2 h-2 rounded-full ${dotCls(table.assignedCount, table.capacity)}`} />
                            <span className={`text-[11px] font-bold ${countCls(table.assignedCount, table.capacity)}`}>
                              {table.assignedCount}/{table.capacity}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-2">
                          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: bc }} />
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {table.guests.slice(0, 4).map(g => (
                            <span key={g.id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary whitespace-nowrap">
                              {g.guestName.split(" ")[0]}
                            </span>
                          ))}
                          {table.guests.length > 4 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">+{table.guests.length - 4}</span>
                          )}
                        </div>
                      </div>
                      {!isReadOnly && !selectMode && (
                        <div
                          className="flex gap-1.5 px-3 pb-2.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleEditTable(table.id)}
                            title="Edit"
                            className="flex-1 flex items-center justify-center py-1 rounded-md border border-primary/20 text-gray-500 hover:bg-primary/5 hover:text-primary transition"
                          >
                            <PencilIcon className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteTable(table.id)}
                            title="Delete"
                            className="flex-1 flex items-center justify-center py-1 rounded-md border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 transition"
                          >
                            <TrashIcon className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* ── Detailed tile ────────────────────────── */
                    <div key={table.id} className={base} onClick={onClick} {...dnd}>
                      {selectMode && (
                        <div className="absolute top-2 left-2 z-10" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" className="w-4 h-4 accent-primary cursor-pointer"
                            checked={selectedTableIds.has(table.id)} onChange={() => toggleTableSelection(table.id)} />
                        </div>
                      )}
                      <div className="p-3 border-b border-primary/10">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-900 text-sm">{table.name}</span>
                          <span className={`text-[11px] font-bold ${countCls(table.assignedCount, table.capacity)}`}>
                            {table.assignedCount}/{table.capacity}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mt-1.5">
                          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: bc }} />
                        </div>
                      </div>
                      <div className="p-3">
                        {table.guests.length === 0 ? (
                          <p className="text-[11px] text-gray-400 italic text-center py-1">Drop guests here</p>
                        ) : (
                          <div className="space-y-1">
                            {table.guests.slice(0, 5).map(g => (
                              <div key={g.id} className="flex items-center gap-1.5 group">
                                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                                  {g.guestName.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-xs text-gray-700 truncate flex-1">{g.guestName}</span>
                                {g.paxCount > 1 && <span className="text-[9px] text-gray-400">+{g.paxCount - 1}</span>}
                                {!isReadOnly && !selectMode && (
                                  <button
                                    onClick={e => { e.stopPropagation(); handleUnassign(g.id); }}
                                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition"
                                  >
                                    <XIcon className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            ))}
                            {table.guests.length > 5 && (
                              <p className="text-[10px] text-gray-400 mt-1">+{table.guests.length - 5} more…</p>
                            )}
                          </div>
                        )}
                      </div>
                      {!isReadOnly && !selectMode && (
                        <div
                          className="flex gap-1.5 px-3 pb-3 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleEditTable(table.id)}
                            title="Edit"
                            className="flex-1 flex items-center justify-center py-1 rounded-md border border-primary/20 text-gray-500 hover:bg-primary/5 hover:text-primary transition"
                          >
                            <PencilIcon className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteTable(table.id)}
                            title="Delete"
                            className="flex-1 flex items-center justify-center py-1 rounded-md border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 transition"
                          >
                            <TrashIcon className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL — table detail (slides in on tile click) ─ */}
        {openTable && (
          <aside
            className="flex flex-col overflow-hidden bg-background border-l border-primary/10 shrink-0"
            style={{ width: 280, boxShadow: "-2px 0 8px rgba(0,0,0,0.05)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-primary/10 shrink-0">
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest leading-none mb-0.5">Selected</p>
                <p className="text-sm font-bold text-gray-800">{openTable.name}</p>
              </div>
              <button
                onClick={() => setOpenTableId(null)}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Capacity bar */}
            <div className="px-4 py-3 border-b border-primary/10 shrink-0">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-gray-400 font-medium">Seats filled</span>
                <span className={`font-bold ${countCls(openTable.assignedCount, openTable.capacity)}`}>
                  {openTable.assignedCount} / {openTable.capacity}
                  {openTable.assignedCount > openTable.capacity && " (over)"}
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min((openTable.assignedCount / openTable.capacity) * 100, 100)}%`,
                    background: barFill(openTable.assignedCount, openTable.capacity),
                  }}
                />
              </div>
            </div>

            {/* Guest list */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                Guests ({openTable.guests.length})
              </p>
              <div className="space-y-1.5">
                {openTable.guests.length === 0 ? (
                  <p className="text-xs text-gray-400 italic text-center py-6">
                    No guests yet.<br />Drag from the left panel.
                  </p>
                ) : (
                  openTable.guests.map(g => (
                    <div key={g.id} className="flex items-center gap-2 p-2 rounded-lg bg-accent/20 hover:bg-accent/40 transition group">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-button flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {g.guestName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{g.guestName}</p>
                        <div className="flex items-center gap-1">
                          {g.isVip  && <span className="text-[9px] bg-amber-100 text-amber-700 rounded-full px-1 font-semibold">VIP</span>}
                          {g.paxCount > 1 && <span className="text-[9px] text-gray-400">+{g.paxCount - 1} pax</span>}
                        </div>
                      </div>
                      {!isReadOnly && (
                        <button
                          onClick={() => handleUnassign(g.id)}
                          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition p-0.5 rounded"
                        >
                          <XIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Drop zone */}
              {!isReadOnly && (
                <div
                  className="mt-4 border-2 border-dashed border-primary/20 rounded-xl p-4 text-center text-xs text-gray-400 hover:border-primary hover:bg-primary/5 transition"
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData("guestId"); if (id) doAssign(id, openTable.id); }}
                >
                  Drop guest here
                </div>
              )}
            </div>

            {/* Footer actions */}
            {!isReadOnly && (
              <div className="flex gap-2 px-4 py-3 border-t border-primary/10 shrink-0">
                <button
                  onClick={() => handleEditTable(openTable.id)}
                  title="Edit"
                  className="flex-1 flex items-center justify-center py-1.5 rounded-lg border border-primary/20 hover:bg-primary/5 text-gray-600 transition"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDeleteTable(openTable.id)}
                  title="Delete"
                  className="flex items-center justify-center p-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            )}
          </aside>
        )}

      </div>

      {/* ── Modals ────────────────────────────────────────────── */}
      <QuickSetupModal isOpen={showQuickSetup} onClose={() => setShowQuickSetup(false)} />

      <TableFormModal
        isOpen={showCreateTable || !!editingTable}
        onClose={() => { setShowCreateTable(false); setEditingTable(null); }}
        initial={editingTable || undefined}
      />

      <DeleteConfirmationModal
        isOpen={!!deletingTable}
        isDeleting={deleteTable.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeletingTable(null)}
        title="Delete Table"
        description="Are you sure you want to delete this table? This action cannot be undone."
      >
        {deletingTable && (
          <div className="bg-background rounded-xl p-4 border border-primary/10">
            <p className="text-sm font-semibold text-gray-800">{deletingTable.name}</p>
          </div>
        )}
      </DeleteConfirmationModal>

      <DeleteConfirmationModal
        isOpen={showBulkDeleteConfirm}
        isDeleting={bulkDeleteTables.isPending}
        onConfirm={confirmBulkDelete}
        onCancel={() => setShowBulkDeleteConfirm(false)}
        title="Delete Selected Tables"
        description={`Are you sure you want to delete ${selectedTableIds.size} table${selectedTableIds.size > 1 ? "s" : ""}? Guests assigned to these tables will be unassigned.`}
      />
    </div>
  );
}
