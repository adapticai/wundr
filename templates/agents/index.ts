/**
 * Agent Templates Module
 *
 * This module exports all RAG-enabled agent templates and their configurations.
 * Use these templates to create specialized agents with built-in RAG capabilities
 * for context-aware task execution.
 *
 * @module templates/agents
 *
 * @example
 * ```typescript
 * import {
 *   baseRagAgentTemplate,
 *   coderAgentRagTemplate,
 *   testerAgentRagTemplate,
 *   reviewerAgentRagTemplate,
 *   createCoderAgentConfig,
 * } from '@wundr/templates/agents';
 *
 * // Use a pre-configured template directly
 * const coderAgent = coderAgentRagTemplate;
 *
 * // Or create a customized configuration
 * const customCoder = createCoderAgentConfig({
 *   maxContextTokens: 8192,
 *   codeSettings: {
 *     preferredLanguages: ['typescript', 'python'],
 *   },
 * });
 * ```
 */

// Base RAG Agent Template
export {
  baseRagAgentTemplate,
  createRagAgentConfig,
  createRagQuery,
  isValidRagAgentConfig,
} from './base-rag-agent';

export type {
  BaseRagAgentConfig,
  RagCapabilities,
  RagQuery,
  RagSearchResult,
  RagContextEnhancement,
  RagImpactAnalysis,
  AgentHooks,
} from './base-rag-agent';

// Coder Agent RAG Template
export {
  coderAgentRagTemplate,
  createCoderAgentConfig,
  coderScenarioQueries,
} from './coder-agent-rag';

export type { CoderAgentRagConfig } from './coder-agent-rag';

// Tester Agent RAG Template
export {
  testerAgentRagTemplate,
  createTesterAgentConfig,
  testerScenarioQueries,
} from './tester-agent-rag';

export type { TesterAgentRagConfig } from './tester-agent-rag';

// Reviewer Agent RAG Template
export {
  reviewerAgentRagTemplate,
  createReviewerAgentConfig,
  reviewerScenarioQueries,
  REVIEW_SEVERITY,
} from './reviewer-agent-rag';

export type { ReviewerAgentRagConfig } from './reviewer-agent-rag';

/**
 * All available agent templates
 */
export const agentTemplates = {
  base: 'base-rag-agent',
  coder: 'coder-agent-rag',
  tester: 'tester-agent-rag',
  reviewer: 'reviewer-agent-rag',
} as const;

/**
 * Type representing all available agent template IDs
 */
export type AgentTemplateId = typeof agentTemplates[keyof typeof agentTemplates];

/**
 * Template registry mapping IDs to template configurations
 */
const templateRegistry = {
  'base-rag-agent': baseRagAgentTemplate,
  'coder-agent-rag': coderAgentRagTemplate,
  'tester-agent-rag': testerAgentRagTemplate,
  'reviewer-agent-rag': reviewerAgentRagTemplate,
} as const;

/**
 * Get an agent template by ID
 *
 * @param templateId - The template ID to retrieve
 * @returns The corresponding agent template configuration
 */
export function getAgentTemplate(templateId: AgentTemplateId): BaseRagAgentConfig {
  const template = templateRegistry[templateId];
  if (!template) {
    throw new Error(`Unknown agent template: ${templateId}`);
  }

  return template;
}

/**
 * List all available agent templates with their metadata
 *
 * @returns Array of template summaries
 */
export function listAgentTemplates(): Array<{
  id: AgentTemplateId;
  name: string;
  description: string;
  defaultFileTypes: string[];
}> {
  return [
    {
      id: 'base-rag-agent' as const,
      name: baseRagAgentTemplate.name,
      description: baseRagAgentTemplate.description ?? '',
      defaultFileTypes: baseRagAgentTemplate.defaultFileTypes,
    },
    {
      id: 'coder-agent-rag' as const,
      name: coderAgentRagTemplate.name,
      description: coderAgentRagTemplate.description ?? '',
      defaultFileTypes: coderAgentRagTemplate.defaultFileTypes,
    },
    {
      id: 'tester-agent-rag' as const,
      name: testerAgentRagTemplate.name,
      description: testerAgentRagTemplate.description ?? '',
      defaultFileTypes: testerAgentRagTemplate.defaultFileTypes,
    },
    {
      id: 'reviewer-agent-rag' as const,
      name: reviewerAgentRagTemplate.name,
      description: reviewerAgentRagTemplate.description ?? '',
      defaultFileTypes: reviewerAgentRagTemplate.defaultFileTypes,
    },
  ];
}
