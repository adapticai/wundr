# AI Integration Package - Quick Reference Guide

**Package**: `@wundr.io/ai-integration` v1.0.6 **Analysis Date**: 2025-11-30 **Report**:
`/Users/iroselli/wundr/docs/ai-integration-analysis-report.json`

## Executive Summary

The `@wundr/ai-integration` package is a **sophisticated orchestration system** for managing AI
agents, swarm intelligence, and workflow automation. However, it **lacks direct LLM integration**
and focuses on coordination via external MCP servers.

### Key Numbers

- **54 Specialized Agents** across 8 categories
- **4 Neural Models** for task classification and agent selection
- **5 Swarm Topologies** (Mesh, Hierarchical, Ring, Star, Adaptive)
- **26 MCP Tools** for governance and monitoring
- **0 Direct LLM Integrations** ⚠️ CRITICAL GAP

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      AIIntegrationHive                          │
│         Central Orchestration Hub (NO DIRECT LLM CALLS)         │
└──────────────┬──────────────────────────────────────────────────┘
               │
      ┌────────┴─────────┬──────────────┬────────────────┐
      │                  │              │                │
┌─────▼──────┐  ┌───────▼──────┐  ┌───▼────────┐  ┌────▼─────┐
│  Claude    │  │    Swarm     │  │   Neural   │  │  GitHub  │
│   Flow     │  │ Intelligence │  │  Training  │  │  Swarms  │
│Orchestrator│  │   Engine     │  │  Pipeline  │  │  Engine  │
└─────┬──────┘  └──────┬───────┘  └────┬───────┘  └──────────┘
      │                │               │
      │           Topology             Neural Models:
      │           Selection:           - task-classifier
      │           - Mesh               - agent-selector
      │           - Hierarchical       - performance-predictor
      │           - Ring               - pattern-recognizer
      │           - Star
      │           - Adaptive
      │
┌─────▼──────────────────────────────────────────────────────────┐
│              External MCP Server (Claude Flow)                  │
│         ACTUAL LLM CALLS HAPPEN HERE (not in package)          │
└─────────────────────────────────────────────────────────────────┘
```

## Critical Findings

### ✅ What's Implemented

1. **Agent Orchestration**: 54 specialized agents with capability-based selection
2. **Swarm Coordination**: 5 topology types with auto-selection based on task analysis
3. **Neural Intelligence**: 4 ML models for task classification and agent selection
4. **Memory Management**: Session and cross-session persistence with TTL policies
5. **Performance Monitoring**: Real-time metrics, bottleneck detection
6. **MCP Tools**: 26 tools for governance, monitoring, coordination
7. **Event System**: Rich event-driven architecture with EventEmitter3

### ❌ What's Missing

1. **Direct LLM Integration**: No Anthropic or OpenAI SDK usage despite dependencies
2. **Chat Completion**: No chat APIs or conversation management
3. **Streaming**: No streaming response support
4. **Function Calling**: MCP tools exist but not integrated with LLM function calling
5. **Prompt Management**: No prompt templates or versioning
6. **Token Management**: No token counting or budget enforcement
7. **Multi-Provider Support**: Cannot switch between OpenAI/Anthropic/etc.

## Package Structure

```
@wundr/ai-integration/
├── src/
│   ├── core/
│   │   ├── AIIntegrationHive.ts        # Main orchestration hub
│   │   ├── ClaudeFlowOrchestrator.ts   # 54 agents, MCP server integration
│   │   ├── SwarmIntelligence.ts        # 5 topologies, consensus algorithms
│   │   ├── NeuralTrainingPipeline.ts   # Model training coordination
│   │   ├── MCPToolsRegistry.ts         # 26 MCP tools
│   │   └── MemoryManager.ts            # Session/cross-session memory
│   ├── agents/                         # Agent coordination
│   ├── neural/                         # 4 neural models
│   ├── memory/                         # Memory optimization
│   ├── orchestration/                  # Workflow engine
│   ├── monitoring/                     # Performance tracking
│   ├── github/                         # GitHub automation
│   ├── types/                          # TypeScript definitions
│   └── config/                         # Default configurations
├── package.json                        # @anthropic-ai/sdk (UNUSED!)
└── README.md                           # Documentation
```

## LLM Provider Status

### Anthropic SDK

- **Dependency**: `@anthropic-ai/sdk@^0.24.3` in package.json
- **Usage**: **NONE DETECTED** ⚠️
- **Status**: Unused dependency (should be removed or implemented)

### OpenAI SDK

- **Dependency**: Not in package.json
- **Usage**: Not implemented

### Architecture Pattern

This package uses **DELEGATION** instead of **DIRECT INTEGRATION**:

```typescript
// What the package does NOW:
await this.executeClaudeFlowCommand('agent_spawn', { type: 'coder' });
// ↓ Delegates to external MCP server via bash commands
// ↓ MCP server makes actual LLM calls

