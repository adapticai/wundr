# Workflow AI Assistant - Usage Guide

## Overview

The Workflow AI Assistant is a fully functional AI-powered component that helps users create,
optimize, and troubleshoot workflows using natural language processing.

## Features

### 1. Natural Language Workflow Creation

Users can describe workflows in plain English, and the AI will parse them into structured workflow
configurations.

**Example:**

```
User: "When a message is received in #support, assign to on-call engineer"

AI Response: Creates workflow with:
- Trigger: message (channelIds: ['support'])
- Action: notify_orchestrator (orchestratorId: 'on-call-engineer')
```

### 2. Workflow Optimization Suggestions

The AI analyzes existing workflows and suggests improvements for:

- **Performance**: Reduce execution time, optimize actions
- **Reliability**: Add error handling, retry logic
- **Best Practices**: Use proper naming, add documentation

**Example suggestions:**

```json
{
  "type": "reliability",
  "title": "Add error handling to HTTP request",
  "description": "The HTTP request action lacks retry logic. Add 3 retries with exponential backoff.",
  "impact": "high"
}
```

### 3. Error Diagnosis

When workflows fail, the AI provides:

- **Root cause analysis**: What went wrong
- **Solution**: How to fix it
- **Prevention tips**: How to avoid it in the future

**Example diagnosis:**

```json
{
  "cause": "HTTP request timed out after 30 seconds",
  "solution": "Increase timeout to 60 seconds or add retry logic",
  "preventionTips": [
    "Set reasonable timeout values based on external service SLA",
    "Implement circuit breaker pattern for external APIs",
    "Add monitoring alerts for timeout patterns"
  ]
}
```

### 4. Step Recommendations

The AI suggests additional steps to enhance workflows based on:

- Current workflow structure
- Common patterns
- Best practices

**Example recommendations:**

```json
{
  "stepType": "wait",
  "reason": "Add a delay before retry to prevent overwhelming the API",
  "configuration": {
    "duration": 5,
    "unit": "seconds"
  }
}
```

## Component Integration

### Basic Usage

```tsx
import { WorkflowAIAssistant } from '@/components/workflow/workflow-ai-assistant';

function WorkflowPage() {
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsAssistantOpen(true)}>Open AI Assistant</Button>

      <WorkflowAIAssistant
        workspaceSlug='my-workspace'
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
      />
    </>
  );
}
```

### With Workflow Context

```tsx
<WorkflowAIAssistant
  workspaceSlug='my-workspace'
  workflow={currentWorkflow}
  isOpen={isAssistantOpen}
  onClose={() => setIsAssistantOpen(false)}
  onWorkflowUpdate={updates => {
    // Handle workflow updates suggested by AI
    updateWorkflow(updates);
  }}
/>
```

### With Execution Context (Error Diagnosis)

```tsx
<WorkflowAIAssistant
  workspaceSlug='my-workspace'
  workflow={currentWorkflow}
  execution={failedExecution}
  isOpen={isAssistantOpen}
  onClose={() => setIsAssistantOpen(false)}
/>
```

## API Endpoint

### Endpoint: `/api/workspaces/[workspaceSlug]/workflows/ai`

**Method:** POST

**Request Body:**

```json
{
  "messages": [
    {
      "role": "user",
      "content": "When a message is received in #support, assign to on-call engineer"
    }
  ],
  "action": "chat",
  "workflowId": "wf_123", // Optional
  "executionId": "exec_456" // Optional
}
```

**Response:** Streaming text with tool calls

### Tool Calls

The API uses structured tool calling for precise extraction:

#### 1. `create_workflow`

Extracts workflow structure from natural language.

```json
{
  "name": "Support Message Assignment",
  "description": "Automatically assigns support messages to on-call engineer",
  "trigger": {
    "type": "message",
    "config": {
      "channelIds": ["support"]
    }
  },
  "actions": [
    {
      "type": "notify_orchestrator",
      "config": {
        "orchestratorId": "on-call-engineer",
        "message": "New support message: {{trigger.message.content}}"
      },
      "order": 0
    }
  ]
}
```

#### 2. `suggest_optimizations`

Provides optimization suggestions.

```json
{
  "suggestions": [
    {
      "type": "performance",
      "title": "Use condition to filter urgent messages",
      "description": "Add a condition to only notify for urgent messages",
      "impact": "medium"
    }
  ]
}
```

#### 3. `diagnose_error`

Analyzes execution errors.

```json
{
  "cause": "Channel not found",
  "solution": "Verify the channel exists and the bot has access",
  "preventionTips": [
    "Validate channel existence before workflow execution",
    "Add error handling for missing channels"
  ]
}
```

#### 4. `recommend_steps`

Suggests additional workflow steps.

```json
{
  "recommendations": [
    {
      "stepType": "send_message",
      "reason": "Notify the channel that the message was forwarded",
      "configuration": {
        "channelId": "support",
        "message": "✅ Your message has been forwarded to the on-call engineer"
      }
    }
  ]
}
```

## Natural Language Parser

