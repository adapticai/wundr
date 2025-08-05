/**
 * GOLDEN PATTERN: Async Patterns and Concurrency
 * 
 * This file demonstrates best practices for async programming in monorepo environments,
 * including proper error handling, concurrency control, and performance optimization.
 */

// Promise utilities for better async control
export class PromiseUtils {
  /**
   * Execute promises with controlled concurrency
   * Prevents overwhelming external services or databases
   */
  static async withConcurrency<T, R>(
    items: T[],
    asyncFn: (item: T, index: number) => Promise<R>,
    concurrency: number = 5
  ): Promise<R[]> {
    const results: R[] = [];
    const executing: Promise<void>[] = [];
    
    for (let i = 0; i < items.length; i++) {
      const promise = asyncFn(items[i], i).then(result => {
        results[i] = result;
      });
      
      executing.push(promise);
      
      if (executing.length >= concurrency) {
        await Promise.race(executing);
        // Remove completed promises
        const completedIndex = executing.findIndex(p => 
          p === promise || Promise.resolve(p) === promise
        );
        if (completedIndex !== -1) {
          executing.splice(completedIndex, 1);
        }
      }
    }
    
    // Wait for remaining promises
    await Promise.all(executing);
    return results;
  }
  
  /**
   * Batch processing with size control
   * Useful for database operations or API calls
   */
  static async inBatches<T, R>(
    items: T[],
    asyncFn: (batch: T[], batchIndex: number) => Promise<R[]>,
    batchSize: number = 100
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchIndex = Math.floor(i / batchSize);
      const batchResults = await asyncFn(batch, batchIndex);
      results.push(...batchResults);
    }
    
    return results;
  }
  
  /**
   * Retry with exponential backoff and jitter
   * Essential for handling transient failures
   */
  static async withRetry<T>(
    asyncFn: () => Promise<T>,
    options: {
      maxAttempts?: number;
      baseDelay?: number;
      maxDelay?: number;
      jitter?: boolean;
      shouldRetry?: (error: Error, attempt: number) => boolean;
      onRetry?: (error: Error, attempt: number) => void;
    } = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      baseDelay = 1000,
      maxDelay = 30000,
      jitter = true,
      shouldRetry = (error) => !error.message.includes('validation'),
      onRetry
    } = options;
    
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await asyncFn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxAttempts || !shouldRetry(lastError, attempt)) {
          throw lastError;
        }
        
        onRetry?.(lastError, attempt);
        
        const delay = Math.min(
          baseDelay * Math.pow(2, attempt - 1),
          maxDelay
        );
        
        const jitterDelay = jitter 
          ? delay + Math.random() * delay * 0.1 
          : delay;
        
        await this.delay(jitterDelay);
      }
    }
    
    throw lastError!;
  }
  
  /**
   * Timeout wrapper for promises
   * Prevents hanging operations
   */
  static async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string = 'Operation timed out'
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    });
    
    return Promise.race([promise, timeoutPromise]);
  }
  
  /**
   * Simple delay utility
   */
  static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * All settled with results separation
   * Better than Promise.allSettled for error handling
   */
  static async allSettledSeparated<T>(
    promises: Promise<T>[]
  ): Promise<{
    fulfilled: T[];
    rejected: Error[];
  }> {
    const results = await Promise.allSettled(promises);
    
    const fulfilled: T[] = [];
    const rejected: Error[] = [];
    
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        fulfilled.push(result.value);
      } else {
        rejected.push(result.reason);
      }
    });
    
    return { fulfilled, rejected };
  }
}

// Circuit breaker pattern for resilient external service calls
export class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime?: number;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private readonly config: {
      failureThreshold: number;
      resetTimeout: number;
      monitoringPeriod: number;
    },
    private readonly logger?: Logger
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
          this.logger?.info('Circuit breaker is open, using fallback');
          return await fallback();
        }
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      
      if (this.state === 'OPEN' && fallback) {
        this.logger?.info('Circuit breaker opened, using fallback');
        return await fallback();
      }
      
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  private onFailure(error: Error): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.config.failureThreshold) {
      this.state = 'OPEN';
      this.logger?.warn('Circuit breaker opened', {
        failures: this.failures,
        threshold: this.config.failureThreshold,
        error: error.message
      });
    }
  }
  
  private shouldAttemptReset(): boolean {
    return this.lastFailureTime !== undefined &&
           (Date.now() - this.lastFailureTime) >= this.config.resetTimeout;
  }
  
  getState(): { state: string; failures: number } {
    return {
      state: this.state,
      failures: this.failures
    };
  }
}

