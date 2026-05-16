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
import { useState, useMemo } from "react";
import { useEventContext } from "../../../context/EventContext";
import { useAuth } from "../../../api/hooks/useAuth";
import toast from "react-hot-toast";
import { NoEventsState } from "../../molecules/NoEventsState";
import { BottomSheet } from "../../molecules/BottomSheet";
import { ChevronDownIcon, CollectionIcon, UserGroupIcon, UserIcon, ChartBarIcon, ArrowsExpandIcon } from "@heroicons/react/solid";
import { saveAs } from "file-saver";
import { useIsMobile } from "../../../hooks/useIsMobile";

type UnassignedGuestLite = {
  id: string;
  guestName: string;
  paxCount: number;
};

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
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [mobilePickedGuest, setMobilePickedGuest] = useState<UnassignedGuestLite | null>(null);
  const isMobile = useIsMobile();

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

    // Call the assign API (reassigns if the guest was already on another table)
    assignGuest.mutate({ guestId, tableId }, {
      onError: () => toast.error("Failed to assign guest to table"),
    });
  };

  const handleUnassignGuest = (guestId: string) => {
    unassignGuest.mutate(guestId, {
      onError: () => toast.error("Failed to unassign guest from table"),
    });
  };

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
    <div className="flex flex-col h-full">
      {/* Page Title & Actions */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-primary">Table Arrangement</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Organize seating and arrange guests by table</p>
        </div>
        {!isReadOnly && (
          <div className="flex flex-wrap gap-2">
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
              <Button variant="secondary" onClick={toggleSelectMode}>
                Select
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

      {/* Stats Cards + Tip — collapsible */}
      <div className="mb-4">
        <button
          className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 mb-2 transition-colors select-none"
          onClick={() => setStatsExpanded(p => !p)}
        >
          <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${statsExpanded ? "" : "-rotate-90"}`} />
          {statsExpanded ? "Hide overview" : "Show overview"}
        </button>
        {statsExpanded && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
              <StatsCard label="Total Tables" value={stats.totalTables} variant="primary" size="sm" icon={<CollectionIcon className="w-4 h-4" />} />
              <StatsCard label="Seated Guests" value={stats.seatedGuests} variant="success" size="sm" icon={<UserGroupIcon className="w-4 h-4" />} />
              <StatsCard label="Unassigned" value={stats.unassigned} variant="warning" size="sm" icon={<UserIcon className="w-4 h-4" />} />
              <StatsCard label="Total Capacity" value={stats.totalCapacity} variant="secondary" size="sm" icon={<ChartBarIcon className="w-4 h-4" />} />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Tip — different copy on mobile (no drag-and-drop) */}
              <div className="flex-1 p-3 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-100 dark:border-indigo-800">
                <p className="text-sm text-indigo-700 dark:text-indigo-300">
                  <strong>Tip:</strong> {isMobile
                    ? "Tap the Unassigned button at the bottom-right to assign guests to tables."
                    : "Drag guests from the unassigned panel and drop them onto tables"}
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

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        {/* Unassigned Panel (1 column) — desktop only; mobile uses sticky FAB + BottomSheet */}
        <div className="hidden lg:block lg:col-span-1 lg:max-h-full">
          <div className="lg:sticky lg:top-0 bg-white dark:bg-accent rounded-xl shadow-lg p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Unassigned Guests ({unassignedGuests.length})
            </h3>
            <div className="space-y-2 max-h-96 lg:max-h-[calc(100vh-350px)] overflow-y-auto">
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
                    isDragging={draggedGuestId === guest.id}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Tables Grid (3 columns) */}
        <div className="lg:col-span-3 overflow-y-auto">
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
                    isDropTarget={!selectMode && !isReadOnly && !!draggedGuestId}
                    draggedGuest={(selectMode || isReadOnly) ? null : draggedGuest}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile: sticky FAB to surface unassigned guests */}
      {!isReadOnly && unassignedGuests.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setMobilePickedGuest(null);
            setMobileSheetOpen(true);
          }}
          className="lg:hidden fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 px-4 py-3 rounded-full shadow-lg bg-primary text-white font-medium text-sm hover:opacity-90 transition-opacity"
          aria-label={`Show ${unassignedGuests.length} unassigned guests`}
        >
          <UserIcon className="w-4 h-4" />
          Unassigned
          <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-white/25 text-xs font-bold">
            {unassignedGuests.length}
          </span>
        </button>
      )}

      {/* Mobile: two-step assignment BottomSheet (pick guest → pick table) */}
      <BottomSheet
        isOpen={mobileSheetOpen}
        title={
          mobilePickedGuest
            ? `Assign ${mobilePickedGuest.guestName} to…`
            : `Unassigned Guests (${unassignedGuests.length})`
        }
        onClose={() => {
          setMobileSheetOpen(false);
          setMobilePickedGuest(null);
        }}
      >
        {mobilePickedGuest ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setMobilePickedGuest(null)}
              className="text-sm text-primary font-medium hover:underline"
            >
              ← Pick a different guest
            </button>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {tablesWithGuests.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                  No tables available. Create tables first.
                </p>
              ) : (
                tablesWithGuests.map((table) => {
                  const guestPax = mobilePickedGuest.paxCount;
                  const willExceed = table.assignedCount + guestPax > table.capacity;
                  const isOver = table.assignedCount > table.capacity;
                  return (
                    <button
                      key={table.id}
                      onClick={() => {
                        const guestId = mobilePickedGuest.id;
                        if (willExceed) {
                          toast(`⚠️ ${table.name} is over capacity (${table.assignedCount + guestPax}/${table.capacity}). Guest assigned anyway.`, {
                            duration: 4000,
                            style: { background: "#fef3c7", color: "#92400e" },
                          });
                        }
                        assignGuest.mutate(
                          { guestId, tableId: table.id },
                          {
                            onSuccess: () => {
                              if (!willExceed) {
                                toast.success(`${mobilePickedGuest.guestName} assigned to ${table.name}`);
                              }
                              setMobilePickedGuest(null);
                              setMobileSheetOpen(false);
                            },
                            onError: () => toast.error("Failed to assign guest to table"),
                          }
                        );
                      }}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                        isOver || willExceed
                          ? "border-red-400 dark:border-red-600 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                          : "border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:bg-primary/5"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-gray-900 dark:text-white">{table.name}</p>
                        {(isOver || willExceed) && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
                            {isOver ? "Over capacity" : "Will exceed"}
                          </span>
                        )}
                      </div>
                      <p className={`text-sm mt-0.5 ${isOver || willExceed ? "text-red-600 dark:text-red-400 font-medium" : "text-gray-600 dark:text-gray-400"}`}>
                        {table.assignedCount} / {table.capacity} seats filled
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {unassignedGuests.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-8">
                All guests have been assigned!
              </p>
            ) : (
              unassignedGuests.map((guest) => {
                const pax = guest.pax || guest.noOfPax || 1;
                return (
                  <button
                    key={guest.id}
                    onClick={() =>
                      setMobilePickedGuest({
                        id: guest.id,
                        guestName: guest.guestName || guest.name,
                        paxCount: pax,
                      })
                    }
                    className="w-full text-left p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:bg-primary/5 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {guest.guestName || guest.name}
                      </p>
                      {pax > 1 && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          {pax} pax
                        </span>
                      )}
                    </div>
                    {guest.phoneNo && (
                      <p className="text-sm mt-0.5 text-gray-600 dark:text-gray-400">
                        {guest.phoneNo.startsWith("+") ? guest.phoneNo : "+" + guest.phoneNo}
                      </p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </BottomSheet>

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
