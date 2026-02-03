import { randomUUID } from 'crypto';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';

// Script and execution types
export interface Script {
  id: string;
  name: string;
  description: string;
  category: ScriptCategory;
  command: string;
  args?: string[];
  workingDirectory?: string;
  environment?: Record<string, string>;
  timeout: number;
  parameters: ScriptParameter[];
  tags: string[];
  version: string;
  author: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  permissions: ScriptPermissions;
  metadata: Record<string, any>;
}

export interface ScriptParameter {
  name: string;
  type:
    | 'string'
    | 'number'
    | 'boolean'
    | 'file'
    | 'directory'
    | 'select'
    | 'multiline';
  description: string;
  required: boolean;
  defaultValue?: any;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    options?: string[];
  };
  sensitive?: boolean;
}

export interface ScriptExecution {
  id: string;
  scriptId: string;
  status: ExecutionStatus;
  parameters: Record<string, any>;
  output: ExecutionOutput[];
  startTime: Date;
  endTime?: Date;
  duration?: number;
  exitCode?: number;
  error?: string;
  pid?: number;
  userId: string;
  sessionId: string;
  metadata: Record<string, any>;
}

export interface ExecutionOutput {
  id: string;
  timestamp: Date;
  type: 'stdout' | 'stderr' | 'system' | 'error';
  content: string;
  level: 'info' | 'warn' | 'error' | 'debug';
}

export interface ScriptPermissions {
  canExecute: boolean;
  canModify: boolean;
  canDelete: boolean;
  allowedUsers?: string[];
  allowedRoles?: string[];
  requiresApproval: boolean;
  dangerLevel: DangerLevel;
}

export interface ExecutionOptions {
  timeout?: number;
  workingDirectory?: string;
  environment?: Record<string, string>;
  captureOutput?: boolean;
  streamOutput?: boolean;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface ScriptRegistration {
  name: string;
  description: string;
  category: ScriptCategory;
  command: string;
  args?: string[];
  workingDirectory?: string;
  environment?: Record<string, string>;
  timeout?: number;
  parameters?: ScriptParameter[];
  tags?: string[];
  version?: string;
  author?: string;
  permissions?: Partial<ScriptPermissions>;
  metadata?: Record<string, any>;
}

// Enums
export type ScriptCategory =
  | 'system'
  | 'development'
  | 'testing'
  | 'deployment'
  | 'maintenance'
  | 'analysis'
  | 'utility'
  | 'security'
  | 'monitoring';

export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'cancelled'
  | 'killed';

export type DangerLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical';

// Security and validation
class ScriptSecurity {
  private static readonly DANGEROUS_COMMANDS = [
    'rm',
    'del',
    'format',
    'fdisk',
    'mkfs',
    'dd',
    'shred',
    'sudo',
    'su',
    'chmod',
    'chown',
    'passwd',
    'useradd',
    'userdel',
    'systemctl',
    'service',
    'kill',
    'killall',
    'pkill',
  ];

