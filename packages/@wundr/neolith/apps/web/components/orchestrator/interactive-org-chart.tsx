'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface OrgChartNode {
  id: string;
  name: string;
  title: string;
  discipline: string;
  role: string;
  status: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'AWAY';
  avatarUrl?: string;
  children: OrgChartNode[];
  sessionManagers?: { id: string; name: string; status: string }[];
  metrics?: {
    tasksCompleted: number;
    activeTasks: number;
    messagesRouted: number;
  };
}

export interface InteractiveOrgChartProps {
  workspaceId: string;
  onNodeClick?: (node: OrgChartNode) => void;
  className?: string;
}

const STATUS_STYLES: Record<OrgChartNode['status'], string> = {
  ONLINE: 'bg-green-500',
  BUSY: 'bg-yellow-500',
  OFFLINE: 'bg-stone-400',
  AWAY: 'bg-blue-500',
};

const STATUS_BADGE_VARIANTS: Record<
  OrgChartNode['status'],
  'default' | 'secondary' | 'outline'
> = {
  ONLINE: 'default',
  BUSY: 'secondary',
  OFFLINE: 'outline',
  AWAY: 'secondary',
};

function StatusDot({ status }: { status: OrgChartNode['status'] }) {
  return (
    <span
      className={cn('inline-block h-2.5 w-2.5 rounded-full flex-shrink-0', STATUS_STYLES[status])}
    />
  );
}

