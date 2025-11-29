/**
 * @neolith/core - Orchestrator Daemon Module
 *
 * Orchestrator daemon integration for Neolith. Orchestrators log in like
 * normal users and their daemon runs in the background to handle automated
 * interactions.
 *
 * @packageDocumentation
 */

// Core daemon
export {
  OrchestratorDaemon,
  createOrchestratorDaemon,
  shouldRunDaemon,
  type DaemonConfig,
  type DaemonStatus,
  type IncomingMessage,
  type OutgoingMessage,
  type OrchestratorAction,
  type DaemonHealthStatus,
} from './daemon';

// Daemon manager
export {
  OrchestratorDaemonManager,
  getDaemonManager,
  initializeDaemonManager,
  type DaemonManagerConfig,
} from './daemon-manager';

// Configuration
export {
  isOrchestratorModeEnabled,
  isDaemonAutoStartEnabled,
  getDaemonHeartbeatInterval,
  getHealthCheckInterval,
  isDaemonAutoRestartEnabled,
  getMaxRestartAttempts,
  isDaemonVerboseEnabled,
  getMaxConcurrentConversations,
  buildDaemonManagerConfig,
  buildDaemonConfig,
  DEFAULT_DAEMON_CONFIG,
  DAEMON_STATUS,
  ACTION_TYPES,
} from './config';
