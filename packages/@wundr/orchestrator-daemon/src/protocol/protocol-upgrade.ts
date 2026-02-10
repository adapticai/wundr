/**
 * Protocol Upgrade (v1 -> v2)
 *
 * Provides a graceful migration path for clients still using the v1
 * protocol format.  The v1 format used a simpler message structure:
 *
 *   v1 Request:  { action: string, data?: object, requestId?: string }
 *   v1 Response: { action: string, data?: object, requestId?: string, error?: string }
 *   v1 Event:    { action: string, data?: object }
 *
 * This module translates v1 messages to v2 frames and vice versa,
 * allowing mixed-version deployments during migration.
 *
 * The upgrade flow:
 *   1. Client connects without `auth.connect` (v1 behavior).
 *   2. Server detects the first message is in v1 format.
 *   3. Server wraps the connection in a V1Adapter that translates
 *      messages bidirectionally.
 *   4. All internal routing uses v2 frames.
 */

import { randomUUID } from 'node:crypto';


import type { EventFrame, RequestFrame, ResponseFrame } from './protocol-v2';

// ---------------------------------------------------------------------------
// V1 message types
// ---------------------------------------------------------------------------

export interface V1Request {
  action: string;
  data?: Record<string, unknown>;
  requestId?: string;
}

export interface V1Response {
  action: string;
  data?: Record<string, unknown>;
  requestId?: string;
  error?: string;
  success?: boolean;
}

export interface V1Event {
  action: string;
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Heuristic to detect v1 message format.
 *
 * A v1 message has an `action` field and no `type` field. A v2 frame
 * has a `type` field with one of "req", "res", "event".
 */
export function isV1Message(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== 'object') {
    return false;
  }
  const obj = parsed as Record<string, unknown>;
  return (
    typeof obj.action === 'string' &&
    obj.action.length > 0 &&
    !('type' in obj)
  );
}

/**
 * Detect whether a message is JSON-RPC 2.0 format.
 */
export function isJsonRpc2(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== 'object') {
    return false;
  }
  return (parsed as Record<string, unknown>).jsonrpc === '2.0';
}

/**
 * Detect whether a message is native v2 format.
 */
export function isNativeV2(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== 'object') {
    return false;
  }
  const type = (parsed as Record<string, unknown>).type;
  return type === 'req' || type === 'res' || type === 'event';
}

// ---------------------------------------------------------------------------
// V1 method mapping
// ---------------------------------------------------------------------------

/**
 * Maps v1 action names to v2 method names.
 *
 * V1 used flat action names like "createSession"; v2 uses dotted
 * domain.verb names like "session.create".
 */
const V1_TO_V2_METHOD: Record<string, string> = {
  // Session
  'createSession': 'session.create',
  'resumeSession': 'session.resume',
  'stopSession': 'session.stop',
  'listSessions': 'session.list',
  'sessionStatus': 'session.status',
  'getSessionStatus': 'session.status',

  // Prompt
  'submitPrompt': 'prompt.submit',
  'cancelPrompt': 'prompt.cancel',

  // Tool
  'approveTool': 'tool.approve',
  'denyTool': 'tool.deny',

  // Agent
  'spawnAgent': 'agent.spawn',
  'agentStatus': 'agent.status',
  'getAgentStatus': 'agent.status',
  'stopAgent': 'agent.stop',

  // Team
  'createTeam': 'team.create',
  'teamStatus': 'team.status',
  'getTeamStatus': 'team.status',
  'teamMessage': 'team.message',
  'dissolveTeam': 'team.dissolve',

  // Memory
  'queryMemory': 'memory.query',
  'storeMemory': 'memory.store',
  'deleteMemory': 'memory.delete',

  // Config
  'getConfig': 'config.get',
  'setConfig': 'config.set',

  // Health
  'ping': 'health.ping',
  'healthStatus': 'health.status',
  'getHealthStatus': 'health.status',

  // Auth
  'connect': 'auth.connect',
  'refresh': 'auth.refresh',
  'logout': 'auth.logout',

  // Subscriptions
  'subscribe': 'subscribe',
  'unsubscribe': 'unsubscribe',
};

const V2_TO_V1_METHOD: Record<string, string> = {};
for (const [v1, v2] of Object.entries(V1_TO_V2_METHOD)) {
  // Use first mapping for reverse
  if (!V2_TO_V1_METHOD[v2]) {
    V2_TO_V1_METHOD[v2] = v1;
  }
}

/**
 * Maps v2 event names to v1 action names.
 */
