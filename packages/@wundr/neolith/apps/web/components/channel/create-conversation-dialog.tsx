'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useWorkspaceUsers } from '@/hooks/use-channel';
import { cn } from '@/lib/utils';

import type { User } from '@/types/chat';

/**
 * Props for the CreateConversationDialog component
 */
interface CreateConversationDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback to close the dialog */
  onClose: () => void;
  /** The workspace ID for the new DM */
  workspaceId: string;
  /** Optional callback fired when DM is created */
  onCreateDM?: (channelId: string) => void;
}

/**
 * Response from the DM creation API
 */
interface CreateDMResponse {
  data: {
    id: string;
    type: string;
    workspaceId: string;
    participant: {
      id: string;
      name: string;
      avatarUrl?: string | null;
      status?: 'online' | 'offline' | 'away' | 'busy';
      isOrchestrator?: boolean;
    };
  };
  isNew: boolean;
  message: string;
}

export function CreateConversationDialog({
  isOpen,
  onClose,
  workspaceId,
  onCreateDM,
}: CreateConversationDialogProps) {
  const router = useRouter();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const { users, searchUsers, isLoading: isSearchingUsers } = useWorkspaceUsers(workspaceId);

  // Search users when query changes
  useEffect(() => {
    if (userSearch.trim()) {
      searchUsers(userSearch);
    }
  }, [userSearch, searchUsers]);

  const resetForm = useCallback(() => {
    setSelectedUser(null);
    setUserSearch('');
    setError(null);
    setInviteSuccess(null);
  }, []);

  // Check if the search query looks like a valid email
  const isValidEmail = useCallback((email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }, []);

  const handleInviteUser = useCallback(async () => {
    if (!userSearch.trim() || !isValidEmail(userSearch) || isInviting) {
      return;
    }

    setIsInviting(true);
    setError(null);
    setInviteSuccess(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/admin/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invites: [{ email: userSearch.trim(), role: 'MEMBER' }],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 403) {
          throw new Error('You do not have permission to invite users to this workspace');
        }
        throw new Error(errorData.error?.message || 'Failed to send invite');
      }

      setInviteSuccess(`Invitation sent to ${userSearch.trim()}`);
      setUserSearch('');
    } catch (err) {
      console.error('Failed to send invite:', err);
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  }, [userSearch, workspaceId, isInviting, isValidEmail]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!selectedUser || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/dm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUser.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to create conversation');
      }

      const result: CreateDMResponse = await response.json();

      // Call the callback if provided
      if (onCreateDM) {
        onCreateDM(result.data.id);
      }

      // Navigate to the new DM channel
      router.push(`/${workspaceId}/channels/${result.data.id}`);

      // Close dialog and reset
      resetForm();
      onClose();
    } catch (err) {
      console.error('Failed to create DM:', err);
      setError(err instanceof Error ? err.message : 'Failed to create conversation');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedUser, workspaceId, isSubmitting, onCreateDM, router, resetForm, onClose]);

  const handleSelectUser = useCallback((user: User) => {
    setSelectedUser(user);
    setUserSearch('');
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedUser(null);
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
      aria-labelledby="create-conversation-title"
    >
      <div
        className="w-full max-w-lg rounded-lg bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 id="create-conversation-title" className="text-lg font-semibold text-foreground">
            Start a conversation
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
        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
          <p className="mb-4 text-sm text-muted-foreground">
            Direct messages are private conversations between you and another person.
          </p>

          {/* Error message */}
          {error && (
            <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Success message */}
          {inviteSuccess && (
            <div className="mb-4 rounded-md border border-green-500/50 bg-green-50 dark:bg-green-900/10 px-3 py-2">
              <p className="text-sm text-green-700 dark:text-green-300">{inviteSuccess}</p>
            </div>
          )}

          {/* Selected user */}
          {selectedUser && (
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-foreground">
                Selected user
              </label>
              <div className="flex items-center gap-3 rounded-lg border bg-secondary p-3">
                <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium">
                  {selectedUser.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedUser.image}
                      alt={selectedUser.name}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    selectedUser.name.charAt(0).toUpperCase()
                  )}
                  {selectedUser.status && (
                    <span
                      className={cn(
                        'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-secondary',
                        {
                          'bg-green-500': selectedUser.status === 'online',
                          'bg-gray-400': selectedUser.status === 'offline',
                          'bg-yellow-500': selectedUser.status === 'away',
                          'bg-red-500': selectedUser.status === 'busy',
                        },
                      )}
                    />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{selectedUser.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                </div>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  disabled={isSubmitting}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Clear selection"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* User search */}
          {!selectedUser && (
            <div>
              <label htmlFor="user-search" className="mb-2 block text-sm font-medium text-foreground">
                Search for a user
              </label>

              {/* Search input */}
              <div className="relative">
                <input
                  id="user-search"
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Type a name or email..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  disabled={isSubmitting}
                  autoFocus
                />
                {isSearchingUsers && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <LoadingSpinner className="h-4 w-4" />
                  </div>
                )}
              </div>

              {/* Search results */}
              {userSearch && users.length > 0 && (
                <div className="mt-2 max-h-60 overflow-y-auto rounded-md border bg-background">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleSelectUser(user)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent"
                    >
                      <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium">
                        {user.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={user.image}
                            alt={user.name}
                            className="h-full w-full rounded-full object-cover"
                          />
                        ) : (
                          user.name.charAt(0).toUpperCase()
                        )}
                        {user.status && (
                          <span
                            className={cn(
                              'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background',
                              {
                                'bg-green-500': user.status === 'online',
                                'bg-gray-400': user.status === 'offline',
                                'bg-yellow-500': user.status === 'away',
                                'bg-red-500': user.status === 'busy',
                              },
                            )}
                          />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {userSearch && users.length === 0 && !isSearchingUsers && (
                <div className="mt-2 rounded-md border bg-muted/50 px-3 py-6 text-center">
                  <p className="text-sm text-muted-foreground">No users found</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Try a different name or email
                  </p>
                  {isValidEmail(userSearch) && (
                    <div className="mt-4 border-t pt-4">
                      <p className="text-xs text-muted-foreground mb-2">
                        Not a workspace member yet?
                      </p>
                      <button
                        type="button"
                        onClick={handleInviteUser}
                        disabled={isInviting}
                        className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                      >
                        {isInviting ? (
                          <>
                            <LoadingSpinner className="h-3 w-3" />
                            Sending invite...
                          </>
                        ) : (
                          <>
                            <InviteIcon className="h-3 w-3" />
                            Invite {userSearch} to workspace
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!userSearch && (
                <div className="mt-2 rounded-md border bg-muted/50 px-3 py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    Start typing to search for users
                  </p>
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
            disabled={isSubmitting}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedUser || isSubmitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner className="h-4 w-4" />
                Starting...
              </span>
            ) : (
              'Start Conversation'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
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

function InviteIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" x2="19" y1="8" y2="14" />
      <line x1="22" x2="16" y1="11" y2="11" />
    </svg>
  );
}
