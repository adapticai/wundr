/* eslint-disable no-console */
/**
 * @fileoverview Interactive Prompt Utilities for Genesis CLI
 * @module @wundr/org-genesis/cli/interactive-prompts
 *
 * This module provides interactive command-line prompt utilities for
 * gathering user input during organization generation. It uses Node.js
 * readline for basic prompts with optional inquirer integration for
 * enhanced features.
 *
 * @example
 * ```typescript
 * import {
 *   promptOrgConfig,
 *   promptVPConfig,
 *   promptConfirm,
 * } from '@wundr/org-genesis/cli';
 *
 * const orgConfig = await promptOrgConfig();
 * const vpConfig = await promptVPConfig();
 * const confirmed = await promptConfirm('Proceed with creation?');
 * ```
 */

import * as readline from 'node:readline';

import type { CreateVPConfig, VPCapability } from '../types/charter.js';
import type { DisciplinePack } from '../types/discipline.js';
import type {
  CreateOrgConfig,
  OrgIndustry,
  OrgSize,
} from '../types/organization.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Choice option for selection prompts.
 *
 * @template T - The type of the value associated with the choice
 */
export interface PromptChoice<T> {
  /**
   * Display name shown to the user.
   */
  name: string;

  /**
   * Value returned when this choice is selected.
   */
  value: T;

  /**
   * Optional description shown below the name.
   */
  description?: string;
}

/**
 * Configuration options for text prompts.
 */
export interface TextPromptOptions {
  /**
   * Default value if user presses Enter without input.
   */
  defaultValue?: string;

  /**
   * Validation function that returns an error message or undefined if valid.
   */
  validate?: (input: string) => string | undefined;

  /**
   * Transform function applied to the input before validation.
   */
  transform?: (input: string) => string;

  /**
   * Whether to mask input (for sensitive data).
   * @default false
   */
  masked?: boolean;
}

/**
 * Configuration options for selection prompts.
 */
export interface SelectPromptOptions {
  /**
   * Default selection index.
   * @default 0
   */
  defaultIndex?: number;
}

// =============================================================================
// INTERNAL UTILITIES
// =============================================================================

/**
 * Creates a readline interface for interactive prompts.
 *
 * @returns A readline interface instance
 * @internal
 */
function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompts for a single line of input using readline.
 *
 * @param rl - The readline interface
 * @param prompt - The prompt message to display
 * @returns Promise resolving to the user's input
 * @internal
 */
function readlineQuestion(
  rl: readline.Interface,
  prompt: string,
): Promise<string> {
  return new Promise(resolve => {
    rl.question(prompt, answer => {
      resolve(answer);
    });
  });
}

/**
 * Formats a prompt message with optional default value.
 *
 * @param message - The base message
 * @param defaultValue - Optional default value to display
 * @returns Formatted prompt string
 * @internal
 */
function formatPrompt(message: string, defaultValue?: string): string {
  if (defaultValue !== undefined) {
    return `${message} [${defaultValue}]: `;
  }
  return `${message}: `;
}

// =============================================================================
// CORE PROMPT FUNCTIONS
// =============================================================================

/**
 * Prompts the user for text input.
 *
 * @param message - The prompt message to display
 * @param defaultValue - Optional default value if user presses Enter
 * @returns Promise resolving to the user's input (or default value)
 *
 * @example
 * ```typescript
 * const name = await promptText('Enter organization name', 'Acme Corp');
 * console.log(`Name: ${name}`);
 * ```
 */
export async function promptText(
  message: string,
  defaultValue?: string,
): Promise<string> {
  const rl = createReadlineInterface();

  try {
    const prompt = formatPrompt(message, defaultValue);
    const answer = await readlineQuestion(rl, prompt);
    const trimmed = answer.trim();

    if (trimmed === '' && defaultValue !== undefined) {
      return defaultValue;
    }

    return trimmed;
  } finally {
    rl.close();
  }
}

