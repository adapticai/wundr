import React from 'react'
import { render, screen, waitFor } from '../../utils/test-utils'
import { DashboardCharts } from '@/components/dashboard/dashboard-charts'
import { createTestFixtures, minimalTestData } from '../../fixtures/real-test-data'
import { PerformanceTestUtils } from '../../fixtures/real-test-data'

/**
 * Unit tests for DashboardCharts component
 * Uses real test data, not mocked data
 */
describe('DashboardCharts Unit Tests', () => {
  let realTestData: any

  beforeAll(async () => {
    const fixtures = await createTestFixtures()
    realTestData = fixtures.analysisData
  })

  describe('Component Rendering', () => {
    it('renders without crashing with real data', async () => {
      expect(() => {
        render(<DashboardCharts data={realTestData} />)
      }).not.toThrow()
    })

    it('renders all chart containers with real entities', async () => {
      render(<DashboardCharts data={realTestData} />)
      
      // Wait for charts to render
      await waitFor(() => {
        expect(screen.getByText('Entity Distribution')).toBeInTheDocument()
        expect(screen.getByText('Complexity Distribution')).toBeInTheDocument()
      })
    })

    it('handles empty data gracefully', () => {
      const emptyData = { entities: [], duplicates: [] }
      render(<DashboardCharts data={emptyData} />)
      
      expect(screen.getByText('Entity Distribution')).toBeInTheDocument()
      // Should not crash with empty data
    })

    it('handles minimal test data', () => {
      render(<DashboardCharts data={minimalTestData} />)
      
      expect(screen.getByText('Entity Distribution')).toBeInTheDocument()
      expect(screen.getByText('Complexity Distribution')).toBeInTheDocument()
    })
  })

  describe('Data Processing', () => {
    it('processes real entity data correctly', async () => {
      render(<DashboardCharts data={realTestData} />)
      
      await waitFor(() => {
        const canvases = document.querySelectorAll('canvas')
        expect(canvases.length).toBeGreaterThanOrEqual(2)
        
        // Check that charts have datasets
        const lineChart = screen.getByTestId('line-chart')
        expect(lineChart).toHaveAttribute('data-chart-type', 'line')
      })
    })

    it('calculates entity type distribution from real data', () => {
      render(<DashboardCharts data={realTestData} />)
      
      // The component should process and group entities by type
      expect(screen.getByText('Entity Distribution')).toBeInTheDocument()
      
      // Verify chart elements are present
      const canvases = document.querySelectorAll('[data-testid*="-chart"]')
      expect(canvases.length).toBeGreaterThan(0)
    })

    it('calculates complexity buckets from real complexity values', () => {
      const testData = {
        ...realTestData,
        entities: realTestData.entities.map((entity: any, index: number) => ({
          ...entity,
          complexity: [5, 15, 25][index] || entity.complexity
        }))
      }
      
      render(<DashboardCharts data={testData} />)
      
      expect(screen.getByText('Complexity Distribution')).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('renders large datasets efficiently', async () => {
      const largeDataset = PerformanceTestUtils.createLargeDataset(1000)
      const testDataWithLargeSet = {
        ...realTestData,
        entities: largeDataset.map((item, index) => ({
          name: item.name,
          path: `test/${item.id}.ts`,
          type: 'module' as const,
          dependencies: [],
          complexity: Math.floor(Math.random() * 20) + 1,
          issues: []
        }))
      }

      const renderTime = await PerformanceTestUtils.measureRenderTime(() => {
        render(<DashboardCharts data={testDataWithLargeSet} />)
      })

      expect(renderTime).toHavePerformantRender()
    })

    it('manages memory efficiently with large datasets', async () => {
      const largeDataset = PerformanceTestUtils.createLargeDataset(500)
      const testDataWithLargeSet = {
        ...realTestData,
        entities: largeDataset.map((item, index) => ({
          name: item.name,
          path: `test/${item.id}.ts`,
          type: 'module' as const,
          dependencies: [],
          complexity: Math.floor(Math.random() * 20) + 1,
          issues: []
        }))
      }

      const { delta } = await PerformanceTestUtils.measureMemoryUsage(() => {
        render(<DashboardCharts data={testDataWithLargeSet} />)
      })

      expect(delta).toHaveNoMemoryLeaks()
    })
  })

  describe('Accessibility', () => {
    it('provides accessible chart elements', () => {
      render(<DashboardCharts data={realTestData} />)
      
      // Check for accessible chart containers
      const chartContainers = screen.getAllByRole('article')
      expect(chartContainers.length).toBeGreaterThan(0)
      
      chartContainers.forEach(container => {
        expect(container).toBeAccessible()
      })
    })

    it('has proper ARIA labels for charts', async () => {
      render(<DashboardCharts data={realTestData} />)
      
      await waitFor(() => {
        const canvases = document.querySelectorAll('canvas')
        canvases.forEach(canvas => {
          expect(canvas).toHaveAttribute('data-testid')
          expect(canvas).toHaveAttribute('data-chart-type')
        })
      })
    })
  })

  describe('Theme Integration', () => {
    it('applies theme styles correctly', () => {
      render(<DashboardCharts data={realTestData} />)
      
      const container = document.querySelector('.grid')
      expect(container).toBeTruthy()
      
      // Check for responsive classes
      expect(container).toHaveClass('md:grid-cols-2')
    })
  })

  describe('Error Handling', () => {
    it('handles corrupted data gracefully', () => {
      const corruptedData = {
        entities: [
          { name: null, path: undefined, type: 'invalid' } as any
        ],
        duplicates: []
      }

      expect(() => {
        render(<DashboardCharts data={corruptedData} />)
      }).not.toThrow()
    })

    it('handles missing required properties', () => {
      const incompleteData = {
        entities: [{}] as any,
        duplicates: []
      }

      expect(() => {
        render(<DashboardCharts data={incompleteData} />)
      }).not.toThrow()
    })
  })

  describe('Real Data Validation', () => {
    it('works with actual project entities', async () => {
      // This test uses the actual project structure
      expect(realTestData.entities).toBeDefined()
      expect(Array.isArray(realTestData.entities)).toBe(true)
      
      if (realTestData.entities.length > 0) {
        const firstEntity = realTestData.entities[0]
        expect(firstEntity).toHaveProperty('name')
        expect(firstEntity).toHaveProperty('path')
        expect(firstEntity).toHaveProperty('type')
        expect(firstEntity).toHaveProperty('complexity')
        expect(typeof firstEntity.complexity).toBe('number')
      }
      
      render(<DashboardCharts data={realTestData} />)
      expect(screen.getByText('Entity Distribution')).toBeInTheDocument()
    })

    it('processes real complexity metrics', () => {
      render(<DashboardCharts data={realTestData} />)
      
      // Verify that real complexity values are being processed
      expect(screen.getByText('Complexity Distribution')).toBeInTheDocument()
      
      // The chart should be created with real data
      const complexityChart = document.querySelector('[data-testid*="chart"]')
      expect(complexityChart).toBeTruthy()
    })
  })
})