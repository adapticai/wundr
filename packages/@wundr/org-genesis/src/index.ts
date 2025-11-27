/**
 * @packageDocumentation
 * Org Genesis - Organizational generation and context compilation for AI-managed organizations.
 *
 * This package provides the complete infrastructure for:
 * - Dynamic context compilation based on disciplines
 * - Global agent registry for Charters, Agents, Tools, Hooks
 * - Organizational generation via conversational interface
 * - CLI tools for managing AI organizations
 *
 * @example
 * ```typescript
 * import { createGenesisEngine, createRegistryManager } from '@wundr/org-genesis';
 *
 * // Generate a new organization
 * const genesis = createGenesisEngine();
 * const result = await genesis.generate('Create an AI-managed hedge fund');
 *
 * // Store in registry
 * const registry = createRegistryManager({ storageType: 'file' });
 * await genesis.saveToRegistry(result);
 * ```
 *
 * @module @wundr/org-genesis
 */

// Core types - foundational types for all modules
// These are the canonical definitions, exported first
export * from './types/index.js';

// Utilities - export only what doesn't conflict with types
export {
  generateOrgId,
  generateOrchestratorId,
  generateDisciplineId,
  generateSlug,
  isValidSlug,
} from './utils/slug.js';
export {
  validateAgentDefinition,
  validateDisciplinePack,
} from './utils/validation.js';

// Context Compiler - use selective exports to avoid DisciplineValidationError conflict
export {
  TemplateRenderer,
  createTemplateRenderer,
} from './context-compiler/template-renderer.js';
export {
  DisciplineLoader,
  createDisciplineLoader,
} from './context-compiler/discipline-loader.js';
export {
  ConfigGenerator,
  createConfigGenerator,
} from './context-compiler/config-generator.js';
export {
  WorktreeWriter,
  createWorktreeWriter,
} from './context-compiler/worktree-writer.js';
export {
  ContextCompiler,
  createContextCompiler,
} from './context-compiler/compiler.js';

// Global Registry - use selective exports to avoid RegistryStats conflict
export {
  FileStorage,
  MemoryStorage,
  StorageError,
  CharterRegistry,
  createCharterRegistry,
  DisciplineRegistry,
  createDisciplineRegistry,
  AgentRegistry,
  createAgentRegistry,
  ToolsRegistry,
  createToolsRegistry,
  HooksRegistry,
  createHooksRegistry,
  RegistryManager,
  createRegistryManager,
} from './registry/index.js';

// Organizational Generator - selective exports to avoid type conflicts
export {
  // Prompts
  ORCHESTRATOR_GENERATION_SYSTEM_PROMPT,
  ORCHESTRATOR_GENERATION_USER_PROMPT,
  buildOrchestratorGenerationPrompt,
  parseOrchestratorGenerationResponse,
  DISCIPLINE_GENERATION_SYSTEM_PROMPT,
  DISCIPLINE_GENERATION_USER_PROMPT,
  buildDisciplineGenerationPrompt,
  parseDisciplineGenerationResponse,
  AGENT_GENERATION_SYSTEM_PROMPT,
  AGENT_GENERATION_USER_PROMPT,
  buildAgentGenerationPrompt,
  parseAgentGenerationResponse,
  // Generators
  OrchestratorGenerator,
  createOrchestratorGenerator,
  DisciplineGenerator,
  createDisciplineGenerator,
  AgentGenerator,
  createAgentGenerator,
  ManifestGenerator,
  createManifestGenerator,
  // Genesis Engine
  GenesisEngine,
  createGenesisEngine,
} from './generator/index.js';

export type {
  OrchestratorGenerationContext,
  DisciplineGenerationContext,
  AgentGenerationContext,
  GeneratedAgentPartial,
  OrchestratorGeneratorConfig,
  DisciplineGeneratorConfig,
  AgentGeneratorConfig,
  GenesisEngineConfig,
  GenesisOptions,
  GenesisResult,
} from './generator/index.js';

// Built-in Templates - use selective exports to avoid UNIVERSAL_AGENTS conflict
export {
  ALL_DISCIPLINE_IDS,
  ENGINEERING_DISCIPLINE_ID,
  LEGAL_DISCIPLINE_ID,
  FINANCE_DISCIPLINE_ID,
  MARKETING_DISCIPLINE_ID,
  HR_DISCIPLINE_ID,
  OPERATIONS_DISCIPLINE_ID,
} from './templates/disciplines/index.js';
export {
  ORCHESTRATOR_CHARTER_TEMPLATE_VERSION,
  CHARTER_TEMPLATE_TYPES,
} from './templates/charters/index.js';
export {
  UNIVERSAL_AGENTS_VERSION,
  AGENT_TEMPLATE_CATEGORIES,
} from './templates/agents/index.js';
export { TEMPLATES_VERSION, TEMPLATE_MODULES } from './templates/index.js';

// CLI - command-line interface tools
// Note: CLI has some exports that conflict with generator (GenesisResult, GenesisStats)
// but CLI is designed for standalone usage so conflicts are acceptable in that context.
// Import CLI components directly from '@wundr/org-genesis/cli' for standalone CLI usage.
export {
  createOrgCommand,
  listCommand,
  displayProgress,
  displayResult,
  CLI_MODULE_VERSION,
} from './cli/index.js';
