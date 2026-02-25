# Wave 2 Analysis: CLI Command Framework Design

**Document**: 19-cli-framework.md **Status**: Design Complete **Priority**: High - Replaces 70%+
stub implementations

---

## 1. Current State Assessment

### 1.1 Command Inventory (28 command files)

| Command File                 | Lines | Classification | Notes                                                                                                |
| ---------------------------- | ----- | -------------- | ---------------------------------------------------------------------------------------------------- |
| `orchestrator.ts`            | 790   | **Real**       | Full start/stop/status/config/logs with daemon PID mgmt                                              |
| `batch.ts`                   | 938   | **Real**       | Full YAML job runner with Listr2, variable substitution, import/export                               |
| `setup.ts`                   | 509   | **Real**       | Integrates with `@wundr.io/computer-setup`, progress tracking, profiles                              |
| `computer-setup.ts`          | ~900  | **Real**       | Full provisioning with ComputerSetupManager, validation, profiles                                    |
| `claude-setup.ts`            | ~1300 | **Real**       | Full Claude integration, extensive config generation                                                 |
| `claude-init.ts`             | ~700  | **Real**       | Claude project initialization with CLAUDE.md, permission patterns                                    |
| `session.ts`                 | 632   | **Real**       | Session list/info/pause/resume/kill with JSON state persistence                                      |
| `worktree.ts`                | ~900  | **Real**       | Git worktree management with state tracking                                                          |
| `guardian.ts`                | ~800  | **Real**       | Imports from `@wundr.io/guardian-dashboard`, drift reporting                                         |
| `rag.ts`                     | ~800  | **Real**       | RAG store management with sync, prune, query                                                         |
| `governance.ts`              | ~900  | **Real**       | IPRE governance with alignment verification                                                          |
| `plugins.ts`                 | 851   | **Partial**    | Commands defined, delegates to PluginManager (partially implemented)                                 |
| `ai.ts`                      | ~900  | **Partial**    | Delegates to AIService; generate/review/refactor commands defined but AI calls may fail without keys |
| `analyze.ts`                 | ~500  | **Stub**       | Commands registered, action methods do basic logging but no real analysis engine                     |
| `analyze-optimized.ts`       | ~800  | **Stub**       | Optimized analyzer skeleton, no real engine behind it                                                |
| `govern.ts`                  | ~500  | **Stub**       | Compliance check/rules/policy commands defined, actions are placeholder-heavy                        |
| `dashboard.ts`               | 697   | **Stub**       | Dashboard start/stop shell, helper methods return empty `{ data: [] }`                               |
| `watch.ts`                   | ~600  | **Stub**       | Uses chokidar setup but executeWatchCommand and scheduling are skeletons                             |
| `chat.ts`                    | ~700  | **Stub**       | Chat interface defined, relies on AIService which may not be functional                              |
| `init.ts`                    | ~600  | **Partial**    | RAG init works (uses `@wundr.io/core`), project/workspace init are templates                         |
| `create.ts`                  | ~600  | **Stub**       | Component/service/template generation with static templates only                                     |
| `create-command.ts`          | ~150  | **Stub**       | Thin wrapper                                                                                         |
| `test.ts`                    | ~250  | **Stub**       | Test runner scaffolding, no real runner                                                              |
| `test-init.ts`               | ~200  | **Stub**       | Test initialization skeleton                                                                         |
| `alignment.ts`               | ~1100 | **Partial**    | Alignment scoring logic exists but many methods are TODO                                             |
| `computer-setup-commands.ts` | ~800  | **Partial**    | Additional setup commands, some duplicated                                                           |
| `performance-optimizer.ts`   | ~800  | **Stub**       | Optimization analysis skeleton                                                                       |
| `project-update.ts`          | ~900  | **Stub**       | Project update commands with no backend                                                              |

### 1.2 Summary

- **Real implementations** (10): orchestrator, batch, setup, computer-setup, claude-setup,
  claude-init, session, worktree, guardian, rag
- **Partial implementations** (5): plugins, ai, init, alignment, computer-setup-commands
- **Stub implementations** (13): analyze, analyze-optimized, govern, dashboard, watch, chat, create,
  create-command, test, test-init, performance-optimizer, project-update

**Conclusion**: ~46% stubs, ~18% partial, ~36% real. The stubs share a common pattern: Commander
subcommands are registered with correct options, but action handlers either log and return, call
helper methods that return empty data, or throw "not yet implemented" errors.

