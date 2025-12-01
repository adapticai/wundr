# Channel Hooks API Analysis

## Executive Summary

The `use-channel.ts` hook has been analyzed against the actual API endpoints. Several critical
mismatches have been identified that will cause runtime errors.

## Critical Issues Found

### 1. API Response Structure Mismatches

#### Issue: `useChannels` expects different response format

**Location**: `/hooks/use-channel.ts:158-170`

**Current Hook Code**:

```typescript
const data = await response.json();
setChannels(
  data.channels.map((c: Channel) => ({
    ...c,
    createdAt: new Date(c.createdAt),
    updatedAt: new Date(c.updatedAt),
  }))
);
```

**Actual API Response** (`/api/channels/route.ts:197-207`):

```typescript
return NextResponse.json({
  data: channelsWithMembership, // ← Returns "data" not "channels"
  pagination: {
    page: filters.page,
    limit: filters.limit,
    totalCount,
    totalPages,
    hasNextPage,
    hasPreviousPage,
  },
});
```

**Fix Required**: Change `data.channels` to `data.data`

---

#### Issue: `useChannel` expects wrong response format

**Location**: `/hooks/use-channel.ts:222-237`

**Current Hook Code**:

```typescript
const data = await response.json();
setChannel({
  ...data, // ← Expects channel data at root
  createdAt: new Date(data.createdAt),
  updatedAt: new Date(data.updatedAt),
  members: data.members?.map((m: ChannelMember) => ({
    ...m,
    joinedAt: new Date(m.joinedAt),
  })),
});
```

**Actual API Response** (`/api/channels/[channelId]/route.ts:155-163`):

```typescript
return NextResponse.json({
  data: channel, // ← Channel is nested under "data"
  membership: access.channelMembership
    ? {
        role: access.channelMembership.role,
        joinedAt: access.channelMembership.joinedAt,
      }
    : null,
});
```

**Fix Required**: Access `data.data` and handle `membership` separately

---

#### Issue: `useChannelMembers` expects different response format

**Location**: `/hooks/use-channel.ts:275-286`

**Current Hook Code**:

```typescript
const data = await response.json();
setMembers(
  data.members.map((m: ChannelMember) => ({
    // ← Expects "members"
    ...m,
    joinedAt: new Date(m.joinedAt),
  }))
);
```

**Actual API Response** (`/api/channels/[channelId]/members/route.ts:156-159`):

```typescript
return NextResponse.json({
  data: members, // ← Returns "data" not "members"
  count: members.length,
});
```

**Fix Required**: Change `data.members` to `data.data`

---

### 2. Missing API Endpoints

The hooks call several endpoints that don't exist:

1. **`/api/workspaces/${workspaceId}/channels`** (Line 158)
   - Hook expects this endpoint for listing channels
   - Actual endpoint is `/api/channels?workspaceId=${workspaceId}`

2. **`/api/channels/${channelId}/archive`** (Line 416)
   - Hook has `archiveChannel` function
   - API uses PATCH `/api/channels/${channelId}` with `isArchived: true`

3. **`/api/channels/${channelId}/star`** (Line 439)
   - Hook has `toggleStar` function
   - No corresponding API endpoint exists

4. **`/api/channels/${channelId}/permissions`** (Line 598)
   - Hook has `useChannelPermissions`
   - No corresponding API endpoint exists

5. **`/api/channels/${channelId}/members/${userId}/role`** (Line 538)
   - Hook has `changeMemberRole` function
   - API endpoint is `/api/channels/${channelId}/members/${userId}` with PATCH method

6. **`/api/workspaces/${workspaceId}/direct-messages`** (Line 646)
   - Hook has `useDirectMessages`
   - No corresponding API endpoint exists

7. **`/api/workspaces/${workspaceId}/users`** (Line 715)
   - Hook has `useWorkspaceUsers`
   - No corresponding API endpoint exists

---

### 3. Type Mismatches

#### Issue: Channel type values don't match

**Hook expects**: `'public'`, `'private'` (lowercase) **API uses**: `'PUBLIC'`, `'PRIVATE'`
(uppercase)

**Location**: `/hooks/use-channel.ts:186`

```typescript
const publicCh = channels.filter(c => c.type === 'public' && !c.isStarred);
const privateCh = channels.filter(c => c.type === 'private' && !c.isStarred);
```

**Fix Required**: Change to uppercase or add type normalization

---

#### Issue: Role type values don't match

**Hook expects**: `'admin'`, `'member'` (lowercase) **API uses**: `'ADMIN'`, `'MEMBER'` (uppercase)

**Locations**: Multiple places in mutations (lines 90, 95, 481, 533)

**Fix Required**: Change to uppercase in all API calls

---

### 4. Missing Required Query Parameters

#### Issue: `useChannels` doesn't pass required workspaceId

**Location**: `/hooks/use-channel.ts:158`

**Current**:

```typescript
const response = await fetch(`/api/workspaces/${workspaceId}/channels`);
```

