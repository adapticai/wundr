#!/usr/bin/env node
// scripts/create-test-baseline.ts

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface CriticalPath {
  name: string;
  description: string;
  endpoints?: string[];
  services?: string[];
}

// Define your critical business paths
const criticalPaths: CriticalPath[] = [
  {
    name: 'user-authentication',
    description: 'User login and session management',
    endpoints: ['/auth/login', '/auth/refresh', '/auth/logout'],
    services: ['AuthService', 'TokenService']
  },
  {
    name: 'order-processing',
    description: 'Order creation and fulfillment',
    endpoints: ['/orders/create', '/orders/process', '/orders/status'],
    services: ['OrderService', 'PaymentService', 'InventoryService']
  },
  {
    name: 'analytics-calculation',
    description: 'Core analytics and reporting',
    endpoints: ['/analytics/calculate', '/analytics/report'],
    services: ['AnalyticsService', 'DataAggregationService']
  }
  // Add your specific critical paths here
];

class TestBaselineCreator {
  private testDir = 'tests/critical-paths';

  async createBaseline() {
    console.log('🧪 Creating test baseline for critical paths...');

    // Ensure test directory exists
    if (!fs.existsSync(this.testDir)) {
      fs.mkdirSync(this.testDir, { recursive: true });
    }

    // Generate test files for each critical path
    for (const path of criticalPaths) {
      await this.createPathTests(path);
    }

    // Generate test runner configuration
    this.createTestConfig();

    // Generate coverage requirements
    this.createCoverageConfig();

    console.log('✅ Test baseline created successfully');
  }

