/**
 * Claude Code/Flow Session Spawner for VP-Daemon
 *
 * Manages programmatic spawning, configuration, monitoring, and lifecycle
 * management of Claude Code sessions for Virtual Principal tasks.
 *
 * @module claude-session-spawner
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Type Definitions
// ============================================================================

export interface ClaudeSessionConfig {
  /** Working directory for the session */
  workingDirectory: string;
  /** VP charter defining constraints and identity */
  charter: VPCharter;
  /** Task context and metadata */
  taskContext: TaskContext;
  /** Memory context to inject into session */
  memory: MemoryContext;
  /** Environment variables to pass to Claude */
  environmentVariables?: Record<string, string>;
  /** Timeout in milliseconds (0 = no timeout) */
  timeout?: number;
  /** Enable verbose output capture */
  verbose?: boolean;
  /** Custom CLAUDE.md configuration path */
  claudeConfigPath?: string;
}

export interface VPCharter {
  /** VP identity information */
  identity: {
    name: string;
    email: string;
    role: string;
  };
  /** Task-specific objectives */
  objectives: string[];
  /** Hard constraints that cannot be violated */
  constraints: {
    forbiddenCommands: string[];
    forbiddenPatterns: RegExp[];
    requiredApprovals: string[];
  };
  /** Resource limits */
  resources: {
    maxTokens: number;
    maxExecutionTime: number;
    allowedTools: string[];
  };
}

