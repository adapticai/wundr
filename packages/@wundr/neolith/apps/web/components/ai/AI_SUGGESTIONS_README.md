# AI Suggestions Components

**Phase 10 - Agent 5: AI-Powered Suggestion Features**

A comprehensive suite of AI-powered suggestion components for the Neolith platform, providing
intelligent autocomplete, smart suggestions, quick actions, context menus, and inline editing
capabilities.

## Components Overview

### 1. Smart Suggestions (`smart-suggestions.tsx`)

Floating suggestion chips with category-based organization and keyboard navigation.

**Features:**

- Multiple variants (pills, chips, compact)
- Category-based grouping
- Confidence score display
- Keyboard navigation (Tab, Arrow keys, Enter, Escape)
- Dismissible suggestions
- Skeleton loading states
- Mobile-responsive

**Usage:**

```tsx
import { SmartSuggestions, GroupedSmartSuggestions } from '@/components/ai';

const suggestions = [
  { id: '1', text: 'Create workspace', category: 'quick-action', confidence: 0.95 },
  { id: '2', text: 'Import data', category: 'recommended', confidence: 0.88 },
];

<SmartSuggestions
  suggestions={suggestions}
  onSelect={(suggestion) => console.log(suggestion)}
  onDismiss={(id) => console.log('Dismissed:', id)}
  variant="pills"
  showCategories={true}
/>

<GroupedSmartSuggestions
  suggestions={suggestions}
  onSelect={(suggestion) => console.log(suggestion)}
/>
```

**Props:**

- `suggestions`: Array of suggestion objects
- `onSelect`: Callback when suggestion is selected
- `onDismiss?`: Optional callback for dismissing suggestions
- `isLoading?`: Show skeleton loading state
- `maxVisible?`: Maximum number of visible suggestions (default: 5)
- `showCategories?`: Show category icons (default: true)
- `variant?`: 'pills' | 'chips' | 'compact' (default: 'pills')
- `position?`: 'top' | 'bottom' | 'floating' (default: 'floating')

**Line Count:** 268 lines

---

### 2. Autocomplete Input (`autocomplete-input.tsx`)

Smart autocomplete with debounced API calls and keyboard navigation.

**Features:**

- Debounced API calls
- Grouped suggestions by category
- Confidence score display
- Keyboard navigation (Arrow keys, Enter, Tab, Escape)
- Loading indicator
- Inline ghost text autocomplete
- Accessibility (ARIA labels)

**Usage:**

```tsx
import { AutocompleteInput, InlineAutocomplete } from '@/components/ai';

const fetchSuggestions = async (query: string) => {
  const response = await fetch(`/api/suggestions?q=${query}`);
  return response.json();
};

// Dropdown autocomplete
<AutocompleteInput
  value={value}
  onChange={setValue}
  onSelect={(option) => console.log(option)}
  placeholder="Start typing..."
  fetchSuggestions={fetchSuggestions}
  debounceMs={300}
  minQueryLength={2}
  showConfidence={true}
/>

// Inline ghost text
<InlineAutocomplete
  value={value}
  onChange={setValue}
  placeholder="Type here..."
  fetchSuggestion={async (query) => query + ' suggestion'}
  debounceMs={500}
/>
```

**Props (AutocompleteInput):**

- `value`: Current input value
- `onChange`: Value change handler
- `onSelect?`: Optional select handler
- `fetchSuggestions`: Async function returning suggestions
- `debounceMs?`: Debounce delay (default: 300)
- `minQueryLength?`: Minimum query length (default: 2)
- `maxSuggestions?`: Maximum suggestions (default: 8)
- `showConfidence?`: Show confidence scores (default: true)

**Props (InlineAutocomplete):**

- `value`: Current input value
- `onChange`: Value change handler
- `fetchSuggestion`: Async function returning single suggestion
- `debounceMs?`: Debounce delay (default: 500)
- `minQueryLength?`: Minimum query length (default: 3)

**Line Count:** 350 lines

---

### 3. Quick Actions (`quick-actions.tsx`)

AI-powered action buttons with multiple variants and layouts.

**Features:**

- Multiple variants (default, floating, compact, toolbar)
- Category-based grouping
- Horizontal/vertical orientation
- Tooltips with descriptions
- Keyboard shortcuts display
- Loading states
- Premium/AI badges
- Floating Action Button (FAB) with expandable menu
- Contextual actions

**Usage:**

