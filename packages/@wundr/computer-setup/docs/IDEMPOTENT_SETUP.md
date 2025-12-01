# Idempotent Computer Setup Architecture

## Overview

This document describes the architecture for a fully idempotent computer setup system that safely
handles fresh installations, upgrades, user-customized environments, and partial installations.

## Design Principles

### 1. Idempotency

All operations must be idempotent - running them multiple times produces the same result as running
them once. This is achieved through:

- **State checking before action**: Every operation verifies current state before making changes
- **Deterministic outcomes**: Same inputs always produce same outputs
- **No side effects on re-runs**: Operations that complete successfully produce no changes on
  subsequent runs

### 2. Safety First

- **Zero destructive operations without confirmation**: Any operation that could destroy user data
  requires explicit confirmation
- **Backup before modify**: Configuration files are backed up before any modifications
- **Preserve user customizations**: User modifications to managed files are detected and preserved

### 3. Transparency

- **Full audit trail**: All operations are logged with timestamps and outcomes
- **Clear state visibility**: Current system state is always queryable
- **Predictable behavior**: Dry-run mode shows exactly what would change

## System State Model

### Environment Types

```
+----------------+     +----------------+     +-------------------+
| FRESH_INSTALL  |     |    UPGRADE     |     | USER_CUSTOMIZED   |
|                |     |                |     |                   |
| No prior Wundr |     | Prior Wundr    |     | Has user mods to  |
| installation   |     | installation   |     | managed files     |
+----------------+     +----------------+     +-------------------+
        |                     |                       |
        v                     v                       v
+----------------+     +----------------+     +-------------------+
| PARTIAL_INSTALL|     |   CONFLICTED   |     |     UNKNOWN       |
|                |     |                |     |                   |
| Incomplete     |     | Has blocking   |     | Cannot determine  |
| prior setup    |     | issues         |     | state             |
+----------------+     +----------------+     +-------------------+
```

### Component States

```typescript
enum InstallationStatus {
  NOT_INSTALLED, // Not present on system
  MANAGED, // Installed and managed by Wundr
  UNMANAGED, // Pre-existing, not managed by Wundr
  MODIFIED, // Wundr-managed but user-modified
  OUTDATED, // Installed but needs update
  CORRUPTED, // Broken installation
  PENDING, // Queued for installation
  INSTALLING, // Currently being installed
  FAILED, // Installation failed
}
```

### Configuration States

```typescript
enum ConfigurationState {
  MISSING, // File does not exist
  PRISTINE, // File matches expected content exactly
  MODIFIED, // File has user modifications
  CONFLICTED, // File has incompatible changes
  BACKED_UP, // File has been backed up
}
```

## State Machine

### Setup Flow State Diagram

```
                    +----------+
                    | INITIAL  |
                    +----+-----+
                         | start
                         v
                    +----------+
                    | DETECTING|
                    +----+-----+
                         |
          +--------------+--------------+
          |                             |
          v                             v
    +----------+                  +----------+
    | DETECTED |                  |  FAILED  |
    +----+-----+                  +----------+
         |
         +---------> AWAITING_CONFIRMATION (if destructive)
         |                    |
         v                    v (confirmed)
    +----------+         +----------+
    | VALIDATING|<-------+          |
    +----+-----+                    |
         |                          |
         +---------> FAILED         |
         |           (validation)   |
         v                          |
    +----------+                    |
    | BACKING_UP| (if needed)       |
    +----+-----+                    |
         |                          |
         v                          |
    +----------+                    |
    | INSTALLING|<------------------+
    +----+-----+
         |
         +---------> ROLLING_BACK (on failure with backup)
         |                |
         v                v
    +----------+    +----------+
    |CONFIGURING|   |  FAILED  |
    +----+-----+    +----------+
         |
         v
    +----------+
    | VERIFYING|
    +----+-----+
         |
         +---------> CONFIGURING (retry)
         |
         v
    +----------+
    | COMPLETED|
    +----------+
```

### State Transitions

