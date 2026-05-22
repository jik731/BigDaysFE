import { Component, useEffect, useMemo, useRef, useState, type ReactNode, type ErrorInfo } from "react";
import { useCheckInScanApi, useForceCheckInApi, useQrListApi, useUndoCheckInApi } from "../../../api/hooks/useQrApi";
import { useGuestsApi } from "../../../api/hooks/useGuestsApi";
import type { CheckInErrorCode, CheckInResult } from "../../../types/qr";
import { Button } from "../../atoms/Button";
import { QrcodeIcon, UserGroupIcon } from "@heroicons/react/solid";
import { useEventContext } from "../../../context/EventContext";
import { PageLoader } from "../../atoms/PageLoader";
import { NoEventsState } from "../../molecules/NoEventsState";
import toast from "react-hot-toast";

type ScanState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; result: CheckInResult; at: number }
  | { status: "error"; code: CheckInErrorCode | "UNKNOWN"; at: number };

interface RecentScan {
  id: string;
  guestName: string;
  noOfPax: number;
  at: number;
  token: string;
}

const errorMessages: Record<CheckInErrorCode | "UNKNOWN", string> = {
  ALREADY_CHECKED_IN: "Already checked in",
  TOKEN_REVOKED: "QR code has been revoked",
  WRONG_DAY: "QR not valid today",
  TOKEN_NOT_FOUND: "Unknown QR code",
  UNKNOWN: "Unexpected error — try again",
};

function mapError(err: unknown): CheckInErrorCode | "UNKNOWN" {
  const e = err as { response?: { status?: number; data?: { errorCode?: string; message?: string } } };
  const code = e?.response?.data?.errorCode;
  if (code === "ALREADY_CHECKED_IN" || code === "TOKEN_REVOKED" || code === "WRONG_DAY" || code === "TOKEN_NOT_FOUND") {
    return code;
  }
  const status = e?.response?.status;
  const message = (e?.response?.data?.message ?? "").toLowerCase();
  if (status === 404) return "TOKEN_NOT_FOUND";
  if (status === 422) {
    if (message.includes("revoke")) return "TOKEN_REVOKED";
    return "ALREADY_CHECKED_IN";
  }
  return "UNKNOWN";
}

function beep(frequency: number, duration = 120) {
  try {
    const AC: typeof AudioContext = (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => { osc.stop(); ctx.close().catch(() => {}); }, duration);
  } catch { /* ignore */ }
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try { navigator.vibrate(pattern); } catch { /* ignore */ }
  }
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

