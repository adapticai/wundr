# Entity Creation Hooks

This directory contains React hooks for creating entities in the Neolith platform.

## `useEntityCreation`

A type-safe hook for creating entities through the wizard API.

### Features

- **Type-safe**: Fully typed with TypeScript generics
- **Error handling**: Comprehensive error handling with user-friendly messages
- **Loading states**: Built-in loading state management
- **Success callbacks**: Optional success and error callbacks
- **Auto-redirect**: Automatic navigation after successful creation
- **Toast notifications**: Built-in success/error notifications

### Usage

```tsx
import { useEntityCreation } from '@/hooks/use-entity-creation';
import type { WorkspaceEntityData } from '@/hooks/use-entity-creation';

function CreateWorkspaceForm() {
  const { createEntity, isCreating, error, createdEntity, reset } = useEntityCreation({
    entityType: 'workspace',
    redirectPath: data => `/workspaces/${data.slug}`,
    onSuccess: workspace => {
      console.log('Created workspace:', workspace);
    },
  });

  const handleSubmit = async (formData: WorkspaceEntityData) => {
    try {
      const workspace = await createEntity(formData);
      console.log('Success:', workspace);
    } catch (err) {
      console.error('Failed:', err);
    }
  };

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        handleSubmit({
          name: 'My Workspace',
          description: 'A new workspace',
        });
      }}
    >
      <button type='submit' disabled={isCreating}>
        {isCreating ? 'Creating...' : 'Create Workspace'}
      </button>
      {error && <div className='error'>{error}</div>}
    </form>
  );
}
```

### Supported Entity Types

The hook supports the following entity types:

#### Workspace

```typescript
interface WorkspaceEntityData {
  name: string;
  description: string;
  organizationType?: string;
  teamSize?: 'small' | 'medium' | 'large';
  purpose?: string;
}
```

#### Orchestrator

```typescript
interface OrchestratorEntityData {
  workspaceId: string;
  name: string;
  role: string;
  description: string;
  capabilities?: string[];
  communicationStyle?: string;
}
```

#### Session Manager

```typescript
interface SessionManagerEntityData {
  name: string;
  responsibilities: string;
  parentOrchestrator?: string;
  context?: string;
  channels?: string[];
  escalationCriteria?: string[];
  workspaceSlug?: string;
  workspaceId?: string;
}
```

#### Workflow

```typescript
interface WorkflowEntityData {
  workspaceId: string;
  name: string;
  description: string;
  trigger: {
    type: 'schedule' | 'event' | 'manual' | 'webhook';
    config?: Record<string, unknown>;
  };
  actions: Array<{
    action: string;
    description: string;
  }>;
}
```

#### Channel

```typescript
interface ChannelEntityData {
  workspaceId: string;
  name: string;
  description?: string;
  type?: 'PUBLIC' | 'PRIVATE' | 'DM' | 'HUDDLE';
}
```

#### Subagent

```typescript
interface SubagentEntityData {
  name: string;
  description?: string;
  sessionManagerId?: string;
  capabilities?: string[];
  isGlobal?: boolean;
}
```

### Hook Options

```typescript
interface UseEntityCreationOptions<T extends EntityType> {
  entityType: T;
  workspaceSlug?: string;
  redirectPath?: string | ((data: CreatedEntityMap[T]) => string);
  onSuccess?: (data: CreatedEntityMap[T]) => void;
  onError?: (error: Error) => void;
}
```

- `entityType` - The type of entity to create
- `workspaceSlug` - Optional workspace slug to include in request
- `redirectPath` - Optional path to redirect to after creation (can be a function)
- `onSuccess` - Optional callback called on successful creation
- `onError` - Optional callback called on error

### Return Value

```typescript
interface UseEntityCreationReturn<T extends EntityType> {
  createEntity: (data: EntityDataMap[T]) => Promise<CreatedEntityMap[T]>;
  isCreating: boolean;
  error: string | null;
  createdEntity: CreatedEntityMap[T] | null;
  reset: () => void;
}
```

- `createEntity` - Function to create the entity
- `isCreating` - Boolean indicating if creation is in progress
- `error` - Error message if creation failed
- `createdEntity` - The created entity data (null if not created)
- `reset` - Function to reset the hook state

### API Integration

The hook communicates with the `/api/wizard/create` endpoint:

**Request:**

```typescript
{
  entityType: EntityType;
  data: EntityDataMap[EntityType];
}
```

**Success Response:**

```typescript
{
  data: CreatedEntityMap[EntityType];
  timestamp: string;
}
```

**Error Response:**

```typescript
{
  error: {
    message: string;
    details?: unknown;
  };
}
```

### Error Handling

The hook handles several types of errors:

1. **Network errors** - Failed API requests
2. **Validation errors** - Invalid input data
3. **Authentication errors** - Unauthorized requests
4. **Conflict errors** - Duplicate entities
5. **Not found errors** - Missing required resources

All errors are:

- Stored in the `error` state
- Displayed as toast notifications
- Passed to the optional `onError` callback
- Thrown from the `createEntity` function

### Type Safety

The hook uses TypeScript generics to ensure type safety:

```typescript
// TypeScript knows workspace data must have name and description
const { createEntity } = useEntityCreation({ entityType: 'workspace' });

// Type error: missing required fields
createEntity({}); // ❌

// Type safe: all required fields present
createEntity({
  name: 'My Workspace',
  description: 'Description',
}); // ✅

// Type safe: return type is CreatedWorkspace
const workspace = await createEntity({ ... });
console.log(workspace.slug); // ✅
console.log(workspace.role); // ❌ Type error: 'role' doesn't exist on CreatedWorkspace
```

### Testing

See `__tests__/use-entity-creation.test.ts` for type tests and examples.

## Related Files

- `/app/api/wizard/create/route.ts` - API endpoint implementation
- `/lib/ai/types.ts` - Entity type definitions
- `/components/wizard/` - Wizard components using this hook
