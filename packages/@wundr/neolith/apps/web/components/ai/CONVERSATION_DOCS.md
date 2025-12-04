# Conversation Component Documentation

## Overview

The `Conversation` component is the main container for AI conversation interfaces following Shadcn
AI patterns. It provides intelligent auto-scrolling, scroll position management, and keyboard
navigation.

## Features

- **Auto-scroll to bottom** when new messages arrive
- **Smart scroll detection** - maintains position when user scrolls up
- **Scroll-to-bottom button** appears when not at bottom
- **Smooth animations** for scroll behavior
- **Keyboard shortcuts** (End key scrolls to bottom)
- **Accessibility support** with proper ARIA attributes
- **Resize handling** without scroll jumps
- **Composable subcomponents** for customization

## Installation

The component uses `react-scroll-to-bottom` for reliable scroll behavior:

```bash
pnpm add react-scroll-to-bottom --filter @neolith/web
```

## Basic Usage

```tsx
import { Conversation } from '@/components/ai/conversation';

export function ChatInterface() {
  return (
    <Conversation initial='smooth'>
      <Message>Hello!</Message>
      <Message>How can I help you?</Message>
    </Conversation>
  );
}
```

## Props

| Prop               | Type                              | Default    | Description                                  |
| ------------------ | --------------------------------- | ---------- | -------------------------------------------- |
| `initial`          | `'smooth' \| 'instant' \| 'auto'` | `'smooth'` | Scroll behavior on mount                     |
| `resize`           | `'smooth' \| 'instant' \| 'auto'` | `'smooth'` | Scroll behavior on resize                    |
| `showScrollButton` | `boolean`                         | `true`     | Show scroll-to-bottom button                 |
| `scrollThreshold`  | `number`                          | `50`       | Distance from bottom to consider "at bottom" |
| `autoscroll`       | `boolean`                         | `true`     | Deprecated: use `initial` instead            |
| `className`        | `string`                          | -          | Additional CSS classes                       |

## Advanced Usage

### With Custom Input

```tsx
import { Conversation, useConversation } from '@/components/ai/conversation';

function ChatInput() {
  const { scrollToBottom } = useConversation();
  const [input, setInput] = useState('');

  const handleSend = () => {
    sendMessage(input);
    setTimeout(scrollToBottom, 100); // Scroll after message added
  };

  return (
    <div className='p-4 border-t'>
      <input value={input} onChange={e => setInput(e.target.value)} />
      <button onClick={handleSend}>Send</button>
    </div>
  );
}

export function Chat() {
  return (
    <div className='flex flex-col h-screen'>
      <Conversation className='flex-1'>
        {messages.map(msg => (
          <Message key={msg.id}>{msg.text}</Message>
        ))}
      </Conversation>
      <ChatInput />
    </div>
  );
}
```

### Without Scroll Button

```tsx
<Conversation showScrollButton={false}>{messages}</Conversation>
```

### Instant Scrolling

```tsx
<Conversation initial='instant' resize='instant'>
  {messages}
</Conversation>
```

### Using the Hook

The `useConversation` hook provides access to scroll functionality from child components:

```tsx
function MessageActions() {
  const { scrollToBottom, isAtBottom } = useConversation();

  return (
    <div>
      <button onClick={scrollToBottom}>Jump to Latest</button>
      {!isAtBottom && <Badge>New messages below</Badge>}
    </div>
  );
}
```

## Composable Subcomponents

### Conversation.Content

Custom content container with spacing:

```tsx
<Conversation>
  <Conversation.Content>
    <CustomHeader />
    {messages}
    <CustomFooter />
  </Conversation.Content>
</Conversation>
```

### Conversation.ScrollButton

Custom scroll button (if you want to position it differently):

```tsx
<Conversation showScrollButton={false}>
  {messages}
  <Conversation.ScrollButton threshold={100} />
</Conversation>
```

## Keyboard Shortcuts

| Key   | Action           |
| ----- | ---------------- |
| `End` | Scroll to bottom |

## Accessibility

The component includes proper ARIA attributes:

- `role="log"` - Indicates a live region for chat messages
- `aria-live="polite"` - Announces new messages without interrupting
- `aria-atomic="false"` - Only announces new content, not entire log
- Button has `aria-label="Scroll to bottom"` for screen readers

## Styling

### Default Classes

```tsx
// Container
className = 'relative flex-1 overflow-hidden';

// Content
className = 'flex flex-col gap-4 p-4 min-h-full';

// Scroll button
className =
  'absolute bottom-4 right-4 rounded-full shadow-lg transition-opacity hover:opacity-100 z-10';
```

