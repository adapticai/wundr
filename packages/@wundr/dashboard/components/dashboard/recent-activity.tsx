'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { realtimeStore, WebSocketMessage } from '@/lib/websocket';
import { RealtimeData } from '@/types';
import {
  AlertCircle,
  GitBranch,
  GitCommit,
  GitMerge,
  Package,
} from 'lucide-react';
import * as React from 'react';

interface ActivityItem {
  id: string;
  type: 'commit' | 'merge' | 'branch' | 'package' | 'error';
  user: string;
  action: string;
  timestamp: Date;
  description?: string;
}

function getActivityIcon(type: ActivityItem['type']) {
  switch (type) {
    case 'commit':
      return GitCommit;
    case 'merge':
      return GitMerge;
    case 'branch':
      return GitBranch;
    case 'package':
      return Package;
    case 'error':
      return AlertCircle;
    default:
      return GitCommit;
  }
}

function getActivityColor(type: ActivityItem['type']) {
  switch (type) {
    case 'commit':
      return 'text-blue-500';
    case 'merge':
      return 'text-green-500';
    case 'branch':
      return 'text-purple-500';
    case 'package':
      return 'text-orange-500';
    case 'error':
      return 'text-red-500';
    default:
      return 'text-gray-500';
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase();
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffInMinutes = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60)
  );

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}

function mapEventsToActivities(events: RealtimeData['events']): ActivityItem[] {
  return events.slice(0, 8).map(event => ({
    id: event.id,
    type:
      event.type === 'build'
        ? ('commit' as const)
        : event.type === 'analysis'
          ? ('package' as const)
          : event.type === 'error'
            ? ('error' as const)
            : ('commit' as const),
    user: event.metadata?.author || 'System',
    action:
      event.type === 'build'
        ? 'triggered build'
        : event.type === 'analysis'
          ? 'ran analysis'
          : event.type === 'error'
            ? 'reported error'
            : 'performed action',
    timestamp: event.timestamp,
    description: event.message,
  }));
}

export function RecentActivity() {
  const [activities, setActivities] = React.useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Subscribe to all state changes first — the store immediately calls the
    // callback with the current state snapshot (type: 'state_sync'), which
    // lets us mark loading as done even when no events are present yet.
    const unsubscribeState = realtimeStore.subscribe(() => {
      setIsLoading(false);
    });

    // Subscribe to incoming messages for live event updates.
    const unsubscribeMessages = realtimeStore.subscribeToMessages(
      (message: WebSocketMessage) => {
        try {
          const msgData = message.data ?? message.payload;

          if (message.type === 'realtime-data') {
            const events = (msgData as Record<string, unknown>).events as
              | RealtimeData['events']
              | undefined;
            setActivities(mapEventsToActivities(events ?? []));
            setIsLoading(false);
            setError(null);
          } else if (message.type === 'events-update') {
            const events = Array.isArray(msgData)
              ? (msgData as RealtimeData['events'])
              : [];
            setActivities(mapEventsToActivities(events));
            setIsLoading(false);
            setError(null);
          }
        } catch (err) {
          console.error(
            'Error processing WebSocket message in RecentActivity:',
            err
          );
          setError('Failed to load recent activity.');
          setIsLoading(false);
        }
      }
    );

    return () => {
      unsubscribeState();
      unsubscribeMessages();
    };
  }, []);

  if (isLoading) {
    return (
      <ScrollArea className='h-[400px]'>
        <div className='space-y-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className='flex items-center space-x-3 animate-pulse'>
              <div className='h-8 w-8 rounded-lg bg-muted' />
              <div className='flex-1 space-y-2'>
                <div className='h-3 w-3/4 rounded bg-muted' />
                <div className='h-3 w-1/2 rounded bg-muted' />
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    );
  }

  if (error) {
    return (
      <ScrollArea className='h-[400px]'>
        <div className='flex flex-col items-center justify-center h-32 space-y-2'>
          <AlertCircle className='h-6 w-6 text-destructive' />
          <p className='text-sm text-destructive'>{error}</p>
        </div>
      </ScrollArea>
    );
  }

  if (activities.length === 0) {
    return (
      <ScrollArea className='h-[400px]'>
        <div className='flex flex-col items-center justify-center h-32 space-y-2'>
          <GitCommit className='h-6 w-6 text-muted-foreground' />
          <p className='text-sm text-muted-foreground'>No recent activity</p>
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className='h-[400px]'>
      <div className='space-y-4'>
        {activities.map(activity => {
          const Icon = getActivityIcon(activity.type);
          return (
            <div key={activity.id} className='flex items-center space-x-3'>
              <Avatar className='h-8 w-8 rounded-lg'>
                <AvatarImage
                  src={`/avatars/${activity.user.toLowerCase().replace(' ', '')}.jpg`}
                />
                <AvatarFallback className='text-xs'>
                  {getInitials(activity.user)}
                </AvatarFallback>
              </Avatar>
              <div className='flex-1 min-w-0'>
                <p className='text-sm font-medium leading-none mb-1'>
                  <span className='font-semibold'>{activity.user}</span>{' '}
                  <span className='text-muted-foreground'>
                    {activity.action}
                  </span>
                </p>
                {activity.description && (
                  <p className='text-sm text-muted-foreground truncate'>
                    {activity.description}
                  </p>
                )}
                <p className='text-xs text-muted-foreground mt-1'>
                  {formatTimeAgo(activity.timestamp)}
                </p>
              </div>
              <div className='flex items-center space-x-2'>
                <Icon
                  className={`h-4 w-4 ${getActivityColor(activity.type)}`}
                />
                <Badge variant='outline' className='text-xs capitalize'>
                  {activity.type}
                </Badge>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
