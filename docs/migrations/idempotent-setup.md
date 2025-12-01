# Migration Plan: Idempotent Setup System

## Overview

This document outlines the migration plan from the current computer-setup implementation to the new
idempotent setup system.

## Current State

The existing `@wundr.io/computer-setup` package provides:

- `RealSetupOrchestrator` - Main orchestration class
- `InstallerRegistry` - Component installer management
- Platform-specific installers (Mac, Linux, Windows)
- State persistence via `~/.wundr-setup-state.json`

### Current Limitations

1. **No idempotency guarantees**: Operations may fail or cause issues on re-runs
2. **Limited brownfield support**: Assumes clean or managed environments
3. **No user customization preservation**: May overwrite user modifications
4. **Basic state tracking**: Simple completed/failed step tracking
5. **No formal state machine**: Ad-hoc state management

## Target State

The new idempotent setup system provides:

1. **Full idempotency**: All operations are safe to re-run
2. **Comprehensive state detection**: Detect all environment types
3. **User customization preservation**: Detect and preserve user modifications
4. **Formal state machine**: Well-defined states and transitions
5. **Rich metadata**: Complete tracking in `~/.claude/.wundr-metadata.json`

## Migration Phases

### Phase 1: Foundation (Week 1-2)

#### 1.1 Install New Modules

```bash
# New files created:
packages/@wundr/computer-setup/src/lib/system-state.ts
packages/@wundr/computer-setup/src/lib/idempotent-operations.ts
packages/@wundr/computer-setup/src/lib/brownfield-handler.ts
```

#### 1.2 Create Lib Index

Create `packages/@wundr/computer-setup/src/lib/index.ts`:

```typescript
export * from './system-state';
export * from './idempotent-operations';
export * from './brownfield-handler';
```

#### 1.3 Update Package Exports

Update `packages/@wundr/computer-setup/src/index.ts`:

```typescript
// Add new exports
export * from './lib';
```

#### 1.4 Verification

- [ ] All new files compile without errors
- [ ] Existing tests continue to pass
- [ ] New modules can be imported

### Phase 2: Integration (Week 2-3)

#### 2.1 Create SystemStateManager Implementation

Create `packages/@wundr/computer-setup/src/lib/system-state-manager.ts`:

```typescript
import { ISystemStateManager, WundrMetadata, ... } from './system-state';
import { BrownfieldHandler } from './brownfield-handler';

export class SystemStateManager implements ISystemStateManager {
  private handler: BrownfieldHandler;
  private metadata: WundrMetadata | null = null;

  constructor(platform: SetupPlatform) {
    this.handler = new BrownfieldHandler(platform);
  }

  // Implement interface methods...
}
```

#### 2.2 Update BaseInstaller Interface

Modify `packages/@wundr/computer-setup/src/installers/index.ts`:

```typescript
import { OperationResult, OperationOptions } from '../lib';

export interface BaseInstaller {
  // Existing methods...

  // New idempotent methods
  idempotentInstall(
    profile: DeveloperProfile,
    platform: SetupPlatform,
    options?: OperationOptions
  ): Promise<OperationResult<{ version: string }>>;

  checkState(): Promise<{
    needsAction: boolean;
    currentState: { version: string | null; path: string | null } | null;
  }>;
}
```

#### 2.3 Update Individual Installers

For each installer, add idempotent methods:

```typescript
// Example: node-installer.ts
export class NodeInstaller implements BaseInstaller {
  // Existing methods...

  async idempotentInstall(
    profile: DeveloperProfile,
    platform: SetupPlatform,
    options?: OperationOptions
  ): Promise<OperationResult<{ version: string }>> {
    return idempotentBrewInstall('node', {
      ...options,
      update: true,
    });
  }

  async checkState() {
    const isInstalled = await this.isInstalled();
    if (!isInstalled) {
      return { needsAction: true, currentState: null };
    }
    const version = await this.getVersion();
    return {
      needsAction: false,
      currentState: { version, path: await which('node') },
    };
  }
}
```

### Phase 3: Orchestrator Migration (Week 3-4)

#### 3.1 Create IdempotentSetupOrchestrator

Create `packages/@wundr/computer-setup/src/orchestrator/idempotent-orchestrator.ts`:

```typescript
import { SystemStateManager } from '../lib/system-state-manager';
import { BrownfieldHandler } from '../lib/brownfield-handler';
import { executeSequential, collectRollbackSteps, executeRollback } from '../lib';

export class IdempotentSetupOrchestrator {
  private stateManager: SystemStateManager;
  private brownfieldHandler: BrownfieldHandler;

  constructor(platform: SetupPlatform) {
    this.stateManager = new SystemStateManager(platform);
    this.brownfieldHandler = new BrownfieldHandler(platform);
  }

  async orchestrate(profileName: string, options: IdempotentSetupOptions): Promise<SetupResult> {
    // 1. Detect system state
    const state = await this.brownfieldHandler.detectSystemState();

    // 2. Transition state machine
    await this.stateManager.transition('start');

    // 3. Check for destructive changes
    if (state.environmentType === EnvironmentType.USER_CUSTOMIZED) {
      const analysis = await this.brownfieldHandler.checkDestructiveChanges(
        this.getRequiredComponents(profileName)
      );

      if (analysis.hasDestructiveChanges && !options.force) {
        await this.stateManager.transition('requiresConfirmation');
        // Await user confirmation...
      }
    }

    // 4. Create backup if needed
    if (this.shouldBackup(state)) {
      await this.stateManager.transition('backupRequired');
      await this.brownfieldHandler.createSystemBackup(this.getRequiredComponents(profileName));
    }

    // 5. Execute idempotent installations
    const results = await this.executeInstallations(profileName, options);

    // 6. Handle failures with rollback
    if (!results.allSucceeded) {
      const rollbackSteps = collectRollbackSteps(results.results);
      await executeRollback(rollbackSteps);
      await this.stateManager.transition('installFailed');
      return this.generateFailureResult(results);
    }

    // 7. Complete
    await this.stateManager.transition('verificationPassed');
    return this.generateSuccessResult(results);
  }
}
```

#### 3.2 Migrate RealSetupOrchestrator

Update `packages/@wundr/computer-setup/src/installers/real-setup-orchestrator.ts`:

```typescript
import { IdempotentSetupOrchestrator } from '../orchestrator/idempotent-orchestrator';

export class RealSetupOrchestrator extends EventEmitter {
  private idempotentOrchestrator: IdempotentSetupOrchestrator;

  constructor(platform: SetupPlatform) {
    super();
    this.idempotentOrchestrator = new IdempotentSetupOrchestrator(platform);
    // Keep existing initialization for backward compatibility
    this.initializeInstallers();
    this.initializeProfiles();
  }

  async orchestrate(
    profileName: string,
    options: Partial<SetupOptions> = {},
    progressCallback?: ProgressCallback
  ): Promise<SetupResult> {
    // Use new idempotent orchestrator
    return this.idempotentOrchestrator.orchestrate(profileName, {
      ...options,
      onProgress: progressCallback,
    });
  }

  // Keep existing methods for backward compatibility...
}
```

### Phase 4: Metadata Migration (Week 4-5)

#### 4.1 Migrate Existing State Files

Create migration utility:

```typescript
// packages/@wundr/computer-setup/src/lib/migrate-state.ts

export async function migrateFromOldState(
  oldStatePath: string,
  newMetadata: WundrMetadata
): Promise<WundrMetadata> {
  try {
    const oldState = JSON.parse(await fs.readFile(oldStatePath, 'utf-8'));

    // Map old state to new format
    newMetadata.components = oldState.completedSteps
      .filter(step => step.startsWith('install-'))
      .map(step => ({
        id: step.replace('install-', ''),
        name: step.replace('install-', ''),
        category: 'development',
        status: InstallationStatus.MANAGED,
        version: null, // Will be detected
        targetVersion: null,
        installPath: null, // Will be detected
        managedByWundr: true,
        installedAt: oldState.startTime,
        lastVerified: null,
        configPaths: [],
        dependencies: [],
        installHistory: [
          {
            timestamp: oldState.startTime,
            success: true,
            error: null,
            version: null,
            durationMs: 0,
          },
        ],
      }));

    // Mark migration in history
    newMetadata.setupHistory.push({
      timestamp: new Date().toISOString(),
      action: 'upgrade',
      components: ['state-migration'],
      success: true,
      durationMs: 0,
      error: null,
      initiatedBy: 'migration-script',
      sessionId: 'migration',
    });

    return newMetadata;
  } catch {
    return newMetadata;
  }
}
```

#### 4.2 Run Migration on First Use

```typescript
// In SystemStateManager.loadMetadata()
async loadMetadata(): Promise<WundrMetadata | null> {
  // Try new location first
  let metadata = await this.loadFromNewPath();

  if (!metadata) {
    // Check for old state file
    const oldState = await this.loadFromOldPath();
    if (oldState) {
      // Migrate
      metadata = await migrateFromOldState(
        OLD_STATE_PATH,
        createEmptyMetadata(this.platform)
      );
      await this.saveMetadata(metadata);

      // Optionally remove old file
      // await fs.unlink(OLD_STATE_PATH);
    }
  }

  return metadata;
}
```

### Phase 5: Testing & Validation (Week 5-6)

#### 5.1 Unit Tests

Create test files:

```
packages/@wundr/computer-setup/tests/lib/
  system-state.test.ts
  idempotent-operations.test.ts
  brownfield-handler.test.ts
```

Example test:

