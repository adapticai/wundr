# @wundr.io/cli - Comprehensive Package Analysis

## Executive Summary

The `@wundr.io/cli` package is the **primary user-facing interface** for the Wundr platform - a
unified CLI framework that orchestrates code analysis, governance, AI-powered development, and
computer setup capabilities. Built on Commander.js with extensive interactive modes, NLP command
parsing, and a robust plugin system, it serves as the central control point for all Wundr
functionality.

**Package Location:** `/Users/granfar/wundr/packages/@wundr/cli` **Version:** 1.0.0 **Binary:**
`wundr` **Main Entry:** `dist/index.js`

---

## 1. Architecture Overview

### 1.1 Core Components

```
@wundr/cli/
├── bin/wundr.js                    # Cross-platform executable entry
├── src/
│   ├── index.ts                    # Main entry with ASCII banner
│   ├── cli.ts                      # CLI orchestrator (WundrCLI class)
│   ├── commands/                   # 20+ command implementations
│   ├── interactive/                # Wizard, TUI, Chat modes
│   ├── plugins/                    # Plugin management system
│   ├── nlp/                        # Natural language parsing
│   ├── ai/                         # AI service integration
│   ├── context/                    # Session & context management
│   └── utils/                      # Logger, config, error handling
├── templates/                      # Code generation templates
├── test-suites/                    # Test configurations
└── tests/                          # Test files
```

### 1.2 Technology Stack

- **CLI Framework:** Commander.js v11.1.0
- **UI Libraries:**
  - `blessed` + `blessed-contrib` (TUI)
  - `inquirer` v9.2.12 (Interactive prompts)
  - `terminal-kit` v3.0.1 (Advanced terminal features)
  - `figlet` v1.7.0 (ASCII art)
- **AI Integration:** Claude API (Anthropic)
- **Testing:** Playwright v1.48.0 + axe-core (accessibility)
- **Process Management:** `node-pty` v1.0.0, `execa` v8.0.1
- **Task UI:** `listr2` v8.0.0, `ora` v8.0.1
- **Utilities:** `fs-extra`, `glob`, `yaml`, `zod`

### 1.3 Integration Points

```typescript
// Dependencies on other Wundr packages
"@wundr.io/computer-setup": "workspace:*"  // Hardware-adaptive setup
"@wundr.io/config": "workspace:*"          // Shared configuration
"@wundr.io/core": "workspace:*"            // Core utilities
```

---

## 2. Command Structure

### 2.1 Command Hierarchy

The CLI implements 10 major command categories with 60+ total commands:

#### **`wundr init`** - Project Initialization

```bash
wundr init project [name]          # Initialize new project
wundr init config                  # Setup configuration
wundr init workspace               # Create multi-project workspace
wundr init plugins                 # Initialize plugin system
```

**Options:**

- `--template <template>` - Project template (default, monorepo)
- `--skip-git` - Skip git initialization
- `--skip-install` - Skip dependency installation
- `--interactive` - Interactive configuration setup
- `--global` - Create global configuration

**Implementation:** `src/commands/init.ts` (678 lines)

#### **`wundr create`** - Code Generation

```bash
wundr create project <type> [name]    # Full wundr-compliant project
wundr create frontend <name>          # Frontend app (Next/React/Vue)
wundr create backend <name>           # Backend API (Fastify/Express/NestJS)
wundr create monorepo <name>          # Turborepo monorepo
wundr create fullstack <name>         # Full-stack application
wundr create component <name>         # React/Vue/Angular component
wundr create service <name>           # API service
wundr create package <name>           # Monorepo package
wundr create template <name>          # Code template
wundr create workflow <name>          # CI/CD workflow
wundr create config <name>            # Configuration files
```

**Template System:**

- Component templates: React, Vue, Angular
- Service templates: Express, Fastify, Nest.js
- Workflow templates: GitHub Actions, GitLab CI
- Configuration presets: ESLint, Prettier, Jest, TypeScript

