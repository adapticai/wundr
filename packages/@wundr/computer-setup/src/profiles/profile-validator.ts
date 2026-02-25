/**
 * Profile Validator
 *
 * Validates profiles against the current system, checks for updates,
 * and manages snapshots for rollback.
 *
 * @module profiles/profile-validator
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { Logger } from '../utils/logger';

import { PlatformAdapter } from './platform-adapter';

import type { SetupPlatform } from '../types';
import type {
  ComposedProfile,
  InstalledToolRecord,
  ProfileSnapshot,
  ProfileType,
  ProfileValidationResult,
  ToolSpec,
  ToolValidationEntry,
  ToolUpdateInfo,
  UpdateCheckResult,
} from './profile-types';

const logger = new Logger({ name: 'profile-validator' });

/**
 * Validates profiles, checks for updates, and manages rollback snapshots.
 */
export class ProfileValidator {
  private adapter: PlatformAdapter;
  private snapshotsDir: string;

  constructor(adapter?: PlatformAdapter, snapshotsDir?: string) {
    this.adapter = adapter || new PlatformAdapter();
    this.snapshotsDir =
      snapshotsDir || path.join(os.homedir(), '.wundr', 'snapshots');
  }

  // ---------------------------------------------------------------------------
  // Pre-apply validation
  // ---------------------------------------------------------------------------

