import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { useEventContext } from "../../../context/EventContext";
import { useAuth } from "../../../api/hooks/useAuth";
import { useTablesApi, useDeleteTable } from "../../../api/hooks/useTablesApi";
import {
  useGuestsApi,
  useAssignGuestToTable,
  useUnassignGuestFromTable,
  useAutoAssignGuests,
} from "../../../api/hooks/useGuestsApi";
import { useGetFloorPlan, useSaveFloorPlan } from "../../../api/hooks/useFloorPlanApi";
import { useFloorPlanState } from "./useFloorPlanState";
import type { FloorItem, FloorItemType } from "./useFloorPlanState";
import { FloorCanvasV3 } from "./FloorPlanV3/FloorCanvasV3";
import { FloorGuestPanelV3 } from "./FloorPlanV3/FloorGuestPanelV3";
import { Spinner } from "../../atoms/Spinner";
import { Button } from "../../atoms/Button";
import { StatsCard } from "../../atoms/StatsCard";
import { TableFormModal } from "../../molecules/TableFormModal";
import { DeleteConfirmationModal } from "../../molecules/DeleteConfirmationModal";
import { NoEventsState } from "../../molecules/NoEventsState";
import { PageLoader } from "../../atoms/PageLoader";
import { CollectionIcon, UserGroupIcon, UserIcon } from "@heroicons/react/solid";

let idCounter = 0;
function uid() {
  return `fp-${Date.now()}-${++idCounter}`;
}

type ToolMode = "select" | "round" | "rect" | "square";