**Implementation:** `src/commands/create.ts` (728 lines)

#### **`wundr analyze`** - Code Analysis

```bash
wundr analyze deps                 # Dependency analysis
wundr analyze quality              # Code quality metrics
wundr analyze perf                 # Performance analysis
wundr analyze arch                 # Architecture review
wundr analyze all                  # Comprehensive analysis
wundr analyze scan [path]          # Scan directory for issues
```

**Analysis Types:**

- **Dependencies:** Circular, unused, outdated, security audit
- **Quality:** Complexity, duplication, test coverage, metrics
- **Performance:** Bundle size, runtime performance, memory usage
- **Architecture:** Structure, patterns, violations

**Output Formats:** `table`, `json`, `graph`

**Implementation:** `src/commands/analyze.ts` (577 lines)

#### **`wundr govern`** - Governance & Compliance

```bash
wundr govern check                 # Run compliance checks
wundr govern rules list            # List available rules
wundr govern rules add <rule>      # Add governance rule
wundr govern rules remove <rule>   # Remove rule
wundr govern policy create <name>  # Create policy
wundr govern policy apply <policy> # Apply policy to project
wundr govern gate check            # Run quality gate checks
wundr govern gate create <name>    # Create quality gate
wundr govern audit                 # Run governance audit
wundr govern report                # Generate governance reports
```

**Rule Categories:**

- Quality: `no-console`, `no-debugger`, `require-tests`
- Security: `no-eval`, `no-unsafe-inline`
- Performance: `no-inefficient-loops`
- Testing: `require-tests`, `no-skip-tests`
- Documentation: `require-jsdoc`, `require-readme`

**Implementation:** `src/commands/govern.ts` (636 lines)

#### **`wundr ai`** - AI-Powered Development

```bash
wundr ai setup                     # Setup AI configuration
wundr ai status                    # Check AI status
wundr ai validate                  # Validate API connection
wundr ai generate <type>           # AI code generation
wundr ai review [files...]         # AI code review
wundr ai refactor <target>         # AI-assisted refactoring
wundr ai docs <target>             # Generate documentation
wundr ai test <target>             # Generate tests
wundr ai chat                      # Start AI chat session
wundr ai analyze <target>          # AI-powered analysis
wundr ai optimize <target>         # Performance optimization
wundr ai config set <key> <value>  # Set AI configuration
```

**AI Providers:**

- Claude (Anthropic) - Primary integration
- OpenAI - Coming soon
- Local models - Planned

**Configuration:**

```bash
# Environment variables
export CLAUDE_API_KEY=your_key_here
export WUNDR_AI_PROVIDER=claude
export WUNDR_AI_MODEL=claude-3-opus-20240229
```

**Implementation:** `src/commands/ai.ts` (785 lines)

#### **`wundr dashboard`** - Web Dashboard

```bash
wundr dashboard start              # Launch web dashboard
wundr dashboard stop               # Stop dashboard
wundr dashboard config             # Configure dashboard
wundr dashboard report <type>      # Generate reports
wundr dashboard widget add         # Add widget
```

**Features:**

- Real-time metrics visualization
- Interactive charts and graphs
- Customizable widgets
- Report generation (PDF, HTML)

**Implementation:** `src/commands/dashboard.ts` (537 lines)

#### **`wundr watch`** - File Monitoring

```bash
wundr watch start [patterns...]    # Start file watching
wundr watch test                   # Watch and run tests
wundr watch build                  # Watch and build
wundr watch lint                   # Watch and lint
```

**Configuration:** YAML-based watch rules with debouncing

**Implementation:** `src/commands/watch.ts` (580 lines)

#### **`wundr batch`** - Batch Processing

```bash
wundr batch run <file>             # Execute batch job
wundr batch create <name>          # Create batch job
wundr batch validate <file>        # Validate batch YAML
wundr batch schedule <file>        # Schedule execution
```

