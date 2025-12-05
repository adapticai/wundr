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
  ChevronDown,
  Info,
  AlertTriangle,
  AlertCircle,
  Eye,
  X,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState, useCallback, useEffect, useRef } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

interface AuditLogEntry {
  id: string;
  createdAt: string;
  action: string;
  actorId: string;
  actorType: 'user' | 'orchestrator' | 'daemon' | 'system';
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  severity: 'info' | 'warning' | 'critical';
  actor?: {
    id: string;
    name: string | null;
    email: string | null;
  };
  changes?: Array<{
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
}

type ActionCategory =
  | 'all'
  | 'user_management'
  | 'settings'
  | 'security'
  | 'data';
type DateRangeFilter = 'today' | '7d' | '30d' | '90d' | 'custom' | 'all';

const ACTION_CATEGORIES: Record<ActionCategory, string> = {
  all: 'All Actions',
  user_management: 'User Management',
  settings: 'Settings',
  security: 'Security',
  data: 'Data',
};

const SEVERITY_COLORS = {
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  warning:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const ACTOR_TYPE_COLORS = {
  user: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  orchestrator:
    'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  daemon: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  system: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

export default function AuditLogPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ActionCategory>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [actorTypeFilter, setActorTypeFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] =
    useState<DateRangeFilter>('30d');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [enableInfiniteScroll, setEnableInfiniteScroll] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Fetch logs
  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: pageSize.toString(),
          ...(categoryFilter !== 'all' && { category: categoryFilter }),
          ...(severityFilter !== 'all' && { severity: severityFilter }),
          ...(actorTypeFilter !== 'all' && { actorType: actorTypeFilter }),
          ...(searchQuery && { search: searchQuery }),
        });

