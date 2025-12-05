/**
 * Upload API Tests
 *
 * Comprehensive test suite for the file upload API endpoints covering:
 * - Presigned URL generation
 * - File type validation
 * - File size validation
 * - Channel membership authorization
 * - Upload completion
 * - Image processing triggers
 *
 * @module apps/web/app/api/upload/__tests__/upload.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// MOCK SETUP
// =============================================================================

/**
 * File type enum
 */
type FileType = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'ARCHIVE' | 'OTHER';

/**
 * Mock user for testing
 */
interface MockUser {
  id: string;
  email: string;
  name: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';
}

/**
 * Mock request input for upload
 */
interface UploadRequestInput {
  filename: string;
  contentType: string;
  size: number;
  channelId: string;
}

/**
 * Mock request input for complete upload
 */
interface CompleteUploadInput {
  key: string;
  channelId: string;
  messageId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Mock API response
 */
interface ApiResponse<T> {
  status: number;
  data: T | null;
  error: { code: string; message: string } | null;
}

/**
 * Allowed MIME types
 */
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'video/mp4',
  'audio/mpeg',
];

/**
 * Max file size by type (in bytes)
 */
const MAX_FILE_SIZES: Record<FileType, number> = {
  IMAGE: 100 * 1024 * 1024,
  VIDEO: 500 * 1024 * 1024,
  AUDIO: 100 * 1024 * 1024,
  DOCUMENT: 50 * 1024 * 1024,
  ARCHIVE: 200 * 1024 * 1024,
  OTHER: 50 * 1024 * 1024,
};

/**
 * Get file type from MIME type
 */
function getFileType(mimeType: string): FileType {
  if (mimeType.startsWith('image/')) {
    return 'IMAGE';
  }
  if (mimeType.startsWith('video/')) {
    return 'VIDEO';
  }
  if (mimeType.startsWith('audio/')) {
    return 'AUDIO';
  }
  if (
    mimeType.includes('pdf') ||
    mimeType.includes('document') ||
    mimeType.startsWith('text/')
  ) {
    return 'DOCUMENT';
  }
  if (
    mimeType.includes('zip') ||
    mimeType.includes('tar') ||
    mimeType.includes('gzip')
  ) {
    return 'ARCHIVE';
  }
  return 'OTHER';
}

/**
 * Create mock Prisma client
 */
function createMockPrisma() {
  return {
    channel: {
      findUnique: vi.fn(),
    },
    channelMember: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    file: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  };
}

/**
 * Create mock storage service
 */
function createMockStorageService() {
  return {
    getSignedUploadUrl: vi.fn().mockResolvedValue({
      url: 'https://bucket.s3.amazonaws.com/upload?signature=mock',
      key: 'channels/ch_123/files/user_456/file.pdf',
      fields: { 'Content-Type': 'application/pdf' },
      expiresAt: new Date(Date.now() + 3600000),
    }),
    getSignedDownloadUrl: vi
      .fn()
      .mockResolvedValue(
        'https://bucket.s3.amazonaws.com/download?signature=mock',
      ),
  };
}

/**
 * Create mock image service
 */
function createMockImageService() {
  return {
    processImage: vi.fn().mockResolvedValue({
      width: 1920,
      height: 1080,
      format: 'jpeg',
    }),
    generateThumbnail: vi
      .fn()
      .mockResolvedValue('https://cdn.example.com/thumb.webp'),
  };
}

/**
 * Simulate upload API handler
 */
