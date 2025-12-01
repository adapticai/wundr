# DualModeEditor Component

A sophisticated React component that seamlessly integrates conversational AI and direct form editing
for entity creation and editing workflows.

## Overview

The `DualModeEditor` component provides a dual-interface approach to data entry:

- **Chat Mode**: Natural language conversation with AI to define entity properties
- **Edit Mode**: Traditional form-based editing with AI assistance for individual fields

## Features

### Core Features

- Toggle between Chat and Edit modes with state preservation
- Full integration with `ConversationalWizard` in chat mode
- Direct form editing with dynamic field rendering
- Bidirectional sync between conversation and form data
- Auto-save drafts to localStorage
- Smooth transitions between modes

### AI Assistance

- **Ask AI**: Get AI-generated suggestions for any field
- **Explain Field**: Request clarification about a field's purpose
- **Suggest Improvements**: AI review of all current values
- **Apply Suggestions**: One-click application of AI recommendations

### User Experience

- Responsive layout optimized for different screen sizes
- Real-time validation with error feedback
- Visual indicators for AI suggestions and loading states
- Timestamp display for auto-saved drafts
- Accessible with ARIA labels and keyboard navigation

## Installation

The component is part of the wizard component suite:

```tsx
import { DualModeEditor } from '@/components/wizard';
```

## Basic Usage

### Simple Example

```tsx
import { DualModeEditor } from '@/components/wizard';

function MyComponent() {
  const handleSave = data => {
    console.log('Saving:', data);
    // API call to save data
  };

  return <DualModeEditor entityType='Workspace' onSave={handleSave} />;
}
```

### With Custom Fields

```tsx
const fieldConfigs = [
  {
    key: 'name',
    label: 'Name',
    type: 'text',
    placeholder: 'Enter name',
    required: true,
    helpText: 'A unique identifier',
  },
  {
    key: 'description',
    label: 'Description',
    type: 'textarea',
    placeholder: 'Describe the purpose',
    required: true,
  },
  {
    key: 'email',
    label: 'Contact Email',
    type: 'email',
    placeholder: 'email@example.com',
    required: false,
  },
];

<DualModeEditor entityType='Project' fieldConfigs={fieldConfigs} onSave={handleSave} />;
```

### With AI Assistance

```tsx
const handleAskAI = async (field, currentValue, context) => {
  // Call your LLM API
  const response = await fetch('/api/ai/suggest', {
    method: 'POST',
    body: JSON.stringify({ field, currentValue, context }),
  });

  const data = await response.json();
  return data.suggestion;
};

<DualModeEditor entityType='Agent' onSave={handleSave} onAskAI={handleAskAI} />;
```

### With Custom Conversation Handler

```tsx
const handleSendMessage = async (message, history) => {
  const response = await fetch('/api/llm/chat', {
    method: 'POST',
    body: JSON.stringify({ message, history }),
  });

  const data = await response.json();
  return {
    response: data.message,
    extractedData: data.extractedFields,
  };
};

<DualModeEditor entityType='Workflow' onSave={handleSave} onSendMessage={handleSendMessage} />;
```

## Props

### DualModeEditorProps

| Prop            | Type                               | Default                    | Description                         |
| --------------- | ---------------------------------- | -------------------------- | ----------------------------------- |
| `entityType`    | `string`                           | **required**               | Type of entity being created/edited |
| `onSave`        | `(data: EntityData) => void`       | **required**               | Callback when data is saved         |
| `initialData`   | `Partial<EntityData>`              | `{}`                       | Initial data for editing mode       |
| `mode`          | `'chat' \| 'edit'`                 | `'chat'`                   | Initial mode                        |
| `onModeChange`  | `(mode: 'chat' \| 'edit') => void` | -                          | Callback when mode changes          |
| `fieldConfigs`  | `FieldConfig[]`                    | Auto-generated             | Field configurations for edit mode  |
| `onSendMessage` | `Function`                         | Default handler            | Custom LLM conversation handler     |
| `onAskAI`       | `Function`                         | -                          | Custom AI assistance handler        |
| `autoSave`      | `boolean`                          | `true`                     | Enable auto-save to localStorage    |
| `storageKey`    | `string`                           | `'dual-mode-editor-draft'` | LocalStorage key prefix             |

### FieldConfig

| Property      | Type                                                   | Required | Description                           |
| ------------- | ------------------------------------------------------ | -------- | ------------------------------------- |
| `key`         | `string`                                               | Yes      | Field identifier (data property name) |
| `label`       | `string`                                               | Yes      | Display label for the field           |
| `type`        | `'text' \| 'textarea' \| 'email' \| 'number' \| 'url'` | Yes      | Input type                            |
| `placeholder` | `string`                                               | No       | Placeholder text                      |
| `required`    | `boolean`                                              | No       | Whether field is required             |
| `helpText`    | `string`                                               | No       | Help text displayed below field       |

