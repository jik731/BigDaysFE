// src/components/pages/Users/UsersPage.tsx
import { PageLoader } from "../../atoms/PageLoader";
import { useState, useEffect } from "react";
import { useUserByGuidApi, useUsersListApi, useDeactivateUser, useUpdatePassword } from "../../../api/hooks/useUsersApi";
import { UserFormModal } from "../../molecules/UserFormModal";
import { DeleteConfirmationModal } from "../../molecules/DeleteConfirmationModal";
import { Button } from "../../atoms/Button";
import { PasswordInput } from "../../molecules/PasswordInput";
import { FormError } from "../../molecules/FormError";
import { useAuth } from "../../../api/hooks/useAuth";
import { validatePassword } from "../../../utils/passwordValidation";
import { getRoleLabel } from "../../../utils/jwtUtils";
import { StatsCard } from "../../atoms/StatsCard";
import { UserGroupIcon, UserIcon, ShieldCheckIcon, BriefcaseIcon } from "@heroicons/react/solid";

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export default function UsersPage() {
  const { userGuid, userRole } = useAuth();

  const { data: currentUser, isLoading: loadingCurrentUser, isError: errorCurrentUser } = useUserByGuidApi(userGuid || "");
  const { data: allUsers, isLoading: loadingAllUsers, refetch: fetchAllUsers } = useUsersListApi();

  const deactivateUser = useDeactivateUser();
  const updatePassword = useUpdatePassword();

  const [showAllUsers, setShowAllUsers] = useState(false);

  // Password form state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState(false);

  const [modal, setModal] = useState<{
    open: boolean;
    user?: {
      userGuid: string;
      fullName: string;
      email: string;
      id?: number;
      role?: number;
      createdDate?: string;
      lastUpdated?: string;
    };
  }>({ open: false });

  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    user: { userGuid: string; fullName: string; email: string; id?: number } | null;
  }>({ open: false, user: null });

  const isAdmin = userRole === 1 || userRole === 2;

  useEffect(() => {
    if (isAdmin) fetchAllUsers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalUsers = allUsers?.length ?? 0;
  const adminCount = allUsers?.filter((u: any) => u.role === 1 || u.role === 2).length ?? 0;
  const memberCount = allUsers?.filter((u: any) => u.role === 3).length ?? 0;
  const staffCount = allUsers?.filter((u: any) => u.role === 6).length ?? 0;

  const handleViewAllUsers = async () => {
    await fetchAllUsers();
    setShowAllUsers(true);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(false);

    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      setPwdError(validation.errors.join(" · "));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError("New passwords do not match.");
      return;
    }

    try {
      await updatePassword.mutateAsync({
        id: currentUser!.id,
        email: currentUser!.email,
        oldPassword,
        newPassword,
      });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwdSuccess(true);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        try {
          await updatePassword.mutateAsync({
            id: currentUser!.id,
            email: currentUser!.email,
            oldPassword,
            newPassword,
          });
          setOldPassword("");
          setNewPassword("");
          setConfirmPassword("");
          setPwdSuccess(true);
          return;
        } catch { /* fall through to show error */ }
      }
      setPwdError(err.response?.data?.message || "Failed to update password.");
    }
  };

  if (loadingCurrentUser) return <PageLoader message="Loading user profile..." />;
  if (errorCurrentUser) return <p className="text-red-500">Failed to load user profile.</p>;

  const handleDelete = (user: { userGuid: string; fullName: string; email: string; id?: number }) => {
    setDeleteModal({ open: true, user });
  };

  const handleCancelDelete = () => {
    setDeleteModal({ open: false, user: null });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.user?.id) return;
    try {
      await deactivateUser.mutateAsync(deleteModal.user.id);
      setDeleteModal({ open: false, user: null });
    } catch (error) {
      console.error("Failed to deactivate user:", error);
    }
  };

  // ─── Non-admin: two-column profile + change password ─────────────────────
  const initials = currentUser?.fullName
    ?.split(" ")
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() ?? "?";

  if (!isAdmin) {
    return (
      <>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-display font-semibold text-primary">My Profile</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Update your profile and account settings</p>
          </div>
        </div>

        {!currentUser ? (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-yellow-800 dark:text-yellow-200">
              Unable to load user profile. Please try logging in again.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* Left: Profile summary card */}
            <div data-tour="users-profile" className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              {/* Avatar */}
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-bold mb-4">
                {initials}
              </div>

              <h3 className="text-xl font-semibold">{currentUser.fullName}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{currentUser.email}</p>

              {/* Role badge */}
              <span className="inline-block mt-3 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                {getRoleLabel(currentUser.role)}
              </span>

              {/* Metadata */}
              <div className="mt-6 space-y-2 text-sm border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Member since</span>
                  <span className="font-medium">{formatDate(currentUser.createdDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Last updated</span>
                  <span className="font-medium">{formatDate(currentUser.lastUpdated)}</span>
                </div>
              </div>
            </div>

            {/* Right: Change password */}
            <div data-tour="users-password" className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Change Password
                </h4>
                {pwdError && <FormError message={pwdError} />}
                {pwdSuccess && (
                  <p className="text-sm text-green-600 dark:text-green-400">Password updated successfully.</p>
                )}
                <PasswordInput
                  label="Current Password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                  placeholder="Enter current password"
                  autoComplete="current-password"
                />
                <PasswordInput
                  label="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  showValidation
                  showStrength
                  required
                  placeholder="Enter new password"
                  autoComplete="new-password"
                />
                <PasswordInput
                  label="Confirm New Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                />
                <div className="flex justify-end">
                  <Button type="submit" loading={updatePassword.isPending}>
                    {updatePassword.isPending ? "Updating…" : "Update Password"}
                  </Button>
                </div>
              </form>
            </div>

          </div>
        )}
      </>
    );
  }

  // ─── Admin: list view with View All Users ──────────────────────────────────
  const usersToDisplay = showAllUsers ? allUsers : (currentUser ? [currentUser] : []);

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-display font-semibold text-primary">
            {showAllUsers ? "All Users" : "My Profile"}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {showAllUsers ? "Manage user accounts and permissions" : "Update your profile and account settings"}
          </p>
        </div>
        <div data-tour="users-actions" className="flex gap-2">
          {!showAllUsers && (
            <Button onClick={handleViewAllUsers} disabled={loadingAllUsers}>
              {loadingAllUsers ? "Loading..." : "View All Users"}
            </Button>
          )}
          {showAllUsers && (
            <Button variant="secondary" onClick={() => setShowAllUsers(false)}>
              View My Profile
            </Button>
          )}
          {showAllUsers && (
            <Button onClick={() => setModal({ open: true })}>New User</Button>
          )}
        </div>
      </div>

      {!currentUser && !showAllUsers ? (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200">
            Unable to load user profile. Please try logging in again.
          </p>
        </div>
      ) : showAllUsers ? (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {Array.isArray(usersToDisplay) &&
            usersToDisplay.map((u: any) => (
              <li
                key={u.userGuid}
                className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow flex justify-between items-center"
              >
                <div>
                  <p className="text-lg font-medium">{u.fullName}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{u.email}</p>
                  {u.role !== undefined && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {getRoleLabel(u.role)}
                    </p>
                  )}
                </div>
                <div className="space-x-2">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setModal({
                        open: true,
                        user: {
                          userGuid: u.userGuid,
                          fullName: u.fullName,
                          email: u.email,
                          id: u.id,
                          role: u.role,
                          createdDate: u.createdDate,
                          lastUpdated: u.lastUpdated,
                        },
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleDelete({ userGuid: u.userGuid, fullName: u.fullName, email: u.email, id: u.id })}
                  >
                    Deactivate
                  </Button>
                </div>
              </li>
            ))}
        </ul>
      ) : (
        <>
          {/* Stats strip */}
          <div data-tour="users-stats" className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatsCard
              label="Total Users"
              value={loadingAllUsers ? "…" : totalUsers}
              variant="primary"
              size="sm"
              icon={<UserGroupIcon className="w-4 h-4" />}
            />
            <StatsCard
              label="Admins"
              value={loadingAllUsers ? "…" : adminCount}
              variant="accent"
              size="sm"
              icon={<ShieldCheckIcon className="w-4 h-4" />}
            />
            <StatsCard
              label="Members"
              value={loadingAllUsers ? "…" : memberCount}
              variant="success"
              size="sm"
              icon={<UserIcon className="w-4 h-4" />}
            />
            <StatsCard
              label="Staff"
              value={loadingAllUsers ? "…" : staffCount}
              variant="secondary"
              size="sm"
              icon={<BriefcaseIcon className="w-4 h-4" />}
            />
          </div>

          {/* Rich profile card — same layout as member */}
          {currentUser && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div data-tour="users-profile" className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-bold mb-4">
                  {initials}
                </div>
                <h3 className="text-xl font-semibold">{currentUser.fullName}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{currentUser.email}</p>
                <span className="inline-block mt-3 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  {getRoleLabel(currentUser.role)}
                </span>
                <div className="mt-6 space-y-2 text-sm border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Member since</span>
                    <span className="font-medium">{formatDate(currentUser.createdDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Last updated</span>
                    <span className="font-medium">{formatDate(currentUser.lastUpdated)}</span>
                  </div>
                </div>
              </div>

              <div data-tour="users-password" className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Change Password
                  </h4>
                  {pwdError && <FormError message={pwdError} />}
                  {pwdSuccess && (
                    <p className="text-sm text-green-600 dark:text-green-400">Password updated successfully.</p>
                  )}
                  <PasswordInput
                    label="Current Password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    required
                    placeholder="Enter current password"
                    autoComplete="current-password"
                  />
                  <PasswordInput
                    label="New Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    showValidation
                    showStrength
                    required
                    placeholder="Enter new password"
                    autoComplete="new-password"
                  />
                  <PasswordInput
                    label="Confirm New Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                  />
                  <div className="flex justify-end">
                    <Button type="submit" loading={updatePassword.isPending}>
                      {updatePassword.isPending ? "Updating…" : "Update Password"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      <UserFormModal
        isOpen={modal.open}
        onClose={() => setModal({ open: false })}
        initial={modal.user}
      />

      <DeleteConfirmationModal
        isOpen={deleteModal.open}
        isDeleting={deactivateUser.isPending}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        title="Deactivate User?"
        description="Are you sure you want to deactivate this user? They will no longer be able to log in."
      >
        {deleteModal.user && (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800 dark:text-white mb-1">
                  {deleteModal.user.fullName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Email: {deleteModal.user.email}
                </p>
              </div>
            </div>
          </div>
        )}
      </DeleteConfirmationModal>
    </>
  );
}
