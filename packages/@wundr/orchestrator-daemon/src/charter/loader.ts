import * as fs from 'fs/promises';
import * as path from 'path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { z } from 'zod';

/**
 * Charter schema validation using Zod
 */
const CharterSchema = z.object({
  name: z.string(),
  role: z.string(),
  tier: z.number().min(1).max(3),

  identity: z.object({
    name: z.string(),
    description: z.string(),
    personality: z.string(),
  }),

  capabilities: z.array(z.string()),

  responsibilities: z.array(z.string()),

  resourceLimits: z.object({
    maxSessions: z.number().positive(),
    maxTokensPerSession: z.number().positive(),
    maxConcurrentTasks: z.number().positive(),
    tokenBudget: z.object({
      hourly: z.number().positive(),
      daily: z.number().positive(),
    }),
  }),

  safetyHeuristics: z.object({
    autoApprove: z.array(z.string()),
    requireConfirmation: z.array(z.string()),
    alwaysReject: z.array(z.string()),
    escalate: z.array(z.string()),
  }),

  operationalSettings: z.object({
    defaultModel: z.string(),
    temperature: z.number().min(0).max(2),
    maxRetries: z.number().nonnegative(),
    timeoutMs: z.number().positive(),
  }),
});

export type Charter = z.infer<typeof CharterSchema>;

/**
 * Default charter configuration
 */
const DEFAULT_CHARTER: Charter = {
  name: 'orchestrator-supervisor',
  role: 'Tier1-Orchestrator',
  tier: 1,

  identity: {
    name: 'Wundr Orchestrator',
    description: 'AI orchestrator for managing development tasks and workflows',
    personality: 'Professional, efficient, and helpful',
  },

  capabilities: [
    'task_analysis',
    'code_review',
    'file_operations',
    'bash_execution',
    'web_research',
    'documentation',
  ],

  responsibilities: [
    'triage_requests',
    'manage_session_lifecycle',
    'allocate_token_budget',
    'coordinate_subagents',
  ],

  resourceLimits: {
    maxSessions: 10,
    maxTokensPerSession: 100000,
    maxConcurrentTasks: 5,
    tokenBudget: {
      hourly: 500000,
      daily: 5000000,
    },
  },

  safetyHeuristics: {
    autoApprove: [
      'Read file operations',
      'Code analysis',
      'Documentation generation',
    ],
    requireConfirmation: [
      'File modifications',
      'Database operations',
    ],
    alwaysReject: [
      'rm -rf /',
      'Destructive operations without backup',
    ],
    escalate: [
      'Production deployments',
      'Security-sensitive operations',
    ],
  },

  operationalSettings: {
    defaultModel: 'gpt-4o-mini',
    temperature: 0.7,
    maxRetries: 3,
    timeoutMs: 300000,
  },
};

/**
 * Environment variable overrides
 */
interface EnvOverrides {
  ORCHESTRATOR_NAME?: string;
  ORCHESTRATOR_TIER?: string;
  ORCHESTRATOR_MAX_SESSIONS?: string;
  ORCHESTRATOR_MAX_TOKENS?: string;
  ORCHESTRATOR_MAX_CONCURRENT?: string;
  ORCHESTRATOR_MODEL?: string;
  ORCHESTRATOR_TEMPERATURE?: string;
  ORCHESTRATOR_TIMEOUT_MS?: string;
}

/**
 * Apply environment variable overrides to charter
 */
