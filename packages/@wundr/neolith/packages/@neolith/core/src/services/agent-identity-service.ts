/**
 * @neolith/core - AgentIdentityService
 *
 * Service layer for managing external identities for orchestrator agents.
 * Handles provisioning of corporate emails, phone numbers, and communication channels.
 *
 * @packageDocumentation
 */

import { prisma } from '@neolith/database';

import type { PrismaClient } from '@neolith/database';

// =============================================================================
// Error Classes
// =============================================================================

export class AgentIdentityNotFoundError extends Error {
  constructor(id: string) {
    super(`Agent identity not found: ${id}`);
    this.name = 'AgentIdentityNotFoundError';
  }
}

export class AgentIdentityValidationError extends Error {
  public readonly errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]> = {}) {
    super(message);
    this.name = 'AgentIdentityValidationError';
    this.errors = errors;
  }
}

export class AgentIdentityOrchestratorNotFoundError extends Error {
  constructor(id: string) {
    super(`Orchestrator not found: ${id}`);
    this.name = 'AgentIdentityOrchestratorNotFoundError';
  }
}

// =============================================================================
// Input Types
// =============================================================================

export interface CreateAgentIdentityInput {
  userId: string;
  corporateEmail?: string;
  emailDomain?: string;
  phoneNumber?: string;
  communicationChannels?: string[];
}

export interface UpdateAgentIdentityInput {
  corporateEmail?: string;
  emailDomain?: string;
  phoneNumber?: string;
  twilioPhoneSid?: string;
  whatsappNumber?: string;
  whatsappEnabled?: boolean;
  voiceEnabled?: boolean;
  smsEnabled?: boolean;
  communicationChannels?: string[];
  externalIdentifiers?: Record<string, unknown>;
  provisioningStatus?: string;
}

// =============================================================================
// AgentIdentityService Interface
// =============================================================================

export interface AgentIdentityService {
  /**
   * Create a new agent identity for an orchestrator user.
   *
   * @param data - Agent identity creation input
   * @returns The created agent identity
   */
  createIdentity(data: CreateAgentIdentityInput): Promise<unknown>;

  /**
   * Update an existing agent identity.
   *
   * @param id - The agent identity ID
   * @param data - Update data
   * @returns The updated agent identity
   * @throws {AgentIdentityNotFoundError} If the identity doesn't exist
   */
  updateIdentity(id: string, data: UpdateAgentIdentityInput): Promise<unknown>;

  /**
   * Get identity by user ID.
   *
   * @param userId - The user ID
   * @returns The agent identity with user data, or null if not found
   */
  getIdentityByUserId(userId: string): Promise<unknown | null>;

  /**
   * Get identity by corporate email.
   *
   * @param email - The corporate email address
   * @returns The agent identity with user data, or null if not found
   */
  getIdentityByEmail(email: string): Promise<unknown | null>;

  /**
   * Provision a corporate email for an orchestrator.
   *
   * @param orchestratorId - The orchestrator ID
   * @param emailDomain - The email domain to provision under
   * @param preferredUsername - Optional preferred username for the email
   * @returns The upserted agent identity
   * @throws {AgentIdentityOrchestratorNotFoundError} If the orchestrator doesn't exist
   */
  provisionEmail(
    orchestratorId: string,
    emailDomain: string,
    preferredUsername?: string
  ): Promise<unknown>;

  /**
   * Provision a phone number for an orchestrator (placeholder - Twilio integration).
   *
   * @param orchestratorId - The orchestrator ID
   * @param countryCode - The country code for the phone number
   * @returns The upserted agent identity with provisioning status
   * @throws {AgentIdentityOrchestratorNotFoundError} If the orchestrator doesn't exist
   */
  provisionPhoneNumber(
    orchestratorId: string,
    countryCode?: string
  ): Promise<unknown>;

  /**
   * List all agent identities for an organization.
   *
   * @param organizationId - The organization ID
   * @returns List of agent identities with user data
   */
  listIdentities(organizationId: string): Promise<unknown[]>;

  /**
   * Delete an agent identity.
   *
   * @param id - The agent identity ID
   * @throws {AgentIdentityNotFoundError} If the identity doesn't exist
   */
  deleteIdentity(id: string): Promise<void>;
}

// =============================================================================
// AgentIdentityService Implementation
// =============================================================================

/**
 * AgentIdentityServiceImpl provides CRUD and provisioning operations for agent identities.
 */
export class AgentIdentityServiceImpl implements AgentIdentityService {
  private readonly db: PrismaClient;

  /**
   * Creates a new AgentIdentityServiceImpl instance.
   *
   * @param database - Optional Prisma client instance (defaults to singleton)
   */
  constructor(database?: PrismaClient) {
    this.db = database ?? prisma;
  }

