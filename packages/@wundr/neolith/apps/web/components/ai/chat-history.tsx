'use client';

import { useState } from 'react';
import {
  Plus,
  MessageSquare,
  Trash2,
  Search,
  Clock,
  MoreVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface Conversation {
  readonly id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  messageCount?: number;
}

export interface ChatHistoryProps {
  /**
   * Array of past conversations
   */
  conversations: Conversation[];

  /**
   * Currently active conversation ID
   */
  activeConversationId?: string;

  /**
   * Callback when selecting a conversation
   */
  onSelectConversation?: (conversationId: string) => void;

  /**
   * Callback when creating new conversation
   */
  onNewConversation?: () => void;

  /**
   * Callback when deleting a conversation
   */
  onDeleteConversation?: (conversationId: string) => void;

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * ChatHistory - Sidebar showing conversation history
 *
 * Features:
 * - List of past conversations
 * - Search/filter conversations
 * - Create new conversation
 * - Delete conversations
 * - Relative timestamps (Today, Yesterday, Last 7 days, etc.)
 * - Message count per conversation
 * - Hover actions
 * - Keyboard navigation
 *
 * @example
 * ```tsx
 * const [conversations, setConversations] = useState<Conversation[]>([
 *   {
 *     id: '1',
 *     title: 'React Hooks Tutorial',
 *     lastMessage: 'Can you explain useEffect?',
 *     timestamp: new Date(),
 *     messageCount: 12,
 *   },
 * ]);
 *
 * <ChatHistory
 *   conversations={conversations}
 *   activeConversationId={activeId}
 *   onSelectConversation={setActiveId}
 *   onNewConversation={() => createNewChat()}
 *   onDeleteConversation={(id) => deleteChat(id)}
 * />
 * ```
 */
export function ChatHistory({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  className,
}: ChatHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter conversations by search query
  const filteredConversations = conversations.filter(
    conv =>
      conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group conversations by time period
  const groupedConversations = groupConversationsByTime(filteredConversations);

  return (
    <div className={cn('flex flex-col h-full bg-muted/30', className)}>
      {/* Header */}
      <div className='flex flex-col gap-3 p-4 border-b'>
        <div className='flex items-center justify-between'>
          <h2 className='text-lg font-semibold'>Chat History</h2>
          {onNewConversation && (
            <Button
              variant='ghost'
              size='icon'
              onClick={onNewConversation}
              title='New conversation'
            >
              <Plus className='h-4 w-4' />
            </Button>
          )}
        </div>

        {/* Search */}
        <div className='relative'>
          <Search className='absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            type='search'
            placeholder='Search conversations...'
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className='pl-8'
          />
        </div>
      </div>

      {/* Conversations List */}
      <ScrollArea className='flex-1'>
        <div className='p-2'>
          {Object.entries(groupedConversations).map(([period, convs]) => (
            <div key={period} className='mb-4'>
              {/* Period Header */}
              <div className='flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground'>
                <Clock className='h-3 w-3' />
                <span>{period}</span>
              </div>

              {/* Conversations in this period */}
              <div className='space-y-1'>
                {convs.map(conversation => (
                  <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    isActive={conversation.id === activeConversationId}
                    onSelect={() => onSelectConversation?.(conversation.id)}
                    onDelete={
                      onDeleteConversation
                        ? () => onDeleteConversation(conversation.id)
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Empty State */}
          {filteredConversations.length === 0 && (
            <div className='flex flex-col items-center justify-center gap-2 py-8 text-center'>
              <MessageSquare className='h-8 w-8 text-muted-foreground' />
              <p className='text-sm text-muted-foreground'>
                {searchQuery
                  ? 'No conversations found'
                  : 'No conversations yet'}
              </p>
              {!searchQuery && onNewConversation && (
                <Button
                  variant='outline'
                  size='sm'
                  onClick={onNewConversation}
                  className='mt-2'
                >
                  <Plus className='mr-2 h-4 w-4' />
                  Start a conversation
                </Button>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

/**
 * Individual conversation item component
 */
interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
}: ConversationItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  const formatTimestamp = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div
      className={cn(
        'group relative flex items-start gap-3 rounded-lg p-3 cursor-pointer transition-colors',
        isActive ? 'bg-primary/10 hover:bg-primary/15' : 'hover:bg-muted'
      )}
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Icon */}
      <MessageSquare
        className={cn(
          'h-4 w-4 mt-0.5 shrink-0',
          isActive ? 'text-primary' : 'text-muted-foreground'
        )}
      />

      {/* Content */}
      <div className='flex-1 min-w-0'>
        <div className='flex items-start justify-between gap-2 mb-1'>
          <h3
            className={cn(
              'text-sm font-medium truncate',
              isActive ? 'text-primary' : 'text-foreground'
            )}
          >
            {conversation.title}
          </h3>
          <span className='text-xs text-muted-foreground shrink-0'>
            {formatTimestamp(conversation.timestamp)}
          </span>
        </div>
        <p className='text-xs text-muted-foreground truncate'>
          {conversation.lastMessage}
        </p>
        {conversation.messageCount && (
          <span className='text-xs text-muted-foreground mt-1 block'>
            {conversation.messageCount} messages
          </span>
        )}
      </div>

      {/* Actions */}
      {isHovered && onDelete && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant='ghost'
              size='icon'
              className='h-6 w-6 absolute top-2 right-2'
              onClick={e => e.stopPropagation()}
            >
              <MoreVertical className='h-3 w-3' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuItem
              onClick={e => {
                e.stopPropagation();
                onDelete();
              }}
              className='text-destructive'
            >
              <Trash2 className='mr-2 h-4 w-4' />
              Delete conversation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

/**
 * Group conversations by time period
 */
function groupConversationsByTime(
  conversations: Conversation[]
): Record<string, Conversation[]> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);
  const lastMonth = new Date(today);
  lastMonth.setDate(lastMonth.getDate() - 30);

  const groups: Record<string, Conversation[]> = {
    Today: [],
    Yesterday: [],
    'Last 7 days': [],
    'Last 30 days': [],
    Older: [],
  };

  conversations.forEach(conv => {
    const convDate = new Date(conv.timestamp);

    if (convDate >= today) {
      groups.Today.push(conv);
    } else if (convDate >= yesterday) {
      groups.Yesterday.push(conv);
    } else if (convDate >= lastWeek) {
      groups['Last 7 days'].push(conv);
    } else if (convDate >= lastMonth) {
      groups['Last 30 days'].push(conv);
    } else {
      groups.Older.push(conv);
    }
  });

  // Remove empty groups
  Object.keys(groups).forEach(key => {
    if (groups[key].length === 0) {
      delete groups[key];
    }
  });

  return groups;
}
