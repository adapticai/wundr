'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useCallback, useMemo } from 'react';

import { ChannelListSkeleton } from '@/components/skeletons';
import { cn } from '@/lib/utils';

import { CreateChannelDialog } from './create-channel-dialog';
import { CreateConversationDialog } from './create-conversation-dialog';

import type { Channel, DirectMessageChannel } from '@/types/channel';

/**
 * Props for the ChannelList component
 */
interface ChannelListProps {
  /** The workspace ID for routing */
  workspaceId: string;
  /** List of channels to display */
  channels: Channel[];
  /** List of direct message conversations */
  directMessages: DirectMessageChannel[];
  /** List of starred/favorite channels */
  starredChannels: Channel[];
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
  /** Callback fired when creating a new DM */
  onCreateDM?: () => Promise<void>;
  /** Callback fired when retrying to load channels */
  onRetry?: () => void;
  /** Additional CSS class names */
  className?: string;
}

export function ChannelList({
  workspaceId,
  channels,
  directMessages,
  starredChannels,
  isLoading = false,
  error = null,
  onCreateChannel,
  onCreateDM,
  onRetry,
  className,
}: ChannelListProps) {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    starred: true,
    channels: true,
    directMessages: true,
  });
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreateDMDialogOpen, setIsCreateDMDialogOpen] = useState(false);

  const toggleSection = useCallback((section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  // Filter channels based on search
  const filteredChannels = useMemo(() => {
    if (!searchQuery.trim()) {
return channels;
}
    const query = searchQuery.toLowerCase();
    return channels.filter(
      (c) =>
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
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query),
    );
  }, [starredChannels, searchQuery]);

  const filteredDMs = useMemo(() => {
    if (!searchQuery.trim()) {
return directMessages;
}
    const query = searchQuery.toLowerCase();
    return directMessages.filter((dm) =>
      dm.participants.some((p) => p.user.name.toLowerCase().includes(query)),
    );
  }, [directMessages, searchQuery]);

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

  const handleCreateDM = useCallback(
    async () => {
      try {
        await onCreateDM?.();
      } catch (error) {
        console.error('Error creating DM:', error);
      }
    },
    [onCreateDM],
  );

  if (isLoading) {
    return <ChannelListSkeleton className={className} />;
  }

  // Show error state with retry option
  if (error && channels.length === 0 && directMessages.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-6', className)}>
        <AlertCircleIcon className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground mb-1">Failed to load channels</p>
        <p className="text-xs text-muted-foreground mb-4 text-center">
          {error.message || 'An error occurred while loading your channels'}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Starred Channels */}
        {filteredStarred.length > 0 && (
          <ChannelSection
            title="Starred"
            icon={<StarFilledIcon className="h-4 w-4 text-yellow-500" />}
            isExpanded={expandedSections.starred}
            onToggle={() => toggleSection('starred')}
          >
            {filteredStarred.map((channel) => (
              <ChannelItem
                key={channel.id}
                channel={channel}
                workspaceId={workspaceId}
                isActive={pathname?.includes(`/channels/${channel.id}`)}
              />
            ))}
          </ChannelSection>
        )}

        {/* Channels */}
        <ChannelSection
          title="Channels"
          isExpanded={expandedSections.channels}
          onToggle={() => toggleSection('channels')}
          action={
            <button
              type="button"
              onClick={() => setIsCreateDialogOpen(true)}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Create channel"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          }
        >
          {filteredChannels.length === 0 ? (
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {searchQuery.trim()
                  ? 'No channels match your search'
                  : 'No channels yet'}
              </p>
              {!searchQuery.trim() && (
                <button
                  type="button"
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  Create your first channel
                </button>
              )}
            </div>
          ) : (
            filteredChannels.map((channel) => (
              <ChannelItem
                key={channel.id}
                channel={channel}
                workspaceId={workspaceId}
                isActive={pathname?.includes(`/channels/${channel.id}`)}
              />
            ))
          )}
        </ChannelSection>

        {/* Direct Messages */}
        <ChannelSection
          title="Direct Messages"
          isExpanded={expandedSections.directMessages}
          onToggle={() => toggleSection('directMessages')}
          action={
            <button
              type="button"
              onClick={() => setIsCreateDMDialogOpen(true)}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              title="New direct message"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          }
        >
          {filteredDMs.length === 0 ? (
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {searchQuery.trim()
                  ? 'No conversations match your search'
                  : 'No direct messages yet'}
              </p>
              {!searchQuery.trim() && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Click + to start a conversation
                </p>
              )}
            </div>
          ) : (
            filteredDMs.map((dm) => (
              <DirectMessageItem
                key={dm.id}
                dm={dm}
                workspaceId={workspaceId}
                isActive={pathname?.includes(`/dm/${dm.id}`)}
              />
            ))
          )}
        </ChannelSection>
      </div>

      {/* Create Channel Dialog */}
      <CreateChannelDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onCreate={handleCreateChannel}
        workspaceId={workspaceId}
      />

      {/* Create DM Dialog */}
      <CreateConversationDialog
        isOpen={isCreateDMDialogOpen}
        onClose={() => setIsCreateDMDialogOpen(false)}
        onCreateDM={handleCreateDM}
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
    <div className="py-1">
      <div className="flex items-center justify-between px-3 py-1">
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 items-center gap-1 text-xs font-heading font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
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
      {isExpanded && <div className="mt-1">{children}</div>}
    </div>
  );
}

