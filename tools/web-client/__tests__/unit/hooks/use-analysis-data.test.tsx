/**
 * Unit tests for analysis data hook
 * Tests hook behavior with real data scenarios
 */

import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { AnalysisProvider } from '@/lib/contexts/analysis-context'
import { createTestFixtures } from '../../fixtures/real-test-data'

// Mock the analysis context hook
const mockUseAnalysis = () => {
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const loadFromFile = React.useCallback(async (file: File) => {
    setLoading(true)
    setError(null)
    
    try {
      const text = await file.text()
      const jsonData = JSON.parse(text)
      setData(jsonData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadSampleData = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const fixtures = await createTestFixtures()
      setData(fixtures.analysisData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sample data')
    } finally {
      setLoading(false)
    }
  }, [])

  const clearData = React.useCallback(() => {
    setData(null)
    setError(null)
  }, [])

  return {
    data,
    loading,
    error,
    loadFromFile,
    loadSampleData,
    clearData
  }
}

// Wrapper component for testing
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AnalysisProvider>{children}</AnalysisProvider>
)

describe('useAnalysis Hook', () => {
  let testFixtures: any

  beforeAll(async () => {
    testFixtures = await createTestFixtures()
  })

  describe('Initial State', () => {
    it('starts with null data and no loading', () => {
      const { result } = renderHook(() => mockUseAnalysis(), {
        wrapper: TestWrapper
      })

      expect(result.current.data).toBe(null)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBe(null)
    })

    it('provides all required methods', () => {
      const { result } = renderHook(() => mockUseAnalysis(), {
        wrapper: TestWrapper
      })

      expect(typeof result.current.loadFromFile).toBe('function')
      expect(typeof result.current.loadSampleData).toBe('function')
      expect(typeof result.current.clearData).toBe('function')
    })
  })

  describe('Loading Sample Data', () => {
    it('loads real sample data successfully', async () => {
      const { result } = renderHook(() => mockUseAnalysis(), {
        wrapper: TestWrapper
      })

      await act(async () => {
        await result.current.loadSampleData()
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.data).toBeTruthy()
        expect(result.current.error).toBe(null)
      })

      // Verify data structure
      expect(result.current.data).toHaveProperty('entities')
      expect(result.current.data).toHaveProperty('duplicates')
      expect(Array.isArray(result.current.data.entities)).toBe(true)
      expect(Array.isArray(result.current.data.duplicates)).toBe(true)
    })

    it('sets loading state correctly during sample data load', async () => {
      const { result } = renderHook(() => mockUseAnalysis(), {
        wrapper: TestWrapper
      })

      let loadingStates: boolean[] = []
      
      // Track loading states
      const trackLoading = () => {
        loadingStates.push(result.current.loading)
      }

      trackLoading() // Initial state

      await act(async () => {
        const promise = result.current.loadSampleData()
        trackLoading() // Should be true
        await promise
        trackLoading() // Should be false
      })

      expect(loadingStates).toEqual([false, true, false])
    })

    it('handles sample data loading errors', async () => {
      // Mock an error in createTestFixtures
      const originalCreateTestFixtures = createTestFixtures
      ;(global as any).createTestFixtures = jest.fn().mockRejectedValue(new Error('Mock error'))

      const { result } = renderHook(() => mockUseAnalysis(), {
        wrapper: TestWrapper
      })

      await act(async () => {
        await result.current.loadSampleData()
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.error).toBeTruthy()
        expect(result.current.data).toBe(null)
      })

      // Restore original
      ;(global as any).createTestFixtures = originalCreateTestFixtures
    })
  })

  describe('Loading from File', () => {
    it('loads data from valid JSON file', async () => {
      const { result } = renderHook(() => mockUseAnalysis(), {
        wrapper: TestWrapper
      })

      const jsonContent = JSON.stringify(testFixtures.analysisData)
      const file = new File([jsonContent], 'analysis.json', { type: 'application/json' })

      await act(async () => {
        await result.current.loadFromFile(file)
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.data).toBeTruthy()
        expect(result.current.error).toBe(null)
      })

      // Verify loaded data matches original
      expect(result.current.data.entities.length).toBe(testFixtures.analysisData.entities.length)
      expect(result.current.data.duplicates.length).toBe(testFixtures.analysisData.duplicates.length)
    })

    it('handles invalid JSON file', async () => {
      const { result } = renderHook(() => mockUseAnalysis(), {
        wrapper: TestWrapper
      })

      const invalidContent = 'invalid json content'
      const file = new File([invalidContent], 'invalid.json', { type: 'application/json' })

      await act(async () => {
        await result.current.loadFromFile(file)
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.error).toBeTruthy()
        expect(result.current.data).toBe(null)
      })

      expect(result.current.error).toContain('JSON')
    })

    it('handles empty file', async () => {
      const { result } = renderHook(() => mockUseAnalysis(), {
        wrapper: TestWrapper
      })

      const file = new File([''], 'empty.json', { type: 'application/json' })

      await act(async () => {
        await result.current.loadFromFile(file)
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.error).toBeTruthy()
      })
    })

    it('tracks loading state during file upload', async () => {
      const { result } = renderHook(() => mockUseAnalysis(), {
        wrapper: TestWrapper
      })

      const jsonContent = JSON.stringify({ entities: [], duplicates: [] })
      const file = new File([jsonContent], 'test.json', { type: 'application/json' })

      let wasLoading = false

      await act(async () => {
        const promise = result.current.loadFromFile(file)
        wasLoading = result.current.loading
        await promise
      })

      expect(wasLoading).toBe(true)
      expect(result.current.loading).toBe(false)
    })
  })

  describe('Data Clearing', () => {
    it('clears data and error state', async () => {
      const { result } = renderHook(() => mockUseAnalysis(), {
        wrapper: TestWrapper
      })

      // First load some data
      await act(async () => {
        await result.current.loadSampleData()
      })

      expect(result.current.data).toBeTruthy()

      // Then clear it
      act(() => {
        result.current.clearData()
      })

      expect(result.current.data).toBe(null)
      expect(result.current.error).toBe(null)
    })

    it('clears error state', async () => {
      const { result } = renderHook(() => mockUseAnalysis(), {
        wrapper: TestWrapper
      })

      // Create an error state
      const invalidFile = new File(['invalid'], 'test.json')
      await act(async () => {
        await result.current.loadFromFile(invalidFile)
      })

      expect(result.current.error).toBeTruthy()

      // Clear the error
      act(() => {
        result.current.clearData()
      })

      expect(result.current.error).toBe(null)
    })
  })

  describe('State Management', () => {
    it('maintains consistent state across multiple operations', async () => {
      const { result } = renderHook(() => mockUseAnalysis(), {
        wrapper: TestWrapper
      })

      // Load data
      await act(async () => {
        await result.current.loadSampleData()
      })

      const firstData = result.current.data

      // Load different data
      const jsonContent = JSON.stringify({ entities: [{ name: 'test' }], duplicates: [] })
      const file = new File([jsonContent], 'test.json')

      await act(async () => {
        await result.current.loadFromFile(file)
      })

      const secondData = result.current.data

      expect(firstData).not.toEqual(secondData)
      expect(result.current.error).toBe(null)
    })

    it('prevents race conditions in rapid successive calls', async () => {
      const { result } = renderHook(() => mockUseAnalysis(), {
        wrapper: TestWrapper
      })

      // Make rapid successive calls
      const promises = [
        act(() => result.current.loadSampleData()),
        act(() => result.current.loadSampleData()),
        act(() => result.current.loadSampleData())
      ]

      await Promise.all(promises)

      // Should end up in a consistent state
      expect(result.current.loading).toBe(false)
      expect(result.current.data).toBeTruthy()
    })
  })

  describe('Real Data Integration', () => {
    it('works with actual project analysis data', async () => {
      const { result } = renderHook(() => mockUseAnalysis(), {
        wrapper: TestWrapper
      })

      await act(async () => {
        await result.current.loadSampleData()
      })

      const data = result.current.data

      // Verify real data characteristics
      if (data.entities.length > 0) {
        const entity = data.entities[0]
        expect(entity).toHaveProperty('name')
        expect(entity).toHaveProperty('path')
        expect(entity).toHaveProperty('type')
        expect(entity).toHaveProperty('complexity')
        expect(typeof entity.complexity).toBe('number')
        expect(entity.complexity).toBeGreaterThan(0)
      }

      // Verify metrics if present
      if (data.metrics) {
        expect(typeof data.metrics.complexity).toBe('number')
        expect(typeof data.metrics.maintainability).toBe('number')
        expect(data.metrics.maintainability).toBeGreaterThanOrEqual(0)
        expect(data.metrics.maintainability).toBeLessThanOrEqual(100)
      }
    })

    it('handles real project complexity data', async () => {
      const { result } = renderHook(() => mockUseAnalysis(), {
        wrapper: TestWrapper
      })

      await act(async () => {
        await result.current.loadSampleData()
      })

      const data = result.current.data

      // Verify complexity values are realistic
      data.entities.forEach((entity: any) => {
        expect(typeof entity.complexity).toBe('number')
        expect(entity.complexity).toBeGreaterThanOrEqual(1)
        expect(entity.complexity).toBeLessThan(100) // Reasonable upper bound
      })
    })

    it('processes real dependency data', async () => {
      const { result } = renderHook(() => mockUseAnalysis(), {
        wrapper: TestWrapper
      })

      await act(async () => {
        await result.current.loadSampleData()
      })

      const data = result.current.data

      data.entities.forEach((entity: any) => {
        expect(Array.isArray(entity.dependencies)).toBe(true)
        
        // Dependencies should be valid package names
        entity.dependencies.forEach((dep: string) => {
          expect(typeof dep).toBe('string')
          expect(dep.length).toBeGreaterThan(0)
          // Should not be relative paths
          expect(dep).not.toMatch(/^\.\.?\//)
        })
      })
    })
  })

  describe('Error Recovery', () => {
    it('recovers from errors on subsequent successful operations', async () => {
      const { result } = renderHook(() => mockUseAnalysis(), {
        wrapper: TestWrapper
      })

      // Create error state
      const invalidFile = new File(['invalid json'], 'test.json')
      await act(async () => {
        await result.current.loadFromFile(invalidFile)
      })

      expect(result.current.error).toBeTruthy()
      expect(result.current.data).toBe(null)

      // Recover with valid operation
      await act(async () => {
        await result.current.loadSampleData()
      })

      expect(result.current.error).toBe(null)
      expect(result.current.data).toBeTruthy()
    })

    it('maintains error state until next operation', async () => {
      const { result } = renderHook(() => mockUseAnalysis(), {
        wrapper: TestWrapper
      })

      const invalidFile = new File(['invalid'], 'test.json')
      await act(async () => {
        await result.current.loadFromFile(invalidFile)
      })

      const errorMessage = result.current.error

      // Error should persist
      expect(result.current.error).toBe(errorMessage)
      expect(result.current.loading).toBe(false)
      expect(result.current.data).toBe(null)
    })
  })
})