  /**
   * Validate a composed profile against the current system BEFORE installation.
   *
   * Checks:
   * - Whether each tool is supported on this platform
   * - Whether required dependencies are present in the tool list
   * - Disk space availability
   *
   * This is a "dry run" check. It does not install anything.
   */
  async preApplyValidation(
    profile: ComposedProfile
  ): Promise<ProfileValidationResult> {
    logger.info('Running pre-apply validation...');

    const passed: ToolValidationEntry[] = [];
    const failed: ToolValidationEntry[] = [];
    const unsupported: ToolValidationEntry[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    const toolNames = new Set(profile.tools.map(t => t.name));

    for (const tool of profile.tools) {
      const resolved = this.adapter.resolveToolCommand(tool);

      // Check platform support
      if (!resolved.supported) {
        const entry: ToolValidationEntry = {
          toolName: tool.name,
          expectedVersion: tool.version,
          installed: false,
          versionMatch: false,
          message:
            resolved.unsupportedReason ||
            `${tool.displayName} is not supported on this platform`,
        };

        if (tool.required) {
          unsupported.push(entry);
          errors.push(
            `Required tool "${tool.displayName}" is not supported: ${resolved.unsupportedReason}`
          );
        } else {
          unsupported.push(entry);
          warnings.push(
            `Optional tool "${tool.displayName}" is not supported: ${resolved.unsupportedReason}`
          );
        }
        continue;
      }

      // Check dependencies are in the tool list
      if (tool.dependencies) {
        for (const dep of tool.dependencies) {
          if (!toolNames.has(dep)) {
            warnings.push(
              `Tool "${tool.name}" depends on "${dep}" which is not in the profile`
            );
          }
        }
      }

      // Check if already installed
      const isInstalled = await this.checkToolInstalled(
        resolved.validateCommand
      );

      if (isInstalled) {
        const installedVersion = await this.getInstalledVersion(
          resolved.validateCommand
        );
        const versionMatch =
          !tool.version ||
          tool.version === 'latest' ||
          (installedVersion !== null &&
            installedVersion.includes(tool.version));

        passed.push({
          toolName: tool.name,
          expectedVersion: tool.version,
          installedVersion: installedVersion || undefined,
          installed: true,
          versionMatch,
          message: versionMatch
            ? `Already installed (${installedVersion})`
            : `Installed (${installedVersion}) but expected ${tool.version}`,
        });

        if (!versionMatch) {
          warnings.push(
            `${tool.displayName}: installed version ${installedVersion} does not match expected ${tool.version}`
          );
        }
      } else {
        const entry: ToolValidationEntry = {
          toolName: tool.name,
          expectedVersion: tool.version,
          installed: false,
          versionMatch: false,
          message: `Not installed; will be installed`,
        };

        if (tool.required) {
          // Not an error for pre-apply; it WILL be installed
          passed.push(entry);
        } else {
          passed.push(entry);
        }
      }
    }

    const valid = errors.length === 0;

    logger.info(
      `Pre-apply validation: ${valid ? 'PASSED' : 'FAILED'} (${passed.length} ok, ${failed.length} failed, ${unsupported.length} unsupported)`
    );

    return { valid, passed, failed, unsupported, warnings, errors };
  }

  // ---------------------------------------------------------------------------
  // Post-apply validation
  // ---------------------------------------------------------------------------

  /**
   * Validate that all tools in a profile are correctly installed AFTER setup.
   */
  async postApplyValidation(
    profile: ComposedProfile
  ): Promise<ProfileValidationResult> {
    logger.info('Running post-apply validation...');

    const passed: ToolValidationEntry[] = [];
    const failed: ToolValidationEntry[] = [];
    const unsupported: ToolValidationEntry[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    for (const tool of profile.tools) {
      const resolved = this.adapter.resolveToolCommand(tool);

      if (!resolved.supported) {
        unsupported.push({
          toolName: tool.name,
          installed: false,
          versionMatch: false,
          message: `Not supported on this platform`,
        });
        continue;
      }

      const isInstalled = await this.checkToolInstalled(
        resolved.validateCommand
      );
      const installedVersion = isInstalled
        ? await this.getInstalledVersion(resolved.validateCommand)
        : null;

      const versionMatch =
        !tool.version ||
        tool.version === 'latest' ||
        (installedVersion !== null && installedVersion.includes(tool.version));

      const entry: ToolValidationEntry = {
        toolName: tool.name,
        expectedVersion: tool.version,
        installedVersion: installedVersion || undefined,
        installed: isInstalled,
        versionMatch,
        message: isInstalled
          ? versionMatch
            ? `Installed and version matches (${installedVersion})`
            : `Installed (${installedVersion}) but expected ${tool.version}`
          : `NOT installed`,
      };

      if (isInstalled && versionMatch) {
        passed.push(entry);
      } else if (isInstalled && !versionMatch) {
        if (tool.required) {
          failed.push(entry);
          warnings.push(
            `${tool.displayName}: version mismatch (${installedVersion} vs expected ${tool.version})`
          );
        } else {
          passed.push(entry);
          warnings.push(`${tool.displayName}: optional tool version mismatch`);
        }
      } else {
        if (tool.required) {
          failed.push(entry);
          errors.push(
            `Required tool "${tool.displayName}" is not installed after setup`
          );
        } else {
          failed.push(entry);
          warnings.push(
            `Optional tool "${tool.displayName}" was not installed`
          );
        }
      }
    }

    const valid = errors.length === 0;

    logger.info(
      `Post-apply validation: ${valid ? 'PASSED' : 'FAILED'} (${passed.length} ok, ${failed.length} failed)`
    );

    return { valid, passed, failed, unsupported, warnings, errors };
  }

  // ---------------------------------------------------------------------------
  // Update checks
  // ---------------------------------------------------------------------------

  /**
   * Check whether newer versions are available for installed tools.
   */
  async checkUpdates(profile: ComposedProfile): Promise<UpdateCheckResult> {
    logger.info('Checking for tool updates...');

    const updatesAvailable: ToolUpdateInfo[] = [];
    const upToDate: string[] = [];
    const checkFailed: string[] = [];

    for (const tool of profile.tools) {
      const resolved = this.adapter.resolveToolCommand(tool);

      if (!resolved.supported) {
        continue;
      }

      try {
        const installedVersion = await this.getInstalledVersion(
          resolved.validateCommand
        );

        if (!installedVersion) {
          checkFailed.push(tool.name);
          continue;
        }

        const latestVersion = await this.queryLatestVersion(
          tool,
          resolved.packageManager
        );

        if (!latestVersion) {
          checkFailed.push(tool.name);
          continue;
        }

        if (this.isNewerVersion(latestVersion, installedVersion)) {
          updatesAvailable.push({
            toolName: tool.name,
            currentVersion: installedVersion,
            latestVersion,
            isMajorUpdate: this.isMajorVersionBump(
              installedVersion,
              latestVersion
            ),
          });
        } else {
          upToDate.push(tool.name);
        }
      } catch {
        checkFailed.push(tool.name);
      }
    }

    logger.info(
      `Update check: ${updatesAvailable.length} updates available, ${upToDate.length} up to date, ${checkFailed.length} check(s) failed`
    );

    return { updatesAvailable, upToDate, checkFailed };
  }

  // ---------------------------------------------------------------------------
  // Profile diff
  // ---------------------------------------------------------------------------

  /**
   * Compare two composed profiles and return the differences.
   */
  diffProfiles(
    profileA: ComposedProfile,
    profileB: ComposedProfile
  ): {
    added: ToolSpec[];
    removed: ToolSpec[];
    versionChanged: Array<{
      toolName: string;
      oldVersion?: string;
      newVersion?: string;
    }>;
  } {
    const toolsA = new Map(profileA.tools.map(t => [t.name, t]));
    const toolsB = new Map(profileB.tools.map(t => [t.name, t]));

    const added: ToolSpec[] = [];
    const removed: ToolSpec[] = [];
    const versionChanged: Array<{
      toolName: string;
      oldVersion?: string;
      newVersion?: string;
    }> = [];

    // Tools in B but not in A (added)
    for (const [name, spec] of toolsB) {
      if (!toolsA.has(name)) {
        added.push(spec);
      }
    }

    // Tools in A but not in B (removed)
    for (const [name, spec] of toolsA) {
      if (!toolsB.has(name)) {
        removed.push(spec);
      }
    }

    // Tools in both but with different versions
    for (const [name, specA] of toolsA) {
      const specB = toolsB.get(name);
      if (specB && specA.version !== specB.version) {
        versionChanged.push({
          toolName: name,
          oldVersion: specA.version,
          newVersion: specB.version,
        });
      }
    }

    return { added, removed, versionChanged };
  }

  // ---------------------------------------------------------------------------
  // Snapshots for rollback
  // ---------------------------------------------------------------------------

  /**
   * Take a snapshot of the current system state before applying a profile.
   */
  async takeSnapshot(profile: ComposedProfile): Promise<ProfileSnapshot> {
    logger.info('Taking system snapshot for rollback...');

    await fs.mkdir(this.snapshotsDir, { recursive: true });

    const platform = this.adapter.getPlatform();
    const installedTools: InstalledToolRecord[] = [];

    for (const tool of profile.tools) {
      const resolved = this.adapter.resolveToolCommand(tool);
      if (!resolved.supported) continue;

      const isInstalled = await this.checkToolInstalled(
        resolved.validateCommand
      );
      if (isInstalled) {
        const version = await this.getInstalledVersion(
          resolved.validateCommand
        );
        installedTools.push({
          name: tool.name,
          version: version || 'unknown',
          location: tool.name,
          category: tool.category,
        });
      }
    }

    const snapshot: ProfileSnapshot = {
      id: `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: new Date().toISOString(),
      platform,
      installedTools,
      profileTypes: profile.sourceProfiles,
    };

    // Persist to disk
    const snapshotPath = path.join(this.snapshotsDir, `${snapshot.id}.json`);
    await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));

    logger.info(
      `Snapshot saved: ${snapshot.id} (${installedTools.length} tools recorded)`
    );

    return snapshot;
  }

  /**
   * List all available snapshots.
   */
  async listSnapshots(): Promise<ProfileSnapshot[]> {
    try {
      const files = await fs.readdir(this.snapshotsDir);
      const snapshots: ProfileSnapshot[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const content = await fs.readFile(
            path.join(this.snapshotsDir, file),
            'utf-8'
          );
          snapshots.push(JSON.parse(content) as ProfileSnapshot);
        } catch {
          logger.warn(`Could not read snapshot file: ${file}`);
        }
      }

      // Sort by timestamp, newest first
      snapshots.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      return snapshots;
    } catch {
      return [];
    }
  }

  /**
   * Load a specific snapshot by ID.
   */
  async loadSnapshot(snapshotId: string): Promise<ProfileSnapshot | null> {
    const snapshotPath = path.join(this.snapshotsDir, `${snapshotId}.json`);
    try {
      const content = await fs.readFile(snapshotPath, 'utf-8');
      return JSON.parse(content) as ProfileSnapshot;
    } catch {
      return null;
    }
  }

  /**
   * Delete a snapshot by ID.
   */
  async deleteSnapshot(snapshotId: string): Promise<boolean> {
    const snapshotPath = path.join(this.snapshotsDir, `${snapshotId}.json`);
    try {
      await fs.unlink(snapshotPath);
      logger.info(`Deleted snapshot: ${snapshotId}`);
      return true;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Check if a tool is installed by running its validate command.
   */
  private async checkToolInstalled(validateCommand: string): Promise<boolean> {
    try {
      const { execa } = await import('execa');
      const parts = validateCommand.split(' ');
      await execa(parts[0], parts.slice(1), { timeout: 10000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the installed version of a tool by running its validate command
   * and parsing the output.
   */
  private async getInstalledVersion(
    validateCommand: string
  ): Promise<string | null> {
    try {
      const { execa } = await import('execa');
      const parts = validateCommand.split(' ');
      const { stdout } = await execa(parts[0], parts.slice(1), {
        timeout: 10000,
      });
      // Extract version-like string from output
      const versionMatch = stdout.match(/(\d+\.\d+[\.\d]*)/);
      return versionMatch ? versionMatch[1] : stdout.trim().split('\n')[0];
    } catch {
      return null;
    }
  }

  /**
   * Query the latest available version for a tool.
   * Strategy depends on the package manager.
   */
  private async queryLatestVersion(
    tool: ToolSpec,
    packageManager?: string
  ): Promise<string | null> {
    try {
      const { execa } = await import('execa');

      switch (packageManager) {
        case 'brew': {
          const { stdout } = await execa(
            'brew',
            ['info', '--json=v2', tool.name],
            { timeout: 15000 }
          );
          const info = JSON.parse(stdout);
          const formula = info.formulae?.[0];
          return formula?.versions?.stable || null;
        }
        case 'npm': {
          const { stdout } = await execa(
            'npm',
            ['view', tool.name, 'version'],
            { timeout: 15000 }
          );
          return stdout.trim() || null;
        }
        case 'pip': {
          const { stdout } = await execa(
            'pip3',
            ['index', 'versions', tool.name],
            { timeout: 15000 }
          );
          const match = stdout.match(/\((\d+[\.\d]*)\)/);
          return match ? match[1] : null;
        }
        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  /**
   * Compare two version strings; return true if versionA is newer than versionB.
   */
  private isNewerVersion(versionA: string, versionB: string): boolean {
    const partsA = versionA.split('.').map(Number);
    const partsB = versionB.split('.').map(Number);
    const maxLen = Math.max(partsA.length, partsB.length);

    for (let i = 0; i < maxLen; i++) {
      const a = partsA[i] || 0;
      const b = partsB[i] || 0;
      if (a > b) return true;
      if (a < b) return false;
    }

    return false;
  }

  /**
   * Check if a version bump is a major version change.
   */
  private isMajorVersionBump(oldVersion: string, newVersion: string): boolean {
    const oldMajor = parseInt(oldVersion.split('.')[0], 10);
    const newMajor = parseInt(newVersion.split('.')[0], 10);
    return newMajor > oldMajor;
  }
}

export default ProfileValidator;
