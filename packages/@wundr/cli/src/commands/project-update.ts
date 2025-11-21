/**
 * Project Update Command
 *
 * Main command for updating wundr projects to new versions.
 * Orchestrates state detection, backup, merge, and conflict resolution.
 */

import { existsSync } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';

import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';

import {
  createConflictResolver,
} from '../lib/conflict-resolution';
import {
  MergeStrategyManager,
  MergeResult,
  threeWayMerge,
  detectFileType,
} from '../lib/merge-strategy';
import {
  createSafetyManager,
} from '../lib/safety-mechanisms';
import {
  detectProjectState,
  CustomizationInfo,
  getStateSummary,
} from '../lib/state-detection';
import { errorHandler } from '../utils/error-handler';
import { logger } from '../utils/logger';

// Import lib modules
import type {
  ConflictResolver,
  UpdateConflict,
  ConflictResolutionResult} from '../lib/conflict-resolution';
import type {
  SafetyManager,
  UpdateBackup,
  UpdateTransaction} from '../lib/safety-mechanisms';
import type {
  ProjectState} from '../lib/state-detection';
import type { PluginManager } from '../plugins/plugin-manager';
import type { ConfigManager } from '../utils/config-manager';


/**
 * Update options from CLI flags
 */
export interface ProjectUpdateOptions {
  /** Dry run mode - show what would be done */
  dryRun: boolean;
  /** Force update without prompts */
  force: boolean;
  /** Skip backup creation */
  skipBackup: boolean;
  /** Specific components to update */
  components: string[];
  /** Target version to update to */
  version: string | null;
  /** Interactive mode */
  interactive: boolean;
  /** Verbose logging */
  verbose: boolean;
  /** Show diff during update */
  showDiff: boolean;
  /** Auto-resolve conflicts */
  autoResolve: boolean;
  /** Rollback on failure */
  rollbackOnFailure: boolean;
}

/**
 * Default update options
 */
const DEFAULT_UPDATE_OPTIONS: ProjectUpdateOptions = {
  dryRun: false,
  force: false,
  skipBackup: false,
  components: [],
  version: null,
  interactive: true,
  verbose: false,
  showDiff: true,
  autoResolve: false,
  rollbackOnFailure: true,
};

/**
 * Update result
 */
export interface UpdateResult {
  /** Whether update was successful */
  success: boolean;
  /** Updated from version */
  fromVersion: string;
  /** Updated to version */
  toVersion: string;
  /** Files updated */
  filesUpdated: string[];
  /** Files with conflicts */
  conflicts: UpdateConflict[];
  /** Backup created */
  backup: UpdateBackup | null;
  /** Errors encountered */
  errors: string[];
  /** Update summary */
  summary: UpdateSummary;
}

/**
 * Update summary
 */
export interface UpdateSummary {
  /** Components checked */
  componentsChecked: number;
  /** Components updated */
  componentsUpdated: number;
  /** Files checked */
  filesChecked: number;
  /** Files updated */
  filesUpdated: number;
  /** Conflicts resolved */
  conflictsResolved: number;
  /** Time taken in ms */
  timeTaken: number;
}

/**
 * Update log entry
 */
interface UpdateLogEntry {
  timestamp: string;
  action: string;
  target: string;
  status: 'success' | 'failure' | 'skipped';
  details?: string;
}

/**
 * Component information for updates
 */
interface UpdateComponent {
  name: string;
  files: string[];
  needsUpdate: boolean;
}

/**
 * Project Update Manager
 */
export class ProjectUpdateManager {
  private projectRoot: string;
  private options: ProjectUpdateOptions;
  private mergeManager: MergeStrategyManager;
  private safetyManager: SafetyManager;
  private conflictResolver: ConflictResolver;
  private updateLog: UpdateLogEntry[] = [];
  private spinner: ReturnType<typeof ora> | null = null;

