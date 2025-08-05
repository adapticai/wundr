/**
 * Sample TypeScript files for testing various scenarios
 */

export const SAMPLE_INTERFACE = `
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: Date;
}
`;

export const DUPLICATE_INTERFACE = `
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: Date;
}
`;

export const SIMILAR_INTERFACE = `
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  profilePicture?: string;
}
`;

export const SAMPLE_CLASS = `
export class UserService {
  private users: User[] = [];

  async getUser(id: string): Promise<User | null> {
    return this.users.find(u => u.id === id) || null;
  }

  async createUser(userData: Omit<User, 'id'>): Promise<User> {
    const user: User = {
      id: Math.random().toString(),
      ...userData,
      createdAt: new Date()
    };
    this.users.push(user);
    return user;
  }
}
`;

export const WRAPPER_CLASS = `
import { UserService } from './user-service';

export class EnhancedUserService extends UserService {
  async getUserWithLogging(id: string): Promise<User | null> {
    console.log(\`Getting user: \${id}\`);
    const user = await this.getUser(id);
    console.log(\`Found user: \${user?.name}\`);
    return user;
  }

  async createUserWithValidation(userData: Omit<User, 'id'>): Promise<User> {
    if (!userData.email.includes('@')) {
      throw new Error('Invalid email');
    }
    return this.createUser(userData);
  }
}
`;

export const COMPLEX_FUNCTION = `
export function processUserData(users: User[]): ProcessedUser[] {
  const result: ProcessedUser[] = [];
  
  for (const user of users) {
    if (user.role === 'admin') {
      if (user.email.includes('@company.com')) {
        if (user.name.length > 5) {
          if (user.createdAt > new Date('2023-01-01')) {
            result.push({
              ...user,
              processed: true,
              priority: 'high'
            });
          } else {
            result.push({
              ...user,
              processed: true,
              priority: 'medium'
            });
          }
        } else {
          result.push({
            ...user,
            processed: true,
            priority: 'low'
          });
        }
      } else {
        result.push({
          ...user,
          processed: false,
          priority: 'low'
        });
      }
    } else {
      if (user.email.includes('@gmail.com')) {
        result.push({
          ...user,
          processed: true,
          priority: 'low'
        });
      } else {
        result.push({
          ...user,
          processed: false,
          priority: 'low'
        });
      }
    }
  }
  
  return result;
}
`;

export const BAD_ERROR_HANDLING = `
export class BadService {
  getUser(id: string): User {
    if (!id) {
      throw 'ID is required'; // Bad: throwing string
    }
    
    const user = database.findUser(id);
    if (!user) {
      throw 'User not found'; // Bad: throwing string
    }
    
    return user;
  }
}
`;

export const OLD_ASYNC_PATTERN = `
export class OldAsyncService {
  getUser(id: string): Promise<User> {
    return database.findUser(id)
      .then(user => {
        if (!user) {
          return Promise.reject('User not found');
        }
        return user;
      })
      .then(user => {
        return this.enrichUser(user);
      })
      .then(enrichedUser => {
        return this.validateUser(enrichedUser);
      });
  }
  
  private enrichUser(user: User): Promise<User> {
    return api.getUserDetails(user.id)
      .then(details => ({ ...user, ...details }));
  }
  
  private validateUser(user: User): Promise<User> {
    return validator.validate(user)
      .then(isValid => {
        if (!isValid) {
          return Promise.reject('Invalid user');
        }
        return user;
      });
  }
}
`;

export const CONST_ENUM_CANDIDATE = `
export const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  MODERATOR: 'moderator',
  GUEST: 'guest'
} as const;

export const STATUS_CODES = {
  SUCCESS: 200,
  NOT_FOUND: 404,
  SERVER_ERROR: 500
} as const;
`;

export const OLD_TYPE_ASSERTION = `
export function parseUserData(data: any): User {
  return <User>data; // Should use 'as User'
}

export function getUserRole(user: any): string {
  return (<User>user).role; // Should use 'as User'
}
`;

