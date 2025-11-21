import { ClaudeClient } from './claude-client';
import { logger } from '../utils/logger';

import type { ChatSession, ChatMessage } from '../types';
import type { ClaudeMessage } from './claude-client';
import type { ConfigManager } from '../utils/config-manager';


/**
 * AI service configuration
 */
export interface AIServiceConfig {
  provider: 'claude' | 'openai' | 'local';
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

/**
 * AI conversation context
 */
export interface ConversationContext {
  projectPath?: string;
  projectType?: string;
  recentCommands?: string[];
  currentGoal?: string;
  userPreferences?: Record<string, any>;
  sessionMetadata?: Record<string, any>;
}

/**
 * AI service for managing all AI interactions
 */
export class AIService {
  private claudeClient?: ClaudeClient;
  private config: AIServiceConfig;
  private configManager: ConfigManager;
  private conversationHistory: Map<string, ClaudeMessage[]> = new Map();

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    this.config = this.loadAIConfig();
    this.initializeProvider();
  }

  /**
   * Initialize AI provider based on configuration
   */
  private initializeProvider(): void {
    try {
      if (this.config.provider === 'claude') {
        if (!this.config.apiKey) {
          logger.warn(
            'Claude API key not configured. AI features will be limited.',
          );
          logger.info('Configure your API key using: wundr ai setup');
          logger.info('Or set the CLAUDE_API_KEY environment variable');
          return; // Don't throw error, just warn
        }

        this.claudeClient = new ClaudeClient({
          apiKey: this.config.apiKey,
          model: this.config.model || 'claude-3-opus-20240229',
          maxTokens: this.config.maxTokens || 4096,
          temperature: this.config.temperature || 0.7,
          baseUrl: this.config.baseUrl,
        });

        logger.info(
          `Initialized Claude client with model: ${this.config.model}`,
        );
      } else {
        throw new Error(`Unsupported AI provider: ${this.config.provider}`);
      }
    } catch (error) {
      logger.error('Failed to initialize AI provider:', error);
      // Don't re-throw to avoid breaking CLI startup
    }
  }

  /**
   * Load AI configuration from config manager
   */
  private loadAIConfig(): AIServiceConfig {
    try {
      const wundrConfig = this.configManager.getConfig();
      const apiKey = this.configManager.getAIApiKey();

      return {
        provider: (wundrConfig.ai?.provider || 'claude') as 'claude',
        model: wundrConfig.ai?.model || 'claude-3-opus-20240229',
        apiKey: apiKey,
        maxTokens: 4096,
        temperature: 0.7,
        systemPrompt:
          'You are a helpful CLI assistant for the Wundr development platform.',
      };
    } catch (error) {
      logger.warn('Failed to load AI configuration, using defaults');
      return {
        provider: 'claude',
        model: 'claude-3-opus-20240229',
        apiKey: process.env['CLAUDE_API_KEY'],
        maxTokens: 4096,
        temperature: 0.7,
        systemPrompt:
          'You are a helpful CLI assistant for the Wundr development platform.',
      };
    }
  }

  /**
   * Send a message with conversation context
   */
  async sendMessage(
    sessionId: string,
    message: string,
    context?: ConversationContext,
  ): Promise<string> {
    this.ensureClientInitialized();

    try {
      const conversationMessages = this.getConversationHistory(sessionId);

      // Add user message to history
      conversationMessages.push({
        role: 'user',
        content: message,
      });

      const systemPrompt = this.buildSystemPrompt(context);
      const response = await this.claudeClient!.sendConversation(
        conversationMessages,
        systemPrompt,
      );

      // Add AI response to history
      conversationMessages.push({
        role: 'assistant',
        content: response,
      });

      // Store updated conversation history
      this.conversationHistory.set(sessionId, conversationMessages);

      return response;
    } catch (error) {
      logger.error('Failed to send message:', error);
      throw error;
    }
  }

  /**
   * Stream a conversation response
   */
  async *streamMessage(
    sessionId: string,
    message: string,
    context?: ConversationContext,
  ): AsyncGenerator<string, string, unknown> {
    this.ensureClientInitialized();

    try {
      const conversationMessages = this.getConversationHistory(sessionId);

      // Add user message to history
      conversationMessages.push({
        role: 'user',
        content: message,
      });

      const systemPrompt = this.buildSystemPrompt(context);
      let fullResponse = '';

      for await (const chunk of this.claudeClient!.streamConversation(
        conversationMessages,
        systemPrompt,
      )) {
        fullResponse += chunk;
        yield chunk;
      }

      // Add AI response to history
      conversationMessages.push({
        role: 'assistant',
        content: fullResponse,
      });

      // Store updated conversation history
      this.conversationHistory.set(sessionId, conversationMessages);

      return fullResponse;
    } catch (error) {
      logger.error('Failed to stream message:', error);
      throw error;
    }
  }

