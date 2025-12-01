# Conversational Wizard GPT-4o-mini Integration

## Overview

This document describes the integration of OpenAI's `gpt-4o-mini` model into the Neolith
conversational wizard system. The wizards provide LLM-powered conversational interfaces for creating
and modifying organizational entities.

## Implementation Summary

### Date: 2025-11-30

### Status: Complete ✅

## Changes Made

### 1. API Routes Updated

All wizard API routes now support `gpt-4o-mini` as the default OpenAI model:

#### `/app/api/wizard/chat/route.ts`

- Updated `callOpenAI()` function to use `process.env.OPENAI_MODEL || 'gpt-4o-mini'`
- Supports conversational entity creation with natural language
- Implements function calling for structured data extraction

#### `/app/api/wizard/extract/route.ts`

- Updated `extractWithOpenAI()` function to use `process.env.OPENAI_MODEL || 'gpt-4o-mini'`
- Analyzes conversation history and extracts structured entity data
- Uses JSON mode for reliable structured output

#### `/app/api/wizard/modify/route.ts`

- Updated `callOpenAI()` function to use `process.env.OPENAI_MODEL || 'gpt-4o-mini'`
- Processes modification requests for existing entities
- Generates structured diffs with reasoning

#### `/app/api/creation/conversation/route.ts`

- Updated `callOpenAIStreaming()` function to use `process.env.OPENAI_MODEL || 'gpt-4o-mini'`
- Provides streaming conversational interface for entity creation
- Supports real-time AI responses

### 2. Environment Configuration

Added new environment variable `OPENAI_MODEL` for configuring the OpenAI model:

#### `.env.example`

```bash
# OpenAI Model (when using OpenAI as provider)
# Default: gpt-4o-mini for cost-effective conversational wizards
OPENAI_MODEL=gpt-4o-mini
```

#### `.env.production.template`

```bash
# OpenAI Model (when using OpenAI as provider)
# Default: gpt-4o-mini for cost-effective conversational wizards
OPENAI_MODEL=gpt-4o-mini
```

## Supported Wizards

### 1. Workspace Creation Wizard

- **Path**: `/components/org-genesis/org-genesis-wizard.tsx`
- **API**: `/api/workspaces/generate-org`
- **Features**: Multi-step organization setup with conversational guidance

### 2. Entity Creation Wizard

- **Component**: `/components/wizard/conversational-wizard.tsx`
- **API**: `/api/wizard/chat`, `/api/wizard/extract`
- **Supported Entities**:
  - Workspace (organization)
  - Orchestrator (autonomous agent)
  - Session Manager (contextual agent)
  - Subagent (task-specific worker)
  - Workflow (automated process)
  - Channel (communication space)

### 3. Entity Modification Wizard

- **Component**: `/components/wizard/entity-modifier.tsx`
- **API**: `/api/wizard/modify`
- **Features**: Conversational entity editing with structured diffs

## Wizard Features

### Context-Aware Suggestions

- LLM analyzes user input and conversation history
- Provides intelligent suggestions based on context
- Asks clarifying questions when needed

### Natural Language Processing

- Understands conversational requests
- Extracts structured data from natural language
- Handles ambiguous or incomplete input gracefully

### Intelligent Form Filling

- Auto-populates form fields from conversation
- Validates extracted data against schemas
- Allows manual editing in form view

### Conversational Guidance

- Guides users through entity creation step-by-step
- Explains requirements and options
- Adapts to user's expertise level

### Help/FAQ Responses

- Answers questions about entity types
- Provides examples and best practices
- Suggests related features

## Wizard Architecture

### State Management

The wizard uses a centralized context for state management:

**Location**: `/contexts/wizard-context.tsx`

**Features**:

- Tracks conversation history
- Manages extracted data
- Handles mode switching (chat ↔ form)
- Saves/restores wizard progress via localStorage
- Validates completion status

**State Structure**:

```typescript
interface WizardState {
  entityType: 'agent' | 'deployment' | 'channel' | 'workflow' | null;
  mode: 'chat' | 'edit';
  messages: Message[];
  extractedData: ExtractedEntityData;
  isLoading: boolean;
  error: string | null;
  isDirty: boolean;
  conversationId: string | null;
}
```