```tsx
import { QuickActions, CategorizedQuickActions, FloatingQuickActions } from '@/components/ai';

const actions = [
  {
    id: 'generate',
    label: 'Generate',
    icon: Wand2,
    category: 'AI Actions',
    isAI: true,
    shortcut: '⌘G',
    onClick: () => console.log('Generate'),
  },
];

// Default toolbar
<QuickActions
  actions={actions}
  variant="default"
  orientation="horizontal"
  showLabels={true}
  showTooltips={true}
/>

// Categorized view
<CategorizedQuickActions actions={actions} />

// Floating button
<FloatingQuickActions actions={actions} />
```

**Props:**

- `actions`: Array of action objects
- `variant?`: 'default' | 'floating' | 'compact' | 'toolbar'
- `orientation?`: 'horizontal' | 'vertical'
- `showLabels?`: Show button labels (default: true)
- `showTooltips?`: Show tooltips (default: true)
- `maxVisible?`: Maximum visible actions (default: 8)

**Line Count:** 337 lines

---

### 4. Context Menu AI (`context-menu-ai.tsx`)

Right-click context menu with AI-powered actions.

**Features:**

- Context-aware actions based on selection type
- Nested submenus
- AI action indicators
- Keyboard shortcuts
- Smart detection (text, code, links)
- Loading states
- Accessibility support

**Usage:**

```tsx
import { ContextMenuAI, SmartContextMenu } from '@/components/ai';

const actions = [
  {
    id: 'improve',
    label: 'Improve writing',
    icon: Sparkles,
    isAI: true,
    onClick: () => console.log('Improve'),
  },
  {
    id: 'translate',
    label: 'Translate',
    icon: Languages,
    isAI: true,
    submenu: [
      { id: 'es', label: 'Spanish', onClick: () => {} },
      { id: 'fr', label: 'French', onClick: () => {} },
    ],
  },
];

// Basic context menu
<ContextMenuAI
  actions={actions}
  selectedText="selected text"
  onAIAction={(actionId) => console.log(actionId)}
>
  <div>Right-click me</div>
</ContextMenuAI>

// Smart context menu (auto-detects selection type)
<SmartContextMenu onAction={(actionId) => console.log(actionId)}>
  <div>Right-click for smart actions</div>
</SmartContextMenu>
```

**Props:**

- `children`: Trigger element
- `actions`: Array of action objects
- `selectedText?`: Currently selected text
- `onAIAction?`: Callback for AI actions

**Default AI Actions:**

- Improve writing
- Fix grammar
- Translate (with language submenu)
- Summarize
- Expand on this
- Change tone (with tone submenu)

**Line Count:** 379 lines

---

### 5. Inline Edit (`inline-edit.tsx`)

Inline text editing with AI assistance and diff view.

**Features:**

- Click-to-edit interface
- AI transformation actions
- Undo/Redo history
- Character count
- Keyboard shortcuts (⌘Enter to save, Esc to cancel, ⌘Z/⌘⇧Z for undo/redo)
- Diff view for comparing changes
- Copy functionality
- Loading states

**Usage:**

```tsx
import { InlineEdit, InlineEditWithDiff } from '@/components/ai';

const handleAIEdit = async (instruction: string) => {
  const response = await fetch('/api/ai/transform', {
    method: 'POST',
    body: JSON.stringify({ text: value, instruction }),
  });
  return response.text();
};

// Inline editor
<InlineEdit
  value={text}
  onChange={setText}
  onAIEdit={handleAIEdit}
  showAIActions={true}
  aiInstructions={[
    'Make it shorter',
    'Make it longer',
    'Simplify',
    'Make it formal',
    'Fix grammar',
  ]}
  minHeight={100}
  maxHeight={400}
/>

// Diff view
<InlineEditWithDiff
  original="Original text"
  edited="Edited text"
  onAccept={() => console.log('Accepted')}
  onReject={() => console.log('Rejected')}
/>
```

**Props (InlineEdit):**

- `value`: Current text value
- `onChange`: Value change handler
- `onAIEdit?`: Async AI transformation function
- `onCancel?`: Cancel callback
- `placeholder?`: Placeholder text
- `autoFocus?`: Auto-focus on edit (default: true)
- `minHeight?`: Minimum height in pixels (default: 100)
- `maxHeight?`: Maximum height in pixels (default: 400)
- `showAIActions?`: Show AI action buttons (default: true)
- `aiInstructions?`: Array of AI instruction presets

**Props (InlineEditWithDiff):**

- `original`: Original text
- `edited`: Edited text
- `onAccept`: Accept changes callback
- `onReject`: Reject changes callback

**Line Count:** 371 lines

---

## Demo Component

