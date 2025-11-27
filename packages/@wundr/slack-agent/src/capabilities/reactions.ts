/**
 * Slack Reactions Capability
 *
 * Provides emoji reaction functionality for the Orchestrator (Virtual Principal) agent
 * to interact with messages in Slack workspaces like a human user.
 */

// Type definitions for Slack reactions API responses
export interface Reaction {
  name: string;
  count: number;
  users: string[];
}

export interface ReactedMessage {
  type: string;
  channel: string;
  message: {
    type: string;
    ts: string;
    text?: string;
    user?: string;
    reactions?: Reaction[];
  };
}

export interface ListOptions {
  count?: number;
  cursor?: string;
  full?: boolean;
  limit?: number;
  page?: number;
}

export interface ListReactionsResponse {
  items: ReactedMessage[];
  response_metadata?: {
    next_cursor?: string;
  };
}

// Slack API response types
interface SlackReactionsAddResponse {
  ok: boolean;
  error?: string;
}

interface SlackReactionsRemoveResponse {
  ok: boolean;
  error?: string;
}

interface SlackReactionsGetResponse {
  ok: boolean;
  error?: string;
  type?: string;
  channel?: string;
  message?: {
    type: string;
    ts: string;
    text?: string;
    user?: string;
    reactions?: Array<{
      name: string;
      count: number;
      users: string[];
    }>;
  };
}

interface SlackReactionsListResponse {
  ok: boolean;
  error?: string;
  items?: Array<{
    type: string;
    channel: string;
    message: {
      type: string;
      ts: string;
      text?: string;
      user?: string;
      reactions?: Array<{
        name: string;
        count: number;
        users: string[];
      }>;
    };
  }>;
  response_metadata?: {
    next_cursor?: string;
  };
}

// Slack client interface for reactions
interface SlackReactionsClient {
  reactions: {
    add: (params: { channel: string; timestamp: string; name: string }) => Promise<SlackReactionsAddResponse>;
    remove: (params: { channel: string; timestamp: string; name: string }) => Promise<SlackReactionsRemoveResponse>;
    get: (params: { channel: string; timestamp: string; full?: boolean }) => Promise<SlackReactionsGetResponse>;
    list: (params: {
      user?: string;
      count?: number;
      cursor?: string;
      full?: boolean;
      limit?: number;
      page?: number;
    }) => Promise<SlackReactionsListResponse>;
  };
}

// Mock client for when Slack SDK is unavailable
class MockReactionsClient implements SlackReactionsClient {
  reactions = {
    add: async (_params: { channel: string; timestamp: string; name: string }) => ({
      ok: false,
      error: 'slack_api_unavailable',
    }),
    remove: async (_params: { channel: string; timestamp: string; name: string }) => ({
      ok: false,
      error: 'slack_api_unavailable',
    }),
    get: async (_params: { channel: string; timestamp: string; full?: boolean }) => ({
      ok: false,
      error: 'slack_api_unavailable',
    }),
    list: async (_params: {
      user?: string;
      count?: number;
      cursor?: string;
      full?: boolean;
      limit?: number;
      page?: number;
    }) => ({
      ok: false,
      error: 'slack_api_unavailable',
    }),
  };
}

// Factory function to create Slack client
async function createSlackClient(token: string): Promise<SlackReactionsClient> {
  try {
    const slack = await import('@slack/web-api');
    return new slack.WebClient(token) as unknown as SlackReactionsClient;
  } catch (_e) {
    // Slack SDK not available, use mock
    return new MockReactionsClient();
  }
}

/**
 * Common emoji shortcuts for quick reference
 */
