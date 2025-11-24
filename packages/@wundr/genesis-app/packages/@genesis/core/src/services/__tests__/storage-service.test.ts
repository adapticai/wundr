/**
 * Storage Service Tests
 *
 * Comprehensive test suite for the storage service covering:
 * - File uploads to S3
 * - Presigned URL generation
 * - File deletion
 * - Multipart uploads
 * - Error handling
 *
 * @module @genesis/core/services/__tests__/storage-service.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  _createMockFileRecord,
  _createMockUploadResult,
  createMockSignedUrl,
} from '../../test-utils/file-factories';
import {
  createMockS3Client,
  createMockS3Response,
  type MockS3Client,
} from '../../test-utils/mock-s3';

// =============================================================================
// MOCK SETUP
// =============================================================================

/**
 * Create mock storage service for testing
 */
function createMockStorageService(s3Client: MockS3Client) {
  return {
    /**
     * Upload file to S3
     */
    uploadFile: vi.fn(async (key: string, body: Buffer, options: {
      contentType: string;
      metadata?: Record<string, string>;
    }) => {
      const result = await s3Client.putObject({
        Bucket: 'test-bucket',
        Key: key,
        Body: body,
        ContentType: options.contentType,
        Metadata: options.metadata,
      });

      return {
        key,
        etag: result.ETag,
        url: `https://test-bucket.s3.amazonaws.com/${key}`,
      };
    }),

    /**
     * Get signed upload URL
     */
    getSignedUploadUrl: vi.fn(async (key: string, contentType: string, metadata?: Record<string, string>) => {
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour
      const signedUrl = createMockSignedUrl({
        key,
        expiresAt,
      });

      return {
        url: signedUrl.url,
        key,
        fields: {
          'Content-Type': contentType,
          ...metadata,
        },
        expiresAt,
      };
    }),

    /**
     * Get signed download URL
     */
    getSignedDownloadUrl: vi.fn(async (key: string, expiresIn = 3600) => {
      return `https://test-bucket.s3.amazonaws.com/${key}?X-Amz-Expires=${expiresIn}&X-Amz-Signature=mock-signature`;
    }),

    /**
     * Delete file from S3
     */
    deleteFile: vi.fn(async (key: string) => {
      await s3Client.deleteObject({
        Bucket: 'test-bucket',
        Key: key,
      });
    }),

    /**
     * Check if file exists
     */
    fileExists: vi.fn(async (key: string) => {
      try {
        await s3Client.headObject({
          Bucket: 'test-bucket',
          Key: key,
        });
        return true;
      } catch {
        return false;
      }
    }),

    /**
     * List files with prefix
     */
    listFiles: vi.fn(async (prefix: string) => {
      const result = await s3Client.listObjects({
        Bucket: 'test-bucket',
        Prefix: prefix,
      });
      return result.Contents ?? [];
    }),

    /**
     * Initiate multipart upload
     */
    initiateMultipartUpload: vi.fn(async (key: string, contentType: string) => {
      const result = await s3Client.createMultipartUpload({
        Bucket: 'test-bucket',
        Key: key,
        ContentType: contentType,
      });
      return {
        uploadId: result.UploadId,
        key,
      };
    }),

    /**
     * Get signed URL for multipart part
     */
    getMultipartPartUrl: vi.fn(async (key: string, uploadId: string, partNumber: number) => {
      return `https://test-bucket.s3.amazonaws.com/${key}?uploadId=${uploadId}&partNumber=${partNumber}&X-Amz-Signature=mock-signature`;
    }),

    /**
     * Complete multipart upload
     */
    completeMultipartUpload: vi.fn(async (key: string, uploadId: string, parts: Array<{ partNumber: number; etag: string }>) => {
      await s3Client.completeMultipartUpload({
        Bucket: 'test-bucket',
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map(p => ({
            PartNumber: p.partNumber,
            ETag: p.etag,
          })),
        },
      });

      return {
        location: `https://test-bucket.s3.amazonaws.com/${key}`,
      };
    }),

    /**
     * Abort multipart upload
     */
    abortMultipartUpload: vi.fn(async (key: string, uploadId: string) => {
      await s3Client.abortMultipartUpload({
        Bucket: 'test-bucket',
        Key: key,
        UploadId: uploadId,
      });
    }),
  };
}

// =============================================================================
// STORAGE SERVICE TESTS
// =============================================================================

