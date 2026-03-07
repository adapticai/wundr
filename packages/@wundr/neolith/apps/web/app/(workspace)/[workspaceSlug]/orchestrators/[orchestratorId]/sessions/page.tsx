/**
 * Orchestrator Sessions Page
 *
 * Lists active and recent sessions (session managers) for a given orchestrator.
 * Shows session status, output preview, and start/stop controls.
 *
 * @module app/(workspace)/[workspaceSlug]/orchestrators/[orchestratorId]/sessions/page
 */
'use client';

import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Users,
  XCircle,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { DaemonStatusBadge } from '@/components/orchestrator/daemon-status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { SessionManagerCreate } from '@/components/orchestrator/session-manager-create';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePageHeader } from '@/contexts/page-header-context';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionStatus = 'ACTIVE' | 'INACTIVE' | 'PAUSED' | 'ERROR';

interface Session {
  id: string;
  name: string;
  description?: string;
  status: SessionStatus;
  isGlobal: boolean;
  maxConcurrentSubagents: number;
  tokenBudgetPerHour: number;
  subagents: Array<{
    id: string;
    name: string;
    status: string;
    lastOutput?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface OrchestratorMeta {
  id: string;
  title: string;
  status: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  SessionStatus,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  ACTIVE: {
    label: 'Running',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    borderColor: 'border-green-200 dark:border-green-800',
    icon: Activity,
  },
  INACTIVE: {
    label: 'Idle',
    color: 'text-gray-700 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-950/30',
    borderColor: 'border-gray-200 dark:border-gray-700',
    icon: Clock,
  },
  PAUSED: {
    label: 'Paused',
    color: 'text-yellow-700 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    icon: Pause,
  },
  ERROR: {
    label: 'Failed',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-red-200 dark:border-red-800',
    icon: XCircle,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diffMs / 1000);
  const mins = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  if (secs < 60) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatTokenBudget(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({
  session,
  workspaceSlug,
  orchestratorId,
  onToggle,
  onViewDetails,
  isToggling,
}: {
  session: Session;
  workspaceSlug: string;
  orchestratorId: string;
  onToggle: (id: string, status: SessionStatus) => void;
  onViewDetails: (id: string) => void;
  isToggling: boolean;
}) {
  const config = STATUS_CONFIG[session.status];
  const StatusIcon = config.icon;
  const activeSubagents = session.subagents.filter(
    sa => sa.status === 'ACTIVE'
  ).length;
  const capacityPct =
    session.maxConcurrentSubagents > 0
      ? (activeSubagents / session.maxConcurrentSubagents) * 100
      : 0;

  // Show last output from most recently active subagent
  const lastOutput = session.subagents
    .filter(sa => sa.lastOutput)
    .map(sa => sa.lastOutput)
    .at(0);

  return (
    <Card
      className={cn(
        'flex flex-col transition-all hover:shadow-md cursor-pointer',
        session.status === 'ACTIVE' && 'border-green-200 dark:border-green-800'
      )}
      onClick={() => onViewDetails(session.id)}
    >
      <CardHeader className='pb-3'>
        <div className='flex items-start justify-between gap-2'>
          <div className='flex items-center gap-2.5 min-w-0 flex-1'>
            {/* Status icon */}
            <div
              className={cn(
                'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border',
                config.bgColor,
                config.borderColor
              )}
            >
              <StatusIcon className={cn('h-4 w-4', config.color)} />
            </div>

            <div className='min-w-0 flex-1'>
              <CardTitle className='text-sm font-semibold font-heading truncate'>
                {session.name}
              </CardTitle>
              {session.description && (
                <CardDescription className='text-xs truncate mt-0.5'>
                  {session.description}
                </CardDescription>
              )}
            </div>
          </div>

          {/* Status badge */}
          <Badge
            variant='outline'
            className={cn(
              'text-xs flex-shrink-0',
              config.color,
              config.bgColor,
              config.borderColor
            )}
          >
            {config.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className='flex-1 space-y-3 pb-3'>
        {/* Subagent capacity bar */}
        <div className='space-y-1'>
          <div className='flex items-center justify-between text-xs font-sans'>
            <span className='text-muted-foreground flex items-center gap-1'>
              <Users className='h-3 w-3' />
              Subagents
            </span>
            <span className='tabular-nums text-foreground'>
              {activeSubagents} / {session.maxConcurrentSubagents}
            </span>
          </div>
          <Progress
            value={capacityPct}
            className={cn(
              'h-1.5',
              capacityPct < 70
                ? '[&>div]:bg-green-500'
                : capacityPct < 90
                  ? '[&>div]:bg-yellow-500'
                  : '[&>div]:bg-red-500'
            )}
          />
        </div>

        {/* Token budget */}
        <div className='flex items-center justify-between text-xs font-sans'>
          <span className='text-muted-foreground flex items-center gap-1'>
            <Cpu className='h-3 w-3' />
            Token Budget
          </span>
          <span className='tabular-nums text-foreground'>
            {formatTokenBudget(session.tokenBudgetPerHour)}/hr
          </span>
        </div>

        {/* Output preview */}
        {lastOutput && (
          <div className='rounded-md bg-muted/50 border px-2.5 py-2'>
            <p className='text-xs font-sans text-muted-foreground line-clamp-2 font-mono'>
              {lastOutput}
            </p>
          </div>
        )}

        {/* Meta: scope and last updated */}
        <div className='flex items-center justify-between text-xs font-sans text-muted-foreground'>
          {session.isGlobal && (
            <Badge variant='secondary' className='text-xs px-1.5 py-0'>
              Global
            </Badge>
          )}
          <span className='ml-auto'>
            Updated {formatRelativeTime(session.updatedAt)}
          </span>
        </div>
      </CardContent>

      {/* Controls */}
      <div
        className='flex gap-2 border-t px-4 py-3'
        onClick={e => e.stopPropagation()}
      >
        <Button
          variant='outline'
          size='sm'
          className={cn(
            'flex-1 gap-1.5',
            session.status === 'ACTIVE'
              ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30'
              : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30'
          )}
          onClick={() => onToggle(session.id, session.status)}
          disabled={isToggling || session.status === 'ERROR'}
        >
          {session.status === 'ACTIVE' ? (
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
        <Button
          variant='outline'
          size='sm'
          className='flex-1'
          onClick={() => onViewDetails(session.id)}
        >
          View
        </Button>
      </div>
    </Card>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function SessionsListSkeleton() {
  return (
    <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
      {[0, 1, 2, 3, 4, 5].map(i => (
        <Card key={i} className='flex flex-col'>
          <CardHeader className='pb-3'>
            <div className='flex items-start gap-2.5'>
              <Skeleton className='h-9 w-9 rounded-lg flex-shrink-0' />
              <div className='flex-1 space-y-1.5'>
                <Skeleton className='h-4 w-36' />
                <Skeleton className='h-3 w-48' />
              </div>
              <Skeleton className='h-5 w-16 rounded-full' />
            </div>
          </CardHeader>
          <CardContent className='space-y-3 pb-3'>
            <Skeleton className='h-4 w-full' />
            <Skeleton className='h-1.5 w-full rounded-full' />
            <Skeleton className='h-4 w-3/4' />
          </CardContent>
          <div className='flex gap-2 border-t px-4 py-3'>
            <Skeleton className='h-8 flex-1 rounded-md' />
            <Skeleton className='h-8 flex-1 rounded-md' />
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrchestratorSessionsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceSlug = params.workspaceSlug as string;
  const orchestratorId = params.orchestratorId as string;
  const { setPageHeader } = usePageHeader();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [orchestrator, setOrchestrator] = useState<OrchestratorMeta | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'running' | 'idle'>('all');

  // Set page header
  useEffect(() => {
    setPageHeader(
      'Sessions',
      orchestrator
        ? `Active and recent sessions for ${orchestrator.title}`
        : 'Orchestrator session managers'
    );
  }, [orchestrator, setPageHeader]);

  const fetchData = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const [smRes, orchRes] = await Promise.all([
          fetch(`/api/orchestrators/${orchestratorId}/session-managers`),
          fetch(`/api/orchestrators/${orchestratorId}`),
        ]);

        if (!smRes.ok) {
          throw new Error('Failed to fetch sessions');
        }

        const { data: smData } = await smRes.json();
        setSessions(smData ?? []);

        if (orchRes.ok) {
          const orchData = await orchRes.json();
          setOrchestrator(orchData.data ?? null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orchestratorId]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggle = useCallback(
    async (id: string, currentStatus: SessionStatus) => {
      const action = currentStatus === 'ACTIVE' ? 'deactivate' : 'activate';
      setTogglingId(id);

      try {
        const res = await fetch(`/api/session-managers/${id}/${action}`, {
          method: 'POST',
        });

        if (!res.ok) {
          throw new Error(`Failed to ${action} session`);
        }

        await fetchData();
        toast.success(
          `Session ${action === 'activate' ? 'started' : 'stopped'} successfully`
        );
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : `Failed to ${action} session`;
        toast.error(msg);
        console.error(msg, err);
      } finally {
        setTogglingId(null);
      }
    },
    [fetchData]
  );

  const handleViewDetails = useCallback(
    (sessionId: string) => {
      router.push(
        `/${workspaceSlug}/orchestrators/${orchestratorId}/session-managers/${sessionId}`
      );
    },
    [router, workspaceSlug, orchestratorId]
  );

  // Derived lists
  const runningSessions = sessions.filter(s => s.status === 'ACTIVE');
  const idleSessions = sessions.filter(
    s => s.status === 'INACTIVE' || s.status === 'PAUSED'
  );
  const failedSessions = sessions.filter(s => s.status === 'ERROR');

  const filteredSessions =
    activeTab === 'running'
      ? runningSessions
      : activeTab === 'idle'
        ? idleSessions
        : sessions;

  if (loading) {
    return (
      <div className='p-4 md:p-6 space-y-6'>
        <Skeleton className='h-6 w-48' />
        <SessionsListSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className='p-4 md:p-6 flex flex-col items-center justify-center py-12'>
        <div className='rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20 p-6 max-w-md w-full'>
          <div className='flex items-center gap-2 text-red-800 dark:text-red-400'>
            <AlertCircle className='h-5 w-5' />
            <h3 className='text-lg font-semibold'>Failed to load sessions</h3>
          </div>
          <p className='mt-2 text-sm text-red-600 dark:text-red-400'>{error}</p>
          <div className='mt-4 flex gap-2'>
            <Button
              variant='outline'
              onClick={() =>
                router.push(`/${workspaceSlug}/orchestrators/${orchestratorId}`)
              }
            >
              Go Back
            </Button>
            <Button onClick={() => fetchData()}>Try Again</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='p-4 md:p-6 space-y-6'>
      {/* Breadcrumbs */}
      <nav className='flex items-center gap-2 text-sm text-muted-foreground'>
        <button
          type='button'
          onClick={() => router.push(`/${workspaceSlug}/orchestrators`)}
          className='hover:text-foreground transition-colors'
        >
          Orchestrators
        </button>
        <ChevronRight className='h-4 w-4' />
        <button
          type='button'
          onClick={() =>
            router.push(`/${workspaceSlug}/orchestrators/${orchestratorId}`)
          }
          className='hover:text-foreground transition-colors'
        >
          {orchestrator?.title ?? orchestratorId}
        </button>
        <ChevronRight className='h-4 w-4' />
        <span className='text-foreground font-medium'>Sessions</span>
      </nav>

      {/* Page header */}
      <div className='flex items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold font-heading tracking-tight'>
            Sessions
          </h1>
          <p className='text-sm text-muted-foreground mt-1'>
            {sessions.length === 0
              ? 'No sessions configured yet.'
              : `${sessions.length} session${sessions.length !== 1 ? 's' : ''} — ${runningSessions.length} running`}
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <DaemonStatusBadge orchestratorId={orchestratorId} />
          <Button
            variant='outline'
            size='sm'
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className='gap-1.5'
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')}
            />
            Refresh
          </Button>
          <Button onClick={() => setIsCreateOpen(true)} className='gap-1.5'>
            <Plus className='h-4 w-4' />
            New Session
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
        <StatsCell
          icon={Activity}
          label='Running'
          value={runningSessions.length}
          colorClass='text-green-600 dark:text-green-400'
        />
        <StatsCell
          icon={Clock}
          label='Idle'
          value={idleSessions.length}
          colorClass='text-muted-foreground'
        />
        <StatsCell
          icon={XCircle}
          label='Failed'
          value={failedSessions.length}
          colorClass={
            failedSessions.length > 0
              ? 'text-red-600 dark:text-red-400'
              : 'text-muted-foreground'
          }
        />
        <StatsCell
          icon={Users}
          label='Total'
          value={sessions.length}
          colorClass='text-foreground'
        />
      </div>

      {/* Tabs + sessions grid */}
      {sessions.length > 0 ? (
        <Tabs
          value={activeTab}
          onValueChange={v => setActiveTab(v as typeof activeTab)}
        >
          <TabsList>
            <TabsTrigger value='all'>All ({sessions.length})</TabsTrigger>
            <TabsTrigger value='running'>
              Running ({runningSessions.length})
            </TabsTrigger>
            <TabsTrigger value='idle'>Idle ({idleSessions.length})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className='mt-4'>
            {filteredSessions.length === 0 ? (
              <div className='flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center'>
                <CheckCircle2 className='h-10 w-10 text-muted-foreground/40 mb-3' />
                <p className='text-sm font-sans font-medium text-muted-foreground'>
                  No {activeTab === 'running' ? 'running' : 'idle'} sessions
                </p>
              </div>
            ) : (
              <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                {filteredSessions.map(session => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    workspaceSlug={workspaceSlug}
                    orchestratorId={orchestratorId}
                    onToggle={handleToggle}
                    onViewDetails={handleViewDetails}
                    isToggling={togglingId === session.id}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        /* Empty state */
        <div className='flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center'>
          <div className='flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-4'>
            <Activity className='h-7 w-7 text-primary' />
          </div>
          <h3 className='text-lg font-semibold font-heading'>
            No sessions yet
          </h3>
          <p className='text-sm text-muted-foreground mt-2 max-w-sm'>
            Session managers coordinate Claude Code sessions and sub-agents for
            this orchestrator. Create one to get started.
          </p>
          <Button
            className='mt-4 gap-1.5'
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus className='h-4 w-4' />
            Create Session
          </Button>
        </div>
      )}

      {/* Create dialog */}
      <SessionManagerCreate
        orchestratorId={orchestratorId}
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={() => fetchData()}
      />
    </div>
  );
}

// ─── Stats Cell ───────────────────────────────────────────────────────────────

function StatsCell({
  icon: Icon,
  label,
  value,
  colorClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  colorClass: string;
}) {
  return (
    <div className='rounded-lg border bg-card p-4'>
      <div className='flex items-center gap-2 text-muted-foreground mb-1.5'>
        <Icon className='h-3.5 w-3.5' />
        <span className='text-xs font-sans'>{label}</span>
      </div>
      <p
        className={cn(
          'text-2xl font-bold font-heading tabular-nums',
          colorClass
        )}
      >
        {value}
      </p>
    </div>
  );
}