// Async queue for controlled sequential processing
export class AsyncQueue<T> {
  private queue: Array<() => Promise<T>> = [];
  private processing: boolean = false;
  private results: T[] = [];
  
  constructor(
    private readonly options: {
      concurrency?: number;
      onProgress?: (completed: number, total: number) => void;
      onError?: (error: Error, taskIndex: number) => void;
    } = {}
  ) {}
  
  add(task: () => Promise<T>): void {
    this.queue.push(task);
  }
  
  addBatch(tasks: Array<() => Promise<T>>): void {
    this.queue.push(...tasks);
  }
  
  async process(): Promise<T[]> {
    if (this.processing) {
      throw new Error('Queue is already processing');
    }
    
    this.processing = true;
    this.results = [];
    
    try {
      const concurrency = this.options.concurrency || 1;
      
      if (concurrency === 1) {
        // Sequential processing
        for (let i = 0; i < this.queue.length; i++) {
          try {
            const result = await this.queue[i]();
            this.results.push(result);
            this.options.onProgress?.(i + 1, this.queue.length);
          } catch (error) {
            this.options.onError?.(error as Error, i);
            throw error;
          }
        }
      } else {
        // Concurrent processing
        this.results = await PromiseUtils.withConcurrency(
          this.queue,
          async (task, index) => {
            try {
              const result = await task();
              this.options.onProgress?.(index + 1, this.queue.length);
              return result;
            } catch (error) {
              this.options.onError?.(error as Error, index);
              throw error;
            }
          },
          concurrency
        );
      }
      
      return this.results;
    } finally {
      this.processing = false;
      this.queue = [];
    }
  }
  
  size(): number {
    return this.queue.length;
  }
  
  clear(): void {
    if (this.processing) {
      throw new Error('Cannot clear queue while processing');
    }
    this.queue = [];
  }
}

// Rate limiter for API calls
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  
  constructor(
    private readonly maxTokens: number,
    private readonly refillRate: number, // tokens per second
    private readonly interval: number = 1000 // ms
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }
  
  async acquire(tokens: number = 1): Promise<void> {
    await this.waitForTokens(tokens);
    this.tokens -= tokens;
  }
  
  private async waitForTokens(requiredTokens: number): Promise<void> {
    while (this.getAvailableTokens() < requiredTokens) {
      const waitTime = this.calculateWaitTime(requiredTokens);
      await PromiseUtils.delay(waitTime);
    }
  }
  
  private getAvailableTokens(): number {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = Math.floor((timePassed / this.interval) * this.refillRate);
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
    
    return this.tokens;
  }
  
  private calculateWaitTime(requiredTokens: number): number {
    const availableTokens = this.getAvailableTokens();
    const tokensNeeded = requiredTokens - availableTokens;
    return Math.ceil((tokensNeeded / this.refillRate) * this.interval);
  }
}

// Task scheduler for background operations
export class TaskScheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  
  schedule(
    id: string,
    task: () => Promise<void>,
    options: {
      interval?: number;
      delay?: number;
      maxRetries?: number;
      onError?: (error: Error, retryCount: number) => void;
      onComplete?: () => void;
    }
  ): void {
    const scheduledTask: ScheduledTask = {
      id,
      task,
      options: {
        interval: options.interval || 60000, // 1 minute default
        delay: options.delay || 0,
        maxRetries: options.maxRetries || 3,
        onError: options.onError,
        onComplete: options.onComplete
      },
      retryCount: 0,
      isRunning: false
    };
    
    this.tasks.set(id, scheduledTask);
    
    const timeout = setTimeout(() => {
      this.executeTask(scheduledTask);
      
      if (scheduledTask.options.interval) {
        const interval = setInterval(() => {
          this.executeTask(scheduledTask);
        }, scheduledTask.options.interval);
        
        this.intervals.set(id, interval);
      }
    }, scheduledTask.options.delay);
    
    this.intervals.set(`${id}_initial`, timeout);
  }
  
  private async executeTask(scheduledTask: ScheduledTask): Promise<void> {
    if (scheduledTask.isRunning) {
      return; // Skip if already running
    }
    
    scheduledTask.isRunning = true;
    
    try {
      await scheduledTask.task();
      scheduledTask.retryCount = 0; // Reset on success
      scheduledTask.options.onComplete?.();
    } catch (error) {
      scheduledTask.retryCount++;
      scheduledTask.options.onError?.(error as Error, scheduledTask.retryCount);
      
      if (scheduledTask.retryCount >= scheduledTask.options.maxRetries) {
        this.unschedule(scheduledTask.id);
      }
    } finally {
      scheduledTask.isRunning = false;
    }
  }
  
  unschedule(id: string): void {
    const interval = this.intervals.get(id);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(id);
    }
    
    const initialTimeout = this.intervals.get(`${id}_initial`);
    if (initialTimeout) {
      clearTimeout(initialTimeout);
      this.intervals.delete(`${id}_initial`);
    }
    
    this.tasks.delete(id);
  }
  
  unscheduleAll(): void {
    for (const id of this.tasks.keys()) {
      this.unschedule(id);
    }
  }
  
  getScheduledTasks(): string[] {
    return Array.from(this.tasks.keys());
  }
}

