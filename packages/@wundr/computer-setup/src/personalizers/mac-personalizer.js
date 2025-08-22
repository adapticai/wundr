"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MacPersonalizer = void 0;
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const execa_1 = require("execa");
class MacPersonalizer {
    config;
    constructor(config) {
        this.config = config;
    }
    /**
     * Set computer name based on user's full name
     */
    async setComputerName() {
        if (process.platform !== 'darwin') {
            throw new Error('This method is only available on macOS');
        }
        try {
            const computerName = `${this.config.fullName}'s Mac`;
            const hostname = this.config.githubUsername || 'mac';
            const localHostname = this.config.githubUsername || 'mac';
            const netbiosName = (this.config.githubUsername || 'MAC').toUpperCase();
            // Set computer name
            await (0, execa_1.execa)('sudo', ['scutil', '--set', 'ComputerName', computerName]);
            await (0, execa_1.execa)('sudo', ['scutil', '--set', 'HostName', hostname]);
            await (0, execa_1.execa)('sudo', ['scutil', '--set', 'LocalHostName', localHostname]);
            // Set NetBIOS name for SMB sharing
            await (0, execa_1.execa)('sudo', [
                'defaults', 'write',
                '/Library/Preferences/SystemConfiguration/com.apple.smb.server',
                'NetBIOSName', '-string', netbiosName
            ]);
        }
        catch (error) {
            throw new Error(`Failed to set computer name: ${error}`);
        }
    }
    /**
     * Set user account picture
     */
    async setUserPicture(picturePath) {
        if (process.platform !== 'darwin') {
            throw new Error('This method is only available on macOS');
        }
        try {
            const username = process.env.USER || 'user';
            // Remove existing picture
            try {
                await (0, execa_1.execa)('dscl', ['.', '-delete', `/Users/${username}`, 'JPEGPhoto']);
            }
            catch {
                // Ignore error if no existing photo
            }
            try {
                await (0, execa_1.execa)('dscl', ['.', '-delete', `/Users/${username}`, 'Picture']);
            }
            catch {
                // Ignore error if no existing picture
            }
            // Set new picture
            await (0, execa_1.execa)('dscl', ['.', '-create', `/Users/${username}`, 'Picture', picturePath]);
        }
        catch (error) {
            throw new Error(`Failed to set user picture: ${error}`);
        }
    }
    /**
     * Set desktop wallpaper
     */
    async setDesktopWallpaper(wallpaperPath) {
        if (process.platform !== 'darwin') {
            throw new Error('This method is only available on macOS');
        }
        try {
            const script = `tell application "Finder" to set desktop picture to POSIX file "${wallpaperPath}"`;
            await (0, execa_1.execa)('osascript', ['-e', script]);
        }
        catch (error) {
            throw new Error(`Failed to set desktop wallpaper: ${error}`);
        }
    }
    /**
     * Configure Dock with developer-friendly settings and apps
     */
    async configureDock() {
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
                await (0, execa_1.execa)('defaults', ['write', 'com.apple.dock', key, type, value]);
            }
            // Clear existing persistent apps
            await (0, execa_1.execa)('defaults', ['write', 'com.apple.dock', 'persistent-apps', '-array']);
            // Add developer apps to Dock
            const appsToAdd = [
                { name: 'Finder', path: '/System/Library/CoreServices/Finder.app', required: true },
                { name: 'Visual Studio Code', path: '/Applications/Visual Studio Code.app' },
                { name: 'iTerm', path: '/Applications/iTerm.app' },
                { name: 'Terminal', path: '/Applications/Utilities/Terminal.app', required: true },
                { name: 'Docker Desktop', path: '/Applications/Docker.app' },
                { name: 'Slack', path: '/Applications/Slack.app' },
                { name: 'Google Chrome', path: '/Applications/Google Chrome.app' },
                { name: 'Safari', path: '/Applications/Safari.app', required: true },
                { name: 'System Preferences', path: '/System/Applications/System Preferences.app', required: true },
            ];
            for (const app of appsToAdd) {
                try {
                    await fs_1.promises.access(app.path);
                    await this.addAppToDock(app.path);
                }
                catch (error) {
                    if (app.required) {
                        console.warn(`Warning: Required app ${app.name} not found at ${app.path}`);
                    }
                }
            }
            // Restart Dock
            await (0, execa_1.execa)('killall', ['Dock']);
        }
        catch (error) {
            throw new Error(`Failed to configure Dock: ${error}`);
        }
    }
    /**
     * Add application to Dock
     */
    async addAppToDock(appPath) {
        const dockItem = `<dict><key>tile-data</key><dict><key>file-data</key><dict><key>_CFURLString</key><string>${appPath}</string><key>_CFURLStringType</key><integer>0</integer></dict></dict></dict>`;
        await (0, execa_1.execa)('defaults', [
            'write', 'com.apple.dock', 'persistent-apps',
            '-array-add', dockItem
        ]);
    }
    /**
     * Setup hot corners for productivity
     */
    async setupHotCorners() {
        if (process.platform !== 'darwin') {
            throw new Error('This method is only available on macOS');
        }
        try {
            const hotCorners = [
                { corner: 'tl', action: 2, modifier: 0 }, // Top left: Mission Control
                { corner: 'tr', action: 4, modifier: 0 }, // Top right: Desktop
                { corner: 'bl', action: 3, modifier: 0 }, // Bottom left: Application Windows
                { corner: 'br', action: 13, modifier: 0 }, // Bottom right: Lock Screen
            ];
            for (const hotCorner of hotCorners) {
                await (0, execa_1.execa)('defaults', [
                    'write', 'com.apple.dock',
                    `wvous-${hotCorner.corner}-corner`, '-int', hotCorner.action.toString()
                ]);
                await (0, execa_1.execa)('defaults', [
                    'write', 'com.apple.dock',
                    `wvous-${hotCorner.corner}-modifier`, '-int', hotCorner.modifier.toString()
                ]);
            }
        }
        catch (error) {
            throw new Error(`Failed to setup hot corners: ${error}`);
        }
    }
    /**
     * Setup custom Terminal profile with aliases and functions
     */
    async setupTerminalProfile() {
        try {
            const terminalProfileContent = this.createTerminalProfile();
            const profilePath = (0, path_1.join)((0, os_1.homedir)(), '.terminal_profile');
            await fs_1.promises.writeFile(profilePath, terminalProfileContent);
            // Add to shell profiles
            const shellProfiles = [
                (0, path_1.join)((0, os_1.homedir)(), '.zshrc'),
                (0, path_1.join)((0, os_1.homedir)(), '.bash_profile'),
            ];
            for (const profileFile of shellProfiles) {
                try {
                    await fs_1.promises.access(profileFile);
                    const content = await fs_1.promises.readFile(profileFile, 'utf-8');
                    if (!content.includes('source ~/.terminal_profile')) {
                        await fs_1.promises.appendFile(profileFile, '\n# Custom terminal profile\nsource ~/.terminal_profile\n');
                    }
                }
                catch {
                    // Profile file doesn't exist, create it
                    await fs_1.promises.writeFile(profileFile, 'source ~/.terminal_profile\n');
                }
            }
        }
        catch (error) {
            throw new Error(`Failed to setup terminal profile: ${error}`);
        }
    }
    /**
     * Create terminal profile content with custom PS1, aliases, and functions
     */
    createTerminalProfile() {
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
    git clone "$1" && cd "\$(basename "$1" .git)"
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
    async configureSystemPreferences() {
        if (process.platform !== 'darwin') {
            throw new Error('This method is only available on macOS');
        }
        try {
            // Finder preferences
            await (0, execa_1.execa)('defaults', ['write', 'com.apple.finder', 'AppleShowAllFiles', '-bool', 'true']);
            await (0, execa_1.execa)('defaults', ['write', 'com.apple.finder', 'ShowStatusBar', '-bool', 'true']);
            await (0, execa_1.execa)('defaults', ['write', 'com.apple.finder', 'ShowPathbar', '-bool', 'true']);
            // Show hidden files
            await (0, execa_1.execa)('defaults', ['write', 'com.apple.finder', 'AppleShowAllFiles', '-bool', 'true']);
            // Keyboard preferences
            await (0, execa_1.execa)('defaults', ['write', 'NSGlobalDomain', 'KeyRepeat', '-int', '2']);
            await (0, execa_1.execa)('defaults', ['write', 'NSGlobalDomain', 'InitialKeyRepeat', '-int', '15']);
            // Trackpad preferences
            await (0, execa_1.execa)('defaults', ['write', 'com.apple.driver.AppleBluetoothMultitouch.trackpad', 'Clicking', '-bool', 'true']);
            await (0, execa_1.execa)('defaults', ['write', 'NSGlobalDomain', 'com.apple.mouse.tapBehavior', '-int', '1']);
            // Screen capture preferences (save to Desktop)
            await (0, execa_1.execa)('defaults', ['write', 'com.apple.screencapture', 'location', (0, path_1.join)((0, os_1.homedir)(), 'Desktop')]);
            await (0, execa_1.execa)('defaults', ['write', 'com.apple.screencapture', 'type', 'png']);
            // Menu bar preferences
            await (0, execa_1.execa)('defaults', ['write', 'com.apple.menuextra.clock', 'DateFormat', '-string', 'EEE MMM d  H:mm']);
            // Restart affected applications
            await Promise.allSettled([
                (0, execa_1.execa)('killall', ['Finder']),
                (0, execa_1.execa)('killall', ['SystemUIServer']),
            ]);
        }
        catch (error) {
            throw new Error(`Failed to configure system preferences: ${error}`);
        }
    }
    /**
     * Setup Development directory structure
     */
    async setupDevelopmentDirectories() {
        try {
            const directories = [
                (0, path_1.join)((0, os_1.homedir)(), 'Development'),
                (0, path_1.join)((0, os_1.homedir)(), 'Development', 'projects'),
                (0, path_1.join)((0, os_1.homedir)(), 'Development', 'learning'),
                (0, path_1.join)((0, os_1.homedir)(), 'Development', 'tools'),
                (0, path_1.join)((0, os_1.homedir)(), 'Development', 'scripts'),
            ];
            for (const dir of directories) {
                await fs_1.promises.mkdir(dir, { recursive: true });
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
            await fs_1.promises.writeFile((0, path_1.join)((0, os_1.homedir)(), 'Development', 'README.md'), readmeContent);
        }
        catch (error) {
            throw new Error(`Failed to setup development directories: ${error}`);
        }
    }
    /**
     * Get current system information
     */
    async getSystemInfo() {
        if (process.platform !== 'darwin') {
            throw new Error('This method is only available on macOS');
        }
        try {
            const systemInfo = await (0, execa_1.execa)('system_profiler', ['SPSoftwareDataType', '-json']);
            const hardwareInfo = await (0, execa_1.execa)('system_profiler', ['SPHardwareDataType', '-json']);
            return {
                software: JSON.parse(systemInfo.stdout),
                hardware: JSON.parse(hardwareInfo.stdout),
            };
        }
        catch (error) {
            throw new Error(`Failed to get system info: ${error}`);
        }
    }
}
exports.MacPersonalizer = MacPersonalizer;
//# sourceMappingURL=mac-personalizer.js.map