import path from 'path';

import chalk from 'chalk';
import fs from 'fs-extra';
import inquirer from 'inquirer';

import { errorHandler } from '../utils/error-handler';
import { logger } from '../utils/logger';

import type { PluginManager } from '../plugins/plugin-manager';
import type { ChatSession, ChatMessage } from '../types';
import type { ConfigManager } from '../utils/config-manager';
import type { Command } from 'commander';

/**
 * Chat commands for natural language interface
 */
export class ChatCommands {
  private activeSessions: Map<string, ChatSession> = new Map();

  constructor(
    private program: Command,
    private configManager: ConfigManager,
    private pluginManager: PluginManager
  ) {
    this.registerCommands();
  }

  private registerCommands(): void {
    const chatCmd = this.program
      .command('chat')
      .alias('c')
      .description('natural language chat interface');

    // Start chat session
    chatCmd
      .command('start')
      .description('start a new chat session')
      .option('--model <model>', 'AI model to use', 'claude-3')
      .option('--context <path>', 'include project context from path')
      .option(
        '--persona <persona>',
        'AI persona (developer, architect, reviewer)',
        'developer'
      )
      .option('--session-name <name>', 'custom session name')
      .action(async options => {
        await this.startChatSession(options);
      });

    // Resume chat session
    chatCmd
      .command('resume <sessionId>')
      .description('resume existing chat session')
      .action(async sessionId => {
        await this.resumeChatSession(sessionId);
      });

    // List chat sessions
    chatCmd
      .command('list')
      .alias('ls')
      .description('list chat sessions')
      .option('--active-only', 'show only active sessions')
      .action(async options => {
        await this.listChatSessions(options);
      });

    // Send single message
    chatCmd
      .command('ask <message>')
      .description('send a single message and get response')
      .option('--session <sessionId>', 'use specific session')
      .option('--model <model>', 'AI model to use')
      .option('--context <path>', 'include context from path')
      .action(async (message, options) => {
        await this.askSingleQuestion(message, options);
      });

    // Export chat session
    chatCmd
      .command('export <sessionId>')
      .description('export chat session')
      .option(
        '--format <format>',
        'export format (json, markdown, txt)',
        'markdown'
      )
      .option('--output <path>', 'output file path')
      .action(async (sessionId, options) => {
        await this.exportChatSession(sessionId, options);
      });

    // Import chat session
    chatCmd
      .command('import <file>')
      .description('import chat session')
      .option('--format <format>', 'import format (json, markdown)')
      .action(async (file, options) => {
        await this.importChatSession(file, options);
      });

    // Delete chat session
    chatCmd
      .command('delete <sessionId>')
      .description('delete chat session')
      .option('--force', 'skip confirmation')
      .action(async (sessionId, options) => {
        await this.deleteChatSession(sessionId, options);
      });

    // Configure chat
    chatCmd.command('config').description('configure chat settings');

    chatCmd
      .command('config set <key> <value>')
      .description('set chat configuration')
      .action(async (key, value) => {
        await this.setChatConfig(key, value);
      });

    chatCmd
      .command('config get [key]')
      .description('get chat configuration')
      .action(async key => {
        await this.getChatConfig(key);
      });

    // Chat with files
    chatCmd
      .command('file <file>')
      .description('chat about specific file')
      .option(
        '--action <action>',
        'action to perform (explain, review, improve)',
        'explain'
      )
      .option('--model <model>', 'AI model to use')
      .action(async (file, options) => {
        await this.chatWithFile(file, options);
      });

    // Chat with code
    chatCmd
      .command('code')
      .description('chat about code from clipboard or input')
      .option('--clipboard', 'read code from clipboard')
      .option(
        '--action <action>',
        'action to perform (explain, review, improve)',
        'explain'
      )
      .action(async options => {
        await this.chatWithCode(options);
      });

    // Chat templates
    chatCmd.command('template').description('manage chat templates');

    chatCmd
      .command('template list')
      .description('list available chat templates')
      .action(async () => {
        await this.listChatTemplates();
      });

    chatCmd
      .command('template use <name>')
      .description('start chat with template')
      .option('--vars <vars>', 'template variables (JSON or key=value)')
      .action(async (name, options) => {
        await this.useChatTemplate(name, options);
      });
  }

