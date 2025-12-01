/**
 * Example: Using Claude Session Spawner
 *
 * This example demonstrates how to spawn and manage Claude Code sessions
 * for VP-Daemon task execution.
 */

import ClaudeSessionSpawner, {
  ClaudeSessionConfig,
  MemoryContext,
  TaskContext,
  VPCharter,
} from '../../scripts/orchestrator-daemon/claude-session-spawner';
import SessionPool from '../../scripts/orchestrator-daemon/session-pool';
import SessionRecoveryManager from '../../scripts/orchestrator-daemon/session-recovery';

// ============================================================================
// Example 1: Basic Session Spawning
// ============================================================================

async function example1_basicSpawning() {
  console.log('\n=== Example 1: Basic Session Spawning ===\n');

  const spawner = new ClaudeSessionSpawner();

  // Define Orchestrator charter
  const charter: VPCharter = {
    identity: {
      name: 'Development VP',
      email: 'dev-vp@company.com',
      role: 'Senior Software Engineer',
    },
    objectives: [
      'Write high-quality, tested code',
      'Follow best practices and conventions',
      'Document changes clearly',
    ],
    constraints: {
      forbiddenCommands: ['rm -rf /', 'git push --force'],
      forbiddenPatterns: [/deploy.*production/i, /delete.*database/i],
      requiredApprovals: ['deploy', 'publish', 'migrate'],
    },
    resources: {
      maxTokens: 100000,
      maxExecutionTime: 600000, // 10 minutes
      allowedTools: ['read', 'write', 'edit', 'bash', 'glob', 'grep'],
    },
  };

  // Define task context
  const taskContext: TaskContext = {
    taskId: 'TASK-001',
    description: 'Fix bug in user authentication flow',
    priority: 'high',
    metadata: {
      reporter: 'alice@company.com',
      assignedTo: 'dev-vp',
    },
  };

  // Define memory context
  const memoryContext: MemoryContext = {
    recentActions: [
      {
        timestamp: new Date(),
        action: 'Fixed similar auth bug',
        result: 'Successfully resolved JWT expiration issue',
      },
    ],
    conversationHistory: [
      {
        role: 'user',
        content: 'Please investigate the login timeout issue',
      },
    ],
    preferences: {
      testFramework: 'jest',
      codeStyle: 'functional-programming',
    },
    projectContext: {
      techStack: ['TypeScript', 'Express', 'PostgreSQL'],
      conventions: ['Use async/await', 'Prefer functional components'],
    },
  };

  // Create session configuration
  const config: ClaudeSessionConfig = {
    workingDirectory: process.cwd(),
    charter,
    taskContext,
    memory: memoryContext,
    timeout: 600000, // 10 minutes
    verbose: true,
  };

  // Spawn session
  const { sessionId, status, completion } = await spawner.spawnSession(config);

  console.log(`Session spawned: ${sessionId}`);
  console.log(`PID: ${status.pid}`);
  console.log(`State: ${status.state}`);

  // Listen for output
  spawner.on('session-output', ({ sessionId: sid, type, data }) => {
    if (sid === sessionId) {
      console.log(`[${type}] ${data}`);
    }
  });

  // Wait for completion
  const finalStatus = await completion;

  console.log(`\nSession completed:`);
  console.log(`  State: ${finalStatus.state}`);
  console.log(`  Execution time: ${finalStatus.executionTime}ms`);
  console.log(`  Commands executed: ${finalStatus.metrics.commandsExecuted}`);
  console.log(`  Files modified: ${finalStatus.metrics.filesModified}`);
  console.log(`  Errors: ${finalStatus.metrics.errors}`);
}

// ============================================================================
// Example 2: Session Pool Management
// ============================================================================

