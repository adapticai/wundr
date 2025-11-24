/**
 * Testing Utilities for Genesis-App
 * Helpers for unit, integration, and e2e testing
 */

import type {
  MockConfig,
  MockInstance,
  MockCall,
  Fixture,
  FactoryFunction,
  Seeder,
  TestDatabase,
  MockServer,
  MockResponse,
} from '../types/testing';

/** Create a mock function */
export function createMock<T extends (...args: unknown[]) => unknown>(
  config?: Partial<MockConfig>,
): T & MockInstance {
  const calls: MockCall[] = [];
  let implementation: ((...args: unknown[]) => unknown) | undefined = config?.implementation as
    | ((...args: unknown[]) => unknown)
    | undefined;
  let returnValue: unknown = config?.returnValue;
  let resolvedValue: unknown = config?.resolvedValue;
  let rejectedValue: unknown = config?.rejectedValue;
  const mockOnce = config?.mockOnce ?? false;

  const mockFn = ((...args: unknown[]) => {
    const call: MockCall = {
      args,
      timestamp: Date.now(),
    };

    try {
      let result: unknown;

      if (implementation) {
        result = implementation(...args);
        if (mockOnce) {
          implementation = undefined;
        }
      } else if (rejectedValue !== undefined) {
        const error = rejectedValue;
        if (mockOnce) {
          rejectedValue = undefined;
        }
        call.error = error as Error;
        calls.push(call);
        return Promise.reject(error);
      } else if (resolvedValue !== undefined) {
        result = resolvedValue;
        if (mockOnce) {
          resolvedValue = undefined;
        }
        call.result = result;
        calls.push(call);
        return Promise.resolve(result);
      } else {
        result = returnValue;
      }

      call.result = result;
      calls.push(call);
      return result;
    } catch (error) {
      call.error = error as Error;
      calls.push(call);
      throw error;
    }
  }) as T & MockInstance;

  // Add mock instance properties
  Object.defineProperty(mockFn, 'calls', { get: () => [...calls] });
  Object.defineProperty(mockFn, 'callCount', { get: () => calls.length });
  Object.defineProperty(mockFn, 'lastCall', { get: () => calls[calls.length - 1] });
  Object.defineProperty(mockFn, 'name', { value: config?.name ?? 'mock', writable: false });

  mockFn.mockClear = () => {
    calls.length = 0;
  };

  mockFn.mockReset = () => {
    calls.length = 0;
    implementation = undefined;
    returnValue = undefined;
    resolvedValue = undefined;
    rejectedValue = undefined;
  };

  mockFn.mockRestore = () => {
    mockFn.mockReset();
  };

  mockFn.mockReturnValue = (value: unknown) => {
    returnValue = value;
    resolvedValue = undefined;
    rejectedValue = undefined;
    implementation = undefined;
  };

  mockFn.mockResolvedValue = (value: unknown) => {
    resolvedValue = value;
    returnValue = undefined;
    rejectedValue = undefined;
    implementation = undefined;
  };

  mockFn.mockRejectedValue = (error: Error) => {
    rejectedValue = error;
    returnValue = undefined;
    resolvedValue = undefined;
    implementation = undefined;
  };

  mockFn.mockImplementation = (fn: (...args: unknown[]) => unknown) => {
    implementation = fn;
    returnValue = undefined;
    resolvedValue = undefined;
    rejectedValue = undefined;
  };

  return mockFn;
}

/** Create a spy on an object method */
export function createSpy<T extends object, K extends keyof T>(
  obj: T,
  method: K,
): T[K] & MockInstance {
  const original = obj[method];
  const mock = createMock<T[K] extends (...args: unknown[]) => unknown ? T[K] : never>({
    name: String(method),
    implementation: original as (...args: unknown[]) => unknown,
  });

  obj[method] = mock as T[K];

  const originalRestore = mock.mockRestore;
  mock.mockRestore = () => {
    obj[method] = original;
    originalRestore();
  };

  return mock as T[K] & MockInstance;
}

/** Create a fixture */
export function createFixture<T>(
  name: string,
  data: T,
  options?: { setup?: () => Promise<void>; teardown?: () => Promise<void> },
): Fixture<T> {
  return {
    name,
    data,
    setup: options?.setup,
    teardown: options?.teardown,
  };
}

/** Create a factory function */
export function createFactory<T>(defaults: T): FactoryFunction<T> {
  return (overrides?: Partial<T>) => ({
    ...defaults,
    ...overrides,
  });
}

/** Generate test data using a factory */
export function generateMany<T>(factory: FactoryFunction<T>, count: number): T[] {
  return Array.from({ length: count }, () => factory());
}

/** Create a seeder */
export function createSeeder<T>(
  name: string,
  factory: FactoryFunction<T>,
  count: number,
  dependencies?: string[],
): Seeder<T> {
  return {
    name,
    count,
    factory,
    dependencies,
  };
}

/** Test user factory */
export const userFactory = createFactory({
  id: 'user_' + Date.now().toString(36),
  email: 'test@example.com',
  name: 'Test User',
  status: 'active' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
});

/** Test workspace factory */
export const workspaceFactory = createFactory({
  id: 'ws_' + Date.now().toString(36),
  name: 'Test Workspace',
  slug: 'test-workspace',
  description: 'A test workspace',
  visibility: 'private' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
});

/** Test channel factory */
export const channelFactory = createFactory({
  id: 'ch_' + Date.now().toString(36),
  name: 'general',
  slug: 'general',
  type: 'public' as const,
  description: 'General discussion',
  createdAt: new Date(),
  updatedAt: new Date(),
});