function applyEnvOverrides(charter: Charter, env: EnvOverrides = process.env as EnvOverrides): Charter {
  const overridden = { ...charter };

  if (env.ORCHESTRATOR_NAME) {
    overridden.name = env.ORCHESTRATOR_NAME;
  }

  if (env.ORCHESTRATOR_TIER) {
    const tier = parseInt(env.ORCHESTRATOR_TIER, 10);
    if (!isNaN(tier) && tier >= 1 && tier <= 3) {
      overridden.tier = tier;
    }
  }

  if (env.ORCHESTRATOR_MAX_SESSIONS) {
    const maxSessions = parseInt(env.ORCHESTRATOR_MAX_SESSIONS, 10);
    if (!isNaN(maxSessions) && maxSessions > 0) {
      overridden.resourceLimits.maxSessions = maxSessions;
    }
  }

  if (env.ORCHESTRATOR_MAX_TOKENS) {
    const maxTokens = parseInt(env.ORCHESTRATOR_MAX_TOKENS, 10);
    if (!isNaN(maxTokens) && maxTokens > 0) {
      overridden.resourceLimits.maxTokensPerSession = maxTokens;
    }
  }

  if (env.ORCHESTRATOR_MAX_CONCURRENT) {
    const maxConcurrent = parseInt(env.ORCHESTRATOR_MAX_CONCURRENT, 10);
    if (!isNaN(maxConcurrent) && maxConcurrent > 0) {
      overridden.resourceLimits.maxConcurrentTasks = maxConcurrent;
    }
  }

  if (env.ORCHESTRATOR_MODEL) {
    overridden.operationalSettings.defaultModel = env.ORCHESTRATOR_MODEL;
  }

  if (env.ORCHESTRATOR_TEMPERATURE) {
    const temperature = parseFloat(env.ORCHESTRATOR_TEMPERATURE);
    if (!isNaN(temperature) && temperature >= 0 && temperature <= 2) {
      overridden.operationalSettings.temperature = temperature;
    }
  }

  if (env.ORCHESTRATOR_TIMEOUT_MS) {
    const timeout = parseInt(env.ORCHESTRATOR_TIMEOUT_MS, 10);
    if (!isNaN(timeout) && timeout > 0) {
      overridden.operationalSettings.timeoutMs = timeout;
    }
  }

  return overridden;
}

/**
 * Deep merge two objects
 */
function deepMerge<T extends Record<string, any>>(base: T, override: Partial<T>): T {
  const result = { ...base };

  for (const key in override) {
    const overrideValue = override[key];
    const baseValue = result[key];

    if (
      overrideValue &&
      typeof overrideValue === 'object' &&
      !Array.isArray(overrideValue) &&
      baseValue &&
      typeof baseValue === 'object' &&
      !Array.isArray(baseValue)
    ) {
      result[key as Extract<keyof T, string>] = deepMerge(
        baseValue as Record<string, any>,
        overrideValue as Record<string, any>
      ) as T[Extract<keyof T, string>];
    } else if (overrideValue !== undefined) {
      result[key as Extract<keyof T, string>] = overrideValue as T[Extract<keyof T, string>];
    }
  }

  return result;
}

/**
 * Load partial charter from YAML file (without validation)
 * Used for loading partial configurations to be merged with defaults
 */
async function loadPartialCharter(filePath: string): Promise<Partial<Charter>> {
  try {
    const absolutePath = path.resolve(filePath);
    const fileContent = await fs.readFile(absolutePath, 'utf-8');
    const parsed = parseYaml(fileContent) as unknown;
    return parsed as Partial<Charter>;
  } catch (error) {
    throw new Error(`Failed to load charter from ${filePath}: ${error}`);
  }
}

/**
 * Load charter from YAML file
 */
export async function loadCharterFromFile(filePath: string): Promise<Charter> {
  try {
    const absolutePath = path.resolve(filePath);
    const fileContent = await fs.readFile(absolutePath, 'utf-8');
    const parsed = parseYaml(fileContent) as unknown;

    // Validate against schema
    const validated = CharterSchema.parse(parsed);

    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Charter validation failed: ${error.message}`);
    }
    throw new Error(`Failed to load charter from ${filePath}: ${error}`);
  }
}

/**
 * Load charter with defaults, file overrides, and env overrides
 */
export async function loadCharter(
  filePath?: string,
  options: { useEnvOverrides?: boolean } = {}
): Promise<Charter> {
  let charter = DEFAULT_CHARTER;

  // Load from file if provided (as partial charter for merging)
  if (filePath) {
    try {
      const fileCharter = await loadPartialCharter(filePath);
      charter = deepMerge(charter, fileCharter);
    } catch (error) {
      console.warn(`Failed to load charter from ${filePath}, using defaults:`, error);
    }
  }

  // Apply environment variable overrides
  if (options.useEnvOverrides !== false) {
    charter = applyEnvOverrides(charter);
  }

  // Final validation
  return CharterSchema.parse(charter);
}

/**
 * Get default charter
 */
export function getDefaultCharter(): Charter {
  return { ...DEFAULT_CHARTER };
}

/**
 * Validate charter object
 */
export function validateCharter(charter: unknown): Charter {
  return CharterSchema.parse(charter);
}

/**
 * Save charter to YAML file
 */
export async function saveCharter(charter: Charter, filePath: string): Promise<void> {
  // Validate before saving
  const validated = CharterSchema.parse(charter);

  const yamlContent = stringifyYaml(validated);

  const absolutePath = path.resolve(filePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, yamlContent, 'utf-8');
}