/**
 * Prompts the user for text input with advanced options.
 *
 * @param message - The prompt message to display
 * @param options - Configuration options for the prompt
 * @returns Promise resolving to the validated and transformed input
 *
 * @example
 * ```typescript
 * const slug = await promptTextAdvanced('Enter slug', {
 *   defaultValue: 'my-org',
 *   transform: (s) => s.toLowerCase().replace(/\s+/g, '-'),
 *   validate: (s) => s.length < 3 ? 'Slug must be at least 3 characters' : undefined,
 * });
 * ```
 */
export async function promptTextAdvanced(
  message: string,
  options: TextPromptOptions = {},
): Promise<string> {
  const { defaultValue, validate, transform } = options;
  const rl = createReadlineInterface();

  try {
    for (;;) {
      const prompt = formatPrompt(message, defaultValue);
      let answer = await readlineQuestion(rl, prompt);
      answer = answer.trim();

      // Apply default if empty
      if (answer === '' && defaultValue !== undefined) {
        answer = defaultValue;
      }

      // Apply transformation
      if (transform) {
        answer = transform(answer);
      }

      // Validate
      if (validate) {
        const error = validate(answer);
        if (error) {
          console.log(`  Error: ${error}`);
          continue;
        }
      }

      return answer;
    }
  } finally {
    rl.close();
  }
}

/**
 * Prompts the user for confirmation (yes/no).
 *
 * @param message - The confirmation message to display
 * @param defaultValue - Default value if user presses Enter (default: false)
 * @returns Promise resolving to true for yes, false for no
 *
 * @example
 * ```typescript
 * const proceed = await promptConfirm('Do you want to continue?');
 * if (proceed) {
 *   console.log('Continuing...');
 * }
 * ```
 */
export async function promptConfirm(
  message: string,
  defaultValue = false,
): Promise<boolean> {
  const rl = createReadlineInterface();

  try {
    const hint = defaultValue ? '[Y/n]' : '[y/N]';
    const prompt = `${message} ${hint}: `;
    const answer = await readlineQuestion(rl, prompt);
    const trimmed = answer.trim().toLowerCase();

    if (trimmed === '') {
      return defaultValue;
    }

    return trimmed === 'y' || trimmed === 'yes';
  } finally {
    rl.close();
  }
}

/**
 * Prompts the user to select from a list of choices.
 *
 * Displays numbered choices and waits for the user to enter a number.
 *
 * @template T - The type of the choice values
 * @param message - The selection prompt message
 * @param choices - Array of choices with name and value
 * @param options - Optional selection configuration
 * @returns Promise resolving to the selected choice's value
 *
 * @example
 * ```typescript
 * const size = await promptSelect<OrgSize>('Select organization size', [
 *   { name: 'Small (1-50 employees)', value: 'small' },
 *   { name: 'Medium (50-200 employees)', value: 'medium' },
 *   { name: 'Large (200-1000 employees)', value: 'large' },
 *   { name: 'Enterprise (1000+ employees)', value: 'enterprise' },
 * ]);
 * ```
 */
export async function promptSelect<T>(
  message: string,
  choices: PromptChoice<T>[],
  options: SelectPromptOptions = {},
): Promise<T> {
  const rl = createReadlineInterface();
  const { defaultIndex = 0 } = options;

  try {
    console.log(`\n${message}:`);
    choices.forEach((choice, index) => {
      const marker = index === defaultIndex ? '*' : ' ';
      console.log(`  ${marker} ${index + 1}) ${choice.name}`);
      if (choice.description) {
        console.log(`       ${choice.description}`);
      }
    });

    for (;;) {
      const prompt = `Enter selection (1-${choices.length}) [${defaultIndex + 1}]: `;
      const answer = await readlineQuestion(rl, prompt);
      const trimmed = answer.trim();

      // Use default if empty
      if (trimmed === '') {
        return choices[defaultIndex].value;
      }

      const num = parseInt(trimmed, 10);
      if (isNaN(num) || num < 1 || num > choices.length) {
        console.log(`  Please enter a number between 1 and ${choices.length}`);
        continue;
      }

      return choices[num - 1].value;
    }
  } finally {
    rl.close();
  }
}