### Hooks

#### `useWizardChat()` - `/hooks/use-wizard-chat.ts`

Manages chat communication with LLM API:

- Sends messages to `/api/wizard/chat`
- Handles streaming responses
- Updates extracted data
- Manages conversation ID
- Provides retry and cancel functionality

**Features**:

- Request cancellation (AbortController)
- Streaming support
- Error handling
- Automatic data extraction

#### `useWizardSuggestions()`

Fetches contextual suggestions from `/api/wizard/suggestions`:

- Based on current entity type
- Considers extracted data
- Updates as conversation progresses

#### `useWizardValidation()`

Validates extracted data:

- Calls `/api/wizard/validate`
- Returns validation errors
- Checks schema compliance

## UI Components

### Wizard Chat Interface

**Component**: `/components/wizard/chat-container.tsx`

- Message bubbles (user/assistant/system)
- Auto-scrolling
- Loading indicators
- Typing indicators

### Wizard Input

**Component**: `/components/wizard/chat-input.tsx`

- Text input with send button
- Keyboard shortcuts (Enter, Shift+Enter)
- Character counter
- File attachment support (future)

### Dual Mode Editor

**Component**: `/components/wizard/dual-mode-editor.tsx`

- Toggle between chat and form views
- Synchronized data between modes
- Visual mode indicator
- Smooth transitions

### Entity Review Form

**Component**: `/components/wizard/entity-review-form.tsx`

- Dynamic form generation based on entity type
- Field validation
- Error display
- Reset functionality

## Configuration

### Using OpenAI (gpt-4o-mini)

Set environment variables:

```bash
# Choose OpenAI as the provider
DEFAULT_LLM_PROVIDER=openai

# Set your OpenAI API key
OPENAI_API_KEY=sk-...

# Use gpt-4o-mini (default)
OPENAI_MODEL=gpt-4o-mini

# Configure generation parameters
DEFAULT_MAX_TOKENS=4096
DEFAULT_TEMPERATURE=0.7
```

### Using Anthropic Claude (Alternative)

```bash
# Choose Anthropic as the provider
DEFAULT_LLM_PROVIDER=anthropic

# Set your Anthropic API key
ANTHROPIC_API_KEY=sk-ant-...

# Set Claude model
DEFAULT_LLM_MODEL=claude-sonnet-4-20250514
```

### Fallback Behavior

If `DEFAULT_LLM_PROVIDER` is not set, the system will:

1. Try Anthropic if `ANTHROPIC_API_KEY` is set
2. Fall back to OpenAI if `OPENAI_API_KEY` is set
3. Return error if neither API key is configured

## System Prompts

Each entity type has a specialized system prompt that:

- Defines the entity's purpose and characteristics
- Lists required and optional fields
- Provides examples and guidelines
- Specifies when to extract data

Example for Orchestrator:

```
You are helping create a new ORCHESTRATOR (autonomous agent).

Required fields:
- name: Agent name (friendly, e.g., "Sarah the Support Lead")
- role: Primary role/discipline
- description: What this orchestrator does

Optional but recommended:
- capabilities: List of key capabilities
- goals: Primary objectives
- channels: Communication channels to monitor
- communicationStyle: How the agent communicates

When you have at least name, role, and description, call extract_entity with the data.
```

## Tool Definitions

The wizards use structured tool calling for data extraction:

```typescript
{
  name: 'extract_entity',
  description: 'Extract structured data from conversation',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Entity name' },
      description: { type: 'string', description: 'Entity description' },
      // ... entity-specific fields
    },
    required: ['name', 'description']
  }
}
```

## Response Format

### Chat API Response

```json
{
  "message": "Great! Let's create a workspace...",
  "extractedData": {
    "name": "Acme Corp",
    "description": "Software company",
    "teamSize": "medium"
  },
  "isComplete": false,
  "suggestedNextQuestion": "What departments do you need?"
}
```

### Extract API Response

```json
{
  "data": {
    "name": "Customer Support Agent",
    "role": "Support Lead",
    "description": "Handles customer inquiries",
    "capabilities": ["live chat", "email support"],
    "communicationStyle": "friendly"
  },
  "valid": true,
  "provider": "openai",
  "timestamp": "2025-11-30T12:00:00Z"
}
```

