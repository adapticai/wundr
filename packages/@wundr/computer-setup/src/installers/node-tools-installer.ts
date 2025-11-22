/**
 * Node.js Tools Installer - Complete Node.js ecosystem setup
 * Ports functionality from 03-node-tools.sh
 */
import { execa } from 'execa';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';
import which from 'which';
import { BaseInstaller } from './index';
import { SetupPlatform, SetupStep, DeveloperProfile } from '../types';

export class NodeToolsInstaller implements BaseInstaller {
  name = 'node-tools';
  private readonly homeDir = os.homedir();
  
  isSupported(platform: SetupPlatform): boolean {
    return ['darwin', 'linux'].includes(platform.os);
  }

  async isInstalled(): Promise<boolean> {
    try {
      // Check if NVM is installed
      await fs.access(path.join(this.homeDir, '.nvm'));
      
      // Check if Node is available
      await which('node');
      
      // Check if npm is working
      await execa('npm', ['--version']);
      
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string | null> {
    try {
      const nodeVersion = await execa('node', ['--version']);
      const npmVersion = await execa('npm', ['--version']);
      return `Node ${nodeVersion.stdout.trim()}, npm ${npmVersion.stdout.trim()}`;
    } catch {
      return null;
    }
  }

  async install(profile: DeveloperProfile, platform: SetupPlatform): Promise<void> {
    console.log(`Installing Node.js tools on ${platform.os}...`);

    // Clear any npm conflicts before starting
    await this.clearNpmConflicts();

    // Install NVM
    await this.installNVM();

    // Install Node.js versions
    await this.installNodeVersions();

    // Configure npm
    await this.configureNpm(profile);

    // Install pnpm
    await this.installPnpm();

    // Install Yarn
    await this.installYarn(profile);

    // Install global packages
    await this.installGlobalPackages();

    // Setup aliases
    await this.setupNodeAliases();
  }

  async configure(profile: DeveloperProfile, platform: SetupPlatform): Promise<void> {
    // Log configuration context for debugging
    console.log(`Node.js tools configured for ${profile.name || 'user'} on ${platform.os}`);
  }

  async validate(): Promise<boolean> {
    try {
      // Check NVM
      const nvmDir = path.join(this.homeDir, '.nvm');
      await fs.access(nvmDir);
      
      // Check Node.js
      await execa('node', ['--version']);
      
      // Check npm
      await execa('npm', ['--version']);
      
      // Check package managers
      try {
        await which('pnpm');
        await which('yarn');
      } catch {
        console.warn('Some package managers not found, but basic Node.js setup is working');
      }
      
      return true;
    } catch (error) {
      console.error('Node.js tools validation failed:', error);
      return false;
    }
  }

  getSteps(profile: DeveloperProfile, platform: SetupPlatform): SetupStep[] {
    return [{
      id: 'install-node-tools',
      name: 'Install Node.js Tools',
      description: 'Install NVM, Node.js, npm, pnpm, Yarn and essential packages',
      category: 'development',
      required: true,
      dependencies: [],
      estimatedTime: 300,
      validator: () => this.validate(),
      installer: () => this.install(profile, platform)
    }];
  }

  private async installNVM(): Promise<void> {
    console.log('Installing NVM (Node Version Manager)...');
    
    const nvmDir = path.join(this.homeDir, '.nvm');
    
    try {
      await fs.access(nvmDir);
      console.log('NVM already installed');
      
      // Ensure NVM is properly loaded
      process.env.NVM_DIR = nvmDir;
      return;
    } catch {
      // Install NVM
      const installScript = 'https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh';
      await execa('curl', ['-o-', installScript, '|', 'bash'], { shell: true });
      
      process.env.NVM_DIR = nvmDir;
      
      // Add NVM configuration to shell files
      await this.setupNVMInShells();
      
      console.log('NVM installed successfully');
    }
  }

  private async setupNVMInShells(): Promise<void> {
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
    local nvmrc_node_version=$(nvm version "$(cat "\${nvmrc_path}")")

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

    const shellFiles = ['.zshrc', '.bashrc'];
    
    for (const shellFile of shellFiles) {
      const shellPath = path.join(this.homeDir, shellFile);
      
      try {
        let shellContent = '';
        try {
          shellContent = await fs.readFile(shellPath, 'utf-8');
        } catch {
          // File doesn't exist
        }
        
        // Check if NVM is already configured
        if (shellContent.includes('NVM_DIR')) {
          continue;
        }
        
        await fs.writeFile(shellPath, shellContent + nvmConfig, 'utf-8');
        console.log(`Updated ${shellFile} with NVM configuration`);
      } catch (error) {
        console.warn(`Failed to update ${shellFile}:`, error);
      }
    }
  }

  private async installNodeVersions(): Promise<void> {
    console.log('Installing Node.js versions...');
    
    // Clear npm conflicts before using nvm
    await this.clearNpmConflicts();
    
    const nvmScript = path.join(this.homeDir, '.nvm/nvm.sh');
    
    try {
      await fs.access(nvmScript);
    } catch {
      console.warn('NVM script not found, skipping Node.js installation');
      return;
    }
    
    // Check if npm is completely broken first
    try {
      await execa('npm', ['--version']);
    } catch {
      console.log('Detected broken npm, forcing Node.js reinstallation...');
      
      try {
        // Try to get current version and reinstall
        const { stdout } = await execa('bash', ['-c', `source ${nvmScript} && nvm current`]);
        const currentVersion = stdout.trim();
        
        if (currentVersion !== 'none' && currentVersion !== 'system') {
          console.log(`Reinstalling Node.js ${currentVersion} to fix npm...`);
          await execa('bash', ['-c', `source ${nvmScript} && nvm uninstall ${currentVersion} || true`]);
          await execa('bash', ['-c', `source ${nvmScript} && nvm install ${currentVersion}`]);
        }
      } catch (error) {
        console.warn('Failed to reinstall current Node.js version:', error);
      }
    }
    
    // Install LTS and current versions
    const nodeVersions = ['lts/*', 'node'];
    
    for (const version of nodeVersions) {
      try {
        console.log(`Installing Node.js ${version}...`);
        await execa('bash', ['-c', `source ${nvmScript} && nvm install ${version}`]);
      } catch (error) {
        console.warn(`Failed to install Node.js ${version}:`, error);
      }
    }
    
    // Set default to LTS
    try {
      await execa('bash', ['-c', `source ${nvmScript} && nvm alias default lts/* && nvm use default`]);
    } catch (error) {
      console.warn('Failed to set default Node.js version:', error);
    }
    
    console.log('Node.js versions installation completed');
  }

  private async configureNpm(profile: DeveloperProfile): Promise<void> {
    console.log('Configuring npm...');
    
    // Clear conflicts one more time
    await this.clearNpmConflicts();
    
    // Create npm-global directory for global packages
    const npmGlobalDir = path.join(this.homeDir, '.npm-global');
    try {
      await fs.mkdir(npmGlobalDir, { recursive: true });
      console.log(`Created npm global directory at ${npmGlobalDir}`);
    } catch {
      // Directory already exists
    }
    
    // Configure npm to use custom global directory
    try {
      await execa('npm', ['config', 'set', 'prefix', npmGlobalDir]);
    } catch (error) {
      console.warn('Failed to set npm prefix:', error);
    }
    
    // Add npm-global/bin to PATH in shell files
    await this.addNpmGlobalToPath();
    
    // Update npm to latest version
    console.log('Updating npm to latest version...');
    try {
      await execa('npm', ['install', '-g', 'npm@latest']);
    } catch (error) {
      console.warn('npm update failed, trying alternative approach:', error);
      
      try {
        await execa('npx', ['npm@latest', 'install', '-g', 'npm@latest']);
      } catch (altError) {
        console.warn('Alternative npm update also failed:', altError);
      }
    }
    
    // Set npm configuration based on profile
    const configs = [
      ['init-author-name', profile.name || ''],
      ['init-author-email', profile.email || ''],
      ['init-license', 'MIT']
    ];
    
    // Set init-author-url if company is provided and looks like URL
    if (profile.company) {
      const companyUrl = profile.company.startsWith('http') ? profile.company : `https://${profile.company}`;
      configs.push(['init-author-url', companyUrl]);
    }
    
    for (const [key, value] of configs) {
      if (value) {
        try {
          await execa('npm', ['config', 'set', key, value]);
        } catch (error) {
          console.warn(`Failed to set npm config ${key}:`, error);
        }
      }
    }
    
    console.log('npm configured');
  }

  private async addNpmGlobalToPath(): Promise<void> {
    const npmGlobalBin = path.join(this.homeDir, '.npm-global/bin');
    const pathExport = `export PATH="${npmGlobalBin}:$PATH"`;
    
    const shellFiles = ['.zshrc', '.bashrc'];
    
    for (const shellFile of shellFiles) {
      const shellPath = path.join(this.homeDir, shellFile);
      
      try {
        let shellContent = '';
        try {
          shellContent = await fs.readFile(shellPath, 'utf-8');
        } catch {
          // File doesn't exist
        }
        
        if (!shellContent.includes('.npm-global/bin')) {
          await fs.writeFile(shellPath, shellContent + '\n' + pathExport + '\n', 'utf-8');
        }
      } catch (error) {
        console.warn(`Failed to update ${shellFile}:`, error);
      }
    }
    
    // Add to current process PATH
    process.env.PATH = `${npmGlobalBin}:${process.env.PATH}`;
  }

  private async installPnpm(): Promise<void> {
    console.log('Installing pnpm...');
    
    try {
      await which('pnpm');
      console.log('pnpm already installed, updating...');
      await execa('npm', ['update', '-g', 'pnpm']);
    } catch {
      try {
        // Install via official installer
        await execa('curl', ['-fsSL', 'https://get.pnpm.io/install.sh', '|', 'sh', '-'], { shell: true });
      } catch {
        // Fallback to npm
        console.log('pnpm installer failed, trying npm...');
        await execa('npm', ['install', '-g', 'pnpm', '--force']);
      }
      
      // Setup pnpm PATH
      await this.setupPnpmPath();
    }
    
    // Configure pnpm if available
    try {
      await which('pnpm');
      await execa('pnpm', ['config', 'set', 'store-dir', path.join(this.homeDir, '.pnpm-store')]);
      await execa('pnpm', ['config', 'set', 'auto-install-peers', 'true']);
      await execa('pnpm', ['config', 'set', 'strict-peer-dependencies', 'false']);
    } catch (error) {
      console.warn('Failed to configure pnpm:', error);
    }
    
    console.log('pnpm installed and configured');
  }

  private async setupPnpmPath(): Promise<void> {
    const possiblePnpmDirs = [
      path.join(this.homeDir, 'Library/pnpm'),
      path.join(this.homeDir, '.local/share/pnpm'),
      path.join(this.homeDir, '.pnpm')
    ];
    
    let pnpmHome = '';
    for (const dir of possiblePnpmDirs) {
      try {
        await fs.access(dir);
        pnpmHome = dir;
        break;
      } catch {
        continue;
      }
    }
    
    if (!pnpmHome) {
      pnpmHome = possiblePnpmDirs[0]; // Default to first option
    }
    
    const pnpmConfig = `
# pnpm
export PNPM_HOME="${pnpmHome}"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac
`;
    
    const shellFiles = ['.zshrc', '.bashrc'];
    
    for (const shellFile of shellFiles) {
      const shellPath = path.join(this.homeDir, shellFile);
      
      try {
        let shellContent = '';
        try {
          shellContent = await fs.readFile(shellPath, 'utf-8');
        } catch {
          // File doesn't exist
        }
        
        if (!shellContent.includes('PNPM_HOME')) {
          await fs.writeFile(shellPath, shellContent + pnpmConfig, 'utf-8');
        }
      } catch (error) {
        console.warn(`Failed to update ${shellFile}:`, error);
      }
    }
    
    // Add to current process PATH
    process.env.PNPM_HOME = pnpmHome;
    process.env.PATH = `${pnpmHome}:${process.env.PATH}`;
  }

  private async installYarn(profile: DeveloperProfile): Promise<void> {
    console.log('Installing Yarn...');
    
    try {
      await which('yarn');
      console.log('Yarn already installed');
    } catch {
      await execa('npm', ['install', '-g', 'yarn', '--force']);
    }
    
    // Configure Yarn
    try {
      await execa('yarn', ['config', 'set', 'init-author-name', profile.name || '']);
      await execa('yarn', ['config', 'set', 'init-author-email', profile.email || '']);
      await execa('yarn', ['config', 'set', 'init-license', 'MIT']);
    } catch (error) {
      console.warn('Failed to configure Yarn:', error);
    }
    
    console.log('Yarn installed and configured');
  }

  private async installGlobalPackages(): Promise<void> {
    console.log('Installing essential global npm packages...');
    
    // Ensure npm is working before installing packages
    try {
      await execa('npm', ['--version']);
    } catch {
      console.warn('npm not working properly, skipping global packages');
      return;
    }
    
    // Clear any potential conflicts before installing packages
    await this.clearNpmConflicts();
    
    const packages = [
      'typescript',
      'tsx',
      'ts-node',
      '@types/node',
      'nodemon',
      'pm2',
      'concurrently',
      'cross-env',
      'dotenv-cli',
      'npm-check-updates',
      'serve',
      'http-server',
      'json-server',
      'prettier',
      'eslint',
      '@biomejs/biome',
      'turbo',
      'lerna',
      'nx',
      'changesets',
      '@commitlint/cli',
      '@commitlint/config-conventional',
      'husky',
      'lint-staged',
      'standard-version',
      'release-it',
      'better-sqlite3'
    ];
    
    const failedPackages: string[] = [];
    
    for (const pkg of packages) {
      if (pkg === 'npx') {
        console.log('Skipping npx (comes bundled with npm)');
        continue;
      }
      
      console.log(`Installing ${pkg} globally...`);
      
      try {
        await execa('npm', ['install', '-g', pkg]);
        console.log(`✅ Successfully installed ${pkg}`);
      } catch {
        try {
          await execa('npm', ['install', '-g', pkg, '--no-audit', '--no-fund']);
          console.log(`✅ Successfully installed ${pkg} (with flags)`);
        } catch {
          try {
            await execa('npx', ['npm@latest', 'install', '-g', pkg]);
            console.log(`✅ Successfully installed ${pkg} (via npx)`);
          } catch {
            console.warn(`Warning: Failed to install ${pkg}`);
            failedPackages.push(pkg);
          }
        }
      }
    }
    
    if (failedPackages.length > 0) {
      console.log(`Failed to install packages: ${failedPackages.join(', ')}`);
      console.log('These packages can be installed manually later if needed');
    }
    
    console.log('Global packages installation completed');
  }

  private async setupNodeAliases(): Promise<void> {
    console.log('Setting up Node.js aliases...');
    
    const aliases = `
# Node.js aliases
alias ni='npm install'
alias nid='npm install --save-dev'
alias nig='npm install -g'
alias nr='npm run'
alias ns='npm start'
alias nt='npm test'
alias nb='npm run build'
alias nw='npm run watch'
alias nd='npm run dev'

# pnpm aliases
alias pi='pnpm install'
alias pid='pnpm add -D'
alias pig='pnpm add -g'
alias pr='pnpm run'
alias ps='pnpm start'
alias pt='pnpm test'
alias pb='pnpm build'
alias pw='pnpm watch'
alias pd='pnpm dev'

# Yarn aliases
alias yi='yarn install'
alias yid='yarn add --dev'
alias yig='yarn global add'
alias yr='yarn run'
alias ys='yarn start'
alias yt='yarn test'
alias yb='yarn build'
alias yw='yarn watch'
alias yd='yarn dev'

# Package manager helpers
alias npm-latest='npm install -g npm@latest'
alias pnpm-latest='pnpm self-update'
alias yarn-latest='yarn set version stable'
alias check-updates='npx npm-check-updates'
alias clean-modules='find . -name "node_modules" -type d -prune -exec rm -rf {} +'
`;
    
    const shellFiles = ['.zshrc', '.bashrc'];
    
    for (const shellFile of shellFiles) {
      const shellPath = path.join(this.homeDir, shellFile);
      
      try {
        let shellContent = '';
        try {
          shellContent = await fs.readFile(shellPath, 'utf-8');
        } catch {
          // File doesn't exist
        }
        
        if (!shellContent.includes("alias ni='npm install'")) {
          await fs.writeFile(shellPath, shellContent + aliases, 'utf-8');
          console.log(`Added Node.js aliases to ${shellFile}`);
        }
      } catch (error) {
        console.warn(`Failed to update ${shellFile}:`, error);
      }
    }
  }

  private async clearNpmConflicts(): Promise<void> {
    // Remove npm prefix and globalconfig that conflict with nvm
    try {
      await execa('npm', ['config', 'delete', 'prefix']);
    } catch {}
    
    try {
      await execa('npm', ['config', 'delete', 'globalconfig']);
    } catch {}
    
    // Remove problematic lines from .npmrc if it exists
    const npmrcPath = path.join(this.homeDir, '.npmrc');
    try {
      const npmrcContent = await fs.readFile(npmrcPath, 'utf-8');
      
      // Create backup
      const backupPath = `${npmrcPath}.backup.${Date.now()}`;
      await fs.writeFile(backupPath, npmrcContent);
      
      // Remove prefix and globalconfig lines
      const cleanedContent = npmrcContent
        .split('\n')
        .filter(line => !line.startsWith('prefix=') && !line.startsWith('globalconfig='))
        .join('\n');
      
      await fs.writeFile(npmrcPath, cleanedContent);
    } catch {
      // File doesn't exist or can't be modified
    }
    
    // Clear npm caches that can cause cb.apply errors
    const cachePaths = [
      path.join(this.homeDir, '.npm/_logs'),
      path.join(this.homeDir, '.npm/_npx'),
      path.join(this.homeDir, '.npm/_cacache')
    ];
    
    for (const cachePath of cachePaths) {
      try {
        await fs.rm(cachePath, { recursive: true, force: true });
      } catch {}
    }
    
    // Remove problematic global npx if it exists
    const npmGlobalDir = path.join(this.homeDir, '.npm-global');
    try {
      await fs.rm(path.join(npmGlobalDir, 'lib/node_modules/npx'), { recursive: true, force: true });
      await fs.rm(path.join(npmGlobalDir, 'bin/npx'), { force: true });
    } catch {}
    
    // Clear npm cache
    try {
      await execa('npm', ['cache', 'clean', '--force']);
    } catch {}
    
    // If npm is completely broken, try to reinstall it
    try {
      await execa('npm', ['--version']);
    } catch {
      try {
        await execa('npx', ['npm@latest', 'install', '-g', 'npm@latest']);
      } catch {}
    }
  }

  async uninstall(): Promise<void> {
    console.log('Uninstalling Node.js tools...');
    
    try {
      // Remove NVM and all Node versions
      const nvmDir = path.join(this.homeDir, '.nvm');
      await fs.rm(nvmDir, { recursive: true, force: true });
      
      // Remove npm global directory
      const npmGlobalDir = path.join(this.homeDir, '.npm-global');
      await fs.rm(npmGlobalDir, { recursive: true, force: true });
      
      // Remove pnpm directories
      const pnpmDirs = [
        path.join(this.homeDir, 'Library/pnpm'),
        path.join(this.homeDir, '.local/share/pnpm'),
        path.join(this.homeDir, '.pnpm'),
        path.join(this.homeDir, '.pnpm-store')
      ];
      
      for (const dir of pnpmDirs) {
        try {
          await fs.rm(dir, { recursive: true, force: true });
        } catch {}
      }
      
      console.log('Node.js tools uninstalled');
    } catch (error) {
      throw new Error(`Node.js tools uninstallation failed: ${error}`);
    }
  }
}