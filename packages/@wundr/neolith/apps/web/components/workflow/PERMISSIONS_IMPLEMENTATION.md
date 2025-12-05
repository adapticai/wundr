# Workflow Permissions and Sharing Implementation

## Overview

This document describes the implementation of the workflow sharing and permissions management UI for the Wundr Neolith platform. The implementation provides comprehensive access control and collaboration features for workflows.

## Components

### 1. WorkflowPermissions Component

**File**: `components/workflow/workflow-permissions.tsx`

A full-featured permissions management interface that provides:

#### Features

- **Permission Levels**: Four granular permission levels
  - **View**: Can view workflow details and execution history
  - **Edit**: Can modify workflow configuration and settings
  - **Execute**: Can trigger and run the workflow
  - **Admin**: Full control including permissions management

- **Permission Management**
  - Search and filter permissions by name or email
  - Filter by subject type (users, teams, roles)
  - Update permission levels inline
  - Remove permissions with confirmation
  - Visual indicators for inherited permissions

- **Sharing Configuration**
  - Visibility settings (Private, Workspace, Public)
  - Inherit workspace permissions toggle
  - Public share link generation and management
  - Copy share link to clipboard
  - Revoke share link functionality

- **Access Log**
  - Collapsible access log viewer
  - Track all workflow access events (viewed, edited, executed, shared, permission changes)
  - User avatars and timestamps
  - Expandable details for each log entry
  - Relative time formatting (e.g., "2h ago", "Just now")

- **Permission Inheritance**
  - Visual banner showing inherited workspace permissions
  - Inherited permissions are read-only and clearly marked
  - Count of inherited permissions displayed

#### Props

```typescript
interface WorkflowPermissionsProps {
  workflowId: WorkflowId;
  workflowName: string;
  permissions: WorkflowPermission[];
  accessLog: WorkflowAccessLog[];
  sharingConfig: WorkflowSharingConfig;
  workspacePermissions?: WorkflowPermission[];
  isOwner?: boolean;
  onUpdatePermission: (permissionId: string, level: WorkflowPermissionLevel) => Promise<void>;
  onRemovePermission: (permissionId: string) => Promise<void>;
  onAddPermission: (subjectType: PermissionSubjectType, subjectId: string, level: WorkflowPermissionLevel) => Promise<void>;
  onUpdateSharingConfig: (config: Partial<WorkflowSharingConfig>) => Promise<void>;
  onGenerateShareLink: () => Promise<string>;
  onRevokeShareLink: () => Promise<void>;
  onCopyShareLink: (link: string) => void;
}
```

#### Usage Example

```tsx
import { WorkflowPermissions } from '@/components/workflow';

function WorkflowSettingsPage() {
  return (
    <WorkflowPermissions
      workflowId={workflow.id}
      workflowName={workflow.name}
      permissions={permissions}
      accessLog={accessLog}
      sharingConfig={sharingConfig}
      workspacePermissions={workspacePermissions}
      isOwner={isOwner}
      onUpdatePermission={handleUpdatePermission}
      onRemovePermission={handleRemovePermission}
      onAddPermission={handleAddPermission}
      onUpdateSharingConfig={handleUpdateSharingConfig}
      onGenerateShareLink={handleGenerateShareLink}
      onRevokeShareLink={handleRevokeShareLink}
      onCopyShareLink={handleCopyShareLink}
    />
  );
}
```

### 2. ShareDialog Component

**File**: `components/workflow/share-dialog.tsx`

A modal dialog for quickly sharing workflows with users and teams.

#### Features

- **Entity Search**
  - Real-time search for users and teams
  - Toggle between user and team search
  - Debounced search with loading indicator
  - Filter out already-shared entities

- **Permission Selection**
  - Individual permission level per recipient
  - Default permission level setting
  - Visual permission descriptions

- **Batch Sharing**
  - Add multiple recipients before sharing
  - Remove recipients from selection
  - Update individual permission levels
  - Optional message with share invitation

