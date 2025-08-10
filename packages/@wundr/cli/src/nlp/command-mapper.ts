import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { logger } from '../utils/logger';
import { IntentResult } from './intent-parser';

/**
 * Command execution result
 */
export interface CommandResult {
  command: string;
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
  executionTime: number;
  metadata?: Record<string, any>;
}

/**
 * Command validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  safetyLevel: 'safe' | 'caution' | 'dangerous';
}

/**
 * Command mapping configuration
 */
export interface CommandMapperConfig {
  dryRun: boolean;
  confirmDestructive: boolean;
  timeout: number; // milliseconds
  maxConcurrentCommands: number;
  enableLogging: boolean;
  safetyChecks: boolean;
}

/**
 * Command template for mapping intents to executable commands
 */
export interface CommandTemplate {
  intent: string;
  commandTemplate: string;
  parameterMapping: ParameterMapping[];
  validation: ValidationRule[];
  safetyLevel: 'safe' | 'caution' | 'dangerous';
  requiresConfirmation: boolean;
  examples: CommandExample[];
  dependencies?: string[]; // Required tools/commands
  category: string;
}

/**
 * Parameter mapping from intent to command
 */
export interface ParameterMapping {
  intentParam: string;
  commandFlag: string;
  transform?: (value: any) => string;
  validation?: (value: any) => boolean;
  required?: boolean;
  defaultValue?: string;
}

/**
 * Validation rule for commands
 */
export interface ValidationRule {
  type: 'parameter' | 'file_exists' | 'directory_exists' | 'command_available' | 'custom';
  rule: string | ((params: Record<string, any>) => Promise<boolean>);
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Command example for documentation
 */
export interface CommandExample {
  description: string;
  intentInput: string;
  expectedCommand: string;
}

/**
 * Execution context for commands
 */
export interface ExecutionContext {
  workingDirectory: string;
  environment: Record<string, string>;
  user: string;
  interactive: boolean;
  dryRun: boolean;
}

/**
 * Command mapper that converts parsed intents into executable CLI commands
 */
export class CommandMapper extends EventEmitter {
  private config: CommandMapperConfig;
  private commandTemplates: Map<string, CommandTemplate>;
  private runningCommands: Map<string, ChildProcess>;
  private commandHistory: CommandResult[];

  constructor(config: Partial<CommandMapperConfig> = {}) {
    super();

    this.config = {
      dryRun: false,
      confirmDestructive: true,
      timeout: 300000, // 5 minutes
      maxConcurrentCommands: 5,
      enableLogging: true,
      safetyChecks: true,
      ...config
    };

    this.commandTemplates = new Map();
    this.runningCommands = new Map();
    this.commandHistory = [];

    this.initializeDefaultTemplates();
  }

  /**
   * Map an intent result to an executable command
   */
  async mapIntentToCommand(
    intentResult: IntentResult,
    context: ExecutionContext
  ): Promise<{
    command: string;
    args: string[];
    validation: ValidationResult;
    safetyLevel: 'safe' | 'caution' | 'dangerous';
    requiresConfirmation: boolean;
  }> {
    const template = this.commandTemplates.get(intentResult.intent);
    
    if (!template) {
      throw new Error(`No command template found for intent: ${intentResult.intent}`);
    }

    // Build command from template
    const { command, args } = await this.buildCommand(template, intentResult.parameters || {}, context);
    
    // Validate command
    const validation = await this.validateCommand(template, intentResult.parameters || {}, context);
    
    this.emit('command_mapped', {
      intent: intentResult.intent,
      command,
      args,
      validation,
      template: template.intent
    });

    return {
      command,
      args,
      validation,
      safetyLevel: template.safetyLevel,
      requiresConfirmation: template.requiresConfirmation
    };
  }

