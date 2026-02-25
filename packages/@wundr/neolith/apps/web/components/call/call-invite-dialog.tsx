'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Check, X, Search } from 'lucide-react';

import { cn, getInitials } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

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
      className={cn(
        'w-full flex items-center gap-3 p-2 rounded-lg',
        'transition-colors',
        isSelected
          ? 'bg-stone-500/10 text-stone-700 dark:text-stone-300'
          : 'hover:bg-muted text-foreground'
      )}
      role='option'
      aria-selected={isSelected}
    >
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center',
          'bg-stone-500/10 text-stone-700 dark:text-stone-300 font-medium'
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
        <Check className='w-5 h-5 text-stone-700 dark:text-stone-300' />
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
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1',
        'bg-stone-500/10 text-stone-700 dark:text-stone-300 rounded-full'
      )}
    >
      <span className='text-sm'>{user.name || user.email}</span>
      <button
        onClick={() => onRemove(user.id)}
        className='hover:bg-stone-500/20 rounded-full p-0.5 transition-colors'
        aria-label={`Remove ${user.name || user.email}`}
      >
        <X className='w-3 h-3' />
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
          `/api/workspaces/${workspaceId}/members?search=${encodeURIComponent(query)}`
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
    [workspaceId]
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
        sendNotification
      );
      onClose();
    }
  }, [selectedUsers, sendNotification, onInvite, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn('max-w-md', className)}>
        <DialogHeader>
          <DialogTitle>Invite to call</DialogTitle>
          <DialogDescription>
            Share the link or search for users to invite to this call
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          {/* Copy link section */}
          <div className='space-y-2'>
            <label className='text-sm font-medium text-foreground'>
              Invite link
            </label>
            <div className='flex gap-2'>
              <Input
                type='text'
                value={inviteLink}
                readOnly
                className='flex-1 text-sm text-muted-foreground'
              />
              <Button
                onClick={handleCopyLink}
                variant='outline'
                className={cn(copySuccess && 'text-green-500')}
              >
                {copySuccess ? 'Copied!' : 'Copy'}
              </Button>
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
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground' />
              <Input
                ref={searchInputRef}
                id='user-search'
                type='text'
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder='Search by name or email...'
                className='pl-10'
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
              <Checkbox
                checked={sendNotification}
                onCheckedChange={checked =>
                  setSendNotification(checked as boolean)
                }
              />
              <span className='text-sm text-foreground'>
                Send notification to invited users
              </span>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className='flex justify-end gap-2 pt-4'>
          <Button onClick={onClose} variant='outline'>
            Cancel
          </Button>
          <Button
            onClick={handleInvite}
            disabled={selectedUsers.length === 0}
            className='bg-stone-700 hover:bg-stone-800 dark:bg-stone-600 dark:hover:bg-stone-700'
          >
            Invite {selectedUsers.length > 0 && `(${selectedUsers.length})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CallInviteDialog;
