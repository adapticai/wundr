'use client';

import {
  Hash,
  User,
  Users,
  Search,
  Loader2,
  Link2,
  FileIcon,
  X,
  Bot,
} from 'lucide-react';
import { useState, useCallback, useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useIsDesktop } from '@/hooks/use-media-query';

/**
 * File data to share
 */
export interface ShareFileData {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url?: string;
  thumbnailUrl?: string;
  uploadedBy?: {
    id: string;
    name: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
  uploadedAt?: string;
}

/**
 * Search result types from the search API
 */
interface ChannelResult {
  type: 'channel';
  id: string;
  name: string;
  description: string | null;
  type_value: string;
  memberCount: number;
}

interface UserResult {
  type: 'user';
  id: string;
  name: string | null;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  isOrchestrator: boolean;
}

interface DMResult {
  type: 'dm';
  id: string;
  name: string;
  participants: Array<{
    id: string;
    name: string | null;
    avatarUrl: string | null;
    isOrchestrator: boolean;
  }>;
}

interface OrchestratorResult {
  type: 'orchestrator';
  id: string;
  name: string | null;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  discipline: string | null;
  role: string | null;
}

type SearchResult = ChannelResult | UserResult | DMResult | OrchestratorResult;

/**
 * Props for the ShareFileDialog component
 */
interface ShareFileDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when the dialog should close */
  onOpenChange: (open: boolean) => void;
  /** The file data to share */
  file: ShareFileData | null;
  /** The workspace slug for API calls */
  workspaceSlug: string;
  /** Current user ID (to exclude from search results) */
  currentUserId?: string;
  /** Callback when file is successfully shared */
  onShareSuccess?: (
    destinations: Array<{ type: string; id: string; name: string }>
  ) => void;
}

/**
 * Share File Dialog Component
 *
 * Allows users to share/forward files to channels, DMs, or users within the workspace.
 * Similar to Slack's share file dialog.
 */
