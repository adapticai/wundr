/**
 * Mock S3 Client
 *
 * Provides mock implementations of AWS S3 operations for testing.
 *
 * @module @genesis/core/test-utils/mock-s3
 */

import { vi, type Mock } from 'vitest';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * S3 PutObject command input
 */
export interface PutObjectInput {
  Bucket: string;
  Key: string;
  Body: Buffer | string;
  ContentType?: string;
  Metadata?: Record<string, string>;
  ACL?: string;
  CacheControl?: string;
  ContentDisposition?: string;
}

/**
 * S3 PutObject command output
 */
export interface PutObjectOutput {
  ETag?: string;
  VersionId?: string;
}

/**
 * S3 GetObject command input
 */
export interface GetObjectInput {
  Bucket: string;
  Key: string;
  Range?: string;
}

/**
 * S3 GetObject command output
 */
export interface GetObjectOutput {
  Body?: Buffer | string;
  ContentType?: string;
  ContentLength?: number;
  ETag?: string;
  Metadata?: Record<string, string>;
}

/**
 * S3 DeleteObject command input
 */
export interface DeleteObjectInput {
  Bucket: string;
  Key: string;
  VersionId?: string;
}

/**
 * S3 DeleteObject command output
 */
export interface DeleteObjectOutput {
  DeleteMarker?: boolean;
  VersionId?: string;
}

/**
 * S3 HeadObject command input
 */
export interface HeadObjectInput {
  Bucket: string;
  Key: string;
}

/**
 * S3 HeadObject command output
 */
export interface HeadObjectOutput {
  ContentType?: string;
  ContentLength?: number;
  ETag?: string;
  Metadata?: Record<string, string>;
  LastModified?: Date;
}

/**
 * S3 ListObjects command input
 */
export interface ListObjectsInput {
  Bucket: string;
  Prefix?: string;
  MaxKeys?: number;
  ContinuationToken?: string;
}

/**
 * S3 Object in list response
 */
export interface S3Object {
  Key?: string;
  Size?: number;
  LastModified?: Date;
  ETag?: string;
}

/**
 * S3 ListObjects command output
 */
export interface ListObjectsOutput {
  Contents?: S3Object[];
  IsTruncated?: boolean;
  NextContinuationToken?: string;
}

/**
 * S3 CreateMultipartUpload command input
 */
export interface CreateMultipartUploadInput {
  Bucket: string;
  Key: string;
  ContentType?: string;
  Metadata?: Record<string, string>;
}

/**
 * S3 CreateMultipartUpload command output
 */
export interface CreateMultipartUploadOutput {
  UploadId?: string;
  Key?: string;
  Bucket?: string;
}

/**
 * S3 UploadPart command input
 */
export interface UploadPartInput {
  Bucket: string;
  Key: string;
  UploadId: string;
  PartNumber: number;
  Body: Buffer | string;
}

/**
 * S3 UploadPart command output
 */
export interface UploadPartOutput {
  ETag?: string;
}

/**
 * S3 Completed part for multipart upload
 */
export interface S3CompletedPart {
  PartNumber: number;
  ETag?: string;
}

/**
 * S3 CompleteMultipartUpload command input
 */
export interface CompleteMultipartUploadInput {
  Bucket: string;
  Key: string;
  UploadId: string;
  MultipartUpload?: {
    Parts?: S3CompletedPart[];
  };
}

/**
 * S3 CompleteMultipartUpload command output
 */
export interface CompleteMultipartUploadOutput {
  Location?: string;
  Bucket?: string;
  Key?: string;
  ETag?: string;
}

/**
 * S3 AbortMultipartUpload command input
 */
export interface AbortMultipartUploadInput {
  Bucket: string;
  Key: string;
  UploadId: string;
}

/**
 * S3 AbortMultipartUpload command output
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface AbortMultipartUploadOutput {
  // Empty on success
}

/**
 * S3 CopyObject command input
 */
export interface CopyObjectInput {
  Bucket: string;
  Key: string;
  CopySource: string;
  MetadataDirective?: 'COPY' | 'REPLACE';
  Metadata?: Record<string, string>;
}

/**
 * S3 CopyObject command output
 */
export interface CopyObjectOutput {
  CopyObjectResult?: {
    ETag?: string;
    LastModified?: Date;
  };
}

/**
 * Mock S3 Client interface
 */
export interface MockS3Client {
  putObject: Mock;
  getObject: Mock;
  deleteObject: Mock;
  headObject: Mock;
  listObjects: Mock;
  createMultipartUpload: Mock;
  uploadPart: Mock;
  completeMultipartUpload: Mock;
  abortMultipartUpload: Mock;
  copyObject: Mock;
}

// =============================================================================
// MOCK S3 CLIENT FACTORY
// =============================================================================

