/**
 * Skill Executor
 *
 * Handles the invocation of skills, including:
 * - $ARGUMENTS substitution in skill body
 * - !command dynamic context injection (Phase 2)
 * - Execution mode routing (inline vs fork)
 * - Environment variable management during execution
 * - Timeout enforcement
 *
 * The executor is the runtime engine that transforms a skill definition
 * and user arguments into a rendered prompt ready for the LLM.
 *
 * @module skills/skill-executor
 */

import * as path from 'path';

import type { SkillRegistry } from './skill-registry';
import type {
  Skill,
  SkillConfigEntry,
  SkillEntry,
  SkillExecutionOptions,
  SkillExecutionResult,
  SkillsConfig,
} from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ARGUMENTS_PLACEHOLDER = '$ARGUMENTS';
const COMMAND_PREFIX = '!';
const DEFAULT_COMMAND_TIMEOUT_MS = 30_000;
const DEFAULT_COMMAND_MAX_OUTPUT_BYTES = 64 * 1024; // 64KB

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

/**
 * Executes skills by resolving their prompts with argument substitution
 * and dynamic context injection.
 *
 * Usage:
 * ```typescript
 * const executor = new SkillExecutor(registry, config);
 *
 * // Inline execution
 * const result = await executor.execute('review-pr', {
 *   arguments: '123',
 *   workingDirectory: '/path/to/repo',
 * });
 *
 * if (result.success) {
 *   // Inject result.renderedPrompt into LLM context
 * }
 * ```
 */
export class SkillExecutor {
  private registry: SkillRegistry;
  private config?: SkillsConfig;

  constructor(registry: SkillRegistry, config?: SkillsConfig) {
    this.registry = registry;
    this.config = config;
  }

