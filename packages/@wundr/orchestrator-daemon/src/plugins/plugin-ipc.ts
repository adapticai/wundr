/**
 * Plugin Inter-Process Communication
 *
 * Structured message passing between the daemon and sandboxed plugins, and
 * between plugins themselves. All messages flow through the daemon's IPC
 * bus, which enforces permission checks and maintains an audit trail.
 *
 * Message types:
 *   request/response - RPC-style calls with correlation IDs.
 *   event            - Fire-and-forget notifications.
 *   broadcast        - Messages sent to all plugins (or a subset).
 *
 * The bus decouples plugins from each other. A plugin never holds a direct
 * reference to another plugin's handle.
 */

import { Logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IpcMessageKind = 'request' | 'response' | 'event' | 'broadcast';

export type IpcMessage = {
  /** Unique message identifier (UUID). */
  id: string;
  kind: IpcMessageKind;
  /** Source plugin name (set by the bus, not by the sender). */
  from: string;
  /** Destination plugin name. Omitted for broadcasts. */
  to?: string;
  /** Channel/topic for the message. */
  channel: string;
  /** Structured payload (must be serializable). */
  payload: unknown;
  /** Correlation ID for request/response pairs. */
  correlationId?: string;
  /** Timestamp (epoch ms). */
  timestamp: number;
};

export type IpcHandler = (message: IpcMessage) => Promise<unknown> | unknown;

export type IpcSubscription = {
  pluginName: string;
  channel: string;
  handler: IpcHandler;
};

export type IpcBusConfig = {
  /** Maximum payload size in bytes (serialized JSON). */
  maxPayloadBytes: number;
  /** Maximum pending requests per plugin before backpressure. */
  maxPendingPerPlugin: number;
  /** Request timeout in ms. */
  requestTimeoutMs: number;
};

const DEFAULT_IPC_CONFIG: IpcBusConfig = {
  maxPayloadBytes: 1024 * 1024, // 1 MB
  maxPendingPerPlugin: 100,
  requestTimeoutMs: 30_000,
};

// ---------------------------------------------------------------------------
// ID Generation
// ---------------------------------------------------------------------------

let idCounter = 0;

function generateId(): string {
  const ts = Date.now().toString(36);
  const count = (++idCounter).toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}-${count}-${rand}`;
}

// ---------------------------------------------------------------------------
// IPC Bus
// ---------------------------------------------------------------------------

export class PluginIpcBus {
  private subscriptions = new Map<string, IpcSubscription[]>(); // channel -> handlers
  private pluginChannels = new Map<string, Set<string>>(); // pluginName -> subscribed channels
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private pluginPendingCount = new Map<string, number>();
  private config: IpcBusConfig;
  private logger: Logger;
  private accessChecker:
    | ((from: string, to: string, channel: string) => boolean)
    | null = null;

  constructor(config?: Partial<IpcBusConfig>) {
    this.config = { ...DEFAULT_IPC_CONFIG, ...config };
    this.logger = new Logger('PluginIpcBus');
  }

  /**
   * Set a callback that determines whether a plugin is allowed to send
   * a message to a destination plugin on a given channel. This enables
   * the permission system to gate inter-plugin communication.
   */
  setAccessChecker(
    checker: (from: string, to: string, channel: string) => boolean
  ): void {
    this.accessChecker = checker;
  }

  // -----------------------------------------------------------------------
  // Subscribe / Unsubscribe
  // -----------------------------------------------------------------------

  /**
   * Subscribe a plugin to a channel. Returns an unsubscribe function.
   */
  subscribe(
    pluginName: string,
    channel: string,
    handler: IpcHandler
  ): () => void {
    const sub: IpcSubscription = { pluginName, channel, handler };

    const list = this.subscriptions.get(channel) ?? [];
    list.push(sub);
    this.subscriptions.set(channel, list);

    const channels = this.pluginChannels.get(pluginName) ?? new Set();
    channels.add(channel);
    this.pluginChannels.set(pluginName, channels);

    this.logger.debug(
      `Plugin "${pluginName}" subscribed to channel "${channel}"`
    );

    return () => {
      this.unsubscribeSingle(pluginName, channel, handler);
    };
  }

  private unsubscribeSingle(
    pluginName: string,
    channel: string,
    handler: IpcHandler
  ): void {
    const list = this.subscriptions.get(channel);
    if (list) {
      const filtered = list.filter(
        s => !(s.pluginName === pluginName && s.handler === handler)
      );
      if (filtered.length === 0) {
        this.subscriptions.delete(channel);
      } else {
        this.subscriptions.set(channel, filtered);
      }
    }
  }

  /**
   * Unsubscribe a plugin from all channels (used during plugin teardown).
   */
  unsubscribeAll(pluginName: string): void {
    const channels = this.pluginChannels.get(pluginName);
    if (!channels) {
      return;
    }

    for (const channel of channels) {
      const list = this.subscriptions.get(channel);
      if (list) {
        const filtered = list.filter(s => s.pluginName !== pluginName);
        if (filtered.length === 0) {
          this.subscriptions.delete(channel);
        } else {
          this.subscriptions.set(channel, filtered);
        }
      }
    }

    this.pluginChannels.delete(pluginName);

    // Reject pending requests from this plugin
    for (const [id, pending] of this.pendingRequests) {
      pending.reject(
        new Error(
          `Plugin "${pluginName}" unsubscribed; pending request cancelled`
        )
      );
      clearTimeout(pending.timer);
      this.pendingRequests.delete(id);
    }
    this.pluginPendingCount.delete(pluginName);

    this.logger.debug(`Plugin "${pluginName}" unsubscribed from all channels`);
  }

  // -----------------------------------------------------------------------
  // Send
  // -----------------------------------------------------------------------

  /**
   * Send an event (fire-and-forget) from one plugin to a channel.
   * All subscribers on that channel receive the message.
   */
  async sendEvent(
    from: string,
    channel: string,
    payload: unknown
  ): Promise<void> {
    this.validatePayloadSize(payload);

    const message: IpcMessage = {
      id: generateId(),
      kind: 'event',
      from,
      channel,
      payload,
      timestamp: Date.now(),
    };

    const subs = this.subscriptions.get(channel) ?? [];
    const deliveryPromises: Promise<void>[] = [];

    for (const sub of subs) {
      if (sub.pluginName === from) {
        continue;
      } // Don't deliver to self

      if (
        this.accessChecker &&
        !this.accessChecker(from, sub.pluginName, channel)
      ) {
        this.logger.warn(
          `IPC access denied: "${from}" -> "${sub.pluginName}" on channel "${channel}"`
        );
        continue;
      }

      deliveryPromises.push(
        this.deliverToHandler(sub, { ...message, to: sub.pluginName })
      );
    }

    await Promise.allSettled(deliveryPromises);
  }

  /**
   * Send a request and wait for a response from a specific plugin.
   */
  async sendRequest(
    from: string,
    to: string,
    channel: string,
    payload: unknown
  ): Promise<unknown> {
    this.validatePayloadSize(payload);

    // Backpressure check
    const pending = this.pluginPendingCount.get(from) ?? 0;
    if (pending >= this.config.maxPendingPerPlugin) {
      throw new Error(
        `Plugin "${from}" has too many pending IPC requests (${pending}/${this.config.maxPendingPerPlugin})`
      );
    }

    if (this.accessChecker && !this.accessChecker(from, to, channel)) {
      throw new Error(
        `IPC access denied: "${from}" -> "${to}" on channel "${channel}"`
      );
    }

    const correlationId = generateId();
    const message: IpcMessage = {
      id: generateId(),
      kind: 'request',
      from,
      to,
      channel,
      payload,
      correlationId,
      timestamp: Date.now(),
    };

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        this.decrementPending(from);
        reject(
          new Error(
            `IPC request timeout: "${from}" -> "${to}" on channel "${channel}" after ${this.config.requestTimeoutMs}ms`
          )
        );
      }, this.config.requestTimeoutMs);

      this.pendingRequests.set(correlationId, { resolve, reject, timer });
      this.pluginPendingCount.set(from, pending + 1);

      // Deliver to the target plugin's handlers
      const subs = this.subscriptions.get(channel) ?? [];
      const targetSub = subs.find(s => s.pluginName === to);
      if (!targetSub) {
        clearTimeout(timer);
        this.pendingRequests.delete(correlationId);
        this.decrementPending(from);
        reject(
          new Error(
            `No handler registered by plugin "${to}" on channel "${channel}"`
          )
        );
        return;
      }

      this.deliverToHandler(targetSub, message)
        .then(result => {
          const pendingReq = this.pendingRequests.get(correlationId);
          if (pendingReq) {
            clearTimeout(pendingReq.timer);
            this.pendingRequests.delete(correlationId);
            this.decrementPending(from);
            pendingReq.resolve(result);
          }
        })
        .catch(err => {
          const pendingReq = this.pendingRequests.get(correlationId);
          if (pendingReq) {
            clearTimeout(pendingReq.timer);
            this.pendingRequests.delete(correlationId);
            this.decrementPending(from);
            pendingReq.reject(
              err instanceof Error ? err : new Error(String(err))
            );
          }
        });
    });
  }

  /**
   * Broadcast a message to all subscribers on a channel.
   */
  async broadcast(
    from: string,
    channel: string,
    payload: unknown
  ): Promise<void> {
    this.validatePayloadSize(payload);

    const message: IpcMessage = {
      id: generateId(),
      kind: 'broadcast',
      from,
      channel,
      payload,
      timestamp: Date.now(),
    };

    const subs = this.subscriptions.get(channel) ?? [];
    const deliveries: Promise<void>[] = [];

    for (const sub of subs) {
      if (sub.pluginName === from) {
        continue;
      }
      deliveries.push(
        this.deliverToHandler(sub, { ...message, to: sub.pluginName })
      );
    }

    await Promise.allSettled(deliveries);
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private async deliverToHandler(
    sub: IpcSubscription,
    message: IpcMessage
  ): Promise<any> {
    try {
      return await sub.handler(message);
    } catch (err) {
      this.logger.error(
        `IPC handler error in plugin "${sub.pluginName}" on channel "${sub.channel}": ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      throw err;
    }
  }

  private decrementPending(pluginName: string): void {
    const count = this.pluginPendingCount.get(pluginName) ?? 0;
    if (count <= 1) {
      this.pluginPendingCount.delete(pluginName);
    } else {
      this.pluginPendingCount.set(pluginName, count - 1);
    }
  }

  private validatePayloadSize(payload: unknown): void {
    const serialized = JSON.stringify(payload);
    if (serialized.length > this.config.maxPayloadBytes) {
      throw new Error(
        `IPC payload exceeds maximum size (${serialized.length} > ${this.config.maxPayloadBytes} bytes)`
      );
    }
  }

  // -----------------------------------------------------------------------
  // Diagnostics
  // -----------------------------------------------------------------------

  /**
   * Return a summary of the bus state for diagnostics.
   */
  diagnostics(): {
    totalChannels: number;
    totalSubscriptions: number;
    pendingRequests: number;
    pluginSubscriptions: Record<string, string[]>;
  } {
    let totalSubscriptions = 0;
    for (const subs of this.subscriptions.values()) {
      totalSubscriptions += subs.length;
    }

    const pluginSubscriptions: Record<string, string[]> = {};
    for (const [plugin, channels] of this.pluginChannels) {
      pluginSubscriptions[plugin] = Array.from(channels);
    }

    return {
      totalChannels: this.subscriptions.size,
      totalSubscriptions,
      pendingRequests: this.pendingRequests.size,
      pluginSubscriptions,
    };
  }
}