export const NO_OPTIONAL_CHAINING = `
export function getUserEmail(user: any): string | undefined {
  return user && user.profile && user.profile.email && user.profile.email.toLowerCase();
}

export function getNestedValue(obj: any): string | undefined {
  return obj && obj.data && obj.data.nested && obj.data.nested.value;
}
`;

export const CIRCULAR_DEPENDENCY_A = `
import { CircularB } from './circular-b';

export class CircularA {
  private b: CircularB;
  
  constructor() {
    this.b = new CircularB();
  }
  
  useB(): void {
    this.b.doSomething();
  }
}
`;

export const CIRCULAR_DEPENDENCY_B = `
import { CircularA } from './circular-a';

export class CircularB {
  createA(): CircularA {
    return new CircularA();
  }
  
  doSomething(): void {
    console.log('Doing something');
  }
}
`;

export const UNUSED_EXPORTS = `
export function usedFunction(): void {
  console.log('This is used');
}

export function unusedFunction(): void {
  console.log('This is never used');
}

export const UNUSED_CONSTANT = 'never used';

export interface UnusedInterface {
  id: string;
}

export class UnusedClass {
  doNothing(): void {}
}
`;

export const INCORRECT_SERVICE_PATTERN = `
export class BadService {
  private isRunning = false;
  
  start(): void {
    this.isRunning = true;
    console.log('Service started');
  }
  
  stop(): void {
    this.isRunning = false;
    console.log('Service stopped');
  }
  
  getStatus(): boolean {
    return this.isRunning;
  }
}
`;

export const GOOD_SERVICE_PATTERN = `
import { BaseService } from '@/services/base';

export class GoodService extends BaseService {
  constructor() {
    super('GoodService');
  }
  
  protected async onStart(): Promise<void> {
    console.log('Service starting...');
  }
  
  protected async onStop(): Promise<void> {
    console.log('Service stopping...');
  }
}
`;

export const UNORDERED_IMPORTS = `
import { User } from './types/user';
import * as fs from 'fs';
import { BaseService } from '@/services/base';
import * as path from 'path';
import { SomeType } from '../other/types';
import { Component } from 'react';
import { helper } from './utils/helper';
`;

export const INTERFACE_WITH_I_PREFIX = `
export interface IUser {
  id: string;
  name: string;
}

export interface IUserService {
  getUser(id: string): Promise<IUser>;
  createUser(user: Omit<IUser, 'id'>): Promise<IUser>;
}
`;

// Configuration files for testing
export const SAMPLE_TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}`;

export const SAMPLE_PACKAGE_JSON = `{
  "name": "test-project",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc",
    "test": "jest"
  },
  "dependencies": {
    "typescript": "^5.0.0"
  }
}`;

// Analysis report samples
export const SAMPLE_ANALYSIS_REPORT = {
  timestamp: '2024-01-01T00:00:00.000Z',
  summary: {
    totalFiles: 10,
    totalEntities: 25,
    duplicateClusters: 3,
    circularDependencies: 1,
    unusedExports: 5,
    codeSmells: 7
  },
  entities: [
    {
      name: 'User',
      type: 'interface',
      file: 'src/types/user.ts',
      line: 1,
      column: 0,
      exportType: 'named',
      normalizedHash: 'abc123',
      dependencies: []
    }
  ],
  duplicates: [
    {
      hash: 'abc123',
      type: 'interface',
      severity: 'high',
      entities: [
        { name: 'User', file: 'src/types/user.ts' },
        { name: 'User', file: 'src/types/duplicate.ts' }
      ],
      structuralMatch: true,
      semanticMatch: true
    }
  ],
  circularDeps: [
    ['src/circular-a.ts', 'src/circular-b.ts', 'src/circular-a.ts']
  ],
  unusedExports: [
    { name: 'unusedFunction', file: 'src/utils.ts' }
  ],
  wrapperPatterns: [
    { base: 'UserService', wrapper: 'EnhancedUserService', confidence: 0.9 }
  ],
  recommendations: []
};