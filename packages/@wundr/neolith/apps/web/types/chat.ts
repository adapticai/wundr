/**
 * Chat Types for Genesis App
 * Production-grade type definitions for real-time messaging
 */

/**
 * User online status states
 */
export type UserStatus = 'online' | 'offline' | 'away' | 'busy';

/**
 * Message type classification
 */
export type MessageType = 'TEXT' | 'SYSTEM' | 'FILE' | 'COMMAND';

/**
 * Attachment media types
 */
export type AttachmentType = 'image' | 'file' | 'video' | 'audio';

/**
 * Channel visibility types
 */
export type ChannelType = 'public' | 'private' | 'direct';

/**
 * Represents a user in the chat system
 */
export interface User {
  /** Unique user identifier */
  readonly id: string;
  /** Display name */
  name: string;
  /** User email address */
  email: string;
  /** Profile image URL */
  image?: string | null;
  /** Current online status */
  status?: UserStatus;
  /** Whether user has orchestrator privileges */
  isOrchestrator?: boolean;
}

/**
 * Emoji reaction on a message
 */
export interface Reaction {
  /** Unicode emoji character */
  emoji: string;
  /** Total reaction count */
  count: number;
  /** User IDs who reacted (normalized for performance) */
  userIds: readonly string[];
  /** Whether current user has reacted */
  hasReacted: boolean;
}

/**
 * Chat message with metadata and relationships
 */
export interface Message {
  /** Unique message identifier */
  readonly id: string;
  /** Message text content */
  content: string;
  /** Author user ID */
  readonly authorId: string;
  /** Denormalized author data */
  author: User;
  /** Channel this message belongs to */
  readonly channelId: string;
  /** Parent message ID for threaded replies */
  parentId?: string | null;
  /** Message creation timestamp (ISO 8601) */
  readonly createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
  /** Edit timestamp if message was edited (ISO 8601) */
  editedAt?: string | null;
  /** Emoji reactions on this message */
  reactions: readonly Reaction[];
  /** Number of replies in thread */
  replyCount: number;
  /** Preview of recent replies */
  replyPreview?: readonly Message[];
  /** Users mentioned in message */
  mentions: readonly User[];
  /** File attachments */
  attachments: readonly Attachment[];
  /** Soft delete flag */
  isDeleted?: boolean;
}

/**
 * File attachment metadata
 */
export interface Attachment {
  /** Unique attachment identifier */
  readonly id: string;
  /** Original filename */
  name: string;
  /** Public URL for download */
  url: string;
  /** Media type classification */
  type: AttachmentType;
  /** File size in bytes */
  size: number;
  /** MIME type */
  mimeType: string;
}

/**
 * Chat channel or direct message thread
 */
export interface Channel {
  /** Unique channel identifier */
  readonly id: string;
  /** Channel display name */
  name: string;
  /** Channel description/topic */
  description?: string;
  /** Channel visibility type */
  type: ChannelType;
  /** Parent workspace ID */
  readonly workspaceId: string;
  /** Channel creation timestamp (ISO 8601) */
  readonly createdAt: string;
  /** Channel members */
  members: readonly User[];
  /** Unread message count for current user */
  unreadCount: number;
  /** Most recent message preview */
  lastMessage?: Message;
  /** Whether channel is starred by current user */
  isStarred?: boolean;
}

/**
 * Message thread with parent and replies
 */
export interface Thread {
  /** Root message that started the thread */
  parentMessage: Message;
  /** Replies in chronological order */
  messages: readonly Message[];
  /** Users who have participated in thread */
  participants: readonly User[];
}

/**
 * Real-time typing indicator
 */
export interface TypingUser {
  /** User currently typing */
  user: User;
  /** Channel where user is typing */
  channelId: string;
  /** Unix timestamp in milliseconds */
  timestamp: number;
}

/**
 * Metadata for messages (structured data)
 */
