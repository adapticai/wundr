/**
 * JSON-RPC 2.0 Compatibility Layer
 *
 * Provides bidirectional translation between the Wundr protocol v2
 * native frame format and the JSON-RPC 2.0 specification
 * (https://www.jsonrpc.org/specification).
 *
 * This allows clients that speak standard JSON-RPC 2.0 to interact
 * with the daemon without modification, and enables interoperability
 * with JSON-RPC tooling (language server clients, etc.).
 *
 * JSON-RPC 2.0 mapping:
 *   - Request:   { jsonrpc: "2.0", id, method, params }
 *     -> native: { type: "req", id, method, params }
 *
 *   - Response:  { jsonrpc: "2.0", id, result }  (success)
 *                { jsonrpc: "2.0", id, error: { code, message, data } }  (failure)
 *     -> native: { type: "res", id, ok, payload, error }
 *
 *   - Notification: { jsonrpc: "2.0", method, params }  (no id)
 *     -> native: { type: "event", event: method, payload: params }
 *
 * Standard JSON-RPC 2.0 error codes:
 *   -32700  Parse error
 *   -32600  Invalid Request
 *   -32601  Method not found
 *   -32602  Invalid params
 *   -32603  Internal error
 *   -32000 to -32099  Server error (reserved)
 */

import { z } from 'zod';

import { ErrorCodes } from './protocol-v2';

import type { ErrorShape, EventFrame, RequestFrame, ResponseFrame } from './protocol-v2';

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 types
// ---------------------------------------------------------------------------

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

export interface JsonRpcSuccessResponse {
  jsonrpc: '2.0';
  id: string | number;
  result: unknown;
}

export interface JsonRpcErrorResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type JsonRpcMessage =
  | JsonRpcRequest
  | JsonRpcNotification
  | JsonRpcSuccessResponse
  | JsonRpcErrorResponse;

// ---------------------------------------------------------------------------
// Zod schemas for parsing
// ---------------------------------------------------------------------------

const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  method: z.string().min(1),
  params: z.unknown().optional(),
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const JsonRpcNotificationSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.string().min(1),
  params: z.unknown().optional(),
}).refine(
  (val) => !('id' in val),
  { message: 'notifications must not include an id field' },
);

// ---------------------------------------------------------------------------
// Error code mapping
// ---------------------------------------------------------------------------

/** Map Wundr error codes to JSON-RPC 2.0 numeric error codes. */
const ERROR_CODE_TO_JSONRPC: Record<string, number> = {
  [ErrorCodes.INVALID_REQUEST]: -32600,
  [ErrorCodes.NOT_FOUND]: -32601,
  [ErrorCodes.UNAUTHORIZED]: -32000,
  [ErrorCodes.FORBIDDEN]: -32001,
  [ErrorCodes.CONFLICT]: -32002,
  [ErrorCodes.RATE_LIMITED]: -32003,
  [ErrorCodes.INTERNAL]: -32603,
  [ErrorCodes.UNAVAILABLE]: -32004,
  [ErrorCodes.TIMEOUT]: -32005,
  [ErrorCodes.PROTOCOL_MISMATCH]: -32006,
};

/** Map JSON-RPC 2.0 numeric error codes to Wundr error codes. */
const JSONRPC_TO_ERROR_CODE: Record<number, string> = {
  [-32700]: ErrorCodes.INVALID_REQUEST,
  [-32600]: ErrorCodes.INVALID_REQUEST,
  [-32601]: ErrorCodes.NOT_FOUND,
  [-32602]: ErrorCodes.INVALID_REQUEST,
  [-32603]: ErrorCodes.INTERNAL,
  [-32000]: ErrorCodes.UNAUTHORIZED,
  [-32001]: ErrorCodes.FORBIDDEN,
  [-32002]: ErrorCodes.CONFLICT,
  [-32003]: ErrorCodes.RATE_LIMITED,
  [-32004]: ErrorCodes.UNAVAILABLE,
  [-32005]: ErrorCodes.TIMEOUT,
  [-32006]: ErrorCodes.PROTOCOL_MISMATCH,
};

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Detect whether a parsed JSON message is in JSON-RPC 2.0 format
 * (as opposed to native Wundr protocol v2 format).
 */
