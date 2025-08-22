"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinuxInstaller = void 0;
const tslib_1 = require("tslib");
/**
 * Linux Platform Installer - Linux-specific tools and configurations
 */
const execa_1 = require("execa");
const fs = tslib_1.__importStar(require("fs-extra"));
const path = tslib_1.__importStar(require("path"));
const os = tslib_1.__importStar(require("os"));
const which_1 = tslib_1.__importDefault(require("which"));
class LinuxInstaller {
    name = 'linux-platform';
    distro = 'unknown';
    isSupported(platform) {
        return platform.os === 'linux';
    }
    async isInstalled() {
        // Check if essential Linux dev tools are installed
        try {
            await (0, which_1.default)('curl');
            await (0, which_1.default)('git');
            return true;
        }
        catch {
            return false;
        }
    }
    async getVersion() {
        try {
            const { stdout } = await (0, execa_1.execa)('lsb_release', ['-d']);
            return stdout.replace('Description:\t', '');
        }
        catch {
            try {
                const osRelease = await fs.readFile('/etc/os-release', 'utf8');
                const prettyName = osRelease.match(/PRETTY_NAME="(.+)"/);
                return prettyName ? prettyName[1] : null;
            }
            catch {
                return null;
            }
        }
    }
    async install(profile, platform) {
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
    async configure(profile, platform) {
        await this.configureSystem(profile);
        await this.configureShell(profile);
        await this.setupDotfiles(profile);
        await this.configureFirewall();
    }
    async validate() {
        try {
            await (0, which_1.default)('curl');
            await (0, which_1.default)('git');
            await (0, which_1.default)('build-essential');
            return true;
        }
        catch {
            return false;
        }
    }
    getSteps(profile, platform) {
        const steps = [
            {
                id: 'update-package-manager',
                name: 'Update Package Manager',
                description: 'Update system package manager and repositories',
                category: 'system',
                required: true,
                dependencies: [],
                estimatedTime: 120,
                validator: () => Promise.resolve(true), // Always run update
                installer: () => this.updatePackageManager()
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
                installer: () => this.installEssentialPackages()
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
                installer: () => this.installDevelopmentTools(profile)
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
                installer: () => this.configureSystem(profile)
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
                installer: () => this.configureShell(profile)
            }
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
                installer: () => this.installSnapPackages(profile)
            });
        }
        return steps;
    }
    async detectDistro() {
        try {
            const { stdout } = await (0, execa_1.execa)('lsb_release', ['-si']);
            return stdout.toLowerCase().trim();
        }
        catch {
            try {
                const osRelease = await fs.readFile('/etc/os-release', 'utf8');
                const idMatch = osRelease.match(/^ID=(.+)$/m);
                return idMatch ? idMatch[1].replace(/"/g, '').toLowerCase() : 'unknown';
            }
            catch {
                return 'unknown';
            }
        }
    }
    async updatePackageManager() {
        switch (this.distro) {
            case 'ubuntu':
            case 'debian':
                await (0, execa_1.execa)('sudo', ['apt-get', 'update']);
                await (0, execa_1.execa)('sudo', ['apt-get', 'upgrade', '-y']);
                break;
            case 'centos':
            case 'rhel':
            case 'fedora':
                await (0, execa_1.execa)('sudo', ['yum', 'update', '-y']);
                break;
            case 'arch':
            case 'manjaro':
                await (0, execa_1.execa)('sudo', ['pacman', '-Syu', '--noconfirm']);
                break;
            case 'opensuse':
                await (0, execa_1.execa)('sudo', ['zypper', 'update']);
                break;
        }
    }
    async installEssentialPackages() {
        const packages = this.getEssentialPackages();
        switch (this.distro) {
            case 'ubuntu':
            case 'debian':
                await (0, execa_1.execa)('sudo', ['apt-get', 'install', '-y', ...packages.apt]);
                break;
            case 'centos':
            case 'rhel':
                await (0, execa_1.execa)('sudo', ['yum', 'install', '-y', ...packages.yum]);
                break;
            case 'fedora':
                await (0, execa_1.execa)('sudo', ['dnf', 'install', '-y', ...packages.dnf]);
                break;
            case 'arch':
            case 'manjaro':
                await (0, execa_1.execa)('sudo', ['pacman', '-S', '--noconfirm', ...packages.pacman]);
                break;
            case 'opensuse':
                await (0, execa_1.execa)('sudo', ['zypper', 'install', '-y', ...packages.zypper]);
                break;
        }
    }
    getEssentialPackages() {
        return {
            apt: [
                'curl', 'wget', 'git', 'vim', 'nano', 'htop', 'tree', 'unzip', 'zip',
                'build-essential', 'software-properties-common', 'apt-transport-https',
                'ca-certificates', 'gnupg', 'lsb-release', 'jq', 'ripgrep', 'fd-find',
                'bat', 'exa', 'fzf', 'zsh', 'fish', 'tmux', 'screen'
            ],
            yum: [
                'curl', 'wget', 'git', 'vim', 'nano', 'htop', 'tree', 'unzip', 'zip',
                'gcc', 'gcc-c++', 'make', 'kernel-devel', 'epel-release', 'jq',
                'zsh', 'fish', 'tmux', 'screen'
            ],
            dnf: [
                'curl', 'wget', 'git', 'vim', 'nano', 'htop', 'tree', 'unzip', 'zip',
                'gcc', 'gcc-c++', 'make', 'kernel-devel', 'jq', 'ripgrep', 'fd-find',
                'bat', 'exa', 'fzf', 'zsh', 'fish', 'tmux', 'screen'
            ],
            pacman: [
                'curl', 'wget', 'git', 'vim', 'nano', 'htop', 'tree', 'unzip', 'zip',
                'base-devel', 'jq', 'ripgrep', 'fd', 'bat', 'exa', 'fzf',
                'zsh', 'fish', 'tmux', 'screen'
            ],
            zypper: [
                'curl', 'wget', 'git', 'vim', 'nano', 'htop', 'tree', 'unzip', 'zip',
                'gcc', 'gcc-c++', 'make', 'kernel-devel', 'jq', 'ripgrep',
                'zsh', 'fish', 'tmux', 'screen'
            ]
        };
    }
    async installDevelopmentTools(profile) {
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
    async installFrontendTools() {
        // Browser installation would depend on the package manager
        const packages = ['firefox', 'chromium'];
        try {
            for (const pkg of packages) {
                switch (this.distro) {
                    case 'ubuntu':
                    case 'debian':
                        await (0, execa_1.execa)('sudo', ['apt-get', 'install', '-y', pkg]);
                        break;
                    case 'fedora':
                        await (0, execa_1.execa)('sudo', ['dnf', 'install', '-y', pkg]);
                        break;
                    case 'arch':
                    case 'manjaro':
                        await (0, execa_1.execa)('sudo', ['pacman', '-S', '--noconfirm', pkg]);
                        break;
                }
            }
        }
        catch (error) {
            console.warn('Failed to install some frontend tools:', error);
        }
    }
    async installBackendTools() {
        const packages = ['postgresql-client', 'mysql-client', 'redis-tools'];
        try {
            for (const pkg of packages) {
                switch (this.distro) {
                    case 'ubuntu':
                    case 'debian':
                        await (0, execa_1.execa)('sudo', ['apt-get', 'install', '-y', pkg]);
                        break;
                    case 'fedora':
                        await (0, execa_1.execa)('sudo', ['dnf', 'install', '-y', pkg.replace('-client', '')]);
                        break;
                }
            }
        }
        catch (error) {
            console.warn('Failed to install some backend tools:', error);
        }
    }
    async installDevOpsTools() {
        const tools = ['ansible', 'terraform', 'kubectl'];
        for (const tool of tools) {
            try {
                await this.installDevOpsTool(tool);
            }
            catch (error) {
                console.warn(`Failed to install ${tool}:`, error);
            }
        }
    }
    async installDevOpsTool(tool) {
        switch (tool) {
            case 'ansible':
                if (this.distro === 'ubuntu' || this.distro === 'debian') {
                    await (0, execa_1.execa)('sudo', ['apt-get', 'install', '-y', 'ansible']);
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
    async installTerraform() {
        const commands = [
            'curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg',
            'echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list',
            'sudo apt-get update',
            'sudo apt-get install -y terraform'
        ];
        for (const cmd of commands) {
            await (0, execa_1.execa)('bash', ['-c', cmd]);
        }
    }
    async installKubectl() {
        const commands = [
            'curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"',
            'sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl',
            'rm kubectl'
        ];
        for (const cmd of commands) {
            await (0, execa_1.execa)('bash', ['-c', cmd]);
        }
    }
    async installMobileTools() {
        // Android Studio and tools would typically be installed via snap or flatpak
        console.log('Mobile development tools installation requires manual setup of Android Studio');
    }
    async installMLTools() {
        const packages = ['python3-pip', 'python3-venv', 'python3-dev'];
        try {
            switch (this.distro) {
                case 'ubuntu':
                case 'debian':
                    await (0, execa_1.execa)('sudo', ['apt-get', 'install', '-y', ...packages]);
                    break;
                case 'fedora':
                    await (0, execa_1.execa)('sudo', ['dnf', 'install', '-y', 'python3-pip', 'python3-devel']);
                    break;
            }
        }
        catch (error) {
            console.warn('Failed to install ML tools:', error);
        }
    }
    async installCommonDevTools() {
        // Install VS Code
        await this.installVSCode();
        // Install GitHub CLI
        await this.installGitHubCLI();
    }
    async installVSCode() {
        try {
            switch (this.distro) {
                case 'ubuntu':
                case 'debian':
                    const commands = [
                        'wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg',
                        'sudo install -o root -g root -m 644 packages.microsoft.gpg /etc/apt/trusted.gpg.d/',
                        'sudo sh -c \'echo "deb [arch=amd64,arm64,armhf signed-by=/etc/apt/trusted.gpg.d/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" > /etc/apt/sources.list.d/vscode.list\'',
                        'sudo apt-get update',
                        'sudo apt-get install -y code'
                    ];
                    for (const cmd of commands) {
                        await (0, execa_1.execa)('bash', ['-c', cmd]);
                    }
                    break;
            }
        }
        catch (error) {
            console.warn('Failed to install VS Code:', error);
        }
    }
    async installGitHubCLI() {
        try {
            switch (this.distro) {
                case 'ubuntu':
                case 'debian':
                    const commands = [
                        'curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg',
                        'echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null',
                        'sudo apt-get update',
                        'sudo apt-get install -y gh'
                    ];
                    for (const cmd of commands) {
                        await (0, execa_1.execa)('bash', ['-c', cmd]);
                    }
                    break;
            }
        }
        catch (error) {
            console.warn('Failed to install GitHub CLI:', error);
        }
    }
    async installSnapPackages(profile) {
        if (!this.isSnapSupported())
            return;
        const snapPackages = this.getSnapPackages(profile);
        for (const pkg of snapPackages) {
            try {
                await (0, execa_1.execa)('sudo', ['snap', 'install', pkg.name, ...(pkg.options || [])]);
            }
            catch (error) {
                console.warn(`Failed to install ${pkg.name}:`, error);
            }
        }
    }
    async installFlatpakPackages(profile) {
        if (!this.isFlatpakSupported())
            return;
        // Install Flatpak if not present
        try {
            await (0, which_1.default)('flatpak');
        }
        catch {
            await this.installFlatpak();
        }
        const flatpakPackages = this.getFlatpakPackages(profile);
        for (const pkg of flatpakPackages) {
            try {
                await (0, execa_1.execa)('flatpak', ['install', 'flathub', pkg, '-y']);
            }
            catch (error) {
                console.warn(`Failed to install ${pkg}:`, error);
            }
        }
    }
    async installFlatpak() {
        switch (this.distro) {
            case 'ubuntu':
            case 'debian':
                await (0, execa_1.execa)('sudo', ['apt-get', 'install', '-y', 'flatpak']);
                await (0, execa_1.execa)('sudo', ['flatpak', 'remote-add', '--if-not-exists', 'flathub', 'https://flathub.org/repo/flathub.flatpakrepo']);
                break;
            case 'fedora':
                await (0, execa_1.execa)('sudo', ['dnf', 'install', '-y', 'flatpak']);
                await (0, execa_1.execa)('sudo', ['flatpak', 'remote-add', '--if-not-exists', 'flathub', 'https://flathub.org/repo/flathub.flatpakrepo']);
                break;
        }
    }
    getSnapPackages(profile) {
        const packages = [];
        // Editor
        if (profile.preferences.editor === 'vscode') {
            packages.push({ name: 'code', options: ['--classic'] });
        }
        // Communication tools
        if (profile.tools.communication.slack) {
            packages.push({ name: 'slack' });
        }
        if (profile.tools.communication.discord) {
            packages.push({ name: 'discord' });
        }
        // Development tools
        packages.push({ name: 'postman' });
        return packages;
    }
    getFlatpakPackages(profile) {
        const packages = [];
        // Browsers
        packages.push('org.mozilla.firefox', 'com.google.Chrome');
        // Development tools
        if (profile.preferences.editor === 'vscode') {
            packages.push('com.visualstudio.code');
        }
        return packages;
    }
    async configureSystem(profile) {
        // Configure sudo without password for user (optional)
        // Set up development directories
        const devDirs = ['~/workspace', '~/projects', '~/bin'];
        for (const dir of devDirs) {
            const expandedDir = dir.replace('~', os.homedir());
            await fs.ensureDir(expandedDir);
        }
        // Configure Git
        await (0, execa_1.execa)('git', ['config', '--global', 'user.name', profile.name]);
        await (0, execa_1.execa)('git', ['config', '--global', 'user.email', profile.email]);
    }
    async configureShell(profile) {
        const { shell } = profile.preferences;
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
    async configureZsh(profile) {
        // Install Oh My Zsh
        const homeDir = os.homedir();
        const ohmyzshDir = path.join(homeDir, '.oh-my-zsh');
        if (!await fs.pathExists(ohmyzshDir)) {
            const installScript = 'sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"';
            await (0, execa_1.execa)('bash', ['-c', installScript]);
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
        await (0, execa_1.execa)('chsh', ['-s', '/usr/bin/zsh']);
    }
    async configureFish(profile) {
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
        const fishPath = await (0, which_1.default)('fish').catch(() => '/usr/bin/fish');
        await (0, execa_1.execa)('chsh', ['-s', fishPath]);
    }
    async configureBash(profile) {
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
    async setupDotfiles(profile) {
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
        await (0, execa_1.execa)('git', ['config', '--global', 'core.excludesfile', gitignoreGlobal]);
    }
    async configureFirewall() {
        try {
            // Basic UFW configuration for development
            await (0, execa_1.execa)('sudo', ['ufw', 'enable']);
            await (0, execa_1.execa)('sudo', ['ufw', 'default', 'deny', 'incoming']);
            await (0, execa_1.execa)('sudo', ['ufw', 'default', 'allow', 'outgoing']);
            // Allow common development ports
            const ports = ['22', '80', '443', '3000', '8000', '8080', '9000'];
            for (const port of ports) {
                await (0, execa_1.execa)('sudo', ['ufw', 'allow', port]);
            }
        }
        catch (error) {
            console.warn('Failed to configure firewall:', error);
        }
    }
    // Helper methods
    isSnapSupported() {
        return ['ubuntu', 'debian', 'fedora', 'opensuse', 'manjaro'].includes(this.distro);
    }
    isFlatpakSupported() {
        return ['ubuntu', 'debian', 'fedora', 'opensuse', 'arch', 'manjaro'].includes(this.distro);
    }
    // Validation methods
    async validateEssentialPackages() {
        const essentialTools = ['curl', 'wget', 'git', 'gcc'];
        for (const tool of essentialTools) {
            try {
                await (0, which_1.default)(tool);
            }
            catch {
                return false;
            }
        }
        return true;
    }
    async validateDevelopmentTools(profile) {
        // Basic validation
        try {
            await (0, which_1.default)('code');
            return true;
        }
        catch {
            return false;
        }
    }
    async validateSystemConfig() {
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
    async validateShellConfig(profile) {
        try {
            const { stdout } = await (0, execa_1.execa)('echo', ['$SHELL']);
            return stdout.includes(profile.preferences.shell);
        }
        catch {
            return false;
        }
    }
    async validateSnapPackages(profile) {
        if (!this.isSnapSupported())
            return true;
        try {
            await (0, execa_1.execa)('snap', ['list']);
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.LinuxInstaller = LinuxInstaller;
//# sourceMappingURL=linux-installer.js.map