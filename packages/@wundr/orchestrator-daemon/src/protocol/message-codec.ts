/**
 * Message Codec
 *
 * Handles message serialization, compression, size enforcement, and
 * batch encoding/decoding for the protocol v2 wire format.
 *
 * Compression: Uses Node's built-in zlib for gzip/deflate. Compression
 * is applied transparently when a message exceeds a configurable
 * threshold and the client has negotiated compression support.
 *
 * Batching: Multiple messages can be sent in a single WebSocket frame
 * as a JSON array. The codec handles both single-message and batched
 * formats transparently.
 *
 * Binary encoding: Provides helpers to construct and parse the binary
 * frame header format defined in protocol-v2.ts.
 */

import { randomUUID } from 'node:crypto';
import { deflateSync, gunzipSync, gzipSync, inflateSync } from 'node:zlib';

import {
  type BinaryMetadata,
  type ProtocolFrame,
  BINARY_HEADER_FIXED_SIZE,
  BINARY_HEADER_VERSION,
  BinaryFlags,
  BinaryMetadataSchema,
  MAX_PAYLOAD_BYTES,
  ProtocolFrameSchema,
} from './protocol-v2';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CompressionAlgorithm = 'gzip' | 'deflate' | 'none';

export interface CodecConfig {
  /** Maximum allowed message size in bytes. Default: MAX_PAYLOAD_BYTES (10 MiB). */
  maxMessageBytes?: number;
  /** Minimum message size before compression is attempted (bytes). Default: 1024. */
  compressionThreshold?: number;
  /** Preferred compression algorithm. Default: 'gzip'. */
  compressionAlgorithm?: CompressionAlgorithm;
  /** Maximum number of frames in a single batch. Default: 50. */
  maxBatchSize?: number;
}

export interface EncodeResult {
  data: string | Buffer;
  compressed: boolean;
  originalSize: number;
  encodedSize: number;
}

export interface DecodeTextResult {
  frames: ProtocolFrame[];
  isBatch: boolean;
  errors: string[];
}

export interface DecodeBinaryResult {
  correlationId: string;
  flags: number;
  compressed: boolean;
  chunked: boolean;
  final: boolean;
  metadata: BinaryMetadata;
  payload: Buffer;
}

// ---------------------------------------------------------------------------
// MessageCodec
// ---------------------------------------------------------------------------

export class MessageCodec {
  private maxMessageBytes: number;
  private compressionThreshold: number;
  private compressionAlgorithm: CompressionAlgorithm;
  private maxBatchSize: number;

  constructor(config?: CodecConfig) {
    this.maxMessageBytes = config?.maxMessageBytes ?? MAX_PAYLOAD_BYTES;
    this.compressionThreshold = config?.compressionThreshold ?? 1024;
    this.compressionAlgorithm = config?.compressionAlgorithm ?? 'gzip';
    this.maxBatchSize = config?.maxBatchSize ?? 50;
  }

  // -----------------------------------------------------------------------
  // Text message encoding
  // -----------------------------------------------------------------------

  /**
   * Encode a single frame to a JSON string.
   *
   * @throws {Error} if the encoded message exceeds the size limit.
   */
  encodeFrame(frame: ProtocolFrame): string {
    const json = JSON.stringify(frame);
    this.enforceSize(json.length, 'outbound frame');
    return json;
  }

  /**
   * Encode a batch of frames to a JSON array string.
   *
   * @throws {Error} if the batch exceeds the size or count limit.
   */
  encodeBatch(frames: ProtocolFrame[]): string {
    if (frames.length > this.maxBatchSize) {
      throw new Error(
        `batch size ${frames.length} exceeds maximum of ${this.maxBatchSize}`,
      );
    }
    if (frames.length === 0) {
      throw new Error('batch must contain at least one frame');
    }
    if (frames.length === 1) {
      return this.encodeFrame(frames[0]);
    }
    const json = JSON.stringify(frames);
    this.enforceSize(json.length, 'outbound batch');
    return json;
  }

