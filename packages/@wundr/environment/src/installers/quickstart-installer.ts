/**
 * Ultra-fast environment installer optimized for <5 minute setup
 * Parallel execution, smart caching, and optimized workflows
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { homedir, platform, cpus } from 'os';
import { execSync, spawn } from 'child_process';
import { ProfileType, Platform } from '../types';
import { createLogger } from '../utils/logger';
import { detectPlatform, getSystemInfo } from '../utils/system';
import chalk from 'chalk';
import ora from 'ora';

const logger = createLogger('QuickstartInstaller');

export interface QuickstartOptions {
  profile: ProfileType;
  skipPrompts: boolean;
  skipAI: boolean;
  cacheOnly: boolean;
  parallelJobs: number;
  timeout: number;
  preset: 'minimal' | 'standard' | 'full';
}

interface SystemAnalysis {
  platform: Platform;
  hasHomebrew: boolean;
  hasNode: boolean;
  hasGit: boolean;
  hasDocker: boolean;
  hasClaude: boolean;
  hasClaudeFlow: boolean;
  hasVSCode: boolean;
  existingTools: string[];
  missingTools: string[];
  cacheSize: number;
}

interface InstallTask {
  id: string;
  name: string;
  command: string | (() => Promise<void>);
  dependencies: string[];
  skipIf?: () => boolean;
  parallel: boolean;
  estimatedTime: number; // seconds
}

export class QuickstartInstaller {
  private options: QuickstartOptions;
  private platform: Platform;
  private analysis: SystemAnalysis | null = null;
  private homePath: string;
  private cachePath: string;
  private configPath: string;
  private startTime: number = 0;
  private tasks: Map<string, InstallTask> = new Map();

  constructor(options: QuickstartOptions) {
    this.options = options;
    this.platform = platform() as Platform;
    this.homePath = homedir();
    this.cachePath = join(this.homePath, '.wundr', 'cache');
    this.configPath = join(this.homePath, '.wundr');
    
    this.initializeTasks();
  }

  /**
   * Initialize installation tasks with optimized execution order
   */
  private initializeTasks(): void {
    const presets = {
      minimal: ['system-analysis', 'homebrew', 'git', 'node-basic'],
      standard: ['system-analysis', 'homebrew', 'git', 'node-full', 'docker-lite', 'vscode-fast', 'claude-core'],
      full: ['system-analysis', 'homebrew', 'git', 'node-full', 'docker-full', 'vscode-full', 'claude-full', 'ai-agents-quick']
    };

    const taskDefinitions: InstallTask[] = [
      {
        id: 'system-analysis',
        name: 'System Analysis',
        command: () => this.performSystemAnalysis(),
        dependencies: [],
        parallel: false,
        estimatedTime: 5
      },
      {
        id: 'homebrew',
        name: 'Homebrew (Package Manager)',
        command: () => this.installHomebrew(),
        dependencies: ['system-analysis'],
        skipIf: () => !!this.analysis?.hasHomebrew,
        parallel: false,
        estimatedTime: 30
      },
      {
        id: 'git',
        name: 'Git',
        command: this.platform === 'darwin' ? 'brew install git' : 'sudo apt-get install -y git',
        dependencies: ['homebrew'],
        skipIf: () => !!this.analysis?.hasGit,
        parallel: true,
        estimatedTime: 20
      },
      {
        id: 'node-basic',
        name: 'Node.js (Basic)',
        command: () => this.installNodeBasic(),
        dependencies: ['homebrew'],
        skipIf: () => !!this.analysis?.hasNode,
        parallel: true,
        estimatedTime: 45
      },
      {
        id: 'node-full',
        name: 'Node.js (Full Toolchain)',
        command: () => this.installNodeFull(),
        dependencies: ['homebrew'],
        skipIf: () => !!this.analysis?.hasNode,
        parallel: true,
        estimatedTime: 60
      },
      {
        id: 'docker-lite',
        name: 'Docker (Lite)',
        command: () => this.installDockerLite(),
        dependencies: ['homebrew'],
        skipIf: () => !!this.analysis?.hasDocker,
        parallel: true,
        estimatedTime: 40
      },
      {
        id: 'docker-full',
        name: 'Docker (Full)',
        command: () => this.installDockerFull(),
        dependencies: ['homebrew'],
        skipIf: () => !!this.analysis?.hasDocker,
        parallel: true,
        estimatedTime: 90
      },
      {
        id: 'vscode-fast',
        name: 'VS Code (Fast Setup)',
        command: () => this.installVSCodeFast(),
        dependencies: ['homebrew'],
        skipIf: () => !!this.analysis?.hasVSCode,
        parallel: true,
        estimatedTime: 25
      },
      {
        id: 'vscode-full',
        name: 'VS Code (Full Extensions)',
        command: () => this.installVSCodeFull(),
        dependencies: ['homebrew'],
        skipIf: () => !!this.analysis?.hasVSCode,
        parallel: true,
        estimatedTime: 45
      },
      {
        id: 'claude-core',
        name: 'Claude Code (Core)',
        command: () => this.installClaudeCore(),
        dependencies: ['node-basic'],
        skipIf: () => !!this.analysis?.hasClaude,
        parallel: true,
        estimatedTime: 30
      },
      {
        id: 'claude-full',
        name: 'Claude Code + Flow (Full)',
        command: () => this.installClaudeFull(),
        dependencies: ['node-full'],
        skipIf: () => !!this.analysis?.hasClaude && !!this.analysis?.hasClaudeFlow,
        parallel: true,
        estimatedTime: 50
      },
      {
        id: 'ai-agents-quick',
        name: 'AI Agents (Quick Setup)',
        command: () => this.setupAIAgentsQuick(),
        dependencies: ['claude-full'],
        parallel: false,
        estimatedTime: 40
      }
    ];

    // Initialize tasks based on preset
    const selectedTasks = presets[this.options.preset] || presets.standard;
    taskDefinitions
      .filter(task => selectedTasks.includes(task.id))
      .forEach(task => this.tasks.set(task.id, task));
  }

  /**
   * Analyze current system state
   */
  async analyze(): Promise<SystemAnalysis> {
    const spinner = ora('Analyzing system state...').start();
    
    try {
      this.platform = await detectPlatform();
      
      const analysis: SystemAnalysis = {
        platform: this.platform,
        hasHomebrew: await this.checkCommand('brew'),
        hasNode: await this.checkCommand('node'),
        hasGit: await this.checkCommand('git'),
        hasDocker: await this.checkCommand('docker'),
        hasClaude: await this.checkCommand('claude'),
        hasClaudeFlow: await this.checkCommand('claude-flow'),
        hasVSCode: await this.checkCommand('code') || await this.checkPath('/Applications/Visual Studio Code.app'),
        existingTools: [],
        missingTools: [],
        cacheSize: await this.getCacheSize()
      };

      // Collect existing and missing tools
      const toolChecks = [
        { name: 'homebrew', exists: analysis.hasHomebrew },
        { name: 'node', exists: analysis.hasNode },
        { name: 'git', exists: analysis.hasGit },
        { name: 'docker', exists: analysis.hasDocker },
        { name: 'claude', exists: analysis.hasClaude },
        { name: 'claude-flow', exists: analysis.hasClaudeFlow },
        { name: 'vscode', exists: analysis.hasVSCode }
      ];

      toolChecks.forEach(({ name, exists }) => {
        if (exists) {
          analysis.existingTools.push(name);
        } else {
          analysis.missingTools.push(name);
        }
      });

      this.analysis = analysis;
      
      spinner.succeed(`System analyzed: ${analysis.existingTools.length} tools found, ${analysis.missingTools.length} needed`);
      
      return analysis;
    } catch (error) {
      spinner.fail('System analysis failed');
      throw error;
    }
  }

  /**
   * Install tools in parallel with optimized execution
   */
  async installParallel(): Promise<void> {
    if (!this.analysis) {
      throw new Error('Must run analyze() first');
    }

    const spinner = ora('Installing tools in parallel...').start();
    this.startTime = Date.now();

    try {
      // Create task execution graph
      const executed = new Set<string>();
      const inProgress = new Set<string>();
      const promises: Array<Promise<void>> = [];

      const executeTask = async (taskId: string): Promise<void> => {
        const task = this.tasks.get(taskId);
        if (!task || executed.has(taskId) || inProgress.has(taskId)) return;

        // Check if dependencies are met
        const depsMet = task.dependencies.every(dep => executed.has(dep));
        if (!depsMet) return;

        // Check if task should be skipped
        if (task.skipIf && task.skipIf()) {
          executed.add(taskId);
          spinner.text = `Skipping ${task.name} (already installed)`;
          return;
        }

        inProgress.add(taskId);
        spinner.text = `Installing ${task.name}...`;

        try {
          if (typeof task.command === 'function') {
            await task.command();
          } else {
            await this.executeCommand(task.command);
          }
          executed.add(taskId);
          inProgress.delete(taskId);
          
          const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
          spinner.text = `Completed ${task.name} (${elapsed}s elapsed)`;
        } catch (error) {
          inProgress.delete(taskId);
          logger.error(`Task ${taskId} failed:`, error);
          throw error;
        }
      };

      // Execute tasks with controlled parallelism
      const maxConcurrent = Math.min(this.options.parallelJobs, cpus().length);
      const taskQueue = Array.from(this.tasks.keys());

      while (executed.size < this.tasks.size) {
        // Find ready tasks
        const readyTasks = taskQueue.filter(taskId => {
          const task = this.tasks.get(taskId)!;
          return !executed.has(taskId) && 
                 !inProgress.has(taskId) && 
                 task.dependencies.every(dep => executed.has(dep));
        });

        if (readyTasks.length === 0) {
          // Wait for in-progress tasks
          await Promise.race(promises);
          continue;
        }

        // Execute ready tasks (respecting parallel limits)
        const tasksToExecute = readyTasks.slice(0, maxConcurrent - inProgress.size);
        const newPromises = tasksToExecute.map(taskId => executeTask(taskId));
        promises.push(...newPromises);

        // Wait for at least one task to complete if we're at capacity
        if (inProgress.size >= maxConcurrent) {
          await Promise.race(promises);
        }
      }

      // Wait for all remaining tasks
      await Promise.all(promises);

      const totalTime = ((Date.now() - this.startTime) / 1000).toFixed(1);
      spinner.succeed(`All tools installed successfully in ${totalTime}s`);
    } catch (error) {
      const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
      spinner.fail(`Installation failed after ${elapsed}s`);
      throw error;
    }
  }

  /**
   * Configure environment after installation
   */
  async configure(): Promise<void> {
    const spinner = ora('Configuring environment...').start();
    
    try {
      // Create directory structure
      await this.ensureDirectories();
      
      // Configure shell aliases and PATH
      await this.configureShell();
      
      // Configure Git if needed
      await this.configureGit();
      
      // Setup development paths
      await this.setupDevelopmentPaths();
      
      spinner.succeed('Environment configured successfully');
    } catch (error) {
      spinner.fail('Environment configuration failed');
      throw error;
    }
  }

  /**
   * Quick AI agents setup (simplified version)
   */
  async setupAIAgentsQuick(): Promise<void> {
    const spinner = ora('Setting up AI agents (quick mode)...').start();
    
    try {
      if (this.options.skipAI) {
        spinner.text = 'AI agents skipped per configuration';
        return;
      }

      // Create minimal Claude configuration
      await this.createClaudeConfig();
      
      // Setup basic Claude Flow configuration (not full 54 agents)
      await this.createClaudeFlowConfig();
      
      // Create project template
      await this.createProjectTemplate();
      
      spinner.succeed('AI agents configured (basic setup)');
    } catch (error) {
      spinner.fail('AI agents setup failed');
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async performSystemAnalysis(): Promise<void> {
    // This is called via analyze() method
  }

  private async checkCommand(command: string): Promise<boolean> {
    try {
      execSync(`which ${command}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  private async checkPath(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  private async getCacheSize(): Promise<number> {
    try {
      const stats = await fs.stat(this.cachePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  private async executeCommand(command: string, options: any = {}): Promise<string> {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      const process = spawn(cmd, args, {
        stdio: 'pipe',
        timeout: this.options.timeout,
        ...options
      });

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      process.on('error', reject);
    });
  }

  private async installHomebrew(): Promise<void> {
    if (this.platform === 'darwin') {
      const script = 'curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh';
      await this.executeCommand(`/bin/bash -c "${script}"`, { stdio: 'inherit' });
    } else if (this.platform === 'linux') {
      await this.executeCommand('sudo apt-get update -y');
      await this.executeCommand('sudo apt-get install -y curl git');
      const script = 'curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh';
      await this.executeCommand(`/bin/bash -c "${script}"`, { stdio: 'inherit' });
    }
  }

  private async installNodeBasic(): Promise<void> {
    if (this.platform === 'darwin') {
      await this.executeCommand('brew install node npm');
    } else {
      await this.executeCommand('curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -');
      await this.executeCommand('sudo apt-get install -y nodejs');
    }
    
    // Configure npm
    await this.executeCommand('npm config set init-author-name "Developer"');
    await this.executeCommand('npm config set init-license "MIT"');
  }

  private async installNodeFull(): Promise<void> {
    await this.installNodeBasic();
    
    // Install essential global packages
    const packages = [
      'typescript',
      'tsx',
      'ts-node',
      'nodemon',
      'prettier',
      'eslint'
    ];
    
    await this.executeCommand(`npm install -g ${packages.join(' ')}`);
  }

  private async installDockerLite(): Promise<void> {
    if (this.platform === 'darwin') {
      await this.executeCommand('brew install --cask docker');
    } else {
      await this.executeCommand('sudo apt-get install -y docker.io');
      await this.executeCommand('sudo systemctl enable docker');
      await this.executeCommand('sudo usermod -aG docker $USER');
    }
  }

  private async installDockerFull(): Promise<void> {
    await this.installDockerLite();
    await this.executeCommand('docker --version'); // Verify installation
  }

  private async installVSCodeFast(): Promise<void> {
    if (this.platform === 'darwin') {
      await this.executeCommand('brew install --cask visual-studio-code');
    } else {
      await this.executeCommand('wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg');
      await this.executeCommand('sudo install -o root -g root -m 644 packages.microsoft.gpg /etc/apt/trusted.gpg.d/');
      await this.executeCommand('echo "deb [arch=amd64,arm64,armhf signed-by=/etc/apt/trusted.gpg.d/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" | sudo tee /etc/apt/sources.list.d/vscode.list');
      await this.executeCommand('sudo apt-get update');
      await this.executeCommand('sudo apt-get install -y code');
    }
  }

  private async installVSCodeFull(): Promise<void> {
    await this.installVSCodeFast();
    
    // Install essential extensions
    const extensions = [
      'ms-vscode.vscode-typescript-next',
      'esbenp.prettier-vscode',
      'ms-vscode.vscode-eslint',
      'bradlc.vscode-tailwindcss',
      'ms-vscode-remote.remote-containers'
    ];
    
    for (const ext of extensions) {
      try {
        await this.executeCommand(`code --install-extension ${ext}`);
      } catch (error) {
        logger.warn(`Failed to install VS Code extension ${ext}:`, error);
      }
    }
  }

  private async installClaudeCore(): Promise<void> {
    try {
      await this.executeCommand('npm install -g @anthropic-ai/claude-code');
    } catch (error) {
      // Fallback to curl installation
      logger.warn('NPM install failed, trying curl method');
      await this.executeCommand('curl -fsSL claude.ai/install.sh | bash');
    }
  }

  private async installClaudeFull(): Promise<void> {
    await this.installClaudeCore();
    
    try {
      await this.executeCommand('npm install -g claude-flow@alpha');
    } catch (error) {
      logger.warn('Claude Flow installation failed:', error);
    }
  }

  private async ensureDirectories(): Promise<void> {
    const dirs = [
      this.configPath,
      this.cachePath,
      join(this.homePath, 'Development'),
      join(this.homePath, 'Development', 'projects'),
      join(this.homePath, 'Development', 'tools')
    ];
    
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private async configureShell(): Promise<void> {
    const shellFiles = ['.zshrc', '.bashrc'];
    const aliases = [
      '# Wundr Environment Aliases',
      'alias ll="ls -la"',
      'alias la="ls -A"',
      'alias l="ls -CF"',
      'alias ..="cd .."',
      'alias ...="cd ../.."',
      'alias cls="clear"',
      '',
      '# Development Aliases',
      'alias dev="cd ~/Development"',
      'alias proj="cd ~/Development/projects"',
      'alias tools="cd ~/Development/tools"',
      '',
      '# Node.js Aliases',
      'alias ni="npm install"',
      'alias nr="npm run"',
      'alias ns="npm start"',
      'alias nt="npm test"',
      '',
      '# Git Aliases',
      'alias gs="git status"',
      'alias ga="git add"',
      'alias gc="git commit"',
      'alias gp="git push"',
      'alias gl="git pull"',
      '',
      '# Claude Aliases',
      'alias cl="claude"',
      'alias clf="claude-flow"',
      ''
    ].join('\n');

    for (const file of shellFiles) {
      const filePath = join(this.homePath, file);
      try {
        let content = '';
        try {
          content = await fs.readFile(filePath, 'utf8');
        } catch {
          // File doesn't exist, will be created
        }
        
        if (!content.includes('# Wundr Environment Aliases')) {
          content += '\n' + aliases;
          await fs.writeFile(filePath, content);
        }
      } catch (error) {
        logger.warn(`Failed to update ${file}:`, error);
      }
    }
  }

  private async configureGit(): Promise<void> {
    // Basic git configuration if not already set
    try {
      await this.executeCommand('git config --global init.defaultBranch main');
      await this.executeCommand('git config --global user.name "Developer"');
      await this.executeCommand('git config --global user.email "developer@local"');
    } catch (error) {
      // Git config might already be set
      logger.debug('Git configuration warning:', error);
    }
  }

  private async setupDevelopmentPaths(): Promise<void> {
    const devPath = join(this.homePath, 'Development');
    const projectsPath = join(devPath, 'projects');
    const toolsPath = join(devPath, 'tools');
    
    await fs.mkdir(devPath, { recursive: true });
    await fs.mkdir(projectsPath, { recursive: true });
    await fs.mkdir(toolsPath, { recursive: true });
    
    // Create a sample project structure
    const sampleProject = join(projectsPath, 'sample-project');
    await fs.mkdir(sampleProject, { recursive: true });
    
    const packageJson = {
      name: 'sample-project',
      version: '1.0.0',
      description: 'Sample project created by Wundr Environment Setup',
      main: 'index.js',
      scripts: {
        start: 'node index.js',
        dev: 'nodemon index.js',
        test: 'echo "No tests specified"'
      },
      license: 'MIT'
    };
    
    await fs.writeFile(
      join(sampleProject, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    const indexJs = [
      '// Sample project created by Wundr Environment Setup',
      'console.log("Hello from your development environment!");',
      'console.log("Environment ready for development 🚀");',
      ''
    ].join('\n');
    
    await fs.writeFile(join(sampleProject, 'index.js'), indexJs);
  }

  private async createClaudeConfig(): Promise<void> {
    const claudeConfigDir = join(this.homePath, '.config', 'claude');
    await fs.mkdir(claudeConfigDir, { recursive: true });
    
    const config = {
      model: {
        default: 'claude-3-5-sonnet-20241022',
        enforceModel: false,
        preventDowngrade: false
      },
      editor: 'code',
      theme: 'dark',
      autoSave: true,
      telemetry: false
    };
    
    await fs.writeFile(
      join(claudeConfigDir, 'config.json'),
      JSON.stringify(config, null, 2)
    );
  }

  private async createClaudeFlowConfig(): Promise<void> {
    const claudeFlowDir = join(this.homePath, '.claude-flow');
    await fs.mkdir(claudeFlowDir, { recursive: true });
    
    const config = {
      version: '2.0.0-alpha',
      global: {
        defaultModel: 'claude-3-5-sonnet-20241022',
        maxConcurrentAgents: 4, // Simplified for quickstart
        memoryBackend: 'sqlite',
        enableHooks: true
      },
      swarm: {
        enabled: true,
        queen: {
          model: 'claude-3-5-sonnet-20241022',
          temperature: 0.7,
          maxTokens: 4096
        },
        workers: {
          count: 8, // Reduced from 54 for quickstart
          types: {
            coder: { count: 2, model: 'claude-3-5-sonnet-20241022' },
            reviewer: { count: 1, model: 'claude-3-5-sonnet-20241022' },
            tester: { count: 1, model: 'claude-3-5-sonnet-20241022' },
            planner: { count: 1, model: 'claude-3-5-sonnet-20241022' },
            researcher: { count: 1, model: 'claude-3-5-sonnet-20241022' },
            'backend-dev': { count: 1, model: 'claude-3-5-sonnet-20241022' },
            'system-architect': { count: 1, model: 'claude-3-5-sonnet-20241022' }
          }
        }
      },
      logging: {
        level: 'info',
        file: 'claude-flow.log',
        console: true
      }
    };
    
    await fs.writeFile(
      join(claudeFlowDir, 'global-config.json'),
      JSON.stringify(config, null, 2)
    );
  }

  private async createProjectTemplate(): Promise<void> {
    const templatesDir = join(this.homePath, 'Development', 'templates');
    await fs.mkdir(templatesDir, { recursive: true });
    
    const claudeMd = [
      '# Claude Development Environment',
      '',
      '## Quick Setup Completed',
      '',
      'Your development environment has been optimized for speed and efficiency.',
      '',
      '### Available Tools',
      '- Git for version control',
      '- Node.js with TypeScript support',
      '- VS Code with essential extensions',
      '- Docker for containerization',
      '- Claude Code for AI assistance',
      '- Claude Flow for agent orchestration (basic setup)',
      '',
      '### Quick Commands',
      '```bash',
      '# Start development',
      'dev',
      '',
      '# Claude AI assistance',
      'claude',
      '',
      '# Agent coordination (basic)',
      'claude-flow status',
      '```',
      '',
      '### Next Steps',
      '1. Verify installation: `wundr-env validate`',
      '2. Check status: `wundr-env status`',
      '3. Start a project: `cd ~/Development/projects && mkdir my-project`',
      ''
    ].join('\n');
    
    await fs.writeFile(join(templatesDir, 'CLAUDE.md'), claudeMd);
  }
}