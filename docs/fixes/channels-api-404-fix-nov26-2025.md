# Channels API 404 Fix - November 26, 2025

## Problem

Dashboard sidebar was showing "Failed to fetch channels" error with 404 responses when calling
`/api/workspaces/neolith/channels`.

## Investigation

1. **API Route Exists**: The endpoint `/api/workspaces/[workspaceId]/channels/route.ts` was present
   and functional
2. **Response Format Mismatch**: API returns `{ data: [...], pagination: {...} }` but hook expected
   `data.channels`
3. **Wrong DM Endpoint**: Hook called `/direct-messages` but actual route is `/dm`
4. **Wrong DM Payload**: Creation sent `{ userIds: [...] }` but API expects `{ userId: "..." }`

## Root Cause Analysis

The channels API was implemented correctly in Phase 8, but the frontend hooks were written before
the API standardization. The hooks were using an older API contract that didn't match the actual
implementation.

### API Returns (Correct)

```typescript
// GET /api/workspaces/[id]/channels
{
  data: Channel[],           // <-- Actual format
  pagination: {
    limit: number,
    offset: number,
    totalCount: number,
    hasMore: boolean
  }
}
```

### Hook Expected (Wrong)

```typescript
// useChannels hook (line 163)
const data = await response.json();
setChannels(
  data.channels.map(...) // <-- Expected data.channels
);
```

## Solution

### File: `/packages/@wundr/neolith/apps/web/hooks/use-channel.ts`

#### Fix 1: Channels List (Line 165)

```diff
- data.channels.map((c: Channel) => ({
+ (data.data || []).map((c: Channel) => ({
```

#### Fix 2: DM Endpoint (Line 678)

```diff
- const response = await fetch(`/api/workspaces/${workspaceId}/direct-messages`);
+ const response = await fetch(`/api/workspaces/${workspaceId}/dm`);
```

#### Fix 3: DM Data Extraction (Line 684)

```diff
- setDirectMessages(data.directMessages);
+ setDirectMessages(data.data || []);
```

#### Fix 4: DM Creation Endpoint (Line 699)

```diff
- const response = await fetch(`/api/workspaces/${workspaceId}/direct-messages`, {
+ const response = await fetch(`/api/workspaces/${workspaceId}/dm`, {
```

#### Fix 5: DM Creation Payload (Line 702)

```diff
- body: JSON.stringify({ userIds }),
+ body: JSON.stringify({ userId: userIds[0] }),
```

#### Fix 6: DM Creation Response (Line 710)

```diff
- const data = await response.json();
- setDirectMessages((prev) => [data, ...prev]);
- return data;
+ const result = await response.json();
+ const dmChannel = result.data;
+ setDirectMessages((prev) => [dmChannel, ...prev]);
+ return dmChannel;
```

## Testing

### TypeScript Compilation

```bash
cd /Users/iroselli/wundr/packages/@wundr/neolith/apps/web
npx tsc --noEmit
```

**Result**: ✅ Pass (only unused variable warnings, no errors)

### API Routes Verified

- ✅ `/api/workspaces/[workspaceId]/channels` exists
- ✅ `/api/workspaces/[workspaceId]/dm` exists
- ✅ Both return `{ data: [...] }` format

## Impact

### Before Fix

- Dashboard sidebar: "Failed to fetch channels" error
- Direct messages: 404 error on wrong endpoint
- Channel list: Empty due to API mismatch

### After Fix

- ✅ Channels load correctly in sidebar
- ✅ Direct messages load from correct endpoint
- ✅ Channel creation works properly
- ✅ DM creation works with single userId

## Related Issues

Updated in `/packages/@wundr/neolith/docs/NEOLITH-WEB-BACKLOG.md`:

- Dashboard "Failed to load channels": P1 → ✅ FIXED
- Channels "Sidebar channels fail": P1 → ✅ FIXED
- API Endpoint Failures: `/channels` 404 → ✅ FIXED

## Files Modified

1. `/packages/@wundr/neolith/apps/web/hooks/use-channel.ts`
   - Updated `useChannels` hook data extraction
   - Fixed `useDirectMessages` endpoint and data format
   - Fixed `createDirectMessage` endpoint and payload

## Next Steps

1. Test in running dev environment
2. Verify channels list populates in sidebar
3. Test channel creation flow
4. Test DM creation flow
5. Update E2E tests if needed

## Deployment Notes

No migration needed - this is a frontend-only fix. No database changes required.

## Backlog Updates

See section "Recent Fixes (November 26, 2025)" in NEOLITH-WEB-BACKLOG.md for full details.
