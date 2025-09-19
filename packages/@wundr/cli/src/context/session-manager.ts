import { EventEmitter } from 'events';
import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger';
import { ConversationManager } from '../ai/conversation-manager';
import { CommandMapper } from '../nlp/command-mapper';

/**
 * User preferences for personalized experience
 */
export interface UserPreferences {
  defaultModel: string;
  preferredOutputFormat: 'json' | 'table' | 'csv';
  confirmDestructiveCommands: boolean;
  enableStreamingResponses: boolean;
  maxHistoryLength: number;
  autoSave: boolean;
  theme: 'light' | 'dark' | 'auto';
  verbosity: 'minimal' | 'normal' | 'verbose';
  aliases: Record<string, string>;
  favorites: string[];
  workspacePreferences: Record<string, any>;
}

/**
 * Project context information
 */
export interface ProjectContext {
  rootPath: string;
  projectType:
    | 'nodejs'
    | 'react'
    | 'vue'
    | 'angular'
    | 'python'
    | 'java'
    | 'unknown';
  packageManager:
    | 'npm'
    | 'yarn'
    | 'pnpm'
    | 'pip'
    | 'maven'
    | 'gradle'
    | 'unknown';
  gitRepository?: {
    remote: string;
    branch: string;
    status: string;
    hasUncommittedChanges: boolean;
  };
  dependencies: string[];
  devDependencies: string[];
  scripts: Record<string, string>;
  lastAnalysis?: {
    timestamp: Date;
    summary: Record<string, any>;
  };
}

/**
 * Session state for maintaining context
 */
export interface SessionState {
  id: string;
  userId: string;
  currentWorkspace: string;
  activeConversation?: string;
  recentCommands: Array<{
    command: string;
    timestamp: Date;
    success: boolean;
    duration: number;
  }>;
  contextStack: Array<{
    type: 'project' | 'command' | 'conversation';
    context: any;
    timestamp: Date;
  }>;
  userPreferences: UserPreferences;
  projectContext?: ProjectContext;
  temporaryData: Record<string, any>;
  created: Date;
  lastAccessed: Date;
}

/**
 * Workspace configuration
 */
export interface WorkspaceConfig {
  name: string;
  path: string;
  type: string;
  settings: Record<string, any>;
  lastAccessed: Date;
  bookmarked: boolean;
}

/**
 * Session manager configuration
 */
export interface SessionManagerConfig {
  persistencePath: string;
  sessionTimeout: number; // minutes
  maxSessions: number;
  autoDetectProjects: boolean;
  enableContextLearning: boolean;
  backupInterval: number; // minutes
}

/**
 * Session manager for persistent context, user preferences, and workspace management
 */
