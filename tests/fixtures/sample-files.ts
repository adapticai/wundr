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
    "test": "jest",
    "analyze": "ts-node scripts/analysis/enhanced-ast-analyzer.ts",
    "consolidate": "ts-node scripts/consolidation/consolidation-manager.ts",
    "standardize": "ts-node scripts/standardization/pattern-standardizer.ts",
    "governance": "ts-node scripts/governance/governance-system.ts"
  },
  "dependencies": {
    "typescript": "^5.0.0",
    "ts-morph": "^20.0.0",
    "@octokit/rest": "^20.0.0"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "@types/node": "^20.0.0"
  }
}`;

// Consolidation batch samples
export const SAMPLE_CONSOLIDATION_BATCH = {
  id: 'batch-2024-01-01-001',
  priority: 'high' as const,
  type: 'duplicates' as const,
  status: 'pending' as const,
  items: [
    {
      hash: 'abc123',
      type: 'interface',
      severity: 'high',
      entities: [
        { name: 'User', file: 'src/types/user.ts', type: 'interface' },
        { name: 'User', file: 'src/types/duplicate.ts', type: 'interface' }
      ]
    }
  ]
};

export const SAMPLE_WRAPPER_BATCH = {
  id: 'wrapper-batch-001',
  priority: 'medium' as const,
  type: 'wrapper-patterns' as const,
  status: 'pending' as const,
  items: [
    {
      base: 'UserService',
      wrapper: 'EnhancedUserService',
      baseFile: 'src/services/user.ts',
      wrapperFile: 'src/services/enhanced-user.ts',
      confidence: 0.9
    }
  ]
};

// Governance samples
export const SAMPLE_DRIFT_REPORT = {
  timestamp: '2024-01-01T12:00:00.000Z',
  baseline: {
    timestamp: '2023-12-01T00:00:00.000Z',
    metrics: {
      totalEntities: 20,
      duplicateCount: 2,
      avgComplexity: 4.5,
      circularDeps: 0,
      unusedExports: 3
    },
    entities: new Map([
      ['src/types/user.ts:User:interface', 'hash123']
    ])
  },
  current: {
    timestamp: '2024-01-01T12:00:00.000Z',
    metrics: {
      totalEntities: 25,
      duplicateCount: 4,
      avgComplexity: 6.2,
      circularDeps: 1,
      unusedExports: 5
    },
    entities: new Map([
      ['src/types/user.ts:User:interface', 'hash123'],
      ['src/types/duplicate.ts:User:interface', 'hash123']
    ])
  },
  drift: {
    newDuplicates: 2,
    removedEntities: 0,
    addedEntities: 5,
    complexityIncrease: 1.7,
    newCircularDeps: 1,
    newUnusedExports: 2,
    violatedStandards: [
      {
        rule: 'no-wrapper-pattern',
        file: 'src/enhanced-service.ts',
        line: 15,
        message: 'Avoid wrapper pattern',
        severity: 'error' as const
      }
    ]
  },
  recommendations: [
    'Fix 2 new duplicates immediately',
    'Address 1 circular dependency'
  ],
  severity: 'high' as const
};

// Error patterns for testing standardization
export const MULTIPLE_ERROR_PATTERNS = `
export class MultiErrorService {
  method1() {
    throw 'String error 1';
  }
  
  method2() {
    throw new Error('Error object');
  }
  
  method3() {
    if (!data) {
      throw 'Another string error';
    }
    return data;
  }
  
  method4() {
    throw new AppError('Already correct', 'TEST_ERROR');
  }
}
`;

// Complex service for lifecycle testing
export const COMPLEX_SERVICE_PATTERN = `
export class ComplexService {
  private isRunning = false;
  private connections: Connection[] = [];
  
  start(): Promise<void> {
    this.isRunning = true;
    return this.initializeConnections();
  }
  
  stop(): Promise<void> {
    this.isRunning = false;
    return this.closeConnections();
  }
  
  restart(): Promise<void> {
    await this.stop();
    await this.start();
  }
  
  getStatus(): boolean {
    return this.isRunning;
  }
  
  private async initializeConnections(): Promise<void> {
    // Complex initialization
  }
  