The system includes a comprehensive natural language parser for common workflow patterns.

### Trigger Detection

```typescript
import { detectTriggerType, parseTriggerFromText } from '@/lib/workflow/natural-language-parser';

const text = 'When a message is posted in #support';
const triggerType = detectTriggerType(text); // "message"
const trigger = parseTriggerFromText(text);
// { type: "message", message: { channelIds: ["support"] } }
```

### Action Detection

```typescript
import { detectActionTypes, suggestActionsFromText } from '@/lib/workflow/natural-language-parser';

const text = 'Send a message to #general and notify @admin';
const actions = detectActionTypes(text); // ["send_message", "send_dm"]
const suggestions = suggestActionsFromText(text);
// [
//   { type: "send_message", suggestedConfig: { channelId: "general" } },
//   { type: "send_dm", suggestedConfig: { userId: "admin" } }
// ]
```

### Schedule Extraction

```typescript
import { extractSchedule } from '@/lib/workflow/natural-language-parser';

const text = 'Every day at 9:00 AM';
const schedule = extractSchedule(text);
// { cron: "0 9 * * *", description: "Daily at 9:00 AM" }
```

### Confidence Scoring

```typescript
import { analyzeWorkflowDescription } from '@/lib/workflow/natural-language-parser';

const analysis = analyzeWorkflowDescription(
  'When a message is posted in #support, send a DM to @admin'
);
// {
//   confidence: 1.0,
//   hasTrigger: true,
//   hasActions: true,
//   missingElements: [],
//   suggestions: []
// }
```

## Example Interactions

### Creating a Welcome Workflow

**User:** "When a new user joins, send them a welcome message in #general"

**AI Response:**

```
I'll help you create a welcome workflow. Here's what I understand:

Trigger: New user joins the workspace
Action: Send welcome message to #general channel

Would you like me to:
1. Customize the welcome message?
2. Add a direct message to the new user?
3. Invite them to specific channels?
```

**User:** "Add a DM with onboarding instructions"

**AI Response:** _(Creates workflow with tool call)_

```json
{
  "name": "New User Welcome",
  "trigger": { "type": "user_join" },
  "actions": [
    {
      "type": "send_message",
      "config": {
        "channelId": "general",
        "message": "Welcome {{trigger.user.name}} to the team! 👋"
      },
      "order": 0
    },
    {
      "type": "send_dm",
      "config": {
        "userId": "{{trigger.user.id}}",
        "message": "Welcome! Here's how to get started..."
      },
      "order": 1
    }
  ]
}
```

### Optimizing an Existing Workflow

**User:** "Optimize this workflow"

**AI Response:** _(Analyzes and provides suggestions)_

```
I've analyzed your workflow and found 3 optimization opportunities:

1. **Add error handling** (High Impact)
   - Your HTTP request lacks retry logic
   - Recommendation: Add 3 retries with exponential backoff

2. **Improve performance** (Medium Impact)
   - Add a condition to filter messages
   - This will reduce unnecessary executions by ~60%

3. **Best practice** (Low Impact)
   - Add descriptive names to actions
   - This improves maintainability

Would you like me to apply these optimizations?
```

### Diagnosing Errors

**User:** "Why did the last execution fail?"

**AI Response:** _(Analyzes execution logs)_

```
I've diagnosed the issue:

**Root Cause:**
The HTTP request to api.example.com timed out after 30 seconds.

**Solution:**
1. Increase the timeout to 60 seconds
2. Or implement retry logic with exponential backoff
3. Consider adding a circuit breaker if the service is frequently down

**Prevention Tips:**
- Monitor external API health before making requests
- Set up alerts for timeout patterns
- Implement fallback actions for critical workflows

Would you like me to update the workflow with these improvements?
```

## Best Practices

1. **Be Specific**: Include channel names, user mentions, and specific triggers
2. **Iterate**: Start simple, then ask the AI to enhance the workflow
3. **Review**: Always review AI-generated workflows before activating them
4. **Context**: Provide workflow and execution context for better suggestions
5. **Test**: Use the AI to identify edge cases and error scenarios

## Supported Patterns

### Triggers

- Schedule (cron-based)
- Message events
- Keyword detection
- Channel membership changes
- User joins
- Reactions
- Mentions
- Webhooks

### Actions

- Send messages
- Direct messages
- Create channels
- Invite users
- Assign roles
- Add reactions
- HTTP requests
- Wait/delay
- Conditional branching
- Notify orchestrators

## Limitations

1. **Complex Logic**: Very complex conditional logic may require manual configuration
2. **Custom Integrations**: Specific third-party integrations may need manual setup
3. **Rate Limits**: AI requests are subject to OpenAI rate limits
4. **Context Size**: Very large workflows may exceed context window

## Future Enhancements

- [ ] Multi-turn workflow refinement
- [ ] Workflow templates generation
- [ ] Performance analytics and insights
- [ ] A/B testing suggestions
- [ ] Workflow versioning recommendations
- [ ] Integration-specific optimizations
