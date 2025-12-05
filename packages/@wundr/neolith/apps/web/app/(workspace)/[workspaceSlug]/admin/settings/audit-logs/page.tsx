'use client';

import {
  Download,
  Filter,
  Search,
  User,
  Calendar,
  Globe,
  Shield,
  Loader2,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  actionType: 'create' | 'update' | 'delete' | 'access' | 'security';
  resource: string;
  resourceId?: string;
  ipAddress: string;
  status: 'success' | 'failure';
}

type ActionTypeFilter =
  | 'all'
  | 'create'
  | 'update'
  | 'delete'
  | 'access'
  | 'security';
type DateRangeFilter = 'today' | '7d' | '30d' | '90d' | 'all';

export default function AuditLogsPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [actionTypeFilter, setActionTypeFilter] =
    useState<ActionTypeFilter>('all');
  const [dateRangeFilter, setDateRangeFilter] =
    useState<DateRangeFilter>('30d');
  const [userFilter, setUserFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [uniqueUsers, setUniqueUsers] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: pageSize.toString(),
          ...(actionTypeFilter !== 'all' && { actionType: actionTypeFilter }),
          ...(dateRangeFilter !== 'all' && { dateRange: dateRangeFilter }),
          ...(userFilter !== 'all' && { userId: userFilter }),
          ...(searchQuery && { search: searchQuery }),
        });

        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/audit-logs?${params}`
        );
        if (!response.ok) {
          throw new Error('Failed to fetch audit logs');
        }

        const data = await response.json();
        setLogs(data.logs || []);
        setTotalCount(data.totalCount || 0);
        setUniqueUsers(data.uniqueUsers || []);
      } catch (error) {
        toast({
          title: 'Error',
          description:
            error instanceof Error
              ? error.message
              : 'Failed to load audit logs',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchLogs();
  }, [
    workspaceSlug,
    currentPage,
    pageSize,
    actionTypeFilter,
    dateRangeFilter,
    userFilter,
    searchQuery,
    toast,
  ]);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        ...(actionTypeFilter !== 'all' && { actionType: actionTypeFilter }),
        ...(dateRangeFilter !== 'all' && { dateRange: dateRangeFilter }),
        ...(userFilter !== 'all' && { userId: userFilter }),
        ...(searchQuery && { search: searchQuery }),
        export: 'csv',
      });

      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/audit-logs?${params}`
      );
      if (!response.ok) {
        throw new Error('Failed to export audit logs');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${workspaceSlug}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: 'Audit logs exported successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to export audit logs',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  }, [
    workspaceSlug,
    actionTypeFilter,
    dateRangeFilter,
    userFilter,
    searchQuery,
    toast,
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);
  const startRecord = (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalCount);

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionBadgeColor = (actionType: string) => {
    const colors: Record<string, string> = {
      create:
        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      update:
        'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      delete: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      access:
        'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      security:
        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    };
    return (
      colors[actionType] ||
      'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
    );
  };

  const getStatusBadgeColor = (status: string) => {
    return status === 'success'
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  };

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold'>Audit Logs</h1>
        <p className='mt-1 text-muted-foreground'>
          Track all activities and changes in your workspace
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
            <div className='flex items-center gap-2'>
              <Filter className='h-5 w-5 text-muted-foreground' />
              <CardTitle className='text-base'>Filters</CardTitle>
            </div>
            <Button
              onClick={handleExport}
              disabled={isExporting || logs.length === 0}
              variant='outline'
              size='sm'
            >
              {isExporting ? (
                <>
                  <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className='h-4 w-4 mr-2' />
                  Export CSV
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <div className='relative sm:col-span-2'>
              <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                placeholder='Search logs...'
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className='pl-9'
              />
            </div>
            <Select
              value={actionTypeFilter}
              onValueChange={(value: ActionTypeFilter) => {
                setActionTypeFilter(value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder='Action Type' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Actions</SelectItem>
                <SelectItem value='create'>Create</SelectItem>
                <SelectItem value='update'>Update</SelectItem>
                <SelectItem value='delete'>Delete</SelectItem>
                <SelectItem value='access'>Access</SelectItem>
                <SelectItem value='security'>Security</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={dateRangeFilter}
              onValueChange={(value: DateRangeFilter) => {
                setDateRangeFilter(value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder='Date Range' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='today'>Today</SelectItem>
                <SelectItem value='7d'>Last 7 days</SelectItem>
                <SelectItem value='30d'>Last 30 days</SelectItem>
                <SelectItem value='90d'>Last 90 days</SelectItem>
                <SelectItem value='all'>All time</SelectItem>
              </SelectContent>
            </Select>
            {uniqueUsers.length > 0 && (
              <div className='sm:col-span-2 lg:col-span-1'>
                <Select
                  value={userFilter}
                  onValueChange={value => {
                    setUserFilter(value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='All Users' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>All Users</SelectItem>
                    {uniqueUsers.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Shield className='h-5 w-5' />
            Audit Trail
          </CardTitle>
          <CardDescription>
            {totalCount > 0
              ? `Showing ${startRecord}-${endRecord} of ${totalCount} logs`
              : 'No logs found'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <AuditLogsSkeleton />
          ) : logs.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-12'>
              <Shield className='h-12 w-12 text-muted-foreground/50' />
              <p className='mt-2 text-muted-foreground'>No audit logs found</p>
              <p className='text-sm text-muted-foreground'>
                Try adjusting your filters
              </p>
            </div>
          ) : (
            <>
              <div className='overflow-x-auto'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map(log => (
                      <TableRow key={log.id}>
                        <TableCell className='whitespace-nowrap'>
                          <div className='flex items-center gap-2 text-sm'>
                            <Calendar className='h-4 w-4 text-muted-foreground' />
                            {formatTimestamp(log.timestamp)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className='flex items-start gap-2'>
                            <User className='h-4 w-4 text-muted-foreground mt-0.5' />
                            <div>
                              <p className='text-sm font-medium'>
                                {log.userName}
                              </p>
                              <p className='text-xs text-muted-foreground'>
                                {log.userEmail}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className='flex flex-col gap-1'>
                            <span
                              className={cn(
                                'inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium',
                                getActionBadgeColor(log.actionType)
                              )}
                            >
                              {log.actionType}
                            </span>
                            <p className='text-sm'>{log.action}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className='max-w-[200px]'>
                            <p className='truncate text-sm'>{log.resource}</p>
                            {log.resourceId && (
                              <p className='truncate text-xs text-muted-foreground'>
                                {log.resourceId}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className='flex items-center gap-2 text-sm'>
                            <Globe className='h-4 w-4 text-muted-foreground' />
                            {log.ipAddress}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                              getStatusBadgeColor(log.status)
                            )}
                          >
                            {log.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className='mt-4 flex items-center justify-between border-t pt-4'>
                  <p className='text-sm text-muted-foreground'>
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className='flex gap-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() =>
                        setCurrentPage(prev => Math.max(1, prev - 1))
                      }
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() =>
                        setCurrentPage(prev => Math.min(totalPages, prev + 1))
                      }
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AuditLogsSkeleton() {
  return (
    <div className='space-y-4'>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className='flex items-center gap-4'>
          <div className='h-12 w-32 animate-pulse rounded bg-muted' />
          <div className='flex-1 space-y-2'>
            <div className='h-4 w-3/4 animate-pulse rounded bg-muted' />
            <div className='h-3 w-1/2 animate-pulse rounded bg-muted' />
          </div>
        </div>
      ))}
    </div>
  );
}
