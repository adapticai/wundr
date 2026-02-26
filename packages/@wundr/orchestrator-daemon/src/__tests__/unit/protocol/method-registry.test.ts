/**
 * Tests for the MethodRegistry class (src/protocol/method-registry.ts),
 * JSON-RPC 2.0 compatibility layer (src/protocol/jsonrpc-compat.ts),
 * and protocol upgrade (src/protocol/protocol-upgrade.ts).
 *
 * Covers:
 *  - Method registration and lookup via describeMethod()
 *  - Full discoverable catalog generation via discover()
 *  - Extra method / event registration (plugins)
 *  - JSON-RPC 2.0 detection and inbound/outbound conversion
 *  - Error code mapping (Wundr <-> JSON-RPC 2.0)
 *  - Protocol upgrade v1 -> v2 message translation
 *  - V1Adapter bidirectional conversion
 *  - Format detection utility
 */

import { describe, it, expect, beforeEach } from 'vitest';

// MethodRegistry
import {
  isJsonRpcMessage,
  isJsonRpcBatch,
  jsonRpcToNative,
  nativeResponseToJsonRpc,
  nativeEventToJsonRpc,
  jsonRpcErrorResponse,
  wundrErrorToJsonRpcCode,
  jsonRpcCodeToWundrError,
} from '../../../protocol/jsonrpc-compat';
import {
  MethodRegistry,
  RpcDiscoverParamsSchema,
  RpcDescribeParamsSchema,
} from '../../../protocol/method-registry';
import {
  isV1Message,
  isNativeV2,
  isJsonRpc2,
  detectFormat,
  v1RequestToV2,
  v2ResponseToV1,
  v2EventToV1,
  V1Adapter,
} from '../../../protocol/protocol-upgrade';
import {
  PROTOCOL_V2_METHODS,
  PROTOCOL_V2_EVENTS,
  ErrorCodes,
  PROTOCOL_VERSION,
} from '../../../protocol/protocol-v2';

import type {
  JsonRpcRequest,
  JsonRpcNotification,
  JsonRpcSuccessResponse,
  JsonRpcErrorResponse,
} from '../../../protocol/jsonrpc-compat';
import type {
  MethodDescriptor,
  EventDescriptor,
  DiscoveryResult,
} from '../../../protocol/method-registry';
import type { V1Request } from '../../../protocol/protocol-upgrade';
import type { ResponseFrame, EventFrame } from '../../../protocol/protocol-v2';

// ===========================================================================
// MethodRegistry tests
// ===========================================================================

