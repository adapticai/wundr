/**
 * Security Audit Section Component
 *
 * Displays security audit logs with filtering capabilities.
 *
 * @module components/settings/security/SecurityAuditSection
 */

'use client';

import {
  Shield,
  Info,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Filter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSecurityAudit } from '@/hooks/use-security-audit';

export function SecurityAuditSection() {
  const { entries, isLoading, error, loadMore, hasMore, filter } =
    useSecurityAudit();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');

  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    await loadMore();
    setIsLoadingMore(false);
  };

  const handleSeverityFilter = async (severity: string) => {
    setSelectedSeverity(severity);
    await filter(undefined, severity === 'all' ? undefined : severity);
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className='h-4 w-4 text-red-500' />;
      case 'warning':
        return <AlertTriangle className='h-4 w-4 text-yellow-500' />;
      default:
        return <Info className='h-4 w-4 text-blue-500' />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800';
      default:
        return 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  if (error) {
    return (
      <Card className='border-destructive/20 bg-destructive/5'>
        <CardContent className='p-6'>
          <p className='text-sm text-destructive'>
            Failed to load security audit logs. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Shield className='h-5 w-5' />
            <CardTitle>Security Audit Log</CardTitle>
          </div>
          <div className='flex items-center gap-2'>
            <Filter className='h-4 w-4 text-muted-foreground' />
            <Select
              value={selectedSeverity}
              onValueChange={handleSeverityFilter}
            >
              <SelectTrigger className='w-32'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All</SelectItem>
                <SelectItem value='info'>Info</SelectItem>
                <SelectItem value='warning'>Warning</SelectItem>
                <SelectItem value='critical'>Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <CardDescription>
          Review all security-related events for your account
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
              No security events recorded
            </p>
          </div>
        ) : (
          <>
            <ScrollArea className='h-[400px] pr-4'>
              <div className='space-y-3'>
                {entries.map(entry => (
                  <div
                    key={entry.id}
                    className={`rounded-lg border p-4 ${getSeverityColor(entry.severity)}`}
                  >
                    <div className='flex items-start gap-3'>
                      {getSeverityIcon(entry.severity)}
                      <div className='flex-1 space-y-1'>
                        <div className='flex items-center justify-between'>
                          <p className='text-sm font-medium'>
                            {entry.description}
                          </p>
                          <span className='text-xs text-muted-foreground'>
                            {formatTimestamp(entry.timestamp)}
                          </span>
                        </div>
                        <p className='text-xs text-muted-foreground'>
                          Event: {entry.eventType.replace(/_/g, ' ')}
                        </p>
                        {entry.ipAddress && (
                          <p className='text-xs text-muted-foreground'>
                            From: {entry.ipAddress}
                          </p>
                        )}
                        {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                          <details className='mt-2'>
                            <summary className='cursor-pointer text-xs text-muted-foreground hover:text-foreground'>
                              View details
                            </summary>
                            <pre className='mt-2 rounded bg-black/5 p-2 text-xs dark:bg-white/5'>
                              {JSON.stringify(entry.metadata, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
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
