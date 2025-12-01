/**
 * AFTER: Proper Service Design with Meaningful Abstractions
 *
 * This demonstrates how to replace unnecessary wrappers with well-designed services
 * that add real value through proper abstraction and domain-specific functionality.
 */

//  AFTER: Repository pattern with domain-specific operations
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findActiveUsers(limit?: number): Promise<User[]>;
  create(userData: CreateUserData): Promise<User>;
  update(id: string, data: UpdateUserData): Promise<User>;
  delete(id: string): Promise<void>;
  findUsersByRole(role: UserRole): Promise<User[]>;
}

export class PrismaUserRepository implements UserRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findActiveUsers(limit = 100): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { isActive: true },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userData: CreateUserData): Promise<User> {
    return this.prisma.user.create({
      data: userData,
      include: { profile: true },
    });
  }

  async update(id: string, data: UpdateUserData): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
      include: { profile: true },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  async findUsersByRole(role: UserRole): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { role },
      include: { profile: true },
    });
  }
}

//  AFTER: HTTP client with domain-specific methods and proper error handling
export class ApiClient {
  constructor(
    private httpClient: HttpClient,
    private config: { baseUrl: string; timeout: number; retries: number }
  ) {}

  // Domain-specific methods that add real value
  async getUser(id: string): Promise<User> {
    const response = await this.makeRequest<User>('GET', `/users/${id}`);
    return response.data;
  }

  async createUser(userData: CreateUserRequest): Promise<User> {
    const response = await this.makeRequest<User>('POST', '/users', userData);
    return response.data;
  }

  async updateUser(id: string, data: UpdateUserRequest): Promise<User> {
    const response = await this.makeRequest<User>('PUT', `/users/${id}`, data);
    return response.data;
  }

  async getUserOrders(
    userId: string,
    pagination?: PaginationRequest
  ): Promise<PaginatedResponse<Order>> {
    const params = pagination
      ? `?page=${pagination.page}&limit=${pagination.limit}`
      : '';
    const response = await this.makeRequest<PaginatedResponse<Order>>(
      'GET',
      `/users/${userId}/orders${params}`
    );
    return response.data;
  }

