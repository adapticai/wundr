import { promises as fs } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

import { execa } from 'execa';

import { Logger } from '../utils/logger';

import type { ProfileConfig } from './profile-personalizer';

const logger = new Logger({ name: 'mac-personalizer' });

export interface DockApp {
  name: string;
  path: string;
  required?: boolean;
}

export interface HotCorner {
  corner: 'tl' | 'tr' | 'bl' | 'br';
  action: number;
  modifier: number;
}

export interface SystemInfo {
  software: Record<string, unknown>;
  hardware: Record<string, unknown>;
}

export class MacPersonalizer {
  private config: ProfileConfig;

  constructor(config: ProfileConfig) {
    this.config = config;
  }

  /**
   * Set computer name based on user's full name
   */
  async setComputerName(): Promise<void> {
    if (process.platform !== 'darwin') {
      throw new Error('This method is only available on macOS');
    }

    try {
      const computerName = `${this.config.fullName}'s Mac`;
      const hostname = this.config.githubUsername || 'mac';
      const localHostname = this.config.githubUsername || 'mac';
      const netbiosName = (this.config.githubUsername || 'MAC').toUpperCase();

      // Set computer name
      await execa('sudo', ['scutil', '--set', 'ComputerName', computerName]);
      await execa('sudo', ['scutil', '--set', 'HostName', hostname]);
      await execa('sudo', ['scutil', '--set', 'LocalHostName', localHostname]);

      // Set NetBIOS name for SMB sharing
      await execa('sudo', [
        'defaults',
        'write',
        '/Library/Preferences/SystemConfiguration/com.apple.smb.server',
        'NetBIOSName',
        '-string',
        netbiosName,
      ]);
    } catch (error) {
      throw new Error(`Failed to set computer name: ${error}`);
    }
  }

  /**
   * Set user account picture
   */
  async setUserPicture(picturePath: string): Promise<void> {
    if (process.platform !== 'darwin') {
      throw new Error('This method is only available on macOS');
    }

    try {
      const username = process.env.USER || 'user';

      // Remove existing picture
      try {
        await execa('dscl', [
          '.',
          '-delete',
          `/Users/${username}`,
          'JPEGPhoto',
        ]);
      } catch {
        // Ignore error if no existing photo
      }

      try {
        await execa('dscl', ['.', '-delete', `/Users/${username}`, 'Picture']);
      } catch {
        // Ignore error if no existing picture
      }

      // Set new picture
      await execa('dscl', [
        '.',
        '-create',
        `/Users/${username}`,
        'Picture',
        picturePath,
      ]);
    } catch (error) {
      throw new Error(`Failed to set user picture: ${error}`);
    }
  }

  /**
   * Set desktop wallpaper
   */
  async setDesktopWallpaper(wallpaperPath: string): Promise<void> {
    if (process.platform !== 'darwin') {
      throw new Error('This method is only available on macOS');
    }

    try {
      const script = `tell application "Finder" to set desktop picture to POSIX file "${wallpaperPath}"`;
      await execa('osascript', ['-e', script]);
    } catch (error) {
      throw new Error(`Failed to set desktop wallpaper: ${error}`);
    }
  }

