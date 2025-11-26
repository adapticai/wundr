# Task & Backlog Database Schema - VP Autonomous Operation

## Implementation Summary

Successfully added Task/Backlog database schema to Prisma for VP autonomous operation. The implementation enables VPs to manage work items, track progress, and organize tasks within a backlog system.

## Database Schema Changes

### Files Modified

1. **Prisma Schema**: `/Users/iroselli/wundr/packages/@wundr/neolith/packages/@neolith/database/prisma/schema.prisma`
   - Added TaskPriority enum
   - Added TaskStatus enum
   - Added Task model
   - Added Backlog model
   - Added BacklogItem model
   - Updated VP, Workspace, Channel, and User models with relationships

2. **TypeScript Types**: `/Users/iroselli/wundr/packages/@wundr/neolith/packages/@neolith/database/src/index.ts`
   - Exported Task, Backlog, and BacklogItem model types
   - Exported TaskPriority and TaskStatus enums
   - Added Create input types for all three models
   - Added Update input types for all three models
   - Added Where and WhereUnique input types for filtering
   - Added OrderBy input types for sorting

## Schema Models

### TaskPriority Enum
```prisma
enum TaskPriority {
  CRITICAL  // Requires immediate attention
  HIGH      // High priority work
  MEDIUM    // Normal priority (default)
  LOW       // Low priority work
}
```

### TaskStatus Enum
```prisma
enum TaskStatus {
  TODO          // Not yet started
  IN_PROGRESS   // Currently being worked on
  BLOCKED       // Blocked by dependency or external factor
  DONE          // Completed successfully
  CANCELLED     // Cancelled/abandoned
}
```

### Task Model

**Purpose**: Individual work item assigned to a VP for autonomous operation

**Key Fields**:
- `id` (String, CUID): Unique identifier
- `title` (String): Task title/name
- `description` (String?): Detailed description
- `priority` (TaskPriority): Task priority level
- `status` (TaskStatus): Current task status
- `dueDate` (DateTime?): Due date for completion
- `estimatedHours` (Int?): Estimated effort in hours
- `tags` (String[]): Categorization tags
- `metadata` (Json): Flexible metadata storage
- `dependsOn` (String[]): Array of Task IDs this task depends on
- `createdAt`, `updatedAt`, `completedAt`: Timestamps

**Foreign Keys**:
- `vpId`: Associated Virtual Person
- `workspaceId`: Associated workspace
- `channelId` (optional): Associated communication channel
- `createdById`: User who created the task
- `assignedToId` (optional): User task is assigned to

**Relations**:
- vp: Many-to-One relationship with VP
- workspace: Many-to-One relationship with Workspace
- channel: Optional Many-to-One relationship with Channel
- creator: Many-to-One relationship with User (TaskCreator)
- assignedTo: Optional Many-to-One relationship with User (TaskAssignee)
- backlogItems: One-to-Many relationship with BacklogItem

**Indexes**:
- vpId, workspaceId, status, priority, createdById, assignedToId, channelId, dueDate, createdAt

### Backlog Model

**Purpose**: Collection/sprint of tasks organized for VP management

**Key Fields**:
- `id` (String, CUID): Unique identifier
- `name` (String): Backlog name
- `description` (String?): Description
- `status` (String): Status - "active", "archived", or "draft"
- `priority` (Int): Ordering priority (lower number = higher priority)
- `metadata` (Json): Flexible metadata
- `createdAt`, `updatedAt`: Timestamps

**Foreign Keys**:
- `vpId`: Associated Virtual Person
- `workspaceId`: Associated workspace

**Relations**:
- vp: Many-to-One relationship with VP
- workspace: Many-to-One relationship with Workspace
- items: One-to-Many relationship with BacklogItem

**Unique Constraint**: (vpId, name) - One backlog per VP per name

**Indexes**: vpId, workspaceId, status, priority

### BacklogItem Model

**Purpose**: Junction model connecting Backlog to Task with ordering

**Key Fields**:
- `id` (String, CUID): Unique identifier
- `position` (Int): Order within backlog (0 = first)
- `addedAt` (DateTime): When task was added to backlog

**Foreign Keys**:
- `backlogId`: Associated Backlog
- `taskId`: Associated Task

**Relations**:
- backlog: Many-to-One relationship with Backlog
- task: Many-to-One relationship with Task

**Unique Constraint**: (backlogId, taskId) - Task can only be in backlog once

**Indexes**: backlogId, taskId, position

## Related Model Updates

### VP Model
Added relationships:
- `tasks`: One-to-Many with Task
- `backlogs`: One-to-Many with Backlog

### Workspace Model
Added relationships:
- `tasks`: One-to-Many with Task
- `backlogs`: One-to-Many with Backlog

### Channel Model
Added relationship:
- `tasks`: One-to-Many with Task (optional association)

### User Model
Added relationships:
- `createdTasks`: One-to-Many with Task (TaskCreator)
- `assignedTasks`: One-to-Many with Task (TaskAssignee)