  private static readonly DANGEROUS_PATTERNS = [
    /rm\s+(-rf|--recursive)/i,
    /del\s+\/s/i,
    />\s*\/dev\/(null|zero|random)/i,
    /\|\s*sh\s*$/i,
    /eval\s*\(/i,
    /exec\s*\(/i,
    /\$\(.*\)/,
    /`.*`/,
    /\|\s*sudo/i,
    /&&\s*sudo/i,
  ];

  static assessDangerLevel(command: string, args: string[] = []): DangerLevel {
    const fullCommand = `${command} ${args.join(' ')}`.toLowerCase();

    // Check for critical patterns
    if (this.DANGEROUS_PATTERNS.some(pattern => pattern.test(fullCommand))) {
      return 'critical';
    }

    // Check for dangerous commands
    const commandName = path.basename(command).toLowerCase();
    if (this.DANGEROUS_COMMANDS.includes(commandName)) {
      return 'high';
    }

    // Check for privilege escalation
    if (fullCommand.includes('sudo') || fullCommand.includes('su ')) {
      return 'high';
    }

    // Check for file system operations
    if (fullCommand.includes('rm ') || fullCommand.includes('del ')) {
      return 'medium';
    }

    // Check for network operations
    if (fullCommand.match(/curl|wget|nc|netcat|ssh|ftp|telnet/)) {
      return 'medium';
    }

    return 'safe';
  }

  static validateScript(
    script: Partial<Script> | ScriptRegistration
  ): string[] {
    const errors: string[] = [];

    if (!script.name?.trim()) {
      errors.push('Script name is required');
    }

    if (!script.command?.trim()) {
      errors.push('Script command is required');
    }

    if (script.command && !this.isCommandAllowed(script.command)) {
      errors.push('Command is not allowed for security reasons');
    }

    if (script.timeout && script.timeout > 3600000) {
      // 1 hour max
      errors.push('Timeout cannot exceed 1 hour');
    }

    if (script.workingDirectory && !this.isPathSafe(script.workingDirectory)) {
      errors.push('Working directory path is not safe');
    }

    return errors;
  }

  static validateParameters(
    parameters: Record<string, any>,
    paramDefs: ScriptParameter[]
  ): string[] {
    const errors: string[] = [];

    for (const paramDef of paramDefs) {
      const value = parameters[paramDef.name];

      if (
        paramDef.required &&
        (value === undefined || value === null || value === '')
      ) {
        errors.push(`Parameter '${paramDef.name}' is required`);
        continue;
      }

      if (value !== undefined && paramDef.validation) {
        const validation = paramDef.validation;

        if (validation.pattern && typeof value === 'string') {
          const pattern = new RegExp(validation.pattern);
          if (!pattern.test(value)) {
            errors.push(
              `Parameter '${paramDef.name}' does not match required pattern`
            );
          }
        }

        if (
          validation.minLength &&
          typeof value === 'string' &&
          value.length < validation.minLength
        ) {
          errors.push(
            `Parameter '${paramDef.name}' is too short (minimum ${validation.minLength} characters)`
          );
        }

        if (
          validation.maxLength &&
          typeof value === 'string' &&
          value.length > validation.maxLength
        ) {
          errors.push(
            `Parameter '${paramDef.name}' is too long (maximum ${validation.maxLength} characters)`
          );
        }

        if (
          validation.min &&
          typeof value === 'number' &&
          value < validation.min
        ) {
          errors.push(
            `Parameter '${paramDef.name}' is below minimum value (${validation.min})`
          );
        }

        if (
          validation.max &&
          typeof value === 'number' &&
          value > validation.max
        ) {
          errors.push(
            `Parameter '${paramDef.name}' exceeds maximum value (${validation.max})`
          );
        }

        if (validation.options && !validation.options.includes(value)) {
          errors.push(
            `Parameter '${paramDef.name}' must be one of: ${validation.options.join(', ')}`
          );
        }
      }

      // Security checks for file paths
      if (paramDef.type === 'file' || paramDef.type === 'directory') {
        if (typeof value === 'string' && !this.isPathSafe(value)) {
          errors.push(`Parameter '${paramDef.name}' contains unsafe path`);
        }
      }
    }

    return errors;
  }

  private static isCommandAllowed(command: string): boolean {
    const commandName = path.basename(command).toLowerCase();

    // Whitelist approach - only allow specific commands
    const allowedCommands = [
      'node',
      'npm',
      'yarn',
      'pnpm',
      'bun',
      'python',
      'python3',
      'pip',
      'pip3',
      'git',
      'gh',
      'docker',
      'ls',
      'dir',
      'cat',
      'type',
      'echo',
      'head',
      'tail',
      'find',
      'grep',
      'awk',
      'sed',
      'curl',
      'wget',
      'jest',
      'vitest',
      'mocha',
      'cypress',
      'eslint',
      'tsc',
      'prettier',
      'build',
      'test',
      'lint',
      'format',
    ];

    return allowedCommands.includes(commandName) || command.startsWith('npx ');
  }

  private static isPathSafe(filePath: string): boolean {
    // Prevent directory traversal and access to sensitive paths
    const normalizedPath = path.normalize(filePath);

    // Check for directory traversal
    if (normalizedPath.includes('..') || normalizedPath.includes('~')) {
      return false;
    }

    // Check for absolute paths to system directories
    const dangerousPaths = [
      '/etc',
      '/bin',
      '/sbin',
      '/usr/bin',
      '/usr/sbin',
      '/root',
      'C:\\Windows',
      'C:\\Program Files',
    ];

    return !dangerousPaths.some(dangerousPath =>
      normalizedPath.toLowerCase().startsWith(dangerousPath.toLowerCase())
    );
  }
}

// Storage layer
class ScriptStorage {
  private scripts = new Map<string, Script>();
  private executions = new Map<string, ScriptExecution>();
  private runningProcesses = new Map<string, ChildProcess>();

  // Script operations
  saveScript(script: Script): void {
    this.scripts.set(script.id, { ...script });
  }

  getScript(id: string): Script | undefined {
    return this.scripts.get(id);
  }

  getAllScripts(): Script[] {
    return Array.from(this.scripts.values()).filter(s => s.isActive);
  }

  getScriptsByCategory(category: ScriptCategory): Script[] {
    return this.getAllScripts().filter(s => s.category === category);
  }

  deleteScript(id: string): boolean {
    return this.scripts.delete(id);
  }

  // Execution operations
  saveExecution(execution: ScriptExecution): void {
    this.executions.set(execution.id, { ...execution });
  }

  getExecution(id: string): ScriptExecution | undefined {
    return this.executions.get(id);
  }

  getAllExecutions(): ScriptExecution[] {
    return Array.from(this.executions.values()).sort(
      (a, b) => b.startTime.getTime() - a.startTime.getTime()
    );
  }

  getExecutionsByScript(scriptId: string): ScriptExecution[] {
    return this.getAllExecutions().filter(e => e.scriptId === scriptId);
  }

  getExecutionsByUser(userId: string): ScriptExecution[] {
    return this.getAllExecutions().filter(e => e.userId === userId);
  }

  // Process management
  saveProcess(executionId: string, process: ChildProcess): void {
    this.runningProcesses.set(executionId, process);
  }

  getProcess(executionId: string): ChildProcess | undefined {
    return this.runningProcesses.get(executionId);
  }

  removeProcess(executionId: string): boolean {
    return this.runningProcesses.delete(executionId);
  }

  getRunningProcesses(): Map<string, ChildProcess> {
    return new Map(this.runningProcesses);
  }
}

// Main service class
export class ScriptRunnerService {
  private static storage = new ScriptStorage();
  private static readonly MAX_EXECUTIONS_HISTORY = 1000;
  private static readonly DEFAULT_TIMEOUT = 300000; // 5 minutes

  // Script management
  static registerScript(registration: ScriptRegistration): Script {
    const validationErrors = ScriptSecurity.validateScript(registration);
    if (validationErrors.length > 0) {
      throw new Error(
        `Script validation failed: ${validationErrors.join(', ')}`
      );
    }

    const id = randomUUID();
    const now = new Date();

    const script: Script = {
      id,
      name: registration.name,
      description: registration.description,
      category: registration.category,
      command: registration.command,
      args: registration.args || [],
      workingDirectory: registration.workingDirectory,
      environment: registration.environment || {},
      timeout: registration.timeout || this.DEFAULT_TIMEOUT,
      parameters: registration.parameters || [],
      tags: registration.tags || [],
      version: registration.version || '1.0.0',
      author: registration.author || 'system',
      createdAt: now,
      updatedAt: now,
      isActive: true,
      permissions: {
        canExecute: true,
        canModify: true,
        canDelete: true,
        requiresApproval: false,
        dangerLevel: ScriptSecurity.assessDangerLevel(
          registration.command,
          registration.args
        ),
        ...registration.permissions,
      },
      metadata: registration.metadata || {},
    };

    this.storage.saveScript(script);
    return script;
  }

  static getScript(id: string): Script | null {
    return this.storage.getScript(id) || null;
  }

  static getScripts(): Script[] {
    return this.storage.getAllScripts();
  }

  static getScriptsByCategory(category: ScriptCategory): Script[] {
    return this.storage.getScriptsByCategory(category);
  }

  static updateScript(id: string, updates: Partial<Script>): Script | null {
    const script = this.storage.getScript(id);
    if (!script) return null;

    const validationErrors = ScriptSecurity.validateScript(updates);
    if (validationErrors.length > 0) {
      throw new Error(
        `Script validation failed: ${validationErrors.join(', ')}`
      );
    }

    const updatedScript: Script = {
      ...script,
      ...updates,
      id: script.id, // Preserve ID
      createdAt: script.createdAt, // Preserve creation time
      updatedAt: new Date(),
    };

    this.storage.saveScript(updatedScript);
    return updatedScript;
  }

  static deleteScript(id: string): boolean {
    // Check for running executions
    const runningExecutions = this.storage
      .getExecutionsByScript(id)
      .filter(e => e.status === 'running');

    if (runningExecutions.length > 0) {
      throw new Error('Cannot delete script with running executions');
    }

    return this.storage.deleteScript(id);
  }

  // Script execution
  static async executeScript(
    scriptId: string,
    parameters: Record<string, any> = {},
    options: ExecutionOptions = {}
  ): Promise<string> {
    const script = this.storage.getScript(scriptId);
    if (!script) {
      throw new Error(`Script not found: ${scriptId}`);
    }

    if (!script.isActive) {
      throw new Error('Script is not active');
    }

    if (!script.permissions.canExecute) {
      throw new Error('Script execution not permitted');
    }

    // Validate parameters
    const paramErrors = ScriptSecurity.validateParameters(
      parameters,
      script.parameters
    );
    if (paramErrors.length > 0) {
      throw new Error(`Parameter validation failed: ${paramErrors.join(', ')}`);
    }

    // Create execution record
    const executionId = randomUUID();
    const execution: ScriptExecution = {
      id: executionId,
      scriptId,
      status: 'pending',
      parameters,
      output: [],
      startTime: new Date(),
      userId: options.userId || 'system',
      sessionId: options.sessionId || randomUUID(),
      metadata: options.metadata || {},
    };

    this.storage.saveExecution(execution);

    // Start execution asynchronously
    this.executeScriptProcess(execution, script, options).catch(error => {
      console.error(`Script execution failed for ${executionId}:`, error);
    });

    return executionId;
  }

  private static async executeScriptProcess(
    execution: ScriptExecution,
    script: Script,
    options: ExecutionOptions
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Update status to running
      execution.status = 'running';
      this.addOutput(
        execution,
        'system',
        `Starting execution of script: ${script.name}`
      );
      this.storage.saveExecution(execution);

      // Prepare command and arguments
      const { command, args } = this.prepareCommand(
        script,
        execution.parameters
      );

      // Prepare environment
      const env = {
        ...process.env,
        ...script.environment,
        ...options.environment,
        SCRIPT_ID: script.id,
        EXECUTION_ID: execution.id,
        SCRIPT_NAME: script.name,
      };

      // Prepare working directory
      const workingDirectory =
        options.workingDirectory || script.workingDirectory || process.cwd();

      // Create and start process
      const childProcess = spawn(command, args, {
        cwd: workingDirectory,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false,
      });

      execution.pid = childProcess.pid;
      this.storage.saveProcess(execution.id, childProcess);
      this.storage.saveExecution(execution);

      // Set up timeout
      const timeout = options.timeout || script.timeout;
      const timeoutHandle = setTimeout(() => {
        this.killExecution(execution.id);
      }, timeout);

      // Handle stdout
      childProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        this.addOutput(execution, 'stdout', output);
        this.storage.saveExecution(execution);
      });

      // Handle stderr
      childProcess.stderr?.on('data', (data: Buffer) => {
        const output = data.toString();
        this.addOutput(execution, 'stderr', output, 'warn');
        this.storage.saveExecution(execution);
      });

      // Handle process events
      childProcess.on('error', error => {
        clearTimeout(timeoutHandle);
        execution.status = 'failed';
        execution.error = error.message;
        this.addOutput(
          execution,
          'error',
          `Process error: ${error.message}`,
          'error'
        );
        this.finishExecution(execution, startTime);
      });

      childProcess.on('exit', (code, signal) => {
        clearTimeout(timeoutHandle);

        if (signal) {
          execution.status = signal === 'SIGTERM' ? 'timeout' : 'killed';
          this.addOutput(
            execution,
            'system',
            `Process terminated with signal: ${signal}`
          );
        } else {
          execution.status = code === 0 ? 'completed' : 'failed';
          execution.exitCode = code || 0;
          this.addOutput(
            execution,
            'system',
            `Process exited with code: ${code}`
          );
        }

        this.finishExecution(execution, startTime);
      });
    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : String(error);
      this.addOutput(
        execution,
        'error',
        `Execution failed: ${execution.error}`,
        'error'
      );
      this.finishExecution(execution, startTime);
    }
  }

