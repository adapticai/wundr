import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger';
import { ConversationContext } from '../ai/ai-service';

/**
 * Project context information
 */
export interface ProjectContext {
  path: string;
  type: string;
  packageJson?: any;
  tsConfig?: any;
  gitInfo?: GitInfo;
  dependencies?: string[];
  devDependencies?: string[];
  scripts?: Record<string, string>;
  lastAnalysis?: AnalysisContext;
}

/**
 * Git repository information
 */
export interface GitInfo {
  branch: string;
  remote?: string;
  hasChanges: boolean;
  lastCommit?: string;
}

/**
 * Analysis context from previous runs
 */
export interface AnalysisContext {
  timestamp: Date;
  findings: number;
  quality: number;
  duplicates: number;
  dependencies: number;
  recommendations: string[];
}

/**
 * User session context
 */
export interface SessionContext {
  sessionId: string;
  startTime: Date;
  lastActivity: Date;
  commandHistory: CommandHistoryEntry[];
  currentGoal?: string;
  preferences: UserPreferences;
  projectContext?: ProjectContext;
}

/**
 * Command history entry
 */
export interface CommandHistoryEntry {
  command: string;
  timestamp: Date;
  success: boolean;
  duration: number;
  output?: string;
  error?: string;
}

/**
 * User preferences
 */
export interface UserPreferences {
  verbosity: 'minimal' | 'normal' | 'verbose';
  confirmCommands: boolean;
  autoSuggest: boolean;
  theme: 'light' | 'dark' | 'auto';
  language: string;
  modelPreference?: string;
}

/**
 * Context manager for maintaining conversation and project context
 */
export class ContextManager {
  private sessionsDir: string;
  private currentSession?: SessionContext;
  private projectContextCache: Map<string, ProjectContext> = new Map();

  constructor(baseDir: string = '.wundr') {
    this.sessionsDir = path.join(process.cwd(), baseDir, 'contexts');
    this.ensureDirectories();
  }

  /**
   * Initialize or resume a session
   */
  async initializeSession(sessionId?: string): Promise<SessionContext> {
    if (sessionId) {
      const existingSession = await this.loadSession(sessionId);
      if (existingSession) {
        this.currentSession = existingSession;
        this.currentSession.lastActivity = new Date();
        await this.saveSession(this.currentSession);
        return this.currentSession;
      }
    }

    // Create new session
    const newSessionId = sessionId || `session-${Date.now()}`;
    this.currentSession = {
      sessionId: newSessionId,
      startTime: new Date(),
      lastActivity: new Date(),
      commandHistory: [],
      preferences: this.getDefaultPreferences(),
      projectContext: await this.detectProjectContext(),
    };

    await this.saveSession(this.currentSession);
    logger.info(`Initialized session: ${newSessionId}`);

    return this.currentSession;
  }

  /**
   * Get current session context
   */
  getCurrentSession(): SessionContext | undefined {
    return this.currentSession;
  }

  /**
   * Add command to history
   */
  async addCommandToHistory(
    command: string,
    success: boolean,
    duration: number,
    output?: string,
    error?: string
  ): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    const entry: CommandHistoryEntry = {
      command,
      timestamp: new Date(),
      success,
      duration,
      output,
      error,
    };

    this.currentSession.commandHistory.push(entry);
    this.currentSession.lastActivity = new Date();

    // Keep only last 50 commands
    if (this.currentSession.commandHistory.length > 50) {
      this.currentSession.commandHistory =
        this.currentSession.commandHistory.slice(-50);
    }

