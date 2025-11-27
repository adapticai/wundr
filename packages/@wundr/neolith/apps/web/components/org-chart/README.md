# Organization Chart Components (Wave 1.1.3)

This directory contains components for displaying organization hierarchy with expandable/collapsible tree views.

## Components

### OrgHierarchyChart
Main component for displaying the organization hierarchy as a tree structure.

**Features:**
- Expandable/collapsible nodes (Organization, Workspace, Orchestrator levels)
- Discipline-based color coding for VPs
- Orchestrator status indicators (Online, Offline, Busy, Away)
- Authority level badges (Owner, Admin, Member)
- Drill-down to Orchestrator details via popover
- Responsive grid layouts
- Team statistics and grouping

**Usage:**
```tsx
import { OrgHierarchyChart, type OrgHierarchyNode } from '@/components/org-chart';

const hierarchy: OrgHierarchyNode = {
  id: 'org-1',
  type: 'organization',
  name: 'Acme Corp',
  data: {
    role: 'OWNER',
  },
  children: [
    {
      id: 'workspace-1',
      type: 'workspace',
      name: 'Engineering',
      data: {
        vpCount: 5,
        onlineVPCount: 3,
      },
      children: [
        {
          id: 'orchestrator-1',
          type: 'vp',
          name: 'John Doe',
          data: {
            avatarUrl: '/avatars/john.jpg',
            status: 'ONLINE',
            discipline: 'Engineering',
            role: 'ADMIN',
            currentTask: 'Reviewing pull requests',
          },
        },
        // ... more VPs
      ],
    },
    // ... more workspaces
  ],
};

<OrgHierarchyChart
  hierarchy={hierarchy}
  onNodeClick={(node) => console.log('Clicked:', node)}
/>
```

### OrgNode
Individual node component for rendering Organization, Workspace, or Orchestrator nodes.

**Features:**
- Auto-expand first 2 levels
- Click to expand/collapse
- Visual hierarchy with connecting lines
- Grouped Orchestrator display by discipline
- Status dots and badges

### VPDetailsPopover
Popover component showing quick Orchestrator details on click.

**Features:**
- Avatar and name
- Discipline badge
- Current status
- Active task display
- Quick action buttons (View Details, Start Chat)

### OrgConnector
Visual connection lines between hierarchy nodes.

**Types:**
- `OrgConnector`: Vertical/horizontal lines for tree structure
- `DisciplineConnector`: Reporting lines between VPs

## Data Structure

```typescript
interface OrgHierarchyNode {
  id: string;
  type: 'organization' | 'workspace' | 'vp';
  name: string;
  children?: OrgHierarchyNode[];
  data?: {
    avatarUrl?: string;
    status?: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'AWAY';
    discipline?: string;
    role?: 'OWNER' | 'ADMIN' | 'MEMBER';
    currentTask?: string;
    vpCount?: number;
    onlineVPCount?: number;
    pendingTasks?: number;
    supervisorId?: string;
  };
}
```

## Loading States

```tsx
import { OrgHierarchyChartSkeleton } from '@/components/org-chart';

<OrgHierarchyChartSkeleton />
```

## Empty States

```tsx
import { OrgHierarchyChartEmpty } from '@/components/org-chart';

<OrgHierarchyChartEmpty message="No organization data found" />
```

## Error States

```tsx
import { OrgHierarchyChartError } from '@/components/org-chart';

<OrgHierarchyChartError error="Failed to load organization data" />
```

## Discipline Colors

The following disciplines have predefined color schemes:
- Engineering: Blue
- Product: Purple
- Design: Pink
- Marketing: Orange
- Sales: Green
- Operations: Yellow
- Finance: Emerald
- Human Resources: Rose
- Customer Success: Teal
- Legal: Gray
- Research: Indigo
- Data Science: Cyan

Colors are automatically applied based on the VP's discipline field.

## Tasks Implemented

### 1.1.3.1 - Org Chart Visualization
- ✅ Tree/hierarchy view with Organization > Workspace > Orchestrator structure
- ✅ CSS Grid/Flexbox layouts
- ✅ Expandable/collapsible nodes

### 1.1.3.2 - Orchestrator Reporting Lines
- ✅ Supervisor/subordinate relationship display
- ✅ Visual connection lines (OrgConnector component)
- ✅ Discipline hierarchy grouping

### 1.1.3.3 - Authority Levels & Permissions
- ✅ Role badges (OWNER, ADMIN, MEMBER)
- ✅ Orchestrator status indicators (ONLINE, OFFLINE, BUSY, AWAY)
- ✅ Visual permission level indicators

### 1.1.3.4 - Drill-down to Orchestrator Details
- ✅ VPDetailsPopover component
- ✅ Click to view details
- ✅ Quick actions (View Details, Start Chat)
- ✅ Tooltip for quick info

### 1.1.3.5 - Department/Team Grouping
- ✅ VPs grouped by discipline
- ✅ Color coding per discipline
- ✅ Team statistics (VP count, online count)

## Notes

- All components use TypeScript with strict typing
- Built with existing UI components (Button, Card, Badge, Avatar, Tooltip, Popover)
- Fully responsive with mobile, tablet, and desktop layouts
- Handles loading and empty states gracefully
- Uses Lucide icons for visual elements
