/**
 * Session Managers List Page
 *
 * Lists all session managers for a given orchestrator with status,
 * discipline, agent count, and quick actions.
 *
 * @module app/(workspace)/[workspaceSlug]/orchestrators/[orchestratorId]/session-managers/page
 */
'use client';

import { Plus, ChevronRight } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

import { SessionManagerCard } from '@/components/session-manager/session-manager-card';
import { SessionManagerCreate } from '@/components/orchestrator/session-manager-create';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageHeader } from '@/contexts/page-header-context';

interface SessionManager {
  id: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PAUSED' | 'ERROR';
  isGlobal: boolean;
  disciplineId?: string;
  maxConcurrentSubagents: number;
  tokenBudgetPerHour: number;
  subagents: Array<{ id: string; name: string; status: string }>;
  createdAt: string;
  updatedAt: string;
}

interface OrchestratorMeta {
  id: string;
  title: string;
}

export default function SessionManagersListPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceSlug = params.workspaceSlug as string;
  const orchestratorId = params.orchestratorId as string;
  const { setPageHeader } = usePageHeader();

  const [sessionManagers, setSessionManagers] = useState<SessionManager[]>([]);
  const [orchestrator, setOrchestrator] = useState<OrchestratorMeta | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [smRes, orchRes] = await Promise.all([
        fetch(`/api/orchestrators/${orchestratorId}/session-managers`),
        fetch(`/api/orchestrators/${orchestratorId}`),
      ]);

      if (!smRes.ok) {
        throw new Error('Failed to fetch session managers');
      }

      const { data } = await smRes.json();
      setSessionManagers(data ?? []);

      if (orchRes.ok) {
        const orchData = await orchRes.json();
        setOrchestrator(orchData.data ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [orchestratorId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPageHeader(
      'Session Managers',
      orchestrator
        ? `Session managers for ${orchestrator.title}`
        : 'Manage Claude Code session managers'
    );
  }, [orchestrator, setPageHeader]);

  const handleToggleStatus = useCallback(
    async (id: string, currentStatus: string) => {
      const action = currentStatus === 'ACTIVE' ? 'deactivate' : 'activate';
      try {
        const res = await fetch(`/api/session-managers/${id}/${action}`, {
          method: 'POST',
        });
        if (!res.ok) {
          throw new Error(`Failed to ${action} session manager`);
        }
        await fetchData();
      } catch (err) {
        console.error(`Failed to ${action} session manager:`, err);
      }
    },
    [fetchData]
  );

  const handleNavigateToDetail = useCallback(
    (id: string) => {
      router.push(
        `/${workspaceSlug}/orchestrators/${orchestratorId}/session-managers/${id}`
      );
    },
    [router, workspaceSlug, orchestratorId]
  );

  if (loading) {
    return (
      <div className='p-4 md:p-6 space-y-6'>
        <div className='h-6 bg-muted rounded w-64 animate-pulse' />
        <div className='grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3'>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className='h-48 w-full' />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='p-4 md:p-6 flex flex-col items-center justify-center py-12'>
        <div className='rounded-lg border border-red-200 bg-red-50 p-6 max-w-md w-full'>
          <h3 className='text-lg font-semibold text-red-800'>
            Failed to load session managers
          </h3>
          <p className='mt-2 text-sm text-red-600'>{error}</p>
          <div className='mt-4 flex gap-2'>
            <Button
              variant='outline'
              onClick={() =>
                router.push(`/${workspaceSlug}/orchestrators/${orchestratorId}`)
              }
            >
              Go Back
            </Button>
            <Button onClick={fetchData}>Try Again</Button>
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
        <span className='text-foreground font-medium'>Session Managers</span>
      </nav>

      {/* Page Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>
            Session Managers
          </h1>
          <p className='text-muted-foreground mt-1'>
            {sessionManagers.length === 0
              ? 'No session managers configured yet.'
              : `${sessionManagers.length} session manager${sessionManagers.length !== 1 ? 's' : ''} — ${sessionManagers.filter(sm => sm.status === 'ACTIVE').length} active`}
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className='h-4 w-4 mr-2' />
          New Session Manager
        </Button>
      </div>

      {/* Session Manager Grid */}
      {sessionManagers.length === 0 ? (
        <div className='flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center'>
          <div className='flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-4'>
            <Plus className='h-7 w-7 text-primary' />
          </div>
          <h3 className='text-lg font-semibold'>No session managers yet</h3>
          <p className='text-sm text-muted-foreground mt-2 max-w-sm'>
            Session managers coordinate Claude Code sessions and sub-agents for
            this orchestrator. Create one to get started.
          </p>
          <Button className='mt-4' onClick={() => setIsCreateOpen(true)}>
            <Plus className='h-4 w-4 mr-2' />
            Create Session Manager
          </Button>
        </div>
      ) : (
        <div className='grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3'>
          {sessionManagers.map(sm => (
            <SessionManagerCard
              key={sm.id}
              sessionManager={sm}
              onViewDetails={handleNavigateToDetail}
              onToggleStatus={handleToggleStatus}
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <SessionManagerCreate
        orchestratorId={orchestratorId}
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={fetchData}
      />
    </div>
  );
}
