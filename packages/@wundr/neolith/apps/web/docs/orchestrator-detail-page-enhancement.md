# Orchestrator Detail Page Enhancement

## Summary

Enhanced the Orchestrator detail page to include Session Manager and Subagent management
capabilities with a tabbed interface.

## File Modified

`/Users/maya/wundr/packages/@wundr/neolith/apps/web/app/(workspace)/[workspaceSlug]/orchestrators/[orchestratorId]/page.tsx`

## Changes Implemented

### 1. New Imports Added

```typescript
import { SessionManagerList } from '@/components/orchestrator/session-manager-list';
import { SessionManagerCreate } from '@/components/orchestrator/session-manager-create';
import { SubagentList } from '@/components/orchestrator/subagent-list';
import { SubagentCreate } from '@/components/orchestrator/subagent-create';
```

### 2. Updated Tab Navigation

Changed from 4 tabs to 6 tabs:

- Overview (existing)
- **Session Managers (new)** - Manages Session Managers for the Orchestrator
- **Subagents (new)** - Displays universal and session-specific subagents
- Configuration (existing)
- Activity (existing)
- Capabilities (existing)

### 3. New Tab Components

#### SessionManagersTab Component

**Features:**

- Overview card with key metrics (Total Session Managers, Active Sessions, Total Subagents, Token
  Budget/hr)
- SessionManagerList component integration
- Create new Session Manager dialog
- Select and view Session Manager details
- Refresh mechanism for real-time updates

**Props:**

- `orchestratorId` - The ID of the current orchestrator

**State Management:**

- `isCreateDialogOpen` - Controls the create dialog visibility
- `selectedSessionManager` - Currently selected Session Manager
- `refreshKey` - Forces component refresh after create/update

#### SubagentsTab Component

**Features:**

- Overview card explaining subagent management
- Universal subagents section (available to all orchestrators)
- Session Manager-specific subagents section
- Create new Subagent dialog (requires Session Manager selection)
- Refresh mechanism for real-time updates

**State Management:**

- `selectedSessionManager` - Selected Session Manager for viewing subagents
- `isCreateDialogOpen` - Controls the create dialog visibility
- `refreshKey` - Forces component refresh after create/update

## Component Integration

### Session Manager List Component

- Displays all Session Managers for the orchestrator
- Shows status indicators (ACTIVE, INACTIVE, PAUSED, ERROR)
- Displays metrics: subagent count, token budget per hour
- Provides toggle status and settings actions
- Handles selection for detailed view

### Session Manager Create Component

- Dialog-based creation form
- Fields: name, description, charter ID, discipline ID
- Configuration: global flag, max concurrent subagents, token budget
- API integration: POST to `/api/orchestrators/{orchestratorId}/session-managers`
- Toast notifications for success/error

### Subagent List Component

- Displays subagents with capability badges
- Shows scope (UNIVERSAL, DISCIPLINE, WORKSPACE, PRIVATE)
- Displays tier, MCP tools, status indicators
- Supports both universal and session-specific modes
- Provides toggle status and settings actions

### Subagent Create Component

- Dialog-based creation form
- Fields: name, description, charter ID
- Configuration: scope, tier, worktree requirement, global flag
- MCP Tools selection (file_read, file_write, bash, git, etc.)
- Capabilities management (add/remove custom capabilities)
- API integration: POST to `/api/session-managers/{sessionManagerId}/subagents`

## User Experience Flow

### Creating a Session Manager

1. Navigate to Orchestrator detail page
2. Click "Session Managers" tab
3. Click "New Session Manager" button
4. Fill in the form (name, charter ID required)
5. Configure max concurrent subagents and token budget
6. Click "Create Session Manager"
7. View created Session Manager in the list

### Creating a Subagent

1. Navigate to Orchestrator detail page
2. Click "Subagents" tab
3. View universal subagents (pre-configured)
4. Select a Session Manager from the Session Managers tab first
5. Click "New Subagent" button
6. Fill in the form (name, charter ID required)
7. Select scope, worktree requirement, and tier
8. Add MCP tools and capabilities
9. Click "Create Subagent"
10. View created Subagent in the list

## API Endpoints Used

### Session Managers

- `GET /api/orchestrators/{orchestratorId}/session-managers` - Fetch all Session Managers
- `POST /api/orchestrators/{orchestratorId}/session-managers` - Create Session Manager
- `POST /api/session-managers/{id}/activate` - Activate Session Manager
- `POST /api/session-managers/{id}/deactivate` - Deactivate Session Manager

### Subagents

- `GET /api/subagents/universal` - Fetch universal subagents
- `GET /api/session-managers/{sessionManagerId}/subagents` - Fetch Session Manager subagents
- `POST /api/session-managers/{sessionManagerId}/subagents` - Create Subagent
- `POST /api/subagents/{id}/activate` - Activate Subagent
- `POST /api/subagents/{id}/deactivate` - Deactivate Subagent

## Features Implemented

### Loading States

- Skeleton loaders for Session Manager list
- Skeleton loaders for Subagent list
- Loading indicators in create dialogs

### Error Handling

- Error cards with retry buttons
- Toast notifications for API errors
- Form validation with required field indicators

### Empty States

- Session Manager empty state with helpful message
- Subagent empty state with creation instructions
- Session Manager selection prompt for subagents

### Status Management

- Visual status indicators (colored dots)
- Toggle status buttons (play/pause icons)
- Status colors: green (ACTIVE), gray (INACTIVE), yellow (PAUSED), red (ERROR)

### Metrics Display

- Session Manager overview metrics
- Subagent count per Session Manager
- Token budget display with locale formatting
- Tier badges for subagents

## Design Patterns Used

1. **Composition** - Tab components composed from smaller components
2. **Controlled Components** - Dialog state managed by parent
3. **Callback Props** - onSelect, onCreateNew, onCreated callbacks
4. **Key-based Refresh** - refreshKey pattern for forcing re-renders
5. **Separation of Concerns** - Business logic in hooks, UI in components

## Future Enhancements

1. **Real-time Metrics** - Live updates for Session Manager metrics
2. **Session Manager Selection** - Direct selection from Session Managers tab to Subagents tab
3. **Bulk Operations** - Select multiple Session Managers/Subagents for bulk actions
4. **Filtering and Search** - Filter subagents by scope, tier, capabilities
5. **Detailed Views** - Drill-down into Session Manager and Subagent details
6. **Visual Workflow** - Diagram showing orchestrator → session managers → subagents hierarchy

## Testing Recommendations

1. Test Session Manager creation with all field combinations
2. Test Subagent creation with different scopes and MCP tools
3. Test status toggling for Session Managers and Subagents
4. Test empty states and error states
5. Test tab navigation and state persistence
6. Test refresh mechanism after create/update operations

## Accessibility

- All interactive elements have proper ARIA labels
- Keyboard navigation supported throughout
- Focus management in dialogs
- Color contrast meets WCAG standards
- Screen reader friendly with semantic HTML