// What the package SHOULD do for orchestrator:
const response = await this.llmProvider.chatCompletion({
  model: 'claude-3-5-sonnet-20241022',
  messages: [
    { role: 'system', content: 'You are a coding agent...' },
    { role: 'user', content: 'Implement authentication' },
  ],
  temperature: 0.7,
  max_tokens: 4096,
});
```

## Neural Models Deep Dive

### 1. Task Classifier

**Purpose**: Classify tasks into types (coding, testing, review, etc.)

```typescript
Architecture:
  - Dense(128, relu) → Dropout(0.3) → Dense(64, softmax)
  - Adam optimizer (lr=0.001)
  - ~92% accuracy

Input:  { description: string, context: object }
Output: { taskType: string, confidence: number }
```

### 2. Agent Selector

**Purpose**: Select optimal agents for task requirements

```typescript
Architecture:
  - Dense(256, relu) → BatchNorm → Dense(1, sigmoid)
  - Adam optimizer (lr=0.0005)
  - ~88% accuracy

Input:  { requiredCapabilities: string[], complexity: number }
Output: { recommendedAgents: string[], scores: object }
```

### 3. Performance Predictor

**Purpose**: Predict execution time and resource needs

```typescript
Architecture:
  - LSTM(128, tanh) → Dense(64, relu) → Dense(1, linear)
  - RMSprop optimizer (lr=0.002)
  - ~78% accuracy

Input:  { complexity: number, agentCount: number, taskSize: number }
Output: { estimatedTime: number, resourceRequirements: object }
```

### 4. Pattern Recognizer

**Purpose**: Recognize code and behavioral patterns

```typescript
Architecture:
  - Conv1D(64, kernel=3) → Pool(2) → Dense(10, softmax)
  - SGD optimizer (lr=0.01, momentum=0.9)
  - ~85% accuracy

Input:  { pattern: string, data: array, context: object }
Output: { patternType: string, confidence: number, similar: array }
```

## Swarm Topologies

### 1. Mesh (Peer-to-Peer)

- **Max Agents**: 12
- **Connection**: Full mesh (everyone connected)
- **Coordination**: Peer-to-peer consensus
- **Fault Tolerance**: HIGH
- **Decision Speed**: MEDIUM (0.6)
- **Best For**: Small teams, consensus-critical, fault-tolerant tasks

### 2. Hierarchical (Tree)

- **Max Agents**: 50
- **Connection**: Tree structure
- **Coordination**: Top-down command
- **Fault Tolerance**: MEDIUM
- **Decision Speed**: VERY FAST (0.9)
- **Best For**: Large projects, structured tasks, scalability

### 3. Adaptive (Dynamic)

- **Max Agents**: 25
- **Connection**: Dynamic (changes based on context)
- **Coordination**: Adaptive optimization
- **Fault Tolerance**: HIGH
- **Decision Speed**: FAST (0.7)
- **Best For**: Complex projects, changing requirements, optimization

### 4. Ring (Circular)

- **Max Agents**: 20
- **Connection**: Circular (each connects to neighbors)
- **Coordination**: Distributed load balancing
- **Fault Tolerance**: MEDIUM
- **Decision Speed**: MEDIUM (0.6)
- **Best For**: Pipeline tasks, sequential processing

### 5. Star (Hub-Spoke)

- **Max Agents**: 30
- **Connection**: Central hub with spokes
- **Coordination**: Centralized control
- **Fault Tolerance**: LOW
- **Decision Speed**: VERY FAST (0.95)
- **Best For**: Real-time coordination, simple tasks

## MCP Tools (26 Total)

### Governance (2 tools)

- `drift_detection`: Monitor code quality drift
- `governance_report`: Generate compliance reports

### Coordination (3 tools)

- `swarm_init`: Initialize swarm systems
- `agent_spawn`: Create and configure agents
- `task_orchestrate`: Distribute tasks across agents

### Monitoring (5 tools)

- `swarm_status`: Monitor swarm health
- `agent_list`: Discover available agents
- `agent_metrics`: Collect performance metrics
- `task_status`: Track task execution
- `task_results`: Aggregate results

### Neural (3 tools)

- `neural_status`: Monitor model training
- `neural_train`: Train neural models
- `neural_patterns`: Analyze behavioral patterns

### GitHub (5 tools)

- `github_swarm`: Coordinate GitHub operations
- `repo_analyze`: Analyze repository structure
- `pr_enhance`: Enhance pull requests
- `issue_triage`: Auto-triage issues
- `code_review`: Automated code reviews

### System (3 tools)

- `benchmark_run`: Performance benchmarking
- `features_detect`: Detect system capabilities
- `swarm_monitor`: Comprehensive monitoring

## Adding GPT-5-mini Support

### Step 1: Add LLM Provider Layer (3-5 days)

```typescript
// src/llm/LLMProvider.ts
interface LLMProvider {
  chatCompletion(messages: Message[], options: ChatOptions): Promise<ChatResponse>;
  streamChatCompletion(messages: Message[], options: ChatOptions): AsyncIterator<ChatChunk>;
  functionCall(messages: Message[], functions: Function[]): Promise<FunctionCallResponse>;
}

