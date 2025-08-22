import { test, expect, Page, BrowserContext } from '@playwright/test';
import { promises as fs } from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

test.describe('Advanced Analysis Features', () => {
  let page: Page;
  let context: BrowserContext;
  let tempDir: string;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    
    // Create temporary directory for advanced analysis tests
    tempDir = path.join(process.cwd(), 'temp-advanced-analysis-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
  });

  test.afterEach(async () => {
    await context.close();
    
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test('should perform architectural analysis on large systems', async () => {
    // 1. Create microservices-style architecture
    await createMicroservicesProject(tempDir);
    
    // 2. Run architectural analysis
    const { stdout } = await execAsync(
      `node ./bin/wundr.js analyze --architecture --service-boundaries --path ${tempDir}`
    );
    
    expect(stdout).toContain('Architectural analysis complete');
    expect(stdout).toContain('Services detected:');
    expect(stdout).toContain('Service boundaries:');
    expect(stdout).toContain('Cross-service dependencies:');
    
    // 3. Visualize architecture in dashboard
    await execAsync(
      `node ./bin/wundr.js analyze --architecture --service-boundaries --report --output ${tempDir}/architecture-analysis.json --path ${tempDir}`
    );
    
    await page.goto('/dashboard/upload');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(tempDir, 'architecture-analysis.json'));
    await page.click('button:has-text("Upload Analysis")');
    
    await page.goto('/dashboard/analysis/architecture');
    
    // Verify architectural visualization
    await expect(page.locator('.architecture-diagram')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.service-node')).count(); expect(count).toBeGreaterThan(5);
    await expect(page.locator('.service-boundary')).count(); expect(count).toBeGreaterThan(3);
    
    // Test service interaction analysis
    await page.click('.service-node:first-child');
    await expect(page.locator('.service-details')).toBeVisible();
    await expect(page.locator('.service-dependencies')).toBeVisible();
    
    // Test boundary violations detection
    await page.click('button:has-text("Show Violations")');
    await expect(page.locator('.boundary-violation')).toBeVisible();
  });

  test('should provide security analysis for large codebases', async () => {
    // 1. Create project with security issues
    await createSecurityTestProject(tempDir);
    
    // 2. Run security analysis
    const { stdout } = await execAsync(
      `node ./bin/wundr.js analyze --security --vulnerabilities --secrets --path ${tempDir}`
    );
    
    expect(stdout).toContain('Security analysis complete');
    expect(stdout).toContain('Vulnerabilities detected:');
    expect(stdout).toContain('Secrets found:');
    expect(stdout).toContain('Security score:');
    
    // 3. Review security results in dashboard
    await execAsync(
      `node ./bin/wundr.js analyze --security --vulnerabilities --secrets --report --output ${tempDir}/security-analysis.json --path ${tempDir}`
    );
    
    await page.goto('/dashboard/upload');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(tempDir, 'security-analysis.json'));
    await page.click('button:has-text("Upload Analysis")');
    
    await page.goto('/dashboard/analysis/security');
    
    // Verify security dashboard
    await expect(page.locator('.security-overview')).toBeVisible();
    await expect(page.locator('.vulnerability-list')).toBeVisible();
    await expect(page.locator('.secrets-detected')).toBeVisible();
    
    // Test vulnerability details
    await page.click('.vulnerability-item:first-child');
    await expect(page.locator('.vulnerability-details')).toBeVisible();
    await expect(page.locator('.remediation-steps')).toBeVisible();
    
    // Test security recommendations
    await expect(page.locator('.security-recommendations')).toBeVisible();
    await expect(page.locator('.recommendation-priority')).toContainText(/High|Medium|Low/);
  });

  test('should generate comprehensive technical debt reports', async () => {
    // 1. Create project with various technical debt patterns
    await createTechnicalDebtProject(tempDir);
    
    // 2. Analyze technical debt
    const { stdout } = await execAsync(
      `node ./bin/wundr.js analyze --tech-debt --complexity --maintainability --path ${tempDir}`
    );
    
    expect(stdout).toContain('Technical debt analysis complete');
    expect(stdout).toContain('Debt ratio:');
    expect(stdout).toContain('Maintenance burden:');
    expect(stdout).toMatch(/Estimated refactoring effort: \d+ hours/);
    
    // 3. Visualize technical debt in dashboard
    await execAsync(
      `node ./bin/wundr.js analyze --tech-debt --complexity --maintainability --report --output ${tempDir}/debt-analysis.json --path ${tempDir}`
    );
    
    await page.goto('/dashboard/upload');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(tempDir, 'debt-analysis.json'));
    await page.click('button:has-text("Upload Analysis")');
    
    await page.goto('/dashboard/analysis/technical-debt');
    
    // Verify debt visualization
    await expect(page.locator('.debt-overview')).toBeVisible();
    await expect(page.locator('.debt-heatmap')).toBeVisible();
    await expect(page.locator('.refactoring-priorities')).toBeVisible();
    
    // Test debt trend analysis
    await page.click('tab:has-text("Trends")');
    await expect(page.locator('.debt-trend-chart')).toBeVisible();
    
    // Test refactoring plan generation
    await page.click('button:has-text("Generate Refactoring Plan")');
    await expect(page.locator('.refactoring-plan')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.refactoring-task')).count(); expect(count).toBeGreaterThan(5);
  });

  test('should detect API design patterns and anti-patterns', async () => {
    // 1. Create project with various API patterns
    await createAPIPatternProject(tempDir);
    
    // 2. Run API analysis
    const { stdout } = await execAsync(
      `node ./bin/wundr.js analyze --api-patterns --rest-compliance --path ${tempDir}`
    );
    
    expect(stdout).toContain('API analysis complete');
    expect(stdout).toContain('REST patterns detected:');
    expect(stdout).toContain('Anti-patterns found:');
    expect(stdout).toContain('API consistency score:');
    
    // 3. Review API analysis in dashboard
    await execAsync(
      `node ./bin/wundr.js analyze --api-patterns --rest-compliance --report --output ${tempDir}/api-analysis.json --path ${tempDir}`
    );
    
    await page.goto('/dashboard/upload');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(tempDir, 'api-analysis.json'));
    await page.click('button:has-text("Upload Analysis")');
    
    await page.goto('/dashboard/analysis/api-patterns');
    
    // Verify API analysis visualization
    await expect(page.locator('.api-overview')).toBeVisible();
    await expect(page.locator('.pattern-compliance')).toBeVisible();
    await expect(page.locator('.anti-pattern-list')).toBeVisible();
    
    // Test pattern details
    await page.click('.pattern-item:first-child');
    await expect(page.locator('.pattern-details')).toBeVisible();
    await expect(page.locator('.compliance-suggestions')).toBeVisible();
  });

  test('should analyze code quality trends over time', async () => {
    // 1. Create project with historical data simulation
    await createVersionedProject(tempDir);
    
    // 2. Run trend analysis
    const { stdout } = await execAsync(
      `node ./bin/wundr.js analyze --trends --historical --versions 5 --path ${tempDir}`
    );
    
    expect(stdout).toContain('Trend analysis complete');
    expect(stdout).toContain('Quality metrics trend:');
    expect(stdout).toContain('Complexity evolution:');
    expect(stdout).toContain('Technical debt progression:');
    
    // 3. Visualize trends in dashboard
    await execAsync(
      `node ./bin/wundr.js analyze --trends --historical --versions 5 --report --output ${tempDir}/trend-analysis.json --path ${tempDir}`
    );
    
    await page.goto('/dashboard/upload');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(tempDir, 'trend-analysis.json'));
    await page.click('button:has-text("Upload Analysis")');
    
    await page.goto('/dashboard/analysis/trends');
    
    // Verify trend visualization
    await expect(page.locator('.trend-overview')).toBeVisible();
    await expect(page.locator('.quality-trend-chart')).toBeVisible();
    await expect(page.locator('.complexity-evolution')).toBeVisible();
    
    // Test trend filtering
    await page.selectOption('select[name="metric-filter"]', 'complexity');
    await page.click('button:has-text("Apply Filter")');
    await expect(page.locator('.filtered-trend-data')).toBeVisible();
    
    // Test prediction analysis
    await page.click('button:has-text("Generate Predictions")');
    await expect(page.locator('.prediction-chart')).toBeVisible({ timeout: 10000 });
  });
});

