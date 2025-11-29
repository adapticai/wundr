'use client';

import { Hash, MessageSquare, Star } from 'lucide-react';
import * as React from 'react';

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

import type { Channel, DirectMessageChannel } from '@/types/channel';

interface CollapsedChannelIconsProps {
  /** List of channels */
  channels: Channel[];
  /** List of direct messages */
  directMessages: DirectMessageChannel[];
  /** List of starred channels */
  starredChannels: Channel[];
  /** List of starred DMs */
  starredDMs: DirectMessageChannel[];
  /** Additional CSS class names */
  className?: string;
}

/**
 * Collapsed sidebar icons for Channels, DMs, and Starred sections
 *
 * Displays icons with unread indicators when the sidebar is collapsed.
 * Clicking any icon expands the sidebar to show the full channel list.
 */
export function CollapsedChannelIcons({
  channels,
  directMessages,
  starredChannels,
  starredDMs,
  className,
}: CollapsedChannelIconsProps) {
  const { setOpen } = useSidebar();

  // Calculate unread counts for each section
  const channelsUnreadCount = React.useMemo(() => {
    return channels.reduce((sum, channel) => sum + (channel.unreadCount || 0), 0);
  }, [channels]);

  const dmsUnreadCount = React.useMemo(() => {
    return directMessages.reduce((sum, dm) => sum + (dm.unreadCount || 0), 0);
  }, [directMessages]);

  const starredUnreadCount = React.useMemo(() => {
    const channelUnread = starredChannels.reduce((sum, channel) => sum + (channel.unreadCount || 0), 0);
    const dmUnread = starredDMs.reduce((sum, dm) => sum + (dm.unreadCount || 0), 0);
    return channelUnread + dmUnread;
  }, [starredChannels, starredDMs]);

  // Only show starred icon if there are starred items
  const hasStarred = starredChannels.length > 0 || starredDMs.length > 0;

  // Handle icon click - expand sidebar
  const handleIconClick = React.useCallback(() => {
    setOpen(true);
  }, [setOpen]);

  return (
    <SidebarMenu className={className}>
      {/* Starred Icon - only show if there are starred items */}
      {hasStarred && (
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={handleIconClick}
            tooltip="Starred"
            className="relative"
          >
            <Star className={cn('h-4 w-4', starredUnreadCount > 0 && 'text-yellow-500')} />
            <span className="sr-only">Starred</span>
            {starredUnreadCount > 0 && (
              <UnreadBadge count={starredUnreadCount} />
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      )}

      {/* Channels Icon */}
      <SidebarMenuItem>
        <SidebarMenuButton
          onClick={handleIconClick}
          tooltip="Channels"
          className="relative"
        >
          <Hash className="h-4 w-4" />
          <span className="sr-only">Channels</span>
          {channelsUnreadCount > 0 && (
            <UnreadBadge count={channelsUnreadCount} />
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>

      {/* Direct Messages Icon */}
      <SidebarMenuItem>
        <SidebarMenuButton
          onClick={handleIconClick}
          tooltip="Direct Messages"
          className="relative"
        >
          <MessageSquare className="h-4 w-4" />
          <span className="sr-only">Direct Messages</span>
          {dmsUnreadCount > 0 && (
            <UnreadBadge count={dmsUnreadCount} />
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

/**
 * Unread badge component for collapsed icons
 */
function UnreadBadge({ count }: { count: number }) {
  const displayCount = count > 99 ? '99+' : count;

  return (
    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
      {displayCount}
    </span>
  );
}
