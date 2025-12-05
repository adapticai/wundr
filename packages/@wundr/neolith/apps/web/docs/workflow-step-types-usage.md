# Workflow Step Types - Usage Guide

## Overview

The workflow step types library provides a comprehensive set of pre-defined workflow steps that can
be used to build visual workflow automation systems. This guide demonstrates how to use the library
in your application.

## Installation

The library is already included in the project. Import from:

```typescript
import {
  // Step types
  ALL_STEP_TYPES,
  WEBHOOK_TRIGGER,
  SEND_MESSAGE_ACTION,
  IF_ELSE_CONDITION,
  FOR_EACH_LOOP,

  // Categories
  STEP_CATEGORIES,

  // Helper functions
  getStepsByCategory,
  getStepById,
  searchSteps,

  // Types
  StepType,
  StepCategory,
  Port,
} from '@/lib/workflow/step-types';

// UI Component
import { StepPalette } from '@/components/workflow/step-palette';
```

## Basic Usage

### 1. Display the Step Palette

```typescript
'use client';

import { StepPalette } from '@/components/workflow/step-palette';
import type { StepType } from '@/lib/workflow/step-types';

export function WorkflowBuilder() {
  const handleStepSelect = (step: StepType) => {
    console.log('Selected step:', step.name);
    // Add step to your workflow canvas
  };

  return (
    <div className="flex h-screen">
      <aside className="w-80 border-r">
        <StepPalette
          onStepSelect={handleStepSelect}
          initialExpanded={['triggers', 'actions']}
        />
      </aside>
      <main className="flex-1">
        {/* Your workflow canvas here */}
      </main>
    </div>
  );
}
```

### 2. Search for Specific Steps

```typescript
import { searchSteps } from '@/lib/workflow/step-types';

// Find all steps related to messaging
const messagingSteps = searchSteps('message');
// Returns: [SEND_MESSAGE_ACTION, MESSAGE_RECEIVED_TRIGGER, ...]

// Find email-related steps
const emailSteps = searchSteps('email');
// Returns: [SEND_EMAIL_ACTION]
```

### 3. Get Steps by Category

```typescript
import { getStepsByCategory } from '@/lib/workflow/step-types';

// Get all trigger steps
const triggers = getStepsByCategory('triggers');

// Get all action steps
const actions = getStepsByCategory('actions');

// Get all condition steps
const conditions = getStepsByCategory('conditions');
```

### 4. Validate Step Configuration

```typescript
import { SEND_MESSAGE_ACTION } from '@/lib/workflow/step-types';

// Valid configuration
const validConfig = {
  channelId: 'channel-123',
  message: 'Hello, world!',
  mentions: ['user-456'],
};

const result = SEND_MESSAGE_ACTION.configSchema.safeParse(validConfig);

if (result.success) {
  console.log('Valid configuration:', result.data);
} else {
  console.error('Validation errors:', result.error.issues);
}
```

### 5. Create a Workflow Step Instance

```typescript
import { SEND_MESSAGE_ACTION } from '@/lib/workflow/step-types';

interface WorkflowStep {
  id: string;
  stepType: StepType;
  config: any;
  position: { x: number; y: number };
}

function addStepToWorkflow(stepType: StepType): WorkflowStep {
  return {
    id: generateId(),
    stepType,
    config: stepType.defaultConfig,
    position: { x: 100, y: 100 },
  };
}

// Add a send message step
const messageStep = addStepToWorkflow(SEND_MESSAGE_ACTION);
```

## Advanced Usage

### Custom Step Configuration Form

```typescript
import { SEND_MESSAGE_ACTION } from '@/lib/workflow/step-types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

export function SendMessageForm() {
  const form = useForm({
    resolver: zodResolver(SEND_MESSAGE_ACTION.configSchema),
    defaultValues: SEND_MESSAGE_ACTION.defaultConfig,
  });

  const onSubmit = (data: any) => {
    console.log('Form data:', data);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <input {...form.register('channelId')} placeholder="Channel ID" />
      <textarea {...form.register('message')} placeholder="Message" />
      <button type="submit">Save</button>
    </form>
  );
}
```

### Drag and Drop Integration

