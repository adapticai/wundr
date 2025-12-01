/**
 * Subagent List Component
 *
 * Displays a list of Subagents for a Session Manager with capabilities and status.
 */

'use client';

import {
  Plus,
  Settings,
  Play,
  Pause,
  Wrench,
  Globe,
  Building,
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

interface Subagent {
  id: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PAUSED' | 'ERROR';
  isGlobal: boolean;
  scope: 'UNIVERSAL' | 'DISCIPLINE' | 'WORKSPACE' | 'PRIVATE';
  tier: number;
  capabilities: string[];
  mcpTools: string[];
  worktreeRequirement: 'none' | 'read' | 'write';
  createdAt: string;
}

interface SubagentListProps {
  sessionManagerId?: string;
  showUniversal?: boolean;
  onSelect?: (subagent: Subagent) => void;
  onCreateNew?: () => void;
}

const statusColors = {
  ACTIVE: 'bg-green-500',
  INACTIVE: 'bg-gray-400',
  PAUSED: 'bg-yellow-500',
  ERROR: 'bg-red-500',
};

const scopeIcons = {
  UNIVERSAL: Globe,
  DISCIPLINE: Building,
  WORKSPACE: Building,
  PRIVATE: Wrench,
};

export function SubagentList({
  sessionManagerId,
  showUniversal,
  onSelect,
  onCreateNew,
}: SubagentListProps) {
  const [subagents, setSubagents] = useState<Subagent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubagents = useCallback(async () => {
    try {
      setLoading(true);
      const url = showUniversal
        ? '/api/subagents/universal'
        : `/api/session-managers/${sessionManagerId}/subagents`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch subagents');
      }
      const { data } = await response.json();
      setSubagents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [sessionManagerId, showUniversal]);

  useEffect(() => {
    fetchSubagents();
  }, [fetchSubagents]);

  async function toggleStatus(id: string, currentStatus: string) {
    const action = currentStatus === 'ACTIVE' ? 'deactivate' : 'activate';
    try {
      await fetch(`/api/subagents/${id}/${action}`, { method: 'POST' });
      fetchSubagents();
    } catch (err) {
      console.error(`Failed to ${action} subagent:`, err);
    }
  }

  if (loading) {
    return (
      <div className='grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3'>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <Skeleton key={i} className='h-32 w-full' />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className='border-red-200 bg-red-50'>
        <CardContent className='pt-6'>
          <p className='text-red-600'>Error: {error}</p>
          <Button variant='outline' onClick={fetchSubagents} className='mt-2'>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='space-y-4'>
      <div className='flex justify-between items-center'>
        <h2 className='text-lg font-semibold'>
          {showUniversal ? 'Universal Subagents' : 'Subagents'}
        </h2>
        {!showUniversal && (
          <Button onClick={onCreateNew} size='sm'>
            <Plus className='h-4 w-4 mr-2' />
            New Subagent
          </Button>
        )}
      </div>

      {subagents.length === 0 ? (
        <Card>
          <CardContent className='pt-6 text-center text-muted-foreground'>
            No subagents yet. Create specialized workers to assist with tasks.
          </CardContent>
        </Card>
      ) : (
        <div className='grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3'>
          {subagents.map(sa => {
            const ScopeIcon = scopeIcons[sa.scope];
            return (
              <Card
                key={sa.id}
                className='cursor-pointer hover:border-primary/50 transition-colors'
                onClick={() => onSelect?.(sa)}
              >
                <CardHeader className='pb-2'>
                  <div className='flex justify-between items-start'>
                    <div>
                      <CardTitle className='text-base flex items-center gap-2'>
                        {sa.name}
                        <Badge variant='secondary' className='text-xs'>
                          Tier {sa.tier}
                        </Badge>
                      </CardTitle>
                      <CardDescription className='line-clamp-1'>
                        {sa.description}
                      </CardDescription>
                    </div>
                    <div
                      className={`h-3 w-3 rounded-full ${statusColors[sa.status]}`}
                      title={sa.status}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className='space-y-2'>
                    <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                      <ScopeIcon className='h-4 w-4' />
                      <span>{sa.scope}</span>
                      {sa.isGlobal && (
                        <Badge variant='outline' className='text-xs'>
                          Global
                        </Badge>
                      )}
                    </div>
                    <div className='flex flex-wrap gap-1'>
                      {sa.mcpTools.slice(0, 3).map(tool => (
                        <Badge key={tool} variant='outline' className='text-xs'>
                          {tool}
                        </Badge>
                      ))}
                      {sa.mcpTools.length > 3 && (
                        <Badge variant='outline' className='text-xs'>
                          +{sa.mcpTools.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div
                    className='flex justify-end gap-2 mt-3'
                    onClick={e => e.stopPropagation()}
                  >
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={() => toggleStatus(sa.id, sa.status)}
                    >
                      {sa.status === 'ACTIVE' ? (
                        <Pause className='h-4 w-4' />
                      ) : (
                        <Play className='h-4 w-4' />
                      )}
                    </Button>
                    <Button variant='ghost' size='icon'>
                      <Settings className='h-4 w-4' />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SubagentList;
