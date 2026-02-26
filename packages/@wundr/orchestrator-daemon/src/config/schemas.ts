/**
 * Comprehensive Zod Schemas for Wundr Orchestrator Daemon Configuration
 *
 * Covers all configuration domains: daemon, agents, memory, security,
 * channels, model/provider, plugins, hooks, monitoring, logging,
 * distributed clustering, and token budgets.
 *
 * Modeled after OpenClaw's zod-schema.ts with Wundr-specific extensions.
 *
 * @module @wundr/orchestrator-daemon/config/schemas
 */

import { z } from 'zod';

// =============================================================================
// Primitives & Reusable Schemas
// =============================================================================

/** Port number: 1024-65535 */
const PortSchema = z.number().int().min(1024).max(65535);

/** Positive integer */
const PositiveInt = z.number().int().positive();

/** Duration in milliseconds (positive integer) */
const DurationMs = z.number().int().min(0);

/** Percentage as a decimal (0-1) */
const Percentage = z.number().min(0).max(1);

/** URL string with format validation */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const UrlString = z.string().url();

/** Non-empty trimmed string */
const NonEmptyString = z.string().min(1).trim();

/** Optional boolean that parses string "true"/"1" */
const CoercibleBoolean = z.boolean().default(false);

// =============================================================================
// Meta Schema
// =============================================================================

export const MetaSchema = z
  .object({
    /** Config format version for migration support */
    $version: z.number().int().min(1).default(1),
    /** Last Wundr version that touched this config */
    lastTouchedVersion: z.string().optional(),
    /** ISO timestamp of last config write */
    lastTouchedAt: z.string().optional(),
  })
  .strict()
  .optional();

// =============================================================================
// Daemon Schema
// =============================================================================

export const DaemonSchema = z
  .object({
    /** Human-readable daemon instance name */
    name: z.string().default('orchestrator-daemon'),
    /** HTTP/WebSocket listen port */
    port: PortSchema.default(8787),
    /** Bind address */
    host: z.string().default('127.0.0.1'),
    /** Maximum concurrent sessions */
    maxSessions: PositiveInt.default(100),
    /** Enable verbose logging */
    verbose: CoercibleBoolean,
    /** Graceful shutdown timeout (ms) */
    shutdownTimeoutMs: DurationMs.default(10000),
    /** Heartbeat interval (ms) */
    heartbeatIntervalMs: DurationMs.default(30000),
    /** Health check interval (ms) */
    healthCheckIntervalMs: DurationMs.default(60000),
    /** Config reload strategy */
    reload: z
      .object({
        /** Reload mode: off, hot, restart, hybrid */
        mode: z.enum(['off', 'hot', 'restart', 'hybrid']).default('hybrid'),
        /** Debounce window before applying config changes (ms) */
        debounceMs: DurationMs.default(300),
      })
      .default({}),
  })
  .default({});

// =============================================================================
// Identity Schema (shared by agents)
// =============================================================================

export const IdentitySchema = z
  .object({
    /** Display name */
    name: z.string().optional(),
    /** Avatar URL or workspace-relative path */
    avatar: z.string().optional(),
    /** System prompt override */
    systemPrompt: z.string().optional(),
    /** Persona description for context */
    persona: z.string().optional(),
  })
  .strict();

// =============================================================================
// Model / Provider Schema
// =============================================================================

export const ModelRoutingSchema = z
  .object({
    /** Primary model identifier (provider/model) */
    primary: NonEmptyString,
    /** Ordered fallback models */
    fallbacks: z.array(NonEmptyString).default([]),
  })
  .strict();

