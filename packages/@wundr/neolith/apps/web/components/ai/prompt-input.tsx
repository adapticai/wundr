'use client';

import { Send, Loader2 } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * Main PromptInput component with auto-resizing textarea
 * Supports Enter to submit and Shift+Enter for new lines
 */
interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  disabled?: boolean;
  className?: string;
}

export function PromptInput({
  value,
  onChange,
  onSubmit,
  isLoading = false,
  placeholder = 'Type your message...',
  minHeight = 48,
  maxHeight = 200,
  disabled = false,
  className,
}: PromptInputProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading && !disabled) {
      e.preventDefault();
      onSubmit();
    }
  };

  // Auto-resize textarea based on content
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(
        Math.max(textarea.scrollHeight, minHeight),
        maxHeight,
      );
      textarea.style.height = `${newHeight}px`;
    }
  }, [value, minHeight, maxHeight]);

  return (
    <PromptInputForm
      onSubmit={e => {
        e.preventDefault();
        if (!isLoading && !disabled && value.trim()) {
          onSubmit();
        }
      }}
      className={className}
    >
      <PromptInputTextarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isLoading}
        style={{ minHeight, maxHeight }}
        aria-label='Prompt input'
      />
      <PromptInputToolbar>
        <PromptInputTools>
          {/* Add custom tools here via children */}
        </PromptInputTools>
        <PromptInputSubmit disabled={!value.trim() || isLoading || disabled}>
          {isLoading ? (
            <Loader2 className='h-4 w-4 animate-spin' aria-hidden='true' />
          ) : (
            <Send className='h-4 w-4' aria-hidden='true' />
          )}
          <span className='sr-only'>
            {isLoading ? 'Sending...' : 'Send message'}
          </span>
        </PromptInputSubmit>
      </PromptInputToolbar>
    </PromptInputForm>
  );
}

/**
 * Subcomponent: Form wrapper with proper styling
 */
export function PromptInputForm({
  children,
  className,
  ...props
}: React.FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form
      className={cn(
        'flex flex-col gap-2 border rounded-lg p-2 bg-background',
        className,
      )}
      {...props}
    >
      {children}
    </form>
  );
}

/**
 * Subcomponent: Auto-resizing textarea with minimal styling
 */
export const PromptInputTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<typeof Textarea>
>(({ className, ...props }, ref) => {
  return (
    <Textarea
      ref={ref}
      className={cn(
        'resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent',
        'overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent',
        className,
      )}
      {...props}
    />
  );
});
PromptInputTextarea.displayName = 'PromptInputTextarea';

/**
 * Subcomponent: Toolbar container
 */
export function PromptInputToolbar({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-between pt-2 border-t',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Subcomponent: Tools container (left side of toolbar)
 */
export function PromptInputTools({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center gap-1', className)} {...props}>
      {children}
    </div>
  );
}

/**
 * Subcomponent: Submit button
 */
export function PromptInputSubmit({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button type='submit' size='sm' className={cn('', className)} {...props}>
      {children}
    </Button>
  );
}

/**
 * Subcomponent: Model selector dropdown
 */
interface PromptInputModelSelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  models?: { value: string; label: string }[];
  className?: string;
}

export function PromptInputModelSelect({
  value,
  onValueChange,
  models = [
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet' },
    { value: 'gpt-4o', label: 'GPT-4o' },
  ],
  className,
}: PromptInputModelSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className={cn('w-[140px] h-8 text-xs', className)}
        aria-label='Select AI model'
      >
        <SelectValue placeholder='Select model' />
      </SelectTrigger>
      <SelectContent>
        {models.map(model => (
          <SelectItem key={model.value} value={model.value}>
            {model.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
