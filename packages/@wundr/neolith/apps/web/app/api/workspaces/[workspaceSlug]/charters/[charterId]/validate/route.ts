/**
 * Workspace-Scoped Charter Validation API Route
 *
 * Validates a charter document without persisting it. Returns structured
 * validation results including errors (blocking) and warnings (non-blocking).
 *
 * Routes:
 * - POST /api/workspaces/:workspaceSlug/charters/:charterId/validate
 *     Validate a charter without saving
 *
 * @module app/api/workspaces/[workspaceSlug]/charters/[charterId]/validate/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import {
  createErrorResponse,
  CHARTER_ERROR_CODES,
} from '@/lib/validations/charter';

import type { NextRequest } from 'next/server';

/**
 * Validation error that prevents charter acceptance
 */
interface CharterValidationError {
  code: string;
  message: string;
  field?: string;
}

/**
 * Validation warning that does not prevent acceptance but should be addressed
 */
interface CharterValidationWarning {
  code: string;
  message: string;
  field?: string;
  suggestion?: string;
}

/**
 * Result of charter validation
 */
interface CharterValidationResult {
  valid: boolean;
  errors: CharterValidationError[];
  warnings: CharterValidationWarning[];
}

/**
 * Route context with workspace slug and charter ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; charterId: string }>;
}

/**
 * Schema for validating a charter payload (accepts any tier)
 */
const validateCharterRequestSchema = z.object({
  charterData: z.record(z.unknown()),
  type: z.enum(['orchestrator', 'session-manager']).optional(),
});

/**
 * Zod schema for Orchestrator charter (Tier 1) structural validation
 */
const orchestratorCharterSchema = z.object({
  tier: z.literal(1),
  identity: z.object({
    name: z.string().min(1).max(255),
    slug: z.string().min(1).max(100),
    persona: z.string().min(1).max(2000),
    slackHandle: z.string().optional(),
    email: z.string().email().optional(),
    avatarUrl: z.string().url().optional(),
  }),
  coreDirective: z.string().min(10).max(2000),
  capabilities: z
    .array(
      z.enum([
        'context_compilation',
        'resource_management',
        'slack_operations',
        'session_spawning',
        'task_triage',
        'memory_management',
      ])
    )
    .min(1, 'At least one capability is required'),
  mcpTools: z.array(z.string()),
  resourceLimits: z.object({
    maxConcurrentSessions: z.number().int().positive(),
    tokenBudgetPerHour: z.number().int().positive(),
    maxMemoryMB: z.number().int().positive(),
    maxCpuPercent: z.number().min(0).max(100),
  }),
  objectives: z.object({
    responseTimeTarget: z.number().positive(),
    taskCompletionRate: z.number().min(0).max(100),
    qualityScore: z.number().min(0).max(100),
    customMetrics: z.record(z.number()).optional(),
  }),
  constraints: z.object({
    forbiddenCommands: z.array(z.string()),
    forbiddenPaths: z.array(z.string()),
    forbiddenActions: z.array(z.string()),
    requireApprovalFor: z.array(z.string()),
  }),
  disciplineIds: z.array(z.string()),
  nodeId: z.string().optional(),
});

/**
 * Zod schema for Session Manager charter (Tier 2) structural validation
 */
const sessionManagerCharterSchema = z.object({
  tier: z.literal(2),
  identity: z.object({
    name: z.string().min(1).max(255),
    slug: z.string().min(1).max(100),
    persona: z.string().min(1).max(2000),
    slackHandle: z.string().optional(),
    email: z.string().email().optional(),
    avatarUrl: z.string().url().optional(),
  }),
  coreDirective: z.string().min(10).max(2000),
  disciplineId: z.string().min(1),
  parentVpId: z.string().min(1),
  mcpTools: z.array(z.string()),
  agentIds: z.array(z.string()),
  objectives: z.object({
    responseTimeTarget: z.number().positive(),
    taskCompletionRate: z.number().min(0).max(100),
    qualityScore: z.number().min(0).max(100),
    customMetrics: z.record(z.number()).optional(),
  }),
  constraints: z.object({
    forbiddenCommands: z.array(z.string()),
    forbiddenPaths: z.array(z.string()),
    forbiddenActions: z.array(z.string()),
    requireApprovalFor: z.array(z.string()),
  }),
  memoryBankPath: z.string().min(1),
});

