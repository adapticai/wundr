'use client';

import { useParams } from 'next/navigation';
import { useState, useMemo, useCallback, useEffect } from 'react';

import { usePageHeader } from '@/contexts/page-header-context';

import {
  OrchestratorStatusCard,
  OrchestratorStatusCardSkeleton,
} from '@/components/presence/orchestrator-status-card';
import { useOrchestratorHealthList } from '@/hooks/use-presence';
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
  const workspaceSlug = params.workspaceSlug as string;
  const { setPageHeader } = usePageHeader();

  // Set page header
  useEffect(() => {
    setPageHeader('OrchestratorHealth Dashboard', 'Monitor the health and status of all Orchestrators in your workspace');
  }, [setPageHeader]);

  const [filter, setFilter] = useState<FilterStatus>('all');
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  const { orchestratorList, isLoading, refetch } = useOrchestratorHealthList(workspaceSlug);

  // Filter Orchestrators based on selected filter
  const filteredOrchestrators = useMemo(() => {
    switch (filter) {
      case 'online':
        return orchestratorList.filter(
          (orchestrator) => orchestrator.status === 'ONLINE' && orchestrator.connectionStatus === 'connected',
        );
      case 'offline':
        return orchestratorList.filter(
          (orchestrator) => orchestrator.status !== 'ONLINE' || orchestrator.connectionStatus === 'disconnected',
        );
      case 'unhealthy':
        return orchestratorList.filter(
          (orchestrator) => orchestrator.daemonHealth === 'unhealthy' || orchestrator.daemonHealth === 'degraded',
        );
      default:
        return orchestratorList;
    }
  }, [orchestratorList, filter]);

  // Count unhealthy Orchestrators for alert banner
  const unhealthyCount = useMemo(
    () =>
      orchestratorList.filter(
        (orchestrator) => orchestrator.daemonHealth === 'unhealthy' || orchestrator.daemonHealth === 'degraded',
      ).length,
    [orchestratorList],
  );

  // Handle manual health check
  const handleHealthCheck = useCallback(async () => {
    setIsCheckingHealth(true);
    try {
      await fetch(`/api/workspaces/${workspaceSlug}/orchestrators/health-check`, {
        method: 'POST',
      });
      await refetch();
    } catch {
      // Silently fail
    } finally {
      setIsCheckingHealth(false);
    }
  }, [workspaceSlug, refetch]);

  // Handle Orchestrator details view
  const handleViewDetails = useCallback(
    (orchestratorId: string) => {
      window.location.href = `/${workspaceSlug}/orchestrators/${orchestratorId}`;
    },
    [workspaceSlug],
  );

  // Handle daemon restart
  const handleRestartDaemon = useCallback(
    async (orchestratorId: string) => {
      try {
        await fetch(`/api/orchestrators/${orchestratorId}/daemon/restart`, {
          method: 'POST',
        });
        // Refetch after a short delay to allow restart
        setTimeout(refetch, 2000);
      } catch {
        // Silently fail
      }
    },
    [refetch],
  );

  return (
    <div className="container mx-auto px-4 py-8">

      {/* Alert Banner for Unhealthy Orchestrators */}
      {unhealthyCount > 0 && (
        <div
          className={cn(
            'mb-6 flex items-center gap-3 rounded-lg border px-4 py-3',
            'border-red-500/50 bg-red-50 dark:bg-red-900/10',
          )}
          role="alert"
        >
          <AlertTriangleIcon className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
          <div className="flex-1">
            <p className="font-medium text-red-800 dark:text-red-200">
              {unhealthyCount} Orchestrator{unhealthyCount > 1 ? 's' : ''} require
              {unhealthyCount === 1 ? 's' : ''} attention
            </p>
            <p className="text-sm text-red-700 dark:text-red-300">
              Some Orchestrators are experiencing issues. Check their status and consider
              restarting their daemons.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFilter('unhealthy')}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium',
              'bg-red-100 text-red-800 hover:bg-red-200',
              'dark:bg-red-900/30 dark:text-red-200 dark:hover:bg-red-900/50',
            )}
          >
            View Issues
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                filter === option.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {option.label}
              {option.value === 'unhealthy' && unhealthyCount > 0 && (
                <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-xs text-white">
                  {unhealthyCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Actions */}
        <button
          type="button"
          onClick={handleHealthCheck}
          disabled={isCheckingHealth || isLoading}
          className={cn(
            'inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium',
            'transition-colors hover:bg-accent',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <RefreshIcon
            className={cn('h-4 w-4', isCheckingHealth && 'animate-spin')}
          />
          {isCheckingHealth ? 'Checking...' : 'Run Health Check'}
        </button>
      </div>

      {/* Stats Summary */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total Orchestrators"
          value={orchestratorList.length}
          icon={UsersIcon}
        />
        <StatCard
          label="Online"
          value={
            orchestratorList.filter(
              (orchestrator) => orchestrator.status === 'ONLINE' && orchestrator.connectionStatus === 'connected',
            ).length
          }
          icon={CheckCircleIcon}
          valueColor="text-green-600 dark:text-green-400"
        />
        <StatCard
          label="Degraded"
          value={orchestratorList.filter((orchestrator) => orchestrator.daemonHealth === 'degraded').length}
          icon={AlertTriangleIcon}
          valueColor="text-yellow-600 dark:text-yellow-400"
        />
        <StatCard
          label="Unhealthy"
          value={orchestratorList.filter((orchestrator) => orchestrator.daemonHealth === 'unhealthy').length}
          icon={XCircleIcon}
          valueColor="text-red-600 dark:text-red-400"
        />
      </div>

      {/* OrchestratorGrid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <OrchestratorStatusCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredOrchestrators.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <EmptyIcon className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">
            {filter === 'all'
              ? 'No Orchestrators found in this workspace'
              : `No ${filter} Orchestrators found`}
          </p>
          {filter !== 'all' && (
            <button
              type="button"
              onClick={() => setFilter('all')}
              className="mt-2 text-sm text-primary hover:underline"
            >
              View all Orchestrators
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredOrchestrators.map((orchestrator) => (
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
  icon: typeof UsersIcon;
  valueColor?: string;
}

function StatCard({ label, value, icon: Icon, valueColor }: StatCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className={cn('mt-1 text-2xl font-bold', valueColor)}>{value}</p>
    </div>
  );
}

// Icons
function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}

function EmptyIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 9h.01" />
      <path d="M15 9h.01" />
      <path d="M9 15c.6.6 1.4 1 2.5 1s1.9-.4 2.5-1" />
    </svg>
  );
}
