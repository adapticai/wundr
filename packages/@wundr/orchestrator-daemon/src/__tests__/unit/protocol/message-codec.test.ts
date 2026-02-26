/**
 * Tests for the MessageCodec class (src/protocol/message-codec.ts).
 *
 * Covers:
 *  - Text frame encoding/decoding (single and batch)
 *  - Gzip and deflate compression/decompression round trips
 *  - Compression threshold behavior
 *  - Message size enforcement
 *  - Batch count enforcement
 *  - Binary frame encoding/decoding with header format
 *  - Edge cases: empty messages, large payloads, malformed JSON, truncated binary
 */

import { randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';

import { describe, it, expect, beforeEach } from 'vitest';

import { MessageCodec } from '../../../protocol/message-codec';
import {
  MAX_PAYLOAD_BYTES,
  BINARY_HEADER_FIXED_SIZE,
  BINARY_HEADER_VERSION,
  BinaryFlags,
} from '../../../protocol/protocol-v2';

import type {} from '../../../protocol/message-codec';
import type {
  ProtocolFrame,
  BinaryMetadata,
} from '../../../protocol/protocol-v2';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequestFrame(overrides?: Partial<ProtocolFrame>): ProtocolFrame {
  return {
    type: 'req',
    id: randomUUID(),
    method: 'health.ping',
    params: { clientTimestamp: Date.now() },
    ...overrides,
  } as ProtocolFrame;
}

function makeResponseFrame(id?: string): ProtocolFrame {
  return {
    type: 'res',
    id: id ?? randomUUID(),
    ok: true,
    payload: { serverTimestamp: Date.now() },
  } as ProtocolFrame;
}

function makeEventFrame(): ProtocolFrame {
  return {
    type: 'event',
    event: 'health.heartbeat',
    payload: { serverTimestamp: Date.now(), seq: 1 },
    seq: 1,
  } as ProtocolFrame;
}

describe('MessageCodec', () => {
  let codec: MessageCodec;

  beforeEach(() => {
    codec = new MessageCodec();
  });

  // -------------------------------------------------------------------------
  // Construction and defaults
  // -------------------------------------------------------------------------

  describe('construction', () => {
    it('should use default config when none is provided', () => {
      const c = new MessageCodec();
      expect(c.messageSizeLimit).toBe(MAX_PAYLOAD_BYTES);
    });

    it('should accept custom config', () => {
      const c = new MessageCodec({ maxMessageBytes: 1024 });
      expect(c.messageSizeLimit).toBe(1024);
    });

    it('should accept custom compression threshold', () => {
      const c = new MessageCodec({
        compressionThreshold: 512,
        compressionAlgorithm: 'deflate',
      });
      expect(c.messageSizeLimit).toBe(MAX_PAYLOAD_BYTES);
    });
  });

  // -------------------------------------------------------------------------
  // Text encoding -- single frame
  // -------------------------------------------------------------------------

  describe('encodeFrame', () => {
    it('should encode a request frame to a JSON string', () => {
      const frame = makeRequestFrame();
      const json = codec.encodeFrame(frame);
      const parsed = JSON.parse(json);
      expect(parsed.type).toBe('req');
      expect(parsed.id).toBe(frame.id);
      expect(parsed.method).toBe('health.ping');
    });

    it('should encode a response frame', () => {
      const frame = makeResponseFrame();
      const json = codec.encodeFrame(frame);
      const parsed = JSON.parse(json);
      expect(parsed.type).toBe('res');
      expect(parsed.ok).toBe(true);
    });

    it('should encode an event frame', () => {
      const frame = makeEventFrame();
      const json = codec.encodeFrame(frame);
      const parsed = JSON.parse(json);
      expect(parsed.type).toBe('event');
      expect(parsed.event).toBe('health.heartbeat');
    });

    it('should throw when encoded size exceeds the limit', () => {
      const smallCodec = new MessageCodec({ maxMessageBytes: 50 });
      const frame = makeRequestFrame({
        params: { data: 'x'.repeat(100) },
      } as any);
      expect(() => smallCodec.encodeFrame(frame)).toThrow(/exceeds size limit/);
    });
  });

  // -------------------------------------------------------------------------
  // Text encoding -- batch
  // -------------------------------------------------------------------------

  describe('encodeBatch', () => {
    it('should encode a single-frame batch as a non-array JSON', () => {
      const frame = makeRequestFrame();
      const json = codec.encodeBatch([frame]);
      const parsed = JSON.parse(json);
      // Single-frame batch optimizes to non-array
      expect(Array.isArray(parsed)).toBe(false);
      expect(parsed.type).toBe('req');
    });

    it('should encode multiple frames as a JSON array', () => {
      const frames = [
        makeRequestFrame(),
        makeResponseFrame(),
        makeEventFrame(),
      ];
      const json = codec.encodeBatch(frames);
      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(3);
    });

    it('should throw for empty batch', () => {
      expect(() => codec.encodeBatch([])).toThrow(/at least one frame/);
    });

    it('should throw when batch exceeds maxBatchSize', () => {
      const smallBatchCodec = new MessageCodec({ maxBatchSize: 2 });
      const frames = [
        makeRequestFrame(),
        makeRequestFrame(),
        makeRequestFrame(),
      ];
      expect(() => smallBatchCodec.encodeBatch(frames)).toThrow(
        /exceeds maximum/
      );
    });

    it('should respect the default maxBatchSize of 50', () => {
      const frames = Array.from({ length: 50 }, () => makeRequestFrame());
      // Should not throw -- 50 is the limit
      expect(() => codec.encodeBatch(frames)).not.toThrow();

      const tooMany = Array.from({ length: 51 }, () => makeRequestFrame());
      expect(() => codec.encodeBatch(tooMany)).toThrow(/exceeds maximum/);
    });
  });

  // -------------------------------------------------------------------------
  // Text decoding -- single frame
  // -------------------------------------------------------------------------

  describe('decodeText - single frame', () => {
    it('should decode a valid request frame', () => {
      const frame = makeRequestFrame();
      const json = JSON.stringify(frame);
      const result = codec.decodeText(json);
      expect(result.isBatch).toBe(false);
      expect(result.errors).toHaveLength(0);
      expect(result.frames).toHaveLength(1);
      expect(result.frames[0].type).toBe('req');
    });

    it('should decode a valid response frame', () => {
      const frame = makeResponseFrame();
      const json = JSON.stringify(frame);
      const result = codec.decodeText(json);
      expect(result.errors).toHaveLength(0);
      expect(result.frames).toHaveLength(1);
      expect(result.frames[0].type).toBe('res');
    });

    it('should decode a valid event frame', () => {
      const frame = makeEventFrame();
      const json = JSON.stringify(frame);
      const result = codec.decodeText(json);
      expect(result.errors).toHaveLength(0);
      expect(result.frames).toHaveLength(1);
      expect(result.frames[0].type).toBe('event');
    });

    it('should return error for malformed JSON', () => {
      const result = codec.decodeText('{bad json');
      expect(result.frames).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('malformed JSON');
    });

    it('should return error for invalid frame structure', () => {
      const result = codec.decodeText(JSON.stringify({ foo: 'bar' }));
      expect(result.frames).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
    });

    it('should return error for request frame missing required fields', () => {
      const result = codec.decodeText(JSON.stringify({ type: 'req' }));
      expect(result.frames).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should throw for oversized messages', () => {
      const tinyCodec = new MessageCodec({ maxMessageBytes: 10 });
      expect(() => tinyCodec.decodeText('x'.repeat(100))).toThrow(
        /exceeds size limit/
      );
    });
  });

  // -------------------------------------------------------------------------
  // Text decoding -- batch
  // -------------------------------------------------------------------------

  describe('decodeText - batch', () => {
    it('should decode a batch of valid frames', () => {
      const frames = [makeRequestFrame(), makeResponseFrame()];
      const json = JSON.stringify(frames);
      const result = codec.decodeText(json);
      expect(result.isBatch).toBe(true);
      expect(result.frames).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should partially decode batch with some invalid frames', () => {
      const batch = [
        { type: 'req', id: 'ok-1', method: 'health.ping' },
        { type: 'garbage' },
        { type: 'res', id: 'ok-2', ok: true },
      ];
      const json = JSON.stringify(batch);
      const result = codec.decodeText(json);
      expect(result.isBatch).toBe(true);
      expect(result.frames).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('batch[1]');
    });

    it('should reject oversized batches', () => {
      const tinyBatchCodec = new MessageCodec({ maxBatchSize: 2 });
      const batch = [
        makeRequestFrame(),
        makeRequestFrame(),
        makeRequestFrame(),
      ];
      const json = JSON.stringify(batch);
      const result = tinyBatchCodec.decodeText(json);
      expect(result.isBatch).toBe(true);
      expect(result.frames).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('exceeds maximum');
    });

    it('should decode an empty array as batch with no frames and no errors', () => {
      const result = codec.decodeText(JSON.stringify([]));
      expect(result.isBatch).toBe(true);
      expect(result.frames).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Encode/decode round trips
  // -------------------------------------------------------------------------

  describe('encode/decode round trips', () => {
    it('should round-trip a single request frame', () => {
      const frame = makeRequestFrame();
      const encoded = codec.encodeFrame(frame);
      const decoded = codec.decodeText(encoded);
      expect(decoded.frames).toHaveLength(1);
      expect(decoded.frames[0].type).toBe('req');
      expect((decoded.frames[0] as any).id).toBe(frame.id);
      expect((decoded.frames[0] as any).method).toBe((frame as any).method);
    });

    it('should round-trip a batch', () => {
      const frames = [makeRequestFrame(), makeEventFrame()];
      const encoded = codec.encodeBatch(frames);
      const decoded = codec.decodeText(encoded);
      expect(decoded.frames).toHaveLength(2);
    });

    it('should round-trip through compression (gzip)', () => {
      const frame = makeRequestFrame({
        params: { data: 'a'.repeat(2000) },
      } as any);

      const encoded = codec.encodeWithCompression(frame, 'gzip');
      expect(encoded.compressed).toBe(true);

      const decoded = codec.decodeCompressed(encoded.data as Buffer, 'gzip');
      expect(decoded.errors).toHaveLength(0);
      expect(decoded.frames).toHaveLength(1);
      expect((decoded.frames[0] as any).id).toBe(frame.id);
    });

    it('should round-trip through compression (deflate)', () => {
      const frame = makeRequestFrame({
        params: { data: 'b'.repeat(2000) },
      } as any);

      const encoded = codec.encodeWithCompression(frame, 'deflate');
      expect(encoded.compressed).toBe(true);

      const decoded = codec.decodeCompressed(encoded.data as Buffer, 'deflate');
      expect(decoded.errors).toHaveLength(0);
      expect(decoded.frames).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Compression
  // -------------------------------------------------------------------------

  describe('compression', () => {
    it('should not compress when payload is below threshold', () => {
      const frame = makeRequestFrame(); // small payload
      const result = codec.encodeWithCompression(frame);
      expect(result.compressed).toBe(false);
      expect(typeof result.data).toBe('string');
      expect(result.originalSize).toBe(result.encodedSize);
    });

    it('should compress when payload exceeds threshold', () => {
      const frame = makeRequestFrame({
        params: { data: 'x'.repeat(2000) },
      } as any);
      const result = codec.encodeWithCompression(frame);
      expect(result.compressed).toBe(true);
      expect(Buffer.isBuffer(result.data)).toBe(true);
      expect(result.encodedSize).toBeLessThan(result.originalSize);
    });

    it('should skip compression when algorithm is "none"', () => {
      const frame = makeRequestFrame({
        params: { data: 'x'.repeat(2000) },
      } as any);
      const result = codec.encodeWithCompression(frame, 'none');
      expect(result.compressed).toBe(false);
      expect(typeof result.data).toBe('string');
    });

    it('should use codec default algorithm when none is specified', () => {
      const deflateCodec = new MessageCodec({
        compressionAlgorithm: 'deflate',
        compressionThreshold: 10,
      });
      const frame = makeRequestFrame({
        params: { data: 'x'.repeat(200) },
      } as any);
      const result = deflateCodec.encodeWithCompression(frame);
      expect(result.compressed).toBe(true);

      // Should decompress with deflate
      const decoded = deflateCodec.decodeCompressed(result.data as Buffer);
      expect(decoded.frames).toHaveLength(1);
    });

    it('should respect a custom compression threshold', () => {
      const highThreshold = new MessageCodec({ compressionThreshold: 100_000 });
      const frame = makeRequestFrame({
        params: { data: 'x'.repeat(2000) },
      } as any);
      const result = highThreshold.encodeWithCompression(frame);
      // 2000 chars < 100KB threshold, so should not compress
      expect(result.compressed).toBe(false);
    });

    it('should throw for oversized frame before compression', () => {
      const tinyCodec = new MessageCodec({ maxMessageBytes: 50 });
      const frame = makeRequestFrame({
        params: { data: 'x'.repeat(200) },
      } as any);
      expect(() => tinyCodec.encodeWithCompression(frame)).toThrow(
        /exceeds size limit/
      );
    });
  });

  // -------------------------------------------------------------------------
  // compress/decompress helpers
  // -------------------------------------------------------------------------

  describe('compress / decompress helpers', () => {
    it('should round-trip gzip', () => {
      const original = Buffer.from('hello, world! '.repeat(100));
      const compressed = codec.compress(original, 'gzip');
      expect(compressed.length).toBeLessThan(original.length);
      const decompressed = codec.decompress(compressed, 'gzip');
      expect(decompressed.toString('utf-8')).toBe(original.toString('utf-8'));
    });

    it('should round-trip deflate', () => {
      const original = Buffer.from('deflate test '.repeat(100));
      const compressed = codec.compress(original, 'deflate');
      const decompressed = codec.decompress(compressed, 'deflate');
      expect(decompressed.toString('utf-8')).toBe(original.toString('utf-8'));
    });

    it('should pass through data unchanged with "none"', () => {
      const original = Buffer.from('unchanged data');
      const result = codec.compress(original, 'none');
      expect(result).toBe(original); // Same reference
      const decompressed = codec.decompress(result, 'none');
      expect(decompressed).toBe(original);
    });

    it('should throw for unsupported compression algorithm', () => {
      const original = Buffer.from('test');
      expect(() => codec.compress(original, 'brotli' as any)).toThrow(
        /unsupported compression/
      );
      expect(() => codec.decompress(original, 'brotli' as any)).toThrow(
        /unsupported decompression/
      );
    });
  });

  // -------------------------------------------------------------------------
  // Size enforcement
  // -------------------------------------------------------------------------

  describe('size enforcement', () => {
    it('should correctly report isWithinSizeLimit', () => {
      const c = new MessageCodec({ maxMessageBytes: 100 });
      expect(c.isWithinSizeLimit(50)).toBe(true);
      expect(c.isWithinSizeLimit(100)).toBe(true);
      expect(c.isWithinSizeLimit(101)).toBe(false);
    });

    it('should expose messageSizeLimit', () => {
      const c = new MessageCodec({ maxMessageBytes: 42 });
      expect(c.messageSizeLimit).toBe(42);
    });
  });

  // -------------------------------------------------------------------------
  // Binary frame encoding / decoding
  // -------------------------------------------------------------------------

  describe('binary frame encoding', () => {
    const correlationId = randomUUID();
    const metadata: BinaryMetadata = {
      method: 'file.upload',
      contentType: 'application/octet-stream',
      filename: 'test.bin',
    };
    const payload = Buffer.from('binary payload data');

    it('should encode and decode a binary frame correctly', () => {
      const encoded = codec.encodeBinary(correlationId, metadata, payload);

      expect(Buffer.isBuffer(encoded)).toBe(true);
      expect(encoded.length).toBeGreaterThan(BINARY_HEADER_FIXED_SIZE);

      const decoded = codec.decodeBinary(encoded);
      expect(decoded.correlationId).toBe(correlationId);
      expect(decoded.metadata.method).toBe('file.upload');
      expect(decoded.metadata.contentType).toBe('application/octet-stream');
      expect(decoded.metadata.filename).toBe('test.bin');
      expect(decoded.payload.toString('utf-8')).toBe('binary payload data');
    });

    it('should set flags correctly', () => {
      const encoded = codec.encodeBinary(correlationId, metadata, payload, {
        compressed: true,
        chunked: true,
        final: true,
      });

      const decoded = codec.decodeBinary(encoded);
      expect(decoded.compressed).toBe(true);
      expect(decoded.chunked).toBe(true);
      expect(decoded.final).toBe(true);
      expect(decoded.flags).toBe(
        BinaryFlags.COMPRESSED | BinaryFlags.CHUNKED | BinaryFlags.FINAL
      );
    });

    it('should default all flags to false', () => {
      const encoded = codec.encodeBinary(correlationId, metadata, payload);
      const decoded = codec.decodeBinary(encoded);
      expect(decoded.compressed).toBe(false);
      expect(decoded.chunked).toBe(false);
      expect(decoded.final).toBe(false);
      expect(decoded.flags).toBe(0);
    });

    it('should handle empty metadata', () => {
      const encoded = codec.encodeBinary(correlationId, {}, payload);
      const decoded = codec.decodeBinary(encoded);
      expect(decoded.correlationId).toBe(correlationId);
      expect(decoded.payload.toString('utf-8')).toBe('binary payload data');
    });

    it('should handle empty payload', () => {
      const encoded = codec.encodeBinary(
        correlationId,
        metadata,
        Buffer.alloc(0)
      );
      const decoded = codec.decodeBinary(encoded);
      expect(decoded.payload.length).toBe(0);
      expect(decoded.metadata.method).toBe('file.upload');
    });

    it('should preserve the UUID format through encode/decode', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const encoded = codec.encodeBinary(uuid, {}, Buffer.alloc(0));
      const decoded = codec.decodeBinary(encoded);
      expect(decoded.correlationId).toBe(uuid);
    });

    it('should throw for invalid correlationId (wrong byte count)', () => {
      expect(() =>
        codec.encodeBinary('invalid-uuid', {}, Buffer.alloc(0))
      ).toThrow(/invalid correlationId/);
    });

    it('should throw for oversized binary frame', () => {
      const tinyCodec = new MessageCodec({ maxMessageBytes: 50 });
      const bigPayload = Buffer.alloc(100);
      expect(() =>
        tinyCodec.encodeBinary(correlationId, metadata, bigPayload)
      ).toThrow(/exceeds size limit/);
    });
  });

  describe('binary frame decoding', () => {
    it('should throw for frame shorter than fixed header', () => {
      const tooShort = Buffer.alloc(10);
      expect(() => codec.decodeBinary(tooShort)).toThrow(
        /binary frame too short/
      );
    });

    it('should throw for unsupported binary header version', () => {
      const buf = Buffer.alloc(BINARY_HEADER_FIXED_SIZE + 10);
      buf.writeUInt8(99, 0); // bad version
      expect(() => codec.decodeBinary(buf)).toThrow(
        /unsupported binary header version/
      );
    });

    it('should throw for truncated metadata', () => {
      // Write a valid header but claim 1000 bytes of metadata in a short buffer
      const buf = Buffer.alloc(BINARY_HEADER_FIXED_SIZE + 5);
      buf.writeUInt8(BINARY_HEADER_VERSION, 0); // version
      buf.writeUInt8(0, 1); // flags
      // Write a UUID (16 zero bytes at offset 2)
      buf.writeUInt32BE(1000, 18); // metaLen = 1000 (but buffer is too short)
      expect(() => codec.decodeBinary(buf)).toThrow(/metadata truncated/);
    });

    it('should handle zero-length metadata', () => {
      const correlationId = randomUUID();
      const payload = Buffer.from('test');
      // Encode a frame with empty metadata to test the zero-length path
      const encoded = codec.encodeBinary(correlationId, {}, payload);
      const decoded = codec.decodeBinary(encoded);
      expect(decoded.metadata).toBeDefined();
      expect(decoded.payload.toString('utf-8')).toBe('test');
    });
  });

  // -------------------------------------------------------------------------
  // Static helpers
  // -------------------------------------------------------------------------

  describe('MessageCodec.newCorrelationId', () => {
    it('should return a valid UUID string', () => {
      const id = MessageCodec.newCorrelationId();
      // UUID v4 pattern
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it('should return unique IDs', () => {
      const ids = new Set(
        Array.from({ length: 100 }, () => MessageCodec.newCorrelationId())
      );
      expect(ids.size).toBe(100);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('should handle frames with undefined optional params', () => {
      const frame: ProtocolFrame = {
        type: 'req',
        id: 'edge-1',
        method: 'health.ping',
      };
      const json = codec.encodeFrame(frame);
      const decoded = codec.decodeText(json);
      expect(decoded.frames).toHaveLength(1);
      expect(decoded.errors).toHaveLength(0);
    });

    it('should handle frames with complex nested payloads', () => {
      const frame: ProtocolFrame = {
        type: 'res',
        id: 'edge-2',
        ok: true,
        payload: {
          nested: {
            array: [1, 2, { deep: true }],
            nullVal: null,
            unicode: '\u00e9\u00e8\u00ea',
          },
        },
      };
      const json = codec.encodeFrame(frame);
      const decoded = codec.decodeText(json);
      expect(decoded.frames).toHaveLength(1);
      const p = (decoded.frames[0] as any).payload;
      expect(p.nested.array).toEqual([1, 2, { deep: true }]);
      expect(p.nested.unicode).toBe('\u00e9\u00e8\u00ea');
    });

    it('should decode a compressed empty frame array', () => {
      const json = JSON.stringify([]);
      const compressed = gzipSync(Buffer.from(json, 'utf-8'));
      const result = codec.decodeCompressed(compressed, 'gzip');
      expect(result.isBatch).toBe(true);
      expect(result.frames).toHaveLength(0);
    });

    it('should handle large binary payloads', () => {
      const correlationId = randomUUID();
      const bigPayload = Buffer.alloc(100_000, 0xab);
      const encoded = codec.encodeBinary(
        correlationId,
        { method: 'file.upload' },
        bigPayload
      );
      const decoded = codec.decodeBinary(encoded);
      expect(decoded.payload.length).toBe(100_000);
      expect(decoded.payload[0]).toBe(0xab);
      expect(decoded.payload[99_999]).toBe(0xab);
    });
  });
});
