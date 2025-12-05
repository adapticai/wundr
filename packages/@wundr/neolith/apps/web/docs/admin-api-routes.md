# Admin API Routes Documentation

Comprehensive admin API routes for workspace administration and monitoring.

## Overview

The admin API provides powerful endpoints for workspace administrators and owners to:

- Monitor dashboard statistics and metrics
- Check system health status
- Execute administrative actions
- View activity logs and audit trails

All admin routes require **ADMIN** or **OWNER** role authorization.

## Authentication & Authorization

### Authorization Middleware

The admin routes use a centralized authorization system:

```typescript
import { requireWorkspaceAdmin } from '@/lib/admin/authorization';

// In your route handler
const { session, workspace, membership } = await requireWorkspaceAdmin(workspaceSlug);
```

### Role Hierarchy

- **OWNER** (Level 3) - Full control, can modify admins
- **ADMIN** (Level 2) - Can manage members, channels, settings
- **MEMBER** (Level 1) - Basic access
- **GUEST** (Level 0) - Read-only access

### Permissions

Owners can:

- Delete/transfer workspace
- Modify billing settings
- Manage all members and channels
- Execute all admin actions
- Export audit logs

Admins can:

- Modify workspace settings
- Invite/remove members
- Create/archive channels
- Execute admin actions
- View audit logs

## API Routes

### 1. GET /api/workspaces/[workspaceSlug]/admin/stats

Get comprehensive dashboard statistics.

**Response:**

```typescript
interface DashboardStats {
  members: {
    total: number;
    active: number;
    suspended: number;
    pending: number;
    growth: {
      thisWeek: number;
      lastWeek: number;
      percentageChange: number;
    };
    byRole: Record<string, number>;
  };
  channels: {
    total: number;
    public: number;
    private: number;
    archived: number;
    growth: {
      thisMonth: number;
      lastMonth: number;
      percentageChange: number;
    };
  };
  messages: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    averagePerDay: number;
    growth: {
      thisWeek: number;
      lastWeek: number;
      percentageChange: number;
    };
    topContributors: Array<{
      userId: string;
      userName: string | null;
      messageCount: number;
    }>;
  };
  orchestrators: {
    total: number;
    online: number;
    busy: number;
    offline: number;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    averageResponseTime: number;
  };
  storage: {
    totalFiles: number;
    totalSize: number;
    sizeLimit: number;
    percentageUsed: number;
    byType: Record<string, { count: number; size: number }>;
    growth: {
      thisMonth: number;
      lastMonth: number;
      percentageChange: number;
    };
  };
  generatedAt: Date;
}
```

**Example:**

```bash
curl -X GET https://api.example.com/api/workspaces/my-workspace/admin/stats \
  -H "Authorization: Bearer <token>"
```

---

### 2. GET /api/workspaces/[workspaceSlug]/admin/health

Get system health status for the workspace.

**Response:**

```typescript
interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  services: {
    database: {
      status: 'healthy' | 'degraded' | 'down';
      latency?: number;
      error?: string;
      lastChecked: Date;
    };
    redis: {
      status: 'healthy' | 'degraded' | 'down';
      latency?: number;
      error?: string;
      lastChecked: Date;
    };
    storage: {
      status: 'healthy' | 'degraded' | 'down';
      error?: string;
      lastChecked: Date;
    };
  };
  resources: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    storage: {
      used: number;
      limit: number;
      percentage: number;
    };
  };
  uptime: number;
  version: string;
  timestamp: Date;
}
```

**Health Status Thresholds:**

- Database: healthy < 100ms, degraded < 500ms, down >= 500ms
- Redis: healthy < 50ms, degraded < 200ms, down >= 200ms
- Storage: healthy < 80%, degraded < 95%, down >= 95%

**Example:**

```bash
curl -X GET https://api.example.com/api/workspaces/my-workspace/admin/health \
  -H "Authorization: Bearer <token>"
```

---

### 3. POST /api/workspaces/[workspaceSlug]/admin/actions

Execute administrative actions on the workspace.

**Request Body:**

