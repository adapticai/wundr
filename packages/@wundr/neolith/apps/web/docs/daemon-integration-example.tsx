/**
 * Example: Daemon Integration Usage
 *
 * This file demonstrates how to use the daemon client and hooks
 * to connect to the orchestrator-daemon from the Neolith web UI.
 *
 * DO NOT import this file - it's documentation only.
 */

'use client';

import { useState } from 'react';
import { useDaemon, useSessionMonitor } from '@/hooks/use-daemon';

// =============================================================================
// Example 1: Basic Connection
// =============================================================================

export function DaemonConnectionExample() {
  const { connected, connecting, error, connect, disconnect } = useDaemon({
    autoConnect: false,
  });

  return (
    <div>
      <h2>Daemon Connection</h2>
      <p>Status: {connected ? 'Connected' : connecting ? 'Connecting...' : 'Disconnected'}</p>
      {error && <p>Error: {error.message}</p>}

      <div>
        {!connected ? (
          <button onClick={connect} disabled={connecting}>
            Connect to Daemon
          </button>
        ) : (
          <button onClick={disconnect}>Disconnect</button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Example 2: Spawn and Manage Sessions
// =============================================================================

export function SessionManagerExample() {
  const {
    connected,
    sessions,
    spawnSession,
    stopSession,
    error,
  } = useDaemon({ autoConnect: true });

  const [isSpawning, setIsSpawning] = useState(false);

  const handleSpawnSession = async () => {
    if (!connected) return;

    setIsSpawning(true);
    try {
      const session = await spawnSession({
        orchestratorId: 'vp_123', // Replace with actual orchestrator ID
        task: {
          type: 'code',
          description: 'Implement new feature',
          priority: 'high',
          status: 'pending',
        },
        sessionType: 'claude-code',
        memoryProfile: 'default',
      });

      console.log('Session spawned:', session.id);
    } catch (err) {
      console.error('Failed to spawn session:', err);
    } finally {
      setIsSpawning(false);
    }
  };

  return (
    <div>
      <h2>Session Manager</h2>

      {!connected ? (
        <p>Connecting to daemon...</p>
      ) : (
        <>
          <button onClick={handleSpawnSession} disabled={isSpawning}>
            {isSpawning ? 'Spawning...' : 'Spawn New Session'}
          </button>

          {error && <p>Error: {error.message}</p>}

          <div>
            <h3>Active Sessions ({sessions.length})</h3>
            {sessions.map((session) => (
              <div key={session.id} style={{ border: '1px solid #ccc', padding: '10px', margin: '5px' }}>
                <p>ID: {session.id}</p>
                <p>Type: {session.type}</p>
                <p>Status: {session.status}</p>
                <p>Task: {session.task.description}</p>
                <p>Tokens Used: {session.metrics.tokensUsed}</p>
                <button onClick={() => stopSession(session.id)}>Stop Session</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// =============================================================================
// Example 3: Real-time Streaming Output
// =============================================================================

export function StreamingOutputExample() {
  const [sessionId] = useState('session_123'); // Replace with actual session ID
  const [output, setOutput] = useState('');
  const [tools, setTools] = useState<string[]>([]);

  const { connected, executeTask } = useDaemon({
    autoConnect: true,
    handlers: {
      onStreamStart: (sid) => {
        if (sid === sessionId) {
          setOutput('');
          console.log('Stream started');
        }
      },
      onStreamChunk: (chunk) => {
        if (chunk.sessionId === sessionId) {
          setOutput((prev) => prev + chunk.chunk);
        }
      },
      onStreamEnd: (sid) => {
        if (sid === sessionId) {
          console.log('Stream ended');
        }
      },
      onToolCallStart: (info) => {
        if (info.sessionId === sessionId) {
          setTools((prev) => [...prev, `${info.toolName} (started)`]);
        }
      },
      onToolCallResult: (info) => {
        if (info.sessionId === sessionId) {
          setTools((prev) =>
            prev.map((t) =>
              t.includes(info.toolName) ? `${info.toolName} (${info.status})` : t
            )
          );
        }
      },
    },
  });

  const handleExecuteTask = () => {
    if (!connected) return;

    executeTask({
      sessionId,
      task: 'Analyze the codebase and suggest improvements',
      streamResponse: true,
    });
  };

  return (
    <div>
      <h2>Streaming Output</h2>

      {!connected ? (
        <p>Connecting to daemon...</p>
      ) : (
        <>
          <button onClick={handleExecuteTask}>Execute Task</button>

          <div>
            <h3>Tools Used</h3>
            <ul>
              {tools.map((tool, i) => (
                <li key={i}>{tool}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3>Output</h3>
            <pre style={{ background: '#f5f5f5', padding: '10px', whiteSpace: 'pre-wrap' }}>
              {output || 'Waiting for output...'}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}

// =============================================================================
// Example 4: Session Monitoring
// =============================================================================

export function SessionMonitorExample({ sessionId }: { sessionId: string }) {
  const { session, streamOutput, connected } = useSessionMonitor(sessionId, {
    onSessionUpdated: (updatedSession) => {
      console.log('Session updated:', updatedSession.status);
    },
    onTaskCompleted: (sid, taskId, result) => {
      console.log('Task completed:', taskId, result);
    },
  });

  if (!connected) {
    return <p>Connecting to daemon...</p>;
  }

  if (!session) {
    return <p>Session not found</p>;
  }

  return (
    <div>
      <h2>Session Monitor: {session.id}</h2>

      <div>
        <h3>Session Info</h3>
        <p>Status: {session.status}</p>
        <p>Type: {session.type}</p>
        <p>Orchestrator: {session.orchestratorId}</p>
        <p>Started: {session.startedAt.toLocaleString()}</p>
      </div>

      <div>
        <h3>Metrics</h3>
        <p>Tokens Used: {session.metrics.tokensUsed}</p>
        <p>Duration: {session.metrics.duration}ms</p>
        <p>Tasks Completed: {session.metrics.tasksCompleted}</p>
        <p>Errors: {session.metrics.errorsEncountered}</p>
      </div>

      <div>
        <h3>Live Output</h3>
        <pre style={{ background: '#f5f5f5', padding: '10px', whiteSpace: 'pre-wrap' }}>
          {streamOutput || 'No output yet...'}
        </pre>
      </div>
    </div>
  );
}

// =============================================================================
// Example 5: Daemon Status Dashboard
// =============================================================================

export function DaemonStatusDashboard() {
  const {
    connected,
    daemonStatus,
    sessions,
    getDaemonStatus,
    reconnectAttempts,
  } = useDaemon({
    autoConnect: true,
  });

  // Refresh status every 10 seconds
  useState(() => {
    if (connected) {
      const interval = setInterval(() => {
        getDaemonStatus();
      }, 10000);
      return () => clearInterval(interval);
    }
  });

  return (
    <div>
      <h2>Daemon Status Dashboard</h2>

      <div>
        <h3>Connection</h3>
        <p>Status: {connected ? '🟢 Connected' : '🔴 Disconnected'}</p>
        {reconnectAttempts > 0 && <p>Reconnect Attempts: {reconnectAttempts}</p>}
      </div>

      {daemonStatus && (
        <>
          <div>
            <h3>Daemon Info</h3>
            <p>Status: {daemonStatus.status}</p>
            <p>Uptime: {Math.floor(daemonStatus.uptime / 1000)}s</p>
            <p>Active Sessions: {daemonStatus.activeSessions}</p>
            <p>Queued Tasks: {daemonStatus.queuedTasks}</p>
          </div>

          <div>
            <h3>Metrics</h3>
            <p>Total Sessions: {daemonStatus.metrics.totalSessionsSpawned}</p>
            <p>Total Tasks: {daemonStatus.metrics.totalTasksProcessed}</p>
            <p>Total Tokens: {daemonStatus.metrics.totalTokensUsed.toLocaleString()}</p>
            <p>Success Rate: {(daemonStatus.metrics.successRate * 100).toFixed(1)}%</p>
            <p>Avg Session Duration: {daemonStatus.metrics.averageSessionDuration}ms</p>
          </div>

          <div>
            <h3>Subsystems</h3>
            {Object.entries(daemonStatus.subsystems).map(([name, subsystem]) => (
              <div key={name}>
                <p>
                  {name}: {subsystem.status === 'running' ? '🟢' : '🔴'} {subsystem.status}
                </p>
                {subsystem.errors && subsystem.errors.length > 0 && (
                  <ul>
                    {subsystem.errors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <div>
        <h3>Local Sessions ({sessions.length})</h3>
        {sessions.map((session) => (
          <div key={session.id}>
            <p>
              {session.id} - {session.status} - {session.metrics.tokensUsed} tokens
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
