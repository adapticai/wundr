import { logger } from '../utils/logger';
import { AIService, ConversationContext } from '../ai/ai-service';

/**
 * Natural language command parsing result
 */
export interface ParsedCommand {
  originalInput: string;
  intent: string;
  command: string;
  args: string[];
  options: Record<string, any>;
  confidence: number;
  needsConfirmation: boolean;
  suggestions?: string[];
  clarificationQuestion?: string;
  executionPlan?: ExecutionStep[];
}

/**
 * Execution step for complex commands
 */
export interface ExecutionStep {
  step: number;
  description: string;
  command: string;
  args: string[];
  options: Record<string, any>;
  dependencies?: number[];
  optional?: boolean;
}

/**
 * Command template for pattern matching
 */
export interface CommandTemplate {
  pattern: RegExp;
  command: string;
  extractParams: (match: RegExpMatchArray) => Record<string, any>;
  confidence: number;
}

/**
 * Natural language command parser
 */
export class CommandParser {
  private aiService: AIService;
  private commandTemplates: CommandTemplate[];

  constructor(aiService: AIService) {
    this.aiService = aiService;
    this.commandTemplates = this.initializeTemplates();
  }

  /**
   * Parse natural language input into CLI command
   */
  async parseCommand(
    input: string,
    context?: ConversationContext
  ): Promise<ParsedCommand> {
    try {
      // First, try template-based parsing for common patterns
      const templateResult = this.tryTemplateMatching(input);
      
      if (templateResult && templateResult.confidence > 0.8) {
        return {
          originalInput: input,
          intent: templateResult.intent,
          command: templateResult.command,
          args: templateResult.args,
          options: templateResult.options,
          confidence: templateResult.confidence,
          needsConfirmation: false,
          executionPlan: [this.createExecutionStep(templateResult)]
        };
      }

      // Fall back to AI-powered parsing
      const aiResult = await this.aiService.parseNaturalLanguageCommand(input, context);
      
      // Parse the command string into components
      const parsedComponents = this.parseCommandString(aiResult.command);
      
      return {
        originalInput: input,
        intent: aiResult.intent,
        command: parsedComponents.command,
        args: parsedComponents.args,
        options: parsedComponents.options,
        confidence: aiResult.confidence,
        needsConfirmation: aiResult.needsConfirmation,
        clarificationQuestion: aiResult.clarificationQuestion,
        executionPlan: [this.createExecutionStepFromParsed(parsedComponents)]
      };

    } catch (error) {
      logger.error('Failed to parse command:', error);
      
      return {
        originalInput: input,
        intent: 'unknown',
        command: '',
        args: [],
        options: {},
        confidence: 0,
        needsConfirmation: true,
        clarificationQuestion: `I couldn't understand "${input}". Could you please rephrase or provide more specific details?`,
        suggestions: await this.generateSuggestions(input, context)
      };
    }
  }

