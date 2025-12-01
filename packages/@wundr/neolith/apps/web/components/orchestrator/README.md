# Orchestrator Interaction Components

UI components for Orchestrator (VP) interaction in the Genesis App.

## Components

### VPStatusBadge

Display Orchestrator status with optional tooltip showing current task.

**Props:**

- `status: VPStatus` - The Orchestrator status (ACTIVE, INACTIVE, PROVISIONING, ERROR, SUSPENDED)
- `size?: 'sm' | 'md' | 'lg'` - Badge size (default: 'md')
- `showPulse?: boolean` - Show animated pulse indicator (default: true)
- `className?: string` - Additional CSS classes
- `currentTask?: string` - Current task description (for tooltip)
- `showTooltip?: boolean` - Enable tooltip display (default: false)

**Example:**

```tsx
import { VPStatusBadge } from '@/components/vp';

// Basic usage
<Orchestrator StatusBadge status="ACTIVE" />

// With tooltip showing current task
<Orchestrator StatusBadge
  status="ACTIVE"
  currentTask="Analyzing user feedback"
  showTooltip
/>
```

### VPTaskAssignmentDialog

Dialog for assigning tasks to VPs with form validation.

**Props:**

- `vps: VP[]` - Array of available VPs
- `onAssignTask?: (task: TaskAssignmentFormValues) => Promise<void>` - Task assignment handler
- `trigger?: React.ReactNode` - Custom trigger element (optional)
- `open?: boolean` - Controlled open state
- `onOpenChange?: (open: boolean) => void` - Open state change handler

**Task Form Values:**

```typescript
{
  title: string; // Task title (1-100 chars)
  description: string; // Task description (1-1000 chars)
  priority: 'low' | 'medium' | 'high' | 'urgent';
  vpId: string; // Selected Orchestrator ID
}
```

**Example:**

```tsx
import { VPTaskAssignmentDialog } from '@/components/vp';
import { Button } from '@/components/ui/button';

function MyComponent() {
  const handleAssignTask = async task => {
    // Send task to API
    await fetch('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    });
  };

  return (
    <Orchestrator
      TaskAssignmentDialog
      orchestrators={availableVPs}
      onAssignTask={handleAssignTask}
      trigger={<Button>Assign Task</Button>}
    />
  );
}
```

### VPPresenceIndicator

Show Orchestrator online/offline status with current activity.

**Props:**

- `status: VPPresenceStatus` - Presence status ('online', 'offline', 'working', 'idle')
- `vpStatus?: VPStatus` - Orchestrator status (for tooltip)
- `currentActivity?: string` - Current activity description
- `size?: 'sm' | 'md' | 'lg'` - Indicator size (default: 'md')
- `showLabel?: boolean` - Show text label (default: false)
- `className?: string` - Additional CSS classes

**Example:**

```tsx
import { VPPresenceIndicator } from '@/components/vp';

// Basic usage
<Orchestrator PresenceIndicator status="working" />

// With label and activity
<Orchestrator PresenceIndicator
  status="working"
  currentActivity="Processing documents"
  showLabel
/>
```

### VPPresenceCard

Composite component showing presence, activity, and last active time.

**Props:**

- `status: VPPresenceStatus` - Presence status
- `vpStatus?: VPStatus` - Orchestrator status
- `vpName: string` - Orchestrator name
- `currentActivity?: string` - Current activity
- `lastActiveAt?: Date` - Last activity timestamp
- `className?: string` - Additional CSS classes

**Example:**

```tsx
import { VPPresenceCard } from '@/components/vp';

<Orchestrator
  PresenceCard
  status='working'
  vpName='Sarah Thompson'
  currentActivity='Reviewing quarterly reports'
  lastActiveAt={new Date('2024-01-15T10:30:00Z')}
/>;
```

### VPTypingIndicator

Animated indicator showing Orchestrator is actively working.

**Props:**

- `vpName: string` - Orchestrator name

**Example:**

```tsx
import { VPTypingIndicator } from '@/components/vp';

<Orchestrator TypingIndicator vpName='Sarah Thompson' />;
```

### TaskPriorityBadge

Display task priority with color coding.

**Props:**

- `priority: 'low' | 'medium' | 'high' | 'urgent'`

**Example:**

```tsx
import { TaskPriorityBadge } from '@/components/vp';

<TaskPriorityBadge priority='high' />;
```

## Complete Example

```tsx
'use client';

import { useState } from 'react';
import {
  VPStatusBadge,
  VPPresenceIndicator,
  VPPresenceCard,
  VPTaskAssignmentDialog,
  VPTypingIndicator,
} from '@/components/vp';
import { Button } from '@/components/ui/button';

export function VPDashboard({ vp, allVPs }) {
  const [isTyping, setIsTyping] = useState(false);

  const handleAssignTask = async task => {
    console.log('Assigning task:', task);
    // Your API logic here
  };

  return (
    <div className='space-y-6'>
      {/* Orchestrator Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <h1 className='text-2xl font-bold'>{vp.title}</h1>
          <Orchestrator
            StatusBadge
            status={vp.status}
            currentTask='Analyzing user data'
            showTooltip
          />
          <Orchestrator PresenceIndicator status='working' currentActivity='Processing documents' />
        </div>
        <Orchestrator
          TaskAssignmentDialog
          orchestrators={allVPs}
          onAssignTask={handleAssignTask}
          trigger={<Button>Assign New Task</Button>}
        />
      </div>

      {/* Activity */}
      <Orchestrator
        PresenceCard
        status='working'
        vpName={vp.title}
        currentActivity='Reviewing quarterly reports'
        lastActiveAt={vp.lastActivityAt}
      />

      {/* Typing Indicator */}
      {isTyping && <Orchestrator TypingIndicator vpName={vp.title} />}
    </div>
  );
}
```

## Type Definitions

All components use TypeScript for type safety. Key types:

```typescript
type VPStatus = 'ACTIVE' | 'INACTIVE' | 'PROVISIONING' | 'ERROR' | 'SUSPENDED';
type VPPresenceStatus = 'online' | 'offline' | 'working' | 'idle';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

interface Orchestrator {
  id: string;
  title: string;
  status: VPStatus;
  discipline?: string;
  avatarUrl?: string;
  lastActivityAt?: Date;
  // ... other fields
}
```

## Styling

All components use Tailwind CSS and follow the Shadcn/ui design system:

- Consistent spacing and sizing
- Dark mode support
- Accessible color contrasts
- Responsive design
- Smooth animations

## Accessibility

Components follow WAI-ARIA best practices:

- Proper ARIA labels and roles
- Keyboard navigation support
- Screen reader friendly
- Focus management
- Semantic HTML
