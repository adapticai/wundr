import React from 'react';
import { ReportDashboard } from '../components/visualizations/ReportDashboard';
import { AnalysisReport } from '../types/report';

// Example usage of the report visualization components
export const ReportVisualizationExample: React.FC = () => {
  // Sample report data for demonstration
  const sampleReport: AnalysisReport = {
    id: 'sample-report-2024',
    timestamp: '2024-01-15T10:30:00Z',
    projectName: 'E-commerce Monorepo',
    version: '2.1.0',
    summary: {
      totalFiles: 2847,
      totalPackages: 24,
      duplicateCount: 67,
      circularDependencyCount: 8,
      codebaseSize: 184500,
      testCoverage: 82.3
    },
    duplicates: {
      totalDuplicates: 67,
      duplicatesByType: {
        'exact': 23,
        'similar': 31,
        'structural': 13
      },
      duplicateFiles: [
        {
          id: 'dup-001',
          path: 'packages/ui/src/components/Button/Button.tsx',
          size: 2500,
          type: 'exact',
          duplicateScore: 0.98,
          similarFiles: [
            { path: 'packages/admin/src/components/Button.tsx', similarity: 0.98, lineCount: 85 },
            { path: 'packages/mobile/src/Button/index.tsx', similarity: 0.95, lineCount: 82 }
          ]
        },
        {
          id: 'dup-002',
          path: 'packages/utils/src/validation.ts',
          size: 1800,
          type: 'similar',
          duplicateScore: 0.87,
          similarFiles: [
            { path: 'packages/api/src/validators/common.ts', similarity: 0.87, lineCount: 64 },
            { path: 'packages/web/src/utils/validate.ts', similarity: 0.83, lineCount: 59 }
          ]
        },
        {
          id: 'dup-003',
          path: 'packages/shared/src/types/User.ts',
          size: 1200,
          type: 'structural',
          duplicateScore: 0.75,
          similarFiles: [
            { path: 'packages/api/src/models/User.ts', similarity: 0.75, lineCount: 42 },
            { path: 'packages/web/src/types/user.ts', similarity: 0.72, lineCount: 38 }
          ]
        }
      ],
      similarityThreshold: 0.8
    },
    dependencies: {
      totalDependencies: 342,
      directDependencies: 67,
      devDependencies: 45,
      peerDependencies: 12,
      dependencyTree: [
        {
          name: 'react',
          version: '18.2.0',
          type: 'direct',
          dependencies: [],
          size: 87000,
          lastUpdated: '2023-12-01'
        },
        {
          name: 'next',
          version: '14.0.3',
          type: 'direct',
          dependencies: [
            {
              name: 'react-dom',
              version: '18.2.0',
              type: 'transitive',
              dependencies: [],
              size: 132000
            }
          ],
          size: 245000,
          lastUpdated: '2023-11-28'
        },
        {
          name: 'typescript',
          version: '5.2.2',
          type: 'dev',
          dependencies: [],
          size: 67000,
          lastUpdated: '2023-10-15'
        }
      ],
      vulnerabilities: [
        {
          id: 'vuln-001',
          package: 'lodash',
          severity: 'medium',
          title: 'Prototype Pollution in lodash',
          description: 'Prototype pollution vulnerability allowing arbitrary property injection.',
          patchedVersions: ['>=4.17.21']
        },
        {
          id: 'vuln-002',
          package: 'axios',
          severity: 'high',
          title: 'Request Smuggling in axios',
          description: 'HTTP request smuggling vulnerability in axios library.',
          patchedVersions: ['>=1.6.0']
        },
        {
          id: 'vuln-003',
          package: 'semver',
          severity: 'critical',
          title: 'Regular Expression Denial of Service',
          description: 'ReDoS vulnerability in semver package version parsing.',
          patchedVersions: ['>=7.5.2']
        }
      ]
    },
    circularDependencies: [
      {
        id: 'circular-001',
        cycle: [
          'packages/ui/src/components/Modal.tsx',
          'packages/ui/src/components/Form.tsx',
          'packages/ui/src/components/Button.tsx'
        ],
        severity: 'high',
        impactScore: 8.5,
        affectedFiles: [
          'packages/ui/src/components/Modal.tsx',
          'packages/ui/src/components/Form.tsx',
          'packages/ui/src/components/Button.tsx',
          'packages/web/src/pages/login.tsx',
          'packages/admin/src/views/UserForm.tsx'
        ]
      },
      {
        id: 'circular-002',
        cycle: [
          'packages/api/src/services/UserService.ts',
          'packages/api/src/services/AuthService.ts'
        ],
        severity: 'medium',
        impactScore: 5.2,
        affectedFiles: [
          'packages/api/src/services/UserService.ts',
          'packages/api/src/services/AuthService.ts',
          'packages/api/src/controllers/AuthController.ts'
        ]
      },
      {
        id: 'circular-003',
        cycle: [
          'packages/shared/src/utils/logger.ts',
          'packages/shared/src/utils/config.ts',
          'packages/shared/src/utils/env.ts'
        ],
        severity: 'low',
        impactScore: 2.8,
        affectedFiles: [
          'packages/shared/src/utils/logger.ts',
          'packages/shared/src/utils/config.ts',
          'packages/shared/src/utils/env.ts'
        ]
      }
    ],
    metrics: {
      codeQuality: {
        linesOfCode: 184500,
        technicalDebt: 28,
        codeSmells: 15,
        duplicateLines: 3420,
        testCoverage: 82.3
      },
      performance: {
        buildTime: 67.5,
        bundleSize: 3.8,
        loadTime: 2.1,
        memoryUsage: 156
      },
      maintainability: {
        maintainabilityIndex: 78,
        cyclomaticComplexity: 6.8,
        cognitiveComplexity: 9.2,
        afferentCoupling: 8,
        efferentCoupling: 15
      },
      complexity: {
        averageComplexity: 6.8,
        maxComplexity: 34,
        complexityDistribution: {
          'low': 156,
          'medium': 23,
          'high': 8
        }
      }
    },
    packages: [
      {
        name: 'ui-components',
        version: '1.2.0',
        path: 'packages/ui',
        size: 45000,
        files: 67,
        dependencies: ['react', 'styled-components', 'framer-motion'],
        lastModified: '2024-01-10T14:22:00Z'
      },
      {
        name: 'api-client',
        version: '2.0.1',
        path: 'packages/api',
        size: 38000,
        files: 52,
        dependencies: ['axios', 'zod', 'jwt-decode'],
        lastModified: '2024-01-08T09:15:00Z'
      },
      {
        name: 'shared-utils',
        version: '1.5.2',
        path: 'packages/shared',  
        size: 28000,
        files: 34,
        dependencies: ['lodash', 'date-fns', 'uuid'],
        lastModified: '2024-01-05T16:45:00Z'
      },
      {
        name: 'web-app',
        version: '3.1.0',
        path: 'packages/web',
        size: 72000,
        files: 128,
        dependencies: ['next', 'react', 'tailwindcss', 'ui-components'],
        lastModified: '2024-01-12T11:30:00Z'
      }
    ]
  };

  return (
    <div className="min-h-screen bg-background">
      <ReportDashboard initialReport={sampleReport} />
    </div>
  );
};

export default ReportVisualizationExample;