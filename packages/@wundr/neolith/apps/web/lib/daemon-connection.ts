/**
 * Daemon Connection Helpers
 *
 * Server-side utilities for resolving daemon WebSocket/HTTP URLs and
 * credentials for the current user's organisation. These functions are
 * intended to be used in Server Components, Server Actions, and API route
 * handlers – they must NOT be imported by client-side code.
 *
 * The connection information is seeded into the JWT by the `jwt` callback in
 * `lib/auth.ts` at sign-in time (fast path). These helpers provide the
 * authoritative look-up for cases where a fresh database read is required
 * (e.g. after credentials rotate, or when building server-side data).
 *
 * @module lib/daemon-connection
 */

import { prisma } from '@neolith/database';

import { auth } from './auth';

import type { Session } from 'next-auth';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the first active daemon credential for the organisation that the
 * given user belongs to.
 *
 * Returns `null` when:
 * - The user has no organisation membership
 * - No active, non-expired daemon credential exists
 * - The associated orchestrator is OFFLINE
 */
async function resolveActiveDaemonCredential(userId: string) {
  const orgMembership = await prisma.organizationMember.findFirst({
    where: { userId },
    select: { organizationId: true },
  });

  if (!orgMembership) {
    return null;
  }

  return prisma.daemonCredential.findFirst({
    where: {
      workspace: {
        organizationId: orgMembership.organizationId,
      },
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      orchestrator: {
        organizationId: orgMembership.organizationId,
        status: { not: 'OFFLINE' },
      },
    },
    select: {
      id: true,
      apiKey: true,
      hostname: true,
      orchestratorId: true,
      orchestrator: {
        select: { daemonEndpoint: true, status: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Derive the daemon HTTP base URL from a credential record.
 *
 * Priority:
 * 1. `orchestrator.daemonEndpoint` – explicit endpoint configured on the orchestrator
 * 2. `hostname` stored on the credential itself
 * 3. `DAEMON_API_URL` environment variable (process-level fallback)
 * 4. `undefined` when none of the above are available
 */
function resolveDaemonHttpUrl(credential: {
  hostname: string | null;
  orchestrator: { daemonEndpoint: string | null };
}): string | undefined {
  if (credential.orchestrator.daemonEndpoint) {
    return credential.orchestrator.daemonEndpoint;
  }
  if (credential.hostname) {
    return `http://${credential.hostname}`;
  }
  return process.env.DAEMON_API_URL ?? undefined;
}

/**
 * Derive the daemon WebSocket URL from the HTTP base URL.
 */
function toWebSocketUrl(httpUrl: string): string {
  return httpUrl.replace(/^http(s?):\/\//, (_, s: string) =>
    s ? 'wss://' : 'ws://'
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolved daemon connection details for the current user's organisation.
 */
export interface DaemonConnection {
  /** Credential record ID (can be used to reference the credential) */
  credentialId: string;
  /** Orchestrator ID that owns these credentials */
  orchestratorId: string;
  /** Daemon API key (plain text – only available server-side) */
  apiKey: string;
  /** HTTP/HTTPS base URL for the daemon REST API */
  httpUrl: string;
  /** WebSocket URL derived from the HTTP URL */
  wsUrl: string;
}

/**
 * Return daemon connection details for the user identified by the provided
 * session, performing a fresh database look-up.
 *
 * Returns `null` when no active daemon is configured for the user's org.
 *
 * @param session - A valid NextAuth `Session` object (must include `user.id`)
 */
export async function getDaemonConnection(
  session: Session
): Promise<DaemonConnection | null> {
  const userId = session.user?.id;
  if (!userId) {
    return null;
  }

  const credential = await resolveActiveDaemonCredential(userId);
  if (!credential) {
    return null;
  }

  const httpUrl = resolveDaemonHttpUrl(credential);
  if (!httpUrl) {
    return null;
  }

  return {
    credentialId: credential.id,
    orchestratorId: credential.orchestratorId,
    apiKey: credential.apiKey,
    httpUrl,
    wsUrl: toWebSocketUrl(httpUrl),
  };
}

/**
 * Convenience wrapper that retrieves the current server session and then
 * returns daemon connection details.
 *
 * Use this in Server Actions / API Routes where you don't already hold a
 * session reference.
 */
export async function getCurrentDaemonConnection(): Promise<DaemonConnection | null> {
  const session = await auth();
  if (!session) {
    return null;
  }
  return getDaemonConnection(session);
}

/**
 * Returns `true` when the current user's organisation has at least one
 * active, non-expired daemon credential associated with an online orchestrator.
 *
 * This re-uses the JWT's `hasDaemon` hint when available (fast path) and
 * performs a fresh database look-up only when the token hint is absent.
 *
 * @param session - A valid NextAuth `Session` object
 */
export async function isDaemonAvailable(session: Session): Promise<boolean> {
  // Fast path: trust the JWT hint set at sign-in time
  if (typeof session.user?.hasDaemon === 'boolean') {
    return session.user.hasDaemon;
  }

  const userId = session.user?.id;
  if (!userId) {
    return false;
  }

  const credential = await resolveActiveDaemonCredential(userId);
  return credential !== null;
}

/**
 * Attempt to reach the daemon's health endpoint.
 *
 * Sends a GET request to `<daemonHttpUrl>/health` with the daemon API key
 * in the `X-API-Key` header. Returns `true` when the daemon responds with
 * a 2xx status, `false` otherwise (including network errors).
 *
 * This is a fire-and-forget availability probe – it does not start a
 * long-lived connection. The request is aborted after 5 seconds.
 *
 * @param session - A valid NextAuth `Session` object
 */
export async function initializeDaemon(session: Session): Promise<boolean> {
  const connection = await getDaemonConnection(session);
  if (!connection) {
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(`${connection.httpUrl}/health`, {
      method: 'GET',
      headers: {
        'X-API-Key': connection.apiKey,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    return response.ok;
  } catch (error: unknown) {
    if (process.env.NODE_ENV === 'development') {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('Daemon health check failed:', {
        error: errorMessage,
        daemonUrl: connection.httpUrl,
        orchestratorId: connection.orchestratorId,
      });
    } else {
      console.error('Daemon health check failed');
    }
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