```typescript
interface AdminActionRequest {
  action:
    | 'maintenance.enable'
    | 'maintenance.disable'
    | 'cache.clear'
    | 'analytics.regenerate'
    | 'members.bulk_suspend'
    | 'members.bulk_restore'
    | 'channels.bulk_archive'
    | 'channels.bulk_unarchive'
    | 'orchestrators.restart_all'
    | 'storage.cleanup_orphaned'
    | 'audit.export';
  targetIds?: string[];
  reason?: string;
  metadata?: Record<string, unknown>;
}
```

**Response:**

```typescript
interface ActionResult {
  success: boolean;
  message: string;
  affectedCount?: number;
  details?: Record<string, unknown>;
}
```

**Available Actions:**

#### Maintenance Actions

- `maintenance.enable` - Enable maintenance mode
- `maintenance.disable` - Disable maintenance mode

#### System Actions

- `cache.clear` - Clear Redis cache for workspace
- `analytics.regenerate` - Trigger analytics regeneration

#### Member Actions (requires targetIds)

- `members.bulk_suspend` - Suspend multiple members
- `members.bulk_restore` - Restore suspended members

#### Channel Actions (requires targetIds)

- `channels.bulk_archive` - Archive multiple channels
- `channels.bulk_unarchive` - Unarchive channels

#### Orchestrator Actions

- `orchestrators.restart_all` - Restart all orchestrators

#### Storage Actions

- `storage.cleanup_orphaned` - Remove orphaned files

#### Audit Actions

- `audit.export` - Export audit logs

**Examples:**

Enable maintenance mode:

```bash
curl -X POST https://api.example.com/api/workspaces/my-workspace/admin/actions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "maintenance.enable",
    "reason": "Scheduled maintenance"
  }'
```

Bulk suspend members:

```bash
curl -X POST https://api.example.com/api/workspaces/my-workspace/admin/actions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "members.bulk_suspend",
    "targetIds": ["user1", "user2", "user3"],
    "reason": "Policy violation"
  }'
```

Clear cache:

```bash
curl -X POST https://api.example.com/api/workspaces/my-workspace/admin/actions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "cache.clear",
    "reason": "Performance optimization"
  }'
```

---

### 4. GET /api/workspaces/[workspaceSlug]/admin/activity

Get admin activity log (already exists).

See existing documentation in `/app/api/workspaces/[workspaceSlug]/admin/activity/route.ts`

---

## Audit Logging

All admin actions are automatically logged to the audit trail using the `AuditService`.

### Audit Log Structure

```typescript
interface AuditLog {
  action: string;
  actorId: string;
  workspaceId: string;
  category: 'admin';
  severity: 'high';
  metadata: {
    targetType?: string;
    targetId?: string;
    targetName?: string;
    reason?: string;
    ipAddress?: string;
    userAgent?: string;
    [key: string]: unknown;
  };
}
```

### Using Audit Logger

```typescript
import { logAdminAction } from '@/lib/admin/audit-logger';

await logAdminAction({
  action: 'member.suspended',
  actorId: session.user.id,
  workspaceId: workspace.id,
  targetType: 'user',
  targetId: userId,
  targetName: userName,
  reason: 'Policy violation',
});
```

### Specialized Logging Functions

```typescript
// Log member actions
await logMemberAction('suspended', actorId, workspaceId, userId, userName);

// Log role actions
await logRoleAction('created', actorId, workspaceId, roleId, roleName);

// Log invite actions
await logInviteAction('created', actorId, workspaceId, inviteId, email);

// Log settings changes
await logSettingsAction(actorId, workspaceId, 'security', { changes });

// Log billing actions
await logBillingAction('upgraded', actorId, workspaceId, { plan: 'ENTERPRISE' });
```

---

## Error Handling

### Error Codes

```typescript
const ADMIN_ERROR_CODES = {
  UNAUTHORIZED: 'ADMIN_UNAUTHORIZED',
  FORBIDDEN: 'ADMIN_FORBIDDEN',
  WORKSPACE_NOT_FOUND: 'ADMIN_WORKSPACE_NOT_FOUND',
  INVALID_ACTION: 'ADMIN_INVALID_ACTION',
  VALIDATION_ERROR: 'ADMIN_VALIDATION_ERROR',
  CANNOT_SUSPEND_SELF: 'ADMIN_CANNOT_SUSPEND_SELF',
  CANNOT_REMOVE_SELF: 'ADMIN_CANNOT_REMOVE_SELF',
  INTERNAL_ERROR: 'ADMIN_INTERNAL_ERROR',
};
```

### Error Response Format

