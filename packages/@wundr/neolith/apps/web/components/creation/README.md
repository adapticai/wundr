# Conversational Creation Components

Reusable components for creating entities (Orchestrators, Workflows, Channels, etc.) via conversational interfaces powered by LLM.

## Components

### ConversationalCreator

Main component that provides a chat-based interface for entity creation.

**Features:**
- Chat message list (user and AI messages)
- Text input with send button
- Streaming response display
- "Switch to Form View" button
- Loading states
- Error handling

**Usage:**

```typescript
import { ConversationalCreator } from '@/components/creation';
import type { EntitySpec } from '@/components/creation';

function CreateOrchestratorDialog() {
  const [showChat, setShowChat] = useState(true);

  const handleSpecGenerated = (spec: EntitySpec) => {
    console.log('Generated spec:', spec);
    // Switch to form view with pre-filled data
    setShowChat(false);
  };

  return (
    <ConversationalCreator
      entityType="orchestrator"
      workspaceId="workspace-123"
      onSpecGenerated={handleSpecGenerated}
      onCancel={() => setShowChat(false)}
      open={showChat}
    />
  );
}
```

## Entity Types

Supported entity types:
- `workspace` - Create a new workspace
- `orchestrator` - Create a new orchestrator (VP)
- `session-manager` - Create a new session manager
- `subagent` - Create a new subagent
- `workflow` - Create a new workflow
- `channel` - Create a new channel

## Hooks

### useConversationalCreation

Hook for managing conversational creation state and API calls.

```typescript
const {
  sendMessage,
  isLoading,
  error,
  generatedSpec,
  hasGeneratedSpec,
  workspaceContext,
} = useConversationalCreation({
  entityType: 'orchestrator',
  workspaceId: 'workspace-123',
  onSpecGenerated: (spec) => console.log(spec),
});
```

## API Integration

The component expects a POST endpoint at `/api/creation/conversation`:

**Request:**
```json
{
  "entityType": "orchestrator",
  "messages": [
    { "id": "1", "role": "user", "content": "...", "timestamp": "..." },
    { "id": "2", "role": "assistant", "content": "...", "timestamp": "..." }
  ],
  "workspaceContext": {
    "id": "workspace-123",
    "name": "My Workspace",
    "orchestrators": [...],
    "channels": [...]
  },
  "existingSpec": { ... }
}
```

**Response:**
```json
{
  "message": "Great! Let me ask a few questions...",
  "spec": {
    "entityType": "orchestrator",
    "name": "Support Agent Sarah",
    "role": "Customer Support Lead",
    "confidence": 0.8,
    "missingFields": [],
    "suggestions": [...]
  },
  "shouldGenerateSpec": true
}
```

## Types

See `types.ts` for complete type definitions:
- `EntityType` - Supported entity types
- `EntitySpec` - Generated specification structure
- `ChatMessage` - Message format
- `WorkspaceContext` - Context data
- `ConversationRequest` - API request format
- `ConversationResponse` - API response format

## Implementation Status

- ✅ Core component created
- ✅ Types defined
- ✅ Hook implemented
- ✅ Export configured
- ⏳ API endpoint (needs implementation)
- ⏳ Integration with form view (pending)
- ⏳ LLM system prompts (pending)