/**
 * Creates a mock S3 client for testing
 *
 * @returns Mock S3 client with all operations mocked
 *
 * @example
 * ```typescript
 * const mockS3 = createMockS3Client();
 *
 * // Configure specific responses
 * mockS3.putObject.mockResolvedValue({ ETag: '"abc123"' });
 *
 * // Use in tests
 * await storageService.uploadFile('key', buffer, { contentType: 'image/png' });
 *
 * expect(mockS3.putObject).toHaveBeenCalledWith(
 *   expect.objectContaining({ Key: 'key' })
 * );
 * ```
 */
export function createMockS3Client(): MockS3Client {
  return {
    /**
     * Mock putObject - upload file to S3
     */
    putObject: vi.fn().mockResolvedValue({
      ETag: `"${generateMockETag()}"`,
    }),

    /**
     * Mock getObject - download file from S3
     */
    getObject: vi.fn().mockResolvedValue({
      Body: Buffer.from('mock file content'),
      ContentType: 'application/octet-stream',
      ContentLength: 17,
      ETag: `"${generateMockETag()}"`,
    }),

    /**
     * Mock deleteObject - delete file from S3
     */
    deleteObject: vi.fn().mockResolvedValue({
      DeleteMarker: false,
    }),

    /**
     * Mock headObject - get file metadata without body
     */
    headObject: vi.fn().mockResolvedValue({
      ContentType: 'application/octet-stream',
      ContentLength: 1024,
      ETag: `"${generateMockETag()}"`,
      LastModified: new Date(),
    }),

    /**
     * Mock listObjects - list files with prefix
     */
    listObjects: vi.fn().mockResolvedValue({
      Contents: [],
      IsTruncated: false,
    }),

    /**
     * Mock createMultipartUpload - initiate multipart upload
     */
    createMultipartUpload: vi
      .fn()
      .mockImplementation((input: CreateMultipartUploadInput) =>
        Promise.resolve({
          UploadId: `upload_${generateMockId()}`,
          Key: input.Key,
          Bucket: input.Bucket,
        })
      ),

    /**
     * Mock uploadPart - upload part of multipart upload
     */
    uploadPart: vi.fn().mockImplementation(() =>
      Promise.resolve({
        ETag: `"${generateMockETag()}"`,
      })
    ),

    /**
     * Mock completeMultipartUpload - complete multipart upload
     */
    completeMultipartUpload: vi
      .fn()
      .mockImplementation((input: CompleteMultipartUploadInput) =>
        Promise.resolve({
          Location: `https://${input.Bucket}.s3.amazonaws.com/${input.Key}`,
          Bucket: input.Bucket,
          Key: input.Key,
          ETag: `"${generateMockETag()}"`,
        })
      ),

    /**
     * Mock abortMultipartUpload - cancel multipart upload
     */
    abortMultipartUpload: vi.fn().mockResolvedValue({}),

    /**
     * Mock copyObject - copy file within S3
     */
    copyObject: vi.fn().mockResolvedValue({
      CopyObjectResult: {
        ETag: `"${generateMockETag()}"`,
        LastModified: new Date(),
      },
    }),
  };
}

// =============================================================================
// MOCK S3 RESPONSE HELPERS
// =============================================================================

/**
 * Creates a mock S3 response with specified properties
 *
 * @param overrides - Properties to override in the response
 * @returns Mock response object
 */
export function createMockS3Response<T extends Record<string, unknown>>(
  overrides: Partial<T> = {}
): T {
  return {
    ...overrides,
  } as T;
}

/**
 * Creates mock S3 object for list responses
 *
 * @param key - Object key
 * @param overrides - Additional properties
 * @returns Mock S3 object
 */
export function createMockS3Object(
  key: string,
  overrides: Partial<S3Object> = {}
): S3Object {
  return {
    Key: key,
    Size: 1024,
    LastModified: new Date(),
    ETag: `"${generateMockETag()}"`,
    ...overrides,
  };
}

/**
 * Creates mock list objects response
 *
 * @param keys - Array of object keys
 * @param isTruncated - Whether the list is truncated
 * @returns Mock list objects response
 */
export function createMockListResponse(
  keys: string[],
  isTruncated = false
): ListObjectsOutput {
  return {
    Contents: keys.map(key => createMockS3Object(key)),
    IsTruncated: isTruncated,
    NextContinuationToken: isTruncated ? 'mock_continuation_token' : undefined,
  };
}

// =============================================================================
// MOCK S3 ERROR HELPERS
// =============================================================================

/**
 * S3 error types for testing error handling
 */
export const S3ErrorTypes = {
  NoSuchKey: 'NoSuchKey',
  NoSuchBucket: 'NoSuchBucket',
  AccessDenied: 'AccessDenied',
  InvalidAccessKeyId: 'InvalidAccessKeyId',
  SignatureDoesNotMatch: 'SignatureDoesNotMatch',
  NoSuchUpload: 'NoSuchUpload',
  EntityTooLarge: 'EntityTooLarge',
  InvalidPart: 'InvalidPart',
  InvalidPartOrder: 'InvalidPartOrder',
  ServiceUnavailable: 'ServiceUnavailable',
} as const;

