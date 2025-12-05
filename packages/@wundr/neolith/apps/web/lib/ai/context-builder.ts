/**
 * Context Builder for AI
 *
 * Builds contextual information from various sources for AI context injection.
 * Implements token budgeting, relevance scoring, and intelligent truncation.
 */

import { prisma } from '@neolith/database';

export interface ContextSource {
  type: 'workflow' | 'channel' | 'document' | 'message' | 'thread';
  id: string;
  weight?: number; // 0-1, higher = more important
}

export interface ContextItem {
  source: ContextSource;
  content: string;
  metadata: {
    title?: string;
    timestamp?: Date;
    author?: string;
    relevanceScore: number;
  };
  tokens: number;
}

export interface ContextBuildOptions {
  sources: ContextSource[];
  maxTokens: number;
  includeMetadata?: boolean;
  query?: string; // For relevance scoring
  userId?: string; // For permission checks
}

export interface BuiltContext {
  items: ContextItem[];
  totalTokens: number;
  truncated: boolean;
  sources: ContextSource[];
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 characters)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Calculate relevance score based on query and content
 */
function calculateRelevance(content: string, query?: string): number {
  if (!query) return 0.5; // Default relevance

  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const queryTerms = lowerQuery.split(/\s+/);

  let score = 0;
  let matchCount = 0;

  // Check for exact phrase match
  if (lowerContent.includes(lowerQuery)) {
    score += 0.5;
  }

  // Check for individual term matches
  for (const term of queryTerms) {
    if (term.length < 3) continue; // Skip very short terms

    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    const matches = (lowerContent.match(regex) || []).length;
    if (matches > 0) {
      matchCount++;
      score += Math.min(matches * 0.1, 0.3); // Cap contribution per term
    }
  }

  // Bonus for matching most query terms
  if (queryTerms.length > 0) {
    score += (matchCount / queryTerms.length) * 0.3;
  }

  return Math.min(score, 1.0);
}

/**
 * Build context from workflow
 */
async function buildWorkflowContext(
  source: ContextSource,
  query?: string
): Promise<ContextItem | null> {
  const workflow = await prisma.workflow.findUnique({
    where: { id: source.id },
  });

  if (!workflow) return null;

  // Parse JSON fields
  const trigger = workflow.trigger as any;
  const actions = workflow.actions as any[];

  const content = `
Workflow: ${workflow.name}
Description: ${workflow.description || 'No description'}
Status: ${workflow.status}
Trigger: ${trigger?.type || 'none'}
Actions: ${Array.isArray(actions) ? actions.length : 0} configured
Created: ${workflow.createdAt.toISOString()}
Last Executed: ${workflow.lastExecutedAt?.toISOString() || 'Never'}
Execution Count: ${workflow.executionCount}
Success Count: ${workflow.successCount}
Failure Count: ${workflow.failureCount}
  `.trim();

  return {
    source,
    content,
    metadata: {
      title: workflow.name,
      timestamp: workflow.updatedAt,
      relevanceScore: calculateRelevance(content, query),
    },
    tokens: estimateTokens(content),
  };
}

/**
 * Build context from channel messages
 */
async function buildChannelContext(
  source: ContextSource,
  query?: string,
  userId?: string
): Promise<ContextItem | null> {
  // Check channel access
  if (userId) {
    const membership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: source.id,
          userId,
        },
      },
    });

    if (!membership) return null; // User doesn't have access
  }

  const channel = await prisma.channel.findUnique({
    where: { id: source.id },
    include: {
      messages: {
        take: 50, // Last 50 messages
        orderBy: { createdAt: 'desc' },
        where: { isDeleted: false },
        include: {
          author: {
            select: {
              name: true,
              displayName: true,
            },
          },
        },
      },
    },
  });

  if (!channel) return null;

  const messages = channel.messages
    .reverse() // Chronological order
    .map(
      msg =>
        `[${msg.createdAt.toISOString()}] ${msg.author.displayName || msg.author.name}: ${msg.content}`
    )
    .join('\n');

  const content = `
Channel: ${channel.name}
Type: ${channel.type}
Description: ${channel.description || 'No description'}
Member Count: ${await prisma.channelMember.count({ where: { channelId: channel.id } })}

Recent Messages:
${messages}
  `.trim();

  return {
    source,
    content,
    metadata: {
      title: `#${channel.name}`,
      timestamp: channel.updatedAt,
      relevanceScore: calculateRelevance(content, query),
    },
    tokens: estimateTokens(content),
  };
}

/**
 * Build context from a specific message thread
 */