export const ProviderConfigSchema = z
  .object({
    /** Provider type */
    provider: z.enum(['openai', 'anthropic', 'azure', 'google', 'custom']),
    /** API key (sensitive) */
    apiKey: z.string().optional(),
    /** Base URL override */
    baseUrl: z.string().optional(),
    /** Organization ID */
    organization: z.string().optional(),
    /** Request timeout (ms) */
    timeoutMs: DurationMs.default(60000),
    /** Max retries for failed requests */
    maxRetries: z.number().int().min(0).max(10).default(3),
    /** Custom request headers */
    headers: z.record(z.string()).optional(),
    /** Default model to use */
    defaultModel: z.string().optional(),
  })
  .strict();

export const ModelConfigSchema = z
  .object({
    /** Named provider configurations */
    providers: z.record(ProviderConfigSchema).default({}),
    /** Default model routing */
    routing: ModelRoutingSchema.optional(),
    /** Image model routing override */
    imageRouting: ModelRoutingSchema.optional(),
    /** Temperature override (0-2) */
    temperature: z.number().min(0).max(2).optional(),
    /** Max tokens override */
    maxTokens: PositiveInt.optional(),
  })
  .default({});

// =============================================================================
// Agent Schema
// =============================================================================

export const AgentToolsSchema = z
  .object({
    /** Tool profile preset */
    profile: z.enum(['minimal', 'coding', 'analysis', 'full']).optional(),
    /** Explicit tool allow list */
    allow: z.array(z.string()).optional(),
    /** Explicit tool deny list */
    deny: z.array(z.string()).optional(),
    /** Additive allow entries (merged into profile/allow) */
    alsoAllow: z.array(z.string()).optional(),
    /** Per-provider tool policy overrides */
    byProvider: z
      .record(
        z.object({
          allow: z.array(z.string()).optional(),
          deny: z.array(z.string()).optional(),
          alsoAllow: z.array(z.string()).optional(),
          profile: z.string().optional(),
        })
      )
      .optional(),
  })
  .strict();

export const AgentHeartbeatSchema = z
  .object({
    /** Enable heartbeat for this agent */
    enabled: CoercibleBoolean,
    /** Heartbeat interval override (ms) */
    intervalMs: DurationMs.optional(),
    /** Delivery target channel */
    target: z.string().default('last'),
  })
  .strict();

export const AgentMemorySearchSchema = z
  .object({
    /** Enable memory search */
    enabled: CoercibleBoolean,
    /** Embedding provider */
    provider: z.enum(['openai', 'gemini', 'voyage', 'local']).optional(),
    /** Sources to index */
    sources: z.array(z.enum(['memory', 'sessions'])).default(['memory']),
    /** Max search results */
    maxResults: PositiveInt.default(6),
    /** Minimum relevance score */
    minScore: Percentage.default(0.3),
  })
  .strict();

export const SingleAgentSchema = z
  .object({
    /** Agent type identifier */
    type: z.string().optional(),
    /** Agent identity */
    identity: IdentitySchema.optional(),
    /** Model routing override */
    model: ModelRoutingSchema.optional(),
    /** Tool access policy */
    tools: AgentToolsSchema.optional(),
    /** Heartbeat configuration */
    heartbeat: AgentHeartbeatSchema.optional(),
    /** Memory search override */
    memorySearch: AgentMemorySearchSchema.optional(),
    /** Workspace directory */
    workspace: z.string().optional(),
    /** Agent-specific env vars */
    env: z.record(z.string()).optional(),
    /** Maximum concurrent sessions for this agent */
    maxConcurrency: PositiveInt.optional(),
    /** Skills filter (omit = all, empty = none) */
    skills: z.array(z.string()).optional(),
  })
  .strict();

export const AgentDefaultsSchema = SingleAgentSchema.omit({ type: true })
  .extend({
    /** Bootstrap max chars injected into system prompt */
    bootstrapMaxChars: PositiveInt.default(20000),
    /** Envelope timezone */
    envelopeTimezone: z.string().default('utc'),
  })
  .strict();

