/**
 * Error Pattern Database
 * Comprehensive database of error patterns for deployment log analysis
 *
 * @module error-patterns
 */

import type { ErrorPattern, ErrorSeverity } from '../types/deployment';

// Build Error Patterns
export const BUILD_ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /npm ERR! peer dep/i,
    classification: 'Dependency Error',
    severity: 'high',
    autoFixable: true,
    commonCauses: ['Incompatible peer dependencies', 'Version conflicts'],
    suggestedFix:
      'Update package.json with compatible versions, run npm install',
  },
  {
    pattern: /Cannot find module ['"]([^'"]+)['"]/,
    classification: 'Import Error',
    severity: 'high',
    autoFixable: true,
    commonCauses: [
      'Missing dependency',
      'Incorrect import path',
      'Typo in module name',
    ],
    suggestedFix: 'Install missing module or fix import path',
  },
  {
    pattern: /TS\d+:/,
    classification: 'TypeScript Error',
    severity: 'high',
    autoFixable: true,
    commonCauses: [
      'Type mismatch',
      'Missing type declaration',
      'Invalid type assertion',
    ],
    suggestedFix: 'Fix type errors as indicated by TypeScript compiler',
  },
  {
    pattern: /ESLint.*error/i,
    classification: 'Lint Error',
    severity: 'medium',
    autoFixable: true,
    commonCauses: ['Code style violations', 'Potential bugs detected'],
    suggestedFix: 'Run eslint --fix or manually fix issues',
  },
  {
    pattern: /ENOENT.*no such file/i,
    classification: 'File Not Found',
    severity: 'high',
    autoFixable: false,
    commonCauses: ['Missing file', 'Incorrect path', 'File deleted'],
    suggestedFix: 'Create missing file or fix file path reference',
  },
  {
    pattern: /Build exceeded memory/i,
    classification: 'Resource Error',
    severity: 'critical',
    autoFixable: false,
    commonCauses: ['Build too large', 'Memory leak in build process'],
    suggestedFix: 'Increase build memory or optimize build process',
  },
  {
    pattern: /SyntaxError/,
    classification: 'Syntax Error',
    severity: 'critical',
    autoFixable: false,
    commonCauses: ['Invalid JavaScript/TypeScript syntax', 'Malformed JSON'],
    suggestedFix: 'Fix syntax error at indicated location',
  },
];

// Runtime Error Patterns
export const RUNTIME_ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /ECONNREFUSED/,
    classification: 'Connection Error',
    severity: 'critical',
    autoFixable: true,
    commonCauses: [
      'Database unreachable',
      'Service not running',
      'Network issue',
    ],
    suggestedFix: 'Add retry logic with exponential backoff',
  },
  {
    pattern: /ENOMEM/,
    classification: 'Memory Error',
    severity: 'critical',
    autoFixable: true,
    commonCauses: ['Memory limit exceeded', 'Memory leak'],
    suggestedFix: 'Implement pagination or streaming, increase memory limit',
  },
  {
    pattern: /ETIMEDOUT/,
    classification: 'Timeout Error',
    severity: 'high',
    autoFixable: true,
    commonCauses: [
      'Slow external service',
      'Network latency',
      'Long-running operation',
    ],
    suggestedFix: 'Add timeout handling and retry logic',
  },
  {
    pattern: /TypeError.*Cannot read propert/,
    classification: 'Null Reference Error',
    severity: 'high',
    autoFixable: true,
    commonCauses: [
      'Accessing property of null/undefined',
      'Missing null check',
    ],
    suggestedFix: 'Add null check before accessing property',
  },
  {
    pattern: /ReferenceError.*is not defined/,
    classification: 'Reference Error',
    severity: 'high',
    autoFixable: false,
    commonCauses: [
      'Variable not declared',
      'Scope issue',
      'Typo in variable name',
    ],
    suggestedFix: 'Declare variable or fix reference',
  },
  {
    pattern: /Error: listen EADDRINUSE/,
    classification: 'Port In Use Error',
    severity: 'high',
    autoFixable: false,
    commonCauses: [
      'Another process using port',
      'Previous instance not terminated',
    ],
    suggestedFix: 'Kill process using port or use different port',
  },
  {
    pattern: /ENOTFOUND.*getaddrinfo/,
    classification: 'DNS Error',
    severity: 'high',
    autoFixable: false,
    commonCauses: [
      'Invalid hostname',
      'DNS resolution failed',
      'Network issue',
    ],
    suggestedFix: 'Verify hostname, check network connectivity',
  },
  {
    pattern: /EPERM|EACCES/,
    classification: 'Permission Error',
    severity: 'high',
    autoFixable: false,
    commonCauses: ['Insufficient permissions', 'File locked'],
    suggestedFix: 'Check file permissions, run with appropriate privileges',
  },
];

