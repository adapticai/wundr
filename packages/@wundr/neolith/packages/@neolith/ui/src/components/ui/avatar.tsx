import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '../../lib/utils';

/**
 * Avatar size variants using class-variance-authority.
 */
const avatarVariants = cva(
  'relative flex shrink-0 overflow-hidden rounded-full',
  {
    variants: {
      /**
       * Size of the avatar.
       *
       * - `xs`: Extra small (24x24px)
       * - `sm`: Small (32x32px)
       * - `md`: Medium (40x40px)
       * - `lg`: Large (48x48px)
       * - `xl`: Extra large (64x64px)
       */
      size: {
        xs: 'h-6 w-6',
        sm: 'h-8 w-8',
        md: 'h-10 w-10',
        lg: 'h-12 w-12',
        xl: 'h-16 w-16',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

/**
 * Status indicator variants for online/offline states.
 */
const statusVariants = cva(
  'absolute bottom-0 right-0 rounded-full border-2 border-background',
  {
    variants: {
      /**
       * Status indicator state.
       *
       * - `online`: Green indicator
       * - `offline`: Gray indicator
       * - `busy`: Red indicator
       * - `away`: Yellow indicator
       */
      status: {
        online: 'bg-green-500',
        offline: 'bg-gray-400',
        busy: 'bg-red-500',
        away: 'bg-yellow-500',
      },
      /**
       * Size of the status indicator (relative to avatar size).
       */
      size: {
        xs: 'h-1.5 w-1.5',
        sm: 'h-2 w-2',
        md: 'h-2.5 w-2.5',
        lg: 'h-3 w-3',
        xl: 'h-4 w-4',
      },
    },
    defaultVariants: {
      status: 'offline',
      size: 'md',
    },
  }
);

/**
 * Props for the Avatar component.
 */
export interface AvatarProps
  extends
    React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>,
    VariantProps<typeof avatarVariants> {
  /**
   * Image source URL for the avatar.
   */
  src?: string;
  /**
   * Alt text for the avatar image.
   */
  alt?: string;
  /**
   * Fallback text to display when image fails to load.
   * Typically initials (e.g., "JD" for "John Doe").
   */
  fallback?: string;
  /**
   * Status indicator to show on the avatar.
   */
  status?: 'online' | 'offline' | 'busy' | 'away';
  /**
   * Whether to show the status indicator.
   * @default false
   */
  showStatus?: boolean;
}

/**
 * Extracts initials from a name string.
 *
 * @param name - Full name to extract initials from
 * @returns Up to 2 character initials
 *
 * @example
 * ```ts
 * getInitials('John Doe') // => 'JD'
 * getInitials('Alice') // => 'A'
 * getInitials('Mary Jane Watson') // => 'MW'
 * ```
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? '';
  const last = parts[parts.length - 1] ?? '';
  if (parts.length === 1) {
    return first.charAt(0).toUpperCase();
  }
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

/**
 * Avatar component for displaying user profile images with fallback support.
 *
 * Built on top of Radix UI Avatar primitive, providing:
 * - Automatic image loading with fallback to initials
 * - Multiple size variants
 * - Optional status indicator
 * - Accessible by default
 *
 * @example
 * ```tsx
 * // Avatar with image
 * <Avatar
 *   src="/user-photo.jpg"
 *   alt="John Doe"
 *   fallback="JD"
 * />
 *
 * // Avatar with status indicator
 * <Avatar
 *   src="/user-photo.jpg"
 *   alt="Jane Smith"
 *   fallback="JS"
 *   status="online"
 *   showStatus
 * />
 *
 * // Large avatar without image (fallback only)
 * <Avatar
 *   size="xl"
 *   fallback="AB"
 * />
 *
 * // Generating fallback from name
 * <Avatar
 *   src={user.avatar}
 *   alt={user.name}
 *   fallback={user.name} // Will auto-generate initials
 * />
 * ```
 *
 * @param props - Avatar component props
 * @returns An avatar element with image and/or fallback
 */
const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(
  (
    {
      className,
      size,
      src,
      alt,
      fallback,
      status,
      showStatus = false,
      ...props
    },
    ref
  ) => {
    // Generate initials if fallback looks like a full name
    const displayFallback = React.useMemo(() => {
      if (!fallback) {
        return '';
      }
      // If fallback is more than 2 chars and contains spaces, treat as name
      if (fallback.length > 2 && fallback.includes(' ')) {
        return getInitials(fallback);
      }
      // Otherwise use as-is (already initials or single char)
      return fallback.substring(0, 2).toUpperCase();
    }, [fallback]);

    return (
      <div className='relative inline-block'>
        <AvatarPrimitive.Root
          ref={ref}
          className={cn(avatarVariants({ size, className }))}
          {...props}
        >
          {src && (
            <AvatarPrimitive.Image
              src={src}
              alt={alt}
              className='aspect-square h-full w-full object-cover'
            />
          )}
          <AvatarPrimitive.Fallback
            className={cn(
              'flex h-full w-full items-center justify-center rounded-full',
              'bg-muted text-muted-foreground font-medium',
              size === 'xs' && 'text-[10px]',
              size === 'sm' && 'text-xs',
              size === 'md' && 'text-sm',
              size === 'lg' && 'text-base',
              size === 'xl' && 'text-lg'
            )}
            delayMs={600}
          >
            {displayFallback}
          </AvatarPrimitive.Fallback>
        </AvatarPrimitive.Root>
        {showStatus && status && (
          <span
            className={cn(statusVariants({ status, size }))}
            aria-label={`Status: ${status}`}
          />
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';

export { Avatar, avatarVariants, statusVariants, getInitials };
