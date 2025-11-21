/**
 * Integration tests for computer-setup with Claude Code configuration
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import { BackupRollbackManager } from '../utils/backup-rollback-manager';
import { ClaudeConfigInstaller } from '../utils/claude-config-installer';

describe('Computer Setup Integration Tests', () => {
  const testDir = path.join(__dirname, '.test-temp');
  const backupDir = path.join(testDir, 'backups');
  const claudeDir = path.join(testDir, '.claude');

  beforeEach(async () => {
    // Create test directories
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(backupDir, { recursive: true });
    await fs.mkdir(claudeDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directories
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('BackupRollbackManager', () => {
    let backupManager: BackupRollbackManager;

    beforeEach(async () => {
      backupManager = new BackupRollbackManager(backupDir);
      await backupManager.initialize();
    });

    it('should initialize backup directory', async () => {
      expect(existsSync(backupDir)).toBe(true);
    });

    it('should create backup of files', async () => {
      // Create test files
      const testFile1 = path.join(testDir, 'test1.txt');
      const testFile2 = path.join(testDir, 'test2.txt');
      await fs.writeFile(testFile1, 'content1');
      await fs.writeFile(testFile2, 'content2');

      // Create backup
      const metadata = await backupManager.createBackup(
        [testFile1, testFile2],
        'Test backup'
      );

      expect(metadata.success).toBe(true);
      expect(metadata.files).toHaveLength(2);
      expect(metadata.backupId).toBeTruthy();

      // Verify backup files exist
      for (const file of metadata.files) {
        expect(existsSync(file.backupPath)).toBe(true);
      }
    });

    it('should list backups', async () => {
      // Create test file and backup
      const testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, 'content');

      await backupManager.createBackup([testFile], 'Backup 1');
      await backupManager.createBackup([testFile], 'Backup 2');

      const backups = await backupManager.listBackups();
      expect(backups.length).toBeGreaterThanOrEqual(2);
    });

    it('should restore files from backup', async () => {
      // Create original file
      const testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, 'original content');

      // Create backup
      const metadata = await backupManager.createBackup([testFile], 'Test backup');

      // Modify file
      await fs.writeFile(testFile, 'modified content');

      // Restore from backup
      const success = await backupManager.rollback({
        backupId: metadata.backupId,
        dryRun: false,
      });

      expect(success).toBe(true);

      // Verify content restored
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe('original content');
    });

    it('should verify backup integrity', async () => {
      // Create test file and backup
      const testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, 'content');

      const metadata = await backupManager.createBackup([testFile], 'Test backup');

      const isValid = await backupManager.verifyBackup(metadata.backupId);
      expect(isValid).toBe(true);
    });

    it('should clean up old backups', async () => {
      // Create multiple backups
      const testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, 'content');

      for (let i = 0; i < 10; i++) {
        await backupManager.createBackup([testFile], `Backup ${i}`);
      }

      // Clean up, keeping only 5
      await backupManager.cleanupOldBackups(5);

      const backups = await backupManager.listBackups();
      expect(backups.length).toBeLessThanOrEqual(5);
    });

    it('should handle dry-run rollback', async () => {
      const testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, 'original');

      const metadata = await backupManager.createBackup([testFile], 'Test');

      await fs.writeFile(testFile, 'modified');

      const success = await backupManager.rollback({
        backupId: metadata.backupId,
        dryRun: true,
      });

      expect(success).toBe(true);

      // File should not be restored in dry-run
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe('modified');
    });
  });

  describe('ClaudeConfigInstaller', () => {
    let installer: ClaudeConfigInstaller;

    beforeEach(async () => {
      installer = new ClaudeConfigInstaller({
        claudeDir,
        sourceDir: testDir,
      });
      await installer.initialize();

      // Create mock CLAUDE.md
      await fs.writeFile(
        path.join(testDir, 'CLAUDE.md'),
        '# Claude Configuration\nTest content'
      );
    });

    it('should initialize directory structure', async () => {
      expect(existsSync(claudeDir)).toBe(true);
      expect(existsSync(path.join(claudeDir, 'hooks'))).toBe(true);
      expect(existsSync(path.join(claudeDir, 'agents'))).toBe(true);
      expect(existsSync(path.join(claudeDir, 'workflows'))).toBe(true);
      expect(existsSync(path.join(claudeDir, 'scripts'))).toBe(true);
    });

    it('should install CLAUDE.md', async () => {
      const result = await installer.install({
        dryRun: false,
        skipBackup: true,
      });

      expect(result.success).toBe(true);
      expect(result.installed).toContain('CLAUDE.md');
      expect(existsSync(path.join(claudeDir, 'CLAUDE.md'))).toBe(true);
    });

    it('should install hooks', async () => {
      const result = await installer.install({
        dryRun: false,
        skipBackup: true,
      });

      expect(result.success).toBe(true);

      const hooksDir = path.join(claudeDir, 'hooks');
      expect(existsSync(path.join(hooksDir, 'pre-commit'))).toBe(true);
      expect(existsSync(path.join(hooksDir, 'post-checkout'))).toBe(true);
    });

    it('should install conventions', async () => {
      const result = await installer.install({
        dryRun: false,
        skipBackup: true,
      });

      expect(result.success).toBe(true);
      expect(result.installed).toContain('conventions.json');

      const conventionsPath = path.join(claudeDir, 'conventions.json');
      expect(existsSync(conventionsPath)).toBe(true);

      const conventions = JSON.parse(await fs.readFile(conventionsPath, 'utf-8'));
      expect(conventions).toHaveProperty('fileNaming');
      expect(conventions).toHaveProperty('codeStyle');
    });

    it('should install agent templates', async () => {
      const result = await installer.install({
        dryRun: false,
        skipBackup: true,
      });

      expect(result.success).toBe(true);

      const agentsDir = path.join(claudeDir, 'agents');
      expect(existsSync(path.join(agentsDir, 'backend-developer.json'))).toBe(true);
      expect(existsSync(path.join(agentsDir, 'frontend-developer.json'))).toBe(true);
      expect(existsSync(path.join(agentsDir, 'fullstack-developer.json'))).toBe(true);
    });

    it('should install git-worktree workflows', async () => {
      const result = await installer.install({
        dryRun: false,
        skipBackup: true,
      });

      expect(result.success).toBe(true);

      const workflowsDir = path.join(claudeDir, 'workflows');
      expect(
        existsSync(path.join(workflowsDir, 'feature-development.json'))
      ).toBe(true);
      expect(existsSync(path.join(workflowsDir, 'bug-fix.json'))).toBe(true);
    });

    it('should install validation scripts', async () => {
      const result = await installer.install({
        dryRun: false,
        skipBackup: true,
      });

      expect(result.success).toBe(true);

      const scriptsDir = path.join(claudeDir, 'scripts');
      expect(existsSync(path.join(scriptsDir, 'validate-setup.sh'))).toBe(true);
      expect(existsSync(path.join(scriptsDir, 'check-config.sh'))).toBe(true);
    });

    it('should handle dry-run installation', async () => {
      const result = await installer.install({
        dryRun: true,
        skipBackup: true,
      });

      expect(result.success).toBe(true);
      expect(result.installed.every(f => f.includes('dry-run'))).toBe(true);

      // Files should not exist in dry-run
      expect(existsSync(path.join(claudeDir, 'CLAUDE.md'))).toBe(false);
    });

    it('should skip existing files without overwrite', async () => {
      // Create existing file
      await fs.writeFile(path.join(claudeDir, 'CLAUDE.md'), 'existing content');

      const result = await installer.install({
        dryRun: false,
        skipBackup: true,
        overwrite: false,
      });

      expect(result.skipped).toContain('CLAUDE.md');

      // Content should remain unchanged
      const content = await fs.readFile(path.join(claudeDir, 'CLAUDE.md'), 'utf-8');
      expect(content).toBe('existing content');
    });

    it('should overwrite existing files with overwrite flag', async () => {
      // Create existing file
      await fs.writeFile(path.join(claudeDir, 'CLAUDE.md'), 'existing content');

      const result = await installer.install({
        dryRun: false,
        skipBackup: true,
        overwrite: true,
      });

      expect(result.installed).toContain('CLAUDE.md');

      // Content should be updated
      const content = await fs.readFile(path.join(claudeDir, 'CLAUDE.md'), 'utf-8');
      expect(content).toContain('Test content');
    });

    it('should create backup before installation', async () => {
      // Create existing configurations
      await fs.writeFile(path.join(claudeDir, 'CLAUDE.md'), 'existing');
      await fs.writeFile(
        path.join(claudeDir, 'conventions.json'),
        JSON.stringify({ test: true })
      );

      const result = await installer.install({
        dryRun: false,
        skipBackup: false,
        overwrite: true,
      });

      expect(result.backupId).toBeTruthy();
    });
  });

  describe('End-to-End Integration', () => {
    it('should complete full installation workflow', async () => {
      const backupManager = new BackupRollbackManager(backupDir);
      const installer = new ClaudeConfigInstaller({
        claudeDir,
        sourceDir: testDir,
      });

      await backupManager.initialize();
      await installer.initialize();

      // Create mock source file
      await fs.writeFile(
        path.join(testDir, 'CLAUDE.md'),
        '# Enhanced Claude Configuration'
      );

      // Install configurations
      const installResult = await installer.install({
        dryRun: false,
        skipBackup: false,
      });

      expect(installResult.success).toBe(true);
      expect(installResult.installed.length).toBeGreaterThan(0);

      // Verify all components installed
      expect(existsSync(path.join(claudeDir, 'CLAUDE.md'))).toBe(true);
      expect(existsSync(path.join(claudeDir, 'conventions.json'))).toBe(true);
      expect(existsSync(path.join(claudeDir, 'hooks', 'pre-commit'))).toBe(true);
      expect(existsSync(path.join(claudeDir, 'agents', 'backend-developer.json'))).toBe(
        true
      );
      expect(
        existsSync(path.join(claudeDir, 'workflows', 'feature-development.json'))
      ).toBe(true);
      expect(existsSync(path.join(claudeDir, 'scripts', 'validate-setup.sh'))).toBe(
        true
      );
    });

    it('should support complete backup and rollback cycle', async () => {
      const backupManager = new BackupRollbackManager(backupDir);
      const installer = new ClaudeConfigInstaller({
        claudeDir,
        sourceDir: testDir,
      });

      await backupManager.initialize();
      await installer.initialize();

      // Create initial config
      const initialConfig = path.join(claudeDir, 'CLAUDE.md');
      await fs.writeFile(initialConfig, 'Initial configuration');

      // Create backup
      const backup = await backupManager.createBackup(
        [initialConfig],
        'Pre-update backup'
      );

      // Update configuration
      await fs.writeFile(initialConfig, 'Updated configuration');

      // Rollback to original
      const success = await backupManager.rollback({
        backupId: backup.backupId,
        dryRun: false,
      });

      expect(success).toBe(true);

      // Verify rollback
      const content = await fs.readFile(initialConfig, 'utf-8');
      expect(content).toBe('Initial configuration');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing source files gracefully', async () => {
      const installer = new ClaudeConfigInstaller({
        claudeDir,
        sourceDir: testDir,
      });

      await installer.initialize();

      // Don't create CLAUDE.md source
      const result = await installer.install({
        dryRun: false,
        skipBackup: true,
      });

      // Should skip missing files
      expect(result.skipped).toContain('CLAUDE.md');
    });

    it('should handle permission errors', async () => {
      const installer = new ClaudeConfigInstaller({
        claudeDir: '/root/unauthorized', // Likely no permission
        sourceDir: testDir,
      });

      await expect(installer.initialize()).rejects.toThrow();
    });

    it('should handle corrupted backup metadata', async () => {
      const backupManager = new BackupRollbackManager(backupDir);
      await backupManager.initialize();

      // Corrupt metadata file
      const metadataPath = path.join(backupDir, 'metadata.json');
      await fs.writeFile(metadataPath, 'invalid json {');

      const backups = await backupManager.listBackups();
      expect(backups).toEqual([]);
    });
  });
});
