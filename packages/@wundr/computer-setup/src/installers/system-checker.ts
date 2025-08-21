/**
 * System Checker - System health check and repair for broken installations
 * Ports functionality from 00-system-check.sh
 */
import { execa } from 'execa';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';
import which from 'which';
import { BaseInstaller } from './index';
import { SetupPlatform, SetupStep, DeveloperProfile } from '../types';

export class SystemChecker implements BaseInstaller {
  name = 'system-checker';
  private readonly homeDir = os.homedir();
  
  isSupported(platform: SetupPlatform): boolean {
    return ['darwin', 'linux'].includes(platform.os);
  }

  async isInstalled(): Promise<boolean> {
    // Always return false as this is a diagnostic tool that should always run
    return false;
  }

  async getVersion(): Promise<string | null> {
    return 'System Check v1.0';
  }

  async install(_profile: DeveloperProfile, _platform: SetupPlatform): Promise<void> {
    console.log('Running system health check and repairs...');
    
    // Clean problematic configurations
    await this.cleanProblematicConfigs();
    
    // Check and fix Node/npm installation
    const nodeNpmFixed = await this.checkAndFixNodeNpm();
    
    if (nodeNpmFixed) {
      console.log('✅ System check passed - Node.js and npm are working');
    } else {
      console.warn('⚠️ System check found issues - will be addressed during setup');
    }
  }

  async configure(_profile: DeveloperProfile, _platform: SetupPlatform): Promise<void> {
    // No configuration needed for system checker
  }

  async validate(): Promise<boolean> {
    try {
      // Check if Node.js is working
      await execa('node', ['--version']);
      
      // Check if npm is working
      await execa('npm', ['--version']);
      
      return true;
    } catch {
      return false;
    }
  }

  getSteps(_profile: DeveloperProfile, _platform: SetupPlatform): SetupStep[] {
    return [{
      id: 'system-check',
      name: 'System Health Check',
      description: 'Check and repair system for previous broken installations',
      category: 'system',
      required: true,
      dependencies: [],
      estimatedTime: 60,
      validator: () => this.validate(),
      installer: () => this.install(_profile, _platform)
    }];
  }

  private async checkAndFixNodeNpm(): Promise<boolean> {
    console.log('Checking Node.js and npm installation state...');
    
    let needsRepair = false;
    
    // Check if node exists
    try {
      const { stdout } = await execa('node', ['--version']);
      console.log(`Node.js found: ${stdout.trim()}`);
    } catch {
      console.log('Node.js not found');
      needsRepair = true;
    }
    
    // Check if npm exists and works
    try {
      const { stdout } = await execa('npm', ['--version']);
      console.log(`npm found: ${stdout.trim()}`);
    } catch (error) {
      console.error('ERROR: npm is broken or missing');
      needsRepair = true;
      
      // Check for the specific graceful-fs error
      const errorStr = error instanceof Error ? error.message : String(error);
      if (errorStr.includes("Cannot find module 'graceful-fs'")) {
        console.log('Detected missing graceful-fs module - npm is completely broken');
      }
    }
    
    // Check for NVM and attempt repair if needed
    const nvmDir = path.join(this.homeDir, '.nvm');
    try {
      await fs.access(nvmDir);
      console.log(`NVM detected at ${nvmDir}`);
      
      if (needsRepair) {
        console.log('Attempting to repair Node.js/npm using NVM...');
        
        // Set up NVM environment
        const nvmScript = path.join(nvmDir, 'nvm.sh');
        try {
          await fs.access(nvmScript);
          
          // Get current version or use LTS
          let currentVersion = 'none';
          try {
            const { stdout } = await execa('bash', ['-c', `source ${nvmScript} && nvm current`]);
            currentVersion = stdout.trim();
          } catch {
            currentVersion = 'none';
          }
          
          if (currentVersion === 'none' || currentVersion === 'system') {
            console.log('No NVM-managed Node.js found, installing LTS...');
            await execa('bash', ['-c', `source ${nvmScript} && nvm install --lts && nvm use --lts && nvm alias default lts/*`]);
          } else {
            console.log(`Found NVM-managed Node.js: ${currentVersion}`);
            // If npm is broken, reinstall the current version
            try {
              await execa('npm', ['--version']);
            } catch {
              console.log(`Reinstalling Node.js ${currentVersion} to fix npm...`);
              await execa('bash', ['-c', `source ${nvmScript} && nvm uninstall ${currentVersion} || true && nvm install ${currentVersion} && nvm use ${currentVersion}`]);
            }
          }
          
          // Check if repair worked
          try {
            const { stdout } = await execa('npm', ['--version']);
            console.log(`✅ Successfully repaired npm: ${stdout.trim()}`);
            needsRepair = false;
          } catch {
            console.log('⚠️ npm repair failed - will be handled by subsequent scripts');
          }
        } catch {
          console.log('NVM script not found or not executable');
        }
      }
    } catch {
      console.log('NVM not installed yet');
      if (needsRepair) {
        console.log('Node.js/npm needs repair but NVM not available - will install fresh');
      }
    }
    
    return !needsRepair;
  }

  private async cleanProblematicConfigs(): Promise<void> {
    console.log('Cleaning problematic configurations...');
    
    // Clean npm config issues
    const npmrcPath = path.join(this.homeDir, '.npmrc');
    try {
      await fs.access(npmrcPath);
      
      const npmrcContent = await fs.readFile(npmrcPath, 'utf-8');
      
      if (npmrcContent.includes('prefix=') || npmrcContent.includes('globalconfig=')) {
        console.log('Found problematic .npmrc configuration, backing up and cleaning...');
        
        // Create backup
        const backupPath = `${npmrcPath}.backup.${new Date().toISOString().split('T')[0].replace(/-/g, '')}_${Date.now()}`;
        await fs.copyFile(npmrcPath, backupPath);
        
        // Remove problematic lines
        const cleanedContent = npmrcContent
          .split('\n')
          .filter(line => !line.startsWith('prefix=') && !line.startsWith('globalconfig='))
          .join('\n');
        
        await fs.writeFile(npmrcPath, cleanedContent);
      }
    } catch {
      // File doesn't exist, which is fine
    }
    
    // Clean npm cache if it exists
    const npmDir = path.join(this.homeDir, '.npm');
    try {
      await fs.access(npmDir);
      console.log('Cleaning npm cache directories...');
      
      try {
        await fs.rm(path.join(npmDir, '_logs'), { recursive: true, force: true });
      } catch {}
      
      try {
        await fs.rm(path.join(npmDir, '_npx'), { recursive: true, force: true });
      } catch {}
      
      try {
        await fs.rm(path.join(npmDir, '_cacache'), { recursive: true, force: true });
      } catch {}
    } catch {
      // npm directory doesn't exist
    }
  }

  async uninstall(): Promise<void> {
    console.log('System checker cannot be uninstalled as it provides diagnostic functionality');
  }
}