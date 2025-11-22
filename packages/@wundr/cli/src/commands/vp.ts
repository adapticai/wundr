/**
 * VP Daemon CLI Commands
 * Manages the Virtual Principal (VP) Daemon for agent orchestration
 */

import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as os from 'os';
import * as path from 'path';

import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import YAML from 'yaml';

// Constants
const VP_CONFIG_DIR = path.join(os.homedir(), '.wundr', 'vp-daemon');
const VP_CONFIG_FILE = path.join(VP_CONFIG_DIR, 'config.yaml');
const VP_PID_FILE = path.join(VP_CONFIG_DIR, 'daemon.pid');
const VP_LOG_FILE = path.join(VP_CONFIG_DIR, 'daemon.log');

// Types
interface VPConfig {
  daemon: {
    port: number;
    host: string;
    name: string;
    maxSessions: number;
    heartbeatInterval: number;
    shutdownTimeout: number;
  };
  identity: {
    name: string;
    email: string;
    slackHandle: string;
  };
  subsystems: {
    triage: {
      memoryBankPath: string;
      enableRAG: boolean;
    };
    intervention: {
      enabled: boolean;
      autoRollbackOnCritical: boolean;
    };
    telemetry: {
      enabled: boolean;
      flushInterval: number;
    };
  };
  safety: {
    autoApprovePatterns: string[];
    alwaysRejectPatterns: string[];
    escalationPatterns: string[];
  };
  budget: {
    dailyLimit: number;
    monthlyLimit: number;
    warningThreshold: number;
    criticalThreshold: number;
  };
}

interface DaemonStatus {
  running: boolean;
  pid?: number;
  uptime?: string;
  port?: number;
  host?: string;
  sessionCount?: number;
  queueDepth?: number;
  health?: 'healthy' | 'degraded' | 'unhealthy';
  subsystems?: Record<string, string>;
}

// Utility functions
function getDefaultConfig(): VPConfig {
  return {
    daemon: {
      port: 8787,
      host: '127.0.0.1',
      name: 'vp-daemon',
      maxSessions: 100,
      heartbeatInterval: 30000,
      shutdownTimeout: 10000,
    },
    identity: {
      name: 'Virtual Principal',
      email: 'vp@wundr.local',
      slackHandle: '@virtual-principal',
    },
    subsystems: {
      triage: {
        memoryBankPath: path.join(VP_CONFIG_DIR, 'memory-bank'),
        enableRAG: false,
      },
      intervention: {
        enabled: true,
        autoRollbackOnCritical: false,
      },
      telemetry: {
        enabled: true,
        flushInterval: 10000,
      },
    },
    safety: {
      autoApprovePatterns: ['read|cat|ls|grep|find', 'npm test|yarn test|jest'],
      alwaysRejectPatterns: ['rm\\s+-rf\\s+/', 'git\\s+push.*--force'],
      escalationPatterns: ['deploy.*prod', 'password|secret|token|api.?key'],
    },
    budget: {
      dailyLimit: 1000000,
      monthlyLimit: 20000000,
      warningThreshold: 0.8,
      criticalThreshold: 0.95,
    },
  };
}

async function loadConfig(): Promise<VPConfig> {
  try {
    if (existsSync(VP_CONFIG_FILE)) {
      const content = await fs.readFile(VP_CONFIG_FILE, 'utf-8');
      const parsed = YAML.parse(content) as Partial<VPConfig>;
      return { ...getDefaultConfig(), ...parsed };
    }
  } catch (error) {
    // Fall through to default
  }
  return getDefaultConfig();
}

async function saveConfig(config: VPConfig): Promise<void> {
  await fs.mkdir(VP_CONFIG_DIR, { recursive: true });
  await fs.writeFile(VP_CONFIG_FILE, YAML.stringify(config), 'utf-8');
}

async function ensureConfigDir(): Promise<void> {
  if (!existsSync(VP_CONFIG_DIR)) {
    await fs.mkdir(VP_CONFIG_DIR, { recursive: true });
  }
}

