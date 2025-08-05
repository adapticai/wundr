/**
 * BEFORE: Problematic Wrapper Patterns
 * 
 * This demonstrates common wrapper anti-patterns that add unnecessary complexity,
 * reduce performance, and make code harder to maintain in monorepo environments.
 */

// L BEFORE: Database wrapper that adds no value
export class DatabaseWrapperBefore {
  constructor(private dbClient: any) {}
  
  // Just forwarding calls without adding any functionality
  async findUserById(id: string) {
    return await this.dbClient.user.findUnique({ where: { id } });
  }
  
  async createUser(userData: any) {
    return await this.dbClient.user.create({ data: userData });
  }
  
  async updateUser(id: string, data: any) {
    return await this.dbClient.user.update({ where: { id }, data });
  }
  
  async deleteUser(id: string) {
    return await this.dbClient.user.delete({ where: { id } });
  }
  
  async findManyUsers(where?: any) {
    return await this.dbClient.user.findMany({ where });
  }
}

// L BEFORE: HTTP client wrapper that complicates simple requests
export class HttpClientWrapperBefore {
  constructor(private httpClient: any) {}
  
  // Wrapping every HTTP method without adding value
  async get(url: string, options?: any) {
    try {
      const response = await this.httpClient.get(url, options);
      return response.data;
    } catch (error) {
      throw new Error(`GET request failed: ${error.message}`);
    }
  }
  
  async post(url: string, data?: any, options?: any) {
    try {
      const response = await this.httpClient.post(url, data, options);
      return response.data;
    } catch (error) {
      throw new Error(`POST request failed: ${error.message}`);
    }
  }
  
  async put(url: string, data?: any, options?: any) {
    try {
      const response = await this.httpClient.put(url, data, options);
      return response.data;
    } catch (error) {
      throw new Error(`PUT request failed: ${error.message}`);
    }
  }
  
  async delete(url: string, options?: any) {
    try {
      const response = await this.httpClient.delete(url, options);
      return response.data;
    } catch (error) {
      throw new Error(`DELETE request failed: ${error.message}`);
    }
  }
}

// L BEFORE: Service wrapper that duplicates business logic
export class UserServiceWrapperBefore {
  constructor(
    private userRepository: any,
    private emailService: any,
    private auditService: any
  ) {}
  
  // Duplicating validation and business logic that should be in the core service
  async createUser(userData: any) {
    // Validation duplicated across multiple places
    if (!userData.email) {
      throw new Error('Email is required');
    }
    
    if (!userData.firstName || !userData.lastName) {
      throw new Error('First name and last name are required');
    }
    
    if (!this.isValidEmail(userData.email)) {
      throw new Error('Invalid email format');
    }
    
    // Check if user exists (duplicated logic)
    const existingUser = await this.userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }
    
    // Create user
    const user = await this.userRepository.create(userData);
    
    // Send welcome email (this logic is duplicated)
    try {
      await this.emailService.sendWelcomeEmail(user.email, user.firstName);
    } catch (error) {
      console.log('Failed to send welcome email:', error.message);
    }
    
    // Audit log (duplicated across services)
    try {
      await this.auditService.logEvent('USER_CREATED', {
        userId: user.id,
        email: user.email,
        timestamp: new Date()
      });
    } catch (error) {
      console.log('Failed to log audit event:', error.message);
    }
    