interface ChannelItemProps {
  channel: Channel;
  workspaceId: string;
  isActive?: boolean;
}

function ChannelItem({ channel, workspaceId, isActive }: ChannelItemProps) {
  const hasUnread = channel.unreadCount != null && channel.unreadCount > 0;
  const unreadDisplay = channel.unreadCount > 99 ? '99+' : channel.unreadCount;

  return (
    <Link
      href={`/${workspaceId}/channels/${channel.id}`}
      className={cn(
        'mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-sans transition-colors',
        isActive
          ? 'bg-accent text-foreground'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
        hasUnread && !isActive && 'font-semibold text-foreground',
      )}
      title={`${channel.name}${channel.description ? ` - ${channel.description}` : ''}`}
    >
      <ChannelTypeIcon type={channel.type} className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate font-sans">{channel.name}</span>
      {hasUnread && !isActive && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
          {unreadDisplay}
        </span>
      )}
    </Link>
  );
}

interface DirectMessageItemProps {
  dm: DirectMessageChannel;
  workspaceId: string;
  isActive?: boolean;
}

function DirectMessageItem({ dm, workspaceId, isActive }: DirectMessageItemProps) {
  const hasUnread = dm.unreadCount != null && dm.unreadCount > 0;
  const unreadDisplay = dm.unreadCount > 99 ? '99+' : dm.unreadCount;
  const displayName = dm.participants
    .map((p) => p.user?.name?.split(' ')[0] || 'Unknown')
    .join(', ');
  const firstParticipant = dm.participants[0];

  return (
    <Link
      href={`/${workspaceId}/dm/${dm.id}`}
      className={cn(
        'mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
        isActive
          ? 'bg-accent text-foreground'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
        hasUnread && !isActive && 'font-semibold text-foreground',
      )}
      title={displayName}
    >
      <div className="relative shrink-0">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
          {firstParticipant?.user?.name?.charAt(0).toUpperCase() || '?'}
        </div>
        {firstParticipant?.user?.status === 'online' && (
          <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-background bg-emerald-500" />
        )}
        {firstParticipant?.isVP && (
          <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
            VP
          </span>
        )}
      </div>
      <span className="flex-1 truncate">{displayName}</span>
      {hasUnread && !isActive && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
          {unreadDisplay}
        </span>
      )}
    </Link>
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

function ChevronIcon({ className }: { className?: string }) {
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
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
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
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function StarFilledIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function AlertCircleIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
