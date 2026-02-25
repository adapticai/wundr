# Wave 2 / Task 13: Channel Abstraction Layer

## Analysis Date: 2026-02-09

## 1. OpenClaw Architecture Study

### Plugin System (types.plugin.ts)

OpenClaw's channel system is built around a `ChannelPlugin` interface that decomposes channel
concerns into composable adapter interfaces:

- **id + meta + capabilities**: Identity, display metadata, and feature flags
- **config**: Account resolution, enable/disable, allow-lists
- **setup**: Onboarding wizard hooks, account provisioning
- **pairing**: DM approval workflows (idLabel, normalizeAllowEntry, notifyApproval)
- **security**: DM policy enforcement, warning collection
- **groups**: Mention gating, group tool policies
- **outbound**: Delivery mode (direct/gateway/hybrid), chunking, media, polls
- **gateway**: Start/stop account connections, QR-login, logout
- **streaming**: Block-streaming coalesce defaults
- **threading**: Reply-to mode resolution, tool context building
- **messaging**: Target normalization, ID detection
- **directory**: Peer/group listing, member resolution
- **resolver**: Target name-to-ID resolution
- **actions**: Message actions (buttons, cards, custom handlers)
- **heartbeat**: Ready checks, recipient resolution
- **agentTools**: Channel-owned tools (e.g., WhatsApp login)

### Registry (registry.ts)

- Ordered channel list: `CHAT_CHANNEL_ORDER` for UI display
- Alias system: `imsg` -> `imessage`, `gchat` -> `googlechat`
- Normalization: Case-insensitive, trimmed, alias-resolved
- Two-tier lookup: Built-in channels + plugin registry for extensions
- Meta includes: label, blurb, docs path, system image, selection hints

### Routing (resolve-route.ts)

- Binding-based resolution with priority chain:
  1. Exact peer match (channel + account + peer kind/id)
  2. Parent peer match (thread inheritance)
  3. Guild match (Discord servers)
  4. Team match (Slack workspaces)
  5. Account match
  6. Channel-wide match
  7. Default agent
- Session key generation: `agentId:channel:accountId:peerKind:peerId`
- DM scope options: main, per-peer, per-channel-peer, per-account-channel-peer
- Identity links: Cross-channel identity collapse

### Dock System (dock.ts)

Lightweight channel metadata layer that avoids importing heavy plugin modules:

- Capabilities, outbound limits, streaming defaults, threading config
- Shared code imports from dock, not from full plugins
- Plugin docks auto-generated from ChannelPlugin via `buildDockFromPlugin`

### Key Patterns

1. **Message normalization per channel** (normalize/slack.ts, normalize/discord.ts, etc.)
2. **Media limits** resolved per-channel with global fallback
3. **Typing indicators** via start/stop callback pairs
4. **Ack reactions** with scope-based gating (all/direct/group-mentions/off)
5. **Session recording** on inbound with last-route tracking

## 2. Wundr Current State

### Existing Slack Integration (@wundr/slack-agent)

The `SlackUserAgent` class is a monolithic integration that:

- Wraps `@slack/web-api` WebClient + `@slack/socket-mode` SocketModeClient
- Composes 16 capability modules (reactions, channels, threading, etc.)
- Operates as a "Virtual Principal" (full user account, not a bot)
- Supports: messaging, reactions, files, channels, profiles, search, reminders, usergroups, DND,
  stars, bookmarks, threading, proactive messaging
- Socket Mode event routing via EventEmitter pattern

### Gap Analysis

| Concern          | OpenClaw                | Wundr Current    | Gap                            |
| ---------------- | ----------------------- | ---------------- | ------------------------------ |
| Multi-channel    | 7+ channels             | Slack only       | Need abstraction layer         |
| Plugin interface | Decomposed adapters     | Monolithic class | Need ChannelPlugin interface   |
| Message format   | Per-channel normalizers | Slack-native     | Need unified NormalizedMessage |
| Routing          | Binding chain           | N/A              | Need channel router            |
| Session keys     | agent:channel:peer      | N/A              | Need session key generator     |
| DM pairing       | Allow-list + approval   | N/A              | Need security model            |
| Media pipeline   | Per-channel limits      | Slack files only | Need media abstraction         |
| Typing/ack       | Callback pairs + scope  | N/A              | Need indicator system          |

## 3. Design: Channel Abstraction Layer

### 3.1 Core Interface (`types.ts`)

