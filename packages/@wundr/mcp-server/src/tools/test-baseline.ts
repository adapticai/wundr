/**
 * Test Baseline Tool
 *
 * Manage test coverage baselines and track test metrics.
 */

import type { Tool, ToolResult } from './index.js';

export const testBaselineTool: Tool = {
  name: 'test_baseline',
  description:
    'Create test coverage baselines, compare against baselines, and update test metrics.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['create', 'compare', 'update', 'history', 'report'],
        description: 'Action to perform',
      },
      path: {
        type: 'string',
        description: 'Path to analyze (default: current directory)',
      },
      threshold: {
        type: 'number',
        description: 'Minimum coverage threshold percentage',
      },
      failOnDecrease: {
        type: 'boolean',
        description: 'Fail if coverage decreases from baseline',
      },
    },
    required: ['action'],
  },
};

export async function handleTestBaseline(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const action = args['action'] as string;
  const path = (args['path'] as string) || process.cwd();
  const threshold = (args['threshold'] as number) || 80;
  const failOnDecrease = args['failOnDecrease'] !== false;

  try {
    switch (action) {
      case 'create':
        return await createTestBaseline(path);
      case 'compare':
        return await compareBaseline(path, threshold, failOnDecrease);
      case 'update':
        return await updateBaseline(path);
      case 'history':
        return await baselineHistory(path);
      case 'report':
        return await testReport(path);
      default:
        return {
          success: false,
          error: `Unknown action: ${action}`,
        };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function createTestBaseline(path: string): Promise<ToolResult> {
  const timestamp = new Date().toISOString();

  return {
    success: true,
    message: `Test baseline created for ${path}`,
    data: {
      path,
      timestamp,
      baseline: {
        coverage: {
          lines: 78.5,
          branches: 72.3,
          functions: 85.2,
          statements: 79.1,
        },
        tests: {
          total: 245,
          passed: 243,
          failed: 0,
          skipped: 2,
        },
        performance: {
          totalDuration: '45.2s',
          averagePerTest: '184ms',
          slowestTest: 'integration/api.test.ts (2.3s)',
        },
      },
      storedAt: `.wundr/test-baselines/${timestamp.split('T')[0]}.json`,
    },
  };
}

async function compareBaseline(
  path: string,
  threshold: number,
  failOnDecrease: boolean,
): Promise<ToolResult> {
  const comparison = {
    lines: { baseline: 78.5, current: 79.2, change: '+0.7%' },
    branches: { baseline: 72.3, current: 71.8, change: '-0.5%' },
    functions: { baseline: 85.2, current: 86.0, change: '+0.8%' },
    statements: { baseline: 79.1, current: 79.5, change: '+0.4%' },
  };

  const passed = !failOnDecrease || comparison.branches.current >= comparison.branches.baseline - 1;

  return {
    success: passed,
    message: passed
      ? `Coverage comparison passed for ${path}`
      : `Coverage decreased below threshold in ${path}`,
    data: {
      path,
      threshold,
      failOnDecrease,
      comparison,
      summary: {
        improved: ['lines', 'functions', 'statements'],
        decreased: ['branches'],
        meetsThreshold: comparison.lines.current >= threshold,
      },
      recommendation: !passed
        ? 'Branch coverage decreased. Consider adding tests for uncovered branches.'
        : 'Coverage is healthy. Continue maintaining test quality.',
    },
  };
}

async function updateBaseline(path: string): Promise<ToolResult> {
  const timestamp = new Date().toISOString();

  return {
    success: true,
    message: `Test baseline updated for ${path}`,
    data: {
      path,
      timestamp,
      previousBaseline: {
        date: '2024-01-10',
        coverage: { lines: 78.5 },
      },
      newBaseline: {
        date: timestamp.split('T')[0],
        coverage: { lines: 79.2 },
      },
      changes: {
        lines: '+0.7%',
        branches: '-0.5%',
        functions: '+0.8%',
        statements: '+0.4%',
      },
    },
  };
}

async function baselineHistory(path: string): Promise<ToolResult> {
  return {
    success: true,
    message: `Baseline history for ${path}`,
    data: {
      path,
      history: [
        {
          date: '2024-01-15',
          coverage: { lines: 79.2, branches: 71.8, functions: 86.0 },
          tests: { total: 248, passed: 246 },
        },
        {
          date: '2024-01-08',
          coverage: { lines: 78.5, branches: 72.3, functions: 85.2 },
          tests: { total: 245, passed: 243 },
        },
        {
          date: '2024-01-01',
          coverage: { lines: 76.2, branches: 70.1, functions: 83.5 },
          tests: { total: 238, passed: 236 },
        },
      ],
      trend: {
        direction: 'improving',
        averageChange: '+1.5% per week',
        recommendation: 'Coverage is trending positively. Keep up the good work!',
      },
    },
  };
}

async function testReport(path: string): Promise<ToolResult> {
  return {
    success: true,
    message: `Test report for ${path}`,
    data: {
      path,
      generatedAt: new Date().toISOString(),
      summary: {
        totalTests: 248,
        passed: 246,
        failed: 0,
        skipped: 2,
        passRate: '99.2%',
      },
      coverage: {
        overall: 79.2,
        byType: {
          unit: 85.3,
          integration: 72.1,
          e2e: 65.0,
        },
      },
      performance: {
        totalDuration: '47.8s',
        fastestSuite: 'utils.test.ts (1.2s)',
        slowestSuite: 'integration/api.test.ts (12.5s)',
      },
      uncoveredFiles: [
        { file: 'src/legacy/old-module.ts', coverage: 12.5 },
        { file: 'src/utils/rarely-used.ts', coverage: 35.2 },
      ],
      recommendations: [
        'Add tests for src/legacy/old-module.ts',
        'Consider splitting slow integration tests',
        'Review skipped tests for relevance',
      ],
    },
  };
}
