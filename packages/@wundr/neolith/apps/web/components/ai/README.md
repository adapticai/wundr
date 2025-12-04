# AI Components

This directory contains AI-specific UI components following Shadcn AI patterns.

## Components

### Response

A rich markdown renderer with streaming support and syntax-highlighted code blocks.

**Features:**

- Streaming-optimized markdown parsing with auto-completion
- Theme-aware syntax highlighting (light/dark mode)
- Copy-to-clipboard code blocks with visual feedback
- Auto-close incomplete formatting during streaming
- Rich markdown support (headers, lists, tables, blockquotes, links)
- Hide incomplete links until complete
- Line numbers in code blocks
- GitHub Flavored Markdown (GFM) support

**Basic Usage:**

```tsx
import { Response } from '@/components/ai/response';

function MyChat() {
  const [message, setMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(true);

  return <Response isStreaming={isStreaming}>{message}</Response>;
}
```

**With Code Blocks:**

```tsx
function CodeExample() {
  const markdown = `
# Hello World

Here's some TypeScript:

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

And a list:
- Item 1
- Item 2
- Item 3
`;

  return <Response>{markdown}</Response>;
}
```

**Streaming Mode:**

```tsx
function StreamingExample() {
  const [content, setContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(true);

  useEffect(() => {
    const stream = 'This is **streaming** text...';
    let index = 0;

    const interval = setInterval(() => {
      if (index < stream.length) {
        setContent(prev => prev + stream[index]);
        index++;
      } else {
        setIsStreaming(false);
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, []);

  return (
    <Response isStreaming={isStreaming} showCursor={true}>
      {content}
    </Response>
  );
}
```

**Props:**

| Prop          | Type      | Default | Description                           |
| ------------- | --------- | ------- | ------------------------------------- |
| `children`    | `string`  | -       | Markdown content to render            |
| `isStreaming` | `boolean` | `false` | Whether content is actively streaming |
| `showCursor`  | `boolean` | `true`  | Show animated cursor during streaming |
| `className`   | `string`  | -       | Additional CSS classes                |

**Supported Markdown:**

- **Headings**: `# H1`, `## H2`, `### H3`
- **Emphasis**: `**bold**`, `*italic*`
- **Code**: Inline `` `code` `` and fenced code blocks
- **Links**: `[text](url)` (auto-hides incomplete links during streaming)
- **Lists**: Ordered and unordered
- **Blockquotes**: `> quote`
- **Tables**: GitHub Flavored Markdown tables
- **Code Languages**: TypeScript, JavaScript, Python, Go, Rust, etc.

**Code Block Features:**

- Syntax highlighting with Prism.js
- Copy button (hover to reveal)
- Line numbers
- Language label
- Theme-aware (dark/light mode)
- Smooth transitions

**Auto-Completion During Streaming:**

The component automatically handles incomplete formatting:

- Unclosed `**bold**` → closes automatically
- Unclosed `*italic*` → closes automatically
- Unclosed `` `code` `` → closes automatically
- Incomplete `[link` → hides until complete

**Helper Components:**

```tsx
import { ResponseSection, ResponseCode, ResponseList } from '@/components/ai/response';

// Section with title
<ResponseSection title="Results">
  <p>Content here</p>
</ResponseSection>

// Simple code block (without syntax highlighting)
<ResponseCode language="typescript">
  const x = 42;
</ResponseCode>

// Simple list
<ResponseList items={['Item 1', 'Item 2', 'Item 3']} ordered={false} />
```

### Reasoning

A collapsible reasoning display component for AI thinking blocks with automatic streaming behavior.

**Features:**

- Auto-opens during streaming, auto-closes when complete
- Duration tracking ("Thought for X seconds")
- Smooth collapse/expand animations
- Brain icon with pulse animation during streaming
- Multiple export options (full component, composable parts, badge)

**Basic Usage:**

```tsx
import { Reasoning } from '@/components/ai/reasoning';

function MyComponent() {
  const [isStreaming, setIsStreaming] = useState(true);
  const [reasoningText, setReasoningText] = useState('');

  return <Reasoning content={reasoningText} isStreaming={isStreaming} />;
}
```

**Composable Parts:**

```tsx
import { ReasoningTrigger, ReasoningContent } from '@/components/ai/reasoning';
import { Collapsible } from '@/components/ui/collapsible';

function CustomReasoning() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <ReasoningTrigger isStreaming={false} duration={3} title='Custom Title' />
      <ReasoningContent>
        <div>Custom content here</div>
      </ReasoningContent>
    </Collapsible>
  );
}
```

**Inline Badge:**

```tsx
import { ReasoningBadge } from '@/components/ai/reasoning';

function MessageHeader() {
  return (
    <div className='flex items-center gap-2'>
      <span>AI Response</span>
      <ReasoningBadge isActive={true} duration={2} />
    </div>
  );
}
```

**Props:**

