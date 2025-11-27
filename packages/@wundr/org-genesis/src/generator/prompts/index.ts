/**
 * @packageDocumentation
 * LLM prompts for organizational generation.
 *
 * This module aggregates and re-exports all prompt templates used for generating
 * organizational structures at each tier of the hierarchy:
 *
 * - **Orchestrator Prompts** (Tier 1): Templates for generating Orchestrator / Orchestrator
 *   agents responsible for node orchestration and resource management.
 *
 * - **Discipline Prompts** (Tier 2): Templates for generating Discipline Packs
 *   representing domains of expertise like Engineering, Legal, HR, etc.
 *
 * - **Agent Prompts** (Tier 3): Templates for generating Sub-Agent definitions
 *   that perform specialized tasks within disciplines.
 *
 * @module generator/prompts
 *
 * @example
 * ```typescript
 * import {
 *   // Orchestrator-level prompts
 *   buildOrchestratorGenerationPrompt,
 *   parseOrchestratorGenerationResponse,
 *   ORCHESTRATOR_GENERATION_SYSTEM_PROMPT,
 *   type OrchestratorGenerationContext,
 *
 *   // Discipline-level prompts
 *   buildDisciplineGenerationPrompt,
 *   parseDisciplineGenerationResponse,
 *   DISCIPLINE_GENERATION_SYSTEM_PROMPT,
 *   type DisciplineGenerationContext,
 *
 *   // Agent-level prompts
 *   buildAgentGenerationPrompt,
 *   parseAgentGenerationResponse,
 *   type AgentGenerationContext,
 * } from '@wundr/org-genesis/generator/prompts';
 * ```
 */

export * from './orchestrator-prompts.js';
export * from './discipline-prompts.js';
export * from './agent-prompts.js';