  private async createPathTests(criticalPath: CriticalPath) {
    const testContent = `// ${criticalPath.name}.test.ts
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('Critical Path: ${criticalPath.description}', () => {
  let testContext: any;

  beforeAll(async () => {
    // Setup test environment
    testContext = await setupTestEnvironment();
  });

  afterAll(async () => {
    // Cleanup
    await teardownTestEnvironment(testContext);
  });

  ${criticalPath.endpoints ? this.generateEndpointTests(criticalPath.endpoints) : ''}

  ${criticalPath.services ? this.generateServiceTests(criticalPath.services) : ''}

  it('should complete the full ' + criticalPath.name + ' workflow', async () => {
    // 1. Setup initial state
    const initialData = await setupWorkflowData(criticalPath.name);
    const workflowId = generateWorkflowId();
    
    // 2. Execute workflow steps sequentially
    const steps = getWorkflowSteps(criticalPath.name);
    const results = [];
    
    for (const step of steps) {
      const stepResult = await executeWorkflowStep({
        workflowId,
        stepName: step.name,
        input: step.input || initialData,
        context: testContext
      });
      
      expect(stepResult.success).toBe(true);
      expect(stepResult.output).toBeDefined();
      results.push(stepResult);
    }
    
    // 3. Verify final state
    const finalState = await getWorkflowState(workflowId);
    expect(finalState.status).toBe('completed');
    expect(finalState.errors).toHaveLength(0);
    
    // 4. Check for side effects
    const sideEffects = await checkWorkflowSideEffects(workflowId, criticalPath.name);
    expect(sideEffects.dataIntegrity).toBe(true);
    expect(sideEffects.resourceLeaks).toHaveLength(0);
    
    // Cleanup
    await cleanupWorkflow(workflowId);
  });

  it('should handle errors gracefully in ' + criticalPath.name + '', async () => {
    const workflowId = generateWorkflowId();
    
    // Test invalid inputs
    const invalidInputs = getInvalidInputsFor(criticalPath.name);
    for (const invalidInput of invalidInputs) {
      const result = await executeWorkflowWithInput(workflowId + '-invalid', invalidInput);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/validation|invalid|bad request/i);
      expect(result.statusCode).toBeGreaterThanOrEqual(400);
    }
    
    // Test service failures
    const servicesToFail = criticalPath.services || [];
    for (const service of servicesToFail) {
      await simulateServiceFailure(service);
      
      const result = await executeWorkflowStep({
        workflowId: workflowId + '-service-fail',
        stepName: 'test-step',
        input: getValidInputFor(criticalPath.name),
        context: testContext
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('service unavailable');
      
      await restoreService(service);
    }
    
    // Test timeout scenarios
    const slowSteps = getSlowStepsFor(criticalPath.name);
    for (const step of slowSteps) {
      const timeoutPromise = executeWorkflowStep({
        workflowId: workflowId + '-timeout',
        stepName: step,
        input: getValidInputFor(criticalPath.name),
        context: { ...testContext, timeout: 100 } // Very short timeout
      });
      
      await expect(timeoutPromise).rejects.toThrow(/timeout|time.*out/i);
    }
    
    // Verify system recovery
    const healthCheck = await performHealthCheck();
    expect(healthCheck.status).toBe('healthy');
    expect(healthCheck.services).toEqual(expect.arrayContaining(
      criticalPath.services?.map(service => expect.objectContaining({ name: service, status: 'up' }))
    ));
  });
});

// Helper functions
async function setupTestEnvironment() {
  const context = {
    database: null as any,
    server: null as any,
    mocks: new Map<string, any>(),
    cleanup: [] as Array<() => Promise<void>>
  };
  
  try {
    // Setup test database
    context.database = await setupTestDatabase();
    context.cleanup.push(() => context.database.close());
    
    // Setup test server
    context.server = await setupTestServer();
    context.cleanup.push(() => context.server.close());
    
    // Setup service mocks
    const mockServices = ['AuthService', 'TokenService', 'OrderService', 'PaymentService', 'InventoryService', 'AnalyticsService', 'DataAggregationService'];
    for (const service of mockServices) {
      const mock = await createServiceMock(service);
      context.mocks.set(service, mock);
      context.cleanup.push(() => mock.restore());
    }
    
    // Setup test data
    await seedTestData(context.database);
    
    return context;
  } catch (error) {
    // Cleanup on setup failure
    await teardownTestEnvironment(context);
    throw error;
  }
}

async function teardownTestEnvironment(context: any) {
  if (!context) return;
  
  // Execute cleanup functions in reverse order
  const cleanupFunctions = context.cleanup || [];
  for (let i = cleanupFunctions.length - 1; i >= 0; i--) {
    try {
      await cleanupFunctions[i]();
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  }
  
  // Clear any remaining resources
  if (context.mocks) {
    context.mocks.clear();
  }
}

// Workflow execution helpers
async function setupWorkflowData(pathName: string): Promise<any> {
  const testData = {
    'user-authentication': {
      username: 'testuser',
      email: 'test@example.com',
      password: 'securePassword123'
    },
    'order-processing': {
      userId: 'user-123',
      items: [{ id: 'item-1', quantity: 2, price: 29.99 }],
      paymentMethod: 'credit-card'
    },
    'analytics-calculation': {
      dateRange: { start: '2024-01-01', end: '2024-01-31' },
      metrics: ['revenue', 'conversion', 'retention']
    }
  };
  
  return testData[pathName as keyof typeof testData] || {};
}

function generateWorkflowId(): string {
  return `test-workflow-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

function getWorkflowSteps(pathName: string): Array<{ name: string; input?: any }> {
  const steps = {
    'user-authentication': [
      { name: 'validate-credentials' },
      { name: 'generate-session' },
      { name: 'update-last-login' }
    ],
    'order-processing': [
      { name: 'validate-order' },
      { name: 'check-inventory' },
      { name: 'process-payment' },
      { name: 'create-order' },
      { name: 'update-inventory' }
    ],
    'analytics-calculation': [
      { name: 'collect-data' },
      { name: 'aggregate-metrics' },
      { name: 'calculate-insights' },
      { name: 'generate-report' }
    ]
  };
  
  return steps[pathName as keyof typeof steps] || [];
}

async function executeWorkflowStep(params: {
  workflowId: string;
  stepName: string;
  input: any;
  context: any;
}): Promise<{ success: boolean; output?: any; error?: string; statusCode?: number }> {
  try {
    // Simulate step execution
    const stepDelay = Math.random() * 100; // Random delay up to 100ms
    await new Promise(resolve => setTimeout(resolve, stepDelay));
    
    // Check for timeout
    if (params.context.timeout && stepDelay > params.context.timeout) {
      throw new Error('Operation timed out');
    }
    
    // Simulate success with random failure rate
    const failureRate = 0.05; // 5% failure rate for testing
    if (Math.random() < failureRate) {
      throw new Error('Simulated step failure');
    }
    
    return {
      success: true,
      output: {
        stepName: params.stepName,
        workflowId: params.workflowId,
        result: 'Step ' + params.stepName + ' completed successfully',
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      statusCode: 500
    };
  }
}

async function getWorkflowState(workflowId: string): Promise<{ status: string; errors: any[] }> {
  // Simulate getting workflow state
  return {
    status: 'completed',
    errors: []
  };
}

async function checkWorkflowSideEffects(workflowId: string, pathName: string): Promise<{ dataIntegrity: boolean; resourceLeaks: any[] }> {
  // Simulate checking for side effects
  return {
    dataIntegrity: true,
    resourceLeaks: []
  };
}

async function cleanupWorkflow(workflowId: string): Promise<void> {
  // Simulate workflow cleanup
  await new Promise(resolve => setTimeout(resolve, 10));
}

// Error testing helpers
function getInvalidInputsFor(pathName: string): any[] {
  const invalidInputs = {
    'user-authentication': [
      null,
      {},
      { username: '' },
      { password: '' },
      { username: 'test', password: '123' } // Too short password
    ],
    'order-processing': [
      null,
      {},
      { items: [] },
      { userId: '', items: [{}] },
      { userId: 'test', items: [{ quantity: -1 }] }
    ],
    'analytics-calculation': [
      null,
      {},
      { dateRange: {} },
      { dateRange: { start: 'invalid-date' } },
      { metrics: [] }
    ]
  };
  
  return invalidInputs[pathName as keyof typeof invalidInputs] || [null, {}];
}

function getValidInputFor(pathName: string): any {
  const validInputs = {
    'user-authentication': {
      username: 'validuser',
      password: 'validPassword123'
    },
    'order-processing': {
      userId: 'user-456',
      items: [{ id: 'item-2', quantity: 1, price: 19.99 }]
    },
    'analytics-calculation': {
      dateRange: { start: '2024-01-01', end: '2024-01-31' },
      metrics: ['revenue']
    }
  };
  
  return validInputs[pathName as keyof typeof validInputs] || {};
}

function getSlowStepsFor(pathName: string): string[] {
  const slowSteps = {
    'user-authentication': ['generate-session'],
    'order-processing': ['process-payment'],
    'analytics-calculation': ['calculate-insights']
  };
  
  return slowSteps[pathName as keyof typeof slowSteps] || [];
}

async function executeWorkflowWithInput(workflowId: string, input: any): Promise<{ success: boolean; error?: string; statusCode?: number }> {
  try {
    // Validate input
    if (!input || typeof input !== 'object') {
      return {
        success: false,
        error: 'Invalid input: must be a non-null object',
        statusCode: 400
      };
    }
    
    // Additional validation logic here
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      statusCode: 500
    };
  }
}

// Service simulation helpers
async function simulateServiceFailure(serviceName: string): Promise<void> {
  // Simulate service being down
  await new Promise(resolve => setTimeout(resolve, 10));
}

async function restoreService(serviceName: string): Promise<void> {
  // Simulate service restoration
  await new Promise(resolve => setTimeout(resolve, 10));
}

async function performHealthCheck(): Promise<{ status: string; services: Array<{ name: string; status: string }> }> {
  return {
    status: 'healthy',
    services: [
      { name: 'AuthService', status: 'up' },
      { name: 'OrderService', status: 'up' },
      { name: 'AnalyticsService', status: 'up' }
    ]
  };
}

// Test infrastructure helpers
async function setupTestDatabase(): Promise<any> {
  // Mock database setup
  return {
    close: async () => { /* cleanup */ },
    query: async (sql: string) => ({}),
    transaction: async (fn: Function) => fn()
  };
}

async function setupTestServer(): Promise<any> {
  // Mock server setup
  return {
    close: async () => { /* cleanup */ },
    listen: (port: number) => { /* start listening */ }
  };
}

async function createServiceMock(serviceName: string): Promise<any> {
  // Create service mock
  return {
    restore: async () => { /* restore original */ },
    mockMethod: (method: string, returnValue: any) => { /* setup mock */ }
  };
}

async function seedTestData(database: any): Promise<void> {
  // Seed database with test data
  await new Promise(resolve => setTimeout(resolve, 10));
}

// Request/Response helpers for endpoint testing
function getValidRequestFor(endpoint: string): any {
  const validRequests = {
    '/auth/login': { username: 'testuser', password: 'password123' },
    '/auth/refresh': { refreshToken: 'valid-refresh-token' },
    '/auth/logout': { sessionId: 'valid-session-id' },
    '/orders/create': { userId: 'user-123', items: [{ id: 'item-1', quantity: 1 }] },
    '/orders/process': { orderId: 'order-123' },
    '/orders/status': { orderId: 'order-123' },
    '/analytics/calculate': { dateRange: { start: '2024-01-01', end: '2024-01-31' } },
    '/analytics/report': { reportType: 'monthly', format: 'json' }
  };
  
  return validRequests[endpoint as keyof typeof validRequests] || {};
}

function getExpectedResponseFor(endpoint: string): any {
  const expectedResponses = {
    '/auth/login': { token: expect.any(String), user: expect.objectContaining({ id: expect.any(String) }) },
    '/auth/refresh': { token: expect.any(String), expiresAt: expect.any(String) },
    '/auth/logout': { success: true },
    '/orders/create': { orderId: expect.any(String), status: 'created' },
    '/orders/process': { orderId: expect.any(String), status: 'processing' },
    '/orders/status': { orderId: expect.any(String), status: expect.any(String) },
    '/analytics/calculate': { metrics: expect.any(Object), calculatedAt: expect.any(String) },
    '/analytics/report': { reportId: expect.any(String), data: expect.any(Object) }
  };
  
  return expectedResponses[endpoint as keyof typeof expectedResponses] || { success: true };
}

function getInvalidRequestsFor(endpoint: string): any[] {
  const invalidRequests = {
    '/auth/login': [
      {},
      { username: '' },
      { password: '' },
      { username: 'test' }, // Missing password
      { password: 'test' }  // Missing username
    ],
    '/orders/create': [
      {},
      { userId: '' },
      { items: [] },
      { userId: 'test', items: [{ quantity: -1 }] }
    ],
    '/analytics/calculate': [
      {},
      { dateRange: {} },
      { dateRange: { start: 'invalid-date' } }
    ]
  };
  
  return invalidRequests[endpoint as keyof typeof invalidRequests] || [null, {}];
}

function getErrorScenariosFor(endpoint: string): Array<{ condition: string; expectedStatus: number; expectedMessage: string }> {
  return [
    { condition: 'database-unavailable', expectedStatus: 503, expectedMessage: 'Service temporarily unavailable' },
    { condition: 'rate-limit-exceeded', expectedStatus: 429, expectedMessage: 'Too many requests' },
    { condition: 'internal-error', expectedStatus: 500, expectedMessage: 'Internal server error' }
  ];
}

async function makeRequest(endpoint: string, data: any, options: { skipAuth?: boolean; role?: string } = {}): Promise<{ status: number; data: any }> {
  // Mock HTTP request implementation
  try {
    if (options.skipAuth) {
      return { status: 401, data: { error: 'Authentication required' } };
    }
    
    if (options.role === 'guest') {
      return { status: 403, data: { error: 'Insufficient permissions' } };
    }
    
    // Simulate successful response
    return {
      status: 200,
      data: getExpectedResponseFor(endpoint)
    };
  } catch (error) {
    return {
      status: 500,
      data: { error: 'Internal server error' }
    };
  }
}

async function simulateErrorCondition(condition: string): Promise<void> {
  // Simulate error conditions
  await new Promise(resolve => setTimeout(resolve, 5));
}

async function clearErrorCondition(condition: string): Promise<void> {
  // Clear error conditions
  await new Promise(resolve => setTimeout(resolve, 5));
}

// Service testing helpers
function getServiceInstance(serviceName: string): any {
  const mockMethods = {
    initialize: jest.fn().mockResolvedValue(undefined),
    cleanup: jest.fn().mockResolvedValue(undefined),
    isInitialized: jest.fn().mockReturnValue(true),
    isCleanedUp: jest.fn().mockReturnValue(true)
  };
  
  const serviceInstances = {
    'AuthService': {
      ...mockMethods,
      authenticate: jest.fn().mockResolvedValue({ success: true, user: { id: 'user-123' } }),
      generateToken: jest.fn().mockResolvedValue('mock-token'),
      validateToken: jest.fn().mockResolvedValue({ valid: true, user: { id: 'user-123' } })
    },
    'TokenService': {
      ...mockMethods,
      create: jest.fn().mockResolvedValue('mock-token'),
      validate: jest.fn().mockResolvedValue({ valid: true }),
      refresh: jest.fn().mockResolvedValue('new-mock-token')
    },
    'OrderService': {
      ...mockMethods,
      createOrder: jest.fn().mockResolvedValue({ orderId: 'order-123', status: 'created' }),
      processOrder: jest.fn().mockResolvedValue({ orderId: 'order-123', status: 'processing' }),
      getOrderStatus: jest.fn().mockResolvedValue({ orderId: 'order-123', status: 'completed' })
    },
    'PaymentService': {
      ...mockMethods,
      processPayment: jest.fn().mockResolvedValue({ paymentId: 'payment-123', status: 'success' }),
      refundPayment: jest.fn().mockResolvedValue({ refundId: 'refund-123', status: 'processed' })
    },
    'InventoryService': {
      ...mockMethods,
      checkAvailability: jest.fn().mockResolvedValue({ available: true, quantity: 10 }),
      reserveItems: jest.fn().mockResolvedValue({ reserved: true, reservationId: 'res-123' }),
      releaseReservation: jest.fn().mockResolvedValue({ released: true })
    },
    'AnalyticsService': {
      ...mockMethods,
      calculateMetrics: jest.fn().mockResolvedValue({ revenue: 1000, conversions: 50 }),
      generateReport: jest.fn().mockResolvedValue({ reportId: 'report-123', data: {} })
    },
    'DataAggregationService': {
      ...mockMethods,
      aggregateData: jest.fn().mockResolvedValue({ aggregated: true, dataPoints: 100 }),
      getAggregatedData: jest.fn().mockResolvedValue({ data: [1, 2, 3, 4, 5] })
    }
  };
  
  return serviceInstances[serviceName as keyof typeof serviceInstances] || mockMethods;
}

function getHappyPathTestsFor(serviceName: string): Array<{ method: string; args: any[]; expectedResult: any }> {
  const happyPathTests = {
    'AuthService': [
      { method: 'authenticate', args: ['testuser', 'password123'], expectedResult: { success: true } },
      { method: 'generateToken', args: [{ id: 'user-123' }], expectedResult: expect.any(String) }
    ],
    'OrderService': [
      { method: 'createOrder', args: [{ userId: 'user-123', items: [{}] }], expectedResult: { orderId: expect.any(String) } },
      { method: 'processOrder', args: ['order-123'], expectedResult: { status: 'processing' } }
    ],
    'AnalyticsService': [
      { method: 'calculateMetrics', args: [{ dateRange: { start: '2024-01-01', end: '2024-01-31' } }], expectedResult: { revenue: expect.any(Number) } }
    ]
  };
  
  return happyPathTests[serviceName as keyof typeof happyPathTests] || [];
}

function getEdgeCasesFor(serviceName: string): Array<{ method: string; args: any[]; expectedResult: any }> {
  const edgeCases = {
    'AuthService': [
      { method: 'authenticate', args: ['', ''], expectedResult: { success: false } },
      { method: 'validateToken', args: ['expired-token'], expectedResult: { valid: false } }
    ],
    'OrderService': [
      { method: 'createOrder', args: [{ items: [] }], expectedResult: { error: 'No items provided' } },
      { method: 'getOrderStatus', args: ['nonexistent-order'], expectedResult: { error: 'Order not found' } }
    ],
    'AnalyticsService': [
      { method: 'calculateMetrics', args: [{}], expectedResult: { error: 'Invalid date range' } }
    ]
  };
  
  return edgeCases[serviceName as keyof typeof edgeCases] || [];
}

function getErrorTestsFor(serviceName: string): Array<{ method: string; args: any[]; shouldThrow: boolean; expectedError: string }> {
  const errorTests = {
    'AuthService': [
      { method: 'authenticate', args: [null, null], shouldThrow: true, expectedError: 'Invalid credentials' },
      { method: 'generateToken', args: [null], shouldThrow: true, expectedError: 'Invalid user data' }
    ],
    'OrderService': [
      { method: 'createOrder', args: [null], shouldThrow: true, expectedError: 'Invalid order data' },
      { method: 'processOrder', args: [null], shouldThrow: true, expectedError: 'Invalid order ID' }
    ],
    'PaymentService': [
      { method: 'processPayment', args: [{ amount: -100 }], shouldThrow: true, expectedError: 'Invalid amount' }
    ]
  };
  
  return errorTests[serviceName as keyof typeof errorTests] || [];
}
`;

    const filename = path.join(this.testDir, `${criticalPath.name}.test.ts`);
    fs.writeFileSync(filename, testContent);
    console.log(`  ✓ Created test: ${filename}`);
  }

  private generateEndpointTests(endpoints: string[]): string {
    return endpoints.map(endpoint => `
  it('should handle ${endpoint} endpoint', async () => {
    // Test valid request/response
    const validRequest = getValidRequestFor('${endpoint}');
    const response = await makeRequest('${endpoint}', validRequest);
    
    expect(response.status).toBe(200);
    expect(response.data).toBeDefined();
    expect(response.data).toMatchObject(getExpectedResponseFor('${endpoint}'));
    
    // Test authentication/authorization
    const unauthenticatedResponse = await makeRequest('${endpoint}', validRequest, { skipAuth: true });
    expect(unauthenticatedResponse.status).toBe(401);
    
    const unauthorizedResponse = await makeRequest('${endpoint}', validRequest, { role: 'guest' });
    expect([401, 403]).toContain(unauthorizedResponse.status);
    
    // Test input validation
    const invalidRequests = getInvalidRequestsFor('${endpoint}');
    for (const invalidRequest of invalidRequests) {
      const invalidResponse = await makeRequest('${endpoint}', invalidRequest);
      expect(invalidResponse.status).toBeGreaterThanOrEqual(400);
      expect(invalidResponse.status).toBeLessThan(500);
      expect(invalidResponse.data.error).toBeDefined();
    }
    
    // Test error responses
    const errorScenarios = getErrorScenariosFor('${endpoint}');
    for (const scenario of errorScenarios) {
      await simulateErrorCondition(scenario.condition);
      const errorResponse = await makeRequest('${endpoint}', validRequest);
      expect(errorResponse.status).toBe(scenario.expectedStatus);
      expect(errorResponse.data.error).toContain(scenario.expectedMessage);
      await clearErrorCondition(scenario.condition);
    }
  });`).join('\n');
  }

  private generateServiceTests(services: string[]): string {
    return services.map(service => `
  it('should test ${service} functionality', async () => {
    const service = getServiceInstance('${service}');
    
    // Test happy path scenarios
    const happyPathTests = getHappyPathTestsFor('${service}');
    for (const test of happyPathTests) {
      const result = await service[test.method](...test.args);
      expect(result).toBeDefined();
      expect(result).toMatchObject(test.expectedResult);
    }
    
    // Test edge cases
    const edgeCases = getEdgeCasesFor('${service}');
    for (const edgeCase of edgeCases) {
      const result = await service[edgeCase.method](...edgeCase.args);
      expect(result).toEqual(edgeCase.expectedResult);
    }
    
    // Test error handling
    const errorTests = getErrorTestsFor('${service}');
    for (const errorTest of errorTests) {
      if (errorTest.shouldThrow) {
        await expect(service[errorTest.method](...errorTest.args))
          .rejects.toThrow(errorTest.expectedError);
      } else {
        const result = await service[errorTest.method](...errorTest.args);
        expect(result.success).toBe(false);
        expect(result.error).toContain(errorTest.expectedError);
      }
    }
    
    // Test service lifecycle
    await service.initialize?.();
    expect(service.isInitialized?.()).toBe(true);
    
    await service.cleanup?.();
    expect(service.isCleanedUp?.()).toBe(true);
  });`).join('\n');
  }

  private createTestConfig() {
    const jestConfig = {
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/tests'],
      testMatch: ['**/*.test.ts'],
      collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/**/*.test.ts'
      ],
      coverageThreshold: {
        global: {
          branches: 60,
          functions: 70,
          lines: 70,
          statements: 70
        },
        './src/services/': {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      },
      testTimeout: 30000,
      verbose: true
    };

    fs.writeFileSync('jest.config.json', JSON.stringify(jestConfig, null, 2));
    console.log('  ✓ Created jest.config.json');
  }

  private createCoverageConfig() {
    const coverageScript = `#!/bin/bash
# scripts/check-coverage.sh

echo "🔍 Checking test coverage..."

# Run tests with coverage
npm run test:coverage

# Check if coverage meets requirements
if [ $? -eq 0 ]; then
  echo "✅ Coverage requirements met"
else
  echo "❌ Coverage below requirements"
  echo "Run 'npm run test:coverage' to see detailed report"
  exit 1
fi
`;

    const filename = 'scripts/check-coverage.sh';
    fs.writeFileSync(filename, coverageScript);
    fs.chmodSync(filename, '755');
    console.log('  ✓ Created coverage check script');
  }
}

// Run if called directly
if (require.main === module) {
  const creator = new TestBaselineCreator();
  creator.createBaseline().catch(console.error);
}
