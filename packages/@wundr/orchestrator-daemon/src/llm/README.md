# LLM Client Implementation

Production-ready LLM client for the orchestrator-daemon using @adaptic/lumic-utils.

## Overview

The OpenAI client provides real LLM integration for agent orchestration and session management. It implements the `LLMClient` interface from `@wundr.io/ai-integration` and uses `@adaptic/lumic-utils` for making API calls.

## Features

- ✅ Real OpenAI API integration via lumic-utils
- ✅ Support for GPT-4o-mini and other OpenAI models
- ✅ Tool/function calling support
- ✅ Streaming responses (simulated via single chunk)
- ✅ Token usage tracking
- ✅ Comprehensive error handling
- ✅ Debug logging
- ✅ Token counting estimation

## Usage

### Basic Configuration

```typescript
import { createOpenAIClient } from './llm';

const client = createOpenAIClient({
  apiKey: process.env.OPENAI_API_KEY,
  defaultModel: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 4096,
  debug: true,
});
```

### Chat Completion

```typescript
const response = await client.chat({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Explain TypeScript in one sentence.' }
  ],
  temperature: 0.7,
  maxTokens: 100,
});

console.log(response.content);
console.log('Tokens used:', response.usage.totalTokens);
```

### With Tool Calling

```typescript
const response = await client.chat({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'user', content: 'What is the weather in San Francisco?' }
  ],
  tools: [
    {
      name: 'get_weather',
      description: 'Get the current weather for a location',
      inputSchema: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name' },
          unit: { type: 'string', enum: ['celsius', 'fahrenheit'] }
        },
        required: ['location']
      }
    }
  ]
});

if (response.toolCalls) {
  for (const toolCall of response.toolCalls) {
    console.log('Tool:', toolCall.name);
    console.log('Arguments:', toolCall.arguments);
  }
}
```

### Streaming

```typescript
const stream = client.chatStream({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'user', content: 'Write a short poem about AI.' }
  ],
});

for await (const chunk of stream) {
  process.stdout.write(chunk.delta);
  if (chunk.usage) {
    console.log('\nTokens:', chunk.usage.totalTokens);
  }
}
```

### Token Counting

```typescript
const count = await client.countTokens(
  'This is a test message',
  'gpt-4o-mini'
);
console.log('Estimated tokens:', count);
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | `undefined` | OpenAI API key (reads from env if not provided) |
| `defaultModel` | `string` | `'gpt-4o-mini'` | Default model to use for requests |
| `temperature` | `number` | `0.7` | Sampling temperature (0.0 - 2.0) |
| `maxTokens` | `number` | `4096` | Maximum tokens to generate |
| `debug` | `boolean` | `false` | Enable debug logging |

## Supported Models

Via @adaptic/lumic-utils:

- `gpt-5`
- `gpt-5-mini`
- `gpt-5-nano`
- `gpt-4.1`
- `gpt-4.1-mini`
- `gpt-4.1-nano`
- `gpt-4o`
- `gpt-4o-mini` (default)

## Error Handling

The client provides comprehensive error handling with specific error types:

```typescript
try {
  const response = await client.chat({ ... });
} catch (error) {
  if (error.message.includes('Authentication')) {
    console.error('Invalid API key');
  } else if (error.message.includes('Rate Limit')) {
    console.error('Rate limit exceeded');
  } else if (error.message.includes('Quota')) {
    console.error('Quota exceeded');
  } else {
    console.error('Unknown error:', error);
  }
}
```

## Integration with Orchestrator Daemon

The client is automatically initialized in the `OrchestratorDaemon`:

```typescript
// In orchestrator-daemon.ts
import { createOpenAIClient } from '../llm';

this.llmClient = createOpenAIClient({
  apiKey: process.env.OPENAI_API_KEY,
  defaultModel: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 4096,
  debug: this.config.verbose,
});
```

## Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...

# Optional (has defaults)
OPENAI_DEFAULT_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=4096
```

## Implementation Notes

1. **lumic-utils Integration**: Uses `lumic.llm.call()` from @adaptic/lumic-utils for all API calls
2. **Streaming**: Currently simulates streaming by returning the complete response as a single chunk
3. **Token Counting**: Uses a simple estimation (4 chars per token) - consider integrating tiktoken for production
4. **Message Context**: All messages except the last are passed as context to lumic-utils
5. **Tool Calls**: Properly handles both standard function calls and custom tool calls

## Future Enhancements

- [ ] Integrate tiktoken for accurate token counting
- [ ] Implement real streaming via lumic-utils streaming API (when available)
- [ ] Add retry logic with exponential backoff
- [ ] Add caching layer for repeated requests
- [ ] Support for vision models (image inputs)
- [ ] Support for other providers (Anthropic, etc.)

## Files

- `openai-client.ts` - Main implementation
- `index.ts` - Exports
- `README.md` - This file

## Testing

To test the client:

```typescript
import { createOpenAIClient } from '@wundr.io/orchestrator-daemon/dist/llm';

const client = createOpenAIClient({
  apiKey: process.env.OPENAI_API_KEY,
  debug: true,
});

const valid = await client.validateCredentials();
console.log('Credentials valid:', valid);

const models = await client.listModels();
console.log('Available models:', models);
```
