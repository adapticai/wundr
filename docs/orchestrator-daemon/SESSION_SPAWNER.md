# Claude Code/Flow Session Spawner - Technical Documentation

## Overview

The Session Spawner module provides programmatic control over Claude Code sessions for the VP-Daemon
system. It enables automated spawning, configuration, monitoring, and lifecycle management of Claude
Code instances executing VP tasks.

## Architecture

### Core Components

1. **ClaudeSessionSpawner** - Main session lifecycle manager
2. **SessionPool** - Concurrent session pool with resource limits
3. **SessionRecoveryManager** - Crash detection and automatic recovery
4. **Session Configuration** - Charter-based session configuration system

## ClaudeSessionSpawner

### Features

- **Programmatic Session Creation**: Spawn Claude Code sessions via CLI
- **Dynamic Configuration**: Generate session-specific CLAUDE.md files
- **Output Capture**: Real-time stdout/stderr monitoring
- **Lifecycle Management**: Complete session state tracking
- **Metrics Collection**: Token usage, commands, file modifications
- **Crash Detection**: Automatic crash report generation

### Usage Example

```typescript
import ClaudeSessionSpawner from './claude-session-spawner';

const spawner = new ClaudeSessionSpawner();

// Configure session
const config = {
  workingDirectory: '/path/to/project',
  charter: {
    identity: {
      name: 'Engineering VP',
      email: 'vp@company.com',
      role: 'Senior Software Engineer',
    },
    objectives: ['Implement feature X', 'Write comprehensive tests', 'Update documentation'],
    constraints: {
      forbiddenCommands: ['rm -rf', 'git push --force'],
      forbiddenPatterns: [/deploy.*production/i],
      requiredApprovals: ['deploy', 'publish'],
    },
    resources: {
      maxTokens: 200000,
      maxExecutionTime: 1800000, // 30 minutes
      allowedTools: ['read', 'write', 'bash', 'glob', 'grep'],
    },
  },
  taskContext: {
    taskId: 'TASK-123',
    description: 'Implement user authentication system',
    priority: 'high',
  },
  memory: {
    recentActions: [],
    conversationHistory: [],
    preferences: {
      testFramework: 'jest',
      codeStyle: 'functional',
    },
    projectContext: {
      techStack: ['TypeScript', 'React', 'Node.js'],
    },
  },
  timeout: 1800000, // 30 minutes
};

// Spawn session
const { sessionId, status, completion } = await spawner.spawnSession(config);

console.log(`Session ${sessionId} started with PID ${status.pid}`);

// Monitor session
spawner.on('session-output', ({ sessionId, type, data }) => {
  console.log(`[${sessionId}] ${type}: ${data}`);
});

// Wait for completion
const finalStatus = await completion;

console.log(`Session completed with state: ${finalStatus.state}`);
console.log(`Execution time: ${finalStatus.executionTime}ms`);
console.log(`Commands executed: ${finalStatus.metrics.commandsExecuted}`);
```

### Session States

```
initializing → running → completed
                ↓
              failed
                ↓
              crashed
                ↓
              timeout
```

### Configuration Generation

The spawner automatically generates a session-specific `CLAUDE.md` file that includes:

1. **VP Identity**: Name, email, role
2. **Task Context**: Description, priority, related tasks
3. **Objectives**: Specific goals for the session
4. **Constraints**: Forbidden commands, required approvals
5. **Resource Limits**: Token budget, execution time
6. **Memory Context**: Recent actions, preferences, conversation history

Example generated configuration:

```markdown
# Session: claude-session-abc123

# Task: Implement user authentication

# Priority: high

## VP Identity

- Name: Engineering VP
- Email: vp@company.com
- Role: Senior Software Engineer

## Objectives

- Implement JWT-based authentication
- Add password hashing with bcrypt
- Create login/logout endpoints

## Constraints

### Forbidden Commands

- rm -rf
- git push --force

### Required Approvals

- deploy
- npm publish

## Resource Limits

- Max Tokens: 200000
- Max Execution Time: 1800000ms
- Allowed Tools: read, write, bash, glob, grep
```

## SessionPool

### Features

- **Concurrent Session Management**: Run multiple sessions with configurable limits
- **Priority Queuing**: Request prioritization (critical > high > medium > low)
- **Resource Limits**: Enforce maximum concurrent sessions
- **Automatic Queueing**: Queue overflow requests with estimated wait times
- **Graceful Draining**: Shutdown sessions cleanly

