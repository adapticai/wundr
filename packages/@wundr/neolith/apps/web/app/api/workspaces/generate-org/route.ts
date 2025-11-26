/**
 * Workspace Genesis API Route
 *
 * POST /api/workspaces/generate-org - Generate a full organizational structure
 * using @wundr/org-genesis and create workspace with VPs, disciplines, and channels.
 *
 * This endpoint:
 * 1. Validates user permissions
 * 2. Generates org structure using org-genesis
 * 3. Creates workspace in database transaction
 * 4. Creates VP users for each discipline
 * 5. Creates channels for each discipline
 * 6. Auto-assigns VPs to their discipline channels
 *
 * @module app/api/workspaces/generate-org/route
 */

import { prisma } from '@neolith/database';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  generateOrgSchema,
  createGenesisErrorResponse,
  GENESIS_ERROR_CODES,
  type GenerateOrgInput,
} from '@/lib/validations/workspace-genesis';

import type { NextRequest } from 'next/server';

// Dynamic imports for org-genesis packages to avoid build-time resolution issues
// These packages are loaded at runtime when the API is called
async function getOrgGenesisModules() {
  const [orgGenesis, orgIntegration] = await Promise.all([
    import('@wundr.io/org-genesis'),
    import('@neolith/org-integration'),
  ]);
  return {
    createGenesisEngine: orgGenesis.createGenesisEngine,
    migrateOrgGenesisResult: orgIntegration.migrateOrgGenesisResult,
  };
}

// Type definitions for the dynamically imported modules
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GenesisResult = any;

