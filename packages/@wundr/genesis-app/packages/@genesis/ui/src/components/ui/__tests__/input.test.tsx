/**
 * Input Component Tests
 *
 * Comprehensive test suite for the Input component covering:
 * - Rendering with different variants
 * - Size variations
 * - User interactions
 * - Accessibility
 * - Error states
 * - Edge cases
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { Input, inputVariants } from '../input';

describe('Input', () => {
  describe('Rendering', () => {
    it('should render with default props', () => {
      render(<Input data-testid="input" />);

      const input = screen.getByTestId('input');
      expect(input).toBeInTheDocument();
      expect(input.tagName).toBe('INPUT');
    });

    it('should render with placeholder', () => {
      render(<Input placeholder="Enter text..." />);

      const input = screen.getByPlaceholderText('Enter text...');
      expect(input).toBeInTheDocument();
    });

    it('should render with custom className', () => {
      render(<Input className="custom-class" data-testid="input" />);

      const input = screen.getByTestId('input');
      expect(input).toHaveClass('custom-class');
    });

    it('should forward ref correctly', () => {
      const ref = vi.fn();
      render(<Input ref={ref} />);

      expect(ref).toHaveBeenCalled();
      expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLInputElement);
    });

    it('should render with specific type', () => {
      render(<Input type="password" data-testid="input" />);

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('type', 'password');
    });

    it('should render email type input', () => {
      render(<Input type="email" data-testid="input" />);

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('type', 'email');
    });
  });

  describe('Variants', () => {
    it('should render default variant by default', () => {
      render(<Input data-testid="input" />);

      const input = screen.getByTestId('input');
      expect(input).toHaveClass('border-input');
    });

    it('should render error variant when error prop is provided', () => {
      render(<Input error="This field is required" data-testid="input" />);

      const input = screen.getByTestId('input');
      expect(input).toHaveClass('border-destructive');
    });

    it('should render explicit error variant', () => {
      render(<Input variant="error" data-testid="input" />);

      const input = screen.getByTestId('input');
      expect(input).toHaveClass('border-destructive');
    });

    it('should prioritize error prop over variant prop', () => {
      render(<Input variant="default" error="Error" data-testid="input" />);

      const input = screen.getByTestId('input');
      expect(input).toHaveClass('border-destructive');
    });
  });

  describe('Sizes', () => {
    it('should render medium size by default', () => {
      render(<Input data-testid="input" />);

      const input = screen.getByTestId('input');
      expect(input).toHaveClass('h-10');
    });

    it('should render small size', () => {
      render(<Input size="sm" data-testid="input" />);

      const input = screen.getByTestId('input');
      expect(input).toHaveClass('h-8');
      expect(input).toHaveClass('text-xs');
    });

    it('should render large size', () => {
      render(<Input size="lg" data-testid="input" />);

      const input = screen.getByTestId('input');
      expect(input).toHaveClass('h-12');
      expect(input).toHaveClass('text-base');
    });
  });

  describe('Interactions', () => {
    it('should call onChange when value changes', () => {
      const handleChange = vi.fn();
      render(<Input onChange={handleChange} data-testid="input" />);

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: 'test' } });

      expect(handleChange).toHaveBeenCalledTimes(1);
    });

    it('should call onFocus when focused', () => {
      const handleFocus = vi.fn();
      render(<Input onFocus={handleFocus} data-testid="input" />);

      const input = screen.getByTestId('input');
      fireEvent.focus(input);

      expect(handleFocus).toHaveBeenCalledTimes(1);
    });

    it('should call onBlur when blurred', () => {
      const handleBlur = vi.fn();
      render(<Input onBlur={handleBlur} data-testid="input" />);

      const input = screen.getByTestId('input');
      fireEvent.focus(input);
      fireEvent.blur(input);

      expect(handleBlur).toHaveBeenCalledTimes(1);
    });

    it('should handle controlled value', () => {
      const { rerender } = render(<Input value="initial" onChange={() => {}} data-testid="input" />);

      const input = screen.getByTestId('input') as HTMLInputElement;
      expect(input.value).toBe('initial');

      rerender(<Input value="updated" onChange={() => {}} data-testid="input" />);
      expect(input.value).toBe('updated');
    });

    it('should not allow input when disabled', () => {
      render(<Input disabled data-testid="input" />);

      const input = screen.getByTestId('input');
      expect(input).toBeDisabled();
    });

    it('should respect readOnly attribute', () => {
      render(<Input readOnly value="readonly" data-testid="input" />);

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('readonly');
    });
  });

  describe('Accessibility', () => {
    it('should be focusable', () => {
      render(<Input data-testid="input" />);

      const input = screen.getByTestId('input');
      input.focus();

      expect(input).toHaveFocus();
    });

    it('should have disabled state reflected', () => {
      render(<Input disabled data-testid="input" />);

      const input = screen.getByTestId('input');
      expect(input).toBeDisabled();
      expect(input).toHaveClass('disabled:cursor-not-allowed');
    });

    it('should set aria-invalid when error is provided', () => {
      render(<Input error="Error message" data-testid="input" />);

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('should not set aria-invalid when no error', () => {
      render(<Input data-testid="input" />);

      const input = screen.getByTestId('input');
      expect(input).not.toHaveAttribute('aria-invalid');
    });

    it('should accept aria attributes', () => {
      render(
        <Input
          aria-label="Email address"
          aria-describedby="email-help"
          data-testid="input"
        />
      );

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('aria-label', 'Email address');
      expect(input).toHaveAttribute('aria-describedby', 'email-help');
    });

    it('should have proper display name for debugging', () => {
      expect(Input.displayName).toBe('Input');
    });

    it('should be associated with label via id', () => {
      render(
        <>
          <label htmlFor="test-input">Test Label</label>
          <Input id="test-input" />
        </>
      );

      const input = screen.getByLabelText('Test Label');
      expect(input).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty value', () => {
      render(<Input value="" onChange={() => {}} data-testid="input" />);

      const input = screen.getByTestId('input') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('should handle special characters in value', () => {
      render(
        <Input
          value="<script>alert('xss')</script>"
          onChange={() => {}}
          data-testid="input"
        />
      );

      const input = screen.getByTestId('input') as HTMLInputElement;
      expect(input.value).toBe("<script>alert('xss')</script>");
    });

    it('should spread additional props', () => {
      render(
        <Input
          data-testid="custom-input"
          data-custom="value"
          autoComplete="off"
        />
      );

      const input = screen.getByTestId('custom-input');
      expect(input).toHaveAttribute('data-custom', 'value');
      expect(input).toHaveAttribute('autocomplete', 'off');
    });

    it('should handle maxLength attribute', () => {
      render(<Input maxLength={10} data-testid="input" />);

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('maxLength', '10');
    });

    it('should handle pattern attribute', () => {
      render(<Input pattern="[A-Za-z]+" data-testid="input" />);

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('pattern', '[A-Za-z]+');
    });

    it('should handle required attribute', () => {
      render(<Input required data-testid="input" />);

      const input = screen.getByTestId('input');
      expect(input).toBeRequired();
    });
  });
});

describe('inputVariants', () => {
  it('should generate correct class string', () => {
    const classes = inputVariants({ variant: 'default', size: 'md' });

    expect(classes).toContain('border-input');
    expect(classes).toContain('h-10');
  });

  it('should use default values when no options provided', () => {
    const classes = inputVariants();

    expect(classes).toContain('border-input');
    expect(classes).toContain('h-10');
  });

  it('should merge custom className', () => {
    const classes = inputVariants({
      variant: 'error',
      className: 'custom-class',
    });

    expect(classes).toContain('border-destructive');
    expect(classes).toContain('custom-class');
  });

  it('should generate error variant classes', () => {
    const classes = inputVariants({ variant: 'error' });

    expect(classes).toContain('border-destructive');
    expect(classes).toContain('focus-visible:ring-destructive');
  });

  it('should generate small size classes', () => {
    const classes = inputVariants({ size: 'sm' });

    expect(classes).toContain('h-8');
    expect(classes).toContain('text-xs');
  });

  it('should generate large size classes', () => {
    const classes = inputVariants({ size: 'lg' });

    expect(classes).toContain('h-12');
    expect(classes).toContain('text-base');
  });
});
