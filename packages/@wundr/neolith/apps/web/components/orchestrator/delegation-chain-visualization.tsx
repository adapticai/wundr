/**
 * Delegation Chain Visualization Component
 *
 * Displays the delegation chain/tree for tasks across orchestrators,
 * showing who delegated what to whom in a visual hierarchical tree layout.
 *
 * @module components/orchestrator/delegation-chain-visualization
 */
'use client';

import {
  AlertCircle,
  ArrowDown,
  Bot,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  GitBranch,
  RefreshCw,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DelegationNode {
  id: string;
  orchestratorId: string;
  orchestratorTitle: string;
  discipline?: string;
  taskId: string;
  taskTitle: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'escalated';
  delegatedAt: string;
  completedAt?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  children: DelegationNode[];
  depth: number;
}

export interface DelegationChainVisualizationProps {
  workspaceId: string;
  taskId?: string;
  orchestratorId?: string;
  maxDepth?: number;
  className?: string;
}

// ─── Config Maps ──────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    dotColor: 'bg-gray-400',
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    dotColor: 'bg-blue-500',
  },
  completed: {
    label: 'Completed',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    dotColor: 'bg-green-500',
  },
  failed: {
    label: 'Failed',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    dotColor: 'bg-red-500',
  },
  escalated: {
    label: 'Escalated',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    dotColor: 'bg-orange-500',
  },
} satisfies Record<
  DelegationNode['status'],
  { label: string; color: string; bgColor: string; dotColor: string }
>;

const PRIORITY_CONFIG = {
  low: {
    label: 'Low',
    color: 'text-gray-600',
    borderColor: 'border-gray-300',
  },
  normal: {
    label: 'Normal',
    color: 'text-blue-600',
    borderColor: 'border-blue-300',
  },
  high: {
    label: 'High',
    color: 'text-orange-600',
    borderColor: 'border-orange-300',
  },
  critical: {
    label: 'Critical',
    color: 'text-red-600',
    borderColor: 'border-red-300',
  },
} satisfies Record<
  NonNullable<DelegationNode['priority']>,
  { label: string; color: string; borderColor: string }
>;

// Stable hue list so each orchestrator always gets the same color ring.
const AVATAR_COLORS = [
  'bg-violet-500',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-indigo-500',
  'bg-pink-500',
];

