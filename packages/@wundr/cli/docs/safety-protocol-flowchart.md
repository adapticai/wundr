# Safety & Rollback System - Protocol Flowchart

## Overview

This document describes the safety protocol flowchart for the Wundr CLI update system. The system provides comprehensive backup, validation, and rollback capabilities to ensure safe project updates.

## Safety Protocol Flowchart

```
                                    START
                                      |
                                      v
                    +----------------------------------+
                    |      PREFLIGHT VALIDATION        |
                    |  (ValidationSuite.runPreflight)  |
                    +----------------------------------+
                              |
                    +---------+---------+
                    |                   |
                    v                   v
            [PASS]                 [FAIL]
                    |                   |
                    v                   v
    +-------------------+      +------------------+
    |   Continue with   |      |  Report Blockers |
    |   Update Process  |      |  and Exit        |
    +-------------------+      +------------------+
            |
            v
    +----------------------------------+
    |      CREATE BACKUP               |
    |   (SafetyManager.createBackup)   |
    |   -> .wundr-backup-{timestamp}/  |
    +----------------------------------+
            |
            +---------+
            |         |
            v         v
      [SUCCESS]   [FAIL]
            |         |
            v         v
    +----------+  +------------------+
    | Continue |  | Abort with Error |
    +----------+  +------------------+
            |
            v
    +----------------------------------+
    |    VERIFY BACKUP INTEGRITY       |
    |  (SafetyManager.verifyBackup)    |
    |   - Check file checksums         |
    |   - Validate manifest            |
    +----------------------------------+
            |
            +---------+
            |         |
            v         v
      [VALID]    [INVALID]
            |         |
            v         v
    +----------+  +------------------+
    | Continue |  | Re-create Backup |
    |          |  | or Abort         |
    +----------+  +------------------+
            |
            v
    +----------------------------------+
    |     CREATE CHECKPOINT            |
    |  (RollbackManager.createCheckpoint)
    |   - Save rollback point          |
    |   - Link to parent checkpoint    |
    +----------------------------------+
            |
            v
    +----------------------------------+
    |     START TRANSACTION            |
    | (SafetyManager.startTransaction) |
    +----------------------------------+
            |
            v
    +----------------------------------+
    |    INCREMENTAL UPDATE            |
    |    WITH ROLLBACK POINTS          |
    +----------------------------------+
            |
            |  For each update operation:
            v
    +----------------------------------+
    |    EXECUTE UPDATE OPERATION      |
    |    - Record operation            |
    |    - Create sub-checkpoint       |
    +----------------------------------+
            |
            +---------+
            |         |
            v         v
      [SUCCESS]   [FAIL]
            |         |
            |         v
            |   +------------------+
            |   | ROLLBACK TO      |
            |   | LAST CHECKPOINT  |
            |   | (RollbackManager.|
            |   |  rollback)       |
            |   +------------------+
            |         |
            |         v
            |   +------------------+
            |   | Report Error and |
            |   | Rollback Status  |
            |   +------------------+
            |
            v
    +----------------------------------+
    |    POST-UPDATE VALIDATION        |
    | (ValidationSuite.runPostUpdate)  |
    |   - Verify file integrity        |
    |   - Check dependencies           |
    |   - Run tests (optional)         |
    +----------------------------------+
            |
            +---------+
            |         |
            v         v
      [PASS]     [FAIL]
            |         |
            v         v
    +----------+  +------------------+
    | Commit   |  | Auto-Rollback    |
    | Trans-   |  | to Pre-Update    |
    | action   |  | State            |
    +----------+  +------------------+
            |
            v
    +----------------------------------+
    |    GENERATE MIGRATION REPORT     |
    | (RollbackManager.generateReport) |
    |   -> .wundr-update.log           |
    +----------------------------------+
            |
            v
    +----------------------------------+
    |    CLEANUP OLD BACKUPS           |
    | (SafetyManager.cleanupOldBackups)|
    |   - Retain max N backups         |
    +----------------------------------+
            |
            v
                      END
```

## Components

### 1. SafetyMechanisms (safety-mechanisms.ts)

Primary backup and restore functionality:

- **createBackup()**: Creates full backup to `.wundr-backup-{timestamp}/`
- **restoreFromBackup()**: Restores files from a backup
- **verifyBackup()**: Validates backup integrity with checksums
- **listBackups()**: Lists all available backups
- **deleteBackup()**: Removes a specific backup
- **cleanupOldBackups()**: Removes old backups (default: retain 5)

### 2. RollbackManager (rollback-manager.ts)

Checkpoint-based rollback system:

