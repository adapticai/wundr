/**
 * Docker Installer - Cross-platform Docker and Docker Compose setup
 * Production-ready implementation with direct DMG installation for macOS
 */
import { execa } from 'execa';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
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
    
    // Install additional Docker tools
    await this.installDockerTools();
    
    // Setup Docker aliases
    await this.setupDockerAliases();
    
    // Create Docker templates
    await this.createDockerTemplates();
  }

  async validate(): Promise<boolean> {
    try {
      // Quick check if Docker command exists
      try {
        await execa('which', ['docker']);
      } catch {
        console.log('❌ Docker command not found in PATH');
        return false;
      }
      
      // Check if Docker daemon is running with a shorter timeout
      try {
        const { stdout } = await execa('docker', ['version'], { timeout: 5000 });
        
        // Check for both client and server
        const hasClient = stdout.includes('Client:');
        const hasServer = stdout.includes('Server:');
        
        if (!hasClient) {
          console.log('❌ Docker client not properly installed');
          return false;
        }
        
        if (!hasServer) {
          console.log('⚠️ Docker daemon is not running');
          console.log('💡 Tip: Start Docker Desktop from your Applications folder');
          return false;
        }
      } catch (error: any) {
        if (error.message?.includes('Cannot connect to the Docker daemon')) {
          console.log('⚠️ Docker is installed but the daemon is not running');
          console.log('💡 Tip: Start Docker Desktop from your Applications folder');
        } else {
          console.log('❌ Docker validation error:', error.message);
        }
        return false;
      }
      
      // Verify Docker can actually run containers
      try {
        await execa('docker', ['ps'], { timeout: 5000 });
        return true;
      } catch {
        console.log('⚠️ Docker daemon may not be fully initialized');
        return false;
      }
    } catch (error) {
      console.error('Docker validation failed:', error);
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
      // Check if Docker Desktop already installed
      if (await this.isDockerDesktopInstalled()) {
        // Docker Desktop already installed
        await this.startDockerDesktop();
        await this.waitForDockerDaemon();
        return;
      }

      // Try Homebrew first as it's simpler
      try {
        await which('brew');
        console.log('Installing Docker Desktop via Homebrew...');
        await execa('brew', ['install', '--cask', 'docker']);
      } catch {
        // Fallback to direct DMG installation
        console.log('Homebrew not available, installing Docker Desktop via DMG...');
        await this.installDockerDesktopDMG(platform);
      }
      
      // Start Docker Desktop
      await this.startDockerDesktop();
      
      // Wait for Docker daemon to be ready
      await this.waitForDockerDaemon();
      
      // Verify installation
      await this.verifyDockerInstallation();
    } catch (error) {
      console.error('Docker installation failed:', error);
      throw new Error(`Docker installation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async isDockerDesktopInstalled(): Promise<boolean> {
    try {
      await fs.access('/Applications/Docker.app');
      return true;
    } catch {
      return false;
    }
  }

  private async startDockerDesktop(): Promise<void> {
    console.log('Starting Docker Desktop...');
    try {
      // Check if Docker is already running
      try {
        await execa('docker', ['version'], { timeout: 5000 });
        console.log('✅ Docker is already running');
        return;
      } catch {
        // Not running, need to start it
      }

      // Check if Docker Desktop process is running but daemon not ready
      try {
        const { stdout } = await execa('pgrep', ['-f', 'Docker Desktop']);
        if (stdout) {
          console.log('Docker Desktop process detected but daemon not ready yet...');
          return; // Let waitForDockerDaemon handle the waiting
        }
      } catch {
        // Process not running either
      }

      // Try to open Docker from different possible locations
      const dockerPaths = [
        '/Applications/Docker.app',
        `${process.env.HOME}/Applications/Docker.app`,
        'Docker'  // Let macOS find it
      ];
      
      let started = false;
      for (const path of dockerPaths) {
        try {
          await execa('open', ['-a', path]);
          started = true;
          console.log(`✅ Docker Desktop launch initiated from: ${path}`);
          break;
        } catch {
          // Try next path
        }
      }
      
      if (!started) {
        // Last resort - try with just 'Docker'
        await execa('open', ['-a', 'Docker']);
      }
      
      console.log('💡 Note: First launch may take 2-4 minutes to complete initial setup.');
      console.log('🔄 The setup will wait for Docker to be ready...');
      
      // Give it more time to start launching
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
      console.warn('Could not auto-start Docker Desktop:', error);
      console.log('\n📝 Manual steps required:');
      console.log('   1. Open Docker Desktop from your Applications folder');
      console.log('   2. Wait for the whale icon to appear in your menu bar');
      console.log('   3. Run the setup command again\n');
      throw new Error('Please start Docker Desktop manually and run setup again.');
    }
  }

  private async waitForDockerDaemon(maxAttempts: number = 120): Promise<void> {
    console.log('Waiting for Docker daemon to start (this may take up to 4 minutes on first launch)...');
    
    let dockerDesktopRunning = false;
    let lastError: any;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // First check if Docker Desktop app is running
      if (!dockerDesktopRunning) {
        try {
          const { stdout } = await execa('pgrep', ['-f', 'Docker Desktop']);
          if (stdout) {
            dockerDesktopRunning = true;
            console.log('Docker Desktop application detected...');
          }
        } catch {
          // Docker Desktop not yet running
        }
      }
      
      // Then check if daemon is responsive
      try {
        await execa('docker', ['version'], { timeout: 5000 });
        console.log('\n✅ Docker daemon is ready!');
        
        // Give it a moment to fully initialize
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Verify it's really working
        await execa('docker', ['ps'], { timeout: 5000 });
        return;
      } catch (error) {
        lastError = error;
        
        // Show progress every 10 seconds
        if (attempt % 5 === 0 && attempt > 0) {
          const elapsed = Math.round(attempt * 2);
          const remaining = Math.round((maxAttempts - attempt) * 2);
          console.log(`⏳ Still waiting for Docker daemon... (${elapsed}s elapsed, max ${remaining}s remaining)`);
          
          // After 60 seconds, give helpful hint
          if (attempt === 30) {
            console.log('\n💡 Tip: If Docker Desktop is not starting automatically:');
            console.log('   1. Open Docker Desktop manually from Applications');
            console.log('   2. Wait for the whale icon to appear in your menu bar');
            console.log('   3. The setup will continue automatically once Docker is ready\n');
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log('\n❌ Docker daemon did not start within the expected time.');
    console.log('\nLast error:', lastError?.message || 'Unknown error');
    throw new Error('Docker daemon failed to start. Please ensure Docker Desktop is running and try again.');
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
    const homeDir = os.homedir();
    const dockerDir = `${homeDir}/.docker`;
    
    // Ensure .docker directory exists
    await execa('mkdir', ['-p', dockerDir]);
    
    // Docker config
    const config = {
      credsStore: os.platform() === 'darwin' ? 'osxkeychain' : 'desktop',
      experimental: 'enabled',
      stackOrchestrator: 'swarm',
      detachKeys: 'ctrl-z,z',
      features: {
        buildkit: true
      }
    };
    
    // Daemon config for macOS
    const daemonConfig = os.platform() === 'darwin' ? {
      builder: {
        gc: {
          defaultKeepStorage: '20GB',
          enabled: true
        }
      },
      experimental: true,
      features: {
        buildkit: true
      },
      'log-driver': 'json-file',
      'log-opts': {
        'max-size': '10m',
        'max-file': '3'
      }
    } : {
      'log-driver': 'json-file',
      'log-opts': {
        'max-size': '10m',
        'max-file': '3'
      },
      'storage-driver': 'overlay2'
    };

    // Write config files
    const fs = await import('fs').then(m => m.promises);
    await fs.writeFile(`${dockerDir}/config.json`, JSON.stringify(config, null, 2));
    
    if (os.platform() === 'darwin') {
      await fs.writeFile(`${dockerDir}/daemon.json`, JSON.stringify(daemonConfig, null, 2));
    }
    
    console.log('Docker configuration files created');
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

  /**
   * Install Docker Desktop directly from DMG for macOS
   * Handles both Intel and Apple Silicon architectures
   */
  private async installDockerDesktopDMG(platform: SetupPlatform): Promise<void> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docker-install-'));
    const dmgPath = path.join(tempDir, 'Docker.dmg');
    
    try {
      // Determine download URL based on architecture
      const isAppleSilicon = platform.arch === 'arm64';
      const downloadUrl = isAppleSilicon
        ? 'https://desktop.docker.com/mac/main/arm64/Docker.dmg'
        : 'https://desktop.docker.com/mac/main/amd64/Docker.dmg';
      
      console.log(`Downloading Docker Desktop for ${isAppleSilicon ? 'Apple Silicon' : 'Intel'} Mac...`);
      
      // Download DMG
      await execa('curl', ['-L', '-o', dmgPath, downloadUrl]);
      
      // Verify download
      const stats = await fs.stat(dmgPath);
      if (stats.size < 1000000) { // Less than 1MB indicates failed download
        throw new Error('Download failed or incomplete');
      }
      
      console.log('Mounting Docker Desktop DMG...');
      
      // Mount the DMG
      const { stdout: mountOutput } = await execa('hdiutil', ['attach', dmgPath, '-nobrowse']);
      const mountPoint = this.extractMountPoint(mountOutput);
      
      if (!mountPoint) {
        throw new Error('Failed to determine mount point');
      }
      
      console.log(`DMG mounted at: ${mountPoint}`);
      
      // Copy Docker.app to Applications
      console.log('Installing Docker Desktop...');
      await execa('cp', ['-R', path.join(mountPoint, 'Docker.app'), '/Applications/']);
      
      // Unmount the DMG
      console.log('Cleaning up...');
      await execa('hdiutil', ['detach', mountPoint]);
      
      console.log('Docker Desktop installation completed successfully');
      
    } finally {
      // Clean up temporary files
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn('Failed to clean up temporary files:', error);
      }
    }
  }

  /**
   * Extract mount point from hdiutil output
   */
  private extractMountPoint(mountOutput: string): string | null {
    const lines = mountOutput.split('\n');
    for (const line of lines) {
      if (line.includes('/Volumes/')) {
        const match = line.match(/\s+(\/Volumes\/[^\s]+)/);
        if (match) {
          return match[1];
        }
      }
    }
    return null;
  }

  /**
   * Verify Docker installation is working properly
   */
  private async verifyDockerInstallation(): Promise<void> {
    console.log('Verifying Docker installation...');
    
    try {
      // Check Docker version
      const { stdout: versionOutput } = await execa('docker', ['version']);
      console.log('Docker version check passed');
      
      // Check if daemon is responding
      await execa('docker', ['system', 'info']);
      console.log('Docker daemon check passed');
      
      // Test with hello-world container
      console.log('Testing Docker with hello-world container...');
      await execa('docker', ['run', '--rm', 'hello-world']);
      console.log('Docker hello-world test passed');
      
      // Check Docker Compose
      try {
        await execa('docker', ['compose', 'version']);
        console.log('Docker Compose is available');
      } catch {
        console.warn('Docker Compose plugin not available, but Docker is working');
      }
      
      console.log('✅ Docker installation verified successfully');
      
    } catch (error) {
      console.error('Docker verification failed:', error);
      throw new Error(`Docker verification failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async installDockerTools(): Promise<void> {
    console.log('Installing Docker development tools...');
    
    // Check if Homebrew is available
    try {
      await which('brew');
      
      const tools = [
        'dive',
        'lazydocker',
        'ctop',
        'docker-slim'
      ];
      
      for (const tool of tools) {
        try {
          // Check if already installed
          await execa('brew', ['list', tool]);
          console.log(`${tool} already installed`);
        } catch {
          try {
            console.log(`Installing ${tool}...`);
            await execa('brew', ['install', tool]);
          } catch (error) {
            console.warn(`Failed to install ${tool}:`, error);
          }
        }
      }
    } catch {
      console.log('Homebrew not available, skipping Docker tools installation');
    }
  }

  private async setupDockerAliases(): Promise<void> {
    const homeDir = os.homedir();
    
    const aliases = `
# Docker aliases
alias d='docker'
alias dc='docker-compose'
alias dps='docker ps'
alias dpsa='docker ps -a'
alias di='docker images'
alias dex='docker exec -it'
alias dl='docker logs'
alias dlf='docker logs -f'
alias dcp='docker cp'
alias drm='docker rm'
alias drmi='docker rmi'
alias dprune='docker system prune -a'
alias dstop='docker stop $(docker ps -q)'
alias dkill='docker kill $(docker ps -q)'
alias drmall='docker rm $(docker ps -aq)'
alias drmiall='docker rmi $(docker images -q)'

# Docker Compose aliases
alias dcup='docker-compose up'
alias dcupd='docker-compose up -d'
alias dcdown='docker-compose down'
alias dcdownv='docker-compose down -v'
alias dcps='docker-compose ps'
alias dclogs='docker-compose logs'
alias dclogsf='docker-compose logs -f'
alias dcrestart='docker-compose restart'
alias dcbuild='docker-compose build'
alias dcpull='docker-compose pull'

# Docker functions
dsh() {
    docker exec -it "$1" /bin/sh
}

dbash() {
    docker exec -it "$1" /bin/bash
}

dclean() {
    docker system prune -af --volumes
}

docker-ip() {
    docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$1"
}
`;

    const shellFiles = ['.zshrc', '.bashrc'];
    
    for (const shellFile of shellFiles) {
      const shellPath = path.join(homeDir, shellFile);
      
      try {
        let shellContent = '';
        try {
          shellContent = await fs.readFile(shellPath, 'utf-8');
        } catch {
          // File doesn't exist
        }

        // Check if Docker aliases are already configured
        if (shellContent.includes("alias d='docker'")) {
          continue;
        }

        await fs.writeFile(shellPath, shellContent + aliases, 'utf-8');
        console.log(`Added Docker aliases to ${shellFile}`);
      } catch (error) {
        console.warn(`Failed to update ${shellFile} with Docker aliases:`, error);
      }
    }
  }

  private async createDockerTemplates(): Promise<void> {
    console.log('Creating Docker templates...');
    
    const templatesDir = path.join(os.homedir(), '.docker-templates');
    
    try {
      await fs.mkdir(templatesDir, { recursive: true });
      
      // Node.js Dockerfile template
      const nodeDockerfile = `FROM node:lts-alpine AS base

RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production

FROM base AS build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM base AS runtime
ENV NODE_ENV production
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --chown=nodejs:nodejs package*.json ./

USER nodejs
EXPOSE 3000
CMD ["node", "dist/index.js"]
`;

      await fs.writeFile(path.join(templatesDir, 'Dockerfile.node'), nodeDockerfile);
      
      // Docker Compose template
      const dockerCompose = `version: '3'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
    volumes:
      - .:/app
      - /app/node_modules
    networks:
      - app-network

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: devpass
      POSTGRES_DB: devdb
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    networks:
      - app-network

volumes:
  postgres-data:

networks:
  app-network:
    driver: bridge
`;

      await fs.writeFile(path.join(templatesDir, 'docker-compose.yml'), dockerCompose);
      
      // .dockerignore template
      const dockerignore = `node_modules
npm-debug.log
.env
.env.*
!.env.example
.git
.gitignore
README.md
.vscode
.idea
coverage
.nyc_output
dist
build
*.log
.DS_Store
`;

      await fs.writeFile(path.join(templatesDir, '.dockerignore'), dockerignore);
      
      console.log(`Docker templates created in ${templatesDir}`);
    } catch (error) {
      console.warn('Failed to create Docker templates:', error);
    }
  }
}