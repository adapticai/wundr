/**
 * Workspace Genesis API Route
 *
 * POST /api/workspaces/generate-org - Generate a full organizational structure
 * using @wundr/org-genesis and create workspace with Orchestrators, disciplines, and channels.
 *
 * This endpoint:
 * 1. Validates user permissions
 * 2. Generates org structure using org-genesis
 * 3. Creates workspace in database transaction
 * 4. Creates Orchestrator users for each discipline
 * 5. Creates channels for each discipline
 * 6. Auto-assigns Orchestrators to their discipline channels
 *
 * @module app/api/workspaces/generate-org/route
 */

import { prisma, Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  generateOrgInputSchema,
  type GenerateOrgInput as WizardInput,
} from '@/lib/validations/org-genesis';
import {
  createGenesisErrorResponse,
  GENESIS_ERROR_CODES,
} from '@/lib/validations/workspace-genesis';

import type {
  AgentApiResponse,
  DisciplineApiResponse,
  OrchestratorApiResponse,
} from '@/types/api';
import type { NextRequest } from 'next/server';

// Map wizard team sizes to org-genesis size tiers
function mapTeamSizeToOrgSize(
  teamSize: string
): 'small' | 'medium' | 'large' | 'enterprise' {
  switch (teamSize) {
    case '1-10':
      return 'small';
    case '11-50':
      return 'medium';
    case '51-200':
      return 'large';
    case '201-500':
    case '500+':
      return 'enterprise';
    default:
      return 'medium';
  }
}

// Map wizard org types to org-genesis industry types
function mapOrgTypeToIndustry(orgType: string): string {
  switch (orgType) {
    case 'startup':
      return 'technology';
    case 'enterprise':
      return 'technology';
    case 'agency':
      return 'marketing';
    case 'nonprofit':
      return 'custom';
    case 'government':
      return 'custom';
    case 'education':
      return 'custom';
    case 'other':
      return 'custom';
    default:
      return 'custom';
  }
}

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