const V2_EVENT_TO_V1_ACTION: Record<string, string> = {
  'stream.start': 'streamStart',
  'stream.chunk': 'streamChunk',
  'stream.end': 'streamEnd',
  'stream.error': 'streamError',
  'tool.request': 'toolRequest',
  'tool.result': 'toolResult',
  'tool.status': 'toolStatus',
  'agent.status': 'agentStatus',
  'agent.spawned': 'agentSpawned',
  'agent.stopped': 'agentStopped',
  'team.status': 'teamStatus',
  'team.message': 'teamMessage',
  'team.dissolved': 'teamDissolved',
  'health.heartbeat': 'heartbeat',
  'session.status': 'sessionStatus',
  'session.created': 'sessionCreated',
  'session.stopped': 'sessionStopped',
};

// ---------------------------------------------------------------------------
// Conversion: v1 -> v2
// ---------------------------------------------------------------------------

/**
 * Convert a v1 request to a v2 RequestFrame.
 */
export function v1RequestToV2(v1: V1Request): RequestFrame {
  const method = V1_TO_V2_METHOD[v1.action] ?? v1.action;
  const id = v1.requestId ?? `v1_${randomUUID()}`;

  return {
    type: 'req',
    id,
    method,
    params: v1.data,
  };
}

// ---------------------------------------------------------------------------
// Conversion: v2 -> v1
// ---------------------------------------------------------------------------

/**
 * Convert a v2 ResponseFrame to a v1 response.
 */
export function v2ResponseToV1(frame: ResponseFrame, originalAction?: string): V1Response {
  const action = originalAction ?? V2_TO_V1_METHOD[frame.id] ?? 'response';

  if (frame.ok) {
    return {
      action,
      requestId: frame.id,
      success: true,
      data: frame.payload as Record<string, unknown> | undefined,
    };
  }

  return {
    action,
    requestId: frame.id,
    success: false,
    error: frame.error?.message ?? 'unknown error',
    data: frame.error?.details as Record<string, unknown> | undefined,
  };
}

/**
 * Convert a v2 EventFrame to a v1 event.
 */
export function v2EventToV1(frame: EventFrame): V1Event {
  const action = V2_EVENT_TO_V1_ACTION[frame.event] ?? frame.event;

  return {
    action,
    data: frame.payload as Record<string, unknown> | undefined,
  };
}

// ---------------------------------------------------------------------------
// V1Adapter
// ---------------------------------------------------------------------------

/**
 * Wraps a transport connection to transparently translate between
 * v1 and v2 message formats.
 */
export class V1Adapter {
  /** Track original v1 actions for response translation. */
  private pendingActions = new Map<string, string>();

  /**
   * Parse and convert an inbound v1 JSON message to a v2 RequestFrame.
   *
   * @returns The converted RequestFrame, or null if the message is not valid v1.
   */
  inbound(data: string): RequestFrame | null {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      return null;
    }

    if (!isV1Message(parsed)) {
      return null;
    }

    const v1 = parsed as V1Request;
    const frame = v1RequestToV2(v1);

    // Store original action for response translation
    this.pendingActions.set(frame.id, v1.action);

    return frame;
  }

  /**
   * Convert an outbound v2 ResponseFrame to a v1 response string.
   */
  outboundResponse(frame: ResponseFrame): string {
    const originalAction = this.pendingActions.get(frame.id);
    if (originalAction) {
      this.pendingActions.delete(frame.id);
    }

    const v1 = v2ResponseToV1(frame, originalAction);
    return JSON.stringify(v1);
  }

  /**
   * Convert an outbound v2 EventFrame to a v1 event string.
   */
  outboundEvent(frame: EventFrame): string {
    const v1 = v2EventToV1(frame);
    return JSON.stringify(v1);
  }

  /**
   * Number of pending request-response correlations.
   */
  get pendingCount(): number {
    return this.pendingActions.size;
  }

  /**
   * Clear all pending state (on disconnect).
   */
  clear(): void {
    this.pendingActions.clear();
  }
}

// ---------------------------------------------------------------------------
// Auto-detect and convert
// ---------------------------------------------------------------------------

export type DetectedFormat = 'v1' | 'v2' | 'jsonrpc2' | 'unknown';

/**
 * Detect the format of a parsed JSON message.
 */
export function detectFormat(parsed: unknown): DetectedFormat {
  if (isV1Message(parsed)) {
return 'v1';
}
  if (isNativeV2(parsed)) {
return 'v2';
}
  if (isJsonRpc2(parsed)) {
return 'jsonrpc2';
}
  return 'unknown';
}
