# API Reference

This document provides comprehensive reference for all Wundr APIs, including the CLI commands,
programmatic interfaces, configuration options, and plugin development APIs.

## 📋 Table of Contents

- [CLI API Reference](#-cli-api-reference)
- [Programmatic API](#-programmatic-api)
- [Configuration API](#%EF%B8%8F-configuration-api)
- [Plugin Development API](#-plugin-development-api)
- [Dashboard API](#-dashboard-api)
- [WebSocket API](#-websocket-api)
- [REST API](#-rest-api)

## 🛠️ CLI API Reference

### Global Options

These options are available for all commands:

| Option       | Type    | Description               | Default             |
| ------------ | ------- | ------------------------- | ------------------- |
| `--version`  | boolean | Show version number       | -                   |
| `--help`     | boolean | Show help information     | -                   |
| `--config`   | string  | Path to config file       | `wundr.config.json` |
| `--verbose`  | boolean | Enable verbose output     | `false`             |
| `--debug`    | boolean | Enable debug output       | `false`             |
| `--quiet`    | boolean | Suppress non-error output | `false`             |
| `--no-color` | boolean | Disable colored output    | `false`             |

### Command: `wundr init`

Initialize Wundr in a project.

```bash
wundr init [options]
```

#### Options

| Option              | Type    | Description                                           | Default       |
| ------------------- | ------- | ----------------------------------------------------- | ------------- |
| `--interactive, -i` | boolean | Interactive setup wizard                              | `false`       |
| `--template, -t`    | string  | Project template (`react`, `vue`, `typescript`, etc.) | `auto-detect` |
| `--ai-enabled`      | boolean | Enable AI features                                    | `false`       |
| `--dashboard`       | boolean | Setup dashboard                                       | `true`        |
| `--monorepo`        | boolean | Configure for monorepo                                | `false`       |
| `--enterprise`      | boolean | Enterprise configuration                              | `false`       |
| `--overwrite`       | boolean | Overwrite existing config                             | `false`       |

#### Examples

```bash
# Interactive setup
wundr init --interactive

# TypeScript project with AI
wundr init --template typescript --ai-enabled

# Monorepo setup
wundr init --monorepo --enterprise
```

### Command: `wundr analyze`

Analyze codebase for quality, duplicates, and architectural issues.

```bash
wundr analyze [path] [options]
```

#### Arguments

| Argument | Type   | Description     | Default |
| -------- | ------ | --------------- | ------- |
| `path`   | string | Path to analyze | `./src` |

#### Options

| Option              | Type     | Description                 | Default                    |
| ------------------- | -------- | --------------------------- | -------------------------- |
| `--focus`           | string[] | Analysis focus areas        | `["all"]`                  |
| `--exclude`         | string[] | Patterns to exclude         | `[]`                       |
| `--include`         | string[] | Patterns to include         | `["**/*.{js,ts,jsx,tsx}"]` |
| `--format`          | string[] | Output formats              | `["json", "html"]`         |
| `--output, -o`      | string   | Output directory            | `./wundr-output`           |
| `--ai-review`       | boolean  | Include AI analysis         | `false`                    |
| `--benchmark`       | boolean  | Performance benchmarking    | `false`                    |
| `--incremental`     | boolean  | Incremental analysis        | `false`                    |
| `--baseline`        | string   | Baseline file path          | -                          |
| `--max-files`       | number   | Maximum files to analyze    | `10000`                    |
| `--max-concurrency` | number   | Concurrent processing limit | `10`                       |
| `--timeout`         | number   | Analysis timeout (ms)       | `300000`                   |

#### Focus Areas

| Focus             | Description              |
| ----------------- | ------------------------ |
| `duplicates`      | Duplicate code detection |
| `complexity`      | Complexity metrics       |
| `dependencies`    | Dependency analysis      |
| `security`        | Security vulnerabilities |
| `performance`     | Performance issues       |
| `maintainability` | Code maintainability     |
| `all`             | All analysis types       |

#### Examples

```bash
# Basic analysis
wundr analyze

# Focus on duplicates and complexity
wundr analyze --focus duplicates,complexity

# AI-powered analysis with multiple outputs
wundr analyze --ai-review --format json,html,markdown

# Large codebase optimization
wundr analyze --max-files 20000 --max-concurrency 20
```

### Command: `wundr ai`

AI-powered development assistance.

```bash
wundr ai <subcommand> [options]
```

#### Subcommands

##### `wundr ai setup`

Configure AI integration.

```bash
wundr ai setup [options]
```

**Options:**

- `--provider` (string): AI provider (`claude`, `openai`)
- `--model` (string): AI model to use
- `--api-key` (string): API key
- `--interactive` (boolean): Interactive setup

##### `wundr ai chat`

Interactive AI chat session.

```bash
wundr ai chat [options]
```

**Options:**

- `--context` (string): Context directory
- `--model` (string): Override default model
- `--temperature` (number): Response creativity (0-1)

##### `wundr ai review`

AI code review.

```bash
wundr ai review [path] [options]
```

**Options:**

- `--focus` (string[]): Review focus areas
- `--suggestions` (boolean): Include improvement suggestions
- `--security` (boolean): Focus on security issues
- `--performance` (boolean): Focus on performance

##### `wundr ai generate`

AI code generation.

```bash
wundr ai generate <type> [options]
```

**Types:** `component`, `function`, `test`, `docs`

#### Examples

```bash
# Setup AI integration
wundr ai setup --provider claude --interactive

# Interactive chat
wundr ai chat --context ./src

# AI code review
wundr ai review --focus security,performance

# Natural language command
wundr ai "refactor this component to use hooks"
```

### Command: `wundr dashboard`

Start the web dashboard.

```bash
wundr dashboard [options]
```

#### Options

| Option                | Type    | Description               | Default     |
| --------------------- | ------- | ------------------------- | ----------- |
| `--port, -p`          | number  | Dashboard port            | `3000`      |
| `--host`              | string  | Host address              | `localhost` |
| `--theme`             | string  | Dashboard theme           | `system`    |
| `--open`              | boolean | Open in browser           | `false`     |
| `--dev`               | boolean | Development mode          | `false`     |
| `--build`             | boolean | Build for production      | `false`     |
| `--ws-port`           | number  | WebSocket port            | `8080`      |
| `--disable-websocket` | boolean | Disable real-time updates | `false`     |

#### Examples

```bash
# Start dashboard
wundr dashboard

# Development mode with auto-open
wundr dashboard --dev --open

# Custom port and theme
wundr dashboard --port 4000 --theme dark
```

### Command: `wundr refactor`

Automated refactoring assistance.

```bash
wundr refactor [options]
```

#### Options

| Option         | Type    | Description                              | Default |
| -------------- | ------- | ---------------------------------------- | ------- |
| `--guided`     | boolean | Interactive guided refactoring           | `false` |
| `--patterns`   | boolean | Standardize code patterns                | `false` |
| `--duplicates` | boolean | Consolidate duplicates                   | `false` |
| `--dry-run`    | boolean | Show changes without applying            | `false` |
| `--batch-size` | number  | Number of changes per batch              | `5`     |
| `--priority`   | string  | Priority level (`high`, `medium`, `low`) | `high`  |

## 💻 Programmatic API

### AnalysisEngine

Main class for code analysis.

```typescript
import { AnalysisEngine } from '@adapticai/wundr';

const engine = new AnalysisEngine(options);
```

#### Constructor Options

```typescript
interface AnalysisEngineOptions {
  targetDir: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  maxConcurrency?: number;
  enableCaching?: boolean;
  ai?: AIConfig;
  performance?: PerformanceConfig;
}
```

#### Methods

##### `analyze()`

Run comprehensive analysis.

```typescript
async analyze(): Promise<AnalysisReport>
```

**Returns:** Complete analysis report with all findings.

##### `setProgressCallback(callback)`

Set progress tracking callback.

```typescript
setProgressCallback(callback: ProgressCallback): void

interface ProgressCallback {
  (event: ProgressEvent): void;
}

type ProgressEvent =
  | { type: 'phase'; phase: string; message: string }
  | { type: 'progress'; progress: number; total: number }
  | { type: 'complete'; report: AnalysisReport };
```

#### Example Usage

```typescript
import { AnalysisEngine } from '@adapticai/wundr';

const engine = new AnalysisEngine({
  targetDir: './src',
  enableCaching: true,
  maxConcurrency: 10,
  ai: {
    enabled: true,
    provider: 'claude',
  },
});

// Set up progress tracking
engine.setProgressCallback(event => {
  if (event.type === 'progress') {
    console.log(`Progress: ${event.progress}/${event.total}`);
  }
});

// Run analysis
const report = await engine.analyze();
console.log(`Found ${report.summary.duplicateClusters} duplicate clusters`);
```

### AI Integration API

```typescript
import { AIService } from '@adapticai/wundr/ai';

const aiService = new AIService({
  provider: 'claude',
  apiKey: process.env.CLAUDE_API_KEY,
});
```

#### Methods

##### `review(code, options)`

AI-powered code review.

```typescript
async review(
  code: string | CodeContext,
  options?: ReviewOptions
): Promise<ReviewResult>

interface ReviewOptions {
  focus?: string[];
  suggestions?: boolean;
  context?: CodeContext;
}

interface ReviewResult {
  issues: Issue[];
  suggestions: Suggestion[];
  rating: QualityRating;
  confidence: number;
}
```

##### `generateCode(prompt, context)`

AI code generation.

```typescript
async generateCode(
  prompt: string,
  context?: CodeContext
): Promise<GeneratedCode>

interface GeneratedCode {
  code: string;
  language: string;
  explanation: string;
  confidence: number;
}
```

## ⚙️ Configuration API

### Configuration Schema

Complete configuration schema for `wundr.config.json`:

```typescript
interface WundrConfig {
  project: ProjectConfig;
  analysis: AnalysisConfig;
  ai: AIConfig;
  dashboard: DashboardConfig;
  integrations: IntegrationsConfig;
  performance: PerformanceConfig;
  security: SecurityConfig;
  hooks: HooksConfig;
}
```

#### ProjectConfig

```typescript
interface ProjectConfig {
  name: string;
  type: 'typescript' | 'javascript' | 'react' | 'vue' | 'angular' | 'node';
  framework?: string;
  version?: string;
  description?: string;
}
```

#### AnalysisConfig

```typescript
interface AnalysisConfig {
  targetPath: string;
  includePatterns: string[];
  excludePatterns: string[];
  complexity: ComplexityConfig;
  duplicates: DuplicatesConfig;
  dependencies: DependenciesConfig;
  security: SecurityAnalysisConfig;
  performance: AnalysisPerformanceConfig;
}

interface ComplexityConfig {
  maxCyclomatic: number;
  maxCognitive: number;
  maxFileLines: number;
  maxFunctionLines: number;
}

interface DuplicatesConfig {
  minSimilarity: number;
  enableSemanticAnalysis: boolean;
  excludeTypes: string[];
  minClusterSize: number;
}
```

#### AIConfig

```typescript
interface AIConfig {
  enabled: boolean;
  provider: 'claude' | 'openai';
  model: string;
  apiKey?: string;
  features: {
    codeReview: boolean;
    refactoringSuggestions: boolean;
    testGeneration: boolean;
    documentation: boolean;
  };
  rateLimits: {
    requestsPerMinute: number;
    tokensPerRequest: number;
  };
}
```

### Configuration Management

#### Programmatic Configuration

```typescript
import { ConfigManager } from '@adapticai/wundr/config';

const config = new ConfigManager();

// Load configuration
await config.load('./wundr.config.json');

// Get configuration values
const analysisPath = config.get('analysis.targetPath');

// Set configuration values
config.set('ai.enabled', true);

// Validate configuration
const isValid = config.validate();

// Save configuration
await config.save();
```

#### Environment Variable Overrides

Configuration values can be overridden with environment variables:

```bash
# Override analysis path
export WUNDR_ANALYSIS_TARGET_PATH="./app"

# Override AI configuration
export WUNDR_AI_ENABLED="true"
export WUNDR_AI_PROVIDER="claude"

# Override dashboard port
export WUNDR_DASHBOARD_PORT="4000"
```

## 🔌 Plugin Development API

### Plugin Interface

```typescript
interface Plugin {
  name: string;
  version: string;
  description: string;
  dependencies?: string[];

  initialize(context: PluginContext): Promise<void>;
  activate?(): Promise<void>;
  deactivate?(): Promise<void>;
}
```

### PluginContext

```typescript
interface PluginContext {
  config: ConfigManager;
  logger: Logger;
  events: EventEmitter;
  analysis: AnalysisAPI;
  dashboard: DashboardAPI;
  cli: CLIAPI;

  registerCommand(command: CommandDefinition): void;
  registerAnalyzer(analyzer: AnalyzerDefinition): void;
  registerVisualization(viz: VisualizationDefinition): void;
}
```

### Example Plugin

```typescript
import { Plugin, PluginContext } from '@adapticai/wundr';

export class SecurityPlugin implements Plugin {
  name = 'security-scanner';
  version = '1.0.0';
  description = 'Advanced security vulnerability scanner';

  async initialize(context: PluginContext) {
    // Register custom analyzer
    context.registerAnalyzer({
      name: 'security-vulnerabilities',
      analyze: this.analyzeSecurityIssues.bind(this),
      dependencies: ['ast-analysis'],
    });

    // Register CLI command
    context.registerCommand({
      name: 'security',
      description: 'Run security analysis',
      handler: this.handleSecurityCommand.bind(this),
    });

    // Register dashboard component
    context.dashboard.addComponent('SecurityDashboard', {
      path: '/security',
      component: SecurityDashboardComponent,
    });
  }

  private async analyzeSecurityIssues(files: FileInfo[]) {
    // Implementation
  }

  private async handleSecurityCommand(args: any[]) {
    // Implementation
  }
}
```

## 📊 Dashboard API

### Dashboard Components

#### Adding Custom Components

```typescript
interface DashboardComponent {
  name: string;
  path: string;
  component: React.ComponentType;
  icon?: string;
  title?: string;
  order?: number;
}

// Register component
context.dashboard.addComponent('MyComponent', {
  path: '/my-feature',
  component: MyFeatureComponent,
  icon: 'chart',
  title: 'My Feature',
});
```

#### Data API

```typescript
interface DashboardDataAPI {
  // Get analysis data
  getAnalysisData(): Promise<AnalysisReport>;

  // Subscribe to real-time updates
  subscribe(event: string, callback: Function): void;

  // Send custom data to dashboard
  emit(event: string, data: any): void;
}
```

### Custom Visualizations

```typescript
interface VisualizationDefinition {
  name: string;
  type: 'chart' | 'graph' | 'table' | 'custom';
  component: React.ComponentType<VisualizationProps>;
  dataTransform?: (data: any) => any;
}

interface VisualizationProps {
  data: any;
  config: VisualizationConfig;
  onUpdate: (data: any) => void;
}
```

## 🔄 WebSocket API

Real-time communication between CLI/analysis and dashboard.

### Client-side API

```typescript
import { WundrWebSocket } from '@adapticai/wundr/websocket';

const ws = new WundrWebSocket('ws://localhost:8080');

// Subscribe to events
ws.on('analysis-progress', data => {
  console.log(`Analysis progress: ${data.progress}%`);
});

ws.on('analysis-complete', report => {
  console.log('Analysis complete:', report);
});

// Send commands
ws.send('start-analysis', { path: './src' });
```

### Server-side Events

Events emitted by the WebSocket server:

| Event               | Data                                                 | Description           |
| ------------------- | ---------------------------------------------------- | --------------------- |
| `analysis-started`  | `{ path: string }`                                   | Analysis started      |
| `analysis-progress` | `{ progress: number, total: number, phase: string }` | Progress update       |
| `analysis-complete` | `AnalysisReport`                                     | Analysis finished     |
| `file-changed`      | `{ path: string, action: string }`                   | File system change    |
| `config-updated`    | `WundrConfig`                                        | Configuration changed |

## 🌐 REST API

Dashboard REST API endpoints.

### Base URL

`http://localhost:3000/api`

### Authentication

Currently no authentication required for local development. Enterprise versions support API keys.

### Endpoints

#### GET `/api/analysis`

Get latest analysis results.

**Response:**

```json
{
  "status": "success",
  "data": {
    "report": "AnalysisReport",
    "timestamp": "2023-12-01T10:00:00Z"
  }
}
```

#### POST `/api/analysis`

Start new analysis.

**Request:**

```json
{
  "path": "./src",
  "options": {
    "focus": ["duplicates", "complexity"],
    "aiReview": true
  }
}
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "analysisId": "uuid-string",
    "message": "Analysis started"
  }
}
```

#### GET `/api/analysis/:id`

Get analysis by ID.

#### GET `/api/config`

Get current configuration.

#### PUT `/api/config`

Update configuration.

#### GET `/api/files`

List project files.

#### POST `/api/ai/review`

Request AI code review.

**Request:**

```json
{
  "code": "function example() { ... }",
  "language": "typescript",
  "context": {
    "filePath": "./src/example.ts",
    "projectType": "react"
  }
}
```

### Error Handling

All endpoints use consistent error format:

```json
{
  "status": "error",
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": "Additional details if available"
  }
}
```

### Rate Limiting

- Analysis endpoints: 1 request per minute
- AI endpoints: Based on configured AI provider limits
- Other endpoints: 100 requests per minute

## 📚 Type Definitions

### Core Types

```typescript
// Analysis Report
interface AnalysisReport {
  summary: AnalysisSummary;
  entities: EntityInfo[];
  duplicates: DuplicateCluster[];
  dependencies: DependencyInfo[];
  complexity: ComplexityMetrics;
  issues: Issue[];
  recommendations: Recommendation[];
  metadata: AnalysisMetadata;
}

// Entity Information
interface EntityInfo {
  id: string;
  name: string;
  type: EntityType;
  filePath: string;
  startLine: number;
  endLine: number;
  complexity: ComplexityScores;
  dependencies: string[];
  hash: string;
  size: number;
}

// Duplicate Cluster
interface DuplicateCluster {
  id: string;
  entities: EntityInfo[];
  similarity: number;
  type: EntityType;
  consolidationSuggestion?: ConsolidationSuggestion;
}

// Quality Issue
interface Issue {
  id: string;
  type: IssueType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  filePath: string;
  startLine: number;
  endLine: number;
  rule?: string;
  fixSuggestion?: string;
}
```

## 🔍 Error Codes

### CLI Error Codes

| Code        | Description                  |
| ----------- | ---------------------------- |
| `WUNDR_001` | Configuration file not found |
| `WUNDR_002` | Invalid configuration format |
| `WUNDR_003` | Analysis failed              |
| `WUNDR_004` | AI service unavailable       |
| `WUNDR_005` | Permission denied            |
| `WUNDR_006` | Network connection failed    |
| `WUNDR_007` | Plugin loading failed        |
| `WUNDR_008` | Dashboard startup failed     |

### API Error Codes

| Code      | Description                 | HTTP Status |
| --------- | --------------------------- | ----------- |
| `API_001` | Invalid request format      | 400         |
| `API_002` | Missing required parameters | 400         |
| `API_003` | Resource not found          | 404         |
| `API_004` | Analysis in progress        | 409         |
| `API_005` | Rate limit exceeded         | 429         |
| `API_006` | Internal server error       | 500         |

---

For more detailed information and examples, visit our
[complete documentation](https://docs.wundr.io) or join our
[Discord community](https://discord.gg/wundr) for help and discussions.
