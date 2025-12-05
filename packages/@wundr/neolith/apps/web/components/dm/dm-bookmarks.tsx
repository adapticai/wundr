'use client';

import {
  Bookmark,
  BookmarkX,
  ExternalLink,
  Hash,
  Loader2,
  MessageSquare,
  Search,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { UserAvatar } from '@/components/ui/user-avatar';
import { cn } from '@/lib/utils';

import type { SavedItemStatus } from '@neolith/database';

/**
 * Saved item with message details
 */
interface SavedItem {
  id: string;
  itemType: 'MESSAGE' | 'FILE';
  status: SavedItemStatus;
  note: string | null;
  createdAt: string;
  message: {
    id: string;
    content: string;
    createdAt: string;
    author: {
      id: string;
      name: string | null;
      displayName: string | null;
      avatarUrl: string | null;
      isOrchestrator: boolean;
    };
    channel: {
      id: string;
      name: string;
      slug: string;
      type: string;
    };
  } | null;
}

interface DMBookmarksProps {
  /** Workspace slug for API calls */
  workspaceSlug: string;
  /** Current DM channel ID to filter bookmarks */
  channelId: string;
  /** Callback to scroll to a message in the main view */
  onScrollToMessage?: (messageId: string) => void;
  /** Additional CSS class names */
  className?: string;
}

/**
 * DMBookmarks Component
 *
 * Displays bookmarked messages from the current DM conversation.
 * Allows users to:
 * - View all bookmarked messages from this conversation
 * - Search through bookmarks
 * - Click to navigate to the original message
 * - Remove bookmarks
 */
export function DMBookmarks({
  workspaceSlug,
  channelId,
  onScrollToMessage,
  className,
}: DMBookmarksProps) {
  const [bookmarks, setBookmarks] = useState<SavedItem[]>([]);
  const [filteredBookmarks, setFilteredBookmarks] = useState<SavedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Fetch bookmarks for this channel
  const fetchBookmarks = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/saved-items?type=MESSAGE&status=IN_PROGRESS&limit=100`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to fetch bookmarks (${response.status})`
        );
      }

      const result = await response.json();
      const allBookmarks = result.data || [];

      // Filter to only bookmarks from this channel
      const channelBookmarks = allBookmarks.filter(
        (item: SavedItem) => item.message?.channel.id === channelId
      );

      setBookmarks(channelBookmarks);
      setFilteredBookmarks(channelBookmarks);
    } catch (error) {
      console.error('Failed to fetch bookmarks:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to load bookmarks'
      );
      setBookmarks([]);
      setFilteredBookmarks([]);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceSlug, channelId]);

  // Load bookmarks on mount
  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  // Filter bookmarks based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredBookmarks(bookmarks);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = bookmarks.filter(item => {
      if (!item.message) {
        return false;
      }

      // Search in message content
      if (item.message.content.toLowerCase().includes(query)) {
        return true;
      }

      // Search in author name
      const authorName =
        item.message.author.displayName || item.message.author.name || '';
      if (authorName.toLowerCase().includes(query)) {
        return true;
      }

      // Search in note
      if (item.note?.toLowerCase().includes(query)) {
        return true;
      }

      return false;
    });

    setFilteredBookmarks(filtered);
  }, [searchQuery, bookmarks]);

  // Handle remove bookmark
  const handleRemoveBookmark = useCallback(
    async (itemId: string) => {
      setRemovingId(itemId);
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/saved-items/${itemId}`,
          {
            method: 'DELETE',
          }
        );

        if (!response.ok) {
          throw new Error('Failed to remove bookmark');
        }

        // Update local state
        setBookmarks(prev => prev.filter(item => item.id !== itemId));
        setFilteredBookmarks(prev => prev.filter(item => item.id !== itemId));
        toast.success('Bookmark removed');
      } catch (error) {
        console.error('Failed to remove bookmark:', error);
        toast.error('Failed to remove bookmark');
      } finally {
        setRemovingId(null);
      }
    },
    [workspaceSlug]
  );

  // Handle click on bookmark to scroll to message
  const handleClickBookmark = useCallback(
    (messageId: string) => {
      if (onScrollToMessage) {
        onScrollToMessage(messageId);
      }
    },
    [onScrollToMessage]
  );

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'Just now';
    }
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    if (diffDays < 7) {
      return `${diffDays}d ago`;
    }

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  if (isLoading) {
    return (
      <div className={cn('flex h-full items-center justify-center', className)}>
        <LoadingSpinner size='lg' />
      </div>
    );
  }

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Header with search */}
      <div className='border-b p-4'>
        <div className='mb-2 flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Bookmark className='h-5 w-5 text-muted-foreground' />
            <h2 className='font-semibold text-lg'>Bookmarks</h2>
          </div>
          <span className='text-muted-foreground text-sm'>
            {bookmarks.length} {bookmarks.length === 1 ? 'item' : 'items'}
          </span>
        </div>
        <div className='relative'>
          <Search className='absolute top-2.5 left-3 h-4 w-4 text-muted-foreground' />
          <Input
            type='text'
            placeholder='Search bookmarks...'
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className='pl-9 pr-9'
          />
          {searchQuery && (
            <Button
              variant='ghost'
              size='sm'
              className='absolute top-1 right-1 h-7 w-7 p-0'
              onClick={() => setSearchQuery('')}
            >
              <X className='h-4 w-4' />
            </Button>
          )}
        </div>
      </div>

      {/* Bookmarks list */}
      <div className='flex-1 overflow-y-auto'>
        {filteredBookmarks.length === 0 ? (
          <div className='flex h-full items-center justify-center p-8'>
            <EmptyState
              icon={Bookmark}
              title={searchQuery ? 'No bookmarks found' : 'No bookmarks yet'}
              description={
                searchQuery
                  ? 'Try a different search term'
                  : 'Bookmark important messages to find them easily later'
              }
            />
          </div>
        ) : (
          <div className='divide-y'>
            {filteredBookmarks.map(item => {
              if (!item.message) {
                return null;
              }

              const authorName =
                item.message.author.displayName ||
                item.message.author.name ||
                'Unknown User';

              return (
                <div
                  key={item.id}
                  className='group relative p-4 transition-colors hover:bg-accent/50'
                >
                  <div className='flex gap-3'>
                    {/* Author avatar */}
                    <UserAvatar
                      user={{
                        name: authorName,
                        avatarUrl: item.message.author.avatarUrl || undefined,
                      }}
                      size='sm'
                      className='mt-0.5'
                    />

                    {/* Message content */}
                    <div className='min-w-0 flex-1'>
                      {/* Author and timestamp */}
                      <div className='mb-1 flex items-baseline gap-2'>
                        <span className='font-medium text-sm'>
                          {authorName}
                        </span>
                        <span className='text-xs text-muted-foreground'>
                          {formatTimestamp(item.message.createdAt)}
                        </span>
                      </div>

                      {/* Message text */}
                      <p className='mb-2 text-sm text-foreground line-clamp-3'>
                        {item.message.content}
                      </p>

                      {/* Note if present */}
                      {item.note && (
                        <p className='mb-2 rounded bg-muted p-2 text-xs italic text-muted-foreground'>
                          Note: {item.note}
                        </p>
                      )}

                      {/* Actions */}
                      <div className='flex items-center gap-2'>
                        <Button
                          variant='ghost'
                          size='sm'
                          className='h-7 gap-1.5 px-2 text-xs'
                          onClick={() => handleClickBookmark(item.message!.id)}
                        >
                          <ExternalLink className='h-3 w-3' />
                          Jump to message
                        </Button>
                      </div>
                    </div>

                    {/* Remove button */}
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-8 w-8 p-0 opacity-0 transition-opacity group-hover:opacity-100'
                      onClick={() => handleRemoveBookmark(item.id)}
                      disabled={removingId === item.id}
                      title='Remove bookmark'
                    >
                      {removingId === item.id ? (
                        <Loader2 className='h-4 w-4 animate-spin' />
                      ) : (
                        <BookmarkX className='h-4 w-4' />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer with tips */}
      {bookmarks.length > 0 && (
        <div className='border-t bg-muted/30 p-3'>
          <p className='text-xs text-muted-foreground'>
            Tip: Hover over any message in the conversation and click the
            bookmark icon to save it here.
          </p>
        </div>
      )}
    </div>
  );
}