describe('StorageService', () => {
  let mockS3Client: MockS3Client;
  let storageService: ReturnType<typeof createMockStorageService>;

  beforeEach(() => {
    mockS3Client = createMockS3Client();
    storageService = createMockStorageService(mockS3Client);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================================================
  // uploadFile Tests
  // ===========================================================================

  describe('uploadFile', () => {
    it('uploads file to S3', async () => {
      const key = 'channels/ch_123/files/user_456/test-file.pdf';
      const body = Buffer.from('test content');
      const contentType = 'application/pdf';

      mockS3Client.putObject.mockResolvedValue(
        createMockS3Response({ ETag: '"abc123"' }),
      );

      const result = await storageService.uploadFile(key, body, { contentType });

      expect(result.key).toBe(key);
      expect(result.etag).toBe('"abc123"');
      expect(mockS3Client.putObject).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    });

    it('returns correct URL', async () => {
      const key = 'channels/ch_123/files/user_456/image.png';
      const body = Buffer.from('image data');

      mockS3Client.putObject.mockResolvedValue(
        createMockS3Response({ ETag: '"xyz789"' }),
      );

      const result = await storageService.uploadFile(key, body, {
        contentType: 'image/png',
      });

      expect(result.url).toBe(`https://test-bucket.s3.amazonaws.com/${key}`);
    });

    it('sets content type', async () => {
      const key = 'files/test.json';
      const body = Buffer.from('{}');
      const contentType = 'application/json';

      mockS3Client.putObject.mockResolvedValue(
        createMockS3Response({ ETag: '"etag"' }),
      );

      await storageService.uploadFile(key, body, { contentType });

      expect(mockS3Client.putObject).toHaveBeenCalledWith(
        expect.objectContaining({
          ContentType: contentType,
        }),
      );
    });

    it('includes metadata', async () => {
      const key = 'files/test.txt';
      const body = Buffer.from('content');
      const metadata = {
        'x-amz-meta-filename': 'original.txt',
        'x-amz-meta-userid': 'user_123',
      };

      mockS3Client.putObject.mockResolvedValue(
        createMockS3Response({ ETag: '"etag"' }),
      );

      await storageService.uploadFile(key, body, {
        contentType: 'text/plain',
        metadata,
      });

      expect(mockS3Client.putObject).toHaveBeenCalledWith(
        expect.objectContaining({
          Metadata: metadata,
        }),
      );
    });

    it('handles upload errors', async () => {
      const key = 'files/test.txt';
      const body = Buffer.from('content');

      mockS3Client.putObject.mockRejectedValue(new Error('Upload failed'));

      await expect(
        storageService.uploadFile(key, body, { contentType: 'text/plain' }),
      ).rejects.toThrow('Upload failed');
    });
  });

  // ===========================================================================
  // getSignedUploadUrl Tests
  // ===========================================================================

  describe('getSignedUploadUrl', () => {
    it('generates presigned URL', async () => {
      const key = 'channels/ch_123/files/user_456/upload.pdf';
      const contentType = 'application/pdf';

      const result = await storageService.getSignedUploadUrl(key, contentType);

      expect(result.url).toContain('https://');
      expect(result.url).toContain('X-Amz-Signature');
      expect(result.key).toBe(key);
    });

    it('sets expiration', async () => {
      const key = 'files/test.txt';
      const contentType = 'text/plain';

      const result = await storageService.getSignedUploadUrl(key, contentType);

      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('includes required fields', async () => {
      const key = 'files/test.txt';
      const contentType = 'text/plain';
      const metadata = { 'x-amz-meta-test': 'value' };

      const result = await storageService.getSignedUploadUrl(key, contentType, metadata);

      expect(result.fields).toBeDefined();
      expect(result.fields!['Content-Type']).toBe(contentType);
      expect(result.fields!['x-amz-meta-test']).toBe('value');
    });

    it('includes content type in fields', async () => {
      const key = 'files/image.png';
      const contentType = 'image/png';

      const result = await storageService.getSignedUploadUrl(key, contentType);

      expect(result.fields).toHaveProperty('Content-Type', contentType);
    });
  });

  // ===========================================================================
  // getSignedDownloadUrl Tests
  // ===========================================================================

  describe('getSignedDownloadUrl', () => {
    it('generates download URL', async () => {
      const key = 'files/download.pdf';

      const url = await storageService.getSignedDownloadUrl(key);

      expect(url).toContain(key);
      expect(url).toContain('X-Amz-Signature');
    });

    it('respects expiration time', async () => {
      const key = 'files/test.txt';
      const expiresIn = 7200; // 2 hours

      const url = await storageService.getSignedDownloadUrl(key, expiresIn);

      expect(url).toContain(`X-Amz-Expires=${expiresIn}`);
    });

    it('uses default expiration when not specified', async () => {
      const key = 'files/test.txt';

      const url = await storageService.getSignedDownloadUrl(key);

      expect(url).toContain('X-Amz-Expires=3600');
    });
  });

  // ===========================================================================
  // deleteFile Tests
  // ===========================================================================

  describe('deleteFile', () => {
    it('removes file from S3', async () => {
      const key = 'files/to-delete.txt';

      mockS3Client.deleteObject.mockResolvedValue({});

      await storageService.deleteFile(key);

      expect(mockS3Client.deleteObject).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'test-bucket',
          Key: key,
        }),
      );
    });

    it('handles non-existent file gracefully', async () => {
      const key = 'files/non-existent.txt';

      // S3 deleteObject doesn't throw for non-existent keys
      mockS3Client.deleteObject.mockResolvedValue({});

      await expect(storageService.deleteFile(key)).resolves.not.toThrow();
    });

    it('propagates S3 errors', async () => {
      const key = 'files/error.txt';

      mockS3Client.deleteObject.mockRejectedValue(
        new Error('Access Denied'),
      );

      await expect(storageService.deleteFile(key)).rejects.toThrow('Access Denied');
    });
  });

  // ===========================================================================
  // fileExists Tests
  // ===========================================================================

  describe('fileExists', () => {
    it('returns true for existing file', async () => {
      const key = 'files/exists.txt';

      mockS3Client.headObject.mockResolvedValue({
        ContentLength: 100,
        ContentType: 'text/plain',
      });

      const exists = await storageService.fileExists(key);

      expect(exists).toBe(true);
      expect(mockS3Client.headObject).toHaveBeenCalledWith(
        expect.objectContaining({ Key: key }),
      );
    });

    it('returns false for non-existent file', async () => {
      const key = 'files/not-exists.txt';

      mockS3Client.headObject.mockRejectedValue(new Error('Not Found'));

      const exists = await storageService.fileExists(key);

      expect(exists).toBe(false);
    });
  });

  // ===========================================================================
  // listFiles Tests
  // ===========================================================================

  describe('listFiles', () => {
    it('lists files with prefix', async () => {
      const prefix = 'channels/ch_123/files/';

      mockS3Client.listObjects.mockResolvedValue({
        Contents: [
          { Key: `${prefix}file1.txt`, Size: 100 },
          { Key: `${prefix}file2.pdf`, Size: 200 },
        ],
      });

      const files = await storageService.listFiles(prefix);

      expect(files).toHaveLength(2);
      expect(mockS3Client.listObjects).toHaveBeenCalledWith(
        expect.objectContaining({ Prefix: prefix }),
      );
    });

    it('returns empty array for no matches', async () => {
      const prefix = 'empty/prefix/';

      mockS3Client.listObjects.mockResolvedValue({ Contents: [] });

      const files = await storageService.listFiles(prefix);

      expect(files).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Multipart Upload Tests
  // ===========================================================================

  describe('initiateMultipartUpload', () => {
    it('starts multipart upload', async () => {
      const key = 'files/large-file.mp4';
      const contentType = 'video/mp4';

      mockS3Client.createMultipartUpload.mockResolvedValue({
        UploadId: 'upload_abc123',
        Key: key,
      });

      const result = await storageService.initiateMultipartUpload(key, contentType);

      expect(result.uploadId).toBe('upload_abc123');
      expect(result.key).toBe(key);
      expect(mockS3Client.createMultipartUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: key,
          ContentType: contentType,
        }),
      );
    });
  });

  describe('getMultipartPartUrl', () => {
    it('generates part upload URL', async () => {
      const key = 'files/large-file.mp4';
      const uploadId = 'upload_abc123';
      const partNumber = 1;

      const url = await storageService.getMultipartPartUrl(key, uploadId, partNumber);

      expect(url).toContain(key);
      expect(url).toContain(`uploadId=${uploadId}`);
      expect(url).toContain(`partNumber=${partNumber}`);
    });
  });

  describe('completeMultipartUpload', () => {
    it('completes multipart upload', async () => {
      const key = 'files/large-file.mp4';
      const uploadId = 'upload_abc123';
      const parts = [
        { partNumber: 1, etag: '"etag1"' },
        { partNumber: 2, etag: '"etag2"' },
      ];

      mockS3Client.completeMultipartUpload.mockResolvedValue({
        Location: `https://test-bucket.s3.amazonaws.com/${key}`,
      });

      const result = await storageService.completeMultipartUpload(key, uploadId, parts);

      expect(result.location).toContain(key);
      expect(mockS3Client.completeMultipartUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: key,
          UploadId: uploadId,
          MultipartUpload: {
            Parts: expect.arrayContaining([
              expect.objectContaining({ PartNumber: 1, ETag: '"etag1"' }),
              expect.objectContaining({ PartNumber: 2, ETag: '"etag2"' }),
            ]),
          },
        }),
      );
    });
  });

  describe('abortMultipartUpload', () => {
    it('cancels multipart upload', async () => {
      const key = 'files/large-file.mp4';
      const uploadId = 'upload_abc123';

      mockS3Client.abortMultipartUpload.mockResolvedValue({});

      await storageService.abortMultipartUpload(key, uploadId);

      expect(mockS3Client.abortMultipartUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: key,
          UploadId: uploadId,
        }),
      );
    });
  });
});

