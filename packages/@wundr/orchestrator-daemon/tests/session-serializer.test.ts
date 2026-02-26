/**
 * Session Serializer Tests
 */

import { SessionSerializer } from '../src/distributed/session-serializer';

import type {
  Session,
  Task,
  MemoryContext,
  SessionMetrics,
} from '../src/types';
import type {
  Message,
  ToolResult,
  SessionCheckpoint,
} from '../src/distributed/session-serializer';

describe('SessionSerializer', () => {
  let serializer: SessionSerializer;
  let mockSession: Session;
  let mockMessages: Message[];
  let mockToolResults: ToolResult[];

  beforeEach(() => {
    serializer = new SessionSerializer();

    const mockTask: Task = {
      id: 'task-1',
      type: 'code',
      description: 'Test task',
      priority: 'high',
      status: 'in_progress',
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: new Date('2025-01-01T01:00:00Z'),
    };

    const mockMemoryContext: MemoryContext = {
      scratchpad: { key: 'value' },
      episodic: [
        {
          id: 'mem-1',
          content: 'Memory entry 1',
          timestamp: new Date('2025-01-01T00:00:00Z'),
          type: 'interaction',
        },
      ],
      semantic: [],
    };

    const mockMetrics: SessionMetrics = {
      tokensUsed: 1000,
      duration: 60000,
      tasksCompleted: 1,
      errorsEncountered: 0,
      averageResponseTime: 500,
    };

    mockSession = {
      id: 'session-1',
      orchestratorId: 'orch-1',
      task: mockTask,
      type: 'claude-code',
      status: 'running',
      startedAt: new Date('2025-01-01T00:00:00Z'),
      memoryContext: mockMemoryContext,
      metrics: mockMetrics,
    };

    mockMessages = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date('2025-01-01T00:00:00Z').toISOString(),
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Hi there!',
        timestamp: new Date('2025-01-01T00:01:00Z').toISOString(),
      },
    ];

    mockToolResults = [
      {
        toolId: 'tool-1',
        toolName: 'ReadFile',
        result: { content: 'file content' },
        timestamp: new Date('2025-01-01T00:02:00Z').toISOString(),
        success: true,
      },
    ];
  });

  describe('serialize', () => {
    it('should serialize a session successfully', () => {
      const serialized = serializer.serialize(
        mockSession,
        mockMessages,
        mockToolResults
      );

      expect(serialized.sessionId).toBe('session-1');
      expect(serialized.orchestratorId).toBe('orch-1');
      expect(serialized.state).toBe('running');
      expect(serialized.messages).toHaveLength(2);
      expect(serialized.toolResults).toHaveLength(1);
      expect(serialized.checkpointVersion).toBe(0);
      expect(serialized.compressed).toBeUndefined();
    });

    it('should include task metadata', () => {
      const serialized = serializer.serialize(
        mockSession,
        mockMessages,
        mockToolResults
      );

      expect(serialized.metadata.taskId).toBe('task-1');
      expect(serialized.metadata.taskType).toBe('code');
      expect(serialized.metadata.taskPriority).toBe('high');
    });

    it('should compress large sessions', () => {
      // Create large message array (> 1MB)
      const largeMessages: Message[] = [];
      const largeContent = 'x'.repeat(10000); // 10KB per message

      for (let i = 0; i < 150; i++) {
        largeMessages.push({
          id: `msg-${i}`,
          role: 'user',
          content: largeContent,
          timestamp: new Date().toISOString(),
        });
      }

      const serialized = serializer.serialize(
        mockSession,
        largeMessages,
        mockToolResults
      );

      expect(serialized.compressed).toBe(true);
      expect(serialized.compressionAlgorithm).toBe('zlib');
      expect(serialized.messages).toHaveLength(1);
      expect(serialized.messages[0].id).toBe('compressed');
    });

    it('should serialize memory context', () => {
      const serialized = serializer.serialize(
        mockSession,
        mockMessages,
        mockToolResults
      );

      expect(serialized.context).toHaveProperty('scratchpad');
      expect(serialized.context).toHaveProperty('episodic');
      expect(serialized.context).toHaveProperty('semantic');
    });
  });

  describe('deserialize', () => {
    it('should deserialize a session successfully', () => {
      const serialized = serializer.serialize(
        mockSession,
        mockMessages,
        mockToolResults
      );
      const { session, messages, toolResults } =
        serializer.deserialize(serialized);

      expect(session.id).toBe('session-1');
      expect(session.orchestratorId).toBe('orch-1');
      expect(session.status).toBe('running');
      expect(messages).toHaveLength(2);
      expect(toolResults).toHaveLength(1);
    });

    it('should restore dates correctly', () => {
      const serialized = serializer.serialize(
        mockSession,
        mockMessages,
        mockToolResults
      );
      const { session } = serializer.deserialize(serialized);

      expect(session.startedAt).toBeInstanceOf(Date);
      expect(session.startedAt.toISOString()).toBe('2025-01-01T00:00:00.000Z');
    });

    it('should decompress compressed sessions', () => {
      // Create large message array to trigger compression
      const largeMessages: Message[] = [];
      const largeContent = 'x'.repeat(10000);

      for (let i = 0; i < 150; i++) {
        largeMessages.push({
          id: `msg-${i}`,
          role: 'user',
          content: largeContent,
          timestamp: new Date().toISOString(),
        });
      }

      const serialized = serializer.serialize(
        mockSession,
        largeMessages,
        mockToolResults
      );
      expect(serialized.compressed).toBe(true);

      const { messages } = serializer.deserialize(serialized);
      expect(messages).toHaveLength(150);
      expect(messages[0].content).toBe(largeContent);
    });

    it('should throw on invalid schema', () => {
      const invalidData = {
        sessionId: 'session-1',
        // Missing required fields
      } as any;

      expect(() => serializer.deserialize(invalidData)).toThrow(
        'Session validation failed'
      );
    });

    it('should throw on unsupported version', () => {
      const serialized = serializer.serialize(
        mockSession,
        mockMessages,
        mockToolResults
      );
      serialized.checkpointVersion = 999;

      expect(() => serializer.deserialize(serialized)).toThrow(
        'Unsupported checkpoint version'
      );
    });

    it('should verify integrity - missing required fields', () => {
      const serialized = serializer.serialize(
        mockSession,
        mockMessages,
        mockToolResults
      );
      serialized.sessionId = '';

      expect(() => serializer.deserialize(serialized)).toThrow(
        'missing required fields'
      );
    });

    it('should verify integrity - invalid timestamps', () => {
      const serialized = serializer.serialize(
        mockSession,
        mockMessages,
        mockToolResults
      );
      serialized.startedAt = 'invalid-date';

      expect(() => serializer.deserialize(serialized)).toThrow(
        'invalid startedAt timestamp'
      );
    });

    it('should verify integrity - endedAt before startedAt', () => {
      mockSession.endedAt = new Date('2024-12-31T00:00:00Z');
      const serialized = serializer.serialize(
        mockSession,
        mockMessages,
        mockToolResults
      );

      expect(() => serializer.deserialize(serialized)).toThrow(
        'endedAt is before startedAt'
      );
    });

    it('should verify integrity - duplicate message IDs', () => {
      const serialized = serializer.serialize(
        mockSession,
        mockMessages,
        mockToolResults
      );
      serialized.messages.push(serialized.messages[0]); // Duplicate

      expect(() => serializer.deserialize(serialized)).toThrow(
        'duplicate message ID'
      );
    });
  });

  describe('getCheckpoint', () => {
    it('should create an incremental checkpoint', () => {
      const newMessages: Message[] = [
        {
          id: 'msg-3',
          role: 'user',
          content: 'New message',
          timestamp: new Date().toISOString(),
        },
      ];

      const contextUpdates = { newKey: 'newValue' };

      const checkpoint = serializer.getCheckpoint(
        mockSession,
        newMessages,
        contextUpdates
      );

      expect(checkpoint.version).toBe(1);
      expect(checkpoint.baseVersion).toBe(0);
      expect(checkpoint.sessionId).toBe('session-1');
      expect(checkpoint.deltaMessages).toHaveLength(1);
      expect(checkpoint.deltaContext).toEqual(contextUpdates);
    });

    it('should increment version on subsequent checkpoints', () => {
      const newMessages: Message[] = [
        {
          id: 'msg-3',
          role: 'user',
          content: 'Message 1',
          timestamp: new Date().toISOString(),
        },
      ];

      const checkpoint1 = serializer.getCheckpoint(
        mockSession,
        newMessages,
        {}
      );
      expect(checkpoint1.version).toBe(1);

      const checkpoint2 = serializer.getCheckpoint(
        mockSession,
        newMessages,
        {}
      );
      expect(checkpoint2.version).toBe(2);
      expect(checkpoint2.baseVersion).toBe(1);
    });
  });

  describe('applyCheckpoint', () => {
    it('should apply checkpoint to session', () => {
      const checkpoint: SessionCheckpoint = {
        version: 1,
        baseVersion: 0,
        deltaMessages: [
          {
            id: 'msg-3',
            role: 'assistant',
            content: 'New response',
            timestamp: new Date().toISOString(),
          },
        ],
        deltaContext: { newKey: 'newValue' },
        timestamp: new Date().toISOString(),
        sessionId: 'session-1',
      };

      const currentContext = { existingKey: 'existingValue' };

      const result = serializer.applyCheckpoint(
        mockSession,
        checkpoint,
        mockMessages,
        currentContext
      );

      expect(result.messages).toHaveLength(3);
      expect(result.messages[2].id).toBe('msg-3');
      expect(result.context).toEqual({
        existingKey: 'existingValue',
        newKey: 'newValue',
      });
    });

    it('should throw on version mismatch', () => {
      const checkpoint: SessionCheckpoint = {
        version: 2,
        baseVersion: 5, // Mismatch
        deltaMessages: [],
        deltaContext: {},
        timestamp: new Date().toISOString(),
        sessionId: 'session-1',
      };

      expect(() =>
        serializer.applyCheckpoint(mockSession, checkpoint, mockMessages, {})
      ).toThrow('Checkpoint version mismatch');
    });

    it('should throw on invalid checkpoint schema', () => {
      const invalidCheckpoint = {
        version: 'invalid',
        // Invalid schema
      } as any;

      expect(() =>
        serializer.applyCheckpoint(
          mockSession,
          invalidCheckpoint,
          mockMessages,
          {}
        )
      ).toThrow('Checkpoint validation failed');
    });
  });

  describe('checkpoint version management', () => {
    it('should track checkpoint versions per session', () => {
      const checkpoint = serializer.getCheckpoint(mockSession, [], {});
      expect(checkpoint.version).toBe(1);

      const versions = serializer.getAllCheckpointVersions();
      expect(versions.get('session-1')).toBe(1);
    });

    it('should clear checkpoint versions', () => {
      serializer.getCheckpoint(mockSession, [], {});
      expect(serializer.getAllCheckpointVersions().get('session-1')).toBe(1);

      serializer.clearCheckpointVersions('session-1');
      expect(
        serializer.getAllCheckpointVersions().get('session-1')
      ).toBeUndefined();
    });
  });
});
