/**
 * Security Audit Log API Route
 *
 * Handles fetching security audit logs for the user.
 *
 * Routes:
 * - GET /api/user/security-audit - Get security audit logs
 *
 * @module app/api/user/security-audit/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { SECURITY_ERROR_CODES } from '@/lib/validations/security';

import type { NextRequest } from 'next/server';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  eventType: string;
  severity: 'info' | 'warning' | 'critical';
  description: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * GET /api/user/security-audit
 *
 * Get security audit logs for the current user.
 *
 * @param request - Next.js request with optional query params
 * @returns List of audit log entries
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          code: SECURITY_ERROR_CODES.UNAUTHORIZED,
        },
        { status: 401 },
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const eventType = searchParams.get('eventType') || undefined;
    const severity = searchParams.get('severity') || undefined;

    // Fetch audit logs
    try {
      let logs;
      if (eventType || severity) {
        // Filtered query
        const whereConditions = [`user_id = ${session.user.id}`];
        if (eventType) whereConditions.push(`event_type = '${eventType}'`);
        if (severity) whereConditions.push(`severity = '${severity}'`);

        logs = await prisma.$queryRawUnsafe<
          Array<{
            id: string;
            created_at: Date;
            event_type: string;
            severity: string;
            description: string;
            ip_address: string | null;
            user_agent: string | null;
            metadata: string | null;
          }>
        >(
          `
          SELECT id, created_at, event_type, severity, description,
                 ip_address, user_agent, metadata
          FROM security_audit_logs
          WHERE ${whereConditions.join(' AND ')}
          ORDER BY created_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `,
        );
      } else {
        logs = await prisma.$queryRaw<
          Array<{
            id: string;
            created_at: Date;
            event_type: string;
            severity: string;
            description: string;
            ip_address: string | null;
            user_agent: string | null;
            metadata: string | null;
          }>
        >`
          SELECT id, created_at, event_type, severity, description,
                 ip_address, user_agent, metadata
          FROM security_audit_logs
          WHERE user_id = ${session.user.id}
          ORDER BY created_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `;
      }

      const entries: AuditLogEntry[] = logs.map(log => ({
        id: log.id,
        timestamp: log.created_at.toISOString(),
        eventType: log.event_type,
        severity: log.severity as 'info' | 'warning' | 'critical',
        description: log.description,
        ipAddress: log.ip_address || undefined,
        userAgent: log.user_agent || undefined,
        metadata: log.metadata ? JSON.parse(log.metadata) : undefined,
      }));

      return NextResponse.json({
        success: true,
        data: {
          entries,
          limit,
          offset,
        },
      });
    } catch (dbError) {
      // Table might not exist yet - return empty array
      console.warn('[GET /api/user/security-audit] Table not found:', dbError);
      return NextResponse.json({
        success: true,
        data: {
          entries: [],
          limit,
          offset,
        },
      });
    }
  } catch (error) {
    console.error('[GET /api/user/security-audit] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An internal error occurred',
        code: SECURITY_ERROR_CODES.INTERNAL_ERROR,
      },
      { status: 500 },
    );
  }
}
