'use client';

import { ArrowLeft, Loader2, Play, Pause, Trash2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SessionManagerConfigPanel } from '@/components/orchestrator/session-manager-config-panel';
import { SubagentList } from '@/components/orchestrator/subagent-list';
import { SubagentCreate } from '@/components/orchestrator/subagent-create';
import { useToast } from '@/hooks/use-toast';
import type {
  ContextConfig,
  PluginConfig,
  SkillDefinition,
} from '@/lib/validations/session-manager';

interface SessionManagerDetail {
  id: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PAUSED' | 'ERROR';
  isGlobal: boolean;
  maxConcurrentSubagents: number;
  tokenBudgetPerHour: number;
  pluginConfigs: PluginConfig[];
  skillDefinitions: SkillDefinition[];
  contextConfig?: ContextConfig;
  mcpTools: string[];
  createdAt: string;
}

const statusConfig: Record<
  SessionManagerDetail['status'],
  {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
  }
> = {
  ACTIVE: { label: 'Active', variant: 'default' },
  INACTIVE: { label: 'Inactive', variant: 'secondary' },
  PAUSED: { label: 'Paused', variant: 'outline' },
  ERROR: { label: 'Error', variant: 'destructive' },
};

export default function SessionManagerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const workspaceSlug = params.workspaceSlug as string;
  const orchestratorId = params.orchestratorId as string;
  const sessionManagerId = params.sessionManagerId as string;

  const [sessionManager, setSessionManager] =
    useState<SessionManagerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showCreateSubagent, setShowCreateSubagent] = useState(false);
  const [subagentListKey, setSubagentListKey] = useState(0);

  useEffect(() => {
    fetchSessionManager();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionManagerId]);

  async function fetchSessionManager() {
    try {
      setLoading(true);
      const response = await fetch(`/api/session-managers/${sessionManagerId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch session manager');
      }
      const { data } = await response.json();
      setSessionManager(data);
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to load session manager',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus() {
    if (!sessionManager) return;
    const action =
      sessionManager.status === 'ACTIVE' ? 'deactivate' : 'activate';
    setActionLoading(true);
    try {
      const response = await fetch(
        `/api/session-managers/${sessionManagerId}/${action}`,
        { method: 'POST' }
      );
      if (!response.ok) {
        throw new Error(`Failed to ${action} session manager`);
      }
      toast({
        title: 'Success',
        description: `Session manager ${action}d successfully`,
      });
      await fetchSessionManager();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : `Failed to ${action}`,
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    setActionLoading(true);
    try {
      const response = await fetch(
        `/api/session-managers/${sessionManagerId}`,
        { method: 'DELETE' }
      );
      if (!response.ok) {
        throw new Error('Failed to delete session manager');
      }
      toast({
        title: 'Success',
        description: 'Session manager deleted successfully',
      });
      router.push(`/${workspaceSlug}/admin/orchestrators/${orchestratorId}`);
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to delete session manager',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
      setDeleteDialogOpen(false);
    }
  }

  if (loading) {
    return (
      <div className='space-y-6'>
        <div className='flex items-center gap-4'>
          <Skeleton className='h-9 w-9' />
          <div className='space-y-2'>
            <Skeleton className='h-7 w-48' />
            <Skeleton className='h-5 w-24' />
          </div>
        </div>
        <Skeleton className='h-96 w-full' />
      </div>
    );
  }

  if (!sessionManager) {
    return (
      <div className='flex flex-col items-center justify-center py-12'>
        <Card className='max-w-md w-full'>
          <CardContent className='pt-6 text-center space-y-4'>
            <p className='text-muted-foreground'>Session manager not found.</p>
            <Button
              variant='outline'
              onClick={() =>
                router.push(
                  `/${workspaceSlug}/admin/orchestrators/${orchestratorId}`
                )
              }
            >
              <ArrowLeft className='mr-2 h-4 w-4' />
              Back to Orchestrator
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { label: statusLabel, variant: statusVariant } =
    statusConfig[sessionManager.status];
  const isActive = sessionManager.status === 'ACTIVE';

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-start justify-between gap-4'>
        <div className='flex items-start gap-3'>
          <Button
            variant='ghost'
            size='icon'
            onClick={() =>
              router.push(
                `/${workspaceSlug}/admin/orchestrators/${orchestratorId}`
              )
            }
          >
            <ArrowLeft className='h-4 w-4' />
          </Button>
          <div>
            <div className='flex items-center gap-2'>
              <h1 className='text-2xl font-semibold'>{sessionManager.name}</h1>
              <Badge variant={statusVariant}>{statusLabel}</Badge>
              {sessionManager.isGlobal && (
                <Badge variant='outline'>Global</Badge>
              )}
            </div>
            {sessionManager.description && (
              <p className='mt-1 text-sm text-muted-foreground'>
                {sessionManager.description}
              </p>
            )}
          </div>
        </div>

        <div className='flex items-center gap-2 flex-shrink-0'>
          <Button
            variant='outline'
            size='sm'
            onClick={handleToggleStatus}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
            ) : isActive ? (
              <Pause className='mr-2 h-4 w-4' />
            ) : (
              <Play className='mr-2 h-4 w-4' />
            )}
            {isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setDeleteDialogOpen(true)}
            disabled={actionLoading}
            className='text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20'
          >
            <Trash2 className='mr-2 h-4 w-4' />
            Delete
          </Button>
        </div>
      </div>

      {/* Config Panel */}
      <SessionManagerConfigPanel
        sessionManagerId={sessionManagerId}
        orchestratorId={orchestratorId}
        initialData={{
          name: sessionManager.name,
          description: sessionManager.description,
          pluginConfigs: sessionManager.pluginConfigs,
          skillDefinitions: sessionManager.skillDefinitions,
          contextConfig: sessionManager.contextConfig,
          mcpTools: sessionManager.mcpTools,
          maxConcurrentSubagents: sessionManager.maxConcurrentSubagents,
          tokenBudgetPerHour: sessionManager.tokenBudgetPerHour,
          isGlobal: sessionManager.isGlobal,
        }}
        onSave={fetchSessionManager}
      />

      {/* Subagents Section */}
      <div className='space-y-4'>
        <div className='flex items-center justify-between'>
          <h2 className='text-lg font-semibold'>Subagents</h2>
          <Button size='sm' onClick={() => setShowCreateSubagent(true)}>
            Add Subagent
          </Button>
        </div>

        <SubagentCreate
          sessionManagerId={sessionManagerId}
          open={showCreateSubagent}
          onOpenChange={setShowCreateSubagent}
          onCreated={() => {
            setShowCreateSubagent(false);
            setSubagentListKey(k => k + 1);
          }}
        />

        <SubagentList
          key={subagentListKey}
          sessionManagerId={sessionManagerId}
        />
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session Manager</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{sessionManager.name}&quot;?
              This action cannot be undone and will remove all associated
              subagents and configuration.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className='bg-red-600 hover:bg-red-700'
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