A comprehensive demo showcasing all features: `ai-suggestions-demo.tsx` (461 lines)

```tsx
import { AISuggestionsDemo } from '@/components/ai/ai-suggestions-demo';

<AISuggestionsDemo />;
```

## Keyboard Navigation Reference

### Smart Suggestions

- **Tab / Arrow Right**: Next suggestion
- **Arrow Left**: Previous suggestion
- **Enter**: Select highlighted suggestion
- **Escape**: Clear selection

### Autocomplete

- **Arrow Down**: Next suggestion
- **Arrow Up**: Previous suggestion
- **Enter**: Select highlighted suggestion
- **Tab**: Accept first suggestion
- **Escape**: Close suggestions

### Inline Edit

- **⌘Enter**: Save changes
- **Escape**: Cancel editing
- **⌘Z**: Undo
- **⌘⇧Z**: Redo

## Accessibility Features

- **ARIA Labels**: All interactive elements have proper ARIA labels
- **Role Attributes**: Correct semantic roles (listbox, option, toolbar, etc.)
- **Keyboard Navigation**: Full keyboard support for all components
- **Focus Management**: Proper focus handling and visible focus indicators
- **Screen Reader Support**: Descriptive text for assistive technologies

## Styling & Theming

All components use:

- **Tailwind CSS** for styling
- **shadcn/ui** components as base
- **lucide-react** for icons
- **CSS variables** for theming
- **Dark mode** support

## Performance Optimizations

- **Debounced API calls** (configurable delays)
- **Request cancellation** (AbortController)
- **Memoized computations** (useMemo)
- **Optimized re-renders** (React.memo where applicable)
- **Skeleton loading** states
- **Lazy rendering** for large lists

## Dependencies

```json
{
  "@radix-ui/react-popover": "^1.1.15",
  "@radix-ui/react-context-menu": "^2.2.16",
  "cmdk": "^1.1.1",
  "lucide-react": "^0.554.0",
  "class-variance-authority": "^0.7.1",
  "tailwind-merge": "^2.2.0"
}
```

## File Structure

```
components/ai/
├── smart-suggestions.tsx      (268 lines)
├── autocomplete-input.tsx     (350 lines)
├── quick-actions.tsx          (337 lines)
├── context-menu-ai.tsx        (379 lines)
├── inline-edit.tsx            (371 lines)
├── ai-suggestions-demo.tsx    (461 lines)
├── index.ts                   (188 lines)
└── AI_SUGGESTIONS_README.md   (this file)
```

**Total Lines of Code:** 1,705 lines (excluding demo and docs)

## Integration Examples

### Complete Chat Interface

```tsx
import {
  ChatInput,
  SmartSuggestions,
  QuickActions,
  ContextMenuAI,
  InlineEdit,
} from '@/components/ai';

function ChatInterface() {
  return (
    <div>
      <SmartSuggestions suggestions={suggestions} onSelect={handleSuggestion} />

      <ContextMenuAI actions={contextActions}>
        <InlineEdit value={message} onChange={setMessage} onAIEdit={handleAITransform} />
      </ContextMenuAI>

      <QuickActions actions={quickActions} variant='toolbar' />

      <ChatInput onSubmit={handleSubmit} />
    </div>
  );
}
```

### Form with Autocomplete

```tsx
import { AutocompleteInput } from '@/components/ai';

function WorkspaceForm() {
  return (
    <form>
      <AutocompleteInput
        value={workspaceName}
        onChange={setWorkspaceName}
        fetchSuggestions={fetchWorkspaceNames}
        placeholder='Workspace name...'
      />
    </form>
  );
}
```

### Editor with AI Actions

```tsx
import { InlineEdit, FloatingQuickActions } from '@/components/ai';

function Editor() {
  return (
    <>
      <InlineEdit
        value={content}
        onChange={setContent}
        onAIEdit={transformContent}
        showAIActions={true}
      />

      <FloatingQuickActions actions={editorActions} />
    </>
  );
}
```

## Testing

All components include:

- TypeScript type safety
- Props validation
- Error boundaries support
- Console logging for debugging

## Future Enhancements

- [ ] Analytics tracking for AI action usage
- [ ] A/B testing for suggestion effectiveness
- [ ] Machine learning for personalized suggestions
- [ ] Voice input integration
- [ ] Multi-language support
- [ ] Custom theme presets
- [ ] Animation customization
- [ ] Plugin system for custom actions

## License

Part of the Wundr Neolith platform.

---

**Created by:** Phase 10 - Agent 5 (Frontend Engineer) **Date:** December 2025 **Version:** 1.0.0
