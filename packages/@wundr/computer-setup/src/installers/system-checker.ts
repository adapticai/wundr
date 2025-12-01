/**
 * System Checker - System health check and repair for broken installations
 * Ports functionality from 00-system-check.sh
 */
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { execa } from 'execa';

import { Logger } from '../utils/logger';

import type { SetupPlatform, SetupStep, DeveloperProfile } from '../types';
import type { BaseInstaller } from './index';

export class SystemChecker implements BaseInstaller {
  name = 'system-checker';
  private readonly homeDir = os.homedir();
  private readonly logger = new Logger({ name: 'system-checker' });

  isSupported(platform: SetupPlatform): boolean {
    return ['darwin', 'linux'].includes(platform.os);
  }

  async isInstalled(): Promise<boolean> {
    // Always return false as this is a diagnostic tool that should always run
    return false;
  }

  async getVersion(): Promise<string | null> {
    return 'System Check v1.0';
  }

  async install(
    profile: DeveloperProfile,
    platform: SetupPlatform
  ): Promise<void> {
    this.logger.info(
      `Running system health check for ${profile.name || 'user'} on ${platform.os}...`
    );

    // Clean problematic configurations
    await this.cleanProblematicConfigs();

    // Check and fix Node/npm installation
    const nodeNpmFixed = await this.checkAndFixNodeNpm();

    if (nodeNpmFixed) {
      this.logger.info('System check passed - Node.js and npm are working');
    } else {
      this.logger.warn(
        'System check found issues - will be addressed during setup'
      );
    }
  }

  async configure(
    profile: DeveloperProfile,
    platform: SetupPlatform
  ): Promise<void> {
    // Log configuration context for debugging
    this.logger.info(
      `System check completed for ${profile.name || 'user'} on ${platform.os}`
    );
  }

  async validate(): Promise<boolean> {
    try {
      // Check if Node.js is working
      await execa('node', ['--version']);

      // Check if npm is working
      await execa('npm', ['--version']);

      return true;
    } catch {
      return false;
    }
  }

  getSteps(profile: DeveloperProfile, platform: SetupPlatform): SetupStep[] {
    return [
      {
        id: 'system-check',
        name: 'System Health Check',
        description:
          'Check and repair system for previous broken installations',
        category: 'system',
        required: true,
        dependencies: [],
        estimatedTime: 60,
        validator: () => this.validate(),
        installer: () => this.install(profile, platform),
      },
    ];
  }

