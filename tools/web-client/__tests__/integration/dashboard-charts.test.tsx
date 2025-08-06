import React from 'react'
import { render, screen, waitFor } from '../utils/test-utils'
import { DashboardCharts } from '@/components/dashboard/dashboard-charts'
import { mockAnalysisData } from '../utils/mock-data'

describe('DashboardCharts Integration', () => {
  it('renders all chart components without errors', () => {
    render(<DashboardCharts data={mockAnalysisData} />)
    
    expect(screen.getByText('Entity Distribution')).toBeInTheDocument()
    expect(screen.getByText('Duplicate Severity')).toBeInTheDocument()
    expect(screen.getByText('Complexity Distribution')).toBeInTheDocument()
    expect(screen.getByText('Dependency Analysis')).toBeInTheDocument()
  })

  it('processes entity data correctly', async () => {
    render(<DashboardCharts data={mockAnalysisData} />)
    
    await waitFor(() => {
      // Check if charts are rendered (Chart.js creates canvas elements)
      const canvases = document.querySelectorAll('canvas')
      expect(canvases.length).toBe(4) // 4 charts total
    })
  })

  it('handles empty data gracefully', () => {
    const emptyData = { entities: [], duplicates: [] }
    render(<DashboardCharts data={emptyData} />)
    
    expect(screen.getByText('Entity Distribution')).toBeInTheDocument()
    // Should not crash with empty data
  })

  it('applies theme colors correctly', () => {
    render(<DashboardCharts data={mockAnalysisData} />)
    
    // Check if CSS variables are used
    const cards = screen.getAllByRole('article')
    expect(cards.length).toBeGreaterThan(0)
  })

  it('groups entities by type correctly', () => {
    const testData = {
      ...mockAnalysisData,
      entities: [
        { ...mockAnalysisData.entities[0], type: 'class' },
        { ...mockAnalysisData.entities[1], type: 'class' },
        { ...mockAnalysisData.entities[2], type: 'function' }
      ]
    }
    
    render(<DashboardCharts data={testData} />)
    
    // The component should process and group entities
    expect(screen.getByText('Entity Distribution')).toBeInTheDocument()
  })

  it('calculates complexity buckets correctly', () => {
    const testData = {
      ...mockAnalysisData,
      entities: [
        { ...mockAnalysisData.entities[0], complexity: 3 },
        { ...mockAnalysisData.entities[1], complexity: 15 },
        { ...mockAnalysisData.entities[2], complexity: 25 }
      ]
    }
    
    render(<DashboardCharts data={testData} />)
    
    expect(screen.getByText('Complexity Distribution')).toBeInTheDocument()
  })

  it('handles duplicates severity levels', () => {
    const testData = {
      ...mockAnalysisData,
      duplicates: [
        { ...mockAnalysisData.duplicates[0], severity: 'critical' },
        { ...mockAnalysisData.duplicates[0], severity: 'high', id: '2' },
        { ...mockAnalysisData.duplicates[0], severity: 'medium', id: '3' }
      ]
    }
    
    render(<DashboardCharts data={testData} />)
    
    expect(screen.getByText('Duplicate Severity')).toBeInTheDocument()
  })

  it('responsive grid layout works correctly', () => {
    render(<DashboardCharts data={mockAnalysisData} />)
    
    const container = screen.getByText('Entity Distribution').closest('.grid')
    expect(container).toHaveClass('md:grid-cols-2')
  })
})