  // Private helper that adds retry logic, error handling, and logging
  private async makeRequest<T>(
    method: HttpMethod,
    path: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.baseUrl}${path}`;
    const requestOptions = {
      timeout: this.config.timeout,
      ...options,
    };

    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
        const response = await this.httpClient.request<T>({
          method,
          url,
          data,
          ...requestOptions,
        });

        return {
          success: true,
          data: response.data,
          status: response.status,
          headers: response.headers,
        };
      } catch (error) {
        lastError = error;

        if (attempt === this.config.retries || !this.isRetryableError(error)) {
          break;
        }

        await this.delay(attempt * 1000); // Exponential backoff
      }
    }

    throw new ApiError(
      `Request failed after ${this.config.retries} attempts`,
      lastError.status,
      lastError.response?.data
    );
  }

  private isRetryableError(error: any): boolean {
    return (
      error.status >= 500 ||
      error.code === 'TIMEOUT' ||
      error.code === 'NETWORK_ERROR'
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

//  AFTER: Domain service with real business logic and composition
export class UserService {
  constructor(
    private userRepository: UserRepository,
    private emailService: EmailService,
    private eventBus: EventBus,
    private validator: UserValidator,
    private auditLogger: AuditLogger
  ) {}

  async createUser(userData: CreateUserRequest): Promise<User> {
    // Centralized validation
    await this.validator.validateCreateRequest(userData);

    // Check business rules
    const existingUser = await this.userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new BusinessError(
        'User with this email already exists',
        'DUPLICATE_EMAIL'
      );
    }

    // Create user with proper data transformation
    const userToCreate: CreateUserData = {
      ...userData,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const user = await this.userRepository.create(userToCreate);

    // Compose side effects without blocking
    this.handleUserCreated(user).catch(error => {
      console.error('Error in user creation side effects:', error);
    });

    return user;
  }

  async updateUser(id: string, data: UpdateUserRequest): Promise<User> {
    await this.validator.validateUpdateRequest(data);

    const existingUser = await this.userRepository.findById(id);
    if (!existingUser) {
      throw new NotFoundError('User not found');
    }

    const updatedUser = await this.userRepository.update(id, {
      ...data,
      updatedAt: new Date(),
    });

    // Emit domain event
    this.eventBus.emit('user.updated', {
      userId: id,
      previousData: existingUser,
      newData: updatedUser,
      changedFields: this.getChangedFields(existingUser, data),
    });

    return updatedUser;
  }

  async deactivateUser(id: string, reason: string): Promise<void> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (!user.isActive) {
      return; // Already deactivated
    }

    await this.userRepository.update(id, {
      isActive: false,
      deactivatedAt: new Date(),
      deactivationReason: reason,
    });

    // Handle deactivation side effects
    this.eventBus.emit('user.deactivated', { userId: id, reason });

    await this.auditLogger.log('USER_DEACTIVATED', {
      userId: id,
      reason,
      performedBy: 'system', // This would come from context in real app
    });
  }

  // Private method to handle async side effects
  private async handleUserCreated(user: User): Promise<void> {
    try {
      // Send welcome email
      await this.emailService.sendWelcomeEmail(user);

      // Emit domain event for other services
      this.eventBus.emit('user.created', {
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      // Log audit event
      await this.auditLogger.log('USER_CREATED', {
        userId: user.id,
        email: user.email,
        role: user.role,
      });
    } catch (error) {
      // Log but don't fail the main operation
      console.error('User creation side effects failed:', error);
    }
  }

  private getChangedFields(
    original: User,
    updates: UpdateUserRequest
  ): string[] {
    const changed: string[] = [];
    for (const [key, value] of Object.entries(updates)) {
      if (original[key] !== value) {
        changed.push(key);
      }
    }
    return changed;
  }
}

//  AFTER: Configuration service with typed, grouped settings
export interface AppConfig {
  database: DatabaseConfig;
  redis: RedisConfig;
  api: ApiConfig;
  auth: AuthConfig;
  email: EmailConfig;
  storage: StorageConfig;
  logging: LoggingConfig;
}

export interface DatabaseConfig {
  url: string;
  maxConnections: number;
  ssl: boolean;
  timeout: number;
}

export interface ApiConfig {
  port: number;
  host: string;
  corsOrigins: string[];
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
}

export class ConfigService {
  private config: AppConfig;

  constructor(private configProvider: ConfigProvider) {
    this.config = this.loadAndValidateConfig();
  }

  get database(): DatabaseConfig {
    return this.config.database;
  }

  get redis(): RedisConfig {
    return this.config.redis;
  }

  get api(): ApiConfig {
    return this.config.api;
  }

  get auth(): AuthConfig {
    return this.config.auth;
  }

  get email(): EmailConfig {
    return this.config.email;
  }

  get storage(): StorageConfig {
    return this.config.storage;
  }

  get logging(): LoggingConfig {
    return this.config.logging;
  }

  isProduction(): boolean {
    return this.configProvider.get('NODE_ENV') === 'production';
  }

  isDevelopment(): boolean {
    return this.configProvider.get('NODE_ENV') === 'development';
  }

  getEnvironment(): string {
    return this.configProvider.get('NODE_ENV') || 'development';
  }

  private loadAndValidateConfig(): AppConfig {
    try {
      return {
        database: {
          url: this.getRequiredString('DATABASE_URL'),
          maxConnections: this.getNumber('DB_MAX_CONNECTIONS', 10),
          ssl: this.getBoolean('DB_SSL', false),
          timeout: this.getNumber('DB_TIMEOUT', 30000),
        },
        redis: {
          url: this.getString('REDIS_URL', 'redis://localhost:6379'),
          keyPrefix: this.getString('REDIS_KEY_PREFIX', 'app:'),
          ttl: this.getNumber('REDIS_DEFAULT_TTL', 3600),
        },
        api: {
          port: this.getNumber('PORT', 3000),
          host: this.getString('HOST', '0.0.0.0'),
          corsOrigins: this.getStringArray('CORS_ORIGINS', [
            'http://localhost:3000',
          ]),
          rateLimit: {
            windowMs: this.getNumber('RATE_LIMIT_WINDOW_MS', 900000),
            maxRequests: this.getNumber('RATE_LIMIT_MAX_REQUESTS', 100),
          },
        },
        auth: {
          jwtSecret: this.getRequiredString('JWT_SECRET'),
          jwtExpiresIn: this.getString('JWT_EXPIRES_IN', '24h'),
          bcryptRounds: this.getNumber('BCRYPT_ROUNDS', 12),
        },
        email: {
          apiKey: this.getRequiredString('EMAIL_API_KEY'),
          fromAddress: this.getRequiredString('EMAIL_FROM_ADDRESS'),
          replyToAddress: this.getString('EMAIL_REPLY_TO'),
        },
        storage: {
          s3Bucket: this.getRequiredString('S3_BUCKET'),
          s3Region: this.getString('S3_REGION', 'us-east-1'),
          uploadMaxSize: this.getNumber('UPLOAD_MAX_SIZE', 10485760), // 10MB
        },
        logging: {
          level: this.getString('LOG_LEVEL', 'info'),
          format: this.getString('LOG_FORMAT', 'json'),
          enableConsole: this.getBoolean('LOG_ENABLE_CONSOLE', true),
          enableFile: this.getBoolean('LOG_ENABLE_FILE', false),
        },
      };
    } catch (error) {
      throw new ConfigurationError(
        `Failed to load configuration: ${error.message}`
      );
    }
  }

  private getRequiredString(key: string): string {
    const value = this.configProvider.get(key);
    if (!value) {
      throw new Error(`Required configuration ${key} is missing`);
    }
    return value;
  }

  private getString(key: string, defaultValue?: string): string {
    return this.configProvider.get(key) || defaultValue;
  }

  private getNumber(key: string, defaultValue?: number): number {
    const value = this.configProvider.get(key);
    if (value === undefined) return defaultValue;
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      throw new Error(`Configuration ${key} must be a number, got: ${value}`);
    }
    return num;
  }

  private getBoolean(key: string, defaultValue?: boolean): boolean {
    const value = this.configProvider.get(key);
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true';
  }

  private getStringArray(key: string, defaultValue?: string[]): string[] {
    const value = this.configProvider.get(key);
    if (!value) return defaultValue || [];
    return value.split(',').map(s => s.trim());
  }
}

//  AFTER: Structured logging with proper context and performance
export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
  child(context: LogContext): Logger;
}

export interface LogContext {
  [key: string]: any;
  userId?: string;
  requestId?: string;
  operation?: string;
  duration?: number;
}

export class StructuredLogger implements Logger {
  constructor(
    private logger: UnderlyingLogger,
    private defaultContext: LogContext = {}
  ) {}

  debug(message: string, context: LogContext = {}): void {
    this.log('debug', message, context);
  }

  info(message: string, context: LogContext = {}): void {
    this.log('info', message, context);
  }

  warn(message: string, context: LogContext = {}): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context: LogContext = {}): void {
    const errorContext = error
      ? {
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
          },
        }
      : {};

    this.log('error', message, { ...context, ...errorContext });
  }

  child(context: LogContext): Logger {
    return new StructuredLogger(this.logger, {
      ...this.defaultContext,
      ...context,
    });
  }

  // Performance logging helper
  time<T>(operation: string, fn: () => T | Promise<T>): T | Promise<T> {
    const start = Date.now();

    const logCompletion = (success: boolean, error?: Error) => {
      const duration = Date.now() - start;
      const level = success ? 'info' : 'error';
      const message = `Operation ${operation} ${success ? 'completed' : 'failed'}`;

      if (success) {
        this.log(level, message, { operation, duration });
      } else {
        this.error(message, error, { operation, duration });
      }
    };

    try {
      const result = fn();

      if (result instanceof Promise) {
        return result
          .then(value => {
            logCompletion(true);
            return value;
          })
          .catch(error => {
            logCompletion(false, error);
            throw error;
          });
      } else {
        logCompletion(true);
        return result;
      }
    } catch (error) {
      logCompletion(false, error);
      throw error;
    }
  }

  private log(level: string, message: string, context: LogContext): void {
    this.logger[level]({
      message,
      timestamp: new Date().toISOString(),
      level,
      ...this.defaultContext,
      ...context,
    });
  }
}

//  AFTER: Event bus with proper typing and error handling
export interface DomainEvent {
  type: string;
  payload: any;
  timestamp: Date;
  eventId: string;
  aggregateId?: string;
  version?: number;
}

export interface EventHandler<T = any> {
  handle(event: DomainEvent<T>): Promise<void> | void;
}

export class EventBus {
  private handlers = new Map<string, EventHandler[]>();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child({ component: 'EventBus' });
  }

  subscribe<T>(eventType: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);

    this.logger.debug('Event handler registered', {
      eventType,
      handlerCount: this.handlers.get(eventType)!.length,
    });
  }

  async emit<T>(eventType: string, payload: T): Promise<void> {
    const event: DomainEvent<T> = {
      type: eventType,
      payload,
      timestamp: new Date(),
      eventId: this.generateEventId(),
    };

    this.logger.debug('Emitting event', {
      eventType,
      eventId: event.eventId,
      payloadKeys: payload ? Object.keys(payload) : [],
    });

    const handlers = this.handlers.get(eventType) || [];

    if (handlers.length === 0) {
      this.logger.warn('No handlers registered for event', { eventType });
      return;
    }

    // Process handlers in parallel, but don't let one failure stop others
    const results = await Promise.allSettled(
      handlers.map(handler => this.executeHandler(handler, event))
    );

    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length > 0) {
      this.logger.error('Some event handlers failed', {
        eventType,
        eventId: event.eventId,
        failureCount: failures.length,
        totalHandlers: handlers.length,
      });
    }
  }

  private async executeHandler(
    handler: EventHandler,
    event: DomainEvent
  ): Promise<void> {
    try {
      await handler.handle(event);
    } catch (error) {
      this.logger.error('Event handler failed', error, {
        eventType: event.type,
        eventId: event.eventId,
        handlerName: handler.constructor.name,
      });
      throw error; // Re-throw so Promise.allSettled catches it
    }
  }

  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}

//  AFTER: Cache service with domain-specific operations and proper error handling
export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  invalidatePattern(pattern: string): Promise<void>;
}

export class RedisCacheService implements CacheService {
  constructor(
    private redis: RedisClient,
    private config: { keyPrefix: string; defaultTtl: number },
    private logger: Logger
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.getFullKey(key);

    try {
      const value = await this.redis.get(fullKey);
      if (value === null) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error('Cache get failed', error, { key });
      return null; // Graceful degradation
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const fullKey = this.getFullKey(key);
    const serialized = JSON.stringify(value);
    const ttlToUse = ttl || this.config.defaultTtl;

    try {
      await this.redis.setex(fullKey, ttlToUse, serialized);
    } catch (error) {
      this.logger.error('Cache set failed', error, { key, ttl: ttlToUse });
      throw error; // Don't degrade silently for writes
    }
  }

  async delete(key: string): Promise<void> {
    const fullKey = this.getFullKey(key);

    try {
      await this.redis.del(fullKey);
    } catch (error) {
      this.logger.error('Cache delete failed', error, { key });
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);

    try {
      const result = await this.redis.exists(fullKey);
      return result === 1;
    } catch (error) {
      this.logger.error('Cache exists check failed', error, { key });
      return false; // Graceful degradation
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const fullPattern = this.getFullKey(pattern);

    try {
      const keys = await this.redis.keys(fullPattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.info('Cache pattern invalidated', {
          pattern,
          keysDeleted: keys.length,
        });
      }
    } catch (error) {
      this.logger.error('Cache pattern invalidation failed', error, {
        pattern,
      });
      throw error;
    }
  }

  // Cache-aside pattern helpers
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    let value = await this.get<T>(key);

    if (value === null) {
      this.logger.debug('Cache miss, executing factory', { key });
      value = await factory();
      await this.set(key, value, ttl);
    } else {
      this.logger.debug('Cache hit', { key });
    }

    return value;
  }

  private getFullKey(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }
}

//  AFTER: Example usage showing clean, composable design
export class UserController {
  constructor(
    private userService: UserService,
    private logger: Logger,
    private cacheService: CacheService
  ) {
    this.logger = logger.child({ component: 'UserController' });
  }

  async createUser(request: CreateUserRequest): Promise<ApiResponse<User>> {
    return this.logger.time('createUser', async () => {
      try {
        this.logger.info('Creating user', { email: request.email });

        const user = await this.userService.createUser(request);

        // Cache the new user
        await this.cacheService.set(`user:${user.id}`, user, 3600);

        this.logger.info('User created successfully', { userId: user.id });

        return {
          success: true,
          data: user,
          timestamp: new Date(),
        };
      } catch (error) {
        this.logger.error('User creation failed', error, {
          email: request.email,
        });

        throw new ApiError(
          'Failed to create user',
          error instanceof BusinessError ? 400 : 500,
          error.message
        );
      }
    });
  }

  async getUser(id: string): Promise<ApiResponse<User>> {
    return this.logger.time('getUser', async () => {
      try {
        // Try cache first
        const cachedUser = await this.cacheService.get<User>(`user:${id}`);
        if (cachedUser) {
          this.logger.debug('User found in cache', { userId: id });
          return {
            success: true,
            data: cachedUser,
            timestamp: new Date(),
          };
        }

        // Fallback to service
        const user = await this.userService.findById(id);
        if (!user) {
          throw new NotFoundError('User not found');
        }

        // Cache for next time
        await this.cacheService.set(`user:${id}`, user, 3600);

        return {
          success: true,
          data: user,
          timestamp: new Date(),
        };
      } catch (error) {
        this.logger.error('Failed to get user', error, { userId: id });
        throw error;
      }
    });
  }
}

/**
 * Benefits of this AFTER structure:
 *
 * 1. MEANINGFUL ABSTRACTIONS:
 *    - Each service has a clear, single responsibility
 *    - Domain-specific operations that add real value
 *    - Proper separation of concerns
 *
 * 2. COMPOSITION OVER WRAPPING:
 *    - Services compose well together
 *    - Dependencies injected at boundaries
 *    - Easy to test and mock
 *
 * 3. PROPER ERROR HANDLING:
 *    - Domain-specific error types
 *    - Graceful degradation where appropriate
 *    - Clear error propagation
 *
 * 4. PERFORMANCE OPTIMIZED:
 *    - No unnecessary async operations
 *    - Efficient caching patterns
 *    - Proper resource management
 *
 * 5. DEVELOPER EXPERIENCE:
 *    - Type-safe interfaces
 *    - Consistent patterns across services
 *    - Clear separation of sync/async operations
 *
 * 6. MAINTAINABILITY:
 *    - Single source of truth for each concern
 *    - Easy to extend without breaking existing code
 *    - Clear dependencies and boundaries
 */

/**
 * Key principles applied:
 *
 * 1. Repository Pattern: Clean data access abstraction
 * 2. Domain Services: Business logic in dedicated services
 * 3. Configuration Object: Grouped, typed configuration
 * 4. Structured Logging: Consistent, searchable logs
 * 5. Event Bus: Decoupled communication between services
 * 6. Cache-aside Pattern: Efficient caching with fallback
 * 7. Composition Root: Dependencies injected at app boundaries
 * 8. Interface Segregation: Small, focused interfaces
 */

// Type definitions referenced above
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deactivatedAt?: Date;
  deactivationReason?: string;
}

interface CreateUserData {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
  updatedAt: Date;
  deactivatedAt?: Date;
  deactivationReason?: string;
}

interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role?: UserRole;
}

interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
}

enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  MODERATOR = 'moderator',
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: Date;
}

class BusinessError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'BusinessError';
  }
}

class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
