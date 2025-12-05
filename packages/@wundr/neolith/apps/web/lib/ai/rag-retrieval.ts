/**
 * RAG-Style Retrieval for AI Context
 *
 * Implements semantic search and retrieval for intelligent context injection.
 * Uses embedding-based similarity search for relevant content discovery.
 */

import { prisma } from '@neolith/database';
import type { ContextSource } from './context-builder';

export interface RAGQuery {
  query: string;
  workspaceId: string;
  userId: string;
  filters?: {
    types?: Array<'workflow' | 'channel' | 'document' | 'message'>;
    dateRange?: {
      start?: Date;
      end?: Date;
    };
    authors?: string[];
    channels?: string[];
  };
  limit?: number;
  minRelevance?: number; // 0-1, minimum relevance score
}

export interface RAGResult {
  source: ContextSource;
  snippet: string;
  relevanceScore: number;
  metadata: {
    title: string;
    timestamp: Date;
    author?: string;
    highlights: string[];
  };
}

/**
 * Simple keyword-based relevance scoring
 * In production, this would use vector embeddings and cosine similarity
 */
function calculateKeywordRelevance(
  text: string,
  query: string
): { score: number; highlights: string[] } {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const queryTerms = lowerQuery.split(/\s+/).filter(t => t.length >= 3);

  if (queryTerms.length === 0) {
    return { score: 0, highlights: [] };
  }

  let score = 0;
  const highlights: string[] = [];

  // Check for exact phrase match (high score)
  if (lowerText.includes(lowerQuery)) {
    score += 0.6;
    highlights.push(extractHighlight(text, lowerQuery));
  }

  // Check for individual terms
  const termScores: number[] = [];
  for (const term of queryTerms) {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    const matches = (lowerText.match(regex) || []).length;

    if (matches > 0) {
      const termScore = Math.min(matches * 0.15, 0.4);
      termScores.push(termScore);

      // Extract highlight for this term
      const highlight = extractHighlight(text, term);
      if (highlight && !highlights.includes(highlight)) {
        highlights.push(highlight);
      }
    } else {
      termScores.push(0);
    }
  }

  // Average term score
  const avgTermScore =
    termScores.reduce((a, b) => a + b, 0) / termScores.length;
  score += avgTermScore;

  // Bonus for matching all terms
  const matchedTerms = termScores.filter(s => s > 0).length;
  if (matchedTerms === queryTerms.length) {
    score += 0.2;
  }

  // Normalize score to 0-1
  return {
    score: Math.min(score, 1.0),
    highlights: highlights.slice(0, 3), // Max 3 highlights
  };
}

/**
 * Extract a highlight snippet around the matched term
 */
function extractHighlight(
  text: string,
  term: string,
  contextLength = 60
): string {
  const lowerText = text.toLowerCase();
  const lowerTerm = term.toLowerCase();
  const index = lowerText.indexOf(lowerTerm);

  if (index === -1) return '';

  const start = Math.max(0, index - contextLength);
  const end = Math.min(text.length, index + term.length + contextLength);

  let snippet = text.substring(start, end);

  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  return snippet;
}

/**
 * Search workflows
 */
async function searchWorkflows(query: RAGQuery): Promise<RAGResult[]> {
  const workflows = await prisma.workflow.findMany({
    where: {
      workspaceId: query.workspaceId,
      ...(query.filters?.dateRange?.start && {
        createdAt: { gte: query.filters.dateRange.start },
      }),
    },
    take: 100, // Search through more items
  });

  const results: RAGResult[] = [];

  for (const workflow of workflows) {
    // Parse JSON fields
    const trigger = workflow.trigger as any;
    const actions = workflow.actions as any[];

    const searchText = `
      ${workflow.name}
      ${workflow.description || ''}
      ${trigger?.type || ''}
      ${Array.isArray(actions) ? actions.map((a: any) => a.type).join(' ') : ''}
    `;

    const { score, highlights } = calculateKeywordRelevance(
      searchText,
      query.query
    );

    if (score >= (query.minRelevance ?? 0.3)) {
      results.push({
        source: {
          type: 'workflow',
          id: workflow.id,
        },
        snippet:
          workflow.description ||
          `${Array.isArray(actions) ? actions.length : 0} actions configured`,
        relevanceScore: score,
        metadata: {
          title: workflow.name,
          timestamp: workflow.updatedAt,
          author: 'Workflow Creator', // createdBy is just an ID
          highlights,
        },
      });
    }
  }

  return results;
}

/**
 * Search channel messages
 */
