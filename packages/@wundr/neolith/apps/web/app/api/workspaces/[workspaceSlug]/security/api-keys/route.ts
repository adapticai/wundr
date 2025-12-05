import crypto from 'crypto';

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';

import type { Prisma } from '@neolith/database';

interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  expiresInDays: z.number().min(1).max(365).optional(),
  scopes: z.array(z.string()).optional(),
});

function hashApiKey(apiKey: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(apiKey, salt, 100000, 64, 'sha512')
    .toString('hex');
  return `${salt}:${hash}`;
}

function generateApiKey(): string {
  return `wnd_${crypto.randomBytes(32).toString('hex')}`;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug } = await context.params;

    // Verify admin access
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
      select: {
        id: true,
        workspaceMembers: {
          include: { user: true },
          where: {
            userId: session.user.id,
            role: { in: ['OWNER', 'ADMIN'] },
          },
        },
      },
    });

    if (!workspace || workspace.workspaceMembers.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch API keys (excluding actual key values)
    const apiKeys = await prisma.daemonCredential.findMany({
      where: {
        
      },
      select: {
        id: true,
        apiKey: true, // This is the key identifier, not the actual secret
        hostname: true,
        version: true,
        capabilities: true,
        isActive: true,
        createdAt: true,
        expiresAt: true,
        lastUsedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ apiKeys });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug } = await context.params;
    const body = await request.json();

    // Validate input
    const parseResult = createApiKeySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parseResult.error.flatten() },
        { status: 400 },
      );
    }

    // Verify admin access
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
      select: {
        id: true,
        workspaceMembers: {
          include: { user: true },
          where: {
            userId: session.user.id,
            role: { in: ['OWNER', 'ADMIN'] },
          },
        },
      },
    });

    if (!workspace || workspace.workspaceMembers.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Generate API key
    const apiKey = generateApiKey();
    const hashedKey = hashApiKey(apiKey);

    // Calculate expiry date
    const expiresAt = parseResult.data.expiresInDays
      ? new Date(
          Date.now() + parseResult.data.expiresInDays * 24 * 60 * 60 * 1000,
        )
      : null;

    // Get or create an orchestrator for the API key
    // Note: Orchestrator model doesn't have 'name' or 'type', it needs discipline and role
    // For simplicity, we'll use an existing orchestrator or the first one we find
    let orchestrator = await prisma.orchestrator.findFirst({
      where: {
        userId: session.user.id,
      },
    });

    // If no orchestrator exists, we can't create API keys yet
    if (!orchestrator) {
      return NextResponse.json(
        { error: 'No orchestrator found for user. Create an orchestrator profile first.' },
        { status: 400 },
      );
    }

    // Store hashed API key
    const credential = await prisma.daemonCredential.create({
      data: {
        apiKey: apiKey.substring(0, 16), // Store prefix for identification
        apiSecretHash: hashedKey,
        capabilities: parseResult.data.scopes || ['read'],
        metadata: {
          name: parseResult.data.name,
          createdBy: session.user.id,
        } as Prisma.InputJsonValue,
        isActive: true,
        expiresAt,
        orchestratorId: orchestrator.id,
        workspaceId: workspace.id,
      },
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        
        actorId: session.user.id, actorType: 'user',
        action: 'api_key.created',
        resourceType: 'api_key',
        resourceId: credential.id,
        metadata: {
          name: parseResult.data.name,
          expiresAt: expiresAt?.toISOString(),
        } as Prisma.InputJsonValue,
      },
    });

    // Return the API key only once
    return NextResponse.json({
      apiKey,
      id: credential.id,
      name: parseResult.data.name,
      expiresAt,
      message: 'Save this API key securely. It will not be shown again.',
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