export const CommonEmojis = {
  // Acknowledgment
  EYES: 'eyes',
  THUMBS_UP: '+1',
  THUMBS_DOWN: '-1',
  OK_HAND: 'ok_hand',
  WAVE: 'wave',

  // Approval/Completion
  WHITE_CHECK_MARK: 'white_check_mark',
  HEAVY_CHECK_MARK: 'heavy_check_mark',
  BALLOT_BOX_WITH_CHECK: 'ballot_box_with_check',
  GREEN_CHECK: 'heavy_check_mark',

  // Celebration
  TADA: 'tada',
  PARTY_POPPER: 'tada',
  CONFETTI: 'confetti_ball',
  CLAP: 'clap',
  FIRE: 'fire',
  ROCKET: 'rocket',
  STAR: 'star',
  SPARKLES: 'sparkles',

  // Questions/Thinking
  THINKING: 'thinking_face',
  QUESTION: 'question',
  THINKING_FACE: 'thinking_face',

  // Negative/Issues
  X: 'x',
  WARNING: 'warning',
  RED_X: 'x',
  NO_ENTRY: 'no_entry',

  // Emotions
  SMILE: 'smile',
  LAUGH: 'joy',
  HEART: 'heart',
  PRAY: 'pray',
  RAISED_HANDS: 'raised_hands',

  // Work-related
  WORKING: 'hammer_and_wrench',
  BUG: 'bug',
  SHIP_IT: 'ship',
  MERGE: 'twisted_rightwards_arrows',
  REVIEW: 'mag',
  DOCUMENT: 'memo',
} as const;

/**
 * Normalizes emoji input by removing colons if present
 * @param emoji - Emoji name with or without colons (e.g., ":+1:" or "+1")
 * @returns Normalized emoji name without colons
 */
function normalizeEmoji(emoji: string): string {
  return emoji.replace(/^:/, '').replace(/:$/, '');
}

/**
 * SlackReactions - Manages emoji reactions on Slack messages
 *
 * Provides functionality for the Orchestrator agent to react to messages,
 * expressing acknowledgment, approval, humor, and other sentiments.
 */
export class SlackReactions {
  private client: SlackReactionsClient | null = null;
  private initPromise: Promise<void>;

  constructor(token: string) {
    this.initPromise = this.initialize(token);
  }

  private async initialize(token: string): Promise<void> {
    this.client = await createSlackClient(token);
  }

  private async getClient(): Promise<SlackReactionsClient> {
    await this.initPromise;
    if (!this.client) {
      throw new Error('Slack client not initialized');
    }
    return this.client;
  }

