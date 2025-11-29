'use client';

import { useState, useCallback } from 'react';
import {
  Headphones,
  Link2,
  Bell,
  BellOff,
  Search,
  MoreHorizontal,
  Star,
  Copy,
  ExternalLink,
  Info,
  Sparkles,
  FileText,
  FolderOpen,
  Plus,
  ChevronDown,
  Settings,
  Bot,
  MessageSquare,
  LayoutList,
  Workflow,
  BookOpen,
  Users,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DMCallButton } from '@/components/call/dm-call-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn, getInitials } from '@/lib/utils';

// Types
interface DMParticipant {
  id: string;
  name: string;
  email?: string;
  image?: string | null;
  status?: 'online' | 'offline' | 'away' | 'busy';
  isOrchestrator?: boolean;
}

type NotificationSetting = 'all' | 'mentions' | 'nothing' | 'muted';

interface DMHeaderProps {
  /** List of participants in the conversation (excluding current user) */
  participants: DMParticipant[];
  /** Current user ID for filtering */
  currentUserId?: string;
  /** Workspace ID for API calls */
  workspaceId: string;
  /** Conversation/channel ID */
  conversationId: string;
  /** Whether there's an active huddle */
  hasActiveHuddle?: boolean;
  /** Number of people in active huddle */
  huddleParticipantCount?: number;
  /** Current notification setting */
  notificationSetting?: NotificationSetting;
  /** Whether conversation is starred */
  isStarred?: boolean;
  /** Whether star toggle is in progress */
  isStarring?: boolean;
  /** Active tab */
  activeTab?: 'messages' | 'canvas' | 'files' | 'lists' | 'workflows' | 'bookmarks';
  /** Callback when huddle is started */
  onStartHuddle?: () => void;
  /** Callback to copy huddle link */
  onCopyHuddleLink?: () => void;
  /** Callback when notification setting changes */
  onNotificationChange?: (setting: NotificationSetting) => void;
  /** Callback when search is clicked */
  onSearch?: () => void;
  /** Callback when details panel should open */
  onViewDetails?: () => void;
  /** Callback when starred status changes */
  onToggleStar?: () => void;
  /** Callback to copy conversation name */
  onCopyName?: () => void;
  /** Callback to copy conversation link */
  onCopyLink?: () => void;
  /** Callback to open in new window */
  onOpenInNewWindow?: () => void;
  /** Callback when AI summarize is clicked */
  onSummarize?: () => void;
  /** Callback when tab changes */
  onTabChange?: (tab: 'messages' | 'canvas' | 'files' | 'lists' | 'workflows' | 'bookmarks') => void;
  /** Callback when add tab is clicked */
  onAddTab?: (tabType: string) => void;
  /** Callback when call is initiated */
  onCallInitiated?: (callId: string, type: 'audio' | 'video') => void;
  className?: string;
}

/**
 * Stacked Avatars Component
 * Shows overlapping avatars with a count badge for group conversations
 */
function StackedAvatars({
  participants,
  maxVisible = 3,
  size = 'md',
}: {
  participants: DMParticipant[];
  maxVisible?: number;
  size?: 'sm' | 'md' | 'lg';
}) {
  const visibleParticipants = participants.slice(0, maxVisible);
  const remainingCount = Math.max(0, participants.length - maxVisible);

  const sizeClasses = {
    sm: 'h-5 w-5 text-[10px]',
    md: 'h-7 w-7 text-xs',
    lg: 'h-9 w-9 text-sm',
  };

  const statusColors = {
    online: 'bg-green-500',
    away: 'bg-yellow-500',
    busy: 'bg-red-500',
    offline: 'bg-gray-400',
  };

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {visibleParticipants.map((participant, index) => (
          <div
            key={participant.id}
            className="relative"
            style={{ zIndex: maxVisible - index }}
          >
            <Avatar
              className={cn(
                sizeClasses[size],
                'border-2 border-background ring-0'
              )}
            >
              <AvatarImage src={participant.image || undefined} alt={participant.name} />
              <AvatarFallback className={cn('text-[10px]', size === 'sm' && 'text-[8px]')}>
                {participant.isOrchestrator ? (
                  <Bot className="h-3 w-3" />
                ) : (
                  getInitials(participant.name)
                )}
              </AvatarFallback>
            </Avatar>
            {/* Status indicator - only show on first avatar */}
            {index === 0 && participant.status && (
              <span
                className={cn(
                  'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background',
                  statusColors[participant.status]
                )}
              />
            )}
            {/* Orchestrator badge */}
            {participant.isOrchestrator && (
              <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-primary text-[6px] font-bold text-primary-foreground">
                AI
              </span>
            )}
          </div>
        ))}
        {/* Remaining count badge */}
        {remainingCount > 0 && (
          <div
            className={cn(
              sizeClasses[size],
              'flex items-center justify-center rounded-full bg-muted border-2 border-background font-medium text-muted-foreground'
            )}
            style={{ zIndex: 0 }}
          >
            +{remainingCount}
          </div>
        )}
      </div>
      {/* Total participant count */}
      {participants.length > 1 && (
        <span className="ml-2 text-xs text-muted-foreground font-medium">
          {participants.length}
        </span>
      )}
    </div>
  );
}

