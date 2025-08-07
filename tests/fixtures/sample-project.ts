/**
 * Sample project structures for testing
 */

export interface TestProject {
  name: string;
  files: TestFile[];
  packageJson?: any;
}

export interface TestFile {
  path: string;
  content: string;
}

export const SAMPLE_TYPESCRIPT_PROJECT: TestProject = {
  name: 'sample-typescript-project',
  files: [
    {
      path: 'src/index.ts',
      content: `
import { UserService } from './services/UserService';
import { EmailValidator } from './utils/EmailValidator';

export class App {
  private userService = new UserService();
  private emailValidator = new EmailValidator();
  
  async start(): Promise<void> {
    console.log('Starting application...');
    const users = await this.userService.getUsers();
    console.log(\`Loaded \${users.length} users\`);
  }
}

const app = new App();
app.start().catch(console.error);
`
    },
    {
      path: 'src/services/UserService.ts',
      content: `
export interface User {
  id: string;
  email: string;
  name: string;
  active: boolean;
}

export class UserService {
  private users: User[] = [];
  
  async getUsers(): Promise<User[]> {
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.users);
      }, 100);
    });
  }
  
  async createUser(userData: Omit<User, 'id'>): Promise<User> {
    const user: User = {
      id: Math.random().toString(36).substr(2, 9),
      ...userData
    };
    
    this.users.push(user);
    return user;
  }
  
  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const userIndex = this.users.findIndex(user => user.id === id);
    if (userIndex === -1) return null;
    
    this.users[userIndex] = { ...this.users[userIndex], ...updates };
    return this.users[userIndex];
  }
  
  async deleteUser(id: string): Promise<boolean> {
    const userIndex = this.users.findIndex(user => user.id === id);
    if (userIndex === -1) return false;
    
    this.users.splice(userIndex, 1);
    return true;
  }
}
`
    },
    {
      path: 'src/utils/EmailValidator.ts',
      content: `
export class EmailValidator {
  private static readonly EMAIL_REGEX = /^[^@]+@[^@]+\\.[^@]+$/;
  
  validate(email: string): boolean {
    if (!email || typeof email !== 'string') {
      return false;
    }
    
    return EmailValidator.EMAIL_REGEX.test(email.trim());
  }
  
  validateAndNormalize(email: string): string | null {
    const trimmed = email?.trim();
    if (!this.validate(trimmed)) {
      return null;
    }
    
    return trimmed.toLowerCase();
  }
}
`
    },
    {
      path: 'src/models/BaseModel.ts',
      content: `
export abstract class BaseModel {
  protected created: Date;
  protected modified: Date;
  
  constructor() {
    this.created = new Date();
    this.modified = new Date();
  }
  
  updateModified(): void {
    this.modified = new Date();
  }
  
  getCreated(): Date {
    return this.created;
  }
  
  getModified(): Date {
    return this.modified;
  }
}
`
    },
    {
      path: 'src/types/common.ts',
      content: `
export type ApiResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
};

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
`
    }
  ],
  packageJson: {
    name: 'sample-typescript-project',
    version: '1.0.0',
    description: 'A sample TypeScript project for testing',
    main: 'dist/index.js',
    scripts: {
      build: 'tsc',
      start: 'node dist/index.js',
      test: 'jest'
    },
    dependencies: {},
    devDependencies: {
      '@types/node': '^20.0.0',
      typescript: '^5.0.0',
      jest: '^29.0.0'
    }
  }
};

export const PROJECT_WITH_DUPLICATES: TestProject = {
  name: 'project-with-duplicates',
  files: [
    {
      path: 'src/auth/AuthService.ts',
      content: `
// Duplicate validation function
function validateEmail(email: string): boolean {
  return /^[^@]+@[^@]+\\.[^@]+$/.test(email);
}

export class AuthService {
  async login(email: string, password: string): Promise<boolean> {
    if (!validateEmail(email)) {
      throw new Error('Invalid email format');
    }
    
    // Login logic here
    return true;
  }
}
`
    },
    {
      path: 'src/user/UserValidator.ts',
      content: `
// Duplicate validation function
function validateEmail(email: string): boolean {
  return /^[^@]+@[^@]+\\.[^@]+$/.test(email);
}

export class UserValidator {
  static isValidEmail(email: string): boolean {
    return validateEmail(email);
  }
}
`
    },
    {
      path: 'src/forms/ContactForm.ts',
      content: `
// Duplicate validation function
function validateEmail(email: string): boolean {
  return /^[^@]+@[^@]+\\.[^@]+$/.test(email);
}

export class ContactForm {
  private email: string = '';
  
  setEmail(email: string): void {
    if (!validateEmail(email)) {
      throw new Error('Invalid email');
    }
    this.email = email;
  }
}
`
    }
  ]
};

