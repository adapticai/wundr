/**
 * Profile Manager
 *
 * Manages developer profiles for computer setup. Provides 6 built-in
 * profiles and supports custom profile creation, persistence, and
 * diffing for incremental updates.
 *
 * All profile data is serializable (no functions stored) so profiles
 * can be persisted to disk and loaded across sessions.
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { Logger } from '../utils/logger';

import type { SetupPlatform } from '../types';

/**
 * Serializable tool requirement for a profile.
 */
export interface ProfileToolEntry {
  /** Tool identifier (e.g. "homebrew", "git", "node") */
  id: string;
  /** Human-readable display name */
  displayName: string;
  /** Whether this tool is required (true) or optional (false) */
  required: boolean;
  /** Category for phase grouping */
  category: 'system' | 'development' | 'ai' | 'configuration' | 'communication';
  /** IDs of tools that must be installed first */
  dependencies: string[];
}

/**
 * Serializable profile definition. Contains no functions or
 * closures so it can be safely written to JSON.
 */
export interface ProfileDefinition {
  /** Unique identifier (e.g. "frontend", "devops") */
  id: string;
  /** Human-readable name (e.g. "Frontend Developer") */
  name: string;
  /** Short description */
  description: string;
  /** Tool entries for this profile */
  tools: ProfileToolEntry[];
  /** Languages enabled for this profile */
  languages: Record<string, boolean>;
  /** Frameworks enabled for this profile */
  frameworks: Record<string, boolean>;
  /** Databases enabled for this profile */
  databases: Record<string, boolean>;
  /** Estimated total setup time in minutes */
  estimatedTimeMinutes: number;
}

/**
 * Result of diffing two profiles. Used by computer-update to
 * determine which tools need to be added or removed.
 */
export interface ProfileDiff {
  /** Tools present in the new profile but not the old */
  added: ProfileToolEntry[];
  /** Tools present in the old profile but not the new */
  removed: ProfileToolEntry[];
  /** Tools present in both but with changed properties */
  changed: ProfileToolEntry[];
  /** Tools unchanged between old and new */
  unchanged: ProfileToolEntry[];
}

const PROFILES_DIR = path.join(os.homedir(), '.wundr', 'profiles');
const ACTIVE_PROFILE_FILE = path.join(PROFILES_DIR, 'active-profile.json');

/**
 * Built-in profile definitions covering the 6 standard developer roles.
 */
