/**
 * GOLDEN PATTERN: Service Design Patterns
 *
 * This file demonstrates best practices for designing services in monorepo environments,
 * including proper separation of concerns, dependency injection, and composable architectures.
 */

// Base interfaces for common service patterns
export interface Repository<T, ID = string> {
  findById(id: ID): Promise<T | null>;
  findAll(options?: QueryOptions): Promise<T[]>;
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  update(id: ID, data: Partial<T>): Promise<T>;
  delete(id: ID): Promise<void>;
}

export interface DomainService<TEntity, TCreateRequest, TUpdateRequest> {
  create(data: TCreateRequest): Promise<TEntity>;
  findById(id: string): Promise<TEntity | null>;
  update(id: string, data: TUpdateRequest): Promise<TEntity>;
  delete(id: string): Promise<void>;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

// Domain entity with proper encapsulation
export class User {
  private constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly role: UserRole,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    private readonly hashedPassword?: string
  ) {}

  // Factory method for creating new users
  static create(userData: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    role?: UserRole;
  }): User {
    const now = new Date();
    return new User(
      generateId(),
      userData.email.toLowerCase().trim(),
      userData.firstName.trim(),
      userData.lastName.trim(),
      userData.role || UserRole.USER,
      true,
      now,
      now,
      hashPassword(userData.password)
    );
  }

  // Factory method for hydrating from database
  static fromDatabase(data: UserDbRecord): User {
    return new User(
      data.id,
      data.email,
      data.firstName,
      data.lastName,
      data.role,
      data.isActive,
      data.createdAt,
      data.updatedAt,
      data.hashedPassword
    );
  }

  // Business methods
  updateProfile(data: { firstName?: string; lastName?: string }): User {
    return new User(
      this.id,
      this.email,
      data.firstName?.trim() || this.firstName,
      data.lastName?.trim() || this.lastName,
      this.role,
      this.isActive,
      this.createdAt,
      new Date(),
      this.hashedPassword
    );
  }

  deactivate(): User {
    if (!this.isActive) {
      throw new BusinessRuleError('User is already deactivated');
    }

    return new User(
      this.id,
      this.email,
      this.firstName,
      this.lastName,
      this.role,
      false,
      this.createdAt,
      new Date(),
      this.hashedPassword
    );
  }

  changeRole(newRole: UserRole): User {
    if (this.role === newRole) {
      return this;
    }

    return new User(
      this.id,
      this.email,
      this.firstName,
      this.lastName,
      newRole,
      this.isActive,
      this.createdAt,
      new Date(),
      this.hashedPassword
    );
  }

  verifyPassword(password: string): boolean {
    return verifyPassword(password, this.hashedPassword || '');
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  get isAdmin(): boolean {
    return this.role === UserRole.ADMIN;
  }

  // Convert to database record
  toDbRecord(): UserDbRecord {
    return {
      id: this.id,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      role: this.role,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      hashedPassword: this.hashedPassword,
    };
  }

  // Convert to API response (excludes sensitive data)
  toApiResponse(): UserApiResponse {
    return {
      id: this.id,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      fullName: this.fullName,
      role: this.role,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

// Repository implementation with proper error handling
export class UserRepository implements Repository<User> {
  constructor(
    private dbClient: DatabaseClient,
    private logger: Logger
  ) {}

  async findById(id: string): Promise<User | null> {
    try {
      const record = await this.dbClient.user.findUnique({
        where: { id },
      });

      return record ? User.fromDatabase(record) : null;
    } catch (error) {
      this.logger.error('Failed to find user by ID', { userId: id, error });
      throw new DatabaseError('find user by ID', error);
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const record = await this.dbClient.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      return record ? User.fromDatabase(record) : null;
    } catch (error) {
      this.logger.error('Failed to find user by email', { email, error });
      throw new DatabaseError('find user by email', error);
    }
  }

  async findAll(options: QueryOptions = {}): Promise<User[]> {
    try {
      const records = await this.dbClient.user.findMany({
        where: options.filters,
        skip: options.offset,
        take: options.limit,
        orderBy: options.sortBy
          ? {
              [options.sortBy]: options.sortOrder || 'asc',
            }
          : undefined,
      });

      return records.map(record => User.fromDatabase(record));
    } catch (error) {
      this.logger.error('Failed to find users', { options, error });
      throw new DatabaseError('find users', error);
    }
  }

  async create(user: User): Promise<User> {
    try {
      const record = await this.dbClient.user.create({
        data: user.toDbRecord(),
      });

      return User.fromDatabase(record);
    } catch (error) {
      if (error.code === 'P2002') {
        // Unique constraint violation
        throw new ConflictError('Email already exists');
      }

      this.logger.error('Failed to create user', { email: user.email, error });
      throw new DatabaseError('create user', error);
    }
  }

  async update(id: string, user: User): Promise<User> {
    try {
      const record = await this.dbClient.user.update({
        where: { id },
        data: user.toDbRecord(),
      });

      return User.fromDatabase(record);
    } catch (error) {
      if (error.code === 'P2025') {
        // Record not found
        throw new NotFoundError('User', id);
      }

      this.logger.error('Failed to update user', { userId: id, error });
      throw new DatabaseError('update user', error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.dbClient.user.delete({
        where: { id },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        // Record not found
        throw new NotFoundError('User', id);
      }

      this.logger.error('Failed to delete user', { userId: id, error });
      throw new DatabaseError('delete user', error);
    }
  }

  async findActiveUsers(limit: number = 100): Promise<User[]> {
    return this.findAll({
      filters: { isActive: true },
      limit,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  }

  async findUsersByRole(role: UserRole): Promise<User[]> {
    return this.findAll({
      filters: { role },
      sortBy: 'lastName',
      sortOrder: 'asc',
    });
  }
}

// Application service with business logic
export class UserService implements DomainService<
  User,
  CreateUserRequest,
  UpdateUserRequest
> {
  constructor(
    private userRepository: UserRepository,
    private emailService: EmailService,
    private eventBus: EventBus,
    private validator: UserValidator,
    private logger: Logger
  ) {}

  async create(request: CreateUserRequest): Promise<User> {
    // Validate input
    await this.validator.validateCreateRequest(request);

    // Check business rules
    const existingUser = await this.userRepository.findByEmail(request.email);
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Create domain entity
    const user = User.create(request);

    // Persist to database
    const savedUser = await this.userRepository.create(user);

    // Emit domain event
    await this.eventBus.emit('user.created', {
      userId: savedUser.id,
      email: savedUser.email,
      role: savedUser.role,
    });

    // Handle side effects asynchronously
    this.handleUserCreatedSideEffects(savedUser).catch(error => {
      this.logger.error('User creation side effects failed', {
        userId: savedUser.id,
        error: error.message,
      });
    });

    this.logger.info('User created successfully', {
      userId: savedUser.id,
      email: savedUser.email,
    });

    return savedUser;
  }

  async findById(id: string): Promise<User | null> {
    if (!id) {
      throw new ValidationError('User ID is required');
    }

    return await this.userRepository.findById(id);
  }

  async update(id: string, request: UpdateUserRequest): Promise<User> {
    // Validate input
    await this.validator.validateUpdateRequest(request);

    // Get existing user
    const existingUser = await this.userRepository.findById(id);
    if (!existingUser) {
      throw new NotFoundError('User', id);
    }

    // Apply business rules and create updated entity
    const updatedUser = existingUser.updateProfile(request);

    // Persist changes
    const savedUser = await this.userRepository.update(id, updatedUser);

    // Emit domain event
    await this.eventBus.emit('user.updated', {
      userId: savedUser.id,
      previousData: existingUser.toApiResponse(),
      newData: savedUser.toApiResponse(),
    });

    this.logger.info('User updated successfully', {
      userId: savedUser.id,
      changes: request,
    });

    return savedUser;
  }

  async delete(id: string): Promise<void> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundError('User', id);
    }

    // Business rule: Admin users cannot be deleted
    if (user.isAdmin) {
      throw new BusinessRuleError('Admin users cannot be deleted');
    }

    // Soft delete by deactivating first
    const deactivatedUser = user.deactivate();
    await this.userRepository.update(id, deactivatedUser);

    // Then hard delete after a delay (implement as needed)
    await this.userRepository.delete(id);

    await this.eventBus.emit('user.deleted', {
      userId: id,
      email: user.email,
    });

    this.logger.info('User deleted successfully', {
      userId: id,
      email: user.email,
    });
  }

  async changeUserRole(
    userId: string,
    newRole: UserRole,
    requesterId: string
  ): Promise<User> {
    // Business rule: Only admins can change roles
    const requester = await this.userRepository.findById(requesterId);
    if (!requester || !requester.isAdmin) {
      throw new AuthorizationError('Only administrators can change user roles');
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }

    // Business rule: Cannot demote the last admin
    if (user.isAdmin && newRole !== UserRole.ADMIN) {
      const adminCount = (
        await this.userRepository.findUsersByRole(UserRole.ADMIN)
      ).length;
      if (adminCount <= 1) {
        throw new BusinessRuleError('Cannot demote the last administrator');
      }
    }

    const updatedUser = user.changeRole(newRole);
    const savedUser = await this.userRepository.update(userId, updatedUser);

    await this.eventBus.emit('user.role.changed', {
      userId: savedUser.id,
      previousRole: user.role,
      newRole: savedUser.role,
      changedBy: requesterId,
    });

    this.logger.info('User role changed', {
      userId: savedUser.id,
      previousRole: user.role,
      newRole: savedUser.role,
      changedBy: requesterId,
    });

    return savedUser;
  }

  async findActiveUsers(limit: number = 100): Promise<User[]> {
    return await this.userRepository.findActiveUsers(limit);
  }

  async authenticateUser(
    email: string,
    password: string
  ): Promise<User | null> {
    const user = await this.userRepository.findByEmail(email);
    if (!user || !user.isActive) {
      return null;
    }

    if (!user.verifyPassword(password)) {
      // Log failed login attempt
      this.logger.warn('Failed login attempt', {
        email,
        userId: user.id,
        timestamp: new Date(),
      });
      return null;
    }

    this.logger.info('User authenticated successfully', {
      userId: user.id,
      email: user.email,
    });

    await this.eventBus.emit('user.authenticated', {
      userId: user.id,
      email: user.email,
      timestamp: new Date(),
    });

    return user;
  }

  private async handleUserCreatedSideEffects(user: User): Promise<void> {
    try {
      // Send welcome email
      await this.emailService.sendWelcomeEmail(user.email, user.firstName);

      // Create user profile
      await this.createInitialUserProfile(user);

      // Set up default preferences
      await this.setupDefaultPreferences(user);
    } catch (error) {
      // Log but don't fail the main operation
      this.logger.error('Side effects processing failed', {
        userId: user.id,
        error: error.message,
      });
    }
  }

  private async createInitialUserProfile(user: User): Promise<void> {
    // Implementation would go here
    this.logger.debug('Created initial profile for user', { userId: user.id });
  }

  private async setupDefaultPreferences(user: User): Promise<void> {
    // Implementation would go here
    this.logger.debug('Set up default preferences for user', {
      userId: user.id,
    });
  }
}

// Application service for complex operations
export class UserManagementService {
  constructor(
    private userService: UserService,
    private auditService: AuditService,
    private notificationService: NotificationService,
    private logger: Logger
  ) {}

  async bulkCreateUsers(
    requests: CreateUserRequest[]
  ): Promise<BulkOperationResult<User>> {
    const results: BulkOperationResult<User> = {
      successful: [],
      failed: [],
      summary: {
        total: requests.length,
        successCount: 0,
        failureCount: 0,
      },
    };

    for (let i = 0; i < requests.length; i++) {
      try {
        const user = await this.userService.create(requests[i]);
        results.successful.push({ index: i, data: user });
        results.summary.successCount++;
      } catch (error) {
        results.failed.push({
          index: i,
          data: requests[i],
          error: error.message,
          errorCode: error.code || 'UNKNOWN_ERROR',
        });
        results.summary.failureCount++;
      }
    }

    // Log summary
    this.logger.info('Bulk user creation completed', {
      total: results.summary.total,
      successful: results.summary.successCount,
      failed: results.summary.failureCount,
    });

    return results;
  }

  async deactivateInactiveUsers(inactiveDays: number = 90): Promise<string[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);

    // This would typically use a more sophisticated query
    const allUsers = await this.userService.findActiveUsers(1000);
    const inactiveUsers = allUsers.filter(
      user => user.updatedAt < cutoffDate && user.role !== UserRole.ADMIN
    );

    const deactivatedUserIds: string[] = [];

    for (const user of inactiveUsers) {
      try {
        await this.userService.delete(user.id);
        deactivatedUserIds.push(user.id);

        // Send deactivation notification
        await this.notificationService.sendDeactivationNotice(user.email);

        // Log audit event
        await this.auditService.logEvent('USER_DEACTIVATED_INACTIVE', {
          userId: user.id,
          email: user.email,
          lastActivity: user.updatedAt,
          inactiveDays,
        });
      } catch (error) {
        this.logger.error('Failed to deactivate inactive user', {
          userId: user.id,
          error: error.message,
        });
      }
    }

    this.logger.info('Inactive user cleanup completed', {
      usersChecked: allUsers.length,
      usersDeactivated: deactivatedUserIds.length,
      cutoffDate,
    });

    return deactivatedUserIds;
  }

  async generateUserReport(criteria: UserReportCriteria): Promise<UserReport> {
    const users = await this.getUsersByCriteria(criteria);

    const report: UserReport = {
      generatedAt: new Date(),
      criteria,
      totalUsers: users.length,
      usersByRole: this.groupUsersByRole(users),
      usersByStatus: this.groupUsersByStatus(users),
      recentSignups: this.getRecentSignups(users, 30),
      summary: {
        activeUsers: users.filter(u => u.isActive).length,
        inactiveUsers: users.filter(u => !u.isActive).length,
        adminUsers: users.filter(u => u.isAdmin).length,
      },
    };

    // Log report generation
    this.logger.info('User report generated', {
      criteria,
      totalUsers: report.totalUsers,
      activeUsers: report.summary.activeUsers,
    });

    return report;
  }

  private async getUsersByCriteria(
    criteria: UserReportCriteria
  ): Promise<User[]> {
    const queryOptions: QueryOptions = {
      limit: criteria.limit,
      offset: criteria.offset,
      sortBy: criteria.sortBy || 'createdAt',
      sortOrder: criteria.sortOrder || 'desc',
    };

    if (criteria.role) {
      queryOptions.filters = { role: criteria.role };
    }

    if (criteria.isActive !== undefined) {
      queryOptions.filters = {
        ...queryOptions.filters,
        isActive: criteria.isActive,
      };
    }

    return await this.userService.findAll(queryOptions);
  }

  private groupUsersByRole(users: User[]): Record<UserRole, number> {
    const groups = {
      [UserRole.ADMIN]: 0,
      [UserRole.USER]: 0,
      [UserRole.MODERATOR]: 0,
    };

    users.forEach(user => {
      groups[user.role] = (groups[user.role] || 0) + 1;
    });

    return groups;
  }

  private groupUsersByStatus(users: User[]): {
    active: number;
    inactive: number;
  } {
    return {
      active: users.filter(u => u.isActive).length,
      inactive: users.filter(u => !u.isActive).length,
    };
  }

  private getRecentSignups(users: User[], days: number): User[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return users.filter(user => user.createdAt >= cutoffDate);
  }
}

// Validation service
export class UserValidator {
  async validateCreateRequest(request: CreateUserRequest): Promise<void> {
    const errors: string[] = [];

    if (!request.email) {
      errors.push('Email is required');
    } else if (!this.isValidEmail(request.email)) {
      errors.push('Invalid email format');
    }

    if (!request.firstName?.trim()) {
      errors.push('First name is required');
    }

    if (!request.lastName?.trim()) {
      errors.push('Last name is required');
    }

    if (!request.password) {
      errors.push('Password is required');
    } else if (request.password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (errors.length > 0) {
      throw new ValidationError(`Validation failed: ${errors.join(', ')}`);
    }
  }

  async validateUpdateRequest(request: UpdateUserRequest): Promise<void> {
    const errors: string[] = [];

    if (request.email && !this.isValidEmail(request.email)) {
      errors.push('Invalid email format');
    }

    if (request.firstName === '') {
      errors.push('First name cannot be empty');
    }

    if (request.lastName === '') {
      errors.push('Last name cannot be empty');
    }

    if (errors.length > 0) {
      throw new ValidationError(`Validation failed: ${errors.join(', ')}`);
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

/**
 * Benefits of these service patterns:
 *
 * 1. SEPARATION OF CONCERNS:
 *    - Repository handles data access
 *    - Domain service handles business logic
 *    - Application service coordinates complex operations
 *    - Each layer has a single responsibility
 *
 * 2. DOMAIN-DRIVEN DESIGN:
 *    - Rich domain entities with business methods
 *    - Business rules enforced in domain layer
 *    - Clear ubiquitous language
 *
 * 3. TESTABILITY:
 *    - Dependencies injected via constructor
 *    - Clear interfaces for mocking
 *    - Business logic isolated from infrastructure
 *
 * 4. COMPOSABILITY:
 *    - Services compose well together
 *    - Clear boundaries between contexts
 *    - Easy to extend without breaking existing code
 *
 * 5. ERROR HANDLING:
 *    - Proper exception types for different scenarios
 *    - Graceful handling of side effects
 *    - Comprehensive logging and audit trails
 *
 * 6. PERFORMANCE:
 *    - Async operations where needed
 *    - Proper resource management
 *    - Efficient data access patterns
 */

// Type definitions and enums
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  MODERATOR = 'moderator',
}

interface UserDbRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  hashedPassword?: string;
}

interface UserApiResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
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
}

interface BulkOperationResult<T> {
  successful: Array<{ index: number; data: T }>;
  failed: Array<{
    index: number;
    data: any;
    error: string;
    errorCode: string;
  }>;
  summary: {
    total: number;
    successCount: number;
    failureCount: number;
  };
}

interface UserReportCriteria {
  role?: UserRole;
  isActive?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface UserReport {
  generatedAt: Date;
  criteria: UserReportCriteria;
  totalUsers: number;
  usersByRole: Record<UserRole, number>;
  usersByStatus: { active: number; inactive: number };
  recentSignups: User[];
  summary: {
    activeUsers: number;
    inactiveUsers: number;
    adminUsers: number;
  };
}

// External service interfaces
interface EmailService {
  sendWelcomeEmail(email: string, firstName: string): Promise<void>;
}

interface EventBus {
  emit(eventType: string, payload: any): Promise<void>;
}

interface AuditService {
  logEvent(eventType: string, data: any): Promise<void>;
}

interface NotificationService {
  sendDeactivationNotice(email: string): Promise<void>;
}

interface DatabaseClient {
  user: {
    findUnique(options: any): Promise<UserDbRecord | null>;
    findMany(options: any): Promise<UserDbRecord[]>;
    create(options: any): Promise<UserDbRecord>;
    update(options: any): Promise<UserDbRecord>;
    delete(options: any): Promise<UserDbRecord>;
  };
}

interface Logger {
  debug(message: string, context?: any): void;
  info(message: string, context?: any): void;
  warn(message: string, context?: any): void;
  error(message: string, context?: any): void;
}

// Error classes (would typically be imported from error-handling.ts)
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

class BusinessRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BusinessRuleError';
  }
}

class NotFoundError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} with ID ${id} not found`);
    this.name = 'NotFoundError';
  }
}

class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

class DatabaseError extends Error {
  constructor(operation: string, cause?: Error) {
    super(`Database operation failed: ${operation}`);
    this.name = 'DatabaseError';
    this.cause = cause;
  }
}

// Utility functions
function generateId(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

function hashPassword(password: string): string {
  // In real implementation, use bcrypt or similar
  return `hashed_${password}`;
}

function verifyPassword(password: string, hash: string): boolean {
  // In real implementation, use bcrypt.compare or similar
  return hash === `hashed_${password}`;
}