```typescript
import { StepPalette } from '@/components/workflow/step-palette';
import type { StepType } from '@/lib/workflow/step-types';

export function WorkflowCanvas() {
  const handleDragStart = (step: StepType, event: React.DragEvent) => {
    // Set drag data
    event.dataTransfer.effectAllowed = 'copy';
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const data = JSON.parse(event.dataTransfer.getData('application/json'));

    // Get step by ID and add to canvas
    const step = getStepById(data.stepId);
    if (step) {
      addStepToCanvas(step, {
        x: event.clientX,
        y: event.clientY,
      });
    }
  };

  return (
    <div className="flex">
      <StepPalette
        onStepDragStart={handleDragStart}
      />
      <div
        className="flex-1"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {/* Canvas content */}
      </div>
    </div>
  );
}
```

### Building a Complete Workflow

```typescript
import {
  MESSAGE_RECEIVED_TRIGGER,
  IF_ELSE_CONDITION,
  SEND_MESSAGE_ACTION,
  SEND_EMAIL_ACTION,
} from '@/lib/workflow/step-types';

interface Workflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
  connections: Connection[];
}

function createOnboardingWorkflow(): Workflow {
  return {
    id: 'onboarding-1',
    name: 'New User Onboarding',
    steps: [
      {
        id: 'trigger-1',
        stepType: USER_JOIN_TRIGGER,
        config: {
          sendWelcomeMessage: true,
        },
        position: { x: 100, y: 100 },
      },
      {
        id: 'condition-1',
        stepType: IF_ELSE_CONDITION,
        config: {
          conditions: [{
            field: 'user.email',
            operator: 'exists',
            value: true,
          }],
          logic: 'and',
        },
        position: { x: 100, y: 300 },
      },
      {
        id: 'action-1',
        stepType: SEND_EMAIL_ACTION,
        config: {
          to: ['{{user.email}}'],
          subject: 'Welcome to the team!',
          body: 'We're excited to have you.',
          html: false,
        },
        position: { x: 300, y: 400 },
      },
      {
        id: 'action-2',
        stepType: SEND_MESSAGE_ACTION,
        config: {
          channelId: 'general',
          message: 'Please welcome {{user.name}} to the team!',
        },
        position: { x: 100, y: 500 },
      },
    ],
    connections: [
      { from: 'trigger-1', to: 'condition-1', fromPort: 'flow', toPort: 'flow' },
      { from: 'condition-1', to: 'action-1', fromPort: 'then', toPort: 'flow' },
      { from: 'condition-1', to: 'action-2', fromPort: 'else', toPort: 'flow' },
    ],
  };
}
```

## Step Type Categories

### Triggers (4 steps)

- `WEBHOOK_TRIGGER` - HTTP webhook events
- `SCHEDULE_TRIGGER` - Time-based scheduling
- `MESSAGE_RECEIVED_TRIGGER` - Message events
- `USER_JOIN_TRIGGER` - User joining events

### Actions (5 steps)

- `SEND_MESSAGE_ACTION` - Send channel message
- `SEND_EMAIL_ACTION` - Send email
- `HTTP_REQUEST_ACTION` - Make HTTP request
- `ASSIGN_TASK_ACTION` - Create and assign task
- `UPDATE_STATUS_ACTION` - Update entity status

### Conditions (2 steps)

- `IF_ELSE_CONDITION` - Binary branching
- `SWITCH_CASE_CONDITION` - Multi-way branching

### Loops (2 steps)

- `FOR_EACH_LOOP` - Array iteration
- `WHILE_LOOP` - Conditional looping

### Integrations (1 step)

- `SLACK_INTEGRATION` - Slack operations

### Data (2 steps)

- `TRANSFORM_DATA` - Data transformation
- `FILTER_DATA` - Data filtering

### Utilities (2 steps)

- `WAIT_DELAY` - Time delay
- `ERROR_HANDLER` - Error handling

## Port System

Each step defines input and output ports:

```typescript
{
  id: 'message',
  label: 'Message',
  type: 'data',          // 'trigger' | 'action' | 'flow' | 'data'
  direction: 'input',    // 'input' | 'output'
  dataType: 'string',    // 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any'
  required: true,        // Is this port required?
  multiple: false,       // Can multiple connections be made?
}
```