export default function FloorPlanPage() {
  const { userRole } = useAuth();
  const isReadOnly = userRole === 6;
  const { eventId, eventsLoading } = useEventContext();
  const { data: tables = [], isLoading: tablesLoading } = useTablesApi(eventId ?? "");
  const { data: guests = [], isLoading: guestsLoading } = useGuestsApi(eventId ?? "");
  const { data: apiFloorItems = [], isLoading: floorPlanLoading, isSuccess: floorPlanLoaded } = useGetFloorPlan(eventId ?? "");
  const saveFloorPlan = useSaveFloorPlan(eventId ?? "");
  const assignGuest = useAssignGuestToTable(eventId ?? "");
  const unassignGuest = useUnassignGuestFromTable(eventId ?? "");
  const autoAssign = useAutoAssignGuests(eventId ?? "");
  const deleteTable = useDeleteTable(eventId ?? "");

  const {
    floorItems,
    addItem,
    updateItem,
    removeItem,
    autoArrange,
    syncTables,
    changeTableShape,
    standardizeTables,
  } = useFloorPlanState(eventId ?? "", apiFloorItems, floorPlanLoaded);

  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [showTableModal, setShowTableModal] = useState(false);
  const [editTableId, setEditTableId] = useState<string | null>(null);
  const [showGuestPanel, setShowGuestPanel] = useState(false);
  const [draggedGuest, setDraggedGuest] = useState<{ id: string; pax: number } | null>(null);

  const [seatPopover, setSeatPopover] = useState<{
    tableId: string;
    seatIndex: number;
    anchorX: number;
    anchorY: number;
  } | null>(null);

  const [occupiedMenu, setOccupiedMenu] = useState<{
    tableId: string;
    guestId: string;
    guestName: string;
    guestPax: number;
    guestFlag?: string;
    anchorX: number;
    anchorY: number;
  } | null>(null);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [standardizeOpen, setStandardizeOpen] = useState(false);
  const [stdShape, setStdShape] = useState<"round" | "rect" | "square">("round");
  const [stdSizeMode, setStdSizeMode] = useState<"byCapacity" | "uniform">("byCapacity");
  const standardizeBtnRef = useRef<HTMLButtonElement | null>(null);
  const [standardizeAnchor, setStandardizeAnchor] = useState<{ top: number; left: number } | null>(null);

  const openStandardize = useCallback(() => {
    const r = standardizeBtnRef.current?.getBoundingClientRect();
    if (r) {
      setStandardizeAnchor({ top: r.bottom + 6, left: r.left });
    }
    setStandardizeOpen(true);
  }, []);

  const snapSize = 40;

  const pendingPlacement = React.useRef<{ x: number; y: number; shape: string } | null>(null);
  const pendingShape = React.useRef<string | null>(null);

  // Sync API tables into floor items — wait for floor plan to settle first so the
  // hook's init (setFloorItems(apiFloorItems)) doesn't overwrite what we just synced.
  useEffect(() => {
    if (!floorPlanLoading && tables.length > 0) {
      const shape = pendingShape.current || "round";
      syncTables(tables.map((t) => ({ id: t.id, capacity: t.capacity || 8 })), shape);
      pendingShape.current = null;
    }
  }, [tables, syncTables, floorPlanLoading]);

  const handlePanChange = useCallback((x: number, y: number) => {
    setPanX(x);
    setPanY(y);
  }, []);

  const handleMoveItem = useCallback(
    (id: string, x: number, y: number) => {
      updateItem(id, { x, y });
    },
    [updateItem]
  );

  const handleResizeItem = useCallback(
    (id: string, w: number, h: number) => {
      updateItem(id, { width: w, height: h });
    },
    [updateItem]
  );

  const handleSelect = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedId) return;
    const item = floorItems.find((i) => i.id === selectedId);
    if (!item) return;
    if (item.type === "table") {
      setPendingDeleteId(selectedId);
      return;
    }
    removeItem(selectedId);
    setSelectedId(null);
    toast.success("Element removed");
  }, [selectedId, floorItems, removeItem]);

  const confirmDeleteTable = useCallback(() => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    deleteTable.mutate(id, {
      onSuccess: () => {
        removeItem(id);
        setSelectedId(null);
        setPendingDeleteId(null);
        toast.success("Table deleted");
      },
      onError: () => {
        toast.error("Failed to delete table");
        setPendingDeleteId(null);
      },
    });
  }, [pendingDeleteId, deleteTable, removeItem]);

  const handleDoubleClickTable = useCallback((id: string) => {
    setEditTableId(id);
    setShowTableModal(true);
  }, []);

  const handleShapeTool = useCallback(
    (shape: ToolMode) => {
      if (shape === "select") {
        setToolMode("select");
        return;
      }
      if (selectedId) {
        const item = floorItems.find((i) => i.id === selectedId);
        if (item?.type === "table") {
          changeTableShape(selectedId, shape);
          toast.success(`Table shape changed to ${shape}`);
          return;
        }
      }
      setToolMode(shape);
      toast(`Click on canvas to place ${shape} table`, { icon: "📍" });
    },
    [selectedId, floorItems, changeTableShape]
  );

  const handleSeatClick = useCallback(
    (tableId: string, seatIndex: number, guestId: string | null, anchorX: number, anchorY: number) => {
      if (guestId) {
        const g = guests.find((x) => x.id === guestId);
        if (!g) return;
        setOccupiedMenu({
          tableId,
          guestId,
          guestName: g.name,
          guestPax: g.pax ?? 1,
          guestFlag: g.flag,
          anchorX,
          anchorY,
        });
      } else {
        setSeatPopover({ tableId, seatIndex, anchorX, anchorY });
      }
    },
    [guests]
  );

  const unassignWithUndo = useCallback(
    (guestId: string, previousTableId: string, guestName: string) => {
      unassignGuest.mutate(guestId, {
        onSuccess: () => {
          toast(
            (t) => (
              <div className="flex items-center gap-3">
                <span className="text-sm">Unassigned {guestName}</span>
                <button
                  className="text-xs font-semibold text-primary hover:text-button underline"
                  onClick={() => {
                    assignGuest.mutate(
                      { guestId, tableId: previousTableId },
                      {
                        onSuccess: () => toast.success("Undone"),
                        onError: () => toast.error("Could not undo"),
                      }
                    );
                    toast.dismiss(t.id);
                  }}
                >
                  Undo
                </button>
              </div>
            ),
            {
              duration: 6000,
              style: { background: "#1f2937", color: "#fff" },
            }
          );
        },
        onError: () => toast.error("Failed to unassign guest"),
      });
    },
    [unassignGuest, assignGuest]
  );

  const handlePopoverAssign = useCallback(
    (guestId: string) => {
      if (!seatPopover) return;
      assignGuest.mutate(
        { guestId, tableId: seatPopover.tableId },
        {
          onSuccess: () => toast.success("Guest assigned"),
          onError: () => toast.error("Failed to assign guest"),
        }
      );
      setSeatPopover(null);
    },
    [seatPopover, assignGuest]
  );

  const handleDropGuest = useCallback(
    (tableId: string, guestId: string) => {
      const guest = guests.find((g) => g.id === guestId);
      if (!guest) return;
      const previousTableId = guest.tableId ?? null;
      if (previousTableId === tableId) {
        setDraggedGuest(null);
        return;
      }
      assignGuest.mutate(
        { guestId, tableId },
        {
          onSuccess: () => {
            if (previousTableId) {
              toast.success(`Reassigned ${guest.name}`);
            } else {
              toast.success(`${guest.name} assigned`);
            }
          },
          onError: () => toast.error("Failed to assign guest"),
        }
      );
      setDraggedGuest(null);
    },
    [assignGuest, guests]
  );

  const handleAutoAssign = useCallback(() => {
    const snapshot = guests.map((g) => ({ id: g.id, tableId: g.tableId ?? null }));
    autoAssign.mutate(undefined, {
      onSuccess: (res) => {
        const d = res?.data;
        const message = d
          ? `Auto-assign complete — ${d.assignedCount} assigned, ${d.skippedCount} skipped`
          : "Auto-assign complete";
        toast(
          (t) => (
            <div className="flex items-center gap-3">
              <span className="text-sm">{message}</span>
              <button
                className="text-xs font-semibold text-primary hover:text-button underline"
                onClick={() => {
                  toast.dismiss(t.id);
                  restoreSnapshot(snapshot);
                }}
              >
                Undo
              </button>
            </div>
          ),
          {
            duration: 8000,
            style: { background: "#1f2937", color: "#fff" },
          }
        );
      },
      onError: () => toast.error("Auto-assign failed"),
    });
  }, [autoAssign, guests]);

  const restoreSnapshot = useCallback(
    async (snapshot: { id: string; tableId: string | null }[]) => {
      const pending = toast.loading("Restoring previous assignments...");
      try {
        for (const snap of snapshot) {
          if (snap.tableId === null) {
            await new Promise<void>((resolve, reject) =>
              unassignGuest.mutate(snap.id, {
                onSuccess: () => resolve(),
                onError: () => reject(),
              })
            );
          } else {
            await new Promise<void>((resolve, reject) =>
              assignGuest.mutate(
                { guestId: snap.id, tableId: snap.tableId! },
                {
                  onSuccess: () => resolve(),
                  onError: () => reject(),
                }
              )
            );
          }
        }
        toast.success("Previous assignments restored", { id: pending });
      } catch {
        toast.error("Some assignments could not be restored", { id: pending });
      }
    },
    [assignGuest, unassignGuest]
  );

  const handleAddDecoration = useCallback(
    (type: FloorItemType) => {
      const defaults: Record<string, { w: number; h: number }> = {
        stage: { w: 280, h: 50 },
        danceFloor: { w: 180, h: 160 },
        pillar: { w: 45, h: 45 },
        wall: { w: 80, h: 40 },
      };
      const d = defaults[type] ?? { w: 100, h: 100 };
      // Drop the new item at the current viewport center in world coords, so it lands
      // wherever the user is currently looking — not the canvas origin.
      const container = document.querySelector(".floor-canvas") as HTMLElement | null;
      const cw = container?.clientWidth ?? 800;
      const ch = container?.clientHeight ?? 500;
      const centerWorldX = (cw / 2 - panX) / zoom;
      const centerWorldY = (ch / 2 - panY) / zoom;
      const jitter = 30;
      addItem({
        id: uid(),
        type,
        x: centerWorldX - d.w / 2 + (Math.random() - 0.5) * jitter,
        y: centerWorldY - d.h / 2 + (Math.random() - 0.5) * jitter,
        width: d.w,
        height: d.h,
      });
      toast.success(`${type === "danceFloor" ? "Dance floor" : type.charAt(0).toUpperCase() + type.slice(1)} added`);
    },
    [addItem, panX, panY, zoom]
  );

  const rotateSelected = useCallback(() => {
    if (!selectedId) return;
    const item = floorItems.find((i) => i.id === selectedId);
    if (!item || item.type === "table") return;
    const next = ((item.rotation ?? 0) + 45) % 360;
    updateItem(selectedId, { rotation: next });
  }, [selectedId, floorItems, updateItem]);

  const handleCanvasClick = useCallback(
    (x: number, y: number) => {
      if (toolMode === "select") return;
      pendingPlacement.current = { x, y, shape: toolMode };
      setEditTableId(null);
      setShowTableModal(true);
    },
    [toolMode]
  );

  const handleTableModalClose = useCallback(() => {
    setShowTableModal(false);
    setEditTableId(null);
    if (pendingPlacement.current) {
      pendingShape.current = pendingPlacement.current.shape;
      pendingPlacement.current = null;
      setToolMode("select");
    }
  }, []);

  const handleSaveLayout = useCallback(() => {
    saveFloorPlan.mutate(floorItems, {
      onSuccess: () => toast.success("Layout saved"),
      onError: () => toast.error("Failed to save layout"),
    });
  }, [saveFloorPlan, floorItems]);

  const fitToItems = useCallback((items: FloorItem[]) => {
    const tablesOnly = items.filter((i) => i.type === "table");
    const toFit = tablesOnly.length > 0 ? tablesOnly : items;
    if (toFit.length === 0) {
      setZoom(1);
      setPanX(0);
      setPanY(0);
      return;
    }
    const minX = Math.min(...toFit.map((i) => i.x));
    const minY = Math.min(...toFit.map((i) => i.y));
    const maxX = Math.max(...toFit.map((i) => i.x + i.width));
    const maxY = Math.max(...toFit.map((i) => i.y + i.height));
    const padding = 100;
    const bboxW = maxX - minX + padding * 2;
    const bboxH = maxY - minY + padding * 2;
    const container = document.querySelector(".floor-canvas") as HTMLElement | null;
    const cw = container?.clientWidth ?? 800;
    const ch = container?.clientHeight ?? 500;
    const fit = Math.min(cw / bboxW, ch / bboxH);
    const newZoom = Math.max(0.3, Math.min(1.2, fit));
    const bboxCenterX = (minX + maxX) / 2;
    const bboxCenterY = (minY + maxY) / 2;
    setZoom(newZoom);
    setPanX(cw / 2 - bboxCenterX * newZoom);
    setPanY(ch / 2 - bboxCenterY * newZoom);
  }, []);

  const pendingFitRef = useRef(true);
  useEffect(() => {
    pendingFitRef.current = true;
  }, [eventId]);
  useEffect(() => {
    if (pendingFitRef.current && floorItems.length > 0) {
      pendingFitRef.current = false;
      const raf = requestAnimationFrame(() => fitToItems(floorItems));
      return () => cancelAnimationFrame(raf);
    }
  }, [floorItems, fitToItems]);

  const handleResetView = useCallback(() => {
    fitToItems(floorItems);
  }, [fitToItems, floorItems]);

  const handleAutoArrangeLayout = useCallback(() => {
    autoArrange(tables.map((t) => t.id));
    pendingFitRef.current = true;
    toast.success("Tables auto-arranged");
  }, [autoArrange, tables]);

  const handleApplyStandardize = useCallback(() => {
    if (tables.length === 0) {
      toast.error("No tables to standardize");
      setStandardizeOpen(false);
      return;
    }
    const n = standardizeTables(stdShape, stdSizeMode);
    autoArrange(tables.map((t) => t.id));
    pendingFitRef.current = true;
    setStandardizeOpen(false);
    const shapeLabel = stdShape === "rect" ? "long" : stdShape;
    const sizeLabel = stdSizeMode === "uniform" ? "uniform" : "auto";
    toast.success(`Standardized ${n} tables — ${shapeLabel}, ${sizeLabel} size`);
  }, [standardizeTables, autoArrange, tables, stdShape, stdSizeMode]);

  const stats = useMemo(() => {
    const seatedPax = guests
      .filter((g) => g.tableId)
      .reduce((s, g) => s + (g.pax ?? 1), 0);
    const unassignedPax = guests
      .filter((g) => !g.tableId)
      .reduce((s, g) => s + (g.pax ?? 1), 0);
    const totalCapacity = tables.reduce((s, t) => s + (t.capacity || 0), 0);
    return { seatedPax, unassignedPax, totalCapacity };
  }, [guests, tables]);

  const editTable = editTableId ? tables.find((t) => t.id === editTableId) : undefined;
  const pendingDeleteTable = pendingDeleteId ? tables.find((t) => t.id === pendingDeleteId) : undefined;

  const selectedItem = selectedId ? floorItems.find((i) => i.id === selectedId) : null;
  const selectedTable = selectedItem?.type === "table" ? tables.find((t) => t.id === selectedId) : null;
  const selectedShape = selectedItem?.type === "table" ? (selectedItem.meta?.shape as string) || "round" : null;

  if (eventsLoading) return <PageLoader message="Loading..." />;
  if (!eventId) {
    return <NoEventsState title="No Event Selected" message="Select or create an event to start designing your floor plan." />;
  }

  const toolBtn = (active: boolean) =>
    `p-1.5 rounded-md transition-all ${
      active
        ? "bg-primary text-white shadow-sm"
        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-slate-700"
    }`;

  const iconBtn =
    "p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2 flex-wrap">
        <h1 className="text-3xl font-display font-semibold text-primary">Floor Plan</h1>
        {!isReadOnly && (
          <div data-tour="floorplan-actions" className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleAutoAssign}
              disabled={autoAssign.isPending}
            >
              {autoAssign.isPending ? "Assigning..." : "Auto-Assign Guests"}
            </Button>
            <Button
              variant="primary"
              className="![background-image:none] !bg-primary !shadow-primary/25 hover:!bg-button"
              onClick={handleSaveLayout}
              loading={saveFloorPlan.isPending}
            >
              {!saveFloorPlan.isPending && (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4 mr-1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                </svg>
              )}
              {saveFloorPlan.isPending ? "Saving..." : "Save Layout"}
            </Button>
            <Button onClick={() => { setEditTableId(null); setShowTableModal(true); }}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4 mr-1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Table
            </Button>
          </div>
        )}
      </div>

      <div className="px-5 pb-2">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatsCard size="sm" variant="primary" label="Tables" value={tables.length} icon={<CollectionIcon className="w-4 h-4" />} />
          <StatsCard size="sm" variant="success" label="Seated (pax)" value={`${stats.seatedPax}/${stats.totalCapacity}`} icon={<UserGroupIcon className="w-4 h-4" />} />
          <StatsCard size="sm" variant="warning" label="Unassigned (pax)" value={stats.unassignedPax} icon={<UserIcon className="w-4 h-4" />} />
        </div>
      </div>

      <div className="flex items-center gap-2 px-5 py-1.5 overflow-x-auto overflow-y-visible">
        {!isReadOnly && (
          <>
            <div data-tour="floorplan-toolbar" className="flex items-center gap-0.5 p-0.5 rounded-lg bg-gray-100/80 dark:bg-slate-800/80 border border-gray-200/60 dark:border-gray-700/60 flex-shrink-0">
              <button onClick={() => handleShapeTool("round")} className={toolBtn(toolMode === "round")} title="Round table">
                <div className={`w-4 h-4 rounded-full border-2 ${toolMode === "round" ? "border-white/60" : "border-primary/60"}`} />
              </button>
              <button onClick={() => handleShapeTool("rect")} className={toolBtn(toolMode === "rect")} title="Long table">
                <div className={`w-6 h-3.5 rounded-sm border-2 ${toolMode === "rect" ? "border-white/60" : "border-secondary/60"}`} />
              </button>
              <button onClick={() => handleShapeTool("square")} className={toolBtn(toolMode === "square")} title="Square table">
                <div className={`w-4 h-4 rounded-sm border-2 ${toolMode === "square" ? "border-white/60" : "border-emerald-500/60"}`} />
              </button>
              <div className="w-px h-5 bg-gray-300/50 dark:bg-gray-600/50 mx-0.5" />
              <button onClick={() => handleAddDecoration("stage")} className={toolBtn(false)} title="Add stage">
                <span className="text-sm leading-none">🎭</span>
              </button>
              <button onClick={() => handleAddDecoration("danceFloor")} className={toolBtn(false)} title="Add dance floor">
                <span className="text-sm leading-none">💃</span>
              </button>
              <div className="w-px h-5 bg-gray-300/50 dark:bg-gray-600/50 mx-0.5" />
              <button onClick={() => handleAddDecoration("wall")} className={toolBtn(false)} title="Add wall">
                <div className="w-5 h-3.5 rounded-sm bg-gradient-to-br from-slate-400 to-slate-600" />
              </button>
              <button onClick={() => handleAddDecoration("pillar")} className={toolBtn(false)} title="Add pillar">
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-stone-400 to-stone-600" />
              </button>
              <div className="w-px h-5 bg-gray-300/50 dark:bg-gray-600/50 mx-0.5" />
              <button onClick={handleAutoArrangeLayout} className={toolBtn(false)} title="Auto-arrange tables on canvas">
                <span className="text-sm leading-none">✨</span>
              </button>
            </div>

            <button
              ref={standardizeBtnRef}
              onClick={openStandardize}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition ${
                standardizeOpen
                  ? "bg-primary text-white border-primary shadow-sm shadow-primary/25"
                  : "bg-white dark:bg-slate-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:border-primary/40 hover:text-primary dark:hover:text-primary"
              }`}
              title="Standardize all tables (shape + size) and re-arrange"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
              </svg>
              Standardize
            </button>
          </>
        )}

        {selectedItem && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 animate-fade-in">
            <span className="text-[11px] font-semibold text-primary whitespace-nowrap">
              {selectedItem.type === "table"
                ? (selectedTable?.name ?? "Table")
                : selectedItem.type === "stage" ? "Stage"
                : selectedItem.type === "danceFloor" ? "Dance Floor"
                : selectedItem.type === "pillar" ? "Pillar"
                : "Wall"}
            </span>

            {!isReadOnly && selectedItem.type === "table" && (
              <div className="flex items-center gap-0.5 ml-1 p-0.5 rounded bg-primary/15">
                {(["round", "rect", "square"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => changeTableShape(selectedId!, s)}
                    className={`p-1 rounded transition ${selectedShape === s ? "bg-white shadow-sm" : "hover:bg-white/60"}`}
                    title={`Change to ${s}`}
                  >
                    {s === "round" && <div className="w-3 h-3 rounded-full border-2 border-primary" />}
                    {s === "rect" && <div className="w-5 h-2.5 rounded-sm border-2 border-primary" />}
                    {s === "square" && <div className="w-3 h-3 rounded-sm border-2 border-primary" />}
                  </button>
                ))}
              </div>
            )}

            {!isReadOnly && selectedItem.type !== "table" && (
              <button
                onClick={rotateSelected}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium text-primary hover:bg-primary/15 transition"
                title={`Rotate 45° (current: ${selectedItem.rotation ?? 0}°)`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3 w-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Rotate
              </button>
            )}

            {!isReadOnly && (
              <button
                onClick={handleDeleteSelected}
                disabled={deleteTable.isPending}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3 w-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
                {deleteTable.isPending ? "Deleting..." : "Delete"}
              </button>
            )}

            <button
              onClick={() => setSelectedId(null)}
              className="ml-0.5 p-0.5 rounded text-primary/60 hover:text-primary transition"
              title="Deselect"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-3 w-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <div className="flex items-center rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.1).toFixed(1)))}
              className="px-2 py-1 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
            >
              −
            </button>
            <span className="px-2 py-1 text-[11px] font-medium text-gray-600 dark:text-gray-300 min-w-[42px] text-center border-x border-gray-200 dark:border-gray-700">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(1)))}
              className="px-2 py-1 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
            >
              +
            </button>
          </div>

          <button
            onClick={() => setSnapEnabled((s) => !s)}
            className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition ${
              snapEnabled
                ? "bg-primary/10 border-primary/30 text-primary dark:bg-primary/20"
                : "bg-white dark:bg-slate-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
            }`}
            title={`Snap to grid: ${snapEnabled ? "ON" : "OFF"}`}
          >
            Snap
          </button>

          <button onClick={handleResetView} className={iconBtn} title="Fit all tables to view">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
            </svg>
          </button>
          <button onClick={() => window.print()} className={iconBtn} title="Print layout">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-3 overflow-hidden px-5 pb-4 min-h-0">
        {tablesLoading || guestsLoading || floorPlanLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-primary animate-fade-in">
            <Spinner />
            <p className="text-sm text-text/50 dark:text-white/50">Loading floor plan...</p>
          </div>
        ) : (
          <>
            <FloorCanvasV3
              floorItems={floorItems}
              tables={tables}
              guests={guests}
              zoom={zoom}
              panX={panX}
              panY={panY}
              selectedId={selectedId}
              snapEnabled={snapEnabled}
              snapSize={snapSize}
              toolMode={toolMode}
              draggedGuest={isReadOnly ? null : draggedGuest}
              onZoomChange={setZoom}
              onPanChange={handlePanChange}
              onSelect={handleSelect}
              onMoveItem={isReadOnly ? () => {} : handleMoveItem}
              onDoubleClickTable={isReadOnly ? () => {} : handleDoubleClickTable}
              onDropGuest={isReadOnly ? () => {} : handleDropGuest}
              onDeleteSelected={isReadOnly ? () => {} : handleDeleteSelected}
              onCanvasClick={isReadOnly ? () => {} : handleCanvasClick}
              onSeatClick={isReadOnly ? () => {} : handleSeatClick}
              onResizeItem={isReadOnly ? () => {} : handleResizeItem}
            />
            <div data-tour="floorplan-guest-panel" className="hidden lg:flex h-full">
              <FloorGuestPanelV3
                guests={guests}
                tables={tables.map((t) => ({ id: t.id, name: t.name }))}
                onGuestDragStart={isReadOnly ? undefined : (id, pax) => setDraggedGuest({ id, pax })}
                onGuestDragEnd={isReadOnly ? undefined : () => setDraggedGuest(null)}
              />
            </div>
            <button
              onClick={() => setShowGuestPanel(true)}
              className="lg:hidden fixed bottom-6 left-6 z-40 bg-primary text-white px-4 py-3 rounded-full shadow-lg shadow-primary/25 flex items-center gap-2 hover:brightness-110 transition active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
              <span className="text-sm font-semibold">Guests</span>
              {stats.unassignedPax > 0 && (
                <span className="bg-amber-400 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {stats.unassignedPax}
                </span>
              )}
            </button>
          </>
        )}
      </div>

      <TableFormModal
        isOpen={showTableModal}
        onClose={handleTableModalClose}
        initial={editTable ? { id: editTable.id, name: editTable.name, capacity: editTable.capacity } : undefined}
      />

      <DeleteConfirmationModal
        isOpen={!!pendingDeleteId}
        isDeleting={deleteTable.isPending}
        onConfirm={confirmDeleteTable}
        onCancel={() => setPendingDeleteId(null)}
        title="Delete Table"
        description="Are you sure you want to delete this table? Guests assigned to it will be unassigned. This action cannot be undone."
      >
        {pendingDeleteTable && (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <p className="text-sm font-medium text-slate-800 dark:text-white mb-1">
              {pendingDeleteTable.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Capacity: {pendingDeleteTable.capacity}
            </p>
          </div>
        )}
      </DeleteConfirmationModal>

      {showGuestPanel && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowGuestPanel(false)} />
          <div className="relative ml-auto h-full w-80 max-w-[85vw] animate-slide-left">
            <button
              onClick={() => setShowGuestPanel(false)}
              className="absolute top-3 right-3 z-10 bg-gray-100 dark:bg-slate-700 rounded-full w-8 h-8 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <FloorGuestPanelV3
              guests={guests}
              tables={tables.map((t) => ({ id: t.id, name: t.name }))}
              onGuestDragStart={isReadOnly ? undefined : (id, pax) => setDraggedGuest({ id, pax })}
              onGuestDragEnd={isReadOnly ? undefined : () => setDraggedGuest(null)}
            />
          </div>
        </div>
      )}

      {seatPopover && (
        <div className="fixed inset-0 z-50" onClick={() => setSeatPopover(null)}>
          <div
            className="absolute bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-64 max-h-72 overflow-hidden flex flex-col animate-fade-in"
            style={{
              left: Math.min(seatPopover.anchorX - 128, window.innerWidth - 272),
              top: Math.max(8, seatPopover.anchorY - 280),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-slate-900">
              <p className="text-sm font-semibold text-slate-800 dark:text-white">Assign Guest to Seat</p>
              <p className="text-xs text-gray-500">Seat #{seatPopover.seatIndex + 1}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5" style={{ scrollbarWidth: "thin" }}>
              {guests.filter((g) => !g.tableId).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No unassigned guests</p>
              ) : (
                guests
                  .filter((g) => !g.tableId)
                  .map((g) => (
                    <button
                      key={g.id}
                      onClick={() => handlePopoverAssign(g.id)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-primary/5 transition flex items-center justify-between group"
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
      )}

      {occupiedMenu && (
        <div className="fixed inset-0 z-50" onClick={() => setOccupiedMenu(null)}>
          <div
            className="absolute bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-64 overflow-hidden flex flex-col animate-fade-in"
            style={{
              left: Math.min(occupiedMenu.anchorX - 128, window.innerWidth - 272),
              top: Math.max(8, occupiedMenu.anchorY - 180),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white text-sm font-bold">
                  {occupiedMenu.guestName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                    {occupiedMenu.guestName}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">{occupiedMenu.guestPax} pax</p>
                    {occupiedMenu.guestFlag === "VIP" && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-400 text-white text-[9px] font-bold">VIP</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-1.5">
              <button
                onClick={() => {
                  unassignWithUndo(occupiedMenu.guestId, occupiedMenu.tableId, occupiedMenu.guestName);
                  setOccupiedMenu(null);
                }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-medium flex items-center gap-2 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                Unassign from table
              </button>
              <button
                onClick={() => setOccupiedMenu(null)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 text-sm transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {standardizeOpen && standardizeAnchor &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setStandardizeOpen(false)} />
            <div
              className="fixed z-[61] w-72 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-fade-in"
              style={{
                top: Math.min(standardizeAnchor.top, window.innerHeight - 340),
                left: Math.min(Math.max(8, standardizeAnchor.left), window.innerWidth - 296),
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 bg-gradient-to-r from-primary to-button text-white">
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                  </svg>
                  <p className="text-sm font-semibold">Standardize Tables</p>
                </div>
                <p className="text-[10px] text-white/80 mt-0.5 leading-tight">
                  Unify shape and size across all {tables.length} tables
                </p>
              </div>

              <div className="p-4 space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                    Shape
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["round", "rect", "square"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setStdShape(s)}
                        className={`flex flex-col items-center justify-center gap-1 py-2 rounded-lg border-2 transition ${
                          stdShape === s
                            ? "border-primary bg-primary/10"
                            : "border-gray-200 dark:border-gray-700 hover:border-primary/40"
                        }`}
                      >
                        {s === "round" && (
                          <div className={`w-5 h-5 rounded-full border-2 ${stdShape === s ? "border-primary" : "border-gray-400"}`} />
                        )}
                        {s === "rect" && (
                          <div className={`w-7 h-3 rounded-sm border-2 ${stdShape === s ? "border-primary" : "border-gray-400"}`} />
                        )}
                        {s === "square" && (
                          <div className={`w-5 h-5 rounded-sm border-2 ${stdShape === s ? "border-primary" : "border-gray-400"}`} />
                        )}
                        <span className={`text-[10px] font-medium capitalize ${
                          stdShape === s ? "text-primary" : "text-gray-500 dark:text-gray-400"
                        }`}>
                          {s === "rect" ? "Long" : s}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                    Size
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => setStdSizeMode("byCapacity")}
                      className={`py-2 px-2 rounded-lg border-2 text-left transition ${
                        stdSizeMode === "byCapacity"
                          ? "border-primary bg-primary/10"
                          : "border-gray-200 dark:border-gray-700 hover:border-primary/40"
                      }`}
                    >
                      <p className={`text-[11px] font-semibold ${stdSizeMode === "byCapacity" ? "text-primary" : "text-gray-700 dark:text-gray-200"}`}>
                        Auto
                      </p>
                      <p className="text-[9px] text-gray-500 dark:text-gray-400 leading-tight">
                        Scale by capacity
                      </p>
                    </button>
                    <button
                      onClick={() => setStdSizeMode("uniform")}
                      className={`py-2 px-2 rounded-lg border-2 text-left transition ${
                        stdSizeMode === "uniform"
                          ? "border-primary bg-primary/10"
                          : "border-gray-200 dark:border-gray-700 hover:border-primary/40"
                      }`}
                    >
                      <p className={`text-[11px] font-semibold ${stdSizeMode === "uniform" ? "text-primary" : "text-gray-700 dark:text-gray-200"}`}>
                        Uniform
                      </p>
                      <p className="text-[9px] text-gray-500 dark:text-gray-400 leading-tight">
                        All sized to largest
                      </p>
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-1.5 px-2 py-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-900/40">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3 w-3 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                  </svg>
                  <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-snug">
                    Also re-runs auto-arrange so the resized tables don't overlap.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 px-4 pb-4">
                <button
                  onClick={() => setStandardizeOpen(false)}
                  className="flex-1 py-2 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyStandardize}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-primary to-button text-white shadow-sm shadow-primary/25 hover:brightness-110 transition"
                >
                  Apply
                </button>
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
