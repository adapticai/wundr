# @wundr.io/jit-tools

Just-In-Time (JIT) context engineering tools for AI agents. Prevents context pollution by dynamically loading only the tools relevant to the current task.

## Overview

JIT Tools provides a complete system for intelligent tool loading in AI agent workflows. Instead of loading all available tools into an agent's context (which consumes tokens and can cause confusion), JIT Tools uses semantic search, intent analysis, and relevance ranking to inject only the most relevant tools at runtime.

**Key Benefits:**

- **Reduced Token Usage**: Only include tools relevant to the current task
- **Improved Agent Performance**: Less context pollution means better tool selection
- **Dynamic Adaptation**: Tools change based on intent, not static configuration
- **Permission-Aware**: Filter tools based on agent permissions
- **Caching Support**: Fast retrieval with configurable TTL

## Installation

```bash
npm install @wundr.io/jit-tools
# or
pnpm add @wundr.io/jit-tools
# or
yarn add @wundr.io/jit-tools
```

## Quick Start

```typescript
import {
  createJITToolsSystem,
  createToolSpec,
} from '@wundr.io/jit-tools';

// Create the complete JIT system
const { registry, retriever, injector } = createJITToolsSystem({
  jitConfig: { maxTools: 5, enableSemanticSearch: true },
  injectionOptions: { formatStyle: 'markdown' },
});

// Register tools
await registry.register(createToolSpec({
  id: 'code-review',
  name: 'Code Review Tool',
  description: 'Reviews code for quality issues and best practices',
  category: 'analysis',
  capabilities: ['code-review', 'quality-check'],
}));

// Inject relevant tools for a query
const result = await injector.inject('Help me review this pull request');
console.log(result.contextString);
```

## Main Exports

### Classes

| Export | Description |
|--------|-------------|
| `ToolRegistry` | Central catalog for managing tool specifications |
| `JITToolRetriever` | Retrieves and ranks tools based on semantic search |
| `ContextInjector` | Formats and injects tools into agent context |
| `IntentAnalyzer` | Parses agent queries to extract intent information |

### Factory Functions

| Export | Description |
|--------|-------------|
| `createJITToolsSystem()` | Creates a complete JIT system with all components |
| `createToolSpec()` | Creates a tool specification with sensible defaults |
| `createToolRetriever()` | Creates a JIT tool retriever instance |
| `createContextInjector()` | Creates a context injector instance |
| `createIntentAnalyzer()` | Creates an intent analyzer instance |

### Configuration Constants

| Export | Description |
|--------|-------------|
| `DEFAULT_JIT_CONFIG` | Default JIT tool configuration |
| `DEFAULT_INJECTION_OPTIONS` | Default context injection options |
| `DEFAULT_INTENT_ANALYZER_CONFIG` | Default intent analyzer configuration |
| `VERSION` | Package version string |

## Type-Safe JSON Handling

The package provides type-safe JSON types for handling tool parameters, examples, and metadata.

### JsonPrimitive

Represents valid JSON primitive values:

```typescript
type JsonPrimitive = string | number | boolean | null;
```

### JsonValue

Represents any valid JSON value (recursive type for nested structures):

```typescript
type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };
```

### JsonRecord

Record type for JSON-compatible data structures:

```typescript
type JsonRecord = Record<string, JsonValue>;
```

**Usage Example:**

```typescript
import type { JsonPrimitive, JsonValue, JsonRecord } from '@wundr.io/jit-tools';
import {
  JsonPrimitiveSchema,
  JsonValueSchema,
  JsonRecordSchema,
} from '@wundr.io/jit-tools';

// Type-safe JSON handling
const primitive: JsonPrimitive = "hello";
const value: JsonValue = { nested: { array: [1, 2, 3] } };
const record: JsonRecord = { key: "value", count: 42 };

// Runtime validation with Zod schemas
const validated = JsonRecordSchema.parse({ foo: "bar" });
```

## Tool Retrieval and Context Compilation

### ToolRegistry

The `ToolRegistry` manages tool specifications with CRUD operations, search indexing, and event notifications.

