/**
 * Backup and Rollback Manager
 * Handles backup creation and restoration for configuration files
 */

import { existsSync } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';

import chalk from 'chalk';

import { logger } from './logger';

export interface BackupMetadata {
  timestamp: string;
  backupId: string;
  files: BackupFile[];
  reason: string;
  success: boolean;
}

export interface BackupFile {
  originalPath: string;
  backupPath: string;
  size: number;
  checksum?: string;
}

export interface RollbackOptions {
  backupId?: string;
  dryRun?: boolean;
  verbose?: boolean;
}

export class BackupRollbackManager {
  private backupDir: string;
  private metadataFile: string;
  private homeDir: string;

  constructor(backupDir?: string) {
    this.homeDir = process.env.HOME || process.env.USERPROFILE || '';
    this.backupDir =
      backupDir || path.join(this.homeDir, '.wundr', 'backups');
    this.metadataFile = path.join(this.backupDir, 'metadata.json');
  }

  /**
   * Initialize backup directory structure
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });

      if (!existsSync(this.metadataFile)) {
        await fs.writeFile(this.metadataFile, JSON.stringify([], null, 2));
      }

      logger.info('Backup manager initialized', { backupDir: this.backupDir });
    } catch (error) {
      logger.error('Failed to initialize backup manager', error);
      throw error;
    }
  }

  /**
   * Create backup of specified files
   */
  async createBackup(
    files: string[],
    reason: string = 'Manual backup',
  ): Promise<BackupMetadata> {
    const backupId = this.generateBackupId();
    const timestamp = new Date().toISOString();
    const backupPath = path.join(this.backupDir, backupId);

    logger.info('Creating backup', { backupId, files: files.length, reason });

    try {
      await fs.mkdir(backupPath, { recursive: true });

      const backupFiles: BackupFile[] = [];

      for (const filePath of files) {
        const expandedPath = this.expandPath(filePath);

        if (!existsSync(expandedPath)) {
          logger.warn('File not found, skipping', { file: expandedPath });
          continue;
        }

        const stats = await fs.stat(expandedPath);
        const relativePath = this.getRelativePath(expandedPath);
        const backupFilePath = path.join(backupPath, relativePath);

        // Create directory structure
        await fs.mkdir(path.dirname(backupFilePath), { recursive: true });

        // Copy file
        await fs.copyFile(expandedPath, backupFilePath);

        backupFiles.push({
          originalPath: expandedPath,
          backupPath: backupFilePath,
          size: stats.size,
        });

        logger.info('Backed up file', {
          original: expandedPath,
          backup: backupFilePath,
        });
      }

      const metadata: BackupMetadata = {
        timestamp,
        backupId,
        files: backupFiles,
        reason,
        success: true,
      };

      await this.saveMetadata(metadata);

      logger.info('Backup created successfully', {
        backupId,
        filesBackedUp: backupFiles.length,
      });

      return metadata;
    } catch (error) {
      logger.error('Backup failed', error);

      const metadata: BackupMetadata = {
        timestamp,
        backupId,
        files: [],
        reason,
        success: false,
      };

      await this.saveMetadata(metadata);
      throw error;
    }
  }

  /**
   * Restore from backup
   */
  async rollback(options: RollbackOptions = {}): Promise<boolean> {
    const { backupId, dryRun = false, verbose = false } = options;

    try {
      const metadata = backupId
        ? await this.getBackupMetadata(backupId)
        : await this.getLatestBackup();

      if (!metadata) {
        logger.error('No backup found to restore');
        return false;
      }

      logger.info('Rolling back', {
        backupId: metadata.backupId,
        dryRun,
        files: metadata.files.length,
      });

      if (dryRun) {
        console.log(chalk.yellow('\n🔍 DRY RUN - No files will be modified\n'));
        console.log(chalk.cyan('Files that would be restored:'));
        metadata.files.forEach(file => {
          console.log(chalk.white(`  ${file.originalPath}`));
          if (verbose) {
            console.log(chalk.gray(`    ← ${file.backupPath}`));
          }
        });
        return true;
      }

      const restoredFiles: string[] = [];
      const failedFiles: string[] = [];

      for (const file of metadata.files) {
        try {
          // Create directory structure
          await fs.mkdir(path.dirname(file.originalPath), {
            recursive: true,
          });

          // Restore file
          await fs.copyFile(file.backupPath, file.originalPath);
          restoredFiles.push(file.originalPath);

          logger.info('Restored file', { file: file.originalPath });
        } catch (error) {
          logger.error('Failed to restore file', {
            file: file.originalPath,
            error,
          });
          failedFiles.push(file.originalPath);
        }
      }

      console.log(chalk.green(`\n✅ Restored ${restoredFiles.length} files`));

      if (failedFiles.length > 0) {
        console.log(chalk.red(`❌ Failed to restore ${failedFiles.length} files`));
        failedFiles.forEach(file => {
          console.log(chalk.red(`  - ${file}`));
        });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Rollback failed', error);
      return false;
    }
  }

  /**
   * List all backups
   */
  async listBackups(): Promise<BackupMetadata[]> {
    try {
      const content = await fs.readFile(this.metadataFile, 'utf-8');
      const backups = JSON.parse(content) as BackupMetadata[];
      return backups.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
    } catch (error) {
      logger.error('Failed to list backups', error);
      return [];
    }
  }

  /**
   * Get specific backup metadata
   */
  async getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    const backups = await this.listBackups();
    return backups.find(b => b.backupId === backupId) || null;
  }

