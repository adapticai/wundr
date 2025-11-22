/**
 * Python Installer - Cross-platform Python development setup
 */
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { execa } from 'execa';
import which from 'which';

import { Logger } from '../utils/logger';

import type { SetupPlatform, SetupStep, DeveloperProfile } from '../types';
import type { BaseInstaller } from './index';

const logger = new Logger({ name: 'PythonInstaller' });

export class PythonInstaller implements BaseInstaller {
  name = 'python';
  private readonly homeDir = os.homedir();
  
  isSupported(platform: SetupPlatform): boolean {
    return ['darwin', 'linux', 'win32'].includes(platform.os);
  }

  async isInstalled(): Promise<boolean> {
    try {
      // Try python3 first (most common on modern systems)
      const { stdout } = await execa('python3', ['--version']);
      const version = stdout.match(/Python (\d+)\.(\d+)/);
      if (version) {
        const major = parseInt(version[1]);
        const minor = parseInt(version[2]);
        return major === 3 && minor >= 8;
      }
      return false;
    } catch {
      // Try python as fallback
      try {
        const { stdout } = await execa('python', ['--version']);
        const version = stdout.match(/Python (\d+)\.(\d+)/);
        if (version) {
          const major = parseInt(version[1]);
          return major === 3; // Accept any Python 3.x
        }
        return false;
      } catch {
        return false;
      }
    }
  }

  async getVersion(): Promise<string | null> {
    try {
      const { stdout } = await execa('python3', ['--version']);
      return stdout.trim();
    } catch {
      return null;
    }
  }

  async install(profile: DeveloperProfile, platform: SetupPlatform): Promise<void> {
    const pythonConfig = profile.tools?.languages?.python;
    if (!pythonConfig) {
      logger.info('Python not configured in profile, checking existing setup');
    }

    // Check if Python is already installed
    const alreadyInstalled = await this.isInstalled();
    if (alreadyInstalled) {
      logger.info('Python is already installed');
      const version = await this.getVersion();
      logger.info(`Version: ${version}`);
    } else {
      // Install Python if not present
      await this.installPython(platform);
    }

    // Setup pip and ensure it's up to date (only if not skipping)
    try {
      await this.setupPip();
    } catch (error: unknown) {
      logger.warn('pip setup had issues, but continuing:', error);
    }
    
    // Optional: Install pyenv for version management
    if (pythonConfig?.versions && pythonConfig.versions.length > 1) {
      try {
        await this.installPyenv(platform);
      } catch (error: unknown) {
        logger.warn('pyenv installation skipped:', error);
      }
    }

    // Optional: Install virtual environment tools
    if (pythonConfig?.virtualEnv) {
      try {
        await this.setupVirtualEnvironments(pythonConfig);
      } catch (error: unknown) {
        logger.warn('Virtual environment setup skipped:', error);
      }
    }

    // Optional: Install common Python packages
    if (!alreadyInstalled) {
      try {
        await this.installCommonPackages();
      } catch (error: unknown) {
        logger.warn('Common package installation had issues:', error);
      }
    }
  }

  async configure(profile: DeveloperProfile, platform: SetupPlatform): Promise<void> {
    // Setup Python path configurations
    await this.setupPythonPaths();
    
    // Configure pip
    await this.configurePip();
    
    // Setup shell integration
    await this.setupShellIntegration(platform);
  }

  async validate(): Promise<boolean> {
    try {
      // Check Python 3 installation
      const pythonVersion = await this.getVersion();
      if (!pythonVersion) {
        logger.info('Python version check failed');
        return false;
      }
      logger.info(`Python found: ${pythonVersion}`);

      // Check pip (more lenient)
      try {
        await execa('python3', ['-m', 'pip', '--version']);
        logger.info('pip is available');
      } catch {
        logger.warn('pip not available via python3 -m pip, but Python is installed');
      }
      
      // Don't fail on venv check - it's optional
      try {
        await execa('python3', ['-m', 'venv', '--help'], { stdio: 'ignore' });
        logger.info('venv module available');
      } catch {
        logger.warn('venv module not available, but Python is installed');
      }

      // If we got here, Python is at least installed
      return true;
    } catch (error: unknown) {
      logger.error('Python validation failed:', error);
      return false;
    }
  }

  getSteps(profile: DeveloperProfile, platform: SetupPlatform): SetupStep[] {
    const steps: SetupStep[] = [
      {
        id: 'install-python',
        name: 'Install Python 3',
        description: 'Install Python 3.x and ensure it is available',
        category: 'development',
        required: true,
        dependencies: [],
        estimatedTime: 120,
        validator: () => this.isInstalled(),
        installer: () => this.installPython(platform),
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
        installer: () => this.setupPip(),
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
        installer: () => this.installPyenv(platform),
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
        installer: () => this.configure(profile, platform),
      },
    ];

    return steps;
  }

