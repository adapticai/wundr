/**
 * Orchestrator Daemon Installer - Global Orchestrator Supervisor Daemon installation
 *
 * Installs the Orchestrator Daemon at the global level:
 * - ~/orchestrator-daemon/ - Orchestrator daemon runtime and configuration
 * - ~/.wundr/ - Global wundr configuration and resources
 *
 * The Orchestrator daemon is responsible for:
 * - Machine-level supervision and orchestration
 * - Spawning and managing Claude Code/Claude Flow sessions
 * - Interfacing with external integrations (Slack, Gmail, Google Drive, Twilio)
 * - Managing session archetypes and dynamic CLAUDE.md compilation
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { execa } from 'execa';

import { Logger } from '../utils/logger';

import type { SetupPlatform, SetupStep, DeveloperProfile } from '../types';

/**
 * Configuration for Orchestrator Daemon installation
 */
export interface OrchestratorDaemonConfig {
  /** Base directory for Orchestrator daemon (default: ~/orchestrator-daemon) */
  readonly orchestratorDaemonDir?: string;
  /** Global wundr config directory (default: ~/.wundr) */
  readonly wundrConfigDir?: string;
  /** Whether to enable Slack integration */
  readonly enableSlack?: boolean;
  /** Whether to enable Gmail integration */
  readonly enableGmail?: boolean;
  /** Whether to enable Google Drive integration */
  readonly enableGoogleDrive?: boolean;
  /** Whether to enable Twilio integration */
  readonly enableTwilio?: boolean;
  /** Maximum concurrent sessions */
  readonly maxConcurrentSessions?: number;
  /** Memory limit per session */
  readonly memoryLimitPerSession?: string;
}

/**
 * Result of Orchestrator Daemon installation
 */
export interface OrchestratorDaemonInstallResult {
  readonly success: boolean;
  readonly orchestratorDaemonPath: string;
  readonly wundrConfigPath: string;
  readonly installedResources: string[];
  readonly errors: Error[];
  readonly warnings: string[];
}

/**
 * Orchestrator Daemon Installer class
 */
export class OrchestratorDaemonInstaller extends EventEmitter {
  readonly name = 'orchestrator-daemon';
  private readonly logger: Logger;
  private readonly homeDir: string;
  private orchestratorDaemonDir: string;
  private wundrConfigDir: string;

  constructor(config: OrchestratorDaemonConfig = {}) {
    super();
    this.logger = new Logger({ name: 'OrchestratorDaemonInstaller' });
    this.homeDir = os.homedir();
    this.orchestratorDaemonDir = config.orchestratorDaemonDir || path.join(this.homeDir, 'orchestrator-daemon');
    this.wundrConfigDir = config.wundrConfigDir || path.join(this.homeDir, '.wundr');
  }

  /**
   * Check if Orchestrator daemon installation is supported on current platform
   */
  isSupported(platform: SetupPlatform): boolean {
    return ['darwin', 'linux'].includes(platform.os);
  }

  /**
   * Check if Orchestrator daemon is already installed
   */
  async isInstalled(): Promise<boolean> {
    try {
      const orchestratorCharterExists = await fs
        .access(path.join(this.orchestratorDaemonDir, 'orchestrator-charter.yaml'))
        .then(() => true)
        .catch(() => false);

      const wundrConfigExists = await fs
        .access(path.join(this.wundrConfigDir, 'config'))
        .then(() => true)
        .catch(() => false);

      return orchestratorCharterExists && wundrConfigExists;
    } catch {
      return false;
    }
  }

