# ConversationalWizard Component

Reusable LLM-powered conversational interface for entity creation with chat-style UI and form editing capabilities.

## Features

- **Chat-style interface** with message bubbles (user and AI)
- **Text input with send button** and keyboard shortcuts
- **Loading state** while AI is responding
- **Structured data extraction** from conversation
- **Review Details button** that shows a form with extracted data
- **Edit Mode toggle** to switch between chat and form views
- **Auto-scrolling** messages
- **Accessibility support** with ARIA labels
- **Responsive design** using shadcn/ui components

## Components

### 1. ConversationalWizard (Main Component)

The primary component that orchestrates the entire wizard flow.

```tsx
import { ConversationalWizard } from '@/components/wizard';

<ConversationalWizard
  entityType="workspace"
  onComplete={(data) => console.log('Created:', data)}
  onCancel={() => console.log('Cancelled')}
  initialContext="Let's create an amazing workspace!"
  onSendMessage={async (message, history) => {
    // Your LLM API call here
    return {
      response: "AI response...",
      extractedData: { name: "...", description: "..." }
    };
  }}
/>
```

### 2. ChatMessage

Renders individual message bubbles in the conversation.

```tsx
<ChatMessage
  role="assistant"
  content="How can I help you today?"
  timestamp={new Date()}
  isStreaming={false}
/>
```

### 3. ChatInput

Input field with send button and action controls.

```tsx
<ChatInput
  onSend={(message) => handleSend(message)}
  disabled={isLoading}
  onCancel={() => handleCancel()}
  onReviewDetails={() => switchToForm()}
/>
```

### 4. EntityReviewForm

Editable form view of extracted entity data.

```tsx
<EntityReviewForm
  entityType="workflow"
  data={extractedData}
  onSubmit={(data) => createEntity(data)}
  onBackToChat={() => switchToChat()}
  onCancel={() => close()}
  onUpdate={(data) => syncData(data)}
/>
```

## Props Reference

### ConversationalWizardProps

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `entityType` | `EntityType` | Yes | Type of entity being created |
| `onComplete` | `(data: EntityData) => void` | Yes | Callback when entity creation is complete |
| `onCancel` | `() => void` | Yes | Callback when user cancels |
| `initialContext` | `string` | No | Optional starting prompt to seed the conversation |
| `onSendMessage` | `(message: string, history: Message[]) => Promise<{response: string, extractedData?: EntityData}>` | No | Custom LLM API handler |
| `initialData` | `EntityData` | No | Initial data for editing mode |

### EntityData

```typescript
interface EntityData {
  name: string;
  description: string;
  [key: string]: unknown;
}
```

### Message

```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}
```

## Usage Examples

### Basic Usage

```tsx
import { ConversationalWizard } from '@/components/wizard';
import type { EntityData } from '@/components/wizard';

function CreateWorkspaceDialog() {
  const [isOpen, setIsOpen] = useState(true);

  const handleComplete = (data: EntityData) => {
    console.log('Creating workspace with:', data);
    // Call your API to create the workspace
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-4xl">
        <ConversationalWizard
          entityType="workspace"
          onComplete={handleComplete}
          onCancel={() => setIsOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
```

### With Custom LLM Integration

```tsx
import { ConversationalWizard } from '@/components/wizard';
import type { Message, EntityData } from '@/components/wizard';

function CreateOrchestratorWizard() {
  const handleSendMessage = async (
    message: string,
    history: Message[]
  ): Promise<{ response: string; extractedData?: EntityData }> => {
    // Call your LLM API
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        history: history.map(m => ({ role: m.role, content: m.content })),
        entityType: 'orchestrator',
      }),
    });

    const data = await response.json();

    return {
      response: data.message,
      extractedData: data.extractedData,
    };
  };

  return (
    <ConversationalWizard
      entityType="orchestrator"
      onComplete={(data) => createOrchestrator(data)}
      onCancel={() => router.back()}
      onSendMessage={handleSendMessage}
      initialContext="I need an orchestrator for customer support."
    />
  );
}
```

### With Initial Data (Edit Mode)

```tsx
<ConversationalWizard
  entityType="workflow"
  initialData={{
    name: "Onboarding Workflow",
    description: "Automated user onboarding process",
    trigger: "user_join",
  }}
  onComplete={(data) => updateWorkflow(data)}
  onCancel={() => close()}
/>
```

## Keyboard Shortcuts

- **Enter**: Send message
- **Shift+Enter**: New line in message
- **Tab**: Switch between chat and form views (when form is available)

## Styling

All components use shadcn/ui components and respect your theme configuration. The wizard adapts to:

- Light/Dark mode
- Custom color schemes
- Responsive breakpoints

## API Integration

The wizard expects your `onSendMessage` handler to return:

```typescript
{
  response: string;        // AI's text response
  extractedData?: {        // Optional structured data
    name: string;
    description: string;
    // ... additional fields
  };
}
```

When `extractedData` is provided, the "Review Details" button becomes enabled, allowing users to switch to form view.

## Default Behavior

If no `onSendMessage` handler is provided, the wizard uses a mock implementation that:
1. Acknowledges the first message
2. After 2-3 messages, generates basic extracted data
3. Enables the form view

**Replace this with your actual LLM API integration in production.**

## Accessibility

- All interactive elements have proper ARIA labels
- Form fields have associated error messages
- Keyboard navigation is fully supported
- Screen reader friendly
- Focus management for better UX

## Best Practices

1. **Provide Clear Initial Context**: Set `initialContext` to guide users
2. **Extract Data Progressively**: Update `extractedData` as conversation progresses
3. **Validate Before Submission**: Use the form view for final validation
4. **Handle Errors Gracefully**: Show user-friendly error messages
5. **Save Conversation State**: Consider persisting messages for recovery

## File Structure

```
components/wizard/
├── conversational-wizard.tsx    # Main orchestrator component
├── chat-message.tsx             # Message bubble component
├── chat-input.tsx               # Input field with controls
├── entity-review-form.tsx       # Form view for editing data
├── index.ts                     # Public exports
└── README.md                    # This file
```

## TypeScript Support

All components are fully typed with TypeScript. Import types as needed:

```typescript
import type {
  ConversationalWizardProps,
  Message,
  EntityData,
  ChatMessageProps,
  ChatInputProps,
  EntityReviewFormProps,
} from '@/components/wizard';
```

## Future Enhancements

- Streaming responses for real-time AI output
- Message editing and regeneration
- Conversation branching
- Export/import conversation history
- Voice input support
- Multi-language support
