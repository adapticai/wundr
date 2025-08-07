import { NextRequest, NextResponse } from 'next/server'
import { ApiResponse } from '@/types/data'

export interface DependencyNode {
  id: string
  name: string
  path: string
  type: 'file' | 'module' | 'package'
  size: number
  dependencies: string[]
  dependents: string[]
}

export interface CircularDependency {
  id: string
  cycle: string[]
  severity: 'low' | 'medium' | 'high' | 'critical'
  impact: number
  description: string
  suggestions: ResolutionSuggestion[]
}

export interface ResolutionSuggestion {
  type: 'extract' | 'invert' | 'merge' | 'interface'
  description: string
  effort: 'low' | 'medium' | 'high'
  risk: 'low' | 'medium' | 'high'
  steps: string[]
}

export interface CircularAnalysisResponse {
  nodes: DependencyNode[]
  circularDependencies: CircularDependency[]
  stats: {
    totalNodes: number
    totalDependencies: number
    circularCount: number
    healthScore: number
  }
}

// Circular dependency detection algorithm
class CircularDependencyDetector {
  private graph: Map<string, Set<string>> = new Map()
  private nodes: Map<string, DependencyNode> = new Map()

  constructor(dependencies: DependencyNode[]) {
    this.buildGraph(dependencies)
  }

  private buildGraph(dependencies: DependencyNode[]) {
    dependencies.forEach(node => {
      this.nodes.set(node.id, node)
      this.graph.set(node.id, new Set(node.dependencies))
    })
  }

  detectCircularDependencies(): CircularDependency[] {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()
    const cycles: string[][] = []

    const dfs = (nodeId: string, path: string[]): void => {
      if (recursionStack.has(nodeId)) {
        const cycleStart = path.indexOf(nodeId)
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), nodeId])
        }
        return
      }

      if (visited.has(nodeId)) return

      visited.add(nodeId)
      recursionStack.add(nodeId)

      const dependencies = this.graph.get(nodeId) || new Set()
      dependencies.forEach(depId => {
        dfs(depId, [...path, nodeId])
      })

      recursionStack.delete(nodeId)
    }

    this.graph.forEach((_, nodeId) => {
      if (!visited.has(nodeId)) {
        dfs(nodeId, [])
      }
    })

    return cycles.map((cycle, index) => this.analyzeCycle(cycle, index))
  }

  private analyzeCycle(cycle: string[], index: number): CircularDependency {
    const impact = this.calculateImpact(cycle)
    const severity = this.determineSeverity(cycle, impact)
    const suggestions = this.generateSuggestions(cycle)

    return {
      id: `cycle-${index}`,
      cycle,
      severity,
      impact,
      description: this.generateDescription(cycle),
      suggestions
    }
  }

  private calculateImpact(cycle: string[]): number {
    let totalImpact = 0
    cycle.forEach(nodeId => {
      const node = this.nodes.get(nodeId)
      if (node) {
        totalImpact += node.size + node.dependencies.length + node.dependents.length
      }
    })
    return totalImpact
  }

  private determineSeverity(cycle: string[], impact: number): 'low' | 'medium' | 'high' | 'critical' {
    const cycleLength = cycle.length
    
    if (cycleLength <= 2 && impact < 100) return 'low'
    if (cycleLength <= 3 && impact < 500) return 'medium'
    if (cycleLength <= 5 && impact < 1000) return 'high'
    return 'critical'
  }

  private generateDescription(cycle: string[]): string {
    const nodeNames = cycle.map(id => this.nodes.get(id)?.name || id)
    return `Circular dependency between: ${nodeNames.join(' → ')} → ${nodeNames[0]}`
  }

  private generateSuggestions(cycle: string[]): ResolutionSuggestion[] {
    const suggestions: ResolutionSuggestion[] = []

    suggestions.push({
      type: 'extract',
      description: 'Extract common functionality into a separate module',
      effort: 'medium',
      risk: 'low',
      steps: [
        'Identify shared functionality between modules',
        'Create a new utility module',
        'Move shared code to the utility module',
        'Update imports in both modules'
      ]
    })

    suggestions.push({
      type: 'invert',
      description: 'Use dependency injection or interfaces to break the cycle',
      effort: 'high',
      risk: 'medium',
      steps: [
        'Define interfaces for dependencies',
        'Implement dependency injection',
        'Update module imports',
        'Test the refactored code'
      ]
    })

    if (cycle.length <= 2) {
      suggestions.push({
        type: 'merge',
        description: 'Merge closely related modules',
        effort: 'low',
        risk: 'high',
        steps: [
          'Analyze module responsibilities',
          'Merge related functionality',
          'Update all imports',
          'Ensure no functionality is lost'
        ]
      })
    }

    return suggestions
  }
}

