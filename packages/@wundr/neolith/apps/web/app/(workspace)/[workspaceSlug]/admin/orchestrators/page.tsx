'use client';

import {
  Download,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Power,
  DollarSign,
  BarChart2,
  Users,
  Settings,
  Trash2,
  CheckSquare,
  XCircle,
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
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
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

import { BudgetSettingsDialog } from './components/budget-settings-dialog';
import { DefaultSettingsDialog } from './components/default-settings-dialog';
import { OrchestratorAnalytics } from './components/orchestrator-analytics';
import { PermissionsDialog } from './components/permissions-dialog';

import { OrchestratorStatusBadge } from '@/components/admin/orchestrators/orchestrator-status';

import type { OrchestratorStatus } from '@/types/orchestrator';

interface OrchestratorRow {
  id: string;
  title: string;
  discipline: string | null;
  role: string;
  status: OrchestratorStatus;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
  organization: {
    id: string;
    name: string;
  };
  statistics: {
    totalTasks: number;
    tasksCompleted: number;
    activeTasks: number;
  };
  capabilities: unknown;
  createdAt: Date;
  updatedAt: Date;
  budgetLimit?: number;
  budgetUsed?: number;
  permissions?: string[];
  isEnabled: boolean;
}

interface Stats {
  total: number;
  online: number;
  offline: number;
  busy: number;
  totalBudget: number;
  usedBudget: number;
}

export default function AdminOrchestratorsManagementPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceSlug = params.workspaceSlug as string;
  const { setPageHeader } = usePageHeader();
  const { toast } = useToast();

  const [orchestrators, setOrchestrators] = useState<OrchestratorRow[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    online: 0,
    offline: 0,
    busy: 0,
    totalBudget: 0,
    usedBudget: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [disciplineFilter, setDisciplineFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [defaultSettingsDialogOpen, setDefaultSettingsDialogOpen] =
    useState(false);
  const [analyticsDialogOpen, setAnalyticsDialogOpen] = useState(false);
  const [selectedOrchestratorId, setSelectedOrchestratorId] = useState<
    string | null
  >(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orchestratorToDelete, setOrchestratorToDelete] = useState<
    string | null
  >(null);

  useEffect(() => {
    setPageHeader(
      'Orchestrator Management',
      'Manage orchestrators, budgets, permissions, and analytics'
    );
  }, [setPageHeader]);

  const fetchOrchestrators = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      if (disciplineFilter !== 'all') {
        params.set('discipline', disciplineFilter);
      }
      if (searchQuery) {
        params.set('search', searchQuery);
      }
      params.set('limit', '100');

      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/orchestrators?${params}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch orchestrators');
      }

      const data = await response.json();
      setOrchestrators(data.orchestrators || []);
      setStats(data.stats || {});
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to load orchestrators',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceSlug, statusFilter, disciplineFilter, searchQuery, toast]);

  useEffect(() => {
    fetchOrchestrators();
  }, [fetchOrchestrators]);

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedIds(new Set(orchestrators.map(o => o.id)));
      } else {
        setSelectedIds(new Set());
      }
    },
    [orchestrators]
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
    async (id: string, currentStatus: OrchestratorStatus) => {
      try {
        const newStatus =
          currentStatus === 'OFFLINE' || currentStatus === 'AWAY'
            ? 'ONLINE'
            : 'OFFLINE';

        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/admin/orchestrators/${id}`,
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
          description: `Orchestrator ${newStatus === 'ONLINE' ? 'enabled' : 'disabled'}`,
        });

        fetchOrchestrators();
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to update orchestrator status',
          variant: 'destructive',
        });
      }
    },
    [workspaceSlug, toast, fetchOrchestrators]
  );

  const handleBulkToggle = useCallback(
    async (enable: boolean) => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/admin/orchestrators/bulk`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orchestratorIds: Array.from(selectedIds),
              action: enable ? 'enable' : 'disable',
            }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to bulk update');
        }

        toast({
          title: 'Success',
          description: `${selectedIds.size} orchestrator(s) ${enable ? 'enabled' : 'disabled'}`,
        });

        setSelectedIds(new Set());
        fetchOrchestrators();
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to update orchestrators',
          variant: 'destructive',
        });
      }
    },
    [workspaceSlug, selectedIds, toast, fetchOrchestrators]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/admin/orchestrators/${id}`,
          {
            method: 'DELETE',
          }
        );

        if (!response.ok) {
          throw new Error('Failed to delete');
        }

        toast({
          title: 'Success',
          description: 'Orchestrator deleted successfully',
        });

        fetchOrchestrators();
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to delete orchestrator',
          variant: 'destructive',
        });
      }
    },
    [workspaceSlug, toast, fetchOrchestrators]
  );

  const handleExport = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/orchestrators/export`
      );

      if (!response.ok) {
        throw new Error('Failed to export');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orchestrators-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Success',
        description: 'Orchestrators exported successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export orchestrators',
        variant: 'destructive',
      });
    }
  }, [workspaceSlug, toast]);

  const filteredOrchestrators = useMemo(() => {
    return orchestrators.filter(orchestrator => {
      if (statusFilter !== 'all' && orchestrator.status !== statusFilter) {
        return false;
      }
      if (
        disciplineFilter !== 'all' &&
        orchestrator.discipline !== disciplineFilter
      ) {
        return false;
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          orchestrator.title.toLowerCase().includes(query) ||
          orchestrator.discipline?.toLowerCase().includes(query) ||
          orchestrator.role.toLowerCase().includes(query) ||
          orchestrator.user.name?.toLowerCase().includes(query) ||
          orchestrator.user.email?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [orchestrators, statusFilter, disciplineFilter, searchQuery]);

  const uniqueDisciplines = useMemo(() => {
    const disciplines = new Set<string>();
    orchestrators.forEach(o => {
      if (o.discipline) {
        disciplines.add(o.discipline);
      }
    });
    return Array.from(disciplines).sort();
  }, [orchestrators]);

  return (
    <div className='space-y-6'>
      {/* Stats Overview */}
      <div className='grid gap-4 md:grid-cols-6'>
        <StatsCard label='Total' value={stats.total} />
        <StatsCard label='Online' value={stats.online} color='text-green-600' />
        <StatsCard label='Busy' value={stats.busy} color='text-yellow-600' />
        <StatsCard
          label='Offline'
          value={stats.offline}
          color='text-gray-600'
        />
        <StatsCard
          label='Budget Total'
          value={`$${stats.totalBudget.toLocaleString()}`}
        />
        <StatsCard
          label='Budget Used'
          value={`$${stats.usedBudget.toLocaleString()}`}
          color={
            stats.usedBudget > stats.totalBudget * 0.8
              ? 'text-red-600'
              : 'text-blue-600'
          }
        />
      </div>

      {/* Filters and Actions */}
      <div className='flex flex-col gap-4'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex flex-1 gap-2'>
            <div className='relative flex-1 max-w-sm'>
              <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                placeholder='Search orchestrators...'
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
                <SelectItem value='ONLINE'>Online</SelectItem>
                <SelectItem value='OFFLINE'>Offline</SelectItem>
                <SelectItem value='BUSY'>Busy</SelectItem>
                <SelectItem value='AWAY'>Away</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={disciplineFilter}
              onValueChange={setDisciplineFilter}
            >
              <SelectTrigger className='w-[140px]'>
                <Filter className='h-4 w-4 mr-2' />
                <SelectValue placeholder='Discipline' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Disciplines</SelectItem>
                {uniqueDisciplines.map(discipline => (
                  <SelectItem key={discipline} value={discipline}>
                    {discipline}
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
              onClick={() =>
                router.push(`/${workspaceSlug}/admin/orchestrators/new`)
              }
            >
              <Plus className='h-4 w-4 mr-2' />
              New Orchestrator
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
                    selectedIds.size === filteredOrchestrators.length &&
                    filteredOrchestrators.length > 0
                  }
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>Orchestrator</TableHead>
              <TableHead>Discipline</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className='text-right'>Tasks</TableHead>
              <TableHead className='text-right'>Budget</TableHead>
              <TableHead className='text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className='h-4 w-4' />
                  </TableCell>
                  <TableCell>
                    <div className='flex items-center gap-3'>
                      <Skeleton className='h-10 w-10 rounded-lg' />
                      <div className='space-y-1'>
                        <Skeleton className='h-4 w-32' />
                        <Skeleton className='h-3 w-24' />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className='h-4 w-20' />
                  </TableCell>
                  <TableCell>
                    <Skeleton className='h-4 w-24' />
                  </TableCell>
                  <TableCell>
                    <Skeleton className='h-6 w-16 rounded-full' />
                  </TableCell>
                  <TableCell>
                    <Skeleton className='h-4 w-28' />
                  </TableCell>
                  <TableCell>
                    <Skeleton className='h-4 w-12 ml-auto' />
                  </TableCell>
                  <TableCell>
                    <Skeleton className='h-4 w-16 ml-auto' />
                  </TableCell>
                  <TableCell>
                    <Skeleton className='h-8 w-8 ml-auto' />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredOrchestrators.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className='text-center py-12 text-muted-foreground'
                >
                  {searchQuery ||
                  statusFilter !== 'all' ||
                  disciplineFilter !== 'all'
                    ? 'No orchestrators match the current filters.'
                    : 'No orchestrators found. Create one to get started.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredOrchestrators.map(orchestrator => (
                <TableRow key={orchestrator.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(orchestrator.id)}
                      onCheckedChange={checked =>
                        handleSelectOne(orchestrator.id, !!checked)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className='flex items-center gap-3'>
                      <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold text-sm'>
                        {orchestrator.user.avatarUrl ? (
                          <img
                            src={orchestrator.user.avatarUrl}
                            alt={orchestrator.title}
                            className='h-full w-full rounded-lg object-cover'
                          />
                        ) : (
                          orchestrator.title.substring(0, 2).toUpperCase()
                        )}
                      </div>
                      <div>
                        <p className='font-medium'>{orchestrator.title}</p>
                        <p className='text-sm text-muted-foreground'>
                          {orchestrator.organization.name}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{orchestrator.discipline || '-'}</TableCell>
                  <TableCell>
                    <span className='text-sm'>{orchestrator.role}</span>
                  </TableCell>
                  <TableCell>
                    <OrchestratorStatusBadge
                      status={orchestrator.status}
                      size='sm'
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className='text-sm font-medium'>
                        {orchestrator.user.name}
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        {orchestrator.user.email}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className='text-right'>
                    <div className='text-sm'>
                      <p className='font-medium'>
                        {orchestrator.statistics.activeTasks}
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        {orchestrator.statistics.tasksCompleted} completed
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className='text-right'>
                    <div className='text-sm'>
                      <p className='font-medium'>
                        ${orchestrator.budgetUsed?.toLocaleString() || 0}
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        of ${orchestrator.budgetLimit?.toLocaleString() || 0}
                      </p>
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
                              `/${workspaceSlug}/admin/orchestrators/${orchestrator.id}`
                            )
                          }
                        >
                          <Settings className='h-4 w-4 mr-2' />
                          Configure
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedOrchestratorId(orchestrator.id);
                            setAnalyticsDialogOpen(true);
                          }}
                        >
                          <BarChart2 className='h-4 w-4 mr-2' />
                          Analytics
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedOrchestratorId(orchestrator.id);
                            setBudgetDialogOpen(true);
                          }}
                        >
                          <DollarSign className='h-4 w-4 mr-2' />
                          Set Budget
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedOrchestratorId(orchestrator.id);
                            setPermissionsDialogOpen(true);
                          }}
                        >
                          <Users className='h-4 w-4 mr-2' />
                          Permissions
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            handleToggleStatus(
                              orchestrator.id,
                              orchestrator.status
                            )
                          }
                        >
                          <Power className='h-4 w-4 mr-2' />
                          {orchestrator.status === 'ONLINE'
                            ? 'Disable'
                            : 'Enable'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className='text-red-600'
                          onClick={() => {
                            setOrchestratorToDelete(orchestrator.id);
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
      <BudgetSettingsDialog
        open={budgetDialogOpen}
        onOpenChange={setBudgetDialogOpen}
        orchestratorId={selectedOrchestratorId}
        workspaceSlug={workspaceSlug}
        onSuccess={fetchOrchestrators}
      />

      <PermissionsDialog
        open={permissionsDialogOpen}
        onOpenChange={setPermissionsDialogOpen}
        orchestratorId={selectedOrchestratorId}
        workspaceSlug={workspaceSlug}
        onSuccess={fetchOrchestrators}
      />

      <DefaultSettingsDialog
        open={defaultSettingsDialogOpen}
        onOpenChange={setDefaultSettingsDialogOpen}
        workspaceSlug={workspaceSlug}
      />

      <OrchestratorAnalytics
        open={analyticsDialogOpen}
        onOpenChange={setAnalyticsDialogOpen}
        orchestratorId={selectedOrchestratorId}
        workspaceSlug={workspaceSlug}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Orchestrator</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this orchestrator? This action
              cannot be undone and will remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (orchestratorToDelete) {
                  handleDelete(orchestratorToDelete);
                  setDeleteDialogOpen(false);
                  setOrchestratorToDelete(null);
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
