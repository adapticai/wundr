# Admin Hooks

Comprehensive React hooks for managing workspace administration, built with SWR for optimal caching
and real-time updates.

## Overview

The admin hooks provide a complete suite of tools for workspace administration including:

- Dashboard statistics and analytics
- User management with filtering and bulk operations
- Audit log tracking and export
- Permission checking and role-based access control
- Workspace settings management
- Billing and subscription management

## Hooks

### 1. `useAdminStats`

Fetch comprehensive dashboard statistics with growth metrics and activity trends.

```tsx
import { useAdminStats } from '@/hooks/admin';

function Dashboard() {
  const { stats, isLoading, refresh } = useAdminStats('workspace-123', {
    timeRange: '30d',
    refreshInterval: 60000, // Auto-refresh every minute
  });

  if (isLoading) return <Skeleton />;

  return (
    <div>
      <StatCard
        title='Active Users'
        value={stats.activeUsers.current}
        change={stats.activeUsers.percentageChange}
        trend={stats.activeUsers.isPositive ? 'up' : 'down'}
      />
      <ActivityChart data={stats.activityTrends} />
      <TopContributors users={stats.topContributors} />
    </div>
  );
}
```

**Features:**

- Growth metrics with percentage changes
- Activity trends over time
- Storage and API usage tracking
- Top contributors leaderboard
- Configurable time ranges (24h, 7d, 30d, 90d)
- Optional auto-refresh

### 2. `useAdminUsers`

Manage workspace users with advanced filtering, pagination, and bulk operations.

```tsx
import { useAdminUsers } from '@/hooks/admin';

function UsersPage() {
  const {
    users,
    pagination,
    filters,
    setFilters,
    updateUser,
    suspendUser,
    bulkUpdate,
    isUpdating,
  } = useAdminUsers('workspace-123', {
    status: 'active',
    limit: 20,
  });

  const handleBulkSuspend = async (userIds: string[]) => {
    await bulkUpdate(userIds, { status: 'suspended' });
    toast.success(`Suspended ${userIds.length} users`);
  };

  return (
    <div>
      <UserFilters filters={filters} onChange={setFilters} />
      <UserTable users={users} onUpdate={updateUser} onSuspend={suspendUser} loading={isUpdating} />
      <Pagination {...pagination} />
    </div>
  );
}
```

**Features:**

- Advanced filtering (status, role, search)
- Pagination with keepPreviousData
- Update, suspend, unsuspend, delete operations
- Bulk operations for multiple users
- Optimistic updates
- Loading states for all actions

### 3. `useAdminAudit`

Access and export audit logs with comprehensive filtering.

```tsx
import { useAdminAudit } from '@/hooks/admin';

function AuditLogPage() {
  const { logs, pagination, filters, setFilters, exportLogs, isExporting } = useAdminAudit(
    'workspace-123',
    {
      action: 'user.login',
      startDate: new Date('2024-01-01'),
    }
  );

  return (
    <div>
      <AuditFilters filters={filters} onChange={setFilters} />
      <Button onClick={() => exportLogs('csv')} loading={isExporting}>
        Export CSV
      </Button>
      <Button onClick={() => exportLogs('json')} loading={isExporting}>
        Export JSON
      </Button>
      <AuditTable logs={logs} />
      <Pagination {...pagination} />
    </div>
  );
}
```

**Features:**

- Filter by action, actor, target, date range
- Export to CSV or JSON
- Pagination with large page sizes (50+ items)
- Actor and target information included
- IP address and user agent tracking
- Metadata support for detailed context

### 4. `useAdminPermissions`

Check and validate user permissions with granular control.

```tsx
import { useAdminPermissions, PermissionGuard } from '@/hooks/admin';

function AdminPanel() {
  const { can, canAll, canAny, permissions } = useAdminPermissions('workspace-123');

  // Single permission check
  const canDeleteUsers = can('user', 'delete');

  // Multiple checks
  const canManageBilling = canAll([
    { resource: 'billing', action: 'read' },
    { resource: 'billing', action: 'update' },
  ]);

  // Any of multiple checks
  const canModerate = canAny([
    { resource: 'user', action: 'update' },
    { resource: 'channel', action: 'delete' },
  ]);

  return (
    <div>
      {canDeleteUsers && <Button danger>Delete Users</Button>}

      <PermissionGuard
        can={can}
        resource='settings'
        action='update'
        fallback={<div>No access</div>}
      >
        <SettingsPanel />
      </PermissionGuard>

      {permissions?.isOwner && <OwnerOnlyFeatures />}
    </div>
  );
}
```

