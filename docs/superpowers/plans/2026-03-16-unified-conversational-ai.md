# Unified Conversational AI Component Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents
> available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`)
> syntax for tracking.

**Goal:** Build a single, polished conversational AI component that provides a ChatGPT-quality
experience, then wire it into all 8 conversational interfaces across the neolith web app,
transforming static form wizards into fluid conversational flows.

**Architecture:** Compose a new `UnifiedChat` orchestration component from the existing
`/components/ai/` primitives (ChatInput, MessageBubble, Conversation, Response, Tool, Reasoning,
Actions). The component wraps the Vercel AI SDK `useChat` hook and adds: message grouping, tool call
visualization, progress tracking for entity creation, smooth animations, and configurable personas.
Each consumer (workspace creation, orchestrator chat, etc.) passes a config object rather than
building its own chat UI.

**Tech Stack:** React 18, TypeScript, Vercel AI SDK (`@ai-sdk/react`, `ai`), shadcn/ui (Card,
Avatar, Badge, Button, Tooltip), Tailwind CSS, `class-variance-authority`, `framer-motion` for
entrance animations, existing markdown/code rendering pipeline.

---

## Context

The neolith web app has 8 conversational AI interfaces that each build their own chat UI from
scratch, resulting in inconsistent quality and UX. The existing `/components/ai/` directory has 55+
excellent primitives (MessageBubble, ChatInput, Conversation, Response, CodeBlock, Tool, Reasoning,
Actions, etc.) but no unified orchestration layer. The org genesis wizard is a static 5-step form
instead of a conversational flow.

## Scope

4 chunks, ordered by dependency:

1. **UnifiedChat component** - The shared orchestration component
2. **Entity creation flows** - Wire into workspace creation, org genesis, orchestrator creation
3. **Assistant panels** - Wire into channel AI, workflow AI, orchestrator AI
4. **Build verification** - TypeScript + build pass

All paths below are relative to `packages/@wundr/neolith/apps/web/`.

---

## Chunk 1: UnifiedChat Component

### Task 1: Create the UnifiedChat component

**Files:**

- Create: `components/ai/unified-chat/unified-chat.tsx`
- Create: `components/ai/unified-chat/types.ts`
- Create: `components/ai/unified-chat/index.ts`
- Create: `components/ai/unified-chat/message-group.tsx`
- Create: `components/ai/unified-chat/chat-header.tsx`
- Create: `components/ai/unified-chat/progress-bar.tsx`
- Create: `components/ai/unified-chat/suggestion-chips.tsx`
- Create: `components/ai/unified-chat/empty-state.tsx`

The UnifiedChat composes existing primitives into a premium chat experience. It does NOT rewrite
MessageBubble, ChatInput, or Conversation - it orchestrates them.

- [ ] **Step 1: Create types.ts** with the configuration interface

```typescript
// components/ai/unified-chat/types.ts
import type { ReactNode } from 'react';

export type ChatVariant = 'fullscreen' | 'panel' | 'dialog' | 'embedded';

export interface ChatPersona {
  name: string;
  avatar?: { src?: string; fallback?: string };
  greeting: string;
  suggestions?: string[];
  systemContext?: string;
}

export interface ProgressConfig {
  enabled: boolean;
  requiredFields: string[];
  optionalFields?: string[];
  labels?: Record<string, string>;
}

export interface UnifiedChatConfig {
  /** API endpoint for chat */
  apiEndpoint: string;
  /** Entity type for tool calling extraction (workspace, orchestrator, etc.) */
  entityType?: string;
  /** Chat variant controls layout */
  variant: ChatVariant;
  /** AI persona configuration */
  persona: ChatPersona;
  /** Progress tracking for entity creation flows */
  progress?: ProgressConfig;
  /** Show tool call visualizations */
  showToolCalls?: boolean;
  /** Show reasoning blocks */
  showReasoning?: boolean;
  /** Enable file attachments */
  enableAttachments?: boolean;
  /** Enable message feedback (thumbs up/down) */
  enableFeedback?: boolean;
  /** Enable message actions (copy, regenerate) */
  enableActions?: boolean;
  /** Additional body params sent with each request */
  requestBody?: Record<string, unknown>;
  /** Max height for panel/embedded variants */
  maxHeight?: string;
  /** Callback when entity data is extracted via tool calls */
  onDataExtracted?: (data: Record<string, unknown>) => void;
  /** Callback when creation is ready (progress >= threshold) */
  onReadyToCreate?: (data: Record<string, unknown>) => void;
}