class CameraErrorBoundary extends Component<
  { children: ReactNode; onReset: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError(): { hasError: boolean } { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Camera error:", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border-2 border-red-400 dark:border-red-600 p-6 text-center">
          <p className="text-4xl mb-2">📷</p>
          <p className="text-lg font-semibold text-red-800 dark:text-red-300 mb-4">Camera encountered an error</p>
          <Button variant="secondary" onClick={() => { this.setState({ hasError: false }); this.props.onReset(); }}>
            Restart Camera
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function CheckInPage() {
  const { eventId, eventsLoading } = useEventContext();
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const [scanState, setScanState] = useState<ScanState>({ status: "idle" });
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const [query, setQuery] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [submittingGuestId, setSubmittingGuestId] = useState<string | null>(null);
  const [forceGuestId, setForceGuestId] = useState<string | null>(null);
  const [undoGuestId, setUndoGuestId] = useState<string | null>(null);
  const [undoRecentId, setUndoRecentId] = useState<string | null>(null);

  const checkIn = useCheckInScanApi(eventId ?? "");
  const forceCheckIn = useForceCheckInApi(eventId ?? "");
  const undoCheckIn = useUndoCheckInApi();
  const { data: qrTokens = [] } = useQrListApi(eventId ?? "");
  const { data: guests = [], isLoading: guestsLoading } = useGuestsApi(eventId ?? "");

  const isProcessing = useRef(false);
  const resetTimer = useRef<number | null>(null);
  const checkInRef = useRef(checkIn.mutateAsync.bind(checkIn));
  useEffect(() => { checkInRef.current = checkIn.mutateAsync.bind(checkIn); });

  const tokenByGuestId = useMemo(() => {
    const m = new Map<string, (typeof qrTokens)[number]>();
    for (const t of qrTokens) m.set(t.guestId, t);
    return m;
  }, [qrTokens]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? guests.filter((g) => {
          const name = (g.name ?? "").toLowerCase();
          const phone = (g.phoneNo ?? "").toLowerCase();
          return name.includes(q) || phone.includes(q);
        })
      : guests;
    return [...list]
      .sort((a, b) => {
        const aIn = tokenByGuestId.get(a.id)?.checkedInAt != null ? 1 : 0;
        const bIn = tokenByGuestId.get(b.id)?.checkedInAt != null ? 1 : 0;
        return aIn - bIn;
      })
      .slice(0, 25);
  }, [guests, query, tokenByGuestId]);

  const stats = useMemo(() => {
    const totalGuests = guests.length;
    const totalPax = guests.reduce((s, g) => s + (g.pax ?? 1), 0);
    const checkedInTokens = qrTokens.filter((t) => t.checkedInAt !== null);
    const checkedInGuestIds = new Set(checkedInTokens.map((t) => t.guestId));
    const checkedInPax = guests
      .filter((g) => checkedInGuestIds.has(g.id))
      .reduce((s, g) => s + (g.pax ?? 1), 0);
    return { totalGuests, totalPax, checkedInGuests: checkedInGuestIds.size, checkedInPax };
  }, [guests, qrTokens]);

  useEffect(() => {
    if (!cameraActive || !eventId) return;
    setCameraError(null);
    let scanner: { stop: () => Promise<void> } | null = null;

    import("html5-qrcode").then(({ Html5Qrcode }) => {
      let instance: InstanceType<typeof Html5Qrcode>;
      try {
        instance = new Html5Qrcode("qr-reader");
      } catch {
        setCameraError("Could not initialize camera scanner.");
        setCameraActive(false);
        return;
      }
      scanner = instance;
      scannerRef.current = instance;

      instance
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decodedText: string) => {
            if (isProcessing.current) return;
            isProcessing.current = true;
            setScanState({ status: "loading" });
            try {
              const result = await checkInRef.current(decodedText);
              const at = Date.now();
              setScanState({ status: "success", result, at });
              setRecentScans((prev) => [
                { id: `${at}-${decodedText}`, guestName: result.guestName, noOfPax: result.noOfPax, at, token: decodedText },
                ...prev,
              ].slice(0, 10));
              beep(880, 150);
              vibrate(80);
              resetTimer.current = window.setTimeout(() => {
                setScanState({ status: "idle" });
                isProcessing.current = false;
              }, 2000);
            } catch (err: unknown) {
              setScanState({ status: "error", code: mapError(err), at: Date.now() });
              beep(220, 200);
              vibrate([80, 60, 80]);
              resetTimer.current = window.setTimeout(() => {
                setScanState({ status: "idle" });
                isProcessing.current = false;
              }, 1200);
            }
          },
          () => {}
        )
        .catch((err: unknown) => {
          const msg = (err as { message?: string })?.message ?? "";
          setCameraError(
            msg.includes("Permission")
              ? "Camera permission denied. Please allow camera access and try again."
              : "Could not start camera. Make sure you are on HTTPS and camera is not in use."
          );
          setCameraActive(false);
        });
    }).catch(() => {
      setCameraError("Could not load camera scanner. Please try again.");
      setCameraActive(false);
    });

    return () => {
      if (scanner) { try { scanner.stop().catch(() => {}); } catch { /* ignore */ } }
      if (resetTimer.current) { window.clearTimeout(resetTimer.current); resetTimer.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraActive, eventId]);

  if (eventsLoading) return <PageLoader message="Loading..." />;
  if (!eventId) return <NoEventsState title="No Event Selected" message="Select or create an event to start checking in guests." />;

  function handleStopCamera() {
    setCameraActive(false);
    setScanState({ status: "idle" });
    isProcessing.current = false;
  }

  async function handleManualCheckIn(guestId: string) {
    setManualError(null);
    const tokenRec = tokenByGuestId.get(guestId);
    if (!tokenRec) { setManualError("No QR token for this guest."); return; }
    setSubmittingGuestId(guestId);
    try {
      const result = await checkIn.mutateAsync(tokenRec.token);
      const at = Date.now();
      setRecentScans((prev) => [
        { id: `${at}-${guestId}`, guestName: result.guestName, noOfPax: result.noOfPax, at, token: tokenRec.token },
        ...prev,
      ].slice(0, 10));
      beep(880, 150);
      vibrate(80);
      toast.success(`${result.guestName} · ${result.noOfPax} pax checked in`);
    } catch (err) {
      setManualError(errorMessages[mapError(err)]);
    } finally {
      setSubmittingGuestId(null);
    }
  }

  async function handleForceCheckIn(guestId: string) {
    setManualError(null);
    setForceGuestId(guestId);
    try {
      const result = await forceCheckIn.mutateAsync(guestId);
      const at = Date.now();
      setRecentScans((prev) => [
        { id: `${at}-${guestId}`, guestName: result.guestName, noOfPax: result.noOfPax, at, token: result.token },
        ...prev,
      ].slice(0, 10));
      beep(880, 150);
      vibrate(80);
      toast.success(`${result.guestName} · ${result.noOfPax} pax checked in`);
    } catch {
      setManualError("Force check-in failed — try again.");
    } finally {
      setForceGuestId(null);
    }
  }

  async function handleUndoGuest(guestId: string) {
    const tokenRec = tokenByGuestId.get(guestId);
    if (!tokenRec) return;
    setUndoGuestId(guestId);
    try {
      await undoCheckIn.mutateAsync({ token: tokenRec.token, eventId: eventId! });
    } catch { /* silently ignore */ } finally {
      setUndoGuestId(null);
    }
  }

  async function handleUndoRecent(scanId: string, token: string) {
    setUndoRecentId(scanId);
    try {
      await undoCheckIn.mutateAsync({ token, eventId: eventId! });
      setRecentScans((prev) => prev.filter((s) => s.id !== scanId));
    } catch { /* silently ignore */ } finally {
      setUndoRecentId(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-6">
      <div data-tour="checkin-header">
        <h1 className="text-3xl font-display font-semibold text-primary">Guest Check-in</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Scan QR codes or manually check in guests</p>
      </div>

      {/* Stats */}
      <div data-tour="checkin-stats" className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-900/20 p-3">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-300">Checked In</p>
          <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200 leading-tight">
            {stats.checkedInGuests}
            <span className="text-sm font-medium text-emerald-700/70 dark:text-emerald-300/70"> / {stats.totalGuests}</span>
          </p>
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 mt-0.5">
            {stats.checkedInPax} / {stats.totalPax} pax
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/20 p-3">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-amber-700 dark:text-amber-300">Remaining</p>
          <p className="text-2xl font-bold text-amber-800 dark:text-amber-200 leading-tight">
            {Math.max(0, stats.totalGuests - stats.checkedInGuests)}
          </p>
          <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-0.5">
            {Math.max(0, stats.totalPax - stats.checkedInPax)} pax
          </p>
        </div>
      </div>

      {/* ── Main grid: QR left, Manual right ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">

        {/* QR Scanner card */}
        <CameraErrorBoundary onReset={handleStopCamera}>
          <div data-tour="checkin-scanner" className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-1">
              <QrcodeIcon className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">QR Scan</h2>
            </div>

            <Button
              variant={cameraActive ? "secondary" : "primary"}
              onClick={() => cameraActive ? handleStopCamera() : setCameraActive(true)}
            >
              {cameraActive ? "Stop Camera" : "Start Camera"}
            </Button>

            {cameraActive && (
              <div id="qr-reader" className="rounded-xl overflow-hidden border border-gray-200 dark:border-white/10" />
            )}

            {cameraError && (
              <div className="rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-400 p-3 text-center text-yellow-800 dark:text-yellow-300 text-sm">
                {cameraError}
              </div>
            )}

            {scanState.status === "idle" && (
              <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 py-10 flex flex-col items-center gap-3 text-gray-400 dark:text-gray-500">
                <QrcodeIcon className="h-10 w-10 text-gray-200 dark:text-gray-700" />
                <p className="text-sm">
                  {cameraActive ? "Point camera at a QR code" : "Tap Start Camera to begin"}
                </p>
              </div>
            )}

            {scanState.status === "loading" && (
              <div className="rounded-xl bg-gray-50 dark:bg-gray-700/50 py-8 text-center text-sm text-gray-500 dark:text-gray-400 animate-pulse">
                Validating…
              </div>
            )}

            {scanState.status === "success" && (
              <div className="rounded-2xl bg-green-50 dark:bg-green-900/20 border-2 border-green-400 dark:border-green-600 p-6 text-center">
                <p className="text-5xl mb-3">✅</p>
                <p className="text-3xl font-bold text-green-800 dark:text-green-200 leading-tight">
                  {scanState.result.guestName}
                </p>
                <p className="text-base text-green-600 dark:text-green-400 mt-2 font-semibold">
                  {scanState.result.noOfPax} {scanState.result.noOfPax === 1 ? "person" : "pax"}
                </p>
                <p className="text-xs text-green-500/60 dark:text-green-400/40 mt-3">Clearing in 2s…</p>
              </div>
            )}

            {scanState.status === "error" && (
              <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 border-2 border-red-400 dark:border-red-600 p-5 text-center">
                <p className="text-4xl mb-2">❌</p>
                <p className="text-lg font-semibold text-red-800 dark:text-red-300">
                  {errorMessages[scanState.code]}
                </p>
              </div>
            )}
          </div>
        </CameraErrorBoundary>

        {/* Manual card */}
        <div data-tour="checkin-manual" className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-700/60 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <UserGroupIcon className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Manual</h2>
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setManualError(null); }}
              placeholder="Search by name or phone…"
              className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-gray-100 placeholder:text-gray-400"
            />
            {manualError && (
              <p className="text-xs text-red-600 dark:text-red-400">{manualError}</p>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-100 dark:divide-white/5">
            {guestsLoading && (
              <p className="py-8 text-center text-sm text-gray-400">Loading guests…</p>
            )}
            {!guestsLoading && filtered.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-400">
                {query ? "No matches found." : "No guests yet."}
              </p>
            )}
            {!guestsLoading && filtered.map((g) => {
              const tokenRec = tokenByGuestId.get(g.id);
              const checkedIn = tokenRec?.checkedInAt != null;
              const revoked = tokenRec?.isRevoked === true;
              const noToken = !tokenRec;
              const submitting = submittingGuestId === g.id;
              const forcing = forceGuestId === g.id;
              const undoingGuest = undoGuestId === g.id;
              const name = g.name ?? "—";

              return (
                <div key={g.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium truncate ${checkedIn ? "text-gray-400 dark:text-gray-500" : "text-gray-800 dark:text-gray-100"}`}>
                      {name}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                      {g.phoneNo || "No phone"} · {g.pax ?? 1} pax
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {checkedIn ? (
                      <>
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          In ✓
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUndoGuest(g.id)}
                          disabled={undoingGuest}
                          className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800/40 disabled:opacity-50 transition-colors"
                        >
                          {undoingGuest ? "…" : "Undo"}
                        </button>
                      </>
                    ) : revoked ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                        Revoked
                      </span>
                    ) : noToken ? (
                      <button
                        type="button"
                        onClick={() => handleForceCheckIn(g.id)}
                        disabled={forcing}
                        className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-800/40 disabled:opacity-50 transition-colors"
                      >
                        {forcing ? "Generating…" : "No QR · Force ↑"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleManualCheckIn(g.id)}
                        disabled={submitting}
                        className="text-[11px] px-2.5 py-0.5 rounded-full font-medium bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
                      >
                        {submitting ? "Checking…" : "Check in"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent check-ins */}
      {recentScans.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
            Recent — {recentScans.length}
          </h3>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {recentScans.map((s) => (
              <li key={s.id} className="py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{s.guestName}</p>
                  <p className="text-[11px] text-gray-400">{s.noOfPax} pax · {formatTime(s.at)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleUndoRecent(s.id, s.token)}
                  disabled={undoRecentId === s.id}
                  className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800/40 disabled:opacity-50 transition-colors flex-shrink-0"
                >
                  {undoRecentId === s.id ? "Undoing…" : "Undo"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
