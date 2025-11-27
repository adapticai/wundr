/**
 * Chat Input Component
 * Text input with send button for the conversational wizard
 * @module components/wizard/chat-input
 */
'use client';

import * as React from 'react';
import { Send, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export interface ChatInputProps {
  /** Callback when user sends a message */
  onSend: (message: string) => void;
  /** Whether input is disabled (e.g., during loading) */
  disabled?: boolean;
  /** Callback when user cancels */
  onCancel: () => void;
  /** Optional callback to review details (shows button if provided) */
  onReviewDetails?: () => void;
  /** Placeholder text */
  placeholder?: string;
}

/**
 * ChatInput - Input field with send button for chat interface
 *
 * Features:
 * - Auto-expanding textarea
 * - Send button
 * - Keyboard shortcuts (Enter to send, Shift+Enter for new line)
 * - Cancel button
 * - Optional "Review Details" button
 * - Disabled state during loading
 */
export function ChatInput({
  onSend,
  disabled = false,
  onCancel,
  onReviewDetails,
  placeholder = 'Type your message... (Enter to send, Shift+Enter for new line)',
}: ChatInputProps) {
  const [input, setInput] = React.useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Focus textarea on mount
  React.useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  /**
   * Handle form submission
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || disabled) {
      return;
    }

    onSend(input.trim());
    setInput('');

    // Refocus textarea after sending
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to send (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="border-t px-6 py-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Input area */}
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="min-h-[60px] resize-none"
            disabled={disabled}
            aria-label="Message input"
          />
          <Button
            type="submit"
            size="icon"
            className="h-[60px] w-[60px] shrink-0"
            disabled={!input.trim() || disabled}
          >
            <Send className="h-5 w-5" />
            <span className="sr-only">Send message</span>
          </Button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {onReviewDetails && (
              <Button
                type="button"
                variant="default"
                onClick={onReviewDetails}
                disabled={disabled}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Review Details
              </Button>
            )}
          </div>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={disabled}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
