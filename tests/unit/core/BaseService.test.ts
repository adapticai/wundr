/**
 * Comprehensive test suite for BaseService class
 * Tests service lifecycle, error handling, metrics tracking, and all protected methods
 */

import { BaseService, ServiceConfig, ServiceResult, ServiceMetrics } from '@/core/BaseService';
import { AppError, ValidationError, ConfigurationError } from '@/core/errors';
import * as fs from 'fs-extra';
import * as path from 'path';
import { EventEmitter } from 'events';

// Mock fs-extra module
jest.mock('fs-extra');
const mockFs = fs as jest.Mocked<typeof fs>;

// Concrete implementation of BaseService for testing
class TestService extends BaseService {
  private initializeCalled = false;
  private shutdownCalled = false;
  private healthStatus = true;
  private shouldFailInitialize = false;
  private shouldFailShutdown = false;

  constructor(config?: Partial<ServiceConfig>) {
    super('TestService', config);
  }

  // Test utilities
  setHealthStatus(status: boolean): void {
    this.healthStatus = status;
  }

  setShouldFailInitialize(fail: boolean): void {
    this.shouldFailInitialize = fail;
  }

  setShouldFailShutdown(fail: boolean): void {
    this.shouldFailShutdown = fail;
  }

  getInitializeCalled(): boolean {
    return this.initializeCalled;
  }

  getShutdownCalled(): boolean {
    return this.shutdownCalled;
  }

  // Access protected methods for testing
  public testExecuteOperation<T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<ServiceResult<T>> {
    return this.executeOperation(operationName, operation);
  }

  public testCreateSuccessResult<T>(
    data: T,
    metadata?: Partial<ServiceResult<T>['metadata']>
  ): ServiceResult<T> {
    return this.createSuccessResult(data, metadata);
  }

  public testCreateErrorResult(
    error: AppError,
    metadata?: Partial<ServiceResult<any>['metadata']>
  ): ServiceResult<any> {
    return this.createErrorResult(error, metadata);
  }

  public testLog(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context?: Record<string, any>
  ): void {
    this.log(level, message, context);
  }

  public testSaveOutput(filename: string, content: string): Promise<void> {
    return this.saveOutput(filename, content);
  }

  // Abstract method implementations
  protected async onInitialize(): Promise<void> {
    if (this.shouldFailInitialize) {
      throw new AppError('Initialize failed', 'INIT_ERROR', 500);
    }
    this.initializeCalled = true;
  }

  protected async onShutdown(): Promise<void> {
    if (this.shouldFailShutdown) {
      throw new AppError('Shutdown failed', 'SHUTDOWN_ERROR', 500);
    }
    this.shutdownCalled = true;
  }

  protected checkHealth(): boolean {
    return this.healthStatus;
  }
}