export const AgentsSchema = z
  .object({
    /** Default settings for all agents */
    defaults: AgentDefaultsSchema.default({}),
    /** Named agent configurations */
    list: z
      .array(
        SingleAgentSchema.extend({
          /** Required unique agent ID */
          id: NonEmptyString,
          /** Agent directory (relative or absolute) */
          dir: z.string().optional(),
        })
      )
      .default([]),
  })
  .default({});

// =============================================================================
// Memory Schema
// =============================================================================

export const MemoryCompactionSchema = z
  .object({
    /** Enable automatic context compaction */
    enabled: z.boolean().default(true),
    /** Compaction trigger threshold (fraction of context used) */
    threshold: Percentage.default(0.8),
    /** Compaction strategy */
    strategy: z.enum(['summary', 'sliding-window', 'hybrid']).default('hybrid'),
  })
  .strict();

export const MemorySchema = z
  .object({
    /** Memory backend */
    backend: z.enum(['builtin', 'qmd', 'plugin']).default('builtin'),
    /** Max heap memory (MB) */
    maxHeapMB: PositiveInt.default(2048),
    /** Max context window tokens */
    maxContextTokens: PositiveInt.default(128000),
    /** Compaction settings */
    compaction: MemoryCompactionSchema.default({}),
    /** Citation mode */
    citations: z.enum(['auto', 'on', 'off']).default('auto'),
    /** QMD sidecar configuration (when backend = "qmd") */
    qmd: z
      .object({
        command: z.string().optional(),
        paths: z
          .array(
            z.object({
              path: z.string(),
              pattern: z.string().optional(),
              name: z.string().optional(),
            })
          )
          .optional(),
        limits: z
          .object({
            maxResults: PositiveInt.default(6),
            maxSnippetChars: PositiveInt.default(700),
            maxInjectedChars: PositiveInt.optional(),
            timeoutMs: DurationMs.default(4000),
          })
          .default({}),
      })
      .optional(),
  })
  .default({});

// =============================================================================
// Security Schema
// =============================================================================

export const JwtSchema = z
  .object({
    /** JWT signing secret (min 32 chars) */
    secret: z
      .string()
      .min(32, 'JWT secret must be at least 32 characters')
      .default('change-this-in-production-to-a-random-secure-string'),
    /** Token expiration duration */
    expiration: z.string().default('24h'),
    /** Token refresh window */
    refreshWindow: z.string().default('1h'),
    /** Issuer claim */
    issuer: z.string().default('wundr-orchestrator'),
    /** Audience claim */
    audience: z.string().default('wundr-daemon'),
  })
  .strict();

export const CorsSchema = z
  .object({
    /** Enable CORS */
    enabled: z.boolean().default(false),
    /** Allowed origins (empty = reflect request origin) */
    origins: z.array(z.string()).default([]),
    /** Allowed methods */
    methods: z
      .array(z.string())
      .default(['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']),
    /** Max age for preflight cache (seconds) */
    maxAge: z.number().int().min(0).default(86400),
  })
  .strict();

export const RateLimitSchema = z
  .object({
    /** Enable rate limiting */
    enabled: z.boolean().default(true),
    /** Max requests per window */
    max: PositiveInt.default(100),
    /** Window size (ms) */
    windowMs: DurationMs.default(60000),
    /** Strategy for distributed rate limiting */
    strategy: z
      .enum(['fixed-window', 'sliding-window', 'token-bucket'])
      .default('sliding-window'),
  })
  .strict();

export const AuditSchema = z
  .object({
    /** Enable audit logging */
    enabled: z.boolean().default(true),
    /** Audit events to log */
    events: z
      .array(
        z.enum([
          'auth.login',
          'auth.logout',
          'auth.failed',
          'config.change',
          'session.create',
          'session.end',
          'tool.execute',
          'tool.denied',
          'agent.spawn',
          'agent.stop',
          'admin.action',
        ])
      )
      .default([
        'auth.login',
        'auth.failed',
        'config.change',
        'tool.denied',
        'admin.action',
      ]),
    /** Audit log retention (days) */
    retentionDays: PositiveInt.default(90),
    /** Audit log output destination */
    destination: z.enum(['file', 'stdout', 'database']).default('file'),
    /** Audit log file path (when destination = "file") */
    filePath: z.string().optional(),
  })
  .strict();