- **createCheckpoint()**: Creates a named checkpoint with backup
- **rollback()**: Rolls back to a specific checkpoint
- **listCheckpoints()**: Lists all checkpoints
- **validateCheckpoint()**: Validates checkpoint integrity
- **getRollbackChain()**: Gets chain of checkpoints
- **generateMigrationReport()**: Generates JSON report

### 3. ValidationSuite (validation-suite.ts)

Pre and post-update validation:

- **runPreflightChecks()**: Runs preflight validation
  - Directory exists
  - Disk space available
  - Write permissions
  - Required files exist
  - Environment variables set
  - Node.js version
  - Package manager availability

- **runPostUpdateValidation()**: Post-update checks
  - File integrity
  - Package.json validity
  - Configuration files
  - Dependencies resolved

- **quickHealthCheck()**: Fast health check
- **validateFiles()**: Validate specific files
- **generateReport()**: Generate formatted report

## Update Transaction Flow

```
1. START TRANSACTION
   |
   v
2. RECORD OPERATION (type, path, backupRef)
   |
   v
3. EXECUTE OPERATION
   |
   +---> SUCCESS: completeOperation(path)
   |
   +---> FAILURE: failOperation(path, error)
   |              -> Transaction.rollback()
   |
   v
4. COMMIT TRANSACTION
   - All operations completed successfully
   - Transaction marked as complete
```

## Rollback Protocol

```
1. IDENTIFY TARGET CHECKPOINT
   |
   v
2. VERIFY BACKUP INTEGRITY (unless force=true)
   |
   v
3. CREATE PRE-ROLLBACK BACKUP
   |
   v
4. RESTORE FILES FROM BACKUP
   - For each file:
     - Create directory structure
     - Copy from backup
     - Restore permissions
   |
   v
5. UPDATE CHECKPOINT STATUS (rolled_back)
   |
   v
6. REPORT RESULTS
```

## Backup Directory Structure

```
project-root/
├── .wundr-backup-2024-01-15T10-30-00/
│   ├── manifest.json
│   ├── src/
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
├── .wundr/
│   ├── checkpoints/
│   │   └── checkpoints.json
│   └── rollback-backups/
│       └── .wundr-backup-{id}/
└── .wundr-update.log
```

## Configuration Options

### SafetyOptions

```typescript
{
  projectRoot: string;      // Project root path
  backupDir?: string;       // Custom backup directory
  compress?: boolean;       // Compress backups (gzip)
  maxBackups?: number;      // Max backups to retain (default: 5)
  skipBackup?: boolean;     // Skip backup creation
  verifyBackup?: boolean;   // Verify backup integrity (default: true)
  createRollbackPoints?: boolean; // Create rollback points (default: true)
  dryRun?: boolean;         // Dry run mode
}
```

### PreflightConfig

```typescript
{
  checkDiskSpace?: boolean;      // Check disk space (default: true)
  minDiskSpaceMB?: number;       // Min disk space in MB (default: 100)
  checkPermissions?: boolean;    // Check permissions (default: true)
  checkDependencies?: boolean;   // Check dependencies (default: true)
  checkNetwork?: boolean;        // Check network (default: false)
  checkNodeVersion?: boolean;    // Check Node.js version (default: true)
  checkPackageManager?: boolean; // Check npm/pnpm (default: true)
  requiredFiles?: string[];      // Required files
  requiredDirs?: string[];       // Required directories
  requiredEnvVars?: string[];    // Required env vars
  customChecks?: CustomCheck[];  // Custom validation functions
}
```

## Error Handling

The system implements automatic rollback on failure:

1. **Preflight Failure**: Operation aborted before any changes
2. **Backup Failure**: Operation aborted, no changes made
3. **Update Failure**: Automatic rollback to last checkpoint
4. **Post-Update Failure**: Automatic rollback to pre-update state

## Logging

All operations are logged to `.wundr-update.log`:

```
[2024-01-15T10:30:00.000Z] [BACKUP] [INFO] Creating backup: backup-123
[2024-01-15T10:30:01.000Z] [BACKUP] [INFO] Backup created: backup-123
[2024-01-15T10:30:02.000Z] [ROLLBACK] [INFO] Creating checkpoint: Initial state
[2024-01-15T10:30:03.000Z] [VALIDATION] [INFO] Starting preflight checks
```

## Test Coverage

The test suite (`safety-mechanisms.test.ts`) covers:

- SafetyManager
  - Backup creation and restoration
  - Checksum calculation and verification
  - Backup listing and deletion
  - Rollback point creation
  - Transaction management

- RollbackManager
  - Checkpoint creation and chain tracking
  - Dry run and actual rollback
  - Checkpoint validation and deletion

- ValidationSuite
  - Preflight checks
  - Post-update validation
  - Health checks
  - Report generation

All 35 tests pass successfully.
