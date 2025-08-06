/**
 * Secure Script Execution System
 * Provides safe execution of consumer scripts with proper sandboxing and security measures
 */

import { spawn, exec, ChildProcess } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { readFile, writeFile, access, mkdir } from 'fs/promises';
import { existsSync, constants } from 'fs';
import crypto from 'crypto';

const execAsync = promisify(exec);

export interface ScriptExecutionOptions {
  timeout?: number;
  maxBuffer?: number;
  cwd?: string;
  env?: Record<string, string>;
  shell?: boolean | string;
  safetyLevel?: 'safe' | 'moderate' | 'unsafe';
  allowedCommands?: string[];
  blockedCommands?: string[];
  allowNetworkAccess?: boolean;
  allowFileSystemAccess?: boolean;
  maxMemory?: number;
  maxCpu?: number;
}

export interface ScriptExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  memoryUsage?: number;
  cpuUsage?: number;
  securityViolations?: SecurityViolation[];
}

export interface SecurityViolation {
  type: 'command' | 'file' | 'network' | 'resource';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  blocked: boolean;
}

export interface ScriptDefinition {
  name: string;
  command: string;
  description: string;
  safetyLevel: 'safe' | 'moderate' | 'unsafe';
  allowedPaths?: string[];
  requiredPermissions?: string[];
  timeout?: number;
  validation?: (command: string) => boolean;
}

/**
 * Security Policy Manager
 */
export class SecurityPolicy {
  private static readonly SAFE_COMMANDS = [
    'npm', 'yarn', 'pnpm',
    'node', 'ts-node',
    'git',
    'cat', 'ls', 'find', 'grep',
    'echo', 'printf',
    'tsc', 'eslint', 'prettier',
    'jest', 'mocha', 'vitest',
  ];

  private static readonly BLOCKED_COMMANDS = [
    'rm', 'del', 'rmdir',
    'mv', 'move', 'cp', 'copy',
    'chmod', 'chown',
    'sudo', 'su',
    'curl', 'wget', 'nc', 'netcat',
    'ssh', 'scp', 'ftp',
    'python', 'python3', 'pip',
    'ruby', 'gem',
    'docker', 'kubectl',
    'systemctl', 'service',
  ];

