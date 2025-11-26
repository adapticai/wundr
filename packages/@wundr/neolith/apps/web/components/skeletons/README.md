# Skeleton Loading Components

Comprehensive skeleton loading components for Phase 3 Task 3.2.2, providing realistic loading states that match the actual component layouts.

## Components

### DashboardSkeleton
Full-page skeleton for the dashboard view, including workspace cards, recent activity, quick stats, and quick actions.

```tsx
import { DashboardSkeleton } from '@/components/skeletons';

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}
```

### ChannelListSkeleton
Sidebar skeleton for channel navigation, including starred channels, regular channels, and direct messages.

```tsx
import { ChannelListSkeleton } from '@/components/skeletons';

export function Sidebar() {
  const { channels, isLoading } = useChannels();

  if (isLoading) {
    return <ChannelListSkeleton className="w-64" />;
  }

  return <ChannelList channels={channels} />;
}
```

### MessageListSkeleton
Chat message list skeleton with configurable message count and alternating message styles.

```tsx
import { MessageListSkeleton, MessageLoadingIndicator } from '@/components/skeletons';

export function ChatView() {
  const { messages, isLoading, isLoadingMore } = useMessages();

  if (isLoading) {
    return <MessageListSkeleton messageCount={8} />;
  }

  return (
    <>
      {isLoadingMore && <MessageLoadingIndicator />}
      <MessageList messages={messages} />
    </>
  );
}
```

### TableSkeleton
Generic table skeleton with customizable columns, rows, filters, and pagination.

```tsx
import { TableSkeleton, MemberTableSkeleton } from '@/components/skeletons';

// Generic usage
<TableSkeleton
  columns={5}
  rows={10}
  showFilters
  showPagination
/>

// Specialized usage
<MemberTableSkeleton />
<AuditLogTableSkeleton />
<IntegrationTableSkeleton />
```

## Usage Patterns

### With React Suspense

```tsx
import { Suspense } from 'react';
import { DashboardSkeleton } from '@/components/skeletons';

export default function Page() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <AsyncDashboardComponent />
    </Suspense>
  );
}
```

### With Loading States

```tsx
import { ChannelListSkeleton } from '@/components/skeletons';

export function ChannelSidebar() {
  const { data, isLoading } = useQuery('channels');

  if (isLoading) {
    return <ChannelListSkeleton />;
  }

  return <ChannelList channels={data} />;
}
```

### With Incremental Loading

```tsx
import { MessageListSkeleton, MessageLoadingIndicator } from '@/components/skeletons';

export function ChatMessages() {
  const { messages, isLoading, hasMore, loadMore } = useInfiniteMessages();

  return (
    <div>
      {hasMore && <MessageLoadingIndicator />}
      {isLoading ? (
        <MessageListSkeleton />
      ) : (
        <MessageList messages={messages} onLoadMore={loadMore} />
      )}
    </div>
  );
}
```

## Design Principles

1. **Match Layout**: Skeletons match the actual component structure and spacing
2. **Appropriate Animation**: Uses consistent pulse animation from Shadcn Skeleton
3. **Realistic Sizing**: Element sizes approximate real content dimensions
4. **Performance**: Minimal DOM elements, optimized for quick rendering
5. **Accessibility**: Maintains proper semantic structure during loading

## Customization

All skeleton components accept a `className` prop for custom styling:

```tsx
<DashboardSkeleton className="custom-padding custom-background" />
```

## Implementation Details

- Built on Shadcn's `Skeleton` primitive component
- Uses Tailwind CSS for styling and animations
- Fully typed with TypeScript
- No runtime dependencies beyond React and existing UI components
- Consistent with the application's design system

## File Locations

- `/components/skeletons/dashboard-skeleton.tsx`
- `/components/skeletons/channel-list-skeleton.tsx`
- `/components/skeletons/message-list-skeleton.tsx`
- `/components/skeletons/table-skeleton.tsx`
- `/components/skeletons/index.tsx` (exports)