async function getDaemonStatus(): Promise<DaemonStatus> {
  const status: DaemonStatus = { running: false };

  try {
    if (existsSync(VP_PID_FILE)) {
      const pidContent = await fs.readFile(VP_PID_FILE, 'utf-8');
      const pid = parseInt(pidContent.trim(), 10);

      // Check if process is running
      try {
        process.kill(pid, 0);
        status.running = true;
        status.pid = pid;

        // Try to read status from socket or API
        const config = await loadConfig();
        status.port = config.daemon.port;
        status.host = config.daemon.host;

        // Read additional status info if available
        const statusFile = path.join(VP_CONFIG_DIR, 'status.json');
        if (existsSync(statusFile)) {
          const statusContent = await fs.readFile(statusFile, 'utf-8');
          const statusData = JSON.parse(statusContent);
          status.uptime = formatUptime(statusData.uptime);
          status.sessionCount = statusData.sessionCount ?? 0;
          status.queueDepth = statusData.queueDepth ?? 0;
          status.health = statusData.health ?? 'unknown';
          status.subsystems = statusData.subsystems ?? {};
        }
      } catch {
        // Process not running, clean up stale PID file
        await fs.unlink(VP_PID_FILE).catch(() => {});
      }
    }
  } catch (error) {
    // Ignore errors
  }

  return status;
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

// Create VP command
export function createVPCommand(): Command {
  const command = new Command('vp')
    .description(
      'Manage the VP (Virtual Principal) Daemon for agent orchestration',
    )
    .addHelpText(
      'after',
      chalk.gray(`
Examples:
  ${chalk.green('wundr vp start')}              Start the VP Daemon
  ${chalk.green('wundr vp start --port 9000')}  Start on custom port
  ${chalk.green('wundr vp status')}             Check daemon status
  ${chalk.green('wundr vp stop')}               Stop the daemon gracefully
  ${chalk.green('wundr vp config show')}        View current configuration
  ${chalk.green('wundr vp config set daemon.port=9000')}  Update configuration
      `),
    );

  // Start command
  command
    .command('start')
    .description('Start the VP Daemon')
    .option('-p, --port <number>', 'Port to listen on')
    .option('-c, --config <path>', 'Path to configuration file')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('--detach', 'Run daemon in background (detached mode)')
    .action(async options => {
      await startDaemon(options);
    });

  // Status command (default)
  command
    .command('status', { isDefault: true })
    .description('Check VP Daemon status')
    .option('--json', 'Output as JSON')
    .action(async options => {
      await showStatus(options);
    });

  // Stop command
  command
    .command('stop')
    .description('Stop the VP Daemon gracefully')
    .option('-f, --force', 'Force immediate termination')
    .option('-t, --timeout <ms>', 'Shutdown timeout in milliseconds', '10000')
    .action(async options => {
      await stopDaemon(options);
    });

  // Config command group
  const configCmd = command
    .command('config')
    .description('View or edit VP configuration');

  configCmd
    .command('show')
    .description('Display current configuration')
    .option('--json', 'Output as JSON instead of YAML')
    .action(async options => {
      await showConfig(options);
    });

  configCmd
    .command('set <key=value>')
    .description('Set a configuration value (e.g., daemon.port=9000)')
    .action(async keyValue => {
      await setConfig(keyValue);
    });

  configCmd
    .command('reset')
    .description('Reset configuration to defaults')
    .option('--force', 'Skip confirmation')
    .action(async options => {
      await resetConfig(options);
    });

  // Logs command
  command
    .command('logs')
    .description('View VP Daemon logs')
    .option('-f, --follow', 'Follow log output')
    .option('-n, --lines <number>', 'Number of lines to show', '50')
    .action(async options => {
      await viewLogs(options);
    });

  return command;
}

// Command implementations
async function startDaemon(options: {
  port?: string;
  config?: string;
  verbose?: boolean;
  detach?: boolean;
}): Promise<void> {
  const spinner = ora('Starting VP Daemon...').start();

  try {
    await ensureConfigDir();

    // Check if already running
    const currentStatus = await getDaemonStatus();
    if (currentStatus.running) {
      spinner.fail(
        `VP Daemon is already running (PID: ${currentStatus.pid}, port: ${currentStatus.port})`,
      );
      return;
    }

    // Load configuration
    let config: VPConfig;
    if (options.config && existsSync(options.config)) {
      const content = await fs.readFile(options.config, 'utf-8');
      config = { ...getDefaultConfig(), ...YAML.parse(content) };
      spinner.text = `Loading config from ${options.config}...`;
    } else {
      config = await loadConfig();
    }

    // Apply CLI overrides
    if (options.port) {
      config.daemon.port = parseInt(options.port, 10);
    }

    // Save current config for daemon use
    await saveConfig(config);

    spinner.text = 'Initializing VP Daemon subsystems...';

    // Dynamically import VPDaemon at runtime to avoid TypeScript rootDir issues
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let daemon: any;
    try {
      // Use require for CommonJS compatibility or dynamic import for ESM
      const daemonModulePath = require
        .resolve('@wundr/vp-daemon')
        .replace(/\.js$/, '');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const daemonModule = require(daemonModulePath);
      const VPDaemon = daemonModule.VPDaemon || daemonModule.default?.VPDaemon;

      if (!VPDaemon) {
        throw new Error('VPDaemon class not found in module');
      }

      daemon = new VPDaemon({
        name: config.daemon.name,
        port: config.daemon.port,
        host: config.daemon.host,
        maxSessions: config.daemon.maxSessions,
        heartbeatInterval: config.daemon.heartbeatInterval,
        shutdownTimeout: config.daemon.shutdownTimeout,
        verbose: options.verbose ?? false,
      });
    } catch (importError) {
      // Fallback: try to spawn the daemon as a subprocess
      spinner.fail('Failed to load VP Daemon module');
      console.error(chalk.red('\nThe VP Daemon module could not be loaded.'));
      console.error(chalk.gray('Options to resolve:'));
      console.error(chalk.white('  1. Install: npm install @wundr/vp-daemon'));
      console.error(
        chalk.white(
          '  2. Or build from source: cd scripts/vp-daemon && npm run build',
        ),
      );
      console.error(
        chalk.gray(
          `\nError: ${importError instanceof Error ? importError.message : String(importError)}`,
        ),
      );
      return;
    }

    // Write PID file
    await fs.writeFile(VP_PID_FILE, String(process.pid));

    // Set up status updates
    const updateStatus = () => {
      const status = daemon.getStatus();
      const statusData = {
        uptime: status.uptime,
        sessionCount: status.metrics?.activeSessions ?? 0,
        queueDepth: 0,
        health: status.status,
        subsystems: Object.fromEntries(
          Object.entries(status.subsystems ?? {}).map(
            ([k, v]: [string, unknown]) => [
              k,
              (v as { status?: string })?.status ?? 'unknown',
            ],
          ),
        ),
      };
      fs.writeFile(
        path.join(VP_CONFIG_DIR, 'status.json'),
        JSON.stringify(statusData, null, 2),
      ).catch(() => {});
    };

    daemon.on('healthCheck', updateStatus);

    // Set up cleanup handlers
    const cleanup = async () => {
      await fs.unlink(VP_PID_FILE).catch(() => {});
      await fs.unlink(path.join(VP_CONFIG_DIR, 'status.json')).catch(() => {});
    };

    daemon.on('stopped', cleanup);

    // Start daemon
    await daemon.start();

    spinner.succeed(
      `VP Daemon started successfully on ${config.daemon.host}:${config.daemon.port}`,
    );

    console.log(chalk.gray('\nDaemon Information:'));
    console.log(chalk.white(`  PID:      ${process.pid}`));
    console.log(chalk.white(`  Port:     ${config.daemon.port}`));
    console.log(chalk.white(`  Host:     ${config.daemon.host}`));
    console.log(chalk.white(`  Config:   ${VP_CONFIG_FILE}`));
    console.log(chalk.white(`  Logs:     ${VP_LOG_FILE}`));

    if (options.verbose) {
      console.log(chalk.gray('\nVerbose mode enabled - showing detailed logs'));
    }

    console.log(chalk.green('\nPress Ctrl+C to stop the daemon.\n'));

    // Keep process running
    if (!options.detach) {
      await new Promise<void>(resolve => {
        daemon.on('stopped', resolve);
      });
    }
  } catch (error) {
    spinner.fail('Failed to start VP Daemon');
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error)),
    );
  }
}