  /**
   * Configure Dock with developer-friendly settings and apps
   */
  async configureDock(): Promise<void> {
    if (process.platform !== 'darwin') {
      throw new Error('This method is only available on macOS');
    }

    try {
      // Set Dock preferences
      const dockSettings = [
        ['tilesize', '-int', '48'],
        ['orientation', '-string', 'bottom'], // Changed from left to bottom for better UX
        ['minimize-to-application', '-bool', 'true'],
        ['show-recents', '-bool', 'false'],
        ['autohide', '-bool', 'true'],
        ['autohide-delay', '-float', '0'],
        ['autohide-time-modifier', '-float', '0.5'],
        ['show-process-indicators', '-bool', 'true'],
        ['launchanim', '-bool', 'false'],
      ];

      for (const [key, type, value] of dockSettings) {
        await execa('defaults', ['write', 'com.apple.dock', key, type, value]);
      }

      // Clear existing persistent apps
      await execa('defaults', [
        'write',
        'com.apple.dock',
        'persistent-apps',
        '-array',
      ]);

      // Add developer apps to Dock
      const appsToAdd: DockApp[] = [
        {
          name: 'Finder',
          path: '/System/Library/CoreServices/Finder.app',
          required: true,
        },
        {
          name: 'Visual Studio Code',
          path: '/Applications/Visual Studio Code.app',
        },
        { name: 'iTerm', path: '/Applications/iTerm.app' },
        {
          name: 'Terminal',
          path: '/Applications/Utilities/Terminal.app',
          required: true,
        },
        { name: 'Docker Desktop', path: '/Applications/Docker.app' },
        { name: 'Slack', path: '/Applications/Slack.app' },
        { name: 'Google Chrome', path: '/Applications/Google Chrome.app' },
        { name: 'Safari', path: '/Applications/Safari.app', required: true },
        {
          name: 'System Preferences',
          path: '/System/Applications/System Preferences.app',
          required: true,
        },
      ];

      for (const app of appsToAdd) {
        try {
          await fs.access(app.path);
          await this.addAppToDock(app.path);
        } catch (_error) {
          if (app.required) {
            logger.warn(`Required app ${app.name} not found at ${app.path}`);
          }
        }
      }

      // Restart Dock
      await execa('killall', ['Dock']);
    } catch (error) {
      throw new Error(`Failed to configure Dock: ${error}`);
    }
  }

  /**
   * Add application to Dock
   */
  private async addAppToDock(appPath: string): Promise<void> {
    const dockItem = `<dict><key>tile-data</key><dict><key>file-data</key><dict><key>_CFURLString</key><string>${appPath}</string><key>_CFURLStringType</key><integer>0</integer></dict></dict></dict>`;

    await execa('defaults', [
      'write',
      'com.apple.dock',
      'persistent-apps',
      '-array-add',
      dockItem,
    ]);
  }

  /**
   * Setup hot corners for productivity
   */
  async setupHotCorners(): Promise<void> {
    if (process.platform !== 'darwin') {
      throw new Error('This method is only available on macOS');
    }

    try {
      const hotCorners: HotCorner[] = [
        { corner: 'tl', action: 2, modifier: 0 }, // Top left: Mission Control
        { corner: 'tr', action: 4, modifier: 0 }, // Top right: Desktop
        { corner: 'bl', action: 3, modifier: 0 }, // Bottom left: Application Windows
        { corner: 'br', action: 13, modifier: 0 }, // Bottom right: Lock Screen
      ];

      for (const hotCorner of hotCorners) {
        await execa('defaults', [
          'write',
          'com.apple.dock',
          `wvous-${hotCorner.corner}-corner`,
          '-int',
          hotCorner.action.toString(),
        ]);

        await execa('defaults', [
          'write',
          'com.apple.dock',
          `wvous-${hotCorner.corner}-modifier`,
          '-int',
          hotCorner.modifier.toString(),
        ]);
      }
    } catch (error) {
      throw new Error(`Failed to setup hot corners: ${error}`);
    }
  }

  /**
   * Setup custom Terminal profile with aliases and functions
   */
  async setupTerminalProfile(): Promise<void> {
    try {
      const terminalProfileContent = this.createTerminalProfile();
      const profilePath = join(homedir(), '.terminal_profile');

      await fs.writeFile(profilePath, terminalProfileContent);

      // Add to shell profiles
      const shellProfiles = [
        join(homedir(), '.zshrc'),
        join(homedir(), '.bash_profile'),
      ];

      for (const profileFile of shellProfiles) {
        try {
          await fs.access(profileFile);
          const content = await fs.readFile(profileFile, 'utf-8');

          if (!content.includes('source ~/.terminal_profile')) {
            await fs.appendFile(
              profileFile,
              '\n# Custom terminal profile\nsource ~/.terminal_profile\n'
            );
          }
        } catch {
          // Profile file doesn't exist, create it
          await fs.writeFile(profileFile, 'source ~/.terminal_profile\n');
        }
      }
    } catch (error) {
      throw new Error(`Failed to setup terminal profile: ${error}`);
    }
  }

