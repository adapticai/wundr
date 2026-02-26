/**
 * Session Migration Example
 *
 * Demonstrates how to use SessionSerializer for distributed session management:
 * - Serializing sessions for transfer
 * - Deserializing sessions on different nodes
 * - Creating and applying checkpoints for incremental updates
 * - Handling compression for large sessions
 */

import { SessionSerializer } from '../session-serializer';

import type { Session, Task, MemoryContext, SessionMetrics } from '../../types';
import type { Message, SerializedSession } from '../session-serializer';

/**
 * Example: Basic session serialization and deserialization
 */
function basicSerializationExample(): void {
  console.log('=== Basic Serialization Example ===\n');

  const serializer = new SessionSerializer();

  // Create a mock session
  const task: Task = {
    id: 'task-123',
    type: 'code',
    description: 'Implement authentication feature',
    priority: 'high',
    status: 'in_progress',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const memoryContext: MemoryContext = {
    scratchpad: {
      currentFile: '/src/auth/login.ts',
      filesModified: ['login.ts', 'auth.service.ts'],
    },
    episodic: [
      {
        id: 'mem-1',
        content: 'User requested OAuth2 implementation',
        timestamp: new Date(),
        type: 'interaction',
      },
    ],
    semantic: [],
  };

  const metrics: SessionMetrics = {
    tokensUsed: 5000,
    duration: 120000,
    tasksCompleted: 2,
    errorsEncountered: 0,
    averageResponseTime: 850,
  };

  const session: Session = {
    id: 'session-abc-123',
    orchestratorId: 'orchestrator-1',
    task,
    type: 'claude-code',
    status: 'running',
    startedAt: new Date(),
    memoryContext,
    metrics,
  };

  // Messages exchanged in this session
  const messages: Message[] = [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Implement OAuth2 authentication',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content:
        'I will implement OAuth2 authentication with the following steps...',
      timestamp: new Date().toISOString(),
    },
  ];

  // Serialize the session
  const serialized = serializer.serialize(session, messages, []);
  console.log('Serialized session:', {
    sessionId: serialized.sessionId,
    state: serialized.state,
    messageCount: serialized.messages.length,
    checkpointVersion: serialized.checkpointVersion,
  });

  // Deserialize on another node
  const { session: restoredSession, messages: restoredMessages } =
    serializer.deserialize(serialized);
  console.log('\nRestored session:', {
    sessionId: restoredSession.id,
    status: restoredSession.status,
    messageCount: restoredMessages.length,
  });
}

/**
 * Example: Checkpoint-based incremental migration
 */