export interface MessageMetadata {
  /** Custom key-value pairs for extensibility */
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Input for creating a new message
 */
export interface SendMessageInput {
  /** Message text content */
  content: string;
  /** Target channel ID */
  channelId: string;
  /** Message classification type */
  type?: MessageType;
  /** Parent message ID for threading */
  parentId?: string;
  /** Additional structured metadata */
  metadata?: MessageMetadata;
  /** User IDs to mention */
  mentions?: readonly string[];
  /** Attachment file IDs (pre-uploaded) */
  attachmentIds?: readonly string[];
}

/**
 * Input for updating an existing message
 */
export interface UpdateMessageInput {
  /** Updated message content */
  content: string;
  /** Updated metadata */
  metadata?: MessageMetadata;
}

/**
 * Query filters for fetching messages
 */
export interface MessageFilters {
  /** Fetch messages before this message ID (pagination) */
  before?: string;
  /** Fetch messages after this message ID (pagination) */
  after?: string;
  /** Maximum number of messages to return */
  limit?: number;
  /** Full-text search query */
  search?: string;
}

/**
 * Categorized emoji picker group
 */
export interface EmojiCategory {
  /** Category identifier */
  readonly id: string;
  /** Display name for category */
  name: string;
  /** Unicode emoji characters in this category */
  emojis: readonly string[];
}

/**
 * Predefined emoji categories for picker UI
 */
export const EMOJI_CATEGORIES: readonly EmojiCategory[] = [
  {
    id: 'frequent',
    name: 'Frequently Used',
    emojis: [],
  },
  {
    id: 'smileys',
    name: 'Smileys & Emotion',
    emojis: [
      '😀',
      '😃',
      '😄',
      '😁',
      '😆',
      '😅',
      '🤣',
      '😂',
      '🙂',
      '🙃',
      '😉',
      '😊',
      '😇',
      '🥰',
      '😍',
      '🤩',
      '😘',
      '😗',
      '😚',
      '😋',
      '😛',
      '😜',
      '🤪',
      '😝',
      '🤑',
      '🤗',
      '🤭',
      '🤫',
      '🤔',
      '🤐',
      '🤨',
      '😐',
      '😑',
      '😶',
      '😏',
      '😒',
      '🙄',
      '😬',
      '🤥',
      '😌',
      '😔',
      '😪',
      '🤤',
      '😴',
      '😷',
      '🤒',
      '🤕',
      '🤢',
      '🤮',
      '🤧',
      '🥵',
      '🥶',
      '🥴',
      '😵',
      '🤯',
      '🤠',
      '🥳',
      '🥸',
      '😎',
      '🤓',
      '🧐',
    ],
  },
  {
    id: 'gestures',
    name: 'People & Body',
    emojis: [
      '👋',
      '🤚',
      '🖐️',
      '✋',
      '🖖',
      '👌',
      '🤌',
      '🤏',
      '✌️',
      '🤞',
      '🤟',
      '🤘',
      '🤙',
      '👈',
      '👉',
      '👆',
      '🖕',
      '👇',
      '☝️',
      '👍',
      '👎',
      '✊',
      '👊',
      '🤛',
      '🤜',
      '👏',
      '🙌',
      '👐',
      '🤲',
      '🤝',
      '🙏',
      '✍️',
      '💪',
      '🦵',
      '🦶',
      '👂',
      '🦻',
      '👃',
      '🧠',
      '🫀',
      '🫁',
      '🦷',
      '🦴',
      '👀',
      '👁️',
      '👅',
      '👄',
    ],
  },
  {
    id: 'nature',
    name: 'Animals & Nature',
    emojis: [
      '🐶',
      '🐱',
      '🐭',
      '🐹',
      '🐰',
      '🦊',
      '🐻',
      '🐼',
      '🐻‍❄️',
      '🐨',
      '🐯',
      '🦁',
      '🐮',
      '🐷',
      '🐸',
      '🐵',
      '🙈',
      '🙉',
      '🙊',
      '🐒',
      '🐔',
      '🐧',
      '🐦',
      '🐤',
      '🐣',
      '🐥',
      '🦆',
      '🦅',
      '🦉',
      '🦇',
      '🐺',
      '🐗',
      '🐴',
      '🦄',
      '🐝',
      '🪱',
      '🐛',
      '🦋',
      '🐌',
      '🐞',
      '🐜',
      '🪰',
      '🪲',
      '🪳',
      '🦟',
      '🦗',
      '🕷️',
      '🕸️',
      '🦂',
      '🐢',
      '🐍',
      '🦎',
      '🦖',
      '🦕',
      '🐙',
      '🦑',
    ],
  },
  {
    id: 'food',
    name: 'Food & Drink',
    emojis: [
      '🍎',
      '🍐',
      '🍊',
      '🍋',
      '🍌',
      '🍉',
      '🍇',
      '🍓',
      '🫐',
      '🍈',
      '🍒',
      '🍑',
      '🥭',
      '🍍',
      '🥥',
      '🥝',
      '🍅',
      '🍆',
      '🥑',
      '🥦',
      '🥬',
      '🥒',
      '🌶️',
      '🫑',
      '🌽',
      '🥕',
      '🫒',
      '🧄',
      '🧅',
      '🥔',
      '🍠',
      '🥐',
      '🥯',
      '🍞',
      '🥖',
      '🥨',
      '🧀',
      '🥚',
      '🍳',
      '🧈',
      '🥞',
      '🧇',
      '🥓',
      '🥩',
      '🍗',
      '🍖',
      '🦴',
      '🌭',
      '🍔',
      '🍟',
      '🍕',
      '🫓',
      '🥪',
      '🥙',
      '🧆',
      '🌮',
      '🌯',
      '🫔',
      '🥗',
    ],
  },
  {
    id: 'activities',
    name: 'Activities',
    emojis: [
      '⚽',
      '🏀',
      '🏈',
      '⚾',
      '🥎',
      '🎾',
      '🏐',
      '🏉',
      '🥏',
      '🎱',
      '🪀',
      '🏓',
      '🏸',
      '🏒',
      '🏑',
      '🥍',
      '🏏',
      '🪃',
      '🥅',
      '⛳',
      '🪁',
      '🏹',
      '🎣',
      '🤿',
      '🥊',
      '🥋',
      '🎽',
      '🛹',
      '🛼',
      '🛷',
      '⛸️',
      '🥌',
      '🎿',
      '⛷️',
      '🏂',
      '🪂',
      '🏋️',
      '🤼',
      '🤸',
      '⛹️',
      '🤺',
      '🤾',
      '🏌️',
      '🏇',
      '⛷️',
      '🧘',
      '🏄',
      '🏊',
      '🤽',
      '🚣',
      '🧗',
      '🚴',
      '🚵',
      '🎖️',
      '🏆',
      '🥇',
      '🥈',
      '🥉',
      '🏅',
    ],
  },
  {
    id: 'objects',
    name: 'Objects',
    emojis: [
      '⌚',
      '📱',
      '📲',
      '💻',
      '⌨️',
      '🖥️',
      '🖨️',
      '🖱️',
      '🖲️',
      '🕹️',
      '🗜️',
      '💾',
      '💿',
      '📀',
      '📼',
      '📷',
      '📸',
      '📹',
      '🎥',
      '📽️',
      '🎞️',
      '📞',
      '☎️',
      '📟',
      '📠',
      '📺',
      '📻',
      '🎙️',
      '🎚️',
      '🎛️',
      '🧭',
      '⏱️',
      '⏲️',
      '⏰',
      '🕰️',
      '⌛',
      '⏳',
      '📡',
      '🔋',
      '🔌',
      '💡',
      '🔦',
      '🕯️',
      '🪔',
      '🧯',
      '🛢️',
      '💸',
      '💵',
      '💴',
      '💶',
      '💷',
      '🪙',
      '💰',
      '💳',
      '💎',
      '⚖️',
      '🪜',
      '🧰',
      '🪛',
      '🔧',
      '🔨',
    ],
  },
  {
    id: 'symbols',
    name: 'Symbols',
    emojis: [
      '❤️',
      '🧡',
      '💛',
      '💚',
      '💙',
      '💜',
      '🖤',
      '🤍',
      '🤎',
      '💔',
      '❣️',
      '💕',
      '💞',
      '💓',
      '💗',
      '💖',
      '💘',
      '💝',
      '💟',
      '☮️',
      '✝️',
      '☪️',
      '🕉️',
      '☸️',
      '✡️',
      '🔯',
      '🕎',
      '☯️',
      '☦️',
      '🛐',
      '⛎',
      '♈',
      '♉',
      '♊',
      '♋',
      '♌',
      '♍',
      '♎',
      '♏',
      '♐',
      '♑',
      '♒',
      '♓',
      '🆔',
      '⚛️',
      '🉑',
      '☢️',
      '☣️',
      '📴',
      '📳',
      '🈶',
      '🈚',
      '🈸',
      '🈺',
      '🈷️',
      '✴️',
      '🆚',
      '💮',
      '🉐',
      '㊙️',
      '㊗️',
    ],
  },
  {
    id: 'flags',
    name: 'Flags',
    emojis: [
      '🏁',
      '🚩',
      '🎌',
      '🏴',
      '🏳️',
      '🏳️‍🌈',
      '🏳️‍⚧️',
      '🏴‍☠️',
      '🇺🇸',
      '🇬🇧',
      '🇨🇦',
      '🇦🇺',
      '🇩🇪',
      '🇫🇷',
      '🇮🇹',
      '🇪🇸',
      '🇯🇵',
      '🇰🇷',
      '🇨🇳',
      '🇮🇳',
      '🇧🇷',
      '🇲🇽',
      '🇷🇺',
      '🇿🇦',
    ],
  },
];

/**
 * Commonly used reactions for quick access
 */
export const QUICK_REACTIONS = [
  '👍',
  '❤️',
  '😂',
  '😮',
  '😢',
  '🎉',
  '🚀',
  '👀',
] as const;

/**
 * Type guard to check if a value is a valid UserStatus
 */
export function isUserStatus(value: unknown): value is UserStatus {
  return (
    typeof value === 'string' &&
    ['online', 'offline', 'away', 'busy'].includes(value)
  );
}

/**
 * Type guard to check if a value is a valid MessageType
 */
export function isMessageType(value: unknown): value is MessageType {
  return (
    typeof value === 'string' &&
    ['TEXT', 'SYSTEM', 'FILE', 'COMMAND'].includes(value)
  );
}

/**
 * Type guard to check if a value is a valid ChannelType
 */
export function isChannelType(value: unknown): value is ChannelType {
  return (
    typeof value === 'string' && ['public', 'private', 'direct'].includes(value)
  );
}