  /**
   * Get latest successful backup
   */
  async getLatestBackup(): Promise<BackupMetadata | null> {
    const backups = await this.listBackups();
    return backups.find(b => b.success) || null;
  }

  /**
   * Delete old backups
   */
  async cleanupOldBackups(retainCount: number = 5): Promise<void> {
    const backups = await this.listBackups();

    if (backups.length <= retainCount) {
      logger.info('No backups to clean up', {
        current: backups.length,
        retain: retainCount,
      });
      return;
    }

    const toDelete = backups.slice(retainCount);

    logger.info('Cleaning up old backups', { count: toDelete.length });

    for (const backup of toDelete) {
      try {
        const backupPath = path.join(this.backupDir, backup.backupId);
        await fs.rm(backupPath, { recursive: true, force: true });
        logger.info('Deleted backup', { backupId: backup.backupId });
      } catch (error) {
        logger.error('Failed to delete backup', {
          backupId: backup.backupId,
          error,
        });
      }
    }

    // Update metadata
    const remaining = backups.slice(0, retainCount);
    await fs.writeFile(this.metadataFile, JSON.stringify(remaining, null, 2));
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupId: string): Promise<boolean> {
    const metadata = await this.getBackupMetadata(backupId);

    if (!metadata) {
      logger.error('Backup not found', { backupId });
      return false;
    }

    let valid = true;

    for (const file of metadata.files) {
      if (!existsSync(file.backupPath)) {
        logger.error('Backup file missing', { file: file.backupPath });
        valid = false;
      }
    }

    return valid;
  }

  /**
   * Private helper methods
   */

  private generateBackupId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `backup-${timestamp}`;
  }

  private expandPath(filePath: string): string {
    if (filePath.startsWith('~/')) {
      return path.join(this.homeDir, filePath.slice(2));
    }
    return filePath;
  }

  private getRelativePath(absolutePath: string): string {
    // Create relative path from home directory
    if (absolutePath.startsWith(this.homeDir)) {
      return path.relative(this.homeDir, absolutePath);
    }
    // For absolute paths outside home, use full path structure
    return absolutePath.replace(/^\//, '');
  }

  private async saveMetadata(metadata: BackupMetadata): Promise<void> {
    const backups = await this.listBackups();
    backups.unshift(metadata);
    await fs.writeFile(this.metadataFile, JSON.stringify(backups, null, 2));
  }

  /**
   * Display backup information
   */
  displayBackupInfo(metadata: BackupMetadata): void {
    console.log(chalk.cyan('\n📦 Backup Information\n'));
    console.log(chalk.white('Backup ID:'), chalk.green(metadata.backupId));
    console.log(chalk.white('Timestamp:'), chalk.gray(metadata.timestamp));
    console.log(chalk.white('Reason:'), chalk.gray(metadata.reason));
    console.log(chalk.white('Status:'),
      metadata.success ? chalk.green('Success') : chalk.red('Failed'),
    );
    console.log(chalk.white('Files:'), chalk.cyan(metadata.files.length));

    if (metadata.files.length > 0) {
      console.log(chalk.cyan('\nBacked up files:'));
      metadata.files.forEach(file => {
        const size = (file.size / 1024).toFixed(2);
        console.log(chalk.gray(`  • ${file.originalPath} (${size} KB)`));
      });
    }
  }
}
