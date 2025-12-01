/**
 * GOLDEN PATTERN: Proper Error Handling
 *
 * This file demonstrates best practices for error handling in monorepo environments,
 * including structured error types, proper error propagation, and comprehensive logging.
 */

// Base error classes with proper inheritance
export abstract class BaseError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  constructor(
    message: string,
    public readonly context: Record<string, any> = {},
    public readonly cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
      stack: this.stack,
      cause: this.cause?.message,
    };
  }
}

// Domain-specific error types
export class ValidationError extends BaseError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;

  constructor(
    message: string,
    public readonly field: string,
    public readonly value: any,
    context: Record<string, any> = {}
  ) {
    super(message, { ...context, field, value });
  }
}

export class BusinessRuleError extends BaseError {
  readonly code = 'BUSINESS_RULE_VIOLATION';
  readonly statusCode = 422;

  constructor(
    message: string,
    public readonly rule: string,
    context: Record<string, any> = {}
  ) {
    super(message, { ...context, rule });
  }
}

export class NotFoundError extends BaseError {
  readonly code = 'RESOURCE_NOT_FOUND';
  readonly statusCode = 404;

  constructor(
    resource: string,
    identifier: string,
    context: Record<string, any> = {}
  ) {
    super(`${resource} with identifier '${identifier}' not found`, {
      ...context,
      resource,
      identifier,
    });
  }
}

export class ConflictError extends BaseError {
  readonly code = 'RESOURCE_CONFLICT';
  readonly statusCode = 409;

  constructor(
    message: string,
    public readonly conflictingResource: string,
    context: Record<string, any> = {}
  ) {
    super(message, { ...context, conflictingResource });
  }
}

export class ExternalServiceError extends BaseError {
  readonly code = 'EXTERNAL_SERVICE_ERROR';
  readonly statusCode = 502;

  constructor(
    serviceName: string,
    operation: string,
    cause?: Error,
    context: Record<string, any> = {}
  ) {
    super(
      `${serviceName} service failed during ${operation}`,
      {
        ...context,
        serviceName,
        operation,
      },
      cause
    );
  }
}

export class DatabaseError extends BaseError {
  readonly code = 'DATABASE_ERROR';
  readonly statusCode = 500;

  constructor(
    operation: string,
    cause?: Error,
    context: Record<string, any> = {}
  ) {
    super(
      `Database operation failed: ${operation}`,
      {
        ...context,
        operation,
      },
      cause
    );
  }
}

// Result pattern for better error handling
export type Result<T, E = BaseError> =
  | { success: true; data: T }
  | { success: false; error: E };

export class ResultHandler {
  static success<T>(data: T): Result<T> {
    return { success: true, data };
  }

  static failure<E extends BaseError>(error: E): Result<never, E> {
    return { success: false, error };
  }

  static async fromPromise<T>(
    promise: Promise<T>,
    errorMapper?: (error: unknown) => BaseError
  ): Promise<Result<T>> {
    try {
      const data = await promise;
      return this.success(data);
    } catch (error) {
      const mappedError = errorMapper
        ? errorMapper(error)
        : error instanceof BaseError
          ? error
          : new BaseError('Unknown error occurred', { originalError: error });

      return this.failure(mappedError);
    }
  }
}

// Error aggregation for batch operations
export class ErrorAggregator {
  private errors: BaseError[] = [];

  add(error: BaseError): void {
    this.errors.push(error);
  }

  addAll(errors: BaseError[]): void {
    this.errors.push(...errors);
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  getErrors(): BaseError[] {
    return [...this.errors];
  }

  throwIfHasErrors(): void {
    if (this.hasErrors()) {
      throw new BatchOperationError(this.errors);
    }
  }

  clear(): void {
    this.errors = [];
  }
}

export class BatchOperationError extends BaseError {
  readonly code = 'BATCH_OPERATION_ERROR';
  readonly statusCode = 400;

  constructor(public readonly errors: BaseError[]) {
    const errorCount = errors.length;
    const errorTypes = [...new Set(errors.map(e => e.constructor.name))];

    super(
      `Batch operation failed with ${errorCount} errors: ${errorTypes.join(', ')}`,
      {
        errorCount,
        errorTypes,
        errors: errors.map(e => e.toJSON()),
      }
    );
  }
}

// Golden pattern service implementation with proper error handling
export class UserService {
  constructor(
    private userRepository: UserRepository,
    private emailService: EmailService,
    private logger: Logger
  ) {}