  /**
   * Execute a mapped command
   */
  async executeCommand(
    command: string,
    args: string[],
    context: ExecutionContext,
    options: {
      streaming?: boolean;
      onOutput?: (output: string) => void;
      onError?: (error: string) => void;
    } = {}
  ): Promise<CommandResult> {
    const startTime = Date.now();
    const executionId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (context.dryRun || this.config.dryRun) {
      logger.info(`[DRY RUN] Would execute: ${command} ${args.join(' ')}`);
      return {
        command: `${command} ${args.join(' ')}`,
        success: true,
        output: '[DRY RUN] Command would execute successfully',
        exitCode: 0,
        executionTime: 0,
        metadata: { dryRun: true }
      };
    }

    return new Promise((resolve, reject) => {
      const childProcess = spawn(command, args, {
        cwd: context.workingDirectory,
        env: { ...process.env, ...context.environment },
        stdio: options.streaming ? 'pipe' : 'pipe'
      });

      this.runningCommands.set(executionId, childProcess);

      let output = '';
      let errorOutput = '';

      // Handle stdout
      if (childProcess.stdout) {
        childProcess.stdout.on('data', (data: Buffer) => {
          const chunk = data.toString();
          output += chunk;
          
          if (options.onOutput) {
            options.onOutput(chunk);
          }
          
          if (options.streaming) {
            this.emit('command_output', { executionId, chunk, stream: 'stdout' });
          }
        });
      }

      // Handle stderr
      if (childProcess.stderr) {
        childProcess.stderr.on('data', (data: Buffer) => {
          const chunk = data.toString();
          errorOutput += chunk;
          
          if (options.onError) {
            options.onError(chunk);
          }
          
          if (options.streaming) {
            this.emit('command_output', { executionId, chunk, stream: 'stderr' });
          }
        });
      }

      // Handle process exit
      childProcess.on('close', (code: number | null) => {
        const endTime = Date.now();
        const executionTime = endTime - startTime;
        
        this.runningCommands.delete(executionId);

        const result: CommandResult = {
          command: `${command} ${args.join(' ')}`,
          success: (code || 0) === 0,
          output,
          error: errorOutput || undefined,
          exitCode: code || 0,
          executionTime,
          metadata: {
            executionId,
            workingDirectory: context.workingDirectory,
            startTime: new Date(startTime),
            endTime: new Date(endTime)
          }
        };

        // Log result
        if (this.config.enableLogging) {
          logger.debug(`Command executed: ${result.command}`, {
            success: result.success,
            exitCode: result.exitCode,
            executionTime: result.executionTime
          });
        }

        // Add to history
        this.commandHistory.push(result);
        
        // Limit history size
        if (this.commandHistory.length > 1000) {
          this.commandHistory = this.commandHistory.slice(-500);
        }

        this.emit('command_completed', { executionId, result });

        resolve(result);
      });

      // Handle process errors
      childProcess.on('error', (error: Error) => {
        this.runningCommands.delete(executionId);
        
        const result: CommandResult = {
          command: `${command} ${args.join(' ')}`,
          success: false,
          output,
          error: error.message,
          exitCode: -1,
          executionTime: Date.now() - startTime,
          metadata: { executionId, error: error.message }
        };

        this.emit('command_error', { executionId, error });
        resolve(result); // Don't reject, return error result instead
      });

      // Set timeout
      if (this.config.timeout > 0) {
        setTimeout(() => {
          if (this.runningCommands.has(executionId)) {
            childProcess.kill('SIGTERM');
            logger.warn(`Command timed out after ${this.config.timeout}ms: ${command}`);
          }
        }, this.config.timeout);
      }
    });
  }

