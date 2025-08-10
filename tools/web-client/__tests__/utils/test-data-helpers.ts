import { CompleteAnalysisData, AnalysisEntity, AnalysisDuplicate } from '../../types/reports'

/**
 * Helper to create complete metadata structure for tests
 */
export function createTestMetadata(overrides: Partial<CompleteAnalysisData['metadata']> = {}): CompleteAnalysisData['metadata'] {
  return {
    version: '1.0.0',
    generator: 'test-fixture-generator',
    timestamp: new Date(),
    configuration: { includeTests: true, analyzeTypes: true },
    projectInfo: {
      name: 'wundr-dashboard',
      path: process.cwd(),
      language: 'TypeScript',
      framework: 'Next.js',
      packageManager: 'npm'
    },
    ...overrides
  }
}

/**
 * Helper to create complete test metrics
 */
export function createTestMetrics(overrides: Partial<CompleteAnalysisData['metrics']> = {}): CompleteAnalysisData['metrics'] {
  return {
    overview: {
      totalFiles: 0,
      totalLines: 0,
      totalEntities: 0,
      analysisTime: 0,
      timestamp: new Date()
    },
    quality: {
      maintainabilityIndex: 100,
      technicalDebt: {
        rating: 'A' as const,
        minutes: 0
      },
      duplicateLines: 0,
      duplicateRatio: 0,
      testCoverage: {
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0
      }
    },
    complexity: {
      average: 0,
      highest: 0,
      distribution: {
        low: 0,
        medium: 0,
        high: 0,
        veryHigh: 0
      }
    },
    issues: {
      total: 0,
      byType: {},
      bySeverity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      }
    },
    dependencies: {
      total: 0,
      circular: 0,
      unused: 0,
      outdated: 0,
      vulnerable: 0
    },
    ...overrides
  }
}

/**
 * Helper to create minimal complete analysis data structure
 */
export function createCompleteAnalysisData(overrides: Partial<CompleteAnalysisData> = {}): CompleteAnalysisData {
  return {
    metadata: createTestMetadata(),
    entities: [],
    duplicates: [],
    circularDependencies: [],
    securityIssues: [],
    metrics: createTestMetrics(),
    recommendations: [],
    ...overrides
  }
}

/**
 * Helper to create simple entity for backward compatibility with basic data
 */
export function createSimpleEntity(data: {
  name?: string;
  path?: string;
  type?: 'class' | 'function' | 'module' | 'component' | 'interface' | 'enum' | 'type';
  dependencies?: string[];
  complexity?: number;
  issues?: Array<{
    id: string;
    type: 'code-smell' | 'bug' | 'vulnerability' | 'maintainability' | 'performance';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    rule?: string;
    startLine?: number;
    endLine?: number;
    suggestions?: string[];
  }>;
}): AnalysisEntity {
  return {
    id: data.name || 'test-entity',
    name: data.name || 'test-entity',
    path: data.path || 'test/path',
    type: data.type || 'module' as const,
    dependencies: data.dependencies || [],
    dependents: [],
    complexity: {
      cyclomatic: data.complexity || 1,
      cognitive: data.complexity || 1
    },
    metrics: {
      linesOfCode: 10,
      maintainabilityIndex: 85,
      testCoverage: 75
    },
    issues: data.issues || [],
    tags: [],
    lastModified: new Date()
  }
}

/**
 * Helper to create simple duplicate for backward compatibility
 */
export function createSimpleDuplicate(data: {
  id?: string;
  type?: 'structural' | 'exact' | 'similar' | 'semantic';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  occurrences?: Array<{
    path: string;
    startLine: number;
    endLine: number;
    content: string;
    context?: string;
  }>;
  linesCount?: number;
}): AnalysisDuplicate {
  return {
    id: data.id || 'test-duplicate',
    type: data.type || 'structural' as const,
    severity: data.severity || 'medium' as const,
    similarity: 85,
    occurrences: data.occurrences || [{
      path: 'test/path1',
      startLine: 1,
      endLine: 10,
      content: 'test content',
      context: 'test context'
    }],
    linesCount: data.linesCount || 10,
    tokensCount: 50,
    effort: 'medium' as const,
    impact: 'medium' as const,
    recommendation: 'Extract common functionality'
  }
}