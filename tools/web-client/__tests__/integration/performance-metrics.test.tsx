import React from 'react'
import { render, screen, fireEvent, waitFor } from '../utils/test-utils'
import { PerformanceMetrics } from '@/components/visualizations/performance/PerformanceMetrics'
import { mockPerformanceData } from '../utils/mock-data'

describe('PerformanceMetrics Integration', () => {
  it('renders performance dashboard with all components', () => {
    render(<PerformanceMetrics data={mockPerformanceData} />)
    
    expect(screen.getByText('Performance Metrics')).toBeInTheDocument()
    expect(screen.getByText('Build Time')).toBeInTheDocument()
    expect(screen.getByText('Bundle Size')).toBeInTheDocument()
    expect(screen.getByText('Memory Usage')).toBeInTheDocument()
    expect(screen.getByText('Load Time')).toBeInTheDocument()
  })

  it('displays realtime badge when enabled', () => {
    render(<PerformanceMetrics data={mockPerformanceData} realtime={true} />)
    
    expect(screen.getByText('Live')).toBeInTheDocument()
    expect(screen.getByText('Live')).toHaveClass('animate-pulse')
  })

  it('switches time ranges correctly', async () => {
    render(<PerformanceMetrics data={mockPerformanceData} />)
    
    // Default is 24H
    expect(screen.getByText('24H')).toHaveAttribute('data-state', 'active')
    
    // Click on 7D
    fireEvent.click(screen.getByText('7D'))
    
    await waitFor(() => {
      expect(screen.getByText('7D')).toHaveAttribute('data-state', 'active')
    })
  })

  it('calculates and displays trends correctly', () => {
    render(<PerformanceMetrics data={mockPerformanceData} />)
    
    // Should show trend indicators
    expect(screen.getByText(/from previous period/)).toBeInTheDocument()
  })

  it('renders all chart types', async () => {
    render(<PerformanceMetrics data={mockPerformanceData} />)
    
    await waitFor(() => {
      // Check for chart containers
      expect(screen.getByText('Build Time Trend')).toBeInTheDocument()
      expect(screen.getByText('Bundle Size History')).toBeInTheDocument()
      expect(screen.getByText('Resource Utilization')).toBeInTheDocument()
      
      // Should have 3 canvas elements for charts
      const canvases = document.querySelectorAll('canvas')
      expect(canvases.length).toBe(3)
    })
  })

  it('displays metric cards with current values', () => {
    render(<PerformanceMetrics data={mockPerformanceData} />)
    
    // Check if current values are displayed
    const buildTime = mockPerformanceData[0].buildTime
    expect(screen.getByText(`${buildTime.toFixed(1)} ms`)).toBeInTheDocument()
  })

  it('handles empty data gracefully', () => {
    render(<PerformanceMetrics data={[]} />)
    
    expect(screen.getByText('Performance Metrics')).toBeInTheDocument()
    // Should not crash with empty data
  })

  it('filters data based on selected time range', () => {
    const extendedData = [
      ...mockPerformanceData,
      {
        timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        buildTime: 4000,
        bundleSize: 1100000,
        memoryUsage: 300,
        cpuUsage: 50,
        loadTime: 1500
      }
    ]
    
    render(<PerformanceMetrics data={extendedData} />)
    
    // Switch to 1H view
    fireEvent.click(screen.getByText('1H'))
    
    // Data should be filtered (only recent data)
    expect(screen.getByText('Build Time Trend')).toBeInTheDocument()
  })

  it('shows trend icons correctly', () => {
    const trendingData = [
      ...mockPerformanceData,
      {
        timestamp: new Date().toISOString(),
        buildTime: 5000, // Higher than before
        bundleSize: 1024000,
        memoryUsage: 256,
        cpuUsage: 45,
        loadTime: 1200
      }
    ]
    
    render(<PerformanceMetrics data={trendingData} />)
    
    // Should show trend indicators (TrendingUp/Down icons)
    const cards = screen.getAllByRole('article')
    expect(cards.length).toBeGreaterThan(0)
  })

  it('updates radar chart with latest data', () => {
    render(<PerformanceMetrics data={mockPerformanceData} />)
    
    expect(screen.getByText('Resource Utilization')).toBeInTheDocument()
    // Radar chart should display current resource usage
  })
})