export const MtlsSchema = z
  .object({
    /** Enable mutual TLS */
    enabled: z.boolean().default(false),
    /** CA certificate path */
    caPath: z.string().optional(),
    /** Server certificate path */
    certPath: z.string().optional(),
    /** Server private key path */
    keyPath: z.string().optional(),
    /** Require client certificates */
    requireClientCert: z.boolean().default(false),
  })
  .strict();

export const SecuritySchema = z
  .object({
    /** JWT authentication */
    jwt: JwtSchema.default({}),
    /** CORS configuration */
    cors: CorsSchema.default({}),
    /** Rate limiting */
    rateLimit: RateLimitSchema.default({}),
    /** Audit logging */
    audit: AuditSchema.default({}),
    /** Mutual TLS */
    mtls: MtlsSchema.optional(),
    /** API key authentication (alternative to JWT) */
    apiKeys: z
      .array(
        z.object({
          /** Key identifier */
          id: NonEmptyString,
          /** Hashed API key */
          keyHash: z.string().optional(),
          /** Plain API key (will be hashed on first load) */
          key: z.string().optional(),
          /** Scopes granted to this key */
          scopes: z.array(z.string()).default(['read', 'write']),
          /** Expiration date (ISO 8601) */
          expiresAt: z.string().optional(),
        })
      )
      .default([]),
  })
  .default({});

// =============================================================================
// Channel Schema
// =============================================================================

const ChannelDmPolicySchema = z
  .enum(['open', 'pairing', 'closed'])
  .default('pairing');

const ChannelRetrySchema = z
  .object({
    attempts: z.number().int().min(0).max(10).default(3),
    minDelayMs: DurationMs.default(1000),
    maxDelayMs: DurationMs.default(30000),
    jitter: Percentage.default(0.1),
  })
  .strict();

export const SlackChannelSchema = z
  .object({
    /** Slack bot token */
    botToken: z.string().optional(),
    /** Slack app token (Socket Mode) */
    appToken: z.string().optional(),
    /** Slack user token (optional) */
    userToken: z.string().optional(),
    /** DM policy */
    dmPolicy: ChannelDmPolicySchema,
    /** Allow bot messages to trigger replies */
    allowBots: z.boolean().default(false),
    /** Thread history scope */
    thread: z
      .object({
        historyScope: z.enum(['thread', 'channel']).default('thread'),
        inheritParent: z.boolean().default(false),
      })
      .default({}),
    /** Allow config writes from Slack events */
    configWrites: z.boolean().default(true),
    /** Retry configuration */
    retry: ChannelRetrySchema.default({}),
  })
  .strict();

export const DiscordChannelSchema = z
  .object({
    /** Discord bot token */
    token: z.string().optional(),
    /** DM policy */
    dmPolicy: ChannelDmPolicySchema,
    /** Max lines per message */
    maxLinesPerMessage: PositiveInt.default(17),
    /** Privileged intents */
    intents: z
      .object({
        presence: z.boolean().default(false),
        guildMembers: z.boolean().default(false),
      })
      .default({}),
    /** Retry configuration */
    retry: ChannelRetrySchema.default({}),
    /** Allow config writes from Discord events */
    configWrites: z.boolean().default(true),
  })
  .strict();

export const TelegramChannelSchema = z
  .object({
    /** Telegram bot token */
    botToken: z.string().optional(),
    /** DM policy */
    dmPolicy: ChannelDmPolicySchema,
    /** Stream mode */
    streamMode: z.enum(['off', 'partial', 'block']).default('off'),
    /** API timeout (seconds) */
    timeoutSeconds: PositiveInt.default(500),
    /** Custom bot menu commands */
    customCommands: z
      .array(
        z.object({
          command: z.string(),
          description: z.string(),
        })
      )
      .optional(),
    /** Retry configuration */
    retry: ChannelRetrySchema.default({}),
    /** Allow config writes from Telegram events */
    configWrites: z.boolean().default(true),
  })
  .strict();