| From                  | To                    | Trigger              | Guard                 |
| --------------------- | --------------------- | -------------------- | --------------------- |
| INITIAL               | DETECTING             | start                | -                     |
| DETECTING             | DETECTED              | detectionComplete    | -                     |
| DETECTING             | FAILED                | detectionFailed      | -                     |
| DETECTED              | VALIDATING            | validate             | -                     |
| DETECTED              | AWAITING_CONFIRMATION | requiresConfirmation | hasDestructiveChanges |
| VALIDATING            | BACKING_UP            | validationPassed     | backupRequired        |
| VALIDATING            | INSTALLING            | validationPassed     | noBackupRequired      |
| VALIDATING            | FAILED                | validationFailed     | -                     |
| AWAITING_CONFIRMATION | VALIDATING            | confirmed            | -                     |
| BACKING_UP            | INSTALLING            | backupComplete       | -                     |
| BACKING_UP            | FAILED                | backupFailed         | -                     |
| INSTALLING            | CONFIGURING           | installComplete      | -                     |
| INSTALLING            | ROLLING_BACK          | installFailed        | hasBackup             |
| INSTALLING            | FAILED                | installFailed        | noBackup              |
| INSTALLING            | PAUSED                | pause                | -                     |
| CONFIGURING           | VERIFYING             | configComplete       | -                     |
| CONFIGURING           | ROLLING_BACK          | configFailed         | hasBackup             |
| VERIFYING             | COMPLETED             | verificationPassed   | -                     |
| VERIFYING             | CONFIGURING           | verificationFailed   | canRetry              |
| ROLLING_BACK          | FAILED                | rollbackComplete     | -                     |
| PAUSED                | INSTALLING            | resume               | -                     |

## Idempotent Operation Patterns

### Pattern 1: Check-Then-Act

```typescript
async function idempotentOperation() {
  // 1. Check current state
  const currentState = await checkState();

  // 2. Determine if action needed
  if (currentState === desiredState) {
    return { changed: false, message: 'Already in desired state' };
  }

  // 3. Perform action
  await performAction();

  // 4. Verify result
  const newState = await checkState();
  if (newState !== desiredState) {
    throw new Error('Action did not achieve desired state');
  }

  return { changed: true, message: 'State updated' };
}
```

### Pattern 2: File Write with Checksum

```typescript
async function idempotentFileWrite(path: string, content: string) {
  const newChecksum = computeChecksum(content);

  try {
    const existingContent = await fs.readFile(path);
    const existingChecksum = computeChecksum(existingContent);

    if (existingChecksum === newChecksum) {
      return { changed: false }; // Content already matches
    }
  } catch {
    // File doesn't exist, will create
  }

  await fs.writeFile(path, content);
  return { changed: true };
}
```

### Pattern 3: Command with Existence Check

```typescript
async function idempotentInstall(packageName: string) {
  // Check if already installed
  const isInstalled = await checkInstalled(packageName);

  if (isInstalled) {
    const version = await getVersion(packageName);
    return { changed: false, version };
  }

  // Install
  await install(packageName);

  // Verify
  const newVersion = await getVersion(packageName);
  return { changed: true, version: newVersion };
}
```

### Pattern 4: Configuration Block Management

```typescript
async function idempotentShellConfig(blockId: string, content: string) {
  const startMarker = `# BEGIN WUNDR MANAGED BLOCK: ${blockId}`;
  const endMarker = `# END WUNDR MANAGED BLOCK: ${blockId}`;

  const rcContent = await fs.readFile('~/.zshrc');

  // Check if block exists and matches
  if (rcContent.includes(startMarker)) {
    const existingBlock = extractBlock(rcContent, startMarker, endMarker);
    if (existingBlock === content) {
      return { changed: false };
    }
    // Replace existing block
    const newContent = replaceBlock(rcContent, startMarker, endMarker, content);
    await fs.writeFile('~/.zshrc', newContent);
    return { changed: true, action: 'updated' };
  }

  // Append new block
  await fs.appendFile('~/.zshrc', `\n${startMarker}\n${content}\n${endMarker}\n`);
  return { changed: true, action: 'added' };
}
```

## Brownfield Environment Handling

### Detection Strategy

1. **Check for metadata file**: `~/.claude/.wundr-metadata.json`
2. **Scan for existing tools**: Check common installation paths
3. **Analyze configurations**: Detect user modifications
4. **Classify environment**: Determine appropriate setup strategy

### Handling Scenarios

#### Fresh Install

- No prior Wundr metadata
- No conflicting tools
- Full installation proceeds

```
Detection -> Validate -> Install -> Configure -> Verify -> Complete
```

#### Upgrade

- Existing Wundr metadata found
- Previous version detected
- Incremental updates applied

```
Detection -> Diff -> Backup -> Upgrade -> Migrate -> Verify -> Complete
```

#### User Customized

- Wundr metadata present
- User modifications detected in managed files
- Customizations preserved during update

```
Detection -> Analyze Mods -> Backup -> Update -> Merge Mods -> Verify -> Complete
```

#### Partial Install

- Incomplete prior setup
- Resume from last successful step

```
Detection -> Load State -> Resume -> Continue -> Verify -> Complete
```

### User Customization Detection

```typescript
// Detect shell aliases
const aliasPattern = /^alias\s+\w+=/gm;

