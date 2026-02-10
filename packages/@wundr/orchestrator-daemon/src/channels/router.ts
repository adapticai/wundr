/**
 * Channel Router
 *
 * Routes inbound messages to the correct Orchestrator agent session by building
 * deterministic session keys from channel, account, and peer information.
 *
 * Inspired by OpenClaw's resolve-route.ts binding-chain resolution and
 * session-key.ts key generation.
 *
 * @packageDocumentation
 */


import type {
  ChannelId,
  ChannelLogger,
  ChatType,
  NormalizedMessage,
} from './types.js';

// ---------------------------------------------------------------------------
// Route Types
// ---------------------------------------------------------------------------

/**
 * Identifies a conversation peer -- the "other side" of a conversation
 * from the Orchestrator's perspective.
 */
export interface RoutePeer {
  /** What kind of conversation this peer represents. */
  readonly kind: ChatType;
  /** Platform-native peer ID (user ID for DMs, channel/group ID otherwise). */
  readonly id: string;
}

/**
 * Input to the routing resolution process.
 */
export interface RouteInput {
  /** Which channel the message arrived on. */
  readonly channelId: ChannelId;
  /** Account ID within the channel (e.g., Slack team, Discord guild). */
  readonly accountId?: string;
  /** The conversation peer. */
  readonly peer?: RoutePeer;
  /** Parent peer for thread inheritance. */
  readonly parentPeer?: RoutePeer;
  /** Guild/server ID (Discord, etc.). */
  readonly guildId?: string;
  /** Team/workspace ID (Slack, etc.). */
  readonly teamId?: string;
}

/**
 * Binding rule that maps channel + context to a specific agent.
 */
export interface RouteBinding {
  /** Which agent to route to. */
  readonly agentId: string;
  /** Match criteria. */
  readonly match: {
    readonly channel: ChannelId;
    readonly accountId?: string;
    readonly peer?: RoutePeer;
    readonly guildId?: string;
    readonly teamId?: string;
  };
  /** Priority (lower = higher priority). Same-priority bindings are evaluated in order. */
  readonly priority?: number;
}

/**
 * Result of resolving a route.
 */
export interface ResolvedRoute {
  /** The agent ID that should handle this message. */
  readonly agentId: string;
  /** Canonical channel ID. */
  readonly channelId: ChannelId;
  /** Normalized account ID. */
  readonly accountId: string;
  /** Deterministic session key for persistence and concurrency. */
  readonly sessionKey: string;
  /** How the route was matched, for debugging. */
  readonly matchedBy:
    | 'binding.peer'
    | 'binding.peer.parent'
    | 'binding.guild'
    | 'binding.team'
    | 'binding.account'
    | 'binding.channel'
    | 'default';
}

// ---------------------------------------------------------------------------
// DM Scope
// ---------------------------------------------------------------------------

/**
 * Controls how DM session keys are scoped.
 *
 * - "main": All DMs share a single session per agent (simplest)
 * - "per-peer": Each DM partner gets their own session
 * - "per-channel-peer": Session is scoped to channel + peer
 * - "per-account-channel-peer": Full isolation (account + channel + peer)
 */
export type DmScope =
  | 'main'
  | 'per-peer'
  | 'per-channel-peer'
  | 'per-account-channel-peer';

// ---------------------------------------------------------------------------
// Router Options
// ---------------------------------------------------------------------------

export interface ChannelRouterOptions {
  /** Default agent ID when no binding matches. */
  defaultAgentId: string;
  /** Default Orchestrator ID for session key namespacing. */
  orchestratorId: string;
  /** Route bindings in priority order. */
  bindings?: readonly RouteBinding[];
  /** DM session scoping strategy. */
  dmScope?: DmScope;
  /** Cross-channel identity links (maps a canonical ID to platform-specific IDs). */
  identityLinks?: Readonly<Record<string, readonly string[]>>;
  /** Logger. */
  logger?: ChannelLogger;
}

// ---------------------------------------------------------------------------
// ChannelRouter
// ---------------------------------------------------------------------------

/**
 * Routes inbound messages to agent sessions.
 *
 * Resolution priority chain (matching OpenClaw):
 * 1. Exact peer match (channel + account + peer kind/id)
 * 2. Parent peer match (thread inheritance)
 * 3. Guild match (Discord servers, etc.)
 * 4. Team match (Slack workspaces, etc.)
 * 5. Account match (channel + account, no peer/guild/team)
 * 6. Channel-wide match
 * 7. Default agent
 */
