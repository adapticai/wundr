# Further Enhancements to the Three-Tier Hierarchy Implementation Plan

## Alignment with Dynamic Context Compilation and Claude Agent Platform Features

**Document Version**: 1.0.0 **Date**: 2025-11-23 **Status**: Enhancement Blueprint
**Prerequisites**: THREE-TIER-ARCHITECTURE-IMPLEMENTATION-PLAN.md

---

## Executive Summary

This document extends the existing Three-Tier Architecture Implementation Plan by incorporating
advanced concepts from two key reference documents:

1. **Dynamic Context Compilation and Hierarchical Organization Generation for AI Agents** -
   Comprehensive analysis of context engineering, MCP protocol, and orchestration frameworks
2. **Claude Agent Platform Features** - Platform-specific capabilities including sub-agents, MCP
   servers, hooks, and custom commands

The goal is to create a **production-grade, institutional-quality agentic platform** that fully
leverages:

- Just-In-Time (JIT) context and tool injection
- Model Context Protocol (MCP) as the universal connectivity layer
- Hierarchical multi-agent orchestration (LangGraph, CrewAI, AutoGen patterns)
- Structured output enforcement (Pydantic/Instructor)
- Dynamic configuration management (Hydra-inspired)
- Generative UI capabilities

---

## Part 1: Gap Analysis - New Capabilities Required

### 1.1 Current State vs. Target State

| Capability                   | Current Wundr State      | Target State (From Documents)                           | Priority |
| ---------------------------- | ------------------------ | ------------------------------------------------------- | -------- |
| **Context Engineering**      | Basic CLAUDE.md          | Dynamic JIT context compilation                         | Critical |
| **Tool Loading**             | Static MCP server config | Just-In-Time tool retrieval via RAG                     | Critical |
| **Memory Architecture**      | Generic memory templates | MemGPT-inspired tiered memory (scratchpad + persistent) | High     |
| **Orchestration Framework**  | claude-flow swarm        | LangGraph state machines + CrewAI teams                 | High     |
| **Structured Outputs**       | Zod validation           | Pydantic/Instructor with retry loops                    | High     |
| **Configuration Management** | Basic YAML configs       | Hydra-style hierarchical composition                    | Medium   |
| **Prompt Templating**        | Static markdown          | Jinja2 dynamic prompts with macros                      | Medium   |
| **Agent UI**                 | Blessed terminal UI      | Chainlit + Generative UI components                     | Medium   |
| **Security Patterns**        | Basic RBAC               | Action-Selector/Interceptor for prompt injection        | High     |
| **Scaffolding**              | project-init templates   | Cookiecutter/Cruft with agent templates                 | Medium   |

### 1.2 Key Framework Gaps

Based on analysis of the reference documents, the following frameworks need integration:

| Framework                    | Purpose                                  | Current Integration   | Required Action                 |
| ---------------------------- | ---------------------------------------- | --------------------- | ------------------------------- |
| **LangGraph**                | Cyclic state-driven workflows            | Not present           | New integration                 |
| **CrewAI**                   | Role-based multi-agent teams             | Not present           | New integration                 |
| **AutoGen**                  | Conversational agent orchestration       | Not present           | New integration                 |
| **Pydantic AI / Instructor** | Structured LLM outputs with validation   | Zod only              | Extend validation layer         |
| **Outlines/Guidance**        | Constrained decoding for code generation | Not present           | New integration                 |
| **Hydra**                    | Hierarchical configuration composition   | Not present           | New config system               |
| **Jinja2**                   | Dynamic prompt templating                | Not present           | Prompt template engine          |
| **Chainlit**                 | Conversational AI UI framework           | Not present           | New UI option                   |
| **Vercel AI SDK**            | Generative UI streaming                  | Not present           | Dashboard enhancement           |
| **FastMCP**                  | Rapid MCP server development             | Custom implementation | Standardize on FastMCP patterns |

---

## Part 2: Context Engineering Enhancements

### 2.1 Just-In-Time (JIT) Tool Loading System

**Problem**: Current MCP configuration loads all tools statically, leading to context pollution.

**Solution**: Implement tool registry with semantic search for dynamic injection.

**New Module**: `packages/@wundr/jit-tools/`

```
packages/@wundr/jit-tools/
├── src/
│   ├── index.ts
│   ├── tool-registry.ts          # Central tool catalog
│   ├── tool-retriever.ts         # Semantic search for tools
│   ├── context-injector.ts       # Runtime tool injection
│   ├── intent-analyzer.ts        # Parse agent intent for tool matching
│   └── types.ts
├── embeddings/
│   └── tool-embeddings.json      # Pre-computed tool descriptions
└── package.json
```

**Implementation**: `packages/@wundr/jit-tools/src/tool-retriever.ts`

```typescript
import { VectorStore } from '@wundr.io/rag-utils';

export interface ToolSpec {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  mcpServer: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiredPermissions: string[];
}

export interface ToolRetrievalResult {
  tools: ToolSpec[];
  confidence: number;
  reasoning: string;
}

export class JITToolRetriever {
  private vectorStore: VectorStore;
  private toolRegistry: Map<string, ToolSpec>;

  constructor(config: JITToolConfig) {
    this.vectorStore = new VectorStore(config.vectorStoreConfig);
    this.toolRegistry = new Map();
  }

  /**
   * Retrieve relevant tools based on agent intent
   * Implements the JIT Tooling pattern from the Dynamic Context document
   */
  async retrieveTools(intent: string, context: AgentContext): Promise<ToolRetrievalResult> {
    // 1. Semantic search against tool descriptions
    const candidates = await this.vectorStore.similaritySearch(intent, {
      limit: 10,
      threshold: 0.7,
    });

    // 2. Filter by permissions and risk level
    const permitted = candidates.filter(
      tool =>
        this.checkPermissions(tool, context.agentPermissions) &&
        this.checkRiskLevel(tool, context.riskTolerance)
    );

    // 3. Rank by relevance to current task
    const ranked = this.rankByRelevance(permitted, context.currentTask);

    // 4. Return top-k tools (prevent context bloat)
    return {
      tools: ranked.slice(0, context.maxTools || 5),
      confidence: this.calculateConfidence(ranked),
      reasoning: this.generateReasoning(ranked, intent),
    };
  }

  /**
   * Dynamically inject tools into agent context
   */
  async injectTools(tools: ToolSpec[], agentContext: string): Promise<string> {
    const toolDescriptions = tools.map(t => this.formatToolForPrompt(t)).join('\n');

    return `${agentContext}

## Available Tools (Dynamically Loaded)

The following tools are available for this specific task:

${toolDescriptions}

Note: Additional tools may be loaded if needed. Request specific capabilities if these are insufficient.
`;
  }
}
```

**Integration Points**:

- **computer-setup**: Install JIT tool registry with default tool embeddings
- **project-init**: Configure project-specific tool permissions and risk levels
- **Agent hooks**: Pre-task hook to retrieve and inject relevant tools

### 2.2 Agentic RAG System

**Enhancement to existing `@wundr.io/rag-utils`**

Add agentic capabilities for iterative, self-directed retrieval.

**New Features**:

```typescript
// packages/@wundr/rag-utils/src/agentic-rag.ts

export interface AgenticRAGConfig {
  maxIterations: number;
  queryReformulation: boolean;
  critiqueSelfRetrieval: boolean;
  contextCompaction: boolean;
}

export class AgenticRAGSystem {
  /**
   * Implements recursive retrieval pattern from Dynamic Context document
   * Agent controls its own retrieval process
   */
  async agenticRetrieve(query: string, config: AgenticRAGConfig): Promise<RAGResult> {
    let iteration = 0;
    let context: Document[] = [];
    let satisfied = false;

    while (!satisfied && iteration < config.maxIterations) {
      // 1. Reformulate query based on gaps
      const reformulatedQuery = config.queryReformulation
        ? await this.reformulateQuery(query, context)
        : query;

      // 2. Retrieve documents
      const newDocs = await this.retrieve(reformulatedQuery);

      // 3. Critique retrieval quality
      if (config.critiqueSelfRetrieval) {
        const critique = await this.critiqueRetrieval(query, newDocs);
        if (critique.sufficient) {
          satisfied = true;
        } else {
          query = critique.suggestedQuery;
        }
      } else {
        satisfied = true;
      }

      // 4. Add to context with compaction
      context = config.contextCompaction
        ? await this.compactContext([...context, ...newDocs])
        : [...context, ...newDocs];

      iteration++;
    }

    return { documents: context, iterations: iteration };
  }

  /**
   * Context compaction using summarization
   * Prevents context rot as described in the document
   */
  async compactContext(documents: Document[]): Promise<Document[]> {
    // Group by topic
    const grouped = this.groupByTopic(documents);

    // Summarize each group
    const summaries = await Promise.all(
      Object.entries(grouped).map(([topic, docs]) => this.summarizeGroup(topic, docs))
    );

    return summaries;
  }
}
```

### 2.3 Tiered Memory Architecture (MemGPT-Inspired)

**New Module**: `packages/@wundr/agent-memory/`

Implements the memory systems described in the Dynamic Context document.

```
packages/@wundr/agent-memory/
├── src/
│   ├── index.ts
│   ├── scratchpad.ts             # Short-term working memory
│   ├── episodic-store.ts         # Long-term episodic memory
│   ├── semantic-store.ts         # Long-term semantic memory
│   ├── memory-manager.ts         # MemGPT-style memory orchestration
│   ├── forgetting-curve.ts       # Decay and consolidation
│   └── types.ts
└── package.json
```

**Memory Manager Implementation**:

```typescript
// packages/@wundr/agent-memory/src/memory-manager.ts

export interface MemoryConfig {
  scratchpadTokenLimit: number; // e.g., 8000 tokens
  episodicRetentionDays: number; // e.g., 30 days
  semanticConsolidationThreshold: number;
  forgettingCurveEnabled: boolean;
}

export class AgentMemoryManager {
  private scratchpad: Scratchpad;
  private episodicStore: EpisodicStore;
  private semanticStore: SemanticStore;

  /**
   * Virtual memory management for LLM context
   * Based on MemGPT pattern from Dynamic Context document
   */
  async manageContext(currentContext: string, newInformation: string): Promise<ManagedContext> {
    // 1. Check if context window is filling up
    const tokenCount = this.countTokens(currentContext + newInformation);

    if (tokenCount > this.config.scratchpadTokenLimit * 0.8) {
      // 2. Identify low-priority information to swap out
      const toArchive = await this.identifyArchivable(currentContext);

      // 3. Archive to long-term memory
      await this.archiveToEpisodic(toArchive);

      // 4. Summarize remaining context
      const summarized = await this.summarizeContext(currentContext);

      return {
        context: summarized + '\n' + newInformation,
        archived: toArchive,
        tokensFreed: this.countTokens(toArchive),
      };
    }

    return {
      context: currentContext + '\n' + newInformation,
      archived: null,
      tokensFreed: 0,
    };
  }

  /**
   * Retrieve relevant memories for current task
   */
  async retrieveRelevantMemories(query: string): Promise<Memory[]> {
    // Combine episodic and semantic retrieval
    const episodic = await this.episodicStore.search(query);
    const semantic = await this.semanticStore.search(query);

    // Merge and rank by recency + relevance
    return this.mergeAndRank(episodic, semantic);
  }

  /**
   * Human-like forgetting curve
   * Less-used information gradually fades unless reinforced
   */
  async applyForgettingCurve(): Promise<void> {
    if (!this.config.forgettingCurveEnabled) return;

    const memories = await this.episodicStore.getAll();

    for (const memory of memories) {
      const strength = this.calculateStrength(memory);

      if (strength < this.config.forgettingThreshold) {
        // Consolidate to semantic or forget
        if (memory.importance > 0.7) {
          await this.consolidateToSemantic(memory);
        }
        await this.episodicStore.archive(memory.id);
      }
    }
  }
}
```

