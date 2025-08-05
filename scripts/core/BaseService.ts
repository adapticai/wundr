/**
 * Base service class for all Wundr services
 */
import { EventEmitter } from 'events';
import { AppError } from './errors';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface ServiceConfig {
  name: string;
  version: string;
  outputDir?: string;
  enableLogging?: boolean;
}

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: AppError;
  metadata?: {
    executionTime: number;
    timestamp: Date;
    filesProcessed?: number;
  };
}

export interface ServiceMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageExecutionTime: number;
  lastActivity: Date;
}

export abstract class BaseService extends EventEmitter {
  protected readonly name: string;
  protected readonly config: ServiceConfig;
  protected readonly metrics: ServiceMetrics;
  private readonly startTime: Date;
  private isInitialized = false;

  constructor(name: string, config?: Partial<ServiceConfig>) {
    super();
    this.name = name;
    this.config = {
      name,
      version: '1.0.0',
      enableLogging: true,
      ...config
    };
    this.startTime = new Date();
    this.metrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageExecutionTime: 0,
      lastActivity: new Date(),
    };
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    this.log('info', `Initializing service ${this.name}`);
    
    // Ensure output directory exists if specified
    if (this.config.outputDir) {
      await fs.ensureDir(this.config.outputDir);
    }
    
    await this.onInitialize();
    this.isInitialized = true;
    this.emit('initialized');
  }

  public async shutdown(): Promise<void> {
    this.log('info', `Shutting down service ${this.name}`);
    await this.onShutdown();
    this.emit('shutdown');
  }

  public getHealth(): ServiceResult<{
    status: 'healthy' | 'unhealthy';
    uptime: number;
    metrics: ServiceMetrics;
  }> {
    const uptime = Date.now() - this.startTime.getTime();
    const isHealthy = this.checkHealth();
    
    return this.createSuccessResult({
      status: isHealthy ? 'healthy' : 'unhealthy',
      uptime,
      metrics: { ...this.metrics },
    });
  }

  protected async executeOperation<T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<ServiceResult<T>> {
    const startTime = Date.now();

    try {
      this.metrics.totalOperations++;
      this.metrics.lastActivity = new Date();

      const result = await operation();
      
      const executionTime = Date.now() - startTime;
      this.updateMetrics(executionTime, true);

      return this.createSuccessResult(result, {
        executionTime,
        timestamp: new Date(),
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
        error: appError.message,
      });

      return this.createErrorResult(appError, {
        executionTime,
        timestamp: new Date(),
      });
    }
  }

  protected createSuccessResult<T>(
    data: T,
    metadata?: Partial<ServiceResult<T>['metadata']>
  ): ServiceResult<T> {
    return {
      success: true,
      data,
      metadata: metadata as ServiceResult<T>['metadata'],
    };
  }

  protected createErrorResult(
    error: AppError,
    metadata?: Partial<ServiceResult<any>['metadata']>
  ): ServiceResult<any> {
    return {
      success: false,
      error,
      metadata: metadata as ServiceResult<any>['metadata'],
    };
  }

  protected log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context?: Record<string, any>
  ): void {
    if (!this.config.enableLogging) return;

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

  protected async saveOutput(filename: string, content: string): Promise<void> {
    if (!this.config.outputDir) {
      throw new AppError('Output directory not configured', 'CONFIG_ERROR', 500);
    }
    
    const outputPath = path.join(this.config.outputDir, filename);
    await fs.writeFile(outputPath, content, 'utf-8');
    this.log('info', `Saved output to ${outputPath}`);
  }

  private updateMetrics(executionTime: number, success: boolean): void {
    if (success) {
      this.metrics.successfulOperations++;
    } else {
      this.metrics.failedOperations++;
    }

    const totalOps = this.metrics.successfulOperations + this.metrics.failedOperations;
    this.metrics.averageExecutionTime =
      (this.metrics.averageExecutionTime * (totalOps - 1) + executionTime) / totalOps;
  }

  protected abstract onInitialize(): Promise<void>;
  protected abstract onShutdown(): Promise<void>;
  protected abstract checkHealth(): boolean;
}