// Helper functions for creating specialized test projects
async function createMicroservicesProject(dir: string) {
  const services = [
    'user-service', 'auth-service', 'payment-service', 'notification-service',
    'analytics-service', 'reporting-service', 'api-gateway', 'config-service'
  ];
  
  for (const service of services) {
    const serviceDir = path.join(dir, service, 'src');
    await fs.mkdir(serviceDir, { recursive: true });
    
    // Create service structure
    await createServiceStructure(serviceDir, service);
    
    // Create package.json with service dependencies
    const dependencies = services
      .filter(s => s !== service)
      .slice(0, 3)
      .reduce((deps, dep) => ({ ...deps, [dep]: '1.0.0' }), {});
      
    await fs.writeFile(
      path.join(dir, service, 'package.json'),
      JSON.stringify({
        name: service,
        version: '1.0.0',
        dependencies
      }, null, 2)
    );
  }
}

async function createServiceStructure(dir: string, serviceName: string) {
  // Create main service file
  await fs.writeFile(
    path.join(dir, 'service.ts'),
    `
import { ServiceConfig } from './config/config';
import { ServiceRegistry } from './registry/registry';
import { ${serviceName.split('-').map(word => 
  word.charAt(0).toUpperCase() + word.slice(1)
).join('')}Controller } from './controllers/controller';

export class ${serviceName.split('-').map(word => 
  word.charAt(0).toUpperCase() + word.slice(1)
).join('')}Service {
  private config: ServiceConfig;
  private registry: ServiceRegistry;
  private controller: ${serviceName.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join('')}Controller;
  
  constructor() {
    this.config = new ServiceConfig();
    this.registry = new ServiceRegistry();
    this.controller = new ${serviceName.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join('')}Controller();
  }
  
  public async start(): Promise<void> {
    await this.registry.register('${serviceName}', {
      host: this.config.host,
      port: this.config.port,
      health: '/health'
    });
    
    await this.controller.initialize();
  }
  
  public async stop(): Promise<void> {
    await this.controller.shutdown();
    await this.registry.unregister('${serviceName}');
  }
}
    `
  );

  // Create additional service files
  const subdirs = ['controllers', 'config', 'registry', 'models', 'utils'];
  for (const subdir of subdirs) {
    await fs.mkdir(path.join(dir, subdir), { recursive: true });
    
    // Create sample files in each directory
    await fs.writeFile(
      path.join(dir, subdir, `${subdir.slice(0, -1)}.ts`),
      `// ${subdir} implementation for ${serviceName}\nexport class ${subdir.charAt(0).toUpperCase() + subdir.slice(1, -1)} {\n  // Implementation\n}`
    );
  }
}

