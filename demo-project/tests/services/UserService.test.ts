/**
 * UserService test suite following testing best practices
 */
import { UserService } from '../../src/services/UserService';
import { InMemoryUserRepository } from '../../src/repositories/UserRepository';
import { ValidationError, NotFoundError, ConflictError } from '../../src/utils/errors';

describe('UserService', () => {
  let userService: UserService;
  let userRepository: InMemoryUserRepository;

  beforeEach(async () => {
    userRepository = new InMemoryUserRepository();
    userService = new UserService(userRepository);
    await userService.initialize();
  });

  afterEach(async () => {
    await userService.shutdown();
  });

  describe('createUser', () => {
    const validUserData = {
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      password: 'password123',
    };

    it('should create a user successfully with valid data', async () => {
      const result = await userService.createUser(validUserData);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.email).toBe(validUserData.email);
      expect(result.data!.firstName).toBe(validUserData.firstName);
      expect(result.data!.lastName).toBe(validUserData.lastName);
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.executionTime).toBeGreaterThan(0);
    });

    it('should fail when email is invalid', async () => {
      const result = await userService.createUser({
        ...validUserData,
        email: 'invalid-email',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('VALIDATION_ERROR');
    });

    it('should fail when required fields are missing', async () => {
      const result = await userService.createUser({
        email: '',
        firstName: '',
        lastName: '',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('VALIDATION_ERROR');
    });

    it('should fail when password is too short', async () => {
      const result = await userService.createUser({
        ...validUserData,
        password: 'short',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('BUSINESS_RULE_VIOLATION');
    });

    it('should fail when email already exists', async () => {
      // Create first user
      await userService.createUser(validUserData);

      // Try to create another user with same email
      const result = await userService.createUser(validUserData);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('CONFLICT');
    });
  });

  describe('getUserById', () => {
    it('should retrieve user by ID', async () => {
      // Create a user first
      const createResult = await userService.createUser({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        password: 'password123',
      });

      const userId = createResult.data!.id;

      // Retrieve the user
      const result = await userService.getUserById(userId);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.id).toBe(userId);
    });

    it('should fail when user not found', async () => {
      const result = await userService.getUserById('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('NOT_FOUND');
    });
  });

  describe('updateUser', () => {
    it('should update user email successfully', async () => {
      // Create a user
      const createResult = await userService.createUser({
        email: 'old@example.com',
        firstName: 'John',
        lastName: 'Doe',
        password: 'password123',
      });

      const userId = createResult.data!.id;

      // Update email
      const updateResult = await userService.updateUser(userId, {
        email: 'new@example.com',
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.data!.email).toBe('new@example.com');
    });

    it('should fail when updating to existing email', async () => {
      // Create two users
      await userService.createUser({
        email: 'user1@example.com',
        firstName: 'User',
        lastName: 'One',
        password: 'password123',
      });

      const user2Result = await userService.createUser({
        email: 'user2@example.com',
        firstName: 'User',
        lastName: 'Two',
        password: 'password123',
      });

      // Try to update user2 with user1's email
      const updateResult = await userService.updateUser(user2Result.data!.id, {
        email: 'user1@example.com',
      });

      expect(updateResult.success).toBe(false);
      expect(updateResult.error!.code).toBe('CONFLICT');
    });
  });

  describe('health check', () => {
    it('should report healthy status', async () => {
      const health = await userService.getHealth();

      expect(health.success).toBe(true);
      expect(health.data!.status).toBe('healthy');
      expect(health.data!.metrics).toBeDefined();
    });
  });
});