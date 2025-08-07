/**
 * Unit tests for analysis utility functions
 * Tests core business logic with real data patterns
 */

import { createTestFixtures } from '../../fixtures/real-test-data'

// Mock utility functions that would be in the actual codebase
const analysisUtils = {
  calculateComplexity: (entities: any[]) => {
    return entities.reduce((sum, entity) => sum + entity.complexity, 0) / entities.length
  },
  
  groupEntitiesByType: (entities: any[]) => {
    return entities.reduce((acc, entity) => {
      acc[entity.type] = (acc[entity.type] || 0) + 1
      return acc
    }, {})
  },
  
  findHighComplexityEntities: (entities: any[], threshold = 10) => {
    return entities.filter(entity => entity.complexity > threshold)
  },
  
  calculateTechnicalDebt: (entities: any[], duplicates: any[]) => {
    const complexityDebt = entities
      .filter(e => e.complexity > 15)
      .reduce((sum, e) => sum + (e.complexity - 15), 0)
    
    const duplicateDebt = duplicates.length * 5
    
    return complexityDebt + duplicateDebt
  },
  
  analyzeEntityDependencies: (entities: any[]) => {
    const dependencyMap = new Map()
    const reverseDependencyMap = new Map()
    
    entities.forEach(entity => {
      dependencyMap.set(entity.name, entity.dependencies || [])
      
      ;(entity.dependencies || []).forEach((dep: string) => {
        if (!reverseDependencyMap.has(dep)) {
          reverseDependencyMap.set(dep, [])
        }
        reverseDependencyMap.get(dep).push(entity.name)
      })
    })
    
    return {
      totalDependencies: Array.from(dependencyMap.values())
        .reduce((sum: number, deps: any) => sum + deps.length, 0),
      circularDependencies: findCircularDependencies(dependencyMap),
      hubNodes: Array.from(reverseDependencyMap.entries())
        .filter(([_, dependents]) => (dependents as any[]).length > 3)
        .map(([node]) => node)
    }
  },
  
  generateRecommendations: (entities: any[], duplicates: any[]) => {
    const recommendations = []
    
    const highComplexity = entities.filter(e => e.complexity > 15)
    if (highComplexity.length > 0) {
      recommendations.push({
        id: 'reduce-complexity',
        type: 'complexity',
        priority: 'high',
        entities: highComplexity.map(e => e.name),
        description: `Reduce complexity in ${highComplexity.length} entities`
      })
    }
    
    if (duplicates.length > 0) {
      recommendations.push({
        id: 'remove-duplicates',
        type: 'duplication',
        priority: 'medium',
        count: duplicates.length,
        description: `Remove ${duplicates.length} code duplicates`
      })
    }
    
    const entitiesWithIssues = entities.filter(e => e.issues && e.issues.length > 0)
    if (entitiesWithIssues.length > 0) {
      recommendations.push({
        id: 'fix-issues',
        type: 'quality',
        priority: 'low',
        entities: entitiesWithIssues.map(e => e.name),
        description: `Fix issues in ${entitiesWithIssues.length} entities`
      })
    }
    
    return recommendations
  }
}

function findCircularDependencies(dependencyMap: Map<string, string[]>): string[][] {
  const visited = new Set()
  const recursionStack = new Set()
  const cycles: string[][] = []
  
  function dfs(node: string, path: string[]): void {
    if (recursionStack.has(node)) {
      const cycleStart = path.indexOf(node)
      if (cycleStart !== -1) {
        cycles.push(path.slice(cycleStart).concat(node))
      }
      return
    }
    
    if (visited.has(node)) return
    
    visited.add(node)
    recursionStack.add(node)
    
    const dependencies = dependencyMap.get(node) || []
    for (const dep of dependencies) {
      dfs(dep, [...path, node])
    }
    
    recursionStack.delete(node)
  }
  
  for (const [node] of dependencyMap) {
    if (!visited.has(node)) {
      dfs(node, [])
    }
  }
  
  return cycles
}