  /**
   * Execute a command from an intent result
   */
  async executeFromIntent(
    intentResult: IntentResult,
    context: ExecutionContext,
    options: {
      skipConfirmation?: boolean;
      streaming?: boolean;
      onOutput?: (output: string) => void;
      onError?: (error: string) => void;
    } = {}
  ): Promise<CommandResult> {
    // Map intent to command
    const mappedCommand = await this.mapIntentToCommand(intentResult, context);

    // Check validation
    if (!mappedCommand.validation.valid) {
      throw new Error(`Command validation failed: ${mappedCommand.validation.errors.join(', ')}`);
    }

    // Handle confirmation for dangerous commands
    if (mappedCommand.requiresConfirmation && 
        this.config.confirmDestructive && 
        !options.skipConfirmation && 
        context.interactive) {
      const confirmed = await this.confirmExecution(mappedCommand, intentResult);
      if (!confirmed) {
        throw new Error('Command execution cancelled by user');
      }
    }

    // Execute command
    return this.executeCommand(mappedCommand.command, mappedCommand.args, context, options);
  }

  /**
   * Register a custom command template
   */
  registerCommandTemplate(template: CommandTemplate): void {
    this.commandTemplates.set(template.intent, template);
    logger.debug(`Registered command template: ${template.intent}`);
    this.emit('template_registered', template);
  }

  /**
   * Validate a command before execution
   */
  async validateCommand(
    template: CommandTemplate,
    parameters: Record<string, any>,
    context: ExecutionContext
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      safetyLevel: template.safetyLevel
    };

    if (!this.config.safetyChecks) {
      return result;
    }

    // Run validation rules
    for (const rule of template.validation) {
      try {
        const isValid = await this.executeValidationRule(rule, parameters, context);
        
        if (!isValid) {
          if (rule.severity === 'error') {
            result.errors.push(rule.message);
            result.valid = false;
          } else {
            result.warnings.push(rule.message);
          }
        }
      } catch (error) {
        result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        result.valid = false;
      }
    }

    // Check parameter requirements
    for (const mapping of template.parameterMapping) {
      if (mapping.required && !parameters[mapping.intentParam]) {
        result.errors.push(`Required parameter missing: ${mapping.intentParam}`);
        result.valid = false;
      }

      if (parameters[mapping.intentParam] && mapping.validation) {
        if (!mapping.validation(parameters[mapping.intentParam])) {
          result.errors.push(`Invalid value for parameter: ${mapping.intentParam}`);
          result.valid = false;
        }
      }
    }

    // Check dependencies
    if (template.dependencies) {
      for (const dep of template.dependencies) {
        const available = await this.checkCommandAvailable(dep);
        if (!available) {
          result.errors.push(`Required dependency not available: ${dep}`);
          result.valid = false;
        }
      }
    }

    return result;
  }

  /**
   * Get command execution history
   */
  getCommandHistory(
    filters: {
      limit?: number;
      successOnly?: boolean;
      intent?: string;
      since?: Date;
    } = {}
  ): CommandResult[] {
    let history = [...this.commandHistory];

    if (filters.since) {
      history = history.filter(cmd => 
        cmd.metadata?.['startTime'] && new Date(cmd.metadata['startTime']) >= filters.since!
      );
    }

    if (filters.successOnly) {
      history = history.filter(cmd => cmd.success);
    }

    if (filters.intent) {
      history = history.filter(cmd => 
        cmd.metadata?.['intent'] === filters.intent
      );
    }

    if (filters.limit) {
      history = history.slice(-filters.limit);
    }

    return history;
  }

  /**
   * Cancel a running command
   */
  async cancelCommand(executionId: string): Promise<boolean> {
    const childProcess = this.runningCommands.get(executionId);
    
    if (childProcess) {
      childProcess.kill('SIGTERM');
      
      // Give it a moment to terminate gracefully
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Force kill if still running
      if (!childProcess.killed) {
        childProcess.kill('SIGKILL');
      }
      
      this.runningCommands.delete(executionId);
      this.emit('command_cancelled', { executionId });
      
      return true;
    }
    
    return false;
  }

  /**
   * Get currently running commands
   */
  getRunningCommands(): Array<{
    executionId: string;
    pid: number;
    command: string;
  }> {
    return Array.from(this.runningCommands.entries()).map(([id, process]) => ({
      executionId: id,
      pid: process.pid || 0,
      command: process.spawnargs.join(' ')
    }));
  }

