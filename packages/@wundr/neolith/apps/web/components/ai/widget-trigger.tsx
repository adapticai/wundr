'use client';

import { Bot, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useWidgetStore } from '@/lib/stores/widget-store';

/**
 * Props for WidgetTrigger component
 */
export interface WidgetTriggerProps {
  /**
   * Custom className
   */
  className?: string;

  /**
   * Show badge with unread count
   */
  unreadCount?: number;

  /**
   * Show pulse animation
   */
  showPulse?: boolean;
}

/**
 * WidgetTrigger - Floating button to open AI assistant
 *
 * Features:
 * - Fixed position (bottom-right by default)
 * - Animated icon
 * - Unread badge
 * - Keyboard shortcut (Cmd+K)
 * - Tooltip
 * - Pulse animation for attention
 *
 * @example
 * ```tsx
 * <WidgetTrigger unreadCount={3} />
 * ```
 */
export function WidgetTrigger({
  className,
  unreadCount = 0,
  showPulse = false,
}: WidgetTriggerProps) {
  const { isOpen, toggle } = useWidgetStore();
  const [isMounted, setIsMounted] = useState(false);

  // Handle keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    setIsMounted(true);

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K on Mac, Ctrl+K on Windows/Linux
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  if (!isMounted) {
    return null;
  }

  // Don't show trigger when widget is open
  if (isOpen) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size='lg'
            onClick={toggle}
            className={cn(
              'fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg transition-all hover:scale-110',
              'bg-primary text-primary-foreground hover:bg-primary/90',
              showPulse && 'animate-pulse',
              className
            )}
            aria-label='Open AI Assistant'
          >
            {/* Animated icons */}
            <div className='relative'>
              <Bot
                className={cn(
                  'h-6 w-6 transition-all duration-300',
                  showPulse ? 'opacity-0 scale-0' : 'opacity-100 scale-100'
                )}
              />
              <Sparkles
                className={cn(
                  'absolute inset-0 h-6 w-6 transition-all duration-300',
                  showPulse ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
                )}
              />
            </div>

            {/* Unread badge */}
            {unreadCount > 0 && (
              <span
                className={cn(
                  'absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center',
                  'rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground'
                )}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}

            {/* Pulse ring animation */}
            {showPulse && (
              <span className='absolute inset-0 -z-10 animate-ping rounded-full bg-primary opacity-75' />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side='left' className='flex items-center gap-2'>
          <span>AI Assistant</span>
          <kbd className='pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100'>
            <span className='text-xs'>⌘</span>K
          </kbd>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
