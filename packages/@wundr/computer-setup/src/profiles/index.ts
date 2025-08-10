/**
 * Profile Management for Developer Setup
 * Handles different developer profiles and their configurations
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager } from '@wundr/config';
// import { getLogger } from '@wundr/core'; // TODO: Fix core exports
const getLogger = (name: string) => console;
import { DeveloperProfile, ProfilePreferences, RequiredTools } from '../types';

const logger = getLogger('computer-setup:profiles');

export class ProfileManager {
  private profilesDir: string;
  private profiles: Map<string, DeveloperProfile> = new Map();

  constructor(private configManager: ConfigManager) {
    this.profilesDir = path.join(os.homedir(), '.wundr', 'profiles');
    this.ensureProfilesDirectory();
  }

  private async ensureProfilesDirectory(): Promise<void> {
    await fs.ensureDir(this.profilesDir);
  }

  /**
   * Load all profiles from disk
   */
  async loadProfiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.profilesDir);
      const profileFiles = files.filter(f => f.endsWith('.json'));

      for (const file of profileFiles) {
        const profilePath = path.join(this.profilesDir, file);
        const profile = await fs.readJson(profilePath);
        this.profiles.set(profile.name, profile);
      }

      logger.info(`Loaded ${this.profiles.size} profiles`);
    } catch (error) {
      logger.error('Failed to load profiles', error);
    }
  }

  /**
   * Get a specific profile by name
   */
  async getProfile(name: string): Promise<DeveloperProfile | null> {
    if (this.profiles.has(name)) {
      return this.profiles.get(name) || null;
    }

    // Try to load from disk
    const profilePath = path.join(this.profilesDir, `${name}.json`);
    if (await fs.pathExists(profilePath)) {
      const profile = await fs.readJson(profilePath);
      this.profiles.set(name, profile);
      return profile;
    }

    // Try predefined profiles
    return this.getPredefinedProfile(name);
  }

  /**
   * Save a profile to disk
   */
  async saveProfile(profile: DeveloperProfile): Promise<void> {
    const profilePath = path.join(this.profilesDir, `${profile.name}.json`);
    await fs.writeJson(profilePath, profile, { spaces: 2 });
    this.profiles.set(profile.name, profile);
    logger.info(`Profile saved: ${profile.name}`);
  }

  /**
   * Load a profile from configuration
   */
  async loadProfile(profile: DeveloperProfile): Promise<DeveloperProfile> {
    // Merge with existing profile if it exists
    const existing = await this.getProfile(profile.name);
    if (existing) {
      return this.mergeProfiles(existing, profile);
    }
    return profile;
  }

  /**
   * List all available profiles
   */
  async listProfiles(): Promise<DeveloperProfile[]> {
    await this.loadProfiles();
    return Array.from(this.profiles.values());
  }

  /**
   * Create an interactive profile
   */
  async createInteractiveProfile(): Promise<DeveloperProfile> {
    // This would be called from the CLI with inquirer prompts
    // For now, return a default profile
    return this.getDefaultProfile();
  }

  /**
   * Get default profile
   */
  getDefaultProfile(): DeveloperProfile {
    return {
      name: 'default',
      email: 'developer@example.com',
      role: 'fullstack',
      preferences: this.getDefaultPreferences(),
      tools: this.getDefaultTools()
    };
  }

  /**
   * Get predefined profile by role
   */
  private getPredefinedProfile(role: string): DeveloperProfile | null {
    const profiles: Record<string, DeveloperProfile> = {
      frontend: {
        name: 'frontend',
        email: '',
        role: 'frontend',
        preferences: this.getFrontendPreferences(),
        tools: this.getFrontendTools()
      },
      backend: {
        name: 'backend',
        email: '',
        role: 'backend',
        preferences: this.getBackendPreferences(),
        tools: this.getBackendTools()
      },
      fullstack: {
        name: 'fullstack',
        email: '',
        role: 'fullstack',
        preferences: this.getFullstackPreferences(),
        tools: this.getFullstackTools()
      },
      devops: {
        name: 'devops',
        email: '',
        role: 'devops',
        preferences: this.getDevOpsPreferences(),
        tools: this.getDevOpsTools()
      },
      ml: {
        name: 'ml',
        email: '',
        role: 'ml',
        preferences: this.getMLPreferences(),
        tools: this.getMLTools()
      },
      mobile: {
        name: 'mobile',
        email: '',
        role: 'mobile',
        preferences: this.getMobilePreferences(),
        tools: this.getMobileTools()
      }
    };

    return profiles[role] || null;
  }

  private getDefaultPreferences(): ProfilePreferences {
    return {
      shell: 'zsh',
      editor: 'vscode',
      theme: 'dark',
      gitConfig: {
        userName: '',
        userEmail: '',
        signCommits: true,
        defaultBranch: 'main',
        aliases: {
          co: 'checkout',
          br: 'branch',
          ci: 'commit',
          st: 'status',
          unstage: 'reset HEAD --',
          last: 'log -1 HEAD',
          visual: 'log --graph --pretty=format:"%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset"'
        }
      },
      aiTools: {
        claudeCode: true,
        claudeFlow: true,
        mcpTools: ['all'],
        swarmAgents: ['default'],
        memoryAllocation: '2GB'
      }
    };
  }

  private getDefaultTools(): RequiredTools {
    return {
      languages: {
        node: {
          versions: ['20', '18'],
          defaultVersion: '20',
          globalPackages: ['pnpm', 'typescript', 'tsx', 'nodemon']
        }
      },
      packageManagers: {
        npm: true,
        pnpm: true,
        yarn: false,
        brew: process.platform === 'darwin'
      },
      containers: {
        docker: true,
        dockerCompose: true
      },
      cloudCLIs: {},
      databases: {},
      monitoring: {},
      communication: {
        slack: {
          workspaces: [],
          profile: {
            displayName: '',
            statusText: 'Working',
            statusEmoji: ':computer:'
          }
        }
      }
    };
  }

  private getFrontendPreferences(): ProfilePreferences {
    const prefs = this.getDefaultPreferences();
    prefs.editor = 'vscode';
    return prefs;
  }

  private getFrontendTools(): RequiredTools {
    const tools = this.getDefaultTools();
    tools.languages.node!.globalPackages.push('vite', 'webpack', 'parcel', 'create-react-app', 'create-next-app');
    return tools;
  }

  private getBackendPreferences(): ProfilePreferences {
    return this.getDefaultPreferences();
  }

  private getBackendTools(): RequiredTools {
    const tools = this.getDefaultTools();
    tools.languages.node!.globalPackages.push('express', 'fastify', 'nest', 'pm2');
    tools.databases = {
      postgresql: true,
      redis: true,
      mongodb: false
    };
    return tools;
  }

  private getFullstackPreferences(): ProfilePreferences {
    return this.getDefaultPreferences();
  }

  private getFullstackTools(): RequiredTools {
    const tools = this.getDefaultTools();
    tools.languages.node!.globalPackages.push(
      'vite', 'next', 'express', 'fastify', 'prisma', 'pm2'
    );
    tools.databases = {
      postgresql: true,
      redis: true,
      mongodb: false,
      mysql: false
    };
    return tools;
  }

  private getDevOpsPreferences(): ProfilePreferences {
    const prefs = this.getDefaultPreferences();
    prefs.shell = 'bash';
    return prefs;
  }

  private getDevOpsTools(): RequiredTools {
    const tools = this.getDefaultTools();
    tools.containers = {
      docker: true,
      dockerCompose: true,
      kubernetes: true
    };
    tools.cloudCLIs = {
      aws: true,
      gcloud: true,
      azure: false
    };
    tools.monitoring = {
      datadog: false,
      newRelic: false,
      sentry: true,
      grafana: false
    };
    return tools;
  }

  private getMLPreferences(): ProfilePreferences {
    return this.getDefaultPreferences();
  }

  private getMLTools(): RequiredTools {
    const tools = this.getDefaultTools();
    tools.languages.python = {
      versions: ['3.11', '3.10'],
      defaultVersion: '3.11',
      virtualEnv: 'venv'
    };
    tools.containers = {
      docker: true,
      dockerCompose: true
    };
    return tools;
  }

  private getMobilePreferences(): ProfilePreferences {
    const prefs = this.getDefaultPreferences();
    prefs.editor = 'vscode';
    return prefs;
  }

  private getMobileTools(): RequiredTools {
    const tools = this.getDefaultTools();
    tools.languages.node!.globalPackages.push('react-native', 'expo', 'eas-cli');
    return tools;
  }

  private mergeProfiles(existing: DeveloperProfile, update: DeveloperProfile): DeveloperProfile {
    return {
      ...existing,
      ...update,
      preferences: {
        ...existing.preferences,
        ...update.preferences,
        gitConfig: {
          ...existing.preferences.gitConfig,
          ...update.preferences.gitConfig,
          aliases: {
            ...existing.preferences.gitConfig.aliases,
            ...update.preferences.gitConfig.aliases
          }
        },
        aiTools: {
          ...existing.preferences.aiTools,
          ...update.preferences.aiTools
        }
      },
      tools: {
        ...existing.tools,
        ...update.tools,
        languages: {
          ...existing.tools.languages,
          ...update.tools.languages
        },
        packageManagers: {
          ...existing.tools.packageManagers,
          ...update.tools.packageManagers
        },
        containers: {
          ...existing.tools.containers,
          ...update.tools.containers
        },
        cloudCLIs: {
          ...existing.tools.cloudCLIs,
          ...update.tools.cloudCLIs
        },
        databases: {
          ...existing.tools.databases,
          ...update.tools.databases
        },
        monitoring: {
          ...existing.tools.monitoring,
          ...update.tools.monitoring
        },
        communication: {
          ...existing.tools.communication,
          ...update.tools.communication
        }
      }
    };
  }

  /**
   * Export profiles to a file
   */
  async exportProfiles(exportPath: string): Promise<void> {
    const profiles = await this.listProfiles();
    await fs.writeJson(exportPath, profiles, { spaces: 2 });
    logger.info(`Exported ${profiles.length} profiles to ${exportPath}`);
  }

  /**
   * Import profiles from a file
   */
  async importProfiles(importPath: string): Promise<void> {
    const profiles = await fs.readJson(importPath);
    for (const profile of profiles) {
      await this.saveProfile(profile);
    }
    logger.info(`Imported ${profiles.length} profiles`);
  }

  /**
   * Delete a profile
   */
  async deleteProfile(name: string): Promise<void> {
    const profilePath = path.join(this.profilesDir, `${name}.json`);
    if (await fs.pathExists(profilePath)) {
      await fs.remove(profilePath);
      this.profiles.delete(name);
      logger.info(`Profile deleted: ${name}`);
    }
  }
}