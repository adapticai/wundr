/**
 * Simple Profile Personalizer - Basic implementation without optional dependencies
 */

import { Logger } from '../utils/logger';

const logger = new Logger({ name: 'profile-personalizer-simple' });

export interface ProfileConfig {
  fullName: string;
  role: string;
  jobTitle?: string;
  company?: string;
  email?: string;
  location?: string;
  platforms?: {
    slack?: boolean;
    gmail?: boolean;
  };
}

export class ProfilePersonalizerSimple {
  constructor(private config: ProfileConfig) {}

  async personalize(): Promise<void> {
    logger.info(`Personalizing profile for ${this.config.fullName}...`);

    // Basic personalization without complex dependencies
    await this.setupGitConfig();
    await this.createDirectories();

    logger.info('Basic profile personalization completed');
  }

  private async setupGitConfig(): Promise<void> {
    try {
      const { execa } = await import('execa');
      await execa('git', [
        'config',
        '--global',
        'user.name',
        this.config.fullName,
      ]);
      if (this.config.email) {
        await execa('git', [
          'config',
          '--global',
          'user.email',
          this.config.email,
        ]);
      }
      logger.info('Git configuration updated');
    } catch (error) {
      logger.warn('Could not configure Git:', (error as Error).message);
    }
  }

  private async createDirectories(): Promise<void> {
    try {
      const { promises: fs } = await import('fs');
      const os = await import('os');
      const path = await import('path');

      const homeDir = os.homedir();
      const devDir = path.join(homeDir, 'Development');

      const directories = [
        devDir,
        path.join(devDir, 'projects'),
        path.join(devDir, 'tools'),
        path.join(devDir, 'sandbox'),
      ];

      for (const dir of directories) {
        await fs.mkdir(dir, { recursive: true });
      }

      logger.info('Development directories created');
    } catch (error) {
      logger.warn('Could not create directories:', (error as Error).message);
    }
  }
}
