# AI Module Import Examples

This document demonstrates how to use the organized AI module exports in real-world scenarios.

## Component Imports

### Chat Interface Example

```typescript
import {
  ChatInterface,
  MessageBubble,
  ChatInput,
  ChatHistory,
  TypingIndicator,
  MessageActions,
} from '@/components/ai';

function ChatPage() {
  return (
    <ChatInterface
      workspaceId="ws_123"
      onMessageSend={handleSend}
    >
      <ChatHistory />
      <ChatInput />
    </ChatInterface>
  );
}
```

### Voice Input Example

```typescript
import {
  VoiceInput,
  VoiceSettings,
  VoiceVisualizer,
} from '@/components/ai';
import { useVoiceInput } from '@/hooks/ai';

function VoiceChat() {
  const voice = useVoiceInput({
    language: 'en-US',
    continuous: true,
  });

  return (
    <>
      <VoiceInput {...voice} />
      <VoiceVisualizer isActive={voice.isListening} />
      <VoiceSettings
        settings={voice.settings}
        onSettingsChange={voice.updateSettings}
      />
    </>
  );
}
```

### Context Management Example

```typescript
import {
  ContextManager,
  ContextSources,
  ContextPreview,
} from '@/components/ai';
import { useAIContext } from '@/hooks/ai';
import type { ContextSource } from '@/lib/ai';

function AIContextBuilder() {
  const { sources, addSource, removeSource } = useAIContext();

  return (
    <ContextManager workspaceId="ws_123">
      <ContextSources
        selectedSources={sources}
        onSourcesChange={addSource}
      />
      <ContextPreview
        sources={sources}
        onRemoveSource={removeSource}
      />
    </ContextManager>
  );
}
```

## Library Function Imports

### Rate Limiting Example

```typescript
import { checkRateLimit, getRateLimitStatus, type RateLimitResult } from '@/lib/ai';

async function handleAIRequest(userId: string) {
  const rateLimit = await checkRateLimit({
    identifier: `user:${userId}`,
    maxRequests: 100,
    windowMs: 60000,
  });

  if (!rateLimit.allowed) {
    throw new Error(`Rate limit exceeded. Retry after ${rateLimit.retryAfter}s`);
  }

  // Process request...
}
```

### Context Building Example

```typescript
import { buildContext, formatContextForPrompt, type ContextBuildOptions } from '@/lib/ai';

async function prepareAIPrompt(workspaceId: string, userQuery: string) {
  const context = await buildContext({
    workspaceId,
    query: userQuery,
    maxTokens: 4000,
    sources: [
      { type: 'workflow', id: 'wf_123' },
      { type: 'channel', id: 'ch_456' },
    ],
  });

  const prompt = formatContextForPrompt(context, userQuery);
  return prompt;
}
```

### Tool Execution Example

```typescript
import { toolRegistry, registerTool, type ToolDefinition, type ToolContext } from '@/lib/ai';

// Register a custom tool
registerTool({
  name: 'search_workspace',
  description: 'Search workspace content',
  category: 'search',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query',
      },
    },
    required: ['query'],
  },
  execute: async (input, context) => {
    // Implementation...
    return { success: true, data: results };
  },
});

// Execute tool
async function executeWorkspaceSearch(query: string, context: ToolContext) {
  const result = await toolRegistry.execute('search_workspace', { query }, context);

  return result;
}
```

### Speech Recognition Example

```typescript
import {
  startRecognition,
  stopRecognition,
  checkMicrophonePermission,
  SUPPORTED_LANGUAGES,
  type SpeechRecognitionResult,
} from '@/lib/ai';

async function enableVoiceInput() {
  const hasPermission = await checkMicrophonePermission();

  if (hasPermission !== 'granted') {
    throw new Error('Microphone permission required');
  }

  const recognition = await startRecognition({
    language: 'en-US',
    continuous: true,
    interimResults: true,
  });

  recognition.onResult = (result: SpeechRecognitionResult) => {
    console.log('Transcript:', result.transcript);
    console.log('Confidence:', result.confidence);
  };

  // Clean up
  return () => stopRecognition(recognition);
}
```

## Type Imports

### Message Types Example