function avatarColorFor(orchestratorId: string): string {
  let hash = 0;
  for (let i = 0; i < orchestratorId.length; i++) {
    hash = (hash * 31 + orchestratorId.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initials(title: string): string {
  const words = title.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function computeStats(roots: DelegationNode[]): {
  total: number;
  maxDepth: number;
  completed: number;
} {
  let total = 0;
  let maxDepth = 0;
  let completed = 0;

  function walk(node: DelegationNode) {
    total++;
    if (node.depth > maxDepth) maxDepth = node.depth;
    if (node.status === 'completed') completed++;
    node.children.forEach(walk);
  }

  roots.forEach(walk);
  return { total, maxDepth, completed };
}

// ─── Tree Builder ─────────────────────────────────────────────────────────────

interface RawDelegation {
  id: string;
  taskId: string;
  taskTitle?: string;
  fromOrchestratorId: string;
  fromOrchestratorTitle: string;
  toOrchestratorId: string;
  toOrchestratorTitle: string;
  discipline?: string;
  delegatedAt: string;
  completedAt?: string;
  priority?: string;
  status?: string;
}

function buildTree(
  delegations: RawDelegation[],
  maxDepth: number
): DelegationNode[] {
  // Map each delegation to a node keyed by id
  const nodeMap = new Map<string, DelegationNode>();

  for (const d of delegations) {
    const status = (
      ['pending', 'in_progress', 'completed', 'failed', 'escalated'].includes(
        d.status ?? ''
      )
        ? d.status
        : 'pending'
    ) as DelegationNode['status'];

    const priority = (
      ['low', 'normal', 'high', 'critical'].includes(d.priority ?? '')
        ? d.priority
        : undefined
    ) as DelegationNode['priority'];

    nodeMap.set(d.id, {
      id: d.id,
      orchestratorId: d.toOrchestratorId,
      orchestratorTitle: d.toOrchestratorTitle,
      discipline: d.discipline,
      taskId: d.taskId,
      taskTitle: d.taskTitle ?? d.taskId,
      status,
      delegatedAt: d.delegatedAt,
      completedAt: d.completedAt,
      priority,
      children: [],
      depth: 0,
    });
  }

  // Build parent → children relationship using fromOrchestratorId/toOrchestratorId
  // Strategy: a delegation D2 is a child of D1 when D1.toOrchestratorId === D2.fromOrchestratorId
  // and they share the same taskId (or D2 taskId is within the same chain).
  const childIds = new Set<string>();

  for (const d of delegations) {
    for (const other of delegations) {
      if (
        other.id !== d.id &&
        other.fromOrchestratorId === d.toOrchestratorId &&
        other.taskId === d.taskId
      ) {
        const parentNode = nodeMap.get(d.id);
        const childNode = nodeMap.get(other.id);
        if (parentNode && childNode) {
          parentNode.children.push(childNode);
          childIds.add(other.id);
        }
      }
    }
  }

  // Assign depths with BFS and enforce maxDepth pruning
  const roots: DelegationNode[] = [];
  for (const [id, node] of nodeMap.entries()) {
    if (!childIds.has(id)) {
      roots.push(node);
    }
  }

  function assignDepths(node: DelegationNode, depth: number) {
    node.depth = depth;
    if (depth >= maxDepth) {
      node.children = [];
      return;
    }
    node.children.forEach(c => assignDepths(c, depth + 1));
  }

  roots.forEach(r => assignDepths(r, 0));
  return roots;
}

// ─── DelegationNodeCard ───────────────────────────────────────────────────────

interface DelegationNodeCardProps {
  node: DelegationNode;
  isLast: boolean;
}

function DelegationNodeCard({ node, isLast }: DelegationNodeCardProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const statusCfg = STATUS_CONFIG[node.status];
  const priorityCfg = node.priority ? PRIORITY_CONFIG[node.priority] : null;
  const avatarColor = avatarColorFor(node.orchestratorId);

  return (
    <div className='flex gap-0'>
      {/* Vertical connector line column */}
      <div className='flex flex-col items-center w-6 shrink-0'>
        {/* Vertical line segment above the node (connects to parent) */}
        <div className='w-px flex-1 bg-border min-h-4' />
        {/* Horizontal elbow connecting to card */}
        <div className='w-3 h-px bg-border shrink-0' />
        {/* Vertical line continuing downward (only if not the last sibling) */}
        {!isLast ? (
          <div className='w-px flex-1 bg-border' />
        ) : (
          <div className='flex-1' />
        )}
      </div>

      {/* Node content */}
      <div className='flex-1 pb-3 min-w-0'>
        <div
          className={cn(
            'rounded-lg border bg-card transition-colors hover:bg-accent/40',
            node.status === 'failed' && 'border-red-200',
            node.status === 'escalated' && 'border-orange-200',
            node.status === 'completed' && 'border-green-200'
          )}
        >
          {/* Card header row */}
          <div className='flex items-start gap-3 p-3'>
            {/* Orchestrator avatar */}
            <div
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-full shrink-0 text-white text-xs font-semibold',
                avatarColor
              )}
            >
              {initials(node.orchestratorTitle)}
            </div>

            {/* Main info */}
            <div className='flex-1 min-w-0'>
              <div className='flex items-center gap-2 flex-wrap'>
                <span className='text-sm font-medium truncate'>
                  {node.orchestratorTitle}
                </span>
                {node.discipline && (
                  <Badge variant='outline' className='text-xs shrink-0'>
                    {node.discipline}
                  </Badge>
                )}
              </div>

              <p className='text-xs text-muted-foreground mt-0.5 truncate'>
                {node.taskTitle}
              </p>

              <div className='flex items-center gap-3 mt-1.5 flex-wrap'>
                {/* Status badge */}
                <Badge
                  className={cn(
                    statusCfg.bgColor,
                    statusCfg.color,
                    'text-xs gap-1'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block w-1.5 h-1.5 rounded-full',
                      statusCfg.dotColor
                    )}
                  />
                  {statusCfg.label}
                </Badge>

                {/* Priority badge */}
                {priorityCfg && (
                  <Badge
                    variant='outline'
                    className={cn(
                      'text-xs',
                      priorityCfg.color,
                      priorityCfg.borderColor
                    )}
                  >
                    {priorityCfg.label}
                  </Badge>
                )}

                {/* Timestamps */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className='flex items-center gap-1 text-xs text-muted-foreground cursor-default'>
                        <Clock className='h-3 w-3' />
                        {formatRelativeDate(node.delegatedAt)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        Delegated:{' '}
                        {new Date(node.delegatedAt).toLocaleString()}
                      </p>
                      {node.completedAt && (
                        <p>
                          Completed:{' '}
                          {new Date(node.completedAt).toLocaleString()}
                        </p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Completion icon */}
                {node.status === 'completed' && (
                  <CheckCircle className='h-3.5 w-3.5 text-green-600 shrink-0' />
                )}
                {node.status === 'failed' && (
                  <AlertCircle className='h-3.5 w-3.5 text-red-600 shrink-0' />
                )}
              </div>
            </div>

            {/* Expand/collapse toggle */}
            {hasChildren && (
              <Button
                variant='ghost'
                size='sm'
                className='h-6 w-6 p-0 shrink-0'
                onClick={() => setExpanded(prev => !prev)}
                aria-label={expanded ? 'Collapse branch' : 'Expand branch'}
              >
                {expanded ? (
                  <ChevronDown className='h-4 w-4' />
                ) : (
                  <ChevronRight className='h-4 w-4' />
                )}
              </Button>
            )}
          </div>

          {/* Child count pill when collapsed */}
          {!expanded && hasChildren && (
            <div className='px-3 pb-2'>
              <button
                className='text-xs text-muted-foreground hover:text-foreground transition-colors'
                onClick={() => setExpanded(true)}
              >
                {node.children.length} sub-delegation
                {node.children.length !== 1 ? 's' : ''} hidden
              </button>
            </div>
          )}
        </div>

        {/* Children tree */}
        {expanded && hasChildren && (
          <div className='mt-1 pl-2'>
            <DelegationTree nodes={node.children} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DelegationTree ───────────────────────────────────────────────────────────

interface DelegationTreeProps {
  nodes: DelegationNode[];
}

function DelegationTree({ nodes }: DelegationTreeProps) {
  return (
    <div className='relative flex flex-col'>
      {nodes.map((node, idx) => (
        <DelegationNodeCard
          key={node.id}
          node={node}
          isLast={idx === nodes.length - 1}
        />
      ))}
    </div>
  );
}

// ─── Root List (depth=0, no connector lines above) ────────────────────────────

interface RootNodeCardProps {
  node: DelegationNode;
}

function RootNodeCard({ node }: RootNodeCardProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const statusCfg = STATUS_CONFIG[node.status];
  const priorityCfg = node.priority ? PRIORITY_CONFIG[node.priority] : null;
  const avatarColor = avatarColorFor(node.orchestratorId);

  return (
    <div className='mb-3'>
      <div
        className={cn(
          'rounded-lg border bg-card transition-colors hover:bg-accent/40',
          node.status === 'failed' && 'border-red-200',
          node.status === 'escalated' && 'border-orange-200',
          node.status === 'completed' && 'border-green-200'
        )}
      >
        <div className='flex items-start gap-3 p-3'>
          {/* Root indicator + avatar */}
          <div className='flex flex-col items-center gap-1 shrink-0'>
            <Bot className='h-3.5 w-3.5 text-muted-foreground' />
            <div
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-semibold',
                avatarColor
              )}
            >
              {initials(node.orchestratorTitle)}
            </div>
          </div>

          {/* Main info */}
          <div className='flex-1 min-w-0'>
            <div className='flex items-center gap-2 flex-wrap'>
              <span className='text-sm font-semibold truncate'>
                {node.orchestratorTitle}
              </span>
              {node.discipline && (
                <Badge variant='outline' className='text-xs shrink-0'>
                  {node.discipline}
                </Badge>
              )}
            </div>

            <p className='text-xs text-muted-foreground mt-0.5 truncate'>
              {node.taskTitle}
            </p>

            <div className='flex items-center gap-3 mt-1.5 flex-wrap'>
              <Badge
                className={cn(
                  statusCfg.bgColor,
                  statusCfg.color,
                  'text-xs gap-1'
                )}
              >
                <span
                  className={cn(
                    'inline-block w-1.5 h-1.5 rounded-full',
                    statusCfg.dotColor
                  )}
                />
                {statusCfg.label}
              </Badge>

              {priorityCfg && (
                <Badge
                  variant='outline'
                  className={cn(
                    'text-xs',
                    priorityCfg.color,
                    priorityCfg.borderColor
                  )}
                >
                  {priorityCfg.label}
                </Badge>
              )}

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className='flex items-center gap-1 text-xs text-muted-foreground cursor-default'>
                      <Clock className='h-3 w-3' />
                      {formatRelativeDate(node.delegatedAt)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Delegated: {new Date(node.delegatedAt).toLocaleString()}
                    </p>
                    {node.completedAt && (
                      <p>
                        Completed:{' '}
                        {new Date(node.completedAt).toLocaleString()}
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {node.status === 'completed' && (
                <CheckCircle className='h-3.5 w-3.5 text-green-600 shrink-0' />
              )}
              {node.status === 'failed' && (
                <AlertCircle className='h-3.5 w-3.5 text-red-600 shrink-0' />
              )}
            </div>
          </div>

          {hasChildren && (
            <Button
              variant='ghost'
              size='sm'
              className='h-6 w-6 p-0 shrink-0'
              onClick={() => setExpanded(prev => !prev)}
              aria-label={expanded ? 'Collapse branch' : 'Expand branch'}
            >
              {expanded ? (
                <ChevronDown className='h-4 w-4' />
              ) : (
                <ChevronRight className='h-4 w-4' />
              )}
            </Button>
          )}
        </div>

        {!expanded && hasChildren && (
          <div className='px-3 pb-2'>
            <button
              className='text-xs text-muted-foreground hover:text-foreground transition-colors'
              onClick={() => setExpanded(true)}
            >
              {node.children.length} sub-delegation
              {node.children.length !== 1 ? 's' : ''} hidden
            </button>
          </div>
        )}
      </div>

      {/* Children with connector */}
      {expanded && hasChildren && (
        <div className='ml-4 mt-1 relative'>
          {/* Vertical stem from root card down */}
          <div className='absolute left-2 top-0 bottom-0 w-px bg-border' />
          <div className='pl-6'>
            {node.children.map((child, idx) => (
              <DelegationNodeCard
                key={child.id}
                node={child}
                isLast={idx === node.children.length - 1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

interface StatsBarProps {
  total: number;
  maxDepth: number;
  completionRate: number;
}

function StatsBar({ total, maxDepth, completionRate }: StatsBarProps) {
  return (
    <div className='grid grid-cols-3 gap-3 mb-4'>
      <div className='rounded-md border bg-muted/30 p-3 text-center'>
        <p className='text-2xl font-semibold tabular-nums'>{total}</p>
        <p className='text-xs text-muted-foreground mt-0.5'>
          Total Delegations
        </p>
      </div>
      <div className='rounded-md border bg-muted/30 p-3 text-center'>
        <p className='text-2xl font-semibold tabular-nums'>{maxDepth}</p>
        <p className='text-xs text-muted-foreground mt-0.5'>Chain Depth</p>
      </div>
      <div className='rounded-md border bg-muted/30 p-3 text-center'>
        <p className='text-2xl font-semibold tabular-nums'>
          {total === 0 ? '—' : `${Math.round(completionRate)}%`}
        </p>
        <p className='text-xs text-muted-foreground mt-0.5'>Completion Rate</p>
      </div>
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function StatusLegend() {
  return (
    <div className='flex flex-wrap gap-x-4 gap-y-1.5 mt-4 pt-3 border-t'>
      {(
        Object.entries(STATUS_CONFIG) as [
          DelegationNode['status'],
          (typeof STATUS_CONFIG)[DelegationNode['status']],
        ][]
      ).map(([key, cfg]) => (
        <span
          key={key}
          className='flex items-center gap-1.5 text-xs text-muted-foreground'
        >
          <span
            className={cn('inline-block w-2 h-2 rounded-full', cfg.dotColor)}
          />
          {cfg.label}
        </span>
      ))}
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className='space-y-3'>
      {/* Stats skeleton */}
      <div className='grid grid-cols-3 gap-3 mb-4'>
        {[1, 2, 3].map(i => (
          <div key={i} className='rounded-md border p-3 text-center space-y-1'>
            <Skeleton className='h-7 w-10 mx-auto' />
            <Skeleton className='h-3 w-16 mx-auto' />
          </div>
        ))}
      </div>
      {/* Tree skeleton */}
      {[1, 2, 3].map(i => (
        <div key={i} className='flex gap-3 items-start'>
          <Skeleton className='h-8 w-8 rounded-full shrink-0' />
          <div className='flex-1 space-y-2 border rounded-lg p-3'>
            <Skeleton className='h-4 w-2/5' />
            <Skeleton className='h-3 w-3/5' />
            <div className='flex gap-2'>
              <Skeleton className='h-5 w-16 rounded-full' />
              <Skeleton className='h-5 w-12 rounded-full' />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DelegationChainVisualization({
  workspaceId,
  taskId,
  orchestratorId,
  maxDepth = 5,
  className,
}: DelegationChainVisualizationProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [roots, setRoots] = useState<DelegationNode[]>([]);

  const fetchDelegations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (taskId) params.set('taskId', taskId);
      if (orchestratorId) params.set('orchestratorId', orchestratorId);

      const url = `/api/workspaces/${workspaceId}/delegations${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch delegations (${response.status} ${response.statusText})`
        );
      }

      const result = await response.json();
      const delegations: RawDelegation[] = result.data ?? result ?? [];
      const tree = buildTree(delegations, maxDepth);
      setRoots(tree);
    } catch (err) {
      const fetchError =
        err instanceof Error ? err : new Error('Failed to fetch delegations');
      setError(fetchError);
      console.error('[DelegationChainVisualization] Error:', fetchError);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, taskId, orchestratorId, maxDepth]);

  useEffect(() => {
    fetchDelegations();
  }, [fetchDelegations]);

  const stats = computeStats(roots);
  const completionRate =
    stats.total === 0 ? 0 : (stats.completed / stats.total) * 100;

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className='flex items-center justify-between gap-2'>
          <div className='flex items-center gap-2'>
            <GitBranch className='h-5 w-5 text-muted-foreground' />
            <CardTitle>Delegation Chain</CardTitle>
          </div>
          <Button
            variant='ghost'
            size='sm'
            onClick={fetchDelegations}
            disabled={isLoading}
            aria-label='Refresh delegation chain'
          >
            <RefreshCw
              className={cn('h-4 w-4', isLoading && 'animate-spin')}
            />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Loading state */}
        {isLoading && <LoadingSkeleton />}

        {/* Error state */}
        {!isLoading && error && (
          <div className='flex flex-col items-center justify-center py-10 text-center'>
            <AlertCircle className='h-8 w-8 text-red-500 mb-2' />
            <p className='text-sm font-medium text-red-700'>
              Failed to load delegation chain
            </p>
            <p className='text-xs text-muted-foreground mt-1 max-w-xs'>
              {error.message}
            </p>
            <Button
              variant='outline'
              size='sm'
              onClick={fetchDelegations}
              className='mt-3'
            >
              <RefreshCw className='h-4 w-4 mr-2' />
              Try Again
            </Button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && roots.length === 0 && (
          <div className='flex flex-col items-center justify-center py-12 text-center'>
            <ArrowDown className='h-12 w-12 text-muted-foreground/30 mb-4' />
            <p className='text-sm font-medium text-muted-foreground'>
              No delegations found
            </p>
            <p className='text-xs text-muted-foreground mt-1 max-w-xs'>
              {taskId
                ? 'No delegation chain exists for this task yet.'
                : orchestratorId
                  ? 'This orchestrator has not delegated any tasks yet.'
                  : 'Delegation chains will appear here once tasks are delegated across orchestrators.'}
            </p>
          </div>
        )}

        {/* Tree */}
        {!isLoading && !error && roots.length > 0 && (
          <>
            <StatsBar
              total={stats.total}
              maxDepth={stats.maxDepth}
              completionRate={completionRate}
            />

            <div className='space-y-0 overflow-x-auto'>
              {roots.map(root => (
                <RootNodeCard key={root.id} node={root} />
              ))}
            </div>

            <StatusLegend />
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default DelegationChainVisualization;
