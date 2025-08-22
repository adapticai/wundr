"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitInstaller = void 0;
const tslib_1 = require("tslib");
/**
 * Git Installer - Git installation and configuration
 */
const execa_1 = require("execa");
const fs = tslib_1.__importStar(require("fs-extra"));
const path = tslib_1.__importStar(require("path"));
const os = tslib_1.__importStar(require("os"));
const which_1 = tslib_1.__importDefault(require("which"));
class GitInstaller {
    name = 'git';
    isSupported(platform) {
        return ['darwin', 'linux', 'win32'].includes(platform.os);
    }
    async isInstalled() {
        try {
            await (0, which_1.default)('git');
            return true;
        }
        catch {
            return false;
        }
    }
    async getVersion() {
        try {
            const { stdout } = await (0, execa_1.execa)('git', ['--version']);
            return stdout.trim();
        }
        catch {
            return null;
        }
    }
    async install(profile, platform) {
        // Install Git if not present
        const isInstalled = await this.isInstalled();
        if (!isInstalled) {
            await this.installGit(platform);
        }
        // Configure Git
        await this.configureGit(profile, platform);
    }
    async configure(profile, platform) {
        await this.configureGit(profile, platform);
        // Setup SSH keys for GitHub/GitLab
        await this.setupSSHKeys(profile, platform);
    }
    async validate() {
        try {
            const version = await this.getVersion();
            if (!version)
                return false;
            // Check if basic config is set
            const { stdout: userName } = await (0, execa_1.execa)('git', ['config', '--global', 'user.name']);
            const { stdout: userEmail } = await (0, execa_1.execa)('git', ['config', '--global', 'user.email']);
            return !!(userName && userEmail);
        }
        catch {
            return false;
        }
    }
    getSteps(profile, platform) {
        const steps = [
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
        // Add SSH key setup step
        steps.push({
            id: 'setup-ssh-keys',
            name: 'Setup SSH Keys',
            description: 'Generate and configure SSH keys for Git remotes',
            category: 'configuration',
            required: false,
            dependencies: ['configure-git-basic'],
            estimatedTime: 60,
            validator: () => this.validateSSHKeys(),
            installer: () => this.setupSSHKeys(profile, platform)
        });
        return steps;
    }
    async installGit(platform) {
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
    async installOnMac() {
        try {
            // Check if Homebrew is available
            await (0, which_1.default)('brew');
            await (0, execa_1.execa)('brew', ['install', 'git']);
        }
        catch {
            // Xcode command line tools should provide git
            try {
                await (0, execa_1.execa)('xcode-select', ['--install']);
                console.log('Xcode Command Line Tools installation initiated. Please complete the installation and run setup again.');
            }
            catch {
                throw new Error('Git installation failed. Please install Xcode Command Line Tools or Homebrew.');
            }
        }
    }
    async installOnLinux(platform) {
        const distro = platform.distro || await this.detectLinuxDistro();
        switch (distro) {
            case 'ubuntu':
            case 'debian':
                await (0, execa_1.execa)('sudo', ['apt-get', 'update']);
                await (0, execa_1.execa)('sudo', ['apt-get', 'install', '-y', 'git']);
                break;
            case 'centos':
            case 'rhel':
            case 'fedora':
                await (0, execa_1.execa)('sudo', ['yum', 'install', '-y', 'git']);
                break;
            default:
                throw new Error(`Git installation not supported on ${distro}`);
        }
    }
    async installOnWindows() {
        throw new Error('Git installation on Windows requires manual download from git-scm.com or using package managers like Chocolatey');
    }
    async configureGit(profile, platform) {
        await this.configureBasicGit(profile);
        await this.configureAdvancedGit(profile, platform);
        if (profile.preferences.gitConfig.signCommits) {
            await this.setupCommitSigning(profile, platform);
        }
    }
    async configureBasicGit(profile) {
        const { gitConfig } = profile.preferences;
        // Set user identity
        await (0, execa_1.execa)('git', ['config', '--global', 'user.name', gitConfig.userName]);
        await (0, execa_1.execa)('git', ['config', '--global', 'user.email', gitConfig.userEmail]);
        // Set default branch
        await (0, execa_1.execa)('git', ['config', '--global', 'init.defaultBranch', gitConfig.defaultBranch]);
    }
    async configureAdvancedGit(profile, platform) {
        console.log('Configuring Git advanced settings...');
        const { gitConfig } = profile.preferences;
        // Basic Git settings from the script
        await (0, execa_1.execa)('git', ['config', '--global', 'init.defaultBranch', gitConfig.defaultBranch || 'main']);
        await (0, execa_1.execa)('git', ['config', '--global', 'pull.rebase', 'false']);
        await (0, execa_1.execa)('git', ['config', '--global', 'push.autoSetupRemote', 'true']);
        await (0, execa_1.execa)('git', ['config', '--global', 'fetch.prune', 'true']);
        await (0, execa_1.execa)('git', ['config', '--global', 'diff.colorMoved', 'zebra']);
        await (0, execa_1.execa)('git', ['config', '--global', 'rerere.enabled', 'true']);
        await (0, execa_1.execa)('git', ['config', '--global', 'column.ui', 'auto']);
        await (0, execa_1.execa)('git', ['config', '--global', 'branch.sort', '-committerdate']);
        // Configure editor
        const editorMap = {
            'vscode': 'code --wait',
            'vim': 'vim',
            'neovim': 'nvim',
            'sublime': 'subl -w'
        };
        const editor = editorMap[profile.preferences?.editor] || 'code --wait';
        await (0, execa_1.execa)('git', ['config', '--global', 'core.editor', editor]);
        // Configure diff and merge tools for VS Code
        await (0, execa_1.execa)('git', ['config', '--global', 'merge.tool', 'vscode']);
        await (0, execa_1.execa)('git', ['config', '--global', 'mergetool.vscode.cmd', 'code --wait $MERGED']);
        await (0, execa_1.execa)('git', ['config', '--global', 'diff.tool', 'vscode']);
        await (0, execa_1.execa)('git', ['config', '--global', 'difftool.vscode.cmd', 'code --wait --diff $LOCAL $REMOTE']);
        // Set up aliases from the script
        const commonAliases = {
            'st': 'status',
            'co': 'checkout',
            'br': 'branch',
            'ci': 'commit',
            'cm': 'commit -m',
            'ca': 'commit --amend',
            'unstage': 'reset HEAD --',
            'last': 'log -1 HEAD',
            'visual': '!gitk',
            'lg': "log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit",
            'sync': '!git fetch --all && git pull',
            'undo': 'reset --soft HEAD~1',
            'prune': 'fetch --prune',
            'stash-all': 'stash save --include-untracked'
        };
        // Set up aliases
        const aliases = { ...commonAliases, ...gitConfig.aliases };
        for (const [alias, command] of Object.entries(aliases)) {
            await (0, execa_1.execa)('git', ['config', '--global', `alias.${alias}`, command]);
        }
        // Configure colors
        await (0, execa_1.execa)('git', ['config', '--global', 'color.ui', 'auto']);
        // Setup global gitignore
        await this.setupGlobalGitignore();
        console.log('Git advanced configuration completed');
    }
    async setupCommitSigning(profile, platform) {
        const { gitConfig } = profile.preferences;
        try {
            if (!gitConfig.gpgKey) {
                // Generate GPG key if not provided
                await this.generateGPGKey(profile, platform);
            }
            else {
                // Import existing GPG key
                await this.importGPGKey(gitConfig.gpgKey);
            }
            // Configure Git to sign commits
            await (0, execa_1.execa)('git', ['config', '--global', 'commit.gpgsign', 'true']);
            const keyId = gitConfig.gpgKey || await this.getGPGKeyId(profile);
            if (keyId) {
                await (0, execa_1.execa)('git', ['config', '--global', 'user.signingkey', keyId]);
            }
            // Configure GPG program
            if (platform.os === 'darwin') {
                await (0, execa_1.execa)('git', ['config', '--global', 'gpg.program', 'gpg']);
            }
        }
        catch (error) {
            console.warn(`Warning: Failed to setup commit signing: ${error}`);
            console.warn('You can manually configure GPG signing later');
        }
    }
    async generateGPGKey(profile, platform) {
        console.log('Setting up commit signing...');
        // Check if GPG is installed
        try {
            await (0, which_1.default)('gpg');
        }
        catch {
            await this.installGPG(platform);
        }
        // Check if GPG key already exists for this email
        try {
            const { stdout } = await (0, execa_1.execa)('gpg', ['--list-secret-keys', '--keyid-format', 'LONG']);
            if (stdout.includes(profile.email || '')) {
                console.log('GPG key already exists');
                return;
            }
        }
        catch {
            // No existing keys, proceed with generation
        }
        // Generate GPG key batch file
        const batchFile = path.join(os.tmpdir(), 'gpg-gen-key.txt');
        const batchContent = `%echo Generating GPG key
Key-Type: RSA
Key-Length: 4096
Subkey-Type: RSA
Subkey-Length: 4096
Name-Real: ${profile.name}
Name-Email: ${profile.email}
Expire-Date: 2y
%no-protection
%commit
%echo done`;
        await fs.writeFile(batchFile, batchContent);
        try {
            await (0, execa_1.execa)('gpg', ['--batch', '--generate-key', batchFile]);
            // Get the key ID
            const keyId = await this.getGPGKeyId(profile);
            if (keyId) {
                // Configure Git to use the key
                await (0, execa_1.execa)('git', ['config', '--global', 'user.signingkey', keyId]);
                await (0, execa_1.execa)('git', ['config', '--global', 'commit.gpgsign', 'true']);
                await (0, execa_1.execa)('git', ['config', '--global', 'tag.gpgsign', 'true']);
                console.log('GPG key generated and configured for commit signing');
                // Export public key for GitHub/GitLab
                const { stdout: publicKey } = await (0, execa_1.execa)('gpg', ['--armor', '--export', keyId]);
                console.log('\nGPG Public Key (add this to your GitHub/GitLab account):');
                console.log(publicKey);
                console.log('\nYou can add this key at:');
                console.log('- GitHub: https://github.com/settings/gpg/new');
                console.log('- GitLab: https://gitlab.com/-/profile/gpg_keys');
            }
        }
        finally {
            await fs.remove(batchFile).catch(() => { });
        }
    }
    async importGPGKey(gpgKey) {
        // This would import an existing GPG key
        // Implementation depends on key format (file path, key content, etc.)
    }
    async getGPGKeyId(profile) {
        try {
            const { stdout } = await (0, execa_1.execa)('gpg', ['--list-secret-keys', '--keyid-format', 'LONG', profile.email]);
            const match = stdout.match(/sec\s+\w+\/(\w+)/);
            return match ? match[1] : '';
        }
        catch {
            return '';
        }
    }
    async installGPG(platform) {
        switch (platform.os) {
            case 'darwin':
                try {
                    await (0, which_1.default)('brew');
                    await (0, execa_1.execa)('brew', ['install', 'gnupg']);
                }
                catch {
                    throw new Error('GPG installation requires Homebrew on macOS');
                }
                break;
            case 'linux':
                const distro = platform.distro || await this.detectLinuxDistro();
                if (['ubuntu', 'debian'].includes(distro)) {
                    await (0, execa_1.execa)('sudo', ['apt-get', 'install', '-y', 'gnupg']);
                }
                else {
                    await (0, execa_1.execa)('sudo', ['yum', 'install', '-y', 'gnupg']);
                }
                break;
            case 'win32':
                throw new Error('GPG installation on Windows requires manual setup');
        }
    }
    async setupGitIncludes(profile, platform) {
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
            await (0, execa_1.execa)('git', ['config', '--global', 'includeIf.gitdir:~/work/.path', gitDir + '/work']);
        }
    }
    async detectLinuxDistro() {
        try {
            const { stdout } = await (0, execa_1.execa)('lsb_release', ['-si']);
            return stdout.toLowerCase().trim();
        }
        catch {
            try {
                const { stdout } = await (0, execa_1.execa)('cat', ['/etc/os-release']);
                const idMatch = stdout.match(/^ID=(.+)$/m);
                return idMatch ? idMatch[1].replace(/"/g, '') : 'unknown';
            }
            catch {
                return 'unknown';
            }
        }
    }
    async validateBasicConfig(profile) {
        try {
            const { stdout: userName } = await (0, execa_1.execa)('git', ['config', '--global', 'user.name']);
            const { stdout: userEmail } = await (0, execa_1.execa)('git', ['config', '--global', 'user.email']);
            return userName === profile.name && userEmail === profile.email;
        }
        catch {
            return false;
        }
    }
    async validateAdvancedConfig(profile) {
        try {
            // Check if aliases are configured
            const { gitConfig } = profile.preferences;
            for (const alias of Object.keys(gitConfig.aliases)) {
                const { stdout } = await (0, execa_1.execa)('git', ['config', '--global', `alias.${alias}`]);
                if (!stdout)
                    return false;
            }
            return true;
        }
        catch {
            return false;
        }
    }
    async setupSSHKeys(profile, platform) {
        const sshDir = path.join(os.homedir(), '.ssh');
        await fs.ensureDir(sshDir);
        const sshKeyPath = path.join(sshDir, 'id_ed25519');
        // Check if SSH key already exists
        const keyExists = await fs.pathExists(sshKeyPath);
        if (!keyExists) {
            // Generate new SSH key
            try {
                await (0, execa_1.execa)('ssh-keygen', [
                    '-t', 'ed25519',
                    '-C', profile.email,
                    '-f', sshKeyPath,
                    '-N', '' // No passphrase for automation
                ]);
                console.log('SSH key generated successfully');
            }
            catch (error) {
                console.warn(`Warning: Failed to generate SSH key: ${error}`);
                return;
            }
        }
        // Add to SSH agent on macOS
        if (platform.os === 'darwin') {
            try {
                // Use -K flag for older macOS versions, fallback to regular add
                await (0, execa_1.execa)('ssh-add', ['-K', sshKeyPath]).catch(() => (0, execa_1.execa)('ssh-add', [sshKeyPath]));
                // Update SSH config for macOS
                const sshConfigPath = path.join(sshDir, 'config');
                const configContent = await fs.readFile(sshConfigPath, 'utf-8').catch(() => '');
                if (!configContent.includes('Host github.com')) {
                    const githubConfig = `\n\nHost github.com\n  AddKeysToAgent yes\n  UseKeychain yes\n  IdentityFile ${sshKeyPath}\n`;
                    await fs.appendFile(sshConfigPath, githubConfig);
                }
            }
            catch (error) {
                console.warn(`Warning: Failed to add SSH key to agent: ${error}`);
            }
        }
        else {
            // For Linux, just add to agent
            try {
                await (0, execa_1.execa)('ssh-add', [sshKeyPath]);
            }
            catch (error) {
                console.warn(`Warning: Failed to add SSH key to agent: ${error}`);
            }
        }
        // Display public key for manual addition to GitHub/GitLab
        const publicKey = await fs.readFile(`${sshKeyPath}.pub`, 'utf-8');
        console.log('\nSSH Public Key (add this to your GitHub/GitLab account):');
        console.log(publicKey);
        console.log('\nYou can add this key at:');
        console.log('- GitHub: https://github.com/settings/keys');
        console.log('- GitLab: https://gitlab.com/-/profile/keys\n');
    }
    async validateSSHKeys() {
        try {
            const sshKeyPath = path.join(os.homedir(), '.ssh', 'id_ed25519');
            return await fs.pathExists(sshKeyPath);
        }
        catch {
            return false;
        }
    }
    async validateGPGSigning(profile) {
        try {
            const { stdout: signing } = await (0, execa_1.execa)('git', ['config', '--global', 'commit.gpgsign']);
            const { stdout: signingKey } = await (0, execa_1.execa)('git', ['config', '--global', 'user.signingkey']);
            return signing === 'true' && !!signingKey;
        }
        catch {
            return false;
        }
    }
    async setupGlobalGitignore() {
        console.log('Creating global .gitignore...');
        const globalGitignorePath = path.join(os.homedir(), '.gitignore_global');
        const globalGitignoreContent = `# OS generated files
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
        try {
            await fs.writeFile(globalGitignorePath, globalGitignoreContent.trim(), 'utf-8');
            await (0, execa_1.execa)('git', ['config', '--global', 'core.excludesfile', globalGitignorePath]);
            console.log('Global .gitignore created and configured');
        }
        catch (error) {
            console.warn('Failed to create global .gitignore:', error);
        }
    }
}
exports.GitInstaller = GitInstaller;
//# sourceMappingURL=git-installer.js.map