'use client';

import { format } from 'date-fns';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  DownloadIcon,
  FilterIcon,
  SearchIcon,
  XIcon,
} from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
import { cn } from '@/lib/utils';

import { AuditLogEntry } from './audit-log-entry';

export interface AuditEvent {
  id: string;
  timestamp: Date;
  actor: {
    id: string;
    name: string;
    email?: string;
    avatar?: string;
  };
  action: string;
  actionType:
    | 'CREATE'
    | 'READ'
    | 'UPDATE'
    | 'DELETE'
    | 'LOGIN'
    | 'LOGOUT'
    | 'SECURITY';
  resource?: {
    id: string;
    type: string;
    name?: string;
  };
  metadata: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export interface AuditLogFilters {
  dateRange?: {
    from: Date | undefined;
    to: Date | undefined;
  };
  actorId?: string;
  actionType?: string;
  resourceType?: string;
  severity?: string;
  search?: string;
}

export interface AuditLogViewerProps {
  events: AuditEvent[];
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onFiltersChange: (filters: AuditLogFilters) => void;
  onExport: (format: 'csv' | 'json') => void;
  isLoading?: boolean;
}

export function AuditLogViewer({
  events,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onFiltersChange,
  onExport,
  isLoading = false,
}: AuditLogViewerProps) {
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(
    new Set(),
  );
  const [filters, setFilters] = React.useState<AuditLogFilters>({});
  const [dateRange, setDateRange] = React.useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });

  const totalPages = Math.ceil(totalCount / pageSize);

  const toggleRowExpanded = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const handleFilterChange = (key: keyof AuditLogFilters, value: unknown) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    setFilters({});
    setDateRange({ from: undefined, to: undefined });
    onFiltersChange({});
  };

  const hasActiveFilters = Object.values(filters).some(value => {
    if (value && typeof value === 'object') {
      return Object.values(value).some(v => v !== undefined);
    }
    return value !== undefined && value !== '';
  });

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle>Audit Logs</CardTitle>
              <CardDescription>
                View and filter system audit events ({totalCount} total)
              </CardDescription>
            </div>
            <div className='flex gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => onExport('csv')}
                disabled={isLoading}
              >
                <DownloadIcon className='mr-2 h-4 w-4' />
                Export CSV
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={() => onExport('json')}
                disabled={isLoading}
              >
                <DownloadIcon className='mr-2 h-4 w-4' />
                Export JSON
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className='mb-4 space-y-4'>
            <div className='flex items-center gap-2'>
              <FilterIcon className='h-4 w-4 text-muted-foreground' />
              <span className='text-sm font-medium'>Filters</span>
              {hasActiveFilters && (
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={clearFilters}
                  className='h-7 px-2 text-xs'
                >
                  <XIcon className='mr-1 h-3 w-3' />
                  Clear
                </Button>
              )}
            </div>

            <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
              {/* Date Range */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant='outline'
                    className={cn(
                      'justify-start text-left font-normal',
                      !dateRange.from &&
                        !dateRange.to &&
                        'text-muted-foreground',
                    )}
                  >
                    {dateRange.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, 'LLL dd, y')} -{' '}
                          {format(dateRange.to, 'LLL dd, y')}
                        </>
                      ) : (
                        format(dateRange.from, 'LLL dd, y')
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className='w-auto p-0' align='start'>
                  <Calendar
                    mode='range'
                    defaultMonth={dateRange.from}
                    selected={{
                      from: dateRange.from,
                      to: dateRange.to,
                    }}
                    onSelect={range => {
                      setDateRange({
                        from: range?.from,
                        to: range?.to,
                      });
                      handleFilterChange('dateRange', {
                        from: range?.from,
                        to: range?.to,
                      });
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>

              {/* Action Type */}
              <Select
                value={filters.actionType}
                onValueChange={value => handleFilterChange('actionType', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder='Action type' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='CREATE'>Create</SelectItem>
                  <SelectItem value='READ'>Read</SelectItem>
                  <SelectItem value='UPDATE'>Update</SelectItem>
                  <SelectItem value='DELETE'>Delete</SelectItem>
                  <SelectItem value='LOGIN'>Login</SelectItem>
                  <SelectItem value='LOGOUT'>Logout</SelectItem>
                  <SelectItem value='SECURITY'>Security</SelectItem>
                </SelectContent>
              </Select>

              {/* Resource Type */}
              <Select
                value={filters.resourceType}
                onValueChange={value =>
                  handleFilterChange('resourceType', value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder='Resource type' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='user'>User</SelectItem>
                  <SelectItem value='document'>Document</SelectItem>
                  <SelectItem value='workspace'>Workspace</SelectItem>
                  <SelectItem value='agent'>Agent</SelectItem>
                  <SelectItem value='workflow'>Workflow</SelectItem>
                  <SelectItem value='integration'>Integration</SelectItem>
                </SelectContent>
              </Select>

              {/* Severity */}
              <Select
                value={filters.severity}
                onValueChange={value => handleFilterChange('severity', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder='Severity' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='info'>Info</SelectItem>
                  <SelectItem value='warning'>Warning</SelectItem>
                  <SelectItem value='error'>Error</SelectItem>
                  <SelectItem value='critical'>Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className='relative'>
              <SearchIcon className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                placeholder='Search by resource ID or actor ID...'
                value={filters.search || ''}
                onChange={e => handleFilterChange('search', e.target.value)}
                className='pl-10'
              />
            </div>
          </div>

          {/* Table */}
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-[50px]'></TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className='h-24 text-center'>
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className='h-24 text-center'>
                      No audit events found
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map(event => (
                    <React.Fragment key={event.id}>
                      <TableRow className='cursor-pointer'>
                        <TableCell>
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => toggleRowExpanded(event.id)}
                            className='h-6 w-6 p-0'
                          >
                            {expandedRows.has(event.id) ? (
                              <ChevronUpIcon className='h-4 w-4' />
                            ) : (
                              <ChevronDownIcon className='h-4 w-4' />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className='font-mono text-xs'>
                          {format(event.timestamp, 'MMM dd, yyyy HH:mm:ss')}
                        </TableCell>
                        <TableCell>
                          <div className='flex items-center gap-2'>
                            <div className='text-sm'>{event.actor.name}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant='outline'>{event.actionType}</Badge>
                          <div className='mt-1 text-xs text-muted-foreground'>
                            {event.action}
                          </div>
                        </TableCell>
                        <TableCell>
                          {event.resource ? (
                            <div>
                              <Badge variant='secondary'>
                                {event.resource.type}
                              </Badge>
                              <div className='mt-1 text-xs text-muted-foreground'>
                                {event.resource.name || event.resource.id}
                              </div>
                            </div>
                          ) : (
                            <span className='text-muted-foreground'>-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              event.severity === 'critical' ||
                              event.severity === 'error'
                                ? 'destructive'
                                : event.severity === 'warning'
                                  ? 'default'
                                  : 'secondary'
                            }
                          >
                            {event.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className='font-mono text-xs'>
                          {event.ipAddress || '-'}
                        </TableCell>
                      </TableRow>
                      {expandedRows.has(event.id) && (
                        <TableRow>
                          <TableCell colSpan={7} className='bg-muted/50 p-4'>
                            <AuditLogEntry event={event} />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className='flex items-center justify-between px-2 py-4'>
            <div className='flex items-center gap-2'>
              <p className='text-sm text-muted-foreground'>Rows per page</p>
              <Select
                value={String(pageSize)}
                onValueChange={value => onPageSizeChange(Number(value))}
              >
                <SelectTrigger className='h-8 w-[70px]'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='10'>10</SelectItem>
                  <SelectItem value='25'>25</SelectItem>
                  <SelectItem value='50'>50</SelectItem>
                  <SelectItem value='100'>100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className='flex items-center gap-2'>
              <p className='text-sm text-muted-foreground'>
                Page {page} of {totalPages}
              </p>
              <div className='flex gap-1'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => onPageChange(page - 1)}
                  disabled={page === 1 || isLoading}
                >
                  Previous
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => onPageChange(page + 1)}
                  disabled={page === totalPages || isLoading}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
