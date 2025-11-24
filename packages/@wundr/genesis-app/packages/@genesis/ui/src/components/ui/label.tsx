import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '../../lib/utils';

/**
 * Label variant styles using class-variance-authority.
 *
 * Provides consistent label styling across the application
 * with support for different states.
 */
const labelVariants = cva(
  [
    'text-sm font-medium leading-none',
    'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
  ],
  {
    variants: {
      /**
       * Visual style variant of the label.
       *
       * - `default`: Standard label styling
       * - `error`: Error state with destructive color
       */
      variant: {
        default: 'text-foreground',
        error: 'text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

/**
 * Props for the Label component.
 *
 * Extends standard HTML label attributes with variant options.
 */
export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement>,
    VariantProps<typeof labelVariants> {
  /**
   * When true, applies error styling to the label.
   */
  error?: boolean;
}

/**
 * A label component for form inputs.
 *
 * Designed to work seamlessly with form inputs, providing
 * proper accessibility associations and visual feedback.
 *
 * @example
 * ```tsx
 * // Basic label
 * <Label htmlFor="email">Email</Label>
 *
 * // Label with error state
 * <Label htmlFor="password" error>Password is required</Label>
 *
 * // Label with custom className
 * <Label htmlFor="name" className="mb-2">Full Name</Label>
 * ```
 *
 * @param props - Label component props
 * @returns A styled label element
 */
const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, variant, error, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(labelVariants({ variant: error ? 'error' : variant, className }))}
        {...props}
      />
    );
  }
);

Label.displayName = 'Label';

export { Label, labelVariants };
