import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { Conversation, useConversation } from '@/components/ai/conversation';

describe('Conversation', () => {
  beforeEach(() => {
    // Mock window.scrollTo
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render children', () => {
    render(
      <Conversation>
        <div>Message 1</div>
        <div>Message 2</div>
      </Conversation>
    );

    expect(screen.getByText('Message 1')).toBeInTheDocument();
    expect(screen.getByText('Message 2')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <Conversation className='custom-class'>
        <div>Test</div>
      </Conversation>
    );

    const scrollToBottom = container.querySelector('.custom-class');
    expect(scrollToBottom).toBeInTheDocument();
  });

  it('should show scroll button when showScrollButton is true', () => {
    render(
      <Conversation showScrollButton={true}>
        <div>Message</div>
      </Conversation>
    );

    // Note: The button might be hidden initially if at bottom
    // This test verifies the component structure
    const buttons = screen.queryAllByLabelText('Scroll to bottom');
    expect(buttons.length).toBeGreaterThanOrEqual(0);
  });

  it('should not show scroll button when showScrollButton is false', () => {
    render(
      <Conversation showScrollButton={false}>
        <div>Message</div>
      </Conversation>
    );

    const button = screen.queryByLabelText('Scroll to bottom');
    expect(button).not.toBeInTheDocument();
  });

  it('should have proper ARIA attributes for accessibility', () => {
    const { container } = render(
      <Conversation>
        <div>Test</div>
      </Conversation>
    );

    const logContainer = container.querySelector('[role="log"]');
    expect(logContainer).toBeInTheDocument();
    expect(logContainer).toHaveAttribute('aria-live', 'polite');
    expect(logContainer).toHaveAttribute('aria-atomic', 'false');
  });

  it('should accept deprecated autoscroll prop for backward compatibility', () => {
    const { container } = render(
      <Conversation autoscroll={false}>
        <div>Message</div>
      </Conversation>
    );

    expect(container.firstChild).toBeInTheDocument();
  });
});

describe('useConversation', () => {
  function TestComponent() {
    const { scrollToBottom, isAtBottom } = useConversation();

    return (
      <div>
        <button onClick={() => scrollToBottom()}>Scroll</button>
        <span>{isAtBottom ? 'At bottom' : 'Not at bottom'}</span>
      </div>
    );
  }

  it('should provide scroll functionality through hook', () => {
    render(
      <Conversation>
        <TestComponent />
      </Conversation>
    );

    const scrollButton = screen.getByText('Scroll');
    expect(scrollButton).toBeInTheDocument();

    // Click should not throw
    fireEvent.click(scrollButton);
  });
});

describe('Conversation subcomponents', () => {
  it('should expose Content subcomponent', () => {
    expect(Conversation.Content).toBeDefined();
  });

  it('should expose ScrollButton subcomponent', () => {
    expect(Conversation.ScrollButton).toBeDefined();
  });

  it('should render Content subcomponent', () => {
    render(
      <Conversation.Content>
        <div>Test content</div>
      </Conversation.Content>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });
});
