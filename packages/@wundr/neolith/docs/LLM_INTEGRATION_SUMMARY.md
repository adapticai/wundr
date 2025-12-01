# LLM Integration Summary - @adaptic/lumic-utils

## Overview

Successfully integrated `@adaptic/lumic-utils` package for LLM functionality in the Neolith project.
The integration provides a comprehensive, type-safe interface for interacting with OpenAI's language
models.

## Implementation Details

### 1. Package Installation

**Location:** `/packages/@neolith/core/package.json`

Added dependencies:

- `@adaptic/lumic-utils` - Core LLM utilities (file link to `/Users/iroselli/adapticai/lumic-utils`)
- `openai` v5.8.2 - OpenAI SDK (peer dependency)

```json
{
  "dependencies": {
    "@adaptic/lumic-utils": "file:../../../../../../../adapticai/lumic-utils",
    "openai": "^5.8.2"
  }
}
```

### 2. LLM Service Implementation

**Location:** `/packages/@neolith/core/src/services/llm-service.ts`

Created a comprehensive service wrapper with the following features:

#### Core Functions

1. **`chat(prompt, options)`** - Simple text completion
   - Returns plain text responses
   - Configurable model, temperature, max tokens

2. **`chatJSON(prompt, options)`** - JSON response
   - Returns parsed JSON objects
   - Automatic JSON parsing and validation

3. **`chatStructured(prompt, schema, options)`** - Structured JSON with schema
   - Schema validation using JSON Schema
   - Type-safe responses with TypeScript generics
   - Only available on compatible models (gpt-5, gpt-5-mini, o3-mini, etc.)

4. **`chatWithHistory(messages, options)`** - Conversational chat
   - Supports message history/context
   - Maintains conversation state

5. **`chatAdvanced(prompt, features, options)`** - Advanced features
   - Web search integration
   - Code interpreter
   - Image analysis capabilities

6. **`analyzeImage(imageBase64, prompt, options)`** - Vision capabilities
   - Analyze images with AI
   - Supports base64 or data URL images
   - Configurable detail level (low/high/auto)

#### Configuration

```typescript
interface LLMServiceConfig {
  apiKey?: string; // OpenAI API key
  defaultModel?: OpenAIModel; // Default: 'gpt-5-mini'
  defaultTemperature?: number; // Default: 1
  defaultMaxTokens?: number; // Default: 4096
}
```

#### Usage Example

```typescript
import { getLLMService } from '@neolith/core/services';

// Initialize service
const llmService = getLLMService({
  apiKey: process.env.OPENAI_API_KEY,
  defaultModel: 'gpt-5-mini',
});

// Simple chat
const response = await llmService.chat('What is TypeScript?');

// JSON response
const data = await llmService.chatJSON<{ name: string; age: number }>(
  'Generate a person with name and age'
);

// Structured response with schema
const schema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    items: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'items'],
};
const result = await llmService.chatStructured('Create a todo list', schema);

// Image analysis
const analysis = await llmService.analyzeImage(imageBase64, 'What objects are in this image?');
```

### 3. API Routes

Created Next.js API routes for client-server communication:

#### POST /api/llm/chat

**Location:** `/apps/web/app/api/llm/chat/route.ts`

Features:

- Authentication required (NextAuth)
- Supports text and JSON responses
- Structured schema validation
- Message history support

Request body:

```typescript
{
  prompt?: string;
  messages?: ChatMessage[];
  responseFormat?: 'text' | 'json';
  schema?: { ... };
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
}
```

Response:

```typescript
{
  success: true,
  data: T,
  usage: {
    prompt_tokens: number,
    completion_tokens: number,
    reasoning_tokens?: number,
    provider: string,
    model: string,
    cost: number
  }
}
```

#### POST /api/llm/analyze-image

**Location:** `/apps/web/app/api/llm/analyze-image/route.ts`

Features:

- Image analysis with vision models
- Base64 image support
- Configurable detail level
- Usage tracking

Request body:

```typescript
{
  imageBase64: string;
  prompt?: string;
  detail?: 'low' | 'high' | 'auto';
  options?: {
    model?: string;
    temperature?: number;
  }
}
```

### 4. React Hooks

**Location:** `/apps/web/hooks/useLLMChat.ts`

Created two custom hooks for easy client-side integration:

#### `useLLMChat()`

```typescript
const {
  chat, // Simple text completion
  chatJSON, // JSON response
  chatStructured, // Schema-validated JSON
  chatWithHistory, // Conversational chat
  loading, // Loading state
  error, // Error message
  lastUsage, // Token usage stats
} = useLLMChat();

// Usage
const result = await chat('Hello, AI!');
```

#### `useLLMImageAnalysis()`

```typescript
const {
  analyzeImage, // Analyze images
  loading, // Loading state
  error, // Error message
  lastUsage, // Token usage stats
} = useLLMImageAnalysis();

// Usage
const description = await analyzeImage(base64Image, 'Describe this image');
```

### 5. Environment Variables

**Location:** `/apps/web/.env.example`

Added configuration:

```bash
# OpenAI API Key (required for LLM functionality)
OPENAI_API_KEY=sk-your-openai-api-key-here

# LLM Service Configuration (via @adaptic/lumic-utils)
LLM_DEFAULT_MODEL=gpt-5-mini
LLM_DEFAULT_TEMPERATURE=1
LLM_DEFAULT_MAX_TOKENS=4096
```

### 6. Service Exports

**Location:** `/packages/@neolith/core/src/services/index.ts`

Added exports:

```typescript
export {
  LLMService,
  getLLMService,
  lumic,
  type LLMServiceConfig,
  type ChatMessage,
  type StreamCallback,
  type LLMOptions,
  type LLMResponse,
  type LLMUsage,
  type OpenAIModel,
  type OpenAIResponseFormat,
} from './llm-service';
```

