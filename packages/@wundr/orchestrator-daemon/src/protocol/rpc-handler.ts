/**
 * RPC Handler
 *
 * Routes validated JSON-RPC requests to their domain handlers, enforces
 * scope-based authorization, validates params against the method's Zod
 * schema, and produces structured responses.
 *
 * Modeled after OpenClaw's `handleGatewayRequest` + `authorizeGatewayMethod`
 * but adapted for Wundr's domain methods and Zod-based validation.
 *
 * Enhanced with:
 *   - Rate limiting (token-bucket per connection)
 *   - Method discovery (rpc.discover / rpc.describe)
 *   - Streaming response context fields
 */


import { RpcDescribeParamsSchema } from './method-registry';
import {
  type ErrorShape,
  type EventFrame,
  ErrorCodes,
  type ProtocolMethod,
  PROTOCOL_VERSION,
  type RequestFrame,
  type ResponseFrame,
  type Scope,
  METHOD_PARAM_SCHEMAS,
  METHOD_SCOPE_MAP,
  PROTOCOL_V2_METHODS,
  errorShape,
  hasRequiredScopes,
} from './protocol-v2';

import type { MethodRegistry } from './method-registry';
import type { RateLimiter } from './rate-limiter';
import type { SubscriptionManager } from './subscription-manager';
import type { ZodError, ZodType } from 'zod';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Contextual information available to every method handler. */
export interface HandlerContext {
  /** The authenticated connection ID. */
  connectionId: string;
  /** Granted scopes for this connection. */
  scopes: Scope[];
  /** Client metadata from the auth.connect handshake. */
  client: {
    id: string;
    version: string;
    platform: string;
    displayName?: string;
  };
  /** Reference to the subscription manager for event operations. */
  subscriptions: SubscriptionManager;
  /** Respond helper -- sends the final Response frame. */
  respond: (ok: boolean, payload?: unknown, error?: ErrorShape) => void;
  /** Send an event frame to this connection (for streaming). */
  sendEvent?: (frame: EventFrame) => void;
  /** Send a response frame to this connection (for streaming). */
  sendResponse?: (frame: ResponseFrame) => void;
  /** Whether the underlying transport is open. */
  isOpen?: () => boolean;
  /** The request ID (also available on the request frame itself). */
  requestId?: string;
}

/** Signature for a single method handler. */
export type MethodHandler = (
  params: unknown,
  context: HandlerContext,
) => void | Promise<void>;

/** A registry of method handlers keyed by method name. */
export type MethodHandlerMap = Partial<Record<string, MethodHandler>>;

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}

// ---------------------------------------------------------------------------
// RPC Handler
// ---------------------------------------------------------------------------

/** Metrics collected per-request for monitoring. */
export interface RequestMetrics {
  method: string;
  connectionId: string;
  requestId: string;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  ok: boolean;
  errorCode?: string;
}

/** Options for the RPC handler. */
export interface RpcHandlerOptions {
  /** Maximum time a handler may run before timing out (ms). Default: 30000. */
  requestTimeoutMs?: number;
  /** Callback invoked with metrics after each request completes. */
  onRequestComplete?: (metrics: RequestMetrics) => void;
  /** Optional rate limiter for per-connection throttling. */
  rateLimiter?: RateLimiter;
  /** Optional method registry for rpc.discover and rpc.describe. */
  methodRegistry?: MethodRegistry;
}

export class RpcHandler {
  private handlers: MethodHandlerMap = {};
  private requestTimeoutMs: number;
  private onRequestComplete?: (metrics: RequestMetrics) => void;
  private rateLimiter?: RateLimiter;
  private methodRegistry?: MethodRegistry;
  private pendingRequests = new Map<string, { timer: ReturnType<typeof setTimeout>; method: string }>();

  constructor(options?: RpcHandlerOptions) {
    this.requestTimeoutMs = options?.requestTimeoutMs ?? 30_000;
    this.onRequestComplete = options?.onRequestComplete;
    this.rateLimiter = options?.rateLimiter;
    this.methodRegistry = options?.methodRegistry;
  }

  /** Set or replace the rate limiter. */
  setRateLimiter(limiter: RateLimiter): void {
    this.rateLimiter = limiter;
  }

  /** Set or replace the method registry. */
  setMethodRegistry(registry: MethodRegistry): void {
    this.methodRegistry = registry;
  }