/**
 * Prompts the user to select multiple items from a list.
 *
 * @template T - The type of the choice values
 * @param message - The selection prompt message
 * @param choices - Array of choices with name and value
 * @returns Promise resolving to an array of selected values
 *
 * @example
 * ```typescript
 * const capabilities = await promptMultiSelect<VPCapability>(
 *   'Select VP capabilities',
 *   [
 *     { name: 'Context Compilation', value: 'context_compilation' },
 *     { name: 'Resource Management', value: 'resource_management' },
 *     { name: 'Session Spawning', value: 'session_spawning' },
 *   ],
 * );
 * ```
 */
export async function promptMultiSelect<T>(
  message: string,
  choices: PromptChoice<T>[],
): Promise<T[]> {
  const rl = createReadlineInterface();

  try {
    console.log(`\n${message} (comma-separated numbers, e.g., 1,3,5):`);
    choices.forEach((choice, index) => {
      console.log(`  ${index + 1}) ${choice.name}`);
      if (choice.description) {
        console.log(`       ${choice.description}`);
      }
    });

    for (;;) {
      const prompt = 'Enter selections: ';
      const answer = await readlineQuestion(rl, prompt);
      const trimmed = answer.trim();

      if (trimmed === '') {
        return [];
      }

      const parts = trimmed.split(',').map(s => s.trim());
      const selected: T[] = [];
      let valid = true;

      for (const part of parts) {
        const num = parseInt(part, 10);
        if (isNaN(num) || num < 1 || num > choices.length) {
          console.log(`  Invalid selection: ${part}`);
          valid = false;
          break;
        }
        selected.push(choices[num - 1].value);
      }

      if (valid) {
        return selected;
      }
    }
  } finally {
    rl.close();
  }
}

// =============================================================================
// DOMAIN-SPECIFIC PROMPTS
// =============================================================================

/**
 * Available organization industries with display names.
 */
const INDUSTRY_CHOICES: PromptChoice<OrgIndustry>[] = [
  {
    name: 'Technology',
    value: 'technology',
    description: 'Software, hardware, and IT services',
  },
  {
    name: 'Finance',
    value: 'finance',
    description: 'Banking, investment, and fintech',
  },
  {
    name: 'Healthcare',
    value: 'healthcare',
    description: 'Medical services and health tech',
  },
  {
    name: 'Legal',
    value: 'legal',
    description: 'Law firms and legal services',
  },
  {
    name: 'Marketing',
    value: 'marketing',
    description: 'Marketing and advertising agencies',
  },
  {
    name: 'Manufacturing',
    value: 'manufacturing',
    description: 'Industrial and consumer goods',
  },
  {
    name: 'Retail',
    value: 'retail',
    description: 'E-commerce and retail businesses',
  },
  {
    name: 'Gaming',
    value: 'gaming',
    description: 'Game development and interactive media',
  },
  {
    name: 'Media',
    value: 'media',
    description: 'Content creation and publishing',
  },
  { name: 'Custom', value: 'custom', description: 'Other industry or domain' },
];

/**
 * Available organization sizes with display names.
 */
const SIZE_CHOICES: PromptChoice<OrgSize>[] = [
  { name: 'Small', value: 'small', description: '1-5 VPs, 2-4 disciplines' },
  { name: 'Medium', value: 'medium', description: '5-15 VPs, 4-8 disciplines' },
  { name: 'Large', value: 'large', description: '15-50 VPs, 8-15 disciplines' },
  {
    name: 'Enterprise',
    value: 'enterprise',
    description: '50+ VPs, 15+ disciplines',
  },
];

/**
 * Available VP capabilities with display names.
 */
const VP_CAPABILITY_CHOICES: PromptChoice<VPCapability>[] = [
  {
    name: 'Context Compilation',
    value: 'context_compilation',
    description: 'Gather and synthesize context',
  },
  {
    name: 'Resource Management',
    value: 'resource_management',
    description: 'Allocate computational resources',
  },
  {
    name: 'Slack Operations',
    value: 'slack_operations',
    description: 'Interact with Slack workspaces',
  },
  {
    name: 'Session Spawning',
    value: 'session_spawning',
    description: 'Create session managers',
  },
  {
    name: 'Task Triage',
    value: 'task_triage',
    description: 'Analyze and route tasks',
  },
  {
    name: 'Memory Management',
    value: 'memory_management',
    description: 'Manage persistent memory',
  },
];

