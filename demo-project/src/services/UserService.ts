/**
 * User service implementation following the golden patterns
 */
import { BaseService, ServiceResult } from './BaseService';
import { User } from '../models/User';
import { UserRepository } from '../repositories/UserRepository';
import { 
  ValidationError, 
  NotFoundError, 
  ConflictError, 
  BusinessRuleError 
} from '../utils/errors';

export interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}

export interface UpdateUserRequest {
  email?: string;
  firstName?: string;
  lastName?: string;
}

export class UserService extends BaseService {
  constructor(private userRepository: UserRepository) {
    super('UserService');
  }

  async createUser(request: CreateUserRequest): Promise<ServiceResult<User>> {
    return this.executeOperation('createUser', async () => {
      // Validate input
      this.validateCreateUserRequest(request);

      // Check business rules
      const existingUser = await this.userRepository.findByEmail(request.email);
      if (existingUser) {
        throw new ConflictError(
          'User with this email already exists',
          'User'
        );
      }

      // Create user (password hashing would go here in real app)
      const user = User.create({
        email: request.email,
        firstName: request.firstName,
        lastName: request.lastName,
      });

      // Save to repository
      const savedUser = await this.userRepository.create(user);

      this.log('info', 'User created successfully', {
        userId: savedUser.id,
        email: savedUser.email,
      });

      return savedUser;
    });
  }

  async getUserById(id: string): Promise<ServiceResult<User>> {
    return this.executeOperation('getUserById', async () => {
      if (!id) {
        throw new ValidationError('User ID is required', ['id']);
      }

      const user = await this.userRepository.findById(id);
      if (!user) {
        throw new NotFoundError('User', id);
      }

      return user;
    });
  }

  async getUserByEmail(email: string): Promise<ServiceResult<User>> {
    return this.executeOperation('getUserByEmail', async () => {
      if (!email) {
        throw new ValidationError('Email is required', ['email']);
      }

      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        throw new NotFoundError('User', email);
      }

      return user;
    });
  }

  async updateUser(id: string, request: UpdateUserRequest): Promise<ServiceResult<User>> {
    return this.executeOperation('updateUser', async () => {
      // Validate input
      this.validateUpdateUserRequest(request);

      // Get existing user
      const user = await this.userRepository.findById(id);
      if (!user) {
        throw new NotFoundError('User', id);
      }

      // Check business rules
      if (request.email && request.email !== user.email) {
        const existingUser = await this.userRepository.findByEmail(request.email);
        if (existingUser) {
          throw new ConflictError(
            'Email is already in use',
            'User'
          );
        }
        user.updateEmail(request.email);
      }

      if (request.firstName || request.lastName) {
        user.updateName(
          request.firstName || user.firstName,
          request.lastName || user.lastName
        );
      }

      // Save changes
      const updatedUser = await this.userRepository.update(user);

      this.log('info', 'User updated successfully', {
        userId: updatedUser.id,
      });

      return updatedUser;
    });
  }

  async deleteUser(id: string): Promise<ServiceResult<void>> {
    return this.executeOperation('deleteUser', async () => {
      const user = await this.userRepository.findById(id);
      if (!user) {
        throw new NotFoundError('User', id);
      }

      // Additional business rules could go here
      // e.g., check if user has active subscriptions

      await this.userRepository.delete(id);

      this.log('info', 'User deleted successfully', {
        userId: id,
      });
    });
  }

  async listUsers(limit: number = 10, offset: number = 0): Promise<ServiceResult<User[]>> {
    return this.executeOperation('listUsers', async () => {
      if (limit < 1 || limit > 100) {
        throw new ValidationError('Limit must be between 1 and 100', ['limit']);
      }

      if (offset < 0) {
        throw new ValidationError('Offset must be non-negative', ['offset']);
      }

      const users = await this.userRepository.findAll(limit, offset);
      return users;
    });
  }

  private validateCreateUserRequest(request: CreateUserRequest): void {
    const errors: string[] = [];

    if (!request.email) {
      errors.push('email');
    } else if (!this.isValidEmail(request.email)) {
      throw new ValidationError('Invalid email format', ['email']);
    }

    if (!request.firstName || request.firstName.trim().length === 0) {
      errors.push('firstName');
    }

    if (!request.lastName || request.lastName.trim().length === 0) {
      errors.push('lastName');
    }

    if (!request.password || request.password.length < 8) {
      throw new BusinessRuleError(
        'Password must be at least 8 characters long',
        'PASSWORD_POLICY'
      );
    }

    if (errors.length > 0) {
      throw new ValidationError(`Required fields missing: ${errors.join(', ')}`, errors);
    }
  }

  private validateUpdateUserRequest(request: UpdateUserRequest): void {
    if (request.email && !this.isValidEmail(request.email)) {
      throw new ValidationError('Invalid email format', ['email']);
    }

    if (request.firstName !== undefined && request.firstName.trim().length === 0) {
      throw new ValidationError('First name cannot be empty', ['firstName']);
    }

    if (request.lastName !== undefined && request.lastName.trim().length === 0) {
      throw new ValidationError('Last name cannot be empty', ['lastName']);
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  protected async onInitialize(): Promise<void> {
    // Any initialization logic goes here
    this.log('info', 'UserService initialized');
  }

  protected async onShutdown(): Promise<void> {
    // Any cleanup logic goes here
    this.log('info', 'UserService shutdown');
  }

  protected async checkHealth(): Promise<boolean> {
    try {
      // Check if repository is accessible
      await this.userRepository.findAll(1, 0);
      return true;
    } catch {
      return false;
    }
  }
}