### Usage Example

```typescript
import ClaudeSessionSpawner from './claude-session-spawner';
import SessionPool from './session-pool';

const spawner = new ClaudeSessionSpawner();
const pool = new SessionPool(spawner, {
  maxConcurrentSessions: 5,
  minIdleSessions: 1,
  defaultSessionTimeout: 1800000,
  maxQueueSize: 20,
  autoRecovery: true,
});

// Request session from pool
const request = {
  requestId: 'req-001',
  config: sessionConfig,
  priority: 'high',
  queuedAt: new Date(),
  onAllocated: sessionId => {
    console.log(`Session ${sessionId} allocated`);
  },
  onCompleted: status => {
    console.log(`Session completed: ${status.state}`);
  },
  onFailed: error => {
    console.error(`Session failed: ${error.message}`);
  },
};

const result = await pool.requestSession(request);

// Monitor pool status
const status = pool.getPoolStatus();
console.log(`Pool utilization: ${status.utilization}%`);
console.log(`Active sessions: ${status.activeCount}/${status.capacity}`);
console.log(`Queued requests: ${status.queuedCount}`);
```

### Pool Metrics

```typescript
const metrics = pool.getMetrics();

// Output:
{
  totalSessions: 50,
  activeSessions: 5,
  completedSessions: 40,
  failedSessions: 3,
  crashedSessions: 2,
  avgExecutionTime: 450000,
  totalTokensUsed: 5000000,
  poolUtilization: 100,
  queueLength: 3,
  queueWaitTime: 120000
}
```

## SessionRecoveryManager

### Features

- **Crash Detection**: Automatic crash report generation
- **Crash Analysis**: Root cause analysis with confidence scoring
- **Recovery Strategies**: Immediate, delayed, or manual recovery
- **Retry Logic**: Exponential backoff for recovery attempts
- **Crash Dumps**: Save detailed crash information to disk

### Crash Types

1. **OOM (Out of Memory)**: Session exceeded available RAM
2. **Timeout**: Execution time limit exceeded
3. **Segfault**: Native code crash
4. **Network**: Connectivity issues
5. **Permission**: Access denied errors
6. **Unknown**: Unclassified crashes

### Usage Example

```typescript
import SessionRecoveryManager from './session-recovery';

const recoveryManager = new SessionRecoveryManager(spawner, {
  enabled: true,
  maxRetries: 3,
  retryDelay: 5000,
  backoffMultiplier: 2,
  saveCrashDumps: true,
  crashDumpDirectory: '.vp-daemon/crash-dumps',
  strategy: 'delayed',
});

// Monitor recovery events
recoveryManager.on('crash-detected', ({ sessionId, crashReport }) => {
  console.log(`Crash detected in session ${sessionId}`);
});

recoveryManager.on('crash-analyzed', ({ sessionId, analysis }) => {
  console.log(`Crash type: ${analysis.crashType}`);
  console.log(`Root cause: ${analysis.rootCause}`);
  console.log(`Recommendation: ${analysis.recommendation}`);
});

recoveryManager.on('recovery-succeeded', ({ sessionId, attemptNumber }) => {
  console.log(`Recovery successful after ${attemptNumber} attempts`);
});

// Get recovery statistics
const stats = recoveryManager.getRecoveryStats();
console.log(`Recovery rate: ${(stats.recoveryRate * 100).toFixed(1)}%`);
```

### Crash Analysis Example

```typescript
{
  crashType: 'oom',
  rootCause: 'Out of memory - session exceeded available RAM',
  recommendation: 'Automatic recovery with increased memory allocation',
  confidence: 0.9,
  suggestedFixes: [
    'Increase memory limits',
    'Reduce batch size or chunk operations'
  ]
}
```

## Event System

### ClaudeSessionSpawner Events

```typescript
// Session lifecycle
spawner.on('session-spawned', ({ sessionId, pid }) => {});
spawner.on('session-ended', ({ sessionId, status }) => {});
spawner.on('session-timeout', ({ sessionId }) => {});

// Output streaming
spawner.on('session-output', ({ sessionId, type, data }) => {
  // type: 'stdout' | 'stderr'
  // data: string chunk
});
```

### SessionPool Events