/**
 * Prompts for complete organization configuration.
 *
 * Walks the user through all required fields for creating a new organization,
 * including name, mission, industry, size, and optional settings.
 *
 * @returns Promise resolving to a complete CreateOrgConfig object
 *
 * @example
 * ```typescript
 * const orgConfig = await promptOrgConfig();
 * console.log(`Creating org: ${orgConfig.name}`);
 * console.log(`Industry: ${orgConfig.industry}`);
 * console.log(`Size: ${orgConfig.size}`);
 * ```
 */
export async function promptOrgConfig(): Promise<CreateOrgConfig> {
  console.log('\n=== Organization Configuration ===\n');

  // Required fields
  const name = await promptTextAdvanced('Organization name', {
    validate: s =>
      s.length < 2 ? 'Name must be at least 2 characters' : undefined,
  });

  const mission = await promptTextAdvanced('Mission statement', {
    validate: s =>
      s.length < 10 ? 'Mission must be at least 10 characters' : undefined,
  });

  const industry = await promptSelect<OrgIndustry>(
    'Select industry',
    INDUSTRY_CHOICES,
  );

  const size = await promptSelect<OrgSize>(
    'Select organization size',
    SIZE_CHOICES,
  );

  // Optional fields
  const includeOptional = await promptConfirm(
    'Configure optional settings?',
    false,
  );

  let description: string | undefined;
  let slug: string | undefined;
  let generateDisciplines = true;
  let generateAgents = true;
  let dryRun = false;

  if (includeOptional) {
    description = await promptText(
      'Description (optional, press Enter to skip)',
    );
    if (description === '') {
      description = undefined;
    }

    const defaultSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    slug = await promptText('URL slug', defaultSlug);
    if (slug === defaultSlug) {
      slug = undefined; // Use auto-generated
    }

    generateDisciplines = await promptConfirm(
      'Auto-generate discipline structures?',
      true,
    );

    generateAgents = await promptConfirm(
      'Auto-generate agents for each discipline?',
      true,
    );

    dryRun = await promptConfirm(
      'Dry run mode (no actual provisioning)?',
      false,
    );
  }

  return {
    name,
    mission,
    industry,
    size,
    description,
    slug,
    generateDisciplines,
    generateAgents,
    dryRun,
  };
}

/**
 * Prompts for VP (Virtual Persona) configuration.
 *
 * Walks the user through all required fields for creating a new VP,
 * including name, persona, capabilities, and optional settings.
 *
 * @returns Promise resolving to a complete CreateVPConfig object
 *
 * @example
 * ```typescript
 * const vpConfig = await promptVPConfig();
 * console.log(`Creating VP: ${vpConfig.name}`);
 * console.log(`Capabilities: ${vpConfig.capabilities?.join(', ')}`);
 * ```
 */
export async function promptVPConfig(): Promise<CreateVPConfig> {
  console.log('\n=== VP (Virtual Persona) Configuration ===\n');

  // Required fields
  const name = await promptTextAdvanced('VP name', {
    validate: s =>
      s.length < 2 ? 'Name must be at least 2 characters' : undefined,
  });

  const persona = await promptTextAdvanced('Persona description', {
    validate: s =>
      s.length < 10 ? 'Persona must be at least 10 characters' : undefined,
  });

  // Capabilities selection
  const selectCapabilities = await promptConfirm(
    'Select specific capabilities? (default: all)',
    false,
  );

  let capabilities: VPCapability[] | undefined;
  if (selectCapabilities) {
    capabilities = await promptMultiSelect<VPCapability>(
      'Select VP capabilities',
      VP_CAPABILITY_CHOICES,
    );
    if (capabilities.length === 0) {
      capabilities = undefined; // Use defaults
    }
  }

  // Optional fields
  const includeOptional = await promptConfirm(
    'Configure optional settings?',
    false,
  );

  let slackHandle: string | undefined;
  let mcpTools: string[] | undefined;

  if (includeOptional) {
    slackHandle = await promptText('Slack handle (optional, without @)');
    if (slackHandle === '') {
      slackHandle = undefined;
    }

    const toolsInput = await promptText(
      'MCP tools (comma-separated, or Enter to skip)',
    );
    if (toolsInput !== '') {
      mcpTools = toolsInput
        .split(',')
        .map(s => s.trim())
        .filter(s => s !== '');
    }
  }

  return {
    name,
    persona,
    slackHandle,
    capabilities,
    mcpTools,
  };
}

