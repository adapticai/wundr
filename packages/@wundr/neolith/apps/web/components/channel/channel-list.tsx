'use client';

import {
  Eye,
  Copy,
  Link as LinkIcon,
  Bell,
  BellOff,
  Star,
  ExternalLink,
  LogOut,
  EyeOff,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useCallback, useMemo, useEffect } from 'react';

import { ConnectedUserAvatar } from '@/components/presence/user-avatar-with-presence';
import { ChannelListSkeleton } from '@/components/skeletons';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useWorkspaceUsers } from '@/hooks/use-channel';
import { cn } from '@/lib/utils';

import { CreateChannelDialog } from './create-channel-dialog';

import type {
  Channel,
  DirectMessageChannel,
  DirectMessageParticipant,
} from '@/types/channel';
import type { User } from '@/types/chat';

/**
 * Flat participant structure (when API returns user properties directly on participant)
 */
interface FlatParticipant {
  id: string;
  name?: string;
  displayName?: string;
  avatarUrl?: string | null;
  status?: string | null;
  isOrchestrator?: boolean;
}

/**
 * Union type that handles both nested and flat participant structures
 * API can return either:
 * - Nested: DirectMessageParticipant with { id, user: User, isOrchestrator }
 * - Flat: { id, name, avatarUrl, status, isOrchestrator } (user properties at top level)
 */
type ParticipantStructure = DirectMessageParticipant | FlatParticipant;

/**
 * Type guard to check if participant has nested user structure
 */
function hasNestedUser(
  participant: ParticipantStructure,
): participant is DirectMessageParticipant {
  return (
    'user' in participant &&
    participant.user !== null &&
    participant.user !== undefined
  );
}

/**
 * Safely extract participant ID, handling both flat and nested structures
 */
function getParticipantId(participant: ParticipantStructure): string {
  if (hasNestedUser(participant)) {
    return participant.user.id;
  }
  return participant.id;
}

/**
 * Props for the ChannelList component
 */