  constructor(projectRoot: string, options: Partial<ProjectUpdateOptions> = {}) {
    this.projectRoot = projectRoot;
    this.options = { ...DEFAULT_UPDATE_OPTIONS, ...options };

    // Initialize managers
    this.mergeManager = new MergeStrategyManager({
      autoResolve: this.options.autoResolve,
      preserveComments: true,
    });
    this.safetyManager = createSafetyManager({
      projectRoot,
      skipBackup: this.options.skipBackup,
      dryRun: this.options.dryRun,
    });
    this.conflictResolver = createConflictResolver(projectRoot, {
      interactive: this.options.interactive && !this.options.autoResolve,
      autoResolveLow: true,
      autoResolveMedium: this.options.autoResolve,
    });
  }

  /**
   * Run the project update
   */
  async run(): Promise<UpdateResult> {
    const startTime = Date.now();

    logger.info('Starting project update', {
      projectRoot: this.projectRoot,
      dryRun: this.options.dryRun,
      force: this.options.force,
    });

    this.log('update', 'project', 'success', 'Starting project update');

    try {
      // Step 1: Detect current state
      this.startSpinner('Detecting project state...');
      const currentState = await detectProjectState(this.projectRoot, {
        latestVersion: this.options.version || undefined,
      });
      this.stopSpinner();

      const currentVersion = currentState.wundrVersion || '0.0.0';
      this.log('detect', 'state', 'success', `Version: ${currentVersion}`);

      // Step 2: Check if update is needed
      const needsUpdate = currentState.isWundrOutdated ||
                          currentState.isPartialInstallation ||
                          this.options.force;

      if (!needsUpdate && !this.options.force) {
        console.log(chalk.green('\nProject is up to date!'));
        return this.createResult(true, currentVersion, currentVersion, [], [], null, [], startTime);
      }

      // Step 3: Show update plan
      await this.showUpdatePlan(currentState);

      // Step 4: Confirm update (unless force mode)
      if (!this.options.force && !this.options.dryRun) {
        const confirmed = await this.confirmUpdate(currentState);
        if (!confirmed) {
          console.log(chalk.yellow('\nUpdate cancelled by user.'));
          return this.createResult(false, currentVersion, currentVersion, [], [], null, ['Cancelled by user'], startTime);
        }
      }

      // Step 5: Create backup
      let backup: UpdateBackup | null = null;
      if (!this.options.skipBackup && !this.options.dryRun) {
        this.startSpinner('Creating backup...');
        const filesToBackup = await this.getFilesToBackup(currentState);
        backup = await this.safetyManager.createBackup(
          filesToBackup,
          'Pre-update backup',
          currentVersion,
          this.options.version || 'latest',
        );
        this.stopSpinner();
        console.log(chalk.green(`Backup created: ${backup.id}`));
        this.log('backup', backup.path, 'success', `${backup.files.length} files backed up`);
      }

      // Step 6: Start transaction
      const transaction = this.safetyManager.startTransaction('Project update');

      try {
        // Step 7: Perform updates
        const components = this.extractComponents(currentState);
        const { filesUpdated, conflicts, errors } = await this.performUpdates(
          components,
          currentState,
          transaction,
        );

        // Step 8: Resolve conflicts
        let resolvedConflicts: ConflictResolutionResult[] = [];
        if (conflicts.length > 0) {
          console.log(chalk.yellow(`\n${conflicts.length} conflict(s) found.`));
          this.conflictResolver.startSession(conflicts);
          resolvedConflicts = await this.conflictResolver.resolveAll();
        }

        // Step 9: Commit transaction
        if (!this.options.dryRun) {
          const committed = await transaction.commit();
          if (!committed) {
            throw new Error('Failed to commit transaction');
          }
        }

        // Step 10: Write update log
        await this.writeUpdateLog();

        // Success
        const toVersion = this.options.version || 'latest';
        console.log(chalk.green(`\nProject updated successfully to ${toVersion}!`));

        return this.createResult(
          true,
          currentVersion,
          toVersion,
          filesUpdated,
          conflicts,
          backup,
          errors,
          startTime,
        );

      } catch (error) {
        // Rollback on failure
        if (this.options.rollbackOnFailure && backup) {
          console.log(chalk.yellow('\nRolling back changes...'));
          await transaction.rollback();
          await this.safetyManager.restoreFromBackup(backup);
          console.log(chalk.green('Rollback completed.'));
        }
        throw error;
      }

    } catch (error: any) {
      logger.error('Project update failed', error);
      this.log('update', 'project', 'failure', error.message);
      await this.writeUpdateLog();

      return this.createResult(
        false,
        '0.0.0',
        '0.0.0',
        [],
        [],
        null,
        [error.message],
        startTime,
      );
    }
  }

