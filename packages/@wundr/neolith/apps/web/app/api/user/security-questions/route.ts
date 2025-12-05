/**
 * Security Questions API Route
 *
 * Handles managing security questions for account recovery.
 *
 * Routes:
 * - GET /api/user/security-questions - Get security questions (without answers)
 * - POST /api/user/security-questions - Set/update security questions
 *
 * @module app/api/user/security-questions/route
 */

import * as crypto from 'crypto';

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { hashPassword, logSecurityEvent } from '@/lib/services/security';
import {
  securityQuestionsSchema,
  SECURITY_ERROR_CODES,
} from '@/lib/validations/security';

import type { NextRequest } from 'next/server';

export interface SecurityQuestion {
  id: string;
  question: string;
}

/**
 * GET /api/user/security-questions
 *
 * Get user's security questions (without answers).
 *
 * @param request - Next.js request
 * @returns List of security questions
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

    // Fetch security questions
    try {
      const questions = await prisma.$queryRaw<
        Array<{
          id: string;
          question: string;
        }>
      >`
        SELECT id, question
        FROM security_questions
        WHERE user_id = ${session.user.id}
        ORDER BY created_at
      `;

      const securityQuestions: SecurityQuestion[] = questions.map(q => ({
        id: q.id,
        question: q.question,
      }));

      return NextResponse.json({
        success: true,
        data: {
          questions: securityQuestions,
        },
      });
    } catch (dbError) {
      // Table might not exist yet
      console.warn('[GET /api/user/security-questions] Table not found:', dbError);
      return NextResponse.json({
        success: true,
        data: {
          questions: [],
        },
      });
    }
  } catch (error) {
    console.error('[GET /api/user/security-questions] Error:', error);
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

/**
 * POST /api/user/security-questions
 *
 * Set or update security questions.
 *
 * @param request - Request with security questions and answers
 * @returns Success message
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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

    // Parse and validate request body
    const body = await request.json();
    const parseResult = securityQuestionsSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          code: SECURITY_ERROR_CODES.VALIDATION_ERROR,
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { questions } = parseResult.data;

    try {
      // Delete existing questions
      await prisma.$executeRaw`
        DELETE FROM security_questions
        WHERE user_id = ${session.user.id}
      `;

      // Insert new questions with hashed answers
      for (const q of questions) {
        const hashedAnswer = await hashPassword(
          q.answer.toLowerCase().trim(),
        );
        await prisma.$executeRaw`
          INSERT INTO security_questions (id, user_id, question, answer_hash, created_at)
          VALUES (
            ${crypto.randomUUID()},
            ${session.user.id},
            ${q.question},
            ${hashedAnswer},
            ${new Date()}
          )
        `;
      }
    } catch (dbError) {
      console.error('[POST /api/user/security-questions] DB error:', dbError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to save security questions',
          code: SECURITY_ERROR_CODES.INTERNAL_ERROR,
        },
        { status: 500 },
      );
    }

    // Log security event
    await logSecurityEvent({
      userId: session.user.id,
      eventType: 'security_questions_updated',
      severity: 'info',
      description: `Updated ${questions.length} security questions`,
      metadata: { count: questions.length },
      ipAddress:
        request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Security questions updated successfully',
    });
  } catch (error) {
    console.error('[POST /api/user/security-questions] Error:', error);
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