  /**
   * Get Orchestrator daemon version
   */
  async getVersion(): Promise<string | null> {
    try {
      const charterPath = path.join(this.orchestratorDaemonDir, 'orchestrator-charter.yaml');
      const charterContent = await fs.readFile(charterPath, 'utf-8');
      const versionMatch = charterContent.match(/version:\s*["']?([^"'\n]+)/);
      return versionMatch?.[1] || '1.0.0';
    } catch {
      return null;
    }
  }

  /**
   * Install Orchestrator daemon globally
   * Note: This returns void to comply with BaseInstaller interface.
   * Use installWithResult() to get detailed result information.
   */
  async install(
    _profile?: DeveloperProfile,
    _platform?: SetupPlatform,
  ): Promise<void> {
    const result = await this.installWithResult();
    if (!result.success) {
      throw new Error(
        result.errors.length > 0
          ? result.errors[0].message
          : 'Orchestrator Daemon installation failed',
      );
    }
  }

  /**
   * Install Orchestrator daemon globally with detailed result
   */
  async installWithResult(): Promise<OrchestratorDaemonInstallResult> {
    const installedResources: string[] = [];
    const errors: Error[] = [];
    const warnings: string[] = [];

    try {
      this.logger.info('Installing Orchestrator Daemon globally...');
      this.emit('progress', { step: 'Creating directories', percentage: 10 });

      // 1. Create directory structures
      await this.createDirectoryStructure();
      installedResources.push('directory-structure');

      this.emit('progress', { step: 'Copying Orchestrator daemon files', percentage: 25 });

      // 2. Copy Orchestrator daemon files
      await this.installOrchestratorDaemonFiles();
      installedResources.push('orchestrator-daemon-files');

      this.emit('progress', { step: 'Copying global wundr resources', percentage: 40 });

      // 3. Copy global wundr resources
      await this.installWundrResources();
      installedResources.push('wundr-resources');

      this.emit('progress', { step: 'Setting up integrations config', percentage: 60 });

      // 4. Setup integration configurations
      await this.setupIntegrationConfigs();
      installedResources.push('integration-configs');

      this.emit('progress', { step: 'Creating session manager templates', percentage: 75 });

      // 5. Setup session manager archetypes
      await this.setupSessionManagerArchetypes();
      installedResources.push('session-archetypes');

      this.emit('progress', { step: 'Setting up memory architecture', percentage: 85 });

      // 6. Setup memory architecture
      await this.setupMemoryArchitecture();
      installedResources.push('memory-architecture');

      this.emit('progress', { step: 'Finalizing installation', percentage: 95 });

      // 7. Set permissions
      await this.setPermissions();
      installedResources.push('permissions');

      this.emit('progress', { step: 'Installation complete', percentage: 100 });

      this.logger.info('Orchestrator Daemon installed successfully');

      return {
        success: true,
        orchestratorDaemonPath: this.orchestratorDaemonDir,
        wundrConfigPath: this.wundrConfigDir,
        installedResources,
        errors,
        warnings,
      };
    } catch (error) {
      this.logger.error('Orchestrator Daemon installation failed:', error);
      errors.push(error instanceof Error ? error : new Error(String(error)));

      return {
        success: false,
        orchestratorDaemonPath: this.orchestratorDaemonDir,
        wundrConfigPath: this.wundrConfigDir,
        installedResources,
        errors,
        warnings,
      };
    }
  }

  /**
   * Validate Orchestrator daemon installation
   */
  async validate(): Promise<boolean> {
    try {
      // Check Orchestrator daemon directory
      const vpDaemonExists = await fs
        .access(this.orchestratorDaemonDir)
        .then(() => true)
        .catch(() => false);

      if (!vpDaemonExists) {
        this.logger.warn('Orchestrator daemon directory not found');
        return false;
      }

      // Check Orchestrator charter
      const charterExists = await fs
        .access(path.join(this.orchestratorDaemonDir, 'orchestrator-charter.yaml'))
        .then(() => true)
        .catch(() => false);

      if (!charterExists) {
        this.logger.warn('Orchestrator charter not found');
        return false;
      }

      // Check wundr config directory
      const wundrExists = await fs
        .access(this.wundrConfigDir)
        .then(() => true)
        .catch(() => false);

      if (!wundrExists) {
        this.logger.warn('Wundr config directory not found');
        return false;
      }

      // Check essential subdirectories
      const requiredDirs = ['agents', 'commands', 'config', 'memory'];
      for (const dir of requiredDirs) {
        const dirExists = await fs
          .access(path.join(this.wundrConfigDir, dir))
          .then(() => true)
          .catch(() => false);

        if (!dirExists) {
          this.logger.warn(`Required directory ${dir} not found`);
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Validation failed:', error);
      return false;
    }
  }

  /**
   * Get installation steps for the orchestrator
   */
  getSteps(_profile: DeveloperProfile, _platform: SetupPlatform): SetupStep[] {
    return [
      {
        id: 'install-orchestrator-daemon',
        name: 'Install Orchestrator Daemon',
        description: 'Install Orchestrator Supervisor Daemon at global level',
        category: 'ai',
        required: true,
        dependencies: ['install-claude'],
        estimatedTime: 120,
        validator: () => this.validate(),
        installer: async () => {
          await this.install();
        },
      },
    ];
  }

  // Private methods

  /**
   * Create all required directory structures
   */
  private async createDirectoryStructure(): Promise<void> {
    const orchestratorDaemonDirs = [
      this.orchestratorDaemonDir,
      path.join(this.orchestratorDaemonDir, 'sessions'),
      path.join(this.orchestratorDaemonDir, 'logs'),
      path.join(this.orchestratorDaemonDir, 'integrations'),
    ];

    const wundrDirs = [
      this.wundrConfigDir,
      path.join(this.wundrConfigDir, 'agents'),
      path.join(this.wundrConfigDir, 'commands'),
      path.join(this.wundrConfigDir, 'conventions'),
      path.join(this.wundrConfigDir, 'config'),
      path.join(this.wundrConfigDir, 'governance'),
      path.join(this.wundrConfigDir, 'hooks'),
      path.join(this.wundrConfigDir, 'memory'),
      path.join(this.wundrConfigDir, 'schemas'),
      path.join(this.wundrConfigDir, 'scripts'),
      path.join(this.wundrConfigDir, 'templates'),
      path.join(this.wundrConfigDir, 'workflows'),
    ];

    for (const dir of [...orchestratorDaemonDirs, ...wundrDirs]) {
      await fs.mkdir(dir, { recursive: true });
      this.logger.debug(`Created directory: ${dir}`);
    }
  }

  /**
   * Install Orchestrator daemon specific files
   */
  private async installOrchestratorDaemonFiles(): Promise<void> {
    const resourcesDir = this.getResourcesDir();
    const orchestratorDaemonResourceDir = path.join(resourcesDir, 'orchestrator-daemon');

    try {
      // Copy orchestrator-charter.yaml
      const charterSrc = path.join(orchestratorDaemonResourceDir, 'orchestrator-charter.yaml');
      const charterDest = path.join(this.orchestratorDaemonDir, 'orchestrator-charter.yaml');

      const charterExists = await fs
        .access(charterSrc)
        .then(() => true)
        .catch(() => false);

      if (charterExists) {
        await fs.copyFile(charterSrc, charterDest);
        this.logger.info('Copied Orchestrator charter');
      } else {
        // Create default Orchestrator charter
        await this.createDefaultOrchestratorCharter();
      }

      // Create sessions index
      await fs.writeFile(
        path.join(this.orchestratorDaemonDir, 'sessions', 'index.json'),
        JSON.stringify({ sessions: [], lastUpdated: new Date().toISOString() }, null, 2),
      );
    } catch (error) {
      this.logger.error('Failed to install Orchestrator daemon files:', error);
      throw error;
    }
  }

  /**
   * Install global wundr resources
   */
  private async installWundrResources(): Promise<void> {
    const resourcesDir = this.getResourcesDir();

    // Copy each resource directory
    const resourceMappings = [
      { src: 'agents', dest: 'agents' },
      { src: 'commands', dest: 'commands' },
      { src: 'conventions', dest: 'conventions' },
      { src: 'config', dest: 'config' },
      { src: 'governance', dest: 'governance' },
      { src: 'hooks', dest: 'hooks' },
      { src: 'memory', dest: 'memory' },
      { src: 'schemas', dest: 'schemas' },
      { src: 'scripts', dest: 'scripts' },
      { src: 'templates', dest: 'templates' },
      { src: 'workflows', dest: 'workflows' },
    ];

    for (const mapping of resourceMappings) {
      const srcDir = path.join(resourcesDir, mapping.src);
      const destDir = path.join(this.wundrConfigDir, mapping.dest);

      try {
        const srcExists = await fs
          .access(srcDir)
          .then(() => true)
          .catch(() => false);

        if (srcExists) {
          await this.copyDirectory(srcDir, destDir);
          this.logger.debug(`Copied ${mapping.src} to ${destDir}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to copy ${mapping.src}: ${error}`);
      }
    }
  }

  /**
   * Setup integration configurations
   */
  private async setupIntegrationConfigs(): Promise<void> {
    const integrationsDir = path.join(this.orchestratorDaemonDir, 'integrations');

    // Slack integration template
    await fs.writeFile(
      path.join(integrationsDir, 'slack.config.json'),
      JSON.stringify(
        {
          enabled: false,
          botToken: '${SLACK_BOT_TOKEN}',
          appToken: '${SLACK_APP_TOKEN}',
          signingSecret: '${SLACK_SIGNING_SECRET}',
          channels: [],
          webhooks: [],
        },
        null,
        2,
      ),
    );

    // Gmail integration template
    await fs.writeFile(
      path.join(integrationsDir, 'gmail.config.json'),
      JSON.stringify(
        {
          enabled: false,
          clientId: '${GMAIL_CLIENT_ID}',
          clientSecret: '${GMAIL_CLIENT_SECRET}',
          refreshToken: '${GMAIL_REFRESH_TOKEN}',
          scopes: ['gmail.readonly', 'gmail.send'],
        },
        null,
        2,
      ),
    );

    // Google Drive integration template
    await fs.writeFile(
      path.join(integrationsDir, 'google-drive.config.json'),
      JSON.stringify(
        {
          enabled: false,
          clientId: '${GDRIVE_CLIENT_ID}',
          clientSecret: '${GDRIVE_CLIENT_SECRET}',
          refreshToken: '${GDRIVE_REFRESH_TOKEN}',
          rootFolderId: '',
        },
        null,
        2,
      ),
    );

    // Twilio integration template
    await fs.writeFile(
      path.join(integrationsDir, 'twilio.config.json'),
      JSON.stringify(
        {
          enabled: false,
          accountSid: '${TWILIO_ACCOUNT_SID}',
          authToken: '${TWILIO_AUTH_TOKEN}',
          phoneNumber: '',
        },
        null,
        2,
      ),
    );

    this.logger.info('Integration configuration templates created');
  }

  /**
   * Setup session manager archetypes
   */
  private async setupSessionManagerArchetypes(): Promise<void> {
    const archetypesDir = path.join(this.wundrConfigDir, 'archetypes');
    await fs.mkdir(archetypesDir, { recursive: true });

    interface SessionArchetype {
      name: string;
      description: string;
      defaultAgents: string[];
      tools: string[];
      memoryProfile: string;
      contextBudget: number;
    }

    const archetypes: Record<string, SessionArchetype> = {
      engineering: {
        name: 'Engineering Session',
        description: 'Session optimized for software development',
        defaultAgents: ['coder', 'reviewer', 'tester'],
        tools: ['git', 'node', 'docker', 'vscode'],
        memoryProfile: 'development',
        contextBudget: 100000,
      },
      legal: {
        name: 'Legal Session',
        description: 'Session optimized for legal document review',
        defaultAgents: ['researcher', 'reviewer'],
        tools: ['document-reader', 'search'],
        memoryProfile: 'document-analysis',
        contextBudget: 150000,
      },
      hr: {
        name: 'HR Session',
        description: 'Session for HR tasks and candidate evaluation',
        defaultAgents: ['researcher', 'planner'],
        tools: ['calendar', 'email', 'search'],
        memoryProfile: 'people-management',
        contextBudget: 80000,
      },
      marketing: {
        name: 'Marketing Session',
        description: 'Session for marketing content and analysis',
        defaultAgents: ['researcher', 'coder'],
        tools: ['analytics', 'social-media', 'design'],
        memoryProfile: 'creative',
        contextBudget: 100000,
      },
      custom: {
        name: 'Custom Session',
        description: 'Flexible session with user-defined configuration',
        defaultAgents: [],
        tools: [],
        memoryProfile: 'general',
        contextBudget: 100000,
      },
    };

    for (const [name, config] of Object.entries(archetypes)) {
      await fs.writeFile(
        path.join(archetypesDir, `${name}.archetype.json`),
        JSON.stringify(config, null, 2),
      );
    }

    this.logger.info('Session manager archetypes created');
  }

  /**
   * Setup memory architecture (MemGPT-inspired tiered memory)
   */
  private async setupMemoryArchitecture(): Promise<void> {
    const memoryDir = path.join(this.wundrConfigDir, 'memory');

    // Create memory tier directories
    const memoryTiers = ['scratchpad', 'episodic', 'semantic'];
    for (const tier of memoryTiers) {
      await fs.mkdir(path.join(memoryDir, tier), { recursive: true });
    }

    // Memory architecture configuration
    const memoryConfig = {
      version: '1.0.0',
      tiers: {
        scratchpad: {
          description: 'Working memory for current session context',
          maxSize: '50MB',
          ttl: '1h',
          persistence: 'session',
        },
        episodic: {
          description: 'Recent interaction history and session summaries',
          maxSize: '500MB',
          ttl: '7d',
          persistence: 'local',
        },
        semantic: {
          description: 'Long-term knowledge and learned patterns',
          maxSize: '2GB',
          ttl: 'permanent',
          persistence: 'local',
        },
      },
      compaction: {
        enabled: true,
        threshold: 0.8,
        strategy: 'summarize-and-archive',
      },
      retrieval: {
        strategy: 'recency-weighted-relevance',
        maxResults: 20,
        similarityThreshold: 0.7,
      },
    };

    await fs.writeFile(
      path.join(memoryDir, 'memory-config.json'),
      JSON.stringify(memoryConfig, null, 2),
    );

    this.logger.info('Memory architecture configured');
  }

  /**
   * Set appropriate permissions on installed files
   */
  private async setPermissions(): Promise<void> {
    try {
      // Make scripts executable
      const scriptsDir = path.join(this.wundrConfigDir, 'scripts');
      const scriptsExist = await fs
        .access(scriptsDir)
        .then(() => true)
        .catch(() => false);

      if (scriptsExist) {
        const scripts = await fs.readdir(scriptsDir);
        for (const script of scripts) {
          if (script.endsWith('.sh') || script.endsWith('.js')) {
            await execa('chmod', ['+x', path.join(scriptsDir, script)]);
          }
        }
      }

      // Make hooks executable
      const hooksDir = path.join(this.wundrConfigDir, 'hooks');
      const hooksExist = await fs
        .access(hooksDir)
        .then(() => true)
        .catch(() => false);

      if (hooksExist) {
        const hooks = await fs.readdir(hooksDir);
        for (const hook of hooks) {
          if (hook.endsWith('.sh')) {
            await execa('chmod', ['+x', path.join(hooksDir, hook)]);
          }
        }
      }
    } catch (error) {
      this.logger.warn('Failed to set some permissions:', error);
    }
  }

  /**
   * Create default Orchestrator charter if not exists in resources
   */
  private async createDefaultOrchestratorCharter(): Promise<void> {
    const charter = `# Orchestrator Supervisor Daemon Charter
# This file defines the responsibilities and constraints of the Orchestrator daemon

version: "1.0.0"
name: "Orchestrator Supervisor Daemon"
description: "Machine-level supervisor for managing Claude Code/Flow sessions"

responsibilities:
  - Spawn and manage Claude Code sessions
  - Spawn and manage Claude Flow swarm sessions
  - Coordinate between multiple active sessions
  - Manage external integrations (Slack, Gmail, etc.)
  - Monitor resource usage and enforce limits
  - Handle session handoffs and delegation
  - Maintain cross-session memory coherence

resource_limits:
  max_concurrent_sessions: 5
  memory_per_session: "4GB"
  total_memory_limit: "16GB"
  cpu_cores_per_session: 2

measurable_objectives:
  - session_spawn_time_p99: "5s"
  - memory_efficiency: ">80%"
  - session_success_rate: ">95%"
  - integration_uptime: ">99%"

safety_heuristics:
  - Never execute destructive operations without confirmation
  - Rate limit external API calls
  - Isolate sessions from each other
  - Log all significant operations
  - Fail gracefully on resource exhaustion

integrations:
  slack:
    enabled: false
    permissions: ["read", "write", "react"]
  gmail:
    enabled: false
    permissions: ["read", "send"]
  google_drive:
    enabled: false
    permissions: ["read", "write"]
  twilio:
    enabled: false
    permissions: ["send_sms"]

session_archetypes:
  - engineering
  - legal
  - hr
  - marketing
  - custom
`;

    await fs.writeFile(path.join(this.orchestratorDaemonDir, 'orchestrator-charter.yaml'), charter);
    this.logger.info('Created default Orchestrator charter');
  }

  /**
   * Get the resources directory path
   */
  private getResourcesDir(): string {
    // Navigate from src/installers to resources
    return path.resolve(__dirname, '../../resources');
  }

  /**
   * Recursively copy a directory
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });

    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
}

// Export singleton instance
export const vpDaemonInstaller = new OrchestratorDaemonInstaller();
export default vpDaemonInstaller;
