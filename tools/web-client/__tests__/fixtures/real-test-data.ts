/**
 * Real test fixtures generated from actual project analysis
 * This file contains utilities to create test data from real sources
 */

import { AnalysisData } from '../types/analysis-types'
import { CompleteAnalysisData } from '../../types/reports'
import { createCompleteAnalysisData, createSimpleEntity } from '../utils/test-data-helpers'

/**
 * Test database setup for integration tests
 */
export class TestDatabase {
  private data: Map<string, Map<string, unknown>> = new Map()

  async setup(): Promise<void> {
    // In a real implementation, this would set up a test database
    this.data.clear()
  }

  async teardown(): Promise<void> {
    this.data.clear()
  }

  async insert(table: string, data: unknown): Promise<string> {
    const id = `${table}_${Date.now()}_${Math.random()}`
    if (!this.data.has(table)) {
      this.data.set(table, new Map())
    }
    this.data.get(table)!.set(id, data)
    return id
  }

  async find(table: string, id: string): Promise<unknown> {
    return this.data.get(table)?.get(id)
  }

  async findAll(table: string): Promise<unknown[]> {
    const tableData = this.data.get(table)
    return tableData ? Array.from(tableData.values()) : []
  }

  async delete(table: string, id: string): Promise<void> {
    this.data.get(table)?.delete(id)
  }
}

/**
 * API test server setup
 */
interface ApiRequest {
  body?: unknown;
  method?: string;
  path?: string;
}

interface ApiResponse {
  status: number;
  data?: unknown;
  error?: string;
}

export class TestApiServer {
  private routes: Map<string, (req: ApiRequest) => ApiResponse> = new Map()

  setup(): void {
    // Mock API routes
    this.routes.set('GET /api/analysis', () => ({
      status: 200,
      data: { entities: [], duplicates: [] }
    }))

    this.routes.set('POST /api/analysis', (req) => ({
      status: 201,
      data: { id: 'test-analysis', ...req.body }
    }))

    this.routes.set('GET /api/performance', () => ({
      status: 200,
      data: []
    }))

    this.routes.set('GET /api/quality', () => ({
      status: 200,
      data: {
        maintainability: 85,
        reliability: 90,
        security: 80
      }
    }))
  }

  async request(method: string, path: string, body?: unknown): Promise<ApiResponse> {
    const key = `${method} ${path}`
    const handler = this.routes.get(key)
    
    if (!handler) {
      return { status: 404, error: 'Not found' }
    }

    try {
      return handler({ body, method, path })
    } catch (error) {
      return { status: 500, error: (error as Error).message }
    }
  }
}

/**
 * Performance test utilities
 */
export class PerformanceTestUtils {
  static async measureRenderTime(renderFn: () => void): Promise<number> {
    const start = performance.now()
    renderFn()
    const end = performance.now()
    return end - start
  }

  static async measureMemoryUsage(fn: () => void): Promise<{
    before: number
    after: number
    delta: number
  }> {
    const before = (performance as any).memory?.usedJSHeapSize || 0
    fn()
    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }
    const after = (performance as any).memory?.usedJSHeapSize || 0
    
    return {
      before,
      after,
      delta: after - before
    }
  }

  static createLargeDataset(size: number) {
    return Array.from({ length: size }, (_, i) => ({
      id: `item-${i}`,
      name: `Item ${i}`,
      data: new Array(100).fill(i).join(',')
    }))
  }
}

/**
 * E2E test utilities
 */
export class E2ETestUtils {
  static async waitForElement(selector: string, timeout = 5000): Promise<Element | null> {
    return new Promise((resolve) => {
      const startTime = Date.now()
      
      function check() {
        const element = document.querySelector(selector)
        if (element) {
          resolve(element)
        } else if (Date.now() - startTime > timeout) {
          resolve(null)
        } else {
          requestAnimationFrame(check)
        }
      }
      
      check()
    })
  }

  static async simulateUserInteraction(element: Element, action: string) {
    const event = new Event(action, { bubbles: true })
    element.dispatchEvent(event)
    
    // Wait for any async updates
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  static createMockFile(name: string, content: string, type = 'text/plain'): File {
    const blob = new Blob([content], { type })
    return new File([blob], name, { type })
  }
}

/**
 * Snapshot test utilities
 */
export class SnapshotTestUtils {
  static normalizeSnapshot(element: Element): string {
    // Remove dynamic attributes that change between test runs
    const clone = element.cloneNode(true) as Element
    
    // Remove timestamps, IDs, and other dynamic content
    clone.querySelectorAll('[data-testid*="timestamp"]').forEach(el => {
      el.textContent = 'TIMESTAMP'
    })
    
    clone.querySelectorAll('[id]').forEach(el => {
      el.setAttribute('id', 'NORMALIZED_ID')
    })
    
    return clone.outerHTML
  }
}

/**
 * Real project fixture generator
 */
export async function generateProjectFixtures() {
  const projectPath = process.cwd()
  return await createTestFixtures(projectPath)
}

// Re-export createTestFixtures function from mock-data
export async function createTestFixtures(projectPath?: string) {
  const { createTestFixtures: createTestFixturesImpl } = await import('../utils/mock-data')
  return createTestFixturesImpl(projectPath)
}

/**
 * Minimal test data for unit tests (backward compatibility)
 */
export const minimalTestData: AnalysisData = {
  entities: [
    {
      name: 'test-component.tsx',
      file: 'components/test-component.tsx',
      type: 'component',
      line: 1,
      column: 1,
      exportType: 'named',
      dependencies: ['react'],
      complexity: 5
    }
  ],
  duplicates: [],
  circularDeps: [],
  unusedExports: [],
  wrapperPatterns: [],
  recommendations: [],
  timestamp: '2025-01-01T00:00:00.000Z',
  summary: {
    totalFiles: 1,
    totalEntities: 1,
    duplicateClusters: 0,
    circularDependencies: 0,
    unusedExports: 0,
    codeSmells: 0
  }
}

/**
 * Complete minimal test data for components expecting full structure
 */
export const minimalCompleteTestData: CompleteAnalysisData = createCompleteAnalysisData({
  entities: [
    createSimpleEntity({
      name: 'test-component.tsx',
      path: 'components/test-component.tsx',
      type: 'component',
      dependencies: ['react'],
      complexity: 5,
      issues: []
    })
  ]
})

/**
 * Complex test data for integration tests
 */
export async function getComplexTestData(): Promise<AnalysisData> {
  const fixtures = await generateProjectFixtures()
  // Convert CompleteAnalysisData to AnalysisData format
  const { convertToAnalysisData } = await import('../utils/mock-data')
  return convertToAnalysisData(fixtures.analysisData)
}

// Export TestEnvironment class for imports
export { TestEnvironment } from '../setup/test-environment'