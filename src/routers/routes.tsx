// src/routers/AppRoutes.tsx
import React from "react";
import { Routes, Route, Navigate, Outlet, useNavigate, useLocation } from "react-router-dom";

import LandingPage from "../components/pages/Landing/LandingPage";
import LoginPage from "../components/pages/Auth/LoginPage";
import RegisterPage from "../components/pages/Auth/RegisterPage";
import VerifyEmailPage from "../components/pages/Auth/VerifyEmailPage";
import ResetPasswordPage from "../components/pages/Auth/ResetPasswordPage";
import ContactPage from "../components/pages/Auth/ContactPage";
import StoryPage from "../components/pages/Public/Story/StoryPage";
import GalleryPage from "../components/pages/Public/Gallery/GalleryPage";
import PeoplePage from "../components/pages/Public/People/PeoplePage";
import BlogPage from "../components/pages/Public/Blog/BlogPage";

import PublicTemplate from "../components/templates/PublicTemplate";
import { Navbar } from "../components/organisms/Navbar";
import { Sidebar } from "../components/organisms/Sidebar";
import { HelpBubble } from "../components/organisms/HelpBubble";
import { TourProvider } from "../components/tour/TourProvider";
import { NoEventsState } from "../components/molecules/NoEventsState";
import { useEventContext } from "../context/EventContext";

const CREW_ALLOWED_PATHS = ["/app/checkin", "/app/guests", "/app/tables"];

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const { mustChooseEvent } = useEventContext();
  const { userRole } = useAuth();
  const location = useLocation();

  if (userRole === 6 && !CREW_ALLOWED_PATHS.some(p => location.pathname.startsWith(p))) {
    return <Navigate to="/app/checkin" replace />;
  }

  // When the user has zero events, show an inline onboarding state on every
  // route except /app/events (where they can actually create one).
  const onEventsRoute = location.pathname.startsWith("/app/events");
  const showEmptyState = mustChooseEvent && !onEventsRoute;

  return (
    <TourProvider>
      <div className="flex h-screen bg-background dark:bg-slate-950 text-text">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex flex-col flex-1 min-w-0">
          <Navbar onMenuToggle={() => setSidebarOpen(o => !o)} />
          <main className="flex-1 p-6 overflow-auto">
            {showEmptyState ? <NoEventsState /> : <Outlet />}
          </main>
        </div>
        <HelpBubble />
      </div>
    </TourProvider>
  );
}

import EventsPage from "../components/pages/Events/EventsPage";
// import EventFormModal from "../components/molecules/EventFormModal";
import EditEventModal from "../components/pages/Events/EditEventModal";

import RsvpsPage from "../components/pages/RSVPs/RsvpsPage";
import RsvpDesignPage from "../components/pages/RSVPs/RsvpDesignPage";
import RsvpDesignV2Page from "../components/pages/RSVPs/RsvpDesignV2Page";
import RsvpDesignV3Page from "../components/pages/RSVPs/RsvpDesignV3Page";
import RsvpSharePreviewPage from "../components/pages/RSVPs/RsvpSharePreviewPage";
// import RsvpDetail from "../components/pages/RSVPs/RsvpDetail";
// import rsvp from "../components/pages/RSVPs/NewRsvpModal";
// import EditRsvpModal from "../components/pages/RSVPs/EditRsvpModal";

import GuestsPage from "../components/pages/Guests/GuestsPage";

import TablesPage from "../components/pages/Tables/TablesPage";
// import TableDetail from "../components/pages/Tables/TableDetail";
// import TableFormModal from "../components/molecules/TableFormModal";
import EditTableModal from "../components/pages/Tables/EditTableModal";

import SeatingPage from "../components/pages/Seating/SeatingPage";
// import SeatingDetail from "../components/pages/Seating/SeatingDetail";
// import SeatingFormModal from "../components/molecules/SeatingFormModal";
import EditSeatingModal from "../components/pages/Seating/EditSeatingModal";

import UsersPage from "../components/pages/Users/UsersPage";
// import UserDetail from "../components/pages/Users/UserDetail";
// import UserFormModal from "../components/molecules/UserFormModal";
import EditUserModal from "../components/pages/Users/EditUserModal";

import WalletPage from "../components/pages/Wallet/WalletPage";

import MemberDashboardPage from "../components/pages/Dashboard/MemberDashboardPage";

import RSVPPublicPage from "../components/pages/Public/RSVPPublic/RSVPPublicPage";
import RsvpBySlugPage from "../components/pages/Public/RSVPPublic/RsvpBySlugPage";
import EventPublicPage from "../components/pages/Public/EventsPublic/EventsPublicPage";
import { EventFormModal } from "../components/molecules/EventFormModal";
import { NewRsvpModal } from "../components/pages/RSVPs/NewRsvpModal";
import { EditRsvpModal } from "../components/pages/RSVPs/EditRsvpModal";
import { TableFormModal } from "../components/molecules/TableFormModal";
import { SeatingFormModal } from "../components/molecules/SeatingFormModal";
import { UserFormModal } from "../components/molecules/UserFormModal";
import FormFieldsPage from "../components/pages/Events/FormFieldsPage";
import { TableAssignments } from "../components/pages/Tables/TableAssignments";
import TableDetail from "../components/pages/Tables/TableDetail";
import { TableLayoutPlanner } from "../components/pages/Tables/TableLayoutPlanner";
import { TablePrintView } from "../components/pages/Tables/TablePrintView";
import { TableSummary } from "../components/pages/Tables/TableSummary";
import FloorPlanPage from "../components/pages/Tables/FloorPlanPage";
import TablesPageV2 from "../components/pages/Tables/TablesPageV2";
import TablesRedesignPage from "../components/pages/Tables/TablesRedesignPage";
import CheckInPage from "../components/pages/CheckIn/CheckInPage";
import QrLookupPage from "../components/pages/Public/QrLookup/QrLookupPage";
import RequireAuth from "../components/RequireAuth";
import { useAuth } from "../api/hooks/useAuth";
import CrewPage from "../components/pages/Crew/CrewPage";
import ChecklistPage from "../components/pages/Checklist/ChecklistPage";
import TutorialPage from "../components/pages/Tutorial/TutorialPage";
// …and other Public pages…

