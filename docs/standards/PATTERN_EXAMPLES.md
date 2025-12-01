# Pattern Examples

## Service Patterns

###  Standard Service Pattern

```typescript
// packages/services/src/base/BaseService.ts
export abstract class BaseService {
  protected logger: Logger;
  private isRunning = false;

  constructor(protected readonly name: string) {
    this.logger = new Logger(name);
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn(`${this.name} is already running`);
      return;
    }

    this.logger.info(`Starting ${this.name}...`);
    await this.onStart();
    this.isRunning = true;
    this.logger.info(`${this.name} started successfully`);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn(`${this.name} is not running`);
      return;
    }

    this.logger.info(`Stopping ${this.name}...`);
    await this.onStop();
    this.isRunning = false;
    this.logger.info(`${this.name} stopped successfully`);
  }

  protected abstract onStart(): Promise<void>;
  protected abstract onStop(): Promise<void>;
}

// packages/services/src/UserService.ts
export class UserService extends BaseService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly eventBus: EventBus,
    private readonly logger: Logger
  ) {
    super('UserService');
  }

  protected async onStart(): Promise<void> {
    await this.userRepository.connect();
    await this.eventBus.subscribe('user.*', this.handleUserEvents);
  }

  protected async onStop(): Promise<void> {
    await this.eventBus.unsubscribe('user.*');
    await this.userRepository.disconnect();
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundError('User', id);
    }

    this.logger.info('User retrieved', { userId: id });
    await this.eventBus.emit('user.retrieved', { userId: id });

    return user;
  }

  async create(userData: CreateUserRequest): Promise<User> {
    // Validation
    await this.validateUserData(userData);

    // Business logic
    const user = await this.userRepository.create({
      ...userData,
      id: generateId(),
      createdAt: new Date(),
      status: UserStatus.ACTIVE,
    });

    // Events
    await this.eventBus.emit('user.created', { userId: user.id });

    this.logger.info('User created', { userId: user.id });

    return user;
  }

  private async validateUserData(data: CreateUserRequest): Promise<void> {
    if (!isValidEmail(data.email)) {
      throw new ValidationError('Invalid email format', ['email']);
    }

    if (await this.userRepository.existsByEmail(data.email)) {
      throw new ConflictError('User with this email already exists');
    }
  }

  private handleUserEvents = async (event: UserEvent) => {
    // Handle user-related events
    this.logger.debug('Handling user event', { event: event.type });
  };
}
```

### L Anti-Pattern: Wrapper Service

```typescript
// DON'T DO THIS
export class EnhancedUserService {
  constructor(private userService: UserService) {}

  async getUser(id: string) {
    // Just forwarding - no value added
    return this.userService.findById(id);
  }

  async createUser(data: any) {
    // Just forwarding - no value added
    return this.userService.create(data);
  }
}
```

## Repository Patterns

###  Standard Repository Pattern

```typescript
// packages/repositories/src/base/BaseRepository.ts
export abstract class BaseRepository<T extends { id: string }> {
  protected logger: Logger;

  constructor(
    protected readonly tableName: string,
    protected readonly db: Database
  ) {
    this.logger = new Logger(`${this.constructor.name}`);
  }

  async findById(id: string): Promise<T | null> {
    try {
      const result = await this.db.query(`SELECT * FROM ${this.tableName} WHERE id = ?`, [id]);

      return result.length > 0 ? this.mapFromDb(result[0]) : null;
    } catch (error) {
      this.logger.error('Failed to find by ID', { id, error });
      throw new DatabaseError(`Failed to find ${this.tableName} by ID`);
    }
  }

  async findAll(options: FindOptions = {}): Promise<T[]> {
    const { limit = 100, offset = 0, orderBy = 'createdAt', order = 'DESC' } = options;

    try {
      const results = await this.db.query(
        `SELECT * FROM ${this.tableName} 
         ORDER BY ${orderBy} ${order} 
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );

      return results.map(row => this.mapFromDb(row));
    } catch (error) {
      this.logger.error('Failed to find all', { options, error });
      throw new DatabaseError(`Failed to find ${this.tableName} records`);
    }
  }

  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const now = new Date();
    const record = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    } as T;

    try {
      await this.db.query(
        `INSERT INTO ${this.tableName} (${this.getInsertColumns()}) VALUES (${this.getInsertPlaceholders()})`,
        this.getInsertValues(record)
      );

      return record;
    } catch (error) {
      this.logger.error('Failed to create', { data, error });
      throw new DatabaseError(`Failed to create ${this.tableName} record`);
    }
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundError(this.tableName, id);
    }

    const updated = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };

    try {
      await this.db.query(`UPDATE ${this.tableName} SET ${this.getUpdateClause()} WHERE id = ?`, [
        ...this.getUpdateValues(updated),
        id,
      ]);

      return updated;
    } catch (error) {
      this.logger.error('Failed to update', { id, data, error });
      throw new DatabaseError(`Failed to update ${this.tableName} record`);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const result = await this.db.query(`DELETE FROM ${this.tableName} WHERE id = ?`, [id]);

      if (result.affectedRows === 0) {
        throw new NotFoundError(this.tableName, id);
      }
    } catch (error) {
      this.logger.error('Failed to delete', { id, error });
      throw new DatabaseError(`Failed to delete ${this.tableName} record`);
    }
  }

  protected abstract mapFromDb(row: any): T;
  protected abstract getInsertColumns(): string;
  protected abstract getInsertPlaceholders(): string;
  protected abstract getInsertValues(record: T): any[];
  protected abstract getUpdateClause(): string;
  protected abstract getUpdateValues(record: T): any[];
}