  /**
   * Encode a frame with optional compression.
   *
   * Returns a Buffer if compressed, a string otherwise.
   */
  encodeWithCompression(
    frame: ProtocolFrame,
    algorithm?: CompressionAlgorithm,
  ): EncodeResult {
    const json = JSON.stringify(frame);
    const originalSize = Buffer.byteLength(json, 'utf-8');

    this.enforceSize(originalSize, 'outbound frame');

    const algo = algorithm ?? this.compressionAlgorithm;
    if (algo === 'none' || originalSize < this.compressionThreshold) {
      return {
        data: json,
        compressed: false,
        originalSize,
        encodedSize: originalSize,
      };
    }

    const compressed = this.compress(Buffer.from(json, 'utf-8'), algo);
    return {
      data: compressed,
      compressed: true,
      originalSize,
      encodedSize: compressed.length,
    };
  }

  // -----------------------------------------------------------------------
  // Text message decoding
  // -----------------------------------------------------------------------

  /**
   * Decode a raw text message into one or more protocol frames.
   *
   * Supports both single-frame JSON objects and batched JSON arrays.
   */
  decodeText(data: string): DecodeTextResult {
    this.enforceSize(Buffer.byteLength(data, 'utf-8'), 'inbound message');

    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      return { frames: [], isBatch: false, errors: ['malformed JSON'] };
    }

    // Batch: JSON array
    if (Array.isArray(parsed)) {
      if (parsed.length > this.maxBatchSize) {
        return {
          frames: [],
          isBatch: true,
          errors: [`batch size ${parsed.length} exceeds maximum of ${this.maxBatchSize}`],
        };
      }
      return this.decodeBatchArray(parsed);
    }

    // Single frame
    const result = ProtocolFrameSchema.safeParse(parsed);
    if (!result.success) {
      const errorDetails = result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      return { frames: [], isBatch: false, errors: [errorDetails] };
    }

