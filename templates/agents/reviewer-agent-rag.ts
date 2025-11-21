/**
 * Reviewer Agent RAG Configuration
 *
 * Specialized RAG configuration for code reviewer agents, optimized for
 * code review tasks with pre-configured queries for finding coding standards,
 * security patterns, and documentation requirements.
 *
 * @module templates/agents/reviewer-agent-rag
 */

import { createRagAgentConfig, createRagQuery } from './base-rag-agent';

import type { BaseRagAgentConfig, RagQuery } from './base-rag-agent';

/**
 * Reviewer-specific configuration extensions
 */
export interface ReviewerAgentRagConfig extends BaseRagAgentConfig {
  /** Review-specific settings */
  reviewSettings: {
    /** Severity levels to check for */
    severityLevels: ('critical' | 'major' | 'minor' | 'suggestion')[];
    /** Categories of issues to focus on */
    focusCategories: string[];
    /** Whether to enforce security checks */
    enforceSecurityChecks: boolean;
    /** Whether to check documentation completeness */
    checkDocumentation: boolean;
    /** Whether to analyze test coverage */
    analyzeTestCoverage: boolean;
  };
}

/**
 * Pre-task queries for reviewer agents
 * These queries run before task execution to build relevant review context
 */
const reviewerPreTaskQueries: RagQuery[] = [
  // Find coding standards and style guides
  createRagQuery('coding standards style guide conventions', {
    fileTypes: ['docs', 'config'],
    maxResults: 8,
    minScore: 0.6,
    filters: {
      pathPatterns: [
        '**/docs/**',
        '**/.eslintrc*',
        '**/prettier*',
        '**/tsconfig*',
        '**/CONTRIBUTING*',
        '**/CLAUDE.md',
      ],
    },
  }),

  // Find security patterns and best practices
  createRagQuery('security validation sanitization authentication authorization', {
    fileTypes: ['code', 'docs'],
    maxResults: 8,
    minScore: 0.5,
    filters: {
      excludeTests: true,
      pathPatterns: ['**/security/**', '**/auth/**', '**/middleware/**'],
    },
  }),

  // Find documentation requirements and patterns
  createRagQuery('documentation JSDoc comments README API docs', {
    fileTypes: ['docs', 'code'],
    maxResults: 8,
    minScore: 0.5,
    filters: {
      includeMarkdown: true,
      includeComments: true,
    },
  }),

  // Find error handling patterns
  createRagQuery('error handling exceptions try catch validation', {
    fileTypes: ['code'],
    maxResults: 5,
    minScore: 0.5,
    filters: {
      excludeTests: true,
    },
  }),

  // Find established patterns for similar code
  createRagQuery('pattern implementation architecture', {
    fileTypes: ['code'],
    maxResults: 5,
    minScore: 0.5,
    filters: {
      excludeTests: true,
      excludeGenerated: true,
    },
  }),

  // Find test coverage patterns
  createRagQuery('test coverage assertion verification', {
    fileTypes: ['tests'],
    maxResults: 5,
    minScore: 0.5,
  }),
];

/**
 * Reviewer-specific system prompt additions
 */
const REVIEWER_SYSTEM_PROMPT = `
## Reviewer Agent Responsibilities

You are a specialized code review agent focused on ensuring code quality, security, and maintainability.

### Code Review Guidelines:

1. **Before Reviewing Code:**
   - Search for project coding standards and conventions
   - Review security patterns used in the codebase
   - Understand documentation requirements
   - Check established patterns for similar functionality

2. **Review Focus Areas:**

   **Critical Issues (Must Fix):**
   - Security vulnerabilities (injection, XSS, authentication bypass)
   - Data leaks or exposure
   - Breaking changes without migration
   - Critical logic errors

   **Major Issues (Should Fix):**
   - Performance problems
   - Memory leaks
   - Missing error handling
   - Inconsistent patterns
   - Missing tests for critical paths

   **Minor Issues (Consider Fixing):**
   - Code style inconsistencies
   - Suboptimal implementations
   - Missing documentation
   - Naming improvements

   **Suggestions (Nice to Have):**
   - Refactoring opportunities
   - Better abstractions
   - Enhanced readability

3. **Security Review Checklist:**
   - [ ] Input validation and sanitization
   - [ ] Authentication/authorization checks
   - [ ] No hardcoded secrets or credentials
   - [ ] Proper error handling (no sensitive data in errors)
   - [ ] SQL/NoSQL injection prevention
   - [ ] XSS prevention
   - [ ] CSRF protection
   - [ ] Rate limiting considerations

4. **RAG Search Priorities for Reviewers:**
   - Coding standards (ensure compliance)
   - Security patterns (verify adherence)
   - Documentation requirements (check completeness)
   - Established patterns (verify consistency)
   - Test coverage (ensure adequacy)

### Review Output Format:
\`\`\`
## Code Review Summary

### Critical Issues
- [File:Line] Description of issue and remediation

### Major Issues
- [File:Line] Description and recommendation

### Minor Issues
- [File:Line] Suggestion for improvement

### Security Findings
- [Severity] Finding and mitigation

### Positive Observations
- Good patterns or practices found
\`\`\`

### Quality Checklist:
- [ ] Security vulnerabilities checked
- [ ] Coding standards verified
- [ ] Documentation reviewed
- [ ] Test coverage analyzed
- [ ] Error handling validated
- [ ] Performance considerations noted
`.trim();

/**
 * Default review settings
 */
