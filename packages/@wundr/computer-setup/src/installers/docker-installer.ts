/**
 * Docker Installer - Cross-platform Docker and Docker Compose setup
 */
import { execa } from 'execa';
import * as os from 'os';
import which from 'which';
import { BaseInstaller } from './index';
import { SetupPlatform, SetupStep, DeveloperProfile } from '../types';

export class DockerInstaller implements BaseInstaller {
  name = 'docker';

  isSupported(platform: SetupPlatform): boolean {
    return ['darwin', 'linux', 'win32'].includes(platform.os);
  }

  async isInstalled(): Promise<boolean> {
    try {
      await which('docker');
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string | null> {
    try {
      const { stdout } = await execa('docker', ['--version']);
      return stdout.trim();
    } catch {
      return null;
    }
  }

  async install(profile: DeveloperProfile, platform: SetupPlatform): Promise<void> {
    const { containers } = profile.tools;
    if (!containers.docker) {
      return;
    }

    switch (platform.os) {
      case 'darwin':
        await this.installOnMac(platform);
        break;
      case 'linux':
        await this.installOnLinux(platform);
        break;
      case 'win32':
        await this.installOnWindows(platform);
        break;
      default:
        throw new Error(`Docker installation not supported on ${platform.os}`);
    }

    // Install Docker Compose if requested
    if (containers.dockerCompose) {
      await this.installDockerCompose(platform);
    }
  }

  async configure(profile: DeveloperProfile, platform: SetupPlatform): Promise<void> {
    // Configure Docker daemon settings
    await this.configureDockerDaemon();
    
    // Setup Docker context
    await this.setupDockerContext();
    
    // Configure resource limits
    await this.configureResourceLimits(platform);
  }

  async validate(): Promise<boolean> {
    try {
      // Check if Docker daemon is running
      await execa('docker', ['info']);
      return true;
    } catch {
      return false;
    }
  }

  getSteps(profile: DeveloperProfile, platform: SetupPlatform): SetupStep[] {
    const { containers } = profile.tools;
    if (!containers.docker) return [];

    const steps: SetupStep[] = [
      {
        id: 'install-docker',
        name: 'Install Docker Engine',
        description: 'Install Docker containerization platform',
        category: 'development',
        required: true,
        dependencies: [],
        estimatedTime: 120,
        validator: () => this.isInstalled(),
        installer: () => this.installDocker(platform)
      },
      {
        id: 'configure-docker',
        name: 'Configure Docker',
        description: 'Configure Docker daemon and settings',
        category: 'development',
        required: true,
        dependencies: ['install-docker'],
        estimatedTime: 30,
        validator: () => this.validate(),
        installer: () => this.configure(profile, platform)
      }
    ];

    if (containers.dockerCompose) {
      steps.push({
        id: 'install-docker-compose',
        name: 'Install Docker Compose',
        description: 'Install Docker Compose for multi-container applications',
        category: 'development',
        required: true,
        dependencies: ['install-docker'],
        estimatedTime: 30,
        validator: () => this.validateDockerCompose(),
        installer: () => this.installDockerCompose(platform)
      });
    }

    return steps;
  }

  private async installDocker(platform: SetupPlatform): Promise<void> {
    switch (platform.os) {
      case 'darwin':
        await this.installOnMac(platform);
        break;
      case 'linux':
        await this.installOnLinux(platform);
        break;
      case 'win32':
        await this.installOnWindows(platform);
        break;
    }
  }

  private async installOnMac(platform: SetupPlatform): Promise<void> {
    try {
      // Check if Homebrew is available
      await which('brew');
      
      if (platform.arch === 'arm64') {
        await execa('brew', ['install', '--cask', 'docker']);
      } else {
        await execa('brew', ['install', '--cask', 'docker']);
      }
    } catch {
      throw new Error('Docker installation on macOS requires Homebrew or manual download from docker.com');
    }
  }

  private async installOnLinux(platform: SetupPlatform): Promise<void> {
    // Detect Linux distribution
    const distro = platform.distro || await this.detectLinuxDistro();
    
    switch (distro) {
      case 'ubuntu':
      case 'debian':
        await this.installOnDebian();
        break;
      case 'centos':
      case 'rhel':
      case 'fedora':
        await this.installOnRedHat();
        break;
      default:
        throw new Error(`Docker installation not supported on ${distro}`);
    }
  }

  private async installOnDebian(): Promise<void> {
    const commands = [
      'apt-get update',
      'apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release',
      'curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg',
      'echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null',
      'apt-get update',
      'apt-get install -y docker-ce docker-ce-cli containerd.io'
    ];

    for (const cmd of commands) {
      await execa('sudo', ['bash', '-c', cmd]);
    }

    // Add user to docker group
    const username = os.userInfo().username;
    await execa('sudo', ['usermod', '-aG', 'docker', username]);
  }

  private async installOnRedHat(): Promise<void> {
    const commands = [
      'yum install -y yum-utils',
      'yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo',
      'yum install -y docker-ce docker-ce-cli containerd.io'
    ];

    for (const cmd of commands) {
      await execa('sudo', ['bash', '-c', cmd]);
    }

    // Start and enable Docker service
    await execa('sudo', ['systemctl', 'start', 'docker']);
    await execa('sudo', ['systemctl', 'enable', 'docker']);

    // Add user to docker group
    const username = os.userInfo().username;
    await execa('sudo', ['usermod', '-aG', 'docker', username]);
  }

  private async installOnWindows(platform: SetupPlatform): Promise<void> {
    throw new Error('Docker installation on Windows requires manual download from docker.com and WSL2 setup');
  }

  private async installDockerCompose(platform: SetupPlatform): Promise<void> {
    try {
      // Modern Docker installations include Compose plugin
      const { stdout } = await execa('docker', ['compose', 'version']);
      if (stdout) return; // Already installed
    } catch {
      // Install standalone Docker Compose
      if (platform.os === 'linux') {
        const arch = platform.arch === 'arm64' ? 'aarch64' : 'x86_64';
        const url = `https://github.com/docker/compose/releases/latest/download/docker-compose-linux-${arch}`;
        
        await execa('sudo', ['curl', '-L', url, '-o', '/usr/local/bin/docker-compose']);
        await execa('sudo', ['chmod', '+x', '/usr/local/bin/docker-compose']);
      } else {
        throw new Error('Docker Compose installation failed - please install manually');
      }
    }
  }

  private async configureDockerDaemon(): Promise<void> {
    // Basic daemon configuration
    const daemonConfig = {
      'log-driver': 'json-file',
      'log-opts': {
        'max-size': '10m',
        'max-file': '3'
      },
      'storage-driver': 'overlay2'
    };

    // This would write to Docker daemon config file
    // Implementation depends on platform-specific paths
  }

  private async setupDockerContext(): Promise<void> {
    try {
      // Create default context if it doesn't exist
      await execa('docker', ['context', 'create', 'default', '--docker', 'host=unix:///var/run/docker.sock']);
    } catch {
      // Context might already exist
    }
  }

  private async configureResourceLimits(platform: SetupPlatform): Promise<void> {
    // Platform-specific resource configuration
    if (platform.os === 'darwin') {
      // macOS Docker Desktop resource limits
      console.log('Configure Docker Desktop resource limits through the UI');
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

  private async validateDockerCompose(): Promise<boolean> {
    try {
      await execa('docker', ['compose', 'version']);
      return true;
    } catch {
      try {
        await execa('docker-compose', ['--version']);
        return true;
      } catch {
        return false;
      }
    }
  }
}