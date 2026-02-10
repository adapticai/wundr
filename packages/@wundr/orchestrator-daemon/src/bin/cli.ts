#!/usr/bin/env node

/**
 * Orchestrator Daemon CLI
 *
 * Command-line interface for the Orchestrator Daemon with proper argument parsing,
 * configuration validation, and graceful shutdown handling.
 */

import * as fs from 'fs';
import * as path from 'path';

import { OrchestratorDaemon } from '../core/orchestrator-daemon';

import type { DaemonConfig } from '../types';

interface CLIOptions {
  port: number;
  host: string;
  verbose: boolean;
  config?: string;
  maxSessions: number;
  heartbeatInterval: number;
  shutdownTimeout: number;
}

/**
 * Parse command line arguments
 */
function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    port: 8787,
    host: '127.0.0.1',
    verbose: false,
    maxSessions: 100,
    heartbeatInterval: 30000,
    shutdownTimeout: 10000,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;

      case '--port':
      case '-p': {
        if (i + 1 >= args.length) {
          console.error('Error: --port requires a value');
          process.exit(1);
        }
        const port = parseInt(args[++i], 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          console.error('Error: Invalid port number');
          process.exit(1);
        }
        options.port = port;
        break;
      }

      case '--host':
        if (i + 1 >= args.length) {
          console.error('Error: --host requires a value');
          process.exit(1);
        }
        options.host = args[++i];
        break;

      case '--verbose':
      case '-v':
        options.verbose = true;
        break;

      case '--config':
      case '-c':
        if (i + 1 >= args.length) {
          console.error('Error: --config requires a file path');
          process.exit(1);
        }
        options.config = args[++i];
        break;

      case '--max-sessions': {
        if (i + 1 >= args.length) {
          console.error('Error: --max-sessions requires a value');
          process.exit(1);
        }
        const maxSessions = parseInt(args[++i], 10);
        if (isNaN(maxSessions) || maxSessions < 1) {
          console.error('Error: Invalid max-sessions value');
          process.exit(1);
        }
        options.maxSessions = maxSessions;
        break;
      }

      default:
        console.error(`Error: Unknown option: ${arg}`);
        showHelp();
        process.exit(1);
    }
  }

  return options;
}

/**
 * Load environment variables from .env file
 */
function loadEnvFile(): void {
  const envPath = path.join(process.cwd(), '.env');

  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          // Only set if not already defined
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = value.replace(/^['"]|['"]$/g, '');
          }
        }
      }
    }
  }
}

/**
 * Load configuration from file
 */
