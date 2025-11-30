#!/usr/bin/env tsx
/**
 * E2E Integration Test Script
 *
 * This script verifies the full E2E flow of the orchestrator daemon:
 * 1. Start daemon programmatically
 * 2. Connect via WebSocket
 * 3. Test health check
 * 4. Test daemon status
 * 5. Spawn session with simple task
 * 6. Execute task (calls OpenAI)
 * 7. Verify LLM response
 * 8. Stop session
 * 9. Cleanup and exit
 */

import * as WebSocket from 'ws';
import { OrchestratorDaemon } from '../src/core/orchestrator-daemon';
import type { DaemonConfig, WSMessage, WSResponse } from '../src/types';

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Test configuration
const TEST_CONFIG: DaemonConfig = {
  name: 'orchestrator-daemon-e2e-test',
  port: 8788, // Different port to avoid conflicts
  host: '127.0.0.1',
  maxSessions: 10,
  heartbeatInterval: 30000,
  shutdownTimeout: 5000,
  verbose: true,
  logLevel: 'debug',
};

const TEST_TIMEOUT = 60000; // 60 seconds
const CONNECTION_TIMEOUT = 5000; // 5 seconds
const TASK_EXECUTION_TIMEOUT = 45000; // 45 seconds for LLM call

// Test state
let daemon: OrchestratorDaemon | null = null;
let ws: WebSocket | null = null;
let sessionId: string | null = null;
const testResults: Array<{ name: string; passed: boolean; message?: string }> = [];

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

function recordTest(name: string, passed: boolean, message?: string): void {
  testResults.push({ name, passed, message });
  if (passed) {
    logSuccess(`${name}: PASS`);
  } else {
    logError(`${name}: FAIL${message ? ` - ${message}` : ''}`);
  }
}

// WebSocket helper functions
function sendMessage(message: WSMessage): Promise<WSResponse> {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reject(new Error('WebSocket not connected'));
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error('Response timeout'));
    }, 10000);

    const handler = (data: WebSocket.Data) => {
      clearTimeout(timeout);
      ws?.off('message', handler);
      try {
        const response = JSON.parse(data.toString()) as WSResponse;
        resolve(response);
      } catch (error) {
        reject(error);
      }
    };

    ws.on('message', handler);
    ws.send(JSON.stringify(message));
  });
}

function waitForMessage(
  predicate: (msg: WSResponse) => boolean,
  timeout = 10000
): Promise<WSResponse> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      ws?.off('message', handler);
      reject(new Error('Message timeout'));
    }, timeout);

    const handler = (data: WebSocket.Data) => {
      try {
        const response = JSON.parse(data.toString()) as WSResponse;
        if (predicate(response)) {
          clearTimeout(timeoutId);
          ws?.off('message', handler);
          resolve(response);
        }
      } catch (error) {
        // Ignore parse errors
      }
    };

    ws?.on('message', handler);
  });
}

// Test steps
async function startDaemon(): Promise<void> {
  logInfo('Starting daemon...');
  try {
    daemon = new OrchestratorDaemon(TEST_CONFIG);
    await daemon.start();
    recordTest('Start Daemon', true);
  } catch (error) {
    recordTest('Start Daemon', false, (error as Error).message);
    throw error;
  }
}

async function connectWebSocket(): Promise<void> {
  logInfo('Connecting WebSocket...');
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      recordTest('WebSocket Connection', false, 'Connection timeout');
      reject(new Error('Connection timeout'));
    }, CONNECTION_TIMEOUT);

    ws = new WebSocket(`ws://${TEST_CONFIG.host}:${TEST_CONFIG.port}`);

    ws.on('open', () => {
      clearTimeout(timeout);
      recordTest('WebSocket Connection', true);
      resolve();
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      recordTest('WebSocket Connection', false, error.message);
      reject(error);
    });
  });
}

async function testHealthCheck(): Promise<void> {
  logInfo('Testing health check...');
  try {
    const response = await sendMessage({ type: 'health_check' });

    if (response.type === 'health_check_response' && response.healthy) {
      recordTest('Health Check', true);
    } else {
      recordTest('Health Check', false, 'Unexpected response');
    }
  } catch (error) {
    recordTest('Health Check', false, (error as Error).message);
    throw error;
  }
}

