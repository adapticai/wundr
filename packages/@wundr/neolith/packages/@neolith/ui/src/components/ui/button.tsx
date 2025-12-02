import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '../../lib/utils';

/**
 * Button variant styles using class-variance-authority.
 *
 * Provides a consistent set of button styles across the application
 * with support for multiple variants and sizes.
 */
const buttonVariants = cva(
  // Base styles applied to all buttons
  [
    'inline-flex items-center justify-center gap-2',
    'whitespace-nowrap rounded-md text-sm font-medium',
    'ring-offset-background transition-colors',
    'focus-visible:outline-none focus-visible:ring-2',
    'focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  ],
  {
    variants: {
      /**
       * Visual style variant of the button.
       *
       * - `primary`: Main action button with solid background
       * - `secondary`: Alternative action with muted styling
       * - `ghost`: Transparent background, visible on hover
       * - `destructive`: Warning/danger actions (red theme)
       * - `outline`: Border-only style
       * - `link`: Text-only with underline on hover
       */
      variant: {
        primary: [
          'bg-primary text-primary-foreground',
          'hover:bg-primary/90',
          'shadow-sm',
        ],
        secondary: [
          'bg-secondary text-secondary-foreground',
          'hover:bg-secondary/80',
          'shadow-sm',
        ],
        ghost: ['hover:bg-accent hover:text-accent-foreground'],
        destructive: [
          'bg-destructive text-destructive-foreground',
          'hover:bg-destructive/90',
          'shadow-sm',
        ],
        outline: [
          'border border-input bg-background',
          'hover:bg-accent hover:text-accent-foreground',
          'shadow-sm',
        ],
        link: ['text-primary underline-offset-4', 'hover:underline'],
      },
      /**
       * Size variant controlling padding and font size.
       *
       * - `sm`: Compact size for tight spaces
       * - `md`: Default size for standard use
       * - `lg`: Larger size for prominent actions
       * - `icon`: Square button for icon-only content
       */
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 py-2',
        lg: 'h-12 px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

/**
 * Props for the Button component.
 *
 * Extends standard HTML button attributes with variant and size options.
 */
export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * When true, renders as a child component (useful for Radix UI Slot).
   * @default false
   */
  asChild?: boolean;
}

/**
 * A versatile button component with multiple variants and sizes.
 *
 * Built with accessibility in mind, supporting keyboard navigation,
 * focus states, and disabled states out of the box.
 *
 * @example
 * ```tsx
 * // Primary button (default)
 * <Button>Click me</Button>
 *
 * // Secondary button with small size
 * <Button variant="secondary" size="sm">
 *   Secondary Action
 * </Button>
 *
 * // Destructive button for dangerous actions
 * <Button variant="destructive">
 *   Delete Item
 * </Button>
 *
 * // Ghost button for subtle actions
 * <Button variant="ghost" size="icon">
 *   <IconComponent />
 * </Button>
 *
 * // Disabled state
 * <Button disabled>Cannot Click</Button>
 * ```
 *
 * @param props - Button component props
 * @returns A styled button element
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild: _asChild = false,
      type = 'button',
      ...props
    },
    ref
  ) => {
    // Note: asChild support would require @radix-ui/react-slot
    // For now, we render a standard button element (asChild param reserved for future use)
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        type={type}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