async function searchMessages(query: RAGQuery): Promise<RAGResult[]> {
  // Get channels user has access to
  const channelIds =
    query.filters?.channels ||
    (
      await prisma.channelMember.findMany({
        where: {
          userId: query.userId,
          channel: { workspaceId: query.workspaceId },
        },
        select: { channelId: true },
      })
    ).map(m => m.channelId);

  if (channelIds.length === 0) return [];

  // Search messages
  const messages = await prisma.message.findMany({
    where: {
      channelId: { in: channelIds },
      isDeleted: false,
      ...(query.filters?.dateRange?.start && {
        createdAt: { gte: query.filters.dateRange.start },
      }),
      ...(query.filters?.authors && {
        authorId: { in: query.filters.authors },
      }),
    },
    include: {
      author: {
        select: { name: true, displayName: true },
      },
      channel: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const results: RAGResult[] = [];

  for (const message of messages) {
    const { score, highlights } = calculateKeywordRelevance(
      message.content,
      query.query
    );

    if (score >= (query.minRelevance ?? 0.3)) {
      results.push({
        source: {
          type: 'thread',
          id: message.id,
        },
        snippet: message.content.substring(0, 200),
        relevanceScore: score,
        metadata: {
          title: `Message in #${message.channel.name}`,
          timestamp: message.createdAt,
          author:
            (message.author.displayName || message.author.name) ?? undefined,
          highlights,
        },
      });
    }
  }

  return results;
}

/**
 * Search documents
 */
async function searchDocuments(query: RAGQuery): Promise<RAGResult[]> {
  const documents = await prisma.file.findMany({
    where: {
      workspaceId: query.workspaceId,
      status: 'READY',
      ...(query.filters?.dateRange?.start && {
        createdAt: { gte: query.filters.dateRange.start },
      }),
    },
    include: {
      uploadedBy: {
        select: { name: true, displayName: true },
      },
    },
    take: 100,
  });

  const results: RAGResult[] = [];

  for (const doc of documents) {
    // Extract text from metadata if available
    const metadata = doc.metadata as any;
    const extractedText = metadata?.extractedText || '';

    const searchText = `
      ${doc.originalName}
      ${extractedText}
      ${doc.mimeType}
    `;

    const { score, highlights } = calculateKeywordRelevance(
      searchText,
      query.query
    );

    if (score >= (query.minRelevance ?? 0.3)) {
      results.push({
        source: {
          type: 'document',
          id: doc.id,
        },
        snippet: extractedText?.substring(0, 200) || `${doc.mimeType} document`,
        relevanceScore: score,
        metadata: {
          title: doc.originalName,
          timestamp: doc.createdAt,
          author:
            (doc.uploadedBy.displayName || doc.uploadedBy.name) ?? undefined,
          highlights,
        },
      });
    }
  }

  return results;
}

/**
 * Perform RAG retrieval across all sources
 */
export async function retrieveRelevantContext(
  query: RAGQuery
): Promise<RAGResult[]> {
  const searchTypes = query.filters?.types || [
    'workflow',
    'channel',
    'document',
    'message',
  ];

  const searches: Promise<RAGResult[]>[] = [];

  if (searchTypes.includes('workflow')) {
    searches.push(searchWorkflows(query));
  }

  if (searchTypes.includes('message') || searchTypes.includes('channel')) {
    searches.push(searchMessages(query));
  }

  if (searchTypes.includes('document')) {
    searches.push(searchDocuments(query));
  }

  // Execute all searches in parallel
  const resultsArrays = await Promise.all(searches);
  const allResults = resultsArrays.flat();

  // Sort by relevance score
  allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Apply limit
  const limit = query.limit ?? 10;
  return allResults.slice(0, limit);
}

/**
 * Get suggested context sources based on query
 */
export async function suggestContextSources(
  query: string,
  workspaceId: string,
  userId: string,
  limit = 5
): Promise<ContextSource[]> {
  const results = await retrieveRelevantContext({
    query,
    workspaceId,
    userId,
    limit,
    minRelevance: 0.4, // Higher threshold for suggestions
  });

  return results.map(result => result.source);
}

/**
 * Expand context by finding related items
 */
export async function expandContext(
  source: ContextSource,
  workspaceId: string,
  userId: string,
  limit = 5
): Promise<ContextSource[]> {
  try {
    switch (source.type) {
      case 'workflow': {
        const workflow = await prisma.workflow.findUnique({
          where: { id: source.id },
        });

        if (!workflow) return [];

        // Find similar workflows by name/description
        const query = `${workflow.name} ${workflow.description || ''}`;
        return suggestContextSources(query, workspaceId, userId, limit);
      }

      case 'channel': {
        // Find related channels by recent activity
        const recentMessages = await prisma.message.findMany({
          where: {
            channelId: source.id,
            isDeleted: false,
          },
          select: { content: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        });

        const query = recentMessages
          .map(m => m.content)
          .join(' ')
          .substring(0, 500);
        return suggestContextSources(query, workspaceId, userId, limit);
      }

      case 'thread': {
        const message = await prisma.message.findUnique({
          where: { id: source.id },
        });

        if (!message) return [];

        // Return the channel as related context
        return [{ type: 'channel', id: message.channelId }];
      }

      default:
        return [];
    }
  } catch (error) {
    console.error('[expandContext] Error:', error);
    return [];
  }
}