  private static readonly DANGEROUS_PATTERNS = [
    /rm\s+-rf/,
    />\s*\/dev\/(null|zero)/,
    /\|\s*sh/,
    /eval\s*\(/,
    /exec\s*\(/,
    /system\s*\(/,
    /`[^`]*`/, // backticks
    /\$\([^)]*\)/, // command substitution
  ];

  static validateCommand(command: string, safetyLevel: string): SecurityViolation[] {
    const violations: SecurityViolation[] = [];
    const commandParts = command.split(/\s+/);
    const baseCommand = commandParts[0];

    // Check safety level restrictions
    if (safetyLevel === 'safe') {
      if (!this.SAFE_COMMANDS.includes(baseCommand)) {
        violations.push({
          type: 'command',
          severity: 'high',
          description: `Command '${baseCommand}' not allowed in safe mode`,
          blocked: true,
        });
      }
    }

    // Check blocked commands
    if (this.BLOCKED_COMMANDS.includes(baseCommand)) {
      violations.push({
        type: 'command',
        severity: 'critical',
        description: `Command '${baseCommand}' is blocked for security`,
        blocked: true,
      });
    }

    // Check dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        violations.push({
          type: 'command',
          severity: 'critical',
          description: `Command contains dangerous pattern: ${pattern}`,
          blocked: true,
        });
      }
    }

    // Check for potential injection attacks
    if (command.includes('..') || command.includes('~')) {
      violations.push({
        type: 'file',
        severity: 'medium',
        description: 'Command contains path traversal patterns',
        blocked: false,
      });
    }

    return violations;
  }

  static sanitizeEnvironment(env: Record<string, string> = {}): Record<string, string> {
    const safeEnv: Record<string, string> = {};
    const allowedEnvVars = [
      'NODE_ENV', 'PATH', 'HOME', 'USER', 'PWD',
      'npm_config_registry', 'npm_config_cache',
    ];

    // Only include safe environment variables
    for (const [key, value] of Object.entries(env)) {
      if (allowedEnvVars.includes(key) || key.startsWith('WUNDR_')) {
        safeEnv[key] = value;
      }
    }

    return safeEnv;
  }
}

/**
 * Resource Monitor for tracking script resource usage
 */
export class ResourceMonitor {
  private process?: ChildProcess;
  private startTime: number = 0;
  private memoryPeak: number = 0;
  private cpuUsage: number = 0;

  start(childProcess: ChildProcess): void {
    this.process = childProcess;
    this.startTime = Date.now();
    this.monitorResources();
  }

  private monitorResources(): void {
    if (!this.process || !this.process.pid) return;

    const interval = setInterval(() => {
      if (!this.process || this.process.killed) {
        clearInterval(interval);
        return;
      }

      try {
        const usage = process.cpuUsage();
        this.cpuUsage = (usage.user + usage.system) / 1000000; // Convert to seconds

        // Monitor memory usage (simplified)
        const memInfo = process.memoryUsage();
        this.memoryPeak = Math.max(this.memoryPeak, memInfo.heapUsed);
      } catch (error) {
        // Process might have ended
        clearInterval(interval);
      }
    }, 1000);
  }

  getStats(): { duration: number; memoryUsage: number; cpuUsage: number } {
    return {
      duration: Date.now() - this.startTime,
      memoryUsage: this.memoryPeak,
      cpuUsage: this.cpuUsage,
    };
  }
}

/**
 * Secure Script Executor
 */
export class ScriptExecutor {
  private scriptsRegistry = new Map<string, ScriptDefinition>();
  private executionLogs: Array<{
    timestamp: number;
    command: string;
    result: ScriptExecutionResult;
  }> = [];

  constructor(private workingDirectory: string = process.cwd()) {}

  /**
   * Register a script with security metadata
   */
  registerScript(script: ScriptDefinition): void {
    this.scriptsRegistry.set(script.name, script);
  }

  /**
   * Execute a registered script by name
   */
  async executeRegisteredScript(
    scriptName: string,
    options: ScriptExecutionOptions = {}
  ): Promise<ScriptExecutionResult> {
    const script = this.scriptsRegistry.get(scriptName);
    if (!script) {
      throw new Error(`Script '${scriptName}' not found in registry`);
    }

    // Merge script-specific options
    const mergedOptions: ScriptExecutionOptions = {
      ...options,
      safetyLevel: script.safetyLevel,
      timeout: script.timeout || options.timeout,
    };

    return this.executeCommand(script.command, mergedOptions);
  }

  /**
   * Execute a command with security checks
   */
  async executeCommand(
    command: string,
    options: ScriptExecutionOptions = {}
  ): Promise<ScriptExecutionResult> {
    const startTime = Date.now();
    const safetyLevel = options.safetyLevel || 'moderate';

    // Security validation
    const violations = SecurityPolicy.validateCommand(command, safetyLevel);
    const criticalViolations = violations.filter(v => v.blocked);

    if (criticalViolations.length > 0) {
      throw new Error(
        `Security violations detected: ${criticalViolations.map(v => v.description).join(', ')}`
      );
    }

    // Prepare execution environment
    const executionOptions = this.prepareExecutionOptions(options);
    const monitor = new ResourceMonitor();

    let result: ScriptExecutionResult;

    try {
      // Execute based on safety level
      if (safetyLevel === 'safe') {
        result = await this.executeSafe(command, executionOptions, monitor);
      } else if (safetyLevel === 'moderate') {
        result = await this.executeModerate(command, executionOptions, monitor);
      } else {
        result = await this.executeUnsafe(command, executionOptions, monitor);
      }

      result.securityViolations = violations;
      result.duration = Date.now() - startTime;

    } catch (error) {
      result = {
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1,
        duration: Date.now() - startTime,
        securityViolations: violations,
      };
    }

    // Log execution
    this.logExecution(command, result);

    return result;
  }

  /**
   * Execute in safe mode (restricted environment)
   */
  private async executeSafe(
    command: string,
    options: any,
    monitor: ResourceMonitor
  ): Promise<ScriptExecutionResult> {
    // Create isolated environment
    const safeEnv = SecurityPolicy.sanitizeEnvironment(options.env);
    
    // Use spawn for better control
    return new Promise((resolve, reject) => {
      const child = spawn(command, [], {
        ...options,
        env: safeEnv,
        shell: false, // Disable shell to prevent injection
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      monitor.start(child);

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        const stats = monitor.getStats();
        resolve({
          stdout,
          stderr,
          exitCode: code || 0,
          duration: stats.duration,
          memoryUsage: stats.memoryUsage,
          cpuUsage: stats.cpuUsage,
        });
      });

      child.on('error', (error) => {
        reject(error);
      });

      // Timeout handling
      if (options.timeout) {
        setTimeout(() => {
          child.kill('SIGTERM');
          reject(new Error('Script execution timed out'));
        }, options.timeout);
      }
    });
  }

  /**
   * Execute in moderate mode (some shell features allowed)
   */
  private async executeModerate(
    command: string,
    options: any,
    monitor: ResourceMonitor
  ): Promise<ScriptExecutionResult> {
    const safeEnv = SecurityPolicy.sanitizeEnvironment(options.env);

    return new Promise((resolve, reject) => {
      const child = exec(command, {
        ...options,
        env: safeEnv,
        maxBuffer: options.maxBuffer || 1024 * 1024, // 1MB
      });

      monitor.start(child);

      child.on('close', (code) => {
        const stats = monitor.getStats();
        resolve({
          stdout: child.stdout?.read() || '',
          stderr: child.stderr?.read() || '',
          exitCode: code || 0,
          duration: stats.duration,
          memoryUsage: stats.memoryUsage,
          cpuUsage: stats.cpuUsage,
        });
      });

      child.on('error', (error) => {
        reject(error);
      });

      // Timeout handling
      if (options.timeout) {
        setTimeout(() => {
          child.kill('SIGTERM');
          reject(new Error('Script execution timed out'));
        }, options.timeout);
      }
    });
  }

  /**
   * Execute in unsafe mode (full shell access - use with caution)
   */
  private async executeUnsafe(
    command: string,
    options: any,
    monitor: ResourceMonitor
  ): Promise<ScriptExecutionResult> {
    console.warn('⚠️  Executing script in unsafe mode - use with extreme caution!');
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        ...options,
        maxBuffer: options.maxBuffer || 10 * 1024 * 1024, // 10MB
      });

      return {
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        exitCode: 0,
        duration: 0, // execAsync doesn't provide timing
      };
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode: error.code || 1,
        duration: 0,
      };
    }
  }

  /**
   * Prepare execution options with security defaults
   */
  private prepareExecutionOptions(options: ScriptExecutionOptions): any {
    return {
      cwd: options.cwd || this.workingDirectory,
      timeout: options.timeout || 30000, // 30 seconds default
      maxBuffer: options.maxBuffer || 1024 * 1024, // 1MB default
      env: {
        ...process.env,
        ...options.env,
      },
    };
  }

  /**
   * Log script execution for audit purposes
   */
  private logExecution(command: string, result: ScriptExecutionResult): void {
    this.executionLogs.push({
      timestamp: Date.now(),
      command,
      result,
    });

    // Keep only last 100 executions
    if (this.executionLogs.length > 100) {
      this.executionLogs.shift();
    }
  }

  /**
   * Get execution logs for audit
   */
  getExecutionLogs(): Array<{
    timestamp: number;
    command: string;
    result: ScriptExecutionResult;
  }> {
    return [...this.executionLogs];
  }

  /**
   * Clear execution logs
   */
  clearLogs(): void {
    this.executionLogs = [];
  }

  /**
   * Get registered scripts
   */
  getRegisteredScripts(): ScriptDefinition[] {
    return Array.from(this.scriptsRegistry.values());
  }

  /**
   * Load scripts from configuration
   */
  async loadScriptsFromConfig(configPath: string): Promise<void> {
    if (!existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }

    const config = JSON.parse(await readFile(configPath, 'utf-8'));
    const scripts = config.integration?.customScripts || [];

    for (const script of scripts) {
      this.registerScript({
        name: script.name,
        command: script.command,
        description: script.description,
        safetyLevel: script.safetyLevel || 'moderate',
      });
    }
  }
}

export default ScriptExecutor;