async function buildThreadContext(
  source: ContextSource,
  query?: string
): Promise<ContextItem | null> {
  const parentMessage = await prisma.message.findUnique({
    where: { id: source.id },
    include: {
      author: {
        select: {
          name: true,
          displayName: true,
        },
      },
      replies: {
        take: 20,
        orderBy: { createdAt: 'asc' },
        where: { isDeleted: false },
        include: {
          author: {
            select: {
              name: true,
              displayName: true,
            },
          },
        },
      },
      channel: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!parentMessage || parentMessage.isDeleted) return null;

  const parentContent = `[${parentMessage.createdAt.toISOString()}] ${parentMessage.author.displayName || parentMessage.author.name}: ${parentMessage.content}`;

  const replyContent = parentMessage.replies
    .map(
      reply =>
        `  └─ [${reply.createdAt.toISOString()}] ${reply.author.displayName || reply.author.name}: ${reply.content}`
    )
    .join('\n');

  const content = `
Thread in #${parentMessage.channel.name}

Parent Message:
${parentContent}

Replies (${parentMessage.replies.length}):
${replyContent || '  (no replies)'}
  `.trim();

  return {
    source,
    content,
    metadata: {
      title: `Thread in #${parentMessage.channel.name}`,
      timestamp: parentMessage.createdAt,
      relevanceScore: calculateRelevance(content, query),
    },
    tokens: estimateTokens(content),
  };
}

/**
 * Build context from document/file
 */
async function buildDocumentContext(
  source: ContextSource,
  query?: string
): Promise<ContextItem | null> {
  const file = await prisma.file.findUnique({
    where: { id: source.id },
    include: {
      uploadedBy: {
        select: {
          name: true,
          displayName: true,
        },
      },
    },
  });

  if (!file) return null;

  // Extract text from metadata if available
  const metadata = file.metadata as any;
  const extractedText = metadata?.extractedText || '';

  const content = `
Document: ${file.originalName}
Type: ${file.mimeType}
Size: ${Number(file.size)} bytes
Uploaded by: ${file.uploadedBy.displayName || file.uploadedBy.name}
Uploaded: ${file.createdAt.toISOString()}
Status: ${file.status}
${extractedText ? `\nExtracted Text:\n${extractedText.substring(0, 1000)}` : ''}
  `.trim();

  return {
    source,
    content,
    metadata: {
      title: file.originalName,
      timestamp: file.createdAt,
      author:
        (file.uploadedBy.displayName || file.uploadedBy.name) ?? undefined,
      relevanceScore: calculateRelevance(content, query),
    },
    tokens: estimateTokens(content),
  };
}

/**
 * Build context item from a source
 */
async function buildContextItem(
  source: ContextSource,
  query?: string,
  userId?: string
): Promise<ContextItem | null> {
  try {
    switch (source.type) {
      case 'workflow':
        return await buildWorkflowContext(source, query);
      case 'channel':
        return await buildChannelContext(source, query, userId);
      case 'thread':
        return await buildThreadContext(source, query);
      case 'document':
        return await buildDocumentContext(source, query);
      default:
        return null;
    }
  } catch (error) {
    console.error(
      `[buildContextItem] Error building context for ${source.type}:`,
      error
    );
    return null;
  }
}

/**
 * Main context builder function
 */
export async function buildContext(
  options: ContextBuildOptions
): Promise<BuiltContext> {
  const { sources, maxTokens, query, userId } = options;

  // Build all context items in parallel
  const itemPromises = sources.map(source =>
    buildContextItem(source, query, userId)
  );
  const items = (await Promise.all(itemPromises)).filter(
    (item): item is ContextItem => item !== null
  );

  // Apply source weight to relevance scores
  items.forEach(item => {
    const weight = item.source.weight ?? 1.0;
    item.metadata.relevanceScore *= weight;
  });

  // Sort by relevance score (descending)
  items.sort((a, b) => b.metadata.relevanceScore - a.metadata.relevanceScore);

  // Apply token budget
  const selectedItems: ContextItem[] = [];
  let totalTokens = 0;
  let truncated = false;

  for (const item of items) {
    if (totalTokens + item.tokens <= maxTokens) {
      selectedItems.push(item);
      totalTokens += item.tokens;
    } else {
      truncated = true;

      // Try to fit a truncated version
      const remainingTokens = maxTokens - totalTokens;
      if (remainingTokens > 100) {
        // Truncate content to fit
        const charLimit = remainingTokens * 4; // Rough estimate
        const truncatedContent =
          item.content.substring(0, charLimit) + '\n... (truncated)';

        selectedItems.push({
          ...item,
          content: truncatedContent,
          tokens: estimateTokens(truncatedContent),
        });
        totalTokens += estimateTokens(truncatedContent);
      }

      break;
    }
  }

  return {
    items: selectedItems,
    totalTokens,
    truncated,
    sources: selectedItems.map(item => item.source),
  };
}

/**
 * Format context for AI prompt
 */
export function formatContextForPrompt(context: BuiltContext): string {
  if (context.items.length === 0) {
    return '';
  }

  const sections = context.items.map((item, index) => {
    const header = `--- Context Source ${index + 1}: ${item.source.type} (Relevance: ${(item.metadata.relevanceScore * 100).toFixed(0)}%) ---`;
    return `${header}\n${item.content}`;
  });

  const footer = context.truncated
    ? '\n--- Note: Some context was truncated due to token limits ---'
    : '';

  return `
=== CONTEXT INFORMATION ===
${sections.join('\n\n')}
${footer}
=== END CONTEXT ===
  `.trim();
}

/**
 * Get available context sources for a workspace
 */
export async function getAvailableContextSources(
  workspaceId: string,
  userId: string
): Promise<{
  workflows: Array<{ id: string; name: string; type: string }>;
  channels: Array<{ id: string; name: string; type: string }>;
  documents: Array<{ id: string; name: string; type: string }>;
}> {
  const [workflows, channelMemberships, documents] = await Promise.all([
    // Get workflows in workspace
    prisma.workflow.findMany({
      where: { workspaceId },
      select: { id: true, name: true, status: true },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    }),

    // Get channels user has access to
    prisma.channelMember.findMany({
      where: {
        userId,
        channel: { workspaceId },
      },
      include: {
        channel: {
          select: { id: true, name: true, type: true },
        },
      },
      orderBy: { channel: { updatedAt: 'desc' } },
      take: 50,
    }),

    // Get recent documents in workspace
    prisma.file.findMany({
      where: {
        workspaceId,
        status: 'READY',
      },
      select: { id: true, originalName: true, mimeType: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  return {
    workflows: workflows.map(w => ({
      id: w.id,
      name: w.name,
      type: 'workflow' as const,
    })),
    channels: channelMemberships.map(m => ({
      id: m.channel.id,
      name: m.channel.name,
      type: 'channel' as const,
    })),
    documents: documents.map(d => ({
      id: d.id,
      name: d.originalName,
      type: 'document' as const,
    })),
  };
}
