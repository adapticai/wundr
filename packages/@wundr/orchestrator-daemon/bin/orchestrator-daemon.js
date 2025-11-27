#!/usr/bin/env node

/**
 * Orchestrator Daemon CLI entry point
 */

const { OrchestratorDaemon } = require('../dist/index');

async function main() {
  const daemon = new OrchestratorDaemon({
    name: 'orchestrator-daemon',
    port: parseInt(process.env.ORCHESTRATOR_DAEMON_PORT || '8787', 10),
    host: process.env.ORCHESTRATOR_DAEMON_HOST || '127.0.0.1',
    maxSessions: parseInt(process.env.ORCHESTRATOR_MAX_SESSIONS || '100', 10),
    heartbeatInterval: 30000,
    shutdownTimeout: 10000,
    verbose: process.env.ORCHESTRATOR_VERBOSE === 'true',
  });

  // Handle shutdown signals
  const shutdown = async (signal) => {
    console.log(`\nReceived ${signal}, shutting down gracefully...`);
    try {
      await daemon.stop();
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Start daemon
  try {
    await daemon.start();
    console.log('Orchestrator Daemon is running. Press Ctrl+C to stop.');
  } catch (error) {
    console.error('Failed to start Orchestrator Daemon:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
