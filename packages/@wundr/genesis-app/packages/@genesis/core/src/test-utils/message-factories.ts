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
    userIds: Array.from(
      { length: Math.floor(Math.random() * 3) + 1 },
      () => generateUserId()
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
  replies.forEach((reply) => {
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
  systemType: 'user_joined' | 'user_left' | 'channel_created' | 'channel_renamed',
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
 * Create a mock message service
 */
export function createMockMessageService() {
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
 * Create a mock reaction service
 */
export function createMockReactionService() {
  return {
    addReaction: vi.fn(),
    removeReaction: vi.fn(),
    getReactions: vi.fn(),
    getReactionSummary: vi.fn(),
  };
}

/**
 * Create a mock thread service
 */
export function createMockThreadService() {
  return {
    createReply: vi.fn(),
    getThread: vi.fn(),
    getThreadSummary: vi.fn(),
    listReplies: vi.fn(),
  };
}

/**
 * Create a mock event emitter
 */
export function createMockEventEmitter() {
  const listeners: Map<string, Array<(...args: unknown[]) => void>> = new Map();

  return {
    on: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) {
        listeners.set(event, []);
      }
      listeners.get(event)!.push(callback);
    }),
    off: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
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
        eventListeners.forEach((callback) => callback(...args));
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
 * Create mock Prisma message model
 */
export function createMockPrismaMessageModel() {
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
 * Create mock Prisma reaction model
 */
export function createMockPrismaReactionModel() {
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