async function showStatus(options: { json?: boolean }): Promise<void> {
  const spinner = ora('Checking VP Daemon status...').start();

  try {
    const status = await getDaemonStatus();
    const config = await loadConfig();

    spinner.stop();

    if (options.json) {
      console.log(
        JSON.stringify(
          {
            ...status,
            config: {
              port: config.daemon.port,
              host: config.daemon.host,
              maxSessions: config.daemon.maxSessions,
            },
          },
          null,
          2,
        ),
      );
      return;
    }

    console.log(chalk.cyan('\nVP Daemon Status\n'));
    console.log(chalk.gray('='.repeat(50)));

    if (status.running) {
      console.log(chalk.green('Status:       RUNNING'));
      console.log(chalk.white(`PID:          ${status.pid}`));
      console.log(chalk.white(`Host:         ${status.host}:${status.port}`));

      if (status.uptime) {
        console.log(chalk.white(`Uptime:       ${status.uptime}`));
      }

      if (status.sessionCount !== undefined) {
        console.log(chalk.white(`Sessions:     ${status.sessionCount}`));
      }

      if (status.queueDepth !== undefined) {
        console.log(chalk.white(`Queue Depth:  ${status.queueDepth}`));
      }

      if (status.health) {
        const healthColor =
          status.health === 'healthy'
            ? chalk.green
            : status.health === 'degraded'
              ? chalk.yellow
              : chalk.red;
        console.log(
          healthColor(`Health:       ${status.health.toUpperCase()}`),
        );
      }

      if (status.subsystems && Object.keys(status.subsystems).length > 0) {
        console.log(chalk.gray('\nSubsystems:'));
        for (const [name, state] of Object.entries(status.subsystems)) {
          const stateColor =
            state === 'running'
              ? chalk.green
              : state === 'error'
                ? chalk.red
                : chalk.yellow;
          console.log(`  ${chalk.white(name.padEnd(15))} ${stateColor(state)}`);
        }
      }
    } else {
      console.log(chalk.yellow('Status:       STOPPED'));
      console.log(chalk.gray('\nDaemon is not running.'));
      console.log(chalk.gray('Start it with: wundr vp start'));
    }

    console.log(chalk.gray('\n' + '='.repeat(50)));
    console.log(chalk.gray(`Config: ${VP_CONFIG_FILE}`));
    console.log('');
  } catch (error) {
    spinner.fail('Failed to get daemon status');
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error)),
    );
  }
}

