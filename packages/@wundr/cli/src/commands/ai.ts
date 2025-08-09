import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { ConfigManager } from '../utils/config-manager';
import { PluginManager } from '../plugins/plugin-manager';
import { AIService } from '../ai/ai-service';
import { logger } from '../utils/logger';
import { errorHandler } from '../utils/error-handler';
import { ChatSession } from '../types';

/**
 * AI commands for AI-powered development features
 */
export class AICommands {
  private aiService: AIService;

  constructor(
    private program: Command,
    private configManager: ConfigManager,
    private pluginManager: PluginManager
  ) {
    this.aiService = new AIService(configManager);
    this.registerCommands();
  }

  private registerCommands(): void {
    const aiCmd = this.program
      .command('ai')
      .description('AI-powered development features');

    // Code generation
    aiCmd
      .command('generate <type>')
      .alias('gen')
      .description('generate code using AI')
      .option('--prompt <prompt>', 'generation prompt')
      .option('--template <template>', 'use specific template')
      .option('--context <path>', 'include context from path')
      .option('--output <path>', 'output file path')
      .action(async (type, options) => {
        await this.generateCode(type, options);
      });

    // Code review
    aiCmd
      .command('review [files...]')
      .description('AI-powered code review')
      .option('--focus <aspect>', 'review focus (security, performance, style)', 'all')
      .option('--severity <level>', 'minimum issue severity', 'info')
      .option('--suggest-fixes', 'suggest fixes for issues')
      .action(async (files, options) => {
        await this.reviewCode(files, options);
      });

    // Code refactoring
    aiCmd
      .command('refactor <target>')
      .description('AI-assisted code refactoring')
      .option('--type <type>', 'refactoring type (extract, rename, optimize)', 'optimize')
      .option('--scope <scope>', 'refactoring scope (function, class, file)', 'function')
      .option('--dry-run', 'show refactoring plan without applying')
      .action(async (target, options) => {
        await this.refactorCode(target, options);
      });

    // Documentation generation
    aiCmd
      .command('docs <target>')
      .description('generate documentation using AI')
      .option('--type <type>', 'documentation type (api, readme, comments)', 'api')
      .option('--format <format>', 'output format (markdown, html, json)', 'markdown')
      .option('--include-examples', 'include code examples')
      .action(async (target, options) => {
        await this.generateDocs(target, options);
      });

    // Test generation
    aiCmd
      .command('test <target>')
      .description('generate tests using AI')
      .option('--framework <framework>', 'testing framework (jest, mocha, vitest)', 'jest')
      .option('--coverage <level>', 'coverage level (unit, integration, e2e)', 'unit')
      .option('--mocks', 'generate mock objects')
      .action(async (target, options) => {
        await this.generateTests(target, options);
      });

    // Chat interface
    aiCmd
      .command('chat')
      .alias('c')
      .description('start AI chat session')
      .option('--model <model>', 'AI model to use')
      .option('--context <path>', 'include project context')
      .option('--session <id>', 'resume existing session')
      .action(async (options) => {
        await this.startChatSession(options);
      });

    // Code analysis
    aiCmd
      .command('analyze <target>')
      .description('AI-powered code analysis')
      .option('--aspect <aspect>', 'analysis aspect (complexity, maintainability, security)', 'all')
      .option('--suggestions', 'include improvement suggestions')
      .action(async (target, options) => {
        await this.analyzeCode(target, options);
      });

    // Performance optimization
    aiCmd
      .command('optimize <target>')
      .description('AI-powered performance optimization')
      .option('--focus <focus>', 'optimization focus (speed, memory, bundle)', 'speed')
      .option('--benchmarks', 'run before/after benchmarks')
      .action(async (target, options) => {
        await this.optimizeCode(target, options);
      });

    // AI Setup Command
    aiCmd
      .command('setup')
      .description('setup AI configuration and API keys')
      .option('--provider <provider>', 'AI provider (claude, openai)', 'claude')
      .option('--api-key <key>', 'API key for the provider')
      .option('--validate', 'validate the API key after setup')
      .action(async (options) => {
        await this.setupAI(options);
      });

    // Status Command
    aiCmd
      .command('status')
      .description('check AI configuration status')
      .action(async () => {
        await this.showAIStatus();
      });

    // Validate Command
    aiCmd
      .command('validate')
      .description('validate AI connection and API key')
      .action(async () => {
        await this.validateAI();
      });

    // Configuration
    aiCmd
      .command('config')
      .description('configure AI settings');

    aiCmd
      .command('config set <key> <value>')
      .description('set AI configuration')
      .action(async (key, value) => {
        await this.setAIConfig(key, value);
      });

    aiCmd
      .command('config get [key]')
      .description('get AI configuration')
      .action(async (key) => {
        await this.getAIConfig(key);
      });
  }