export class SessionManager extends EventEmitter {
  private config: SessionManagerConfig;
  private conversationManager: ConversationManager;
  private commandMapper: CommandMapper;
  private activeSessions: Map<string, SessionState>;
  private workspaces: Map<string, WorkspaceConfig>;
  private currentSessionId?: string;
  private backupTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    conversationManager: ConversationManager,
    commandMapper: CommandMapper,
    config: Partial<SessionManagerConfig> = {}
  ) {
    super();

    this.conversationManager = conversationManager;
    this.commandMapper = commandMapper;
    this.config = {
      persistencePath: path.join(process.cwd(), '.wundr', 'sessions'),
      sessionTimeout: 24 * 60, // 24 hours
      maxSessions: 10,
      autoDetectProjects: true,
      enableContextLearning: true,
      backupInterval: 15, // 15 minutes
      ...config,
    };

    this.activeSessions = new Map();
    this.workspaces = new Map();

    this.initialize();
  }

  /**
   * Create or resume a session
   */
  async createSession(
    userId: string,
    workspacePath?: string,
    sessionId?: string
  ): Promise<string> {
    const id =
      sessionId ||
      `session_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check if session already exists
    if (this.activeSessions.has(id)) {
      await this.resumeSession(id);
      return id;
    }

    const workspace = workspacePath || process.cwd();
    const projectContext = await this.detectProjectContext(workspace);

    const session: SessionState = {
      id,
      userId,
      currentWorkspace: workspace,
      recentCommands: [],
      contextStack: [],
      userPreferences: await this.loadUserPreferences(userId),
      projectContext,
      temporaryData: {},
      created: new Date(),
      lastAccessed: new Date(),
    };

    // Load workspace if it exists
    const workspaceConfig = await this.loadWorkspace(workspace);
    if (workspaceConfig) {
      workspaceConfig.lastAccessed = new Date();
      this.workspaces.set(workspace, workspaceConfig);
    }

    this.activeSessions.set(id, session);
    this.currentSessionId = id;

    await this.persistSession(session);

    this.emit('session_created', { sessionId: id, userId, workspace });
    logger.debug(`Created session: ${id} for user: ${userId}`);

    return id;
  }

  /**
   * Resume an existing session
   */
  async resumeSession(sessionId: string): Promise<SessionState> {
    let session = this.activeSessions.get(sessionId);

    if (!session) {
      // Try to load from persistence
      session = (await this.loadSession(sessionId)) || undefined;
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }
    }

    session.lastAccessed = new Date();
    this.currentSessionId = sessionId;
    this.activeSessions.set(sessionId, session);

    // Refresh project context
    if (session.projectContext) {
      session.projectContext = await this.detectProjectContext(
        session.currentWorkspace
      );
    }

    await this.persistSession(session);

    this.emit('session_resumed', { sessionId, session });
    logger.debug(`Resumed session: ${sessionId}`);

    return session;
  }

  /**
   * Get current session
   */
  getCurrentSession(): SessionState | null {
    if (!this.currentSessionId) return null;
    return this.activeSessions.get(this.currentSessionId) || null;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): SessionState | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Update session context
   */
  async updateSessionContext(
    sessionId: string,
    contextType: 'project' | 'command' | 'conversation',
    contextData: any
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Add to context stack
    session.contextStack.push({
      type: contextType,
      context: contextData,
      timestamp: new Date(),
    });

    // Limit context stack size
    if (session.contextStack.length > 50) {
      session.contextStack = session.contextStack.slice(-25);
    }

    // Update specific context based on type
    switch (contextType) {
      case 'project':
        session.projectContext = { ...session.projectContext, ...contextData };
        break;
      case 'conversation':
        session.activeConversation = contextData.conversationId;
        break;
    }

    session.lastAccessed = new Date();
    await this.persistSession(session);

    this.emit('context_updated', { sessionId, contextType, contextData });
  }

  /**
   * Add command to session history
   */
  async addCommandToHistory(
    sessionId: string,
    command: string,
    success: boolean,
    duration: number
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.recentCommands.push({
      command,
      timestamp: new Date(),
      success,
      duration,
    });

    // Limit history size
    const maxHistory = session.userPreferences.maxHistoryLength || 100;
    if (session.recentCommands.length > maxHistory) {
      session.recentCommands = session.recentCommands.slice(-maxHistory / 2);
    }

    session.lastAccessed = new Date();
    await this.persistSession(session);

    // Learn from command patterns if enabled
    if (this.config.enableContextLearning) {
      await this.analyzeCommandPatterns(session);
    }

    this.emit('command_recorded', { sessionId, command, success, duration });
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(
    userId: string,
    preferences: Partial<UserPreferences>
  ): Promise<void> {
    const defaultPreferences = this.getDefaultPreferences();
    const currentPreferences = await this.loadUserPreferences(userId);
    const updatedPreferences = { ...currentPreferences, ...preferences };

    await this.saveUserPreferences(userId, updatedPreferences);

    // Update all active sessions for this user
    for (const [sessionId, session] of this.activeSessions) {
      if (session.userId === userId) {
        session.userPreferences = updatedPreferences;
        await this.persistSession(session);
      }
    }

    this.emit('preferences_updated', {
      userId,
      preferences: updatedPreferences,
    });
    logger.debug(`Updated preferences for user: ${userId}`);
  }

  /**
   * Register a workspace
   */
  async registerWorkspace(
    workspacePath: string,
    config: Partial<WorkspaceConfig>
  ): Promise<void> {
    const workspace: WorkspaceConfig = {
      name: config.name || path.basename(workspacePath),
      path: workspacePath,
      type: config.type || 'unknown',
      settings: config.settings || {},
      lastAccessed: new Date(),
      bookmarked: config.bookmarked || false,
    };

    this.workspaces.set(workspacePath, workspace);
    await this.saveWorkspace(workspace);

    this.emit('workspace_registered', { workspace });
    logger.debug(`Registered workspace: ${workspacePath}`);
  }

  /**
   * Get workspace suggestions based on recent activity
   */
  getWorkspaceSuggestions(limit: number = 5): WorkspaceConfig[] {
    const workspaces = Array.from(this.workspaces.values()).sort(
      (a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime()
    );

    return workspaces.slice(0, limit);
  }

  /**
   * Search session history
   */
  searchHistory(
    sessionId: string,
    query: {
      command?: string;
      timeRange?: { from: Date; to: Date };
      successOnly?: boolean;
      limit?: number;
    }
  ): Array<{
    command: string;
    timestamp: Date;
    success: boolean;
    duration: number;
  }> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return [];

    let history = session.recentCommands;

    if (query.command) {
      const searchTerm = query.command.toLowerCase();
      history = history.filter(cmd =>
        cmd.command.toLowerCase().includes(searchTerm)
      );
    }

    if (query.timeRange) {
      history = history.filter(
        cmd =>
          cmd.timestamp >= query.timeRange!.from &&
          cmd.timestamp <= query.timeRange!.to
      );
    }

    if (query.successOnly) {
      history = history.filter(cmd => cmd.success);
    }

    if (query.limit) {
      history = history.slice(-query.limit);
    }

    return history;
  }

  /**
   * Get contextual suggestions based on current session
   */
  async getContextualSuggestions(
    sessionId: string,
    limit: number = 5
  ): Promise<
    Array<{
      type: 'command' | 'workspace' | 'conversation';
      suggestion: string;
      description: string;
      confidence: number;
    }>
  > {
    const session = this.activeSessions.get(sessionId);
    if (!session) return [];

    const suggestions: Array<{
      type: 'command' | 'workspace' | 'conversation';
      suggestion: string;
      description: string;
      confidence: number;
    }> = [];

    // Command suggestions based on recent history
    const recentCommands = session.recentCommands
      .filter(cmd => cmd.success)
      .slice(-10);

    const commandFrequency = new Map<string, number>();
    for (const cmd of recentCommands) {
      const baseCommand = cmd.command.split(' ')[0];
      if (baseCommand) {
        commandFrequency.set(
          baseCommand,
          (commandFrequency.get(baseCommand) || 0) + 1
        );
      }
    }

    for (const [command, frequency] of commandFrequency) {
      suggestions.push({
        type: 'command',
        suggestion: command,
        description: `Recently used command (${frequency} times)`,
        confidence: Math.min(0.9, frequency * 0.2),
      });
    }

    // Workspace suggestions
    const workspaceSuggestions = this.getWorkspaceSuggestions(3);
    for (const workspace of workspaceSuggestions) {
      if (workspace.path !== session.currentWorkspace) {
        suggestions.push({
          type: 'workspace',
          suggestion: workspace.path,
          description: `Switch to ${workspace.name}`,
          confidence: 0.6,
        });
      }
    }

    // Sort by confidence and limit
    suggestions.sort((a, b) => b.confidence - a.confidence);
    return suggestions.slice(0, limit);
  }

  /**
   * Export session data
   */
  async exportSession(
    sessionId: string,
    format: 'json' | 'csv'
  ): Promise<string> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    switch (format) {
      case 'json':
        return JSON.stringify(session, null, 2);
      case 'csv':
        return this.sessionToCsv(session);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupSessions(): Promise<void> {
    const now = new Date();
    const timeoutMs = this.config.sessionTimeout * 60 * 1000;
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.activeSessions) {
      const timeSinceAccess = now.getTime() - session.lastAccessed.getTime();

      if (timeSinceAccess > timeoutMs) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      const session = this.activeSessions.get(sessionId)!;

      // Final persist before cleanup
      await this.persistSession(session);

      this.activeSessions.delete(sessionId);
      this.emit('session_expired', { sessionId });
    }

    // Limit active sessions
    if (this.activeSessions.size > this.config.maxSessions) {
      const sessionsByAccess = Array.from(this.activeSessions.entries()).sort(
        ([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime()
      );

      const excessCount = this.activeSessions.size - this.config.maxSessions;
      const toRemove = sessionsByAccess.slice(0, excessCount);

      for (const [sessionId, session] of toRemove) {
        await this.persistSession(session);
        this.activeSessions.delete(sessionId);
        this.emit('session_archived', { sessionId });
      }
    }

    if (expiredSessions.length > 0) {
      logger.debug(`Cleaned up ${expiredSessions.length} expired sessions`);
    }
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    activeSessions: number;
    totalCommands: number;
    averageSessionDuration: number;
    mostUsedCommands: Array<{ command: string; count: number }>;
    workspaceCount: number;
  } {
    const activeSessions = this.activeSessions.size;
    const totalCommands = Array.from(this.activeSessions.values()).reduce(
      (sum, session) => sum + session.recentCommands.length,
      0
    );

    const sessionDurations = Array.from(this.activeSessions.values()).map(
      session => session.lastAccessed.getTime() - session.created.getTime()
    );
    const averageSessionDuration =
      sessionDurations.length > 0
        ? sessionDurations.reduce((sum, duration) => sum + duration, 0) /
          sessionDurations.length
        : 0;

    // Command frequency analysis
    const commandCounts = new Map<string, number>();
    for (const session of this.activeSessions.values()) {
      for (const cmd of session.recentCommands) {
        const baseCommand = cmd.command.split(' ')[0];
        if (baseCommand) {
          commandCounts.set(
            baseCommand,
            (commandCounts.get(baseCommand) || 0) + 1
          );
        }
      }
    }

    const mostUsedCommands = Array.from(commandCounts.entries())
      .map(([command, count]) => ({ command, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      activeSessions,
      totalCommands,
      averageSessionDuration,
      mostUsedCommands,
      workspaceCount: this.workspaces.size,
    };
  }

  // Private methods

  private async initialize(): Promise<void> {
    // Ensure directories exist
    await fs.ensureDir(this.config.persistencePath);
    await fs.ensureDir(path.join(this.config.persistencePath, 'users'));
    await fs.ensureDir(path.join(this.config.persistencePath, 'workspaces'));

    // Load existing workspaces
    await this.loadAllWorkspaces();

    // Start background tasks
    this.startBackgroundTasks();

    logger.debug('Session manager initialized');
  }

  private startBackgroundTasks(): void {
    // Periodic backup
    this.backupTimer = setInterval(
      async () => {
        try {
          await this.backupActiveSessions();
        } catch (error) {
          logger.error('Session backup failed:', error);
        }
      },
      this.config.backupInterval * 60 * 1000
    );

    // Periodic cleanup
    this.cleanupTimer = setInterval(
      async () => {
        try {
          await this.cleanupSessions();
        } catch (error) {
          logger.error('Session cleanup failed:', error);
        }
      },
      30 * 60 * 1000
    ); // Every 30 minutes
  }

  private async detectProjectContext(
    workspacePath: string
  ): Promise<ProjectContext | undefined> {
    if (!this.config.autoDetectProjects) return undefined;

    try {
      const context: ProjectContext = {
        rootPath: workspacePath,
        projectType: 'unknown',
        packageManager: 'unknown',
        dependencies: [],
        devDependencies: [],
        scripts: {},
      };

      // Detect project type and package manager
      const packageJsonPath = path.join(workspacePath, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        const packageJson = await fs.readJson(packageJsonPath);
        context.dependencies = Object.keys(packageJson.dependencies || {});
        context.devDependencies = Object.keys(
          packageJson.devDependencies || {}
        );
        context.scripts = packageJson.scripts || {};

        // Detect project type from dependencies
        if (context.dependencies.includes('react')) {
          context.projectType = 'react';
        } else if (context.dependencies.includes('vue')) {
          context.projectType = 'vue';
        } else if (context.dependencies.includes('@angular/core')) {
          context.projectType = 'angular';
        } else {
          context.projectType = 'nodejs';
        }

        // Detect package manager
        if (await fs.pathExists(path.join(workspacePath, 'pnpm-lock.yaml'))) {
          context.packageManager = 'pnpm';
        } else if (await fs.pathExists(path.join(workspacePath, 'yarn.lock'))) {
          context.packageManager = 'yarn';
        } else if (
          await fs.pathExists(path.join(workspacePath, 'package-lock.json'))
        ) {
          context.packageManager = 'npm';
        }
      }

      // Detect other project types
      if (await fs.pathExists(path.join(workspacePath, 'requirements.txt'))) {
        context.projectType = 'python';
        context.packageManager = 'pip';
      } else if (await fs.pathExists(path.join(workspacePath, 'pom.xml'))) {
        context.projectType = 'java';
        context.packageManager = 'maven';
      } else if (
        await fs.pathExists(path.join(workspacePath, 'build.gradle'))
      ) {
        context.projectType = 'java';
        context.packageManager = 'gradle';
      }

      // Git information
      const gitPath = path.join(workspacePath, '.git');
      if (await fs.pathExists(gitPath)) {
        context.gitRepository = await this.getGitInfo(workspacePath);
      }

      return context;
    } catch (error) {
      logger.debug('Failed to detect project context:', error);
      return undefined;
    }
  }

  private async getGitInfo(
    workspacePath: string
  ): Promise<ProjectContext['gitRepository']> {
    // Simplified git info extraction
    return {
      remote: 'origin',
      branch: 'main',
      status: 'clean',
      hasUncommittedChanges: false,
    };
  }

  private getDefaultPreferences(): UserPreferences {
    return {
      defaultModel: 'claude-3-5-sonnet-20241022',
      preferredOutputFormat: 'table',
      confirmDestructiveCommands: true,
      enableStreamingResponses: true,
      maxHistoryLength: 100,
      autoSave: true,
      theme: 'auto',
      verbosity: 'normal',
      aliases: {},
      favorites: [],
      workspacePreferences: {},
    };
  }

  private async loadUserPreferences(userId: string): Promise<UserPreferences> {
    const prefsPath = path.join(
      this.config.persistencePath,
      'users',
      `${userId}.json`
    );

    if (await fs.pathExists(prefsPath)) {
      try {
        const saved = await fs.readJson(prefsPath);
        return { ...this.getDefaultPreferences(), ...saved };
      } catch (error) {
        logger.warn(`Failed to load preferences for ${userId}:`, error);
      }
    }

    return this.getDefaultPreferences();
  }

  private async saveUserPreferences(
    userId: string,
    preferences: UserPreferences
  ): Promise<void> {
    const prefsPath = path.join(
      this.config.persistencePath,
      'users',
      `${userId}.json`
    );
    await fs.ensureDir(path.dirname(prefsPath));
    await fs.writeJson(prefsPath, preferences, { spaces: 2 });
  }

  private async persistSession(session: SessionState): Promise<void> {
    const sessionPath = path.join(
      this.config.persistencePath,
      `${session.id}.json`
    );
    const serialized = this.serializeSession(session);
    await fs.writeJson(sessionPath, serialized, { spaces: 2 });
  }

  private async loadSession(sessionId: string): Promise<SessionState | null> {
    const sessionPath = path.join(
      this.config.persistencePath,
      `${sessionId}.json`
    );

    if (await fs.pathExists(sessionPath)) {
      try {
        const data = await fs.readJson(sessionPath);
        return this.deserializeSession(data);
      } catch (error) {
        logger.warn(`Failed to load session ${sessionId}:`, error);
      }
    }

    return null;
  }

  private serializeSession(session: SessionState): any {
    return {
      ...session,
      created: session.created.toISOString(),
      lastAccessed: session.lastAccessed.toISOString(),
      recentCommands: session.recentCommands.map(cmd => ({
        ...cmd,
        timestamp: cmd.timestamp.toISOString(),
      })),
      contextStack: session.contextStack.map(ctx => ({
        ...ctx,
        timestamp: ctx.timestamp.toISOString(),
      })),
      projectContext: session.projectContext
        ? {
            ...session.projectContext,
            lastAnalysis: session.projectContext.lastAnalysis
              ? {
                  ...session.projectContext.lastAnalysis,
                  timestamp:
                    session.projectContext.lastAnalysis.timestamp.toISOString(),
                }
              : undefined,
          }
        : undefined,
    };
  }

  private deserializeSession(data: any): SessionState {
    return {
      ...data,
      created: new Date(data.created),
      lastAccessed: new Date(data.lastAccessed),
      recentCommands: data.recentCommands.map((cmd: any) => ({
        ...cmd,
        timestamp: new Date(cmd.timestamp),
      })),
      contextStack: data.contextStack.map((ctx: any) => ({
        ...ctx,
        timestamp: new Date(ctx.timestamp),
      })),
      projectContext: data.projectContext
        ? {
            ...data.projectContext,
            lastAnalysis: data.projectContext.lastAnalysis
              ? {
                  ...data.projectContext.lastAnalysis,
                  timestamp: new Date(
                    data.projectContext.lastAnalysis.timestamp
                  ),
                }
              : undefined,
          }
        : undefined,
    };
  }

  private async loadWorkspace(
    workspacePath: string
  ): Promise<WorkspaceConfig | null> {
    const workspacesDir = path.join(this.config.persistencePath, 'workspaces');
    const workspaceFile = path.join(
      workspacesDir,
      `${Buffer.from(workspacePath).toString('base64')}.json`
    );

    if (await fs.pathExists(workspaceFile)) {
      try {
        const data = await fs.readJson(workspaceFile);
        data.lastAccessed = new Date(data.lastAccessed);
        return data;
      } catch (error) {
        logger.warn(`Failed to load workspace ${workspacePath}:`, error);
      }
    }

    return null;
  }

  private async saveWorkspace(workspace: WorkspaceConfig): Promise<void> {
    const workspacesDir = path.join(this.config.persistencePath, 'workspaces');
    const workspaceFile = path.join(
      workspacesDir,
      `${Buffer.from(workspace.path).toString('base64')}.json`
    );

    await fs.ensureDir(workspacesDir);
    await fs.writeJson(
      workspaceFile,
      {
        ...workspace,
        lastAccessed: workspace.lastAccessed.toISOString(),
      },
      { spaces: 2 }
    );
  }

  private async loadAllWorkspaces(): Promise<void> {
    const workspacesDir = path.join(this.config.persistencePath, 'workspaces');

    if (await fs.pathExists(workspacesDir)) {
      const files = await fs.readdir(workspacesDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const data = await fs.readJson(path.join(workspacesDir, file));
            data.lastAccessed = new Date(data.lastAccessed);
            this.workspaces.set(data.path, data);
          } catch (error) {
            logger.debug(`Failed to load workspace file ${file}:`, error);
          }
        }
      }
    }
  }

  private async backupActiveSessions(): Promise<void> {
    for (const session of this.activeSessions.values()) {
      await this.persistSession(session);
    }

    logger.debug(`Backed up ${this.activeSessions.size} active sessions`);
  }

  private async analyzeCommandPatterns(session: SessionState): Promise<void> {
    // Simple pattern analysis for learning user behavior
    const recentCommands = session.recentCommands.slice(-10);

    if (recentCommands.length >= 3) {
      // Look for command sequences
      const sequences: string[] = [];
      for (let i = 0; i < recentCommands.length - 1; i++) {
        const current = recentCommands[i];
        const next = recentCommands[i + 1];
        if (current?.command && next?.command) {
          sequences.push(`${current.command} -> ${next.command}`);
        }
      }

      // Store patterns in temporary data for future suggestions
      if (!session.temporaryData['commandPatterns']) {
        session.temporaryData['commandPatterns'] = [];
      }

      session.temporaryData['commandPatterns'].push(...sequences);

      // Keep only recent patterns
      session.temporaryData['commandPatterns'] =
        session.temporaryData['commandPatterns'].slice(-20);
    }
  }

  private sessionToCsv(session: SessionState): string {
    const headers = ['Timestamp', 'Command', 'Success', 'Duration'];
    const rows = [headers];

    session.recentCommands.forEach(cmd => {
      rows.push([
        cmd.timestamp.toISOString(),
        `"${cmd.command.replace(/"/g, '""')}"`,
        cmd.success.toString(),
        cmd.duration.toString(),
      ]);
    });

    return rows.map(row => row.join(',')).join('\n');
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.activeSessions.clear();
    this.workspaces.clear();
    this.removeAllListeners();
  }
}

export default SessionManager;
