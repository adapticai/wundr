/**
 * Node.js Installer - Cross-platform Node.js and package manager setup
 */
import * as os from 'os';
import * as path from 'path';

import { execa } from 'execa';
import * as fs from 'fs-extra';
import which from 'which';

import { Logger } from '../utils/logger';

import type { SetupPlatform, SetupStep, DeveloperProfile } from '../types';
import type { BaseInstaller } from './index';

const logger = new Logger({ name: 'NodeInstaller' });

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
    const nodeConfig = profile.tools?.languages?.node;
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
    logger.info(`Configuring Node.js environment on ${platform.os} (${platform.arch})`);

    // Configure npm
    await this.configureNPM(profile);

    // Setup .nvmrc for projects (NVM is not supported on Windows)
    if (platform.os !== 'win32') {
      await this.setupNVMRC(profile);
    }

    // Configure package managers
    await this.configurePackageManagers(profile);
  }

  async validate(): Promise<boolean> {
    try {
      const nodeVersion = await this.getVersion();
      if (!nodeVersion) {
return false;
}

      const { stdout: npmVersion } = await execa('npm', ['--version']);
      return !!npmVersion;
    } catch {
      return false;
    }
  }

  getSteps(profile: DeveloperProfile, platform: SetupPlatform): SetupStep[] {
    const nodeConfig = profile.tools?.languages?.node;
    if (!nodeConfig) {
return [];
}

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
        installer: () => this.installNVM(platform),
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
        installer: () => this.installAllNodeVersions(nodeConfig.versions),
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
        installer: () => this.setDefaultNodeVersion(nodeConfig.defaultVersion),
      },
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
        installer: () => this.installGlobalPackages(nodeConfig.globalPackages),
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
    logger.info('Installing NVM (Node Version Manager)...');
    
    const homeDir = os.homedir();
    const nvmDir = path.join(homeDir, '.nvm');
    
    if (await fs.pathExists(nvmDir)) {
      logger.info('NVM already installed');
      return;
    }

    if (platform.os === 'win32') {
      throw new Error('NVM installation on Windows requires manual setup of nvm-windows');
    }

    try {
      // Install NVM
      const installScript = 'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash';
      await execa('bash', ['-c', installScript], { stdio: 'inherit' });
      
      // Setup environment for current session
      process.env.NVM_DIR = nvmDir;
      
      // Update shell profiles
      await this.setupNVMShellIntegration();

      logger.info('NVM installed successfully');
    } catch (error) {
      throw new Error(`NVM installation failed: ${error}`);
    }
  }

  private async installNodeVersion(version: string): Promise<void> {
    logger.info(`Installing Node.js v${version}...`);
    
    try {
      if (process.platform === 'win32') {
        await execa('nvm', ['install', version]);
      } else {
        const nvmScript = `
          export NVM_DIR="${os.homedir()}/.nvm"
          [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
          if ! nvm install ${version}; then
            echo "Warning: Failed to install Node.js v${version}, continuing..."
          fi
        `;
        await execa('bash', ['-c', nvmScript]);
      }
      logger.info(`Node.js v${version} installed successfully`);
    } catch (error) {
      logger.warn(`Warning: Failed to install Node.js v${version}: ${String(error)}`);
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
      logger.warn(`Warning: Failed to set default Node.js version to ${version}: ${String(error)}`);
      // Continue instead of throwing - non-critical failure
    }
  }

  private async installGlobalPackages(packages: string[]): Promise<void> {
    for (const pkg of packages) {
      try {
        // Use --force flag to handle existing packages
        await execa('npm', ['install', '-g', pkg, '--force']);
      } catch (error) {
        logger.warn(`Failed to install global package ${pkg}: ${String(error)}`);
      }
    }
  }

  private async installPackageManagers(profile: DeveloperProfile): Promise<void> {
    const packageManagers = profile.tools?.packageManagers;
    if (!packageManagers) {
return;
}

    // Install pnpm
    if (packageManagers.pnpm) {
      await this.installPnpm();
    }

    // Install yarn
    if (packageManagers?.yarn) {
      await this.installYarn(profile);
    }
  }

  private async installPnpm(): Promise<void> {
    logger.info('Installing pnpm...');
    
    try {
      // Check if already installed
      await which('pnpm');
      logger.info('pnpm already installed');
      await execa('npm', ['update', '-g', 'pnpm']);
      return;
    } catch {
      // Not installed, proceed with installation
    }

    try {
      // Use the official pnpm installation script
      await execa('bash', ['-c', 'curl -fsSL https://get.pnpm.io/install.sh | sh -']);
      
      // Setup environment
      const pnpmHome = path.join(os.homedir(), '.local', 'share', 'pnpm');
      process.env.PNPM_HOME = pnpmHome;
      process.env.PATH = `${pnpmHome}:${process.env.PATH}`;
      
      // Update shell profiles
      await this.updateShellWithPnpm(pnpmHome);
      
      // Configure pnpm
      await execa('pnpm', ['config', 'set', 'store-dir', path.join(os.homedir(), '.pnpm-store')]);
      await execa('pnpm', ['config', 'set', 'auto-install-peers', 'true']);
      await execa('pnpm', ['config', 'set', 'strict-peer-dependencies', 'false']);

      logger.info('pnpm installed and configured');
    } catch (error) {
      logger.warn(`Failed to install pnpm: ${String(error)}`);
    }
  }

  private async installYarn(profile: DeveloperProfile): Promise<void> {
    logger.info('Installing Yarn...');
    
    try {
      // Check if already installed
      await which('yarn');
      logger.info('Yarn already installed');
      return;
    } catch {
      // Not installed, proceed with installation
    }

    try {
      await execa('npm', ['install', '-g', 'yarn', '--force']);
      
      // Configure yarn
      if (profile.name) {
        await execa('yarn', ['config', 'set', 'init-author-name', profile.name]);
      }
      if (profile.email) {
        await execa('yarn', ['config', 'set', 'init-author-email', profile.email]);
      }
      await execa('yarn', ['config', 'set', 'init-license', 'MIT']);

      logger.info('Yarn installed and configured');
    } catch (error) {
      logger.warn(`Failed to install Yarn: ${String(error)}`);
    }
  }

  private async configureNPM(profile: DeveloperProfile): Promise<void> {
    logger.info('Configuring npm...');
    
    const homeDir = os.homedir();
    const npmGlobalDir = path.join(homeDir, '.npm-global');
    
    try {
      // Create npm-global directory structure
      await fs.ensureDir(path.join(npmGlobalDir, 'lib'));
      await fs.ensureDir(path.join(npmGlobalDir, 'bin'));
      
      // Set npm prefix before any global installs
      await execa('npm', ['config', 'set', 'prefix', npmGlobalDir]);
      
      // Configure npm settings
      if (profile.name) {
        await execa('npm', ['config', 'set', 'init-author-name', profile.name]);
      }
      if (profile.email) {
        await execa('npm', ['config', 'set', 'init-author-email', profile.email]);
      }
      await execa('npm', ['config', 'set', 'init-license', 'MIT']);
      
      // Update npm after setting prefix
      await execa('npm', ['install', '-g', 'npm@latest', '--force']);
      
      // Update shell profiles to include npm global bin
      await this.updateShellWithNpmGlobal(npmGlobalDir);
      
      logger.info('npm configured successfully');
    } catch (error) {
      logger.warn('npm configuration failed:', String(error));
    }
  }

  private async setupNVMRC(profile: DeveloperProfile): Promise<void> {
    const nodeConfig = profile.tools?.languages?.node;
    if (!nodeConfig) {
return;
}

    // This could be used to create .nvmrc files in common project directories
    // For now, just ensure the user knows about .nvmrc
  }

  private async configurePackageManagers(profile: DeveloperProfile): Promise<void> {
    const packageManagers = profile.tools?.packageManagers;
    if (!packageManagers) {
return;
}

    // Configure pnpm if installed
    if (packageManagers.pnpm) {
      try {
        await execa('pnpm', ['config', 'set', 'auto-install-peers', 'true']);
      } catch (error) {
        logger.warn('Failed to configure pnpm:', String(error));
      }
    }

    // Configure yarn if installed
    if (packageManagers.yarn) {
      try {
        // Set yarn version to berry if specified
        await execa('yarn', ['set', 'version', 'stable']);
      } catch (error) {
        logger.warn('Failed to configure yarn:', String(error));
      }
    }
  }

  private async validateNodeVersions(versions: string[]): Promise<boolean> {
    try {
      // Check if each version is installed via NVM
      const nvmScript = `
        export NVM_DIR="${os.homedir()}/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
        nvm ls
      `;
      const { stdout } = await execa('bash', ['-c', nvmScript]);

      // Check if all requested versions are present in NVM list
      for (const version of versions) {
        if (!stdout.includes(version)) {
          logger.info(`Node.js v${version} not found in NVM`);
          return false;
        }
      }
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

  private async setupNVMShellIntegration(): Promise<void> {
    const homeDir = os.homedir();
    const shellFiles = ['.zshrc', '.bashrc'];
    
    const nvmConfig = `
# NVM Configuration
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \\. "$NVM_DIR/bash_completion"

# Auto use .nvmrc
autoload -U add-zsh-hook
load-nvmrc() {
  local node_version="$(nvm version)"
  local nvmrc_path="$(nvm_find_nvmrc)"

  if [ -n "$nvmrc_path" ]; then
    local nvmrc_node_version=$(nvm version "$(cat "$nvmrc_path")")

    if [ "$nvmrc_node_version" = "N/A" ]; then
      nvm install
    elif [ "$nvmrc_node_version" != "$node_version" ]; then
      nvm use
    fi
  elif [ "$node_version" != "$(nvm version default)" ]; then
    echo "Reverting to nvm default version"
    nvm use default
  fi
}
add-zsh-hook chpwd load-nvmrc
load-nvmrc
`;

    for (const shellFile of shellFiles) {
      const shellPath = path.join(homeDir, shellFile);
      
      try {
        let shellContent = '';
        try {
          shellContent = await fs.readFile(shellPath, 'utf-8');
        } catch {
          // File doesn't exist, will be created
        }

        // Check if NVM is already configured
        if (shellContent.includes('NVM_DIR')) {
          continue;
        }

        await fs.writeFile(shellPath, shellContent + nvmConfig, 'utf-8');
        logger.info(`Updated ${shellFile} with NVM configuration`);
      } catch (error) {
        logger.warn(`Failed to update ${shellFile}:`, String(error));
      }
    }
  }

  private async updateShellWithNpmGlobal(npmGlobalDir: string): Promise<void> {
    const homeDir = os.homedir();
    const shellFiles = ['.zshrc', '.bashrc'];
    const npmPath = path.join(npmGlobalDir, 'bin');
    
    const npmConfig = `
# NPM Global Path
export PATH="${npmPath}:$PATH"
`;

    for (const shellFile of shellFiles) {
      const shellPath = path.join(homeDir, shellFile);
      
      try {
        let shellContent = '';
        try {
          shellContent = await fs.readFile(shellPath, 'utf-8');
        } catch {
          // File doesn't exist, will be created
        }

        // Check if npm global is already configured
        if (shellContent.includes(npmPath)) {
          continue;
        }

        await fs.writeFile(shellPath, shellContent + npmConfig, 'utf-8');
        logger.info(`Updated ${shellFile} with npm global path`);
      } catch (error) {
        logger.warn(`Failed to update ${shellFile}:`, String(error));
      }
    }
  }

  private async updateShellWithPnpm(pnpmHome: string): Promise<void> {
    const homeDir = os.homedir();
    const shellFiles = ['.zshrc', '.bashrc'];
    
    const pnpmConfig = `
# pnpm
export PNPM_HOME="${pnpmHome}"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac
`;

    for (const shellFile of shellFiles) {
      const shellPath = path.join(homeDir, shellFile);
      
      try {
        let shellContent = '';
        try {
          shellContent = await fs.readFile(shellPath, 'utf-8');
        } catch {
          // File doesn't exist, will be created
        }

        // Check if pnpm is already configured
        if (shellContent.includes('PNPM_HOME')) {
          continue;
        }

        await fs.writeFile(shellPath, shellContent + pnpmConfig, 'utf-8');
        logger.info(`Updated ${shellFile} with pnpm configuration`);
      } catch (error) {
        logger.warn(`Failed to update ${shellFile}:`, String(error));
      }
    }
  }
}