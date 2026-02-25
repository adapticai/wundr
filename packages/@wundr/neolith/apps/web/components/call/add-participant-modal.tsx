'use client';

import { useState, useCallback, useMemo } from 'react';
import { Search, Check } from 'lucide-react';

import { cn, getInitials } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/**
 * User search result type
 */
export interface UserSearchResult {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

/**
 * Props for the AddParticipantModal component
 */
export interface AddParticipantModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Callback when users are invited */
  onInvite: (userIds: string[], message?: string) => Promise<void>;
  /** Workspace ID to search users from */
  workspaceId: string;
  /** Call ID to invite users to */
  callId: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * AddParticipantModal component - modal for inviting more people to an active call
 *
 * Features:
 * - Search users in the workspace
 * - Multi-select users to invite
 * - Optional invitation message
 * - Shows already invited users
 */
export function AddParticipantModal({
  isOpen,
  onClose,
  onInvite,
  workspaceId,
  className,
}: AddParticipantModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Search users
  const handleSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/members/search?q=${encodeURIComponent(query)}`
        );
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data.users || []);
        }
      } catch (error) {
        console.error('Failed to search users:', error);
      } finally {
        setIsSearching(false);
      }
    },
    [workspaceId]
  );

  // Debounced search
  const debouncedSearch = useMemo(() => {
    let timeout: NodeJS.Timeout;
    return (query: string) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => handleSearch(query), 300);
    };
  }, [handleSearch]);

  // Handle search input change
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const query = e.target.value;
      setSearchQuery(query);
      debouncedSearch(query);
    },
    [debouncedSearch]
  );

  // Toggle user selection
  const toggleUser = useCallback((userId: string) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  }, []);

  // Handle invite
  const handleInvite = useCallback(async () => {
    if (selectedUsers.size === 0) {
      return;
    }

    setIsLoading(true);
    try {
      await onInvite(Array.from(selectedUsers), message || undefined);
      // Reset form
      setSelectedUsers(new Set());
      setMessage('');
      setSearchQuery('');
      setSearchResults([]);
      onClose();
    } catch (error) {
      console.error('Failed to invite users:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedUsers, message, onInvite, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn('max-w-md max-h-[80vh] flex flex-col p-0', className)}
      >
        <DialogHeader className='p-4 border-b border-border'>
          <DialogTitle>Add people to call</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className='p-4 border-b border-border'>
          <div className='relative'>
            <Search className='w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' />
            <Input
              type='text'
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder='Search by name or email...'
              className='pl-10'
              aria-label='Search users'
            />
          </div>
        </div>

        {/* Results */}
        <div className='flex-1 overflow-y-auto p-2'>
          {isSearching ? (
            <div className='flex items-center justify-center py-8'>
              <div className='text-sm text-muted-foreground'>Searching...</div>
            </div>
          ) : searchResults.length > 0 ? (
            <div className='space-y-1'>
              {searchResults.map(user => (
                <button
                  key={user.id}
                  onClick={() => toggleUser(user.id)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg transition-colors',
                    selectedUsers.has(user.id)
                      ? 'bg-stone-700/10 dark:bg-stone-600/10'
                      : 'hover:bg-muted'
                  )}
                >
                  {/* Checkbox */}
                  <div
                    className={cn(
                      'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                      selectedUsers.has(user.id)
                        ? 'bg-stone-700 dark:bg-stone-600 border-stone-700 dark:border-stone-600'
                        : 'border-border'
                    )}
                  >
                    {selectedUsers.has(user.id) && (
                      <Check className='w-3 h-3 text-white' />
                    )}
                  </div>

                  {/* Avatar */}
                  <div className='w-10 h-10 rounded-full bg-stone-500/10 flex items-center justify-center text-stone-700 dark:text-stone-300 font-medium text-sm'>
                    {getInitials(user.name)}
                  </div>

                  {/* Info */}
                  <div className='flex-1 text-left min-w-0'>
                    <p className='text-sm font-medium truncate'>{user.name}</p>
                    <p className='text-xs text-muted-foreground truncate'>
                      {user.email}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : searchQuery ? (
            <div className='flex items-center justify-center py-8'>
              <div className='text-sm text-muted-foreground'>
                No users found
              </div>
            </div>
          ) : (
            <div className='flex items-center justify-center py-8'>
              <div className='text-sm text-muted-foreground'>
                Search for people to invite
              </div>
            </div>
          )}
        </div>

        {/* Message (optional) */}
        {selectedUsers.size > 0 && (
          <div className='p-4 border-t border-border'>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder='Add an optional message...'
              rows={2}
              className='w-full px-3 py-2 rounded-lg resize-none bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-stone-700 dark:focus:ring-stone-600 text-sm'
              maxLength={500}
            />
          </div>
        )}

        {/* Footer */}
        <div className='p-4 border-t border-border flex items-center justify-between'>
          <div className='text-sm text-muted-foreground'>
            {selectedUsers.size} selected
          </div>
          <div className='flex items-center gap-2'>
            <Button onClick={onClose} variant='ghost' size='sm'>
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={selectedUsers.size === 0 || isLoading}
              size='sm'
              className='bg-stone-700 dark:bg-stone-600 hover:bg-stone-800 dark:hover:bg-stone-700'
            >
              {isLoading ? 'Inviting...' : 'Invite'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AddParticipantModal;