/** Test message factory */
export const messageFactory = createFactory({
  id: 'msg_' + Date.now().toString(36),
  content: 'Test message content',
  type: 'text' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
});

/** Test VP factory */
export const vpFactory = createFactory({
  id: 'vp_' + Date.now().toString(36),
  name: 'Test VP',
  slug: 'test-vp',
  title: 'VP of Testing',
  discipline: 'Engineering',
  status: 'active' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
});

/** Wait for a condition */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {},
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/** Wait for a specific duration */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Create an in-memory mock server */
export function createMockServer(baseUrl: string = 'http://localhost:3000'): MockServer {
  const routes: Map<string, MockResponse> = new Map();
  const requests: Array<{ method: string; path: string }> = [];
  let _isRunning = false;

  return {
    baseUrl,
    start: async () => {
      _isRunning = true;
    },
    stop: async () => {
      _isRunning = false;
    },
    reset: () => {
      routes.clear();
      requests.length = 0;
    },
    mock: (method: string, path: string, response: MockResponse) => {
      routes.set(`${method.toUpperCase()} ${path}`, response);
    },
    verify: () => {
      const matched = requests.filter((r) => routes.has(`${r.method} ${r.path}`)).length;
      const unmatched = requests.filter((r) => !routes.has(`${r.method} ${r.path}`));
      return {
        matched,
        unmatched: unmatched.length,
        unmatchedRequests: unmatched,
      };
    },
  };
}

/** Create an in-memory test database */
export function createTestDatabase(name: string): TestDatabase {
  const data: Map<string, unknown[]> = new Map();

  return {
    name,
    migrate: async () => {
      // Initialize tables
      data.set('users', []);
      data.set('workspaces', []);
      data.set('channels', []);
      data.set('messages', []);
      data.set('vps', []);
    },
    seed: async (seeders: Seeder[]) => {
      // Sort by dependencies
      const sorted = topologicalSort(seeders);
      for (const seeder of sorted) {
        const items = generateMany(seeder.factory, seeder.count);
        const existing = data.get(seeder.name) || [];
        data.set(seeder.name, [...existing, ...items]);
      }
    },
    truncate: async () => {
      for (const key of data.keys()) {
        data.set(key, []);
      }
    },
    drop: async () => {
      data.clear();
    },
  };
}

/** Topological sort for seeders based on dependencies */
function topologicalSort<T>(seeders: Seeder<T>[]): Seeder<T>[] {
  const result: Seeder<T>[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const seederMap = new Map(seeders.map((s) => [s.name, s]));

  function visit(seeder: Seeder<T>): void {
    if (visited.has(seeder.name)) {
return;
}
    if (visiting.has(seeder.name)) {
      throw new Error(`Circular dependency detected: ${seeder.name}`);
    }

    visiting.add(seeder.name);

    for (const dep of seeder.dependencies || []) {
      const depSeeder = seederMap.get(dep);
      if (depSeeder) {
        visit(depSeeder);
      }
    }

    visiting.delete(seeder.name);
    visited.add(seeder.name);
    result.push(seeder);
  }

  for (const seeder of seeders) {
    visit(seeder);
  }

  return result;
}

/** Assert helper */
export const assert = {
  equal: <T>(actual: T, expected: T, message?: string): void => {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, but got ${actual}`);
    }
  },

  deepEqual: <T>(actual: T, expected: T, message?: string): void => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(message || 'Objects are not deeply equal');
    }
  },

  truthy: (value: unknown, message?: string): void => {
    if (!value) {
      throw new Error(message || `Expected truthy value, but got ${value}`);
    }
  },

  falsy: (value: unknown, message?: string): void => {
    if (value) {
      throw new Error(message || `Expected falsy value, but got ${value}`);
    }
  },

  throws: (fn: () => unknown, message?: string): void => {
    let threw = false;
    try {
      fn();
    } catch {
      threw = true;
    }
    if (!threw) {
      throw new Error(message || 'Expected function to throw');
    }
  },

  rejects: async (fn: () => Promise<unknown>, message?: string): Promise<void> => {
    let threw = false;
    try {
      await fn();
    } catch {
      threw = true;
    }
    if (!threw) {
      throw new Error(message || 'Expected promise to reject');
    }
  },

  arrayContains: <T>(array: T[], item: T, message?: string): void => {
    if (!array.includes(item)) {
      throw new Error(message || `Array does not contain ${item}`);
    }
  },

  hasProperty: (obj: object, property: string, message?: string): void => {
    if (!(property in obj)) {
      throw new Error(message || `Object does not have property ${property}`);
    }
  },
};

/** Test context for setup/teardown */
export interface TestContext {
  mocks: Map<string, MockInstance>;
  fixtures: Map<string, Fixture>;
  cleanup: Array<() => Promise<void>>;
}

/** Create test context */
export function createTestContext(): TestContext {
  return {
    mocks: new Map(),
    fixtures: new Map(),
    cleanup: [],
  };
}

/** Cleanup test context */
export async function cleanupTestContext(context: TestContext): Promise<void> {
  // Run cleanup functions in reverse order
  for (const fn of context.cleanup.reverse()) {
    await fn();
  }

  // Clear mocks
  for (const mock of context.mocks.values()) {
    mock.mockRestore();
  }

  // Teardown fixtures
  for (const fixture of context.fixtures.values()) {
    await fixture.teardown?.();
  }

  context.mocks.clear();
  context.fixtures.clear();
  context.cleanup.length = 0;
}

/** Export types */
export type { Fixture, FactoryFunction, Seeder, TestDatabase, MockServer, MockResponse };
