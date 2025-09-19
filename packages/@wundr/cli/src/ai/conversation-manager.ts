import { EventEmitter } from 'events';
import fs from 'fs-extra';
import path from 'path';
import { ClaudeClient, ClaudeMessage } from './claude-client';
import { ChatSession, ChatMessage } from '../types';
import { logger } from '../utils/logger';

/**
 * Configuration for conversation management
 */
export interface ConversationConfig {
  maxHistoryLength: number;
  contextWindowSize: number;
  sessionTimeout: number; // minutes
  persistencePath: string;
  autoSave: boolean;
  compressionThreshold: number;
}

/**
 * Session metadata for enhanced tracking
 */
export interface SessionMetadata {
  tokenUsage: {
    total: number;
    prompt: number;
    completion: number;
  };
  performance: {
    averageResponseTime: number;
    totalRequests: number;
    errorCount: number;
  };
  context: {
    projectPath?: string;
    currentCommand?: string;
    userPreferences: Record<string, any>;
    workflow?: string[];
  };
}

/**
 * Enhanced chat session with metadata
 */
export interface EnhancedChatSession extends ChatSession {
  metadata: SessionMetadata;
  tags: string[];
  archived: boolean;
  lastAccessed: Date;
}

/**
 * Conversation manager handles session persistence, context optimization, and memory management
 */
export class ConversationManager extends EventEmitter {
  private activeSessions: Map<string, EnhancedChatSession>;
  private claudeClient: ClaudeClient;
  private config: ConversationConfig;
  private sessionCleanupTimer?: NodeJS.Timeout;

  constructor(
    claudeClient: ClaudeClient,
    config: Partial<ConversationConfig> = {}
  ) {
    super();

    this.claudeClient = claudeClient;
    this.config = {
      maxHistoryLength: 100,
      contextWindowSize: 20,
      sessionTimeout: 60, // 1 hour
      persistencePath: path.join(process.cwd(), '.wundr', 'conversations'),
      autoSave: true,
      compressionThreshold: 50,
      ...config,
    };

    this.activeSessions = new Map();

    this.initializeManager();
  }

