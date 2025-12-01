# Channel List Component - Quick Reference

## Component Location

`/components/channel/channel-list.tsx`

## New Props Added

```typescript
interface ChannelListProps {
  // ... existing props
  error?: Error | null; // NEW: Error state from hooks
  onRetry?: () => void; // NEW: Retry callback for failed loads
}
```

## Usage Example

```typescript
import { useChannels, useDirectMessages } from '@/hooks/use-channel';
import { ChannelList } from '@/components/channel';

function Sidebar() {
  const {
    channels,
    isLoading,
    error,        // Extract error
    refetch       // Extract refetch
  } = useChannels(workspaceId);

  const {
    directMessages,
    error: dmsError,
    refetch: refetchDMs
  } = useDirectMessages(workspaceId);

  const handleRetry = async () => {
    await Promise.all([refetch(), refetchDMs()]);
  };

  return (
    <ChannelList
      workspaceId={workspaceId}
      channels={channels}
      directMessages={directMessages}
      starredChannels={starredChannels}
      isLoading={isLoading}
      error={error || dmsError}      // Pass error
      onRetry={handleRetry}           // Pass retry handler
      onCreateChannel={handleCreate}
    />
  );
}
```

## Features Overview

### 1. Loading State

- Shows `ChannelListSkeleton` when `isLoading={true}`
- Matches structure of actual component

### 2. Error State

- Shows when `error` prop is provided AND both channels and DMs are empty
- Displays error message and "Try Again" button
- Only renders retry button if `onRetry` callback provided

### 3. Empty States

- **No Search Query:**
  - Channels: "No channels yet" + "Create your first channel" link
  - DMs: "No direct messages yet" + helper text
- **With Search Query:**
  - Channels: "No channels match your search"
  - DMs: "No conversations match your search"

### 4. Unread Badges

- Only show when:
  - `unreadCount != null` (null-safe check)
  - `unreadCount > 0`
  - Item is NOT active (reduces visual noise)
- Display "99+" for counts over 99
- Styled with primary color background

### 5. Safe Fallbacks

- Channel/DM names: Safe string operations
- User avatars: Shows "?" if name missing
- Participant names: "Unknown" if name missing

## Visual States

```
┌─────────────────────────────────┐
│  LOADING STATE                  │
│  ┌───────────────────────────┐  │
│  │ ▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯  │  │
│  │ ▯▯▯▯  ▯▯▯▯▯▯▯▯▯▯▯▯▯       │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  ERROR STATE                    │
│  ┌───────────────────────────┐  │
│  │    ⚠️                      │  │
│  │ Failed to load channels    │  │
│  │ Error message here         │  │
│  │  [Try Again]               │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  EMPTY STATE (No Search)        │
│  Channels                       │
│  ├─ No channels yet             │
│  └─ Create your first channel   │
│                                 │
│  Direct Messages                │
│  ├─ No direct messages yet      │
│  └─ Click + to start...         │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  EMPTY STATE (With Search)      │
│  Channels                       │
│  └─ No channels match search    │
│                                 │
│  Direct Messages                │
│  └─ No conversations match...   │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  NORMAL STATE                   │
│  Channels           +           │
│  ├─ # general                   │
│  ├─ # announcements      [3]    │ ← Unread badge
│  └─ 🔒 private-chat             │
│                                 │
│  Direct Messages        +       │
│  ├─ 👤 John Doe                 │
│  └─ 👤 Jane Smith       [12]    │ ← Unread badge
└─────────────────────────────────┘
```

## Component Breakdown

```typescript
ChannelList
├── Loading State (ChannelListSkeleton)
├── Error State (error && empty)
│   ├── AlertCircleIcon
│   ├── Error message
│   └── Retry button
└── Normal State
    ├── Search Input
    └── Scrollable List
        ├── ChannelSection (Starred)
        │   └── ChannelItem[]
        ├── ChannelSection (Channels)
        │   └── ChannelItem[] or Empty State
        └── ChannelSection (Direct Messages)
            └── DirectMessageItem[] or Empty State
```

## Key Improvements

1. **Null Safety:** All unread counts and user data checked
2. **Error Recovery:** Retry mechanism for failed loads
3. **User Guidance:** Clear empty states with actions
4. **Visual Clarity:** Unread badges hidden on active items
5. **Accessibility:** Tooltips and semantic HTML
6. **Type Safety:** Full TypeScript coverage

## Testing Tips

```typescript
// Test loading state
<ChannelList isLoading={true} {...props} />

// Test error state
<ChannelList
  error={new Error('Failed to load')}
  channels={[]}
  directMessages={[]}
  onRetry={() => console.log('retry')}
  {...props}
/>

// Test empty state (no search)
<ChannelList
  channels={[]}
  directMessages={[]}
  {...props}
/>

// Test unread badges
<ChannelList
  channels={[
    { ...channel, unreadCount: 5 },
    { ...channel, unreadCount: 0 },
    { ...channel, unreadCount: null },
  ]}
  {...props}
/>
```

## Performance Notes

- Filtered arrays memoized with `useMemo`
- Callbacks memoized with `useCallback`
- No unnecessary re-renders
- Efficient list rendering with keys

## Maintenance Notes

- Keep error messages user-friendly
- Update empty state CTAs as needed
- Consider adding skeleton variants for different states
- Monitor unread count performance with large datasets
