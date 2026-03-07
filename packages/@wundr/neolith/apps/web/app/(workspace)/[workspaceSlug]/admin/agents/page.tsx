'use client';

import {
  Bot,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePageHeader } from '@/contexts/page-header-context';
import { useAgentMutations, useAgents } from '@/hooks/use-agents';
import { cn } from '@/lib/utils';
import { AGENT_TYPE_METADATA } from '@/types/agent';

import type { Agent, AgentStatus, AgentType } from '@/types/agent';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<AgentStatus, string> = {
  active:
    'bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400',
  paused:
    'bg-yellow-500/10 text-yellow-600 border-yellow-500/20 dark:text-yellow-400',
  inactive: 'bg-stone-500/10 text-stone-500 border-stone-500/20',
};

function getModelShortName(model: string): string {
  if (model.includes('opus')) {
    return 'Opus';
  }
  if (model.includes('sonnet')) {
    return 'Sonnet';
  }
  if (model.includes('haiku')) {
    return 'Haiku';
  }
  return model;
}

const MODEL_BADGE_COLORS: Record<string, string> = {
  Opus: 'bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400',
  Sonnet: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400',
  Haiku:
    'bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminAgentsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceSlug = params.workspaceSlug as string;
  const { setPageHeader } = usePageHeader();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);

  const { agents, isLoading, refetch } = useAgents(workspaceSlug, {
    type: typeFilter !== 'all' ? (typeFilter as AgentType) : undefined,
    status: statusFilter !== 'all' ? (statusFilter as AgentStatus) : undefined,
    search: searchQuery || undefined,
  });

  const {
    deleteAgent,
    pauseAgent,
    resumeAgent,
    isLoading: mutating,
  } = useAgentMutations(workspaceSlug);

  useEffect(() => {
    setPageHeader(
      'Agent Registry',
      'View and manage AI agents defined in this workspace'
    );
  }, [setPageHeader]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }
    const success = await deleteAgent(deleteTarget.id);
    if (success) {
      toast.success(`Agent "${deleteTarget.name}" deleted`);
      refetch();
    } else {
      toast.error('Failed to delete agent');
    }
    setDeleteTarget(null);
  }, [deleteTarget, deleteAgent, refetch]);

  const handlePause = useCallback(
    async (agent: Agent) => {
      const result = await pauseAgent(agent.id);
      if (result) {
        toast.success(`Agent "${agent.name}" paused`);
        refetch();
      } else {
        toast.error('Failed to pause agent');
      }
    },
    [pauseAgent, refetch]
  );

  const handleResume = useCallback(
    async (agent: Agent) => {
      const result = await resumeAgent(agent.id);
      if (result) {
        toast.success(`Agent "${agent.name}" resumed`);
        refetch();
      } else {
        toast.error('Failed to resume agent');
      }
    },
    [resumeAgent, refetch]
  );

  const clearFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setStatusFilter('all');
  };

  const hasActiveFilters =
    searchQuery || typeFilter !== 'all' || statusFilter !== 'all';

  return (
    <div className='space-y-4'>
      {/* Toolbar */}
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex flex-wrap items-center gap-2'>
          {/* Search */}
          <div className='relative w-64'>
            <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              placeholder='Search agents...'
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className='pl-9'
            />
          </div>

          {/* Type filter */}
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className='w-36'>
              <SelectValue placeholder='Type' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Types</SelectItem>
              {(
                [
                  'task',
                  'research',
                  'coding',
                  'data',
                  'qa',
                  'support',
                  'custom',
                ] as AgentType[]
              ).map(t => (
                <SelectItem key={t} value={t}>
                  {AGENT_TYPE_METADATA[t].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className='w-32'>
              <SelectValue placeholder='Status' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Status</SelectItem>
              <SelectItem value='active'>Active</SelectItem>
              <SelectItem value='paused'>Paused</SelectItem>
              <SelectItem value='inactive'>Inactive</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant='ghost'
              size='sm'
              onClick={clearFilters}
              className='gap-1 text-muted-foreground'
            >
              <X className='h-3.5 w-3.5' />
              Clear
            </Button>
          )}
        </div>

        {/* Create button */}
        <Link href={`/${workspaceSlug}/admin/agents/new`}>
          <Button size='sm'>
            <Plus className='mr-2 h-4 w-4' />
            New Agent
          </Button>
        </Link>
      </div>

      {/* Table */}
      <div className='rounded-lg border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Tools</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tasks</TableHead>
              <TableHead className='w-14 text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className='h-7 w-full' />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : agents.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className='py-12 text-center text-sm text-muted-foreground'
                >
                  <div className='flex flex-col items-center gap-3'>
                    <Bot className='h-8 w-8 text-muted-foreground/50' />
                    <p>
                      {hasActiveFilters
                        ? 'No agents match the current filters.'
                        : 'No agents yet. Create your first agent.'}
                    </p>
                    {!hasActiveFilters && (
                      <Link href={`/${workspaceSlug}/admin/agents/new`}>
                        <Button size='sm'>
                          <Plus className='mr-2 h-4 w-4' />
                          New Agent
                        </Button>
                      </Link>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              agents.map(agent => {
                const meta = AGENT_TYPE_METADATA[agent.type];
                const modelShort = getModelShortName(agent.config.model);

                return (
                  <TableRow
                    key={agent.id}
                    className='cursor-pointer hover:bg-accent/50'
                    onClick={() =>
                      router.push(`/${workspaceSlug}/admin/agents/${agent.id}`)
                    }
                  >
                    {/* Name */}
                    <TableCell>
                      <div className='flex items-center gap-2'>
                        <span className='text-base'>{meta?.icon}</span>
                        <span className='font-medium'>{agent.name}</span>
                      </div>
                      {agent.description && (
                        <p className='mt-0.5 line-clamp-1 text-xs text-muted-foreground'>
                          {agent.description}
                        </p>
                      )}
                    </TableCell>

                    {/* Type */}
                    <TableCell>
                      <span className='text-sm text-muted-foreground'>
                        {meta?.label ?? agent.type}
                      </span>
                    </TableCell>

                    {/* Model */}
                    <TableCell>
                      <Badge
                        variant='outline'
                        className={cn(
                          'text-xs',
                          MODEL_BADGE_COLORS[modelShort] ??
                            'text-muted-foreground'
                        )}
                      >
                        {modelShort}
                      </Badge>
                    </TableCell>

                    {/* Tools */}
                    <TableCell>
                      <span className='text-sm text-muted-foreground'>
                        {agent.tools.length > 0
                          ? `${agent.tools.length} tool${agent.tools.length !== 1 ? 's' : ''}`
                          : '—'}
                      </span>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <Badge
                        variant='outline'
                        className={cn('text-xs', STATUS_COLORS[agent.status])}
                      >
                        {agent.status.charAt(0).toUpperCase() +
                          agent.status.slice(1)}
                      </Badge>
                    </TableCell>

                    {/* Tasks completed */}
                    <TableCell>
                      <span className='tabular-nums text-sm text-muted-foreground'>
                        {agent.stats.tasksCompleted}
                      </span>
                    </TableCell>

                    {/* Actions – stop row click propagation */}
                    <TableCell
                      className='text-right'
                      onClick={e => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant='ghost' className='h-8 w-8 p-0'>
                            <span className='sr-only'>Open menu</span>
                            <MoreHorizontal className='h-4 w-4' />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end'>
                          <DropdownMenuItem
                            onClick={() =>
                              router.push(
                                `/${workspaceSlug}/admin/agents/${agent.id}`
                              )
                            }
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {agent.status === 'active' ? (
                            <DropdownMenuItem
                              onClick={() => handlePause(agent)}
                            >
                              <Pause className='mr-2 h-4 w-4' />
                              Pause
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => handleResume(agent)}
                            >
                              <Play className='mr-2 h-4 w-4' />
                              Resume
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className='text-red-600 focus:text-red-600'
                            onClick={() => setDeleteTarget(agent)}
                          >
                            <Trash2 className='mr-2 h-4 w-4' />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary */}
      {!isLoading && agents.length > 0 && (
        <p className='text-sm text-muted-foreground'>
          {agents.length} agent{agents.length !== 1 ? 's' : ''}
          {hasActiveFilters ? ' matching filters' : ' total'}
        </p>
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <strong>{deleteTarget?.name}</strong>? This action cannot be
              undone.
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
