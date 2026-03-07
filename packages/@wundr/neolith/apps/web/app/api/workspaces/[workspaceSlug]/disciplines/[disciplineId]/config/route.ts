/**
 * Discipline Configuration API Routes
 *
 * Manages the configuration bundle for a specific discipline.
 * Configuration includes CLAUDE.md settings, MCP server definitions, and hook rules.
 *
 * Since the discipline Prisma model has no dedicated config column, configuration
 * is stored as a JSON string embedded in the discipline description using a
 * sentinel pattern: the raw description is split from the serialized config
 * at a well-known delimiter "<!--config:". This keeps the schema stable while
 * allowing rich configuration data without a migration.
 *
 * Format stored in `discipline.description`:
 *   "<human description><!--config:<base64-encoded JSON config>"
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/disciplines/:disciplineId/config
 *     Retrieve the current configuration for a discipline
 * - PUT /api/workspaces/:workspaceSlug/disciplines/:disciplineId/config
 *     Update (replace) the configuration for a discipline
 *
 * @module app/api/workspaces/[workspaceSlug]/disciplines/[disciplineId]/config/route
 */

import { prisma, Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  updateDisciplineConfigSchema,
  createErrorResponse,
  DISCIPLINE_ERROR_CODES,
} from '@/lib/validations/discipline';

import type {
  UpdateDisciplineConfigInput,
  ClaudeMdConfigInput,
  MCPServerConfigInput,
  HookConfigInput,
} from '@/lib/validations/discipline';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspaceSlug and disciplineId parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; disciplineId: string }>;
}

/** Delimiter used to separate human description from serialized config */
const CONFIG_DELIMITER = '<!--config:';

/**
 * Discipline configuration data structure stored in the description field
 */
interface StoredDisciplineConfig {
  claudeMd?: Partial<ClaudeMdConfigInput>;
  mcpServers?: MCPServerConfigInput[];
  hooks?: HookConfigInput[];
  updatedAt?: string;
  version?: number;
}

/**
 * Parse config from the discipline description field.
 * Returns { description, config } where description is the human-readable part
 * and config is the parsed configuration object.
 */
function parseDescriptionConfig(raw: string | null): {
  description: string;
  config: StoredDisciplineConfig;
} {
  if (!raw) return { description: '', config: {} };

  const delimIdx = raw.indexOf(CONFIG_DELIMITER);
  if (delimIdx === -1) {
    return { description: raw, config: {} };
  }

  const description = raw.slice(0, delimIdx);
  const encoded = raw.slice(delimIdx + CONFIG_DELIMITER.length);

  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    const config: StoredDisciplineConfig = JSON.parse(decoded);
    return { description, config };
  } catch {
    // If parsing fails, treat the whole field as description
    return { description: raw, config: {} };
  }
}

/**
 * Serialize config back into the combined description string.
 */
function serializeDescriptionConfig(
  description: string,
  config: StoredDisciplineConfig
): string {
  const encoded = Buffer.from(JSON.stringify(config)).toString('base64');
  return `${description}${CONFIG_DELIMITER}${encoded}`;
}

/**
 * Helper: resolve workspace access and load the discipline.
 */
async function getDisciplineWithAccess(
  workspaceSlug: string,
  disciplineId: string,
  userId: string
) {
  const workspace = await prisma.workspace.findFirst({
    where: { OR: [{ slug: workspaceSlug }, { id: workspaceSlug }] },
    select: { id: true, name: true, organizationId: true },
  });

  if (!workspace) return null;

  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: workspace.organizationId,
        userId,
      },
    },
    select: { role: true },
  });

  if (!orgMembership) return null;

  const discipline = await prisma.discipline.findFirst({
    where: {
      id: disciplineId,
      organizationId: workspace.organizationId,
    },
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      icon: true,
      organizationId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!discipline) return null;

  return { workspace, orgMembership, discipline };
}