```typescript
import { ToolRegistry, createToolSpec } from '@wundr.io/jit-tools';

const registry = new ToolRegistry();

// Register a tool
await registry.register(createToolSpec({
  id: 'security-scanner',
  name: 'Security Scanner',
  description: 'Scans code for security vulnerabilities',
  category: 'security',
  capabilities: ['security-scanning', 'vulnerability-detection'],
  permissions: ['read', 'execute'],
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: 'Path to scan',
      required: true,
    },
  ],
}));

// Search for tools
const securityTools = registry.search({
  categories: ['security'],
  capabilities: ['security-scanning'],
});

// Get by ID
const tool = registry.get('security-scanner');

// Get registry statistics
const stats = registry.getStats();
console.log(`Total tools: ${stats.totalTools}`);
```

### JITToolRetriever

The `JITToolRetriever` uses semantic search and relevance scoring to find the most relevant tools for a query.

```typescript
import { JITToolRetriever } from '@wundr.io/jit-tools';

const retriever = new JITToolRetriever(registry, {
  maxTools: 10,
  maxTokenBudget: 4000,
  minRelevanceScore: 0.3,
  enableSemanticSearch: true,
  enableCaching: true,
  scoringWeights: {
    semantic: 0.4,
    keyword: 0.25,
    permission: 0.15,
    priority: 0.1,
    category: 0.1,
  },
});

// Retrieve relevant tools
const result = await retriever.retrieve(
  'I need to review the pull request and check for security issues',
  agentContext
);

// Result contains ranked tools with scores
for (const { tool, finalScore, matchReasons } of result.tools) {
  console.log(`${tool.name}: ${finalScore}`);
  console.log(`  Reasons: ${matchReasons.join(', ')}`);
}

// Retrieve by specific capabilities
const capabilityResult = await retriever.retrieveByCapabilities(
  ['code-review', 'security-scanning'],
  agentContext
);

// Retrieve by categories
const categoryResult = await retriever.retrieveByCategories(
  ['analysis', 'security'],
  agentContext
);

// Get recommendations based on agent history
const recommendations = await retriever.getRecommendations(agentContext);
```

### ContextInjector

The `ContextInjector` formats retrieved tools for injection into agent prompts.

```typescript
import { ContextInjector } from '@wundr.io/jit-tools';

const injector = new ContextInjector(retriever, jitConfig, {
  formatStyle: 'markdown',  // 'compact' | 'detailed' | 'xml' | 'json' | 'markdown'
  includeExamples: true,
  includeParameters: true,
  maxExamplesPerTool: 2,
  groupByCategory: false,
  sortOrder: 'relevance',
});

// Inject tools for a query
const result = await injector.inject(
  'Help me review this pull request',
  agentContext,
  { formatStyle: 'markdown' }
);

// Use the context string in agent prompt
const prompt = `${result.contextString}\n\nUser request: Review PR #123`;

// Access injection metadata
console.log(`Tokens used: ${result.tokensUsed}`);
console.log(`Tools injected: ${result.injectedTools.length}`);
console.log(`Excluded tools: ${result.excludedTools.length}`);
```

## Dynamic Tool Loading Patterns

### Pattern 1: Intent-Based Loading

Load tools based on analyzed intent from user queries:

```typescript
import { IntentAnalyzer, JITToolRetriever } from '@wundr.io/jit-tools';

const analyzer = new IntentAnalyzer({
  minEntityConfidence: 0.5,
  maxKeywords: 20,
  enableFuzzyMatching: true,
});

// Analyze user intent
const intent = analyzer.analyze('Analyze the code in src/index.ts for security issues');
// Returns: {
//   action: 'analyze',
//   entities: [{ type: 'file_path', value: 'src/index.ts', ... }],
//   requiredCapabilities: ['code-analysis', 'security-scanning'],
//   relevantCategories: ['analysis', 'security'],
//   keywords: ['analyze', 'code', 'security', 'issues'],
//   confidence: 0.85,
// }

// Use intent for retrieval
const result = await retriever.retrieve(intent.normalizedQuery, agentContext);
```

### Pattern 2: Task-Context Loading

Load tools based on task context for multi-step workflows:

```typescript
const taskContext = {
  taskId: 'pr-review-123',
  taskType: 'code-review',
  description: 'Review pull request for feature/new-auth',
  requiredCapabilities: ['code-review', 'security-scanning'],
  priority: 'high',
  metadata: {},
};

const agentContext = {
  agentId: 'reviewer-agent',
  agentType: 'code-reviewer',
  sessionId: 'session-456',
  capabilities: ['code-analysis', 'security'],
  permissions: ['read', 'execute'],
  taskContext,
  toolHistory: [],
  preferences: {
    preferredCategories: ['analysis', 'security'],
    preferredTools: [],
    excludedTools: [],
    maxContextSize: 'standard',
  },
  customData: {},
};