The `ChannelPlugin` interface follows OpenClaw's decomposition but adapts it for Wundr's
Orchestrator model where the agent operates as a full user (not a bot):

```
ChannelPlugin
  +-- id: ChannelId
  +-- meta: ChannelMeta
  +-- capabilities: ChannelCapabilities
  +-- lifecycle: connect / disconnect / healthCheck
  +-- messaging: sendMessage / editMessage / deleteMessage
  +-- events: onMessage callback registration
  +-- threading: replyToThread / getThreadReplies
  +-- reactions: addReaction / removeReaction
  +-- typing: sendTypingIndicator
  +-- media: sendMedia / downloadMedia (with size limits)
  +-- security: validateSender / pairingConfig
  +-- config: ChannelConfig (platform-specific)
```

### 3.2 Unified Message Format

All channel adapters normalize inbound messages into `NormalizedMessage`:

```
NormalizedMessage
  +-- id: string (platform message ID)
  +-- channelId: ChannelId
  +-- channelSpecificId: string (platform-native ID)
  +-- conversationId: string (channel/chat/DM ID)
  +-- threadId?: string
  +-- sender: NormalizedSender
  +-- content: MessageContent
  +-- timestamp: Date
  +-- chatType: "direct" | "group" | "channel" | "thread"
  +-- replyTo?: string
  +-- raw: unknown (original platform payload)
```

### 3.3 Channel Registry

Auto-discovery via explicit registration + directory scanning:

```
ChannelRegistry
  +-- register(plugin) / unregister(id)
  +-- get(id) / list() / listEnabled()
  +-- resolve(aliasOrId) -> ChannelId
  +-- aliases: Map<string, ChannelId>
```

### 3.4 Message Router

Routes inbound messages to the correct agent session:

```
ChannelRouter
  +-- route(message) -> ResolvedRoute
  +-- buildSessionKey(params) -> string
  +-- resolveAgent(params) -> string
```

### 3.5 Session Key Schema

```
{orchestratorId}:{channelId}:{accountId}:{peerKind}:{peerId}
```

Example: `ada:slack:T123:dm:U456` or `ada:discord:guild123:channel:C789`

### 3.6 Adapter Architecture

Each adapter wraps a platform SDK and implements ChannelPlugin:

```
SlackChannelAdapter    -> @slack/web-api, @slack/socket-mode
DiscordChannelAdapter  -> discord.js
TelegramChannelAdapter -> telegraf / grammy
TerminalChannelAdapter -> Node readline
WebSocketChannelAdapter -> ws (internal daemon<->client)
```

### 3.7 Media Pipeline

Per-channel size limits with global default fallback:

```
MediaPipeline
  +-- resolveMaxBytes(channelId, config) -> number
  +-- validateMedia(attachment, channelId) -> boolean
  +-- defaults: { slack: 1GB, discord: 25MB, telegram: 50MB }
```

### 3.8 Security: DM Pairing

Adapted from OpenClaw's pairing system:

```
PairingConfig
  +-- requireApproval: boolean
  +-- allowList: string[]
  +-- normalizeEntry(raw) -> string
  +-- onApproval(id) -> Promise<void>
```

## 4. Implementation Plan

### Files to Create

```
packages/@wundr/orchestrator-daemon/src/channels/
  types.ts          -- ChannelPlugin interface, NormalizedMessage, capabilities
  registry.ts       -- ChannelRegistry with auto-discovery
  router.ts         -- Message routing, session keys, agent resolution
  adapters/
    slack.ts        -- SlackChannelAdapter (wraps existing @wundr/slack-agent)
    discord.ts      -- DiscordChannelAdapter
    telegram.ts     -- TelegramChannelAdapter
    terminal.ts     -- TerminalChannelAdapter (CLI/dev)
    websocket.ts    -- WebSocketChannelAdapter (internal)
```

### Integration Points

- `@wundr/slack-agent` SlackUserAgent becomes the backing implementation for SlackChannelAdapter
- `orchestrator-daemon` session-manager uses ChannelRouter for session key generation
- `orchestrator-daemon` websocket-server exposes WebSocketChannelAdapter for GUI clients
- Federation layer can route cross-Orchestrator messages via channel abstraction

### Migration Strategy

1. Create abstraction layer (this task)
2. Wrap existing SlackUserAgent behind SlackChannelAdapter
3. Add Discord adapter (highest demand after Slack)
4. Add Telegram adapter
5. Terminal adapter for local dev/testing
6. WebSocket adapter for Neolith web client