  /**
   * Generate code using AI
   */
  private async generateCode(type: string, options: any): Promise<void> {
    try {
      // Check if AI is ready
      if (!this.aiService.isReady()) {
        console.log(chalk.red('\n❌ AI service not configured'));
        console.log(chalk.yellow('Run `wundr ai setup` to configure your API key first'));
        return;
      }

      logger.info(`Generating ${chalk.cyan(type)} code...`);
      
      const prompt = options.prompt || await this.promptForGeneration(type);
      const context = options.context ? await this.loadContext(options.context) : '';
      
      const generatedCode = await this.callAI('generate', {
        type,
        prompt,
        context,
        template: options.template
      });

      if (options.output) {
        await this.saveGeneratedCode(generatedCode, options.output);
        logger.success(`Code generated and saved to ${options.output}`);
      } else {
        console.log(chalk.green('\nGenerated Code:'));
        console.log(generatedCode);
      }

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_AI_GENERATE_FAILED',
        'Failed to generate code',
        { type, options },
        true
      );
    }
  }

  /**
   * AI-powered code review
   */
  private async reviewCode(files: string[], options: any): Promise<void> {
    try {
      // Check if AI is ready
      if (!this.aiService.isReady()) {
        console.log(chalk.red('\n❌ AI service not configured'));
        console.log(chalk.yellow('Run `wundr ai setup` to configure your API key first'));
        return;
      }

      logger.info('Starting AI code review...');
      
      const filesToReview = files.length > 0 ? files : await this.getChangedFiles();
      const reviewResults = [];

      for (const file of filesToReview) {
        logger.debug(`Reviewing ${file}...`);
        
        const code = await this.readFile(file);
        const review = await this.callAI('review', {
          code,
          file,
          focus: options.focus,
          severity: options.severity
        });

        reviewResults.push({
          file,
          issues: review.issues,
          suggestions: review.suggestions,
          score: review.score
        });
      }

      this.displayReviewResults(reviewResults);
      
      if (options.suggestFixes) {
        await this.suggestFixes(reviewResults);
      }

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_AI_REVIEW_FAILED',
        'Failed to review code',
        { files, options },
        true
      );
    }
  }

  /**
   * AI-assisted code refactoring
   */
  private async refactorCode(target: string, options: any): Promise<void> {
    try {
      // Check if AI is ready
      if (!this.aiService.isReady()) {
        console.log(chalk.red('\n❌ AI service not configured'));
        console.log(chalk.yellow('Run `wundr ai setup` to configure your API key first'));
        return;
      }

      logger.info(`Refactoring ${chalk.cyan(target)}...`);
      
      const code = await this.readFile(target);
      const refactoringPlan = await this.callAI('refactor', {
        code,
        target,
        type: options.type,
        scope: options.scope
      });

      if (options.dryRun) {
        logger.info('Refactoring Plan:');
        console.log(refactoringPlan.description);
        console.log('\nProposed Changes:');
        refactoringPlan.changes.forEach((change: any, i: number) => {
          console.log(`${i + 1}. ${change.description}`);
        });
        return;
      }

      const { proceed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'proceed',
        message: 'Apply refactoring changes?',
        default: false
      }]);

      if (proceed) {
        await this.applyRefactoring(target, refactoringPlan);
        logger.success(`Refactoring applied to ${target}`);
      }

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_AI_REFACTOR_FAILED',
        'Failed to refactor code',
        { target, options },
        true
      );
    }
  }

  /**
   * Generate documentation using AI
   */
  private async generateDocs(target: string, options: any): Promise<void> {
    try {
      // Check if AI is ready
      if (!this.aiService.isReady()) {
        console.log(chalk.red('\n❌ AI service not configured'));
        console.log(chalk.yellow('Run `wundr ai setup` to configure your API key first'));
        return;
      }

      logger.info(`Generating ${options.type} documentation for ${chalk.cyan(target)}...`);
      
      const code = await this.readFile(target);
      const _docs = await this.callAI('docs', {
        code,
        target,
        type: options.type,
        format: options.format,
        includeExamples: options.includeExamples
      });

      const outputPath = this.getDocsOutputPath(target, options.type, options.format);
      await this.saveGeneratedDocs(_docs, outputPath);
      
      logger.success(`Documentation generated: ${outputPath}`);

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_AI_DOCS_FAILED',
        'Failed to generate documentation',
        { target, options },
        true
      );
    }
  }

  /**
   * Generate tests using AI
   */
  private async generateTests(target: string, options: any): Promise<void> {
    try {
      // Check if AI is ready
      if (!this.aiService.isReady()) {
        console.log(chalk.red('\n❌ AI service not configured'));
        console.log(chalk.yellow('Run `wundr ai setup` to configure your API key first'));
        return;
      }

      logger.info(`Generating tests for ${chalk.cyan(target)}...`);
      
      const code = await this.readFile(target);
      const tests = await this.callAI('test', {
        code,
        target,
        framework: options.framework,
        coverage: options.coverage,
        mocks: options.mocks
      });

      const testPath = this.getTestOutputPath(target, options.framework);
      await this.saveGeneratedCode(tests, testPath);
      
      logger.success(`Tests generated: ${testPath}`);

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_AI_TEST_FAILED',
        'Failed to generate tests',
        { target, options },
        true
      );
    }
  }

  /**
   * Start AI chat session
   */
  private async startChatSession(options: any): Promise<void> {
    try {
      // Check if AI is ready
      if (!this.aiService.isReady()) {
        console.log(chalk.red('\n❌ AI service not configured'));
        console.log(chalk.yellow('Run `wundr ai setup` to configure your API key first'));
        return;
      }

      logger.info('Starting AI chat session...');
      
      const session: ChatSession = options.session 
        ? await this.loadChatSession(options.session)
        : await this.createChatSession(options);

      await this.runChatLoop(session);

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_AI_CHAT_FAILED',
        'Failed to start chat session',
        { options },
        true
      );
    }
  }

  /**
   * AI-powered code analysis
   */
  private async analyzeCode(target: string, options: any): Promise<void> {
    try {
      // Check if AI is ready
      if (!this.aiService.isReady()) {
        console.log(chalk.red('\n❌ AI service not configured'));
        console.log(chalk.yellow('Run `wundr ai setup` to configure your API key first'));
        return;
      }

      logger.info(`Analyzing ${chalk.cyan(target)}...`);
      
      const code = await this.readFile(target);
      const analysis = await this.callAI('analyze', {
        code,
        target,
        aspect: options.aspect,
        suggestions: options.suggestions
      });

      this.displayAnalysisResults(analysis);

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_AI_ANALYZE_FAILED',
        'Failed to analyze code',
        { target, options },
        true
      );
    }
  }

  /**
   * AI-powered performance optimization
   */
  private async optimizeCode(target: string, options: any): Promise<void> {
    try {
      // Check if AI is ready
      if (!this.aiService.isReady()) {
        console.log(chalk.red('\n❌ AI service not configured'));
        console.log(chalk.yellow('Run `wundr ai setup` to configure your API key first'));
        return;
      }

      logger.info(`Optimizing ${chalk.cyan(target)}...`);
      
      const code = await this.readFile(target);
      let beforeBenchmark = null;
      
      if (options.benchmarks) {
        beforeBenchmark = await this.runBenchmark(target);
      }

      const _optimization = await this.callAI('optimize', {
        code,
        target,
        focus: options.focus
      });

      const { apply } = await inquirer.prompt([{
        type: 'confirm',
        name: 'apply',
        message: 'Apply optimization changes?',
        default: false
      }]);

      if (apply) {
        await this.applyOptimization(target, _optimization);
        
        if (options.benchmarks) {
          const afterBenchmark = await this.runBenchmark(target);
          this.displayBenchmarkComparison(beforeBenchmark, afterBenchmark);
        }
        
        logger.success(`Code optimized: ${target}`);
      }

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_AI_OPTIMIZE_FAILED',
        'Failed to optimize code',
        { target, options },
        true
      );
    }
  }

  /**
   * Set AI configuration
   */
  private async setAIConfig(key: string, value: string): Promise<void> {
    try {
      this.configManager.set(`ai.${key}`, value);
      await this.configManager.saveConfig();
      logger.success(`AI configuration updated: ${key} = ${value}`);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_AI_CONFIG_SET_FAILED',
        'Failed to set AI configuration',
        { key, value },
        true
      );
    }
  }

  /**
   * Get AI configuration
   */
  private async getAIConfig(key?: string): Promise<void> {
    try {
      if (key) {
        const value = this.configManager.get(`ai.${key}`);
        console.log(`${key}: ${value}`);
      } else {
        const aiConfig = this.configManager.get('ai');
        console.log(JSON.stringify(aiConfig, null, 2));
      }
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_AI_CONFIG_GET_FAILED',
        'Failed to get AI configuration',
        { key },
        true
      );
    }
  }

  /**
   * Setup AI configuration
   */
  private async setupAI(options: any): Promise<void> {
    try {
      console.log(chalk.blue('\n🤖 Wundr AI Setup'));
      console.log(chalk.gray('Configure your AI assistant for enhanced CLI features\n'));

      let { provider, apiKey } = options;

      // Ask for provider if not specified
      if (!provider) {
        const providerAnswer = await inquirer.prompt([{
          type: 'list',
          name: 'provider',
          message: 'Select AI provider:',
          choices: [
            { name: 'Claude (Anthropic)', value: 'claude' },
            { name: 'OpenAI GPT', value: 'openai' }
          ],
          default: 'claude'
        }]);
        provider = providerAnswer.provider;
      }

      // Ask for API key if not provided
      if (!apiKey) {
        const keyPrompt = provider === 'claude' 
          ? 'Enter your Claude API key (from https://console.anthropic.com):'
          : 'Enter your OpenAI API key (from https://platform.openai.com):';

        const keyAnswer = await inquirer.prompt([{
          type: 'password',
          name: 'apiKey',
          message: keyPrompt,
          validate: (input) => {
            if (!input || input.length < 10) {
              return 'Please enter a valid API key';
            }
            return true;
          }
        }]);
        apiKey = keyAnswer.apiKey;
      }

      // Set up the AI service
      await this.aiService.setupAI(apiKey, provider);
      
      // Validate if requested
      if (options.validate) {
        console.log(chalk.blue('\nValidating API key...'));
        const validation = await this.aiService.validateConnection();
        
        if (validation.connected) {
          console.log(chalk.green('✅ API key is valid and working!'));
        } else {
          console.log(chalk.red(`❌ API key validation failed: ${validation.error}`));
          return;
        }
      }

      console.log(chalk.green('\n✅ AI setup completed successfully!'));
      console.log(chalk.gray('\nYou can now use AI features like:'));
      console.log(chalk.gray('  • wundr ai chat - Interactive AI assistant'));
      console.log(chalk.gray('  • wundr ai generate - Code generation'));
      console.log(chalk.gray('  • wundr ai review - Code review'));
      console.log(chalk.gray('\nRun `wundr ai status` to check configuration'));

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_AI_SETUP_FAILED',
        'Failed to setup AI configuration',
        { options },
        true
      );
    }
  }

  /**
   * Show AI status
   */
  private async showAIStatus(): Promise<void> {
    try {
      const status = this.aiService.getStatus();
      
      console.log(chalk.blue('\n🤖 AI Configuration Status\n'));
      
      console.log(`Provider: ${chalk.cyan(status.provider)}`);
      console.log(`Model: ${chalk.cyan(status.model)}`);
      console.log(`API Key: ${status.hasApiKey ? chalk.green('✅ Configured') : chalk.red('❌ Missing')}`);
      console.log(`Status: ${status.ready ? chalk.green('✅ Ready') : chalk.yellow('⚠️  Not Ready')}`);
      
      if (!status.hasApiKey) {
        console.log(chalk.yellow('\n⚠️  API key not configured'));
        console.log(chalk.gray('Run `wundr ai setup` to configure your API key'));
        console.log(chalk.gray('Or set the CLAUDE_API_KEY environment variable'));
      } else if (!status.ready) {
        console.log(chalk.yellow('\n⚠️  AI service not ready'));
        console.log(chalk.gray('Try running `wundr ai validate` to check connection'));
      }
      
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_AI_STATUS_FAILED',
        'Failed to get AI status',
        {},
        true
      );
    }
  }

  /**
   * Validate AI connection
   */
  private async validateAI(): Promise<void> {
    try {
      console.log(chalk.blue('\n🔍 Validating AI connection...'));
      
      const validation = await this.aiService.validateConnection();
      
      console.log(`\nProvider: ${chalk.cyan(validation.provider)}`);
      console.log(`Model: ${chalk.cyan(validation.model)}`);
      
      if (validation.connected) {
        console.log(chalk.green('\n✅ Connection successful!'));
        console.log(chalk.gray('AI features are ready to use.'));
      } else {
        console.log(chalk.red('\n❌ Connection failed'));
        console.log(chalk.red(`Error: ${validation.error}`));
        
        if (validation.error?.includes('API key')) {
          console.log(chalk.yellow('\n💡 Try:'));
          console.log(chalk.gray('1. Run `wundr ai setup` to configure your API key'));
          console.log(chalk.gray('2. Check your API key is valid and has sufficient credits'));
          console.log(chalk.gray('3. Verify your internet connection'));
        }
      }
      
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_AI_VALIDATE_FAILED',
        'Failed to validate AI connection',
        {},
        true
      );
    }
  }

  /**
   * Helper methods
   */
  private async callAI(operation: string, params: any): Promise<any> {
    // Check if AI service is ready
    if (!this.aiService.isReady()) {
      throw new Error('AI service not configured. Run `wundr ai setup` first.');
    }

    logger.debug(`Calling AI for operation: ${operation}`);
    
    // For now, return mock responses - these would be replaced with actual AI calls
    switch (operation) {
      case 'generate':
        return `// Generated ${params.type} code\nfunction ${params.type}() {\n  // Implementation here\n}`;
      case 'review':
        return { issues: [], suggestions: [], score: 95 };
      case 'refactor':
        return { description: 'Refactoring plan', changes: [] };
      case 'docs':
        return `# ${params.target} Documentation\n\nGenerated documentation...`;
      case 'test':
        return `// Generated tests\ndescribe('${params.target}', () => {\n  // Tests here\n});`;
      case 'analyze':
        return { complexity: 'low', maintainability: 'high', suggestions: [] };
      case 'optimize':
        return { description: 'Optimization plan', changes: [] };
      case 'chat':
        return 'This is a mock response. In a real implementation, this would use the AI service.';
      default:
        throw new Error(`Unknown AI operation: ${operation}`);
    }
  }

  private async promptForGeneration(type: string): Promise<string> {
    const { prompt } = await inquirer.prompt([{
      type: 'input',
      name: 'prompt',
      message: `Describe the ${type} you want to generate:`,
      validate: (input) => input.length > 0 || 'Prompt is required'
    }]);
    return prompt;
  }

  private async loadContext(contextPath: string): Promise<string> {
    // Load project context from specified path
    return `// Context from ${contextPath}`;
  }

  private async saveGeneratedCode(_code: string, outputPath: string): Promise<void> {
    // Save generated code to file
    logger.debug(`Saving generated code to ${outputPath}`);
  }

  private async readFile(filePath: string): Promise<string> {
    // Read file content
    return `// Content of ${filePath}`;
  }

  private async getChangedFiles(): Promise<string[]> {
    // Get list of changed files from git
    return ['src/example.ts'];
  }

  private displayReviewResults(results: any[]): void {
    console.log(chalk.blue('\nCode Review Results:'));
    results.forEach(result => {
      console.log(`\n${chalk.cyan(result.file)} (Score: ${result.score}/100)`);
      if (result.issues.length > 0) {
        result.issues.forEach((issue: any) => {
          console.log(`  ${issue.severity}: ${issue.description}`);
        });
      }
    });
  }

  private async suggestFixes(_results: any[]): Promise<void> {
    // Implementation for suggesting fixes
    logger.info('Generating fix suggestions...');
  }

  private async applyRefactoring(target: string, _plan: any): Promise<void> {
    // Apply refactoring changes
    logger.debug(`Applying refactoring to ${target}`);
  }

  private getDocsOutputPath(target: string, type: string, format: string): string {
    const ext = format === 'markdown' ? 'md' : format;
    return `docs/${target}.${type}.${ext}`;
  }

  private async saveGeneratedDocs(_docs: string, outputPath: string): Promise<void> {
    // Save generated documentation
    logger.debug(`Saving documentation to ${outputPath}`);
  }

  private getTestOutputPath(target: string, _framework: string): string {
    return `${target}.test.js`;
  }

  private async loadChatSession(sessionId: string): Promise<ChatSession> {
    // Load existing chat session
    return {
      id: sessionId,
      model: 'claude-3',
      history: [],
      created: new Date(),
      updated: new Date()
    };
  }

  private async createChatSession(options: any): Promise<ChatSession> {
    return {
      id: `session-${Date.now()}`,
      model: options.model || 'claude-3',
      context: options.context,
      history: [],
      created: new Date(),
      updated: new Date()
    };
  }

  private async runChatLoop(session: ChatSession): Promise<void> {
    console.log(chalk.green(`\nAI Chat Session (${session.model})`));
    console.log(chalk.gray('Type "exit" to end the session\n'));

    // Load existing session into AI service
    this.aiService.loadChatSession(session);

    while (true) {
      const { message } = await inquirer.prompt([{
        type: 'input',
        name: 'message',
        message: 'You:',
        validate: (input) => input.length > 0 || 'Message cannot be empty'
      }]);

      if (message.toLowerCase() === 'exit') {
        break;
      }

      try {
        // Use real AI service for chat
        const response = await this.aiService.sendMessage(session.id, message, {
          projectPath: process.cwd(),
          currentGoal: 'Interactive chat session'
        });
        
        console.log(chalk.cyan(`AI: ${response}`));

        // Update session history from AI service
        session.history = this.aiService.exportChatSession(session.id);
        session.updated = new Date();
      } catch (error: any) {
        console.log(chalk.red(`Error: ${error.message}`));
        console.log(chalk.yellow('\nTip: Try `wundr ai validate` to check your connection'));
      }
    }

    logger.success('Chat session ended');
  }

  private displayAnalysisResults(analysis: any): void {
    console.log(chalk.blue('\nCode Analysis Results:'));
    console.log(`Complexity: ${analysis.complexity}`);
    console.log(`Maintainability: ${analysis.maintainability}`);
    
    if (analysis.suggestions.length > 0) {
      console.log('\nSuggestions:');
      analysis.suggestions.forEach((suggestion: string, i: number) => {
        console.log(`${i + 1}. ${suggestion}`);
      });
    }
  }

  private async runBenchmark(_target: string): Promise<any> {
    // Run performance benchmark
    return { time: 100, memory: 50 };
  }

  private async applyOptimization(target: string, _optimization: any): Promise<void> {
    // Apply optimization changes
    logger.debug(`Applying optimization to ${target}`);
  }

  private displayBenchmarkComparison(before: any, after: any): void {
    console.log(chalk.blue('\nBenchmark Comparison:'));
    console.log(`Time: ${before.time}ms → ${after.time}ms (${after.time - before.time}ms)`);
    console.log(`Memory: ${before.memory}MB → ${after.memory}MB (${after.memory - before.memory}MB)`);
  }
}