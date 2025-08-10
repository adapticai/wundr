/**
 * Git Installer - Git installation and configuration
 */
import { execa } from 'execa';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import which from 'which';
import { BaseInstaller } from './index';
import { SetupPlatform, SetupStep, DeveloperProfile } from '../types';

export class GitInstaller implements BaseInstaller {
  name = 'git';

  isSupported(platform: SetupPlatform): boolean {
    return ['darwin', 'linux', 'win32'].includes(platform.os);
  }

  async isInstalled(): Promise<boolean> {
    try {
      await which('git');
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string | null> {
    try {
      const { stdout } = await execa('git', ['--version']);
      return stdout.trim();
    } catch {
      return null;
    }
  }

  async install(profile: DeveloperProfile, platform: SetupPlatform): Promise<void> {
    // Install Git if not present
    const isInstalled = await this.isInstalled();
    if (!isInstalled) {
      await this.installGit(platform);
    }

    // Configure Git
    await this.configureGit(profile, platform);
  }

  async configure(profile: DeveloperProfile, platform: SetupPlatform): Promise<void> {
    await this.configureGit(profile, platform);
  }

  async validate(): Promise<boolean> {
    try {
      const version = await this.getVersion();
      if (!version) return false;

      // Check if basic config is set
      const { stdout: userName } = await execa('git', ['config', '--global', 'user.name']);
      const { stdout: userEmail } = await execa('git', ['config', '--global', 'user.email']);
      
      return !!(userName && userEmail);
    } catch {
      return false;
    }
  }

  getSteps(profile: DeveloperProfile, platform: SetupPlatform): SetupStep[] {
    const steps: SetupStep[] = [
      {
        id: 'install-git',
        name: 'Install Git',
        description: 'Install Git version control system',
        category: 'development',
        required: true,
        dependencies: [],
        estimatedTime: 60,
        validator: () => this.isInstalled(),
        installer: () => this.installGit(platform)
      },
      {
        id: 'configure-git-basic',
        name: 'Configure Git Identity',
        description: 'Set up Git user name and email',
        category: 'configuration',
        required: true,
        dependencies: ['install-git'],
        estimatedTime: 15,
        validator: () => this.validateBasicConfig(profile),
        installer: () => this.configureBasicGit(profile)
      },
      {
        id: 'configure-git-advanced',
        name: 'Configure Git Advanced Settings',
        description: 'Set up Git aliases, signing, and advanced configuration',
        category: 'configuration',
        required: false,
        dependencies: ['configure-git-basic'],
        estimatedTime: 30,
        validator: () => this.validateAdvancedConfig(profile),
        installer: () => this.configureAdvancedGit(profile, platform)
      }
    ];

    if (profile.preferences.gitConfig.signCommits) {
      steps.push({
        id: 'setup-git-signing',
        name: 'Setup Git Commit Signing',
        description: 'Configure GPG signing for commits',
        category: 'configuration',
        required: false,
        dependencies: ['configure-git-basic'],
        estimatedTime: 120,
        validator: () => this.validateGPGSigning(profile),
        installer: () => this.setupCommitSigning(profile, platform)
      });
    }

    return steps;
  }

  private async installGit(platform: SetupPlatform): Promise<void> {
    switch (platform.os) {
      case 'darwin':
        await this.installOnMac();
        break;
      case 'linux':
        await this.installOnLinux(platform);
        break;
      case 'win32':
        await this.installOnWindows();
        break;
      default:
        throw new Error(`Git installation not supported on ${platform.os}`);
    }
  }

  private async installOnMac(): Promise<void> {
    try {
      // Check if Homebrew is available
      await which('brew');
      await execa('brew', ['install', 'git']);
    } catch {
      // Xcode command line tools should provide git
      try {
        await execa('xcode-select', ['--install']);
        console.log('Xcode Command Line Tools installation initiated. Please complete the installation and run setup again.');
      } catch {
        throw new Error('Git installation failed. Please install Xcode Command Line Tools or Homebrew.');
      }
    }
  }

  private async installOnLinux(platform: SetupPlatform): Promise<void> {
    const distro = platform.distro || await this.detectLinuxDistro();
    
    switch (distro) {
      case 'ubuntu':
      case 'debian':
        await execa('sudo', ['apt-get', 'update']);
        await execa('sudo', ['apt-get', 'install', '-y', 'git']);
        break;
      case 'centos':
      case 'rhel':
      case 'fedora':
        await execa('sudo', ['yum', 'install', '-y', 'git']);
        break;
      default:
        throw new Error(`Git installation not supported on ${distro}`);
    }
  }

  private async installOnWindows(): Promise<void> {
    throw new Error('Git installation on Windows requires manual download from git-scm.com or using package managers like Chocolatey');
  }

  private async configureGit(profile: DeveloperProfile, platform: SetupPlatform): Promise<void> {
    await this.configureBasicGit(profile);
    await this.configureAdvancedGit(profile, platform);
    
    if (profile.preferences.gitConfig.signCommits) {
      await this.setupCommitSigning(profile, platform);
    }
  }

  private async configureBasicGit(profile: DeveloperProfile): Promise<void> {
    const { gitConfig } = profile.preferences;
    
    // Set user identity
    await execa('git', ['config', '--global', 'user.name', gitConfig.userName]);
    await execa('git', ['config', '--global', 'user.email', gitConfig.userEmail]);
    
    // Set default branch
    await execa('git', ['config', '--global', 'init.defaultBranch', gitConfig.defaultBranch]);
  }

  private async configureAdvancedGit(profile: DeveloperProfile, platform: SetupPlatform): Promise<void> {
    const { gitConfig } = profile.preferences;
    
    // Set up aliases
    for (const [alias, command] of Object.entries(gitConfig.aliases)) {
      await execa('git', ['config', '--global', `alias.${alias}`, command]);
    }
    
    // Configure editor
    const editorMap: Record<string, string> = {
      'vscode': 'code --wait',
      'vim': 'vim',
      'neovim': 'nvim',
      'sublime': 'subl -w'
    };
    
    const editor = editorMap[profile.preferences.editor];
    if (editor) {
      await execa('git', ['config', '--global', 'core.editor', editor]);
    }
    
    // Configure useful defaults
    await execa('git', ['config', '--global', 'core.autocrlf', platform.os === 'win32' ? 'true' : 'input']);
    await execa('git', ['config', '--global', 'core.safecrlf', 'warn']);
    await execa('git', ['config', '--global', 'pull.rebase', 'false']);
    await execa('git', ['config', '--global', 'push.default', 'simple']);
    await execa('git', ['config', '--global', 'rerere.enabled', 'true']);
    
    // Configure colors
    await execa('git', ['config', '--global', 'color.ui', 'auto']);
    
    // Configure diff and merge tools
    if (profile.preferences.editor === 'vscode') {
      await execa('git', ['config', '--global', 'diff.tool', 'vscode']);
      await execa('git', ['config', '--global', 'difftool.vscode.cmd', 'code --wait --diff $LOCAL $REMOTE']);
      await execa('git', ['config', '--global', 'merge.tool', 'vscode']);
      await execa('git', ['config', '--global', 'mergetool.vscode.cmd', 'code --wait $MERGED']);
    }
    
    // Set up .gitconfig includes for work/personal separation
    await this.setupGitIncludes(profile, platform);
  }

  private async setupCommitSigning(profile: DeveloperProfile, platform: SetupPlatform): Promise<void> {
    const { gitConfig } = profile.preferences;
    
    if (!gitConfig.gpgKey) {
      // Generate GPG key if not provided
      await this.generateGPGKey(profile, platform);
    } else {
      // Import existing GPG key
      await this.importGPGKey(gitConfig.gpgKey);
    }
    
    // Configure Git to sign commits
    await execa('git', ['config', '--global', 'commit.gpgsign', 'true']);
    await execa('git', ['config', '--global', 'user.signingkey', gitConfig.gpgKey || await this.getGPGKeyId(profile)]);
    
    // Configure GPG program
    if (platform.os === 'darwin') {
      await execa('git', ['config', '--global', 'gpg.program', 'gpg']);
    }
  }

  private async generateGPGKey(profile: DeveloperProfile, platform: SetupPlatform): Promise<void> {
    // Check if GPG is installed
    try {
      await which('gpg');
    } catch {
      await this.installGPG(platform);
    }
    
    // Generate GPG key batch file
    const batchFile = path.join(os.tmpdir(), 'gpg-batch.txt');
    const batchContent = `
%echo Generating a default key
Key-Type: RSA
Key-Length: 4096
Subkey-Type: RSA
Subkey-Length: 4096
Name-Real: ${profile.name}
Name-Email: ${profile.email}
Expire-Date: 2y
Passphrase: 
%commit
%echo done
`;
    
    await fs.writeFile(batchFile, batchContent.trim());
    
    try {
      await execa('gpg', ['--batch', '--generate-key', batchFile]);
    } finally {
      await fs.remove(batchFile);
    }
  }

  private async importGPGKey(gpgKey: string): Promise<void> {
    // This would import an existing GPG key
    // Implementation depends on key format (file path, key content, etc.)
  }

  private async getGPGKeyId(profile: DeveloperProfile): Promise<string> {
    try {
      const { stdout } = await execa('gpg', ['--list-secret-keys', '--keyid-format', 'LONG', profile.email]);
      const match = stdout.match(/sec\s+\w+\/(\w+)/);
      return match ? match[1] : '';
    } catch {
      return '';
    }
  }

  private async installGPG(platform: SetupPlatform): Promise<void> {
    switch (platform.os) {
      case 'darwin':
        try {
          await which('brew');
          await execa('brew', ['install', 'gnupg']);
        } catch {
          throw new Error('GPG installation requires Homebrew on macOS');
        }
        break;
      case 'linux':
        const distro = platform.distro || await this.detectLinuxDistro();
        if (['ubuntu', 'debian'].includes(distro)) {
          await execa('sudo', ['apt-get', 'install', '-y', 'gnupg']);
        } else {
          await execa('sudo', ['yum', 'install', '-y', 'gnupg']);
        }
        break;
      case 'win32':
        throw new Error('GPG installation on Windows requires manual setup');
    }
  }

  private async setupGitIncludes(profile: DeveloperProfile, platform: SetupPlatform): Promise<void> {
    const gitDir = path.join(os.homedir(), '.config', 'git');
    await fs.ensureDir(gitDir);
    
    // Create work-specific config
    if (profile.team) {
      const workConfig = path.join(gitDir, 'work');
      const workConfigContent = `
[user]
    email = ${profile.email}
    name = ${profile.name}
[core]
    sshCommand = ssh -i ~/.ssh/id_work
`;
      await fs.writeFile(workConfig, workConfigContent.trim());
      
      // Add include to main config
      await execa('git', ['config', '--global', 'includeIf.gitdir:~/work/.path', gitDir + '/work']);
    }
  }

  private async detectLinuxDistro(): Promise<string> {
    try {
      const { stdout } = await execa('lsb_release', ['-si']);
      return stdout.toLowerCase().trim();
    } catch {
      try {
        const { stdout } = await execa('cat', ['/etc/os-release']);
        const idMatch = stdout.match(/^ID=(.+)$/m);
        return idMatch ? idMatch[1].replace(/"/g, '') : 'unknown';
      } catch {
        return 'unknown';
      }
    }
  }

  private async validateBasicConfig(profile: DeveloperProfile): Promise<boolean> {
    try {
      const { stdout: userName } = await execa('git', ['config', '--global', 'user.name']);
      const { stdout: userEmail } = await execa('git', ['config', '--global', 'user.email']);
      
      return userName === profile.name && userEmail === profile.email;
    } catch {
      return false;
    }
  }

  private async validateAdvancedConfig(profile: DeveloperProfile): Promise<boolean> {
    try {
      // Check if aliases are configured
      const { gitConfig } = profile.preferences;
      for (const alias of Object.keys(gitConfig.aliases)) {
        const { stdout } = await execa('git', ['config', '--global', `alias.${alias}`]);
        if (!stdout) return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  private async validateGPGSigning(profile: DeveloperProfile): Promise<boolean> {
    try {
      const { stdout: signing } = await execa('git', ['config', '--global', 'commit.gpgsign']);
      const { stdout: signingKey } = await execa('git', ['config', '--global', 'user.signingkey']);
      
      return signing === 'true' && !!signingKey;
    } catch {
      return false;
    }
  }
}