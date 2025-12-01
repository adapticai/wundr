/**
 * RAG Context Enhancer Hook Configuration
 *
 * Default configuration with trigger patterns, search settings, and priorities.
 *
 * @module hooks/rag-context-enhancer/config
 */

import type {
  RagContextHookConfig,
  TriggerPattern,
  SearchConfig,
  PrioritySettings,
} from './types';

// =============================================================================
// Question Patterns - Identify questions that benefit from RAG context
// =============================================================================

/**
 * Patterns for questions about code location and implementation
 */
const questionPatterns: TriggerPattern[] = [
  {
    id: 'where-implemented',
    description: 'Questions about where something is implemented',
    pattern:
      /where\s+(?:is|are|was|were)\s+(.+?)\s*(?:implemented|defined|declared|located|found)/i,
    type: 'question',
    weight: 0.9,
    suggestedGoal: 'understanding',
    queryTemplates: ['$1 implementation', '$1 definition', 'function $1'],
  },
  {
    id: 'how-does-work',
    description: 'Questions about how something works',
    pattern:
      /how\s+(?:does|do|did)\s+(.+?)\s*(?:work|function|operate|behave)/i,
    type: 'question',
    weight: 0.85,
    suggestedGoal: 'understanding',
    queryTemplates: ['$1 implementation', '$1 logic', '$1 flow'],
  },
  {
    id: 'find-usages',
    description: 'Questions about finding usages of something',
    pattern:
      /(?:find|show|list|get)\s+(?:all\s+)?(?:usages?|references?|occurrences?|instances?)\s+(?:of\s+)?(.+)/i,
    type: 'question',
    weight: 0.95,
    suggestedGoal: 'analysis',
    queryTemplates: ['$1 usage', '$1 import', '$1 call'],
  },
  {
    id: 'what-calls',
    description: 'Questions about what calls a function',
    pattern: /what\s+(?:calls?|uses?|invokes?|imports?)\s+(.+)/i,
    type: 'question',
    weight: 0.85,
    suggestedGoal: 'analysis',
    queryTemplates: ['$1 call', '$1 import', '$1 usage'],
  },
  {
    id: 'where-defined',
    description: 'Questions about where something is defined',
    pattern:
      /where\s+(?:is|are)\s+(?:the\s+)?(.+?)\s*(?:defined|declared|created)/i,
    type: 'question',
    weight: 0.9,
    suggestedGoal: 'understanding',
    queryTemplates: ['$1 definition', 'const $1', 'function $1', 'class $1'],
  },
  {
    id: 'what-is',
    description: 'Questions about what something is',
    pattern:
      /what\s+(?:is|are)\s+(?:the\s+)?(.+?)(?:\s+used\s+for|\s+doing|\?|$)/i,
    type: 'question',
    weight: 0.7,
    suggestedGoal: 'understanding',
    queryTemplates: ['$1 purpose', '$1 documentation', '$1 definition'],
  },
  {
    id: 'explain',
    description: 'Requests to explain code or concepts',
    pattern: /(?:explain|describe|walk\s+(?:me\s+)?through)\s+(?:how\s+)?(.+)/i,
    type: 'question',
    weight: 0.75,
    suggestedGoal: 'understanding',
    queryTemplates: ['$1 implementation', '$1 overview', '$1 documentation'],
  },
  {
    id: 'show-code',
    description: 'Requests to show specific code',
    pattern:
      /(?:show|display|print|output)\s+(?:me\s+)?(?:the\s+)?(?:code\s+(?:for|in)\s+)?(.+)/i,
    type: 'question',
    weight: 0.8,
    suggestedGoal: 'understanding',
    queryTemplates: ['$1 source', '$1 implementation', '$1 code'],
  },
];

// =============================================================================
// Action Patterns - Identify actions that require codebase context
// =============================================================================

/**
 * Patterns for actions that modify code across the codebase
 */