**Batch Job Structure:**

```yaml
name: build-and-test
description: Complete build and test pipeline
parallel: false
continueOnError: false

commands:
  - command: 'npm install'
    retry: 2

  - command: 'npm run lint'
    condition: 'typescript-files'

  - command: 'npm run test'
    timeout: 300000

  - command: 'npm run build'

  - command: 'npm run deploy'
    condition: 'production'
```

**Implementation:** `src/commands/batch.ts` (722 lines)

#### **`wundr chat`** - Natural Language Interface

```bash
wundr chat start                   # Start new chat session
wundr chat resume <sessionId>      # Resume existing session
wundr chat ask <message>           # Single question
wundr chat file <file>             # Chat about file
wundr chat list                    # List chat sessions
wundr chat export <sessionId>      # Export chat session
wundr chat template use <name>     # Use chat template
```

**Implementation:** `src/commands/chat.ts` (701 lines)

#### **`wundr plugin`** - Plugin Management

```bash
wundr plugin list                  # List plugins
wundr plugin install <plugin>      # Install plugin
wundr plugin uninstall <plugin>    # Uninstall plugin
wundr plugin enable <plugin>       # Enable plugin
wundr plugin disable <plugin>      # Disable plugin
wundr plugin create <name>         # Create plugin
wundr plugin dev link <path>       # Link for development
wundr plugin search <query>        # Search plugins
wundr plugin update [plugin]       # Update plugin(s)
wundr plugin test <plugin>         # Test plugin
```

**Implementation:** `src/commands/plugins.ts` (622 lines)

#### **`wundr setup`** - Computer Setup

```bash
wundr setup                        # Interactive setup wizard
wundr computer-setup               # Hardware-adaptive setup
wundr claude-setup                 # Claude Code optimization
```

**Integration:** Uses `@wundr.io/computer-setup` package

**Implementation:** Multiple files including hardware detection and optimization

---

## 3. Interactive Modes

### 3.1 Wizard Mode (`wundr wizard`)

**Purpose:** Step-by-step guided setup and operations

**Modes:**

1. **Setup Wizard** - Project initialization
2. **Analysis Wizard** - Configure analysis options
3. **Creation Wizard** - Code generation workflow
4. **Governance Wizard** - Compliance setup
5. **AI Configuration Wizard** - AI provider setup

**Implementation:** `src/interactive/interactive-mode.ts` (831 lines)

**Example Flow:**

```bash
$ wundr wizard setup

🚀 Welcome to Wundr CLI Setup Wizard

? Initialize Wundr in this directory? Yes
? What type of project is this? Monorepo
? Select features to enable:
  ✓ Code Analysis
  ✓ Governance Rules
  ✓ Dashboard
? AI Provider: claude
? AI API Key: ********

✨ Setting up your project...

Running: wundr init monorepo ✓
Running: wundr init config ✓
Running: wundr govern rules add no-console ✓

🎉 Setup complete! Your Wundr project is ready.
```

### 3.2 Chat Mode (`wundr chat`)

**Purpose:** Natural language interface for development

**Features:**

- Session management with persistence
- Conversation history and context
- File-specific analysis
- Template-based queries
- Export/import functionality

**AI Integration:**

- Claude API for NLP parsing
- Context-aware responses
- Command suggestions
- Code explanation and review

**Session Structure:**

```typescript
interface ChatSession {
  id: string;
  model: string;
  context?: string;
  history: ChatMessage[];
  created: Date;
  updated: Date;
  metadata: Record<string, any>;
}
```

### 3.3 TUI Mode (`wundr tui`)

**Purpose:** Terminal-based dashboard interface

**Layouts:**

1. **Dashboard** - Project overview with metrics
2. **Monitor** - Real-time log streaming
3. **Debug** - System diagnostic information

**Technology:** blessed.js for terminal UI components

**Controls:**