  /**
   * Start a new chat session
   */
  private async startChatSession(options: any): Promise<void> {
    try {
      logger.info('Starting new chat session...');

      const session = await this.createNewSession(options);
      this.activeSessions.set(session.id, session);

      console.log(chalk.green(`\n🤖 Chat Session Started (${session.model})`));
      console.log(chalk.gray(`Session ID: ${session.id}`));
      if (session.context) {
        console.log(chalk.gray(`Context: ${session.context}`));
      }
      console.log(
        chalk.gray('Type "exit" to end the session, "help" for commands\n')
      );

      await this.runChatLoop(session);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_CHAT_START_FAILED',
        'Failed to start chat session',
        { options },
        true
      );
    }
  }

  /**
   * Resume existing chat session
   */
  private async resumeChatSession(sessionId: string): Promise<void> {
    try {
      logger.info(`Resuming chat session: ${sessionId}`);

      const session = await this.loadChatSession(sessionId);
      if (!session) {
        throw new Error(`Chat session not found: ${sessionId}`);
      }

      this.activeSessions.set(sessionId, session);

      console.log(chalk.green(`\n🤖 Chat Session Resumed (${session.model})`));
      console.log(chalk.gray(`Session ID: ${session.id}`));
      console.log(chalk.gray(`Messages: ${session.history.length}`));
      console.log(
        chalk.gray(`Last updated: ${session.updated.toLocaleString()}\n`)
      );

      // Show recent messages
      if (session.history.length > 0) {
        console.log(chalk.blue('Recent messages:'));
        session.history.slice(-3).forEach(msg => {
          const role = msg.role === 'user' ? 'You' : 'AI';
          const content =
            msg.content.length > 100
              ? msg.content.substring(0, 100) + '...'
              : msg.content;
          console.log(`  ${chalk.cyan(role)}: ${content}`);
        });
        console.log();
      }

      await this.runChatLoop(session);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_CHAT_RESUME_FAILED',
        'Failed to resume chat session',
        { sessionId },
        true
      );
    }
  }

  /**
   * List chat sessions
   */
  private async listChatSessions(options: any): Promise<void> {
    try {
      const sessions = await this.getAllChatSessions();
      const filteredSessions = options.activeOnly
        ? sessions.filter(s => this.activeSessions.has(s.id))
        : sessions;

      if (filteredSessions.length === 0) {
        logger.info('No chat sessions found');
        return;
      }

      logger.info(`Chat sessions (${filteredSessions.length}):`);

      const sessionData = filteredSessions.map(session => ({
        ID: session.id,
        Model: session.model,
        Messages: session.history.length,
        Created: session.created.toLocaleDateString(),
        Updated: session.updated.toLocaleDateString(),
        Active: this.activeSessions.has(session.id) ? '✓' : '✗',
      }));

      console.table(sessionData);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_CHAT_LIST_FAILED',
        'Failed to list chat sessions',
        { options },
        true
      );
    }
  }

  /**
   * Ask a single question
   */
  private async askSingleQuestion(
    message: string,
    options: any
  ): Promise<void> {
    try {
      logger.debug('Processing single question...');

      let session: ChatSession | null;

      if (options.session) {
        session = await this.loadChatSession(options.session);
        if (!session) {
          throw new Error(`Chat session not found: ${options.session}`);
        }
      } else {
        session = await this.createNewSession({
          model: options.model,
          context: options.context,
        });
      }

      const response = await this.sendMessage(session, message);

      console.log(chalk.cyan('\nAI Response:'));
      console.log(response);
      console.log();

      // Save session if it was created for this question
      if (!options.session) {
        await this.saveChatSession(session);
        logger.debug(`Session saved: ${session.id}`);
      }
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_CHAT_ASK_FAILED',
        'Failed to process question',
        { message, options },
        true
      );
    }
  }

  /**
   * Export chat session
   */
  private async exportChatSession(
    sessionId: string,
    options: any
  ): Promise<void> {
    try {
      logger.info(`Exporting chat session: ${sessionId}`);

      const session = await this.loadChatSession(sessionId);
      if (!session) {
        throw new Error(`Chat session not found: ${sessionId}`);
      }

      let exportedContent: string;

      switch (options.format) {
        case 'json':
          exportedContent = JSON.stringify(session, null, 2);
          break;
        case 'markdown':
          exportedContent = this.convertToMarkdown(session);
          break;
        case 'txt':
          exportedContent = this.convertToText(session);
          break;
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }

      const outputPath =
        options.output || `chat-${sessionId}.${options.format}`;
      await fs.writeFile(outputPath, exportedContent);

      logger.success(`Chat session exported: ${outputPath}`);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_CHAT_EXPORT_FAILED',
        'Failed to export chat session',
        { sessionId, options },
        true
      );
    }
  }

  /**
   * Import chat session
   */
  private async importChatSession(file: string, options: any): Promise<void> {
    try {
      logger.info(`Importing chat session: ${file}`);

      if (!(await fs.pathExists(file))) {
        throw new Error(`File not found: ${file}`);
      }

      let session: ChatSession;

      switch (options.format) {
        case 'json':
          session = await fs.readJson(file);
          break;
        case 'markdown':
          session = await this.parseMarkdown(file);
          break;
        default:
          throw new Error(`Unsupported import format: ${options.format}`);
      }

      // Generate new ID for imported session
      session.id = `imported-${Date.now()}`;
      session.created = new Date();
      session.updated = new Date();

      await this.saveChatSession(session);
      logger.success(`Chat session imported: ${session.id}`);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_CHAT_IMPORT_FAILED',
        'Failed to import chat session',
        { file, options },
        true
      );
    }
  }

  /**
   * Delete chat session
   */
  private async deleteChatSession(
    sessionId: string,
    options: any
  ): Promise<void> {
    try {
      const session = await this.loadChatSession(sessionId);
      if (!session) {
        throw new Error(`Chat session not found: ${sessionId}`);
      }

      if (!options.force) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Delete chat session ${sessionId}? (${session.history.length} messages)`,
            default: false,
          },
        ]);

        if (!confirm) {
          logger.info('Deletion cancelled');
          return;
        }
      }

      await this.deleteChatSessionFile(sessionId);
      this.activeSessions.delete(sessionId);

      logger.success(`Chat session deleted: ${sessionId}`);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_CHAT_DELETE_FAILED',
        'Failed to delete chat session',
        { sessionId, options },
        true
      );
    }
  }

  /**
   * Chat with specific file
   */
  private async chatWithFile(file: string, options: any): Promise<void> {
    try {
      if (!(await fs.pathExists(file))) {
        throw new Error(`File not found: ${file}`);
      }

      const fileContent = await fs.readFile(file, 'utf8');
      const fileName = path.basename(file);

      const actionPrompts = {
        explain: `Please explain this code from ${fileName}:`,
        review: `Please review this code from ${fileName} for potential issues:`,
        improve: `Please suggest improvements for this code from ${fileName}:`,
      };

      const prompt =
        actionPrompts[options.action as keyof typeof actionPrompts] ||
        actionPrompts.explain;
      const message = `${prompt}\n\n\`\`\`\n${fileContent}\n\`\`\``;

      await this.askSingleQuestion(message, { model: options.model });
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_CHAT_FILE_FAILED',
        'Failed to chat with file',
        { file, options },
        true
      );
    }
  }

  /**
   * Chat with code
   */
  private async chatWithCode(options: any): Promise<void> {
    try {
      let code: string;

      if (options.clipboard) {
        // Read from clipboard (would need clipboard library)
        code = 'Code from clipboard'; // Placeholder
      } else {
        const { codeInput } = await inquirer.prompt([
          {
            type: 'editor',
            name: 'codeInput',
            message: 'Enter your code:',
          },
        ]);
        code = codeInput;
      }

      const actionPrompts = {
        explain: 'Please explain this code:',
        review: 'Please review this code for potential issues:',
        improve: 'Please suggest improvements for this code:',
      };

      const prompt =
        actionPrompts[options.action as keyof typeof actionPrompts] ||
        actionPrompts.explain;
      const message = `${prompt}\n\n\`\`\`\n${code}\n\`\`\``;

      await this.askSingleQuestion(message, {});
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_CHAT_CODE_FAILED',
        'Failed to chat with code',
        { options },
        true
      );
    }
  }

  /**
   * Helper methods for chat operations
   */
  private async createNewSession(options: any): Promise<ChatSession> {
    const config = this.configManager.getConfig();

    return {
      id: options.sessionName || `session-${Date.now()}`,
      model: options.model || config.ai.model,
      context: options.context,
      history: [],
      created: new Date(),
      updated: new Date(),
    };
  }

  private async runChatLoop(session: ChatSession): Promise<void> {
    while (true) {
      try {
        const { message } = await inquirer.prompt([
          {
            type: 'input',
            name: 'message',
            message: chalk.green('You:'),
            validate: input => input.length > 0 || 'Message cannot be empty',
          },
        ]);

        if (message.toLowerCase() === 'exit') {
          break;
        }

        if (message.toLowerCase() === 'help') {
          this.showChatHelp();
          continue;
        }

        if (message.startsWith('/')) {
          await this.handleChatCommand(session, message);
          continue;
        }

        const response = await this.sendMessage(session, message);
        console.log(chalk.cyan(`\nAI: ${response}\n`));
      } catch (error) {
        logger.error('Chat error:', error);
        console.log(
          chalk.red('Sorry, there was an error processing your message.\n')
        );
      }
    }

    // Save session when exiting
    await this.saveChatSession(session);
    this.activeSessions.delete(session.id);
    logger.success('Chat session ended and saved');
  }

  private async sendMessage(
    session: ChatSession,
    message: string
  ): Promise<string> {
    // Add user message to history
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    session.history.push(userMessage);

    // Call AI service (mock implementation)
    const response = await this.callAI(session, message);

    // Add AI response to history
    const aiMessage: ChatMessage = {
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    };
    session.history.push(aiMessage);

    session.updated = new Date();

    return response;
  }

  private async callAI(session: ChatSession, message: string): Promise<string> {
    // Mock AI service call
    // In a real implementation, this would call Claude, GPT, etc.
    return `This is a mock response to: "${message}". The AI would provide a helpful response here based on the context and conversation history.`;
  }

  private showChatHelp(): void {
    console.log(chalk.blue('\nChat Commands:'));
    console.log('  exit          - End the chat session');
    console.log('  help          - Show this help message');
    console.log('  /clear        - Clear chat history');
    console.log('  /save         - Save chat session');
    console.log('  /export       - Export chat session');
    console.log('  /context      - Show current context');
    console.log('  /model        - Change AI model');
    console.log();
  }

  private async handleChatCommand(
    session: ChatSession,
    command: string
  ): Promise<void> {
    const [cmd, ...args] = command.slice(1).split(' ');

    switch (cmd) {
      case 'clear':
        session.history = [];
        console.log(chalk.green('Chat history cleared\n'));
        break;

      case 'save':
        await this.saveChatSession(session);
        console.log(chalk.green(`Session saved: ${session.id}\n`));
        break;

      case 'export':
        const format = args[0] || 'markdown';
        await this.exportChatSession(session.id, {
          format,
          output: `${session.id}.${format}`,
        });
        break;

      case 'context':
        console.log(chalk.blue('Current Context:'));
        console.log(`  Model: ${session.model}`);
        console.log(`  Messages: ${session.history.length}`);
        console.log(`  Context: ${session.context || 'None'}\n`);
        break;

      case 'model':
        if (args[0]) {
          session.model = args[0];
          console.log(chalk.green(`Model changed to: ${args[0]}\n`));
        } else {
          console.log(chalk.yellow('Current model: ' + session.model + '\n'));
        }
        break;

      default:
        console.log(chalk.red(`Unknown command: /${cmd}\n`));
    }
  }

  private async saveChatSession(session: ChatSession): Promise<void> {
    const sessionPath = path.join(
      process.cwd(),
      '.wundr',
      'chat',
      `${session.id}.json`
    );
    await fs.ensureDir(path.dirname(sessionPath));
    await fs.writeJson(sessionPath, session, { spaces: 2 });
  }

  private async loadChatSession(
    sessionId: string
  ): Promise<ChatSession | null> {
    const sessionPath = path.join(
      process.cwd(),
      '.wundr',
      'chat',
      `${sessionId}.json`
    );
    if (await fs.pathExists(sessionPath)) {
      const data = await fs.readJson(sessionPath);
      data.created = new Date(data.created);
      data.updated = new Date(data.updated);
      data.history = data.history.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }));
      return data;
    }
    return null;
  }

  private async getAllChatSessions(): Promise<ChatSession[]> {
    const chatDir = path.join(process.cwd(), '.wundr', 'chat');
    if (!(await fs.pathExists(chatDir))) {
      return [];
    }

    const files = await fs.readdir(chatDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    const sessions: ChatSession[] = [];
    for (const file of jsonFiles) {
      try {
        const sessionId = path.basename(file, '.json');
        const session = await this.loadChatSession(sessionId);
        if (session) {
          sessions.push(session);
        }
      } catch (error) {
        logger.debug(`Failed to load session ${file}:`, error);
      }
    }

    return sessions;
  }

  private async deleteChatSessionFile(sessionId: string): Promise<void> {
    const sessionPath = path.join(
      process.cwd(),
      '.wundr',
      'chat',
      `${sessionId}.json`
    );
    if (await fs.pathExists(sessionPath)) {
      await fs.remove(sessionPath);
    }
  }

  private convertToMarkdown(session: ChatSession): string {
    let markdown = `# Chat Session: ${session.id}\n\n`;
    markdown += `**Model:** ${session.model}\n`;
    markdown += `**Created:** ${session.created.toLocaleString()}\n`;
    markdown += `**Updated:** ${session.updated.toLocaleString()}\n`;
    if (session.context) {
      markdown += `**Context:** ${session.context}\n`;
    }
    markdown += `**Messages:** ${session.history.length}\n\n`;
    markdown += '---\n\n';

    session.history.forEach(msg => {
      const role = msg.role === 'user' ? '**You**' : '**AI**';
      markdown += `${role} (${msg.timestamp.toLocaleTimeString()}):\n\n`;
      markdown += `${msg.content}\n\n`;
      markdown += '---\n\n';
    });

    return markdown;
  }

  private convertToText(session: ChatSession): string {
    let text = `Chat Session: ${session.id}\n`;
    text += `Model: ${session.model}\n`;
    text += `Created: ${session.created.toLocaleString()}\n`;
    text += `Updated: ${session.updated.toLocaleString()}\n`;
    text += `Messages: ${session.history.length}\n\n`;
    text += '='.repeat(50) + '\n\n';

    session.history.forEach(msg => {
      const role = msg.role === 'user' ? 'You' : 'AI';
      text += `[${msg.timestamp.toLocaleTimeString()}] ${role}:\n`;
      text += `${msg.content}\n\n`;
      text += '-'.repeat(30) + '\n\n';
    });

    return text;
  }

  private async parseMarkdown(file: string): Promise<ChatSession> {
    // Implementation to parse markdown format back to session
    const content = await fs.readFile(file, 'utf8');

    // This is a simplified parser - a real implementation would be more robust
    return {
      id: `parsed-${Date.now()}`,
      model: 'claude-3',
      history: [],
      created: new Date(),
      updated: new Date(),
    };
  }

  // Configuration methods
  private async setChatConfig(key: string, value: string): Promise<void> {
    this.configManager.set(`chat.${key}`, value);
    await this.configManager.saveConfig();
    logger.success(`Chat configuration updated: ${key} = ${value}`);
  }

  private async getChatConfig(key?: string): Promise<void> {
    if (key) {
      const value = this.configManager.get(`chat.${key}`);
      console.log(`${key}: ${value}`);
    } else {
      const chatConfig = this.configManager.get('chat') || {};
      console.log(JSON.stringify(chatConfig, null, 2));
    }
  }

  // Template methods
  private async listChatTemplates(): Promise<void> {
    const templates = [
      'code-review',
      'explain-code',
      'debug-help',
      'architecture-review',
      'performance-optimization',
    ];

    console.log('Available chat templates:');
    templates.forEach(template => {
      console.log(`  - ${template}`);
    });
  }

  private async useChatTemplate(name: string, options: any): Promise<void> {
    const templates: Record<string, string> = {
      'code-review':
        'Please review the following code for best practices, potential bugs, and improvements:',
      'explain-code': 'Please explain what this code does and how it works:',
      'debug-help':
        "I'm having trouble with this code. Can you help me debug it?",
      'architecture-review':
        'Please review this architectural design and suggest improvements:',
      'performance-optimization':
        'Please suggest performance optimizations for this code:',
    };

    const template = templates[name];
    if (!template) {
      throw new Error(`Template not found: ${name}`);
    }

    // Process template variables if provided
    let processedTemplate = template;
    if (options.vars) {
      const variables = JSON.parse(options.vars);
      Object.entries(variables).forEach(([key, value]) => {
        processedTemplate = processedTemplate.replace(
          `{{${key}}}`,
          String(value)
        );
      });
    }

    await this.askSingleQuestion(processedTemplate, {});
  }
}