/**
 * Conversation Name Component
 * Shows participant names formatted appropriately
 */
function ConversationName({ participants }: { participants: DMParticipant[] }) {
  if (participants.length === 0) {
    return <span className="font-semibold text-sm">Unknown Conversation</span>;
  }

  if (participants.length === 1) {
    return (
      <span className="font-semibold text-sm flex items-center gap-1.5">
        {participants[0].name}
        {participants[0].isOrchestrator && (
          <Bot className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </span>
    );
  }

  // Group conversation - show first 2-3 names
  const maxNames = 2;
  const displayNames = participants.slice(0, maxNames).map((p) => p.name);
  const remaining = participants.length - maxNames;

  return (
    <span className="font-semibold text-sm">
      {displayNames.join(', ')}
      {remaining > 0 && `, +${remaining}`}
    </span>
  );
}

/**
 * Header Tabs Component
 * Shows Messages/Canvas/Files tabs with add button
 */
function HeaderTabs({
  activeTab,
  onTabChange,
  onAddTab,
}: {
  activeTab: 'messages' | 'canvas' | 'files' | 'lists' | 'workflows' | 'bookmarks';
  onTabChange?: (tab: 'messages' | 'canvas' | 'files' | 'lists' | 'workflows' | 'bookmarks') => void;
  onAddTab?: (tabType: string) => void;
}) {
  const tabs = [
    { id: 'messages' as const, label: 'Messages', icon: MessageSquare },
    { id: 'canvas' as const, label: 'Canvas', icon: FileText },
  ];

  return (
    <div className="flex items-center gap-1 border-b">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange?.(tab.id)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors relative',
            activeTab === tab.id
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <tab.icon className="h-4 w-4" />
          {tab.label}
          {activeTab === tab.id && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
      ))}

      {/* Add tab dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 ml-1">
            <Plus className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Add a tab
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onAddTab?.('link')}>
            <Link2 className="mr-2 h-4 w-4" />
            Link
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddTab?.('folder')}>
            <FolderOpen className="mr-2 h-4 w-4" />
            Folder
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onAddTab?.('canvas')}>
            <FileText className="mr-2 h-4 w-4" />
            Canvas
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddTab?.('list')}>
            <LayoutList className="mr-2 h-4 w-4" />
            List
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddTab?.('workflow')}>
            <Workflow className="mr-2 h-4 w-4" />
            Workflow
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onAddTab?.('customize')}>
            <Settings className="mr-2 h-4 w-4" />
            Customise tabs
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * DM Header Component
 *
 * A comprehensive header for direct message conversations with Slack-style features:
 * - Stacked avatars with participant count
 * - Huddle button with dropdown
 * - Notifications button with settings
 * - Search button
 * - More actions dropdown
 * - Messages/Canvas tabs
 */
export function DMHeader({
  participants,
  workspaceId,
  conversationId,
  hasActiveHuddle = false,
  huddleParticipantCount = 0,
  notificationSetting = 'all',
  isStarred = false,
  isStarring = false,
  activeTab = 'messages',
  onStartHuddle,
  onCopyHuddleLink,
  onNotificationChange,
  onSearch,
  onViewDetails,
  onToggleStar,
  onCopyName,
  onCopyLink,
  onOpenInNewWindow,
  onSummarize,
  onTabChange,
  onAddTab,
  onCallInitiated,
  className,
}: DMHeaderProps) {
  const [localNotificationSetting, setLocalNotificationSetting] =
    useState<NotificationSetting>(notificationSetting);

  const handleNotificationChange = useCallback(
    (value: string) => {
      const setting = value as NotificationSetting;
      setLocalNotificationSetting(setting);
      onNotificationChange?.(setting);
    },
    [onNotificationChange]
  );

  const isGroupDM = participants.length > 1;

  return (
    <div className={cn('flex flex-col border-b bg-card/30', className)}>
      {/* Main header row */}
      <div className="flex h-12 items-center justify-between px-4">
        {/* Left section - Star button, Avatars and names */}
        <div className="flex items-center gap-2">
          {/* Star button */}
          <button
            type="button"
            onClick={onToggleStar}
            disabled={isStarring}
            className="rounded-md p-1.5 hover:bg-accent transition-colors"
            title={isStarred ? 'Unstar conversation' : 'Star conversation'}
          >
            <Star
              className={cn(
                'h-4 w-4',
                isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground',
              )}
            />
          </button>
          <button
            onClick={onViewDetails}
            className="flex items-center gap-3 hover:bg-accent rounded-md px-2 py-1 transition-colors"
          >
            <StackedAvatars participants={participants} maxVisible={3} size="md" />
            <div className="flex items-center gap-2">
              <ConversationName participants={participants} />
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </button>
        </div>

        {/* Right section - Actions */}
        <div className="flex items-center gap-1">
          {/* Call button */}
          <DMCallButton
            channelId={conversationId}
            workspaceId={workspaceId}
            participantIds={participants.map((p) => p.id)}
            onCallInitiated={onCallInitiated}
            iconOnly
          />

          {/* Huddle button with dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={hasActiveHuddle ? 'default' : 'ghost'}
                size="sm"
                className={cn(
                  'h-8 gap-2',
                  hasActiveHuddle && 'bg-green-600 hover:bg-green-700 text-white'
                )}
              >
                <Headphones className="h-4 w-4" />
                {hasActiveHuddle ? (
                  <span className="text-xs">{huddleParticipantCount}</span>
                ) : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={onStartHuddle}>
                <Headphones className="mr-2 h-4 w-4" />
                {hasActiveHuddle ? 'Join huddle' : 'Start a huddle'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCopyHuddleLink}>
                <Link2 className="mr-2 h-4 w-4" />
                Copy huddle link
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notifications button with dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                {localNotificationSetting === 'muted' ||
                localNotificationSetting === 'nothing' ? (
                  <BellOff className="h-4 w-4" />
                ) : (
                  <Bell className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Notification preference
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={localNotificationSetting}
                onValueChange={handleNotificationChange}
              >
                <DropdownMenuRadioItem value="all">
                  <div className="flex flex-col">
                    <span>All new posts</span>
                    <span className="text-xs text-muted-foreground">
                      Get notified for all messages
                    </span>
                  </div>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="mentions">
                  <div className="flex flex-col">
                    <span>Just @mentions</span>
                    <span className="text-xs text-muted-foreground">
                      Only when you're mentioned
                    </span>
                  </div>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="nothing">
                  <div className="flex flex-col">
                    <span>Nothing</span>
                    <span className="text-xs text-muted-foreground">
                      No notifications at all
                    </span>
                  </div>
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleNotificationChange('muted')}
                className={cn(
                  localNotificationSetting === 'muted' && 'bg-accent'
                )}
              >
                <BellOff className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span>Mute conversation</span>
                  <span className="text-xs text-muted-foreground">
                    {localNotificationSetting === 'muted'
                      ? 'Currently muted'
                      : 'Silence all notifications'}
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Advanced notification options
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Search button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onSearch}
            title="Search in conversation"
          >
            <Search className="h-4 w-4" />
          </Button>

          {/* More actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem onClick={onViewDetails}>
                <Info className="mr-2 h-4 w-4" />
                {isGroupDM ? 'Conversation details' : 'View profile'}
              </DropdownMenuItem>
              {isGroupDM && (
                <DropdownMenuItem onClick={onViewDetails}>
                  <Users className="mr-2 h-4 w-4" />
                  View all {participants.length} members
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSummarize}>
                <Sparkles className="mr-2 h-4 w-4" />
                Get a summary of this conversation
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onToggleStar} disabled={isStarring}>
                <Star
                  className={cn(
                    'mr-2 h-4 w-4',
                    isStarred && 'fill-yellow-400 text-yellow-400'
                  )}
                />
                {isStarred ? 'Unstar conversation' : 'Star conversation'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-48">
                  <DropdownMenuItem onClick={onCopyName}>
                    Copy name
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onCopyLink}>
                    Copy link
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onCopyHuddleLink}>
                    Copy huddle link
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSearch}>
                <Search className="mr-2 h-4 w-4" />
                Search in conversation
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenInNewWindow}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Open in new window
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <BookOpen className="mr-2 h-4 w-4" />
                View conversation history
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs row */}
      <HeaderTabs
        activeTab={activeTab}
        onTabChange={onTabChange}
        onAddTab={onAddTab}
      />
    </div>
  );
}

// Legacy single-user header for backwards compatibility
interface LegacyDMHeaderProps {
  user: DMParticipant | null;
  workspaceId?: string;
  onStartCall?: () => void;
  onStartVideoCall?: () => void;
  onViewProfile?: () => void;
  className?: string;
}

export function LegacyDMHeader({
  user,
  workspaceId = '',
  onViewProfile,
  className,
}: LegacyDMHeaderProps) {
  if (!user) {
    return (
      <div className={cn('flex h-12 items-center justify-between border-b px-4', className)}>
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  return (
    <DMHeader
      participants={[user]}
      workspaceId={workspaceId}
      conversationId=""
      onViewDetails={onViewProfile}
      className={className}
    />
  );
}