  /**
   * Generate command preview without executing
   */
  async previewCommand(
    intentResult: IntentResult,
    context: ExecutionContext
  ): Promise<{
    command: string;
    explanation: string;
    warnings: string[];
    safetyLevel: string;
  }> {
    const mappedCommand = await this.mapIntentToCommand(intentResult, context);
    
    const explanation = this.generateCommandExplanation(
      mappedCommand.command,
      mappedCommand.args,
      intentResult
    );

    return {
      command: `${mappedCommand.command} ${mappedCommand.args.join(' ')}`,
      explanation,
      warnings: mappedCommand.validation.warnings,
      safetyLevel: mappedCommand.safetyLevel
    };
  }

  // Private methods

  private initializeDefaultTemplates(): void {
    const defaultTemplates: CommandTemplate[] = [
      {
        intent: 'analyze',
        commandTemplate: 'wundr analyze',
        parameterMapping: [
          {
            intentParam: 'path',
            commandFlag: '--path',
            defaultValue: '.',
            validation: (value: string) => typeof value === 'string'
          },
          {
            intentParam: 'focus',
            commandFlag: '--focus',
            validation: (value: string) => ['dependencies', 'quality', 'security', 'performance'].includes(value)
          },
          {
            intentParam: 'format',
            commandFlag: '--format',
            defaultValue: 'table',
            validation: (value: string) => ['json', 'table', 'csv'].includes(value)
          }
        ],
        validation: [
          {
            type: 'directory_exists',
            rule: 'path',
            message: 'Target directory does not exist',
            severity: 'error'
          }
        ],
        safetyLevel: 'safe',
        requiresConfirmation: false,
        examples: [
          {
            description: 'Analyze current directory',
            intentInput: 'analyze the project',
            expectedCommand: 'wundr analyze --path .'
          }
        ],
        category: 'analysis'
      },
      {
        intent: 'create',
        commandTemplate: 'wundr create',
        parameterMapping: [
          {
            intentParam: 'type',
            commandFlag: '',
            required: true,
            validation: (value: string) => ['component', 'service', 'test', 'config'].includes(value)
          },
          {
            intentParam: 'name',
            commandFlag: '',
            required: true,
            validation: (value: string) => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(value)
          },
          {
            intentParam: 'template',
            commandFlag: '--template'
          }
        ],
        validation: [
          {
            type: 'custom',
            rule: async (params) => {
              // Check if file doesn't already exist
              return true; // Simplified for example
            },
            message: 'File already exists',
            severity: 'warning'
          }
        ],
        safetyLevel: 'caution',
        requiresConfirmation: false,
        examples: [
          {
            description: 'Create a new component',
            intentInput: 'create component UserProfile',
            expectedCommand: 'wundr create component UserProfile'
          }
        ],
        category: 'generation'
      },
      {
        intent: 'init',
        commandTemplate: 'wundr init',
        parameterMapping: [
          {
            intentParam: 'project',
            commandFlag: '',
            defaultValue: '.'
          },
          {
            intentParam: 'template',
            commandFlag: '--template'
          },
          {
            intentParam: 'force',
            commandFlag: '--force',
            transform: (value: boolean) => value ? '--force' : ''
          }
        ],
        validation: [
          {
            type: 'directory_exists',
            rule: 'project',
            message: 'Target directory does not exist',
            severity: 'error'
          }
        ],
        safetyLevel: 'caution',
        requiresConfirmation: true,
        examples: [
          {
            description: 'Initialize new project',
            intentInput: 'init new project',
            expectedCommand: 'wundr init'
          }
        ],
        category: 'setup'
      },
      {
        intent: 'dashboard',
        commandTemplate: 'wundr dashboard',
        parameterMapping: [
          {
            intentParam: 'port',
            commandFlag: '--port',
            defaultValue: '3000',
            validation: (value: number) => value > 0 && value < 65536
          },
          {
            intentParam: 'view',
            commandFlag: '--view'
          }
        ],
        validation: [],
        safetyLevel: 'safe',
        requiresConfirmation: false,
        examples: [
          {
            description: 'Start dashboard',
            intentInput: 'open dashboard',
            expectedCommand: 'wundr dashboard --port 3000'
          }
        ],
        category: 'interface'
      }
    ];

    defaultTemplates.forEach(template => this.registerCommandTemplate(template));
  }

