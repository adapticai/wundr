/**
 * Linux Platform Installer - Linux-specific tools and configurations
 */
import * as os from 'os';
import * as path from 'path';

import { execa } from 'execa';
import * as fs from 'fs-extra';
import which from 'which';

import { Logger } from '../utils/logger';

import type { SetupPlatform, SetupStep, DeveloperProfile } from '../types';
import type { BaseInstaller } from './index';

export class LinuxInstaller implements BaseInstaller {
  name = 'linux-platform';
  private distro: string = 'unknown';
  private readonly logger = new Logger({ name: 'LinuxInstaller' });

  isSupported(platform: SetupPlatform): boolean {
    return platform.os === 'linux';
  }

  async isInstalled(): Promise<boolean> {
    // Check if essential Linux dev tools are installed
    try {
      await which('curl');
      await which('git');
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string | null> {
    try {
      const { stdout } = await execa('lsb_release', ['-d']);
      return stdout.replace('Description:\t', '');
    } catch {
      try {
        const osRelease = await fs.readFile('/etc/os-release', 'utf8');
        const prettyName = osRelease.match(/PRETTY_NAME="(.+)"/);
        return prettyName ? prettyName[1] : null;
      } catch {
        return null;
      }
    }
  }

  async install(profile: DeveloperProfile, platform: SetupPlatform): Promise<void> {
    this.distro = platform.distro || await this.detectDistro();
    
    // Update package manager
    await this.updatePackageManager();
    
    // Install essential packages
    await this.installEssentialPackages();
    
    // Install development tools
    await this.installDevelopmentTools(profile);
    
    // Install Snap packages (if supported)
    await this.installSnapPackages(profile);
    
    // Install Flatpak packages (if supported)
    await this.installFlatpakPackages(profile);
    
    // Configure system
    await this.configureSystem(profile);
  }

  async configure(profile: DeveloperProfile, _platform: SetupPlatform): Promise<void> {
    await this.configureSystem(profile);
    await this.configureShell(profile);
    await this.setupDotfiles(profile);
    await this.configureFirewall();
  }

  async validate(): Promise<boolean> {
    try {
      await which('curl');
      await which('git');
      await which('build-essential');
      return true;
    } catch {
      return false;
    }
  }

  getSteps(profile: DeveloperProfile, _platform: SetupPlatform): SetupStep[] {
    const steps: SetupStep[] = [
      {
        id: 'update-package-manager',
        name: 'Update Package Manager',
        description: 'Update system package manager and repositories',
        category: 'system',
        required: true,
        dependencies: [],
        estimatedTime: 120,
        validator: () => Promise.resolve(true), // Always run update
        installer: () => this.updatePackageManager(),
      },
      {
        id: 'install-essential-packages',
        name: 'Install Essential Packages',
        description: 'Install essential system packages and build tools',
        category: 'system',
        required: true,
        dependencies: ['update-package-manager'],
        estimatedTime: 180,
        validator: () => this.validateEssentialPackages(),
        installer: () => this.installEssentialPackages(),
      },
      {
        id: 'install-development-tools',
        name: 'Install Development Tools',
        description: 'Install role-specific development tools and utilities',
        category: 'development',
        required: true,
        dependencies: ['install-essential-packages'],
        estimatedTime: 240,
        validator: () => this.validateDevelopmentTools(profile),
        installer: () => this.installDevelopmentTools(profile),
      },
      {
        id: 'configure-system',
        name: 'Configure System',
        description: 'Configure Linux system settings for development',
        category: 'configuration',
        required: false,
        dependencies: ['install-essential-packages'],
        estimatedTime: 60,
        validator: () => this.validateSystemConfig(),
        installer: () => this.configureSystem(profile),
      },
      {
        id: 'configure-shell',
        name: 'Configure Shell',
        description: 'Set up and configure preferred shell environment',
        category: 'configuration',
        required: true,
        dependencies: ['install-essential-packages'],
        estimatedTime: 45,
        validator: () => this.validateShellConfig(profile),
        installer: () => this.configureShell(profile),
      },
    ];

    // Add Snap packages step if supported
    if (this.isSnapSupported()) {
      steps.push({
        id: 'install-snap-packages',
        name: 'Install Snap Packages',
        description: 'Install applications via Snap package manager',
        category: 'development',
        required: false,
        dependencies: ['install-essential-packages'],
        estimatedTime: 180,
        validator: () => this.validateSnapPackages(profile),
        installer: () => this.installSnapPackages(profile),
      });
    }

    return steps;
  }

  private async detectDistro(): Promise<string> {
    try {
      const { stdout } = await execa('lsb_release', ['-si']);
      return stdout.toLowerCase().trim();
    } catch {
      try {
        const osRelease = await fs.readFile('/etc/os-release', 'utf8');
        const idMatch = osRelease.match(/^ID=(.+)$/m);
        return idMatch ? idMatch[1].replace(/"/g, '').toLowerCase() : 'unknown';
      } catch {
        return 'unknown';
      }
    }
  }

  private async updatePackageManager(): Promise<void> {
    switch (this.distro) {
      case 'ubuntu':
      case 'debian':
        await execa('sudo', ['apt-get', 'update']);
        await execa('sudo', ['apt-get', 'upgrade', '-y']);
        break;
      case 'centos':
      case 'rhel':
      case 'fedora':
        await execa('sudo', ['yum', 'update', '-y']);
        break;
      case 'arch':
      case 'manjaro':
        await execa('sudo', ['pacman', '-Syu', '--noconfirm']);
        break;
      case 'opensuse':
        await execa('sudo', ['zypper', 'update']);
        break;
    }
  }

  private async installEssentialPackages(): Promise<void> {
    const packages = this.getEssentialPackages();
    
    switch (this.distro) {
      case 'ubuntu':
      case 'debian':
        await execa('sudo', ['apt-get', 'install', '-y', ...packages.apt]);
        break;
      case 'centos':
      case 'rhel':
        await execa('sudo', ['yum', 'install', '-y', ...packages.yum]);
        break;
      case 'fedora':
        await execa('sudo', ['dnf', 'install', '-y', ...packages.dnf]);
        break;
      case 'arch':
      case 'manjaro':
        await execa('sudo', ['pacman', '-S', '--noconfirm', ...packages.pacman]);
        break;
      case 'opensuse':
        await execa('sudo', ['zypper', 'install', '-y', ...packages.zypper]);
        break;
    }
  }

  private getEssentialPackages(): Record<string, string[]> {
    return {
      apt: [
        'curl', 'wget', 'git', 'vim', 'nano', 'htop', 'tree', 'unzip', 'zip',
        'build-essential', 'software-properties-common', 'apt-transport-https',
        'ca-certificates', 'gnupg', 'lsb-release', 'jq', 'ripgrep', 'fd-find',
        'bat', 'eza', 'fzf', 'zsh', 'fish', 'tmux', 'screen',
      ],
      yum: [
        'curl', 'wget', 'git', 'vim', 'nano', 'htop', 'tree', 'unzip', 'zip',
        'gcc', 'gcc-c++', 'make', 'kernel-devel', 'epel-release', 'jq',
        'zsh', 'fish', 'tmux', 'screen',
      ],
      dnf: [
        'curl', 'wget', 'git', 'vim', 'nano', 'htop', 'tree', 'unzip', 'zip',
        'gcc', 'gcc-c++', 'make', 'kernel-devel', 'jq', 'ripgrep', 'fd-find',
        'bat', 'eza', 'fzf', 'zsh', 'fish', 'tmux', 'screen',
      ],
      pacman: [
        'curl', 'wget', 'git', 'vim', 'nano', 'htop', 'tree', 'unzip', 'zip',
        'base-devel', 'jq', 'ripgrep', 'fd', 'bat', 'exa', 'fzf',
        'zsh', 'fish', 'tmux', 'screen',
      ],
      zypper: [
        'curl', 'wget', 'git', 'vim', 'nano', 'htop', 'tree', 'unzip', 'zip',
        'gcc', 'gcc-c++', 'make', 'kernel-devel', 'jq', 'ripgrep',
        'zsh', 'fish', 'tmux', 'screen',
      ],
    };
  }

  private async installDevelopmentTools(profile: DeveloperProfile): Promise<void> {
    // Install role-specific tools
    switch (profile.role) {
      case 'frontend':
      case 'fullstack':
        await this.installFrontendTools();
        break;
      case 'backend':
        await this.installBackendTools();
        break;
      case 'devops':
        await this.installDevOpsTools();
        break;
      case 'mobile':
        await this.installMobileTools();
        break;
      case 'ml':
        await this.installMLTools();
        break;
    }

    // Install common development tools
    await this.installCommonDevTools();
  }

  private async installFrontendTools(): Promise<void> {
    // Browser installation would depend on the package manager
    const packages = ['firefox', 'chromium'];
    
    try {
      for (const pkg of packages) {
        switch (this.distro) {
          case 'ubuntu':
          case 'debian':
            await execa('sudo', ['apt-get', 'install', '-y', pkg]);
            break;
          case 'fedora':
            await execa('sudo', ['dnf', 'install', '-y', pkg]);
            break;
          case 'arch':
          case 'manjaro':
            await execa('sudo', ['pacman', '-S', '--noconfirm', pkg]);
            break;
        }
      }
    } catch (error) {
      this.logger.warn('Failed to install some frontend tools:', error);
    }
  }

  private async installBackendTools(): Promise<void> {
    const packages = ['postgresql-client', 'mysql-client', 'redis-tools'];
    
    try {
      for (const pkg of packages) {
        switch (this.distro) {
          case 'ubuntu':
          case 'debian':
            await execa('sudo', ['apt-get', 'install', '-y', pkg]);
            break;
          case 'fedora':
            await execa('sudo', ['dnf', 'install', '-y', pkg.replace('-client', '')]);
            break;
        }
      }
    } catch (error) {
      this.logger.warn('Failed to install some backend tools:', error);
    }
  }

  private async installDevOpsTools(): Promise<void> {
    const tools = ['ansible', 'terraform', 'kubectl'];
    
    for (const tool of tools) {
      try {
        await this.installDevOpsTool(tool);
      } catch (error) {
        this.logger.warn(`Failed to install ${tool}:`, error);
      }
    }
  }

  private async installDevOpsTool(tool: string): Promise<void> {
    switch (tool) {
      case 'ansible':
        if (this.distro === 'ubuntu' || this.distro === 'debian') {
          await execa('sudo', ['apt-get', 'install', '-y', 'ansible']);
        }
        break;
      case 'terraform':
        await this.installTerraform();
        break;
      case 'kubectl':
        await this.installKubectl();
        break;
    }
  }

  private async installTerraform(): Promise<void> {
    const commands = [
      'curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg',
      'echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list',
      'sudo apt-get update',
      'sudo apt-get install -y terraform',
    ];

    for (const cmd of commands) {
      await execa('bash', ['-c', cmd]);
    }
  }

  private async installKubectl(): Promise<void> {
    const commands = [
      'curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"',
      'sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl',
      'rm kubectl',
    ];

    for (const cmd of commands) {
      await execa('bash', ['-c', cmd]);
    }
  }

  private async installMobileTools(): Promise<void> {
    // Android Studio and tools would typically be installed via snap or flatpak
    this.logger.info('Mobile development tools installation requires manual setup of Android Studio');
  }

  private async installMLTools(): Promise<void> {
    const packages = ['python3-pip', 'python3-venv', 'python3-dev'];
    
    try {
      switch (this.distro) {
        case 'ubuntu':
        case 'debian':
          await execa('sudo', ['apt-get', 'install', '-y', ...packages]);
          break;
        case 'fedora':
          await execa('sudo', ['dnf', 'install', '-y', 'python3-pip', 'python3-devel']);
          break;
      }
    } catch (error) {
      this.logger.warn('Failed to install ML tools:', error);
    }
  }

  private async installCommonDevTools(): Promise<void> {
    // Install VS Code
    await this.installVSCode();
    
    // Install GitHub CLI
    await this.installGitHubCLI();
  }

  private async installVSCode(): Promise<void> {
    try {
      switch (this.distro) {
        case 'ubuntu':
        case 'debian': {
          const commands = [
            'wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg',
            'sudo install -o root -g root -m 644 packages.microsoft.gpg /etc/apt/trusted.gpg.d/',
            'sudo sh -c \'echo "deb [arch=amd64,arm64,armhf signed-by=/etc/apt/trusted.gpg.d/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" > /etc/apt/sources.list.d/vscode.list\'',
            'sudo apt-get update',
            'sudo apt-get install -y code',
          ];

          for (const cmd of commands) {
            await execa('bash', ['-c', cmd]);
          }
          break;
        }
      }
    } catch (error) {
      this.logger.warn('Failed to install VS Code:', error);
    }
  }

  private async installGitHubCLI(): Promise<void> {
    try {
      switch (this.distro) {
        case 'ubuntu':
        case 'debian': {
          const commands = [
            'curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg',
            'echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null',
            'sudo apt-get update',
            'sudo apt-get install -y gh',
          ];

          for (const cmd of commands) {
            await execa('bash', ['-c', cmd]);
          }
          break;
        }
      }
    } catch (error) {
      this.logger.warn('Failed to install GitHub CLI:', error);
    }
  }

  private async installSnapPackages(profile: DeveloperProfile): Promise<void> {
    if (!this.isSnapSupported()) {
      return;
    }

    const snapPackages = this.getSnapPackages(profile);
    
    for (const pkg of snapPackages) {
      try {
        await execa('sudo', ['snap', 'install', pkg.name, ...(pkg.options || [])]);
      } catch (error) {
        this.logger.warn(`Failed to install ${pkg.name}:`, error);
      }
    }
  }

  private async installFlatpakPackages(profile: DeveloperProfile): Promise<void> {
    if (!this.isFlatpakSupported()) {
      return;
    }

    // Install Flatpak if not present
    try {
      await which('flatpak');
    } catch {
      await this.installFlatpak();
    }

    const flatpakPackages = this.getFlatpakPackages(profile);
    
    for (const pkg of flatpakPackages) {
      try {
        await execa('flatpak', ['install', 'flathub', pkg, '-y']);
      } catch (error) {
        this.logger.warn(`Failed to install ${pkg}:`, error);
      }
    }
  }

  private async installFlatpak(): Promise<void> {
    switch (this.distro) {
      case 'ubuntu':
      case 'debian':
        await execa('sudo', ['apt-get', 'install', '-y', 'flatpak']);
        await execa('sudo', ['flatpak', 'remote-add', '--if-not-exists', 'flathub', 'https://flathub.org/repo/flathub.flatpakrepo']);
        break;
      case 'fedora':
        await execa('sudo', ['dnf', 'install', '-y', 'flatpak']);
        await execa('sudo', ['flatpak', 'remote-add', '--if-not-exists', 'flathub', 'https://flathub.org/repo/flathub.flatpakrepo']);
        break;
    }
  }

  private getSnapPackages(profile: DeveloperProfile): Array<{ name: string; options?: string[] }> {
    const packages: Array<{ name: string; options?: string[] }> = [];
    
    // Editor
    if (profile.preferences?.editor === 'vscode') {
      packages.push({ name: 'code', options: ['--classic'] });
    }
    
    // Communication tools
    if (profile.tools?.communication?.slack) {
      packages.push({ name: 'slack' });
    }
    if (profile.tools?.communication?.discord) {
      packages.push({ name: 'discord' });
    }
    
    // Development tools
    packages.push({ name: 'postman' });
    
    return packages;
  }

  private getFlatpakPackages(profile: DeveloperProfile): string[] {
    const packages: string[] = [];
    
    // Browsers
    packages.push('org.mozilla.firefox', 'com.google.Chrome');
    
    // Development tools
    if (profile.preferences?.editor === 'vscode') {
      packages.push('com.visualstudio.code');
    }
    
    return packages;
  }

  private async configureSystem(profile: DeveloperProfile): Promise<void> {
    // Configure sudo without password for user (optional)
    // Set up development directories
    const devDirs = ['~/workspace', '~/projects', '~/bin'];
    
    for (const dir of devDirs) {
      const expandedDir = dir.replace('~', os.homedir());
      await fs.ensureDir(expandedDir);
    }
    
    // Configure Git
    await execa('git', ['config', '--global', 'user.name', profile.name]);
    await execa('git', ['config', '--global', 'user.email', profile.email]);
  }

  private async configureShell(profile: DeveloperProfile): Promise<void> {
    const shell = profile.preferences?.shell || 'bash';

    switch (shell) {
      case 'zsh':
        await this.configureZsh(profile);
        break;
      case 'fish':
        await this.configureFish(profile);
        break;
      case 'bash':
        await this.configureBash(profile);
        break;
    }
  }

  private async configureZsh(_profile: DeveloperProfile): Promise<void> {
    // Install Oh My Zsh
    const homeDir = os.homedir();
    const ohmyzshDir = path.join(homeDir, '.oh-my-zsh');
    
    if (!await fs.pathExists(ohmyzshDir)) {
      const installScript = 'sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"';
      await execa('bash', ['-c', installScript]);
    }
    
    // Configure .zshrc
    const zshrcPath = path.join(homeDir, '.zshrc');
    const zshrcContent = `
export ZSH="$HOME/.oh-my-zsh"
ZSH_THEME="robbyrussell"
plugins=(git node npm docker aws kubectl)

source $ZSH/oh-my-zsh.sh

# Custom aliases
alias ll="ls -la"
alias la="ls -la"
alias ..="cd .."
alias ...="cd ../.."

# Development paths
export PATH="$HOME/bin:$HOME/.local/bin:$PATH"

# Node.js (NVM)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && . "$NVM_DIR/bash_completion"
`;
    
    await fs.writeFile(zshrcPath, zshrcContent.trim());
    
    // Set as default shell
    await execa('chsh', ['-s', '/usr/bin/zsh']);
  }

  private async configureFish(_profile: DeveloperProfile): Promise<void> {
    const configDir = path.join(os.homedir(), '.config', 'fish');
    await fs.ensureDir(configDir);
    
    const configPath = path.join(configDir, 'config.fish');
    const fishConfig = `
# Fish configuration
set -x PATH $HOME/bin $HOME/.local/bin $PATH

# Aliases
alias ll "ls -la"
alias la "ls -la"
alias .. "cd .."
alias ... "cd ../.."

# Functions
function mkcd
    mkdir -p $argv[1]; and cd $argv[1]
end
`;
    
    await fs.writeFile(configPath, fishConfig.trim());
    
    // Set as default shell
    const fishPath = await which('fish').catch(() => '/usr/bin/fish');
    await execa('chsh', ['-s', fishPath]);
  }

  private async configureBash(_profile: DeveloperProfile): Promise<void> {
    const bashrcPath = path.join(os.homedir(), '.bashrc');
    const bashrcAddition = `
# Development configuration
export PATH="$HOME/bin:$HOME/.local/bin:$PATH"

# Aliases
alias ll="ls -la"
alias la="ls -la"
alias ..="cd .."
alias ... "cd ../.."

# Functions
function mkcd() {
    mkdir -p "$1" && cd "$1"
}

# NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && . "$NVM_DIR/bash_completion"
`;
    
    // Append to existing .bashrc
    await fs.appendFile(bashrcPath, bashrcAddition);
  }

  private async setupDotfiles(_profile: DeveloperProfile): Promise<void> {
    // Create basic dotfiles
    const homeDir = os.homedir();
    
    // .gitignore_global
    const gitignoreGlobal = path.join(homeDir, '.gitignore_global');
    const gitignoreContent = `
node_modules/
*.log
.env
.env.local
*.swp
*.swo
*~
.DS_Store
Thumbs.db
`;
    
    await fs.writeFile(gitignoreGlobal, gitignoreContent.trim());
    await execa('git', ['config', '--global', 'core.excludesfile', gitignoreGlobal]);
  }

  private async configureFirewall(): Promise<void> {
    try {
      // Basic UFW configuration for development
      await execa('sudo', ['ufw', 'enable']);
      await execa('sudo', ['ufw', 'default', 'deny', 'incoming']);
      await execa('sudo', ['ufw', 'default', 'allow', 'outgoing']);
      
      // Allow common development ports
      const ports = ['22', '80', '443', '3000', '8000', '8080', '9000'];
      for (const port of ports) {
        await execa('sudo', ['ufw', 'allow', port]);
      }
    } catch (error) {
      this.logger.warn('Failed to configure firewall:', error);
    }
  }

  // Helper methods
  private isSnapSupported(): boolean {
    return ['ubuntu', 'debian', 'fedora', 'opensuse', 'manjaro'].includes(this.distro);
  }

  private isFlatpakSupported(): boolean {
    return ['ubuntu', 'debian', 'fedora', 'opensuse', 'arch', 'manjaro'].includes(this.distro);
  }

  // Validation methods
  private async validateEssentialPackages(): Promise<boolean> {
    const essentialTools = ['curl', 'wget', 'git', 'gcc'];
    
    for (const tool of essentialTools) {
      try {
        await which(tool);
      } catch {
        return false;
      }
    }
    
    return true;
  }

  private async validateDevelopmentTools(_profile: DeveloperProfile): Promise<boolean> {
    // Basic validation
    try {
      await which('code');
      return true;
    } catch {
      return false;
    }
  }

  private async validateSystemConfig(): Promise<boolean> {
    // Check if development directories exist
    const devDirs = ['~/workspace', '~/projects'];
    
    for (const dir of devDirs) {
      const expandedDir = dir.replace('~', os.homedir());
      if (!await fs.pathExists(expandedDir)) {
        return false;
      }
    }
    
    return true;
  }

  private async validateShellConfig(profile: DeveloperProfile): Promise<boolean> {
    try {
      const { stdout } = await execa('echo', ['$SHELL']);
      return stdout.includes(profile.preferences?.shell || 'bash');
    } catch {
      return false;
    }
  }

  private async validateSnapPackages(_profile: DeveloperProfile): Promise<boolean> {
    if (!this.isSnapSupported()) {
      return true;
    }

    try {
      await execa('snap', ['list']);
      return true;
    } catch {
      return false;
    }
  }
}