export interface TaskContext {
  /** Unique task identifier */
  taskId: string;
  /** Task description */
  description: string;
  /** Task priority */
  priority: 'critical' | 'high' | 'medium' | 'low';
  /** Related task IDs for context */
  relatedTasks?: string[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface MemoryContext {
  /** Recent decisions and actions */
  recentActions: Array<{
    timestamp: Date;
    action: string;
    result: string;
  }>;
  /** Conversation history snippets */
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  /** Learned patterns and preferences */
  preferences: Record<string, unknown>;
  /** Project-specific context */
  projectContext: Record<string, unknown>;
}

export interface ClaudeSessionStatus {
  /** Unique session identifier */
  sessionId: string;
  /** Current state of the session */
  state:
    | 'initializing'
    | 'running'
    | 'waiting_input'
    | 'completed'
    | 'failed'
    | 'timeout'
    | 'crashed'
    | 'terminated';
  /** Process ID of the Claude session */
  pid?: number;
  /** Session start time */
  startTime: Date;
  /** Session end time (if completed) */
  endTime?: Date;
  /** Total execution time in milliseconds */
  executionTime?: number;
  /** Exit code (if completed) */
  exitCode?: number;
  /** Error message (if failed) */
  errorMessage?: string;
  /** Captured stdout */
  stdout: string;
  /** Captured stderr */
  stderr: string;
  /** Token usage statistics */
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
  /** Session metrics */
  metrics: SessionMetrics;
}

export interface SessionMetrics {
  /** Number of commands executed */
  commandsExecuted: number;
  /** Number of files modified */
  filesModified: number;
  /** Number of approval prompts */
  approvalPrompts: number;
  /** Number of escalations */
  escalations: number;
  /** Number of errors encountered */
  errors: number;
}

export interface SessionCrashReport {
  /** Session ID that crashed */
  sessionId: string;
  /** Crash timestamp */
  timestamp: Date;
  /** Exit signal (SIGTERM, SIGKILL, etc.) */
  signal?: string;
  /** Exit code */
  exitCode?: number;
  /** Last known state before crash */
  lastState: string;
  /** Last captured output */
  lastOutput: string;
  /** Stack trace if available */
  stackTrace?: string;
}

export interface SpawnResult {
  /** Spawned session ID */
  sessionId: string;
  /** Session status */
  status: ClaudeSessionStatus;
  /** Promise that resolves when session completes */
  completion: Promise<ClaudeSessionStatus>;
}

// ============================================================================
// Claude Session Spawner Class
// ============================================================================

export class ClaudeSessionSpawner extends EventEmitter {
  private activeSessions = new Map<string, SessionInstance>();
  private sessionHistory: ClaudeSessionStatus[] = [];
  private readonly maxHistorySize = 100;

  constructor() {
    super();
  }

  /**
   * Spawn a new Claude Code session
   */
  async spawnSession(
    config: ClaudeSessionConfig
  ): Promise<SpawnResult> {
    const sessionId = this.generateSessionId();
    const startTime = new Date();

    // Create initial status
    const status: ClaudeSessionStatus = {
      sessionId,
      state: 'initializing',
      startTime,
      stdout: '',
      stderr: '',
      metrics: {
        commandsExecuted: 0,
        filesModified: 0,
        approvalPrompts: 0,
        escalations: 0,
        errors: 0,
      },
    };

    try {
      // Generate session-specific CLAUDE.md
      const claudeConfigPath = await this.generateClaudeConfig(
        sessionId,
        config
      );

      // Prepare environment
      const env = this.prepareEnvironment(config, claudeConfigPath);

      // Compile task prompt
      const taskPrompt = this.compileTaskPrompt(config);

      // Spawn Claude Code process
      const process = await this.spawnClaudeProcess(
        config.workingDirectory,
        env,
        taskPrompt
      );

      status.pid = process.pid;
      status.state = 'running';

      // Create session instance
      const instance: SessionInstance = {
        sessionId,
        config,
        process,
        status,
        stdoutBuffer: '',
        stderrBuffer: '',
      };

      this.activeSessions.set(sessionId, instance);

      // Set up output capture
      this.setupOutputCapture(instance);

      // Set up timeout if configured
      if (config.timeout && config.timeout > 0) {
        this.setupTimeout(instance, config.timeout);
      }

      // Create completion promise
      const completion = this.createCompletionPromise(instance);

      this.emit('session-spawned', { sessionId, pid: process.pid });

      return {
        sessionId,
        status: { ...status },
        completion,
      };
    } catch (error) {
      status.state = 'failed';
      status.errorMessage =
        error instanceof Error ? error.message : String(error);
      status.endTime = new Date();
      status.executionTime =
        status.endTime.getTime() - status.startTime.getTime();

      this.sessionHistory.push(status);
      this.trimHistory();

      throw error;
    }
  }

  /**
   * Get status of a specific session
   */
  getSessionStatus(sessionId: string): ClaudeSessionStatus | null {
    const instance = this.activeSessions.get(sessionId);
    if (instance) {
      return { ...instance.status };
    }

    // Check history
    return (
      this.sessionHistory.find((s) => s.sessionId === sessionId) ?? null
    );
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): ClaudeSessionStatus[] {
    return Array.from(this.activeSessions.values()).map((i) => ({
      ...i.status,
    }));
  }

  /**
   * Terminate a session gracefully
   */
  async terminateSession(
    sessionId: string,
    graceful = true
  ): Promise<void> {
    const instance = this.activeSessions.get(sessionId);
    if (!instance) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const { process, status } = instance;

    if (graceful) {
      // Send SIGTERM for graceful shutdown
      process.kill('SIGTERM');

      // Wait for graceful shutdown (max 5 seconds)
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          // Force kill if still running
          if (!process.killed) {
            process.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        process.once('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    } else {
      // Force kill immediately
      process.kill('SIGKILL');
    }

    status.state = 'terminated';
    this.handleSessionEnd(instance);
  }

  /**
   * Send input to a running session
   */
  sendInput(sessionId: string, input: string): void {
    const instance = this.activeSessions.get(sessionId);
    if (!instance) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (instance.status.state !== 'running') {
      throw new Error(
        `Cannot send input to session in state: ${instance.status.state}`
      );
    }

    instance.process.stdin?.write(input);
  }

  /**
   * Clean up completed sessions
   */
  cleanupCompletedSessions(): number {
    let cleaned = 0;

    const completedSessions: string[] = [];
    this.activeSessions.forEach((instance, sessionId) => {
      if (
        instance.status.state === 'completed' ||
        instance.status.state === 'failed' ||
        instance.status.state === 'crashed'
      ) {
        completedSessions.push(sessionId);
      }
    });

    completedSessions.forEach((sessionId) => {
      this.activeSessions.delete(sessionId);
      cleaned++;
    });

    return cleaned;
  }

  /**
   * Get session crash reports
   */
  getCrashReports(): SessionCrashReport[] {
    return this.sessionHistory
      .filter((s) => s.state === 'crashed')
      .map((s) => ({
        sessionId: s.sessionId,
        timestamp: s.endTime ?? s.startTime,
        exitCode: s.exitCode,
        lastState: s.state,
        lastOutput: s.stdout.slice(-1000), // Last 1KB
        stackTrace: s.errorMessage,
      }));
  }

  /**
   * Get session metrics summary
   */
  getMetricsSummary(): SessionMetricsSummary {
    const all = [
      ...Array.from(this.activeSessions.values()).map((i) => i.status),
      ...this.sessionHistory,
    ];

    return {
      totalSessions: all.length,
      activeSessions: this.activeSessions.size,
      completedSessions: all.filter((s) => s.state === 'completed')
        .length,
      failedSessions: all.filter((s) => s.state === 'failed').length,
      crashedSessions: all.filter((s) => s.state === 'crashed').length,
      avgExecutionTime:
        all.reduce((sum, s) => sum + (s.executionTime ?? 0), 0) /
          all.length || 0,
      totalTokensUsed: all.reduce(
        (sum, s) => sum + (s.tokenUsage?.total ?? 0),
        0
      ),
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async generateClaudeConfig(
    sessionId: string,
    config: ClaudeSessionConfig
  ): Promise<string> {
    const { charter, taskContext, memory } = config;

    // Read base CLAUDE.md or use template
    let baseConfig = '';
    if (config.claudeConfigPath) {
      baseConfig = await fs.readFile(config.claudeConfigPath, 'utf-8');
    }

    // Compile session-specific configuration
    const sessionConfig = `
# Session: ${sessionId}
# Task: ${taskContext.description}
# Priority: ${taskContext.priority}

## VP Identity
- Name: ${charter.identity.name}
- Email: ${charter.identity.email}
- Role: ${charter.identity.role}

## Objectives
${charter.objectives.map((obj) => `- ${obj}`).join('\n')}

## Constraints
### Forbidden Commands
${charter.constraints.forbiddenCommands.map((cmd) => `- ${cmd}`).join('\n')}

### Required Approvals
${charter.constraints.requiredApprovals.map((pattern) => `- ${pattern}`).join('\n')}

## Resource Limits
- Max Tokens: ${charter.resources.maxTokens}
- Max Execution Time: ${charter.resources.maxExecutionTime}ms
- Allowed Tools: ${charter.resources.allowedTools.join(', ')}

## Memory Context
### Recent Actions
${memory.recentActions.map((action) => `- [${action.timestamp.toISOString()}] ${action.action}: ${action.result}`).join('\n')}

### Preferences
${Object.entries(memory.preferences).map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`).join('\n')}

---

${baseConfig}
`;

    // Write to session-specific location
    const configDir = path.join(
      config.workingDirectory,
      '.vp-daemon',
      'sessions',
      sessionId
    );
    await fs.mkdir(configDir, { recursive: true });

    const configPath = path.join(configDir, 'CLAUDE.md');
    await fs.writeFile(configPath, sessionConfig, 'utf-8');

    return configPath;
  }

  private prepareEnvironment(
    config: ClaudeSessionConfig,
    claudeConfigPath: string
  ): NodeJS.ProcessEnv {
    return {
      ...process.env,
      ...config.environmentVariables,
      // Inject session-specific config
      CLAUDE_CONFIG_PATH: claudeConfigPath,
      // Set working directory
      PWD: config.workingDirectory,
      // Disable interactive prompts
      CI: 'true',
      CLAUDE_NON_INTERACTIVE: 'true',
    };
  }

  private compileTaskPrompt(config: ClaudeSessionConfig): string {
    const { taskContext, memory } = config;

    let prompt = `Task: ${taskContext.description}\n\n`;

    if (taskContext.relatedTasks && taskContext.relatedTasks.length > 0) {
      prompt += `Related Tasks: ${taskContext.relatedTasks.join(', ')}\n\n`;
    }

    if (memory.conversationHistory.length > 0) {
      prompt += 'Previous Conversation:\n';
      memory.conversationHistory.forEach((msg) => {
        prompt += `${msg.role}: ${msg.content}\n`;
      });
      prompt += '\n';
    }

    prompt += 'Please proceed with the task following the VP charter constraints.';

    return prompt;
  }

  private async spawnClaudeProcess(
    workingDirectory: string,
    env: NodeJS.ProcessEnv,
    taskPrompt: string
  ): Promise<ChildProcess> {
    return new Promise((resolve, reject) => {
      const claudeProcess = spawn('claude', ['--'], {
        cwd: workingDirectory,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      claudeProcess.once('spawn', () => {
        // Send initial task prompt
        claudeProcess.stdin?.write(`${taskPrompt}\n`);
        resolve(claudeProcess);
      });

      claudeProcess.once('error', (error) => {
        reject(
          new Error(`Failed to spawn Claude process: ${error.message}`)
        );
      });
    });
  }

  private setupOutputCapture(instance: SessionInstance): void {
    const { process, status } = instance;

    process.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      instance.stdoutBuffer += chunk;
      status.stdout += chunk;

      // Parse output for metrics
      this.parseOutputForMetrics(chunk, status.metrics);

      this.emit('session-output', {
        sessionId: instance.sessionId,
        type: 'stdout',
        data: chunk,
      });
    });

    process.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      instance.stderrBuffer += chunk;
      status.stderr += chunk;

      this.emit('session-output', {
        sessionId: instance.sessionId,
        type: 'stderr',
        data: chunk,
      });
    });

    process.on('exit', (code, signal) => {
      this.handleProcessExit(instance, code, signal);
    });
  }

  private setupTimeout(instance: SessionInstance, timeout: number): void {
    const timer = setTimeout(() => {
      instance.status.state = 'timeout';
      instance.process.kill('SIGTERM');

      this.emit('session-timeout', { sessionId: instance.sessionId });
    }, timeout);

    instance.process.once('exit', () => {
      clearTimeout(timer);
    });
  }

  private createCompletionPromise(
    instance: SessionInstance
  ): Promise<ClaudeSessionStatus> {
    return new Promise((resolve) => {
      instance.process.once('exit', () => {
        // Give output buffers time to flush
        setTimeout(() => {
          resolve({ ...instance.status });
        }, 100);
      });
    });
  }

  private handleProcessExit(
    instance: SessionInstance,
    code: number | null,
    signal: NodeJS.Signals | null
  ): void {
    const { status } = instance;

    status.exitCode = code ?? undefined;
    status.endTime = new Date();
    status.executionTime =
      status.endTime.getTime() - status.startTime.getTime();

    if (signal) {
      status.state = 'crashed';
      status.errorMessage = `Process terminated with signal: ${signal}`;
    } else if (code === 0) {
      status.state = 'completed';
    } else {
      status.state = 'failed';
      status.errorMessage = `Process exited with code: ${code}`;
    }

    this.handleSessionEnd(instance);
  }

  private handleSessionEnd(instance: SessionInstance): void {
    this.emit('session-ended', {
      sessionId: instance.sessionId,
      status: instance.status,
    });

    // Move to history
    this.sessionHistory.push({ ...instance.status });
    this.trimHistory();

    // Remove from active sessions after a delay (allow for cleanup)
    setTimeout(() => {
      this.activeSessions.delete(instance.sessionId);
    }, 5000);
  }

  private parseOutputForMetrics(
    output: string,
    metrics: SessionMetrics
  ): void {
    // Parse Claude Code output for metrics
    if (/executed command/i.test(output)) {
      metrics.commandsExecuted++;
    }
    if (/modified file|wrote file|edited file/i.test(output)) {
      metrics.filesModified++;
    }
    if (/\[Y\/n\]|\(approve\)/i.test(output)) {
      metrics.approvalPrompts++;
    }
    if (/escalat(ed|ing)/i.test(output)) {
      metrics.escalations++;
    }
    if (/error|failed|exception/i.test(output)) {
      metrics.errors++;
    }
  }

  private trimHistory(): void {
    if (this.sessionHistory.length > this.maxHistorySize) {
      this.sessionHistory = this.sessionHistory.slice(-this.maxHistorySize);
    }
  }

  private generateSessionId(): string {
    return `claude-session-${uuidv4()}`;
  }
}

// ============================================================================
// Internal Types
// ============================================================================

interface SessionInstance {
  sessionId: string;
  config: ClaudeSessionConfig;
  process: ChildProcess;
  status: ClaudeSessionStatus;
  stdoutBuffer: string;
  stderrBuffer: string;
}

export interface SessionMetricsSummary {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  failedSessions: number;
  crashedSessions: number;
  avgExecutionTime: number;
  totalTokensUsed: number;
}

// ============================================================================
// Exports
// ============================================================================

export default ClaudeSessionSpawner;
