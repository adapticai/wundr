/**
 * Tester Agent RAG Configuration
 *
 * Specialized RAG configuration for tester agents, optimized for test
 * creation and maintenance with pre-configured queries for finding test
 * patterns, mocking strategies, and test utilities.
 *
 * @module templates/agents/tester-agent-rag
 */

import { createRagAgentConfig, createRagQuery } from './base-rag-agent';

import type { BaseRagAgentConfig, RagQuery } from './base-rag-agent';

/**
 * Tester-specific configuration extensions
 */
export interface TesterAgentRagConfig extends BaseRagAgentConfig {
  /** Testing-specific settings */
  testSettings: {
    /** Testing framework (jest, vitest, mocha, etc.) */
    testFramework: string;
    /** Coverage threshold requirements */
    coverageThresholds: {
      statements: number;
      branches: number;
      functions: number;
      lines: number;
    };
    /** Whether to include integration test patterns */
    includeIntegrationPatterns: boolean;
    /** Whether to include E2E test patterns */
    includeE2ePatterns: boolean;
  };
}

/**
 * Pre-task queries for tester agents
 * These queries run before task execution to build relevant test context
 */
const testerPreTaskQueries: RagQuery[] = [
  // Find test patterns and conventions
  createRagQuery('test patterns describe it expect', {
    fileTypes: ['tests'],
    maxResults: 8,
    minScore: 0.6,
    filters: {
      extensions: ['.test.ts', '.spec.ts', '.test.js', '.spec.js'],
    },
  }),

  // Find mocking strategies
  createRagQuery('mock jest.mock vi.mock stub spy', {
    fileTypes: ['tests'],
    maxResults: 8,
    minScore: 0.5,
    filters: {
      includeSetup: true,
    },
  }),

  // Find test utilities and helpers
  createRagQuery('test utilities helpers fixtures factory', {
    fileTypes: ['tests', 'code'],
    maxResults: 10,
    minScore: 0.5,
    filters: {
      pathPatterns: [
        '**/test/**',
        '**/tests/**',
        '**/__tests__/**',
        '**/fixtures/**',
        '**/factories/**',
      ],
    },
  }),

  // Find existing tests for similar code
  createRagQuery('test coverage implementation', {
    fileTypes: ['tests'],
    maxResults: 5,
    minScore: 0.5,
    filters: {
      excludeSnapshots: true,
    },
  }),

  // Find test setup and configuration
  createRagQuery('beforeEach afterEach setup teardown', {
    fileTypes: ['tests'],
    maxResults: 5,
    minScore: 0.5,
    filters: {
      includeConfig: true,
    },
  }),

  // Find assertion patterns
  createRagQuery('expect toEqual toBe toHaveBeenCalled assertion', {
    fileTypes: ['tests'],
    maxResults: 5,
    minScore: 0.5,
  }),
];

/**
 * Tester-specific system prompt additions
 */
const TESTER_SYSTEM_PROMPT = `
## Tester Agent Responsibilities

You are a specialized testing agent focused on creating comprehensive, maintainable tests.

### Test Creation Guidelines:

1. **Before Writing Tests:**
   - Search for existing test patterns in the codebase
   - Review mocking strategies used for similar modules
   - Check for test utilities and helpers that can be reused
   - Understand the test setup/teardown conventions

2. **Test Quality Requirements:**
   - Follow the project's testing conventions strictly
   - Use existing test utilities and factories
   - Maintain consistent describe/it structure
   - Include both positive and negative test cases
   - Test edge cases and error scenarios

3. **Mocking Best Practices:**
   - Use consistent mocking patterns from the codebase
   - Mock external dependencies appropriately
   - Avoid over-mocking (test real behavior when possible)
   - Reset mocks properly between tests

4. **RAG Search Priorities for Testers:**
   - Test patterns (follow conventions)
   - Mock strategies (consistent mocking)
   - Test utilities (maximize reuse)
   - Fixture data (use established factories)
   - Coverage patterns (ensure completeness)

### Test Structure Template:
\`\`\`typescript
describe('ModuleName', () => {
  // Setup and teardown
  beforeEach(() => { /* setup */ });
  afterEach(() => { /* cleanup */ });

  describe('methodName', () => {
    it('should handle normal case', () => { /* test */ });
    it('should handle edge case', () => { /* test */ });
    it('should throw on invalid input', () => { /* test */ });
  });
});
\`\`\`

### Quality Checklist Before Completion:
- [ ] Tests follow project conventions
- [ ] Mocking is consistent with codebase
- [ ] Test utilities are reused
- [ ] Both happy and error paths tested
- [ ] Edge cases are covered
- [ ] Tests are isolated and repeatable
- [ ] Assertions are meaningful and specific
`.trim();

