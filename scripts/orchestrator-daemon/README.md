# VP-Daemon: Virtual Principal Daemon System

## Overview

The VP-Daemon is a sophisticated orchestration system for managing Virtual Principals (VPs) - automated AI agents that execute tasks with defined constraints, identity, and resource limits. The daemon provides comprehensive session management, triage, resource allocation, and observability for distributed Orchestrator operations.

## Core Components

### 1. Session Management

#### ClaudeSessionSpawner (`claude-session-spawner.ts`)
Programmatically spawns and manages Claude Code sessions with full lifecycle control.

**Features:**
- Dynamic CLAUDE.md generation per session
- Real-time stdout/stderr capture
- Token usage tracking
- Session metrics collection
- Crash detection and reporting
- Configurable timeouts

**Usage:**
```typescript
import ClaudeSessionSpawner from './claude-session-spawner';

const spawner = new ClaudeSessionSpawner();
const { sessionId, completion } = await spawner.spawnSession({
  workingDirectory: '/path/to/project',
  charter: vpCharter,
  taskContext: taskInfo,
  memory: contextMemory,
  timeout: 1800000 // 30 minutes
});

const finalStatus = await completion;
```

#### SessionPool (`session-pool.ts`)
Manages concurrent sessions with resource limits and priority queuing.

**Features:**
- Maximum concurrent session limits
- Priority-based request queuing
- Automatic recovery on crash
- Pool metrics and monitoring
- Graceful draining

**Usage:**
```typescript
const pool = new SessionPool(spawner, {
  maxConcurrentSessions: 5,
  maxQueueSize: 20,
  autoRecovery: true
});

await pool.requestSession({
  requestId: 'req-001',
  config: sessionConfig,
  priority: 'high'
});
```

#### SessionRecoveryManager (`session-recovery.ts`)
Automatic crash detection, analysis, and recovery.

**Features:**
- Crash type classification (OOM, timeout, segfault, etc.)
- Root cause analysis with confidence scores
- Exponential backoff retry logic
- Crash dump generation
- Recovery statistics

### 2. Triage System (`triage-engine.ts`)

Routes incoming requests to appropriate VPs based on intent and priority.

**Features:**
- Intent classification
- Priority assignment
- Session targeting
- Guardian escalation triggers

### 3. Resource Management

#### ResourceAllocator (`resource-allocator.ts`)
Manages token budgets and resource allocation across VPs.

**Features:**
- Token budget tracking (daily, hourly, per-5-hours)
- Soft/hard limit enforcement
- Model tier assignment
- Cost optimization

#### IdentityManager (`identity-manager.ts`)
Manages Orchestrator identities and credentials.

**Features:**
- Secure credential storage
- Git configuration management
- Identity persistence
- Multi-VP support

### 4. PTY Controller (`pty-controller.ts`)

Automated terminal session management with safety heuristics.

**Features:**
- Auto-approval patterns for safe commands
- Rejection patterns for dangerous operations
- Guardian escalation for sensitive actions
- Output capture and logging

### 5. Intervention Engine (`intervention-engine.ts`)

Monitors Orchestrator behavior and triggers interventions when needed.

**Features:**
- Policy violation detection
- Alignment drift monitoring
- Automatic rollback capability
- Guardian notifications

### 6. Telemetry & Observability (`telemetry-collector.ts`)

Comprehensive metrics collection and reporting.

**Features:**
- Decision telemetry
- Performance metrics
- Token usage tracking
- Multi-backend support (console, HTTP, file)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        VP-Daemon                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              IdentityManager                         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────┐    ┌─────────────────────────────┐  │
│  │   TriageEngine   │───▶│   SessionPool               │  │
│  │                  │    │  ┌─────────────────────┐    │  │
│  │  - Intent        │    │  │ ClaudeSessionSpawner│    │  │
│  │  - Priority      │    │  │  - Session 1        │    │  │
│  │  - Routing       │    │  │  - Session 2        │    │  │
│  └──────────────────┘    │  │  - Session N        │    │  │
│                          │  └─────────────────────┘    │  │
│                          │  ┌─────────────────────┐    │  │
│                          │  │ SessionRecovery     │    │  │
│                          │  └─────────────────────┘    │  │
│                          └─────────────────────────────┘  │
│                                                              │
│  ┌──────────────────┐    ┌─────────────────────────────┐  │
│  │ ResourceAllocator│    │   PTYController             │  │
│  │  - Token Budget  │    │  - Auto-approval            │  │
│  │  - Model Tiers   │    │  - Safety heuristics        │  │
│  └──────────────────┘    └─────────────────────────────┘  │
│                                                              │
│  ┌──────────────────┐    ┌─────────────────────────────┐  │
│  │InterventionEngine│    │  TelemetryCollector         │  │
│  │  - Policy Check  │    │  - Metrics                  │  │
│  │  - Rollback      │    │  - Decision Logs            │  │
│  └──────────────────┘    └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Session Lifecycle