  /**
   * Create a new conversation session
   */
  async createSession(
    options: {
      id?: string;
      model?: string;
      context?: string;
      tags?: string[];
      metadata?: Partial<SessionMetadata>;
    } = {}
  ): Promise<EnhancedChatSession> {
    const sessionId =
      options.id ||
      `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const session: EnhancedChatSession = {
      id: sessionId,
      model: options.model || this.claudeClient.getModelInfo().model,
      context: options.context,
      history: [],
      created: new Date(),
      updated: new Date(),
      archived: false,
      lastAccessed: new Date(),
      tags: options.tags || [],
      metadata: {
        tokenUsage: { total: 0, prompt: 0, completion: 0 },
        performance: {
          averageResponseTime: 0,
          totalRequests: 0,
          errorCount: 0,
        },
        context: {
          userPreferences: {},
          ...options.metadata?.context,
        },
        ...options.metadata,
      },
    };

    this.activeSessions.set(sessionId, session);

    if (this.config.autoSave) {
      await this.persistSession(session);
    }

    this.emit('session_created', { sessionId, session });
    logger.debug(`Created conversation session: ${sessionId}`);

    return session;
  }

  /**
   * Load an existing session
   */
  async loadSession(sessionId: string): Promise<EnhancedChatSession | null> {
    // Check active sessions first
    if (this.activeSessions.has(sessionId)) {
      const session = this.activeSessions.get(sessionId)!;
      session.lastAccessed = new Date();
      return session;
    }

    // Load from persistence
    try {
      const sessionPath = this.getSessionPath(sessionId);
      if (await fs.pathExists(sessionPath)) {
        const data = await fs.readJson(sessionPath);
        const session = this.deserializeSession(data);

        session.lastAccessed = new Date();
        this.activeSessions.set(sessionId, session);

        this.emit('session_loaded', { sessionId, session });
        logger.debug(`Loaded conversation session: ${sessionId}`);

        return session;
      }
    } catch (error) {
      logger.error(`Failed to load session ${sessionId}:`, error);
    }

    return null;
  }

  /**
   * Send a message in a conversation session
   */
  async sendMessage(
    sessionId: string,
    message: string,
    options: {
      systemPrompt?: string;
      streaming?: boolean;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<string | AsyncGenerator<string, void, unknown>> {
    const session = await this.loadSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const startTime = Date.now();

    try {
      // Add user message to history
      const userMessage: ChatMessage = {
        role: 'user',
        content: message,
        timestamp: new Date(),
        metadata: options.metadata,
      };

      session.history.push(userMessage);

      // Optimize conversation context
      const contextMessages = this.optimizeContext(session);

      // Convert to Claude message format
      const claudeMessages: ClaudeMessage[] = contextMessages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Send to Claude
      let response: string | AsyncGenerator<string, void, unknown>;

      if (options.streaming) {
        response = this.claudeClient.streamConversation(
          claudeMessages,
          options.systemPrompt
        );
      } else {
        response = await this.claudeClient.sendConversation(
          claudeMessages,
          options.systemPrompt
        );
      }

      // Handle streaming response
      if (options.streaming) {
        return this.handleStreamingResponse(
          session,
          response as AsyncGenerator<string, void, unknown>,
          startTime
        );
      } else {
        return await this.handleSyncResponse(
          session,
          response as string,
          startTime
        );
      }
    } catch (error) {
      session.metadata.performance.errorCount++;
      this.emit('message_error', { sessionId, error, message });
      throw error;
    }
  }

  /**
   * Get conversation history with optional filtering
   */
  getHistory(
    sessionId: string,
    options: {
      limit?: number;
      from?: Date;
      to?: Date;
      roles?: ('user' | 'assistant' | 'system')[];
    } = {}
  ): ChatMessage[] {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return [];
    }

    let history = [...session.history];

    // Apply filters
    if (options.from) {
      history = history.filter(msg => msg.timestamp >= options.from!);
    }

    if (options.to) {
      history = history.filter(msg => msg.timestamp <= options.to!);
    }

    if (options.roles) {
      history = history.filter(msg => options.roles!.includes(msg.role));
    }

    if (options.limit) {
      history = history.slice(-options.limit);
    }

    return history;
  }

  /**
   * Add context to a conversation session
   */
  async addContext(
    sessionId: string,
    contextType: 'project' | 'command' | 'preference' | 'workflow',
    contextData: any
  ): Promise<void> {
    const session = await this.loadSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    switch (contextType) {
      case 'project':
        session.metadata.context.projectPath = contextData.path;
        break;
      case 'command':
        session.metadata.context.currentCommand = contextData.command;
        break;
      case 'preference':
        Object.assign(session.metadata.context.userPreferences, contextData);
        break;
      case 'workflow':
        if (!session.metadata.context.workflow) {
          session.metadata.context.workflow = [];
        }
        session.metadata.context.workflow.push(...contextData);
        break;
    }

    session.updated = new Date();

    if (this.config.autoSave) {
      await this.persistSession(session);
    }

    this.emit('context_updated', { sessionId, contextType, contextData });
  }

  /**
   * Archive old or inactive sessions
   */
  async archiveSessions(
    criteria: {
      olderThan?: number; // days
      inactiveFor?: number; // days
      maxSessions?: number;
    } = {}
  ): Promise<string[]> {
    const archivedSessions: string[] = [];
    const now = new Date();

    for (const [sessionId, session] of this.activeSessions) {
      let shouldArchive = false;

      if (criteria.olderThan) {
        const ageInDays =
          (now.getTime() - session.created.getTime()) / (1000 * 60 * 60 * 24);
        if (ageInDays > criteria.olderThan) {
          shouldArchive = true;
        }
      }

      if (criteria.inactiveFor) {
        const inactiveInDays =
          (now.getTime() - session.lastAccessed.getTime()) /
          (1000 * 60 * 60 * 24);
        if (inactiveInDays > criteria.inactiveFor) {
          shouldArchive = true;
        }
      }

      if (shouldArchive) {
        session.archived = true;
        await this.persistSession(session);
        this.activeSessions.delete(sessionId);
        archivedSessions.push(sessionId);
      }
    }

    // Handle maxSessions limit
    if (
      criteria.maxSessions &&
      this.activeSessions.size > criteria.maxSessions
    ) {
      const sessionsByAccess = Array.from(this.activeSessions.entries()).sort(
        ([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime()
      );

      const excessCount = this.activeSessions.size - criteria.maxSessions;
      const toArchive = sessionsByAccess.slice(0, excessCount);

      for (const [sessionId, session] of toArchive) {
        session.archived = true;
        await this.persistSession(session);
        this.activeSessions.delete(sessionId);
        archivedSessions.push(sessionId);
      }
    }

    this.emit('sessions_archived', {
      count: archivedSessions.length,
      sessionIds: archivedSessions,
    });
    logger.debug(`Archived ${archivedSessions.length} sessions`);

    return archivedSessions;
  }

  /**
   * Search conversations by content or metadata
   */
  async searchConversations(query: {
    text?: string;
    tags?: string[];
    dateRange?: { from: Date; to: Date };
    model?: string;
    limit?: number;
  }): Promise<
    Array<{ sessionId: string; matches: ChatMessage[]; score: number }>
  > {
    const results: Array<{
      sessionId: string;
      matches: ChatMessage[];
      score: number;
    }> = [];

    // Search active sessions
    for (const [sessionId, session] of this.activeSessions) {
      const matches = this.searchSession(session, query);
      if (matches.length > 0) {
        results.push({
          sessionId,
          matches,
          score: this.calculateSearchScore(matches, query),
        });
      }
    }

    // Search persisted sessions if needed
    // This could be expensive, so implement pagination/indexing for production

    // Sort by score and apply limit
    results.sort((a, b) => b.score - a.score);

    if (query.limit) {
      results.splice(query.limit);
    }

    return results;
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId?: string): any {
    if (sessionId) {
      const session = this.activeSessions.get(sessionId);
      if (!session) return null;

      return {
        messageCount: session.history.length,
        tokenUsage: session.metadata.tokenUsage,
        performance: session.metadata.performance,
        created: session.created,
        lastAccessed: session.lastAccessed,
        tags: session.tags,
      };
    }

    // Global stats
    const totalSessions = this.activeSessions.size;
    const totalMessages = Array.from(this.activeSessions.values()).reduce(
      (sum, session) => sum + session.history.length,
      0
    );

    const totalTokens = Array.from(this.activeSessions.values()).reduce(
      (sum, session) => sum + session.metadata.tokenUsage.total,
      0
    );

    return {
      totalSessions,
      totalMessages,
      totalTokens,
      averageMessagesPerSession:
        totalSessions > 0 ? totalMessages / totalSessions : 0,
    };
  }

  /**
   * Clean up expired sessions
   */
  async cleanup(): Promise<void> {
    const expiredSessionIds: string[] = [];
    const now = new Date();
    const timeoutMs = this.config.sessionTimeout * 60 * 1000;

    for (const [sessionId, session] of this.activeSessions) {
      const timeSinceAccess = now.getTime() - session.lastAccessed.getTime();

      if (timeSinceAccess > timeoutMs) {
        expiredSessionIds.push(sessionId);
      }
    }

    for (const sessionId of expiredSessionIds) {
      const session = this.activeSessions.get(sessionId)!;

      // Persist before removing
      if (this.config.autoSave) {
        await this.persistSession(session);
      }

      this.activeSessions.delete(sessionId);
      this.emit('session_expired', { sessionId });
    }

    if (expiredSessionIds.length > 0) {
      logger.debug(`Cleaned up ${expiredSessionIds.length} expired sessions`);
    }
  }

  /**
   * Export conversation data
   */
  async exportSession(
    sessionId: string,
    format: 'json' | 'markdown' | 'csv'
  ): Promise<string> {
    const session = await this.loadSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    switch (format) {
      case 'json':
        return JSON.stringify(session, null, 2);
      case 'markdown':
        return this.sessionToMarkdown(session);
      case 'csv':
        return this.sessionToCsv(session);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Import conversation data
   */
  async importSession(data: string, format: 'json'): Promise<string> {
    if (format !== 'json') {
      throw new Error(`Unsupported import format: ${format}`);
    }

    const sessionData = JSON.parse(data);
    const session = this.deserializeSession(sessionData);

    // Generate new ID to avoid conflicts
    session.id = `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    session.created = new Date();
    session.lastAccessed = new Date();

    this.activeSessions.set(session.id, session);

    if (this.config.autoSave) {
      await this.persistSession(session);
    }

    this.emit('session_imported', { sessionId: session.id });
    return session.id;
  }

