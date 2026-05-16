import { useSyncExternalStore } from "react";

const subscribe = (query: string) => (callback: () => void) => {
  const mql = window.matchMedia(query);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
};

const getSnapshot = (query: string) => () => window.matchMedia(query).matches;

const getServerSnapshot = () => false;

export function useIsMobile(query = "(max-width: 767px)"): boolean {
  return useSyncExternalStore(
    subscribe(query),
    getSnapshot(query),
    getServerSnapshot
  );
}
