import { prisma } from '@neolith/database';

export type UserType = 'human' | 'orchestrator';

export interface UserTypeResult {
  userType: UserType;
  isOrchestrator: boolean;
  orchestratorId?: string;
  orchestratorConfig?: Record<string, unknown>;
}

/**
 * Detect if a user is a human or orchestrator agent based on their email
 */
export async function detectUserType(email: string): Promise<UserTypeResult> {
  if (!email) {
    return { userType: 'human', isOrchestrator: false };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        isOrchestrator: true,
        orchestratorConfig: true,
        orchestrator: {
          select: {
            id: true,
            status: true,
            discipline: true,
            role: true,
          },
        },
      },
    });

    if (user?.isOrchestrator && user.orchestrator) {
      return {
        userType: 'orchestrator',
        isOrchestrator: true,
        orchestratorId: user.orchestrator.id,
        orchestratorConfig: user.orchestratorConfig as Record<string, unknown> ?? {},
      };
    }

    return { userType: 'human', isOrchestrator: false };
  } catch {
    return { userType: 'human', isOrchestrator: false };
  }
}

/**
 * Detect user type from a NextAuth session
 */
export async function detectUserTypeFromSession(session: { user?: { email?: string | null } } | null): Promise<UserTypeResult> {
  const email = session?.user?.email;
  if (!email) {
    return { userType: 'human', isOrchestrator: false };
  }
  return detectUserType(email);
}
