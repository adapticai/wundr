# @wundr.io/ai-integration - Exported Types Reference

## LLM Client Types

All LLM-related types are exported from the package root:

```typescript
import type {
  // Core Interfaces
  LLMClient,
  ChatParams,
  ChatResponse,
  Message,
  ToolDefinition,
  ToolCall,
  
  // Token Usage
  TokenUsage,
  Usage, // Backward compatibility alias for TokenUsage
  
  // Enums/Unions
  MessageRole, // 'system' | 'user' | 'assistant' | 'tool'
  FinishReason, // 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error'
  
  // Streaming
  ChatChunk,
  
  // Configuration
  LLMClientConfig,
} from '@wundr.io/ai-integration';
```

## Error Classes

```typescript
import {
  LLMError,
  LLMAuthenticationError,
  LLMRateLimitError,
  LLMQuotaExceededError,
  LLMInvalidRequestError,
  LLMNetworkError,
} from '@wundr.io/ai-integration';
```

## Type Definitions

### LLMClient Interface

```typescript
interface LLMClient {
  readonly provider: string;
  chat(params: ChatParams): Promise<ChatResponse>;
  chatStream(params: ChatParams): AsyncIterableIterator<ChatChunk>;
  countTokens(input: string | Message[], model: string): Promise<number>;
  listModels?(): Promise<string[]>;
  validateCredentials?(): Promise<boolean>;
}
```

### ChatParams Interface

```typescript
interface ChatParams {
  model: string;
  messages: Message[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string[];
  frequencyPenalty?: number;
  presencePenalty?: number;
  providerParams?: Record<string, unknown>;
}
```

### ChatResponse Interface

```typescript
interface ChatResponse {
  id: string;
  content: string;
  toolCalls?: ToolCall[];
  usage: TokenUsage;
  finishReason: FinishReason;
  raw?: unknown;
}
```

### Message Interface

```typescript
interface Message {
  role: MessageRole; // 'system' | 'user' | 'assistant' | 'tool'
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}
```

### ToolDefinition Interface

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}
```

### ToolCall Interface

```typescript
interface ToolCall {
  id: string;
  name: string;
  arguments: string; // JSON string
}
```

### TokenUsage Interface

```typescript
interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// Alias for backward compatibility
type Usage = TokenUsage;
```

## Build Verification

✅ All types are properly exported from:
- `/Users/maya/wundr/packages/@wundr/ai-integration/dist/index.d.ts`
- Package builds successfully with TypeScript compiler
- Type declarations are generated correctly

## Usage in Other Packages

The orchestrator-daemon package can import these types:

```typescript
import type {
  LLMClient,
  ChatParams,
  ChatResponse,
  Message,
  ToolDefinition,
  ToolCall,
  TokenUsage,
} from '@wundr.io/ai-integration';
```

## Version

Current version: 1.0.6
Built: 2025-12-01