  /**
   * Extract components from project state
   */
  private extractComponents(state: ProjectState): UpdateComponent[] {
    const components: UpdateComponent[] = [];

    // Claude config component
    if (state.claudeConfigPath) {
      components.push({
        name: 'claude-config',
        files: [state.claudeConfigPath],
        needsUpdate: !state.hasClaudeConfig || state.isPartialInstallation,
      });
    }

    // MCP config component
    if (state.mcpConfigPath) {
      components.push({
        name: 'mcp-config',
        files: [state.mcpConfigPath],
        needsUpdate: !state.hasMCPConfig || state.isPartialInstallation,
      });
    }

    // Wundr config component
    if (state.wundrConfigPath) {
      components.push({
        name: 'wundr-config',
        files: [state.wundrConfigPath],
        needsUpdate: state.isWundrOutdated || false,
      });
    }

    // Agent configs
    if (state.agents.hasAgents) {
      components.push({
        name: 'agents',
        files: state.agents.agents.map(a => a.configPath),
        needsUpdate: state.agents.agents.some(a => !a.isValid),
      });
    }

    // Hook configs
    if (state.hooks.hasHooks) {
      components.push({
        name: 'hooks',
        files: state.hooks.hooks.map(h => h.configPath),
        needsUpdate: false,
      });
    }

    return components;
  }

  /**
   * Show update plan to user
   */
  private async showUpdatePlan(state: ProjectState): Promise<void> {
    console.log(chalk.cyan('\n========== Update Plan ==========\n'));

    console.log(chalk.white('Current Version:'), chalk.yellow(state.wundrVersion || 'Not installed'));
    console.log(chalk.white('Target Version:'), chalk.green(this.options.version || state.latestWundrVersion || 'latest'));
    console.log(chalk.white('Health Score:'), chalk.yellow(`${state.healthScore}/100`));

    if (state.recommendations.length > 0) {
      console.log(chalk.white('\nRecommendations:'));
      for (const rec of state.recommendations.slice(0, 5)) {
        console.log(chalk.gray(`  - ${rec}`));
      }
    }

    if (state.customizations.hasCustomizations) {
      console.log(chalk.white('\nDetected Customizations:'));
      for (const file of state.customizations.customizedFiles.slice(0, 5)) {
        console.log(`  - ${file}`);
      }
      if (state.customizations.customizedFiles.length > 5) {
        console.log(chalk.gray(`  ... and ${state.customizations.customizedFiles.length - 5} more`));
      }
    }

    if (state.conflicts.hasConflicts) {
      console.log(chalk.yellow('\nDetected Conflicts:'));
      for (const conflict of state.conflicts.conflicts) {
        const severityColor = conflict.severity === 'error' ? chalk.red :
                             conflict.severity === 'warning' ? chalk.yellow :
                             chalk.gray;
        console.log(severityColor(`  [${conflict.severity}] ${conflict.description}`));
      }
    }

    console.log(chalk.cyan('\n=================================\n'));

    if (this.options.dryRun) {
      console.log(chalk.yellow('DRY RUN MODE - No changes will be made.\n'));
    }
  }

