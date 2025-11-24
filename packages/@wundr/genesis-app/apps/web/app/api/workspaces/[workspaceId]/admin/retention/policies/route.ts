/**
 * Retention Policies API Routes
 *
 * Handles data retention policy management for enterprise compliance.
 * Allows creation, listing, and management of retention policies.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/admin/retention/policies - List policies
 * - POST /api/workspaces/:workspaceId/admin/retention/policies - Create policy
 *
 * @module app/api/workspaces/[workspaceId]/admin/retention/policies/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@genesis/database';
import { redis } from '@genesis/core/redis';
import {
  RetentionService,
  AuditServiceImpl,
  type RetentionDatabaseClient,
  type RedisClient as RetentionRedisClient,
  type AuditDatabaseClient,
  type AuditRedisClient,
} from '@genesis/core';

import { auth } from '@/lib/auth';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * GET /api/workspaces/:workspaceId/admin/retention/policies
 *
 * List all retention policies for the workspace.
 * Requires admin or owner role.
 *
 * @param request - Next.js request
 * @param context - Route context containing workspace ID
 * @returns Array of retention policies
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/admin/retention/policies
 * ```
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = await context.params;

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (!membership || !['admin', 'owner', 'ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const retentionService = new RetentionService({
      prisma: prisma as unknown as RetentionDatabaseClient,
      redis: redis as unknown as RetentionRedisClient,
    });

    const policies = await retentionService.getPolicies(workspaceId);

    return NextResponse.json({ policies });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/admin/retention/policies] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch policies' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/admin/retention/policies
 *
 * Create a new retention policy for the workspace.
 * Requires admin or owner role.
 *
 * @param request - Next.js request with policy data
 * @param context - Route context containing workspace ID
 * @returns The created retention policy
 *
 * @example
 * ```
 * POST /api/workspaces/ws_123/admin/retention/policies
 * {
 *   "name": "90 Day Message Retention",
 *   "rules": [{ "resourceType": "message", "action": "delete", "retentionDays": 90 }]
 * }
 * ```
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = await context.params;

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (!membership || !['admin', 'owner', 'ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.rules || !Array.isArray(body.rules)) {
      return NextResponse.json(
        { error: 'Name and rules are required' },
        { status: 400 }
      );
    }

    const retentionService = new RetentionService({
      prisma: prisma as unknown as RetentionDatabaseClient,
      redis: redis as unknown as RetentionRedisClient,
    });

    const auditService = new AuditServiceImpl({
      prisma: prisma as unknown as AuditDatabaseClient,
      redis: redis as unknown as AuditRedisClient,
    });

    const policy = await retentionService.createPolicy(
      workspaceId,
      body.name,
      body.rules,
      session.user.id,
      body.description
    );

    // Log audit event
    await auditService.log({
      action: 'settings.updated',
      actorId: session.user.id,
      actorType: 'user',
      actorName: session.user.name || 'Unknown',
      resourceType: 'retention_policy',
      resourceId: policy.id,
      resourceName: policy.name,
      workspaceId,
      metadata: { action: 'created' },
    });

    return NextResponse.json(policy);
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/admin/retention/policies] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create policy' },
      { status: 500 }
    );
  }
}