- `q` or `Esc` - Exit
- Arrow keys - Navigate
- Tab - Switch panels

**Implementation:** Terminal widgets with real-time updates

### 3.4 Watch Mode (`wundr watch`)

**Purpose:** Automated file system monitoring and command execution

**Features:**

- Pattern-based file watching
- Debouncing and throttling
- Conditional execution
- YAML configuration support
- Multiple command triggers

**Use Cases:**

- Auto-run tests on file changes
- Continuous build on source updates
- Automatic linting
- Live reloading

---

## 4. Natural Language Processing (NLP)

### 4.1 Command Parser

**Location:** `src/nlp/command-parser.ts` (565 lines)

**Architecture:**

```typescript
interface ParsedCommand {
  originalInput: string;
  intent: string;
  command: string;
  args: string[];
  options: Record<string, any>;
  confidence: number;
  needsConfirmation: boolean;
  suggestions?: string[];
  clarificationQuestion?: string;
  executionPlan?: ExecutionStep[];
}
```

**Parsing Strategy:**

1. **Template Matching** - Fast pattern-based matching (confidence > 0.8)
2. **AI-Powered Parsing** - Claude API for complex queries
3. **Validation** - Command existence and parameter validation
4. **Suggestion Generation** - Alternative commands on failure

**Command Templates:**

```typescript
const templates = [
  {
    pattern: /analyze.*dependencies|dependency analysis|check deps/i,
    command: 'wundr analyze --focus dependencies',
    confidence: 0.95,
  },
  {
    pattern: /create.*service|new service|generate service/i,
    command: 'wundr create service',
    confidence: 0.9,
  },
];
```

### 4.2 Intent Classification

**Location:** `src/nlp/intent-classifier.ts`

**Intents:**

- `init` - Project initialization
- `create` - Code generation
- `analyze` - Code analysis
- `govern` - Governance operations
- `complex_workflow` - Multi-step operations

### 4.3 Command Mapper

**Location:** `src/nlp/command-mapper.ts`

**Function:** Maps natural language to CLI commands

**Examples:**

```
"check for circular dependencies"
→ wundr analyze deps --circular

"create a new React component called UserCard"
→ wundr create component UserCard --type react

"show me the dashboard"
→ wundr dashboard start --open
```

---

## 5. AI Integration

### 5.1 AI Service

**Location:** `src/ai/ai-service.ts` (596 lines)

**Architecture:**

```typescript
class AIService {
  private claudeClient: ClaudeClient;
  private config: AIServiceConfig;
  private conversationHistory: Map<string, ClaudeMessage[]>;

  // Core methods
  async sendMessage(sessionId, message, context): Promise<string>;
  async *streamMessage(sessionId, message, context): AsyncGenerator<string>;
  async parseNaturalLanguageCommand(input): Promise<ParsedCommand>;
  async suggestCommands(goal, context): Promise<Suggestion[]>;
  async explainCommandResults(command, output): Promise<string>;
  async validateConnection(): Promise<ValidationResult>;
}
```

### 5.2 Claude Client

**Location:** `src/ai/claude-client.ts`

**Configuration:**

```typescript
interface ClaudeClientConfig {
  apiKey: string;
  model: string; // claude-3-opus-20240229
  maxTokens?: number; // Default: 4096
  temperature?: number; // Default: 0.7
  baseUrl?: string;
}
```

**Capabilities:**

- Natural language command parsing
- Context-aware command suggestions
- Result explanation in plain English
- Contextual help generation
- Conversation memory

### 5.3 Conversation Manager

**Location:** `src/ai/conversation-manager.ts`

**Features:**

- Session persistence
- Context tracking
- History management
- Export/import
- Multi-turn conversations

---

## 6. Plugin System

### 6.1 Plugin Manager

**Location:** `src/plugins/plugin-manager.ts` (745 lines)

**Architecture:**

