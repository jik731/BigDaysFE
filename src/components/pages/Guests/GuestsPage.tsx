// src/components/pages/Guests/GuestsPage.tsx
import { PageLoader } from "../../atoms/PageLoader";
import { ErrorState } from "../../atoms/ErrorState";
import { useState, useMemo } from "react";
import { UserGroupIcon, UserIcon, CheckCircleIcon, XIcon, PencilIcon, LightBulbIcon } from "@heroicons/react/solid";
import { Chair, DotsThree } from "@phosphor-icons/react";
import { useAuth } from "../../../api/hooks/useAuth";
import {
  useGuestsApi,
  useAssignGuestToTable,
  useUnassignGuestFromTable,
  type Guest,
} from "../../../api/hooks/useGuestsApi";
import { useTablesApi } from "../../../api/hooks/useTablesApi";
import { useQrListApi, useGenerateQrApi, useRevokeQrApi } from "../../../api/hooks/useQrApi";
import { useWalletsApi } from "../../../api/hooks/useWalletApi";
import { useTransactionsApi } from "../../../api/hooks/useTransactionApi";
import { Button } from "../../atoms/Button";
import { Dropdown, DropdownItem } from "../../atoms/Dropdown";
import { StatsCard } from "../../atoms/StatsCard";
import { useEventContext } from "../../../context/EventContext";
import toast from "react-hot-toast";
import { GuestFormModal } from "./GuestFormModal";
import { GiftFormModal } from "./GiftFormModal";
import { NoEventsState } from "../../molecules/NoEventsState";
import { DeleteConfirmationModal } from "../../molecules/DeleteConfirmationModal";
import { Modal } from "../../molecules/Modal";
import { GuestHelpModal } from "../../molecules/GuestHelpModal";
import QrStatusBadge from "../../molecules/QrStatusBadge";
import QrImageModal from "../../molecules/QrImageModal";
import type { QrToken, QrStatus } from "../../../types/qr";
import { CURRENCY_CONFIG } from "../../../types/wallet";
import type { Currency } from "../../../types/wallet";

