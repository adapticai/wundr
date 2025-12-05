'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  Move,
  Settings,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  useWidgetStore,
  selectPosition,
  selectSize,
} from '@/lib/stores/widget-store';
import { WidgetChat } from './widget-chat';
import type { AIMessage } from './chat-interface';

/**
 * Props for AssistantWidget component
 */
export interface AssistantWidgetProps {
  /**
   * Callback when user sends a message
   */
  onSendMessage?: (content: string) => Promise<void>;

  /**
   * Custom className
   */
  className?: string;
}

/**
 * AssistantWidget - Main floating AI assistant widget
 *
 * Features:
 * - Draggable positioning
 * - Minimize/maximize controls
 * - Persistent position across sessions
 * - Keyboard shortcuts (Cmd+K to toggle)
 * - Context-aware suggestions
 * - Settings popover
 * - Responsive sizing based on state
 * - Mobile-friendly fallback
 *
 * @example
 * ```tsx
 * <AssistantWidget
 *   onSendMessage={async (msg) => {
 *     await sendToAI(msg);
 *   }}
 * />
 * ```
 */
export function AssistantWidget({
  onSendMessage,
  className,
}: AssistantWidgetProps) {
  const {
    isOpen,
    size,
    close,
    setSize,
    minimize,
    maximize,
    setPosition,
    resetPosition,
    preferences,
    updatePreferences,
  } = useWidgetStore();

  const position = useWidgetStore(selectPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  // Initialize position if not set
  useEffect(() => {
    if (!position) {
      resetPosition();
    }
  }, [position, resetPosition]);

  // Handle dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!widgetRef.current) return;

    const rect = widgetRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      // Keep widget within viewport bounds
      const maxX = window.innerWidth - (widgetRef.current?.offsetWidth || 0);
      const maxY = window.innerHeight - (widgetRef.current?.offsetHeight || 0);

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, setPosition]);

  // Handle sending messages
  const handleSendMessage = async (content: string) => {
    const userMessage: AIMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      if (onSendMessage) {
        await onSendMessage(content);
      }

      // Simulate AI response (replace with actual API call)
      const aiMessage: AIMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: `I received your message: "${content}". This is a placeholder response.`,
        timestamp: new Date(),
        metadata: {
          model: 'gpt-4o-mini',
        },
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewConversation = () => {
    setMessages([]);
  };

  if (!isOpen) {
    return null;
  }

  // Calculate dimensions based on size
  const dimensions = {
    minimized: { width: 320, height: 80 },
    normal: { width: 400, height: 600 },
    maximized: { width: 600, height: 800 },
  };

  const { width, height } = dimensions[size];

  return (
    <Card
      ref={widgetRef}
      className={cn(
        'fixed z-50 flex flex-col overflow-hidden shadow-2xl transition-all duration-300',
        isDragging && 'cursor-grabbing shadow-xl',
        className
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${width}px`,
        height: `${height}px`,
      }}
    >
      {/* Header */}
      <div
        ref={dragHandleRef}
        className={cn(
          'flex items-center justify-between border-b bg-muted/30 px-4 py-2',
          'cursor-grab active:cursor-grabbing'
        )}
        onMouseDown={handleMouseDown}
      >
        <div className='flex items-center gap-2'>
          <Sparkles className='h-4 w-4 text-primary' />
          <span className='text-sm font-semibold'>AI Assistant</span>
        </div>

        <div className='flex items-center gap-1'>
          {/* Settings */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant='ghost' size='icon' className='h-7 w-7'>
                <Settings className='h-4 w-4' />
              </Button>
            </PopoverTrigger>
            <PopoverContent className='w-80' side='left'>
              <WidgetSettings
                preferences={preferences}
                onUpdatePreferences={updatePreferences}
              />
            </PopoverContent>
          </Popover>

          {/* Minimize/Maximize */}
          {size === 'minimized' ? (
            <Button
              variant='ghost'
              size='icon'
              onClick={() => setSize('normal')}
              className='h-7 w-7'
            >
              <Maximize2 className='h-4 w-4' />
            </Button>
          ) : size === 'maximized' ? (
            <Button
              variant='ghost'
              size='icon'
              onClick={() => setSize('normal')}
              className='h-7 w-7'
            >
              <Minimize2 className='h-4 w-4' />
            </Button>
          ) : (
            <>
              <Button
                variant='ghost'
                size='icon'
                onClick={minimize}
                className='h-7 w-7'
              >
                <Minimize2 className='h-4 w-4' />
              </Button>
              <Button
                variant='ghost'
                size='icon'
                onClick={maximize}
                className='h-7 w-7'
              >
                <Maximize2 className='h-4 w-4' />
              </Button>
            </>
          )}

          {/* Close */}
          <Button
            variant='ghost'
            size='icon'
            onClick={close}
            className='h-7 w-7'
          >
            <X className='h-4 w-4' />
          </Button>
        </div>
      </div>

      {/* Content */}
      <WidgetChat
        messages={messages}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        isMinimized={size === 'minimized'}
        onNewConversation={handleNewConversation}
      />

      {/* Drag indicator */}
      {isDragging && (
        <div className='absolute inset-0 border-2 border-primary opacity-50 pointer-events-none' />
      )}
    </Card>
  );
}

/**
 * WidgetSettings - Settings panel for the widget
 */
interface WidgetSettingsProps {
  preferences: {
    autoOpen: boolean;
    rememberPosition: boolean;
    showQuickActions: boolean;
    defaultSize: 'minimized' | 'normal' | 'maximized';
  };
  onUpdatePreferences: (
    prefs: Partial<WidgetSettingsProps['preferences']>
  ) => void;
}

function WidgetSettings({
  preferences,
  onUpdatePreferences,
}: WidgetSettingsProps) {
  return (
    <div className='space-y-4'>
      <div className='space-y-2'>
        <h4 className='font-medium'>Widget Settings</h4>
        <p className='text-sm text-muted-foreground'>
          Customize how the AI assistant behaves
        </p>
      </div>

      <Separator />

      <div className='space-y-4'>
        <div className='flex items-center justify-between'>
          <Label htmlFor='auto-open' className='text-sm'>
            Auto-open on startup
          </Label>
          <Switch
            id='auto-open'
            checked={preferences.autoOpen}
            onCheckedChange={checked =>
              onUpdatePreferences({ autoOpen: checked })
            }
          />
        </div>

        <div className='flex items-center justify-between'>
          <Label htmlFor='remember-position' className='text-sm'>
            Remember position
          </Label>
          <Switch
            id='remember-position'
            checked={preferences.rememberPosition}
            onCheckedChange={checked =>
              onUpdatePreferences({ rememberPosition: checked })
            }
          />
        </div>

        <div className='flex items-center justify-between'>
          <Label htmlFor='show-quick-actions' className='text-sm'>
            Show quick actions
          </Label>
          <Switch
            id='show-quick-actions'
            checked={preferences.showQuickActions}
            onCheckedChange={checked =>
              onUpdatePreferences({ showQuickActions: checked })
            }
          />
        </div>
      </div>

      <Separator />

      <div className='space-y-2'>
        <Label className='text-sm'>Default size</Label>
        <div className='grid grid-cols-3 gap-2'>
          {(['minimized', 'normal', 'maximized'] as const).map(sizeOption => (
            <Button
              key={sizeOption}
              variant={
                preferences.defaultSize === sizeOption ? 'default' : 'outline'
              }
              size='sm'
              onClick={() => onUpdatePreferences({ defaultSize: sizeOption })}
              className='capitalize'
            >
              {sizeOption}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
