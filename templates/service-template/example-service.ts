/**
 * Example Service Implementation
 * 
 * This demonstrates how to implement a concrete service using the BaseService
 * template. It shows best practices for service implementation including
 * configuration, data validation, error handling, and business logic.
 */

import { BaseService, ServiceConfig, ServiceResult } from './base-service';

// Define service-specific configuration
export interface UserServiceConfig extends ServiceConfig {
  readonly databaseUrl: string;
  readonly cacheTtl?: number;
  readonly enableUserValidation?: boolean;
}

// Define domain models
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  GUEST = 'guest',
}

export interface CreateUserRequest {
  name: string;
  email: string;
  role?: UserRole;
}

export interface UpdateUserRequest {
  id: string;
  name?: string;
  email?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface UserQuery {
  role?: UserRole;
  isActive?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * User Service - manages user operations
 * 
 * This service demonstrates:
 * - Extending BaseService with typed configuration
 * - Implementing required abstract methods
 * - Using executeOperation for consistent error handling
 * - Input validation patterns
 * - Business logic organization
 */
export class UserService extends BaseService<UserServiceConfig, User> {
  private users = new Map<string, User>(); // In-memory storage for demo
  private isInitialized = false;

  constructor(config: UserServiceConfig) {
    super(config);
  }

  /**
   * Initialize the service - setup database connections, cache, etc.
   */
  protected async onInitialize(): Promise<void> {
    // Simulate database connection setup
    await this.connectToDatabase();
    await this.setupCache();
    await this.loadInitialData();
    this.isInitialized = true;
  }

  /**
   * Shutdown the service - cleanup resources
   */
  protected async onShutdown(): Promise<void> {
    // Cleanup database connections, cache, etc.
    this.users.clear();
    this.isInitialized = false;
  }

  /**
   * Health check - verify service is operational
   */
  protected checkHealth(): boolean {
    return this.isInitialized && this.config.databaseUrl !== '';
  }

  /**
   * Create a new user
   */
  public async createUser(request: CreateUserRequest): Promise<ServiceResult<User>> {
    return this.executeOperation('createUser', async () => {
      // Input validation
      this.validateCreateUserRequest(request);

      // Check for existing user
      const existingUser = this.findUserByEmail(request.email);
      if (existingUser) {
        throw new Error(`User with email ${request.email} already exists`);
      }

      // Create user
      const user: User = {
        id: this.generateUserId(),
        name: request.name.trim(),
        email: request.email.toLowerCase().trim(),
        role: request.role || UserRole.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };

      // Store user
      this.users.set(user.id, user);

      this.log('info', 'User created successfully', { userId: user.id, email: user.email });
      this.emit('userCreated', user);

      return user;
    });
  }

  /**
   * Get user by ID
   */
  public async getUserById(id: string): Promise<ServiceResult<User>> {
    return this.executeOperation('getUserById', async () => {
      if (!id || typeof id !== 'string') {
        throw new Error('Valid user ID is required');
      }

      const user = this.users.get(id);
      if (!user) {
        throw new Error(`User with ID ${id} not found`);
      }

      return user;
    });
  }

  /**
   * Update user
   */
  public async updateUser(request: UpdateUserRequest): Promise<ServiceResult<User>> {
    return this.executeOperation('updateUser', async () => {
      this.validateUpdateUserRequest(request);

      const user = this.users.get(request.id);
      if (!user) {
        throw new Error(`User with ID ${request.id} not found`);
      }

      // Check for email conflicts if email is being updated
      if (request.email && request.email !== user.email) {
        const existingUser = this.findUserByEmail(request.email);
        if (existingUser && existingUser.id !== request.id) {
          throw new Error(`User with email ${request.email} already exists`);
        }
      }

      // Update user
      const updatedUser: User = {
        ...user,
        ...(request.name && { name: request.name.trim() }),
        ...(request.email && { email: request.email.toLowerCase().trim() }),
        ...(request.role && { role: request.role }),
        ...(request.isActive !== undefined && { isActive: request.isActive }),
        updatedAt: new Date(),
      };

      this.users.set(updatedUser.id, updatedUser);

      this.log('info', 'User updated successfully', { userId: updatedUser.id });
      this.emit('userUpdated', updatedUser);

      return updatedUser;
    });
  }

  /**
   * Delete user
   */
  public async deleteUser(id: string): Promise<ServiceResult<void>> {
    return this.executeOperation('deleteUser', async () => {
      if (!id || typeof id !== 'string') {
        throw new Error('Valid user ID is required');
      }

      const user = this.users.get(id);
      if (!user) {
        throw new Error(`User with ID ${id} not found`);
      }

      this.users.delete(id);

      this.log('info', 'User deleted successfully', { userId: id });
      this.emit('userDeleted', { id, user });
    });
  }

  /**
   * Query users with filtering and pagination
   */
  public async queryUsers(query: UserQuery = {}): Promise<ServiceResult<{ users: User[]; total: number }>> {
    return this.executeOperation('queryUsers', async () => {
      let users = Array.from(this.users.values());

      // Apply filters
      if (query.role) {
        users = users.filter(user => user.role === query.role);
      }

      if (query.isActive !== undefined) {
        users = users.filter(user => user.isActive === query.isActive);
      }

      if (query.search) {
        const searchLower = query.search.toLowerCase();
        users = users.filter(user => 
          user.name.toLowerCase().includes(searchLower) ||
          user.email.toLowerCase().includes(searchLower)
        );
      }

      const total = users.length;

      // Apply pagination
      const offset = query.offset || 0;
      const limit = query.limit || 50;
      users = users.slice(offset, offset + limit);

      return { users, total };
    });
  }

  /**
   * Bulk operations example
   */
  public async bulkCreateUsers(requests: CreateUserRequest[]): Promise<ServiceResult<User[]>> {
    return this.executeOperation('bulkCreateUsers', async () => {
      if (!Array.isArray(requests) || requests.length === 0) {
        throw new Error('Valid array of user requests is required');
      }

      const results: User[] = [];
      const errors: string[] = [];

      for (const request of requests) {
        try {
          const result = await this.createUser(request);
          if (result.success && result.data) {
            results.push(result.data);
          } else {
            errors.push(`Failed to create user ${request.email}: ${result.error?.message}`);
          }
        } catch (error) {
          errors.push(`Failed to create user ${request.email}: ${error}`);
        }
      }

      if (errors.length > 0) {
        this.log('warn', 'Some users failed to create in bulk operation', { errors });
      }

      this.log('info', 'Bulk user creation completed', { 
        totalRequests: requests.length, 
        successful: results.length, 
        failed: errors.length 
      });

      return results;
    });
  }

  // Private helper methods
  private validateCreateUserRequest(request: CreateUserRequest): void {
    if (!request.name || typeof request.name !== 'string' || request.name.trim().length === 0) {
      throw new Error('Valid name is required');
    }

    if (!this.isValidEmail(request.email)) {
      throw new Error('Valid email is required');
    }

    if (request.role && !Object.values(UserRole).includes(request.role)) {
      throw new Error('Invalid user role');
    }
  }

  private validateUpdateUserRequest(request: UpdateUserRequest): void {
    if (!request.id || typeof request.id !== 'string') {
      throw new Error('Valid user ID is required');
    }

    if (request.name && (typeof request.name !== 'string' || request.name.trim().length === 0)) {
      throw new Error('Valid name is required');
    }

    if (request.email && !this.isValidEmail(request.email)) {
      throw new Error('Valid email is required');
    }

    if (request.role && !Object.values(UserRole).includes(request.role)) {
      throw new Error('Invalid user role');
    }
  }

  private isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private findUserByEmail(email: string): User | undefined {
    return Array.from(this.users.values()).find(user => user.email === email.toLowerCase());
  }

  private generateUserId(): string {
    return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async connectToDatabase(): Promise<void> {
    // Simulate database connection
    this.log('info', 'Connecting to database', { url: this.config.databaseUrl });
    await new Promise(resolve => setTimeout(resolve, 100));
    this.log('info', 'Database connection established');
  }

  private async setupCache(): Promise<void> {
    // Simulate cache setup
    if (this.config.cacheTtl) {
      this.log('info', 'Setting up cache', { ttl: this.config.cacheTtl });
      await new Promise(resolve => setTimeout(resolve, 50));
      this.log('info', 'Cache setup completed');
    }
  }

  private async loadInitialData(): Promise<void> {
    // Load initial data if needed
    this.log('info', 'Loading initial data');
    
    // Create default admin user
    const adminUser: User = {
      id: this.generateUserId(),
      name: 'Administrator',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    };

    this.users.set(adminUser.id, adminUser);
    this.log('info', 'Initial data loaded', { defaultUsersCreated: 1 });
  }
}

// Factory function for creating configured user service
export function createUserService(config: Partial<UserServiceConfig> = {}): UserService {
  const defaultConfig: UserServiceConfig = {
    name: 'UserService',
    version: '1.0.0',
    databaseUrl: process.env.DATABASE_URL || 'memory://localhost',
    timeout: 5000,
    retryAttempts: 2,
    enableLogging: true,
    cacheTtl: 300000, // 5 minutes
    enableUserValidation: true,
  };

  return new UserService({ ...defaultConfig, ...config });
}

// Export service events for external listeners
export const UserServiceEvents = {
  USER_CREATED: 'userCreated',
  USER_UPDATED: 'userUpdated',
  USER_DELETED: 'userDeleted',
} as const;