async function stopDaemon(options: {
  force?: boolean;
  timeout?: string;
}): Promise<void> {
  const spinner = ora('Stopping VP Daemon...').start();

  try {
    const status = await getDaemonStatus();

    if (!status.running || !status.pid) {
      spinner.info('VP Daemon is not running');
      return;
    }

    const pid = status.pid;
    const timeout = parseInt(options.timeout ?? '10000', 10);

    if (options.force) {
      spinner.text = 'Force stopping daemon...';
      process.kill(pid, 'SIGKILL');
      await fs.unlink(VP_PID_FILE).catch(() => {});
      await fs.unlink(path.join(VP_CONFIG_DIR, 'status.json')).catch(() => {});
      spinner.succeed('VP Daemon force stopped');
      return;
    }

    // Send SIGTERM for graceful shutdown
    spinner.text = `Sending shutdown signal (timeout: ${timeout}ms)...`;
    process.kill(pid, 'SIGTERM');

    // Wait for process to exit
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      try {
        process.kill(pid, 0);
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch {
        // Process exited
        await fs.unlink(VP_PID_FILE).catch(() => {});
        await fs
          .unlink(path.join(VP_CONFIG_DIR, 'status.json'))
          .catch(() => {});
        spinner.succeed('VP Daemon stopped gracefully');
        return;
      }
    }

    // Timeout reached, force kill
    spinner.text = 'Graceful shutdown timed out, forcing stop...';
    process.kill(pid, 'SIGKILL');
    await fs.unlink(VP_PID_FILE).catch(() => {});
    await fs.unlink(path.join(VP_CONFIG_DIR, 'status.json')).catch(() => {});
    spinner.warn('VP Daemon stopped (forced after timeout)');
  } catch (error) {
    spinner.fail('Failed to stop VP Daemon');
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error)),
    );
  }
}