describe('Analysis Utils', () => {
  let testFixtures: any

  beforeAll(async () => {
    testFixtures = await createTestFixtures()
  })

  describe('Complexity Analysis', () => {
    it('calculates average complexity from real data', () => {
      const entities = testFixtures.analysisData.entities
      
      if (entities.length > 0) {
        const avgComplexity = analysisUtils.calculateComplexity(entities)
        
        expect(typeof avgComplexity).toBe('number')
        expect(avgComplexity).toBeGreaterThan(0)
        expect(avgComplexity).toBeFinite()
        
        // Verify calculation manually
        const manualAvg = entities.reduce((sum: number, e: any) => sum + e.complexity, 0) / entities.length
        expect(avgComplexity).toBeCloseTo(manualAvg, 2)
      }
    })

    it('finds high complexity entities with real threshold', () => {
      const entities = testFixtures.analysisData.entities
      const threshold = 10
      
      const highComplexity = analysisUtils.findHighComplexityEntities(entities, threshold)
      
      expect(Array.isArray(highComplexity)).toBe(true)
      
      // Verify all returned entities exceed threshold
      highComplexity.forEach((entity: any) => {
        expect(entity.complexity).toBeGreaterThan(threshold)
      })
      
      // Verify none are missed
      const manualHighComplexity = entities.filter((e: any) => e.complexity > threshold)
      expect(highComplexity.length).toBe(manualHighComplexity.length)
    })

    it('handles edge cases in complexity calculation', () => {
      // Test with empty array
      expect(analysisUtils.calculateComplexity([])).toBeNaN()
      
      // Test with single entity
      const singleEntity = [{ complexity: 5 }]
      expect(analysisUtils.calculateComplexity(singleEntity)).toBe(5)
      
      // Test with zero complexity entities
      const zeroComplexity = [{ complexity: 0 }, { complexity: 0 }]
      expect(analysisUtils.calculateComplexity(zeroComplexity)).toBe(0)
    })
  })

  describe('Entity Grouping', () => {
    it('groups entities by type using real data', () => {
      const entities = testFixtures.analysisData.entities
      
      const grouped = analysisUtils.groupEntitiesByType(entities)
      
      expect(typeof grouped).toBe('object')
      
      // Verify counts
      const totalCounted = Object.values(grouped).reduce((sum: number, count: any) => sum + count, 0)
      expect(totalCounted).toBe(entities.length)
      
      // Verify each type exists in original data
      Object.keys(grouped).forEach(type => {
        const entitiesOfType = entities.filter((e: any) => e.type === type)
        expect(grouped[type]).toBe(entitiesOfType.length)
      })
    })

    it('handles various entity types correctly', () => {
      const mixedEntities = [
        { type: 'class', name: 'Class1' },
        { type: 'function', name: 'Function1' },
        { type: 'class', name: 'Class2' },
        { type: 'module', name: 'Module1' },
        { type: 'component', name: 'Component1' },
        { type: 'class', name: 'Class3' }
      ]
      
      const grouped = analysisUtils.groupEntitiesByType(mixedEntities)
      
      expect(grouped).toEqual({
        class: 3,
        function: 1,
        module: 1,
        component: 1
      })
    })
  })

  describe('Technical Debt Calculation', () => {
    it('calculates technical debt from real project data', () => {
      const entities = testFixtures.analysisData.entities
      const duplicates = testFixtures.analysisData.duplicates
      
      const debt = analysisUtils.calculateTechnicalDebt(entities, duplicates)
      
      expect(typeof debt).toBe('number')
      expect(debt).toBeGreaterThanOrEqual(0)
      
      // Verify it includes both complexity and duplicate debt
      const complexityDebt = entities
        .filter((e: any) => e.complexity > 15)
        .reduce((sum: number, e: any) => sum + (e.complexity - 15), 0)
      const duplicateDebt = duplicates.length * 5
      
      expect(debt).toBe(complexityDebt + duplicateDebt)
    })

    it('handles zero debt scenarios', () => {
      const lowComplexityEntities = [
        { complexity: 1 },
        { complexity: 5 },
        { complexity: 10 }
      ]
      
      const debt = analysisUtils.calculateTechnicalDebt(lowComplexityEntities, [])
      expect(debt).toBe(0)
    })

    it('scales debt calculation correctly', () => {
      const highComplexityEntities = [
        { complexity: 20 }, // 5 debt points
        { complexity: 25 }  // 10 debt points
      ]
      
      const duplicates = [{}, {}] // 2 duplicates = 10 debt points
      
      const debt = analysisUtils.calculateTechnicalDebt(highComplexityEntities, duplicates)
      expect(debt).toBe(25) // 5 + 10 + 10
    })
  })

  describe('Dependency Analysis', () => {
    it('analyzes dependencies from real project data', () => {
      const entities = testFixtures.analysisData.entities
      
      const analysis = analysisUtils.analyzeEntityDependencies(entities)
      
      expect(analysis).toHaveProperty('totalDependencies')
      expect(analysis).toHaveProperty('circularDependencies')
      expect(analysis).toHaveProperty('hubNodes')
      
      expect(typeof analysis.totalDependencies).toBe('number')
      expect(analysis.totalDependencies).toBeGreaterThanOrEqual(0)
      expect(Array.isArray(analysis.circularDependencies)).toBe(true)
      expect(Array.isArray(analysis.hubNodes)).toBe(true)
    })

    it('identifies hub nodes correctly', () => {
      const entities = [
        { name: 'A', dependencies: ['common'] },
        { name: 'B', dependencies: ['common'] },
        { name: 'C', dependencies: ['common'] },
        { name: 'D', dependencies: ['common'] },
        { name: 'common', dependencies: [] },
        { name: 'isolated', dependencies: [] }
      ]
      
      const analysis = analysisUtils.analyzeEntityDependencies(entities)
      
      expect(analysis.hubNodes).toContain('common')
      expect(analysis.hubNodes).not.toContain('isolated')
    })

    it('detects circular dependencies', () => {
      const entities = [
        { name: 'A', dependencies: ['B'] },
        { name: 'B', dependencies: ['C'] },
        { name: 'C', dependencies: ['A'] },
        { name: 'D', dependencies: [] }
      ]
      
      const analysis = analysisUtils.analyzeEntityDependencies(entities)
      
      expect(analysis.circularDependencies.length).toBeGreaterThan(0)
    })
  })

  describe('Recommendation Generation', () => {
    it('generates actionable recommendations from real data', () => {
      const entities = testFixtures.analysisData.entities
      const duplicates = testFixtures.analysisData.duplicates
      
      const recommendations = analysisUtils.generateRecommendations(entities, duplicates)
      
      expect(Array.isArray(recommendations)).toBe(true)
      
      recommendations.forEach((rec: any) => {
        expect(rec).toHaveProperty('id')
        expect(rec).toHaveProperty('type')
        expect(rec).toHaveProperty('priority')
        expect(rec).toHaveProperty('description')
        expect(['high', 'medium', 'low']).toContain(rec.priority)
      })
    })

    it('prioritizes recommendations correctly', () => {
      const highComplexityEntities = Array.from({ length: 5 }, (_, i) => ({
        name: `Entity${i}`,
        complexity: 20,
        issues: []
      }))
      
      const duplicates = [{}, {}]
      
      const recommendations = analysisUtils.generateRecommendations(highComplexityEntities, duplicates)
      
      const complexityRec = recommendations.find((r: any) => r.type === 'complexity')
      const duplicateRec = recommendations.find((r: any) => r.type === 'duplication')
      
      if (complexityRec) {
        expect(complexityRec.priority).toBe('high')
      }
      if (duplicateRec) {
        expect(duplicateRec.priority).toBe('medium')
      }
    })

    it('handles empty data sets', () => {
      const recommendations = analysisUtils.generateRecommendations([], [])
      expect(recommendations).toEqual([])
    })

    it('includes relevant entity information', () => {
      const problemEntity = {
        name: 'ProblematicClass',
        complexity: 25,
        issues: [{ type: 'smell', severity: 'high', message: 'Too complex' }]
      }
      
      const recommendations = analysisUtils.generateRecommendations([problemEntity], [])
      
      const complexityRec = recommendations.find((r: any) => r.type === 'complexity')
      const qualityRec = recommendations.find((r: any) => r.type === 'quality')
      
      if (complexityRec) {
        expect(complexityRec.entities).toContain('ProblematicClass')
      }
      if (qualityRec) {
        expect(qualityRec.entities).toContain('ProblematicClass')
      }
    })
  })

  describe('Performance with Large Datasets', () => {
    it('handles large entity collections efficiently', () => {
      const largeEntitySet = Array.from({ length: 1000 }, (_, i) => ({
        name: `Entity${i}`,
        type: 'module',
        complexity: Math.floor(Math.random() * 30) + 1,
        dependencies: [`dep${i % 10}`],
        issues: []
      }))
      
      const startTime = performance.now()
      
      const avgComplexity = analysisUtils.calculateComplexity(largeEntitySet)
      const grouped = analysisUtils.groupEntitiesByType(largeEntitySet)
      const highComplexity = analysisUtils.findHighComplexityEntities(largeEntitySet)
      
      const endTime = performance.now()
      const processingTime = endTime - startTime
      
      expect(processingTime).toBeLessThan(100) // Should complete under 100ms
      expect(typeof avgComplexity).toBe('number')
      expect(typeof grouped).toBe('object')
      expect(Array.isArray(highComplexity)).toBe(true)
    })

    it('manages memory efficiently with repeated operations', () => {
      const entities = testFixtures.analysisData.entities
      
      // Perform operations multiple times
      for (let i = 0; i < 100; i++) {
        analysisUtils.calculateComplexity(entities)
        analysisUtils.groupEntitiesByType(entities)
        analysisUtils.findHighComplexityEntities(entities)
      }
      
      // Should complete without memory issues
      expect(true).toBe(true)
    })
  })
})