### 1.3 Architectural Problems

1. **No command interface**: Each file uses ad-hoc patterns (class with `registerCommands()`,
   factory function, or default export)
2. **No auto-discovery**: All 28+ imports are manually wired in `cli.ts` line 6-29
3. **Inconsistent error handling**: Some use `errorHandler.createError()`, others use `try/catch`
   with `chalk.red()`, others use `spinner.fail()`
4. **No output format consistency**: Some use `console.table()`, some manual padding, some JSON,
   some YAML
5. **Duplicated utilities**: `formatUptime()`, `getTimestamp()`, `padRight()`, `truncate()` appear
   in multiple files
6. **No validation layer**: Arguments are parsed by Commander but not validated beyond Commander's
   built-in type coercion
7. **No lifecycle hooks**: No pre/post command hooks, no middleware pipeline
8. **Mixed dependency injection**: Some commands get `ConfigManager`/`PluginManager` via
   constructor, others use closures, others import directly

---

## 2. Framework Design

### 2.1 Design Principles

1. **Convention over configuration**: Commands follow a standard interface; the registry finds them
   automatically
2. **Composition over inheritance**: Use interfaces and mixins, not deep class hierarchies
3. **Progressive disclosure**: Simple commands need minimal boilerplate; complex commands can opt
   into advanced features
4. **Type safety**: Full TypeScript generics for argument/option parsing
5. **Testability**: Commands are pure functions of (args, options, context) -> result
6. **Backward compatibility**: Existing working commands can be wrapped incrementally

### 2.2 Command Interface

```typescript
// framework/command-interface.ts

interface CommandDefinition<TArgs = Record<string, unknown>, TOpts = Record<string, unknown>> {
  /** Unique command name (e.g., 'start', 'agent:list') */
  name: string;

  /** Human-readable description */
  description: string;

  /** Optional category for grouping in help text */
  category?: CommandCategory;

  /** Command aliases (e.g., ['s'] for 'start') */
  aliases?: string[];

  /** Argument definitions */
  arguments?: ArgumentDefinition[];

  /** Option definitions */
  options?: OptionDefinition[];

  /** Examples shown in help text */
  examples?: CommandExample[];

  /** Validate parsed args/options before execution */
  validate?(args: TArgs, options: TOpts, context: CommandContext): ValidationResult;

  /** Execute the command */
  execute(args: TArgs, options: TOpts, context: CommandContext): Promise<CommandResult>;

  /** Optional cleanup on failure */
  rollback?(error: Error, context: CommandContext): Promise<void>;
}
```

### 2.3 Command Registry

```typescript
// framework/command-registry.ts

class CommandRegistry {
  /** Register a command definition */
  register(command: CommandDefinition): void;

  /** Auto-discover commands from a directory */
  discoverCommands(directory: string): Promise<void>;

  /** Get a registered command */
  get(name: string): CommandDefinition | undefined;

  /** List all registered commands */
  list(category?: CommandCategory): CommandDefinition[];

  /** Build a Commander.js program from registered commands */
  buildProgram(program: Command): void;
}
```

### 2.4 Output Formatter

```typescript
// framework/output-formatter.ts

class OutputFormatter {
  /** Format as table with column alignment */
  table(data: Record<string, unknown>[], options?: TableOptions): string;

  /** Format as JSON (pretty or compact) */
  json(data: unknown, options?: JsonOptions): string;

  /** Format key-value pairs */
  keyValue(data: Record<string, unknown>, options?: KeyValueOptions): string;

  /** Format a list */
  list(items: string[], options?: ListOptions): string;

  /** Format a tree */
  tree(data: TreeNode, options?: TreeOptions): string;

  /** Create a progress bar */
  progressBar(current: number, total: number, options?: ProgressOptions): string;

  /** Format a status indicator */
  status(state: StatusState, label: string): string;

  /** Format a diff */
  diff(before: string, after: string): string;

  /** Smart output: respects --json, --quiet, --no-color flags */
  output(data: unknown, context: CommandContext): void;
}
```

### 2.5 Error Handler

