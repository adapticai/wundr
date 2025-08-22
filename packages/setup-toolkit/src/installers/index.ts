/**
 * @fileoverview Installation tools
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as fs from 'fs-extra';
import * as path from 'path';
import { execa } from 'execa';

const execAsync = promisify(exec);

export interface InstallerOptions {
  version?: string;
  force?: boolean;
  silent?: boolean;
  installPath?: string;
}

export interface InstallationResult {
  success: boolean;
  version?: string;
  path?: string;
  message: string;
  error?: Error;
}

export interface Installer {
  name: string;
  isInstalled(): Promise<boolean>;
  getVersion(): Promise<string | null>;
  install(options?: InstallerOptions): Promise<InstallationResult>;
  uninstall(options?: InstallerOptions): Promise<InstallationResult>;
  update(options?: InstallerOptions): Promise<InstallationResult>;
}

export abstract class BaseInstaller implements Installer {
  constructor(public readonly name: string) {}

  abstract isInstalled(): Promise<boolean>;
  abstract getVersion(): Promise<string | null>;
  abstract install(options?: InstallerOptions): Promise<InstallationResult>;
  abstract uninstall(options?: InstallerOptions): Promise<InstallationResult>;
  abstract update(options?: InstallerOptions): Promise<InstallationResult>;

  protected async executeCommand(command: string, args: string[] = [], options: { silent?: boolean } = {}): Promise<{ stdout: string; stderr: string }> {
    try {
      const result = await execa(command, args, {
        stdio: options.silent ? 'pipe' : 'inherit',
      });
      return { stdout: result.stdout, stderr: result.stderr };
    } catch (error: any) {
      throw new Error(`Command failed: ${command} ${args.join(' ')} - ${error.message}`);
    }
  }

  protected getPlatform(): 'darwin' | 'linux' | 'win32' {
    const platform = os.platform();
    if (platform === 'darwin' || platform === 'linux' || platform === 'win32') {
      return platform;
    }
    throw new Error(`Unsupported platform: ${platform}`);
  }

  protected async checkCommandExists(command: string): Promise<boolean> {
    try {
      await execAsync(this.getPlatform() === 'win32' ? `where ${command}` : `which ${command}`);
      return true;
    } catch {
      return false;
    }
  }
}

export class NodeInstaller extends BaseInstaller {
  constructor() {
    super('Node.js');
  }

  async isInstalled(): Promise<boolean> {
    return this.checkCommandExists('node');
  }

  async getVersion(): Promise<string | null> {
    try {
      const { stdout } = await execAsync('node --version');
      return stdout.trim();
    } catch {
      return null;
    }
  }

  async install(options: InstallerOptions = {}): Promise<InstallationResult> {
    try {
      const platform = this.getPlatform();

      if (await this.isInstalled() && !options.force) {
        const currentVersion = await this.getVersion();
        return {
          success: true,
          version: currentVersion || undefined,
          message: `Node.js is already installed (${currentVersion})`,
        };
      }

      switch (platform) {
        case 'darwin':
          if (await this.checkCommandExists('brew')) {
            await this.executeCommand('brew', ['install', 'node'], { silent: options.silent || false });
          } else {
            throw new Error('Homebrew is required for Node.js installation on macOS');
          }
          break;
        case 'linux':
          await this.executeCommand('curl', ['-fsSL', 'https://deb.nodesource.com/setup_lts.x'], { silent: options.silent || false });
          await this.executeCommand('sudo', ['apt-get', 'install', '-y', 'nodejs'], { silent: options.silent || false });
          break;
        case 'win32':
          if (await this.checkCommandExists('winget')) {
            await this.executeCommand('winget', ['install', 'OpenJS.NodeJS'], { silent: options.silent || false });
          } else if (await this.checkCommandExists('choco')) {
            await this.executeCommand('choco', ['install', 'nodejs'], { silent: options.silent || false });
          } else {
            throw new Error('Please install Node.js manually from https://nodejs.org/');
          }
          break;
      }

      const installedVersion = await this.getVersion();
      return {
        success: true,
        version: installedVersion || undefined,
        message: `Node.js ${installedVersion} installed successfully`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to install Node.js: ${error.message}`,
        error,
      };
    }
  }

  async uninstall(options: InstallerOptions = {}): Promise<InstallationResult> {
    try {
      const platform = this.getPlatform();

      switch (platform) {
        case 'darwin':
          if (await this.checkCommandExists('brew')) {
            await this.executeCommand('brew', ['uninstall', 'node'], { silent: options.silent || false });
          }
          break;
        case 'linux':
          await this.executeCommand('sudo', ['apt-get', 'remove', '-y', 'nodejs'], { silent: options.silent || false });
          break;
        case 'win32':
          if (await this.checkCommandExists('winget')) {
            await this.executeCommand('winget', ['uninstall', 'OpenJS.NodeJS'], { silent: options.silent || false });
          } else if (await this.checkCommandExists('choco')) {
            await this.executeCommand('choco', ['uninstall', 'nodejs'], { silent: options.silent || false });
          }
          break;
      }

      return {
        success: true,
        message: 'Node.js uninstalled successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to uninstall Node.js: ${error.message}`,
        error,
      };
    }
  }

  async update(options: InstallerOptions = {}): Promise<InstallationResult> {
    return this.install({ ...options, force: true });
  }
}

export class PythonInstaller extends BaseInstaller {
  constructor() {
    super('Python');
  }

  async isInstalled(): Promise<boolean> {
    return (await this.checkCommandExists('python3')) || (await this.checkCommandExists('python'));
  }

  async getVersion(): Promise<string | null> {
    try {
      let command = 'python3';
      if (!(await this.checkCommandExists('python3'))) {
        command = 'python';
      }
      const { stdout } = await execAsync(`${command} --version`);
      return stdout.trim();
    } catch {
      return null;
    }
  }

  async install(options: InstallerOptions = {}): Promise<InstallationResult> {
    try {
      const platform = this.getPlatform();
      const version = options.version || '3.11';

      if (await this.isInstalled() && !options.force) {
        const currentVersion = await this.getVersion();
        return {
          success: true,
          version: currentVersion || undefined,
          message: `Python is already installed (${currentVersion})`,
        };
      }

      switch (platform) {
        case 'darwin':
          if (await this.checkCommandExists('brew')) {
            await this.executeCommand('brew', ['install', `python@${version}`], { silent: options.silent || false });
          } else {
            throw new Error('Homebrew is required for Python installation on macOS');
          }
          break;
        case 'linux':
          await this.executeCommand('sudo', ['apt-get', 'update'], { silent: options.silent || false });
          await this.executeCommand('sudo', ['apt-get', 'install', '-y', 'python3', 'python3-pip'], { silent: options.silent || false });
          break;
        case 'win32':
          if (await this.checkCommandExists('winget')) {
            await this.executeCommand('winget', ['install', 'Python.Python.3'], { silent: options.silent || false });
          } else if (await this.checkCommandExists('choco')) {
            await this.executeCommand('choco', ['install', 'python'], { silent: options.silent || false });
          } else {
            throw new Error('Please install Python manually from https://python.org/');
          }
          break;
      }

      const installedVersion = await this.getVersion();
      return {
        success: true,
        version: installedVersion || undefined,
        message: `Python ${installedVersion} installed successfully`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to install Python: ${error.message}`,
        error,
      };
    }
  }

  async uninstall(options: InstallerOptions = {}): Promise<InstallationResult> {
    try {
      const platform = this.getPlatform();

      switch (platform) {
        case 'darwin':
          if (await this.checkCommandExists('brew')) {
            await this.executeCommand('brew', ['uninstall', 'python'], { silent: options.silent || false });
          }
          break;
        case 'linux':
          await this.executeCommand('sudo', ['apt-get', 'remove', '-y', 'python3'], { silent: options.silent || false });
          break;
        case 'win32':
          if (await this.checkCommandExists('winget')) {
            await this.executeCommand('winget', ['uninstall', 'Python.Python.3'], { silent: options.silent || false });
          } else if (await this.checkCommandExists('choco')) {
            await this.executeCommand('choco', ['uninstall', 'python'], { silent: options.silent || false });
          }
          break;
      }

      return {
        success: true,
        message: 'Python uninstalled successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to uninstall Python: ${error.message}`,
        error,
      };
    }
  }

  async update(options: InstallerOptions = {}): Promise<InstallationResult> {
    return this.install({ ...options, force: true });
  }
}

export class DockerInstaller extends BaseInstaller {
  constructor() {
    super('Docker');
  }

  async isInstalled(): Promise<boolean> {
    return this.checkCommandExists('docker');
  }

  async getVersion(): Promise<string | null> {
    try {
      const { stdout } = await execAsync('docker --version');
      return stdout.trim();
    } catch {
      return null;
    }
  }

  async install(options: InstallerOptions = {}): Promise<InstallationResult> {
    try {
      const platform = this.getPlatform();

      if (await this.isInstalled() && !options.force) {
        const currentVersion = await this.getVersion();
        return {
          success: true,
          version: currentVersion || undefined,
          message: `Docker is already installed (${currentVersion})`,
        };
      }

      switch (platform) {
        case 'darwin':
          if (await this.checkCommandExists('brew')) {
            await this.executeCommand('brew', ['install', '--cask', 'docker'], { silent: options.silent || false });
          } else {
            throw new Error('Homebrew is required for Docker installation on macOS. Or download Docker Desktop from https://docker.com/');
          }
          break;
        case 'linux':
          await this.executeCommand('curl', ['-fsSL', 'https://get.docker.com', '-o', 'get-docker.sh'], { silent: options.silent || false });
          await this.executeCommand('sudo', ['sh', 'get-docker.sh'], { silent: options.silent || false });
          await this.executeCommand('sudo', ['usermod', '-aG', 'docker', process.env.USER || 'user'], { silent: options.silent || false });
          await fs.remove('get-docker.sh');
          break;
        case 'win32':
          if (await this.checkCommandExists('winget')) {
            await this.executeCommand('winget', ['install', 'Docker.DockerDesktop'], { silent: options.silent || false });
          } else if (await this.checkCommandExists('choco')) {
            await this.executeCommand('choco', ['install', 'docker-desktop'], { silent: options.silent || false });
          } else {
            throw new Error('Please install Docker Desktop manually from https://docker.com/');
          }
          break;
      }

      const installedVersion = await this.getVersion();
      return {
        success: true,
        version: installedVersion || undefined,
        message: `Docker ${installedVersion} installed successfully`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to install Docker: ${error.message}`,
        error,
      };
    }
  }

  async uninstall(options: InstallerOptions = {}): Promise<InstallationResult> {
    try {
      const platform = this.getPlatform();

      switch (platform) {
        case 'darwin':
          if (await this.checkCommandExists('brew')) {
            await this.executeCommand('brew', ['uninstall', '--cask', 'docker'], { silent: options.silent || false });
          }
          break;
        case 'linux':
          await this.executeCommand('sudo', ['apt-get', 'remove', '-y', 'docker-ce', 'docker-ce-cli', 'containerd.io'], { silent: options.silent || false });
          break;
        case 'win32':
          if (await this.checkCommandExists('winget')) {
            await this.executeCommand('winget', ['uninstall', 'Docker.DockerDesktop'], { silent: options.silent || false });
          } else if (await this.checkCommandExists('choco')) {
            await this.executeCommand('choco', ['uninstall', 'docker-desktop'], { silent: options.silent || false });
          }
          break;
      }

      return {
        success: true,
        message: 'Docker uninstalled successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to uninstall Docker: ${error.message}`,
        error,
      };
    }
  }

  async update(options: InstallerOptions = {}): Promise<InstallationResult> {
    return this.install({ ...options, force: true });
  }
}

export class GitInstaller extends BaseInstaller {
  constructor() {
    super('Git');
  }

  async isInstalled(): Promise<boolean> {
    return this.checkCommandExists('git');
  }

  async getVersion(): Promise<string | null> {
    try {
      const { stdout } = await execAsync('git --version');
      return stdout.trim();
    } catch {
      return null;
    }
  }

  async install(options: InstallerOptions = {}): Promise<InstallationResult> {
    try {
      const platform = this.getPlatform();

      if (await this.isInstalled() && !options.force) {
        const currentVersion = await this.getVersion();
        return {
          success: true,
          version: currentVersion || undefined,
          message: `Git is already installed (${currentVersion})`,
        };
      }

      switch (platform) {
        case 'darwin':
          if (await this.checkCommandExists('brew')) {
            await this.executeCommand('brew', ['install', 'git'], { silent: options.silent || false });
          } else {
            await this.executeCommand('xcode-select', ['--install'], { silent: options.silent || false });
          }
          break;
        case 'linux':
          await this.executeCommand('sudo', ['apt-get', 'update'], { silent: options.silent || false });
          await this.executeCommand('sudo', ['apt-get', 'install', '-y', 'git'], { silent: options.silent || false });
          break;
        case 'win32':
          if (await this.checkCommandExists('winget')) {
            await this.executeCommand('winget', ['install', 'Git.Git'], { silent: options.silent || false });
          } else if (await this.checkCommandExists('choco')) {
            await this.executeCommand('choco', ['install', 'git'], { silent: options.silent || false });
          } else {
            throw new Error('Please install Git manually from https://git-scm.com/');
          }
          break;
      }

      const installedVersion = await this.getVersion();
      return {
        success: true,
        version: installedVersion || undefined,
        message: `Git ${installedVersion} installed successfully`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to install Git: ${error.message}`,
        error,
      };
    }
  }

  async uninstall(options: InstallerOptions = {}): Promise<InstallationResult> {
    try {
      const platform = this.getPlatform();

      switch (platform) {
        case 'darwin':
          if (await this.checkCommandExists('brew')) {
            await this.executeCommand('brew', ['uninstall', 'git'], { silent: options.silent || false });
          }
          break;
        case 'linux':
          await this.executeCommand('sudo', ['apt-get', 'remove', '-y', 'git'], { silent: options.silent || false });
          break;
        case 'win32':
          if (await this.checkCommandExists('winget')) {
            await this.executeCommand('winget', ['uninstall', 'Git.Git'], { silent: options.silent || false });
          } else if (await this.checkCommandExists('choco')) {
            await this.executeCommand('choco', ['uninstall', 'git'], { silent: options.silent || false });
          }
          break;
      }

      return {
        success: true,
        message: 'Git uninstalled successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to uninstall Git: ${error.message}`,
        error,
      };
    }
  }

  async update(options: InstallerOptions = {}): Promise<InstallationResult> {
    return this.install({ ...options, force: true });
  }
}

// Export installer instances for easy use
export const nodeInstaller = new NodeInstaller();
export const pythonInstaller = new PythonInstaller();
export const dockerInstaller = new DockerInstaller();
export const gitInstaller = new GitInstaller();

// Export factory function
export function createInstaller(type: 'node' | 'python' | 'docker' | 'git'): Installer {
  switch (type) {
    case 'node':
      return new NodeInstaller();
    case 'python':
      return new PythonInstaller();
    case 'docker':
      return new DockerInstaller();
    case 'git':
      return new GitInstaller();
    default:
      throw new Error(`Unknown installer type: ${type}`);
  }
}