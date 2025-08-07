import { NextRequest, NextResponse } from 'next/server'
import { ApiResponse } from '@/types/data'

export interface EntityData {
  id: string
  name: string
  path: string
  file: string
  line: number
  type: 'class' | 'interface' | 'function' | 'type' | 'component' | 'module'
  exportType: 'default' | 'named' | 'namespace'
  complexity: number
  size: {
    lines: number
    statements: number
    functions: number
    branches: number
  }
  dependencies: string[]
  dependents: string[]
  metrics: {
    cyclomatic: number
    cognitive: number
    halstead: {
      difficulty: number
      effort: number
      volume: number
    }
    maintainability: number
  }
  issues: Array<{
    type: string
    severity: 'info' | 'warning' | 'error' | 'critical'
    message: string
    line?: number
    rule?: string
  }>
  tags: string[]
  lastModified: string
}

export interface EntityStats {
  total: number
  byType: Record<string, number>
  byComplexity: {
    low: number    // <= 5
    medium: number // 6-15
    high: number   // 16-25
    critical: number // > 25
  }
  bySeverity: Record<string, number>
  averages: {
    complexity: number
    maintainability: number
    linesOfCode: number
    dependencies: number
  }
  distributions: {
    complexity: number[]
    maintainability: number[]
    size: number[]
  }
}

export interface EntitiesAnalysisResponse {
  entities: EntityData[]
  stats: EntityStats
  relationships: Array<{
    source: string
    target: string
    type: 'dependency' | 'inheritance' | 'composition' | 'usage'
    strength: number
  }>
}