function loadConfigFile(configPath: string): Partial<DaemonConfig> {
  try {
    const absolutePath = path.isAbsolute(configPath)
      ? configPath
      : path.join(process.cwd(), configPath);

    if (!fs.existsSync(absolutePath)) {
      console.error(`Error: Config file not found: ${absolutePath}`);
      process.exit(1);
    }

    const content = fs.readFileSync(absolutePath, 'utf-8');
    const config = JSON.parse(content);

    return config;
  } catch (error) {
    console.error('Error: Failed to load config file:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Merge configuration from multiple sources
 */
function buildConfig(options: CLIOptions): DaemonConfig {
  // Start with defaults
  let config: DaemonConfig = {
    name: 'orchestrator-daemon',
    port: options.port,
    host: options.host,
    maxSessions: options.maxSessions,
    heartbeatInterval: options.heartbeatInterval,
    shutdownTimeout: options.shutdownTimeout,
    verbose: options.verbose,
    logLevel: options.verbose ? 'debug' : 'info',
  };

  // Load from config file if provided
  if (options.config) {
    const fileConfig = loadConfigFile(options.config);
    config = { ...config, ...fileConfig };
  }

  // Override with environment variables
  if (process.env.ORCHESTRATOR_DAEMON_PORT) {
    config.port = parseInt(process.env.ORCHESTRATOR_DAEMON_PORT, 10);
  }
  if (process.env.ORCHESTRATOR_DAEMON_HOST) {
    config.host = process.env.ORCHESTRATOR_DAEMON_HOST;
  }
  if (process.env.ORCHESTRATOR_MAX_SESSIONS) {
    config.maxSessions = parseInt(process.env.ORCHESTRATOR_MAX_SESSIONS, 10);
  }
  if (process.env.ORCHESTRATOR_VERBOSE === 'true') {
    config.verbose = true;
  }

  // CLI options have highest priority
  config.port = options.port;
  config.host = options.host;
  config.verbose = options.verbose;
  config.maxSessions = options.maxSessions;

  return config;
}

/**
 * Validate configuration
 */
function validateConfig(config: DaemonConfig): boolean {
  const errors: string[] = [];

  if (!config.port || config.port < 1 || config.port > 65535) {
    errors.push('Invalid port number');
  }

  if (!config.host || config.host.trim() === '') {
    errors.push('Invalid host');
  }

  if (config.maxSessions < 1) {
    errors.push('maxSessions must be at least 1');
  }

  if (config.heartbeatInterval < 1000) {
    errors.push('heartbeatInterval must be at least 1000ms');
  }

  if (config.shutdownTimeout < 0) {
    errors.push('shutdownTimeout must be non-negative');
  }

  if (errors.length > 0) {
    console.error('Configuration validation failed:');
    errors.forEach(err => console.error(`  - ${err}`));
    return false;
  }

  return true;
}

/**
 * Print startup banner
 */
function printBanner(config: DaemonConfig): void {
  const border = '═'.repeat(60);
  console.log(`\n╔${border}╗`);
  console.log('║' + ' '.repeat(15) + 'ORCHESTRATOR DAEMON' + ' '.repeat(26) + '║');
  console.log(`╠${border}╣`);
  console.log(`║  Version: 1.0.6${' '.repeat(43)}║`);
  console.log(`║  Host: ${config.host}${' '.repeat(60 - 9 - config.host.length)}║`);
  console.log(`║  Port: ${config.port}${' '.repeat(60 - 9 - config.port.toString().length)}║`);
  console.log(`║  Max Sessions: ${config.maxSessions}${' '.repeat(60 - 17 - config.maxSessions.toString().length)}║`);
  console.log(`║  Verbose: ${config.verbose ? 'enabled' : 'disabled'}${' '.repeat(60 - 12 - (config.verbose ? 7 : 8))}║`);
  console.log(`╚${border}╝\n`);
}

/**
 * Show help message
 */
function showHelp(): void {
  console.log(`
Orchestrator Daemon - Agent orchestration and session management

USAGE:
  orchestrator-daemon [OPTIONS]

OPTIONS:
  -p, --port <number>          Server port (default: 8787)
  -h, --host <string>          Server host (default: 127.0.0.1)
  -v, --verbose                Enable verbose logging
  -c, --config <path>          Path to config file (JSON)
      --max-sessions <number>  Maximum concurrent sessions (default: 100)
      --help                   Show this help message

ENVIRONMENT VARIABLES:
  ORCHESTRATOR_DAEMON_PORT     Server port
  ORCHESTRATOR_DAEMON_HOST     Server host
  ORCHESTRATOR_MAX_SESSIONS    Maximum sessions
  ORCHESTRATOR_VERBOSE         Enable verbose mode (true/false)

EXAMPLES:
  # Start with default settings
  orchestrator-daemon

  # Start on custom port
  orchestrator-daemon --port 9090

  # Start with verbose logging
  orchestrator-daemon --verbose

  # Load from config file
  orchestrator-daemon --config ./config.json

  # Override all settings
  orchestrator-daemon -p 9090 -h 0.0.0.0 -v --max-sessions 200

For more information, visit: https://wundr.io
`);
}

/**
 * Main function
 */
export async function main(): Promise<void> {
  // Load .env file
  loadEnvFile();

  // Parse arguments
  const options = parseArgs();

  // Build configuration
  const config = buildConfig(options);

  // Validate configuration
  if (!validateConfig(config)) {
    process.exit(1);
  }

  // Print banner
  printBanner(config);

  // Create daemon instance
  const daemon = new OrchestratorDaemon(config);

  // Setup shutdown handlers
  let isShuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) {
      console.log('\nForce shutdown...');
      process.exit(1);
    }

    isShuttingDown = true;
    console.log(`\n\nReceived ${signal}, shutting down gracefully...`);

    const shutdownTimer = setTimeout(() => {
      console.error('Shutdown timeout exceeded, forcing exit');
      process.exit(1);
    }, config.shutdownTimeout);

    try {
      await daemon.stop();
      clearTimeout(shutdownTimer);
      console.log('Shutdown complete');
      process.exit(0);
    } catch (error) {
      clearTimeout(shutdownTimer);
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
  });

  // Start daemon
  try {
    await daemon.start();
    console.log('✓ Orchestrator Daemon is running');
    console.log('  Press Ctrl+C to stop\n');

    if (config.verbose) {
      console.log('Verbose logging enabled');
      console.log(`WebSocket server: ws://${config.host}:${config.port}\n`);
    }
  } catch (error) {
    console.error('\n✗ Failed to start Orchestrator Daemon:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
