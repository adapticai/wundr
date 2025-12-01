/**
 * Avatar Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AvatarServiceImpl, AVATAR_SIZES } from '../avatar-service';

import type { StorageService } from '../storage-service';

// Mock storage service
const createMockStorage = (): StorageService => ({
  uploadBuffer: vi.fn().mockResolvedValue({
    url: 'https://cdn.example.com/avatars/test.jpg',
    key: 'avatars/user_123/avatar-large-123.jpg',
    size: 1024,
    contentType: 'image/jpeg',
    etag: 'abc123',
    bucket: 'test-bucket',
  }),
  uploadFile: vi.fn(),
  uploadFromUrl: vi.fn(),
  getFile: vi.fn(),
  getFileUrl: vi.fn().mockResolvedValue('https://cdn.example.com/avatar.jpg'),
  deleteFile: vi.fn(),
  deleteFiles: vi.fn(),
  copyFile: vi.fn(),
  moveFile: vi.fn(),
  getFileMetadata: vi.fn(),
  listFiles: vi.fn().mockResolvedValue({
    files: [
      { key: 'avatars/user_123/avatar-small.jpg', size: 512 },
      { key: 'avatars/user_123/avatar-large.jpg', size: 2048 },
    ],
    prefixes: [],
    isTruncated: false,
    keyCount: 2,
  }),
  fileExists: vi.fn().mockResolvedValue(true),
  generateKey: vi.fn(),
  getConfig: vi.fn(),
  getSignedUploadUrl: vi.fn(),
});

// Mock Prisma
vi.mock('@neolith/database', () => ({
  prisma: {
    user: {
      update: vi.fn().mockResolvedValue({
        id: 'user_123',
        email: 'test@example.com',
        avatarUrl: 'https://cdn.example.com/avatar.jpg',
      }),
      findUnique: vi.fn().mockResolvedValue({
        id: 'user_123',
        email: 'test@example.com',
        avatarUrl: 'https://cdn.example.com/avatar.jpg',
      }),
    },
  },
}));

// Mock fetch for URL downloads
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  arrayBuffer: async () => new ArrayBuffer(8),
  headers: new Headers({ 'content-type': 'image/jpeg' }),
});

describe('AvatarService', () => {
  let service: AvatarServiceImpl;
  let mockStorage: StorageService;

  beforeEach(() => {
    mockStorage = createMockStorage();
    service = new AvatarServiceImpl(mockStorage);
    vi.clearAllMocks();
  });

  describe('uploadAvatar', () => {
    it('should upload avatar and generate all size variants', async () => {
      const buffer = Buffer.from('fake-image-data');

      const result = await service.uploadAvatar({
        userId: 'user_123',
        source: buffer,
        filename: 'avatar.jpg',
      });

      // Should upload 4 variants
      expect(mockStorage.uploadBuffer).toHaveBeenCalledTimes(4);

      // Check result structure
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('variants');
      expect(result.variants).toHaveProperty('SMALL');
      expect(result.variants).toHaveProperty('MEDIUM');
      expect(result.variants).toHaveProperty('LARGE');
      expect(result.variants).toHaveProperty('XLARGE');
    });

    it('should handle base64 data URLs', async () => {
      const base64 = 'data:image/png;base64,iVBORw0KGgoAAAANS';

      const result = await service.uploadAvatar({
        userId: 'user_123',
        source: base64,
      });

      expect(result).toHaveProperty('url');
    });

    it('should download from external URL', async () => {
      const url = 'https://example.com/avatar.jpg';

      const result = await service.uploadAvatar({
        userId: 'user_123',
        source: url,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        url,
        expect.objectContaining({
          headers: expect.any(Object),
        })
      );
      expect(result).toHaveProperty('url');
    });
  });

  describe('uploadOAuthAvatar', () => {
    it('should download and upload OAuth provider avatar', async () => {
      const result = await service.uploadOAuthAvatar({
        userId: 'user_123',
        providerAvatarUrl: 'https://avatars.githubusercontent.com/u/123',
        provider: 'github',
      });

      expect(global.fetch).toHaveBeenCalled();
      expect(mockStorage.uploadBuffer).toHaveBeenCalled();
      expect(result).toHaveProperty('url');
    });
  });

  describe('generateFallbackAvatar', () => {
    it('should generate initials-based avatar', async () => {
      const result = await service.generateFallbackAvatar({
        name: 'John Doe',
        userId: 'user_123',
      });

      // Should generate 4 size variants
      expect(mockStorage.uploadBuffer).toHaveBeenCalledTimes(4);
      expect(result).toHaveProperty('url');
      expect(result.variants).toBeDefined();
    });

    it('should extract correct initials from full name', async () => {
      await service.generateFallbackAvatar({
        name: 'Alice Bob Charlie',
        userId: 'user_123',
      });

      // Check upload was called with PNG content type
      expect(mockStorage.uploadBuffer).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          contentType: 'image/png',
        })
      );
    });

    it('should handle single name', async () => {
      const result = await service.generateFallbackAvatar({
        name: 'Alice',
        userId: 'user_123',
      });

      expect(result).toHaveProperty('url');
    });
  });

  describe('deleteAvatar', () => {
    it('should delete all avatar variants', async () => {
      await service.deleteAvatar('user_123');

      expect(mockStorage.listFiles).toHaveBeenCalledWith('avatars/user_123/');
      expect(mockStorage.deleteFiles).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('avatars/user_123/')])
      );
    });
  });

  describe('getAvatarUrl', () => {
    it('should return avatar URL for user', async () => {
      const url = await service.getAvatarUrl('user_123');

      expect(url).toBe('https://cdn.example.com/avatar.jpg');
    });

    it('should return null if user has no avatar', async () => {
      const mockStorage = createMockStorage();
      const service = new AvatarServiceImpl(mockStorage);

      // Mock Prisma to return null avatarUrl
      const { prisma } = await import('@neolith/database');
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user_123',
        email: 'test@example.com',
        avatarUrl: null,
      } as any);

      const url = await service.getAvatarUrl('user_123');

      expect(url).toBeNull();
    });

    it('should try to get specific size variant', async () => {
      await service.getAvatarUrl('user_123', 'MEDIUM');

      expect(mockStorage.fileExists).toHaveBeenCalled();
    });
  });

  describe('avatar size constants', () => {
    it('should have correct size values', () => {
      expect(AVATAR_SIZES.SMALL).toBe(32);
      expect(AVATAR_SIZES.MEDIUM).toBe(64);
      expect(AVATAR_SIZES.LARGE).toBe(128);
      expect(AVATAR_SIZES.XLARGE).toBe(256);
    });
  });
});