export class ChannelRouter {
  private readonly options: Required<
    Omit<ChannelRouterOptions, 'logger' | 'identityLinks'>
  > & {
    logger: ChannelLogger;
    identityLinks: Readonly<Record<string, readonly string[]>>;
  };

  private bindings: RouteBinding[];

  constructor(options: ChannelRouterOptions) {
    this.options = {
      defaultAgentId: options.defaultAgentId,
      orchestratorId: options.orchestratorId,
      bindings: options.bindings ?? [],
      dmScope: options.dmScope ?? 'per-peer',
      identityLinks: options.identityLinks ?? {},
      logger: options.logger ?? {
        info: (msg, ...args) =>
          console.log(`[ChannelRouter] ${msg}`, ...args),
        warn: (msg, ...args) =>
          console.warn(`[ChannelRouter] ${msg}`, ...args),
        error: (msg, ...args) =>
          console.error(`[ChannelRouter] ${msg}`, ...args),
        debug: (msg, ...args) =>
          console.debug(`[ChannelRouter] ${msg}`, ...args),
      },
    };
    this.bindings = [...(options.bindings ?? [])];
    this.bindings.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  }

  // -----------------------------------------------------------------------
  // Route Resolution
  // -----------------------------------------------------------------------

  /**
   * Resolve an inbound message to a route (agent + session key).
   */
  resolveFromMessage(message: NormalizedMessage): ResolvedRoute {
    return this.resolve({
      channelId: message.channelId,
      accountId: message.guildId,
      peer: {
        kind: message.chatType,
        id:
          message.chatType === 'direct'
            ? message.sender.id
            : message.conversationId,
      },
      guildId: message.guildId,
    });
  }

  /**
   * Resolve a route from explicit input parameters.
   */
  resolve(input: RouteInput): ResolvedRoute {
    const channelId = normalize(input.channelId);
    const accountId = normalize(input.accountId ?? 'default');
    const peer = input.peer
      ? { kind: input.peer.kind, id: normalize(input.peer.id) }
      : null;
    const guildId = normalize(input.guildId ?? '');
    const teamId = normalize(input.teamId ?? '');

    // Filter bindings to those matching channel + account.
    const candidates = this.bindings.filter((binding) => {
      if (normalize(binding.match.channel) !== channelId) {
        return false;
      }
      return matchesAccountId(binding.match.accountId, accountId);
    });

    const choose = (
      agentId: string,
      matchedBy: ResolvedRoute['matchedBy'],
    ): ResolvedRoute => {
      const sessionKey = this.buildSessionKey({
        agentId,
        channelId,
        accountId,
        peer,
      });
      return {
        agentId,
        channelId,
        accountId,
        sessionKey,
        matchedBy,
      };
    };

    // 1. Exact peer match.
    if (peer) {
      const peerMatch = candidates.find(
        (b) =>
          b.match.peer &&
          normalize(b.match.peer.kind) === peer.kind &&
          normalize(b.match.peer.id) === peer.id,
      );
      if (peerMatch) {
        return choose(peerMatch.agentId, 'binding.peer');
      }
    }

    // 2. Parent peer match (thread inheritance).
    const parentPeer = input.parentPeer
      ? { kind: input.parentPeer.kind, id: normalize(input.parentPeer.id) }
      : null;
    if (parentPeer && parentPeer.id) {
      const parentMatch = candidates.find(
        (b) =>
          b.match.peer &&
          normalize(b.match.peer.kind) === parentPeer.kind &&
          normalize(b.match.peer.id) === parentPeer.id,
      );
      if (parentMatch) {
        return choose(parentMatch.agentId, 'binding.peer.parent');
      }
    }

    // 3. Guild match.
    if (guildId) {
      const guildMatch = candidates.find(
        (b) => b.match.guildId && normalize(b.match.guildId) === guildId,
      );
      if (guildMatch) {
        return choose(guildMatch.agentId, 'binding.guild');
      }
    }

    // 4. Team match.
    if (teamId) {
      const teamMatch = candidates.find(
        (b) => b.match.teamId && normalize(b.match.teamId) === teamId,
      );
      if (teamMatch) {
        return choose(teamMatch.agentId, 'binding.team');
      }
    }

    // 5. Account match (no peer, guild, or team specified in binding).
    const accountMatch = candidates.find(
      (b) =>
        b.match.accountId?.trim() !== '*' &&
        !b.match.peer &&
        !b.match.guildId &&
        !b.match.teamId,
    );
    if (accountMatch) {
      return choose(accountMatch.agentId, 'binding.account');
    }

    // 6. Channel-wide wildcard match.
    const channelMatch = candidates.find(
      (b) =>
        b.match.accountId?.trim() === '*' &&
        !b.match.peer &&
        !b.match.guildId &&
        !b.match.teamId,
    );
    if (channelMatch) {
      return choose(channelMatch.agentId, 'binding.channel');
    }

    // 7. Default.
    return choose(this.options.defaultAgentId, 'default');
  }

