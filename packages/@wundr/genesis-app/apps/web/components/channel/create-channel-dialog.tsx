'use client';

import { useState, useCallback, useEffect } from 'react';

import { useWorkspaceUsers } from '@/hooks/use-channel';
import { cn } from '@/lib/utils';

import type { User } from '@/types/chat';

interface CreateChannelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (input: {
    name: string;
    type: 'public' | 'private';
    description?: string;
    memberIds?: string[];
  }) => Promise<void>;
  workspaceId: string;
  isLoading?: boolean;
}

export function CreateChannelDialog({
  isOpen,
  onClose,
  onCreate,
  workspaceId,
  isLoading = false,
}: CreateChannelDialogProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'public' | 'private'>('public');
  const [description, setDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<User[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { users, searchUsers, isLoading: isSearchingUsers } = useWorkspaceUsers(workspaceId);

  // Search users when query changes
  useEffect(() => {
    if (memberSearch.trim()) {
      searchUsers(memberSearch);
    }
  }, [memberSearch, searchUsers]);

  const resetForm = useCallback(() => {
    setName('');
    setType('public');
    setDescription('');
    setSelectedMembers([]);
    setMemberSearch('');
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!name.trim() || isSubmitting) {
return;
}

    setIsSubmitting(true);
    try {
      await onCreate({
        name: name.trim().toLowerCase().replace(/\s+/g, '-'),
        type,
        description: description.trim() || undefined,
        memberIds: selectedMembers.map((m) => m.id),
      });
      handleClose();
    } finally {
      setIsSubmitting(false);
    }
  }, [name, type, description, selectedMembers, isSubmitting, onCreate, handleClose]);

  const handleAddMember = useCallback((user: User) => {
    setSelectedMembers((prev) => {
      if (prev.some((m) => m.id === user.id)) {
return prev;
}
      return [...prev, user];
    });
    setMemberSearch('');
  }, []);

  const handleRemoveMember = useCallback((userId: string) => {
    setSelectedMembers((prev) => prev.filter((m) => m.id !== userId));
  }, []);

  // Format channel name as user types
  const displayName = name.trim().toLowerCase().replace(/\s+/g, '-');
  const isValid = name.trim().length > 0;

  if (!isOpen) {
return null;
}

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-channel-title"
    >
      <div
        className="w-full max-w-lg rounded-lg bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 id="create-channel-title" className="text-lg font-semibold text-foreground">
            Create a channel
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
            Channels are where your team communicates. They&apos;re best when organized around a
            topic.
          </p>

          {/* Name input */}
          <div className="mb-4">
            <label htmlFor="channel-name" className="mb-1 block text-sm font-medium text-foreground">
              Name
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                #
              </span>
              <input
                id="channel-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. marketing"
                className="w-full rounded-md border border-input bg-background py-2 pl-7 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                disabled={isLoading || isSubmitting}
                maxLength={80}
              />
            </div>
            {name && (
              <p className="mt-1 text-xs text-muted-foreground">
                Channel will be created as:{' '}
                <span className="font-medium text-foreground">#{displayName}</span>
              </p>
            )}
          </div>

          {/* Type selector */}
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-foreground">Visibility</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setType('public')}
                disabled={isLoading || isSubmitting}
                className={cn(
                  'flex flex-1 items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                  type === 'public'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50',
                )}
              >
                <div
                  className={cn(
                    'mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border',
                    type === 'public' ? 'border-primary bg-primary' : 'border-muted-foreground',
                  )}
                >
                  {type === 'public' && (
                    <span className="h-2 w-2 rounded-full bg-primary-foreground" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <HashIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Public</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Anyone in the workspace can view and join
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType('private')}
                disabled={isLoading || isSubmitting}
                className={cn(
                  'flex flex-1 items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                  type === 'private'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50',
                )}
              >
                <div
                  className={cn(
                    'mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border',
                    type === 'private' ? 'border-primary bg-primary' : 'border-muted-foreground',
                  )}
                >
                  {type === 'private' && (
                    <span className="h-2 w-2 rounded-full bg-primary-foreground" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <LockIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Private</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Only specific people can view and join
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Description */}
          <div className="mb-4">
            <label
              htmlFor="channel-description"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Description{' '}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="channel-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this channel about?"
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={isLoading || isSubmitting}
              maxLength={250}
            />
          </div>

          {/* Add members */}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Add members{' '}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </label>

            {/* Selected members */}
            {selectedMembers.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {selectedMembers.map((member) => (
                  <span
                    key={member.id}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-sm text-secondary-foreground"
                  >
                    {member.name}
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member.id)}
                      disabled={isLoading || isSubmitting}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-secondary-foreground/10"
                      aria-label={`Remove ${member.name}`}
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
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search by name..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                disabled={isLoading || isSubmitting}
              />
              {isSearchingUsers && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <LoadingSpinner className="h-4 w-4" />
                </div>
              )}
            </div>

            {/* Search results */}
            {memberSearch && users.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-md border bg-background">
                {users
                  .filter((u) => !selectedMembers.some((m) => m.id === u.id))
                  .map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleAddMember(user)}
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
                  ))}
              </div>
            )}

            {memberSearch && users.length === 0 && !isSearchingUsers && (
              <p className="mt-2 text-sm text-muted-foreground">No users found</p>
            )}
          </div>
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
            disabled={!isValid || isLoading || isSubmitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create Channel'}
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

function HashIcon({ className }: { className?: string }) {
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
      <path d="M4 9h16" />
      <path d="M4 15h16" />
      <path d="M10 3 8 21" />
      <path d="M16 3 14 21" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
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
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
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