interface ChannelListProps {
  /** The workspace ID for routing */
  workspaceId: string;
  /** Current user ID for DM list ordering */
  currentUserId?: string;
  /** List of channels to display */
  channels: Channel[];
  /** List of direct message conversations */
  directMessages: DirectMessageChannel[];
  /** List of starred/favorite channels */
  starredChannels: Channel[];
  /** List of starred/favorite DMs */
  starredDMs?: DirectMessageChannel[];
  /** Loading state for the channel list */
  isLoading?: boolean;
  /** Error state for the channel list */
  error?: Error | null;
  /** Callback fired when creating a new channel */
  onCreateChannel?: (input: {
    name: string;
    type: 'public' | 'private';
    description?: string;
    memberIds?: string[];
  }) => Promise<void>;
  /** Callback fired when retrying to load channels */
  onRetry?: () => void;
  /** Callback fired when channel star status changes */
  onChannelStarChange?: (channelId: string, isStarred: boolean) => void;
  /** Callback fired when DM star status changes */
  onDMStarChange?: (dmId: string, isStarred: boolean) => void;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Search result type for messages
 */
interface MessageSearchResult {
  id: string;
  content: string;
  channelId: string;
  channelName: string;
  authorName: string;
  createdAt: Date;
}

export function ChannelList({
  workspaceId,
  currentUserId,
  channels,
  directMessages,
  starredChannels,
  starredDMs = [],
  isLoading = false,
  error = null,
  onCreateChannel,
  onRetry,
  onChannelStarChange,
  onDMStarChange,
  className,
}: ChannelListProps) {
  console.log('[ChannelList] Rendered with callbacks:', {
    hasOnChannelStarChange: !!onChannelStarChange,
    hasOnDMStarChange: !!onDMStarChange,
  });
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    starred: true,
    channels: true,
    directMessages: true,
  });
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [messageSearchResults, setMessageSearchResults] = useState<
    MessageSearchResult[]
  >([]);
  const [isSearchingMessages, setIsSearchingMessages] = useState(false);

  // Get workspace users for people search
  const {
    users: workspaceUsers,
    searchUsers,
    isLoading: isSearchingUsers,
  } = useWorkspaceUsers(workspaceId);

  // Note: Individual DM avatars now use ConnectedUserAvatar which fetches presence internally

  // Search users when query changes
  useEffect(() => {
    if (searchQuery.trim().length >= 1) {
      searchUsers(searchQuery);
    }
  }, [searchQuery, searchUsers]);

  // Search messages when query changes (debounced)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setMessageSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearchingMessages(true);
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/messages/search?q=${encodeURIComponent(searchQuery)}&limit=5`,
        );
        if (response.ok) {
          const data = await response.json();
          // Transform API response to our search result format
          const results: MessageSearchResult[] = (data.data || []).map(
            (msg: any) => ({
              id: msg.id,
              content: msg.content,
              channelId: msg.channelId,
              channelName: msg.channel?.name || 'Unknown',
              authorName:
                msg.author?.displayName || msg.author?.name || 'Unknown',
              createdAt: new Date(msg.createdAt),
            }),
          );
          setMessageSearchResults(results);
        }
      } catch {
        // Silently fail message search
      } finally {
        setIsSearchingMessages(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, workspaceId]);

  // Create DM and navigate to it
  const handleStartDM = useCallback(
    async (userId: string) => {
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/dm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });

        if (response.ok) {
          const result = await response.json();
          router.push(`/${workspaceId}/channels/${result.data.id}`);
          setSearchQuery('');
        }
      } catch (error) {
        console.error('Failed to create DM:', error);
      }
    },
    [workspaceId, router],
  );

  const toggleSection = useCallback(
    (section: keyof typeof expandedSections) => {
      setExpandedSections(prev => ({
        ...prev,
        [section]: !prev[section],
      }));
    },
    [],
  );

  // Check if we're in search mode (has query or focused with results)
  const isSearchMode = searchQuery.trim().length > 0;

  // Filter channels based on search
  const filteredChannels = useMemo(() => {
    if (!searchQuery.trim()) {
      return channels;
    }
    const query = searchQuery.toLowerCase();
    return channels.filter(
      c =>
        c.name.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query),
    );
  }, [channels, searchQuery]);

  const filteredStarred = useMemo(() => {
    if (!searchQuery.trim()) {
      return starredChannels;
    }
    const query = searchQuery.toLowerCase();
    return starredChannels.filter(
      c =>
        c.name.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query),
    );
  }, [starredChannels, searchQuery]);

  // Filter starred DMs based on search
  const filteredStarredDMs = useMemo(() => {
    if (!searchQuery.trim()) {
      return starredDMs;
    }
    const query = searchQuery.toLowerCase();
    return starredDMs.filter(dm =>
      dm.participants.some(p => p.user?.name?.toLowerCase().includes(query)),
    );
  }, [starredDMs, searchQuery]);

  // Sort and filter DMs - most recently updated first
  const { selfDM, sortedDMs, filteredDMs } = useMemo(() => {
    // Find self-DM (where isSelfDM is true or only participant is current user)
    const selfDM = directMessages.find(dm => {
      if (dm.isSelfDM) {
        return true;
      }
      // Check if all participants are the current user
      const otherParticipants = dm.participants.filter(p => {
        const participantId = getParticipantId(p as ParticipantStructure);
        return participantId !== currentUserId;
      });
      return otherParticipants.length === 0;
    });

    // Get all other DMs (excluding self-DM)
    const otherDMs = directMessages.filter(dm => dm !== selfDM);

    // Sort by most recent activity (lastMessage.createdAt or updatedAt)
    const sorted = [...otherDMs].sort((a, b) => {
      const aDate = a.lastMessage?.createdAt || a.updatedAt || a.createdAt;
      const bDate = b.lastMessage?.createdAt || b.updatedAt || b.createdAt;
      if (!aDate && !bDate) {
        return 0;
      }
      if (!aDate) {
        return 1;
      }
      if (!bDate) {
        return -1;
      }
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });

    // Filter if search query exists
    let filtered = sorted;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = sorted.filter(dm =>
        dm.participants.some(p => p.user?.name?.toLowerCase().includes(query)),
      );
    }

    return { selfDM, sortedDMs: sorted, filteredDMs: filtered };
  }, [directMessages, searchQuery, currentUserId]);

  // Filter users to exclude those with existing DMs
  const usersWithoutDM = useMemo(() => {
    const dmUserIds = new Set(
      directMessages.flatMap(dm =>
        dm.participants.filter(p => p.user).map(p => p.user.id),
      ),
    );
    return workspaceUsers.filter(user => !dmUserIds.has(user.id));
  }, [workspaceUsers, directMessages]);

  const handleCreateChannel = useCallback(
    async (input: {
      name: string;
      type: 'public' | 'private';
      description?: string;
      memberIds?: string[];
    }) => {
      try {
        await onCreateChannel?.(input);
        setIsCreateDialogOpen(false);
      } catch (error) {
        console.error('Error creating channel:', error);
        // Keep dialog open on error so user can retry
      }
    },
    [onCreateChannel],
  );

  if (isLoading) {
    return <ChannelListSkeleton className={className} />;
  }

  // Show error state with retry option
  if (error && channels.length === 0 && directMessages.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center p-6',
          className,
        )}
      >
        <AlertCircleIcon className='h-10 w-10 text-muted-foreground mb-3' />
        <p className='text-sm font-medium text-foreground mb-1'>
          Failed to load channels
        </p>
        <p className='text-xs text-muted-foreground mb-4 text-center'>
          {error.message || 'An error occurred while loading your channels'}
        </p>
        {onRetry && (
          <button
            type='button'
            onClick={onRetry}
            className='rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90'
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <div className='flex-1 overflow-y-auto'>
        {/* Search Results Mode */}
        {isSearchMode ? (
          <div className='px-2'>
            {/* Loading indicator */}
            {(isSearchingUsers || isSearchingMessages) && (
              <div className='flex items-center justify-center py-4'>
                <LoadingSpinner className='h-5 w-5' />
              </div>
            )}

            {/* Channels Results */}
            {filteredChannels.length > 0 && (
              <div className='mb-3'>
                <p className='px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
                  Channels
                </p>
                {filteredChannels.slice(0, 5).map(channel => (
                  <ChannelItem
                    key={channel.id}
                    channel={channel}
                    workspaceId={workspaceId}
                    isActive={pathname?.includes(`/channels/${channel.id}`)}
                  />
                ))}
              </div>
            )}

            {/* Message Results */}
            {messageSearchResults.length > 0 && (
              <div className='mb-3'>
                <p className='px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
                  Messages
                </p>
                {messageSearchResults.slice(0, 5).map(result => (
                  <Link
                    key={result.id}
                    href={`/${workspaceId}/channels/${result.channelId}?message=${result.id}`}
                    className='mx-1 flex flex-col gap-0.5 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent'
                    onClick={() => setSearchQuery('')}
                  >
                    <span className='truncate text-foreground'>
                      {result.content}
                    </span>
                    <span className='text-xs text-muted-foreground'>
                      {result.authorName} in #{result.channelName}
                    </span>
                  </Link>
                ))}
              </div>
            )}

            {/* People Results (existing DMs) */}
            {filteredDMs.length > 0 && (
              <div className='mb-3'>
                <p className='px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
                  Recent Conversations
                </p>
                {filteredDMs.slice(0, 5).map(dm => (
                  <DirectMessageItem
                    key={dm.id}
                    dm={dm}
                    workspaceId={workspaceId}
                    currentUserId={currentUserId}
                    isActive={pathname?.includes(`/dm/${dm.id}`)}
                  />
                ))}
              </div>
            )}

            {/* People Results (without existing DMs - can start new) */}
            {usersWithoutDM.length > 0 && (
              <div className='mb-3'>
                <p className='px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
                  People
                </p>
                {usersWithoutDM.slice(0, 5).map(user => (
                  <UserSearchItem
                    key={user.id}
                    user={user}
                    onStartDM={() => handleStartDM(user.id)}
                  />
                ))}
              </div>
            )}

            {/* No Results */}
            {!isSearchingUsers &&
              !isSearchingMessages &&
              filteredChannels.length === 0 &&
              filteredDMs.length === 0 &&
              usersWithoutDM.length === 0 &&
              messageSearchResults.length === 0 && (
                <div className='py-8 text-center'>
                  <p className='text-sm text-muted-foreground'>
                    No results found
                  </p>
                  <p className='mt-1 text-xs text-muted-foreground'>
                    Try searching for channels, messages, or people
                  </p>
                </div>
              )}
          </div>
        ) : (
          <>
            {/* Starred Channels and DMs */}
            {(filteredStarred.length > 0 || filteredStarredDMs.length > 0) && (
              <ChannelSection
                title='Starred'
                icon={<StarFilledIcon className='h-4 w-4 text-yellow-500' />}
                isExpanded={expandedSections.starred}
                onToggle={() => toggleSection('starred')}
              >
                {filteredStarred.map(channel => (
                  <ChannelItem
                    key={channel.id}
                    channel={channel}
                    workspaceId={workspaceId}
                    isActive={pathname?.includes(`/channels/${channel.id}`)}
                    isStarred={true}
                    onToggleStar={onChannelStarChange}
                  />
                ))}
                {filteredStarredDMs.map(dm => (
                  <DirectMessageItem
                    key={dm.id}
                    dm={dm}
                    workspaceId={workspaceId}
                    currentUserId={currentUserId}
                    isActive={
                      pathname?.includes(`/dm/${dm.id}`) ||
                      pathname?.includes(`/channels/${dm.id}`)
                    }
                    isStarred={true}
                    onToggleStar={onDMStarChange}
                  />
                ))}
              </ChannelSection>
            )}

            {/* Channels */}
            <ChannelSection
              title='Channels'
              isExpanded={expandedSections.channels}
              onToggle={() => toggleSection('channels')}
              action={
                <button
                  type='button'
                  onClick={() => setIsCreateDialogOpen(true)}
                  className='rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground'
                  title='Create channel'
                >
                  <PlusIcon className='h-4 w-4' />
                </button>
              }
            >
              {filteredChannels.length === 0 ? (
                <div className='px-4 py-3'>
                  <p className='text-xs text-muted-foreground'>
                    No channels yet
                  </p>
                  <button
                    type='button'
                    onClick={() => setIsCreateDialogOpen(true)}
                    className='mt-2 text-xs text-primary hover:underline'
                  >
                    Create your first channel
                  </button>
                </div>
              ) : (
                filteredChannels.map(channel => (
                  <ChannelItem
                    key={channel.id}
                    channel={channel}
                    workspaceId={workspaceId}
                    isActive={pathname?.includes(`/channels/${channel.id}`)}
                    onToggleStar={onChannelStarChange}
                  />
                ))
              )}
            </ChannelSection>

            {/* Direct Messages */}
            <ChannelSection
              title='Direct Messages'
              isExpanded={expandedSections.directMessages}
              onToggle={() => toggleSection('directMessages')}
              action={
                <button
                  type='button'
                  onClick={() => router.push(`/${workspaceId}/messages/new`)}
                  className='rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground'
                  title='New direct message'
                >
                  <PlusIcon className='h-4 w-4' />
                </button>
              }
            >
              {isLoading ? (
                <div className='px-4 py-3'>
                  <div className='flex items-center gap-2'>
                    <LoadingSpinner className='h-4 w-4' />
                    <p className='text-xs text-muted-foreground'>Loading...</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Self-DM at the top (like Slack's "(you)" conversation) */}
                  {selfDM && (
                    <DirectMessageItem
                      key={selfDM.id}
                      dm={selfDM}
                      workspaceId={workspaceId}
                      currentUserId={currentUserId}
                      isActive={
                        pathname?.includes(`/dm/${selfDM.id}`) ||
                        pathname?.includes(`/channels/${selfDM.id}`)
                      }
                      isSelf={true}
                      onToggleStar={onDMStarChange}
                    />
                  )}

                  {/* Other DM conversations sorted by most recent */}
                  {sortedDMs.map(dm => (
                    <DirectMessageItem
                      key={dm.id}
                      dm={dm}
                      workspaceId={workspaceId}
                      currentUserId={currentUserId}
                      isActive={
                        pathname?.includes(`/dm/${dm.id}`) ||
                        pathname?.includes(`/channels/${dm.id}`)
                      }
                      onToggleStar={onDMStarChange}
                    />
                  ))}

                  {/* Empty state when no DMs exist */}
                  {!selfDM && sortedDMs.length === 0 && (
                    <div className='px-4 py-3'>
                      <p className='text-xs text-muted-foreground'>
                        No conversations yet
                      </p>
                      <button
                        type='button'
                        onClick={() =>
                          router.push(`/${workspaceId}/messages/new`)
                        }
                        className='mt-2 text-xs text-primary hover:underline'
                      >
                        Start a conversation
                      </button>
                    </div>
                  )}
                </>
              )}
            </ChannelSection>
          </>
        )}
      </div>

      {/* Create Channel Dialog */}
      <CreateChannelDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onCreate={handleCreateChannel}
        workspaceId={workspaceId}
      />
    </div>
  );
}

interface ChannelSectionProps {
  title: string;
  icon?: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}

function ChannelSection({
  title,
  icon,
  isExpanded,
  onToggle,
  action,
  children,
}: ChannelSectionProps) {
  return (
    <div className='py-1'>
      <div className='flex items-center justify-between py-1'>
        <button
          type='button'
          onClick={onToggle}
          className='flex flex-1 items-center gap-1 text-xs font-heading font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground'
        >
          <ChevronIcon
            className={cn(
              'h-3 w-3 transition-transform',
              isExpanded ? 'rotate-90' : '',
            )}
          />
          {icon}
          <span>{title}</span>
        </button>
        {action}
      </div>
      {isExpanded && <div className='mt-1'>{children}</div>}
    </div>
  );
}

interface ChannelItemProps {
  channel: Channel;
  workspaceId: string;
  isActive?: boolean;
  /** Whether this channel is in the starred section */
  isStarred?: boolean;
  /** Callback when the channel is starred/unstarred */
  onToggleStar?: (channelId: string, isStarred: boolean) => void;
  /** Callback when the user leaves the channel */
  onLeaveChannel?: (channelId: string) => void;
}

function ChannelItem({
  channel,
  workspaceId,
  isActive,
  isStarred,
  onToggleStar,
  onLeaveChannel,
}: ChannelItemProps) {
  const hasUnread = channel.unreadCount != null && channel.unreadCount > 0;
  const unreadDisplay = channel.unreadCount > 99 ? '99+' : channel.unreadCount;
  const router = useRouter();

  const handleCopyLink = useCallback(() => {
    const url = `${window.location.origin}/${workspaceId}/channels/${channel.id}`;
    navigator.clipboard.writeText(url);
  }, [workspaceId, channel.id]);

  const handleCopyName = useCallback(() => {
    navigator.clipboard.writeText(channel.name);
  }, [channel.name]);

  const handleViewDetails = useCallback(() => {
    // Navigate to channel with details panel open
    router.push(`/${workspaceId}/channels/${channel.id}?details=true`);
  }, [router, workspaceId, channel.id]);

  const handleOpenInNewWindow = useCallback(() => {
    window.open(`/${workspaceId}/channels/${channel.id}`, '_blank');
  }, [workspaceId, channel.id]);

  const handleToggleStar = useCallback(async () => {
    const currentlyStarred = isStarred ?? channel.isStarred ?? false;
    const newStarredState = !currentlyStarred;

    console.log('[ChannelItem] handleToggleStar called:', {
      channelId: channel.id,
      channelName: channel.name,
      currentlyStarred,
      newStarredState,
      hasCallback: !!onToggleStar,
    });

    // Optimistically update UI immediately
    onToggleStar?.(channel.id, newStarredState);

    try {
      const response = await fetch(`/api/channels/${channel.id}/star`, {
        method: currentlyStarred ? 'DELETE' : 'POST',
      });
      if (!response.ok) {
        // Revert on failure
        console.error('Failed to toggle star, reverting');
        onToggleStar?.(channel.id, currentlyStarred);
      }
    } catch (error) {
      // Revert on error
      console.error('Failed to toggle star:', error);
      onToggleStar?.(channel.id, currentlyStarred);
    }
  }, [channel.id, channel.name, isStarred, channel.isStarred, onToggleStar]);

  const handleLeaveChannel = useCallback(async () => {
    try {
      const response = await fetch(`/api/channels/${channel.id}/members`, {
        method: 'DELETE',
      });
      if (response.ok) {
        onLeaveChannel?.(channel.id);
      }
    } catch (error) {
      console.error('Failed to leave channel:', error);
    }
  }, [channel.id, onLeaveChannel]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Link
          href={`/${workspaceId}/channels/${channel.id}`}
          className={cn(
            'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-sans transition-colors',
            isActive
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            hasUnread && !isActive && 'font-semibold text-foreground',
          )}
          title={`${channel.name}${channel.description ? ` - ${channel.description}` : ''}`}
        >
          <ChannelTypeIcon type={channel.type} className='h-4 w-4 shrink-0' />
          <span className='flex-1 truncate font-sans'>{channel.name}</span>
          {(channel as { isMuted?: boolean }).isMuted && (
            <BellOff className='h-3.5 w-3.5 text-muted-foreground' />
          )}
          {hasUnread && !isActive && (
            <span className='flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground'>
              {unreadDisplay}
            </span>
          )}
        </Link>
      </ContextMenuTrigger>
      <ContextMenuContent className='w-56'>
        <ContextMenuItem onClick={handleViewDetails}>
          <Eye className='mr-2 h-4 w-4' />
          View channel details
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Copy className='mr-2 h-4 w-4' />
            Copy
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className='w-48'>
            <ContextMenuItem onClick={handleCopyName}>
              <Copy className='mr-2 h-4 w-4' />
              Copy name
            </ContextMenuItem>
            <ContextMenuItem onClick={handleCopyLink}>
              <LinkIcon className='mr-2 h-4 w-4' />
              Copy link
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Bell className='mr-2 h-4 w-4' />
            Edit notifications
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className='w-48'>
            <ContextMenuItem>All new posts</ContextMenuItem>
            <ContextMenuItem>Mentions only</ContextMenuItem>
            <ContextMenuItem>Nothing</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem onClick={handleToggleStar}>
          <Star
            className={cn(
              'mr-2 h-4 w-4',
              (isStarred || channel.isStarred) &&
                'fill-yellow-500 text-yellow-500',
            )}
          />
          {isStarred || channel.isStarred ? 'Unstar channel' : 'Star channel'}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleOpenInNewWindow}>
          <ExternalLink className='mr-2 h-4 w-4' />
          Open in new window
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={handleLeaveChannel}
          className='text-destructive focus:text-destructive'
        >
          <LogOut className='mr-2 h-4 w-4' />
          Leave channel
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

interface DirectMessageItemProps {
  dm: DirectMessageChannel;
  workspaceId: string;
  currentUserId?: string;
  isActive?: boolean;
  /** Whether this is the current user's self-DM (notes to self) */
  isSelf?: boolean;
  /** Whether this DM is starred */
  isStarred?: boolean;
  /** Callback when the DM is starred/unstarred */
  onToggleStar?: (dmId: string, isStarred: boolean) => void;
  /** Callback when the DM is hidden/closed */
  onCloseConversation?: (dmId: string) => void;
}

/**
 * Direct Message Item Component
 *
 * Renders a DM item in the sidebar, handling both 1:1 DMs and Group DMs (Slack-style):
 *
 * 1:1 DM (2 participants total, excluding self leaves 1):
 *   - Single avatar of the other person
 *   - Just their name (e.g., "Mehran Granfar")
 *   - Online status indicator
 *
 * Group DM (3+ participants total, excluding self leaves 2+):
 *   - Stacked avatars (2 overlapping)
 *   - Comma-separated names truncated with "..." (e.g., "Candace Wong, Marc Dubois, Mehran...")
 *   - Participant count badge
 */
function DirectMessageItem({
  dm,
  workspaceId,
  currentUserId,
  isActive,
  isSelf,
  isStarred,
  onToggleStar,
  onCloseConversation,
}: DirectMessageItemProps) {
  const hasUnread = dm.unreadCount != null && dm.unreadCount > 0;
  const unreadDisplay = dm.unreadCount > 99 ? '99+' : dm.unreadCount;
  const router = useRouter();

  // Filter out current user from participants to get "other" participants
  const otherParticipants = dm.participants.filter(p => {
    const participantId = getParticipantId(p as ParticipantStructure);
    return participantId !== currentUserId;
  });

  // Determine if this is a group DM (2+ other participants means 3+ total)
  const isGroupDM = otherParticipants.length >= 2;
  const participantCount = otherParticipants.length;

  // Get participant display info - handles both flat and nested user structures
  // The API can return either { id, name, avatarUrl, status, isOrchestrator } (flat)
  // or { id, user: { name, avatarUrl, ... }, isOrchestrator } (nested)
  const getParticipantInfo = (p: DirectMessageParticipant) => {
    const participant = p as ParticipantStructure;

    // Type-safe handling of nested vs flat structure
    if (hasNestedUser(participant)) {
      // Nested structure: { id, user: {...}, isOrchestrator }
      // User type has: name (not displayName), image (not avatarUrl)
      const user = participant.user;
      return {
        id: user.id,
        name: user.name || 'Unknown',
        avatarUrl: user.image,
        status: user.status,
        isOrchestrator: participant.isOrchestrator,
      };
    }

    // Flat structure: { id, name, avatarUrl, status, isOrchestrator }
    return {
      id: participant.id,
      name:
        (participant as FlatParticipant).displayName ||
        (participant as FlatParticipant).name ||
        'Unknown',
      avatarUrl: (participant as FlatParticipant).avatarUrl,
      status: (participant as FlatParticipant).status,
      isOrchestrator: participant.isOrchestrator,
    };
  };

  // Format display name based on DM type
  let displayName: string;
  if (isSelf || dm.isSelfDM || otherParticipants.length === 0) {
    // Self DM (notes to self) - show "Name (you)" like Slack
    const selfInfo =
      dm.participant ||
      (dm.participants[0] ? getParticipantInfo(dm.participants[0]) : null);
    const selfName = selfInfo?.name || 'You';
    displayName = `${selfName} (you)`;
  } else if (isGroupDM) {
    // Group DM: "Alice, Bob, Carol..." (first names only, truncate if too many)
    const names = otherParticipants.slice(0, 3).map(p => {
      const info = getParticipantInfo(p);
      // Use first name only for group DMs
      return info.name.split(' ')[0];
    });
    displayName = names.join(', ');
    if (otherParticipants.length > 3) {
      displayName += '...';
    }
  } else if (otherParticipants.length === 1) {
    // 1:1 DM: Show full name
    displayName = getParticipantInfo(otherParticipants[0]).name;
  } else {
    displayName = 'Direct Message';
  }

  // Get first two participants for avatar display
  const firstParticipant = otherParticipants[0]
    ? getParticipantInfo(otherParticipants[0])
    : null;
  const secondParticipant = otherParticipants[1]
    ? getParticipantInfo(otherParticipants[1])
    : null;

  // For self-DM, use the dm.participant or first participant
  const selfParticipant =
    dm.participant ||
    (dm.participants[0] ? getParticipantInfo(dm.participants[0]) : null);

  // Context menu handlers
  const handleCopyLink = useCallback(() => {
    const url = `${window.location.origin}/${workspaceId}/dm/${dm.id}`;
    navigator.clipboard.writeText(url);
  }, [workspaceId, dm.id]);

  const handleViewDetails = useCallback(() => {
    router.push(`/${workspaceId}/dm/${dm.id}?details=true`);
  }, [router, workspaceId, dm.id]);

  const handleOpenInNewWindow = useCallback(() => {
    window.open(`/${workspaceId}/dm/${dm.id}`, '_blank');
  }, [workspaceId, dm.id]);

  const handleToggleStar = useCallback(async () => {
    const currentlyStarred = isStarred ?? dm.isStarred ?? false;
    const newStarredState = !currentlyStarred;

    // Optimistically update UI immediately
    onToggleStar?.(dm.id, newStarredState);

    try {
      const response = await fetch(`/api/channels/${dm.id}/star`, {
        method: currentlyStarred ? 'DELETE' : 'POST',
      });
      if (!response.ok) {
        // Revert on failure
        console.error('Failed to toggle star, reverting');
        onToggleStar?.(dm.id, currentlyStarred);
      }
    } catch (error) {
      // Revert on error
      console.error('Failed to toggle star:', error);
      onToggleStar?.(dm.id, currentlyStarred);
    }
  }, [dm.id, dm.isStarred, isStarred, onToggleStar]);

  const handleHideConversation = useCallback(async () => {
    try {
      const response = await fetch(`/api/conversations/${dm.id}/hide`, {
        method: 'POST',
      });
      if (response.ok) {
        onCloseConversation?.(dm.id);
      }
    } catch (error) {
      console.error('Failed to hide conversation:', error);
    }
  }, [dm.id, onCloseConversation]);

  const handleCloseConversation = useCallback(async () => {
    try {
      const response = await fetch(`/api/conversations/${dm.id}/close`, {
        method: 'POST',
      });
      if (response.ok) {
        onCloseConversation?.(dm.id);
      }
    } catch (error) {
      console.error('Failed to close conversation:', error);
    }
  }, [dm.id, onCloseConversation]);

  // Get name of primary participant for hide action
  const primaryParticipantName = firstParticipant?.name || displayName;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Link
          href={`/${workspaceId}/dm/${dm.id}`}
          className={cn(
            'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
            isActive
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            hasUnread && !isActive && 'font-semibold text-foreground',
          )}
          title={
            otherParticipants.map(p => getParticipantInfo(p).name).join(', ') ||
            displayName
          }
        >
          {/* Avatar section */}
          <div
            className={cn('relative shrink-0', isGroupDM ? 'w-8 h-7' : 'w-6')}
          >
            {isGroupDM && firstParticipant && secondParticipant ? (
              // Group DM: Stacked avatars (Slack-style)
              <>
                {/* First avatar (back, slightly offset) */}
                <div className='absolute left-0 top-0 z-10'>
                  <UserAvatar
                    user={{
                      name: firstParticipant.name,
                      avatarUrl: firstParticipant.avatarUrl,
                    }}
                    size='xs'
                    className='border-2 border-background'
                  />
                </div>
                {/* Second avatar (front, overlapping) */}
                <div className='absolute left-2.5 top-2 z-20'>
                  <UserAvatar
                    user={{
                      name: secondParticipant.name,
                      avatarUrl: secondParticipant.avatarUrl,
                    }}
                    size='xs'
                    className='border-2 border-background'
                  />
                </div>
                {/* Participant count badge - only show if more than 2 others */}
                {participantCount > 2 && (
                  <span className='absolute -right-0.5 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-stone-700 px-1 text-[10px] font-medium text-stone-300 z-30'>
                    {participantCount}
                  </span>
                )}
              </>
            ) : firstParticipant ? (
              // 1:1 DM: Single avatar with status using ConnectedUserAvatar for real-time presence
              <>
                <ConnectedUserAvatar
                  user={{
                    id: firstParticipant.id,
                    name: firstParticipant.name,
                    image: firstParticipant.avatarUrl,
                  }}
                  size='sm'
                  showPresence
                />
                {/* AI/Orchestrator badge */}
                {firstParticipant.isOrchestrator && (
                  <span className='absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground'>
                    AI
                  </span>
                )}
              </>
            ) : selfParticipant ? (
              // Self-DM fallback
              <UserAvatar
                user={{
                  name: selfParticipant.name,
                  avatarUrl: selfParticipant.avatarUrl,
                }}
                size='sm'
              />
            ) : (
              // Fallback avatar
              <div className='flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium'>
                ?
              </div>
            )}
          </div>
          <span className='flex-1 truncate'>{displayName}</span>
          {hasUnread && !isActive && (
            <span className='flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground'>
              {unreadDisplay}
            </span>
          )}
        </Link>
      </ContextMenuTrigger>
      <ContextMenuContent className='w-56'>
        <ContextMenuItem onClick={handleViewDetails}>
          <Eye className='mr-2 h-4 w-4' />
          View conversation details
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Copy className='mr-2 h-4 w-4' />
            Copy
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className='w-48'>
            <ContextMenuItem onClick={handleCopyLink}>
              <LinkIcon className='mr-2 h-4 w-4' />
              Copy link
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        {!isSelf && !dm.isSelfDM && (
          <ContextMenuItem
            onClick={handleHideConversation}
            className='text-destructive focus:text-destructive'
          >
            <EyeOff className='mr-2 h-4 w-4' />
            Hide {primaryParticipantName.split(' ')[0]}
          </ContextMenuItem>
        )}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Bell className='mr-2 h-4 w-4' />
            Edit notifications
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className='w-48'>
            <ContextMenuItem>All new posts</ContextMenuItem>
            <ContextMenuItem>Mentions only</ContextMenuItem>
            <ContextMenuItem>Nothing</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem onClick={handleToggleStar}>
          <Star
            className={cn(
              'mr-2 h-4 w-4',
              isStarred && 'fill-yellow-500 text-yellow-500',
            )}
          />
          {isStarred ? 'Unstar conversation' : 'Star conversation'}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleOpenInNewWindow}>
          <ExternalLink className='mr-2 h-4 w-4' />
          Open in new window
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={handleCloseConversation}
          className='text-destructive focus:text-destructive'
        >
          <X className='mr-2 h-4 w-4' />
          Close conversation
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

interface ChannelTypeIconProps {
  type: 'public' | 'private' | 'direct';
  className?: string;
}

function ChannelTypeIcon({ type, className }: ChannelTypeIconProps) {
  if (type === 'private') {
    return (
      <svg
        className={className}
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      >
        <rect x='3' y='11' width='18' height='11' rx='2' ry='2' />
        <path d='M7 11V7a5 5 0 0 1 10 0v4' />
      </svg>
    );
  }

  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M4 9h16' />
      <path d='M4 15h16' />
      <path d='M10 3 8 21' />
      <path d='M16 3 14 21' />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='m9 18 6-6-6-6' />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M5 12h14' />
      <path d='M12 5v14' />
    </svg>
  );
}

function StarFilledIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='currentColor'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <polygon points='12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2' />
    </svg>
  );
}

function AlertCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <circle cx='12' cy='12' r='10' />
      <line x1='12' y1='8' x2='12' y2='12' />
      <line x1='12' y1='16' x2='12.01' y2='16' />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      xmlns='http://www.w3.org/2000/svg'
      fill='none'
      viewBox='0 0 24 24'
    >
      <circle
        className='opacity-25'
        cx='12'
        cy='12'
        r='10'
        stroke='currentColor'
        strokeWidth='4'
      />
      <path
        className='opacity-75'
        fill='currentColor'
        d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
      />
    </svg>
  );
}

interface UserSearchItemProps {
  user: User;
  onStartDM: () => void;
}

function UserSearchItem({ user, onStartDM }: UserSearchItemProps) {
  return (
    <button
      type='button'
      onClick={onStartDM}
      className='mx-1 flex w-[calc(100%-0.5rem)] items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent'
    >
      <div className='relative shrink-0'>
        <UserAvatar user={user} size='sm' />
        {user.status === 'online' && (
          <span className='absolute bottom-0 right-0 h-2 w-2 rounded-full border border-background bg-emerald-500' />
        )}
      </div>
      <div className='flex-1 truncate'>
        <span className='text-foreground'>{user.name}</span>
        {user.email && (
          <span className='ml-1 text-xs text-muted-foreground'>
            {user.email}
          </span>
        )}
      </div>
      <MessageIcon className='h-4 w-4 shrink-0 text-muted-foreground' />
    </button>
  );
}

function MessageIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' />
    </svg>
  );
}
