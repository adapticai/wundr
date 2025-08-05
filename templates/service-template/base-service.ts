/**
 * Base Service Template
 * 
 * This is a foundational service class that provides common functionality
 * for all services in the monorepo. It includes error handling, logging,
 * validation, and standardized response patterns.
 * 
 * @template TConfig - Configuration type for the service
 * @template TData - Primary data type the service works with
 */

import { EventEmitter } from 'events';

// Core interfaces that services should implement
export interface ServiceConfig {
  readonly name: string;
  readonly version: string;
  readonly timeout?: number;
  readonly retryAttempts?: number;
  readonly enableLogging?: boolean;
}

export interface ServiceResult<T = any> {
  success: boolean;
  data?: T;
  error?: ServiceError;
  metadata?: {
    executionTime: number;
    timestamp: Date;
    requestId: string;
  };
}

export interface ServiceError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
}

export interface ServiceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastActivity: Date;
}

/**
 * Abstract base service class that provides common functionality
 * All services in the monorepo should extend this class
 */
export abstract class BaseService<TConfig extends ServiceConfig = ServiceConfig, TData = any> extends EventEmitter {
  protected readonly config: TConfig;
  protected readonly metrics: ServiceMetrics;
  private readonly startTime: Date;

  constructor(config: TConfig) {
    super();
    this.config = { ...config };
    this.startTime = new Date();
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastActivity: new Date(),
    };

    this.validateConfig(config);
    this.log('info', `Service ${config.name} v${config.version} initialized`);
  }

  /**
   * Initialize the service - called once during startup
   * Override this method to perform service-specific initialization
   */
  public async initialize(): Promise<void> {
    this.log('info', `Initializing service ${this.config.name}`);
    await this.onInitialize();
    this.emit('initialized');
  }

  /**
   * Shutdown the service gracefully
   * Override this method to perform service-specific cleanup
   */
  public async shutdown(): Promise<void> {
    this.log('info', `Shutting down service ${this.config.name}`);
    await this.onShutdown();
    this.emit('shutdown');
  }

  /**
   * Get service health status
   */
  public getHealth(): ServiceResult<{ status: 'healthy' | 'unhealthy'; uptime: number; metrics: ServiceMetrics }> {
    const uptime = Date.now() - this.startTime.getTime();
    const status = this.checkHealth() ? 'healthy' : 'unhealthy';

    return this.createSuccessResult({
      status,
      uptime,
      metrics: { ...this.metrics },
    });
  }

  /**
   * Get service configuration (sensitive data removed)
   */
  public getConfig(): Partial<TConfig> {
    const { ...safeConfig } = this.config;
    return safeConfig;
  }

  /**
   * Execute a service operation with built-in error handling and metrics
   */
  protected async executeOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    options: { timeout?: number; retryAttempts?: number } = {}
  ): Promise<ServiceResult<T>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      this.metrics.totalRequests++;
      this.metrics.lastActivity = new Date();

      this.log('debug', `Executing operation: ${operationName}`, { requestId });

      const timeout = options.timeout || this.config.timeout || 30000;
      const retryAttempts = options.retryAttempts || this.config.retryAttempts || 0;

      const result = await this.withTimeout(
        this.withRetry(operation, retryAttempts),
        timeout
      );

      const executionTime = Date.now() - startTime;
      this.updateMetrics(executionTime, true);

      this.log('debug', `Operation ${operationName} completed successfully`, {
        requestId,
        executionTime,
      });

      return this.createSuccessResult(result, {
        executionTime,
        timestamp: new Date(),
        requestId,
      });
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateMetrics(executionTime, false);

      const serviceError = this.normalizeError(error);
      this.log('error', `Operation ${operationName} failed`, {
        requestId,
        error: serviceError,
        executionTime,
      });

      return this.createErrorResult(serviceError, {
        executionTime,
        timestamp: new Date(),
        requestId,
      });
    }
  }

  /**
   * Validate input data against a schema or custom validator
   */
  protected validateInput<T>(data: any, validator: (data: any) => data is T): data is T {
    if (!validator(data)) {
      throw new Error(`Invalid input data for service ${this.config.name}`);
    }
    return true;
  }

  /**
   * Create a standardized success result
   */
  protected createSuccessResult<T>(data: T, metadata?: ServiceResult<T>['metadata']): ServiceResult<T> {
    return {
      success: true,
      data,
      metadata,
    };
  }

  /**
   * Create a standardized error result
   */
  protected createErrorResult(error: ServiceError, metadata?: ServiceResult['metadata']): ServiceResult {
    return {
      success: false,
      error,
      metadata,
    };
  }

  /**
   * Logging method with configurable levels
   */
  protected log(level: 'debug' | 'info' | 'warn' | 'error', message: string, context?: Record<string, any>): void {
    if (!this.config.enableLogging) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      service: this.config.name,
      level,
      message,
      ...context,
    };

    // In a real implementation, you'd use a proper logging library
    console.log(JSON.stringify(logEntry));
    this.emit('log', logEntry);
  }

  // Abstract methods that concrete services must implement
  protected abstract onInitialize(): Promise<void>;
  protected abstract onShutdown(): Promise<void>;
  protected abstract checkHealth(): boolean;

  // Private helper methods
  private validateConfig(config: TConfig): void {
    if (!config.name || !config.version) {
      throw new Error('Service name and version are required');
    }
  }

  private normalizeError(error: any): ServiceError {
    if (error instanceof Error) {
      return {
        code: error.name || 'UNKNOWN_ERROR',
        message: error.message,
        stack: error.stack,
      };
    }

    if (typeof error === 'string') {
      return {
        code: 'STRING_ERROR',
        message: error,
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred',
      details: error,
    };
  }

  private generateRequestId(): string {
    return `${this.config.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateMetrics(executionTime: number, success: boolean): void {
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // Update average response time
    const totalRequests = this.metrics.successfulRequests + this.metrics.failedRequests;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (totalRequests - 1) + executionTime) / totalRequests;
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  }

  private async withRetry<T>(operation: () => Promise<T>, maxAttempts: number): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
          this.log('warn', `Operation failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxAttempts + 1})`);
        }
      }
    }

    throw lastError;
  }
}

// Utility types for service implementations
export type ServiceMethod<TInput = any, TOutput = any> = (input: TInput) => Promise<ServiceResult<TOutput>>;

export interface ServiceDefinition {
  name: string;
  version: string;
  description?: string;
  dependencies?: string[];
  methods: Record<string, ServiceMethod>;
}

// Service registry interface for dependency injection
export interface ServiceRegistry {
  register<T extends BaseService>(name: string, service: T): void;
  get<T extends BaseService>(name: string): T | undefined;
  has(name: string): boolean;
  list(): string[];
}

/**
 * Example service registry implementation
 */
export class DefaultServiceRegistry implements ServiceRegistry {
  private services = new Map<string, BaseService>();

  register<T extends BaseService>(name: string, service: T): void {
    this.services.set(name, service);
  }

  get<T extends BaseService>(name: string): T | undefined {
    return this.services.get(name) as T;
  }

  has(name: string): boolean {
    return this.services.has(name);
  }

  list(): string[] {
    return Array.from(this.services.keys());
  }
}