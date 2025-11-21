import axios from 'axios';

import { logger } from '../utils/logger';

import type { WundrError } from '../types';

/**
 * Claude API client configuration
 */
export interface ClaudeConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  baseUrl?: string;
}

/**
 * Claude API message structure
 */
export interface ClaudeMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Claude API response structure
 */
export interface ClaudeResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: ClaudeMessage;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Claude API streaming response
 */
export interface ClaudeStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason?: string;
  }[];
}

/**
 * Claude API client for Claude-Opus-4.1 integration
 */
export class ClaudeClient {
  private client: any;
  private config: ClaudeConfig;

  constructor(config: ClaudeConfig) {
    this.config = {
      baseUrl: 'https://api.anthropic.com',
      ...config,
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      timeout: 30000,
    });

    // Add request/response interceptors for logging and error handling
    this.setupInterceptors();
  }

  /**
   * Send a single message to Claude
   */
  async sendMessage(
    message: string,
    systemPrompt?: string,
    options?: Partial<ClaudeConfig>,
  ): Promise<string> {
    try {
      const messages: ClaudeMessage[] = [];

      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }

      messages.push({ role: 'user', content: message });

      const response = await this.client.post('/v1/messages', {
        model: options?.model || this.config.model,
        max_tokens: options?.maxTokens || this.config.maxTokens,
        temperature: options?.temperature ?? this.config.temperature,
        messages,
      });

      return this.extractContent(response.data);
    } catch (error) {
      throw this.handleError(error, 'Failed to send message to Claude');
    }
  }

  /**
   * Send conversation history to Claude
   */
  async sendConversation(
    messages: ClaudeMessage[],
    systemPrompt?: string,
    options?: Partial<ClaudeConfig>,
  ): Promise<string> {
    try {
      const conversationMessages = [...messages];

      if (systemPrompt) {
        conversationMessages.unshift({ role: 'system', content: systemPrompt });
      }

      const response = await this.client.post('/v1/messages', {
        model: options?.model || this.config.model,
        max_tokens: options?.maxTokens || this.config.maxTokens,
        temperature: options?.temperature ?? this.config.temperature,
        messages: conversationMessages,
      });

      return this.extractContent(response.data);
    } catch (error) {
      throw this.handleError(error, 'Failed to send conversation to Claude');
    }
  }

  /**
   * Stream a conversation with Claude
   */
  async *streamConversation(
    messages: ClaudeMessage[],
    systemPrompt?: string,
    options?: Partial<ClaudeConfig>,
  ): AsyncGenerator<string, void, unknown> {
    try {
      const conversationMessages = [...messages];

      if (systemPrompt) {
        conversationMessages.unshift({ role: 'system', content: systemPrompt });
      }

      const response = await this.client.post(
        '/v1/messages',
        {
          model: options?.model || this.config.model,
          max_tokens: options?.maxTokens || this.config.maxTokens,
          temperature: options?.temperature ?? this.config.temperature,
          messages: conversationMessages,
          stream: true,
        },
        {
          responseType: 'stream',
        },
      );

      let buffer = '';

      for await (const chunk of response.data) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
return;
}

            try {
              const parsed: ClaudeStreamChunk = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch (e) {
              // Skip malformed chunks
            }
          }
        }
      }
    } catch (error) {
      throw this.handleError(
        error,
        'Failed to stream conversation with Claude',
      );
    }
  }

  /**
   * Analyze intent from natural language input
   */
  async analyzeIntent(
    input: string,
    availableCommands: string[],
  ): Promise<{
    intent: string;
    confidence: number;
    command?: string;
    parameters?: Record<string, any>;
    clarification?: string;
  }> {
    const systemPrompt = `You are a CLI intent analyzer. Analyze user input and determine:
1. The intended CLI command from available options: ${availableCommands.join(', ')}
2. Extracted parameters
3. Confidence level (0-1)
4. Whether clarification is needed

Respond with JSON only in this format:
{
  "intent": "command_name",
  "confidence": 0.9,
  "command": "wundr analyze --path ./src",
  "parameters": {"path": "./src"},
  "clarification": "optional clarification question"
}`;

    try {
      const response = await this.sendMessage(input, systemPrompt, {
        temperature: 0.2,
        maxTokens: 1024,
      });

      return JSON.parse(response);
    } catch (error) {
      throw this.handleError(error, 'Failed to analyze intent');
    }
  }

  /**
   * Generate command suggestions based on context
   */
  async suggestCommands(
    projectContext: string,
    userGoal: string,
    availableCommands: string[],
  ): Promise<{
    suggestions: Array<{
      command: string;
      description: string;
      confidence: number;
    }>;
  }> {
    const systemPrompt = `You are a CLI assistant. Based on the project context and user goal, suggest the most appropriate CLI commands.

Project Context: ${projectContext}
User Goal: ${userGoal}
Available Commands: ${availableCommands.join(', ')}

Respond with JSON only:
{
  "suggestions": [
    {
      "command": "wundr analyze --focus dependencies",
      "description": "Analyze project dependencies",
      "confidence": 0.9
    }
  ]
}`;

    try {
      const response = await this.sendMessage('', systemPrompt, {
        temperature: 0.3,
        maxTokens: 1024,
      });

      return JSON.parse(response);
    } catch (error) {
      throw this.handleError(error, 'Failed to generate command suggestions');
    }
  }

  /**
   * Explain command results in natural language
   */
  async explainResults(
    command: string,
    output: string,
    context?: string,
  ): Promise<string> {
    const systemPrompt = `You are a helpful CLI assistant. Explain the results of a CLI command in clear, natural language. Focus on:
1. What the command did
2. Key findings or results
3. Next steps or recommendations
4. Any issues or warnings

Be concise but informative.`;

    const message = `Command: ${command}
${context ? `Context: ${context}\n` : ''}Output:
${output}`;

    try {
      return await this.sendMessage(message, systemPrompt, {
        temperature: 0.4,
        maxTokens: 2048,
      });
    } catch (error) {
      throw this.handleError(error, 'Failed to explain results');
    }
  }

  /**
   * Generate help content for commands
   */
  async generateHelp(
    command: string,
    userContext: string,
    difficulty: 'beginner' | 'intermediate' | 'advanced' = 'intermediate',
  ): Promise<string> {
    const systemPrompt = `You are a CLI documentation assistant. Generate helpful, contextual guidance for CLI commands. Adapt the explanation level to: ${difficulty}

Provide:
1. What the command does
2. When to use it
3. Common options and examples
4. Tips and best practices
5. Related commands

Keep it practical and actionable.`;

    const message = `Command: ${command}
User Context: ${userContext}`;

    try {
      return await this.sendMessage(message, systemPrompt, {
        temperature: 0.3,
        maxTokens: 2048,
      });
    } catch (error) {
      throw this.handleError(error, 'Failed to generate help content');
    }
  }

  /**
   * Validate and test the API connection
   */
  async validateConnection(): Promise<boolean> {
    try {
      await this.sendMessage(
        'Hello',
        'Respond with just "OK" if you can understand this message.',
        {
          maxTokens: 10,
        },
      );
      return true;
    } catch (error) {
      logger.error('Claude API connection validation failed:', error);
      return false;
    }
  }

  /**
   * Get model information
   */
  getModelInfo(): {
    model: string;
    maxTokens: number;
    temperature: number;
  } {
    return {
      model: this.config.model,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ClaudeConfig>): void {
    this.config = { ...this.config, ...updates };

    if (updates.apiKey) {
      this.client.defaults.headers['x-api-key'] = updates.apiKey;
    }
  }

  /**
   * Extract content from Claude API response
   */
  private extractContent(response: ClaudeResponse): string {
    if (!response.choices || response.choices.length === 0) {
      throw new Error('No choices in Claude API response');
    }

    return response.choices?.[0]?.message?.content || '';
  }

  /**
   * Setup request/response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config: any) => {
        logger.debug(
          `Claude API Request: ${config.method?.toUpperCase()} ${config.url}`,
        );
        return config;
      },
      (error: any) => {
        logger.error('Claude API Request Error:', error);
        return Promise.reject(error);
      },
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: any) => {
        logger.debug(
          `Claude API Response: ${response.status} ${response.statusText}`,
        );
        return response;
      },
      (error: any) => {
        logger.error('Claude API Response Error:', error);
        return Promise.reject(error);
      },
    );
  }

  /**
   * Handle API errors and convert to WundrError
   */
  private handleError(error: any, message: string): WundrError {
    logger.error(`Claude API Error: ${message}`, error);

    let errorCode = 'CLAUDE_API_ERROR';
    let errorMessage = message;
    let recoverable = false;

    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      switch (status) {
        case 401:
          errorCode = 'CLAUDE_AUTH_ERROR';
          errorMessage =
            'Invalid API key. Please check your Claude API configuration.';
          recoverable = true;
          break;
        case 429:
          errorCode = 'CLAUDE_RATE_LIMIT';
          errorMessage = 'Rate limit exceeded. Please try again in a moment.';
          recoverable = true;
          break;
        case 500:
          errorCode = 'CLAUDE_SERVER_ERROR';
          errorMessage = 'Claude API server error. Please try again later.';
          recoverable = true;
          break;
        default:
          errorMessage = `${message}: ${data?.error?.message || error.message}`;
      }
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      errorCode = 'CLAUDE_CONNECTION_ERROR';
      errorMessage =
        'Unable to connect to Claude API. Please check your internet connection.';
      recoverable = true;
    }

    const wundrError = new Error(errorMessage) as WundrError;
    wundrError.code = errorCode;
    wundrError.context = { originalError: error };
    wundrError.recoverable = recoverable;

    return wundrError;
  }
}
