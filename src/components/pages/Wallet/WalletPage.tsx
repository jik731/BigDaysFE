// src/components/pages/Wallet/WalletPage.tsx
import { useState, useContext } from "react";
import { PageLoader } from "../../atoms/PageLoader";
import { Button } from "../../atoms/Button";
import { useEventContext } from "../../../context/EventContext";
import { AuthContext } from "../../../context/AuthProvider";
import { useWalletsApi } from "../../../api/hooks/useWalletApi";
import { useTransactionsApi } from "../../../api/hooks/useTransactionApi";
import { SetupWalletModal } from "./SetupWalletModal";
import { TransactionFormModal } from "./TransactionFormModal";
import { ExportReportModal } from "./ExportReportModal";
import { WalletSummaryCards } from "./WalletSummaryCards";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { TransactionTable } from "./TransactionTable";
import type { Transaction } from "../../../types/transaction";
import { NoEventsState } from "../../molecules/NoEventsState";
import { ErrorState } from "../../atoms/ErrorState";

export default function WalletPage() {
  // ─── All hooks first (React Rules of Hooks) ─────────────────────────────────
  const { eventId, eventsLoading } = useEventContext()!;
  const { user } = useContext(AuthContext);

  // Fetch wallet data
  const {
    data: wallet,
    isLoading: walletLoading,
    isError: walletError,
  } = useWalletsApi(eventId ?? "");

  // Fetch transactions (only if wallet exists)
  const {
    data: transactions = [],
  } = useTransactionsApi(wallet?.walletGuid ?? "", eventId ?? "");

  // Modal states
  const [setupWalletModal, setSetupWalletModal] = useState<{ open: boolean; editMode: boolean }>({
    open: false,
    editMode: false,
  });
  const [transactionModal, setTransactionModal] = useState<{
    open: boolean;
    transaction?: Transaction;
  }>({
    open: false,
  });
  const [exportModal, setExportModal] = useState(false);

  // ─── Early returns AFTER hooks ───────────────────────────────────────────────

  // Show "no events" state if no events exist
  if (eventsLoading) return <PageLoader message="Loading..." />;
  if (!eventId) return <NoEventsState title="No Events for Budget Tracking" message="Create your first event to start managing your budget and tracking expenses." />;

  // Handle wallet setup/edit
  const handleOpenSetupWallet = (editMode: boolean = false) => {
    setSetupWalletModal({ open: true, editMode });
  };

  const handleCloseSetupWallet = () => {
    setSetupWalletModal({ open: false, editMode: false });
  };

  // Handle transaction add/edit
  const handleAddTransaction = () => {
    setTransactionModal({ open: true, transaction: undefined });
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setTransactionModal({ open: true, transaction });
  };

  const handleCloseTransactionModal = () => {
    setTransactionModal({ open: false, transaction: undefined });
  };

  // Loading state
  if (walletLoading) {
    return <PageLoader message="Loading wallet..." />;
  }

  // Error state
  if (walletError) {
    return <ErrorState message="Failed to load wallet data." onRetry={() => window.location.reload()} />;
  }

  // No wallet - show setup prompt
  if (!wallet) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md">
          <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary to-secondary text-white text-4xl font-bold grid place-items-center mx-auto mb-6 shadow-xl shadow-primary/25">
            💰
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
            Setup Your Wallet
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Get started by setting up your event wallet to track expenses and manage your budget.
          </p>
          <Button
            onClick={() => handleOpenSetupWallet(false)}
            variant="primary"
            className="bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/25"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              className="h-4 w-4 mr-2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3"
              />
            </svg>
            Setup Wallet
          </Button>
        </div>

        {/* Setup Wallet Modal */}
        <SetupWalletModal
          isOpen={setupWalletModal.open}
          onClose={handleCloseSetupWallet}
          eventGuid={eventId!}
          userId={user?.id ?? ""}
          wallet={null}
        />
      </div>
    );
  }

  // Main wallet view
  return (
    <>
      {/* Page Title & Actions */}
      <div data-tour="wallet-header" className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-display font-semibold text-primary">
            Wallet & Budget
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Track your event expenses and manage your budget
          </p>
        </div>
        <div data-tour="wallet-actions" className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            className="flex items-center gap-2"
            onClick={() => setExportModal(true)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              className="h-4 w-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
            Export
          </Button>
          <Button
            onClick={() => handleOpenSetupWallet(true)}
            className="bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/25 flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              className="h-4 w-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3"
              />
            </svg>
            Setup Wallet
          </Button>
          <Button
            onClick={handleAddTransaction}
            variant="primary"
            className="flex items-center gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              className="h-4 w-4"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Transaction
          </Button>
        </div>
      </div>

      {/* Wallet Summary Cards */}
      <div data-tour="wallet-summary">
        <WalletSummaryCards
          wallet={wallet}
          transactions={transactions}
          onEditBudget={() => handleOpenSetupWallet(true)}
        />
      </div>

      {/* Category Breakdown */}
      <CategoryBreakdown wallet={wallet} transactions={transactions} />

      {/* Transaction Table */}
      <TransactionTable
        wallet={wallet}
        transactions={transactions}
        onEditTransaction={handleEditTransaction}
      />

      {/* Modals */}
      <SetupWalletModal
        isOpen={setupWalletModal.open}
        onClose={handleCloseSetupWallet}
        eventGuid={eventId!}
        userId={user?.id || "todo"}
        wallet={setupWalletModal.editMode ? wallet : null}
      />

      <TransactionFormModal
        isOpen={transactionModal.open}
        onClose={handleCloseTransactionModal}
        walletGuid={wallet.walletGuid}
        eventGuid={eventId!}
        transaction={transactionModal.transaction}
      />

      <ExportReportModal
        isOpen={exportModal}
        onClose={() => setExportModal(false)}
        transactions={transactions}
        wallet={wallet}
      />
    </>
  );
}