export default function GuestsPage() {
  // ─── All hooks first (React Rules of Hooks) ─────────────────────────────────────────
  const { userRole } = useAuth();
  const isReadOnly = userRole === 6;
  const { eventId, eventsLoading, event } = useEventContext()!;
  const { data: guests = [], isLoading: guestsLoading, isError: guestsError } = useGuestsApi(eventId!);
  const { data: tables = [], isLoading: tablesLoading } = useTablesApi(eventId!);
  const assignGuestToTable = useAssignGuestToTable(eventId!);
  const unassignGuestFromTable = useUnassignGuestFromTable(eventId!);
  const { data: qrTokens = [] } = useQrListApi(eventId!);
  const { data: wallet } = useWalletsApi(eventId!);
  const { data: transactions = [] } = useTransactionsApi(wallet?.walletGuid ?? "", eventId!);
  const generateQr = useGenerateQrApi();
  const revokeQr = useRevokeQrApi();

  const [bannerDismissed, setBannerDismissed] = useState(() => sessionStorage.getItem("guestBannerDismissed") === "1");
  const [guestTypeFilter, setGuestTypeFilter] = useState<string>("All");
  const [assignFilter, setAssignFilter] = useState<"all" | "assigned" | "unassigned">("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [modal, setModal] = useState<{ open: boolean; guest?: Guest }>({
    open: false,
  });
  const [assignModal, setAssignModal] = useState<{ open: boolean; guest?: Guest }>({
    open: false,
  });
  const [unassignConfirm, setUnassignConfirm] = useState<Guest | null>(null);
  const [qrModal, setQrModal] = useState<{ open: boolean; guest?: Guest; token?: string }>({ open: false });
  const [revokeConfirm, setRevokeConfirm] = useState<{ guest: Guest; token: string } | null>(null);
  const [giftModal, setGiftModal] = useState<{ open: boolean; guest?: Guest; currentAmount: number | null }>({
    open: false,
    currentAmount: null,
  });
  const [waModal, setWaModal] = useState<{ open: boolean; guest?: Guest; message: string }>({
    open: false,
    message: "",
  });
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  // Gift map: guestCode → amount (joined from wallet transactions)
  const giftMap = useMemo(() => {
    const map = new Map<string, number>();
    transactions
      .filter((t) => (t.category as string) === "Gift")
      .forEach((t) => {
        if (t.referenceId) map.set(t.referenceId, t.amount);
      });
    return map;
  }, [transactions]);

  const currencySymbol = wallet
    ? (CURRENCY_CONFIG[wallet.currency as Currency]?.symbol ?? wallet.currency)
    : "";

  // Calculate statistics
  const stats = useMemo(() => {
    const total = guests.length;
    const assigned = guests.filter(g => g.tableId).length;
    const unassigned = guests.filter(g => !g.tableId).length;
    return { total, assigned, unassigned };
  }, [guests, giftMap]);

  // Create table lookup map
  const tableMap = useMemo(() => {
    const map = new Map<string, string>();
    tables.forEach(table => {
      map.set(table.id, table.name);
    });
    return map;
  }, [tables]);

  // Compute assigned pax count per table from guests list
  const tableOccupancy = useMemo(() => {
    const map = new Map<string, number>();
    guests.forEach(g => {
      if (g.tableId) {
        map.set(g.tableId, (map.get(g.tableId) ?? 0) + (g.pax || g.noOfPax || 1));
      }
    });
    return map;
  }, [guests]);

  // QR token lookup map keyed by guestId
  const qrMap = useMemo(() => {
    const map = new Map<string, QrToken>();
    qrTokens.forEach(t => map.set(t.guestId, t));
    return map;
  }, [qrTokens]);

  function getQrStatus(token: QrToken | undefined): QrStatus {
    if (!token) return "None";
    if (token.checkedInAt) return "CheckedIn";
    if (token.isRevoked) return "Revoked";
    return "Generated";
  }

  // Filter guests
  const filteredGuests = useMemo(() => {
    return guests.filter((g) => {
      const okType = guestTypeFilter === "All" || g.guestType === guestTypeFilter;
      const okAssign =
        assignFilter === "all" ||
        (assignFilter === "assigned" && !!g.tableId) ||
        (assignFilter === "unassigned" && !g.tableId);
      const okSearch = (g.guestName ?? g.name ?? "").toLowerCase().includes(searchTerm.toLowerCase());
      return okType && okAssign && okSearch;
    });
  }, [guests, guestTypeFilter, assignFilter, searchTerm]);

  // ─── Early returns after hooks ─────────────────────────────────────────

  if (eventsLoading) return <PageLoader message="Loading..." />;
  if (!eventId) return <NoEventsState title="No Events for Guest Management" message="Create your first event to start adding and managing your guest list." />;

  if (guestsLoading || tablesLoading) return <PageLoader message="Loading guests..." />;
  if (guestsError) return <ErrorState message="Failed to load guests." onRetry={() => window.location.reload()} />;

  const handleGenerateQr = () => {
    generateQr.mutate(eventId!, {
      onSuccess: (result) => {
        toast.success(`Generated ${result.generated} QR code${result.generated !== 1 ? "s" : ""}. ${result.skipped} skipped.`);
      },
      onError: () => {
        toast.error("Failed to generate QR codes");
      },
    });
  };

  const confirmRevoke = () => {
    if (!revokeConfirm) return;
    revokeQr.mutate({ token: revokeConfirm.token, eventId: eventId! }, {
      onSuccess: () => {
        toast.success(`QR code revoked for ${revokeConfirm.guest.guestName || revokeConfirm.guest.name}`);
        setRevokeConfirm(null);
      },
      onError: () => {
        toast.error("Failed to revoke QR code");
      },
    });
  };

  // Note: Guest deletion is not available in this module.
  // Guests can only be deleted through the RSVP module, as they are managed as part of RSVP records.

  // Handle assign table
  const handleAssignTable = (guest: Guest, tableId: string) => {
    const table = tables.find(t => t.id === tableId);
    const currentOccupancy = tableOccupancy.get(tableId) ?? 0;
    const guestPax = guest.pax || guest.noOfPax || 1;
    const willExceed = table && (currentOccupancy + guestPax) > table.capacity;

    assignGuestToTable.mutate({
      guestId: guest.guestId ?? guest.id,
      tableId: tableId,
    }, {
      onSuccess: () => {
        if (willExceed && table) {
          toast(`⚠️ ${table.name} is over capacity (${currentOccupancy + guestPax}/${table.capacity}). Guest assigned anyway.`, {
            duration: 4000,
            style: { background: "#fef3c7", color: "#92400e" },
          });
        } else {
          toast.success(`${guest.guestName || guest.name} assigned to table successfully`);
        }
        setAssignModal({ open: false });
      },
      onError: () => {
        toast.error("Failed to assign guest to table");
      },
    });
  };

  // Handle unassign table
  const handleUnassignTable = (guest: Guest) => {
    setUnassignConfirm(guest);
  };

  const confirmUnassignTable = () => {
    if (!unassignConfirm) return;
    unassignGuestFromTable.mutate(unassignConfirm.guestId ?? unassignConfirm.id, {
      onSuccess: () => {
        toast.success(`${unassignConfirm.guestName || unassignConfirm.name} unassigned from table successfully`);
        setUnassignConfirm(null);
      },
      onError: () => {
        toast.error("Failed to unassign guest from table");
      },
    });
  };

  function buildWaMessage(guestName: string, eventTitle: string): string {
    return `Hi ${guestName}! You're warmly invited to celebrate ${eventTitle} with us. Looking forward to seeing you! 🎉`;
  }

  return (
    <>
      {/* Header + Controls */}
      <div data-tour="guests-header" className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-3">
        <div>
          <h1 className="text-3xl font-display font-semibold text-primary">Guests</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage and organize your guest list</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHelpModalOpen(true)}
            title="Tips for this page"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-primary/5 text-primary border border-primary/20 hover:bg-primary/10 transition-colors"
            aria-label="Open page tips"
          >
            <LightBulbIcon className="h-3.5 w-3.5" />
            Tips
          </button>
          {!isReadOnly && (
            <Button
              data-tour="guests-generate-qr"
              variant="secondary"
              onClick={handleGenerateQr}
              disabled={generateQr.isPending}
            >
              {generateQr.isPending ? "Generating..." : "Generate QR"}
            </Button>
          )}
        </div>
      </div>

      {/* Note Banner */}
      {!bannerDismissed && (
        <div className="flex items-start gap-3 px-4 py-3 mb-5 bg-primary/5 border border-primary/20 rounded-xl text-sm text-primary">
          <span className="flex-1">
            <span className="font-medium">Note:</span> Guests are automatically created when RSVP submissions include attendees (pax &gt; 0). Guest deletion is only available through the RSVP module.
          </span>
          <button
            onClick={() => { setBannerDismissed(true); sessionStorage.setItem("guestBannerDismissed", "1"); }}
            className="flex-shrink-0 text-primary/50 hover:text-primary transition text-base leading-none mt-0.5"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div data-tour="guests-stats" className="grid grid-cols-3 gap-3 mb-6">
        <StatsCard label="Total Guests" value={stats.total} variant="primary" size="sm" icon={<UserGroupIcon className="w-4 h-4" />} />
        <StatsCard label="Assigned" value={stats.assigned} variant="success" size="sm" icon={<CheckCircleIcon className="w-4 h-4" />} />
        <StatsCard label="Unassigned" value={stats.unassigned} variant="warning" size="sm" icon={<UserIcon className="w-4 h-4" />} />
      </div>

      {/* Filters */}
      <div data-tour="guests-filters" className="flex flex-col md:flex-row md:items-center mb-4 gap-4">
        <select
          value={guestTypeFilter}
          onChange={(e) => setGuestTypeFilter(e.target.value)}
          className="w-full md:w-1/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {["All", "Family", "VIP", "Friend", "Other"].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select
          value={assignFilter}
          onChange={(e) => setAssignFilter(e.target.value as "all" | "assigned" | "unassigned")}
          className="w-full md:w-1/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="all">All Seating</option>
          <option value="assigned">Assigned</option>
          <option value="unassigned">Unassigned</option>
        </select>

        <input
          type="text"
          placeholder="Search guests by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:flex-1 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Empty State */}
      {filteredGuests.length === 0 && (
        <div className="text-center py-12">
          <UserGroupIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600 dark:text-gray-400">
            {searchTerm || guestTypeFilter !== "All" || assignFilter !== "all"
              ? "No guests match your filters"
              : "No guests yet. Create your first guest!"}
          </p>
        </div>
      )}

      {/* Guest Cards Grid */}
      {filteredGuests.length > 0 && (
        <ul className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredGuests.map((guest) => {
            const isAssigned = !!guest.tableId;
            return (
              <li
                key={guest.id}
                className={`relative p-4 rounded-lg shadow flex flex-col justify-between transition-all ${
                  isAssigned
                    ? "bg-green-50 dark:bg-green-900/10 border-2 border-green-200 dark:border-green-800"
                    : "bg-orange-50 dark:bg-orange-900/10 border-2 border-orange-200 dark:border-orange-800"
                }`}
              >
                {/* Gift badge — top left */}
                {(() => {
                  const giftAmt = giftMap.get(guest.guestCode ?? "");
                  if (giftAmt == null) return null;
                  return (
                    <span className="absolute top-2 left-2 px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500 text-white">
                      {currencySymbol} {giftAmt.toLocaleString("en-MY", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </span>
                  );
                })()}
                {/* Assignment Status Badge - Top Right */}
                <span
                  className={`absolute top-2 right-2 px-3 py-1 text-xs font-bold rounded-full ${
                    isAssigned
                      ? "bg-green-600 text-white"
                      : "bg-orange-600 text-white"
                  }`}
                >
                  {isAssigned ? "ASSIGNED" : "UNASSIGNED"}
                </span>

                <div className="space-y-2 mt-6">
                  {/* Guest Name + Code */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {guest.guestName}
                    </h3>
                    {guest.guestCode && guest.guestCode.includes("-") && (
                      <span className="px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-xs font-mono font-bold text-gray-700 dark:text-gray-200">
                        {guest.guestCode}
                      </span>
                    )}
                  </div>

                  {/* Phone Number */}
                  {guest.phoneNo && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Phone: {guest.phoneNo.startsWith("+") ? guest.phoneNo : "+" + guest.phoneNo}
                    </p>
                  )}

                  {/* Number of Attendees (Pax) */}
                  <div className="flex items-center gap-2">
                    <UserGroupIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {guest.pax || guest.noOfPax || 1} {((guest.pax || guest.noOfPax || 1) === 1) ? 'person' : 'people'}
                      {(guest.pax || guest.noOfPax || 1) > 1 }
                    </p>
                  </div>

                  {/* Guest Type + QR Status — same row */}
                  <div className="flex flex-wrap gap-2 items-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-sm font-medium border-2 ${
                        guest.guestType === "Family"
                          ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                          : guest.guestType === "VIP"
                          ? "border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400"
                          : guest.guestType === "Friend"
                          ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                          : "border-gray-400 text-gray-600 dark:border-gray-500 dark:text-gray-400"
                      }`}
                    >
                      {guest.guestType || "Other"}
                    </span>
                    <QrStatusBadge status={getQrStatus(qrMap.get(guest.guestId ?? guest.id))} />
                  </div>

                  {/* Table Assignment Display */}
                  <div className={`mt-3 px-3 py-2 rounded-lg flex items-center gap-2 ${
                    isAssigned
                      ? "bg-green-100 dark:bg-green-900/30"
                      : "bg-orange-100 dark:bg-orange-900/30"
                  }`}>
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Table Seating:</span>
                    {guest.tableId ? (
                      <span className="text-sm font-bold text-green-800 dark:text-green-300">
                        {tableMap.get(guest.tableId) || "Unknown Table"}
                      </span>
                    ) : (
                      <span className="text-sm font-bold text-orange-800 dark:text-orange-300">
                        No table assigned
                      </span>
                    )}
                  </div>

                  {/* Gift Display */}
                  {wallet && (
                    <div className={`mt-2 px-3 py-2 rounded-lg flex items-center gap-2 ${
                      giftMap.get(guest.guestCode ?? "") != null
                        ? "bg-emerald-100 dark:bg-emerald-900/30"
                        : "bg-gray-100 dark:bg-gray-800/30"
                    }`}>
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Gift:</span>
                      {giftMap.get(guest.guestCode ?? "") != null ? (
                        <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                          {currencySymbol} {giftMap.get(guest.guestCode ?? "")!.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-500 dark:text-gray-500">No gift recorded</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons — hidden for Staff (read-only) */}
                {!isReadOnly && (() => {
                  const qrToken = qrMap.get(guest.guestId ?? guest.id);
                  const qrStatus = getQrStatus(qrToken);
                  const hasOverflow = !!wallet || qrStatus === "Generated" || qrStatus === "CheckedIn";
                  return (
                    <div className="mt-4 flex items-center gap-2">
                      {/* Primary: Edit */}
                      <button
                        onClick={() => setModal({ open: true, guest })}
                        title="Edit guest"
                        className="p-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-accent dark:border-white/10 dark:text-white dark:hover:bg-white/10 transition-colors"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>

                      {/* Assign / Unassign icon button */}
                      {guest.tableId ? (
                        <button
                          onClick={() => handleUnassignTable(guest)}
                          title="Unassign from table"
                          className="p-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors"
                        >
                          <XIcon className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => setAssignModal({ open: true, guest })}
                          title="Assign to table"
                          className="p-2 rounded-lg bg-primary text-white hover:bg-button transition-colors"
                        >
                          <Chair size={16} weight="bold" />
                        </button>
                      )}

                      {/* WhatsApp Invite */}
                      <button
                        disabled={!guest.phoneNo}
                        onClick={() =>
                          setWaModal({
                            open: true,
                            guest,
                            message: buildWaMessage(
                              guest.guestName ?? guest.name ?? "Guest",
                              event?.title ?? "our event"
                            ),
                          })
                        }
                        title={guest.phoneNo ? "Send WhatsApp Invite" : "No phone number"}
                        className="p-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.555 4.122 1.523 5.855L.057 23.885a.5.5 0 0 0 .606.61l6.198-1.626A11.934 11.934 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.721 9.721 0 0 1-5.003-1.386l-.36-.214-3.724.977.993-3.614-.234-.374A9.718 9.718 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/>
                        </svg>
                      </button>

                      {/* Overflow: ⋯ */}
                      {hasOverflow && (
                        <Dropdown
                          trigger={
                            <button className="p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-accent text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors">
                              <DotsThree size={16} weight="bold" />
                            </button>
                          }
                        >
                          {wallet && (
                            <DropdownItem
                              onClick={() =>
                                setGiftModal({
                                  open: true,
                                  guest,
                                  currentAmount: giftMap.get(guest.guestCode ?? "") ?? null,
                                })
                              }
                            >
                              {giftMap.get(guest.guestCode ?? "") != null ? "Edit Gift" : "Gift"}
                            </DropdownItem>
                          )}
                          {(qrStatus === "Generated" || qrStatus === "CheckedIn") && (
                            <DropdownItem
                              onClick={() => setQrModal({ open: true, guest, token: qrToken!.token })}
                            >
                              View QR
                            </DropdownItem>
                          )}
                          {qrStatus === "Generated" && (
                            <DropdownItem
                              onClick={() => setRevokeConfirm({ guest, token: qrToken!.token })}
                              className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              Revoke QR
                            </DropdownItem>
                          )}
                        </Dropdown>
                      )}
                    </div>
                  );
                })()}
              </li>
            );
          })}
        </ul>
      )}

      {/* QR Image Modal */}
      <QrImageModal
        isOpen={qrModal.open}
        guestName={qrModal.guest?.guestName ?? qrModal.guest?.name ?? ""}
        token={qrModal.token ?? ""}
        onClose={() => setQrModal({ open: false })}
      />

      {/* Revoke QR Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={!!revokeConfirm}
        isDeleting={revokeQr.isPending}
        title="Revoke QR Code"
        description="This will invalidate the guest's QR code. They will no longer be able to check in with it."
        onConfirm={confirmRevoke}
        onCancel={() => setRevokeConfirm(null)}
      >
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Revoke QR code for <strong>{revokeConfirm?.guest.guestName || revokeConfirm?.guest.name}</strong>?
        </p>
      </DeleteConfirmationModal>

      {/* Unassign Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={!!unassignConfirm}
        isDeleting={unassignGuestFromTable.isPending}
        title="Unassign Guest from Table"
        description="This will remove the guest from their assigned table."
        onConfirm={confirmUnassignTable}
        onCancel={() => setUnassignConfirm(null)}
      >
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Remove <strong>{unassignConfirm?.guestName || unassignConfirm?.name}</strong> from{" "}
          <strong>{tableMap.get(unassignConfirm?.tableId || "")}</strong>?
        </p>
      </DeleteConfirmationModal>

      {/* Guest Form Modal */}
      <GuestFormModal
        isOpen={modal.open}
        onClose={() => setModal({ open: false })}
        guest={modal.guest}
        eventId={eventId!}
      />

      {/* Gift Recording Modal */}
      <GiftFormModal
        isOpen={giftModal.open}
        onClose={() => setGiftModal({ open: false, currentAmount: null })}
        guest={giftModal.guest ?? null}
        currentAmount={giftModal.currentAmount}
        eventGuid={eventId!}
        eventId={eventId!}
        currencySymbol={currencySymbol}
      />

      {/* Table Assignment Modal */}
      <Modal
        isOpen={assignModal.open && !!assignModal.guest}
        title={`Assign ${assignModal.guest?.guestName ?? ""} to Table`}
        onClose={() => setAssignModal({ open: false })}
        className="max-w-md"
      >
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {tables.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
              No tables available. Please create tables first.
            </p>
          ) : (
            tables.map((table) => {
              const occupied = tableOccupancy.get(table.id) ?? 0;
              const isFull = occupied >= table.capacity;
              const isOver = occupied > table.capacity;
              return (
                <button
                  key={table.id}
                  onClick={() => handleAssignTable(assignModal.guest!, table.id)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                    isOver
                      ? "border-red-400 dark:border-red-600 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      : isFull
                      ? "border-orange-300 dark:border-orange-600 hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:bg-primary/5"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-900 dark:text-white">{table.name}</p>
                    {isOver && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">Over capacity</span>
                    )}
                    {isFull && !isOver && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400">Full</span>
                    )}
                  </div>
                  <p className={`text-sm mt-0.5 ${isOver ? "text-red-600 dark:text-red-400 font-medium" : "text-gray-600 dark:text-gray-400"}`}>
                    {occupied} / {table.capacity} seats filled
                  </p>
                </button>
              );
            })
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            variant="secondary"
            onClick={() => setAssignModal({ open: false })}
          >
            Cancel
          </Button>
        </div>
      </Modal>

      {/* WhatsApp Invite Modal */}
      <Modal
        isOpen={waModal.open}
        title="Send WhatsApp Invite"
        onClose={() => setWaModal({ open: false, message: "" })}
      >
        <div className="p-6 flex flex-col gap-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            <span className="font-medium text-text">{waModal.guest?.guestName ?? waModal.guest?.name}</span>
            {waModal.guest?.phoneNo && (
              <span className="ml-2 font-mono">
                {waModal.guest.phoneNo.startsWith("+") ? waModal.guest.phoneNo : `+${waModal.guest.phoneNo}`}
              </span>
            )}
          </div>

          <textarea
            value={waModal.message}
            onChange={(e) => setWaModal((prev) => ({ ...prev, message: e.target.value }))}
            rows={5}
            className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />

          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(waModal.message).catch(() => {});
                toast.success("Message copied to clipboard");
              }}
              className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition underline underline-offset-2"
            >
              Copy text
            </button>

            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setWaModal({ open: false, message: "" })}>
                Cancel
              </Button>
              <button
                onClick={() => {
                  const phone = (waModal.guest?.phoneNo ?? "").replace(/\D/g, "");
                  const url = `https://wa.me/${phone}?text=${encodeURIComponent(waModal.message)}`;
                  window.open(url, "_blank");
                  setWaModal({ open: false, message: "" });
                }}
                className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
              >
                Open WhatsApp
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <GuestHelpModal isOpen={helpModalOpen} onClose={() => setHelpModalOpen(false)} />
    </>
  );
}
