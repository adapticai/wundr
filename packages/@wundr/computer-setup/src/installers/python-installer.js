"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PythonInstaller = void 0;
const tslib_1 = require("tslib");
/**
 * Python Installer - Cross-platform Python development setup
 */
const execa_1 = require("execa");
const os = tslib_1.__importStar(require("os"));
const fs = tslib_1.__importStar(require("fs/promises"));
const path = tslib_1.__importStar(require("path"));
const which_1 = tslib_1.__importDefault(require("which"));
class PythonInstaller {
    name = 'python';
    homeDir = os.homedir();
    isSupported(platform) {
        return ['darwin', 'linux', 'win32'].includes(platform.os);
    }
    async isInstalled() {
        try {
            const { stdout } = await (0, execa_1.execa)('python3', ['--version']);
            const version = stdout.match(/Python (\d+)\.(\d+)/);
            if (version) {
                const major = parseInt(version[1]);
                const minor = parseInt(version[2]);
                return major === 3 && minor >= 8;
            }
            return false;
        }
        catch {
            return false;
        }
    }
    async getVersion() {
        try {
            const { stdout } = await (0, execa_1.execa)('python3', ['--version']);
            return stdout.trim();
        }
        catch {
            return null;
        }
    }
    async install(profile, platform) {
        const pythonConfig = profile.tools?.languages?.python;
        if (!pythonConfig) {
            console.log('Python not configured in profile, installing default setup');
        }
        // Install Python if not present
        if (!await this.isInstalled()) {
            await this.installPython(platform);
        }
        // Setup pip and ensure it's up to date
        await this.setupPip();
        // Install pyenv for version management
        await this.installPyenv(platform);
        // Install virtual environment tools
        await this.setupVirtualEnvironments(pythonConfig);
        // Install common Python packages
        await this.installCommonPackages();
    }
    async configure(profile, platform) {
        // Setup Python path configurations
        await this.setupPythonPaths();
        // Configure pip
        await this.configurePip();
        // Setup shell integration
        await this.setupShellIntegration(platform);
    }
    async validate() {
        try {
            // Check Python 3 installation
            const pythonVersion = await this.getVersion();
            if (!pythonVersion)
                return false;
            // Check pip
            await (0, execa_1.execa)('python3', ['-m', 'pip', '--version']);
            // Check virtual environment capability
            await (0, execa_1.execa)('python3', ['-m', 'venv', '--help']);
            return true;
        }
        catch (error) {
            console.error('Python validation failed:', error);
            return false;
        }
    }
    getSteps(profile, platform) {
        const steps = [
            {
                id: 'install-python',
                name: 'Install Python 3',
                description: 'Install Python 3.x and ensure it is available',
                category: 'development',
                required: true,
                dependencies: [],
                estimatedTime: 120,
                validator: () => this.isInstalled(),
                installer: () => this.installPython(platform)
            },
            {
                id: 'setup-pip',
                name: 'Setup pip',
                description: 'Ensure pip is installed and up to date',
                category: 'development',
                required: true,
                dependencies: ['install-python'],
                estimatedTime: 30,
                validator: () => this.validatePip(),
                installer: () => this.setupPip()
            },
            {
                id: 'install-pyenv',
                name: 'Install pyenv',
                description: 'Install pyenv for Python version management',
                category: 'development',
                required: false,
                dependencies: ['install-python'],
                estimatedTime: 60,
                validator: () => this.validatePyenv(),
                installer: () => this.installPyenv(platform)
            },
            {
                id: 'configure-python',
                name: 'Configure Python Environment',
                description: 'Configure Python paths and environment settings',
                category: 'development',
                required: true,
                dependencies: ['setup-pip'],
                estimatedTime: 30,
                validator: () => this.validate(),
                installer: () => this.configure(profile, platform)
            }
        ];
        return steps;
    }
    async installPython(platform) {
        console.log('Installing Python 3...');
        switch (platform.os) {
            case 'darwin':
                await this.installPythonMac();
                break;
            case 'linux':
                await this.installPythonLinux(platform);
                break;
            case 'win32':
                throw new Error('Python installation on Windows requires manual setup from python.org');
            default:
                throw new Error(`Python installation not supported on ${platform.os}`);
        }
    }
    async installPythonMac() {
        try {
            // Check if Homebrew is available
            await (0, which_1.default)('brew');
            // Install Python via Homebrew
            console.log('Installing Python via Homebrew...');
            await (0, execa_1.execa)('brew', ['install', 'python@3.12']);
            // Create symlinks if needed
            await this.setupPythonSymlinks();
        }
        catch (error) {
            console.error('Python installation failed:', error);
            throw new Error('Python installation requires Homebrew. Please install Homebrew first.');
        }
    }
    async installPythonLinux(platform) {
        const distro = platform.distro || await this.detectLinuxDistro();
        console.log(`Installing Python on ${distro}...`);
        switch (distro) {
            case 'ubuntu':
            case 'debian':
                await this.installPythonDebian();
                break;
            case 'centos':
            case 'rhel':
            case 'fedora':
                await this.installPythonRedHat();
                break;
            default:
                throw new Error(`Python installation not supported on ${distro}`);
        }
    }
    async installPythonDebian() {
        const commands = [
            'apt-get update',
            'apt-get install -y python3 python3-pip python3-venv python3-dev',
            'apt-get install -y build-essential libssl-dev libffi-dev python3-setuptools'
        ];
        for (const cmd of commands) {
            await (0, execa_1.execa)('sudo', ['bash', '-c', cmd]);
        }
    }
    async installPythonRedHat() {
        const commands = [
            'yum install -y python3 python3-pip python3-devel',
            'yum groupinstall -y "Development Tools"',
            'yum install -y openssl-devel libffi-devel'
        ];
        for (const cmd of commands) {
            await (0, execa_1.execa)('sudo', ['bash', '-c', cmd]);
        }
    }
    async setupPip() {
        console.log('Setting up pip...');
        try {
            // Ensure pip is available
            await (0, execa_1.execa)('python3', ['-m', 'ensurepip', '--upgrade']);
            // Upgrade pip to latest version
            await (0, execa_1.execa)('python3', ['-m', 'pip', 'install', '--upgrade', 'pip']);
            console.log('pip setup completed');
        }
        catch (error) {
            console.warn('pip setup had issues:', error);
        }
    }
    async installPyenv(platform) {
        console.log('Installing pyenv...');
        const pyenvDir = path.join(this.homeDir, '.pyenv');
        try {
            // Check if already installed
            await fs.access(pyenvDir);
            console.log('pyenv already installed');
            return;
        }
        catch {
            // Not installed, proceed
        }
        if (platform.os === 'win32') {
            throw new Error('pyenv installation on Windows requires manual setup of pyenv-win');
        }
        try {
            // Install pyenv using the official installer
            const installScript = 'curl https://pyenv.run | bash';
            await (0, execa_1.execa)('bash', ['-c', installScript], { stdio: 'inherit' });
            // Setup environment
            process.env.PYENV_ROOT = pyenvDir;
            process.env.PATH = `${path.join(pyenvDir, 'bin')}:${process.env.PATH}`;
            console.log('pyenv installed successfully');
        }
        catch (error) {
            console.warn('pyenv installation failed:', error);
        }
    }
    async setupVirtualEnvironments(pythonConfig) {
        console.log('Setting up virtual environment tools...');
        const virtualEnvType = pythonConfig?.virtualEnv || 'venv';
        switch (virtualEnvType) {
            case 'venv':
                // Built into Python 3, no additional setup needed
                console.log('Using built-in venv module');
                break;
            case 'pyenv':
                // Already handled by pyenv installation
                console.log('Using pyenv for virtual environments');
                break;
            case 'conda':
                await this.installConda();
                break;
            default:
                console.log('Using default venv module');
        }
    }
    async installConda() {
        console.log('Installing Miniconda...');
        try {
            // Check if conda already exists
            await (0, which_1.default)('conda');
            console.log('conda already installed');
            return;
        }
        catch {
            // Not installed, proceed
        }
        const platform = os.platform();
        const arch = os.arch();
        let condaUrl = '';
        if (platform === 'darwin') {
            condaUrl = arch === 'arm64'
                ? 'https://repo.anaconda.com/miniconda/Miniconda3-latest-MacOSX-arm64.sh'
                : 'https://repo.anaconda.com/miniconda/Miniconda3-latest-MacOSX-x86_64.sh';
        }
        else if (platform === 'linux') {
            condaUrl = arch === 'arm64'
                ? 'https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-aarch64.sh'
                : 'https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh';
        }
        else {
            throw new Error('Conda installation not supported on this platform');
        }
        try {
            const condaScript = `/tmp/miniconda.sh`;
            // Download installer
            await (0, execa_1.execa)('curl', ['-o', condaScript, condaUrl]);
            // Run installer
            await (0, execa_1.execa)('bash', [condaScript, '-b', '-p', path.join(this.homeDir, 'miniconda3')]);
            // Clean up
            await fs.unlink(condaScript);
            console.log('Miniconda installed successfully');
        }
        catch (error) {
            console.warn('Conda installation failed:', error);
        }
    }
    async installCommonPackages() {
        console.log('Installing common Python packages...');
        const commonPackages = [
            'wheel',
            'setuptools',
            'requests',
            'urllib3',
            'certifi',
            'pip-tools',
            'virtualenv',
            'black',
            'flake8',
            'mypy',
            'pytest',
            'ipython',
            'jupyter'
        ];
        for (const pkg of commonPackages) {
            try {
                await (0, execa_1.execa)('python3', ['-m', 'pip', 'install', '--user', pkg]);
                console.log(`Installed ${pkg}`);
            }
            catch (error) {
                console.warn(`Failed to install ${pkg}:`, error);
            }
        }
    }
    async setupPythonPaths() {
        console.log('Setting up Python paths...');
        // Setup user local bin path
        const userBase = await this.getPythonUserBase();
        const userBinPath = path.join(userBase, 'bin');
        // Update PATH in shell profiles
        await this.updateShellWithPythonPaths(userBinPath);
    }
    async configurePip() {
        console.log('Configuring pip...');
        const pipConfigDir = path.join(this.homeDir, '.pip');
        const pipConfigFile = path.join(pipConfigDir, 'pip.conf');
        try {
            // Create pip config directory
            await fs.mkdir(pipConfigDir, { recursive: true });
            // Create pip configuration
            const pipConfig = `[global]
timeout = 60
index-url = https://pypi.org/simple/
trusted-host = pypi.org
               pypi.python.org
               files.pythonhosted.org

[install]
user = true
`;
            await fs.writeFile(pipConfigFile, pipConfig, 'utf-8');
            console.log('pip configured successfully');
        }
        catch (error) {
            console.warn('pip configuration failed:', error);
        }
    }
    async setupShellIntegration(platform) {
        const shellFiles = ['.zshrc', '.bashrc'];
        const pythonConfig = `
# Python Configuration
export PYTHONPATH="$HOME/.local/lib/python3.12/site-packages:$PYTHONPATH"

# pyenv configuration
if [[ -d "$HOME/.pyenv" ]]; then
  export PYENV_ROOT="$HOME/.pyenv"
  export PATH="$PYENV_ROOT/bin:$PATH"
  eval "$(pyenv init -)"
fi

# Conda configuration
if [[ -f "$HOME/miniconda3/bin/conda" ]]; then
  eval "$($HOME/miniconda3/bin/conda shell.bash hook)"
fi

# Python aliases
alias py='python3'
alias pip='python3 -m pip'
alias venv-create='python3 -m venv'
alias venv-activate='source venv/bin/activate'
`;
        for (const shellFile of shellFiles) {
            const shellPath = path.join(this.homeDir, shellFile);
            try {
                let shellContent = '';
                try {
                    shellContent = await fs.readFile(shellPath, 'utf-8');
                }
                catch {
                    // File doesn't exist, will be created
                }
                // Check if Python is already configured
                if (shellContent.includes('Python Configuration')) {
                    continue;
                }
                await fs.writeFile(shellPath, shellContent + pythonConfig, 'utf-8');
                console.log(`Updated ${shellFile} with Python configuration`);
            }
            catch (error) {
                console.warn(`Failed to update ${shellFile}:`, error);
            }
        }
    }
    async getPythonUserBase() {
        try {
            const { stdout } = await (0, execa_1.execa)('python3', ['-m', 'site', '--user-base']);
            return stdout.trim();
        }
        catch {
            // Fallback to common default
            return path.join(this.homeDir, '.local');
        }
    }
    async updateShellWithPythonPaths(userBinPath) {
        const shellFiles = ['.zshrc', '.bashrc'];
        const pathConfig = `
# Python User Bin Path
export PATH="${userBinPath}:$PATH"
`;
        for (const shellFile of shellFiles) {
            const shellPath = path.join(this.homeDir, shellFile);
            try {
                let shellContent = '';
                try {
                    shellContent = await fs.readFile(shellPath, 'utf-8');
                }
                catch {
                    // File doesn't exist, will be created
                }
                // Check if path is already configured
                if (shellContent.includes(userBinPath)) {
                    continue;
                }
                await fs.writeFile(shellPath, shellContent + pathConfig, 'utf-8');
                console.log(`Updated ${shellFile} with Python user bin path`);
            }
            catch (error) {
                console.warn(`Failed to update ${shellFile}:`, error);
            }
        }
    }
    async setupPythonSymlinks() {
        // Create python -> python3 symlink if needed
        try {
            await (0, which_1.default)('python');
            console.log('python command already available');
        }
        catch {
            try {
                const pythonPath = await (0, which_1.default)('python3');
                const binDir = path.dirname(pythonPath);
                const symlinkPath = path.join(binDir, 'python');
                await (0, execa_1.execa)('ln', ['-sf', pythonPath, symlinkPath]);
                console.log('Created python -> python3 symlink');
            }
            catch (error) {
                console.warn('Failed to create python symlink:', error);
            }
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
    async validatePip() {
        try {
            await (0, execa_1.execa)('python3', ['-m', 'pip', '--version']);
            return true;
        }
        catch {
            return false;
        }
    }
    async validatePyenv() {
        try {
            const pyenvDir = path.join(this.homeDir, '.pyenv');
            await fs.access(pyenvDir);
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.PythonInstaller = PythonInstaller;
//# sourceMappingURL=python-installer.js.map