```typescript
interface ErrorResponse {
  error: AdminErrorCode;
  message: string;
  errors?: Record<string, string[]>; // For validation errors
}
```

### HTTP Status Codes

- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (not admin/owner)
- `404` - Not Found (workspace not found)
- `400` - Bad Request (validation error, invalid action)
- `500` - Internal Server Error

---

## Authorization Utilities

### requireWorkspaceAdmin()

Verify admin access to workspace:

```typescript
import { requireWorkspaceAdmin } from '@/lib/admin/authorization';

try {
  const { session, workspace, membership } = await requireWorkspaceAdmin(workspaceSlug);
  // User is authenticated and has admin access
} catch (error) {
  if (error instanceof AuthorizationError) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: error.status }
    );
  }
}
```

### requireWorkspaceOwner()

Verify owner access (stricter than admin):

```typescript
import { requireWorkspaceOwner } from '@/lib/admin/authorization';

const { session, workspace, membership } = await requireWorkspaceOwner(workspaceSlug);
```

### canModifyMember()

Check if actor can modify target member:

```typescript
import { canModifyMember } from '@/lib/admin/authorization';

if (!canModifyMember('ADMIN', 'OWNER')) {
  throw new Error('Cannot modify owner');
}
```

### hasPermission()

Check if role has specific permission:

```typescript
import { hasPermission } from '@/lib/admin/authorization';

if (hasPermission('ADMIN', 'members.suspend')) {
  // Allow action
}
```

### validateSelfModification()

Prevent self-modification:

```typescript
import { validateSelfModification } from '@/lib/admin/authorization';

validateSelfModification(actorId, targetId, 'suspend');
// Throws if actorId === targetId
```

---

## Best Practices

### 1. Always Use Authorization Middleware

```typescript
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { session, workspace, membership } = await requireWorkspaceAdmin(
      (await context.params).workspaceSlug
    );

    // Your logic here
  } catch (error) {
    // Handle authorization errors
  }
}
```

### 2. Log All Admin Actions

```typescript
import { logAdminAction } from '@/lib/admin/audit-logger';

// After successful action
await logAdminAction({
  action: actionType,
  actorId: session.user.id,
  workspaceId: workspace.id,
  metadata: {
    /* action details */
  },
});
```

### 3. Validate Input

```typescript
import { z } from 'zod';

const actionSchema = z.object({
  action: z.enum(['maintenance.enable', 'cache.clear']),
  reason: z.string().optional(),
});

const result = actionSchema.safeParse(body);
if (!result.success) {
  return NextResponse.json(
    { error: 'VALIDATION_ERROR', errors: result.error.flatten() },
    { status: 400 }
  );
}
```

### 4. Handle Errors Gracefully

```typescript
try {
  // Action logic
} catch (error) {
  console.error('[Admin Action] Error:', error);
  return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Action failed' }, { status: 500 });
}
```

### 5. Check Permissions Before Actions

```typescript
if (!hasPermission(membership.role, 'members.suspend')) {
  return NextResponse.json(
    { error: 'FORBIDDEN', message: 'Insufficient permissions' },
    { status: 403 }
  );
}
```

---

## Testing

See `/tests/admin-api-routes.test.ts` for comprehensive test suite.

Run tests:

```bash
npm test tests/admin-api-routes.test.ts
```

---

## File Structure

```
/app/api/workspaces/[workspaceSlug]/admin/
├── stats/
│   └── route.ts          # Dashboard statistics
├── health/
│   └── route.ts          # System health status
├── actions/
│   └── route.ts          # Execute admin actions
├── activity/
│   └── route.ts          # Activity log (existing)
├── audit-logs/
│   └── route.ts          # Audit trail (existing)
└── metrics/
    └── route.ts          # Detailed metrics (existing)

/lib/admin/
├── authorization.ts      # Authorization utilities
└── audit-logger.ts       # Audit logging helpers
```

---

## Related Documentation

- [Admin Validation Schemas](/lib/validations/admin.ts)
- [Audit Service](/packages/@neolith/core/services/audit/)
- [Authorization System](/lib/admin/authorization.ts)
- [Error Handling](/docs/error-handling.md)

---

## Support

For issues or questions:

- GitHub Issues: https://github.com/your-org/neolith/issues
- Documentation: https://docs.example.com/admin-api
