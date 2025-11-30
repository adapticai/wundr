#!/usr/bin/env tsx
/**
 * Interactive WebSocket Test Client
 *
 * Simple WebSocket client for manual testing of the orchestrator daemon.
 * Can send arbitrary messages and pretty-prints responses.
 *
 * Usage:
 *   npx tsx scripts/test-websocket.ts
 *   npx tsx scripts/test-websocket.ts --port 8787
 *   npx tsx scripts/test-websocket.ts --host 127.0.0.1 --port 8787
 */

import * as readline from 'readline';
import * as WebSocket from 'ws';
import type { WSMessage, WSResponse } from '../src/types';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

// Parse command line arguments
const args = process.argv.slice(2);
let host = '127.0.0.1';
let port = 8787;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--host' && i + 1 < args.length) {
    host = args[i + 1];
    i++;
  } else if (args[i] === '--port' && i + 1 < args.length) {
    port = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log('Usage: npx tsx scripts/test-websocket.ts [options]');
    console.log('Options:');
    console.log('  --host <host>  WebSocket server host (default: 127.0.0.1)');
    console.log('  --port <port>  WebSocket server port (default: 8787)');
    console.log('  --help, -h     Show this help message');
    process.exit(0);
  }
}

const wsUrl = `ws://${host}:${port}`;

// Connection state
let ws: WebSocket | null = null;
let sessionId: string | null = null;

// Utility functions
function log(message: string, color = colors.reset): void {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message: string): void {
  log(`✓ ${message}`, colors.green);
}

function logError(message: string): void {
  log(`✗ ${message}`, colors.red);
}

function logInfo(message: string): void {
  log(`ℹ ${message}`, colors.blue);
}

function logWarning(message: string): void {
  log(`⚠ ${message}`, colors.yellow);
}

function formatJson(obj: unknown): string {
  return JSON.stringify(obj, null, 2)
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
}

// WebSocket connection
function connect(): Promise<void> {
  return new Promise((resolve, reject) => {
    logInfo(`Connecting to ${wsUrl}...`);

    ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      logSuccess('Connected!');
      logInfo('Type "help" for available commands\n');
      resolve();
    });

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const response = JSON.parse(data.toString()) as WSResponse;
        handleResponse(response);
      } catch (error) {
        logError(`Failed to parse message: ${error}`);
      }
    });

    ws.on('close', (code: number, reason: Buffer) => {
      logWarning(`Connection closed: ${code} ${reason.toString()}`);
      ws = null;
    });

    ws.on('error', (error: Error) => {
      logError(`WebSocket error: ${error.message}`);
      reject(error);
    });

    // Connection timeout
    setTimeout(() => {
      if (ws?.readyState !== WebSocket.OPEN) {
        reject(new Error('Connection timeout'));
      }
    }, 5000);
  });
}

// Handle incoming messages
function handleResponse(response: WSResponse): void {
  log('\n← Received:', colors.cyan);

  switch (response.type) {
    case 'health_check_response':
      log(formatJson({ type: response.type, healthy: response.healthy }), colors.cyan);
      break;

    case 'daemon_status_update':
      log(formatJson({ type: response.type, status: response.status }), colors.cyan);
      break;

    case 'session_spawned':
      sessionId = response.session.id;
      logSuccess(`Session spawned: ${sessionId}`);
      log(formatJson(response.session), colors.cyan);
      break;

    case 'session_status_update':
      log(formatJson({ type: response.type, session: response.session }), colors.cyan);
      break;

    case 'stream_start':
      logInfo(`Stream started for session: ${response.sessionId}`);
      break;

    case 'stream_chunk':
      process.stdout.write(colors.magenta + response.data.chunk + colors.reset);
      break;

    case 'stream_end':
      console.log(); // New line
      logInfo(`Stream ended for session: ${response.sessionId}`);
      break;

    case 'tool_call_start':
      logInfo(`Tool call started: ${response.data.toolName}`);
      log(formatJson(response.data), colors.cyan);
      break;

    case 'tool_call_result':
      logInfo(`Tool call completed: ${response.data.toolName}`);
      log(formatJson(response.data), colors.cyan);
      break;

    case 'task_executing':
      logInfo(`Task executing: ${response.taskId}`);
      break;

    case 'task_completed':
      logSuccess(`Task completed: ${response.taskId}`);
      if (response.result) {
        log(formatJson(response.result), colors.cyan);
      }
      break;

    case 'task_failed':
      logError(`Task failed: ${response.taskId}`);
      logError(`Error: ${response.error}`);
      break;

    case 'error':
      logError(`Error: ${response.error}`);
      if (response.sessionId) {
        logError(`Session: ${response.sessionId}`);
      }
      break;

    default:
      log(formatJson(response), colors.cyan);
  }

  console.log(); // Blank line
}

