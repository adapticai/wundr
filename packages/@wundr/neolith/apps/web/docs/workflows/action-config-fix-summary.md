# Workflow Action Configuration Fix - Summary

## Problem Identified

The 20-agent audit found that workflow action configurations were returning **empty config objects** (`{}`), causing action configuration selectors to have no initial values or defaults.

### Root Causes

1. **No default configurations**: When creating new actions or changing action types, the config was set to an empty object `{}`
2. **Missing initialization**: Three locations were creating actions with empty configs:
   - `workflow-builder.tsx` - When adding a new action
   - `action-config.tsx` - When changing the action type
   - `workflows/page.tsx` - In the quick action type selector

## Solution Implemented

### 1. Default Action Configuration Constants

**File**: `/types/workflow.ts`

Added `DEFAULT_ACTION_CONFIGS` constant that defines sensible defaults for each action type:

```typescript
export const DEFAULT_ACTION_CONFIGS: Record<ActionType, Partial<ActionConfig['config']>> = {
  send_message: {
    channelId: '',
    message: 'Hello! This is an automated message.',
  },
  send_dm: {
    userId: '',
    message: 'Hello! This is a direct message.',
  },
  create_channel: {
    channelName: 'new-channel',
    channelType: 'public',
  },
  invite_to_channel: {
    channelId: '',
    userId: '',
  },
  assign_role: {
    roleId: '',
    userId: '',
  },
  add_reaction: {
    emoji: '👍',
  },
  http_request: {
    url: 'https://api.example.com/webhook',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: '{"data": "{{trigger.message.content}}"}',
  },
  wait: {
    duration: 5,
    unit: 'minutes',
  },
  condition: {
    condition: {
      field: 'trigger.message.content',
      operator: 'contains',
      value: '',
    },
  },
  notify_vp: {
    vpId: '',
    message: 'Action required for: {{trigger.message.content}}',
  },
};
```

### 2. Updated Components to Use Defaults

#### `action-config.tsx`
- **Change**: Import and use `DEFAULT_ACTION_CONFIGS`
- **Impact**: When user changes action type, the config is populated with appropriate defaults
- **Code**:
  ```typescript
  const handleTypeChange = (type: ActionType) => {
    const defaultConfig = DEFAULT_ACTION_CONFIGS[type] || {};
    onChange({ type, config: defaultConfig });
  };
  ```

#### `workflow-builder.tsx`
- **Change**: Import and use `DEFAULT_ACTION_CONFIGS` when adding new actions
- **Impact**: New actions start with proper default values
- **Code**:
  ```typescript
  const handleAddAction = useCallback(() => {
    const defaultType = 'send_message';
    addAction({
      type: defaultType,
      config: DEFAULT_ACTION_CONFIGS[defaultType],
    });
  }, [addAction]);
  ```

#### `workflows/page.tsx`
- **Change**: Import and use `DEFAULT_ACTION_CONFIGS` in action type selector
- **Impact**: Quick workflow builder properly initializes configs
- **Code**:
  ```typescript
  onChange={(e) => {
    const newType = e.target.value as ActionConfig['type'];
    onUpdate(action.id, {
      type: newType,
      config: DEFAULT_ACTION_CONFIGS[newType] || {},
    });
  }}
  ```

### 3. Helper Utilities

**File**: `/lib/workflows/action-configs.ts`

Created comprehensive utility module with:

#### `getDefaultActionConfig(actionType)`
Returns default configuration for any action type

#### `ACTION_CONFIG_SCHEMA`
Complete schema documentation for all action types including:
- Field descriptions
- Required fields
- Field types
- Example values
- Default values

#### `validateActionConfig(actionType, config)`
Validates that an action config has all required fields

#### `getActionDescription(action)`
Generates human-readable descriptions of actions

## Action Configuration Schema

### send_message
**Required**: `channelId`, `message`
- `channelId` (string): Channel ID to send to
- `message` (string): Message content with Markdown and variable support