async function createSecurityTestProject(dir: string) {
  const srcDir = path.join(dir, 'src');
  await fs.mkdir(srcDir, { recursive: true });
  
  // Create files with security issues
  await fs.writeFile(
    path.join(srcDir, 'vulnerable-auth.ts'),
    `
// Hardcoded secrets (security issue)
const API_KEY = 'sk-1234567890abcdef';
const JWT_SECRET = 'super-secret-key';
const DB_PASSWORD = 'admin123';

export class VulnerableAuth {
  // SQL injection vulnerability
  public authenticateUser(username: string, password: string): boolean {
    const query = \`SELECT * FROM users WHERE username = '\${username}' AND password = '\${password}'\`;
    // Direct query execution without sanitization
    return this.executeQuery(query);
  }
  
  // Insecure password storage
  public storePassword(password: string): void {
    localStorage.setItem('password', password); // Plain text storage
  }
  
  // XSS vulnerability
  public displayUserData(userData: any): string {
    return \`<div>\${userData.name}</div>\`; // Unescaped output
  }
  
  private executeQuery(query: string): boolean {
    // Mock implementation
    return Math.random() > 0.5;
  }
}
    `
  );
  
  await fs.writeFile(
    path.join(srcDir, 'insecure-crypto.ts'),
    `
import crypto from 'crypto';

export class InsecureCrypto {
  // Weak encryption algorithm
  public encrypt(data: string): string {
    const cipher = crypto.createCipher('des', 'weak-key'); // Deprecated algorithm
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }
  
  // Predictable random number generation
  public generateToken(): string {
    return Math.random().toString(36); // Not cryptographically secure
  }
  
  // Weak hash function
  public hashPassword(password: string): string {
    return crypto.createHash('md5').update(password).digest('hex'); // MD5 is weak
  }
}
    `
  );
}