/**
 * Default coverage thresholds
 */
const DEFAULT_COVERAGE_THRESHOLDS = {
  statements: 80,
  branches: 80,
  functions: 80,
  lines: 80,
};

/**
 * Tester Agent RAG Template
 *
 * Extended from baseRagAgentTemplate with tester-specific configurations.
 */
export const testerAgentRagTemplate: TesterAgentRagConfig = {
  ...createRagAgentConfig({
    id: 'tester-agent-rag',
    name: 'Tester RAG Agent',
    description: 'RAG-enabled agent specialized for test creation with context-aware testing patterns',
    systemPrompt: TESTER_SYSTEM_PROMPT,
    preTaskQueries: testerPreTaskQueries,
    maxContextTokens: 5120, // Good balance for test context
    hooks: {
      preTask: 'rag-context-enhancer',
      postTask: 'rag-impact-analyzer',
      onError: 'tester-error-handler',
    },
  }),
  defaultFileTypes: ['tests', 'code'],
  testSettings: {
    testFramework: 'jest',
    coverageThresholds: DEFAULT_COVERAGE_THRESHOLDS,
    includeIntegrationPatterns: true,
    includeE2ePatterns: false,
  },
};

/**
 * Create a customized tester agent configuration
 *
 * @param overrides - Configuration overrides
 * @returns Customized tester agent configuration
 */
export function createTesterAgentConfig(
  overrides: Partial<TesterAgentRagConfig> = {},
): TesterAgentRagConfig {
  return {
    ...testerAgentRagTemplate,
    ...overrides,
    capabilities: {
      ...testerAgentRagTemplate.capabilities,
      ...overrides.capabilities,
    },
    hooks: {
      ...testerAgentRagTemplate.hooks,
      ...overrides.hooks,
    },
    testSettings: {
      ...testerAgentRagTemplate.testSettings,
      ...overrides.testSettings,
      coverageThresholds: {
        ...testerAgentRagTemplate.testSettings.coverageThresholds,
        ...overrides.testSettings?.coverageThresholds,
      },
    },
    preTaskQueries: overrides.preTaskQueries
      ? [...testerAgentRagTemplate.preTaskQueries, ...overrides.preTaskQueries]
      : testerAgentRagTemplate.preTaskQueries,
  };
}

/**
 * Additional RAG queries for specific testing scenarios
 */
export const testerScenarioQueries = {
  /** Query for unit test patterns */
  unitTest: createRagQuery('unit test isolated mock dependency', {
    fileTypes: ['tests'],
    maxResults: 5,
    filters: {
      pathPatterns: ['**/*.test.ts', '**/*.spec.ts'],
      excludeE2e: true,
      excludeIntegration: true,
    },
  }),

  /** Query for integration test patterns */
  integrationTest: createRagQuery('integration test database API service', {
    fileTypes: ['tests'],
    maxResults: 5,
    filters: {
      pathPatterns: ['**/integration/**', '**/*.integration.test.ts'],
    },
  }),

  /** Query for E2E test patterns */
  e2eTest: createRagQuery('e2e end-to-end browser playwright cypress', {
    fileTypes: ['tests'],
    maxResults: 5,
    filters: {
      pathPatterns: ['**/e2e/**', '**/*.e2e.test.ts'],
    },
  }),

  /** Query for API test patterns */
  apiTest: createRagQuery('API test request response supertest', {
    fileTypes: ['tests'],
    maxResults: 5,
    filters: {
      pathPatterns: ['**/api/**', '**/routes/**'],
    },
  }),

  /** Query for component test patterns */
  componentTest: createRagQuery('component test render screen testing-library', {
    fileTypes: ['tests'],
    maxResults: 5,
    filters: {
      pathPatterns: ['**/components/**'],
    },
  }),

  /** Query for fixture and factory patterns */
  fixtures: createRagQuery('fixture factory builder mock data', {
    fileTypes: ['tests', 'code'],
    maxResults: 5,
    filters: {
      pathPatterns: ['**/fixtures/**', '**/factories/**', '**/mocks/**'],
    },
  }),

  /** Query for snapshot testing */
  snapshotTest: createRagQuery('snapshot toMatchSnapshot toMatchInlineSnapshot', {
    fileTypes: ['tests'],
    maxResults: 5,
  }),
};
