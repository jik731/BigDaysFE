import React from "react";
import type { FloorItemType } from "./useFloorPlanState";

type ToolMode = "select" | "round" | "rect" | "square";

interface Props {
  toolMode: ToolMode;
  zoom: number;
  snapEnabled: boolean;
  onShapeTool: (shape: ToolMode) => void;
  onAddDecoration: (type: FloorItemType) => void;
  onZoomChange: (z: number) => void;
  onSnapToggle: () => void;
  onResetView: () => void;
  onSaveLayout: () => void;
  onPrint: () => void;
  selectedItem: { type: string; meta?: Record<string, unknown> } | null;
  selectedTable: { name: string } | null;
  selectedShape: string | null;
  selectedId: string | null;
  deleteIsPending: boolean;
  onChangeTableShape: (id: string, shape: string) => void;
  onDeleteSelected: () => void;
  onDeselect: () => void;
}

const toolBtn = (active: boolean) =>
  `p-1.5 rounded-md transition-all ${
    active
      ? "bg-primary text-white shadow-sm"
      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-slate-700"
  }`;

const iconBtn =
  "p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition";

export const FloorToolbar: React.FC<Props> = ({
  toolMode,
  zoom,
  snapEnabled,
  onShapeTool,
  onAddDecoration,
  onZoomChange,
  onSnapToggle,
  onResetView,
  onSaveLayout,
  onPrint,
  selectedItem,
  selectedTable,
  selectedShape,
  selectedId,
  deleteIsPending,
  onChangeTableShape,
  onDeleteSelected,
  onDeselect,
}) => {
  return (
    <div className="flex items-center gap-2 px-5 py-1.5 overflow-x-auto">
      {/* Shape & Decoration Tools */}
      <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-gray-100/80 dark:bg-slate-800/80 border border-gray-200/60 dark:border-gray-700/60">
        <button onClick={() => onShapeTool("round")} className={toolBtn(toolMode === "round")} title="Round table">
          <div className={`w-4 h-4 rounded-full border-2 ${toolMode === "round" ? "border-white/60" : "border-primary/60"}`} />
        </button>
        <button onClick={() => onShapeTool("rect")} className={toolBtn(toolMode === "rect")} title="Long table">
          <div className={`w-6 h-3.5 rounded-sm border-2 ${toolMode === "rect" ? "border-white/60" : "border-secondary/60"}`} />
        </button>
        <button onClick={() => onShapeTool("square")} className={toolBtn(toolMode === "square")} title="Square table">
          <div className={`w-4 h-4 rounded-sm border-2 ${toolMode === "square" ? "border-white/60" : "border-emerald-500/60"}`} />
        </button>

        <div className="w-px h-5 bg-gray-300/50 dark:bg-gray-600/50 mx-0.5" />

        <button onClick={() => onAddDecoration("stage")} className={toolBtn(false)} title="Add stage">
          <span className="text-sm leading-none">{"\ud83c\udfad"}</span>
        </button>
        <button onClick={() => onAddDecoration("danceFloor")} className={toolBtn(false)} title="Add dance floor">
          <span className="text-sm leading-none">{"\ud83d\udc83"}</span>
        </button>

        <div className="w-px h-5 bg-gray-300/50 dark:bg-gray-600/50 mx-0.5" />

        <button onClick={() => onAddDecoration("wall")} className={toolBtn(false)} title="Add wall">
          <div className="w-5 h-3.5 rounded-sm bg-gradient-to-br from-slate-400 to-slate-600" />
        </button>
        <button onClick={() => onAddDecoration("pillar")} className={toolBtn(false)} title="Add pillar">
          <div className="w-4 h-4 rounded-full bg-gradient-to-br from-stone-400 to-stone-600" />
        </button>
      </div>

      {/* Selection Context Bar */}
      {selectedItem && (
        <FloorSelectionBar
          selectedItem={selectedItem}
          selectedTable={selectedTable}
          selectedShape={selectedShape}
          selectedId={selectedId}
          deleteIsPending={deleteIsPending}
          onChangeTableShape={onChangeTableShape}
          onDeleteSelected={onDeleteSelected}
          onDeselect={onDeselect}
        />
      )}

      {/* Right Controls */}
      <div className="ml-auto flex items-center gap-1.5">
        {/* Zoom */}
        <div className="flex items-center rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            onClick={() => onZoomChange(Math.max(0.3, +(zoom - 0.1).toFixed(1)))}
            className="px-2 py-1 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
          >
            {"\u2212"}
          </button>
          <span className="px-2 py-1 text-[11px] font-medium text-gray-600 dark:text-gray-300 min-w-[42px] text-center border-x border-gray-200 dark:border-gray-700">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => onZoomChange(Math.min(2, +(zoom + 0.1).toFixed(1)))}
            className="px-2 py-1 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
          >
            +
          </button>
        </div>

        {/* Snap */}
        <button
          onClick={onSnapToggle}
          className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition ${
            snapEnabled
              ? "bg-primary/10 border-primary/30 text-primary dark:bg-primary/20"
              : "bg-white dark:bg-slate-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
          }`}
          title={`Snap to grid: ${snapEnabled ? "ON" : "OFF"}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5 inline-block mr-0.5 -mt-px">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
          Snap
        </button>

        {/* Reset view */}
        <button onClick={onResetView} className={iconBtn} title="Reset view">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
          </svg>
        </button>

        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />

        {/* Save */}
        <button onClick={onSaveLayout} className={iconBtn} title="Save layout">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
          </svg>
        </button>

        {/* Print */}
        <button onClick={onPrint} className={iconBtn} title="Print layout">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

/** Inline selection context bar */
const FloorSelectionBar: React.FC<{
  selectedItem: { type: string; meta?: Record<string, unknown> };
  selectedTable: { name: string } | null;
  selectedShape: string | null;
  selectedId: string | null;
  deleteIsPending: boolean;
  onChangeTableShape: (id: string, shape: string) => void;
  onDeleteSelected: () => void;
  onDeselect: () => void;
}> = ({ selectedItem, selectedTable, selectedShape, selectedId, deleteIsPending, onChangeTableShape, onDeleteSelected, onDeselect }) => {
  const label =
    selectedItem.type === "table"
      ? (selectedTable?.name ?? "Table")
      : selectedItem.type === "stage"
        ? "Stage"
        : selectedItem.type === "danceFloor"
          ? "Dance Floor"
          : selectedItem.type === "pillar"
            ? "Pillar"
            : "Wall";

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/5 border border-primary/20 animate-fade-in">
      <span className="text-[11px] font-semibold text-primary whitespace-nowrap">
        {label}
      </span>

      {/* Table shape switcher */}
      {selectedItem.type === "table" && selectedId && (
        <div className="flex items-center gap-0.5 ml-1 p-0.5 rounded bg-primary/10">
          {(["round", "rect", "square"] as const).map((s) => (
            <button
              key={s}
              onClick={() => onChangeTableShape(selectedId, s)}
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

      {/* Delete button */}
      <button
        onClick={onDeleteSelected}
        disabled={deleteIsPending}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition disabled:opacity-50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3 w-3">
          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
        </svg>
        {deleteIsPending ? "Deleting..." : "Delete"}
      </button>

      {/* Deselect */}
      <button
        onClick={onDeselect}
        className="ml-0.5 p-0.5 rounded text-primary/50 hover:text-primary transition"
        title="Deselect"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-3 w-3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};
