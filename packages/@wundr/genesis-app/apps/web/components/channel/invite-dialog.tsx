'use client';

import { useState, useCallback, useEffect } from 'react';

import { useWorkspaceUsers } from '@/hooks/use-channel';
import { cn } from '@/lib/utils';

import type { User } from '@/types/chat';

interface InviteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (userIds: string[], role: 'admin' | 'member') => Promise<void>;
  workspaceId: string;
  channelName: string;
  existingMemberIds: string[];
  isLoading?: boolean;
}

export function InviteDialog({
  isOpen,
  onClose,
  onInvite,
  workspaceId,
  channelName,
  existingMemberIds,
  isLoading = false,
}: InviteDialogProps) {
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { users, searchUsers, isLoading: isSearchingUsers } = useWorkspaceUsers(workspaceId);

  // Search users when query changes
  useEffect(() => {
    if (searchQuery.trim()) {
      searchUsers(searchQuery);
    }
  }, [searchQuery, searchUsers]);

  // Filter out existing members and already selected users
  const availableUsers = users.filter(
    (u) =>
      !existingMemberIds.includes(u.id) && !selectedUsers.some((s) => s.id === u.id),
  );

  const resetForm = useCallback(() => {
    setSelectedUsers([]);
    setRole('member');
    setSearchQuery('');
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleSubmit = useCallback(async () => {
    if (selectedUsers.length === 0 || isSubmitting) {
return;
}

    setIsSubmitting(true);
    try {
      await onInvite(
        selectedUsers.map((u) => u.id),
        role,
      );
      handleClose();
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedUsers, role, isSubmitting, onInvite, handleClose]);

  const handleAddUser = useCallback((user: User) => {
    setSelectedUsers((prev) => [...prev, user]);
    setSearchQuery('');
  }, []);

  const handleRemoveUser = useCallback((userId: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== userId));
  }, []);

  if (!isOpen) {
return null;
}

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-dialog-title"
    >
      <div
        className="w-full max-w-md rounded-lg bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 id="invite-dialog-title" className="text-lg font-semibold text-foreground">
              Invite people to #{channelName}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close dialog"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {/* Search input */}
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={isLoading || isSubmitting}
            />
            {isSearchingUsers && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <LoadingSpinner className="h-4 w-4" />
              </div>
            )}
          </div>

          {/* Selected users */}
          {selectedUsers.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedUsers.map((user) => (
                <span
                  key={user.id}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-sm text-primary"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  {user.name}
                  <button
                    type="button"
                    onClick={() => handleRemoveUser(user.id)}
                    disabled={isLoading || isSubmitting}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20"
                    aria-label={`Remove ${user.name}`}
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search results */}
          {searchQuery && (
            <div className="mt-3 max-h-48 overflow-y-auto rounded-md border bg-background">
              {availableUsers.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                  {isSearchingUsers ? 'Searching...' : 'No users found'}
                </p>
              ) : (
                availableUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleAddUser(user)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                      {user.image ? (
                        <img
                          src={user.image}
                          alt={user.name}
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        user.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Role selection */}
          {selectedUsers.length > 0 && (
            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-foreground">
                Invite as
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setRole('member')}
                  disabled={isLoading || isSubmitting}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                    role === 'member'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50',
                  )}
                >
                  <MemberIcon className="h-4 w-4" />
                  Member
                </button>
                <button
                  type="button"
                  onClick={() => setRole('admin')}
                  disabled={isLoading || isSubmitting}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                    role === 'admin'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50',
                  )}
                >
                  <ShieldIcon className="h-4 w-4" />
                  Admin
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading || isSubmitting}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={selectedUsers.length === 0 || isLoading || isSubmitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting
              ? 'Sending...'
              : `Send Invite${selectedUsers.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function MemberIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