/**
 * Helper to resolve workspace from slug and verify user membership
 */
async function resolveWorkspaceAccess(workspaceSlug: string, userId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: { OR: [{ id: workspaceSlug }, { slug: workspaceSlug }] },
    include: { organization: true },
  });

  if (!workspace) {
    return null;
  }

  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: workspace.organizationId,
        userId,
      },
    },
  });

  if (!orgMembership) {
    return null;
  }

  return { workspace, orgMembership };
}

/**
 * Perform semantic validation and produce warnings for best-practice issues.
 * These are non-blocking but represent quality improvements.
 */
function collectWarnings(
  charterData: Record<string, unknown>
): CharterValidationWarning[] {
  const warnings: CharterValidationWarning[] = [];
  const tier = charterData['tier'];

  // Warn if no persona description is provided
  const identity = charterData['identity'] as
    | Record<string, unknown>
    | undefined;
  if (identity?.persona && typeof identity.persona === 'string') {
    if (identity.persona.length < 50) {
      warnings.push({
        code: 'PERSONA_TOO_SHORT',
        message:
          'Persona description is very short. A detailed persona improves agent behavior.',
        field: 'identity.persona',
        suggestion:
          'Provide at least 50 characters describing the agent personality and communication style.',
      });
    }
  }

  // Warn if no slackHandle for orchestrators (they benefit from Slack integration)
  if (tier === 1 && !identity?.slackHandle) {
    warnings.push({
      code: 'MISSING_SLACK_HANDLE',
      message: 'Orchestrator has no Slack handle configured.',
      field: 'identity.slackHandle',
      suggestion: 'Add a slackHandle to enable Slack workspace integration.',
    });
  }

  // Warn if orchestrator has no MCP tools configured
  if (tier === 1) {
    const mcpTools = charterData['mcpTools'] as unknown[] | undefined;
    if (!mcpTools || mcpTools.length === 0) {
      warnings.push({
        code: 'NO_MCP_TOOLS',
        message: 'Orchestrator has no MCP tools configured.',
        field: 'mcpTools',
        suggestion:
          'Configure relevant MCP tools to enable advanced orchestration capabilities.',
      });
    }
  }

  // Warn if resource limits are set very high
  if (tier === 1) {
    const resourceLimits = charterData['resourceLimits'] as
      | Record<string, number>
      | undefined;
    if ((resourceLimits?.tokenBudgetPerHour ?? 0) > 1000000) {
      warnings.push({
        code: 'HIGH_TOKEN_BUDGET',
        message:
          'Token budget per hour exceeds 1,000,000. This may lead to high costs.',
        field: 'resourceLimits.tokenBudgetPerHour',
        suggestion:
          'Consider setting a more conservative token budget and monitoring actual usage.',
      });
    }
    if ((resourceLimits?.maxCpuPercent ?? 0) > 75) {
      warnings.push({
        code: 'HIGH_CPU_LIMIT',
        message: 'CPU limit exceeds 75%. This may impact system stability.',
        field: 'resourceLimits.maxCpuPercent',
        suggestion:
          'Consider setting maxCpuPercent to 75% or below to maintain system stability.',
      });
    }
  }

  // Warn if coreDirective is suspiciously short
  const coreDirective = charterData['coreDirective'];
  if (typeof coreDirective === 'string' && coreDirective.length < 30) {
    warnings.push({
      code: 'CORE_DIRECTIVE_TOO_SHORT',
      message:
        'Core directive is very short. A clear, detailed directive improves agent focus.',
      field: 'coreDirective',
      suggestion:
        'Provide at least 30 characters describing the agent primary mission.',
    });
  }

  // Warn if constraints are empty (security concern)
  const constraints = charterData['constraints'] as
    | Record<string, unknown[]>
    | undefined;
  if (constraints) {
    if (
      !constraints.forbiddenCommands ||
      constraints.forbiddenCommands.length === 0
    ) {
      warnings.push({
        code: 'NO_FORBIDDEN_COMMANDS',
        message: 'No forbidden commands configured in constraints.',
        field: 'constraints.forbiddenCommands',
        suggestion:
          'Add dangerous command patterns (e.g., "rm -rf /") to forbiddenCommands for safety.',
      });
    }
    if (
      !constraints.requireApprovalFor ||
      constraints.requireApprovalFor.length === 0
    ) {
      warnings.push({
        code: 'NO_APPROVAL_REQUIREMENTS',
        message: 'No actions require human approval.',
        field: 'constraints.requireApprovalFor',
        suggestion:
          'Add high-risk actions (e.g., "deploy_to_production") to requireApprovalFor.',
      });
    }
  }

  return warnings;
}