  // ===========================================================================
  // CRUD Operations
  // ===========================================================================

  /**
   * Creates a new agent identity for an orchestrator user.
   */
  async createIdentity(data: CreateAgentIdentityInput): Promise<unknown> {
    return this.db.agentIdentity.create({
      data: {
        userId: data.userId,
        corporateEmail: data.corporateEmail,
        emailDomain: data.emailDomain,
        phoneNumber: data.phoneNumber,
        communicationChannels: data.communicationChannels ?? [],
        provisioningStatus: 'pending',
      },
    });
  }

  /**
   * Updates an existing agent identity.
   */
  async updateIdentity(
    id: string,
    data: UpdateAgentIdentityInput
  ): Promise<unknown> {
    return this.db.agentIdentity.update({
      where: { id },
      data,
    });
  }

  /**
   * Gets identity by user ID with user relation.
   */
  async getIdentityByUserId(userId: string): Promise<unknown | null> {
    return this.db.agentIdentity.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            isOrchestrator: true,
          },
        },
      },
    });
  }

  /**
   * Gets identity by corporate email with user relation.
   */
  async getIdentityByEmail(email: string): Promise<unknown | null> {
    return this.db.agentIdentity.findUnique({
      where: { corporateEmail: email },
      include: { user: true },
    });
  }

  // ===========================================================================
  // Provisioning Operations
  // ===========================================================================

  /**
   * Provisions a corporate email for an orchestrator.
   */
  async provisionEmail(
    orchestratorId: string,
    emailDomain: string,
    preferredUsername?: string
  ): Promise<unknown> {
    const orchestrator = await this.db.orchestrator.findUnique({
      where: { id: orchestratorId },
      include: {
        user: {
          select: { id: true, name: true, displayName: true },
        },
      },
    });

    if (!orchestrator) {
      throw new AgentIdentityOrchestratorNotFoundError(orchestratorId);
    }

    const name =
      orchestrator.user.displayName || orchestrator.user.name || 'agent';
    const username =
      preferredUsername || name.toLowerCase().replace(/\s+/g, '.');
    const corporateEmail = `${username}@${emailDomain}`;

    return this.db.agentIdentity.upsert({
      where: { userId: orchestrator.user.id },
      create: {
        userId: orchestrator.user.id,
        corporateEmail,
        emailDomain,
        emailVerified: false,
        communicationChannels: ['EMAIL'],
        provisioningStatus: 'active',
      },
      update: {
        corporateEmail,
        emailDomain,
        provisioningStatus: 'active',
      },
    });
  }

  /**
   * Provisions a phone number for an orchestrator.
   * This is a placeholder - real implementation will call the Twilio API.
   */
  async provisionPhoneNumber(
    orchestratorId: string,
    _countryCode: string = 'US'
  ): Promise<unknown> {
    const orchestrator = await this.db.orchestrator.findUnique({
      where: { id: orchestratorId },
      include: { user: true },
    });

    if (!orchestrator) {
      throw new AgentIdentityOrchestratorNotFoundError(orchestratorId);
    }

    return this.db.agentIdentity.upsert({
      where: { userId: orchestrator.userId },
      create: {
        userId: orchestrator.userId,
        provisioningStatus: 'provisioning',
        communicationChannels: ['VOICE', 'SMS'],
      },
      update: {
        provisioningStatus: 'provisioning',
      },
    });
  }

  /**
   * Lists all agent identities for an organization.
   */
  async listIdentities(organizationId: string): Promise<unknown[]> {
    return this.db.agentIdentity.findMany({
      where: {
        user: {
          isOrchestrator: true,
          orchestrator: { organizationId },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            displayName: true,
          },
        },
      },
    });
  }

  /**
   * Deletes an agent identity.
   */
  async deleteIdentity(id: string): Promise<void> {
    await this.db.agentIdentity.delete({ where: { id } });
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Creates a new AgentIdentityService instance.
 *
 * @param database - Optional Prisma client instance
 * @returns AgentIdentityService instance
 *
 * @example
 * ```typescript
 * const agentIdentityService = createAgentIdentityService();
 *
 * // Provision a corporate email for an orchestrator
 * const identity = await agentIdentityService.provisionEmail(
 *   'orch_123',
 *   'adaptic.ai',
 *   'alex.chen'
 * );
 * ```
 */
export function createAgentIdentityService(
  database?: PrismaClient
): AgentIdentityServiceImpl {
  return new AgentIdentityServiceImpl(database);
}

/**
 * Default AgentIdentityService instance using the singleton Prisma client.
 */
export const agentIdentityService = createAgentIdentityService();