```typescript
// framework/error-handler.ts

class CliErrorHandler {
  /** Handle command execution errors with recovery suggestions */
  handleCommandError(error: Error, command: CommandDefinition, context: CommandContext): never;

  /** Create a typed CLI error with code, message, and suggestions */
  createError(code: ErrorCode, message: string, details?: ErrorDetails): CliError;

  /** Wrap an async operation with consistent error handling */
  withErrorHandling<T>(operation: () => Promise<T>, context: ErrorContext): Promise<T>;

  /** Register custom error handlers for specific error codes */
  registerHandler(code: string, handler: ErrorRecoveryHandler): void;
}
```

---

## 3. Command Priority Matrix

### Tier 1 - Core Operations (Week 1-2)

| Command        | Subcommands                      | Implementation Status             | Priority Rationale            |
| -------------- | -------------------------------- | --------------------------------- | ----------------------------- |
| `wundr start`  | `[--port] [--config] [--detach]` | Wrap existing orchestrator.ts     | Gateway to using Wundr at all |
| `wundr stop`   | `[--force] [--timeout]`          | Wrap existing orchestrator.ts     | Companion to start            |
| `wundr status` | `[--json] [--watch]`             | Wrap orchestrator.ts + session.ts | Most-run command after start  |
| `wundr agent`  | `list, spawn, stop, info`        | New - integrate session.ts        | Core workflow for multi-agent |

### Tier 2 - Daily Workflow (Week 3-4)

| Command        | Subcommands                     | Implementation Status          | Priority Rationale           |
| -------------- | ------------------------------- | ------------------------------ | ---------------------------- |
| `wundr memory` | `query, add, list, sync, prune` | Wrap rag.ts + new memory layer | Key differentiator for Wundr |
| `wundr config` | `show, set, reset, validate`    | Wrap config-manager.ts         | Essential for customization  |
| `wundr batch`  | `run, create, list, validate`   | Already works (batch.ts)       | Already functional           |

### Tier 3 - Onboarding (Week 5-6)

| Command        | Subcommands                         | Implementation Status    | Priority Rationale  |
| -------------- | ----------------------------------- | ------------------------ | ------------------- |
| `wundr setup`  | `[profile] --interactive --dry-run` | Already works (setup.ts) | Already functional  |
| `wundr plugin` | `list, install, remove, enable`     | Partial (plugins.ts)     | Extensibility story |

### Tier 4 - Operational (Week 7-8)

| Command          | Subcommands                     | Implementation Status       | Priority Rationale |
| ---------------- | ------------------------------- | --------------------------- | ------------------ |
| `wundr audit`    | `security, compliance, cost`    | New                         | Trust and safety   |
| `wundr guardian` | `report, review, interventions` | Already works (guardian.ts) | Already functional |
| `wundr worktree` | `list, create, clean, sync`     | Already works (worktree.ts) | Already functional |

---

## 4. Framework File Structure

```
packages/@wundr/cli/src/framework/
  command-interface.ts    # Core types and interfaces
  command-registry.ts     # Auto-discovery and registration
  output-formatter.ts     # Table, JSON, key-value, progress formatting
  error-handler.ts        # Centralized error handling with recovery
  index.ts                # Public API barrel export
```

### 4.1 Integration Plan

The framework does NOT replace existing working commands. Instead:

1. **New commands** are written using the `CommandDefinition` interface
2. **Existing working commands** get thin `CommandDefinition` wrappers that call the existing logic
3. **Stub commands** get replaced with proper `CommandDefinition` implementations over time
4. The `CommandRegistry.buildProgram()` method generates Commander.js commands from definitions
5. The `cli.ts` main file migrates from manual imports to `registry.discoverCommands('./commands')`

### 4.2 Migration Path (Per Command)

```
Phase 1: Create wrapper     (wrap existing function in CommandDefinition)
Phase 2: Add validation     (implement validate() method)
Phase 3: Add output format  (use OutputFormatter for consistent --json/--table)
Phase 4: Add error recovery (use CliErrorHandler for suggestions)
Phase 5: Add completion     (export argument completions for bash/zsh)
```

---

## 5. Output Format Standardization

### 5.1 Global Flags

Every command inherits:

- `--json` - Output raw JSON (for scripting/piping)
- `--quiet` / `-q` - Suppress non-essential output
- `--no-color` - Disable ANSI colors
- `--verbose` / `-v` - Show debug-level details

### 5.2 Format Rules

1. **Status displays** use colored status indicators: `[RUNNING]` green, `[STOPPED]` yellow,
   `[ERROR]` red