```
Triage Request → Intent Analysis → Priority Assignment → Session Pool
                                                              ↓
                                              Queue (if pool full)
                                                              ↓
                                              Session Allocated
                                                              ↓
                                        ClaudeSessionSpawner Creates:
                                        - Session-specific CLAUDE.md
                                        - Environment variables
                                        - Task prompt compilation
                                                              ↓
                                        Claude Code Process Spawned
                                                              ↓
                                        PTYController Monitors:
                                        - Approval prompts
                                        - Command execution
                                        - Safety violations
                                                              ↓
                                        Session Execution:
                                        - stdout/stderr capture
                                        - Metrics collection
                                        - Token tracking
                                                              ↓
                                        Completion/Failure/Crash
                                                              ↓
                                        Recovery Manager (if crashed)
                                                              ↓
                                        Session Cleanup
                                                              ↓
                                        Pool Slot Released
```

## Configuration

### Orchestrator Charter Example

```typescript
const charter: VPCharter = {
  identity: {
    name: 'Engineering VP',
    email: 'orchestrator-eng@company.com',
    role: 'Senior Software Engineer'
  },
  objectives: [
    'Implement features with comprehensive tests',
    'Maintain code quality standards',
    'Document all changes clearly'
  ],
  constraints: {
    forbiddenCommands: ['rm -rf /', 'git push --force'],
    forbiddenPatterns: [/production/i, /delete.*database/i],
    requiredApprovals: ['deploy', 'publish', 'migration']
  },
  resources: {
    maxTokens: 200000,
    maxExecutionTime: 1800000, // 30 minutes
    allowedTools: ['read', 'write', 'edit', 'bash', 'grep', 'glob']
  }
};
```

### Daemon Configuration

```typescript
const daemon = new VPDaemon({
  name: 'orchestrator-daemon-01',
  port: 8787,
  maxSessions: 100,
  heartbeatInterval: 30000,
  verbose: true,
  subsystems: {
    session: {
      maxSlots: 100,
      queueCapacity: 1000,
      preemptionEnabled: true
    },
    intervention: {
      enabled: true,
      autoRollbackOnCritical: false
    },
    telemetry: {
      backends: [
        {
          type: 'console',
          enabled: true,
          console: { pretty: true, colorize: true }
        },
        {
          type: 'http',
          enabled: true,
          http: {
            url: 'https://telemetry.example.com/api/metrics',
            method: 'POST',
            headers: { 'Authorization': 'Bearer TOKEN' }
          }
        }
      ],
      flushInterval: 10000,
      maxBufferSize: 1000
    }
  }
});

await daemon.start();
```

## API Reference

### ClaudeSessionSpawner

```typescript
class ClaudeSessionSpawner extends EventEmitter {
  async spawnSession(config: ClaudeSessionConfig): Promise<SpawnResult>
  getSessionStatus(sessionId: string): ClaudeSessionStatus | null
  getActiveSessions(): ClaudeSessionStatus[]
  async terminateSession(sessionId: string, graceful?: boolean): Promise<void>
  sendInput(sessionId: string, input: string): void
  cleanupCompletedSessions(): number
  getCrashReports(): SessionCrashReport[]
  getMetricsSummary(): SessionMetricsSummary

  // Events
  on('session-spawned', ({ sessionId, pid }) => void)
  on('session-output', ({ sessionId, type, data }) => void)
  on('session-timeout', ({ sessionId }) => void)
  on('session-ended', ({ sessionId, status }) => void)
}
```

### SessionPool

```typescript
class SessionPool extends EventEmitter {
  async requestSession(request: PooledSessionRequest): Promise<SpawnResult>
  getPoolStatus(): PoolStatus
  cancelRequest(requestId: string): boolean
  async drain(timeoutMs?: number): Promise<void>
  getMetrics(): PoolMetrics

  // Events
  on('session-allocated', ({ requestId, sessionId }) => void)
  on('session-released', ({ sessionId, status }) => void)
  on('request-queued', ({ requestId, position, queueLength }) => void)
  on('session-recovering', ({ sessionId, requestId }) => void)
}
```

### SessionRecoveryManager