async function example2_sessionPool() {
  console.log('\n=== Example 2: Session Pool Management ===\n');

  const spawner = new ClaudeSessionSpawner();

  // Create session pool
  const pool = new SessionPool(spawner, {
    maxConcurrentSessions: 3,
    minIdleSessions: 1,
    defaultSessionTimeout: 300000, // 5 minutes
    maxQueueSize: 10,
    autoRecovery: true,
    priorityWeights: {
      critical: 10,
      high: 5,
      medium: 2,
      low: 1,
    },
  });

  // Monitor pool events
  pool.on('session-allocated', ({ requestId, sessionId }) => {
    console.log(`Allocated session ${sessionId} for request ${requestId}`);
  });

  pool.on('request-queued', ({ requestId, position, queueLength }) => {
    console.log(
      `Request ${requestId} queued at position ${position} (queue length: ${queueLength})`
    );
  });

  // Create multiple session requests
  const requests = [
    createSessionRequest('REQ-001', 'critical', 'Fix production outage'),
    createSessionRequest('REQ-002', 'high', 'Implement new feature'),
    createSessionRequest('REQ-003', 'medium', 'Refactor legacy code'),
    createSessionRequest('REQ-004', 'low', 'Update documentation'),
  ];

  // Request sessions (some will be queued)
  const results = await Promise.all(
    requests.map(req => pool.requestSession(req))
  );

  console.log(`\nRequested ${requests.length} sessions`);

  // Check pool status
  const status = pool.getPoolStatus();
  console.log(`\nPool Status:`);
  console.log(`  Capacity: ${status.capacity}`);
  console.log(`  Active: ${status.activeCount}`);
  console.log(`  Queued: ${status.queuedCount}`);
  console.log(`  Utilization: ${status.utilization.toFixed(1)}%`);

  // Wait a bit for sessions to complete
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Get metrics
  const metrics = pool.getMetrics();
  console.log(`\nPool Metrics:`);
  console.log(`  Total sessions: ${metrics.totalSessions}`);
  console.log(`  Completed: ${metrics.completedSessions}`);
  console.log(`  Failed: ${metrics.failedSessions}`);
  console.log(`  Avg execution time: ${metrics.avgExecutionTime}ms`);

  // Drain pool
  await pool.drain();
  console.log(`\nPool drained successfully`);
}

// ============================================================================
// Example 3: Crash Recovery
// ============================================================================

async function example3_crashRecovery() {
  console.log('\n=== Example 3: Crash Recovery ===\n');

  const spawner = new ClaudeSessionSpawner();

  // Create recovery manager
  const recovery = new SessionRecoveryManager(spawner, {
    enabled: true,
    maxRetries: 3,
    retryDelay: 2000,
    backoffMultiplier: 2,
    saveCrashDumps: true,
    crashDumpDirectory: '.orchestrator-daemon/crash-dumps',
    strategy: 'delayed',
  });

  // Monitor recovery events
  recovery.on('crash-detected', ({ sessionId, crashReport }) => {
    console.log(`Crash detected in session ${sessionId}`);
    console.log(`  Exit code: ${crashReport.exitCode}`);
    console.log(`  Signal: ${crashReport.signal}`);
  });

  recovery.on('crash-analyzed', ({ sessionId, analysis }) => {
    console.log(`\nCrash Analysis for ${sessionId}:`);
    console.log(`  Type: ${analysis.crashType}`);
    console.log(`  Root cause: ${analysis.rootCause}`);
    console.log(`  Confidence: ${(analysis.confidence * 100).toFixed(0)}%`);
    console.log(`  Recommendation: ${analysis.recommendation}`);
    console.log(`  Suggested fixes:`);
    analysis.suggestedFixes.forEach(fix => {
      console.log(`    - ${fix}`);
    });
  });

  recovery.on('recovery-attempt', ({ sessionId, attemptNumber }) => {
    console.log(
      `\nAttempting recovery for ${sessionId} (attempt ${attemptNumber})`
    );
  });

  recovery.on('recovery-succeeded', ({ sessionId, attemptNumber }) => {
    console.log(`Recovery succeeded after ${attemptNumber} attempts`);
  });

  recovery.on('recovery-failed', ({ sessionId, reason }) => {
    console.log(`Recovery failed: ${reason}`);
  });

  // Simulate a session that might crash
  const config = createTestConfig('Stress test with large dataset');
  config.timeout = 5000; // Short timeout to simulate timeout crash

  const { sessionId } = await spawner.spawnSession(config);

  console.log(`Started session ${sessionId} (configured to timeout)`);

  // Wait for timeout and recovery
  await new Promise(resolve => setTimeout(resolve, 15000));

  // Check recovery stats
  const stats = recovery.getRecoveryStats();
  console.log(`\nRecovery Statistics:`);
  console.log(`  Total crashes: ${stats.totalCrashes}`);
  console.log(`  Recovery attempts: ${stats.totalRecoveryAttempts}`);
  console.log(`  Successful recoveries: ${stats.successfulRecoveries}`);
  console.log(`  Recovery rate: ${(stats.recoveryRate * 100).toFixed(1)}%`);
  console.log(
    `  Avg attempts per recovery: ${stats.avgAttemptsPerRecovery.toFixed(1)}`
  );
}

// ============================================================================
// Example 4: Advanced Monitoring
// ============================================================================