- **Current Shares Summary**
  - Display count of current shares
  - Visual feedback on share success/failure

#### Props

```typescript
interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: WorkflowId;
  workflowName: string;
  currentShares: ShareableEntity[];
  onShare: (recipients: ShareRecipient[], message?: string) => Promise<void>;
  onSearchEntities: (query: string, type: 'user' | 'team') => Promise<ShareableEntity[]>;
}
```

#### Usage Example

```tsx
import { ShareDialog, QuickShareButton } from '@/components/workflow';

function WorkflowHeader() {
  const [showShareDialog, setShowShareDialog] = useState(false);

  // Using the quick share button
  return (
    <QuickShareButton
      workflowId={workflow.id}
      workflowName={workflow.name}
      currentShares={currentShares}
      onShare={handleShare}
      onSearchEntities={handleSearchEntities}
      variant="outline"
      size="default"
      showLabel={true}
    />
  );

  // Or using the dialog directly
  return (
    <>
      <Button onClick={() => setShowShareDialog(true)}>Share</Button>
      <ShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        workflowId={workflow.id}
        workflowName={workflow.name}
        currentShares={currentShares}
        onShare={handleShare}
        onSearchEntities={handleSearchEntities}
      />
    </>
  );
}
```

### 3. QuickShareButton Component

A convenience component that combines a button trigger with the ShareDialog.

#### Props

```typescript
interface QuickShareButtonProps {
  workflowId: WorkflowId;
  workflowName: string;
  currentShares: ShareableEntity[];
  onShare: (recipients: ShareRecipient[], message?: string) => Promise<void>;
  onSearchEntities: (query: string, type: 'user' | 'team') => Promise<ShareableEntity[]>;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
}
```

## Type Definitions

### Core Types

```typescript
// Permission levels
export type WorkflowPermissionLevel = 'view' | 'edit' | 'execute' | 'admin';

// Subject types
export type PermissionSubjectType = 'user' | 'team' | 'role';

// Visibility settings
export type WorkflowVisibility = 'private' | 'workspace' | 'public';

// Permission entry
export interface WorkflowPermission {
  id: string;
  subjectType: PermissionSubjectType;
  subjectId: string;
  subjectName: string;
  subjectEmail?: string;
  subjectAvatarUrl?: string;
  level: WorkflowPermissionLevel;
  inheritedFrom?: string;
  grantedAt: string;
  grantedBy: string;
  expiresAt?: string;
}

// Access log entry
export interface WorkflowAccessLog {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  action: 'viewed' | 'edited' | 'executed' | 'shared' | 'permission_changed';
  timestamp: string;
  details?: string;
}

// Sharing configuration
export interface WorkflowSharingConfig {
  visibility: WorkflowVisibility;
  allowPublicAccess: boolean;
  publicShareLink?: string;
  requireApproval: boolean;
  inheritWorkspacePermissions: boolean;
}

// Shareable entity
export interface ShareableEntity {
  id: string;
  type: 'user' | 'team';
  name: string;
  email?: string;
  avatarUrl?: string;
  memberCount?: number;
  currentPermission?: WorkflowPermissionLevel | null;
}

// Share recipient
export interface ShareRecipient {
  entity: ShareableEntity;
  level: WorkflowPermissionLevel;
}
```

## UI Components Used

The implementation leverages the following shadcn/ui components:

- **Dialog**: Modal for share interface
- **Select**: Permission level dropdowns
- **Avatar**: User/team profile pictures
- **Switch**: Toggle controls
- **Button**: Action triggers
- **Input**: Search and text inputs
- **Label**: Form labels
- **Badge**: Status indicators
- **Table**: Permissions list
- **ScrollArea**: Scrollable content areas
- **Separator**: Visual dividers

## Styling and Theming