async function analyzeCircularDependencies(): Promise<CircularAnalysisResponse> {
  // In production, this would analyze the actual codebase:
  // 1. Parse imports/requires from source files
  // 2. Build dependency graph
  // 3. Run cycle detection algorithms
  // 4. Calculate impact metrics

  const nodes: DependencyNode[] = [
    {
      id: 'auth',
      name: 'AuthService',
      path: 'src/services/auth.ts',
      type: 'module',
      size: 250,
      dependencies: ['user', 'token'],
      dependents: ['app', 'dashboard']
    },
    {
      id: 'user',
      name: 'UserService',
      path: 'src/services/user.ts',
      type: 'module',
      size: 180,
      dependencies: ['auth', 'profile'],
      dependents: ['dashboard', 'settings']
    },
    {
      id: 'profile',
      name: 'ProfileService',
      path: 'src/services/profile.ts',
      type: 'module',
      size: 120,
      dependencies: ['user', 'validation'],
      dependents: ['settings', 'admin']
    },
    {
      id: 'token',
      name: 'TokenService',
      path: 'src/services/token.ts',
      type: 'module',
      size: 90,
      dependencies: ['validation'],
      dependents: ['auth']
    },
    {
      id: 'validation',
      name: 'ValidationService',
      path: 'src/utils/validation.ts',
      type: 'module',
      size: 150,
      dependencies: [],
      dependents: ['profile', 'token', 'forms']
    },
    {
      id: 'app',
      name: 'App',
      path: 'src/app.ts',
      type: 'module',
      size: 300,
      dependencies: ['auth', 'dashboard'],
      dependents: []
    },
    {
      id: 'dashboard',
      name: 'Dashboard',
      path: 'src/components/dashboard.ts',
      type: 'module',
      size: 400,
      dependencies: ['user', 'auth'],
      dependents: ['app']
    },
    {
      id: 'settings',
      name: 'Settings',
      path: 'src/components/settings.ts',
      type: 'module',
      size: 200,
      dependencies: ['user', 'profile'],
      dependents: []
    }
  ]

  const detector = new CircularDependencyDetector(nodes)
  const circularDependencies = detector.detectCircularDependencies()

  const stats = {
    totalNodes: nodes.length,
    totalDependencies: nodes.reduce((sum, node) => sum + node.dependencies.length, 0),
    circularCount: circularDependencies.length,
    healthScore: Math.max(0, 100 - (circularDependencies.length * 10))
  }

  return {
    nodes,
    circularDependencies,
    stats
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const refresh = searchParams.get('refresh') === 'true'

    if (refresh) {
      await new Promise(resolve => setTimeout(resolve, 1500))
    }

    const analysisResult = await analyzeCircularDependencies()

    const response: ApiResponse<CircularAnalysisResponse> = {
      success: true,
      data: analysisResult,
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error('Error analyzing circular dependencies:', error)

    const response: ApiResponse<null> = {
      success: false,
      data: null,
      error: 'Failed to analyze circular dependencies',
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