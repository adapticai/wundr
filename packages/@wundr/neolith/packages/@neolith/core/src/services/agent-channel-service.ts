/**
 * @neolith/core - AgentChannelService
 *
 * Service layer for managing direct message channels between orchestrator agents.
 * Handles creation of private channels, message sending, and conversation retrieval.
 *
 * @packageDocumentation
 */

import { prisma } from '@neolith/database';

import type { PrismaClient } from '@neolith/database';

// =============================================================================
// Error Classes
// =============================================================================

export class AgentChannelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentChannelError';
  }
}

export class AgentChannelNotFoundError extends AgentChannelError {
  constructor(agent1Id: string, agent2Id: string) {
    super(`Agent channel not found between agents: ${agent1Id} and ${agent2Id}`);
    this.name = 'AgentChannelNotFoundError';
  }
}

// =============================================================================
// Types
// =============================================================================

export interface AgentChannel {
  id: string;
  agent1Id: string;
  agent2Id: string;
  channelId: string;
  channelName: string;
  createdAt: Date;
}

export interface AgentMessage {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  content: string;
  type: string;
  channelId: string;
  createdAt: Date;
}

// =============================================================================
// IAgentChannelService Interface
// =============================================================================

export interface IAgentChannelService {
  createAgentChannel(agent1Id: string, agent2Id: string, workspaceId: string): Promise<AgentChannel>;
  getOrCreateChannel(agent1Id: string, agent2Id: string, workspaceId: string): Promise<AgentChannel>;
  sendAgentMessage(fromAgentId: string, toAgentId: string, content: string, type?: string): Promise<AgentMessage>;
  getAgentConversation(agent1Id: string, agent2Id: string, options?: { limit?: number; cursor?: string }): Promise<{ messages: AgentMessage[]; hasMore: boolean }>;
  listAgentChannels(agentId: string): Promise<AgentChannel[]>;
  createAllPairwiseChannels(agentIds: string[], workspaceId: string): Promise<AgentChannel[]>;
}

// =============================================================================
// AgentChannelService Implementation
// =============================================================================

export class AgentChannelServiceImpl implements IAgentChannelService {
  private readonly db: PrismaClient;

