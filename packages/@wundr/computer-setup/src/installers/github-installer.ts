/**
 * GitHub Installer - Complete GitHub setup with Git, GitHub CLI, SSH keys, and GPG signing
 * Ports functionality from 05-github.sh
 */
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { execa } from 'execa';
import which from 'which';

import { Logger } from '../utils/logger';

import type { SetupPlatform, SetupStep, DeveloperProfile } from '../types';
import type { BaseInstaller } from './index';


export class GitHubInstaller implements BaseInstaller {
  name = 'github';
  private readonly homeDir = os.homedir();
  private readonly logger = new Logger({ name: 'GitHubInstaller' });
  
  isSupported(platform: SetupPlatform): boolean {
    return ['darwin', 'linux'].includes(platform.os);
  }

  async isInstalled(): Promise<boolean> {
    try {
      // Check if Git is installed
      await which('git');
      
      // Check if GitHub CLI is installed
      await which('gh');
      
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string | null> {
    try {
      const gitVersion = await execa('git', ['--version']);
      const ghVersion = await execa('gh', ['--version']);
      return `${gitVersion.stdout.trim()}, ${ghVersion.stdout.split('\n')[0]}`;
    } catch {
      return null;
    }
  }

  async install(profile: DeveloperProfile, platform: SetupPlatform): Promise<void> {
    this.logger.info('Installing GitHub tools...');
    
    // Configure Git
    await this.configureGit(profile);
    
    // Setup GitHub CLI
    await this.setupGitHubCLI(platform);
    
    // Generate SSH key
    await this.generateSSHKey(profile);
    
    // Setup commit signing
    await this.setupCommitSigning(profile);
    
    // Create global .gitignore
    await this.createGitignoreGlobal();
    
    // Setup GitHub templates
    await this.setupGitHubTemplates();
  }

  async configure(profile: DeveloperProfile, platform: SetupPlatform): Promise<void> {
    // Apply additional configuration based on profile and platform
    this.logger.info(`Configuring GitHub for ${profile.name} on ${platform.os}`);

    // Set up commit signing preferences if specified in gitConfig
    if (profile.preferences?.gitConfig?.signCommits !== false) {
      try {
        await execa('git', ['config', '--global', 'commit.gpgsign', 'true']);
        // If a GPG key is specified, configure it
        if (profile.preferences?.gitConfig?.gpgKey) {
          await execa('git', ['config', '--global', 'user.signingkey', profile.preferences.gitConfig.gpgKey]);
        }
      } catch (error) {
        // Silently ignore if GPG signing setup fails - key may not be configured
        this.logger.debug('GPG signing setup skipped - key may not be configured:', error);
      }
    }

    // Configure default branch name from profile
    const defaultBranch = profile.preferences?.gitConfig?.defaultBranch || 'main';
    await execa('git', ['config', '--global', 'init.defaultBranch', defaultBranch]);
  }

  async validate(): Promise<boolean> {
    try {
      // Check Git configuration
      await execa('git', ['config', '--global', 'user.name']);
      await execa('git', ['config', '--global', 'user.email']);
      
      // Check GitHub CLI
      await execa('gh', ['--version']);
      
      // Check SSH key exists
      const sshKeyPath = path.join(this.homeDir, '.ssh/id_ed25519');
      await fs.access(sshKeyPath);
      
      return true;
    } catch (error) {
      this.logger.error('GitHub validation failed:', error);
      return false;
    }
  }

  getSteps(profile: DeveloperProfile, platform: SetupPlatform): SetupStep[] {
    return [{
      id: 'install-github',
      name: 'Setup GitHub Integration',
      description: 'Configure Git, GitHub CLI, SSH keys, and commit signing',
      category: 'development',
      required: true,
      dependencies: ['install-homebrew'],
      estimatedTime: 180,
      validator: () => this.validate(),
      installer: () => this.install(profile, platform),
    }];
  }

  private async configureGit(profile: DeveloperProfile): Promise<void> {
    this.logger.info('Configuring Git...');
    
    const configs = [
      ['user.name', profile.name || ''],
      ['user.email', profile.email || ''],
      ['init.defaultBranch', 'main'],
      ['pull.rebase', 'false'],
      ['push.autoSetupRemote', 'true'],
      ['fetch.prune', 'true'],
      ['diff.colorMoved', 'zebra'],
      ['rerere.enabled', 'true'],
      ['column.ui', 'auto'],
      ['branch.sort', '-committerdate'],
      ['core.editor', 'code --wait'],
      ['merge.tool', 'vscode'],
      ['mergetool.vscode.cmd', 'code --wait $MERGED'],
      ['diff.tool', 'vscode'],
      ['difftool.vscode.cmd', 'code --wait --diff $LOCAL $REMOTE'],
    ];
    
    // Git aliases
    const aliases = [
      ['alias.st', 'status'],
      ['alias.co', 'checkout'],
      ['alias.br', 'branch'],
      ['alias.ci', 'commit'],
      ['alias.cm', 'commit -m'],
      ['alias.ca', 'commit --amend'],
      ['alias.unstage', 'reset HEAD --'],
      ['alias.last', 'log -1 HEAD'],
      ['alias.visual', '!gitk'],
      ['alias.lg', "log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit"],
      ['alias.sync', '!git fetch --all && git pull'],
      ['alias.undo', 'reset --soft HEAD~1'],
      ['alias.prune', 'fetch --prune'],
      ['alias.stash-all', 'stash save --include-untracked'],
    ];
    
    const allConfigs = [...configs, ...aliases];
    
    for (const [key, value] of allConfigs) {
      if (value) {
        try {
          await execa('git', ['config', '--global', key, value]);
        } catch (error) {
          this.logger.warn(`Failed to set git config ${key}:`, error);
        }
      }
    }

    this.logger.info('Git configured');
  }

  private async setupGitHubCLI(platform: SetupPlatform): Promise<void> {
    this.logger.info('Setting up GitHub CLI...');
    
    // Install GitHub CLI if not already installed
    try {
      await which('gh');
      this.logger.info('GitHub CLI already installed');
    } catch (error) {
      // gh not found - need to install it
      this.logger.debug('GitHub CLI not found, installing...', error);
      // Install via Homebrew
      try {
        await which('brew');
        await execa('brew', ['install', 'gh']);
      } catch (brewError) {
        // Homebrew not available, try platform-specific install
        this.logger.debug('Homebrew not available, trying alternative install', brewError);
        if (platform.os === 'linux') {
          // Install on Linux
          await this.installGitHubCLILinux();
        } else {
          throw new Error('Homebrew not found. Please install Homebrew first.');
        }
      }
    }
    
    // Configure GitHub CLI settings
    try {
      await execa('gh', ['config', 'set', 'git_protocol', 'ssh']);
      await execa('gh', ['config', 'set', 'prompt', 'enabled']);
      await execa('gh', ['config', 'set', 'editor', 'code --wait']);
    } catch (error) {
      this.logger.warn('Failed to configure GitHub CLI:', error);
    }

    this.logger.info('GitHub CLI configured');
    this.logger.info('Note: Run "gh auth login" to authenticate with GitHub');
  }

  private async installGitHubCLILinux(): Promise<void> {
    const commands = [
      'curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg',
      'sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg',
      'echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null',
      'sudo apt update',
      'sudo apt install gh -y',
    ];
    
    for (const cmd of commands) {
      await execa('bash', ['-c', cmd]);
    }
  }

  private async generateSSHKey(profile: DeveloperProfile): Promise<void> {
    this.logger.info('Setting up SSH key for GitHub...');
    
    const sshDir = path.join(this.homeDir, '.ssh');
    const sshKeyPath = path.join(sshDir, 'id_ed25519');
    
    // Ensure .ssh directory exists
    try {
      await fs.mkdir(sshDir, { mode: 0o700, recursive: true });
    } catch (error) {
      // Directory may already exist, which is fine
      this.logger.debug('SSH directory creation skipped (may already exist):', error);
    }
    
    // Check if SSH key already exists
    try {
      await fs.access(sshKeyPath);
      this.logger.info('SSH key already exists');
    } catch (error) {
      // SSH key doesn't exist, generate a new one
      this.logger.debug('SSH key not found, generating new key...', error);
      this.logger.info('Generating SSH key...');
      await execa('ssh-keygen', [
        '-t', 'ed25519',
        '-C', profile.email || '',
        '-f', sshKeyPath,
        '-N', '',
      ]);
      this.logger.info('SSH key generated');
    }
    
    // Setup SSH config for GitHub
    await this.setupSSHConfig();
    
    // Add SSH key to ssh-agent
    await this.addSSHKeyToAgent(sshKeyPath);

    this.logger.info('SSH key configured');
    this.logger.info(`Public key location: ${sshKeyPath}.pub`);
    this.logger.info('Add this key to your GitHub account or run: gh ssh-key add ~/.ssh/id_ed25519.pub');
  }

  private async setupSSHConfig(): Promise<void> {
    const sshConfigPath = path.join(this.homeDir, '.ssh/config');
    
    const githubConfig = `
Host github.com
  AddKeysToAgent yes
  ${os.platform() === 'darwin' ? 'UseKeychain yes' : ''}
  IdentityFile ~/.ssh/id_ed25519
`;
    
    try {
      let configContent = '';
      try {
        configContent = await fs.readFile(sshConfigPath, 'utf-8');
      } catch (readError) {
        // File doesn't exist - will create it
        this.logger.debug('SSH config file not found, will create new one:', readError);
      }
      
      if (!configContent.includes('Host github.com')) {
        await fs.writeFile(sshConfigPath, configContent + githubConfig, 'utf-8');
        await fs.chmod(sshConfigPath, 0o600);
      }
    } catch (error) {
      this.logger.warn('Failed to setup SSH config:', error);
    }
  }

  private async addSSHKeyToAgent(keyPath: string): Promise<void> {
    try {
      if (os.platform() === 'darwin') {
        // macOS with keychain
        try {
          await execa('ssh-add', ['-K', keyPath]);
        } catch (keychainError) {
          // Keychain flag may not be supported on older macOS versions
          this.logger.debug('Keychain add failed, trying without keychain flag:', keychainError);
          await execa('ssh-add', [keyPath]);
        }
      } else {
        // Linux
        await execa('ssh-add', [keyPath]);
      }
    } catch (error) {
      this.logger.warn('Failed to add SSH key to agent:', error);
    }
  }

  private async setupCommitSigning(profile: DeveloperProfile): Promise<void> {
    this.logger.info('Setting up commit signing...');

    try {
      await which('gpg');
    } catch (error) {
      // GPG not installed - commit signing will not be available
      this.logger.debug('GPG not found:', error);
      this.logger.info('GPG not installed, skipping commit signing setup');
      return;
    }

    // Check if GPG key already exists
    try {
      const { stdout } = await execa('gpg', ['--list-secret-keys', '--keyid-format', 'LONG']);
      if (stdout.includes(profile.email || '')) {
        this.logger.info('GPG key already exists');
        return;
      }
    } catch (error) {
      // No existing GPG keys found - will create one
      this.logger.debug('No existing GPG keys found:', error);
    }
    
    // Generate GPG key
    this.logger.info('Generating GPG key...');
    
    const gpgConfig = `%echo Generating GPG key
Key-Type: RSA
Key-Length: 4096
Subkey-Type: RSA
Subkey-Length: 4096
Name-Real: ${profile.name || ''}
Name-Email: ${profile.email || ''}
Expire-Date: 2y
%no-protection
%commit
%echo done
`;
    
    const tempFile = path.join(os.tmpdir(), 'gpg-gen-key.txt');
    
    try {
      await fs.writeFile(tempFile, gpgConfig);
      await execa('gpg', ['--batch', '--generate-key', tempFile]);
      await fs.unlink(tempFile);
      
      // Get the key ID
      const { stdout } = await execa('gpg', ['--list-secret-keys', '--keyid-format', 'LONG']);
      const lines = stdout.split('\n');
      let keyId = '';
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(profile.email || '')) {
          // Look for the key ID in previous lines
          for (let j = i - 1; j >= 0; j--) {
            const match = lines[j].match(/sec\s+rsa4096\/([A-F0-9]+)/);
            if (match) {
              keyId = match[1];
              break;
            }
          }
          break;
        }
      }
      
      if (keyId) {
        // Configure Git to use the GPG key
        await execa('git', ['config', '--global', 'user.signingkey', keyId]);
        await execa('git', ['config', '--global', 'commit.gpgsign', 'true']);
        await execa('git', ['config', '--global', 'tag.gpgsign', 'true']);

        this.logger.info('GPG key configuration completed');
        this.logger.info(`GPG Key ID: ${keyId}`);
        this.logger.info('Export your public key with: gpg --armor --export ' + keyId);
        this.logger.info('Add this key to your GitHub account for verified commits');
      }
    } catch (error) {
      this.logger.warn('GPG key generation failed:', error);
    }
  }

