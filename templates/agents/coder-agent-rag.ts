/**
 * Coder Agent RAG Configuration
 *
 * Specialized RAG configuration for coder agents, optimized for code
 * implementation tasks with pre-configured queries for finding existing
 * implementations, coding conventions, and utility functions.
 *
 * @module templates/agents/coder-agent-rag
 */

import { createRagAgentConfig, createRagQuery } from './base-rag-agent';

import type { BaseRagAgentConfig, RagQuery } from './base-rag-agent';

/**
 * Coder-specific configuration extensions
 */
export interface CoderAgentRagConfig extends BaseRagAgentConfig {
  /** Code-specific settings */
  codeSettings: {
    /** Preferred language for implementations */
    preferredLanguages: string[];
    /** Whether to search for type definitions */
    includeTypeDefinitions: boolean;
    /** Whether to include imports analysis */
    analyzeImports: boolean;
  };
}

/**
 * Pre-task queries for coder agents
 * These queries run before task execution to build relevant context
 */
const coderPreTaskQueries: RagQuery[] = [
  // Find existing implementations
  createRagQuery('existing implementations similar functionality', {
    fileTypes: ['code'],
    maxResults: 5,
    minScore: 0.6,
    filters: {
      excludeTests: true,
      excludeGenerated: true,
    },
  }),

  // Find coding conventions and patterns
  createRagQuery('coding conventions style patterns', {
    fileTypes: ['code', 'config'],
    maxResults: 5,
    minScore: 0.5,
    filters: {
      includeBase: true,
      includeTemplates: true,
    },
  }),

  // Find utility functions and helpers
  createRagQuery('utility functions helpers common', {
    fileTypes: ['code'],
    maxResults: 10,
    minScore: 0.5,
    filters: {
      pathPatterns: ['**/utils/**', '**/helpers/**', '**/common/**', '**/shared/**'],
    },
  }),

  // Find type definitions and interfaces
  createRagQuery('type definitions interfaces models', {
    fileTypes: ['code'],
    maxResults: 8,
    minScore: 0.5,
    filters: {
      pathPatterns: ['**/types/**', '**/interfaces/**', '**/models/**'],
      extensions: ['.ts', '.d.ts'],
    },
  }),

  // Find error handling patterns
  createRagQuery('error handling exceptions validation', {
    fileTypes: ['code'],
    maxResults: 5,
    minScore: 0.5,
    filters: {
      excludeTests: true,
    },
  }),
];

/**
 * Coder-specific system prompt additions
 */
const CODER_SYSTEM_PROMPT = `
## Coder Agent Responsibilities

You are a specialized coding agent focused on implementing clean, maintainable code.

### Code Implementation Guidelines:

1. **Before Writing New Code:**
   - Search for existing implementations that solve similar problems
   - Check for established patterns in the codebase
   - Review utility functions that could be reused
   - Understand the project's type system and conventions

2. **Code Quality Requirements:**
   - Follow the project's coding conventions strictly
   - Use existing utility functions instead of reimplementing
   - Maintain consistent naming patterns
   - Include proper TypeScript types and documentation
   - Handle errors consistently with existing patterns

3. **Integration Considerations:**
   - Import from established module paths
   - Follow the project's module structure
   - Ensure compatibility with existing interfaces
   - Consider impact on dependent modules

4. **RAG Search Priorities for Coders:**
   - Similar implementations (avoid duplication)
   - Utility functions (maximize reuse)
   - Type definitions (ensure type safety)
   - Error handling patterns (maintain consistency)
   - Configuration patterns (follow conventions)

### Quality Checklist Before Completion:
- [ ] Code follows project conventions
- [ ] No duplicate functionality created
- [ ] Existing utilities are reused where applicable
- [ ] Types are properly defined
- [ ] Error handling follows established patterns
- [ ] Imports use correct module paths
`.trim();

/**
 * Coder Agent RAG Template
 *
 * Extended from baseRagAgentTemplate with coder-specific configurations.
 */
export const coderAgentRagTemplate: CoderAgentRagConfig = {
  ...createRagAgentConfig({
    id: 'coder-agent-rag',
    name: 'Coder RAG Agent',
    description: 'RAG-enabled agent specialized for code implementation with context-aware development',
    systemPrompt: CODER_SYSTEM_PROMPT,
    preTaskQueries: coderPreTaskQueries,
    maxContextTokens: 6144, // More context for code implementations
    hooks: {
      preTask: 'rag-context-enhancer',
      postTask: 'rag-impact-analyzer',
      onError: 'coder-error-handler',
    },
  }),
  defaultFileTypes: ['code', 'config'],
  codeSettings: {
    preferredLanguages: ['typescript', 'javascript'],
    includeTypeDefinitions: true,
    analyzeImports: true,
  },
};

/**
 * Create a customized coder agent configuration
 *
 * @param overrides - Configuration overrides
 * @returns Customized coder agent configuration
 */
export function createCoderAgentConfig(
  overrides: Partial<CoderAgentRagConfig> = {},
): CoderAgentRagConfig {
  return {
    ...coderAgentRagTemplate,
    ...overrides,
    capabilities: {
      ...coderAgentRagTemplate.capabilities,
      ...overrides.capabilities,
    },
    hooks: {
      ...coderAgentRagTemplate.hooks,
      ...overrides.hooks,
    },
    codeSettings: {
      ...coderAgentRagTemplate.codeSettings,
      ...overrides.codeSettings,
    },
    preTaskQueries: overrides.preTaskQueries
      ? [...coderAgentRagTemplate.preTaskQueries, ...overrides.preTaskQueries]
      : coderAgentRagTemplate.preTaskQueries,
  };
}

/**
 * Additional RAG queries for specific coding scenarios
 */
export const coderScenarioQueries = {
  /** Query for API endpoint implementations */
  apiEndpoint: createRagQuery('API endpoint route handler controller', {
    fileTypes: ['code'],
    maxResults: 5,
    filters: {
      pathPatterns: ['**/routes/**', '**/controllers/**', '**/api/**'],
    },
  }),

  /** Query for database operations */
  databaseOps: createRagQuery('database repository query model', {
    fileTypes: ['code'],
    maxResults: 5,
    filters: {
      pathPatterns: ['**/repositories/**', '**/models/**', '**/db/**'],
    },
  }),

  /** Query for service layer patterns */
  serviceLayer: createRagQuery('service layer business logic', {
    fileTypes: ['code'],
    maxResults: 5,
    filters: {
      pathPatterns: ['**/services/**'],
    },
  }),

  /** Query for middleware implementations */
  middleware: createRagQuery('middleware handler interceptor', {
    fileTypes: ['code'],
    maxResults: 5,
    filters: {
      pathPatterns: ['**/middleware/**', '**/interceptors/**'],
    },
  }),

  /** Query for configuration patterns */
  configuration: createRagQuery('configuration settings environment', {
    fileTypes: ['code', 'config'],
    maxResults: 5,
    filters: {
      pathPatterns: ['**/config/**', '**/settings/**'],
    },
  }),
};