// Task-aware intent analysis
const intent = analyzer.analyzeWithTaskContext(
  'Check the authentication changes',
  taskContext
);

// Retrieve with full context
const result = await retriever.retrieve(query, agentContext);
```

### Pattern 3: History-Aware Loading

Leverage tool usage history for personalized retrieval:

```typescript
const agentContext = {
  // ... other fields
  toolHistory: [
    {
      toolId: 'code-review',
      usedAt: new Date(),
      success: true,
      relevanceFeedback: 'helpful',
      context: 'PR review',
    },
    {
      toolId: 'security-scanner',
      usedAt: new Date(),
      success: true,
      relevanceFeedback: 'helpful',
      context: 'Security audit',
    },
  ],
};

// Retriever automatically boosts frequently successful tools
const result = await retriever.retrieve('Review this code', agentContext);

// Get explicit recommendations
const recommendations = await retriever.getRecommendations(agentContext);
```

### Pattern 4: Permission-Filtered Loading

Filter tools based on agent permissions:

```typescript
const retriever = new JITToolRetriever(registry, {
  permissionMode: 'strict', // 'strict' | 'lenient' | 'disabled'
});

const limitedAgent = {
  // ... other fields
  permissions: ['read'], // Limited permissions
};

// Only tools requiring 'read' permission will be returned
const result = await retriever.retrieve('Deploy to production', limitedAgent);

// Bypass permissions for admin operations
const adminResult = await retriever.retrieve(
  'Deploy to production',
  limitedAgent,
  { bypassPermissions: true }
);
```

## Integration with VP Daemon and Session Managers

### VP Daemon Integration

The JIT tools system integrates with the VP (Virtual Process) daemon for persistent tool state:

```typescript
import { createJITToolsSystem } from '@wundr.io/jit-tools';

// Create system with daemon-compatible configuration
const system = createJITToolsSystem({
  jitConfig: {
    enableCaching: true,
    cacheTtlMs: 300000, // 5 minutes
    retrievalTimeoutMs: 5000,
  },
});

// Export registry state for daemon persistence
const state = system.registry.export();
// { tools: [...], exportedAt: '2024-...' }

// Import state on daemon restart
await system.registry.import(state, { overwrite: true });
```

### Session Manager Integration

Integrate with session managers for cross-session tool context:

```typescript
import {
  ToolRegistry,
  JITToolRetriever,
  ContextInjector,
} from '@wundr.io/jit-tools';

class SessionToolManager {
  private registry: ToolRegistry;
  private retriever: JITToolRetriever;
  private injector: ContextInjector;
  private sessionTools: Map<string, string[]> = new Map();

  constructor() {
    this.registry = new ToolRegistry();
    this.retriever = new JITToolRetriever(this.registry);
    this.injector = new ContextInjector(this.retriever);
  }

  async getToolsForSession(sessionId: string, query: string, context: AgentContext) {
    const result = await this.injector.inject(query, context);

    // Track tools used in this session
    const toolIds = result.injectedTools.map(t => t.id);
    this.sessionTools.set(sessionId, toolIds);

    return result;
  }

  async reinjectForSession(sessionId: string, context: AgentContext) {
    const previousToolIds = this.sessionTools.get(sessionId) || [];
    const tools = this.registry.getMany(previousToolIds);

    return this.injector.injectTools(tools);
  }
}
```

### Event-Based Integration

Subscribe to JIT system events for monitoring and logging:

```typescript
// Registry events
registry.on('tool:registered', ({ tool }) => {
  console.log(`Tool registered: ${tool.name}`);
});

registry.on('tool:updated', ({ tool, previousTool }) => {
  console.log(`Tool updated: ${tool.name}`);
});

// Retriever events
retriever.on('retrieval:started', ({ query }) => {
  console.log(`Retrieval started for: ${query}`);
});

retriever.on('retrieval:completed', ({ result }) => {
  console.log(`Found ${result.tools.length} tools in ${result.retrievalTimeMs}ms`);
});

retriever.on('cache:hit', ({ query }) => {
  console.log(`Cache hit for: ${query}`);
});