/**
 * Prompts the user to select a discipline from available packs.
 *
 * Displays a list of discipline packs with their categories and descriptions,
 * allowing the user to select one.
 *
 * @param available - Array of available discipline packs
 * @returns Promise resolving to the selected DisciplinePack
 *
 * @example
 * ```typescript
 * const disciplines = await getDisciplinePacks();
 * const selected = await promptDisciplineSelection(disciplines);
 * console.log(`Selected: ${selected.name}`);
 * ```
 */
export async function promptDisciplineSelection(
  available: DisciplinePack[],
): Promise<DisciplinePack> {
  if (available.length === 0) {
    throw new Error('No discipline packs available for selection');
  }

  const choices: PromptChoice<DisciplinePack>[] = available.map(pack => ({
    name: `${pack.name} [${pack.category}]`,
    value: pack,
    description: pack.description,
  }));

  return promptSelect<DisciplinePack>('Select a discipline', choices);
}

/**
 * Prompts for a number within a specified range.
 *
 * @param message - The prompt message
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @param defaultValue - Optional default value
 * @returns Promise resolving to the entered number
 *
 * @example
 * ```typescript
 * const vpCount = await promptNumber('Number of VPs to create', 1, 50, 5);
 * ```
 */
export async function promptNumber(
  message: string,
  min: number,
  max: number,
  defaultValue?: number,
): Promise<number> {
  const rl = createReadlineInterface();

  try {
    for (;;) {
      const rangeHint = `(${min}-${max})`;
      let prompt: string;
      if (defaultValue !== undefined) {
        prompt = `${message} ${rangeHint} [${defaultValue}]: `;
      } else {
        prompt = `${message} ${rangeHint}: `;
      }

      const answer = await readlineQuestion(rl, prompt);
      const trimmed = answer.trim();

      if (trimmed === '' && defaultValue !== undefined) {
        return defaultValue;
      }

      const num = parseInt(trimmed, 10);
      if (isNaN(num)) {
        console.log('  Please enter a valid number');
        continue;
      }

      if (num < min || num > max) {
        console.log(`  Number must be between ${min} and ${max}`);
        continue;
      }

      return num;
    }
  } finally {
    rl.close();
  }
}

/**
 * Prompts for a password or secret (masked input).
 *
 * Note: In the basic readline implementation, masking is simulated
 * by not echoing input. For true masked input, use inquirer integration.
 *
 * @param message - The prompt message
 * @returns Promise resolving to the entered secret
 *
 * @example
 * ```typescript
 * const apiKey = await promptSecret('Enter API key');
 * ```
 */
export async function promptSecret(message: string): Promise<string> {
  const rl = createReadlineInterface();

  try {
    // Note: True masking requires TTY manipulation not available in basic readline
    // This is a simple implementation that still shows input
    const prompt = `${message}: `;
    const answer = await readlineQuestion(rl, prompt);
    return answer.trim();
  } finally {
    rl.close();
  }
}

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

/**
 * Pre-defined industry choices for external use.
 */
export { INDUSTRY_CHOICES };

/**
 * Pre-defined size choices for external use.
 */
export { SIZE_CHOICES };

/**
 * Pre-defined VP capability choices for external use.
 */
export { VP_CAPABILITY_CHOICES };
