'use client';

import { cn } from '@/lib/utils';

import { PresenceIndicator } from './presence-indicator';

import type { PresenceStatus } from './presence-indicator';

interface UserAvatarWithPresenceProps {
  user: {
    id: string;
    name: string;
    image?: string | null;
  };
  status?: PresenceStatus;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showPresence?: boolean;
  showPulse?: boolean;
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
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground',
          avatarSizeClasses[size],
        )}
      >
        {user.image ? (
          <img
            src={user.image}
            alt={user.name}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </div>

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
 * Avatar with presence that fetches presence from context
 */
interface ConnectedUserAvatarProps {
  user: {
    id: string;
    name: string;
    image?: string | null;
  };
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showPresence?: boolean;
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

// Utility function
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
