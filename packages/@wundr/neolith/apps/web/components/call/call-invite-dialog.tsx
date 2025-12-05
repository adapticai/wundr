'use client';

import { clsx } from 'clsx';
import { useState, useCallback, useEffect, useRef } from 'react';

import { getInitials } from '@/lib/utils';

import type { User } from '@/types/chat';

/**
 * Props for the CallInviteDialog component.
 */
export interface CallInviteDialogProps {
  /** Whether the dialog is currently open */
  isOpen: boolean;
  /** Callback when the dialog should close */
  onClose: () => void;
  /** Callback when users are invited with their IDs and notification preference */
  onInvite: (userIds: string[], sendNotification: boolean) => void;
  /** The invite link to share for joining the call */
  inviteLink: string;
  /** The workspace ID for fetching members */
  workspaceId: string;
  /** The call ID for context (reserved for future use with call-specific invites) */
  callId: string;
  /** Additional CSS classes to apply */
  className?: string;
}

/**
 * Search result user item
 */
function UserSearchItem({
  user,
  isSelected,
  onSelect,
}: {
  user: User;
  isSelected: boolean;
  onSelect: (user: User) => void;
}) {
  const avatarUrl = user.image;

  return (
    <button
      onClick={() => onSelect(user)}
      className={clsx(
        'w-full flex items-center gap-3 p-2 rounded-lg',
        'transition-colors',
        isSelected
          ? 'bg-stone-500/10 text-stone-700 dark:text-stone-300'
          : 'hover:bg-muted text-foreground',
      )}
      role='option'
      aria-selected={isSelected}
    >
      <div
        className={clsx(
          'w-8 h-8 rounded-full flex items-center justify-center',
          'bg-stone-500/10 text-stone-700 dark:text-stone-300 font-medium',
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}

        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={user.name || 'User'}
            className='w-full h-full rounded-lg object-cover'
          />
        ) : (
          getInitials(user.name || user.email)
        )}
      </div>
      <div className='flex-1 text-left min-w-0'>
        <p className='text-sm font-medium truncate'>{user.name}</p>
        <p className='text-xs text-muted-foreground truncate'>{user.email}</p>
      </div>
      {isSelected && (
        <svg
          xmlns='http://www.w3.org/2000/svg'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
          className='w-5 h-5 text-stone-700 dark:text-stone-300'
        >
          <polyline points='20 6 9 17 4 12' />
        </svg>
      )}
    </button>
  );
}

/**
 * Selected user chip
 */
function SelectedUserChip({
  user,
  onRemove,
}: {
  user: User;
  onRemove: (userId: string) => void;
}) {
  return (
    <div
      className={clsx(
        'inline-flex items-center gap-1.5 px-2 py-1',
        'bg-stone-500/10 text-stone-700 dark:text-stone-300 rounded-full',
      )}
    >
      <span className='text-sm'>{user.name || user.email}</span>
      <button
        onClick={() => onRemove(user.id)}
        className='hover:bg-stone-500/20 rounded-full p-0.5 transition-colors'
        aria-label={`Remove ${user.name || user.email}`}
      >
        <svg
          xmlns='http://www.w3.org/2000/svg'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
          className='w-3 h-3'
        >
          <line x1='18' x2='6' y1='6' y2='18' />
          <line x1='6' x2='18' y1='6' y2='18' />
        </svg>
      </button>
    </div>
  );
}

/**
 * Call invite dialog for searching and inviting users to a call
 */
