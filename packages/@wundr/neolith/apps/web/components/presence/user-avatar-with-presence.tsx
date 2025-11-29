'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, getInitials } from '@/lib/utils';

import { PresenceIndicator } from './presence-indicator';

import type { PresenceStatus } from './presence-indicator';

/**
 * User data for avatar display
 */
interface AvatarUser {
  /** User ID */
  id: string;
  /** User display name */
  name: string;
  /** Optional avatar image URL */
  image?: string | null;
}

/**
 * Props for the UserAvatarWithPresence component
 */
interface UserAvatarWithPresenceProps {
  /** User data for the avatar */
  user: AvatarUser;
  /** Current presence status */
  status?: PresenceStatus;
  /** Size of the avatar */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Whether to show the presence indicator */
  showPresence?: boolean;
  /** Whether to show pulsing animation when online */
  showPulse?: boolean;
  /** Optional CSS class name */
  className?: string;
}

const avatarSizeClasses = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base',
  xl: 'h-12 w-12 text-lg',
};

const presencePositionClasses = {
  sm: '-bottom-0.5 -right-0.5',
  md: '-bottom-0.5 -right-0.5',
  lg: '-bottom-0.5 -right-0.5',
  xl: '-bottom-1 -right-1',
};

const presenceSizeMap = {
  sm: 'sm' as const,
  md: 'sm' as const,
  lg: 'md' as const,
  xl: 'md' as const,
};

export function UserAvatarWithPresence({
  user,
  status = 'offline',
  size = 'md',
  showPresence = true,
  showPulse = true,
  className,
}: UserAvatarWithPresenceProps) {
  const initials = getInitials(user.name);

  return (
    <div className={cn('relative inline-flex flex-shrink-0', className)}>
      <Avatar className={avatarSizeClasses[size]}>
        <AvatarImage src={user.image || undefined} alt={user.name} />
        <AvatarFallback className="bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-heading">
          {initials}
        </AvatarFallback>
      </Avatar>

      {showPresence && (
        <PresenceIndicator
          status={status}
          size={presenceSizeMap[size]}
          showPulse={showPulse && status === 'online'}
          className={cn(
            'absolute ring-2 ring-card',
            presencePositionClasses[size],
          )}
        />
      )}
    </div>
  );
}

/**
 * Props for ConnectedUserAvatar - an avatar that fetches presence from context
 */
interface ConnectedUserAvatarProps {
  /** User data for the avatar */
  user: AvatarUser;
  /** Size of the avatar */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Whether to show the presence indicator */
  showPresence?: boolean;
  /** Optional CSS class name */
  className?: string;
}

export function ConnectedUserAvatar({
  user,
  size = 'md',
  showPresence = true,
  className,
}: ConnectedUserAvatarProps) {
  // This component can be connected to the presence context
  // For now, it defaults to showing as offline
  // Integration with usePresenceContext would look like:
  // const { getPresence } = usePresenceContext();
  // const presence = getPresence(user.id);
  // const status = presence?.status ?? 'offline';

  return (
    <UserAvatarWithPresence
      user={user}
      status="offline"
      size={size}
      showPresence={showPresence}
      className={className}
    />
  );
}

