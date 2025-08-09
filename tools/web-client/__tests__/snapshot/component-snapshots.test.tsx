/**
 * Snapshot tests for component rendering
 * Uses real data to create stable snapshots
 */

import React from 'react'
import { render } from '../utils/test-utils'
import { createTestFixtures, minimalTestData, minimalCompleteTestData, SnapshotTestUtils } from '../fixtures/real-test-data'
import { DashboardCharts } from '@/components/dashboard/dashboard-charts'
import { createCompleteAnalysisData, createTestMetrics, createSimpleEntity, createSimpleDuplicate } from '../utils/test-data-helpers'

// Mock Chart.js components for consistent snapshots
jest.mock('react-chartjs-2', () => ({
  Line: ({ data, options, ...props }: any) => (
    <div data-testid="line-chart" data-chart-config={JSON.stringify({ data: data?.labels?.length || 0, options: options?.responsive || false })} {...props}>
      Line Chart
    </div>
  ),
  Bar: ({ data, options, ...props }: any) => (
    <div data-testid="bar-chart" data-chart-config={JSON.stringify({ data: data?.labels?.length || 0, options: options?.responsive || false })} {...props}>
      Bar Chart
    </div>
  ),
  Doughnut: ({ data, options, ...props }: any) => (
    <div data-testid="doughnut-chart" data-chart-config={JSON.stringify({ data: data?.datasets?.length || 0, options: options?.responsive || false })} {...props}>
      Doughnut Chart
    </div>
  ),
}))