const actionPatterns: TriggerPattern[] = [
  {
    id: 'refactor',
    description: 'Refactoring requests',
    pattern: /(?:refactor|restructure|reorganize|rewrite)\s+(.+)/i,
    type: 'action',
    weight: 0.95,
    suggestedGoal: 'refactoring',
    queryTemplates: ['$1 implementation', '$1 usages', '$1 tests'],
  },
  {
    id: 'migrate',
    description: 'Migration requests',
    pattern: /(?:migrate|upgrade|convert|port)\s+(.+?)(?:\s+to\s+|\s+from\s+)/i,
    type: 'action',
    weight: 0.95,
    suggestedGoal: 'migration',
    queryTemplates: [
      '$1 implementation',
      '$1 configuration',
      '$1 dependencies',
    ],
  },
  {
    id: 'update-across',
    description: 'Updates across multiple files',
    pattern:
      /(?:update|change|modify)\s+(?:all\s+)?(.+?)\s+(?:across|throughout|in\s+all)/i,
    type: 'action',
    weight: 0.95,
    suggestedGoal: 'refactoring',
    queryTemplates: ['$1 usage', '$1 implementation', '$1 occurrences'],
  },
  {
    id: 'change-all',
    description: 'Changing all occurrences',
    pattern:
      /(?:change|replace|rename)\s+all\s+(?:occurrences?\s+of\s+)?(.+?)(?:\s+to\s+|\s+with\s+)/i,
    type: 'action',
    weight: 0.95,
    suggestedGoal: 'refactoring',
    queryTemplates: ['$1 usage', '$1 references', '$1 occurrences'],
  },
  {
    id: 'implement-feature',
    description: 'Feature implementation requests',
    pattern:
      /(?:implement|add|create|build)\s+(?:a\s+)?(?:new\s+)?(.+?)(?:\s+feature|\s+functionality|\s+component)/i,
    type: 'action',
    weight: 0.8,
    suggestedGoal: 'implementation',
    queryTemplates: ['similar $1', '$1 pattern', 'existing $1'],
  },
  {
    id: 'fix-bug',
    description: 'Bug fix requests',
    pattern:
      /(?:fix|resolve|debug|repair)\s+(?:the\s+)?(?:bug|issue|problem|error)\s+(?:in|with|where)\s+(.+)/i,
    type: 'action',
    weight: 0.85,
    suggestedGoal: 'debugging',
    queryTemplates: ['$1 implementation', '$1 error handling', '$1 tests'],
  },
  {
    id: 'add-tests',
    description: 'Test addition requests',
    pattern: /(?:add|write|create)\s+(?:unit\s+)?tests?\s+(?:for\s+)?(.+)/i,
    type: 'action',
    weight: 0.85,
    suggestedGoal: 'testing',
    queryTemplates: ['$1 implementation', '$1 tests', '$1 mock'],
  },
  {
    id: 'remove-deprecation',
    description: 'Deprecation removal requests',
    pattern:
      /(?:remove|eliminate|get\s+rid\s+of)\s+(?:all\s+)?(?:deprecated|obsolete)\s+(.+)/i,
    type: 'action',
    weight: 0.9,
    suggestedGoal: 'migration',
    queryTemplates: ['deprecated $1', '$1 usage', '$1 replacement'],
  },
  {
    id: 'extract',
    description: 'Extraction/abstraction requests',
    pattern:
      /(?:extract|abstract|pull\s+out|separate)\s+(.+?)(?:\s+into|\s+from)/i,
    type: 'action',
    weight: 0.85,
    suggestedGoal: 'refactoring',
    queryTemplates: ['$1 implementation', '$1 usage', '$1 dependencies'],
  },
];

// =============================================================================
// Complexity Patterns - Identify indicators of cross-cutting concerns
// =============================================================================

/**
 * Patterns indicating cross-cutting or complex operations
 */
