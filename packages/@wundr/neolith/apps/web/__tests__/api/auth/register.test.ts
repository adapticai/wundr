/**
 * Tests for User Registration API Endpoint
 *
 * @module __tests__/api/auth/register
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/auth/register/route';
import { prisma } from '@neolith/database';
import bcrypt from 'bcrypt';

// Mock dependencies
vi.mock('@neolith/database', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    account: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@neolith/core/services', () => ({
  avatarService: {
    generateFallbackAvatar: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
  },
}));

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully register a new user', async () => {
    const mockUser = {
      id: 'user_123',
      email: 'test@example.com',
      name: 'Test User',
      displayName: 'Test User',
      avatarUrl: 'https://example.com/avatar.png',
      status: 'ACTIVE',
      createdAt: new Date(),
    };

    // Mock implementations
    (prisma.user.findUnique as any).mockResolvedValue(null); // No existing user
    (bcrypt.hash as any).mockResolvedValue('hashed_password');
    (prisma.$transaction as any).mockImplementation(async (callback: any) => {
      return callback({
        user: {
          create: vi.fn().mockResolvedValue(mockUser),
        },
        account: {
          create: vi.fn().mockResolvedValue({}),
        },
      });
    });
    (prisma.user.findUnique as any).mockResolvedValue(mockUser); // Return user with avatar

    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'SecurePass123',
        name: 'Test User',
      }),
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.message).toBe('User registered successfully');
    expect(data.data.email).toBe('test@example.com');
    expect(data.data.name).toBe('Test User');
  });

  it('should return 409 if email already exists', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'existing_user',
      email: 'existing@example.com',
    });

    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'existing@example.com',
        password: 'SecurePass123',
      }),
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.code).toBe('EMAIL_EXISTS');
    expect(data.error).toContain('already exists');
  });

  it('should return 400 for invalid email format', async () => {
    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid-email',
        password: 'SecurePass123',
      }),
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for weak password', async () => {
    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'weak',
      }),
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(data.details).toBeDefined();
  });

  it('should return 400 for missing required fields', async () => {
    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for invalid JSON body', async () => {
    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-json',
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(data.error).toContain('Invalid JSON');
  });
});