  private async checkAndFixNodeNpm(): Promise<boolean> {
    this.logger.info('Checking Node.js and npm installation state...');

    let needsRepair = false;

    // Check if node exists
    try {
      const { stdout } = await execa('node', ['--version']);
      this.logger.info(`Node.js found: ${stdout.trim()}`);
    } catch {
      this.logger.info('Node.js not found');
      needsRepair = true;
    }

    // Check if npm exists and works
    try {
      const { stdout } = await execa('npm', ['--version']);
      this.logger.info(`npm found: ${stdout.trim()}`);
    } catch (error) {
      this.logger.error('ERROR: npm is broken or missing');
      needsRepair = true;

      // Check for the specific graceful-fs error
      const errorStr = error instanceof Error ? error.message : String(error);
      if (errorStr.includes("Cannot find module 'graceful-fs'")) {
        this.logger.info(
          'Detected missing graceful-fs module - npm is completely broken'
        );
      }
    }

    // Check for NVM and attempt repair if needed
    const nvmDir = path.join(this.homeDir, '.nvm');
    try {
      await fs.access(nvmDir);
      this.logger.info(`NVM detected at ${nvmDir}`);

      if (needsRepair) {
        this.logger.info('Attempting to repair Node.js/npm using NVM...');

        // Set up NVM environment
        const nvmScript = path.join(nvmDir, 'nvm.sh');
        try {
          await fs.access(nvmScript);

          // Get current version or use LTS
          let currentVersion = 'none';
          try {
            const { stdout } = await execa('bash', [
              '-c',
              `source ${nvmScript} && nvm current`,
            ]);
            currentVersion = stdout.trim();
          } catch {
            currentVersion = 'none';
          }

          if (currentVersion === 'none' || currentVersion === 'system') {
            this.logger.info('No NVM-managed Node.js found, installing LTS...');
            await execa('bash', [
              '-c',
              `source ${nvmScript} && nvm install --lts && nvm use --lts && nvm alias default lts/*`,
            ]);
          } else {
            this.logger.info(`Found NVM-managed Node.js: ${currentVersion}`);
            // If npm is broken, reinstall the current version
            try {
              await execa('npm', ['--version']);
            } catch {
              this.logger.info(
                `Reinstalling Node.js ${currentVersion} to fix npm...`
              );
              await execa('bash', [
                '-c',
                `source ${nvmScript} && nvm uninstall ${currentVersion} || true && nvm install ${currentVersion} && nvm use ${currentVersion}`,
              ]);
            }
          }

          // Check if repair worked
          try {
            const { stdout } = await execa('npm', ['--version']);
            this.logger.info(`Successfully repaired npm: ${stdout.trim()}`);
            needsRepair = false;
          } catch {
            this.logger.warn(
              'npm repair failed - will be handled by subsequent scripts'
            );
          }
        } catch {
          this.logger.info('NVM script not found or not executable');
        }
      }
    } catch {
      this.logger.info('NVM not installed yet');
      if (needsRepair) {
        this.logger.info(
          'Node.js/npm needs repair but NVM not available - will install fresh'
        );
      }
    }

    return !needsRepair;
  }

  private async cleanProblematicConfigs(): Promise<void> {
    this.logger.info('Cleaning problematic configurations...');

    // Clean npm config issues
    const npmrcPath = path.join(this.homeDir, '.npmrc');
    try {
      await fs.access(npmrcPath);

      const npmrcContent = await fs.readFile(npmrcPath, 'utf-8');

      if (
        npmrcContent.includes('prefix=') ||
        npmrcContent.includes('globalconfig=')
      ) {
        this.logger.info(
          'Found problematic .npmrc configuration, backing up and cleaning...'
        );

        // Create backup
        const backupPath = `${npmrcPath}.backup.${new Date().toISOString().split('T')[0].replace(/-/g, '')}_${Date.now()}`;
        await fs.copyFile(npmrcPath, backupPath);

        // Remove problematic lines
        const cleanedContent = npmrcContent
          .split('\n')
          .filter(
            line =>
              !line.startsWith('prefix=') && !line.startsWith('globalconfig=')
          )
          .join('\n');

        await fs.writeFile(npmrcPath, cleanedContent);
      }
    } catch {
      // File doesn't exist, which is fine
    }

    // Clean npm cache if it exists
    const npmDir = path.join(this.homeDir, '.npm');
    try {
      await fs.access(npmDir);
      this.logger.info('Cleaning npm cache directories...');

      try {
        await fs.rm(path.join(npmDir, '_logs'), {
          recursive: true,
          force: true,
        });
      } catch {
        // Ignore errors when cleaning _logs directory - it may not exist or be in use
      }

      try {
        await fs.rm(path.join(npmDir, '_npx'), {
          recursive: true,
          force: true,
        });
      } catch {
        // Ignore errors when cleaning _npx directory - it may not exist or be in use
      }

      try {
        await fs.rm(path.join(npmDir, '_cacache'), {
          recursive: true,
          force: true,
        });
      } catch {
        // Ignore errors when cleaning _cacache directory - it may not exist or be in use
      }
    } catch {
      // npm directory doesn't exist
    }
  }

  async uninstall(): Promise<void> {
    this.logger.info(
      'System checker cannot be uninstalled as it provides diagnostic functionality'
    );
  }
}
