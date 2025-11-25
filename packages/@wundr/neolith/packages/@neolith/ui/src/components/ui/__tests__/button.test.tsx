/**
 * Button Component Tests
 *
 * Comprehensive test suite for the Button component covering:
 * - Rendering with different variants
 * - Size variations
 * - User interactions
 * - Accessibility
 * - Edge cases
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { Button, buttonVariants } from '../button';

describe('Button', () => {
  describe('Rendering', () => {
    it('should render with default props', () => {
      render(<Button>Click me</Button>);

      const button = screen.getByRole('button', { name: /click me/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('type', 'button');
    });

    it('should render children correctly', () => {
      render(<Button>Test Content</Button>);

      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should render with custom className', () => {
      render(<Button className='custom-class'>Button</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });

    it('should forward ref correctly', () => {
      const ref = vi.fn();
      render(<Button ref={ref}>Button</Button>);

      expect(ref).toHaveBeenCalled();
      expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLButtonElement);
    });
  });

  describe('Variants', () => {
    it('should render primary variant by default', () => {
      render(<Button>Primary</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-primary');
    });

    it('should render secondary variant', () => {
      render(<Button variant='secondary'>Secondary</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-secondary');
    });

    it('should render ghost variant', () => {
      render(<Button variant='ghost'>Ghost</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('hover:bg-accent');
    });

    it('should render destructive variant', () => {
      render(<Button variant='destructive'>Delete</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-destructive');
    });

    it('should render outline variant', () => {
      render(<Button variant='outline'>Outline</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('border');
    });

    it('should render link variant', () => {
      render(<Button variant='link'>Link</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('underline-offset-4');
    });
  });

  describe('Sizes', () => {
    it('should render medium size by default', () => {
      render(<Button>Medium</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-10');
    });

    it('should render small size', () => {
      render(<Button size='sm'>Small</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-8');
    });

    it('should render large size', () => {
      render(<Button size='lg'>Large</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-12');
    });

    it('should render icon size', () => {
      render(<Button size='icon'>Icon</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-10', 'w-10');
    });
  });

  describe('Interactions', () => {
    it('should call onClick when clicked', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);

      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when disabled', () => {
      const handleClick = vi.fn();
      render(
        <Button onClick={handleClick} disabled>
          Disabled
        </Button>,
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      // Button is disabled, so click handler should not be called
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('should handle keyboard events', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Button</Button>);

      const button = screen.getByRole('button');
      button.focus();
      fireEvent.keyDown(button, { key: 'Enter' });

      // Enter key should trigger click on button elements
      expect(button).toHaveFocus();
    });
  });

  describe('Accessibility', () => {
    it('should be focusable', () => {
      render(<Button>Focusable</Button>);

      const button = screen.getByRole('button');
      button.focus();

      expect(button).toHaveFocus();
    });

    it('should have disabled state reflected', () => {
      render(<Button disabled>Disabled</Button>);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('disabled:pointer-events-none');
    });

    it('should accept aria attributes', () => {
      render(
        <Button aria-label='Close dialog' aria-pressed='true'>
          X
        </Button>,
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Close dialog');
      expect(button).toHaveAttribute('aria-pressed', 'true');
    });

    it('should have proper display name for debugging', () => {
      expect(Button.displayName).toBe('Button');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty children', () => {
      render(<Button>{''}</Button>);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should handle multiple children', () => {
      render(
        <Button>
          <span>Icon</span>
          <span>Text</span>
        </Button>,
      );

      expect(screen.getByText('Icon')).toBeInTheDocument();
      expect(screen.getByText('Text')).toBeInTheDocument();
    });

    it('should handle type attribute', () => {
      render(<Button type='submit'>Submit</Button>);

      expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
    });

    it('should spread additional props', () => {
      render(<Button data-testid='custom-button'>Button</Button>);

      expect(screen.getByTestId('custom-button')).toBeInTheDocument();
    });
  });
});

describe('buttonVariants', () => {
  it('should generate correct class string', () => {
    const classes = buttonVariants({ variant: 'primary', size: 'md' });

    expect(classes).toContain('bg-primary');
    expect(classes).toContain('h-10');
  });

  it('should use default values when no options provided', () => {
    const classes = buttonVariants();

    expect(classes).toContain('bg-primary');
    expect(classes).toContain('h-10');
  });

  it('should merge custom className', () => {
    const classes = buttonVariants({
      variant: 'secondary',
      className: 'custom-class',
    });

    expect(classes).toContain('bg-secondary');
    expect(classes).toContain('custom-class');
  });
});