  /**
   * Create terminal profile content with custom PS1, aliases, and functions
   */
  private createTerminalProfile(): string {
    return `# Custom Terminal Profile for ${this.config.fullName}
# Generated by Wundr Profile Personalizer

# Custom prompt with colors
export PS1="\\[\\033[36m\\]\\u\\[\\033[m\\]@\\[\\033[32m\\]\\h:\\[\\033[33;1m\\]\\w\\[\\033[m\\]\\$ "
export CLICOLOR=1
export LSCOLORS=ExFxBxDxCxegedabagacad

# History settings
export HISTSIZE=10000
export HISTFILESIZE=10000
export HISTCONTROL=ignoreboth:erasedups

# Editor preferences
export EDITOR=code
export VISUAL=code

# Development aliases
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'
alias ..='cd ..'
alias ...='cd ../..'
alias ....='cd ../../..'
alias ~='cd ~'

# Git aliases
alias g='git'
alias gs='git status'
alias gd='git diff'
alias gc='git commit'
alias gca='git commit -a'
alias gp='git push'
alias gpl='git pull'
alias gl='git log --oneline --graph --decorate --all'
alias gb='git branch'
alias gco='git checkout'
alias gcb='git checkout -b'
alias gm='git merge'
alias gr='git rebase'
alias gt='git tag'

# Docker aliases
alias d='docker'
alias dc='docker-compose'
alias dps='docker ps'
alias dimg='docker images'
alias drun='docker run --rm -it'
alias dexec='docker exec -it'

# Node/NPM aliases
alias ni='npm install'
alias nid='npm install --save-dev'
alias nr='npm run'
alias ns='npm start'
alias nt='npm test'
alias nb='npm run build'

# Yarn aliases (if you use Yarn)
alias y='yarn'
alias yi='yarn install'
alias ys='yarn start'
alias yt='yarn test'
alias yb='yarn build'

# Quick navigation
alias dev='cd ~/Development'
alias proj='cd ~/Projects'
alias desk='cd ~/Desktop'
alias docs='cd ~/Documents'

# System utilities
alias cls='clear'
alias h='history'
alias j='jobs'
alias path='echo -e \${PATH//:/\\n}'
alias reload='source ~/.zshrc || source ~/.bash_profile'

# Network utilities
alias ip='curl ifconfig.me'
alias localip='ipconfig getifaddr en0'
alias ports='lsof -PiTCP -sTCP:LISTEN'

# File operations
alias cp='cp -iv'
alias mv='mv -iv'
alias rm='rm -iv'
alias mkdir='mkdir -pv'

# Quick edit configs
alias ezsh='code ~/.zshrc'
alias ebash='code ~/.bash_profile'
alias eterm='code ~/.terminal_profile'

# Functions
mkcd() {
    mkdir -p "$1" && cd "$1"
}

# Extract function for various archive formats
extract() {
    if [ -f "$1" ]; then
        case "$1" in
            *.tar.bz2)   tar xjf "$1"     ;;
            *.tar.gz)    tar xzf "$1"     ;;
            *.bz2)       bunzip2 "$1"     ;;
            *.rar)       unrar e "$1"     ;;
            *.gz)        gunzip "$1"      ;;
            *.tar)       tar xf "$1"      ;;
            *.tbz2)      tar xjf "$1"     ;;
            *.tgz)       tar xzf "$1"     ;;
            *.zip)       unzip "$1"       ;;
            *.Z)         uncompress "$1"  ;;
            *.7z)        7z x "$1"        ;;
            *)           echo "'$1' cannot be extracted" ;;
        esac
    else
        echo "'$1' is not a valid file"
    fi
}

# Find process by name
findproc() {
    ps aux | grep -i "$1" | grep -v grep
}

# Kill process by name
killproc() {
    pkill -f "$1"
}

# Create and open file in VS Code
touch-code() {
    touch "$1" && code "$1"
}

# Git clone and cd into directory
gclcd() {
    git clone "$1" && cd "$(basename "$1" .git)"
}

# Quick server for current directory
server() {
    local port="\${1:-8000}"
    open "http://localhost:\${port}/"
    python3 -m http.server "$port"
}

# Weather function
weather() {
    curl -s "wttr.in/\${1:-${this.config.location || 'San Francisco'}}"
}

# Welcome message
echo ""
echo "🎉 Welcome, ${this.config.fullName}!"
echo "💻 Terminal profile loaded successfully"
echo ""
`;
  }

