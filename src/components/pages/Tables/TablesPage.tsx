// src/components/pages/Tables/TablesPage.tsx
import { PageLoader } from "../../atoms/PageLoader";
import { ErrorState } from "../../atoms/ErrorState";
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
import { Button } from "../../atoms/Button";
import { Dropdown, DropdownItem } from "../../atoms/Dropdown";
import { StatsCard } from "../../atoms/StatsCard";
import { GuestCard } from "../../molecules/GuestCard";
import { TableCard } from "../../molecules/TableCard";
import { QuickSetupModal } from "../../molecules/QuickSetupModal";
import { TableFormModal } from "../../molecules/TableFormModal";
import { DeleteConfirmationModal } from "../../molecules/DeleteConfirmationModal";
import { useState, useMemo, useEffect } from "react";
import { useEventContext } from "../../../context/EventContext";
import { useAuth } from "../../../api/hooks/useAuth";
import toast from "react-hot-toast";
import { NoEventsState } from "../../molecules/NoEventsState";
import { ChevronDownIcon, CollectionIcon, UserGroupIcon, UserIcon, ChartBarIcon, ArrowsExpandIcon, TrashIcon, XIcon, SparklesIcon } from "@heroicons/react/solid";
import { saveAs } from "file-saver";

export default function TablesPage() {
  // ─── All hooks first (React Rules of Hooks) ─────────────────────────────────────────
  const { userRole } = useAuth();
  const isReadOnly = userRole === 6;
  const { eventId, eventsLoading } = useEventContext()!;
  const { data: tables = [], isLoading: tablesLoading, isError: tablesError } = useTablesApi(eventId!);
  const { data: guests = [], isLoading: guestsLoading, isError: guestsError } = useGuestsApi(eventId!);
  const deleteTable = useDeleteTable(eventId);
  const bulkDeleteTables = useBulkDeleteTables(eventId);
  const assignGuest = useAssignGuestToTable(eventId || "");
  const unassignGuest = useUnassignGuestFromTable(eventId || "");
  const autoAssign = useAutoAssignGuests(eventId || "");

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "hasEmpty" | "full">("all");
  const [draggedGuestId, setDraggedGuestId] = useState<string | null>(null);
  const [draggedGuest, setDraggedGuest] = useState<{ id: string; paxCount: number; sourceTableId: string | null } | null>(null);
  const [showQuickSetup, setShowQuickSetup] = useState(false);
  const [showCreateTable, setShowCreateTable] = useState(false);
  const [editingTable, setEditingTable] = useState<{ id: string; name: string; capacity: number } | null>(null);
  const [deletingTable, setDeletingTable] = useState<{ id: string; name: string } | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedTableIds, setSelectedTableIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(true);
  // Tap-to-assign pickup state — works alongside HTML5 drag-and-drop.
  // sourceTableId === null means the guest was picked from the Unassigned panel.
  const [picked, setPicked] = useState<{ guestId: string; paxCount: number; sourceTableId: string | null } | null>(null);
  // Mobile tab switcher (only visible < lg). Defaults to "tables" — the main work surface.
  const [mobileTab, setMobileTab] = useState<"unassigned" | "tables">("tables");

  // Calculate statistics (must be before early returns - React rules of hooks)
  const stats = useMemo(() => {
    const seatedGuests = guests
      .filter(g => g.tableId)
      .reduce((sum, g) => sum + (g.pax || g.noOfPax || 1), 0);
    const unassigned = guests
      .filter(g => !g.tableId)
      .reduce((sum, g) => sum + (g.pax || g.noOfPax || 1), 0);
    const totalCapacity = tables.reduce((sum, t) => sum + t.capacity, 0);
    
    return {
      totalTables: tables.length,
      seatedGuests,
      unassigned,
      totalCapacity,
    };
  }, [tables, guests]);

  // Get unassigned guests
  const unassignedGuests = useMemo(() => {
    return guests.filter(g => !g.tableId);
  }, [guests]);

  const handleExportCsv = () => {
    if (!eventId) return;
    const tableMap = new Map(tables.map(t => [t.id, t.name]));
    const escape = (v: unknown) => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };

    let csv = "Table Name,Capacity,Seats Filled,Seats Available\n";
    tables.forEach(t => {
      const filled = guests.filter(g => g.tableId === t.id).reduce((sum, g) => sum + (g.pax || g.noOfPax || 1), 0);
      csv += [escape(t.name), t.capacity, filled, t.capacity - filled].join(",") + "\n";
    });

    csv += "\nGuest Name,Table,PAX,Phone,Notes,Status\n";
    const seated = guests.filter(g => g.tableId);
    const unassigned = guests.filter(g => !g.tableId);
    [...seated, ...unassigned].forEach(g => {
      const tableName = g.tableId ? (tableMap.get(g.tableId) ?? "Unknown") : "";
      csv += [escape(g.name), escape(tableName), g.pax || g.noOfPax || 1, escape(g.phoneNo || ""), escape(g.notes || ""), g.tableId ? "Seated" : "Unassigned"].join(",") + "\n";
    });

    saveAs(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8;" }), `table-seating-${eventId}.csv`);
  };

  const handleExportXlsx = async () => {
    if (!eventId) return;
    const XLSX = await import("xlsx");
    const tableMap = new Map(tables.map(t => [t.id, t.name]));

    const summaryRows = tables.map(t => {
      const filled = guests.filter(g => g.tableId === t.id).reduce((sum, g) => sum + (g.pax || g.noOfPax || 1), 0);
      return { "Table Name": t.name, "Capacity": t.capacity, "Seats Filled": filled, "Seats Available": t.capacity - filled };
    });

    const seated = guests.filter(g => g.tableId);
    const unassigned = guests.filter(g => !g.tableId);
    const guestRows = [...seated, ...unassigned].map(g => ({
      "Guest Name": g.name,
      "Table": g.tableId ? (tableMap.get(g.tableId) ?? "Unknown") : "",
      "PAX": g.pax || g.noOfPax || 1,
      "Phone": g.phoneNo || "",
      "Notes": g.notes || "",
      "Status": g.tableId ? "Seated" : "Unassigned",
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Table Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(guestRows), "Guest Seating");
    saveAs(new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })]), `table-seating-${eventId}.xlsx`);
  };

  // Build tables with guest details
  const tablesWithGuests = useMemo(() => {
    return tables.map(table => {
      const tableGuests = guests.filter(g => g.tableId === table.id);
      return {
        ...table,
        guests: tableGuests.map(g => ({
          id: g.id,
          guestName: g.guestName || g.name,
          paxCount: g.pax || g.noOfPax || 1,
        })),
        assignedCount: tableGuests.reduce((sum, g) => sum + (g.pax || g.noOfPax || 1), 0),
      };
    });
  }, [tables, guests]);

  // Filter tables
  const filteredTables = useMemo(() => {
    return tablesWithGuests.filter(t => {
      // Search filter
      if (searchTerm && !t.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        const hasMatchingGuest = t.guests.some(g => 
          g.guestName.toLowerCase().includes(searchTerm.toLowerCase())
        );
        if (!hasMatchingGuest) return false;
      }
      
      // Type filter
      if (filterType === "hasEmpty" && t.assignedCount >= t.capacity) {
        return false;
      }
      if (filterType === "full" && t.assignedCount < t.capacity) {
        return false;
      }
      
      return true;
    });
  }, [tablesWithGuests, searchTerm, filterType]);

  // ESC cancels pickup. Declared up here so it stays above the early returns
  // (Rules of Hooks — hooks must run in the same order every render).
  useEffect(() => {
    if (!picked) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPicked(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picked]);

  // Mobile: when a guest is picked from the Unassigned panel, auto-switch to
  // the Tables tab so the user can see where to drop. No-op on desktop.
  useEffect(() => {
    if (picked && picked.sourceTableId === null) {
      setMobileTab("tables");
    }
  }, [picked]);

  // ─── Early returns AFTER all hooks ─────────────────────────────────────────

  // Show "no events" state if no events exist (check BEFORE loading state)
  if (eventsLoading) return <PageLoader message="Loading..." />;
  if (!eventId) return <NoEventsState title="No Events for Table Management" message="Create your first event to start organizing seating arrangements and table assignments." />;

  if (tablesLoading || guestsLoading) return <PageLoader message="Loading tables..." />;
  if (tablesError || guestsError) return <ErrorState message="Failed to load data." onRetry={() => window.location.reload()} />;

  // Drag and drop handlers
  const handleDragStart = (guestId: string, sourceTableId: string | null = null) => {
    const guest = guests.find(g => g.id === guestId);
    if (guest) {
      setDraggedGuestId(guestId);
      setDraggedGuest({
        id: guestId,
        paxCount: guest.pax || guest.noOfPax || 1,
        sourceTableId: sourceTableId ?? guest.tableId ?? null,
      });
    }
  };

  const handleDragEnd = () => {
    setDraggedGuestId(null);
    setDraggedGuest(null);
  };

  const handleDrop = (guestId: string, tableId: string) => {
    // Find the guest and table
    const guest = guests.find(g => g.id === guestId);
    const table = tablesWithGuests.find(t => t.id === tableId);
    if (!guest || !table) return;

    // No-op if guest is already on this table
    if (guest.tableId === tableId) return;

    // Validate: Check if adding this guest would exceed table capacity
    const guestPaxCount = guest.pax || guest.noOfPax || 1;
    const availableSeats = table.capacity - table.assignedCount;

    if (guestPaxCount > availableSeats) {
      toast(`⚠️ ${table.name} is over capacity (${table.assignedCount + guestPaxCount}/${table.capacity}). Guest assigned anyway.`, {
        duration: 4000,
        style: { background: "#fef3c7", color: "#92400e" },
      });
    }

    // Mobile UX: if the guest came from the Unassigned panel, flip back to it
    // after assignment so the user can keep picking the next guest without
    // tapping the tab manually. No-op on desktop (tabs are hidden by CSS).
    const wasUnassigned = !guest.tableId;

    // Call the assign API (reassigns if the guest was already on another table)
    assignGuest.mutate({ guestId, tableId }, {
      onError: () => toast.error("Failed to assign guest to table"),
    });

    if (wasUnassigned) setMobileTab("unassigned");
  };

  const handleUnassignGuest = (guestId: string) => {
    unassignGuest.mutate(guestId, {
      onError: () => toast.error("Failed to unassign guest from table"),
    });
  };

  // ── Tap-to-assign pickup flow (works alongside drag-and-drop) ─────────────
  const handlePickGuest = (guestId: string, sourceTableId: string | null) => {
    const g = guests.find(x => x.id === guestId);
    if (!g) return;
    // Tapping the already-picked guest cancels the pickup.
    if (picked?.guestId === guestId) {
      setPicked(null);
      return;
    }
    setPicked({
      guestId,
      paxCount: g.pax || g.noOfPax || 1,
      sourceTableId: sourceTableId ?? g.tableId ?? null,
    });
  };

  const handleTableClick = (tableId: string) => {
    if (!picked) return;
    // Tapping the source table cancels the pickup (rather than no-op assigning).
    if (picked.sourceTableId === tableId) {
      setPicked(null);
      return;
    }
    handleDrop(picked.guestId, tableId);
    setPicked(null);
  };

  const handleUnassignPicked = () => {
    if (!picked) return;
    // No-op if the picked guest came from Unassigned panel.
    if (picked.sourceTableId === null) {
      setPicked(null);
      return;
    }
    handleUnassignGuest(picked.guestId);
    setPicked(null);
  };

  // Convenience lookups for the banner:
  const pickedGuest = picked ? guests.find(g => g.id === picked.guestId) : null;
  const pickedSourceTableName = picked?.sourceTableId
    ? tablesWithGuests.find(t => t.id === picked.sourceTableId)?.name
    : null;

  const handleEditTable = (tableId: string) => {
    const table = tablesWithGuests.find(t => t.id === tableId);
    if (table) {
      setEditingTable({
        id: table.id,
        name: table.name,
        capacity: table.capacity,
      });
    }
  };

  const handleDeleteTable = (tableId: string) => {
    const table = tablesWithGuests.find(t => t.id === tableId);
    if (table) {
      setDeletingTable({
        id: table.id,
        name: table.name,
      });
    }
  };

  const confirmDelete = () => {
    if (deletingTable) {
      deleteTable.mutate(deletingTable.id, {
        onError: () => toast.error("Failed to delete table"),
      });
      setDeletingTable(null);
    }
  };

  const toggleSelectMode = () => {
    setSelectMode(prev => !prev);
    setSelectedTableIds(new Set());
  };

  const toggleTableSelection = (tableId: string) => {
    setSelectedTableIds(prev => {
      const next = new Set(prev);
      if (next.has(tableId)) next.delete(tableId);
      else next.add(tableId);
      return next;
    });
  };

  const confirmBulkDelete = () => {
    bulkDeleteTables.mutate({ tableIds: Array.from(selectedTableIds) }, {
      onSuccess: () => {
        setShowBulkDeleteConfirm(false);
        setSelectMode(false);
        setSelectedTableIds(new Set());
        toast.success(`${selectedTableIds.size} tables deleted.`);
      },
      onError: () => toast.error("Failed to delete tables"),
    });
  };

  return (
    <div className="flex flex-col lg:h-full">
      {/* ── Tap-to-assign pickup banner ─────────────────────────────────────
          Floats above the page when a guest is "picked". Shows source +
          contextual [Unassign] for guests that came from a table. */}
      {picked && (
        <div
          role="status"
          aria-live="polite"
          className="fixed z-40 left-1/2 -translate-x-1/2 top-4 md:top-6 max-w-[calc(100vw-2rem)] flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-full bg-primary text-white shadow-xl border border-primary/40"
        >
          <SparklesIcon className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs md:text-sm font-medium truncate">
            {picked.sourceTableId
              ? <>Moving <strong>{pickedGuest?.guestName || pickedGuest?.name}</strong>{pickedSourceTableName ? <> from <em className="not-italic opacity-80">{pickedSourceTableName}</em></> : ""} — tap a table</>
              : <>Assigning <strong>{pickedGuest?.guestName || pickedGuest?.name}</strong> — tap a table</>
            }
          </span>
          {picked.sourceTableId && (
            <button
              onClick={handleUnassignPicked}
              className="ml-1 text-xs font-semibold bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-full transition whitespace-nowrap"
            >
              Unassign
            </button>
          )}
          <button
            onClick={() => setPicked(null)}
            className="ml-1 p-1 rounded-full hover:bg-white/20 transition"
            aria-label="Cancel pickup"
            title="Cancel (Esc)"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Page Title & Actions */}
      <div data-tour="tables-header" className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-display font-semibold text-primary">Table Arrangement</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Organize seating and arrange guests by table</p>
        </div>
        {!isReadOnly && (
          <div data-tour="tables-actions" className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={autoAssign.isPending}
              onClick={() => {
                autoAssign.mutate(undefined, {
                  onSuccess: (res) => {
                    const d = res?.data;
                    if (d) {
                      toast.success(`Auto-assign complete. Assigned: ${d.assignedCount}, Skipped: ${d.skippedCount}.`);
                    } else {
                      toast.success("Auto-assign complete.");
                    }
                  },
                  onError: () => toast.error("Auto-assign failed."),
                });
              }}
            >
              {autoAssign.isPending ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Assigning...
                </span>
              ) : "Auto-Assign"}
            </Button>
            {selectMode ? (
              <>
                {selectedTableIds.size > 0 && (
                  <Button variant="primary" onClick={() => setShowBulkDeleteConfirm(true)}>
                    Delete selected ({selectedTableIds.size})
                  </Button>
                )}
                <Button variant="secondary" onClick={toggleSelectMode}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="secondary" onClick={toggleSelectMode} className="flex items-center gap-1.5">
                <TrashIcon className="w-4 h-4" />
                Bulk Delete
              </Button>
            )}
            <Dropdown trigger={<Button variant="secondary">Export ▾</Button>}>
              <DropdownItem onClick={handleExportXlsx}>Export as XLSX</DropdownItem>
              <DropdownItem onClick={handleExportCsv}>Export as CSV</DropdownItem>
            </Dropdown>
            <Dropdown
              trigger={
                <Button className="flex items-center gap-1.5">
                  + New Table <ChevronDownIcon className="w-4 h-4" />
                </Button>
              }
            >
              <DropdownItem onClick={() => setShowCreateTable(true)}>
                <div>
                  <div className="font-medium">Create Single Table</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Create one table at a time
                  </div>
                </div>
              </DropdownItem>
              <DropdownItem onClick={() => setShowQuickSetup(true)}>
                <div>
                  <div className="font-medium">
                    Bulk Create{" "}
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                      Recommended
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Create by category or custom prefix
                  </div>
                </div>
              </DropdownItem>
            </Dropdown>
          </div>
        )}
      </div>

      {/* Stats overview — collapsible */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <button
            className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors select-none"
            onClick={() => setStatsExpanded(p => !p)}
          >
            <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${statsExpanded ? "" : "-rotate-90"}`} />
            {statsExpanded ? "Hide overview" : "Show overview"}
          </button>
          <button
            data-tour="tables-fullscreen"
            onClick={() => window.open("/app/tables/fullscreen", "_blank")}
            className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50/70 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors text-[11px] font-medium text-indigo-700 dark:text-indigo-300"
            title="Open in fullscreen mode — better for 100+ guests"
          >
            <ArrowsExpandIcon className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
            <span>Fullscreen mode</span>
            <span className="text-indigo-400 dark:text-indigo-500 group-hover:translate-x-0.5 transition-transform" aria-hidden>↗</span>
          </button>
        </div>
        {statsExpanded && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
              <StatsCard label="Total Tables" value={stats.totalTables} variant="primary" size="sm" icon={<CollectionIcon className="w-4 h-4" />} />
              <StatsCard label="Seated Guests" value={stats.seatedGuests} variant="success" size="sm" icon={<UserGroupIcon className="w-4 h-4" />} />
              <StatsCard label="Unassigned" value={stats.unassigned} variant="warning" size="sm" icon={<UserIcon className="w-4 h-4" />} />
              <StatsCard label="Total Capacity" value={stats.totalCapacity} variant="secondary" size="sm" icon={<ChartBarIcon className="w-4 h-4" />} />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Drag-and-drop tip */}
              <div className="flex-1 p-3 rounded-xl bg-primary/5 border border-primary/20">
                <p className="text-sm text-primary">
                  <strong>Tip:</strong> Drag guests from the unassigned panel and drop them onto tables
                </p>
              </div>

              {/* Full-screen mode CTA */}
              <button
                onClick={() => window.open("/app/tables/fullscreen", "_blank")}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-accent hover:border-primary/40 dark:hover:border-primary/40 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group text-left"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center group-hover:bg-primary/10 dark:group-hover:bg-primary/20 transition-colors">
                  <ArrowsExpandIcon className="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-primary transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200 leading-tight">
                    Need a bigger screen?
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 leading-snug mt-0.5">
                    Full-screen mode — guest list, table grid &amp; detail panel. Perfect for 100+ guests.
                  </p>
                </div>
                <ArrowsExpandIcon className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-primary flex-shrink-0 transition-colors" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center mb-4 gap-4">
        <select
          className="w-full md:w-1/4 border border-primary/20 dark:border-primary/30 rounded-lg p-2 bg-white dark:bg-accent text-gray-900 dark:text-white"
          value={filterType} 
          onChange={(e) => setFilterType(e.target.value as any)}
        >
          <option value="all">All Tables</option>
          <option value="hasEmpty">Has Empty Seats</option>
          <option value="full">Full Tables</option>
        </select>
        <input 
          placeholder="Search guests or tables..."
          className="w-full md:flex-1 border border-primary/20 dark:border-primary/30 rounded-lg p-2 bg-white dark:bg-accent text-gray-900 dark:text-white"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Mobile tab switcher — picks which panel is visible on < lg.
          Auto-switches to "tables" when a guest is picked from the Unassigned panel. */}
      <div className="lg:hidden flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mb-4">
        {([
          { id: "unassigned" as const, label: "Unassigned", count: unassignedGuests.length },
          { id: "tables" as const, label: "Tables", count: filteredTables.length },
        ]).map(({ id, label, count }) => (
          <button
            key={id}
            onClick={() => setMobileTab(id)}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${
              mobileTab === id
                ? "bg-white dark:bg-accent text-primary shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
            aria-pressed={mobileTab === id}
          >
            {label} <span className={`ml-1 text-xs font-bold ${mobileTab === id ? "text-primary/70" : "text-gray-400"}`}>({count})</span>
          </button>
        ))}
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        {/* Unassigned Panel (1 column) */}
        <div data-tour="tables-unassigned" className={`${mobileTab === "unassigned" ? "block" : "hidden"} lg:block lg:col-span-1 lg:max-h-full`}>
          <div
            onDragOver={(e) => {
              if (!draggedGuest || !draggedGuest.sourceTableId) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const guestId = e.dataTransfer.getData("guestId");
              const g = guests.find(x => x.id === guestId);
              if (guestId && g?.tableId) handleUnassignGuest(guestId);
            }}
            onClick={picked && picked.sourceTableId ? handleUnassignPicked : undefined}
            role={picked && picked.sourceTableId ? "button" : undefined}
            aria-label={picked && picked.sourceTableId ? `Drop here to unassign ${pickedGuest?.guestName || pickedGuest?.name}` : undefined}
            className={`lg:sticky lg:top-0 bg-white dark:bg-accent rounded-xl shadow-lg p-4 border transition-all
              ${picked && picked.sourceTableId
                ? "border-rose-400 ring-2 ring-rose-300 ring-offset-1 cursor-pointer bg-rose-50/40 dark:bg-rose-900/10"
                : draggedGuest && draggedGuest.sourceTableId
                ? "border-rose-300 ring-2 ring-rose-200"
                : "border-gray-200 dark:border-gray-700"}
            `}
          >
            {(picked && picked.sourceTableId) || (draggedGuest && draggedGuest.sourceTableId) ? (
              <p className="text-xs font-semibold text-rose-700 dark:text-rose-300 mb-2 flex items-center gap-1.5">
                <XIcon className="w-3.5 h-3.5" />
                Drop here to unassign
              </p>
            ) : null}
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Unassigned Guests ({unassignedGuests.length})
            </h3>
            <div className="space-y-2 lg:max-h-[calc(100vh-350px)] lg:overflow-y-auto">
              {unassignedGuests.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-8">
                  All guests have been assigned!
                </p>
              ) : (
                unassignedGuests.map(guest => (
                  <GuestCard
                    key={guest.id}
                    guest={{
                      id: guest.id,
                      guestName: guest.guestName || guest.name,
                      phoneNo: guest.phoneNo,
                      paxCount: guest.pax || guest.noOfPax || 1,
                      // These fields can be parsed from remarks or added to API later
                      isVip: (guest.remarks || guest.notes)?.toLowerCase().includes('vip'),
                      dietaryRestrictions: (guest.remarks || guest.notes)?.toLowerCase().includes('vegetarian') ? ['Vegetarian'] : undefined,
                    }}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onPick={isReadOnly ? undefined : (id) => handlePickGuest(id, null)}
                    isDragging={draggedGuestId === guest.id}
                    isPicked={picked?.guestId === guest.id}
                  />
                ))
              )}
            </div>
          </div>
        </div>
        
        {/* Tables Grid (3 columns) */}
        <div data-tour="tables-grid" className={`${mobileTab === "tables" ? "block" : "hidden"} lg:block lg:col-span-3 lg:overflow-y-auto`}>
          {filteredTables.length === 0 ? (
            <div className="p-6 rounded-lg border-2 border-dashed border-primary/25 text-center space-y-2 bg-white/70 dark:bg-accent/70">
              <p className="text-lg font-semibold">No tables found.</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {searchTerm 
                  ? "No tables match your search. Try a different search term." 
                  : "Create your first table to start organizing your seating arrangements."}
              </p>
              <Button onClick={() => setShowCreateTable(true)}>+ Create First Table</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 pb-6">
              {filteredTables.map(table => (
                <div key={table.id} className="relative">
                  {selectMode && (
                    <div className="absolute top-2 right-2 z-10">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-primary cursor-pointer"
                        checked={selectedTableIds.has(table.id)}
                        onChange={() => toggleTableSelection(table.id)}
                      />
                    </div>
                  )}
                  <TableCard
                    table={table}
                    onDrop={(selectMode || isReadOnly) ? undefined : handleDrop}
                    onEdit={(selectMode || isReadOnly) ? undefined : handleEditTable}
                    onDelete={(selectMode || isReadOnly) ? undefined : handleDeleteTable}
                    onUnassignGuest={(selectMode || isReadOnly) ? undefined : handleUnassignGuest}
                    onGuestDragStart={(selectMode || isReadOnly) ? undefined : handleDragStart}
                    onGuestDragEnd={(selectMode || isReadOnly) ? undefined : handleDragEnd}
                    onGuestPick={(selectMode || isReadOnly) ? undefined : handlePickGuest}
                    onTableClick={(selectMode || isReadOnly) ? undefined : handleTableClick}
                    isDropTarget={!selectMode && !isReadOnly && !!draggedGuestId}
                    draggedGuest={(selectMode || isReadOnly) ? null : draggedGuest}
                    pickedGuest={(selectMode || isReadOnly) || !picked ? null : { id: picked.guestId, paxCount: picked.paxCount, sourceTableId: picked.sourceTableId }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <QuickSetupModal
        isOpen={showQuickSetup}
        onClose={() => setShowQuickSetup(false)}
      />

      {/* Create/Edit Table Modal */}
      <TableFormModal
        isOpen={showCreateTable || !!editingTable}
        onClose={() => {
          setShowCreateTable(false);
          setEditingTable(null);
        }}
        initial={editingTable || undefined}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={!!deletingTable}
        isDeleting={deleteTable.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeletingTable(null)}
        title="Delete Table"
        description="Are you sure you want to delete this table? This action cannot be undone."
      >
        {deletingTable && (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800 dark:text-white mb-1">
                  {deletingTable.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Table ID: {deletingTable.id}
                </p>
              </div>
            </div>
          </div>
        )}
      </DeleteConfirmationModal>

      {/* Bulk Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showBulkDeleteConfirm}
        isDeleting={bulkDeleteTables.isPending}
        onConfirm={confirmBulkDelete}
        onCancel={() => setShowBulkDeleteConfirm(false)}
        title="Delete Selected Tables"
        description={`Are you sure you want to delete ${selectedTableIds.size} table${selectedTableIds.size > 1 ? "s" : ""}? Guests assigned to these tables will be unassigned. This action cannot be undone.`}
      />
    </div>
  );
}