async function analyzeEntities(): Promise<EntitiesAnalysisResponse> {
  // In production, this would:
  // 1. Parse TypeScript/JavaScript files using AST
  // 2. Extract entities (classes, functions, interfaces, etc.)
  // 3. Calculate complexity metrics
  // 4. Analyze dependencies and relationships
  // 5. Run code quality rules

  const entities: EntityData[] = [
    {
      id: 'user-service-001',
      name: 'UserService',
      path: 'src/services/UserService.ts',
      file: 'UserService.ts',
      line: 15,
      type: 'class',
      exportType: 'default',
      complexity: 18,
      size: {
        lines: 245,
        statements: 89,
        functions: 12,
        branches: 34
      },
      dependencies: ['DatabaseService', 'CacheService', 'ValidationService', 'NotificationService'],
      dependents: ['AuthController', 'ProfileController', 'AdminController'],
      metrics: {
        cyclomatic: 18,
        cognitive: 22,
        halstead: {
          difficulty: 15.2,
          effort: 4580.3,
          volume: 301.2
        },
        maintainability: 68.5
      },
      issues: [
        {
          type: 'complexity',
          severity: 'warning',
          message: 'Class has high cyclomatic complexity (18). Consider breaking it down.',
          rule: 'complexity-threshold'
        },
        {
          type: 'dependencies',
          severity: 'info',
          message: 'Class has many dependencies (4). Consider dependency injection.',
          rule: 'max-dependencies'
        }
      ],
      tags: ['service', 'core', 'high-complexity'],
      lastModified: '2024-12-15T10:30:00Z'
    },
    {
      id: 'auth-controller-002',
      name: 'AuthController',
      path: 'src/controllers/AuthController.ts',
      file: 'AuthController.ts',
      line: 8,
      type: 'class',
      exportType: 'named',
      complexity: 12,
      size: {
        lines: 156,
        statements: 67,
        functions: 8,
        branches: 19
      },
      dependencies: ['UserService', 'TokenService', 'ValidationService'],
      dependents: ['AuthRouter', 'MiddlewareAuth'],
      metrics: {
        cyclomatic: 12,
        cognitive: 14,
        halstead: {
          difficulty: 10.8,
          effort: 2340.1,
          volume: 216.7
        },
        maintainability: 75.2
      },
      issues: [],
      tags: ['controller', 'authentication'],
      lastModified: '2024-12-14T14:22:00Z'
    },
    {
      id: 'database-service-003',
      name: 'DatabaseService',
      path: 'src/services/DatabaseService.ts',
      file: 'DatabaseService.ts',
      line: 12,
      type: 'class',
      exportType: 'default',
      complexity: 8,
      size: {
        lines: 198,
        statements: 78,
        functions: 15,
        branches: 12
      },
      dependencies: ['ConnectionPool', 'QueryBuilder'],
      dependents: ['UserService', 'OrderService', 'ProductService'],
      metrics: {
        cyclomatic: 8,
        cognitive: 9,
        halstead: {
          difficulty: 8.4,
          effort: 1890.5,
          volume: 225.1
        },
        maintainability: 82.1
      },
      issues: [],
      tags: ['service', 'database', 'infrastructure'],
      lastModified: '2024-12-12T09:15:00Z'
    },
    {
      id: 'api-client-004',
      name: 'ApiClient',
      path: 'src/utils/ApiClient.ts',
      file: 'ApiClient.ts',
      line: 5,
      type: 'class',
      exportType: 'named',
      complexity: 6,
      size: {
        lines: 89,
        statements: 34,
        functions: 6,
        branches: 8
      },
      dependencies: ['axios', 'AuthService'],
      dependents: ['UserService', 'OrderService'],
      metrics: {
        cyclomatic: 6,
        cognitive: 7,
        halstead: {
          difficulty: 6.2,
          effort: 1120.3,
          volume: 180.7
        },
        maintainability: 88.5
      },
      issues: [],
      tags: ['utility', 'http', 'client'],
      lastModified: '2024-12-16T11:45:00Z'
    },
    {
      id: 'validation-utils-005',
      name: 'validateEmail',
      path: 'src/utils/validation.ts',
      file: 'validation.ts',
      line: 23,
      type: 'function',
      exportType: 'named',
      complexity: 3,
      size: {
        lines: 12,
        statements: 5,
        functions: 1,
        branches: 2
      },
      dependencies: [],
      dependents: ['UserService', 'AuthController', 'ProfileForm'],
      metrics: {
        cyclomatic: 3,
        cognitive: 2,
        halstead: {
          difficulty: 3.1,
          effort: 145.2,
          volume: 46.8
        },
        maintainability: 95.1
      },
      issues: [],
      tags: ['utility', 'validation', 'pure-function'],
      lastModified: '2024-12-10T16:30:00Z'
    },
    {
      id: 'user-interface-006',
      name: 'IUser',
      path: 'src/types/User.ts',
      file: 'User.ts',
      line: 3,
      type: 'interface',
      exportType: 'named',
      complexity: 1,
      size: {
        lines: 18,
        statements: 8,
        functions: 0,
        branches: 0
      },
      dependencies: ['IAddress', 'IPermissions'],
      dependents: ['UserService', 'AuthController', 'ProfileComponent'],
      metrics: {
        cyclomatic: 1,
        cognitive: 0,
        halstead: {
          difficulty: 1.0,
          effort: 25.4,
          volume: 25.4
        },
        maintainability: 100
      },
      issues: [],
      tags: ['type', 'interface', 'model'],
      lastModified: '2024-12-08T13:20:00Z'
    },
    {
      id: 'complex-component-007',
      name: 'DataTable',
      path: 'src/components/DataTable.tsx',
      file: 'DataTable.tsx',
      line: 28,
      type: 'component',
      exportType: 'default',
      complexity: 24,
      size: {
        lines: 387,
        statements: 156,
        functions: 18,
        branches: 45
      },
      dependencies: ['React', 'lodash', 'react-table', 'styled-components'],
      dependents: ['UsersPage', 'OrdersPage', 'ProductsPage'],
      metrics: {
        cyclomatic: 24,
        cognitive: 31,
        halstead: {
          difficulty: 18.7,
          effort: 6890.4,
          volume: 368.5
        },
        maintainability: 58.3
      },
      issues: [
        {
          type: 'complexity',
          severity: 'critical',
          message: 'Component has extremely high complexity (24). Urgent refactoring needed.',
          rule: 'component-complexity'
        },
        {
          type: 'size',
          severity: 'warning',
          message: 'Component is very large (387 lines). Consider splitting into smaller components.',
          rule: 'component-size'
        }
      ],
      tags: ['component', 'react', 'complex', 'refactor-needed'],
      lastModified: '2024-12-17T08:12:00Z'
    }
  ]

  const relationships = [
    { source: 'user-service-001', target: 'database-service-003', type: 'dependency' as const, strength: 0.8 },
    { source: 'auth-controller-002', target: 'user-service-001', type: 'dependency' as const, strength: 0.9 },
    { source: 'user-service-001', target: 'user-interface-006', type: 'usage' as const, strength: 0.7 },
    { source: 'complex-component-007', target: 'user-service-001', type: 'dependency' as const, strength: 0.6 },
    { source: 'validation-utils-005', target: 'user-interface-006', type: 'usage' as const, strength: 0.5 }
  ]

  const stats: EntityStats = {
    total: entities.length,
    byType: {
      class: entities.filter(e => e.type === 'class').length,
      function: entities.filter(e => e.type === 'function').length,
      interface: entities.filter(e => e.type === 'interface').length,
      component: entities.filter(e => e.type === 'component').length,
      type: entities.filter(e => e.type === 'type').length,
      module: entities.filter(e => e.type === 'module').length
    },
    byComplexity: {
      low: entities.filter(e => e.complexity <= 5).length,
      medium: entities.filter(e => e.complexity > 5 && e.complexity <= 15).length,
      high: entities.filter(e => e.complexity > 15 && e.complexity <= 25).length,
      critical: entities.filter(e => e.complexity > 25).length
    },
    bySeverity: {
      info: entities.reduce((sum, e) => sum + e.issues.filter(i => i.severity === 'info').length, 0),
      warning: entities.reduce((sum, e) => sum + e.issues.filter(i => i.severity === 'warning').length, 0),
      error: entities.reduce((sum, e) => sum + e.issues.filter(i => i.severity === 'error').length, 0),
      critical: entities.reduce((sum, e) => sum + e.issues.filter(i => i.severity === 'critical').length, 0)
    },
    averages: {
      complexity: entities.reduce((sum, e) => sum + e.complexity, 0) / entities.length,
      maintainability: entities.reduce((sum, e) => sum + e.metrics.maintainability, 0) / entities.length,
      linesOfCode: entities.reduce((sum, e) => sum + e.size.lines, 0) / entities.length,
      dependencies: entities.reduce((sum, e) => sum + e.dependencies.length, 0) / entities.length
    },
    distributions: {
      complexity: entities.map(e => e.complexity),
      maintainability: entities.map(e => e.metrics.maintainability),
      size: entities.map(e => e.size.lines)
    }
  }

  return { entities, stats, relationships }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const refresh = searchParams.get('refresh') === 'true'
    const type = searchParams.get('type')
    const complexity = searchParams.get('complexity')
    const severity = searchParams.get('severity')

    if (refresh) {
      await new Promise(resolve => setTimeout(resolve, 3000))
    }

    const analysisResult = await analyzeEntities()

    // Apply filters
    let filteredEntities = analysisResult.entities

    if (type && type !== 'all') {
      filteredEntities = filteredEntities.filter(e => e.type === type)
    }

    if (complexity && complexity !== 'all') {
      filteredEntities = filteredEntities.filter(e => {
        switch (complexity) {
          case 'low': return e.complexity <= 5
          case 'medium': return e.complexity > 5 && e.complexity <= 15
          case 'high': return e.complexity > 15 && e.complexity <= 25
          case 'critical': return e.complexity > 25
          default: return true
        }
      })
    }

    if (severity && severity !== 'all') {
      filteredEntities = filteredEntities.filter(e => 
        e.issues.some(issue => issue.severity === severity)
      )
    }

    const response: ApiResponse<EntitiesAnalysisResponse> = {
      success: true,
      data: {
        entities: filteredEntities,
        stats: analysisResult.stats,
        relationships: analysisResult.relationships.filter(rel => 
          filteredEntities.some(e => e.id === rel.source) && 
          filteredEntities.some(e => e.id === rel.target)
        )
      },
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error('Error analyzing entities:', error)

    const response: ApiResponse<null> = {
      success: false,
      data: null,
      error: 'Failed to analyze code entities',
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(response, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}