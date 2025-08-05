/**
 * ANTI-PATTERN: Unnecessary Wrapper Services
 * 
 * This file demonstrates wrapper service anti-patterns that add unnecessary
 * abstraction layers, increase complexity, and reduce performance in monorepo environments.
 */

// L BAD: Wrapper service that adds no value
export class DatabaseWrapperBad {
  constructor(private db: any) {}
  
  // Anti-pattern: Just forwarding method calls without adding value
  async findUser(id: string) {
    return await this.db.findUser(id);
  }
  
  async createUser(userData: any) {
    return await this.db.createUser(userData);
  }
  
  async updateUser(id: string, data: any) {
    return await this.db.updateUser(id, data);
  }
  
  async deleteUser(id: string) {
    return await this.db.deleteUser(id);
  }
}

// L BAD: Over-abstracted HTTP client wrapper
export class HttpClientWrapperBad {
  constructor(private httpClient: any) {}
  
  // Anti-pattern: Wrapping every HTTP method without added functionality
  async get(url: string, options?: any) {
    return await this.httpClient.get(url, options);
  }
  
  async post(url: string, data?: any, options?: any) {
    return await this.httpClient.post(url, data, options);
  }
  
  async put(url: string, data?: any, options?: any) {
    return await this.httpClient.put(url, data, options);
  }
  
  async delete(url: string, options?: any) {
    return await this.httpClient.delete(url, options);
  }
  
  async patch(url: string, data?: any, options?: any) {
    return await this.httpClient.patch(url, data, options);
  }
}

// L BAD: Wrapper that makes the API worse
export class LoggerWrapperBad {
  constructor(private logger: any) {}
  
  // Anti-pattern: Adding complexity to simple operations
  async logInfo(message: string) {
    // Unnecessary async for synchronous operation
    return new Promise((resolve) => {
      this.logger.info(message);
      resolve(undefined);
    });
  }
  
  async logError(error: Error) {
    // Over-engineering simple logging
    return new Promise((resolve, reject) => {
      try {
        this.logger.error(error.message);
        resolve(undefined);
      } catch (e) {
        reject(e);
      }
    });
  }
  
  // Anti-pattern: Inconsistent method names
  async writeWarning(message: string) {
    return this.logger.warn(message);
  }
  
  async debugMessage(message: string) {
    return this.logger.debug(message);
  }
}

// L BAD: Repository wrapper that adds no abstraction
export class UserRepositoryWrapperBad {
  constructor(private userRepository: any) {}
  
  // Anti-pattern: Just renaming methods without purpose
  async getUserById(id: string) {
    return await this.userRepository.findById(id);
  }
  
  async getAllUsers() {
    return await this.userRepository.findAll();
  }
  
  async saveUser(user: any) {
    return await this.userRepository.save(user);
  }
  
  async removeUser(id: string) {
    return await this.userRepository.delete(id);
  }
}

// L BAD: Service wrapper that duplicates business logic
export class OrderServiceWrapperBad {
  constructor(
    private orderService: any,
    private emailService: any,
    private inventoryService: any
  ) {}
  
  // Anti-pattern: Duplicating complex business logic instead of composing
  async createOrder(orderData: any) {
    // This logic should be in the original service, not duplicated
    if (!orderData.customerId) {
      throw new Error('Customer ID required');
    }
    
    // Duplicating validation logic
    if (!orderData.items || orderData.items.length === 0) {
      throw new Error('Order must have items');
    }
    
    // Duplicating inventory checks
    for (const item of orderData.items) {
      const available = await this.inventoryService.checkAvailability(item.productId);
      if (available < item.quantity) {
        throw new Error(`Insufficient inventory for ${item.productId}`);
      }
    }
    
    const order = await this.orderService.create(orderData);
    
    // Duplicating notification logic
    await this.emailService.sendOrderConfirmation(order.customerId, order.id);
    
    return order;
  }
}

// L BAD: Configuration wrapper that obscures original API
export class ConfigWrapperBad {
  constructor(private config: any) {}
  
  // Anti-pattern: Creating methods for every config key
  getDatabaseUrl() {
    return this.config.get('DATABASE_URL');
  }
  
  getApiKey() {
    return this.config.get('API_KEY');
  }
  
  getPort() {
    return this.config.get('PORT');
  }
  
  getEnvironment() {
    return this.config.get('NODE_ENV');
  }
  
  getRedisUrl() {
    return this.config.get('REDIS_URL');
  }
  
