/**
 * AI Prompt Templates API Routes
 *
 * Handles CRUD operations for AI prompt templates including:
 * - Listing templates with filtering and search
 * - Creating new templates
 * - Importing/exporting templates
 *
 * Routes:
 * - GET /api/ai/prompts - List and search templates
 * - POST /api/ai/prompts - Create new template
 *
 * @module app/api/ai/prompts/route
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
 * Validation schema for creating a prompt template
 */
const createPromptSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  category: z.enum([
    'writing',
    'coding',
    'analysis',
    'brainstorming',
    'documentation',
    'communication',
    'workflow',
    'research',
    'custom',
  ]),
  content: z.string().min(1),
  tags: z.array(z.string()).optional().default([]),
  isPublic: z.boolean().optional().default(false),
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
});

/**
 * Query parameters for listing templates
 */
const listQuerySchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  sortBy: z
    .enum(['name', 'usage', 'stars', 'recent'])
    .optional()
    .default('recent'),
  includeSystem: z.string().optional().default('true'),
  starred: z.string().optional(),
  workspaceId: z.string().optional(),
  limit: z.string().optional().default('50'),
  offset: z.string().optional().default('0'),
});

/**
 * GET /api/ai/prompts
 *
 * List and search AI prompt templates. Supports filtering by category,
 * search query, workspace, and starred status.
 *
 * Query Parameters:
 * - category: Filter by category
 * - search: Search query for name, description, or tags
 * - sortBy: Sort order (name, usage, stars, recent)
 * - includeSystem: Include system templates (default: true)
 * - starred: Only starred templates (true/false)
 * - workspaceId: Filter by workspace
 * - limit: Results per page (default: 50)
 * - offset: Pagination offset (default: 0)
 *
 * @param request - Next.js request object
 * @returns List of prompt templates
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const queryResult = listQuerySchema.safeParse(searchParams);

    if (!queryResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          code: 'VALIDATION_ERROR',
          details: queryResult.error.issues,
        },
        { status: 400 }
      );
    }

    const {
      category,
      search,
      sortBy,
      includeSystem,
      starred,
      workspaceId,
      limit,
      offset,
    } = queryResult.data;

    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);

    // Build where clause for database query
    const where: any = {
      OR: [{ isPublic: true }, { authorId: session.user.id }],
    };

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ];
    }

    if (workspaceId) {
      where.workspaceId = workspaceId;
    }

    // Query user templates from database
    const [userTemplates, total, starredTemplateIds] = await Promise.all([
      prisma.promptTemplate.findMany({
        where,
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
              versions: true,
            },
          },
        },
        orderBy:
          sortBy === 'name'
            ? { name: 'asc' }
            : sortBy === 'usage'
              ? { usageCount: 'desc' }
              : sortBy === 'stars'
                ? { starCount: 'desc' }
                : { updatedAt: 'desc' },
        take: limitNum,
        skip: offsetNum,
      }),
      prisma.promptTemplate.count({ where }),
      // Get user's starred template IDs
      prisma.promptTemplateStar.findMany({
        where: { userId: session.user.id },
        select: { promptTemplateId: true },
      }),
    ]);

    const starredIds = new Set(starredTemplateIds.map(s => s.promptTemplateId));

    // Convert database templates to API format
    let templates: PromptTemplate[] = userTemplates.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category as PromptCategory,
      content: t.content,
      variables: (t.variables as any) || [],
      tags: t.tags,
      author: t.author?.displayName || t.author?.name || undefined,
      authorId: t.authorId || undefined,
      isPublic: t.isPublic,
      isSystem: t.isSystem,
      version: t.version,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      usageCount: t.usageCount,
      starCount: t._count.stars,
      workspaceId: t.workspaceId || undefined,
    }));

    // Add system templates if requested
    if (includeSystem === 'true') {
      const systemTemplates: PromptTemplate[] = SYSTEM_TEMPLATES.map(
        (t, idx) => ({
          id: `system-${idx}`,
          ...t,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          usageCount: 0,
          starCount: 0,
        })
      );

      // Apply category filter to system templates
      const filteredSystemTemplates = category
        ? systemTemplates.filter(t => t.category === category)
        : systemTemplates;

      // Apply search filter to system templates
      const searchedSystemTemplates = search
        ? filteredSystemTemplates.filter(
            t =>
              t.name.toLowerCase().includes(search.toLowerCase()) ||
              t.description.toLowerCase().includes(search.toLowerCase()) ||
              t.tags.some(tag =>
                tag.toLowerCase().includes(search.toLowerCase())
              )
          )
        : filteredSystemTemplates;

      templates = [...searchedSystemTemplates, ...templates];
    }

    // Filter by starred if requested
    if (starred === 'true') {
      templates = templates.filter(t => starredIds.has(t.id));
    }

    // Sort combined templates
    templates.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'usage':
          return b.usageCount - a.usageCount;
        case 'stars':
          return b.starCount - a.starCount;
        case 'recent':
          return b.updatedAt.getTime() - a.updatedAt.getTime();
        default:
          return 0;
      }
    });

    // Add isStarred flag
    const templatesWithStarred = templates.map(t => ({
      ...t,
      isStarred: starredIds.has(t.id),
    }));

    return NextResponse.json({
      data: templatesWithStarred,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < total,
      },
    });
  } catch (error) {
    console.error('[GET /api/ai/prompts] Error:', error);
    return NextResponse.json(
      { error: 'An internal error occurred', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/prompts
 *
 * Create a new AI prompt template. Automatically extracts variables
 * from the template content if not provided.
 *
 * Request Body:
 * - name: Template name
 * - description: Template description
 * - category: Template category
 * - content: Template content with {{variable}} placeholders
 * - tags: Array of tags (optional)
 * - isPublic: Whether template is publicly visible (optional)
 * - variables: Array of variable definitions (optional, auto-extracted if not provided)
 *
 * @param request - Next.js request object
 * @returns Created template
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = createPromptSchema.safeParse(body);

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

    // Auto-extract variables if not provided
    let variables = data.variables;
    if (!variables || variables.length === 0) {
      const extractedVars = extractVariables(data.content);
      variables = extractedVars.map(name => ({
        name,
        description: `Variable: ${name}`,
        required: true,
        type: 'string' as const,
      }));
    }

    // Create template in database
    const template = await prisma.promptTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
        content: data.content,
        variables: variables as any,
        tags: data.tags,
        isPublic: data.isPublic,
        isSystem: false,
        version: 1,
        usageCount: 0,
        starCount: 0,
        authorId: session.user.id,
        workspaceId: body.workspaceId || null,
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

    // Create initial version
    await prisma.promptTemplateVersion.create({
      data: {
        promptTemplateId: template.id,
        version: 1,
        content: data.content,
        variables: variables as any,
        changeLog: 'Initial version',
        createdById: session.user.id,
      },
    });

    const response: PromptTemplate = {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category as PromptCategory,
      content: template.content,
      variables: variables,
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
      starCount: template.starCount,
      workspaceId: template.workspaceId || undefined,
    };

    return NextResponse.json({ data: response }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/ai/prompts] Error:', error);
    return NextResponse.json(
      { error: 'An internal error occurred', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
