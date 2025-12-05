# Workflow Builder Action Configuration Enhancement

## Summary

Enhanced the Workflow Builder to provide detailed action configuration UI by integrating the
ActionConfigPanel component into the modal workflow builder.

## Problem

The audit found that action configuration UIs were simplified - showing only type selectors without
detailed configuration options. Users couldn't configure:

- send_message: channel selector, message template input
- api_request (http_request): URL, method, headers, body inputs
- delay (wait): duration input (minutes/hours/days)
- condition: field, operator, value inputs

## Solution

### 1. Import ActionConfigPanel Component

**File**: `/packages/@wundr/neolith/apps/web/app/(workspace)/[workspaceSlug]/workflows/page.tsx`

**Change**: Add import at top of file

```typescript
import { ActionConfigPanel } from '@/components/workflows/action-config';
```

### 2. Add Selected Action State

**Location**: `WorkflowBuilderModal` component

**Change**: Add state variable after existing state declarations

```typescript
const [selectedActionId, setSelectedActionId] = useState<string | null>(null);

// Compute selected action
const selectedAction = selectedActionId ? actions.find(a => a.id === selectedActionId) : null;
```

### 3. Update Modal Layout

**Change**: Modify the return statement to use flexbox layout for main content + sidebar

```typescript
return (
  <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
    <div className='flex max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-lg bg-background'>
      {/* Main Content */}
      <div className='flex-1 overflow-y-auto p-6'>
        {/* Existing header and form content */}
      </div>

      {/* Sidebar - Action Configuration Panel */}
      {selectedAction && (
        <div className='w-96 shrink-0 overflow-y-auto border-l bg-muted/30 p-4'>
          <ActionConfigPanel
            action={selectedAction}
            onChange={updates => updateAction(selectedActionId!, updates)}
            availableVariables={variables}
            onClose={() => setSelectedActionId(null)}
          />
        </div>
      )}
    </div>
  </div>
);
```

### 4. Update ActionList Component

**Interface Update**:

```typescript
interface ActionListProps {
  actions: ActionConfig[];
  selectedActionId: string | null; // ADD
  onSelect: (id: string) => void; // ADD
  onUpdate: (id: string, config: Partial<ActionConfig>) => void;
  onRemove: (id: string) => void;
}
```

**Component Update**: Replace the simple dropdown with clickable action cards

```typescript
function ActionList({
  actions,
  selectedActionId,  // ADD
  onSelect,           // ADD
  onUpdate,
  onRemove,
}: ActionListProps) {
  if (actions.length === 0) {
    return (
      <p className='text-sm text-muted-foreground'>
        No actions added yet. Add an action to define what happens when this
        workflow runs.
      </p>
    );
  }

  return (
    <div className='space-y-2'>
      {actions.map((action, index) => (
        <div
          key={action.id}
          className={cn(
            'group flex items-center gap-3 rounded-lg border p-3 transition-all hover:border-primary/50 cursor-pointer',
            selectedActionId === action.id
              ? 'border-primary bg-primary/5'
              : 'border-border',
          )}
        >
          <span className='flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary'>
            {index + 1}
          </span>
          <button
            type='button'
            onClick={() => onSelect(action.id)}
            className='flex min-w-0 flex-1 flex-col items-start text-left'
          >
            <div className='flex items-center gap-2'>
              <span className='font-medium text-foreground text-sm'>
                {ACTION_TYPE_CONFIG[action.type].label}
              </span>
              {selectedActionId === action.id && (
                <span className='rounded bg-primary px-1.5 py-0.5 text-xs text-primary-foreground'>
                  Editing
                </span>
              )}
            </div>
            <span className='mt-0.5 text-xs text-muted-foreground'>
              {ACTION_TYPE_CONFIG[action.type].description}
            </span>
            {/* Preview of configuration */}
            {'message' in action.config &&
              typeof action.config.message === 'string' &&
              action.config.message && (
                <span className='mt-1 truncate text-xs text-muted-foreground max-w-full'>
                  {action.config.message.substring(0, 60)}
                  {action.config.message.length > 60 && '...'}
                </span>
              )}
            {'url' in action.config &&
              typeof action.config.url === 'string' &&
              action.config.url && (
                <span className='mt-1 truncate text-xs text-muted-foreground max-w-full font-mono'>
                  {action.config.url}
                </span>
              )}
            {'duration' in action.config &&
              typeof action.config.duration === 'number' && (
                <span className='mt-1 text-xs text-muted-foreground'>
                  Wait {action.config.duration}{' '}
                  {'unit' in action.config ? action.config.unit : 'seconds'}
                </span>
              )}
          </button>
          <button
            type='button'
            onClick={e => {
              e.stopPropagation();
              onRemove(action.id);
            }}
            className='opacity-0 text-muted-foreground transition-opacity hover:text-red-600 group-hover:opacity-100'
            aria-label='Delete action'
          >
            <TrashIcon className='h-4 w-4' />
          </button>
        </div>
      ))}
    </div>
  );
}
```

