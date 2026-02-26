# WebSocket Streaming Guide

## Overview

The Orchestrator Daemon now supports real-time streaming of LLM responses through WebSocket
connections. This enables clients to receive incremental updates as tasks are executed, including
streaming text chunks and tool execution notifications.

## New Message Types

### Client → Server Messages

#### `execute_task`

Execute a task in an existing session with optional streaming support.

```typescript
{
  type: 'execute_task',
  payload: {
    sessionId: string,
    task: string,
    context?: Record<string, unknown>,
    streamResponse?: boolean  // Enable streaming (default: true)
  }
}
```

### Server → Client Messages

#### `stream_start`

Notifies client that streaming is beginning.

```typescript
{
  type: 'stream_start',
  sessionId: string,
  metadata?: Record<string, unknown>
}
```

#### `stream_chunk`

Sends a chunk of streaming response.

```typescript
{
  type: 'stream_chunk',
  data: {
    sessionId: string,
    chunk: string,
    metadata?: {
      type?: 'text' | 'thinking' | 'tool_use',
      index?: number,
      total?: number
    }
  }
}
```

#### `stream_end`

Notifies client that streaming is complete.

```typescript
{
  type: 'stream_end',
  sessionId: string,
  metadata?: Record<string, unknown>
}
```

#### `tool_call_start`

Notifies when a tool call starts.

```typescript
{
  type: 'tool_call_start',
  data: {
    sessionId: string,
    toolName: string,
    toolInput?: Record<string, unknown>,
    status: 'started',
    timestamp: Date
  }
}
```

#### `tool_call_result`

Sends tool call result.

```typescript
{
  type: 'tool_call_result',
  data: {
    sessionId: string,
    toolName: string,
    status: 'completed' | 'failed',
    result?: unknown,
    error?: string,
    timestamp: Date
  }
}
```

#### `task_executing`

Notifies that a task is executing.

```typescript
{
  type: 'task_executing',
  sessionId: string,
  taskId: string
}
```

#### `task_completed`

Notifies that a task has completed.

```typescript
{
  type: 'task_completed',
  sessionId: string,
  taskId: string,
  result?: unknown
}
```

#### `task_failed`

Notifies that a task has failed.

```typescript
{
  type: 'task_failed',
  sessionId: string,
  taskId: string,
  error: string
}
```

## Server API

### New Methods

#### `streamToClient(sessionId, chunk, metadata?)`

Send streaming chunks to all clients subscribed to a session.

```typescript
wsServer.streamToClient('session-123', 'Here is some text from the LLM...', {
  type: 'text',
  index: 0,
});
```

#### `notifyStreamStart(sessionId, metadata?)`

Notify clients that streaming is starting.

```typescript
wsServer.notifyStreamStart('session-123', {
  model: 'claude-sonnet-4',
  task: 'code-generation',
});
```

#### `notifyStreamEnd(sessionId, metadata?)`

Notify clients that streaming has ended.

```typescript
wsServer.notifyStreamEnd('session-123', {
  totalChunks: 42,
  duration: 5000,
});
```

#### `notifyToolExecution(sessionId, toolName, status, options?)`

Notify about tool execution status.

```typescript
// Tool started
wsServer.notifyToolExecution('session-123', 'file_reader', 'started', {
  toolInput: { path: '/path/to/file' },
});

// Tool completed
wsServer.notifyToolExecution('session-123', 'file_reader', 'completed', {
  result: { content: '...' },
});

// Tool failed
wsServer.notifyToolExecution('session-123', 'file_reader', 'failed', { error: 'File not found' });
```

#### `notifyTaskExecuting(sessionId, taskId)`

Notify that a task is executing.

```typescript
wsServer.notifyTaskExecuting('session-123', 'task-456');
```

#### `notifyTaskCompleted(sessionId, taskId, result?)`

Notify that a task has completed.

```typescript
wsServer.notifyTaskCompleted('session-123', 'task-456', {
  filesModified: ['src/index.ts'],
  linesChanged: 42,
});
```

#### `notifyTaskFailed(sessionId, taskId, error)`

Notify that a task has failed.

```typescript
wsServer.notifyTaskFailed('session-123', 'task-456', 'TypeScript compilation failed');
```

## Session Management

### Automatic Subscription

When a client sends an `execute_task` message, they are automatically subscribed to that session's
updates. All streaming messages will be sent only to subscribed clients.

### Unsubscription

Clients are automatically unsubscribed when:

- They send a `stop_session` message
- Their connection is closed
- An error occurs on their connection