  /**
   * Confirm update with user
   */
  private async confirmUpdate(state: ProjectState): Promise<boolean> {
    if (this.options.interactive) {
      const { confirmed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: 'Proceed with update?',
          default: true,
        },
      ]);
      return confirmed;
    }
    return true;
  }

  /**
   * Get files to backup
   */
  private async getFilesToBackup(state: ProjectState): Promise<string[]> {
    const files: string[] = [];

    // Add config files
    if (state.claudeConfigPath) {
      files.push(state.claudeConfigPath);
    }
    if (state.mcpConfigPath) {
      files.push(state.mcpConfigPath);
    }
    if (state.wundrConfigPath) {
      files.push(state.wundrConfigPath);
    }

    // Add agent config files
    for (const agent of state.agents.agents) {
      files.push(agent.configPath);
    }

    // Add hook config files
    for (const hook of state.hooks.hooks) {
      files.push(hook.configPath);
    }

    // Add customized files
    for (const file of state.customizations.customizedFiles) {
      const fullPath = path.join(state.projectPath, file);
      if (existsSync(fullPath)) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Perform the actual updates
   */
  private async performUpdates(
    components: UpdateComponent[],
    state: ProjectState,
    transaction: UpdateTransaction,
  ): Promise<{
    filesUpdated: string[];
    conflicts: UpdateConflict[];
    errors: string[];
  }> {
    const filesUpdated: string[] = [];
    const conflicts: UpdateConflict[] = [];
    const errors: string[] = [];

    // Filter components if specified
    let componentsToUpdate = components;
    if (this.options.components.length > 0) {
      componentsToUpdate = components.filter(c =>
        this.options.components.includes(c.name),
      );
    }

    this.startSpinner(`Updating ${componentsToUpdate.length} component(s)...`);

    for (const component of componentsToUpdate) {
      if (!component.needsUpdate && !this.options.force) {
        continue;
      }

      try {
        const result = await this.updateComponent(component, state, transaction);

        filesUpdated.push(...result.updated);
        conflicts.push(...result.conflicts);

        if (result.errors.length > 0) {
          errors.push(...result.errors);
        }

        this.log('update', component.name, 'success', `${result.updated.length} files updated`);
      } catch (error: any) {
        errors.push(`Component ${component.name}: ${error.message}`);
        this.log('update', component.name, 'failure', error.message);
      }
    }

    this.stopSpinner();

    return { filesUpdated, conflicts, errors };
  }

  /**
   * Update a single component
   */
  private async updateComponent(
    component: UpdateComponent,
    state: ProjectState,
    transaction: UpdateTransaction,
  ): Promise<{
    updated: string[];
    conflicts: UpdateConflict[];
    errors: string[];
  }> {
    const updated: string[] = [];
    const conflicts: UpdateConflict[] = [];
    const errors: string[] = [];

    for (const filePath of component.files) {
      if (!existsSync(filePath)) {
        continue;
      }

      try {
        // Record operation
        transaction.recordOperation({
          type: 'update',
          path: filePath,
          backupRef: null,
        });

        // Get current content
        const currentContent = await fs.readFile(filePath, 'utf-8');

        // Get base content (original version)
        const baseContent = currentContent; // In real implementation, fetch from registry

        // Get target content (new version)
        const targetContent = await this.getTargetContent(filePath, component);

        if (!targetContent) {
          // No target content, skip
          transaction.completeOperation(filePath);
          continue;
        }

        // Perform merge
        const fileType = detectFileType(filePath);
        const mergeResult = await this.mergeManager.threeWayMerge({
          base: baseContent,
          user: currentContent,
          target: targetContent,
          filePath,
          fileType,
        });

        if (mergeResult.success && mergeResult.content) {
          if (!this.options.dryRun) {
            await fs.writeFile(filePath, mergeResult.content);
          }
          updated.push(filePath);
          transaction.completeOperation(filePath);

          if (this.options.verbose) {
            console.log(chalk.green(`  Updated: ${filePath}`));
          }
        } else if (mergeResult.conflicts.length > 0) {
          // Create update conflicts
          for (const conflict of mergeResult.conflicts) {
            conflicts.push(
              this.conflictResolver.createUpdateConflict(conflict, filePath),
            );
          }
        }

      } catch (error: any) {
        errors.push(`File ${filePath}: ${error.message}`);
        transaction.failOperation(filePath, error.message);
      }
    }

    return { updated, conflicts, errors };
  }

  /**
   * Get target content (new version)
   */
  private async getTargetContent(
    filePath: string,
    component: UpdateComponent,
  ): Promise<string | null> {
    // In real implementation, would fetch from wundr registry
    // For now, return null (no update available)
    return null;
  }

  /**
   * Create result object
   */
  private createResult(
    success: boolean,
    fromVersion: string,
    toVersion: string,
    filesUpdated: string[],
    conflicts: UpdateConflict[],
    backup: UpdateBackup | null,
    errors: string[],
    startTime: number,
  ): UpdateResult {
    return {
      success,
      fromVersion,
      toVersion,
      filesUpdated,
      conflicts,
      backup,
      errors,
      summary: {
        componentsChecked: 0,
        componentsUpdated: 0,
        filesChecked: 0,
        filesUpdated: filesUpdated.length,
        conflictsResolved: 0,
        timeTaken: Date.now() - startTime,
      },
    };
  }

  /**
   * Log an update action
   */
  private log(action: string, target: string, status: 'success' | 'failure' | 'skipped', details?: string): void {
    this.updateLog.push({
      timestamp: new Date().toISOString(),
      action,
      target,
      status,
      details,
    });
  }

  /**
   * Write update log to file
   */
  private async writeUpdateLog(): Promise<void> {
    const logPath = path.join(this.projectRoot, '.wundr-update.log');

    try {
      const content = this.updateLog.map(entry =>
        `[${entry.timestamp}] ${entry.action.toUpperCase()} ${entry.target} - ${entry.status}${entry.details ? `: ${entry.details}` : ''}`,
      ).join('\n');

      await fs.writeFile(logPath, content);
    } catch (error) {
      logger.warn('Failed to write update log', error);
    }
  }

  /**
   * Start spinner
   */
  private startSpinner(text: string): void {
    if (this.options.verbose || !this.options.interactive) {
      console.log(text);
    } else {
      this.spinner = ora(text).start();
    }
  }

  /**
   * Stop spinner
   */
  private stopSpinner(success: boolean = true): void {
    if (this.spinner) {
      if (success) {
        this.spinner.succeed();
      } else {
        this.spinner.fail();
      }
      this.spinner = null;
    }
  }
}

/**
 * Project Update Commands Class
 */
export class ProjectUpdateCommands {
  constructor(
    private program: Command,
    private configManager: ConfigManager,
    private pluginManager: PluginManager,
  ) {
    this.registerCommands();
  }

  private registerCommands(): void {
    const updateCmd = this.program
      .command('update')
      .alias('upgrade')
      .description('Update wundr project to a new version');

    // Main update command
    updateCmd
      .command('project')
      .description('Update the entire project')
      .option('--dry-run', 'Show what would be done without making changes', false)
      .option('-f, --force', 'Force update without prompts', false)
      .option('--skip-backup', 'Skip creating backup before update', false)
      .option('-c, --components <names>', 'Specific components to update (comma-separated)', '')
      .option('-v, --version <version>', 'Target version to update to')
      .option('--no-interactive', 'Disable interactive mode')
      .option('--verbose', 'Enable verbose output', false)
      .option('--show-diff', 'Show differences during update', true)
      .option('--auto-resolve', 'Automatically resolve conflicts', false)
      .option('--no-rollback', 'Disable rollback on failure')
      .action(async (options) => {
        await this.updateProject(options);
      });

    // Check for updates
    updateCmd
      .command('check')
      .description('Check if updates are available')
      .option('--verbose', 'Show detailed information')
      .action(async (options) => {
        await this.checkUpdates(options);
      });

    // Show update history
    updateCmd
      .command('history')
      .description('Show update history')
      .option('-n, --limit <number>', 'Number of entries to show', '10')
      .action(async (options) => {
        await this.showHistory(options);
      });

    // Rollback to previous state
    updateCmd
      .command('rollback [backupId]')
      .description('Rollback to a previous state')
      .option('--list', 'List available backups')
      .action(async (backupId, options) => {
        await this.rollback(backupId, options);
      });

    // Clean up old backups
    updateCmd
      .command('cleanup')
      .description('Clean up old backups')
      .option('-k, --keep <number>', 'Number of backups to keep', '5')
      .action(async (options) => {
        await this.cleanup(options);
      });
  }

  /**
   * Update project
   */
  private async updateProject(options: any): Promise<void> {
    try {
      const updateOptions: Partial<ProjectUpdateOptions> = {
        dryRun: options.dryRun,
        force: options.force,
        skipBackup: options.skipBackup,
        components: options.components ? options.components.split(',').map((c: string) => c.trim()) : [],
        version: options.version || null,
        interactive: options.interactive !== false,
        verbose: options.verbose,
        showDiff: options.showDiff,
        autoResolve: options.autoResolve,
        rollbackOnFailure: options.rollback !== false,
      };

      const manager = new ProjectUpdateManager(process.cwd(), updateOptions);
      const result = await manager.run();

      if (!result.success) {
        process.exit(1);
      }
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_UPDATE_FAILED',
        'Project update failed',
        { options },
        true,
      );
    }
  }

  /**
   * Check for updates
   */
  private async checkUpdates(options: any): Promise<void> {
    const spinner = ora('Checking for updates...').start();

    try {
      const state = await detectProjectState();

      spinner.succeed('Update check complete');

      console.log(chalk.cyan('\n========== Update Status ==========\n'));
      console.log(chalk.white('Current Version:'), chalk.yellow(state.wundrVersion || 'Not installed'));
      console.log(chalk.white('Health Score:'), chalk.yellow(`${state.healthScore}/100`));
      console.log(chalk.white('Needs Update:'), state.isWundrOutdated ? chalk.red('Yes') : chalk.green('No'));

      if (state.recommendations.length > 0) {
        console.log(chalk.white('\nRecommendations:'));
        for (const rec of state.recommendations) {
          console.log(chalk.gray(`  - ${rec}`));
        }

        console.log(chalk.cyan('\nRun `wundr update project` to apply updates.'));
      }

      console.log(chalk.cyan('\n====================================\n'));
    } catch (error) {
      spinner.fail('Update check failed');
      throw error;
    }
  }

  /**
   * Show update history
   */
  private async showHistory(options: any): Promise<void> {
    const logPath = path.join(process.cwd(), '.wundr-update.log');

    if (!existsSync(logPath)) {
      console.log(chalk.yellow('No update history found.'));
      return;
    }

    const content = await fs.readFile(logPath, 'utf-8');
    const lines = content.split('\n').slice(0, parseInt(options.limit, 10));

    console.log(chalk.cyan('\n========== Update History ==========\n'));
    for (const line of lines) {
      if (line.includes('success')) {
        console.log(chalk.green(line));
      } else if (line.includes('failure')) {
        console.log(chalk.red(line));
      } else {
        console.log(chalk.gray(line));
      }
    }
    console.log(chalk.cyan('\n====================================\n'));
  }

  /**
   * Rollback to previous state
   */
  private async rollback(backupId: string | undefined, options: any): Promise<void> {
    const safetyManager = createSafetyManager({ projectRoot: process.cwd() });

    if (options.list) {
      const backups = await safetyManager.listBackups();

      if (backups.length === 0) {
        console.log(chalk.yellow('No backups available.'));
        return;
      }

      console.log(chalk.cyan('\n========== Available Backups ==========\n'));
      for (const backup of backups) {
        console.log(
          `  ${chalk.white(backup.id)} - ${chalk.gray(new Date(backup.timestamp).toLocaleString())} ` +
          `(${backup.files.length} files)`,
        );
      }
      console.log(chalk.cyan('\n=======================================\n'));
      return;
    }

    let backup: UpdateBackup | null;

    if (backupId) {
      backup = await safetyManager.listBackups().then(
        backups => backups.find(b => b.id === backupId) || null,
      );
    } else {
      backup = await safetyManager.getLatestBackup();
    }

    if (!backup) {
      console.log(chalk.red('Backup not found.'));
      return;
    }

    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: `Rollback to ${backup.id}?`,
        default: false,
      },
    ]);

    if (!confirmed) {
      console.log(chalk.yellow('Rollback cancelled.'));
      return;
    }

    const spinner = ora('Rolling back...').start();
    const success = await safetyManager.restoreFromBackup(backup);

    if (success) {
      spinner.succeed('Rollback completed successfully');
    } else {
      spinner.fail('Rollback failed');
    }
  }

  /**
   * Cleanup old backups
   */
  private async cleanup(options: any): Promise<void> {
    const safetyManager = createSafetyManager({ projectRoot: process.cwd() });
    const backups = await safetyManager.listBackups();
    const keepCount = parseInt(options.keep, 10);

    if (backups.length <= keepCount) {
      console.log(chalk.green(`Only ${backups.length} backup(s) found. Nothing to clean up.`));
      return;
    }

    const toDelete = backups.slice(keepCount);

    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: `Delete ${toDelete.length} old backup(s)?`,
        default: true,
      },
    ]);

    if (!confirmed) {
      return;
    }

    const spinner = ora('Cleaning up old backups...').start();

    let deleted = 0;
    for (const backup of toDelete) {
      if (await safetyManager.deleteBackup(backup.id)) {
        deleted++;
      }
    }

    spinner.succeed(`Deleted ${deleted} backup(s)`);
  }
}

