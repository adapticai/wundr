/**
 * @neolith/core - Orchestrator Daemon Configuration
 *
 * Environment configuration and constants for orchestrator daemon integration.
 *
 * @packageDocumentation
 */

// =============================================================================
// Environment Variables
// =============================================================================

/**
 * Check if orchestrator mode is enabled
 */
export function isOrchestratorModeEnabled(): boolean {
  return process.env.ORCHESTRATOR_MODE === 'true' || process.env.NEXT_PUBLIC_ORCHESTRATOR_MODE === 'true';
}

/**
 * Check if daemon auto-start is enabled
 */
export function isDaemonAutoStartEnabled(): boolean {
  return process.env.DAEMON_AUTO_START !== 'false' && process.env.NEXT_PUBLIC_DAEMON_AUTO_START !== 'false';
}

/**
 * Get daemon heartbeat interval (default 30 seconds)
 */
export function getDaemonHeartbeatInterval(): number {
  const interval = parseInt(process.env.DAEMON_HEARTBEAT_INTERVAL || process.env.NEXT_PUBLIC_DAEMON_HEARTBEAT_INTERVAL || '30000', 10);
  return isNaN(interval) ? 30000 : interval;
}

/**
 * Get health check interval (default 1 minute)
 */
export function getHealthCheckInterval(): number {
  const interval = parseInt(process.env.DAEMON_HEALTH_CHECK_INTERVAL || process.env.NEXT_PUBLIC_DAEMON_HEALTH_CHECK_INTERVAL || '60000', 10);
  return isNaN(interval) ? 60000 : interval;
}

/**
 * Check if auto-restart is enabled
 */
export function isDaemonAutoRestartEnabled(): boolean {
  return process.env.DAEMON_AUTO_RESTART !== 'false' && process.env.NEXT_PUBLIC_DAEMON_AUTO_RESTART !== 'false';
}

/**
 * Get max restart attempts (default 3)
 */
export function getMaxRestartAttempts(): number {
  const attempts = parseInt(process.env.DAEMON_MAX_RESTART_ATTEMPTS || process.env.NEXT_PUBLIC_DAEMON_MAX_RESTART_ATTEMPTS || '3', 10);
  return isNaN(attempts) ? 3 : attempts;
}

/**
 * Check if verbose logging is enabled
 */
export function isDaemonVerboseEnabled(): boolean {
  return process.env.DAEMON_VERBOSE === 'true' || process.env.NEXT_PUBLIC_DAEMON_VERBOSE === 'true';
}

/**
 * Get max concurrent conversations (default 10)
 */
export function getMaxConcurrentConversations(): number {
  const max = parseInt(process.env.DAEMON_MAX_CONCURRENT_CONVERSATIONS || process.env.NEXT_PUBLIC_DAEMON_MAX_CONCURRENT_CONVERSATIONS || '10', 10);
  return isNaN(max) ? 10 : max;
}

// =============================================================================
// Configuration Builder
// =============================================================================

/**
 * Build daemon manager configuration from environment variables
 */
export function buildDaemonManagerConfig() {
  return {
    autoStart: isDaemonAutoStartEnabled(),
    healthCheckInterval: getHealthCheckInterval(),
    autoRestart: isDaemonAutoRestartEnabled(),
    maxRestartAttempts: getMaxRestartAttempts(),
    verbose: isDaemonVerboseEnabled(),
  };
}

/**
 * Build daemon configuration from environment variables
 */
export function buildDaemonConfig() {
  return {
    heartbeatInterval: getDaemonHeartbeatInterval(),
    maxConcurrentConversations: getMaxConcurrentConversations(),
    autoRespond: true, // Always enabled
    verbose: isDaemonVerboseEnabled(),
  };
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default daemon configuration values
 */
export const DEFAULT_DAEMON_CONFIG = {
  HEARTBEAT_INTERVAL: 30000, // 30 seconds
  HEALTH_CHECK_INTERVAL: 60000, // 1 minute
  MAX_CONCURRENT_CONVERSATIONS: 10,
  MAX_RESTART_ATTEMPTS: 3,
  AUTO_START: true,
  AUTO_RESTART: true,
  AUTO_RESPOND: true,
  VERBOSE: false,
} as const;

/**
 * Daemon status constants
 */
export const DAEMON_STATUS = {
  STOPPED: 'stopped',
  INITIALIZING: 'initializing',
  RUNNING: 'running',
  ERROR: 'error',
  STOPPING: 'stopping',
} as const;

/**
 * Action types for orchestrator actions
 */
export const ACTION_TYPES = {
  SEND_MESSAGE: 'send_message',
  REACT: 'react',
  UPDATE_STATUS: 'update_status',
  JOIN_CHANNEL: 'join_channel',
  LEAVE_CHANNEL: 'leave_channel',
} as const;