async function example4_advancedMonitoring() {
  console.log('\n=== Example 4: Advanced Monitoring ===\n');

  const spawner = new ClaudeSessionSpawner();

  // Set up comprehensive monitoring
  spawner.on('session-spawned', ({ sessionId, pid }) => {
    console.log(`[SPAWNED] Session ${sessionId} started with PID ${pid}`);
  });

  spawner.on('session-output', ({ sessionId, type, data }) => {
    // Filter for important output
    if (
      data.includes('ERROR') ||
      data.includes('WARN') ||
      data.includes('completed')
    ) {
      console.log(`[OUTPUT:${type}] ${sessionId}: ${data.trim()}`);
    }
  });

  spawner.on('session-timeout', ({ sessionId }) => {
    console.log(`[TIMEOUT] Session ${sessionId} exceeded time limit`);
  });

  spawner.on('session-ended', ({ sessionId, status }) => {
    console.log(
      `[ENDED] Session ${sessionId} ended with state: ${status.state}`
    );
    console.log(`  Execution time: ${status.executionTime}ms`);
    console.log(`  Token usage: ${status.tokenUsage?.total ?? 'N/A'}`);
  });

  // Spawn multiple sessions with different priorities
  const sessions = await Promise.all([
    spawner.spawnSession(createTestConfig('High priority task')),
    spawner.spawnSession(createTestConfig('Medium priority task')),
    spawner.spawnSession(createTestConfig('Low priority task')),
  ]);

  console.log(`\nSpawned ${sessions.length} sessions\n`);

  // Monitor sessions periodically
  const monitorInterval = setInterval(() => {
    const active = spawner.getActiveSessions();
    console.log(`\n[MONITOR] Active sessions: ${active.length}`);

    active.forEach(session => {
      console.log(`  ${session.sessionId}:`);
      console.log(`    State: ${session.state}`);
      console.log(`    Uptime: ${Date.now() - session.startTime.getTime()}ms`);
      console.log(`    Commands: ${session.metrics.commandsExecuted}`);
    });

    if (active.length === 0) {
      clearInterval(monitorInterval);
    }
  }, 5000);

  // Wait for all sessions to complete
  await Promise.all(sessions.map(s => s.completion));

  console.log(`\nAll sessions completed`);

  // Get final metrics
  const summary = spawner.getMetricsSummary();
  console.log(`\nFinal Metrics:`);
  console.log(`  Total sessions: ${summary.totalSessions}`);
  console.log(`  Completed: ${summary.completedSessions}`);
  console.log(`  Failed: ${summary.failedSessions}`);
  console.log(`  Crashed: ${summary.crashedSessions}`);
  console.log(`  Avg execution time: ${summary.avgExecutionTime.toFixed(0)}ms`);
  console.log(`  Total tokens: ${summary.totalTokensUsed}`);
}

// ============================================================================
// Helper Functions
// ============================================================================

function createSessionRequest(
  requestId: string,
  priority: 'critical' | 'high' | 'medium' | 'low',
  description: string
) {
  return {
    requestId,
    config: createTestConfig(description),
    priority,
    queuedAt: new Date(),
    onAllocated: (sessionId: string) => {
      console.log(`[${requestId}] Allocated to session ${sessionId}`);
    },
    onCompleted: (status: any) => {
      console.log(`[${requestId}] Completed with state: ${status.state}`);
    },
    onFailed: (error: Error) => {
      console.error(`[${requestId}] Failed: ${error.message}`);
    },
  };
}

function createTestConfig(description: string): ClaudeSessionConfig {
  const charter: VPCharter = {
    identity: {
      name: 'Test VP',
      email: 'test@example.com',
      role: 'Software Engineer',
    },
    objectives: ['Complete task efficiently', 'Follow best practices'],
    constraints: {
      forbiddenCommands: ['rm -rf'],
      forbiddenPatterns: [],
      requiredApprovals: [],
    },
    resources: {
      maxTokens: 50000,
      maxExecutionTime: 300000,
      allowedTools: ['read', 'write', 'bash'],
    },
  };

  const taskContext: TaskContext = {
    taskId: `TASK-${Date.now()}`,
    description,
    priority: 'medium',
  };

  const memoryContext: MemoryContext = {
    recentActions: [],
    conversationHistory: [],
    preferences: {},
    projectContext: {},
  };

  return {
    workingDirectory: process.cwd(),
    charter,
    taskContext,
    memory: memoryContext,
    timeout: 300000,
    verbose: false,
  };
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  console.log('Claude Session Spawner Examples\n');
  console.log('================================\n');

  try {
    // Run examples
    await example1_basicSpawning();
    await example2_sessionPool();
    await example3_crashRecovery();
    await example4_advancedMonitoring();

    console.log('\n================================');
    console.log('All examples completed successfully!');
  } catch (error) {
    console.error('Error running examples:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export {
  example1_basicSpawning,
  example2_sessionPool,
  example3_crashRecovery,
  example4_advancedMonitoring,
};
