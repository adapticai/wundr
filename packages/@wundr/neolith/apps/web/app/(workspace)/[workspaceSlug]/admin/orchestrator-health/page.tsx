'use client';

import {
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  ServerCrash,
  Users,
  XCircle,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState, useMemo, useCallback, useEffect } from 'react';

import {
  OrchestratorStatusCard,
  OrchestratorStatusCardSkeleton,
} from '@/components/presence/orchestrator-status-card';
import { Button } from '@/components/ui/button';
import { usePageHeader } from '@/contexts/page-header-context';
import { useToast } from '@/hooks/use-toast';
import { useWorkspaceOrchestratorHealthList } from '@/hooks/use-presence';
import { cn } from '@/lib/utils';

type FilterStatus = 'all' | 'online' | 'offline' | 'unhealthy';

const filterOptions: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: 'All Orchestrators' },
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
  { value: 'unhealthy', label: 'Unhealthy' },
];

export default function OrchestratorHealthDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceSlug = params.workspaceSlug as string;
  const { setPageHeader } = usePageHeader();

  // Set page header
  useEffect(() => {
    setPageHeader(
      'Orchestrator Health',
      'Monitor the health and status of all orchestrators in your workspace'
    );
  }, [setPageHeader]);

  const { toast } = useToast();
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  const { orchestratorList, isLoading, refetch } =
    useWorkspaceOrchestratorHealthList(workspaceSlug);

  // Filter Orchestrators based on selected filter
  const filteredOrchestrators = useMemo(() => {
    switch (filter) {
      case 'online':
        return orchestratorList.filter(
          orchestrator =>
            orchestrator.status === 'ONLINE' &&
            orchestrator.connectionStatus === 'connected'
        );
      case 'offline':
        return orchestratorList.filter(
          orchestrator =>
            orchestrator.status !== 'ONLINE' ||
            orchestrator.connectionStatus === 'disconnected'
        );
      case 'unhealthy':
        return orchestratorList.filter(
          orchestrator =>
            orchestrator.daemonHealth === 'unhealthy' ||
            orchestrator.daemonHealth === 'degraded'
        );
      default:
        return orchestratorList;
    }
  }, [orchestratorList, filter]);

  // Count unhealthy Orchestrators for alert banner
  const unhealthyCount = useMemo(
    () =>
      orchestratorList.filter(
        orchestrator =>
          orchestrator.daemonHealth === 'unhealthy' ||
          orchestrator.daemonHealth === 'degraded'
      ).length,
    [orchestratorList]
  );

  // Handle manual health check
  const handleHealthCheck = useCallback(async () => {
    setIsCheckingHealth(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/orchestrators/health-check`,
        { method: 'POST' }
      );
      if (!response.ok) {
        throw new Error('Health check request failed');
      }
      await refetch();
      toast({
        title: 'Health check complete',
        description: 'Orchestrator statuses have been refreshed.',
      });
    } catch {
      toast({
        title: 'Health check failed',
        description: 'Could not complete the health check. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCheckingHealth(false);
    }
  }, [workspaceSlug, refetch, toast]);

  // Handle Orchestrator details view
  const handleViewDetails = useCallback(
    (orchestratorId: string) => {
      router.push(`/${workspaceSlug}/admin/orchestrators/${orchestratorId}`);
    },
    [router, workspaceSlug]
  );

  // Handle daemon restart
  const handleRestartDaemon = useCallback(
    async (orchestratorId: string) => {
      try {
        const response = await fetch(
          `/api/orchestrators/${orchestratorId}/daemon/restart`,
          { method: 'POST' }
        );
        if (!response.ok) {
          throw new Error('Daemon restart request failed');
        }
        toast({
          title: 'Daemon restarting',
          description:
            'The daemon will restart shortly. Status will refresh automatically.',
        });
        // Refetch after a short delay to allow restart
        setTimeout(refetch, 2000);
      } catch {
        toast({
          title: 'Restart failed',
          description: 'Could not restart the daemon. Please try again.',
          variant: 'destructive',
        });
      }
    },
    [refetch, toast]
  );

  return (
    <div className='space-y-6'>
      {/* Alert Banner for Unhealthy Orchestrators */}
      {unhealthyCount > 0 && (
        <div
          className={cn(
            'mb-6 flex items-center gap-3 rounded-lg border px-4 py-3',
            'border-red-500/50 bg-red-50 dark:bg-red-900/10'
          )}
          role='alert'
        >
          <AlertTriangle className='h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400' />
          <div className='flex-1'>
            <p className='font-medium text-red-800 dark:text-red-200'>
              {unhealthyCount} Orchestrator{unhealthyCount > 1 ? 's' : ''}{' '}
              require
              {unhealthyCount === 1 ? 's' : ''} attention
            </p>
            <p className='text-sm text-red-700 dark:text-red-300'>
              Some Orchestrators are experiencing issues. Check their status and
              consider restarting their daemons.
            </p>
          </div>
          <Button
            size='sm'
            variant='outline'
            onClick={() => setFilter('unhealthy')}
            className='border-red-300 bg-red-100 text-red-800 hover:bg-red-200 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200 dark:hover:bg-red-900/50'
          >
            View Issues
          </Button>
        </div>
      )}

      {/* Controls */}
      <div className='mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        {/* Filter Tabs */}
        <div className='flex flex-wrap gap-2'>
          {filterOptions.map(option => (
            <button
              key={option.value}
              type='button'
              onClick={() => setFilter(option.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                filter === option.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              {option.label}
              {option.value === 'unhealthy' && unhealthyCount > 0 && (
                <span className='ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-xs text-white'>
                  {unhealthyCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Actions */}
        <Button
          variant='outline'
          onClick={handleHealthCheck}
          disabled={isCheckingHealth || isLoading}
        >
          <RefreshCw
            className={cn('h-4 w-4', isCheckingHealth && 'animate-spin')}
          />
          {isCheckingHealth ? 'Checking...' : 'Run Health Check'}
        </Button>
      </div>

      {/* Stats Summary */}
      <div className='mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4'>
        <StatCard
          label='Total Orchestrators'
          value={orchestratorList.length}
          icon={Users}
        />
        <StatCard
          label='Online'
          value={
            orchestratorList.filter(
              orchestrator =>
                orchestrator.status === 'ONLINE' &&
                orchestrator.connectionStatus === 'connected'
            ).length
          }
          icon={CheckCircle}
          valueColor='text-green-600 dark:text-green-400'
        />
        <StatCard
          label='Degraded'
          value={
            orchestratorList.filter(
              orchestrator => orchestrator.daemonHealth === 'degraded'
            ).length
          }
          icon={AlertTriangle}
          valueColor='text-yellow-600 dark:text-yellow-400'
        />
        <StatCard
          label='Unhealthy'
          value={
            orchestratorList.filter(
              orchestrator => orchestrator.daemonHealth === 'unhealthy'
            ).length
          }
          icon={XCircle}
          valueColor='text-red-600 dark:text-red-400'
        />
      </div>

      {/* OrchestratorGrid */}
      {isLoading ? (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <OrchestratorStatusCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredOrchestrators.length === 0 ? (
        <div className='flex flex-col items-center justify-center rounded-lg border border-dashed py-12'>
          <ServerCrash className='h-12 w-12 text-muted-foreground/50' />
          <p className='mt-2 text-sm text-muted-foreground'>
            {filter === 'all'
              ? 'No orchestrators found in this workspace'
              : `No ${filter} orchestrators found`}
          </p>
          {filter !== 'all' && (
            <button
              type='button'
              onClick={() => setFilter('all')}
              className='mt-2 text-sm text-primary hover:underline'
            >
              View all orchestrators
            </button>
          )}
        </div>
      ) : (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {filteredOrchestrators.map(orchestrator => (
            <OrchestratorStatusCard
              key={orchestrator.id}
              orchestrator={orchestrator}
              onViewDetails={handleViewDetails}
              onRestartDaemon={handleRestartDaemon}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  valueColor?: string;
}

function StatCard({ label, value, icon: Icon, valueColor }: StatCardProps) {
  return (
    <div className='rounded-lg border bg-card p-4'>
      <div className='flex items-center gap-2'>
        <Icon className='h-4 w-4 text-muted-foreground' />
        <span className='text-sm text-muted-foreground'>{label}</span>
      </div>
      <p className={cn('mt-1 text-2xl font-bold', valueColor)}>{value}</p>
    </div>
  );
}
