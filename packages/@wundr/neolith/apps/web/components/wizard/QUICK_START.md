# ConversationalWizard - Quick Start Guide

## 30-Second Setup

```tsx
import { ConversationalWizard } from '@/components/wizard';

function CreateDialog() {
  return (
    <ConversationalWizard
      entityType="workspace"
      onComplete={(data) => console.log('Created:', data)}
      onCancel={() => console.log('Cancelled')}
    />
  );
}
```

## 2-Minute Integration

### Step 1: Import
```tsx
import { ConversationalWizard } from '@/components/wizard';
import type { EntityData } from '@/components/wizard';
```

### Step 2: Add to Your Component
```tsx
export function CreateEntityDialog() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>Create New</Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <ConversationalWizard
          entityType="orchestrator"
          onComplete={(data) => {
            // Your API call here
            createEntity(data);
            setIsOpen(false);
          }}
          onCancel={() => setIsOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
```

### Step 3: Connect to Your API (Optional)
```tsx
const handleMessage = async (message, history) => {
  const res = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message, history }),
  });
  const data = await res.json();
  return {
    response: data.message,
    extractedData: data.extractedData,
  };
};

<ConversationalWizard
  entityType="workflow"
  onSendMessage={handleMessage}
  onComplete={handleComplete}
  onCancel={handleCancel}
/>
```

## Props Cheat Sheet

| Prop | Type | Required | Use Case |
|------|------|----------|----------|
| `entityType` | `'workspace' \| 'orchestrator' \| ...` | Yes | What you're creating |
| `onComplete` | `(data) => void` | Yes | Handle the final data |
| `onCancel` | `() => void` | Yes | Close/cancel action |
| `onSendMessage` | `async (msg, history) => {...}` | No | Custom LLM API |
| `initialContext` | `string` | No | Starting message |
| `initialData` | `EntityData` | No | Edit existing entity |

## Component Files

```
wizard/
├── conversational-wizard.tsx    ← Main component (USE THIS)
├── chat-message.tsx             ← Message bubbles (auto-imported)
├── chat-input.tsx               ← Input field (auto-imported)
├── entity-review-form.tsx       ← Form view (auto-imported)
├── index.ts                     ← Exports
├── example-usage.tsx            ← 7 complete examples
├── README.md                    ← Full documentation
├── QUICK_START.md              ← This file
└── IMPLEMENTATION_SUMMARY.md    ← Technical details
```

## Entity Types Supported

```typescript
'workspace'         // New workspace creation
'orchestrator'      // AI agent orchestrator
'session-manager'   // Session management agent
'subagent'         // Task-specific subagent
'workflow'         // Automated workflow
'channel'          // Communication channel
```

## Default Behavior

Without `onSendMessage`, the wizard uses a mock LLM that:
1. Acknowledges first message
2. After 2-3 exchanges, enables "Review Details"
3. Allows form editing

**Replace with real LLM in production!**

## Common Patterns

### Pattern 1: Create in Modal
```tsx
<Dialog>
  <DialogContent className="max-w-4xl">
    <ConversationalWizard {...props} />
  </DialogContent>
</Dialog>
```

### Pattern 2: Standalone Page
```tsx
<div className="container max-w-4xl py-8">
  <ConversationalWizard {...props} />
</div>
```

### Pattern 3: With Loading State
```tsx
const [isSubmitting, setIsSubmitting] = useState(false);

<ConversationalWizard
  onComplete={async (data) => {
    setIsSubmitting(true);
    await createEntity(data);
    setIsSubmitting(false);
  }}
/>
```

## User Flow

1. User sees AI greeting message
2. User types response, hits Enter (or clicks Send)
3. AI responds with follow-up questions
4. After sufficient info, "Review Details" button appears
5. User clicks to see extracted data in form
6. User edits fields if needed
7. User clicks "Create" button
8. Your `onComplete` handler is called with data

## Keyboard Shortcuts

- **Enter** - Send message
- **Shift+Enter** - New line
- **Tab** - Navigate form fields

## Styling

Uses your theme automatically:
- Light/dark mode
- Primary colors
- Font family
- Border radius
- Shadows

## Troubleshooting

### "Review Details" button not appearing
- Make sure `onSendMessage` returns `extractedData`
- Or wait 2-3 messages with default mock handler

### Form fields not showing
- Check `entityType` is valid
- Verify `extractedData` has `name` and `description`

### TypeScript errors
- Import types: `import type { EntityData } from '@/components/wizard'`
- Ensure `onComplete` accepts `EntityData` parameter

## Next Steps

- See `example-usage.tsx` for 7 complete examples
- Read `README.md` for full documentation
- Check `IMPLEMENTATION_SUMMARY.md` for architecture details

## Support

File Location: `/components/wizard/`
Import: `import { ConversationalWizard } from '@/components/wizard'`

---

**That's it! You're ready to create conversational wizards.**