export function CallInviteDialog({
  isOpen,
  onClose,
  onInvite,
  inviteLink,
  workspaceId,
  callId: _callId,
  className,
}: CallInviteDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sendNotification, setSendNotification] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus search input when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    } else {
      // Reset state when dialog closes
      setSearchQuery('');
      setSearchResults([]);
      setSelectedUsers([]);
      setCopySuccess(false);
    }
  }, [isOpen]);

  // Search users
  const searchUsers = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);

      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/members?search=${encodeURIComponent(query)}`,
        );
        if (!response.ok) {
          throw new Error('Failed to search users');
        }

        const data = await response.json();
        setSearchResults(data.members || []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [workspaceId],
  );

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers]);

  // Handle user selection
  const handleSelectUser = useCallback((user: User) => {
    setSelectedUsers(prev => {
      const isAlreadySelected = prev.some(u => u.id === user.id);
      if (isAlreadySelected) {
        return prev.filter(u => u.id !== user.id);
      }
      return [...prev, user];
    });
  }, []);

  // Handle user removal
  const handleRemoveUser = useCallback((userId: string) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userId));
  }, []);

  // Copy invite link
  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = inviteLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  }, [inviteLink]);

  // Handle invite
  const handleInvite = useCallback(() => {
    if (selectedUsers.length > 0) {
      onInvite(
        selectedUsers.map(u => u.id),
        sendNotification,
      );
      onClose();
    }
  }, [selectedUsers, sendNotification, onInvite, onClose]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle click outside
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dialogRef.current &&
        !dialogRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={clsx(
        'fixed inset-0 z-50',
        'flex items-center justify-center',
        'bg-background/80 backdrop-blur-sm',
        className,
      )}
      role='dialog'
      aria-modal='true'
      aria-labelledby='invite-dialog-title'
    >
      <div
        ref={dialogRef}
        className={clsx(
          'w-full max-w-md',
          'bg-card border border-border rounded-xl',
          'shadow-lg',
          'animate-scale-in',
        )}
      >
        {/* Header */}
        <div className='flex items-center justify-between px-4 py-3 border-b border-border'>
          <h2
            id='invite-dialog-title'
            className='text-lg font-semibold text-foreground'
          >
            Invite to call
          </h2>
          <button
            onClick={onClose}
            className={clsx(
              'w-8 h-8 rounded-lg flex items-center justify-center',
              'hover:bg-muted transition-colors',
              'text-muted-foreground hover:text-foreground',
            )}
            aria-label='Close dialog'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
              className='w-5 h-5'
            >
              <line x1='18' x2='6' y1='6' y2='18' />
              <line x1='6' x2='18' y1='6' y2='18' />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className='p-4 space-y-4'>
          {/* Copy link section */}
          <div className='space-y-2'>
            <label className='text-sm font-medium text-foreground'>
              Invite link
            </label>
            <div className='flex gap-2'>
              <input
                type='text'
                value={inviteLink}
                readOnly
                className={clsx(
                  'flex-1 px-3 py-2 rounded-lg',
                  'bg-muted border border-border',
                  'text-sm text-muted-foreground',
                  'truncate',
                )}
              />
              <button
                onClick={handleCopyLink}
                className={clsx(
                  'px-4 py-2 rounded-lg',
                  'bg-muted hover:bg-muted/80',
                  'text-sm font-medium',
                  'transition-colors',
                  copySuccess && 'text-green-500',
                )}
              >
                {copySuccess ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className='flex items-center gap-3'>
            <div className='flex-1 h-px bg-border' />
            <span className='text-xs text-muted-foreground'>
              or invite by name
            </span>
            <div className='flex-1 h-px bg-border' />
          </div>

          {/* Search section */}
          <div className='space-y-2'>
            <label
              htmlFor='user-search'
              className='text-sm font-medium text-foreground'
            >
              Search users
            </label>
            <div className='relative'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
                className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground'
              >
                <circle cx='11' cy='11' r='8' />
                <path d='m21 21-4.3-4.3' />
              </svg>
              <input
                ref={searchInputRef}
                id='user-search'
                type='text'
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder='Search by name or email...'
                className={clsx(
                  'w-full pl-10 pr-4 py-2 rounded-lg',
                  'bg-muted border border-border',
                  'text-foreground placeholder:text-muted-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-stone-500',
                )}
              />
            </div>
          </div>

          {/* Selected users */}
          {selectedUsers.length > 0 && (
            <div className='flex flex-wrap gap-2'>
              {selectedUsers.map(user => (
                <SelectedUserChip
                  key={user.id}
                  user={user}
                  onRemove={handleRemoveUser}
                />
              ))}
            </div>
          )}

          {/* Search results */}
          <div className='max-h-48 overflow-auto space-y-1' role='listbox'>
            {isSearching ? (
              <div className='py-4 text-center text-sm text-muted-foreground'>
                Searching...
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map(user => (
                <UserSearchItem
                  key={user.id}
                  user={user}
                  isSelected={selectedUsers.some(u => u.id === user.id)}
                  onSelect={handleSelectUser}
                />
              ))
            ) : searchQuery.length >= 2 ? (
              <div className='py-4 text-center text-sm text-muted-foreground'>
                No users found
              </div>
            ) : null}
          </div>

          {/* Send notification option */}
          {selectedUsers.length > 0 && (
            <label className='flex items-center gap-2 cursor-pointer'>
              <input
                type='checkbox'
                checked={sendNotification}
                onChange={e => setSendNotification(e.target.checked)}
                className='w-4 h-4 rounded border-border text-stone-700 dark:text-stone-600 focus:ring-stone-500'
              />
              <span className='text-sm text-foreground'>
                Send notification to invited users
              </span>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className='flex justify-end gap-2 px-4 py-3 border-t border-border'>
          <button
            onClick={onClose}
            className={clsx(
              'px-4 py-2 rounded-lg',
              'bg-muted hover:bg-muted/80',
              'text-sm font-medium text-foreground',
              'transition-colors',
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleInvite}
            disabled={selectedUsers.length === 0}
            className={clsx(
              'px-4 py-2 rounded-lg',
              'bg-stone-700 hover:bg-stone-800 dark:bg-stone-600 dark:hover:bg-stone-700',
              'text-sm font-medium text-white',
              'transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            Invite {selectedUsers.length > 0 && `(${selectedUsers.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CallInviteDialog;
