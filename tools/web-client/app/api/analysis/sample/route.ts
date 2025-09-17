import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Generate mock analysis data for demo purposes
    const mockData = {
      entities: [
        {
          name: 'UserService.ts',
          path: '/src/services/UserService.ts',
          type: 'class',
          dependencies: ['express', 'mongoose', 'bcrypt'],
          complexity: 12,
          issues: [
            {
              type: 'complexity',
              severity: 'high',
              message: 'Cyclomatic complexity is 12 (threshold: 10)'
            }
          ]
        },
        {
          name: 'userController.js',
          path: '/src/controllers/userController.js',
          type: 'module',
          dependencies: ['express', 'joi'],
          complexity: 8,
          issues: []
        },
        {
          name: 'UserComponent.tsx',
          path: '/src/components/UserComponent.tsx',
          type: 'component',
          dependencies: ['react', 'styled-components'],
          complexity: 5,
          issues: [
            {
              type: 'code-smell',
              severity: 'low',
              message: 'Contains console.log statements'
            }
          ]
        }
      ],
      duplicates: [
        {
          id: 'dup-validation',
          type: 'similar',
          severity: 'medium',
          occurrences: [
            { path: '/src/utils/validation.ts', startLine: 10, endLine: 25 },
            { path: '/src/helpers/validator.js', startLine: 5, endLine: 20 }
          ],
          linesCount: 15
        }
      ],
      recommendations: [
        {
          id: 'complexity-reduction',
          title: 'Reduce Code Complexity',
          description: '1 file has high complexity. Consider refactoring.',
          severity: 'high',
          category: 'Maintainability',
          effort: 'medium',
          impact: 'high'
        },
        {
          id: 'remove-duplicates',
          title: 'Remove Code Duplicates',
          description: 'Found 1 potential duplicate. Consider consolidating.',
          severity: 'low',
          category: 'Code Quality',
          effort: 'low',
          impact: 'medium'
        }
      ],
      metrics: {
        totalFiles: 45,
        totalLines: 2847,
        complexity: 7.3,
        maintainability: 82,
        technicalDebt: 23,
        coverage: 78
      },
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(mockData);
  } catch (error) {
    console.error('Error generating sample data:', error);
    return NextResponse.json(
      { error: 'Failed to generate sample data' },
      { status: 500 }
    );
  }
}