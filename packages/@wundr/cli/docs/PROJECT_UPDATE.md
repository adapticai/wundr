# Wundr Project Update Command Architecture

## Overview

The `wundr update` command provides a comprehensive system for updating wundr projects to new versions while preserving user customizations, managing conflicts, and ensuring safe rollback capabilities.

## Architecture Diagram

```
+------------------------------------------------------------------+
|                     PROJECT UPDATE COMMAND                        |
+------------------------------------------------------------------+
|                                                                   |
|  +------------------------+    +----------------------------+     |
|  |   CLI Entry Point      |    |    Update Options          |     |
|  |   project-update.ts    |--->|    --dry-run               |     |
|  |                        |    |    --force                  |     |
|  +------------------------+    |    --skip-backup            |     |
|            |                   |    --components             |     |
|            v                   |    --version                |     |
|  +------------------------+    +----------------------------+     |
|  | ProjectUpdateManager   |                                       |
|  |  - Orchestrates flow   |                                       |
|  |  - Manages transaction |                                       |
|  +------------------------+                                       |
|            |                                                      |
|            +------------------+------------------+                 |
|            |                  |                  |                 |
|            v                  v                  v                 |
|  +-----------------+  +-----------------+  +------------------+   |
|  | State Detection |  | Safety Manager  |  | Conflict         |   |
|  | state-detection |  | safety-         |  | Resolution       |   |
|  |     .ts         |  | mechanisms.ts   |  | conflict-        |   |
|  +-----------------+  +-----------------+  | resolution.ts    |   |
|            |                  |           +------------------+    |
|            v                  v                  |                 |
|  +-----------------+  +-----------------+        v                 |
|  | ProjectState    |  | UpdateBackup    |  +------------------+   |
|  | - version       |  | - files         |  | MergeStrategy    |   |
|  | - components    |  | - checksum      |  | merge-strategy   |   |
|  | - templates     |  | - rollback      |  |     .ts          |   |
|  | - customizations|  +-----------------+  +------------------+   |
|  +-----------------+                                              |
|                                                                   |
+------------------------------------------------------------------+
```

## Component Descriptions

### 1. Main Command (`project-update.ts`)

The main orchestrator for project updates. Coordinates all other components.

**Key Classes:**
- `ProjectUpdateManager`: Main update orchestration
- `ProjectUpdateCommands`: CLI command registration

**Features:**
- Command-line option parsing
- Update workflow coordination
- Progress reporting
- Error handling and recovery

**Usage:**
```bash
# Update entire project
wundr update project

# Check for updates
wundr update check

# Dry run to preview changes
wundr update project --dry-run

# Force update specific components
wundr update project --force --components config,templates

# Update to specific version
wundr update project --version 2.0.0
```

### 2. State Detection (`state-detection.ts`)

Detects the current state of a wundr project.

**Key Interfaces:**
```typescript
interface ProjectState {
  version: string;
  detectedAt: Date;
  projectRoot: string;
  config: ConfigState;
  components: ComponentState[];
  templates: TemplateState[];
  checksums: FileChecksum[];
  customizations: Customization[];
  dependencies: DependencyState;
  needsUpdate: boolean;
  recommendations: UpdateRecommendation[];
}

interface ComponentState {
  name: string;
  type: ComponentType;
  version: string;
  latestVersion: string | null;
  needsUpdate: boolean;
  files: string[];
  config: Record<string, unknown>;
  dependencies: string[];
}
```

**Features:**
- Version detection
- Configuration state analysis
- Component inventory
- Template modification detection
- File checksum computation
- Customization identification
- Update recommendations

### 3. Merge Strategy (`merge-strategy.ts`)

Implements three-way merge for templates and configuration files.

**Key Features:**
```typescript
interface MergeResult {
  success: boolean;
  content: string | null;
  conflicts: MergeConflict[];
  strategy: MergeStrategyType;
  stats: MergeStats;
  needsManualResolution: boolean;
}
```

**Merge Strategies:**
- `three-way`: Standard three-way merge (base, user, target)
- `user-priority`: Prefer user changes over updates
- `target-priority`: Prefer updates over user changes
- `smart-merge`: Intelligent merging based on file type
- `section-merge`: Section-based merging for markdown

**File Type Support:**
- JSON: Deep object merge with conflict detection
- YAML: Structure-aware merging
- Markdown: Section-based merging
- TypeScript/JavaScript: Line-based three-way merge
- Text: Standard line-by-line merge

### 4. Safety Mechanisms (`safety-mechanisms.ts`)

Provides backup, rollback, and transaction support.

**Key Classes:**
- `SafetyManager`: Backup and rollback management
- `UpdateTransaction`: Atomic update operations

**Features:**
```typescript
interface UpdateBackup {
  id: string;
  timestamp: Date;
  path: string;
  sourceVersion: string;
  targetVersion: string;
  files: BackedUpFile[];
  reason: string;
  compressed: boolean;
  totalSize: number;
  checksum: string;
  rollbackPointId: string | null;
}
```

**Safety Features:**
- Automatic backup to `.wundr-backup-{timestamp}/`
- Backup compression (optional)
- Backup verification and integrity checks
- Incremental updates with rollback points
- Transaction-like update operations
- Automatic rollback on failure
- Backup cleanup and retention policies

### 5. Conflict Resolution (`conflict-resolution.ts`)

