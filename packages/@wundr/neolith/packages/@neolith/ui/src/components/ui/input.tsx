import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '../../lib/utils';

/**
 * Input variant styles using class-variance-authority.
 *
 * Provides a consistent set of input styles across the application
 * with support for multiple variants and sizes.
 */
const inputVariants = cva(
  // Base styles applied to all inputs
  [
    'flex w-full rounded-md border bg-background px-3 py-2 text-sm',
    'ring-offset-background file:border-0 file:bg-transparent',
    'file:text-sm file:font-medium placeholder:text-muted-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    'focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  ],
  {
    variants: {
      /**
       * Visual style variant of the input.
       *
       * - `default`: Standard input with subtle border
       * - `error`: Error state with destructive styling
       */
      variant: {
        default: 'border-input',
        error: 'border-destructive focus-visible:ring-destructive',
      },
      /**
       * Size variant controlling height and font size.
       *
       * - `sm`: Compact size for tight spaces
       * - `md`: Default size for standard use
       * - `lg`: Larger size for prominent inputs
       */
      size: {
        sm: 'h-8 text-xs',
        md: 'h-10',
        lg: 'h-12 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

/**
 * Props for the Input component.
 *
 * Extends standard HTML input attributes with variant and size options.
 */
export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  /**
   * Error message to display. When provided, applies error styling.
   */
  error?: string;
}

/**
 * A versatile input component with multiple variants and sizes.
 *
 * Built with accessibility in mind, supporting keyboard navigation,
 * focus states, and disabled states out of the box.
 *
 * @example
 * ```tsx
 * // Default input
 * <Input placeholder="Enter text..." />
 *
 * // Small input
 * <Input size="sm" placeholder="Small input" />
 *
 * // Input with error state
 * <Input error="This field is required" />
 *
 * // Disabled input
 * <Input disabled placeholder="Cannot edit" />
 *
 * // Password input
 * <Input type="password" placeholder="Enter password" />
 * ```
 *
 * @param props - Input component props
 * @returns A styled input element
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, size, error, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          inputVariants({ variant: error ? 'error' : variant, size, className })
        )}
        ref={ref}
        aria-invalid={error ? 'true' : undefined}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export { Input, inputVariants };