/**
 * GET /api/workspaces/:workspaceSlug/disciplines/:disciplineId/config
 *
 * Retrieve the full configuration for a discipline.
 * Returns the CLAUDE.md settings, MCP server configurations, and hook rules.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          DISCIPLINE_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const params = await context.params;
    const { workspaceSlug, disciplineId } = params;

    const access = await getDisciplineWithAccess(
      workspaceSlug,
      disciplineId,
      session.user.id
    );

    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Discipline not found or access denied',
          DISCIPLINE_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    const { description, config } = parseDescriptionConfig(
      access.discipline.description
    );

    return NextResponse.json({
      data: {
        disciplineId: access.discipline.id,
        disciplineName: access.discipline.name,
        description,
        config: {
          claudeMd: config.claudeMd ?? null,
          mcpServers: config.mcpServers ?? [],
          hooks: config.hooks ?? [],
          version: config.version ?? 1,
          updatedAt: config.updatedAt ?? access.discipline.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/disciplines/:disciplineId/config] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        DISCIPLINE_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * PUT /api/workspaces/:workspaceSlug/disciplines/:disciplineId/config
 *
 * Update (replace) the configuration for a discipline.
 * Only provided fields are replaced; absent fields retain existing values.
 * Requires ADMIN or OWNER role.
 *
 * Request Body (all fields optional):
 * - claudeMd: Partial CLAUDE.md configuration (role, context, rules, objectives, constraints)
 * - mcpServers: Array of MCP server configurations (replaces existing list)
 * - hooks: Array of hook configurations (replaces existing list)
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          DISCIPLINE_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const params = await context.params;
    const { workspaceSlug, disciplineId } = params;

    const access = await getDisciplineWithAccess(
      workspaceSlug,
      disciplineId,
      session.user.id
    );

    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Discipline not found or access denied',
          DISCIPLINE_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    if (!['OWNER', 'ADMIN'].includes(access.orgMembership.role)) {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions. Organization admin or owner role required.',
          DISCIPLINE_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          DISCIPLINE_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const parseResult = updateDisciplineConfigSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          DISCIPLINE_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const input: UpdateDisciplineConfigInput = parseResult.data;

    // Parse existing config so we can merge
    const { description, config: existingConfig } = parseDescriptionConfig(
      access.discipline.description
    );

    // Merge: provided fields replace existing, absent fields are kept
    const updatedConfig: StoredDisciplineConfig = {
      claudeMd:
        input.claudeMd !== undefined
          ? { ...existingConfig.claudeMd, ...input.claudeMd }
          : existingConfig.claudeMd,
      mcpServers:
        input.mcpServers !== undefined
          ? input.mcpServers
          : existingConfig.mcpServers,
      hooks: input.hooks !== undefined ? input.hooks : existingConfig.hooks,
      version: (existingConfig.version ?? 1) + 1,
      updatedAt: new Date().toISOString(),
    };

    const newRawDescription = serializeDescriptionConfig(
      description,
      updatedConfig
    );

    await prisma.discipline.update({
      where: { id: disciplineId },
      data: { description: newRawDescription },
    });

    return NextResponse.json({
      data: {
        disciplineId: access.discipline.id,
        disciplineName: access.discipline.name,
        description,
        config: {
          claudeMd: updatedConfig.claudeMd ?? null,
          mcpServers: updatedConfig.mcpServers ?? [],
          hooks: updatedConfig.hooks ?? [],
          version: updatedConfig.version,
          updatedAt: updatedConfig.updatedAt,
        },
      },
      message: 'Discipline configuration updated successfully',
    });
  } catch (error) {
    console.error(
      '[PUT /api/workspaces/:workspaceSlug/disciplines/:disciplineId/config] Error:',
      error
    );

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return NextResponse.json(
        createErrorResponse(
          'Discipline not found',
          DISCIPLINE_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        DISCIPLINE_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