  /**
   * Analyze natural language input and convert to CLI command
   */
  async parseNaturalLanguageCommand(
    input: string,
    _context?: ConversationContext,
  ): Promise<{
    intent: string;
    command: string;
    confidence: number;
    parameters: Record<string, any>;
    needsConfirmation: boolean;
    clarificationQuestion?: string;
  }> {
    this.ensureClientInitialized();

    try {
      const availableCommands = [
        'wundr init',
        'wundr create',
        'wundr analyze',
        'wundr govern',
        'wundr dashboard',
        'wundr watch',
        'wundr batch',
        'wundr plugins',
      ];

      const result = await this.claudeClient!.analyzeIntent(
        input,
        availableCommands,
      );

      return {
        intent: result.intent,
        command: result.command || '',
        confidence: result.confidence,
        parameters: result.parameters || {},
        needsConfirmation: result.confidence < 0.8,
        clarificationQuestion: result.clarification,
      };
    } catch (error) {
      logger.error('Failed to parse natural language command:', error);
      throw error;
    }
  }

  /**
   * Generate contextual command suggestions
   */
  async suggestCommands(
    goal: string,
    context?: ConversationContext,
  ): Promise<
    Array<{
      command: string;
      description: string;
      confidence: number;
      rationale: string;
    }>
  > {
    this.ensureClientInitialized();

    try {
      const projectContext = this.buildProjectContext(context);
      const availableCommands = [
        'wundr init - Initialize project or configuration',
        'wundr create - Create new components, services, templates',
        'wundr analyze - Analyze code, dependencies, quality',
        'wundr govern - Apply governance rules and compliance',
        'wundr dashboard - Start dashboard and visualization',
        'wundr watch - Monitor files and run automated tasks',
        'wundr batch - Execute batch operations',
        'wundr plugins - Manage CLI plugins',
        'wundr chat - Interactive AI assistance',
      ];

      const result = await this.claudeClient!.suggestCommands(
        projectContext,
        goal,
        availableCommands,
      );

      return result.suggestions.map(suggestion => ({
        ...suggestion,
        rationale: `Based on your goal and project context, this command will help you ${suggestion.description.toLowerCase()}`,
      }));
    } catch (error) {
      logger.error('Failed to generate command suggestions:', error);
      throw error;
    }
  }

  /**
   * Explain command results in natural language
   */
  async explainCommandResults(
    command: string,
    output: string,
    context?: ConversationContext,
  ): Promise<string> {
    this.ensureClientInitialized();

    try {
      const contextString = context
        ? this.buildProjectContext(context)
        : undefined;
      return await this.claudeClient!.explainResults(
        command,
        output,
        contextString,
      );
    } catch (error) {
      logger.error('Failed to explain command results:', error);
      throw error;
    }
  }

  /**
   * Generate contextual help for commands
   */
  async generateContextualHelp(
    command: string,
    context?: ConversationContext,
    userLevel: 'beginner' | 'intermediate' | 'advanced' = 'intermediate',
  ): Promise<string> {
    this.ensureClientInitialized();

    try {
      const userContext = this.buildProjectContext(context);
      return await this.claudeClient!.generateHelp(
        command,
        userContext,
        userLevel,
      );
    } catch (error) {
      logger.error('Failed to generate contextual help:', error);
      throw error;
    }
  }