  private async installPython(platform: SetupPlatform): Promise<void> {
    logger.info('Installing Python 3...');

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

  private async installPythonMac(): Promise<void> {
    try {
      // Check if Homebrew is available
      await which('brew');
      
      // Check if Python is already installed via brew
      try {
        await execa('brew', ['list', 'python@3.12']);
        logger.info('Python 3.12 is already installed via Homebrew');
        return;
      } catch {
        // Not installed, proceed
      }
      
      // Install Python via Homebrew
      logger.info('Installing Python via Homebrew...');
      await execa('brew', ['install', 'python@3.12']);
      
      // Create symlinks if needed
      await this.setupPythonSymlinks();
      
    } catch (error: unknown) {
      logger.error('Python installation failed:', error);
      // Check if Python is available through other means
      if (await this.isInstalled()) {
        logger.info('Python is available through other means, continuing...');
      } else {
        throw new Error('Python installation requires Homebrew. Please install Homebrew first.');
      }
    }
  }

  private async installPythonLinux(platform: SetupPlatform): Promise<void> {
    const distro = platform.distro || await this.detectLinuxDistro();

    logger.info(`Installing Python on ${distro}...`);
    
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

  private async installPythonDebian(): Promise<void> {
    const commands = [
      'apt-get update',
      'apt-get install -y python3 python3-pip python3-venv python3-dev',
      'apt-get install -y build-essential libssl-dev libffi-dev python3-setuptools',
    ];

    for (const cmd of commands) {
      await execa('sudo', ['bash', '-c', cmd]);
    }
  }

  private async installPythonRedHat(): Promise<void> {
    const commands = [
      'yum install -y python3 python3-pip python3-devel',
      'yum groupinstall -y "Development Tools"',
      'yum install -y openssl-devel libffi-devel',
    ];

    for (const cmd of commands) {
      await execa('sudo', ['bash', '-c', cmd]);
    }
  }

  private async setupPip(): Promise<void> {
    logger.info('Setting up pip...');

    try {
      // First check if pip is already available
      try {
        await execa('python3', ['-m', 'pip', '--version']);
        logger.info('pip is already available');

        // Just try to upgrade it
        try {
          await execa('python3', ['-m', 'pip', 'install', '--upgrade', 'pip']);
          logger.info('pip upgraded to latest version');
        } catch {
          logger.info('Could not upgrade pip, but it is available');
        }
        return;
      } catch {
        // pip not available, try to install
      }

      // Ensure pip is available
      await execa('python3', ['-m', 'ensurepip', '--upgrade']);

      // Upgrade pip to latest version
      await execa('python3', ['-m', 'pip', 'install', '--upgrade', 'pip']);

      logger.info('pip setup completed');
    } catch (error: unknown) {
      logger.warn('pip setup had issues (this is often okay if pip is already installed):', error);
    }
  }

  private async installPyenv(platform: SetupPlatform): Promise<void> {
    logger.info('Installing pyenv...');

    const pyenvDir = path.join(this.homeDir, '.pyenv');

    try {
      // Check if already installed
      await fs.access(pyenvDir);
      logger.info('pyenv already installed');
      return;
    } catch {
      // Not installed, proceed
    }

    if (platform.os === 'win32') {
      throw new Error('pyenv installation on Windows requires manual setup of pyenv-win');
    }

    try {
      // Install pyenv using the official installer
      const installScript = 'curl https://pyenv.run | bash';
      await execa('bash', ['-c', installScript], { stdio: 'inherit' });

      // Setup environment
      process.env.PYENV_ROOT = pyenvDir;
      process.env.PATH = `${path.join(pyenvDir, 'bin')}:${process.env.PATH}`;

      logger.info('pyenv installed successfully');
    } catch (error: unknown) {
      logger.warn('pyenv installation failed:', error);
    }
  }

  private async setupVirtualEnvironments(pythonConfig?: { virtualEnv?: string }): Promise<void> {
    logger.info('Setting up virtual environment tools...');

    const virtualEnvType = pythonConfig?.virtualEnv || 'venv';

    switch (virtualEnvType) {
      case 'venv':
        // Built into Python 3, no additional setup needed
        logger.info('Using built-in venv module');
        break;

      case 'pyenv':
        // Already handled by pyenv installation
        logger.info('Using pyenv for virtual environments');
        break;

      case 'conda':
        await this.installConda();
        break;

      default:
        logger.info('Using default venv module');
    }
  }

  private async installConda(): Promise<void> {
    logger.info('Installing Miniconda...');

    try {
      // Check if conda already exists
      await which('conda');
      logger.info('conda already installed');
      return;
    } catch {
      // Not installed, proceed
    }

    const currentPlatform = os.platform();
    const arch = os.arch();

    let condaUrl = '';

    if (currentPlatform === 'darwin') {
      condaUrl = arch === 'arm64'
        ? 'https://repo.anaconda.com/miniconda/Miniconda3-latest-MacOSX-arm64.sh'
        : 'https://repo.anaconda.com/miniconda/Miniconda3-latest-MacOSX-x86_64.sh';
    } else if (currentPlatform === 'linux') {
      condaUrl = arch === 'arm64'
        ? 'https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-aarch64.sh'
        : 'https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh';
    } else {
      throw new Error('Conda installation not supported on this platform');
    }

    try {
      const condaScript = '/tmp/miniconda.sh';

      // Download installer
      await execa('curl', ['-o', condaScript, condaUrl]);

      // Run installer
      await execa('bash', [condaScript, '-b', '-p', path.join(this.homeDir, 'miniconda3')]);

      // Clean up
      await fs.unlink(condaScript);

      logger.info('Miniconda installed successfully');
    } catch (error: unknown) {
      logger.warn('Conda installation failed:', error);
    }
  }

  private async installCommonPackages(): Promise<void> {
    logger.info('Installing common Python packages...');

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
      'jupyter',
    ];

    for (const pkg of commonPackages) {
      try {
        await execa('python3', ['-m', 'pip', 'install', '--user', pkg]);
        logger.info(`Installed ${pkg}`);
      } catch (error: unknown) {
        logger.warn(`Failed to install ${pkg}:`, error);
      }
    }
  }

  private async setupPythonPaths(): Promise<void> {
    logger.info('Setting up Python paths...');

    // Setup user local bin path
    const userBase = await this.getPythonUserBase();
    const userBinPath = path.join(userBase, 'bin');

    // Update PATH in shell profiles
    await this.updateShellWithPythonPaths(userBinPath);
  }

  private async configurePip(): Promise<void> {
    logger.info('Configuring pip...');

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
      logger.info('pip configured successfully');
    } catch (error: unknown) {
      logger.warn('pip configuration failed:', error);
    }
  }