**Features:**

- Single permission checks with `can()`
- Bulk permission checks with `canMultiple()`
- Logical operations with `canAny()` and `canAll()`
- PermissionGuard component for conditional rendering
- Owner and admin flags
- Wildcard permission support
- Cached for performance (1 minute)

### 5. `useAdminSettings`

Manage workspace settings across multiple sections.

```tsx
import { useAdminSettings } from '@/hooks/admin';

function SettingsPage() {
  const {
    settings,
    updateGeneral,
    updateSecurity,
    updateNotifications,
    resetSettings,
    isUpdating,
  } = useAdminSettings('workspace-123');

  return (
    <Tabs>
      <TabPanel title='General'>
        <GeneralSettingsForm
          data={settings?.general}
          onSubmit={updateGeneral}
          loading={isUpdating}
        />
      </TabPanel>

      <TabPanel title='Security'>
        <SecuritySettingsForm data={settings?.security} onSubmit={updateSecurity} />
        <Button onClick={() => resetSettings('security')} variant='ghost'>
          Reset to Defaults
        </Button>
      </TabPanel>

      <TabPanel title='Notifications'>
        <NotificationSettingsForm data={settings?.notifications} onSubmit={updateNotifications} />
      </TabPanel>
    </Tabs>
  );
}
```

**Features:**

- Section-specific updates (general, notifications, security, integrations)
- Custom fields support
- Reset to defaults functionality
- Optimistic updates
- Type-safe settings interfaces

### 6. `useAdminBilling`

Manage billing, subscriptions, and plan changes.

```tsx
import { useAdminBilling } from '@/hooks/admin';

function BillingPage() {
  const { billing, availablePlans, changePlan, previewPlanChange, cancelSubscription, isUpdating } =
    useAdminBilling('workspace-123');

  const handleUpgrade = async (plan: PlanType) => {
    // Preview the change first
    const preview = await previewPlanChange({
      plan,
      interval: 'monthly',
      prorate: true,
    });

    // Confirm with user
    const confirmed = confirm(`You will be charged $${preview.nextInvoiceAmount / 100}. Continue?`);

    if (confirmed) {
      await changePlan({ plan, interval: 'monthly' });
      toast.success('Plan upgraded successfully');
    }
  };

  return (
    <div>
      <CurrentPlanCard billing={billing} />
      <UsageMetrics usage={billing?.usage} />
      <PlanSelector plans={availablePlans} currentPlan={billing?.plan} onSelect={handleUpgrade} />
    </div>
  );
}
```

**Features:**

- Current plan and subscription status
- Usage metrics with limits
- Available plans with pricing
- Plan change with preview
- Proration calculation
- Cancel and reactivate subscription
- Payment method management
- Next invoice information

## Utility Libraries

### Permission Utilities (`/lib/admin/permissions.ts`)

```tsx
import {
  hasPermission,
  checkMultiplePermissions,
  hasAnyPermission,
  hasAllPermissions,
  isDangerousPermission,
  comparePermissions,
  validatePermissions,
  mergePermissions,
  DEFAULT_ROLE_PERMISSIONS,
  SYSTEM_ROLES,
} from '@/lib/admin/permissions';

// Check permission
const canDelete = hasPermission(userPerms, 'user', 'delete');

// Bulk check
const results = checkMultiplePermissions(userPerms, [
  { resource: 'user', action: 'create' },
  { resource: 'user', action: 'delete' },
]);

// Validate dangerous operations
if (isDangerousPermission('workspace', 'delete')) {
  // Show confirmation dialog
}

// Compare permission changes
const { added, removed } = comparePermissions(oldPerms, newPerms);

// Use default role permissions
const adminPerms = DEFAULT_ROLE_PERMISSIONS[SYSTEM_ROLES.ADMIN];
```

### Audit Utilities (`/lib/admin/audit.ts`)

```tsx
import {
  formatAuditAction,
  getAuditSeverity,
  getAuditCategory,
  formatAuditTimestamp,
  groupLogsByDate,
  groupLogsByCategory,
  getAuditStats,
  AuditSeverity,
  AuditCategory,
} from '@/lib/admin/audit';

// Format log for display
const description = formatAuditAction(log);
// "John Doe suspended user jane@example.com"

// Get metadata
const severity = getAuditSeverity(log.action);
const category = getAuditCategory(log.action);

// Format timestamp
const timestamp = formatAuditTimestamp(log.createdAt, {
  relative: true,
}); // "2 hours ago"

// Group logs
const byDate = groupLogsByDate(logs);
const byCategory = groupLogsByCategory(logs);

// Analyze logs
const stats = getAuditStats(logs);
console.log(stats.topActors); // Most active users
console.log(stats.bySeverity); // Severity breakdown
```