**Should be** (based on actual API):

```typescript
const response = await fetch(`/api/channels?workspaceId=${workspaceId}`);
```

The API route requires `workspaceId` as a query parameter, not as a path parameter.

---

### 5. Incorrect Mutation Endpoints

#### Issue: `createChannel` uses wrong endpoint

**Location**: `/hooks/use-channel.ts:331`

**Current**:

```typescript
const response = await fetch(`/api/workspaces/${workspaceId}/channels`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(input),
});
```

**Should be** (based on actual API):

```typescript
const response = await fetch(`/api/channels`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ...input, workspaceId }),
});
```

The API expects `workspaceId` in the body, not as a path parameter.

---

#### Issue: `inviteMembers` uses wrong payload structure

**Location**: `/hooks/use-channel.ts:486-490`

**Current**:

```typescript
const response = await fetch(`/api/channels/${channelId}/members`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userIds, role }), // ← Array of userIds
});
```

**Actual API expects** (`/api/channels/[channelId]/members/route.ts`):

```typescript
// Single userId per request
body: JSON.stringify({ userId: userIds[0], role });
```

**Fix Required**: Loop through userIds and make individual requests, or update API to accept array

---

## Response Format Standardization

All API endpoints follow this pattern:

```typescript
{
  data: <actual data>,
  message?: string,       // For mutations
  pagination?: {...},     // For list endpoints
  count?: number         // For member lists
}
```

But hooks expect various formats:

- `data.channels`
- `data.members`
- Direct data access
- `data.messages`

**Recommendation**: Update all hooks to consistently access `data.data`

---

## Date Field Handling

The API returns ISO date strings that need to be converted to Date objects. The hooks do this
correctly, but need to be applied to the correct response structure.

**Example of correct handling**:

```typescript
const data = await response.json();
const channel = {
  ...data.data, // ← Access data.data
  createdAt: new Date(data.data.createdAt),
  updatedAt: new Date(data.data.updatedAt),
};
```

---

## Additional Issues from use-chat.ts

The `use-chat.ts` hook also has similar issues:

1. **Line 176**: Uses `/api/channels/${channelId}/messages` - Correct ✓
2. **Line 221**: Uses SSE endpoint `/api/channels/${channelId}/subscribe` - Not implemented in API
3. **Line 330**: Uses `/api/messages/${parentId}/thread` - Not implemented in API
4. **Line 418**: Uses `/api/messages` - Not implemented in API (should be
   `/api/channels/${channelId}/messages`)
5. **Line 569**: Uses SSE endpoint `/api/channels/${channelId}/typing` - Correct ✓

---

## Summary of Required Changes

### Immediate Fixes (Breaking Issues)

1. ✅ Fix response data access: Change all `data.channels` → `data.data`
2. ✅ Fix response data access: Change all `data.members` → `data.data`
3. ✅ Fix channel type comparisons: `'public'` → `'PUBLIC'`
4. ✅ Fix role values: `'admin'` → `'ADMIN'`, `'member'` → `'MEMBER'`
5. ✅ Fix createChannel endpoint: Use `/api/channels` with workspaceId in body
6. ✅ Fix useChannels endpoint: Use `/api/channels?workspaceId=${id}`

### API Endpoints to Create

1. `/api/channels/${channelId}/archive` - Archive channel endpoint
2. `/api/channels/${channelId}/star` - Star/unstar endpoint
3. `/api/channels/${channelId}/permissions` - Get user permissions
4. `/api/workspaces/${workspaceId}/direct-messages` - DM management
5. `/api/workspaces/${workspaceId}/users` - Workspace users search
6. `/api/channels/${channelId}/subscribe` - SSE for real-time updates
7. `/api/messages` - Global message endpoint
8. `/api/messages/${parentId}/thread` - Thread messages

### Lower Priority

1. Update `inviteMembers` to handle batch operations
2. Add proper error handling for all mutations
3. Add retry logic for failed requests
4. Implement proper TypeScript types for all responses

---

## Testing Checklist

Before deployment, verify:

- [ ] `useChannels()` successfully fetches channels
- [ ] `useChannel(id)` successfully fetches single channel
- [ ] `useChannelMembers(id)` successfully fetches members
- [ ] `createChannel()` successfully creates channel
- [ ] `updateChannel()` successfully updates channel
- [ ] `deleteChannel()` successfully deletes channel
- [ ] `inviteMembers()` successfully adds members
- [ ] `leaveChannel()` successfully removes member
- [ ] Type filtering works (PUBLIC/PRIVATE)
- [ ] Date fields are properly converted
- [ ] Error responses are handled correctly

---

## Files to Update

1. `/hooks/use-channel.ts` - Primary file needing fixes
2. `/hooks/use-chat.ts` - Secondary file with endpoint issues
3. API routes to create (listed above)
4. Type definitions in `/types/channel.ts` - Verify enum values

---

**Generated**: 2025-11-26 **Status**: Analysis Complete - Ready for Implementation