async function testDaemonStatus(): Promise<void> {
  logInfo('Testing daemon status...');
  try {
    const response = await sendMessage({ type: 'daemon_status' });

    if (response.type === 'daemon_status_update') {
      const { status } = response;
      const valid =
        status.status === 'running' &&
        typeof status.uptime === 'number' &&
        typeof status.activeSessions === 'number' &&
        status.metrics !== undefined;

      if (valid) {
        logInfo(`  Status: ${status.status}`);
        logInfo(`  Uptime: ${status.uptime}ms`);
        logInfo(`  Active Sessions: ${status.activeSessions}`);
        recordTest('Daemon Status', true);
      } else {
        recordTest('Daemon Status', false, 'Invalid status structure');
      }
    } else {
      recordTest('Daemon Status', false, 'Unexpected response type');
    }
  } catch (error) {
    recordTest('Daemon Status', false, (error as Error).message);
    throw error;
  }
}

async function testSpawnSession(): Promise<void> {
  logInfo('Testing spawn session...');
  try {
    const response = await sendMessage({
      type: 'spawn_session',
      payload: {
        orchestratorId: 'test-orchestrator',
        task: {
          type: 'custom',
          description: 'Test task for E2E validation',
          priority: 'high',
          status: 'pending',
        },
        sessionType: 'claude-code',
      },
    });

    if (response.type === 'session_spawned') {
      sessionId = response.session.id;
      logInfo(`  Session ID: ${sessionId}`);
      logInfo(`  Session Status: ${response.session.status}`);
      recordTest('Spawn Session', true);
    } else if (response.type === 'error') {
      recordTest('Spawn Session', false, response.error);
      throw new Error(response.error);
    } else {
      recordTest('Spawn Session', false, 'Unexpected response type');
      throw new Error('Unexpected response type');
    }
  } catch (error) {
    recordTest('Spawn Session', false, (error as Error).message);
    throw error;
  }
}

async function testExecuteTask(): Promise<void> {
  if (!sessionId) {
    recordTest('Execute Task', false, 'No session ID');
    throw new Error('No session ID');
  }

  logInfo('Testing task execution (calling LLM)...');
  logWarning('This will make a real OpenAI API call and may take 10-30 seconds...');

  try {
    // Send execute task message
    ws?.send(JSON.stringify({
      type: 'execute_task',
      payload: {
        sessionId,
        task: 'Say hello and confirm you received this test message. Keep your response brief.',
        streamResponse: true,
      },
    }));

    // Wait for stream to start
    const streamStart = await waitForMessage(
      (msg) => msg.type === 'stream_start' && msg.sessionId === sessionId,
      TASK_EXECUTION_TIMEOUT
    );
    logInfo('  Stream started');

    // Collect stream chunks
    const chunks: string[] = [];
    const streamHandler = (data: WebSocket.Data) => {
      try {
        const response = JSON.parse(data.toString()) as WSResponse;
        if (response.type === 'stream_chunk' && response.data.sessionId === sessionId) {
          chunks.push(response.data.chunk);
          process.stdout.write(colors.cyan + response.data.chunk + colors.reset);
        }
      } catch (error) {
        // Ignore parse errors
      }
    };

    ws?.on('message', streamHandler);

    // Wait for stream to end
    await waitForMessage(
      (msg) => msg.type === 'stream_end' && msg.sessionId === sessionId,
      TASK_EXECUTION_TIMEOUT
    );

    ws?.off('message', streamHandler);
    console.log(); // New line after streaming

    const fullResponse = chunks.join('');
    logInfo(`  Received ${chunks.length} chunks, ${fullResponse.length} characters`);

    // Validate response contains expected content
    if (fullResponse.length > 0 && (
      fullResponse.toLowerCase().includes('hello') ||
      fullResponse.toLowerCase().includes('received') ||
      fullResponse.toLowerCase().includes('test')
    )) {
      recordTest('Execute Task', true);
      logInfo('  LLM Response validated ✓');
    } else {
      recordTest('Execute Task', false, 'Response does not contain expected content');
      logWarning(`  Response: ${fullResponse.substring(0, 100)}...`);
    }

  } catch (error) {
    recordTest('Execute Task', false, (error as Error).message);
    throw error;
  }
}

