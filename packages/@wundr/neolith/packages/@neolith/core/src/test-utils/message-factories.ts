/**
 * Message Test Data Factories
 *
 * Factory functions for creating consistent mock message data in tests.
 * These factories provide sensible defaults while allowing overrides
 * for specific test scenarios.
 *
 * @module @genesis/core/test-utils/message-factories
 */

import { vi } from 'vitest';

// =============================================================================
// TYPE DEFINITIONS (inline to avoid circular dependencies in tests)
// =============================================================================

/**
 * Message content type enumeration
 */
export type MessageContentType = 'TEXT' | 'SYSTEM' | 'FILE' | 'CODE';

/**
 * Message entity
 */
export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  type: MessageContentType;
  parentId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  editedAt?: Date;
  deletedAt?: Date;
}

/**
 * Reaction entity
 */
export interface Reaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: Date;
}

/**
 * Message author
 */
export interface MessageAuthor {
  id: string;
  name?: string;
  displayName?: string;
  avatarUrl?: string;
  isVP: boolean;
}

/**
 * Reaction summary
 */
export interface ReactionSummary {
  emoji: string;
  count: number;
  hasReacted: boolean;
  userIds: string[];
}

/**
 * Message with author
 */
export interface MessageWithAuthor extends Message {
  author: MessageAuthor;
}

/**
 * Message with full relations
 */
export interface MessageWithRelations extends MessageWithAuthor {
  reactions: ReactionSummary[];
  replyCount: number;
  latestReplies?: MessageWithAuthor[];
  channel: {
    id: string;
    name: string;
    type: string;
  };
}

/**
 * Thread
 */
export interface Thread {
  parent: MessageWithAuthor;
  replies: MessageWithAuthor[];
  replyCount: number;
  participants: MessageAuthor[];
}

// =============================================================================
// ID GENERATORS
// =============================================================================

let messageIdCounter = 0;
let reactionIdCounter = 0;

/**
 * Generate a unique test message ID
 */
export function generateMessageId(): string {
  messageIdCounter += 1;
  return `msg_${Date.now()}_${messageIdCounter}`;
}

/**
 * Generate a unique test reaction ID
 */
export function generateReactionId(): string {
  reactionIdCounter += 1;
  return `rxn_${Date.now()}_${reactionIdCounter}`;
}

/**
 * Generate a unique test channel ID
 */
