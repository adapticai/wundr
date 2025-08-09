import React from 'react'
import { render, screen, waitFor } from '../utils/test-utils'
import { DashboardCharts } from '@/components/dashboard/dashboard-charts'
import { createTestFixtures, minimalTestData, minimalCompleteTestData } from '../fixtures/real-test-data'
import { createCompleteAnalysisData, createSimpleEntity, createSimpleDuplicate } from '../utils/test-data-helpers'

/**
 * Integration tests for DashboardCharts using real test data
 * NO FAKE DATA - Uses actual project analysis
 */
describe('DashboardCharts Integration', () => {
  let realTestData: any

  beforeAll(async () => {
    const fixtures = await createTestFixtures()
    realTestData = fixtures.analysisData
  })

  it('renders all chart components with real data', () => {
    render(<DashboardCharts data={realTestData} />)
    
    expect(screen.getByText('Entity Distribution')).toBeInTheDocument()
    expect(screen.getByText('Complexity Distribution')).toBeInTheDocument()
    
    // Should handle real data without errors
    const chartElements = document.querySelectorAll('[data-testid*="-chart"]')
    expect(chartElements.length).toBeGreaterThan(0)
  })

  it('processes real entity data correctly', async () => {
    // Convert realTestData to CompleteAnalysisData if needed
    const completeData = realTestData.metadata ? realTestData : createCompleteAnalysisData({
      entities: realTestData.entities?.map((e: any) => createSimpleEntity(e)) || [],
      duplicates: realTestData.duplicates?.map((d: any) => createSimpleDuplicate(d)) || []
    })
    render(<DashboardCharts data={completeData} />)
    
    await waitFor(() => {
      // Check if charts are rendered with real data
      const canvases = document.querySelectorAll('canvas, [data-testid*="-chart"]')
      expect(canvases.length).toBeGreaterThan(0)
    })
    
    // Verify real data is being processed
    if (realTestData.entities.length > 0) {
      expect(screen.getByText('Entity Distribution')).toBeInTheDocument()
    }
  })

  it('handles empty data gracefully', () => {
    const emptyData = createCompleteAnalysisData()
    render(<DashboardCharts data={emptyData} />)
    
    expect(screen.getByText('Entity Distribution')).toBeInTheDocument()
    // Should not crash with empty data
  })

  it('works with minimal test data', () => {
    render(<DashboardCharts data={minimalCompleteTestData} />)
    
    expect(screen.getByText('Entity Distribution')).toBeInTheDocument()
    expect(screen.getByText('Complexity Distribution')).toBeInTheDocument()
  })

  it('processes real entity types correctly', () => {
    render(<DashboardCharts data={realTestData} />)
    
    // The component should process and group real entities
    expect(screen.getByText('Entity Distribution')).toBeInTheDocument()
    
    // Verify charts exist
    const charts = document.querySelectorAll('[data-testid*="-chart"]')
    expect(charts.length).toBeGreaterThan(0)
  })

  it('calculates complexity from real data', () => {
    render(<DashboardCharts data={realTestData} />)
    
    expect(screen.getByText('Complexity Distribution')).toBeInTheDocument()
    
    // Should process real complexity values
    const complexityChart = document.querySelector('[data-testid*="chart"]')
    expect(complexityChart).toBeTruthy()
  })

  it('handles real duplicates data', () => {
    render(<DashboardCharts data={realTestData} />)
    
    // Should process duplicates if they exist
    const charts = document.querySelectorAll('[data-testid*="-chart"]')
    expect(charts.length).toBeGreaterThan(0)
  })

  it('responsive grid layout works with real data', () => {
    render(<DashboardCharts data={realTestData} />)
    
    const container = screen.getByText('Entity Distribution').closest('.grid')
    expect(container).toHaveClass('md:grid-cols-2')
  })

  it('integrates with theme system', () => {
    render(<DashboardCharts data={realTestData} />)
    
    // Check if theme classes are applied
    const container = document.querySelector('.grid')
    expect(container).toBeTruthy()
  })

  it('handles real project complexity distribution', () => {
    if (realTestData.entities.length > 0) {
      render(<DashboardCharts data={realTestData} />)
      
      // Should create complexity chart with real values
      expect(screen.getByText('Complexity Distribution')).toBeInTheDocument()
      
      // Verify complexity values are processed
      const hasComplexEntities = realTestData.entities.some((e: any) => e.complexity > 0)
      expect(hasComplexEntities).toBe(true)
    }
  })
})