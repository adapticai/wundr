'use client';

import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';

import { cn } from '@/lib/utils';

/**
 * Avatar shape variants based on size
 * - lg (large): rounded-lg (8px border radius)
 * - md (medium): rounded-md (6px border radius)
 * - sm (small): rounded-sm (2px border radius)
 * - full: rounded-full (circular) - deprecated, avoid using
 */
type AvatarShape = 'lg' | 'md' | 'sm' | 'full';

const shapeClasses: Record<AvatarShape, string> = {
  lg: 'rounded-lg',
  md: 'rounded-md',
  sm: 'rounded-sm',
  full: 'rounded-full', // Deprecated - prefer lg/md/sm
};

interface AvatarProps extends React.ComponentPropsWithoutRef<
  typeof AvatarPrimitive.Root
> {
  /**
   * Shape of the avatar border radius
   * @default 'lg'
   */
  shape?: AvatarShape;
}

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(({ className, shape = 'lg', ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      'relative flex h-10 w-10 shrink-0 overflow-hidden',
      shapeClasses[shape],
      className
    )}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

interface AvatarFallbackProps extends React.ComponentPropsWithoutRef<
  typeof AvatarPrimitive.Fallback
> {
  /**
   * Shape of the fallback border radius (should match parent Avatar shape)
   * @default 'lg'
   */
  shape?: AvatarShape;
}

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn('aspect-square h-full w-full', className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  AvatarFallbackProps
>(({ className, shape = 'lg', ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      'flex h-full w-full items-center justify-center bg-muted',
      shapeClasses[shape],
      className
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };
export type { AvatarShape, AvatarProps, AvatarFallbackProps };
