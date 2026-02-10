/**
 * Mailbox - Inter-teammate messaging system for Agent Teams
 *
 * Provides point-to-point messaging, broadcast, and system notifications
 * between teammates in an agent team. Messages are delivered via EventEmitter
 * for in-process mode, with support for WebSocket delivery to external clients.
 *
 * Modeled after Claude Code Agent Teams' mailbox system:
 * - Direct messages between specific teammates
 * - Broadcast to all teammates simultaneously
 * - System notifications (idle, shutdown, task updates)
 * - Automatic idle notifications to the lead
 */

import { EventEmitter } from 'eventemitter3';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MessagePriority = 'normal' | 'urgent';

export type MessageType =
  | 'direct'
  | 'broadcast'
  | 'system'
  | 'plan_approval'
  | 'task_update';

export interface TeamMessage {
  readonly id: string;
  readonly teamId: string;
  readonly fromId: string;
  readonly toId: string | null; // null for broadcasts
  readonly type: MessageType;
  readonly content: string;
  readonly priority: MessagePriority;
  readonly sentAt: Date;
  deliveredAt: Date | null;
  readAt: Date | null;
  /** Optional expiry time. Expired messages are excluded from inbox queries. */
  readonly expiresAt: Date | null;
  readonly metadata: Record<string, unknown>;
}

export interface SendMessageInput {
  readonly toId: string;
  readonly content: string;
  readonly type?: MessageType;
  readonly priority?: MessagePriority;
  readonly metadata?: Record<string, unknown>;
  /** Time-to-live in ms. If set, message expires after this duration. */
  readonly ttlMs?: number;
}

export interface BroadcastOptions {
  readonly type?: MessageType;
  readonly priority?: MessagePriority;
  readonly metadata?: Record<string, unknown>;
  readonly excludeIds?: string[];
  /** Time-to-live in ms. If set, messages expire after this duration. */
  readonly ttlMs?: number;
}

export interface MessageFilter {
  readonly type?: MessageType;
  readonly fromId?: string;
  readonly priority?: MessagePriority;
  readonly unreadOnly?: boolean;
  readonly since?: Date;
}

export interface MailboxEvents {
  'message:sent': (message: TeamMessage) => void;
  'message:delivered': (message: TeamMessage) => void;
  'message:read': (messageId: string, memberId: string) => void;
  'teammate:idle': (teamId: string, memberId: string) => void;
  'teammate:joined': (teamId: string, memberId: string, memberName: string) => void;
  'teammate:shutdown': (teamId: string, memberId: string, reason: string) => void;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class MailboxError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'MailboxError';
  }
}

export enum MailboxErrorCode {
  MEMBER_NOT_FOUND = 'MEMBER_NOT_FOUND',
  SELF_MESSAGE = 'SELF_MESSAGE',
  EMPTY_TEAM = 'EMPTY_TEAM',
  MESSAGE_NOT_FOUND = 'MESSAGE_NOT_FOUND',
}

// ---------------------------------------------------------------------------
// Teammate Idle Hook Callback
// ---------------------------------------------------------------------------

/**
 * Callback type for the TeammateIdle hook integration.
 * Injected by TeamHooks so the mailbox does not depend on hooks directly.
 * Returns { keepWorking: true, feedback } or { keepWorking: false }.
 */
export type TeammateIdleHookFn = (context: {
  teamId: string;
  memberId: string;
  memberName: string;
  completedTaskIds: string[];
  remainingTasks: number;
  idleSince: Date;
}) => Promise<{ keepWorking: boolean; feedback?: string }>;

// ---------------------------------------------------------------------------
// Mailbox
// ---------------------------------------------------------------------------

export class Mailbox extends EventEmitter<MailboxEvents> {
  /**
   * All messages stored by team, indexed by recipient (or '*' for broadcasts).
   */
  private readonly inboxes: Map<string, TeamMessage[]> = new Map();

  /**
   * Full message archive for the team.
   */
  private readonly archive: Map<string, TeamMessage> = new Map();

  /**
   * Known member IDs in this team (lead + teammates).
   */
  private readonly memberIds: Set<string> = new Set();

