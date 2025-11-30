'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Channel, ChannelPermissions } from '@/types/channel';
import { ConnectedUserAvatar } from '@/components/presence/user-avatar-with-presence';
import { useMultiplePresence } from '@/hooks/use-presence';
import {
  Bell,
  ChevronDown,
  Copy,
  ExternalLink,
  FileText,
  Headphones,
  Info,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Settings,
  Sparkles,
  Star,
  UserPlus,
  Video,
  Workflow,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCallback, useState, useMemo } from 'react';


/**
 * Channel header tabs
 */
type ChannelTab = 'messages' | 'canvas' | 'files';

/**
 * Props for the ChannelHeader component
 */
interface ChannelHeaderProps {
  /** The channel data to display */
  channel: Channel;
  /** Permissions for the current user in this channel */
  permissions: ChannelPermissions;
  /** Current workspace ID */
  workspaceId?: string;
  /** Active tab */
  activeTab?: ChannelTab;
  /** Callback when tab changes */
  onTabChange?: (tab: ChannelTab) => void;
  /** Callback fired when the star toggle is clicked */
  onToggleStar?: (isStarred: boolean) => Promise<void>;
  /** Callback fired when user leaves the channel */
  onLeave?: () => Promise<void>;
  /** Callback to open channel details/settings */
  onOpenSettings?: () => void;
  /** Callback to open member list */
  onOpenMembers?: () => void;
  /** Callback to open channel details */
  onOpenDetails?: () => void;
  /** Callback for summarize channel */
  onSummarize?: () => void;
  /** Callback for edit notifications */
  onEditNotifications?: () => void;
  /** Callback for add template */
  onAddTemplate?: () => void;
  /** Callback for add workflow */
  onAddWorkflow?: () => void;
  /** Callback for search in channel */
  onSearchInChannel?: () => void;
  /** Callback for invite people */
  onInvite?: () => void;
  /** Callback for starting a huddle */
  onStartHuddle?: () => void;
  /** Callback for starting a call */
  onStartCall?: (type: 'audio' | 'video') => void;
  /** Whether there's an active huddle */
  hasActiveHuddle?: boolean;
  /** Number of participants in active huddle */
  huddleParticipantCount?: number;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Slack-like Channel Header Component
 *
 * Features:
 * - Channel name with dropdown menu containing all options
 * - Tabs (Messages, Canvas, Files, +)
 * - Member avatars with count
 * - Star button
 * - All menu options (Open channel details, Summarise channel, Edit notifications, etc.)
 */
export function ChannelHeader({
  channel,
  permissions,
  workspaceId,
  activeTab = 'messages',
  onTabChange,
  onToggleStar,
  onLeave,
  onOpenSettings,
  onOpenMembers,
  onOpenDetails,
  onSummarize,
  onEditNotifications,
  onAddTemplate,
  onAddWorkflow,
  onSearchInChannel,
  onInvite,
  onStartHuddle,
  onStartCall,
  hasActiveHuddle = false,
  huddleParticipantCount = 0,
  className,
}: ChannelHeaderProps) {
  const [isStarring, setIsStarring] = useState(false);

  // Get all member user IDs for presence fetching
  const memberUserIds = useMemo(() => {
    return channel.members.map((member) => member.userId);
  }, [channel.members]);

  // Fetch real-time presence for all members
  const presenceMap = useMultiplePresence(memberUserIds);

  // Sort members by online status (online first) and take first 3
  const sortedMembers = useMemo(() => {
    const statusPriority: Record<string, number> = {
      'online': 0,
      'busy': 1,
      'away': 2,
      'offline': 3,
    };

    return [...channel.members].sort((a, b) => {
      const statusA = presenceMap.get(a.userId)?.status || 'offline';
      const statusB = presenceMap.get(b.userId)?.status || 'offline';
      return (statusPriority[statusA] ?? 3) - (statusPriority[statusB] ?? 3);
    }).slice(0, 3);
  }, [channel.members, presenceMap]);

  const handleToggleStar = useCallback(async () => {
    if (isStarring) {
return;
}
    setIsStarring(true);
    try {
      await onToggleStar?.(channel.isStarred || false);
    } finally {
      setIsStarring(false);
    }
  }, [channel.isStarred, isStarring, onToggleStar]);

  const handleCopyLink = useCallback(() => {
    const url = `${window.location.origin}/${workspaceId}/channels/${channel?.id}`;
    navigator.clipboard.writeText(url);
  }, [workspaceId, channel?.id]);

  const handleOpenInNewWindow = useCallback(() => {
    const url = `${window.location.origin}/${workspaceId}/channels/${channel?.id}`;
    window.open(url, '_blank');
  }, [workspaceId, channel?.id]);

  const handleLeave = useCallback(async () => {
    await onLeave?.();
  }, [onLeave]);

  return (
    <div className={cn('border-b bg-card/30', className)}>
      {/* Top row: Channel name, star, members */}
      <div className="flex h-12 items-center justify-between px-4">
        
        {/* Left side: Channel name with dropdown */}
        <div className="flex items-center gap-2">
          {/* Star button */}
          <button
            type="button"
            onClick={handleToggleStar}
            disabled={isStarring}
            className="rounded-md p-1.5 hover:bg-accent transition-colors"
            title={channel.isStarred ? 'Unstar channel' : 'Star channel'}
          >
            <Star
              className={cn(
                'h-4 w-4',
                channel.isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground',
              )}
            />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-accent transition-colors"
              >
                <ChannelTypeIcon type={channel.type} className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">{channel.name}</span>
                {channel.isArchived && (
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    Archived
                  </span>
                )}
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuItem onClick={onOpenDetails || onOpenSettings}>
                <Info className="mr-2 h-4 w-4" />
                Open channel details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onSummarize}>
                <Sparkles className="mr-2 h-4 w-4" />
                Summarise channel
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onEditNotifications}>
                <Bell className="mr-2 h-4 w-4" />
                Edit notifications
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggleStar} disabled={isStarring}>
                <Star className={cn('mr-2 h-4 w-4', channel.isStarred && 'fill-yellow-400 text-yellow-400')} />
                {channel.isStarred ? 'Unstar channel' : 'Star channel'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onAddTemplate}>
                <FileText className="mr-2 h-4 w-4" />
                Add template
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAddWorkflow}>
                <Workflow className="mr-2 h-4 w-4" />
                Add workflow
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {permissions.canEdit && (
                <DropdownMenuItem onClick={onOpenSettings}>
                  <Settings className="mr-2 h-4 w-4" />
                  Edit settings
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleCopyLink}>
                <Copy className="mr-2 h-4 w-4" />
                Copy link
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onSearchInChannel}>
                <Search className="mr-2 h-4 w-4" />
                Search in channel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleOpenInNewWindow}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Open in new window
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLeave}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Leave channel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          

          {/* Channel description (if exists) */}
          {channel.description && (
            <span className="hidden lg:inline text-sm text-muted-foreground truncate max-w-xs">
              {channel.description}
            </span>
          )}
        </div>

        {/* Right side: Members and actions */}
        <div className="flex items-center gap-2">
          {/* Call buttons */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5">
                <Phone className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onStartCall?.('audio')}>
                <Phone className="mr-2 h-4 w-4" />
                Start audio call
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStartCall?.('video')}>
                <Video className="mr-2 h-4 w-4" />
                Start video call
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Huddle button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={hasActiveHuddle ? 'default' : 'ghost'}
                size="sm"
                className={cn(
                  'h-8 gap-1.5',
                  hasActiveHuddle && 'bg-green-600 hover:bg-green-700 text-white'
                )}
              >
                <Headphones className="h-4 w-4" />
                {hasActiveHuddle && huddleParticipantCount > 0 && (
                  <span className="text-xs">{huddleParticipantCount}</span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onStartHuddle}>
                <Headphones className="mr-2 h-4 w-4" />
                {hasActiveHuddle ? 'Join huddle' : 'Start a huddle'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Member avatars - sorted by online status */}
          <button
            type="button"
            onClick={onOpenMembers || onOpenDetails}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-accent transition-colors"
          >
            <div className="flex -space-x-2">
              {sortedMembers.map((member, index) => (
                <div
                  key={member.userId}
                  className="relative"
                  style={{ zIndex: 3 - index }}
                >
                  <ConnectedUserAvatar
                    user={{
                      id: member.userId,
                      name: member.user.name,
                      image: member.user.image,
                    }}
                    size="sm"
                    showPresence
                    className="border-2 border-card"
                  />
                </div>
              ))}
              {channel.memberCount > 3 && (
                <div className="flex h-6 w-6 items-center justify-center rounded-md border-2 border-card bg-muted text-[10px] font-medium">
                  +{channel.memberCount - 3}
                </div>
              )}
            </div>
            <span className="text-sm text-muted-foreground">{channel.memberCount}</span>
          </button>

          {/* Invite button (if can invite) */}
          {permissions.canInvite && (
            <button
              type="button"
              onClick={onInvite}
              className="rounded-md p-1.5 hover:bg-accent transition-colors"
              title="Invite people"
            >
              <UserPlus className="h-5 w-5 text-muted-foreground" />
            </button>
          )}

          {/* More actions button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-md p-1.5 hover:bg-accent transition-colors"
                title="More actions"
              >
                <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={onOpenDetails || onOpenSettings}>
                <Info className="mr-2 h-4 w-4" />
                Channel details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onSearchInChannel}>
                <Search className="mr-2 h-4 w-4" />
                Search in channel
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onEditNotifications}>
                <Bell className="mr-2 h-4 w-4" />
                Notifications
              </DropdownMenuItem>
              {permissions.canEdit && (
                <DropdownMenuItem onClick={onOpenSettings}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Bottom row: Tabs */}
      <div className="flex items-center gap-1 px-4 pb-3">
        <TabButton
          active={activeTab === 'messages'}
          onClick={() => onTabChange?.('messages')}
          icon={<MessageSquare className="h-4 w-4" />}
          label="Messages"
        />
        <TabButton
          active={activeTab === 'canvas'}
          onClick={() => onTabChange?.('canvas')}
          icon={<FileText className="h-4 w-4" />}
          label="Canvas"
        />
        <TabButton
          active={activeTab === 'files'}
          onClick={() => onTabChange?.('files')}
          icon={<FileText className="h-4 w-4" />}
          label="Files"
        />
        <button
          type="button"
          className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent transition-colors"
          title="Add a tab"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Tab button component
 */
interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-accent text-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ChannelTypeIcon({
  type,
  className,
}: {
  type: 'public' | 'private' | 'direct';
  className?: string;
}) {
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

  if (type === 'direct') {
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
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
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

export default ChannelHeader;
