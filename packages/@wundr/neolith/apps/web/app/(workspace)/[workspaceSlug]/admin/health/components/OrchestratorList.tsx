'use client';

import { formatDistanceToNow } from 'date-fns';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { OrchestratorHealthStatus } from '@neolith/core/types';

interface OrchestratorListProps {
  orchestrators: OrchestratorHealthStatus[];
}

const statusColors: Record<OrchestratorHealthStatus['status'], string> = {
  online: 'bg-green-500',
  offline: 'bg-gray-500',
  error: 'bg-red-500',
  degraded: 'bg-yellow-500',
};

const statusVariants: Record<
  OrchestratorHealthStatus['status'],
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  online: 'default',
  offline: 'secondary',
  error: 'destructive',
  degraded: 'outline',
};

export function OrchestratorList({ orchestrators }: OrchestratorListProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const filteredOrchestrators = orchestrators.filter(orch => {
    if (statusFilter === 'all') {
      return true;
    }
    return orch.status === statusFilter;
  });

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle>Orchestrators</CardTitle>
            <CardDescription>
              Health status of all orchestrator instances
            </CardDescription>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className='w-40'>
              <SelectValue placeholder='Filter by status' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Status</SelectItem>
              <SelectItem value='online'>Online</SelectItem>
              <SelectItem value='offline'>Offline</SelectItem>
              <SelectItem value='degraded'>Degraded</SelectItem>
              <SelectItem value='error'>Error</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-8'></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sessions</TableHead>
              <TableHead>Token Budget</TableHead>
              <TableHead>Last Activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrchestrators.map(orch => {
              const isExpanded = expandedRows.has(orch.id);
              return (
                <Collapsible key={orch.id} open={isExpanded} asChild>
                  <>
                    <TableRow
                      className='cursor-pointer'
                      onClick={() => toggleRow(orch.id)}
                    >
                      <TableCell>
                        <CollapsibleTrigger asChild>
                          <button className='p-0'>
                            {isExpanded ? (
                              <ChevronDown className='h-4 w-4' />
                            ) : (
                              <ChevronRight className='h-4 w-4' />
                            )}
                          </button>
                        </CollapsibleTrigger>
                      </TableCell>
                      <TableCell className='font-medium'>{orch.name}</TableCell>
                      <TableCell>
                        <div className='flex items-center space-x-2'>
                          <div
                            className={`h-2 w-2 rounded-full ${statusColors[orch.status]}`}
                          />
                          <Badge variant={statusVariants[orch.status]}>
                            {orch.status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>{orch.sessions}</TableCell>
                      <TableCell>
                        <div className='space-y-1'>
                          <div className='flex items-center justify-between text-xs'>
                            <span className='text-muted-foreground'>
                              {orch.tokenBudget.used.toLocaleString()} /{' '}
                              {orch.tokenBudget.limit.toLocaleString()}
                            </span>
                            <span
                              className={`font-medium ${
                                orch.tokenBudget.percent > 80
                                  ? 'text-red-600'
                                  : orch.tokenBudget.percent > 60
                                    ? 'text-yellow-600'
                                    : 'text-green-600'
                              }`}
                            >
                              {orch.tokenBudget.percent.toFixed(0)}%
                            </span>
                          </div>
                          <Progress
                            value={orch.tokenBudget.percent}
                            className='h-2'
                          />
                        </div>
                      </TableCell>
                      <TableCell className='text-sm text-muted-foreground'>
                        {formatDistanceToNow(new Date(orch.lastActivity), {
                          addSuffix: true,
                        })}
                      </TableCell>
                    </TableRow>
                    <CollapsibleContent asChild>
                      <TableRow>
                        <TableCell colSpan={6} className='bg-muted/50'>
                          <div className='grid gap-4 p-4 md:grid-cols-3'>
                            <div>
                              <p className='text-sm font-medium'>
                                Orchestrator ID
                              </p>
                              <p className='text-sm text-muted-foreground'>
                                {orch.id}
                              </p>
                            </div>
                            <div>
                              <p className='text-sm font-medium'>
                                Average Response Time
                              </p>
                              <p className='text-sm text-muted-foreground'>
                                {orch.responseTime}ms
                              </p>
                            </div>
                            <div>
                              <p className='text-sm font-medium'>Error Count</p>
                              <p
                                className={`text-sm font-medium ${
                                  orch.errorCount > 0
                                    ? 'text-red-600'
                                    : 'text-green-600'
                                }`}
                              >
                                {orch.errorCount}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              );
            })}
          </TableBody>
        </Table>
        {filteredOrchestrators.length === 0 && (
          <div className='py-8 text-center text-sm text-muted-foreground'>
            No orchestrators found with the selected filter.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
