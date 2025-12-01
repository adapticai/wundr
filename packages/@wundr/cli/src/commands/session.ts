/**
 * Session Management CLI Commands
 * Manages coding agent sessions including listing, pausing, resuming, and killing sessions.
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';

// Constants
const SESSIONS_BASE_DIR = path.join(os.homedir(), '.wundr', 'sessions');
const SESSIONS_STATE_FILE = path.join(SESSIONS_BASE_DIR, 'state.json');

// Types
export type SessionStatus =
  | 'active'
  | 'paused'
  | 'completed'
  | 'error'
  | 'terminated';

export interface AgentSession {
  sessionId: string;
  status: SessionStatus;
  startedAt: string;
  pausedAt?: string;
  slotId: string;
  worktreePath: string;
  memoryBankPath?: string;
  subAgents?: SubAgentInfo[];
  taskDescription?: string;
  lastActivity?: string;
  metrics?: SessionMetrics;
}

export interface SubAgentInfo {
  agentId: string;
  type: string;
  status: 'active' | 'idle' | 'terminated';
  taskCount: number;
  lastActivity?: string;
}

export interface SessionMetrics {
  tasksCompleted: number;
  tasksTotal: number;
  tokensUsed: number;
  duration: number;
  errors: number;
}

export interface SessionsState {
  version: string;
  lastUpdated: string;
  sessions: AgentSession[];
}

// Utility functions
function getTimestamp(): string {
  return new Date().toISOString();
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function padRight(str: string, length: number): string {
  return str.length >= length
    ? str.substring(0, length)
    : str + ' '.repeat(length - str.length);
}

function truncate(str: string, length: number): string {
  if (str.length <= length) {
    return str;
  }
  return str.substring(0, length - 3) + '...';
}

async function ensureSessionsDir(): Promise<void> {
  await fs.mkdir(SESSIONS_BASE_DIR, { recursive: true });
}

async function loadSessionsState(): Promise<SessionsState> {
  try {
    await ensureSessionsDir();
    const content = await fs.readFile(SESSIONS_STATE_FILE, 'utf-8');
    return JSON.parse(content) as SessionsState;
  } catch {
    // Return empty state if file doesn't exist
    return {
      version: '1.0.0',
      lastUpdated: getTimestamp(),
      sessions: [],
    };
  }
}

async function saveSessionsState(state: SessionsState): Promise<void> {
  await ensureSessionsDir();
  state.lastUpdated = getTimestamp();
  await fs.writeFile(SESSIONS_STATE_FILE, JSON.stringify(state, null, 2));
}

function getStatusColor(status: SessionStatus): (str: string) => string {
  switch (status) {
    case 'active':
      return chalk.green;
    case 'paused':
      return chalk.yellow;
    case 'completed':
      return chalk.blue;
    case 'error':
      return chalk.red;
    case 'terminated':
      return chalk.gray;
    default:
      return chalk.white;
  }
}

function getStatusIcon(status: SessionStatus): string {
  switch (status) {
    case 'active':
      return '[ACTIVE]';
    case 'paused':
      return '[PAUSED]';
    case 'completed':
      return '[DONE]';
    case 'error':
      return '[ERROR]';
    case 'terminated':
      return '[KILLED]';
    default:
      return '[UNKNOWN]';
  }
}

// Create session command
export function createSessionCommand(): Command {
  const command = new Command('session')
    .description('Manage coding agent sessions')
    .addHelpText(
      'after',
      chalk.gray(`
Examples:
  ${chalk.green('wundr session list')}              List all active sessions
  ${chalk.green('wundr session list --all')}        List all sessions including completed
  ${chalk.green('wundr session info <sessionId>')}  Get detailed session information
  ${chalk.green('wundr session pause <sessionId>')} Pause a running session
  ${chalk.green('wundr session resume <sessionId>')}Resume a paused session
  ${chalk.green('wundr session kill <sessionId>')}  Terminate a session
      `)
    );

  // List command (default)
  command
    .command('list', { isDefault: true })
    .description('List sessions')
    .option('-a, --all', 'Show all sessions including completed and terminated')
    .option(
      '-s, --status <status>',
      'Filter by status (active, paused, completed, error, terminated)'
    )
    .option('-f, --format <format>', 'Output format (table, json)', 'table')
    .action(async options => {
      await listSessions(options);
    });

  // Info command
  command
    .command('info <sessionId>')
    .description('Get detailed information about a session')
    .option('-f, --format <format>', 'Output format (table, json)', 'table')
    .action(async (sessionId, options) => {
      await showSessionInfo(sessionId, options);
    });

  // Pause command
  command
    .command('pause <sessionId>')
    .description('Pause a running session')
    .action(async sessionId => {
      await pauseSession(sessionId);
    });

  // Resume command
  command
    .command('resume <sessionId>')
    .description('Resume a paused session')
    .action(async sessionId => {
      await resumeSession(sessionId);
    });

  // Kill command
  command
    .command('kill <sessionId>')
    .description('Terminate a session')
    .option('--force', 'Force termination without confirmation')
    .action(async (sessionId, options) => {
      await killSession(sessionId, options);
    });

  return command;
}

// Command implementations
async function listSessions(options: {
  all?: boolean;
  status?: SessionStatus;
  format?: 'table' | 'json';
}): Promise<void> {
  const spinner = ora('Loading sessions...').start();

  try {
    const state = await loadSessionsState();
    let sessions = state.sessions;

    // Filter by status if provided
    if (options.status) {
      sessions = sessions.filter(s => s.status === options.status);
    } else if (!options.all) {
      // By default, only show active and paused sessions
      sessions = sessions.filter(
        s => s.status === 'active' || s.status === 'paused'
      );
    }

    spinner.stop();

    if (options.format === 'json') {
      console.log(
        JSON.stringify(
          {
            timestamp: getTimestamp(),
            count: sessions.length,
            sessions: sessions,
          },
          null,
          2
        )
      );
      return;
    }

    console.log(chalk.cyan('\nSession List'));
    console.log(chalk.gray('='.repeat(100)));

    if (sessions.length === 0) {
      console.log(chalk.yellow('\nNo sessions found.'));
      if (!options.all && !options.status) {
        console.log(
          chalk.gray('Use --all to show completed and terminated sessions.')
        );
      }
      console.log('');
      return;
    }

    // Table header
    console.log(
      chalk.cyan(
        padRight('Session ID', 20) +
          padRight('Status', 12) +
          padRight('Started At', 22) +
          padRight('Slot ID', 10) +
          padRight('Worktree Path', 36)
      )
    );
    console.log(chalk.gray('-'.repeat(100)));

    // Table rows
    for (const session of sessions) {
      const statusColor = getStatusColor(session.status);
      const startedAt = new Date(session.startedAt).toLocaleString();
      const worktreePath = truncate(session.worktreePath, 34);

      console.log(
        padRight(session.sessionId, 20) +
          statusColor(padRight(getStatusIcon(session.status), 12)) +
          padRight(startedAt, 22) +
          padRight(session.slotId, 10) +
          chalk.gray(padRight(worktreePath, 36))
      );
    }

    console.log(chalk.gray('-'.repeat(100)));
    console.log(chalk.gray(`Total: ${sessions.length} session(s)`));
    console.log('');
  } catch (error) {
    spinner.fail('Failed to load sessions');
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error))
    );
  }
}

async function showSessionInfo(
  sessionId: string,
  options: { format?: 'table' | 'json' }
): Promise<void> {
  const spinner = ora(`Loading session ${sessionId}...`).start();

  try {
    const state = await loadSessionsState();
    const session = state.sessions.find(s => s.sessionId === sessionId);

    if (!session) {
      spinner.fail(`Session not found: ${sessionId}`);
      return;
    }

    spinner.stop();

    if (options.format === 'json') {
      console.log(JSON.stringify(session, null, 2));
      return;
    }

    console.log(chalk.cyan('\nSession Details'));
    console.log(chalk.gray('='.repeat(60)));

    // Basic info
    const statusColor = getStatusColor(session.status);
    console.log(
      chalk.white('Session ID:    ') + chalk.green(session.sessionId)
    );
    console.log(
      chalk.white('Status:        ') +
        statusColor(getStatusIcon(session.status))
    );
    console.log(chalk.white('Slot ID:       ') + session.slotId);
    console.log(
      chalk.white('Worktree Path: ') + chalk.gray(session.worktreePath)
    );
    console.log(
      chalk.white('Started At:    ') +
        new Date(session.startedAt).toLocaleString()
    );

    if (session.pausedAt) {
      console.log(
        chalk.white('Paused At:     ') +
          new Date(session.pausedAt).toLocaleString()
      );
    }

    if (session.lastActivity) {
      console.log(
        chalk.white('Last Activity: ') +
          new Date(session.lastActivity).toLocaleString()
      );
    }

    if (session.taskDescription) {
      console.log(chalk.white('Task:          ') + session.taskDescription);
    }

    // Memory bank status
    console.log(chalk.gray('\n' + '-'.repeat(60)));
    console.log(chalk.cyan('Memory Bank Status'));

    if (session.memoryBankPath) {
      console.log(chalk.white('Path: ') + chalk.gray(session.memoryBankPath));
      // Check if memory bank exists
      try {
        await fs.access(session.memoryBankPath);
        console.log(chalk.white('Status: ') + chalk.green('[AVAILABLE]'));
      } catch {
        console.log(chalk.white('Status: ') + chalk.yellow('[NOT FOUND]'));
      }
    } else {
      console.log(chalk.gray('No memory bank configured.'));
    }

    // Sub-agents
    console.log(chalk.gray('\n' + '-'.repeat(60)));
    console.log(chalk.cyan('Sub-Agents'));

    if (session.subAgents && session.subAgents.length > 0) {
      console.log(
        chalk.cyan(
          padRight('Agent ID', 15) +
            padRight('Type', 15) +
            padRight('Status', 12) +
            padRight('Tasks', 8)
        )
      );
      console.log(chalk.gray('-'.repeat(50)));

      for (const agent of session.subAgents) {
        const agentStatusColor =
          agent.status === 'active'
            ? chalk.green
            : agent.status === 'idle'
              ? chalk.yellow
              : chalk.gray;
        console.log(
          padRight(agent.agentId, 15) +
            padRight(agent.type, 15) +
            agentStatusColor(padRight(`[${agent.status.toUpperCase()}]`, 12)) +
            padRight(String(agent.taskCount), 8)
        );
      }
    } else {
      console.log(chalk.gray('No sub-agents spawned.'));
    }

    // Metrics
    if (session.metrics) {
      console.log(chalk.gray('\n' + '-'.repeat(60)));
      console.log(chalk.cyan('Session Metrics'));
      console.log(
        chalk.white('Tasks:    ') +
          `${session.metrics.tasksCompleted}/${session.metrics.tasksTotal}`
      );
      console.log(
        chalk.white('Duration: ') + formatDuration(session.metrics.duration)
      );
      console.log(
        chalk.white('Tokens:   ') + session.metrics.tokensUsed.toLocaleString()
      );
      console.log(
        chalk.white('Errors:   ') +
          (session.metrics.errors > 0 ? chalk.red(session.metrics.errors) : '0')
      );
    }

    console.log(chalk.gray('='.repeat(60)));
    console.log('');
  } catch (error) {
    spinner.fail('Failed to load session info');
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error))
    );
  }
}

async function pauseSession(sessionId: string): Promise<void> {
  const spinner = ora(`Pausing session ${sessionId}...`).start();

  try {
    const state = await loadSessionsState();
    const sessionIndex = state.sessions.findIndex(
      s => s.sessionId === sessionId
    );

    if (sessionIndex === -1) {
      spinner.fail(`Session not found: ${sessionId}`);
      return;
    }

    const session = state.sessions[sessionIndex];

    if (!session) {
      spinner.fail(`Session not found: ${sessionId}`);
      return;
    }

    if (session.status !== 'active') {
      spinner.fail(`Cannot pause session with status: ${session.status}`);
      console.log(chalk.yellow('Only active sessions can be paused.'));
      return;
    }

    // Update session status
    session.status = 'paused';
    session.pausedAt = getTimestamp();
    session.lastActivity = getTimestamp();

    await saveSessionsState(state);

    spinner.succeed(`Session paused: ${sessionId}`);
    console.log(
      chalk.gray('Use "wundr session resume ' + sessionId + '" to resume.')
    );
    console.log('');
  } catch (error) {
    spinner.fail('Failed to pause session');
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error))
    );
  }
}

async function resumeSession(sessionId: string): Promise<void> {
  const spinner = ora(`Resuming session ${sessionId}...`).start();

  try {
    const state = await loadSessionsState();
    const sessionIndex = state.sessions.findIndex(
      s => s.sessionId === sessionId
    );

    if (sessionIndex === -1) {
      spinner.fail(`Session not found: ${sessionId}`);
      return;
    }

    const session = state.sessions[sessionIndex];

    if (!session) {
      spinner.fail(`Session not found: ${sessionId}`);
      return;
    }

    if (session.status !== 'paused') {
      spinner.fail(`Cannot resume session with status: ${session.status}`);
      console.log(chalk.yellow('Only paused sessions can be resumed.'));
      return;
    }

    // Update session status
    session.status = 'active';
    session.pausedAt = undefined;
    session.lastActivity = getTimestamp();

    await saveSessionsState(state);

    spinner.succeed(`Session resumed: ${sessionId}`);
    console.log(chalk.green('Session is now active.'));
    console.log('');
  } catch (error) {
    spinner.fail('Failed to resume session');
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error))
    );
  }
}

async function killSession(
  sessionId: string,
  options: { force?: boolean }
): Promise<void> {
  const spinner = ora(`Terminating session ${sessionId}...`).start();

  try {
    const state = await loadSessionsState();
    const sessionIndex = state.sessions.findIndex(
      s => s.sessionId === sessionId
    );

    if (sessionIndex === -1) {
      spinner.fail(`Session not found: ${sessionId}`);
      return;
    }

    const session = state.sessions[sessionIndex];

    if (!session) {
      spinner.fail(`Session not found: ${sessionId}`);
      return;
    }

    if (session.status === 'terminated' || session.status === 'completed') {
      spinner.fail(`Session already ${session.status}: ${sessionId}`);
      return;
    }

    // Confirm if not forced
    if (!options.force) {
      spinner.stop();
      const inquirer = await import('inquirer');
      const answers = await inquirer.default.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to terminate session "${sessionId}"? This cannot be undone.`,
          default: false,
        },
      ]);

      if (!answers.confirm) {
        console.log(chalk.yellow('Cancelled.'));
        return;
      }
      spinner.start();
    }

    // Update session status
    session.status = 'terminated';
    session.lastActivity = getTimestamp();

    // Terminate sub-agents
    if (session.subAgents) {
      for (const agent of session.subAgents) {
        agent.status = 'terminated';
      }
    }

    await saveSessionsState(state);

    spinner.succeed(`Session terminated: ${sessionId}`);

    // Show cleanup info
    console.log(chalk.gray('\nCleanup completed:'));
    if (session.subAgents && session.subAgents.length > 0) {
      console.log(
        chalk.gray(`  - Terminated ${session.subAgents.length} sub-agent(s)`)
      );
    }
    if (session.memoryBankPath) {
      console.log(
        chalk.gray(`  - Memory bank preserved at: ${session.memoryBankPath}`)
      );
    }
    console.log('');
  } catch (error) {
    spinner.fail('Failed to terminate session');
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error))
    );
  }
}

// Export for registration
export default createSessionCommand;