export default function AppRoutes() {
  const navigate = useNavigate();

  return (
    <Routes>
      {/* ─── STANDALONE PUBLIC (no navbar/footer) ───────── */}
      <Route path="/rsvp/submit/:token" element={<RSVPPublicPage />} />
      <Route path="/rsvp/:slug" element={<RsvpBySlugPage />} />
      <Route path="/rsvp/share/:token" element={<RsvpSharePreviewPage />} />

      {/* ─── AUTH (standalone, no navbar/footer) ─────────── */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      {/* Dev/Staging only — blocked in prod via ResetPasswordPage internal guard */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* ─── PUBLIC ───────────────────────────────────────── */}
      <Route element={<PublicTemplate />}>
        <Route path="/" element={<LandingPage />} />

        {/* public landing pages */}
        <Route path="/events"  element={<EventPublicPage />} />
        <Route path="/rsvp"    element={<RSVPPublicPage />} />
        <Route path="/story"   element={<StoryPage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/people"  element={<PeoplePage />} />
        <Route path="/blog"    element={<BlogPage />} />
        {/* Guest self-service QR lookup */}
        <Route path="/qr/lookup/:eventId" element={<QrLookupPage />} />
      </Route>

      {/* ─── PROTECTED / DASHBOARD ─────────────────────────── */}
      <Route path="/app" element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<Navigate to="dashboard" replace />} />

        {/* DASHBOARD */}
        <Route path="dashboard" element={<MemberDashboardPage />} />

        {/* EVENTS */}
        <Route path="events" element={<Outlet />}>
          <Route index element={<EventsPage />} />
          <Route
            path="new"
            element={<EventFormModal isOpen onClose={() => navigate(-1)} />}
          />
          <Route path=":id/edit" element={<EditEventModal />} />
          <Route path=":id/form-fields" element={<FormFieldsPage />} />
        </Route>

        {/* RSVP QUESTIONS (sidebar sub-link, uses current event from context) */}
        <Route path="form-fields" element={<FormFieldsPage />} />

        {/* RSVPs (no :eventId in the URL) */}
        <Route path="rsvps" element={<Outlet />}>
          <Route index element={<RsvpsPage />} />
          <Route path="designer" element={<RsvpDesignPage />} />
          <Route path="designer-v2" element={<RsvpDesignV2Page />} />
          <Route path="designer-v3" element={<RsvpDesignV3Page />} />
          <Route path="new" element={<NewRsvpModal />} />
          <Route path=":id/edit" element={<EditRsvpModal />} />
        </Route>

        {/* GUESTS */}
        <Route path="guests" element={<GuestsPage />} />

        {/* ─── TABLES ─────────────────────────────────────────── */}
<Route path="tables" element={<Outlet/>}>
  <Route index element={<TablesPage />} />
  <Route path="floorplan" element={<FloorPlanPage />} />
  <Route path="v2" element={<TablesPageV2 />} />
  <Route path="fullscreen" element={<TablesRedesignPage />} />

  <Route path="new" element={
    <TableFormModal isOpen onClose={() => navigate(-1)} />
  }/>

  <Route path=":tableId" element={<TableDetail />}>
    {/* ← now this is the “index” child under /app/tables/:tableId */}
    <Route index         element={<TableSummary      />} />
    <Route path="assignments" element={<TableAssignments />} />
    <Route path="layout"      element={<TableLayoutPlanner />} />
    <Route path="print"       element={<TablePrintView   />} />
    <Route path="edit"        element={<EditTableModal   />} />
  </Route>
</Route>
        {/* SEATING */}
        <Route path="seating" element={<Outlet />}>
          <Route index element={<SeatingPage />} />
          <Route
            path="new"
            element={<SeatingFormModal isOpen onClose={() => navigate(-1)} />}
          />
          <Route path=":id/edit" element={<EditSeatingModal />} />
        </Route>

        {/* USERS */}
        <Route path="users" element={<Outlet />}>
          <Route index element={<UsersPage />} />
          <Route
            path="new"
            element={<UserFormModal isOpen onClose={() => navigate(-1)} />}
          />
          <Route path=":id/edit" element={<EditUserModal />} />
        </Route>

        {/* CREW */}
        <Route path="crew" element={<CrewPage />} />

        {/* CHECKLIST */}
        <Route path="checklist" element={<ChecklistPage />} />

        {/* CHECK-IN */}
        <Route path="checkin" element={<CheckInPage />} />

        {/* WALLET */}
        <Route path="wallet" element={<WalletPage />} />

        {/* TUTORIAL */}
        <Route path="tutorial" element={<TutorialPage />} />

        {/* any other /app/* → back to dashboard */}
        <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
      </Route>

      {/* global 404 fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
