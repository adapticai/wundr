/**
 * AI Prompt Template Detail API Routes
 *
 * Handles operations on individual prompt templates including:
 * - Getting template details
 * - Updating templates
 * - Deleting templates
 * - Cloning templates
 * - Starring/unstarring templates
 *
 * Routes:
 * - GET /api/ai/prompts/:id - Get template details
 * - PATCH /api/ai/prompts/:id - Update template
 * - DELETE /api/ai/prompts/:id - Delete template
 * - POST /api/ai/prompts/:id/clone - Clone template
 * - POST /api/ai/prompts/:id/star - Star/unstar template
 * - POST /api/ai/prompts/:id/use - Increment usage count
 *
 * @module app/api/ai/prompts/[id]/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import {
  SYSTEM_TEMPLATES,
  extractVariables,
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
 * Validation schema for updating a prompt template
 */
const updatePromptSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(500).optional(),
  category: z
    .enum([
      'writing',
      'coding',
      'analysis',
      'brainstorming',
      'documentation',
      'communication',
      'workflow',
      'research',
      'custom',
    ])
    .optional(),
  content: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
  variables: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        required: z.boolean(),
        defaultValue: z.string().optional(),
        type: z.enum(['string', 'number', 'boolean', 'array']),
      })
    )
    .optional(),
  changeLog: z.string().optional(),
});

/**
 * GET /api/ai/prompts/:id
 *
 * Get details of a specific prompt template including version history.
 *
 * @param request - Next.js request object
 * @param context - Route context containing prompt ID
 * @returns Prompt template details
 */
export async function GET(
  _request: NextRequest,
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

    // Check if it's a system template
    if (id.startsWith('system-')) {
      const idx = parseInt(id.replace('system-', ''));
      const systemTemplate = SYSTEM_TEMPLATES[idx];

      if (!systemTemplate) {
        return NextResponse.json(
          { error: 'Template not found', code: 'NOT_FOUND' },
          { status: 404 }
        );
      }

      const template: PromptTemplate = {
        id,
        ...systemTemplate,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        usageCount: 0,
        starCount: 0,
      };

      return NextResponse.json({ data: template });
    }

    // Get template from database
    const template = await prisma.promptTemplate.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        versions: {
          orderBy: { version: 'desc' },
          take: 10,
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
                displayName: true,
              },
            },
          },
        },
        _count: {
          select: {
            stars: true,
            versions: true,
          },
        },
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check access (must be public, author, or workspace member)
    if (!template.isPublic && template.authorId !== session.user.id) {
      if (template.workspaceId) {
        const workspaceMember = await prisma.workspaceMember.findUnique({
          where: {
            workspaceId_userId: {
              workspaceId: template.workspaceId,
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

    // Check if user has starred this template
    const star = await prisma.promptTemplateStar.findUnique({
      where: {
        promptTemplateId_userId: {
          promptTemplateId: id,
          userId: session.user.id,
        },
      },
    });

    const response: PromptTemplate & { isStarred: boolean; versions: any[] } = {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category as PromptCategory,
      content: template.content,
      variables: (template.variables as any) || [],
      tags: template.tags,
      author:
        template.author?.displayName || template.author?.name || undefined,
      authorId: template.authorId || undefined,
      isPublic: template.isPublic,
      isSystem: template.isSystem,
      version: template.version,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      usageCount: template.usageCount,
      starCount: template._count.stars,
      workspaceId: template.workspaceId || undefined,
      isStarred: !!star,
      versions: template.versions.map(v => ({
        version: v.version,
        content: v.content,
        variables: v.variables,
        changeLog: v.changeLog,
        createdAt: v.createdAt,
        createdBy: {
          id: v.createdBy.id,
          name: v.createdBy.displayName || v.createdBy.name,
        },
      })),
    };

    return NextResponse.json({ data: response });
  } catch (error) {
    console.error('[GET /api/ai/prompts/:id] Error:', error);
    return NextResponse.json(
      { error: 'An internal error occurred', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/ai/prompts/:id
 *
 * Update a prompt template. Creates a new version if content changes.
 * Only the author can update a template.
 *
 * @param request - Next.js request object
 * @param context - Route context containing prompt ID
 * @returns Updated template
 */
export async function PATCH(
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

    // Cannot update system templates
    if (id.startsWith('system-')) {
      return NextResponse.json(
        { error: 'Cannot update system templates', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = updatePromptSchema.safeParse(body);

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

    // Get existing template
    const existing = await prisma.promptTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Template not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check ownership
    if (existing.authorId !== session.user.id) {
      return NextResponse.json(
        {
          error: 'Only the author can update this template',
          code: 'FORBIDDEN',
        },
        { status: 403 }
      );
    }

    // Check if content changed (requires new version)
    const contentChanged = data.content && data.content !== existing.content;
    const newVersion = contentChanged ? existing.version + 1 : existing.version;

    // Auto-extract variables if content changed but variables not provided
    let variables = data.variables;
    if (contentChanged && !variables) {
      const extractedVars = extractVariables(data.content!);
      variables = extractedVars.map(name => ({
        name,
        description: `Variable: ${name}`,
        required: true,
        type: 'string' as const,
      }));
    }

    // Update template
    const updated = await prisma.promptTemplate.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
        content: data.content,
        variables: variables ? (variables as any) : undefined,
        tags: data.tags,
        isPublic: data.isPublic,
        version: newVersion,
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
        _count: {
          select: {
            stars: true,
          },
        },
      },
    });

    // Create new version if content changed
    if (contentChanged) {
      await prisma.promptTemplateVersion.create({
        data: {
          promptTemplateId: id,
          version: newVersion,
          content: data.content!,
          variables: variables as any,
          changeLog: data.changeLog || `Updated to version ${newVersion}`,
          createdById: session.user.id,
        },
      });
    }

    const response: PromptTemplate = {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      category: updated.category as PromptCategory,
      content: updated.content,
      variables: (updated.variables as any) || [],
      tags: updated.tags,
      author: updated.author?.displayName || updated.author?.name || undefined,
      authorId: updated.authorId || undefined,
      isPublic: updated.isPublic,
      isSystem: updated.isSystem,
      version: updated.version,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      usageCount: updated.usageCount,
      starCount: updated._count.stars,
      workspaceId: updated.workspaceId || undefined,
    };

    return NextResponse.json({ data: response });
  } catch (error) {
    console.error('[PATCH /api/ai/prompts/:id] Error:', error);
    return NextResponse.json(
      { error: 'An internal error occurred', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ai/prompts/:id
 *
 * Delete a prompt template. Only the author can delete a template.
 * System templates cannot be deleted.
 *
 * @param request - Next.js request object
 * @param context - Route context containing prompt ID
 * @returns Success message
 */
export async function DELETE(
  _request: NextRequest,
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

    // Cannot delete system templates
    if (id.startsWith('system-')) {
      return NextResponse.json(
        { error: 'Cannot delete system templates', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Get existing template
    const existing = await prisma.promptTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Template not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check ownership
    if (existing.authorId !== session.user.id) {
      return NextResponse.json(
        {
          error: 'Only the author can delete this template',
          code: 'FORBIDDEN',
        },
        { status: 403 }
      );
    }

    // Delete template (cascade will delete versions and stars)
    await prisma.promptTemplate.delete({
      where: { id },
    });

    return NextResponse.json({
      message: 'Template deleted successfully',
      data: { id },
    });
  } catch (error) {
    console.error('[DELETE /api/ai/prompts/:id] Error:', error);
    return NextResponse.json(
      { error: 'An internal error occurred', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