async function createTechnicalDebtProject(dir: string) {
  const srcDir = path.join(dir, 'src');
  await fs.mkdir(srcDir, { recursive: true });
  
  // Create refactored system with proper separation of concerns
  await fs.writeFile(
    path.join(srcDir, 'modern-system.ts'),
    `
// Refactored system with proper separation of concerns
interface ProcessResult {
  processed: boolean;
  permissions: Permission[];
  timestamp: number;
  result?: string;
}

interface Permission {
  id: string;
  type: string;
  granted: boolean;
  scope?: string;
}

interface UserData {
  type: 'user';
  status: string;
  permissions: Array<{
    id: string;
    type: string;
    active: boolean;
    validated: boolean;
    scope?: string;
  }>;
}

interface SystemData {
  type: 'system';
  [key: string]: any;
}

type ProcessableData = UserData | SystemData;

// Factory for creating processors
export class ProcessorFactory {
  static createProcessor(dataType: string): DataProcessor {
    switch (dataType) {
      case 'user':
        return new UserProcessor();
      case 'system':
        return new SystemProcessor();
      default:
        return new DefaultProcessor();
    }
  }
}

// Base processor interface
abstract class DataProcessor {
  abstract process(data: ProcessableData): ProcessResult;
}

// User-specific processor
export class UserProcessor extends DataProcessor {
  private permissionHandler = new PermissionHandler();

  process(data: UserData): ProcessResult {
    if (data.status !== 'active') {
      return this.createEmptyResult();
    }

    const adminPermissions = this.findAdminPermissions(data.permissions);
    if (adminPermissions.length === 0) {
      return this.createEmptyResult();
    }

    return this.permissionHandler.processPermissions(adminPermissions);
  }

  private findAdminPermissions(permissions: UserData['permissions']) {
    return permissions.filter(perm => perm.type === 'admin');
  }

  private createEmptyResult(): ProcessResult {
    return {
      processed: false,
      permissions: [],
      timestamp: Date.now(),
      result: 'no admin permissions found'
    };
  }
}

// Permission handling with strategy pattern
export class PermissionHandler {
  processPermissions(permissions: UserData['permissions']): ProcessResult {
    const globalPerms = permissions.filter(p => p.scope === 'global');
    const localPerms = permissions.filter(p => p.scope === 'local');
    
    const processedPermissions = [
      ...this.processPermissionSet(globalPerms, 'global'),
      ...this.processPermissionSet(localPerms, 'local')
    ];

    return {
      processed: true,
      permissions: processedPermissions,
      timestamp: Date.now()
    };
  }

  private processPermissionSet(permissions: UserData['permissions'], scope: string): Permission[] {
    return permissions
      .filter(perm => perm.active && perm.validated)
      .map(perm => ({
        id: perm.id,
        type: perm.type,
        granted: true,
        scope
      }));
  }
}

// System processor
export class SystemProcessor extends DataProcessor {
  process(data: SystemData): ProcessResult {
    // Proper implementation for system data
    return {
      processed: true,
      permissions: [],
      timestamp: Date.now(),
      result: 'system data processed successfully'
    };
  }
}

// Default processor for unknown types
export class DefaultProcessor extends DataProcessor {
  process(data: ProcessableData): ProcessResult {
    return {
      processed: false,
      permissions: [],
      timestamp: Date.now(),
      result: 'unknown data type'
    };
  }
}

// Refactored main system class
export class ModernSystem {
  process(data: ProcessableData): ProcessResult {
    const processor = ProcessorFactory.createProcessor(data.type);
    return processor.process(data);
  }
}
    `
  );
  
  // Create god object example
  await fs.writeFile(
    path.join(srcDir, 'god-object.ts'),
    `
// God object anti-pattern - handles everything
export class DataManager {
  // Too many responsibilities
  
  // Database operations
  public saveUser(user: any): void { /* implementation */ }
  public loadUser(id: string): any { /* implementation */ }
  public deleteUser(id: string): void { /* implementation */ }
  
  // File operations
  public readFile(path: string): string { /* implementation */ }
  public writeFile(path: string, content: string): void { /* implementation */ }
  
  // Network operations
  public sendRequest(url: string): any { /* implementation */ }
  public uploadFile(file: any): void { /* implementation */ }
  
  // Validation
  public validateEmail(email: string): boolean { /* implementation */ }
  public validatePassword(password: string): boolean { /* implementation */ }
  
  // Encryption
  public encrypt(data: string): string { /* implementation */ }
  public decrypt(data: string): string { /* implementation */ }
  
  // Logging
  public log(message: string): void { /* implementation */ }
  public error(error: Error): void { /* implementation */ }
  
  // Configuration
  public getConfig(key: string): any { /* implementation */ }
  public setConfig(key: string, value: any): void { /* implementation */ }
  
  // Too many methods, too many responsibilities
}
    `
  );
}

