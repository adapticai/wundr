/**
 * Triage Engine - RAG-based Request Classification
 * Implements intelligent request routing and classification for the Orchestrator Daemon
 */

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Intent types for classifying incoming requests
 */
export type IntentType =
  | 'status_query'
  | 'new_task'
  | 'modify_task'
  | 'escalation'
  | 'unknown';

/**
 * Priority levels for request handling
 */
export type PriorityLevel = 'critical' | 'high' | 'normal' | 'low';

/**
 * Placeholder interface for future RAG integration
 */
export interface RAGIndex {
  search(query: string, options?: RAGSearchOptions): Promise<RAGSearchResult[]>;
  addDocument(document: RAGDocument): Promise<void>;
  removeDocument(documentId: string): Promise<void>;
}

export interface RAGSearchOptions {
  topK?: number;
  minScore?: number;
  filter?: Record<string, unknown>;
}

export interface RAGSearchResult {
  documentId: string;
  score: number;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface RAGDocument {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for the Triage Engine
 */
export interface TriageEngineConfig {
  memoryBankPath: string;
  ragIndex?: RAGIndex;
  keywordThreshold?: number;
  enableRAG?: boolean;
  priorityWeights?: PriorityWeights;
}

export interface PriorityWeights {
  urgencyKeywords: number;
  taskComplexity: number;
  userContext: number;
  sessionHistory: number;
}

/**
 * Incoming request to be triaged
 */
export interface TriageRequest {
  id: string;
  content: string;
  userId?: string;
  sessionId?: string;
  timestamp: Date;
  metadata?: RequestMetadata;
}

export interface RequestMetadata {
  source?: string;
  channel?: string;
  previousRequests?: string[];
  userPriority?: string;
  tags?: string[];
}

/**
 * Result of request classification
 */
export interface TriageResult {
  requestId: string;
  intent: IntentType;
  priority: PriorityLevel;
  confidence: number;
  matchedSession: SessionMatch | null;
  suggestedActions: string[];
  reasoning: string;
  timestamp: Date;
}

/**
 * Matching session information
 */
export interface SessionMatch {
  sessionId: string;
  relevanceScore: number;
  lastActivity: Date;
  status: SessionStatus;
  context?: SessionContext;
}

export type SessionStatus = 'active' | 'paused' | 'completed' | 'failed';

export interface SessionContext {
  taskDescription?: string;
  progress?: number;
  currentStep?: string;
  errors?: string[];
}

// =============================================================================
// Keyword Dictionaries for Classification
// =============================================================================

const STATUS_KEYWORDS = [
  'status',
  'progress',
  'how is',
  'what is',
  'update',
  'check',
  'where',
  'done',
  'finished',
  'complete',
  'state',
  'current',
];

const NEW_TASK_KEYWORDS = [
  'create',
  'new',
  'start',
  'begin',
  'build',
  'implement',
  'add',
  'make',
  'generate',
  'develop',
  'setup',
  'initialize',
];

const MODIFY_TASK_KEYWORDS = [
  'change',
  'modify',
  'update',
  'edit',
  'fix',
  'adjust',
  'revise',
  'alter',
  'correct',
  'improve',
  'refactor',
  'amend',
];

const ESCALATION_KEYWORDS = [
  'urgent',
  'critical',
  'emergency',
  'asap',
  'immediately',
  'priority',
  'blocking',
  'broken',
  'down',
  'outage',
  'incident',
  'escalate',
];

const HIGH_PRIORITY_KEYWORDS = [
  'important',
  'soon',
  'quickly',
  'fast',
  'hurry',
  'deadline',
  'today',
  'now',
];

const LOW_PRIORITY_KEYWORDS = [
  'when you can',
  'no rush',
  'eventually',
  'sometime',
  'later',
  'whenever',
  'backlog',
];

// =============================================================================
// Triage Engine Implementation
// =============================================================================

/**
 * TriageEngine - RAG-based request classification engine
 *
 * Provides intelligent routing and classification of incoming requests
 * using keyword matching with hooks for future RAG integration.
 */
export class TriageEngine {
  private memoryBankPath: string;
  private ragIndex: RAGIndex | null;
  private keywordThreshold: number;
  private enableRAG: boolean;
  private priorityWeights: PriorityWeights;

  constructor(config: TriageEngineConfig) {
    this.memoryBankPath = config.memoryBankPath;
    this.ragIndex = config.ragIndex ?? null;
    this.keywordThreshold = config.keywordThreshold ?? 0.3;
    this.enableRAG = config.enableRAG ?? false;
    this.priorityWeights = config.priorityWeights ?? {
      urgencyKeywords: 0.4,
      taskComplexity: 0.2,
      userContext: 0.2,
      sessionHistory: 0.2,
    };
  }

  /**
   * Classify an incoming request and determine its intent, priority, and routing
   */
  async classifyRequest(request: TriageRequest): Promise<TriageResult> {
    // Load existing sessions for context matching
    const sessions = await this.loadSessions();

    // Find matching session if any
    const matchedSession = this.findMatchingSession(request, sessions);

    // Classify the intent
    const intent = await this.classifyIntent(request, matchedSession);

    // Calculate priority
    const priority = this.calculatePriority(request, intent);

    // Calculate confidence based on keyword matching strength
    const confidence = this.calculateConfidence(request, intent);

    // Generate suggested actions
    const suggestedActions = this.generateSuggestedActions(
      intent,
      priority,
      matchedSession
    );

    // Generate reasoning explanation
    const reasoning = this.generateReasoning(
      request,
      intent,
      priority,
      matchedSession
    );

    return {
      requestId: request.id,
      intent,
      priority,
      confidence,
      matchedSession,
      suggestedActions,
      reasoning,
      timestamp: new Date(),
    };
  }

  /**
   * Find a matching session based on request content and context
   */
  private findMatchingSession(
    request: TriageRequest,
    sessions: SessionMatch[]
  ): SessionMatch | null {
    if (sessions.length === 0) {
      return null;
    }

    // If request explicitly references a session ID
    if (request.sessionId) {
      const exactMatch = sessions.find(s => s.sessionId === request.sessionId);
      if (exactMatch) {
        return exactMatch;
      }
    }

    // Score sessions based on relevance
    const scoredSessions = sessions.map(session => {
      let score = session.relevanceScore;

      // Boost active sessions
      if (session.status === 'active') {
        score += 0.2;
      }

      // Boost recently active sessions
      const hoursSinceActivity =
        (Date.now() - session.lastActivity.getTime()) / (1000 * 60 * 60);
      if (hoursSinceActivity < 1) {
        score += 0.3;
      } else if (hoursSinceActivity < 24) {
        score += 0.1;
      }

      // Check content similarity with session context
      if (session.context?.taskDescription) {
        const similarity = this.calculateTextSimilarity(
          request.content.toLowerCase(),
          session.context.taskDescription.toLowerCase()
        );
        score += similarity * 0.3;
      }

      return { session, score };
    });

    // Sort by score and return best match if above threshold
    scoredSessions.sort((a, b) => b.score - a.score);

    const bestMatch = scoredSessions[0];
    if (bestMatch && bestMatch.score >= this.keywordThreshold) {
      return {
        ...bestMatch.session,
        relevanceScore: bestMatch.score,
      };
    }

    return null;
  }

  /**
   * Classify the intent of a request
   */
  private async classifyIntent(
    request: TriageRequest,
    sessionMatch: SessionMatch | null
  ): Promise<IntentType> {
    const content = request.content.toLowerCase();

    // Calculate keyword match scores for each intent type
    const scores = {
      status_query: this.calculateKeywordScore(content, STATUS_KEYWORDS),
      new_task: this.calculateKeywordScore(content, NEW_TASK_KEYWORDS),
      modify_task: this.calculateKeywordScore(content, MODIFY_TASK_KEYWORDS),
      escalation: this.calculateKeywordScore(content, ESCALATION_KEYWORDS),
    };

    // Find the highest scoring intent
    const entries = Object.entries(scores) as [IntentType, number][];
    entries.sort((a, b) => b[1] - a[1]);

    const [topIntent, topScore] = entries[0];

    // If we have a matched session, adjust intent classification
    if (sessionMatch) {
      // Status queries are more likely when referencing an existing session
      if (topIntent === 'status_query' || topScore < this.keywordThreshold) {
        if (scores.status_query > 0 || this.containsSessionReference(content)) {
          return 'status_query';
        }
      }
    }

    // Return unknown if confidence is too low
    if (topScore < this.keywordThreshold) {
      // Check for RAG-based classification if enabled
      if (this.enableRAG && this.ragIndex) {
        return this.classifyWithRAG(request);
      }
      return 'unknown';
    }

    return topIntent;
  }

  /**
   * Calculate priority based on request content and intent
   */
  private calculatePriority(
    request: TriageRequest,
    intent: IntentType
  ): PriorityLevel {
    const content = request.content.toLowerCase();

    // Escalation intent automatically gets critical priority
    if (intent === 'escalation') {
      return 'critical';
    }

    // Check for explicit priority indicators
    const escalationScore = this.calculateKeywordScore(
      content,
      ESCALATION_KEYWORDS
    );
    if (escalationScore > 0.5) {
      return 'critical';
    }

    const highPriorityScore = this.calculateKeywordScore(
      content,
      HIGH_PRIORITY_KEYWORDS
    );
    if (highPriorityScore > 0.3 || escalationScore > 0.2) {
      return 'high';
    }

    const lowPriorityScore = this.calculateKeywordScore(
      content,
      LOW_PRIORITY_KEYWORDS
    );
    if (lowPriorityScore > 0.3) {
      return 'low';
    }

    // Consider user context if available
    if (request.metadata?.userPriority === 'vip') {
      return 'high';
    }

    // Default to normal priority
    return 'normal';
  }

  /**
   * Synthesize a status response for a given session
   */
  async synthesizeStatusResponse(sessionId: string): Promise<string> {
    const sessions = await this.loadSessions();
    const session = sessions.find(s => s.sessionId === sessionId);

    if (!session) {
      return `Session ${sessionId} not found. It may have been completed or expired.`;
    }

    const progress = this.formatSessionProgress(session);
    return this.generateVPResponse(progress);
  }

  /**
   * Generate a VP-style response for progress updates
   */
  private async generateVPResponse(progress: string): Promise<string> {
    // Template-based response generation
    // Future: Integrate with LLM for more natural responses

    const statusPhrases = [
      'Here is the current status:',
      'Progress update:',
      'Current state of the task:',
    ];

    const selectedPhrase =
      statusPhrases[Math.floor(Math.random() * statusPhrases.length)];

    return `${selectedPhrase}\n\n${progress}`;
  }

  // =============================================================================
  // Private Helper Methods
  // =============================================================================

  /**
   * Calculate keyword matching score
   */
  private calculateKeywordScore(content: string, keywords: string[]): number {
    let matches = 0;
    let totalWeight = 0;

    for (const keyword of keywords) {
      const weight = keyword.split(' ').length; // Multi-word phrases get higher weight
      totalWeight += weight;

      if (content.includes(keyword)) {
        matches += weight;
      }
    }

    return totalWeight > 0 ? matches / totalWeight : 0;
  }

  /**
   * Calculate text similarity using basic token overlap
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const tokens1 = new Set(text1.split(/\s+/).filter(t => t.length > 2));
    const tokens2 = new Set(text2.split(/\s+/).filter(t => t.length > 2));

    if (tokens1.size === 0 || tokens2.size === 0) {
      return 0;
    }

    const intersection = new Set([...tokens1].filter(t => tokens2.has(t)));
    const union = new Set([...tokens1, ...tokens2]);

    return intersection.size / union.size; // Jaccard similarity
  }

  /**
   * Check if content references a session
   */
  private containsSessionReference(content: string): boolean {
    const sessionPatterns = [
      /session[- ]?\d+/i,
      /task[- ]?\d+/i,
      /job[- ]?\d+/i,
      /request[- ]?\d+/i,
      /the (task|job|request|session)/i,
      /my (task|job|request|session)/i,
      /that (task|job|request|session)/i,
    ];

    return sessionPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Calculate overall confidence score
   */
  private calculateConfidence(
    request: TriageRequest,
    intent: IntentType
  ): number {
    const content = request.content.toLowerCase();

    const intentKeywords: Record<IntentType, string[]> = {
      status_query: STATUS_KEYWORDS,
      new_task: NEW_TASK_KEYWORDS,
      modify_task: MODIFY_TASK_KEYWORDS,
      escalation: ESCALATION_KEYWORDS,
      unknown: [],
    };

    const keywords = intentKeywords[intent];
    if (keywords.length === 0) {
      return 0.1; // Low confidence for unknown intent
    }

    const score = this.calculateKeywordScore(content, keywords);

    // Scale to 0-1 range with minimum of 0.5 for matched intents
    return Math.min(1, 0.5 + score * 0.5);
  }

  /**
   * Generate suggested actions based on classification
   */
  private generateSuggestedActions(
    intent: IntentType,
    priority: PriorityLevel,
    sessionMatch: SessionMatch | null
  ): string[] {
    const actions: string[] = [];

    switch (intent) {
      case 'status_query':
        if (sessionMatch) {
          actions.push(`Retrieve status for session ${sessionMatch.sessionId}`);
          actions.push('Generate progress summary');
        } else {
          actions.push('List active sessions for user');
          actions.push('Request session clarification');
        }
        break;

      case 'new_task':
        actions.push('Create new task session');
        actions.push('Parse task requirements');
        actions.push('Assign to appropriate worker');
        break;

      case 'modify_task':
        if (sessionMatch) {
          actions.push(
            `Load session ${sessionMatch.sessionId} for modification`
          );
          actions.push('Parse modification requirements');
        } else {
          actions.push('Request task identification');
        }
        break;

      case 'escalation':
        actions.push('Route to priority queue');
        actions.push('Notify on-call personnel');
        if (sessionMatch) {
          actions.push(`Escalate session ${sessionMatch.sessionId}`);
        }
        break;

      default:
        actions.push('Request clarification');
        actions.push('Route to general queue');
    }

    // Add priority-specific actions
    if (priority === 'critical') {
      actions.unshift('IMMEDIATE: Alert on-call team');
    }

    return actions;
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(
    request: TriageRequest,
    intent: IntentType,
    priority: PriorityLevel,
    sessionMatch: SessionMatch | null
  ): string {
    const parts: string[] = [];

    parts.push(
      `Request classified as "${intent}" intent with "${priority}" priority.`
    );

    if (sessionMatch) {
      parts.push(
        `Matched to existing session ${sessionMatch.sessionId} ` +
          `(relevance: ${(sessionMatch.relevanceScore * 100).toFixed(0)}%).`
      );
    } else {
      parts.push('No matching session found.');
    }

    // Add keyword-based reasoning
    const content = request.content.toLowerCase();
    const matchedKeywords: string[] = [];

    const allKeywords = [
      ...STATUS_KEYWORDS,
      ...NEW_TASK_KEYWORDS,
      ...MODIFY_TASK_KEYWORDS,
      ...ESCALATION_KEYWORDS,
    ];

    for (const keyword of allKeywords) {
      if (content.includes(keyword)) {
        matchedKeywords.push(keyword);
      }
    }

    if (matchedKeywords.length > 0) {
      parts.push(
        `Detected keywords: ${matchedKeywords.slice(0, 5).join(', ')}.`
      );
    }

    return parts.join(' ');
  }

  /**
   * Format session progress for display
   */
  private formatSessionProgress(session: SessionMatch): string {
    const lines: string[] = [];

    lines.push(`Session: ${session.sessionId}`);
    lines.push(`Status: ${session.status}`);
    lines.push(`Last Activity: ${session.lastActivity.toISOString()}`);

    if (session.context) {
      if (session.context.taskDescription) {
        lines.push(`Task: ${session.context.taskDescription}`);
      }
      if (session.context.progress !== undefined) {
        lines.push(`Progress: ${session.context.progress}%`);
      }
      if (session.context.currentStep) {
        lines.push(`Current Step: ${session.context.currentStep}`);
      }
      if (session.context.errors && session.context.errors.length > 0) {
        lines.push(
          `Errors: ${session.context.errors.length} error(s) encountered`
        );
      }
    }

    return lines.join('\n');
  }

  /**
   * Load sessions from memory bank
   * Placeholder implementation - integrate with actual memory bank storage
   */
  private async loadSessions(): Promise<SessionMatch[]> {
    // TODO: Implement actual session loading from memoryBankPath
    // This is a placeholder that returns an empty array
    // Future implementation will read from:
    // - File-based storage at memoryBankPath
    // - Or integrate with memory bank MCP tools

    // For now, return empty array - actual implementation pending
    return [];
  }

  /**
   * Classify using RAG when keyword matching is insufficient
   * Placeholder for future RAG integration
   */
  private async classifyWithRAG(request: TriageRequest): Promise<IntentType> {
    if (!this.ragIndex) {
      return 'unknown';
    }

    try {
      // Search for similar past requests
      const results = await this.ragIndex.search(request.content, {
        topK: 5,
        minScore: 0.7,
      });

      if (results.length === 0) {
        return 'unknown';
      }

      // Extract intent from most similar past request
      const topResult = results[0];
      const pastIntent = topResult.metadata?.intent as IntentType | undefined;

      if (
        pastIntent &&
        ['status_query', 'new_task', 'modify_task', 'escalation'].includes(
          pastIntent
        )
      ) {
        return pastIntent;
      }

      return 'unknown';
    } catch {
      // Fall back to unknown on RAG errors
      return 'unknown';
    }
  }
}

// =============================================================================
// Factory and Utility Functions
// =============================================================================

/**
 * Create a TriageEngine with default configuration
 */
export function createTriageEngine(memoryBankPath: string): TriageEngine {
  return new TriageEngine({
    memoryBankPath,
    enableRAG: false,
  });
}

/**
 * Create a TriageEngine with RAG enabled
 */
export function createTriageEngineWithRAG(
  memoryBankPath: string,
  ragIndex: RAGIndex
): TriageEngine {
  return new TriageEngine({
    memoryBankPath,
    ragIndex,
    enableRAG: true,
  });
}