### Modify API Response

```json
{
  "message": "I'll rename the orchestrator for you.",
  "suggestedChanges": {
    "modifications": [
      {
        "field": "name",
        "oldValue": "Support Bot",
        "newValue": "Customer Success Agent",
        "reason": "User requested name change"
      }
    ],
    "summary": "Rename orchestrator",
    "reasoning": "Updated to better reflect the agent's role"
  },
  "needsMoreInfo": false
}
```

## Performance Considerations

### Why gpt-4o-mini?

1. **Cost-Effective**: 60-80% cheaper than GPT-4
2. **Fast Response**: Lower latency for better UX
3. **Sufficient Capability**: Excellent for structured extraction
4. **Scalable**: Handles high conversation volumes

### Optimization Tips

1. **Use Streaming**: Enable for real-time feedback
2. **Limit History**: Send only last 5 messages for context
3. **Temperature**: Use 0.7 for creativity, 0 for extraction
4. **Max Tokens**: Set to 4096 (sufficient for most wizards)

## Testing

### Manual Testing

1. Set environment variables:

   ```bash
   DEFAULT_LLM_PROVIDER=openai
   OPENAI_API_KEY=your-key
   OPENAI_MODEL=gpt-4o-mini
   ```

2. Start the development server:

   ```bash
   npm run dev
   ```

3. Navigate to wizard interface and test:
   - Entity creation flow
   - Data extraction accuracy
   - Form synchronization
   - Error handling

### Integration Tests

Test files located in:

- `/apps/web/tests/full-flow-integration.spec.ts`
- `/apps/web/tests/workflows.spec.ts`

## Migration from Claude

To migrate from Claude to GPT-4o-mini:

1. **Update environment**:

   ```bash
   DEFAULT_LLM_PROVIDER=openai
   OPENAI_MODEL=gpt-4o-mini
   ```

2. **No code changes required** - API routes support both providers

3. **Test entity creation** to verify compatibility

4. **Monitor costs** - GPT-4o-mini is significantly cheaper

## Limitations

1. **Function Calling**: gpt-4o-mini supports function calling, but may be less reliable than GPT-4
   for complex schemas
2. **Context Window**: 128k tokens (same as Claude Sonnet 4)
3. **Rate Limits**: Standard OpenAI rate limits apply

## Future Enhancements

### Planned Features

1. **Multi-turn Conversations**: Better context retention
2. **Conversation Branching**: Allow users to explore alternatives
3. **Voice Input**: Speech-to-text integration
4. **Multi-language**: Support for non-English conversations
5. **Suggested Prompts**: Quick action buttons for common requests
6. **Conversation Templates**: Pre-built conversation flows
7. **Export/Import**: Save and share wizard configurations

### Experimental Features

1. **Vision Support**: Analyze screenshots for entity design
2. **Code Generation**: Generate automation scripts
3. **Collaborative Wizards**: Multi-user entity creation
4. **AI Suggestions**: Proactive recommendations

## Troubleshooting

### Common Issues

**Issue**: "No LLM API key configured"

- **Solution**: Set `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`

**Issue**: Slow responses

- **Solution**: Switch to `gpt-4o-mini` or enable streaming

**Issue**: Extraction failures

- **Solution**: Check schema definitions, use temperature=0

**Issue**: Invalid JSON in function calls

- **Solution**: Update prompts to be more specific

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug
```

Check API responses in browser console and server logs.

## Resources

- [OpenAI GPT-4o-mini Documentation](https://platform.openai.com/docs/models/gpt-4o-mini)
- [Function Calling Guide](https://platform.openai.com/docs/guides/function-calling)
- [Wizard Components README](../apps/web/components/wizard/README.md)
- [Neolith Architecture](./ARCHITECTURE.md)

## Support

For issues or questions:

1. Check this documentation
2. Review component README files
3. Check API route documentation
4. Submit GitHub issue with wizard logs

---

**Last Updated**: 2025-11-30 **Version**: 1.0.0 **Status**: Production Ready ✅
