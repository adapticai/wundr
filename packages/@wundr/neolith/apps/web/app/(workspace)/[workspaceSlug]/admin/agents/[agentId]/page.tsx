'use client';

import { ArrowLeft, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { AgentEditor } from '@/components/agents/agent-editor';
import { CapabilityBadges } from '@/components/agents/capability-badges';
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
import { Skeleton } from '@/components/ui/skeleton';
import { usePageHeader } from '@/contexts/page-header-context';
import { useAgent, useAgentMutations } from '@/hooks/use-agents';
import { cn } from '@/lib/utils';
import { AGENT_TYPE_METADATA } from '@/types/agent';

import type { AgentEditorValues } from '@/components/agents/agent-editor';
import type { Capability } from '@/components/agents/capability-badges';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS = {
  active:
    'bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400',
  paused:
    'bg-yellow-500/10 text-yellow-600 border-yellow-500/20 dark:text-yellow-400',
  inactive: 'bg-stone-500/10 text-stone-500 border-stone-500/20',
} as const;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceSlug = params.workspaceSlug as string;
  const agentId = params.agentId as string;
  const { setPageHeader } = usePageHeader();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { agent, isLoading, refetch } = useAgent(workspaceSlug, agentId);
  const {
    updateAgent,
    deleteAgent,
    isLoading: mutating,
  } = useAgentMutations(workspaceSlug);

  useEffect(() => {
    if (agent) {
      setPageHeader(agent.name, 'Edit agent configuration');
    } else if (!isLoading) {
      setPageHeader('Agent', 'Edit agent configuration');
    }
  }, [agent, isLoading, setPageHeader]);

  const handleSave = async (values: AgentEditorValues) => {
    const result = await updateAgent(agentId, {
      name: values.name,
      type: values.type,
      description: values.description || undefined,
      systemPrompt: values.systemPrompt || undefined,
      status: values.status,
      config: {
        model: values.model,
        temperature: values.temperature,
        maxTokens: values.maxTokens,
      },
      tools: values.tools as never[],
    });

    if (result) {
      toast.success('Agent updated successfully');
      refetch();
    } else {
      toast.error('Failed to update agent');
    }
  };

  const handleDelete = async () => {
    const success = await deleteAgent(agentId);
    if (success) {
      toast.success('Agent deleted');
      router.push(`/${workspaceSlug}/admin/agents`);
    } else {
      toast.error('Failed to delete agent');
    }
    setShowDeleteDialog(false);
  };

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className='space-y-6'>
        <div className='flex items-center gap-3'>
          <Skeleton className='h-5 w-5 rounded' />
          <Skeleton className='h-5 w-32' />
        </div>
        <div className='rounded-lg border p-6 space-y-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className='h-10 w-full' />
          ))}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Not found
  // ---------------------------------------------------------------------------

  if (!agent) {
    return (
      <div className='flex flex-col items-center gap-4 py-16 text-center'>
        <p className='text-muted-foreground'>Agent not found.</p>
        <Link href={`/${workspaceSlug}/admin/agents`}>
          <Button variant='outline' size='sm'>
            <ArrowLeft className='mr-2 h-4 w-4' />
            Back to agents
          </Button>
        </Link>
      </div>
    );
  }

  // Build capabilities from agent tools (tools act as a proxy for now,
  // since the DB model uses tools; capabilities are stored in tools list)
  const capabilities: Partial<Record<Capability, boolean>> = {
    canReadFiles: agent.tools.includes('file_operations'),
    canWriteFiles: agent.tools.includes('file_operations'),
    canExecuteCommands: agent.tools.includes('code_execution'),
    canAccessNetwork:
      agent.tools.includes('web_search') || agent.tools.includes('api_calls'),
    canSpawnSubAgents: false,
  };

  const meta = AGENT_TYPE_METADATA[agent.type];

  // Build default values for the editor
  const defaultValues: Partial<AgentEditorValues> = {
    name: agent.name,
    type: agent.type,
    description: agent.description,
    systemPrompt: agent.systemPrompt,
    model: agent.config.model,
    temperature: agent.config.temperature,
    maxTokens: agent.config.maxTokens,
    tools: agent.tools,
    capabilities: {
      canReadFiles: capabilities.canReadFiles ?? false,
      canWriteFiles: capabilities.canWriteFiles ?? false,
      canExecuteCommands: capabilities.canExecuteCommands ?? false,
      canAccessNetwork: capabilities.canAccessNetwork ?? false,
      canSpawnSubAgents: capabilities.canSpawnSubAgents ?? false,
    },
    tags: [],
    status: agent.status,
  };

  return (
    <div className='space-y-6'>
      {/* Back nav + header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div className='flex items-start gap-4'>
          <Link href={`/${workspaceSlug}/admin/agents`}>
            <Button variant='ghost' size='sm' className='-ml-1'>
              <ArrowLeft className='mr-2 h-4 w-4' />
              Agents
            </Button>
          </Link>
        </div>

        <Button
          variant='outline'
          size='sm'
          onClick={() => setShowDeleteDialog(true)}
          className='text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950'
        >
          <Trash2 className='mr-2 h-4 w-4' />
          Delete Agent
        </Button>
      </div>

      {/* Agent summary card */}
      <div className='rounded-lg border bg-card p-5'>
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <div className='flex items-center gap-3'>
            <div className='flex h-11 w-11 items-center justify-center rounded-lg bg-muted text-2xl'>
              {meta?.icon}
            </div>
            <div>
              <h2 className='font-semibold text-foreground'>{agent.name}</h2>
              <p className='text-sm text-muted-foreground'>
                {meta?.label ?? agent.type}
              </p>
            </div>
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            <Badge
              variant='outline'
              className={cn('text-xs', STATUS_COLORS[agent.status])}
            >
              {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
            </Badge>
            <CapabilityBadges capabilities={capabilities} activeOnly />
          </div>
        </div>

        {/* Stats row */}
        <div className='mt-4 grid grid-cols-3 gap-4 border-t border-border pt-4 sm:grid-cols-4'>
          <div>
            <p className='text-xs text-muted-foreground'>Tasks</p>
            <p className='text-lg font-semibold tabular-nums'>
              {agent.stats.tasksCompleted}
            </p>
          </div>
          <div>
            <p className='text-xs text-muted-foreground'>Success rate</p>
            <p className='text-lg font-semibold tabular-nums'>
              {agent.stats.successRate}%
            </p>
          </div>
          <div>
            <p className='text-xs text-muted-foreground'>Avg response</p>
            <p className='text-lg font-semibold tabular-nums'>
              {agent.stats.avgResponseTime > 0
                ? `${Math.round(agent.stats.avgResponseTime / 1000)}s`
                : '—'}
            </p>
          </div>
          <div className='hidden sm:block'>
            <p className='text-xs text-muted-foreground'>Last active</p>
            <p className='text-lg font-semibold'>
              {agent.stats.lastActive
                ? new Date(agent.stats.lastActive).toLocaleDateString()
                : 'Never'}
            </p>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className='rounded-lg border bg-card p-6'>
        <h3 className='mb-6 text-base font-semibold text-foreground'>
          Configuration
        </h3>
        <AgentEditor
          defaultValues={defaultValues}
          onSubmit={handleSave}
          onCancel={() => refetch()}
          isLoading={mutating}
          submitLabel='Save Changes'
          showStatus
        />
      </div>

      {/* Delete dialog */}
      <AlertDialog
        open={showDeleteDialog}
        onOpenChange={open => !open && setShowDeleteDialog(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete{' '}
              <strong>{agent.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={mutating}
              className='bg-red-600 hover:bg-red-700'
            >
              {mutating ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
