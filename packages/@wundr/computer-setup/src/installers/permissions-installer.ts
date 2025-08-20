/**
 * Permissions and Security Setup Installer
 * Based on new-starter/scripts/setup/01-permissions.sh
 */
import { execSync } from 'child_process';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { BaseInstaller } from './index';
import { SetupPlatform, SetupStep, DeveloperProfile } from '../types';

export class PermissionsInstaller implements BaseInstaller {
  name = 'permissions';
  
  isSupported(platform: SetupPlatform): boolean {
    return true; // Supports all platforms
  }
  
  async isInstalled(): Promise<boolean> {
    // Permissions setup is always needed
    return false;
  }
  
  async getVersion(): Promise<string | null> {
    return 'n/a';
  }
  
  async install(profile: DeveloperProfile, platform: SetupPlatform): Promise<void> {
    console.log('Setting up permissions and security...');
    
    if (platform.os === 'darwin') {
      await this.setupSudoTouchId();
    }
    
    await this.fixPermissions();
    await this.fixNpmPermissions();
    await this.setupDevDirectories(profile);
    
    if (platform.os === 'darwin') {
      await this.configureFileLimits();
      await this.configureFinderSettings();
    }
    
    await this.setupSshPermissions();
  }
  
  async configure(profile: DeveloperProfile, platform: SetupPlatform): Promise<void> {
    // Configuration is done during install
  }
  
  async validate(): Promise<boolean> {
    try {
      const homeDir = os.homedir();
      const dirs = [
        `${homeDir}/.npm`,
        `${homeDir}/.ssh`
      ];
      
      for (const dir of dirs) {
        if (fs.existsSync(dir)) {
          const stats = fs.statSync(dir);
          if (stats.uid !== process.getuid()) {
            return false;
          }
        }
      }
      return true;
    } catch {
      return false;
    }
  }
  
  getSteps(profile: DeveloperProfile, platform: SetupPlatform): SetupStep[] {
    return [{
      id: 'setup-permissions',
      name: 'Setup Permissions & Security',
      description: 'Configure system permissions, SSH, and development directories',
      category: 'system',
      required: true,
      dependencies: [],
      estimatedTime: 30,
      validator: () => this.validate(),
      installer: () => this.install(profile, platform)
    }];
  }
  
  private async setupSudoTouchId(): Promise<void> {
    console.log('Configuring sudo with Touch ID...');
    try {
      const sudoConfig = '/etc/pam.d/sudo';
      const touchIdLine = 'auth       sufficient     pam_tid.so';
      
      const content = fs.readFileSync(sudoConfig, 'utf-8');
      if (!content.includes('pam_tid.so')) {
        // Need to add Touch ID support
        const lines = content.split('\\n');
        lines.splice(1, 0, touchIdLine);
        
        // Write with sudo
        execSync(`echo '${lines.join('\\n')}' | sudo tee ${sudoConfig} > /dev/null`);
        console.log('Touch ID configured for sudo');
      } else {
        console.log('Touch ID already configured for sudo');
      }
    } catch (error) {
      console.warn('Could not configure Touch ID for sudo:', error);
    }
  }
  
  private async fixPermissions(): Promise<void> {
    console.log('Fixing common permission issues...');
    const homeDir = os.homedir();
    const dirs = [
      `${homeDir}/.npm`,
      `${homeDir}/.npm/_npx`,
      `${homeDir}/.npm/_cacache`,
      `${homeDir}/.npm/_logs`,
      `${homeDir}/.pnpm`,
      `${homeDir}/.yarn`,
      `${homeDir}/.nvm`,
      `${homeDir}/.docker`,
      `${homeDir}/.config`,
      `${homeDir}/.cache`,
      `${homeDir}/.claude`,
      `${homeDir}/.claude-flow`
    ];
    
    for (const dir of dirs) {
      if (fs.existsSync(dir)) {
        try {
          execSync(`chown -R $(whoami):$(id -gn) "${dir}" 2>/dev/null || true`);
          execSync(`chmod -R u+rwX "${dir}" 2>/dev/null || true`);
          console.log(`Fixed permissions for ${dir}`);
        } catch {
          // Try with sudo if regular fails
          try {
            execSync(`sudo chown -R $(whoami):$(id -gn) "${dir}" 2>/dev/null || true`);
          } catch {}
        }
      }
    }
    
    // Clean corrupted npm/npx cache
    const npxCache = `${homeDir}/.npm/_npx`;
    if (fs.existsSync(npxCache)) {
      console.log('Cleaning npx cache...');
      try {
        execSync(`rm -rf "${npxCache}"`);
      } catch {
        try {
          execSync(`sudo rm -rf "${npxCache}"`);
        } catch {}
      }
    }
    
    // macOS specific
    if (os.platform() === 'darwin') {
      if (fs.existsSync('/usr/local')) {
        try {
          execSync('sudo chown -R $(whoami):admin /usr/local/bin /usr/local/lib /usr/local/share 2>/dev/null || true');
        } catch {}
      }
      
      if (fs.existsSync('/opt/homebrew')) {
        try {
          execSync('sudo chown -R $(whoami):admin /opt/homebrew 2>/dev/null || true');
        } catch {}
      }
    }
  }
  