    await this.saveSession(this.currentSession);
  }

  /**
   * Update user goal
   */
  async updateCurrentGoal(goal: string): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    this.currentSession.currentGoal = goal;
    this.currentSession.lastActivity = new Date();
    await this.saveSession(this.currentSession);
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    preferences: Partial<UserPreferences>
  ): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    this.currentSession.preferences = {
      ...this.currentSession.preferences,
      ...preferences,
    };

    this.currentSession.lastActivity = new Date();
    await this.saveSession(this.currentSession);
  }

  /**
   * Get conversation context for AI
   */
  getConversationContext(): ConversationContext {
    if (!this.currentSession) {
      return {};
    }

    const recentCommands = this.currentSession.commandHistory
      .slice(-5)
      .map(entry => entry.command);

    return {
      projectPath: this.currentSession.projectContext?.path,
      projectType: this.currentSession.projectContext?.type,
      recentCommands,
      currentGoal: this.currentSession.currentGoal,
      userPreferences: this.currentSession.preferences,
      sessionMetadata: {
        sessionId: this.currentSession.sessionId,
        duration: Date.now() - this.currentSession.startTime.getTime(),
        commandCount: this.currentSession.commandHistory.length,
      },
    };
  }

  /**
   * Detect project context
   */
  async detectProjectContext(
    projectPath?: string
  ): Promise<ProjectContext | undefined> {
    const targetPath = projectPath || process.cwd();

    // Check cache first
    if (this.projectContextCache.has(targetPath)) {
      return this.projectContextCache.get(targetPath);
    }

    try {
      const context: ProjectContext = {
        path: targetPath,
        type: 'unknown',
      };

      // Read package.json
      const packageJsonPath = path.join(targetPath, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        context.packageJson = await fs.readJson(packageJsonPath);
        context.dependencies = Object.keys(
          context.packageJson.dependencies || {}
        );
        context.devDependencies = Object.keys(
          context.packageJson.devDependencies || {}
        );
        context.scripts = context.packageJson.scripts || {};
        context.type = this.detectProjectType(context.packageJson);
      }

      // Read tsconfig.json
      const tsConfigPath = path.join(targetPath, 'tsconfig.json');
      if (await fs.pathExists(tsConfigPath)) {
        context.tsConfig = await fs.readJson(tsConfigPath);
      }

      // Get git info
      context.gitInfo = await this.getGitInfo(targetPath);

      // Cache the context
      this.projectContextCache.set(targetPath, context);

      return context;
    } catch (error) {
      logger.debug('Failed to detect project context:', error);
      return undefined;
    }
  }

  /**
   * Update analysis context
   */
  async updateAnalysisContext(
    findings: number,
    quality: number,
    duplicates: number,
    dependencies: number,
    recommendations: string[]
  ): Promise<void> {
    if (!this.currentSession?.projectContext) {
      return;
    }

    this.currentSession.projectContext.lastAnalysis = {
      timestamp: new Date(),
      findings,
      quality,
      duplicates,
      dependencies,
      recommendations,
    };

    await this.saveSession(this.currentSession);
  }

  /**
   * Get recent command patterns
   */
  getRecentCommandPatterns(): { command: string; frequency: number }[] {
    if (!this.currentSession) {
      return [];
    }

    const commandFreq: Record<string, number> = {};

    this.currentSession.commandHistory.forEach(entry => {
      const baseCommand = entry.command.split(' ').slice(0, 2).join(' ');
      commandFreq[baseCommand] = (commandFreq[baseCommand] || 0) + 1;
    });

    return Object.entries(commandFreq)
      .map(([command, frequency]) => ({ command, frequency }))
      .sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * End current session
   */
  async endSession(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    this.currentSession.lastActivity = new Date();
    await this.saveSession(this.currentSession);

    logger.info(`Session ended: ${this.currentSession.sessionId}`);
    this.currentSession = undefined;
  }

  /**
   * List all sessions
   */
  async listSessions(): Promise<
    { id: string; startTime: Date; lastActivity: Date; commandCount: number }[]
  > {
    try {
      const files = await fs.readdir(this.sessionsDir);
      const sessions: Array<{
        id: string;
        startTime: Date;
        lastActivity: Date;
        commandCount: number;
      }> = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const sessionData = await fs.readJson(
              path.join(this.sessionsDir, file)
            );
            sessions.push({
              id: sessionData.sessionId,
              startTime: new Date(sessionData.startTime),
              lastActivity: new Date(sessionData.lastActivity),
              commandCount: sessionData.commandHistory.length,
            });
          } catch (error) {
            logger.debug(`Failed to read session file ${file}:`, error);
          }
        }
      }

      return sessions.sort(
        (a, b) => b.lastActivity.getTime() - a.lastActivity.getTime()
      );
    } catch (error) {
      logger.debug('Failed to list sessions:', error);
      return [];
    }
  }

  /**
   * Load session from disk
   */
  private async loadSession(sessionId: string): Promise<SessionContext | null> {
    try {
      const sessionPath = path.join(this.sessionsDir, `${sessionId}.json`);

      if (await fs.pathExists(sessionPath)) {
        const data = await fs.readJson(sessionPath);

        // Convert date strings back to Date objects
        data.startTime = new Date(data.startTime);
        data.lastActivity = new Date(data.lastActivity);
        data.commandHistory = data.commandHistory.map((entry: any) => ({
          ...entry,
          timestamp: new Date(entry.timestamp),
        }));

        if (data.projectContext?.lastAnalysis) {
          data.projectContext.lastAnalysis.timestamp = new Date(
            data.projectContext.lastAnalysis.timestamp
          );
        }

        return data;
      }
    } catch (error) {
      logger.debug(`Failed to load session ${sessionId}:`, error);
    }

    return null;
  }

  /**
   * Save session to disk
   */
  private async saveSession(session: SessionContext): Promise<void> {
    try {
      const sessionPath = path.join(
        this.sessionsDir,
        `${session.sessionId}.json`
      );
      await fs.writeJson(sessionPath, session, { spaces: 2 });
    } catch (error) {
      logger.error(`Failed to save session ${session.sessionId}:`, error);
    }
  }

  /**
   * Ensure required directories exist
   */
  private async ensureDirectories(): Promise<void> {
    await fs.ensureDir(this.sessionsDir);
  }

  /**
   * Get default user preferences
   */
  private getDefaultPreferences(): UserPreferences {
    return {
      verbosity: 'normal',
      confirmCommands: false,
      autoSuggest: true,
      theme: 'auto',
      language: 'en',
    };
  }

  /**
   * Detect project type from package.json
   */
  private detectProjectType(packageJson: any): string {
    if (packageJson.dependencies?.react || packageJson.devDependencies?.react) {
      return 'react';
    }

    if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
      return 'next';
    }

    if (packageJson.dependencies?.vue || packageJson.devDependencies?.vue) {
      return 'vue';
    }

    if (
      packageJson.dependencies?.express ||
      packageJson.devDependencies?.express
    ) {
      return 'express';
    }

    if (
      packageJson.dependencies?.typescript ||
      packageJson.devDependencies?.typescript
    ) {
      return 'typescript';
    }

    if (packageJson.type === 'module' || packageJson.main?.endsWith('.mjs')) {
      return 'esm';
    }

    return 'node';
  }

  /**
   * Get git repository information
   */
  private async getGitInfo(projectPath: string): Promise<GitInfo | undefined> {
    try {
      const { execSync } = require('child_process');
      const cwd = projectPath;

      // Check if it's a git repository
      try {
        execSync('git rev-parse --git-dir', { cwd, stdio: 'ignore' });
      } catch {
        return undefined;
      }

      const branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd,
        encoding: 'utf8',
      }).trim();

      let remote: string | undefined;
      try {
        remote = execSync('git config --get remote.origin.url', {
          cwd,
          encoding: 'utf8',
        }).trim();
      } catch {
        // No remote configured
      }

      let hasChanges = false;
      try {
        const status = execSync('git status --porcelain', {
          cwd,
          encoding: 'utf8',
        });
        hasChanges = status.trim().length > 0;
      } catch {
        // Can't determine changes
      }

      let lastCommit: string | undefined;
      try {
        lastCommit = execSync('git log -1 --format="%h %s"', {
          cwd,
          encoding: 'utf8',
        }).trim();
      } catch {
        // No commits yet
      }

      return {
        branch,
        remote,
        hasChanges,
        lastCommit,
      };
    } catch (error) {
      logger.debug('Failed to get git info:', error);
      return undefined;
    }
  }
}