function createBuiltInProfiles(): Map<string, ProfileDefinition> {
  const profiles = new Map<string, ProfileDefinition>();

  // Shared base tools that every profile needs
  const baseTools: ProfileToolEntry[] = [
    {
      id: 'permissions',
      displayName: 'System Permissions',
      required: true,
      category: 'system',
      dependencies: [],
    },
    {
      id: 'homebrew',
      displayName: 'Homebrew',
      required: true,
      category: 'system',
      dependencies: ['permissions'],
    },
    {
      id: 'git',
      displayName: 'Git',
      required: true,
      category: 'development',
      dependencies: ['homebrew'],
    },
    {
      id: 'vscode',
      displayName: 'VS Code',
      required: true,
      category: 'development',
      dependencies: ['homebrew'],
    },
    {
      id: 'claude',
      displayName: 'Claude Code',
      required: true,
      category: 'ai',
      dependencies: ['homebrew'],
    },
  ];

  profiles.set('frontend', {
    id: 'frontend',
    name: 'Frontend Developer',
    description: 'Modern web frontend development with React, Vue, and tooling',
    tools: [
      ...baseTools,
      {
        id: 'node',
        displayName: 'Node.js',
        required: true,
        category: 'development',
        dependencies: ['homebrew', 'git'],
      },
      {
        id: 'docker',
        displayName: 'Docker',
        required: false,
        category: 'development',
        dependencies: ['homebrew'],
      },
    ],
    languages: { javascript: true, typescript: true },
    frameworks: { react: true, vue: true, nextjs: true },
    databases: {},
    estimatedTimeMinutes: 20,
  });

  profiles.set('backend', {
    id: 'backend',
    name: 'Backend Developer',
    description: 'Server-side development with Node.js, Python, and databases',
    tools: [
      ...baseTools,
      {
        id: 'node',
        displayName: 'Node.js',
        required: true,
        category: 'development',
        dependencies: ['homebrew', 'git'],
      },
      {
        id: 'python',
        displayName: 'Python',
        required: true,
        category: 'development',
        dependencies: ['homebrew'],
      },
      {
        id: 'docker',
        displayName: 'Docker',
        required: true,
        category: 'development',
        dependencies: ['homebrew'],
      },
    ],
    languages: { javascript: true, typescript: true, python: true },
    frameworks: { express: true, nestjs: true, fastapi: true },
    databases: { postgresql: true, redis: true },
    estimatedTimeMinutes: 30,
  });

  profiles.set('fullstack', {
    id: 'fullstack',
    name: 'Full Stack Developer',
    description: 'Complete development stack with frontend and backend tools',
    tools: [
      ...baseTools,
      {
        id: 'node',
        displayName: 'Node.js',
        required: true,
        category: 'development',
        dependencies: ['homebrew', 'git'],
      },
      {
        id: 'python',
        displayName: 'Python',
        required: true,
        category: 'development',
        dependencies: ['homebrew'],
      },
      {
        id: 'docker',
        displayName: 'Docker',
        required: true,
        category: 'development',
        dependencies: ['homebrew'],
      },
    ],
    languages: { javascript: true, typescript: true, python: true },
    frameworks: { react: true, nextjs: true, express: true },
    databases: { postgresql: true, redis: true },
    estimatedTimeMinutes: 35,
  });

  profiles.set('devops', {
    id: 'devops',
    name: 'DevOps Engineer',
    description:
      'Infrastructure and deployment tools with container orchestration',
    tools: [
      ...baseTools,
      {
        id: 'python',
        displayName: 'Python',
        required: true,
        category: 'development',
        dependencies: ['homebrew'],
      },
      {
        id: 'docker',
        displayName: 'Docker',
        required: true,
        category: 'development',
        dependencies: ['homebrew'],
      },
      {
        id: 'node',
        displayName: 'Node.js',
        required: false,
        category: 'development',
        dependencies: ['homebrew', 'git'],
      },
    ],
    languages: { python: true, go: true },
    frameworks: {},
    databases: { postgresql: true, redis: true },
    estimatedTimeMinutes: 40,
  });

  profiles.set('ml', {
    id: 'ml',
    name: 'Machine Learning Engineer',
    description:
      'Data science and ML development with Python, Jupyter, and GPU tools',
    tools: [
      ...baseTools,
      {
        id: 'python',
        displayName: 'Python',
        required: true,
        category: 'development',
        dependencies: ['homebrew'],
      },
      {
        id: 'docker',
        displayName: 'Docker',
        required: true,
        category: 'development',
        dependencies: ['homebrew'],
      },
      {
        id: 'node',
        displayName: 'Node.js',
        required: false,
        category: 'development',
        dependencies: ['homebrew', 'git'],
      },
    ],
    languages: { python: true },
    frameworks: { tensorflow: true, pytorch: true },
    databases: { postgresql: true },
    estimatedTimeMinutes: 45,
  });

  profiles.set('mobile', {
    id: 'mobile',
    name: 'Mobile Developer',
    description: 'iOS and Android development with React Native and Flutter',
    tools: [
      ...baseTools,
      {
        id: 'node',
        displayName: 'Node.js',
        required: true,
        category: 'development',
        dependencies: ['homebrew', 'git'],
      },
      {
        id: 'docker',
        displayName: 'Docker',
        required: false,
        category: 'development',
        dependencies: ['homebrew'],
      },
    ],
    languages: { javascript: true, typescript: true },
    frameworks: { react: true },
    databases: { sqlite: true },
    estimatedTimeMinutes: 30,
  });

  return profiles;
}

/**
 * Manages developer profiles: built-in lookup, custom creation,
 * persistence to disk, and diffing for incremental updates.
 */
export class ProfileManager {
  private readonly builtInProfiles: Map<string, ProfileDefinition>;
  private readonly customProfiles: Map<string, ProfileDefinition> = new Map();
  private readonly logger: Logger;

  constructor() {
    this.logger = new Logger({ name: 'ProfileManager' });
    this.builtInProfiles = createBuiltInProfiles();
  }

  /**
   * Resolve a profile by ID. Checks custom profiles first,
   * then built-in profiles.
   *
   * @throws if the profile ID is not recognized
   */
  resolve(profileId: string): ProfileDefinition {
    const normalized = profileId.toLowerCase().replace(/[\s-]+/g, '');

    // Aliases for common names
    const aliases: Record<string, string> = {
      fullstackdeveloper: 'fullstack',
      frontenddeveloper: 'frontend',
      backenddeveloper: 'backend',
      devopsengineer: 'devops',
      machinelearning: 'ml',
      mlengineer: 'ml',
      mobiledeveloper: 'mobile',
    };
    const resolvedId = aliases[normalized] ?? normalized;

    if (this.customProfiles.has(resolvedId)) {
      return this.customProfiles.get(resolvedId)!;
    }

    if (this.builtInProfiles.has(resolvedId)) {
      return this.builtInProfiles.get(resolvedId)!;
    }

    const available = this.listAvailableIds().join(', ');
    throw new Error(
      `Unknown profile: "${profileId}". Available profiles: ${available}`
    );
  }

