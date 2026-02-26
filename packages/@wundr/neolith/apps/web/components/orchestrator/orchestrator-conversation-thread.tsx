'use client';

import { Bot, MessageSquare, Send, RefreshCw, Filter, Clock } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface ConversationMessage {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  recipientId?: string;
  recipientName?: string;
  channelId?: string;
  channelName?: string;
  type: 'message' | 'system' | 'escalation' | 'delegation' | 'tool_result';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  timestamp: string;
  metadata?: Record<string, unknown>;
  parentMessageId?: string;
  threadCount?: number;
}

export interface OrchestratorConversationThreadProps {
  orchestratorId: string;
  channelId?: string;
  readOnly?: boolean;
  maxHeight?: string;
  className?: string;
  onMessageSent?: (message: ConversationMessage) => void;
}

type FilterType = 'all' | 'messages' | 'escalations' | 'delegations';

const FILTER_TABS: { label: string; value: FilterType }[] = [
  { label: 'All', value: 'all' },
  { label: 'Messages', value: 'messages' },
  { label: 'Escalations', value: 'escalations' },
  { label: 'Delegations', value: 'delegations' },
];

const PRIORITY_BADGE_CLASSES: Record<string, string> = {
  urgent: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400',
  high: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/20 dark:text-orange-400',
};