  private static prepareCommand(
    script: Script,
    parameters: Record<string, any>
  ): { command: string; args: string[] } {
    let command = script.command;
    let args = [...(script.args || [])];

    // Replace parameter placeholders in command and args
    for (const [key, value] of Object.entries(parameters)) {
      const placeholder = `{{${key}}}`;
      const stringValue = String(value);

      command = command.replace(
        new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'),
        stringValue
      );
      args = args.map(arg =>
        arg.replace(
          new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'),
          stringValue
        )
      );
    }

    return { command, args };
  }

  private static addOutput(
    execution: ScriptExecution,
    type: ExecutionOutput['type'],
    content: string,
    level: ExecutionOutput['level'] = 'info'
  ): void {
    const outputEntry: ExecutionOutput = {
      id: randomUUID(),
      timestamp: new Date(),
      type,
      content: content.trim(),
      level,
    };

    execution.output.push(outputEntry);
  }

  private static finishExecution(
    execution: ScriptExecution,
    startTime: number
  ): void {
    execution.endTime = new Date();
    execution.duration = Date.now() - startTime;

    this.storage.removeProcess(execution.id);
    this.storage.saveExecution(execution);

    this.cleanupOldExecutions();
  }

  // Execution management
  static getExecution(id: string): ScriptExecution | null {
    return this.storage.getExecution(id) || null;
  }

