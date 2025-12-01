'use client';

import { useState, useMemo } from 'react';

import { UserAvatar } from '@/components/ui/user-avatar';
import { cn } from '@/lib/utils';

import { PresenceIndicator, statusLabels } from './presence-indicator';

import type { PresenceStatus } from './presence-indicator';

/**
 * Represents a user with online presence information
 */
export interface OnlineUser {
  /** User ID */
  id: string;
  /** User display name */
  name: string;
  /** User email address */
  email?: string;
  /** Optional avatar image URL */
  image?: string | null;
  /** Current presence status */
  status: PresenceStatus;
  /** Custom status message */
  customStatus?: string;
  /** Last seen timestamp for offline users */
  lastSeen?: Date | null;
}

/**
 * Props for the OnlineUsersList component
 */
interface OnlineUsersListProps {
  /** Array of users to display */
  users: OnlineUser[];
  /** Current user's ID for highlighting */
  currentUserId?: string;
  /** Callback when a user is clicked */
  onUserClick?: (userId: string) => void;
  /** Callback to start a direct message */
  onDirectMessage?: (userId: string) => void;
  /** Whether to show status-based sections */
  showSections?: boolean;
  /** Whether sections can be collapsed */
  collapsibleSections?: boolean;
  /** Optional CSS class name */
  className?: string;
}

type StatusGroup = {
  status: PresenceStatus;
  label: string;
  users: OnlineUser[];
};

const statusOrder: PresenceStatus[] = ['online', 'busy', 'away', 'offline'];

export function OnlineUsersList({
  users,
  currentUserId,
  onUserClick,
  onDirectMessage,
  showSections = true,
  collapsibleSections = true,
  className,
}: OnlineUsersListProps) {
  const [collapsedSections, setCollapsedSections] = useState<
    Set<PresenceStatus>
  >(new Set());

  const groupedUsers = useMemo(() => {
    const groups: StatusGroup[] = statusOrder.map(status => ({
      status,
      label: statusLabels[status],
      users: users
        .filter(u => u.status === status)
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));

    return groups.filter(g => g.users.length > 0);
  }, [users]);

  const toggleSection = (status: PresenceStatus) => {
    if (!collapsibleSections) {
      return;
    }

    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  if (users.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-8',
          className
        )}
      >
        <UsersIcon className='h-12 w-12 text-stone-300 dark:text-stone-700' />
        <p className='mt-2 text-sm text-stone-600 dark:text-stone-400 font-sans'>
          No users to display
        </p>
      </div>
    );
  }

  if (!showSections) {
    return (
      <div className={cn('space-y-1', className)}>
        {users
          .sort((a, b) => {
            const statusDiff =
              statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
            return statusDiff !== 0 ? statusDiff : a.name.localeCompare(b.name);
          })
          .map(user => (
            <UserListItem
              key={user.id}
              user={user}
              isCurrentUser={user.id === currentUserId}
              onClick={onUserClick}
              onDirectMessage={onDirectMessage}
            />
          ))}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {groupedUsers.map(group => {
        const isCollapsed = collapsedSections.has(group.status);

        return (
          <div key={group.status}>
            {/* Section Header */}
            <button
              type='button'
              onClick={() => toggleSection(group.status)}
              disabled={!collapsibleSections}
              className={cn(
                'flex w-full items-center gap-2 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider',
                'text-stone-500 dark:text-stone-500 font-heading',
                collapsibleSections &&
                  'hover:text-stone-900 dark:hover:text-stone-100 cursor-pointer'
              )}
              aria-expanded={!isCollapsed}
            >
              {collapsibleSections && (
                <ChevronIcon
                  className={cn(
                    'h-3 w-3 transition-transform',
                    isCollapsed && '-rotate-90'
                  )}
                />
              )}
              <PresenceIndicator
                status={group.status}
                size='sm'
                showPulse={false}
              />
              <span>
                {group.label} - {group.users.length}
              </span>
            </button>

            {/* User List */}
            {!isCollapsed && (
              <div className='space-y-0.5 pl-2'>
                {group.users.map(user => (
                  <UserListItem
                    key={user.id}
                    user={user}
                    isCurrentUser={user.id === currentUserId}
                    onClick={onUserClick}
                    onDirectMessage={onDirectMessage}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface UserListItemProps {
  user: OnlineUser;
  isCurrentUser?: boolean;
  onClick?: (userId: string) => void;
  onDirectMessage?: (userId: string) => void;
}

function UserListItem({
  user,
  isCurrentUser,
  onClick,
  onDirectMessage,
}: UserListItemProps) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className='relative group'
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <button
        type='button'
        onClick={() => onClick?.(user.id)}
        className={cn(
          'flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors',
          'hover:bg-accent'
        )}
      >
        {/* Avatar with presence indicator */}
        <div className='relative flex-shrink-0'>
          <UserAvatar user={user} size='md' />
          <PresenceIndicator
            status={user.status}
            size='sm'
            showPulse={user.status === 'online'}
            className='absolute -bottom-0.5 -right-0.5 ring-2 ring-card'
          />
        </div>

        {/* User info */}
        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-1'>
            <span className='truncate text-sm font-medium text-stone-900 dark:text-stone-100 font-sans'>
              {user.name}
            </span>
            {isCurrentUser && (
              <span className='text-xs text-stone-500 dark:text-stone-500 font-sans'>
                (you)
              </span>
            )}
          </div>
          {user.customStatus && (
            <p className='truncate text-xs text-stone-600 dark:text-stone-400 font-sans'>
              {user.customStatus}
            </p>
          )}
        </div>
      </button>

      {/* Quick Actions */}
      {showActions && onDirectMessage && !isCurrentUser && (
        <button
          type='button'
          onClick={e => {
            e.stopPropagation();
            onDirectMessage(user.id);
          }}
          className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2',
            'rounded-md p-1.5 text-muted-foreground',
            'hover:bg-accent hover:text-foreground',
            'opacity-0 group-hover:opacity-100 transition-opacity'
          )}
          aria-label={`Message ${user.name}`}
          title='Send direct message'
        >
          <MessageIcon className='h-4 w-4' />
        </button>
      )}
    </div>
  );
}

// Icons
function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='m6 9 6 6 6-6' />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' />
      <circle cx='9' cy='7' r='4' />
      <path d='M22 21v-2a4 4 0 0 0-3-3.87' />
      <path d='M16 3.13a4 4 0 0 1 0 7.75' />
    </svg>
  );
}

function MessageIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M7.9 20A9 9 0 1 0 4 16.1L2 22Z' />
    </svg>
  );
}