export const WebhookChannelSchema = z
  .object({
    /** Webhook endpoint URL */
    url: z.string().optional(),
    /** Webhook secret for signature verification */
    secret: z.string().optional(),
    /** Events to send via webhook */
    events: z.array(z.string()).default([]),
    /** Retry configuration */
    retry: ChannelRetrySchema.default({}),
  })
  .strict();

export const ChannelsSchema = z
  .object({
    slack: SlackChannelSchema.optional(),
    discord: DiscordChannelSchema.optional(),
    telegram: TelegramChannelSchema.optional(),
    webhook: WebhookChannelSchema.optional(),
    /** Additional channel configs from plugins (passthrough) */
  })
  .catchall(z.record(z.unknown()).optional())
  .default({});

// =============================================================================
// Plugin Schema
// =============================================================================

export const PluginEntrySchema = z
  .object({
    /** Whether this plugin is enabled */
    enabled: z.boolean().default(true),
    /** Plugin-defined configuration payload */
    config: z.record(z.unknown()).optional(),
  })
  .strict();

export const PluginInstallSchema = z
  .object({
    /** Install source */
    source: z.enum(['npm', 'archive', 'path']),
    /** Original npm spec or archive path */
    spec: z.string().optional(),
    /** Resolved install directory */
    installPath: z.string().optional(),
    /** Version recorded at install time */
    version: z.string().optional(),
    /** ISO timestamp of last install */
    installedAt: z.string().optional(),
  })
  .strict();

export const PluginsSchema = z
  .object({
    /** Master switch for plugin loading */
    enabled: z.boolean().default(true),
    /** Optional allowlist of plugin IDs (when set, only listed plugins load) */
    allow: z.array(z.string()).optional(),
    /** Optional denylist of plugin IDs (deny wins over allow) */
    deny: z.array(z.string()).optional(),
    /** Additional plugin load paths */
    loadPaths: z.array(z.string()).optional(),
    /** Plugin slot assignments */
    slots: z
      .object({
        memory: z.string().optional(),
      })
      .default({}),
    /** Per-plugin settings keyed by plugin ID */
    entries: z.record(PluginEntrySchema).default({}),
    /** CLI-managed install metadata */
    installs: z.record(PluginInstallSchema).default({}),
  })
  .default({});

// =============================================================================
// Hook Schema
// =============================================================================

export const HookEventNameSchema = z.enum([
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PermissionRequest',
  'PostToolUse',
  'PostToolUseFailure',
  'Notification',
  'SubagentStart',
  'SubagentStop',
  'Stop',
  'TeammateIdle',
  'TaskCompleted',
  'PreCompact',
  'SessionEnd',
]);

export const HookMatcherSchema = z
  .object({
    toolName: z.string().optional(),
    sessionId: z.string().optional(),
    subagentId: z.string().optional(),
    minRiskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    notificationLevel: z.enum(['info', 'warn', 'error']).optional(),
  })
  .strict();

