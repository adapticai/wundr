/**
 * RPC Handler
 *
 * Routes validated JSON-RPC requests to their domain handlers, enforces
 * scope-based authorization, validates params against the method's Zod
 * schema, and produces structured responses.
 *
 * Modeled after OpenClaw's `handleGatewayRequest` + `authorizeGatewayMethod`
 * but adapted for Wundr's domain methods and Zod-based validation.
 */

import { ZodError, type ZodType } from 'zod';

import type { SubscriptionManager } from './subscription-manager';
import {
  type ErrorShape,
  ErrorCodes,
  type ProtocolMethod,
  type RequestFrame,
  type ResponseFrame,
  type Scope,
  METHOD_PARAM_SCHEMAS,
  METHOD_SCOPE_MAP,
  PROTOCOL_V2_METHODS,
  errorShape,
  hasRequiredScopes,
} from './protocol-v2';

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

export class RpcHandler {
  private handlers: MethodHandlerMap = {};

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
   * Process an incoming request frame.
   *
   * Steps:
   *   1. Verify the method is known.
   *   2. Check scope authorization.
   *   3. Validate params with the method's Zod schema.
   *   4. Invoke the handler.
   *   5. Catch and format any errors.
   *
   * The result is delivered via `context.respond(...)`.
   */
  async handleRequest(
    request: RequestFrame,
    context: HandlerContext,
  ): Promise<void> {
    const { method, params } = request;

    // 1. Check that the method exists in the protocol
    if (!isKnownMethod(method)) {
      context.respond(false, undefined, errorShape(
        ErrorCodes.INVALID_REQUEST,
        `unknown method: ${method}`,
      ));
      return;
    }

    // 2. Authorize
    const requiredScopes = METHOD_SCOPE_MAP[method] ?? [];
    if (!hasRequiredScopes(context.scopes, requiredScopes)) {
      context.respond(false, undefined, errorShape(
        ErrorCodes.FORBIDDEN,
        `insufficient scope for ${method}; requires one of: ${requiredScopes.join(', ')}`,
      ));
      return;
    }

    // 3. Validate params
    const schema = METHOD_PARAM_SCHEMAS[method] as ZodType | undefined;
    let validatedParams: unknown = params;

    if (schema) {
      const result = schema.safeParse(params ?? {});
      if (!result.success) {
        context.respond(false, undefined, errorShape(
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
      context.respond(false, undefined, errorShape(
        ErrorCodes.UNAVAILABLE,
        `no handler registered for ${method}`,
      ));
      return;
    }

    try {
      await handler(validatedParams, context);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.respond(false, undefined, errorShape(
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
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isKnownMethod(method: string): method is ProtocolMethod {
  return (PROTOCOL_V2_METHODS as readonly string[]).includes(method);
}

// ---------------------------------------------------------------------------
// Built-in handlers for subscription and health methods
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
