/**
 * Test environment setup and configuration
 * Provides utilities for setting up consistent test environments
 */

import { TestDatabase, TestApiServer } from '../fixtures/real-test-data'

/**
 * Global test environment manager
 */
export class TestEnvironment {
  private static instance: TestEnvironment | null = null
  private database: TestDatabase | null = null
  private apiServer: TestApiServer | null = null

  static getInstance(): TestEnvironment {
    if (!TestEnvironment.instance) {
      TestEnvironment.instance = new TestEnvironment()
    }
    return TestEnvironment.instance
  }

  async setup(): Promise<void> {
    // Set up test database
    this.database = new TestDatabase()
    await this.database.setup()

    // Set up test API server
    this.apiServer = new TestApiServer()
    this.apiServer.setup()

    // Set up environment variables for testing
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = 'test://localhost:5432/test_db'
    process.env.API_BASE_URL = 'http://localhost:3001'

    // Mock window globals that tests might need
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost:3000',
        origin: 'http://localhost:3000',
        pathname: '/',
        search: '',
        hash: ''
      },
      writable: true
    })

    Object.defineProperty(window, 'history', {
      value: {
        pushState: jest.fn(),
        replaceState: jest.fn(),
        back: jest.fn(),
        forward: jest.fn(),
        go: jest.fn()
      },
      writable: true
    })
  }

  async teardown(): Promise<void> {
    if (this.database) {
      await this.database.teardown()
      this.database = null
    }

    this.apiServer = null

    // Clean up environment
    delete process.env.DATABASE_URL
    delete process.env.API_BASE_URL
  }

  getDatabase(): TestDatabase {
    if (!this.database) {
      throw new Error('Test environment not set up. Call setup() first.')
    }
    return this.database
  }

  getApiServer(): TestApiServer {
    if (!this.apiServer) {
      throw new Error('Test environment not set up. Call setup() first.')
    }
    return this.apiServer
  }
}

/**
 * Test setup utilities
 */
export class TestSetup {
  static async setupBeforeAll(): Promise<void> {
    const env = TestEnvironment.getInstance()
    await env.setup()
  }

  static async teardownAfterAll(): Promise<void> {
    const env = TestEnvironment.getInstance()
    await env.teardown()
  }

  static setupBeforeEach(): void {
    // Clear all mocks
    jest.clearAllMocks()

    // Reset console spies
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(console, 'log').mockImplementation(() => {})
  }

  static teardownAfterEach(): void {
    // Restore console
    jest.restoreAllMocks()
  }
}

/**
 * Test isolation utilities
 */
export class TestIsolation {
  private static originalFetch: typeof global.fetch
  private static originalLocalStorage: Storage

  static setup(): void {
    // Store originals
    TestIsolation.originalFetch = global.fetch
    TestIsolation.originalLocalStorage = window.localStorage

    // Mock fetch
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>

    // Mock localStorage
    const localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
      length: 0,
      key: jest.fn()
    }
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock
    })

    // Mock sessionStorage
    Object.defineProperty(window, 'sessionStorage', {
      value: localStorageMock
    })
  }

  static teardown(): void {
    // Restore originals
    if (TestIsolation.originalFetch) {
      global.fetch = TestIsolation.originalFetch
    }

    if (TestIsolation.originalLocalStorage) {
      Object.defineProperty(window, 'localStorage', {
        value: TestIsolation.originalLocalStorage
      })
    }
  }
}

/**
 * Custom matchers for testing
 */
export const customMatchers = {
  toBeAccessible: (element: Element) => {
    const hasAriaLabel = element.hasAttribute('aria-label')
    const hasAriaLabelledBy = element.hasAttribute('aria-labelledby')
    const hasRole = element.hasAttribute('role')
    
    const pass = hasAriaLabel || hasAriaLabelledBy || hasRole
    
    return {
      pass,
      message: () => 
        pass 
          ? `Expected element not to be accessible`
          : `Expected element to be accessible (have aria-label, aria-labelledby, or role)`
    }
  },

  toHavePerformantRender: (renderTime: number) => {
    const threshold = 16 // 60fps threshold
    const pass = renderTime < threshold
    
    return {
      pass,
      message: () =>
        pass
          ? `Expected render time ${renderTime}ms to be slow`
          : `Expected render time ${renderTime}ms to be under ${threshold}ms`
    }
  },

  toHaveNoMemoryLeaks: (memoryDelta: number) => {
    const threshold = 1024 * 1024 // 1MB threshold
    const pass = memoryDelta < threshold
    
    return {
      pass,
      message: () =>
        pass
          ? `Expected memory usage to increase`
          : `Expected memory delta ${memoryDelta} bytes to be under ${threshold} bytes`
    }
  }
}

// Extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeAccessible(): R
      toHavePerformantRender(): R
      toHaveNoMemoryLeaks(): R
    }
  }
}