2. **Lists** use `console.table()` for multi-column, `OutputFormatter.list()` for single-column
3. **Errors** always show: error code, message, suggestion, and `--verbose` shows stack trace
4. **Progress** uses `ora` spinners for indeterminate, `OutputFormatter.progressBar()` for
   determinate
5. **Success** outputs a single green line, not a wall of text
6. **JSON mode** outputs valid JSON to stdout, all other messaging goes to stderr

### 5.3 Status Icon Convention

```
[RUNNING]  / green   - Active/healthy
[STOPPED]  / yellow  - Inactive/paused
[ERROR]    / red     - Failed/unhealthy
[PENDING]  / cyan    - Waiting/queued
[DONE]     / blue    - Completed successfully
[SKIPPED]  / gray    - Intentionally skipped
```

---

## 6. Error Handling Strategy

### 6.1 Error Code Registry

All errors use a hierarchical code system:

```
WUNDR_CLI_001    - Command not found
WUNDR_CLI_002    - Invalid arguments
WUNDR_CLI_003    - Missing required option
WUNDR_DAEMON_001 - Daemon not running
WUNDR_DAEMON_002 - Daemon already running
WUNDR_DAEMON_003 - Port already in use
WUNDR_CONFIG_001 - Config file not found
WUNDR_CONFIG_002 - Config validation failed
WUNDR_AGENT_001  - Agent spawn failed
WUNDR_AGENT_002  - Agent not found
WUNDR_MEMORY_001 - Memory store not initialized
WUNDR_PLUGIN_001 - Plugin not found
```

### 6.2 Recovery Suggestions

Every error code maps to actionable suggestions:

```typescript
{
  'WUNDR_DAEMON_001': [
    'Start the daemon with: wundr start',
    'Check logs with: wundr orchestrator logs',
  ],
  'WUNDR_CONFIG_002': [
    'Validate your config: wundr config validate',
    'Reset to defaults: wundr config reset',
  ],
}
```

---

## 7. Shell Completion Design

### 7.1 Completion Sources

1. **Static**: Command names, subcommand names, option flags
2. **Dynamic**: Session IDs (from state.json), plugin names (from installed), profile names
3. **File**: Paths for --config, --output, batch file arguments

### 7.2 Generation

```bash
# Install completions
wundr completion bash >> ~/.bashrc
wundr completion zsh >> ~/.zshrc
wundr completion fish >> ~/.config/fish/completions/wundr.fish
```

The `CommandRegistry` generates completions automatically from registered `CommandDefinition`
metadata.

---

## 8. Testing Strategy

### 8.1 Unit Tests

Each `CommandDefinition` is testable in isolation:

```typescript
const result = await myCommand.execute(
  { sessionId: 'test-123' },
  { format: 'json' },
  createMockContext()
);
expect(result.exitCode).toBe(0);
expect(result.output).toMatchSnapshot();
```

### 8.2 Integration Tests

Test the full Commander.js → Registry → Command pipeline:

```typescript
const output = await runCli(['status', '--json']);
const parsed = JSON.parse(output.stdout);
expect(parsed.running).toBeDefined();
```

---

## 9. Dependencies

The framework uses only dependencies already in `package.json`:

- `commander` ^11.1.0 - Argument parsing (already used)
- `chalk` ^5.3.0 - Color output (already used)
- `ora` ^8.0.1 - Spinners (already used)
- `inquirer` ^9.2.12 - Interactive prompts (already used)
- `zod` ^3.22.4 - Validation (already used for config)
- `listr2` ^8.0.0 - Task lists (already used in batch)

No new dependencies are required.

---

## 10. Implementation Checklist

- [x] Analyze current command inventory
- [x] Classify stubs vs real implementations
- [x] Design command interface
- [x] Design command registry
- [x] Design output formatter
- [x] Design error handler
- [ ] Implement `command-interface.ts`
- [ ] Implement `command-registry.ts`
- [ ] Implement `output-formatter.ts`
- [ ] Implement `error-handler.ts`
- [ ] Wrap `wundr start` / `wundr stop` / `wundr status`
- [ ] Implement `wundr agent` command
- [ ] Implement `wundr memory` command
- [ ] Implement `wundr config` command
- [ ] Add shell completion generation
- [ ] Add comprehensive tests
- [ ] Migrate remaining commands to framework