  /**
   * Member name lookup.
   */
  private readonly memberNames: Map<string, string> = new Map();

  /**
   * The lead member ID. Idle notifications are sent to the lead.
   */
  private leadId: string | null = null;

  /**
   * Optional hook for teammate idle events.
   */
  private teammateIdleHook: TeammateIdleHookFn | null = null;

  private nextMessageNumber = 1;

  constructor(private readonly teamId: string) {
    super();
  }

  // -------------------------------------------------------------------------
  // Configuration
  // -------------------------------------------------------------------------

  /**
   * Register the TeammateIdle hook callback.
   */
  setTeammateIdleHook(hook: TeammateIdleHookFn): void {
    this.teammateIdleHook = hook;
  }

  /**
   * Register a team member so they can send and receive messages.
   */
  registerMember(memberId: string, name: string, isLead = false): void {
    this.memberIds.add(memberId);
    this.memberNames.set(memberId, name);
    if (!this.inboxes.has(memberId)) {
      this.inboxes.set(memberId, []);
    }
    if (isLead) {
      this.leadId = memberId;
    }
  }

  /**
   * Unregister a team member (e.g., on shutdown).
   */
  unregisterMember(memberId: string): void {
    this.memberIds.delete(memberId);
    this.memberNames.delete(memberId);
    // Keep inbox for historical access but stop delivery
  }

  // -------------------------------------------------------------------------
  // Send / Broadcast
  // -------------------------------------------------------------------------

  /**
   * Send a direct message from one member to another.
   */
  send(fromId: string, input: SendMessageInput): TeamMessage {
    this.validateMember(fromId, 'sender');
    this.validateMember(input.toId, 'recipient');

    if (fromId === input.toId) {
      throw new MailboxError(
        MailboxErrorCode.SELF_MESSAGE,
        'Cannot send a message to yourself',
      );
    }

    const message = this.createMessage(
      fromId,
      input.toId,
      input.content,
      input.type ?? 'direct',
      input.priority ?? 'normal',
      input.metadata ?? {},
      input.ttlMs,
    );

    // Deliver to recipient's inbox
    this.deliverToInbox(input.toId, message);

    this.emit('message:sent', message);

    return message;
  }

  /**
   * Broadcast a message to all team members except the sender.
   */
  broadcast(fromId: string, content: string, options?: BroadcastOptions): TeamMessage[] {
    this.validateMember(fromId, 'sender');

    if (this.memberIds.size < 2) {
      throw new MailboxError(
        MailboxErrorCode.EMPTY_TEAM,
        'Cannot broadcast to an empty team',
      );
    }

    const excludeIds = new Set(options?.excludeIds ?? []);
    excludeIds.add(fromId); // Never send broadcast to self

    const messages: TeamMessage[] = [];

    for (const memberId of this.memberIds) {
      if (excludeIds.has(memberId)) {
continue;
}

      const message = this.createMessage(
        fromId,
        memberId,
        content,
        options?.type ?? 'broadcast',
        options?.priority ?? 'normal',
        options?.metadata ?? {},
        options?.ttlMs,
      );

      this.deliverToInbox(memberId, message);
      messages.push(message);
    }

    // Emit once for the broadcast (using first message as representative)
    if (messages.length > 0) {
      this.emit('message:sent', messages[0]);
    }

    return messages;
  }

  /**
   * Send a system notification message (not from a specific user).
   */
  sendSystemMessage(toId: string, content: string, metadata?: Record<string, unknown>): TeamMessage {
    this.validateMember(toId, 'recipient');

    const message = this.createMessage(
      '__system__',
      toId,
      content,
      'system',
      'normal',
      metadata ?? {},
    );

    this.deliverToInbox(toId, message);
    this.emit('message:sent', message);

    return message;
  }

  // -------------------------------------------------------------------------
  // Inbox Operations
  // -------------------------------------------------------------------------