  private async fixNpmPermissions(): Promise<void> {
    console.log('Fixing npm and npx specific permissions...');
    const homeDir = os.homedir();
    const npmDirs = [
      `${homeDir}/.npm`,
      `${homeDir}/.npm-global`,
      `${homeDir}/.npm-packages`
    ];
    
    for (const dir of npmDirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      try {
        execSync(`chown -R $(whoami):$(id -gn) "${dir}" 2>/dev/null || true`);
      } catch {}
    }
    
    // Configure npm to use a directory we own for global packages
    try {
      execSync(`npm config set prefix "${homeDir}/.npm-global" 2>/dev/null || true`);
      
      // Add npm global bin to PATH
      const npmGlobalBin = `${homeDir}/.npm-global/bin`;
      const shellRc = `${homeDir}/.zshrc`;
      
      if (fs.existsSync(shellRc)) {
        const content = fs.readFileSync(shellRc, 'utf-8');
        if (!content.includes(npmGlobalBin)) {
          fs.appendFileSync(shellRc, `\\nexport PATH="${npmGlobalBin}:$PATH"\\n`);
        }
      }
      
      // Clear npm cache
      execSync('npm cache clean --force 2>/dev/null || true');
    } catch {}
  }
  
  private async setupDevDirectories(profile: DeveloperProfile): Promise<void> {
    console.log('Creating development directories...');
    const homeDir = os.homedir();
    const rootDir = path.join(homeDir, 'Development');
    
    const devDirs = [
      rootDir,
      `${rootDir}/projects`,
      `${rootDir}/tools`,
      `${rootDir}/sandbox`,
      `${rootDir}/.config`,
      `${rootDir}/.claude-flow`,
      `${homeDir}/.local/bin`
    ];
    
    for (const dir of devDirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      }
    }
    
    // Add .local/bin to PATH
    const localBin = `${homeDir}/.local/bin`;
    const shellRc = `${homeDir}/.zshrc`;
    
    if (fs.existsSync(shellRc)) {
      const content = fs.readFileSync(shellRc, 'utf-8');
      if (!content.includes(localBin)) {
        fs.appendFileSync(shellRc, `\\nexport PATH="${localBin}:$PATH"\\n`);
      }
    }
  }
  
  private async configureFileLimits(): Promise<void> {
    console.log('Configuring file descriptor limits...');
    const plistFile = '/Library/LaunchDaemons/limit.maxfiles.plist';
    
    if (!fs.existsSync(plistFile)) {
      const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>limit.maxfiles</string>
    <key>ProgramArguments</key>
    <array>
        <string>launchctl</string>
        <string>limit</string>
        <string>maxfiles</string>
        <string>524288</string>
        <string>524288</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>`;
      
      try {
        execSync(`echo '${plistContent}' | sudo tee ${plistFile} > /dev/null`);
        execSync(`sudo launchctl load -w ${plistFile} 2>/dev/null || true`);
        console.log('File descriptor limits configured');
      } catch {}
    }
  }
  
  private async setupSshPermissions(): Promise<void> {
    console.log('Setting up SSH directory permissions...');
    const homeDir = os.homedir();
    const sshDir = `${homeDir}/.ssh`;
    
    if (!fs.existsSync(sshDir)) {
      fs.mkdirSync(sshDir, { mode: 0o700 });
    } else {
      fs.chmodSync(sshDir, 0o700);
    }
    
    const sshConfig = `${sshDir}/config`;
    if (fs.existsSync(sshConfig)) {
      fs.chmodSync(sshConfig, 0o600);
    }
    
    // Fix key permissions
    const files = fs.readdirSync(sshDir);
    for (const file of files) {
      const fullPath = path.join(sshDir, file);
      const stats = fs.statSync(fullPath);
      
      if (stats.isFile()) {
        if (file.endsWith('.pub')) {
          fs.chmodSync(fullPath, 0o644);
        } else if (file.startsWith('id_')) {
          fs.chmodSync(fullPath, 0o600);
        }
      }
    }
    
    console.log('SSH permissions configured');
  }
  
  private async configureFinderSettings(): Promise<void> {
    console.log('Configuring macOS Finder to show hidden files...');
    
    try {
      // Show hidden files
      execSync('defaults write com.apple.finder AppleShowAllFiles -bool TRUE');
      // Show file extensions
      execSync('defaults write NSGlobalDomain AppleShowAllExtensions -bool TRUE');
      // Show path bar
      execSync('defaults write com.apple.finder ShowPathbar -bool TRUE');
      // Show status bar
      execSync('defaults write com.apple.finder ShowStatusBar -bool TRUE');
      // Restart Finder
      execSync('killall Finder 2>/dev/null || true');
      
      console.log('Finder settings updated (hidden files now visible)');
    } catch {}
  }
}