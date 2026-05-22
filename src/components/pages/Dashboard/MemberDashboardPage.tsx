import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useEventContext } from "../../../context/EventContext";
import { useDashboardApi } from "../../../api/hooks/useDashboardApi";
import { Button } from "../../atoms/Button";
import { PageLoader } from "../../atoms/PageLoader";
import { NoEventsState } from "../../molecules/NoEventsState";
import {
  CalendarIcon,
  LocationMarkerIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ClipboardCheckIcon,
  MailIcon,
  TableIcon,
  CashIcon,
  QrcodeIcon,
} from "@heroicons/react/solid";
import { formatEventDate, formatEventTime } from "../../../utils/eventUtils";

const ALMOST_THERE_MSGS = [
  "The excitement is building as your wedding day gets closer 🎉",
  "Only a little more time before your forever begins 💫",
  "You are so close to the moment you have been waiting for 🤍",
];
const TODAY_MSGS = [
  "Today is your wedding day and it is finally here 💍",
  "This is the moment where your forever begins 🤍",
  "Everything has led to this beautiful day ✨",
];
const PAST_MSGS = [
  "Your wedding day has passed but your journey together continues 🤍",
  "A beautiful day has ended and a lifetime together begins ✨",
  "The celebration is over but your story together goes on 🥂",
];
const FAR_MSGS = [
  "Your big day is coming and every day brings you closer 💍",
  "Counting down to the start of your forever ✨",
  "A beautiful day is waiting for you ahead 🤍",
];
const randomMsg = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