### Custom Styling

```tsx
<Conversation className='h-[600px] bg-background'>{messages}</Conversation>
```

## Examples

### Full Chat Interface

```tsx
'use client';

import { useState } from 'react';
import { Conversation, useConversation } from '@/components/ai/conversation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function ChatDemo() {
  const [messages, setMessages] = useState([{ id: 1, text: 'Hello!', sender: 'assistant' }]);

  return (
    <div className='flex flex-col h-screen'>
      <header className='border-b p-4'>
        <h1 className='text-lg font-semibold'>AI Chat</h1>
      </header>

      <Conversation className='flex-1' initial='smooth'>
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </Conversation>

      <ChatInput
        onSend={text => {
          setMessages(prev => [
            ...prev,
            {
              id: Date.now(),
              text,
              sender: 'user',
            },
          ]);
        }}
      />
    </div>
  );
}

function MessageBubble({ message }) {
  return (
    <div className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`rounded-lg px-4 py-2 max-w-[70%] ${
          message.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
        }`}
      >
        {message.text}
      </div>
    </div>
  );
}

function ChatInput({ onSend }) {
  const [input, setInput] = useState('');
  const { scrollToBottom } = useConversation();

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input);
    setInput('');
    setTimeout(scrollToBottom, 100);
  };

  return (
    <div className='border-t p-4 flex gap-2'>
      <Input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        placeholder='Type a message...'
        className='flex-1'
      />
      <Button onClick={handleSend}>Send</Button>
    </div>
  );
}
```

### Streaming Messages

```tsx
function StreamingChat() {
  const [streamingMessage, setStreamingMessage] = useState('');
  const { scrollToBottom } = useConversation();

  useEffect(() => {
    // Scroll as content streams in
    scrollToBottom();
  }, [streamingMessage, scrollToBottom]);

  return (
    <Conversation initial='smooth'>
      {messages.map(msg => (
        <Message key={msg.id}>{msg.text}</Message>
      ))}
      {streamingMessage && (
        <Message isStreaming>
          {streamingMessage}
          <TypingIndicator />
        </Message>
      )}
    </Conversation>
  );
}
```

## Testing

Tests are located at `/tests/components/ai/conversation.test.tsx`.

Run tests:

```bash
npm run test tests/components/ai/conversation.test.tsx
```

## Migration from Old Version

If upgrading from the old ScrollArea-based version:

```tsx
// Old
<Conversation autoscroll={true}>

// New (recommended)
<Conversation initial="smooth">

// Or keep autoscroll for backward compatibility
<Conversation autoscroll={true}> // Still works, uses 'smooth' behavior
```

## Performance

- Uses `react-scroll-to-bottom` for efficient scroll management
- Minimal re-renders with memo optimization
- Debounced scroll detection
- Lightweight scroll button (only renders when needed)

## Browser Support

Works in all modern browsers that support:

- CSS `scroll-behavior: smooth`
- ResizeObserver API
- IntersectionObserver API

Fallbacks are handled automatically by the library.

## Related Components

- `Message` - Individual message display
- `PromptInput` - Chat input component
- `Loader` - Typing indicators
- `Tool` - Tool call displays

## API Reference

### Conversation

Main container component.

```tsx
interface ConversationProps extends React.HTMLAttributes<HTMLDivElement> {
  initial?: 'smooth' | 'instant' | 'auto';
  resize?: 'smooth' | 'instant' | 'auto';
  showScrollButton?: boolean;
  scrollThreshold?: number;
  autoscroll?: boolean; // deprecated
}
```

### useConversation

Hook to access scroll functionality.

```tsx
function useConversation(): {
  scrollToBottom: () => void;
  isAtBottom: boolean;
};
```

### Conversation.Content

Content wrapper with spacing.

```tsx
function ConversationContent({ children }: { children: React.ReactNode }): JSX.Element;
```

### Conversation.ScrollButton

Scroll-to-bottom button.

```tsx
function ScrollToBottomButton({ threshold?: number }): JSX.Element | null
```

## Troubleshooting

### Button doesn't appear

The button only shows when scrolled up from bottom. Try scrolling up manually.

### Auto-scroll not working

Ensure messages are added as children and the component can detect content changes.

### Scroll jumps on resize

Set `resize="instant"` for immediate scrolling without animation.

## License

Part of the Neolith AI component library.
