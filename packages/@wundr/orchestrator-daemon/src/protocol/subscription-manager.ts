/**
 * Subscription Manager
 *
 * Manages client subscriptions to server-push events.  Clients subscribe
 * via the `subscribe` RPC method with an array of event name patterns
 * (exact match or glob with `*` wildcard) and an optional payload filter.
 * The manager routes emitted events to the matching subscriptions.
 *
 * Design mirrors OpenClaw's node-subscription pattern but adds glob
 * pattern matching and per-subscription payload filters.
 */

import { randomUUID } from 'node:crypto';

import type { EventFrame, ProtocolEvent } from './protocol-v2';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Subscription {
  /** Server-generated unique subscription ID. */
  id: string;
  /** The connection identifier this subscription belongs to. */
  connectionId: string;
  /** Event name patterns requested by the client. */
  patterns: string[];
  /** Compiled matchers for each pattern (cached for performance). */
  matchers: RegExp[];
  /** Optional key-value filter applied to event payloads. */
  filter: Record<string, unknown> | undefined;
  /** Timestamp of subscription creation. */
  createdAt: number;
}

export interface EventSink {
  /** Send a serialized event frame to the client. */
  send: (frame: EventFrame) => void;
  /** Whether the underlying connection is still open. */
  isOpen: () => boolean;
}

// ---------------------------------------------------------------------------
// Glob -> RegExp compilation
// ---------------------------------------------------------------------------

/**
 * Converts a simple glob pattern into a RegExp.
 *
 * Supported syntax:
 *   - `*`  matches any single segment (one or more characters except `.`)
 *   - `**` matches any number of segments (including zero)
 *   - Literal `.` separators
 *
 * Examples:
 *   "stream.*"   -> /^stream\.[^.]+$/
 *   "tool.**"    -> /^tool\..*$/
 *   "*"          -> /^[^.]+$/
 *   "**"         -> /^.*$/
 *   "stream.chunk" -> /^stream\.chunk$/  (exact match)
 */