// Event emitter with async support
export class AsyncEventEmitter {
  private listeners: Map<string, AsyncEventListener[]> = new Map();
  private maxListeners: number = 10;
  
  on(event: string, listener: AsyncEventListener): void {
    const eventListeners = this.listeners.get(event) || [];
    
    if (eventListeners.length >= this.maxListeners) {
      console.warn(`Max listeners (${this.maxListeners}) exceeded for event: ${event}`);
    }
    
    eventListeners.push(listener);
    this.listeners.set(event, eventListeners);
  }
  
  once(event: string, listener: AsyncEventListener): void {
    const onceWrapper: AsyncEventListener = async (...args) => {
      this.off(event, onceWrapper);
      await listener(...args);
    };
    
    this.on(event, onceWrapper);
  }
  
  off(event: string, listener: AsyncEventListener): void {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners) return;
    
    const index = eventListeners.indexOf(listener);
    if (index > -1) {
      eventListeners.splice(index, 1);
    }
    
    if (eventListeners.length === 0) {
      this.listeners.delete(event);
    }
  }
  
  async emit(event: string, ...args: any[]): Promise<void> {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners || eventListeners.length === 0) {
      return;
    }
    
    // Execute all listeners concurrently
    const promises = eventListeners.map(listener => 
      this.executeListener(listener, args)
    );
    
    await Promise.all(promises);
  }
  
  async emitSerial(event: string, ...args: any[]): Promise<void> {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners || eventListeners.length === 0) {
      return;
    }
    
    // Execute listeners sequentially
    for (const listener of eventListeners) {
      await this.executeListener(listener, args);
    }
  }
  
  private async executeListener(
    listener: AsyncEventListener,
    args: any[]
  ): Promise<void> {
    try {
      await listener(...args);
    } catch (error) {
      console.error('Event listener error:', error);
      // Don't let one listener failure stop others
    }
  }
  
  setMaxListeners(max: number): void {
    this.maxListeners = max;
  }
  
  listenerCount(event: string): number {
    return this.listeners.get(event)?.length || 0;
  }
  
  eventNames(): string[] {
    return Array.from(this.listeners.keys());
  }
}

// Practical examples of async patterns in services
export class UserService {
  constructor(
    private userRepository: UserRepository,
    private emailService: EmailService,
    private logger: Logger
  ) {}
  
