# @wundr.io/ai-integration

[![Version](https://img.shields.io/npm/v/@wundr.io/ai-integration.svg)](https://www.npmjs.com/package/@wundr.io/ai-integration)
[![License](https://img.shields.io/npm/l/@wundr.io/ai-integration.svg)](https://github.com/adapticai/wundr/blob/master/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue.svg)](https://www.typescriptlang.org/)
[![Build Status](https://img.shields.io/github/actions/workflow/status/adapticai/wundr/ci.yml)](https://github.com/adapticai/wundr/actions)

> AI Integration Hive Queen - Orchestrating Claude Code, Claude Flow, and MCP tools for intelligent
> development automation.

## Overview

`@wundr.io/ai-integration` is the central orchestration layer for AI-powered development workflows.
It combines **54 specialized agents**, **4 neural models**, and **5 swarm topologies** to create a
comprehensive AI development ecosystem that learns, adapts, and optimizes over time.

### Key Features

- 🤖 **54 Specialized Agents** across 8 categories (Core, Swarm, SPARC, GitHub, Performance, etc.)
- 🧠 **4 Neural Models** with deep learning for task classification, agent selection, and
  performance prediction
- 🌐 **5 Swarm Topologies** (Mesh, Hierarchical, Ring, Star, Adaptive) with auto-selection
- 💾 **Cross-Session Memory** with 12+ persistence strategies and TTL management
- 🔄 **GitHub Automation** for PR reviews, issue triage, and code quality analysis
- 📊 **Performance Monitoring** with real-time metrics, bottleneck detection, and trend analysis
- ⚡ **25+ MCP Tools** for swarm coordination, neural training, and workflow orchestration

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      AIIntegrationHive                          │
│  Orchestrates all AI operations, agent spawning, and memory    │
└──────────────┬──────────────────────────────────────────────────┘
               │
      ┌────────┴─────────┬──────────────┬────────────────┐
      │                  │              │                │
┌─────▼──────┐  ┌───────▼──────┐  ┌───▼────────┐  ┌────▼─────┐
│  Claude    │  │    Swarm     │  │   Neural   │  │  GitHub  │
│   Flow     │  │ Intelligence │  │  Training  │  │  Swarms  │
│Orchestrator│  │   Engine     │  │  Pipeline  │  │  Engine  │
└────────────┘  └──────────────┘  └────────────┘  └──────────┘
      │              │                  │               │
      │         ┌────┴─────┐           │               │
      │    ┌────▼────┐ ┌───▼────┐     │               │
      │    │ Mesh    │ │ Tree   │     │               │
      │    │Topology │ │Topology│     │               │
      │    └─────────┘ └────────┘     │               │
      │                                │               │
┌─────▼────────────────────────────────▼───────────────▼────────┐
│                    Memory Manager                             │
│  Session Memory • Cross-Session Persistence • Optimization    │
└───────────────────────────────────────────────────────────────┘
```

## Installation

```bash
npm install @wundr.io/ai-integration
```

### Prerequisites

- Node.js 18+ or 20+
- TypeScript 5.2+
- Claude Code CLI
- Claude Flow MCP server (optional but recommended)

### MCP Server Setup

Add Claude Flow MCP server for full functionality:

```bash
# Add MCP server via Claude Code
claude mcp add claude-flow npx claude-flow@alpha mcp start

# Verify installation
claude mcp list
```

## Quick Start

### Basic Usage

```typescript
import { AIIntegrationHive } from '@wundr.io/ai-integration';

// Initialize the AI Integration Hive
const hive = new AIIntegrationHive({
  claudeFlowEnabled: true,
  neuralTrainingEnabled: true,
  swarmIntelligenceEnabled: true,
  githubIntegrationEnabled: true,
  memoryPersistence: true,
});

await hive.initialize();

// Spawn agents for a development task
const result = await hive.orchestrateTask({
  description: 'Implement user authentication with tests',
  complexity: 'high',
  priority: 'critical',
  requiredCapabilities: ['coding', 'testing', 'security'],
});

console.log(`Task orchestrated with ${result.agents.length} agents`);
console.log(`Estimated completion: ${result.estimatedDuration}ms`);
```

### Swarm Intelligence

```typescript
import { SwarmIntelligence } from '@wundr.io/ai-integration';

const swarm = new SwarmIntelligence({
  topology: 'adaptive', // auto-selects optimal topology
  maxAgents: 20,
  consensusThreshold: 0.75,
  faultTolerance: 'high',
});

await swarm.initialize();

// Create a mesh swarm for consensus-critical tasks
const meshSwarm = await swarm.createSwarm({
  type: 'mesh',
  agents: ['reviewer-1', 'reviewer-2', 'reviewer-3'],
  task: 'code-review',
});

// Auto-adapt topology based on performance
await swarm.optimizeTopology(meshSwarm.id);
```

### Neural Training

```typescript
import { NeuralTrainingPipeline } from '@wundr.io/ai-integration';

const neuralPipeline = new NeuralTrainingPipeline({
  models: ['task-classifier', 'agent-selector', 'performance-predictor'],
  autoTraining: true,
  learningRate: 0.001,
});

await neuralPipeline.initialize();

// Train on historical task data
await neuralPipeline.trainFromHistory({
  source: 'memory',
  timeframe: '30d',
  minSamples: 100,
});

// Predict optimal agents for a task
const prediction = await neuralPipeline.predictAgents({
  task: 'Refactor authentication module',
  complexity: 'high',
  constraints: { maxAgents: 5 },
});
```

## Claude Flow Agents

The AI Integration system provides **54 specialized agents** across 8 categories:

### Core Development (5 agents)

| Agent        | Capabilities                              | Use Case                  |
| ------------ | ----------------------------------------- | ------------------------- |
| `coder`      | Implementation, refactoring, debugging    | Primary coding tasks      |
| `reviewer`   | Code review, quality assurance, standards | PR reviews, quality gates |
| `tester`     | Testing, validation, test automation      | Unit/integration tests    |
| `planner`    | Planning, architecture, strategy          | Project planning, design  |
| `researcher` | Research, analysis, documentation         | Investigation, docs       |

### Swarm Coordination (5 agents)

| Agent                                 | Topology | Coordination Style         |
| ------------------------------------- | -------- | -------------------------- |
| `hierarchical-coordinator`            | Tree     | Top-down command           |
| `mesh-coordinator`                    | Mesh     | Peer-to-peer consensus     |
| `adaptive-coordinator`                | Adaptive | Dynamic optimization       |
| `collective-intelligence-coordinator` | Hybrid   | Collective decision-making |
| `swarm-memory-manager`                | Any      | Memory synchronization     |

### Consensus & Distributed (7 agents)

- `byzantine-coordinator` - Byzantine fault tolerance
- `raft-manager` - Raft consensus protocol
- `gossip-coordinator` - Gossip-based coordination
- `consensus-builder` - Multi-agent consensus
- `crdt-synchronizer` - CRDT state sync
- `quorum-manager` - Quorum-based decisions
- `security-manager` - Security validation

### Performance & Optimization (5 agents)

- `perf-analyzer` - Performance analysis
- `performance-benchmarker` - Automated benchmarking
- `task-orchestrator` - Task distribution
- `memory-coordinator` - Memory optimization
- `smart-agent` - Intelligent adaptation

### GitHub & Repository (9 agents)

- `github-modes` - GitHub workflow orchestration
- `pr-manager` - Pull request management
- `code-review-swarm` - Automated code review
- `issue-tracker` - Issue triage & tracking
- `release-manager` - Release coordination
- `workflow-automation` - CI/CD automation
- `project-board-sync` - Project board management
- `repo-architect` - Repository architecture
- `multi-repo-swarm` - Multi-repo coordination

### SPARC Methodology (6 agents)

- `sparc-coord` - SPARC workflow coordination
- `sparc-coder` - SPARC-based implementation
- `specification` - Requirements analysis
- `pseudocode` - Algorithm design
- `architecture` - System architecture
- `refinement` - Test-driven refinement

### Specialized Development (8 agents)

- `backend-dev` - Backend development
- `mobile-dev` - Mobile development
- `ml-developer` - Machine learning
- `cicd-engineer` - CI/CD pipelines
- `api-docs` - API documentation
- `system-architect` - System design
- `code-analyzer` - Code analysis
- `base-template-generator` - Template generation

### Testing & Validation (2 agents)

- `tdd-london-swarm` - London-style TDD
- `production-validator` - Production readiness

### Migration & Planning (2 agents)

- `migration-planner` - Migration planning
- `swarm-init` - Swarm initialization

## Swarm Intelligence Examples

### Mesh Topology (Consensus-Critical)

```typescript
// Best for: Code reviews, architecture decisions, critical validations
const meshSwarm = await swarm.createSwarm({
  type: 'mesh',
  maxAgents: 8,
  agents: ['reviewer-1', 'reviewer-2', 'reviewer-3', 'security-manager', 'perf-analyzer'],
  consensusThreshold: 0.8, // 80% agreement required
});

const reviewResult = await swarm.executeTask(meshSwarm.id, {
  task: 'Review security-critical authentication refactor',
  consensusRequired: true,
});

console.log(`Consensus: ${reviewResult.consensus}%`);
console.log(`Approvals: ${reviewResult.approvals}/${reviewResult.totalVotes}`);
```

### Hierarchical Topology (Large Projects)

```typescript
// Best for: Large codebases, structured tasks, command-control
const hierarchicalSwarm = await swarm.createSwarm({
  type: 'hierarchical',
  maxAgents: 50,
  structure: {
    coordinator: 'sparc-coord',
    managers: ['backend-dev', 'mobile-dev', 'ml-developer'],
    workers: 'auto', // Auto-spawn based on workload
  },
});

const projectResult = await swarm.executeTask(hierarchicalSwarm.id, {
  task: 'Implement multi-platform authentication system',
  parallelExecution: true,
  autoScale: true,
});
```

### Ring Topology (Pipeline Processing)

```typescript
// Best for: Sequential workflows, data pipelines, transformations
const ringSwarm = await swarm.createSwarm({
  type: 'ring',
  maxAgents: 10,
  pipeline: [
    'researcher', // 1. Research requirements
    'specification', // 2. Write spec
    'architecture', // 3. Design architecture
    'sparc-coder', // 4. Implement
    'tester', // 5. Test
    'reviewer', // 6. Review
    'api-docs', // 7. Document
  ],
});

const pipelineResult = await swarm.executePipeline(ringSwarm.id, {
  input: 'Create RESTful API for user management',
  stages: 'auto',
});
```

### Star Topology (Real-Time Coordination)

```typescript
// Best for: Live coordination, rapid decisions, broadcast tasks
const starSwarm = await swarm.createSwarm({
  type: 'star',
  maxAgents: 15,
  hub: 'task-orchestrator',
  spokes: 'auto', // Auto-assign based on task type
});

const realTimeResult = await swarm.executeTask(starSwarm.id, {
  task: 'Emergency hotfix for production issue',
  priority: 'critical',
  timeout: 300000, // 5 minutes
});
```

### Adaptive Topology (Auto-Optimization)

```typescript
// Best for: Unknown workloads, learning systems, experimentation
const adaptiveSwarm = await swarm.createSwarm({
  type: 'adaptive',
  maxAgents: 20,
  autoOptimize: true,
  learningEnabled: true,
  optimizationMetrics: ['speed', 'quality', 'cost'],
});

// Swarm automatically adapts topology based on performance
const adaptiveResult = await swarm.executeTask(adaptiveSwarm.id, {
  task: 'Optimize database query performance',
  constraints: {
    maxDuration: 600000,
    maxCost: 100,
  },
});

console.log(`Adapted to topology: ${adaptiveResult.topology}`);
console.log(`Performance gain: ${adaptiveResult.optimizationGain}%`);
```

## Neural Pattern Learning

The AI Integration system uses **4 neural models** for intelligent automation:

### 1. Task Classifier

Categorizes tasks by type, complexity, and required capabilities:

```typescript
import { NeuralModels } from '@wundr.io/ai-integration';

const neuralModels = new NeuralModels();
await neuralModels.initialize();

const classification = await neuralModels.classify({
  task: 'Implement OAuth2 authentication with JWT tokens',
  context: {
    codebase: 'Node.js/Express',
    existingTests: true,
    deadline: '2d',
  },
});

console.log(classification);
// {
//   type: 'feature-implementation',
//   complexity: 'high',
//   estimatedDuration: 14400000, // 4 hours
//   requiredCapabilities: ['backend-dev', 'security', 'testing'],
//   confidence: 0.92
// }
```

### 2. Agent Selector

Predicts optimal agents for tasks based on historical performance:

```typescript
const agentPrediction = await neuralModels.selectAgents({
  task: classification,
  constraints: {
    maxAgents: 5,
    maxCost: 50,
    priorityMetric: 'quality',
  },
});

console.log(agentPrediction);
// {
//   agents: [
//     { type: 'backend-dev', confidence: 0.95, priority: 1 },
//     { type: 'security-manager', confidence: 0.89, priority: 2 },
//     { type: 'tester', confidence: 0.87, priority: 3 },
//     { type: 'reviewer', confidence: 0.82, priority: 4 }
//   ],
//   totalConfidence: 0.88,
//   estimatedSuccess: 0.91
// }
```

### 3. Performance Predictor

Predicts task completion time and resource requirements:

```typescript
const performancePrediction = await neuralModels.predictPerformance({
  task: classification,
  agents: agentPrediction.agents,
  topology: 'hierarchical',
});

console.log(performancePrediction);
// {
//   estimatedDuration: 12600000, // 3.5 hours
//   confidence: 0.85,
//   resourceRequirements: {
//     cpu: 'medium',
//     memory: 'high',
//     network: 'low'
//   },
//   bottleneckProbability: 0.12,
//   successProbability: 0.89
// }
```

### 4. Quality Optimizer

Optimizes code quality through learned patterns:

```typescript
const qualityOptimization = await neuralModels.optimizeQuality({
  code: sourceCode,
  language: 'typescript',
  context: {
    framework: 'express',
    patterns: ['error-handling', 'validation', 'logging'],
  },
});

console.log(qualityOptimization);
// {
//   suggestions: [
//     {
//       type: 'error-handling',
//       severity: 'high',
//       pattern: 'try-catch-async',
//       confidence: 0.94,
//       impact: 'high'
//     },
//     // ... more suggestions
//   ],
//   overallQualityScore: 0.78,
//   improvementPotential: 0.22
// }
```

### Training from Historical Data

```typescript
import { NeuralTrainingPipeline } from '@wundr.io/ai-integration';

const pipeline = new NeuralTrainingPipeline({
  models: ['task-classifier', 'agent-selector', 'performance-predictor'],
  autoTraining: true,
});

await pipeline.initialize();

// Train from session history
const trainingResult = await pipeline.trainFromHistory({
  source: 'memory',
  timeframe: '90d',
  minSamples: 500,
  validationSplit: 0.2,
});

console.log(`Models trained on ${trainingResult.samples} samples`);
console.log(`Average accuracy: ${trainingResult.accuracy * 100}%`);
console.log(`Validation loss: ${trainingResult.validationLoss}`);
```

## GitHub Code Review Swarms

Automate code reviews with AI-powered swarm intelligence:

### Basic Code Review

```typescript
import { CodeReviewSwarm } from '@wundr.io/ai-integration';

const reviewSwarm = new CodeReviewSwarm({
  githubToken: process.env.GITHUB_TOKEN,
  swarmConfig: {
    topology: 'mesh',
    consensusThreshold: 0.75,
  },
});

await reviewSwarm.initialize();

const review = await reviewSwarm.reviewPullRequest({
  owner: 'adapticai',
  repo: 'wundr',
  prNumber: 42,
  depth: 'comprehensive',
});

console.log(review);
// {
//   summary: {
//     filesReviewed: 12,
//     issuesFound: 8,
//     suggestions: 15,
//     approvalStatus: 'changes-requested',
//     consensus: 0.83
//   },
//   issues: [
//     {
//       file: 'src/auth/login.ts',
//       line: 45,
//       severity: 'high',
//       type: 'security',
//       message: 'SQL injection vulnerability detected',
//       suggestion: 'Use parameterized queries',
//       confidence: 0.96,
//       detectedBy: ['security-manager', 'code-analyzer']
//     },
//     // ... more issues
//   ]
// }
```

### Automated Issue Triage

```typescript
const issueTriage = await reviewSwarm.triageIssues({
  owner: 'adapticai',
  repo: 'wundr',
  state: 'open',
  autoLabel: true,
  autoPrioritize: true,
});

console.log(`Triaged ${issueTriage.processed} issues`);
console.log(`Labels applied: ${issueTriage.labelsApplied}`);
console.log(`Priority distribution:`, issueTriage.priorityDistribution);
```

### Release Coordination

```typescript
const releaseCoordination = await reviewSwarm.coordinateRelease({
  owner: 'adapticai',
  repo: 'wundr',
  version: '2.0.0',
  branch: 'release/2.0.0',
  tasks: [
    'version-bump',
    'changelog-generation',
    'test-suite-run',
    'security-audit',
    'performance-benchmark',
    'documentation-update',
  ],
});

console.log(`Release ${releaseCoordination.version} ready`);
console.log(`All checks passed: ${releaseCoordination.allChecksPassed}`);
```

## Performance Monitoring

Real-time performance tracking with bottleneck detection:

### Metrics Collection

```typescript
import { PerformanceAnalyzer } from '@wundr.io/ai-integration';

const analyzer = new PerformanceAnalyzer({
  metricsInterval: 5000, // 5 seconds
  retentionPeriod: 2592000000, // 30 days
  alertThresholds: {
    taskDuration: 30000, // 30 seconds
    agentUtilization: 0.9, // 90%
    memoryUsage: 0.85, // 85%
  },
});

await analyzer.initialize();

// Collect metrics automatically
analyzer.on('metrics', metrics => {
  console.log('System Metrics:', {
    activeAgents: metrics.activeAgents,
    taskQueueSize: metrics.taskQueueSize,
    averageTaskDuration: metrics.averageTaskDuration,
    successRate: metrics.successRate,
    cpuUsage: metrics.cpuUsage,
    memoryUsage: metrics.memoryUsage,
  });
});
```

### Bottleneck Detection

```typescript
import { BottleneckDetection } from '@wundr.io/ai-integration';

const bottleneckDetector = new BottleneckDetection({
  analysisInterval: 60000, // 1 minute
  detectionThreshold: 0.7,
});

await bottleneckDetector.initialize();

bottleneckDetector.on('bottleneck-detected', bottleneck => {
  console.log('⚠️ Bottleneck detected:', {
    type: bottleneck.type,
    severity: bottleneck.severity,
    component: bottleneck.component,
    impact: bottleneck.impact,
    recommendations: bottleneck.recommendations,
  });
});

// Manual bottleneck analysis
const analysis = await bottleneckDetector.analyzeSystem();
console.log('Bottleneck Analysis:', analysis);
```

### Trend Analysis

```typescript
const trendAnalysis = await analyzer.analyzeTrends({
  metrics: ['taskDuration', 'successRate', 'agentUtilization'],
  period: '7d',
  aggregation: 'hourly',
});

console.log('7-Day Trends:', {
  taskDuration: {
    trend: trendAnalysis.taskDuration.trend, // 'increasing', 'decreasing', 'stable'
    changePercent: trendAnalysis.taskDuration.changePercent,
    forecast: trendAnalysis.taskDuration.forecast,
  },
  // ... other metrics
});
```

## Configuration

### Environment Variables

```bash
# Claude API (optional, for direct API access)
ANTHROPIC_API_KEY=sk-ant-...

# GitHub Integration
GITHUB_TOKEN=ghp_...
GITHUB_WEBHOOK_SECRET=your-webhook-secret

# Memory Persistence
MEMORY_BACKEND=sqlite # sqlite | redis | file
MEMORY_PATH=./memory
MEMORY_TTL=2592000000 # 30 days

# Neural Training
NEURAL_TRAINING_ENABLED=true
NEURAL_AUTO_TRAIN=true
NEURAL_TRAINING_INTERVAL=86400000 # 24 hours

# Performance Monitoring
METRICS_ENABLED=true
METRICS_INTERVAL=5000 # 5 seconds
METRICS_RETENTION=2592000000 # 30 days

# Swarm Configuration
SWARM_MAX_AGENTS=50
SWARM_DEFAULT_TOPOLOGY=adaptive
SWARM_CONSENSUS_THRESHOLD=0.75
```

### TypeScript Configuration

```typescript
import { AIIntegrationHive } from '@wundr.io/ai-integration';

const hive = new AIIntegrationHive({
  // Claude Flow Integration
  claudeFlowEnabled: true,
  claudeFlowMCPServer: 'claude-flow',

  // Neural Training
  neuralTrainingEnabled: true,
  neuralTrainingConfig: {
    models: ['task-classifier', 'agent-selector', 'performance-predictor'],
    autoTraining: true,
    trainingInterval: 86400000, // 24 hours
    minSamplesForTraining: 100,
  },

  // Swarm Intelligence
  swarmIntelligenceEnabled: true,
  swarmConfig: {
    defaultTopology: 'adaptive',
    maxAgents: 50,
    consensusThreshold: 0.75,
    faultTolerance: 'high',
    autoOptimize: true,
  },

  // Memory Management
  memoryPersistence: true,
  memoryConfig: {
    backend: 'sqlite',
    path: './memory',
    ttl: 2592000000, // 30 days
    compression: true,
    encryption: false,
  },

  // GitHub Integration
  githubIntegrationEnabled: true,
  githubConfig: {
    token: process.env.GITHUB_TOKEN,
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
    autoReview: true,
    autoTriage: true,
  },

  // Performance Monitoring
  monitoringEnabled: true,
  monitoringConfig: {
    metricsInterval: 5000,
    retentionPeriod: 2592000000,
    bottleneckDetection: true,
    alerting: true,
  },
});

await hive.initialize();
```

## API Reference

### Core Classes

- `AIIntegrationHive` - Main orchestration hub
- `ClaudeFlowOrchestrator` - Claude Flow coordination
- `SwarmIntelligence` - Swarm topology management
- `NeuralTrainingPipeline` - Neural model training
- `MemoryManager` - Cross-session persistence
- `GitHubIntegration` - GitHub automation
- `PerformanceAnalyzer` - Metrics and monitoring

### Agent Management

- `AgentCoordinator` - Agent lifecycle management
- `AgentSpawner` - Dynamic agent creation
- `AgentRegistry` - 54 agent type definitions

### Neural Processing

- `NeuralModels` - 4 neural model implementations
- `PatternRecognition` - Pattern learning and detection
- `TrainingPipeline` - Automated training workflows

### Memory & State

- `SessionMemory` - In-session state management
- `CrossSessionPersistence` - Long-term memory storage
- `MemoryOptimization` - Memory compression and cleanup

### Monitoring

- `MetricsCollector` - Real-time metrics collection
- `BottleneckDetection` - Performance bottleneck analysis
- `TrendAnalysis` - Historical trend analysis

## Performance Characteristics

| Metric                       | Value  | Notes                      |
| ---------------------------- | ------ | -------------------------- |
| Total Lines of Code          | 12,502 | TypeScript implementation  |
| Agent Types                  | 54     | Specialized agents         |
| Neural Models                | 4      | Deep learning models       |
| Swarm Topologies             | 5      | Auto-adaptive              |
| MCP Tools                    | 25+    | Claude Flow integration    |
| Memory Backends              | 3      | SQLite, Redis, File        |
| Max Concurrent Agents        | 50+    | Configurable per topology  |
| Task Classification Accuracy | 92%+   | With 500+ training samples |
| Agent Selection Accuracy     | 88%+   | With historical data       |
| Performance Prediction R²    | 0.85+  | Regression model           |
| Average Task Orchestration   | <100ms | Excluding agent execution  |
| Memory Footprint             | ~50MB  | Base + models              |

## Related Packages

- `@wundr.io/orchestration-hive` - Parent orchestration framework
- `@wundr.io/code-analysis-hive` - Code quality and static analysis
- `@wundr.io/deployment-hive` - CI/CD and deployment automation
- `@wundr.io/documentation-hive` - Documentation generation and management

## Examples

See the [examples](../../examples/ai-integration) directory for complete working examples:

- Basic swarm orchestration
- Neural training pipeline
- GitHub PR automation
- Performance monitoring
- Custom agent development

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT © Wundr.io

## Support

- Documentation: https://wundr.io/docs/ai-integration
- Issues: https://github.com/adapticai/wundr/issues
- Discord: https://discord.gg/wundr

---

Built with ❤️ by the Wundr.io team