```typescript
pool.on('session-allocated', ({ requestId, sessionId }) => {});
pool.on('session-released', ({ sessionId, status }) => {});
pool.on('request-queued', ({ requestId, position, queueLength }) => {});
pool.on('request-cancelled', ({ requestId }) => {});
pool.on('pool-draining', () => {});
pool.on('pool-drained', () => {});
```

### SessionRecoveryManager Events

```typescript
recoveryManager.on('crash-detected', ({ sessionId, crashReport }) => {});
recoveryManager.on('crash-analyzed', ({ sessionId, analysis }) => {});
recoveryManager.on('recovery-attempt', ({ sessionId, attemptNumber, analysis }) => {});
recoveryManager.on('recovery-succeeded', ({ sessionId, attemptNumber }) => {});
recoveryManager.on('recovery-failed', ({ sessionId, reason }) => {});
recoveryManager.on('crash-dump-saved', ({ sessionId, filepath }) => {});
```

## Testing

Run the test suite:

```bash
npm test tests/vp-daemon/session-spawner.test.ts
```

### Test Coverage

- Session spawning and lifecycle
- Configuration generation
- Output capture
- Timeout handling
- Session termination (graceful and forced)
- Input sending
- Session status retrieval
- Event emissions

## Integration with VP-Daemon

```typescript
import { VPDaemon } from './index';
import ClaudeSessionSpawner from './claude-session-spawner';
import SessionPool from './session-pool';
import SessionRecoveryManager from './session-recovery';

// In VPDaemon initialization
const spawner = new ClaudeSessionSpawner();

const pool = new SessionPool(spawner, {
  maxConcurrentSessions: config.maxSessions,
  defaultSessionTimeout: 1800000,
  maxQueueSize: 1000,
  autoRecovery: true,
});

const recovery = new SessionRecoveryManager(spawner, {
  enabled: true,
  maxRetries: 3,
  retryDelay: 5000,
  backoffMultiplier: 2,
  saveCrashDumps: true,
  strategy: 'delayed',
});

// Handle triage requests
async function handleTriageRequest(request: TriageRequest) {
  const sessionConfig = buildSessionConfig(request);

  const poolRequest = {
    requestId: uuidv4(),
    config: sessionConfig,
    priority: determinePriority(request),
    queuedAt: new Date(),
  };

  await pool.requestSession(poolRequest);
}
```

## Performance Considerations

### Memory Management

- Each session runs in a separate process
- Typical memory usage: 50-200MB per session
- Configure `maxConcurrentSessions` based on available RAM
- Monitor with `getMetricsSummary()` and `getPoolStatus()`

### Disk Usage

- Session configs: ~5-10KB per session
- Crash dumps: ~50-500KB per crash
- Output capture: Limited by session lifetime
- Clean up old crash dumps periodically

### CPU Usage

- Minimal overhead for session management
- Main CPU usage from Claude Code processes
- Pool operations are async and non-blocking

## Best Practices

1. **Set Appropriate Timeouts**: Prevent runaway sessions
2. **Monitor Pool Utilization**: Scale limits based on demand
3. **Enable Auto-Recovery**: Handle transient failures automatically
4. **Save Crash Dumps**: Debug production issues
5. **Configure Priority Weights**: Ensure critical tasks get resources
6. **Graceful Shutdown**: Use `pool.drain()` before daemon stop
7. **Resource Cleanup**: Run `cleanupCompletedSessions()` periodically

## Troubleshooting

### Session Won't Start

- Check Claude CLI is installed: `which claude`
- Verify working directory exists and is accessible
- Check environment variables are set correctly
- Review spawner logs for error messages

### Sessions Timing Out

- Increase `timeout` in session config
- Break large tasks into smaller chunks
- Check for blocking operations (network calls, etc.)

### High Crash Rate

- Review crash reports: `getCrashReports()`
- Check resource limits (memory, disk space)
- Update Claude CLI to latest version
- Enable verbose logging for more details

### Pool Queue Growing

- Increase `maxConcurrentSessions` if resources allow
- Optimize task execution time
- Review task priority distribution
- Consider adding more daemon instances

## API Reference

See TypeScript interfaces in:

- `/scripts/vp-daemon/claude-session-spawner.ts`
- `/scripts/vp-daemon/session-pool.ts`
- `/scripts/vp-daemon/session-recovery.ts`

## Version History

- **v1.0.0** - Initial implementation
  - Session spawning and lifecycle management
  - Pool-based concurrent execution
  - Crash recovery system
  - Comprehensive testing
