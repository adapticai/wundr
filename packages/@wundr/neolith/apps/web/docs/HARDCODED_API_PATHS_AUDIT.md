# Hardcoded API Paths Audit Report

**Date**: 2025-11-26
**Working Directory**: `/Users/iroselli/wundr/packages/@wundr/neolith/apps/web`
**Audit Scope**: All TypeScript/JavaScript files in `app/`, `hooks/`, and `components/`

---

## Executive Summary

**Good News**: The codebase is relatively clean with minimal hardcoded API paths. Most API calls use dynamic parameters from URL params, props, or session data.

**Findings**:
- ✅ No hardcoded `/api/organizations/1/` patterns found
- ✅ No hardcoded organization IDs in production code
- ⚠️ Some documentation examples with placeholder IDs
- ⚠️ Test files use mock IDs (expected and acceptable)
- ⚠️ Dashboard has TODO comments for mock data replacement

---

## 1. Documentation Files (Safe - Examples Only)

### `/docs/VP_ANALYTICS_IMPLEMENTATION.md`
**Line 193**: Example fetch call with placeholder
```javascript
const res = await fetch('/api/vps/vp_123/analytics');
```
**Status**: ✅ Documentation example - not executable code
**Action**: None required

### `/docs/VP_DAEMON_API_INTEGRATION.md`
**Line 73**: Configuration example
```json
"healthCheckEndpoint": "/api/daemon/health/vp_123"
```
**Status**: ✅ Documentation example - not executable code
**Action**: None required

---

## 2. Test Files (Expected Mock Data)

### `/app/api/vps/__tests__/vps.test.ts`
**Lines 80, 112, 119, 162, 279**: Mock organization and VP IDs
```typescript
organizationId: 'org-123'
id: 'vp-123'
userId: 'user-vp-123'
```
**Status**: ✅ Test mocks - expected behavior
**Action**: None required

### `/app/api/presence/__tests__/presence.test.ts`
**Line**: Mock organization ID
```typescript
const orgId = 'org-123';
```
**Status**: ✅ Test mock - expected behavior
**Action**: None required

---

## 3. API Route Documentation (Safe - JSDoc Comments)

The following files contain example IDs in JSDoc comments only:

### `/app/api/disciplines/route.ts`
```typescript
* GET /api/disciplines?organizationId=org_123&page=1&limit=50
```

### `/app/api/vps/route.ts`
```typescript
* GET /api/vps?organizationId=org_123&status=ONLINE&page=1&limit=20
```

### `/app/api/workspaces/route.ts`
```typescript
* GET /api/workspaces?organizationId=org_123&page=1&limit=20
```

### `/app/api/presence/vps/route.ts`
```typescript
* GET /api/presence/vps?organizationId=org_123
```

### `/app/api/channels/route.ts`
```typescript
* GET /api/channels?workspaceId=ws_123&type=PUBLIC&page=1&limit=50
```

**Status**: ✅ Documentation comments only
**Action**: None required - these are examples in API documentation

---

## 4. Production Code - Dynamic API Calls (All Good)

### `/hooks/use-vp.ts`
All API calls use dynamic parameters:
```typescript
// Line 108 - Dynamic VP ID
fetch(`/api/vps/${id}`)

// Line 195 - Query string with dynamic params
fetch(`/api/vps?${params.toString()}`)

// Line 292 - POST with dynamic data
fetch('/api/vps', { method: 'POST', body: JSON.stringify(input) })

// Line 317 - Dynamic update
fetch(`/api/vps/${id}`, { method: 'PATCH' })

// Line 342 - Dynamic delete
fetch(`/api/vps/${id}`, { method: 'DELETE' })

// Line 369 - Dynamic API key rotation
fetch(`/api/vps/${id}/rotate-key`, { method: 'POST' })
```
**Status**: ✅ All dynamic - no hardcoded IDs
**Action**: None required

### `/hooks/use-chat.ts`
```typescript
// Line 418 - Generic messages endpoint
fetch('/api/messages', { method: 'POST' })
```
**Status**: ✅ No hardcoded IDs
**Action**: None required

