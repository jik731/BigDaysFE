// Tour definitions for the in-app help walkthroughs.
// Targets reference DOM via stable `data-tour="<page>-<element>"` attributes —
// never use CSS classes here (refactor-safe; greppable).
import type { Step } from "react-joyride";

export type TourIconKey =
  | "home"
  | "calendar"
  | "rsvps"
  | "questions"
  | "guests"
  | "tables"
  | "floorplan"
  | "wallet"
  | "checkin"
  | "users"
  | "crew";

export interface TourDefinition {
  routePath: string;
  /** Optional regex to match additional pathnames that should trigger this tour. */
  pathPattern?: RegExp;
  title: string;
  description: string;
  icon: TourIconKey;
  steps: Step[];
}

const commonStepProps: Partial<Step> = {};

export const TOURS: TourDefinition[] = [
  {
    routePath: "/app/dashboard",
    title: "Dashboard",
    description:
      "Your event command centre — countdown, key stats, quick actions and recent activity all in one place.",
    icon: "home",
    steps: [
      {
        ...commonStepProps,
        target: '[data-tour="event-switcher"]',
        title: "Change your active event",
        content:
          "Plan more than one big day? Use this dropdown to switch between events — everything on screen updates to the one you pick.",
        placement: "bottom",
      },
      {
        ...commonStepProps,
        target: '[data-tour="dashboard-spotlight"]',
        title: "Active event",
        content:
          "The currently selected event with a live countdown to the big day. Use the event switcher above to view a different one.",
      },
      {
        ...commonStepProps,
        target: '[data-tour="dashboard-stats"]',
        title: "Key stats at a glance",
        content:
          "RSVP responses, budget usage and seating progress. Use the link at the bottom of each card to jump into that area.",
      },
      {
        ...commonStepProps,
        target: '[data-tour="dashboard-quick-actions"]',
        title: "Quick actions",
        content:
          "Shortcuts to the things you do most — add an RSVP, send invites, arrange seats or check in guests.",
      },
      {
        ...commonStepProps,
        target: '[data-tour="dashboard-recent-activity"]',
        title: "Recent activity",
        content:
          "Live feed of what's happening with your event — new RSVPs, gifts received, check-ins and more. Keep tabs on momentum at a glance.",
      },
      {
        ...commonStepProps,
        target: '[data-tour="help-bubble"]',
        title: "Need help again later?",
        content:
          "Click this bubble anytime to take a tour of the page you're on, or browse all tutorials.",
        placement: "left",
      },
    ],
  },
  {
    routePath: "/app/events",
    title: "Events",
    description:
      "Create, edit and archive your events. The 'active' event drives everything else — RSVPs, guests, tables and wallet.",
    icon: "calendar",
    steps: [
      {
        ...commonStepProps,
        target: '[data-tour="events-stats"]',
        title: "Event stats",
        content:
          "Quick view of how many events are active, archived and which one is coming up next.",
      },
      {
        ...commonStepProps,
        target: '[data-tour="events-search"]',
        title: "Find an event fast",
        content:
          "Search by name or location, and sort by upcoming, recent or alphabetical.",
      },
      {
        ...commonStepProps,
        target: '[data-tour="events-list"]',
        title: "Pick your active event",
        content:
          'Click "Select →" on any event card to make it active. The whole app then reflects that event.',
      },
    ],
  },
  {
    routePath: "/app/rsvps",
    title: "RSVPs",
    description:
      "Track guest responses, design your RSVP card and import or export your guest list.",
    icon: "rsvps",
    steps: [
      {
        ...commonStepProps,
        target: '[data-tour="rsvps-actions"]',
        title: "Add, import or export",
        content:
          "Add an RSVP manually, import a CSV/XLSX of guests, or export everything to a spreadsheet.",
      },
      {
        ...commonStepProps,
        target: '[data-tour="rsvps-stats"]',
        title: "Totals",
        content:
          "Total RSVPs received and total pax (number of people) coming.",
      },
      {
        ...commonStepProps,
        target: '[data-tour="rsvps-search"]',
        title: "Search guests",
        content:
          "Find a specific guest by typing their name.",
      },
    ],
  },
  {
    routePath: "/app/form-fields",
    pathPattern: /^\/app\/(form-fields|events\/[^/]+\/form-fields)\/?$/,
    title: "RSVP Questions",
    description:
      "Customise the questions on your RSVP form — start from a template or write your own.",
    icon: "questions",
    steps: [
      {
        ...commonStepProps,
        target: '[data-tour="formfields-actions"]',
        title: "Add questions",
        content:
          'Tap "Add from Template" for ready-made questions (dietary, session, etc.) or "+ New Field" to write your own.',
      },
      {
        ...commonStepProps,
        target: '[data-tour="formfields-list"]',
        title: "Manage each question",
        content:
          "Edit a question, deactivate it to hide it from the form (existing answers are kept), or delete it permanently.",
      },
    ],
  },
  {
    routePath: "/app/guests",
    title: "Guests",
    description:
      "Your guest list — assign tables, generate QR codes and send WhatsApp invites.",
    icon: "guests",
    steps: [
      {
        ...commonStepProps,
        target: '[data-tour="guests-generate-qr"]',
        title: "Generate QR codes",
        content:
          "Generate a unique QR code for every guest at once. Guests use it to self check-in on the day.",
      },
      {
        ...commonStepProps,
        target: '[data-tour="guests-stats"]',
        title: "Assignment overview",
        content:
          "See at a glance how many guests are seated and how many still need a table.",
      },
      {
        ...commonStepProps,
        target: '[data-tour="guests-filters"]',
        title: "Filter and search",
        content:
          "Filter by guest type, assignment status, or search by name.",
      },
    ],
  },
  {
    routePath: "/app/tables",
    title: "Tables",
    description:
      "Arrange seating with drag-and-drop. Auto-assign guests or build your layout manually.",
    icon: "tables",
    steps: [
      {
        ...commonStepProps,
        target: '[data-tour="tables-actions"]',
        title: "Create and auto-assign",
        content:
          'Create tables one-at-a-time or in bulk, and use "Auto-Assign" to fill seats automatically based on capacity.',
      },
      {
        ...commonStepProps,
        target: '[data-tour="tables-unassigned"]',
        title: "Unassigned guests",
        content:
          "All guests without a table appear here. Drag any of them onto a table to seat them.",
      },
      {
        ...commonStepProps,
        target: '[data-tour="tables-grid"]',
        title: "Tables grid",
        content:
          "Each card shows a table's seats filled vs capacity. Drop guests here, or click to edit/delete.",
      },
      {
        ...commonStepProps,
        target: '[data-tour="tables-fullscreen"]',
        title: "Got 100+ guests?",
        content:
          "Open fullscreen mode for a roomier layout with the guest list, table grid and a detail panel side-by-side. Much easier for big weddings.",
      },
    ],
  },
  {
    routePath: "/app/tables/floorplan",
    pathPattern: /^\/app\/tables\/floorplan\/?$/,
    title: "Floor Plan",
    description:
      "Design your venue layout visually — drag tables, drop stages or dance floors, and assign guests right on the floor.",
    icon: "floorplan",
    steps: [
      {
        ...commonStepProps,
        target: '[data-tour="floorplan-toolbar"]',
        title: "Toolbox",
        content:
          "Pick a table shape (round, long or square) to drop onto the canvas, or add decorations like a stage, dance floor, walls or pillars.",
      },
      {
        ...commonStepProps,
        target: ".floor-canvas",
        title: "The canvas",
        content:
          "Drag tables anywhere to position them. Click a seat to assign a guest, or double-click a table to edit its name and capacity.",
        placement: "top",
      },
      {
        ...commonStepProps,
        target: '[data-tour="floorplan-guest-panel"]',
        title: "Guest list",
        content:
          "Drag any guest from here straight onto a seat or table on the canvas to assign them.",
        placement: "left",
      },
      {
        ...commonStepProps,
        target: '[data-tour="floorplan-actions"]',
        title: "Don't forget to save",
        content:
          'Layout changes are not auto-saved. Hit "Save Layout" before leaving the page or your arrangement is lost.',
      },
    ],
  },
  {
    routePath: "/app/wallet",
    title: "Wallet",
    description:
      "Track your event budget and expenses. Add transactions, categorise them and export reports.",
    icon: "wallet",
    steps: [
      {
        ...commonStepProps,
        target: '[data-tour="wallet-actions"]',
        title: "Setup, add and export",
        content:
          "Set up your wallet once, then add transactions as you spend. Export reports anytime.",
      },
      {
        ...commonStepProps,
        target: '[data-tour="wallet-summary"]',
        title: "Budget summary",
        content:
          "See your total budget, total spent, remaining balance and budget health all in one row.",
      },
      {
        ...commonStepProps,
        target: '[data-tour="wallet-transactions"]',
        title: "Transactions",
        content:
          "Every spend is listed here. Click any row to edit, or use the filters above to drill in by category, type or status.",
        placement: "bottom",
      },
    ],
  },
  {
    routePath: "/app/checkin",
    title: "Check-in",
    description:
      "Scan guest QR codes or manually check guests in on the event day.",
    icon: "checkin",
    steps: [
      {
        ...commonStepProps,
        target: '[data-tour="checkin-stats"]',
        title: "Live count",
        content:
          "See how many guests have arrived vs. how many are still on the way, updated in real time.",
      },
      {
        ...commonStepProps,
        target: '[data-tour="checkin-scanner"]',
        title: "QR scanner",
        content:
          'Tap "Start Camera" and point it at a guest\'s QR code. They check in with one beep.',
      },
      {
        ...commonStepProps,
        target: '[data-tour="checkin-manual"]',
        title: "Manual check-in",
        content:
          "If a guest can't show their QR, search by name or phone and tap to check them in.",
      },
    ],
  },
  {
    routePath: "/app/users",
    title: "Users & Profile",
    description:
      "View your profile, change your password and — if you're an admin — manage all user accounts.",
    icon: "users",
    steps: [
      {
        ...commonStepProps,
        target: '[data-tour="users-profile"]',
        title: "Your profile",
        content:
          "Your name, email, role and account dates at a glance. This is the info other team members see.",
      },
      {
        ...commonStepProps,
        target: '[data-tour="users-password"]',
        title: "Change your password",
        content:
          "Update your password anytime — enter your current one, then your new one twice to confirm.",
      },
    ],
  },
  {
    routePath: "/app/crew",
    title: "Crew",
    description:
      "Add event-day staff who can sign in to help with check-in, guests and tables.",
    icon: "crew",
    steps: [
      {
        ...commonStepProps,
        target: '[data-tour="crew-add"]',
        title: "Add crew members",
        content:
          "Add a name and we'll generate a Crew ID and PIN they use to sign in on event day.",
      },
      {
        ...commonStepProps,
        target: '[data-tour="crew-event-code"]',
        title: "Event Code",
        content:
          "Share this code with your crew along with their Crew ID and PIN. They sign in via the Staff tab on the login page.",
      },
      {
        ...commonStepProps,
        target: '[data-tour="crew-list"]',
        title: "Manage crew",
        content:
          "Everyone you've added shows up here. Edit names or remove crew members anytime.",
      },
    ],
  },
];

export function findTourForPath(pathname: string): TourDefinition | null {
  // Specific pathPattern matches take priority over prefix matches, so a sub-route
  // like /app/events/:id/form-fields resolves to the RSVP Questions tour rather
  // than getting captured by the broader /app/events prefix.
  const byPattern = TOURS.find((t) => t.pathPattern?.test(pathname));
  if (byPattern) return byPattern;
  return TOURS.find((t) => pathname.startsWith(t.routePath)) ?? null;
}

export function getTourByRoute(routePath: string): TourDefinition | null {
  return TOURS.find((t) => t.routePath === routePath) ?? null;
}