type _GenesisResultDetailed = {
  manifest: {
    id: string;
    name: string;
    description?: string;
    mission?: string;
  };
  orchestrators: Array<{
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
    parentOrchestratorId?: string;
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
    orchestratorCount: number;
    disciplineCount: number;
    agentCount: number;
    generationTimeMs: number;
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NeolithResult = any;

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
  orchestrators: Array<{
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
    orchestratorId: string;
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
  orchestratorMappings: { total: number };
  disciplineMappings: { total: number };
  warnings: string[];
};

/**
 * POST /api/workspaces/generate-org
 *
 * Generate a complete organizational structure with workspace, Orchestrators, disciplines,
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
        createGenesisErrorResponse(
          'Authentication required',
          GENESIS_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // =========================================================================
    // 2. Parse & Validate Request Body
    // =========================================================================
    let body: unknown;
    let charterData:
      | {
          mission?: string;
          vision?: string;
          values?: string[];
          principles?: string[];
          governanceStyle?: string;
          communicationStyle?: string;
          emailDomain?: string;
        }
      | undefined;
    try {
      const rawBody = await request.json();
      // Extract charterData before schema validation (it's not part of the wizard schema)
      if (rawBody && typeof rawBody === 'object' && 'charterData' in rawBody) {
        charterData = (rawBody as Record<string, unknown>)
          .charterData as typeof charterData;
      }
      body = rawBody;
    } catch {
      return NextResponse.json(
        createGenesisErrorResponse(
          'Invalid JSON body',
          GENESIS_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const parseResult = generateOrgInputSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createGenesisErrorResponse(
          'Validation failed',
          GENESIS_ERROR_CODES.VALIDATION_ERROR,
          {
            errors: parseResult.error.flatten().fieldErrors,
          }
        ),
        { status: 400 }
      );
    }

    const wizardInput: WizardInput = parseResult.data;

    // Transform wizard input to org-genesis engine format
    const orgSlug = wizardInput.basicInfo.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const input = {
      organizationName: wizardInput.basicInfo.name,
      organizationType: wizardInput.basicInfo.type,
      description: wizardInput.description.description,
      strategy: wizardInput.description.strategy || '',
      targetAssets: wizardInput.config.assets || [],
      riskTolerance: wizardInput.config.riskTolerance,
      teamSize: wizardInput.config.teamSize,
      // Generate workspace name/slug from org name
      workspaceName: wizardInput.basicInfo.name,
      workspaceSlug: orgSlug,
      workspaceDescription: wizardInput.description.description,
      workspaceIconUrl: undefined,
      verbose: false,
      dryRun: false,
    };

    // =========================================================================
    // 3. Create or Verify Organization
    // =========================================================================
    // For onboarding flow, we create a new organization. For existing users,
    // they would specify an organizationId. Since the wizard doesn't provide one,
    // we create a new organization.

    // Check if org with this slug already exists
    let organization = await prisma.organization.findUnique({
      where: { slug: orgSlug },
    });

    if (organization) {
      // Organization exists - check if user has permission
      const membership = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId: session.user.id,
          },
        },
      });

      if (!membership) {
        return NextResponse.json(
          createGenesisErrorResponse(
            'An organization with this name already exists. Please choose a different name.',
            GENESIS_ERROR_CODES.ORG_NOT_FOUND
          ),
          { status: 409 }
        );
      }

      if (!['OWNER', 'ADMIN'].includes(membership.role)) {
        return NextResponse.json(
          createGenesisErrorResponse(
            'Insufficient permissions. Admin or Owner role required.',
            GENESIS_ERROR_CODES.FORBIDDEN
          ),
          { status: 403 }
        );
      }
    } else {
      // Create new organization
      organization = await prisma.organization.create({
        data: {
          name: input.organizationName,
          slug: orgSlug,
          description: input.description,
          organizationMembers: {
            create: {
              userId: session.user.id,
              role: 'OWNER',
            },
          },
        },
      });
      console.log('[generate-org] Created new organization:', organization.id);
    }

    // =========================================================================
    // 4. Check Workspace Slug Availability
    // =========================================================================
    const existingWorkspace = await prisma.workspace.findFirst({
      where: {
        organizationId: organization.id,
        slug: input.workspaceSlug,
      },
    });

    if (existingWorkspace) {
      return NextResponse.json(
        createGenesisErrorResponse(
          'A workspace with this slug already exists in the organization',
          GENESIS_ERROR_CODES.WORKSPACE_SLUG_EXISTS
        ),
        { status: 409 }
      );
    }

    // =========================================================================
    // 5. Generate Organization Structure using org-genesis
    // =========================================================================
    console.log('[generate-org] Starting org-genesis generation...');

    // Load org-genesis modules dynamically at runtime
    const { createGenesisEngine, migrateOrgGenesisResult } =
      await getOrgGenesisModules();

    const genesisEngine = createGenesisEngine({
      verbose: input.verbose,
    });

    let genesisResult: GenesisResult;
    try {
      genesisResult = await genesisEngine.generate(
        `Create an organization named "${input.organizationName}" focused on ${input.description}. Strategy: ${input.strategy}. Target assets: ${input.targetAssets.join(', ')}.`,
        {
          industry: mapOrgTypeToIndustry(input.organizationType) as any,
          size: mapTeamSizeToOrgSize(input.teamSize),
          customContext: `Risk tolerance: ${input.riskTolerance}. Team size preference: ${input.teamSize}. Organization type: ${input.organizationType}.`,
          dryRun: input.dryRun,
        }
      );

      console.log('[generate-org] Genesis generation complete:', {
        orchestratorCount: genesisResult.stats.orchestratorCount,
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
          }
        ),
        { status: 500 }
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
      orchestrators: genesisResult.orchestrators.map(
        (orchestrator: OrchestratorApiResponse) => ({
          id: orchestrator.id,
          name:
            orchestrator.identity?.name ||
            orchestrator.title ||
            'Unnamed Orchestrator',
          title: orchestrator.coreDirective,
          responsibilities: orchestrator.capabilities || [],
          disciplines: orchestrator.disciplineIds || [],
          persona: {
            communicationStyle: 'professional',
            decisionMakingStyle: 'data-driven',
            background: orchestrator.identity?.persona || '',
            traits: [],
          },
          kpis: [],
        })
      ),
      disciplines: genesisResult.disciplines.map(
        (discipline: DisciplineApiResponse) => ({
          id: discipline.id,
          name: discipline.name,
          description: discipline.description,
          orchestratorId: discipline.parentOrchestratorId || '',
          slug: discipline.slug,
          purpose:
            discipline.claudeMd?.objectives?.[0] || discipline.description,
          activities: discipline.hooks?.map(h => h.description) || [],
          capabilities: discipline.agentIds || [],
        })
      ),
      agents: genesisResult.agents.map((agent: AgentApiResponse) => ({
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
        orchestratorMappings: migrationResult.orchestratorMappings.total,
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
          }
        ),
        { status: 500 }
      );
    }

    // =========================================================================
    // 8. Create Workspace with Full Org Structure (Database Transaction)
    // =========================================================================
    console.log('[generate-org] Creating workspace and org structure...');

    const workspace = await prisma.$transaction(
      async tx => {
        // 8.1. Create Workspace
        const newWorkspace = await tx.workspace.create({
          data: {
            name: input.workspaceName,
            slug: input.workspaceSlug,
            description: input.workspaceDescription || input.description,
            avatarUrl: input.workspaceIconUrl,
            organizationId: organization.id,
            settings: {
              orgGenesis: {
                manifestId: genesisResult.manifest.id,
                generatedAt: new Date().toISOString(),
                orchestratorCount: genesisResult.stats.orchestratorCount,
                disciplineCount: genesisResult.stats.disciplineCount,
                agentCount: genesisResult.stats.agentCount,
              },
              charter: charterData?.mission
                ? { hasCharter: true, createdDuringGenesis: true }
                : { hasCharter: false },
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
              organizationId: organization.id,
              color: getColorForDiscipline(discipline.name),
              icon: getIconForDiscipline(discipline.name),
            },
          });
          disciplineMap.set(discipline.id, dbDiscipline.id);
        }

        // 8.4. Create Orchestrator Users
        const orchestratorMap = new Map<string, string>();
        for (const orchestrator of neolithResult.orchestrators) {
          // Find discipline ID for this Orchestrator
          const orchestratorDisciplines = neolithResult.disciplines.filter(
            (d: DisciplineApiResponse) =>
              orchestrator.disciplines.includes(d.id)
          );
          const primaryDisciplineId = orchestratorDisciplines[0]
            ? disciplineMap.get(orchestratorDisciplines[0].id)
            : undefined;

          // Create User for Orchestrator
          const orchestratorUser = await tx.user.create({
            data: {
              email: `${orchestrator.name.toLowerCase().replace(/\s+/g, '.')}@${charterData?.emailDomain || 'adaptic.ai'}`,
              name: orchestrator.name,
              displayName: orchestrator.title,
              isOrchestrator: true,
              status: 'ACTIVE',
              orchestratorConfig: {
                responsibilities: orchestrator.responsibilities,
                persona: {
                  communicationStyle: orchestrator.persona.communicationStyle,
                  decisionMakingStyle: orchestrator.persona.decisionMakingStyle,
                  background: orchestrator.persona.background,
                  traits: orchestrator.persona.traits,
                },
                kpis: orchestrator.kpis,
              } as Prisma.InputJsonValue,
            },
          });

          // Create Orchestrator Record
          await tx.orchestrator.create({
            data: {
              userId: orchestratorUser.id,
              organizationId: organization.id,
              workspaceId: newWorkspace.id,
              disciplineId: primaryDisciplineId,
              discipline: orchestratorDisciplines[0]?.name || 'General',
              role: orchestrator.title,
              status: 'OFFLINE',
              capabilities:
                orchestrator.responsibilities as Prisma.InputJsonValue,
            },
          });

          // Add Orchestrator to workspace as member
          await tx.workspaceMember.create({
            data: {
              workspaceId: newWorkspace.id,
              userId: orchestratorUser.id,
              role: 'MEMBER',
            },
          });

          orchestratorMap.set(orchestrator.id, orchestratorUser.id);

          // Create agent identity for each orchestrator
          await (tx as any).agentIdentity.create({
            data: {
              userId: orchestratorUser.id,
              corporateEmail: orchestratorUser.email,
              emailDomain: charterData?.emailDomain || 'adaptic.ai',
              communicationChannels: ['EMAIL'],
              provisioningStatus: 'active',
            },
          });
        }

        // 8.5. Create Channels for Disciplines
        const channelMap = new Map<string, string>();
        for (const discipline of neolithResult.disciplines) {
          const channelSlug =
            discipline.slug ||
            discipline.name.toLowerCase().replace(/\s+/g, '-');

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
                orchestratorId: discipline.orchestratorId,
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

          // 8.6. Auto-assign Orchestrator to Discipline Channel
          const orchestratorUserId = orchestratorMap.get(
            discipline.orchestratorId
          );
          if (orchestratorUserId) {
            await tx.channelMember.create({
              data: {
                channelId: channel.id,
                userId: orchestratorUserId,
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

        // Add all Orchestrators to #general
        for (const orchestratorUserId of orchestratorMap.values()) {
          await tx.channelMember.create({
            data: {
              channelId: generalChannel.id,
              userId: orchestratorUserId,
              role: 'MEMBER',
            },
          });
        }

        // 8.8. Create Agent-to-Agent DM Channels Between All Orchestrators
        try {
          const orchestratorUserIds = Array.from(orchestratorMap.values());
          const dmChannelCreations: Promise<unknown>[] = [];

          for (let i = 0; i < orchestratorUserIds.length; i++) {
            for (let j = i + 1; j < orchestratorUserIds.length; j++) {
              const [idA, idB] = [
                orchestratorUserIds[i],
                orchestratorUserIds[j],
              ].sort();
              const dmSlug = `agent-dm-${idA}-${idB}`;

              dmChannelCreations.push(
                tx.channel
                  .create({
                    data: {
                      name: dmSlug,
                      slug: dmSlug,
                      type: 'DM',
                      workspaceId: newWorkspace.id,
                      createdById: session.user.id,
                    },
                  })
                  .then(dmChannel =>
                    Promise.all([
                      tx.channelMember.create({
                        data: {
                          channelId: dmChannel.id,
                          userId: idA,
                          role: 'MEMBER',
                        },
                      }),
                      tx.channelMember.create({
                        data: {
                          channelId: dmChannel.id,
                          userId: idB,
                          role: 'MEMBER',
                        },
                      }),
                    ])
                  )
              );
            }
          }

          await Promise.all(dmChannelCreations);
        } catch (dmError) {
          console.error(
            '[generate-org] Failed to create agent DM channels (non-fatal):',
            dmError
          );
        }

        // 8.9. Return Workspace with Full Details
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
                    channelMembers: true,
                  },
                },
              },
            },
            workspaceMembers: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    displayName: true,
                    isOrchestrator: true,
                  },
                },
              },
            },
            _count: {
              select: {
                workspaceMembers: true,
                channels: true,
              },
            },
          },
        });
      },
      {
        maxWait: 30000, // 30 seconds
        timeout: 60000, // 60 seconds
      }
    );

    // =========================================================================
    // 9. Create Charter (if charterData provided)
    // =========================================================================
    if (charterData?.mission) {
      await (prisma as any).charter.create({
        data: {
          name: `${input.workspaceName} Charter`,
          mission: charterData.mission,
          vision: charterData.vision || null,
          values: charterData.values || [],
          principles: charterData.principles || [],
          governance: charterData.governanceStyle
            ? { style: charterData.governanceStyle }
            : {},
          security: {},
          communication: charterData.communicationStyle
            ? { style: charterData.communicationStyle }
            : {},
          organizationId: organization.id,
          isActive: true,
          version: 1,
        },
      });
      console.log(
        '[generate-org] Charter created for organization:',
        organization.id
      );
    }

    // =========================================================================
    // 10. Return Success Response
    // =========================================================================
    const duration = Date.now() - startTime;
    console.log('[generate-org] Workspace created successfully:', {
      workspaceId: workspace?.id,
      duration,
      orchestratorCount: genesisResult.stats.orchestratorCount,
      disciplineCount: genesisResult.stats.disciplineCount,
      channelCount: workspace?.channels?.length ?? 0,
    });

    return NextResponse.json(
      {
        data: workspace,
        // Include full neolith result for frontend preview
        manifest: neolithResult.manifest,
        orchestrators: neolithResult.orchestrators,
        disciplines: neolithResult.disciplines,
        agents: neolithResult.agents,
        metadata: neolithResult.metadata,
        genesis: {
          manifestId: genesisResult.manifest.id,
          orchestratorCount: genesisResult.stats.orchestratorCount,
          disciplineCount: genesisResult.stats.disciplineCount,
          agentCount: genesisResult.stats.agentCount,
          generationTimeMs: genesisResult.stats.generationTimeMs,
        },
        migration: {
          status: migrationResult.status,
          orchestratorMappings: migrationResult.orchestratorMappings.total,
          disciplineMappings: migrationResult.disciplineMappings.total,
          warnings: migrationResult.warnings,
        },
        message: 'Workspace created successfully with organizational structure',
        durationMs: duration,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/workspaces/generate-org] Error:', error);

    // Handle Prisma unique constraint errors
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        createGenesisErrorResponse(
          'A resource with this identifier already exists',
          GENESIS_ERROR_CODES.WORKSPACE_SLUG_EXISTS
        ),
        { status: 409 }
      );
    }

    return NextResponse.json(
      createGenesisErrorResponse(
        'An internal error occurred during workspace generation',
        GENESIS_ERROR_CODES.INTERNAL_ERROR,
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      ),
      { status: 500 }
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
