// src/components/organisms/Navbar.tsx
import { useTheme } from "../../context/ThemeContext";
import MenuIcon from "@heroicons/react/outline/MenuIcon";
import { Palette } from "@phosphor-icons/react";
import { EventSwitcher } from "../molecules/EventSwitcher";

export function Navbar({
  onMenuToggle,
}: {
  onMenuToggle?: () => void;
}) {
  const { palette, toggle } = useTheme();
  const nextLabel = palette === "rose" ? "Slate" : "Rose";

  return (
    <header className="sticky top-0 z-40 flex items-center gap-4 px-4 md:px-6 py-3 bg-background/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-primary/10 dark:border-white/10">
      {/* Left: hamburger (mobile) + event switcher */}
      <div className="flex items-center gap-3 min-w-0">
        {onMenuToggle && (
          <button
            className="md:hidden p-2 rounded-lg text-text/70 hover:bg-primary/5 dark:text-white/70 dark:hover:bg-white/10 transition flex-shrink-0"
            onClick={onMenuToggle}
            aria-label="Toggle sidebar"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
        )}
        <div data-tour="event-switcher">
          <EventSwitcher />
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right: palette toggle (Rose ⇄ Slate) */}
      <button
        onClick={toggle}
        aria-label={`Switch to ${nextLabel} palette`}
        title={`Switch to ${nextLabel}`}
        className="p-2 rounded-lg text-text/50 hover:text-text hover:bg-primary/5 transition flex-shrink-0"
      >
        <Palette className="h-5 w-5" weight={palette === "slate" ? "fill" : "regular"} />
      </button>
    </header>
  );
}