```typescript
import type {
  AIMessage,
  AIMessageRole,
  AIMessageStatus,
  AIMessageMetadata,
  AIToolCall,
} from '@/types/ai';

function processMessage(message: AIMessage) {
  const role: AIMessageRole = message.role;
  const status: AIMessageStatus = message.status;
  const metadata: AIMessageMetadata = message.metadata;
  const tools: AIToolCall[] = message.toolCalls || [];

  // Process message...
}
```

### Provider Types Example

```typescript
import type {
  AIProvider,
  AIProviderConfig,
  AIProviderCredentials,
  AIProviderHealth,
} from '@/types/ai';

function configureProvider(
  provider: AIProvider,
  credentials: AIProviderCredentials
): AIProviderConfig {
  return {
    provider,
    credentials,
    defaultModel: provider === 'openai' ? 'gpt-4o-mini' : 'claude-3-sonnet',
    timeout: 30000,
    enableRetries: true,
  };
}
```

### Conversation Types Example

```typescript
import type {
  AIConversation,
  AIConversationStatus,
  AIConversationSettings,
  AIConversationParticipant,
} from '@/types/ai';

function createConversation(workspaceId: string, userId: string): Partial<AIConversation> {
  return {
    workspaceId,
    status: 'active',
    participants: [
      {
        id: userId,
        role: 'user',
        joinedAt: new Date(),
      },
    ],
    settings: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.7,
    },
  };
}
```

## Hook Imports

### Chat Hook Example

```typescript
import {
  useAIChat,
  type UseAIChatOptions,
  type LocalAIMessage,
} from '@/hooks/ai';

function AIChatComponent() {
  const {
    messages,
    sendMessage,
    isLoading,
    error,
    clearMessages,
  } = useAIChat({
    workspaceId: 'ws_123',
    conversationId: 'conv_456',
    provider: 'openai',
    model: 'gpt-4o-mini',
    onError: (err) => console.error(err),
  });

  const handleSend = async (content: string) => {
    await sendMessage({
      role: 'user',
      content,
    });
  };

  return (
    <div>
      {messages.map((msg) => (
        <div key={msg.id}>{msg.content}</div>
      ))}
      {isLoading && <div>Loading...</div>}
    </div>
  );
}
```

### Stream Hook Example

```typescript
import {
  useAIStream,
  type StreamChunk,
  type StreamStatus,
} from '@/hooks/ai';

function StreamingChat() {
  const {
    streamedContent,
    status,
    startStream,
    stopStream,
  } = useAIStream({
    onChunk: (chunk: StreamChunk) => {
      console.log('Received:', chunk.content);
    },
    onComplete: (fullContent: string) => {
      console.log('Stream complete:', fullContent);
    },
  });

  const handleStream = () => {
    startStream({
      messages: [
        { role: 'user', content: 'Tell me a story' },
      ],
      provider: 'anthropic',
      model: 'claude-3-sonnet',
    });
  };

  return (
    <div>
      <button onClick={handleStream}>Start Stream</button>
      <div>{streamedContent}</div>
      <div>Status: {status}</div>
    </div>
  );
}
```

### Suggestions Hook Example

```typescript
import {
  useAISuggestions,
  type Suggestion,
  type SuggestionCategory,
} from '@/hooks/ai';

function SmartInput() {
  const {
    suggestions,
    isLoading,
    getSuggestionsForContext,
  } = useAISuggestions({
    workspaceId: 'ws_123',
    limit: 5,
    categories: ['workflow', 'channel', 'document'],
  });

  const handleInputChange = async (text: string) => {
    await getSuggestionsForContext({
      text,
      cursorPosition: text.length,
      recentActions: [],
    });
  };

  return (
    <div>
      <input onChange={(e) => handleInputChange(e.target.value)} />
      {suggestions.map((suggestion) => (
        <div key={suggestion.id}>{suggestion.content}</div>
      ))}
    </div>
  );
}
```

## Combined Example: Full AI Chat Page

