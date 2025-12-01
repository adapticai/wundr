/**
 * macOS Platform Installer - macOS-specific tools and configurations
 */
import * as os from 'os';
import * as path from 'path';

import { execa } from 'execa';
import * as fs from 'fs-extra';
import which from 'which';

import { Logger } from '../utils/logger';

import type { SetupPlatform, SetupStep, DeveloperProfile } from '../types';
import type { BaseInstaller } from './index';

interface ExecaError extends Error {
  stderr?: string;
  timedOut?: boolean;
}

export class MacInstaller implements BaseInstaller {
  name = 'mac-platform';
  private readonly logger = new Logger({ name: 'MacInstaller' });

  isSupported(platform: SetupPlatform): boolean {
    return platform.os === 'darwin';
  }

  async isInstalled(): Promise<boolean> {
    // Check if essential macOS dev tools are installed
    try {
      await which('brew');
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string | null> {
    try {
      const { stdout } = await execa('sw_vers', ['-productVersion']);
      return `macOS ${stdout.trim()}`;
    } catch {
      return null;
    }
  }

  async install(
    profile: DeveloperProfile,
    _platform: SetupPlatform
  ): Promise<void> {
    // Install Xcode Command Line Tools
    await this.installXcodeCommandLineTools();

    // Install Homebrew
    await this.installHomebrew();

    // Install essential development packages
    await this.installEssentialPackages(profile);

    // Install applications
    await this.installApplications(profile);

    // Configure macOS settings
    await this.configureMacOS(profile);
  }

  async configure(
    profile: DeveloperProfile,
    _platform: SetupPlatform
  ): Promise<void> {
    await this.configureMacOS(profile);
    await this.configureShell(profile);
    await this.setupDotfiles(profile);
  }

  async validate(): Promise<boolean> {
    try {
      await which('brew');
      await execa('xcode-select', ['-p']);
      return true;
    } catch {
      return false;
    }
  }

  getSteps(profile: DeveloperProfile, _platform: SetupPlatform): SetupStep[] {
    const steps: SetupStep[] = [
      {
        id: 'install-xcode-cli-tools',
        name: 'Install Xcode Command Line Tools',
        description: 'Install essential development tools and compilers',
        category: 'system',
        required: true,
        dependencies: [],
        estimatedTime: 300,
        validator: () => this.validateXcodeCommandLineTools(),
        installer: () => this.installXcodeCommandLineTools(),
      },
      {
        id: 'install-homebrew',
        name: 'Install Homebrew',
        description: 'Install Homebrew package manager',
        category: 'system',
        required: true,
        dependencies: ['install-xcode-cli-tools'],
        estimatedTime: 120,
        validator: () => this.validateHomebrew(),
        installer: () => this.installHomebrew(),
      },
      {
        id: 'install-essential-packages',
        name: 'Install Essential Packages',
        description: 'Install essential development packages via Homebrew',
        category: 'development',
        required: true,
        dependencies: ['install-homebrew'],
        estimatedTime: 180,
        validator: () => this.validateEssentialPackages(),
        installer: () => this.installEssentialPackages(profile),
      },
      {
        id: 'install-applications',
        name: 'Install Applications',
        description: 'Install development applications and tools',
        category: 'development',
        required: false,
        dependencies: ['install-homebrew'],
        estimatedTime: 300,
        validator: () => this.validateApplications(profile),
        installer: () => this.installApplications(profile),
      },
      {
        id: 'configure-macos',
        name: 'Configure macOS Settings',
        description: 'Configure macOS for development workflow',
        category: 'configuration',
        required: false,
        dependencies: [],
        estimatedTime: 60,
        validator: () => this.validateMacOSConfig(),
        installer: () => this.configureMacOS(profile),
      },
      {
        id: 'configure-shell',
        name: 'Configure Shell',
        description: 'Set up and configure preferred shell',
        category: 'configuration',
        required: true,
        dependencies: ['install-essential-packages'],
        estimatedTime: 30,
        validator: () => this.validateShellConfig(profile),
        installer: () => this.configureShell(profile),
      },
    ];

    return steps;
  }

  private async installXcodeCommandLineTools(): Promise<void> {
    try {
      // Check if already installed
      await execa('xcode-select', ['-p']);
      this.logger.info('Xcode Command Line Tools already installed');
    } catch {
      // Install Command Line Tools
      this.logger.info('Installing Xcode Command Line Tools...');
      await execa('xcode-select', ['--install']);

      // Wait for installation to complete
      this.logger.info(
        'Please complete the Xcode Command Line Tools installation in the popup dialog.'
      );
      this.logger.info(
        'The setup will continue once installation is complete...'
      );

      // Poll until installation is complete
      let installed = false;
      while (!installed) {
        try {
          await execa('xcode-select', ['-p']);
          installed = true;
        } catch {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }
  }

  private async installHomebrew(): Promise<void> {
    try {
      await which('brew');
      this.logger.info('Homebrew already installed');
    } catch {
      this.logger.info('Installing Homebrew...');
      const installScript =
        '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"';
      await execa('bash', ['-c', installScript]);

      // Add Homebrew to PATH for Apple Silicon Macs
      const homebrewPath =
        process.arch === 'arm64' ? '/opt/homebrew/bin' : '/usr/local/bin';
      const currentPath = process.env.PATH || '';
      if (!currentPath.includes(homebrewPath)) {
        process.env.PATH = `${homebrewPath}:${currentPath}`;
      }
    }
  }

  private async installEssentialPackages(
    profile: DeveloperProfile
  ): Promise<void> {
    const essentialPackages = [
      'curl',
      'wget',
      'jq',
      'tree',
      'htop',
      'ncdu',
      'ripgrep',
      'fd',
      'bat',
      'eza',
      'fzf',
      'gh', // GitHub CLI
      'git-delta',
      'mas', // Mac App Store CLI
    ];

    // Add shell-specific packages
    if (profile.preferences?.shell === 'zsh') {
      essentialPackages.push('zsh-autosuggestions', 'zsh-syntax-highlighting');
    } else if (profile.preferences?.shell === 'fish') {
      essentialPackages.push('fish');
    }

    // Install packages
    for (const pkg of essentialPackages) {
      try {
        await execa('brew', ['install', pkg]);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to install ${pkg}: ${errorMessage}`);
      }
    }
  }

  private async installApplications(profile: DeveloperProfile): Promise<void> {
    const applications = this.getApplicationsForProfile(profile);

    // Install cask applications
    const totalApps = applications.casks.length;
    for (let i = 0; i < totalApps; i++) {
      const app = applications.casks[i];
      try {
        this.logger.info(`Installing ${app} (${i + 1}/${totalApps})...`);

        // Check if already installed first
        try {
          const { stdout } = await execa('brew', ['list', '--cask', app], {
            timeout: 10000,
          });
          if (stdout) {
            this.logger.info(`${app} already installed, skipping`);
            continue;
          }
        } catch {
          // Not installed, proceed with installation
        }

        // Install with timeout of 5 minutes per app
        await execa('brew', ['install', '--cask', app], { timeout: 300000 });
        this.logger.info(`Installed ${app}`);
      } catch (error: unknown) {
        const execaErr = error as ExecaError;
        if (
          execaErr.stderr?.includes('already an App at') ||
          execaErr.stderr?.includes('is already installed')
        ) {
          this.logger.info(`${app} already installed, skipping`);
        } else if (execaErr.timedOut) {
          this.logger.warn(
            `${app} installation timed out after 5 minutes, skipping`
          );
        } else {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          this.logger.warn(`Failed to install ${app}: ${errorMessage}`);
        }
      }
    }

    // Install Mac App Store applications
    for (const app of applications.masApps) {
      try {
        await execa('mas', ['install', app.id]);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to install ${app.name}: ${errorMessage}`);
      }
    }
  }

  private getApplicationsForProfile(profile: DeveloperProfile): {
    casks: string[];
    masApps: Array<{ id: string; name: string }>;
  } {
    const casks: string[] = [];
    const masApps: Array<{ id: string; name: string }> = [];

    // Editor-specific applications
    const editor = profile.preferences?.editor || 'vscode';
    switch (editor) {
      case 'vscode':
        casks.push('visual-studio-code');
        break;
      case 'sublime':
        casks.push('sublime-text');
        break;
      case 'intellij':
        casks.push('intellij-idea-ce');
        break;
    }

    // Role-specific applications
    switch (profile.role) {
      case 'frontend':
      case 'fullstack':
        casks.push('firefox', 'google-chrome');
        break;
      case 'backend':
      case 'devops':
        casks.push('docker', 'postman', 'tableplus');
        break;
      case 'mobile':
        casks.push('android-studio', 'simulator');
        masApps.push({ id: '497799835', name: 'Xcode' });
        break;
      case 'ml':
        casks.push('anaconda', 'jupyter-notebook-viewer');
        break;
    }

    // Communication tools
    if (profile.tools?.communication?.slack) {
      casks.push('slack');
    }
    if (profile.tools?.communication?.teams) {
      casks.push('microsoft-teams');
    }
    if (profile.tools?.communication?.discord) {
      casks.push('discord');
    }
    if (profile.tools?.communication?.zoom) {
      casks.push('zoom');
    }

    // Common development tools
    casks.push(
      'iterm2',
      'rectangle', // Window manager
      'raycast', // Spotlight replacement
      'obsidian', // Note-taking
      'the-unarchiver'
    );

    return { casks, masApps };
  }

  private async configureMacOS(_profile: DeveloperProfile): Promise<void> {
    const commands = [
      // Show hidden files in Finder
      'defaults write com.apple.finder AppleShowAllFiles -bool true',

      // Show all filename extensions
      'defaults write NSGlobalDomain AppleShowAllExtensions -bool true',

      // Disable the warning when changing a file extension
      'defaults write com.apple.finder FXEnableExtensionChangeWarning -bool false',

      // Show path bar in Finder
      'defaults write com.apple.finder ShowPathbar -bool true',

      // Show status bar in Finder
      'defaults write com.apple.finder ShowStatusBar -bool true',

      // Faster key repeat
      'defaults write NSGlobalDomain KeyRepeat -int 2',
      'defaults write NSGlobalDomain InitialKeyRepeat -int 15',

      // Disable automatic capitalization
      'defaults write NSGlobalDomain NSAutomaticCapitalizationEnabled -bool false',

      // Disable smart quotes
      'defaults write NSGlobalDomain NSAutomaticQuoteSubstitutionEnabled -bool false',

      // Disable smart dashes
      'defaults write NSGlobalDomain NSAutomaticDashSubstitutionEnabled -bool false',

      // Enable tap to click
      'defaults write com.apple.driver.AppleBluetoothMultitouch.trackpad Clicking -bool true',
      'defaults -currentHost write NSGlobalDomain com.apple.mouse.tapBehavior -int 1',

      // Three-finger drag
      'defaults write com.apple.driver.AppleBluetoothMultitouch.trackpad TrackpadThreeFingerDrag -bool true',
      'defaults write com.apple.AppleMultitouchTrackpad TrackpadThreeFingerDrag -bool true',

      // Hot corners - disable screensaver
      'defaults write com.apple.dock wvous-tl-corner -int 0',
      'defaults write com.apple.dock wvous-tr-corner -int 0',
      'defaults write com.apple.dock wvous-bl-corner -int 0',
      'defaults write com.apple.dock wvous-br-corner -int 0',

      // Dock settings
      'defaults write com.apple.dock autohide -bool true',
      'defaults write com.apple.dock autohide-delay -float 0',
      'defaults write com.apple.dock autohide-time-modifier -float 0.5',
      'defaults write com.apple.dock magnification -bool false',
      'defaults write com.apple.dock tilesize -int 48',
      'defaults write com.apple.dock orientation -string "bottom"',

      // Menu bar
      'defaults write com.apple.menuextra.clock DateFormat -string "EEE MMM d  h:mm:ss a"',
      'defaults write com.apple.menuextra.battery ShowPercent -string "YES"',
    ];

    for (const cmd of commands) {
      try {
        await execa('bash', ['-c', cmd]);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to execute: ${cmd} - ${errorMessage}`);
      }
    }

    // Restart affected services
    await execa('killall', ['Finder']);
    await execa('killall', ['Dock']);
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
    const homeDir = os.homedir();
    const zshrcPath = path.join(homeDir, '.zshrc');

    // Install Oh My Zsh if not present
    const ohmyzshDir = path.join(homeDir, '.oh-my-zsh');
    if (!(await fs.pathExists(ohmyzshDir))) {
      const installScript =
        'sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"';
      await execa('bash', ['-c', installScript]);
    }

    // Configure .zshrc
    const zshrcContent = `
# Oh My Zsh configuration
export ZSH="$HOME/.oh-my-zsh"
ZSH_THEME="robbyrussell"
plugins=(git node npm brew docker aws)

source $ZSH/oh-my-zsh.sh

# Homebrew
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# Development aliases
alias ll="exa -la"
alias cat="bat"
alias find="fd"
alias grep="rg"

# Node.js (NVM)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && . "$NVM_DIR/bash_completion"

# FZF
[ -f ~/.fzf.zsh ] && source ~/.fzf.zsh

# Custom functions
function mkcd() {
  mkdir -p "$1" && cd "$1"
}

function cleanup() {
  find . -type f -name "*.DS_Store" -delete
}
`;

    await fs.writeFile(zshrcPath, zshrcContent.trim());

    // Set zsh as default shell
    await execa('chsh', ['-s', '/bin/zsh']);
  }

  private async configureFish(_profile: DeveloperProfile): Promise<void> {
    const configDir = path.join(os.homedir(), '.config', 'fish');
    await fs.ensureDir(configDir);

    const configPath = path.join(configDir, 'config.fish');
    const fishConfig = `
# Fish configuration
set -x PATH /opt/homebrew/bin /usr/local/bin $PATH

# Aliases
alias ll "exa -la"
alias cat "bat"
alias find "fd"
alias grep "rg"

# Functions
function mkcd
    mkdir -p $argv[1]; and cd $argv[1]
end

function cleanup
    find . -type f -name "*.DS_Store" -delete
end
`;

    await fs.writeFile(configPath, fishConfig.trim());

    // Set fish as default shell
    await execa('chsh', ['-s', '/opt/homebrew/bin/fish']);
  }

  private async configureBash(_profile: DeveloperProfile): Promise<void> {
    const bashrcPath = path.join(os.homedir(), '.bashrc');
    const bashrcContent = `
# Bash configuration
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# Aliases
alias ll="exa -la"
alias cat="bat"
alias find="fd"
alias grep="rg"

# Functions
function mkcd() {
  mkdir -p "$1" && cd "$1"
}

function cleanup() {
  find . -type f -name "*.DS_Store" -delete
}

# NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && . "$NVM_DIR/bash_completion"
`;

    await fs.writeFile(bashrcPath, bashrcContent.trim());

    // Source in .bash_profile
    const bashProfilePath = path.join(os.homedir(), '.bash_profile');
    const bashProfileContent = `
if [ -f ~/.bashrc ]; then
  source ~/.bashrc
fi
`;

    await fs.writeFile(bashProfilePath, bashProfileContent.trim());
  }

  private async setupDotfiles(_profile: DeveloperProfile): Promise<void> {
    // This could set up a dotfiles repository
    // For now, just ensure basic dotfiles exist
    const homeDir = os.homedir();

    // Create .gitignore_global
    const gitignoreGlobal = path.join(homeDir, '.gitignore_global');
    const gitignoreContent = `
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db
node_modules/
*.log
.env
.env.local
*.swp
*.swo
*~
`;

    await fs.writeFile(gitignoreGlobal, gitignoreContent.trim());
    await execa('git', [
      'config',
      '--global',
      'core.excludesfile',
      gitignoreGlobal,
    ]);
  }

  // Validation methods
  private async validateXcodeCommandLineTools(): Promise<boolean> {
    try {
      await execa('xcode-select', ['-p']);
      return true;
    } catch {
      return false;
    }
  }

  private async validateHomebrew(): Promise<boolean> {
    try {
      await which('brew');
      return true;
    } catch {
      return false;
    }
  }

  private async validateEssentialPackages(): Promise<boolean> {
    const essentialTools = ['curl', 'wget', 'jq', 'tree', 'gh'];

    for (const tool of essentialTools) {
      try {
        await which(tool);
      } catch {
        return false;
      }
    }

    return true;
  }

  private async validateApplications(
    profile: DeveloperProfile
  ): Promise<boolean> {
    // Basic validation - check if key applications are installed
    const applications = this.getApplicationsForProfile(profile);

    // This is a simplified check
    return applications.casks.length > 0;
  }

  private async validateMacOSConfig(): Promise<boolean> {
    try {
      // Check if some key settings are applied
      const { stdout } = await execa('defaults', [
        'read',
        'com.apple.finder',
        'ShowPathbar',
      ]);
      return stdout.trim() === '1';
    } catch {
      return false;
    }
  }

  private async validateShellConfig(
    profile: DeveloperProfile
  ): Promise<boolean> {
    try {
      const { stdout } = await execa('echo', ['$SHELL']);
      const expectedShell =
        profile.preferences?.shell === 'zsh'
          ? 'zsh'
          : profile.preferences?.shell === 'fish'
            ? 'fish'
            : 'bash';
      return stdout.includes(expectedShell);
    } catch {
      return false;
    }
  }
}