// packages/repositories/src/UserRepository.ts
export class UserRepository extends BaseRepository<User> {
  constructor(db: Database) {
    super('users', db);
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const results = await this.db.query('SELECT * FROM users WHERE email = ?', [email]);

      return results.length > 0 ? this.mapFromDb(results[0]) : null;
    } catch (error) {
      this.logger.error('Failed to find by email', { email, error });
      throw new DatabaseError('Failed to find user by email');
    }
  }

  async existsByEmail(email: string): Promise<boolean> {
    try {
      const results = await this.db.query('SELECT COUNT(*) as count FROM users WHERE email = ?', [
        email,
      ]);

      return results[0].count > 0;
    } catch (error) {
      this.logger.error('Failed to check email existence', { email, error });
      throw new DatabaseError('Failed to check email existence');
    }
  }

  protected mapFromDb(row: any): User {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      status: row.status as UserStatus,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  protected getInsertColumns(): string {
    return 'id, email, name, status, created_at, updated_at';
  }

  protected getInsertPlaceholders(): string {
    return '?, ?, ?, ?, ?, ?';
  }

  protected getInsertValues(user: User): any[] {
    return [user.id, user.email, user.name, user.status, user.createdAt, user.updatedAt];
  }

  protected getUpdateClause(): string {
    return 'email = ?, name = ?, status = ?, updated_at = ?';
  }

  protected getUpdateValues(user: User): any[] {
    return [user.email, user.name, user.status, user.updatedAt];
  }
}
```

## Error Handling Patterns

###  Standard Error Classes

```typescript
// packages/errors/src/base/AppError.ts
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;
  readonly isOperational = true;

  constructor(
    message: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.constructor.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
    };
  }
}

// packages/errors/src/ValidationError.ts
export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';

  constructor(
    message: string,
    public readonly fields: string[],
    context?: Record<string, any>
  ) {
    super(message, { ...context, fields });
  }
}

// packages/errors/src/NotFoundError.ts
export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND';

  constructor(resource: string, id: string, context?: Record<string, any>) {
    super(`${resource} with id ${id} not found`, { ...context, resource, id });
  }
}

// packages/errors/src/ConflictError.ts
export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code = 'CONFLICT';

  constructor(message: string, context?: Record<string, any>) {
    super(message, context);
  }
}

// packages/errors/src/DatabaseError.ts
export class DatabaseError extends AppError {
  readonly statusCode = 500;
  readonly code = 'DATABASE_ERROR';

  constructor(message: string, context?: Record<string, any>) {
    super(message, context);
  }
}
```

###  Error Handling in Services

```typescript
export class UserService extends BaseService {
  async findById(id: string): Promise<User> {
    try {
      const user = await this.userRepository.findById(id);
      if (!user) {
        throw new NotFoundError('User', id);
      }
      return user;
    } catch (error) {
      if (error instanceof AppError) {
        // Re-throw known errors
        throw error;
      }

      // Log unexpected errors
      this.logger.error('Unexpected error in findById', { id, error });
      throw new DatabaseError('Failed to retrieve user');
    }
  }