// Send message
function sendMessage(message: WSMessage): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    logError('Not connected to WebSocket server');
    return;
  }

  log('→ Sending:', colors.yellow);
  log(formatJson(message), colors.yellow);
  ws.send(JSON.stringify(message));
}

// Command handlers
const commands: Record<string, () => void> = {
  help: () => {
    console.log('\nAvailable commands:');
    console.log('  help              - Show this help message');
    console.log('  ping              - Send ping message');
    console.log('  health            - Request health check');
    console.log('  status            - Request daemon status');
    console.log('  spawn             - Spawn a test session');
    console.log('  execute           - Execute task (uses last spawned session)');
    console.log('  stop              - Stop session (uses last spawned session)');
    console.log('  session <id>      - Get session status');
    console.log('  custom <json>     - Send custom JSON message');
    console.log('  clear             - Clear screen');
    console.log('  exit, quit        - Exit the client');
    console.log();
  },

  ping: () => {
    sendMessage({ type: 'ping' });
  },

  health: () => {
    sendMessage({ type: 'health_check' });
  },

  status: () => {
    sendMessage({ type: 'daemon_status' });
  },

  spawn: () => {
    sendMessage({
      type: 'spawn_session',
      payload: {
        orchestratorId: 'test-client',
        task: {
          type: 'custom',
          description: 'Interactive test task from WebSocket client',
          priority: 'medium',
          status: 'pending',
        },
        sessionType: 'claude-code',
      },
    });
  },

  execute: () => {
    if (!sessionId) {
      logError('No active session. Use "spawn" command first.');
      return;
    }

    logInfo('Executing test task...');
    sendMessage({
      type: 'execute_task',
      payload: {
        sessionId,
        task: 'Say hello and briefly describe your capabilities. Be concise.',
        streamResponse: true,
      },
    });
  },

  stop: () => {
    if (!sessionId) {
      logError('No active session. Use "spawn" command first.');
      return;
    }

    sendMessage({
      type: 'stop_session',
      payload: { sessionId },
    });
  },

  clear: () => {
    console.clear();
    logInfo('Type "help" for available commands\n');
  },
};

// Process user input
function processCommand(input: string): void {
  const trimmed = input.trim();
  if (!trimmed) return;

  const [cmd, ...args] = trimmed.split(' ');
  const command = cmd.toLowerCase();

  if (command === 'exit' || command === 'quit') {
    logInfo('Goodbye!');
    process.exit(0);
  }

  if (command === 'session' && args.length > 0) {
    sendMessage({
      type: 'session_status',
      payload: { sessionId: args[0] },
    });
    return;
  }

  if (command === 'custom' && args.length > 0) {
    try {
      const json = JSON.parse(args.join(' '));
      sendMessage(json);
    } catch (error) {
      logError(`Invalid JSON: ${error}`);
    }
    return;
  }

  if (commands[command]) {
    commands[command]();
  } else {
    logError(`Unknown command: ${command}`);
    logInfo('Type "help" for available commands');
  }
}

// Interactive prompt
function startPrompt(): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${colors.green}ws>${colors.reset} `,
  });

  rl.prompt();

  rl.on('line', (line) => {
    processCommand(line);
    rl.prompt();
  });

  rl.on('close', () => {
    logInfo('\nGoodbye!');
    process.exit(0);
  });
}

// Print banner
function printBanner(): void {
  console.clear();
  log('='.repeat(60), colors.bright);
  log('Orchestrator Daemon WebSocket Test Client', colors.bright);
  log('='.repeat(60), colors.bright);
  log(`Target: ${wsUrl}`, colors.dim);
  log('='.repeat(60) + '\n', colors.bright);
}

// Main
async function main(): Promise<void> {
  printBanner();

  try {
    await connect();
    startPrompt();
  } catch (error) {
    logError(`Failed to connect: ${(error as Error).message}`);
    logInfo('Make sure the orchestrator daemon is running');
    logInfo(`  npm run start:dev`);
    process.exit(1);
  }
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log(); // New line
  logInfo('Goodbye!');
  process.exit(0);
});

// Run
main();
