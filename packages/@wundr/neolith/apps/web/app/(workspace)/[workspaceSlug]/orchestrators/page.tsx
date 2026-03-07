/**
 * Orchestrators Overview Page
 *
 * Workspace-level overview of all orchestrators with stats, filtering,
 * search, daemon status indicators, resource utilization, and quick actions.
 *
 * @module app/(workspace)/[workspaceId]/orchestrators/page
 */
'use client';

import {
  Bot,
  Plus,
  X,
  Search,
  AlertCircle,
  Clock,
  Coins,
  Play,
  Pause,
  Settings,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';

import { CreateOrchestratorDialog } from '@/components/orchestrator/create-orchestrator-dialog';
import { DaemonStatusBadge } from '@/components/orchestrator/daemon-status-badge';
import { OrchestratorCardSkeleton } from '@/components/orchestrator/orchestrator-card';
import { OrchestratorStatusBadge } from '@/components/orchestrator/orchestrator-status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { EmptyState } from '@/components/ui/empty-state';
import { usePageHeader } from '@/contexts/page-header-context';
import {
  useOrchestrators,
  useOrchestratorMutations,
} from '@/hooks/use-orchestrator';
import { cn } from '@/lib/utils';
import {
  ORCHESTRATOR_DISCIPLINES,
  ORCHESTRATOR_STATUS_CONFIG,
} from '@/types/orchestrator';

import type {
  Orchestrator,
  OrchestratorFilters,
  OrchestratorStatus,
  CreateOrchestratorInput,
} from '@/types/orchestrator';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatRelativeTime(date: Date): string {
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrchestratorOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceSlug = params.workspaceSlug as string;
  const { setPageHeader } = usePageHeader();

  // Set page header
  useEffect(() => {
    setPageHeader(
      'Orchestrators',
      'AI-powered orchestrators managing your workspace operations'
    );
  }, [setPageHeader]);

  // State
  const [filters, setFilters] = useState<OrchestratorFilters>({});
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  // Hooks
  const {
    orchestrators,
    isLoading,
    error,
    refetch,
    totalCount,
    filteredCount,
  } = useOrchestrators(workspaceSlug, filters);
  const {
    createOrchestrator,
    toggleOrchestratorStatus,
    isLoading: isMutating,
  } = useOrchestratorMutations();

  // Keyboard shortcut for search focus (Cmd/Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Handlers
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: value || undefined }));
    }, 300);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchInput('');
    setFilters(prev => ({ ...prev, search: undefined }));
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, []);

  const handleDisciplineChange = useCallback((value: string) => {
    setFilters(prev => ({ ...prev, discipline: value || undefined }));
  }, []);

  const handleStatusChange = useCallback((value: string) => {
    setFilters(prev => ({
      ...prev,
      status: (value as OrchestratorStatus) || undefined,
    }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({});
  }, []);

  const handleCreateOrchestrator = useCallback(
    async (input: CreateOrchestratorInput) => {
      await createOrchestrator(input);
      refetch();
    },
    [createOrchestrator, refetch]
  );

  const handleToggleStatus = useCallback(
    async (orchestrator: Orchestrator) => {
      await toggleOrchestratorStatus(orchestrator.id, orchestrator.status);
      refetch();
    },
    [toggleOrchestratorStatus, refetch]
  );

  const handleNewOrchestrator = useCallback(() => {
    router.push(`/${workspaceSlug}/orchestrators/new`);
  }, [router, workspaceSlug]);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.discipline) count++;
    if (filters.status) count++;
    return count;
  }, [filters]);

  // Highlight matching text helper
  const highlightText = useCallback(
    (text: string | null | undefined) => {
      if (!text || !filters.search) return text || '';

      const searchTerm = filters.search.toLowerCase();
      const parts = text.split(new RegExp(`(${filters.search})`, 'gi'));

      return parts.map((part, index) => {
        if (part.toLowerCase() === searchTerm) {
          return (
            <mark key={index} className='bg-yellow-200 dark:bg-yellow-900/50'>
              {part}
            </mark>
          );
        }
        return part;
      });
    },
    [filters.search]
  );

  // Group Orchestrators by status for stats
  const orchestratorStats = useMemo(() => {
    const stats = { online: 0, offline: 0, busy: 0, away: 0 };
    orchestrators.forEach(orchestrator => {
      if (orchestrator.status === 'ONLINE') stats.online++;
      else if (orchestrator.status === 'OFFLINE') stats.offline++;
      else if (orchestrator.status === 'BUSY') stats.busy++;
      else if (orchestrator.status === 'AWAY') stats.away++;
    });
    return stats;
  }, [orchestrators]);

  return (
    <div className='p-4 md:p-6 space-y-6'>
      {/* Page Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold font-heading tracking-tight'>
            Orchestrators
          </h1>
          <p className='text-sm text-muted-foreground mt-1'>
            AI-powered orchestrators managing your workspace operations
          </p>
        </div>
        <div className='flex gap-2'>
          <Button
            type='button'
            variant='outline'
            onClick={() => setIsCreateDialogOpen(true)}
            className='inline-flex items-center gap-2'
          >
            Quick Create
          </Button>
          <Button
            type='button'
            onClick={handleNewOrchestrator}
            className='inline-flex items-center gap-2'
          >
            <Plus className='h-4 w-4' />
            New Orchestrator
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
        <StatCard
          label='Total Orchestrators'
          value={isLoading ? '-' : totalCount}
          color='text-foreground'
          bgColor='bg-card'
        />
        <StatCard
          label='Online'
          value={orchestratorStats.online}
          color='text-green-600'
          bgColor='bg-green-50 dark:bg-green-950/20'
        />
        <StatCard
          label='Busy'
          value={orchestratorStats.busy}
          color='text-yellow-600'
          bgColor='bg-yellow-50 dark:bg-yellow-950/20'
        />
        <StatCard
          label='Offline'
          value={orchestratorStats.offline}
          color='text-muted-foreground'
          bgColor='bg-muted/50'
        />
      </div>

      {/* Filters */}
      <div className='rounded-lg border bg-card p-4'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center'>
          {/* Search */}
          <div className='relative flex-1'>
            <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
            <input
              ref={searchInputRef}
              type='text'
              placeholder='Search orchestrators by name, description... (Cmd+K)'
              value={searchInput}
              onChange={e => handleSearchChange(e.target.value)}
              className='w-full rounded-md border border-input bg-background py-2 pl-10 pr-10 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
            />
            {searchInput && (
              <button
                type='button'
                onClick={handleClearSearch}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
                aria-label='Clear search'
              >
                <X className='h-4 w-4' />
              </button>
            )}
          </div>

          {/* Discipline Filter */}
          <select
            value={filters.discipline || ''}
            onChange={e => handleDisciplineChange(e.target.value)}
            className='rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
          >
            <option value=''>All Disciplines</option>
            {ORCHESTRATOR_DISCIPLINES.map(d => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filters.status || ''}
            onChange={e => handleStatusChange(e.target.value)}
            className='rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
          >
            <option value=''>All Status</option>
            {Object.entries(ORCHESTRATOR_STATUS_CONFIG).map(
              ([status, config]) => (
                <option key={status} value={status}>
                  {config.label}
                </option>
              )
            )}
          </select>

          {/* Clear Filters */}
          {activeFiltersCount > 0 && (
            <button
              type='button'
              onClick={handleClearFilters}
              className='inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground'
            >
              <X className='h-4 w-4' />
              Clear ({activeFiltersCount})
            </button>
          )}
        </div>

        {/* Results Count */}
        <div className='mt-3 text-sm text-muted-foreground'>
          {activeFiltersCount > 0 ? (
            <>
              Showing {filteredCount} of {totalCount} orchestrators
            </>
          ) : (
            <>{totalCount} orchestrators total</>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className='rounded-lg border border-red-200 bg-red-50 p-4'>
          <div className='flex items-center gap-2 text-red-800'>
            <AlertCircle className='h-5 w-5' />
            <p className='text-sm font-medium'>Failed to load orchestrators</p>
          </div>
          <p className='mt-1 text-sm text-red-600'>{error.message}</p>
          <button
            type='button'
            onClick={refetch}
            className='mt-2 text-sm font-medium text-red-800 hover:text-red-900'
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {Array.from({ length: 6 }).map((_, i) => (
            <OrchestratorCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && orchestrators.length === 0 && (
        <EmptyState
          icon={Bot}
          title={
            activeFiltersCount > 0
              ? filters.search
                ? `No orchestrators matching "${filters.search}"`
                : 'No Orchestrators Found'
              : 'No Orchestrators Yet'
          }
          description={
            activeFiltersCount > 0
              ? filters.search
                ? 'No orchestrators match your search query. Try different keywords or check your filters.'
                : "Try adjusting your filters to find what you're looking for."
              : 'Get started by creating your first orchestrator. Use the wizard to define an AI-powered agent that can manage tasks and workflows.'
          }
          action={
            activeFiltersCount > 0
              ? {
                  label: 'Clear Filters',
                  onClick: handleClearFilters,
                  variant: 'outline' as const,
                }
              : {
                  label: 'Create Your First Orchestrator',
                  onClick: handleNewOrchestrator,
                }
          }
        />
      )}

      {/* Orchestrators Grid */}
      {!isLoading && !error && orchestrators.length > 0 && (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {orchestrators.map(orchestrator => (
            <OrchestratorOverviewCard
              key={orchestrator.id}
              orchestrator={orchestrator}
              workspaceSlug={workspaceSlug}
              onToggleStatus={handleToggleStatus}
              isMutating={isMutating}
              highlightText={highlightText}
            />
          ))}
        </div>
      )}

      {/* Quick Create Dialog */}
      <CreateOrchestratorDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onCreate={handleCreateOrchestrator}
        isLoading={isMutating}
      />
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
  bgColor,
}: {
  label: string;
  value: number | string;
  color: string;
  bgColor: string;
}) {
  return (
    <div className={cn('rounded-lg border p-4', bgColor)}>
      <p className='text-sm font-medium text-muted-foreground'>{label}</p>
      <p className={cn('text-2xl font-bold', color)}>{value}</p>
    </div>
  );
}

// ─── Resource Utilization Bar ─────────────────────────────────────────────────

function UtilizationBar({
  used,
  budget,
  label,
}: {
  used: number;
  budget: number;
  label: string;
}) {
  if (budget <= 0) return null;
  const pct = Math.min((used / budget) * 100, 100);
  const barColor =
    pct < 70 ? 'bg-green-500' : pct < 90 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className='space-y-1'>
      <div className='flex items-center justify-between'>
        <span className='text-xs font-sans text-muted-foreground'>{label}</span>
        <span className='text-xs font-sans tabular-nums text-foreground'>
          {Math.round(pct)}%
        </span>
      </div>
      <div className='h-1.5 w-full rounded-full bg-secondary'>
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Orchestrator Overview Card ───────────────────────────────────────────────

function OrchestratorOverviewCard({
  orchestrator,
  workspaceSlug,
  onToggleStatus,
  isMutating,
  highlightText,
}: {
  orchestrator: Orchestrator;
  workspaceSlug: string;
  onToggleStatus?: (orchestrator: Orchestrator) => void;
  isMutating?: boolean;
  highlightText?: (text: string | null | undefined) => React.ReactNode;
}) {
  const isOnline = orchestrator.status === 'ONLINE';

  // Derive a rough token utilization from orchestrator data if available
  // The Orchestrator type doesn't carry tokenUsage; we surface what's available
  const lastActivityText = orchestrator.lastActivityAt
    ? formatRelativeTime(new Date(orchestrator.lastActivityAt))
    : 'No activity';

  return (
    <Card className='flex flex-col transition-all hover:border-primary/50 hover:shadow-md'>
      <CardHeader className='pb-3'>
        <div className='flex items-start justify-between gap-2'>
          <div className='flex items-center gap-2.5 min-w-0 flex-1'>
            {/* Avatar initials */}
            <div className='relative flex-shrink-0'>
              <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary font-heading'>
                {orchestrator.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={orchestrator.avatarUrl}
                    alt={orchestrator.title}
                    className='h-full w-full rounded-lg object-cover'
                  />
                ) : (
                  orchestrator.title.substring(0, 2).toUpperCase()
                )}
              </div>
              {/* Daemon status compact indicator */}
              <DaemonStatusBadge
                orchestratorId={orchestrator.id}
                compact
                className='absolute -bottom-0.5 -right-0.5 ring-2 ring-card'
              />
            </div>

            <div className='min-w-0 flex-1'>
              <CardTitle className='text-sm font-semibold truncate font-heading'>
                {highlightText
                  ? highlightText(orchestrator.title)
                  : orchestrator.title}
              </CardTitle>
              {orchestrator.discipline && (
                <p className='text-xs font-sans text-muted-foreground truncate mt-0.5'>
                  {orchestrator.discipline}
                </p>
              )}
            </div>
          </div>

          {/* Status badge */}
          <OrchestratorStatusBadge
            status={orchestrator.status}
            size='sm'
            showPulse={false}
          />
        </div>
      </CardHeader>

      <CardContent className='flex-1 pb-3 space-y-3'>
        {/* Description */}
        {orchestrator.description && (
          <p className='line-clamp-2 text-xs font-sans text-muted-foreground'>
            {highlightText
              ? highlightText(orchestrator.description)
              : orchestrator.description}
          </p>
        )}

        {/* Metrics row */}
        <div className='grid grid-cols-3 gap-2 text-xs font-sans'>
          {/* Active sessions (agent count) */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className='flex flex-col items-center rounded-md border bg-background px-2 py-1.5 cursor-default'>
                  <Users className='h-3.5 w-3.5 text-muted-foreground mb-0.5' />
                  <span className='font-semibold text-foreground tabular-nums'>
                    {orchestrator.agentCount}
                  </span>
                  <span className='text-muted-foreground text-[10px] leading-none'>
                    sessions
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className='text-xs'>
                  {orchestrator.agentCount} active session manager
                  {orchestrator.agentCount !== 1 ? 's' : ''}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Messages */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className='flex flex-col items-center rounded-md border bg-background px-2 py-1.5 cursor-default'>
                  <Bot className='h-3.5 w-3.5 text-muted-foreground mb-0.5' />
                  <span className='font-semibold text-foreground tabular-nums'>
                    {formatNumber(orchestrator.messageCount)}
                  </span>
                  <span className='text-muted-foreground text-[10px] leading-none'>
                    messages
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className='text-xs'>
                  {orchestrator.messageCount.toLocaleString()} total messages
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Last activity */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className='flex flex-col items-center rounded-md border bg-background px-2 py-1.5 cursor-default'>
                  <Clock className='h-3.5 w-3.5 text-muted-foreground mb-0.5' />
                  <span className='font-semibold text-foreground tabular-nums truncate max-w-full'>
                    {orchestrator.lastActivityAt
                      ? formatRelativeTime(
                          new Date(orchestrator.lastActivityAt)
                        ).replace(' ago', '')
                      : 'never'}
                  </span>
                  <span className='text-muted-foreground text-[10px] leading-none'>
                    last active
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className='text-xs'>Last active: {lastActivityText}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Token utilization placeholder - shown only when budget exists */}
        {/* The full token utilization is available on the detail page via live metrics */}
      </CardContent>

      <CardFooter className='pt-3 border-t flex flex-col gap-2'>
        {/* Primary actions */}
        <div className='flex gap-2 w-full'>
          <Button asChild className='flex-1' size='sm'>
            <Link href={`/${workspaceSlug}/orchestrators/${orchestrator.id}`}>
              View Details
            </Link>
          </Button>
          <Button asChild variant='outline' size='sm'>
            <Link
              href={`/${workspaceSlug}/orchestrators/${orchestrator.id}/analytics`}
            >
              Analytics
            </Link>
          </Button>
        </div>

        {/* Quick actions */}
        <div className='flex gap-1.5 w-full'>
          {/* Start/Stop daemon */}
          {onToggleStatus && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => onToggleStatus(orchestrator)}
                    disabled={isMutating}
                    className={cn(
                      'flex-1 gap-1.5',
                      isOnline
                        ? 'text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30'
                        : 'text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/30'
                    )}
                  >
                    {isOnline ? (
                      <>
                        <Pause className='h-3.5 w-3.5' />
                        Stop
                      </>
                    ) : (
                      <>
                        <Play className='h-3.5 w-3.5' />
                        Start
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className='text-xs'>
                    {isOnline
                      ? 'Set orchestrator offline'
                      : 'Set orchestrator online'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* View sessions */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  asChild
                  variant='outline'
                  size='sm'
                  className='flex-1 gap-1.5'
                >
                  <Link
                    href={`/${workspaceSlug}/orchestrators/${orchestrator.id}?tab=session-managers`}
                  >
                    <Users className='h-3.5 w-3.5' />
                    Sessions
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className='text-xs'>View session managers</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Settings */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild variant='outline' size='sm' className='px-2'>
                  <Link
                    href={`/${workspaceSlug}/orchestrators/${orchestrator.id}/settings`}
                  >
                    <Settings className='h-3.5 w-3.5' />
                    <span className='sr-only'>Settings</span>
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className='text-xs'>Edit charter and settings</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardFooter>
    </Card>
  );
}