### 5. Update ActionList Usage in Modal

**Change**: Pass new props to ActionList

```typescript
<ActionList
  actions={actions}
  selectedActionId={selectedActionId}      // ADD
  onSelect={setSelectedActionId}           // ADD
  onUpdate={updateAction}
  onRemove={id => {
    removeAction(id);
    if (selectedActionId === id) {
      setSelectedActionId(null);
    }
  }}
/>
```

## Features Provided

### Action Configuration UI

The ActionConfigPanel (already existing in the codebase) provides:

1. **send_message / send_dm**:
   - Channel ID or User ID input
   - Message textarea with markdown support
   - Variable interpolation hints

2. **http_request**:
   - Method selector (GET, POST, PUT, DELETE)
   - URL input
   - Headers (JSON editor)
   - Body textarea

3. **wait**:
   - Duration number input
   - Unit selector (seconds, minutes, hours, days)

4. **condition**:
   - Field input
   - Operator selector (equals, contains, greater_than, less_than, exists)
   - Value input

5. **create_channel**:
   - Channel name input
   - Channel type selector (public/private)

6. **invite_to_channel**:
   - Channel ID input
   - User ID input

7. **assign_role**:
   - Role ID input
   - User ID input

8. **add_reaction**:
   - Emoji input

9. **notify_orchestrator**:
   - Orchestrator ID input
   - Context message textarea

### Error Handling Configuration

All actions include:

- On Error strategy (stop, continue, retry)
- Retry count (if retry selected)
- Retry delay (if retry selected)

### Variable Support

- Variable inserter with copy-to-clipboard
- Available variables list based on trigger type
- Variable interpolation syntax {{variable.name}}

## User Experience

1. **Click to Configure**: Users click on an action card to select it
2. **Sidebar Opens**: Configuration panel slides in from the right
3. **Live Preview**: Action cards show preview of configured values
4. **Visual Feedback**: Selected action is highlighted with border and badge
5. **Easy Navigation**: Close sidebar button or select another action
6. **Validation**: Required fields are validated before save

## Implementation Status

All necessary components already exist:

- `/components/workflows/action-config.tsx` - Complete ActionConfigPanel
- `/types/workflow.ts` - DEFAULT_ACTION_CONFIGS with defaults for all types
- `/hooks/use-workflows.ts` - useWorkflowBuilder hook with validation

Only need to integrate the panel into the page.tsx workflow builder modal as outlined above.

## Files Modified

1. `/packages/@wundr/neolith/apps/web/app/(workspace)/[workspaceSlug]/workflows/page.tsx`
   - Added ActionConfigPanel import
   - Added selectedActionId state
   - Updated modal layout to flex with sidebar
   - Enhanced ActionList component with selection
   - Added ActionConfigPanel in sidebar

## Testing Checklist

- [ ] Action selection highlights the selected action
- [ ] Configuration panel opens in sidebar
- [ ] Each action type shows appropriate config fields
- [ ] Configuration changes are persisted
- [ ] Action preview shows configured values
- [ ] Delete button works without selecting
- [ ] Can switch between actions smoothly
- [ ] Sidebar close button works
- [ ] Error handling config is accessible
- [ ] Variables can be inserted
- [ ] Validation prevents invalid configs
- [ ] Save button creates workflow with correct config

## Benefits

1. **Complete Configuration**: Users can fully configure each action type
2. **Better UX**: Sidebar doesn't obscure the workflow structure
3. **Visual Feedback**: Clear indication of selected/configured actions
4. **Reusability**: Leverages existing ActionConfigPanel component
5. **Consistency**: Same UI as the full workflow-builder.tsx component
6. **Validation**: Built-in validation from ActionConfigPanel
7. **Variable Support**: Easy access to available variables