// Database Error Patterns
export const DATABASE_ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /connection.*refused|ECONNREFUSED.*\d+/i,
    classification: 'Database Connection Error',
    severity: 'critical',
    autoFixable: true,
    commonCauses: [
      'Database not running',
      'Wrong connection string',
      'Firewall blocking',
    ],
    suggestedFix: 'Add connection retry with backoff, verify connection string',
  },
  {
    pattern: /too many connections/i,
    classification: 'Connection Pool Exhausted',
    severity: 'critical',
    autoFixable: true,
    commonCauses: [
      'Connection leak',
      'Pool too small',
      'Connections not released',
    ],
    suggestedFix:
      'Implement connection pooling, ensure connections are released',
  },
  {
    pattern: /deadlock/i,
    classification: 'Deadlock Error',
    severity: 'critical',
    autoFixable: false,
    commonCauses: ['Concurrent transactions', 'Lock ordering issue'],
    suggestedFix: 'Review transaction ordering, add retry logic',
  },
  {
    pattern: /duplicate key|unique constraint/i,
    classification: 'Constraint Violation',
    severity: 'medium',
    autoFixable: false,
    commonCauses: ['Duplicate data insertion', 'Missing uniqueness check'],
    suggestedFix: 'Add upsert logic or uniqueness validation',
  },
];

// All Patterns Combined
export const ALL_ERROR_PATTERNS: ErrorPattern[] = [
  ...BUILD_ERROR_PATTERNS,
  ...RUNTIME_ERROR_PATTERNS,
  ...DATABASE_ERROR_PATTERNS,
];

// Pattern Matching Function
export function matchErrorPattern(logMessage: string): ErrorPattern | null {
  for (const pattern of ALL_ERROR_PATTERNS) {
    if (typeof pattern.pattern === 'string') {
      if (logMessage.includes(pattern.pattern)) {
        return pattern;
      }
    } else if (pattern.pattern.test(logMessage)) {
      return pattern;
    }
  }
  return null;
}

// Classify Error
export function classifyError(logMessage: string): {
  classification: string;
  severity: ErrorSeverity;
  autoFixable: boolean;
  suggestion?: string;
} {
  const pattern = matchErrorPattern(logMessage);

  if (pattern) {
    return {
      classification: pattern.classification,
      severity: pattern.severity,
      autoFixable: pattern.autoFixable,
      suggestion: pattern.suggestedFix,
    };
  }

  return {
    classification: 'Unknown Error',
    severity: 'medium',
    autoFixable: false,
  };
}

// Get Fix Suggestions
export function getFixSuggestions(errors: string[]): Array<{
  error: string;
  classification: string;
  suggestion: string;
  autoFixable: boolean;
}> {
  return errors.map(error => {
    const pattern = matchErrorPattern(error);
    return {
      error,
      classification: pattern?.classification || 'Unknown',
      suggestion: pattern?.suggestedFix || 'Manual investigation required',
      autoFixable: pattern?.autoFixable || false,
    };
  });
}

// Export severity ordering for comparison
export const SEVERITY_ORDER: Record<ErrorSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function compareSeverity(a: ErrorSeverity, b: ErrorSeverity): number {
  return SEVERITY_ORDER[b] - SEVERITY_ORDER[a];
}