  /**
   * Register a batch of method handlers.  Overwrites any existing handler
   * for the same method name.
   */
  registerHandlers(handlers: MethodHandlerMap): void {
    for (const [method, handler] of Object.entries(handlers)) {
      if (handler) {
        this.handlers[method] = handler;
      }
    }
  }

  /**
   * Register a single method handler.
   */
  registerHandler(method: string, handler: MethodHandler): void {
    this.handlers[method] = handler;
  }

  /**
   * Remove a registered handler.
   */
  removeHandler(method: string): boolean {
    if (this.handlers[method]) {
      delete this.handlers[method];
      return true;
    }
    return false;
  }

  /**
   * Check whether a handler is registered for the given method.
   */
  hasHandler(method: string): boolean {
    return method in this.handlers;
  }

  /**
   * Process an incoming request frame.
   *
   * Steps:
   *   1. Verify the method is known.
   *   2. Check scope authorization.
   *   2.5. Rate limit check.
   *   3. Validate params with the method's Zod schema.
   *   4. Invoke the handler (with timeout enforcement).
   *   5. Catch and format any errors.
   *
   * The result is delivered via `context.respond(...)`.
   */
  async handleRequest(
    request: RequestFrame,
    context: HandlerContext,
  ): Promise<void> {
    const { method, params, id: requestId } = request;
    const startedAt = Date.now();

    // Wrap the respond function to collect metrics
    const originalRespond = context.respond;
    let responded = false;

    const respondWithMetrics = (ok: boolean, payload?: unknown, error?: ErrorShape) => {
      if (responded) {
return;
}
      responded = true;

      // Clear the timeout timer for this request
      const pending = this.pendingRequests.get(requestId);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(requestId);
      }

      originalRespond(ok, payload, error);

      // Emit metrics
      if (this.onRequestComplete) {
        const completedAt = Date.now();
        this.onRequestComplete({
          method,
          connectionId: context.connectionId,
          requestId,
          startedAt,
          completedAt,
          durationMs: completedAt - startedAt,
          ok,
          errorCode: error?.code,
        });
      }
    };

    const metricsContext: HandlerContext = {
      ...context,
      respond: respondWithMetrics,
      requestId,
    };

    // 1. Check that the method exists in the protocol
    if (!isKnownMethod(method)) {
      respondWithMetrics(false, undefined, errorShape(
        ErrorCodes.INVALID_REQUEST,
        `unknown method: ${method}`,
      ));
      return;
    }

    // 2. Authorize
    const requiredScopes = METHOD_SCOPE_MAP[method] ?? [];
    if (!hasRequiredScopes(context.scopes, requiredScopes)) {
      respondWithMetrics(false, undefined, errorShape(
        ErrorCodes.FORBIDDEN,
        `insufficient scope for ${method}; requires one of: ${requiredScopes.join(', ')}`,
      ));
      return;
    }

    // 2.5. Rate limit check
    if (this.rateLimiter) {
      const rlResult = this.rateLimiter.consume(context.connectionId, method);
      if (!rlResult.allowed) {
        respondWithMetrics(false, undefined, errorShape(
          ErrorCodes.RATE_LIMITED,
          `rate limit exceeded for ${method}`,
          {
            retryable: true,
            retryAfterMs: rlResult.retryAfterMs,
            details: { remaining: rlResult.remaining },
          },
        ));
        return;
      }
    }

    // 3. Validate params
    const schema = METHOD_PARAM_SCHEMAS[method] as ZodType | undefined;
    let validatedParams: unknown = params;