```typescript
class PluginManager {
  private loadedPlugins: Map<string, Plugin>;
  private pluginCommands: Map<string, PluginCommand>;
  private pluginHooks: Map<string, PluginHook[]>;

  // Lifecycle methods
  async initialize();
  async loadPlugins();
  async loadPlugin(pluginName);
  async unloadPlugin(pluginName);

  // Installation methods
  async installPlugin(pluginName, options);
  async uninstallPlugin(pluginName);
  async enablePlugin(pluginName);
  async disablePlugin(pluginName);

  // Development methods
  async linkPlugin(pluginPath);
  async unlinkPlugin(pluginName);
  async testPlugin(pluginName);
  async publishPlugin(options);
}
```

### 6.2 Plugin Interface

**Definition:**

```typescript
interface Plugin {
  name: string;
  version: string;
  description: string;
  commands?: string[];
  hooks?: string[];

  activate(context: PluginContext): Promise<void>;
  deactivate(): Promise<void>;
}

interface PluginContext {
  config: any;
  logger: Logger;
  registerCommand(command: PluginCommand): void;
  registerHook(hook: PluginHook): void;
}
```

### 6.3 Plugin Development

**Creating a Plugin:**

```bash
wundr plugin create my-awesome-plugin --interactive
cd my-awesome-plugin
npm install
wundr plugin dev link .
```

**Plugin Structure:**

```typescript
export default class MyPlugin implements Plugin {
  name = 'my-plugin';
  version = '1.0.0';
  description = 'My awesome plugin';

  async activate(context: PluginContext): Promise<void> {
    context.registerCommand({
      name: 'my-command',
      description: 'My custom command',
      action: async (args, options, ctx) => {
        ctx.logger.info('Plugin command executed!');
      },
    });
  }

  async deactivate(): Promise<void> {
    // Cleanup
  }
}
```

### 6.4 Plugin Installation Sources

- **NPM packages:** `wundr plugin install @wundr/plugin-docker`
- **Git repositories:** `wundr plugin install git+https://github.com/user/plugin.git`
- **Local paths:** `wundr plugin install ./my-plugin`
- **Development linking:** `wundr plugin dev link ./plugin-dev`

---

## 7. Configuration Management

### 7.1 Config Manager

**Location:** `src/utils/config-manager.ts`

**Configuration Hierarchy:**

1. **Global:** `~/.wundr/config.json`
2. **Project:** `./wundr.config.json`
3. **Environment:** Environment variables
4. **Command-line:** Runtime options

**Configuration Schema:**

```typescript
interface WundrConfig {
  defaultMode: 'cli' | 'interactive' | 'chat' | 'tui';
  ai: {
    provider: 'claude' | 'openai' | 'local';
    model: string;
    apiKey?: string;
  };
  plugins: string[];
  analysis: {
    patterns: string[];
    excludes: string[];
    maxDepth: number;
  };
  governance: {
    rules: string[];
    severity: 'error' | 'warning' | 'info';
  };
  integrations: {
    github?: {
      token: string;
      owner: string;
      repo: string;
    };
  };
}
```

### 7.2 Configuration Commands

```bash
# Initialize configuration
wundr init config --interactive

# Set values
wundr ai config set provider claude
wundr ai config set model claude-3-opus-20240229

# Get values
wundr ai config get provider
wundr ai config get
```

---

## 8. Templates System

### 8.1 Template Structure

**Location:** `/templates/`

**Available Templates:**

```
templates/
├── component/
│   ├── {{fileName}}.tsx          # React component
│   └── {{fileName}}.test.tsx     # Component tests
├── service/
│   └── {{fileName}}.ts           # Service implementation
├── batch/
│   └── ci-cd.yaml                # CI/CD workflow
└── wundr-test.config.js          # Test configuration
```

### 8.2 Template Variables

**Placeholder Syntax:** `{{variableName}}`

**Available Variables:**