describe('MethodRegistry', () => {
  let registry: MethodRegistry;

  beforeEach(() => {
    registry = new MethodRegistry();
  });

  // -------------------------------------------------------------------------
  // describeMethod
  // -------------------------------------------------------------------------

  describe('describeMethod', () => {
    it('should return a descriptor for built-in methods', () => {
      const descriptor = registry.describeMethod('session.create');
      expect(descriptor).not.toBeNull();
      expect(descriptor!.name).toBe('session.create');
      expect(descriptor!.domain).toBe('session');
      expect(descriptor!.description).toBeTruthy();
      expect(descriptor!.requiredScopes).toBeInstanceOf(Array);
    });

    it('should return a descriptor for rpc.discover', () => {
      const descriptor = registry.describeMethod('rpc.discover');
      expect(descriptor).not.toBeNull();
      expect(descriptor!.name).toBe('rpc.discover');
      expect(descriptor!.domain).toBe('rpc');
    });

    it('should return a descriptor for rpc.describe', () => {
      const descriptor = registry.describeMethod('rpc.describe');
      expect(descriptor).not.toBeNull();
      expect(descriptor!.name).toBe('rpc.describe');
    });

    it('should return null for unknown methods', () => {
      const descriptor = registry.describeMethod('nonexistent.method');
      expect(descriptor).toBeNull();
    });

    it('should mark streaming methods correctly', () => {
      const promptSubmit = registry.describeMethod('prompt.submit');
      expect(promptSubmit!.streaming).toBe(true);

      const sessionCreate = registry.describeMethod('session.create');
      expect(sessionCreate!.streaming).toBe(false);
    });

    it('should mark idempotent methods correctly', () => {
      const healthPing = registry.describeMethod('health.ping');
      expect(healthPing!.idempotent).toBe(true);

      const sessionCreate = registry.describeMethod('session.create');
      expect(sessionCreate!.idempotent).toBe(false);
    });

    it('should include paramsSchema for methods with param schemas', () => {
      const sessionCreate = registry.describeMethod('session.create');
      expect(sessionCreate!.paramsSchema).not.toBeNull();
      expect(sessionCreate!.paramsSchema).toHaveProperty('type', 'object');
      expect(sessionCreate!.paramsSchema).toHaveProperty('properties');
    });

    it('should have null paramsSchema for methods without schemas', () => {
      // health.status has no param schema
      const healthStatus = registry.describeMethod('health.status');
      expect(healthStatus!.paramsSchema).toBeNull();
    });

    it('should include requiredScopes from METHOD_SCOPE_MAP', () => {
      const sessionCreate = registry.describeMethod('session.create');
      expect(sessionCreate!.requiredScopes).toContain('daemon.write');

      const configSet = registry.describeMethod('config.set');
      expect(configSet!.requiredScopes).toContain('daemon.admin');

      const authConnect = registry.describeMethod('auth.connect');
      expect(authConnect!.requiredScopes).toHaveLength(0);
    });

    it('should return extra registered methods', () => {
      const custom: MethodDescriptor = {
        name: 'plugin.doStuff',
        description: 'A custom plugin method.',
        domain: 'plugin',
        requiredScopes: [],
        streaming: false,
        idempotent: false,
        paramsSchema: null,
      };
      registry.registerMethod(custom);

      const result = registry.describeMethod('plugin.doStuff');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('plugin.doStuff');
      expect(result!.description).toBe('A custom plugin method.');
    });
  });

  // -------------------------------------------------------------------------
  // discover
  // -------------------------------------------------------------------------

  describe('discover', () => {
    let result: DiscoveryResult;

    beforeEach(() => {
      result = registry.discover(PROTOCOL_VERSION);
    });

    it('should return the protocol version', () => {
      expect(result.protocolVersion).toBe(PROTOCOL_VERSION);
    });

    it('should include all built-in methods', () => {
      const methodNames = result.methods.map(m => m.name);
      for (const method of PROTOCOL_V2_METHODS) {
        expect(methodNames).toContain(method);
      }
    });

    it('should include rpc.discover and rpc.describe in the catalog', () => {
      const methodNames = result.methods.map(m => m.name);
      expect(methodNames).toContain('rpc.discover');
      expect(methodNames).toContain('rpc.describe');
    });

    it('should include all built-in events', () => {
      const eventNames = result.events.map(e => e.name);
      for (const event of PROTOCOL_V2_EVENTS) {
        expect(eventNames).toContain(event);
      }
    });

    it('should include stream.progress event', () => {
      const eventNames = result.events.map(e => e.name);
      expect(eventNames).toContain('stream.progress');
    });

    it('should mark broadcast events as not requiring subscription', () => {
      const heartbeat = result.events.find(e => e.name === 'health.heartbeat');
      expect(heartbeat).toBeDefined();
      expect(heartbeat!.requiresSubscription).toBe(false);
    });

    it('should mark non-broadcast events as requiring subscription', () => {
      const streamChunk = result.events.find(e => e.name === 'stream.chunk');
      expect(streamChunk).toBeDefined();
      expect(streamChunk!.requiresSubscription).toBe(true);
    });

    it('should include extra registered methods in discovery', () => {
      const custom: MethodDescriptor = {
        name: 'plugin.custom',
        description: 'Custom plugin.',
        domain: 'plugin',
        requiredScopes: [],
        streaming: false,
        idempotent: true,
        paramsSchema: null,
      };
      registry.registerMethod(custom);

      const updated = registry.discover(PROTOCOL_VERSION);
      const methodNames = updated.methods.map(m => m.name);
      expect(methodNames).toContain('plugin.custom');
    });

    it('should include extra registered events in discovery', () => {
      const customEvent: EventDescriptor = {
        name: 'plugin.fired',
        description: 'Plugin event.',
        domain: 'plugin',
        requiresSubscription: true,
      };
      registry.registerEvent(customEvent);

      const updated = registry.discover(PROTOCOL_VERSION);
      const eventNames = updated.events.map(e => e.name);
      expect(eventNames).toContain('plugin.fired');
    });

    it('should return proper domain for each method', () => {
      for (const method of result.methods) {
        if (method.name.includes('.')) {
          expect(method.domain).toBe(method.name.split('.')[0]);
        }
      }
    });
  });

  // -------------------------------------------------------------------------
  // registerMethod / registerEvent / removeMethod
  // -------------------------------------------------------------------------

  describe('method/event registration', () => {
    it('should register and retrieve a custom method', () => {
      registry.registerMethod({
        name: 'ext.run',
        description: 'Run extension.',
        domain: 'ext',
        requiredScopes: [],
        streaming: false,
        idempotent: false,
        paramsSchema: null,
      });

      expect(registry.describeMethod('ext.run')).not.toBeNull();
    });

    it('should allow overwriting an existing extra method', () => {
      registry.registerMethod({
        name: 'ext.run',
        description: 'Version 1.',
        domain: 'ext',
        requiredScopes: [],
        streaming: false,
        idempotent: false,
        paramsSchema: null,
      });

      registry.registerMethod({
        name: 'ext.run',
        description: 'Version 2.',
        domain: 'ext',
        requiredScopes: [],
        streaming: true,
        idempotent: false,
        paramsSchema: null,
      });

      const desc = registry.describeMethod('ext.run');
      expect(desc!.description).toBe('Version 2.');
      expect(desc!.streaming).toBe(true);
    });

    it('should remove a registered method', () => {
      registry.registerMethod({
        name: 'ext.run',
        description: 'Remove me.',
        domain: 'ext',
        requiredScopes: [],
        streaming: false,
        idempotent: false,
        paramsSchema: null,
      });

      expect(registry.removeMethod('ext.run')).toBe(true);
      expect(registry.describeMethod('ext.run')).toBeNull();
    });

    it('should return false when removing a non-existent method', () => {
      expect(registry.removeMethod('nonexistent')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // RPC discovery param schemas
  // -------------------------------------------------------------------------

  describe('RPC discovery schemas', () => {
    it('should accept valid RpcDescribeParams', () => {
      const result = RpcDescribeParamsSchema.safeParse({
        method: 'session.create',
      });
      expect(result.success).toBe(true);
    });

    it('should reject RpcDescribeParams with empty method', () => {
      const result = RpcDescribeParamsSchema.safeParse({ method: '' });
      expect(result.success).toBe(false);
    });

    it('should accept RpcDiscoverParams with defaults', () => {
      const result = RpcDiscoverParamsSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept RpcDiscoverParams with explicit includeSchemas', () => {
      const result = RpcDiscoverParamsSchema.safeParse({
        includeSchemas: false,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.includeSchemas).toBe(false);
      }
    });

    it('should accept undefined (optional) for RpcDiscoverParams', () => {
      const result = RpcDiscoverParamsSchema.safeParse(undefined);
      expect(result.success).toBe(true);
    });
  });
});

// ===========================================================================
// JSON-RPC 2.0 compatibility tests
// ===========================================================================

describe('JSON-RPC 2.0 compatibility', () => {
  // -------------------------------------------------------------------------
  // Detection
  // -------------------------------------------------------------------------

  describe('isJsonRpcMessage', () => {
    it('should detect JSON-RPC 2.0 request', () => {
      expect(isJsonRpcMessage({ jsonrpc: '2.0', id: 1, method: 'test' })).toBe(
        true
      );
    });

    it('should detect JSON-RPC 2.0 notification', () => {
      expect(isJsonRpcMessage({ jsonrpc: '2.0', method: 'notify' })).toBe(true);
    });

    it('should reject native v2 frame', () => {
      expect(isJsonRpcMessage({ type: 'req', id: '1', method: 'test' })).toBe(
        false
      );
    });

    it('should reject null/undefined/primitives', () => {
      expect(isJsonRpcMessage(null)).toBe(false);
      expect(isJsonRpcMessage(undefined)).toBe(false);
      expect(isJsonRpcMessage('string')).toBe(false);
      expect(isJsonRpcMessage(42)).toBe(false);
    });

    it('should reject old JSON-RPC version', () => {
      expect(isJsonRpcMessage({ jsonrpc: '1.0', id: 1 })).toBe(false);
    });
  });

  describe('isJsonRpcBatch', () => {
    it('should detect arrays as batches', () => {
      expect(isJsonRpcBatch([1, 2, 3])).toBe(true);
    });

    it('should reject non-arrays', () => {
      expect(isJsonRpcBatch({})).toBe(false);
      expect(isJsonRpcBatch('test')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Inbound conversion: JSON-RPC 2.0 -> native
  // -------------------------------------------------------------------------

  describe('jsonRpcToNative', () => {
    it('should convert a JSON-RPC request to a native request frame', () => {
      const rpc: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'req-1',
        method: 'session.create',
        params: { foo: 'bar' },
      };
      const result = jsonRpcToNative(rpc);
      expect(result.type).toBe('request');
      if (result.type === 'request') {
        expect(result.frame.type).toBe('req');
        expect(result.frame.id).toBe('req-1');
        expect(result.frame.method).toBe('session.create');
        expect(result.frame.params).toEqual({ foo: 'bar' });
      }
    });

    it('should convert a numeric id to string', () => {
      const rpc = { jsonrpc: '2.0' as const, id: 42, method: 'test' };
      const result = jsonRpcToNative(rpc);
      if (result.type === 'request') {
        expect(result.frame.id).toBe('42');
      }
    });

    it('should convert a JSON-RPC notification to a notification result', () => {
      const rpc: JsonRpcNotification = {
        jsonrpc: '2.0',
        method: 'stream.update',
        params: { data: 'chunk' },
      };
      const result = jsonRpcToNative(rpc);
      expect(result.type).toBe('notification');
      if (result.type === 'notification') {
        expect(result.event).toBe('stream.update');
        expect(result.payload).toEqual({ data: 'chunk' });
      }
    });

    it('should return error for non-object input', () => {
      const result = jsonRpcToNative(null);
      expect(result.type).toBe('error');
      if (result.type === 'error') {
        expect(result.code).toBe(-32600);
      }
    });

    it('should return error for invalid JSON-RPC request', () => {
      const result = jsonRpcToNative({ jsonrpc: '2.0', id: 'x' }); // missing method
      expect(result.type).toBe('error');
      if (result.type === 'error') {
        expect(result.code).toBe(-32600);
      }
    });

    it('should return error for unrecognized message format', () => {
      const result = jsonRpcToNative({ jsonrpc: '2.0', unknown: true });
      expect(result.type).toBe('error');
    });
  });

  // -------------------------------------------------------------------------
  // Outbound conversion: native -> JSON-RPC 2.0
  // -------------------------------------------------------------------------

  describe('nativeResponseToJsonRpc', () => {
    it('should convert a successful response', () => {
      const frame: ResponseFrame = {
        type: 'res',
        id: 'r-1',
        ok: true,
        payload: { result: 'data' },
      };
      const rpc = nativeResponseToJsonRpc(frame);
      expect(rpc.jsonrpc).toBe('2.0');
      expect(rpc.id).toBe('r-1');
      expect('result' in rpc).toBe(true);
      expect((rpc as JsonRpcSuccessResponse).result).toEqual({
        result: 'data',
      });
    });

    it('should convert a successful response with null payload', () => {
      const frame: ResponseFrame = {
        type: 'res',
        id: 'r-2',
        ok: true,
      };
      const rpc = nativeResponseToJsonRpc(frame) as JsonRpcSuccessResponse;
      expect(rpc.result).toBeNull();
    });

    it('should convert an error response', () => {
      const frame: ResponseFrame = {
        type: 'res',
        id: 'r-3',
        ok: false,
        error: {
          code: ErrorCodes.NOT_FOUND,
          message: 'session not found',
        },
      };
      const rpc = nativeResponseToJsonRpc(frame) as JsonRpcErrorResponse;
      expect(rpc.jsonrpc).toBe('2.0');
      expect(rpc.error.code).toBe(-32601); // NOT_FOUND -> -32601
      expect(rpc.error.message).toBe('session not found');
    });

    it('should use originalId override when provided', () => {
      const frame: ResponseFrame = { type: 'res', id: 'internal', ok: true };
      const rpc = nativeResponseToJsonRpc(frame, 42);
      expect(rpc.id).toBe(42);
    });

    it('should map known error codes correctly', () => {
      const testCases: [string, number][] = [
        [ErrorCodes.INVALID_REQUEST, -32600],
        [ErrorCodes.NOT_FOUND, -32601],
        [ErrorCodes.INTERNAL, -32603],
        [ErrorCodes.UNAUTHORIZED, -32000],
        [ErrorCodes.FORBIDDEN, -32001],
        [ErrorCodes.RATE_LIMITED, -32003],
      ];

      for (const [wundrCode, jsonRpcCode] of testCases) {
        const frame: ResponseFrame = {
          type: 'res',
          id: 'e',
          ok: false,
          error: { code: wundrCode, message: 'test' },
        };
        const rpc = nativeResponseToJsonRpc(frame) as JsonRpcErrorResponse;
        expect(rpc.error.code).toBe(jsonRpcCode);
      }
    });

    it('should default to -32603 for unmapped error codes', () => {
      const frame: ResponseFrame = {
        type: 'res',
        id: 'e',
        ok: false,
        error: { code: 'CUSTOM_ERROR', message: 'custom' },
      };
      const rpc = nativeResponseToJsonRpc(frame) as JsonRpcErrorResponse;
      expect(rpc.error.code).toBe(-32603);
    });

    it('should include error details when present', () => {
      const frame: ResponseFrame = {
        type: 'res',
        id: 'e',
        ok: false,
        error: {
          code: ErrorCodes.INTERNAL,
          message: 'oops',
          details: { stack: 'trace' },
        },
      };
      const rpc = nativeResponseToJsonRpc(frame) as JsonRpcErrorResponse;
      expect(rpc.error.data).toEqual({ stack: 'trace' });
    });
  });

  describe('nativeEventToJsonRpc', () => {
    it('should convert an event frame to a JSON-RPC notification', () => {
      const frame: EventFrame = {
        type: 'event',
        event: 'stream.chunk',
        payload: { data: 'hello' },
        seq: 3,
        subscriptionId: 'sub-1',
      };
      const rpc = nativeEventToJsonRpc(frame);
      expect(rpc.jsonrpc).toBe('2.0');
      expect(rpc.method).toBe('stream.chunk');
      expect(rpc.params).toEqual({
        payload: { data: 'hello' },
        seq: 3,
        subscriptionId: 'sub-1',
      });
    });
  });

  describe('jsonRpcErrorResponse', () => {
    it('should build a well-formed error response', () => {
      const rpc = jsonRpcErrorResponse('err-1', -32700, 'Parse error');
      expect(rpc.jsonrpc).toBe('2.0');
      expect(rpc.id).toBe('err-1');
      expect(rpc.error.code).toBe(-32700);
      expect(rpc.error.message).toBe('Parse error');
    });

    it('should support null id for parse errors', () => {
      const rpc = jsonRpcErrorResponse(null, -32700, 'Parse error');
      expect(rpc.id).toBeNull();
    });

    it('should include optional data', () => {
      const rpc = jsonRpcErrorResponse('x', -32600, 'bad', { info: 'details' });
      expect(rpc.error.data).toEqual({ info: 'details' });
    });
  });

  // -------------------------------------------------------------------------
  // Error code utilities
  // -------------------------------------------------------------------------

  describe('error code utilities', () => {
    it('wundrErrorToJsonRpcCode should map known codes', () => {
      expect(
        wundrErrorToJsonRpcCode({ code: ErrorCodes.NOT_FOUND, message: '' })
      ).toBe(-32601);
      expect(
        wundrErrorToJsonRpcCode({ code: ErrorCodes.INTERNAL, message: '' })
      ).toBe(-32603);
    });

    it('wundrErrorToJsonRpcCode should default to -32603 for unknown codes', () => {
      expect(wundrErrorToJsonRpcCode({ code: 'UNKNOWN', message: '' })).toBe(
        -32603
      );
    });

    it('jsonRpcCodeToWundrError should map known codes', () => {
      expect(jsonRpcCodeToWundrError(-32700)).toBe(ErrorCodes.INVALID_REQUEST);
      expect(jsonRpcCodeToWundrError(-32601)).toBe(ErrorCodes.NOT_FOUND);
      expect(jsonRpcCodeToWundrError(-32603)).toBe(ErrorCodes.INTERNAL);
    });

    it('jsonRpcCodeToWundrError should default to INTERNAL for unknown codes', () => {
      expect(jsonRpcCodeToWundrError(-99999)).toBe(ErrorCodes.INTERNAL);
    });

    it('should round-trip known error codes', () => {
      const wundrCode = ErrorCodes.RATE_LIMITED;
      const jsonRpcCode = wundrErrorToJsonRpcCode({
        code: wundrCode,
        message: '',
      });
      const backToWundr = jsonRpcCodeToWundrError(jsonRpcCode);
      expect(backToWundr).toBe(wundrCode);
    });
  });
});

// ===========================================================================
// Protocol Upgrade (v1 -> v2) tests
// ===========================================================================

describe('Protocol Upgrade (v1 -> v2)', () => {
  // -------------------------------------------------------------------------
  // Format detection
  // -------------------------------------------------------------------------

  describe('format detection', () => {
    describe('isV1Message', () => {
      it('should detect v1 messages (action field, no type field)', () => {
        expect(isV1Message({ action: 'createSession', data: {} })).toBe(true);
      });

      it('should reject v2 messages (has type field)', () => {
        expect(isV1Message({ type: 'req', action: 'x' })).toBe(false);
      });

      it('should reject messages without action', () => {
        expect(isV1Message({ data: {} })).toBe(false);
      });

      it('should reject empty action', () => {
        expect(isV1Message({ action: '' })).toBe(false);
      });

      it('should reject non-objects', () => {
        expect(isV1Message(null)).toBe(false);
        expect(isV1Message('string')).toBe(false);
        expect(isV1Message(123)).toBe(false);
        expect(isV1Message(undefined)).toBe(false);
      });
    });

    describe('isNativeV2', () => {
      it('should detect "req" type', () => {
        expect(isNativeV2({ type: 'req', id: '1', method: 'test' })).toBe(true);
      });

      it('should detect "res" type', () => {
        expect(isNativeV2({ type: 'res', id: '1', ok: true })).toBe(true);
      });

      it('should detect "event" type', () => {
        expect(isNativeV2({ type: 'event', event: 'test' })).toBe(true);
      });

      it('should reject unknown type values', () => {
        expect(isNativeV2({ type: 'notification' })).toBe(false);
      });

      it('should reject non-objects', () => {
        expect(isNativeV2(null)).toBe(false);
        expect(isNativeV2(42)).toBe(false);
      });
    });

    describe('isJsonRpc2', () => {
      it('should detect JSON-RPC 2.0', () => {
        expect(isJsonRpc2({ jsonrpc: '2.0', id: 1, method: 'test' })).toBe(
          true
        );
      });

      it('should reject non-2.0', () => {
        expect(isJsonRpc2({ jsonrpc: '1.0' })).toBe(false);
      });

      it('should reject non-objects', () => {
        expect(isJsonRpc2(null)).toBe(false);
      });
    });

    describe('detectFormat', () => {
      it('should detect v1 format', () => {
        expect(detectFormat({ action: 'ping' })).toBe('v1');
      });

      it('should detect v2 format', () => {
        expect(detectFormat({ type: 'req', id: '1', method: 'test' })).toBe(
          'v2'
        );
      });

      it('should detect jsonrpc2 format', () => {
        expect(detectFormat({ jsonrpc: '2.0', id: 1, method: 'test' })).toBe(
          'jsonrpc2'
        );
      });

      it('should return unknown for unrecognized formats', () => {
        expect(detectFormat({ random: 'data' })).toBe('unknown');
        expect(detectFormat(null)).toBe('unknown');
        expect(detectFormat(42)).toBe('unknown');
      });
    });
  });

  // -------------------------------------------------------------------------
  // v1 -> v2 conversion
  // -------------------------------------------------------------------------

  describe('v1RequestToV2', () => {
    it('should map known v1 action to v2 method', () => {
      const v1: V1Request = { action: 'createSession', data: { name: 'test' } };
      const v2 = v1RequestToV2(v1);
      expect(v2.type).toBe('req');
      expect(v2.method).toBe('session.create');
      expect(v2.params).toEqual({ name: 'test' });
    });

    it('should preserve requestId from v1', () => {
      const v1: V1Request = { action: 'ping', requestId: 'my-req-1' };
      const v2 = v1RequestToV2(v1);
      expect(v2.id).toBe('my-req-1');
    });

    it('should generate a request id when v1 has none', () => {
      const v1: V1Request = { action: 'ping' };
      const v2 = v1RequestToV2(v1);
      expect(v2.id).toBeDefined();
      expect(v2.id.startsWith('v1_')).toBe(true);
    });

    it('should pass through unknown actions as-is', () => {
      const v1: V1Request = { action: 'customAction', data: { x: 1 } };
      const v2 = v1RequestToV2(v1);
      expect(v2.method).toBe('customAction');
    });

    it('should map all known session actions', () => {
      expect(v1RequestToV2({ action: 'createSession' }).method).toBe(
        'session.create'
      );
      expect(v1RequestToV2({ action: 'resumeSession' }).method).toBe(
        'session.resume'
      );
      expect(v1RequestToV2({ action: 'stopSession' }).method).toBe(
        'session.stop'
      );
      expect(v1RequestToV2({ action: 'listSessions' }).method).toBe(
        'session.list'
      );
      expect(v1RequestToV2({ action: 'sessionStatus' }).method).toBe(
        'session.status'
      );
      expect(v1RequestToV2({ action: 'getSessionStatus' }).method).toBe(
        'session.status'
      );
    });

    it('should map prompt actions', () => {
      expect(v1RequestToV2({ action: 'submitPrompt' }).method).toBe(
        'prompt.submit'
      );
      expect(v1RequestToV2({ action: 'cancelPrompt' }).method).toBe(
        'prompt.cancel'
      );
    });

    it('should map tool actions', () => {
      expect(v1RequestToV2({ action: 'approveTool' }).method).toBe(
        'tool.approve'
      );
      expect(v1RequestToV2({ action: 'denyTool' }).method).toBe('tool.deny');
    });

    it('should map agent actions', () => {
      expect(v1RequestToV2({ action: 'spawnAgent' }).method).toBe(
        'agent.spawn'
      );
      expect(v1RequestToV2({ action: 'agentStatus' }).method).toBe(
        'agent.status'
      );
      expect(v1RequestToV2({ action: 'stopAgent' }).method).toBe('agent.stop');
    });

    it('should map team actions', () => {
      expect(v1RequestToV2({ action: 'createTeam' }).method).toBe(
        'team.create'
      );
      expect(v1RequestToV2({ action: 'teamStatus' }).method).toBe(
        'team.status'
      );
      expect(v1RequestToV2({ action: 'teamMessage' }).method).toBe(
        'team.message'
      );
      expect(v1RequestToV2({ action: 'dissolveTeam' }).method).toBe(
        'team.dissolve'
      );
    });

    it('should map memory actions', () => {
      expect(v1RequestToV2({ action: 'queryMemory' }).method).toBe(
        'memory.query'
      );
      expect(v1RequestToV2({ action: 'storeMemory' }).method).toBe(
        'memory.store'
      );
      expect(v1RequestToV2({ action: 'deleteMemory' }).method).toBe(
        'memory.delete'
      );
    });

    it('should map health and auth actions', () => {
      expect(v1RequestToV2({ action: 'ping' }).method).toBe('health.ping');
      expect(v1RequestToV2({ action: 'healthStatus' }).method).toBe(
        'health.status'
      );
      expect(v1RequestToV2({ action: 'connect' }).method).toBe('auth.connect');
      expect(v1RequestToV2({ action: 'refresh' }).method).toBe('auth.refresh');
      expect(v1RequestToV2({ action: 'logout' }).method).toBe('auth.logout');
    });

    it('should map subscription actions', () => {
      expect(v1RequestToV2({ action: 'subscribe' }).method).toBe('subscribe');
      expect(v1RequestToV2({ action: 'unsubscribe' }).method).toBe(
        'unsubscribe'
      );
    });
  });

  // -------------------------------------------------------------------------
  // v2 -> v1 conversion
  // -------------------------------------------------------------------------

  describe('v2ResponseToV1', () => {
    it('should convert a successful v2 response to v1', () => {
      const frame: ResponseFrame = {
        type: 'res',
        id: 'req-1',
        ok: true,
        payload: { sessionId: 'sess-42' },
      };
      const v1 = v2ResponseToV1(frame, 'createSession');
      expect(v1.action).toBe('createSession');
      expect(v1.success).toBe(true);
      expect(v1.requestId).toBe('req-1');
      expect(v1.data).toEqual({ sessionId: 'sess-42' });
    });

    it('should convert an error v2 response to v1', () => {
      const frame: ResponseFrame = {
        type: 'res',
        id: 'req-2',
        ok: false,
        error: { code: ErrorCodes.NOT_FOUND, message: 'not found' },
      };
      const v1 = v2ResponseToV1(frame, 'sessionStatus');
      expect(v1.action).toBe('sessionStatus');
      expect(v1.success).toBe(false);
      expect(v1.error).toBe('not found');
    });

    it('should fall back to "response" action if no original action', () => {
      const frame: ResponseFrame = { type: 'res', id: 'unknown-id', ok: true };
      const v1 = v2ResponseToV1(frame);
      expect(v1.action).toBe('response');
    });
  });

  describe('v2EventToV1', () => {
    it('should convert known v2 events to v1 actions', () => {
      const frame: EventFrame = {
        type: 'event',
        event: 'stream.chunk',
        payload: { data: 'hello' },
      };
      const v1 = v2EventToV1(frame);
      expect(v1.action).toBe('streamChunk');
      expect(v1.data).toEqual({ data: 'hello' });
    });

    it('should convert heartbeat event', () => {
      const frame: EventFrame = {
        type: 'event',
        event: 'health.heartbeat',
        payload: { serverTimestamp: 123 },
      };
      const v1 = v2EventToV1(frame);
      expect(v1.action).toBe('heartbeat');
    });

    it('should pass through unknown event names as-is', () => {
      const frame: EventFrame = {
        type: 'event',
        event: 'custom.event',
        payload: {},
      };
      const v1 = v2EventToV1(frame);
      expect(v1.action).toBe('custom.event');
    });

    it('should convert all known v2 event names', () => {
      const mappings: [string, string][] = [
        ['stream.start', 'streamStart'],
        ['stream.chunk', 'streamChunk'],
        ['stream.end', 'streamEnd'],
        ['stream.error', 'streamError'],
        ['tool.request', 'toolRequest'],
        ['tool.result', 'toolResult'],
        ['tool.status', 'toolStatus'],
        ['agent.status', 'agentStatus'],
        ['agent.spawned', 'agentSpawned'],
        ['agent.stopped', 'agentStopped'],
        ['team.status', 'teamStatus'],
        ['team.message', 'teamMessage'],
        ['team.dissolved', 'teamDissolved'],
        ['session.status', 'sessionStatus'],
        ['session.created', 'sessionCreated'],
        ['session.stopped', 'sessionStopped'],
      ];

      for (const [v2Event, v1Action] of mappings) {
        const frame: EventFrame = { type: 'event', event: v2Event };
        const v1 = v2EventToV1(frame);
        expect(v1.action).toBe(v1Action);
      }
    });
  });

  // -------------------------------------------------------------------------
  // V1Adapter
  // -------------------------------------------------------------------------

  describe('V1Adapter', () => {
    let adapter: V1Adapter;

    beforeEach(() => {
      adapter = new V1Adapter();
    });

    describe('inbound (v1 JSON -> v2 RequestFrame)', () => {
      it('should parse and convert a v1 request', () => {
        const json = JSON.stringify({
          action: 'createSession',
          data: { name: 'test' },
          requestId: 'r-1',
        });
        const frame = adapter.inbound(json);
        expect(frame).not.toBeNull();
        expect(frame!.type).toBe('req');
        expect(frame!.method).toBe('session.create');
        expect(frame!.id).toBe('r-1');
        expect(frame!.params).toEqual({ name: 'test' });
      });

      it('should return null for malformed JSON', () => {
        expect(adapter.inbound('{bad')).toBeNull();
      });

      it('should return null for non-v1 messages', () => {
        const v2 = JSON.stringify({ type: 'req', id: '1', method: 'test' });
        expect(adapter.inbound(v2)).toBeNull();
      });

      it('should track pending actions for response correlation', () => {
        adapter.inbound(JSON.stringify({ action: 'ping', requestId: 'p-1' }));
        expect(adapter.pendingCount).toBe(1);
      });
    });

    describe('outboundResponse (v2 ResponseFrame -> v1 JSON)', () => {
      it('should convert response and use tracked original action', () => {
        // First, inbound a v1 request to track the action
        adapter.inbound(
          JSON.stringify({ action: 'createSession', requestId: 'r-1' })
        );
        expect(adapter.pendingCount).toBe(1);

        // Now convert the outbound response
        const frame: ResponseFrame = {
          type: 'res',
          id: 'r-1',
          ok: true,
          payload: { sessionId: 's-1' },
        };
        const json = adapter.outboundResponse(frame);
        const parsed = JSON.parse(json);

        expect(parsed.action).toBe('createSession');
        expect(parsed.success).toBe(true);
        expect(parsed.requestId).toBe('r-1');
        expect(adapter.pendingCount).toBe(0); // cleaned up
      });

      it('should fall back gracefully if action is not tracked', () => {
        const frame: ResponseFrame = { type: 'res', id: 'unknown', ok: true };
        const json = adapter.outboundResponse(frame);
        const parsed = JSON.parse(json);
        expect(parsed.action).toBe('response');
      });
    });

    describe('outboundEvent (v2 EventFrame -> v1 JSON)', () => {
      it('should convert a v2 event to v1 format', () => {
        const frame: EventFrame = {
          type: 'event',
          event: 'stream.chunk',
          payload: { content: 'data' },
        };
        const json = adapter.outboundEvent(frame);
        const parsed = JSON.parse(json);
        expect(parsed.action).toBe('streamChunk');
        expect(parsed.data).toEqual({ content: 'data' });
      });
    });

    describe('clear', () => {
      it('should clear all pending state', () => {
        adapter.inbound(JSON.stringify({ action: 'ping', requestId: 'p-1' }));
        adapter.inbound(JSON.stringify({ action: 'ping', requestId: 'p-2' }));
        expect(adapter.pendingCount).toBe(2);

        adapter.clear();
        expect(adapter.pendingCount).toBe(0);
      });
    });

    describe('full round-trip scenario', () => {
      it('should handle a complete request/response cycle', () => {
        // Client sends v1 request
        const v1Req = JSON.stringify({
          action: 'submitPrompt',
          data: { sessionId: 's-1', prompt: 'Hello' },
          requestId: 'req-42',
        });

        const frame = adapter.inbound(v1Req);
        expect(frame).not.toBeNull();
        expect(frame!.method).toBe('prompt.submit');

        // Server sends v2 response
        const response: ResponseFrame = {
          type: 'res',
          id: 'req-42',
          ok: true,
          payload: { promptId: 'p-1' },
        };

        const v1Res = adapter.outboundResponse(response);
        const parsed = JSON.parse(v1Res);
        expect(parsed.action).toBe('submitPrompt');
        expect(parsed.success).toBe(true);
        expect(parsed.data).toEqual({ promptId: 'p-1' });
      });

      it('should handle interleaved events during a request', () => {
        // Client sends request
        adapter.inbound(
          JSON.stringify({ action: 'submitPrompt', requestId: 'req-1' })
        );

        // Server pushes events
        const event1 = adapter.outboundEvent({
          type: 'event',
          event: 'stream.start',
          payload: { sessionId: 's-1' },
        });
        expect(JSON.parse(event1).action).toBe('streamStart');

        const event2 = adapter.outboundEvent({
          type: 'event',
          event: 'stream.chunk',
          payload: { content: 'hello' },
        });
        expect(JSON.parse(event2).action).toBe('streamChunk');

        // Server sends final response
        const response = adapter.outboundResponse({
          type: 'res',
          id: 'req-1',
          ok: true,
          payload: { done: true },
        });
        expect(JSON.parse(response).action).toBe('submitPrompt');
      });
    });
  });
});