  // -----------------------------------------------------------------------
  // Session Key Generation
  // -----------------------------------------------------------------------

  /**
   * Build a deterministic session key.
   *
   * Schema: `{orchestratorId}:{agentId}:{channelId}:{accountId}:{peerSegment}`
   *
   * The peer segment depends on dmScope:
   * - main: "main"
   * - per-peer: "{peerKind}:{peerId}" (with identity link resolution)
   * - per-channel-peer: "{channelId}:{peerKind}:{peerId}"
   * - per-account-channel-peer: "{accountId}:{channelId}:{peerKind}:{peerId}"
   */
  buildSessionKey(params: {
    agentId: string;
    channelId: ChannelId;
    accountId: string;
    peer: RoutePeer | null;
  }): string {
    const { agentId, channelId, accountId, peer } = params;
    const base = `${this.options.orchestratorId}:${sanitize(agentId)}`;

    if (!peer || peer.kind === 'direct') {
      const peerId = peer ? this.resolveIdentity(peer.id) : 'unknown';
      switch (this.options.dmScope) {
        case 'main':
          return `${base}:main`.toLowerCase();
        case 'per-peer':
          return `${base}:dm:${peerId}`.toLowerCase();
        case 'per-channel-peer':
          return `${base}:${channelId}:dm:${peerId}`.toLowerCase();
        case 'per-account-channel-peer':
          return `${base}:${accountId}:${channelId}:dm:${peerId}`.toLowerCase();
      }
    }

    // Group / channel / thread conversations.
    return `${base}:${channelId}:${accountId}:${peer.kind}:${peer.id}`.toLowerCase();
  }

  // -----------------------------------------------------------------------
  // Binding Management
  // -----------------------------------------------------------------------

  /**
   * Add a route binding at runtime.
   */
  addBinding(binding: RouteBinding): void {
    this.bindings.push(binding);
    this.bindings.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  }

  /**
   * Remove all bindings for a given agent.
   */
  removeBindingsForAgent(agentId: string): number {
    const before = this.bindings.length;
    this.bindings = this.bindings.filter((b) => b.agentId !== agentId);
    return before - this.bindings.length;
  }

  /**
   * List all current bindings.
   */
  listBindings(): readonly RouteBinding[] {
    return this.bindings;
  }

  // -----------------------------------------------------------------------
  // Identity Links
  // -----------------------------------------------------------------------

  /**
   * Resolve a platform-specific user ID to its canonical identity.
   * If the user has a cross-channel identity link, the canonical ID is returned.
   * Otherwise the input is returned unchanged.
   */
  private resolveIdentity(platformUserId: string): string {
    const normalized = platformUserId.toLowerCase();
    for (const [canonicalId, linkedIds] of Object.entries(
      this.options.identityLinks,
    )) {
      if (
        linkedIds.some((linked) => linked.toLowerCase() === normalized)
      ) {
        return canonicalId.toLowerCase();
      }
    }
    return normalized;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function sanitize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_');
}

function matchesAccountId(
  match: string | undefined,
  actual: string,
): boolean {
  const trimmed = (match ?? '').trim();
  if (!trimmed) {
    return actual === 'default';
  }
  if (trimmed === '*') {
    return true;
  }
  return trimmed.toLowerCase() === actual.toLowerCase();
}

// ---------------------------------------------------------------------------
// Convenience: Route from NormalizedMessage
// ---------------------------------------------------------------------------

/**
 * Extract RouteInput from a NormalizedMessage.
 */
export function routeInputFromMessage(
  message: NormalizedMessage,
): RouteInput {
  return {
    channelId: message.channelId,
    accountId: message.guildId,
    peer: {
      kind: message.chatType,
      id:
        message.chatType === 'direct'
          ? message.sender.id
          : message.conversationId,
    },
    guildId: message.guildId,
  };
}