export function isJsonRpcMessage(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== 'object') {
    return false;
  }
  return (parsed as Record<string, unknown>).jsonrpc === '2.0';
}

/**
 * Detect whether a raw JSON string is a JSON-RPC 2.0 batch (array).
 */
export function isJsonRpcBatch(parsed: unknown): parsed is unknown[] {
  return Array.isArray(parsed);
}

// ---------------------------------------------------------------------------
// Inbound conversion (JSON-RPC 2.0 -> native)
// ---------------------------------------------------------------------------

export type InboundResult =
  | { type: 'request'; frame: RequestFrame }
  | { type: 'notification'; event: string; payload: unknown }
  | { type: 'error'; id: string | number | null; code: number; message: string };

/**
 * Convert a parsed JSON-RPC 2.0 message to a native protocol frame.
 */
export function jsonRpcToNative(parsed: unknown): InboundResult {
  if (!parsed || typeof parsed !== 'object') {
    return { type: 'error', id: null, code: -32600, message: 'invalid request object' };
  }

  const obj = parsed as Record<string, unknown>;

  // Check if it's a request (has id) or notification (no id)
  if ('id' in obj) {
    const result = JsonRpcRequestSchema.safeParse(obj);
    if (!result.success) {
      const id = 'id' in obj ? obj.id as string | number : null;
      return { type: 'error', id, code: -32600, message: 'invalid JSON-RPC request' };
    }

    const req = result.data;
    return {
      type: 'request',
      frame: {
        type: 'req',
        id: String(req.id),
        method: req.method,
        params: req.params,
      },
    };
  }

  // Notification (no id)
  if ('method' in obj && obj.jsonrpc === '2.0') {
    return {
      type: 'notification',
      event: String(obj.method),
      payload: obj.params,
    };
  }

  return { type: 'error', id: null, code: -32600, message: 'unrecognized JSON-RPC message' };
}

// ---------------------------------------------------------------------------
// Outbound conversion (native -> JSON-RPC 2.0)
// ---------------------------------------------------------------------------

/**
 * Convert a native ResponseFrame to a JSON-RPC 2.0 response.
 */
export function nativeResponseToJsonRpc(
  frame: ResponseFrame,
  originalId?: string | number,
): JsonRpcSuccessResponse | JsonRpcErrorResponse {
  const id = originalId ?? frame.id;

  if (frame.ok) {
    return {
      jsonrpc: '2.0',
      id,
      result: frame.payload ?? null,
    };
  }

  const error = frame.error;
  const code = error?.code
    ? (ERROR_CODE_TO_JSONRPC[error.code] ?? -32603)
    : -32603;

  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message: error?.message ?? 'unknown error',
      data: error?.details !== undefined ? error.details : {
        wundrCode: error?.code,
        retryable: error?.retryable,
        retryAfterMs: error?.retryAfterMs,
      },
    },
  };
}

/**
 * Convert a native EventFrame to a JSON-RPC 2.0 notification.
 */
export function nativeEventToJsonRpc(frame: EventFrame): JsonRpcNotification {
  return {
    jsonrpc: '2.0',
    method: frame.event,
    params: {
      payload: frame.payload,
      seq: frame.seq,
      subscriptionId: frame.subscriptionId,
    },
  };
}

/**
 * Build a JSON-RPC 2.0 error response for parse/protocol errors.
 */
export function jsonRpcErrorResponse(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcErrorResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: { code, message, data },
  };
}

// ---------------------------------------------------------------------------
// Error code utilities
// ---------------------------------------------------------------------------

/**
 * Convert a Wundr ErrorShape to a JSON-RPC 2.0 error code.
 */
export function wundrErrorToJsonRpcCode(error: ErrorShape): number {
  return ERROR_CODE_TO_JSONRPC[error.code] ?? -32603;
}

/**
 * Convert a JSON-RPC 2.0 numeric error code to a Wundr error code string.
 */
export function jsonRpcCodeToWundrError(code: number): string {
  return JSONRPC_TO_ERROR_CODE[code] ?? ErrorCodes.INTERNAL;
}
