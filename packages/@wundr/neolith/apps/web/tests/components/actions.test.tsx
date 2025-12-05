import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  Actions,
  ActionCopy,
  ActionRegenerate,
  ActionFeedback,
} from '@/components/ai/actions';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(),
  },
});

describe('Actions Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ActionCopy', () => {
    it('should copy content to clipboard', async () => {
      const content = 'Test content to copy';
      const onCopy = vi.fn();

      render(<ActionCopy content={content} onCopy={onCopy} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(content);
        expect(onCopy).toHaveBeenCalled();
      });
    });

    it('should show copied state after copy', async () => {
      const content = 'Test content';

      render(<ActionCopy content={content} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('button')).toHaveAttribute(
          'aria-label',
          'Copied!'
        );
      });
    });

    it('should reset copied state after 2 seconds', async () => {
      vi.useFakeTimers();
      const content = 'Test content';

      render(<ActionCopy content={content} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('button')).toHaveAttribute(
          'aria-label',
          'Copied!'
        );
      });

      vi.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(screen.getByRole('button')).toHaveAttribute(
          'aria-label',
          'Copy'
        );
      });

      vi.useRealTimers();
    });
  });

  describe('ActionRegenerate', () => {
    it('should call onRegenerate when clicked', () => {
      const onRegenerate = vi.fn();

      render(<ActionRegenerate onRegenerate={onRegenerate} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(onRegenerate).toHaveBeenCalled();
    });
  });

  describe('ActionFeedback', () => {
    it('should call onFeedback with positive type', () => {
      const onFeedback = vi.fn();

      render(<ActionFeedback onFeedback={onFeedback} />);

      const buttons = screen.getAllByRole('button');
      const positiveButton = buttons[0]; // First button is thumbs up

      fireEvent.click(positiveButton);

      expect(onFeedback).toHaveBeenCalledWith('positive');
    });

    it('should call onFeedback with negative type', () => {
      const onFeedback = vi.fn();

      render(<ActionFeedback onFeedback={onFeedback} />);

      const buttons = screen.getAllByRole('button');
      const negativeButton = buttons[1]; // Second button is thumbs down

      fireEvent.click(negativeButton);

      expect(onFeedback).toHaveBeenCalledWith('negative');
    });

    it('should highlight selected feedback', () => {
      const onFeedback = vi.fn();

      render(<ActionFeedback onFeedback={onFeedback} />);

      const buttons = screen.getAllByRole('button');
      const positiveButton = buttons[0];

      fireEvent.click(positiveButton);

      expect(positiveButton.className).toContain('text-green-500');
    });
  });

  describe('Actions Container', () => {
    it('should render all action buttons when enabled', () => {
      const content = 'Test content';
      const onCopy = vi.fn();
      const onRegenerate = vi.fn();
      const onFeedback = vi.fn();

      render(
        <Actions
          content={content}
          onCopy={onCopy}
          onRegenerate={onRegenerate}
          onFeedback={onFeedback}
        />
      );

      const buttons = screen.getAllByRole('button');
      // Should have: copy, regenerate, thumbs up, thumbs down
      expect(buttons.length).toBeGreaterThanOrEqual(4);
    });

    it('should not render copy button when showCopy is false', () => {
      const content = 'Test content';

      render(<Actions content={content} showCopy={false} />);

      // Copy button should not be rendered
      expect(screen.queryByRole('button')).toBeNull();
    });

    it('should not render regenerate button when showRegenerate is false', () => {
      const onRegenerate = vi.fn();

      render(<Actions onRegenerate={onRegenerate} showRegenerate={false} />);

      expect(screen.queryByRole('button')).toBeNull();
    });

    it('should not render feedback buttons when showFeedback is false', () => {
      const onFeedback = vi.fn();

      render(<Actions onFeedback={onFeedback} showFeedback={false} />);

      expect(screen.queryByRole('button')).toBeNull();
    });
  });
});