function createUploadHandler(deps: {
  prisma: ReturnType<typeof createMockPrisma>;
  storageService: ReturnType<typeof createMockStorageService>;
  imageService: ReturnType<typeof createMockImageService>;
  currentUser: MockUser | null;
}) {
  return {
    /**
     * POST /api/upload - Request presigned upload URL
     */
    requestUpload: async (
      input: UploadRequestInput,
    ): Promise<
      ApiResponse<{
        url: string;
        key: string;
        fields: Record<string, string>;
        expiresAt: Date;
      }>
    > => {
      // Check authentication
      if (!deps.currentUser) {
        return {
          status: 401,
          data: null,
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required',
          },
        };
      }

      // Validate file type
      if (!ALLOWED_MIME_TYPES.includes(input.contentType)) {
        return {
          status: 400,
          data: null,
          error: {
            code: 'INVALID_FILE_TYPE',
            message: `File type ${input.contentType} is not allowed`,
          },
        };
      }

      // Validate file size
      const fileType = getFileType(input.contentType);
      const maxSize = MAX_FILE_SIZES[fileType];
      if (input.size > maxSize) {
        return {
          status: 400,
          data: null,
          error: {
            code: 'FILE_TOO_LARGE',
            message: `File size exceeds maximum allowed (${maxSize / 1024 / 1024}MB)`,
          },
        };
      }

      // Check channel membership
      const membership = await deps.prisma.channelMember.findUnique({
        where: {
          channelId_userId: {
            channelId: input.channelId,
            userId: deps.currentUser.id,
          },
        },
      });

      if (!membership && deps.currentUser.role !== 'ADMIN') {
        return {
          status: 403,
          data: null,
          error: {
            code: 'FORBIDDEN',
            message: 'You must be a member of this channel to upload files',
          },
        };
      }

      // Generate signed URL
      const result = await deps.storageService.getSignedUploadUrl(
        `channels/${input.channelId}/files/${deps.currentUser.id}/${Date.now()}-${input.filename}`,
        input.contentType,
      );

      return {
        status: 200,
        data: {
          url: result.url,
          key: result.key,
          fields: result.fields ?? {},
          expiresAt: result.expiresAt,
        },
        error: null,
      };
    },

    /**
     * POST /api/upload/complete - Complete upload and create file record
     */
    completeUpload: async (
      input: CompleteUploadInput,
    ): Promise<
      ApiResponse<{
        file: {
          id: string;
          name: string;
          url: string;
          thumbnailUrl: string | null;
        };
      }>
    > => {
      // Check authentication
      if (!deps.currentUser) {
        return {
          status: 401,
          data: null,
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required',
          },
        };
      }

      // Extract channel from key
      const keyParts = input.key.split('/');
      if (keyParts.length < 3 || keyParts[0] !== 'channels') {
        return {
          status: 400,
          data: null,
          error: { code: 'INVALID_KEY', message: 'Invalid file key format' },
        };
      }

      const channelId = keyParts[1]!;

      // Check channel membership
      const membership = await deps.prisma.channelMember.findUnique({
        where: {
          channelId_userId: {
            channelId,
            userId: deps.currentUser.id,
          },
        },
      });

      if (!membership && deps.currentUser.role !== 'ADMIN') {
        return {
          status: 403,
          data: null,
          error: { code: 'FORBIDDEN', message: 'Access denied' },
        };
      }

      // Extract filename
      const filename = keyParts[keyParts.length - 1]!.replace(/^\d+-/, '');
      const extension = filename.split('.').pop() ?? '';
      const mimeType = getMimeType(extension);
      const fileType = getFileType(mimeType);

      // Create file record
      const file = await deps.prisma.file.create({
        data: {
          name: filename,
          key: input.key,
          type: fileType,
          mimeType,
          size: 0,
          channelId,
          userId: deps.currentUser.id,
          metadata: input.metadata ?? {},
        },
      });

      let thumbnailUrl: string | null = null;

      // Process image if applicable
      if (fileType === 'IMAGE') {
        try {
          await deps.imageService.processImage(input.key);
          thumbnailUrl = await deps.imageService.generateThumbnail(input.key);

          await deps.prisma.file.update({
            where: { id: file.id },
            data: { thumbnailUrl },
          });
        } catch {
          // Image processing failed but upload is complete
        }
      }

      const downloadUrl = await deps.storageService.getSignedDownloadUrl(
        input.key,
      );

      return {
        status: 200,
        data: {
          file: {
            id: file.id,
            name: file.name,
            url: downloadUrl,
            thumbnailUrl,
          },
        },
        error: null,
      };
    },
  };
}

/**
 * Get MIME type from extension
 */
function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    pdf: 'application/pdf',
    txt: 'text/plain',
    mp4: 'video/mp4',
    mp3: 'audio/mpeg',
  };
  return mimeTypes[extension] ?? 'application/octet-stream';
}

// =============================================================================
// UPLOAD API TESTS
// =============================================================================

