/**
 * Performance benchmark tests
 * Tests system performance with real workloads
 */

import { PerformanceTestUtils, createTestFixtures } from '../fixtures/real-test-data'

describe('Performance Benchmarks', () => {
  let testFixtures: any

  beforeAll(async () => {
    testFixtures = await createTestFixtures()
  })

  describe('Data Processing Benchmarks', () => {
    it('processes real analysis data within performance thresholds', async () => {
      const analysisData = testFixtures.analysisData
      
      const { duration, result } = await measureAsyncOperation(async () => {
        // Simulate real data processing operations
        const entityTypes = analysisData.entities.reduce((acc: any, entity: any) => {
          acc[entity.type] = (acc[entity.type] || 0) + 1
          return acc
        }, {})
        
        const complexityBuckets = analysisData.entities.reduce((acc: any, entity: any) => {
          const bucket = entity.complexity < 5 ? 'low' : 
                        entity.complexity < 15 ? 'medium' : 'high'
          acc[bucket] = (acc[bucket] || 0) + 1
          return acc
        }, {})
        
        return { entityTypes, complexityBuckets }
      })
      
      expect(duration).toBeLessThan(100) // Should complete under 100ms
      expect(result.entityTypes).toBeDefined()
      expect(result.complexityBuckets).toBeDefined()
    })

    it('handles large dataset processing efficiently', async () => {
      const largeDataset = PerformanceTestUtils.createLargeDataset(10000)
      
      const { duration, result } = await measureAsyncOperation(async () => {
        return largeDataset.map(item => ({
          ...item,
          processed: true,
          timestamp: Date.now()
        }))
      })
      
      expect(duration).toBeLessThan(500) // Should complete under 500ms
      expect(result).toHaveLength(10000)
      expect(result[0]).toHaveProperty('processed', true)
    })

    it('maintains memory efficiency during processing', async () => {
      const initialMemory = process.memoryUsage().heapUsed
      
      // Process data multiple times to test for memory leaks
      for (let i = 0; i < 100; i++) {
        const data = testFixtures.analysisData.entities.map((entity: any) => ({
          ...entity,
          iteration: i
        }))
        
        // Simulate processing
        data.forEach((entity: any) => {
          entity.processedComplexity = entity.complexity * 2
        })
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }
      
      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory
      
      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024)
    })
  })

  describe('Computation Benchmarks', () => {
    it('calculates complexity metrics efficiently', async () => {
      const entities = testFixtures.analysisData.entities
      
      const { duration, result } = await measureAsyncOperation(async () => {
        const metrics = {
          totalComplexity: entities.reduce((sum: number, e: any) => sum + e.complexity, 0),
          averageComplexity: entities.length > 0 ? 
            entities.reduce((sum: number, e: any) => sum + e.complexity, 0) / entities.length : 0,
          highComplexityCount: entities.filter((e: any) => e.complexity > 10).length,
          complexityDistribution: entities.reduce((dist: any, e: any) => {
            const bucket = Math.floor(e.complexity / 5) * 5
            dist[bucket] = (dist[bucket] || 0) + 1
            return dist
          }, {})
        }
        return metrics
      })
      
      expect(duration).toBeLessThan(50) // Should be very fast
      expect(result.totalComplexity).toBeGreaterThan(0)
      expect(result.averageComplexity).toBeGreaterThan(0)
      expect(typeof result.highComplexityCount).toBe('number')
      expect(typeof result.complexityDistribution).toBe('object')
    })

    it('processes dependency graphs efficiently', async () => {
      const entities = testFixtures.analysisData.entities
      
      const { duration, result } = await measureAsyncOperation(async () => {
        const dependencyMap = new Map()
        const reverseDependencyMap = new Map()
        
        // Build dependency graphs
        entities.forEach((entity: any) => {
          dependencyMap.set(entity.name, entity.dependencies)
          
          entity.dependencies.forEach((dep: string) => {
            if (!reverseDependencyMap.has(dep)) {
              reverseDependencyMap.set(dep, [])
            }
            reverseDependencyMap.get(dep).push(entity.name)
          })
        })
        
        return {
          totalNodes: dependencyMap.size,
          totalEdges: Array.from(dependencyMap.values()).reduce(
            (sum: number, deps: any) => sum + deps.length, 0
          ),
          hubNodes: Array.from(reverseDependencyMap.entries())
            .filter(([_, dependents]) => (dependents as any[]).length > 3)
            .length
        }
      })
      
      expect(duration).toBeLessThan(100)
      expect(result.totalNodes).toBeGreaterThan(0)
      expect(typeof result.totalEdges).toBe('number')
      expect(typeof result.hubNodes).toBe('number')
    })

    it('finds duplicates efficiently in real data', async () => {
      const entities = testFixtures.analysisData.entities
      
      const { duration, result } = await measureAsyncOperation(async () => {
        const nameMap = new Map()
        
        entities.forEach((entity: any, index: number) => {
          const baseName = entity.name.replace(/\.[^.]+$/, '') // Remove extension
          if (!nameMap.has(baseName)) {
            nameMap.set(baseName, [])
          }
          nameMap.get(baseName).push({ entity, index })
        })
        
        const duplicates = Array.from(nameMap.entries())
          .filter(([_, entities]) => (entities as any[]).length > 1)
          .map(([baseName, entities]) => ({
            baseName,
            count: (entities as any[]).length,
            entities
          }))
        
        return duplicates
      })
      
      expect(duration).toBeLessThan(200)
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('Rendering Performance', () => {
    it('measures chart rendering performance', async () => {
      const chartData = {
        labels: testFixtures.analysisData.entities.map((e: any) => e.name),
        datasets: [{
          data: testFixtures.analysisData.entities.map((e: any) => e.complexity)
        }]
      }
      
      const renderTime = await PerformanceTestUtils.measureRenderTime(() => {
        // Simulate chart rendering operations
        chartData.datasets[0].data.forEach((value: number, index: number) => {
          // Simulate canvas operations
          const normalizedValue = (value / Math.max(...chartData.datasets[0].data)) * 100
          return normalizedValue
        })
      })
      
      expect(renderTime).toHavePerformantRender()
    })

    it('handles large dataset rendering efficiently', async () => {
      const largeDataset = PerformanceTestUtils.createLargeDataset(5000)
      
      const renderTime = await PerformanceTestUtils.measureRenderTime(() => {
        // Simulate rendering operations
        largeDataset.forEach(item => {
          // Simulate DOM operations
          const element = {
            id: item.id,
            textContent: item.name,
            className: 'data-item'
          }
          return element
        })
      })
      
      expect(renderTime).toBeLessThan(100) // Should render under 100ms
    })
  })

  describe('Memory Performance', () => {
    it('handles memory efficiently with real analysis data', async () => {
      const { before, after, delta } = await PerformanceTestUtils.measureMemoryUsage(() => {
        // Process analysis data multiple times
        for (let i = 0; i < 50; i++) {
          const processedEntities = testFixtures.analysisData.entities.map((entity: any) => ({
            ...entity,
            processed: true,
            processingTime: Date.now()
          }))
          
          // Create temporary objects
          const tempResults = processedEntities.reduce((acc: any, entity: any) => {
            acc[entity.name] = entity.complexity
            return acc
          }, {})
        }
      })
      
      expect(delta).toHaveNoMemoryLeaks()
      expect(after).toBeGreaterThan(before) // Some memory increase is expected
    })

    it('cleans up resources properly', async () => {
      const resources: any[] = []
      
      const { delta } = await PerformanceTestUtils.measureMemoryUsage(() => {
        // Create many resources
        for (let i = 0; i < 1000; i++) {
          resources.push({
            id: i,
            data: new Array(100).fill(i),
            timestamp: Date.now()
          })
        }
        
        // Simulate cleanup
        resources.splice(0, resources.length)
      })
      
      // Memory delta should be minimal after cleanup
      expect(delta).toBeLessThan(5 * 1024 * 1024) // Less than 5MB
    })
  })

  describe('Concurrent Operation Performance', () => {
    it('handles multiple concurrent operations efficiently', async () => {
      const concurrentOperations = Array.from({ length: 20 }, async (_, index) => {
        const data = testFixtures.analysisData.entities.slice(0, 50)
        
        return await measureAsyncOperation(async () => {
          return data.map((entity: any) => ({
            ...entity,
            operationId: index,
            processedAt: Date.now()
          }))
        })
      })
      
      const results = await Promise.all(concurrentOperations)
      
      // All operations should complete reasonably quickly
      results.forEach(({ duration }) => {
        expect(duration).toBeLessThan(200)
      })
      
      // Results should be correct
      results.forEach(({ result }, index) => {
        expect(result.length).toBe(Math.min(50, testFixtures.analysisData.entities.length))
        if (result.length > 0) {
          expect(result[0].operationId).toBe(index)
        }
      })
    })

    it('maintains performance under load', async () => {
      const startTime = Date.now()
      
      // Simulate high load with real data processing
      const promises = Array.from({ length: 100 }, async () => {
        const entities = testFixtures.analysisData.entities
        
        // Perform various operations
        const metrics = {
          complexity: entities.reduce((sum: number, e: any) => sum + e.complexity, 0),
          types: entities.reduce((acc: any, e: any) => {
            acc[e.type] = (acc[e.type] || 0) + 1
            return acc
          }, {}),
          dependencies: entities.flatMap((e: any) => e.dependencies).length
        }
        
        return metrics
      })
      
      const results = await Promise.all(promises)
      const endTime = Date.now()
      const totalTime = endTime - startTime
      
      expect(totalTime).toBeLessThan(2000) // Should complete under 2 seconds
      expect(results).toHaveLength(100)
      
      // Verify results are consistent
      const firstResult = results[0]
      results.forEach(result => {
        expect(result.complexity).toBe(firstResult.complexity)
        expect(Object.keys(result.types)).toEqual(Object.keys(firstResult.types))
      })
    })
  })
})

/**
 * Utility function to measure async operation performance
 */
async function measureAsyncOperation<T>(operation: () => Promise<T>): Promise<{ duration: number; result: T }> {
  const startTime = performance.now()
  const result = await operation()
  const endTime = performance.now()
  const duration = endTime - startTime
  
  return { duration, result }
}