    return user;
  }
  
  private isValidEmail(email: string): boolean {
    // Email validation logic duplicated
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

// L BEFORE: Configuration wrapper that obscures the original API
export class ConfigWrapperBefore {
  constructor(private config: any) {}
  
  // Creating separate methods for every config value
  getDatabaseUrl(): string {
    return this.config.get('DATABASE_URL') || 'postgresql://localhost:5432/app';
  }
  
  getRedisUrl(): string {
    return this.config.get('REDIS_URL') || 'redis://localhost:6379';
  }
  
  getApiPort(): number {
    return parseInt(this.config.get('PORT') || '3000');
  }
  
  getJwtSecret(): string {
    return this.config.get('JWT_SECRET') || 'default-secret';
  }
  
  getEmailApiKey(): string {
    return this.config.get('EMAIL_API_KEY') || '';
  }
  
  getS3Bucket(): string {
    return this.config.get('S3_BUCKET') || 'default-bucket';
  }
  
  getLogLevel(): string {
    return this.config.get('LOG_LEVEL') || 'info';
  }
  
  // Inconsistent naming and behavior
  isProduction(): boolean {
    return this.config.get('NODE_ENV') === 'production';
  }
  
  isDevelopment(): boolean {
    return this.config.get('NODE_ENV') === 'development';
  }
  
  environment(): string {
    return this.config.get('NODE_ENV') || 'development';
  }
}

// L BEFORE: Logger wrapper that makes simple operations complex
export class LoggerWrapperBefore {
  constructor(private logger: any) {}
  
  // Making synchronous operations asynchronous unnecessarily
  async logInfo(message: string, meta?: any) {
    return new Promise<void>((resolve) => {
      this.logger.info(message, meta);
      setTimeout(resolve, 10); // Artificial delay
    });
  }
  
  async logError(error: Error, context?: string) {
    return new Promise<void>((resolve, reject) => {
      try {
        this.logger.error(error.message, {
          stack: error.stack,
          context,
          timestamp: new Date().toISOString()
        });
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  }
  
  async logWarning(message: string) {
    return new Promise<void>((resolve) => {
      this.logger.warn(message);
      resolve();
    });
  }
  
  // Inconsistent method names
  async debugMessage(message: string) {
    return this.logger.debug(message);
  }
  
  async writeTrace(message: string) {
    return this.logger.trace(message);
  }
}

// L BEFORE: Event emitter wrapper that complicates event handling
export class EventWrapperBefore {
  constructor(private eventEmitter: any) {}
  
  // Making event emission asynchronous when it doesn't need to be
  async emitUserCreated(userData: any) {
    return new Promise<void>((resolve) => {
      this.eventEmitter.emit('user:created', {
        ...userData,
        timestamp: new Date(),
        eventId: this.generateEventId()
      });
      setTimeout(resolve, 50); // Artificial delay
    });
  }
  
  async emitUserUpdated(userId: string, changes: any) {
    return new Promise<void>((resolve, reject) => {
      try {
        this.eventEmitter.emit('user:updated', {
          userId,
          changes,
          timestamp: new Date(),
          eventId: this.generateEventId()
        });
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // Inconsistent method signatures
  emitOrderProcessed(orderId: string) {
    this.eventEmitter.emit('order:processed', {
      orderId,
      timestamp: new Date()
    });
  }
  
  async emitPaymentFailed(paymentData: any, error: Error) {
    this.eventEmitter.emit('payment:failed', {
      ...paymentData,
      error: error.message,
      timestamp: new Date(),
      eventId: this.generateEventId()
    });
  }
  
  private generateEventId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}

// L BEFORE: Cache wrapper that adds unnecessary complexity
export class CacheWrapperBefore {
  constructor(private cache: any) {}
  
  // Wrapping simple cache operations with complex APIs
  async getValue(key: string): Promise<any> {
    try {
      const value = await this.cache.get(key);
      if (value === null || value === undefined) {
        return null;
      }
      return JSON.parse(value);
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }
  
  async setValue(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.cache.setex(key, ttl, serialized);
      } else {
        await this.cache.set(key, serialized);
      }
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }
  
  async deleteValue(key: string): Promise<boolean> {
    try {
      const result = await this.cache.del(key);
      return result > 0;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }
  
  // Inconsistent naming
  async removeValue(key: string): Promise<void> {
    await this.cache.del(key);
  }
  
  async hasKey(key: string): Promise<boolean> {
    try {
      const exists = await this.cache.exists(key);
      return exists === 1;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Problems with these BEFORE patterns:
 * 
 * 1. UNNECESSARY ABSTRACTION:
 *    - Wrappers add layers without value
 *    - Simple operations become complex
 *    - Performance overhead from extra function calls
 * 
 * 2. INCONSISTENT APIS:
 *    - Different naming conventions within same wrapper
 *    - Mixing sync/async operations inconsistently
 *    - Unpredictable method signatures
 * 
 * 3. DUPLICATE LOGIC:
 *    - Business logic repeated in wrappers
 *    - Validation logic duplicated across services
 *    - Error handling patterns inconsistent
 * 
 * 4. MAINTENANCE BURDEN:
 *    - Multiple places to update for simple changes
 *    - Wrapper bugs on top of underlying library bugs
 *    - Testing requires mocking multiple layers
 * 
 * 5. POOR ERROR HANDLING:
 *    - Generic error messages lose context
 *    - Swallowing errors or converting to different types
 *    - Stack traces become unclear
 * 
 * 6. PERFORMANCE ISSUES:
 *    - Unnecessary async operations
 *    - Extra serialization/deserialization
 *    - Additional memory allocations
 */

/**
 * Usage examples showing the problems:
 */

// Example usage that shows the complexity
export class UserController {
  constructor(
    private userServiceWrapper: UserServiceWrapperBefore,
    private loggerWrapper: LoggerWrapperBefore,
    private eventWrapper: EventWrapperBefore
  ) {}
  
  async createUser(userData: any) {
    try {
      // Multiple layers of async operations for simple tasks
      await this.loggerWrapper.logInfo('Creating user', { email: userData.email });
      
      const user = await this.userServiceWrapper.createUser(userData);
      
      // Event emission is unnecessarily async
      await this.eventWrapper.emitUserCreated(user);
      
      await this.loggerWrapper.logInfo('User created successfully', { userId: user.id });
      
      return user;
    } catch (error) {
      // Error context is lost through wrapper layers
      await this.loggerWrapper.logError(error, 'UserController.createUser');
      throw error;
    }
  }
}