// src/components/pages/RSVPs/RsvpDesignV3Page.tsx
// RSVP Designer V3 — Optimized full-screen builder with advanced UX.
// Improvements over V2:
//   - useReducer for consolidated state (replaces 15+ useState)
//   - Undo / Redo (Ctrl+Z / Ctrl+Y)
//   - Keyboard shortcuts (Delete, Ctrl+D duplicate, Escape deselect)
//   - Canvas zoom controls + tablet preview
//   - Drop zones between blocks on canvas
//   - Block duplication
//   - Collapsible left panel with search
//   - Better empty states & onboarding
// Reuses same types, API hooks, and mappers as V1/V2.

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useEventContext } from "../../../context/EventContext";
import type { Event } from "../../../api/hooks/useEventsApi";
import { useFormFields, type FormFieldConfig } from "../../../api/hooks/useFormFieldsApi";
import { useRsvpDesign, useSaveRsvpDesign, usePublishRsvpDesign, useGenerateShareToken } from "../../../api/hooks/useRsvpDesignApi";
import { useUploadMedia, useDeleteMedia } from "../../../api/hooks/useMediaApi";
import type { RsvpBlock, RsvpDesign, FlowPreset } from "../../../types/rsvpDesign";
import {
  saveImageToCache,
  getImageFromCache,
  getCachedImagesByEvent,
  removeCachedImage,
  cleanupExpiredImages,
} from "../../../utils/designImageCache";
import { NoEventsState } from "../../molecules/NoEventsState";
import { PageLoader } from "../../atoms/PageLoader";
import { BlockEditor } from "./designer/BlockEditor";
import { GlobalSettingsPanel } from "./designer/GlobalSettingsPanel";
import { Spinner } from "../../atoms/Spinner";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9);

const isValidSrc = (src?: string | null): src is string =>
  !!src && (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("blob:") || src.startsWith("/"));

const isBlob = (url: string) => url.startsWith("blob:");

function isLightColor(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length !== 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
}

const sanitizeBlocks = (rawBlocks: RsvpBlock[]): RsvpBlock[] =>
  rawBlocks.map((b) => ({
    ...b,
    sectionImage: b.sectionImage
      ? { ...b.sectionImage, src: isBlob(b.sectionImage.src) ? "" : b.sectionImage.src }
      : b.sectionImage,
    background: b.background
      ? { ...b.background, images: b.background.images.map((img) => ({ ...img, src: isBlob(img.src) ? "" : img.src })) }
      : b.background,
    ...(b.type === "image"
      ? { images: b.images.map((img) => ({ ...img, src: isBlob(img.src) ? "" : img.src })) }
      : {}),
  })) as RsvpBlock[];

// ─── Block library ──────────────────────────────────────────────────────���────

const CONTENT_BLOCKS: { type: RsvpBlock["type"]; icon: string; label: string; desc: string }[] = [
  { type: "headline",     icon: "Hₜ", label: "Headline",      desc: "Title & subtitle banner" },
  { type: "text",         icon: "¶",  label: "Text",          desc: "Body paragraph" },
  { type: "info",         icon: "ⓘ",  label: "Info badge",    desc: "Pill with label & value" },
  { type: "guestDetails", icon: "👤", label: "Guest details", desc: "Name · phone · pax · remarks" },
  { type: "formField",    icon: "✎",  label: "Form field",    desc: "Linked RSVP question" },
  { type: "cta",          icon: "→",  label: "CTA button",    desc: "Call-to-action button" },
  { type: "image",        icon: "🖼", label: "Image",         desc: "Photo or gallery block" },
];

const FROM_EVENT_BLOCKS: { type: RsvpBlock["type"]; icon: string; label: string; desc: string }[] = [
  { type: "eventDetails", icon: "📅", label: "Event Details", desc: "Date · time · location" },
  { type: "countdown",    icon: "⏳", label: "Countdown",     desc: "Live timer to event day" },
  { type: "map",          icon: "📍", label: "Map / Venue",   desc: "Location + directions" },
];

const ALL_BLOCKS = [...CONTENT_BLOCKS, ...FROM_EVENT_BLOCKS];

const BLOCK_LABEL: Record<string, string> = Object.fromEntries(
  ALL_BLOCKS.map(({ type, label }) => [type, label])
);

// ─── Reducer-based state management ─────────────────────────────────────────

interface DesignState {
  blocks: RsvpBlock[];
  selectedId: string | null;
  globalBackgroundType: "color" | "image" | "video";
  globalBackgroundAsset: string;
  globalBackgroundColor: string;
  globalOverlay: number;
  accentColor: string;
  flowPreset: FlowPreset;
  globalMusicUrl: string;
  submitButtonColor: string;
  submitButtonTextColor: string;
  submitButtonLabel: string;
  globalFontFamily: string;
  contentWidth: "compact" | "standard" | "wide" | "full";
  blockMarginX: number;
  blockMarginY: number;
  version: number | undefined;
  isDesignLoaded: boolean;
}

const initialState: DesignState = {
  blocks: [
    { id: uid(), type: "headline", title: "Welcome to our wedding", subtitle: "Save the date and RSVP below", align: "center", accent: "text-white", background: { images: [], overlay: 0.4 } },
    { id: uid(), type: "guestDetails", title: "Your details", subtitle: "Tell us about yourself", showFields: { name: true, phone: true, pax: true, remarks: true }, background: { images: [], overlay: 0.4 } },
    { id: uid(), type: "cta", label: "Submit RSVP", href: "#", align: "center", background: { images: [], overlay: 0.4 } },
  ],
  selectedId: null,
  globalBackgroundType: "color",
  globalBackgroundAsset: "",
  globalBackgroundColor: "#0f172a",
  globalOverlay: 0.35,
  accentColor: "#f97316",
  flowPreset: "serene",
  globalMusicUrl: "",
  submitButtonColor: "",
  submitButtonTextColor: "",
  submitButtonLabel: "",
  globalFontFamily: "",
  contentWidth: "full",
  blockMarginX: 0,
  blockMarginY: 0,
  version: undefined,
  isDesignLoaded: false,
};

type DesignAction =
  | { type: "LOAD_DESIGN"; payload: Partial<DesignState> }
  | { type: "SET_BLOCKS"; payload: RsvpBlock[] }
  | { type: "ADD_BLOCK"; payload: RsvpBlock }
  | { type: "ADD_BLOCKS"; payload: RsvpBlock[] }
  | { type: "UPDATE_BLOCK"; payload: { id: string; patch: Partial<RsvpBlock> } }
  | { type: "REMOVE_BLOCK"; payload: string }
  | { type: "DUPLICATE_BLOCK"; payload: string }
  | { type: "MOVE_BLOCK"; payload: { id: string; dir: "up" | "down" } }
  | { type: "REORDER_BLOCKS"; payload: { sourceId: string; targetId: string } }
  | { type: "SELECT"; payload: string | null }
  | { type: "SET_GLOBAL"; payload: Partial<DesignState> }
  | { type: "SET_VERSION"; payload: number }
  | { type: "RESTORE"; payload: DesignState };

function designReducer(state: DesignState, action: DesignAction): DesignState {
  switch (action.type) {
    case "LOAD_DESIGN":
      return { ...state, ...action.payload, isDesignLoaded: true };

    case "SET_BLOCKS":
      return { ...state, blocks: action.payload };

    case "ADD_BLOCK":
      return { ...state, blocks: [...state.blocks, action.payload], selectedId: action.payload.id };

    case "ADD_BLOCKS":
      return {
        ...state,
        blocks: [...state.blocks, ...action.payload],
        selectedId: action.payload[action.payload.length - 1]?.id ?? state.selectedId,
      };

    case "UPDATE_BLOCK":
      return {
        ...state,
        blocks: state.blocks.map((b) =>
          b.id === action.payload.id ? ({ ...b, ...action.payload.patch } as RsvpBlock) : b
        ),
      };

    case "REMOVE_BLOCK":
      return {
        ...state,
        blocks: state.blocks.filter((b) => b.id !== action.payload),
        selectedId: state.selectedId === action.payload ? null : state.selectedId,
      };

    case "DUPLICATE_BLOCK": {
      const idx = state.blocks.findIndex((b) => b.id === action.payload);
      if (idx === -1) return state;
      const clone = { ...state.blocks[idx], id: uid() } as RsvpBlock;
      const next = [...state.blocks];
      next.splice(idx + 1, 0, clone);
      return { ...state, blocks: next, selectedId: clone.id };
    }

    case "MOVE_BLOCK": {
      const { id, dir } = action.payload;
      const i = state.blocks.findIndex((b) => b.id === id);
      if (i === -1) return state;
      const j = dir === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= state.blocks.length) return state;
      const next = [...state.blocks];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...state, blocks: next };
    }

    case "REORDER_BLOCKS": {
      const { sourceId, targetId } = action.payload;
      const si = state.blocks.findIndex((b) => b.id === sourceId);
      const ti = state.blocks.findIndex((b) => b.id === targetId);
      if (si === -1 || ti === -1 || si === ti) return state;
      const next = [...state.blocks];
      const [moved] = next.splice(si, 1);
      next.splice(ti, 0, moved);
      return { ...state, blocks: next };
    }

    case "SELECT":
      return { ...state, selectedId: action.payload };

    case "SET_GLOBAL":
      return { ...state, ...action.payload };

    case "SET_VERSION":
      return { ...state, version: action.payload };

    case "RESTORE":
      return action.payload;

    default:
      return state;
  }
}

// ─── Undo/Redo hook ─────────────────────────────────────────────────────────