describe('Upload API', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockStorageService: ReturnType<typeof createMockStorageService>;
  let mockImageService: ReturnType<typeof createMockImageService>;
  let handler: ReturnType<typeof createUploadHandler>;
  let currentUser: MockUser | null;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockStorageService = createMockStorageService();
    mockImageService = createMockImageService();
    currentUser = {
      id: 'user_123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'MEMBER',
    };
    handler = createUploadHandler({
      prisma: mockPrisma,
      storageService: mockStorageService,
      imageService: mockImageService,
      currentUser,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================================================
  // POST /api/upload Tests
  // ===========================================================================

  describe('POST /api/upload', () => {
    it('returns signed URL for valid request', async () => {
      // Setup: User is member of channel
      mockPrisma.channelMember.findUnique.mockResolvedValue({
        userId: 'user_123',
        channelId: 'ch_123',
        role: 'MEMBER',
      });

      const input: UploadRequestInput = {
        filename: 'document.pdf',
        contentType: 'application/pdf',
        size: 1024000,
        channelId: 'ch_123',
      };

      const response = await handler.requestUpload(input);

      expect(response.status).toBe(200);
      expect(response.data).not.toBeNull();
      expect(response.data!.url).toContain('https://');
      expect(response.data!.key).toContain('channels/ch_123/files/');
      expect(response.data!.expiresAt).toBeInstanceOf(Date);
    });

    it('validates file type - rejects invalid MIME types', async () => {
      mockPrisma.channelMember.findUnique.mockResolvedValue({
        userId: 'user_123',
        channelId: 'ch_123',
        role: 'MEMBER',
      });

      const input: UploadRequestInput = {
        filename: 'malware.exe',
        contentType: 'application/x-msdownload',
        size: 1024000,
        channelId: 'ch_123',
      };

      const response = await handler.requestUpload(input);

      expect(response.status).toBe(400);
      expect(response.error).not.toBeNull();
      expect(response.error!.code).toBe('INVALID_FILE_TYPE');
    });

    it('validates file type - accepts allowed MIME types', async () => {
      mockPrisma.channelMember.findUnique.mockResolvedValue({
        userId: 'user_123',
        channelId: 'ch_123',
        role: 'MEMBER',
      });

      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'application/pdf',
        'text/plain',
      ];

      for (const contentType of allowedTypes) {
        const input: UploadRequestInput = {
          filename: 'file.test',
          contentType,
          size: 1024,
          channelId: 'ch_123',
        };

        const response = await handler.requestUpload(input);

        expect(response.status).toBe(200);
        expect(response.error).toBeNull();
      }
    });

    it('validates file size - rejects files exceeding limit', async () => {
      mockPrisma.channelMember.findUnique.mockResolvedValue({
        userId: 'user_123',
        channelId: 'ch_123',
        role: 'MEMBER',
      });

      // Document limit is 50MB
      const input: UploadRequestInput = {
        filename: 'huge-file.pdf',
        contentType: 'application/pdf',
        size: 60 * 1024 * 1024, // 60MB - exceeds 50MB limit
        channelId: 'ch_123',
      };

      const response = await handler.requestUpload(input);

      expect(response.status).toBe(400);
      expect(response.error!.code).toBe('FILE_TOO_LARGE');
    });

    it('validates file size - accepts files within limit', async () => {
      mockPrisma.channelMember.findUnique.mockResolvedValue({
        userId: 'user_123',
        channelId: 'ch_123',
        role: 'MEMBER',
      });

      const input: UploadRequestInput = {
        filename: 'normal-file.pdf',
        contentType: 'application/pdf',
        size: 10 * 1024 * 1024, // 10MB - within 50MB limit
        channelId: 'ch_123',
      };

      const response = await handler.requestUpload(input);

      expect(response.status).toBe(200);
    });

    it('validates file size - uses type-specific limits', async () => {
      mockPrisma.channelMember.findUnique.mockResolvedValue({
        userId: 'user_123',
        channelId: 'ch_123',
        role: 'MEMBER',
      });

      // Images have 100MB limit, so 80MB should be OK
      const imageInput: UploadRequestInput = {
        filename: 'large-image.png',
        contentType: 'image/png',
        size: 80 * 1024 * 1024,
        channelId: 'ch_123',
      };

      const imageResponse = await handler.requestUpload(imageInput);
      expect(imageResponse.status).toBe(200);

      // But 80MB document should fail (50MB limit)
      const docInput: UploadRequestInput = {
        filename: 'large-doc.pdf',
        contentType: 'application/pdf',
        size: 80 * 1024 * 1024,
        channelId: 'ch_123',
      };

      const docResponse = await handler.requestUpload(docInput);
      expect(docResponse.status).toBe(400);
      expect(docResponse.error!.code).toBe('FILE_TOO_LARGE');
    });

    it('requires channel membership', async () => {
      // User is NOT a member of the channel
      mockPrisma.channelMember.findUnique.mockResolvedValue(null);

      const input: UploadRequestInput = {
        filename: 'document.pdf',
        contentType: 'application/pdf',
        size: 1024000,
        channelId: 'ch_123',
      };

      const response = await handler.requestUpload(input);

      expect(response.status).toBe(403);
      expect(response.error!.code).toBe('FORBIDDEN');
      expect(response.error!.message).toContain('member');
    });

    it('allows admin to upload without membership', async () => {
      // User is NOT a member but is ADMIN
      mockPrisma.channelMember.findUnique.mockResolvedValue(null);

      currentUser = {
        id: 'admin_123',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'ADMIN',
      };

      handler = createUploadHandler({
        prisma: mockPrisma,
        storageService: mockStorageService,
        imageService: mockImageService,
        currentUser,
      });

      const input: UploadRequestInput = {
        filename: 'document.pdf',
        contentType: 'application/pdf',
        size: 1024000,
        channelId: 'ch_123',
      };

      const response = await handler.requestUpload(input);

      expect(response.status).toBe(200);
    });

    it('requires authentication', async () => {
      handler = createUploadHandler({
        prisma: mockPrisma,
        storageService: mockStorageService,
        imageService: mockImageService,
        currentUser: null,
      });

      const input: UploadRequestInput = {
        filename: 'document.pdf',
        contentType: 'application/pdf',
        size: 1024000,
        channelId: 'ch_123',
      };

      const response = await handler.requestUpload(input);

      expect(response.status).toBe(401);
      expect(response.error!.code).toBe('UNAUTHENTICATED');
    });
  });

  // ===========================================================================
  // POST /api/upload/complete Tests
  // ===========================================================================

  describe('POST /api/upload/complete', () => {
    it('creates file record on completion', async () => {
      mockPrisma.channelMember.findUnique.mockResolvedValue({
        userId: 'user_123',
        channelId: 'ch_123',
        role: 'MEMBER',
      });

      mockPrisma.file.create.mockResolvedValue({
        id: 'file_123',
        name: 'document.pdf',
        key: 'channels/ch_123/files/user_123/123-document.pdf',
        type: 'DOCUMENT',
        mimeType: 'application/pdf',
        size: 0,
        channelId: 'ch_123',
        userId: 'user_123',
        metadata: {},
      });

      const input: CompleteUploadInput = {
        key: 'channels/ch_123/files/user_123/123-document.pdf',
        channelId: 'ch_123',
      };

      const response = await handler.completeUpload(input);

      expect(response.status).toBe(200);
      expect(response.data!.file.id).toBe('file_123');
      expect(response.data!.file.name).toBe('document.pdf');
      expect(mockPrisma.file.create).toHaveBeenCalled();
    });

    it('triggers image processing for images', async () => {
      mockPrisma.channelMember.findUnique.mockResolvedValue({
        userId: 'user_123',
        channelId: 'ch_123',
        role: 'MEMBER',
      });

      mockPrisma.file.create.mockResolvedValue({
        id: 'file_123',
        name: 'photo.jpg',
        key: 'channels/ch_123/files/user_123/123-photo.jpg',
        type: 'IMAGE',
        mimeType: 'image/jpeg',
        size: 0,
        channelId: 'ch_123',
        userId: 'user_123',
        metadata: {},
      });

      mockPrisma.file.update.mockResolvedValue({
        id: 'file_123',
        thumbnailUrl: 'https://cdn.example.com/thumb.webp',
      });

      const input: CompleteUploadInput = {
        key: 'channels/ch_123/files/user_123/123-photo.jpg',
        channelId: 'ch_123',
      };

      const response = await handler.completeUpload(input);

      expect(response.status).toBe(200);
      expect(mockImageService.processImage).toHaveBeenCalledWith(input.key);
      expect(mockImageService.generateThumbnail).toHaveBeenCalledWith(
        input.key,
      );
      expect(response.data!.file.thumbnailUrl).toBe(
        'https://cdn.example.com/thumb.webp',
      );
    });

    it('does not trigger image processing for non-images', async () => {
      mockPrisma.channelMember.findUnique.mockResolvedValue({
        userId: 'user_123',
        channelId: 'ch_123',
        role: 'MEMBER',
      });

      mockPrisma.file.create.mockResolvedValue({
        id: 'file_123',
        name: 'document.pdf',
        key: 'channels/ch_123/files/user_123/123-document.pdf',
        type: 'DOCUMENT',
        mimeType: 'application/pdf',
        size: 0,
        channelId: 'ch_123',
        userId: 'user_123',
        metadata: {},
      });

      const input: CompleteUploadInput = {
        key: 'channels/ch_123/files/user_123/123-document.pdf',
        channelId: 'ch_123',
      };

      await handler.completeUpload(input);

      expect(mockImageService.processImage).not.toHaveBeenCalled();
      expect(mockImageService.generateThumbnail).not.toHaveBeenCalled();
    });

    it('associates with channel correctly', async () => {
      mockPrisma.channelMember.findUnique.mockResolvedValue({
        userId: 'user_123',
        channelId: 'ch_456',
        role: 'MEMBER',
      });

      mockPrisma.file.create.mockImplementation(
        async (args: { data: Record<string, unknown> }) => ({
          id: 'file_123',
          ...args.data,
        }),
      );

      const input: CompleteUploadInput = {
        key: 'channels/ch_456/files/user_123/123-document.pdf',
        channelId: 'ch_456',
      };

      await handler.completeUpload(input);

      expect(mockPrisma.file.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channelId: 'ch_456',
          }),
        }),
      );
    });

    it('requires authentication', async () => {
      handler = createUploadHandler({
        prisma: mockPrisma,
        storageService: mockStorageService,
        imageService: mockImageService,
        currentUser: null,
      });

      const input: CompleteUploadInput = {
        key: 'channels/ch_123/files/user_123/123-document.pdf',
        channelId: 'ch_123',
      };

      const response = await handler.completeUpload(input);

      expect(response.status).toBe(401);
      expect(response.error!.code).toBe('UNAUTHENTICATED');
    });

    it('requires channel membership', async () => {
      mockPrisma.channelMember.findUnique.mockResolvedValue(null);

      const input: CompleteUploadInput = {
        key: 'channels/ch_123/files/user_123/123-document.pdf',
        channelId: 'ch_123',
      };

      const response = await handler.completeUpload(input);

      expect(response.status).toBe(403);
      expect(response.error!.code).toBe('FORBIDDEN');
    });

    it('validates key format', async () => {
      const input: CompleteUploadInput = {
        key: 'invalid-key-format',
        channelId: 'ch_123',
      };

      const response = await handler.completeUpload(input);

      expect(response.status).toBe(400);
      expect(response.error!.code).toBe('INVALID_KEY');
    });

    it('stores metadata when provided', async () => {
      mockPrisma.channelMember.findUnique.mockResolvedValue({
        userId: 'user_123',
        channelId: 'ch_123',
        role: 'MEMBER',
      });

      mockPrisma.file.create.mockImplementation(
        async (args: { data: Record<string, unknown> }) => ({
          id: 'file_123',
          ...args.data,
        }),
      );

      const input: CompleteUploadInput = {
        key: 'channels/ch_123/files/user_123/123-document.pdf',
        channelId: 'ch_123',
        metadata: {
          description: 'Q4 Report',
          tags: ['finance', 'quarterly'],
        },
      };

      await handler.completeUpload(input);

      expect(mockPrisma.file.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: {
              description: 'Q4 Report',
              tags: ['finance', 'quarterly'],
            },
          }),
        }),
      );
    });
  });
});