**Integration with Memory Bank**:

Enhance the existing `.claude/memory/` structure:

```
.claude/memory/
├── scratchpad/                    # NEW: Active working memory
│   ├── current-context.md         # Token-limited active context
│   └── reasoning-trace.md         # Chain-of-thought log
├── episodic/                      # NEW: Time-based memories
│   ├── sessions/
│   └── interactions/
├── semantic/                      # NEW: Consolidated knowledge
│   ├── patterns.md
│   ├── decisions.md
│   └── domain-knowledge/
└── sessions/                      # Existing session structure
    └── {session-id}/
```

### 2.4 Dynamic System Prompting

**Enhancement to CLAUDE.md Generation**

Implement context-aware prompt switching based on current task domain.

**New Feature**: `packages/@wundr/mcp-tools/src/dynamic-prompting.ts`

```typescript
export interface DynamicPromptConfig {
  personas: Map<string, PersonaConfig>;
  contextDetectors: ContextDetector[];
  mergeStrategy: 'replace' | 'augment' | 'layer';
}

export interface PersonaConfig {
  name: string;
  systemPrompt: string;
  tools: string[];
  style: {
    tone: 'professional' | 'casual' | 'technical';
    verbosity: 'concise' | 'detailed';
  };
}

export class DynamicPromptManager {
  /**
   * Hot-swap system prompt based on detected context
   * Implements Dynamic Prompting from the document
   */
  async resolveSystemPrompt(context: ConversationContext): Promise<string> {
    // 1. Detect domain/task type
    const detectedDomain = await this.detectDomain(context);

    // 2. Select appropriate persona
    const persona = this.personas.get(detectedDomain) || this.personas.get('default');

    // 3. Merge with base prompt
    return this.mergePrompts(this.basePrompt, persona.systemPrompt);
  }

  /**
   * Generate persona library for project
   */
  async generatePersonaLibrary(projectType: string): Promise<PersonaConfig[]> {
    const basePersonas = [
      {
        name: 'software-engineer',
        systemPrompt: await this.loadTemplate('software-engineer'),
        tools: ['edit', 'bash', 'git', 'test'],
        style: { tone: 'technical', verbosity: 'detailed' },
      },
      {
        name: 'project-manager',
        systemPrompt: await this.loadTemplate('project-manager'),
        tools: ['read', 'write', 'github'],
        style: { tone: 'professional', verbosity: 'concise' },
      },
      {
        name: 'code-reviewer',
        systemPrompt: await this.loadTemplate('code-reviewer'),
        tools: ['read', 'grep', 'glob'],
        style: { tone: 'technical', verbosity: 'detailed' },
      },
    ];

    return basePersonas;
  }
}
```

---

## Part 3: MCP Protocol Enhancements

### 3.1 Enhanced MCP Server Architecture

Based on the MCP architecture described in the Dynamic Context document.

**Enhancement to `packages/@wundr/mcp-server/`**

```typescript
// Enhanced MCP server with lifecycle management and security

export interface MCPServerConfig {
  name: string;
  version: string;
  transport: 'stdio' | 'sse' | 'websocket';
  capabilities: {
    tools: ToolDefinition[];
    resources: ResourceDefinition[];
    prompts: PromptDefinition[];
  };
  security: {
    authentication: 'none' | 'token' | 'oauth';
    authorization: AuthorizationPolicy;
    auditLogging: boolean;
  };
  lifecycle: {
    healthCheck: boolean;
    gracefulShutdown: boolean;
    connectionTimeout: number;
  };
}

export class EnhancedMCPServer {
  /**
   * Dynamic capability advertisement
   * Client discovers tools at runtime
   */
  async advertiseCapabilities(clientContext: ClientContext): Promise<Capabilities> {
    // Filter capabilities based on client permissions
    const permitted = this.filterByPermissions(this.capabilities, clientContext.permissions);

    // Return only relevant tools for current session
    return {
      tools: permitted.tools,
      resources: permitted.resources,
      prompts: permitted.prompts,
      protocolVersion: this.protocolVersion,
    };
  }

  /**
   * Tool whitelisting for safety
   */
  configureToolWhitelist(whitelist: string[]): void {
    this.toolWhitelist = new Set(whitelist);
  }

  /**
   * Audit logging for all tool invocations
   */
  async invokeToolWithAudit(
    toolName: string,
    params: unknown,
    context: InvocationContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      // Check whitelist
      if (this.toolWhitelist && !this.toolWhitelist.has(toolName)) {
        throw new Error(`Tool ${toolName} not in whitelist`);
      }

      const result = await this.tools.get(toolName)?.execute(params);

      // Audit log
      await this.auditLog({
        timestamp: new Date(),
        toolName,
        params: this.sanitizeParams(params),
        result: 'success',
        duration: Date.now() - startTime,
        agentId: context.agentId,
        sessionId: context.sessionId,
      });

      return result;
    } catch (error) {
      await this.auditLog({
        timestamp: new Date(),
        toolName,
        params: this.sanitizeParams(params),
        result: 'error',
        error: error.message,
        duration: Date.now() - startTime,
        agentId: context.agentId,
        sessionId: context.sessionId,
      });
      throw error;
    }
  }
}
```

### 3.2 MCP Server Registry and Discovery

**New Module**: `packages/@wundr/mcp-registry/`

```
packages/@wundr/mcp-registry/
├── src/
│   ├── index.ts
│   ├── registry.ts               # Server catalog
│   ├── discovery.ts              # Dynamic server discovery
│   ├── aggregator.ts             # Super MCP pattern
│   └── health-monitor.ts         # Server health tracking
└── package.json
```

**Implementation**:

```typescript
// packages/@wundr/mcp-registry/src/registry.ts

export interface MCPServerRegistration {
  name: string;
  endpoint: string;
  transport: 'stdio' | 'sse' | 'websocket';
  capabilities: string[];
  healthEndpoint?: string;
  metadata: {
    description: string;
    version: string;
    owner: string;
    tags: string[];
  };
}

export class MCPServerRegistry {
  private servers: Map<string, MCPServerRegistration> = new Map();

  /**
   * Register a new MCP server
   */
  async register(server: MCPServerRegistration): Promise<void> {
    // Validate server is reachable
    await this.validateServer(server);

    this.servers.set(server.name, server);

    // Index capabilities for search
    await this.indexCapabilities(server);
  }

  /**
   * Discover servers by capability
   * Enables dynamic server discovery as described in the document
   */
  async discoverByCapability(capability: string): Promise<MCPServerRegistration[]> {
    return Array.from(this.servers.values()).filter(s => s.capabilities.includes(capability));
  }

  /**
   * Health check all registered servers
   */
  async healthCheckAll(): Promise<Map<string, HealthStatus>> {
    const results = new Map<string, HealthStatus>();

    await Promise.all(
      Array.from(this.servers.entries()).map(async ([name, server]) => {
        try {
          const healthy = await this.checkHealth(server);
          results.set(name, { healthy, lastCheck: new Date() });
        } catch {
          results.set(name, { healthy: false, lastCheck: new Date() });
        }
      })
    );

    return results;
  }
}

/**
 * Super MCP Server - Aggregator Pattern
 * Routes requests to appropriate underlying servers
 */
export class MCPAggregator {
  constructor(private registry: MCPServerRegistry) {}

  /**
   * Route tool call to appropriate server
   */
  async routeToolCall(toolName: string, params: unknown): Promise<ToolResult> {
    // Parse namespace (e.g., "database.query" -> server: "database")
    const [namespace, method] = toolName.split('.');

    // Find server that handles this namespace
    const servers = await this.registry.discoverByCapability(namespace);

    if (servers.length === 0) {
      throw new Error(`No server found for capability: ${namespace}`);
    }

    // Load balance across healthy servers
    const server = await this.selectHealthyServer(servers);

    // Forward request
    return this.forwardRequest(server, method, params);
  }
}
```

### 3.3 MCP Tools for computer-setup and project-init

**New MCP Tools to Add**:

```yaml
# .claude/mcp-tools/setup-tools.yaml

tools:
  - name: environment_detect
    description: Detect current development environment and installed tools
    handler: packages/@wundr/mcp-server/src/tools/environment-detect.ts

  - name: tool_install
    description: Install development tools with idempotent checks
    handler: packages/@wundr/mcp-server/src/tools/tool-install.ts

  - name: config_generate
    description: Generate configuration files from templates
    handler: packages/@wundr/mcp-server/src/tools/config-generate.ts

  - name: project_scaffold
    description: Scaffold new project with templates
    handler: packages/@wundr/mcp-server/src/tools/project-scaffold.ts

  - name: agent_spawn
    description: Spawn specialized sub-agents for tasks
    handler: packages/@wundr/mcp-server/src/tools/agent-spawn.ts

  - name: memory_manage
    description: Manage agent memory (store, retrieve, compact)
    handler: packages/@wundr/mcp-server/src/tools/memory-manage.ts

  - name: governance_check
    description: Run governance and alignment checks
    handler: packages/@wundr/mcp-server/src/tools/governance-check.ts
```

---

## Part 4: Orchestration Framework Integration

### 4.1 LangGraph Integration

**New Module**: `packages/@wundr/langgraph-orchestrator/`

Implements the cyclic, state-driven workflows described in the document.

```
packages/@wundr/langgraph-orchestrator/
├── src/
│   ├── index.ts
│   ├── state-graph.ts            # Graph definition utilities
│   ├── nodes/                    # Reusable node types
│   │   ├── llm-node.ts
│   │   ├── tool-node.ts
│   │   ├── decision-node.ts
│   │   └── human-node.ts
│   ├── edges/                    # Edge conditions
│   │   ├── conditional-edge.ts
│   │   └── loop-edge.ts
│   ├── checkpointing.ts          # State persistence
│   └── prebuilt-graphs/          # Ready-to-use workflows
│       ├── plan-execute-refine.ts
│       ├── research-synthesize.ts
│       └── code-review-loop.ts
└── package.json
```

**Implementation**:

```typescript
// packages/@wundr/langgraph-orchestrator/src/state-graph.ts

import { StateGraph, START, END } from '@langchain/langgraph';

export interface AgentState {
  messages: Message[];
  plan: string | null;
  currentStep: number;
  results: Record<string, unknown>;
  errors: Error[];
  shouldContinue: boolean;
}

/**
 * Create LangGraph workflow for Plan-Execute-Refine pattern
 * Based on LangGraph description in Dynamic Context document
 */
export function createPlanExecuteRefineGraph(): StateGraph<AgentState> {
  const graph = new StateGraph<AgentState>({
    channels: {
      messages: { value: (a, b) => [...a, ...b], default: () => [] },
      plan: { value: (_, b) => b, default: () => null },
      currentStep: { value: (_, b) => b, default: () => 0 },
      results: { value: (a, b) => ({ ...a, ...b }), default: () => ({}) },
      errors: { value: (a, b) => [...a, ...b], default: () => [] },
      shouldContinue: { value: (_, b) => b, default: () => true },
    },
  });

  // Add nodes
  graph.addNode('planner', plannerNode);
  graph.addNode('executor', executorNode);
  graph.addNode('critic', criticNode);
  graph.addNode('refiner', refinerNode);

  // Define edges with conditions
  graph.addEdge(START, 'planner');
  graph.addEdge('planner', 'executor');
  graph.addConditionalEdges('executor', shouldCritique, {
    critique: 'critic',
    complete: END,
  });
  graph.addConditionalEdges('critic', needsRefinement, {
    refine: 'refiner',
    accept: END,
  });
  graph.addEdge('refiner', 'executor'); // Loop back

  return graph;
}

/**
 * Checkpointing for state persistence
 * Enables pause/resume and time-travel debugging
 */
export class GraphCheckpointer {
  async saveCheckpoint(graphId: string, state: AgentState): Promise<string> {
    const checkpointId = `${graphId}-${Date.now()}`;
    await this.storage.save(checkpointId, state);
    return checkpointId;
  }

  async loadCheckpoint(checkpointId: string): Promise<AgentState> {
    return this.storage.load(checkpointId);
  }

  async rewindTo(checkpointId: string): Promise<AgentState> {
    const state = await this.loadCheckpoint(checkpointId);
    return state;
  }
}
```

### 4.2 CrewAI-Style Team Orchestration

**New Module**: `packages/@wundr/crew-orchestrator/`

```typescript
// packages/@wundr/crew-orchestrator/src/crew.ts

export interface CrewMember {
  role: string;
  goal: string;
  backstory: string;
  tools: string[];
  allowDelegation: boolean;
}

export interface CrewConfig {
  name: string;
  process: 'sequential' | 'hierarchical' | 'consensus';
  members: CrewMember[];
  manager?: CrewMember;
  tasks: Task[];
}

export class AgentCrew {
  /**
   * Implements CrewAI pattern from Dynamic Context document
   * Role-based multi-agent collaboration
   */
  async execute(config: CrewConfig): Promise<CrewResult> {
    const { process, members, tasks } = config;

    switch (process) {
      case 'sequential':
        return this.executeSequential(members, tasks);

      case 'hierarchical':
        return this.executeHierarchical(config.manager!, members, tasks);

      case 'consensus':
        return this.executeConsensus(members, tasks);
    }
  }

  /**
   * Hierarchical execution with manager delegation
   */
  private async executeHierarchical(
    manager: CrewMember,
    workers: CrewMember[],
    tasks: Task[]
  ): Promise<CrewResult> {
    const results: TaskResult[] = [];

    for (const task of tasks) {
      // Manager decides who handles the task
      const assignee = await this.managerDelegate(manager, workers, task);

      // Worker executes
      const result = await this.executeTask(assignee, task);

      // Manager reviews
      const reviewed = await this.managerReview(manager, result);

      if (!reviewed.approved) {
        // Reassign or refine
        const refined = await this.refineTask(task, reviewed.feedback);
        results.push(await this.executeTask(assignee, refined));
      } else {
        results.push(result);
      }
    }

    return { tasks: results, process: 'hierarchical' };
  }

  /**
   * Delegation between agents
   */
  private async delegateTask(from: CrewMember, to: CrewMember, subtask: Task): Promise<TaskResult> {
    if (!from.allowDelegation) {
      throw new Error(`Agent ${from.role} cannot delegate`);
    }

    return this.executeTask(to, subtask);
  }
}
```

### 4.3 AutoGen-Style Conversational Orchestration

**New Module**: `packages/@wundr/autogen-orchestrator/`

```typescript
// packages/@wundr/autogen-orchestrator/src/group-chat.ts

export interface ChatParticipant {
  name: string;
  systemPrompt: string;
  speakingPriority: number;
  canInitiate: boolean;
}

export interface GroupChatConfig {
  participants: ChatParticipant[];
  maxRounds: number;
  terminationCondition: (messages: Message[]) => boolean;
  speakerSelection: 'round-robin' | 'llm-selected' | 'priority';
}

export class GroupChatManager {
  /**
   * Implements AutoGen pattern from Dynamic Context document
   * Conversational multi-agent coordination
   */
  async orchestrateChat(initialMessage: string, config: GroupChatConfig): Promise<ChatResult> {
    const messages: Message[] = [{ role: 'user', content: initialMessage }];
    let round = 0;

    while (round < config.maxRounds && !config.terminationCondition(messages)) {
      // Select next speaker
      const speaker = await this.selectSpeaker(messages, config);

      // Generate response
      const response = await this.generateResponse(speaker, messages);
      messages.push({ role: speaker.name, content: response });

      // Check for nested chat request
      if (this.isNestedChatRequest(response)) {
        const nestedResult = await this.handleNestedChat(response, config);
        messages.push({ role: 'system', content: `Nested result: ${nestedResult}` });
      }

      round++;
    }

    return { messages, rounds: round };
  }

  /**
   * LLM-based speaker selection
   * Model decides who should respond next based on conversation
   */
  private async selectSpeakerByLLM(
    messages: Message[],
    participants: ChatParticipant[]
  ): Promise<ChatParticipant> {
    const prompt = `Given this conversation, which participant should speak next?

Participants:
${participants.map(p => `- ${p.name}: ${p.systemPrompt}`).join('\n')}

Conversation:
${messages.map(m => `${m.role}: ${m.content}`).join('\n')}

Select the most appropriate next speaker:`;

    const selection = await this.llm.generate(prompt);
    return participants.find(p => p.name === selection) || participants[0];
  }

  /**
   * Nested chat for sub-discussions
   */
  private async handleNestedChat(request: string, parentConfig: GroupChatConfig): Promise<string> {
    // Extract nested chat configuration
    const nestedConfig = this.parseNestedRequest(request);

    // Run nested conversation
    const result = await this.orchestrateChat(nestedConfig.query, {
      ...parentConfig,
      ...nestedConfig,
    });

    // Summarize and return to parent
    return this.summarizeChat(result);
  }
}
```

---

## Part 5: Structured Output and Validation

### 5.1 Pydantic-Style Validation for TypeScript

**Enhancement to existing Zod usage with Instructor patterns**

**New Module**: `packages/@wundr/structured-output/`

```typescript
// packages/@wundr/structured-output/src/instructor.ts

import { z } from 'zod';

export interface InstructorConfig {
  maxRetries: number;
  validationMode: 'strict' | 'coerce' | 'passthrough';
  streamPartial: boolean;
}

export class StructuredOutputGenerator {
  /**
   * Implements Instructor pattern from Dynamic Context document
   * LLM output validation with retry loop
   */
  async generate<T extends z.ZodType>(
    schema: T,
    prompt: string,
    config: InstructorConfig = { maxRetries: 3, validationMode: 'strict', streamPartial: false }
  ): Promise<z.infer<T>> {
    let attempts = 0;
    let lastError: z.ZodError | null = null;

    while (attempts < config.maxRetries) {
      try {
        // Generate with function calling
        const response = await this.llm.generateWithSchema(prompt, schema);

        // Validate against schema
        const parsed = schema.parse(response);
        return parsed;
      } catch (error) {
        if (error instanceof z.ZodError) {
          lastError = error;

          // Self-healing: feed error back to model
          prompt = this.buildRetryPrompt(prompt, error);
          attempts++;
        } else {
          throw error;
        }
      }
    }

    throw new Error(
      `Failed to generate valid output after ${config.maxRetries} attempts. Last error: ${lastError?.message}`
    );
  }

  /**
   * Build retry prompt with validation errors
   */
  private buildRetryPrompt(originalPrompt: string, error: z.ZodError): string {
    const errorDetails = error.errors.map(e => `- ${e.path.join('.')}: ${e.message}`).join('\n');

    return `${originalPrompt}

Your previous response did not match the required format. Please fix these issues:
${errorDetails}

Please try again and ensure your response matches the schema exactly.`;
  }

  /**
   * Streaming partial objects
   * Return data as soon as it's valid
   */
  async *streamPartial<T extends z.ZodType>(
    schema: T,
    prompt: string
  ): AsyncGenerator<Partial<z.infer<T>>> {
    const stream = this.llm.streamWithSchema(prompt, schema);

    for await (const chunk of stream) {
      try {
        // Try to parse partial
        const partial = schema.partial().parse(chunk);
        yield partial;
      } catch {
        // Skip invalid partials
        continue;
      }
    }
  }
}
```

### 5.2 Constrained Decoding for Code Generation

**New Module**: `packages/@wundr/constrained-output/`

```typescript
// packages/@wundr/constrained-output/src/grammar-enforcer.ts

export interface GrammarConstraint {
  type: 'regex' | 'json-schema' | 'peg-grammar';
  constraint: string;
}

export class GrammarEnforcer {
  /**
   * Implements Outlines/Guidance pattern from Dynamic Context document
   * Guarantee syntactic validity of output
   */
  async generateConstrained(prompt: string, grammar: GrammarConstraint): Promise<string> {
    switch (grammar.type) {
      case 'regex':
        return this.generateWithRegex(prompt, grammar.constraint);
      case 'json-schema':
        return this.generateWithJsonSchema(prompt, grammar.constraint);
      case 'peg-grammar':
        return this.generateWithPEG(prompt, grammar.constraint);
    }
  }

  /**
   * Generate valid JSON matching a schema
   */
  async generateValidJSON<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
    const jsonSchema = zodToJsonSchema(schema);

    const result = await this.generateConstrained(prompt, {
      type: 'json-schema',
      constraint: JSON.stringify(jsonSchema),
    });

    return JSON.parse(result);
  }

  /**
   * Generate syntactically valid code
   */
  async generateValidCode(
    prompt: string,
    language: 'typescript' | 'python' | 'sql'
  ): Promise<string> {
    const grammar = this.getLanguageGrammar(language);

    return this.generateConstrained(prompt, {
      type: 'peg-grammar',
      constraint: grammar,
    });
  }
}
```

---

## Part 6: Configuration and Templating

### 6.1 Hydra-Inspired Configuration System

**New Module**: `packages/@wundr/hydra-config/`

