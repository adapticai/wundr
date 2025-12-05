/**
 * AI Prompt Template Clone API Route
 *
 * Handles cloning prompt templates to create new copies.
 *
 * Routes:
 * - POST /api/ai/prompts/:id/clone - Clone template
 *
 * @module app/api/ai/prompts/[id]/clone/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import {
  SYSTEM_TEMPLATES,
  type PromptTemplate,
  type PromptCategory,
} from '@/lib/ai/prompt-templates';

import type { NextRequest } from 'next/server';

/**
 * Route context with prompt ID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Validation schema for cloning a prompt template
 */
const clonePromptSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  workspaceId: z.string().optional(),
  isPublic: z.boolean().optional(),
});

/**
 * POST /api/ai/prompts/:id/clone
 *
 * Clone a prompt template, creating a new template owned by the current user.
 * Can optionally specify a new name and workspace for the clone.
 *
 * Request Body:
 * - name: New name for the cloned template (optional, defaults to "Copy of [original name]")
 * - workspaceId: Workspace to clone to (optional)
 * - isPublic: Whether cloned template is public (optional, defaults to false)
 *
 * @param request - Next.js request object
 * @param context - Route context containing prompt ID
 * @returns Cloned template
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const params = await context.params;
    const { id } = params;

    // Parse and validate request body
    const body = await request.json();
    const validationResult = clonePromptSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          code: 'VALIDATION_ERROR',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Get template to clone
    let sourceTemplate: Partial<PromptTemplate> | null = null;

    if (id.startsWith('system-')) {
      // Clone system template
      const idx = parseInt(id.replace('system-', ''));
      const systemTemplate = SYSTEM_TEMPLATES[idx];

      if (!systemTemplate) {
        return NextResponse.json(
          { error: 'Template not found', code: 'NOT_FOUND' },
          { status: 404 }
        );
      }

      sourceTemplate = systemTemplate;
    } else {
      // Clone user template
      const dbTemplate = await prisma.promptTemplate.findUnique({
        where: { id },
      });

      if (!dbTemplate) {
        return NextResponse.json(
          { error: 'Template not found', code: 'NOT_FOUND' },
          { status: 404 }
        );
      }

      // Check access
      if (!dbTemplate.isPublic && dbTemplate.authorId !== session.user.id) {
        if (dbTemplate.workspaceId) {
          const workspaceMember = await prisma.workspaceMember.findUnique({
            where: {
              workspaceId_userId: {
                workspaceId: dbTemplate.workspaceId,
                userId: session.user.id,
              },
            },
          });

          if (!workspaceMember) {
            return NextResponse.json(
              { error: 'Access denied', code: 'FORBIDDEN' },
              { status: 403 }
            );
          }
        } else {
          return NextResponse.json(
            { error: 'Access denied', code: 'FORBIDDEN' },
            { status: 403 }
          );
        }
      }

      sourceTemplate = {
        name: dbTemplate.name,
        description: dbTemplate.description,
        category: dbTemplate.category,
        content: dbTemplate.content,
        variables: dbTemplate.variables as any,
        tags: dbTemplate.tags,
      };
    }

    // Create cloned template
    const clonedName = data.name || `Copy of ${sourceTemplate.name}`;

    const cloned = await prisma.promptTemplate.create({
      data: {
        name: clonedName,
        description: sourceTemplate.description!,
        category: sourceTemplate.category!,
        content: sourceTemplate.content!,
        variables: sourceTemplate.variables as any,
        tags: sourceTemplate.tags || [],
        isPublic: data.isPublic ?? false,
        isSystem: false,
        version: 1,
        usageCount: 0,
        starCount: 0,
        authorId: session.user.id,
        workspaceId: data.workspaceId || null,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Create initial version for cloned template
    await prisma.promptTemplateVersion.create({
      data: {
        promptTemplateId: cloned.id,
        version: 1,
        content: sourceTemplate.content!,
        variables: sourceTemplate.variables as any,
        changeLog: `Cloned from template ${id}`,
        createdById: session.user.id,
      },
    });

    const response: PromptTemplate = {
      id: cloned.id,
      name: cloned.name,
      description: cloned.description,
      category: cloned.category as PromptCategory,
      content: cloned.content,
      variables: (cloned.variables as any) || [],
      tags: cloned.tags,
      author: cloned.author?.displayName || cloned.author?.name || undefined,
      authorId: cloned.authorId || undefined,
      isPublic: cloned.isPublic,
      isSystem: cloned.isSystem,
      version: cloned.version,
      createdAt: cloned.createdAt,
      updatedAt: cloned.updatedAt,
      usageCount: cloned.usageCount,
      starCount: cloned.starCount,
      workspaceId: cloned.workspaceId || undefined,
    };

    return NextResponse.json({ data: response }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/ai/prompts/:id/clone] Error:', error);
    return NextResponse.json(
      { error: 'An internal error occurred', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
