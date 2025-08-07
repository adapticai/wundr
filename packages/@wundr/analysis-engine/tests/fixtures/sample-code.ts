/**
 * Sample code for testing analysis engines
 */

// Test interface with duplicates
export interface UserData {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

export interface UserInfo {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

// Complex class for complexity testing
export class ComplexUserService {
  private users: UserData[] = [];
  private cache = new Map<number, UserData>();
  private lastUpdate: Date = new Date();

  constructor(
    private config: any,
    private logger: any,
    private validator: any,
    private emailService: any,
    private database: any,
    private metrics: any
  ) {}

  async createUser(userData: UserData): Promise<UserData> {
    // Complex validation logic
    if (!userData) {
      throw new Error('User data is required');
    }

    if (!userData.name || userData.name.trim().length === 0) {
      throw new Error('Name is required');
    }

    if (!userData.email || !this.isValidEmail(userData.email)) {
      throw new Error('Valid email is required');
    }

    // Nested conditional logic
    if (userData.id) {
      const existingUser = await this.findUserById(userData.id);
      if (existingUser) {
        if (existingUser.email === userData.email) {
          throw new Error('User with this email already exists');
        } else {
          if (existingUser.name === userData.name) {
            throw new Error('User with this name already exists');
          } else {
            if (this.isDuplicateUser(userData, existingUser)) {
              throw new Error('Duplicate user detected');
            }
          }
        }
      }
    }

    // Complex business logic
    try {
      const validatedData = await this.validateUserData(userData);
      const processedData = await this.processUserData(validatedData);
      const savedData = await this.saveUser(processedData);
      
      if (savedData) {
        this.cache.set(savedData.id, savedData);
        this.users.push(savedData);
        await this.sendWelcomeEmail(savedData);
        this.updateMetrics('user_created');
        this.lastUpdate = new Date();
        
        // More nested logic
        if (this.config.enableNotifications) {
          if (this.config.notificationTypes.includes('email')) {
            await this.sendNotification(savedData, 'email');
          }
          if (this.config.notificationTypes.includes('sms')) {
            if (savedData.phoneNumber) {
              await this.sendNotification(savedData, 'sms');
            }
          }
        }
        
        return savedData;
      } else {
        throw new Error('Failed to save user');
      }
    } catch (error) {
      this.logger.error('Error creating user', error);
      this.updateMetrics('user_creation_failed');
      throw error;
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private async validateUserData(userData: UserData): Promise<UserData> {
    // Simulate complex validation
    if (this.validator) {
      return await this.validator.validate(userData);
    }
    return userData;
  }

  private async processUserData(userData: UserData): Promise<UserData> {
    // Simulate data processing
    return {
      ...userData,
      createdAt: new Date(),
      id: userData.id || Math.floor(Math.random() * 10000)
    };
  }

  private async saveUser(userData: UserData): Promise<UserData> {
    if (this.database) {
      return await this.database.save('users', userData);
    }
    return userData;
  }

  private async findUserById(id: number): Promise<UserData | null> {
    if (this.cache.has(id)) {
      return this.cache.get(id) || null;
    }
    
    if (this.database) {
      const user = await this.database.findById('users', id);
      if (user) {
        this.cache.set(id, user);
      }
      return user;
    }
    
    return this.users.find(u => u.id === id) || null;
  }

  private isDuplicateUser(user1: UserData, user2: UserData): boolean {
    return user1.email === user2.email || 
           (user1.name === user2.name && user1.id === user2.id);
  }

  private async sendWelcomeEmail(user: UserData): Promise<void> {
    if (this.emailService) {
      await this.emailService.send({
        to: user.email,
        subject: 'Welcome!',
        template: 'welcome',
        data: { name: user.name }
      });
    }
  }

  private async sendNotification(user: UserData, type: 'email' | 'sms'): Promise<void> {
    // Complex notification logic
    try {
      if (type === 'email' && this.emailService) {
        await this.emailService.send({
          to: user.email,
          subject: 'Notification',
          template: 'notification',
          data: user
        });
      } else if (type === 'sms' && this.config.smsService) {
        await this.config.smsService.send({
          to: (user as any).phoneNumber,
          message: `Hello ${user.name}!`
        });
      }
    } catch (error) {
      this.logger.error(`Failed to send ${type} notification`, error);
    }
  }

  private updateMetrics(event: string): void {
    if (this.metrics) {
      this.metrics.increment(`user_service.${event}`);
    }
  }
}

// Duplicate service (for testing duplicate detection)
export class UserService {
  private users: UserInfo[] = [];
  private cache = new Map<number, UserInfo>();
  private lastUpdate: Date = new Date();

  constructor(
    private config: any,
    private logger: any,
    private validator: any,
    private emailService: any,
    private database: any
  ) {}

  async createUser(userInfo: UserInfo): Promise<UserInfo> {
    if (!userInfo) {
      throw new Error('User info is required');
    }

    if (!userInfo.name || userInfo.name.trim().length === 0) {
      throw new Error('Name is required');
    }

    const savedUser = await this.database.save('users', userInfo);
    this.cache.set(savedUser.id, savedUser);
    this.users.push(savedUser);
    
    return savedUser;
  }
}

// Simple utility function
export function formatUserName(user: UserData): string {
  return `${user.name} (${user.email})`;
}

// Another utility with similar logic (for duplicate detection)
export function displayUserName(user: UserInfo): string {
  return `${user.name} (${user.email})`;
}

// Wrapper pattern example
export class EnhancedUserService extends UserService {
  constructor(
    config: any,
    logger: any,
    validator: any,
    emailService: any,
    database: any,
    private analytics: any
  ) {
    super(config, logger, validator, emailService, database);
  }

  async createUser(userInfo: UserInfo): Promise<UserInfo> {
    const result = await super.createUser(userInfo);
    
    // Enhanced functionality
    if (this.analytics) {
      this.analytics.track('user_created', result);
    }
    
    return result;
  }
}