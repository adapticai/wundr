/**
 * Homebrew Installer - macOS/Linux package manager setup
 */
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { execa } from 'execa';
import which from 'which';

import { Logger } from '../utils/logger';

import type { SetupPlatform, SetupStep, DeveloperProfile } from '../types';
import type { BaseInstaller } from './index';

const logger = new Logger({ name: 'homebrew-installer' });

export class HomebrewInstaller implements BaseInstaller {
  name = 'homebrew';
  private readonly homeDir = os.homedir();
  
  isSupported(platform: SetupPlatform): boolean {
    return ['darwin', 'linux'].includes(platform.os);
  }

  async isInstalled(): Promise<boolean> {
    try {
      await which('brew');
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string | null> {
    try {
      const { stdout } = await execa('brew', ['--version']);
      return stdout.split('\n')[0].trim();
    } catch {
      return null;
    }
  }

  async install(_profile: DeveloperProfile, platform: SetupPlatform): Promise<void> {
    if (await this.isInstalled()) {
      logger.info('Homebrew already installed, updating...');
      await this.updateHomebrew();
      return;
    }

    logger.info('Installing Homebrew...');
    await this.installHomebrew(platform);

    // Install core development tools
    await this.installCoreTools();
    await this.installDevTools();
  }

  async configure(_profile: DeveloperProfile, platform: SetupPlatform): Promise<void> {
    // Configure Homebrew settings
    await this.configureHomebrew();

    // Setup shell integration
    await this.setupShellIntegration(platform);

    // Setup aliases
    await this.setupAliases();
  }

  async validate(): Promise<boolean> {
    try {
      // Check if brew command works
      await execa('brew', ['--version']);

      // Check if core tools are available
      const coreTools = ['git', 'curl', 'jq'];
      for (const tool of coreTools) {
        try {
          await which(tool);
        } catch {
          logger.warn(`Core tool ${tool} not found`);
          return false;
        }
      }

      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Homebrew validation failed:', errorMessage);
      return false;
    }
  }

  getSteps(profile: DeveloperProfile, platform: SetupPlatform): SetupStep[] {
    const steps: SetupStep[] = [
      {
        id: 'install-homebrew',
        name: 'Install Homebrew',
        description: 'Install Homebrew package manager',
        category: 'system',
        required: true,
        dependencies: [],
        estimatedTime: 180,
        validator: () => this.isInstalled(),
        installer: () => this.install(profile, platform),
      },
      {
        id: 'configure-homebrew',
        name: 'Configure Homebrew',
        description: 'Configure Homebrew settings and shell integration',
        category: 'system',
        required: true,
        dependencies: ['install-homebrew'],
        estimatedTime: 30,
        validator: () => this.validate(),
        installer: () => this.configure(profile, platform),
      },
    ];

    return steps;
  }

  private async installHomebrew(platform: SetupPlatform): Promise<void> {
    const installScript = 'https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh';
    
    try {
      // Download and run the Homebrew installation script
      await execa('/bin/bash', ['-c', `curl -fsSL ${installScript} | bash`], {
        stdio: 'inherit',
      });
      
      // Setup PATH for current session
      await this.setupBrewPath(platform);
      
    } catch (error) {
      throw new Error(`Homebrew installation failed: ${error}`);
    }
  }

  private async setupBrewPath(platform: SetupPlatform): Promise<void> {
    const brewPaths = platform.os === 'darwin' 
      ? ['/opt/homebrew/bin/brew', '/usr/local/bin/brew']
      : ['/home/linuxbrew/.linuxbrew/bin/brew'];

    for (const brewPath of brewPaths) {
      try {
        await fs.access(brewPath);
        const brewDir = path.dirname(brewPath);
        
        // Add to current PATH
        process.env.PATH = `${brewDir}:${process.env.PATH}`;
        
        // Setup shellenv for current session
        const { stdout } = await execa(brewPath, ['shellenv']);
        const envVars = stdout.split('\n').filter(line => line.startsWith('export'));
        
        for (const envVar of envVars) {
          const [, key, value] = envVar.match(/export ([^=]+)="?([^"]*)"?/) || [];
          if (key && value) {
            process.env[key] = value;
          }
        }
        
        return;
      } catch {
        continue;
      }
    }
    
    throw new Error('Homebrew installation path not found');
  }

  private async updateHomebrew(): Promise<void> {
    try {
      logger.info('Updating Homebrew...');
      await execa('brew', ['update'], { stdio: 'inherit' });

      logger.info('Upgrading installed packages...');
      await execa('brew', ['upgrade'], { stdio: 'inherit' });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn('Homebrew update failed:', errorMessage);
    }
  }

  private async installCoreTools(): Promise<void> {
    const coreFormulas = [
      'git',
      'gh',
      'curl',
      'wget',
      'jq',
      'tree',
      'htop',
      'tmux',
      'ripgrep',
      'fzf',
      'bat',
      'eza',
      'fd',
      'direnv',
      'watchman',
      'gnupg',
      'openssh',
      'coreutils',
    ];

    logger.info('Installing core development tools...');

    for (const formula of coreFormulas) {
      try {
        // Check if already installed
        await execa('brew', ['list', formula]);
        logger.info(`${formula} already installed`);
      } catch {
        try {
          logger.info(`Installing ${formula}...`);
          await execa('brew', ['install', formula]);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.warn(`Failed to install ${formula}:`, errorMessage);
        }
      }
    }
  }

  private async installDevTools(): Promise<void> {
    const devFormulas = [
      'make',
      'cmake',
      'gcc',
      'python@3.12',
      'python-setuptools',
      'go',
      'rust',
      'sqlite',
      'postgresql@15',
      'redis',
      'nginx',
    ];

    logger.info('Installing development tools...');

    for (const formula of devFormulas) {
      try {
        // Check if already installed
        await execa('brew', ['list', formula]);
        logger.info(`${formula} already installed`);
      } catch {
        try {
          logger.info(`Installing ${formula}...`);
          await execa('brew', ['install', formula]);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.warn(`Warning: Failed to install ${formula}:`, errorMessage);
        }
      }
    }
  }

  private async configureHomebrew(): Promise<void> {
    logger.info('Configuring Homebrew settings...');

    // Disable analytics
    process.env.HOMEBREW_NO_ANALYTICS = '1';

    try {
      await execa('brew', ['analytics', 'off']);
    } catch {
      // Ignore error if analytics command is not available
      logger.debug('Analytics command not available or already disabled');
    }
  }

  private async setupShellIntegration(platform: SetupPlatform): Promise<void> {
    const shellFiles = ['.zshrc', '.bashrc'];
    const brewPath = platform.os === 'darwin' 
      ? '/opt/homebrew/bin/brew' 
      : '/home/linuxbrew/.linuxbrew/bin/brew';

    for (const shellFile of shellFiles) {
      const shellPath = path.join(this.homeDir, shellFile);
      
      try {
        let shellContent = '';
        try {
          shellContent = await fs.readFile(shellPath, 'utf-8');
        } catch {
          // File doesn't exist, will be created
        }

        // Check if Homebrew is already configured
        if (shellContent.includes('brew shellenv')) {
          continue;
        }

        const homebrewConfig = `
# Homebrew
if [[ -f "${brewPath}" ]]; then
    eval "$(${brewPath} shellenv)"
fi
export HOMEBREW_NO_ANALYTICS=1
`;

        await fs.writeFile(shellPath, shellContent + homebrewConfig, 'utf-8');
        logger.info(`Updated ${shellFile} with Homebrew configuration`);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn(`Failed to update ${shellFile}:`, errorMessage);
      }
    }
  }

  private async setupAliases(): Promise<void> {
    const aliases = `
# Homebrew aliases
alias brewup='brew update && brew upgrade && brew cleanup'
alias brewinfo='brew info'
alias brewsearch='brew search'
alias brewdeps='brew deps --tree --installed'
alias brewclean='brew cleanup && brew doctor'
`;

    const shellFiles = ['.zshrc', '.bashrc'];
    
    for (const shellFile of shellFiles) {
      const shellPath = path.join(this.homeDir, shellFile);
      
      try {
        let shellContent = '';
        try {
          shellContent = await fs.readFile(shellPath, 'utf-8');
        } catch {
          // File doesn't exist, will be created
        }

        // Check if aliases are already configured
        if (shellContent.includes('alias brewup=')) {
          continue;
        }

        await fs.writeFile(shellPath, shellContent + aliases, 'utf-8');
        logger.info(`Added Homebrew aliases to ${shellFile}`);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn(`Failed to update ${shellFile} with aliases:`, errorMessage);
      }
    }
  }

  async uninstall(): Promise<void> {
    logger.info('Uninstalling Homebrew...');
    
    try {
      const uninstallScript = 'https://raw.githubusercontent.com/Homebrew/install/HEAD/uninstall.sh';
      await execa('/bin/bash', ['-c', `curl -fsSL ${uninstallScript} | bash`], {
        stdio: 'inherit',
      });
    } catch (error) {
      throw new Error(`Homebrew uninstallation failed: ${error}`);
    }
  }
}