// @ts-expect-error Reserved for future strict typing
type _GenesisResultDetailed = {
  manifest: { id: string; name: string; description?: string; mission?: string };
  vps: Array<{
    id: string;
    identity: { name: string; persona?: string };
    coreDirective: string;
    capabilities?: string[];
    disciplineIds?: string[];
  }>;
  disciplines: Array<{
    id: string;
    name: string;
    description: string;
    slug: string;
    parentVpId?: string;
    claudeMd?: { objectives?: string[] };
    hooks?: Array<{ description: string }>;
    agentIds?: string[];
  }>;
  agents: Array<{
    id: string;
    name: string;
    description: string;
    usedByDisciplines?: string[];
    capabilities?: Record<string, unknown>;
    charter?: string;
  }>;
  stats: {
    vpCount: number;
    disciplineCount: number;
    agentCount: number;
    generationTimeMs: number;
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NeolithResult = any;

// @ts-expect-error Reserved for future strict typing
type _NeolithResultDetailed = {
  manifest: {
    id: string;
    name: string;
    description: string;
    type: string;
    mission?: string;
    vision: string;
    values: string[];
    createdAt: string;
    schemaVersion: string;
  };
  vps: Array<{
    id: string;
    name: string;
    title: string;
    responsibilities: string[];
    disciplines: string[];
    persona: {
      communicationStyle: string;
      decisionMakingStyle: string;
      background: string;
      traits: string[];
    };
    kpis: string[];
  }>;
  disciplines: Array<{
    id: string;
    name: string;
    description: string;
    vpId: string;
    slug: string;
    purpose: string;
    activities: string[];
    capabilities: string[];
  }>;
  agents: Array<{
    id: string;
    name: string;
    role: string;
    disciplineId: string;
    capabilities: string[];
    instructions: string;
  }>;
  metadata: {
    generatedAt: string;
    generatorVersion: string;
    configHash: string;
    durationMs: number;
  };
};

type MigrationResult = {
  status: string;
  vpMappings: { total: number };
  disciplineMappings: { total: number };
  warnings: string[];
};

/**
 * POST /api/workspaces/generate-org
 *
 * Generate a complete organizational structure with workspace, VPs, disciplines,
 * and channels using the org-genesis engine.
 *
 * @param request - Next.js request with generation parameters
 * @returns Created workspace with org structure details
 *
 * @example
 * ```
 * POST /api/workspaces/generate-org
 * Content-Type: application/json
 *
 * {
 *   "organizationName": "Adaptic AI",
 *   "organizationId": "org_123",
 *   "workspaceName": "Engineering",
 *   "workspaceSlug": "engineering",
 *   "organizationType": "technology",
 *   "description": "AI-managed hedge fund platform",
 *   "strategy": "Quantitative trading using AI agents",
 *   "targetAssets": ["Crypto", "Equities", "Fixed Income"],
 *   "riskTolerance": "moderate",
 *   "teamSize": "medium"
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // =========================================================================
    // 1. Authentication & Authorization
    // =========================================================================
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createGenesisErrorResponse('Authentication required', GENESIS_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // =========================================================================
    // 2. Parse & Validate Request Body
    // =========================================================================
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createGenesisErrorResponse('Invalid JSON body', GENESIS_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    const parseResult = generateOrgSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createGenesisErrorResponse('Validation failed', GENESIS_ERROR_CODES.VALIDATION_ERROR, {
          errors: parseResult.error.flatten().fieldErrors,
        }),
        { status: 400 },
      );
    }

    const input: GenerateOrgInput = parseResult.data;

    // =========================================================================
    // 3. Verify Organization Membership & Permissions
    // =========================================================================
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: input.organizationId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        createGenesisErrorResponse(
          'Organization not found or access denied',
          GENESIS_ERROR_CODES.ORG_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    if (!['OWNER', 'ADMIN'].includes(membership.role)) {
      return NextResponse.json(
        createGenesisErrorResponse(
          'Insufficient permissions. Admin or Owner role required.',
          GENESIS_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // =========================================================================
    // 4. Check Workspace Slug Availability
    // =========================================================================
    const existingWorkspace = await prisma.workspace.findFirst({
      where: {
        organizationId: input.organizationId,
        slug: input.workspaceSlug,
      },
    });

    if (existingWorkspace) {
      return NextResponse.json(
        createGenesisErrorResponse(
          'A workspace with this slug already exists in the organization',
          GENESIS_ERROR_CODES.WORKSPACE_SLUG_EXISTS,
        ),
        { status: 409 },
      );
    }

    // =========================================================================
    // 5. Generate Organization Structure using org-genesis
    // =========================================================================
    console.log('[generate-org] Starting org-genesis generation...');

    // Load org-genesis modules dynamically at runtime
    const { createGenesisEngine, migrateOrgGenesisResult } = await getOrgGenesisModules();

    const genesisEngine = createGenesisEngine({
      verbose: input.verbose,
    });

    let genesisResult: GenesisResult;
    try {
      genesisResult = await genesisEngine.generate(
        `Create an organization named "${input.organizationName}" focused on ${input.description}. Strategy: ${input.strategy}. Target assets: ${input.targetAssets.join(', ')}.`,
        {
          industry: input.organizationType as any,
          size: input.teamSize as any,
          customContext: `Risk tolerance: ${input.riskTolerance}. Team size preference: ${input.teamSize}.`,
          dryRun: input.dryRun,
        },
      );

      console.log('[generate-org] Genesis generation complete:', {
        vpCount: genesisResult.stats.vpCount,
        disciplineCount: genesisResult.stats.disciplineCount,
        agentCount: genesisResult.stats.agentCount,
        duration: genesisResult.stats.generationTimeMs,
      });
    } catch (error) {
      console.error('[generate-org] Genesis generation failed:', error);
      return NextResponse.json(
        createGenesisErrorResponse(
          'Failed to generate organization structure',
          GENESIS_ERROR_CODES.GENERATION_FAILED,
          {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        ),
        { status: 500 },
      );
    }

    // =========================================================================
    // 6. Convert Genesis Result to Neolith Format
    // =========================================================================
    const neolithResult: NeolithResult = {
      manifest: {
        id: genesisResult.manifest.id,
        name: genesisResult.manifest.name,
        description: genesisResult.manifest.description || input.description,
        type: input.organizationType,
        mission: genesisResult.manifest.mission,
        vision: `Build a ${input.organizationType} organization focused on ${input.description}`,
        values: ['Excellence', 'Innovation', 'Integrity', 'Collaboration'],
        createdAt: new Date().toISOString(),
        schemaVersion: '1.0.0',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vps: genesisResult.vps.map((vp: any) => ({
        id: vp.id,
        name: vp.identity.name,
        title: vp.coreDirective,
        responsibilities: vp.capabilities || [],
        disciplines: vp.disciplineIds || [],
        persona: {
          communicationStyle: 'professional',
          decisionMakingStyle: 'data-driven',
          background: vp.identity.persona || '',
          traits: [],
        },
        kpis: [],
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      disciplines: genesisResult.disciplines.map((discipline: any) => ({
        id: discipline.id,
        name: discipline.name,
        description: discipline.description,
        vpId: discipline.parentVpId || '',
        slug: discipline.slug,
        purpose: discipline.claudeMd?.objectives?.[0] || discipline.description,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        activities: discipline.hooks?.map((h: any) => h.description) || [],
        capabilities: discipline.agentIds || [],
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      agents: genesisResult.agents.map((agent: any) => ({
        id: agent.id,
        name: agent.name,
        role: agent.description,
        disciplineId: agent.usedByDisciplines?.[0] || '',
        capabilities: Object.entries(agent.capabilities || {})
          .filter(([_, value]) => value === true)
          .map(([key]) => key),
        instructions: agent.charter || '',
      })),
      metadata: {
        generatedAt: new Date().toISOString(),
        generatorVersion: '1.0.0',
        configHash: '',
        durationMs: genesisResult.stats.generationTimeMs,
      },
    };

    // =========================================================================
    // 7. Migrate Using @neolith/org-integration (Dry Run)
    // =========================================================================
    let migrationResult: MigrationResult;
    try {
      migrationResult = await migrateOrgGenesisResult(neolithResult, {
        workspaceId: 'pending',
        dryRun: true, // Always dry run first to validate
        verbose: input.verbose,
        channelPrefix: input.workspaceSlug,
        privateChannels: false,
      });

      console.log('[generate-org] Migration validation complete:', {
        vpMappings: migrationResult.vpMappings.total,
        disciplineMappings: migrationResult.disciplineMappings.total,
        status: migrationResult.status,
      });
    } catch (error) {
      console.error('[generate-org] Migration validation failed:', error);
      return NextResponse.json(
        createGenesisErrorResponse(
          'Failed to validate organization migration',
          GENESIS_ERROR_CODES.MIGRATION_FAILED,
          {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        ),
        { status: 500 },
      );
    }

    // =========================================================================
    // 8. Create Workspace with Full Org Structure (Database Transaction)
    // =========================================================================
    console.log('[generate-org] Creating workspace and org structure...');

    const workspace = await prisma.$transaction(
      async (tx) => {
        // 8.1. Create Workspace
        const newWorkspace = await tx.workspace.create({
          data: {
            name: input.workspaceName,
            slug: input.workspaceSlug,
            description: input.workspaceDescription || input.description,
            avatarUrl: input.workspaceIconUrl,
            organizationId: input.organizationId,
            settings: {
              orgGenesis: {
                manifestId: genesisResult.manifest.id,
                generatedAt: new Date().toISOString(),
                vpCount: genesisResult.stats.vpCount,
                disciplineCount: genesisResult.stats.disciplineCount,
                agentCount: genesisResult.stats.agentCount,
              },
            } as Prisma.InputJsonValue,
          },
        });

        // 8.2. Add Creator as Workspace Admin
        await tx.workspaceMember.create({
          data: {
            workspaceId: newWorkspace.id,
            userId: session.user.id,
            role: 'ADMIN',
          },
        });

        // 8.3. Create Disciplines in Database
        const disciplineMap = new Map<string, string>();
        for (const discipline of neolithResult.disciplines) {
          const dbDiscipline = await tx.discipline.create({
            data: {
              name: discipline.name,
              description: discipline.description,
              organizationId: input.organizationId,
              color: getColorForDiscipline(discipline.name),
              icon: getIconForDiscipline(discipline.name),
            },
          });
          disciplineMap.set(discipline.id, dbDiscipline.id);
        }

        // 8.4. Create VP Users
        const vpMap = new Map<string, string>();
        for (const vp of neolithResult.vps) {
          // Find discipline ID for this VP
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const vpDisciplines = neolithResult.disciplines.filter((d: any) =>
            vp.disciplines.includes(d.id),
          );
          const primaryDisciplineId = vpDisciplines[0]
            ? disciplineMap.get(vpDisciplines[0].id)
            : undefined;

          // Create User for VP
          const vpUser = await tx.user.create({
            data: {
              email: `${vp.name.toLowerCase().replace(/\s+/g, '.')}@vp.${input.workspaceSlug}.local`,
              name: vp.name,
              displayName: vp.title,
              isVP: true,
              status: 'ACTIVE',
              vpConfig: {
                responsibilities: vp.responsibilities,
                persona: {
                  communicationStyle: vp.persona.communicationStyle,
                  decisionMakingStyle: vp.persona.decisionMakingStyle,
                  background: vp.persona.background,
                  traits: vp.persona.traits,
                },
                kpis: vp.kpis,
              } as Prisma.InputJsonValue,
            },
          });

          // Create VP Record
          await tx.vP.create({
            data: {
              userId: vpUser.id,
              organizationId: input.organizationId,
              workspaceId: newWorkspace.id,
              disciplineId: primaryDisciplineId,
              discipline: vpDisciplines[0]?.name || 'General',
              role: vp.title,
              status: 'OFFLINE',
              capabilities: vp.responsibilities as Prisma.InputJsonValue,
            },
          });

          // Add VP to workspace as member
          await tx.workspaceMember.create({
            data: {
              workspaceId: newWorkspace.id,
              userId: vpUser.id,
              role: 'MEMBER',
            },
          });

          vpMap.set(vp.id, vpUser.id);
        }

        // 8.5. Create Channels for Disciplines
        const channelMap = new Map<string, string>();
        for (const discipline of neolithResult.disciplines) {
          const channelSlug = discipline.slug || discipline.name.toLowerCase().replace(/\s+/g, '-');

          const channel = await tx.channel.create({
            data: {
              name: discipline.name,
              slug: channelSlug,
              description: discipline.description,
              topic: discipline.purpose,
              type: 'PUBLIC',
              workspaceId: newWorkspace.id,
              createdById: session.user.id,
              settings: {
                disciplineId: discipline.id,
                vpId: discipline.vpId,
                activities: discipline.activities,
                capabilities: discipline.capabilities,
              } as Prisma.InputJsonValue,
            },
          });

          channelMap.set(discipline.id, channel.id);

          // Add creator to channel
          await tx.channelMember.create({
            data: {
              channelId: channel.id,
              userId: session.user.id,
              role: 'ADMIN',
            },
          });

          // 8.6. Auto-assign VP to Discipline Channel
          const vpUserId = vpMap.get(discipline.vpId);
          if (vpUserId) {
            await tx.channelMember.create({
              data: {
                channelId: channel.id,
                userId: vpUserId,
                role: 'MEMBER',
              },
            });
          }
        }

        // 8.7. Create Default #general Channel
        const generalChannel = await tx.channel.create({
          data: {
            name: 'general',
            slug: 'general',
            type: 'PUBLIC',
            description: 'General discussion for the workspace',
            workspaceId: newWorkspace.id,
            createdById: session.user.id,
          },
        });

        await tx.channelMember.create({
          data: {
            channelId: generalChannel.id,
            userId: session.user.id,
            role: 'ADMIN',
          },
        });

        // Add all VPs to #general
        for (const vpUserId of vpMap.values()) {
          await tx.channelMember.create({
            data: {
              channelId: generalChannel.id,
              userId: vpUserId,
              role: 'MEMBER',
            },
          });
        }

        // 8.8. Return Workspace with Full Details
        return tx.workspace.findUnique({
          where: { id: newWorkspace.id },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            channels: {
              include: {
                _count: {
                  select: {
                    members: true,
                  },
                },
              },
            },
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    displayName: true,
                    isVP: true,
                  },
                },
              },
            },
            _count: {
              select: {
                members: true,
                channels: true,
              },
            },
          },
        });
      },
      {
        maxWait: 30000, // 30 seconds
        timeout: 60000, // 60 seconds
      },
    );

    // =========================================================================
    // 9. Return Success Response
    // =========================================================================
    const duration = Date.now() - startTime;
    console.log('[generate-org] Workspace created successfully:', {
      workspaceId: workspace?.id,
      duration,
      vpCount: genesisResult.stats.vpCount,
      disciplineCount: genesisResult.stats.disciplineCount,
      channelCount: workspace?.channels.length,
    });

    return NextResponse.json(
      {
        data: workspace,
        genesis: {
          manifestId: genesisResult.manifest.id,
          vpCount: genesisResult.stats.vpCount,
          disciplineCount: genesisResult.stats.disciplineCount,
          agentCount: genesisResult.stats.agentCount,
          generationTimeMs: genesisResult.stats.generationTimeMs,
        },
        migration: {
          status: migrationResult.status,
          vpMappings: migrationResult.vpMappings.total,
          disciplineMappings: migrationResult.disciplineMappings.total,
          warnings: migrationResult.warnings,
        },
        message: 'Workspace created successfully with organizational structure',
        durationMs: duration,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/workspaces/generate-org] Error:', error);

    // Handle Prisma unique constraint errors
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        createGenesisErrorResponse(
          'A resource with this identifier already exists',
          GENESIS_ERROR_CODES.WORKSPACE_SLUG_EXISTS,
        ),
        { status: 409 },
      );
    }

    return NextResponse.json(
      createGenesisErrorResponse(
        'An internal error occurred during workspace generation',
        GENESIS_ERROR_CODES.INTERNAL_ERROR,
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      ),
      { status: 500 },
    );
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get color for discipline based on name
 */
function getColorForDiscipline(name: string): string {
  const colorMap: Record<string, string> = {
    engineering: '#3B82F6', // blue
    product: '#10B981', // green
    design: '#F59E0B', // amber
    marketing: '#EF4444', // red
    sales: '#8B5CF6', // purple
    finance: '#14B8A6', // teal
    legal: '#6366F1', // indigo
    operations: '#EC4899', // pink
    hr: '#F97316', // orange
    research: '#06B6D4', // cyan
  };

  const key = name.toLowerCase();
  for (const [k, v] of Object.entries(colorMap)) {
    if (key.includes(k)) {
return v;
}
  }

  return '#6B7280'; // gray as default
}

/**
 * Get icon identifier for discipline based on name
 */
function getIconForDiscipline(name: string): string {
  const iconMap: Record<string, string> = {
    engineering: 'code',
    product: 'package',
    design: 'palette',
    marketing: 'megaphone',
    sales: 'trending-up',
    finance: 'dollar-sign',
    legal: 'scale',
    operations: 'cog',
    hr: 'users',
    research: 'microscope',
  };

  const key = name.toLowerCase();
  for (const [k, v] of Object.entries(iconMap)) {
    if (key.includes(k)) {
return v;
}
  }

  return 'folder'; // default icon
}
