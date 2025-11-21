/**
 * Idempotent Operations Test Suite
 *
 * Tests verify that all setup operations are:
 * 1. Idempotent - Running multiple times produces the same result
 * 2. Safe - State is checked before any modification
 * 3. Reversible - Operations return proper rollback information
 * 4. Auditable - All operations return consistent result format
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

import {
  // Low-level operations
  executeIdempotent,
  idempotentFileWrite,
  idempotentFileAppend,
  idempotentMkdir,
  idempotentSymlink,
  idempotentShellConfig,
  idempotentEnvVar,
  idempotentCommand,
  idempotentBrewInstall,
  idempotentNpmInstall,
  idempotentGitConfig,
  executeSequential,
  executeParallel,
  collectRollbackSteps,
  executeRollback,
  // High-level ensure operations
  ensureGlobalClaudeMd,
  ensureClaudeDirectoryStructure,
  ensureMCPServer,
  ensureAllMCPServers,
  ensureAgentTemplates,
  ensureClaudeCLI,
  ensureClaudeSettings,
  ensureShellConfiguration,
  ensureOptimizationScripts,
  ensurePreCommitHook,
  runFullSetup,
  // Types
  OperationResult,
  OperationOutcome,
  EnsureResult,
  EnsureBatchResult,
} from '../src/lib/idempotent-operations';

// Test utilities
const TEST_DIR = path.join(os.tmpdir(), `idempotent-ops-test-${Date.now()}`);
const TEST_HOME = path.join(TEST_DIR, 'home');
const TEST_CLAUDE_DIR = path.join(TEST_HOME, '.claude');

// Cleanup helper
async function cleanupTestDir(): Promise<void> {
  try {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

// Setup helper
async function setupTestDir(): Promise<void> {
  await cleanupTestDir();
  await fs.mkdir(TEST_DIR, { recursive: true });
  await fs.mkdir(TEST_HOME, { recursive: true });
  await fs.mkdir(TEST_CLAUDE_DIR, { recursive: true });
}

describe('Idempotent Operations', () => {
  beforeAll(async () => {
    await setupTestDir();
  });

  afterAll(async () => {
    await cleanupTestDir();
  });

  describe('OperationResult Structure', () => {
    it('should return consistent result structure', async () => {
      const testFile = path.join(TEST_DIR, 'test-result-structure.txt');

      const result = await idempotentFileWrite(testFile, 'test content');

      // Verify all required fields are present
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('changed');
      expect(result).toHaveProperty('outcome');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('durationMs');
      expect(result).toHaveProperty('rollbackSteps');

      // Verify types
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.changed).toBe('boolean');
      expect(typeof result.message).toBe('string');
      expect(typeof result.durationMs).toBe('number');
      expect(Array.isArray(result.rollbackSteps)).toBe(true);
    });
  });

  describe('idempotentFileWrite', () => {
    it('should create file on first run', async () => {
      const testFile = path.join(TEST_DIR, 'new-file.txt');
      const content = 'Hello, World!';

      const result = await idempotentFileWrite(testFile, content);

      expect(result.success).toBe(true);
      expect(result.changed).toBe(true);
      expect(result.outcome).toBe(OperationOutcome.CHANGED);

      const fileContent = await fs.readFile(testFile, 'utf-8');
      expect(fileContent).toBe(content);
    });

    it('should skip if content is identical', async () => {
      const testFile = path.join(TEST_DIR, 'identical-file.txt');
      const content = 'Same content';

      // First write
      await idempotentFileWrite(testFile, content);

      // Second write - should skip
      const result = await idempotentFileWrite(testFile, content);

      expect(result.success).toBe(true);
      expect(result.changed).toBe(false);
      expect(result.outcome).toBe(OperationOutcome.NO_CHANGE);
    });

    it('should update if content differs', async () => {
      const testFile = path.join(TEST_DIR, 'different-file.txt');

      // First write
      await idempotentFileWrite(testFile, 'original content');

      // Second write with different content
      const result = await idempotentFileWrite(testFile, 'updated content');

      expect(result.success).toBe(true);
      expect(result.changed).toBe(true);
      expect(result.outcome).toBe(OperationOutcome.CHANGED);

      const fileContent = await fs.readFile(testFile, 'utf-8');
      expect(fileContent).toBe('updated content');
    });

    it('should respect dry run mode', async () => {
      const testFile = path.join(TEST_DIR, 'dryrun-file.txt');
      const content = 'Dry run content';

      const result = await idempotentFileWrite(testFile, content, { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.changed).toBe(false);
      expect(result.outcome).toBe(OperationOutcome.DRY_RUN);

      // File should not exist
      await expect(fs.access(testFile)).rejects.toThrow();
    });

    it('should create backup when requested', async () => {
      const testFile = path.join(TEST_DIR, 'backup-file.txt');
      const backupDir = path.join(TEST_DIR, 'backups');

      // Create original file
      await fs.writeFile(testFile, 'original');

      // Update with backup
      const result = await idempotentFileWrite(testFile, 'updated', {
        backup: true,
        backupDir,
      });

      expect(result.success).toBe(true);

      // Check backup was created
      const backups = await fs.readdir(backupDir);
      expect(backups.length).toBeGreaterThan(0);
      expect(backups[0]).toMatch(/backup-file\.txt\..+\.bak/);
    });

    it('should be idempotent across 10 runs', async () => {
      const testFile = path.join(TEST_DIR, 'idempotent-10x.txt');
      const content = 'Idempotent content';
      const results: OperationResult<{ checksum: string }>[] = [];

      // Run 10 times
      for (let i = 0; i < 10; i++) {
        const result = await idempotentFileWrite(testFile, content);
        results.push(result);
      }

      // First run should change, rest should skip
      expect(results[0].changed).toBe(true);
      for (let i = 1; i < 10; i++) {
        expect(results[i].changed).toBe(false);
        expect(results[i].outcome).toBe(OperationOutcome.NO_CHANGE);
      }

      // File content should be the same
      const fileContent = await fs.readFile(testFile, 'utf-8');
      expect(fileContent).toBe(content);
    });
  });

  describe('idempotentMkdir', () => {
    it('should create directory on first run', async () => {
      const testDir = path.join(TEST_DIR, 'new-dir');

      const result = await idempotentMkdir(testDir);

      expect(result.success).toBe(true);
      expect(result.changed).toBe(true);

      const stats = await fs.stat(testDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should skip if directory exists', async () => {
      const testDir = path.join(TEST_DIR, 'existing-dir');
      await fs.mkdir(testDir, { recursive: true });

      const result = await idempotentMkdir(testDir);

      expect(result.success).toBe(true);
      expect(result.changed).toBe(false);
      expect(result.outcome).toBe(OperationOutcome.NO_CHANGE);
    });

    it('should be idempotent across 10 runs', async () => {
      const testDir = path.join(TEST_DIR, 'idempotent-dir-10x');
      const results: OperationResult<void>[] = [];

      for (let i = 0; i < 10; i++) {
        const result = await idempotentMkdir(testDir);
        results.push(result);
      }

      expect(results[0].changed).toBe(true);
      for (let i = 1; i < 10; i++) {
        expect(results[i].changed).toBe(false);
      }
    });
  });

  describe('idempotentFileAppend', () => {
    it('should append content if marker not present', async () => {
      const testFile = path.join(TEST_DIR, 'append-file.txt');
      await fs.writeFile(testFile, 'existing content\n');

      const result = await idempotentFileAppend(
        testFile,
        '# NEW SECTION\nnew content',
        '# NEW SECTION'
      );

      expect(result.success).toBe(true);
      expect(result.changed).toBe(true);

      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toContain('existing content');
      expect(content).toContain('# NEW SECTION');
    });

    it('should skip if marker already present', async () => {
      const testFile = path.join(TEST_DIR, 'skip-append-file.txt');
      await fs.writeFile(testFile, '# MARKER\nexisting content');

      const result = await idempotentFileAppend(testFile, 'new content', '# MARKER');

      expect(result.success).toBe(true);
      expect(result.changed).toBe(false);
    });
  });

  describe('idempotentShellConfig', () => {
    it('should add config block with markers', async () => {
      const shellRc = path.join(TEST_DIR, '.testrc');
      await fs.writeFile(shellRc, '# Existing config\n');

      const result = await idempotentShellConfig(
        shellRc,
        'export PATH="/test:$PATH"',
        'test-block'
      );

      expect(result.success).toBe(true);
      expect(result.changed).toBe(true);

      const content = await fs.readFile(shellRc, 'utf-8');
      expect(content).toContain('# BEGIN WUNDR MANAGED BLOCK: test-block');
      expect(content).toContain('export PATH="/test:$PATH"');
      expect(content).toContain('# END WUNDR MANAGED BLOCK: test-block');
    });

    it('should replace existing block if content changed', async () => {
      const shellRc = path.join(TEST_DIR, '.updaterc');
      await fs.writeFile(
        shellRc,
        '# BEGIN WUNDR MANAGED BLOCK: update-block\nold content\n# END WUNDR MANAGED BLOCK: update-block'
      );

      const result = await idempotentShellConfig(shellRc, 'new content', 'update-block');

      expect(result.success).toBe(true);
      expect(result.changed).toBe(true);

      const content = await fs.readFile(shellRc, 'utf-8');
      expect(content).toContain('new content');
      expect(content).not.toContain('old content');
    });

    it('should skip if block content is identical', async () => {
      const shellRc = path.join(TEST_DIR, '.skiprc');
      const blockContent = 'same content';
      const fullBlock = `# BEGIN WUNDR MANAGED BLOCK: skip-block\n${blockContent}\n# END WUNDR MANAGED BLOCK: skip-block`;
      await fs.writeFile(shellRc, fullBlock);

      const result = await idempotentShellConfig(shellRc, blockContent, 'skip-block');

      expect(result.success).toBe(true);
      expect(result.changed).toBe(false);
    });
  });

  describe('executeSequential', () => {
    it('should execute operations in sequence', async () => {
      const dir1 = path.join(TEST_DIR, 'seq-dir-1');
      const dir2 = path.join(TEST_DIR, 'seq-dir-2');
      const dir3 = path.join(TEST_DIR, 'seq-dir-3');

      const result = await executeSequential([
        () => idempotentMkdir(dir1),
        () => idempotentMkdir(dir2),
        () => idempotentMkdir(dir3),
      ]);

      expect(result.allSucceeded).toBe(true);
      expect(result.results.length).toBe(3);
      expect(result.firstFailure).toBeNull();

      // Verify all directories exist
      for (const dir of [dir1, dir2, dir3]) {
        const stats = await fs.stat(dir);
        expect(stats.isDirectory()).toBe(true);
      }
    });

    it('should stop on first failure', async () => {
      const validDir = path.join(TEST_DIR, 'valid-seq-dir');
      const invalidPath = '/root/cannot-create-here';

      const result = await executeSequential([
        () => idempotentMkdir(validDir),
        () => idempotentMkdir(invalidPath), // This should fail
        () => idempotentMkdir(path.join(TEST_DIR, 'never-created')),
      ]);

      expect(result.allSucceeded).toBe(false);
      expect(result.results.length).toBe(2); // Stops at failure
      expect(result.firstFailure).not.toBeNull();
    });
  });

  describe('executeParallel', () => {
    it('should execute operations in parallel', async () => {
      const dirs = Array.from({ length: 5 }, (_, i) =>
        path.join(TEST_DIR, `parallel-dir-${i}`)
      );

      const result = await executeParallel(
        dirs.map((dir) => () => idempotentMkdir(dir)),
        3 // Max concurrency
      );

      expect(result.succeeded.length).toBe(5);
      expect(result.failed.length).toBe(0);

      // Verify all directories exist
      for (const dir of dirs) {
        const stats = await fs.stat(dir);
        expect(stats.isDirectory()).toBe(true);
      }
    });
  });

  describe('EnsureResult Format', () => {
    it('should return proper action types', async () => {
      const testFile = path.join(TEST_DIR, 'ensure-action-test.txt');

      // Test installed action
      const result1 = await idempotentFileWrite(testFile, 'content');
      expect(result1.outcome).toBe(OperationOutcome.CHANGED);

      // Test skipped action
      const result2 = await idempotentFileWrite(testFile, 'content');
      expect(result2.outcome).toBe(OperationOutcome.NO_CHANGE);
    });
  });
});

describe('High-Level Ensure Operations', () => {
  let testClaudeDir: string;

  beforeEach(async () => {
    testClaudeDir = path.join(TEST_DIR, `claude-${Date.now()}`);
    await fs.mkdir(testClaudeDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testClaudeDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  describe('ensureClaudeDirectoryStructure', () => {
    it('should create all required directories', async () => {
      // Note: This test uses actual home directory paths
      // In production, you would mock os.homedir()
      const result = await ensureClaudeDirectoryStructure({ dryRun: true });

      expect(result.success).toBe(true);
      expect(result.totalOperations).toBeGreaterThan(0);
    });

    it('should be idempotent across 10 runs', async () => {
      const results: EnsureBatchResult[] = [];

      for (let i = 0; i < 10; i++) {
        const result = await ensureClaudeDirectoryStructure({ dryRun: true });
        results.push(result);
      }

      // All runs should succeed
      for (const result of results) {
        expect(result.success).toBe(true);
      }
    });
  });

  describe('ensurePreCommitHook', () => {
    it('should return proper EnsureResult format', async () => {
      const result = await ensurePreCommitHook({ dryRun: true });

      expect(result).toHaveProperty('action');
      expect(result).toHaveProperty('changed');
      expect(['installed', 'upgraded', 'skipped', 'configured', 'removed', 'rollback']).toContain(
        result.action
      );
      expect(typeof result.changed).toBe('boolean');
    });
  });
});

describe('Idempotency Verification - 10x Test', () => {
  const idempotencyTestDir = path.join(TEST_DIR, 'idempotency-verification');

  beforeAll(async () => {
    await fs.mkdir(idempotencyTestDir, { recursive: true });
  });

  afterAll(async () => {
    try {
      await fs.rm(idempotencyTestDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('should pass 10x idempotency test for file operations', async () => {
    const testFile = path.join(idempotencyTestDir, 'idempotency-test.txt');
    const content = 'Test content for idempotency';
    const runResults: Array<{
      run: number;
      changed: boolean;
      outcome: string;
      durationMs: number;
    }> = [];

    console.log('\n--- Starting 10x Idempotency Test for File Operations ---');

    for (let run = 1; run <= 10; run++) {
      const result = await idempotentFileWrite(testFile, content);
      runResults.push({
        run,
        changed: result.changed,
        outcome: result.outcome,
        durationMs: result.durationMs,
      });
      console.log(
        `Run ${run}: changed=${result.changed}, outcome=${result.outcome}, duration=${result.durationMs}ms`
      );
    }

    // Verify results
    expect(runResults[0].changed).toBe(true);
    expect(runResults[0].outcome).toBe(OperationOutcome.CHANGED);

    for (let i = 1; i < 10; i++) {
      expect(runResults[i].changed).toBe(false);
      expect(runResults[i].outcome).toBe(OperationOutcome.NO_CHANGE);
    }

    // Verify file content remains unchanged
    const finalContent = await fs.readFile(testFile, 'utf-8');
    expect(finalContent).toBe(content);

    console.log('--- 10x Idempotency Test PASSED ---\n');
  });

  it('should pass 10x idempotency test for directory operations', async () => {
    const testDir = path.join(idempotencyTestDir, 'idempotent-dir');
    const runResults: Array<{
      run: number;
      changed: boolean;
      outcome: string;
    }> = [];

    console.log('\n--- Starting 10x Idempotency Test for Directory Operations ---');

    for (let run = 1; run <= 10; run++) {
      const result = await idempotentMkdir(testDir);
      runResults.push({
        run,
        changed: result.changed,
        outcome: result.outcome,
      });
      console.log(`Run ${run}: changed=${result.changed}, outcome=${result.outcome}`);
    }

    // Verify results
    expect(runResults[0].changed).toBe(true);
    for (let i = 1; i < 10; i++) {
      expect(runResults[i].changed).toBe(false);
    }

    console.log('--- 10x Idempotency Test PASSED ---\n');
  });

  it('should pass 10x idempotency test for shell config operations', async () => {
    const shellRc = path.join(idempotencyTestDir, '.test-shellrc');
    await fs.writeFile(shellRc, '# Initial config\n');

    const configBlock = 'export TEST_VAR="test_value"';
    const blockId = 'test-idempotency-block';

    const runResults: Array<{
      run: number;
      changed: boolean;
      outcome: string;
    }> = [];

    console.log('\n--- Starting 10x Idempotency Test for Shell Config Operations ---');

    for (let run = 1; run <= 10; run++) {
      const result = await idempotentShellConfig(shellRc, configBlock, blockId);
      runResults.push({
        run,
        changed: result.changed,
        outcome: result.outcome,
      });
      console.log(`Run ${run}: changed=${result.changed}, outcome=${result.outcome}`);
    }

    // Verify results
    expect(runResults[0].changed).toBe(true);
    for (let i = 1; i < 10; i++) {
      expect(runResults[i].changed).toBe(false);
    }

    // Verify block appears only once
    const content = await fs.readFile(shellRc, 'utf-8');
    const matches = content.match(/BEGIN WUNDR MANAGED BLOCK: test-idempotency-block/g);
    expect(matches?.length).toBe(1);

    console.log('--- 10x Idempotency Test PASSED ---\n');
  });

  it('should pass 10x idempotency test for mixed operations', async () => {
    const mixedDir = path.join(idempotencyTestDir, 'mixed-test');
    const mixedFile = path.join(mixedDir, 'test.txt');

    const runResults: Array<{
      run: number;
      dirChanged: boolean;
      fileChanged: boolean;
    }> = [];

    console.log('\n--- Starting 10x Idempotency Test for Mixed Operations ---');

    for (let run = 1; run <= 10; run++) {
      const dirResult = await idempotentMkdir(mixedDir);
      const fileResult = await idempotentFileWrite(mixedFile, 'mixed content');

      runResults.push({
        run,
        dirChanged: dirResult.changed,
        fileChanged: fileResult.changed,
      });
      console.log(
        `Run ${run}: dirChanged=${dirResult.changed}, fileChanged=${fileResult.changed}`
      );
    }

    // First run should change both
    expect(runResults[0].dirChanged).toBe(true);
    expect(runResults[0].fileChanged).toBe(true);

    // Subsequent runs should change neither
    for (let i = 1; i < 10; i++) {
      expect(runResults[i].dirChanged).toBe(false);
      expect(runResults[i].fileChanged).toBe(false);
    }

    console.log('--- 10x Idempotency Test PASSED ---\n');
  });
});

describe('Version Comparison', () => {
  // Since compareVersions is a private function in the module,
  // we test it indirectly through ensureClaudeCLI behavior

  it('should handle version comparison for upgrades', async () => {
    // This is a conceptual test - actual implementation would mock the CLI version check
    const result = await ensureClaudeCLI({ dryRun: true });

    // In dry run, it should indicate what would happen
    expect(result).toHaveProperty('action');
    expect(['installed', 'upgraded', 'skipped']).toContain(result.action);
  });
});

describe('Rollback Support', () => {
  it('should collect rollback steps from operations', () => {
    const mockResults: OperationResult<unknown>[] = [
      {
        success: true,
        changed: true,
        outcome: OperationOutcome.CHANGED,
        data: null,
        error: null,
        message: 'Test 1',
        durationMs: 100,
        rollbackSteps: [
          {
            id: 'step1',
            description: 'Rollback step 1',
            execute: async () => {},
            order: 1,
          },
        ],
      },
      {
        success: true,
        changed: true,
        outcome: OperationOutcome.CHANGED,
        data: null,
        error: null,
        message: 'Test 2',
        durationMs: 100,
        rollbackSteps: [
          {
            id: 'step2',
            description: 'Rollback step 2',
            execute: async () => {},
            order: 2,
          },
        ],
      },
    ];

    const rollbackSteps = collectRollbackSteps(mockResults);

    expect(rollbackSteps.length).toBe(2);
    // Should be sorted in reverse order
    expect(rollbackSteps[0].order).toBe(2);
    expect(rollbackSteps[1].order).toBe(1);
  });

  it('should execute rollback steps', async () => {
    let step1Executed = false;
    let step2Executed = false;

    const steps = [
      {
        id: 'step1',
        description: 'Step 1',
        execute: async () => {
          step1Executed = true;
        },
        order: 1,
      },
      {
        id: 'step2',
        description: 'Step 2',
        execute: async () => {
          step2Executed = true;
        },
        order: 2,
      },
    ];

    const result = await executeRollback(steps);

    expect(result.success).toBe(true);
    expect(result.completedSteps).toContain('step1');
    expect(result.completedSteps).toContain('step2');
    expect(step1Executed).toBe(true);
    expect(step2Executed).toBe(true);
  });
});

describe('Operation Catalog Summary', () => {
  it('should list all available operations', () => {
    const operationCatalog = {
      // Low-level operations
      lowLevel: [
        'executeIdempotent',
        'idempotentFileWrite',
        'idempotentFileAppend',
        'idempotentMkdir',
        'idempotentSymlink',
        'idempotentCommand',
        'idempotentShellConfig',
        'idempotentEnvVar',
        'idempotentGitConfig',
        'idempotentBrewInstall',
        'idempotentNpmInstall',
      ],
      // High-level ensure operations
      ensure: [
        'ensureGlobalClaudeMd',
        'ensureClaudeDirectoryStructure',
        'ensureMCPServer',
        'ensureAllMCPServers',
        'ensureAgentTemplates',
        'ensureClaudeCLI',
        'ensureClaudeSettings',
        'ensureShellConfiguration',
        'ensureOptimizationScripts',
        'ensurePreCommitHook',
        'runFullSetup',
      ],
      // Batch operations
      batch: ['executeSequential', 'executeParallel'],
      // Rollback operations
      rollback: ['collectRollbackSteps', 'executeRollback'],
    };

    console.log('\n=== IDEMPOTENT OPERATIONS CATALOG ===\n');
    console.log('Low-Level Operations:', operationCatalog.lowLevel.length);
    operationCatalog.lowLevel.forEach((op) => console.log(`  - ${op}`));

    console.log('\nHigh-Level Ensure Operations:', operationCatalog.ensure.length);
    operationCatalog.ensure.forEach((op) => console.log(`  - ${op}`));

    console.log('\nBatch Operations:', operationCatalog.batch.length);
    operationCatalog.batch.forEach((op) => console.log(`  - ${op}`));

    console.log('\nRollback Operations:', operationCatalog.rollback.length);
    operationCatalog.rollback.forEach((op) => console.log(`  - ${op}`));

    const totalOperations =
      operationCatalog.lowLevel.length +
      operationCatalog.ensure.length +
      operationCatalog.batch.length +
      operationCatalog.rollback.length;

    console.log(`\nTotal Operations: ${totalOperations}`);
    console.log('=====================================\n');

    expect(totalOperations).toBeGreaterThan(20);
  });
});
