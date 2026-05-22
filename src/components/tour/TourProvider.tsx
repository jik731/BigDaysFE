import { createContext, useCallback, useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Joyride, STATUS, type EventHandler } from "react-joyride";
import { getTourByRoute, findTourForPath, type TourDefinition } from "./tours";

interface TourContextValue {
  startTourForRoute: (routePath: string) => void;
  activeTour: TourDefinition | null;
  hasTourForPath: (pathname: string) => boolean;
}

export const TourContext = createContext<TourContextValue | null>(null);

const TOUR_QUERY_KEY = "tour";

export function TourProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTour, setActiveTour] = useState<TourDefinition | null>(null);
  const [run, setRun] = useState(false);

  const startTourForRoute = useCallback((routePath: string) => {
    const tour = getTourByRoute(routePath);
    if (!tour) return;
    setActiveTour(tour);
    setRun(true);
  }, []);

  // Auto-start a tour when navigating with ?tour=1 (used by TutorialPage cards).
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    if (sp.get(TOUR_QUERY_KEY) !== "1") return;

    const tour = findTourForPath(location.pathname);
    sp.delete(TOUR_QUERY_KEY);
    navigate(
      { pathname: location.pathname, search: sp.toString() ? `?${sp}` : "" },
      { replace: true }
    );

    if (tour) {
      // Small delay so the destination page has rendered its data-tour targets.
      const handle = window.setTimeout(() => {
        setActiveTour(tour);
        setRun(true);
      }, 300);
      return () => window.clearTimeout(handle);
    }
  }, [location.pathname, location.search, navigate]);

  const handleEvent: EventHandler = (data) => {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      setRun(false);
      setActiveTour(null);
    }
  };

  const hasTourForPath = useCallback(
    (pathname: string) => !!findTourForPath(pathname),
    []
  );

  return (
    <TourContext.Provider value={{ startTourForRoute, activeTour, hasTourForPath }}>
      {activeTour && (
        <Joyride
          steps={activeTour.steps}
          run={run}
          continuous
          onEvent={handleEvent}
          locale={{
            back: "Back",
            close: "Close",
            last: "Done",
            next: "Next",
            open: "Open",
            skip: "Skip tour",
          }}
          options={{
            primaryColor: "#6366f1",
            zIndex: 10000,
            arrowColor: "#ffffff",
            backgroundColor: "#ffffff",
            textColor: "#1f2937",
            overlayColor: "rgba(15, 23, 42, 0.55)",
            showProgress: true,
            skipBeacon: true,
            buttons: ["back", "skip", "primary"],
          }}
          styles={{
            tooltip: {
              borderRadius: 12,
              padding: 16,
            },
            tooltipTitle: {
              fontSize: 16,
              fontWeight: 600,
            },
            tooltipContent: {
              fontSize: 14,
              lineHeight: 1.5,
              padding: "8px 0",
            },
            buttonPrimary: {
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              padding: "8px 14px",
            },
            buttonBack: {
              fontSize: 13,
              color: "#6b7280",
            },
            buttonSkip: {
              fontSize: 13,
              color: "#6b7280",
            },
          }}
        />
      )}
      {children}
    </TourContext.Provider>
  );
}