const complexityPatterns: TriggerPattern[] = [
  {
    id: 'multiple-files',
    description: 'Mentions of multiple files',
    pattern: /(?:multiple|several|many|all)\s+files?/i,
    type: 'complexity',
    weight: 0.8,
    suggestedGoal: 'analysis',
  },
  {
    id: 'cross-cutting',
    description: 'Cross-cutting concern indicators',
    pattern: /(?:cross[\s-]?cutting|throughout|everywhere|codebase[\s-]?wide)/i,
    type: 'complexity',
    weight: 0.9,
    suggestedGoal: 'analysis',
  },
  {
    id: 'entire-codebase',
    description: 'Entire codebase scope',
    pattern: /(?:entire|whole|full)\s+(?:codebase|project|repository|repo)/i,
    type: 'complexity',
    weight: 0.95,
    suggestedGoal: 'analysis',
  },
  {
    id: 'all-instances',
    description: 'All instances indicator',
    pattern: /all\s+(?:instances?|occurrences?|usages?|references?|places?)/i,
    type: 'complexity',
    weight: 0.85,
    suggestedGoal: 'analysis',
  },
  {
    id: 'global-change',
    description: 'Global change indicator',
    pattern: /(?:global(?:ly)?|project[\s-]?wide|everywhere)/i,
    type: 'complexity',
    weight: 0.85,
    suggestedGoal: 'refactoring',
  },
  {
    id: 'dependency-impact',
    description: 'Dependency impact concerns',
    pattern: /(?:dependencies|dependents|affects?|impacts?)\s+(?:on|by|what)/i,
    type: 'complexity',
    weight: 0.75,
    suggestedGoal: 'analysis',
  },
  {
    id: 'breaking-changes',
    description: 'Breaking change concerns',
    pattern: /(?:breaking\s+changes?|backwards?\s+compatib|impact\s+analysis)/i,
    type: 'complexity',
    weight: 0.9,
    suggestedGoal: 'analysis',
  },
  {
    id: 'architecture',
    description: 'Architecture level concerns',
    pattern: /(?:architecture|system[\s-]?wide|infrastructure|platform)/i,
    type: 'complexity',
    weight: 0.8,
    suggestedGoal: 'understanding',
  },
];

// =============================================================================
// Default Search Configuration
// =============================================================================

/**
 * Default search configuration for RAG queries
 */
const defaultSearchConfig: SearchConfig = {
  maxResults: 15,
  minRelevanceScore: 0.5,
  maxContextTokens: 8000,
  includePatterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.md'],
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/coverage/**',
    '**/*.min.js',
    '**/*.map',
    '**/package-lock.json',
    '**/pnpm-lock.yaml',
  ],
  prioritization: 'relevance',
  deduplicate: true,
  maxChunksPerFile: 5,
};

// =============================================================================
// Priority Settings
// =============================================================================

/**
 * Priority settings for hook execution
 */
const prioritySettings: PrioritySettings = {
  minConfidenceThreshold: 0.6,
  patternWeights: {
    question: 0.8,
    action: 0.9,
    complexity: 0.7,
  },
  multiMatchBoost: 0.15,
  maxQueries: 5,
};

// =============================================================================
// Default Configuration Export
// =============================================================================

/**
 * Default RAG context enhancer hook configuration
 */
export const defaultConfig: RagContextHookConfig = {
  enabled: true,
  name: 'rag-context-enhancer',
  description:
    'Pre-action hook that analyzes requests and injects relevant RAG context',
  version: '1.0.0',
  questionPatterns,
  actionPatterns,
  complexityPatterns,
  defaultSearchConfig,
  priority: prioritySettings,
  cache: {
    enabled: true,
    ttlMs: 300000, // 5 minutes
    maxEntries: 100,
  },
  logging: {
    level: 'info',
    logMatches: true,
    logQueries: true,
    logTiming: true,
  },
};

/**
 * Question pattern regexes for quick access
 */
export const questionPatternRegexes: readonly RegExp[] = questionPatterns.map(
  p => p.pattern
);

/**
 * Action pattern regexes for quick access
 */
export const actionPatternRegexes: readonly RegExp[] = actionPatterns.map(
  p => p.pattern
);

/**
 * Complexity pattern regexes for quick access
 */
export const complexityPatternRegexes: readonly RegExp[] =
  complexityPatterns.map(p => p.pattern);

/**
 * All trigger pattern regexes combined
 */
export const allTriggerPatternRegexes: readonly RegExp[] = [
  ...questionPatternRegexes,
  ...actionPatternRegexes,
  ...complexityPatternRegexes,
];

export default defaultConfig;