export type S3ErrorType = (typeof S3ErrorTypes)[keyof typeof S3ErrorTypes];

/**
 * Creates a mock S3 error
 *
 * @param type - Error type
 * @param message - Error message
 * @returns S3 error object
 */
export function createMockS3Error(
  type: S3ErrorType,
  message?: string
): Error & { code: string; statusCode: number } {
  const statusCodes: Record<S3ErrorType, number> = {
    NoSuchKey: 404,
    NoSuchBucket: 404,
    AccessDenied: 403,
    InvalidAccessKeyId: 403,
    SignatureDoesNotMatch: 403,
    NoSuchUpload: 404,
    EntityTooLarge: 400,
    InvalidPart: 400,
    InvalidPartOrder: 400,
    ServiceUnavailable: 503,
  };

  const defaultMessages: Record<S3ErrorType, string> = {
    NoSuchKey: 'The specified key does not exist.',
    NoSuchBucket: 'The specified bucket does not exist.',
    AccessDenied: 'Access Denied',
    InvalidAccessKeyId:
      'The AWS Access Key Id you provided does not exist in our records.',
    SignatureDoesNotMatch:
      'The request signature we calculated does not match the signature you provided.',
    NoSuchUpload: 'The specified upload does not exist.',
    EntityTooLarge: 'Your proposed upload exceeds the maximum allowed size.',
    InvalidPart: 'One or more of the specified parts could not be found.',
    InvalidPartOrder: 'The list of parts was not in ascending order.',
    ServiceUnavailable: 'Service is temporarily unavailable.',
  };

  const error = new Error(message ?? defaultMessages[type]) as Error & {
    code: string;
    statusCode: number;
  };
  error.code = type;
  error.statusCode = statusCodes[type];

  return error;
}

// =============================================================================
// MOCK PRESIGNED URL HELPERS
// =============================================================================

/**
 * Creates a mock presigned URL for upload
 *
 * @param bucket - S3 bucket name
 * @param key - Object key
 * @param expiresIn - Expiration time in seconds
 * @returns Mock presigned URL
 */
export function createMockPresignedUploadUrl(
  bucket: string,
  key: string,
  expiresIn = 3600
): string {
  const expires = Date.now() + expiresIn * 1000;
  return `https://${bucket}.s3.amazonaws.com/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=mock&X-Amz-Date=mock&X-Amz-Expires=${expiresIn}&X-Amz-SignedHeaders=host&X-Amz-Signature=mock_signature_${expires}`;
}

/**
 * Creates a mock presigned URL for download
 *
 * @param bucket - S3 bucket name
 * @param key - Object key
 * @param expiresIn - Expiration time in seconds
 * @returns Mock presigned download URL
 */
export function createMockPresignedDownloadUrl(
  bucket: string,
  key: string,
  expiresIn = 3600
): string {
  return `https://${bucket}.s3.amazonaws.com/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=mock&X-Amz-Date=mock&X-Amz-Expires=${expiresIn}&X-Amz-SignedHeaders=host&X-Amz-Signature=mock_signature`;
}

/**
 * Creates mock presigned POST fields
 *
 * @param bucket - S3 bucket name
 * @param key - Object key
 * @param conditions - Additional conditions
 * @returns Mock presigned POST fields
 */
export function createMockPresignedPostFields(
  bucket: string,
  key: string,
  conditions: Record<string, string> = {}
): Record<string, string> {
  const dateStr = new Date().toISOString().replace(/[:-]/g, '').split('.')[0];
  return {
    key,
    bucket,
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': 'mock_credential',
    'X-Amz-Date': dateStr ? `${dateStr}Z` : '',
    'X-Amz-Signature': 'mock_signature',
    Policy: Buffer.from(JSON.stringify({ conditions: [] })).toString('base64'),
    ...conditions,
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Generates a mock ETag (MD5-like hash)
 */
function generateMockETag(): string {
  const chars = '0123456789abcdef';
  let etag = '';
  for (let i = 0; i < 32; i++) {
    etag += chars[Math.floor(Math.random() * chars.length)];
  }
  return etag;
}

/**
 * Generates a mock ID
 */
function generateMockId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Resets all mocks on an S3 client
 *
 * @param client - Mock S3 client to reset
 */
export function resetMockS3Client(client: MockS3Client): void {
  Object.values(client).forEach(mock => {
    if (typeof mock === 'function' && 'mockReset' in mock) {
      (mock as Mock).mockReset();
    }
  });
}

// =============================================================================
// EXPORTS
// =============================================================================

export default createMockS3Client;