function useUndoRedo(state: DesignState, dispatch: React.Dispatch<DesignAction>) {
  const historyRef = useRef<DesignState[]>([]);
  const futureRef = useRef<DesignState[]>([]);
  const lastSnapshotRef = useRef(state);

  const pushSnapshot = useCallback(() => {
    historyRef.current = [...historyRef.current.slice(-29), lastSnapshotRef.current];
    futureRef.current = [];
    lastSnapshotRef.current = state;
  }, [state]);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    futureRef.current = [lastSnapshotRef.current, ...futureRef.current];
    const prev = historyRef.current.pop()!;
    lastSnapshotRef.current = prev;
    dispatch({ type: "RESTORE", payload: prev });
  }, [dispatch]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    historyRef.current = [...historyRef.current, lastSnapshotRef.current];
    const next = futureRef.current.shift()!;
    lastSnapshotRef.current = next;
    dispatch({ type: "RESTORE", payload: next });
  }, [dispatch]);

  return { pushSnapshot, undo, redo, canUndo: historyRef.current.length > 0, canRedo: futureRef.current.length > 0 };
}

// ─── Default block factories ────────────────────────────────────────────────

function createDefaultBlock(type: RsvpBlock["type"]): RsvpBlock {
  const id = uid();
  const bg = { images: [] as any[], overlay: 0.4 };
  const defaults: Record<RsvpBlock["type"], RsvpBlock> = {
    headline:     { id, type: "headline",     title: "Custom headline",    subtitle: "Add a subheader", align: "center", accent: "text-white", background: bg },
    text:         { id, type: "text",         body: "Tell your guests what to expect.", width: "full", align: "left", muted: false, background: bg },
    info:         { id, type: "info",         label: "Highlight", content: "Dress code, parking, or venue info", accent: "bg-white/20 text-white border border-white/30", background: bg },
    attendance:   { id, type: "attendance",   title: "Will you be attending?", subtitle: "Please let us know", background: bg },
    guestDetails: { id, type: "guestDetails", title: "Guest Information", subtitle: "", showFields: { name: true, phone: true, pax: true, remarks: true }, background: bg },
    formField:    { id, type: "formField",    label: "Custom field", placeholder: "Placeholder", required: false, width: "full", background: bg },
    cta:          { id, type: "cta",          label: "Submit RSVP", href: "#", align: "center", background: bg },
    image:        { id, type: "image",        images: [], activeImageId: undefined, caption: "Add a caption", height: "medium", background: bg },
    eventDetails: { id, type: "eventDetails", showDate: true, showTime: true, showLocation: true, background: bg },
    countdown:    { id, type: "countdown",    background: bg },
    map:          { id, type: "map",          showDirections: true, background: bg },
  };
  return defaults[type];
}

// ─── Countdown component ────────────────────────────────────────────────────

function CountdownDisplay({
  targetDate, label, accentColor, headingColor, bodyColor,
}: {
  targetDate?: string; label?: string; accentColor: string; headingColor: string; bodyColor: string;
}) {
  const calcDiff = (iso?: string) => {
    if (!iso) return null;
    const diff = new Date(iso).getTime() - Date.now();
    if (diff <= 0) return null;
    return { days: Math.floor(diff / 86_400_000), hrs: Math.floor((diff % 86_400_000) / 3_600_000), min: Math.floor((diff % 3_600_000) / 60_000), sec: Math.floor((diff % 60_000) / 1_000) };
  };
  const [diff, setDiff] = useState(() => calcDiff(targetDate));
  useEffect(() => { const t = setInterval(() => setDiff(calcDiff(targetDate)), 1_000); return () => clearInterval(t); }, [targetDate]);

  const units = diff ? [{ v: diff.days, u: "Days" }, { v: diff.hrs, u: "Hrs" }, { v: diff.min, u: "Min" }, { v: diff.sec, u: "Sec" }] : null;

  return (
    <div className="px-4 py-10 text-center">
      <p className="text-[10px] uppercase tracking-[0.28em] mb-6 font-semibold" style={{ color: accentColor }}>
        {label || "Counting down to our big day"}
      </p>
      {units ? (
        <div className="flex items-end justify-center gap-1.5 w-full">
          {units.map(({ v, u }, i) => (
            <React.Fragment key={u}>
              <div className="text-center flex-1 min-w-0">
                <div className="font-bold leading-none" style={{ fontFamily: "Georgia, serif", color: headingColor, fontSize: "2rem" }}>
                  {String(v).padStart(2, "0")}
                </div>
                <div className="text-[9px] uppercase tracking-widest mt-1.5 font-semibold" style={{ color: bodyColor, opacity: 0.55 }}>{u}</div>
              </div>
              {i < 3 && <div className="text-xl pb-3 font-light shrink-0" style={{ color: headingColor, opacity: 0.25 }}>:</div>}
            </React.Fragment>
          ))}
        </div>
      ) : (
        <p className="text-lg font-semibold" style={{ color: headingColor }}>The big day is here!</p>
      )}
    </div>
  );
}

// ─── Canvas block renderer ──────────────────────────────────────────────────

function renderSectionContent(
  block: RsvpBlock, accentColor: string, isLight: boolean, event?: Event
): React.ReactNode {
  const clr = {
    heading:    isLight ? "#1e293b" : "#ffffff",
    body:       isLight ? "#475569" : "rgba(255,255,255,0.75)",
    muted:      isLight ? "#94a3b8" : "rgba(255,255,255,0.45)",
    faint:      isLight ? "#cbd5e1" : "rgba(255,255,255,0.28)",
    pillBg:     isLight ? "rgba(0,0,0,0.06)"  : "rgba(255,255,255,0.08)",
    pillBorder: isLight ? "rgba(0,0,0,0.10)"  : "rgba(255,255,255,0.15)",
    inputBg:    isLight ? "rgba(0,0,0,0.04)"  : "rgba(255,255,255,0.06)",
    inputBdr:   isLight ? "rgba(0,0,0,0.12)"  : "rgba(255,255,255,0.12)",
  };

  switch (block.type) {
    case "headline":
      return (
        <div className={`px-8 py-14 text-${block.align ?? "center"}`} style={{ fontFamily: block.fontFamily || "Georgia, 'Times New Roman', serif" }}>
          <p className="text-[10px] uppercase tracking-[0.28em] mb-4 font-semibold" style={{ color: accentColor }}>Welcome</p>
          <h2 className="text-[2.2rem] font-normal leading-[1.15] mb-2" style={{ color: clr.heading, letterSpacing: "-0.01em" }}>{block.title || "Your Headline"}</h2>
          {block.subtitle && <p className="text-[13px] leading-relaxed mt-3 max-w-[85%] mx-auto" style={{ color: clr.body }}>{block.subtitle}</p>}
          <div className="w-12 h-px mx-auto mt-7" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}88, transparent)` }} />
        </div>
      );

    case "text":
      return (
        <div className={`px-8 py-6 text-${block.align ?? "left"}`} style={{ fontFamily: block.fontFamily || undefined }}>
          <p className="text-[13px] leading-[1.7]" style={{ color: block.muted ? clr.muted : clr.body }}>{block.body || "Add your text here..."}</p>
        </div>
      );

    case "info":
      return (
        <div className="px-8 py-5 flex justify-center">
          <div className="inline-flex items-center gap-3 rounded-full px-5 py-2.5 backdrop-blur-sm" style={{ background: clr.pillBg, border: `1px solid ${clr.pillBorder}` }}>
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: clr.body }}>{block.label || "Highlight"}</span>
            <span className="w-px h-3 shrink-0" style={{ background: clr.pillBorder }} />
            <span className="text-[11px]" style={{ color: clr.muted }}>{block.content || "Value"}</span>
          </div>
        </div>
      );

    case "attendance":
      return (
        <div className="px-8 py-8">
          <p className="text-[13px] font-semibold mb-1" style={{ color: clr.heading }}>{block.title || "Will you be attending?"}</p>
          {block.subtitle && <p className="text-xs mb-4" style={{ color: clr.muted }}>{block.subtitle}</p>}
          {!block.subtitle && <div className="mb-4" />}
          <div className="flex gap-2.5">
            {["Yes", "No", "Maybe"].map((v) => (
              <div key={v} className="flex-1 text-center py-2.5 rounded-xl text-xs font-medium" style={{ background: clr.inputBg, border: `1px solid ${clr.inputBdr}`, color: clr.body }}>{v}</div>
            ))}
          </div>
        </div>
      );

    case "guestDetails": {
      const fields = block.showFields ?? { name: true, phone: true, pax: true, remarks: true };
      const KNOWN_GUEST_KEYS = ["name", "phone", "pax", "remarks"] as const;
      const visible = KNOWN_GUEST_KEYS.filter((k) => fields[k] !== false);
      const placeholders: Record<string, string> = { name: "Full name", phone: "Phone number", pax: "Number of guests", remarks: "Remarks" };
      const customQuestions = block.customQuestions ?? [];
      return (
        <div className="px-8 py-8">
          <p className="text-[13px] font-semibold mb-1" style={{ color: clr.heading }}>{block.title || "Guest Information"}</p>
          {block.subtitle && <p className="text-xs mb-4" style={{ color: clr.muted }}>{block.subtitle}</p>}
          {!block.subtitle && <div className="mb-4" />}
          <div className="space-y-2">
            {visible.map((f) => (
              <div key={f} className="rounded-xl px-4 py-3 text-[12px]" style={{ background: clr.inputBg, border: `1px solid ${clr.inputBdr}`, color: clr.faint }}>
                {placeholders[f] ?? f}
              </div>
            ))}
          </div>

          {customQuestions.length > 0 && (
            <div className="mt-5 pt-5 border-t space-y-3" style={{ borderColor: clr.inputBdr }}>
              <p className="text-[10px] uppercase tracking-[0.28em] font-semibold" style={{ color: accentColor }}>
                Additional questions
              </p>
              {customQuestions.map((q) => (
                <div key={q.id} className="space-y-1.5">
                  <label className="block text-[11px] font-semibold" style={{ color: clr.body }}>
                    {q.label || "Question"}{q.required && <span className="ml-1" style={{ color: accentColor }}>*</span>}
                  </label>
                  <div className="rounded-xl px-4 py-3 text-[12px]" style={{ background: clr.inputBg, border: `1px solid ${clr.inputBdr}`, color: clr.faint }}>
                    {q.placeholder || "Guest response here..."}
                  </div>
                  {q.hint && <p className="text-[10px]" style={{ color: clr.faint }}>{q.hint}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    case "formField":
      return (
        <div className="px-8 py-5">
          <label className="block text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: clr.muted }}>
            {block.label || "Field"}{block.required && <span className="ml-1 text-rose-400">*</span>}
          </label>
          <div className="rounded-xl px-4 py-3 text-[12px]" style={{ background: clr.inputBg, border: `1px solid ${clr.inputBdr}`, color: clr.faint }}>
            {block.placeholder || "Guest response here..."}
          </div>
          {block.hint && <p className="text-[10px] mt-1.5" style={{ color: clr.faint }}>{block.hint}</p>}
        </div>
      );

    case "cta":
      return (
        <div className={`px-8 py-8 flex ${block.align === "center" ? "justify-center" : block.align === "right" ? "justify-end" : "justify-start"}`}>
          <button className="rounded-full px-10 py-3.5 text-sm font-semibold pointer-events-none transition-shadow"
            style={{
              background: (block as any).ctaColor || accentColor,
              color: (block as any).ctaTextColor || "#fff",
              boxShadow: `0 4px 14px ${((block as any).ctaColor || accentColor)}44`,
            }}>
            {block.label || "Submit RSVP"}
          </button>
        </div>
      );

    case "image": {
      const active = block.images?.find((img) => img.id === block.activeImageId) ?? block.images?.[0];
      const ratio = block.height === "tall" ? "4 / 3" : block.height === "short" ? "16 / 5" : "16 / 7";
      return (
        <div style={{ aspectRatio: ratio }}>
          {isValidSrc(active?.src) ? (
            <img src={active.src} alt={active.alt ?? ""} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ background: clr.inputBg }}>
              <span className="text-3xl" style={{ opacity: 0.2 }}>🖼</span>
              <span className="text-xs" style={{ color: clr.faint }}>Upload an image</span>
            </div>
          )}
        </div>
      );
    }

    case "eventDetails": {
      const showDate = block.showDate ?? true;
      const showTime = block.showTime ?? true;
      const showLocation = block.showLocation ?? true;
      const rawDate = event?.date ?? event?.raw?.eventDate;
      const formattedDate = rawDate
        ? (() => { try { return new Date(rawDate).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); } catch { return rawDate; } })()
        : "Date TBC";
      const rawTime = event?.raw?.eventTime ?? "";
      const formattedTime = rawTime || "Time TBC";
      const location = event?.location ?? event?.raw?.eventLocation ?? "Venue TBC";

      const cards = [
        showDate     && { icon: "📅", label: "Date",  value: formattedDate },
        showTime     && { icon: "⏰", label: "Time",  value: formattedTime },
        showLocation && { icon: "📍", label: "Venue", value: location },
      ].filter(Boolean) as { icon: string; label: string; value: string }[];

      return (
        <div className="px-6 py-10 text-center">
          {block.title && <p className="text-[13px] font-semibold mb-5" style={{ color: clr.body }}>{block.title}</p>}
          <div className="flex gap-2.5 justify-center flex-wrap">
            {cards.map(({ icon, label, value }) => (
              <div key={label} className="flex-1 min-w-[85px] max-w-[150px] rounded-2xl px-3 py-4" style={{ background: clr.pillBg, border: `1px solid ${clr.pillBorder}` }}>
                <div className="text-xl mb-1.5">{icon}</div>
                <div className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: accentColor }}>{label}</div>
                <div className="text-[11px] font-semibold leading-snug" style={{ color: clr.heading }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "countdown": {
      const targetDate = block.targetDate ?? event?.date ?? event?.raw?.eventDate;
      return <CountdownDisplay targetDate={targetDate} label={block.label} accentColor={accentColor} headingColor={clr.heading} bodyColor={clr.body} />;
    }

    case "map": {
      const address = block.address ?? event?.location ?? event?.raw?.eventLocation ?? "";
      const mapLabel = block.mapLabel ?? "Venue";
      const showDirections = block.showDirections ?? true;
      const hasAddress = !!address;
      const embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed&hl=en`;
      return (
        <div className="relative overflow-hidden" style={{ aspectRatio: "16 / 7" }}>
          {hasAddress ? (
            <iframe title="Venue map" src={embedUrl} className="absolute inset-0 w-full h-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" style={{ pointerEvents: "none" }} />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ background: isLight ? "#e8ebe0" : "#1a2035" }}>
              <span className="text-3xl opacity-30">📍</span>
              <p className="text-xs text-center px-6" style={{ color: clr.muted }}>Add an address in the block settings to show a live map</p>
            </div>
          )}
          {hasAddress && (
            <div className="absolute bottom-3 left-0 right-0 flex flex-col items-center gap-1.5 pointer-events-none">
              <div className="rounded-xl px-4 py-2 text-center shadow-lg" style={{ background: isLight ? "rgba(255,255,255,0.92)" : "rgba(15,23,42,0.85)", border: `1px solid ${clr.pillBorder}` }}>
                <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: accentColor }}>{mapLabel}</p>
                <p className="text-xs font-semibold" style={{ color: clr.heading }}>{address}</p>
              </div>
              {showDirections && <span className="text-[10px] font-semibold underline" style={{ color: accentColor }}>Get Directions</span>}
            </div>
          )}
        </div>
      );
    }

    default:
      return null;
  }
}

