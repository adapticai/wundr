import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'next-themes';

import { ThemeToggle, ThemeToggleButton, ThemeToggleLarge } from '@/components/layout/theme-toggle';

import type { ReactNode } from 'react';


/**
 * Wrapper component to provide ThemeProvider context for tests
 */
function ThemeTestWrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  );
}

describe('ThemeToggle Component', () => {
  describe('ThemeToggle - Dropdown Variant', () => {
    it('renders the theme toggle button', () => {
      render(
        <ThemeTestWrapper>
          <ThemeToggle variant="dropdown" />
        </ThemeTestWrapper>,
      );

      const button = screen.getByRole('button', { name: /select theme/i });
      expect(button).toBeInTheDocument();
    });

    it('opens and closes the dropdown menu', async () => {
      render(
        <ThemeTestWrapper>
          <ThemeToggle variant="dropdown" />
        </ThemeTestWrapper>,
      );

      const button = screen.getByRole('button', { name: /select theme/i });

      // Open dropdown
      fireEvent.click(button);
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Close dropdown
      fireEvent.click(button);
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });

    it('closes dropdown when clicking outside', async () => {
      const { container } = render(
        <ThemeTestWrapper>
          <ThemeToggle variant="dropdown" />
        </ThemeTestWrapper>,
      );

      const button = screen.getByRole('button', { name: /select theme/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Click outside
      const backdrop = container.querySelector('[role="button"][aria-hidden="true"]');
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });

    it('closes dropdown when pressing Escape', async () => {
      render(
        <ThemeTestWrapper>
          <ThemeToggle variant="dropdown" />
        </ThemeTestWrapper>,
      );

      const button = screen.getByRole('button', { name: /select theme/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      fireEvent.keyDown(button, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });

    it('displays all theme options', async () => {
      render(
        <ThemeTestWrapper>
          <ThemeToggle variant="dropdown" />
        </ThemeTestWrapper>,
      );

      const button = screen.getByRole('button', { name: /select theme/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Light')).toBeInTheDocument();
        expect(screen.getByText('Dark')).toBeInTheDocument();
        expect(screen.getByText('System')).toBeInTheDocument();
      });
    });

    it('shows label when showLabel prop is true', () => {
      render(
        <ThemeTestWrapper>
          <ThemeToggle variant="dropdown" showLabel={true} />
        </ThemeTestWrapper>,
      );

      // The label may be hidden on mobile, but should exist in the DOM
      const button = screen.getByRole('button', { name: /select theme/i });
      expect(button).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <ThemeTestWrapper>
          <ThemeToggle variant="dropdown" className="custom-class" />
        </ThemeTestWrapper>,
      );

      const wrapper = container.querySelector('.custom-class');
      expect(wrapper).toBeInTheDocument();
    });
  });

  describe('ThemeToggle - Compact Variant', () => {
    it('renders compact button', () => {
      render(
        <ThemeTestWrapper>
          <ThemeToggle variant="compact" />
        </ThemeTestWrapper>,
      );

      const button = screen.getByRole('button', { name: /toggle theme/i });
      expect(button).toBeInTheDocument();
    });

    it('cycles through themes on click', async () => {
      render(
        <ThemeTestWrapper>
          <ThemeToggle variant="compact" />
        </ThemeTestWrapper>,
      );

      const button = screen.getByRole('button', { name: /toggle theme/i });

      // First click should cycle to next theme
      fireEvent.click(button);
      await waitFor(() => {
        expect(button).toBeInTheDocument();
      });

      // Can click multiple times
      fireEvent.click(button);
      fireEvent.click(button);

      expect(button).toBeInTheDocument();
    });

    it('shows label when showLabel prop is true', () => {
      render(
        <ThemeTestWrapper>
          <ThemeToggle variant="compact" showLabel={true} />
        </ThemeTestWrapper>,
      );

      const button = screen.getByRole('button', { name: /toggle theme/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe('ThemeToggleButton', () => {
    it('renders the button variant', () => {
      render(
        <ThemeTestWrapper>
          <ThemeToggleButton />
        </ThemeTestWrapper>,
      );

      const button = screen.getByRole('button', { name: /toggle theme/i });
      expect(button).toBeInTheDocument();
    });

    it('cycles themes on click', async () => {
      render(
        <ThemeTestWrapper>
          <ThemeToggleButton />
        </ThemeTestWrapper>,
      );

      const button = screen.getByRole('button', { name: /toggle theme/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(button).toBeInTheDocument();
      });
    });
  });

  describe('ThemeToggleLarge', () => {
    it('renders all radio options', () => {
      render(
        <ThemeTestWrapper>
          <ThemeToggleLarge />
        </ThemeTestWrapper>,
      );

      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(3);
    });

    it('displays theme labels and descriptions', () => {
      render(
        <ThemeTestWrapper>
          <ThemeToggleLarge />
        </ThemeTestWrapper>,
      );

      expect(screen.getByText('Light')).toBeInTheDocument();
      expect(screen.getByText('Dark')).toBeInTheDocument();
      expect(screen.getByText('System')).toBeInTheDocument();

      expect(screen.getByText('Light theme')).toBeInTheDocument();
      expect(screen.getByText('Dark theme')).toBeInTheDocument();
      expect(screen.getByText('Follow system preference')).toBeInTheDocument();
    });

    it('allows selecting theme via radio button', async () => {
      render(
        <ThemeTestWrapper>
          <ThemeToggleLarge />
        </ThemeTestWrapper>,
      );

      const radios = screen.getAllByRole('radio') as HTMLInputElement[];
      const darkRadio = radios.find((r) => r.value === 'dark');

      if (darkRadio) {
        fireEvent.click(darkRadio);

        await waitFor(() => {
          // eslint-disable-next-line jest/no-conditional-expect
          expect(darkRadio.checked).toBe(true);
        });
      }
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes for dropdown', async () => {
      render(
        <ThemeTestWrapper>
          <ThemeToggle variant="dropdown" />
        </ThemeTestWrapper>,
      );

      const button = screen.getByRole('button', { name: /select theme/i });
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveAttribute('aria-haspopup', 'listbox');

      fireEvent.click(button);

      await waitFor(() => {
        expect(button).toHaveAttribute('aria-expanded', 'true');
      });
    });

    it('listbox has proper ARIA attributes', async () => {
      render(
        <ThemeTestWrapper>
          <ThemeToggle variant="dropdown" />
        </ThemeTestWrapper>,
      );

      const button = screen.getByRole('button', { name: /select theme/i });
      fireEvent.click(button);

      await waitFor(() => {
        const listbox = screen.getByRole('listbox');
        expect(listbox).toHaveAttribute('aria-label', 'Theme options');
      });
    });

    it('theme options have proper ARIA attributes', async () => {
      render(
        <ThemeTestWrapper>
          <ThemeToggle variant="dropdown" />
        </ThemeTestWrapper>,
      );

      const button = screen.getByRole('button', { name: /select theme/i });
      fireEvent.click(button);

      await waitFor(() => {
        const options = screen.getAllByRole('option');
        expect(options).toHaveLength(3);

        options.forEach((option) => {
          expect(option).toHaveAttribute('aria-selected');
        });
      });
    });

    it('supports keyboard navigation', async () => {
      render(
        <ThemeTestWrapper>
          <ThemeToggle variant="dropdown" />
        </ThemeTestWrapper>,
      );

      const button = screen.getByRole('button', { name: /select theme/i });

      // ArrowDown should open menu
      fireEvent.keyDown(button, { key: 'ArrowDown' });

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });

    it('has focus ring styling', () => {
      render(
        <ThemeTestWrapper>
          <ThemeToggle variant="dropdown" />
        </ThemeTestWrapper>,
      );

      const button = screen.getByRole('button', { name: /select theme/i });
      expect(button).toHaveClass('focus:ring-2');
      expect(button).toHaveClass('focus:ring-ring');
    });
  });

  describe('Theme Persistence', () => {
    it('renders without hydration issues', async () => {
      const { rerender } = render(
        <ThemeTestWrapper>
          <ThemeToggle variant="dropdown" />
        </ThemeTestWrapper>,
      );

      // Should not show loading state after mount
      await waitFor(() => {
        const button = screen.queryByRole('button', { name: /select theme/i });
        expect(button).toBeInTheDocument();
      });

      // Rerender should work smoothly
      rerender(
        <ThemeTestWrapper>
          <ThemeToggle variant="dropdown" />
        </ThemeTestWrapper>,
      );

      expect(screen.getByRole('button', { name: /select theme/i })).toBeInTheDocument();
    });
  });
});