  private async createGitignoreGlobal(): Promise<void> {
    this.logger.info('Creating global .gitignore...');
    
    const gitignoreContent = `# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db
Desktop.ini

# Editor files
.vscode/
.idea/
*.swp
*.swo
*~
.project
.classpath
.settings/
*.sublime-project
*.sublime-workspace

# Dependencies
node_modules/
bower_components/
vendor/
.pnpm-debug.log*

# Build outputs
dist/
build/
out/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Environment files
.env
.env.local
.env.*.local
.env.development
.env.test
.env.production

# Test coverage
coverage/
*.lcov
.nyc_output/

# Cache directories
.cache/
.parcel-cache/
.next/
.nuxt/
.vuepress/dist/
.serverless/
.fusebox/
.dynamodb/
.tern-port
.yarn/cache/
.yarn/unplugged/
.yarn/build-state.yml
.yarn/install-state.gz

# Misc
*.pid
*.seed
*.pid.lock
.eslintcache
.stylelintcache
*.tsbuildinfo
`;

    const gitignorePath = path.join(this.homeDir, '.gitignore_global');
    
    try {
      await fs.writeFile(gitignorePath, gitignoreContent);
      await execa('git', ['config', '--global', 'core.excludesfile', gitignorePath]);
      this.logger.info('Global .gitignore created');
    } catch (error) {
      this.logger.warn('Failed to create global .gitignore:', error);
    }
  }