const TYPE_BORDER_CLASSES: Record<ConversationMessage['type'], string> = {
  escalation: 'border-l-4 border-l-red-500',
  delegation: 'border-l-4 border-l-blue-500',
  message: '',
  system: '',
  tool_result: 'border-l-4 border-l-purple-500',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function filterMessages(
  messages: ConversationMessage[],
  filter: FilterType
): ConversationMessage[] {
  if (filter === 'all') return messages;
  if (filter === 'messages') return messages.filter(m => m.type === 'message');
  if (filter === 'escalations') return messages.filter(m => m.type === 'escalation');
  if (filter === 'delegations') return messages.filter(m => m.type === 'delegation');
  return messages;
}

function MessageSkeleton() {
  return (
    <div className='flex items-start gap-3 p-3'>
      <Skeleton className='h-8 w-8 rounded-md shrink-0' />
      <div className='flex-1 space-y-2'>
        <div className='flex items-center gap-2'>
          <Skeleton className='h-4 w-24' />
          <Skeleton className='h-4 w-16' />
        </div>
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-4 w-3/4' />
      </div>
    </div>
  );
}

function SystemMessage({ message }: { message: ConversationMessage }) {
  return (
    <div className='flex justify-center py-2'>
      <div className='flex items-center gap-2 rounded-full bg-muted/60 px-3 py-1 text-xs text-muted-foreground'>
        <Clock className='h-3 w-3' />
        <span>{message.content}</span>
        <span className='text-muted-foreground/60'>{formatTimestamp(message.timestamp)}</span>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  if (message.type === 'system') {
    return <SystemMessage message={message} />;
  }

  const typeBorderClass = TYPE_BORDER_CLASSES[message.type] ?? '';
  const showPriorityBadge =
    message.priority === 'urgent' || message.priority === 'high';

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/30',
        typeBorderClass
      )}
    >
      <Avatar shape='md' className='h-8 w-8 shrink-0'>
        <AvatarFallback className='bg-muted text-xs font-medium'>
          {message.senderId === 'system' ? (
            <Bot className='h-4 w-4 text-muted-foreground' />
          ) : (
            getInitials(message.senderName)
          )}
        </AvatarFallback>
      </Avatar>

      <div className='flex-1 min-w-0 space-y-1'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-sm font-medium leading-none'>{message.senderName}</span>

          {message.senderRole && (
            <Badge variant='secondary' className='h-4 px-1.5 text-xs'>
              {message.senderRole}
            </Badge>
          )}

          {showPriorityBadge && (
            <Badge
              variant='outline'
              className={cn('h-4 px-1.5 text-xs', PRIORITY_BADGE_CLASSES[message.priority!])}
            >
              {message.priority}
            </Badge>
          )}

          {message.type !== 'message' && (
            <Badge variant='outline' className='h-4 px-1.5 text-xs capitalize'>
              {message.type.replace('_', ' ')}
            </Badge>
          )}

          <span className='text-xs text-muted-foreground ml-auto'>
            {formatTimestamp(message.timestamp)}
          </span>
        </div>

        <p className='text-sm text-foreground leading-relaxed break-words'>
          {message.content}
        </p>

        {(message.recipientName || message.channelName) && (
          <div className='flex flex-wrap items-center gap-2 pt-0.5'>
            {message.recipientName && (
              <span className='text-xs text-muted-foreground'>
                To: <span className='font-medium'>{message.recipientName}</span>
              </span>
            )}
            {message.channelName && (
              <span className='text-xs text-muted-foreground'>
                In: <span className='font-medium'>#{message.channelName}</span>
              </span>
            )}
            {message.threadCount != null && message.threadCount > 0 && (
              <span className='flex items-center gap-1 text-xs text-muted-foreground'>
                <MessageSquare className='h-3 w-3' />
                {message.threadCount} {message.threadCount === 1 ? 'reply' : 'replies'}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function OrchestratorConversationThread({
  orchestratorId,
  channelId,
  readOnly = false,
  maxHeight = '600px',
  className,
  onMessageSent,
}: OrchestratorConversationThreadProps) {
  const { toast } = useToast();

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [newMessage, setNewMessage] = useState('');

  const bottomRef = useRef<HTMLDivElement>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (channelId) params.set('channelId', channelId);

      const response = await fetch(
        `/api/orchestrators/${orchestratorId}/conversations?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch conversations');
      }

      const json = await response.json();
      const data: ConversationMessage[] = Array.isArray(json)
        ? json
        : (json.data ?? json.messages ?? []);

      setMessages(data);
    } catch (err) {
      toast({
        title: 'Failed to load conversations',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [orchestratorId, channelId, toast]);

  useEffect(() => {
    setLoading(true);
    fetchMessages();
  }, [fetchMessages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    refreshIntervalRef.current = setInterval(() => {
      fetchMessages();
    }, 30_000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [fetchMessages]);

  const handleSend = useCallback(async () => {
    const content = newMessage.trim();
    if (!content || sending) return;

    setSending(true);
    try {
      const body: Record<string, unknown> = { content };
      if (channelId) body.channelId = channelId;

      const response = await fetch(
        `/api/orchestrators/${orchestratorId}/conversations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const json = await response.json();
      const sent: ConversationMessage = json.data ?? json;

      setNewMessage('');
      setMessages(prev => [...prev, sent]);
      onMessageSent?.(sent);
    } catch (err) {
      toast({
        title: 'Failed to send message',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  }, [newMessage, sending, orchestratorId, channelId, onMessageSent, toast]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleManualRefresh = useCallback(() => {
    setLoading(true);
    fetchMessages();
  }, [fetchMessages]);

  const filteredMessages = filterMessages(messages, filter);

  return (
    <Card className={cn('flex flex-col overflow-hidden', className)}>
      <CardHeader className='shrink-0 pb-0 pt-4 px-4'>
        <div className='flex items-center justify-between gap-2'>
          <div className='flex items-center gap-2'>
            <Bot className='h-4 w-4 text-muted-foreground' />
            <span className='text-sm font-medium'>Conversation Thread</span>
          </div>
          <Button
            variant='ghost'
            size='sm'
            className='h-7 w-7 p-0'
            onClick={handleManualRefresh}
            disabled={loading}
            aria-label='Refresh conversations'
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </Button>
        </div>

        {/* Filter tabs */}
        <div className='flex items-center gap-1 pt-3 pb-0'>
          <Filter className='h-3.5 w-3.5 shrink-0 text-muted-foreground mr-1' />
          {FILTER_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                filter === tab.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className='flex flex-col flex-1 p-0 min-h-0'>
        {/* Messages scroll area */}
        <ScrollArea style={{ height: maxHeight }} className='w-full'>
          <div className='flex flex-col gap-2 p-4'>
            {loading ? (
              <>
                <MessageSkeleton />
                <MessageSkeleton />
                <MessageSkeleton />
              </>
            ) : filteredMessages.length === 0 ? (
              <div className='flex flex-col items-center justify-center py-12 text-center'>
                <div className='rounded-full bg-muted p-4 mb-3'>
                  <MessageSquare className='h-6 w-6 text-muted-foreground' />
                </div>
                <p className='text-sm font-medium text-muted-foreground'>
                  No conversations yet
                </p>
                <p className='text-xs text-muted-foreground mt-1'>
                  {filter === 'all'
                    ? 'Messages between orchestrators will appear here.'
                    : `No ${filter} to display.`}
                </p>
              </div>
            ) : (
              filteredMessages.map(message => (
                <MessageBubble key={message.id} message={message} />
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Input bar */}
        {!readOnly && (
          <div className='shrink-0 border-t bg-background px-4 py-3'>
            <div className='flex items-center gap-2'>
              <Input
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder='Send a message to this orchestrator...'
                className='flex-1 h-9 text-sm'
                disabled={sending}
                aria-label='Message input'
              />
              <Button
                size='sm'
                className='h-9 w-9 shrink-0 p-0'
                onClick={handleSend}
                disabled={!newMessage.trim() || sending}
                aria-label='Send message'
              >
                <Send className='h-4 w-4' />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default OrchestratorConversationThread;