// Helper function to format relative time
function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const activityDate = new Date(timestamp.endsWith('Z') ? timestamp : timestamp + 'Z');
  const diffMs = now.getTime() - activityDate.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  
  // For older dates, show the actual date
  return activityDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function MemberDashboardPage() {
  const navigate = useNavigate();
  const { eventId, eventsLoading } = useEventContext();
  const { data: dashboard, isLoading } = useDashboardApi(eventId || "");

  // Countdown timer state
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0 });
  const [eventStatus, setEventStatus] = useState<'before' | 'today' | 'past'>('before');

  const todayMsg   = useMemo(() => randomMsg(TODAY_MSGS),        [eventStatus]);
  const pastMsg    = useMemo(() => randomMsg(PAST_MSGS),         [eventStatus]);
  const almostMsg  = useMemo(() => randomMsg(ALMOST_THERE_MSGS), [eventStatus]);
  const farMsg     = useMemo(() => randomMsg(FAR_MSGS),          [eventStatus]);

  // Update countdown every minute
  useEffect(() => {
    const updateCountdown = () => {
      const eventDate = dashboard?.eventStats?.eventDate;
      if (!eventDate) return;

      const now = new Date().getTime();
      const target = new Date(eventDate).getTime();
      const diff = target - now;

      if (diff > 0) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setCountdown({ days, hours, minutes });
        setEventStatus('before');
      } else {
        setCountdown({ days: 0, hours: 0, minutes: 0 });
        const eventDay = new Date(eventDate).toDateString();
        const today = new Date().toDateString();
        setEventStatus(eventDay === today ? 'today' : 'past');
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [dashboard?.eventStats?.eventDate]);

  if (!eventId) {
    if (eventsLoading) return <PageLoader message="Loading dashboard..." />;
    return (
      <NoEventsState
        title="Welcome to MyBigDays! ✨"
        message="Select an event from the sidebar to get started with your planning dashboard."
      />
    );
  }

  if (isLoading || !dashboard) {
    return <PageLoader message="Loading dashboard..." />;
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-semibold text-text dark:text-text mb-1">
            Good {new Date().getHours() < 12 ? "Morning" : "Afternoon"}! ✨
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Here's what's happening with your events today.
          </p>
        </div>
      </div>

      {/* Active Event Spotlight */}
      <div data-tour="dashboard-spotlight" className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary via-button to-secondary p-8 text-white shadow-2xl shadow-primary/30">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32"></div>
        <div className="absolute bottom-0 left-1/2 w-48 h-48 bg-white/5 rounded-full translate-y-24"></div>

        <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex-1">
            <h2 className="text-3xl font-bold mb-2">{dashboard.eventStats.eventName}</h2>
            <div className="flex flex-wrap items-center gap-4 text-white/80">
              {dashboard.eventStats.eventDate && (
                <span className="flex items-center gap-1.5">
                  <CalendarIcon className="h-4 w-4" />
                  {formatEventDate(dashboard.eventStats.eventDate)}
                  {dashboard.eventStats.eventTime && (
                    <span className="flex items-center gap-1">
                      <ClockIcon className="h-4 w-4" />
                      {formatEventTime(dashboard.eventStats.eventDate, dashboard.eventStats.eventTime)}
                    </span>
                  )}
                </span>
              )}
              {dashboard.eventStats.eventLocation && (
                <span className="flex items-center gap-1.5">
                  <LocationMarkerIcon className="h-4 w-4" />
                  {dashboard.eventStats.eventLocation}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            {eventStatus === 'today' ? (
              <div className="text-center py-4">
                <p className="text-2xl font-bold text-white">{todayMsg}</p>
              </div>
            ) : eventStatus === 'past' ? (
              <div className="text-center py-4">
                <p className="text-xl font-semibold text-white/90">{pastMsg}</p>
              </div>
            ) : (
              // Show countdown
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div className="px-2 py-3 rounded-xl bg-white/15 backdrop-blur-sm text-center">
                    <p className="text-2xl sm:text-3xl font-bold">{countdown.days}</p>
                    <p className="text-xs text-white/70 mt-0.5">Days</p>
                  </div>
                  <div className="px-2 py-3 rounded-xl bg-white/15 backdrop-blur-sm text-center">
                    <p className="text-2xl sm:text-3xl font-bold">{countdown.hours}</p>
                    <p className="text-xs text-white/70 mt-0.5">Hours</p>
                  </div>
                  <div className="px-2 py-3 rounded-xl bg-white/15 backdrop-blur-sm text-center">
                    <p className="text-2xl sm:text-3xl font-bold">{countdown.minutes}</p>
                    <p className="text-xs text-white/70 mt-0.5">Minutes</p>
                  </div>
                </div>
                <p className="text-white/90 text-sm font-medium">
                  {countdown.days < 15 ? almostMsg : farMsg}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div data-tour="dashboard-stats" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* RSVP Progress */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-lg hover:border-primary/20 transition-all group">
          <div className="flex items-start justify-between mb-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 grid place-items-center shadow-lg shadow-green-500/20 group-hover:scale-110 transition">
              <CheckCircleIcon className="h-6 w-6 text-white" />
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">RSVP Status</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white mb-1">
            {dashboard?.rsvpStats?.totalRsvpsReceived ?? 0} <span className="text-sm font-normal text-slate-400">/ {dashboard?.rsvpStats?.totalGuestsConfirmed ?? 0} responded</span>
          </p>
          <div className="text-xs text-slate-600 dark:text-slate-300 mb-3 space-y-0.5">
            <div className="flex justify-between">
              <span>Coming:</span>
              <span className="font-semibold">{dashboard?.rsvpStats?.comingCount ?? 0} guests</span>
            </div>
            <div className="flex justify-between">
              <span>Not Coming:</span>
              <span className="font-semibold">{dashboard?.rsvpStats?.notComingCount ?? 0} guests</span>
            </div>
          </div>
          <button
            onClick={() => navigate("/app/rsvps")}
            className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition"
          >
            <MailIcon className="h-4 w-4" />
            View RSVPs
          </button>
        </div>

        {/* Budget Status */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-lg hover:border-primary/20 transition-all group">
          <div className="flex items-start justify-between mb-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-button grid place-items-center shadow-lg shadow-primary/20 group-hover:scale-110 transition">
              <CurrencyDollarIcon className="h-6 w-6 text-white" />
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
              dashboard?.budgetStats?.status === 'over_budget'
                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                : dashboard?.budgetStats?.status === 'on_budget'
                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
            }`}>
              {dashboard?.budgetStats?.spentPercentage ?? 0}%
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Budget</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white mb-3">
            ${(dashboard?.budgetStats?.spentAmount ?? 0).toLocaleString()} <span className="text-sm font-normal text-slate-400">/ ${(dashboard?.budgetStats?.totalBudget ?? 0).toLocaleString()}</span>
          </p>
          <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all ${
                (dashboard?.budgetStats?.spentPercentage ?? 0) > 100
                  ? 'bg-gradient-to-r from-red-400 to-red-500'
                  : (dashboard?.budgetStats?.spentPercentage ?? 0) >= 90
                  ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                  : 'bg-gradient-to-r from-primary to-button'
              }`}
              style={{ width: `${Math.min(dashboard?.budgetStats?.spentPercentage ?? 0, 100)}%` }}
            ></div>
          </div>
          <button
            onClick={() => navigate("/app/wallet")}
            className="flex items-center gap-2 text-xs text-primary hover:text-button transition"
          >
            <CashIcon className="h-4 w-4" />
            Manage Budget
          </button>
        </div>

        {/* Tables */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-lg hover:border-secondary/30 transition-all group">
          <div className="flex items-start justify-between mb-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-secondary to-primary grid place-items-center shadow-lg shadow-secondary/20 group-hover:scale-110 transition">
              <ClipboardCheckIcon className="h-6 w-6 text-white" />
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Seating Progress</p>
          <div className="text-xs text-slate-600 dark:text-slate-300 mb-3 space-y-1">
            <div className="flex justify-between items-center">
              <span>Guests seated:</span>
              <span className="text-lg font-bold text-slate-800 dark:text-white">
                {dashboard?.tableStats?.assignedGuests ?? 0} / {dashboard?.tableStats?.totalSeats ?? 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Tables arranged:</span>
              <span className="text-lg font-bold text-slate-800 dark:text-white">
                {dashboard?.tableStats?.arrangedTables ?? 0} / {dashboard?.tableStats?.totalTables ?? 0}
              </span>
            </div>
          </div>
          <button
            onClick={() => navigate("/app/tables")}
            className="flex items-center gap-2 text-xs text-primary hover:text-button transition"
          >
            <TableIcon className="h-4 w-4" />
            Manage Tables
          </button>
        </div>
      </div>

      {/* Quick Actions + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div data-tour="dashboard-quick-actions" className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
          <h3 className="font-semibold text-slate-800 dark:text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate("/app/rsvps")}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-100 dark:border-green-800 hover:border-green-200 dark:hover:border-green-700 hover:shadow-md transition group"
            >
              <div className="h-10 w-10 rounded-xl bg-green-100 dark:bg-green-900/50 group-hover:bg-green-200 dark:group-hover:bg-green-800 grid place-items-center transition">
                <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Add RSVP</span>
            </button>
            <a
              href="/app/rsvps/designer-v3"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-primary/5 to-secondary/10 border border-primary/15 hover:border-primary/30 hover:shadow-md transition group"
            >
              <div className="h-10 w-10 rounded-xl bg-primary/10 group-hover:bg-primary/20 grid place-items-center transition">
                <ClipboardCheckIcon className="h-5 w-5 text-primary" />
              </div>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Design RSVP</span>
            </a>
            <button
              onClick={() => navigate("/app/guests")}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-secondary/10 to-primary/5 border border-secondary/20 hover:border-secondary/40 hover:shadow-md transition group"
            >
              <div className="h-10 w-10 rounded-xl bg-secondary/15 group-hover:bg-secondary/25 grid place-items-center transition">
                <MailIcon className="h-5 w-5 text-secondary" />
              </div>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Send Invites
              </span>
            </button>
            <button
              onClick={() => navigate("/app/tables")}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-100 dark:border-amber-800 hover:border-amber-200 dark:hover:border-amber-700 hover:shadow-md transition group"
            >
              <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 group-hover:bg-amber-200 dark:group-hover:bg-amber-800 grid place-items-center transition">
                <TableIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Arrange Seats</span>
            </button>
            <button
              onClick={() => navigate("/app/wallet")}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-button/5 to-primary/10 border border-button/15 hover:border-button/30 hover:shadow-md transition group"
            >
              <div className="h-10 w-10 rounded-xl bg-button/10 group-hover:bg-button/20 grid place-items-center transition">
                <CurrencyDollarIcon className="h-5 w-5 text-button" />
              </div>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Add Expense</span>
            </button>
            <button
              onClick={() => navigate("/app/checkin")}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/20 dark:to-cyan-950/20 border border-teal-100 dark:border-teal-800 hover:border-teal-200 dark:hover:border-teal-700 hover:shadow-md transition group"
            >
              <div className="h-10 w-10 rounded-xl bg-teal-100 dark:bg-teal-900/50 group-hover:bg-teal-200 dark:group-hover:bg-teal-800 grid place-items-center transition">
                <QrcodeIcon className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Check In</span>
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div data-tour="dashboard-recent-activity" className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Recent Activity</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Latest updates from your event</p>
            </div>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[400px] overflow-y-auto">
            {dashboard?.recentActivity && dashboard.recentActivity.length > 0 ? (
              dashboard.recentActivity.map((activity, index) => (
                <div
                  key={index}
                  className="px-6 py-4 hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition flex items-start gap-4"
                >
                  <div className="h-10 w-10 rounded-xl bg-accent grid place-items-center flex-shrink-0">
                    <span className="text-lg">{activity.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 dark:text-white">{activity.description}</p>
                    {activity.details && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{activity.details}</p>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">
                    {formatRelativeTime(activity.timestamp)}
                  </span>
                </div>
              ))
            ) : (
              <div className="px-6 py-12 text-center">
                <div className="h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-700 grid place-items-center mx-auto mb-4">
                  <ClockIcon className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-slate-500 dark:text-slate-400 mb-2 font-medium">No activity yet</p>
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  Activity will appear here as guests respond and you manage your event
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