### `/hooks/use-presence.ts`
All calls are to generic endpoints without hardcoded IDs:
```typescript
fetch('/api/presence/batch')
fetch('/api/presence/me')
fetch('/api/presence/me/custom-status')
fetch('/api/presence/heartbeat')
```
**Status**: ✅ All generic endpoints
**Action**: None required

### `/hooks/use-notifications.ts`
```typescript
fetch('/api/notifications/read-all')
fetch('/api/notifications/vapid-key')
fetch('/api/notifications/subscribe')
fetch('/api/notifications/unsubscribe')
fetch('/api/sync')
fetch('/api/sync/resolve')
fetch('/api/notifications/settings')
fetch('/api/notifications/test')
```
**Status**: ✅ All generic endpoints
**Action**: None required

### `/hooks/use-upload.ts`
```typescript
fetch('/api/upload/signed-url')
```
**Status**: ✅ Generic endpoint
**Action**: None required

### `/hooks/use-integrations.ts`
```typescript
// Line - Uses dynamic workspaceId and webhookId
fetch(`/api/workspaces/${workspaceId}/webhooks/${webhookId}/deliveries?limit=10`)
```
**Status**: ✅ Dynamic parameters
**Action**: None required

### `/components/workspace/create-workspace-card.tsx`
```typescript
// Line 125 - POST to generic endpoint
fetch('/api/workspaces', { method: 'POST' })
```
**Status**: ✅ Generic endpoint
**Action**: None required

### `/components/org-genesis/org-genesis-wizard.tsx`
```typescript
// Line 100 - POST to org generation endpoint
fetch('/api/workspaces/generate-org', { method: 'POST' })
```
**Status**: ✅ Generic endpoint
**Action**: None required

### `/components/providers/presence-provider.tsx`
```typescript
// Line 85 - Heartbeat endpoint
fetch('/api/presence/heartbeat', { method: 'POST' })
```
**Status**: ✅ Generic endpoint
**Action**: None required

---

## 5. Page Components - All Using Dynamic Routes

### `/app/(workspace)/[workspaceId]/vps/page.tsx`
```typescript
// Line 19 - Gets workspaceId from URL params
const workspaceId = params.workspaceId as string;

// Line 26 - Passes dynamic ID to hook
const { vps, isLoading, error } = useVPs(workspaceId, filters);
```
**Status**: ✅ Fully dynamic
**Action**: None required

### `/app/(workspace)/[workspaceId]/vps/[vpId]/page.tsx`
```typescript
// Line 28-29 - Gets IDs from URL params
const vpId = params.vpId as string;
const workspaceId = params.workspaceId as string;

// Line 35 - Uses dynamic VP ID
const { vp, isLoading, error } = useVP(vpId);
```
**Status**: ✅ Fully dynamic
**Action**: None required

### `/app/dashboard/page.tsx` & `/app/page.tsx`
```typescript
// Gets workspaceId from user's first workspace
const workspaceId = userWorkspaces[0].workspace.id;
```
**Status**: ✅ Dynamic from user data
**Action**: None required

---

## 6. TODO Items Found (Requires Attention)

### `/app/(workspace)/[workspaceId]/dashboard/dashboard-content.tsx`

**Line 15-16**: Mock workspace data
```typescript
// TODO: Replace with actual workspace fetching logic
const workspaces: unknown[] = []; // This should fetch user's workspaces
const isLoading = false; // This should come from data fetching state
```

**Priority**: 🔴 HIGH
**Issue**: Dashboard shows empty state because workspaces array is hardcoded to `[]`
**Impact**: Users cannot see their workspaces on the dashboard
**Fix Required**: Implement workspace fetching logic using SWR or similar

**Recommended Implementation**:
```typescript
import useSWR from 'swr';

export function DashboardContent({ userName }: DashboardContentProps) {
  const { data: workspaces = [], isLoading, error } = useSWR(
    '/api/workspaces',
    fetch
  );

  // Rest of component...
}
```

