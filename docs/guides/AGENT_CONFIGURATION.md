# Agent Configuration Guide: Customizing Claude Flow Agents

Complete guide to configuring, customizing, and creating agents for Claude Flow integration with
Claude Code.

## Table of Contents

- [Agent Overview](#agent-overview)
- [Built-in Agents](#built-in-agents)
- [Agent Configuration](#agent-configuration)
- [Creating Custom Agents](#creating-custom-agents)
- [Agent Specialization](#agent-specialization)
- [Agent Teams and Topologies](#agent-teams-and-topologies)
- [Performance Tuning](#performance-tuning)
- [Real-World Examples](#real-world-examples)
- [Best Practices](#best-practices)

## Agent Overview

Claude Flow provides 54+ specialized agents that coordinate through MCP while Claude Code executes
the actual work.

### Agent Architecture

```
┌─────────────────────────────────────────────┐
│         Coordination Layer (MCP)            │
│  ┌─────────────────────────────────────┐   │
│  │   Claude Flow Agent Manager         │   │
│  │  - Task Distribution                │   │
│  │  - Memory Management                │   │
│  │  - Performance Tracking             │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│       Execution Layer (Claude Code)         │
│  ┌─────────────────────────────────────┐   │
│  │   - File Operations                 │   │
│  │   - Code Generation                 │   │
│  │   - Build & Test                    │   │
│  │   - Git Operations                  │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### Agent Lifecycle

1. **Spawn**: Agent initialized with configuration
2. **Assign**: Given task and context
3. **Execute**: Performs work via Claude Code
4. **Report**: Updates memory and metrics
5. **Coordinate**: Communicates with other agents
6. **Complete**: Finalizes and persists results

## Built-in Agents

### Core Development Agents

#### coder

**Purpose**: General-purpose code implementation

```json
{
  "type": "coder",
  "capabilities": ["implement-features", "refactor-code", "fix-bugs", "write-tests"],
  "languages": ["javascript", "typescript", "python", "go", "rust"],
  "frameworks": ["react", "vue", "express", "fastify"],
  "defaultBehavior": {
    "testFirst": false,
    "autoFormat": true,
    "lintOnSave": true
  }
}
```

**Usage**:

```bash
npx claude-flow@alpha agent spawn --type coder
```

#### reviewer

**Purpose**: Code review and quality assurance

```json
{
  "type": "reviewer",
  "focus": ["code-quality", "best-practices", "security", "performance", "maintainability"],
  "checks": {
    "complexity": true,
    "coverage": true,
    "security": true,
    "performance": true
  }
}
```

#### tester

**Purpose**: Test creation and validation

```json
{
  "type": "tester",
  "testTypes": ["unit", "integration", "e2e", "performance"],
  "frameworks": ["jest", "vitest", "mocha", "playwright"],
  "coverage": {
    "minimum": 80,
    "enforce": true
  }
}
```

#### planner

**Purpose**: Task breakdown and planning

```json
{
  "type": "planner",
  "skills": [
    "task-decomposition",
    "dependency-analysis",
    "timeline-estimation",
    "resource-allocation"
  ]
}
```

#### researcher

**Purpose**: Research and analysis

```json
{
  "type": "researcher",
  "domains": ["api-patterns", "library-evaluation", "best-practices", "performance-optimization"]
}
```

### Specialized Development Agents

#### backend-dev

**Specialization**: Backend development

```json
{
  "type": "backend-dev",
  "expertise": {
    "apis": ["REST", "GraphQL", "gRPC"],
    "databases": ["PostgreSQL", "MongoDB", "Redis"],
    "frameworks": ["Express", "NestJS", "Fastify"],
    "patterns": ["MVC", "Clean Architecture", "DDD"]
  }
}
```

#### mobile-dev

**Specialization**: Mobile development

```json
{
  "type": "mobile-dev",
  "platforms": ["ios", "android", "cross-platform"],
  "frameworks": ["React Native", "Flutter", "SwiftUI", "Kotlin"],
  "focus": ["responsive-design", "offline-support", "performance", "platform-specific-features"]
}
```

#### ml-developer

**Specialization**: Machine learning

```json
{
  "type": "ml-developer",
  "frameworks": ["TensorFlow", "PyTorch", "scikit-learn"],
  "tasks": ["model-training", "data-preprocessing", "feature-engineering", "model-deployment"]
}
```

#### cicd-engineer

**Specialization**: CI/CD pipelines

```json
{
  "type": "cicd-engineer",
  "platforms": ["GitHub Actions", "GitLab CI", "Jenkins"],
  "focus": ["pipeline-optimization", "deployment-automation", "test-automation", "monitoring"]
}
```

### SPARC Methodology Agents

#### sparc-coord

**Purpose**: SPARC workflow coordination

```json
{
  "type": "sparc-coord",
  "phases": ["specification", "pseudocode", "architecture", "refinement", "completion"],
  "orchestration": true
}
```

#### specification

**Purpose**: Requirements analysis

#### pseudocode

**Purpose**: Algorithm design

#### architecture

**Purpose**: System design

#### refinement

**Purpose**: Implementation with TDD

### Swarm Coordination Agents

#### hierarchical-coordinator

**Purpose**: Hierarchical team management

```json
{
  "type": "hierarchical-coordinator",
  "topology": "hierarchical",
  "responsibilities": [
    "task-delegation",
    "progress-tracking",
    "resource-allocation",
    "conflict-resolution"
  ]
}
```

#### mesh-coordinator

**Purpose**: Peer-to-peer coordination

```json
{
  "type": "mesh-coordinator",
  "topology": "mesh",
  "communication": "peer-to-peer",
  "consensus": "majority-vote"
}
```

#### adaptive-coordinator

**Purpose**: Dynamic topology adaptation

```json
{
  "type": "adaptive-coordinator",
  "adaptation": {
    "enabled": true,
    "factors": ["complexity", "team-size", "performance"],
    "strategies": ["hierarchical", "mesh", "pipeline"]
  }
}
```

### GitHub Integration Agents

#### pr-manager

**Purpose**: Pull request management

```json
{
  "type": "pr-manager",
  "capabilities": ["pr-creation", "pr-review", "merge-strategy", "conflict-resolution"]
}
```

#### code-review-swarm

**Purpose**: Collaborative code review

#### issue-tracker

**Purpose**: Issue management and triage

#### release-manager

**Purpose**: Release automation

### Performance & Analysis Agents

#### perf-analyzer

**Purpose**: Performance analysis

```json
{
  "type": "perf-analyzer",
  "metrics": ["response-time", "memory-usage", "cpu-utilization", "database-queries"],
  "optimization": true
}
```

#### security-manager

**Purpose**: Security analysis and enforcement

```json
{
  "type": "security-manager",
  "checks": [
    "dependency-vulnerabilities",
    "code-injection",
    "authentication",
    "authorization",
    "data-encryption"
  ]
}
```

## Agent Configuration

### Global Configuration

Create `.claude-flow/agents.config.json`:

```json
{
  "agents": {
    "defaults": {
      "timeout": 300000,
      "retries": 3,
      "memory": {
        "enabled": true,
        "scope": "agent"
      },
      "metrics": {
        "track": true,
        "upload": false
      }
    },
    "overrides": {
      "coder": {
        "timeout": 600000,
        "autoFormat": true,
        "lintOnSave": true
      },
      "tester": {
        "timeout": 900000,
        "coverage": {
          "minimum": 80,
          "enforce": true
        }
      }
    }
  },
  "teams": {
    "backend": {
      "agents": ["backend-dev", "tester", "reviewer"],
      "coordinator": "hierarchical-coordinator"
    },
    "frontend": {
      "agents": ["coder", "mobile-dev", "tester"],
      "coordinator": "mesh-coordinator"
    }
  }
}
```

### Per-Agent Configuration

#### Configure Specific Agent

```bash
# Configure coder agent
npx claude-flow@alpha agent configure coder \
  --timeout 600000 \
  --auto-format true \
  --lint-on-save true \
  --languages "typescript,python,go"

# Configure tester agent
npx claude-flow@alpha agent configure tester \
  --framework jest \
  --coverage-min 80 \
  --test-types "unit,integration"

# Configure reviewer agent
npx claude-flow@alpha agent configure reviewer \
  --checks "security,performance,best-practices" \
  --complexity-max 15
```

#### Agent-Specific Config Files

Create `.claude-flow/agents/coder.config.json`:

```json
{
  "type": "coder",
  "timeout": 600000,
  "languages": ["typescript", "python", "go"],
  "preferences": {
    "codeStyle": "airbnb",
    "indentation": 2,
    "quotes": "single",
    "semicolons": true
  },
  "autoFormat": {
    "enabled": true,
    "onSave": true,
    "formatter": "prettier"
  },
  "linting": {
    "enabled": true,
    "rules": "strict",
    "autoFix": true
  },
  "testing": {
    "runOnChange": false,
    "framework": "jest",
    "coverage": false
  },
  "hooks": {
    "preTask": ["git pull", "npm install"],
    "postTask": ["npm test", "git push"]
  }
}
```

### Environment-Specific Configuration

```json
{
  "environments": {
    "development": {
      "agents": {
        "coder": {
          "testing": { "runOnChange": true },
          "linting": { "autoFix": true }
        }
      }
    },
    "staging": {
      "agents": {
        "coder": {
          "testing": { "runOnChange": true, "coverage": true },
          "security": { "scanOnSave": true }
        }
      }
    },
    "production": {
      "agents": {
        "reviewer": {
          "required": true,
          "minApprovals": 2
        },
        "security-manager": {
          "required": true,
          "scanDepth": "deep"
        }
      }
    }
  }
}
```

## Creating Custom Agents

### Basic Custom Agent

Create `.claude-flow/agents/custom/my-agent.js`:

```javascript
module.exports = {
  name: 'my-custom-agent',
  version: '1.0.0',
  description: 'Custom agent for specific task',

  // Agent capabilities
  capabilities: ['analyze-code', 'generate-docs', 'optimize-performance'],

  // Default configuration
  config: {
    timeout: 300000,
    retries: 3,
    memory: true,
  },

  // Initialization
  async init(context) {
    this.context = context;
    this.memory = context.memory;
    this.metrics = context.metrics;

    // Custom initialization
    console.log(`Initializing ${this.name}`);
  },

  // Main execution
  async execute(task) {
    const startTime = Date.now();

    try {
      // Pre-execution
      await this.preExecute(task);

      // Main work
      const result = await this.doWork(task);

      // Post-execution
      await this.postExecute(result);

      // Track metrics
      this.metrics.record({
        agent: this.name,
        task: task.id,
        duration: Date.now() - startTime,
        status: 'success',
      });

      return result;
    } catch (error) {
      // Error handling
      await this.handleError(error, task);
      throw error;
    }
  },

  // Pre-execution hook
  async preExecute(task) {
    // Validate task
    if (!task.description) {
      throw new Error('Task description required');
    }

    // Load context from memory
    const context = await this.memory.retrieve(`task/${task.id}/context`);
    this.context.taskContext = context;

    // Initialize resources
    await this.initializeResources(task);
  },

  // Main work implementation
  async doWork(task) {
    // Custom logic here
    const analysis = await this.analyzeCode(task.files);
    const docs = await this.generateDocumentation(analysis);
    const optimizations = await this.suggestOptimizations(analysis);

    return {
      analysis,
      documentation: docs,
      optimizations,
    };
  },

  // Post-execution hook
  async postExecute(result) {
    // Store results in memory
    await this.memory.store(`result/${this.context.task.id}`, result);

    // Update metrics
    await this.updateMetrics(result);

    // Notify other agents
    await this.notify('task-complete', result);
  },

  // Error handling
  async handleError(error, task) {
    console.error(`Error in ${this.name}:`, error);

    // Store error details
    await this.memory.store(`error/${task.id}`, {
      agent: this.name,
      error: error.message,
      stack: error.stack,
      timestamp: Date.now(),
    });

    // Metrics
    this.metrics.record({
      agent: this.name,
      task: task.id,
      status: 'error',
      error: error.message,
    });
  },

  // Custom methods
  async analyzeCode(files) {
    // Implementation
  },

  async generateDocumentation(analysis) {
    // Implementation
  },

  async suggestOptimizations(analysis) {
    // Implementation
  },
};
```

### Register Custom Agent

```bash
# Register agent
npx claude-flow@alpha agent register \
  --file .claude-flow/agents/custom/my-agent.js

# Verify registration
npx claude-flow@alpha agent list --custom

# Spawn custom agent
npx claude-flow@alpha agent spawn --type my-custom-agent
```

### Advanced Custom Agent with Plugins

```javascript
// .claude-flow/agents/custom/advanced-agent.js
module.exports = {
  name: 'advanced-custom-agent',
  version: '2.0.0',

  // Plugin system
  plugins: ['@claude-flow/plugin-git', '@claude-flow/plugin-github', '@claude-flow/plugin-testing'],

  // Agent state
  state: {
    tasksCompleted: 0,
    errors: 0,
    performance: [],
  },

  // Advanced configuration
  config: {
    parallelism: 3,
    queueSize: 10,
    adaptiveTimeout: true,
    selfHealing: true,
    learningEnabled: true,
  },

  // Initialize with plugins
  async init(context) {
    this.context = context;

    // Load plugins
    this.plugins = await this.loadPlugins();

    // Initialize neural patterns
    if (this.config.learningEnabled) {
      this.neural = await context.neural.init(this.name);
    }

    // Setup event handlers
    this.setupEventHandlers();
  },

  // Adaptive execution
  async execute(task) {
    // Analyze task complexity
    const complexity = await this.analyzeComplexity(task);

    // Adjust timeout based on complexity
    if (this.config.adaptiveTimeout) {
      this.timeout = this.calculateTimeout(complexity);
    }

    // Parallel processing for complex tasks
    if (complexity > 7 && this.config.parallelism > 1) {
      return await this.executeParallel(task);
    }

    return await this.executeSequential(task);
  },

  // Parallel execution
  async executeParallel(task) {
    const subtasks = this.splitTask(task);

    const results = await Promise.all(subtasks.map(subtask => this.executeSubtask(subtask)));

    return this.mergeResults(results);
  },

  // Learning from execution
  async postExecute(result) {
    await super.postExecute(result);

    // Train neural patterns
    if (this.config.learningEnabled) {
      await this.neural.train({
        task: this.context.task,
        result,
        duration: result.duration,
        quality: result.quality,
      });
    }

    // Update state
    this.state.tasksCompleted++;
    this.state.performance.push({
      duration: result.duration,
      quality: result.quality,
    });

    // Self-healing
    if (this.config.selfHealing) {
      await this.checkHealth();
    }
  },

  // Self-healing capability
  async checkHealth() {
    const recentPerformance = this.state.performance.slice(-10);
    const avgDuration =
      recentPerformance.reduce((a, b) => a + b.duration, 0) / recentPerformance.length;

    // Detect degradation
    if (avgDuration > this.config.timeout * 0.8) {
      console.warn('Performance degradation detected');
      await this.heal();
    }
  },

  async heal() {
    // Clear caches
    await this.clearCaches();

    // Reset connections
    await this.resetConnections();

    // Optimize configuration
    await this.optimizeConfig();
  },
};
```

## Agent Specialization

### Specializing Existing Agents

```bash
# Create specialized coder for TypeScript
npx claude-flow@alpha agent specialize coder \
  --name typescript-expert \
  --language typescript \
  --frameworks "react,nestjs" \
  --patterns "clean-architecture,ddd"

# Create specialized tester for E2E
npx claude-flow@alpha agent specialize tester \
  --name e2e-specialist \
  --test-type e2e \
  --framework playwright \
  --focus "user-flows,performance"
```

### Specialization Configuration

```json
{
  "specializations": {
    "typescript-expert": {
      "base": "coder",
      "language": "typescript",
      "expertise": {
        "advanced-types": true,
        "generics": true,
        "decorators": true
      },
      "frameworks": ["react", "nestjs", "typeorm"],
      "patterns": ["clean-architecture", "ddd", "cqrs"],
      "autoImport": true,
      "strictMode": true
    },
    "performance-optimizer": {
      "base": "perf-analyzer",
      "focus": ["database", "api", "frontend"],
      "tools": ["lighthouse", "k6", "artillery"],
      "thresholds": {
        "responseTime": 200,
        "timeToInteractive": 3000,
        "firstContentfulPaint": 1500
      }
    }
  }
}
```

## Agent Teams and Topologies

### Team Configuration

```json
{
  "teams": {
    "backend-team": {
      "coordinator": "hierarchical-coordinator",
      "agents": [
        {
          "type": "backend-dev",
          "role": "lead",
          "specialization": "api-design"
        },
        {
          "type": "coder",
          "role": "member",
          "count": 2
        },
        {
          "type": "tester",
          "role": "quality-assurance"
        },
        {
          "type": "security-manager",
          "role": "security"
        }
      ],
      "workflow": "tdd",
      "communication": "hierarchical"
    },
    "frontend-team": {
      "coordinator": "mesh-coordinator",
      "agents": [
        {
          "type": "coder",
          "specialization": "react"
        },
        {
          "type": "mobile-dev",
          "specialization": "react-native"
        },
        {
          "type": "tester",
          "specialization": "e2e"
        }
      ],
      "workflow": "agile",
      "communication": "peer-to-peer"
    }
  }
}
```

### Topology Selection

```bash
# Hierarchical for structured tasks
npx claude-flow@alpha swarm start \
  --topology hierarchical \
  --coordinator hierarchical-coordinator \
  --agents backend-dev,coder,tester,reviewer

# Mesh for collaborative tasks
npx claude-flow@alpha swarm start \
  --topology mesh \
  --agents coder,coder,coder,reviewer

# Adaptive (auto-selects based on task)
npx claude-flow@alpha swarm start \
  --topology adaptive \
  --task "Build microservices architecture"
```

## Performance Tuning

### Agent Performance Configuration

```json
{
  "performance": {
    "concurrency": {
      "maxAgents": 10,
      "maxTasksPerAgent": 3,
      "queueStrategy": "priority"
    },
    "resources": {
      "cpu": {
        "limit": 80,
        "perAgent": 20
      },
      "memory": {
        "limit": 75,
        "perAgent": 512
      }
    },
    "optimization": {
      "caching": true,
      "memoization": true,
      "parallelization": true
    },
    "monitoring": {
      "enabled": true,
      "interval": 5000,
      "metrics": ["cpu", "memory", "duration", "quality"]
    }
  }
}
```

### Agent Metrics

```bash
# View agent metrics
npx claude-flow@alpha agent metrics <agent-id>

# Performance report
npx claude-flow@alpha agent report \
  --agent coder \
  --period 7d \
  --format json

# Benchmark agents
npx claude-flow@alpha agent benchmark \
  --agents coder,reviewer,tester \
  --task "Implement CRUD API"
```

## Real-World Examples

### Example 1: E-Commerce Development Team

```json
{
  "project": "e-commerce-platform",
  "teams": {
    "api-team": {
      "coordinator": "hierarchical-coordinator",
      "agents": [
        {
          "type": "backend-dev",
          "role": "lead",
          "focus": ["api-design", "database-schema"]
        },
        {
          "type": "coder",
          "count": 2,
          "specialization": "nodejs"
        },
        {
          "type": "tester",
          "focus": ["api-testing", "load-testing"]
        },
        {
          "type": "security-manager",
          "focus": ["authentication", "payment-security"]
        }
      ]
    },
    "frontend-team": {
      "coordinator": "mesh-coordinator",
      "agents": [
        {
          "type": "coder",
          "specialization": "react",
          "focus": "shopping-cart"
        },
        {
          "type": "mobile-dev",
          "specialization": "react-native",
          "focus": "mobile-app"
        },
        {
          "type": "tester",
          "specialization": "e2e",
          "focus": "checkout-flow"
        }
      ]
    }
  }
}
```

Usage:

```bash
npx claude-flow@alpha swarm start \
  --config .claude-flow/teams/ecommerce.json \
  --task "Build complete shopping cart and checkout system"
```

### Example 2: Microservices Refactoring

```bash
# Spawn specialized team
npx claude-flow@alpha swarm start \
  --topology adaptive \
  --task "Refactor monolith to microservices"

# Team auto-spawns:
# - system-architect: Design microservices architecture
# - backend-dev (x3): Implement services
# - cicd-engineer: Setup deployment pipeline
# - tester (x2): Create integration tests
# - api-docs: Document all APIs
```

### Example 3: Security Audit

```bash
# Security-focused team
npx claude-flow@alpha swarm start \
  --topology hierarchical \
  --coordinator security-manager \
  --agents code-analyzer,reviewer,tester \
  --task "Perform comprehensive security audit"
```

## Best Practices

### 1. Agent Assignment Strategy

```javascript
// .claude-flow/agent-strategy.js
module.exports = {
  assignAgent(file, task) {
    // File-based assignment
    if (file.endsWith('.test.js')) return 'tester';
    if (file.match(/api|service/)) return 'backend-dev';
    if (file.match(/component|ui/)) return 'coder';

    // Task-based assignment
    if (task.type === 'security') return 'security-manager';
    if (task.type === 'optimization') return 'perf-analyzer';

    // Default
    return 'coder';
  },
};
```

### 2. Memory Management

```bash
# Agent-scoped memory
npx claude-flow@alpha memory store \
  --key "agent/coder-1/preferences" \
  --value '{"style": "airbnb"}' \
  --scope agent

# Shared team memory
npx claude-flow@alpha memory store \
  --key "team/backend/conventions" \
  --value '{"architecture": "clean"}' \
  --scope team
```

### 3. Progressive Enhancement

```json
{
  "progression": {
    "phases": [
      {
        "phase": 1,
        "agents": ["coder"],
        "goal": "Basic implementation"
      },
      {
        "phase": 2,
        "agents": ["coder", "tester"],
        "goal": "Add tests"
      },
      {
        "phase": 3,
        "agents": ["coder", "tester", "reviewer"],
        "goal": "Quality assurance"
      },
      {
        "phase": 4,
        "agents": ["coder", "tester", "reviewer", "security-manager"],
        "goal": "Production ready"
      }
    ]
  }
}
```

### 4. Failure Recovery

```json
{
  "recovery": {
    "strategies": {
      "retry": {
        "maxAttempts": 3,
        "backoff": "exponential",
        "agents": ["coder", "tester"]
      },
      "reassign": {
        "threshold": 2,
        "agents": ["coder"]
      },
      "escalate": {
        "threshold": 3,
        "to": "coordinator"
      }
    }
  }
}
```

## Summary

Agent configuration enables:

- ✅ **Customization**: Tailor agents to your needs
- ✅ **Specialization**: Create expert agents
- ✅ **Team Coordination**: Efficient collaboration
- ✅ **Performance**: Optimize resource usage
- ✅ **Scalability**: Handle complex projects
- ✅ **Quality**: Consistent results

**Next Steps**:

- [Hook Development Guide](./HOOK_DEVELOPMENT.md)
- [Template Customization](./TEMPLATE_CUSTOMIZATION.md)
- [API Reference](../reference/API.md)

---

**Pro Tip**: Start with built-in agents, customize as needed, create custom agents for unique
workflows.