// Detect environment variables
const exportPattern = /^export\s+\w+=/gm;

// Detect functions
const functionPattern = /^function\s+\w+\s*\(/gm;

// Wundr managed blocks are excluded
const managedBlockPattern = /# BEGIN WUNDR MANAGED BLOCK[\s\S]*?# END WUNDR MANAGED BLOCK/g;
```

## Metadata Storage

### Location

```
~/.claude/.wundr-metadata.json
```

### Schema

```typescript
interface WundrMetadata {
  schemaVersion: string;
  installationId: string;
  wundrVersion: string;
  installedAt: string;
  updatedAt: string;
  lastCompletedSetup: string | null;
  environmentType: EnvironmentType;
  platform: SetupPlatform;
  profile: DeveloperProfile | null;
  components: ComponentState[];
  configurations: ConfigurationFileState[];
  setupHistory: SetupHistoryEntry[];
  userCustomizations: UserCustomization[];
  fileChecksums: FileChecksum[];
  capabilities: SystemCapabilities;
}
```

### Version Tracking

```json
{
  "schemaVersion": "1.0.0",
  "wundrVersion": "1.0.1",
  "components": [
    {
      "id": "node",
      "version": "20.10.0",
      "targetVersion": "20.10.0",
      "installedAt": "2024-01-15T10:30:00Z",
      "managedByWundr": true
    }
  ]
}
```

## Backup Strategy

### Backup Location

```
~/.claude/.wundr-backups/
  backup-2024-01-15T10-30-00/
    manifest.json
    zshrc.bak
    gitconfig.bak
    ...
```

### Backup Manifest

```json
{
  "backupId": "backup-2024-01-15T10-30-00",
  "timestamp": "2024-01-15T10:30:00Z",
  "components": ["node", "python"],
  "configBackups": {
    "zshrc": "~/.claude/.wundr-backups/backup-2024-01-15T10-30-00/zshrc.bak"
  },
  "platform": {
    "os": "darwin",
    "arch": "arm64"
  }
}
```

## API Reference

### SystemStateManager

```typescript
interface ISystemStateManager {
  // Detection
  detectState(): Promise<SystemStateDetectionResult>;

  // Metadata
  loadMetadata(): Promise<WundrMetadata | null>;
  saveMetadata(metadata: WundrMetadata): Promise<void>;

  // Component state
  getComponentState(componentId: string): Promise<ComponentState | null>;
  updateComponentState(componentId: string, state: Partial<ComponentState>): Promise<void>;

  // Configuration state
  getConfigurationState(path: string): Promise<ConfigurationFileState | null>;
  updateConfigurationState(path: string, state: Partial<ConfigurationFileState>): Promise<void>;

  // History
  recordHistory(entry: SetupHistoryEntry): Promise<void>;

  // State machine
  getStateMachine(): SetupStateMachine;
  transition(trigger: string): Promise<boolean>;

  // Backup/restore
  createBackup(components: string[]): Promise<string>;
  restoreBackup(backupId: string): Promise<void>;

  // Verification
  verifyIntegrity(): Promise<StateIssue[]>;
  getRecommendations(): Promise<SetupRecommendation[]>;
}
```

### Idempotent Operations

```typescript
// File operations
idempotentFileWrite(path: string, content: string, options?: FileOperationOptions): Promise<OperationResult>;
idempotentFileAppend(path: string, content: string, marker: string, options?: FileOperationOptions): Promise<OperationResult>;
idempotentMkdir(path: string, options?: FileOperationOptions): Promise<OperationResult>;
idempotentSymlink(target: string, linkPath: string, options?: FileOperationOptions): Promise<OperationResult>;

// Package operations
idempotentBrewInstall(packageName: string, options?: InstallOperationOptions): Promise<OperationResult>;
idempotentNpmInstall(packageName: string, options?: InstallOperationOptions): Promise<OperationResult>;

// Configuration operations
idempotentShellConfig(shellRcPath: string, configBlock: string, blockId: string, options?: FileOperationOptions): Promise<OperationResult>;
idempotentEnvVar(shellRcPath: string, varName: string, varValue: string, options?: FileOperationOptions): Promise<OperationResult>;
idempotentGitConfig(key: string, value: string, scope?: 'global' | 'local' | 'system', options?: OperationOptions): Promise<OperationResult>;
```

### BrownfieldHandler

```typescript
class BrownfieldHandler {
  // Detection
  detectSystemState(): Promise<SystemStateDetectionResult>;

  // Metadata
  loadMetadata(): Promise<WundrMetadata | null>;
  saveMetadata(metadata: WundrMetadata): Promise<void>;
  initializeMetadata(): Promise<WundrMetadata>;

  // Backup
  createSystemBackup(components: string[]): Promise<string>;

  // Analysis
  checkDestructiveChanges(targetComponents: string[]): Promise<DestructiveChangeAnalysis>;
  detectUserCustomizations(): Promise<UserCustomization[]>;
}
```

## Usage Examples

### Basic Setup

```typescript
import { BrownfieldHandler, idempotentBrewInstall } from '@wundr.io/computer-setup';

const handler = new BrownfieldHandler(platform);

// Detect current state
const state = await handler.detectSystemState();

// Check for destructive changes
if (state.environmentType === EnvironmentType.USER_CUSTOMIZED) {
  const analysis = await handler.checkDestructiveChanges(['node', 'python']);

  if (analysis.hasDestructiveChanges) {
    // Prompt user for confirmation
    const confirmed = await promptUser(analysis);
    if (!confirmed) return;
  }

  // Create backup
  await handler.createSystemBackup(['node', 'python']);
}

// Install with idempotent operations
const nodeResult = await idempotentBrewInstall('node', { update: true });
console.log(`Node: ${nodeResult.outcome} - ${nodeResult.message}`);
```

### Shell Configuration

```typescript
import { idempotentShellConfig } from '@wundr.io/computer-setup';

const result = await idempotentShellConfig(
  '~/.zshrc',
  `export PATH="$HOME/.wundr/bin:$PATH"
export WUNDR_HOME="$HOME/.wundr"`,
  'wundr-paths',
  { backup: true }
);

if (result.changed) {
  console.log('Shell configuration updated');
} else {
  console.log('Shell configuration already correct');
}
```

### Dry Run Mode

```typescript
import { executeIdempotent } from '@wundr.io/computer-setup';

const result = await executeIdempotent(
  'Install Node.js',
  async () => {
    const installed = await isNodeInstalled();
    return { needsAction: !installed, currentState: null };
  },
  async () => {
    await installNode();
    return { version: await getNodeVersion() };
  },
  { dryRun: true }
);

if (result.outcome === OperationOutcome.DRY_RUN) {
  console.log('Would install Node.js');
}
```

## Error Handling

### Rollback on Failure

```typescript
try {
  const results = await executeSequential([
    () => idempotentBrewInstall('node'),
    () => idempotentBrewInstall('python'),
    () => idempotentShellConfig('~/.zshrc', config, 'wundr'),
  ]);

  if (!results.allSucceeded) {
    // Collect rollback steps from completed operations
    const rollbackSteps = collectRollbackSteps(results.results);
    await executeRollback(rollbackSteps);
  }
} catch (error) {
  // Handle catastrophic failure
}
```

### Graceful Degradation

```typescript
const result = await idempotentBrewInstall('node', {
  retries: 3,
  retryDelayMs: 5000,
  onLog: (level, message) => console.log(`[${level}] ${message}`),
});

if (!result.success) {
  // Log failure but continue with other components
  console.warn(`Node installation failed: ${result.message}`);
  // Mark as failed in metadata for later retry
}
```

## Testing Strategy

### Unit Tests

- Test each idempotent operation with mocked filesystem/commands
- Verify no changes on repeated calls
- Test error handling and rollback

### Integration Tests

- Test full setup flow on clean VM
- Test upgrade scenarios
- Test user customization preservation

### Property-Based Tests

- Idempotency: `f(f(x)) === f(x)`
- Determinism: Same input always produces same output
- Reversibility: Rollback restores original state

## Security Considerations

1. **No hardcoded secrets**: All credentials passed at runtime
2. **Minimal permissions**: Only request necessary access
3. **Audit logging**: All operations logged with timestamps
4. **Backup encryption**: Consider encrypting backups containing sensitive data
5. **Input validation**: Sanitize all paths and commands

## Performance Optimization

1. **Parallel detection**: Detect multiple components concurrently
2. **Cached state**: Cache metadata in memory during operations
3. **Incremental updates**: Only update changed components
4. **Lazy loading**: Load component installers on demand