    return { frames: [result.data], isBatch: false, errors: [] };
  }

  /**
   * Decode a compressed message buffer.
   */
  decodeCompressed(data: Buffer, algorithm?: CompressionAlgorithm): DecodeTextResult {
    const algo = algorithm ?? this.compressionAlgorithm;
    const decompressed = this.decompress(data, algo);
    return this.decodeText(decompressed.toString('utf-8'));
  }

  // -----------------------------------------------------------------------
  // Binary frame encoding
  // -----------------------------------------------------------------------

  /**
   * Encode a binary frame with the protocol's binary header format.
   *
   * @param correlationId - UUID linking this binary frame to an RPC request.
   * @param metadata - Structured metadata (method, content type, etc.).
   * @param payload - The raw binary payload.
   * @param opts - Optional flags (compressed, chunked, final).
   */
  encodeBinary(
    correlationId: string,
    metadata: BinaryMetadata,
    payload: Buffer,
    opts?: { compressed?: boolean; chunked?: boolean; final?: boolean },
  ): Buffer {
    const metaJson = JSON.stringify(metadata);
    const metaBuffer = Buffer.from(metaJson, 'utf-8');

    let flags = 0;
    if (opts?.compressed) {
flags |= BinaryFlags.COMPRESSED;
}
    if (opts?.chunked) {
flags |= BinaryFlags.CHUNKED;
}
    if (opts?.final) {
flags |= BinaryFlags.FINAL;
}

    // Parse UUID to 16 bytes
    const uuidHex = correlationId.replace(/-/g, '');
    const uuidBuffer = Buffer.from(uuidHex, 'hex');
    if (uuidBuffer.length !== 16) {
      throw new Error(`invalid correlationId: expected 16 bytes, got ${uuidBuffer.length}`);
    }

    const totalSize = BINARY_HEADER_FIXED_SIZE + metaBuffer.length + payload.length;
    this.enforceSize(totalSize, 'outbound binary frame');

    const result = Buffer.allocUnsafe(totalSize);
    let offset = 0;

    // Version (1 byte)
    result.writeUInt8(BINARY_HEADER_VERSION, offset);
    offset += 1;

    // Flags (1 byte)
    result.writeUInt8(flags, offset);
    offset += 1;

    // Correlation ID (16 bytes)
    uuidBuffer.copy(result, offset);
    offset += 16;

    // Metadata length (4 bytes, big-endian)
    result.writeUInt32BE(metaBuffer.length, offset);
    offset += 4;

    // Metadata JSON
    metaBuffer.copy(result, offset);
    offset += metaBuffer.length;

    // Payload
    payload.copy(result, offset);

    return result;
  }

  /**
   * Decode a binary frame.
   */
  decodeBinary(data: Buffer): DecodeBinaryResult {
    if (data.length < BINARY_HEADER_FIXED_SIZE) {
      throw new Error(
        `binary frame too short: ${data.length} bytes, minimum ${BINARY_HEADER_FIXED_SIZE}`,
      );
    }

    const version = data.readUInt8(0);
    if (version !== BINARY_HEADER_VERSION) {
      throw new Error(`unsupported binary header version: ${version}`);
    }

    const flags = data.readUInt8(1);
    const uuidHex = data.subarray(2, 18).toString('hex');
    const correlationId = [
      uuidHex.slice(0, 8),
      uuidHex.slice(8, 12),
      uuidHex.slice(12, 16),
      uuidHex.slice(16, 20),
      uuidHex.slice(20, 32),
    ].join('-');

    const metaLen = data.readUInt32BE(18);
    const metaEnd = BINARY_HEADER_FIXED_SIZE + metaLen;

    if (data.length < metaEnd) {
      throw new Error(`binary frame metadata truncated: need ${metaEnd} bytes, got ${data.length}`);
    }

    let metadata: BinaryMetadata = {};
    if (metaLen > 0) {
      const metaJson = data.subarray(BINARY_HEADER_FIXED_SIZE, metaEnd).toString('utf-8');
      const parsed = JSON.parse(metaJson);
      const result = BinaryMetadataSchema.safeParse(parsed);
      metadata = result.success ? result.data : parsed;
    }

    const payload = data.subarray(metaEnd);

    return {
      correlationId,
      flags,
      compressed: (flags & BinaryFlags.COMPRESSED) !== 0,
      chunked: (flags & BinaryFlags.CHUNKED) !== 0,
      final: (flags & BinaryFlags.FINAL) !== 0,
      metadata,
      payload,
    };
  }

  /**
   * Generate a new correlation ID for binary frames.
   */
  static newCorrelationId(): string {
    return randomUUID();
  }

  // -----------------------------------------------------------------------
  // Compression helpers
  // -----------------------------------------------------------------------

  compress(data: Buffer, algorithm?: CompressionAlgorithm): Buffer {
    const algo = algorithm ?? this.compressionAlgorithm;
    switch (algo) {
      case 'gzip':
        return gzipSync(data);
      case 'deflate':
        return deflateSync(data);
      case 'none':
        return data;
      default:
        throw new Error(`unsupported compression algorithm: ${algo}`);
    }
  }

  decompress(data: Buffer, algorithm?: CompressionAlgorithm): Buffer {
    const algo = algorithm ?? this.compressionAlgorithm;
    switch (algo) {
      case 'gzip':
        return gunzipSync(data);
      case 'deflate':
        return inflateSync(data);
      case 'none':
        return data;
      default:
        throw new Error(`unsupported decompression algorithm: ${algo}`);
    }
  }

  // -----------------------------------------------------------------------
  // Size enforcement
  // -----------------------------------------------------------------------

  /**
   * Check whether a message size is within the configured limit.
   */
  isWithinSizeLimit(sizeBytes: number): boolean {
    return sizeBytes <= this.maxMessageBytes;
  }

  get messageSizeLimit(): number {
    return this.maxMessageBytes;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private enforceSize(sizeBytes: number, context: string): void {
    if (sizeBytes > this.maxMessageBytes) {
      throw new Error(
        `${context} exceeds size limit: ${sizeBytes} bytes > ${this.maxMessageBytes} bytes`,
      );
    }
  }

  private decodeBatchArray(items: unknown[]): DecodeTextResult {
    const frames: ProtocolFrame[] = [];
    const errors: string[] = [];

    for (let i = 0; i < items.length; i++) {
      const result = ProtocolFrameSchema.safeParse(items[i]);
      if (result.success) {
        frames.push(result.data);
      } else {
        const errorDetails = result.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        errors.push(`batch[${i}]: ${errorDetails}`);
      }
    }

    return { frames, isBatch: true, errors };
  }
}
