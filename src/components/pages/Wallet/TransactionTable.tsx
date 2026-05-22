// src/components/pages/Wallet/TransactionTable.tsx
import React, { useState, useMemo } from "react";
import type { Transaction } from "../../../types/transaction";
import { TransactionType, PaymentStatus } from "../../../types/transaction";
import { CATEGORY_CONFIG, getAllCategories, getCategoryConfig } from "../../../utils/categoryConfig";
import { formatAmount, getTransactionTypeLabel } from "../../../utils/transactionUtils";
import type { Wallet } from "../../../types/wallet";
import { CURRENCY_CONFIG } from "../../../types/wallet";
import { useDeleteTransaction } from "../../../api/hooks/useTransactionApi";
import { DeleteConfirmationModal } from "../../molecules/DeleteConfirmationModal";
import { PencilIcon, TrashIcon } from "@heroicons/react/outline";

interface TransactionTableProps {
  wallet: Wallet;
  transactions: Transaction[];
  onEditTransaction: (transaction: Transaction) => void;
}

export const TransactionTable: React.FC<TransactionTableProps> = ({
  wallet,
  transactions,
  onEditTransaction,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    transaction: Transaction | null;
  }>({ open: false, transaction: null });

  const deleteTransaction = useDeleteTransaction();
  const currencySymbol = CURRENCY_CONFIG[wallet.currency].symbol;

  // Filter and search transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((txn) => {
      // Category filter
      if (categoryFilter !== "All" && txn.category !== categoryFilter) {
        return false;
      }

      // Type filter
      if (typeFilter !== "All") {
        const isDebit = typeFilter === "Debit";
        if ((isDebit && txn.type !== TransactionType.Debit) ||
            (!isDebit && txn.type !== TransactionType.Credit)) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== "All" && txn.paymentStatus !== statusFilter) {
        return false;
      }

      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          txn.transactionName.toLowerCase().includes(search) ||
          txn.vendorName?.toLowerCase().includes(search) ||
          txn.referenceId?.toLowerCase().includes(search)
        );
      }

      return true;
    });
  }, [transactions, categoryFilter, typeFilter, statusFilter, searchTerm]);

  // Sort by date (newest first)
  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      const dateA = a.transactionDate ? new Date(a.transactionDate).getTime() : 0;
      const dateB = b.transactionDate ? new Date(b.transactionDate).getTime() : 0;
      return dateB - dateA;
    });
  }, [filteredTransactions]);

  const handleDelete = (transaction: Transaction) => {
    setDeleteModal({ open: true, transaction });
  };

  const handleCancelDelete = () => {
    setDeleteModal({ open: false, transaction: null });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.transaction) return;

    try {
      await deleteTransaction.mutateAsync({
        transactionGuid: deleteModal.transaction.transactionGuid,
        walletGuid: deleteModal.transaction.walletGuid,
        eventGuid: deleteModal.transaction.eventGuid,
      });
      setDeleteModal({ open: false, transaction: null });
    } catch (error) {
      console.error("Failed to delete transaction:", error);
      alert("Failed to delete transaction. Please try again.");
    }
  };

  const getStatusBadge = (status?: PaymentStatus) => {
    if (!status) return null;

    const config = {
      [PaymentStatus.Paid]: {
        bg: "bg-emerald-100 dark:bg-emerald-900/30",
        text: "text-emerald-700 dark:text-emerald-400",
        dot: "bg-emerald-500",
        label: "Paid",
        icon: "✅",
      },
      [PaymentStatus.Pending]: {
        bg: "bg-amber-100 dark:bg-amber-900/30",
        text: "text-amber-700 dark:text-amber-400",
        dot: "bg-amber-500",
        label: "Pending",
        icon: "🕐",
      },
      [PaymentStatus.Overdue]: {
        bg: "bg-red-100 dark:bg-red-900/30",
        text: "text-red-700 dark:text-red-400",
        dot: "bg-red-500 animate-pulse",
        label: "Overdue",
        icon: "⚠️",
      },
    };

    const style = config[status];

    return (
      <span
        className={`px-2.5 py-1 text-xs font-semibold rounded-full ${style.bg} ${style.text} flex items-center gap-1 w-fit`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
        {style.label}
      </span>
    );
  };

  const getRowClassName = (transaction: Transaction): string => {
    let className = "transaction-row transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50";
    
    if (transaction.paymentStatus === PaymentStatus.Pending) {
      className += " bg-amber-50/30 dark:bg-amber-900/10";
    } else if (transaction.paymentStatus === PaymentStatus.Overdue) {
      className += " bg-red-50/30 dark:bg-red-900/10";
    }

    return className;
  };

  return (
    <div>
      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
        <div className="flex flex-wrap gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="All">All Categories</option>
            {getAllCategories().map((cat) => {
              const config = CATEGORY_CONFIG[cat];
              return (
                <option key={cat} value={cat}>
                  {config.emoji} {config.label}
                </option>
              );
            })}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="All">All Types</option>
            <option value="Debit">📤 Debit (Expense)</option>
            <option value="Credit">📥 Credit (Income)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="All">All Status</option>
            <option value={PaymentStatus.Paid}>✅ Paid</option>
            <option value={PaymentStatus.Pending}>🕐 Pending</option>
            <option value={PaymentStatus.Overdue}>⚠️ Overdue</option>
          </select>
        </div>

        <div className="flex-1">
          <div className="relative">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search transactions, vendors, reference ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg overflow-hidden">
        <div data-tour="wallet-transactions" className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📋</span>
            <h3 className="font-semibold text-slate-800 dark:text-white">Transaction History</h3>
            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-primary/10 text-primary">
              {sortedTransactions.length} transaction{sortedTransactions.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Sorted by: <span className="font-medium text-slate-700 dark:text-slate-300">Date (Newest)</span>
          </div>
        </div>

        {sortedTransactions.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm || categoryFilter !== "All" || typeFilter !== "All" || statusFilter !== "All"
                ? "No transactions match your filters. Try adjusting your search criteria."
                : "No transactions yet. Click 'Add Transaction' to get started."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-left">
                <tr>
                  <th className="hidden sm:table-cell px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Transaction
                  </th>
                  <th className="hidden md:table-cell px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="hidden md:table-cell px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Vendor
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="hidden sm:table-cell px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {sortedTransactions.map((txn) => {
                  const categoryConfig = getCategoryConfig(txn.category);
                  const vendorInitials = txn.vendorName
                    ? txn.vendorName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .substring(0, 2)
                        .toUpperCase()
                    : null;

                  return (
                    <tr key={txn.transactionGuid} className={getRowClassName(txn)}>
                      <td className="hidden sm:table-cell px-4 py-4">
                        <div className="text-sm font-medium text-slate-800 dark:text-white">
                          {txn.transactionDate
                            ? new Date(txn.transactionDate).toLocaleDateString("en-MY", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "N/A"}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-10 w-10 rounded-xl ${categoryConfig.bgColor} grid place-items-center text-lg`}
                          >
                            {categoryConfig.emoji}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-800 dark:text-white">
                              {txn.transactionName}
                            </p>
                            {txn.referenceId && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Ref: {txn.referenceId}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="hidden md:table-cell px-4 py-4">
                        <span
                          className={`px-2.5 py-1 text-xs font-medium rounded-full ${categoryConfig.bgColor} ${categoryConfig.textColor}`}
                        >
                          {categoryConfig.label}
                        </span>
                      </td>
                      <td className="hidden md:table-cell px-4 py-4">
                        {txn.vendorName ? (
                          <div className="flex items-center gap-2">
                            <div
                              className={`h-7 w-7 rounded-lg bg-gradient-to-br from-${categoryConfig.color}-500 to-${categoryConfig.color}-700 text-white text-xs font-bold grid place-items-center`}
                            >
                              {vendorInitials}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-800 dark:text-white">
                                {txn.vendorName}
                              </p>
                              {txn.vendorContact && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {txn.vendorContact}
                                </p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div
                          className={`text-sm font-bold ${
                            txn.type === TransactionType.Debit
                              ? "text-red-600 dark:text-red-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {txn.type === TransactionType.Debit ? "- " : "+ "}
                          {formatAmount(txn.amount, currencySymbol)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {getTransactionTypeLabel(txn.type)}
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-4">{getStatusBadge(txn.paymentStatus)}</td>
                      <td className="px-4 py-4">
                        <div className="flex gap-1">
                          <button
                            onClick={() => onEditTransaction(txn)}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition"
                            title="Edit"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(txn)}
                            disabled={deleteTransaction.isPending}
                            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition disabled:opacity-50"
                            title="Delete"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModal.open}
        isDeleting={deleteTransaction.isPending}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        title="Delete Transaction?"
        description="Are you sure you want to delete this transaction? This will permanently remove it from your records."
      >
        {deleteModal.transaction && (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800 dark:text-white mb-1">
                  {deleteModal.transaction.transactionName}
                </p>
                {deleteModal.transaction.vendorName && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Vendor: {deleteModal.transaction.vendorName}
                  </p>
                )}
                {deleteModal.transaction.referenceId && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Ref: {deleteModal.transaction.referenceId}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${
                  deleteModal.transaction.type === 1
                    ? "text-red-600 dark:text-red-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}>
                  {deleteModal.transaction.type === 1 ? "-" : "+"} {deleteModal.transaction.amount.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {deleteModal.transaction.category}
                </p>
              </div>
            </div>
          </div>
        )}
      </DeleteConfirmationModal>
    </div>
  );
};