## Type Definitions

All types are exported from `/types/admin.ts`:

```tsx
import type {
  DashboardStats,
  GrowthMetric,
  AdminUser,
  UserFilters,
  PaginatedUsers,
  AuditLog,
  AuditLogFilters,
  PaginatedAuditLogs,
  Permission,
  PermissionResource,
  PermissionAction,
  WorkspaceAdminSettings,
  AdminBillingInfo,
  UsageMetrics,
  AvailablePlan,
  PlanType,
} from '@/types/admin';
```

## API Endpoints

The hooks expect the following API endpoints to be implemented:

### Statistics

- `GET /api/workspaces/:id/admin/stats?timeRange=30d`

### Users

- `GET /api/workspaces/:id/admin/users?status=active&page=1&limit=20`
- `PATCH /api/workspaces/:id/admin/users/:userId`
- `POST /api/workspaces/:id/admin/users/:userId/suspend`
- `POST /api/workspaces/:id/admin/users/:userId/unsuspend`
- `DELETE /api/workspaces/:id/admin/users/:userId`
- `PATCH /api/workspaces/:id/admin/users/bulk`

### Audit Logs

- `GET /api/workspaces/:id/admin/audit?action=user.login&page=1`
- `GET /api/workspaces/:id/admin/audit/export?format=csv`

### Permissions

- `GET /api/workspaces/:id/admin/permissions?userId=123`

### Settings

- `GET /api/workspaces/:id/admin/settings`
- `PATCH /api/workspaces/:id/admin/settings`
- `POST /api/workspaces/:id/admin/settings/reset?section=security`

### Billing

- `GET /api/workspaces/:id/admin/billing`
- `GET /api/workspaces/:id/admin/billing/plans`
- `PUT /api/workspaces/:id/admin/billing/plan`
- `POST /api/workspaces/:id/admin/billing/plan/preview`
- `POST /api/workspaces/:id/admin/billing/subscription/cancel`
- `POST /api/workspaces/:id/admin/billing/subscription/reactivate`

## Best Practices

1. **Error Handling**: Always wrap async operations in try-catch blocks

   ```tsx
   try {
     await updateUser(userId, updates);
     toast.success('User updated');
   } catch (error) {
     toast.error(error.message);
   }
   ```

2. **Permission Checks**: Check permissions before rendering admin UI

   ```tsx
   const { can } = useAdminPermissions(workspaceId);

   if (!can('user', 'delete')) {
     return <AccessDenied />;
   }
   ```

3. **Optimistic Updates**: All mutation hooks use optimistic updates via SWR's `mutate()`

4. **Loading States**: Use `isLoading` and `isUpdating` flags for UI feedback

5. **Pagination**: Use `keepPreviousData` option in SWR for smooth pagination

6. **Caching**: Stats and permissions have longer cache times for performance

## Examples

### Complete Admin Dashboard

```tsx
import { useAdminStats, useAdminUsers, useAdminPermissions } from '@/hooks/admin';

function AdminDashboard({ workspaceId }: { workspaceId: string }) {
  const { stats, isLoading: statsLoading } = useAdminStats(workspaceId);
  const { users } = useAdminUsers(workspaceId, { limit: 5 });
  const { can } = useAdminPermissions(workspaceId);

  if (statsLoading) return <DashboardSkeleton />;

  return (
    <div className='grid grid-cols-3 gap-4'>
      <StatCard {...stats.activeUsers} />
      <StatCard {...stats.totalMembers} />
      <StatCard {...stats.totalChannels} />

      <div className='col-span-2'>
        <ActivityChart data={stats.activityTrends} />
      </div>

      <div>
        <RecentUsers users={users} />
        {can('user', 'create') && <Button>Add User</Button>}
      </div>
    </div>
  );
}
```

## Testing

All hooks are designed to be easily testable with mocked SWR:

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { useAdminUsers } from '@/hooks/admin';

jest.mock('swr');

test('fetches and displays users', async () => {
  const mockUsers = [{ id: '1', name: 'John', email: 'john@example.com' }];

  (useSWR as jest.Mock).mockReturnValue({
    data: { users: mockUsers, pagination: {} },
    error: null,
    isLoading: false,
  });

  const { result } = renderHook(() => useAdminUsers('workspace-123'));

  await waitFor(() => {
    expect(result.current.users).toEqual(mockUsers);
  });
});
```

## License

Part of the Neolith workspace management platform.