  /**
   * Bulk user creation with controlled concurrency
   * Prevents overwhelming the database
   */
  async createUsersBatch(
    userRequests: CreateUserRequest[],
    options: { concurrency?: number; batchSize?: number } = {}
  ): Promise<BatchResult<User>> {
    const { concurrency = 5, batchSize = 100 } = options;
    
    const result: BatchResult<User> = {
      successful: [],
      failed: [],
      summary: {
        total: userRequests.length,
        successCount: 0,
        failureCount: 0
      }
    };
    
    // Process in batches to avoid memory issues
    await PromiseUtils.inBatches(
      userRequests,
      async (batch, batchIndex) => {
        this.logger.info(`Processing batch ${batchIndex + 1}`, {
          batchSize: batch.length,
          totalBatches: Math.ceil(userRequests.length / batchSize)
        });
        
        // Process each batch with controlled concurrency
        const batchResults = await PromiseUtils.withConcurrency(
          batch,
          async (request, index) => {
            try {
              const user = await this.createUser(request);
              return { success: true, data: user, index };
            } catch (error) {
              return { 
                success: false, 
                error: error as Error, 
                request, 
                index 
              };
            }
          },
          concurrency
        );
        
        // Aggregate results
        batchResults.forEach(batchResult => {
          if (batchResult.success) {
            result.successful.push(batchResult.data);
            result.summary.successCount++;
          } else {
            result.failed.push({
              request: batchResult.request,
              error: batchResult.error.message,
              index: batchResult.index
            });
            result.summary.failureCount++;
          }
        });
        
        return []; // Return empty array as we're aggregating manually
      },
      batchSize
    );
    
    this.logger.info('Bulk user creation completed', result.summary);
    return result;
  }
  
  /**
   * User search with caching and fallback
   */
  async searchUsers(
    query: string,
    options: SearchOptions = {}
  ): Promise<User[]> {
    const cacheKey = `user_search:${query}:${JSON.stringify(options)}`;
    
    // Try cache first (fast path)
    try {
      const cached = await this.getCachedResult(cacheKey);
      if (cached) {
        this.logger.debug('Cache hit for user search', { query });
        return cached;
      }
    } catch (error) {
      this.logger.warn('Cache lookup failed', { error: error.message });
    }
    
    // Fallback to database search with timeout and retry
    const users = await PromiseUtils.withTimeout(
      PromiseUtils.withRetry(
        () => this.userRepository.search(query, options),
        {
          maxAttempts: 3,
          shouldRetry: (error) => error.message.includes('timeout'),
          onRetry: (error, attempt) => {
            this.logger.warn(`Search retry ${attempt}`, { 
              query, 
              error: error.message 
            });
          }
        }
      ),
      10000, // 10 second timeout
      'User search timed out'
    );
    
    // Cache successful results (fire and forget)
    this.cacheResult(cacheKey, users, 300000) // 5 minutes
      .catch(error => {
        this.logger.warn('Failed to cache search results', { 
          error: error.message 
        });
      });
    
    return users;
  }
  
  /**
   * Email verification with exponential backoff
   */
  async sendVerificationEmail(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    if (user.emailVerified) {
      return; // Already verified
    }
    
    await PromiseUtils.withRetry(
      async () => {
        const token = this.generateVerificationToken(userId);
        await this.emailService.sendVerificationEmail(user.email, token);
        
        // Update user with verification token and timestamp
        await this.userRepository.update(userId, {
          verificationToken: token,
          verificationSentAt: new Date()
        });
      },
      {
        maxAttempts: 5,
        baseDelay: 1000,
        maxDelay: 30000,
        shouldRetry: (error) => {
          // Retry on transient errors, not on validation errors
          return !error.message.includes('invalid email');
        },
        onRetry: (error, attempt) => {
          this.logger.warn(`Email send retry ${attempt}`, {
            userId,
            email: user.email,
            error: error.message
          });
        }
      }
    );
    
    this.logger.info('Verification email sent', { userId, email: user.email });
  }
  
  /**
   * Background task for cleaning up inactive users
   */
  async cleanupInactiveUsers(): Promise<void> {
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days
    
    let processedCount = 0;
    let deletedCount = 0;
    
    // Stream processing for large datasets
    await this.userRepository.streamInactiveUsers(
      cutoffDate,
      async (users: User[]) => {
        const deletePromises = users.map(async (user) => {
          try {
            // Soft delete first
            await this.userRepository.update(user.id, {
              deletedAt: new Date(),
              isDeleted: true
            });
            
            // Clean up related data
            await this.cleanupUserData(user.id);
            
            deletedCount++;
          } catch (error) {
            this.logger.error('Failed to cleanup user', {
              userId: user.id,
              error: error.message
            });
          }
        });
        
        await Promise.all(deletePromises);
        processedCount += users.length;
        
        this.logger.info('Cleanup batch processed', {
          processed: processedCount,
          deleted: deletedCount
        });
      }
    );
    
    this.logger.info('Inactive user cleanup completed', {
      totalProcessed: processedCount,
      totalDeleted: deletedCount
    });
  }
  