---

## 7. API Routes - All Using Dynamic Parameters

### `/app/api/tasks/route.ts`
- Line 84-89: Gets accessible workspaces from user's memberships
- Line 106: Validates workspace access dynamically
- Line 292-297: Checks workspace membership dynamically
- Line 310-317: Validates VP belongs to workspace
- No hardcoded IDs found

**Status**: ✅ Fully dynamic
**Action**: None required

### `/app/api/tasks/poll/route.ts`
- Line 90-97: Validates VP against workspace dynamically
- Line 110-113: Builds where clause from request input
- No hardcoded IDs found

**Status**: ✅ Fully dynamic
**Action**: None required

---

## 8. Code Review Notes Found

Multiple code review JSON files mention TODOs and FIXMEs:
- `/docs/AUTH_CODE_REVIEW_REPORT.json`
- `/docs/ADMIN_CODE_REVIEW_REPORT.json`
- `/docs/WORKFLOWS_CODE_REVIEW_REPORT.json`
- `/docs/CHANNELS_CODE_REVIEW_REPORT.json`
- `/docs/VP_CODE_REVIEW_REPORT.json`

**Status**: ℹ️ Review documentation
**Action**: Review these files separately for API-related TODOs

---

## Summary of Findings

### ✅ What's Working Well:
1. **No hardcoded organization IDs** in production code
2. **All hooks use dynamic parameters** from props/params/session
3. **Page components properly extract IDs** from Next.js dynamic routes
4. **API routes validate access** dynamically based on user session
5. **Proper use of query parameters** instead of hardcoded paths
6. **Clean separation** between test mocks and production code

### ⚠️ Issues to Fix:

| Priority | File | Issue | Action Required |
|----------|------|-------|-----------------|
| 🔴 HIGH | `dashboard-content.tsx` | Mock workspace data | Implement workspace fetching |

### 📊 Statistics:
- **Total files scanned**: ~50+ TypeScript/TSX files
- **Hardcoded API paths found**: 0 in production code
- **Mock IDs in tests**: ~10 files (expected)
- **Documentation examples**: 6 files (safe)
- **Critical issues**: 1 (dashboard TODO)

---

## Recommendations

### Immediate Actions:
1. **Implement workspace fetching** in `dashboard-content.tsx`
2. **Review and close TODOs** in code review reports
3. **Document dynamic ID patterns** in contributing guide

### Best Practices to Maintain:
1. ✅ Continue using Next.js dynamic routes `[id]` pattern
2. ✅ Extract IDs from `useParams()` hook
3. ✅ Pass IDs as props/parameters, never hardcode
4. ✅ Use query string builders for complex filters
5. ✅ Validate resource ownership in API routes

### Testing Recommendations:
1. Add E2E tests for dynamic routing
2. Test unauthorized access with different org IDs
3. Verify workspace isolation between organizations
4. Test API endpoints with various ID formats

---

## Conclusion

**Overall Assessment**: 🟢 **EXCELLENT**

The codebase demonstrates strong architectural patterns with proper separation of concerns and dynamic parameter handling. The only issue found is a TODO comment for implementing workspace fetching, which doesn't represent a hardcoded API path problem but rather incomplete functionality.

**No broken hardcoded API paths were found that would cause routing errors.**

---

## Appendix: Search Patterns Used

```bash
# Pattern 1: Direct organization ID references
/api/organizations/1/

# Pattern 2: Hardcoded numeric IDs
/api/organizations/\d+

# Pattern 3: Fetch with hardcoded numbers
fetch.*['"]/api/.*1.*['"]

# Pattern 4: Organization paths without variables
/api/organizations/(?!.*\$|.*\{)

# Pattern 5: Mock data references
mockOrganizations|mockData|MOCK_

# Pattern 6: TODO/FIXME comments
hardcoded|TODO.*API|FIXME.*API

# Pattern 7: Variable assignments
organizationId.*=.*['"]\d+['"]
workspaceId.*=.*['"]\d+['"]
```

All patterns returned zero problematic matches in production code.