async function createAPIPatternProject(dir: string) {
  const srcDir = path.join(dir, 'src/api');
  await fs.mkdir(srcDir, { recursive: true });
  
  // Create REST API with various patterns
  await fs.writeFile(
    path.join(srcDir, 'good-api.ts'),
    `
// Well-designed REST API following best practices
export class UserAPI {
  // RESTful endpoints
  public async getUsers(): Promise<User[]> {
    // GET /users - Collection resource
    return this.userService.getAllUsers();
  }
  
  public async getUser(id: string): Promise<User> {
    // GET /users/:id - Resource by ID
    return this.userService.getUserById(id);
  }
  
  public async createUser(userData: CreateUserRequest): Promise<User> {
    // POST /users - Create new resource
    const validatedData = this.validateUserData(userData);
    return this.userService.createUser(validatedData);
  }
  
  public async updateUser(id: string, userData: UpdateUserRequest): Promise<User> {
    // PUT /users/:id - Update resource
    const validatedData = this.validateUserData(userData);
    return this.userService.updateUser(id, validatedData);
  }
  
  public async deleteUser(id: string): Promise<void> {
    // DELETE /users/:id - Delete resource
    await this.userService.deleteUser(id);
  }
  
  // Consistent error handling
  private handleError(error: Error): APIError {
    return {
      code: 'USER_ERROR',
      message: error.message,
      timestamp: new Date().toISOString()
    };
  }
  
  // Proper validation
  private validateUserData(data: any): ValidUserData {
    if (!data.email || !this.isValidEmail(data.email)) {
      throw new ValidationError('Invalid email address');
    }
    
    return data as ValidUserData;
  }
}
    `
  );
  
  // Create API with anti-patterns
  await fs.writeFile(
    path.join(srcDir, 'bad-api.ts'),
    `
// API with various anti-patterns
export class BadAPI {
  // Non-RESTful endpoints
  public async getAllUsersData(): Promise<any> {
    // GET /getAllUsersData - Not RESTful
    return this.database.query('SELECT * FROM users');
  }
  
  public async saveUserToDB(data: any): Promise<any> {
    // POST /saveUserToDB - Exposing implementation details
    return this.database.insert('users', data);
  }
  
  public async modifyUserInfo(id: any, data: any): Promise<any> {
    // PUT /modifyUserInfo/:id - Inconsistent naming
    // No validation
    return this.database.update('users', id, data);
  }
  
  // Inconsistent response formats
  public async getUserStatus(id: string): Promise<any> {
    const user = await this.database.findById('users', id);
    if (user) {
      return { success: true, data: user, code: 200 };
    } else {
      return { error: 'Not found', success: false, errorCode: 404 };
    }
  }
  
  // Poor error handling
  public async deleteUserFromSystem(id: string): Promise<any> {
    try {
      await this.database.delete('users', id);
      return 'User deleted successfully';
    } catch (e) {
      return 'Something went wrong';
    }
  }
  
  // Mixing concerns
  public async getUserAndSendEmail(id: string): Promise<any> {
    const user = await this.database.findById('users', id);
    await this.emailService.sendWelcomeEmail(user.email);
    await this.analytics.trackUserAccess(user.id);
    return user;
  }
}
    `
  );
}

async function createVersionedProject(dir: string) {
  // Simulate multiple versions of the same project
  for (let version = 1; version <= 5; version++) {
    const versionDir = path.join(dir, `v${version}`, 'src');
    await fs.mkdir(versionDir, { recursive: true });
    
    // Create files that evolve over versions
    await createVersionedFiles(versionDir, version);
  }
}

async function createVersionedFiles(dir: string, version: number) {
  // File that gets more complex over time
  const complexity = version * 20; // Increasing complexity
  let content = `// Version ${version} of evolving module\n\n`;
  
  for (let i = 0; i < complexity; i++) {
    content += `
export class EvolvingClass${version}_${i} {
  private complexity = ${version * i};
  
  public process(): any {
    // Complexity increases with version
    let result = 0;
    for (let j = 0; j < ${version * 10}; j++) {
      result += Math.pow(j, ${version});
    }
    return result;
  }
  
  ${version > 2 ? `
  // New method added in version ${version}
  public advancedProcess(): any {
    return this.process() * ${version};
  }
  ` : ''}
  
  ${version > 3 ? `
  // Technical debt introduced in version ${version}
  public legacyMethod(): any {
    // FIXME: This is a hack
    return 'legacy-' + this.complexity;
  }
  ` : ''}
}
    `;
  }
  
  await fs.writeFile(path.join(dir, `evolving-module-v${version}.ts`), content);
  
  // Create metrics file for each version
  await fs.writeFile(
    path.join(dir, `metrics-v${version}.json`),
    JSON.stringify({
      version,
      complexity: version * 50,
      techDebt: version > 2 ? version * 10 : 0,
      codeSmells: Math.pow(version, 2),
      testCoverage: Math.max(90 - version * 5, 60),
      maintainabilityIndex: Math.max(100 - version * 8, 40)
    }, null, 2)
  );
}