  private async createUser(request: CreateUserRequest): Promise<User> {
    // Implementation would go here
    return {} as User;
  }
  
  private async getCachedResult(key: string): Promise<User[] | null> {
    // Implementation would go here
    return null;
  }
  
  private async cacheResult(key: string, data: User[], ttl: number): Promise<void> {
    // Implementation would go here
  }
  
  private generateVerificationToken(userId: string): string {
    return `token_${userId}_${Date.now()}`;
  }
  
  private async cleanupUserData(userId: string): Promise<void> {
    // Implementation would go here
  }
}

// Real-world example: Order processing service
export class OrderProcessingService {
  private circuitBreaker: CircuitBreaker;
  private rateLimiter: RateLimiter;
  
  constructor(
    private paymentService: PaymentService,
    private inventoryService: InventoryService,
    private emailService: EmailService,
    private logger: Logger
  ) {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 10000
    }, logger);
    
    this.rateLimiter = new RateLimiter(100, 10); // 10 requests per second
  }
  
  /**
   * Process multiple orders with proper error handling and concurrency control
   */
  async processOrders(orders: Order[]): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    
    // Group orders by priority
    const priorityOrders = orders.filter(o => o.priority === 'high');
    const regularOrders = orders.filter(o => o.priority !== 'high');
    
    // Process priority orders first with higher concurrency
    if (priorityOrders.length > 0) {
      const priorityResults = await this.processOrderBatch(priorityOrders, 10);
      results.push(...priorityResults);
    }
    
    // Process regular orders with normal concurrency
    if (regularOrders.length > 0) {
      const regularResults = await this.processOrderBatch(regularOrders, 5);
      results.push(...regularResults);
    }
    
    // Generate summary report
    const summary = this.generateProcessingSummary(results);
    this.logger.info('Order processing completed', summary);
    
    return results;
  }
  
  private async processOrderBatch(
    orders: Order[],
    concurrency: number
  ): Promise<ProcessingResult[]> {
    return await PromiseUtils.withConcurrency(
      orders,
      async (order) => {
        // Rate limiting to prevent overwhelming external services
        await this.rateLimiter.acquire();
        
        try {
          return await this.processOrder(order);
        } catch (error) {
          this.logger.error('Order processing failed', {
            orderId: order.id,
            error: error.message
          });
          
          return {
            orderId: order.id,
            success: false,
            error: error.message,
            timestamp: new Date()
          };
        }
      },
      concurrency
    );
  }
  
  private async processOrder(order: Order): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      // Step 1: Validate inventory (with circuit breaker)
      await this.circuitBreaker.execute(
        () => this.inventoryService.reserveItems(order.items),
        () => this.handleInventoryFallback(order)
      );
      
      // Step 2: Process payment (with retry)
      const paymentResult = await PromiseUtils.withRetry(
        () => this.paymentService.processPayment(order.payment),
        {
          maxAttempts: 3,
          shouldRetry: (error) => error.message.includes('temporary'),
          onRetry: (error, attempt) => {
            this.logger.warn(`Payment retry ${attempt}`, {
              orderId: order.id,
              error: error.message
            });
          }
        }
      );
      
      // Step 3: Send confirmation email (non-blocking)
      this.sendOrderConfirmation(order, paymentResult)
        .catch(error => {
          this.logger.error('Failed to send order confirmation', {
            orderId: order.id,
            error: error.message
          });
        });
      
      const processingTime = Date.now() - startTime;
      
      return {
        orderId: order.id,
        success: true,
        paymentId: paymentResult.id,
        processingTimeMs: processingTime,
        timestamp: new Date()
      };
      
    } catch (error) {
      // Compensating actions on failure
      await this.handleOrderFailure(order, error as Error);
      
      throw error;
    }
  }
  
  private async handleInventoryFallback(order: Order): Promise<void> {
    // Fallback logic when inventory service is down
    this.logger.warn('Using inventory fallback', { orderId: order.id });
    
    // Could implement local cache check or alternative logic
    throw new Error('Inventory service unavailable');
  }
  
  private async handleOrderFailure(order: Order, error: Error): Promise<void> {
    try {
      // Release any reserved inventory
      await this.inventoryService.releaseReservation(order.id);
      
      // Cancel any partial payments
      if (order.payment.transactionId) {
        await this.paymentService.cancelPayment(order.payment.transactionId);
      }
      
      this.logger.info('Order failure cleanup completed', {
        orderId: order.id,
        error: error.message
      });
    } catch (cleanupError) {
      this.logger.error('Order failure cleanup failed', {
        orderId: order.id,
        originalError: error.message,
        cleanupError: cleanupError.message
      });
    }
  }
  
  private async sendOrderConfirmation(
    order: Order,
    paymentResult: PaymentResult
  ): Promise<void> {
    await this.emailService.sendOrderConfirmation({
      orderId: order.id,
      customerEmail: order.customerEmail,
      items: order.items,
      total: order.total,
      paymentId: paymentResult.id
    });
  }
  
  private generateProcessingSummary(results: ProcessingResult[]): ProcessingSummary {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    return {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      averageProcessingTime: successful.length > 0 
        ? successful.reduce((sum, r) => sum + (r.processingTimeMs || 0), 0) / successful.length
        : 0,
      errors: failed.map(r => r.error).filter(Boolean)
    };
  }
}