export const HookRegistrationSchema = z
  .object({
    /** Unique hook ID */
    id: NonEmptyString,
    /** Human-readable name */
    name: z.string().optional(),
    /** Lifecycle event to fire on */
    event: HookEventNameSchema,
    /** Execution mechanism */
    type: z.enum(['command', 'prompt', 'agent']),
    /** Priority (higher runs first) */
    priority: z.number().int().default(0),
    /** Whether this hook is enabled */
    enabled: z.boolean().default(true),
    /** Optional matcher filter */
    matcher: HookMatcherSchema.optional(),
    /** Timeout (ms) */
    timeoutMs: DurationMs.optional(),
    /** Swallow errors */
    catchErrors: z.boolean().default(true),

    // Type-specific fields
    /** Shell command (type = "command") */
    command: z.string().optional(),
    /** Working directory (type = "command") */
    cwd: z.string().optional(),
    /** Extra env vars (type = "command") */
    env: z.record(z.string()).optional(),
    /** Prompt template (type = "prompt") */
    promptTemplate: z.string().optional(),
    /** Model override (type = "prompt") */
    model: z.string().optional(),
    /** Agent config path or inline (type = "agent") */
    agentConfig: z.union([z.string(), z.record(z.unknown())]).optional(),
  })
  .strict();

export const HooksSchema = z
  .object({
    /** Master switch for hooks system */
    enabled: z.boolean().default(true),
    /** Default timeout for all hooks (ms) */
    defaultTimeoutMs: DurationMs.default(10000),
    /** Max concurrent hook executions for void events */
    maxConcurrency: PositiveInt.default(5),
    /** Hook registrations */
    hooks: z.array(HookRegistrationSchema).default([]),
  })
  .default({});

// =============================================================================
// Monitoring Schema
// =============================================================================

export const MetricsSchema = z
  .object({
    /** Enable Prometheus metrics */
    enabled: z.boolean().default(true),
    /** Metrics server port */
    port: PortSchema.default(9090),
    /** Metrics endpoint path */
    path: z.string().default('/metrics'),
    /** Include default Node.js metrics */
    includeDefaults: z.boolean().default(true),
  })
  .strict();

export const HealthCheckSchema = z
  .object({
    /** Enable health check endpoint */
    enabled: z.boolean().default(true),
    /** Health check endpoint path */
    path: z.string().default('/health'),
    /** Include detailed health info */
    detailed: z.boolean().default(false),
  })
  .strict();

export const TracingSchema = z
  .object({
    /** Enable distributed tracing */
    enabled: z.boolean().default(false),
    /** Tracing endpoint (OTLP) */
    endpoint: z.string().optional(),
    /** Tracing protocol */
    protocol: z.enum(['grpc', 'http']).default('http'),
    /** Service name */
    serviceName: z.string().default('wundr-orchestrator'),
    /** Trace sample rate (0-1) */
    sampleRate: Percentage.default(0.1),
  })
  .strict();

export const MonitoringSchema = z
  .object({
    metrics: MetricsSchema.default({}),
    healthCheck: HealthCheckSchema.default({}),
    tracing: TracingSchema.optional(),
  })
  .default({});

// =============================================================================
// Logging Schema
// =============================================================================

export const LoggingSchema = z
  .object({
    /** Log level */
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    /** Output format */
    format: z.enum(['json', 'text', 'pretty']).default('json'),
    /** Log file path (optional) */
    file: z.string().optional(),
    /** Log rotation */
    rotation: z
      .object({
        enabled: z.boolean().default(true),
        maxSizeMB: PositiveInt.default(10),
        maxFiles: PositiveInt.default(5),
      })
      .default({}),
    /** Enable structured logging fields */
    structured: z.boolean().default(true),
  })
  .default({});

// =============================================================================
// Distributed Schema
// =============================================================================

export const DistributedSchema = z
  .object({
    /** Cluster name */
    clusterName: z.string().default('orchestrator-cluster'),
    /** Load balancing strategy */
    loadBalancingStrategy: z
      .enum(['round-robin', 'least-loaded', 'weighted', 'hash-based'])
      .default('least-loaded'),
    /** Rebalance interval (ms) */
    rebalanceIntervalMs: DurationMs.default(300000),
    /** Session migration timeout (ms) */
    migrationTimeoutMs: DurationMs.default(30000),
  })
  .strict()
  .optional();

// =============================================================================
// Redis Schema
// =============================================================================

