/**
 * Service Test Template
 * 
 * This demonstrates comprehensive testing patterns for services built
 * on the BaseService template. It includes unit tests, integration tests,
 * error scenarios, and performance testing patterns.
 */

import { UserService, UserServiceConfig, UserRole, CreateUserRequest, UpdateUserRequest } from './example-service';
import { ServiceResult } from './base-service';

// Mock external dependencies
jest.mock('events', () => ({
  EventEmitter: jest.fn().mockImplementation(() => ({
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    removeAllListeners: jest.fn(),
  })),
}));

describe('UserService', () => {
  let userService: UserService;
  let mockConfig: UserServiceConfig;

  // Setup before each test
  beforeEach(async () => {
    mockConfig = {
      name: 'UserService',
      version: '1.0.0',
      databaseUrl: 'memory://test',
      timeout: 1000,
      retryAttempts: 1,
      enableLogging: false, // Disable logging in tests
      cacheTtl: 60000,
      enableUserValidation: true,
    };

    userService = new UserService(mockConfig);
    await userService.initialize();
  });

  // Cleanup after each test
  afterEach(async () => {
    await userService.shutdown();
  });

  describe('Service Lifecycle', () => {
    it('should initialize successfully', async () => {
      const newService = new UserService(mockConfig);
      
      await expect(newService.initialize()).resolves.toBeUndefined();
      
      const health = newService.getHealth();
      expect(health.success).toBe(true);
      expect(health.data?.status).toBe('healthy');
      
      await newService.shutdown();
    });

    it('should shutdown gracefully', async () => {
      await expect(userService.shutdown()).resolves.toBeUndefined();
      
      const health = userService.getHealth();
      expect(health.data?.status).toBe('unhealthy');
    });

    it('should provide health status', () => {
      const health = userService.getHealth();
      
      expect(health.success).toBe(true);
      expect(health.data).toHaveProperty('status');
      expect(health.data).toHaveProperty('uptime');
      expect(health.data).toHaveProperty('metrics');
      expect(health.data?.status).toBe('healthy');
    });

    it('should provide service configuration', () => {
      const config = userService.getConfig();
      
      expect(config).toHaveProperty('name', 'UserService');
      expect(config).toHaveProperty('version', '1.0.0');
      expect(config).toHaveProperty('databaseUrl');
    });

    it('should reject invalid configuration', () => {
      const invalidConfig = {
        ...mockConfig,
        name: '', // Invalid empty name
      };

      expect(() => new UserService(invalidConfig)).toThrow('Service name and version are required');
    });
  });

  describe('User Creation', () => {
    const validCreateRequest: CreateUserRequest = {
      name: 'John Doe',
      email: 'john.doe@example.com',
      role: UserRole.USER,
    };

    it('should create a user successfully', async () => {
      const result = await userService.createUser(validCreateRequest);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('id');
      expect(result.data?.name).toBe('John Doe');
      expect(result.data?.email).toBe('john.doe@example.com');
      expect(result.data?.role).toBe(UserRole.USER);
      expect(result.data?.isActive).toBe(true);
      expect(result.data?.createdAt).toBeInstanceOf(Date);
      expect(result.metadata).toHaveProperty('executionTime');
      expect(result.metadata).toHaveProperty('requestId');
    });

    it('should normalize email to lowercase', async () => {
      const request = {
        ...validCreateRequest,
        email: 'JOHN.DOE@EXAMPLE.COM',
      };

      const result = await userService.createUser(request);

      expect(result.success).toBe(true);
      expect(result.data?.email).toBe('john.doe@example.com');
    });

    it('should default role to USER when not specified', async () => {
      const request: CreateUserRequest = {
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        // role not specified
      };

      const result = await userService.createUser(request);

      expect(result.success).toBe(true);
      expect(result.data?.role).toBe(UserRole.USER);
    });

    it('should reject invalid name', async () => {
      const request = {
        ...validCreateRequest,
        name: '', // Invalid empty name
      };

      const result = await userService.createUser(request);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Valid name is required');
    });

    it('should reject invalid email', async () => {
      const request = {
        ...validCreateRequest,
        email: 'invalid-email', // Invalid email format
      };

      const result = await userService.createUser(request);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Valid email is required');
    });

    it('should reject invalid role', async () => {
      const request = {
        ...validCreateRequest,
        role: 'invalid-role' as UserRole, // Invalid role
      };

      const result = await userService.createUser(request);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid user role');
    });

    it('should prevent duplicate email addresses', async () => {
      // Create first user
      await userService.createUser(validCreateRequest);

      // Try to create second user with same email
      const duplicateRequest = {
        ...validCreateRequest,
        name: 'Different Name',
      };

      const result = await userService.createUser(duplicateRequest);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('already exists');
    });
  });

  describe('User Retrieval', () => {
    let createdUserId: string;

    beforeEach(async () => {
      const createResult = await userService.createUser({
        name: 'Test User',
        email: 'test@example.com',
        role: UserRole.USER,
      });
      createdUserId = createResult.data!.id;
    });

    it('should retrieve user by ID', async () => {
      const result = await userService.getUserById(createdUserId);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe(createdUserId);
      expect(result.data?.name).toBe('Test User');
      expect(result.data?.email).toBe('test@example.com');
    });

    it('should return error for non-existent user', async () => {
      const result = await userService.getUserById('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('not found');
    });

    it('should validate user ID format', async () => {
      const result = await userService.getUserById('');

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Valid user ID is required');
    });
  });

  describe('User Updates', () => {
    let createdUserId: string;

    beforeEach(async () => {
      const createResult = await userService.createUser({
        name: 'Original Name',
        email: 'original@example.com',
        role: UserRole.USER,
      });
      createdUserId = createResult.data!.id;
    });

    it('should update user successfully', async () => {
      const updateRequest: UpdateUserRequest = {
        id: createdUserId,
        name: 'Updated Name',
        email: 'updated@example.com',
        role: UserRole.ADMIN,
        isActive: false,
      };

      const result = await userService.updateUser(updateRequest);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe(createdUserId);
      expect(result.data?.name).toBe('Updated Name');
      expect(result.data?.email).toBe('updated@example.com');
      expect(result.data?.role).toBe(UserRole.ADMIN);
      expect(result.data?.isActive).toBe(false);
      expect(result.data?.updatedAt).toBeInstanceOf(Date);
    });

    it('should update partial fields only', async () => {
      const updateRequest: UpdateUserRequest = {
        id: createdUserId,
        name: 'Partially Updated Name',
        // Other fields not specified
      };

      const result = await userService.updateUser(updateRequest);

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Partially Updated Name');
      expect(result.data?.email).toBe('original@example.com'); // Unchanged
      expect(result.data?.role).toBe(UserRole.USER); // Unchanged
    });

    it('should prevent email conflicts during update', async () => {
      // Create another user
      await userService.createUser({
        name: 'Another User',
        email: 'another@example.com',
        role: UserRole.USER,
      });

      // Try to update first user with second user's email
      const updateRequest: UpdateUserRequest = {
        id: createdUserId,
        email: 'another@example.com',
      };

      const result = await userService.updateUser(updateRequest);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('already exists');
    });

    it('should return error for non-existent user update', async () => {
      const updateRequest: UpdateUserRequest = {
        id: 'non-existent-id',
        name: 'Updated Name',
      };

      const result = await userService.updateUser(updateRequest);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('not found');
    });
  });

  describe('User Deletion', () => {
    let createdUserId: string;

    beforeEach(async () => {
      const createResult = await userService.createUser({
        name: 'To Be Deleted',
        email: 'delete@example.com',
        role: UserRole.USER,
      });
      createdUserId = createResult.data!.id;
    });

    it('should delete user successfully', async () => {
      const result = await userService.deleteUser(createdUserId);

      expect(result.success).toBe(true);

      // Verify user is deleted
      const getResult = await userService.getUserById(createdUserId);
      expect(getResult.success).toBe(false);
    });

    it('should return error for non-existent user deletion', async () => {
      const result = await userService.deleteUser('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('not found');
    });

    it('should validate user ID for deletion', async () => {
      const result = await userService.deleteUser('');

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Valid user ID is required');
    });
  });

  describe('User Querying', () => {
    beforeEach(async () => {
      // Create test users
      const testUsers = [
        { name: 'Admin User', email: 'admin@example.com', role: UserRole.ADMIN },
        { name: 'Regular User 1', email: 'user1@example.com', role: UserRole.USER },
        { name: 'Regular User 2', email: 'user2@example.com', role: UserRole.USER },
        { name: 'Guest User', email: 'guest@example.com', role: UserRole.GUEST },
      ];

      for (const user of testUsers) {
        await userService.createUser(user);
      }

      // Deactivate one user
      const allUsers = await userService.queryUsers();
      if (allUsers.data && allUsers.data.users.length > 0) {
        await userService.updateUser({
          id: allUsers.data.users[0].id,
          isActive: false,
        });
      }
    });

    it('should query all users', async () => {
      const result = await userService.queryUsers();

      expect(result.success).toBe(true);
      expect(result.data?.users).toHaveLength(5); // 4 created + 1 default admin
      expect(result.data?.total).toBe(5);
    });

    it('should filter by role', async () => {
      const result = await userService.queryUsers({ role: UserRole.USER });

      expect(result.success).toBe(true);
      expect(result.data?.users.every(user => user.role === UserRole.USER)).toBe(true);
    });

    it('should filter by active status', async () => {
      const result = await userService.queryUsers({ isActive: true });

      expect(result.success).toBe(true);
      expect(result.data?.users.every(user => user.isActive === true)).toBe(true);
    });

    it('should search by name and email', async () => {
      const result = await userService.queryUsers({ search: 'Regular' });

      expect(result.success).toBe(true);
      expect(result.data?.users.every(user => 
        user.name.includes('Regular') || user.email.includes('Regular')
      )).toBe(true);
    });

    it('should support pagination', async () => {
      const result = await userService.queryUsers({ limit: 2, offset: 1 });

      expect(result.success).toBe(true);
      expect(result.data?.users).toHaveLength(2);
      expect(result.data?.total).toBe(5); // Total should still be 5
    });

    it('should combine filters', async () => {
      const result = await userService.queryUsers({
        role: UserRole.USER,
        isActive: true,
        limit: 1,
      });

      expect(result.success).toBe(true);
      expect(result.data?.users).toHaveLength(1);
      expect(result.data?.users[0].role).toBe(UserRole.USER);
      expect(result.data?.users[0].isActive).toBe(true);
    });
  });

  describe('Bulk Operations', () => {
    it('should create multiple users in bulk', async () => {
      const requests: CreateUserRequest[] = [
        { name: 'Bulk User 1', email: 'bulk1@example.com', role: UserRole.USER },
        { name: 'Bulk User 2', email: 'bulk2@example.com', role: UserRole.ADMIN },
        { name: 'Bulk User 3', email: 'bulk3@example.com', role: UserRole.GUEST },
      ];

      const result = await userService.bulkCreateUsers(requests);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(result.data?.map(user => user.name)).toEqual([
        'Bulk User 1',
        'Bulk User 2', 
        'Bulk User 3'
      ]);
    });

    it('should handle partial failures in bulk operations', async () => {
      // Create one user first to cause a conflict
      await userService.createUser({
        name: 'Existing User',
        email: 'existing@example.com',
        role: UserRole.USER,
      });

      const requests: CreateUserRequest[] = [
        { name: 'New User', email: 'new@example.com', role: UserRole.USER },
        { name: 'Conflicting User', email: 'existing@example.com', role: UserRole.ADMIN }, // This will fail
        { name: 'Another New User', email: 'new2@example.com', role: UserRole.GUEST },
      ];

      const result = await userService.bulkCreateUsers(requests);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2); // Only 2 should succeed
    });

    it('should validate bulk request input', async () => {
      const result = await userService.bulkCreateUsers([]);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Valid array of user requests is required');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle service timeout', async () => {
      // Create service with very short timeout
      const shortTimeoutConfig = {
        ...mockConfig,
        timeout: 1, // 1ms timeout
      };

      const shortTimeoutService = new UserService(shortTimeoutConfig);
      await shortTimeoutService.initialize();

      // Mock a slow operation by overriding the operation
      const originalExecuteOperation = (shortTimeoutService as any).executeOperation;
      (shortTimeoutService as any).executeOperation = async function(name: string, operation: any) {
        const slowOperation = async () => {
          await new Promise(resolve => setTimeout(resolve, 100)); // Longer than timeout
          return operation();
        };
        return originalExecuteOperation.call(this, name, slowOperation);
      };

      const result = await shortTimeoutService.createUser({
        name: 'Test User',
        email: 'test@example.com',
        role: UserRole.USER,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('timed out');

      await shortTimeoutService.shutdown();
    });

    it('should track service metrics', async () => {
      // Perform some operations
      await userService.createUser({
        name: 'Metrics User',
        email: 'metrics@example.com',
        role: UserRole.USER,
      });

      await userService.getUserById('non-existent'); // This will fail

      const health = userService.getHealth();
      const metrics = health.data?.metrics;

      expect(metrics?.totalRequests).toBeGreaterThan(0);
      expect(metrics?.successfulRequests).toBeGreaterThan(0);
      expect(metrics?.failedRequests).toBeGreaterThan(0);
      expect(metrics?.averageResponseTime).toBeGreaterThan(0);
      expect(metrics?.lastActivity).toBeInstanceOf(Date);
    });

    it('should handle malformed input gracefully', async () => {
      const result = await userService.createUser(null as any);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Service Events', () => {
    it('should emit events during operations', async () => {
      const mockEmit = jest.fn();
      (userService as any).emit = mockEmit;

      await userService.createUser({
        name: 'Event User',
        email: 'event@example.com',
        role: UserRole.USER,
      });

      expect(mockEmit).toHaveBeenCalledWith('userCreated', expect.any(Object));
    });
  });

  describe('Performance', () => {
    it('should handle reasonable load', async () => {
      const startTime = Date.now();
      const promises = [];

      // Create 50 users concurrently
      for (let i = 0; i < 50; i++) {
        promises.push(userService.createUser({
          name: `Load Test User ${i}`,
          email: `loadtest${i}@example.com`,
          role: UserRole.USER,
        }));
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();

      // All should succeed
      expect(results.every(result => result.success)).toBe(true);

      // Should complete reasonably quickly (less than 5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });
});