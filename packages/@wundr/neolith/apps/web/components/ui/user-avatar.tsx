'use client';

import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, getInitials } from '@/lib/utils';

/**
 * Standard size options for user avatars.
 * Maps to consistent Tailwind classes across the application.
 */
export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

/**
 * Status options for user presence indicators.
 */
export type UserStatus = 'online' | 'offline' | 'away' | 'busy' | 'dnd';

/**
 * User data required for avatar display.
 * Supports multiple image property names for compatibility.
 */
export interface AvatarUser {
  /** User's display name (used for alt text and fallback initials) */
  name?: string | null;
  /** Primary avatar image URL */
  image?: string | null;
  /** Alternative avatar URL property (for API compatibility) */
  avatarUrl?: string | null;
  /** User's current status (for status indicator) */
  status?: UserStatus | null;
}

/**
 * Props for the UserAvatar component.
 */
export interface UserAvatarProps {
  /** User data for the avatar */
  user: AvatarUser;
  /** Size of the avatar */
  size?: AvatarSize;
  /** Shape of the avatar (circle is deprecated, prefer rounded variants) */
  shape?: 'circle' | 'rounded' | 'rounded-md' | 'rounded-sm';
  /** Whether to show the status indicator */
  showStatus?: boolean;
  /** Override status (useful when status comes from a different source) */
  status?: UserStatus | null;
  /** Optional CSS class name for the root element */
  className?: string;
  /** Optional CSS class name for the fallback element */
  fallbackClassName?: string;
}

/**
 * Size configuration mapping for avatar dimensions and text.
 */
const sizeConfig: Record<AvatarSize, { container: string; text: string }> = {
  xs: { container: 'h-5 w-5', text: 'text-[10px]' },
  sm: { container: 'h-6 w-6', text: 'text-xs' },
  md: { container: 'h-8 w-8', text: 'text-sm' },
  lg: { container: 'h-10 w-10', text: 'text-base' },
  xl: { container: 'h-12 w-12', text: 'text-lg' },
  '2xl': { container: 'h-16 w-16', text: 'text-xl' },
};

/**
 * Shape configuration for avatar border radius.
 * Note: 'circle' is deprecated, prefer 'rounded' (lg), 'rounded-md', or 'rounded-sm'
 */
const shapeConfig: Record<'circle' | 'rounded' | 'rounded-md' | 'rounded-sm', string> = {
  circle: 'rounded-lg', // Deprecated: now maps to rounded-lg for consistency
  rounded: 'rounded-lg',
  'rounded-md': 'rounded-md',
  'rounded-sm': 'rounded-sm',
};

/**
 * Status indicator colors for user presence.
 */
const statusColors: Record<UserStatus, string> = {
  online: 'bg-green-500',
  offline: 'bg-gray-400',
  away: 'bg-yellow-500',
  busy: 'bg-red-500',
  dnd: 'bg-red-500',
};

/**
 * Status indicator size configuration based on avatar size.
 */
const statusSizeConfig: Record<AvatarSize, { dot: string; position: string; border: string }> = {
  xs: { dot: 'h-1.5 w-1.5', position: '-bottom-0 -right-0', border: 'border' },
  sm: { dot: 'h-2 w-2', position: '-bottom-0.5 -right-0.5', border: 'border' },
  md: { dot: 'h-2.5 w-2.5', position: '-bottom-0.5 -right-0.5', border: 'border-2' },
  lg: { dot: 'h-3 w-3', position: '-bottom-0.5 -right-0.5', border: 'border-2' },
  xl: { dot: 'h-3.5 w-3.5', position: '-bottom-0.5 -right-0.5', border: 'border-2' },
  '2xl': { dot: 'h-4 w-4', position: '-bottom-1 -right-1', border: 'border-2' },
};

/**
 * A standardized user avatar component that handles:
 * - Image display with automatic fallback to initials
 * - Multiple image property sources (image, avatarUrl)
 * - Consistent sizing across the application
 * - Proper alt text for accessibility
 * - Optional status indicator for user presence
 *
 * @example
 * // Basic usage
 * <UserAvatar user={{ name: "John Doe", image: "/path/to/image.jpg" }} />
 *
 * @example
 * // With size and shape
 * <UserAvatar user={user} size="lg" shape="rounded" />
 *
 * @example
 * // With status indicator
 * <UserAvatar user={user} showStatus status="online" />
 *
 * @example
 * // With custom class
 * <UserAvatar user={user} className="ring-2 ring-primary" />
 */
export function UserAvatar({
  user,
  size = 'md',
  shape = 'rounded',
  showStatus = false,
  status,
  className,
  fallbackClassName,
}: UserAvatarProps) {
  // Support both 'image' and 'avatarUrl' properties for compatibility
  const imageUrl = user.image || user.avatarUrl;
  const initials = getInitials(user.name);
  const altText = user.name || 'User avatar';

  const { container, text } = sizeConfig[size];
  const shapeClass = shapeConfig[shape];

  // Use status prop if provided, otherwise fall back to user.status
  const currentStatus = status ?? user.status;
  const shouldShowStatus = showStatus && currentStatus;
  const statusSize = statusSizeConfig[size];

  return (
    <div className="relative inline-flex">
      <Avatar className={cn(container, shapeClass, className)}>
        <AvatarImage
          src={imageUrl || undefined}
          alt={altText}
          className="object-cover"
        />
        <AvatarFallback
          className={cn(
            shapeClass,
            text,
            'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-medium',
            fallbackClassName,
          )}
        >
          {initials}
        </AvatarFallback>
      </Avatar>
      {shouldShowStatus && (
        <span
          className={cn(
            'absolute rounded-full border-background',
            statusSize.dot,
            statusSize.position,
            statusSize.border,
            statusColors[currentStatus],
          )}
          aria-label={`Status: ${currentStatus}`}
        />
      )}
    </div>
  );
}

/**
 * Props for the GroupAvatar component (stacked avatars).
 */
export interface GroupAvatarProps {
  /** Array of users to display (supports readonly arrays) */
  users: readonly AvatarUser[];
  /** Maximum number of avatars to show before "+N" */
  max?: number;
  /** Size of each avatar */
  size?: AvatarSize;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Displays a group of overlapping user avatars with an overflow indicator.
 *
 * @example
 * <GroupAvatar users={participants} max={3} size="sm" />
 */
export function GroupAvatar({
  users,
  max = 3,
  size = 'sm',
  className,
}: GroupAvatarProps) {
  const visibleUsers = users.slice(0, max);
  const remainingCount = users.length - max;
  const { container, text } = sizeConfig[size];

  return (
    <div className={cn('flex -space-x-2', className)}>
      {visibleUsers.map((user, index) => (
        <UserAvatar
          key={`avatar-${index}`}
          user={user}
          size={size}
          className="ring-2 ring-background"
        />
      ))}
      {remainingCount > 0 && (
        <div
          className={cn(
            container,
            text,
            'flex items-center justify-center rounded-lg',
            'bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300',
            'ring-2 ring-background font-medium',
          )}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
}