  private async setupShellIntegration(_platform: SetupPlatform): Promise<void> {
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
        } catch {
          // File doesn't exist, will be created
        }

        // Check if Python is already configured
        if (shellContent.includes('Python Configuration')) {
          continue;
        }

        await fs.writeFile(shellPath, shellContent + pythonConfig, 'utf-8');
        logger.info(`Updated ${shellFile} with Python configuration`);
      } catch (error: unknown) {
        logger.warn(`Failed to update ${shellFile}:`, error);
      }
    }
  }

  private async getPythonUserBase(): Promise<string> {
    try {
      const { stdout } = await execa('python3', ['-m', 'site', '--user-base']);
      return stdout.trim();
    } catch {
      // Fallback to common default
      return path.join(this.homeDir, '.local');
    }
  }

  private async updateShellWithPythonPaths(userBinPath: string): Promise<void> {
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
        } catch {
          // File doesn't exist, will be created
        }

        // Check if path is already configured
        if (shellContent.includes(userBinPath)) {
          continue;
        }

        await fs.writeFile(shellPath, shellContent + pathConfig, 'utf-8');
        logger.info(`Updated ${shellFile} with Python user bin path`);
      } catch (error: unknown) {
        logger.warn(`Failed to update ${shellFile}:`, error);
      }
    }
  }

  private async setupPythonSymlinks(): Promise<void> {
    // Create python -> python3 symlink if needed
    try {
      await which('python');
      logger.info('python command already available');
    } catch {
      try {
        const pythonPath = await which('python3');
        const binDir = path.dirname(pythonPath);
        const symlinkPath = path.join(binDir, 'python');

        await execa('ln', ['-sf', pythonPath, symlinkPath]);
        logger.info('Created python -> python3 symlink');
      } catch (error: unknown) {
        logger.warn('Failed to create python symlink:', error);
      }
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

  private async validatePip(): Promise<boolean> {
    try {
      await execa('python3', ['-m', 'pip', '--version']);
      return true;
    } catch {
      return false;
    }
  }

  private async validatePyenv(): Promise<boolean> {
    try {
      const pyenvDir = path.join(this.homeDir, '.pyenv');
      await fs.access(pyenvDir);
      return true;
    } catch {
      return false;
    }
  }
}