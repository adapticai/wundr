'use client';

import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  MoreHorizontal,
  Download,
  UserPlus,
  Mail,
  Shield,
  Ban,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  Filter,
  Search,
  X,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UserAvatar } from '@/components/ui/user-avatar';
import { usePageHeader } from '@/contexts/page-header-context';

type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING';
type UserRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';

interface WorkspaceUser {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    status: string;
    lastActiveAt: string | null;
  };
  role: UserRole;
  status: UserStatus;
  joinedAt: string;
  lastActivity: string | null;
  permissions: string[];
}

interface UserActivity {
  date: string;
  action: string;
  resource: string;
  details: string;
}

export default function AdminUsersPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceSlug = params.workspaceSlug as string;
  const { setPageHeader } = usePageHeader();

  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Detail sidebar
  const [selectedUser, setSelectedUser] = useState<WorkspaceUser | null>(null);
  const [userActivity, setUserActivity] = useState<UserActivity[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  // Bulk actions
  const [bulkActionDialog, setBulkActionDialog] = useState<{
    open: boolean;
    action: 'suspend' | 'activate' | 'remove' | 'changeRole' | null;
    targetRole?: UserRole;
  }>({ open: false, action: null });

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Remove user confirmation
  const [removeConfirmUserId, setRemoveConfirmUserId] = useState<string | null>(
    null
  );

  // Change role dialog
  const [changeRoleDialog, setChangeRoleDialog] = useState<{
    open: boolean;
    userId: string | null;
    currentRole: UserRole | null;
    selectedRole: UserRole;
  }>({ open: false, userId: null, currentRole: null, selectedRole: 'MEMBER' });

  useEffect(() => {
    setPageHeader('User Management', 'Manage workspace users and permissions');
  }, [setPageHeader]);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(pagination.pageSize),
        offset: String(pagination.pageIndex * pagination.pageSize),
      });

      if (searchQuery) {
        params.set('search', searchQuery);
      }
      if (roleFilter !== 'all') {
        params.set('role', roleFilter);
      }
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/users?${params.toString()}`
      );

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setTotal(data.total || 0);
      } else {
        toast.error('Failed to fetch users');
      }
    } catch (error) {
      toast.error('Error loading users');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceSlug, pagination, searchQuery, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const fetchUserActivity = useCallback(
    async (userId: string) => {
      setLoadingActivity(true);
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/admin/users/${userId}/activity`
        );
        if (response.ok) {
          const data = await response.json();
          setUserActivity(data.activities || []);
        }
      } catch (error) {
        console.error('Failed to fetch activity:', error);
      } finally {
        setLoadingActivity(false);
      }
    },
    [workspaceSlug]
  );

  const handleViewDetails = (user: WorkspaceUser) => {
    setSelectedUser(user);
    fetchUserActivity(user.userId);
  };

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/users/${userId}/role`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: newRole }),
        }
      );

      if (response.ok) {
        toast.success('Role updated successfully');
        fetchUsers();
        setSelectedUser(null);
      } else {
        toast.error('Failed to update role');
      }
    } catch (error) {
      toast.error('Error updating role');
      console.error(error);
    }
  };

  const handleSuspendUser = async (userId: string) => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/users/${userId}/suspend`,
        { method: 'POST' }
      );

      if (response.ok) {
        toast.success('User suspended');
        fetchUsers();
      } else {
        toast.error('Failed to suspend user');
      }
    } catch (error) {
      toast.error('Error suspending user');
      console.error(error);
    }
  };

  const handleActivateUser = async (userId: string) => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/users/${userId}/activate`,
        { method: 'POST' }
      );

      if (response.ok) {
        toast.success('User activated');
        fetchUsers();
      } else {
        toast.error('Failed to activate user');
      }
    } catch (error) {
      toast.error('Error activating user');
      console.error(error);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/users/${userId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        toast.success('User removed from workspace');
        fetchUsers();
      } else {
        toast.error('Failed to remove user');
      }
    } catch (error) {
      toast.error('Error removing user');
      console.error(error);
    }
  };

  const handleBulkAction = async () => {
    const { action, targetRole } = bulkActionDialog;
    if (!action) {
      return;
    }

    const selectedUserIds = Object.keys(rowSelection)
      .filter(key => rowSelection[key as keyof typeof rowSelection])
      .map(index => users[parseInt(index)].userId);

    if (selectedUserIds.length === 0) {
      toast.error('No users selected');
      return;
    }

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/users/bulk`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userIds: selectedUserIds,
            action,
            ...(targetRole && { role: targetRole }),
          }),
        }
      );

      if (response.ok) {
        toast.success(
          `Bulk action completed for ${selectedUserIds.length} user(s)`
        );
        setRowSelection({});
        fetchUsers();
      } else {
        toast.error('Bulk action failed');
      }
    } catch (error) {
      toast.error('Error performing bulk action');
      console.error(error);
    } finally {
      setBulkActionDialog({ open: false, action: null });
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/users/export`
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `users-${workspaceSlug}-${new Date().toISOString()}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Users exported successfully');
      } else {
        toast.error('Failed to export users');
      }
    } catch (error) {
      toast.error('Error exporting users');
      console.error(error);
    }
  };

  const columns: ColumnDef<WorkspaceUser>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={value => table.toggleAllPageRowsSelected(!!value)}
          aria-label='Select all'
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={value => row.toggleSelected(!!value)}
          aria-label='Select row'
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'user',
      header: 'User',
      cell: ({ row }) => {
        const user = row.original.user;
        return (
          <div className='flex items-center gap-3'>
            <UserAvatar
              user={{ name: user.name, image: user.avatarUrl }}
              size='lg'
            />
            <div className='min-w-0'>
              <div className='font-medium truncate'>
                {user.displayName || user.name || 'Unknown'}
              </div>
              <div className='text-sm text-muted-foreground truncate'>
                {user.email}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => {
        const role = row.original.role;
        const roleColors = {
          OWNER:
            'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
          ADMIN:
            'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
          MEMBER:
            'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
          GUEST:
            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
        };
        return (
          <Badge variant='outline' className={roleColors[role]}>
            {role}
          </Badge>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        const statusConfig = {
          ACTIVE: {
            icon: CheckCircle,
            className:
              'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
          },
          SUSPENDED: {
            icon: Ban,
            className:
              'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
          },
          PENDING: {
            icon: Clock,
            className:
              'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
          },
        };
        const config = statusConfig[status];
        const Icon = config.icon;
        return (
          <Badge variant='outline' className={config.className}>
            <Icon className='mr-1 h-3 w-3' />
            {status}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'joinedAt',
      header: 'Joined',
      cell: ({ row }) => {
        const date = new Date(row.original.joinedAt);
        return (
          <div className='text-sm text-muted-foreground'>
            {date.toLocaleDateString()}
          </div>
        );
      },
    },
    {
      accessorKey: 'lastActivity',
      header: 'Last Active',
      cell: ({ row }) => {
        const lastActivity = row.original.user.lastActiveAt;
        if (!lastActivity) {
          return <span className='text-sm text-muted-foreground'>Never</span>;
        }

        const date = new Date(lastActivity);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        let displayText = '';
        if (diffMins < 1) {
          displayText = 'Just now';
        } else if (diffMins < 60) {
          displayText = `${diffMins}m ago`;
        } else if (diffHours < 24) {
          displayText = `${diffHours}h ago`;
        } else if (diffDays < 7) {
          displayText = `${diffDays}d ago`;
        } else {
          displayText = date.toLocaleDateString();
        }

        return (
          <div className='text-sm text-muted-foreground'>{displayText}</div>
        );
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const user = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' className='h-8 w-8 p-0'>
                <span className='sr-only'>Open menu</span>
                <MoreHorizontal className='h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleViewDetails(user)}>
                View Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  setChangeRoleDialog({
                    open: true,
                    userId: user.userId,
                    currentRole: user.role,
                    selectedRole: user.role,
                  })
                }
              >
                Change Role
              </DropdownMenuItem>
              {user.status === 'ACTIVE' ? (
                <DropdownMenuItem
                  onClick={() => handleSuspendUser(user.userId)}
                >
                  <Ban className='mr-2 h-4 w-4' />
                  Suspend User
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => handleActivateUser(user.userId)}
                >
                  <CheckCircle className='mr-2 h-4 w-4' />
                  Activate User
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className='text-red-600'
                onClick={() => setRemoveConfirmUserId(user.userId)}
              >
                <Trash2 className='mr-2 h-4 w-4' />
                Remove User
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    manualPagination: true,
    pageCount: Math.ceil(total / pagination.pageSize),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
    },
  });

  const selectedCount = Object.keys(rowSelection).length;

  return (
    <div className='space-y-4'>
      {/* Header Actions */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <div className='relative w-72'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
            <Input
              placeholder='Search users...'
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className='pl-9'
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className='w-32'>
              <SelectValue placeholder='Role' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Roles</SelectItem>
              <SelectItem value='OWNER'>Owner</SelectItem>
              <SelectItem value='ADMIN'>Admin</SelectItem>
              <SelectItem value='MEMBER'>Member</SelectItem>
              <SelectItem value='GUEST'>Guest</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className='w-32'>
              <SelectValue placeholder='Status' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Status</SelectItem>
              <SelectItem value='ACTIVE'>Active</SelectItem>
              <SelectItem value='SUSPENDED'>Suspended</SelectItem>
              <SelectItem value='PENDING'>Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className='flex items-center gap-2'>
          <Button variant='outline' size='sm' onClick={handleExport}>
            <Download className='mr-2 h-4 w-4' />
            Export
          </Button>
          <Button size='sm' onClick={() => setShowInviteModal(true)}>
            <UserPlus className='mr-2 h-4 w-4' />
            Invite Users
          </Button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedCount > 0 && (
        <div className='flex items-center gap-2 rounded-lg bg-muted p-3'>
          <span className='text-sm font-medium'>{selectedCount} selected</span>
          <Button
            size='sm'
            variant='outline'
            onClick={() =>
              setBulkActionDialog({
                open: true,
                action: 'changeRole',
                targetRole: 'MEMBER',
              })
            }
          >
            <Shield className='mr-2 h-4 w-4' />
            Change Role
          </Button>
          <Button
            size='sm'
            variant='outline'
            onClick={() =>
              setBulkActionDialog({ open: true, action: 'suspend' })
            }
          >
            <Ban className='mr-2 h-4 w-4' />
            Suspend
          </Button>
          <Button
            size='sm'
            variant='outline'
            onClick={() =>
              setBulkActionDialog({ open: true, action: 'remove' })
            }
            className='text-red-600 hover:text-red-700'
          >
            <Trash2 className='mr-2 h-4 w-4' />
            Remove
          </Button>
          <Button
            size='sm'
            variant='ghost'
            onClick={() => setRowSelection({})}
            className='ml-auto'
          >
            <X className='mr-2 h-4 w-4' />
            Clear
          </Button>
        </div>
      )}

      {/* Data Table */}
      <div className='rounded-lg border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className='h-8 w-full' />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center'
                >
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className='flex items-center justify-between'>
        <div className='text-sm text-muted-foreground'>
          Showing {pagination.pageIndex * pagination.pageSize + 1} to{' '}
          {Math.min((pagination.pageIndex + 1) * pagination.pageSize, total)} of{' '}
          {total} users
        </div>
        <div className='flex items-center gap-2'>
          <Select
            value={String(pagination.pageSize)}
            onValueChange={value => table.setPageSize(Number(value))}
          >
            <SelectTrigger className='w-24'>
              <SelectValue placeholder={pagination.pageSize} />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 30, 40, 50].map(pageSize => (
                <SelectItem key={pageSize} value={String(pageSize)}>
                  {pageSize} rows
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant='outline'
              size='sm'
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* User Detail Sidebar */}
      <Sheet open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <SheetContent className='sm:max-w-lg overflow-y-auto'>
          {selectedUser && (
            <>
              <SheetHeader>
                <SheetTitle>User Details</SheetTitle>
                <SheetDescription>
                  View and manage user information
                </SheetDescription>
              </SheetHeader>
              <div className='mt-6 space-y-6'>
                {/* User Info */}
                <div className='flex items-start gap-4'>
                  <UserAvatar
                    user={{
                      name: selectedUser.user.name,
                      image: selectedUser.user.avatarUrl,
                    }}
                    size='xl'
                  />
                  <div className='min-w-0 flex-1'>
                    <h3 className='font-semibold truncate'>
                      {selectedUser.user.displayName || selectedUser.user.name}
                    </h3>
                    <p className='text-sm text-muted-foreground truncate'>
                      {selectedUser.user.email}
                    </p>
                    <div className='mt-2 flex gap-2'>
                      <Badge variant='outline'>{selectedUser.role}</Badge>
                      <Badge variant='outline'>{selectedUser.status}</Badge>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className='space-y-2'>
                  <h4 className='text-sm font-medium'>Quick Actions</h4>
                  <div className='flex flex-col gap-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      className='w-full justify-start'
                      onClick={() => {
                        setChangeRoleDialog({
                          open: true,
                          userId: selectedUser.userId,
                          currentRole: selectedUser.role,
                          selectedRole: selectedUser.role,
                        });
                        setSelectedUser(null);
                      }}
                    >
                      <Shield className='mr-2 h-4 w-4' />
                      Change Role
                    </Button>
                    {selectedUser.status === 'ACTIVE' ? (
                      <Button
                        variant='outline'
                        size='sm'
                        className='w-full justify-start text-yellow-600 hover:text-yellow-700'
                        onClick={() => {
                          handleSuspendUser(selectedUser.userId);
                          setSelectedUser(null);
                        }}
                      >
                        <Ban className='mr-2 h-4 w-4' />
                        Suspend User
                      </Button>
                    ) : (
                      <Button
                        variant='outline'
                        size='sm'
                        className='w-full justify-start text-green-600 hover:text-green-700'
                        onClick={() => {
                          handleActivateUser(selectedUser.userId);
                          setSelectedUser(null);
                        }}
                      >
                        <CheckCircle className='mr-2 h-4 w-4' />
                        Activate User
                      </Button>
                    )}
                  </div>
                </div>

                {/* Activity Timeline */}
                <div className='space-y-2'>
                  <h4 className='text-sm font-medium'>Recent Activity</h4>
                  {loadingActivity ? (
                    <div className='space-y-2'>
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className='h-16 w-full' />
                      ))}
                    </div>
                  ) : userActivity.length > 0 ? (
                    <div className='space-y-3'>
                      {userActivity.map((activity, i) => (
                        <div key={i} className='flex gap-3 text-sm'>
                          <div className='flex flex-col items-center'>
                            <div className='rounded-full bg-primary/10 p-1'>
                              <AlertCircle className='h-3 w-3 text-primary' />
                            </div>
                            {i < userActivity.length - 1 && (
                              <div className='w-px flex-1 bg-border mt-1' />
                            )}
                          </div>
                          <div className='flex-1 pb-3'>
                            <p className='font-medium'>{activity.action}</p>
                            <p className='text-muted-foreground'>
                              {activity.details}
                            </p>
                            <p className='text-xs text-muted-foreground mt-1'>
                              {new Date(activity.date).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className='text-sm text-muted-foreground'>
                      No recent activity
                    </p>
                  )}
                </div>

                {/* Permissions */}
                <div className='space-y-2'>
                  <h4 className='text-sm font-medium'>Permissions</h4>
                  <div className='rounded-lg border p-3 text-sm'>
                    <ul className='space-y-1'>
                      {selectedUser.permissions.length > 0 ? (
                        selectedUser.permissions.map((perm, i) => (
                          <li key={i} className='flex items-center gap-2'>
                            <CheckCircle className='h-4 w-4 text-green-500' />
                            <span>{perm}</span>
                          </li>
                        ))
                      ) : (
                        <li className='text-muted-foreground'>
                          No special permissions
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Bulk Action Confirmation Dialog */}
      <AlertDialog
        open={bulkActionDialog.open}
        onOpenChange={open =>
          !open && setBulkActionDialog({ open: false, action: null })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Action</AlertDialogTitle>
            <AlertDialogDescription>
              {bulkActionDialog.action === 'remove' &&
                `Are you sure you want to remove ${selectedCount} user(s) from this workspace? This action cannot be undone.`}
              {bulkActionDialog.action === 'suspend' &&
                `Are you sure you want to suspend ${selectedCount} user(s)?`}
              {bulkActionDialog.action === 'activate' &&
                `Are you sure you want to activate ${selectedCount} user(s)?`}
              {bulkActionDialog.action === 'changeRole' &&
                `Are you sure you want to change the role for ${selectedCount} user(s)?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkAction}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Role Dialog */}
      <AlertDialog
        open={changeRoleDialog.open}
        onOpenChange={open =>
          !open &&
          setChangeRoleDialog({
            open: false,
            userId: null,
            currentRole: null,
            selectedRole: 'MEMBER',
          })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change User Role</AlertDialogTitle>
            <AlertDialogDescription>
              Select a new role for this user.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className='py-4'>
            <Select
              value={changeRoleDialog.selectedRole}
              onValueChange={value =>
                setChangeRoleDialog(prev => ({
                  ...prev,
                  selectedRole: value as UserRole,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder='Select role' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='OWNER'>Owner</SelectItem>
                <SelectItem value='ADMIN'>Admin</SelectItem>
                <SelectItem value='MEMBER'>Member</SelectItem>
                <SelectItem value='GUEST'>Guest</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (changeRoleDialog.userId && changeRoleDialog.selectedRole) {
                  await handleUpdateRole(
                    changeRoleDialog.userId,
                    changeRoleDialog.selectedRole
                  );
                  setChangeRoleDialog({
                    open: false,
                    userId: null,
                    currentRole: null,
                    selectedRole: 'MEMBER',
                  });
                }
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invite Users Modal */}
      <AlertDialog
        open={showInviteModal}
        onOpenChange={open => !open && setShowInviteModal(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Invite New Members</AlertDialogTitle>
            <AlertDialogDescription>
              Send email invitations and assign roles from the Members page,
              which gives you full control over the invite flow.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowInviteModal(false);
                router.push(`/${workspaceSlug}/admin/members?invite=true`);
              }}
            >
              Go to Members
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove User Confirmation Dialog */}
      <AlertDialog
        open={removeConfirmUserId !== null}
        onOpenChange={open => !open && setRemoveConfirmUserId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this user from the workspace? They
              will lose access immediately. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRemoveConfirmUserId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className='bg-red-600 hover:bg-red-700'
              onClick={async () => {
                if (removeConfirmUserId) {
                  await handleRemoveUser(removeConfirmUserId);
                  setRemoveConfirmUserId(null);
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