    if (schema) {
      const result = schema.safeParse(params ?? {});
      if (!result.success) {
        respondWithMetrics(false, undefined, errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid params for ${method}: ${formatZodError(result.error)}`,
        ));
        return;
      }
      validatedParams = result.data;
    }

    // 4. Find and invoke handler
    const handler = this.handlers[method];
    if (!handler) {
      respondWithMetrics(false, undefined, errorShape(
        ErrorCodes.UNAVAILABLE,
        `no handler registered for ${method}`,
      ));
      return;
    }

    // Set up request timeout
    const timer = setTimeout(() => {
      if (!responded) {
        respondWithMetrics(false, undefined, errorShape(
          ErrorCodes.TIMEOUT,
          `request timed out after ${this.requestTimeoutMs}ms`,
          { retryable: true },
        ));
      }
    }, this.requestTimeoutMs);

    this.pendingRequests.set(requestId, { timer, method });

    try {
      await handler(validatedParams, metricsContext);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      respondWithMetrics(false, undefined, errorShape(
        ErrorCodes.INTERNAL,
        `handler error: ${message}`,
      ));
    }
  }

  /**
   * Build a respond function that sends a ResponseFrame via the provided
   * send callback, correlating to the original request ID.
   */
  static createResponder(
    requestId: string,
    send: (frame: ResponseFrame) => void,
  ): (ok: boolean, payload?: unknown, error?: ErrorShape) => void {
    let responded = false;

    return (ok: boolean, payload?: unknown, error?: ErrorShape) => {
      if (responded) {
        return; // Guard against double-respond
      }
      responded = true;

      send({
        type: 'res',
        id: requestId,
        ok,
        payload,
        error,
      });
    };
  }

  /**
   * Return the list of methods that have registered handlers.
   */
  get registeredMethods(): string[] {
    return Object.keys(this.handlers);
  }

  /**
   * Number of currently in-flight requests awaiting a response.
   */
  get pendingRequestCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Cancel all pending request timeouts.  Called during shutdown.
   */
  cancelAllPending(): void {
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
    }
    this.pendingRequests.clear();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isKnownMethod(method: string): method is ProtocolMethod {
  return (PROTOCOL_V2_METHODS as readonly string[]).includes(method);
}

// ---------------------------------------------------------------------------
// Built-in handlers for subscription, health, and discovery methods
// ---------------------------------------------------------------------------

/**
 * Creates method handlers for the subscription RPC methods
 * (`subscribe` and `unsubscribe`).  These are intrinsic to the
 * protocol and always registered.
 */
export function createSubscriptionHandlers(
  subscriptions: SubscriptionManager,
): MethodHandlerMap {
  return {
    'subscribe': (params: unknown, ctx: HandlerContext) => {
      const p = params as { events: string[]; filter?: Record<string, unknown> };
      const sub = subscriptions.subscribe(ctx.connectionId, p.events, p.filter);
      ctx.respond(true, {
        subscriptionId: sub.id,
        events: sub.patterns,
      });
    },

    'unsubscribe': (params: unknown, ctx: HandlerContext) => {
      const p = params as { subscriptionId: string };
      const removed = subscriptions.unsubscribe(p.subscriptionId);
      if (!removed) {
        ctx.respond(false, undefined, errorShape(
          ErrorCodes.NOT_FOUND,
          `subscription not found: ${p.subscriptionId}`,
        ));
        return;
      }
      ctx.respond(true, { ok: true });
    },
  };
}

/**
 * Creates the health.ping handler.  health.status is typically
 * supplied by the daemon's monitoring subsystem.
 */
export function createHealthPingHandler(): MethodHandlerMap {
  return {
    'health.ping': (params: unknown, ctx: HandlerContext) => {
      const p = params as { clientTimestamp?: number } | undefined;
      ctx.respond(true, {
        serverTimestamp: Date.now(),
        clientTimestamp: p?.clientTimestamp,
      });
    },
  };
}

/**
 * Creates method handlers for RPC discovery
 * (`rpc.discover` and `rpc.describe`).
 */
export function createDiscoveryHandlers(
  registry: MethodRegistry,
): MethodHandlerMap {
  return {
    'rpc.discover': (_params: unknown, ctx: HandlerContext) => {
      const result = registry.discover(PROTOCOL_VERSION);
      ctx.respond(true, result);
    },

    'rpc.describe': (params: unknown, ctx: HandlerContext) => {
      const parsed = RpcDescribeParamsSchema.safeParse(params);
      if (!parsed.success) {
        ctx.respond(false, undefined, errorShape(
          ErrorCodes.INVALID_REQUEST,
          'invalid params: method field is required',
        ));
        return;
      }

      const descriptor = registry.describeMethod(parsed.data.method);
      if (!descriptor) {
        ctx.respond(false, undefined, errorShape(
          ErrorCodes.NOT_FOUND,
          `method not found: ${parsed.data.method}`,
        ));
        return;
      }

      ctx.respond(true, descriptor);
    },
  };
}
