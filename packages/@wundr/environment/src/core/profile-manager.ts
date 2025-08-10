/**
 * Profile management system for different environment types
 */

import { ProfileType, ProfileTemplate } from '../types';
import { createLogger } from '../utils/logger';

const logger = createLogger('ProfileManager');

export class ProfileManager {
  private profiles: Map<ProfileType, ProfileTemplate> = new Map();

  constructor() {
    this.initializeDefaultProfiles();
  }

  /**
   * Get profile template by type
   */
  async getProfileTemplate(profileType: ProfileType): Promise<ProfileTemplate> {
    const profile = this.profiles.get(profileType);
    if (!profile) {
      throw new Error(`Profile template not found: ${profileType}`);
    }
    return profile;
  }

  /**
   * Register a custom profile template
   */
  registerProfile(template: ProfileTemplate): void {
    this.profiles.set(template.profile, template);
    logger.info(`Registered profile: ${template.name}`);
  }

  /**
   * Get all available profiles
   */
  getAvailableProfiles(): ProfileTemplate[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Initialize default profile templates
   */
  private initializeDefaultProfiles(): void {
    // Human Developer Profile
    const humanProfile: ProfileTemplate = {
      name: 'Human Developer',
      description: 'Full development environment for human developers',
      profile: 'human',
      tools: [
        {
          name: 'homebrew',
          required: true,
          installer: 'manual',
          platform: ['macos'],
        },
        {
          name: 'node',
          version: '>=18.0.0',
          required: true,
          installer: 'brew',
          platform: ['macos', 'linux'],
        },
        {
          name: 'npm',
          required: true,
          installer: 'brew',
          dependencies: ['node'],
        },
        {
          name: 'pnpm',
          required: true,
          installer: 'npm',
          dependencies: ['node'],
        },
        {
          name: 'yarn',
          required: false,
          installer: 'npm',
          dependencies: ['node'],
        },
        {
          name: 'git',
          required: true,
          installer: 'brew',
        },
        {
          name: 'docker',
          required: true,
          installer: 'brew',
        },
        {
          name: 'docker-compose',
          required: true,
          installer: 'brew',
          dependencies: ['docker'],
        },
        {
          name: 'vscode',
          required: true,
          installer: 'brew',
          config: {
            extensions: [
              'ms-vscode.vscode-typescript-next',
              'esbenp.prettier-vscode',
              'ms-python.python',
              'ms-vscode.vscode-json',
              'bradlc.vscode-tailwindcss',
              'ms-vscode-remote.remote-containers',
              'GitHub.copilot',
              'ms-vscode.vscode-eslint'
            ],
            settings: {
              'editor.formatOnSave': true,
              'editor.defaultFormatter': 'esbenp.prettier-vscode',
              'files.autoSave': 'onFocusChange'
            }
          }
        },
        {
          name: 'claude-code',
          required: true,
          installer: 'npm',
          dependencies: ['node'],
        },
        {
          name: 'gh',
          required: true,
          installer: 'brew',
          dependencies: ['git'],
        }
      ],
      preferences: {
        editor: 'vscode',
        shell: 'zsh',
        packageManager: 'pnpm',
        theme: 'dark'
      },
      agentConfig: {
        claudeCode: true,
        claudeFlow: true,
        mcpTools: ['claude-flow'],
        swarmCapabilities: true,
        neuralFeatures: true
      }
    };

    // AI Agent Profile
    const aiAgentProfile: ProfileTemplate = {
      name: 'AI Agent Environment',
      description: 'Optimized environment for AI agents and automated workflows',
      profile: 'ai-agent',
      tools: [
        {
          name: 'node',
          version: '>=18.0.0',
          required: true,
          installer: 'brew',
        },
        {
          name: 'npm',
          required: true,
          installer: 'brew',
          dependencies: ['node'],
        },
        {
          name: 'pnpm',
          required: true,
          installer: 'npm',
          dependencies: ['node'],
        },
        {
          name: 'git',
          required: true,
          installer: 'brew',
        },
        {
          name: 'docker',
          required: true,
          installer: 'brew',
        },
        {
          name: 'claude-code',
          required: true,
          installer: 'npm',
          dependencies: ['node'],
        },
        {
          name: 'claude-flow',
          required: true,
          installer: 'npm',
          dependencies: ['node', 'claude-code'],
        },
        {
          name: 'gh',
          required: true,
          installer: 'brew',
          dependencies: ['git'],
        }
      ],
      preferences: {
        editor: 'vscode',
        shell: 'bash',
        packageManager: 'pnpm',
        theme: 'dark'
      },
      agentConfig: {
        claudeCode: true,
        claudeFlow: true,
        mcpTools: ['claude-flow', 'wundr-toolkit'],
        swarmCapabilities: true,
        neuralFeatures: true
      },
      customScripts: [
        'setup-swarm-topology.sh',
        'configure-neural-training.sh',
        'optimize-agent-performance.sh'
      ]
    };

    // CI Runner Profile
    const ciRunnerProfile: ProfileTemplate = {
      name: 'CI/CD Runner',
      description: 'Minimal environment for CI/CD pipelines and automated builds',
      profile: 'ci-runner',
      tools: [
        {
          name: 'node',
          version: '>=18.0.0',
          required: true,
          installer: 'brew',
        },
        {
          name: 'npm',
          required: true,
          installer: 'brew',
          dependencies: ['node'],
        },
        {
          name: 'pnpm',
          required: true,
          installer: 'npm',
          dependencies: ['node'],
        },
        {
          name: 'git',
          required: true,
          installer: 'brew',
        },
        {
          name: 'docker',
          required: false,
          installer: 'brew',
        },
        {
          name: 'gh',
          required: true,
          installer: 'brew',
          dependencies: ['git'],
        }
      ],
      preferences: {
        editor: 'vim',
        shell: 'bash',
        packageManager: 'pnpm',
        theme: 'auto'
      },
      agentConfig: {
        claudeCode: false,
        claudeFlow: false,
        mcpTools: [],
        swarmCapabilities: false,
        neuralFeatures: false
      }
    };

    this.profiles.set('human', humanProfile);
    this.profiles.set('ai-agent', aiAgentProfile);
    this.profiles.set('ci-runner', ciRunnerProfile);

    logger.info('Default profiles initialized');
  }
}