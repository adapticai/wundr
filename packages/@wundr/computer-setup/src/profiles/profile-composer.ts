/**
 * Profile Composer
 *
 * Composes one or more profile definitions into a single merged profile.
 * Handles tool deduplication, version conflict resolution, and user overrides.
 *
 * @module profiles/profile-composer
 */

import { Logger } from '../utils/logger';

import { ProfileLoader } from './profile-loader';

import type {
  ComposedProfile,
  ProfileClaudeConventions,
  ProfileConflict,
  ProfileDefinition,
  ProfileOverride,
  ProfileType,
  ToolSpec,
} from './profile-types';

const logger = new Logger({ name: 'profile-composer' });

/**
 * Composes multiple profiles into a single installable profile.
 *
 * Merge strategy:
 * 1. Union all tools, frameworks, extensions across selected profiles
 * 2. For version conflicts, take the higher semver (warn the user)
 * 3. User overrides always win over composed values
 * 4. Tools marked in removeTools are excluded from the final set
 */
export class ProfileComposer {
  private loader: ProfileLoader;

  constructor(loader?: ProfileLoader) {
    this.loader = loader || new ProfileLoader();
  }

  /**
   * Compose one or more profiles into a single merged result.
   *
   * @param types - Profile types to compose (order does not matter)
   * @param overrides - Optional user overrides applied after merging
   * @returns A ComposedProfile ready for installation
   */
  async compose(
    types: ProfileType[],
    overrides?: ProfileOverride
  ): Promise<ComposedProfile> {
    if (types.length === 0) {
      throw new Error('At least one profile type is required');
    }

    logger.info(`Composing profiles: ${types.join(', ')}`);

    // Load all requested profiles
    const definitions: ProfileDefinition[] = [];
    for (const type of types) {
      const def = await this.loader.loadProfile(type);
      if (!def) {
        throw new Error(`Profile not found: ${type}`);
      }
      definitions.push(def);
    }

    // Merge tools
    const { tools, conflicts } = this.mergeTools(definitions);

    // Merge extensions (deduplicated union)
    const extensions = this.mergeExtensions(definitions);

    // Merge global packages
    const globalPackages = this.mergeGlobalPackages(definitions);

    // Merge Claude conventions
    const claudeConventions = this.mergeClaudeConventions(definitions);

    // Estimated time: take the max, not the sum (parallel installs)
    const estimatedTimeMinutes = Math.max(
      ...definitions.map(d => d.estimatedTimeMinutes)
    );

    // Build display name
    const displayName =
      types.length === 1
        ? definitions[0].displayName
        : types.map(t => capitalize(t)).join(' + ') + ' Developer';

    let composed: ComposedProfile = {
      sourceProfiles: types,
      displayName,
      tools,
      extensions,
      globalPackages,
      claudeConventions,
      estimatedTimeMinutes,
      conflicts,
    };

    // Apply user overrides
    if (overrides) {
      composed = this.applyOverrides(composed, overrides);
    }

    if (conflicts.length > 0) {
      logger.warn(
        `Resolved ${conflicts.length} conflict(s) during composition`
      );
    }

    logger.info(
      `Composed profile with ${composed.tools.length} tools, ${composed.extensions.length} extensions`
    );

    return composed;
  }

  /**
   * Compose from already-loaded profile definitions (useful when caller
   * has already resolved definitions from manifests or custom sources).
   */
  composeFromDefinitions(
    definitions: ProfileDefinition[],
    overrides?: ProfileOverride
  ): ComposedProfile {
    if (definitions.length === 0) {
      throw new Error('At least one profile definition is required');
    }

    const { tools, conflicts } = this.mergeTools(definitions);
    const extensions = this.mergeExtensions(definitions);
    const globalPackages = this.mergeGlobalPackages(definitions);
    const claudeConventions = this.mergeClaudeConventions(definitions);
    const estimatedTimeMinutes = Math.max(
      ...definitions.map(d => d.estimatedTimeMinutes)
    );

    const types = definitions.map(d => d.type);
    const displayName =
      definitions.length === 1
        ? definitions[0].displayName
        : types.map(t => capitalize(t)).join(' + ') + ' Developer';

    let composed: ComposedProfile = {
      sourceProfiles: types,
      displayName,
      tools,
      extensions,
      globalPackages,
      claudeConventions,
      estimatedTimeMinutes,
      conflicts,
    };

    if (overrides) {
      composed = this.applyOverrides(composed, overrides);
    }

    return composed;
  }

