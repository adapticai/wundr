/**
 * Context Detector for Dynamic Prompting System
 *
 * Analyzes content, file paths, and user hints to detect the domain
 * and task type for intelligent persona selection.
 *
 * @module mcp-tools/dynamic-prompting/context-detector
 */

import type {
  ContextSignals,
  DetectedContext,
  DetectionRule,
  DomainType,
  TaskType,
} from './types.js';

/**
 * Domain detection patterns and keywords
 */
const DOMAIN_PATTERNS: Record<
  DomainType,
  { extensions: string[]; keywords: string[]; directories: string[] }
> = {
  frontend: {
    extensions: ['.tsx', '.jsx', '.vue', '.svelte', '.css', '.scss', '.html'],
    keywords: [
      'react',
      'vue',
      'angular',
      'svelte',
      'component',
      'render',
      'dom',
      'css',
      'stylesheet',
      'ui',
      'ux',
    ],
    directories: [
      'components',
      'pages',
      'views',
      'layouts',
      'styles',
      'public',
      'assets',
    ],
  },
  backend: {
    extensions: ['.go', '.rs', '.java', '.py', '.rb', '.php', '.cs'],
    keywords: [
      'api',
      'endpoint',
      'controller',
      'service',
      'repository',
      'database',
      'server',
      'middleware',
      'route',
    ],
    directories: [
      'api',
      'controllers',
      'services',
      'handlers',
      'routes',
      'middleware',
    ],
  },
  devops: {
    extensions: ['.yaml', '.yml', '.dockerfile', '.tf', '.hcl'],
    keywords: [
      'docker',
      'kubernetes',
      'k8s',
      'terraform',
      'ci',
      'cd',
      'pipeline',
      'deploy',
      'infrastructure',
    ],
    directories: [
      '.github',
      '.gitlab-ci',
      'terraform',
      'kubernetes',
      'helm',
      'deploy',
    ],
  },
  'data-science': {
    extensions: ['.ipynb', '.r', '.rmd'],
    keywords: [
      'pandas',
      'numpy',
      'matplotlib',
      'seaborn',
      'jupyter',
      'dataframe',
      'analysis',
      'visualization',
    ],
    directories: ['notebooks', 'data', 'analysis', 'reports'],
  },
  'machine-learning': {
    extensions: ['.py', '.ipynb'],
    keywords: [
      'tensorflow',
      'pytorch',
      'keras',
      'model',
      'train',
      'neural',
      'network',
      'ml',
      'ai',
      'embedding',
    ],
    directories: ['models', 'training', 'inference', 'datasets'],
  },
  mobile: {
    extensions: ['.swift', '.kt', '.dart', '.tsx'],
    keywords: [
      'ios',
      'android',
      'flutter',
      'react-native',
      'expo',
      'mobile',
      'app',
      'native',
    ],
    directories: ['ios', 'android', 'mobile', 'app'],
  },
  security: {
    extensions: ['.py', '.go', '.rs'],
    keywords: [
      'security',
      'auth',
      'authentication',
      'authorization',
      'jwt',
      'oauth',
      'encrypt',
      'vulnerability',
    ],
    directories: ['auth', 'security', 'crypto'],
  },
  testing: {
    extensions: ['.test.ts', '.spec.ts', '.test.js', '.spec.js', '.test.py'],
    keywords: [
      'test',
      'spec',
      'mock',
      'jest',
      'vitest',
      'pytest',
      'describe',
      'it',
      'expect',
      'assert',
    ],
    directories: ['tests', 'test', '__tests__', 'spec', 'specs'],
  },
  documentation: {
    extensions: ['.md', '.mdx', '.rst', '.txt', '.adoc'],
    keywords: [
      'readme',
      'documentation',
      'docs',
      'guide',
      'tutorial',
      'api-docs',
      'changelog',
    ],
    directories: ['docs', 'documentation', 'wiki'],
  },
  general: {
    extensions: ['.ts', '.js', '.json'],
    keywords: [],
    directories: ['src', 'lib'],
  },
};

/**
 * Task type detection patterns
 */