  static getAllExecutions(): ScriptExecution[] {
    return this.storage.getAllExecutions();
  }

  static getExecutionsByScript(scriptId: string): ScriptExecution[] {
    return this.storage.getExecutionsByScript(scriptId);
  }

  static getExecutionsByUser(userId: string): ScriptExecution[] {
    return this.storage.getExecutionsByUser(userId);
  }

  static async cancelExecution(executionId: string): Promise<boolean> {
    return this.killExecution(executionId);
  }

  static async killExecution(executionId: string): Promise<boolean> {
    const execution = this.storage.getExecution(executionId);
    if (!execution || execution.status !== 'running') {
      return false;
    }

    const process = this.storage.getProcess(executionId);
    if (!process) {
      return false;
    }

    try {
      // Try graceful termination first
      process.kill('SIGTERM');

      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (process && !process.killed) {
          process.kill('SIGKILL');
        }
      }, 5000);

      execution.status = 'killed';
      this.addOutput(execution, 'system', 'Execution killed by user request');
      this.storage.saveExecution(execution);

      return true;
    } catch (error) {
      console.error(`Failed to kill execution ${executionId}:`, error);
      return false;
    }
  }

  static getRunningExecutions(): ScriptExecution[] {
    return this.storage.getAllExecutions().filter(e => e.status === 'running');
  }

  static async killAllRunningExecutions(): Promise<number> {
    const runningExecutions = this.getRunningExecutions();
    let killedCount = 0;

    for (const execution of runningExecutions) {
      const killed = await this.killExecution(execution.id);
      if (killed) killedCount++;
    }

    return killedCount;
  }

  // Utility methods
  private static cleanupOldExecutions(): void {
    const executions = this.storage.getAllExecutions();

    if (executions.length > this.MAX_EXECUTIONS_HISTORY) {
      const toRemove = executions
        .filter(e => e.status !== 'running')
        .slice(this.MAX_EXECUTIONS_HISTORY);

      toRemove.forEach(execution => {
        this.storage.getExecution(execution.id);
      });
    }
  }

  static getExecutionStats(): {
    total: number;
    running: number;
    completed: number;
    failed: number;
    avgDuration: number;
  } {
    const executions = this.storage.getAllExecutions();
    const completed = executions.filter(e => e.status === 'completed');
    const failed = executions.filter(e => e.status === 'failed');
    const running = executions.filter(e => e.status === 'running');

    const avgDuration =
      completed.length > 0
        ? completed.reduce((sum, e) => sum + (e.duration || 0), 0) /
          completed.length
        : 0;

    return {
      total: executions.length,
      running: running.length,
      completed: completed.length,
      failed: failed.length,
      avgDuration,
    };
  }

  // Initialize with some default scripts
  static initializeDefaultScripts(): void {
    const defaultScripts: ScriptRegistration[] = [
      {
        name: 'Node.js Version Check',
        description: 'Check the current Node.js version',
        category: 'system',
        command: 'node',
        args: ['--version'],
        timeout: 5000,
        tags: ['nodejs', 'version', 'system'],
        author: 'system',
      },
      {
        name: 'NPM Install',
        description: 'Install npm dependencies',
        category: 'development',
        command: 'npm',
        args: ['install'],
        timeout: 300000,
        tags: ['npm', 'install', 'dependencies'],
        author: 'system',
      },
      {
        name: 'Run Tests',
        description: 'Run the test suite',
        category: 'testing',
        command: 'npm',
        args: ['test'],
        timeout: 600000,
        tags: ['test', 'jest', 'testing'],
        author: 'system',
      },
      {
        name: 'Build Project',
        description: 'Build the project',
        category: 'development',
        command: 'npm',
        args: ['run', 'build'],
        timeout: 300000,
        tags: ['build', 'compile'],
        author: 'system',
      },
      {
        name: 'Lint Code',
        description: 'Run ESLint on the codebase',
        category: 'development',
        command: 'npm',
        args: ['run', 'lint'],
        timeout: 60000,
        tags: ['lint', 'eslint', 'code-quality'],
        author: 'system',
      },
    ];

    // Only initialize if no scripts exist
    if (this.storage.getAllScripts().length === 0) {
      defaultScripts.forEach(script => {
        try {
          this.registerScript(script);
        } catch (error) {
          console.warn(
            `Failed to register default script '${script.name}':`,
            error
          );
        }
      });
    }
  }
}

// Initialize default scripts on first import
ScriptRunnerService.initializeDefaultScripts();

// Export singleton instance for convenience
export const scriptRunnerService = ScriptRunnerService;