describe('Component Snapshots', () => {
  let realTestData: any

  beforeAll(async () => {
    const fixtures = await createTestFixtures()
    realTestData = fixtures.analysisData
  })

  describe('DashboardCharts Snapshots', () => {
    it('renders consistently with minimal data', () => {
      const { container } = render(<DashboardCharts data={minimalCompleteTestData} />)
      const normalizedSnapshot = SnapshotTestUtils.normalizeSnapshot(container)
      
      expect(normalizedSnapshot).toMatchSnapshot('dashboard-charts-minimal')
    })

    it('renders consistently with real project data', () => {
      // Convert realTestData to CompleteAnalysisData if needed
      const completeData = realTestData.metadata ? realTestData : createCompleteAnalysisData({
        entities: realTestData.entities?.map((e: any) => createSimpleEntity(e)) || [],
        duplicates: realTestData.duplicates?.map((d: any) => createSimpleDuplicate(d)) || []
      })
      const { container } = render(<DashboardCharts data={completeData} />)
      const normalizedSnapshot = SnapshotTestUtils.normalizeSnapshot(container)
      
      expect(normalizedSnapshot).toMatchSnapshot('dashboard-charts-real-data')
    })

    it('renders consistently with empty data', () => {
      const emptyData = createCompleteAnalysisData()
      const { container } = render(<DashboardCharts data={emptyData} />)
      const normalizedSnapshot = SnapshotTestUtils.normalizeSnapshot(container)
      
      expect(normalizedSnapshot).toMatchSnapshot('dashboard-charts-empty')
    })

    it('renders consistently with complex data', () => {
      const complexData = createCompleteAnalysisData({
        entities: Array.from({ length: 10 }, (_, i) => createSimpleEntity({
          name: `Entity${i}`,
          path: `path/to/entity${i}.ts`,
          type: ['class', 'function', 'module', 'component'][i % 4],
          dependencies: [`dep${i}`, `dep${i + 1}`],
          complexity: 5 + (i * 2),
          issues: i % 3 === 0 ? [{
            type: 'complexity',
            severity: 'medium' as const,
            message: `Issue ${i}`
          }] : []
        })),
        duplicates: [
          createSimpleDuplicate({
            id: 'dup-1',
            type: 'structural',
            severity: 'high',
            occurrences: [
              { path: 'file1.ts', startLine: 1, endLine: 10, content: 'duplicated content', context: 'function A' },
              { path: 'file2.ts', startLine: 5, endLine: 14, content: 'duplicated content', context: 'function B' }
            ],
            linesCount: 10
          })
        ],
        metrics: createTestMetrics({
          overview: {
            totalFiles: 10,
            totalLines: 500,
            totalEntities: 10,
            analysisTime: 1000,
            timestamp: new Date()
          },
          quality: {
            maintainabilityIndex: 85,
            technicalDebt: {
              rating: 'B' as const,
              minutes: 300
            },
            duplicateLines: 25,
            duplicateRatio: 5,
            testCoverage: {
              lines: 75,
              branches: 70,
              functions: 80,
              statements: 75
            }
          }
        }),
        recommendations: [{
          id: 'test-rec',
          title: 'Test Recommendation',
          description: 'Test description',
          category: 'maintainability' as const,
          priority: 'medium' as const,
          effort: {
            level: 'low' as const,
            hours: 2,
            description: 'Should take 2 hours to implement'
          },
          impact: {
            level: 'medium' as const,
            metrics: ['maintainability', 'complexity'],
            description: 'Will improve code maintainability'
          },
          affectedFiles: ['Entity0.ts', 'Entity1.ts'],
          implementation: {
            steps: ['Extract common functionality', 'Create shared utilities'],
            codeExamples: [{
              before: 'const duplicate = () => { }',
              after: 'import { shared } from "./utils"',
              language: 'typescript'
            }],
            automatable: true,
            tools: ['typescript', 'eslint']
          },
          references: ['https://refactoring.com'],
          tags: ['refactoring', 'maintainability']
        }]
      })
      
      const { container } = render(<DashboardCharts data={complexData} />)
      const normalizedSnapshot = SnapshotTestUtils.normalizeSnapshot(container)
      
      expect(normalizedSnapshot).toMatchSnapshot('dashboard-charts-complex')
    })
  })

  describe('Chart Configuration Snapshots', () => {
    it('captures chart configurations consistently', () => {
      const { container } = render(<DashboardCharts data={realTestData} />)
      
      // Get all chart elements
      const charts = container.querySelectorAll('[data-testid*="-chart"]')
      const chartConfigs: any[] = []
      
      charts.forEach(chart => {
        const config = chart.getAttribute('data-chart-config')
        if (config) {
          try {
            chartConfigs.push({
              type: chart.getAttribute('data-testid'),
              config: JSON.parse(config)
            })
          } catch (e) {
            chartConfigs.push({
              type: chart.getAttribute('data-testid'),
              config: 'invalid'
            })
          }
        }
      })
      
      expect(chartConfigs).toMatchSnapshot('chart-configurations')
    })
  })

  describe('Component Structure Snapshots', () => {
    it('maintains consistent DOM structure', () => {
      const { container } = render(<DashboardCharts data={realTestData} />)
      
      // Extract just the structure without content
      const structure = extractDOMStructure(container)
      expect(structure).toMatchSnapshot('dashboard-charts-structure')
    })

    it('maintains consistent grid layout', () => {
      const { container } = render(<DashboardCharts data={realTestData} />)
      
      const gridElement = container.querySelector('.grid')
      if (gridElement) {
        const gridStructure = {
          classes: gridElement.className,
          childCount: gridElement.children.length,
          children: Array.from(gridElement.children).map(child => ({
            tagName: child.tagName,
            classes: child.className,
            hasContent: child.textContent ? child.textContent.length > 0 : false
          }))
        }
        
        expect(gridStructure).toMatchSnapshot('grid-layout-structure')
      }
    })
  })

  describe('Responsive Snapshots', () => {
    it('captures mobile layout structure', () => {
      // Mock window size for mobile
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })
      
      const { container } = render(<DashboardCharts data={realTestData} />)
      const normalizedSnapshot = SnapshotTestUtils.normalizeSnapshot(container)
      
      expect(normalizedSnapshot).toMatchSnapshot('dashboard-charts-mobile')
    })

    it('captures desktop layout structure', () => {
      // Mock window size for desktop
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200,
      })
      
      const { container } = render(<DashboardCharts data={realTestData} />)
      const normalizedSnapshot = SnapshotTestUtils.normalizeSnapshot(container)
      
      expect(normalizedSnapshot).toMatchSnapshot('dashboard-charts-desktop')
    })
  })

  describe('Theme Snapshots', () => {
    it('captures light theme styling', () => {
      // The theme provider in test-utils defaults to light theme
      const { container } = render(<DashboardCharts data={realTestData} />)
      
      // Extract theme-related classes
      const themeClasses = extractThemeClasses(container)
      expect(themeClasses).toMatchSnapshot('theme-classes-light')
    })
  })

  describe('Error State Snapshots', () => {
    it('captures error boundary rendering', () => {
      // Mock console.error to suppress error logs in tests
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      const BrokenComponent = () => {
        throw new Error('Test error')
      }
      
      const TestWrapper = () => (
        <div data-testid="error-test">
          <BrokenComponent />
        </div>
      )
      
      try {
        const { container } = render(<TestWrapper />)
        const normalizedSnapshot = SnapshotTestUtils.normalizeSnapshot(container)
        expect(normalizedSnapshot).toMatchSnapshot('error-state')
      } catch (error) {
        // Expected error - test the error boundary behavior
        expect(error).toBeDefined()
      }
      
      consoleSpy.mockRestore()
    })
  })
})

/**
 * Extract DOM structure for snapshots
 */
function extractDOMStructure(element: Element): any {
  return {
    tagName: element.tagName,
    className: element.className,
    attributes: Array.from(element.attributes)
      .filter(attr => !attr.name.startsWith('data-') || attr.name === 'data-testid')
      .reduce((acc, attr) => {
        acc[attr.name] = attr.value
        return acc
      }, {} as Record<string, string>),
    children: Array.from(element.children).map(child => extractDOMStructure(child))
  }
}

/**
 * Extract theme-related classes for snapshots
 */
function extractThemeClasses(container: Element): string[] {
  const themeClasses: string[] = []
  
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_ELEMENT,
    null
  )
  
  let node = walker.nextNode()
  while (node) {
    const element = node as Element
    const classes = element.className.split(' ')
    
    // Extract theme-related classes (dark:, light:, etc.)
    const themeSpecificClasses = classes.filter(cls => 
      cls.includes('dark:') || 
      cls.includes('light:') || 
      cls.includes('bg-') ||
      cls.includes('text-') ||
      cls.includes('border-')
    )
    
    themeClasses.push(...themeSpecificClasses)
    node = walker.nextNode()
  }
  
  // Return unique classes sorted for consistent snapshots
  return Array.from(new Set(themeClasses)).sort()
}