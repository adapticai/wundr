'use client';

import { Hash, Star } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Channel {
  id: string;
  name: string;
  slug: string;
  isStarred: boolean;
  unreadCount: number;
}

interface ChannelsWidgetProps {
  workspaceSlug: string;
  limit?: number;
}

export function ChannelsWidget({
  workspaceSlug,
  limit = 6,
}: ChannelsWidgetProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        setIsLoading(true);
        // TODO: Replace with actual API endpoint for starred/frequent channels
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/channels?starred=true&limit=${limit}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch channels');
        }

        const data = await response.json();
        setChannels(data.channels || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching channels:', err);
        setError('Failed to load channels');
        setChannels([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChannels();
  }, [workspaceSlug, limit]);

  if (isLoading) {
    return <ChannelsWidgetSkeleton />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-lg'>Starred Channels</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className='rounded-md bg-destructive/10 p-4 text-sm text-destructive'>
            <p className='font-medium'>Error loading channels</p>
            <p className='mt-1 text-xs'>{error}</p>
          </div>
        ) : channels.length === 0 ? (
          <EmptyChannelsState />
        ) : (
          <div className='grid grid-cols-2 gap-2'>
            {channels.map(channel => (
              <ChannelPill
                key={channel.id}
                channel={channel}
                workspaceSlug={workspaceSlug}
              />
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Link
          href={`/${workspaceSlug}/channels`}
          className='text-sm text-muted-foreground hover:text-foreground transition-colors'
        >
          Browse all channels →
        </Link>
      </CardFooter>
    </Card>
  );
}

interface ChannelPillProps {
  channel: Channel;
  workspaceSlug: string;
}

function ChannelPill({ channel, workspaceSlug }: ChannelPillProps) {
  return (
    <Link
      href={`/${workspaceSlug}/channels/${channel.slug}`}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border bg-card',
        'hover:bg-accent hover:text-accent-foreground transition-colors',
        'group relative'
      )}
    >
      <Hash className='h-4 w-4 flex-shrink-0 text-muted-foreground' />
      <span className='text-sm font-medium truncate flex-1'>
        {channel.name}
      </span>
      <div className='flex items-center gap-1 flex-shrink-0'>
        {channel.isStarred && (
          <Star className='h-3 w-3 fill-yellow-500 text-yellow-500' />
        )}
        {channel.unreadCount > 0 && (
          <div
            className='h-2 w-2 rounded-full bg-primary'
            aria-label={`${channel.unreadCount} unread`}
          />
        )}
      </div>
    </Link>
  );
}

function EmptyChannelsState() {
  return (
    <div className='flex flex-col items-center justify-center py-8 text-center'>
      <div className='rounded-full bg-muted p-3 mb-3'>
        <Star className='h-6 w-6 text-muted-foreground' />
      </div>
      <p className='text-sm font-medium text-muted-foreground'>
        No starred channels
      </p>
      <p className='text-xs text-muted-foreground mt-1'>
        Star channels to see them here
      </p>
    </div>
  );
}

function ChannelsWidgetSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className='h-6 w-32' />
      </CardHeader>
      <CardContent>
        <div className='grid grid-cols-2 gap-2'>
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className='h-10 w-full' />
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <Skeleton className='h-4 w-32' />
      </CardFooter>
    </Card>
  );
}
