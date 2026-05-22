import React, { useState, useEffect } from "react";
import { XIcon, PencilIcon } from "@heroicons/react/solid";
import { Chair, DotsThree } from "@phosphor-icons/react";
import { Modal } from "./Modal";
import QrStatusBadge from "./QrStatusBadge";

type TabId = "icons" | "badges";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface GuideCardProps {
  icon: React.ReactNode;
  label: string;
  description: string;
}

function GuideCard({ icon, label, description }: GuideCardProps) {
  return (
    <div className="flex flex-col items-center text-center gap-2 p-4 rounded-xl border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5">
      <div className="flex items-center justify-center">{icon}</div>
      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-tight">{label}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{description}</p>
    </div>
  );
}

function IconsTab() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <GuideCard
        icon={
          <span className="p-3 rounded-xl bg-white border border-gray-200 text-gray-700 dark:bg-accent dark:border-white/10 dark:text-white inline-flex">
            <PencilIcon className="h-6 w-6" />
          </span>
        }
        label="Edit Guest"
        description="Opens the form to edit this guest's details"
      />
      <GuideCard
        icon={
          <span className="p-3 rounded-xl bg-primary text-white inline-flex">
            <Chair size={24} weight="bold" />
          </span>
        }
        label="Assign to Table"
        description="Opens a table picker to seat this guest. Only shows when the guest has no table assigned."
      />
      <GuideCard
        icon={
          <span className="p-3 rounded-xl bg-orange-600 text-white inline-flex">
            <XIcon className="h-6 w-6" />
          </span>
        }
        label="Unassign"
        description="Removes guest from their table. Only shows when already seated."
      />
      <GuideCard
        icon={
          <span className="p-3 rounded-xl bg-green-600 text-white inline-flex">
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.555 4.122 1.523 5.855L.057 23.885a.5.5 0 0 0 .606.61l6.198-1.626A11.934 11.934 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.721 9.721 0 0 1-5.003-1.386l-.36-.214-3.724.977.993-3.614-.234-.374A9.718 9.718 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/>
            </svg>
          </span>
        }
        label="Send WhatsApp Invite"
        description="Sends a pre-filled invite. Grayed out if no phone number saved."
      />
      <GuideCard
        icon={
          <span className="p-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-accent text-gray-700 dark:text-white inline-flex">
            <DotsThree size={24} weight="bold" />
          </span>
        }
        label="More Options"
        description="View/revoke QR code or record a gift. Only shows when wallet or QR is active."
      />
    </div>
  );
}

function BadgesTab() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <GuideCard
        icon={<span className="px-3 py-1.5 text-xs font-bold rounded-full bg-green-600 text-white">ASSIGNED</span>}
        label="Assigned"
        description="Guest is seated. Card border turns green."
      />
      <GuideCard
        icon={<span className="px-3 py-1.5 text-xs font-bold rounded-full bg-orange-600 text-white">UNASSIGNED</span>}
        label="Unassigned"
        description="No table yet. Card border turns orange."
      />
      <GuideCard
        icon={
          <div className="flex flex-col gap-1 items-center">
            <div className="flex gap-1">
              <span className="px-2 py-0.5 rounded-full text-xs font-medium border-2 border-blue-600 text-blue-600">Family</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium border-2 border-purple-600 text-purple-600">VIP</span>
            </div>
            <div className="flex gap-1">
              <span className="px-2 py-0.5 rounded-full text-xs font-medium border-2 border-indigo-600 text-indigo-600">Friend</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium border-2 border-gray-400 text-gray-600">Other</span>
            </div>
          </div>
        }
        label="Guest Type"
        description="Family, VIP, Friend, or Other — color-coded border badge."
      />
      <GuideCard
        icon={
          <div className="flex flex-col gap-1 items-center">
            <div className="flex gap-1">
              <QrStatusBadge status="Generated" />
              <QrStatusBadge status="CheckedIn" />
            </div>
            <div className="flex gap-1">
              <QrStatusBadge status="Revoked" />
              <QrStatusBadge status="None" />
            </div>
          </div>
        }
        label="QR Code Status"
        description="Generated → sent. Checked In → scanned at door. Revoked → cancelled."
      />
      <GuideCard
        icon={<span className="px-3 py-1 text-xs font-bold rounded-full bg-amber-500 text-white">RM 500</span>}
        label="Gift Amount"
        description="Top-left corner when a gift is recorded for this guest."
      />
      <GuideCard
        icon={<span className="px-2 py-0.5 rounded bg-gray-200 text-xs font-mono font-bold text-gray-700">Table A-3</span>}
        label="Guest Code"
        description="Shown once the guest is seated at a table (e.g. Table A-3). Write this on their angpao envelope for a smoother check-in."
      />
    </div>
  );
}

export function GuestHelpModal({ isOpen, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("icons");

  useEffect(() => {
    if (isOpen) setActiveTab("icons");
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Guest Page Guide" className="!max-w-xl" showCloseButton>
      <div className="flex rounded-xl bg-gray-100 dark:bg-gray-800/80 p-1 gap-1 mb-5">
        {(["icons", "badges"] as TabId[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTab(t)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === t
                ? "bg-white dark:bg-gray-700 text-primary shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {t === "icons" ? "Icons & Buttons" : "Status Badges"}
          </button>
        ))}
      </div>
      {activeTab === "icons" ? <IconsTab /> : <BadgesTab />}
    </Modal>
  );
}