  // ---------------------------------------------------------------------------
  // Private merge methods
  // ---------------------------------------------------------------------------

  /**
   * Merge tool lists from multiple profiles.
   * Deduplicates by tool name. For version conflicts, the higher version wins.
   */
  private mergeTools(definitions: ProfileDefinition[]): {
    tools: ToolSpec[];
    conflicts: ProfileConflict[];
  } {
    const merged = new Map<string, ToolSpec>();
    const conflicts: ProfileConflict[] = [];

    for (const def of definitions) {
      for (const tool of def.tools) {
        const existing = merged.get(tool.name);

        if (!existing) {
          // First occurrence; deep-copy to avoid mutating originals
          merged.set(tool.name, { ...tool });
          continue;
        }

        // Merge: if one profile marks a tool as required, the merged result
        // is also required
        if (tool.required && !existing.required) {
          existing.required = true;
        }

        // Version conflict resolution
        if (
          tool.version &&
          existing.version &&
          tool.version !== existing.version
        ) {
          const resolved = this.resolveVersionConflict(
            existing.version,
            tool.version
          );

          conflicts.push({
            toolName: tool.name,
            field: 'version',
            valueA: existing.version,
            valueB: tool.version,
            resolution: `Using version ${resolved} (higher of ${existing.version} and ${tool.version})`,
          });

          existing.version = resolved;
        }

        // Merge dependencies (union)
        if (tool.dependencies) {
          const existingDeps = new Set(existing.dependencies || []);
          for (const dep of tool.dependencies) {
            existingDeps.add(dep);
          }
          existing.dependencies = Array.from(existingDeps);
        }

        // Merge platform overrides (latter profile wins for per-platform specs)
        if (tool.platformOverrides) {
          existing.platformOverrides = {
            ...existing.platformOverrides,
            ...tool.platformOverrides,
          };
        }
      }
    }

    return { tools: Array.from(merged.values()), conflicts };
  }

  /**
   * Merge extensions from multiple profiles (deduplicated union).
   */
  private mergeExtensions(definitions: ProfileDefinition[]): string[] {
    const extensionSet = new Set<string>();
    for (const def of definitions) {
      for (const ext of def.extensions) {
        extensionSet.add(ext);
      }
    }
    return Array.from(extensionSet);
  }

  /**
   * Merge global packages from multiple profiles (deduplicated union per ecosystem).
   */
  private mergeGlobalPackages(
    definitions: ProfileDefinition[]
  ): Record<string, string[]> {
    const merged: Record<string, Set<string>> = {};

    for (const def of definitions) {
      for (const [ecosystem, packages] of Object.entries(def.globalPackages)) {
        if (!merged[ecosystem]) {
          merged[ecosystem] = new Set();
        }
        for (const pkg of packages) {
          merged[ecosystem].add(pkg);
        }
      }
    }

    const result: Record<string, string[]> = {};
    for (const [ecosystem, pkgSet] of Object.entries(merged)) {
      result[ecosystem] = Array.from(pkgSet);
    }
    return result;
  }

  /**
   * Merge Claude conventions from multiple profiles.
   * Arrays are unioned; scalars use the last profile's value.
   */
  private mergeClaudeConventions(
    definitions: ProfileDefinition[]
  ): ProfileClaudeConventions {
    const agents = new Set<string>();
    const mcpTools = new Set<string>();
    const skills = new Set<string>();
    const commands = new Set<string>();
    const instructions: string[] = [];

    let memoryArchitecture: ProfileClaudeConventions['memoryArchitecture'] =
      'basic';

    for (const def of definitions) {
      const conv = def.claudeConventions;
      for (const a of conv.recommendedAgents) agents.add(a);
      for (const m of conv.mcpTools) mcpTools.add(m);
      for (const s of conv.skills) skills.add(s);
      for (const c of conv.commands) commands.add(c);

      if (conv.claudeInstructions) {
        instructions.push(conv.claudeInstructions);
      }

      // Escalate memory architecture (basic < tiered < memgpt)
      const archOrder: ProfileClaudeConventions['memoryArchitecture'][] = [
        'basic',
        'tiered',
        'memgpt',
      ];
      if (
        archOrder.indexOf(conv.memoryArchitecture) >
        archOrder.indexOf(memoryArchitecture)
      ) {
        memoryArchitecture = conv.memoryArchitecture;
      }
    }

    return {
      recommendedAgents: Array.from(agents),
      mcpTools: Array.from(mcpTools),
      memoryArchitecture,
      skills: Array.from(skills),
      commands: Array.from(commands),
      claudeInstructions:
        instructions.length > 0 ? instructions.join('\n\n') : undefined,
    };
  }

