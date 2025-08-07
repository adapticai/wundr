import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ThemeProvider } from 'next-themes'
import PerformancePage from '../page'

// Mock the performance data hook
jest.mock('@/hooks/use-performance-data', () => ({
  usePerformanceData: jest.fn(() => ({
    data: [
      {
        timestamp: '2024-01-01T10:00:00Z',
        buildTime: 15000,
        bundleSize: 2048576,
        memoryUsage: 512,
        cpuUsage: 25,
        loadTime: 800,
        testDuration: 8000,
        cacheHitRate: 0.85,
        errorRate: 0.5
      }
    ],
    loading: { isLoading: false, isRefreshing: false },
    error: null,
    refresh: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    latest: {
      timestamp: '2024-01-01T10:00:00Z',
      buildTime: 15000,
      bundleSize: 2048576,
      memoryUsage: 512,
      cpuUsage: 25,
      loadTime: 800,
      testDuration: 8000,
      cacheHitRate: 0.85,
      errorRate: 0.5
    }
  }))
}))

// Mock the toast hook
jest.mock('@/hooks/use-toast', () => ({
  useToast: jest.fn(() => ({
    toast: jest.fn()
  }))
}))

// Mock Chart.js
jest.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="line-chart">Line Chart</div>,
  Bar: () => <div data-testid="bar-chart">Bar Chart</div>,
  Pie: () => <div data-testid="pie-chart">Pie Chart</div>
}))

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider attribute="class" defaultTheme="light">
      {component}
    </ThemeProvider>
  )
}

describe('PerformancePage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the performance dashboard', () => {
    renderWithTheme(<PerformancePage />)
    
    expect(screen.getByText('Performance Analytics')).toBeInTheDocument()
    expect(screen.getByText('Monitor and analyze application performance metrics in real-time')).toBeInTheDocument()
  })

  it('displays performance score cards', async () => {
    renderWithTheme(<PerformancePage />)
    
    await waitFor(() => {
      expect(screen.getByText('Overall Score')).toBeInTheDocument()
      expect(screen.getByText('Build Performance')).toBeInTheDocument()
      expect(screen.getByText('Load Performance')).toBeInTheDocument()
      expect(screen.getByText('Reliability Score')).toBeInTheDocument()
    })
  })

  it('displays current metrics cards', async () => {
    renderWithTheme(<PerformancePage />)
    
    await waitFor(() => {
      expect(screen.getByText('Load Time')).toBeInTheDocument()
      expect(screen.getByText('800ms')).toBeInTheDocument()
      expect(screen.getByText('Memory Usage')).toBeInTheDocument()
      expect(screen.getByText('512MB')).toBeInTheDocument()
      expect(screen.getByText('CPU Usage')).toBeInTheDocument()
      expect(screen.getByText('25%')).toBeInTheDocument()
      expect(screen.getByText('Cache Hit Rate')).toBeInTheDocument()
      expect(screen.getByText('85.0%')).toBeInTheDocument()
    })
  })

  it('renders chart tabs', async () => {
    renderWithTheme(<PerformancePage />)
    
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /throughput/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /reliability/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /resources/i })).toBeInTheDocument()
    })
  })

  it('displays charts in different tabs', async () => {
    renderWithTheme(<PerformancePage />)
    
    // Overview tab should be active by default
    await waitFor(() => {
      expect(screen.getByTestId('line-chart')).toBeInTheDocument()
      expect(screen.getByText('Response Time Trends')).toBeInTheDocument()
    })

    // Click throughput tab
    fireEvent.click(screen.getByRole('tab', { name: /throughput/i }))
    await waitFor(() => {
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
      expect(screen.getByText('Throughput Metrics')).toBeInTheDocument()
    })

    // Click reliability tab
    fireEvent.click(screen.getByRole('tab', { name: /reliability/i }))
    await waitFor(() => {
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument()
      expect(screen.getByText('Reliability Metrics')).toBeInTheDocument()
    })

    // Click resources tab
    fireEvent.click(screen.getByRole('tab', { name: /resources/i }))
    await waitFor(() => {
      expect(screen.getByTestId('line-chart')).toBeInTheDocument()
      expect(screen.getByText('Resource Usage')).toBeInTheDocument()
    })
  })

  it('handles time range selection', async () => {
    renderWithTheme(<PerformancePage />)
    
    await waitFor(() => {
      const timeRangeSelect = screen.getByRole('combobox')
      expect(timeRangeSelect).toBeInTheDocument()
    })
  })

  it('handles real-time toggle', async () => {
    renderWithTheme(<PerformancePage />)
    
    await waitFor(() => {
      const realtimeSwitch = screen.getByRole('switch')
      expect(realtimeSwitch).toBeInTheDocument()
      expect(realtimeSwitch).not.toBeChecked()
    })

    fireEvent.click(screen.getByRole('switch'))
    await waitFor(() => {
      expect(screen.getByText('Live')).toBeInTheDocument()
    })
  })

  it('displays refresh and export buttons', async () => {
    renderWithTheme(<PerformancePage />)
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
    })
  })

  it('displays performance summary', async () => {
    renderWithTheme(<PerformancePage />)
    
    await waitFor(() => {
      expect(screen.getByText('Performance Summary')).toBeInTheDocument()
      expect(screen.getByText('Key metrics and insights from the current dataset (1 data points)')).toBeInTheDocument()
      expect(screen.getByText('Response Times')).toBeInTheDocument()
      expect(screen.getByText('Resource Usage')).toBeInTheDocument()
      expect(screen.getByText('Reliability')).toBeInTheDocument()
    })
  })
})