## Supported Models

The integration supports the following OpenAI models:

- **gpt-5-mini** (default) - Cost-effective, fast
- **gpt-5** - Most capable
- **o1-mini** - Reasoning optimized (mini)
- **o1** - Reasoning optimized
- **o3-mini** - Latest reasoning (mini)
- **o3** - Latest reasoning
- **gpt-4.1** - Previous generation
- **gpt-4.1-mini** - Previous gen (mini)
- **gpt-4.1-nano** - Most economical
- **o4-mini** - Reasoning variant

## Features

### ✅ Implemented

1. **Chat Completions**
   - Simple text responses
   - JSON responses
   - Structured JSON with schema validation
   - Conversational chat with history

2. **Advanced Features**
   - Image analysis (vision)
   - Web search integration
   - Code interpreter
   - Multi-modal inputs

3. **Developer Experience**
   - Type-safe TypeScript interfaces
   - React hooks for easy integration
   - Singleton service pattern
   - Comprehensive error handling

4. **Cost Tracking**
   - Token usage tracking
   - Cost calculation per request
   - Provider and model information

### ⚠️ Limitations

1. **Embeddings** - Not yet implemented
   - Use OpenAI SDK directly for text-embedding-3-small/large
   - Placeholder method throws error with instructions

2. **Streaming** - Not implemented in current version
   - StreamCallback type defined for future use
   - Can be added in future iterations

## Usage Examples

### Server-Side (Service Layer)

```typescript
import { getLLMService } from '@neolith/core/services';

export async function generateContent() {
  const llm = getLLMService();

  const result = await llm.chat('Generate a welcome message for new users', {
    model: 'gpt-5-mini',
    temperature: 0.7,
  });

  return result.response;
}
```

### Client-Side (React Component)

```typescript
'use client';

import { useLLMChat } from '@/hooks/useLLMChat';
import { useState } from 'react';

export function ChatComponent() {
  const { chat, loading, error } = useLLMChat();
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');

  const handleSubmit = async () => {
    const result = await chat(input);
    if (result) {
      setResponse(result);
    }
  };

  return (
    <div>
      <textarea value={input} onChange={(e) => setInput(e.target.value)} />
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? 'Thinking...' : 'Send'}
      </button>
      {error && <p>Error: {error}</p>}
      {response && <p>Response: {response}</p>}
    </div>
  );
}
```

### API Route Usage

```typescript
// POST /api/llm/chat
const response = await fetch('/api/llm/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Explain quantum computing',
    options: { model: 'gpt-5-mini', temperature: 0.5 },
  }),
});

const { data, usage } = await response.json();
console.log('Response:', data);
console.log('Cost:', usage.cost);
```

## Type Safety

All functions are fully typed with TypeScript generics:

```typescript
// Typed JSON response
interface UserProfile {
  name: string;
  email: string;
  age: number;
}

const profile = await llm.chatJSON<UserProfile>('Generate a user profile');

// profile is typed as UserProfile
console.log(profile.name); // TypeScript knows this exists
```

## Error Handling

The service includes comprehensive error handling:

1. **API Key Validation** - Warns if no key is provided
2. **Model Validation** - Throws error for unsupported models
3. **Schema Validation** - Validates JSON schema compatibility
4. **Request Validation** - Checks required parameters
5. **HTTP Error Handling** - Proper status codes in API routes

## Testing

Run typecheck to verify integration:

```bash
# Core package
cd packages/@neolith/core
pnpm typecheck

# Entire project
cd packages/@wundr/neolith
pnpm typecheck
```

**Status:** ✅ All typechecks passing

## Security Considerations

1. **API Key Management**
   - Never commit API keys
   - Use environment variables
   - API routes check authentication

2. **Rate Limiting**
   - Consider implementing rate limiting
   - Track usage per user/workspace

3. **Cost Control**
   - Monitor token usage
   - Set max_tokens limits
   - Track costs per request

## Future Enhancements

1. **Streaming Support**
   - Implement streaming responses
   - Real-time token generation
   - Better UX for long responses

2. **Embeddings**
   - Add embedding generation
   - Vector search integration
   - Semantic similarity

3. **Fine-tuning**
   - Support for fine-tuned models
   - Custom model endpoints

4. **Caching**
   - Response caching
   - Reduce duplicate requests
   - Cost optimization

5. **Rate Limiting**
   - Per-user limits
   - Per-workspace limits
   - Cost budgets

## Files Created/Modified

### Created

1. `/packages/@neolith/core/src/services/llm-service.ts` - Main service implementation
2. `/apps/web/app/api/llm/chat/route.ts` - Chat API endpoint
3. `/apps/web/app/api/llm/analyze-image/route.ts` - Image analysis endpoint
4. `/apps/web/hooks/useLLMChat.ts` - React hooks
5. `/docs/LLM_INTEGRATION_SUMMARY.md` - This document

### Modified

1. `/packages/@neolith/core/package.json` - Added dependencies
2. `/packages/@neolith/core/src/services/index.ts` - Added exports
3. `/apps/web/.env.example` - Added environment variables

## Verification

✅ Package installed successfully ✅ Dependencies resolved ✅ TypeScript compilation successful ✅
Service exports working ✅ API routes created ✅ React hooks created ✅ Documentation complete

## Conclusion

The LLM integration is complete and ready for use. The implementation provides:

- Type-safe, modern API
- Easy-to-use React hooks
- Comprehensive feature set
- Good developer experience
- Production-ready code

You can now use LLM functionality throughout the Neolith application for:

- Content generation
- Image analysis
- Conversational AI
- Structured data extraction
- And more...

Default model: **gpt-5-mini** (cost-effective and fast)