export function generateChannelId(): string {
  return `ch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Generate a unique test user ID
 */
export function generateUserId(): string {
  return `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Reset ID counters (useful between test suites)
 */
export function resetMessageIdCounters(): void {
  messageIdCounter = 0;
  reactionIdCounter = 0;
}

// =============================================================================
// MESSAGE FACTORIES
// =============================================================================

/**
 * Create a mock message
 */
export function createMockMessage(overrides?: Partial<Message>): Message {
  const now = new Date();
  const id = overrides?.id ?? generateMessageId();
  const channelId = overrides?.channelId ?? generateChannelId();
  const authorId = overrides?.authorId ?? generateUserId();

  return {
    id,
    channelId,
    authorId,
    content: 'This is a test message',
    type: 'TEXT',
    parentId: undefined,
    metadata: undefined,
    createdAt: now,
    updatedAt: now,
    editedAt: undefined,
    deletedAt: undefined,
    ...overrides,
  };
}

/**
 * Create a mock message author
 */
export function createMockMessageAuthor(
  overrides?: Partial<MessageAuthor>
): MessageAuthor {
  const id = overrides?.id ?? generateUserId();

  return {
    id,
    name: 'Test User',
    displayName: 'Test User',
    avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`,
    isVP: false,
    ...overrides,
  };
}

/**
 * Create a mock message with author
 */
export function createMockMessageWithAuthor(
  messageOverrides?: Partial<Message>,
  authorOverrides?: Partial<MessageAuthor>
): MessageWithAuthor {
  const message = createMockMessage(messageOverrides);
  const author = createMockMessageAuthor({
    id: message.authorId,
    ...authorOverrides,
  });

  return {
    ...message,
    author,
  };
}

/**
 * Create a mock message with full relations
 */
export function createMockMessageWithRelations(
  messageOverrides?: Partial<Message>,
  options?: {
    reactions?: ReactionSummary[];
    replyCount?: number;
    latestReplies?: MessageWithAuthor[];
    channelName?: string;
    channelType?: string;
  }
): MessageWithRelations {
  const messageWithAuthor = createMockMessageWithAuthor(messageOverrides);

  return {
    ...messageWithAuthor,
    reactions: options?.reactions ?? [],
    replyCount: options?.replyCount ?? 0,
    latestReplies: options?.latestReplies,
    channel: {
      id: messageWithAuthor.channelId,
      name: options?.channelName ?? 'test-channel',
      type: options?.channelType ?? 'PUBLIC',
    },
  };
}

/**
 * Create a list of mock messages
 */
export function createMockMessageList(
  count: number,
  overrides?: Partial<Message>
): Message[] {
  const channelId = overrides?.channelId ?? generateChannelId();
  const baseTime = new Date();

  return Array.from({ length: count }, (_, index) => {
    // Messages are created with decreasing timestamps (newest first)
    const createdAt = new Date(baseTime.getTime() - index * 60000);
    return createMockMessage({
      ...overrides,
      channelId,
      content: `Test message ${index + 1}`,
      createdAt,
      updatedAt: createdAt,
    });
  });
}

/**
 * Create a list of mock messages with authors
 */
export function createMockMessageListWithAuthors(
  count: number,
  overrides?: Partial<Message>
): MessageWithAuthor[] {
  const channelId = overrides?.channelId ?? generateChannelId();
  const baseTime = new Date();

  return Array.from({ length: count }, (_, index) => {
    const createdAt = new Date(baseTime.getTime() - index * 60000);
    return createMockMessageWithAuthor({
      ...overrides,
      channelId,
      content: `Test message ${index + 1}`,
      createdAt,
      updatedAt: createdAt,
    });
  });
}

// =============================================================================
// REACTION FACTORIES
// =============================================================================

/**
 * Create a mock reaction
 */
export function createMockReaction(overrides?: Partial<Reaction>): Reaction {
  const now = new Date();
  const id = overrides?.id ?? generateReactionId();
  const messageId = overrides?.messageId ?? generateMessageId();
  const userId = overrides?.userId ?? generateUserId();

  return {
    id,
    messageId,
    userId,
    emoji: '\u{1F44D}', // thumbs up
    createdAt: now,
    ...overrides,
  };
}

/**
 * Create a mock reaction summary
 */
export function createMockReactionSummary(
  overrides?: Partial<ReactionSummary>
): ReactionSummary {
  return {
    emoji: '\u{1F44D}',
    count: 1,
    hasReacted: false,
    userIds: [generateUserId()],
    ...overrides,
  };
}

/**
 * Create a list of mock reactions for a message
 */
export function createMockReactionList(
  messageId: string,
  count: number,
  options?: { emoji?: string; uniqueUsers?: boolean }
): Reaction[] {
  const emoji = options?.emoji ?? '\u{1F44D}';
  const baseTime = new Date();

  return Array.from({ length: count }, (_, index) => {
    const createdAt = new Date(baseTime.getTime() - index * 1000);
    return createMockReaction({
      messageId,
      emoji,
      userId: options?.uniqueUsers ? generateUserId() : undefined,
      createdAt,
    });
  });
}

/**
 * Create mock reaction summaries for a message (grouped by emoji)
 */
export function createMockReactionSummaries(
  emojis: string[],
  options?: { currentUserId?: string }
): ReactionSummary[] {
  return emojis.map((emoji, index) => ({
    emoji,
    count: Math.floor(Math.random() * 5) + 1,
    hasReacted: index === 0 && !!options?.currentUserId, // First emoji reacted by current user
    userIds: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, () =>
      generateUserId()
    ),
  }));
}

// =============================================================================
// THREAD FACTORIES
// =============================================================================

/**
 * Create a mock thread with replies
 */
export function createMockThread(
  replyCount?: number,
  options?: {
    parentOverrides?: Partial<Message>;
    channelId?: string;
  }
): Thread {
  const channelId = options?.channelId ?? generateChannelId();
  const parent = createMockMessageWithAuthor({
    ...options?.parentOverrides,
    channelId,
    parentId: undefined, // Parent messages don't have parentId
  });

  const count = replyCount ?? 3;
  const replies = createMockThreadReplies(parent.id, count, channelId);
  const participantMap = new Map<string, MessageAuthor>();

  // Collect unique participants
  participantMap.set(parent.author.id, parent.author);
  replies.forEach(reply => {
    if (!participantMap.has(reply.author.id)) {
      participantMap.set(reply.author.id, reply.author);
    }
  });

  return {
    parent,
    replies,
    replyCount: count,
    participants: Array.from(participantMap.values()),
  };
}

/**
 * Create mock thread replies
 */
export function createMockThreadReplies(
  parentId: string,
  count: number,
  channelId?: string
): MessageWithAuthor[] {
  const channel = channelId ?? generateChannelId();
  const baseTime = new Date();

  return Array.from({ length: count }, (_, index) => {
    const createdAt = new Date(baseTime.getTime() + index * 60000); // Replies are newer
    return createMockMessageWithAuthor({
      channelId: channel,
      parentId,
      content: `Thread reply ${index + 1}`,
      createdAt,
      updatedAt: createdAt,
    });
  });
}

// =============================================================================
// SYSTEM MESSAGE FACTORIES
// =============================================================================

/**
 * Create a mock system message
 */
export function createMockSystemMessage(
  systemType:
    | 'user_joined'
    | 'user_left'
    | 'channel_created'
    | 'channel_renamed',
  overrides?: Partial<Message>
): Message {
  const contentMap = {
    user_joined: 'User joined the channel',
    user_left: 'User left the channel',
    channel_created: 'Channel was created',
    channel_renamed: 'Channel was renamed',
  };

  return createMockMessage({
    ...overrides,
    type: 'SYSTEM',
    content: contentMap[systemType],
    metadata: {
      systemType,
      ...overrides?.metadata,
    },
  });
}

/**
 * Create a mock code message
 */
export function createMockCodeMessage(
  code: string,
  language: string,
  overrides?: Partial<Message>
): Message {
  return createMockMessage({
    ...overrides,
    type: 'CODE',
    content: code,
    metadata: {
      codeLanguage: language,
      ...overrides?.metadata,
    },
  });
}

/**
 * Create a mock file message
 */
export function createMockFileMessage(
  filename: string,
  mimeType: string,
  overrides?: Partial<Message>
): Message {
  return createMockMessage({
    ...overrides,
    type: 'FILE',
    content: `Shared file: ${filename}`,
    metadata: {
      attachments: [
        {
          id: `att_${Date.now()}`,
          filename,
          mimeType,
          size: 1024,
          url: `https://cdn.example.com/files/${filename}`,
        },
      ],
      ...overrides?.metadata,
    },
  });
}