- `{{name}}` - Component/service name
- `{{fileName}}` - Kebab-case filename
- `{{className}}` - PascalCase class name
- `{{type}}` - Component/service type
- `{{framework}}` - Framework choice
- `{{timestamp}}` - Creation timestamp

### 8.3 Template Creation

```bash
wundr create template my-template --interactive
```

**Custom Template:**

```typescript
// templates/my-template/{{fileName}}.ts
export class {{className}} {
  constructor(private name: string = '{{name}}') {}

  // Generated on: {{timestamp}}
}
```

---

## 9. Utility Systems

### 9.1 Logger

**Location:** `src/utils/logger.ts`

**Features:**

- Multiple log levels (debug, info, warn, error)
- Colored output with `chalk`
- Progress indicators with `ora`
- Structured logging
- Silent mode support

**Usage:**

```typescript
import { logger } from './utils/logger';

logger.info('Starting analysis...');
logger.success('Analysis complete!');
logger.warn('Missing configuration');
logger.error('Failed to load plugin:', error);
logger.debug('Detailed information');
```

### 9.2 Error Handler

**Location:** `src/utils/error-handler.ts`

**Features:**

- Centralized error handling
- Error categorization with codes
- Recovery suggestions
- Context preservation
- Graceful degradation

**Error Codes:**

- `WUNDR_INIT_PROJECT_FAILED`
- `WUNDR_CREATE_COMPONENT_FAILED`
- `WUNDR_ANALYZE_DEPS_FAILED`
- `WUNDR_PLUGIN_LOAD_FAILED`

### 9.3 Context Manager

**Location:** `src/context/context-manager.ts`

**Features:**

- Session state management
- Project context tracking
- User preference storage
- Recent command history

---

## 10. Common Workflows

### 10.1 Project Initialization

```bash
# Interactive wizard
wundr wizard setup

# Manual initialization
wundr init project my-app --template monorepo
cd my-app
wundr init config --interactive
wundr plugin install @wundr/plugin-git

# Start development
wundr dashboard start --open
wundr watch test
```

### 10.2 Code Analysis

```bash
# Comprehensive analysis
wundr analyze all --report

# Specific analysis types
wundr analyze deps --circular --unused --security
wundr analyze quality --complexity --duplication
wundr analyze perf --bundle --runtime

# With governance
wundr govern check --fix --report
wundr govern gate check --fail-on-error
```

### 10.3 AI-Powered Development

```bash
# Setup AI
wundr ai setup --provider claude --validate

# Interactive chat
wundr ai chat

# Generate code
wundr ai generate component --prompt "Create a user profile card"

# Review and optimize
wundr ai review src/ --focus security
wundr ai optimize src/component.tsx --focus performance
```

### 10.4 Code Generation

```bash
# Interactive creation
wundr wizard create

# Direct generation
wundr create component UserCard --type react --with-tests
wundr create service UserService --framework express --with-docs
wundr create package @myapp/utils --type library
```

### 10.5 Batch Processing

```bash
# Create batch job
wundr batch create ci-pipeline --interactive

# Execute batch job
wundr batch run ci-pipeline.yaml

# Dry run
wundr batch run ci-pipeline.yaml --dry-run

# With variables
wundr batch run deploy.yaml --vars '{"NODE_ENV": "production"}'
```

---

## 11. Integration Guide

### 11.1 With Other Wundr Packages

**Computer Setup Integration:**

```typescript
import { createComputerSetupCommand } from './commands/computer-setup';

// Available in CLI
this.program.addCommand(createComputerSetupCommand());
```

**Config Package Integration:**

```typescript
import { ConfigManager } from './utils/config-manager';

// Shared configuration across packages
const config = new ConfigManager();
```

### 11.2 With External Tools

**GitHub Integration:**

```bash
wundr init config --interactive
# Enable GitHub integration
# Provide GitHub token

# Use in commands
wundr analyze all --export --github-issue
```

**Docker Integration:**

