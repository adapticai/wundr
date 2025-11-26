/**
 * VP Daemon - Main orchestration daemon
 */

import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import YAML from 'yaml';
import {
  DaemonConfig,
  DaemonConfigSchema,
  DaemonStatus,
  DaemonMetrics,
  VPCharter,
  VPCharterSchema,
  Task,
  Session,
  MemoryConfig,
  SpawnSessionPayload,
} from '../types';
import { Logger, LogLevel } from '../utils/logger';
import { VPWebSocketServer } from './websocket-server';
import { SessionManager } from '../session/session-manager';
import { MemoryManager } from '../memory/memory-manager';

export class VPDaemon extends EventEmitter {
  private logger: Logger;
  private config: DaemonConfig;
  private charter: VPCharter | null = null;
  private wsServer: VPWebSocketServer;
  private sessionManager: SessionManager;
  private memoryManager: MemoryManager;
  private status: DaemonStatus['status'] = 'stopped';
  private startTime: number = 0;
  private metrics: DaemonMetrics;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: DaemonConfig) {
    super();

    // Validate and parse config
    this.config = DaemonConfigSchema.parse(config);

    this.logger = new Logger('VPDaemon', this.config.verbose ? LogLevel.DEBUG : LogLevel.INFO);

    // Initialize metrics
    this.metrics = {
      totalSessionsSpawned: 0,
      totalTasksProcessed: 0,
      totalTokensUsed: 0,
      averageSessionDuration: 0,
      activeSessions: 0,
      successRate: 1.0,
    };

    // Initialize WebSocket server
    this.wsServer = new VPWebSocketServer(this.config.port, this.config.host);

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
    this.sessionManager = new SessionManager(this.memoryManager, this.config.maxSessions);

    this.setupEventHandlers();
  }

  /**
   * Start the daemon
   */
  async start(): Promise<void> {
    this.logger.info('Starting VP Daemon...');
    this.status = 'initializing';

    try {
      // Load VP charter
      await this.loadCharter();

      // Start WebSocket server
      await this.wsServer.start();

      // Start health check
      this.startHealthCheck();

      // Start cleanup routine
      this.startCleanup();

      this.status = 'running';
      this.startTime = Date.now();

      this.logger.info('VP Daemon started successfully');
      this.emit('started');
    } catch (error) {
      this.status = 'stopped';
      this.logger.error('Failed to start VP Daemon:', error);
      throw error;
    }
  }

  /**
   * Stop the daemon
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping VP Daemon...');

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
      activeSessions.map((session) => this.sessionManager.stopSession(session.id))
    );

    // Stop WebSocket server
    await this.wsServer.stop();

    this.status = 'stopped';
    this.logger.info('VP Daemon stopped');
    this.emit('stopped');
  }

  /**
   * Spawn a new session
   */
  async spawnSession(vpId: string, task: Task): Promise<Session> {
    this.logger.info(`Spawning session for task: ${task.id}`);

    try {
      const session = await this.sessionManager.spawnSession(vpId, task);

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
      },
    };
  }

  /**
   * Load VP charter
   */
  private async loadCharter(): Promise<void> {
    try {
      const vpDaemonDir = path.join(os.homedir(), 'vp-daemon');
      const charterPath = path.join(vpDaemonDir, 'vp-charter.yaml');

      const charterContent = await fs.readFile(charterPath, 'utf-8');
      const charterData = YAML.parse(charterContent);

      this.charter = VPCharterSchema.parse(charterData);
      this.logger.info('VP charter loaded successfully');
    } catch (error) {
      this.logger.warn('Failed to load VP charter, using defaults:', error);
      // Continue without charter - use defaults
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // WebSocket server events
    this.wsServer.on('spawn_session', async ({ ws, payload }: { ws: unknown; payload: SpawnSessionPayload }) => {
      try {
        const task: Task = {
          id: `task_${Date.now()}`,
          ...payload.task,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const session = await this.spawnSession(payload.vpId, task);
        this.wsServer.send(ws as import('ws').WebSocket, {
          type: 'session_spawned',
          session,
        });
      } catch (error) {
        this.wsServer.sendError(ws as import('ws').WebSocket, error instanceof Error ? error.message : 'Unknown error');
      }
    });

    this.wsServer.on('session_status', ({ ws, sessionId }: { ws: unknown; sessionId: string }) => {
      const session = this.sessionManager.getSession(sessionId);
      if (session) {
        this.wsServer.send(ws as import('ws').WebSocket, {
          type: 'session_status_update',
          session,
        });
      } else {
        this.wsServer.sendError(ws as import('ws').WebSocket, `Session not found: ${sessionId}`);
      }
    });

    this.wsServer.on('daemon_status', ({ ws }: { ws: unknown }) => {
      this.wsServer.send(ws as import('ws').WebSocket, {
        type: 'daemon_status_update',
        status: this.getStatus(),
      });
    });

    this.wsServer.on('stop_session', async ({ ws, sessionId }: { ws: unknown; sessionId: string }) => {
      try {
        await this.sessionManager.stopSession(sessionId);
        const session = this.sessionManager.getSession(sessionId);
        if (session) {
          this.wsServer.send(ws as import('ws').WebSocket, {
            type: 'session_status_update',
            session,
          });
        }
      } catch (error) {
        this.wsServer.sendError(ws as import('ws').WebSocket, error instanceof Error ? error.message : 'Unknown error');
      }
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
}