        // Add date range
        if (dateRangeFilter !== 'all') {
          const now = new Date();
          let startDate: Date;

          if (dateRangeFilter === 'custom') {
            if (customStartDate) {
              params.set('startDate', customStartDate);
            }
            if (customEndDate) {
              params.set('endDate', customEndDate);
            }
          } else {
            switch (dateRangeFilter) {
              case 'today':
                startDate = new Date(now.setHours(0, 0, 0, 0));
                break;
              case '7d':
                startDate = new Date(now.setDate(now.getDate() - 7));
                break;
              case '30d':
                startDate = new Date(now.setDate(now.getDate() - 30));
                break;
              case '90d':
                startDate = new Date(now.setDate(now.getDate() - 90));
                break;
              default:
                startDate = new Date(0);
            }
            params.set('startDate', startDate.toISOString());
          }
        }

        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/audit-log?${params}`,
        );
        if (!response.ok) {
          throw new Error('Failed to fetch audit logs');
        }

        const data = await response.json();

        if (enableInfiniteScroll && currentPage > 1) {
          setLogs(prev => [...prev, ...(data.entries || [])]);
        } else {
          setLogs(data.entries || []);
        }
        setTotalCount(data.total || 0);
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
    categoryFilter,
    severityFilter,
    actorTypeFilter,
    dateRangeFilter,
    customStartDate,
    customEndDate,
    searchQuery,
    enableInfiniteScroll,
    toast,
  ]);

  // Infinite scroll observer
  useEffect(() => {
    if (!enableInfiniteScroll) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting && !isLoading && logs.length < totalCount) {
          setCurrentPage(prev => prev + 1);
        }
      },
      { threshold: 0.1 },
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [enableInfiniteScroll, isLoading, logs.length, totalCount]);

  // Real-time updates (poll every 30 seconds)
  useEffect(() => {
    if (!enableInfiniteScroll && currentPage === 1) {
      const interval = setInterval(() => {
        setCurrentPage(1);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [enableInfiniteScroll, currentPage]);

  // Handle export
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        ...(categoryFilter !== 'all' && { category: categoryFilter }),
        ...(severityFilter !== 'all' && { severity: severityFilter }),
        ...(actorTypeFilter !== 'all' && { actorType: actorTypeFilter }),
        ...(searchQuery && { search: searchQuery }),
        format: 'csv',
      });

      // Add date range for export
      if (dateRangeFilter !== 'all') {
        const now = new Date();
        let startDate: Date;

        if (dateRangeFilter === 'custom') {
          if (customStartDate) {
            params.set('startDate', customStartDate);
          }
          if (customEndDate) {
            params.set('endDate', customEndDate);
          }
        } else {
          switch (dateRangeFilter) {
            case 'today':
              startDate = new Date(now.setHours(0, 0, 0, 0));
              break;
            case '7d':
              startDate = new Date(now.setDate(now.getDate() - 7));
              break;
            case '30d':
              startDate = new Date(now.setDate(now.getDate() - 30));
              break;
            case '90d':
              startDate = new Date(now.setDate(now.getDate() - 90));
              break;
            default:
              startDate = new Date(0);
          }
          params.set('startDate', startDate.toISOString());
        }
      }

      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/audit-log/export?${params}`,
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
    categoryFilter,
    severityFilter,
    actorTypeFilter,
    dateRangeFilter,
    customStartDate,
    customEndDate,
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
      second: '2-digit',
    });
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className='h-4 w-4' />;
      case 'warning':
        return <AlertTriangle className='h-4 w-4' />;
      default:
        return <Info className='h-4 w-4' />;
    }
  };

  const getCategoryFromAction = (action: string): string => {
    if (action.includes('user') || action.includes('member') || action.includes('role')) {
      return 'User Management';
    }
    if (action.includes('settings') || action.includes('config')) {
      return 'Settings';
    }
    if (action.includes('security') || action.includes('auth') || action.includes('permission')) {
      return 'Security';
    }
    if (action.includes('data') || action.includes('export') || action.includes('delete')) {
      return 'Data';
    }
    return 'General';
  };

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold'>Audit Log</h1>
        <p className='mt-1 text-muted-foreground'>
          Comprehensive audit trail of all admin actions and system events
        </p>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
            <div className='flex items-center gap-2'>
              <Filter className='h-5 w-5 text-muted-foreground' />
              <CardTitle className='text-base'>Filters</CardTitle>
            </div>
            <div className='flex gap-2'>
              <Button
                onClick={() => setEnableInfiniteScroll(!enableInfiniteScroll)}
                variant='outline'
                size='sm'
              >
                {enableInfiniteScroll ? 'Pagination' : 'Infinite Scroll'}
              </Button>
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
          </div>
        </CardHeader>
        <CardContent>
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            {/* Search */}
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

            {/* Action Category */}
            <Select
              value={categoryFilter}
              onValueChange={(value: ActionCategory) => {
                setCategoryFilter(value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder='All Categories' />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ACTION_CATEGORIES).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Severity */}
            <Select
              value={severityFilter}
              onValueChange={value => {
                setSeverityFilter(value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder='All Severities' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Severities</SelectItem>
                <SelectItem value='info'>Info</SelectItem>
                <SelectItem value='warning'>Warning</SelectItem>
                <SelectItem value='critical'>Critical</SelectItem>
              </SelectContent>
            </Select>

            {/* Actor Type */}
            <Select
              value={actorTypeFilter}
              onValueChange={value => {
                setActorTypeFilter(value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder='All Actor Types' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Actor Types</SelectItem>
                <SelectItem value='user'>User</SelectItem>
                <SelectItem value='orchestrator'>Orchestrator</SelectItem>
                <SelectItem value='daemon'>Daemon</SelectItem>
                <SelectItem value='system'>System</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Range */}
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
                <SelectItem value='custom'>Custom Range</SelectItem>
                <SelectItem value='all'>All time</SelectItem>
              </SelectContent>
            </Select>

            {/* Custom Date Inputs */}
            {dateRangeFilter === 'custom' && (
              <>
                <Input
                  type='date'
                  value={customStartDate}
                  onChange={e => {
                    setCustomStartDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder='Start date'
                />
                <Input
                  type='date'
                  value={customEndDate}
                  onChange={e => {
                    setCustomEndDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder='End date'
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
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
          {isLoading && currentPage === 1 ? (
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
                      <TableHead>Actor</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map(log => (
                      <TableRow key={log.id} className='cursor-pointer hover:bg-muted/50'>
                        <TableCell className='whitespace-nowrap'>
                          <div className='flex items-center gap-2 text-sm'>
                            <Calendar className='h-4 w-4 text-muted-foreground' />
                            {formatTimestamp(log.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className='flex items-start gap-2'>
                            <User className='h-4 w-4 text-muted-foreground mt-0.5' />
                            <div>
                              <p className='text-sm font-medium'>
                                {log.actor?.name || 'Unknown'}
                              </p>
                              <Badge
                                variant='secondary'
                                className={cn(
                                  'text-xs mt-1',
                                  ACTOR_TYPE_COLORS[log.actorType],
                                )}
                              >
                                {log.actorType}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className='text-sm font-mono'>{log.action}</p>
                        </TableCell>
                        <TableCell>
                          <div className='max-w-[200px]'>
                            <p className='truncate text-sm font-medium'>
                              {log.resourceType}
                            </p>
                            {log.resourceId && (
                              <p className='truncate text-xs text-muted-foreground font-mono'>
                                {log.resourceId}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant='outline'>
                            {getCategoryFromAction(log.action)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className='flex items-center gap-2'>
                            <Badge
                              variant='secondary'
                              className={cn(SEVERITY_COLORS[log.severity])}
                            >
                              {getSeverityIcon(log.severity)}
                              <span className='ml-1'>{log.severity}</span>
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className='flex items-center gap-2 text-sm'>
                            <Globe className='h-4 w-4 text-muted-foreground' />
                            {log.ip || 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => setSelectedLog(log)}
                          >
                            <Eye className='h-4 w-4' />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination or Infinite Scroll Trigger */}
              {!enableInfiniteScroll && totalPages > 1 && (
                <div className='mt-4 flex items-center justify-between border-t pt-4'>
                  <p className='text-sm text-muted-foreground'>
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className='flex gap-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
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

              {enableInfiniteScroll && logs.length < totalCount && (
                <div ref={observerTarget} className='mt-4 text-center py-4'>
                  {isLoading ? (
                    <Loader2 className='h-6 w-6 animate-spin mx-auto text-muted-foreground' />
                  ) : (
                    <p className='text-sm text-muted-foreground'>
                      Scroll to load more...
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className='max-w-3xl max-h-[80vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Shield className='h-5 w-5' />
              Audit Log Details
            </DialogTitle>
            <DialogDescription>
              Detailed information about this audit log entry
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className='space-y-6'>
              {/* Basic Info */}
              <div className='grid gap-4 sm:grid-cols-2'>
                <div>
                  <p className='text-sm font-medium text-muted-foreground mb-1'>
                    Timestamp
                  </p>
                  <p className='text-sm'>{formatTimestamp(selectedLog.createdAt)}</p>
                </div>
                <div>
                  <p className='text-sm font-medium text-muted-foreground mb-1'>
                    Action
                  </p>
                  <p className='text-sm font-mono'>{selectedLog.action}</p>
                </div>
                <div>
                  <p className='text-sm font-medium text-muted-foreground mb-1'>
                    Actor
                  </p>
                  <div className='flex items-center gap-2'>
                    <p className='text-sm'>
                      {selectedLog.actor?.name || 'Unknown'}
                    </p>
                    <Badge
                      variant='secondary'
                      className={cn(
                        'text-xs',
                        ACTOR_TYPE_COLORS[selectedLog.actorType],
                      )}
                    >
                      {selectedLog.actorType}
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className='text-sm font-medium text-muted-foreground mb-1'>
                    Severity
                  </p>
                  <Badge
                    variant='secondary'
                    className={cn(SEVERITY_COLORS[selectedLog.severity])}
                  >
                    {getSeverityIcon(selectedLog.severity)}
                    <span className='ml-1'>{selectedLog.severity}</span>
                  </Badge>
                </div>
                <div>
                  <p className='text-sm font-medium text-muted-foreground mb-1'>
                    Resource Type
                  </p>
                  <p className='text-sm'>{selectedLog.resourceType}</p>
                </div>
                <div>
                  <p className='text-sm font-medium text-muted-foreground mb-1'>
                    Resource ID
                  </p>
                  <p className='text-sm font-mono'>
                    {selectedLog.resourceId || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className='text-sm font-medium text-muted-foreground mb-1'>
                    IP Address
                  </p>
                  <p className='text-sm'>{selectedLog.ip || 'N/A'}</p>
                </div>
                <div>
                  <p className='text-sm font-medium text-muted-foreground mb-1'>
                    Category
                  </p>
                  <Badge variant='outline'>
                    {getCategoryFromAction(selectedLog.action)}
                  </Badge>
                </div>
              </div>

              {/* Before/After State */}
              {selectedLog.changes && selectedLog.changes.length > 0 && (
                <div>
                  <p className='text-sm font-medium text-muted-foreground mb-2'>
                    Changes
                  </p>
                  <div className='border rounded-lg divide-y'>
                    {selectedLog.changes.map((change, idx) => (
                      <div key={idx} className='p-4'>
                        <p className='text-sm font-medium mb-2'>{change.field}</p>
                        <div className='grid sm:grid-cols-2 gap-4'>
                          <div>
                            <p className='text-xs text-muted-foreground mb-1'>
                              Old Value
                            </p>
                            <pre className='text-xs bg-muted p-2 rounded overflow-x-auto'>
                              {JSON.stringify(change.oldValue, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <p className='text-xs text-muted-foreground mb-1'>
                              New Value
                            </p>
                            <pre className='text-xs bg-muted p-2 rounded overflow-x-auto'>
                              {JSON.stringify(change.newValue, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <p className='text-sm font-medium text-muted-foreground mb-2'>
                    Additional Metadata
                  </p>
                  <pre className='text-xs bg-muted p-4 rounded overflow-x-auto'>
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {/* User Agent */}
              {selectedLog.userAgent && (
                <div>
                  <p className='text-sm font-medium text-muted-foreground mb-2'>
                    User Agent
                  </p>
                  <p className='text-xs bg-muted p-3 rounded font-mono break-all'>
                    {selectedLog.userAgent}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className='flex justify-end'>
            <Button variant='outline' onClick={() => setSelectedLog(null)}>
              <X className='h-4 w-4 mr-2' />
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AuditLogsSkeleton() {
  return (
    <div className='space-y-4'>
      {Array.from({ length: 10 }).map((_, i) => (
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