  private async setupGitHubTemplates(): Promise<void> {
    this.logger.info('Creating GitHub templates...');
    
    const templatesDir = path.join(this.homeDir, '.github-templates');
    
    try {
      await fs.mkdir(templatesDir, { recursive: true });
      
      // Pull request template
      const prTemplate = `## Description
Brief description of the changes in this PR

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Unit tests pass locally
- [ ] Integration tests pass locally
- [ ] Manual testing completed

## Checklist
- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
`;

      await fs.writeFile(path.join(templatesDir, 'pull_request_template.md'), prTemplate);
      
      // Bug report template
      const bugTemplate = `---
name: Bug report
about: Create a report to help us improve
title: '[BUG] '
labels: bug
assignees: ''
---

**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
A clear and concise description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Environment:**
 - OS: [e.g. macOS]
 - Node version: [e.g. 20.0.0]
 - Package version: [e.g. 1.0.0]

**Additional context**
Add any other context about the problem here.
`;

      await fs.writeFile(path.join(templatesDir, 'bug_report.md'), bugTemplate);
      
      // Feature request template
      const featureTemplate = `---
name: Feature request
about: Suggest an idea for this project
title: '[FEATURE] '
labels: enhancement
assignees: ''
---

**Is your feature request related to a problem? Please describe.**
A clear and concise description of what the problem is. Ex. I'm always frustrated when [...]

**Describe the solution you'd like**
A clear and concise description of what you want to happen.

**Describe alternatives you've considered**
A clear and concise description of any alternative solutions or features you've considered.

**Additional context**
Add any other context or screenshots about the feature request here.
`;

      await fs.writeFile(path.join(templatesDir, 'feature_request.md'), featureTemplate);

      this.logger.info(`GitHub templates created in ${templatesDir}`);
    } catch (error) {
      this.logger.warn('Failed to create GitHub templates:', error);
    }
  }

  async uninstall(): Promise<void> {
    this.logger.info('Uninstalling GitHub tools...');
    
    try {
      // Remove GitHub CLI
      try {
        await which('brew');
        await execa('brew', ['uninstall', 'gh']);
      } catch (error) {
        // Homebrew may not be available or gh may not be installed via brew
        this.logger.debug('Could not uninstall gh via Homebrew:', error);
      }

      // Remove SSH keys (with user confirmation in real scenario)
      const sshDir = path.join(this.homeDir, '.ssh');
      try {
        await fs.rm(path.join(sshDir, 'id_ed25519'));
        await fs.rm(path.join(sshDir, 'id_ed25519.pub'));
      } catch (error) {
        // SSH keys may not exist
        this.logger.debug('Could not remove SSH keys (may not exist):', error);
      }

      // Remove templates
      try {
        await fs.rm(path.join(this.homeDir, '.github-templates'), { recursive: true });
      } catch (error) {
        // Templates directory may not exist
        this.logger.debug('Could not remove GitHub templates (may not exist):', error);
      }

      this.logger.info('GitHub tools uninstalled');
    } catch (error) {
      throw new Error(`GitHub tools uninstallation failed: ${error}`);
    }
  }
}