  async create(userData: CreateUserRequest): Promise<User> {
    try {
      // Validate input
      const validationErrors = await this.validateCreateUser(userData);
      if (validationErrors.length > 0) {
        throw new ValidationError(
          'Invalid user data',
          validationErrors.map(e => e.field),
          { validationErrors }
        );
      }

      // Check for conflicts
      if (await this.userRepository.existsByEmail(userData.email)) {
        throw new ConflictError('User with this email already exists', {
          email: userData.email,
        });
      }

      // Create user
      const user = await this.userRepository.create({
        ...userData,
        status: UserStatus.ACTIVE,
      });

      return user;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      this.logger.error('Unexpected error in create', { userData, error });
      throw new DatabaseError('Failed to create user');
    }
  }

  private async validateCreateUser(data: CreateUserRequest): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    if (!data.email || !isValidEmail(data.email)) {
      issues.push({ field: 'email', message: 'Valid email is required' });
    }

    if (!data.name || data.name.trim().length < 2) {
      issues.push({ field: 'name', message: 'Name must be at least 2 characters' });
    }

    return issues;
  }
}
```

## Type Definition Patterns

###  Interface Patterns

```typescript
// packages/core-types/src/User.ts

// Base interface
export interface User {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Request/Response types
export interface CreateUserRequest {
  email: string;
  name: string;
}

export interface UpdateUserRequest {
  name?: string;
  status?: UserStatus;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  createdAt: string; // ISO string for API
  updatedAt: string;
}

// Enums with string values
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  DELETED = 'DELETED',
}

// Union types for specific use cases
export type UserEvent =
  | { type: 'user.created'; payload: { userId: string } }
  | { type: 'user.updated'; payload: { userId: string; changes: Partial<User> } }
  | { type: 'user.deleted'; payload: { userId: string } };

// Utility types
export type UserSummary = Pick<User, 'id' | 'name' | 'email'>;
export type UserUpdate = Partial<Omit<User, 'id' | 'createdAt'>>;
```

### L Anti-Pattern: Mixed Conventions

```typescript
// DON'T DO THIS - Mixed conventions
export interface IUser {
  // L Hungarian notation
  user_id: string; // L Snake case in TypeScript
  userName: string; // L Inconsistent with snake_case above
}

export type UserType = {
  // L Redundant "Type" suffix
  id: any; // L Using 'any' instead of proper types
  name: string; // L Different structure than IUser
};
```

## API Controller Patterns

###  Standard Controller Pattern

```typescript
// apps/api/src/controllers/base/BaseController.ts
export abstract class BaseController {
  protected logger: Logger;

  constructor(protected readonly name: string) {
    this.logger = new Logger(`${name}Controller`);
  }

  protected handleError(error: unknown, req: Request, res: Response): void {
    if (error instanceof AppError) {
      this.logger.warn('Application error', {
        code: error.code,
        message: error.message,
        context: error.context,
        path: req.path,
        method: req.method,
      });

      res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          ...(error.context && { details: error.context }),
        },
      });
      return;
    }

    // Unexpected error
    this.logger.error('Unexpected error', {
      error: error instanceof Error ? error.stack : error,
      path: req.path,
      method: req.method,
    });

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }

  protected validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fields = error.errors.map(e => e.path.join('.'));
        throw new ValidationError('Invalid request data', fields, {
          zodErrors: error.errors,
        });
      }
      throw error;
    }
  }
}

// apps/api/src/controllers/UserController.ts
export class UserController extends BaseController {
  constructor(private readonly userService: UserService) {
    super('User');
  }

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.params.id;

      if (!userId) {
        throw new ValidationError('User ID is required', ['id']);
      }

      const user = await this.userService.findById(userId);

