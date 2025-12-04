# Wizard API Endpoints

Conversational AI wizard for entity creation with Vercel AI SDK streaming support.

## Endpoints

### POST /api/wizard/chat (Streaming)

**NEW**: Upgraded to use Vercel AI SDK `streamText()` with `useChat` hook compatibility.

Streams AI responses for conversational entity creation with tool-based data extraction.

**Features:**

- Real-time streaming with SSE
- Tool calling for structured data extraction
- Compatible with Vercel AI SDK's `useChat` hook
- Supports both Anthropic and OpenAI models

**Request:**

```json
{
  "entityType": "workspace" | "orchestrator" | "session-manager" | "workflow",
  "messages": [
    { "role": "user", "content": "I want to create a new workspace" }
  ]
}
```

**Response:** Streaming text with tool calls (SSE format)

**Tools Available:**

- `extract_workspace`: Extracts workspace data
- `extract_orchestrator`: Extracts orchestrator data
- `extract_session_manager`: Extracts session manager data
- `extract_workflow`: Extracts workflow data

### POST /api/wizard/extract

Analyzes full conversation history and extracts structured entity data.

**Request:**

```json
{
  "entityType": "workspace",
  "conversationHistory": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**Response:**

```json
{
  "data": { "name": "...", "description": "..." },
  "valid": true,
  "provider": "anthropic",
  "timestamp": "2025-12-04T..."
}
```

### POST /api/wizard/create

Creates the entity in the database after data extraction.

**Implementations:**

- **workspace**: Creates workspace with organization membership
- **orchestrator**: Creates orchestrator with user and capabilities
- **session-manager**: Creates session manager linked to orchestrator
- **workflow**: Creates workflow with trigger and steps

**Request:**

```json
{
  "entityType": "workspace",
  "data": {
    "name": "Acme Corp",
    "description": "A technology company",
    "organizationType": "technology",
    "teamSize": "medium"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "...",
    "name": "Acme Corp",
    "type": "workspace",
    "slug": "acme-corp"
  },
  "timestamp": "2025-12-04T..."
}
```

## System Prompts

Located in `/lib/ai/prompts.ts`:

- Entity-specific prompts for each creation type
- Friendly, conversational guidance
- Structured data extraction instructions

## Dependencies

- `ai@^5.0.106`: Vercel AI SDK
- `@ai-sdk/anthropic@^2.0.53`: Anthropic provider
- `@ai-sdk/openai@^2.0.77`: OpenAI provider
- `zod@^3.25.76`: Schema validation

## Environment Variables

```bash
# LLM Provider Selection
DEFAULT_LLM_PROVIDER=anthropic  # or "openai"
DEFAULT_LLM_MODEL=claude-sonnet-4-20250514
OPENAI_MODEL=gpt-4o

# API Keys
ANTHROPIC_API_KEY=sk-...
OPENAI_API_KEY=sk-...

# Model Settings
DEFAULT_TEMPERATURE=0.7
DEFAULT_MAX_TOKENS=4096
```

## Usage with useChat Hook

```typescript
import { useChat } from 'ai/react';

const { messages, input, handleInputChange, handleSubmit } = useChat({
  api: '/api/wizard/chat',
  body: {
    entityType: 'workspace',
  },
});
```

## Error Handling

All endpoints include comprehensive error handling:

- **400**: Validation errors (Zod)
- **401**: Authentication required
- **403**: Access denied
- **404**: Resource not found
- **409**: Duplicate entity
- **422**: Data validation failed
- **500**: Internal server error

## Notes

- The streaming endpoint uses `toTextStreamResponse()` for compatibility
- Tools are defined without execute functions (handled by AI SDK)
- All entities require proper organization/workspace membership
- Prisma schema fields must match exactly (no `ownerId`, use `createdBy`, etc.)