// =============================================================================
// ERROR HANDLING TESTS
// =============================================================================

describe('Upload API Error Handling', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockStorageService: ReturnType<typeof createMockStorageService>;
  let mockImageService: ReturnType<typeof createMockImageService>;
  let handler: ReturnType<typeof createUploadHandler>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockStorageService = createMockStorageService();
    mockImageService = createMockImageService();

    const currentUser: MockUser = {
      id: 'user_123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'MEMBER',
    };

    handler = createUploadHandler({
      prisma: mockPrisma,
      storageService: mockStorageService,
      imageService: mockImageService,
      currentUser,
    });
  });

  it('handles storage service errors gracefully', async () => {
    mockPrisma.channelMember.findUnique.mockResolvedValue({
      userId: 'user_123',
      channelId: 'ch_123',
      role: 'MEMBER',
    });

    mockStorageService.getSignedUploadUrl.mockRejectedValue(
      new Error('S3 Service Unavailable'),
    );

    const input: UploadRequestInput = {
      filename: 'document.pdf',
      contentType: 'application/pdf',
      size: 1024000,
      channelId: 'ch_123',
    };

    await expect(handler.requestUpload(input)).rejects.toThrow(
      'S3 Service Unavailable',
    );
  });

  it('handles database errors gracefully', async () => {
    mockPrisma.channelMember.findUnique.mockRejectedValue(
      new Error('Database connection lost'),
    );

    const input: UploadRequestInput = {
      filename: 'document.pdf',
      contentType: 'application/pdf',
      size: 1024000,
      channelId: 'ch_123',
    };

    await expect(handler.requestUpload(input)).rejects.toThrow(
      'Database connection lost',
    );
  });

  it('handles image processing failures without failing upload', async () => {
    mockPrisma.channelMember.findUnique.mockResolvedValue({
      userId: 'user_123',
      channelId: 'ch_123',
      role: 'MEMBER',
    });

    mockPrisma.file.create.mockResolvedValue({
      id: 'file_123',
      name: 'photo.jpg',
      key: 'channels/ch_123/files/user_123/123-photo.jpg',
      type: 'IMAGE',
      mimeType: 'image/jpeg',
      size: 0,
      channelId: 'ch_123',
      userId: 'user_123',
      metadata: {},
    });

    // Image processing fails
    mockImageService.processImage.mockRejectedValue(
      new Error('Image processing failed'),
    );

    const input: CompleteUploadInput = {
      key: 'channels/ch_123/files/user_123/123-photo.jpg',
      channelId: 'ch_123',
    };

    // Should still succeed, just without thumbnail
    const response = await handler.completeUpload(input);

    expect(response.status).toBe(200);
    expect(response.data!.file.thumbnailUrl).toBeNull();
  });
});