### Port Types

- **trigger**: Start of workflow execution
- **action**: Action execution control
- **flow**: Execution flow control
- **data**: Data passing between steps

### Connecting Ports

```typescript
interface Connection {
  from: string; // Source step ID
  to: string; // Target step ID
  fromPort: string; // Source port ID
  toPort: string; // Target port ID
}
```

## Configuration Schemas

All step configurations use Zod schemas:

```typescript
import { z } from 'zod';

// Get the schema
const schema = SEND_MESSAGE_ACTION.configSchema;

// Parse and validate
const result = schema.safeParse({
  channelId: 'channel-123',
  message: 'Hello!',
});

// Get TypeScript type
type SendMessageConfig = z.infer<typeof schema>;
```

## Best Practices

### 1. Always Validate Configuration

```typescript
const result = stepType.configSchema.safeParse(userInput);
if (!result.success) {
  // Handle validation errors
  result.error.issues.forEach(issue => {
    console.error(`${issue.path}: ${issue.message}`);
  });
}
```

### 2. Use Default Configuration as Starting Point

```typescript
const newStep = {
  ...stepType.defaultConfig,
  // Override specific fields
  channelId: 'my-channel',
};
```

### 3. Leverage Type Safety

```typescript
import type { StepType } from '@/lib/workflow/step-types';

function addStep(stepType: StepType) {
  // TypeScript ensures stepType has all required properties
  const { name, icon, configSchema, defaultConfig } = stepType;
}
```

### 4. Use Helper Functions

```typescript
// Instead of filtering manually
const triggers = ALL_STEP_TYPES.filter(s => s.category === 'triggers');

// Use the helper
const triggers = getStepsByCategory('triggers');
```

## Styling and Theming

The StepPalette component uses Tailwind CSS and shadcn/ui components:

```typescript
<StepPalette
  className="custom-class"
  compact={false}  // Use compact mode for smaller spaces
/>
```

Category colors are defined in the step types:

```typescript
const categoryInfo = STEP_CATEGORIES['triggers'];
// { color: 'text-yellow-500', icon: Zap, ... }
```

## Examples

See the complete examples in:

- `/docs/PHASE_6_AGENT_2_COMPLETION_REPORT.md`
- Component source: `/components/workflow/step-palette.tsx`
- Type definitions: `/lib/workflow/step-types.ts`

## Troubleshooting

### Step not appearing in palette

```typescript
// Check if step is in ALL_STEP_TYPES
import { ALL_STEP_TYPES } from '@/lib/workflow/step-types';
console.log(ALL_STEP_TYPES.length); // Should be 19

// Check if step has correct category
console.log(SEND_MESSAGE_ACTION.category); // Should be 'actions'
```

### Validation failing

```typescript
// Get detailed error information
const result = schema.safeParse(data);
if (!result.success) {
  console.log(result.error.format());
}
```

### Icons not showing

```typescript
// Ensure lucide-react is installed
import { Zap } from 'lucide-react';

// Icons are imported in step-types.ts
// Make sure the import path is correct
```

## Contributing

To add a new step type:

1. Define the configuration schema using Zod
2. Create the step type object with all required fields
3. Add it to the `ALL_STEP_TYPES` array
4. Update this documentation

Example:

```typescript
// 1. Define schema
const myStepSchema = z.object({
  field1: z.string(),
  field2: z.number().optional(),
});

// 2. Create step type
export const MY_STEP: StepType = {
  id: 'category.my_step',
  name: 'My Step',
  description: 'Description of what this step does',
  category: 'actions',
  icon: MyIcon,
  color: 'text-blue-500',
  inputs: [
    /* ... */
  ],
  outputs: [
    /* ... */
  ],
  configSchema: myStepSchema,
  defaultConfig: {
    field1: 'default value',
  },
  tags: ['tag1', 'tag2'],
};

// 3. Add to ALL_STEP_TYPES
export const ALL_STEP_TYPES = [
  // ... existing steps
  MY_STEP,
];
```

## Resources

- [Zod Documentation](https://zod.dev/)
- [React Hook Form](https://react-hook-form.com/)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Lucide React Icons](https://lucide.dev/)
