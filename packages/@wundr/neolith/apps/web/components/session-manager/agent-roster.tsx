/**
 * Agent Roster Component
 *
 * Displays a grid or list of sub-agents assigned to a session manager.
 * Each agent shows name, type, capabilities, and status.
 */
'use client';

import {
  Globe,
  Building2,
  Lock,
  Wrench,
  AlertCircle,
  Cpu,
  Play,
  Pause,
  CheckCircle2,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Agent {
  id: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PAUSED' | 'ERROR';
  isGlobal: boolean;
  scope: 'UNIVERSAL' | 'DISCIPLINE' | 'WORKSPACE' | 'PRIVATE';
  tier: number;
  capabilities: string[];
  mcpTools: string[];
  worktreeRequirement: string;
}

interface AgentRosterProps {
  sessionManagerId: string;
  className?: string;
}

const STATUS_DOT: Record<string, string> = {
  ACTIVE: 'bg-green-500',
  INACTIVE: 'bg-gray-400',
  PAUSED: 'bg-yellow-500',
  ERROR: 'bg-red-500',
};

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  ACTIVE: {
    label: 'Active',
    className: 'text-green-700 bg-green-50 border-green-200',
  },
  INACTIVE: {
    label: 'Idle',
    className: 'text-gray-600 bg-gray-50 border-gray-200',
  },
  PAUSED: {
    label: 'Paused',
    className: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  },
  ERROR: {
    label: 'Error',
    className: 'text-red-700 bg-red-50 border-red-200',
  },
};

const SCOPE_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  UNIVERSAL: Globe,
  DISCIPLINE: Building2,
  WORKSPACE: Building2,
  PRIVATE: Lock,
};