/**
 * POST /api/workspaces/:workspaceSlug/charters/:charterId/validate
 *
 * Validate a charter document without saving it. Runs structural schema
 * validation and semantic checks, returning errors and warnings.
 *
 * This endpoint is safe to call frequently as it does not write to the database.
 *
 * Request Body:
 * - charterData: The charter JSON to validate
 * - type: Optional hint for charter type (auto-detected from tier if omitted)
 *
 * Response:
 * - valid: Whether the charter passes all validation rules
 * - errors: Array of blocking validation errors
 * - warnings: Array of non-blocking quality warnings
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.UNAUTHORIZED,
          'Authentication required'
        ),
        { status: 401 }
      );
    }

    const { workspaceSlug } = await context.params;

    const access = await resolveWorkspaceAccess(workspaceSlug, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.FORBIDDEN,
          'Workspace not found or access denied'
        ),
        { status: 403 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VALIDATION_ERROR,
          'Invalid JSON body'
        ),
        { status: 400 }
      );
    }

    const requestParseResult = validateCharterRequestSchema.safeParse(body);
    if (!requestParseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VALIDATION_ERROR,
          'Request validation failed',
          { errors: requestParseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const { charterData } = requestParseResult.data;

    const errors: CharterValidationError[] = [];
    const warnings: CharterValidationWarning[] = [];

    // Detect tier from charterData
    const tier = charterData['tier'];

    if (tier === undefined || tier === null) {
      errors.push({
        code: 'MISSING_TIER',
        message:
          'Charter must specify a tier field (1 for orchestrator, 2 for session-manager)',
        field: 'tier',
      });
    } else if (tier !== 1 && tier !== 2) {
      errors.push({
        code: 'INVALID_TIER',
        message: `Invalid tier value "${tier}". Must be 1 (orchestrator) or 2 (session-manager)`,
        field: 'tier',
      });
    } else {
      // Run schema validation based on tier
      const schema =
        tier === 1 ? orchestratorCharterSchema : sessionManagerCharterSchema;
      const schemaResult = schema.safeParse(charterData);

      if (!schemaResult.success) {
        const fieldErrors = schemaResult.error.flatten().fieldErrors;
        for (const [field, messages] of Object.entries(fieldErrors)) {
          if (messages) {
            for (const message of messages) {
              errors.push({
                code: 'SCHEMA_VIOLATION',
                message,
                field,
              });
            }
          }
        }
        // Also handle nested errors
        const nested = schemaResult.error.flatten().formErrors;
        for (const message of nested) {
          errors.push({
            code: 'SCHEMA_VIOLATION',
            message,
          });
        }
      }

      // Collect semantic warnings even if schema errors exist
      const semanticWarnings = collectWarnings(charterData);
      warnings.push(...semanticWarnings);
    }

    const result: CharterValidationResult = {
      valid: errors.length === 0,
      errors,
      warnings,
    };

    return NextResponse.json({
      data: result,
    });
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceSlug/charters/:charterId/validate] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        CHARTER_ERROR_CODES.INTERNAL_ERROR,
        'An internal error occurred'
      ),
      { status: 500 }
    );
  }
}