export function ShareFileDialog({
  open,
  onOpenChange,
  file,
  workspaceSlug,
  currentUserId,
  onShareSuccess,
}: ShareFileDialogProps) {
  const isDesktop = useIsDesktop();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedDestinations, setSelectedDestinations] = useState<
    SearchResult[]
  >([]);
  const [message, setMessage] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedDestinations([]);
      setMessage('');
      setError(null);
      // Focus search input when dialog opens
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [open]);

  // Search function with debounce
  const performSearch = useCallback(
    async (query: string) => {
      if (!query.trim() || query.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          q: query,
          types: 'channels,users,orchestrators,dms',
          limit: '15',
        });

        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/search?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error('Search failed');
        }

        const result = await response.json();
        let results = result.data || [];

        // Filter out current user from results
        if (currentUserId) {
          results = results.filter((r: SearchResult) => {
            if (r.type === 'user') {
              return r.id !== currentUserId;
            }
            return true;
          });
        }

        setSearchResults(results);
      } catch (err) {
        console.error('Search error:', err);
        setError('Failed to search. Please try again.');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [workspaceSlug, currentUserId]
  );

  // Debounced search
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(() => {
        performSearch(value);
      }, 300);
    },
    [performSearch]
  );

  // Handle selecting a destination (add to list if not already selected)
  const handleSelectDestination = useCallback((result: SearchResult) => {
    setSelectedDestinations(prev => {
      // Check if already selected
      const isAlreadySelected = prev.some(
        d => d.type === result.type && d.id === result.id
      );
      if (isAlreadySelected) {
        return prev;
      }
      return [...prev, result];
    });
    setSearchQuery('');
    setSearchResults([]);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  // Handle removing a destination from selection
  const handleRemoveDestination = useCallback((result: SearchResult) => {
    setSelectedDestinations(prev =>
      prev.filter(d => !(d.type === result.type && d.id === result.id))
    );
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  // Handle clearing all selections
  const handleClearAll = useCallback(() => {
    setSelectedDestinations([]);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  // Copy link to clipboard
  const handleCopyLink = useCallback(async () => {
    if (!file?.url) {
      return;
    }

    try {
      await navigator.clipboard.writeText(file.url);
      // Could add toast notification here
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  }, [file?.url]);

  // Share the file to all selected destinations
  const handleShare = useCallback(async () => {
    if (!file || selectedDestinations.length === 0) {
      return;
    }

    setIsSharing(true);
    setError(null);

    const successfulShares: Array<{ type: string; id: string; name: string }> =
      [];
    const messageContent = message.trim() || '';

    try {
      // Process each destination
      for (const destination of selectedDestinations) {
        let channelId: string;
        let destinationName: string;

        if (destination.type === 'channel') {
          channelId = destination.id;
          destinationName = `#${destination.name}`;
        } else if (destination.type === 'dm') {
          channelId = destination.id;
          destinationName = destination.name;
        } else if (
          destination.type === 'user' ||
          destination.type === 'orchestrator'
        ) {
          // For users and orchestrators, we need to create or get an existing DM channel
          const dmResponse = await fetch(
            `/api/workspaces/${workspaceSlug}/conversations`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                participantIds: [destination.id],
              }),
            }
          );

          if (!dmResponse.ok) {
            throw new Error(
              `Failed to create conversation with ${destination.displayName || destination.name}`
            );
          }

          const dmResult = await dmResponse.json();
          channelId = dmResult.data?.id || dmResult.id;
          destinationName =
            destination.displayName ||
            destination.name ||
            (destination.type === 'user' ? destination.email : 'AI Assistant');
        } else {
          continue; // Skip invalid destination types
        }

        // Send message with file attachment
        const response = await fetch(`/api/channels/${channelId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: messageContent,
            attachmentIds: [file.id],
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || `Failed to share file to ${destinationName}`
          );
        }

        successfulShares.push({
          type: destination.type,
          id: channelId,
          name: destinationName,
        });
      }

      // Success!
      if (successfulShares.length > 0) {
        onShareSuccess?.(successfulShares);
      }

      onOpenChange(false);
    } catch (err) {
      console.error('Share error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to share file. Please try again.'
      );
    } finally {
      setIsSharing(false);
    }
  }, [
    file,
    selectedDestinations,
    message,
    workspaceSlug,
    onShareSuccess,
    onOpenChange,
  ]);

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Render search result item
  const renderSearchResult = (result: SearchResult) => {
    if (result.type === 'channel') {
      return (
        <button
          key={`channel-${result.id}`}
          type='button'
          className='flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-accent'
          onClick={() => handleSelectDestination(result)}
        >
          <div className='flex h-8 w-8 items-center justify-center rounded-md bg-muted'>
            <Hash className='h-4 w-4 text-muted-foreground' />
          </div>
          <div className='flex-1 min-w-0'>
            <div className='truncate font-medium'>{result.name}</div>
            {result.description && (
              <div className='truncate text-xs text-muted-foreground'>
                {result.description}
              </div>
            )}
          </div>
          <div className='text-xs text-muted-foreground'>
            {result.memberCount} members
          </div>
        </button>
      );
    }

    if (result.type === 'user') {
      return (
        <button
          key={`user-${result.id}`}
          type='button'
          className='flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-accent'
          onClick={() => handleSelectDestination(result)}
        >
          <UserAvatar
            user={{
              name: result.name,
              avatarUrl: result.avatarUrl,
            }}
            size='sm'
          />
          <div className='flex-1 min-w-0'>
            <div className='truncate font-medium'>
              {result.displayName || result.name}
            </div>
            <div className='truncate text-xs text-muted-foreground'>
              {result.email}
            </div>
          </div>
          {result.isOrchestrator && (
            <span className='rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary'>
              AI
            </span>
          )}
        </button>
      );
    }

    if (result.type === 'dm') {
      return (
        <button
          key={`dm-${result.id}`}
          type='button'
          className='flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-accent'
          onClick={() => handleSelectDestination(result)}
        >
          <div className='flex h-8 w-8 items-center justify-center rounded-md bg-muted'>
            <Users className='h-4 w-4 text-muted-foreground' />
          </div>
          <div className='flex-1 min-w-0'>
            <div className='truncate font-medium'>{result.name}</div>
            <div className='truncate text-xs text-muted-foreground'>
              {result.participants.length} participants
            </div>
          </div>
        </button>
      );
    }

    if (result.type === 'orchestrator') {
      return (
        <button
          key={`orchestrator-${result.id}`}
          type='button'
          className='flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-accent'
          onClick={() => handleSelectDestination(result)}
        >
          <div className='relative'>
            <UserAvatar
              user={{
                name: result.name,
                avatarUrl: result.avatarUrl,
              }}
              size='sm'
            />
            <div className='absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary'>
              <Bot className='h-2 w-2 text-primary-foreground' />
            </div>
          </div>
          <div className='flex-1 min-w-0'>
            <div className='truncate font-medium'>
              {result.displayName || result.name}
            </div>
            <div className='truncate text-xs text-muted-foreground'>
              {result.discipline || result.role || 'AI Assistant'}
            </div>
          </div>
          <span className='rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary'>
            AI
          </span>
        </button>
      );
    }

    return null;
  };

  // Helper to get icon and name for a destination
  const getDestinationDisplay = (destination: SearchResult) => {
    let icon: React.ReactNode;
    let name: string;

    if (destination.type === 'channel') {
      icon = <Hash className='h-3 w-3' />;
      name = destination.name;
    } else if (destination.type === 'dm') {
      icon = <Users className='h-3 w-3' />;
      name = destination.name;
    } else if (destination.type === 'orchestrator') {
      icon = <Bot className='h-3 w-3' />;
      name = destination.displayName || destination.name || 'AI Assistant';
    } else {
      icon = <User className='h-3 w-3' />;
      name = destination.displayName || destination.name || destination.email;
    }

    return { icon, name };
  };

  // Render selected destination chips
  const renderSelectedDestinations = () => {
    if (selectedDestinations.length === 0) {
      return null;
    }

    return (
      <div className='flex flex-wrap gap-1.5'>
        {selectedDestinations.map(destination => {
          const { icon, name } = getDestinationDisplay(destination);
          return (
            <div
              key={`${destination.type}-${destination.id}`}
              className='flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary'
            >
              {icon}
              <span className='max-w-[120px] truncate'>{name}</span>
              <button
                type='button'
                onClick={() => handleRemoveDestination(destination)}
                className='ml-0.5 rounded hover:bg-primary/20'
              >
                <X className='h-3 w-3' />
              </button>
            </div>
          );
        })}
        {selectedDestinations.length > 1 && (
          <button
            type='button'
            onClick={handleClearAll}
            className='text-xs text-muted-foreground hover:text-foreground'
          >
            Clear all
          </button>
        )}
      </div>
    );
  };

  if (!file) {
    return null;
  }

  // Shared content for both Dialog and Drawer
  const sharedContent = (
    <div className='space-y-4'>
      {/* Selected destinations */}
      {selectedDestinations.length > 0 && (
        <div className='space-y-2'>
          <div className='text-xs font-medium text-muted-foreground'>
            Sharing with {selectedDestinations.length}{' '}
            {selectedDestinations.length === 1 ? 'destination' : 'destinations'}
          </div>
          {renderSelectedDestinations()}
        </div>
      )}

      {/* Search input */}
      <div className='relative'>
        <div className='flex items-center gap-2 rounded-md border bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring'>
          <Search className='h-4 w-4 text-muted-foreground' />
          <input
            ref={searchInputRef}
            type='text'
            placeholder={
              selectedDestinations.length > 0
                ? 'Add another destination...'
                : 'Search for channel or person'
            }
            className='flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground'
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
          />
          {isSearching && (
            <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />
          )}
        </div>

        {/* Search results dropdown */}
        {searchResults.length > 0 && (
          <div className='absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover p-1 shadow-lg'>
            {searchResults.map(renderSearchResult)}
          </div>
        )}
      </div>

      {/* Message input */}
      <div>
        <textarea
          placeholder='Add a message if you like.'
          className='min-h-[80px] w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring'
          value={message}
          onChange={e => setMessage(e.target.value)}
        />
      </div>

      {/* File preview */}
      {(() => {
        const isImage = file.mimeType.startsWith('image/');
        const imagePreviewUrl =
          file.thumbnailUrl || (isImage ? file.url : null);

        return (
          <div className='rounded-md border bg-muted/50 p-3'>
            <div className='flex items-center gap-3'>
              <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-background overflow-hidden'>
                {isImage && imagePreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imagePreviewUrl}
                    alt={file.name}
                    className='h-full w-full object-cover'
                  />
                ) : (
                  <FileIcon className='h-5 w-5 text-muted-foreground' />
                )}
              </div>
              <div className='flex-1 min-w-0'>
                <div className='truncate font-medium text-sm'>{file.name}</div>
                <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                  {file.uploadedBy && (
                    <>
                      <span>
                        {file.uploadedBy.displayName || file.uploadedBy.name}
                      </span>
                      <span>•</span>
                    </>
                  )}
                  {file.uploadedAt && (
                    <>
                      <span>
                        {new Date(file.uploadedAt).toLocaleDateString()}
                      </span>
                      <span>•</span>
                    </>
                  )}
                  <span>{formatFileSize(file.size)}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Access info */}
      {selectedDestinations.length > 0 && (
        <div className='rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground'>
          {(() => {
            // Calculate total access count
            let totalAccess = 0;
            let hasOrchestrator = false;
            selectedDestinations.forEach(dest => {
              if (dest.type === 'channel') {
                totalAccess += dest.memberCount;
              } else if (dest.type === 'dm') {
                totalAccess += dest.participants.length;
              } else if (dest.type === 'orchestrator') {
                hasOrchestrator = true;
                totalAccess += 1;
              } else {
                totalAccess += 1;
              }
            });

            if (selectedDestinations.length === 1) {
              const dest = selectedDestinations[0];
              if (dest.type === 'channel') {
                return `${dest.memberCount} members will have access`;
              } else if (dest.type === 'dm') {
                return `${dest.participants.length} people will have access`;
              } else if (dest.type === 'orchestrator') {
                return 'This AI assistant will have access';
              }
              return '1 user will have access';
            }

            return `File will be shared with ${selectedDestinations.length} destinations (${totalAccess} recipients${hasOrchestrator ? ', including AI' : ''})`;
          })()}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className='rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive'>
          {error}
        </div>
      )}

      {/* Actions */}
      <div className='flex items-center justify-between'>
        <button
          type='button'
          className='flex items-center gap-1.5 text-sm text-primary hover:underline'
          onClick={handleCopyLink}
        >
          <Link2 className='h-4 w-4' />
          Copy link
        </button>

        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={isSharing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleShare}
            disabled={selectedDestinations.length === 0 || isSharing}
          >
            {isSharing ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Sharing...
              </>
            ) : selectedDestinations.length > 1 ? (
              `Forward to ${selectedDestinations.length}`
            ) : (
              'Forward'
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  // Desktop: use Dialog
  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>Share this file</DialogTitle>
          </DialogHeader>
          {sharedContent}
        </DialogContent>
      </Dialog>
    );
  }

  // Mobile/Tablet: use Drawer
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className='max-h-[90vh]'>
        <DrawerHeader>
          <DrawerTitle>Share this file</DrawerTitle>
        </DrawerHeader>
        <div className='overflow-y-auto px-4 pb-4'>{sharedContent}</div>
      </DrawerContent>
    </Drawer>
  );
}

export default ShareFileDialog;