const TASK_PATTERNS: Record<
  TaskType,
  { keywords: string[]; patterns: RegExp[] }
> = {
  'code-review': {
    keywords: [
      'review',
      'pr',
      'pull request',
      'feedback',
      'approve',
      'changes',
      'diff',
    ],
    patterns: [/review\s+(this|the|my)/i, /pr\s*#?\d+/i, /pull\s+request/i],
  },
  implementation: {
    keywords: [
      'implement',
      'create',
      'add',
      'build',
      'develop',
      'write',
      'new feature',
    ],
    patterns: [
      /implement\s+\w+/i,
      /create\s+(a|the|new)/i,
      /add\s+(a|the|new)/i,
    ],
  },
  debugging: {
    keywords: [
      'debug',
      'fix',
      'bug',
      'error',
      'issue',
      'broken',
      'not working',
      'crash',
    ],
    patterns: [
      /fix\s+(the|this|a)/i,
      /bug\s+in/i,
      /error\s*:/i,
      /not\s+working/i,
    ],
  },
  refactoring: {
    keywords: [
      'refactor',
      'improve',
      'clean',
      'optimize',
      'restructure',
      'simplify',
    ],
    patterns: [/refactor\s+\w+/i, /improve\s+(the|this)/i, /clean\s*up/i],
  },
  testing: {
    keywords: [
      'test',
      'spec',
      'coverage',
      'unit test',
      'integration test',
      'e2e',
    ],
    patterns: [/write\s+tests?/i, /add\s+tests?/i, /test\s+coverage/i],
  },
  documentation: {
    keywords: ['document', 'readme', 'docs', 'explain', 'describe', 'comment'],
    patterns: [/document\s+(the|this)/i, /add\s+docs?/i, /update\s+readme/i],
  },
  architecture: {
    keywords: [
      'architecture',
      'design',
      'structure',
      'pattern',
      'system design',
    ],
    patterns: [/design\s+(a|the|system)/i, /architecture\s+(for|of)/i],
  },
  planning: {
    keywords: [
      'plan',
      'roadmap',
      'strategy',
      'scope',
      'requirements',
      'estimate',
    ],
    patterns: [
      /plan\s+(for|the)/i,
      /create\s+roadmap/i,
      /estimate\s+(the|effort)/i,
    ],
  },
  optimization: {
    keywords: [
      'optimize',
      'performance',
      'speed',
      'memory',
      'efficiency',
      'bottleneck',
    ],
    patterns: [
      /optimize\s+\w+/i,
      /improve\s+performance/i,
      /reduce\s+(memory|time)/i,
    ],
  },
  general: {
    keywords: [],
    patterns: [],
  },
};

/**
 * Context Detector class for analyzing input and detecting domain/task context
 */
export class ContextDetector {
  private customRules: DetectionRule[] = [];

  /**
   * Create a new ContextDetector instance
   *
   * @param customRules - Optional custom detection rules
   */
  constructor(customRules?: DetectionRule[]) {
    if (customRules) {
      this.customRules = customRules;
    }
  }

  /**
   * Detect context from provided inputs
   *
   * @param content - Text content to analyze
   * @param filePaths - File paths for extension analysis
   * @param userHints - Explicit hints from the user
   * @returns Detected context with confidence scores
   */
  detect(
    content?: string,
    filePaths?: string[],
    userHints?: string[]
  ): DetectedContext {
    const signals = this.gatherSignals(content, filePaths, userHints);
    const domainResult = this.detectDomain(signals);
    const taskResult = this.detectTaskType(signals);
    const customResult = this.applyCustomRules(signals);

    // Merge custom rule results
    const finalDomain = customResult.domain || domainResult.domain;
    const finalTask = customResult.taskType || taskResult.taskType;
    const domainConfidence = customResult.domain
      ? Math.max(customResult.confidence, domainResult.confidence)
      : domainResult.confidence;
    const taskConfidence = customResult.taskType
      ? Math.max(customResult.confidence, taskResult.confidence)
      : taskResult.confidence;

    return {
      domain: finalDomain,
      taskType: finalTask,
      domainConfidence,
      taskConfidence,
      recommendedPersonas: this.getRecommendedPersonas(
        finalDomain,
        finalTask,
        customResult.personas
      ),
      signals,
      metadata: {
        customRulesApplied: customResult.rulesApplied,
      },
    };
  }

  /**
   * Gather signals from all input sources
   */
  private gatherSignals(
    content?: string,
    filePaths?: string[],
    userHints?: string[]
  ): ContextSignals {
    const signals: ContextSignals = {};

    // Extract file extensions
    if (filePaths && filePaths.length > 0) {
      signals.fileExtensions = this.extractExtensions(filePaths);
      signals.directoryPatterns = this.extractDirectoryPatterns(filePaths);
    }

    // Extract keywords from content
    if (content) {
      signals.keywords = this.extractKeywords(content);
      signals.frameworks = this.detectFrameworks(content);
      signals.taskSignals = this.extractTaskSignals(content);
    }

    // Include user hints
    if (userHints && userHints.length > 0) {
      signals.userHints = userHints;
    }

    return signals;
  }

  /**
   * Extract file extensions from paths
   */
  private extractExtensions(filePaths: string[]): string[] {
    const extensions = new Set<string>();

    for (const filePath of filePaths) {
      // Handle compound extensions like .test.ts
      const parts = filePath.split('/').pop()?.split('.') || [];
      if (parts.length >= 2) {
        // Get simple extension
        extensions.add(`.${parts[parts.length - 1]}`);

        // Get compound extension if exists
        if (parts.length >= 3) {
          extensions.add(
            `.${parts[parts.length - 2]}.${parts[parts.length - 1]}`
          );
        }
      }
    }

    return Array.from(extensions);
  }

  /**
   * Extract directory patterns from paths
   */
  private extractDirectoryPatterns(filePaths: string[]): string[] {
    const directories = new Set<string>();

    for (const filePath of filePaths) {
      const parts = filePath.split('/');
      for (const part of parts) {
        if (part && part !== '.' && part !== '..') {
          directories.add(part.toLowerCase());
        }
      }
    }

    return Array.from(directories);
  }

  /**
   * Extract relevant keywords from content
   */
  private extractKeywords(content: string): string[] {
    const keywords = new Set<string>();
    const lowerContent = content.toLowerCase();

    // Gather all known keywords
    const allKeywords: string[] = [];
    for (const patterns of Object.values(DOMAIN_PATTERNS)) {
      allKeywords.push(...patterns.keywords);
    }
    for (const patterns of Object.values(TASK_PATTERNS)) {
      allKeywords.push(...patterns.keywords);
    }

    // Find matches
    for (const keyword of allKeywords) {
      if (lowerContent.includes(keyword.toLowerCase())) {
        keywords.add(keyword);
      }
    }

    return Array.from(keywords);
  }

  /**
   * Detect frameworks/libraries mentioned in content
   */
  private detectFrameworks(content: string): string[] {
    const frameworks = new Set<string>();
    const lowerContent = content.toLowerCase();

    const frameworkPatterns = [
      'react',
      'vue',
      'angular',
      'svelte',
      'next.js',
      'nuxt',
      'express',
      'fastify',
      'nest.js',
      'django',
      'flask',
      'fastapi',
      'tensorflow',
      'pytorch',
      'keras',
      'scikit-learn',
      'jest',
      'vitest',
      'mocha',
      'pytest',
      'docker',
      'kubernetes',
      'terraform',
    ];

    for (const framework of frameworkPatterns) {
      if (lowerContent.includes(framework)) {
        frameworks.add(framework);
      }
    }

    return Array.from(frameworks);
  }

  /**
   * Extract task-related signals from content
   */
  private extractTaskSignals(content: string): string[] {
    const signals = new Set<string>();
    const lowerContent = content.toLowerCase();

    for (const [taskType, patterns] of Object.entries(TASK_PATTERNS)) {
      for (const pattern of patterns.patterns) {
        if (pattern.test(lowerContent)) {
          signals.add(taskType);
        }
      }
    }

    return Array.from(signals);
  }

  /**
   * Detect the primary domain from signals
   */
  private detectDomain(signals: ContextSignals): {
    domain: DomainType;
    confidence: number;
  } {
    const scores: Record<DomainType, number> = {
      frontend: 0,
      backend: 0,
      devops: 0,
      'data-science': 0,
      'machine-learning': 0,
      mobile: 0,
      security: 0,
      testing: 0,
      documentation: 0,
      general: 0.1, // Base score for general
    };

    // Score based on file extensions
    if (signals.fileExtensions) {
      for (const ext of signals.fileExtensions) {
        for (const [domain, patterns] of Object.entries(DOMAIN_PATTERNS)) {
          if (patterns.extensions.some(e => ext.includes(e))) {
            scores[domain as DomainType] += 0.3;
          }
        }
      }
    }

    // Score based on keywords
    if (signals.keywords) {
      for (const keyword of signals.keywords) {
        for (const [domain, patterns] of Object.entries(DOMAIN_PATTERNS)) {
          if (patterns.keywords.includes(keyword.toLowerCase())) {
            scores[domain as DomainType] += 0.2;
          }
        }
      }
    }

    // Score based on directories
    if (signals.directoryPatterns) {
      for (const dir of signals.directoryPatterns) {
        for (const [domain, patterns] of Object.entries(DOMAIN_PATTERNS)) {
          if (patterns.directories.includes(dir.toLowerCase())) {
            scores[domain as DomainType] += 0.25;
          }
        }
      }
    }

    // Score based on user hints
    if (signals.userHints) {
      for (const hint of signals.userHints) {
        const lowerHint = hint.toLowerCase();
        for (const domain of Object.keys(scores)) {
          if (
            lowerHint.includes(domain) ||
            lowerHint.includes(domain.replace('-', ' '))
          ) {
            scores[domain as DomainType] += 0.5;
          }
        }
      }
    }

    // Find highest scoring domain
    let maxScore = 0;
    let bestDomain: DomainType = 'general';

    for (const [domain, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        bestDomain = domain as DomainType;
      }
    }

    // Normalize confidence to 0-1
    const confidence = Math.min(1, maxScore);

    return { domain: bestDomain, confidence };
  }

  /**
   * Detect the primary task type from signals
   */
  private detectTaskType(signals: ContextSignals): {
    taskType: TaskType;
    confidence: number;
  } {
    const scores: Record<TaskType, number> = {
      'code-review': 0,
      implementation: 0,
      debugging: 0,
      refactoring: 0,
      testing: 0,
      documentation: 0,
      architecture: 0,
      planning: 0,
      optimization: 0,
      general: 0.1, // Base score for general
    };

    // Score based on task signals
    if (signals.taskSignals) {
      for (const taskSignal of signals.taskSignals) {
        if (taskSignal in scores) {
          scores[taskSignal as TaskType] += 0.4;
        }
      }
    }

    // Score based on keywords
    if (signals.keywords) {
      for (const keyword of signals.keywords) {
        for (const [taskType, patterns] of Object.entries(TASK_PATTERNS)) {
          if (patterns.keywords.includes(keyword.toLowerCase())) {
            scores[taskType as TaskType] += 0.3;
          }
        }
      }
    }

    // Score based on user hints
    if (signals.userHints) {
      for (const hint of signals.userHints) {
        const lowerHint = hint.toLowerCase();
        for (const taskType of Object.keys(scores)) {
          if (
            lowerHint.includes(taskType) ||
            lowerHint.includes(taskType.replace('-', ' '))
          ) {
            scores[taskType as TaskType] += 0.5;
          }
        }
      }
    }

    // Find highest scoring task type
    let maxScore = 0;
    let bestTaskType: TaskType = 'general';

    for (const [taskType, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        bestTaskType = taskType as TaskType;
      }
    }

    // Normalize confidence to 0-1
    const confidence = Math.min(1, maxScore);

    return { taskType: bestTaskType, confidence };
  }

  /**
   * Apply custom detection rules
   */
  private applyCustomRules(signals: ContextSignals): {
    domain?: DomainType;
    taskType?: TaskType;
    personas: string[];
    confidence: number;
    rulesApplied: string[];
  } {
    const personas: string[] = [];
    const rulesApplied: string[] = [];
    let domain: DomainType | undefined;
    let taskType: TaskType | undefined;
    let maxWeight = 0;

    for (const rule of this.customRules) {
      let matches = false;

      // Check patterns
      if (rule.patterns && signals.keywords) {
        for (const pattern of rule.patterns) {
          const regex = new RegExp(pattern, 'i');
          if (signals.keywords.some(k => regex.test(k))) {
            matches = true;
            break;
          }
        }
      }

      // Check file extensions
      if (rule.fileExtensions && signals.fileExtensions) {
        if (
          rule.fileExtensions.some(ext => signals.fileExtensions!.includes(ext))
        ) {
          matches = true;
        }
      }

      // Check keywords
      if (rule.keywords && signals.keywords) {
        if (
          rule.keywords.some(kw => signals.keywords!.includes(kw.toLowerCase()))
        ) {
          matches = true;
        }
      }

      if (matches) {
        rulesApplied.push(rule.id);
        const weight = rule.weight || 1;

        if (weight > maxWeight) {
          maxWeight = weight;
          if (rule.assignDomain) {
            domain = rule.assignDomain;
          }
          if (rule.assignTaskType) {
            taskType = rule.assignTaskType;
          }
        }

        if (rule.recommendPersonas) {
          personas.push(...rule.recommendPersonas);
        }
      }
    }

    return {
      domain,
      taskType,
      personas: Array.from(new Set(personas)),
      confidence: Math.min(1, maxWeight * 0.3),
      rulesApplied,
    };
  }

  /**
   * Get recommended persona IDs based on detected context
   */
  private getRecommendedPersonas(
    domain: DomainType,
    taskType: TaskType,
    customPersonas: string[]
  ): string[] {
    const personas: string[] = [...customPersonas];

    // Map domains to personas
    const domainPersonaMap: Record<DomainType, string[]> = {
      frontend: ['software-engineer'],
      backend: ['software-engineer'],
      devops: ['software-engineer'],
      'data-science': ['software-engineer'],
      'machine-learning': ['software-engineer'],
      mobile: ['software-engineer'],
      security: ['software-engineer', 'code-reviewer'],
      testing: ['software-engineer'],
      documentation: ['software-engineer'],
      general: ['software-engineer'],
    };

    // Map task types to personas
    const taskPersonaMap: Record<TaskType, string[]> = {
      'code-review': ['code-reviewer'],
      implementation: ['software-engineer'],
      debugging: ['software-engineer'],
      refactoring: ['software-engineer', 'code-reviewer'],
      testing: ['software-engineer'],
      documentation: ['software-engineer'],
      architecture: ['software-engineer', 'project-manager'],
      planning: ['project-manager'],
      optimization: ['software-engineer'],
      general: ['software-engineer'],
    };

    // Add domain-based personas
    if (domainPersonaMap[domain]) {
      personas.push(...domainPersonaMap[domain]);
    }

    // Add task-based personas
    if (taskPersonaMap[taskType]) {
      personas.push(...taskPersonaMap[taskType]);
    }

    // Remove duplicates and return
    return Array.from(new Set(personas));
  }

  /**
   * Add a custom detection rule
   *
   * @param rule - The detection rule to add
   */
  addRule(rule: DetectionRule): void {
    const existingIndex = this.customRules.findIndex(r => r.id === rule.id);
    if (existingIndex >= 0) {
      this.customRules[existingIndex] = rule;
    } else {
      this.customRules.push(rule);
    }
  }

  /**
   * Remove a custom detection rule
   *
   * @param ruleId - The ID of the rule to remove
   * @returns Whether the rule was removed
   */
  removeRule(ruleId: string): boolean {
    const initialLength = this.customRules.length;
    this.customRules = this.customRules.filter(r => r.id !== ruleId);
    return this.customRules.length < initialLength;
  }

  /**
   * Get all custom rules
   */
  getRules(): DetectionRule[] {
    return [...this.customRules];
  }
}