  private async buildCommand(
    template: CommandTemplate,
    parameters: Record<string, any>,
    context: ExecutionContext
  ): Promise<{ command: string; args: string[] }> {
    const commandParts = template.commandTemplate.split(' ');
    const baseCommand = commandParts[0] || '';
    const args = commandParts.slice(1);

    // Add parameter-based arguments
    for (const mapping of template.parameterMapping) {
      let value = parameters[mapping.intentParam];
      
      // Apply default value
      if (value === undefined && mapping.defaultValue !== undefined) {
        value = mapping.defaultValue;
      }
      
      if (value !== undefined && value !== '') {
        // Transform value if needed
        if (mapping.transform) {
          const transformed = mapping.transform(value);
          if (transformed) {
            if (mapping.commandFlag) {
              args.push(mapping.commandFlag);
              args.push(transformed);
            } else {
              args.push(transformed);
            }
          }
        } else {
          if (mapping.commandFlag) {
            args.push(mapping.commandFlag);
            args.push(String(value));
          } else {
            args.push(String(value));
          }
        }
      }
    }

    return { command: baseCommand, args };
  }

  private async executeValidationRule(
    rule: ValidationRule,
    parameters: Record<string, any>,
    context: ExecutionContext
  ): Promise<boolean> {
    switch (rule.type) {
      case 'parameter':
        return parameters[rule.rule as string] !== undefined;
        
      case 'file_exists':
        const fs = await import('fs-extra');
        const filePath = parameters[rule.rule as string];
        return filePath ? await fs.pathExists(filePath) : false;
        
      case 'directory_exists':
        const fsDir = await import('fs-extra');
        const dirPath = parameters[rule.rule as string];
        if (!dirPath) return false;
        const stats = await fsDir.stat(dirPath).catch(() => null);
        return stats ? stats.isDirectory() : false;
        
      case 'command_available':
        return this.checkCommandAvailable(rule.rule as string);
        
      case 'custom':
        if (typeof rule.rule === 'function') {
          return rule.rule(parameters);
        }
        return false;
        
      default:
        return true;
    }
  }

  private async checkCommandAvailable(command: string): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn('which', [command], { stdio: 'ignore' });
      child.on('close', (code) => resolve(code === 0));
      child.on('error', () => resolve(false));
    });
  }

  private async confirmExecution(
    mappedCommand: any,
    intentResult: IntentResult
  ): Promise<boolean> {
    // In a real implementation, this would show a confirmation dialog
    // For now, we'll assume confirmation based on safety level
    
    if (mappedCommand.safetyLevel === 'dangerous') {
      logger.warn(`Dangerous command requires confirmation: ${mappedCommand.command} ${mappedCommand.args.join(' ')}`);
      // In a real CLI, this would prompt the user
      return false; // Default to not confirmed for dangerous commands
    }
    
    return true;
  }

  private generateCommandExplanation(
    command: string,
    args: string[],
    intentResult: IntentResult
  ): string {
    const fullCommand = `${command} ${args.join(' ')}`;
    
    return `This command (${fullCommand}) will execute the "${intentResult.intent}" operation` +
      (intentResult.parameters ? ` with parameters: ${JSON.stringify(intentResult.parameters)}` : '') +
      `. ${intentResult.reasoning || 'No additional context provided.'}`;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Cancel all running commands
    for (const [id, process] of this.runningCommands) {
      process.kill('SIGTERM');
    }
    
    this.runningCommands.clear();
    this.commandHistory = [];
    this.removeAllListeners();
  }
}

export default CommandMapper;