  /**
   * Get messages for a specific member.
   * Automatically excludes expired messages.
   */
  getInbox(memberId: string, filter?: MessageFilter): TeamMessage[] {
    const inbox = this.inboxes.get(memberId) ?? [];
    const now = Date.now();

    // Exclude expired messages
    let result = inbox.filter(m =>
      m.expiresAt === null || m.expiresAt.getTime() > now,
    );

    if (filter) {
      if (filter.type !== undefined) {
        result = result.filter(m => m.type === filter.type);
      }
      if (filter.fromId !== undefined) {
        result = result.filter(m => m.fromId === filter.fromId);
      }
      if (filter.priority !== undefined) {
        result = result.filter(m => m.priority === filter.priority);
      }
      if (filter.unreadOnly) {
        result = result.filter(m => m.readAt === null);
      }
      if (filter.since !== undefined) {
        const since = filter.since.getTime();
        result = result.filter(m => m.sentAt.getTime() >= since);
      }
    }

    return result;
  }

  /**
   * Get a single message by ID.
   */
  getMessage(messageId: string): TeamMessage | undefined {
    return this.archive.get(messageId);
  }

  /**
   * Get the count of unread messages for a member.
   */
  getUnreadCount(memberId: string): number {
    const inbox = this.inboxes.get(memberId) ?? [];
    return inbox.filter(m => m.readAt === null).length;
  }

  /**
   * Mark a message as read by a member.
   */
  markRead(messageId: string, memberId: string): void {
    const message = this.archive.get(messageId);
    if (!message) {
      throw new MailboxError(
        MailboxErrorCode.MESSAGE_NOT_FOUND,
        `Message not found: ${messageId}`,
      );
    }

    if (message.toId === memberId && message.readAt === null) {
      (message as { readAt: Date | null }).readAt = new Date();
      this.emit('message:read', messageId, memberId);
    }
  }