export const RedisSchema = z
  .object({
    /** Redis connection URL */
    url: z.string(),
    /** Redis password */
    password: z.string().optional(),
    /** Redis database number */
    db: z.number().int().min(0).max(15).default(0),
    /** Connection timeout (ms) */
    connectTimeoutMs: DurationMs.default(5000),
  })
  .strict()
  .optional();

// =============================================================================
// Database Schema
// =============================================================================

export const DatabaseSchema = z
  .object({
    /** Database connection URL */
    url: z.string(),
    /** Connection pool size */
    poolSize: PositiveInt.default(10),
    /** Connection timeout (ms) */
    connectTimeoutMs: DurationMs.default(5000),
  })
  .strict()
  .optional();

// =============================================================================
// Token Budget Schema
// =============================================================================

export const TokenBudgetSchema = z
  .object({
    /** Daily token limit */
    daily: PositiveInt.default(1_000_000),
    /** Weekly token limit */
    weekly: PositiveInt.default(5_000_000),
    /** Monthly token limit */
    monthly: PositiveInt.default(20_000_000),
    /** Budget alerts */
    alerts: z
      .object({
        enabled: z.boolean().default(true),
        /** Alert when usage exceeds this fraction of the budget */
        threshold: Percentage.default(0.8),
        /** Notification channels for alerts */
        channels: z.array(z.string()).default([]),
      })
      .default({}),
  })
  .refine(data => data.weekly >= data.daily, {
    message: 'Weekly budget must be >= daily budget',
    path: ['weekly'],
  })
  .refine(data => data.monthly >= data.weekly, {
    message: 'Monthly budget must be >= weekly budget',
    path: ['monthly'],
  });

// =============================================================================
// Neolith Integration Schema
// =============================================================================

export const NeolithSchema = z
  .object({
    /** Neolith API URL */
    apiUrl: z.string().optional(),
    /** API key */
    apiKey: z.string().optional(),
    /** API secret */
    apiSecret: z.string().optional(),
  })
  .strict()
  .optional();

// =============================================================================
// OpenAI Provider Schema (backward compat with existing config)
// =============================================================================

export const OpenAISchema = z
  .object({
    /** OpenAI API key (required) */
    apiKey: z.string().min(1, 'OPENAI_API_KEY is required'),
    /** Default model */
    model: z.string().default('gpt-4o-mini'),
    /** Organization ID */
    organization: z.string().optional(),
    /** Base URL override */
    baseUrl: z.string().optional(),
  })
  .strict();

export const AnthropicSchema = z
  .object({
    /** Anthropic API key */
    apiKey: z.string().optional(),
    /** Default model */
    model: z.string().default('claude-3-sonnet-20240229'),
  })
  .strict()
  .optional();

// =============================================================================
// Env Vars Schema
// =============================================================================

export const EnvVarsSchema = z
  .object({
    /** Environment variable key-value pairs to set at load time */
    vars: z.record(z.string()).optional(),
    /** Shell env fallback settings */
    shellEnv: z
      .object({
        enabled: z.boolean().default(false),
        timeoutMs: DurationMs.default(5000),
      })
      .optional(),
  })
  .optional();

// =============================================================================
// Includes Schema
// =============================================================================

export const IncludeSchema = z
  .union([z.string(), z.array(z.string())])
  .optional();

// =============================================================================
// Top-Level Config Schema
// =============================================================================

/**
 * The complete Wundr orchestrator daemon configuration schema.
 *
 * Supports both JSON5 file config and environment variable overrides.
 * All sections are optional with sensible defaults.
 */