  /**
   * Parse complex multi-step commands
   */
  async parseComplexCommand(
    input: string,
    context?: ConversationContext
  ): Promise<ParsedCommand> {
    try {
      // Check if this is a complex command (contains "and", "then", "after")
      const complexPatterns = [
        /\s+and\s+/i,
        /\s+then\s+/i,
        /\s+after\s+/i,
        /[;,]\s*/
      ];

      const isComplex = complexPatterns.some(pattern => pattern.test(input));
      
      if (!isComplex) {
        return await this.parseCommand(input, context);
      }

      // Split the input into steps
      const steps = this.splitIntoSteps(input);
      const executionPlan: ExecutionStep[] = [];

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const stepResult = await this.parseCommand(step, context);
        
        executionPlan.push({
          step: i + 1,
          description: step,
          command: stepResult.command,
          args: stepResult.args,
          options: stepResult.options,
          dependencies: i > 0 ? [i] : undefined
        });
      }

      return {
        originalInput: input,
        intent: 'complex_workflow',
        command: 'batch',
        args: ['--interactive'],
        options: { steps: executionPlan.length },
        confidence: 0.9,
        needsConfirmation: true,
        executionPlan
      };

    } catch (error) {
      logger.error('Failed to parse complex command:', error);
      return await this.parseCommand(input, context);
    }
  }

  /**
   * Validate parsed command before execution
   */
  async validateCommand(parsedCommand: ParsedCommand): Promise<{
    valid: boolean;
    issues: string[];
    recommendations?: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check if command exists
    if (!parsedCommand.command || parsedCommand.command.trim() === '') {
      issues.push('No valid command identified');
      recommendations.push('Try rephrasing with a specific action like "analyze", "create", or "init"');
    }

    // Validate command format
    if (parsedCommand.command && !parsedCommand.command.startsWith('wundr ')) {
      if (this.isValidWundrCommand(parsedCommand.command)) {
        parsedCommand.command = `wundr ${parsedCommand.command}`;
      } else {
        issues.push(`Unknown command: ${parsedCommand.command}`);
        recommendations.push('Use "wundr help" to see available commands');
      }
    }

    // Check confidence level
    if (parsedCommand.confidence < 0.6) {
      issues.push('Low confidence in command interpretation');
      recommendations.push('Consider providing more specific details about what you want to accomplish');
    }

    // Validate required parameters for specific commands
    await this.validateCommandSpecifics(parsedCommand, issues, recommendations);

    return {
      valid: issues.length === 0,
      issues,
      recommendations: recommendations.length > 0 ? recommendations : undefined
    };
  }

  /**
   * Generate command suggestions based on input
   */
  async generateSuggestions(
    input: string,
    context?: ConversationContext
  ): Promise<string[]> {
    try {
      const suggestions = await this.aiService.suggestCommands(input, context);
      return suggestions.map(s => s.command);
    } catch (error) {
      logger.error('Failed to generate suggestions:', error);
      
      // Fallback to template-based suggestions
      return this.getFallbackSuggestions(input);
    }
  }

  /**
   * Initialize command templates for pattern matching
   */
  private initializeTemplates(): CommandTemplate[] {
    return [
      // Analysis commands
      {
        pattern: /analyze|check|scan|examine/i,
        command: 'wundr analyze',
        extractParams: (match) => ({}),
        confidence: 0.9
      },
      {
        pattern: /analyze.*dependencies|dependency analysis|check deps/i,
        command: 'wundr analyze --focus dependencies',
        extractParams: (match) => ({ focus: 'dependencies' }),
        confidence: 0.95
      },
      {
        pattern: /analyze.*duplicates|find duplicates|duplicate analysis/i,
        command: 'wundr analyze --focus duplicates',
        extractParams: (match) => ({ focus: 'duplicates' }),
        confidence: 0.95
      },

      // Initialization commands
      {
        pattern: /init|initialize|setup|start new/i,
        command: 'wundr init',
        extractParams: (match) => ({}),
        confidence: 0.9
      },
      {
        pattern: /init.*project|initialize project|setup project/i,
        command: 'wundr init --type project',
        extractParams: (match) => ({ type: 'project' }),
        confidence: 0.95
      },

      // Creation commands
      {
        pattern: /create.*service|new service|generate service/i,
        command: 'wundr create service',
        extractParams: (match) => ({}),
        confidence: 0.9
      },
      {
        pattern: /create.*component|new component|generate component/i,
        command: 'wundr create component',
        extractParams: (match) => ({}),
        confidence: 0.9
      },

      // Dashboard commands
      {
        pattern: /show dashboard|open dashboard|start dashboard/i,
        command: 'wundr dashboard --start',
        extractParams: (match) => ({ start: true }),
        confidence: 0.9
      },

      // Governance commands
      {
        pattern: /apply governance|governance check|compliance check/i,
        command: 'wundr govern --check',
        extractParams: (match) => ({ check: true }),
        confidence: 0.9
      },

      // Watch commands
      {
        pattern: /watch.*files|monitor files|auto.*run/i,
        command: 'wundr watch',
        extractParams: (match) => ({}),
        confidence: 0.9
      }
    ];
  }

  /**
   * Try to match input against command templates
   */
  private tryTemplateMatching(input: string): {
    intent: string;
    command: string;
    args: string[];
    options: Record<string, any>;
    confidence: number;
  } | null {
    for (const template of this.commandTemplates) {
      const match = input.match(template.pattern);
      
      if (match) {
        const params = template.extractParams(match);
        const parsedCommand = this.parseCommandString(template.command);
        
        return {
          intent: this.extractIntent(template.command),
          command: parsedCommand.command,
          args: parsedCommand.args,
          options: { ...parsedCommand.options, ...params },
          confidence: template.confidence
        };
      }
    }
    
    return null;
  }

  /**
   * Parse command string into components
   */
  private parseCommandString(commandStr: string): {
    command: string;
    args: string[];
    options: Record<string, any>;
  } {
    const parts = commandStr.trim().split(/\s+/);
    const command = parts.slice(0, 2).join(' '); // "wundr analyze"
    const remaining = parts.slice(2);
    
    const args: string[] = [];
    const options: Record<string, any> = {};
    
    for (let i = 0; i < remaining.length; i++) {
      const part = remaining[i];
      
      if (part.startsWith('--')) {
        const optionName = part.slice(2);
        const nextPart = remaining[i + 1];
        
        if (nextPart && !nextPart.startsWith('-')) {
          options[optionName] = nextPart;
          i++; // Skip next part
        } else {
          options[optionName] = true;
        }
      } else if (part.startsWith('-')) {
        const optionName = part.slice(1);
        options[optionName] = true;
      } else {
        args.push(part);
      }
    }
    
    return { command, args, options };
  }

  /**
   * Extract intent from command
   */
  private extractIntent(command: string): string {
    const parts = command.split(' ');
    if (parts.length >= 2) {
      return parts[1]; // "analyze", "create", etc.
    }
    return 'unknown';
  }

  /**
   * Create execution step from template result
   */
  private createExecutionStep(templateResult: {
    command: string;
    args: string[];
    options: Record<string, any>;
  }): ExecutionStep {
    return {
      step: 1,
      description: `Execute ${templateResult.command}`,
      command: templateResult.command,
      args: templateResult.args,
      options: templateResult.options
    };
  }

  /**
   * Create execution step from parsed command
   */
  private createExecutionStepFromParsed(parsedComponents: {
    command: string;
    args: string[];
    options: Record<string, any>;
  }): ExecutionStep {
    return {
      step: 1,
      description: `Execute ${parsedComponents.command}`,
      command: parsedComponents.command,
      args: parsedComponents.args,
      options: parsedComponents.options
    };
  }

  /**
   * Split complex input into execution steps
   */
  private splitIntoSteps(input: string): string[] {
    // Split on coordinating conjunctions and punctuation
    const separators = /\s+(and|then|after|next|followed by)[,\s]+|[;,]\s+/i;
    return input.split(separators)
      .map(step => step.trim())
      .filter(step => step.length > 0 && !['and', 'then', 'after', 'next', 'followed by'].includes(step.toLowerCase()));
  }

  /**
   * Check if command is a valid Wundr command
   */
  private isValidWundrCommand(command: string): boolean {
    const validCommands = [
      'init', 'create', 'analyze', 'govern', 'dashboard', 
      'watch', 'batch', 'plugins', 'chat', 'help'
    ];
    
    const baseCommand = command.split(' ')[0];
    return validCommands.includes(baseCommand);
  }

  /**
   * Validate command-specific requirements
   */
  private async validateCommandSpecifics(
    parsedCommand: ParsedCommand,
    issues: string[],
    recommendations: string[]
  ): Promise<void> {
    const commandParts = parsedCommand.command.split(' ');
    const baseCommand = commandParts[1]; // Skip "wundr"

    switch (baseCommand) {
      case 'create':
        if (parsedCommand.args.length === 0) {
          issues.push('Create command requires a type (service, component, etc.)');
          recommendations.push('Specify what you want to create: "wundr create service MyService"');
        }
        break;

      case 'analyze':
        // Analyze command is flexible, but we can suggest focus areas
        if (!parsedCommand.options.focus) {
          recommendations.push('Consider using --focus to target specific areas (dependencies, duplicates, quality)');
        }
        break;

      case 'watch':
        if (!parsedCommand.options.pattern && parsedCommand.args.length === 0) {
          recommendations.push('Specify file patterns to watch: "wundr watch --pattern "**/*.ts""');
        }
        break;

      case 'batch':
        if (!parsedCommand.options.file && !parsedCommand.options.interactive) {
          issues.push('Batch command requires either a batch file or interactive mode');
          recommendations.push('Use --file <batch-file> or --interactive for step-by-step execution');
        }
        break;
    }
  }

  /**
   * Get fallback suggestions when AI fails
   */
  private getFallbackSuggestions(input: string): string[] {
    const suggestions: string[] = [];
    const lowerInput = input.toLowerCase();

    if (lowerInput.includes('analyze') || lowerInput.includes('check')) {
      suggestions.push('wundr analyze --path ./src');
      suggestions.push('wundr analyze --focus dependencies');
    }

    if (lowerInput.includes('create') || lowerInput.includes('new')) {
      suggestions.push('wundr create service MyService');
      suggestions.push('wundr create component MyComponent');
    }

    if (lowerInput.includes('init') || lowerInput.includes('setup')) {
      suggestions.push('wundr init --type project');
      suggestions.push('wundr init --template basic');
    }

    if (lowerInput.includes('dashboard') || lowerInput.includes('show')) {
      suggestions.push('wundr dashboard --start');
    }

    if (suggestions.length === 0) {
      suggestions.push('wundr help');
      suggestions.push('wundr analyze --path .');
      suggestions.push('wundr init');
    }

    return suggestions.slice(0, 3); // Limit to 3 suggestions
  }
}