### send_dm
**Required**: `userId`, `message`
- `userId` (string): User ID to send DM to
- `message` (string): DM content with Markdown and variable support

### create_channel
**Required**: `channelName`
- `channelName` (string): Name of the new channel
- `channelType` (enum): 'public' or 'private' (default: 'public')

### invite_to_channel
**Required**: `channelId`, `userId`
- `channelId` (string): Target channel ID
- `userId` (string): User ID to invite

### assign_role
**Required**: `roleId`, `userId`
- `roleId` (string): Role ID to assign
- `userId` (string): User ID to receive role

### add_reaction
**Required**: `emoji`
- `emoji` (string): Emoji (Unicode or :shortcode:)

### http_request
**Required**: `url`, `method`
- `url` (string): Request URL
- `method` (enum): 'GET', 'POST', 'PUT', or 'DELETE'
- `headers` (object): HTTP headers
- `body` (string): Request body with variable support

### wait
**Required**: `duration`, `unit`
- `duration` (number): How long to wait
- `unit` (enum): 'seconds', 'minutes', 'hours', or 'days'

### condition
**Required**: `condition`
- `condition.field` (string): Field to evaluate
- `condition.operator` (enum): 'equals', 'contains', 'greater_than', 'less_than', 'exists'
- `condition.value` (string): Comparison value
- `thenActions` (array): Action IDs if true
- `elseActions` (array): Action IDs if false

### notify_vp
**Required**: `vpId`
- `vpId` (string): Orchestrator agent ID
- `message` (string): Context message with variable support

## Files Modified

1. `/types/workflow.ts` - Added DEFAULT_ACTION_CONFIGS constant
2. `/components/workflows/action-config.tsx` - Use defaults when changing types
3. `/components/workflows/workflow-builder.tsx` - Use defaults when adding actions
4. `/app/(workspace)/[workspaceId]/workflows/page.tsx` - Use defaults in quick builder

## Files Created

1. `/lib/workflows/action-configs.ts` - Helper utilities and schema documentation
2. `/docs/workflows/action-config-fix-summary.md` - This documentation

## Testing Verification

### Manual Testing Steps

1. **Create New Workflow**
   - Navigate to Workflows page
   - Click "Create Workflow"
   - Add an action
   - ✅ Verify action config panel shows default values

2. **Change Action Type**
   - Create/edit a workflow with actions
   - Select an action
   - Change its type in the dropdown
   - ✅ Verify config updates with appropriate defaults

3. **All Action Types**
   - Test each action type:
     - send_message: Should have default message
     - send_dm: Should have default DM message
     - create_channel: Should have "new-channel" name
     - http_request: Should have example URL and headers
     - wait: Should have 5 minutes duration
     - condition: Should have example condition
     - etc.

### Build Verification

```bash
npm run build
```

Expected: Clean build with no TypeScript errors

### Type Safety

All changes maintain full TypeScript type safety:
- `DEFAULT_ACTION_CONFIGS` is properly typed as `Record<ActionType, Partial<ActionConfig['config']>>`
- Helper functions have explicit type signatures
- No `any` types used

## Impact

### Before Fix
- New actions created with `config: {}`
- Action type changes reset to `config: {}`
- No guidance for users on expected fields
- Empty forms in configuration panel

### After Fix
- New actions have sensible defaults
- Type changes populate appropriate defaults
- Clear schema documentation
- Pre-filled forms guide users
- Validation helpers available

## Future Enhancements

1. **Dynamic Field Validation**: Use `validateActionConfig()` in UI to show real-time errors
2. **Auto-save Drafts**: Save configs as user types
3. **Template Variables**: Add variable picker inline with fields
4. **Config Migration**: Handle config updates when action types change
5. **Visual Config Builder**: Drag-and-drop interface for complex configs

## Related Issues

- Template action types use different naming (`message.send` vs `send_message`) - separate fix needed
- Error handling configs could also benefit from defaults
- Trigger configs may need similar default system