```typescript
import { useState } from 'react';

// Component imports
import {
  ChatInterface,
  MessageBubble,
  ChatInput,
  ChatHistory,
  FeedbackButtons,
  ModelSelector,
  VoiceInput,
  ContextSources,
  ToolResult,
} from '@/components/ai';

// Hook imports
import {
  useAIChat,
  useAIStream,
  useAISuggestions,
  useVoiceInput,
} from '@/hooks/ai';

// Type imports
import type {
  AIMessage,
  AIProvider,
  AIModelConfig,
} from '@/types/ai';

// Library imports
import {
  checkRateLimit,
  buildContext,
  type ContextSource,
} from '@/lib/ai';

export function FullAIChatPage({ workspaceId }: { workspaceId: string }) {
  const [provider, setProvider] = useState<AIProvider>('openai');
  const [model, setModel] = useState('gpt-4o-mini');
  const [contextSources, setContextSources] = useState<ContextSource[]>([]);

  // Initialize hooks
  const chat = useAIChat({
    workspaceId,
    provider,
    model,
    onError: (error) => console.error('Chat error:', error),
  });

  const voice = useVoiceInput({
    language: 'en-US',
    onTranscript: (transcript) => {
      chat.sendMessage({ role: 'user', content: transcript });
    },
  });

  const suggestions = useAISuggestions({
    workspaceId,
    limit: 5,
  });

  // Handle message send with rate limiting
  const handleSendMessage = async (content: string) => {
    // Check rate limit
    const rateLimit = await checkRateLimit({
      identifier: `workspace:${workspaceId}`,
      maxRequests: 100,
      windowMs: 60000,
    });

    if (!rateLimit.allowed) {
      alert(`Rate limit exceeded. Try again in ${rateLimit.retryAfter}s`);
      return;
    }

    // Build context if sources selected
    let contextPrompt = content;
    if (contextSources.length > 0) {
      const context = await buildContext({
        workspaceId,
        query: content,
        sources: contextSources,
        maxTokens: 4000,
      });
      contextPrompt = `${context.formattedContext}\n\nUser: ${content}`;
    }

    // Send message
    await chat.sendMessage({
      role: 'user',
      content: contextPrompt,
    });
  };

  return (
    <div className="ai-chat-page">
      {/* Model Selection */}
      <div className="header">
        <ModelSelector
          value={{ provider, model }}
          onChange={(config) => {
            setProvider(config.provider);
            setModel(config.model);
          }}
        />
      </div>

      {/* Context Sources */}
      <div className="sidebar">
        <ContextSources
          workspaceId={workspaceId}
          selectedSources={contextSources}
          onSourcesChange={setContextSources}
        />
      </div>

      {/* Main Chat Interface */}
      <div className="main">
        <ChatInterface workspaceId={workspaceId}>
          {/* Message History */}
          <ChatHistory messages={chat.messages}>
            {(message: AIMessage) => (
              <MessageBubble
                key={message.id}
                message={message}
                showAvatar
              >
                <FeedbackButtons messageId={message.id} />
              </MessageBubble>
            )}
          </ChatHistory>

          {/* Input Area */}
          <div className="input-area">
            <ChatInput
              onSend={handleSendMessage}
              suggestions={suggestions.suggestions}
              disabled={chat.isLoading}
            />
            <VoiceInput
              isListening={voice.isListening}
              transcript={voice.transcript}
              onStart={voice.start}
              onStop={voice.stop}
            />
          </div>
        </ChatInterface>
      </div>
    </div>
  );
}
```

## Best Practices

### 1. Import Organization

```typescript
// Group imports by category
import { Component1, Component2 } from '@/components/ai';
import { useHook1, useHook2 } from '@/hooks/ai';
import type { Type1, Type2 } from '@/types/ai';
import { util1, util2 } from '@/lib/ai';
```

### 2. Type Safety

```typescript
// Always import types separately for verbatimModuleSyntax
import type { AIMessage } from '@/types/ai';
import { processMessage } from '@/lib/ai';

function handler(msg: AIMessage) {
  return processMessage(msg);
}
```

### 3. Tree Shaking

```typescript
// Import only what you need
import { ChatInterface, MessageBubble } from '@/components/ai';

// Avoid wildcard imports
// ❌ import * as AI from '@/components/ai';
```

### 4. Consistent Naming

```typescript
// Use the exported names
import {
  useAIChat, // Not useChat
  AIMessage, // Not Message
  ChatInterface, // Not Chat
} from '@/components/ai';
```

---

All imports are now available through clean barrel exports!