## Verification Results

✓ Database schema successfully created
✓ Prisma client generated and compiled
✓ All models accessible via Prisma Client
✓ TypeScript types exported correctly
✓ No type errors in build

**Model Counts** (Initial):
- Tasks: 0
- Backlogs: 0
- BacklogItems: 0

## TypeScript Type Exports

### Models
```typescript
export type Task = Prisma.Task;
export type Backlog = Prisma.Backlog;
export type BacklogItem = Prisma.BacklogItem;
```

### Enums
```typescript
export { TaskPriority, TaskStatus };
```

### Input Types
```typescript
// Create
export type CreateTaskInput = Prisma.TaskCreateInput;
export type CreateBacklogInput = Prisma.BacklogCreateInput;
export type CreateBacklogItemInput = Prisma.BacklogItemCreateInput;

// Update
export type UpdateTaskInput = Prisma.TaskUpdateInput;
export type UpdateBacklogInput = Prisma.BacklogUpdateInput;
export type UpdateBacklogItemInput = Prisma.BacklogItemUpdateInput;

// Where
export type TaskWhereInput = Prisma.TaskWhereInput;
export type TaskWhereUniqueInput = Prisma.TaskWhereUniqueInput;
export type BacklogWhereInput = Prisma.BacklogWhereInput;
export type BacklogWhereUniqueInput = Prisma.BacklogWhereUniqueInput;

// OrderBy
export type TaskOrderByInput = Prisma.TaskOrderByWithRelationInput;
export type BacklogOrderByInput = Prisma.BacklogOrderByWithRelationInput;
```

## Usage Examples

### Create a Task
```typescript
import { prisma, type CreateTaskInput } from '@neolith/database';

const task = await prisma.task.create({
  data: {
    title: 'Implement user authentication',
    description: 'Add OAuth2 integration',
    priority: 'HIGH',
    status: 'TODO',
    estimatedHours: 8,
    dueDate: new Date('2024-12-31'),
    tags: ['backend', 'security'],
    vpId: 'vp_123',
    workspaceId: 'ws_456',
    createdById: 'user_789',
  },
});
```

### Create a Backlog
```typescript
const backlog = await prisma.backlog.create({
  data: {
    name: 'Sprint 1',
    description: 'Initial MVP implementation',
    status: 'active',
    priority: 0,
    vpId: 'vp_123',
    workspaceId: 'ws_456',
  },
});
```

### Add Task to Backlog
```typescript
const backlogItem = await prisma.backlogItem.create({
  data: {
    position: 0,
    backlogId: 'backlog_123',
    taskId: 'task_456',
  },
});
```

### Query Tasks with Relations
```typescript
const tasks = await prisma.task.findMany({
  where: {
    vpId: 'vp_123',
    status: { in: ['TODO', 'IN_PROGRESS'] },
  },
  include: {
    vp: true,
    creator: true,
    assignedTo: true,
  },
  orderBy: { priority: 'asc' },
});
```

### Update Task Status
```typescript
const updated = await prisma.task.update({
  where: { id: 'task_123' },
  data: {
    status: 'DONE',
    completedAt: new Date(),
  },
});
```

## Database Tables Created

1. **tasks** - Stores individual work items
2. **backlogs** - Stores backlog collections
3. **backlog_items** - Junction table for backlog-task relationships

## Performance Optimizations

- Multiple indexes on frequently queried fields (vpId, status, priority, createdAt, etc.)
- Unique constraint on (vpId, name) for Backlog prevents duplicates
- Cascade delete relationships maintain referential integrity
- JSON fields for flexible metadata without schema changes

## Deployment Checklist

- [x] Schema models defined
- [x] Enums created (TaskPriority, TaskStatus)
- [x] Database schema synced (db push)
- [x] Prisma client generated
- [x] TypeScript types exported
- [x] Build successful (tsc)
- [x] Models verified and accessible
- [x] Type checking complete (no errors)

## File Locations

**Schema Definition**:
- `/Users/iroselli/wundr/packages/@wundr/neolith/packages/@neolith/database/prisma/schema.prisma`

**Type Exports**:
- `/Users/iroselli/wundr/packages/@wundr/neolith/packages/@neolith/database/src/index.ts`

**Environment Configuration**:
- `/Users/iroselli/wundr/packages/@wundr/neolith/packages/@neolith/database/.env`

## Next Steps

1. **API Endpoints**: Create REST/GraphQL endpoints for Task and Backlog management
2. **Service Layer**: Implement business logic for task operations
3. **VP Integration**: Connect to VP daemon for autonomous task execution
4. **WebSocket Updates**: Real-time task status updates
5. **Notifications**: Alert users of task changes
6. **Analytics**: Track task completion metrics
7. **Migrations**: Create proper database migrations for deployment

## Related Documentation

- Prisma Schema: 9 models, 14 enums, comprehensive relations
- Database: PostgreSQL
- Package: @neolith/database v0.1.0