// ─── Canvas block wrapper (V3 — with drop zone + duplicate) ─────────────────

function V3CanvasBlock({
  block, isSelected, accentColor, globalIsLight, event, isFirst, isLast,
  onSelect, onMoveUp, onMoveDown, onRemove, onDuplicate, onDropAbove,
}: {
  block: RsvpBlock; isSelected: boolean; accentColor: string; globalIsLight: boolean;
  event?: Event; isFirst: boolean; isLast: boolean;
  onSelect: () => void; onMoveUp: () => void; onMoveDown: () => void;
  onRemove: () => void; onDuplicate: () => void;
  onDropAbove: (sourceId: string) => void;
}) {
  const [dropHighlight, setDropHighlight] = useState(false);

  const sectionImg = block.background?.images?.find((img) => img.id === block.background?.activeImageId) ?? block.background?.images?.[0] ?? block.sectionImage;
  const overlay = block.background?.overlay ?? 0.4;
  const isLight = sectionImg ? false : globalIsLight;

  return (
      <div
        className="relative group cursor-pointer"
        style={sectionImg?.src ? { backgroundImage: `linear-gradient(rgba(15,23,42,${overlay}),rgba(15,23,42,${overlay})), url(${sectionImg.src})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
        onClick={onSelect}
        draggable
        onDragStart={(e) => e.dataTransfer.setData("text/plain", block.id)}
      >
        {/* Drop zone — absolute so it adds no layout height (keeps canvas spacing identical to preview/public) */}
        <div
          className={`absolute left-4 right-4 rounded-full transition-all duration-150 z-20 ${dropHighlight ? "bg-primary/60 h-1.5" : "h-2"}`}
          style={{ top: -4 }}
          onDragOver={(e) => { e.preventDefault(); setDropHighlight(true); }}
          onDragLeave={() => setDropHighlight(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDropHighlight(false);
            const sourceId = e.dataTransfer.getData("text/plain");
            if (sourceId && sourceId !== block.id) onDropAbove(sourceId);
          }}
        />
        {/* Selection border */}
        {isSelected && <div className="absolute inset-0 border-2 border-primary pointer-events-none z-10 rounded-sm" />}
        {!isSelected && <div className="absolute inset-0 border-2 border-dashed border-transparent group-hover:border-primary/30 pointer-events-none z-10 transition-colors" />}

        {/* Label badge */}
        {isSelected && (
          <div className="absolute z-20 text-white text-[10px] font-bold px-2.5 py-0.5 uppercase tracking-wider rounded-t" style={{ top: -22, left: 0, background: "var(--color-primary, #6366f1)" }}>
            {BLOCK_LABEL[block.type] ?? block.type}
          </div>
        )}

        {/* V3 Action bar — includes Duplicate */}
        {isSelected && (
          <div className="absolute z-20 flex bg-white border border-gray-200 shadow-md rounded-t overflow-hidden" style={{ top: -24, right: 0 }} onClick={(e) => e.stopPropagation()}>
            {[
              { label: "↑", title: "Move up",    fn: onMoveUp,    disabled: isFirst },
              { label: "↓", title: "Move down",  fn: onMoveDown,  disabled: isLast },
              { label: "⧉", title: "Duplicate (Ctrl+D)", fn: onDuplicate },
              { label: "✕", title: "Remove (Del)",       fn: onRemove },
            ].map(({ label, title, fn, disabled }, i, arr) => (
              <button key={label} title={title} onClick={disabled ? undefined : fn}
                className={`px-2.5 py-1 text-[11px] transition ${disabled ? "text-gray-200 cursor-not-allowed" : "text-gray-500 hover:bg-rose-50 hover:text-rose-500"} ${i < arr.length - 1 ? "border-r border-gray-100" : ""}`}>
                {label}
              </button>
            ))}
          </div>
        )}

        <div>{renderSectionContent(block, accentColor, isLight, event)}</div>
        <div className="h-px" style={{ background: "rgba(255,255,255,0.04)" }} />
      </div>
  );
}

// ─── Left panel block item ──────────────────────────────────────────────────

function BlockItem({ icon, label, desc, onAdd }: { icon: string; label: string; desc: string; onAdd: () => void }) {
  return (
    <button type="button" onClick={onAdd}
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left border border-transparent hover:bg-[#fff5f7] hover:border-rose-100 group transition-all mb-0.5">
      <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center text-sm shrink-0 group-hover:bg-[#fce4e9] transition">{icon}</div>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-gray-600 group-hover:text-[#c0415a] leading-tight truncate">{label}</p>
        <p className="text-[10px] text-gray-400 truncate">{desc}</p>
      </div>
      <span aria-hidden="true" className="ml-auto text-gray-300 group-hover:text-rose-300 text-xs shrink-0">+</span>
    </button>
  );
}

// ─── Left panel layer row ───────────────────────────────────────────────────

function LayerRow({
  block, index, isSelected, isDragging, accentColor,
  onSelect, onDragStart, onDragOver, onDragEnd, onMoveUp, onMoveDown, onRemove, onDuplicate,
}: {
  block: RsvpBlock; index: number; isSelected: boolean; isDragging: boolean; accentColor: string;
  onSelect: () => void; onDragStart: React.DragEventHandler; onDragOver: React.DragEventHandler;
  onDragEnd: () => void; onMoveUp: () => void; onMoveDown: () => void; onRemove: () => void; onDuplicate: () => void;
}) {
  return (
    <div draggable onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onClick={onSelect}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer border transition-all select-none group mb-0.5 ${
        isSelected ? "border-rose-200 bg-rose-50" : isDragging ? "border-dashed border-gray-300 bg-gray-50 opacity-50" : "border-transparent hover:border-gray-100 hover:bg-gray-50"
      }`}>
      <span className="text-gray-300 text-xs cursor-grab active:cursor-grabbing shrink-0">⠿</span>
      <div className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background: accentColor }}>
        {ALL_BLOCKS.find((b) => b.type === block.type)?.icon ?? block.type[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[12px] font-semibold truncate leading-tight ${isSelected ? "text-[#c0415a]" : "text-gray-600"}`}>
          {BLOCK_LABEL[block.type] ?? block.type}
        </p>
        <p className="text-[10px] text-gray-400">#{index + 1}</p>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition" onClick={(e) => e.stopPropagation()}>
        <button onClick={onMoveUp}    title="Move up"    className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-600 text-xs transition">↑</button>
        <button onClick={onMoveDown}  title="Move down"  className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-600 text-xs transition">↓</button>
        <button onClick={onDuplicate} title="Duplicate"  className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:bg-primary/10 hover:text-primary text-xs transition">⧉</button>
        <button onClick={onRemove}    title="Remove"     className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:bg-rose-50 hover:text-rose-500 text-xs transition">✕</button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Main V3 Page
// ═════════════════════════════════════════════════════════════════════════════

export default function RsvpDesignV3Page() {
  const { event, eventId, eventsLoading } = useEventContext() ?? {};

  const { data: serverFormFields = [] } = useFormFields(eventId, { enabled: !!eventId });
  const { data: savedDesign, isLoading: isLoadingDesign } = useRsvpDesign(eventId ?? "");
  const { mutateAsync: saveDesignAsync, isPending: isSaving, isSuccess: isSaveSuccess, isError: isSaveError, data: saveResponse } = useSaveRsvpDesign(eventId ?? "");
  const { mutateAsync: publishDesignAsync, isPending: isPublishing } = usePublishRsvpDesign(eventId ?? "");
  const { mutateAsync: generateShareTokenAsync, isPending: isGeneratingLink } = useGenerateShareToken(eventId ?? "");
  const { mutateAsync: uploadMedia } = useUploadMedia();
  const { mutateAsync: deleteMedia } = useDeleteMedia();

  // ── Consolidated state ────────────────────────────────────────────────────
  const [state, dispatch] = useReducer(designReducer, initialState);
  const { blocks, selectedId, globalBackgroundType, globalBackgroundAsset, globalBackgroundColor, globalOverlay, accentColor, flowPreset, globalMusicUrl, submitButtonColor, submitButtonTextColor, submitButtonLabel, globalFontFamily, contentWidth, blockMarginX, blockMarginY, version, isDesignLoaded } = state;

  const { pushSnapshot, undo, redo, canUndo, canRedo } = useUndoRedo(state, dispatch);

  // ── V3 UI state ───────────────────────────────────────────────────────────
  const [leftTab, setLeftTab]       = useState<"blocks" | "layers">("blocks");
  const [rightTab, setRightTab]     = useState<"block" | "page">("block");
  const [canvasMode, setCanvasMode] = useState<"mobile" | "tablet" | "desktop">("mobile");
  const [zoom, setZoom]             = useState(100);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [blockSearch, setBlockSearch]     = useState("");
  const [contentOpen, setContentOpen]     = useState(true);
  const [fromEventOpen, setFromEventOpen] = useState(true);
  const [presetsOpen, setPresetsOpen]     = useState(true);
  const [draggingId, setDraggingId]       = useState<string | null>(null);
  const [isUploadingForSave, setIsUploadingForSave] = useState(false);
  const [showPreview, setShowPreview]     = useState(false);
  const [isPublished, setIsPublished]     = useState(false);
  const [shareToken, setShareToken]       = useState<string | null>(null);
  const [publicLink, setPublicLink]       = useState<string | null>(null);
  const [linkCopied, setLinkCopied]       = useState(false);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const globalBgCacheIdRef = useRef<string | null>(null);

  const availableQuestions = useMemo<FormFieldConfig[]>(
    () => serverFormFields.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [serverFormFields]
  );

  const selectedBlock = useMemo(
    () => blocks.find((b) => b.id === selectedId) ?? null,
    [blocks, selectedId]
  );

  // Filter blocks in search
  const filteredContentBlocks = blockSearch
    ? CONTENT_BLOCKS.filter((b) => b.label.toLowerCase().includes(blockSearch.toLowerCase()) || b.desc.toLowerCase().includes(blockSearch.toLowerCase()))
    : CONTENT_BLOCKS;
  const filteredEventBlocks = blockSearch
    ? FROM_EVENT_BLOCKS.filter((b) => b.label.toLowerCase().includes(blockSearch.toLowerCase()) || b.desc.toLowerCase().includes(blockSearch.toLowerCase()))
    : FROM_EVENT_BLOCKS;

  // ── Cleanup expired cache on mount ────────────────────────────────────────
  useEffect(() => { cleanupExpiredImages(7).catch(() => {}); }, []);

  // ── Sync version from save response ───────────────────────────────────────
  useEffect(() => {
    if (saveResponse?.data?.version !== undefined)
      dispatch({ type: "SET_VERSION", payload: saveResponse.data.version });
  }, [saveResponse]);

  // Keep the header's published badge in sync with the server's latest version
  // after every refetch (save → cache invalidate → refetch) and on first load.
  useEffect(() => {
    if (typeof savedDesign?.isPublished === "boolean") {
      setIsPublished(savedDesign.isPublished);
    }
  }, [savedDesign?.isPublished, savedDesign?.version]);

  // ── Load saved design ─────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoadingDesign || isDesignLoaded) return;
    if (savedDesign?.blocks?.length) {
      const loaded = sanitizeBlocks(savedDesign.blocks);
      const patch: Partial<DesignState> = { blocks: loaded };
      if (savedDesign.globalBackgroundType)  patch.globalBackgroundType = savedDesign.globalBackgroundType;
      if (savedDesign.globalBackgroundAsset && !isBlob(savedDesign.globalBackgroundAsset)) patch.globalBackgroundAsset = savedDesign.globalBackgroundAsset;
      if (savedDesign.globalBackgroundColor) patch.globalBackgroundColor = savedDesign.globalBackgroundColor;
      if (savedDesign.globalOverlay !== undefined) patch.globalOverlay = savedDesign.globalOverlay;
      if (savedDesign.accentColor)        patch.accentColor = savedDesign.accentColor;
      if (savedDesign.flowPreset)         patch.flowPreset = savedDesign.flowPreset;
      if (savedDesign.globalMusicUrl)     patch.globalMusicUrl = savedDesign.globalMusicUrl;
      if (savedDesign.submitButtonColor)  patch.submitButtonColor = savedDesign.submitButtonColor;
      if (savedDesign.submitButtonTextColor) patch.submitButtonTextColor = savedDesign.submitButtonTextColor;
      if (savedDesign.submitButtonLabel)  patch.submitButtonLabel = savedDesign.submitButtonLabel;
      if (savedDesign.globalFontFamily)   patch.globalFontFamily = savedDesign.globalFontFamily;
      if (savedDesign.contentWidth)       patch.contentWidth = savedDesign.contentWidth;
      if (savedDesign.blockMarginX !== undefined) patch.blockMarginX = savedDesign.blockMarginX;
      if (savedDesign.blockMarginY !== undefined) patch.blockMarginY = savedDesign.blockMarginY;
      if (savedDesign.version !== undefined) patch.version = savedDesign.version;
      dispatch({ type: "LOAD_DESIGN", payload: patch });

      // Restore share link. Prefer the slug URL (public, reflects latest design)
      // over /rsvp/submit/:token which depends on a backend share-token endpoint
      // that is currently unreliable — see .claude/todo/rsvp-v3-preview-public-sync.md.
      if (savedDesign.shareToken) {
        setShareToken(savedDesign.shareToken);
      }
      if (event?.slug) {
        setPublicLink(`${window.location.origin}/rsvp/${event.slug}`);
      } else if (savedDesign.shareToken) {
        setPublicLink(`${window.location.origin}/rsvp/submit/${savedDesign.shareToken}?event=${eventId}`);
      }

      // Restore cached images
      if (eventId) {
        getCachedImagesByEvent(eventId).then((cached) => {
          if (!cached.length) return;
          const cacheMap = new Map(cached.map((c) => [c.id, c]));
          dispatch({
            type: "SET_BLOCKS",
            payload: loaded.map((b) => {
              const pSI = b.sectionImage && !b.sectionImage.src && cacheMap.has(b.sectionImage.id)
                ? { ...b.sectionImage, src: URL.createObjectURL(cacheMap.get(b.sectionImage.id)!.file) } : b.sectionImage;
              const pBg = b.background?.images.map((img) => !img.src && cacheMap.has(img.id) ? { ...img, src: URL.createObjectURL(cacheMap.get(img.id)!.file) } : img) ?? [];
              const pImg = b.type === "image" ? b.images.map((img) => !img.src && cacheMap.has(img.id) ? { ...img, src: URL.createObjectURL(cacheMap.get(img.id)!.file) } : img) : undefined;
              return { ...b, sectionImage: pSI, background: b.background ? { ...b.background, images: pBg } : b.background, ...(pImg ? { images: pImg } : {}) } as RsvpBlock;
            }),
          });
        }).catch(() => {});
      }
    } else if (event?.title) {
      toast("No RSVP design found. Start building one below!", { icon: "ℹ️" });
      const parts: string[] = [];
      if (event.date) { try { parts.push(new Date(event.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })); } catch { parts.push(event.date); } }
      if (event.time) parts.push(event.time);
      if (event.location) parts.push(event.location);
      const subtitle = parts.length > 0 ? `Save the date — ${parts.join(" · ")}` : "Save the date and RSVP below";
      dispatch({ type: "SET_BLOCKS", payload: state.blocks.map((b) => b.type === "headline" ? { ...b, title: event.title, subtitle } : b) });
      dispatch({ type: "LOAD_DESIGN", payload: {} });
    } else {
      dispatch({ type: "LOAD_DESIGN", payload: {} });
    }
  }, [isLoadingDesign, savedDesign, isDesignLoaded, event?.title, event?.slug, eventId]);

  // ── Google Fonts ──────────────────────────────────────────────────────────
  useEffect(() => {
    const id = "rsvp-designer-google-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id; link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600&family=Cormorant+Garamond:wght@400;600&family=Lato:wght@400;700&family=Montserrat:wght@400;600&family=Dancing+Script:wght@400;700&family=Raleway:wght@400;600;700&display=swap";
    document.head.appendChild(link);
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      // Ctrl+Z = Undo, Ctrl+Y / Ctrl+Shift+Z = Redo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }

      // Ctrl+D = Duplicate selected block
      if ((e.ctrlKey || e.metaKey) && e.key === "d" && selectedId) {
        e.preventDefault(); pushSnapshot(); dispatch({ type: "DUPLICATE_BLOCK", payload: selectedId }); return;
      }

      // Delete / Backspace = Remove selected block
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault(); pushSnapshot(); dispatch({ type: "REMOVE_BLOCK", payload: selectedId }); return;
      }

      // Escape = Deselect
      if (e.key === "Escape") { dispatch({ type: "SELECT", payload: null }); return; }

      // Ctrl+S = Save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); handleSave(); return; }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, undo, redo, pushSnapshot]);

  // Close share panel on outside click
  useEffect(() => {
    if (!showSharePanel) return;
    const close = () => setShowSharePanel(false);
    const timer = setTimeout(() => document.addEventListener("click", close), 0);
    return () => { clearTimeout(timer); document.removeEventListener("click", close); };
  }, [showSharePanel]);

  // ── Block operations (wrapped to push undo snapshots) ─────────────────────
  const addBlock = (type: RsvpBlock["type"]) => {
    pushSnapshot();
    dispatch({ type: "ADD_BLOCK", payload: createDefaultBlock(type) });
    setLeftTab("layers");
    setRightTab("block");
  };

  const addRsvpFormPreset = () => {
    pushSnapshot();
    const customQuestions = availableQuestions.map((field) => ({
      id: uid(),
      questionId: String(field.id ?? (field as any).questionId ?? ""),
      label: field.label || (field as any).text || "Custom field",
      placeholder: Array.isArray(field.options) ? String(field.options[0] ?? "") : "",
      required: field.isRequired ?? false,
      hint: undefined as string | undefined,
    }));
    const g: RsvpBlock = {
      id: uid(),
      type: "guestDetails",
      title: "Guest Information",
      subtitle: "",
      showFields: { name: true, phone: true, pax: true, remarks: true },
      customQuestions,
      background: { images: [], overlay: 0.4 },
    };
    const c: RsvpBlock = { id: uid(), type: "cta", label: "Submit RSVP", href: "#", align: "center", background: { images: [], overlay: 0.4 } };
    dispatch({ type: "ADD_BLOCKS", payload: [g, c] });
    setLeftTab("layers");
    setRightTab("block");
  };

  const updateBlock = (blockId: string, patch: Partial<RsvpBlock>) => {
    pushSnapshot();
    dispatch({ type: "UPDATE_BLOCK", payload: { id: blockId, patch } });
  };

  const removeBlock = (blockId: string) => {
    pushSnapshot();
    dispatch({ type: "REMOVE_BLOCK", payload: blockId });
  };

  const duplicateBlock = (blockId: string) => {
    pushSnapshot();
    dispatch({ type: "DUPLICATE_BLOCK", payload: blockId });
  };

  const moveBlock = (id: string, dir: "up" | "down") => {
    pushSnapshot();
    dispatch({ type: "MOVE_BLOCK", payload: { id, dir } });
  };

  const reorderBlocks = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    pushSnapshot();
    dispatch({ type: "REORDER_BLOCKS", payload: { sourceId, targetId } });
  };

  const applyQuestionToBlock = (blockId: string, questionId: string | undefined) => {
    if (!questionId) return;
    const field = availableQuestions.find((f) => String(f.id ?? f.questionId) === String(questionId));
    if (!field) return;
    pushSnapshot();
    dispatch({
      type: "UPDATE_BLOCK",
      payload: {
        id: blockId,
        patch: {
          label: field.label || field.text,
          placeholder: Array.isArray(field.options) ? String(field.options[0] ?? "") : undefined,
          required: field.isRequired ?? false,
          hint: field.typeKey ? `${field.typeKey}${field.isRequired ? " · required" : ""}` : undefined,
          questionId,
        },
      },
    });
  };

  // ── Image operations ──────────────────────────────────────────────────────
  const toImageAsset = async (file: File) => {
    const id = uid();
    const blobUrl = await saveImageToCache(id, file, eventId ?? "");
    return { id, src: blobUrl, alt: file.name };
  };

  const handleBackgroundUpload = async (file: File) => {
    const id = uid();
    const blobUrl = await saveImageToCache(id, file, eventId ?? "");
    if (globalBackgroundAsset?.startsWith("https://")) {
      const fileName = globalBackgroundAsset.split("/").pop();
      if (fileName) deleteMedia({ fileName }).catch(() => {});
    }
    if (globalBgCacheIdRef.current) removeCachedImage(globalBgCacheIdRef.current).catch(() => {});
    globalBgCacheIdRef.current = id;
    dispatch({ type: "SET_GLOBAL", payload: { globalBackgroundAsset: blobUrl } });
  };

  const handleImageUploadBlock = async (files: FileList) => {
    const gallery = await Promise.all(Array.from(files).map(toImageAsset));
    const block: RsvpBlock = { id: uid(), type: "image", images: gallery, activeImageId: gallery[0]?.id, caption: "Add a caption or blessing", height: "medium", background: { images: [], overlay: 0.4 } };
    pushSnapshot();
    dispatch({ type: "ADD_BLOCK", payload: block });
  };

  const addBackgroundImagesToBlock = async (blockId: string, files: FileList) => {
    const gallery = await Promise.all(Array.from(files).map(toImageAsset));
    pushSnapshot();
    dispatch({
      type: "SET_BLOCKS",
      payload: blocks.map((b) => {
        if (b.id !== blockId) return b;
        const existing = b.background?.images ?? [];
        const merged = [...existing, ...gallery];
        return { ...b, background: { images: merged, activeImageId: b.background?.activeImageId ?? merged[0]?.id, overlay: b.background?.overlay ?? 0.4 } } as RsvpBlock;
      }),
    });
  };

  const setActiveBackgroundForBlock = (blockId: string, imageId: string) =>
    dispatch({ type: "SET_BLOCKS", payload: blocks.map((b) => b.id === blockId ? ({ ...b, background: { ...(b.background ?? { images: [] }), activeImageId: imageId } } as RsvpBlock) : b) });

  const removeBackgroundImageFromBlock = (blockId: string, imageId: string) =>
    dispatch({
      type: "SET_BLOCKS",
      payload: blocks.map((b) => {
        if (b.id !== blockId) return b;
        const remaining = (b.background?.images ?? []).filter((img) => img.id !== imageId);
        return { ...b, background: { images: remaining, activeImageId: b.background?.activeImageId === imageId ? remaining[0]?.id : b.background?.activeImageId, overlay: b.background?.overlay ?? 0.4 } } as RsvpBlock;
      }),
    });

  const setOverlayForBlock = (blockId: string, overlay: number) =>
    dispatch({ type: "SET_BLOCKS", payload: blocks.map((b) => b.id === blockId ? ({ ...b, background: { ...(b.background ?? { images: [] }), overlay } } as RsvpBlock) : b) });

  const setSectionImageForBlock = async (blockId: string, file: File) => {
    const oldSI = blocks.find((b) => b.id === blockId)?.sectionImage;
    const asset = await toImageAsset(file);
    if (oldSI) {
      if (oldSI.src?.startsWith("https://")) { const fn = oldSI.src.split("/").pop(); if (fn) deleteMedia({ fileName: fn }).catch(() => {}); }
      removeCachedImage(oldSI.id).catch(() => {});
    }
    dispatch({ type: "SET_BLOCKS", payload: blocks.map((b) => b.id === blockId ? { ...b, sectionImage: asset } : b) });
  };

  const clearSectionImage = (blockId: string) =>
    dispatch({ type: "SET_BLOCKS", payload: blocks.map((b) => b.id === blockId ? { ...b, sectionImage: null } : b) });

  const replaceImageForBlock = async (blockId: string, file: File) => {
    const asset = await toImageAsset(file);
    dispatch({ type: "SET_BLOCKS", payload: blocks.map((b) => b.id !== blockId || b.type !== "image" ? b : { ...b, images: [asset, ...b.images], activeImageId: asset.id }) });
  };

  const appendImagesToBlock = async (blockId: string, files: FileList) => {
    const newAssets = await Promise.all(Array.from(files).map(toImageAsset));
    dispatch({
      type: "SET_BLOCKS",
      payload: blocks.map((b) => {
        if (b.id !== blockId || b.type !== "image") return b;
        const next = [...b.images, ...newAssets];
        return { ...b, images: next, activeImageId: b.activeImageId ?? next[0]?.id };
      }),
    });
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async (): Promise<boolean> => {
    if (!eventId) return false;
    setIsUploadingForSave(true);
    try {
      const allBlobAssets: { id: string }[] = [];
      for (const b of blocks) {
        if (b.sectionImage && isBlob(b.sectionImage.src)) allBlobAssets.push(b.sectionImage);
        for (const img of b.background?.images ?? []) { if (isBlob(img.src)) allBlobAssets.push(img); }
        if (b.type === "image") { for (const img of b.images) { if (isBlob(img.src)) allBlobAssets.push(img); } }
      }

      const urlSwaps: Record<string, string> = {};
      const uploadedCacheIds: string[] = [];
      await Promise.all(
        allBlobAssets.map(async ({ id }) => {
          const cached = await getImageFromCache(id);
          if (!cached) return;
          const result = await uploadMedia({ file: cached.file, eventGuid: eventId });
          if (!isValidSrc(result?.url)) throw new Error("Image upload returned an invalid URL.");
          urlSwaps[id] = result.url;
          uploadedCacheIds.push(id);
        })
      );

      const swappedBlocks: RsvpBlock[] = blocks.map((b) => ({
        ...b,
        ...(b.sectionImage && urlSwaps[b.sectionImage.id] ? { sectionImage: { ...b.sectionImage, src: urlSwaps[b.sectionImage.id] } } : {}),
        background: b.background ? { ...b.background, images: b.background.images.map((img) => urlSwaps[img.id] ? { ...img, src: urlSwaps[img.id] } : img) } : b.background,
        ...(b.type === "image" ? { images: b.images.map((img) => urlSwaps[img.id] ? { ...img, src: urlSwaps[img.id] } : img) } : {}),
      })) as RsvpBlock[];

      if (Object.keys(urlSwaps).length > 0) dispatch({ type: "SET_BLOCKS", payload: swappedBlocks });

      let resolvedBgAsset = globalBackgroundAsset;
      let uploadedBgCacheId: string | null = null;
      if (isBlob(globalBackgroundAsset) && globalBgCacheIdRef.current) {
        const cached = await getImageFromCache(globalBgCacheIdRef.current);
        if (cached) {
          const result = await uploadMedia({ file: cached.file, eventGuid: eventId });
          if (!isValidSrc(result?.url)) throw new Error("Background upload returned an invalid URL.");
          resolvedBgAsset = result.url;
          dispatch({ type: "SET_GLOBAL", payload: { globalBackgroundAsset: result.url } });
          uploadedBgCacheId = globalBgCacheIdRef.current;
        }
      }

      const currentDesign: RsvpDesign = {
        blocks: sanitizeBlocks(swappedBlocks), flowPreset,
        globalBackgroundType, globalBackgroundAsset: isBlob(resolvedBgAsset) ? "" : resolvedBgAsset, globalBackgroundColor,
        globalOverlay, accentColor,
        globalMusicUrl: globalMusicUrl || undefined,
        submitButtonColor: submitButtonColor || undefined,
        submitButtonTextColor: submitButtonTextColor || undefined,
        submitButtonLabel: submitButtonLabel || undefined,
        globalFontFamily: globalFontFamily || undefined,
        layoutStyle: "flush" as const,
        contentWidth: contentWidth || "full",
        blockMarginX,
        blockMarginY,
        formFieldConfigs: availableQuestions,
        shareToken,
        publicLink,
      };
      await saveDesignAsync({ design: currentDesign, isPublished: false, isDraft: true, shareToken, publicLink });

      await Promise.all(uploadedCacheIds.map((id) => removeCachedImage(id).catch(() => {})));
      if (uploadedBgCacheId) { await removeCachedImage(uploadedBgCacheId).catch(() => {}); globalBgCacheIdRef.current = null; }
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save design. Please try again.");
      return false;
    } finally {
      setIsUploadingForSave(false);
    }
  };

  // ── Guest link generation ───────────────────────────────────────────────────
  // Prefer the slug URL (/rsvp/:slug) which is a public endpoint that always
  // reflects the latest saved design. Fall back to a share-token URL only when
  // the event has no slug. See .claude/todo/rsvp-v3-preview-public-sync.md.
  const generateGuestLink = async () => {
    if (event?.slug) {
      const link = `${window.location.origin}/rsvp/${event.slug}`;
      setPublicLink(link);
      setLinkCopied(false);
      setShowSharePanel(true);
      return;
    }

    const ver = saveResponse?.data?.version ?? version;
    if (!ver && ver !== 0) {
      toast.error("Save your design first before generating a guest link.");
      return;
    }
    try {
      const token = await generateShareTokenAsync({ version: ver });
      const link = `${window.location.origin}/rsvp/submit/${token}?event=${eventId}`;
      setShareToken(token);
      setPublicLink(link);
      setLinkCopied(false);
      setShowSharePanel(true);
    } catch {
      toast.error("Failed to generate guest link. Please try again.");
    }
  };

  const copyGuestLink = async () => {
    if (!publicLink || !navigator.clipboard) return;
    await navigator.clipboard.writeText(publicLink);
    setLinkCopied(true);
    toast.success("Link copied to clipboard!");
  };

  // ── Save & Publish (save first, then publish) ──────────────────────────────
  const handleSaveAndPublish = async () => {
    const saved = await handleSave();
    if (!saved) return;
    // After save, version is updated via the useEffect. Use the version from the save response.
    const ver = saveResponse?.data?.version ?? version;
    if (!ver && ver !== 0) {
      toast.error("Save first to get a version before publishing.");
      return;
    }
    try {
      await publishDesignAsync({ version: ver });
      setIsPublished(true);
      toast.success("Design published! Guests can now see your RSVP page.");
    } catch {
      toast.error("Failed to publish. Please try again.");
    }
  };

  // ── Early returns ─────────────────────────────────────────────────────────
  if (eventsLoading) return <PageLoader message="Loading..." />;
  if (!eventId) return <NoEventsState title="No Event for RSVP Design" message="Create your first event to start customising your RSVP page." />;

  const frameBg: React.CSSProperties = globalBackgroundType === "color" ? { background: globalBackgroundColor } : { background: "linear-gradient(to bottom, #0f172a, #020617)" };
  const globalIsLight = globalBackgroundType === "color" && isLightColor(globalBackgroundColor);

  // Device-frame sizing (canvas mode = what device we're previewing on).
  // contentWidth is applied as an inner mx-auto max-w-* — mirroring preview/public exactly.
  const contentWidthPx: Record<string, number> = { compact: 384, standard: 512, wide: 672 };
  const cwPx = contentWidthPx[contentWidth];
  const contentMaxClass =
    contentWidth === "compact"  ? "max-w-sm"  :
    contentWidth === "standard" ? "max-w-lg"  :
    contentWidth === "wide"     ? "max-w-2xl" : "";
  const canvasWidth = canvasMode === "mobile" ? 375
    : canvasMode === "tablet" ? 768
    : undefined;
  const canvasClass = canvasMode === "mobile"
    ? "w-[375px] rounded-[28px] shadow-[0_0_0_8px_#1a1a2e,0_24px_64px_rgba(0,0,0,0.45)]"
    : canvasMode === "tablet"
    ? "w-[768px] rounded-[20px] shadow-[0_0_0_6px_#1a1a2e,0_24px_64px_rgba(0,0,0,0.35)]"
    : "w-full rounded-lg shadow-[0_4px_32px_rgba(0,0,0,0.22)]";

  const chevronSvg = (open: boolean) => (
    <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`shrink-0 motion-safe:transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`}>
      <polyline points="2 5 7 10 12 5" />
    </svg>
  );

  // ═════════════════════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#f0f2f5" }}>

      {/* ═══ TOP TOOLBAR ═══ */}
      <header className="flex items-center gap-2 px-4 shrink-0 bg-white border-b border-gray-200" style={{ height: 52, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", zIndex: 10 }}>
        <button
          onClick={() => window.close()}
          className="flex items-center justify-center w-7 h-7 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition shrink-0 mr-1"
          title="Close"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="13" y2="13" /><line x1="13" y1="1" x2="1" y2="13" />
          </svg>
        </button>
        <div className="w-px h-6 bg-gray-200 shrink-0" />

        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest leading-none mb-0.5">RSVP Designer V3</p>
          <p className="text-sm font-semibold text-gray-800 truncate leading-tight">{event?.title ?? "Untitled event"}</p>
        </div>

        <div className="w-px h-6 bg-gray-200 shrink-0" />

        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5">
          <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)"
            className="px-2 py-1.5 text-xs rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
          </button>
          <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)"
            className="px-2 py-1.5 text-xs rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" /></svg>
          </button>
        </div>

        <div className="w-px h-6 bg-gray-200 shrink-0" />

        {/* Viewport toggle — now with tablet */}
        <div className="flex items-center gap-0.5 bg-gray-100 rounded-md p-0.5">
          {(["mobile", "tablet", "desktop"] as const).map((m) => (
            <button key={m} onClick={() => setCanvasMode(m)} title={m}
              className={`rounded px-2.5 py-1.5 text-xs font-medium transition-all ${canvasMode === m ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {m === "mobile" ? "📱" : m === "tablet" ? "📟" : "🖥"}
            </button>
          ))}
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom((z) => Math.max(50, z - 10))} className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:bg-gray-100 text-sm transition" title="Zoom out">-</button>
          <span className="text-[11px] font-mono text-gray-500 w-8 text-center">{zoom}%</span>
          <button onClick={() => setZoom((z) => Math.min(150, z + 10))} className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:bg-gray-100 text-sm transition" title="Zoom in">+</button>
        </div>

        <div className="w-px h-6 bg-gray-200 shrink-0" />

        {/* Status badge — reflects server-owned publish flag, not just same-session Publish.
            "Published vN" means the current version is live on the share-token endpoint (when implemented).
            "Draft vN" means only the slug URL (/rsvp/:slug) will show the latest edits. */}
        {isLoadingDesign && <span className="flex items-center gap-1.5 text-xs text-gray-400"><Spinner /> Loading...</span>}
        {!isLoadingDesign && isPublished && !isSaving && !isUploadingForSave && (
          <span
            title="This version is published. Share-token and slug links both serve this design."
            className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
            Published{version !== undefined ? ` v${version}` : ""}
          </span>
        )}
        {!isLoadingDesign && !isPublished && (isSaveSuccess || version !== undefined) && !isSaveError && !isSaving && !isUploadingForSave && (
          <span
            title="Draft saved. Only the slug link (/rsvp/:slug) shows these edits — click Save & Publish to make the share-token preview live."
            className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            Draft{version !== undefined ? ` v${version}` : ""} · slug-only
          </span>
        )}
        {!isLoadingDesign && ((!isSaveSuccess && version === undefined) || isSaveError) && !isSaving && !isUploadingForSave && (
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 font-semibold">Unsaved</span>
        )}

        {/* Preview */}
        <button onClick={() => setShowPreview(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-md text-gray-600 hover:border-primary hover:text-primary transition bg-white">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
          Preview
        </button>

        {/* Share link */}
        <div className="relative">
          <button onClick={() => publicLink ? setShowSharePanel((v) => !v) : generateGuestLink()} disabled={isGeneratingLink}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-md text-gray-600 hover:border-emerald-400 hover:text-emerald-600 transition bg-white disabled:opacity-50">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
            {isGeneratingLink ? "Generating..." : publicLink ? "Guest Link" : "Get Link"}
          </button>
          {/* Share dropdown */}
          {showSharePanel && publicLink && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-gray-200 shadow-xl z-50 p-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-700">Guest RSVP Link</p>
                <button onClick={() => setShowSharePanel(false)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
              </div>
              <p className="text-[11px] text-gray-400 mb-2">Share this link with your guests so they can fill in the RSVP form.</p>
              <div className="flex gap-1.5">
                <input readOnly value={publicLink} className="flex-1 min-w-0 text-[11px] px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-600 font-mono truncate focus:outline-none" />
                <button onClick={copyGuestLink}
                  className={`shrink-0 px-3 py-2 rounded-lg text-[11px] font-semibold transition ${linkCopied ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-primary text-white hover:bg-primary/90"}`}>
                  {linkCopied ? "Copied!" : "Copy"}
                </button>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                <button onClick={() => { generateGuestLink(); }} className="text-[11px] text-gray-400 hover:text-gray-600 underline">
                  Generate new link
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Save */}
        <button onClick={handleSave} disabled={isSaving || isUploadingForSave || isLoadingDesign}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold border border-primary text-primary rounded-md hover:bg-primary/5 disabled:opacity-50 transition bg-white">
          {isSaving || isUploadingForSave ? <><Spinner />&nbsp;Saving...</> : "Save draft"}
        </button>

        {/* Save & Publish */}
        <button onClick={handleSaveAndPublish} disabled={isSaving || isUploadingForSave || isPublishing || isLoadingDesign}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 transition shadow-sm">
          {isPublishing ? <><Spinner />&nbsp;Publishing...</> : "Save & Publish"}
        </button>
      </header>

      {/* ═══ MAIN AREA ═══ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ─── LEFT PANEL ─── */}
        <aside className={`flex flex-col overflow-hidden bg-white border-r border-gray-100 shrink-0 transition-all duration-200 ${leftCollapsed ? "w-0 border-r-0" : ""}`} style={leftCollapsed ? { width: 0 } : { width: 248 }}>
          {/* Tabs */}
          <div className="flex border-b border-gray-100 shrink-0">
            {(["blocks", "layers"] as const).map((tab) => (
              <button key={tab} onClick={() => setLeftTab(tab)}
                className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider transition border-b-2 ${leftTab === tab ? "border-primary text-primary" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
                {tab === "layers" ? `Layers (${blocks.length})` : "Blocks"}
              </button>
            ))}
          </div>

          {/* Search — shown in blocks tab */}
          {leftTab === "blocks" && (
            <div className="px-2 pt-2 pb-1 shrink-0">
              <input type="text" placeholder="Search blocks..." value={blockSearch} onChange={(e) => setBlockSearch(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-primary/50 transition placeholder:text-gray-400" />
            </div>
          )}

          {/* Blocks tab */}
          {leftTab === "blocks" && (
            <div className="flex-1 overflow-y-auto p-2">
              {filteredContentBlocks.length > 0 && (
                <>
                  <button type="button" onClick={() => setContentOpen((o) => !o)}
                    className="flex items-center justify-between w-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors">
                    <span>Content</span>{chevronSvg(contentOpen)}
                  </button>
                  {contentOpen && filteredContentBlocks.map(({ type, icon, label, desc }) => (
                    <BlockItem key={type} icon={icon} label={label} desc={desc} onAdd={() => addBlock(type)} />
                  ))}
                </>
              )}

              {filteredEventBlocks.length > 0 && (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <button type="button" onClick={() => setFromEventOpen((o) => !o)}
                    className="flex items-center justify-between w-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors">
                    <span>From event</span>{chevronSvg(fromEventOpen)}
                  </button>
                  {fromEventOpen && filteredEventBlocks.map(({ type, icon, label, desc }) => (
                    <BlockItem key={type} icon={icon} label={label} desc={desc} onAdd={() => addBlock(type)} />
                  ))}
                </div>
              )}

              {/* Presets */}
              <div className="mt-3 border-t border-gray-100 pt-3">
                <button type="button" onClick={() => setPresetsOpen((o) => !o)}
                  className="flex items-center justify-between w-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors">
                  <span>Presets</span>{chevronSvg(presetsOpen)}
                </button>
                {presetsOpen && (
                  <>
                    <button type="button" onClick={addRsvpFormPreset}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left border border-dashed border-gray-200 hover:border-rose-200 hover:bg-rose-50 cursor-pointer group transition">
                      <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center text-sm shrink-0 group-hover:bg-rose-100 transition">📋</div>
                      <div>
                        <p className="text-[13px] font-medium text-gray-500 group-hover:text-[#c0415a] leading-tight">RSVP Form</p>
                        <p className="text-[10px] text-gray-400">Guest details + questions + submit</p>
                      </div>
                    </button>
                    <label className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left border border-dashed border-gray-200 hover:border-rose-200 hover:bg-rose-50 cursor-pointer group transition mt-1.5">
                      <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center text-sm shrink-0 group-hover:bg-rose-100 transition">📷</div>
                      <div>
                        <p className="text-[13px] font-medium text-gray-500 group-hover:text-[#c0415a] leading-tight">Upload image</p>
                        <p className="text-[10px] text-gray-400">Adds an image block</p>
                      </div>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && handleImageUploadBlock(e.target.files)} />
                    </label>
                  </>
                )}
              </div>

              {blockSearch && filteredContentBlocks.length === 0 && filteredEventBlocks.length === 0 && (
                <div className="px-3 py-6 text-center">
                  <p className="text-xs text-gray-400">No blocks matching "{blockSearch}"</p>
                </div>
              )}
            </div>
          )}

          {/* Layers tab */}
          {leftTab === "layers" && (
            <div className="flex-1 overflow-y-auto p-2">
              {blocks.length === 0 ? (
                <div className="px-3 py-10 text-center">
                  <p className="text-xs text-gray-400 mb-2">No blocks yet.</p>
                  <button onClick={() => setLeftTab("blocks")} className="text-xs font-semibold text-[#c0415a] hover:underline">Add your first block</button>
                </div>
              ) : (
                blocks.map((block, i) => (
                  <LayerRow key={block.id} block={block} index={i}
                    isSelected={selectedId === block.id} isDragging={draggingId === block.id}
                    accentColor={accentColor}
                    onSelect={() => { dispatch({ type: "SELECT", payload: block.id }); setRightTab("block"); }}
                    onDragStart={(e) => { setDraggingId(block.id); e.dataTransfer.setData("text/plain", block.id); }}
                    onDragOver={(e) => { e.preventDefault(); if (draggingId && draggingId !== block.id) reorderBlocks(draggingId, block.id); }}
                    onDragEnd={() => setDraggingId(null)}
                    onMoveUp={() => moveBlock(block.id, "up")}
                    onMoveDown={() => moveBlock(block.id, "down")}
                    onRemove={() => removeBlock(block.id)}
                    onDuplicate={() => duplicateBlock(block.id)}
                  />
                ))
              )}
            </div>
          )}
        </aside>

        {/* Left panel collapse toggle */}
        <button onClick={() => setLeftCollapsed((c) => !c)} title={leftCollapsed ? "Show panel" : "Hide panel"}
          className="self-start mt-3 -ml-px bg-white border border-gray-200 rounded-r-md px-1 py-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition z-10 shadow-sm"
          style={{ marginLeft: leftCollapsed ? 0 : -1 }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {leftCollapsed ? <polyline points="4 2 8 6 4 10" /> : <polyline points="8 2 4 6 8 10" />}
          </svg>
        </button>

        {/* ─── CANVAS ─── */}
        <main className="flex-1 overflow-y-auto" style={{ background: "#eaecf0" }}>
          <div className="p-6 flex flex-col items-center" onClick={(e) => { if (e.target === e.currentTarget) dispatch({ type: "SELECT", payload: null }); }}
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center", transition: "transform 0.2s ease" }}>

            {/* Canvas breadcrumb */}
            <div className="w-full max-w-2xl mb-3 flex items-center justify-between">
              <p className="text-[11px] text-gray-500">
                <span className="font-semibold text-gray-700">{blocks.length}</span> {blocks.length === 1 ? "block" : "blocks"}
                {selectedBlock && <span className="text-primary font-semibold"> · editing <em className="not-italic">{BLOCK_LABEL[selectedBlock.type]}</em></span>}
              </p>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">
                {canvasMode === "mobile" ? "📱 375 px" : canvasMode === "tablet" ? "📟 768 px" : "🖥 Desktop"}
                {cwPx ? ` · content ${cwPx}px` : contentWidth === "full" ? " · content full" : ""}
              </p>
            </div>

            {/* Device frame — size = viewport. contentWidth applied on inner wrapper so canvas matches preview/public exactly. */}
            <div className={`relative transition-all duration-300 overflow-hidden ${canvasClass}`}
              style={{ ...frameBg, minHeight: 700, fontFamily: globalFontFamily || "Georgia, 'Times New Roman', serif" }}
              onClick={(e) => { if (e.currentTarget === e.target) dispatch({ type: "SELECT", payload: null }); }}>

              {/* Global background image/video layer */}
              {globalBackgroundType === "image" && globalBackgroundAsset && (
                <div className="absolute inset-0 bg-cover bg-center pointer-events-none" style={{ backgroundImage: `url(${globalBackgroundAsset})` }} />
              )}
              {globalBackgroundType === "video" && globalBackgroundAsset && (
                <video className="absolute inset-0 w-full h-full object-cover pointer-events-none" src={globalBackgroundAsset} autoPlay loop muted playsInline />
              )}
              {(globalBackgroundType === "image" || globalBackgroundType === "video") && (
                <div className="absolute inset-0 pointer-events-none" style={{ background: `rgba(15,23,42,${globalOverlay})` }} />
              )}

              {/* Blocks — mx-auto + max-w matches preview/public. Device frame = viewport, inner wrapper = content column */}
              <div
                className={`relative z-10 mx-auto flex flex-col ${contentMaxClass}`}
                style={{
                  paddingLeft: blockMarginX,
                  paddingRight: blockMarginX,
                  rowGap: blockMarginY,
                }}
              >
                {blocks.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-28 gap-4" style={{ color: globalIsLight ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.2)" }}>
                    <span className="text-5xl">✦</span>
                    <p className="text-xs text-center leading-relaxed">Add blocks from the left panel<br />to start building your RSVP page</p>
                    <button onClick={() => { setLeftCollapsed(false); setLeftTab("blocks"); }}
                      className="mt-2 px-4 py-2 rounded-lg border text-xs font-semibold transition hover:opacity-80"
                      style={{ borderColor: globalIsLight ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.15)", color: globalIsLight ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)" }}>
                      Open block panel
                    </button>
                  </div>
                )}

                {blocks.map((block, i) => (
                  <V3CanvasBlock
                    key={block.id} block={block}
                    isSelected={selectedId === block.id}
                    accentColor={accentColor} globalIsLight={globalIsLight}
                    event={event} isFirst={i === 0} isLast={i === blocks.length - 1}
                    onSelect={() => { dispatch({ type: "SELECT", payload: block.id }); setRightTab("block"); }}
                    onMoveUp={() => moveBlock(block.id, "up")}
                    onMoveDown={() => moveBlock(block.id, "down")}
                    onRemove={() => removeBlock(block.id)}
                    onDuplicate={() => duplicateBlock(block.id)}
                    onDropAbove={(sourceId) => reorderBlocks(sourceId, block.id)}
                  />
                ))}

                {blocks.length > 0 && (
                  <div className="mx-3 my-3">
                    <button onClick={() => { setLeftCollapsed(false); setLeftTab("blocks"); }}
                      className="w-full py-3 rounded-lg border border-dashed text-xs transition"
                      style={{ borderColor: globalIsLight ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.15)", color: globalIsLight ? "rgba(0,0,0,0.30)" : "rgba(255,255,255,0.30)" }}>
                      + Add block
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* ─── RIGHT PANEL ─── */}
        <aside className="flex flex-col overflow-hidden bg-white border-l border-gray-100 shrink-0" style={{ width: 360 }}>
          <div className="flex border-b border-gray-100 shrink-0">
            {(["block", "page"] as const).map((tab) => (
              <button key={tab} onClick={() => setRightTab(tab)}
                className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider transition border-b-2 ${rightTab === tab ? "border-primary text-primary" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
                {tab === "block" ? "Block" : "Page"}
              </button>
            ))}
          </div>

          {rightTab === "block" && (
            <div className="flex-1 overflow-y-auto">
              {selectedBlock ? (
                <BlockEditor block={selectedBlock} accentColor={accentColor} formFields={availableQuestions}
                  onUpdate={updateBlock} onRemove={removeBlock}
                  onAddBackgroundImages={addBackgroundImagesToBlock} onSetActiveBackground={setActiveBackgroundForBlock}
                  onSetOverlay={setOverlayForBlock} onRemoveBackgroundImage={removeBackgroundImageFromBlock}
                  onSetSectionImage={setSectionImageForBlock} onClearSectionImage={clearSectionImage}
                  onReplaceImage={replaceImageForBlock} onAppendImages={appendImagesToBlock}
                  onApplyQuestion={applyQuestionToBlock} />
              ) : (
                <div className="px-5 py-8 text-center">
                  <div className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center text-lg" style={{ background: "#f5f5f5" }}>✦</div>
                  <p className="text-sm font-semibold text-gray-500 mb-1">No block selected</p>
                  <p className="text-xs text-gray-400 leading-relaxed">Click any block in the canvas to edit its properties here.</p>
                  <div className="mt-5 border-t border-gray-100 pt-4">
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-2 font-semibold">Keyboard shortcuts</p>
                    <div className="text-left space-y-1.5">
                      {[
                        ["Ctrl+Z", "Undo"],
                        ["Ctrl+Y", "Redo"],
                        ["Ctrl+D", "Duplicate block"],
                        ["Delete", "Remove block"],
                        ["Ctrl+S", "Save design"],
                        ["Escape", "Deselect"],
                      ].map(([key, action]) => (
                        <div key={key} className="flex items-center gap-2 text-xs">
                          <kbd className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono text-[10px] border border-gray-200">{key}</kbd>
                          <span className="text-gray-400">{action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => setRightTab("page")} className="mt-4 text-xs font-semibold text-[#c0415a] hover:underline">Edit page settings</button>
                </div>
              )}
            </div>
          )}

          {rightTab === "page" && (
            <div className="flex-1 overflow-y-auto">
              <GlobalSettingsPanel
                globalBackgroundType={globalBackgroundType} globalBackgroundColor={globalBackgroundColor}
                globalOverlay={globalOverlay} accentColor={accentColor} flowPreset={flowPreset}
                globalMusicUrl={globalMusicUrl} submitButtonColor={submitButtonColor}
                submitButtonTextColor={submitButtonTextColor} submitButtonLabel={submitButtonLabel}
                globalFontFamily={globalFontFamily} contentWidth={contentWidth}
                blockMarginX={blockMarginX} blockMarginY={blockMarginY}
                hasBackgroundAsset={!!globalBackgroundAsset}
                onChange={(patch) => dispatch({ type: "SET_GLOBAL", payload: patch as Partial<DesignState> })}
                onUploadBackground={handleBackgroundUpload}
              />
            </div>
          )}
        </aside>
      </div>

      {/* ═══ STATUS BAR ═══ */}
      <footer className="flex items-center px-4 gap-4 shrink-0 border-t border-gray-200" style={{ height: 26, background: "#f8f8fb", fontSize: 11, color: "#aaa" }}>
        <span>{blocks.length} block{blocks.length !== 1 ? "s" : ""}</span>
        <span className="w-px h-3 bg-gray-200" />
        <span>{event?.title ?? "No event"}</span>
        <span className="w-px h-3 bg-gray-200" />
        <span>RSVP Designer V3</span>
        <span className="w-px h-3 bg-gray-200" />
        <span className="text-[10px]">Zoom {zoom}%</span>
        <span className="ml-auto">
          {isSaving || isUploadingForSave
            ? "Saving..."
            : isPublishing
              ? "Publishing..."
              : isPublished
                ? `Published${version !== undefined ? ` v${version}` : ""}`
                : version !== undefined || isSaveSuccess
                  ? `Draft${version !== undefined ? ` v${version}` : ""} · slug link only`
                  : "Unsaved changes"}
        </span>
      </footer>

      {/* ═══ PREVIEW OVERLAY ═══ */}
      {/* ═══ PREVIEW — mirrors the canvas frame exactly ═══ */}
      {showPreview && (
        <div className="fixed inset-0 z-[100] overflow-auto"
          style={{ ...frameBg, fontFamily: globalFontFamily || "Georgia, 'Times New Roman', serif" }}>
          <button onClick={() => setShowPreview(false)}
            className="fixed top-4 right-4 z-[101] flex items-center gap-1.5 rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm hover:bg-black/80 transition">
            Close Preview
          </button>
          {/* Background layers — identical to canvas */}
          {globalBackgroundType === "image" && globalBackgroundAsset && (
            <div className="fixed inset-0 bg-cover bg-center pointer-events-none" style={{ backgroundImage: `url(${globalBackgroundAsset})` }} />
          )}
          {globalBackgroundType === "video" && globalBackgroundAsset && (
            <video className="fixed inset-0 w-full h-full object-cover pointer-events-none" src={globalBackgroundAsset} autoPlay loop muted playsInline />
          )}
          {(globalBackgroundType === "image" || globalBackgroundType === "video") && (
            <div className="fixed inset-0 pointer-events-none" style={{ background: `rgba(15,23,42,${globalOverlay})` }} />
          )}
          {/* Blocks — same width + margins as canvas and public RsvpFormRenderer */}
          <div
            className={`relative z-10 mx-auto flex flex-col ${contentWidth === "compact" ? "max-w-sm" : contentWidth === "standard" ? "max-w-lg" : contentWidth === "wide" ? "max-w-2xl" : ""}`}
            style={{
              paddingLeft: blockMarginX,
              paddingRight: blockMarginX,
              rowGap: blockMarginY,
            }}
          >
            {blocks.map((block) => {
              const sectionImg = block.background?.images?.find((img) => img.id === block.background?.activeImageId) ?? block.background?.images?.[0] ?? block.sectionImage;
              const blockOverlay = block.background?.overlay ?? 0.4;
              const blockIsLight = sectionImg ? false : globalIsLight;
              return (
                <div key={block.id}
                  style={sectionImg?.src ? { backgroundImage: `linear-gradient(rgba(15,23,42,${blockOverlay}),rgba(15,23,42,${blockOverlay})), url(${sectionImg.src})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}>
                  {renderSectionContent(block, accentColor, blockIsLight, event)}
                  <div className="h-px" style={{ background: "rgba(255,255,255,0.04)" }} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