function AgentCard({
  agent,
  onToggleStatus,
}: {
  agent: Agent;
  onToggleStatus?: (id: string, currentStatus: string) => void;
}) {
  const ScopeIcon = SCOPE_ICONS[agent.scope] ?? Wrench;
  const statusConfig = STATUS_LABEL[agent.status] ?? STATUS_LABEL.INACTIVE;

  const visibleCapabilities = agent.capabilities.slice(0, 3);
  const extraCapabilities = agent.capabilities.length - 3;

  const visibleTools = agent.mcpTools.slice(0, 2);
  const extraTools = agent.mcpTools.length - 2;

  return (
    <Card className='flex flex-col'>
      <CardHeader className='pb-2'>
        <div className='flex items-start justify-between gap-2'>
          <div className='flex items-center gap-2 min-w-0'>
            <div className='flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-muted'>
              <Cpu className='h-4 w-4 text-muted-foreground' />
            </div>
            <div className='min-w-0'>
              <CardTitle className='text-sm truncate'>{agent.name}</CardTitle>
              {agent.description && (
                <CardDescription className='text-xs line-clamp-1 mt-0.5'>
                  {agent.description}
                </CardDescription>
              )}
            </div>
          </div>
          <div className='flex items-center gap-1.5 flex-shrink-0'>
            <span
              className={cn(
                'inline-block h-2 w-2 rounded-full',
                STATUS_DOT[agent.status] ?? 'bg-gray-400'
              )}
              title={agent.status}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className='flex-1 pt-0 space-y-2.5'>
        {/* Status + Tier + Scope */}
        <div className='flex flex-wrap gap-1'>
          <Badge className={cn('text-xs border', statusConfig.className)}>
            {statusConfig.label}
          </Badge>
          <Badge variant='secondary' className='text-xs gap-1'>
            <ScopeIcon className='h-3 w-3' />
            {agent.scope}
          </Badge>
          <Badge variant='outline' className='text-xs'>
            Tier {agent.tier}
          </Badge>
        </div>

        {/* Capabilities */}
        {agent.capabilities.length > 0 && (
          <div>
            <p className='text-xs text-muted-foreground mb-1 font-medium'>
              Capabilities
            </p>
            <div className='flex flex-wrap gap-1'>
              {visibleCapabilities.map(cap => (
                <Badge key={cap} variant='outline' className='text-xs py-0'>
                  <CheckCircle2 className='h-2.5 w-2.5 mr-1 text-green-500' />
                  {cap}
                </Badge>
              ))}
              {extraCapabilities > 0 && (
                <Badge variant='outline' className='text-xs py-0'>
                  +{extraCapabilities} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* MCP Tools */}
        {agent.mcpTools.length > 0 && (
          <div>
            <p className='text-xs text-muted-foreground mb-1 font-medium'>
              MCP Tools
            </p>
            <div className='flex flex-wrap gap-1'>
              {visibleTools.map(tool => (
                <Badge
                  key={tool}
                  variant='secondary'
                  className='text-xs py-0 font-mono'
                >
                  {tool}
                </Badge>
              ))}
              {extraTools > 0 && (
                <Badge variant='secondary' className='text-xs py-0'>
                  +{extraTools}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Worktree requirement */}
        {agent.worktreeRequirement !== 'none' && (
          <p className='text-xs text-muted-foreground'>
            Worktree:{' '}
            <span className='font-medium capitalize'>
              {agent.worktreeRequirement}
            </span>{' '}
            access
          </p>
        )}

        {/* Toggle action */}
        {onToggleStatus && (
          <div className='pt-1'>
            <Button
              variant='ghost'
              size='sm'
              className='h-7 w-full text-xs'
              onClick={() => onToggleStatus(agent.id, agent.status)}
            >
              {agent.status === 'ACTIVE' ? (
                <>
                  <Pause className='h-3.5 w-3.5 mr-1.5' />
                  Deactivate
                </>
              ) : (
                <>
                  <Play className='h-3.5 w-3.5 mr-1.5' />
                  Activate
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AgentRoster({ sessionManagerId, className }: AgentRosterProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/session-managers/${sessionManagerId}/subagents`
      );
      if (!res.ok) {
        throw new Error('Failed to fetch agents');
      }
      const { data } = await res.json();
      setAgents(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [sessionManagerId]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleToggleStatus = useCallback(
    async (id: string, currentStatus: string) => {
      const action = currentStatus === 'ACTIVE' ? 'deactivate' : 'activate';
      try {
        await fetch(`/api/subagents/${id}/${action}`, { method: 'POST' });
        await fetchAgents();
      } catch (err) {
        console.error(`Failed to ${action} agent:`, err);
      }
    },
    [fetchAgents]
  );

  if (loading) {
    return (
      <div
        className={cn(
          'grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
          className
        )}
      >
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className='h-44 w-full' />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4',
          className
        )}
      >
        <AlertCircle className='h-5 w-5 text-red-500 flex-shrink-0' />
        <div className='flex-1'>
          <p className='text-sm font-medium text-red-800'>
            Failed to load agents
          </p>
          <p className='text-xs text-red-600 mt-0.5'>{error}</p>
        </div>
        <Button variant='outline' size='sm' onClick={fetchAgents}>
          Retry
        </Button>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center',
          className
        )}
      >
        <Cpu className='h-10 w-10 text-muted-foreground mb-3' />
        <p className='text-sm font-medium'>No agents assigned</p>
        <p className='text-xs text-muted-foreground mt-1'>
          This session manager has no sub-agents yet.
        </p>
      </div>
    );
  }

  const activeCount = agents.filter(a => a.status === 'ACTIVE').length;

  return (
    <div className={cn('space-y-4', className)}>
      <div className='flex items-center justify-between'>
        <p className='text-sm text-muted-foreground'>
          {agents.length} agent{agents.length !== 1 ? 's' : ''} —{' '}
          <span className='text-green-600 font-medium'>
            {activeCount} active
          </span>
        </p>
      </div>
      <div className='grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3'>
        {agents.map(agent => (
          <AgentCard
            key={agent.id}
            agent={agent}
            onToggleStatus={handleToggleStatus}
          />
        ))}
      </div>
    </div>
  );
}

export default AgentRoster;