// src/llm/OpenAIProvider.ts
class OpenAIProvider implements LLMProvider {
  async chatCompletion(messages, options) {
    const response = await this.client.chat.completions.create({
      model: options.model || 'gpt-5-mini',
      messages: messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 4096,
      stream: false,
    });
    return this.parseResponse(response);
  }
}
```

### Step 2: Implement Chat Session (4-6 days)

```typescript
// src/llm/ChatSession.ts
class ChatSession {
  private messageHistory: Message[] = [];
  private provider: LLMProvider;
  private tokenBudget: number;

  async sendMessage(content: string, options?: ChatOptions): Promise<ChatResponse> {
    this.messageHistory.push({ role: 'user', content });

    const response = await this.provider.chatCompletion(this.messageHistory, options);

    this.messageHistory.push({ role: 'assistant', content: response.content });
    this.pruneHistoryIfNeeded();

    return response;
  }

  async streamMessage(content: string): AsyncIterator<ChatChunk> {
    // Streaming implementation
  }
}
```

### Step 3: Add Streaming Support (2-3 days)

```typescript
// src/llm/StreamingHandler.ts
class StreamingHandler extends EventEmitter {
  async *streamResponse(provider: LLMProvider, messages: Message[]): AsyncIterator<ChatChunk> {
    const stream = await provider.streamChatCompletion(messages);

    for await (const chunk of stream) {
      this.emit('chunk', chunk);
      yield chunk;
    }

    this.emit('complete');
  }
}
```

### Step 4: Convert MCP Tools to Functions (3-4 days)

```typescript
// src/llm/FunctionConverter.ts
class FunctionConverter {
  convertMCPToolToFunction(tool: MCPTool): FunctionDefinition {
    return {
      name: tool.id,
      description: tool.metadata.configuration.description,
      parameters: this.inferParametersFromTool(tool),
    };
  }
}

// Example converted function
const driftDetectionFunction = {
  name: 'drift_detection',
  description: 'Monitor code quality drift and create baselines',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['check', 'baseline', 'trends'],
        description: 'The drift detection operation to perform',
      },
      path: {
        type: 'string',
        description: 'Path to the codebase to analyze',
      },
    },
    required: ['operation'],
  },
};
```

### Step 5: Add Configuration (1-2 days)

```typescript
// src/config/llm-config.ts
export const llmConfig = {
  providers: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      models: {
        'gpt-5-mini': {
          maxTokens: 16000,
          contextWindow: 128000,
          costPer1kTokens: 0.0001,
          capabilities: ['chat', 'function-calling', 'streaming'],
        },
      },
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      models: {
        'claude-3-5-sonnet-20241022': {
          maxTokens: 8192,
          contextWindow: 200000,
          capabilities: ['chat', 'function-calling', 'streaming', 'vision'],
        },
      },
    },
  },
  defaultProvider: 'anthropic',
  defaultModel: 'claude-3-5-sonnet-20241022',
  fallbackModel: 'gpt-5-mini',
};
```

## Integration with Orchestrator

### Recommended Approach: Hybrid Mode

```typescript
// AIIntegrationHive enhancement
class AIIntegrationHive extends EventEmitter {
  private llmProvider: LLMProvider;
  private chatSessions: Map<string, ChatSession>;

