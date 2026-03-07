/**
 * Orchestrator Daemon CLI
 *
 * Entry point for managing the daemon lifecycle on a dedicated machine.
 * Commands: start | stop | restart | status | health
 *
 * Usage:
 *   orchestrator-daemon start [--port <n>] [--config <path>] [--log-level <level>] [--daemon]
 *   orchestrator-daemon stop
 *   orchestrator-daemon restart [start options]
 *   orchestrator-daemon status
 *   orchestrator-daemon health [--port <n>] [--host <h>] [--json]
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { Command } from 'commander';

import {
  writePidFile,
  removePidFile,
  resolveRunningPid,
  isProcessRunning,
  spawnDaemon,
  type SpawnDaemonOptions,
} from './daemon-process';
import { runHealthCheck } from './health-check';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PID_FILE = '/tmp/wundr-daemon.pid';
const LOG_DIR = '/tmp/wundr-daemon-logs';
const DEFAULT_PORT = 8787;
const DEFAULT_HOST = '127.0.0.1';
const SHUTDOWN_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveEntryPoint(): string {
  // Prefer compiled dist, fall back to src via tsx for development
  const distCli = path.join(__dirname, '../../dist/bin/cli.js');
  if (fs.existsSync(distCli)) {
    return distCli;
  }

  // Fallback: the bin wrapper which handles dev/prod resolution
  const binWrapper = path.join(__dirname, '../../bin/orchestrator-daemon.js');
  if (fs.existsSync(binWrapper)) {
    return binWrapper;
  }

  // Last resort: try the package root index
  return path.join(__dirname, '../../dist/index.js');
}

function resolveDistStartScript(): string {
  // The compiled start script that directly boots the daemon
  const candidates = [
    path.join(__dirname, '../../dist/bin/start.js'),
    path.join(__dirname, '../../dist/index.js'),
    path.join(__dirname, '../../bin/orchestrator-daemon.js'),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }

  throw new Error(
    'Cannot locate daemon entry point. Run "npm run build" first.'
  );
}

/**
 * Write a SIGTERM to a running PID and wait for the process to exit.
 * Returns true if the process stopped within the timeout, false otherwise.
 */
async function gracefulShutdown(
  pid: number,
  timeoutMs: number = SHUTDOWN_TIMEOUT_MS
): Promise<boolean> {
  try {
    process.kill(pid, 'SIGTERM');
  } catch (err) {
    // If we get ESRCH the process is already gone
    if ((err as NodeJS.ErrnoException).code === 'ESRCH') {
      return true;
    }
    throw err;
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 200));
    if (!isProcessRunning(pid)) {
      return true;
    }
  }

  return false;
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// ---------------------------------------------------------------------------
// Command implementations
// ---------------------------------------------------------------------------

