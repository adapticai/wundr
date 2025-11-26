/**
 * User Profile API Tests
 *
 * Tests for /api/users/me and /api/users/[id] endpoints
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getMeProfile, PATCH as patchMeProfile } from '@/app/api/users/me/route';
import { GET as getUserProfile } from '@/app/api/users/[id]/route';

// Mock dependencies
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@neolith/database', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { auth } from '@/lib/auth';
import { prisma } from '@neolith/database';

describe('User Profile API', () => {
  const mockUser = {
    id: 'user123',
    email: 'test@example.com',
    name: 'Test User',
    displayName: 'Tester',
    avatarUrl: 'https://example.com/avatar.jpg',
    bio: 'Test bio',
    status: 'ACTIVE' as const,
    isVP: false,
    preferences: { theme: 'dark' },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
    lastActiveAt: new Date('2024-01-03'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/users/me', () => {
    it('should return current user profile', async () => {
      // Mock authentication
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user123', email: 'test@example.com' },
        expires: '2024-12-31',
      });

      // Mock database call
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/users/me');
      const response = await getMeProfile(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toMatchObject({
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
      });
    });

    it('should return 401 if not authenticated', async () => {
      // Mock no authentication
      vi.mocked(auth).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/users/me');
      const response = await getMeProfile(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe('UNAUTHORIZED');
    });

    it('should return 404 if user not found', async () => {
      // Mock authentication
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user123', email: 'test@example.com' },
        expires: '2024-12-31',
      });

      // Mock database call returning null
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/users/me');
      const response = await getMeProfile(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe('USER_NOT_FOUND');
    });
  });

  describe('PATCH /api/users/me', () => {
    it('should update user profile', async () => {
      // Mock authentication
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user123', email: 'test@example.com' },
        expires: '2024-12-31',
      });

      const updatedUser = {
        ...mockUser,
        name: 'Updated Name',
        bio: 'Updated bio',
      };

      // Mock database call
      vi.mocked(prisma.user.update).mockResolvedValue(updatedUser);

      const request = new NextRequest('http://localhost:3000/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Updated Name',
          bio: 'Updated bio',
        }),
      });

      const response = await patchMeProfile(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.name).toBe('Updated Name');
      expect(data.data.bio).toBe('Updated bio');
      expect(data.message).toBe('Profile updated successfully');
    });

    it('should return 401 if not authenticated', async () => {
      // Mock no authentication
      vi.mocked(auth).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test' }),
      });

      const response = await patchMeProfile(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe('UNAUTHORIZED');
    });

    it('should return 400 for invalid input', async () => {
      // Mock authentication
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user123', email: 'test@example.com' },
        expires: '2024-12-31',
      });

      const request = new NextRequest('http://localhost:3000/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'x'.repeat(101), // Too long
        }),
      });

      const response = await patchMeProfile(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/users/[id]', () => {
    it('should return user profile by ID', async () => {
      // Mock authentication
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'viewer123', email: 'viewer@example.com' },
        expires: '2024-12-31',
      });

      // Mock database call - return public profile without preferences
      const publicUser = {
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        displayName: mockUser.displayName,
        avatarUrl: mockUser.avatarUrl,
        bio: mockUser.bio,
        status: mockUser.status,
        isVP: mockUser.isVP,
        createdAt: mockUser.createdAt,
        lastActiveAt: mockUser.lastActiveAt,
      };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(publicUser as any);

      const request = new NextRequest('http://localhost:3000/api/users/user123');
      const response = await getUserProfile(request, {
        params: Promise.resolve({ id: 'user123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.id).toBe('user123');
      // Should not include preferences for other users
      expect(data.data.preferences).toBeUndefined();
    });

    it('should return full profile if viewing own profile', async () => {
      // Mock authentication (same user)
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user123', email: 'test@example.com' },
        expires: '2024-12-31',
      });

      // Mock database calls
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(mockUser) // First call (public profile check)
        .mockResolvedValueOnce(mockUser); // Second call (full profile)

      const request = new NextRequest('http://localhost:3000/api/users/user123');
      const response = await getUserProfile(request, {
        params: Promise.resolve({ id: 'user123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.id).toBe('user123');
      // Should include preferences for own profile
      expect(data.data.preferences).toBeDefined();
    });

    it('should return 401 if not authenticated', async () => {
      // Mock no authentication
      vi.mocked(auth).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/users/user123');
      const response = await getUserProfile(request, {
        params: Promise.resolve({ id: 'user123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe('UNAUTHORIZED');
    });

    it('should return 404 if user not found', async () => {
      // Mock authentication
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'viewer123', email: 'viewer@example.com' },
        expires: '2024-12-31',
      });

      // Mock database call returning null
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/users/user123');
      const response = await getUserProfile(request, {
        params: Promise.resolve({ id: 'user123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe('USER_NOT_FOUND');
    });
  });
});