```typescript
// packages/@wundr/hydra-config/src/composer.ts

export interface ConfigGroup {
  name: string;
  path: string;
  defaults: string[];
}

export interface HydraConfig {
  configPath: string;
  groups: ConfigGroup[];
  overrides: Record<string, unknown>;
}

export class ConfigComposer {
  /**
   * Implements Hydra pattern from Dynamic Context document
   * Hierarchical configuration composition
   */
  async compose(config: HydraConfig): Promise<ComposedConfig> {
    // 1. Load base config
    let composed = await this.loadYaml(path.join(config.configPath, 'config.yaml'));

    // 2. Compose config groups
    for (const group of config.groups) {
      for (const defaultName of group.defaults) {
        const groupConfig = await this.loadYaml(
          path.join(config.configPath, group.path, `${defaultName}.yaml`)
        );
        composed = this.deepMerge(composed, groupConfig);
      }
    }

    // 3. Apply runtime overrides
    composed = this.applyOverrides(composed, config.overrides);

    // 4. Resolve interpolations (${...} references)
    composed = this.resolveInterpolations(composed);

    return composed;
  }

  /**
   * Command-line override support
   * e.g., --config agent.model=gpt-4 agent.temperature=0.1
   */
  parseCliOverrides(args: string[]): Record<string, unknown> {
    const overrides: Record<string, unknown> = {};

    for (const arg of args) {
      if (arg.includes('=')) {
        const [key, value] = arg.split('=');
        this.setNested(overrides, key, this.parseValue(value));
      }
    }

    return overrides;
  }

  /**
   * Variable interpolation
   * ${llm.model} references another config value
   */
  private resolveInterpolations(config: Record<string, unknown>): Record<string, unknown> {
    const interpolationRegex = /\$\{([^}]+)\}/g;

    const resolve = (obj: unknown): unknown => {
      if (typeof obj === 'string') {
        return obj.replace(interpolationRegex, (_, path) => {
          return this.getNested(config, path) ?? '';
        });
      }
      if (Array.isArray(obj)) {
        return obj.map(resolve);
      }
      if (typeof obj === 'object' && obj !== null) {
        return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, resolve(v)]));
      }
      return obj;
    };

    return resolve(config) as Record<string, unknown>;
  }
}
```

**Configuration Structure for Agents**:

```yaml
# .claude/config/config.yaml (base)
defaults:
  - llm: sonnet
  - memory: standard
  - tools: full

agent:
  name: ${env:AGENT_NAME}
  tier: ${llm.tier}

logging:
  level: info
  format: json

# .claude/config/llm/sonnet.yaml
tier: 2
model: claude-sonnet-4-5
temperature: 0.7
maxTokens: 4096

# .claude/config/llm/haiku.yaml
tier: 3
model: claude-3-5-haiku
temperature: 0.3
maxTokens: 2048

# .claude/config/memory/standard.yaml
scratchpadTokens: 8000
episodicRetentionDays: 30
forgettingEnabled: true

# .claude/config/tools/full.yaml
mcpServers:
  - wundr
  - filesystem
  - git
jitToolsEnabled: true
maxTools: 10
```

### 6.2 Jinja2-Style Prompt Templating

**New Module**: `packages/@wundr/prompt-templates/`

```typescript
// packages/@wundr/prompt-templates/src/engine.ts

import Handlebars from 'handlebars';

export interface PromptTemplateConfig {
  templateDir: string;
  macros: Record<string, string>;
  helpers: Record<string, (...args: unknown[]) => string>;
}

export class PromptTemplateEngine {
  /**
   * Implements Jinja2 pattern from Dynamic Context document
   * Dynamic prompt generation with logic
   */
  async render(templateName: string, context: Record<string, unknown>): Promise<string> {
    const template = await this.loadTemplate(templateName);
    const compiled = Handlebars.compile(template);
    return compiled(context);
  }

  /**
   * Register reusable macros
   */
  registerMacro(name: string, template: string): void {
    Handlebars.registerPartial(name, template);
  }

  /**
   * Register custom helpers
   */
  registerHelper(name: string, fn: (...args: unknown[]) => string): void {
    Handlebars.registerHelper(name, fn);
  }
}

// Built-in helpers
export const builtInHelpers = {
  // Format tool list
  formatTools: (tools: ToolSpec[]) => tools.map(t => `- ${t.name}: ${t.description}`).join('\n'),

  // Conditional sections
  ifDefined: (value: unknown, options: Handlebars.HelperOptions) =>
    value !== undefined ? options.fn(this) : options.inverse(this),

  // Format code
  codeBlock: (code: string, language: string) => `\`\`\`${language}\n${code}\n\`\`\``,

  // Format memory context
  formatMemory: (memories: Memory[]) => memories.map(m => `[${m.type}] ${m.summary}`).join('\n'),
};
```

**Example Prompt Templates**:

```handlebars
{{!-- .claude/prompts/agent-system.hbs --}}
{{> chain-of-thought-prefix }}

You are {{agent.name}}, a {{agent.role}} agent.