export function compileGlob(pattern: string): RegExp {
  if (pattern === '*') {
    return /^[^.]+$/;
  }
  if (pattern === '**') {
    return /^.*$/;
  }

  const escaped = pattern
    .split('.')
    .map(segment => {
      if (segment === '**') {
        return '.*';
      }
      if (segment === '*') {
        return '[^.]+';
      }
      // Escape regex special chars in literal segments
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('\\.');

  return new RegExp(`^${escaped}$`);
}

// ---------------------------------------------------------------------------
// Payload filter matching
// ---------------------------------------------------------------------------

/**
 * Checks whether the event payload satisfies the subscription filter.
 * The filter is a flat key-value map; every key in the filter must exist
 * in the payload (at the top level) with a strictly equal value.
 */
function matchesFilter(
  payload: unknown,
  filter: Record<string, unknown> | undefined
): boolean {
  if (!filter) {
    return true;
  }

  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const record = payload as Record<string, unknown>;
  for (const [key, value] of Object.entries(filter)) {
    if (record[key] !== value) {
      return false;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// SubscriptionManager
// ---------------------------------------------------------------------------

export class SubscriptionManager {
  /** subscriptionId -> Subscription */
  private subscriptions = new Map<string, Subscription>();

  /** connectionId -> Set<subscriptionId> */
  private connectionSubs = new Map<string, Set<string>>();

  /** connectionId -> EventSink */
  private sinks = new Map<string, EventSink>();

  /** Monotonic event sequence counter. */
  private seq = 0;

  // -----------------------------------------------------------------------
  // Connection lifecycle
  // -----------------------------------------------------------------------

  /**
   * Register a connection's event sink.  Must be called before creating
   * subscriptions for this connection.
   */
  registerConnection(connectionId: string, sink: EventSink): void {
    this.sinks.set(connectionId, sink);
    if (!this.connectionSubs.has(connectionId)) {
      this.connectionSubs.set(connectionId, new Set());
    }
  }

  /**
   * Remove a connection and all of its subscriptions.  Called when the
   * WebSocket closes.
   */
  removeConnection(connectionId: string): void {
    const subIds = this.connectionSubs.get(connectionId);
    if (subIds) {
      for (const id of subIds) {
        this.subscriptions.delete(id);
      }
    }
    this.connectionSubs.delete(connectionId);
    this.sinks.delete(connectionId);
  }

  // -----------------------------------------------------------------------
  // Subscription CRUD
  // -----------------------------------------------------------------------

  /**
   * Create a new subscription for a connection.
   *
   * @returns The new Subscription object with a generated ID.
   */
  subscribe(
    connectionId: string,
    patterns: string[],
    filter?: Record<string, unknown>
  ): Subscription {
    const id = `sub_${randomUUID()}`;
    const matchers = patterns.map(compileGlob);

    const subscription: Subscription = {
      id,
      connectionId,
      patterns,
      matchers,
      filter,
      createdAt: Date.now(),
    };

    this.subscriptions.set(id, subscription);

    let connSubs = this.connectionSubs.get(connectionId);
    if (!connSubs) {
      connSubs = new Set();
      this.connectionSubs.set(connectionId, connSubs);
    }
    connSubs.add(id);

    return subscription;
  }

  /**
   * Remove a single subscription by ID.
   *
   * @returns `true` if the subscription existed and was removed.
   */
  unsubscribe(subscriptionId: string): boolean {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) {
      return false;
    }

    this.subscriptions.delete(subscriptionId);
    const connSubs = this.connectionSubs.get(sub.connectionId);
    if (connSubs) {
      connSubs.delete(subscriptionId);
      if (connSubs.size === 0) {
        this.connectionSubs.delete(sub.connectionId);
      }
    }

    return true;
  }

  /**
   * List all subscriptions for a connection.
   */
  listSubscriptions(connectionId: string): Subscription[] {
    const subIds = this.connectionSubs.get(connectionId);
    if (!subIds) {
      return [];
    }

    const result: Subscription[] = [];
    for (const id of subIds) {
      const sub = this.subscriptions.get(id);
      if (sub) {
        result.push(sub);
      }
    }
    return result;
  }

  // -----------------------------------------------------------------------
  // Event emission
  // -----------------------------------------------------------------------

  /**
   * Emit an event to all matching subscriptions across all connections.
   *
   * @param event  The event name (e.g. "stream.chunk").
   * @param payload  The event payload object.
   */
  emit(event: string, payload?: unknown): void {
    const currentSeq = this.seq++;

    for (const [subId, sub] of this.subscriptions) {
      // Check pattern match
      const matches = sub.matchers.some(re => re.test(event));
      if (!matches) {
        continue;
      }

      // Check filter match
      if (!matchesFilter(payload, sub.filter)) {
        continue;
      }

      // Deliver
      const sink = this.sinks.get(sub.connectionId);
      if (!sink || !sink.isOpen()) {
        continue;
      }

      const frame: EventFrame = {
        type: 'event',
        event: event as ProtocolEvent,
        payload,
        seq: currentSeq,
        subscriptionId: subId,
      };

      try {
        sink.send(frame);
      } catch {
        // Swallow send errors; the connection will be cleaned up by
        // the close handler.
      }
    }
  }

  /**
   * Emit an event to subscriptions on a specific connection only.
   * Useful for targeted delivery (e.g. tool approval requests).
   */
  emitToConnection(
    connectionId: string,
    event: string,
    payload?: unknown
  ): void {
    const currentSeq = this.seq++;
    const subIds = this.connectionSubs.get(connectionId);
    if (!subIds) {
      return;
    }

    const sink = this.sinks.get(connectionId);
    if (!sink || !sink.isOpen()) {
      return;
    }

    for (const subId of subIds) {
      const sub = this.subscriptions.get(subId);
      if (!sub) {
        continue;
      }

      const matches = sub.matchers.some(re => re.test(event));
      if (!matches) {
        continue;
      }

      if (!matchesFilter(payload, sub.filter)) {
        continue;
      }

      const frame: EventFrame = {
        type: 'event',
        event: event as ProtocolEvent,
        payload,
        seq: currentSeq,
        subscriptionId: subId,
      };

      try {
        sink.send(frame);
      } catch {
        // Swallow
      }
    }
  }

  /**
   * Broadcast an event to all connected sinks, regardless of
   * subscriptions.  Used for critical events like `health.heartbeat`
   * that every client should receive.
   */
  broadcast(event: string, payload?: unknown): void {
    const currentSeq = this.seq++;

    const frame: EventFrame = {
      type: 'event',
      event: event as ProtocolEvent,
      payload,
      seq: currentSeq,
    };

    for (const [, sink] of this.sinks) {
      if (!sink.isOpen()) {
        continue;
      }
      try {
        sink.send(frame);
      } catch {
        // Swallow
      }
    }
  }

  // -----------------------------------------------------------------------
  // Introspection
  // -----------------------------------------------------------------------

  /** Total number of active subscriptions. */
  get subscriptionCount(): number {
    return this.subscriptions.size;
  }

  /** Number of registered connections. */
  get connectionCount(): number {
    return this.sinks.size;
  }

  /** Current event sequence number. */
  get currentSeq(): number {
    return this.seq;
  }
}
