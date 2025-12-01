# @wundr.io/autogen-orchestrator

AutoGen-style conversational multi-agent orchestration for the Wundr platform. This package
implements sophisticated patterns for coordinating multiple AI agents in group chat settings with
configurable speaker selection, termination conditions, and nested chat support.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [Agent Conversation Patterns](#agent-conversation-patterns)
- [Group Chat Management](#group-chat-management)
- [Speaker Selection](#speaker-selection)
- [Message Routing](#message-routing)
- [Conversation History Tracking](#conversation-history-tracking)
- [Termination Handling](#termination-handling)
- [Nested Chats](#nested-chats)
- [Integration with Other Orchestrators](#integration-with-other-orchestrators)
- [API Reference](#api-reference)
- [Examples](#examples)

## Installation

```bash
npm install @wundr.io/autogen-orchestrator
# or
yarn add @wundr.io/autogen-orchestrator
# or
pnpm add @wundr.io/autogen-orchestrator
```

## Quick Start

```typescript
import {
  GroupChatManager,
  GroupChatBuilder,
  createParticipant,
  TerminationPresets,
} from '@wundr.io/autogen-orchestrator';

// Create participants
const analyst = createParticipant(
  'Analyst',
  'You are a data analyst specializing in market research.',
  ['analysis', 'research', 'data']
);

const developer = createParticipant('Developer', 'You are a senior software developer.', [
  'coding',
  'architecture',
  'debugging',
]);

const reviewer = createParticipant(
  'Reviewer',
  'You are a code reviewer ensuring quality standards.',
  ['review', 'testing', 'quality']
);

// Build and configure the group chat
const chat = new GroupChatBuilder()
  .withName('Project Discussion')
  .withDescription('Multi-agent collaboration for project planning')
  .withParticipant(analyst)
  .withParticipant(developer)
  .withParticipant(reviewer)
  .withSpeakerSelection('round_robin')
  .withMaxRounds(10)
  .withTerminationCondition(TerminationPresets.taskCompletion())
  .build();

// Set up response generator (integrate with your LLM provider)
chat.setResponseGenerator(async (participant, messages, context) => {
  // Your LLM integration here
  return `Response from ${participant.name}`;
});

// Start the conversation
const result = await chat.start({
  initialMessage: 'Let us discuss the project requirements.',
  initialSender: 'user',
});

console.log('Chat completed:', result.summary);
```

## Core Concepts

### Participants

Participants represent agents in the conversation. Each participant has:

- **name**: Unique identifier in the chat
- **type**: `'human'` | `'assistant'` | `'agent'` | `'tool'`
- **systemPrompt**: Instructions defining behavior
- **capabilities**: Skills/expertise areas
- **status**: Current state (`'active'` | `'idle'` | `'busy'` | `'offline'` | `'error'`)

```typescript
import { ChatParticipant, createParticipant } from '@wundr.io/autogen-orchestrator';

// Simple creation
const agent = createParticipant(
  'ResearchAgent',
  'You conduct thorough research and provide citations.',
  ['research', 'citations', 'fact-checking']
);

// Full configuration
const advancedAgent: ChatParticipant = {
  id: 'agent-001',
  name: 'AdvancedAgent',
  type: 'agent',
  systemPrompt: 'You are an expert in financial analysis.',
  status: 'active',
  capabilities: ['finance', 'analysis', 'forecasting'],
  modelConfig: {
    model: 'claude-3-opus',
    temperature: 0.7,
    maxTokens: 4096,
  },
  maxConsecutiveReplies: 3,
  description: 'Financial analysis specialist',
};
```

### Messages

Messages track the conversation flow:

```typescript
import { Message, MessageRole, ContentType } from '@wundr.io/autogen-orchestrator';

// Message structure
interface Message {
  id: string;
  role: MessageRole; // 'system' | 'user' | 'assistant' | 'function'
  content: string;
  name: string; // Sender name
  timestamp: Date;
  contentType?: ContentType; // 'text' | 'code' | 'image' | 'function_call' | 'function_result'
  functionCall?: FunctionCall;
  metadata?: MessageMetadata;
  status?: MessageStatus;
}
```

### Context

The `ChatContext` provides state throughout the conversation:

```typescript
interface ChatContext {
  chatId: string;
  currentRound: number;
  messageCount: number;
  activeParticipants: string[];
  currentSpeaker?: string;
  previousSpeaker?: string;
  startTime: Date;
  state: Record<string, unknown>; // Custom state storage
  parentContext?: ChatContext; // For nested chats
}
```

## Agent Conversation Patterns

### Round-Robin Conversations

Each participant speaks in order:

```typescript
const chat = new GroupChatBuilder()
  .withName('Round Robin Discussion')
  .withParticipant(agent1)
  .withParticipant(agent2)
  .withParticipant(agent3)
  .withSpeakerSelection('round_robin')
  .withMaxRounds(5)
  .build();
```

### Priority-Based Conversations

Agents speak based on configured priority:

```typescript
const chat = new GroupChatManager({
  name: 'Priority Discussion',
  participants: [leader, specialist, assistant],
  speakerSelectionMethod: 'priority',
  speakerSelectionConfig: {
    priorityOrder: ['Leader', 'Specialist', 'Assistant'],
    transitionRules: [
      { from: 'Leader', to: ['Specialist'], weight: 0.8 },
      { from: 'Specialist', to: ['Leader', 'Assistant'], weight: 0.5 },
    ],
    allowedTransitions: {
      Leader: ['Specialist', 'Assistant'],
      Specialist: ['Leader'],
      Assistant: ['Leader', 'Specialist'],
    },
  },
});
```

### LLM-Selected Speakers

Let an LLM decide who speaks next based on context:

```typescript
const chat = new GroupChatBuilder()
  .withName('Dynamic Discussion')
  .withParticipant(analyst)
  .withParticipant(developer)
  .withParticipant(designer)
  .withSpeakerSelection('llm_selected')
  .build();

// The LLM selector analyzes:
// - Recent message content
// - Participant capabilities
// - Conversation flow
// - Mentions of participant names
```

### Auto-Adaptive Selection

Automatically chooses the best selection strategy:

```typescript
const chat = new GroupChatBuilder().withSpeakerSelection('auto').build();

// Strategy selection logic:
// - Uses 'priority' if transition rules are configured
// - Uses 'llm' for complex conversations (>3 participants, >5 messages)
// - Uses 'llm' if participants have diverse capabilities
// - Defaults to 'round_robin' for simple cases
```

## Group Chat Management

### Creating a Group Chat

Using the builder pattern:

```typescript
import { GroupChatBuilder, TerminationPresets } from '@wundr.io/autogen-orchestrator';

const chat = new GroupChatBuilder()
  .withName('Code Review Session')
  .withDescription('Multi-agent code review and improvement')
  .withParticipant(codeWriter)
  .withParticipant(reviewer)
  .withParticipant(tester)
  .withSpeakerSelection('priority')
  .withMaxRounds(15)
  .withMaxMessages(50)
  .withTerminationCondition({ type: 'keyword', value: ['APPROVED', 'MERGED'] })
  .withTimeout(300000) // 5 minutes
  .withAdmin('moderator')
  .withNestedChats()
  .build();
```

Using direct configuration:

```typescript
import { GroupChatManager, GroupChatConfig } from '@wundr.io/autogen-orchestrator';

const config: GroupChatConfig = {
  name: 'Analysis Team',
  participants: [analyst, researcher, writer],
  speakerSelectionMethod: 'round_robin',
  maxRounds: 10,
  maxMessages: 100,
  terminationConditions: [
    { type: 'keyword', value: 'COMPLETE' },
    { type: 'max_rounds', value: 10 },
  ],
  enableHistory: true,
  maxHistoryLength: 500,
  timeoutMs: 600000,
};

const chat = new GroupChatManager(config);
```

### Managing Participants Dynamically

```typescript
// Add participant during chat
const newAgent = chat.addParticipant({
  name: 'ExpertConsultant',
  type: 'agent',
  systemPrompt: 'You provide expert consultation on complex issues.',
  capabilities: ['consulting', 'strategy'],
});

// Remove participant
chat.removeParticipant('ExpertConsultant');

// Update participant status
chat.updateParticipantStatus('Analyst', 'busy');

// Get all participants
const participants = chat.getParticipants();
```

### Chat Lifecycle

```typescript
// Start the chat
const result = await chat.start({
  initialMessage: 'Begin the analysis.',
  initialSender: 'user',
  initialState: { projectId: 'proj-123' },
});

// Pause and resume
chat.pause();
// ... some time later
chat.resume();

// Stop the chat
const finalResult = await chat.stop('User requested termination');

// Get current status
const status = chat.getStatus(); // 'initializing' | 'active' | 'paused' | 'completed' | 'terminated' | 'error'
```

### Event Handling

```typescript
import { GroupChatEvents } from '@wundr.io/autogen-orchestrator';

// Listen to chat events
chat.on('chat:started', ({ chatId, config }) => {
  console.log(`Chat ${chatId} started with ${config.participants.length} participants`);
});

chat.on('message:received', ({ chatId, message }) => {
  console.log(`[${message.name}]: ${message.content}`);
});

chat.on('speaker:selected', ({ chatId, speaker, reason }) => {
  console.log(`Next speaker: ${speaker} (${reason})`);
});

chat.on('round:started', ({ chatId, round }) => {
  console.log(`Starting round ${round}`);
});

chat.on('termination:triggered', ({ chatId, reason }) => {
  console.log(`Chat terminated: ${reason}`);
});

chat.on('chat:ended', ({ chatId, result }) => {
  console.log(`Chat ended. Total messages: ${result.totalMessages}`);
});

chat.on('chat:error', ({ chatId, error }) => {
  console.error(`Error in chat: ${error.message}`);
});
```

## Speaker Selection

### Available Strategies

```typescript
import {
  createSpeakerSelector,
  SpeakerSelectionManager,
  RoundRobinSelector,
  RandomSelector,
  LLMSelector,
  PrioritySelector,
  ManualSelector,
  AutoSelector,
} from '@wundr.io/autogen-orchestrator';

// Factory function
const selector = createSpeakerSelector('llm_selected');

// Using the manager
const manager = new SpeakerSelectionManager('round_robin');

// Select next speaker
const result = await manager.selectSpeaker(participants, messages, context, selectionConfig);

console.log(result);
// {
//   speaker: 'AnalystAgent',
//   reason: 'Round-robin selection: position 2 of 3',
//   confidence: 1.0,
//   alternatives: ['DeveloperAgent', 'ReviewerAgent']
// }

// Change strategy at runtime
manager.setMethod('priority');
```

### Custom Speaker Selection

```typescript
import { SpeakerSelectionStrategy, SpeakerSelectionResult } from '@wundr.io/autogen-orchestrator';

class CapabilityMatchSelector implements SpeakerSelectionStrategy {
  async selectSpeaker(
    participants: ChatParticipant[],
    messages: Message[],
    context: ChatContext,
    config?: SpeakerSelectionConfig
  ): Promise<SpeakerSelectionResult> {
    const lastMessage = messages[messages.length - 1];

    // Find participant whose capabilities best match the message content
    let bestMatch = participants[0];
    let bestScore = 0;

    for (const participant of participants) {
      const score = participant.capabilities.filter(cap =>
        lastMessage?.content.toLowerCase().includes(cap.toLowerCase())
      ).length;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = participant;
      }
    }

    return {
      speaker: bestMatch.name,
      reason: `Capability match score: ${bestScore}`,
      confidence: bestScore > 0 ? 0.9 : 0.5,
      alternatives: participants.filter(p => p.name !== bestMatch.name).map(p => p.name),
    };
  }
}
```

### Transition Rules

```typescript
const config: SpeakerSelectionConfig = {
  priorityOrder: ['Manager', 'Developer', 'Tester'],
  transitionRules: [
    {
      from: 'Manager',
      to: ['Developer', 'Tester'],
      condition: 'after assignment',
      weight: 0.9,
    },
    {
      from: 'Developer',
      to: ['Tester'],
      weight: 0.7,
    },
    {
      from: 'Tester',
      to: ['Developer', 'Manager'],
      weight: 0.5,
    },
  ],
  allowedTransitions: {
    Manager: ['Developer', 'Tester'],
    Developer: ['Tester', 'Manager'],
    Tester: ['Developer', 'Manager'],
  },
};
```

## Message Routing

### Adding Messages Programmatically

```typescript
// Add a user message
await chat.addMessage({
  role: 'user',
  content: 'Please analyze the latest data.',
  name: 'user',
});

// Add a system message
await chat.addMessage({
  role: 'system',
  content: 'Context updated: New data available.',
  name: 'system',
});

// Add a function call message
await chat.addMessage({
  role: 'assistant',
  content: 'Executing data analysis...',
  name: 'AnalystAgent',
  contentType: 'function_call',
  functionCall: {
    name: 'analyzeData',
    arguments: { dataset: 'q4_2024', metrics: ['revenue', 'growth'] },
  },
});

// Add function result
await chat.addMessage({
  role: 'function',
  content: JSON.stringify({ revenue: 1500000, growth: 0.15 }),
  name: 'analyzeData',
  contentType: 'function_result',
});
```

### Response Generation

```typescript
import { ResponseGenerator } from '@wundr.io/autogen-orchestrator';

// Set custom response generator
const generator: ResponseGenerator = async (participant, messages, context) => {
  // Build prompt from participant's system prompt and message history
  const systemPrompt = participant.systemPrompt;
  const conversationHistory = messages.map(m => `${m.name}: ${m.content}`).join('\n');

  // Call your LLM provider
  const response = await callLLM({
    system: systemPrompt,
    messages: conversationHistory,
    model: participant.modelConfig?.model || 'default-model',
    temperature: participant.modelConfig?.temperature || 0.7,
  });

  return response;
};

chat.setResponseGenerator(generator);
```

## Conversation History Tracking

### Accessing History

```typescript
// Get all messages
const messages = chat.getMessages();

// Get current context
const context = chat.getContext();

// Get metrics
const metrics = chat.getMetrics();
console.log(metrics);
// {
//   totalTokens: 15000,
//   avgResponseTimeMs: 1250,
//   messagesPerParticipant: { 'Agent1': 5, 'Agent2': 4 },
//   tokensPerParticipant: { 'Agent1': 8000, 'Agent2': 7000 },
//   successfulResponses: 9,
//   failedResponses: 0,
// }
```

### State Management

```typescript
// Update shared state
chat.updateState('currentTopic', 'performance optimization');
chat.updateState('analysisComplete', true);
chat.updateState('findings', { issues: 3, recommendations: 5 });

// Read state
const topic = chat.getState<string>('currentTopic');
const complete = chat.getState<boolean>('analysisComplete');
```

### Chat Results

```typescript
interface ChatResult {
  chatId: string;
  status: ChatStatus;
  messages: Message[];
  summary?: string;
  terminationReason?: string;
  totalRounds: number;
  totalMessages: number;
  participants: string[];
  durationMs: number;
  metrics?: ChatMetrics;
  nestedResults?: NestedChatResult[];
  error?: ChatError;
  startedAt: Date;
  endedAt: Date;
}

const result = await chat.start({ initialMessage: 'Begin' });
console.log(`Completed in ${result.durationMs}ms with ${result.totalMessages} messages`);
```

## Termination Handling

### Built-in Termination Conditions

```typescript
import {
  TerminationManager,
  createTerminationHandler,
  TerminationPresets,
} from '@wundr.io/autogen-orchestrator';

// Max rounds
{ type: 'max_rounds', value: 10 }

// Max messages
{ type: 'max_messages', value: 50 }

// Keyword detection
{ type: 'keyword', value: ['DONE', 'COMPLETE', 'TERMINATE'] }

// Timeout (milliseconds)
{ type: 'timeout', value: 300000 }

// Consensus-based
{
  type: 'consensus',
  value: {
    threshold: 0.75,
    agreementKeywords: ['agree', 'approve', 'lgtm'],
    disagreementKeywords: ['disagree', 'reject', 'needs work'],
    minParticipants: 2,
    windowSize: 10,
  }
}

// Custom function
{
  type: 'function',
  evaluator: async (messages, participants, context) => ({
    shouldTerminate: context.state['taskComplete'] === true,
    reason: 'Task marked as complete',
    summary: 'Conversation ended after task completion',
  }),
}
```

### Termination Presets

```typescript
import { TerminationPresets } from '@wundr.io/autogen-orchestrator';

// Task completion detection
const taskComplete = TerminationPresets.taskCompletion();
// Detects: 'TASK_COMPLETE', 'DONE', 'FINISHED', 'COMPLETED', 'END_TASK'

// Approval workflow
const approval = TerminationPresets.approval();
// Consensus with 75% threshold, detects: 'approve', 'lgtm', 'ship it'

// Quick discussions
const quick = TerminationPresets.quickDiscussion(5);
// Max 5 rounds + manual termination keywords

// Long-running tasks
const longRunning = TerminationPresets.longRunning(30);
// 30-minute timeout + 100 message limit + emergency keywords
```

### Managing Termination Conditions

```typescript
const manager = new TerminationManager([
  { type: 'max_rounds', value: 10 },
  { type: 'keyword', value: 'STOP' },
]);

// Add condition at runtime
manager.addCondition({ type: 'timeout', value: 60000 });

// Remove condition type
manager.removeCondition('timeout');

// Check if condition exists
const hasKeyword = manager.hasCondition('keyword');

// Evaluate all conditions
const result = await manager.evaluate(messages, participants, context);
if (result.shouldTerminate) {
  console.log(`Terminating: ${result.reason}`);
}

// Get all conditions
const conditions = manager.getConditions();
```

## Nested Chats

Nested chats allow focused sub-discussions within a main conversation.

### Configuration

```typescript
import { NestedChatManager, NestedChatConfigBuilder } from '@wundr.io/autogen-orchestrator';

// Using the builder
const nestedConfig = new NestedChatConfigBuilder()
  .withId('technical-review')
  .withName('Technical Deep Dive')
  .withKeywordTrigger(['technical review', 'deep dive'])
  .withParticipants(['Developer', 'Architect', 'Tester'])
  .withMaxRounds(5)
  .withSummaryMethod('reflection')
  .withPrompt('Focus on technical implementation details.')
  .withSharedContext()
  .build();

// Add to group chat
const chat = new GroupChatBuilder()
  .withParticipant(developer)
  .withParticipant(architect)
  .withParticipant(tester)
  .withParticipant(manager)
  .withNestedChats()
  .withNestedChatConfig(nestedConfig)
  .build();
```

### Trigger Types

```typescript
// Keyword trigger
new NestedChatConfigBuilder().withKeywordTrigger(['review code', 'code review']).build();

// Participant trigger
new NestedChatConfigBuilder()
  .withParticipantTrigger(['SecurityExpert', 'ComplianceOfficer'])
  .build();

// Condition trigger
new NestedChatConfigBuilder()
  .withConditionTrigger((message, context) => {
    return context.messageCount > 10 && message.content.includes('complex');
  })
  .build();

// Manual trigger
new NestedChatConfigBuilder().withManualTrigger('startNestedDiscussion').build();

// Trigger manually via state
chat.updateState('startNestedDiscussion', true);
```

### Summary Methods

```typescript
// 'last' - Use the last message as summary
// 'llm' - Generate summary using LLM (requires implementation)
// 'reflection' - Structured reflection summary
// 'custom' - Custom summary logic

const config = new NestedChatConfigBuilder().withSummaryMethod('reflection').build();
```

### Nested Chat Events

```typescript
chat.on('nested:started', ({ chatId, nestedChatId }) => {
  console.log(`Nested chat ${nestedChatId} started`);
});

chat.on('nested:ended', ({ chatId, nestedChatId, result }) => {
  console.log(`Nested chat summary: ${result.summary}`);
});
```

## Integration with Other Orchestrators

### With Task Orchestrators

```typescript
import { GroupChatManager } from '@wundr.io/autogen-orchestrator';
import { TaskOrchestrator } from '@wundr.io/task-orchestrator';

const taskOrchestrator = new TaskOrchestrator();

// Create a chat for each complex task
taskOrchestrator.on('task:complex', async task => {
  const chat = new GroupChatBuilder()
    .withName(`Task: ${task.name}`)
    .withParticipant(createParticipant('Planner', 'Plan the task execution'))
    .withParticipant(createParticipant('Executor', 'Execute the planned steps'))
    .withParticipant(createParticipant('Validator', 'Validate results'))
    .withSpeakerSelection('priority')
    .withTerminationCondition({ type: 'keyword', value: 'TASK_COMPLETE' })
    .build();

  const result = await chat.start({
    initialMessage: `Execute task: ${task.description}`,
    initialState: { taskId: task.id },
  });

  return result;
});
```

### With Workflow Engines

```typescript
import { GroupChatManager } from '@wundr.io/autogen-orchestrator';

class WorkflowStep {
  async executeWithAgents(stepConfig: StepConfig) {
    const participants = stepConfig.roles.map(role =>
      createParticipant(role.name, role.prompt, role.capabilities)
    );

    const chat = new GroupChatBuilder()
      .withName(stepConfig.name)
      .withSpeakerSelection('auto')
      .withMaxRounds(stepConfig.maxIterations || 10)
      .build();

    participants.forEach(p => chat.addParticipant(p));

    chat.setResponseGenerator(this.createResponseGenerator(stepConfig));

    return await chat.start({
      initialMessage: stepConfig.objective,
      initialState: stepConfig.context,
    });
  }
}
```

### With Event-Driven Systems

```typescript
import { EventEmitter } from 'events';
import { GroupChatManager, ChatEvent } from '@wundr.io/autogen-orchestrator';

class AgentEventBridge extends EventEmitter {
  private chat: GroupChatManager;

  constructor(chat: GroupChatManager) {
    super();
    this.chat = chat;
    this.setupBridge();
  }

  private setupBridge() {
    // Forward chat events to external system
    this.chat.on('message:received', ({ message }) => {
      this.emit('agent:message', {
        agent: message.name,
        content: message.content,
        timestamp: message.timestamp,
      });
    });

    this.chat.on('chat:ended', ({ result }) => {
      this.emit('conversation:complete', {
        summary: result.summary,
        metrics: result.metrics,
        duration: result.durationMs,
      });
    });
  }

  // Inject external events into the chat
  async injectExternalMessage(source: string, content: string) {
    await this.chat.addMessage({
      role: 'system',
      content: `[External: ${source}] ${content}`,
      name: 'system',
    });
  }
}
```

## API Reference

### GroupChatManager

| Method                                                             | Description                    |
| ------------------------------------------------------------------ | ------------------------------ |
| `constructor(config: GroupChatConfig)`                             | Create a new chat manager      |
| `setResponseGenerator(generator: ResponseGenerator)`               | Set the LLM response generator |
| `start(options?: StartChatOptions)`                                | Start the conversation         |
| `pause()`                                                          | Pause the conversation         |
| `resume()`                                                         | Resume a paused conversation   |
| `stop(reason?: string)`                                            | Stop the conversation          |
| `addMessage(options: CreateMessageOptions)`                        | Add a message                  |
| `addParticipant(options: AddParticipantOptions)`                   | Add a participant              |
| `removeParticipant(name: string)`                                  | Remove a participant           |
| `updateParticipantStatus(name: string, status: ParticipantStatus)` | Update participant status      |
| `addTerminationCondition(condition: TerminationCondition)`         | Add termination condition      |
| `addNestedChatConfig(config: NestedChatConfig)`                    | Add nested chat configuration  |
| `getStatus()`                                                      | Get current chat status        |
| `getChatId()`                                                      | Get the chat ID                |
| `getMessages()`                                                    | Get all messages               |
| `getParticipants()`                                                | Get all participants           |
| `getContext()`                                                     | Get current context            |
| `getMetrics()`                                                     | Get chat metrics               |
| `updateState(key: string, value: T)`                               | Update context state           |
| `getState<T>(key: string)`                                         | Get context state value        |

### SpeakerSelectionManager

| Method                                                    | Description                |
| --------------------------------------------------------- | -------------------------- |
| `constructor(method?: SpeakerSelectionMethod)`            | Create with initial method |
| `selectSpeaker(participants, messages, context, config?)` | Select next speaker        |
| `setMethod(method: SpeakerSelectionMethod)`               | Change selection method    |
| `getMethod()`                                             | Get current method         |
| `getStrategy(method: SpeakerSelectionMethod)`             | Get strategy instance      |

### TerminationManager

| Method                                             | Description                    |
| -------------------------------------------------- | ------------------------------ |
| `constructor(conditions?: TerminationCondition[])` | Create with initial conditions |
| `addCondition(condition: TerminationCondition)`    | Add a condition                |
| `removeCondition(type: TerminationConditionType)`  | Remove conditions by type      |
| `clearConditions()`                                | Clear all conditions           |
| `evaluate(messages, participants, context)`        | Evaluate all conditions        |
| `getConditions()`                                  | Get all conditions             |
| `hasCondition(type: TerminationConditionType)`     | Check if type exists           |

### NestedChatManager

| Method                                                                          | Description                 |
| ------------------------------------------------------------------------------- | --------------------------- |
| `constructor(configs?: NestedChatConfig[])`                                     | Create with initial configs |
| `addConfig(config: NestedChatConfig)`                                           | Add configuration           |
| `removeConfig(configId: string)`                                                | Remove configuration        |
| `checkTrigger(message, participants, context)`                                  | Check for triggers          |
| `startNestedChat(config, parentChatId, parentMessageId, participants, context)` | Start nested chat           |
| `addMessage(nestedChatId: string, message: Message)`                            | Add message to nested chat  |
| `endNestedChat(nestedChatId, status?, reason?)`                                 | End nested chat             |
| `getActiveChats()`                                                              | Get active nested chat IDs  |
| `getCompletedChats()`                                                           | Get completed results       |
| `hasActiveChats()`                                                              | Check for active chats      |

## Examples

### Code Review Workflow

```typescript
import {
  GroupChatBuilder,
  createParticipant,
  TerminationPresets,
} from '@wundr.io/autogen-orchestrator';

const codeAuthor = createParticipant(
  'CodeAuthor',
  'You wrote the code and can explain design decisions.',
  ['code', 'architecture', 'explanation']
);

const securityReviewer = createParticipant(
  'SecurityReviewer',
  'You review code for security vulnerabilities.',
  ['security', 'vulnerabilities', 'compliance']
);

const performanceReviewer = createParticipant(
  'PerformanceReviewer',
  'You review code for performance issues.',
  ['performance', 'optimization', 'efficiency']
);

const chat = new GroupChatBuilder()
  .withName('Code Review')
  .withParticipant(codeAuthor)
  .withParticipant(securityReviewer)
  .withParticipant(performanceReviewer)
  .withSpeakerSelection('priority')
  .withTerminationCondition(TerminationPresets.approval())
  .withMaxRounds(20)
  .build();

const result = await chat.start({
  initialMessage: `Review this code:\n\`\`\`javascript\n${codeToReview}\n\`\`\``,
});
```

### Research Collaboration

```typescript
const researcher = createParticipant(
  'Researcher',
  'You search for and analyze relevant information.',
  ['research', 'analysis', 'citations']
);

const critic = createParticipant(
  'Critic',
  'You critically evaluate claims and identify weaknesses.',
  ['evaluation', 'logic', 'counterarguments']
);

const synthesizer = createParticipant(
  'Synthesizer',
  'You combine findings into coherent conclusions.',
  ['synthesis', 'summary', 'conclusions']
);

const chat = new GroupChatBuilder()
  .withName('Research Collaboration')
  .withParticipant(researcher)
  .withParticipant(critic)
  .withParticipant(synthesizer)
  .withSpeakerSelection('llm_selected')
  .withTerminationCondition({
    type: 'keyword',
    value: ['CONCLUSION REACHED', 'RESEARCH COMPLETE'],
  })
  .build();
```

### Customer Support Escalation

```typescript
const frontlineAgent = createParticipant(
  'FrontlineSupport',
  'You handle initial customer inquiries.',
  ['support', 'troubleshooting', 'empathy']
);

const technicalSpecialist = createParticipant(
  'TechnicalSpecialist',
  'You handle complex technical issues.',
  ['technical', 'debugging', 'systems']
);

const supervisor = createParticipant(
  'Supervisor',
  'You handle escalations and make final decisions.',
  ['escalation', 'decisions', 'policies']
);

const chat = new GroupChatBuilder()
  .withName('Support Ticket #12345')
  .withParticipant(frontlineAgent)
  .withParticipant(technicalSpecialist)
  .withParticipant(supervisor)
  .withSpeakerSelection('auto')
  .withNestedChats()
  .withNestedChatConfig(
    new NestedChatConfigBuilder()
      .withId('escalation')
      .withName('Supervisor Escalation')
      .withKeywordTrigger(['escalate', 'supervisor'])
      .withParticipants(['TechnicalSpecialist', 'Supervisor'])
      .withMaxRounds(3)
      .build()
  )
  .build();
```

## License

MIT License - see LICENSE file for details.

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting pull requests.

## Support

- Issues: [GitHub Issues](https://github.com/adapticai/wundr/issues)
- Documentation: [Wundr Documentation](https://wundr.io)