  private async closeConnections(): Promise<void> {
    // Complex cleanup
  }
}
`;

// Mixed import patterns
export const COMPLEX_IMPORTS = `
import { User } from './types/user';
import * as fs from 'fs';
import { BaseService } from '@/services/base';
import * as path from 'path';
import { Component, useState } from 'react';
import { SomeType } from '../other/types';
import { lodash } from 'lodash';
import { helper } from './utils/helper';
import { config } from '@/config';
import express from 'express';
`;

// Nested optional chaining candidates
export const DEEPLY_NESTED_ACCESS = `
export function getDeepValue(obj: any): string | undefined {
  return obj && obj.data && obj.data.nested && obj.data.nested.deep && obj.data.nested.deep.value;
}

export function getProfile(user: any): any {
  return user && user.profile && user.profile.settings && user.profile.settings.preferences;
}

export function checkPermission(user: any): boolean {
  return user && user.roles && user.roles.admin && user.roles.admin.permissions && user.roles.admin.permissions.write;
}
`;

// Multiple type assertion patterns
export const MIXED_TYPE_ASSERTIONS = `
export function parseData(data: any): UserData {
  const user = <User>data.user;
  const profile = data.profile as Profile;
  const settings = <Settings>data.settings;
  
  return {
    user,
    profile, 
    settings: settings as UserSettings
  };
}

export function transformResponse(response: any): ApiResponse {
  return {
    data: <ResponseData>response.data,
    meta: response.meta as ResponseMeta,
    status: <number>response.status
  };
}
`;

// Complex promise chains for async/await conversion
export const COMPLEX_PROMISE_CHAINS = `
export function processUserWorkflow(userId: string): Promise<WorkflowResult> {
  return database.findUser(userId)
    .then(user => {
      if (!user) {
        throw new Error('User not found');
      }
      return user;
    })
    .then(user => validator.validateUser(user))
    .then(validUser => {
      return api.getUserDetails(validUser.id)
        .then(details => ({ ...validUser, ...details }));
    })
    .then(enrichedUser => {
      return permissions.checkPermissions(enrichedUser.id)
        .then(perms => ({ user: enrichedUser, permissions: perms }));
    })
    .then(result => {
      return workflow.processUser(result.user, result.permissions)
        .then(workflowResult => {
          return audit.logUserActivity(result.user.id, 'workflow_completed')
            .then(() => workflowResult);
        });
    })
    .catch(error => {
      return audit.logError(userId, error.message)
        .then(() => { throw error; });
    });
}
`;

// Multiple enum candidates
export const MULTIPLE_ENUM_CANDIDATES = `
export const HTTP_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500
} as const;

export const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info', 
  WARN: 'warn',
  ERROR: 'error',
  FATAL: 'fatal'
} as const;

export const USER_PERMISSIONS = {
  READ: 'read',
  WRITE: 'write',
  DELETE: 'delete',
  ADMIN: 'admin'
} as const;

// This should NOT be converted (mixed types)
export const CONFIG_OBJECT = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
  retries: 3,
  debug: true
} as const;
`;

// Integration test samples
export const INTEGRATION_PROJECT_FILES = {
  'src/types/user.ts': SAMPLE_INTERFACE,
  'src/types/duplicate-user.ts': DUPLICATE_INTERFACE,
  'src/services/user-service.ts': SAMPLE_CLASS,
  'src/services/enhanced-user-service.ts': WRAPPER_CLASS,
  'src/utils/errors.ts': BAD_ERROR_HANDLING,
  'src/utils/async.ts': OLD_ASYNC_PATTERN,
  'src/constants/enums.ts': CONST_ENUM_CANDIDATE,
  'src/utils/types.ts': OLD_TYPE_ASSERTION,
  'src/utils/access.ts': NO_OPTIONAL_CHAINING,
  'src/imports.ts': UNORDERED_IMPORTS,
  'src/interfaces.ts': INTERFACE_WITH_I_PREFIX,
  'src/services/bad-service.ts': INCORRECT_SERVICE_PATTERN,
  'src/circular-a.ts': CIRCULAR_DEPENDENCY_A,
  'src/circular-b.ts': CIRCULAR_DEPENDENCY_B,
  'src/unused.ts': UNUSED_EXPORTS,
  'tsconfig.json': SAMPLE_TSCONFIG,
  'package.json': SAMPLE_PACKAGE_JSON
};

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