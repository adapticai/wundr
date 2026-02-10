/**
 * Orchestrator Daemon - Main orchestration daemon
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { EventEmitter } from 'eventemitter3';
import YAML from 'yaml';

import {
  DaemonConfigSchema,
  OrchestratorCharterSchema,
} from '../types';
import { OrchestratorWebSocketServer } from './websocket-server';
import { AgentRegistry } from '../agents';
import { AuthConfigSchema } from '../auth/types';
import { ChannelRegistry } from '../channels';
import { startConfigWatcher } from '../config';
import { createHookRegistry, createHookEngine, registerBuiltInHooks } from '../hooks';
import { createOpenAIClient } from '../llm';
import { McpToolRegistryImpl } from '../mcp/tool-registry';
import { MemoryManager } from '../memory/memory-manager';
import { ModelRouter } from '../models';
import { PluginLifecycleManager } from '../plugins';
import { MessageRouter } from '../protocol';
import { SecurityGate } from '../security';
import { SessionManager } from '../session/session-manager';
import { SkillRegistry } from '../skills';
import { StreamHandler } from '../streaming';
import { TeamCoordinator } from '../teams';
import { Logger, LogLevel } from '../utils/logger';

import type { AuthConfig } from '../auth/types';
import type { ConfigWatcher } from '../config';
import type { HookRegistry, HookEngine} from '../hooks';
import type { McpToolRegistry } from '../session/tool-executor';
import type {
  DaemonConfig,
  DaemonStatus,
  DaemonMetrics,
  OrchestratorCharter,
  Task,
  Session,
  MemoryConfig,
  SpawnSessionPayload,
  ExecuteTaskPayload} from '../types';
import type { LLMClient } from '../types/llm';
import type { WebSocket } from 'ws';

export class OrchestratorDaemon extends EventEmitter {
  private logger: Logger;
  private config: DaemonConfig;
  private charter: OrchestratorCharter | null = null;
  private wsServer: OrchestratorWebSocketServer;
  private sessionManager: SessionManager;
  private memoryManager: MemoryManager;
  private llmClient: LLMClient;
  private mcpRegistry: McpToolRegistry;
  private status: DaemonStatus['status'] = 'stopped';
  private startTime: number = 0;
  private metrics: DaemonMetrics;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Wave 3 subsystems
  private hookRegistry: HookRegistry;
  private hookEngine: HookEngine;
  private skillRegistry: SkillRegistry;
  private teamCoordinator: TeamCoordinator;
  private agentRegistry: AgentRegistry;
  private modelRouter: ModelRouter;
  private channelRegistry: ChannelRegistry;
  private securityGate: SecurityGate;
  private streamHandler: StreamHandler;
  private protocolRouter: MessageRouter;
  private pluginManager: PluginLifecycleManager;
  private configWatcher: ConfigWatcher | null = null;

  constructor(config: DaemonConfig) {
    super();

    // Validate and parse config with environment variable overrides
    const runtimeConfig = {
      ...config,
      port: Number(process.env['DAEMON_PORT']) || config.port,
      host: process.env['DAEMON_HOST'] || config.host,
    };

    this.config = DaemonConfigSchema.parse(runtimeConfig);

    this.logger = new Logger('OrchestratorDaemon', this.config.verbose ? LogLevel.DEBUG : LogLevel.INFO);

    // Initialize metrics
    this.metrics = {
      totalSessionsSpawned: 0,
      totalTasksProcessed: 0,
      totalTokensUsed: 0,
      averageSessionDuration: 0,
      activeSessions: 0,
      successRate: 1.0,
    };

    // Initialize WebSocket auth (reads from environment variables)
    const authConfig = this.resolveAuthConfig();

    // Initialize WebSocket server
    this.wsServer = new OrchestratorWebSocketServer(this.config.port, this.config.host, authConfig ?? undefined);

    // Initialize memory manager with default config
    const defaultMemoryConfig: MemoryConfig = {
      version: '1.0.0',
      tiers: {
        scratchpad: {
          description: 'Working memory for current session context',
          maxSize: '50MB',
          ttl: '1h',
          persistence: 'session',
        },
        episodic: {
          description: 'Recent interaction history and session summaries',
          maxSize: '500MB',
          ttl: '7d',
          persistence: 'local',
        },
        semantic: {
          description: 'Long-term knowledge and learned patterns',
          maxSize: '2GB',
          ttl: 'permanent',
          persistence: 'permanent',
        },
      },
      compaction: {
        enabled: true,
        threshold: 0.8,
        strategy: 'summarize-and-archive',
      },
      retrieval: {
        strategy: 'recency-weighted-relevance',
        maxResults: 20,
        similarityThreshold: 0.7,
      },
    };

    this.memoryManager = new MemoryManager(defaultMemoryConfig);

    // Initialize LLM client with OpenAI and environment variables
    const openaiApiKey = process.env['OPENAI_API_KEY'];
    const openaiModel = process.env['OPENAI_MODEL'] || 'gpt-5-mini';

    if (!openaiApiKey) {
      this.logger.warn('OPENAI_API_KEY not set. LLM features will be unavailable.');
    }

    this.llmClient = createOpenAIClient({
      apiKey: openaiApiKey,
      defaultModel: openaiModel,
      temperature: 0.7,
      maxTokens: 4096,
      debug: this.config.verbose,
    });

    // Initialize MCP tools registry with safety checks enabled
    this.mcpRegistry = new McpToolRegistryImpl({ safetyChecks: true });

    // Initialize session manager with LLM client and MCP registry
    this.sessionManager = new SessionManager(
      this.memoryManager,
      this.config.maxSessions,
      this.llmClient,
      this.mcpRegistry,
    );

    // Listen for token usage updates from session manager
    this.sessionManager.on('session:token_usage', ({ tokensUsed }: { tokensUsed: number }) => {
      this.metrics.totalTokensUsed += tokensUsed;
    });

    // -----------------------------------------------------------------------
    // Wave 3 subsystem initialization
    // -----------------------------------------------------------------------

    // Hook system: registry + engine
    this.hookRegistry = createHookRegistry({
      logger: {
        debug: (msg: string) => this.logger.debug(msg),
        info: (msg: string) => this.logger.info(msg),
        warn: (msg: string) => this.logger.warn(msg),
        error: (msg: string) => this.logger.error(msg),
      },
    });
    registerBuiltInHooks(this.hookRegistry, {
      debug: (msg: string) => this.logger.debug(msg),
      info: (msg: string) => this.logger.info(msg),
      warn: (msg: string) => this.logger.warn(msg),
      error: (msg: string) => this.logger.error(msg),
    });
    this.hookEngine = createHookEngine({
      registry: this.hookRegistry,
      logger: {
        debug: (msg: string) => this.logger.debug(msg),
        info: (msg: string) => this.logger.info(msg),
        warn: (msg: string) => this.logger.warn(msg),
        error: (msg: string) => this.logger.error(msg),
      },
    });

    // Skill registry
    this.skillRegistry = new SkillRegistry({
      workspaceDir: process.cwd(),
      config: { enabled: true },
    });

    // Team coordinator
    this.teamCoordinator = new TeamCoordinator(this.sessionManager);

    // Agent registry
    this.agentRegistry = new AgentRegistry({
      projectRoot: process.cwd(),
    });

    // Model router (alternative LLM routing with failover)
    this.modelRouter = new ModelRouter({
      primary: process.env['OPENAI_MODEL'] || 'openai/gpt-5-mini',
      clientFactory: (_provider: string, cfg: { apiKey: string; baseUrl?: string }) =>
        createOpenAIClient({
          apiKey: cfg.apiKey || openaiApiKey,
          defaultModel: openaiModel,
          temperature: 0.7,
          maxTokens: 4096,
          debug: this.config.verbose,
        }),
    });

    // Channel registry
    this.channelRegistry = new ChannelRegistry({
      logger: {
        info: (msg: string) => this.logger.info(msg),
        warn: (msg: string) => this.logger.warn(msg),
        error: (msg: string) => this.logger.error(msg),
        debug: (msg: string) => this.logger.debug(msg),
      },
    });

    // Security gate (combines exec-approvals, tool-policy, redaction)
    this.securityGate = new SecurityGate();

    // Stream handler for real LLM streaming
    this.streamHandler = new StreamHandler();

    // Protocol v2 message router
    this.protocolRouter = new MessageRouter({
      serverVersion: '2.0.0',
      authenticate: async () => ({ ok: true, scopes: [] }),
      logger: {
        debug: (msg: string) => this.logger.debug(msg),
        info: (msg: string) => this.logger.info(msg),
        warn: (msg: string) => this.logger.warn(msg),
        error: (msg: string) => this.logger.error(msg),
      },
    });

    // Plugin lifecycle manager
    this.pluginManager = new PluginLifecycleManager({
      pluginsDir: path.join(process.cwd(), '.wundr', 'plugins'),
    });

    this.setupEventHandlers();
  }

  /**
   * Start the daemon
   */
  async start(): Promise<void> {
    this.logger.info('Starting Orchestrator Daemon...');
    this.status = 'initializing';

    try {
      // Load orchestrator charter
      await this.loadCharter();

      // Start WebSocket server
      await this.wsServer.start();

      // Start health check
      this.startHealthCheck();

      // Start cleanup routine
      this.startCleanup();

      // ---------------------------------------------------------------------
      // Start Wave 3 subsystems
      // ---------------------------------------------------------------------

      // Load skills from workspace
      try {
        await this.skillRegistry.load();
        this.logger.info('Skills loaded successfully');
      } catch (error) {
        this.logger.warn('Failed to load skills, continuing without:', error);
      }

      // Load agent definitions from project directory
      try {
        await this.agentRegistry.loadFromDirectory();
        this.logger.info('Agent definitions loaded successfully');
      } catch (error) {
        this.logger.warn('Failed to load agent definitions, continuing without:', error);
      }

      // Load plugins
      try {
        const pluginResult = await this.pluginManager.loadAll();
        this.logger.info(`Plugins loaded: ${pluginResult.loaded.length} succeeded, ${pluginResult.failed.length} failed`);
      } catch (error) {
        this.logger.warn('Failed to load plugins, continuing without:', error);
      }

      // Start config watcher
      try {
        const configDir = path.join(os.homedir(), 'orchestrator-daemon');
        const configFilePath = path.join(configDir, 'wundr.yaml');
        const { generateDefaultConfig, readConfigSnapshot } = await import('../config');
        this.configWatcher = startConfigWatcher({
          initialConfig: generateDefaultConfig(),
          readSnapshot: () => readConfigSnapshot({ configPath: configFilePath }),
          onHotReload: async (plan, _nextConfig) => {
            this.logger.info('Config hot-reloaded', { changedPaths: plan.changedPaths });
          },
          onRestart: (plan, _nextConfig) => {
            this.logger.warn('Config change requires daemon restart', { restartReasons: plan.restartReasons });
          },
          watchPath: configFilePath,
          log: {
            info: (msg: string) => this.logger.info(msg),
            warn: (msg: string) => this.logger.warn(msg),
            error: (msg: string) => this.logger.error(msg),
          },
        });
        this.logger.info('Config watcher started');
      } catch (error) {
        this.logger.warn('Failed to start config watcher, continuing without:', error);
      }

      this.status = 'running';
      this.startTime = Date.now();

      this.logger.info('Orchestrator Daemon started successfully', {
        port: this.config.port,
        host: this.config.host,
        maxSessions: this.config.maxSessions,
        llmModel: process.env['OPENAI_MODEL'] || 'gpt-5-mini',
      });
      this.emit('started');
    } catch (error) {
      this.status = 'stopped';
      this.logger.error('Failed to start Orchestrator Daemon:', error);
      throw error;
    }
  }

  /**
   * Stop the daemon
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping Orchestrator Daemon...');

    // Stop health check
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Stop cleanup
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Stop all active sessions
    const activeSessions = this.sessionManager.getActiveSessions();
    await Promise.all(
      activeSessions.map((session) => this.sessionManager.stopSession(session.id)),
    );

    // -----------------------------------------------------------------------
    // Stop Wave 3 subsystems
    // -----------------------------------------------------------------------

    // Stop config watcher
    if (this.configWatcher) {
      try {
        await this.configWatcher.stop();
      } catch (error) {
        this.logger.warn('Error stopping config watcher:', error);
      }
      this.configWatcher = null;
    }

    // Shutdown plugins
    try {
      await this.pluginManager.shutdown();
    } catch (error) {
      this.logger.warn('Error shutting down plugins:', error);
    }

    // Disconnect all channel adapters
    try {
      await this.channelRegistry.disconnectAll();
    } catch (error) {
      this.logger.warn('Error disconnecting channels:', error);
    }

    // Clean up team coordinator (no active teams to shut down if sessions already stopped)
    // TeamCoordinator cleanup is handled via session stop events

    // Stop WebSocket server
    await this.wsServer.stop();

    this.status = 'stopped';
    this.logger.info('Orchestrator Daemon stopped');
    this.emit('stopped');
  }

  /**
   * Spawn a new session
   */
  async spawnSession(orchestratorId: string, task: Task): Promise<Session> {
    this.logger.info(`Spawning session for task: ${task.id}`);

    try {
      const session = await this.sessionManager.spawnSession(orchestratorId, task);

      this.metrics.totalSessionsSpawned++;
      this.metrics.activeSessions = this.sessionManager.getActiveSessionCount();

      this.emit('session:spawned', session);
      return session;
    } catch (error) {
      this.logger.error('Failed to spawn session:', error);
      throw error;
    }
  }

  /**
   * Execute a task on an existing session
   */
  async executeTask(sessionId: string, task: string, context?: Record<string, unknown>): Promise<void> {
    this.logger.info(`Executing task on session: ${sessionId}`);

    try {
      const session = this.sessionManager.getSession(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      if (session.status !== 'running') {
        throw new Error(`Session ${sessionId} is not running (status: ${session.status})`);
      }

      // Update the session's task description
      session.task.description = task;
      session.task.status = 'in_progress';
      session.task.updatedAt = new Date();

      // Add context to task metadata if provided
      if (context) {
        session.task.metadata = {
          ...session.task.metadata,
          executionContext: context,
        };
      }

      // Delegate to session manager's executor
      await this.sessionManager.executeTask(sessionId);
    } catch (error) {
      this.logger.error(`Failed to execute task on session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Get daemon status
   */
  getStatus(): DaemonStatus {
    return {
      status: this.status,
      uptime: this.startTime > 0 ? Date.now() - this.startTime : 0,
      activeSessions: this.sessionManager.getActiveSessionCount(),
      queuedTasks: 0, // TODO: Implement task queue
      metrics: { ...this.metrics },
      subsystems: {
        websocket: {
          status: this.wsServer ? 'running' : 'stopped',
          lastCheck: new Date(),
        },
        sessionManager: {
          status: 'running',
          lastCheck: new Date(),
        },
        memoryManager: {
          status: 'running',
          lastCheck: new Date(),
        },
        llmClient: {
          status: process.env['OPENAI_API_KEY'] ? 'running' : 'degraded',
          lastCheck: new Date(),
        },
        mcpRegistry: {
          status: 'running',
          lastCheck: new Date(),
        },
        hookEngine: {
          status: 'running',
          lastCheck: new Date(),
        },
        skillRegistry: {
          status: 'running',
          lastCheck: new Date(),
        },
        teamCoordinator: {
          status: 'running',
          lastCheck: new Date(),
        },
        agentRegistry: {
          status: 'running',
          lastCheck: new Date(),
        },
        modelRouter: {
          status: 'running',
          lastCheck: new Date(),
        },
        channelRegistry: {
          status: 'running',
          lastCheck: new Date(),
        },
        securityGate: {
          status: 'running',
          lastCheck: new Date(),
        },
        streamHandler: {
          status: 'running',
          lastCheck: new Date(),
        },
        protocolRouter: {
          status: 'running',
          lastCheck: new Date(),
        },
        pluginManager: {
          status: 'running',
          lastCheck: new Date(),
        },
        configWatcher: {
          status: this.configWatcher ? 'running' : 'stopped',
          lastCheck: new Date(),
        },
      },
    };
  }

  /**
   * Load orchestrator charter
   */
  private async loadCharter(): Promise<void> {
    try {
      const orchestratorDaemonDir = path.join(os.homedir(), 'orchestrator-daemon');
      const charterPath = path.join(orchestratorDaemonDir, 'orchestrator-charter.yaml');

      const charterContent = await fs.readFile(charterPath, 'utf-8');
      const charterData = YAML.parse(charterContent);

      this.charter = OrchestratorCharterSchema.parse(charterData);
      this.logger.info('Orchestrator charter loaded successfully');
    } catch (error) {
      this.logger.warn('Failed to load orchestrator charter, using defaults:', error);
      // Continue without charter - use defaults
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // WebSocket server events
    this.wsServer.on('spawn_session', async ({ ws, payload }: { ws: unknown; payload: SpawnSessionPayload | { task: string; model?: string } }) => {
      try {
        // Handle both object-based and simple string-based task payloads
        const taskPayload = typeof payload.task === 'string'
          ? { description: payload.task, type: 'general' as const, priority: 'medium' as const }
          : payload.task;

        const task: Task = {
          id: `task_${Date.now()}`,
          description: taskPayload.description,
          type: taskPayload.type || 'general',
          priority: taskPayload.priority || 'medium',
          metadata: 'metadata' in taskPayload ? taskPayload.metadata : undefined,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const orchestratorId = 'orchestratorId' in payload ? payload.orchestratorId : 'default';
        const session = await this.spawnSession(orchestratorId, task);

        this.wsServer.send(ws as WebSocket, {
          type: 'session_spawned',
          session,
        });

        // Auto-execute the task after spawning
        try {
          await this.executeTask(session.id, task.description);
        } catch (error) {
          this.logger.error(`Failed to execute task on newly spawned session ${session.id}:`, error);
        }
      } catch (error) {
        this.wsServer.sendError(ws as WebSocket, error instanceof Error ? error.message : 'Unknown error');
      }
    });

    this.wsServer.on('execute_task', async ({ ws, payload }: { ws: unknown; payload: ExecuteTaskPayload }) => {
      try {
        const { sessionId, task, context } = payload;

        this.wsServer.send(ws as WebSocket, {
          type: 'task_executing',
          sessionId,
          taskId: task,
        });

        try {
          await this.executeTask(sessionId, task, context);

          this.wsServer.send(ws as WebSocket, {
            type: 'task_completed',
            sessionId,
            taskId: task,
          });
        } catch (error) {
          this.wsServer.send(ws as WebSocket, {
            type: 'task_failed',
            sessionId,
            taskId: task,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      } catch (error) {
        this.wsServer.sendError(ws as WebSocket, error instanceof Error ? error.message : 'Unknown error');
      }
    });

    this.wsServer.on('session_status', ({ ws, sessionId }: { ws: unknown; sessionId: string }) => {
      const session = this.sessionManager.getSession(sessionId);
      if (session) {
        this.wsServer.send(ws as WebSocket, {
          type: 'session_status_update',
          session,
        });
      } else {
        this.wsServer.sendError(ws as WebSocket, `Session not found: ${sessionId}`);
      }
    });

    this.wsServer.on('daemon_status', ({ ws }: { ws: unknown }) => {
      this.wsServer.send(ws as WebSocket, {
        type: 'daemon_status_update',
        status: this.getStatus(),
      });
    });

    this.wsServer.on('stop_session', async ({ ws, sessionId }: { ws: unknown; sessionId: string }) => {
      try {
        await this.sessionManager.stopSession(sessionId);
        const session = this.sessionManager.getSession(sessionId);
        if (session) {
          this.wsServer.send(ws as WebSocket, {
            type: 'session_status_update',
            session,
          });
        }
      } catch (error) {
        this.wsServer.sendError(ws as WebSocket, error instanceof Error ? error.message : 'Unknown error');
      }
    });

    this.wsServer.on('list_sessions', ({ ws }: { ws: unknown }) => {
      const sessions = this.sessionManager.getAllSessions();
      this.wsServer.send(ws as WebSocket, {
        type: 'sessions_list',
        sessions,
      });
    });

    // Session manager events
    this.sessionManager.on('session:spawned', (session: Session) => {
      this.wsServer.broadcast({
        type: 'session_status_update',
        session,
      });
    });

    this.sessionManager.on('session:stopped', (session: Session) => {
      this.metrics.activeSessions = this.sessionManager.getActiveSessionCount();
      this.wsServer.broadcast({
        type: 'session_status_update',
        session,
      });
    });

    this.sessionManager.on('session:completed', (session: Session) => {
      this.metrics.totalTasksProcessed++;
      this.metrics.activeSessions = this.sessionManager.getActiveSessionCount();
      this.wsServer.broadcast({
        type: 'session_status_update',
        session,
      });
    });

    this.sessionManager.on('session:failed', ({ session }: { session: Session }) => {
      this.metrics.activeSessions = this.sessionManager.getActiveSessionCount();
      this.wsServer.broadcast({
        type: 'session_status_update',
        session,
      });
    });
  }

  /**
   * Start health check interval
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      const status = this.getStatus();
      this.logger.debug('Health check:', status);
      this.emit('healthCheck', status);
    }, this.config.heartbeatInterval);
  }

  /**
   * Start cleanup interval
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.logger.debug('Running cleanup...');
      this.sessionManager.cleanup();
    }, 60000); // Cleanup every minute
  }

  /**
   * Build auth configuration from environment variables.
   *
   * Required env vars (when auth is enabled):
   *   DAEMON_AUTH_JWT_SECRET   - HMAC-SHA256 secret (>= 32 chars)
   *
   * Optional env vars:
   *   DAEMON_AUTH_MODE             - "jwt" | "api-key" | "both" (default: "both")
   *   DAEMON_AUTH_JWT_ISSUER       - JWT iss claim
   *   DAEMON_AUTH_JWT_AUDIENCE     - JWT aud claim
   *   DAEMON_AUTH_JWT_EXPIRES_SEC  - Token lifetime in seconds
   *   DAEMON_AUTH_API_KEYS         - JSON array of {key, clientId, scopes?}
   *   DAEMON_AUTH_ALLOW_LOOPBACK   - "true" to allow unauthenticated loopback
   *   DAEMON_AUTH_RATE_LIMIT_MAX   - Max messages per window
   *   DAEMON_AUTH_RATE_LIMIT_WINDOW_MS - Window duration ms
   *   DAEMON_AUTH_MAX_CONNECTIONS  - Max connections per client
   *
   * Returns `null` if no JWT secret is configured (auth disabled).
   */
  private resolveAuthConfig(): AuthConfig | null {
    const jwtSecret = process.env['DAEMON_AUTH_JWT_SECRET'];
    if (!jwtSecret) {
      this.logger.warn(
        'DAEMON_AUTH_JWT_SECRET not set -- WebSocket authentication is DISABLED. ' +
        'Set this variable to enable authentication.',
      );
      return null;
    }

    let apiKeys: Array<{ key: string; clientId: string; scopes?: string[] }> = [];
    const apiKeysJson = process.env['DAEMON_AUTH_API_KEYS'];
    if (apiKeysJson) {
      try {
        apiKeys = JSON.parse(apiKeysJson);
      } catch {
        this.logger.error('Failed to parse DAEMON_AUTH_API_KEYS as JSON; ignoring.');
      }
    }

    const raw = {
      mode: process.env['DAEMON_AUTH_MODE'] ?? 'both',
      jwtSecret,
      jwtIssuer: process.env['DAEMON_AUTH_JWT_ISSUER'] ?? 'wundr-orchestrator',
      jwtAudience: process.env['DAEMON_AUTH_JWT_AUDIENCE'] ?? 'wundr-daemon',
      jwtExpiresInSeconds: process.env['DAEMON_AUTH_JWT_EXPIRES_SEC']
        ? Number(process.env['DAEMON_AUTH_JWT_EXPIRES_SEC'])
        : 3600,
      apiKeys,
      allowLoopback: process.env['DAEMON_AUTH_ALLOW_LOOPBACK'] === 'true',
      rateLimitMaxMessages: process.env['DAEMON_AUTH_RATE_LIMIT_MAX']
        ? Number(process.env['DAEMON_AUTH_RATE_LIMIT_MAX'])
        : 100,
      rateLimitWindowMs: process.env['DAEMON_AUTH_RATE_LIMIT_WINDOW_MS']
        ? Number(process.env['DAEMON_AUTH_RATE_LIMIT_WINDOW_MS'])
        : 60_000,
      maxConnectionsPerClient: process.env['DAEMON_AUTH_MAX_CONNECTIONS']
        ? Number(process.env['DAEMON_AUTH_MAX_CONNECTIONS'])
        : 10,
    };

    const parsed = AuthConfigSchema.safeParse(raw);
    if (!parsed.success) {
      this.logger.error('Invalid auth configuration:', parsed.error.format());
      this.logger.warn('Falling back to NO authentication.');
      return null;
    }

    this.logger.info(`WebSocket auth configured: mode=${parsed.data.mode}, loopback=${parsed.data.allowLoopback}`);
    return parsed.data;
  }
}
