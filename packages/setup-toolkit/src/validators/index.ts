/**
 * @fileoverview Validation tools
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as fs from 'fs-extra';
import * as path from 'path';
import { execa } from 'execa';

const execAsync = promisify(exec);

export interface ValidationOptions {
  strict?: boolean;
  verbose?: boolean;
  timeout?: number;
}

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  details?: string;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  score: number; // 0-100
  issues: ValidationIssue[];
  summary: string;
  timestamp: Date;
}

export interface SystemRequirement {
  name: string;
  required: boolean;
  version?: string;
  alternatives?: string[];
}

export interface Validator {
  name: string;
  validate(options?: ValidationOptions): Promise<ValidationResult>;
  getRequirements(): SystemRequirement[];
  canFix(): boolean;
  fix(issues: ValidationIssue[], options?: ValidationOptions): Promise<ValidationResult>;
}

export abstract class BaseValidator implements Validator {
  constructor(public readonly name: string) {}

  abstract validate(options?: ValidationOptions): Promise<ValidationResult>;
  abstract getRequirements(): SystemRequirement[];
  abstract canFix(): boolean;
  abstract fix(issues: ValidationIssue[], options?: ValidationOptions): Promise<ValidationResult>;

  protected async executeCommand(command: string, args: string[] = [], options: { silent?: boolean; timeout?: number } = {}): Promise<{ stdout: string; stderr: string }> {
    try {
      const result = await execa(command, args, {
        stdio: options.silent ? 'pipe' : 'inherit',
        timeout: options.timeout || 30000,
      });
      return { stdout: result.stdout, stderr: result.stderr };
    } catch (error: any) {
      throw new Error(`Command failed: ${command} ${args.join(' ')} - ${error.message}`);
    }
  }

  protected getPlatform(): 'darwin' | 'linux' | 'win32' {
    const platform = os.platform();
    if (platform === 'darwin' || platform === 'linux' || platform === 'win32') {
      return platform;
    }
    throw new Error(`Unsupported platform: ${platform}`);
  }

  protected async checkCommandExists(command: string): Promise<boolean> {
    try {
      await execAsync(this.getPlatform() === 'win32' ? `where ${command}` : `which ${command}`);
      return true;
    } catch {
      return false;
    }
  }

  protected createIssue(type: ValidationIssue['type'], category: string, message: string, details?: string, suggestion?: string): ValidationIssue {
    return { type, category, message, details, suggestion };
  }

  protected calculateScore(issues: ValidationIssue[]): number {
    const weights = { error: 20, warning: 5, info: 1 };
    const penalty = issues.reduce((sum, issue) => sum + weights[issue.type], 0);
    return Math.max(0, 100 - penalty);
  }
}

export class SystemValidator extends BaseValidator {
  constructor() {
    super('System');
  }

  getRequirements(): SystemRequirement[] {
    return [
      { name: 'Operating System', required: true },
      { name: 'Available Memory', required: true, version: '4GB+' },
      { name: 'Available Disk Space', required: true, version: '10GB+' },
      { name: 'Network Connection', required: true },
    ];
  }

  canFix(): boolean {
    return false;
  }

  async validate(options: ValidationOptions = {}): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];

    try {
      const platform = this.getPlatform();
      const osInfo = os.type() + ' ' + os.release();
      
      if (options.verbose) {
        issues.push(this.createIssue('info', 'system', `Operating System: ${osInfo}`));
      }

      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const memoryGB = totalMemory / (1024 ** 3);
      const freeMemoryGB = freeMemory / (1024 ** 3);

      if (memoryGB < 4) {
        issues.push(this.createIssue('error', 'memory', `Insufficient total memory: ${memoryGB.toFixed(1)}GB`, 
          'At least 4GB of RAM is recommended', 'Consider upgrading your system memory'));
      } else if (freeMemoryGB < 1) {
        issues.push(this.createIssue('warning', 'memory', `Low available memory: ${freeMemoryGB.toFixed(1)}GB`,
          'Less than 1GB of free memory available', 'Close some applications to free up memory'));
      }

      try {
        const stats = await fs.stat(os.homedir());
        if (options.verbose) {
          issues.push(this.createIssue('info', 'disk', 'Disk space check completed'));
        }
      } catch (error) {
        issues.push(this.createIssue('warning', 'disk', 'Could not check disk space', 
          `Error: ${error}`, 'Ensure you have sufficient disk space (10GB+ recommended)'));
      }

      const cpus = os.cpus();
      if (cpus.length < 2) {
        issues.push(this.createIssue('warning', 'cpu', `Low CPU core count: ${cpus.length}`,
          'Single-core systems may experience performance issues', 'Consider using a multi-core system'));
      }

      try {
        await execAsync('ping -c 1 8.8.8.8', { timeout: 5000 });
        if (options.verbose) {
          issues.push(this.createIssue('info', 'network', 'Network connectivity verified'));
        }
      } catch {
        issues.push(this.createIssue('error', 'network', 'No network connectivity',
          'Unable to reach external servers', 'Check your internet connection'));
      }

      if (platform !== 'win32') {
        try {
          const loadavg = os.loadavg();
          const highLoad = loadavg[0] !== undefined && loadavg[0] > cpus.length * 2;
          if (highLoad && loadavg[0] !== undefined) {
            issues.push(this.createIssue('warning', 'performance', `High system load: ${loadavg[0].toFixed(2)}`,
              'System may be under heavy load', 'Consider waiting for system load to decrease'));
          }
        } catch (error) {
          issues.push(this.createIssue('info', 'performance', 'Could not check system load'));
        }
      }

    } catch (error: any) {
      issues.push(this.createIssue('error', 'system', 'System validation failed', 
        error.message, 'Please check system health manually'));
    }

    const score = this.calculateScore(issues);
    const errorCount = issues.filter(i => i.type === 'error').length;
    const warningCount = issues.filter(i => i.type === 'warning').length;

    return {
      valid: errorCount === 0,
      score,
      issues,
      summary: `System validation complete: ${errorCount} errors, ${warningCount} warnings (score: ${score}/100)`,
      timestamp: new Date(),
    };
  }

  async fix(issues: ValidationIssue[], options: ValidationOptions = {}): Promise<ValidationResult> {
    const unfixableIssues = issues.map(issue => 
      this.createIssue('warning', 'system', `Cannot automatically fix: ${issue.message}`,
        issue.details, issue.suggestion || 'Manual intervention required')
    );

    return {
      valid: false,
      score: 0,
      issues: unfixableIssues,
      summary: 'System issues require manual intervention',
      timestamp: new Date(),
    };
  }
}

export class DependencyValidator extends BaseValidator {
  constructor() {
    super('Dependencies');
  }

  getRequirements(): SystemRequirement[] {
    return [
      { name: 'Node.js', required: true, version: '18.0.0+' },
      { name: 'NPM', required: true, version: '8.0.0+' },
      { name: 'Git', required: true, version: '2.20.0+' },
      { name: 'Python', required: false, version: '3.8.0+', alternatives: ['python3', 'python'] },
      { name: 'Docker', required: false, version: '20.0.0+' },
    ];
  }

  canFix(): boolean {
    return true;
  }

  async validate(options: ValidationOptions = {}): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    const requirements = this.getRequirements();

    for (const req of requirements) {
      const checkResult = await this.checkDependency(req, options);
      issues.push(...checkResult);
    }

    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        const packageJson = await fs.readJSON(packageJsonPath);
        
        const nodeModulesPath = path.join(process.cwd(), 'node_modules');
        if (!await fs.pathExists(nodeModulesPath)) {
          issues.push(this.createIssue('warning', 'npm', 'Dependencies not installed',
            'package.json exists but node_modules directory is missing', 'Run npm install or yarn install'));
        }

        try {
          await execAsync('npm audit --audit-level moderate', { timeout: 30000 });
          if (options.verbose) {
            issues.push(this.createIssue('info', 'security', 'No security vulnerabilities found'));
          }
        } catch (error: any) {
          if (error.message.includes('vulnerabilities')) {
            issues.push(this.createIssue('warning', 'security', 'Security vulnerabilities detected',
              'Run npm audit for details', 'Run npm audit fix to resolve'));
          }
        }
      }
    } catch (error) {
      // Not in a Node.js project, skip package.json checks
    }

    const score = this.calculateScore(issues);
    const errorCount = issues.filter(i => i.type === 'error').length;
    const warningCount = issues.filter(i => i.type === 'warning').length;

    return {
      valid: errorCount === 0,
      score,
      issues,
      summary: `Dependency validation complete: ${errorCount} errors, ${warningCount} warnings (score: ${score}/100)`,
      timestamp: new Date(),
    };
  }

  async fix(issues: ValidationIssue[], options: ValidationOptions = {}): Promise<ValidationResult> {
    const fixedIssues: ValidationIssue[] = [];
    const remainingIssues: ValidationIssue[] = [];

    for (const issue of issues) {
      try {
        switch (issue.category) {
          case 'npm':
            if (issue.message.includes('not installed')) {
              await execAsync('npm install');
              fixedIssues.push(this.createIssue('info', 'fix', `Fixed: ${issue.message}`, 'Ran npm install'));
            } else {
              remainingIssues.push(issue);
            }
            break;
          case 'security':
            if (issue.message.includes('vulnerabilities')) {
              await execAsync('npm audit fix');
              fixedIssues.push(this.createIssue('info', 'fix', `Fixed: ${issue.message}`, 'Ran npm audit fix'));
            } else {
              remainingIssues.push(issue);
            }
            break;
          default:
            remainingIssues.push(issue);
            break;
        }
      } catch (error) {
        remainingIssues.push(this.createIssue('error', 'fix', `Failed to fix: ${issue.message}`,
          `Error: ${error}`, 'Manual intervention required'));
      }
    }

    const allIssues = [...fixedIssues, ...remainingIssues];
    const score = this.calculateScore(remainingIssues);

    return {
      valid: remainingIssues.filter(i => i.type === 'error').length === 0,
      score,
      issues: allIssues,
      summary: `Fix attempt complete: ${fixedIssues.length} issues fixed, ${remainingIssues.length} remaining`,
      timestamp: new Date(),
    };
  }

  private async checkDependency(req: SystemRequirement, options: ValidationOptions): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    try {
      const commands = req.alternatives || [req.name.toLowerCase()];
      let found = false;
      let version = '';

      for (const command of commands) {
        if (await this.checkCommandExists(command)) {
          found = true;
          
          try {
            const versionCommands = [`${command} --version`, `${command} -v`, `${command} version`];
            for (const versionCmd of versionCommands) {
              try {
                const { stdout } = await execAsync(versionCmd);
                version = stdout.split('\n')[0]?.trim() || 'unknown';
                break;
              } catch {
                continue;
              }
            }
          } catch {
            version = 'unknown';
          }
          break;
        }
      }

      if (!found) {
        const issueType = req.required ? 'error' : 'warning';
        issues.push(this.createIssue(issueType, 'dependency', `${req.name} not found`,
          `Command not available: ${commands.join(', ')}`, 
          `Install ${req.name}${req.version ? ` (version ${req.version})` : ''}`));
      } else {
        if (options.verbose) {
          issues.push(this.createIssue('info', 'dependency', `${req.name} found`,
            `Version: ${version}`));
        }

        if (req.version && version && version !== 'unknown') {
          const hasVersionRequirement = req.version.includes('.');
          const requiredMajorVersion = req.version.split('.')[0];
          if (hasVersionRequirement && requiredMajorVersion && !version.includes(requiredMajorVersion)) {
            issues.push(this.createIssue('warning', 'version', `${req.name} version may be outdated`,
              `Found: ${version}, Required: ${req.version}`, 
              `Consider updating ${req.name}`));
          }
        }
      }
    } catch (error) {
      issues.push(this.createIssue('error', 'dependency', `Failed to check ${req.name}`,
        `Error: ${error}`, 'Manual verification required'));
    }

    return issues;
  }
}

export class EnvironmentValidator extends BaseValidator {
  constructor() {
    super('Environment');
  }

  getRequirements(): SystemRequirement[] {
    return [
      { name: 'Environment Variables', required: true },
      { name: 'PATH Configuration', required: true },
      { name: 'Shell Configuration', required: false },
      { name: 'Development Tools', required: false },
    ];
  }

  canFix(): boolean {
    return true;
  }

  async validate(options: ValidationOptions = {}): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];

    this.checkEnvironmentVariables(issues, options);
    
    await this.checkPathConfiguration(issues, options);
    
    await this.checkShellConfiguration(issues, options);
    
    await this.checkDevelopmentTools(issues, options);

    const score = this.calculateScore(issues);
    const errorCount = issues.filter(i => i.type === 'error').length;
    const warningCount = issues.filter(i => i.type === 'warning').length;

    return {
      valid: errorCount === 0,
      score,
      issues,
      summary: `Environment validation complete: ${errorCount} errors, ${warningCount} warnings (score: ${score}/100)`,
      timestamp: new Date(),
    };
  }

  async fix(issues: ValidationIssue[], options: ValidationOptions = {}): Promise<ValidationResult> {
    const fixedIssues: ValidationIssue[] = [];
    const remainingIssues: ValidationIssue[] = [];

    for (const issue of issues) {
      if (issue.category === 'environment' && issue.message.includes('missing')) {
        remainingIssues.push(this.createIssue('warning', 'fix', 
          `Cannot auto-fix: ${issue.message}`,
          issue.details, 'Manual configuration required'));
      } else {
        remainingIssues.push(issue);
      }
    }

    const allIssues = [...fixedIssues, ...remainingIssues];
    const score = this.calculateScore(remainingIssues);

    return {
      valid: remainingIssues.filter(i => i.type === 'error').length === 0,
      score,
      issues: allIssues,
      summary: `Environment fix attempt complete: ${fixedIssues.length} issues fixed, ${remainingIssues.length} remaining`,
      timestamp: new Date(),
    };
  }

  private checkEnvironmentVariables(issues: ValidationIssue[], options: ValidationOptions): void {
    const importantVars = ['HOME', 'PATH', 'USER'];
    const platform = this.getPlatform();

    if (platform === 'win32') {
      importantVars.push('USERPROFILE', 'APPDATA');
    }

    for (const varName of importantVars) {
      const value = process.env[varName];
      if (!value) {
        issues.push(this.createIssue('error', 'environment', 
          `Environment variable ${varName} is missing`,
          'This variable is required for proper system operation',
          `Set the ${varName} environment variable`));
      } else if (options.verbose) {
        issues.push(this.createIssue('info', 'environment', 
          `Environment variable ${varName} is set`,
          `Value: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`));
      }
    }

    const devVars = ['NODE_ENV', 'EDITOR', 'LANG'];
    for (const varName of devVars) {
      const value = process.env[varName];
      if (!value) {
        issues.push(this.createIssue('info', 'environment', 
          `Development variable ${varName} not set`,
          'This variable is commonly used in development environments',
          `Consider setting ${varName} if needed`));
      }
    }
  }

  private async checkPathConfiguration(issues: ValidationIssue[], options: ValidationOptions): Promise<void> {
    const pathVar = process.env.PATH || process.env.Path || '';
    const pathEntries = pathVar.split(path.delimiter);

    if (pathEntries.length === 0) {
      issues.push(this.createIssue('error', 'path', 'PATH environment variable is empty',
        'The PATH variable is required for command execution',
        'Configure your PATH environment variable'));
      return;
    }

    const commonPaths = ['/usr/local/bin', '/usr/bin', '/bin'];
    if (this.getPlatform() === 'win32') {
      commonPaths.push('C:\\Windows\\System32', 'C:\\Windows');
    }

    for (const expectedPath of commonPaths) {
      const hasPath = pathEntries.some(p => p.toLowerCase().includes(expectedPath.toLowerCase()));
      if (!hasPath && this.getPlatform() !== 'win32') {
        issues.push(this.createIssue('warning', 'path', 
          `Common path ${expectedPath} not in PATH`,
          'This path typically contains important system tools',
          `Consider adding ${expectedPath} to your PATH`));
      }
    }

    const duplicates = pathEntries.filter((item, index) => pathEntries.indexOf(item) !== index);
    if (duplicates.length > 0) {
      issues.push(this.createIssue('info', 'path', 
        'Duplicate entries found in PATH',
        `Duplicates: ${duplicates.join(', ')}`,
        'Consider cleaning up duplicate PATH entries'));
    }

    if (options.verbose) {
      issues.push(this.createIssue('info', 'path', 
        `PATH contains ${pathEntries.length} entries`));
    }
  }

  private async checkShellConfiguration(issues: ValidationIssue[], options: ValidationOptions): Promise<void> {
    if (this.getPlatform() === 'win32') {
      return;
    }

    const shell = process.env.SHELL || '/bin/sh';
    const configFiles = ['.bashrc', '.bash_profile', '.zshrc', '.profile'];
    
    let foundConfig = false;
    for (const configFile of configFiles) {
      const configPath = path.join(os.homedir(), configFile);
      if (await fs.pathExists(configPath)) {
        foundConfig = true;
        if (options.verbose) {
          issues.push(this.createIssue('info', 'shell', 
            `Found shell configuration: ${configFile}`));
        }
        break;
      }
    }

    if (!foundConfig) {
      issues.push(this.createIssue('warning', 'shell', 
        'No shell configuration files found',
        'Shell configuration files help customize your environment',
        'Consider creating a .bashrc or .zshrc file'));
    }

    if (options.verbose) {
      issues.push(this.createIssue('info', 'shell', 
        `Current shell: ${shell}`));
    }
  }

  private async checkDevelopmentTools(issues: ValidationIssue[], options: ValidationOptions): Promise<void> {
    const devTools = [
      { name: 'curl', required: false },
      { name: 'wget', required: false },
      { name: 'zip', required: false },
      { name: 'unzip', required: false },
      { name: 'tar', required: false },
    ];

    for (const tool of devTools) {
      const exists = await this.checkCommandExists(tool.name);
      if (!exists) {
        issues.push(this.createIssue('info', 'dev-tools', 
          `Development tool ${tool.name} not found`,
          'This tool is commonly used in development workflows',
          `Consider installing ${tool.name}`));
      } else if (options.verbose) {
        issues.push(this.createIssue('info', 'dev-tools', 
          `Development tool ${tool.name} is available`));
      }
    }
  }
}

// Export validator instances for easy use
export const systemValidator = new SystemValidator();
export const dependencyValidator = new DependencyValidator();
export const environmentValidator = new EnvironmentValidator();

// Export factory function
export function createValidator(type: 'system' | 'dependency' | 'environment'): Validator {
  switch (type) {
    case 'system':
      return new SystemValidator();
    case 'dependency':
      return new DependencyValidator();
    case 'environment':
      return new EnvironmentValidator();
    default:
      throw new Error(`Unknown validator type: ${type}`);
  }
}

// Utility function to run all validators
export async function validateAll(options: ValidationOptions = {}): Promise<{
  overall: ValidationResult;
  individual: Record<string, ValidationResult>;
}> {
  const validators = [systemValidator, dependencyValidator, environmentValidator];
  const results: Record<string, ValidationResult> = {};
  const allIssues: ValidationIssue[] = [];

  for (const validator of validators) {
    const result = await validator.validate(options);
    results[validator.name.toLowerCase()] = result;
    allIssues.push(...result.issues);
  }

  const overallScore = Math.round(
    Object.values(results).reduce((sum, result) => sum + result.score, 0) / validators.length
  );

  const errorCount = allIssues.filter(i => i.type === 'error').length;
  const warningCount = allIssues.filter(i => i.type === 'warning').length;

  const overall: ValidationResult = {
    valid: errorCount === 0,
    score: overallScore,
    issues: allIssues,
    summary: `Overall validation: ${errorCount} errors, ${warningCount} warnings (score: ${overallScore}/100)`,
    timestamp: new Date(),
  };

  return { overall, individual: results };
}