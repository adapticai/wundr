/**
 * @packageDocumentation
 * Organizational Generator module for creating AI-powered organizational structures.
 *
 * The generator provides a comprehensive suite of tools for generating organizational
 * structures using LLM-powered generation. It supports the three-tier hierarchy model:
 *
 * ## Architecture Overview
 *
 * The generator creates organizational structures following this hierarchy:
 *
 * ```
 * Organization
 * ├── VPs (Tier 1) - Node Orchestrators
 * │   ├── Disciplines (Tier 2) - Session Manager Archetypes
 * │   │   └── Agents (Tier 3) - Specialized Workers
 * │   └── Disciplines...
 * └── VPs...
 * ```
 *
 * ## Module Components
 *
 * - **Prompts**: LLM prompt templates for each tier generation
 * - **VP Generator**: Creates VP-level agents for node orchestration
 * - **Discipline Generator**: Creates discipline packs for session managers
 * - **Agent Generator**: Creates specialized worker agents
 * - **Manifest Generator**: Creates deployment manifests for fleets
 * - **Genesis Engine**: Orchestrates the full generation pipeline
 *
 * ## Usage
 *
 * The module can be used at different levels of abstraction:
 *
 * ### High-Level (Genesis Engine)
 *
 * Use the Genesis Engine for complete organizational generation from a single prompt:
 *
 * ```typescript
 * import { createGenesisEngine } from '@wundr/org-genesis/generator';
 *
 * const genesis = createGenesisEngine();
 * const result = await genesis.generate('Create an AI-managed hedge fund');
 *
 * console.log(`Generated ${result.stats.vpCount} VPs`);
 * console.log(`Generated ${result.stats.disciplineCount} disciplines`);
 * console.log(`Generated ${result.stats.agentCount} agents`);
 * ```
 *
 * ### Mid-Level (Individual Generators)
 *
 * Use individual generators for finer control:
 *
 * ```typescript
 * import {
 *   VPGenerator,
 *   DisciplineGenerator,
 *   AgentGenerator,
 * } from '@wundr/org-genesis/generator';
 *
 * // Generate VPs first
 * const vpGenerator = new VPGenerator(llmClient);
 * const vps = await vpGenerator.generate(orgContext);
 *
 * // Then disciplines for each VP
 * const disciplineGenerator = new DisciplineGenerator(llmClient);
 * for (const vp of vps) {
 *   const disciplines = await disciplineGenerator.generate(vp);
 * }
 * ```
 *
 * ### Low-Level (Prompt Templates)
 *
 * Use prompt templates directly for maximum control:
 *
 * ```typescript
 * import {
 *   buildVPGenerationPrompt,
 *   parseVPGenerationResponse,
 *   VP_GENERATION_SYSTEM_PROMPT,
 * } from '@wundr/org-genesis/generator/prompts';
 *
 * const userPrompt = buildVPGenerationPrompt(context);
 * const response = await llm.complete({
 *   system: VP_GENERATION_SYSTEM_PROMPT,
 *   user: userPrompt,
 * });
 * const vps = parseVPGenerationResponse(response);
 * ```
 *
 * @module generator
 */

// ============================================================================
// Prompt Templates
// ============================================================================

/**
 * Re-export all prompt templates and utilities.
 *
 * Includes:
 * - VP generation prompts (Tier 1)
 * - Discipline generation prompts (Tier 2)
 * - Agent generation prompts (Tier 3)
 */
export * from './prompts/index.js';

// ============================================================================
// Generators
// ============================================================================

/**
 * VP Generator for creating Tier 1 node orchestrator agents.
 *
 * VPs are responsible for:
 * - Context compilation for their node
 * - Task triage and delegation
 * - Resource management
 * - Performance monitoring
 */
export * from './vp-generator.js';

/**
 * Discipline Generator for creating Tier 2 session manager archetypes.
 *
 * Disciplines represent domains of expertise such as:
 * - Engineering
 * - Legal
 * - HR
 * - Marketing
 * - Finance
 * - Operations
 */
export * from './discipline-generator.js';

/**
 * Agent Generator for creating Tier 3 specialized worker agents.
 *
 * Agents are specialized workers that perform actual tasks:
 * - Code generation
 * - Document analysis
 * - Data processing
 * - API integration
 */
export * from './agent-generator.js';

// ============================================================================
// Manifest Generation
// ============================================================================

/**
 * Manifest Generator for creating deployment manifests.
 *
 * Generates configuration files for deploying organizational fleets:
 * - VP configuration manifests
 * - Discipline pack definitions
 * - Agent deployment specifications
 */
export * from './manifest-generator.js';

// ============================================================================
// Genesis Engine
// ============================================================================

/**
 * Genesis Engine - the core orchestrator for organizational fleet generation.
 *
 * Provides a high-level API for generating complete organizational structures
 * from natural language descriptions.
 */
export * from './genesis-engine.js';