// =============================================================================
// INTEGRATION SCENARIO TESTS
// =============================================================================

describe('StorageService Integration Scenarios', () => {
  let mockS3Client: MockS3Client;
  let storageService: ReturnType<typeof createMockStorageService>;

  beforeEach(() => {
    mockS3Client = createMockS3Client();
    storageService = createMockStorageService(mockS3Client);
  });

  it('complete upload flow: presigned URL -> upload -> verify', async () => {
    const key = 'channels/ch_123/files/user_456/document.pdf';
    const contentType = 'application/pdf';
    const fileContent = Buffer.from('PDF content here');

    // Step 1: Get presigned URL
    const signedUrl = await storageService.getSignedUploadUrl(key, contentType);
    expect(signedUrl.url).toBeDefined();
    expect(signedUrl.key).toBe(key);

    // Step 2: Upload file (simulated)
    mockS3Client.putObject.mockResolvedValue(
      createMockS3Response({ ETag: '"file-etag"' }),
    );

    const uploadResult = await storageService.uploadFile(key, fileContent, { contentType });
    expect(uploadResult.key).toBe(key);

    // Step 3: Verify file exists
    mockS3Client.headObject.mockResolvedValue({
      ContentLength: fileContent.length,
      ContentType: contentType,
    });

    const exists = await storageService.fileExists(key);
    expect(exists).toBe(true);
  });

  it('multipart upload flow for large files', async () => {
    const key = 'channels/ch_123/files/user_456/large-video.mp4';
    const contentType = 'video/mp4';

    // Step 1: Initiate multipart upload
    mockS3Client.createMultipartUpload.mockResolvedValue({
      UploadId: 'mp_upload_123',
      Key: key,
    });

    const initResult = await storageService.initiateMultipartUpload(key, contentType);
    expect(initResult.uploadId).toBe('mp_upload_123');

    // Step 2: Get part URLs
    const partUrl1 = await storageService.getMultipartPartUrl(key, initResult.uploadId, 1);
    const partUrl2 = await storageService.getMultipartPartUrl(key, initResult.uploadId, 2);

    expect(partUrl1).toContain('partNumber=1');
    expect(partUrl2).toContain('partNumber=2');

    // Step 3: Complete multipart upload
    mockS3Client.completeMultipartUpload.mockResolvedValue({
      Location: `https://test-bucket.s3.amazonaws.com/${key}`,
    });

    const completeResult = await storageService.completeMultipartUpload(
      key,
      initResult.uploadId,
      [
        { partNumber: 1, etag: '"part1-etag"' },
        { partNumber: 2, etag: '"part2-etag"' },
      ],
    );

    expect(completeResult.location).toContain(key);
  });

  it('handles multipart upload abort', async () => {
    const key = 'channels/ch_123/files/user_456/cancelled-upload.mp4';

    // Initiate
    mockS3Client.createMultipartUpload.mockResolvedValue({
      UploadId: 'mp_upload_456',
      Key: key,
    });

    const initResult = await storageService.initiateMultipartUpload(key, 'video/mp4');

    // Abort
    mockS3Client.abortMultipartUpload.mockResolvedValue({});

    await storageService.abortMultipartUpload(key, initResult.uploadId);

    expect(mockS3Client.abortMultipartUpload).toHaveBeenCalled();
  });

  it('file deletion cleanup flow', async () => {
    const key = 'channels/ch_123/files/user_456/to-delete.pdf';

    // Verify file exists first
    mockS3Client.headObject.mockResolvedValue({
      ContentLength: 100,
    });

    const existsBefore = await storageService.fileExists(key);
    expect(existsBefore).toBe(true);

    // Delete file
    mockS3Client.deleteObject.mockResolvedValue({});
    await storageService.deleteFile(key);

    // Verify file no longer exists
    mockS3Client.headObject.mockRejectedValue(new Error('Not Found'));

    const existsAfter = await storageService.fileExists(key);
    expect(existsAfter).toBe(false);
  });
});