export const WundrConfigSchema = z.object({
  /** Config file includes */
  $include: IncludeSchema,
  /** Config metadata */
  meta: MetaSchema,

  // --- Core ---
  daemon: DaemonSchema,
  openai: OpenAISchema,
  anthropic: AnthropicSchema,

  // --- Agents ---
  agents: AgentsSchema,

  // --- Memory ---
  memory: MemorySchema,

  // --- Security ---
  security: SecuritySchema,

  // --- Channels ---
  channels: ChannelsSchema,

  // --- Models ---
  models: ModelConfigSchema,

  // --- Plugins ---
  plugins: PluginsSchema,

  // --- Hooks ---
  hooks: HooksSchema,

  // --- Monitoring ---
  monitoring: MonitoringSchema,

  // --- Logging ---
  logging: LoggingSchema,

  // --- Distributed ---
  distributed: DistributedSchema,

  // --- Infrastructure ---
  redis: RedisSchema,
  database: DatabaseSchema,

  // --- Token Budget ---
  tokenBudget: TokenBudgetSchema.optional(),

  // --- Integrations ---
  neolith: NeolithSchema,

  // --- Environment ---
  env: EnvVarsSchema,

  // --- Global ---
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  debug: z.boolean().default(false),
});

export type WundrConfig = z.infer<typeof WundrConfigSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

export interface ConfigValidationIssue {
  path: string;
  message: string;
}

export interface ConfigValidationResult {
  ok: boolean;
  config: WundrConfig;
  issues: ConfigValidationIssue[];
  warnings: ConfigValidationIssue[];
}

/**
 * Validate a raw config object against the Wundr config schema.
 *
 * Returns a structured result with issues and warnings, never throws.
 */
export function validateConfig(raw: unknown): ConfigValidationResult {
  const result = WundrConfigSchema.safeParse(raw);

  if (result.success) {
    const warnings = collectWarnings(result.data);
    return {
      ok: true,
      config: result.data,
      issues: [],
      warnings,
    };
  }

  const issues: ConfigValidationIssue[] = result.error.errors.map(err => ({
    path: err.path.join('.') || '<root>',
    message: err.message,
  }));

  // Try to produce a partial config for diagnostics
  let partialConfig: WundrConfig;
  try {
    partialConfig = WundrConfigSchema.parse({
      ...(raw && typeof raw === 'object' ? raw : {}),
      openai: { apiKey: 'placeholder' },
    });
  } catch {
    partialConfig = WundrConfigSchema.parse({
      openai: { apiKey: 'placeholder' },
    });
  }

  return {
    ok: false,
    config: partialConfig,
    issues,
    warnings: [],
  };
}

/**
 * Collect non-fatal warnings for a valid config.
 */
function collectWarnings(config: WundrConfig): ConfigValidationIssue[] {
  const warnings: ConfigValidationIssue[] = [];

  // Warn about default JWT secret
  if (
    config.security.jwt.secret ===
    'change-this-in-production-to-a-random-secure-string'
  ) {
    warnings.push({
      path: 'security.jwt.secret',
      message: 'Using default JWT secret. Change this in production.',
    });
  }

  // Warn about verbose mode in production
  if (config.nodeEnv === 'production' && config.daemon.verbose) {
    warnings.push({
      path: 'daemon.verbose',
      message:
        'Verbose mode is enabled in production. This may impact performance.',
    });
  }

  // Warn about CORS in production
  if (
    config.nodeEnv === 'production' &&
    config.security.cors.enabled &&
    config.security.cors.origins.length === 0
  ) {
    warnings.push({
      path: 'security.cors.origins',
      message:
        'CORS is enabled with no explicit origins. All origins will be reflected.',
    });
  }

  // Warn about disabled rate limiting
  if (config.nodeEnv === 'production' && !config.security.rateLimit.enabled) {
    warnings.push({
      path: 'security.rateLimit.enabled',
      message: 'Rate limiting is disabled in production.',
    });
  }

  return warnings;
}

/**
 * Generate a default configuration object with all defaults applied.
 */
export function generateDefaultConfig(): WundrConfig {
  return WundrConfigSchema.parse({
    openai: { apiKey: '${OPENAI_API_KEY}' },
  });
}

/**
 * Current config schema version (for migration support).
 */
export const CURRENT_CONFIG_VERSION = 1;