/**
 * Benefits of these async patterns:
 * 
 * 1. CONCURRENCY CONTROL:
 *    - Prevents overwhelming external services
 *    - Controlled resource usage
 *    - Better error isolation
 * 
 * 2. RESILIENCE:
 *    - Circuit breaker for fault tolerance
 *    - Retry with exponential backoff
 *    - Graceful degradation with fallbacks
 * 
 * 3. PERFORMANCE:
 *    - Batch processing for efficiency
 *    - Rate limiting to prevent throttling
 *    - Concurrent execution where appropriate
 * 
 * 4. RELIABILITY:
 *    - Proper error handling and logging
 *    - Compensating actions on failure
 *    - Timeouts to prevent hanging
 * 
 * 5. OBSERVABILITY:
 *    - Comprehensive logging
 *    - Performance metrics
 *    - Progress tracking
 * 
 * 6. MAINTAINABILITY:
 *    - Reusable utility functions
 *    - Clear separation of concerns
 *    - Testable components
 */

// Type definitions
interface Logger {
  debug(message: string, context?: any): void;
  info(message: string, context?: any): void;
  warn(message: string, context?: any): void;
  error(message: string, context?: any): void;
}

interface ScheduledTask {
  id: string;
  task: () => Promise<void>;
  options: {
    interval: number;
    delay: number;
    maxRetries: number;
    onError?: (error: Error, retryCount: number) => void;
    onComplete?: () => void;
  };
  retryCount: number;
  isRunning: boolean;
}

type AsyncEventListener = (...args: any[]) => Promise<void>;

interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
}

interface BatchResult<T> {
  successful: T[];
  failed: Array<{
    request: any;
    error: string;
    index: number;
  }>;
  summary: {
    total: number;
    successCount: number;
    failureCount: number;
  };
}

interface SearchOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  filters?: Record<string, any>;
}

interface Order {
  id: string;
  items: OrderItem[];
  payment: PaymentInfo;
  priority?: 'high' | 'normal';
  customerEmail: string;
  total: number;
}

interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

interface PaymentInfo {
  transactionId?: string;
  amount: number;
  currency: string;
}

interface PaymentResult {
  id: string;
  status: string;
  transactionId: string;
}

interface ProcessingResult {
  orderId: string;
  success: boolean;
  error?: string;
  paymentId?: string;
  processingTimeMs?: number;
  timestamp: Date;
}

interface ProcessingSummary {
  total: number;
  successful: number;
  failed: number;
  averageProcessingTime: number;
  errors: string[];
}

// Service interfaces
interface UserRepository {
  findById(id: string): Promise<User | null>;
  update(id: string, data: Partial<User>): Promise<User>;
  search(query: string, options: SearchOptions): Promise<User[]>;
  streamInactiveUsers(cutoffDate: Date, callback: (users: User[]) => Promise<void>): Promise<void>;
}

interface EmailService {
  sendVerificationEmail(email: string, token: string): Promise<void>;
  sendOrderConfirmation(data: any): Promise<void>;
}

interface PaymentService {
  processPayment(payment: PaymentInfo): Promise<PaymentResult>;
  cancelPayment(transactionId: string): Promise<void>;
}

interface InventoryService {
  reserveItems(items: OrderItem[]): Promise<void>;
  releaseReservation(orderId: string): Promise<void>;
}