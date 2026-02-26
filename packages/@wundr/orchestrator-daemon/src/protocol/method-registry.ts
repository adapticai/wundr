/**
 * Method Registry
 *
 * A discoverable catalog of all available RPC methods with their
 * metadata: parameter schemas (serialized as JSON Schema), required
 * scopes, descriptions, and streaming capabilities.
 *
 * Clients can call `rpc.discover` to receive the full method catalog,
 * or `rpc.describe` to get details about a specific method. This
 * supports runtime introspection, client code generation, and
 * documentation tooling.
 */

import { z } from 'zod';

import {
  METHOD_PARAM_SCHEMAS,
  METHOD_SCOPE_MAP,
  PROTOCOL_V2_EVENTS,
  PROTOCOL_V2_METHODS,
} from './protocol-v2';

import type { Scope } from './protocol-v2';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MethodDescriptor {
  /** The fully-qualified method name (e.g. "session.create"). */
  name: string;
  /** Human-readable description. */
  description: string;
  /** The domain this method belongs to (e.g. "session", "prompt"). */
  domain: string;
  /** Scopes required to call this method. */
  requiredScopes: Scope[];
  /** Whether this method supports streaming responses. */
  streaming: boolean;
  /** Whether this method is idempotent (safe to retry). */
  idempotent: boolean;
  /** JSON Schema for the method's params (derived from Zod). */
  paramsSchema: Record<string, unknown> | null;
  /** Optional deprecation notice. */
  deprecated?: string;
  /** Optional since-version. */
  since?: string;
}

export interface EventDescriptor {
  /** The event name (e.g. "stream.chunk"). */
  name: string;
  /** Human-readable description. */
  description: string;
  /** The domain this event belongs to. */
  domain: string;
  /** Whether clients must subscribe to receive this event. */
  requiresSubscription: boolean;
}

export interface DiscoveryResult {
  /** Protocol version. */
  protocolVersion: number;
  /** All available methods. */
  methods: MethodDescriptor[];
  /** All available events. */
  events: EventDescriptor[];
}

// ---------------------------------------------------------------------------
// Zod-to-JSON-Schema conversion (lightweight, no external deps)
// ---------------------------------------------------------------------------

/**
 * Convert a Zod schema to a simplified JSON Schema representation.
 *
 * This is a best-effort conversion covering common Zod types. It does
 * not attempt full JSON Schema compliance -- just enough for client
 * introspection and documentation.
 */
function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodType>;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value);
      if (
        !(value instanceof z.ZodOptional) &&
        !(value instanceof z.ZodDefault)
      ) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }

  if (schema instanceof z.ZodString) {
    return { type: 'string' };
  }

  if (schema instanceof z.ZodNumber) {
    return { type: 'number' };
  }

  if (schema instanceof z.ZodBoolean) {
    return { type: 'boolean' };
  }

  if (schema instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodToJsonSchema((schema as z.ZodArray<z.ZodType>).element),
    };
  }

  if (schema instanceof z.ZodEnum) {
    return {
      type: 'string',
      enum: (schema as z.ZodEnum<[string, ...string[]]>).options,
    };
  }

  if (schema instanceof z.ZodLiteral) {
    return { const: (schema as z.ZodLiteral<unknown>).value };
  }

  if (schema instanceof z.ZodOptional) {
    return zodToJsonSchema((schema as z.ZodOptional<z.ZodType>).unwrap());
  }

  if (schema instanceof z.ZodDefault) {
    const inner = zodToJsonSchema(
      (schema as z.ZodDefault<z.ZodType>).removeDefault()
    );
    return { ...inner, default: (schema as any)._def.defaultValue() };
  }

  if (schema instanceof z.ZodRecord) {
    return {
      type: 'object',
      additionalProperties: true,
    };
  }

  if (
    schema instanceof z.ZodUnion ||
    schema instanceof z.ZodDiscriminatedUnion
  ) {
    const options = (schema as any)._def.options as z.ZodType[];
    return {
      oneOf: options.map(zodToJsonSchema),
    };
  }

  if (schema instanceof z.ZodNullable) {
    const inner = zodToJsonSchema(
      (schema as z.ZodNullable<z.ZodType>).unwrap()
    );
    return { ...inner, nullable: true };
  }

  // Fallback
  return {};
}