describe('BaseService', () => {
  let testService: TestService;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Reset fs mocks
    mockFs.ensureDir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    
    testService = new TestService();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Constructor and Configuration', () => {
    it('should create service with default configuration', () => {
      const service = new TestService();
      expect(service['name']).toBe('TestService');
      expect(service['config']).toEqual({
        name: 'TestService',
        version: '1.0.0',
        enableLogging: true
      });
    });

    it('should create service with custom configuration', () => {
      const customConfig: Partial<ServiceConfig> = {
        version: '2.0.0',
        outputDir: '/custom/output',
        enableLogging: false
      };
      
      const service = new TestService(customConfig);
      expect(service['config']).toEqual({
        name: 'TestService',
        version: '2.0.0',
        outputDir: '/custom/output',
        enableLogging: false
      });
    });

    it('should initialize metrics with default values', () => {
      const metrics = testService['metrics'];
      expect(metrics).toEqual({
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        averageExecutionTime: 0,
        lastActivity: expect.any(Date)
      });
    });

    it('should extend EventEmitter', () => {
      expect(testService).toBeInstanceOf(EventEmitter);
    });
  });

  describe('Service Lifecycle', () => {
    describe('initialize()', () => {
      it('should initialize service successfully', async () => {
        await testService.initialize();
        
        expect(testService.getInitializeCalled()).toBe(true);
        expect(testService['isInitialized']).toBe(true);
      });

      it('should create output directory if specified', async () => {
        const serviceWithOutput = new TestService({ outputDir: '/test/output' });
        await serviceWithOutput.initialize();
        
        expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/output');
      });

      it('should not recreate output directory if not specified', async () => {
        await testService.initialize();
        expect(mockFs.ensureDir).not.toHaveBeenCalled();
      });

      it('should emit initialized event', async () => {
        const eventSpy = jest.fn();
        testService.on('initialized', eventSpy);
        
        await testService.initialize();
        expect(eventSpy).toHaveBeenCalled();
      });

      it('should log initialization', async () => {
        await testService.initialize();
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('"service":"TestService"')
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('"level":"info"')
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('"message":"Initializing service TestService"')
        );
      });

      it('should not initialize twice', async () => {
        await testService.initialize();
        const firstInitCall = testService.getInitializeCalled();
        
        await testService.initialize();
        expect(testService.getInitializeCalled()).toBe(firstInitCall);
      });

      it('should handle initialization failure', async () => {
        testService.setShouldFailInitialize(true);
        
        await expect(testService.initialize()).rejects.toThrow('Initialize failed');
        expect(testService['isInitialized']).toBe(false);
      });
    });

    describe('shutdown()', () => {
      it('should shutdown service successfully', async () => {
        await testService.shutdown();
        expect(testService.getShutdownCalled()).toBe(true);
      });

      it('should emit shutdown event', async () => {
        const eventSpy = jest.fn();
        testService.on('shutdown', eventSpy);
        
        await testService.shutdown();
        expect(eventSpy).toHaveBeenCalled();
      });

      it('should log shutdown', async () => {
        await testService.shutdown();
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('"level":"info"')
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('"message":"Shutting down service TestService"')
        );
      });

      it('should handle shutdown failure', async () => {
        testService.setShouldFailShutdown(true);
        await expect(testService.shutdown()).rejects.toThrow('Shutdown failed');
      });
    });

    describe('getHealth()', () => {
      it('should return healthy status', () => {
        testService.setHealthStatus(true);
        const health = testService.getHealth();
        
        expect(health.success).toBe(true);
        expect(health.data?.status).toBe('healthy');
        expect(health.data?.uptime).toBeGreaterThanOrEqual(0);
        expect(health.data?.metrics).toEqual(testService['metrics']);
      });

      it('should return unhealthy status', () => {
        testService.setHealthStatus(false);
        const health = testService.getHealth();
        
        expect(health.success).toBe(true);
        expect(health.data?.status).toBe('unhealthy');
      });

      it('should calculate uptime correctly', async () => {
        const startTime = Date.now();
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const health = testService.getHealth();
        expect(health.data?.uptime).toBeGreaterThanOrEqual(10);
      });
    });
  });

  describe('Operation Execution', () => {
    describe('executeOperation()', () => {
      it('should execute successful operation', async () => {
        const testData = { message: 'success' };
        const operation = jest.fn().mockResolvedValue(testData);
        
        const result = await testService.testExecuteOperation('testOp', operation);
        
        expect(result.success).toBe(true);
        expect(result.data).toEqual(testData);
        expect(result.metadata?.executionTime).toBeGreaterThanOrEqual(0);
        expect(result.metadata?.timestamp).toBeInstanceOf(Date);
        expect(operation).toHaveBeenCalled();
      });

      it('should handle operation failure with AppError', async () => {
        const appError = new AppError('Test error', 'TEST_ERROR', 400);
        const operation = jest.fn().mockRejectedValue(appError);
        
        const result = await testService.testExecuteOperation('testOp', operation);
        
        expect(result.success).toBe(false);
        expect(result.error).toBe(appError);
        expect(result.metadata?.executionTime).toBeGreaterThanOrEqual(0);
        expect(result.metadata?.timestamp).toBeInstanceOf(Date);
      });

      it('should handle operation failure with generic Error', async () => {
        const genericError = new Error('Generic error');
        const operation = jest.fn().mockRejectedValue(genericError);
        
        const result = await testService.testExecuteOperation('testOp', operation);
        
        expect(result.success).toBe(false);
        expect(result.error).toBeInstanceOf(AppError);
        expect(result.error?.message).toBe('Generic error');
        expect(result.error?.code).toBe('INTERNAL_ERROR');
        expect(result.error?.statusCode).toBe(500);
      });

      it('should handle operation failure with unknown error', async () => {
        const unknownError = 'string error';
        const operation = jest.fn().mockRejectedValue(unknownError);
        
        const result = await testService.testExecuteOperation('testOp', operation);
        
        expect(result.success).toBe(false);
        expect(result.error).toBeInstanceOf(AppError);
        expect(result.error?.message).toBe('Unknown error');
        expect(result.error?.code).toBe('INTERNAL_ERROR');
      });

      it('should update metrics on successful operation', async () => {
        const operation = jest.fn().mockResolvedValue('success');
        
        await testService.testExecuteOperation('testOp', operation);
        
        const metrics = testService['metrics'];
        expect(metrics.totalOperations).toBe(1);
        expect(metrics.successfulOperations).toBe(1);
        expect(metrics.failedOperations).toBe(0);
        expect(metrics.averageExecutionTime).toBeGreaterThanOrEqual(0);
        expect(metrics.lastActivity).toBeInstanceOf(Date);
      });

      it('should update metrics on failed operation', async () => {
        const operation = jest.fn().mockRejectedValue(new Error('failure'));
        
        await testService.testExecuteOperation('testOp', operation);
        
        const metrics = testService['metrics'];
        expect(metrics.totalOperations).toBe(1);
        expect(metrics.successfulOperations).toBe(0);
        expect(metrics.failedOperations).toBe(1);
        expect(metrics.averageExecutionTime).toBeGreaterThanOrEqual(0);
      });

      it('should calculate average execution time correctly', async () => {
        // First operation
        const op1 = jest.fn().mockImplementation(() => 
          new Promise(resolve => setTimeout(() => resolve('result1'), 10))
        );
        await testService.testExecuteOperation('op1', op1);
        
        // Second operation
        const op2 = jest.fn().mockImplementation(() => 
          new Promise(resolve => setTimeout(() => resolve('result2'), 20))
        );
        await testService.testExecuteOperation('op2', op2);
        
        const metrics = testService['metrics'];
        expect(metrics.totalOperations).toBe(2);
        expect(metrics.successfulOperations).toBe(2);
        expect(metrics.averageExecutionTime).toBeGreaterThan(0);
      });

      it('should log operation failures', async () => {
        const operation = jest.fn().mockRejectedValue(new AppError('Test error', 'TEST_ERROR'));
        
        await testService.testExecuteOperation('failingOp', operation);
        
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('"level":"error"')
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('"message":"Operation failingOp failed"')
        );
      });
    });
  });

  describe('Result Creation', () => {
    describe('createSuccessResult()', () => {
      it('should create success result without metadata', () => {
        const data = { test: 'data' };
        const result = testService.testCreateSuccessResult(data);
        
        expect(result).toEqual({
          success: true,
          data,
          metadata: undefined
        });
      });

      it('should create success result with metadata', () => {
        const data = { test: 'data' };
        const metadata = { executionTime: 100, timestamp: new Date() };
        const result = testService.testCreateSuccessResult(data, metadata);
        
        expect(result).toEqual({
          success: true,
          data,
          metadata
        });
      });
    });

    describe('createErrorResult()', () => {
      it('should create error result without metadata', () => {
        const error = new AppError('Test error', 'TEST_ERROR');
        const result = testService.testCreateErrorResult(error);
        
        expect(result).toEqual({
          success: false,
          error,
          metadata: undefined
        });
      });

      it('should create error result with metadata', () => {
        const error = new AppError('Test error', 'TEST_ERROR');
        const metadata = { executionTime: 100, timestamp: new Date() };
        const result = testService.testCreateErrorResult(error, metadata);
        
        expect(result).toEqual({
          success: false,
          error,
          metadata
        });
      });
    });
  });

  describe('Logging', () => {
    it('should log debug messages', () => {
      testService.testLog('debug', 'Debug message', { context: 'test' });
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"level":"debug"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Debug message"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"context":"test"')
      );
    });

    it('should log info messages', () => {
      testService.testLog('info', 'Info message');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"level":"info"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Info message"')
      );
    });

    it('should log warning messages', () => {
      testService.testLog('warn', 'Warning message');
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should log error messages', () => {
      testService.testLog('error', 'Error message');
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should emit log events', () => {
      const logSpy = jest.fn();
      testService.on('log', logSpy);
      
      testService.testLog('info', 'Test message', { data: 'test' });
      
      expect(logSpy).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        service: 'TestService',
        level: 'info',
        message: 'Test message',
        data: 'test'
      });
    });

    it('should not log when logging is disabled', () => {
      const serviceWithoutLogging = new TestService({ enableLogging: false });
      serviceWithoutLogging.testLog('info', 'Should not log');
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should format log entries correctly', () => {
      const context = { userId: '123', operation: 'test' };
      testService.testLog('info', 'Test message', context);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"userId":"123"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"operation":"test"')
      );
    });
  });

  describe('File Operations', () => {
    describe('saveOutput()', () => {
      it('should save output to configured directory', async () => {
        const serviceWithOutput = new TestService({ outputDir: '/test/output' });
        const filename = 'test-file.txt';
        const content = 'test content';
        
        await serviceWithOutput.testSaveOutput(filename, content);
        
        expect(mockFs.writeFile).toHaveBeenCalledWith(
          path.join('/test/output', filename),
          content,
          'utf-8'
        );
      });

      it('should log successful save operation', async () => {
        const serviceWithOutput = new TestService({ outputDir: '/test/output' });
        const filename = 'test-file.txt';
        const content = 'test content';
        
        await serviceWithOutput.testSaveOutput(filename, content);
        
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('"message":"Saved output to /test/output/test-file.txt"')
        );
      });

      it('should throw error when output directory is not configured', async () => {
        const filename = 'test-file.txt';
        const content = 'test content';
        
        await expect(testService.testSaveOutput(filename, content))
          .rejects.toThrow('Output directory not configured');
      });

      it('should handle file system errors', async () => {
        const serviceWithOutput = new TestService({ outputDir: '/test/output' });
        const fsError = new Error('File system error');
        mockFs.writeFile.mockRejectedValue(fsError);
        
        await expect(serviceWithOutput.testSaveOutput('test.txt', 'content'))
          .rejects.toThrow('File system error');
      });
    });
  });

  describe('Metrics Tracking', () => {
    it('should track multiple successful operations', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      await testService.testExecuteOperation('op1', operation);
      await testService.testExecuteOperation('op2', operation);
      await testService.testExecuteOperation('op3', operation);
      
      const metrics = testService['metrics'];
      expect(metrics.totalOperations).toBe(3);
      expect(metrics.successfulOperations).toBe(3);
      expect(metrics.failedOperations).toBe(0);
    });

    it('should track mixed successful and failed operations', async () => {
      const successOp = jest.fn().mockResolvedValue('success');
      const failOp = jest.fn().mockRejectedValue(new Error('failure'));
      
      await testService.testExecuteOperation('success1', successOp);
      await testService.testExecuteOperation('fail1', failOp);
      await testService.testExecuteOperation('success2', successOp);
      await testService.testExecuteOperation('fail2', failOp);
      
      const metrics = testService['metrics'];
      expect(metrics.totalOperations).toBe(4);
      expect(metrics.successfulOperations).toBe(2);
      expect(metrics.failedOperations).toBe(2);
    });

    it('should update lastActivity on each operation', async () => {
      const initialActivity = testService['metrics'].lastActivity;
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const operation = jest.fn().mockResolvedValue('success');
      await testService.testExecuteOperation('op', operation);
      
      const newActivity = testService['metrics'].lastActivity;
      expect(newActivity.getTime()).toBeGreaterThan(initialActivity.getTime());
    });

    it('should include metrics in health check', () => {
      const health = testService.getHealth();
      expect(health.data?.metrics).toEqual(testService['metrics']);
      expect(health.data?.metrics).toMatchObject({
        totalOperations: expect.any(Number),
        successfulOperations: expect.any(Number),
        failedOperations: expect.any(Number),
        averageExecutionTime: expect.any(Number),
        lastActivity: expect.any(Date)
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle and convert non-AppError instances', async () => {
      const genericError = new Error('Generic error message');
      const operation = jest.fn().mockRejectedValue(genericError);
      
      const result = await testService.testExecuteOperation('test', operation);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(AppError);
      expect(result.error?.message).toBe('Generic error message');
      expect(result.error?.code).toBe('INTERNAL_ERROR');
      expect(result.error?.statusCode).toBe(500);
    });

    it('should preserve AppError instances', async () => {
      const appError = new ValidationError('Validation failed', ['field1']);
      const operation = jest.fn().mockRejectedValue(appError);
      
      const result = await testService.testExecuteOperation('test', operation);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe(appError);
      expect(result.error).toBeInstanceOf(ValidationError);
    });

    it('should handle string errors', async () => {
      const stringError = 'String error message';
      const operation = jest.fn().mockRejectedValue(stringError);
      
      const result = await testService.testExecuteOperation('test', operation);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(AppError);
      expect(result.error?.message).toBe('Unknown error');
    });

    it('should handle null/undefined errors', async () => {
      const nullError = null;
      const operation = jest.fn().mockRejectedValue(nullError);
      
      const result = await testService.testExecuteOperation('test', operation);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Unknown error');
    });
  });

  describe('Event Emission', () => {
    it('should emit initialization event', async () => {
      const eventSpy = jest.fn();
      testService.on('initialized', eventSpy);
      
      await testService.initialize();
      expect(eventSpy).toHaveBeenCalledTimes(1);
    });

    it('should emit shutdown event', async () => {
      const eventSpy = jest.fn();
      testService.on('shutdown', eventSpy);
      
      await testService.shutdown();
      expect(eventSpy).toHaveBeenCalledTimes(1);
    });

    it('should emit log events with proper data', () => {
      const logSpy = jest.fn();
      testService.on('log', logSpy);
      
      const context = { test: 'data' };
      testService.testLog('warn', 'Warning message', context);
      
      expect(logSpy).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        service: 'TestService',
        level: 'warn',
        message: 'Warning message',
        test: 'data'
      });
    });

    it('should support multiple event listeners', async () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      testService.on('initialized', listener1);
      testService.on('initialized', listener2);
      
      await testService.initialize();
      
      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete service lifecycle', async () => {
      // Initialize
      await testService.initialize();
      expect(testService.getInitializeCalled()).toBe(true);
      
      // Execute operations
      const op1 = jest.fn().mockResolvedValue('result1');
      const result1 = await testService.testExecuteOperation('op1', op1);
      expect(result1.success).toBe(true);
      
      // Check health
      const health = testService.getHealth();
      expect(health.data?.status).toBe('healthy');
      expect(health.data?.metrics.totalOperations).toBe(1);
      
      // Shutdown
      await testService.shutdown();
      expect(testService.getShutdownCalled()).toBe(true);
    });

    it('should maintain state consistency across operations', async () => {
      const operations = [
        jest.fn().mockResolvedValue('success1'),
        jest.fn().mockRejectedValue(new Error('failure1')),
        jest.fn().mockResolvedValue('success2'),
        jest.fn().mockResolvedValue('success3')
      ];
      
      for (let i = 0; i < operations.length; i++) {
        await testService.testExecuteOperation(`op${i + 1}`, operations[i]);
      }
      
      const metrics = testService['metrics'];
      expect(metrics.totalOperations).toBe(4);
      expect(metrics.successfulOperations).toBe(3);
      expect(metrics.failedOperations).toBe(1);
      expect(metrics.averageExecutionTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle concurrent operations correctly', async () => {
      const operations = Array.from({ length: 10 }, (_, i) => 
        jest.fn().mockImplementation(() => 
          new Promise(resolve => 
            setTimeout(() => resolve(`result${i}`), Math.random() * 10)
          )
        )
      );
      
      const promises = operations.map((op, i) => 
        testService.testExecuteOperation(`concurrent_op_${i}`, op)
      );
      
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
      
      const metrics = testService['metrics'];
      expect(metrics.totalOperations).toBe(10);
      expect(metrics.successfulOperations).toBe(10);
      expect(metrics.failedOperations).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long operation names', async () => {
      const longName = 'a'.repeat(1000);
      const operation = jest.fn().mockResolvedValue('success');
      
      const result = await testService.testExecuteOperation(longName, operation);
      expect(result.success).toBe(true);
    });

    it('should handle operations that return undefined', async () => {
      const operation = jest.fn().mockResolvedValue(undefined);
      
      const result = await testService.testExecuteOperation('undefined_op', operation);
      expect(result.success).toBe(true);
      expect(result.data).toBeUndefined();
    });

    it('should handle operations that return null', async () => {
      const operation = jest.fn().mockResolvedValue(null);
      
      const result = await testService.testExecuteOperation('null_op', operation);
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('should handle very complex error objects', async () => {
      const complexError = new AppError('Complex error', 'COMPLEX_ERROR', 418);
      complexError.stack = 'Very long stack trace...';
      const operation = jest.fn().mockRejectedValue(complexError);
      
      const result = await testService.testExecuteOperation('complex_error_op', operation);
      expect(result.success).toBe(false);
      expect(result.error).toBe(complexError);
    });

    it('should handle service without output directory trying to save', async () => {
      await expect(testService.testSaveOutput('test.txt', 'content'))
        .rejects.toThrow('Output directory not configured');
    });
  });
});