  async createUser(userData: CreateUserRequest): Promise<Result<User>> {
    try {
      // Validate input data
      const validationResult = await this.validateUserData(userData);
      if (!validationResult.success) {
        return validationResult;
      }

      // Check business rules
      const existingUser = await this.userRepository.findByEmail(
        userData.email
      );
      if (existingUser) {
        return ResultHandler.failure(
          new ConflictError('User with this email already exists', 'User', {
            email: userData.email,
          })
        );
      }

      // Create user
      const user = await this.userRepository.create(userData);

      // Handle side effects (non-blocking)
      this.handleUserCreatedSideEffects(user).catch(error => {
        this.logger.error('User creation side effects failed', {
          userId: user.id,
          error: error.message,
          stack: error.stack,
        });
      });

      return ResultHandler.success(user);
    } catch (error) {
      this.logger.error('User creation failed', {
        email: userData.email,
        error: error.message,
        stack: error.stack,
      });

      // Map different error types appropriately
      if (error.code === 'P2002') {
        // Prisma unique constraint
        return ResultHandler.failure(
          new ConflictError('Email already exists', 'User', {
            email: userData.email,
          })
        );
      }

      if (error.name === 'ConnectionError') {
        return ResultHandler.failure(new DatabaseError('user creation', error));
      }

      // Default to generic error
      return ResultHandler.failure(
        new BaseError('Failed to create user', { email: userData.email }, error)
      );
    }
  }

  async updateUser(id: string, data: UpdateUserRequest): Promise<Result<User>> {
    try {
      const user = await this.userRepository.findById(id);
      if (!user) {
        return ResultHandler.failure(new NotFoundError('User', id));
      }

      const validationResult = await this.validateUpdateData(data);
      if (!validationResult.success) {
        return validationResult;
      }

      const updatedUser = await this.userRepository.update(id, data);
      return ResultHandler.success(updatedUser);
    } catch (error) {
      this.logger.error('User update failed', {
        userId: id,
        updateData: data,
        error: error.message,
      });

      return ResultHandler.failure(
        new DatabaseError('user update', error, { userId: id })
      );
    }
  }

  async batchCreateUsers(
    usersData: CreateUserRequest[]
  ): Promise<Result<User[]>> {
    const errorAggregator = new ErrorAggregator();
    const createdUsers: User[] = [];

    for (let i = 0; i < usersData.length; i++) {
      const userData = usersData[i];
      const result = await this.createUser(userData);

      if (result.success) {
        createdUsers.push(result.data);
      } else {
        // Add context about which item failed
        const contextualError = new ValidationError(
          `Failed to create user at index ${i}: ${result.error.message}`,
          'batchIndex',
          i,
          { originalError: result.error, userData }
        );
        errorAggregator.add(contextualError);
      }
    }

    if (errorAggregator.hasErrors()) {
      return ResultHandler.failure(
        new BatchOperationError(errorAggregator.getErrors())
      );
    }

    return ResultHandler.success(createdUsers);
  }

  private async validateUserData(
    userData: CreateUserRequest
  ): Promise<Result<void>> {
    const errors: ValidationError[] = [];

    if (!userData.email) {
      errors.push(
        new ValidationError('Email is required', 'email', userData.email)
      );
    } else if (!this.isValidEmail(userData.email)) {
      errors.push(
        new ValidationError('Invalid email format', 'email', userData.email)
      );
    }

    if (!userData.firstName) {
      errors.push(
        new ValidationError(
          'First name is required',
          'firstName',
          userData.firstName
        )
      );
    }

    if (!userData.lastName) {
      errors.push(
        new ValidationError(
          'Last name is required',
          'lastName',
          userData.lastName
        )
      );
    }

    if (!userData.password || userData.password.length < 8) {
      errors.push(
        new ValidationError(
          'Password must be at least 8 characters long',
          'password',
          userData.password?.length || 0
        )
      );
    }

    if (errors.length > 0) {
      return ResultHandler.failure(new BatchOperationError(errors));
    }

    return ResultHandler.success(undefined);
  }

  private async validateUpdateData(
    data: UpdateUserRequest
  ): Promise<Result<void>> {
    const errors: ValidationError[] = [];

    if (data.email && !this.isValidEmail(data.email)) {
      errors.push(
        new ValidationError('Invalid email format', 'email', data.email)
      );
    }

    if (data.firstName === '') {
      errors.push(
        new ValidationError(
          'First name cannot be empty',
          'firstName',
          data.firstName
        )
      );
    }

    if (data.lastName === '') {
      errors.push(
        new ValidationError(
          'Last name cannot be empty',
          'lastName',
          data.lastName
        )
      );
    }

    if (errors.length > 0) {
      return ResultHandler.failure(new BatchOperationError(errors));
    }

    return ResultHandler.success(undefined);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private async handleUserCreatedSideEffects(user: User): Promise<void> {
    try {
      await this.emailService.sendWelcomeEmail(user.email, user.firstName);
    } catch (error) {
      // Side effects should not break the main operation
      this.logger.warn('Failed to send welcome email', {
        userId: user.id,
        email: user.email,
        error: error.message,
      });
    }
  }
}

// Error handling middleware for Express.js
export class ErrorHandler {
  static handle(error: Error, req: any, res: any, next: any) {
    if (error instanceof BaseError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          context: error.context,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Log unexpected errors
    console.error('Unexpected error:', error);

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
      },
    });
  }