Handles conflicts during project updates.

**Key Interfaces:**
```typescript
interface UpdateConflict {
  id: string;
  filePath: string;
  category: ConflictCategory;
  autoResolvable: boolean;
  suggestion: ResolutionSuggestion;
  severity: 'critical' | 'high' | 'medium' | 'low';
  baseContent: string;
  userContent: string;
  targetContent: string;
}

interface ResolutionSuggestion {
  resolution: ConflictResolution;
  confidence: number;
  reasoning: string;
  alternatives: ConflictResolution[];
}
```

**Resolution Options:**
- `keep-user`: Preserve user's modifications
- `take-target`: Accept new version
- `keep-both`: Merge both versions
- `manual`: User edits the content

**Features:**
- Interactive conflict resolution
- Auto-resolution for low-severity conflicts
- Conflict categorization (config, template, code, etc.)
- Resolution history and learning
- Diff visualization

## Update Workflow

```
1. START
   |
2. DETECT STATE
   |-- Scan project files
   |-- Compute checksums
   |-- Identify components
   |-- Detect customizations
   |
3. CHECK UPDATES
   |-- Compare versions
   |-- Generate recommendations
   |
4. SHOW UPDATE PLAN
   |-- Display changes
   |-- Confirm with user (unless --force)
   |
5. CREATE BACKUP
   |-- Backup affected files
   |-- Store metadata
   |-- Verify backup integrity
   |
6. START TRANSACTION
   |
7. PERFORM UPDATES
   |-- For each component:
   |   |-- Get base content
   |   |-- Get target content
   |   |-- Three-way merge
   |   |-- Record operation
   |
8. RESOLVE CONFLICTS
   |-- Categorize conflicts
   |-- Auto-resolve if possible
   |-- Interactive resolution
   |
9. COMMIT TRANSACTION
   |-- Verify all operations
   |-- Finalize changes
   |
10. WRITE LOG
    |-- Record all actions
    |-- Save to .wundr-update.log
    |
11. COMPLETE
```

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--dry-run` | Preview changes without applying | `false` |
| `--force` | Skip confirmation prompts | `false` |
| `--skip-backup` | Don't create backup | `false` |
| `--components <names>` | Update specific components | All |
| `--version <version>` | Target version | Latest |
| `--no-interactive` | Disable interactive mode | Enabled |
| `--verbose` | Detailed output | `false` |
| `--show-diff` | Show differences | `true` |
| `--auto-resolve` | Auto-resolve conflicts | `false` |
| `--no-rollback` | Disable rollback on failure | Enabled |

## Subcommands

### `wundr update project`
Main update command. Updates the project to a new version.

### `wundr update check`
Check for available updates without making changes.

### `wundr update history`
Show update history from `.wundr-update.log`.

### `wundr update rollback [backupId]`
Rollback to a previous backup state.
- `--list`: List available backups

### `wundr update cleanup`
Clean up old backups.
- `--keep <n>`: Number of backups to retain (default: 5)

## Logging

All update operations are logged to `.wundr-update.log`:

```
[2024-01-15T10:30:00.000Z] UPDATE project - success: Starting project update
[2024-01-15T10:30:01.000Z] DETECT state - success: Version: 1.0.0
[2024-01-15T10:30:02.000Z] BACKUP .wundr-backup-2024-01-15T10-30-02 - success: 15 files backed up
[2024-01-15T10:30:05.000Z] UPDATE config - success: 3 files updated
[2024-01-15T10:30:10.000Z] UPDATE templates - success: 5 files updated
```

## Error Handling

The update system provides robust error handling:

1. **Transaction Rollback**: On failure, all changes are automatically rolled back
2. **Backup Restore**: Can restore from any previous backup
3. **Partial Update Recovery**: Continue from where update failed
4. **Detailed Error Logging**: All errors are logged with context

## Best Practices

1. **Always run with `--dry-run` first** to preview changes
2. **Keep backups enabled** for safety
3. **Review conflicts carefully** before resolution
4. **Use `--verbose`** for debugging update issues
5. **Clean up old backups** periodically with `wundr update cleanup`

## Integration with Wundr CLI

The update command integrates with the existing wundr CLI:

```typescript
// In cli.ts
import { ProjectUpdateCommands } from './commands/project-update';

// Register commands
new ProjectUpdateCommands(this.program, this.configManager, this.pluginManager);

// Or add standalone command
this.program.addCommand(createProjectUpdateCommand());
```

## File Structure

```
packages/@wundr/cli/
├── src/
│   ├── commands/
│   │   └── project-update.ts    # Main command
│   ├── lib/
│   │   ├── state-detection.ts   # State detection system
│   │   ├── merge-strategy.ts    # Three-way merge
│   │   ├── safety-mechanisms.ts # Backup & rollback
│   │   └── conflict-resolution.ts # Conflict handling
│   └── ...
└── docs/
    └── PROJECT_UPDATE.md        # This documentation
```

## Future Enhancements

1. **Registry Integration**: Fetch updates from wundr package registry
2. **Semantic Versioning**: Respect semver for breaking change detection
3. **Plugin Updates**: Update plugins alongside core
4. **Team Sync**: Sync update decisions across team members
5. **Update Scheduling**: Schedule automatic updates
6. **Canary Updates**: Test updates in isolated environment first