      res.json({
        data: this.mapToResponse(user),
      });
    } catch (error) {
      this.handleError(error, req, res);
    }
  };

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const createUserData = this.validateRequest(CreateUserSchema, req.body);

      const user = await this.userService.create(createUserData);

      res.status(201).json({
        data: this.mapToResponse(user),
      });
    } catch (error) {
      this.handleError(error, req, res);
    }
  };

  update = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.params.id;
      const updateData = this.validateRequest(UpdateUserSchema, req.body);

      if (!userId) {
        throw new ValidationError('User ID is required', ['id']);
      }

      const user = await this.userService.update(userId, updateData);

      res.json({
        data: this.mapToResponse(user),
      });
    } catch (error) {
      this.handleError(error, req, res);
    }
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.params.id;

      if (!userId) {
        throw new ValidationError('User ID is required', ['id']);
      }

      await this.userService.delete(userId);

      res.status(204).send();
    } catch (error) {
      this.handleError(error, req, res);
    }
  };

  private mapToResponse(user: User): UserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}

// Validation schemas
const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
});

const UpdateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  status: z.nativeEnum(UserStatus).optional(),
});
```

## Testing Patterns

###  Service Testing Pattern

```typescript
// packages/services/src/__tests__/UserService.test.ts
describe('UserService', () => {
  let userService: UserService;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockEventBus: jest.Mocked<EventBus>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockUserRepository = {
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      existsByEmail: jest.fn(),
      findByEmail: jest.fn(),
      findAll: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
    } as jest.Mocked<UserRepository>;

    mockEventBus = {
      emit: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    } as jest.Mocked<EventBus>;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as jest.Mocked<Logger>;

    userService = new UserService(mockUserRepository, mockEventBus, mockLogger);
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      // Arrange
      const userId = 'user-123';
      const expectedUser = createMockUser({ id: userId });
      mockUserRepository.findById.mockResolvedValue(expectedUser);

      // Act
      const result = await userService.findById(userId);

      // Assert
      expect(result).toEqual(expectedUser);
      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(mockLogger.info).toHaveBeenCalledWith('User retrieved', { userId });
      expect(mockEventBus.emit).toHaveBeenCalledWith('user.retrieved', { userId });
    });

    it('should throw NotFoundError when user not found', async () => {
      // Arrange
      const userId = 'nonexistent-user';
      mockUserRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(userService.findById(userId)).rejects.toThrow(new NotFoundError('User', userId));
      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
    });

    it('should handle repository errors', async () => {
      // Arrange
      const userId = 'user-123';
      const repositoryError = new Error('Database connection failed');
      mockUserRepository.findById.mockRejectedValue(repositoryError);

      // Act & Assert
      await expect(userService.findById(userId)).rejects.toThrow(DatabaseError);
      expect(mockLogger.error).toHaveBeenCalledWith('Unexpected error in findById', {
        id: userId,
        error: repositoryError,
      });
    });
  });

  describe('create', () => {
    it('should create user successfully', async () => {
      // Arrange
      const createData: CreateUserRequest = {
        email: 'test@example.com',
        name: 'Test User',
      };
      const expectedUser = createMockUser(createData);

      mockUserRepository.existsByEmail.mockResolvedValue(false);
      mockUserRepository.create.mockResolvedValue(expectedUser);

      // Act
      const result = await userService.create(createData);

      // Assert
      expect(result).toEqual(expectedUser);
      expect(mockUserRepository.existsByEmail).toHaveBeenCalledWith(createData.email);
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        ...createData,
        status: UserStatus.ACTIVE,
      });
      expect(mockEventBus.emit).toHaveBeenCalledWith('user.created', { userId: expectedUser.id });
    });

    it('should throw ValidationError for invalid email', async () => {
      // Arrange
      const createData: CreateUserRequest = {
        email: 'invalid-email',
        name: 'Test User',
      };

      // Act & Assert
      await expect(userService.create(createData)).rejects.toThrow(ValidationError);
    });

    it('should throw ConflictError for duplicate email', async () => {
      // Arrange
      const createData: CreateUserRequest = {
        email: 'test@example.com',
        name: 'Test User',
      };

      mockUserRepository.existsByEmail.mockResolvedValue(true);

      // Act & Assert
      await expect(userService.create(createData)).rejects.toThrow(
        new ConflictError('User with this email already exists')
      );
    });
  });
});

