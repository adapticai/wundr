/**
 * Lifecycle Module Exports
 *
 * Provides health monitoring and graceful shutdown capabilities
 * for the MCP server.
 *
 * @packageDocumentation
 */

// Health Check
export {
  // Types
  HealthStatus,
  HealthCheckResult,
  HealthReport,
  HealthCheckFunction,
  HealthCheckRegistration,
  HealthCheckConfig,

  // Built-in checks
  createMemoryHealthCheck,
  createEventLoopHealthCheck,
  createProcessHealthCheck,

  // Health Check Manager
  HealthCheckManager,
  createHealthCheckManager,
} from './health-check';

// Graceful Shutdown
export {
  // Types
  ShutdownState,
  ShutdownReason,
  CleanupTask,
  CleanupTaskRegistration,
  GracefulShutdownConfig,
  ShutdownResult,
  TaskResult,

  // Request Tracker
  InFlightRequestTracker,

  // Graceful Shutdown Handler
  GracefulShutdownHandler,
  createGracefulShutdownHandler,
} from './graceful-shutdown';
