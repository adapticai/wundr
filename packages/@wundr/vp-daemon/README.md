# @wundr.io/vp-daemon

Virtual Principal (VP) Daemon for agent orchestration and session management.

## Overview

The VP Daemon is a machine-level supervisor daemon that manages Claude Code and Claude Flow sessions. It provides:

- **WebSocket Server** for real-time communication with Neolith and other clients
- **Session Management** for spawning and managing multiple agent sessions
- **Memory Architecture** with MemGPT-inspired tiered memory (scratchpad/episodic/semantic)
- **VP Charter** loading and enforcement for safety and resource management
- **Resource Limits** and monitoring to prevent quota exhaustion

## Installation

```bash
npm install @wundr.io/vp-daemon
```

Or with pnpm:

```bash
pnpm add @wundr.io/vp-daemon
```

## Quick Start

### Programmatic Usage

```typescript
import { VPDaemon } from '@wundr.io/vp-daemon';

const daemon = new VPDaemon({
  name: 'vp-daemon',
  port: 8787,
  host: '127.0.0.1',
  maxSessions: 100,
  heartbeatInterval: 30000,
  shutdownTimeout: 10000,
  verbose: false,
});

// Start the daemon
await daemon.start();

// Spawn a session
const task = {
  id: 'task-1',
  type: 'code',
  description: 'Implement new feature',
  priority: 'high',
  status: 'pending',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const session = await daemon.spawnSession('vp-1', task);
console.log('Session spawned:', session.id);

// Get daemon status
const status = daemon.getStatus();
console.log('Daemon status:', status);

// Stop the daemon
await daemon.stop();
```

### CLI Usage

```bash
# Start the daemon
vp-daemon

# With environment variables
VP_DAEMON_PORT=9000 VP_VERBOSE=true vp-daemon
```

### With Wundr CLI

```bash
# Start VP Daemon
wundr vp start

# Check status
wundr vp status

# View logs
wundr vp logs -f

# Stop daemon
wundr vp stop
```

## Configuration

### Daemon Config

```typescript
interface DaemonConfig {
  name: string;           // Daemon name (default: 'vp-daemon')
  port: number;           // WebSocket port (default: 8787)
  host: string;           // Host address (default: '127.0.0.1')
  maxSessions: number;    // Max concurrent sessions (default: 100)
  heartbeatInterval: number;  // Health check interval ms (default: 30000)
  shutdownTimeout: number;    // Graceful shutdown timeout ms (default: 10000)
  verbose: boolean;       // Enable verbose logging (default: false)
}
```

### VP Charter

The VP Charter defines the daemon's responsibilities, constraints, and safety heuristics. Place your charter at `~/vp-daemon/vp-charter.yaml`:

```yaml
name: vp-supervisor
role: Tier1-VP
tier: 1

identity:
  name: "Virtual Principal"
  email: "vp@example.com"

responsibilities:
  - triage_requests
  - manage_session_lifecycle
  - allocate_token_budget

resourceLimits:
  maxSessions: 10
  tokenBudget:
    subscription: 80%
    api: 20%

safetyHeuristics:
  autoApprove:
    - "Read file operations"
    - "Run test suites"
  alwaysReject:
    - "rm -rf /"
    - "Force push to main"
  escalate:
    - "Production deployments"
```

## Architecture

### Components

1. **VPDaemon**: Main orchestration daemon
2. **WebSocketServer**: Handles real-time communication
3. **SessionManager**: Spawns and manages sessions
4. **MemoryManager**: Three-tier memory system (scratchpad/episodic/semantic)

### Memory Tiers

- **Scratchpad**: Working memory for current session context (short-lived)
- **Episodic**: Recent interaction history and session summaries (7 days)
- **Semantic**: Long-term knowledge and learned patterns (permanent)

### WebSocket API

#### Connect

```typescript
const ws = new WebSocket('ws://127.0.0.1:8787');
```

#### Spawn Session

```typescript
ws.send(JSON.stringify({
  type: 'spawn_session',
  payload: {
    vpId: 'vp-1',
    task: {
      type: 'code',
      description: 'Implement feature X',
      priority: 'high',
      status: 'pending',
    },
    sessionType: 'claude-code',
  },
}));
```

#### Get Session Status

```typescript
ws.send(JSON.stringify({
  type: 'session_status',
  payload: { sessionId: 'session_123' },
}));
```

#### Get Daemon Status

```typescript
ws.send(JSON.stringify({
  type: 'daemon_status',
}));
```

#### Health Check

```typescript
ws.send(JSON.stringify({
  type: 'health_check',
}));
```

### Events

The daemon emits the following events:

```typescript
daemon.on('started', () => {
  console.log('Daemon started');
});

daemon.on('stopped', () => {
  console.log('Daemon stopped');
});

daemon.on('session:spawned', (session) => {
  console.log('New session:', session.id);
});

daemon.on('session:completed', (session) => {
  console.log('Session completed:', session.id);
});

daemon.on('healthCheck', (status) => {
  console.log('Health check:', status);
});
```

## API Reference

### VPDaemon

#### `constructor(config: DaemonConfig)`

Create a new daemon instance.

#### `async start(): Promise<void>`

Start the daemon and all subsystems.

#### `async stop(): Promise<void>`

Gracefully stop the daemon.

#### `async spawnSession(vpId: string, task: Task): Promise<Session>`

Spawn a new Claude Code or Claude Flow session.

#### `getStatus(): DaemonStatus`

Get current daemon status and metrics.

### SessionManager

#### `async spawnSession(vpId: string, task: Task, sessionType?: 'claude-code' | 'claude-flow'): Promise<Session>`

Spawn a new session.

#### `getSession(sessionId: string): Session | undefined`

Get session by ID.

#### `getActiveSessions(): Session[]`

Get all active sessions.

#### `async stopSession(sessionId: string): Promise<void>`

Stop a running session.

### MemoryManager

#### `initializeContext(): MemoryContext`

Initialize empty memory context.

#### `storeScratchpad(key: string, value: unknown): void`

Store in working memory.

#### `addEpisodic(entry: Omit<MemoryEntry, 'id'>): MemoryEntry`

Add to episodic memory.

#### `addSemantic(entry: Omit<MemoryEntry, 'id'>): MemoryEntry`

Add to semantic memory.

#### `retrieve(query: string, tier?: MemoryTier): MemoryEntry[]`

Retrieve relevant memories.

## Development

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

### Watch Mode

```bash
npm run dev
```

### Lint

```bash
npm run lint
```

## Environment Variables

- `VP_DAEMON_PORT`: WebSocket server port (default: 8787)
- `VP_DAEMON_HOST`: Host address (default: 127.0.0.1)
- `VP_MAX_SESSIONS`: Maximum concurrent sessions (default: 100)
- `VP_VERBOSE`: Enable verbose logging (default: false)

## License

MIT

## Author

Wundr, by Adaptic.ai

## Links

- [Homepage](https://wundr.io)
- [GitHub](https://github.com/adapticai/wundr)
- [Issues](https://github.com/adapticai/wundr/issues)
