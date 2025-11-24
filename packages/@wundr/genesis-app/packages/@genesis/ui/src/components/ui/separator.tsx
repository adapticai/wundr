import * as React from 'react';

import { cn } from '../../lib/utils';

/**
 * Props for the Separator component.
 */
export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The orientation of the separator.
   * @default "horizontal"
   */
  orientation?: 'horizontal' | 'vertical';
  /**
   * Whether the separator is purely decorative.
   * When true, the separator will be hidden from screen readers.
   * @default true
   */
  decorative?: boolean;
}

/**
 * A separator component for visually or semantically separating content.
 *
 * Supports both horizontal and vertical orientations with proper
 * accessibility attributes.
 *
 * @example
 * ```tsx
 * // Horizontal separator (default)
 * <Separator />
 *
 * // Vertical separator
 * <Separator orientation="vertical" />
 *
 * // Separator with custom styling
 * <Separator className="my-4 bg-primary" />
 *
 * // Non-decorative separator (visible to screen readers)
 * <Separator decorative={false} />
 * ```
 *
 * @param props - Separator component props
 * @returns A styled separator element
 */
const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className, orientation = 'horizontal', decorative = true, ...props }, ref) => (
    <div
      ref={ref}
      role={decorative ? 'none' : 'separator'}
      aria-orientation={decorative ? undefined : orientation}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
        className,
      )}
      {...props}
    />
  ),
);
Separator.displayName = 'Separator';

export { Separator };