  /**
   * Apply user overrides to a composed profile.
   */
  private applyOverrides(
    composed: ComposedProfile,
    overrides: ProfileOverride
  ): ComposedProfile {
    let tools = [...composed.tools];

    // Remove tools
    if (overrides.removeTools && overrides.removeTools.length > 0) {
      const removeSet = new Set(overrides.removeTools);
      tools = tools.filter(t => !removeSet.has(t.name));
      logger.info(`Removed tools: ${overrides.removeTools.join(', ')}`);
    }

    // Add tools
    if (overrides.addTools && overrides.addTools.length > 0) {
      const existingNames = new Set(tools.map(t => t.name));
      for (const addTool of overrides.addTools) {
        if (!existingNames.has(addTool.name)) {
          tools.push(addTool);
        }
      }
      logger.info(
        `Added tools: ${overrides.addTools.map(t => t.name).join(', ')}`
      );
    }

    // Version pins (user overrides always win)
    if (overrides.versionPins) {
      for (const [toolName, version] of Object.entries(overrides.versionPins)) {
        const existing = tools.find(t => t.name === toolName);
        if (existing) {
          existing.version = version;
        }
      }
    }

    // Extensions
    let extensions = [...composed.extensions];
    if (overrides.removeExtensions && overrides.removeExtensions.length > 0) {
      const removeSet = new Set(overrides.removeExtensions);
      extensions = extensions.filter(e => !removeSet.has(e));
    }
    if (overrides.addExtensions && overrides.addExtensions.length > 0) {
      const existingSet = new Set(extensions);
      for (const ext of overrides.addExtensions) {
        if (!existingSet.has(ext)) {
          extensions.push(ext);
        }
      }
    }

    // Global packages
    const globalPackages: Record<string, string[]> = {};
    for (const [eco, pkgs] of Object.entries(composed.globalPackages)) {
      globalPackages[eco] = [...pkgs];
    }
    if (overrides.addGlobalPackages) {
      for (const [eco, pkgs] of Object.entries(overrides.addGlobalPackages)) {
        if (!globalPackages[eco]) {
          globalPackages[eco] = [];
        }
        const existing = new Set(globalPackages[eco]);
        for (const pkg of pkgs) {
          if (!existing.has(pkg)) {
            globalPackages[eco].push(pkg);
          }
        }
      }
    }

    // Claude conventions
    const claudeConventions = overrides.claudeConventions
      ? { ...composed.claudeConventions, ...overrides.claudeConventions }
      : composed.claudeConventions;

    return {
      ...composed,
      tools,
      extensions,
      globalPackages,
      claudeConventions,
    };
  }

  // ---------------------------------------------------------------------------
  // Version resolution
  // ---------------------------------------------------------------------------

  /**
   * Compare two version strings and return the higher one.
   * Handles semver-like strings and "latest".
   */
  private resolveVersionConflict(versionA: string, versionB: string): string {
    // "latest" always wins
    if (versionA === 'latest' || versionB === 'latest') {
      return 'latest';
    }

    const partsA = versionA.split('.').map(Number);
    const partsB = versionB.split('.').map(Number);

    const maxLen = Math.max(partsA.length, partsB.length);
    for (let i = 0; i < maxLen; i++) {
      const a = partsA[i] || 0;
      const b = partsB[i] || 0;
      if (a > b) return versionA;
      if (b > a) return versionB;
    }

    // Equal
    return versionA;
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default ProfileComposer;
