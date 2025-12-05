'use client';

import {
  Download,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Power,
  Activity,
  Users,
  Settings,
  Trash2,
  CheckSquare,
  XCircle,
  Clock,
  TrendingUp,
  Play,
  Pause,
  Copy,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';

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
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePageHeader } from '@/contexts/page-header-context';
import { useToast } from '@/hooks/use-toast';

import { WorkflowDefaultSettingsDialog } from './components/workflow-default-settings-dialog';
import { WorkflowExecutionHistoryDialog } from './components/workflow-execution-history-dialog';
import { WorkflowPermissionsDialog } from './components/workflow-permissions-dialog';
import { WorkflowResourceUsageDialog } from './components/workflow-resource-usage-dialog';

type WorkflowStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT' | 'ARCHIVED';
type TriggerType =
  | 'schedule'
  | 'message'
  | 'keyword'
  | 'channel_join'
  | 'channel_leave'
  | 'user_join'
  | 'reaction'
  | 'mention'
  | 'webhook';

interface WorkflowRow {
  id: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  trigger: {
    type: TriggerType;
  };
  actions: unknown[];
  createdBy: string;
  createdByUser: {
    id: string;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
  lastExecutedAt: Date | null;
  executionCount: number;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
  resourceUsage?: {
    executionTime: number;
    memoryUsage: number;
    apiCalls: number;
  };
  permissions?: {
    canExecute: string[];
    canEdit: string[];
  };
}

interface Stats {
  total: number;
  active: number;
  inactive: number;
  draft: number;
  totalExecutions: number;
  failedExecutions: number;
  avgExecutionTime: number;
}

export default function AdminWorkflowsManagementPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceSlug = params.workspaceSlug as string;
  const { setPageHeader } = usePageHeader();
  const { toast } = useToast();

  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    active: 0,
    inactive: 0,
    draft: 0,
    totalExecutions: 0,
    failedExecutions: 0,
    avgExecutionTime: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [triggerFilter, setTriggerFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [defaultSettingsDialogOpen, setDefaultSettingsDialogOpen] =
    useState(false);
  const [executionHistoryDialogOpen, setExecutionHistoryDialogOpen] =
    useState(false);
  const [resourceUsageDialogOpen, setResourceUsageDialogOpen] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(
    null
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<string | null>(null);

  useEffect(() => {
    setPageHeader(
      'Workflow Management',
      'Manage workflows, permissions, executions, and resource usage'
    );
  }, [setPageHeader]);

  const fetchWorkflows = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      if (triggerFilter !== 'all') {
        params.set('trigger', triggerFilter);
      }
      if (searchQuery) {
        params.set('search', searchQuery);
      }
      params.set('limit', '100');
      params.set('includeStats', 'true');

      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/workflows?${params}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch workflows');
      }

      const data = await response.json();
      setWorkflows(data.workflows || []);
      setStats(data.stats || {});
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to load workflows',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceSlug, statusFilter, triggerFilter, searchQuery, toast]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedIds(new Set(workflows.map(w => w.id)));
      } else {
        setSelectedIds(new Set());
      }
    },
    [workflows]
  );

  const handleSelectOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const handleToggleStatus = useCallback(
    async (id: string, currentStatus: WorkflowStatus) => {
      try {
        const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/admin/workflows/${id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to update status');
        }

        toast({
          title: 'Success',
          description: `Workflow ${newStatus === 'ACTIVE' ? 'enabled' : 'disabled'}`,
        });

        fetchWorkflows();
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to update workflow status',
          variant: 'destructive',
        });
      }
    },
    [workspaceSlug, toast, fetchWorkflows]
  );

  const handleBulkToggle = useCallback(
    async (enable: boolean) => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/admin/workflows/bulk`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workflowIds: Array.from(selectedIds),
              action: enable ? 'enable' : 'disable',
            }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to bulk update');
        }

        toast({
          title: 'Success',
          description: `${selectedIds.size} workflow(s) ${enable ? 'enabled' : 'disabled'}`,
        });

        setSelectedIds(new Set());
        fetchWorkflows();
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to update workflows',
          variant: 'destructive',
        });
      }
    },
    [workspaceSlug, selectedIds, toast, fetchWorkflows]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/admin/workflows/${id}`,
          {
            method: 'DELETE',
          }
        );

        if (!response.ok) {
          throw new Error('Failed to delete');
        }

        toast({
          title: 'Success',
          description: 'Workflow deleted successfully',
        });

        fetchWorkflows();
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to delete workflow',
          variant: 'destructive',
        });
      }
    },
    [workspaceSlug, toast, fetchWorkflows]
  );

  const handleDuplicate = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/admin/workflows/${id}/duplicate`,
          {
            method: 'POST',
          }
        );

        if (!response.ok) {
          throw new Error('Failed to duplicate');
        }

        const data = await response.json();

        toast({
          title: 'Success',
          description: 'Workflow duplicated successfully',
        });

        router.push(`/${workspaceSlug}/workflows/${data.workflow.id}/edit`);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to duplicate workflow',
          variant: 'destructive',
        });
      }
    },
    [workspaceSlug, router, toast]
  );

  const handleExport = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/workflows/export`
      );

      if (!response.ok) {
        throw new Error('Failed to export');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workflows-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Success',
        description: 'Workflows exported successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export workflows',
        variant: 'destructive',
      });
    }
  }, [workspaceSlug, toast]);

  const filteredWorkflows = useMemo(() => {
    return workflows.filter(workflow => {
      if (statusFilter !== 'all' && workflow.status !== statusFilter) {
        return false;
      }
      if (triggerFilter !== 'all' && workflow.trigger.type !== triggerFilter) {
        return false;
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          workflow.name.toLowerCase().includes(query) ||
          workflow.description?.toLowerCase().includes(query) ||
          workflow.createdByUser.name?.toLowerCase().includes(query) ||
          workflow.createdByUser.email?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [workflows, statusFilter, triggerFilter, searchQuery]);

  const uniqueTriggers = useMemo(() => {
    const triggers = new Set<string>();
    workflows.forEach(w => {
      triggers.add(w.trigger.type);
    });
    return Array.from(triggers).sort();
  }, [workflows]);

  const getStatusBadge = (status: WorkflowStatus) => {
    const config = {
      ACTIVE: { label: 'Active', variant: 'default' as const },
      INACTIVE: { label: 'Inactive', variant: 'secondary' as const },
      DRAFT: { label: 'Draft', variant: 'outline' as const },
      ARCHIVED: { label: 'Archived', variant: 'secondary' as const },
    };
    const { label, variant } = config[status];
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getTriggerBadge = (type: TriggerType) => {
    const config: Record<
      TriggerType,
      { label: string; variant: 'default' | 'secondary' | 'outline' }
    > = {
      schedule: { label: 'Schedule', variant: 'outline' },
      message: { label: 'Message', variant: 'default' },
      keyword: { label: 'Keyword', variant: 'default' },
      channel_join: { label: 'Channel Join', variant: 'secondary' },
      channel_leave: { label: 'Channel Leave', variant: 'secondary' },
      user_join: { label: 'User Join', variant: 'secondary' },
      reaction: { label: 'Reaction', variant: 'default' },
      mention: { label: 'Mention', variant: 'default' },
      webhook: { label: 'Webhook', variant: 'outline' },
    };
    const { label, variant } = config[type];
    return <Badge variant={variant}>{label}</Badge>;
  };

  return (
    <div className='space-y-6'>
      {/* Stats Overview */}
      <div className='grid gap-4 md:grid-cols-6'>
        <StatsCard label='Total' value={stats.total} />
        <StatsCard label='Active' value={stats.active} color='text-green-600' />
        <StatsCard
          label='Inactive'
          value={stats.inactive}
          color='text-gray-600'
        />
        <StatsCard label='Draft' value={stats.draft} color='text-yellow-600' />
        <StatsCard
          label='Executions'
          value={stats.totalExecutions.toLocaleString()}
          color='text-blue-600'
        />
        <StatsCard
          label='Avg Time'
          value={`${stats.avgExecutionTime}ms`}
          color='text-purple-600'
        />
      </div>

      {/* Filters and Actions */}
      <div className='flex flex-col gap-4'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex flex-1 gap-2'>
            <div className='relative flex-1 max-w-sm'>
              <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                placeholder='Search workflows...'
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className='pl-9'
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className='w-[140px]'>
                <Filter className='h-4 w-4 mr-2' />
                <SelectValue placeholder='Status' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Statuses</SelectItem>
                <SelectItem value='ACTIVE'>Active</SelectItem>
                <SelectItem value='INACTIVE'>Inactive</SelectItem>
                <SelectItem value='DRAFT'>Draft</SelectItem>
                <SelectItem value='ARCHIVED'>Archived</SelectItem>
              </SelectContent>
            </Select>
            <Select value={triggerFilter} onValueChange={setTriggerFilter}>
              <SelectTrigger className='w-[140px]'>
                <Filter className='h-4 w-4 mr-2' />
                <SelectValue placeholder='Trigger' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Triggers</SelectItem>
                {uniqueTriggers.map(trigger => (
                  <SelectItem key={trigger} value={trigger}>
                    {trigger
                      .split('_')
                      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                      .join(' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='flex gap-2'>
            <Button variant='outline' onClick={handleExport}>
              <Download className='h-4 w-4 mr-2' />
              Export
            </Button>
            <Button
              variant='outline'
              onClick={() => setDefaultSettingsDialogOpen(true)}
            >
              <Settings className='h-4 w-4 mr-2' />
              Defaults
            </Button>
            <Button
              onClick={() => router.push(`/${workspaceSlug}/workflows/new`)}
            >
              <Plus className='h-4 w-4 mr-2' />
              New Workflow
            </Button>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className='flex items-center gap-2 rounded-lg border bg-muted/50 p-3'>
            <span className='text-sm font-medium'>
              {selectedIds.size} selected
            </span>
            <div className='flex gap-2 ml-auto'>
              <Button
                size='sm'
                variant='outline'
                onClick={() => handleBulkToggle(true)}
              >
                <CheckSquare className='h-4 w-4 mr-2' />
                Enable All
              </Button>
              <Button
                size='sm'
                variant='outline'
                onClick={() => handleBulkToggle(false)}
              >
                <XCircle className='h-4 w-4 mr-2' />
                Disable All
              </Button>
              <Button
                size='sm'
                variant='outline'
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className='rounded-lg border bg-card'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-12'>
                <Checkbox
                  checked={
                    selectedIds.size === filteredWorkflows.length &&
                    filteredWorkflows.length > 0
                  }
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>Workflow</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className='text-right'>Executions</TableHead>
              <TableHead className='text-right'>Failures</TableHead>
              <TableHead>Last Run</TableHead>
              <TableHead className='text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className='text-center py-8'>
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredWorkflows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className='text-center py-8'>
                  No workflows found
                </TableCell>
              </TableRow>
            ) : (
              filteredWorkflows.map(workflow => (
                <TableRow key={workflow.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(workflow.id)}
                      onCheckedChange={checked =>
                        handleSelectOne(workflow.id, !!checked)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className='font-medium'>{workflow.name}</p>
                      {workflow.description && (
                        <p className='text-sm text-muted-foreground line-clamp-1'>
                          {workflow.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getTriggerBadge(workflow.trigger.type)}
                  </TableCell>
                  <TableCell>{getStatusBadge(workflow.status)}</TableCell>
                  <TableCell>
                    <div>
                      <p className='text-sm font-medium'>
                        {workflow.createdByUser.name || 'Unknown'}
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        {workflow.createdByUser.email}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className='text-right'>
                    <span className='font-medium'>
                      {workflow.executionCount.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell className='text-right'>
                    <span
                      className={
                        workflow.failureCount > 0
                          ? 'text-red-600 font-medium'
                          : 'text-muted-foreground'
                      }
                    >
                      {workflow.failureCount}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className='text-sm text-muted-foreground'>
                      {workflow.lastExecutedAt
                        ? new Date(workflow.lastExecutedAt).toLocaleString()
                        : 'Never'}
                    </div>
                  </TableCell>
                  <TableCell className='text-right'>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant='ghost' size='sm'>
                          <MoreHorizontal className='h-4 w-4' />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align='end'>
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() =>
                            router.push(
                              `/${workspaceSlug}/workflows/${workflow.id}/edit`
                            )
                          }
                        >
                          <Settings className='h-4 w-4 mr-2' />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedWorkflowId(workflow.id);
                            setExecutionHistoryDialogOpen(true);
                          }}
                        >
                          <Activity className='h-4 w-4 mr-2' />
                          Execution History
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedWorkflowId(workflow.id);
                            setResourceUsageDialogOpen(true);
                          }}
                        >
                          <TrendingUp className='h-4 w-4 mr-2' />
                          Resource Usage
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedWorkflowId(workflow.id);
                            setPermissionsDialogOpen(true);
                          }}
                        >
                          <Users className='h-4 w-4 mr-2' />
                          Permissions
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            handleToggleStatus(workflow.id, workflow.status)
                          }
                        >
                          {workflow.status === 'ACTIVE' ? (
                            <>
                              <Pause className='h-4 w-4 mr-2' />
                              Disable
                            </>
                          ) : (
                            <>
                              <Play className='h-4 w-4 mr-2' />
                              Enable
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDuplicate(workflow.id)}
                        >
                          <Copy className='h-4 w-4 mr-2' />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className='text-red-600'
                          onClick={() => {
                            setWorkflowToDelete(workflow.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className='h-4 w-4 mr-2' />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialogs */}
      <WorkflowPermissionsDialog
        open={permissionsDialogOpen}
        onOpenChange={setPermissionsDialogOpen}
        workflowId={selectedWorkflowId}
        workspaceSlug={workspaceSlug}
        onSuccess={fetchWorkflows}
      />

      <WorkflowDefaultSettingsDialog
        open={defaultSettingsDialogOpen}
        onOpenChange={setDefaultSettingsDialogOpen}
        workspaceSlug={workspaceSlug}
      />

      <WorkflowExecutionHistoryDialog
        open={executionHistoryDialogOpen}
        onOpenChange={setExecutionHistoryDialogOpen}
        workflowId={selectedWorkflowId}
        workspaceSlug={workspaceSlug}
      />

      <WorkflowResourceUsageDialog
        open={resourceUsageDialogOpen}
        onOpenChange={setResourceUsageDialogOpen}
        workflowId={selectedWorkflowId}
        workspaceSlug={workspaceSlug}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this workflow? This action cannot
              be undone and will remove all associated execution history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (workflowToDelete) {
                  handleDelete(workflowToDelete);
                  setDeleteDialogOpen(false);
                  setWorkflowToDelete(null);
                }
              }}
              className='bg-red-600 hover:bg-red-700'
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatsCard({
  label,
  value,
  color = 'text-foreground',
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className='rounded-lg border bg-card p-4'>
      <p className='text-sm font-medium text-muted-foreground'>{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}
