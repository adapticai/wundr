# AI Assistant Widget - Usage Guide

## Overview

The AI Assistant Widget is a floating, draggable AI chat interface that can be integrated anywhere
in your application. It provides quick access to AI assistance without navigating away from the
current page.

## Components

### 1. AssistantWidget (Main Component)

The complete floating widget with all features.

**Features:**

- Draggable positioning (remembers position across sessions)
- Minimize/maximize controls
- Settings panel
- Persistent state via Zustand
- Keyboard shortcuts (Cmd+K to toggle)
- Responsive sizing

**Usage:**

```tsx
import { AssistantWidget } from '@/components/ai';

export default function Layout({ children }) {
  const handleSendMessage = async (content: string) => {
    // Send to your AI API
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message: content }),
    });
    // Handle response...
  };

  return (
    <>
      {children}
      <AssistantWidget onSendMessage={handleSendMessage} />
    </>
  );
}
```

### 2. WidgetTrigger (Floating Button)

The floating action button that opens the widget.

**Features:**

- Fixed position (bottom-right)
- Unread badge support
- Pulse animation for attention
- Keyboard shortcut tooltip
- Auto-hides when widget is open

**Usage:**

```tsx
import { WidgetTrigger } from '@/components/ai';

export default function Page() {
  return (
    <>
      <main>Your content</main>
      <WidgetTrigger unreadCount={3} showPulse={true} />
    </>
  );
}
```

### 3. WidgetChat (Chat Interface)

The compact chat interface inside the widget.

**Features:**

- Message display with bubbles
- Auto-scroll to latest
- Quick actions integration
- Typing indicators
- New conversation button

**Usage:**

```tsx
import { WidgetChat } from '@/components/ai';

const messages = [
  { id: '1', role: 'user', content: 'Hello', timestamp: new Date() },
  { id: '2', role: 'assistant', content: 'Hi!', timestamp: new Date() },
];

<WidgetChat
  messages={messages}
  onSendMessage={handleSend}
  isLoading={false}
  onNewConversation={() => setMessages([])}
/>;
```

### 4. WidgetActions (Quick Actions)

Predefined quick action buttons for common tasks.

**Features:**

- Grid layout for actions
- Icon + label buttons
- Category grouping
- Customizable via store
- Compact mode support

**Usage:**

```tsx
import { WidgetActions } from '@/components/ai';

<WidgetActions
  onActionSelect={action => {
    console.log('Selected:', action.prompt);
    // Send the prompt to AI
  }}
  compact={false}
/>;
```

## Widget Store

The widget uses Zustand for state management. You can access and control it from anywhere:

```tsx
import { useWidgetStore } from '@/lib/stores/widget-store';

function MyComponent() {
  const { isOpen, toggle, setPosition } = useWidgetStore();

  return <button onClick={toggle}>{isOpen ? 'Close' : 'Open'} AI Assistant</button>;
}
```

### Store API

```typescript
// Display control
open(): void
close(): void
toggle(): void

// Size control
setSize(size: 'minimized' | 'normal' | 'maximized'): void
minimize(): void
maximize(): void

// Position control
setPosition(position: { x: number, y: number }): void
resetPosition(): void

// Conversation
setActiveConversation(id: string | null): void
setContextData(data: Record<string, unknown>): void

// Quick actions
addQuickAction(action: QuickAction): void
removeQuickAction(actionId: string): void

// Preferences
updatePreferences(prefs: Partial<Preferences>): void
```

## Keyboard Shortcuts

- **Cmd+K** (Mac) / **Ctrl+K** (Windows/Linux) - Toggle widget
- **Cmd+Enter** - Send message
- **Esc** - Close widget (when open)

## Customization

### Add Custom Quick Actions

```tsx
import { useWidgetStore } from '@/lib/stores/widget-store';

const { addQuickAction } = useWidgetStore();

addQuickAction({
  id: 'custom-action',
  label: 'Review Code',
  icon: 'Code2',
  prompt: 'Review this code for best practices',
  category: 'development',
});
```

### Update Preferences

```tsx
const { updatePreferences } = useWidgetStore();

updatePreferences({
  autoOpen: true,
  rememberPosition: true,
  showQuickActions: true,
  defaultSize: 'maximized',
});
```

### Custom Position

```tsx
const { setPosition } = useWidgetStore();

// Position at top-left
setPosition({ x: 20, y: 20 });

// Position at top-right
setPosition({ x: window.innerWidth - 420, y: 20 });
```

## Mobile Considerations

The widget is designed to be mobile-friendly:

- Responsive sizing
- Touch-friendly drag handles
- Adaptive layout for small screens
- Auto-adjusts position to stay within viewport

## Integration with AI Chat API

Complete example with Vercel AI SDK:

```tsx
'use client';

import { useState } from 'react';
import { AssistantWidget } from '@/components/ai';
import { useChat } from 'ai/react';

export function AIAssistantProvider() {
  const { messages, append, isLoading } = useChat({
    api: '/api/ai/chat',
  });

  const handleSendMessage = async (content: string) => {
    await append({
      role: 'user',
      content,
    });
  };

  return <AssistantWidget onSendMessage={handleSendMessage} />;
}
```

## Styling

The widget uses Tailwind CSS and shadcn/ui components. You can customize the appearance by:

1. Modifying the component's className prop
2. Updating Tailwind theme
3. Overriding CSS variables for shadcn components

Example custom styling:

```tsx
<AssistantWidget className='rounded-lg shadow-2xl' onSendMessage={handleSend} />
```

## Best Practices

1. **Position Persistence**: Enable `rememberPosition` to save user's preferred position
2. **Context Awareness**: Use `setContextData()` to provide relevant context to the AI
3. **Quick Actions**: Customize quick actions based on the current page/feature
4. **Error Handling**: Implement proper error handling in `onSendMessage`
5. **Loading States**: Always pass `isLoading` to show appropriate feedback
6. **Accessibility**: The widget is keyboard accessible and screen-reader friendly

## Files Created

1. `/lib/stores/widget-store.ts` (259 lines) - Zustand store for widget state
2. `/components/ai/assistant-widget.tsx` (390 lines) - Main widget component
3. `/components/ai/widget-trigger.tsx` (142 lines) - Floating trigger button
4. `/components/ai/widget-chat.tsx` (245 lines) - Chat interface
5. `/components/ai/widget-actions.tsx` (178 lines) - Quick actions component

**Total: 1,214 lines of fully functional code**