async function testStopSession(): Promise<void> {
  if (!sessionId) {
    recordTest('Stop Session', false, 'No session ID');
    return;
  }

  logInfo('Testing stop session...');
  try {
    const response = await sendMessage({
      type: 'stop_session',
      payload: { sessionId },
    });

    if (response.type === 'session_status_update') {
      const status = response.session.status;
      logInfo(`  Session status: ${status}`);

      if (status === 'terminated' || status === 'completed') {
        recordTest('Stop Session', true);
      } else {
        recordTest('Stop Session', false, `Unexpected status: ${status}`);
      }
    } else if (response.type === 'error') {
      recordTest('Stop Session', false, response.error);
    } else {
      recordTest('Stop Session', false, 'Unexpected response type');
    }
  } catch (error) {
    recordTest('Stop Session', false, (error as Error).message);
  }
}

async function cleanup(): Promise<void> {
  logInfo('Cleaning up...');

  if (ws) {
    ws.close();
    ws = null;
  }

  if (daemon) {
    await daemon.stop();
    daemon = null;
  }

  logSuccess('Cleanup complete');
}

// Print test summary
function printSummary(): void {
  console.log('\n' + '='.repeat(60));
  log('TEST SUMMARY', colors.bright);
  console.log('='.repeat(60));

  const passed = testResults.filter((t) => t.passed).length;
  const failed = testResults.filter((t) => !t.passed).length;
  const total = testResults.length;

  testResults.forEach((test) => {
    const icon = test.passed ? '✓' : '✗';
    const color = test.passed ? colors.green : colors.red;
    const msg = test.message ? ` (${test.message})` : '';
    log(`${icon} ${test.name}${msg}`, color);
  });

  console.log('='.repeat(60));
  log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`, colors.bright);
  console.log('='.repeat(60) + '\n');

  if (failed === 0) {
    logSuccess('ALL TESTS PASSED! 🎉');
  } else {
    logError(`${failed} TEST(S) FAILED`);
  }
}

// Main test runner
async function runTests(): Promise<void> {
  const startTime = Date.now();
  log('\n' + '='.repeat(60), colors.bright);
  log('ORCHESTRATOR DAEMON E2E TEST', colors.bright);
  log('='.repeat(60) + '\n', colors.bright);

  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    logError('OPENAI_API_KEY environment variable not set');
    logInfo('This test requires a valid OpenAI API key to test LLM integration');
    process.exit(1);
  }

  try {
    // Run test sequence
    await startDaemon();
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for daemon to fully start
    await connectWebSocket();
    await testHealthCheck();
    await testDaemonStatus();
    await testSpawnSession();
    await testExecuteTask();
    await testStopSession();

    logSuccess('\nAll test steps completed');
  } catch (error) {
    logError(`\nTest sequence failed: ${(error as Error).message}`);
  } finally {
    await cleanup();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logInfo(`\nTotal execution time: ${duration}s`);

    printSummary();

    // Exit with appropriate code
    const allPassed = testResults.every((t) => t.passed);
    process.exit(allPassed ? 0 : 1);
  }
}

// Global timeout
const globalTimeout = setTimeout(() => {
  logError('\nGlobal timeout exceeded!');
  cleanup().finally(() => {
    process.exit(1);
  });
}, TEST_TIMEOUT);

// Handle process termination
process.on('SIGINT', async () => {
  logWarning('\nReceived SIGINT, cleaning up...');
  clearTimeout(globalTimeout);
  await cleanup();
  process.exit(130);
});

process.on('SIGTERM', async () => {
  logWarning('\nReceived SIGTERM, cleaning up...');
  clearTimeout(globalTimeout);
  await cleanup();
  process.exit(143);
});

// Run tests
runTests().catch((error) => {
  logError(`Fatal error: ${error.message}`);
  cleanup().finally(() => {
    process.exit(1);
  });
});
