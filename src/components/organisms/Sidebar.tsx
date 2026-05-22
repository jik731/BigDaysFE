// src/components/organisms/Sidebar.tsx
import React from "react";
import pkg from "../../../package.json";
import { NavLink } from "react-router-dom";
import XIcon from "@heroicons/react/outline/XIcon";
import ChevronLeftIcon from "@heroicons/react/outline/ChevronLeftIcon";
import ChevronRightIcon from "@heroicons/react/outline/ChevronRightIcon";
import LogoutIcon from "@heroicons/react/outline/LogoutIcon";
import UserCircleIcon from "@heroicons/react/outline/UserCircleIcon";

import {
  CalendarIcon,
  ClipboardListIcon,
  ClipboardCheckIcon,
  UserIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  HomeIcon,
  ViewBoardsIcon,
  IdentificationIcon,
  HeartIcon,
  QrcodeIcon,
  QuestionMarkCircleIcon,
  PhotographIcon,
} from "@heroicons/react/solid";
import { Chair, Blueprint } from "@phosphor-icons/react";
import { useEventContext } from "../../context/EventContext";
import { useAuth } from "../../api/hooks/useAuth";
import { getRoleLabel } from "../../utils/jwtUtils";

interface SidebarLink {
  to: string;
  label: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
  end?: boolean;
  sub?: boolean;
  external?: boolean;
  soon?: boolean;
}

const BASE_LINKS: SidebarLink[] = [
  { to: "/app/dashboard", label: "Dashboard", Icon: HomeIcon },
  { to: "/app/events", label: "Events", Icon: CalendarIcon, end: true },
  { to: "/app/rsvps/designer-v3", label: "Design RSVP Card", Icon: PhotographIcon, sub: true, external: true },
  { to: "/app/form-fields", label: "RSVP Questions", Icon: QuestionMarkCircleIcon, sub: true },
  { to: "/app/rsvps", label: "RSVPs", Icon: ClipboardListIcon, end: true },
  { to: "/app/guests", label: "Guests", Icon: UserGroupIcon, sub: true },
  { to: "/app/tables", label: "Tables", Icon: Chair, end: true },
  { to: "/app/tables/floorplan", label: "Floor Plan", Icon: Blueprint, sub: true },
  { to: "/app/wallet", label: "Wallet", Icon: CurrencyDollarIcon },
  { to: "/app/checkin", label: "Check-in", Icon: QrcodeIcon, end: true },
  { to: "/app/checklist", label: "Checklist", Icon: ClipboardCheckIcon },
  { to: "/app/users", label: "Users", Icon: UserIcon },
  { to: "/app/crew", label: "Crew", Icon: IdentificationIcon, sub: true },
];

