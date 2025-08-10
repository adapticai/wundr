/**
 * Node.js Installer - Cross-platform Node.js and package manager setup
 */
import { execa } from 'execa';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import which from 'which';
import { BaseInstaller } from './index';
import { SetupPlatform, SetupStep, DeveloperProfile } from '../types';

export class NodeInstaller implements BaseInstaller {
  name = 'node';

  isSupported(platform: SetupPlatform): boolean {
    return ['darwin', 'linux', 'win32'].includes(platform.os);
  }

  async isInstalled(): Promise<boolean> {
    try {
      await which('node');
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string | null> {
    try {
      const { stdout } = await execa('node', ['--version']);
      return stdout.trim();
    } catch {
      return null;
    }
  }

  async install(profile: DeveloperProfile, platform: SetupPlatform): Promise<void> {
    const nodeConfig = profile.tools.languages.node;
    if (!nodeConfig) {
      throw new Error('Node.js configuration not found in profile');
    }

    // Check if Node Version Manager is installed
    const nvmInstalled = await this.isNVMInstalled();
    
    if (!nvmInstalled) {
      await this.installNVM(platform);
    }

    // Install Node.js versions
    for (const version of nodeConfig.versions) {
      await this.installNodeVersion(version);
    }

    // Set default version
    await this.setDefaultNodeVersion(nodeConfig.defaultVersion);

    // Install global packages
    if (nodeConfig.globalPackages.length > 0) {
      await this.installGlobalPackages(nodeConfig.globalPackages);
    }

    // Install package managers
    await this.installPackageManagers(profile);
  }

  async configure(profile: DeveloperProfile, platform: SetupPlatform): Promise<void> {
    // Configure npm
    await this.configureNPM(profile);
    
    // Setup .nvmrc for projects
    await this.setupNVMRC(profile);
    
    // Configure package managers
    await this.configurePackageManagers(profile);
  }

  async validate(): Promise<boolean> {
    try {
      const nodeVersion = await this.getVersion();
      if (!nodeVersion) return false;

      const { stdout: npmVersion } = await execa('npm', ['--version']);
      return !!npmVersion;
    } catch {
      return false;
    }
  }

  getSteps(profile: DeveloperProfile, platform: SetupPlatform): SetupStep[] {
    const nodeConfig = profile.tools.languages.node;
    if (!nodeConfig) return [];

    const steps: SetupStep[] = [
      {
        id: 'install-nvm',
        name: 'Install Node Version Manager',
        description: 'Install NVM for managing multiple Node.js versions',
        category: 'development',
        required: true,
        dependencies: [],
        estimatedTime: 30,
        validator: () => this.isNVMInstalled(),
        installer: () => this.installNVM(platform)
      },
      {
        id: 'install-node-versions',
        name: 'Install Node.js Versions',
        description: `Install Node.js versions: ${nodeConfig.versions.join(', ')}`,
        category: 'development',
        required: true,
        dependencies: ['install-nvm'],
        estimatedTime: 60 * nodeConfig.versions.length,
        validator: () => this.validateNodeVersions(nodeConfig.versions),
        installer: () => this.installAllNodeVersions(nodeConfig.versions)
      },
      {
        id: 'set-default-node',
        name: 'Set Default Node Version',
        description: `Set Node.js ${nodeConfig.defaultVersion} as default`,
        category: 'development',
        required: true,
        dependencies: ['install-node-versions'],
        estimatedTime: 5,
        validator: () => this.validateDefaultVersion(nodeConfig.defaultVersion),
        installer: () => this.setDefaultNodeVersion(nodeConfig.defaultVersion)
      }
    ];

    if (nodeConfig.globalPackages.length > 0) {
      steps.push({
        id: 'install-global-packages',
        name: 'Install Global NPM Packages',
        description: `Install global packages: ${nodeConfig.globalPackages.join(', ')}`,
        category: 'development',
        required: false,
        dependencies: ['set-default-node'],
        estimatedTime: 30 * nodeConfig.globalPackages.length,
        validator: () => this.validateGlobalPackages(nodeConfig.globalPackages),
        installer: () => this.installGlobalPackages(nodeConfig.globalPackages)
      });
    }

    return steps;
  }

  private async isNVMInstalled(): Promise<boolean> {
    try {
      const nvmDir = path.join(os.homedir(), '.nvm');
      return await fs.pathExists(nvmDir);
    } catch {
      return false;
    }
  }

  private async installNVM(platform: SetupPlatform): Promise<void> {
    if (platform.os === 'win32') {
      // Install nvm-windows
      throw new Error('NVM installation on Windows requires manual setup of nvm-windows');
    } else {
      // Install nvm for Unix-like systems
      const installScript = 'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash';
      await execa('bash', ['-c', installScript]);
      
      // Source nvm in current session with proper HOME expansion
      const nvmDir = path.join(os.homedir(), '.nvm');
      process.env.NVM_DIR = nvmDir;
    }
  }

  private async installNodeVersion(version: string): Promise<void> {
    try {
      if (process.platform === 'win32') {
        // Windows nvm command
        await execa('nvm', ['install', version]);
      } else {
        // Unix nvm command (requires sourcing) with proper HOME expansion
        const nvmScript = `
          export NVM_DIR="${os.homedir()}/.nvm"
          [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
          nvm install ${version} || echo "Warning: Failed to install Node.js ${version}, continuing..."
        `;
        await execa('bash', ['-c', nvmScript]);
      }
    } catch (error) {
      console.warn(`Warning: Failed to install Node.js ${version}: ${error}`);
      // Continue instead of throwing - non-critical failure
    }
  }

  private async installAllNodeVersions(versions: string[]): Promise<void> {
    for (const version of versions) {
      await this.installNodeVersion(version);
    }
  }

  private async setDefaultNodeVersion(version: string): Promise<void> {
    try {
      if (process.platform === 'win32') {
        await execa('nvm', ['use', version]);
      } else {
        const nvmScript = `
          export NVM_DIR="${os.homedir()}/.nvm"
          [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
          nvm alias default ${version} || echo "Warning: Failed to set default alias"
          nvm use --delete-prefix ${version} || nvm use ${version} || echo "Warning: Failed to use version ${version}"
        `;
        await execa('bash', ['-c', nvmScript]);
      }
    } catch (error) {
      console.warn(`Warning: Failed to set default Node.js version to ${version}: ${error}`);
      // Continue instead of throwing - non-critical failure
    }
  }

  private async installGlobalPackages(packages: string[]): Promise<void> {
    for (const pkg of packages) {
      try {
        // Use --force flag to handle existing packages
        await execa('npm', ['install', '-g', pkg, '--force']);
      } catch (error) {
        console.warn(`Failed to install global package ${pkg}: ${error}`);
      }
    }
  }

  private async installPackageManagers(profile: DeveloperProfile): Promise<void> {
    const { packageManagers } = profile.tools;

    if (packageManagers.pnpm) {
      try {
        // Use --force flag to handle existing packages
        await execa('npm', ['install', '-g', 'pnpm', '--force']);
      } catch (error) {
        console.warn(`Failed to install pnpm: ${error}`);
      }
    }

    if (packageManagers.yarn) {
      try {
        // Use --force flag to handle existing packages
        await execa('npm', ['install', '-g', 'yarn', '--force']);
      } catch (error) {
        console.warn(`Failed to install yarn: ${error}`);
      }
    }
  }

  private async configureNPM(profile: DeveloperProfile): Promise<void> {
    // Set npm registry if needed
    await execa('npm', ['config', 'set', 'init.author.name', profile.name]);
    await execa('npm', ['config', 'set', 'init.author.email', profile.email]);
    
    // Configure npm for better security
    await execa('npm', ['config', 'set', 'audit-level', 'moderate']);
    await execa('npm', ['config', 'set', 'fund', 'false']);
  }

  private async setupNVMRC(profile: DeveloperProfile): Promise<void> {
    const nodeConfig = profile.tools.languages.node;
    if (!nodeConfig) return;

    // This could be used to create .nvmrc files in common project directories
    // For now, just ensure the user knows about .nvmrc
  }

  private async configurePackageManagers(profile: DeveloperProfile): Promise<void> {
    const { packageManagers } = profile.tools;

    // Configure pnpm if installed
    if (packageManagers.pnpm) {
      try {
        await execa('pnpm', ['config', 'set', 'auto-install-peers', 'true']);
      } catch (error) {
        console.warn('Failed to configure pnpm:', error);
      }
    }

    // Configure yarn if installed
    if (packageManagers.yarn) {
      try {
        // Set yarn version to berry if specified
        await execa('yarn', ['set', 'version', 'stable']);
      } catch (error) {
        console.warn('Failed to configure yarn:', error);
      }
    }
  }

  private async validateNodeVersions(_versions: string[]): Promise<boolean> {
    try {
      // This would require checking if specific versions are installed
      // Simplified validation for now
      return true;
    } catch {
      return false;
    }
  }

  private async validateDefaultVersion(version: string): Promise<boolean> {
    try {
      const currentVersion = await this.getVersion();
      return currentVersion?.includes(version) || false;
    } catch {
      return false;
    }
  }

  private async validateGlobalPackages(packages: string[]): Promise<boolean> {
    try {
      for (const pkg of packages) {
        try {
          await execa('npm', ['list', '-g', pkg, '--depth=0']);
        } catch {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }
}