{{#if userProfile}}
## User Context
The user is a {{userProfile.industry}} professional seeking {{userProfile.objective}}.
{{/if}}

## Your Task
{{task.description}}

{{#if tools}}
## Available Tools
{{formatTools tools}}
{{/if}}

{{#if memories}}
## Relevant Context
{{formatMemory memories}}
{{/if}}

{{> standard-guidelines }}
```

```handlebars
{{! .claude/prompts/partials/chain-of-thought-prefix.hbs }}
Before responding, think through the problem step by step: 1. Understand what is being asked 2.
Identify the key components 3. Plan your approach 4. Execute systematically 5. Verify your solution
```

---

## Part 7: User Interface Enhancements

### 7.1 Chainlit Integration

**New Module**: `packages/@wundr/chainlit-ui/`

```typescript
// packages/@wundr/chainlit-ui/src/app.ts

export interface ChainlitConfig {
  name: string;
  showThoughtProcess: boolean;
  enableFileUpload: boolean;
  customComponents: ComponentDefinition[];
}

export class ChainlitApp {
  /**
   * Create Chainlit-style conversational UI
   * Based on Chainlit description in Dynamic Context document
   */
  async configure(config: ChainlitConfig): Promise<void> {
    this.app = new Chainlit({
      name: config.name,

      // Show agent reasoning
      onThinking: config.showThoughtProcess ? thought => this.displayThought(thought) : undefined,

      // Handle file uploads
      onFileUpload: config.enableFileUpload ? file => this.processFile(file) : undefined,
    });
  }

  /**
   * Display agent chain-of-thought
   */
  async displayThought(thought: string): Promise<void> {
    await this.app.send({
      type: 'thought',
      content: thought,
      collapsed: true, // User can expand
    });
  }

  /**
   * Display interactive components
   */
  async displayComponent(component: UIComponent): Promise<void> {
    await this.app.send({
      type: 'component',
      component: component,
    });
  }

  /**
   * Request user action
   */
  async requestAction(options: ActionOptions): Promise<string> {
    const response = await this.app.ask({
      type: 'action',
      options: options.choices,
      prompt: options.prompt,
    });
    return response.selected;
  }
}
```

### 7.2 Generative UI Components

**Enhancement to `packages/@wundr/dashboard/`**

```typescript
// packages/@wundr/dashboard/components/generative-ui/index.tsx

import { StreamableComponent } from '@vercel/ai-sdk';

export interface GenerativeUIConfig {
  allowedComponents: string[];
  sandboxMode: boolean;
}

/**
 * Render LLM-generated UI components
 * Based on Vercel AI SDK Generative UI from document
 */
export function GenerativeUIRenderer({
  componentSpec,
  config,
}: {
  componentSpec: ComponentSpec;
  config: GenerativeUIConfig;
}): React.ReactNode {
  // Validate component is allowed
  if (!config.allowedComponents.includes(componentSpec.type)) {
    return <FallbackComponent spec={componentSpec} />;
  }

  // Render based on type
  switch (componentSpec.type) {
    case 'chart':
      return <ChartComponent {...componentSpec.props} />;
    case 'table':
      return <TableComponent {...componentSpec.props} />;
    case 'form':
      return <FormComponent {...componentSpec.props} />;
    case 'code':
      return <CodeComponent {...componentSpec.props} />;
    default:
      return <FallbackComponent spec={componentSpec} />;
  }
}

/**
 * Stream React Server Components from agent
 */
export async function* streamComponents(
  agentResponse: AsyncIterable<ComponentSpec>
): AsyncGenerator<React.ReactNode> {
  for await (const spec of agentResponse) {
    yield <GenerativeUIRenderer componentSpec={spec} config={defaultConfig} />;
  }
}
```

---

## Part 8: Security and Governance Enhancements

### 8.1 Prompt Injection Defense Patterns

**New Module**: `packages/@wundr/prompt-security/`

```typescript
// packages/@wundr/prompt-security/src/action-interceptor.ts

export interface SecurityConfig {
  actionSelectorModel: string; // Separate model for action decisions
  contextMinimization: boolean;
  outputFiltering: boolean;
  sensitivePatterns: RegExp[];
}

export class ActionInterceptor {
  /**
   * Implements Action-Selector pattern from Dynamic Context document
   * Isolate action decisions from execution
   */
  async processRequest(userInput: string, availableActions: Action[]): Promise<SecureActionResult> {
    // 1. Sanitize user input
    const sanitized = await this.sanitizeInput(userInput);

    // 2. Use separate model for action selection
    const selectedAction = await this.selectAction(sanitized, availableActions);

    // 3. Validate action against policies
    const validated = await this.validateAction(selectedAction);

    // 4. Execute in sandbox if sensitive
    if (validated.riskLevel === 'high') {
      return this.executeInSandbox(validated);
    }

    return this.execute(validated);
  }

  /**
   * Context minimization
   * Never let untrusted content share context with sensitive instructions
   */
  async minimizeContext(systemPrompt: string, untrustedContent: string): Promise<SeparatedContext> {
    // Summarize untrusted content first
    const summary = await this.summarizeUntrusted(untrustedContent);

    return {
      systemContext: systemPrompt,
      userContext: summary,
      separated: true,
    };
  }

  /**
   * Output filtering for sensitive data
   */
  filterOutput(output: string): string {
    for (const pattern of this.config.sensitivePatterns) {
      output = output.replace(pattern, '[REDACTED]');
    }
    return output;
  }
}
```

### 8.2 Enhanced Access Control for MCP

**Enhancement to MCP server security**:

```typescript
// packages/@wundr/mcp-server/src/security/access-control.ts

export interface AccessPolicy {
  agentId: string;
  allowedTools: string[];
  deniedTools: string[];
  requiresApproval: string[];
  riskTolerances: Record<string, 'low' | 'medium' | 'high'>;
}

export class MCPAccessController {
  /**
   * Verify agent authorization for tool
   */
  async authorize(
    agentId: string,
    toolName: string,
    context: InvocationContext
  ): Promise<AuthorizationResult> {
    const policy = await this.getPolicy(agentId);

    // Check explicit deny
    if (policy.deniedTools.includes(toolName)) {
      return { authorized: false, reason: 'Tool explicitly denied' };
    }

    // Check explicit allow
    if (!policy.allowedTools.includes(toolName) && !policy.allowedTools.includes('*')) {
      return { authorized: false, reason: 'Tool not in allowlist' };
    }

    // Check if approval required
    if (policy.requiresApproval.includes(toolName)) {
      return {
        authorized: 'pending',
        reason: 'Requires human approval',
        approvalRequest: this.createApprovalRequest(agentId, toolName, context),
      };
    }

    return { authorized: true };
  }

  /**
   * Audience verification for tokens
   */
  verifyTokenAudience(token: JWTToken, expectedAudience: string): boolean {
    return token.aud === expectedAudience;
  }
}
```

---

## Part 9: Scaffolding and Templates

### 9.1 Cookiecutter-Style Project Generation

**Enhancement to `packages/@wundr/project-templates/`**

```typescript
// packages/@wundr/project-templates/src/generator.ts

export interface TemplateConfig {
  name: string;
  version: string;
  variables: VariableDefinition[];
  hooks: {
    preGenerate?: string;
    postGenerate?: string;
  };
}

export class ProjectGenerator {
  /**
   * Implements Cookiecutter pattern from Dynamic Context document
   * Generate project from template with variables
   */
  async generate(
    templateName: string,
    outputPath: string,
    variables: Record<string, string>
  ): Promise<GenerationResult> {
    // 1. Load template
    const template = await this.loadTemplate(templateName);

    // 2. Run pre-generate hook
    if (template.hooks.preGenerate) {
      await this.runHook(template.hooks.preGenerate, variables);
    }

    // 3. Process all files with variable substitution
    const files = await this.processTemplate(template, variables);

    // 4. Write files
    for (const file of files) {
      const destPath = this.processPath(file.path, variables);
      await fs.writeFile(path.join(outputPath, destPath), file.content);
    }

    // 5. Run post-generate hook
    if (template.hooks.postGenerate) {
      await this.runHook(template.hooks.postGenerate, variables);
    }

    return {
      filesGenerated: files.length,
      outputPath,
      template: templateName,
    };
  }

  /**
   * Process file paths with variable substitution
   * e.g., {{project_name}}/src/index.ts
   */
  private processPath(templatePath: string, variables: Record<string, string>): string {
    return templatePath.replace(/\{\{(\w+)\}\}/g, (_, varName) => variables[varName] || varName);
  }
}
```

### 9.2 Agent Template Library

**New Templates in `packages/@wundr/project-templates/agents/`**

```yaml
# Agent template structure
templates/agents/ ├── basic-agent/ │   ├── cookiecutter.json │   ├── {{agent_name}}/ │   │   ├──
agent.md │   │   ├── config.yaml │   │   └── prompts/ │   │       └── system.hbs │   └── hooks/
│       └── post_generate.sh ├── crew-team/ │   ├── cookiecutter.json │   ├── {{team_name}}/
│   │   ├── crew.yaml │   │   ├── agents/ │   │   │   └── {{#each agents}}{{name}}.md{{/each}}
│   │   └── tasks/ │   └── hooks/ ├── langgraph-workflow/ │   ├── cookiecutter.json │   ├──
{{workflow_name}}/ │   │   ├── graph.ts │   │   ├── nodes/ │   │   └── config.yaml │   └── hooks/
└── mcp-server/ ├── cookiecutter.json ├── {{server_name}}/ │   ├── src/ │   │   ├── index.ts
│   │   └── tools/ │   └── package.json └── hooks/
```

---

## Part 10: Integration with computer-setup and project-init

### 10.1 computer-setup Enhancements

**New Options for Global Instance Setup**:

```typescript
// packages/@wundr/cli/src/commands/computer-setup.ts

interface EnhancedSetupOptions {
  // Existing options...

  // New context engineering options
  enableJITTools: boolean; // Just-In-Time tool loading
  enableAgenticRAG: boolean; // Agentic RAG system
  memoryArchitecture: 'basic' | 'tiered' | 'memgpt';

  // Orchestration framework options
  installLangGraph: boolean;
  installCrewAI: boolean;
  installAutoGen: boolean;

  // Configuration options
  configSystem: 'yaml' | 'hydra';
  promptTemplating: 'static' | 'jinja';

  // Security options
  promptSecurityLevel: 'basic' | 'enhanced' | 'paranoid';
  mcpAccessControl: boolean;

  // UI options
  installChainlit: boolean;
  enableGenerativeUI: boolean;
}

async function setupContextEngineering(options: EnhancedSetupOptions): Promise<void> {
  if (options.enableJITTools) {
    await installPackage('@wundr.io/jit-tools');
    await deployToolRegistry();
  }

  if (options.enableAgenticRAG) {
    await installPackage('@wundr.io/rag-utils');
    await configureAgenticRAG();
  }

  if (options.memoryArchitecture === 'memgpt') {
    await installPackage('@wundr.io/agent-memory');
    await deployMemoryTemplates();
  }
}

async function setupOrchestrationFrameworks(options: EnhancedSetupOptions): Promise<void> {
  if (options.installLangGraph) {
    await installPackage('@langchain/langgraph');
    await installPackage('@wundr.io/langgraph-orchestrator');
  }

  if (options.installCrewAI) {
    // Python package
    await installPythonPackage('crewai');
    await installPackage('@wundr.io/crew-orchestrator');
  }

  if (options.installAutoGen) {
    // Python package
    await installPythonPackage('pyautogen');
    await installPackage('@wundr.io/autogen-orchestrator');
  }
}
```

### 10.2 project-init Enhancements

**New Options for Project Initialization**:

```typescript
// packages/@wundr/computer-setup/src/project-init/project-initializer.ts

interface EnhancedProjectOptions extends ProjectInitOptions {
  // Context engineering
  contextEngineering: {
    jitToolsEnabled: boolean;
    toolWhitelist?: string[];
    maxToolsPerContext: number;
  };

  // Memory configuration
  memoryConfig: {
    architecture: 'basic' | 'tiered' | 'memgpt';
    scratchpadTokenLimit: number;
    episodicRetentionDays: number;
  };

  // Orchestration
  orchestration: {
    framework: 'claude-flow' | 'langgraph' | 'crewai' | 'autogen' | 'hybrid';
    prebuiltWorkflows: string[];
  };

  // Prompt management
  promptConfig: {
    templating: 'static' | 'handlebars';
    dynamicPersonas: boolean;
    macroLibrary: string[];
  };

  // Configuration
  configManagement: {
    system: 'yaml' | 'hydra';
    environments: string[];
    secretsProvider?: 'env' | 'vault';
  };

  // Security
  security: {
    promptInjectionDefense: boolean;
    actionInterceptor: boolean;
    mcpAccessPolicies: boolean;
  };
}

async function initializeEnhancedProject(options: EnhancedProjectOptions): Promise<void> {
  // Standard initialization
  await this.setupDirectories(options);
  await this.deployAgentTemplates(options);

  // Context engineering setup
  if (options.contextEngineering.jitToolsEnabled) {
    await this.setupJITTooling(options);
  }

  // Memory architecture
  await this.setupMemoryArchitecture(options.memoryConfig);

  // Orchestration framework
  await this.setupOrchestration(options.orchestration);

  // Prompt templating
  await this.setupPromptTemplates(options.promptConfig);

  // Configuration system
  await this.setupConfigSystem(options.configManagement);

  // Security layers
  await this.setupSecurity(options.security);
}
```

### 10.3 New CLI Commands

```typescript
// New commands to add

// Context management
'wundr context analyze'; // Analyze current context usage
'wundr context compact'; // Compact context using summarization
'wundr tools discover'; // Discover available tools for intent

// Memory management
'wundr memory status'; // Show memory tier usage
'wundr memory compact'; // Trigger memory compaction
'wundr memory retrieve'; // Search memories

// Orchestration
'wundr workflow create'; // Create new LangGraph workflow
'wundr crew create'; // Create new CrewAI team
'wundr graph visualize'; // Visualize workflow graph

// Configuration
'wundr config compose'; // Compose config from groups
'wundr config override'; // Apply runtime overrides

// Templates
'wundr template generate'; // Generate from template
'wundr prompt render'; // Render prompt template

// Security
'wundr security audit'; // Audit security configuration
'wundr access check'; // Check agent access policies
```

---

## Part 11: Implementation Phases

### Phase 1: Context Engineering Foundation (Weeks 1-3)

| Task                    | Priority | Output                           |
| ----------------------- | -------- | -------------------------------- |
| JIT Tool Registry       | Critical | `@wundr.io/jit-tools` package    |
| Agentic RAG Enhancement | Critical | Enhanced `@wundr.io/rag-utils`   |
| Tiered Memory System    | High     | `@wundr.io/agent-memory` package |
| Dynamic Prompting       | High     | Persona library and hot-swap     |

### Phase 2: Orchestration Frameworks (Weeks 4-6)

| Task                  | Priority | Output                             |
| --------------------- | -------- | ---------------------------------- |
| LangGraph Integration | High     | `@wundr.io/langgraph-orchestrator` |
| CrewAI Integration    | High     | `@wundr.io/crew-orchestrator`      |
| AutoGen Integration   | Medium   | `@wundr.io/autogen-orchestrator`   |
| Prebuilt Workflows    | Medium   | Common workflow patterns           |

### Phase 3: MCP and Structured Output (Weeks 7-9)

| Task                 | Priority | Output                         |
| -------------------- | -------- | ------------------------------ |
| Enhanced MCP Server  | High     | Security, lifecycle, registry  |
| MCP Aggregator       | Medium   | Super MCP pattern              |
| Structured Output    | High     | `@wundr.io/structured-output`  |
| Constrained Decoding | Medium   | `@wundr.io/constrained-output` |

### Phase 4: Configuration and Templating (Weeks 10-11)

| Task               | Priority | Output                        |
| ------------------ | -------- | ----------------------------- |
| Hydra-style Config | Medium   | `@wundr.io/hydra-config`      |
| Prompt Templates   | Medium   | `@wundr.io/prompt-templates`  |
| Agent Templates    | Medium   | Cookiecutter-style generation |

### Phase 5: UI and Security (Weeks 12-14)

| Task                 | Priority | Output                      |
| -------------------- | -------- | --------------------------- |
| Chainlit Integration | Medium   | `@wundr.io/chainlit-ui`     |
| Generative UI        | Medium   | Dashboard enhancement       |
| Prompt Security      | High     | `@wundr.io/prompt-security` |
| Access Control       | High     | Enhanced MCP security       |

### Phase 6: Integration and Testing (Weeks 15-16)

| Task                       | Priority | Output                 |
| -------------------------- | -------- | ---------------------- |
| computer-setup Integration | Critical | Enhanced setup command |
| project-init Integration   | Critical | Enhanced init command  |
| Documentation              | High     | Complete docs          |
| Testing                    | High     | E2E test suite         |

---

## Part 12: Validation Checklist

### Context Engineering

- [ ] JIT tool loading reduces average context size by 40%+
- [ ] Agentic RAG achieves better recall than static RAG
- [ ] Memory compaction maintains semantic fidelity
- [ ] Dynamic prompting correctly switches personas

### Orchestration

- [ ] LangGraph workflows support checkpointing
- [ ] CrewAI teams execute hierarchical tasks
- [ ] AutoGen conversations reach consensus
- [ ] Hybrid workflows combine frameworks

### MCP

- [ ] Tool discovery works dynamically
- [ ] Access control enforces policies
- [ ] Aggregator routes correctly
- [ ] Audit logs capture all invocations

### Structured Output

- [ ] Retry loop achieves 99%+ valid outputs
- [ ] Constrained decoding produces syntactically valid code
- [ ] Streaming partial objects work correctly

### Configuration

- [ ] Hydra composition works with overrides
- [ ] Prompt templates render correctly
- [ ] Environment-specific configs merge

### Security

- [ ] Action interceptor blocks injection attempts
- [ ] Context minimization prevents leakage
- [ ] Output filtering redacts sensitive data

---

## Appendix A: Package Dependency Graph

```
@wundr.io/jit-tools
├── @wundr.io/rag-utils
└── @wundr.io/mcp-registry

@wundr.io/agent-memory
├── @wundr.io/rag-utils
└── tiktoken

@wundr.io/langgraph-orchestrator
├── @langchain/langgraph
├── @langchain/core
└── @wundr.io/agent-memory

@wundr.io/crew-orchestrator
└── @wundr.io/agent-memory

@wundr.io/autogen-orchestrator
└── @wundr.io/agent-memory

@wundr.io/structured-output
├── zod
└── @anthropic-ai/sdk

@wundr.io/hydra-config
└── yaml

@wundr.io/prompt-templates
└── handlebars

@wundr.io/prompt-security
├── @wundr.io/structured-output
└── @wundr.io/mcp-server

@wundr.io/chainlit-ui
└── chainlit
```

---

## Appendix B: Reference Documents

1. **Dynamic Context Compilation and Hierarchical Organization Generation for AI Agents**
   - Source:
     `~/wundr/docs/Dynamic_Context_Compilation_and_Hierarchical_Organization_Generation_for_AI_Agents.md`
   - Key concepts: JIT Tooling, Agentic RAG, MemGPT, MCP, LangGraph, CrewAI, AutoGen, Hydra, Jinja2,
     Instructor, Chainlit

2. **Claude Agent Platform Features**
   - Source: `~/wundr/docs/claude_agent_platform_features.md`
   - Key concepts: Sub-agents, MCP servers, Hooks, Custom commands, Memory, Permissions

3. **THREE-TIER-ARCHITECTURE-IMPLEMENTATION-PLAN.md**
   - Source: `~/wundr/docs/THREE-TIER-ARCHITECTURE-IMPLEMENTATION-PLAN.md`
   - Foundation: VP Daemon, Session Managers, Sub-Agents, IPRE Governance

---

## Part 13: Claude Agent SDK Integration Patterns

### 13.1 SDK-First Architecture

Based on the Claude Agent Platform Features whitepaper, standardize on the Claude Agent SDK as the
primary runtime for agent sessions.

**Enhancement to `packages/@wundr/agent-runtime/`**

```typescript
// packages/@wundr/agent-runtime/src/sdk-wrapper.ts

import { query, SDKMessage } from '@anthropic-ai/claude-agent-sdk';

export interface AgentRuntimeConfig {
  model: 'haiku' | 'sonnet' | 'opus';
  settingSources: ('project' | 'user' | 'local')[];
  permissionMode: 'plan' | 'acceptEdits' | 'default' | 'bypassPermissions';
  maxTurns?: number;
  maxThinkingTokens?: number;
}

export interface AgentDefinition {
  name: string;
  role: string;
  systemPrompt: string;
  tools: string[];
  allowedTools?: string[];
  disallowedTools?: string[];
  canUseTool?: (tool: string, params: unknown) => Promise<ToolPermission>;
}

export class AgentRuntimeWrapper {
  /**
   * Standardized wrapper around Claude Agent SDK query()
   * Based on claude_agent_platform_features.md recommendations
   */
  async runAgent(
    agent: AgentDefinition,
    input: string,
    config: AgentRuntimeConfig
  ): Promise<AgentResult> {
    const messages: SDKMessage[] = [];

    // Configure hooks for observability
    const hooks = {
      onSessionStart: (session: SessionInfo) => this.logSessionStart(session),
      onSessionEnd: (session: SessionInfo) => this.logSessionEnd(session),
      onPreToolUse: (tool: ToolUseInfo) => this.auditToolUse(tool),
      onPostToolUse: (result: ToolResult) => this.logToolResult(result),
      onPreCompact: (context: CompactInfo) => this.handleCompaction(context),
    };

    try {
      const result = await query({
        prompt: input,
        systemPrompt: agent.systemPrompt,
        model: this.mapModel(config.model),
        settingSources: config.settingSources,
        permissionMode: config.permissionMode,
        maxTurns: config.maxTurns,
        maxThinkingTokens: config.maxThinkingTokens,
        allowedTools: agent.allowedTools,
        disallowedTools: agent.disallowedTools,
        canUseTool: agent.canUseTool,
        hooks,
        onMessage: msg => messages.push(msg),
      });

      return {
        success: true,
        messages,
        usage: result.usage,
        sessionId: result.sessionId,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        messages,
      };
    }
  }

  /**
   * Stream agent responses for interactive UIs
   */
  async *streamAgent(
    agent: AgentDefinition,
    input: string,
    config: AgentRuntimeConfig
  ): AsyncGenerator<SDKMessage> {
    const stream = query({
      prompt: input,
      systemPrompt: agent.systemPrompt,
      model: this.mapModel(config.model),
      streaming: true,
      // ... other config
    });

    for await (const message of stream) {
      yield message;
    }
  }
}
```

### 13.2 File-Based Agent Configuration Reuse

**Enhancement to project-init**

Generate `.claude/` directory structure that aligns with Claude Code conventions:

```typescript
// packages/@wundr/computer-setup/src/project-init/claude-code-conventions.ts

export interface ClaudeCodeProjectStructure {
  agents: AgentFileConfig[];
  skills: SkillFileConfig[];
  commands: CommandFileConfig[];
  hooks: HookConfig[];
  memory: MemoryConfig;
}

export async function generateClaudeCodeStructure(
  projectPath: string,
  config: ClaudeCodeProjectStructure
): Promise<void> {
  // Generate .claude/agents/*.md files (subagents)
  for (const agent of config.agents) {
    await generateAgentFile(projectPath, agent);
  }

  // Generate .claude/skills/SKILL.md files
  for (const skill of config.skills) {
    await generateSkillFile(projectPath, skill);
  }

  // Generate .claude/commands/*.md files (slash commands)
  for (const command of config.commands) {
    await generateCommandFile(projectPath, command);
  }

  // Generate .claude/settings.json with hooks
  await generateSettingsJson(projectPath, config.hooks);

  // Generate CLAUDE.md at repo root
  await generateClaudeMd(projectPath, config);
}

/**
 * Agent file template following Claude Code conventions
 */
function generateAgentTemplate(agent: AgentFileConfig): string {
  return `# ${agent.name}

## Role
${agent.role}

## Goal
${agent.goal}

## Backstory
${agent.backstory || 'A specialized agent for ' + agent.role.toLowerCase() + ' tasks.'}

## Tools
${agent.tools.map(t => `- ${t}`).join('\n')}

## Guidelines
${agent.guidelines || 'Follow best practices for ' + agent.role.toLowerCase() + '.'}

## Constraints
${agent.constraints?.map(c => `- ${c}`).join('\n') || '- None specified'}
`;
}
```

### 13.3 Hub-and-Spoke Delegation Pattern

**New Module**: `packages/@wundr/agent-delegation/`

Implements the Task tool delegation pattern from the whitepaper:

```typescript
// packages/@wundr/agent-delegation/src/coordinator.ts

export interface DelegationConfig {
  maxConcurrentSubagents: number;
  delegationStrategy: 'sequential' | 'parallel' | 'hierarchical';
  resultAggregation: 'merge' | 'select-best' | 'synthesize';
}

export class HubCoordinator {
  private subagents: Map<string, AgentDefinition>;
  private runtime: AgentRuntimeWrapper;

  /**
   * Implements hub-and-spoke pattern from Claude Agent Platform Features
   * Coordinator delegates to specialized subagents via Task tool
   */
  async delegateTask(
    taskDescription: string,
    subagentType: string,
    prompt: string
  ): Promise<DelegationResult> {
    const subagent = this.subagents.get(subagentType);

    if (!subagent) {
      throw new Error(`Unknown subagent type: ${subagentType}`);
    }

    // Log delegation for audit trail
    await this.auditLog.logDelegation({
      taskDescription,
      subagentType,
      timestamp: new Date(),
    });

    // Execute subagent
    const result = await this.runtime.runAgent(subagent, prompt, {
      model: this.selectModelForSubagent(subagent),
      settingSources: ['project'],
      permissionMode: 'default',
    });

    // Log result with usage for cost tracking
    await this.auditLog.logDelegationResult({
      taskDescription,
      subagentType,
      success: result.success,
      usage: result.usage,
      timestamp: new Date(),
    });

    return {
      subagentType,
      result,
      usage: result.usage,
    };
  }

  /**
   * Parallel delegation to multiple subagents
   * Example: PR reviewer delegates to security-reviewer and performance-reviewer
   */
  async delegateParallel(
    tasks: Array<{ subagentType: string; prompt: string }>
  ): Promise<DelegationResult[]> {
    return Promise.all(
      tasks.map(({ subagentType, prompt }) =>
        this.delegateTask(`Parallel task: ${subagentType}`, subagentType, prompt)
      )
    );
  }

  /**
   * Synthesize results from multiple subagents
   */
  async synthesizeResults(
    results: DelegationResult[],
    synthesisPrompt: string
  ): Promise<SynthesisResult> {
    const combinedContext = results
      .map(r => `## ${r.subagentType} Analysis\n${r.result.output}`)
      .join('\n\n');

    return this.runtime.runAgent(
      this.getSynthesizerAgent(),
      `${synthesisPrompt}\n\n${combinedContext}`,
      { model: 'sonnet', settingSources: ['project'], permissionMode: 'plan' }
    );
  }
}
```

---

## Part 14: Session and Context Management Enhancements

### 14.1 Session State Persistence

**Enhancement to existing session management**

```typescript
// packages/@wundr/agent-memory/src/session-manager.ts

export interface SessionState {
  sessionId: string;
  conversationId: string;
  startedAt: Date;
  lastActiveAt: Date;
  compactionEvents: CompactionEvent[];
  importantContext: string[];
  tokenUsage: TokenUsageHistory;
}

export class SessionManager {
  /**
   * Implements session continuity from claude_agent_platform_features.md
   * SDK emits SDKCompactBoundaryMessage events when compaction occurs
   */
  async handleCompaction(event: CompactEvent): Promise<void> {
    // Log compaction for understanding context preservation
    await this.logCompaction({
      sessionId: event.sessionId,
      preservedTokens: event.preservedTokens,
      droppedTokens: event.droppedTokens,
      timestamp: new Date(),
    });

    // Extract important context before it's compacted away
    const importantContext = await this.extractImportantContext(event.context);

    // Persist to durable memory
    await this.persistToMemory(event.sessionId, importantContext);
  }

  /**
   * Snapshot important context for long-running sessions
   * Example: incident war rooms, multi-day code reviews
   */
  async snapshotSession(sessionId: string): Promise<SessionSnapshot> {
    const session = await this.getSession(sessionId);

    return {
      sessionId,
      snapshotAt: new Date(),
      summary: await this.summarizeSession(session),
      keyDecisions: await this.extractKeyDecisions(session),
      pendingTasks: await this.extractPendingTasks(session),
      contextPointers: await this.createContextPointers(session),
    };
  }

  /**
   * Resume session from snapshot
   */
  async resumeFromSnapshot(snapshot: SessionSnapshot): Promise<SessionState> {
    const resumeContext = `
## Session Resume Context

This session is being resumed from a previous conversation.

### Summary of Previous Session
${snapshot.summary}

### Key Decisions Made
${snapshot.keyDecisions.map(d => `- ${d}`).join('\n')}

### Pending Tasks
${snapshot.pendingTasks.map(t => `- [ ] ${t}`).join('\n')}

Please continue from where we left off.
`;

    return this.createSession({
      initialContext: resumeContext,
      previousSessionId: snapshot.sessionId,
    });
  }
}
```

### 14.2 Token Budget Management

**New Module**: `packages/@wundr/token-budget/`

```typescript
// packages/@wundr/token-budget/src/budget-manager.ts

export interface TokenBudgetConfig {
  maxThinkingTokens: number;
  maxTurns: number;
  contextWarningThreshold: number; // e.g., 0.8 = warn at 80%
  costBudgetUsd?: number;
}

export class TokenBudgetManager {
  /**
   * Monitor and control token usage per agent/session
   * Based on maxTurns, maxThinkingTokens from whitepaper
   */
  async checkBudget(sessionId: string, config: TokenBudgetConfig): Promise<BudgetStatus> {
    const usage = await this.getSessionUsage(sessionId);

    return {
      turnsRemaining: config.maxTurns - usage.turns,
      thinkingTokensRemaining: config.maxThinkingTokens - usage.thinkingTokens,
      contextUtilization: usage.contextTokens / this.maxContextTokens,
      estimatedCostUsd: this.calculateCost(usage),
      warnings: this.generateWarnings(usage, config),
    };
  }

  /**
   * Suggest context optimization when approaching limits
   */
  async suggestOptimization(
    sessionId: string,
    currentContext: string
  ): Promise<OptimizationSuggestion> {
    const usage = await this.getSessionUsage(sessionId);

    if (usage.contextTokens > this.maxContextTokens * 0.8) {
      return {
        action: 'compact',
        suggestion: 'Context window is 80% full. Consider compacting or archiving older messages.',
        candidates: await this.identifyCompactionCandidates(currentContext),
      };
    }

    return { action: 'none', suggestion: 'Token usage is within acceptable limits.' };
  }
}
```

---

## Part 15: Evaluation, Testing, and Observability

### 15.1 Agent Evaluation Framework

**New Module**: `packages/@wundr/agent-eval/`

Based on the evaluation strategy from claude_agent_platform_features.md:

```typescript
// packages/@wundr/agent-eval/src/evaluator.ts

export interface EvalSuite {
  name: string;
  description: string;
  testCases: EvalTestCase[];
  gradingRubric: GradingRubric;
}

export interface EvalTestCase {
  id: string;
  input: string;
  expectedBehavior: string;
  groundTruth?: string;
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface GradingRubric {
  type: 'code-based' | 'llm-graded' | 'human-review';
  criteria: GradingCriterion[];
}

export class AgentEvaluator {
  /**
   * Run evaluation suite against an agent
   * Implements eval patterns from claude_agent_platform_features.md
   */
  async runEvalSuite(agent: AgentDefinition, suite: EvalSuite): Promise<EvalResults> {
    const results: EvalResult[] = [];

    for (const testCase of suite.testCases) {
      const result = await this.runTestCase(agent, testCase, suite.gradingRubric);
      results.push(result);
    }

    return {
      suite: suite.name,
      timestamp: new Date(),
      totalCases: suite.testCases.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      results,
      metrics: this.calculateMetrics(results),
    };
  }

  /**
   * LLM-based grading with rubric
   * For tasks where automated validation is insufficient
   */
  async gradeWithLLM(
    response: string,
    testCase: EvalTestCase,
    rubric: GradingRubric
  ): Promise<GradeResult> {
    const gradingPrompt = `
You are evaluating an AI agent's response. Grade according to this rubric:

${rubric.criteria.map(c => `- ${c.name} (${c.weight}%): ${c.description}`).join('\n')}

## Expected Behavior
${testCase.expectedBehavior}

## Agent Response
${response}

Provide a score from 0-100 for each criterion and an overall assessment.
`;

    const grade = await this.llmGrader.generate(gradingPrompt);
    return this.parseGradeResult(grade);
  }
}
```

### 15.2 Observability Pipeline

**Enhancement to existing logging**

```typescript
// packages/@wundr/agent-observability/src/pipeline.ts

export interface ObservabilityEvent {
  eventType:
    | 'session_start'
    | 'session_end'
    | 'tool_use'
    | 'permission_denial'
    | 'refusal'
    | 'error'
    | 'compaction';
  sessionId: string;
  agentId: string;
  timestamp: Date;
  payload: Record<string, unknown>;
}

export class ObservabilityPipeline {
  /**
   * Central logging for all SDK events
   * Based on instrumentation requirements from whitepaper
   */
  async logEvent(event: ObservabilityEvent): Promise<void> {
    // 1. Redact sensitive data
    const redacted = await this.redactor.redact(event.payload);

    // 2. Enrich with context
    const enriched = {
      ...event,
      payload: redacted,
      environment: this.getEnvironment(),
      correlationId: this.getCorrelationId(),
    };

    // 3. Send to destinations
    await Promise.all([
      this.logStore.append(enriched),
      this.metricsCollector.record(enriched),
      this.alertManager.evaluate(enriched),
    ]);
  }

  /**
   * Track tool usage patterns
   */
  async logToolUse(
    sessionId: string,
    toolName: string,
    params: unknown,
    result: unknown,
    duration: number
  ): Promise<void> {
    await this.logEvent({
      eventType: 'tool_use',
      sessionId,
      agentId: this.getCurrentAgentId(),
      timestamp: new Date(),
      payload: {
        toolName,
        params: this.redactor.redact(params),
        success: !this.isError(result),
        duration,
        tokenUsage: this.extractTokenUsage(result),
      },
    });

    // Update metrics
    await this.metrics.increment(`tool.${toolName}.calls`);
    await this.metrics.timing(`tool.${toolName}.duration`, duration);
  }

  /**
   * Track permission denials for policy refinement
   */
  async logPermissionDenial(sessionId: string, toolName: string, reason: string): Promise<void> {
    await this.logEvent({
      eventType: 'permission_denial',
      sessionId,
      agentId: this.getCurrentAgentId(),
      timestamp: new Date(),
      payload: { toolName, reason },
    });

    // Alert if denial rate exceeds threshold
    await this.alertManager.checkDenialRate(sessionId, toolName);
  }
}
```

### 15.3 Continuous Improvement Loop

```typescript
// packages/@wundr/agent-eval/src/feedback-loop.ts

export interface FeedbackEntry {
  sessionId: string;
  rating: 'positive' | 'negative';
  freeText?: string;
  timestamp: Date;
}

export class FeedbackLoop {
  /**
   * Operationalize feedback for agent improvement
   * Based on continuous improvement loop from whitepaper
   */
  async collectFeedback(entry: FeedbackEntry): Promise<void> {
    // Store feedback linked to session
    await this.feedbackStore.save(entry);

    // If negative, flag for review
    if (entry.rating === 'negative') {
      await this.reviewQueue.add({
        sessionId: entry.sessionId,
        feedback: entry,
        priority: 'high',
      });
    }
  }

  /**
   * Sample conversations for manual review
   */
  async sampleForReview(agentId: string, sampleSize: number): Promise<ReviewSample[]> {
    const conversations = await this.getRecentConversations(agentId);

    // Stratified sampling: include both good and bad outcomes
    const stratified = this.stratifySample(conversations, {
      positive: sampleSize * 0.3,
      negative: sampleSize * 0.5,
      random: sampleSize * 0.2,
    });

    return stratified.map(c => ({
      conversationId: c.id,
      transcript: c.messages,
      metadata: c.metadata,
      feedback: c.feedback,
    }));
  }

  /**
   * Generate improvement recommendations from feedback analysis
   */
  async analyzeFailures(agentId: string): Promise<ImprovementRecommendations> {
    const failures = await this.getFailureCases(agentId);

    // Cluster similar failures
    const clusters = await this.clusterFailures(failures);

    // Generate recommendations per cluster
    const recommendations = await Promise.all(
      clusters.map(async cluster => ({
        category: cluster.category,
        frequency: cluster.items.length,
        examples: cluster.items.slice(0, 3),
        suggestedFix: await this.generateSuggestedFix(cluster),
      }))
    );

    return {
      agentId,
      analysisDate: new Date(),
      totalFailures: failures.length,
      recommendations: recommendations.sort((a, b) => b.frequency - a.frequency),
    };
  }
}
```

---

## Part 16: TypeScript-First Validation with TypeChat

### 16.1 TypeChat Integration

**New Module**: `packages/@wundr/typechat-output/`

Based on the TypeChat description in the Dynamic Context document:

```typescript
// packages/@wundr/typechat-output/src/validator.ts

export interface TypeChatConfig {
  schemaPath: string;
  typeName: string;
  retryCount: number;
}

export class TypeChatValidator<T> {
  /**
   * TypeScript-first validation using TypeChat
   * Complements Instructor (Python) with TypeScript equivalent
   */
  async validate(response: string, config: TypeChatConfig): Promise<TypeChatResult<T>> {
    // Load TypeScript type definitions
    const schema = await this.loadSchema(config.schemaPath);

    // Parse response as JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(response);
    } catch {
      return {
        success: false,
        error: 'Invalid JSON in response',
        suggestion: 'Please ensure your response is valid JSON',
      };
    }

    // Validate against TypeScript type using compiler API
    const errors = await this.validateAgainstType(parsed, config.typeName, schema);

    if (errors.length > 0) {
      return {
        success: false,
        errors,
        suggestion: this.generateCorrectionPrompt(errors),
      };
    }

    return {
      success: true,
      data: parsed as T,
    };
  }

  /**
   * Self-healing loop similar to Instructor
   */
  async validateWithRetry(prompt: string, config: TypeChatConfig): Promise<T> {
    let attempts = 0;
    let lastError: string | null = null;

    while (attempts < config.retryCount) {
      const fullPrompt = lastError
        ? `${prompt}\n\nPrevious attempt failed: ${lastError}\nPlease correct and try again.`
        : prompt;

      const response = await this.llm.generate(fullPrompt);
      const result = await this.validate(response, config);

      if (result.success) {
        return result.data;
      }

      lastError = result.suggestion;
      attempts++;
    }

    throw new Error(`Failed to generate valid output after ${config.retryCount} attempts`);
  }
}
```

---

## Part 17: Meta-Agents and Self-Organization (Future Outlook)

### 17.1 Dynamic Hierarchy Generation

**Future Enhancement**: `packages/@wundr/meta-agent/`

Based on the Meta-Agents concept from the Dynamic Context document:

```typescript
// packages/@wundr/meta-agent/src/self-organizer.ts

export interface TaskAnalysis {
  complexity: 'low' | 'medium' | 'high' | 'extreme';
  domains: string[];
  suggestedRoles: RoleSuggestion[];
  estimatedAgents: number;
}

export class MetaAgentOrchestrator {
  /**
   * Future capability: agents that self-organize their hierarchy
   * Based on MetaGPT and meta-agent patterns from Dynamic Context document
   */
  async analyzeTask(task: string): Promise<TaskAnalysis> {
    const analysis = await this.llm.generate(`
Analyze this task and suggest an optimal agent organization:

Task: ${task}

Provide:
1. Complexity assessment
2. Domains involved
3. Suggested agent roles
4. Estimated number of agents needed
`);

    return this.parseTaskAnalysis(analysis);
  }

  /**
   * Dynamically spawn agent hierarchy based on task analysis
   */
  async spawnDynamicHierarchy(
    task: string,
    constraints: HierarchyConstraints
  ): Promise<AgentHierarchy> {
    const analysis = await this.analyzeTask(task);

    // Apply constraints
    const boundedAgents = Math.min(analysis.estimatedAgents, constraints.maxAgents);
    const boundedDepth = Math.min(this.estimateDepth(analysis), constraints.maxDepth);

    // Generate hierarchy
    const hierarchy: AgentHierarchy = {
      root: await this.createManagerAgent(task, analysis),
      workers: [],
      depth: boundedDepth,
    };

    // Spawn worker agents based on roles
    for (const role of analysis.suggestedRoles.slice(0, boundedAgents - 1)) {
      const worker = await this.createWorkerAgent(role);
      hierarchy.workers.push(worker);
    }

    return hierarchy;
  }

  /**
   * Self-improvement: learn from past executions
   * Agents can adjust their strategies based on outcomes
   */
  async learnFromExecution(execution: ExecutionRecord): Promise<LearningOutcome> {
    // Analyze what worked and what didn't
    const analysis = await this.analyzeExecution(execution);

    // Update agent configurations based on learnings
    if (analysis.suggestedChanges.length > 0) {
      await this.applyLearnings(analysis.suggestedChanges);
    }

    return {
      executionId: execution.id,
      learnings: analysis.learnings,
      appliedChanges: analysis.suggestedChanges,
    };
  }
}
```

### 17.2 Governance for Self-Organizing Agents

```typescript
// packages/@wundr/meta-agent/src/governance.ts

export interface MetaAgentGuardrails {
  maxSpawnDepth: number;
  maxTotalAgents: number;
  requiredHumanApprovalThreshold: 'low' | 'medium' | 'high';
  forbiddenActions: string[];
  budgetLimits: BudgetLimits;
}

export class MetaAgentGovernance {
  /**
   * Ensure self-organizing agents stay within bounds
   * Critical for safety as agents gain autonomy
   */
  async validateHierarchy(
    proposed: AgentHierarchy,
    guardrails: MetaAgentGuardrails
  ): Promise<ValidationResult> {
    const violations: Violation[] = [];

    // Check depth
    if (proposed.depth > guardrails.maxSpawnDepth) {
      violations.push({
        type: 'max_depth_exceeded',
        message: `Hierarchy depth ${proposed.depth} exceeds max ${guardrails.maxSpawnDepth}`,
      });
    }

    // Check total agents
    const totalAgents = this.countAgents(proposed);
    if (totalAgents > guardrails.maxTotalAgents) {
      violations.push({
        type: 'max_agents_exceeded',
        message: `Total agents ${totalAgents} exceeds max ${guardrails.maxTotalAgents}`,
      });
    }

    // Check for forbidden actions in any agent's toolset
    for (const agent of this.getAllAgents(proposed)) {
      const forbidden = agent.tools.filter(t => guardrails.forbiddenActions.includes(t));
      if (forbidden.length > 0) {
        violations.push({
          type: 'forbidden_action',
          message: `Agent ${agent.name} has forbidden actions: ${forbidden.join(', ')}`,
        });
      }
    }

    return {
      valid: violations.length === 0,
      violations,
      requiresHumanApproval: this.requiresApproval(proposed, guardrails),
    };
  }
}
```

---

## Part 18: Enhanced Implementation Roadmap

### Phase 0: Foundation (Immediate Priority)

| Task                              | Owner         | Dependency  | Output                    |
| --------------------------------- | ------------- | ----------- | ------------------------- |
| Agent SDK wrapper standardization | Platform Team | None        | `@wundr.io/agent-runtime` |
| File-based agent configuration    | Platform Team | SDK wrapper | `.claude/` conventions    |
| Basic observability hooks         | Platform Team | SDK wrapper | Logging pipeline          |

### Phase 1: Context Engineering (High Priority)

| Task                      | Owner        | Dependency    | Output                   |
| ------------------------- | ------------ | ------------- | ------------------------ |
| JIT Tool Registry         | Context Team | Phase 0       | `@wundr.io/jit-tools`    |
| Tiered Memory System      | Context Team | Phase 0       | `@wundr.io/agent-memory` |
| Session state persistence | Context Team | Memory system | Session manager          |
| Token budget management   | Context Team | SDK wrapper   | Budget controls          |

### Phase 2: Orchestration & Delegation (High Priority)

| Task                      | Owner              | Dependency  | Output                             |
| ------------------------- | ------------------ | ----------- | ---------------------------------- |
| Hub-and-spoke coordinator | Orchestration Team | Phase 0     | `@wundr.io/agent-delegation`       |
| LangGraph integration     | Orchestration Team | Phase 1     | `@wundr.io/langgraph-orchestrator` |
| CrewAI integration        | Orchestration Team | Phase 1     | `@wundr.io/crew-orchestrator`      |
| Parallel delegation       | Orchestration Team | Coordinator | Multi-agent support                |

### Phase 3: Structured Output & Validation (Medium Priority)

| Task                   | Owner           | Dependency | Output                         |
| ---------------------- | --------------- | ---------- | ------------------------------ |
| Instructor enhancement | Validation Team | Phase 0    | `@wundr.io/structured-output`  |
| TypeChat integration   | Validation Team | Phase 0    | `@wundr.io/typechat-output`    |
| Constrained decoding   | Validation Team | Phase 0    | `@wundr.io/constrained-output` |

### Phase 4: Evaluation & Observability (Medium Priority)

| Task                  | Owner         | Dependency     | Output                 |
| --------------------- | ------------- | -------------- | ---------------------- |
| Eval framework        | QA Team       | Phase 2        | `@wundr.io/agent-eval` |
| LLM-based grading     | QA Team       | Eval framework | Grading rubrics        |
| Feedback loop         | QA Team       | Observability  | Continuous improvement |
| Dashboard integration | Platform Team | All above      | Metrics dashboards     |

### Phase 5: Security & Governance (Critical Throughout)

| Task                     | Owner         | Dependency    | Output                      |
| ------------------------ | ------------- | ------------- | --------------------------- |
| Prompt injection defense | Security Team | Phase 0       | `@wundr.io/prompt-security` |
| MCP access control       | Security Team | Phase 0       | Access policies             |
| Audit logging            | Security Team | Observability | Audit trails                |
| Permission management    | Security Team | SDK wrapper   | `canUseTool` framework      |

### Phase 6: Advanced Features (Future)

| Task                        | Owner         | Dependency    | Output                 |
| --------------------------- | ------------- | ------------- | ---------------------- |
| Meta-agent orchestrator     | Research Team | Phases 1-4    | `@wundr.io/meta-agent` |
| Self-organizing hierarchies | Research Team | Meta-agent    | Dynamic spawning       |
| Cross-session learning      | Research Team | Memory + Eval | Learning system        |

---

## Appendix C: Integration with computer-setup and project-init

### computer-setup Additions

Add these new installers to `real-setup-orchestrator.ts`:

```typescript
// New tool installations for enhanced agent capabilities
const enhancedAgentTools: ToolInstallation[] = [
  // Agent SDK
  {
    name: '@anthropic-ai/claude-agent-sdk',
    type: 'npm-global',
    category: 'agent-runtime',
  },
  // Python SDK for mixed workloads
  {
    name: 'anthropic-agent-sdk',
    type: 'pip',
    category: 'agent-runtime',
  },
  // Orchestration frameworks
  {
    name: '@langchain/langgraph',
    type: 'npm',
    category: 'orchestration',
    optional: true,
  },
  {
    name: 'crewai',
    type: 'pip',
    category: 'orchestration',
    optional: true,
  },
];
```

### project-init Additions

Add these new initialization options to `project-initializer.ts`:

```typescript
interface EnhancedInitOptions extends ProjectInitOptions {
  // Claude Agent SDK integration
  claudeAgentSdk: {
    wrapperStyle: 'minimal' | 'full-featured';
    defaultModel: 'haiku' | 'sonnet' | 'opus';
    permissionMode: 'plan' | 'default' | 'acceptEdits';
  };

  // Evaluation setup
  evaluation: {
    enableEvalFramework: boolean;
    defaultGradingMode: 'code-based' | 'llm-graded' | 'human-review';
    testCaseDirectory: string;
  };

  // Observability
  observability: {
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    metricsEnabled: boolean;
    tracingEnabled: boolean;
    auditLogEnabled: boolean;
  };
}
```

---

## Appendix D: Reference Document Mapping

| Concept                  | Source Document                | Section in This Plan |
| ------------------------ | ------------------------------ | -------------------- |
| JIT Tooling              | Dynamic Context Compilation    | Part 2.1             |
| Agentic RAG              | Dynamic Context Compilation    | Part 2.2             |
| MemGPT Memory            | Dynamic Context Compilation    | Part 2.3             |
| MCP Architecture         | Dynamic Context Compilation    | Part 3               |
| LangGraph/CrewAI/AutoGen | Dynamic Context Compilation    | Part 4               |
| Instructor/Pydantic      | Dynamic Context Compilation    | Part 5.1             |
| Outlines/Guidance        | Dynamic Context Compilation    | Part 5.2             |
| TypeChat                 | Dynamic Context Compilation    | Part 16              |
| Hydra Config             | Dynamic Context Compilation    | Part 6.1             |
| Jinja2 Templating        | Dynamic Context Compilation    | Part 6.2             |
| Chainlit/Generative UI   | Dynamic Context Compilation    | Part 7               |
| Prompt Injection Defense | Dynamic Context Compilation    | Part 8.1             |
| Meta-Agents              | Dynamic Context Compilation    | Part 17              |
| SDK Usage Patterns       | Claude Agent Platform Features | Part 13.1            |
| File-based Configuration | Claude Agent Platform Features | Part 13.2            |
| Hub-and-Spoke Delegation | Claude Agent Platform Features | Part 13.3            |
| Session Management       | Claude Agent Platform Features | Part 14              |
| Evaluation Strategy      | Claude Agent Platform Features | Part 15              |
| Implementation Roadmap   | Claude Agent Platform Features | Part 18              |

---

**Document prepared to extend the Three-Tier Architecture with advanced context engineering,
orchestration frameworks, Claude Agent SDK integration patterns, and enterprise-grade evaluation and
observability systems.**
