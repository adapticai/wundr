/**
 * Mobile Sidebar Component
 * Mobile-optimized sidebar with collapsible sections and touch-optimized targets
 * @module components/layout/mobile-sidebar
 */

'use client';

import {
  ChevronDown,
  ChevronRight,
  Hash,
  Lock,
  Volume2,
  Settings,
  LogOut,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

export interface MobileSidebarChannel {
  id: string;
  name: string;
  icon?: LucideIcon;
  type?: 'text' | 'voice' | 'private';
  unread?: number;
}

export interface MobileSidebarSection {
  id: string;
  title: string;
  channels: MobileSidebarChannel[];
  defaultOpen?: boolean;
}

export interface MobileSidebarUser {
  name: string;
  email: string;
  avatar?: string;
  status?: 'online' | 'away' | 'busy' | 'offline';
}

export interface MobileSidebarProps {
  sections?: MobileSidebarSection[];
  user?: MobileSidebarUser;
  className?: string;
  onChannelClick?: (channelId: string) => void;
  onUserMenuClick?: () => void;
  onLogoutClick?: () => void;
}

const DEFAULT_SECTIONS: MobileSidebarSection[] = [
  {
    id: 'text-channels',
    title: 'Text Channels',
    channels: [
      { id: 'general', name: 'general', icon: Hash, type: 'text' },
      {
        id: 'announcements',
        name: 'announcements',
        icon: Hash,
        type: 'text',
        unread: 2,
      },
    ],
    defaultOpen: true,
  },
  {
    id: 'voice-channels',
    title: 'Voice Channels',
    channels: [
      { id: 'voice-general', name: 'General', icon: Volume2, type: 'voice' },
      { id: 'voice-team', name: 'Team', icon: Volume2, type: 'voice' },
    ],
    defaultOpen: false,
  },
];

const DEFAULT_USER: MobileSidebarUser = {
  name: 'User',
  email: 'user@example.com',
  status: 'online',
};

function getChannelIcon(channel: MobileSidebarChannel): LucideIcon {
  if (channel.icon) {
    return channel.icon;
  }
  if (channel.type === 'voice') {
    return Volume2;
  }
  if (channel.type === 'private') {
    return Lock;
  }
  return Hash;
}

function getStatusColor(status: MobileSidebarUser['status']): string {
  switch (status) {
    case 'online':
      return 'bg-green-500';
    case 'away':
      return 'bg-yellow-500';
    case 'busy':
      return 'bg-red-500';
    case 'offline':
    default:
      return 'bg-gray-500';
  }
}

/**
 * Mobile-optimized sidebar component
 * - Collapsible channel sections
 * - Touch-optimized items (44x44px minimum touch targets)
 * - Smooth animations
 * - Unread badge indicators
 * - User menu at bottom
 *
 * @example
 * <MobileSidebar
 *   sections={channelSections}
 *   user={currentUser}
 *   onChannelClick={(id) => router.push(`/channels/${id}`)}
 *   onLogoutClick={handleLogout}
 * />
 */
export function MobileSidebar({
  sections = DEFAULT_SECTIONS,
  user = DEFAULT_USER,
  className,
  onChannelClick,
  onUserMenuClick,
  onLogoutClick,
}: MobileSidebarProps) {
  const pathname = usePathname();
  const [openSections, setOpenSections] = React.useState<Set<string>>(
    new Set(sections.filter(s => s.defaultOpen).map(s => s.id))
  );

  const toggleSection = React.useCallback((sectionId: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const handleChannelClick = React.useCallback(
    (channelId: string) => {
      if (onChannelClick) {
        onChannelClick(channelId);
      }
    },
    [onChannelClick]
  );

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Scrollable channel list */}
      <div className='flex-1 overflow-y-auto'>
        <div className='p-2 space-y-2'>
          {sections.map(section => {
            const isOpen = openSections.has(section.id);

            return (
              <Collapsible
                key={section.id}
                open={isOpen}
                onOpenChange={() => toggleSection(section.id)}
              >
                <CollapsibleTrigger
                  className={cn(
                    // Touch target - minimum 44x44px
                    'flex items-center justify-between w-full',
                    'min-h-[44px] px-3 py-2',
                    'text-sm font-semibold text-muted-foreground',
                    'hover:text-foreground transition-colors',
                    'rounded-md hover:bg-accent',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  )}
                >
                  <span className='uppercase tracking-wider text-xs'>
                    {section.title}
                  </span>
                  {isOpen ? (
                    <ChevronDown className='h-4 w-4' />
                  ) : (
                    <ChevronRight className='h-4 w-4' />
                  )}
                </CollapsibleTrigger>

                <CollapsibleContent className='space-y-1 pt-1'>
                  {section.channels.map(channel => {
                    const Icon = getChannelIcon(channel);
                    const isActive =
                      pathname === `/channels/${channel.id}` ||
                      pathname?.startsWith(`/channels/${channel.id}/`);

                    return (
                      <button
                        key={channel.id}
                        onClick={() => handleChannelClick(channel.id)}
                        className={cn(
                          // Touch target - minimum 44x44px
                          'flex items-center gap-3 w-full',
                          'min-h-[44px] px-3 py-2',
                          'text-sm font-medium',
                          'rounded-md transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          isActive
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                        )}
                        aria-label={channel.name}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <Icon className='h-5 w-5 shrink-0' aria-hidden='true' />
                        <span className='flex-1 text-left truncate'>
                          {channel.name}
                        </span>
                        {channel.unread !== undefined && channel.unread > 0 && (
                          <span
                            className={cn(
                              'flex items-center justify-center',
                              'min-w-[20px] h-5 px-1.5',
                              'text-xs font-bold text-white',
                              'bg-primary rounded-full'
                            )}
                            aria-label={`${channel.unread} unread messages`}
                          >
                            {channel.unread > 99 ? '99+' : channel.unread}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </div>

      {/* User menu at bottom */}
      <div className='border-t border-border p-2 mt-auto'>
        <div className='flex items-center gap-3 p-2'>
          <div className='relative'>
            <Avatar className='h-10 w-10'>
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback>
                {user.name
                  .split(' ')
                  .map(n => n[0])
                  .join('')
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {user.status && (
              <span
                className={cn(
                  'absolute bottom-0 right-0',
                  'w-3 h-3 rounded-full border-2 border-background',
                  getStatusColor(user.status)
                )}
                aria-label={`Status: ${user.status}`}
              />
            )}
          </div>

          <div className='flex-1 min-w-0'>
            <p className='text-sm font-semibold truncate'>{user.name}</p>
            <p className='text-xs text-muted-foreground truncate'>
              {user.email}
            </p>
          </div>

          <div className='flex gap-1'>
            <Button
              variant='ghost'
              size='icon'
              className='h-9 w-9'
              onClick={onUserMenuClick}
              aria-label='User settings'
            >
              <Settings className='h-4 w-4' />
            </Button>
            <Button
              variant='ghost'
              size='icon'
              className='h-9 w-9'
              onClick={onLogoutClick}
              aria-label='Logout'
            >
              <LogOut className='h-4 w-4' />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export interface MobileSidebarItemProps {
  icon: LucideIcon;
  label: string;
  href?: string;
  onClick?: () => void;
  isActive?: boolean;
  badge?: number | string;
  className?: string;
}

/**
 * Individual sidebar item component
 * Can be used outside of MobileSidebar for custom layouts
 */
export function MobileSidebarItem({
  icon: Icon,
  label,
  href,
  onClick,
  isActive = false,
  badge,
  className,
}: MobileSidebarItemProps) {
  const content = (
    <>
      <Icon className='h-5 w-5 shrink-0' aria-hidden='true' />
      <span className='flex-1 text-left truncate'>{label}</span>
      {badge !== undefined && (
        <span
          className={cn(
            'flex items-center justify-center',
            'min-w-[20px] h-5 px-1.5',
            'text-xs font-bold text-white',
            'bg-primary rounded-full'
          )}
          aria-label={`${badge} notifications`}
        >
          {typeof badge === 'number' && badge > 99 ? '99+' : badge}
        </span>
      )}
    </>
  );

  const baseClasses = cn(
    // Touch target - minimum 44x44px
    'flex items-center gap-3 w-full',
    'min-h-[44px] px-3 py-2',
    'text-sm font-medium',
    'rounded-md transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    isActive
      ? 'bg-accent text-accent-foreground'
      : 'text-muted-foreground hover:text-foreground hover:bg-accent',
    className
  );

  if (href) {
    return (
      <Link
        href={href}
        className={baseClasses}
        aria-current={isActive ? 'page' : undefined}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      onClick={onClick}
      className={baseClasses}
      aria-current={isActive ? 'page' : undefined}
    >
      {content}
    </button>
  );
}