const DEFAULT_REVIEW_SETTINGS: ReviewerAgentRagConfig['reviewSettings'] = {
  severityLevels: ['critical', 'major', 'minor', 'suggestion'],
  focusCategories: [
    'security',
    'performance',
    'maintainability',
    'correctness',
    'documentation',
    'testing',
  ],
  enforceSecurityChecks: true,
  checkDocumentation: true,
  analyzeTestCoverage: true,
};

/**
 * Reviewer Agent RAG Template
 *
 * Extended from baseRagAgentTemplate with reviewer-specific configurations.
 */
export const reviewerAgentRagTemplate: ReviewerAgentRagConfig = {
  ...createRagAgentConfig({
    id: 'reviewer-agent-rag',
    name: 'Reviewer RAG Agent',
    description: 'RAG-enabled agent specialized for code review with context-aware quality assessment',
    systemPrompt: REVIEWER_SYSTEM_PROMPT,
    preTaskQueries: reviewerPreTaskQueries,
    maxContextTokens: 8192, // More context for comprehensive reviews
    hooks: {
      preTask: 'rag-context-enhancer',
      postTask: 'rag-impact-analyzer',
      onError: 'reviewer-error-handler',
    },
  }),
  defaultFileTypes: ['code', 'tests', 'docs'],
  reviewSettings: {
    ...DEFAULT_REVIEW_SETTINGS,
  },
};

/**
 * Create a customized reviewer agent configuration
 *
 * @param overrides - Configuration overrides
 * @returns Customized reviewer agent configuration
 */
export function createReviewerAgentConfig(
  overrides: Partial<ReviewerAgentRagConfig> = {},
): ReviewerAgentRagConfig {
  return {
    ...reviewerAgentRagTemplate,
    ...overrides,
    capabilities: {
      ...reviewerAgentRagTemplate.capabilities,
      ...overrides.capabilities,
    },
    hooks: {
      ...reviewerAgentRagTemplate.hooks,
      ...overrides.hooks,
    },
    reviewSettings: {
      ...reviewerAgentRagTemplate.reviewSettings,
      ...overrides.reviewSettings,
      severityLevels: overrides.reviewSettings?.severityLevels
        ?? reviewerAgentRagTemplate.reviewSettings.severityLevels,
      focusCategories: overrides.reviewSettings?.focusCategories
        ?? reviewerAgentRagTemplate.reviewSettings.focusCategories,
    },
    preTaskQueries: overrides.preTaskQueries
      ? [...reviewerAgentRagTemplate.preTaskQueries, ...overrides.preTaskQueries]
      : reviewerAgentRagTemplate.preTaskQueries,
  };
}

/**
 * Additional RAG queries for specific review scenarios
 */
export const reviewerScenarioQueries = {
  /** Query for security review */
  securityReview: createRagQuery('security vulnerability OWASP injection XSS CSRF', {
    fileTypes: ['code', 'docs'],
    maxResults: 8,
    minScore: 0.5,
    filters: {
      pathPatterns: ['**/security/**', '**/auth/**', '**/middleware/**'],
    },
  }),

  /** Query for performance review */
  performanceReview: createRagQuery('performance optimization caching memory', {
    fileTypes: ['code', 'docs'],
    maxResults: 5,
    filters: {
      excludeTests: true,
    },
  }),

  /** Query for API design review */
  apiReview: createRagQuery('API design REST endpoint schema validation', {
    fileTypes: ['code', 'docs'],
    maxResults: 5,
    filters: {
      pathPatterns: ['**/api/**', '**/routes/**', '**/schemas/**'],
    },
  }),

  /** Query for database review */
  databaseReview: createRagQuery('database query index transaction migration', {
    fileTypes: ['code'],
    maxResults: 5,
    filters: {
      pathPatterns: ['**/db/**', '**/models/**', '**/repositories/**'],
    },
  }),

  /** Query for test review */
  testReview: createRagQuery('test coverage mock assertion describe', {
    fileTypes: ['tests'],
    maxResults: 5,
  }),

  /** Query for architecture review */
  architectureReview: createRagQuery('architecture pattern dependency module structure', {
    fileTypes: ['code', 'docs'],
    maxResults: 5,
    filters: {
      includeConfig: true,
    },
  }),

  /** Query for accessibility review */
  accessibilityReview: createRagQuery('accessibility a11y ARIA semantic', {
    fileTypes: ['code', 'docs'],
    maxResults: 5,
    filters: {
      pathPatterns: ['**/components/**', '**/ui/**'],
    },
  }),

  /** Query for dependency review */
  dependencyReview: createRagQuery('dependency package import require version', {
    fileTypes: ['code', 'config'],
    maxResults: 5,
    filters: {
      pathPatterns: ['**/package.json', '**/package-lock.json', '**/yarn.lock'],
    },
  }),
};

/**
 * Review issue severity levels with descriptions
 */
export const REVIEW_SEVERITY = {
  critical: {
    level: 'critical',
    description: 'Must be fixed before merge - security or data integrity risk',
    blocksApproval: true,
  },
  major: {
    level: 'major',
    description: 'Should be fixed - significant quality or maintainability issue',
    blocksApproval: true,
  },
  minor: {
    level: 'minor',
    description: 'Consider fixing - minor quality improvement',
    blocksApproval: false,
  },
  suggestion: {
    level: 'suggestion',
    description: 'Optional - nice to have improvement',
    blocksApproval: false,
  },
} as const;
