'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';

import { useWorkspaceUsers } from '@/hooks/use-channel';
import { cn, getInitials } from '@/lib/utils';

import type { DirectMessageChannel } from '@/types/channel';
import type { User } from '@/types/chat';


/**
 * Props for the DMSelector component
 */
interface DMSelectorProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback to close the dialog */
  onClose: () => void;
  /** Callback fired when creating a new DM conversation */
  onCreate: (userIds: string[]) => Promise<void>;
  /** The workspace ID for user search */
  workspaceId: string;
  /** List of recent DM conversations for quick selection */
  recentConversations: DirectMessageChannel[];
  /** External loading state */
  isLoading?: boolean;
}

export function DMSelector({
  isOpen,
  onClose,
  onCreate,
  workspaceId,
  recentConversations,
  isLoading = false,
}: DMSelectorProps) {
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { users, searchUsers, isLoading: isSearchingUsers } = useWorkspaceUsers(workspaceId);

  // Search users when query changes
  useEffect(() => {
    if (searchQuery.trim()) {
      searchUsers(searchQuery);
    }
  }, [searchQuery, searchUsers]);

  // Filter out already selected users
  const availableUsers = useMemo(
    () => users.filter((u) => !selectedUsers.some((s) => s.id === u.id)),
    [users, selectedUsers],
  );

  const resetForm = useCallback(() => {
    setSelectedUsers([]);
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
      await onCreate(selectedUsers.map((u) => u.id));
      handleClose();
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedUsers, isSubmitting, onCreate, handleClose]);

  const handleAddUser = useCallback((user: User) => {
    setSelectedUsers((prev) => [...prev, user]);
    setSearchQuery('');
  }, []);

  const handleRemoveUser = useCallback((userId: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== userId));
  }, []);

  const handleSelectRecent = useCallback(
    async (dm: DirectMessageChannel) => {
      await onCreate(dm.participants.map((p) => p.user.id));
      handleClose();
    },
    [onCreate, handleClose],
  );

  if (!isOpen) {
return null;
}

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dm-selector-title"
    >
      <div
        className="w-full max-w-md rounded-lg bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 id="dm-selector-title" className="text-lg font-semibold text-foreground">
            New message
          </h2>
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
          {/* Search input with selected users */}
          <div className="rounded-md border border-input bg-background">
            {/* Selected users chips */}
            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-1 border-b px-2 py-2">
                {selectedUsers.map((user) => (
                  <span
                    key={user.id}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                  >
                    {user.name}
                    <button
                      type="button"
                      onClick={() => handleRemoveUser(user.id)}
                      disabled={isLoading || isSubmitting}
                      className="rounded-full p-0.5 hover:bg-primary/20"
                      aria-label={`Remove ${user.name}`}
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Search input */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  selectedUsers.length > 0 ? 'Add more people...' : 'Search for users or Orchestrators...'
                }
                className="w-full border-0 bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none"
                disabled={isLoading || isSubmitting}
                aria-label="Search for users to start a conversation"
                autoComplete="off"
              />
              {isSearchingUsers && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <LoadingSpinner className="h-4 w-4" />
                </div>
              )}
            </div>
          </div>

          {/* Search results */}
          {searchQuery ? (
            <div className="mt-3 max-h-64 overflow-y-auto">
              {availableUsers.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {isSearchingUsers ? 'Searching...' : 'No users found'}
                </p>
              ) : (
                <div className="space-y-1">
                  {availableUsers.map((user) => (
                    <UserItem key={user.id} user={user} onSelect={() => handleAddUser(user)} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Recent conversations */
            <div className="mt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Recent conversations
              </h3>
              {recentConversations.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No recent conversations
                </p>
              ) : (
                <div className="space-y-1">
                  {recentConversations.slice(0, 5).map((dm) => (
                    <button
                      key={dm.id}
                      type="button"
                      onClick={() => handleSelectRecent(dm)}
                      disabled={isLoading || isSubmitting}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-accent"
                    >
                      {/* Avatar(s) */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}

                      {dm.participants.length === 1 ? (
                        <div className="relative">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-sm font-medium">
                            {dm.participants[0].user.image ? (
                              <img
                                src={dm.participants[0].user.image}
                                alt={dm.participants[0].user.name}
                                className="h-full w-full rounded-lg object-cover"
                              />
                            ) : (
                              getInitials(dm.participants[0].user.name)
                            )}
                          </div>
                          {dm.participants[0].isOrchestrator && (
                            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-md bg-primary text-[8px] font-bold text-primary-foreground">
                              AI
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="relative h-10 w-10">
                          <div className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-md border-2 border-card bg-muted text-xs font-medium">
                            {getInitials(dm.participants[0]?.user.name)}
                          </div>
                          <div className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-md border-2 border-card bg-muted text-xs font-medium">
                            {getInitials(dm.participants[1]?.user.name)}
                          </div>
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {dm.participants.map((p) => p.user.name).join(', ')}
                        </p>
                        {dm.lastMessage && (
                          <p className="truncate text-xs text-muted-foreground">
                            {dm.lastMessage.content}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
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
            {isSubmitting ? 'Starting...' : 'Start Conversation'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface UserItemProps {
  user: User;
  isOrchestrator?: boolean;
  onSelect: () => void;
}

function UserItem({ user, isOrchestrator, onSelect }: UserItemProps) {
  const statusColors = {
    online: 'bg-green-500',
    offline: 'bg-gray-400',
    away: 'bg-yellow-500',
    busy: 'bg-red-500',
  };

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-accent"
    >
      <div className="relative">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-sm font-medium">
          {/* eslint-disable-next-line @next/next/no-img-element */}

          {user.image ? (
            <img
              src={user.image}
              alt={user.name}
              className="h-full w-full rounded-lg object-cover"
            />
          ) : (
            getInitials(user.name)
          )}
        </div>
        <span
          className={cn(
            'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card',
            statusColors[user.status || 'offline'],
          )}
        />
        {isOrchestrator && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
            AI
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      </div>
    </button>
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
