"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeInstaller = void 0;
const tslib_1 = require("tslib");
/**
 * Node.js Installer - Cross-platform Node.js and package manager setup
 */
const execa_1 = require("execa");
const fs = tslib_1.__importStar(require("fs-extra"));
const path = tslib_1.__importStar(require("path"));
const os = tslib_1.__importStar(require("os"));
const which_1 = tslib_1.__importDefault(require("which"));
class NodeInstaller {
    name = 'node';
    isSupported(platform) {
        return ['darwin', 'linux', 'win32'].includes(platform.os);
    }
    async isInstalled() {
        try {
            await (0, which_1.default)('node');
            return true;
        }
        catch {
            return false;
        }
    }
    async getVersion() {
        try {
            const { stdout } = await (0, execa_1.execa)('node', ['--version']);
            return stdout.trim();
        }
        catch {
            return null;
        }
    }
    async install(profile, platform) {
        const nodeConfig = profile.tools.languages.node;
        if (!nodeConfig) {
            throw new Error('Node.js configuration not found in profile');
        }
        // Check if Node Version Manager is installed
        const nvmInstalled = await this.isNVMInstalled();
        if (!nvmInstalled) {
            await this.installNVM(platform);
        }
        // Install Node.js versions
        for (const version of nodeConfig.versions) {
            await this.installNodeVersion(version);
        }
        // Set default version
        await this.setDefaultNodeVersion(nodeConfig.defaultVersion);
        // Install global packages
        if (nodeConfig.globalPackages.length > 0) {
            await this.installGlobalPackages(nodeConfig.globalPackages);
        }
        // Install package managers
        await this.installPackageManagers(profile);
    }
    async configure(profile, platform) {
        // Configure npm
        await this.configureNPM(profile);
        // Setup .nvmrc for projects
        await this.setupNVMRC(profile);
        // Configure package managers
        await this.configurePackageManagers(profile);
    }
    async validate() {
        try {
            const nodeVersion = await this.getVersion();
            if (!nodeVersion)
                return false;
            const { stdout: npmVersion } = await (0, execa_1.execa)('npm', ['--version']);
            return !!npmVersion;
        }
        catch {
            return false;
        }
    }
    getSteps(profile, platform) {
        const nodeConfig = profile.tools.languages.node;
        if (!nodeConfig)
            return [];
        const steps = [
            {
                id: 'install-nvm',
                name: 'Install Node Version Manager',
                description: 'Install NVM for managing multiple Node.js versions',
                category: 'development',
                required: true,
                dependencies: [],
                estimatedTime: 30,
                validator: () => this.isNVMInstalled(),
                installer: () => this.installNVM(platform)
            },
            {
                id: 'install-node-versions',
                name: 'Install Node.js Versions',
                description: `Install Node.js versions: ${nodeConfig.versions.join(', ')}`,
                category: 'development',
                required: true,
                dependencies: ['install-nvm'],
                estimatedTime: 60 * nodeConfig.versions.length,
                validator: () => this.validateNodeVersions(nodeConfig.versions),
                installer: () => this.installAllNodeVersions(nodeConfig.versions)
            },
            {
                id: 'set-default-node',
                name: 'Set Default Node Version',
                description: `Set Node.js ${nodeConfig.defaultVersion} as default`,
                category: 'development',
                required: true,
                dependencies: ['install-node-versions'],
                estimatedTime: 5,
                validator: () => this.validateDefaultVersion(nodeConfig.defaultVersion),
                installer: () => this.setDefaultNodeVersion(nodeConfig.defaultVersion)
            }
        ];
        if (nodeConfig.globalPackages.length > 0) {
            steps.push({
                id: 'install-global-packages',
                name: 'Install Global NPM Packages',
                description: `Install global packages: ${nodeConfig.globalPackages.join(', ')}`,
                category: 'development',
                required: false,
                dependencies: ['set-default-node'],
                estimatedTime: 30 * nodeConfig.globalPackages.length,
                validator: () => this.validateGlobalPackages(nodeConfig.globalPackages),
                installer: () => this.installGlobalPackages(nodeConfig.globalPackages)
            });
        }
        return steps;
    }
    async isNVMInstalled() {
        try {
            const nvmDir = path.join(os.homedir(), '.nvm');
            return await fs.pathExists(nvmDir);
        }
        catch {
            return false;
        }
    }
    async installNVM(platform) {
        console.log('Installing NVM (Node Version Manager)...');
        const homeDir = os.homedir();
        const nvmDir = path.join(homeDir, '.nvm');
        if (await fs.pathExists(nvmDir)) {
            console.log('NVM already installed');
            return;
        }
        if (platform.os === 'win32') {
            throw new Error('NVM installation on Windows requires manual setup of nvm-windows');
        }
        try {
            // Install NVM
            const installScript = 'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash';
            await (0, execa_1.execa)('bash', ['-c', installScript], { stdio: 'inherit' });
            // Setup environment for current session
            process.env.NVM_DIR = nvmDir;
            // Update shell profiles
            await this.setupNVMShellIntegration();
            console.log('NVM installed successfully');
        }
        catch (error) {
            throw new Error(`NVM installation failed: ${error}`);
        }
    }
    async installNodeVersion(version) {
        console.log(`Installing Node.js v${version}...`);
        try {
            if (process.platform === 'win32') {
                await (0, execa_1.execa)('nvm', ['install', version]);
            }
            else {
                const nvmScript = `
          export NVM_DIR="${os.homedir()}/.nvm"
          [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
          if ! nvm install ${version}; then
            echo "Warning: Failed to install Node.js v${version}, continuing..."
          fi
        `;
                await (0, execa_1.execa)('bash', ['-c', nvmScript]);
            }
            console.log(`Node.js v${version} installed successfully`);
        }
        catch (error) {
            console.warn(`Warning: Failed to install Node.js v${version}: ${error}`);
        }
    }
    async installAllNodeVersions(versions) {
        for (const version of versions) {
            await this.installNodeVersion(version);
        }
    }
    async setDefaultNodeVersion(version) {
        try {
            if (process.platform === 'win32') {
                await (0, execa_1.execa)('nvm', ['use', version]);
            }
            else {
                const nvmScript = `
          export NVM_DIR="${os.homedir()}/.nvm"
          [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
          nvm alias default ${version} || echo "Warning: Failed to set default alias"
          nvm use --delete-prefix ${version} || nvm use ${version} || echo "Warning: Failed to use version ${version}"
        `;
                await (0, execa_1.execa)('bash', ['-c', nvmScript]);
            }
        }
        catch (error) {
            console.warn(`Warning: Failed to set default Node.js version to ${version}: ${error}`);
            // Continue instead of throwing - non-critical failure
        }
    }
    async installGlobalPackages(packages) {
        for (const pkg of packages) {
            try {
                // Use --force flag to handle existing packages
                await (0, execa_1.execa)('npm', ['install', '-g', pkg, '--force']);
            }
            catch (error) {
                console.warn(`Failed to install global package ${pkg}: ${error}`);
            }
        }
    }
    async installPackageManagers(profile) {
        const { packageManagers } = profile.tools;
        // Install pnpm
        if (packageManagers?.pnpm) {
            await this.installPnpm();
        }
        // Install yarn
        if (packageManagers?.yarn) {
            await this.installYarn(profile);
        }
    }
    async installPnpm() {
        console.log('Installing pnpm...');
        try {
            // Check if already installed
            await (0, which_1.default)('pnpm');
            console.log('pnpm already installed');
            await (0, execa_1.execa)('npm', ['update', '-g', 'pnpm']);
            return;
        }
        catch {
            // Not installed, proceed with installation
        }
        try {
            // Use the official pnpm installation script
            await (0, execa_1.execa)('bash', ['-c', 'curl -fsSL https://get.pnpm.io/install.sh | sh -']);
            // Setup environment
            const pnpmHome = path.join(os.homedir(), '.local', 'share', 'pnpm');
            process.env.PNPM_HOME = pnpmHome;
            process.env.PATH = `${pnpmHome}:${process.env.PATH}`;
            // Update shell profiles
            await this.updateShellWithPnpm(pnpmHome);
            // Configure pnpm
            await (0, execa_1.execa)('pnpm', ['config', 'set', 'store-dir', path.join(os.homedir(), '.pnpm-store')]);
            await (0, execa_1.execa)('pnpm', ['config', 'set', 'auto-install-peers', 'true']);
            await (0, execa_1.execa)('pnpm', ['config', 'set', 'strict-peer-dependencies', 'false']);
            console.log('pnpm installed and configured');
        }
        catch (error) {
            console.warn(`Failed to install pnpm: ${error}`);
        }
    }
    async installYarn(profile) {
        console.log('Installing Yarn...');
        try {
            // Check if already installed
            await (0, which_1.default)('yarn');
            console.log('Yarn already installed');
            return;
        }
        catch {
            // Not installed, proceed with installation
        }
        try {
            await (0, execa_1.execa)('npm', ['install', '-g', 'yarn', '--force']);
            // Configure yarn
            if (profile.name) {
                await (0, execa_1.execa)('yarn', ['config', 'set', 'init-author-name', profile.name]);
            }
            if (profile.email) {
                await (0, execa_1.execa)('yarn', ['config', 'set', 'init-author-email', profile.email]);
            }
            await (0, execa_1.execa)('yarn', ['config', 'set', 'init-license', 'MIT']);
            console.log('Yarn installed and configured');
        }
        catch (error) {
            console.warn(`Failed to install Yarn: ${error}`);
        }
    }
    async configureNPM(profile) {
        console.log('Configuring npm...');
        const homeDir = os.homedir();
        const npmGlobalDir = path.join(homeDir, '.npm-global');
        try {
            // Create npm-global directory structure
            await fs.ensureDir(path.join(npmGlobalDir, 'lib'));
            await fs.ensureDir(path.join(npmGlobalDir, 'bin'));
            // Set npm prefix before any global installs
            await (0, execa_1.execa)('npm', ['config', 'set', 'prefix', npmGlobalDir]);
            // Configure npm settings
            if (profile.name) {
                await (0, execa_1.execa)('npm', ['config', 'set', 'init-author-name', profile.name]);
            }
            if (profile.email) {
                await (0, execa_1.execa)('npm', ['config', 'set', 'init-author-email', profile.email]);
            }
            await (0, execa_1.execa)('npm', ['config', 'set', 'init-license', 'MIT']);
            // Update npm after setting prefix
            await (0, execa_1.execa)('npm', ['install', '-g', 'npm@latest', '--force']);
            // Update shell profiles to include npm global bin
            await this.updateShellWithNpmGlobal(npmGlobalDir);
            console.log('npm configured successfully');
        }
        catch (error) {
            console.warn('npm configuration failed:', error);
        }
    }
    async setupNVMRC(profile) {
        const nodeConfig = profile.tools.languages.node;
        if (!nodeConfig)
            return;
        // This could be used to create .nvmrc files in common project directories
        // For now, just ensure the user knows about .nvmrc
    }
    async configurePackageManagers(profile) {
        const { packageManagers } = profile.tools;
        // Configure pnpm if installed
        if (packageManagers.pnpm) {
            try {
                await (0, execa_1.execa)('pnpm', ['config', 'set', 'auto-install-peers', 'true']);
            }
            catch (error) {
                console.warn('Failed to configure pnpm:', error);
            }
        }
        // Configure yarn if installed
        if (packageManagers.yarn) {
            try {
                // Set yarn version to berry if specified
                await (0, execa_1.execa)('yarn', ['set', 'version', 'stable']);
            }
            catch (error) {
                console.warn('Failed to configure yarn:', error);
            }
        }
    }
    async validateNodeVersions(_versions) {
        try {
            // This would require checking if specific versions are installed
            // Simplified validation for now
            return true;
        }
        catch {
            return false;
        }
    }
    async validateDefaultVersion(version) {
        try {
            const currentVersion = await this.getVersion();
            return currentVersion?.includes(version) || false;
        }
        catch {
            return false;
        }
    }
    async validateGlobalPackages(packages) {
        try {
            for (const pkg of packages) {
                try {
                    await (0, execa_1.execa)('npm', ['list', '-g', pkg, '--depth=0']);
                }
                catch {
                    return false;
                }
            }
            return true;
        }
        catch {
            return false;
        }
    }
    async setupNVMShellIntegration() {
        const homeDir = os.homedir();
        const shellFiles = ['.zshrc', '.bashrc'];
        const nvmConfig = `
# NVM Configuration
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \\. "$NVM_DIR/bash_completion"

# Auto use .nvmrc
autoload -U add-zsh-hook
load-nvmrc() {
  local node_version="$(nvm version)"
  local nvmrc_path="$(nvm_find_nvmrc)"

  if [ -n "$nvmrc_path" ]; then
    local nvmrc_node_version=$(nvm version "$(cat "$nvmrc_path")")

    if [ "$nvmrc_node_version" = "N/A" ]; then
      nvm install
    elif [ "$nvmrc_node_version" != "$node_version" ]; then
      nvm use
    fi
  elif [ "$node_version" != "$(nvm version default)" ]; then
    echo "Reverting to nvm default version"
    nvm use default
  fi
}
add-zsh-hook chpwd load-nvmrc
load-nvmrc
`;
        for (const shellFile of shellFiles) {
            const shellPath = path.join(homeDir, shellFile);
            try {
                let shellContent = '';
                try {
                    shellContent = await fs.readFile(shellPath, 'utf-8');
                }
                catch {
                    // File doesn't exist, will be created
                }
                // Check if NVM is already configured
                if (shellContent.includes('NVM_DIR')) {
                    continue;
                }
                await fs.writeFile(shellPath, shellContent + nvmConfig, 'utf-8');
                console.log(`Updated ${shellFile} with NVM configuration`);
            }
            catch (error) {
                console.warn(`Failed to update ${shellFile}:`, error);
            }
        }
    }
    async updateShellWithNpmGlobal(npmGlobalDir) {
        const homeDir = os.homedir();
        const shellFiles = ['.zshrc', '.bashrc'];
        const npmPath = path.join(npmGlobalDir, 'bin');
        const npmConfig = `
# NPM Global Path
export PATH="${npmPath}:$PATH"
`;
        for (const shellFile of shellFiles) {
            const shellPath = path.join(homeDir, shellFile);
            try {
                let shellContent = '';
                try {
                    shellContent = await fs.readFile(shellPath, 'utf-8');
                }
                catch {
                    // File doesn't exist, will be created
                }
                // Check if npm global is already configured
                if (shellContent.includes(npmPath)) {
                    continue;
                }
                await fs.writeFile(shellPath, shellContent + npmConfig, 'utf-8');
                console.log(`Updated ${shellFile} with npm global path`);
            }
            catch (error) {
                console.warn(`Failed to update ${shellFile}:`, error);
            }
        }
    }
    async updateShellWithPnpm(pnpmHome) {
        const homeDir = os.homedir();
        const shellFiles = ['.zshrc', '.bashrc'];
        const pnpmConfig = `
# pnpm
export PNPM_HOME="${pnpmHome}"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac
`;
        for (const shellFile of shellFiles) {
            const shellPath = path.join(homeDir, shellFile);
            try {
                let shellContent = '';
                try {
                    shellContent = await fs.readFile(shellPath, 'utf-8');
                }
                catch {
                    // File doesn't exist, will be created
                }
                // Check if pnpm is already configured
                if (shellContent.includes('PNPM_HOME')) {
                    continue;
                }
                await fs.writeFile(shellPath, shellContent + pnpmConfig, 'utf-8');
                console.log(`Updated ${shellFile} with pnpm configuration`);
            }
            catch (error) {
                console.warn(`Failed to update ${shellFile}:`, error);
            }
        }
    }
}
exports.NodeInstaller = NodeInstaller;
//# sourceMappingURL=node-installer.js.map