  /**
   * Mark all messages for a member as read.
   */
  markAllRead(memberId: string): void {
    const inbox = this.inboxes.get(memberId) ?? [];
    const now = new Date();
    for (const message of inbox) {
      if (message.readAt === null) {
        (message as { readAt: Date | null }).readAt = now;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Lifecycle Notifications
  // -------------------------------------------------------------------------

  /**
   * Notify the team that a teammate has become idle.
   * Runs the TeammateIdle hook if registered.
   *
   * @param memberId - The idle teammate's member ID
   * @param completedTaskIds - Tasks the teammate has completed
   * @param remainingTasks - Total remaining tasks in the list
   */
  async notifyIdle(
    memberId: string,
    completedTaskIds: string[],
    remainingTasks: number,
  ): Promise<void> {
    const memberName = this.memberNames.get(memberId) ?? memberId;

    // Run TeammateIdle hook if registered
    if (this.teammateIdleHook) {
      const hookResult = await this.teammateIdleHook({
        teamId: this.teamId,
        memberId,
        memberName,
        completedTaskIds,
        remainingTasks,
        idleSince: new Date(),
      });

      if (hookResult.keepWorking && hookResult.feedback) {
        // Hook says keep working -- send feedback as system message to the teammate
        this.sendSystemMessage(memberId, hookResult.feedback, {
          source: 'TeammateIdleHook',
          action: 'keep_working',
        });
        return; // Do not notify lead; teammate is continuing
      }
    }

    // Notify lead that teammate is idle
    if (this.leadId && this.leadId !== memberId) {
      this.send(memberId, {
        toId: this.leadId,
        content: `Teammate "${memberName}" is now idle. Completed tasks: [${completedTaskIds.join(', ')}]. Remaining tasks: ${remainingTasks}.`,
        type: 'system',
        metadata: { event: 'teammate_idle', completedTaskIds, remainingTasks },
      });
    }

    this.emit('teammate:idle', this.teamId, memberId);
  }

  /**
   * Notify the team that a new teammate has joined.
   */
  notifyTeammateJoined(memberId: string, memberName: string): void {
    // Broadcast to the team that a new teammate joined
    if (this.memberIds.size > 1) {
      this.broadcast('__system__', `Teammate "${memberName}" has joined the team.`, {
        type: 'system',
        metadata: { event: 'teammate_joined', memberId },
        excludeIds: [memberId],
      });
    }

    this.emit('teammate:joined', this.teamId, memberId, memberName);
  }

  /**
   * Notify the team that a teammate is shutting down.
   */
  notifyTeammateShutdown(memberId: string, reason: string): void {
    const memberName = this.memberNames.get(memberId) ?? memberId;

    if (this.leadId && this.leadId !== memberId) {
      this.sendSystemMessage(this.leadId, `Teammate "${memberName}" has shut down. Reason: ${reason}`, {
        event: 'teammate_shutdown',
        memberId,
        reason,
      });
    }

    this.emit('teammate:shutdown', this.teamId, memberId, reason);
  }

  // -------------------------------------------------------------------------
  // Statistics and Cleanup
  // -------------------------------------------------------------------------

  /**
   * Get mailbox statistics.
   */
  getStats(): {
    totalMessages: number;
    memberCount: number;
    unreadByMember: Record<string, number>;
  } {
    const unreadByMember: Record<string, number> = {};
    for (const memberId of this.memberIds) {
      unreadByMember[memberId] = this.getUnreadCount(memberId);
    }

    return {
      totalMessages: this.archive.size,
      memberCount: this.memberIds.size,
      unreadByMember,
    };
  }

  /**
   * Get all registered member IDs.
   */
  getMemberIds(): string[] {
    return Array.from(this.memberIds);
  }

  /**
   * Check if a member is registered.
   */
  hasMember(memberId: string): boolean {
    return this.memberIds.has(memberId) || memberId === '__system__';
  }

  /**
   * Remove expired messages from all inboxes and the archive.
   * Returns the number of purged messages.
   */
  purgeExpired(): number {
    const now = Date.now();
    let purgedCount = 0;

    // Purge from inboxes
    for (const [memberId, inbox] of this.inboxes) {
      const before = inbox.length;
      const filtered = inbox.filter(m =>
        m.expiresAt === null || m.expiresAt.getTime() > now,
      );
      purgedCount += before - filtered.length;
      this.inboxes.set(memberId, filtered);
    }

    // Purge from archive
    for (const [messageId, message] of this.archive) {
      if (message.expiresAt !== null && message.expiresAt.getTime() <= now) {
        this.archive.delete(messageId);
      }
    }

    return purgedCount;
  }

  /**
   * Clear all messages and members (used during team cleanup).
   */
  clear(): void {
    this.inboxes.clear();
    this.archive.clear();
    this.memberIds.clear();
    this.memberNames.clear();
    this.leadId = null;
    this.nextMessageNumber = 1;
  }

  // -------------------------------------------------------------------------
  // Internal Helpers
  // -------------------------------------------------------------------------

  private createMessage(
    fromId: string,
    toId: string | null,
    content: string,
    type: MessageType,
    priority: MessagePriority,
    metadata: Record<string, unknown>,
    ttlMs?: number,
  ): TeamMessage {
    const messageId = `msg_${this.teamId}_${this.nextMessageNumber++}`;
    const now = new Date();

    const message: TeamMessage = {
      id: messageId,
      teamId: this.teamId,
      fromId,
      toId,
      type,
      content,
      priority,
      sentAt: now,
      deliveredAt: null,
      readAt: null,
      expiresAt: ttlMs ? new Date(now.getTime() + ttlMs) : null,
      metadata,
    };

    this.archive.set(messageId, message);
    return message;
  }

  private deliverToInbox(memberId: string, message: TeamMessage): void {
    let inbox = this.inboxes.get(memberId);
    if (!inbox) {
      inbox = [];
      this.inboxes.set(memberId, inbox);
    }
    inbox.push(message);
    (message as { deliveredAt: Date | null }).deliveredAt = new Date();

    this.emit('message:delivered', message);
  }

  private validateMember(memberId: string, role: string): void {
    // Allow __system__ as a pseudo-member
    if (memberId === '__system__') {
return;
}

    if (!this.memberIds.has(memberId)) {
      throw new MailboxError(
        MailboxErrorCode.MEMBER_NOT_FOUND,
        `${role} member not found: ${memberId}`,
        { memberId },
      );
    }
  }
}