function NodeHoverCard({ node }: { node: OrgChartNode }) {
  return (
    <Card className='absolute z-20 w-64 shadow-lg top-full left-1/2 -translate-x-1/2 mt-2'>
      <CardContent className='p-4 space-y-3'>
        <div className='flex items-center gap-2'>
          <StatusDot status={node.status} />
          <span className='font-semibold text-sm truncate'>{node.name}</span>
        </div>
        <div className='space-y-1 text-xs text-muted-foreground'>
          <div>
            <span className='font-medium text-foreground'>Role: </span>
            {node.role}
          </div>
          <div>
            <span className='font-medium text-foreground'>Discipline: </span>
            {node.discipline}
          </div>
          <div className='flex items-center gap-1.5'>
            <span className='font-medium text-foreground'>Status: </span>
            <Badge variant={STATUS_BADGE_VARIANTS[node.status]} className='text-xs py-0'>
              {node.status}
            </Badge>
          </div>
        </div>
        {node.metrics && (
          <div className='border-t pt-2 grid grid-cols-3 gap-1 text-center'>
            <div>
              <div className='text-sm font-bold'>{node.metrics.tasksCompleted}</div>
              <div className='text-xs text-muted-foreground'>Done</div>
            </div>
            <div>
              <div className='text-sm font-bold'>{node.metrics.activeTasks}</div>
              <div className='text-xs text-muted-foreground'>Active</div>
            </div>
            <div>
              <div className='text-sm font-bold'>{node.metrics.messagesRouted}</div>
              <div className='text-xs text-muted-foreground'>Msgs</div>
            </div>
          </div>
        )}
        {node.sessionManagers && node.sessionManagers.length > 0 && (
          <div className='border-t pt-2'>
            <div className='text-xs font-medium text-muted-foreground mb-1'>
              Session Managers ({node.sessionManagers.length})
            </div>
            <div className='space-y-0.5'>
              {node.sessionManagers.slice(0, 3).map(sm => (
                <div key={sm.id} className='flex items-center gap-1.5 text-xs'>
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full flex-shrink-0',
                      sm.status === 'ONLINE' ? 'bg-green-500' : 'bg-stone-400'
                    )}
                  />
                  <span className='truncate'>{sm.name}</span>
                </div>
              ))}
              {node.sessionManagers.length > 3 && (
                <div className='text-xs text-muted-foreground'>
                  +{node.sessionManagers.length - 3} more
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OrgChartNodeCard({
  node,
  onNodeClick,
  depth = 0,
}: {
  node: OrgChartNode;
  onNodeClick?: (node: OrgChartNode) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const [hovered, setHovered] = useState(false);
  const hasChildren = node.children.length > 0;

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setExpanded(prev => !prev);
    },
    []
  );

  const handleClick = useCallback(() => {
    onNodeClick?.(node);
  }, [node, onNodeClick]);

  return (
    <div className='flex flex-col items-center'>
      <div className='relative'>
        <div
          role='button'
          tabIndex={0}
          aria-expanded={hasChildren ? expanded : undefined}
          className={cn(
            'relative flex items-center gap-2 rounded-lg border bg-card px-4 py-3 cursor-pointer',
            'transition-colors hover:bg-accent hover:text-accent-foreground',
            'min-w-[160px] max-w-[200px]',
            depth === 0 && 'border-primary bg-primary/5'
          )}
          onClick={handleClick}
          onKeyDown={e => e.key === 'Enter' && handleClick()}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <StatusDot status={node.status} />
          <div className='flex-1 min-w-0'>
            <div className='text-sm font-semibold truncate'>{node.name}</div>
            <div className='text-xs text-muted-foreground truncate'>{node.title}</div>
          </div>
          {hasChildren && (
            <Button
              variant='ghost'
              size='icon'
              className='h-5 w-5 flex-shrink-0 -mr-1'
              onClick={handleToggle}
              tabIndex={-1}
            >
              {expanded ? (
                <ChevronDown className='h-3 w-3' />
              ) : (
                <ChevronRight className='h-3 w-3' />
              )}
            </Button>
          )}
        </div>
        {hovered && <NodeHoverCard node={node} />}
      </div>

      {hasChildren && expanded && (
        <>
          {/* Vertical connector from parent to horizontal bar */}
          <div className='h-6 w-px bg-border' />
          <div className='flex items-start gap-6'>
            {node.children.map((child, idx) => (
              <div key={child.id} className='flex flex-col items-center relative'>
                {/* Horizontal connector dots */}
                {node.children.length > 1 && (
                  <div
                    className={cn(
                      'absolute top-0 h-px bg-border',
                      idx === 0 && 'left-1/2 right-0',
                      idx === node.children.length - 1 && 'left-0 right-1/2',
                      idx > 0 && idx < node.children.length - 1 && 'left-0 right-0'
                    )}
                  />
                )}
                {/* Vertical connector to child */}
                <div className='h-6 w-px bg-border' />
                <OrgChartNodeCard
                  node={child}
                  onNodeClick={onNodeClick}
                  depth={depth + 1}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function InteractiveOrgChart({
  workspaceId,
  onNodeClick,
  className,
}: InteractiveOrgChartProps) {
  const [nodes, setNodes] = useState<OrgChartNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/orchestrators`);
        if (!res.ok) throw new Error('Failed to fetch orchestrators');
        const data = await res.json();

        if (!cancelled) {
          const orchestrators: OrgChartNode[] = (data.orchestrators ?? []).map(
            (o: any) => ({
              id: o.id,
              name: o.title ?? o.name ?? 'Untitled',
              title: o.description ?? 'Orchestrator',
              discipline: o.discipline ?? 'General',
              role: o.role ?? 'Orchestrator',
              status: o.status ?? 'OFFLINE',
              avatarUrl: o.avatarUrl,
              children: (o.sessionManagers ?? []).map((sm: any) => ({
                id: sm.id,
                name: sm.name,
                title: 'Session Manager',
                discipline: o.discipline ?? 'General',
                role: 'Session Manager',
                status: sm.status ?? 'OFFLINE',
                children: [],
              })),
              sessionManagers: o.sessionManagers,
              metrics: o.metrics,
            })
          );
          setNodes(orchestrators);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'An error occurred');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (workspaceId) fetchData();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const totalSessionManagers = nodes.reduce(
    (sum, n) => sum + (n.sessionManagers?.length ?? n.children.length),
    0
  );
  const onlineCount = nodes.filter(n => n.status === 'ONLINE').length;

  const root: OrgChartNode = {
    id: '__root__',
    name: 'Organization',
    title: 'Root',
    discipline: '',
    role: 'Root',
    status: 'ONLINE',
    children: nodes,
  };

  if (loading) {
    return (
      <div className={cn('flex min-h-[300px] items-center justify-center', className)}>
        <div className='h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent' />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('rounded-lg border border-destructive p-6 text-center', className)}>
        <p className='text-sm text-destructive'>{error}</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div className='overflow-x-auto pb-4'>
        <div className='flex flex-col items-center min-w-max px-8 pt-4'>
          <OrgChartNodeCard node={root} onNodeClick={onNodeClick} depth={0} />
        </div>
      </div>

      {/* Summary stats bar */}
      <div className='grid grid-cols-3 gap-4 rounded-lg border bg-muted/50 p-4'>
        <div className='text-center'>
          <div className='text-2xl font-bold text-primary'>{nodes.length}</div>
          <div className='text-xs text-muted-foreground'>Total Orchestrators</div>
        </div>
        <div className='text-center'>
          <div className='text-2xl font-bold text-green-600 dark:text-green-400'>
            {onlineCount}
          </div>
          <div className='text-xs text-muted-foreground'>Online</div>
        </div>
        <div className='text-center'>
          <div className='text-2xl font-bold text-primary'>{totalSessionManagers}</div>
          <div className='text-xs text-muted-foreground'>Session Managers</div>
        </div>
      </div>
    </div>
  );
}

export default InteractiveOrgChart;
