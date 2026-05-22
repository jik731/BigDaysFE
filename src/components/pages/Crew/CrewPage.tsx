// src/components/pages/Crew/CrewPage.tsx
import { useState } from "react";
import { PageLoader } from "../../atoms/PageLoader";
import { Button } from "../../atoms/Button";
import { DeleteConfirmationModal } from "../../molecules/DeleteConfirmationModal";
import { NoEventsState } from "../../molecules/NoEventsState";
import { useEventContext } from "../../../context/EventContext";
import { useCrewListApi, useDeleteCrew, type CrewMember } from "../../../api/hooks/useCrewApi";
import { CrewFormModal } from "./CrewFormModal";
import { UserGroupIcon, PencilIcon, TrashIcon } from "@heroicons/react/solid";
import toast from "react-hot-toast";

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export default function CrewPage() {
  const { eventId, event, eventsLoading } = useEventContext()!;
  const { data: crew = [], isLoading, isError } = useCrewListApi(eventId);
  const deleteCrew = useDeleteCrew();

  const [modal, setModal] = useState<{ open: boolean; crew?: CrewMember }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; crew: CrewMember | null }>({
    open: false,
    crew: null,
  });

  if (eventsLoading) return <PageLoader message="Loading..." />;
  if (!eventId) return <NoEventsState title="No Events for Crew Management" message="Create your first event to start adding crew members." />;
  if (isLoading) return <PageLoader message="Loading crew..." />;
  if (isError) return <div className="text-red-500 p-4">Failed to load crew members.</div>;

  const handleDelete = async () => {
    if (!deleteModal.crew) return;
    try {
      await deleteCrew.mutateAsync(deleteModal.crew.crewGuid);
      toast.success(`${deleteModal.crew.name} removed from crew.`);
      setDeleteModal({ open: false, crew: null });
    } catch {
      toast.error("Failed to remove crew member.");
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-primary">Crew</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage event-day staff for{" "}
            <span className="font-medium text-text dark:text-white">{event?.title}</span>
          </p>
        </div>
        <Button data-tour="crew-add" variant="primary" onClick={() => setModal({ open: true })}>
          + Add Crew
        </Button>
      </div>

      {/* Info banner */}
      <div data-tour="crew-event-code" className="mb-6 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl text-sm text-primary space-y-1">
        <p>
          Crew members sign in via the <span className="font-medium">Staff</span> tab on the
          login page. They'll need their <span className="font-medium">Crew ID</span>,
          <span className="font-medium"> PIN</span>, and the <span className="font-medium">Event Code</span> below.
        </p>
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-primary/70">Event Code:</span>
          <code className="font-mono text-xs bg-white/70 border border-primary/20 rounded px-1.5 py-0.5 break-all">
            {event?.eventCode ?? "—"}
          </code>
          <button
            type="button"
            onClick={() => {
              const code = event?.eventCode;
              if (!code) return;
              navigator.clipboard?.writeText(code).then(
                () => toast.success("Event Code copied"),
                () => toast.error("Could not copy")
              );
            }}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
              <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
            </svg>
            Copy
          </button>
        </p>
      </div>

      {/* Empty state */}
      {crew.length === 0 && (
        <div data-tour="crew-list" className="text-center py-16">
          <UserGroupIcon className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">No crew members yet.</p>
          <Button variant="primary" onClick={() => setModal({ open: true })}>
            Add your first crew member
          </Button>
        </div>
      )}

      {/* Crew table */}
      {crew.length > 0 && (
        <div data-tour="crew-list" className="overflow-x-auto rounded-xl border border-primary/10 dark:border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary/5 dark:bg-white/5 border-b border-primary/10 dark:border-white/10">
                <th className="text-left px-4 py-3 font-semibold text-text/70 dark:text-white/60">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-text/70 dark:text-white/60">Crew ID</th>
                <th className="text-left px-4 py-3 font-semibold text-text/70 dark:text-white/60">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-text/70 dark:text-white/60">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/5 dark:divide-white/5">
              {crew.map((member) => (
                <tr
                  key={member.crewGuid}
                  className="hover:bg-primary/5 dark:hover:bg-white/5 transition-colors"
                >
                  <td className="px-4 py-3 font-medium">{member.name}</td>
                  <td className="px-4 py-3 font-mono text-text/70 dark:text-white/60">{member.crewCode}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        member.isActive
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-white/40"
                      }`}
                    >
                      {member.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text/60 dark:text-white/40">{formatDate(member.createdDate)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        title="Edit"
                        onClick={() => setModal({ open: true, crew: member })}
                        className="p-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-accent dark:border-white/10 dark:text-white dark:hover:bg-white/10 transition-colors"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        title="Remove"
                        onClick={() => setDeleteModal({ open: true, crew: member })}
                        className="p-2 rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50 dark:bg-accent dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit modal */}
      <CrewFormModal
        isOpen={modal.open}
        onClose={() => setModal({ open: false })}
        initialData={modal.crew}
        eventId={eventId}
      />

      {/* Delete confirmation */}
      <DeleteConfirmationModal
        isOpen={deleteModal.open}
        isDeleting={deleteCrew.isPending}
        title="Remove Crew Member"
        description="This crew member will no longer be able to log in."
        confirmLabel="Remove"
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal({ open: false, crew: null })}
      >
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Remove <strong>{deleteModal.crew?.name}</strong> (ID:{" "}
          <span className="font-mono">{deleteModal.crew?.crewCode}</span>) from the crew?
        </p>
      </DeleteConfirmationModal>
    </>
  );
}