  // Anti-pattern: Inconsistent naming and return types
  portNumber() {
    return parseInt(this.config.get('PORT'));
  }
  
  isDevelopment() {
    return this.config.get('NODE_ENV') === 'development';
  }
}

// L BAD: Utility wrapper that adds unnecessary complexity
export class DateUtilsWrapperBad {
  constructor(private dateLib: any) {}
  
  // Anti-pattern: Wrapping well-known libraries with worse APIs
  getCurrentTimestamp() {
    return this.dateLib.now();
  }
  
  formatDateAsString(date: Date) {
    return this.dateLib.format(date, 'YYYY-MM-DD');
  }
  
  parseDateFromString(dateString: string) {
    return this.dateLib.parse(dateString);
  }
  
  addDaysToDate(date: Date, days: number) {
    return this.dateLib.add(date, days, 'days');
  }
  
  // Anti-pattern: Creating multiple methods for similar operations
  subtractHours(date: Date, hours: number) {
    return this.dateLib.subtract(date, hours, 'hours');
  }
  
  subtractMinutes(date: Date, minutes: number) {
    return this.dateLib.subtract(date, minutes, 'minutes');
  }
  
  subtractSeconds(date: Date, seconds: number) {
    return this.dateLib.subtract(date, seconds, 'seconds');
  }
}

// L BAD: Event wrapper that makes event handling more complex
export class EventWrapperBad {
  constructor(private eventEmitter: any) {}
  
  // Anti-pattern: Wrapping simple event operations with complex APIs
  async emitUserCreated(userData: any) {
    return new Promise((resolve) => {
      this.eventEmitter.emit('user:created', userData);
      setTimeout(resolve, 100); // Arbitrary delay
    });
  }
  
  async emitUserUpdated(userId: string, changes: any) {
    return new Promise((resolve, reject) => {
      try {
        this.eventEmitter.emit('user:updated', { userId, changes });
        resolve(undefined);
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // Anti-pattern: Inconsistent method signatures
  emitOrderProcessed(orderId: string) {
    this.eventEmitter.emit('order:processed', orderId);
  }
  
  async emitPaymentFailed(paymentData: any, error: Error) {
    this.eventEmitter.emit('payment:failed', { ...paymentData, error: error.message });
  }
}

/**
 * Problems with wrapper service anti-patterns:
 * 
 * 1. Adds unnecessary layers of abstraction
 * 2. Increases memory usage and call stack depth
 * 3. Makes debugging more difficult
 * 4. Reduces performance with no benefit
 * 5. Creates maintenance burden with duplicate APIs
 * 6. Can introduce bugs in the wrapper layer
 * 7. Makes code harder to understand
 * 8. Violates YAGNI principle (You Aren't Gonna Need It)
 * 9. Creates inconsistent APIs across the codebase
 * 10. Makes refactoring more difficult
 */

/**
 * Impact on monorepos:
 * 
 * - Creates unnecessary dependencies between packages
 * - Increases bundle sizes across multiple packages
 * - Makes it harder to establish consistent patterns
 * - Complicates dependency updates
 * - Creates artificial coupling between services
 * - Makes package boundaries unclear
 * - Increases the surface area for breaking changes
 */

/**
 * When wrapper services ARE appropriate:
 * 
 * 1. Adding cross-cutting concerns (logging, metrics, caching)
 * 2. Providing domain-specific APIs over generic libraries
 * 3. Isolating external dependencies for easier testing
 * 4. Adding error handling and retry logic
 * 5. Providing backwards compatibility
 * 6. Adding type safety to untyped libraries
 * 7. Combining multiple services into a facade
 * 8. Adding business logic specific to your domain
 */

/**
 * Signs you might have wrapper anti-patterns:
 * 
 * 1. Methods that just forward calls without modification
 * 2. One-to-one mapping between wrapper and wrapped APIs
 * 3. No additional error handling or validation
 * 4. No cross-cutting concerns added
 * 5. Wrapper exists "just in case" we need to change implementations
 * 6. No domain-specific logic in the wrapper
 * 7. Wrapper makes the API more complex, not simpler
 * 8. Team members bypass the wrapper to use underlying service directly
 */

/**
 * Better alternatives:
 * 
 * 1. Use composition instead of wrapping
 * 2. Add specific functionality only when needed
 * 3. Use dependency injection for testability
 * 4. Create domain-specific services that add real value
 * 5. Use decorators or middleware patterns for cross-cutting concerns
 * 6. Focus on creating cohesive, purpose-built services
 */