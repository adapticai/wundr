'use client';

import * as React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type OrchestratorStatus = 'active' | 'idle' | 'error' | 'maintenance';

export interface OrchestratorData {
  id: string;
  name: string;
  status: OrchestratorStatus;
  sessions: number;
  tokenBudget: {
    used: number;
    total: number;
    percentage: number;
  };
  lastActivity: string;
  metadata?: {
    version?: string;
    uptime?: string;
    memoryUsage?: number;
    cpuUsage?: number;
  };
}

interface OrchestratorListProps {
  orchestrators: OrchestratorData[];
  className?: string;
}

type SortField = 'name' | 'status' | 'sessions' | 'budget' | 'lastActivity';
type SortDirection = 'asc' | 'desc';

const StatusBadge: React.FC<{ status: OrchestratorStatus }> = ({ status }) => {
  const variants: Record<
    OrchestratorStatus,
    {
      variant: 'default' | 'secondary' | 'destructive' | 'outline';
      label: string;
    }
  > = {
    active: { variant: 'default', label: 'Active' },
    idle: { variant: 'secondary', label: 'Idle' },
    error: { variant: 'destructive', label: 'Error' },
    maintenance: { variant: 'outline', label: 'Maintenance' },
  };

  const { variant, label } = variants[status];

  return (
    <Badge variant={variant} className='capitalize'>
      <span
        className={cn(
          'mr-1.5 h-2 w-2 rounded-full',
          status === 'active' && 'bg-green-500',
          status === 'idle' && 'bg-gray-400',
          status === 'error' && 'bg-red-500',
          status === 'maintenance' && 'bg-orange-500'
        )}
      />
      {label}
    </Badge>
  );
};

const TokenBudgetProgress: React.FC<{
  used: number;
  total: number;
  percentage: number;
}> = ({ used, total, percentage }) => {
  const getProgressColor = () => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className='space-y-1'>
      <div className='flex justify-between text-xs text-muted-foreground'>
        <span>{used.toLocaleString()} used</span>
        <span>{percentage.toFixed(1)}%</span>
      </div>
      <Progress value={percentage} className='h-2' />
      <style jsx>{`
        :global(.h-2 .bg-primary) {
          background-color: ${getProgressColor().replace('bg-', '')} !important;
        }
      `}</style>
    </div>
  );
};

export const OrchestratorList: React.FC<OrchestratorListProps> = ({
  orchestrators,
  className,
}) => {
  const [expandedRow, setExpandedRow] = React.useState<string | null>(null);
  const [sortField, setSortField] = React.useState<SortField>('name');
  const [sortDirection, setSortDirection] =
    React.useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedOrchestrators = React.useMemo(() => {
    return [...orchestrators].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'sessions':
          aValue = a.sessions;
          bValue = b.sessions;
          break;
        case 'budget':
          aValue = a.tokenBudget.percentage;
          bValue = b.tokenBudget.percentage;
          break;
        case 'lastActivity':
          aValue = new Date(a.lastActivity).getTime();
          bValue = new Date(b.lastActivity).getTime();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [orchestrators, sortField, sortDirection]);

  const SortIcon: React.FC<{ field: SortField }> = ({ field }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className='ml-1 h-4 w-4 inline' />
    ) : (
      <ChevronDown className='ml-1 h-4 w-4 inline' />
    );
  };

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Orchestrator Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className='cursor-pointer hover:bg-muted/50'
                  onClick={() => handleSort('name')}
                >
                  Name <SortIcon field='name' />
                </TableHead>
                <TableHead
                  className='cursor-pointer hover:bg-muted/50'
                  onClick={() => handleSort('status')}
                >
                  Status <SortIcon field='status' />
                </TableHead>
                <TableHead
                  className='cursor-pointer hover:bg-muted/50'
                  onClick={() => handleSort('sessions')}
                >
                  Sessions <SortIcon field='sessions' />
                </TableHead>
                <TableHead
                  className='cursor-pointer hover:bg-muted/50'
                  onClick={() => handleSort('budget')}
                >
                  Token Budget <SortIcon field='budget' />
                </TableHead>
                <TableHead
                  className='cursor-pointer hover:bg-muted/50'
                  onClick={() => handleSort('lastActivity')}
                >
                  Last Activity <SortIcon field='lastActivity' />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedOrchestrators.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className='text-center text-muted-foreground'
                  >
                    No orchestrators found
                  </TableCell>
                </TableRow>
              ) : (
                sortedOrchestrators.map(orchestrator => (
                  <React.Fragment key={orchestrator.id}>
                    <TableRow
                      className='cursor-pointer'
                      onClick={() => toggleRow(orchestrator.id)}
                    >
                      <TableCell className='font-medium'>
                        {orchestrator.name}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={orchestrator.status} />
                      </TableCell>
                      <TableCell>{orchestrator.sessions}</TableCell>
                      <TableCell className='min-w-[200px]'>
                        <TokenBudgetProgress
                          used={orchestrator.tokenBudget.used}
                          total={orchestrator.tokenBudget.total}
                          percentage={orchestrator.tokenBudget.percentage}
                        />
                      </TableCell>
                      <TableCell className='text-sm text-muted-foreground'>
                        {formatTimestamp(orchestrator.lastActivity)}
                      </TableCell>
                    </TableRow>
                    {expandedRow === orchestrator.id &&
                      orchestrator.metadata && (
                        <TableRow>
                          <TableCell colSpan={5} className='bg-muted/50'>
                            <div className='grid grid-cols-2 md:grid-cols-4 gap-4 p-4'>
                              {orchestrator.metadata.version && (
                                <div>
                                  <div className='text-xs font-medium text-muted-foreground'>
                                    Version
                                  </div>
                                  <div className='text-sm'>
                                    {orchestrator.metadata.version}
                                  </div>
                                </div>
                              )}
                              {orchestrator.metadata.uptime && (
                                <div>
                                  <div className='text-xs font-medium text-muted-foreground'>
                                    Uptime
                                  </div>
                                  <div className='text-sm'>
                                    {orchestrator.metadata.uptime}
                                  </div>
                                </div>
                              )}
                              {orchestrator.metadata.memoryUsage !==
                                undefined && (
                                <div>
                                  <div className='text-xs font-medium text-muted-foreground'>
                                    Memory Usage
                                  </div>
                                  <div className='text-sm'>
                                    {orchestrator.metadata.memoryUsage.toFixed(
                                      1
                                    )}
                                    %
                                  </div>
                                </div>
                              )}
                              {orchestrator.metadata.cpuUsage !== undefined && (
                                <div>
                                  <div className='text-xs font-medium text-muted-foreground'>
                                    CPU Usage
                                  </div>
                                  <div className='text-sm'>
                                    {orchestrator.metadata.cpuUsage.toFixed(1)}%
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

OrchestratorList.displayName = 'OrchestratorList';