/**
 * Create and export the update command
 */
export function createProjectUpdateCommand(): Command {
  const cmd = new Command('update')
    .alias('upgrade')
    .description('Update wundr project to a new version');

  // Add subcommands directly
  cmd
    .command('project')
    .description('Update the entire project')
    .option('--dry-run', 'Show what would be done without making changes', false)
    .option('-f, --force', 'Force update without prompts', false)
    .option('--skip-backup', 'Skip creating backup before update', false)
    .option('-c, --components <names>', 'Specific components to update (comma-separated)')
    .option('-v, --version <version>', 'Target version to update to')
    .option('--no-interactive', 'Disable interactive mode')
    .option('--verbose', 'Enable verbose output', false)
    .option('--auto-resolve', 'Automatically resolve conflicts', false)
    .action(async (options) => {
      const updateOptions: Partial<ProjectUpdateOptions> = {
        dryRun: options.dryRun,
        force: options.force,
        skipBackup: options.skipBackup,
        components: options.components ? options.components.split(',').map((c: string) => c.trim()) : [],
        version: options.version || null,
        interactive: options.interactive !== false,
        verbose: options.verbose,
        autoResolve: options.autoResolve,
      };

      const manager = new ProjectUpdateManager(process.cwd(), updateOptions);
      const result = await manager.run();

      if (!result.success) {
        process.exit(1);
      }
    });

  cmd
    .command('check')
    .description('Check if updates are available')
    .action(async () => {
      const spinner = ora('Checking for updates...').start();
      try {
        const state = await detectProjectState();
        spinner.succeed();

        console.log(chalk.white('\nCurrent Version:'), chalk.yellow(state.wundrVersion || 'Not installed'));
        console.log(chalk.white('Health Score:'), chalk.yellow(`${state.healthScore}/100`));
        console.log(chalk.white('Needs Update:'), state.isWundrOutdated ? chalk.red('Yes') : chalk.green('No'));

        if (state.recommendations.length > 0) {
          console.log(chalk.white('\nRecommendations:'));
          for (const rec of state.recommendations.slice(0, 5)) {
            console.log(chalk.gray(`  - ${rec}`));
          }
        }
      } catch (error) {
        spinner.fail('Check failed');
        throw error;
      }
    });

  return cmd;
}

export default ProjectUpdateCommands;
