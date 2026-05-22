import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";

type Palette = "rose" | "slate";
interface PCtx {
  palette: Palette;
  toggle: () => void;
}

const STORAGE_KEY = "palette";

const PaletteContext = createContext<PCtx>({ palette: "rose", toggle: () => {} });
export const useTheme = () => useContext(PaletteContext);

function readInitial(): Palette {
  try {
    return localStorage.getItem(STORAGE_KEY) === "slate" ? "slate" : "rose";
  } catch {
    return "rose";
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [palette, setPalette] = useState<Palette>(readInitial);
  const toggle = () => setPalette((p) => (p === "rose" ? "slate" : "rose"));

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("slate", palette === "slate");
    // Ensure legacy dark mode is never lingering after this migration.
    root.classList.remove("dark");
    try {
      localStorage.setItem(STORAGE_KEY, palette);
    } catch {}
  }, [palette]);

  return (
    <PaletteContext.Provider value={{ palette, toggle }}>
      {children}
    </PaletteContext.Provider>
  );
}