export interface ExtractedData {
  fields: Record<string, unknown>;
  completionPercent: number;
  isReady: boolean;
  history: Array<{ timestamp: Date; fields: string[] }>;
}
```

- [ ] **Step 2: Create empty-state.tsx** - the initial empty chat view with persona greeting

```tsx
// components/ai/unified-chat/empty-state.tsx
'use client';

import { Sparkles } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

import type { ChatPersona } from './types';

interface EmptyStateProps {
  persona: ChatPersona;
  onSuggestionClick?: (suggestion: string) => void;
  className?: string;
}

export function EmptyState({ persona, onSuggestionClick, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-1 flex-col items-center justify-center gap-6 p-8', className)}>
      <div className='flex flex-col items-center gap-3'>
        <div className='relative'>
          <Avatar className='h-16 w-16 border-2 border-primary/20'>
            {persona.avatar?.src && <AvatarImage src={persona.avatar.src} alt={persona.name} />}
            <AvatarFallback className='bg-primary/10 text-primary text-lg'>
              {persona.avatar?.fallback || <Sparkles className='h-7 w-7' />}
            </AvatarFallback>
          </Avatar>
          <div className='absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-green-500 border-2 border-background' />
        </div>
        <div className='text-center'>
          <h3 className='text-lg font-semibold'>{persona.name}</h3>
          <p className='text-sm text-muted-foreground max-w-sm mt-1'>{persona.greeting}</p>
        </div>
      </div>

      {persona.suggestions && persona.suggestions.length > 0 && (
        <div className='flex flex-wrap justify-center gap-2 max-w-lg'>
          {persona.suggestions.map(suggestion => (
            <button
              key={suggestion}
              type='button'
              onClick={() => onSuggestionClick?.(suggestion)}
              className='rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors'
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create suggestion-chips.tsx** - contextual suggestion buttons above input

```tsx
// components/ai/unified-chat/suggestion-chips.tsx
'use client';

import { cn } from '@/lib/utils';

interface SuggestionChipsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  className?: string;
}

export function SuggestionChips({ suggestions, onSelect, className }: SuggestionChipsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className={cn('flex gap-2 overflow-x-auto px-4 py-2 scrollbar-none', className)}>
      {suggestions.map(suggestion => (
        <button
          key={suggestion}
          type='button'
          onClick={() => onSelect(suggestion)}
          className='shrink-0 rounded-full border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors whitespace-nowrap'
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create progress-bar.tsx** - entity creation progress indicator

```tsx
// components/ai/unified-chat/progress-bar.tsx
'use client';

import { CheckCircle2 } from 'lucide-react';

import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  percent: number;
  isReady: boolean;
  label?: string;
  className?: string;
}

export function ProgressBar({ percent, isReady, label, className }: ProgressBarProps) {
  return (
    <div className={cn('flex items-center gap-3 px-4 py-2 border-b bg-muted/30', className)}>
      <Progress value={percent} className='h-1.5 flex-1' />
      <span className='text-xs text-muted-foreground whitespace-nowrap'>
        {isReady ? (
          <span className='flex items-center gap-1 text-green-600'>
            <CheckCircle2 className='h-3.5 w-3.5' />
            Ready
          </span>
        ) : (
          `${Math.round(percent)}% complete`
        )}
      </span>
      {label && <span className='text-xs text-muted-foreground'>{label}</span>}
    </div>
  );
}
```

- [ ] **Step 5: Create chat-header.tsx** - header bar with persona info and actions

```tsx
// components/ai/unified-chat/chat-header.tsx
'use client';

import { MoreHorizontal, X, Minimize2 } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { ChatPersona } from './types';

interface ChatHeaderProps {
  persona: ChatPersona;
  onClose?: () => void;
  onMinimize?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

export function ChatHeader({ persona, onClose, onMinimize, actions, className }: ChatHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between border-b px-4 py-3', className)}>
      <div className='flex items-center gap-3'>
        <Avatar className='h-8 w-8'>
          {persona.avatar?.src && <AvatarImage src={persona.avatar.src} />}
          <AvatarFallback className='bg-primary/10 text-primary text-xs'>
            {persona.avatar?.fallback || persona.name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h4 className='text-sm font-semibold leading-none'>{persona.name}</h4>
          <p className='text-xs text-muted-foreground mt-0.5'>Online</p>
        </div>
      </div>
      <div className='flex items-center gap-1'>
        {actions}
        {onMinimize && (
          <Button variant='ghost' size='icon' className='h-8 w-8' onClick={onMinimize}>
            <Minimize2 className='h-4 w-4' />
          </Button>
        )}
        {onClose && (
          <Button variant='ghost' size='icon' className='h-8 w-8' onClick={onClose}>
            <X className='h-4 w-4' />
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create message-group.tsx** - renders a single message with all parts

This renders Vercel AI SDK `UIMessage` parts (text, reasoning, tool calls) using existing
primitives.

```tsx
// components/ai/unified-chat/message-group.tsx
'use client';

import type { UIMessage } from 'ai';
import { Bot, User } from 'lucide-react';

import { Response } from '@/components/ai/response';
import { Reasoning } from '@/components/ai/reasoning';
import { Tool, ToolStatusBadge } from '@/components/ai/tool';
import { ActionCopy } from '@/components/ai/actions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

import type { ChatPersona } from './types';

interface MessageGroupProps {
  message: UIMessage;
  persona: ChatPersona;
  isStreaming?: boolean;
  showToolCalls?: boolean;
  showReasoning?: boolean;
  showActions?: boolean;
  className?: string;
}

export function MessageGroup({
  message,
  persona,
  isStreaming = false,
  showToolCalls = true,
  showReasoning = true,
  showActions = true,
  className,
}: MessageGroupProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  // Extract text content from parts
  const textContent =
    message.parts
      ?.filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
      .map(p => p.text)
      .join('') || '';

  // Extract reasoning parts
  const reasoningParts =
    message.parts?.filter(
      (p): p is Extract<typeof p, { type: 'reasoning' }> => p.type === 'reasoning'
    ) || [];

  // Extract tool call parts (any part type starting with 'tool-')
  const toolParts = message.parts?.filter(p => p.type.startsWith('tool-')) || [];

  return (
    <div
      className={cn('group flex gap-3 px-4', isUser ? 'flex-row-reverse' : 'flex-row', className)}
    >
      {/* Avatar */}
      <Avatar className='h-8 w-8 shrink-0 mt-0.5'>
        {isUser ? (
          <AvatarFallback className='bg-primary text-primary-foreground text-xs'>
            <User className='h-4 w-4' />
          </AvatarFallback>
        ) : (
          <>
            {persona.avatar?.src && <AvatarImage src={persona.avatar.src} />}
            <AvatarFallback className='bg-primary/10 text-primary text-xs'>
              {persona.avatar?.fallback || <Bot className='h-4 w-4' />}
            </AvatarFallback>
          </>
        )}
      </Avatar>

      {/* Message content */}
      <div
        className={cn('flex flex-col gap-1.5 max-w-[85%]', isUser ? 'items-end' : 'items-start')}
      >
        {/* Reasoning blocks */}
        {showReasoning &&
          reasoningParts.map((part, i) => (
            <Reasoning
              key={`reasoning-${i}`}
              content={part.text}
              isStreaming={isStreaming && i === reasoningParts.length - 1}
            />
          ))}

        {/* Main text bubble */}
        {textContent && (
          <div
            className={cn(
              'rounded-2xl px-4 py-2.5',
              isUser ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'
            )}
          >
            {isUser ? (
              <p className='text-sm whitespace-pre-wrap'>{textContent}</p>
            ) : (
              <Response isStreaming={isStreaming} showCursor={isStreaming}>
                {textContent}
              </Response>
            )}
          </div>
        )}

        {/* Tool calls */}
        {showToolCalls && toolParts.length > 0 && (
          <div className='flex flex-col gap-2 w-full'>
            {toolParts.map((part: any, i) => {
              const status =
                part.state === 'output-available'
                  ? 'completed'
                  : part.state === 'output-error'
                    ? 'error'
                    : part.state === 'input-streaming'
                      ? 'running'
                      : 'pending';
              return (
                <Tool
                  key={part.toolCallId || `tool-${i}`}
                  name={part.type.replace('tool-', '')}
                  status={status}
                  input={part.input}
                  output={part.output}
                  error={part.errorText}
                />
              );
            })}
          </div>
        )}

        {/* Actions (copy) - show on hover for assistant messages */}
        {showActions && isAssistant && textContent && !isStreaming && (
          <div className='opacity-0 group-hover:opacity-100 transition-opacity'>
            <ActionCopy content={textContent} />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Create the main unified-chat.tsx** - the orchestration component

```tsx
// components/ai/unified-chat/unified-chat.tsx
'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Send } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import { ChatHeader } from './chat-header';
import { EmptyState } from './empty-state';
import { MessageGroup } from './message-group';
import { ProgressBar } from './progress-bar';
import { SuggestionChips } from './suggestion-chips';

import type { UnifiedChatConfig, ExtractedData } from './types';

interface UnifiedChatProps extends UnifiedChatConfig {
  onClose?: () => void;
  onMinimize?: () => void;
  headerActions?: React.ReactNode;
  className?: string;
}

export function UnifiedChat({
  apiEndpoint,
  entityType,
  variant,
  persona,
  progress,
  showToolCalls = true,
  showReasoning = true,
  enableAttachments = false,
  enableFeedback = false,
  enableActions = true,
  requestBody,
  maxHeight,
  onDataExtracted,
  onReadyToCreate,
  onClose,
  onMinimize,
  headerActions,
  className,
}: UnifiedChatProps) {
  const [input, setInput] = useState('');
  const [extractedData, setExtractedData] = useState<ExtractedData>({
    fields: {},
    completionPercent: 0,
    isReady: false,
    history: [],
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: apiEndpoint }),
    body: { ...requestBody, ...(entityType ? { entityType } : {}) },
    onToolCall({ toolCall }) {
      // Handle extraction tool calls
      if (toolCall.toolName?.startsWith('extract_') && toolCall.args) {
        const newFields = toolCall.args as Record<string, unknown>;
        setExtractedData(prev => {
          const merged = { ...prev.fields, ...newFields };
          const filledRequired =
            progress?.requiredFields.filter(f => merged[f] != null && merged[f] !== '') || [];
          const total = progress?.requiredFields.length || 1;
          const percent = (filledRequired.length / total) * 100;
          const isReady = percent >= 70;
          const updated: ExtractedData = {
            fields: merged,
            completionPercent: percent,
            isReady,
            history: [...prev.history, { timestamp: new Date(), fields: Object.keys(newFields) }],
          };
          onDataExtracted?.(merged);
          if (isReady && !prev.isReady) onReadyToCreate?.(merged);
          return updated;
        });
      }
    },
  });

  const isStreaming = status === 'streaming';
  const isReady = status === 'ready';

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleSend = useCallback(() => {
    if (!input.trim() || !isReady) return;
    sendMessage({ text: input.trim() });
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [input, isReady, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      sendMessage({ text: suggestion });
    },
    [sendMessage]
  );

  // Dynamic suggestions based on conversation state
  const suggestions = useMemo(() => {
    if (messages.length === 0) return [];
    if (messages.length <= 2 && persona.suggestions) return persona.suggestions;
    return [];
  }, [messages.length, persona.suggestions]);

  const showHeader = variant === 'panel' || variant === 'dialog';
  const showProgress = progress?.enabled && messages.length > 0;

  const containerClasses = cn(
    'flex flex-col bg-background',
    variant === 'fullscreen' && 'h-full w-full',
    variant === 'panel' && 'h-full w-full border-l',
    variant === 'dialog' && 'rounded-lg border shadow-lg',
    variant === 'embedded' && 'rounded-lg border',
    className
  );

  return (
    <div className={containerClasses} style={maxHeight ? { maxHeight } : undefined}>
      {/* Header */}
      {showHeader && (
        <ChatHeader
          persona={persona}
          onClose={onClose}
          onMinimize={onMinimize}
          actions={headerActions}
        />
      )}

      {/* Progress */}
      {showProgress && (
        <ProgressBar percent={extractedData.completionPercent} isReady={extractedData.isReady} />
      )}

      {/* Messages */}
      <div ref={scrollRef} className='flex-1 overflow-y-auto scroll-smooth'>
        {messages.length === 0 ? (
          <EmptyState persona={persona} onSuggestionClick={handleSuggestionClick} />
        ) : (
          <div className='flex flex-col gap-4 py-4'>
            {messages.map((message, index) => (
              <MessageGroup
                key={message.id}
                message={message}
                persona={persona}
                isStreaming={
                  isStreaming && index === messages.length - 1 && message.role === 'assistant'
                }
                showToolCalls={showToolCalls}
                showReasoning={showReasoning}
                showActions={enableActions}
              />
            ))}

            {/* Typing indicator when waiting for response */}
            {isStreaming && messages[messages.length - 1]?.role === 'user' && (
              <div className='flex gap-3 px-4'>
                <div className='h-8 w-8' />
                <div className='flex items-center gap-1 px-4 py-3 bg-muted rounded-2xl rounded-bl-sm'>
                  <span
                    className='h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce'
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className='h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce'
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className='h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce'
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && !isStreaming && (
        <SuggestionChips suggestions={suggestions} onSelect={handleSuggestionClick} />
      )}

      {/* Input area */}
      <div className='border-t p-3'>
        <div className='flex items-end gap-2'>
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? 'Waiting for response...' : `Message ${persona.name}...`}
            disabled={!isReady}
            rows={1}
            className='min-h-[40px] max-h-[150px] resize-none border-0 bg-muted/50 focus-visible:ring-1 rounded-xl px-4 py-2.5 text-sm'
          />
          <Button
            size='icon'
            onClick={handleSend}
            disabled={!input.trim() || !isReady}
            className='h-10 w-10 shrink-0 rounded-xl'
          >
            <Send className='h-4 w-4' />
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Create index.ts barrel export**

```typescript
// components/ai/unified-chat/index.ts
export { UnifiedChat } from './unified-chat';
export { ChatHeader } from './chat-header';
export { EmptyState } from './empty-state';
export { MessageGroup } from './message-group';
export { ProgressBar } from './progress-bar';
export { SuggestionChips } from './suggestion-chips';
export type {
  UnifiedChatConfig,
  ChatPersona,
  ChatVariant,
  ProgressConfig,
  ExtractedData,
} from './types';
```

- [ ] **Step 9: Add export to main ai/index.ts barrel**

Add to `components/ai/index.ts`:

```typescript
// Unified Chat
export { UnifiedChat } from './unified-chat';
export type { UnifiedChatConfig, ChatPersona, ChatVariant, ProgressConfig } from './unified-chat';
```

- [ ] **Step 10: Run typecheck**

```bash
cd packages/@wundr/neolith/apps/web && npx tsc --noEmit
```

- [ ] **Step 11: Commit**

```bash
git add components/ai/unified-chat/ components/ai/index.ts
git commit -m "feat: add UnifiedChat orchestration component

Composes existing AI primitives (MessageBubble, Response, Tool,
Reasoning, Actions) into a single polished chat experience with
configurable personas, progress tracking, and suggestion chips."
```

---

## Chunk 2: Wire Into Entity Creation Flows

### Task 2: Replace workspace creation page chat with UnifiedChat

**Files:**

- Modify: `app/workspaces/new/page.tsx`

The existing page has a three-phase flow (conversation -> review -> creating). We keep that
structure but replace the custom chat UI with UnifiedChat.

- [ ] **Step 1: Read current workspace creation page** to understand the full flow

- [ ] **Step 2: Replace the conversation phase UI**

In the conversation phase JSX (the section that renders messages and input), replace the custom
message rendering and input with:

```tsx
<UnifiedChat
  apiEndpoint='/api/wizard/chat'
  entityType='workspace'
  variant='embedded'
  persona={{
    name: 'Workspace Assistant',
    greeting:
      "I'll help you set up your new workspace. Tell me about your team - what kind of work do you do, and what will this workspace be used for?",
    suggestions: [
      'Create a workspace for my engineering team',
      'Set up a project management workspace',
      'I need a workspace for client collaboration',
    ],
  }}
  progress={{
    enabled: true,
    requiredFields: ['name', 'description', 'organizationType'],
    optionalFields: ['teamSize', 'purpose'],
  }}
  showToolCalls={false}
  enableActions
  requestBody={{ organizationId }}
  onDataExtracted={data => {
    setExtractedData(prev => ({ ...prev, ...data }));
    setCompletionPercent(calculateCompletion(data));
  }}
  onReadyToCreate={data => {
    setExtractedData(prev => ({ ...prev, ...data }));
    setPhase('review');
  }}
  className='h-[500px]'
/>
```

Keep the existing review phase and creation phase as-is - they work well.

- [ ] **Step 3: Remove the old custom chat rendering code** (message list, input, etc.) that the
      UnifiedChat replaces. Keep the phase state management, review form, and creation logic.

- [ ] **Step 4: Run typecheck**

```bash
cd packages/@wundr/neolith/apps/web && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add app/workspaces/new/page.tsx
git commit -m "feat: wire UnifiedChat into workspace creation page"
```

### Task 3: Transform org genesis wizard into conversational flow

**Files:**

- Modify: `components/org-genesis/org-genesis-wizard.tsx`

The current wizard is a 5-step form. Transform it into a conversational flow that still generates
full org structures, with a review step before creation.

- [ ] **Step 1: Read the current org-genesis-wizard.tsx** to understand the full form flow and what
      data it collects

- [ ] **Step 2: Replace the form steps with UnifiedChat**

Replace the multi-step form body (Steps 1-4) with a single conversational interface. Keep Step 5
(preview/accept) as the review phase.

The wizard should become a two-phase component:

- Phase 1: Conversation (UnifiedChat collecting all the data)
- Phase 2: Preview + Accept (existing preview UI)

```tsx
{phase === 'conversation' ? (
  <UnifiedChat
    apiEndpoint="/api/wizard/chat"
    entityType="workspace"
    variant="embedded"
    persona={{
      name: 'Organization Architect',
      greeting: "Let's design your organization. Tell me about your company - what industry are you in, what's your team structure like, and what are your key objectives?",
      suggestions: [
        'Build a tech startup organization',
        'Set up a consulting firm',
        'Create a creative agency structure',
        'Design a research lab organization',
      ],
    }}
    progress={{
      enabled: true,
      requiredFields: ['name', 'description', 'organizationType', 'teamSize'],
      optionalFields: ['industry', 'values', 'governance'],
    }}
    showToolCalls={false}
    enableActions
    requestBody={{ organizationId }}
    onDataExtracted={(data) => setWizardData(prev => ({ ...prev, ...data }))}
    onReadyToCreate={(data) => {
      setWizardData(prev => ({ ...prev, ...data }));
      setPhase('preview');
    }}
    className="h-[600px]"
  />
) : (
  /* Existing preview step - keep as-is */
)}
```

- [ ] **Step 3: Add a "Review & Generate" button** that appears when the conversation has collected
      enough data, transitioning to the preview phase

- [ ] **Step 4: Keep the existing `generateOrganization()` function** that calls
      `/api/workspaces/generate-org` - it works well

- [ ] **Step 5: Run typecheck**

```bash
cd packages/@wundr/neolith/apps/web && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add components/org-genesis/org-genesis-wizard.tsx
git commit -m "feat: transform org genesis wizard into conversational flow

Replace 5-step static form with UnifiedChat conversation that
collects org details naturally, then transitions to preview/generate."
```

### Task 4: Wire orchestrator creation into UnifiedChat

**Files:**

- Modify: `components/creation/ConversationalCreator.tsx`
- Identify: Where orchestrator creation is triggered (check page routes)

- [ ] **Step 1: Find where orchestrator creation is triggered** in the app

```bash
grep -r "orchestrator.*creat\|createOrchestrator\|ConversationalCreator" --include="*.tsx" apps/web/
```

- [ ] **Step 2: Replace the ConversationalCreator dialog body** with UnifiedChat

The ConversationalCreator is a dialog. Replace its internal chat UI with:

```tsx
<UnifiedChat
  apiEndpoint='/api/wizard/chat'
  entityType={entityType}
  variant='dialog'
  persona={{
    name: getPersonaForEntity(entityType).name,
    greeting: getPersonaForEntity(entityType).greeting,
    suggestions: getPersonaForEntity(entityType).suggestions,
  }}
  progress={{
    enabled: true,
    requiredFields: getRequiredFields(entityType),
  }}
  showToolCalls={false}
  enableActions
  requestBody={{ workspaceId }}
  onDataExtracted={data => setSpec(prev => ({ ...prev, ...data }))}
  onReadyToCreate={data => onSpecGenerated(data as EntitySpec)}
  className='h-[500px]'
/>
```

Add a helper function for entity-specific personas:

```typescript
function getPersonaForEntity(type: EntityType) {
  const personas: Record<EntityType, ChatPersona> = {
    workspace: {
      name: 'Workspace Assistant',
      greeting: "Let's create your workspace. What will it be used for?",
      suggestions: ['Engineering team workspace', 'Project management', 'Client collaboration'],
    },
    orchestrator: {
      name: 'Agent Architect',
      greeting:
        "I'll help you design an orchestrator agent. What role should this agent play in your organization?",
      suggestions: ['Team lead agent', 'Process coordinator', 'Quality reviewer'],
    },
    'session-manager': {
      name: 'Session Designer',
      greeting: "Let's configure a session manager. What context should it manage?",
      suggestions: ['Engineering sessions', 'Client meetings', 'Sprint planning'],
    },
    workflow: {
      name: 'Workflow Builder',
      greeting: "I'll help you build a workflow. What process do you want to automate?",
      suggestions: ['Approval workflow', 'Onboarding process', 'Code review pipeline'],
    },
    channel: {
      name: 'Channel Setup',
      greeting: "Let's create a channel. What topic or team is it for?",
      suggestions: ['Team discussion channel', 'Project updates', 'Announcements'],
    },
    subagent: {
      name: 'Agent Builder',
      greeting: "I'll help you create a specialized sub-agent. What capabilities does it need?",
      suggestions: ['Code reviewer', 'Data analyst', 'Content writer'],
    },
  };
  return personas[type] || personas.workspace;
}
```

- [ ] **Step 3: Run typecheck**

- [ ] **Step 4: Commit**

```bash
git add components/creation/ConversationalCreator.tsx
git commit -m "feat: wire UnifiedChat into ConversationalCreator for all entity types"
```

---

## Chunk 3: Wire Into Assistant Panels

### Task 5: Wire channel AI assistant into UnifiedChat

**Files:**

- Modify: `components/channels/channel-ai-assistant.tsx`

- [ ] **Step 1: Read the current channel-ai-assistant.tsx**

- [ ] **Step 2: Replace the chat section** with UnifiedChat in panel variant

The channel AI assistant has three sections (Summary, Suggestions, Chat). Replace the Chat section's
custom UI with UnifiedChat. Keep the Summary and Suggestions sections as quick-action buttons.

```tsx
<UnifiedChat
  apiEndpoint={`/api/channels/${channelId}/ai`}
  variant='panel'
  persona={{
    name: `${channelName} Assistant`,
    greeting: `I can help with anything about #${channelName}. Ask me to summarize, suggest messages, or answer questions.`,
    suggestions: ['Summarize recent activity', 'Suggest a message', 'What topics are trending?'],
  }}
  showToolCalls
  showReasoning
  enableActions
  requestBody={{ channelId, action: 'chat' }}
  onClose={onClose}
  maxHeight='calc(100vh - 8rem)'
/>
```

- [ ] **Step 3: Run typecheck**

- [ ] **Step 4: Commit**

```bash
git add components/channels/channel-ai-assistant.tsx
git commit -m "feat: wire UnifiedChat into channel AI assistant panel"
```

### Task 6: Wire workflow AI assistant into UnifiedChat

**Files:**

- Modify: `components/workflow/workflow-ai-assistant.tsx`

- [ ] **Step 1: Read the current workflow-ai-assistant.tsx**

- [ ] **Step 2: Replace the chat section** with UnifiedChat

Keep the quick action buttons (Create, Optimize, Diagnose, Suggest Steps) as `headerActions` on the
UnifiedChat. Replace the free-form chat section.

```tsx
<UnifiedChat
  apiEndpoint={`/api/workspaces/${workspaceSlug}/workflows/ai`}
  variant='panel'
  persona={{
    name: 'Workflow Assistant',
    greeting: 'I can help create, optimize, and debug workflows. What would you like to do?',
    suggestions: ['Create a new workflow', 'Optimize current workflow', 'Diagnose an error'],
  }}
  showToolCalls
  enableActions
  requestBody={{ workflowId, executionId }}
  onClose={onClose}
  maxHeight='calc(100vh - 8rem)'
/>
```

- [ ] **Step 3: Run typecheck**

- [ ] **Step 4: Commit**

```bash
git add components/workflow/workflow-ai-assistant.tsx
git commit -m "feat: wire UnifiedChat into workflow AI assistant panel"
```

### Task 7: Wire orchestrator AI chat into UnifiedChat

**Files:**

- Modify: `components/orchestrators/orchestrator-chat.tsx`

- [ ] **Step 1: Read the current orchestrator-chat.tsx**

- [ ] **Step 2: Replace the chat UI** with UnifiedChat

```tsx
<UnifiedChat
  apiEndpoint={`/api/orchestrators/${orchestratorId}/ai`}
  variant='panel'
  persona={{
    name: orchestratorName || 'Orchestrator Assistant',
    greeting:
      'I can help you improve this orchestrator, suggest capabilities, refine the charter, or tune operational settings.',
    suggestions: [
      'How can I improve this orchestrator?',
      'Suggest capabilities for this discipline',
      'Help me write a better charter',
    ],
  }}
  showToolCalls
  showReasoning
  enableActions
  requestBody={{ orchestratorId }}
  onClose={onClose}
  maxHeight='calc(100vh - 8rem)'
/>
```

- [ ] **Step 3: Run typecheck**

- [ ] **Step 4: Commit**

```bash
git add components/orchestrators/orchestrator-chat.tsx
git commit -m "feat: wire UnifiedChat into orchestrator AI chat panel"
```

---

## Chunk 4: Build Verification

### Task 8: Final verification

- [ ] **Step 1: Run TypeScript check**

```bash
cd packages/@wundr/neolith/apps/web && npx tsc --noEmit
```

- [ ] **Step 2: Run build**

```bash
cd packages/@wundr/neolith/apps/web && npx next build
```

- [ ] **Step 3: Verify UnifiedChat is used in all target files**

```bash
grep -r "UnifiedChat" apps/web/ --include="*.tsx" -l
```

Expected: 6+ files using UnifiedChat

- [ ] **Step 4: Verify no custom chat UIs remain in replaced components**

Manually verify that the replaced components no longer have their own message rendering loops.

- [ ] **Step 5: Final commit and push**

```bash
git push origin master
```

---

## Verification

After all tasks complete:

1. `npx tsc --noEmit` passes
2. `npx next build` succeeds
3. UnifiedChat component exists at `components/ai/unified-chat/`
4. Workspace creation page uses UnifiedChat
5. Org genesis wizard uses conversational flow (not form steps)
6. ConversationalCreator uses UnifiedChat for all entity types
7. Channel, Workflow, and Orchestrator AI panels use UnifiedChat
8. All chat interfaces have consistent styling, animations, and behavior