  /**
   * Configure macOS system preferences for development
   */
  async configureSystemPreferences(): Promise<void> {
    if (process.platform !== 'darwin') {
      throw new Error('This method is only available on macOS');
    }

    try {
      // Finder preferences
      await execa('defaults', [
        'write',
        'com.apple.finder',
        'AppleShowAllFiles',
        '-bool',
        'true',
      ]);
      await execa('defaults', [
        'write',
        'com.apple.finder',
        'ShowStatusBar',
        '-bool',
        'true',
      ]);
      await execa('defaults', [
        'write',
        'com.apple.finder',
        'ShowPathbar',
        '-bool',
        'true',
      ]);

      // Show hidden files
      await execa('defaults', [
        'write',
        'com.apple.finder',
        'AppleShowAllFiles',
        '-bool',
        'true',
      ]);

      // Keyboard preferences
      await execa('defaults', [
        'write',
        'NSGlobalDomain',
        'KeyRepeat',
        '-int',
        '2',
      ]);
      await execa('defaults', [
        'write',
        'NSGlobalDomain',
        'InitialKeyRepeat',
        '-int',
        '15',
      ]);

      // Trackpad preferences
      await execa('defaults', [
        'write',
        'com.apple.driver.AppleBluetoothMultitouch.trackpad',
        'Clicking',
        '-bool',
        'true',
      ]);
      await execa('defaults', [
        'write',
        'NSGlobalDomain',
        'com.apple.mouse.tapBehavior',
        '-int',
        '1',
      ]);

      // Screen capture preferences (save to Desktop)
      await execa('defaults', [
        'write',
        'com.apple.screencapture',
        'location',
        join(homedir(), 'Desktop'),
      ]);
      await execa('defaults', [
        'write',
        'com.apple.screencapture',
        'type',
        'png',
      ]);

      // Menu bar preferences
      await execa('defaults', [
        'write',
        'com.apple.menuextra.clock',
        'DateFormat',
        '-string',
        'EEE MMM d  H:mm',
      ]);

      // Restart affected applications
      await Promise.allSettled([
        execa('killall', ['Finder']),
        execa('killall', ['SystemUIServer']),
      ]);
    } catch (error) {
      throw new Error(`Failed to configure system preferences: ${error}`);
    }
  }

  /**
   * Setup Development directory structure
   */
  async setupDevelopmentDirectories(): Promise<void> {
    try {
      const directories = [
        join(homedir(), 'Development'),
        join(homedir(), 'Development', 'projects'),
        join(homedir(), 'Development', 'learning'),
        join(homedir(), 'Development', 'tools'),
        join(homedir(), 'Development', 'scripts'),
      ];

      for (const dir of directories) {
        await fs.mkdir(dir, { recursive: true });
      }

      // Create a README in Development directory
      const readmeContent = `# ${this.config.fullName}'s Development Directory

This directory contains all your development projects and tools.

## Structure

- \`projects/\` - Your main projects
- \`learning/\` - Learning exercises and tutorials  
- \`tools/\` - Development tools and utilities
- \`scripts/\` - Custom scripts and automation

Happy coding! 🚀
`;

      await fs.writeFile(
        join(homedir(), 'Development', 'README.md'),
        readmeContent
      );
    } catch (error) {
      throw new Error(`Failed to setup development directories: ${error}`);
    }
  }

  /**
   * Get current system information
   */
  async getSystemInfo(): Promise<SystemInfo> {
    if (process.platform !== 'darwin') {
      throw new Error('This method is only available on macOS');
    }

    try {
      const systemInfo = await execa('system_profiler', [
        'SPSoftwareDataType',
        '-json',
      ]);
      const hardwareInfo = await execa('system_profiler', [
        'SPHardwareDataType',
        '-json',
      ]);

      return {
        software: JSON.parse(systemInfo.stdout) as Record<string, unknown>,
        hardware: JSON.parse(hardwareInfo.stdout) as Record<string, unknown>,
      };
    } catch (error) {
      throw new Error(`Failed to get system info: ${error}`);
    }
  }
}
