/**
 * MCP Resources for Wundr
 */

export interface Resource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

/**
 * Register all available resources
 */
export function registerResources(): Resource[] {
  return [
    {
      uri: 'wundr://config/current',
      name: 'Current Configuration',
      description: 'Current Wundr configuration and settings',
      mimeType: 'application/json',
    },
    {
      uri: 'wundr://metrics/latest',
      name: 'Latest Metrics',
      description: 'Latest code quality and governance metrics',
      mimeType: 'application/json',
    },
    {
      uri: 'wundr://baseline/current',
      name: 'Current Baseline',
      description: 'Current code quality baseline',
      mimeType: 'application/json',
    },
    {
      uri: 'wundr://packages/list',
      name: 'Package List',
      description: 'List of all packages in the monorepo',
      mimeType: 'application/json',
    },
  ];
}

/**
 * Handle reading a resource by URI
 */
export async function handleResourceRead(uri: string): Promise<unknown> {
  switch (uri) {
    case 'wundr://config/current':
      return getCurrentConfig();

    case 'wundr://metrics/latest':
      return getLatestMetrics();

    case 'wundr://baseline/current':
      return getCurrentBaseline();

    case 'wundr://packages/list':
      return getPackageList();

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
}

async function getCurrentConfig(): Promise<unknown> {
  return {
    version: '1.0.0',
    project: {
      name: 'wundr',
      type: 'monorepo',
      packageManager: 'pnpm',
    },
    governance: {
      enabled: true,
      driftThreshold: 5,
      coverageMinimum: 80,
    },
    tools: {
      driftDetection: true,
      patternStandardize: true,
      dependencyAnalyze: true,
      governanceReport: true,
    },
  };
}

async function getLatestMetrics(): Promise<unknown> {
  return {
    timestamp: new Date().toISOString(),
    codeQuality: {
      complexity: 12.5,
      maintainability: 82,
      testCoverage: 78.5,
      lintScore: 94,
    },
    trends: {
      direction: 'improving',
      changePercent: 2.3,
    },
  };
}

async function getCurrentBaseline(): Promise<unknown> {
  return {
    createdAt: '2024-01-10T00:00:00Z',
    metrics: {
      complexity: 12.0,
      coverage: 80.0,
      lintErrors: 3,
      typeErrors: 0,
    },
  };
}

async function getPackageList(): Promise<unknown> {
  return {
    packages: [
      { name: '@wundr.io/core', version: '1.0.1' },
      { name: '@wundr.io/cli', version: '1.0.1' },
      { name: '@wundr.io/config', version: '1.0.0' },
      { name: '@wundr.io/mcp-server', version: '1.0.0' },
    ],
    total: 4,
  };
}