async function cmdStart(opts: {
  port?: string;
  config?: string;
  logLevel?: string;
  daemon?: boolean;
  host?: string;
}): Promise<void> {
  // Check for an existing running instance
  const existingPid = resolveRunningPid(PID_FILE);
  if (existingPid !== null) {
    console.error(
      `Daemon is already running (PID ${existingPid}). Use "restart" to restart it.`
    );
    process.exit(1);
  }

  const port = opts.port ? parseInt(opts.port, 10) : DEFAULT_PORT;
  const host = opts.host ?? DEFAULT_HOST;

  // Validate port
  if (isNaN(port) || port < 1024 || port > 65535) {
    console.error(
      `Invalid port: ${opts.port}. Must be between 1024 and 65535.`
    );
    process.exit(1);
  }

  // Build extra env overrides from CLI flags
  const envOverrides: NodeJS.ProcessEnv = {
    DAEMON_PORT: String(port),
    DAEMON_HOST: host,
  };

  if (opts.config) {
    const absConfig = path.resolve(opts.config);
    if (!fs.existsSync(absConfig)) {
      console.error(`Config file not found: ${absConfig}`);
      process.exit(1);
    }
    envOverrides['WUNDR_CONFIG_PATH'] = absConfig;
  }

  if (opts.logLevel) {
    const valid = ['debug', 'info', 'warn', 'error'];
    if (!valid.includes(opts.logLevel)) {
      console.error(
        `Invalid log level: ${opts.logLevel}. Must be one of: ${valid.join(', ')}`
      );
      process.exit(1);
    }
    envOverrides['LOG_LEVEL'] = opts.logLevel;
  }

  if (opts.daemon) {
    // -----------------------------------------------------------------------
    // Background mode: fork the daemon and return immediately
    // -----------------------------------------------------------------------
    let entryPoint: string;
    try {
      entryPoint = resolveDistStartScript();
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }

    console.log('Starting daemon in background...');

    const spawnOpts: SpawnDaemonOptions = {
      entryPoint,
      args: [],
      logDir: LOG_DIR,
      pidFile: PID_FILE,
      cwd: path.join(__dirname, '../..'),
      env: { ...process.env, ...envOverrides },
    };

    try {
      const result = await spawnDaemon(spawnOpts);
      console.log(`Daemon started (PID ${result.pid})`);
      console.log(`  Logs:       ${result.logFile}`);
      console.log(`  Error logs: ${result.errorLogFile}`);
      console.log(`  PID file:   ${PID_FILE}`);
      console.log(`  Endpoint:   http://${host}:${port}/health`);
    } catch (err) {
      console.error(`Failed to start daemon: ${(err as Error).message}`);
      process.exit(1);
    }
  } else {
    // -----------------------------------------------------------------------
    // Foreground mode: run the daemon in-process
    // -----------------------------------------------------------------------
    console.log(`Starting daemon on ${host}:${port} (foreground mode)...`);
    console.log('Press Ctrl+C to stop.');

    // Apply env overrides before loading config
    Object.assign(process.env, envOverrides);

    // Load dotenv from the package directory
    const envFilePath = path.join(__dirname, '../../.env');
    if (fs.existsSync(envFilePath)) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
        const dotenv = require('dotenv');
        dotenv.config({ path: envFilePath });
      } catch {
        // dotenv optional
      }
    }

    // Dynamically import to avoid loading heavy deps at CLI parse time
    const { OrchestratorDaemon } = await import('../core/orchestrator-daemon');
    const { DaemonConfigSchema } = await import('../types');

    const config = DaemonConfigSchema.parse({
      port,
      host,
      logLevel:
        (opts.logLevel as 'debug' | 'info' | 'warn' | 'error') ??
        (process.env['LOG_LEVEL'] as 'debug' | 'info' | 'warn' | 'error') ??
        'info',
    });

    const daemon = new OrchestratorDaemon(config);

    // Write PID file for this foreground process
    writePidFile(process.pid, PID_FILE);

    const cleanup = async (signal: string) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      try {
        await daemon.stop();
      } catch (err) {
        console.error('Error during shutdown:', (err as Error).message);
      } finally {
        removePidFile(PID_FILE);
        process.exit(signal === 'SIGINT' ? 130 : 0);
      }
    };

    process.on('SIGTERM', () => cleanup('SIGTERM'));
    process.on('SIGINT', () => cleanup('SIGINT'));

    process.on('uncaughtException', err => {
      console.error('Uncaught exception:', err);
      cleanup('uncaughtException').catch(() => process.exit(1));
    });

    process.on('unhandledRejection', reason => {
      console.error('Unhandled rejection:', reason);
    });

    try {
      await daemon.start();
    } catch (err) {
      console.error('Daemon failed to start:', (err as Error).message);
      removePidFile(PID_FILE);
      process.exit(1);
    }

    // Keep the process alive — the daemon handles its own event loop
    // through the WebSocket/HTTP server.
  }
}

async function cmdStop(): Promise<void> {
  const pid = resolveRunningPid(PID_FILE);

  if (pid === null) {
    console.log('Daemon is not running.');
    process.exit(0);
  }

  console.log(`Stopping daemon (PID ${pid})...`);

  const stopped = await gracefulShutdown(pid, SHUTDOWN_TIMEOUT_MS);

  if (stopped) {
    removePidFile(PID_FILE);
    console.log('Daemon stopped.');
  } else {
    console.error(
      `Daemon did not stop within ${SHUTDOWN_TIMEOUT_MS / 1000}s. Sending SIGKILL...`
    );
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // already gone
    }
    removePidFile(PID_FILE);
    console.log('Daemon killed.');
    process.exit(1);
  }
}

async function cmdRestart(opts: {
  port?: string;
  config?: string;
  logLevel?: string;
  daemon?: boolean;
  host?: string;
}): Promise<void> {
  const pid = resolveRunningPid(PID_FILE);

  if (pid !== null) {
    console.log(`Stopping daemon (PID ${pid})...`);
    const stopped = await gracefulShutdown(pid, SHUTDOWN_TIMEOUT_MS);
    if (stopped) {
      removePidFile(PID_FILE);
      console.log('Daemon stopped.');
    } else {
      console.error('Force killing daemon...');
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // already gone
      }
      removePidFile(PID_FILE);
    }
    // Brief pause before restarting
    await new Promise(r => setTimeout(r, 1000));
  } else {
    console.log('Daemon was not running. Starting fresh...');
  }

  await cmdStart(opts);
}