  /**
   * List all sessions with pagination
   */
  async listSessions(
    options: {
      limit?: number;
      offset?: number;
      includeArchived?: boolean;
      sortBy?: 'created' | 'updated' | 'lastAccessed';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{
    sessions: Array<
      Pick<
        EnhancedChatSession,
        'id' | 'created' | 'updated' | 'lastAccessed' | 'tags' | 'archived'
      >
    >;
    total: number;
    hasMore: boolean;
  }> {
    const allSessions = Array.from(this.activeSessions.values());

    // Filter archived if needed
    const filteredSessions = options.includeArchived
      ? allSessions
      : allSessions.filter(s => !s.archived);

    // Sort
    const sortBy = options.sortBy || 'lastAccessed';
    const sortOrder = options.sortOrder || 'desc';

    filteredSessions.sort((a, b) => {
      const aValue = a[sortBy].getTime();
      const bValue = b[sortBy].getTime();
      return sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
    });

    // Paginate
    const offset = options.offset || 0;
    const limit = options.limit || 50;
    const paginatedSessions = filteredSessions.slice(offset, offset + limit);

    return {
      sessions: paginatedSessions.map(s => ({
        id: s.id,
        created: s.created,
        updated: s.updated,
        lastAccessed: s.lastAccessed,
        tags: s.tags,
        archived: s.archived,
      })),
      total: filteredSessions.length,
      hasMore: offset + limit < filteredSessions.length,
    };
  }

  // Private helper methods

  private async initializeManager(): Promise<void> {
    // Ensure persistence directory exists
    await fs.ensureDir(this.config.persistencePath);

    // Start cleanup timer
    this.sessionCleanupTimer = setInterval(
      () => {
        this.cleanup().catch(error => {
          logger.error('Session cleanup failed:', error);
        });
      },
      10 * 60 * 1000
    ); // Every 10 minutes

    logger.debug('Conversation manager initialized');
  }

  private optimizeContext(session: EnhancedChatSession): ChatMessage[] {
    const { contextWindowSize, compressionThreshold } = this.config;

    if (session.history.length <= contextWindowSize) {
      return session.history;
    }

    // Keep system messages and recent messages
    const systemMessages = session.history.filter(msg => msg.role === 'system');
    const recentMessages = session.history.slice(
      -contextWindowSize + systemMessages.length
    );

    // If we still have too many messages, apply compression
    if (recentMessages.length > compressionThreshold) {
      return this.compressHistory([...systemMessages, ...recentMessages]);
    }

    return [...systemMessages, ...recentMessages];
  }

  private compressHistory(messages: ChatMessage[]): ChatMessage[] {
    // Simple compression: summarize older messages
    // In a production system, you might use Claude to generate summaries

    const recentCount = 10;
    const recent = messages.slice(-recentCount);
    const older = messages.slice(0, -recentCount);

    if (older.length === 0) return recent;

    const summary: ChatMessage = {
      role: 'system',
      content: `[Previous conversation summary: ${older.length} messages covering topics and discussions that led to the current context]`,
      timestamp: new Date(),
    };

    return [summary, ...recent];
  }

  private async handleSyncResponse(
    session: EnhancedChatSession,
    response: string,
    startTime: number
  ): Promise<string> {
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // Add AI response to history
    const aiMessage: ChatMessage = {
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    };

    session.history.push(aiMessage);
    session.updated = new Date();
    session.lastAccessed = new Date();

    // Update performance metrics
    this.updatePerformanceMetrics(session, responseTime);

    if (this.config.autoSave) {
      await this.persistSession(session);
    }

    this.emit('message_complete', {
      sessionId: session.id,
      responseTime,
      tokenCount: response.length, // Rough approximation
    });

    return response;
  }

  private async *handleStreamingResponse(
    session: EnhancedChatSession,
    responseGenerator: AsyncGenerator<string, void, unknown>,
    startTime: number
  ): AsyncGenerator<string, void, unknown> {
    let fullResponse = '';
    let firstChunk = true;

    for await (const chunk of responseGenerator) {
      if (firstChunk) {
        this.emit('stream_started', { sessionId: session.id });
        firstChunk = false;
      }

      fullResponse += chunk;
      yield chunk;
    }

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // Add complete response to history
    const aiMessage: ChatMessage = {
      role: 'assistant',
      content: fullResponse,
      timestamp: new Date(),
    };

    session.history.push(aiMessage);
    session.updated = new Date();
    session.lastAccessed = new Date();

    this.updatePerformanceMetrics(session, responseTime);

    if (this.config.autoSave) {
      await this.persistSession(session);
    }

    this.emit('stream_complete', {
      sessionId: session.id,
      responseTime,
      tokenCount: fullResponse.length,
    });
  }

  private updatePerformanceMetrics(
    session: EnhancedChatSession,
    responseTime: number
  ): void {
    const perf = session.metadata.performance;
    perf.totalRequests++;
    perf.averageResponseTime =
      (perf.averageResponseTime * (perf.totalRequests - 1) + responseTime) /
      perf.totalRequests;
  }

  private async persistSession(session: EnhancedChatSession): Promise<void> {
    const sessionPath = this.getSessionPath(session.id);
    const serialized = this.serializeSession(session);

    await fs.ensureDir(path.dirname(sessionPath));
    await fs.writeJson(sessionPath, serialized, { spaces: 2 });
  }

  private getSessionPath(sessionId: string): string {
    return path.join(this.config.persistencePath, `${sessionId}.json`);
  }

  private serializeSession(session: EnhancedChatSession): any {
    return {
      ...session,
      created: session.created.toISOString(),
      updated: session.updated.toISOString(),
      lastAccessed: session.lastAccessed.toISOString(),
      history: session.history.map(msg => ({
        ...msg,
        timestamp: msg.timestamp.toISOString(),
      })),
    };
  }

  private deserializeSession(data: any): EnhancedChatSession {
    return {
      ...data,
      created: new Date(data.created),
      updated: new Date(data.updated),
      lastAccessed: new Date(data.lastAccessed),
      history: data.history.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      })),
    };
  }

  private searchSession(
    session: EnhancedChatSession,
    query: any
  ): ChatMessage[] {
    let matches = session.history;

    if (query.text) {
      const searchText = query.text.toLowerCase();
      matches = matches.filter(msg =>
        msg.content.toLowerCase().includes(searchText)
      );
    }

    if (query.dateRange) {
      matches = matches.filter(
        msg =>
          msg.timestamp >= query.dateRange.from &&
          msg.timestamp <= query.dateRange.to
      );
    }

    if (query.tags && query.tags.length > 0) {
      const hasMatchingTag = query.tags.some((tag: string) =>
        session.tags.includes(tag)
      );
      if (!hasMatchingTag) {
        matches = [];
      }
    }

    if (query.model && session.model !== query.model) {
      matches = [];
    }

    return matches;
  }

  private calculateSearchScore(matches: ChatMessage[], query: any): number {
    let score = matches.length;

    if (query.text) {
      // Boost score based on exact matches
      const exactMatches = matches.filter(msg =>
        msg.content.toLowerCase().includes(query.text.toLowerCase())
      ).length;
      score += exactMatches * 2;
    }

    return score;
  }

  private sessionToMarkdown(session: EnhancedChatSession): string {
    let markdown = `# Conversation: ${session.id}\n\n`;
    markdown += `**Model:** ${session.model}\n`;
    markdown += `**Created:** ${session.created.toLocaleString()}\n`;
    markdown += `**Last Updated:** ${session.updated.toLocaleString()}\n`;
    markdown += `**Messages:** ${session.history.length}\n`;

    if (session.tags.length > 0) {
      markdown += `**Tags:** ${session.tags.join(', ')}\n`;
    }

    markdown += '\n---\n\n';

    session.history.forEach((msg, index) => {
      const role = msg.role === 'user' ? '🧑 **You**' : '🤖 **Assistant**';
      markdown += `## Message ${index + 1}\n\n`;
      markdown += `${role} - *${msg.timestamp.toLocaleString()}*\n\n`;
      markdown += `${msg.content}\n\n`;
      markdown += '---\n\n';
    });

    return markdown;
  }

  private sessionToCsv(session: EnhancedChatSession): string {
    const headers = ['Index', 'Role', 'Content', 'Timestamp'];
    const rows = [headers];

    session.history.forEach((msg, index) => {
      rows.push([
        (index + 1).toString(),
        msg.role,
        `"${msg.content.replace(/"/g, '""')}"`, // Escape quotes
        msg.timestamp.toISOString(),
      ]);
    });

    return rows.map(row => row.join(',')).join('\n');
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.sessionCleanupTimer) {
      clearInterval(this.sessionCleanupTimer);
    }

    this.activeSessions.clear();
    this.removeAllListeners();
  }
}

export default ConversationManager;
