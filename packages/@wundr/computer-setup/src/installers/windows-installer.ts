/**
 * Windows Platform Installer - Windows-specific tools and configurations
 */
import * as os from 'os';
import * as path from 'path';

import { execa } from 'execa';
import * as fs from 'fs-extra';
import which from 'which';

import { Logger } from '../utils/logger';

import type { SetupPlatform, SetupStep, DeveloperProfile } from '../types';
import type { BaseInstaller } from './index';

export class WindowsInstaller implements BaseInstaller {
  name = 'windows-platform';
  private readonly logger = new Logger({ name: 'WindowsInstaller' });

  isSupported(platform: SetupPlatform): boolean {
    return platform.os === 'win32';
  }

  async isInstalled(): Promise<boolean> {
    // Check if essential Windows dev tools are installed
    try {
      await this.checkPowerShellVersion();
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string | null> {
    try {
      const { stdout } = await execa('powershell', ['-Command', 'Get-ComputerInfo | Select-Object WindowsProductName, WindowsVersion | ConvertTo-Json']);
      const info = JSON.parse(stdout);
      return `${info.WindowsProductName} ${info.WindowsVersion}`;
    } catch {
      return null;
    }
  }

  async install(profile: DeveloperProfile, _platform: SetupPlatform): Promise<void> {
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

  async configure(profile: DeveloperProfile, _platform: SetupPlatform): Promise<void> {
    await this.configureWindows(profile);
    await this.configurePowerShell(profile);
    await this.configureWSL(profile);
    await this.setupDeveloperMode();
  }

  async validate(): Promise<boolean> {
    try {
      await this.checkPowerShellVersion();
      await which('choco');
      return true;
    } catch {
      return false;
    }
  }

  getSteps(profile: DeveloperProfile, _platform: SetupPlatform): SetupStep[] {
    const steps: SetupStep[] = [
      {
        id: 'enable-developer-mode',
        name: 'Enable Developer Mode',
        description: 'Enable Windows Developer Mode for development features',
        category: 'system',
        required: true,
        dependencies: [],
        estimatedTime: 30,
        validator: () => this.validateDeveloperMode(),
        installer: () => this.setupDeveloperMode(),
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
        installer: () => this.installWSL2(),
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
        installer: () => this.installChocolatey(),
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
        installer: () => this.installScoop(),
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
        installer: () => this.installEssentialPackages(),
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
        installer: () => this.installDevelopmentTools(profile),
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
        installer: () => this.configurePowerShell(profile),
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
        installer: () => this.configureWSL(profile),
      },
    ];

    return steps;
  }

  private async checkPowerShellVersion(): Promise<void> {
    await execa('powershell', ['-Command', '$PSVersionTable.PSVersion']);
  }

  private async setupDeveloperMode(): Promise<void> {
    try {
      // Enable Developer Mode via registry
      const regCommand = 'reg add "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\AppModelUnlock" /t REG_DWORD /f /v "AllowDevelopmentWithoutDevLicense" /d "1"';
      await execa('powershell', ['-Command', `Start-Process powershell -ArgumentList '-Command "${regCommand}"' -Verb RunAs`]);

      this.logger.info('Developer Mode enabled. You may need to restart your computer for changes to take effect.');
    } catch (_error) {
      this.logger.warn('Failed to enable Developer Mode automatically. Please enable it manually in Windows Settings.');
    }
  }

  private async installWSL2(): Promise<void> {
    try {
      // Check if WSL is already installed
      await execa('wsl', ['--version']);
      this.logger.info('WSL2 is already installed');
    } catch {
      this.logger.info('Installing WSL2...');

      // Enable Windows Subsystem for Linux
      await execa('powershell', ['-Command', 'Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -NoRestart']);

      // Enable Virtual Machine Platform
      await execa('powershell', ['-Command', 'Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -NoRestart']);

      // Set WSL 2 as default version
      await execa('wsl', ['--set-default-version', '2']);

      // Install Ubuntu (most common distribution)
      await execa('powershell', ['-Command', 'Invoke-WebRequest -Uri https://aka.ms/wslubuntu2204 -OutFile Ubuntu.appx -UseBasicParsing']);
      await execa('powershell', ['-Command', 'Add-AppxPackage .\\Ubuntu.appx']);
      await execa('powershell', ['-Command', 'Remove-Item .\\Ubuntu.appx']);

      this.logger.info('WSL2 installation complete. Please restart your computer and run Ubuntu from the Start menu to complete setup.');
    }
  }

  private async installChocolatey(): Promise<void> {
    try {
      await which('choco');
      this.logger.info('Chocolatey is already installed');
    } catch {
      this.logger.info('Installing Chocolatey...');
      const installScript = 'Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString(\'https://community.chocolatey.org/install.ps1\'))';
      await execa('powershell', ['-Command', installScript]);
    }
  }

  private async installScoop(): Promise<void> {
    try {
      await which('scoop');
      this.logger.info('Scoop is already installed');
    } catch {
      this.logger.info('Installing Scoop...');

      // Set execution policy for current user
      await execa('powershell', ['-Command', 'Set-ExecutionPolicy RemoteSigned -Scope CurrentUser']);

      // Install Scoop
      const installScript = 'irm get.scoop.sh | iex';
      await execa('powershell', ['-Command', installScript]);

      // Add useful buckets
      await execa('scoop', ['bucket', 'add', 'extras']);
      await execa('scoop', ['bucket', 'add', 'versions']);
    }
  }

  private async installEssentialPackages(): Promise<void> {
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
      'powertoys',
    ];

    const scoopPackages = [
      'aria2', // Download manager for Scoop
      'tree',
      'which',
      'vim',
      'nano',
      'htop',
    ];

    // Install Chocolatey packages
    for (const pkg of chocoPackages) {
      try {
        await execa('choco', ['install', pkg, '-y']);
      } catch (error) {
        this.logger.warn(`Failed to install ${pkg} via Chocolatey:`, error);
      }
    }

    // Install Scoop packages
    for (const pkg of scoopPackages) {
      try {
        await execa('scoop', ['install', pkg]);
      } catch (error) {
        this.logger.warn(`Failed to install ${pkg} via Scoop:`, error);
      }
    }
  }

  private async installDevelopmentTools(profile: DeveloperProfile): Promise<void> {
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

  private async installFrontendTools(_profile: DeveloperProfile): Promise<void> {
    const packages = [
      'googlechrome',
      'firefox',
      'microsoft-edge',
    ];

    for (const pkg of packages) {
      try {
        await execa('choco', ['install', pkg, '-y']);
      } catch (error) {
        this.logger.warn(`Failed to install ${pkg}:`, error);
      }
    }
  }

  private async installBackendTools(_profile: DeveloperProfile): Promise<void> {
    const packages = [
      'postman',
      'dbeaver',
      'redis-desktop-manager',
    ];

    for (const pkg of packages) {
      try {
        await execa('choco', ['install', pkg, '-y']);
      } catch (error) {
        this.logger.warn(`Failed to install ${pkg}:`, error);
      }
    }
  }

  private async installDevOpsTools(_profile: DeveloperProfile): Promise<void> {
    const packages = [
      'kubernetes-cli',
      'terraform',
      'ansible',
      'azure-cli',
      'awscli',
      'gcloudsdk',
    ];

    for (const pkg of packages) {
      try {
        await execa('choco', ['install', pkg, '-y']);
      } catch (error) {
        this.logger.warn(`Failed to install ${pkg}:`, error);
      }
    }
  }

  private async installMobileTools(_profile: DeveloperProfile): Promise<void> {
    const packages = [
      'androidstudio',
      'adb',
    ];

    for (const pkg of packages) {
      try {
        await execa('choco', ['install', pkg, '-y']);
      } catch (error) {
        this.logger.warn(`Failed to install ${pkg}:`, error);
      }
    }
  }

  private async installMLTools(_profile: DeveloperProfile): Promise<void> {
    const packages = [
      'python',
      'anaconda3',
      'jupyter',
    ];

    for (const pkg of packages) {
      try {
        await execa('choco', ['install', pkg, '-y']);
      } catch (error) {
        this.logger.warn(`Failed to install ${pkg}:`, error);
      }
    }
  }

  private async installCommonDevTools(profile: DeveloperProfile): Promise<void> {
    const packages = ['windows-terminal'];

    // Editor-specific installation
    const editor = profile.preferences?.editor || 'vscode';
    switch (editor) {
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
    if (profile.tools?.communication?.slack) {
      packages.push('slack');
    }
    if (profile.tools?.communication?.teams) {
      packages.push('microsoft-teams');
    }
    if (profile.tools?.communication?.discord) {
      packages.push('discord');
    }
    if (profile.tools?.communication?.zoom) {
      packages.push('zoom');
    }

    // Install packages
    for (const pkg of packages) {
      try {
        await execa('choco', ['install', pkg, '-y']);
      } catch (error) {
        this.logger.warn(`Failed to install ${pkg}:`, error);
      }
    }
  }

  private async configureWindows(_profile: DeveloperProfile): Promise<void> {
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
        await execa('powershell', ['-Command', cmd]);
      } catch (error) {
        this.logger.warn(`Failed to execute registry command: ${cmd}`, error);
      }
    }
  }

  private async configurePowerShell(_profile: DeveloperProfile): Promise<void> {
    // Install PowerShell modules
    const modules = [
      'posh-git',
      'oh-my-posh',
      'PSReadLine',
    ];

    for (const module of modules) {
      try {
        await execa('powershell', ['-Command', `Install-Module -Name ${module} -Force -SkipPublisherCheck`]);
      } catch (error) {
        this.logger.warn(`Failed to install PowerShell module ${module}:`, error);
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

  private async configureWSL(profile: DeveloperProfile): Promise<void> {
    try {
      // Check if WSL is running
      await execa('wsl', ['--list', '--running']);

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

      this.logger.info('WSL configuration complete. Consider setting up your preferred Linux distribution.');
    } catch (error) {
      this.logger.warn('WSL configuration failed:', error);
    }
  }

  // Validation methods
  private async validateDeveloperMode(): Promise<boolean> {
    try {
      const { stdout } = await execa('powershell', ['-Command', 'Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\AppModelUnlock" -Name "AllowDevelopmentWithoutDevLicense"']);
      return stdout.includes('1');
    } catch {
      return false;
    }
  }

  private async validateWSL2(): Promise<boolean> {
    try {
      await execa('wsl', ['--version']);
      return true;
    } catch {
      return false;
    }
  }

  private async validateChocolatey(): Promise<boolean> {
    try {
      await which('choco');
      return true;
    } catch {
      return false;
    }
  }

  private async validateScoop(): Promise<boolean> {
    try {
      await which('scoop');
      return true;
    } catch {
      return false;
    }
  }

  private async validateEssentialPackages(): Promise<boolean> {
    const essentialTools = ['git', 'curl', 'gh'];
    
    for (const tool of essentialTools) {
      try {
        await which(tool);
      } catch {
        return false;
      }
    }
    
    return true;
  }

  private async validateDevelopmentTools(profile: DeveloperProfile): Promise<boolean> {
    // Basic validation - check if editor is installed
    const editor = profile.preferences?.editor || 'vscode';
    switch (editor) {
      case 'vscode':
        try {
          await which('code');
          return true;
        } catch {
          return false;
        }
      default:
        return true; // Skip validation for other editors
    }
  }

  private async validatePowerShellConfig(): Promise<boolean> {
    try {
      const profilePath = path.join(os.homedir(), 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1');
      return await fs.pathExists(profilePath);
    } catch {
      return false;
    }
  }

  private async validateWSLConfig(): Promise<boolean> {
    try {
      const wslConfigPath = path.join(os.homedir(), '.wslconfig');
      return await fs.pathExists(wslConfigPath);
    } catch {
      return false;
    }
  }
}