// =============================================================================
// MOCK SERVICE FACTORIES
// =============================================================================

/**
 * Mock message service interface for type safety
 */
export interface MockMessageService {
  sendMessage: ReturnType<typeof vi.fn>;
  getMessage: ReturnType<typeof vi.fn>;
  updateMessage: ReturnType<typeof vi.fn>;
  deleteMessage: ReturnType<typeof vi.fn>;
  listMessages: ReturnType<typeof vi.fn>;
  searchMessages: ReturnType<typeof vi.fn>;
}

/**
 * Create a mock message service for testing message functionality
 *
 * @returns A mock message service with all methods as vi.fn() mocks
 *
 * @example
 * ```typescript
 * const messageService = createMockMessageService();
 * messageService.sendMessage.mockResolvedValue(createMockMessage());
 * const message = await messageService.sendMessage({ channelId: 'ch_123', content: 'Hello' });
 * expect(messageService.sendMessage).toHaveBeenCalledOnce();
 * ```
 */
export function createMockMessageService(): MockMessageService {
  return {
    sendMessage: vi.fn(),
    getMessage: vi.fn(),
    updateMessage: vi.fn(),
    deleteMessage: vi.fn(),
    listMessages: vi.fn(),
    searchMessages: vi.fn(),
  };
}

/**
 * Mock reaction service interface for type safety
 */
export interface MockReactionService {
  addReaction: ReturnType<typeof vi.fn>;
  removeReaction: ReturnType<typeof vi.fn>;
  getReactions: ReturnType<typeof vi.fn>;
  getReactionSummary: ReturnType<typeof vi.fn>;
}

/**
 * Create a mock reaction service for testing reaction functionality
 *
 * @returns A mock reaction service with all methods as vi.fn() mocks
 *
 * @example
 * ```typescript
 * const reactionService = createMockReactionService();
 * reactionService.addReaction.mockResolvedValue(createMockReaction());
 * await reactionService.addReaction('msg_123', 'user_456', '\u{1F44D}');
 * expect(reactionService.addReaction).toHaveBeenCalledOnce();
 * ```
 */
export function createMockReactionService(): MockReactionService {
  return {
    addReaction: vi.fn(),
    removeReaction: vi.fn(),
    getReactions: vi.fn(),
    getReactionSummary: vi.fn(),
  };
}

/**
 * Mock thread service interface for type safety
 */
export interface MockThreadService {
  createReply: ReturnType<typeof vi.fn>;
  getThread: ReturnType<typeof vi.fn>;
  getThreadSummary: ReturnType<typeof vi.fn>;
  listReplies: ReturnType<typeof vi.fn>;
}

/**
 * Create a mock thread service for testing thread functionality
 *
 * @returns A mock thread service with all methods as vi.fn() mocks
 *
 * @example
 * ```typescript
 * const threadService = createMockThreadService();
 * threadService.getThread.mockResolvedValue(createMockThread());
 * const thread = await threadService.getThread('msg_parent');
 * expect(thread.parent).toBeDefined();
 * ```
 */