async function cmdStatus(opts: {
  port?: string;
  host?: string;
}): Promise<void> {
  const pid = resolveRunningPid(PID_FILE);

  if (pid === null) {
    console.log('Status: STOPPED');
    console.log('PID file: not found or stale');
    process.exit(1);
  }

  const port = opts.port ? parseInt(opts.port, 10) : DEFAULT_PORT;
  const host = opts.host ?? DEFAULT_HOST;

  console.log(`Status: RUNNING`);
  console.log(`PID:    ${pid}`);
  console.log(`Port:   ${port}`);

  // Try to get detailed status via health endpoint
  const result = await runHealthCheck({
    host: host === '0.0.0.0' ? '127.0.0.1' : host,
    port,
    timeoutMs: 3000,
    retries: 1,
    verbose: false,
  });

  if (result.healthy && result.data) {
    const d = result.data;
    if (d.uptime !== undefined) {
      console.log(`Uptime: ${formatUptime(d.uptime as number)}`);
    }
    if (d.activeSessions !== undefined) {
      console.log(`Active sessions: ${d.activeSessions}`);
    }
    if (d.version) {
      console.log(`Version: ${d.version}`);
    }
    console.log(`Health: OK (${result.latencyMs}ms)`);
  } else {
    console.log(
      `Health: UNREACHABLE (${result.error ?? `HTTP ${result.statusCode}`})`
    );
    console.log(
      `        The process is running but HTTP endpoint is not responding.`
    );
  }
}

async function cmdHealth(opts: {
  port?: string;
  host?: string;
  json?: boolean;
  verbose?: boolean;
  timeout?: string;
  retries?: string;
}): Promise<void> {
  const port = opts.port ? parseInt(opts.port, 10) : DEFAULT_PORT;
  const host = opts.host ?? DEFAULT_HOST;
  const timeoutMs = opts.timeout ? parseInt(opts.timeout, 10) : 5000;
  const retries = opts.retries ? parseInt(opts.retries, 10) : 3;

  const result = await runHealthCheck({
    host: host === '0.0.0.0' ? '127.0.0.1' : host,
    port,
    timeoutMs,
    retries,
    verbose: opts.verbose,
    json: opts.json,
  });

  process.exit(result.healthy ? 0 : 1);
}

// ---------------------------------------------------------------------------
// CLI definition
// ---------------------------------------------------------------------------

const program = new Command();

program
  .name('orchestrator-daemon')
  .description('Wundr Orchestrator Daemon management CLI')
  .version(
    // Read version from package.json without importing the whole module
    (() => {
      try {
        const pkgPath = path.join(__dirname, '../../package.json');
        // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
        return require(pkgPath).version ?? '0.0.0';
      } catch {
        return '0.0.0';
      }
    })()
  );

// ---------------------------------------------------------------------------
// start
// ---------------------------------------------------------------------------
program
  .command('start')
  .description('Start the orchestrator daemon')
  .option('-p, --port <port>', 'WebSocket/HTTP port (default: 8787)')
  .option('--host <host>', 'Bind host (default: 127.0.0.1)')
  .option('-c, --config <path>', 'Path to wundr config file')
  .option(
    '-l, --log-level <level>',
    'Log level: debug | info | warn | error (default: info)'
  )
  .option('-d, --daemon', 'Run in background (detached process mode)', false)
  .action(cmdStart);

// ---------------------------------------------------------------------------
// stop
// ---------------------------------------------------------------------------
program
  .command('stop')
  .description('Stop the running daemon gracefully via SIGTERM')
  .action(cmdStop);

// ---------------------------------------------------------------------------
// restart
// ---------------------------------------------------------------------------
program
  .command('restart')
  .description('Stop then start the daemon')
  .option('-p, --port <port>', 'WebSocket/HTTP port (default: 8787)')
  .option('--host <host>', 'Bind host (default: 127.0.0.1)')
  .option('-c, --config <path>', 'Path to wundr config file')
  .option(
    '-l, --log-level <level>',
    'Log level: debug | info | warn | error (default: info)'
  )
  .option('-d, --daemon', 'Run in background (detached process mode)', false)
  .action(cmdRestart);

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------
program
  .command('status')
  .description('Show daemon status and health summary')
  .option('-p, --port <port>', 'Port to query health (default: 8787)')
  .option('--host <host>', 'Host to query health (default: 127.0.0.1)')
  .action(cmdStatus);

// ---------------------------------------------------------------------------
// health
// ---------------------------------------------------------------------------
program
  .command('health')
  .description('Perform a detailed health check via HTTP')
  .option('-p, --port <port>', 'Port to query (default: 8787)')
  .option('--host <host>', 'Host to query (default: 127.0.0.1)')
  .option('--json', 'Output as JSON', false)
  .option('-v, --verbose', 'Show full health response', false)
  .option('--timeout <ms>', 'Request timeout in milliseconds (default: 5000)')
  .option('--retries <n>', 'Number of retry attempts (default: 3)')
  .action(cmdHealth);

// ---------------------------------------------------------------------------
// Parse and execute
// ---------------------------------------------------------------------------
program.parseAsync(process.argv).catch(err => {
  console.error('Error:', (err as Error).message);
  process.exit(1);
});
