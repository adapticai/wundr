'use client';

import {
  MessageSquarePlus,
  Pin,
  Search,
  Trash2,
  MoreVertical,
  Calendar,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface Conversation {
  id: string;
  title: string;
  preview: string;
  timestamp: Date;
  isPinned: boolean;
  model: string;
  messageCount: number;
}

interface ConversationSidebarProps {
  conversations: Conversation[];
  currentConversationId?: string;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onPinConversation: (id: string) => void;
  className?: string;
}

export function ConversationSidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onPinConversation,
  className,
}: ConversationSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter and sort conversations
  const filteredConversations = useMemo(() => {
    const filtered = conversations.filter(
      conv =>
        conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.preview.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Sort: pinned first, then by timestamp
    return filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
  }, [conversations, searchQuery]);

  // Group conversations by date
  const groupedConversations = useMemo(() => {
    const groups: Record<string, Conversation[]> = {
      Today: [],
      Yesterday: [],
      'This Week': [],
      'This Month': [],
      Older: [],
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    filteredConversations.forEach(conv => {
      const convDate = new Date(conv.timestamp);
      const convDay = new Date(
        convDate.getFullYear(),
        convDate.getMonth(),
        convDate.getDate()
      );

      if (convDay.getTime() === today.getTime()) {
        groups.Today.push(conv);
      } else if (convDay.getTime() === yesterday.getTime()) {
        groups.Yesterday.push(conv);
      } else if (convDay >= weekAgo) {
        groups['This Week'].push(conv);
      } else if (convDay >= monthAgo) {
        groups['This Month'].push(conv);
      } else {
        groups.Older.push(conv);
      }
    });

    return groups;
  }, [filteredConversations]);

  return (
    <div className={cn('flex flex-col h-full bg-muted/30 border-r', className)}>
      {/* Header */}
      <div className='p-4 border-b space-y-3'>
        <div className='flex items-center justify-between'>
          <h2 className='font-semibold text-lg'>Conversations</h2>
          <Button
            onClick={onNewConversation}
            size='icon'
            variant='ghost'
            className='h-8 w-8'
            title='New conversation'
          >
            <MessageSquarePlus className='h-4 w-4' />
          </Button>
        </div>

        {/* Search */}
        <div className='relative'>
          <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
          <Input
            placeholder='Search conversations...'
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className='pl-9 h-9'
          />
        </div>
      </div>

      {/* Conversations List */}
      <ScrollArea className='flex-1'>
        <div className='p-2'>
          {Object.entries(groupedConversations).map(([group, convs]) => {
            if (convs.length === 0) return null;

            return (
              <div key={group} className='mb-4'>
                <div className='flex items-center gap-2 px-3 py-1.5 mb-1'>
                  <Calendar className='h-3.5 w-3.5 text-muted-foreground' />
                  <h3 className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
                    {group}
                  </h3>
                </div>
                <div className='space-y-1'>
                  {convs.map(conv => (
                    <ConversationItem
                      key={conv.id}
                      conversation={conv}
                      isActive={conv.id === currentConversationId}
                      onSelect={() => onSelectConversation(conv.id)}
                      onDelete={() => onDeleteConversation(conv.id)}
                      onPin={() => onPinConversation(conv.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {filteredConversations.length === 0 && (
            <div className='flex flex-col items-center justify-center py-12 px-4 text-center'>
              <MessageSquarePlus className='h-12 w-12 text-muted-foreground/50 mb-3' />
              <p className='text-sm text-muted-foreground mb-1'>
                {searchQuery
                  ? 'No conversations found'
                  : 'No conversations yet'}
              </p>
              <p className='text-xs text-muted-foreground/70'>
                {searchQuery
                  ? 'Try a different search term'
                  : 'Start a new conversation to get started'}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onPin: () => void;
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
  onPin,
}: ConversationItemProps) {
  return (
    <div
      className={cn(
        'group flex items-start gap-2 p-2.5 rounded-lg cursor-pointer transition-colors',
        'hover:bg-accent/50',
        isActive && 'bg-accent'
      )}
      onClick={onSelect}
    >
      <div className='flex-1 min-w-0 space-y-1'>
        <div className='flex items-center gap-2'>
          {conversation.isPinned && (
            <Pin className='h-3 w-3 text-muted-foreground flex-shrink-0' />
          )}
          <h4 className='text-sm font-medium truncate'>{conversation.title}</h4>
        </div>
        <p className='text-xs text-muted-foreground line-clamp-2'>
          {conversation.preview}
        </p>
        <div className='flex items-center gap-2 text-xs text-muted-foreground'>
          <span>
            {formatDistanceToNow(conversation.timestamp, { addSuffix: true })}
          </span>
          <span>•</span>
          <span>{conversation.messageCount} messages</span>
          <span>•</span>
          <span className='truncate'>{conversation.model}</span>
        </div>
      </div>

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            size='icon'
            className='h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity'
            onClick={e => e.stopPropagation()}
          >
            <MoreVertical className='h-3.5 w-3.5' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuItem
            onClick={e => {
              e.stopPropagation();
              onPin();
            }}
          >
            <Pin className='mr-2 h-4 w-4' />
            {conversation.isPinned ? 'Unpin' : 'Pin'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={e => {
              e.stopPropagation();
              onDelete();
            }}
            className='text-destructive focus:text-destructive'
          >
            <Trash2 className='mr-2 h-4 w-4' />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