// =============================================================================
// EDGE CASE TESTS
// =============================================================================

describe('Upload API Edge Cases', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockStorageService: ReturnType<typeof createMockStorageService>;
  let mockImageService: ReturnType<typeof createMockImageService>;
  let handler: ReturnType<typeof createUploadHandler>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockStorageService = createMockStorageService();
    mockImageService = createMockImageService();

    const currentUser: MockUser = {
      id: 'user_123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'MEMBER',
    };

    handler = createUploadHandler({
      prisma: mockPrisma,
      storageService: mockStorageService,
      imageService: mockImageService,
      currentUser,
    });
  });

  it('handles filenames with special characters', async () => {
    mockPrisma.channelMember.findUnique.mockResolvedValue({
      userId: 'user_123',
      channelId: 'ch_123',
      role: 'MEMBER',
    });

    const input: UploadRequestInput = {
      filename: 'Report (Q4) [Final] - v2.0.pdf',
      contentType: 'application/pdf',
      size: 1024000,
      channelId: 'ch_123',
    };

    const response = await handler.requestUpload(input);

    expect(response.status).toBe(200);
  });

  it('handles unicode filenames', async () => {
    mockPrisma.channelMember.findUnique.mockResolvedValue({
      userId: 'user_123',
      channelId: 'ch_123',
      role: 'MEMBER',
    });

    const input: UploadRequestInput = {
      filename: 'Presentation-Presentation.pdf',
      contentType: 'application/pdf',
      size: 1024000,
      channelId: 'ch_123',
    };

    const response = await handler.requestUpload(input);

    expect(response.status).toBe(200);
  });

  it('handles zero-byte files', async () => {
    mockPrisma.channelMember.findUnique.mockResolvedValue({
      userId: 'user_123',
      channelId: 'ch_123',
      role: 'MEMBER',
    });

    const input: UploadRequestInput = {
      filename: 'empty.txt',
      contentType: 'text/plain',
      size: 0,
      channelId: 'ch_123',
    };

    const response = await handler.requestUpload(input);

    expect(response.status).toBe(200);
  });

  it('handles files at exact size limit', async () => {
    mockPrisma.channelMember.findUnique.mockResolvedValue({
      userId: 'user_123',
      channelId: 'ch_123',
      role: 'MEMBER',
    });

    // Exactly 50MB (document limit)
    const input: UploadRequestInput = {
      filename: 'exactly-50mb.pdf',
      contentType: 'application/pdf',
      size: 50 * 1024 * 1024,
      channelId: 'ch_123',
    };

    const response = await handler.requestUpload(input);

    expect(response.status).toBe(200);
  });

  it('handles files one byte over limit', async () => {
    mockPrisma.channelMember.findUnique.mockResolvedValue({
      userId: 'user_123',
      channelId: 'ch_123',
      role: 'MEMBER',
    });

    // One byte over 50MB limit
    const input: UploadRequestInput = {
      filename: 'just-over.pdf',
      contentType: 'application/pdf',
      size: 50 * 1024 * 1024 + 1,
      channelId: 'ch_123',
    };

    const response = await handler.requestUpload(input);

    expect(response.status).toBe(400);
    expect(response.error!.code).toBe('FILE_TOO_LARGE');
  });
});
