/**
 * Base service class following the golden service pattern
 */
import { EventEmitter } from 'events';
import { AppError } from '../utils/errors';

export interface ServiceConfig {
  name: string;
  version: string;
  timeout?: number;
  retryAttempts?: number;
  enableLogging?: boolean;
}

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: AppError;
  metadata?: {
    executionTime: number;
    timestamp: Date;
    requestId: string;
  };
}

export interface ServiceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastActivity: Date;
}

export abstract class BaseService extends EventEmitter {
  protected readonly name: string;
  protected readonly metrics: ServiceMetrics;
  private readonly startTime: Date;
  private isInitialized = false;

  constructor(name: string) {
    super();
    this.name = name;
    this.startTime = new Date();
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastActivity: new Date(),
    };
  }

  /**
   * Initialize the service
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    this.log('info', `Initializing service ${this.name}`);
    await this.onInitialize();
    this.isInitialized = true;
    this.emit('initialized');
  }

  /**
   * Shutdown the service gracefully
   */
  public async shutdown(): Promise<void> {
    this.log('info', `Shutting down service ${this.name}`);
    await this.onShutdown();
    this.emit('shutdown');
  }

  /**
   * Get service health status
   */
  public async getHealth(): Promise<ServiceResult<{
    status: 'healthy' | 'unhealthy';
    uptime: number;
    metrics: ServiceMetrics;
  }>> {
    const uptime = Date.now() - this.startTime.getTime();
    const isHealthy = await this.checkHealth();
    
    return this.createSuccessResult({
      status: isHealthy ? 'healthy' : 'unhealthy',
      uptime,
      metrics: { ...this.metrics },
    });
  }

  /**
   * Execute operation with error handling and metrics
   */
  protected async executeOperation<T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<ServiceResult<T>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      this.metrics.totalRequests++;
      this.metrics.lastActivity = new Date();

      const result = await operation();
      
      const executionTime = Date.now() - startTime;
      this.updateMetrics(executionTime, true);

      return this.createSuccessResult(result, {
        executionTime,
        timestamp: new Date(),
        requestId,
      });
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateMetrics(executionTime, false);

      const appError = error instanceof AppError 
        ? error 
        : new AppError(
            error instanceof Error ? error.message : 'Unknown error',
            'INTERNAL_ERROR',
            500
          );

      this.log('error', `Operation ${operationName} failed`, {
        requestId,
        error: appError.message,
      });

      return this.createErrorResult(appError, {
        executionTime,
        timestamp: new Date(),
        requestId,
      });
    }
  }

  protected createSuccessResult<T>(
    data: T,
    metadata?: ServiceResult<T>['metadata']
  ): ServiceResult<T> {
    return {
      success: true,
      data,
      metadata,
    };
  }

  protected createErrorResult(
    error: AppError,
    metadata?: ServiceResult<any>['metadata']
  ): ServiceResult<any> {
    return {
      success: false,
      error,
      metadata,
    };
  }

  protected log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context?: Record<string, any>
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      service: this.name,
      level,
      message,
      ...context,
    };
    
    console.log(JSON.stringify(logEntry));
    this.emit('log', logEntry);
  }

  private generateRequestId(): string {
    return `${this.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateMetrics(executionTime: number, success: boolean): void {
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    const totalRequests = this.metrics.successfulRequests + this.metrics.failedRequests;
    this.metrics.averageResponseTime =
      (this.metrics.averageResponseTime * (totalRequests - 1) + executionTime) / totalRequests;
  }

  // Abstract methods that concrete services must implement
  protected abstract onInitialize(): Promise<void>;
  protected abstract onShutdown(): Promise<void>;
  protected abstract checkHealth(): Promise<boolean>;
}