export function createMockThreadService(): MockThreadService {
  return {
    createReply: vi.fn(),
    getThread: vi.fn(),
    getThreadSummary: vi.fn(),
    listReplies: vi.fn(),
  };
}

/**
 * Event listener callback type
 */
export type EventListenerCallback = (...args: unknown[]) => void;

/**
 * Mock event emitter interface for type safety
 */
export interface MockEventEmitter {
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  removeAllListeners: ReturnType<typeof vi.fn>;
  /** Internal helper to access listeners for testing */
  _getListeners: () => Map<string, EventListenerCallback[]>;
}

/**
 * Create a mock event emitter for testing pub/sub functionality
 *
 * @returns A mock event emitter with on, off, emit, and removeAllListeners methods
 *
 * @example
 * ```typescript
 * const emitter = createMockEventEmitter();
 * const callback = vi.fn();
 * emitter.on('message', callback);
 * emitter.emit('message', { id: 'msg_123' });
 * expect(callback).toHaveBeenCalledWith({ id: 'msg_123' });
 * ```
 */
export function createMockEventEmitter(): MockEventEmitter {
  const listeners: Map<string, EventListenerCallback[]> = new Map();

  return {
    on: vi.fn((event: string, callback: EventListenerCallback) => {
      if (!listeners.has(event)) {
        listeners.set(event, []);
      }
      listeners.get(event)!.push(callback);
    }),
    off: vi.fn((event: string, callback: EventListenerCallback) => {
      const eventListeners = listeners.get(event);
      if (eventListeners) {
        const index = eventListeners.indexOf(callback);
        if (index > -1) {
          eventListeners.splice(index, 1);
        }
      }
    }),
    emit: vi.fn((event: string, ...args: unknown[]) => {
      const eventListeners = listeners.get(event);
      if (eventListeners) {
        eventListeners.forEach(callback => callback(...args));
      }
    }),
    removeAllListeners: vi.fn((event?: string) => {
      if (event) {
        listeners.delete(event);
      } else {
        listeners.clear();
      }
    }),
    _getListeners: () => listeners,
  };
}

// =============================================================================
// MOCK PRISMA CLIENT EXTENSIONS
// =============================================================================

/**
 * Mock Prisma message model interface for type safety
 */
export interface MockPrismaMessageModel {
  findUnique: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
  aggregate: ReturnType<typeof vi.fn>;
}

/**
 * Create mock Prisma message model for testing database operations
 *
 * @returns A mock Prisma message model with all methods as vi.fn() mocks
 *
 * @example
 * ```typescript
 * const messageModel = createMockPrismaMessageModel();
 * messageModel.findUnique.mockResolvedValue(createMockMessage());
 * const message = await messageModel.findUnique({ where: { id: 'msg_123' } });
 * expect(message).toBeDefined();
 * ```
 */
export function createMockPrismaMessageModel(): MockPrismaMessageModel {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  };
}

/**
 * Mock Prisma reaction model interface for type safety
 */
export interface MockPrismaReactionModel {
  findUnique: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
  groupBy: ReturnType<typeof vi.fn>;
}

/**
 * Create mock Prisma reaction model for testing reaction database operations
 *
 * @returns A mock Prisma reaction model with all methods as vi.fn() mocks
 *
 * @example
 * ```typescript
 * const reactionModel = createMockPrismaReactionModel();
 * reactionModel.create.mockResolvedValue(createMockReaction());
 * const reaction = await reactionModel.create({ data: { messageId: 'msg_123', userId: 'user_456', emoji: '\u{1F44D}' } });
 * expect(reaction.emoji).toBe('\u{1F44D}');
 * ```
 */
export function createMockPrismaReactionModel(): MockPrismaReactionModel {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  };
}

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

export const MessageFactories = {
  message: createMockMessage,
  messageWithAuthor: createMockMessageWithAuthor,
  messageWithRelations: createMockMessageWithRelations,
  messageList: createMockMessageList,
  messageListWithAuthors: createMockMessageListWithAuthors,
  reaction: createMockReaction,
  reactionSummary: createMockReactionSummary,
  reactionList: createMockReactionList,
  reactionSummaries: createMockReactionSummaries,
  thread: createMockThread,
  threadReplies: createMockThreadReplies,
  systemMessage: createMockSystemMessage,
  codeMessage: createMockCodeMessage,
  fileMessage: createMockFileMessage,
  author: createMockMessageAuthor,
  messageService: createMockMessageService,
  reactionService: createMockReactionService,
  threadService: createMockThreadService,
  eventEmitter: createMockEventEmitter,
  prismaMessage: createMockPrismaMessageModel,
  prismaReaction: createMockPrismaReactionModel,
  resetCounters: resetMessageIdCounters,
};

export default MessageFactories;