  constructor(database?: PrismaClient) {
    this.db = database ?? prisma;
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private getChannelName(agent1Id: string, agent2Id: string): string {
    const sorted = [agent1Id, agent2Id].sort();
    return `agent-dm-${sorted[0].slice(0, 8)}-${sorted[1].slice(0, 8)}`;
  }

  private getChannelSlug(agent1Id: string, agent2Id: string): string {
    const sorted = [agent1Id, agent2Id].sort();
    return `agent-dm-${sorted[0].slice(0, 8)}-${sorted[1].slice(0, 8)}`;
  }

  private toAgentChannel(
    channel: { id: string; name: string; createdAt: Date },
    agent1Id: string,
    agent2Id: string
  ): AgentChannel {
    return {
      id: channel.id,
      agent1Id,
      agent2Id,
      channelId: channel.id,
      channelName: channel.name,
      createdAt: channel.createdAt,
    };
  }

  // ===========================================================================
  // Channel Operations
  // ===========================================================================

  async createAgentChannel(agent1Id: string, agent2Id: string, workspaceId: string): Promise<AgentChannel> {
    const channelName = this.getChannelName(agent1Id, agent2Id);
    const channelSlug = this.getChannelSlug(agent1Id, agent2Id);

    const channel = await this.db.$transaction(async (tx) => {
      const created = await tx.channel.create({
        data: {
          name: channelName,
          slug: channelSlug,
          type: 'PRIVATE',
          workspaceId,
          channelMembers: {
            create: [
              { userId: agent1Id, role: 'ADMIN' },
              { userId: agent2Id, role: 'ADMIN' },
            ],
          },
        },
      });
      return created;
    });

    return this.toAgentChannel(channel, agent1Id, agent2Id);
  }

  async getOrCreateChannel(agent1Id: string, agent2Id: string, workspaceId: string): Promise<AgentChannel> {
    const channelName = this.getChannelName(agent1Id, agent2Id);

    const existing = await this.db.channel.findFirst({
      where: { name: channelName, workspaceId },
    });

    if (existing) {
      return this.toAgentChannel(existing, agent1Id, agent2Id);
    }

    return this.createAgentChannel(agent1Id, agent2Id, workspaceId);
  }

  // ===========================================================================
  // Message Operations
  // ===========================================================================

  async sendAgentMessage(
    fromAgentId: string,
    toAgentId: string,
    content: string,
    type: string = 'TEXT'
  ): Promise<AgentMessage> {
    const channelName = this.getChannelName(fromAgentId, toAgentId);

    const channel = await this.db.channel.findFirst({
      where: { name: channelName },
    });

    if (!channel) {
      throw new AgentChannelNotFoundError(fromAgentId, toAgentId);
    }

    const message = await this.db.message.create({
      data: {
        content,
        type: type as 'TEXT' | 'FILE' | 'SYSTEM' | 'COMMAND',
        channelId: channel.id,
        authorId: fromAgentId,
      },
    });

    return {
      id: message.id,
      fromAgentId,
      toAgentId,
      content: message.content,
      type: message.type,
      channelId: message.channelId,
      createdAt: message.createdAt,
    };
  }

  async getAgentConversation(
    agent1Id: string,
    agent2Id: string,
    options: { limit?: number; cursor?: string } = {}
  ): Promise<{ messages: AgentMessage[]; hasMore: boolean }> {
    const channelName = this.getChannelName(agent1Id, agent2Id);
    const limit = options.limit ?? 50;

    const channel = await this.db.channel.findFirst({
      where: { name: channelName },
    });

    if (!channel) {
      return { messages: [], hasMore: false };
    }

    const messages = await this.db.message.findMany({
      where: {
        channelId: channel.id,
        isDeleted: false,
        ...(options.cursor ? { id: { lt: options.cursor } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    const page = hasMore ? messages.slice(0, limit) : messages;

    return {
      messages: page.map((msg) => ({
        id: msg.id,
        fromAgentId: msg.authorId,
        toAgentId: msg.authorId === agent1Id ? agent2Id : agent1Id,
        content: msg.content,
        type: msg.type,
        channelId: msg.channelId,
        createdAt: msg.createdAt,
      })),
      hasMore,
    };
  }

  // ===========================================================================
  // Query Operations
  // ===========================================================================

  async listAgentChannels(agentId: string): Promise<AgentChannel[]> {
    const memberships = await this.db.channelMember.findMany({
      where: {
        userId: agentId,
        channel: { name: { startsWith: 'agent-dm-' } },
      },
      include: {
        channel: {
          include: {
            channelMembers: { select: { userId: true } },
          },
        },
      },
    });

    return memberships.map((membership) => {
      const otherMember = membership.channel.channelMembers.find(
        (m) => m.userId !== agentId
      );
      const otherAgentId = otherMember?.userId ?? agentId;

      return this.toAgentChannel(membership.channel, agentId, otherAgentId);
    });
  }

  async createAllPairwiseChannels(agentIds: string[], workspaceId: string): Promise<AgentChannel[]> {
    const channels: AgentChannel[] = [];

    for (let i = 0; i < agentIds.length; i++) {
      for (let j = i + 1; j < agentIds.length; j++) {
        channels.push(await this.getOrCreateChannel(agentIds[i], agentIds[j], workspaceId));
      }
    }

    return channels;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new AgentChannelService instance.
 *
 * @param database - Optional Prisma client instance
 * @returns AgentChannelService instance
 *
 * @example
 * ```typescript
 * const agentChannelService = createAgentChannelService();
 *
 * // Create all pairwise channels during org genesis
 * const channels = await agentChannelService.createAllPairwiseChannels(
 *   ['agent-1', 'agent-2', 'agent-3'],
 *   'workspace-id'
 * );
 * ```
 */
export function createAgentChannelService(database?: PrismaClient): AgentChannelServiceImpl {
  return new AgentChannelServiceImpl(database);
}

/**
 * Default AgentChannelService instance using the singleton Prisma client.
 */
export function getAgentChannelService(): AgentChannelServiceImpl {
  return agentChannelServiceSingleton;
}

const agentChannelServiceSingleton = createAgentChannelService();
