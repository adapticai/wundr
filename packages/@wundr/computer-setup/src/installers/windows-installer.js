"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WindowsInstaller = void 0;
const tslib_1 = require("tslib");
/**
 * Windows Platform Installer - Windows-specific tools and configurations
 */
const execa_1 = require("execa");
const fs = tslib_1.__importStar(require("fs-extra"));
const path = tslib_1.__importStar(require("path"));
const os = tslib_1.__importStar(require("os"));
const which_1 = tslib_1.__importDefault(require("which"));
class WindowsInstaller {
    name = 'windows-platform';
    isSupported(platform) {
        return platform.os === 'win32';
    }
    async isInstalled() {
        // Check if essential Windows dev tools are installed
        try {
            await this.checkPowerShellVersion();
            return true;
        }
        catch {
            return false;
        }
    }
    async getVersion() {
        try {
            const { stdout } = await (0, execa_1.execa)('powershell', ['-Command', 'Get-ComputerInfo | Select-Object WindowsProductName, WindowsVersion | ConvertTo-Json']);
            const info = JSON.parse(stdout);
            return `${info.WindowsProductName} ${info.WindowsVersion}`;
        }
        catch {
            return null;
        }
    }
    async install(profile, platform) {
        // Install Windows Subsystem for Linux (WSL2)
        await this.installWSL2();
        // Install Chocolatey package manager
        await this.installChocolatey();
        // Install Scoop package manager (for user-space packages)
        await this.installScoop();
        // Install essential packages
        await this.installEssentialPackages();
        // Install development tools
        await this.installDevelopmentTools(profile);
        // Configure Windows settings
        await this.configureWindows(profile);
    }
    async configure(profile, platform) {
        await this.configureWindows(profile);
        await this.configurePowerShell(profile);
        await this.configureWSL(profile);
        await this.setupDeveloperMode();
    }
    async validate() {
        try {
            await this.checkPowerShellVersion();
            await (0, which_1.default)('choco');
            return true;
        }
        catch {
            return false;
        }
    }
    getSteps(profile, platform) {
        const steps = [
            {
                id: 'enable-developer-mode',
                name: 'Enable Developer Mode',
                description: 'Enable Windows Developer Mode for development features',
                category: 'system',
                required: true,
                dependencies: [],
                estimatedTime: 30,
                validator: () => this.validateDeveloperMode(),
                installer: () => this.setupDeveloperMode()
            },
            {
                id: 'install-wsl2',
                name: 'Install WSL2',
                description: 'Install Windows Subsystem for Linux 2',
                category: 'system',
                required: true,
                dependencies: ['enable-developer-mode'],
                estimatedTime: 600,
                validator: () => this.validateWSL2(),
                installer: () => this.installWSL2()
            },
            {
                id: 'install-chocolatey',
                name: 'Install Chocolatey',
                description: 'Install Chocolatey package manager for Windows',
                category: 'system',
                required: true,
                dependencies: [],
                estimatedTime: 60,
                validator: () => this.validateChocolatey(),
                installer: () => this.installChocolatey()
            },
            {
                id: 'install-scoop',
                name: 'Install Scoop',
                description: 'Install Scoop package manager for user applications',
                category: 'system',
                required: true,
                dependencies: [],
                estimatedTime: 60,
                validator: () => this.validateScoop(),
                installer: () => this.installScoop()
            },
            {
                id: 'install-essential-packages',
                name: 'Install Essential Packages',
                description: 'Install essential development packages and utilities',
                category: 'development',
                required: true,
                dependencies: ['install-chocolatey', 'install-scoop'],
                estimatedTime: 300,
                validator: () => this.validateEssentialPackages(),
                installer: () => this.installEssentialPackages()
            },
            {
                id: 'install-development-tools',
                name: 'Install Development Tools',
                description: 'Install role-specific development tools and applications',
                category: 'development',
                required: true,
                dependencies: ['install-essential-packages'],
                estimatedTime: 600,
                validator: () => this.validateDevelopmentTools(profile),
                installer: () => this.installDevelopmentTools(profile)
            },
            {
                id: 'configure-powershell',
                name: 'Configure PowerShell',
                description: 'Set up PowerShell profile and modules',
                category: 'configuration',
                required: true,
                dependencies: ['install-essential-packages'],
                estimatedTime: 45,
                validator: () => this.validatePowerShellConfig(),
                installer: () => this.configurePowerShell(profile)
            },
            {
                id: 'configure-wsl',
                name: 'Configure WSL',
                description: 'Configure WSL2 environment for development',
                category: 'configuration',
                required: true,
                dependencies: ['install-wsl2'],
                estimatedTime: 120,
                validator: () => this.validateWSLConfig(),
                installer: () => this.configureWSL(profile)
            }
        ];
        return steps;
    }
    async checkPowerShellVersion() {
        await (0, execa_1.execa)('powershell', ['-Command', '$PSVersionTable.PSVersion']);
    }
    async setupDeveloperMode() {
        try {
            // Enable Developer Mode via registry
            const regCommand = 'reg add "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\AppModelUnlock" /t REG_DWORD /f /v "AllowDevelopmentWithoutDevLicense" /d "1"';
            await (0, execa_1.execa)('powershell', ['-Command', `Start-Process powershell -ArgumentList '-Command "${regCommand}"' -Verb RunAs`]);
            console.log('Developer Mode enabled. You may need to restart your computer for changes to take effect.');
        }
        catch (error) {
            console.warn('Failed to enable Developer Mode automatically. Please enable it manually in Windows Settings.');
        }
    }
    async installWSL2() {
        try {
            // Check if WSL is already installed
            await (0, execa_1.execa)('wsl', ['--version']);
            console.log('WSL2 is already installed');
        }
        catch {
            console.log('Installing WSL2...');
            // Enable Windows Subsystem for Linux
            await (0, execa_1.execa)('powershell', ['-Command', 'Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -NoRestart']);
            // Enable Virtual Machine Platform
            await (0, execa_1.execa)('powershell', ['-Command', 'Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -NoRestart']);
            // Set WSL 2 as default version
            await (0, execa_1.execa)('wsl', ['--set-default-version', '2']);
            // Install Ubuntu (most common distribution)
            await (0, execa_1.execa)('powershell', ['-Command', 'Invoke-WebRequest -Uri https://aka.ms/wslubuntu2204 -OutFile Ubuntu.appx -UseBasicParsing']);
            await (0, execa_1.execa)('powershell', ['-Command', 'Add-AppxPackage .\\Ubuntu.appx']);
            await (0, execa_1.execa)('powershell', ['-Command', 'Remove-Item .\\Ubuntu.appx']);
            console.log('WSL2 installation complete. Please restart your computer and run Ubuntu from the Start menu to complete setup.');
        }
    }
    async installChocolatey() {
        try {
            await (0, which_1.default)('choco');
            console.log('Chocolatey is already installed');
        }
        catch {
            console.log('Installing Chocolatey...');
            const installScript = 'Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString(\'https://community.chocolatey.org/install.ps1\'))';
            await (0, execa_1.execa)('powershell', ['-Command', installScript]);
        }
    }
    async installScoop() {
        try {
            await (0, which_1.default)('scoop');
            console.log('Scoop is already installed');
        }
        catch {
            console.log('Installing Scoop...');
            // Set execution policy for current user
            await (0, execa_1.execa)('powershell', ['-Command', 'Set-ExecutionPolicy RemoteSigned -Scope CurrentUser']);
            // Install Scoop
            const installScript = 'irm get.scoop.sh | iex';
            await (0, execa_1.execa)('powershell', ['-Command', installScript]);
            // Add useful buckets
            await (0, execa_1.execa)('scoop', ['bucket', 'add', 'extras']);
            await (0, execa_1.execa)('scoop', ['bucket', 'add', 'versions']);
        }
    }
    async installEssentialPackages() {
        const chocoPackages = [
            'git',
            'curl',
            'wget',
            'jq',
            'ripgrep',
            'fd',
            'bat',
            'fzf',
            'gh', // GitHub CLI
            'sysinternals',
            'powertoys'
        ];
        const scoopPackages = [
            'aria2', // Download manager for Scoop
            'tree',
            'which',
            'vim',
            'nano',
            'htop'
        ];
        // Install Chocolatey packages
        for (const pkg of chocoPackages) {
            try {
                await (0, execa_1.execa)('choco', ['install', pkg, '-y']);
            }
            catch (error) {
                console.warn(`Failed to install ${pkg} via Chocolatey:`, error);
            }
        }
        // Install Scoop packages
        for (const pkg of scoopPackages) {
            try {
                await (0, execa_1.execa)('scoop', ['install', pkg]);
            }
            catch (error) {
                console.warn(`Failed to install ${pkg} via Scoop:`, error);
            }
        }
    }
    async installDevelopmentTools(profile) {
        // Install role-specific tools
        switch (profile.role) {
            case 'frontend':
            case 'fullstack':
                await this.installFrontendTools(profile);
                break;
            case 'backend':
                await this.installBackendTools(profile);
                break;
            case 'devops':
                await this.installDevOpsTools(profile);
                break;
            case 'mobile':
                await this.installMobileTools(profile);
                break;
            case 'ml':
                await this.installMLTools(profile);
                break;
        }
        // Install common development tools
        await this.installCommonDevTools(profile);
    }
    async installFrontendTools(profile) {
        const packages = [
            'googlechrome',
            'firefox',
            'microsoft-edge'
        ];
        for (const pkg of packages) {
            try {
                await (0, execa_1.execa)('choco', ['install', pkg, '-y']);
            }
            catch (error) {
                console.warn(`Failed to install ${pkg}:`, error);
            }
        }
    }
    async installBackendTools(profile) {
        const packages = [
            'postman',
            'dbeaver',
            'redis-desktop-manager'
        ];
        for (const pkg of packages) {
            try {
                await (0, execa_1.execa)('choco', ['install', pkg, '-y']);
            }
            catch (error) {
                console.warn(`Failed to install ${pkg}:`, error);
            }
        }
    }
    async installDevOpsTools(profile) {
        const packages = [
            'kubernetes-cli',
            'terraform',
            'ansible',
            'azure-cli',
            'awscli',
            'gcloudsdk'
        ];
        for (const pkg of packages) {
            try {
                await (0, execa_1.execa)('choco', ['install', pkg, '-y']);
            }
            catch (error) {
                console.warn(`Failed to install ${pkg}:`, error);
            }
        }
    }
    async installMobileTools(profile) {
        const packages = [
            'androidstudio',
            'adb'
        ];
        for (const pkg of packages) {
            try {
                await (0, execa_1.execa)('choco', ['install', pkg, '-y']);
            }
            catch (error) {
                console.warn(`Failed to install ${pkg}:`, error);
            }
        }
    }
    async installMLTools(profile) {
        const packages = [
            'python',
            'anaconda3',
            'jupyter'
        ];
        for (const pkg of packages) {
            try {
                await (0, execa_1.execa)('choco', ['install', pkg, '-y']);
            }
            catch (error) {
                console.warn(`Failed to install ${pkg}:`, error);
            }
        }
    }
    async installCommonDevTools(profile) {
        const packages = ['windows-terminal'];
        // Editor-specific installation
        switch (profile.preferences.editor) {
            case 'vscode':
                packages.push('vscode');
                break;
            case 'sublime':
                packages.push('sublimetext4');
                break;
            case 'intellij':
                packages.push('intellijidea-community');
                break;
            case 'vim':
                packages.push('vim');
                break;
        }
        // Communication tools
        if (profile.tools.communication.slack) {
            packages.push('slack');
        }
        if (profile.tools.communication.teams) {
            packages.push('microsoft-teams');
        }
        if (profile.tools.communication.discord) {
            packages.push('discord');
        }
        if (profile.tools.communication.zoom) {
            packages.push('zoom');
        }
        // Install packages
        for (const pkg of packages) {
            try {
                await (0, execa_1.execa)('choco', ['install', pkg, '-y']);
            }
            catch (error) {
                console.warn(`Failed to install ${pkg}:`, error);
            }
        }
    }
    async configureWindows(profile) {
        // Configure Windows for development
        const registryCommands = [
            // Show file extensions
            'reg add "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v "HideFileExt" /t REG_DWORD /d 0 /f',
            // Show hidden files
            'reg add "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v "Hidden" /t REG_DWORD /d 1 /f',
            // Disable Windows Defender real-time protection for development folders (requires admin)
            // Note: This is optional and should be used carefully
        ];
        for (const cmd of registryCommands) {
            try {
                await (0, execa_1.execa)('powershell', ['-Command', cmd]);
            }
            catch (error) {
                console.warn(`Failed to execute registry command: ${cmd}`, error);
            }
        }
    }
    async configurePowerShell(profile) {
        // Install PowerShell modules
        const modules = [
            'posh-git',
            'oh-my-posh',
            'PSReadLine'
        ];
        for (const module of modules) {
            try {
                await (0, execa_1.execa)('powershell', ['-Command', `Install-Module -Name ${module} -Force -SkipPublisherCheck`]);
            }
            catch (error) {
                console.warn(`Failed to install PowerShell module ${module}:`, error);
            }
        }
        // Create PowerShell profile
        const profilePath = path.join(os.homedir(), 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1');
        const profileDir = path.dirname(profilePath);
        await fs.ensureDir(profileDir);
        const profileContent = `
# PowerShell Profile for Development

# Import modules
Import-Module posh-git
Import-Module oh-my-posh
Set-PoshPrompt -Theme robbyrussell

# PSReadLine configuration
Import-Module PSReadLine
Set-PSReadLineOption -PredictionSource History
Set-PSReadLineOption -PredictionViewStyle ListView
Set-PSReadLineKeyHandler -Key Tab -Function MenuComplete

# Aliases
Set-Alias ll Get-ChildItem
Set-Alias la Get-ChildItem
function mkcd($path) { mkdir $path -Force; cd $path }

# Development paths
$env:PATH += ";$env:USERPROFILE\\bin"
$env:PATH += ";$env:USERPROFILE\\scoop\\shims"

# Git aliases
function gst { git status }
function ga { git add $args }
function gc { git commit -m $args }
function gp { git push }
function gpl { git pull }
`;
        await fs.writeFile(profilePath, profileContent.trim());
    }
    async configureWSL(profile) {
        try {
            // Check if WSL is running
            await (0, execa_1.execa)('wsl', ['--list', '--running']);
            // Configure .wslconfig
            const wslConfigPath = path.join(os.homedir(), '.wslconfig');
            const wslConfig = `
[wsl2]
memory=4GB
processors=2
localhostForwarding=true

[user]
default=${profile.name.toLowerCase().replace(/\s+/g, '')}
`;
            await fs.writeFile(wslConfigPath, wslConfig.trim());
            console.log('WSL configuration complete. Consider setting up your preferred Linux distribution.');
        }
        catch (error) {
            console.warn('WSL configuration failed:', error);
        }
    }
    // Validation methods
    async validateDeveloperMode() {
        try {
            const { stdout } = await (0, execa_1.execa)('powershell', ['-Command', 'Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\AppModelUnlock" -Name "AllowDevelopmentWithoutDevLicense"']);
            return stdout.includes('1');
        }
        catch {
            return false;
        }
    }
    async validateWSL2() {
        try {
            await (0, execa_1.execa)('wsl', ['--version']);
            return true;
        }
        catch {
            return false;
        }
    }
    async validateChocolatey() {
        try {
            await (0, which_1.default)('choco');
            return true;
        }
        catch {
            return false;
        }
    }
    async validateScoop() {
        try {
            await (0, which_1.default)('scoop');
            return true;
        }
        catch {
            return false;
        }
    }
    async validateEssentialPackages() {
        const essentialTools = ['git', 'curl', 'gh'];
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
        // Basic validation - check if editor is installed
        switch (profile.preferences.editor) {
            case 'vscode':
                try {
                    await (0, which_1.default)('code');
                    return true;
                }
                catch {
                    return false;
                }
            default:
                return true; // Skip validation for other editors
        }
    }
    async validatePowerShellConfig() {
        try {
            const profilePath = path.join(os.homedir(), 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1');
            return await fs.pathExists(profilePath);
        }
        catch {
            return false;
        }
    }
    async validateWSLConfig() {
        try {
            const wslConfigPath = path.join(os.homedir(), '.wslconfig');
            return await fs.pathExists(wslConfigPath);
        }
        catch {
            return false;
        }
    }
}
exports.WindowsInstaller = WindowsInstaller;
//# sourceMappingURL=windows-installer.js.map