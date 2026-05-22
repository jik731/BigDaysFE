import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import QuestionMarkCircleIcon from "@heroicons/react/solid/QuestionMarkCircleIcon";
import { useTour } from "../tour/useTour";
import { findTourForPath } from "../tour/tours";

const HINT_STORAGE_KEY = "mbd_help_bubble_hint_seen";

export function HelpBubble() {
  const [open, setOpen] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { startTourForRoute } = useTour();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const tour = findTourForPath(location.pathname);
  const hasTour = !!tour;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close the popover whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // First-time hint: show a callout next to the bubble until the user dismisses
  // it or interacts with the bubble. Persisted in localStorage so we never show
  // it again on this device.
  useEffect(() => {
    try {
      if (localStorage.getItem(HINT_STORAGE_KEY) === "1") return;
    } catch {
      return;
    }
    const t = window.setTimeout(() => setHintVisible(true), 1200);
    return () => window.clearTimeout(t);
  }, []);

  const dismissHint = () => {
    setHintVisible(false);
    try {
      localStorage.setItem(HINT_STORAGE_KEY, "1");
    } catch {
      /* ignore quota / private mode */
    }
  };

  const handleTakeTour = () => {
    if (!tour) return;
    setOpen(false);
    startTourForRoute(tour.routePath);
  };

  const handleBrowse = () => {
    setOpen(false);
    navigate("/app/tutorial");
  };

  const handleBubbleClick = () => {
    if (hintVisible) dismissHint();
    setOpen((o) => !o);
  };

  const showHint = hintVisible && !open;

  return (
    <div className="fixed bottom-6 right-6 z-40" data-tour="help-bubble">
      {showHint && (
        <div className="absolute bottom-full right-0 mb-3 w-72 rounded-xl shadow-xl bg-white dark:bg-accent border border-primary/30 overflow-hidden">
          <div className="p-4 flex items-start gap-3">
            <div className="text-2xl flex-shrink-0" aria-hidden>👋</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text dark:text-white">
                Welcome to MyBigDays!
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Need a hand? Tap this <span className="font-semibold text-primary">?</span> button anytime to take a tour or browse tutorials.
              </p>
              <button
                type="button"
                onClick={dismissHint}
                className="mt-2 text-xs font-semibold text-primary hover:underline"
              >
                Got it
              </button>
            </div>
            <button
              type="button"
              onClick={dismissHint}
              aria-label="Dismiss hint"
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 -mt-1 -mr-1 p-1 text-xs leading-none transition"
            >
              ✕
            </button>
          </div>
          {/* arrow pointing down to the bubble */}
          <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-white dark:bg-accent border-r border-b border-primary/30 rotate-45" />
        </div>
      )}
      {open && (
        <div
          ref={menuRef}
          className="absolute bottom-full right-0 mb-3 w-64 rounded-xl shadow-xl bg-white dark:bg-accent border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Need help?
            </p>
          </div>
          <button
            type="button"
            onClick={handleTakeTour}
            disabled={!hasTour}
            className="w-full text-left px-4 py-3 text-sm text-text dark:text-gray-200 hover:bg-primary/10 dark:hover:bg-white/10 transition-colors disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:disabled:hover:bg-transparent flex items-center gap-2"
          >
            <span className="flex-1">Take a tour of this page</span>
            {!hasTour && (
              <span className="text-[10px] font-semibold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full">
                N/A
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={handleBrowse}
            className="w-full text-left px-4 py-3 text-sm text-text dark:text-gray-200 hover:bg-primary/10 dark:hover:bg-white/10 transition-colors"
          >
            Browse all tutorials
          </button>
          <button
            type="button"
            disabled
            className="w-full text-left px-4 py-3 text-sm text-gray-400 dark:text-gray-500 cursor-not-allowed flex items-center gap-2"
          >
            <span className="flex-1">Contact support</span>
            <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
              Soon
            </span>
          </button>
        </div>
      )}
      <div className="relative">
        {showHint && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full bg-primary/40 animate-ping"
          />
        )}
        <button
          ref={buttonRef}
          type="button"
          onClick={handleBubbleClick}
          aria-label={open ? "Close help" : "Open help"}
          className="relative h-14 w-14 rounded-full bg-gradient-to-br from-primary to-secondary text-white shadow-xl shadow-primary/30 grid place-items-center hover:scale-105 active:scale-95 transition focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2"
        >
          <QuestionMarkCircleIcon className="h-7 w-7" />
        </button>
      </div>
    </div>
  );
}