### Concurrent Sessions

The WebSocket server supports multiple concurrent sessions with different clients. Each session
maintains its own set of subscribed clients, allowing:

- Multiple clients to watch the same session
- A single client to watch multiple sessions
- Isolated streaming per session

## Usage Example

### Client Side

```typescript
const ws = new WebSocket('ws://localhost:8787');

ws.on('open', () => {
  // Spawn a session
  ws.send(
    JSON.stringify({
      type: 'spawn_session',
      payload: {
        orchestratorId: 'orchestrator-1',
        task: {
          type: 'code',
          description: 'Implement authentication',
          priority: 'high',
          status: 'pending',
        },
        sessionType: 'claude-code',
      },
    })
  );
});

ws.on('message', data => {
  const message = JSON.parse(data.toString());

  switch (message.type) {
    case 'session_spawned':
      console.log('Session spawned:', message.session.id);

      // Execute a task
      ws.send(
        JSON.stringify({
          type: 'execute_task',
          payload: {
            sessionId: message.session.id,
            task: 'Add JWT authentication to the API',
            streamResponse: true,
          },
        })
      );
      break;

    case 'stream_start':
      console.log('Streaming started for session:', message.sessionId);
      break;

    case 'stream_chunk':
      process.stdout.write(message.data.chunk);
      break;

    case 'stream_end':
      console.log('\nStreaming completed');
      break;

    case 'tool_call_start':
      console.log(`Tool started: ${message.data.toolName}`);
      break;

    case 'tool_call_result':
      console.log(`Tool ${message.data.status}: ${message.data.toolName}`);
      break;

    case 'task_completed':
      console.log('Task completed:', message.taskId);
      break;

    case 'error':
      console.error('Error:', message.error);
      break;
  }
});
```

### Server Side Integration

```typescript
import { OrchestratorWebSocketServer } from './core/websocket-server';

const wsServer = new OrchestratorWebSocketServer(8787, '127.0.0.1');

// Handle task execution requests
wsServer.on('execute_task', async ({ ws, payload }) => {
  const { sessionId, task, streamResponse } = payload;

  try {
    // Notify task is executing
    wsServer.notifyTaskExecuting(sessionId, 'task-1');

    // Start streaming if requested
    if (streamResponse) {
      wsServer.notifyStreamStart(sessionId, { task });
    }

    // Execute task with LLM
    const stream = await llmClient.createMessage({
      messages: [{ role: 'user', content: task }],
      stream: true,
    });

    // Stream chunks to client
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta') {
        wsServer.streamToClient(sessionId, chunk.delta.text, {
          type: 'text',
        });
      }

      if (chunk.type === 'tool_use') {
        wsServer.notifyToolExecution(sessionId, chunk.name, 'started', { toolInput: chunk.input });

        // Execute tool...
        const result = await executeTool(chunk.name, chunk.input);

        wsServer.notifyToolExecution(sessionId, chunk.name, 'completed', { result });
      }
    }

    // End streaming
    wsServer.notifyStreamEnd(sessionId);
    wsServer.notifyTaskCompleted(sessionId, 'task-1');
  } catch (error) {
    wsServer.notifyTaskFailed(sessionId, 'task-1', error.message);
  }
});

await wsServer.start();
```

## Benefits

1. **Real-time Updates**: Clients receive immediate feedback as the LLM generates responses
2. **Tool Visibility**: Track exactly which tools are being used and when
3. **Better UX**: Users can see progress instead of waiting for completion
4. **Concurrent Sessions**: Support multiple simultaneous tasks across different clients
5. **Session Isolation**: Each session's streaming is isolated to its subscribed clients
6. **Automatic Cleanup**: Subscriptions are automatically managed on connection close

## Additional Methods

### `getSessionClientCount(sessionId)`

Get the number of clients subscribed to a session.

```typescript
const count = wsServer.getSessionClientCount('session-123');
console.log(`${count} clients watching this session`);
```

### `getActiveSessionIds()`

Get all active session IDs.

```typescript
const sessionIds = wsServer.getActiveSessionIds();
console.log('Active sessions:', sessionIds);
```

## Architecture Notes

- **Session-Client Mapping**: The server maintains a `Map<string, Set<WebSocket>>` to track which
  clients are subscribed to which sessions
- **Automatic Cleanup**: When clients disconnect, they are removed from all session subscriptions
- **Broadcast Optimization**: Messages are only sent to clients subscribed to the relevant session
- **Concurrent Support**: The architecture supports multiple concurrent sessions without
  interference