### EntityData

```typescript
interface EntityData {
  name: string;
  description: string;
  [key: string]: unknown;
}
```

## State Management

### Auto-Save

The component automatically saves drafts to localStorage:

```typescript
// Saved structure
{
  data: EntityData,
  conversationHistory: Message[],
  timestamp: string
}
```

Storage key format: `${storageKey}-${entityType}`

### State Preservation

When switching modes:

- Form data is preserved
- Conversation history is maintained
- AI suggestions remain available
- Validation errors persist

## AI Integration

### AI Handler Signatures

#### onAskAI

```typescript
type OnAskAI = (
  field: string, // Field name or special key
  currentValue: string, // Current field value
  context: EntityData // Full entity context
) => Promise<string>; // AI suggestion
```

Special field keys:

- `explain-{fieldName}`: Request field explanation
- `improvements`: Request overall improvements

#### onSendMessage

```typescript
type OnSendMessage = (
  message: string,
  history: Message[]
) => Promise<{
  response: string;
  extractedData?: EntityData;
}>;
```

### Example AI Integration

```typescript
const handleAskAI = async (field, currentValue, context) => {
  // Field explanation
  if (field.startsWith('explain-')) {
    const fieldName = field.replace('explain-', '');
    return `The ${fieldName} field is used for...`;
  }

  // Field suggestion
  if (field === 'name') {
    return `Suggested name based on: ${context.description}`;
  }

  // Overall improvements
  if (field === 'improvements') {
    return `Consider: 1) More specific details, 2) Clear objectives...`;
  }

  return 'AI-generated suggestion';
};
```

## Styling

The component uses Tailwind CSS and shadcn/ui components:

- Responsive height: `h-[80vh]`
- Auto-scrolling content areas
- Smooth transitions between modes
- Consistent spacing and typography
- Accessible color contrast

### Customization

Override styles using className props or Tailwind classes:

```tsx
<DualModeEditor
  className='h-screen'
  // Component will merge with default classes
/>
```

## Accessibility

- ARIA labels for all interactive elements
- Keyboard navigation support
- Screen reader friendly
- Error states announced
- Focus management on mode switch

## Performance

- Lazy loading of conversation history
- Debounced auto-save (via useEffect)
- Efficient re-renders with React.memo potential
- LocalStorage cleanup on save

## Best Practices

### 1. Provide Clear Field Configurations

```typescript
const fieldConfigs: FieldConfig[] = [
  {
    key: 'name',
    label: 'Project Name',
    type: 'text',
    required: true,
    helpText: 'Choose a memorable name',
  },
  // ... more fields
];
```

### 2. Implement Robust AI Handlers

```typescript
const handleAskAI = async (field, value, context) => {
  try {
    const response = await aiService.suggest(field, value, context);
    return response.suggestion;
  } catch (error) {
    console.error('AI request failed:', error);
    return 'Unable to generate suggestion at this time.';
  }
};
```

### 3. Handle Save Errors

```typescript
const handleSave = async data => {
  try {
    await api.createEntity(data);
    toast.success('Entity created successfully');
  } catch (error) {
    toast.error('Failed to create entity');
    console.error(error);
  }
};
```

### 4. Clean Up LocalStorage

```typescript
// Clear old drafts periodically
useEffect(() => {
  const cleanup = () => {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('dual-mode-editor-draft-')) {
        const data = JSON.parse(localStorage.getItem(key));
        const age = Date.now() - new Date(data.timestamp).getTime();
        if (age > 7 * 24 * 60 * 60 * 1000) {
          // 7 days
          localStorage.removeItem(key);
        }
      }
    });
  };

  cleanup();
}, []);
```

## Troubleshooting

### Conversation not persisting between modes

Ensure you're not reinitializing the component. Use state management or component keys:

```tsx
<DualModeEditor key={entityId} />
```

### AI suggestions not working

Check your `onAskAI` implementation:

- Returns a Promise<string>
- Handles all field types including special keys
- Proper error handling

### Auto-save not working

Verify:

- `autoSave={true}` is set
- LocalStorage is available
- No errors in console
- Browser storage quota not exceeded

## Examples

See `dual-mode-editor-example.tsx` for complete working examples:

- Basic workspace creator
- Agent creator with custom fields
- Custom AI integration
- Form validation
- Error handling

## Related Components

- `ConversationalWizard`: Chat-based entity creation
- `EntityReviewForm`: Form-based entity review
- `ChatInput`: Message input component
- `ChatMessage`: Message display component

## API Reference

For detailed type definitions, see:

- `/components/wizard/dual-mode-editor.tsx`
- `/components/wizard/conversational-wizard.tsx`

## License

Part of the Neolith web application.