| Prop          | Type      | Default | Description                                           |
| ------------- | --------- | ------- | ----------------------------------------------------- |
| `content`     | `string`  | -       | The reasoning text to display                         |
| `isStreaming` | `boolean` | `false` | Whether the reasoning is actively streaming           |
| `duration`    | `number`  | -       | Duration in seconds (auto-calculated if not provided) |
| `defaultOpen` | `boolean` | `false` | Initial open state                                    |
| `className`   | `string`  | -       | Additional CSS classes                                |

**Behavior:**

- Auto-opens when `isStreaming` becomes `true`
- Timer starts and updates every second during streaming
- Auto-closes 1 second after streaming ends
- User can manually toggle open/closed state at any time

### PromptInput

A composable, accessible prompt input component with auto-resizing textarea.

**Features:**

- Auto-resizing textarea (configurable min/max height)
- Enter to submit, Shift+Enter for new lines
- Loading states with spinner
- Keyboard shortcuts and accessibility
- Composable subcomponents for customization
- Optional model selector dropdown
- Toolbar for custom actions

**Basic Usage:**

```tsx
import { PromptInput } from '@/components/ai/prompt-input';

function MyChat() {
  const [value, setValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!value.trim()) return;
    setIsLoading(true);
    // Send to API
    await sendMessage(value);
    setIsLoading(false);
    setValue('');
  };

  return (
    <PromptInput
      value={value}
      onChange={setValue}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      placeholder='Ask me anything...'
      minHeight={48}
      maxHeight={200}
    />
  );
}
```

**Advanced Usage (Composable):**

```tsx
import {
  PromptInputForm,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputSubmit,
  PromptInputModelSelect,
} from '@/components/ai/prompt-input';

function AdvancedChat() {
  const [value, setValue] = useState('');
  const [model, setModel] = useState('claude-sonnet-4');

  return (
    <PromptInputForm onSubmit={handleSubmit}>
      <PromptInputTextarea
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder='Type your message...'
      />
      <PromptInputToolbar>
        <PromptInputTools>
          <PromptInputModelSelect
            value={model}
            onValueChange={setModel}
            models={[
              { value: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
              { value: 'gpt-4o', label: 'GPT-4o' },
            ]}
          />
          <Button variant='ghost' size='sm'>
            <Paperclip className='h-4 w-4' />
          </Button>
        </PromptInputTools>
        <PromptInputSubmit>Send</PromptInputSubmit>
      </PromptInputToolbar>
    </PromptInputForm>
  );
}
```

**Subcomponents:**

- `PromptInputForm` - Form wrapper with styling
- `PromptInputTextarea` - Auto-resizing textarea
- `PromptInputToolbar` - Toolbar container
- `PromptInputTools` - Left-side tools container
- `PromptInputSubmit` - Submit button
- `PromptInputModelSelect` - Model selector dropdown

**Props:**

| Prop          | Type                      | Default                  | Description                  |
| ------------- | ------------------------- | ------------------------ | ---------------------------- |
| `value`       | `string`                  | -                        | Current input value          |
| `onChange`    | `(value: string) => void` | -                        | Value change handler         |
| `onSubmit`    | `() => void`              | -                        | Submit handler               |
| `isLoading`   | `boolean`                 | `false`                  | Loading state                |
| `placeholder` | `string`                  | `'Type your message...'` | Placeholder text             |
| `minHeight`   | `number`                  | `48`                     | Minimum textarea height (px) |
| `maxHeight`   | `number`                  | `200`                    | Maximum textarea height (px) |
| `disabled`    | `boolean`                 | `false`                  | Disabled state               |
| `className`   | `string`                  | -                        | Additional CSS classes       |

**Keyboard Shortcuts:**

- `Enter` - Submit message
- `Shift+Enter` - New line
- Auto-resize as you type

**Accessibility:**

- Proper ARIA labels on all interactive elements
- Screen reader announcements for loading states
- Keyboard navigation support
- Focus management

## Examples

See `prompt-input-example.tsx` for complete working examples:

1. **BasicPromptExample** - Simple usage with default settings
2. **AdvancedPromptExample** - Full-featured with model selector and tools
3. **MinimalPromptExample** - Minimal custom implementation

## Dependencies

- `@/components/ui/button` - Shadcn button component
- `@/components/ui/textarea` - Shadcn textarea component
- `@/components/ui/select` - Shadcn select component
- `lucide-react` - Icons (Send, Loader2)
- `@/lib/utils` - cn utility for class merging

## Design Principles

1. **Composability** - Build complex UIs from simple subcomponents
2. **Accessibility** - WCAG 2.1 compliant with proper ARIA labels
3. **Performance** - Efficient auto-resize with minimal re-renders
4. **Type Safety** - Full TypeScript support with proper types
5. **Flexibility** - Highly customizable through props and composition

## Future Enhancements

- [ ] File attachment support
- [ ] Voice input integration
- [ ] Message history navigation (Up/Down arrows)
- [ ] Markdown preview mode
- [ ] Command suggestions (/@mentions, /commands)
- [ ] Multi-line paste handling
- [ ] Character/token counter
- [ ] Auto-save drafts