async function showConfig(options: { json?: boolean }): Promise<void> {
  try {
    const config = await loadConfig();

    console.log(chalk.cyan('\nVP Daemon Configuration\n'));
    console.log(chalk.gray(`File: ${VP_CONFIG_FILE}`));
    console.log(chalk.gray('='.repeat(50) + '\n'));

    if (options.json) {
      console.log(JSON.stringify(config, null, 2));
    } else {
      console.log(YAML.stringify(config));
    }
  } catch (error) {
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error)),
    );
  }
}

async function setConfig(keyValue: string): Promise<void> {
  try {
    const [keyPath, ...valueParts] = keyValue.split('=');
    const valueStr = valueParts.join('=');

    if (!keyPath || valueStr === undefined) {
      console.error(
        chalk.red('Invalid format. Use: wundr vp config set <key>=<value>'),
      );
      console.error(
        chalk.gray('Example: wundr vp config set daemon.port=9000'),
      );
      return;
    }

    const config = await loadConfig();
    const keys = keyPath.split('.');

    // Navigate to parent object
    let obj: Record<string, unknown> = config as unknown as Record<
      string,
      unknown
    >;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (key && typeof obj[key] === 'object' && obj[key] !== null) {
        obj = obj[key] as Record<string, unknown>;
      } else {
        console.error(chalk.red(`Invalid key path: ${keyPath}`));
        return;
      }
    }

    const lastKey = keys[keys.length - 1];
    if (!lastKey) {
      console.error(chalk.red('Invalid key path'));
      return;
    }

    // Parse and set value
    let value: unknown;
    try {
      value = JSON.parse(valueStr);
    } catch {
      value = valueStr;
    }

    const oldValue = obj[lastKey];
    obj[lastKey] = value;

    await saveConfig(config);

    console.log(chalk.green('Configuration updated:'));
    console.log(
      chalk.white(
        `  ${keyPath}: ${JSON.stringify(oldValue)} -> ${JSON.stringify(value)}`,
      ),
    );
    console.log(chalk.gray('\nRestart the daemon for changes to take effect.'));
  } catch (error) {
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error)),
    );
  }
}

async function resetConfig(options: { force?: boolean }): Promise<void> {
  try {
    if (!options.force) {
      // Dynamic import for inquirer
      const inquirer = await import('inquirer');
      const answers = await inquirer.default.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Reset VP Daemon configuration to defaults?',
          default: false,
        },
      ]);

      if (!answers.confirm) {
        console.log(chalk.yellow('Cancelled.'));
        return;
      }
    }

    const config = getDefaultConfig();
    await saveConfig(config);

    console.log(chalk.green('Configuration reset to defaults.'));
    console.log(chalk.gray(`Saved to: ${VP_CONFIG_FILE}`));
  } catch (error) {
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error)),
    );
  }
}

async function viewLogs(options: {
  follow?: boolean;
  lines?: string;
}): Promise<void> {
  const lines = parseInt(options.lines ?? '50', 10);

  if (!existsSync(VP_LOG_FILE)) {
    console.log(chalk.yellow('No log file found.'));
    console.log(chalk.gray(`Expected location: ${VP_LOG_FILE}`));
    console.log(
      chalk.gray('Start the daemon with --verbose to enable logging.'),
    );
    return;
  }

  try {
    if (options.follow) {
      console.log(chalk.cyan(`Following logs from ${VP_LOG_FILE}...`));
      console.log(chalk.gray('Press Ctrl+C to stop.\n'));

      const { spawn } = await import('child_process');
      const tail = spawn('tail', ['-f', '-n', String(lines), VP_LOG_FILE], {
        stdio: 'inherit',
      });

      await new Promise<void>(resolve => {
        process.on('SIGINT', () => {
          tail.kill();
          resolve();
        });
        tail.on('close', () => resolve());
      });
    } else {
      const content = await fs.readFile(VP_LOG_FILE, 'utf-8');
      const logLines = content.split('\n');
      const lastLines = logLines.slice(-lines).join('\n');

      console.log(chalk.cyan(`Last ${lines} lines from ${VP_LOG_FILE}:\n`));
      console.log(lastLines);
    }
  } catch (error) {
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error)),
    );
  }
}