  static asyncWrapper(fn: Function) {
    return (req: any, res: any, next: any) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
}

// Circuit breaker pattern for external service calls
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime?: number;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private failureThreshold: number = 5,
    private recoveryTimeout: number = 60000, // 1 minute
    private logger: Logger
  ) {}

  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
      } else {
        if (fallback) {
          this.logger.info('Circuit breaker is open, using fallback');
          return await fallback();
        }
        throw new ExternalServiceError(
          'CircuitBreaker',
          'execute',
          new Error('Circuit breaker is open')
        );
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();

      if (fallback && this.state === 'OPEN') {
        this.logger.info(
          'Operation failed and circuit is now open, using fallback'
        );
        return await fallback();
      }

      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.logger.warn('Circuit breaker opened', {
        failures: this.failures,
        threshold: this.failureThreshold,
      });
    }
  }

  private shouldAttemptReset(): boolean {
    return (
      this.lastFailureTime &&
      Date.now() - this.lastFailureTime >= this.recoveryTimeout
    );
  }
}

// Retry pattern with exponential backoff
export class RetryHandler {
  static async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxAttempts?: number;
      baseDelay?: number;
      maxDelay?: number;
      exponentialBase?: number;
      shouldRetry?: (error: Error) => boolean;
      onRetry?: (attempt: number, error: Error) => void;
    } = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      baseDelay = 1000,
      maxDelay = 10000,
      exponentialBase = 2,
      shouldRetry = error =>
        !(error instanceof ValidationError || error instanceof NotFoundError),
      onRetry,
    } = options;

    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === maxAttempts || !shouldRetry(error)) {
          throw error;
        }

        const delay = Math.min(
          baseDelay * Math.pow(exponentialBase, attempt - 1),
          maxDelay
        );

        onRetry?.(attempt, error);

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }
}

// Example usage in a controller
export class UserController {
  constructor(
    private userService: UserService,
    private logger: Logger
  ) {}

  createUser = ErrorHandler.asyncWrapper(async (req: any, res: any) => {
    const result = await this.userService.createUser(req.body);

    if (result.success) {
      res.status(201).json({
        success: true,
        data: result.data,
        timestamp: new Date().toISOString(),
      });
    } else {
      const error = result.error;
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          context: error.context,
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  batchCreateUsers = ErrorHandler.asyncWrapper(async (req: any, res: any) => {
    const result = await this.userService.batchCreateUsers(req.body.users);

    if (result.success) {
      res.status(201).json({
        success: true,
        data: result.data,
        summary: {
          totalProcessed: req.body.users.length,
          successCount: result.data.length,
          errorCount: 0,
        },
        timestamp: new Date().toISOString(),
      });
    } else {
      const error = result.error;
      const batchError = error as BatchOperationError;

      res.status(207).json({
        // Multi-status
        success: false,
        error: {
          code: error.code,
          message: error.message,
          summary: {
            totalProcessed: req.body.users.length,
            successCount: req.body.users.length - batchError.errors.length,
            errorCount: batchError.errors.length,
          },
          errors: batchError.errors.map(e => e.toJSON()),
        },
        timestamp: new Date().toISOString(),
      });
    }
  });
}

/**
 * Benefits of these golden patterns:
 *
 * 1. STRUCTURED ERROR TYPES:
 *    - Clear error hierarchy with domain-specific types
 *    - Consistent error codes and HTTP status codes
 *    - Rich context information for debugging
 *
 * 2. RESULT PATTERN:
 *    - Explicit error handling without exceptions for control flow
 *    - Type-safe error handling
 *    - Better composability of operations
 *
 * 3. ERROR AGGREGATION:
 *    - Collect multiple validation errors
 *    - Better user experience with complete error feedback
 *    - Proper handling of batch operations
 *
 * 4. RESILIENCE PATTERNS:
 *    - Circuit breaker for external service protection
 *    - Retry with exponential backoff
 *    - Graceful degradation with fallbacks
 *
 * 5. PROPER LOGGING:
 *    - Structured error information
 *    - Correlation IDs for tracing
 *    - Appropriate log levels
 *
 * 6. SEPARATION OF CONCERNS:
 *    - Business logic separate from error handling
 *    - Side effects handled asynchronously
 *    - Clear boundaries between layers
 */

// Type definitions
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}

interface UpdateUserRequest {
  email?: string;
  firstName?: string;
  lastName?: string;
}

interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(userData: CreateUserRequest): Promise<User>;
  update(id: string, data: UpdateUserRequest): Promise<User>;
}

interface EmailService {
  sendWelcomeEmail(email: string, firstName: string): Promise<void>;
}

interface Logger {
  error(message: string, context?: Record<string, any>): void;
  warn(message: string, context?: Record<string, any>): void;
  info(message: string, context?: Record<string, any>): void;
}