  /**
   * Add a reaction to a message
   * @param channel - Channel ID containing the message
   * @param timestamp - Message timestamp (e.g., "1234567890.123456")
   * @param emoji - Emoji name with or without colons (e.g., ":+1:" or "+1")
   * @throws Error if the reaction cannot be added
   */
  async addReaction(channel: string, timestamp: string, emoji: string): Promise<void> {
    try {
      const client = await this.getClient();
      const normalizedEmoji = normalizeEmoji(emoji);

      const response = await client.reactions.add({
        channel,
        timestamp,
        name: normalizedEmoji,
      });

      if (!response.ok) {
        throw new Error(response.error || 'Failed to add reaction');
      }
    } catch (error) {
      if (error instanceof Error) {
        // Handle specific Slack errors
        if (error.message.includes('already_reacted')) {
          // Reaction already exists, not an error condition
          return;
        }
        throw new Error(`Failed to add reaction: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Remove a reaction from a message
   * @param channel - Channel ID containing the message
   * @param timestamp - Message timestamp
   * @param emoji - Emoji name with or without colons
   * @throws Error if the reaction cannot be removed
   */
  async removeReaction(channel: string, timestamp: string, emoji: string): Promise<void> {
    try {
      const client = await this.getClient();
      const normalizedEmoji = normalizeEmoji(emoji);

      const response = await client.reactions.remove({
        channel,
        timestamp,
        name: normalizedEmoji,
      });

      if (!response.ok) {
        throw new Error(response.error || 'Failed to remove reaction');
      }
    } catch (error) {
      if (error instanceof Error) {
        // Handle specific Slack errors
        if (error.message.includes('no_reaction')) {
          // Reaction doesn't exist, not an error condition
          return;
        }
        throw new Error(`Failed to remove reaction: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get all reactions on a message
   * @param channel - Channel ID containing the message
   * @param timestamp - Message timestamp
   * @returns Array of reactions with emoji names, counts, and user IDs
   */
  async getReactions(channel: string, timestamp: string): Promise<Reaction[]> {
    try {
      const client = await this.getClient();

      const response = await client.reactions.get({
        channel,
        timestamp,
        full: true,
      });

      if (!response.ok) {
        throw new Error(response.error || 'Failed to get reactions');
      }

      return response.message?.reactions || [];
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get reactions: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * List all messages a user has reacted to
   * @param userId - User ID (optional, defaults to authenticated user)
   * @param options - Pagination and filtering options
   * @returns Array of messages with their reactions
   */
  async listUserReactions(userId?: string, options?: ListOptions): Promise<ReactedMessage[]> {
    try {
      const client = await this.getClient();

      const response = await client.reactions.list({
        user: userId,
        count: options?.count,
        cursor: options?.cursor,
        full: options?.full,
        limit: options?.limit,
        page: options?.page,
      });

      if (!response.ok) {
        throw new Error(response.error || 'Failed to list reactions');
      }

      return (response.items || []).map((item) => ({
        type: item.type,
        channel: item.channel,
        message: {
          type: item.message.type,
          ts: item.message.ts,
          text: item.message.text,
          user: item.message.user,
          reactions: item.message.reactions,
        },
      }));
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to list user reactions: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Add multiple reactions to a message at once
   * @param channel - Channel ID containing the message
   * @param timestamp - Message timestamp
   * @param emojis - Array of emoji names
   * @throws Error if any reaction fails (continues adding remaining reactions)
   */
  async bulkAddReactions(channel: string, timestamp: string, emojis: string[]): Promise<void> {
    const errors: string[] = [];

    for (const emoji of emojis) {
      try {
        await this.addReaction(channel, timestamp, emoji);
      } catch (error) {
        if (error instanceof Error) {
          errors.push(`${emoji}: ${error.message}`);
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Some reactions failed:\n${errors.join('\n')}`);
    }
  }

  /**
   * Bulk remove multiple reactions from a message
   * @param channel - Channel ID containing the message
   * @param timestamp - Message timestamp
   * @param emojis - Array of emoji names to remove
   */
  async bulkRemoveReactions(channel: string, timestamp: string, emojis: string[]): Promise<void> {
    const errors: string[] = [];

    for (const emoji of emojis) {
      try {
        await this.removeReaction(channel, timestamp, emoji);
      } catch (error) {
        if (error instanceof Error) {
          errors.push(`${emoji}: ${error.message}`);
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Some reaction removals failed:\n${errors.join('\n')}`);
    }
  }

  // =====================
  // Smart Reaction Methods
  // =====================

  /**
   * Acknowledge a message with eyes emoji
   * Indicates the Orchestrator has seen and is reviewing the message
   * @param channel - Channel ID
   * @param timestamp - Message timestamp
   */
  async acknowledge(channel: string, timestamp: string): Promise<void> {
    await this.addReaction(channel, timestamp, CommonEmojis.EYES);
  }

  /**
   * Approve a message with thumbs up emoji
   * Indicates agreement or approval
   * @param channel - Channel ID
   * @param timestamp - Message timestamp
   */
  async approve(channel: string, timestamp: string): Promise<void> {
    await this.addReaction(channel, timestamp, CommonEmojis.THUMBS_UP);
  }

  /**
   * Mark a message as complete with checkmark emoji
   * Indicates the task or request has been completed
   * @param channel - Channel ID
   * @param timestamp - Message timestamp
   */
  async complete(channel: string, timestamp: string): Promise<void> {
    await this.addReaction(channel, timestamp, CommonEmojis.WHITE_CHECK_MARK);
  }

  /**
   * Celebrate a message with tada emoji
   * Indicates celebration or congratulations
   * @param channel - Channel ID
   * @param timestamp - Message timestamp
   */
  async celebrate(channel: string, timestamp: string): Promise<void> {
    await this.addReaction(channel, timestamp, CommonEmojis.TADA);
  }

  /**
   * Reject or disagree with a message using thumbs down emoji
   * @param channel - Channel ID
   * @param timestamp - Message timestamp
   */
  async reject(channel: string, timestamp: string): Promise<void> {
    await this.addReaction(channel, timestamp, CommonEmojis.THUMBS_DOWN);
  }

  /**
   * Mark something as needing attention with warning emoji
   * @param channel - Channel ID
   * @param timestamp - Message timestamp
   */
  async flagWarning(channel: string, timestamp: string): Promise<void> {
    await this.addReaction(channel, timestamp, CommonEmojis.WARNING);
  }

  /**
   * Indicate thinking or consideration with thinking face emoji
   * @param channel - Channel ID
   * @param timestamp - Message timestamp
   */
  async thinking(channel: string, timestamp: string): Promise<void> {
    await this.addReaction(channel, timestamp, CommonEmojis.THINKING);
  }

  /**
   * Express appreciation with heart emoji
   * @param channel - Channel ID
   * @param timestamp - Message timestamp
   */
  async appreciate(channel: string, timestamp: string): Promise<void> {
    await this.addReaction(channel, timestamp, CommonEmojis.HEART);
  }

  /**
   * Indicate something is being worked on with hammer and wrench emoji
   * @param channel - Channel ID
   * @param timestamp - Message timestamp
   */
  async working(channel: string, timestamp: string): Promise<void> {
    await this.addReaction(channel, timestamp, CommonEmojis.WORKING);
  }

  /**
   * Indicate ready to ship/deploy with ship emoji
   * @param channel - Channel ID
   * @param timestamp - Message timestamp
   */
  async shipIt(channel: string, timestamp: string): Promise<void> {
    await this.addReaction(channel, timestamp, CommonEmojis.SHIP_IT);
  }

  /**
   * Express excitement with rocket emoji
   * @param channel - Channel ID
   * @param timestamp - Message timestamp
   */
  async rocket(channel: string, timestamp: string): Promise<void> {
    await this.addReaction(channel, timestamp, CommonEmojis.ROCKET);
  }

  /**
   * Express fire/hot with fire emoji
   * @param channel - Channel ID
   * @param timestamp - Message timestamp
   */
  async fire(channel: string, timestamp: string): Promise<void> {
    await this.addReaction(channel, timestamp, CommonEmojis.FIRE);
  }

  // =====================
  // Utility Methods
  // =====================

  /**
   * Check if a specific reaction exists on a message
   * @param channel - Channel ID
   * @param timestamp - Message timestamp
   * @param emoji - Emoji name to check
   * @returns True if the reaction exists
   */
  async hasReaction(channel: string, timestamp: string, emoji: string): Promise<boolean> {
    const reactions = await this.getReactions(channel, timestamp);
    const normalizedEmoji = normalizeEmoji(emoji);
    return reactions.some((r) => r.name === normalizedEmoji);
  }

  /**
   * Get the count of a specific reaction on a message
   * @param channel - Channel ID
   * @param timestamp - Message timestamp
   * @param emoji - Emoji name to count
   * @returns Number of users who reacted with this emoji
   */
  async getReactionCount(channel: string, timestamp: string, emoji: string): Promise<number> {
    const reactions = await this.getReactions(channel, timestamp);
    const normalizedEmoji = normalizeEmoji(emoji);
    const reaction = reactions.find((r) => r.name === normalizedEmoji);
    return reaction?.count || 0;
  }

  /**
   * Toggle a reaction (add if not present, remove if present)
   * @param channel - Channel ID
   * @param timestamp - Message timestamp
   * @param emoji - Emoji name to toggle
   * @returns True if reaction was added, false if removed
   */
  async toggleReaction(channel: string, timestamp: string, emoji: string): Promise<boolean> {
    const hasIt = await this.hasReaction(channel, timestamp, emoji);
    if (hasIt) {
      await this.removeReaction(channel, timestamp, emoji);
      return false;
    } else {
      await this.addReaction(channel, timestamp, emoji);
      return true;
    }
  }

  /**
   * Clear all reactions from the authenticated user on a message
   * @param channel - Channel ID
   * @param timestamp - Message timestamp
   */
  async clearMyReactions(channel: string, timestamp: string): Promise<void> {
    const reactions = await this.getReactions(channel, timestamp);
    const errors: string[] = [];

    for (const reaction of reactions) {
      try {
        await this.removeReaction(channel, timestamp, reaction.name);
      } catch (error) {
        if (error instanceof Error) {
          // Only collect actual errors, not "no_reaction" errors
          if (!error.message.includes('no_reaction')) {
            errors.push(`${reaction.name}: ${error.message}`);
          }
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Some reaction removals failed:\n${errors.join('\n')}`);
    }
  }
}

// Default export for convenience
export default SlackReactions;
