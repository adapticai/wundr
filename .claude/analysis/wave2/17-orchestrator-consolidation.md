# Wave 2 Analysis #17: Orchestrator Consolidation

## Problem Statement

The `@wundr/computer-setup` package currently has **three** overlapping orchestrator implementations:

1. **`RealSetupOrchestrator`** (`installers/real-setup-orchestrator.ts`, 1,412 lines)
   - Hardcoded installer initialization
   - Profile definitions baked into the class
   - State persistence for resume-from-failure
   - Progress callbacks + EventEmitter
   - Security, context engineering, orchestration framework phases
   - Direct `execa` calls for system checks (disk space via `df`, network via `ping`)
   - Creates shell aliases, dev directory structure
   - Topological sort for step dependencies

2. **`SetupOrchestrator`** (`orchestrator/index.ts`, 682 lines)
   - Dependency-injected architecture (ProfileManager, InstallerRegistry, ConfiguratorService, SetupValidator)
   - Singleton EventBus pattern
   - 6-phase orchestration (Validation, Preparation, Installation, Configuration, Verification, Finalization)
   - Parallel execution via dependency grouping
   - Step rollback support
   - Report generation
   - Cancel support

3. **`ComputerSetupManager`** (`manager/index.ts`, 654 lines)
   - Also dependency-injected (ProfileManager, InstallerRegistry, ConfiguratorService, SetupValidator)
   - WundrConfigManager integration
   - 6 developer profiles (frontend, backend, fullstack, devops, ml, mobile)
   - Dry-run mode
   - Post-setup hooks (shell config, team repos, VS Code extensions, Claude Flow)
   - Report generation to `~/.wundr/setup-reports/`

## Overlap Analysis

| Feature | RealSetupOrchestrator | SetupOrchestrator | ComputerSetupManager |
|---------|----------------------|-------------------|---------------------|
| Profile system | 4 hardcoded | Via ProfileManager | 6 via ProfileManager |
| Dependency sort | Topological sort | Topological sort | Topological sort |
| Idempotent ops | `isInstalled` checks | `skipExisting` flag | `skipExisting` flag |
| Progress | Callbacks + EventEmitter | EventEmitter + EventBus | EventEmitter |
| Dry-run | No | Yes | Yes |
| State persistence | JSON file | No | No |
| Resume | Yes | No | No |
| Rollback | No | Yes | Yes |
| Parallel exec | No | Yes (dependency groups) | No |
| Cancel | No | Yes | No |
| Report generation | No | Yes | Yes |
| Platform detection | Constructor param | Via validator | Auto-detected |
| Security phases | Yes | No | No |
| Context engineering | Yes | No | No |
| Shell aliases | Yes | Via ConfiguratorService | Via ConfiguratorService |
| Team repos | No | Via profile.team | Via profile.team |

### Duplicated Code

- **Topological sort** is implemented 3 times identically
- **Step execution** logic is nearly identical across all three
- **Progress reporting** has 3 different patterns for the same concept
- **Profile creation** is hardcoded in RealSetupOrchestrator but uses ProfileManager in the other two
- **System validation** (disk space, network) is implemented differently in each

### Security Vulnerabilities

1. **`RealSetupOrchestrator.getAvailableDiskSpace()`** - Parses `df` output with string splitting; fragile and platform-specific
2. **`RealSetupOrchestrator.verifyNetworkConnectivity()`** - Calls `ping` directly; could be a vector for command injection if `google.com` were ever parameterized
3. **`RealSetupOrchestrator.createShellAliases()`** - Appends unsanitized content to `~/.zshrc`; no atomicity guarantee
4. **`RealSetupOrchestrator.createCoreToolInstaller()`** - Uses `execa('which', [toolName])` which is safe, but the pattern allows arbitrary tool names
5. No input validation on profile names (could be used to traverse paths in state file)

## Consolidated Design

### Architecture

```
core/
  unified-orchestrator.ts   -- Single entry point, phased execution engine
  operation-runner.ts       -- Safe command execution, dry-run support
  platform-detector.ts      -- Cross-platform detection and capability queries
  profile-manager.ts        -- 6 profiles + custom profiles, serializable
```

### Design Principles

1. **Single orchestrator** - One class that replaces all three
2. **Dependency injection** - All services injected, never instantiated internally
3. **Idempotent by default** - Every operation checks before acting
4. **Safe command execution** - No `shell: true`, argument arrays only, input validation
5. **Dry-run first-class** - Every operation respects dry-run mode
6. **State persistence** - Resume-from-failure for all modes
7. **Progress reporting** - Unified callback + EventEmitter pattern
8. **Incremental updates** - `computer-update` support via state diffing
9. **Claude Code integration** - Conventions generator called as a phase

### Phase Execution Model

The consolidated orchestrator uses 8 phases, combining the best from all three:

```
Phase 1: Platform Detection & Validation
Phase 2: Profile Resolution & Plan Generation
Phase 3: Security Configuration (if enabled)
Phase 4: Core System Tools (homebrew, git)
Phase 5: Development Tools (node, python, docker, editors)
Phase 6: AI & Orchestration Setup (Claude, context engineering)
Phase 7: Configuration & Conventions (shell, git, Claude Code .claude/)
Phase 8: Verification & Finalization (validate, report, cleanup)
```

### Key Improvements Over Current Code

1. **`OperationRunner`** replaces all direct `execa` calls with:
   - Argument validation (no shell metacharacters)
   - Dry-run interception
   - Timeout enforcement
   - Structured error wrapping
   - Retry with backoff

2. **`PlatformDetector`** replaces fragile `df`/`ping` calls with:
   - `node:os` and `node:fs` APIs for disk space
   - `node:dns` for network checks (no subprocess)
   - Cached detection results
   - Windows support via proper platform branching

3. **`ProfileManager`** consolidates 3 profile implementations into one with:
   - 6 built-in profiles (frontend, backend, fullstack, devops, ml, mobile)
   - Custom profile creation and persistence
   - Profile diffing for incremental updates
   - Serializable profile configs (no functions stored)

4. **State machine** for setup lifecycle:
   - `idle` -> `planning` -> `executing` -> `verifying` -> `complete`/`failed`
   - Any `failed` state can transition to `executing` (resume)
   - State persisted to `~/.wundr/setup-state.json`

### Incremental Update Support

The `computer-update` command works by:
1. Loading the previous setup state
2. Resolving the current profile
3. Diffing the plan against completed operations
4. Executing only new/changed operations
5. Re-running validation on everything

### Claude Code Conventions Integration

Phase 7 calls `generateClaudeCodeStructure()` from `project-init/claude-code-conventions.ts` to:
- Create `.claude/` directory with agents, skills, commands
- Generate `settings.json` based on profile
- Set up memory architecture based on orchestration options
- Configure hooks if enabled

This replaces the ad-hoc shell alias and directory creation in `RealSetupOrchestrator.finalizeSetup()`.

## Migration Path

1. Create `core/` directory with new files
2. Update `src/index.ts` to export `UnifiedOrchestrator` as primary
3. Mark `RealSetupOrchestrator`, `SetupOrchestrator`, `ComputerSetupManager` as `@deprecated`
4. Add re-export shims that delegate to `UnifiedOrchestrator`
5. Remove deprecated code in next major version

## File Inventory

| File | Lines | Purpose |
|------|-------|---------|
| `core/unified-orchestrator.ts` | ~450 | Main orchestration engine |
| `core/operation-runner.ts` | ~200 | Safe command execution |
| `core/platform-detector.ts` | ~180 | Platform detection and system checks |
| `core/profile-manager.ts` | ~250 | Profile management and diffing |
