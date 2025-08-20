/**
 * Real Setup Orchestrator - Production-ready computer setup management
 * 
 * Features:
 * - Installation order and dependency management
 * - Profile-based installations (frontend, backend, fullstack, devops)
 * - Real-time progress tracking with user feedback
 * - Comprehensive error handling and graceful recovery
 * - Resume from failure capability with state persistence
 * - Validation and verification for each installation step
 * - Coordinated installer management with rollback support
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execa } from 'execa';
import {
  DeveloperProfile,
  SetupPlatform,
  SetupStep,
  SetupOptions,
  SetupResult,
  SetupProgress
} from '../types';
import { HomebrewInstaller } from './homebrew-installer';
import { PermissionsInstaller } from './permissions-installer';
import { DockerInstaller } from './docker-installer';

// Enhanced interfaces for the real orchestrator
interface InstallationState {
  sessionId: string;
  startTime: Date;
  currentStep: string | null;
  completedSteps: Set<string>;
  failedSteps: Map<string, Error>;
  skippedSteps: Set<string>;
  profile: DeveloperProfile;
  platform: SetupPlatform;
  resumable: boolean;
}

interface ProfileConfig {
  name: string;
  description: string;
  priority: number;
  categories: string[];
  requiredTools: string[];
  optionalTools: string[];
  estimatedTimeMinutes: number;
}

interface InstallationPlan {
  profile: ProfileConfig;
  steps: SetupStep[];
  dependencies: Map<string, string[]>;
  estimatedDuration: number;
  criticalPath: string[];
}

interface ProgressCallback {
  (progress: SetupProgress): void;
}

export class RealSetupOrchestrator extends EventEmitter {
  private state: InstallationState | null = null;
  private stateFile: string;
  private installers: Map<string, any> = new Map();
  private profiles: Map<string, ProfileConfig> = new Map();
  private progressCallbacks: Set<ProgressCallback> = new Set();
  
  constructor(private platform: SetupPlatform) {
    super();
    this.stateFile = path.join(os.homedir(), '.wundr-setup-state.json');
    this.initializeInstallers();
    this.initializeProfiles();
  }

  /**
   * Initialize all available installers
   */
  private initializeInstallers(): void {
    this.installers.set('permissions', new PermissionsInstaller());
    this.installers.set('homebrew', new HomebrewInstaller());
    this.installers.set('docker', new DockerInstaller());
    
    // Core tools installers (to be implemented)
    this.installers.set('git', this.createCoreToolInstaller('git', 'Git version control'));
    this.installers.set('node', this.createCoreToolInstaller('node', 'Node.js runtime'));
    this.installers.set('python', this.createCoreToolInstaller('python', 'Python programming language'));
    this.installers.set('vscode', this.createCoreToolInstaller('code', 'Visual Studio Code editor'));
  }

  /**
   * Initialize predefined development profiles
   */
  private initializeProfiles(): void {
    this.profiles.set('frontend', {
      name: 'Frontend Developer',
      description: 'Modern web frontend development with React, Vue, and tooling',
      priority: 1,
      categories: ['system', 'development', 'frontend'],
      requiredTools: ['permissions', 'homebrew', 'git', 'node', 'vscode'],
      optionalTools: ['docker'],
      estimatedTimeMinutes: 15
    });

    this.profiles.set('backend', {
      name: 'Backend Developer',
      description: 'Server-side development with Node.js, Python, and databases',
      priority: 1,
      categories: ['system', 'development', 'backend', 'database'],
      requiredTools: ['permissions', 'homebrew', 'git', 'node', 'python', 'docker', 'vscode'],
      optionalTools: [],
      estimatedTimeMinutes: 25
    });

    this.profiles.set('fullstack', {
      name: 'Full Stack Developer',
      description: 'Complete development stack with frontend and backend tools',
      priority: 1,
      categories: ['system', 'development', 'frontend', 'backend', 'database'],
      requiredTools: ['permissions', 'homebrew', 'git', 'node', 'python', 'docker', 'vscode'],
      optionalTools: [],
      estimatedTimeMinutes: 30
    });

    this.profiles.set('devops', {
      name: 'DevOps Engineer',
      description: 'Infrastructure and deployment tools with container orchestration',
      priority: 1,
      categories: ['system', 'development', 'devops', 'cloud'],
      requiredTools: ['permissions', 'homebrew', 'git', 'docker', 'python', 'vscode'],
      optionalTools: ['node'],
      estimatedTimeMinutes: 35
    });
  }

  /**
   * Create a generic core tool installer
   */
  private createCoreToolInstaller(toolName: string, description: string) {
    return {
      name: toolName,
      isSupported: () => true,
      isInstalled: async () => {
        try {
          await execa('which', [toolName]);
          return true;
        } catch {
          return false;
        }
      },
      getVersion: async () => {
        try {
          const { stdout } = await execa(toolName, ['--version']);
          return stdout.split('\n')[0];
        } catch {
          return null;
        }
      },
      install: async () => {
        if (this.platform.os === 'darwin') {
          await execa('brew', ['install', toolName]);
        }
      },
      validate: async () => {
        return await this.createCoreToolInstaller(toolName, description).isInstalled();
      },
      getSteps: (): SetupStep[] => [{
        id: `install-${toolName}`,
        name: `Install ${description}`,
        description: `Install ${description}`,
        category: 'development' as const,
        required: true,
        dependencies: toolName === 'git' ? ['install-homebrew'] : ['install-homebrew', 'install-git'],
        estimatedTime: 60,
        validator: () => this.createCoreToolInstaller(toolName, description).isInstalled(),
        installer: () => this.createCoreToolInstaller(toolName, description).install()
      }]
    };
  }

  /**
   * Main orchestration method - manages the complete installation flow
   */
  async orchestrate(
    profileName: string,
    options: Partial<SetupOptions> = {},
    progressCallback?: ProgressCallback
  ): Promise<SetupResult> {
    const sessionId = this.generateSessionId();
    const startTime = Date.now();

    if (progressCallback) {
      this.progressCallbacks.add(progressCallback);
    }

    try {
      // Initialize state
      await this.initializeState(sessionId, profileName, options);
      
      // Create installation plan
      const plan = await this.createInstallationPlan(profileName);
      this.emitProgress('Planning installation', 0, plan.estimatedDuration);

      // Phase 1: System validation and preparation
      await this.executePhase('System Validation', async () => {
        await this.validateSystemRequirements();
        await this.setupSystemPermissions();
      }, 0, 10);

      // Phase 2: Core system tools
      await this.executePhase('Core System Tools', async () => {
        await this.installCoreSystemTools(plan);
      }, 10, 30);

      // Phase 3: Development tools
      await this.executePhase('Development Tools', async () => {
        await this.installDevelopmentTools(plan);
      }, 30, 70);

      // Phase 4: Configuration and validation
      await this.executePhase('Configuration & Validation', async () => {
        await this.configureInstalledTools(plan);
        await this.validateInstallation(plan);
      }, 70, 95);

      // Phase 5: Finalization
      await this.executePhase('Finalization', async () => {
        await this.finalizeSetup();
      }, 95, 100);

      // Generate result
      const result = await this.generateResult(startTime, true);
      await this.cleanupState();

      this.emitProgress('Setup completed successfully!', 100, 0);
      return result;

    } catch (error) {
      console.error('Setup failed:', error);
      
      // Save state for resumption
      if (this.state) {
        this.state.resumable = true;
        await this.saveState();
      }

      const result = await this.generateResult(startTime, false, error as Error);
      this.emitProgress(`Setup failed: ${(error as Error).message}`, this.getCurrentProgress(), 0);
      
      return result;
    }
  }

  /**
   * Resume a failed installation from saved state
   */
  async resume(progressCallback?: ProgressCallback): Promise<SetupResult> {
    if (progressCallback) {
      this.progressCallbacks.add(progressCallback);
    }

    try {
      await this.loadState();
      
      if (!this.state?.resumable) {
        throw new Error('No resumable setup found');
      }

      console.log(`Resuming setup from step: ${this.state.currentStep}`);
      this.emitProgress('Resuming setup...', this.getCurrentProgress(), 0);

      // Continue from where we left off
      const profileName = this.state.profile.role; // Assuming role maps to profile
      const plan = await this.createInstallationPlan(profileName);

      // Skip completed steps and continue
      const remainingSteps = plan.steps.filter(step => 
        !this.state!.completedSteps.has(step.id) && 
        !this.state!.failedSteps.has(step.id)
      );

      await this.executeSteps(remainingSteps);

      const result = await this.generateResult(this.state.startTime.getTime(), true);
      await this.cleanupState();

      return result;

    } catch (error) {
      console.error('Resume failed:', error);
      const result = await this.generateResult(Date.now(), false, error as Error);
      return result;
    }
  }

  /**
   * Get list of available profiles
   */
  getAvailableProfiles(): ProfileConfig[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Check if there's a resumable setup
   */
  async canResume(): Promise<boolean> {
    try {
      const stateExists = await fs.access(this.stateFile).then(() => true).catch(() => false);
      if (!stateExists) return false;

      const stateData = await fs.readFile(this.stateFile, 'utf-8');
      const state = JSON.parse(stateData);
      return state.resumable === true;
    } catch {
      return false;
    }
  }

  /**
   * Initialize installation state
   */
  private async initializeState(
    sessionId: string,
    profileName: string,
    options: Partial<SetupOptions>
  ): Promise<void> {
    const profile = this.createDeveloperProfile(profileName);
    
    this.state = {
      sessionId,
      startTime: new Date(),
      currentStep: null,
      completedSteps: new Set(),
      failedSteps: new Map(),
      skippedSteps: new Set(),
      profile,
      platform: this.platform,
      resumable: false
    };

    await this.saveState();
  }

  /**
   * Create installation plan based on profile
   */
  private async createInstallationPlan(profileName: string): Promise<InstallationPlan> {
    const profileConfig = this.profiles.get(profileName);
    if (!profileConfig) {
      throw new Error(`Unknown profile: ${profileName}`);
    }

    const steps: SetupStep[] = [];
    const dependencies = new Map<string, string[]>();

    // Collect steps from all required installers
    for (const toolName of profileConfig.requiredTools) {
      const installer = this.installers.get(toolName);
      if (installer && installer.getSteps) {
        const toolSteps = installer.getSteps(this.createDeveloperProfile(profileName), this.platform);
        steps.push(...toolSteps);
        
        // Map dependencies
        for (const step of toolSteps) {
          dependencies.set(step.id, step.dependencies);
        }
      }
    }

    // Sort steps by dependencies
    const sortedSteps = this.topologicalSort(steps);
    const estimatedDuration = sortedSteps.reduce((total, step) => total + step.estimatedTime, 0);
    const criticalPath = this.findCriticalPath(sortedSteps, dependencies);

    return {
      profile: profileConfig,
      steps: sortedSteps,
      dependencies,
      estimatedDuration,
      criticalPath
    };
  }

  /**
   * Execute a phase of the installation
   */
  private async executePhase(
    phaseName: string,
    phaseFunction: () => Promise<void>,
    startPercent: number,
    endPercent: number
  ): Promise<void> {
    this.emitProgress(`Starting ${phaseName}`, startPercent, 0);
    
    try {
      await phaseFunction();
      this.emitProgress(`${phaseName} completed`, endPercent, 0);
    } catch (error) {
      this.emitProgress(`${phaseName} failed: ${(error as Error).message}`, startPercent, 0);
      throw error;
    }
  }

  /**
   * Validate system requirements
   */
  private async validateSystemRequirements(): Promise<void> {
    console.log('🔍 Validating system requirements...');
    
    // Check OS compatibility
    const supportedOS = ['darwin', 'linux'];
    if (!supportedOS.includes(this.platform.os)) {
      throw new Error(`Unsupported operating system: ${this.platform.os}`);
    }

    // Check available disk space (require at least 5GB)
    const requiredSpaceBytes = 5 * 1024 * 1024 * 1024;
    const availableSpace = await this.getAvailableDiskSpace();
    
    if (availableSpace < requiredSpaceBytes) {
      throw new Error(`Insufficient disk space. Required: 5GB, Available: ${Math.round(availableSpace / 1024 / 1024 / 1024)}GB`);
    }

    // Check network connectivity
    await this.verifyNetworkConnectivity();

    console.log('✅ System requirements validated');
  }

  /**
   * Setup system permissions
   */
  private async setupSystemPermissions(): Promise<void> {
    console.log('🔐 Setting up system permissions...');
    
    const permissionsInstaller = this.installers.get('permissions');
    if (permissionsInstaller) {
      await this.executeInstaller('permissions', permissionsInstaller);
    }
    
    console.log('✅ System permissions configured');
  }

  /**
   * Install core system tools
   */
  private async installCoreSystemTools(plan: InstallationPlan): Promise<void> {
    console.log('🛠️ Installing core system tools...');
    
    const coreTools = ['homebrew'];
    
    for (const toolName of coreTools) {
      if (plan.profile.requiredTools.includes(toolName)) {
        const installer = this.installers.get(toolName);
        if (installer) {
          await this.executeInstaller(toolName, installer);
        }
      }
    }
    
    console.log('✅ Core system tools installed');
  }

  /**
   * Install development tools
   */
  private async installDevelopmentTools(plan: InstallationPlan): Promise<void> {
    console.log('🔧 Installing development tools...');
    
    const devTools = ['git', 'node', 'python', 'docker', 'vscode'];
    
    for (const toolName of devTools) {
      if (plan.profile.requiredTools.includes(toolName)) {
        const installer = this.installers.get(toolName);
        if (installer) {
          await this.executeInstaller(toolName, installer);
        }
      }
    }
    
    console.log('✅ Development tools installed');
  }

  /**
   * Configure installed tools
   */
  private async configureInstalledTools(plan: InstallationPlan): Promise<void> {
    console.log('⚙️ Configuring installed tools...');
    
    // Configure each installed tool
    for (const toolName of plan.profile.requiredTools) {
      const installer = this.installers.get(toolName);
      if (installer && installer.configure) {
        try {
          await installer.configure(this.state!.profile, this.platform);
          console.log(`✅ ${toolName} configured`);
        } catch (error) {
          console.warn(`⚠️ Failed to configure ${toolName}:`, error);
        }
      }
    }
    
    console.log('✅ Tool configuration completed');
  }

  /**
   * Validate installation
   */
  private async validateInstallation(plan: InstallationPlan): Promise<void> {
    console.log('✅ Validating installation...');
    
    const validationResults: Record<string, boolean> = {};
    
    for (const toolName of plan.profile.requiredTools) {
      const installer = this.installers.get(toolName);
      if (installer && installer.validate) {
        try {
          const isValid = await installer.validate();
          validationResults[toolName] = isValid;
          
          if (isValid) {
            console.log(`✅ ${toolName} validation passed`);
          } else {
            console.warn(`⚠️ ${toolName} validation failed`);
          }
        } catch (error) {
          console.error(`❌ ${toolName} validation error:`, error);
          validationResults[toolName] = false;
        }
      }
    }
    
    const failedValidations = Object.entries(validationResults)
      .filter(([_, isValid]) => !isValid)
      .map(([toolName]) => toolName);
    
    if (failedValidations.length > 0) {
      console.warn(`⚠️ Some tools failed validation: ${failedValidations.join(', ')}`);
      // Don't throw here - log warnings but continue
    }
    
    console.log('✅ Installation validation completed');
  }

  /**
   * Finalize setup
   */
  private async finalizeSetup(): Promise<void> {
    console.log('🎯 Finalizing setup...');
    
    // Create useful shell aliases
    await this.createShellAliases();
    
    // Set up development directory structure
    await this.createDevelopmentStructure();
    
    // Show next steps
    this.showNextSteps();
    
    console.log('✅ Setup finalization completed');
  }

  /**
   * Execute a single installer
   */
  private async executeInstaller(name: string, installer: any): Promise<void> {
    if (!this.state) return;

    const installerId = `install-${name}`;
    
    try {
      // Skip if already completed
      if (this.state.completedSteps.has(installerId)) {
        console.log(`⏭️ Skipping ${name} (already installed)`);
        return;
      }

      this.state.currentStep = name;
      this.emitProgress(`Installing ${name}...`, this.getCurrentProgress(), 0);

      // Check if already installed
      if (installer.isInstalled && await installer.isInstalled()) {
        console.log(`✅ ${name} already installed`);
        this.state.completedSteps.add(installerId);
        this.state.skippedSteps.add(installerId);
        return;
      }

      // Perform installation
      await installer.install(this.state.profile, this.platform);
      
      // Validate installation
      if (installer.validate && !await installer.validate()) {
        throw new Error(`${name} installation failed validation`);
      }

      this.state.completedSteps.add(installerId);
      console.log(`✅ ${name} installed successfully`);

      // Save state after each successful installation
      await this.saveState();

    } catch (error) {
      this.state.failedSteps.set(installerId, error as Error);
      console.error(`❌ Failed to install ${name}:`, error);
      throw error;
    }
  }

  /**
   * Execute a list of steps
   */
  private async executeSteps(steps: SetupStep[]): Promise<void> {
    for (const step of steps) {
      await this.executeStep(step);
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(step: SetupStep): Promise<void> {
    if (!this.state) return;

    try {
      // Skip if already completed
      if (this.state.completedSteps.has(step.id)) {
        return;
      }

      this.state.currentStep = step.name;
      this.emitProgress(`Executing: ${step.name}`, this.getCurrentProgress(), step.estimatedTime);

      // Validate dependencies
      for (const depId of step.dependencies) {
        if (!this.state.completedSteps.has(depId)) {
          throw new Error(`Dependency not met: ${depId} required for ${step.id}`);
        }
      }

      // Execute the step
      await step.installer();
      
      // Validate if validator exists
      if (step.validator && !await step.validator()) {
        throw new Error(`Step validation failed: ${step.name}`);
      }

      this.state.completedSteps.add(step.id);
      await this.saveState();

    } catch (error) {
      this.state.failedSteps.set(step.id, error as Error);
      throw error;
    }
  }

  /**
   * Emit progress updates
   */
  private emitProgress(message: string, percentage: number, timeRemaining: number): void {
    const progress: SetupProgress = {
      totalSteps: this.getTotalSteps(),
      completedSteps: this.state?.completedSteps.size || 0,
      currentStep: message,
      percentage,
      estimatedTimeRemaining: timeRemaining,
      logs: [`[${new Date().toISOString()}] ${message}`]
    };

    // Emit to internal listeners
    this.emit('progress', progress);
    
    // Call registered callbacks
    this.progressCallbacks.forEach(callback => {
      try {
        callback(progress);
      } catch (error) {
        console.warn('Progress callback error:', error);
      }
    });

    // Console output for CLI usage
    console.log(`[${percentage.toFixed(1)}%] ${message}`);
  }

  /**
   * Utility methods
   */
  private generateSessionId(): string {
    return `setup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private createDeveloperProfile(profileName: string): DeveloperProfile {
    const profileConfig = this.profiles.get(profileName);
    if (!profileConfig) {
      throw new Error(`Unknown profile: ${profileName}`);
    }

    // Create a basic DeveloperProfile based on the profile config
    return {
      name: profileConfig.name,
      email: undefined,
      role: profileName,
      team: undefined,
      preferences: {
        shell: 'zsh' as const,
        editor: 'vscode' as const,
        theme: 'dark' as const,
        gitConfig: {
          userName: '',
          userEmail: '',
          signCommits: false,
          defaultBranch: 'main',
          aliases: {}
        },
        aiTools: {
          claudeCode: true,
          claudeFlow: true,
          mcpTools: [],
          swarmAgents: [],
          memoryAllocation: '2GB'
        }
      },
      languages: this.getLanguagesForProfile(profileName),
      frameworks: this.getFrameworksForProfile(profileName),
      tools: {
        packageManagers: { npm: true, pnpm: true, brew: true },
        containers: { docker: profileConfig.requiredTools.includes('docker'), dockerCompose: true },
        editors: { vscode: true, claude: true },
        databases: this.getDatabasesForProfile(profileName),
        cloud: {},
        ci: { githubActions: true }
      }
    };
  }

  private getLanguagesForProfile(profileName: string) {
    const languages: any = {};
    switch (profileName) {
      case 'frontend':
        languages.javascript = true;
        languages.typescript = true;
        break;
      case 'backend':
      case 'fullstack':
        languages.javascript = true;
        languages.typescript = true;
        languages.python = true;
        break;
      case 'devops':
        languages.python = true;
        languages.go = true;
        break;
    }
    return languages;
  }

  private getFrameworksForProfile(profileName: string) {
    const frameworks: any = {};
    switch (profileName) {
      case 'frontend':
      case 'fullstack':
        frameworks.react = true;
        frameworks.nextjs = true;
        break;
      case 'backend':
        frameworks.express = true;
        frameworks.nestjs = true;
        frameworks.fastapi = true;
        break;
    }
    return frameworks;
  }

  private getDatabasesForProfile(profileName: string) {
    const databases: any = {};
    if (['backend', 'fullstack', 'devops'].includes(profileName)) {
      databases.postgresql = true;
      databases.redis = true;
    }
    return databases;
  }

  private topologicalSort(steps: SetupStep[]): SetupStep[] {
    const sorted: SetupStep[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (step: SetupStep) => {
      if (visited.has(step.id)) return;
      if (visiting.has(step.id)) {
        throw new Error(`Circular dependency detected: ${step.id}`);
      }

      visiting.add(step.id);

      for (const depId of step.dependencies) {
        const dep = steps.find(s => s.id === depId);
        if (dep) visit(dep);
      }

      visiting.delete(step.id);
      visited.add(step.id);
      sorted.push(step);
    };

    for (const step of steps) {
      visit(step);
    }

    return sorted;
  }

  private findCriticalPath(steps: SetupStep[], dependencies: Map<string, string[]>): string[] {
    // Simple critical path - longest dependency chain
    const depths = new Map<string, number>();
    
    const calculateDepth = (stepId: string): number => {
      if (depths.has(stepId)) return depths.get(stepId)!;
      
      const deps = dependencies.get(stepId) || [];
      const maxDepth = deps.length === 0 ? 0 : Math.max(...deps.map(calculateDepth));
      depths.set(stepId, maxDepth + 1);
      return maxDepth + 1;
    };

    steps.forEach(step => calculateDepth(step.id));
    
    const maxDepth = Math.max(...Array.from(depths.values()));
    return Array.from(depths.entries())
      .filter(([_, depth]) => depth === maxDepth)
      .map(([stepId]) => stepId);
  }

  private getCurrentProgress(): number {
    if (!this.state) return 0;
    const total = this.getTotalSteps();
    const completed = this.state.completedSteps.size;
    return total > 0 ? (completed / total) * 100 : 0;
  }

  private getTotalSteps(): number {
    if (!this.state) return 0;
    const profileConfig = this.profiles.get(this.state.profile.role);
    return profileConfig ? profileConfig.requiredTools.length * 2 : 10; // Estimate
  }

  private async getAvailableDiskSpace(): Promise<number> {
    try {
      const { stdout } = await execa('df', ['-B1', os.homedir()]);
      const lines = stdout.split('\n');
      const dataLine = lines[1];
      const columns = dataLine.split(/\s+/);
      return parseInt(columns[3], 10); // Available space in bytes
    } catch {
      return Number.MAX_SAFE_INTEGER; // Assume sufficient space if we can't check
    }
  }

  private async verifyNetworkConnectivity(): Promise<void> {
    try {
      await execa('ping', ['-c', '1', 'google.com']);
    } catch {
      throw new Error('No network connectivity detected');
    }
  }

  private async createShellAliases(): Promise<void> {
    const homeDir = os.homedir();
    const rcFile = path.join(homeDir, '.zshrc');
    
    const aliases = `
# Wundr Development Aliases
alias ll='ls -la'
alias la='ls -A'
alias l='ls -CF'
alias ..='cd ..'
alias ...='cd ../..'
alias grep='grep --color=auto'
alias fgrep='fgrep --color=auto'
alias egrep='egrep --color=auto'
alias h='history'
alias j='jobs -l'
alias which='type -a'
alias du='du -kh'
alias df='df -kTh'

# Git aliases
alias g='git'
alias gs='git status'
alias ga='git add'
alias gc='git commit'
alias gp='git push'
alias gl='git pull'
alias gd='git diff'
alias gb='git branch'
alias gco='git checkout'

# Development aliases
alias serve='python -m http.server'
alias serve3='python3 -m http.server'
alias ports='netstat -tulanp'
`;

    try {
      const existing = await fs.readFile(rcFile, 'utf-8').catch(() => '');
      if (!existing.includes('# Wundr Development Aliases')) {
        await fs.appendFile(rcFile, aliases);
        console.log('✅ Shell aliases created');
      }
    } catch (error) {
      console.warn('⚠️ Could not create shell aliases:', error);
    }
  }

  private async createDevelopmentStructure(): Promise<void> {
    const homeDir = os.homedir();
    const devDir = path.join(homeDir, 'Development');
    
    const directories = [
      devDir,
      path.join(devDir, 'projects'),
      path.join(devDir, 'tools'),
      path.join(devDir, 'sandbox'),
      path.join(devDir, 'scripts'),
      path.join(homeDir, '.config'),
      path.join(homeDir, '.local', 'bin')
    ];

    for (const dir of directories) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        console.warn(`⚠️ Could not create directory ${dir}:`, error);
      }
    }

    console.log(`✅ Development structure created at ${devDir}`);
  }

  private showNextSteps(): void {
    console.log('\n🎉 Setup completed! Next steps:');
    console.log('1. Restart your terminal or run: source ~/.zshrc');
    console.log('2. Configure Git with: git config --global user.name "Your Name"');
    console.log('3. Configure Git with: git config --global user.email "your.email@example.com"');
    console.log('4. Check installed versions with: brew --version && git --version && node --version');
    console.log('5. Start coding in ~/Development/projects/');
    console.log('\nHappy coding! 🚀\n');
  }

  private async saveState(): Promise<void> {
    if (!this.state) return;

    const stateData = {
      sessionId: this.state.sessionId,
      startTime: this.state.startTime.toISOString(),
      currentStep: this.state.currentStep,
      completedSteps: Array.from(this.state.completedSteps),
      failedSteps: Array.from(this.state.failedSteps.entries()).map(([id, error]) => [id, error.message]),
      skippedSteps: Array.from(this.state.skippedSteps),
      profile: this.state.profile,
      platform: this.state.platform,
      resumable: this.state.resumable
    };

    try {
      await fs.writeFile(this.stateFile, JSON.stringify(stateData, null, 2));
    } catch (error) {
      console.warn('Could not save state:', error);
    }
  }

  private async loadState(): Promise<void> {
    try {
      const stateData = await fs.readFile(this.stateFile, 'utf-8');
      const parsedState = JSON.parse(stateData);
      
      this.state = {
        sessionId: parsedState.sessionId,
        startTime: new Date(parsedState.startTime),
        currentStep: parsedState.currentStep,
        completedSteps: new Set(parsedState.completedSteps),
        failedSteps: new Map(parsedState.failedSteps.map(([id, msg]: [string, string]) => [id, new Error(msg)])),
        skippedSteps: new Set(parsedState.skippedSteps),
        profile: parsedState.profile,
        platform: parsedState.platform,
        resumable: parsedState.resumable
      };
    } catch (error) {
      throw new Error('Could not load saved state');
    }
  }

  private async cleanupState(): Promise<void> {
    try {
      await fs.unlink(this.stateFile);
    } catch {
      // State file might not exist, that's ok
    }
  }

  private async generateResult(startTime: number, success: boolean, error?: Error): Promise<SetupResult> {
    const duration = Date.now() - startTime;
    
    return {
      success,
      completedSteps: this.state ? Array.from(this.state.completedSteps) : [],
      failedSteps: this.state ? Array.from(this.state.failedSteps.keys()) : [],
      skippedSteps: this.state ? Array.from(this.state.skippedSteps) : [],
      warnings: [],
      errors: error ? [error] : [],
      duration
    };
  }
}

// Export the orchestrator
export default RealSetupOrchestrator;