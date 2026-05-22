import { useEffect, useMemo, useState } from "react";
import { PageLoader } from "../../atoms/PageLoader";
import {
  useDeactivateEvent,
  useEventsApi,
  useActivateEvent,
  useUpdateEventSlug,
} from "../../../api/hooks/useEventsApi";
import { EventFormModal } from "../../molecules/EventFormModal";
import { Button } from "../../atoms/Button";
import { Outlet, useNavigate, useSearchParams } from "react-router-dom";
import { useEventContext } from "../../../context/EventContext";
import { CheckCircleIcon, CheckIcon } from "@heroicons/react/solid";
import { CalendarIcon, LocationMarkerIcon, ArchiveIcon, PencilIcon, XIcon, RefreshIcon } from "@heroicons/react/solid";
import { StatsCard } from "../../atoms/StatsCard";
import { formatEventDate, formatEventTime } from "../../../utils/eventUtils";

export default function EventsPage() {
  const [showArchived, setShowArchived] = useState(false);
  const { data: events = [], isLoading, isError } = useEventsApi(showArchived);
  const deactivateEvent = useDeactivateEvent();
  const activateEvent = useActivateEvent();
  const [modal, setModal] = useState<{ open: boolean; event?: any }>({
    open: false,
  });
  const navigate = useNavigate();
  const { setEventId, eventId } = useEventContext();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"upcoming" | "recent" | "name">("upcoming");
  const [searchParams, setSearchParams] = useSearchParams();
  const updateSlug = useUpdateEventSlug();
  const [editingSlugId, setEditingSlugId] = useState<string | null>(null);
  const [slugInput, setSlugInput] = useState("");

  useEffect(() => {
    const wantsNew = searchParams.get("new") === "1";
    const wantsDemo = searchParams.get("demo") === "1";
    if (wantsNew || wantsDemo) {
      const demoDate = new Date();
      demoDate.setMonth(demoDate.getMonth() + 2);
      const demoEvent = wantsDemo
        ? {
            title: "Sample Summer Wedding",
            date: demoDate.toISOString().slice(0, 10),
            description: "Pre-fill details to see how planning works.",
            location: "Pick your dream venue",
            noOfTable: 12,
          }
        : undefined;

      setModal({ open: true, event: demoEvent });

      const next = new URLSearchParams(searchParams);
      next.delete("new");
      next.delete("demo");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const activeEvent = useMemo(
    () => events.find((ev) => ev.id === eventId),
    [events, eventId]
  );

  const filteredEvents = useMemo(() => {
    const term = search.toLowerCase();
    const list = events.filter((ev) =>
      ev.title.toLowerCase().includes(term) || ev.location?.toLowerCase().includes(term)
    );

    return list.sort((a, b) => {
      if (sortBy === "name") return a.title.localeCompare(b.title);
      const aDate = new Date(a.date).getTime();
      const bDate = new Date(b.date).getTime();
      return sortBy === "upcoming" ? aDate - bDate : bDate - aDate;
    });
  }, [events, search, sortBy]);

  const activeCount = events.filter((ev) => !ev.raw?.isDeleted).length;
  const archivedCount = events.filter((ev) => ev.raw?.isDeleted).length;
  const nextEventDate = events.length
    ? new Date(
        Math.min(
          ...events.map((ev) => new Date(ev.date).getTime()).filter((time) => !Number.isNaN(time))
        )
      )
    : undefined;

  if (isLoading) return <PageLoader message="Loading events..." />;
  if (isError) return (
    <div className="p-6 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 text-center space-y-1">
      <p className="text-base font-semibold text-red-700 dark:text-red-300">Failed to load events</p>
      <p className="text-sm text-red-600 dark:text-red-400">Please refresh the page or try again later.</p>
    </div>
  );

  return (
    <>
      <div className="space-y-4">
        <div data-tour="events-header" className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-display font-semibold text-primary">Your Events</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Prioritize the next celebration or revisit archived plans.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant={showArchived ? "primary" : "secondary"}
              onClick={() => setShowArchived((s) => !s)}
            >
              {showArchived ? "Hide" : "Show"} archived
            </Button>
          </div>
        </div>

        {activeEvent && (
          <div className="p-4 rounded-xl border border-primary/25 bg-white dark:bg-accent dark:border-primary/30 shadow-sm shadow-primary/10 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-start gap-3">
              <CheckCircleIcon className="w-6 h-6 text-primary mt-0.5" />
              <div>
                <p className="text-xs uppercase tracking-wide text-primary font-semibold">Active event</p>
                <p className="text-lg font-semibold text-gray-800">{activeEvent.title}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  {formatEventDate(activeEvent.date)}
                  {activeEvent.time && ` · ${formatEventTime(activeEvent.date, activeEvent.time)}`} •
                  <span className="flex items-center gap-1">
                    <LocationMarkerIcon className="w-4 h-4" />
                    {activeEvent.location || "Add a venue"}
                  </span>
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">slug:</span>
                  {editingSlugId === activeEvent.id ? (
                    <>
                      <input
                        className="text-xs font-mono border border-primary/30 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/30 w-full sm:w-40"
                        value={slugInput}
                        onChange={(e) => setSlugInput(e.target.value)}
                        autoFocus
                      />
                      <button
                        className="p-0.5 rounded text-green-600 hover:bg-green-50"
                        disabled={updateSlug.isPending}
                        onClick={async () => {
                          await updateSlug.mutateAsync({ eventGuid: activeEvent.id, slug: slugInput });
                          setEditingSlugId(null);
                        }}
                      >
                        <CheckIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="p-0.5 rounded text-gray-400 hover:bg-gray-100"
                        onClick={() => setEditingSlugId(null)}
                      >
                        <XIcon className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      {activeEvent.slug ? (
                        <a
                          href={`/rsvp/${activeEvent.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono text-primary/70 hover:text-primary hover:underline"
                        >
                          {activeEvent.slug}
                        </a>
                      ) : (
                        <span className="text-xs font-mono text-gray-300 dark:text-gray-600">not set</span>
                      )}
                      <button
                        className="p-0.5 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"
                        onClick={() => { setEditingSlugId(activeEvent.id); setSlugInput(activeEvent.slug ?? ""); }}
                      >
                        <PencilIcon className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate("/app/rsvps")}>Continue planning</Button>
              <a href="/app/rsvps/designer-v3" target="_blank" rel="noopener noreferrer">
                <Button variant="secondary">Design RSVP Card ↗</Button>
              </a>
              <Button variant="secondary" onClick={() => navigate(`${activeEvent.id}/form-fields`)}>
                RSVP Questions
              </Button>
            </div>
          </div>
        )}

        <div data-tour="events-stats" className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatsCard label="Active Events" value={activeCount} variant="primary" size="sm" icon={<CheckCircleIcon className="w-4 h-4" />} />
          <StatsCard label="Archived Events" value={archivedCount} variant="warning" size="sm" icon={<ArchiveIcon className="w-4 h-4" />} />
          <StatsCard label="Upcoming Next" value={nextEventDate ? formatEventDate(nextEventDate.toISOString()) : "—"} variant="secondary" size="sm" icon={<CalendarIcon className="w-4 h-4" />} />
        </div>

        <div data-tour="events-search" className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-1 gap-3">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or location"
              className="w-full border border-primary/20 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="border border-primary/20 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="upcoming">Soonest first</option>
              <option value="recent">Most recent</option>
              <option value="name">Alphabetical</option>
            </select>
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="p-6 rounded-lg border-2 border-dashed border-primary/25 text-center space-y-2 bg-white/70">
            <p className="text-lg font-semibold">No events match your filters.</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Create one to start planning or clear the search.</p>
            <Button onClick={() => setModal({ open: true })}>Create your first event</Button>
          </div>
        ) : (
          <ul data-tour="events-list" className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filteredEvents.map((ev) => {
              const isActive = eventId === ev.id;
              const isArchived = Boolean(ev?.raw?.isDeleted);

              return (
                <li
                  key={ev.id}
                  className={`rounded-xl border shadow-sm transition hover:shadow-md bg-white/90 backdrop-blur dark:bg-gray-800 overflow-hidden ${
                    isActive ? "border-primary" : "border-gray-100 dark:border-white/10"
                  }`}
                >
                  {/* Card body */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{ev.title}</h3>
                      {isActive && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          <CheckCircleIcon className="w-4 h-4" /> Active
                        </span>
                      )}
                      {isArchived && (
                        <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">
                          Archived
                        </span>
                      )}
                      {ev.slug && (
                        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${ev.isExpired ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                          RSVP {ev.isExpired ? "Closed" : "Open"}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1">
                        <CalendarIcon className="w-4 h-4" />
                        {formatEventDate(ev.date)}
                        {ev.time && ` · ${formatEventTime(ev.date, ev.time)}`}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <LocationMarkerIcon className="w-4 h-4" />
                        {ev.location || "Add a venue"}
                      </span>
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 min-h-[1.25rem]">
                      {ev.description ?? ""}
                    </p>
                    <div className="flex items-center gap-3 text-sm font-medium text-gray-600 dark:text-gray-300">
                      <span>Tables: {ev.noOfTable ?? "Not set"}</span>
                      <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                      <span>{isArchived ? "Archived plan" : ""}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">slug:</span>
                      {editingSlugId === ev.id ? (
                        <>
                          <input
                            className="text-xs font-mono border border-primary/30 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/30 w-full sm:w-36"
                            value={slugInput}
                            onChange={(e) => setSlugInput(e.target.value)}
                            autoFocus
                          />
                          <button
                            className="p-0.5 rounded text-green-600 hover:bg-green-50"
                            disabled={updateSlug.isPending}
                            onClick={async () => {
                              await updateSlug.mutateAsync({ eventGuid: ev.id, slug: slugInput });
                              setEditingSlugId(null);
                            }}
                          >
                            <CheckIcon className="w-3.5 h-3.5" />
                          </button>
                          <button
                            className="p-0.5 rounded text-gray-400 hover:bg-gray-100"
                            onClick={() => setEditingSlugId(null)}
                          >
                            <XIcon className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          {ev.slug ? (
                            <a
                              href={`/rsvp/${ev.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-mono text-primary/70 hover:text-primary hover:underline"
                            >
                              {ev.slug}
                            </a>
                          ) : (
                            <span className="text-xs font-mono text-gray-300 dark:text-gray-600">not set</span>
                          )}
                          <button
                            className="p-0.5 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"
                            onClick={() => { setEditingSlugId(ev.id); setSlugInput(ev.slug ?? ""); }}
                          >
                            <PencilIcon className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Card footer */}
                  <div className="px-4 py-2.5 border-t border-gray-100 dark:border-white/10 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {isArchived ? (
                        <button
                          title="Restore event"
                          onClick={() => activateEvent.mutate(ev.id)}
                          disabled={activateEvent.isPending}
                          className="p-2 rounded-lg bg-white border border-green-200 text-green-600 hover:bg-green-50 dark:bg-accent dark:border-green-900/30 dark:text-green-400 dark:hover:bg-green-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <RefreshIcon className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          title="Archive event"
                          onClick={() => deactivateEvent.mutate(ev.id)}
                          disabled={deactivateEvent.isPending}
                          className="p-2 rounded-lg bg-white border border-red-200 text-red-500 hover:bg-red-50 dark:bg-accent dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ArchiveIcon className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        title="Edit"
                        onClick={() => navigate(`${ev.id}/edit`)}
                        className="p-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-accent dark:border-white/10 dark:text-white dark:hover:bg-white/10 transition-colors"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <span className="w-px h-4 bg-gray-200 dark:bg-white/10" />
                      <Button
                        variant="ghost"
                        className="!text-sm !px-2.5"
                        onClick={() => navigate(`${ev.id}/form-fields`)}
                      >
                        RSVP Questions
                      </Button>
                    </div>
                    <Button
                      onClick={() => {
                        setEventId(ev.id);
                        navigate("/app/rsvps");
                      }}
                    >
                      {isActive ? "✓ Active" : "Select →"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <EventFormModal
          isOpen={modal.open}
          onClose={() => setModal({ open: false })}
          onSuccess={() => setModal({ open: false })}
          initial={modal.event}
        />
      </div>

      <Outlet />
    </>
  );
}