  /**
   * List all available profile IDs (built-in + custom).
   */
  listAvailableIds(): string[] {
    const ids = new Set<string>();
    for (const id of this.builtInProfiles.keys()) {
      ids.add(id);
    }
    for (const id of this.customProfiles.keys()) {
      ids.add(id);
    }
    return Array.from(ids).sort();
  }

  /**
   * List all available profile definitions.
   */
  listAll(): ProfileDefinition[] {
    const merged = new Map<string, ProfileDefinition>();
    for (const [id, profile] of this.builtInProfiles) {
      merged.set(id, profile);
    }
    for (const [id, profile] of this.customProfiles) {
      merged.set(id, profile);
    }
    return Array.from(merged.values());
  }

  /**
   * Register a custom profile. Overwrites any existing custom
   * profile with the same ID. Cannot overwrite built-in profiles
   * unless explicitly opting in.
   */
  register(
    profile: ProfileDefinition,
    options: { overrideBuiltIn?: boolean } = {}
  ): void {
    if (this.builtInProfiles.has(profile.id) && !options.overrideBuiltIn) {
      throw new Error(
        `Cannot overwrite built-in profile "${profile.id}" without overrideBuiltIn flag`
      );
    }
    this.customProfiles.set(profile.id, profile);
  }

  /**
   * Filter a profile's tools to only those supported on the
   * given platform. For example, Homebrew is only relevant on macOS.
   */
  filterToolsForPlatform(
    profile: ProfileDefinition,
    platform: SetupPlatform
  ): ProfileToolEntry[] {
    return profile.tools.filter(tool => {
      // Homebrew is macOS/Linux only (Linux Homebrew exists)
      if (tool.id === 'homebrew' && platform.os === 'win32') {
        return false;
      }
      // Permissions step is Unix-only
      if (tool.id === 'permissions' && platform.os === 'win32') {
        return false;
      }
      return true;
    });
  }

  /**
   * Compute the difference between two profiles. Used by the
   * `computer-update` command to determine what has changed.
   */
  diff(
    oldProfile: ProfileDefinition,
    newProfile: ProfileDefinition
  ): ProfileDiff {
    const oldToolIds = new Set(oldProfile.tools.map(t => t.id));
    const newToolIds = new Set(newProfile.tools.map(t => t.id));
    const newToolMap = new Map(newProfile.tools.map(t => [t.id, t]));
    const oldToolMap = new Map(oldProfile.tools.map(t => [t.id, t]));

    const added: ProfileToolEntry[] = [];
    const removed: ProfileToolEntry[] = [];
    const changed: ProfileToolEntry[] = [];
    const unchanged: ProfileToolEntry[] = [];

    // Find added and changed tools
    for (const tool of newProfile.tools) {
      if (!oldToolIds.has(tool.id)) {
        added.push(tool);
      } else {
        const oldTool = oldToolMap.get(tool.id)!;
        if (
          oldTool.required !== tool.required ||
          oldTool.category !== tool.category ||
          JSON.stringify(oldTool.dependencies) !==
            JSON.stringify(tool.dependencies)
        ) {
          changed.push(tool);
        } else {
          unchanged.push(tool);
        }
      }
    }

    // Find removed tools
    for (const tool of oldProfile.tools) {
      if (!newToolIds.has(tool.id)) {
        removed.push(tool);
      }
    }

    return { added, removed, changed, unchanged };
  }

  /**
   * Persist the active profile to disk so it can be loaded
   * in subsequent sessions or by `computer-update`.
   */
  async saveActiveProfile(profile: ProfileDefinition): Promise<void> {
    try {
      await fs.mkdir(PROFILES_DIR, { recursive: true });
      const data = JSON.stringify(profile, null, 2);
      // Write atomically: write to tmp file, then rename
      const tmpFile = `${ACTIVE_PROFILE_FILE}.tmp`;
      await fs.writeFile(tmpFile, data, 'utf-8');
      await fs.rename(tmpFile, ACTIVE_PROFILE_FILE);
      this.logger.info(`Active profile saved: ${profile.id}`);
    } catch (error) {
      this.logger.warn('Failed to save active profile:', error);
    }
  }

  /**
   * Load the previously saved active profile from disk.
   * Returns null if no profile has been saved.
   */
  async loadActiveProfile(): Promise<ProfileDefinition | null> {
    try {
      const data = await fs.readFile(ACTIVE_PROFILE_FILE, 'utf-8');
      const profile = JSON.parse(data) as ProfileDefinition;
      this.logger.info(`Loaded active profile: ${profile.id}`);
      return profile;
    } catch {
      return null;
    }
  }
}