// ---------------------------------------------------------------------------
// Method descriptions (hand-curated for quality documentation)
// ---------------------------------------------------------------------------

const METHOD_DESCRIPTIONS: Record<string, string> = {
  'auth.connect':
    'Authenticate and establish a protocol session. Must be the first request on a new connection.',
  'auth.refresh':
    'Refresh an expiring authentication token without reconnecting.',
  'auth.logout': 'Gracefully log out and close the connection.',
  'session.create':
    'Create a new orchestrator session for agent task execution.',
  'session.resume': 'Resume an existing paused or disconnected session.',
  'session.stop':
    'Stop a running session. Use force=true to terminate immediately.',
  'session.list':
    'List sessions with optional status filtering and pagination.',
  'session.status': 'Get the current status of a specific session.',
  'prompt.submit':
    'Submit a prompt to a session. Supports streaming responses when stream=true.',
  'prompt.cancel': 'Cancel an in-flight prompt in a session.',
  'tool.approve': 'Approve a pending tool execution request.',
  'tool.deny': 'Deny a pending tool execution request.',
  'agent.spawn':
    'Spawn a new agent, optionally as a child of an existing session.',
  'agent.status': 'Get the current status and metrics for an agent.',
  'agent.stop': 'Stop a running agent.',
  'team.create': 'Create a new agent team with a coordination strategy.',
  'team.status': 'Get the current status of a team and its member agents.',
  'team.message': 'Send a message between team members.',
  'team.dissolve': 'Dissolve a team and stop all its agents.',
  'memory.query': 'Query the memory subsystem with semantic search.',
  'memory.store': 'Store a new memory entry in the specified tier.',
  'memory.delete': 'Delete a memory entry by ID.',
  'config.get': 'Read configuration values.',
  'config.set': 'Update configuration values (requires admin scope).',
  'health.ping': 'Ping the server to measure round-trip latency.',
  'health.status': 'Get detailed server health status and metrics.',
  subscribe: 'Subscribe to server events by name pattern.',
  unsubscribe: 'Remove an active subscription.',
  'rpc.discover': 'List all available methods and events with their metadata.',
  'rpc.describe': 'Get detailed information about a specific method.',
};

const METHOD_STREAMING: Set<string> = new Set(['prompt.submit']);

const METHOD_IDEMPOTENT: Set<string> = new Set([
  'session.list',
  'session.status',
  'health.ping',
  'health.status',
  'config.get',
  'memory.query',
  'agent.status',
  'team.status',
  'rpc.discover',
  'rpc.describe',
]);

// ---------------------------------------------------------------------------
// Event descriptions
// ---------------------------------------------------------------------------

const EVENT_DESCRIPTIONS: Record<string, string> = {
  'stream.start': 'A streaming response has begun for a prompt submission.',
  'stream.chunk': 'An incremental chunk of streaming response data.',
  'stream.end': 'A streaming response has completed successfully.',
  'stream.error': 'A streaming response encountered an error.',
  'stream.progress': 'Progressive results for a streaming RPC method.',
  'tool.request': 'A tool execution requires approval from the client.',
  'tool.result': 'A tool execution has completed.',
  'tool.status': 'A tool execution status update (progress indicator).',
  'agent.status': 'An agent status has changed.',
  'agent.spawned': 'A new agent has been created.',
  'agent.stopped': 'An agent has been stopped.',
  'team.status': 'A team status has changed.',
  'team.message': 'A message was sent within a team.',
  'team.dissolved': 'A team has been dissolved.',
  'health.heartbeat': 'Periodic server heartbeat.',
  'session.status': 'A session status has changed.',
  'session.created': 'A new session has been created.',
  'session.stopped': 'A session has been stopped.',
};

const BROADCAST_EVENTS: Set<string> = new Set(['health.heartbeat']);

// ---------------------------------------------------------------------------
// MethodRegistry
// ---------------------------------------------------------------------------