// Injector events
injector.on('injection:completed', ({ result }) => {
  console.log(`Injected ${result.injectedTools.length} tools (${result.tokensUsed} tokens)`);
});
```

## Type Exports

### Core Types

```typescript
import type {
  // Tool Specification
  ToolSpec,
  ToolParameter,
  ToolExample,
  ToolMetadata,
  ToolPermission,
  ToolCategory,

  // Retrieval Results
  ToolRetrievalResult,
  RetrievedTool,
  RetrievalMetadata,

  // Configuration
  JITToolConfig,
  ScoringWeights,

  // Agent Context
  AgentContext,
  TaskContext,
  ToolUsageRecord,
  AgentPreferences,

  // Intent Analysis
  ParsedIntent,
  IntentEntity,

  // Injection Results
  InjectionResult,
  ExcludedTool,
  ExclusionReason,

  // Events
  JITToolEvent,
  JITToolEventPayload,
} from '@wundr.io/jit-tools';
```

### Registry Types

```typescript
import type {
  RegisterToolOptions,
  SearchToolsOptions,
  RegistrationResult,
  RegistryStats,
} from '@wundr.io/jit-tools';
```

### Retriever Types

```typescript
import type { RetrievalOptions } from '@wundr.io/jit-tools';
```

### Injector Types

```typescript
import type {
  InjectionOptions,
  FormattedTool,
} from '@wundr.io/jit-tools';
```

### Intent Analyzer Types

```typescript
import type {
  IntentAnalyzerConfig,
  ActionPattern,
  EntityPattern,
} from '@wundr.io/jit-tools';
```

## Zod Schema Exports

All types have corresponding Zod schemas for runtime validation:

```typescript
import {
  // JSON Type Safety
  JsonPrimitiveSchema,
  JsonValueSchema,
  JsonRecordSchema,

  // Tool Schemas
  ToolPermissionSchema,
  ToolCategorySchema,
  ToolParameterSchema,
  ToolExampleSchema,
  ToolMetadataSchema,
  ToolSpecSchema,

  // Configuration Schemas
  ScoringWeightsSchema,
  JITToolConfigSchema,

  // Context Schemas
  TaskContextSchema,
  ToolUsageRecordSchema,
  AgentPreferencesSchema,
  AgentContextSchema,

  // Intent Schema
  ParsedIntentSchema,
} from '@wundr.io/jit-tools';
```

## Configuration Reference

### JITToolConfig

```typescript
interface JITToolConfig {
  maxTools: number;              // Maximum tools in context (default: 10)
  maxTokenBudget: number;        // Maximum token budget (default: 4000)
  minRelevanceScore: number;     // Minimum relevance threshold (default: 0.3)
  enableSemanticSearch: boolean; // Enable semantic search (default: true)
  enableCaching: boolean;        // Enable result caching (default: true)
  cacheTtlMs: number;            // Cache TTL in ms (default: 300000)
  permissionMode: 'strict' | 'lenient' | 'disabled'; // Permission filter mode
  includedCategories: ToolCategory[];  // Categories to include (empty = all)
  excludedCategories: ToolCategory[];  // Categories to exclude
  scoringWeights: ScoringWeights;      // Custom scoring weights
  retrievalTimeoutMs: number;          // Retrieval timeout (default: 5000)
}
```

### ScoringWeights

```typescript
interface ScoringWeights {
  semantic: number;   // Semantic similarity weight (default: 0.4)
  keyword: number;    // Keyword matching weight (default: 0.25)
  permission: number; // Permission matching weight (default: 0.15)
  priority: number;   // Tool priority weight (default: 0.1)
  category: number;   // Category relevance weight (default: 0.1)
}
```

### InjectionOptions

```typescript
interface InjectionOptions {
  formatStyle: 'compact' | 'detailed' | 'xml' | 'json' | 'markdown';
  includeExamples: boolean;     // Include usage examples
  includeParameters: boolean;   // Include parameter details
  maxExamplesPerTool: number;   // Max examples per tool (default: 2)
  customHeader?: string;        // Custom header text
  customFooter?: string;        // Custom footer text
  groupByCategory: boolean;     // Group tools by category
  sortOrder: 'relevance' | 'alphabetical' | 'priority';
}
```

## Tool Categories

Available tool categories:

- `coordination` - Task orchestration and scheduling
- `monitoring` - Metrics and observability
- `memory` - Context storage and caching
- `neural` - ML/AI operations
- `github` - Git and GitHub operations
- `system` - Performance and benchmarking
- `governance` - Policy and compliance
- `analysis` - Code analysis and review
- `testing` - Test generation and coverage
- `documentation` - Documentation generation
- `deployment` - CI/CD and releases
- `security` - Security scanning and audits
- `custom` - Custom tools

## License

MIT