  // NEW: Direct chat with specialized agents via LLM
  async chatWithAgent(
    agentType: AgentType,
    messages: Message[],
    options?: ChatOptions
  ): Promise<ChatResponse> {
    const systemPrompt = this.getAgentSystemPrompt(agentType);
    const fullMessages = [{ role: 'system', content: systemPrompt }, ...messages];

    return this.llmProvider.chatCompletion(fullMessages, {
      ...options,
      functions: this.getMCPFunctionsForAgent(agentType),
    });
  }

  // NEW: Multi-model consensus for critical decisions
  async llmConsensus(prompt: string, models: string[]): Promise<ConsensusResult> {
    const responses = await Promise.all(
      models.map(model =>
        this.llmProvider.chatCompletion([{ role: 'user', content: prompt }], { model })
      )
    );

    return this.swarmIntelligence.reachConsensus(responses);
  }

  // EXISTING: MCP-based orchestration (keep for complex workflows)
  async executeTask(task: Task): Promise<OperationResult> {
    // Existing implementation using MCP server
  }
}
```

## Usage Examples

### Before (MCP-Only)

```typescript
// Can only orchestrate via external MCP server
const result = await hive.executeTask({
  description: 'Implement authentication',
  type: 'coding',
  requiredCapabilities: ['coding', 'security'],
});
// Limitation: No direct LLM interaction, relies on MCP server
```

### After (Hybrid LLM + MCP)

```typescript
// Option 1: Direct LLM chat with specialized agent
const coderResponse = await hive.chatWithAgent(
  'coder',
  [{ role: 'user', content: 'Implement JWT authentication in TypeScript' }],
  {
    model: 'gpt-5-mini',
    temperature: 0.7,
    functions: ['drift_detection', 'pattern_standardize'],
  }
);

// Option 2: Streaming for real-time feedback
const stream = hive.streamChatWithAgent('researcher', [
  { role: 'user', content: 'Research best practices for authentication' },
]);

for await (const chunk of stream) {
  console.log(chunk.content); // Real-time output
}

// Option 3: Multi-model consensus for critical decisions
const consensus = await hive.llmConsensus('Should we use bcrypt or argon2 for password hashing?', [
  'claude-3-5-sonnet-20241022',
  'gpt-5-mini',
]);

// Option 4: Existing MCP orchestration (for complex workflows)
const workflowResult = await hive.executeTask({
  description: 'Full authentication implementation with tests',
  type: 'coding',
  requiredCapabilities: ['coding', 'testing', 'security'],
});
```

## Effort Estimate

| Task                         | Priority | Effort         | Dependencies |
| ---------------------------- | -------- | -------------- | ------------ |
| LLM Provider Abstraction     | CRITICAL | 3-5 days       | None         |
| Chat Session Management      | CRITICAL | 4-6 days       | LLM Provider |
| Streaming Support            | HIGH     | 2-3 days       | LLM Provider |
| Function Calling Integration | HIGH     | 3-4 days       | LLM Provider |
| GPT-5-mini Configuration     | HIGH     | 1-2 days       | LLM Provider |
| Prompt Management            | MEDIUM   | 2-3 days       | Chat Session |
| Token Management             | MEDIUM   | 2-3 days       | LLM Provider |
| Retry Strategies             | MEDIUM   | 2 days         | LLM Provider |
| Model Selection              | LOW      | 1-2 days       | LLM Provider |
| **TOTAL**                    |          | **15-25 days** |              |

## Risk Assessment

**Risk Level**: **LOW**

**Rationale**:

- Existing architecture is well-designed and modular
- New LLM layer can be added without breaking changes
- Event-driven architecture already supports async operations
- MCP tools can be incrementally converted to function definitions
- Existing orchestration can run in parallel with new LLM integration

## Conclusion

The `@wundr/ai-integration` package is an **excellent orchestration framework** but lacks direct LLM
integration. Adding LLM support is straightforward and can be done **incrementally without breaking
existing functionality**.

**Recommended Strategy**:

1. Add LLM provider layer (OpenAI + Anthropic)
2. Implement chat session management
3. Add streaming support
4. Convert MCP tools to function definitions
5. Configure GPT-5-mini alongside Claude models
6. Maintain hybrid mode: MCP for workflows, LLM for direct chat

**Timeline**: 15-25 developer days **Impact**: Transform from orchestrator-only to full-featured LLM
integration platform **Compatibility**: 100% backward compatible with existing MCP workflows

---

**Full Report**: `/Users/iroselli/wundr/docs/ai-integration-analysis-report.json`
