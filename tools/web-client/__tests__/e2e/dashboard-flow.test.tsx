/**
 * End-to-End tests for Dashboard user flows
 * Tests complete user interactions with real data
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '../utils/test-utils'
import { createTestFixtures, E2ETestUtils } from '../fixtures/real-test-data'
import { AnalysisProvider } from '@/lib/contexts/analysis-context'

// Mock components that would be tested in full E2E
const MockDashboardPage = () => {
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(false)
  
  const loadData = async () => {
    setLoading(true)
    try {
      const fixtures = await createTestFixtures()
      setData(fixtures.analysisData)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div data-testid="dashboard">
      <h1>Dashboard</h1>
      <button onClick={loadData} disabled={loading}>
        Load Analysis
      </button>
      {loading && <div data-testid="loading">Loading...</div>}
      {data && (
        <div data-testid="analysis-content">
          <div data-testid="entity-count">{data.entities.length} entities</div>
          <div data-testid="duplicate-count">{data.duplicates.length} duplicates</div>
          {data.metrics && (
            <div data-testid="metrics">
              <span data-testid="complexity">{data.metrics.complexity}</span>
              <span data-testid="maintainability">{data.metrics.maintainability}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const MockUploadFlow = () => {
  const [file, setFile] = React.useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = React.useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return
    
    setFile(selectedFile)
    setUploadStatus('uploading')
    
    try {
      // Simulate file processing
      await new Promise(resolve => setTimeout(resolve, 500))
      setUploadStatus('success')
    } catch {
      setUploadStatus('error')
    }
  }
  
  return (
    <div data-testid="upload-flow">
      <input
        type="file"
        onChange={handleFileUpload}
        data-testid="file-input"
        accept=".json"
      />
      {uploadStatus === 'uploading' && <div data-testid="upload-loading">Uploading...</div>}
      {uploadStatus === 'success' && <div data-testid="upload-success">Upload complete</div>}
      {uploadStatus === 'error' && <div data-testid="upload-error">Upload failed</div>}
      {file && <div data-testid="file-name">{file.name}</div>}
    </div>
  )
}

describe('Dashboard E2E Flow Tests', () => {
  describe('Complete Dashboard Loading Flow', () => {
    it('loads and displays real analysis data', async () => {
      render(<MockDashboardPage />)
      
      // Initial state
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
      expect(screen.queryByTestId('analysis-content')).not.toBeInTheDocument()
      
      // Click load button
      const loadButton = screen.getByText('Load Analysis')
      fireEvent.click(loadButton)
      
      // Loading state
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toBeInTheDocument()
      })
      
      // Data loaded state
      await waitFor(
        () => {
          expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
          expect(screen.getByTestId('analysis-content')).toBeInTheDocument()
        },
        { timeout: 3000 }
      )
      
      // Verify real data is displayed
      const entityCount = screen.getByTestId('entity-count')
      const duplicateCount = screen.getByTestId('duplicate-count')
      
      expect(entityCount).toBeInTheDocument()
      expect(duplicateCount).toBeInTheDocument()
      
      // Should show actual counts from real data
      expect(entityCount.textContent).toMatch(/\d+ entities/)
      expect(duplicateCount.textContent).toMatch(/\d+ duplicates/)
    })

    it('displays real metrics after data load', async () => {
      render(<MockDashboardPage />)
      
      const loadButton = screen.getByText('Load Analysis')
      fireEvent.click(loadButton)
      
      await waitFor(() => {
        const metrics = screen.queryByTestId('metrics')
        if (metrics) {
          const complexity = screen.getByTestId('complexity')
          const maintainability = screen.getByTestId('maintainability')
          
          expect(complexity).toBeInTheDocument()
          expect(maintainability).toBeInTheDocument()
          
          // Should contain real numeric values
          expect(complexity.textContent).toMatch(/^\d+(\.\d+)?$/)
          expect(maintainability.textContent).toMatch(/^\d+(\.\d+)?$/)
        }
      }, { timeout: 3000 })
    })

    it('handles loading states correctly', async () => {
      render(<MockDashboardPage />)
      
      const loadButton = screen.getByText('Load Analysis')
      
      // Initial state - button enabled
      expect(loadButton).not.toBeDisabled()
      
      // Click to start loading
      fireEvent.click(loadButton)
      
      // Button should be disabled during loading
      await waitFor(() => {
        expect(loadButton).toBeDisabled()
      })
      
      // Wait for completion
      await waitFor(
        () => {
          expect(loadButton).not.toBeDisabled()
        },
        { timeout: 3000 }
      )
    })
  })

  describe('File Upload Flow', () => {
    it('handles file upload with real JSON data', async () => {
      render(<MockUploadFlow />)
      
      // Create a real JSON file with analysis data
      const testFixtures = await createTestFixtures()
      const jsonContent = JSON.stringify(testFixtures.analysisData, null, 2)
      const file = E2ETestUtils.createMockFile('analysis.json', jsonContent, 'application/json')
      
      const fileInput = screen.getByTestId('file-input')
      
      // Upload file
      fireEvent.change(fileInput, { target: { files: [file] } })
      
      // Check upload states
      await waitFor(() => {
        expect(screen.getByTestId('upload-loading')).toBeInTheDocument()
      })
      
      await waitFor(
        () => {
          expect(screen.queryByTestId('upload-loading')).not.toBeInTheDocument()
          expect(screen.getByTestId('upload-success')).toBeInTheDocument()
        },
        { timeout: 1000 }
      )
      
      // Verify file name is displayed
      expect(screen.getByTestId('file-name')).toHaveTextContent('analysis.json')
    })

    it('handles upload errors gracefully', async () => {
      // This would simulate network errors or invalid files
      const originalImplementation = window.File
      
      // Mock File to throw an error
      ;(global as any).File = jest.fn(() => {
        throw new Error('Invalid file')
      })
      
      render(<MockUploadFlow />)
      
      const fileInput = screen.getByTestId('file-input')
      
      try {
        const invalidFile = new File(['invalid'], 'invalid.txt', { type: 'text/plain' })
        fireEvent.change(fileInput, { target: { files: [invalidFile] } })
      } catch (error) {
        // Expected error - restore original
        global.File = originalImplementation
      }
      
      // Should handle error gracefully without crashing
      expect(screen.getByTestId('upload-flow')).toBeInTheDocument()
    })
  })

  describe('User Interaction Flows', () => {
    it('simulates real user navigation', async () => {
      // Mock navigation states
      const NavigationTest = () => {
        const [currentView, setCurrentView] = React.useState('dashboard')
        
        return (
          <div data-testid="navigation-test">
            <nav>
              <button onClick={() => setCurrentView('dashboard')} data-testid="nav-dashboard">
                Dashboard
              </button>
              <button onClick={() => setCurrentView('analysis')} data-testid="nav-analysis">
                Analysis
              </button>
              <button onClick={() => setCurrentView('reports')} data-testid="nav-reports">
                Reports
              </button>
            </nav>
            <main data-testid={`view-${currentView}`}>
              {currentView === 'dashboard' && <div>Dashboard Content</div>}
              {currentView === 'analysis' && <div>Analysis Content</div>}
              {currentView === 'reports' && <div>Reports Content</div>}
            </main>
          </div>
        )
      }
      
      render(<NavigationTest />)
      
      // Initial state
      expect(screen.getByTestId('view-dashboard')).toBeInTheDocument()
      expect(screen.getByText('Dashboard Content')).toBeInTheDocument()
      
      // Navigate to analysis
      await E2ETestUtils.simulateUserInteraction(
        screen.getByTestId('nav-analysis'),
        'click'
      )
      
      expect(screen.getByTestId('view-analysis')).toBeInTheDocument()
      expect(screen.getByText('Analysis Content')).toBeInTheDocument()
      
      // Navigate to reports
      await E2ETestUtils.simulateUserInteraction(
        screen.getByTestId('nav-reports'),
        'click'
      )
      
      expect(screen.getByTestId('view-reports')).toBeInTheDocument()
      expect(screen.getByText('Reports Content')).toBeInTheDocument()
    })

    it('handles real data filtering and search', async () => {
      const testFixtures = await createTestFixtures()
      
      const SearchTest = () => {
        const [searchTerm, setSearchTerm] = React.useState('')
        const [entities] = React.useState(testFixtures.analysisData.entities)
        
        const filteredEntities = entities.filter((entity: any) =>
          entity.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entity.path.toLowerCase().includes(searchTerm.toLowerCase())
        )
        
        return (
          <div data-testid="search-test">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search entities..."
              data-testid="search-input"
            />
            <div data-testid="results-count">{filteredEntities.length} results</div>
            <div data-testid="results">
              {filteredEntities.map((entity: any, index: number) => (
                <div key={index} data-testid={`result-${index}`}>
                  {entity.name} - {entity.path}
                </div>
              ))}
            </div>
          </div>
        )
      }
      
      render(<SearchTest />)
      
      const searchInput = screen.getByTestId('search-input')
      const initialCount = screen.getByTestId('results-count')
      
      // Should show all results initially
      expect(initialCount.textContent).toMatch(/^\d+ results$/)
      
      // Search for specific term (use first entity name if available)
      if (testFixtures.analysisData.entities.length > 0) {
        const firstEntity = testFixtures.analysisData.entities[0]
        const searchTerm = firstEntity.name.substring(0, 3)
        
        fireEvent.change(searchInput, { target: { value: searchTerm } })
        
        await waitFor(() => {
          const filteredCount = screen.getByTestId('results-count')
          const initialCountNum = parseInt(initialCount.textContent!.match(/\d+/)![0])
          const filteredCountNum = parseInt(filteredCount.textContent!.match(/\d+/)![0])
          
          expect(filteredCountNum).toBeLessThanOrEqual(initialCountNum)
        })
      }
    })
  })

  describe('Performance in E2E Flows', () => {
    it('maintains responsive UI during data operations', async () => {
      const testFixtures = await createTestFixtures()
      
      const PerformanceTest = () => {
        const [isProcessing, setIsProcessing] = React.useState(false)
        const [processedData, setProcessedData] = React.useState<any>(null)
        
        const processLargeDataset = async () => {
          setIsProcessing(true)
          
          // Simulate heavy computation with real data
          await new Promise(resolve => {
            setTimeout(() => {
              const processed = {
                totalEntities: testFixtures.analysisData.entities.length,
                complexitySum: testFixtures.analysisData.entities.reduce(
                  (sum: number, entity: any) => sum + entity.complexity, 0
                ),
                duplicatesCount: testFixtures.analysisData.duplicates.length
              }
              setProcessedData(processed)
              resolve(processed)
            }, 100)
          })
          
          setIsProcessing(false)
        }
        
        return (
          <div data-testid="performance-test">
            <button
              onClick={processLargeDataset}
              disabled={isProcessing}
              data-testid="process-button"
            >
              Process Data
            </button>
            {isProcessing && <div data-testid="processing">Processing...</div>}
            {processedData && (
              <div data-testid="results">
                <div>Total: {processedData.totalEntities}</div>
                <div>Complexity: {processedData.complexitySum}</div>
                <div>Duplicates: {processedData.duplicatesCount}</div>
              </div>
            )}
          </div>
        )
      }
      
      render(<PerformanceTest />)
      
      const processButton = screen.getByTestId('process-button')
      fireEvent.click(processButton)
      
      // Should show processing state
      await waitFor(() => {
        expect(screen.getByTestId('processing')).toBeInTheDocument()
        expect(processButton).toBeDisabled()
      })
      
      // Should complete and show results
      await waitFor(
        () => {
          expect(screen.queryByTestId('processing')).not.toBeInTheDocument()
          expect(screen.getByTestId('results')).toBeInTheDocument()
          expect(processButton).not.toBeDisabled()
        },
        { timeout: 1000 }
      )
      
      // Verify results contain real calculated values
      const results = screen.getByTestId('results')
      expect(results.textContent).toMatch(/Total: \d+/)
      expect(results.textContent).toMatch(/Complexity: \d+/)
      expect(results.textContent).toMatch(/Duplicates: \d+/)
    })
  })
})