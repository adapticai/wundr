# Direct OpenAI Wrapper Usage

The `direct-openai.ts` module provides a simple, working LLM call wrapper using the OpenAI SDK directly. This serves as a backup to `@adaptic/lumic-utils`.

## Features

- ✅ Simple, clean API using official OpenAI SDK
- ✅ Full TypeScript support with type definitions
- ✅ Tool/function calling support
- ✅ Token usage tracking
- ✅ Error handling with clear messages
- ✅ Lazy initialization (no API key required at import time)
- ✅ Configurable defaults

## Installation

The `openai` package is already installed as a dependency in `@wundr.io/orchestrator-daemon`.

## Basic Usage

### Simple LLM Call

```typescript
import { llmCall } from '@wundr.io/orchestrator-daemon/llm';

const response = await llmCall({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is the capital of France?' }
  ],
  temperature: 0.7,
  maxTokens: 100
});

console.log(response.content);
// Output: "The capital of France is Paris."

console.log(`Used ${response.usage.totalTokens} tokens`);
// Output: "Used 42 tokens"
```

### With Tool/Function Calling

```typescript
import { llmCall } from '@wundr.io/orchestrator-daemon/llm';

const response = await llmCall({
  messages: [
    { role: 'user', content: 'What is the weather in San Francisco?' }
  ],
  tools: [
    {
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get the current weather for a location',
        parameters: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'The city and state, e.g. San Francisco, CA'
            }
          },
          required: ['location']
        }
      }
    }
  ]
});

if (response.toolCalls && response.toolCalls.length > 0) {
  console.log('Tool called:', response.toolCalls[0].name);
  console.log('Arguments:', response.toolCalls[0].arguments);
}
```

### Configured LLM with Defaults

```typescript
import { createLLMCall } from '@wundr.io/orchestrator-daemon/llm';

// Create a fast LLM with low temperature
const fastLLM = createLLMCall('gpt-4o-mini', 0.3);

// Use it without specifying model/temperature each time
const response1 = await fastLLM({
  messages: [{ role: 'user', content: 'Quick question 1?' }]
});

const response2 = await fastLLM({
  messages: [{ role: 'user', content: 'Quick question 2?' }]
});

// Override defaults if needed
const response3 = await fastLLM({
  messages: [{ role: 'user', content: 'Creative response please' }],
  temperature: 0.9  // Override the default 0.3
});
```

## API Reference

### `llmCall(params: LLMCallParams): Promise<LLMCallResponse>`

Makes a direct LLM call using the OpenAI SDK.

**Parameters:**
- `model?: string` - Model to use (default: 'gpt-4o-mini')
- `messages: Array<{role: string, content: string}>` - Conversation messages
- `tools?: any[]` - OpenAI function/tool definitions
- `temperature?: number` - Sampling temperature (default: 0.7)
- `maxTokens?: number` - Maximum tokens to generate (default: 4096)

**Returns:**
```typescript
{
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: string;  // JSON string
  }>;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

**Throws:**
- `Error` if `OPENAI_API_KEY` environment variable is not set
- `Error` if the API call fails

### `createLLMCall(defaultModel?, defaultTemperature?): Function`

Creates a configured LLM call function with default parameters.

**Parameters:**
- `defaultModel?: string` - Default model to use
- `defaultTemperature?: number` - Default temperature

**Returns:**
A function with the same signature as `llmCall` but with defaults applied.

## Environment Variables

```bash
OPENAI_API_KEY=sk-...  # Required
```

## Testing

Run the test suite:

```bash
# Set your API key
export OPENAI_API_KEY="sk-..."

# Run tests
npx tsx src/llm/test-direct-openai.ts
```

## Error Handling

The wrapper includes comprehensive error handling:

```typescript
try {
  const response = await llmCall({
    messages: [{ role: 'user', content: 'Hello' }]
  });
  console.log(response.content);
} catch (error) {
  if (error.message.includes('OPENAI_API_KEY')) {
    console.error('API key not set');
  } else if (error.message.includes('API call failed')) {
    console.error('OpenAI API error:', error.message);
  }
}
```

## Comparison with @adaptic/lumic-utils

| Feature | direct-openai | @adaptic/lumic-utils |
|---------|---------------|----------------------|
| Setup complexity | Simple | More complex |
| Dependencies | openai only | Multiple |
| API surface | Minimal | Full-featured |
| Use case | Backup/simple | Primary/advanced |

## Migration from other wrappers

```typescript
// Before (hypothetical wrapper)
const response = await someWrapper.call({
  prompt: 'Hello',
  model: 'gpt-4'
});

// After (direct-openai)
const response = await llmCall({
  messages: [{ role: 'user', content: 'Hello' }],
  model: 'gpt-4'
});
```

## License

MIT - Part of @wundr.io/orchestrator-daemon