All components support:
- Light and dark mode via Tailwind CSS
- Consistent color palette using theme variables
- Responsive design for mobile and desktop
- Accessible keyboard navigation
- Focus indicators for keyboard users

## Backend Integration Points

The components expect the following backend API endpoints:

### Permission Management
- `GET /api/workspaces/{workspaceSlug}/workflows/{workflowId}/permissions`
- `POST /api/workspaces/{workspaceSlug}/workflows/{workflowId}/permissions`
- `PATCH /api/workspaces/{workspaceSlug}/workflows/{workflowId}/permissions/{permissionId}`
- `DELETE /api/workspaces/{workspaceSlug}/workflows/{workflowId}/permissions/{permissionId}`

### Sharing
- `POST /api/workspaces/{workspaceSlug}/workflows/{workflowId}/share`
- `POST /api/workspaces/{workspaceSlug}/workflows/{workflowId}/share-link/generate`
- `DELETE /api/workspaces/{workspaceSlug}/workflows/{workflowId}/share-link`

### Entity Search
- `GET /api/workspaces/{workspaceSlug}/users/search?q={query}`
- `GET /api/workspaces/{workspaceSlug}/teams/search?q={query}`

### Access Log
- `GET /api/workspaces/{workspaceSlug}/workflows/{workflowId}/access-log`

## Security Considerations

1. **Permission Validation**: All permission changes should be validated on the backend
2. **Owner Protection**: Workflow owners cannot be removed or have permissions reduced
3. **Inherited Permissions**: Cannot be modified through the workflow interface
4. **Share Link Security**: Generate cryptographically secure tokens for public share links
5. **Access Logging**: All permission changes and access events should be logged
6. **Rate Limiting**: Implement rate limits on share link generation

## Accessibility

- ARIA labels on all interactive elements
- Keyboard navigation support
- Focus management in dialogs
- Screen reader friendly table structure
- Color contrast meets WCAG AA standards

## Performance Optimizations

1. **Debounced Search**: 300ms debounce on search input
2. **Memoized Filtering**: Uses `useMemo` for filtered permissions
3. **Optimistic Updates**: Immediate UI feedback before API responses
4. **Lazy Loading**: Access log loads on demand
5. **Virtual Scrolling**: Consider for large permission lists (>100 items)

## Future Enhancements

Potential improvements for future versions:

1. **Advanced Filtering**: Filter by permission level, date granted, etc.
2. **Bulk Operations**: Select and update multiple permissions at once
3. **Permission Templates**: Save and reuse common permission sets
4. **Expiring Permissions**: Set time-based expiration on permissions
5. **Conditional Access**: Permission rules based on time, location, etc.
6. **Audit Trail Export**: Export access logs to CSV/JSON
7. **Activity Notifications**: Real-time notifications for permission changes
8. **Permission Requests**: Allow users to request access to workflows
9. **Team Hierarchies**: Respect team hierarchies in permission inheritance
10. **Fine-grained Permissions**: More granular control over specific actions

## Testing Recommendations

### Unit Tests
- Permission filtering logic
- Time formatting utilities
- Permission level validation
- Search debouncing

### Integration Tests
- Add/remove permissions flow
- Share dialog complete workflow
- Permission inheritance behavior
- Access log recording

### E2E Tests
- Complete sharing workflow
- Permission level changes
- Public link generation and access
- Mobile responsive behavior

## Files Created

- `/Users/granfar/wundr/packages/@wundr/neolith/apps/web/components/workflow/workflow-permissions.tsx`
- `/Users/granfar/wundr/packages/@wundr/neolith/apps/web/components/workflow/share-dialog.tsx`
- Updated: `/Users/granfar/wundr/packages/@wundr/neolith/apps/web/components/workflow/index.ts`

## Build Verification

Build completed successfully with no errors:
```bash
npm run build
# ✓ Build completed successfully
```

All TypeScript types are properly exported and the components integrate seamlessly with the existing codebase.