export const PROJECT_WITH_CIRCULAR_DEPS: TestProject = {
  name: 'project-with-circular-deps',
  files: [
    {
      path: 'src/moduleA.ts',
      content: `
import { functionB } from './moduleB';

export function functionA(): string {
  return 'A -> ' + functionB();
}
`
    },
    {
      path: 'src/moduleB.ts',
      content: `
import { functionC } from './moduleC';

export function functionB(): string {
  return 'B -> ' + functionC();
}
`
    },
    {
      path: 'src/moduleC.ts',
      content: `
import { functionA } from './moduleA';

export function functionC(): string {
  return 'C -> ' + functionA();
}
`
    }
  ]
};

export const PROJECT_WITH_PATTERN_ISSUES: TestProject = {
  name: 'project-with-pattern-issues',
  files: [
    {
      path: 'src/ErrorHandling.ts',
      content: `
export class ErrorHandler {
  handle(error: any): void {
    if (typeof error === 'string') {
      throw 'Error occurred: ' + error; // Issue: string throw
    }
    
    if (error && error.type === 'validation') {
      throw 'Validation failed'; // Issue: string throw
    }
    
    throw new Error('Unknown error');
  }
}
`
    },
    {
      path: 'src/AsyncPatterns.ts',
      content: `
export class AsyncPatterns {
  async fetchData(): Promise<any> {
    return fetch('/api/data')
      .then(response => response.json())  // Issue: promise chain instead of async/await
      .then(data => this.processData(data))
      .catch(error => {
        throw 'Fetch failed: ' + error; // Issue: string throw
      });
  }
  
  private processData(data: any): any {
    return data && data.items ? data.items : []; // Issue: no optional chaining
  }
}
`
    },
    {
      path: 'src/TypeAssertions.ts',
      content: `
export class TypeAssertions {
  process<T>(data: unknown): T {
    return <T>data; // Issue: angle bracket type assertion instead of 'as'
  }
  
  processArray(items: any[]): string[] {
    return items.map(item => <string>item); // Issue: angle bracket type assertion
  }
}
`
    }
  ]
};

export const LARGE_PROJECT_GENERATOR = {
  generateProject(fileCount: number): TestProject {
    const files: TestFile[] = [];
    
    for (let i = 0; i < fileCount; i++) {
      files.push({
        path: \`src/modules/Module\${i}.ts\`,
        content: \`
export interface Module\${i}Data {
  id: number;
  name: string;
  value: number;
}

export class Module\${i} {
  private data: Module\${i}Data[] = [];
  
  constructor() {
    this.initialize();
  }
  
  private initialize(): void {
    for (let j = 0; j < 10; j++) {
      this.data.push({
        id: j + \${i} * 10,
        name: \`Item \${j} from Module \${i}\`,
        value: Math.random() * 100
      });
    }
  }
  
  getData(): Module\${i}Data[] {
    return [...this.data];
  }
  
  findById(id: number): Module\${i}Data | undefined {
    return this.data.find(item => item.id === id);
  }
  
  updateValue(id: number, value: number): boolean {
    const item = this.findById(id);
    if (item) {
      item.value = value;
      return true;
    }
    return false;
  }
  
  getAverageValue(): number {
    if (this.data.length === 0) return 0;
    return this.data.reduce((sum, item) => sum + item.value, 0) / this.data.length;
  }
}
\`
      });
    }
    
    // Add an index file that imports all modules
    const imports = Array.from({ length: fileCount }, (_, i) => 
      \`export { Module\${i} } from './modules/Module\${i}';\`
    ).join('\\n');
    
    files.push({
      path: 'src/index.ts',
      content: imports
    });
    
    return {
      name: \`large-project-\${fileCount}-files\`,
      files,
      packageJson: {
        name: \`large-project-\${fileCount}\`,
        version: '1.0.0',
        description: \`A large TypeScript project with \${fileCount} modules\`
      }
    };
  }
};

export const TEST_FIXTURES = {
  SAMPLE_TYPESCRIPT_PROJECT,
  PROJECT_WITH_DUPLICATES,
  PROJECT_WITH_CIRCULAR_DEPS,
  PROJECT_WITH_PATTERN_ISSUES,
  LARGE_PROJECT_GENERATOR
};