export class MethodRegistry {
  private extraMethods = new Map<string, MethodDescriptor>();
  private extraEvents = new Map<string, EventDescriptor>();

  /**
   * Get the descriptor for a method.
   */
  describeMethod(method: string): MethodDescriptor | null {
    // Check extra methods first
    const extra = this.extraMethods.get(method);
    if (extra) {
      return extra;
    }

    // Check built-in methods
    if (
      !(PROTOCOL_V2_METHODS as readonly string[]).includes(method) &&
      method !== 'rpc.discover' &&
      method !== 'rpc.describe'
    ) {
      return null;
    }

    return this.buildMethodDescriptor(method);
  }

  /**
   * Get the full discovery result.
   */
  discover(protocolVersion: number): DiscoveryResult {
    const methods: MethodDescriptor[] = [];

    // Built-in methods
    for (const method of PROTOCOL_V2_METHODS) {
      methods.push(this.buildMethodDescriptor(method));
    }

    // Discovery methods themselves
    methods.push(this.buildMethodDescriptor('rpc.discover'));
    methods.push(this.buildMethodDescriptor('rpc.describe'));

    // Extra methods
    for (const [, descriptor] of this.extraMethods) {
      methods.push(descriptor);
    }

    const events: EventDescriptor[] = [];

    // Built-in events
    for (const event of PROTOCOL_V2_EVENTS) {
      events.push(this.buildEventDescriptor(event));
    }

    // stream.progress (added by streaming-response module)
    events.push(this.buildEventDescriptor('stream.progress'));

    // Extra events
    for (const [, descriptor] of this.extraEvents) {
      events.push(descriptor);
    }

    return { protocolVersion, methods, events };
  }

  /**
   * Register an additional method descriptor (for plugins/extensions).
   */
  registerMethod(descriptor: MethodDescriptor): void {
    this.extraMethods.set(descriptor.name, descriptor);
  }

  /**
   * Register an additional event descriptor.
   */
  registerEvent(descriptor: EventDescriptor): void {
    this.extraEvents.set(descriptor.name, descriptor);
  }

  /**
   * Remove a registered method.
   */
  removeMethod(name: string): boolean {
    return this.extraMethods.delete(name);
  }

  // -----------------------------------------------------------------------
  // Private builders
  // -----------------------------------------------------------------------

  private buildMethodDescriptor(method: string): MethodDescriptor {
    const domain = method.includes('.') ? method.split('.')[0] : method;
    const scopes = METHOD_SCOPE_MAP[method] ?? [];
    const paramsSchemaZod = METHOD_PARAM_SCHEMAS[method];

    let paramsSchema: Record<string, unknown> | null = null;
    if (paramsSchemaZod) {
      try {
        paramsSchema = zodToJsonSchema(paramsSchemaZod as z.ZodType);
      } catch {
        paramsSchema = null;
      }
    }

    return {
      name: method,
      description:
        METHOD_DESCRIPTIONS[method] ?? `Invoke the ${method} RPC method.`,
      domain,
      requiredScopes: scopes,
      streaming: METHOD_STREAMING.has(method),
      idempotent: METHOD_IDEMPOTENT.has(method),
      paramsSchema,
    };
  }

  private buildEventDescriptor(event: string): EventDescriptor {
    const domain = event.includes('.') ? event.split('.')[0] : event;

    return {
      name: event,
      description: EVENT_DESCRIPTIONS[event] ?? `The ${event} server event.`,
      domain,
      requiresSubscription: !BROADCAST_EVENTS.has(event),
    };
  }
}

// ---------------------------------------------------------------------------
// Zod schemas for the discovery RPC params/results
// ---------------------------------------------------------------------------

export const RpcDiscoverParamsSchema = z
  .object({
    /** If true, include JSON Schema for each method's params. Default: true. */
    includeSchemas: z.boolean().default(true),
  })
  .optional();

export type RpcDiscoverParams = z.infer<typeof RpcDiscoverParamsSchema>;

export const RpcDescribeParamsSchema = z.object({
  method: z.string().min(1),
});

export type RpcDescribeParams = z.infer<typeof RpcDescribeParamsSchema>;
