/**
 * Login History Section Component
 *
 * Displays user login history with device and location information.
 *
 * @module components/settings/security/LoginHistorySection
 */

'use client';

import {
  Monitor,
  Smartphone,
  Tablet,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLoginHistory } from '@/hooks/use-login-history';

export function LoginHistorySection() {
  const { entries, isLoading, error, loadMore, hasMore } = useLoginHistory();
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    await loadMore();
    setIsLoadingMore(false);
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile':
        return <Smartphone className='h-5 w-5' />;
      case 'tablet':
        return <Tablet className='h-5 w-5' />;
      default:
        return <Monitor className='h-5 w-5' />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className='h-4 w-4 text-green-500' />;
      case 'failed':
        return <XCircle className='h-4 w-4 text-red-500' />;
      case 'blocked':
        return <AlertTriangle className='h-4 w-4 text-yellow-500' />;
      default:
        return null;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'Just now';
    }
    if (diffMins < 60) {
      return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    }
    if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    }
    if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }
    return date.toLocaleDateString();
  };

  if (error) {
    return (
      <Card className='border-destructive/20 bg-destructive/5'>
        <CardContent className='p-6'>
          <p className='text-sm text-destructive'>
            Failed to load login history. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Login History</CardTitle>
        <CardDescription>
          View your recent login activity and device information
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && entries.length === 0 ? (
          <div className='flex items-center justify-center p-8'>
            <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
          </div>
        ) : entries.length === 0 ? (
          <div className='rounded-lg border border-dashed p-8'>
            <p className='text-center text-sm text-muted-foreground'>
              No login history available
            </p>
          </div>
        ) : (
          <>
            <ScrollArea className='h-[400px] pr-4'>
              <div className='space-y-3'>
                {entries.map(entry => (
                  <div
                    key={entry.id}
                    className='flex items-start justify-between rounded-lg border p-4'
                  >
                    <div className='flex gap-3'>
                      <div className='flex h-10 w-10 items-center justify-center rounded-full bg-muted'>
                        {getDeviceIcon(entry.deviceType)}
                      </div>
                      <div className='space-y-1'>
                        <div className='flex items-center gap-2'>
                          <p className='text-sm font-medium'>
                            {entry.browser} on {entry.os}
                          </p>
                          {getStatusIcon(entry.status)}
                        </div>
                        <div className='flex items-center gap-3 text-xs text-muted-foreground'>
                          <div className='flex items-center gap-1'>
                            <MapPin className='h-3 w-3' />
                            <span>{entry.location}</span>
                          </div>
                          <span>•</span>
                          <span>{entry.ipAddress}</span>
                        </div>
                        {entry.failureReason && (
                          <p className='text-xs text-destructive'>
                            {entry.failureReason}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className='flex items-center gap-1 text-xs text-muted-foreground'>
                      <Clock className='h-3 w-3' />
                      <span>{formatTimestamp(entry.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            {hasMore && (
              <div className='mt-4 flex justify-center'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
