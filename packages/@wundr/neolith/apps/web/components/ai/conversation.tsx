'use client';

import { ArrowDown } from 'lucide-react';
import * as React from 'react';
import ScrollToBottom, {
  useScrollToBottom,
  useSticky,
} from 'react-scroll-to-bottom';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ConversationProps {
  /**
   * Child elements to render in the conversation
   */
  children?: React.ReactNode;

  /**
   * Additional CSS classes for the container
   */
  className?: string;

  /**
   * Scroll behavior when the component initially mounts
   * - 'smooth': Smoothly scrolls to bottom
   * - 'auto': Discrete scrolling (instant)
   */
  initial?: 'smooth' | 'auto';

  /**
   * Show scroll to bottom button when user scrolls up
   */
  showScrollButton?: boolean;

  /**
   * Recurring interval of stickiness check, in milliseconds (minimum is 17 ms)
   */
  checkInterval?: number;

  /**
   * Set the debounce for tracking the onScroll event
   */
  debounce?: number;

  /**
   * @deprecated Use `initial` instead. Will be mapped to 'auto' behavior.
   */
  autoscroll?: boolean;

  /**
   * @deprecated Not supported by underlying library. Use 'auto' for instant scrolling.
   */
  resize?: 'smooth' | 'instant' | 'auto';

  /**
   * @deprecated Threshold is managed by the underlying react-scroll-to-bottom library.
   */
  scrollThreshold?: number;
}

/**
 * Main conversation container component
 *
 * Features:
 * - Auto-scrolls to bottom when new messages arrive
 * - Shows scroll-to-bottom button when user scrolls up
 * - Maintains scroll position while user reads history
 * - Supports smooth scrolling animations
 * - Handles resize without scroll jumps
 *
 * @example
 * ```tsx
 * <Conversation initial="smooth" resize="smooth">
 *   <Message>Hello</Message>
 *   <Message>World</Message>
 * </Conversation>
 * ```
 */
export function Conversation({
  children,
  className,
  initial = 'smooth',
  showScrollButton = true,
  checkInterval,
  debounce,
  autoscroll = true,
}: ConversationProps) {
  // Handle deprecated autoscroll prop
  // If autoscroll is false, use 'auto' (discrete) behavior
  // Otherwise use the specified initial behavior
  const initialScrollBehavior: 'smooth' | 'auto' = autoscroll
    ? (initial ?? 'smooth')
    : 'auto';

  return (
    <ScrollToBottom
      className={cn('relative flex-1 overflow-hidden', className)}
      mode='bottom'
      initialScrollBehavior={initialScrollBehavior}
      scrollViewClassName='h-full'
      followButtonClassName='hidden' // We use our custom button
      checkInterval={checkInterval}
      debounce={debounce}
    >
      <ConversationContent>{children}</ConversationContent>
      {showScrollButton && <ScrollToBottomButton />}
    </ScrollToBottom>
  );
}

/**
 * Content container with proper spacing and layout
 */
function ConversationContent({ children }: { children: React.ReactNode }) {
  return (
    <div
      className='flex flex-col gap-4 p-4 min-h-full'
      role='log'
      aria-live='polite'
      aria-atomic='false'
    >
      {children}
    </div>
  );
}

/**
 * Scroll to bottom button
 * Only shows when user has scrolled up from the bottom
 * The threshold for determining "at bottom" is managed by react-scroll-to-bottom
 */
function ScrollToBottomButton() {
  const scrollToBottom = useScrollToBottom();
  const [sticky] = useSticky();

  // Show button when not at bottom (sticky is false)
  const showButton = !sticky;

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // End key scrolls to bottom
      if (
        event.key === 'End' &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        event.preventDefault();
        scrollToBottom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scrollToBottom]);

  if (!showButton) {
    return null;
  }

  return (
    <Button
      variant='outline'
      size='icon'
      className='absolute bottom-4 right-4 rounded-full shadow-lg transition-opacity hover:opacity-100 z-10'
      onClick={() => scrollToBottom()}
      aria-label='Scroll to bottom'
      title='Scroll to bottom (End)'
    >
      <ArrowDown className='h-4 w-4' />
    </Button>
  );
}

/**
 * Hook to access scroll functionality from child components
 *
 * @example
 * ```tsx
 * function ChatInput() {
 *   const { scrollToBottom, isAtBottom } = useConversation();
 *
 *   const handleSend = () => {
 *     sendMessage();
 *     scrollToBottom();
 *   };
 * }
 * ```
 */
export function useConversation() {
  const scrollToBottom = useScrollToBottom();
  const [isAtBottom] = useSticky();

  return {
    scrollToBottom,
    isAtBottom,
  };
}

/**
 * Subcomponent exports for composition
 */
Conversation.Content = ConversationContent;
Conversation.ScrollButton = ScrollToBottomButton;