  /**
   * Execute a skill by name.
   *
   * @param skillName - The name of the skill to execute
   * @param options - Execution options (arguments, working dir, timeout, etc.)
   * @returns Execution result with rendered prompt and metadata
   */
  async execute(
    skillName: string,
    options: SkillExecutionOptions = {},
  ): Promise<SkillExecutionResult> {
    const startTime = Date.now();

    // Look up the skill in the registry
    const entry = this.registry.getEntry(skillName);
    if (!entry) {
      return {
        success: false,
        executionContext: 'inline',
        skillName,
        error: `Skill "${skillName}" not found in registry`,
        durationMs: Date.now() - startTime,
      };
    }

    const skill = entry.skill;
    const executionContext = skill.frontmatter.context ?? 'inline';

    try {
      // Apply environment variable overrides for this skill
      const restoreEnv = this.applyEnvOverrides(entry, options.env);

      try {
        // Render the prompt with argument substitution
        const renderedPrompt = this.renderPrompt(skill, options);

        return {
          success: true,
          renderedPrompt,
          executionContext,
          skillName: skill.name,
          durationMs: Date.now() - startTime,
        };
      } finally {
        // Always restore environment
        restoreEnv();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        executionContext,
        skillName: skill.name,
        error: `Skill execution failed: ${message}`,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute a skill and return the result suitable for fork (subagent) execution.
   * For fork execution, the rendered prompt is packaged for a new session.
   *
   * @param skillName - The name of the skill to execute
   * @param options - Execution options
   * @returns Execution result with fork-ready prompt
   */
  async executeFork(
    skillName: string,
    options: SkillExecutionOptions = {},
  ): Promise<SkillExecutionResult> {
    const entry = this.registry.getEntry(skillName);
    if (!entry) {
      return {
        success: false,
        executionContext: 'fork',
        skillName,
        error: `Skill "${skillName}" not found in registry`,
      };
    }

    if (entry.skill.frontmatter.context !== 'fork') {
      return {
        success: false,
        executionContext: 'fork',
        skillName,
        error: `Skill "${skillName}" is not configured for fork execution (context: ${entry.skill.frontmatter.context ?? 'inline'})`,
      };
    }

    // For fork execution, we render the prompt and package it
    const result = await this.execute(skillName, options);
    if (!result.success) return { ...result, executionContext: 'fork' };

    // Wrap the rendered prompt in a fork-ready format
    const forkPrompt = buildForkPrompt(entry.skill, result.renderedPrompt ?? '', options);

    return {
      ...result,
      executionContext: 'fork',
      renderedPrompt: forkPrompt,
    };
  }

  /**
   * Check if a skill exists and is executable.
   */
  canExecute(skillName: string): boolean {
    return this.registry.hasSkill(skillName);
  }

  /**
   * Get the execution context (inline/fork) for a skill.
   */
  getExecutionContext(skillName: string): 'inline' | 'fork' | undefined {
    const entry = this.registry.getEntry(skillName);
    if (!entry) return undefined;
    return entry.skill.frontmatter.context ?? 'inline';
  }

  /**
   * Get the model override for a skill (if any).
   */
  getModelOverride(skillName: string): string | undefined {
    const entry = this.registry.getEntry(skillName);
    return entry?.skill.frontmatter.model;
  }

  /**
   * Get the allowed tools for a skill (if restricted).
   */
  getAllowedTools(skillName: string): string[] | undefined {
    const entry = this.registry.getEntry(skillName);
    return entry?.skill.frontmatter.allowedTools;
  }

  // -------------------------------------------------------------------------
  // Prompt Rendering
  // -------------------------------------------------------------------------

  /**
   * Render a skill's body with argument substitution.
   *
   * Substitution rules:
   * - All occurrences of $ARGUMENTS are replaced with the provided arguments string
   * - If no arguments are provided, $ARGUMENTS is replaced with an empty string
   * - !command lines are preserved for Phase 2 dynamic execution
   */
  private renderPrompt(skill: Skill, options: SkillExecutionOptions): string {
    let body = skill.body;

    // $ARGUMENTS substitution
    const args = options.arguments?.trim() ?? '';
    body = body.replace(/\$ARGUMENTS/g, args);

    // Build the complete prompt with skill header
    const lines: string[] = [];

    // Skill header
    lines.push(`<skill name="${skill.name}">`);

    if (skill.frontmatter.model) {
      lines.push(`<!-- model: ${skill.frontmatter.model} -->`);
    }
    if (skill.frontmatter.allowedTools) {
      lines.push(`<!-- allowed-tools: ${skill.frontmatter.allowedTools.join(', ')} -->`);
    }
    if (args) {
      lines.push(`<!-- arguments: ${args} -->`);
    }

    lines.push('');
    lines.push(body);
    lines.push('');
    lines.push('</skill>');

    return lines.join('\n');
  }

  // -------------------------------------------------------------------------
  // Environment Management
  // -------------------------------------------------------------------------

  /**
   * Apply environment variable overrides for a skill execution.
   * Returns a cleanup function that restores the original values.
   */
  private applyEnvOverrides(
    entry: SkillEntry,
    extraEnv?: Record<string, string>,
  ): () => void {
    const updates: Array<{ key: string; prev: string | undefined }> = [];

    // Apply per-skill config env overrides
    const skillKey = entry.metadata?.skillKey ?? entry.skill.name;
    const skillConfig = this.config?.entries?.[skillKey];

    if (skillConfig?.env) {
      for (const [envKey, envValue] of Object.entries(skillConfig.env)) {
        if (!envValue || process.env[envKey]) continue;
        updates.push({ key: envKey, prev: process.env[envKey] });
        process.env[envKey] = envValue;
      }
    }

    // Apply primaryEnv -> apiKey mapping
    const primaryEnv = entry.metadata?.primaryEnv;
    if (primaryEnv && skillConfig?.apiKey && !process.env[primaryEnv]) {
      updates.push({ key: primaryEnv, prev: process.env[primaryEnv] });
      process.env[primaryEnv] = skillConfig.apiKey;
    }

    // Apply execution-time env overrides
    if (extraEnv) {
      for (const [envKey, envValue] of Object.entries(extraEnv)) {
        if (!envValue) continue;
        updates.push({ key: envKey, prev: process.env[envKey] });
        process.env[envKey] = envValue;
      }
    }

    // Return cleanup function
    return () => {
      for (const update of updates) {
        if (update.prev === undefined) {
          delete process.env[update.key];
        } else {
          process.env[update.key] = update.prev;
        }
      }
    };
  }
}

// ---------------------------------------------------------------------------
// Fork Prompt Builder
// ---------------------------------------------------------------------------

/**
 * Build a prompt suitable for subagent (fork) execution.
 * Includes the skill instructions, arguments, and execution directives.
 */
function buildForkPrompt(
  skill: Skill,
  renderedBody: string,
  options: SkillExecutionOptions,
): string {
  const lines: string[] = [];

  lines.push('# Subagent Skill Execution');
  lines.push('');
  lines.push(`You are executing the "${skill.name}" skill as an isolated subagent.`);
  lines.push('Complete the task described below and return the results.');
  lines.push('');

  if (options.arguments) {
    lines.push(`## Arguments`);
    lines.push('');
    lines.push(options.arguments);
    lines.push('');
  }

  if (options.workingDirectory) {
    lines.push(`## Working Directory`);
    lines.push('');
    lines.push(`All operations should be performed in: ${options.workingDirectory}`);
    lines.push('');
  }

  lines.push('## Skill Instructions');
  lines.push('');
  lines.push(renderedBody);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

/**
 * Parse a user command string to extract the skill name and arguments.
 *
 * Supports formats:
 * - `/skill-name` (no arguments)
 * - `/skill-name arg1 arg2` (space-separated arguments)
 * - `/skill-name "quoted argument"` (quoted arguments)
 *
 * @param input - The raw user input string
 * @returns Parsed skill name and arguments, or undefined if not a skill command
 */
export function parseSkillCommand(input: string): {
  skillName: string;
  arguments: string;
} | undefined {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return undefined;

  const withoutSlash = trimmed.slice(1);
  const spaceIndex = withoutSlash.indexOf(' ');

  if (spaceIndex === -1) {
    return {
      skillName: withoutSlash,
      arguments: '',
    };
  }

  return {
    skillName: withoutSlash.slice(0, spaceIndex),
    arguments: withoutSlash.slice(spaceIndex + 1).trim(),
  };
}

/**
 * Match a user query against registered skill descriptions to find
 * the best-matching skill for auto-triggering.
 *
 * Uses a simple keyword matching approach. For more sophisticated
 * matching, consider embedding-based similarity search.
 *
 * @param query - The user's natural language query
 * @param registry - The skill registry to search
 * @param threshold - Minimum match score (0-1) to consider a match
 * @returns The best matching skill name, or undefined
 */
export function findMatchingSkill(
  query: string,
  registry: SkillRegistry,
  threshold = 0.3,
): string | undefined {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

  if (queryWords.length === 0) return undefined;

  let bestScore = 0;
  let bestName: string | undefined;

  for (const entry of registry.getAllEntries()) {
    if (entry.invocation.disableModelInvocation) continue;

    const descLower = entry.skill.description.toLowerCase();
    const nameLower = entry.skill.name.toLowerCase();

    // Direct name match is highest priority
    if (queryLower.includes(nameLower) || nameLower.includes(queryLower)) {
      return entry.skill.name;
    }

    // Keyword overlap scoring
    let matches = 0;
    for (const word of queryWords) {
      if (descLower.includes(word)) matches++;
      if (nameLower.includes(word)) matches += 2; // Name matches weighted higher
    }

    const score = matches / (queryWords.length * 2); // Normalize
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestName = entry.skill.name;
    }
  }

  return bestName;
}