```typescript
// idempotent-operations.test.ts
describe('idempotentFileWrite', () => {
  it('should return changed: false when content matches', async () => {
    // Setup
    await fs.writeFile(testPath, 'content');

    // Execute
    const result = await idempotentFileWrite(testPath, 'content');

    // Verify
    expect(result.success).toBe(true);
    expect(result.changed).toBe(false);
    expect(result.outcome).toBe(OperationOutcome.NO_CHANGE);
  });

  it('should be idempotent on repeated calls', async () => {
    // Execute twice
    const result1 = await idempotentFileWrite(testPath, 'content');
    const result2 = await idempotentFileWrite(testPath, 'content');

    // First call should change
    expect(result1.changed).toBe(true);

    // Second call should not change
    expect(result2.changed).toBe(false);

    // File content should be identical
    const content = await fs.readFile(testPath, 'utf-8');
    expect(content).toBe('content');
  });
});
```

#### 5.2 Integration Tests

```typescript
// integration/setup-flow.test.ts
describe('Full Setup Flow', () => {
  it('should handle fresh install', async () => {
    const handler = new BrownfieldHandler(testPlatform);
    const state = await handler.detectSystemState();

    expect(state.environmentType).toBe(EnvironmentType.FRESH_INSTALL);
  });

  it('should detect user customizations', async () => {
    // Add custom alias to zshrc
    await fs.appendFile('~/.zshrc', '\nalias myalias="echo test"');

    const handler = new BrownfieldHandler(testPlatform);
    const customizations = await handler.detectUserCustomizations();

    expect(customizations).toContainEqual(expect.objectContaining({ type: 'shell_alias' }));
  });
});
```

#### 5.3 E2E Tests

- [ ] Test fresh install on clean VM
- [ ] Test upgrade from previous version
- [ ] Test preservation of user customizations
- [ ] Test rollback on failure
- [ ] Test resume from paused state

### Phase 6: Deprecation & Cleanup (Week 6-7)

#### 6.1 Mark Old Methods as Deprecated

```typescript
/**
 * @deprecated Use IdempotentSetupOrchestrator instead
 */
async legacyOrchestrate(...) {
  console.warn('legacyOrchestrate is deprecated. Use orchestrate() instead.');
  // ...
}
```

#### 6.2 Update Documentation

- Update README.md with new API
- Add migration guide for users
- Update CLAUDE.md with new commands

#### 6.3 Remove Old Code (Future)

In a future major version:

- Remove deprecated methods
- Remove old state file handling
- Remove backward compatibility code

## Rollback Plan

If issues are discovered after deployment:

1. **Immediate**: Revert to previous version via npm
2. **Short-term**: Keep old orchestrator as fallback
3. **Long-term**: Fix issues and re-deploy

## Success Criteria

- [ ] All existing tests pass
- [ ] New idempotent operation tests pass
- [ ] Integration tests pass on all platforms
- [ ] No breaking changes for existing users
- [ ] Performance is not degraded
- [ ] User customizations are preserved
- [ ] Rollback works correctly

## Timeline

| Week | Phase        | Deliverables                          |
| ---- | ------------ | ------------------------------------- |
| 1-2  | Foundation   | New modules, compilation, basic tests |
| 2-3  | Integration  | Updated installers, state manager     |
| 3-4  | Orchestrator | Idempotent orchestrator, migration    |
| 4-5  | Metadata     | State migration, compatibility        |
| 5-6  | Testing      | Full test coverage, E2E tests         |
| 6-7  | Cleanup      | Deprecation, documentation            |

## Risks & Mitigations

| Risk                       | Mitigation                                         |
| -------------------------- | -------------------------------------------------- |
| Breaking existing setups   | Maintain backward compatibility, extensive testing |
| Data loss during migration | Always backup before migration                     |
| Performance regression     | Benchmark before/after, optimize detection         |
| Complex rollback scenarios | Test rollback thoroughly, keep backups             |

## Appendix

### File Structure After Migration

```
packages/@wundr/computer-setup/
  src/
    lib/
      index.ts
      system-state.ts
      system-state-manager.ts
      idempotent-operations.ts
      brownfield-handler.ts
      migrate-state.ts
    installers/
      index.ts
      base-installer.ts (updated)
      node-installer.ts (updated)
      ...
    orchestrator/
      index.ts
      idempotent-orchestrator.ts
    ...
  docs/
    IDEMPOTENT_SETUP.md
  tests/
    lib/
      system-state.test.ts
      idempotent-operations.test.ts
      brownfield-handler.test.ts
    integration/
      setup-flow.test.ts
```

### Dependencies

No new dependencies required. Uses existing:

- `execa` - Command execution
- `fs-extra` - File operations
- `crypto` - Checksums

### Configuration

New environment variables (optional):

- `WUNDR_METADATA_PATH` - Override metadata location
- `WUNDR_BACKUP_PATH` - Override backup location
- `WUNDR_DRY_RUN` - Force dry-run mode