// Pages accessible to Staff (role 6) only
const STAFF_ALLOWED_PATHS = ["/app/checkin", "/app/guests", "/app/tables"];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { eventId } = useEventContext();
  const { user, userRole, logout } = useAuth();
  const displayRole = userRole != null ? getRoleLabel(userRole) : null;

  const links = BASE_LINKS.map(l =>
    l.label === "RSVP Questions" && eventId
      ? { ...l, to: `/app/events/${eventId}/form-fields` }
      : l
  );

  const isStaff = userRole === 6;
  const visibleLinks = isStaff
    ? links.filter(l => STAFF_ALLOWED_PATHS.some(path => l.to.startsWith(path)))
    : links;

  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <>
      {/* backdrop */}
      <div
        className={`
          fixed inset-0 bg-black/30 z-20 transition-opacity md:hidden
          ${
            isOpen
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          }
        `}
        onClick={onClose}
      />

      {/* panel */}
      <aside
        className={`
          fixed inset-y-0 left-0 w-72 text-text
          bg-background border-r border-primary/10
          dark:bg-slate-900 dark:border-white/10 dark:text-white
          z-30 transform transition-all
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:static md:translate-x-0
          ${collapsed ? "md:w-20" : "md:w-64"}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header: logo + collapse toggle */}
          <div
            className={`flex items-center justify-between px-4 py-4 border-b border-primary/10 dark:border-white/10 ${
              collapsed ? "md:px-3" : "md:px-5"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-secondary text-white grid place-items-center flex-shrink-0">
                <HeartIcon className="h-5 w-5" />
              </div>
              {!collapsed && (
                <span className="text-sm font-semibold tracking-tight">My Big Days</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                className="hidden md:inline-flex p-1.5 rounded-lg text-text/50 hover:text-text hover:bg-primary/5 dark:text-white/40 dark:hover:text-white dark:hover:bg-white/10 transition"
                onClick={() => setCollapsed((c) => !c)}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed ? (
                  <ChevronRightIcon className="h-4 w-4" />
                ) : (
                  <ChevronLeftIcon className="h-4 w-4" />
                )}
              </button>
              <button
                className="md:hidden p-1.5 rounded-lg text-text/50 hover:text-text transition"
                onClick={onClose}
                aria-label="Close sidebar"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Nav links — scrollable middle */}
          <div className={`flex-1 overflow-y-auto py-3 ${collapsed ? "md:px-2" : "px-3"}`} data-tour="sidebar-nav">
            {/* Navigation links */}
            <nav className="space-y-0.5">
              {visibleLinks.map(({ to, label, Icon, end, sub, external, soon }) =>
                soon ? (
                  <div
                    key={to}
                    title={label}
                    className={`flex items-center gap-3 ${
                      collapsed ? "justify-center px-2" : sub ? "pl-8 pr-3" : "px-3"
                    } ${sub ? "py-2" : "py-2.5"} rounded-lg ${sub ? "text-xs" : "text-sm"}
                     text-text/30 dark:text-white/25 cursor-not-allowed select-none`}
                  >
                    <Icon className={`${sub ? "h-4 w-4" : "h-5 w-5"} flex-shrink-0`} />
                    {!collapsed && (
                      <>
                        <span>{label}</span>
                        <span className="ml-auto text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                          Soon
                        </span>
                      </>
                    )}
                  </div>
                ) : external ? (
                  <a
                    key={to}
                    href={to}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={label}
                    onClick={onClose}
                    className={`group flex items-center gap-3 ${
                      collapsed ? "justify-center px-2" : sub ? "pl-8 pr-3" : "px-3"
                    } ${sub ? "py-2" : "py-2.5"} rounded-lg transition-colors ${sub ? "text-xs" : "text-sm"}
                     text-text/70 hover:bg-primary/5 hover:text-text dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white`}
                  >
                    <Icon className={`${sub ? "h-4 w-4" : "h-5 w-5"} flex-shrink-0`} />
                    {!collapsed && <span>{label}</span>}
                  </a>
                ) : (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    title={label}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 ${
                        collapsed ? "justify-center px-2" : sub ? "pl-8 pr-3" : "px-3"
                      } ${sub ? "py-2" : "py-2.5"} rounded-lg transition-colors ${sub ? "text-xs" : "text-sm"}
                       ${
                         isActive
                           ? "bg-primary/10 text-primary font-semibold dark:bg-primary/20 dark:text-primary"
                           : "text-text/70 hover:bg-primary/5 hover:text-text dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white"
                       }`
                    }
                  >
                    <Icon className={`${sub ? "h-4 w-4" : "h-5 w-5"} flex-shrink-0`} />
                    {!collapsed && <span>{label}</span>}
                  </NavLink>
                )
              )}
            </nav>
          </div>

          {/* Footer: user profile + logout + version */}
          <div className="border-t border-primary/10 dark:border-white/10 p-3">
            {!collapsed ? (
              <div className="flex items-center gap-3 px-2 py-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 dark:bg-white/10 grid place-items-center flex-shrink-0">
                  <UserCircleIcon className="h-5 w-5 text-primary dark:text-white/70" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.email ?? ""}</p>
                  {displayRole && <p className="text-xs text-text/50 dark:text-white/40 truncate">{displayRole}</p>}
                </div>
                <button
                  onClick={logout}
                  className="p-1.5 rounded-lg text-text/40 hover:text-red-500 hover:bg-red-50 dark:text-white/30 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition"
                  aria-label="Logout"
                >
                  <LogoutIcon className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={logout}
                className="w-full flex justify-center p-2 rounded-lg text-text/40 hover:text-red-500 hover:bg-red-50 dark:text-white/30 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition"
                aria-label="Logout"
              >
                <LogoutIcon className="h-5 w-5" />
              </button>
            )}
            {!collapsed && (
              <p className="text-center text-[10px] text-text/25 dark:text-white/20 mt-1 tabular-nums select-none">
                v{pkg.version}
              </p>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
