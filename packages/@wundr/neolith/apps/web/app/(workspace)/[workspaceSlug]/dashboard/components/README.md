# Dashboard Widget Components

This directory contains reusable widget components for the workspace dashboard.

## Available Widgets

### 1. QuickActionsWidget

A card with icon buttons for common actions.

```tsx
import { QuickActionsWidget } from './components';

<QuickActionsWidget
  workspaceSlug={workspaceSlug}
  canCreateWorkflow={hasWorkflowPermission}
  onSearchClick={() => {
    /* custom search handler */
  }}
  onComposeClick={() => {
    /* custom compose handler */
  }}
  onCreateChannelClick={() => {
    /* custom channel creation */
  }}
  onInviteMemberClick={() => {
    /* custom invite handler */
  }}
/>;
```

**Features:**

- New Message (opens compose)
- Create Channel (opens modal/navigates)
- Invite Member (opens invite modal)
- New Workflow (if user has permission)
- Search (focuses global search)
- Keyboard shortcuts displayed
- Hover states and accessibility

### 2. ThreadsWidget

Shows recent threads and mentions with unread count.

```tsx
import { ThreadsWidget } from './components';

<ThreadsWidget
  workspaceSlug={workspaceSlug}
  limit={5} // optional, defaults to 5
/>;
```

**Features:**

- Header with unread count badge
- List of 3-5 recent threads
- Each item shows: channel/DM name, preview, time
- "View all" footer link
- Empty state when no threads
- Loading skeleton
- Error handling

### 3. ChannelsWidget

Displays starred/frequent channels in a grid.

```tsx
import { ChannelsWidget } from './components';

<ChannelsWidget
  workspaceSlug={workspaceSlug}
  limit={6} // optional, defaults to 6
/>;
```

**Features:**

- Grid of channel pills
- Unread indicator dots
- Star icon for starred channels
- "Browse all" link
- Empty state
- Loading skeleton
- Error handling

### 4. StatusWidget

User's current status with quick presets.

```tsx
import { StatusWidget } from './components';

<StatusWidget
  workspaceSlug={workspaceSlug}
  onSetCustomStatus={() => {
    /* open custom status dialog */
  }}
/>;
```

**Features:**

- Current status display (emoji + message)
- Expiration time if set
- Quick status presets:
  - In a meeting (60 min)
  - On vacation (8 hours)
  - At lunch (60 min)
  - Working remotely
  - Away (30 min)
  - Focusing
- "Set custom status" button
- Clear status option
- Loading states
- Error handling

### 5. WorkspaceSwitcherWidget

Quick switcher for users with multiple workspaces.

```tsx
import { WorkspaceSwitcherWidget } from './components';

<WorkspaceSwitcherWidget currentWorkspaceSlug={workspaceSlug} />;
```

**Features:**

- Shows all workspaces user belongs to
- Current workspace highlighted
- Unread count badges
- Workspace avatars
- Auto-hides if user has only one workspace
- Loading skeleton
- Error handling

## Example Dashboard Layout

```tsx
'use client';

import {
  QuickActionsWidget,
  ThreadsWidget,
  ChannelsWidget,
  StatusWidget,
  WorkspaceSwitcherWidget,
} from './components';

export function DashboardWidgets({ workspaceSlug, canCreateWorkflow }) {
  return (
    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
      {/* Row 1 */}
      <QuickActionsWidget workspaceSlug={workspaceSlug} canCreateWorkflow={canCreateWorkflow} />
      <ThreadsWidget workspaceSlug={workspaceSlug} />
      <ChannelsWidget workspaceSlug={workspaceSlug} />

      {/* Row 2 */}
      <StatusWidget workspaceSlug={workspaceSlug} />
      <WorkspaceSwitcherWidget currentWorkspaceSlug={workspaceSlug} />
    </div>
  );
}
```

## API Endpoints Required

The widgets expect the following API endpoints to exist:

### ThreadsWidget

- `GET /api/workspaces/[workspaceSlug]/threads?limit=5`
  - Response: `{ threads: Thread[], unreadCount: number }`

### ChannelsWidget

- `GET /api/workspaces/[workspaceSlug]/channels?starred=true&limit=6`
  - Response: `{ channels: Channel[] }`

### StatusWidget

- `GET /api/workspaces/[workspaceSlug]/status`
  - Response: `{ status: { emoji, message, expiresAt? } }`
- `PUT /api/workspaces/[workspaceSlug]/status`
  - Body: `{ emoji, message, expiresAt? }`
- `DELETE /api/workspaces/[workspaceSlug]/status`

### WorkspaceSwitcherWidget

- `GET /api/workspaces`
  - Response: `{ workspaces: Workspace[] }`

## Common Features

All widgets include:

- **Loading states**: Skeleton loaders while fetching data
- **Error handling**: Error messages with retry capability
- **Empty states**: Helpful messages when no data
- **Accessibility**: ARIA labels, keyboard navigation
- **Responsive design**: Mobile-friendly layouts
- **TypeScript**: Full type safety

## Styling

Widgets use shadcn/ui components and Tailwind CSS classes for consistent styling across the
application. They automatically adapt to light/dark mode.
