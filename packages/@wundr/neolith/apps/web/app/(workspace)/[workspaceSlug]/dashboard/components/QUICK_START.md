# Dashboard Widgets - Quick Start Guide

## Import and Use

```tsx
import {
  QuickActionsWidget,
  ThreadsWidget,
  ChannelsWidget,
  StatusWidget,
  WorkspaceSwitcherWidget,
} from '@/app/(workspace)/[workspaceSlug]/dashboard/components';

// In your dashboard page
export default function DashboardPage({ params }) {
  const { workspaceSlug } = params;

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Row 1 */}
        <QuickActionsWidget workspaceSlug={workspaceSlug} />
        <ThreadsWidget workspaceSlug={workspaceSlug} />
        <ChannelsWidget workspaceSlug={workspaceSlug} />

        {/* Row 2 */}
        <StatusWidget workspaceSlug={workspaceSlug} />
        <WorkspaceSwitcherWidget currentWorkspaceSlug={workspaceSlug} />
      </div>
    </div>
  );
}
```

## Widget Props

### QuickActionsWidget
- `workspaceSlug` (required): string
- `canCreateWorkflow?`: boolean (default: true)
- `onSearchClick?`: () => void
- `onComposeClick?`: () => void
- `onCreateChannelClick?`: () => void
- `onInviteMemberClick?`: () => void

### ThreadsWidget
- `workspaceSlug` (required): string
- `limit?`: number (default: 5)

### ChannelsWidget
- `workspaceSlug` (required): string
- `limit?`: number (default: 6)

### StatusWidget
- `workspaceSlug` (required): string
- `onSetCustomStatus?`: () => void

### WorkspaceSwitcherWidget
- `currentWorkspaceSlug` (required): string

## API Endpoints Needed

Create these API routes for full functionality:

```
GET  /api/workspaces/[workspaceSlug]/threads?limit=5
GET  /api/workspaces/[workspaceSlug]/channels?starred=true&limit=6
GET  /api/workspaces/[workspaceSlug]/status
PUT  /api/workspaces/[workspaceSlug]/status
DELETE /api/workspaces/[workspaceSlug]/status
GET  /api/workspaces
```

## Customization Examples

### Custom Search Handler
```tsx
<QuickActionsWidget
  workspaceSlug={workspaceSlug}
  onSearchClick={() => {
    // Open custom search modal
    setSearchModalOpen(true);
  }}
/>
```

### Limit Thread Count
```tsx
<ThreadsWidget workspaceSlug={workspaceSlug} limit={3} />
```

### Custom Status Dialog
```tsx
<StatusWidget
  workspaceSlug={workspaceSlug}
  onSetCustomStatus={() => {
    // Open custom status dialog
    setStatusDialogOpen(true);
  }}
/>
```

## File Locations

```
packages/@wundr/neolith/apps/web/app/(workspace)/[workspaceSlug]/dashboard/components/
├── quick-actions-widget.tsx    (139 lines, 3.5K)
├── threads-widget.tsx          (198 lines, 5.8K)
├── channels-widget.tsx         (159 lines, 4.5K)
├── status-widget.tsx           (252 lines, 7.0K)
├── workspace-switcher-widget.tsx (176 lines, 4.6K)
├── index.ts                    (export barrel)
├── README.md                   (full documentation)
├── QUICK_START.md             (this file)
└── WIDGET_IMPLEMENTATION_SUMMARY.md
```

## Features Included

All widgets include:
- Loading skeletons
- Error handling
- Empty states
- TypeScript types
- Accessibility (ARIA labels)
- Responsive design
- Hover states
- Icon support (lucide-react)

## Total Code Stats

- 5 widget components
- 924 lines of code
- ~25.4KB total
- Full TypeScript
- Zero compilation errors
