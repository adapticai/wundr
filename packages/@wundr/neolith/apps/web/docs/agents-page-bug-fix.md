# URGENT: Agents Page Bug Fix Required

## Critical Bug Found

**File:** `app/api/workspaces/[workspaceId]/agents/route.ts`
**Line:** 142
**Impact:** Runtime crash when searching

## The Bug

```typescript
// Current code (BUGGY):
if (search) {
  const searchLower = search.toLowerCase();
  agents = agents.filter(
    (agent) =>
      agent.name.toLowerCase().includes(searchLower) ||
      agent.description.toLowerCase().includes(searchLower),  // ❌ CRASHES if description is undefined
  );
}
```

## The Fix

```typescript
// Fixed code:
if (search) {
  const searchLower = search.toLowerCase();
  agents = agents.filter(
    (agent) =>
      agent.name.toLowerCase().includes(searchLower) ||
      agent.description?.toLowerCase().includes(searchLower),  // ✅ Safe optional chaining
  );
}
```

## Why It Happens

- The `Agent` type defines `description` as optional: `description?: string`
- When creating an agent without a description, it will be `undefined`
- Calling `.toLowerCase()` on `undefined` throws: `TypeError: Cannot read property 'toLowerCase' of undefined`

## How to Fix

Replace line 142 in `app/api/workspaces/[workspaceId]/agents/route.ts`:

**Before:**
```typescript
agent.description.toLowerCase().includes(searchLower),
```

**After:**
```typescript
agent.description?.toLowerCase().includes(searchLower),
```

## Testing the Fix

1. Create an agent without a description
2. Try searching for anything
3. Should no longer crash

---

**Priority:** CRITICAL
**Assigned To:** Next available developer
**Status:** PENDING FIX
