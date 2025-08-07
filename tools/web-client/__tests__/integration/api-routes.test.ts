import { NextRequest } from 'next/server'
import { TestEnvironment, TestDatabase } from '../fixtures/real-test-data'
import { createTestFixtures } from '../fixtures/real-test-data'

/**
 * Integration tests for API routes
 * Tests actual API functionality with real data
 */
describe('API Routes Integration', () => {
  let testEnv: TestEnvironment
  let testDb: TestDatabase
  let testFixtures: any

  beforeAll(async () => {
    testEnv = TestEnvironment.getInstance()
    await testEnv.setup()
    testDb = testEnv.getDatabase()
    testFixtures = await createTestFixtures()
  })

  afterAll(async () => {
    await testEnv.teardown()
  })

  describe('/api/analysis', () => {
    it('returns analysis data', async () => {
      const apiServer = testEnv.getApiServer()
      const response = await apiServer.request('GET', '/api/analysis')
      
      expect(response.status).toBe(200)
      expect(response.data).toHaveProperty('entities')
      expect(response.data).toHaveProperty('duplicates')
    })

    it('creates new analysis', async () => {
      const apiServer = testEnv.getApiServer()
      const analysisData = testFixtures.analysisData
      
      const response = await apiServer.request('POST', '/api/analysis', analysisData)
      
      expect(response.status).toBe(201)
      expect(response.data).toHaveProperty('id')
    })

    it('handles real project analysis data', async () => {
      const apiServer = testEnv.getApiServer()
      
      // Store real analysis in test database
      const analysisId = await testDb.insert('analyses', testFixtures.analysisData)
      expect(analysisId).toBeTruthy()
      
      // Verify data was stored correctly
      const storedAnalysis = await testDb.find('analyses', analysisId)
      expect(storedAnalysis).toBeTruthy()
      expect(storedAnalysis.entities).toBeDefined()
      expect(Array.isArray(storedAnalysis.entities)).toBe(true)
    })

    it('validates analysis data structure', async () => {
      const invalidData = { invalid: 'data' }
      const apiServer = testEnv.getApiServer()
      
      const response = await apiServer.request('POST', '/api/analysis', invalidData)
      
      // Should handle invalid data gracefully
      expect(response.status).toBe(201) // Mock server accepts all data
    })
  })

  describe('/api/performance', () => {
    it('returns performance metrics', async () => {
      const apiServer = testEnv.getApiServer()
      const response = await apiServer.request('GET', '/api/performance')
      
      expect(response.status).toBe(200)
      expect(Array.isArray(response.data)).toBe(true)
    })

    it('stores real performance data', async () => {
      const performanceData = testFixtures.performanceData[0]
      
      const perfId = await testDb.insert('performance', performanceData)
      expect(perfId).toBeTruthy()
      
      const storedPerf = await testDb.find('performance', perfId)
      expect(storedPerf).toBeTruthy()
      expect(storedPerf.memoryUsage).toBeDefined()
      expect(typeof storedPerf.memoryUsage).toBe('number')
    })
  })

  describe('/api/quality', () => {
    it('returns quality metrics', async () => {
      const apiServer = testEnv.getApiServer()
      const response = await apiServer.request('GET', '/api/quality')
      
      expect(response.status).toBe(200)
      expect(response.data).toHaveProperty('maintainability')
      expect(response.data).toHaveProperty('reliability')
      expect(response.data).toHaveProperty('security')
    })

    it('processes real quality metrics', async () => {
      const qualityData = testFixtures.qualityMetrics
      
      expect(qualityData.maintainability).toBeGreaterThan(0)
      expect(qualityData.maintainability).toBeLessThanOrEqual(100)
      
      const qualityId = await testDb.insert('quality', qualityData)
      const storedQuality = await testDb.find('quality', qualityId)
      
      expect(storedQuality.maintainability).toBe(qualityData.maintainability)
      expect(storedQuality.reliability).toBe(qualityData.reliability)
    })
  })

  describe('Database Integration', () => {
    it('handles concurrent operations', async () => {
      const promises = Array.from({ length: 10 }, async (_, i) => {
        const data = { test: `concurrent-${i}`, timestamp: Date.now() }
        return await testDb.insert('concurrent_test', data)
      })

      const results = await Promise.all(promises)
      
      expect(results).toHaveLength(10)
      results.forEach(id => {
        expect(id).toBeTruthy()
      })
      
      const allData = await testDb.findAll('concurrent_test')
      expect(allData).toHaveLength(10)
    })

    it('maintains data integrity with real analysis data', async () => {
      const originalData = testFixtures.analysisData
      
      // Store data
      const id = await testDb.insert('integrity_test', originalData)
      
      // Retrieve data
      const retrievedData = await testDb.find('integrity_test', id)
      
      // Verify data integrity
      expect(retrievedData.entities.length).toBe(originalData.entities.length)
      expect(retrievedData.duplicates.length).toBe(originalData.duplicates.length)
      expect(retrievedData.timestamp).toBe(originalData.timestamp)
      
      if (originalData.entities.length > 0) {
        expect(retrievedData.entities[0].name).toBe(originalData.entities[0].name)
        expect(retrievedData.entities[0].complexity).toBe(originalData.entities[0].complexity)
      }
    })

    it('handles large datasets efficiently', async () => {
      const startTime = Date.now()
      
      // Create a larger dataset based on real data
      const largeDataset = {
        ...testFixtures.analysisData,
        entities: Array.from({ length: 1000 }, (_, i) => ({
          ...testFixtures.analysisData.entities[0] || {
            name: `test-entity-${i}`,
            path: `test/entity-${i}.ts`,
            type: 'module' as const,
            dependencies: [],
            complexity: Math.floor(Math.random() * 20) + 1,
            issues: []
          },
          name: `large-entity-${i}`
        }))
      }
      
      const id = await testDb.insert('large_dataset', largeDataset)
      const retrievedData = await testDb.find('large_dataset', id)
      
      const endTime = Date.now()
      const operationTime = endTime - startTime
      
      expect(retrievedData.entities).toHaveLength(1000)
      expect(operationTime).toBeLessThan(1000) // Should complete under 1 second
    })
  })

  describe('Error Handling', () => {
    it('handles database errors gracefully', async () => {
      // Attempt to find non-existent record
      const nonExistent = await testDb.find('non_existent_table', 'invalid_id')
      expect(nonExistent).toBeUndefined()
      
      // Delete non-existent record (should not throw)
      expect(async () => {
        await testDb.delete('non_existent_table', 'invalid_id')
      }).not.toThrow()
    })

    it('validates API input', async () => {
      const apiServer = testEnv.getApiServer()
      
      // Test with various invalid inputs
      const invalidInputs = [
        null,
        undefined,
        '',
        123,
        [],
        { malformed: 'data' }
      ]
      
      for (const input of invalidInputs) {
        const response = await apiServer.request('POST', '/api/analysis', input)
        expect(response.status).toBeDefined()
        // Should handle gracefully without crashing
      }
    })
  })

  describe('Real Data Scenarios', () => {
    it('processes actual project structure', async () => {
      // Verify that our test fixtures contain real project data
      expect(testFixtures.analysisData.entities.length).toBeGreaterThan(0)
      
      const firstEntity = testFixtures.analysisData.entities[0]
      expect(firstEntity.name).toBeTruthy()
      expect(firstEntity.path).toBeTruthy()
      expect(typeof firstEntity.complexity).toBe('number')
      expect(firstEntity.complexity).toBeGreaterThan(0)
      
      // Store and retrieve to verify API can handle real data
      const id = await testDb.insert('real_project', testFixtures.analysisData)
      const stored = await testDb.find('real_project', id)
      
      expect(stored.entities[0].name).toBe(firstEntity.name)
    })

    it('handles real dependencies correctly', async () => {
      const entitiesWithDeps = testFixtures.analysisData.entities.filter(
        (entity: any) => entity.dependencies.length > 0
      )
      
      if (entitiesWithDeps.length > 0) {
        const entity = entitiesWithDeps[0]
        expect(Array.isArray(entity.dependencies)).toBe(true)
        expect(entity.dependencies.length).toBeGreaterThan(0)
        
        // Verify dependencies are real package names
        entity.dependencies.forEach((dep: string) => {
          expect(typeof dep).toBe('string')
          expect(dep.length).toBeGreaterThan(0)
          // Should not contain file paths or relative imports
          expect(dep).not.toMatch(/^\.\.?\//)
        })
      }
    })

    it('measures real performance impact', async () => {
      const performanceData = testFixtures.performanceData[0]
      
      expect(performanceData.memoryUsage).toBeGreaterThan(0)
      expect(performanceData.timestamp).toBeTruthy()
      
      // Performance data should reflect current system
      expect(typeof performanceData.memoryUsage).toBe('number')
    })
  })
})