  /**
   * Convert ChatSession to conversation history
   */
  loadChatSession(session: ChatSession): void {
    const messages: ClaudeMessage[] = session.history.map(msg => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
    }));

    this.conversationHistory.set(session.id, messages);
  }

  /**
   * Export conversation history to ChatSession format
   */
  exportChatSession(sessionId: string): ChatMessage[] {
    const messages = this.conversationHistory.get(sessionId) || [];

    return messages.map(msg => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
      timestamp: new Date(),
      metadata: {},
    }));
  }

  /**
   * Clear conversation history for a session
   */
  clearConversation(sessionId: string): void {
    this.conversationHistory.delete(sessionId);
  }

  /**
   * Get conversation history for a session
   */
  private getConversationHistory(sessionId: string): ClaudeMessage[] {
    return this.conversationHistory.get(sessionId) || [];
  }

  /**
   * Build system prompt with context
   */
  private buildSystemPrompt(context?: ConversationContext): string {
    let systemPrompt =
      this.config.systemPrompt ||
      'You are a helpful CLI assistant for the Wundr development platform.';

    if (context) {
      systemPrompt += '\n\nContext Information:';

      if (context.projectPath) {
        systemPrompt += `\n- Project Path: ${context.projectPath}`;
      }

      if (context.projectType) {
        systemPrompt += `\n- Project Type: ${context.projectType}`;
      }

      if (context.recentCommands?.length) {
        systemPrompt += `\n- Recent Commands: ${context.recentCommands.join(', ')}`;
      }

      if (context.currentGoal) {
        systemPrompt += `\n- Current Goal: ${context.currentGoal}`;
      }
    }

    systemPrompt += `\n\nYou should:
1. Provide helpful, accurate responses
2. Suggest appropriate CLI commands when relevant
3. Explain technical concepts clearly
4. Ask for clarification when needed
5. Focus on practical, actionable advice`;

    return systemPrompt;
  }

  /**
   * Build project context string
   */
  private buildProjectContext(context?: ConversationContext): string {
    if (!context) {
      return 'No project context available';
    }

    const parts: string[] = [];

    if (context.projectPath) {
      parts.push(`Project: ${context.projectPath}`);
    }

    if (context.projectType) {
      parts.push(`Type: ${context.projectType}`);
    }

    if (context.recentCommands?.length) {
      parts.push(`Recent commands: ${context.recentCommands.join(', ')}`);
    }

    if (context.currentGoal) {
      parts.push(`Goal: ${context.currentGoal}`);
    }

    return parts.join(' | ') || 'Standard development project';
  }

  /**
   * Validate AI service connection
   */
  async validateConnection(): Promise<{
    connected: boolean;
    error?: string;
    provider: string;
    model: string;
  }> {
    if (!this.claudeClient) {
      return {
        connected: false,
        error: 'AI client not initialized. API key may be missing.',
        provider: this.config.provider,
        model: this.config.model,
      };
    }

    try {
      const isValid = await this.claudeClient.validateConnection();
      return {
        connected: isValid,
        provider: this.config.provider,
        model: this.config.model,
      };
    } catch (error: any) {
      logger.error('AI connection validation failed:', error);
      return {
        connected: false,
        error: error.message || 'Connection validation failed',
        provider: this.config.provider,
        model: this.config.model,
      };
    }
  }

  /**
   * Ensure client is initialized and throw helpful error if not
   */
  private ensureClientInitialized(): void {
    if (!this.claudeClient) {
      const configuredKey = this.configManager.getAIApiKey();

      if (!configuredKey) {
        throw new Error(
          'AI API key not configured.\n\nTo set up AI features:\n1. Run: wundr ai setup\n2. Or set environment variable: export CLAUDE_API_KEY=your_key_here\n3. Or add to config: wundr ai config set apiKey your_key_here',
        );
      }

      throw new Error(
        'AI client failed to initialize. Please check your configuration.',
      );
    }
  }

  /**
   * Setup AI configuration with API key
   */
  async setupAI(apiKey: string, provider: string = 'claude'): Promise<void> {
    try {
      // Save API key to config
      await this.configManager.setAIApiKey(apiKey, provider);

      // Update service configuration
      this.config = this.loadAIConfig();

      // Re-initialize provider
      this.initializeProvider();

      logger.success(`AI configured successfully with ${provider} provider`);
    } catch (error) {
      logger.error('Failed to setup AI configuration:', error);
      throw error;
    }
  }

  /**
   * Check if AI is ready to use
   */
  isReady(): boolean {
    return !!this.claudeClient && !!this.config.apiKey;
  }

  /**
   * Get configuration status
   */
  getStatus(): {
    configured: boolean;
    provider: string;
    model: string;
    hasApiKey: boolean;
    ready: boolean;
  } {
    const hasApiKey = !!this.config.apiKey;
    return {
      configured: this.configManager.isAIConfigured(),
      provider: this.config.provider,
      model: this.config.model,
      hasApiKey,
      ready: this.isReady(),
    };
  }

  /**
   * Update AI configuration
   */
  updateConfig(updates: Partial<AIServiceConfig>): void {
    this.config = { ...this.config, ...updates };

    if (this.config.provider === 'claude' && this.claudeClient) {
      this.claudeClient.updateConfig({
        apiKey: this.config.apiKey,
        model: this.config.model,
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature,
      });
    }
  }

  /**
   * Get current AI configuration
   */
  getConfig(): AIServiceConfig {
    return { ...this.config };
  }

  /**
   * Get provider-specific information
   */
  getProviderInfo(): {
    provider: string;
    model: string;
    connected: boolean;
    capabilities: string[];
  } {
    return {
      provider: this.config.provider,
      model: this.config.model,
      connected: !!this.claudeClient,
      capabilities: [
        'natural-language-parsing',
        'command-suggestions',
        'result-explanation',
        'contextual-help',
        'conversation-memory',
      ],
    };
  }
}
