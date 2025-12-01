# CRITICAL FIX REQUIRED - Workflows Page

## Bug Summary

**Severity:** CRITICAL (P0) **File:** `/app/(workspace)/[workspaceId]/workflows/page.tsx` **Line:**
608 **Impact:** Users cannot properly configure workflow actions

## The Problem

The action type selector in the WorkflowBuilderModal is using `TRIGGER_TYPE_CONFIG` instead of
`ACTION_TYPE_CONFIG`. This causes the dropdown to display trigger types (Schedule, New Message,
Keyword, etc.) instead of action types (Send Message, Send DM, Create Channel, etc.).

### Current Code (WRONG)

```typescript
// Line 608 in page.tsx
<select value={action.type}>
  {Object.entries(TRIGGER_TYPE_CONFIG).map(([key, cfg]) => (
    <option key={key} value={key}>
      {cfg.label}
    </option>
  ))}
</select>
```

### What Users See (WRONG)

When trying to add an action to a workflow, the dropdown shows:

- Schedule
- New Message
- Keyword
- Channel Join
- Channel Leave
- User Join
- Reaction
- Mention
- Webhook

### What Users Should See (CORRECT)

- Send Message
- Send DM
- Create Channel
- Invite to Channel
- Assign Role
- Add Reaction
- HTTP Request
- Wait
- Condition
- Notify VP

## The Fix

### Step 1: Update Import Statement

**File:** `/app/(workspace)/[workspaceId]/workflows/page.tsx` **Line:** 16-19

```typescript
// CURRENT (missing ACTION_TYPE_CONFIG):
import {
  WORKFLOW_STATUS_CONFIG,
  TRIGGER_TYPE_CONFIG,
  EXECUTION_STATUS_CONFIG,
  TEMPLATE_CATEGORY_CONFIG,
} from '@/types/workflow';

// FIXED (add ACTION_TYPE_CONFIG):
import {
  WORKFLOW_STATUS_CONFIG,
  TRIGGER_TYPE_CONFIG,
  ACTION_TYPE_CONFIG, // ADD THIS LINE
  EXECUTION_STATUS_CONFIG,
  TEMPLATE_CATEGORY_CONFIG,
} from '@/types/workflow';
```

### Step 2: Update Action Selector

**File:** `/app/(workspace)/[workspaceId]/workflows/page.tsx` **Line:** 608

```typescript
// CURRENT (WRONG):
{Object.entries(TRIGGER_TYPE_CONFIG).map(([key, cfg]) => (
  <option key={key} value={key}>
    {cfg.label}
  </option>
))}

// FIXED (CORRECT):
{Object.entries(ACTION_TYPE_CONFIG).map(([key, cfg]) => (
  <option key={key} value={key}>
    {cfg.label}
  </option>
))}
```

## Verification Steps

After applying the fix:

1. **Build Test**

   ```bash
   cd /Users/iroselli/wundr/packages/@wundr/neolith/apps/web
   npm run build
   ```

   Expected: Build succeeds with no errors

2. **Runtime Test**
   - Navigate to http://localhost:3000/{workspaceId}/workflows
   - Click "Create Workflow" button
   - Click "Add Action" button
   - Click the action type dropdown
   - Verify dropdown shows: "Send Message", "Send DM", "Create Channel", etc.
   - NOT: "Schedule", "New Message", etc.

3. **Type Check**
   ```bash
   npm run typecheck
   ```
   Expected: No type errors

## Impact Assessment

### Before Fix

- Users cannot create workflows with proper actions
- Action type selection is completely broken
- Workflow creation will fail at runtime when invalid action types are submitted to API
- User confusion when they see trigger types in action dropdown

### After Fix

- Users can properly select action types
- Workflow creation works as intended
- UI matches backend expectations
- Clear distinction between triggers and actions

## Root Cause Analysis

The bug was introduced because:

1. `ACTION_TYPE_CONFIG` was not imported from `@/types/workflow`
2. The action selector code copied from trigger selector but not updated
3. No type checking caught this because both configs have the same structure
4. No runtime tests or E2E tests exist for this component

## Prevention Measures

To prevent similar bugs:

1. **Add TypeScript Strict Mode**
   - Enable stricter type checking in tsconfig.json
   - Use const assertions for config keys

2. **Add Component Tests**

   ```typescript
   // tests/components/workflow-builder-modal.test.tsx
   it('should show action types in action selector', () => {
     // ...test implementation
   });
   ```

3. **Add E2E Tests**

   ```typescript
   // tests/e2e/workflows.spec.ts
   test('action selector shows correct options', async ({ page }) => {
     // ...test implementation
   });
   ```

4. **Code Review Checklist**
   - Verify all config objects are imported
   - Check that dropdown options match the data type
   - Verify type/value alignment

## Related Files

All files verified to be correct:

- `/types/workflow.ts` - Exports ACTION_TYPE_CONFIG correctly ✅
- `/hooks/use-workflows.ts` - All hooks exported correctly ✅
- `/components/workflows/workflow-list.tsx` - No issues found ✅
- `/components/workflows/workflow-card.tsx` - No issues found ✅

Only issue is in:

- `/app/(workspace)/[workspaceId]/workflows/page.tsx` - Line 608 ❌

## Estimated Fix Time

- Code change: 2 minutes
- Build + test: 3 minutes
- Verification: 5 minutes
- **Total: 10 minutes**

## Priority Justification

**Why P0/Critical:**

1. Core functionality completely broken
2. Affects all users trying to create workflows
3. No workaround available
4. Blocks workflow feature entirely
5. Easy to fix, high impact

## Sign-off

**Tested By:** Agent 5 - Workflows Page Tester (Code Analysis) **Status:** READY FOR FIX
**Confidence:** 100% (verified via code inspection) **Recommendation:** Apply fix immediately before
production deployment