```bash
wundr plugin install @wundr/plugin-docker
wundr docker build
wundr docker deploy
```

### 11.3 CI/CD Integration

**GitHub Actions:**

```yaml
name: Wundr Quality Checks
on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
      - name: Install Wundr CLI
        run: npm install -g @wundr.io/cli
      - name: Run Analysis
        run: wundr analyze all --fail-on-error
      - name: Check Governance
        run: wundr govern check --fail-on-error
```

---

## 12. Developer Guide

### 12.1 Local Development

```bash
# Clone repository
git clone https://github.com/adapticai/wundr.git
cd wundr/packages/@wundr/cli

# Install dependencies
npm install

# Build
npm run build

# Link for local testing
npm link

# Test
npm test

# Watch mode
npm run dev
```

### 12.2 Adding a New Command

**1. Create command file:**

```typescript
// src/commands/mycommand.ts
import { Command } from 'commander';
import { ConfigManager } from '../utils/config-manager';
import { PluginManager } from '../plugins/plugin-manager';

export class MyCommands {
  constructor(
    private program: Command,
    private configManager: ConfigManager,
    private pluginManager: PluginManager
  ) {
    this.registerCommands();
  }

  private registerCommands(): void {
    const myCmd = this.program.command('mycmd').description('My custom command');

    myCmd
      .command('action')
      .description('Perform action')
      .option('--flag', 'Custom flag')
      .action(async options => {
        await this.performAction(options);
      });
  }

  private async performAction(options: any): Promise<void> {
    // Implementation
  }
}
```

**2. Register in CLI:**

```typescript
// src/cli.ts
import { MyCommands } from './commands/mycommand';

private registerCommands(): void {
  // ... existing commands
  new MyCommands(this.program, this.configManager, this.pluginManager);
}
```

### 12.3 Testing Strategy

**Unit Tests:**

```typescript
// tests/commands/mycommand.test.ts
import { MyCommands } from '../../src/commands/mycommand';

describe('MyCommands', () => {
  it('should perform action', async () => {
    const result = await myCommand.performAction({});
    expect(result).toBeDefined();
  });
});
```

**Integration Tests:**

```typescript
// tests/integration/workflow.test.ts
import { execSync } from 'child_process';

describe('Complete Workflow', () => {
  it('should initialize and analyze project', () => {
    execSync('wundr init project test-app');
    const output = execSync('wundr analyze all');
    expect(output.toString()).toContain('Analysis complete');
  });
});
```

---

## 13. Troubleshooting

### 13.1 Common Issues

**Command not found:**

```bash
# Reinstall CLI
npm install -g @wundr.io/cli

# Or use npx
npx @wundr.io/cli --version
```

**AI features not working:**

```bash
# Check status
wundr ai status

# Validate connection
wundr ai validate

# Re-run setup
wundr ai setup --validate
```

**Plugin installation fails:**

```bash
# List plugins
wundr plugin list

# Force install
wundr plugin install <plugin> --force

# Check logs
wundr --verbose plugin install <plugin>
```

### 13.2 Debug Mode

```bash
# Enable verbose logging
wundr --verbose <command>

# View debug information
wundr tui --layout debug

# Set debug environment
DEBUG=wundr:* wundr <command>
```

### 13.3 Configuration Issues

```bash
# Reset configuration
rm ~/.wundr/config.json
wundr init config --interactive

# View current configuration
wundr ai config get

# Validate configuration
wundr ai validate
```

---

## 14. Performance Considerations

### 14.1 Optimization Techniques

- **Lazy Loading:** Commands loaded on-demand
- **Caching:** Configuration and analysis results cached
- **Parallel Execution:** Batch commands can run in parallel
- **Debouncing:** Watch mode uses intelligent debouncing

### 14.2 Resource Usage

- **Memory:** ~50-100MB base, up to 500MB during analysis
- **CPU:** Minimal idle, spike during analysis/AI operations
- **Disk:** Configuration files < 1MB, plugins vary

