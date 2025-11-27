# Orchestrator Page Issues - Quick Reference

## Issue Severity Distribution

```
CRITICAL ████████████ 2 issues (25%)
HIGH     ████████████████████ 3 issues (37.5%)
MEDIUM   ████████ 2 issues (25%)
LOW      ████ 1 issue (12.5%)
```

## Critical Path Blockers

### Issue #1: Create Orchestrator Fails (404)
```
User clicks "Create VP" → Fills form → Submits
                                         ↓
                                    POST /api/orchestrators
                                         ↓
                                    404 NOT FOUND ❌
```

**Fix:**
```diff
- const response = await fetch('/api/orchestrators', {
+ const response = await fetch(`/api/workspaces/${input.workspaceId}/orchestrators`, {
```

### Issue #2: Missing workspaceId Parameter
```
Page Component                    Hook
     ↓                             ↓
handleCreateVP(input)  →  createVP(input)  ❌ Missing workspaceId
     ↓                             ↓
Creates without         →    API rejects
workspace context
```

**Fix:**
```diff
- await createVP(input);
+ await createVP({ ...input, workspaceId });
```

---

## API Endpoint Mapping (Current vs Expected)

| Feature | Current Endpoint | Expected Endpoint | Status |
|---------|-----------------|-------------------|--------|
| List Orchestrators | `/api/workspaces/{id}/orchestrators` | Same | ✅ Correct |
| Create Orchestrator | `/api/orchestrators` | `/api/workspaces/{id}/orchestrators` | ❌ Wrong |
| Update Orchestrator | `/api/orchestrators/{id}` | `/api/workspaces/{id}/orchestrators/{vpId}` | ⚠️ Works but not workspace-scoped |
| Delete Orchestrator | `/api/orchestrators/{id}` | `/api/workspaces/{id}/orchestrators/{vpId}` | ⚠️ Works but not workspace-scoped |
| Toggle Status | `/api/orchestrators/{id}` (PATCH) | `/api/workspaces/{id}/orchestrators/{vpId}/status` | ❌ Wrong |

---

## Impact Analysis

### Features Broken in Production

1. ❌ **Create VP** - 404 error, completely non-functional
2. ❌ **Toggle Orchestrator Status** - Will fail or use wrong endpoint
3. ⚠️ **Update VP** - Works but bypasses workspace context
4. ⚠️ **Delete VP** - Works but bypasses workspace context

### Features Working Correctly

1. ✅ **List VPs** - Fetches and displays correctly
2. ✅ **Filter VPs** - Search, discipline, status filters work
3. ✅ **VP Stats** - Status counts display correctly
4. ✅ **Empty States** - Proper messaging when no Orchestrators
5. ✅ **Loading States** - Skeleton loaders during fetch
6. ✅ **Error Display** - Inline errors with retry option

---

## Code Quality Observations

### Strengths
- Clean component structure
- Comprehensive error handling
- Good TypeScript types
- Responsive design
- Accessible UI (ARIA labels)

### Weaknesses
- Code duplication (data transformation)
- Missing error boundaries
- Hard-coded skeleton count
- API endpoint inconsistency
- Workspace context not threaded through hooks

---

## Quick Fix Checklist

- [ ] Update `createVP` in `/hooks/use-vp.ts` to use workspace endpoint
- [ ] Update `updateVP` in `/hooks/use-vp.ts` to use workspace endpoint
- [ ] Update `deleteVP` in `/hooks/use-vp.ts` to use workspace endpoint
- [ ] Update `toggleVPStatus` to use dedicated status endpoint
- [ ] Pass `workspaceId` in `handleCreateVP` callback
- [ ] Update `CreateVPInput` type to include `workspaceId`
- [ ] Add error boundary to Orchestrator page
- [ ] Extract Orchestrator transformation logic to utility function
- [ ] Add Playwright tests for Orchestrator creation flow
- [ ] Test end-to-end with authenticated user

---

## Testing Status

| Test Category | Status | Notes |
|--------------|--------|-------|
| Static Analysis | ✅ Complete | All code reviewed |
| Type Checking | ✅ Complete | Types verified |
| API Structure | ✅ Complete | Routes analyzed |
| Unit Tests | ❌ Not Found | No test files exist |
| Integration Tests | ❌ Not Found | No API tests |
| E2E Tests | ❌ Blocked | Playwright MCP unavailable |
| Manual Testing | ❌ Blocked | Requires authentication |

---

## Files Requiring Changes

1. `/hooks/use-vp.ts` (Lines 364-446) - CRITICAL
2. `/app/(workspace)/[workspaceId]/orchestrators/page.tsx` (Lines 46-52) - CRITICAL
3. `/types/vp.ts` (Lines 71-79) - Update CreateVPInput type
4. Add `/hooks/utils/transform-vp.ts` - Extract transformation logic
5. Add `error.tsx` to Orchestrator page directory - Error boundary

---

## Risk Assessment

**Release Risk:** HIGH

**User Impact:** SEVERE
- 100% of Orchestrator creation attempts will fail
- Status toggles non-functional
- Core workflow completely broken

**Business Impact:**
- Cannot onboard new Orchestrators
- Cannot manage existing Orchestrators effectively
- Loss of platform core functionality

**Recommendation:** **BLOCK PRODUCTION DEPLOYMENT** until critical issues resolved.

---

## Time Estimates

- Fix Critical Issues: 2 hours
- Fix High Priority: 3 hours
- Add Tests: 4 hours
- Code Review: 1 hour

**Total:** 10 hours for complete resolution
**Minimum Viable:** 2 hours (Critical issues only)

---

## Next Actions

1. Review this report with development team
2. Assign tickets for critical fixes
3. Implement fixes in feature branch
4. Add automated tests
5. Perform manual QA with authenticated user
6. Deploy to staging for validation
7. Production deployment after sign-off