// Test utilities
function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    status: UserStatus.ACTIVE,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    ...overrides,
  };
}
```

###  Controller Testing Pattern

```typescript
// apps/api/src/controllers/__tests__/UserController.test.ts
describe('UserController', () => {
  let userController: UserController;
  let mockUserService: jest.Mocked<UserService>;
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    mockUserService = {
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    } as jest.Mocked<UserService>;

    userController = new UserController(mockUserService);

    req = {
      params: {},
      body: {},
      path: '/users',
      method: 'GET',
    };

    res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  describe('getById', () => {
    it('should return user when found', async () => {
      // Arrange
      const userId = 'user-123';
      const user = createMockUser({ id: userId });
      req.params = { id: userId };

      mockUserService.findById.mockResolvedValue(user);

      // Act
      await userController.getById(req as Request, res as Response);

      // Assert
      expect(mockUserService.findById).toHaveBeenCalledWith(userId);
      expect(res.json).toHaveBeenCalledWith({
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          status: user.status,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
      });
    });

    it('should return 404 when user not found', async () => {
      // Arrange
      const userId = 'nonexistent-user';
      req.params = { id: userId };

      mockUserService.findById.mockRejectedValue(new NotFoundError('User', userId));

      // Act
      await userController.getById(req as Request, res as Response);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'NOT_FOUND',
          message: `User with id ${userId} not found`,
          details: { resource: 'User', id: userId },
        },
      });
    });

    it('should return 400 when ID is missing', async () => {
      // Arrange
      req.params = {};

      // Act
      await userController.getById(req as Request, res as Response);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'User ID is required',
          details: { fields: ['id'] },
        },
      });
    });
  });

  describe('create', () => {
    it('should create user successfully', async () => {
      // Arrange
      const createData = {
        email: 'test@example.com',
        name: 'Test User',
      };
      const createdUser = createMockUser(createData);

      req.body = createData;
      mockUserService.create.mockResolvedValue(createdUser);

      // Act
      await userController.create(req as Request, res as Response);

      // Assert
      expect(mockUserService.create).toHaveBeenCalledWith(createData);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: createdUser.id,
          email: createdUser.email,
          name: createdUser.name,
        }),
      });
    });

    it('should return 400 for invalid data', async () => {
      // Arrange
      req.body = {
        email: 'invalid-email',
        name: '',
      };

      // Act
      await userController.create(req as Request, res as Response);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
          }),
        })
      );
    });
  });
});
```

## Configuration Patterns

###  Environment-based Configuration

```typescript
// packages/config/src/index.ts
import { z } from 'zod';

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().min(1).max(65535).default(3000),

  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_MAX_CONNECTIONS: z.coerce.number().min(1).default(10),
  DATABASE_TIMEOUT: z.coerce.number().min(1000).default(30000),

  // Redis
  REDIS_URL: z.string().url(),
  REDIS_KEY_PREFIX: z.string().default('app:'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),

  // Security
  JWT_SECRET: z.string().min(32),
  CORS_ORIGINS: z.string().transform(str => str.split(',')),

  // External Services
  EMAIL_SERVICE_URL: z.string().url().optional(),
  EMAIL_SERVICE_API_KEY: z.string().optional(),

  // Feature Flags
  FEATURE_ANALYTICS: z.coerce.boolean().default(false),
  FEATURE_BETA_FEATURES: z.coerce.boolean().default(false),
});

export type Config = z.infer<typeof ConfigSchema>;

let config: Config;

export function loadConfig(): Config {
  if (config) {
    return config;
  }

  try {
    config = ConfigSchema.parse(process.env);
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingOrInvalid = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      throw new Error(`Configuration validation failed:\n${missingOrInvalid.join('\n')}`);
    }
    throw error;
  }
}

export function getConfig(): Config {
  if (!config) {
    throw new Error('Configuration not loaded. Call loadConfig() first.');
  }
  return config;
}

// Environment-specific defaults
export const environments = {
  development: {
    LOG_LEVEL: 'debug' as const,
    LOG_FORMAT: 'pretty' as const,
    FEATURE_ANALYTICS: false,
    FEATURE_BETA_FEATURES: true,
  },
  staging: {
    LOG_LEVEL: 'info' as const,
    LOG_FORMAT: 'json' as const,
    FEATURE_ANALYTICS: true,
    FEATURE_BETA_FEATURES: true,
  },
  production: {
    LOG_LEVEL: 'warn' as const,
    LOG_FORMAT: 'json' as const,
    FEATURE_ANALYTICS: true,
    FEATURE_BETA_FEATURES: false,
  },
} as const;
```

These patterns demonstrate the "golden standard" approach that should be consistently applied across
the monorepo. Each pattern includes proper error handling, logging, type safety, and follows the
established architectural principles.
