# Workflow AI Assistant - Quick Start Guide

## What You Get

A fully functional AI-powered workflow assistant that:

- Creates workflows from natural language
- Suggests optimizations
- Diagnoses errors
- Recommends steps

## Files Created

1. **Component** (`components/workflow/workflow-ai-assistant.tsx`) - 20KB
   - React component with shadcn/ai useChat integration
   - Handles all AI interactions and displays results
   - Fully typed with TypeScript

2. **API Route** (`app/api/workspaces/[workspaceSlug]/workflows/ai/route.ts`) - 11KB
   - Streaming AI endpoint using Vercel AI SDK
   - Four structured tools for workflow operations
   - Full authentication and workspace validation

3. **Natural Language Parser** (`lib/workflow/natural-language-parser.ts`) - 11KB
   - Regex-based pattern matching for common workflow patterns
   - Extracts triggers, actions, schedules, and more
   - Confidence scoring and validation

4. **Tests** (`components/workflow/__tests__/workflow-ai-assistant.test.tsx`) - 4KB
   - Component unit tests
   - Mock AI interactions
   - User interaction tests

5. **Documentation** (`docs/workflow-ai-assistant-usage.md`) - 10KB
   - Complete usage guide with examples
   - API documentation
   - Best practices

## Quick Integration

### 1. Add to Workflow Builder Page

```tsx
import { WorkflowAIAssistant } from '@/components/workflow/workflow-ai-assistant';

export default function WorkflowBuilderPage() {
  const [isAIOpen, setIsAIOpen] = useState(false);
  const { workspaceSlug } = useParams();

  return (
    <div className='flex h-screen'>
      {/* Main workflow builder */}
      <div className='flex-1'>
        <Button onClick={() => setIsAIOpen(true)}>
          <Bot className='h-4 w-4 mr-2' />
          Open AI Assistant
        </Button>
        {/* Your workflow canvas */}
      </div>

      {/* AI Assistant */}
      <WorkflowAIAssistant
        workspaceSlug={workspaceSlug}
        isOpen={isAIOpen}
        onClose={() => setIsAIOpen(false)}
        onWorkflowCreate={workflow => {
          // Handle new workflow from AI
          createWorkflow(workflow);
        }}
      />
    </div>
  );
}
```

### 2. Add to Workflow Detail Page (with context)

```tsx
<WorkflowAIAssistant
  workspaceSlug={workspaceSlug}
  workflow={workflow} // Current workflow for optimization
  execution={lastExecution} // Latest execution for error diagnosis
  isOpen={isAIOpen}
  onClose={() => setIsAIOpen(false)}
  onWorkflowUpdate={updates => {
    updateWorkflow(updates);
  }}
/>
```

## Natural Language Examples

### Creating Workflows

```
✅ "When a message is received in #support, assign to on-call engineer"
✅ "Every day at 9am, send a summary to #general"
✅ "When someone joins #engineering, send them a welcome DM"
✅ "If a message contains 'urgent', notify @admin immediately"
```

### Optimizing Workflows

```
✅ "Optimize this workflow for performance"
✅ "What's wrong with my workflow?"
✅ "How can I make this more reliable?"
✅ "Suggest improvements"
```

### Diagnosing Errors

```
✅ "Why did the last execution fail?"
✅ "Diagnose the timeout error"
✅ "What caused this failure?"
```

### Getting Recommendations

```
✅ "What steps should I add?"
✅ "Suggest error handling"
✅ "How can I improve this?"
```

## Natural Language Parser (Standalone)

You can also use the parser directly without AI:

```typescript
import {
  detectTriggerType,
  detectActionTypes,
  parseTriggerFromText,
  suggestActionsFromText,
  extractSchedule,
  analyzeWorkflowDescription,
} from '@/lib/workflow/natural-language-parser';

// Detect patterns
const text = 'When a message is posted in #support at 9am';
const trigger = detectTriggerType(text); // "message"
const actions = detectActionTypes(text); // []
const schedule = extractSchedule(text); // { cron: "0 9 * * *", ... }

// Analyze confidence
const analysis = analyzeWorkflowDescription(text);
console.log(analysis.confidence); // 0.5-1.0
console.log(analysis.suggestions); // Array of what's missing
```

## API Endpoint

### POST `/api/workspaces/[workspaceSlug]/workflows/ai`

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**

```json
{
  "messages": [{ "role": "user", "content": "Create a welcome workflow" }],
  "workflowId": "optional-workflow-id",
  "executionId": "optional-execution-id"
}
```

**Response:** Streaming text with tool calls

## Tool Calls (Structured Outputs)

The AI uses 4 structured tools:

### 1. `create_workflow`

```json
{
  "name": "Workflow Name",
  "description": "What it does",
  "trigger": { "type": "message", "config": {...} },
  "actions": [...]
}
```

### 2. `suggest_optimizations`

```json
{
  "suggestions": [
    {
      "type": "performance",
      "title": "...",
      "description": "...",
      "impact": "high"
    }
  ]
}
```

### 3. `diagnose_error`

```json
{
  "cause": "Root cause",
  "solution": "How to fix",
  "preventionTips": ["Tip 1", "Tip 2"]
}
```

### 4. `recommend_steps`

```json
{
  "recommendations": [
    {
      "stepType": "wait",
      "reason": "Why add this",
      "configuration": {...}
    }
  ]
}
```

## Environment Variables

Required:

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini # Default, supports tool calling
```

Optional:

```bash
DEFAULT_LLM_PROVIDER=openai # Used by other endpoints
```

## Features Implemented

- [x] Natural language workflow creation
- [x] Workflow optimization suggestions
- [x] Error diagnosis and troubleshooting
- [x] Step recommendations
- [x] Conversational interface with useChat
- [x] Parse natural language into workflow steps
- [x] Context-aware suggestions (workflow + execution)
- [x] Quick action buttons
- [x] Collapsible sections for different AI features
- [x] Loading states and error handling
- [x] Type-safe with full TypeScript support
- [x] Authenticated API with workspace validation
- [x] Streaming responses with tool calling
- [x] Comprehensive pattern matching library
- [x] Unit tests for component
- [x] Full documentation

## Build Verification

```bash
cd /Users/granfar/wundr/packages/@wundr/neolith/apps/web
npm run typecheck  # ✓ No errors in new files
npm run build      # ✓ Compiled successfully
```

## Next Steps

1. **Add to UI**: Integrate the component into your workflow pages
2. **Customize Prompts**: Adjust system prompts in the API route for your use case
3. **Add More Patterns**: Extend natural-language-parser.ts with domain-specific patterns
4. **Monitor Usage**: Add analytics to track AI interactions
5. **Fine-tune**: Adjust tool schemas based on user feedback

## Support

For issues or questions:

- See full documentation: `docs/workflow-ai-assistant-usage.md`
- Check natural language parser: `lib/workflow/natural-language-parser.ts`
- Review API implementation: `app/api/workspaces/[workspaceSlug]/workflows/ai/route.ts`