```typescript
class SessionRecoveryManager extends EventEmitter {
  async handleCrash(sessionId: string, crashReport: SessionCrashReport): Promise<void>
  getRecoveryStatus(sessionId: string): RecoveryState | null
  getActiveRecoveries(): RecoveryState[]
  getRecoveryStats(): RecoveryStatistics
  async triggerManualRecovery(sessionId: string): Promise<boolean>
  abandonRecovery(sessionId: string): void

  // Events
  on('crash-detected', ({ sessionId, crashReport }) => void)
  on('crash-analyzed', ({ sessionId, analysis }) => void)
  on('recovery-attempt', ({ sessionId, attemptNumber, analysis }) => void)
  on('recovery-succeeded', ({ sessionId, attemptNumber }) => void)
  on('recovery-failed', ({ sessionId, reason }) => void)
}
```

## Testing

```bash
# Run all tests
npm test tests/orchestrator-daemon/

# Run specific test suites
npm test tests/orchestrator-daemon/session-spawner.test.ts
npm test tests/orchestrator-daemon/session-pool.test.ts
npm test tests/orchestrator-daemon/session-recovery.test.ts

# Run with coverage
npm test -- --coverage tests/orchestrator-daemon/
```

## Examples

See `/examples/orchestrator-daemon/session-spawner-example.ts` for comprehensive usage examples:

1. **Basic Session Spawning** - Simple session creation and monitoring
2. **Session Pool Management** - Concurrent session handling with queuing
3. **Crash Recovery** - Automatic recovery from session crashes
4. **Advanced Monitoring** - Comprehensive event-based monitoring

Run examples:
```bash
npx ts-node examples/orchestrator-daemon/session-spawner-example.ts
```

## Performance Characteristics

### Memory Usage
- Base daemon: ~50MB
- Per session: 50-200MB
- Peak with 100 concurrent sessions: 5-20GB

### CPU Usage
- Idle: <1%
- Active processing: 2-5% per session
- Peak load: Scales linearly with concurrent sessions

### Disk I/O
- Session configs: ~5KB per session
- Crash dumps: ~50-500KB per crash
- Logs: Configurable, typically 1-10MB/hour

### Network
- Telemetry: ~1KB per event
- API calls to Claude: Variable based on context size

## Best Practices

1. **Set Appropriate Limits**
   - Configure `maxConcurrentSessions` based on available resources
   - Set realistic timeouts for task complexity
   - Monitor pool utilization and adjust accordingly

2. **Enable Auto-Recovery**
   - Critical for production deployments
   - Configure retry limits to prevent infinite loops
   - Save crash dumps for debugging

3. **Monitor Metrics**
   - Track token usage to prevent budget overruns
   - Monitor crash rates to identify systemic issues
   - Review session execution times for optimization

4. **Security**
   - Never hardcode credentials in charters
   - Use environment variables for sensitive data
   - Review auto-approval patterns regularly
   - Enable guardian escalation for critical operations

5. **Resource Management**
   - Run `cleanupCompletedSessions()` periodically
   - Implement log rotation for long-running daemons
   - Monitor disk space for crash dumps

## Troubleshooting

### Sessions Not Starting
- Verify Claude CLI is installed: `which claude`
- Check working directory exists and is readable
- Review environment variables
- Check daemon logs for errors

### High Memory Usage
- Reduce `maxConcurrentSessions`
- Implement session timeouts
- Clean up completed sessions more frequently
- Check for memory leaks in long-running sessions

### Sessions Timing Out
- Increase timeout configuration
- Break large tasks into smaller chunks
- Check for blocking operations
- Review task complexity

### Frequent Crashes
- Check system resources (RAM, disk space)
- Review crash reports for patterns
- Update Claude CLI to latest version
- Enable verbose logging for detailed diagnostics

## Deployment

### Production Checklist
- [ ] Configure resource limits appropriately
- [ ] Enable auto-recovery with reasonable retry limits
- [ ] Set up telemetry backend for monitoring
- [ ] Configure crash dump storage
- [ ] Implement log rotation
- [ ] Set up health check monitoring
- [ ] Configure graceful shutdown handling
- [ ] Test disaster recovery procedures

### Monitoring Endpoints
```typescript
// Health check
const health = daemon.getStatus();

// Pool status
const pool = daemon.getSubsystems().session?.getPoolStatus();

// Metrics
const metrics = daemon.getSubsystems().session?.getMetrics();

// Recovery stats
const recovery = sessionRecovery.getRecoveryStats();
```

## Contributing

See main project CONTRIBUTING.md for guidelines.

## License

MIT - See LICENSE file

## Support

- Documentation: `/docs/orchestrator-daemon/`
- Issues: GitHub Issues
- Slack: #orchestrator-daemon channel