function checkpointMigrationExample(): void {
  console.log('\n=== Checkpoint Migration Example ===\n');

  const serializer = new SessionSerializer();

  // Mock session
  const session: Session = {
    id: 'session-xyz-456',
    orchestratorId: 'orchestrator-2',
    task: {
      id: 'task-456',
      type: 'research',
      description: 'Research best practices',
      priority: 'medium',
      status: 'in_progress',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    type: 'claude-flow',
    status: 'running',
    startedAt: new Date(),
    memoryContext: {
      scratchpad: {},
      episodic: [],
      semantic: [],
    },
    metrics: {
      tokensUsed: 0,
      duration: 0,
      tasksCompleted: 0,
      errorsEncountered: 0,
      averageResponseTime: 0,
    },
  };

  // Initial messages
  let currentMessages: Message[] = [
    {
      id: 'msg-1',
      role: 'user',
      content: 'What are the best practices?',
      timestamp: new Date().toISOString(),
    },
  ];

  let currentContext: Record<string, unknown> = {
    topic: 'best practices',
  };

  console.log('Initial state:', {
    messageCount: currentMessages.length,
    contextKeys: Object.keys(currentContext),
  });

  // Create first checkpoint with new messages
  const newMessages1: Message[] = [
    {
      id: 'msg-2',
      role: 'assistant',
      content: 'Here are the best practices...',
      timestamp: new Date().toISOString(),
    },
  ];

  const checkpoint1 = serializer.getCheckpoint(session, newMessages1, {
    researchComplete: false,
  });

  console.log('\nCheckpoint 1 created:', {
    version: checkpoint1.version,
    baseVersion: checkpoint1.baseVersion,
    deltaMessages: checkpoint1.deltaMessages.length,
  });

  // Apply checkpoint 1
  const result1 = serializer.applyCheckpoint(
    session,
    checkpoint1,
    currentMessages,
    currentContext
  );
  currentMessages = result1.messages;
  currentContext = result1.context;

  console.log('After checkpoint 1:', {
    messageCount: currentMessages.length,
    contextKeys: Object.keys(currentContext),
  });

  // Create second checkpoint
  const newMessages2: Message[] = [
    {
      id: 'msg-3',
      role: 'user',
      content: 'Can you provide examples?',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'msg-4',
      role: 'assistant',
      content: 'Here are some examples...',
      timestamp: new Date().toISOString(),
    },
  ];

  const checkpoint2 = serializer.getCheckpoint(session, newMessages2, {
    researchComplete: true,
    examplesProvided: 5,
  });

  console.log('\nCheckpoint 2 created:', {
    version: checkpoint2.version,
    baseVersion: checkpoint2.baseVersion,
    deltaMessages: checkpoint2.deltaMessages.length,
  });

  // Apply checkpoint 2
  const result2 = serializer.applyCheckpoint(
    session,
    checkpoint2,
    currentMessages,
    currentContext
  );
  currentMessages = result2.messages;
  currentContext = result2.context;

  console.log('After checkpoint 2:', {
    messageCount: currentMessages.length,
    contextKeys: Object.keys(currentContext),
    researchComplete: currentContext.researchComplete,
  });
}

/**
 * Example: Large session compression
 */
function compressionExample(): void {
  console.log('\n=== Compression Example ===\n');

  const serializer = new SessionSerializer();

  // Create session with large message history
  const session: Session = {
    id: 'session-large',
    orchestratorId: 'orchestrator-3',
    task: {
      id: 'task-789',
      type: 'code',
      description: 'Large refactoring task',
      priority: 'high',
      status: 'in_progress',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    type: 'claude-code',
    status: 'running',
    startedAt: new Date(),
    memoryContext: {
      scratchpad: {},
      episodic: [],
      semantic: [],
    },
    metrics: {
      tokensUsed: 50000,
      duration: 600000,
      tasksCompleted: 10,
      errorsEncountered: 2,
      averageResponseTime: 1200,
    },
  };

  // Generate large message array (will trigger compression)
  const largeMessages: Message[] = [];
  const longContent = 'x'.repeat(10000); // 10KB per message

  for (let i = 0; i < 150; i++) {
    largeMessages.push({
      id: `msg-${i}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: longContent,
      timestamp: new Date().toISOString(),
    });
  }

  console.log('Original message count:', largeMessages.length);
  console.log(
    'Estimated size:',
    ((largeMessages.length * longContent.length) / 1024 / 1024).toFixed(2),
    'MB'
  );

  // Serialize (will automatically compress)
  const serialized = serializer.serialize(session, largeMessages, []);
  console.log('\nSerialized with compression:', {
    compressed: serialized.compressed,
    algorithm: serialized.compressionAlgorithm,
    messageCount: serialized.messages.length,
  });

  // Deserialize (will automatically decompress)
  const { messages: decompressed } = serializer.deserialize(serialized);
  console.log('\nDecompressed successfully:', {
    messageCount: decompressed.length,
    firstMessageLength: decompressed[0].content.length,
  });
}

/**
 * Example: Migration across nodes with validation
 */
function migrationWithValidationExample(): void {
  console.log('\n=== Migration with Validation Example ===\n');

  const serializer = new SessionSerializer();

  const session: Session = {
    id: 'session-validate',
    orchestratorId: 'orchestrator-4',
    task: {
      id: 'task-validate',
      type: 'analysis',
      description: 'Data analysis task',
      priority: 'medium',
      status: 'in_progress',
      createdAt: new Date('2025-01-15T10:00:00Z'),
      updatedAt: new Date('2025-01-15T11:00:00Z'),
    },
    type: 'claude-code',
    status: 'running',
    startedAt: new Date('2025-01-15T10:00:00Z'),
    endedAt: new Date('2025-01-15T12:00:00Z'),
    memoryContext: {
      scratchpad: {},
      episodic: [],
      semantic: [],
    },
    metrics: {
      tokensUsed: 10000,
      duration: 7200000,
      tasksCompleted: 5,
      errorsEncountered: 1,
      averageResponseTime: 950,
    },
  };

  const messages: Message[] = [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Analyze the dataset',
      timestamp: new Date('2025-01-15T10:00:00Z').toISOString(),
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: 'Analysis complete',
      timestamp: new Date('2025-01-15T11:30:00Z').toISOString(),
    },
  ];

  // Serialize on source node
  const serialized = serializer.serialize(session, messages, []);
  console.log('Serialized on source node:', serialized.sessionId);

  // Transfer serialized data (simulated)
  const transferred: SerializedSession = JSON.parse(JSON.stringify(serialized));

  try {
    // Deserialize on target node (with validation)
    const { session: validated } = serializer.deserialize(transferred);
    console.log('✓ Validation passed on target node');
    console.log('  Session ID:', validated.id);
    console.log('  Status:', validated.status);
    console.log('  Duration:', validated.metrics.duration, 'ms');
  } catch (error) {
    console.error('✗ Validation failed:', (error as Error).message);
  }

  // Demonstrate validation failure
  console.log('\nTesting validation with corrupted data:');
  const corrupted = JSON.parse(JSON.stringify(serialized));
  corrupted.startedAt = 'invalid-date';

  try {
    serializer.deserialize(corrupted);
  } catch (error) {
    console.log('✓ Caught validation error:', (error as Error).message);
  }
}

/**
 * Run all examples
 */
export function runSessionMigrationExamples(): void {
  basicSerializationExample();
  checkpointMigrationExample();
  compressionExample();
  migrationWithValidationExample();

  console.log('\n=== All examples completed successfully ===\n');
}

// Run if executed directly
if (require.main === module) {
  runSessionMigrationExamples();
}
