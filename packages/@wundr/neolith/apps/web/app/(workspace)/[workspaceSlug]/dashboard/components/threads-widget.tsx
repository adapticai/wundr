'use client';

import { MessageSquare, Hash, User } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface Thread {
  id: string;
  channelId?: string;
  channelName?: string;
  isDm: boolean;
  otherUserName?: string;
  preview: string;
  timestamp: string;
  isUnread: boolean;
}

interface ThreadsWidgetProps {
  workspaceSlug: string;
  limit?: number;
}

export function ThreadsWidget({
  workspaceSlug,
  limit = 5,
}: ThreadsWidgetProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchThreads = async () => {
      try {
        setIsLoading(true);
        // TODO: Replace with actual API endpoint
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/threads?limit=${limit}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch threads');
        }

        const data = await response.json();
        setThreads(data.threads || []);
        setUnreadCount(data.unreadCount || 0);
      } catch (err) {
        console.error('Error fetching threads:', err);
        // Treat fetch errors as empty state — endpoint may not be implemented yet
        setThreads([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchThreads();
  }, [workspaceSlug, limit]);

  if (isLoading) {
    return <ThreadsWidgetSkeleton />;
  }

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-3'>
        <CardTitle className='text-lg flex items-center gap-2'>
          Threads & Mentions
          {unreadCount > 0 && (
            <Badge variant='default' className='ml-2'>
              {unreadCount}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {threads.length === 0 ? (
          <EmptyThreadsState />
        ) : (
          <div className='space-y-3'>
            {threads.map(thread => (
              <ThreadItem
                key={thread.id}
                thread={thread}
                workspaceSlug={workspaceSlug}
              />
            ))}
          </div>
        )}
      </CardContent>
      {threads.length > 0 && (
        <CardFooter>
          <Link
            href={`/${workspaceSlug}/later`}
            className='text-sm text-muted-foreground hover:text-foreground transition-colors'
          >
            View all threads →
          </Link>
        </CardFooter>
      )}
    </Card>
  );
}

interface ThreadItemProps {
  thread: Thread;
  workspaceSlug: string;
}

function ThreadItem({ thread, workspaceSlug }: ThreadItemProps) {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) {
      return 'Just now';
    }
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    return date.toLocaleDateString();
  };

  const href = thread.isDm
    ? `/${workspaceSlug}/dm/${thread.channelId}`
    : `/${workspaceSlug}/channels/${thread.channelId}`;

  return (
    <Link
      href={href}
      className='flex items-start gap-3 p-2 rounded-lg hover:bg-accent transition-colors group'
    >
      <div className='mt-1 flex-shrink-0'>
        {thread.isDm ? (
          <User className='h-4 w-4 text-muted-foreground' />
        ) : (
          <Hash className='h-4 w-4 text-muted-foreground' />
        )}
      </div>
      <div className='flex-1 min-w-0'>
        <div className='flex items-center gap-2 mb-1'>
          <span className='text-sm font-medium truncate'>
            {thread.isDm ? thread.otherUserName : `#${thread.channelName}`}
          </span>
          {thread.isUnread && (
            <div className='h-2 w-2 rounded-full bg-primary flex-shrink-0' />
          )}
        </div>
        <p className='text-xs text-muted-foreground line-clamp-2'>
          {thread.preview}
        </p>
      </div>
      <span className='text-xs text-muted-foreground whitespace-nowrap'>
        {formatTime(thread.timestamp)}
      </span>
    </Link>
  );
}

function EmptyThreadsState() {
  return (
    <div className='flex flex-col items-center justify-center py-8 text-center'>
      <div className='rounded-full bg-muted p-3 mb-3'>
        <MessageSquare className='h-6 w-6 text-muted-foreground' />
      </div>
      <p className='text-sm font-medium text-muted-foreground'>
        No threads yet
      </p>
      <p className='text-xs text-muted-foreground mt-1'>
        Threads and mentions will appear here
      </p>
    </div>
  );
}

function ThreadsWidgetSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className='h-6 w-40' />
      </CardHeader>
      <CardContent>
        <div className='space-y-3'>
          {[1, 2, 3].map(i => (
            <div key={i} className='flex items-start gap-3'>
              <Skeleton className='h-4 w-4 mt-1' />
              <div className='flex-1 space-y-2'>
                <Skeleton className='h-4 w-32' />
                <Skeleton className='h-3 w-full' />
              </div>
              <Skeleton className='h-3 w-12' />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