### 14.3 Scalability

- Plugin system allows unlimited extensibility
- Batch processing handles large-scale operations
- Distributed execution support (planned)

---

## 15. Security Considerations

### 15.1 API Key Management

- **Environment Variables:** Preferred method
- **Encrypted Storage:** Configuration files with encryption (planned)
- **Never Commit:** `.gitignore` includes config files

### 15.2 Plugin Security

- **Sandboxing:** Plugins run in isolated contexts
- **Permission System:** Granular permissions (planned)
- **Code Signing:** Verified plugin sources (planned)

### 15.3 Data Privacy

- **Local Processing:** All analysis done locally
- **AI Opt-in:** AI features require explicit setup
- **No Telemetry:** No usage tracking by default

---

## 16. Roadmap & Future Enhancements

### 16.1 Planned Features

- **Enhanced AI Models:** OpenAI, local model support
- **Visual Studio Code Extension:** IDE integration
- **GitHub Actions Integration:** Native workflow support
- **Team Collaboration:** Shared configurations and sessions
- **Performance Analytics:** Advanced metrics and reporting
- **Custom Rule Engine:** User-defined governance rules

### 16.2 Plugin Ecosystem

- `@wundr/plugin-docker` - Docker integration
- `@wundr/plugin-kubernetes` - K8s deployment
- `@wundr/plugin-aws` - AWS services integration
- `@wundr/plugin-testing` - Advanced testing tools

---

## 17. API Reference

### 17.1 Programmatic Usage

```typescript
import { WundrCLI } from '@wundr.io/cli';

const cli = new WundrCLI();
const program = cli.createProgram();

// Execute command programmatically
await program.parseAsync(['node', 'wundr', 'analyze', 'deps']);

// Load plugins
await cli.loadPlugins();
```

### 17.2 Plugin API

```typescript
import { Plugin, PluginContext } from '@wundr.io/cli';

export class MyPlugin implements Plugin {
  async activate(context: PluginContext) {
    // Register commands
    context.registerCommand({
      name: 'my-command',
      action: async (args, opts) => {
        // Command logic
      },
    });

    // Register hooks
    context.registerHook({
      event: 'pre-analyze',
      handler: async data => {
        // Hook logic
      },
    });
  }
}
```

---

## 18. Support & Resources

### 18.1 Documentation

- **Main README:** `/packages/@wundr/cli/README.md`
- **Implementation Summary:** `/packages/@wundr/cli/IMPLEMENTATION_SUMMARY.md`
- **AI Integration Demo:** `/packages/@wundr/cli/AI_INTEGRATION_DEMO.md`

### 18.2 Community

- **Documentation:** https://wundr.io/docs
- **Discord:** https://discord.gg/wundr
- **Issue Tracker:** https://github.com/adapticai/wundr/issues
- **Email Support:** support@wundr.io

### 18.3 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

---

## 19. Conclusion

The `@wundr.io/cli` package represents a comprehensive, production-ready CLI framework that serves
as the unified interface for the entire Wundr platform. With its extensive command structure,
interactive modes, AI integration, and extensible plugin system, it provides developers with a
powerful toolkit for code analysis, governance, and AI-powered development.

**Key Strengths:**

- **Comprehensive:** 60+ commands across 10 categories
- **Interactive:** 4 distinct interaction modes (Wizard, Chat, TUI, Watch)
- **Intelligent:** NLP parsing and AI-powered assistance
- **Extensible:** Robust plugin system with hot-loading
- **Production-Ready:** Cross-platform, well-documented, tested

**Best Use Cases:**

- Project initialization and setup
- Continuous code quality monitoring
- AI-assisted development workflows
- Governance and compliance automation
- Developer machine provisioning

The CLI successfully achieves its objective as the primary user-facing interface for Wundr,
providing a seamless and intuitive experience for developers at all levels.
