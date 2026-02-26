/**
 * Content Analyzer - Traffic Manager
 *
 * Analyzes inbound message content to determine which agent discipline should
 * handle it. All analysis is synchronous keyword-based (no LLM calls).
 *
 * @packageDocumentation
 */

import { MessagePriority } from './types.js';
import type { ContentAnalysis } from './types.js';
import type { NormalizedMessage } from '../channels/types.js';

// ---------------------------------------------------------------------------
// Keyword Maps
// ---------------------------------------------------------------------------

const DISCIPLINE_KEYWORDS: Record<string, string[]> = {
  engineering: [
    'deploy',
    'code',
    'bug',
    'api',
    'database',
    'server',
    'build',
    'test',
    'CI',
    'pipeline',
    'git',
    'merge',
    'PR',
    'pull request',
    'sprint',
  ],
  design: [
    'design',
    'UI',
    'UX',
    'wireframe',
    'mockup',
    'figma',
    'prototype',
    'layout',
    'typography',
    'color',
  ],
  marketing: [
    'campaign',
    'SEO',
    'analytics',
    'funnel',
    'conversion',
    'brand',
    'content',
    'social media',
    'engagement',
  ],
  finance: [
    'budget',
    'invoice',
    'expense',
    'revenue',
    'forecast',
    'P&L',
    'ROI',
    'cost',
    'payment',
  ],
  hr: [
    'hiring',
    'onboarding',
    'performance review',
    'PTO',
    'benefits',
    'compensation',
    'culture',
  ],
  legal: [
    'contract',
    'compliance',
    'NDA',
    'terms',
    'policy',
    'regulation',
    'liability',
    'IP',
  ],
  operations: [
    'process',
    'workflow',
    'SOP',
    'vendor',
    'logistics',
    'supply chain',
    'inventory',
  ],
  product: [
    'roadmap',
    'feature',
    'backlog',
    'user story',
    'requirement',
    'milestone',
    'release',
    'MVP',
  ],
};

const URGENCY_KEYWORDS: Record<string, MessagePriority> = {
  emergency: MessagePriority.CRITICAL,
  down: MessagePriority.CRITICAL,
  outage: MessagePriority.CRITICAL,
  critical: MessagePriority.CRITICAL,
  broken: MessagePriority.CRITICAL,
  urgent: MessagePriority.URGENT,
  asap: MessagePriority.URGENT,
  immediately: MessagePriority.URGENT,
  blocking: MessagePriority.URGENT,
  important: MessagePriority.HIGH,
  priority: MessagePriority.HIGH,
  soon: MessagePriority.HIGH,
};

const POSITIVE_WORDS = new Set([
  'great',
  'good',
  'excellent',
  'awesome',
  'perfect',
  'thanks',
  'thank',
  'helpful',
  'nice',
  'fantastic',
  'love',
  'wonderful',
  'amazing',
  'success',
  'resolved',
  'fixed',
  'done',
  'completed',
  'approve',
  'approved',
]);

const NEGATIVE_WORDS = new Set([
  'bad',
  'broken',
  'fail',
  'failed',
  'error',
  'wrong',
  'issue',
  'problem',
  'bug',
  'crash',
  'down',
  'outage',
  'blocked',
  'stuck',
  'slow',
  'terrible',
  'awful',
  'hate',
  'frustrated',
  'urgent',
  'critical',
  'emergency',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Tokenize text to lower-case words (handles multi-word phrases via substring). */
function lowerText(text: string): string {
  return text.toLowerCase();
}

/** Count how many keywords from a list appear in the lowered text. */
function countKeywordHits(lowered: string, keywords: string[]): number {
  return keywords.reduce(
    (n, kw) => (lowered.includes(kw.toLowerCase()) ? n + 1 : n),
    0
  );
}

/** Extract @mention names from raw message text (e.g. @Alice, @engineering-bot). */
function extractMentions(text: string): string[] {
  const matches = text.match(/@([\w.-]+)/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.slice(1)))];
}

/**
 * Estimate message complexity based on length and structure.
 */
function estimateComplexity(text: string): 'simple' | 'moderate' | 'complex' {
  const wordCount = text.trim().split(/\s+/).length;
  const hasBullets = /^[\s]*[-*•]\s/m.test(text);
  const hasNumberedList = /^\s*\d+\.\s/m.test(text);
  const hasCodeBlock = /```/.test(text) || /`[^`]+`/.test(text);
  const hasUrl = /https?:\/\//.test(text);

  let score = 0;
  if (wordCount > 20) score++;
  if (wordCount > 60) score++;
  if (hasBullets || hasNumberedList) score++;
  if (hasCodeBlock || hasUrl) score++;

  if (score <= 1) return 'simple';
  if (score <= 2) return 'moderate';
  return 'complex';
}

/** Derive a simple intent label from routing context. */
function deriveIntent(
  disciplines: string[],
  urgency: MessagePriority,
  isThread: boolean
): string {
  if (urgency >= MessagePriority.URGENT) return 'escalation';
  if (isThread) return 'thread_reply';
  if (disciplines.length === 0) return 'general_inquiry';
  return `${disciplines[0]}_request`;
}

// ---------------------------------------------------------------------------
// ContentAnalyzer
// ---------------------------------------------------------------------------

export class ContentAnalyzer {
  private readonly disciplineKeywords: Record<string, string[]>;

  constructor(customKeywords?: Record<string, string[]>) {
    this.disciplineKeywords = customKeywords
      ? mergeKeywords(DISCIPLINE_KEYWORDS, customKeywords)
      : DISCIPLINE_KEYWORDS;
  }

  analyze(message: NormalizedMessage): ContentAnalysis {
    const text = message.content.text;
    const lowered = lowerText(text);

    // 1. Extract @mentions from raw text
    const rawText = message.content.rawText ?? text;
    const mentionedAgentNames = extractMentions(rawText);

    // 2. Match keywords to disciplines
    const disciplineScores: Record<string, number> = {};
    for (const [discipline, keywords] of Object.entries(
      this.disciplineKeywords
    )) {
      const hits = countKeywordHits(lowered, keywords);
      if (hits > 0) {
        disciplineScores[discipline] = hits;
      }
    }
    const requiredDisciplines = Object.keys(disciplineScores).sort(
      (a, b) => (disciplineScores[b] ?? 0) - (disciplineScores[a] ?? 0)
    );

    // 3. Detect urgency (higher enum value = more urgent)
    let urgency: MessagePriority = MessagePriority.NORMAL;
    for (const [kw, priority] of Object.entries(URGENCY_KEYWORDS)) {
      if (lowered.includes(kw) && priority > urgency) {
        urgency = priority;
      }
    }

    // 4. Simple sentiment
    const words = lowered.split(/\W+/);
    let positiveCount = 0;
    let negativeCount = 0;
    for (const w of words) {
      if (POSITIVE_WORDS.has(w)) positiveCount++;
      if (NEGATIVE_WORDS.has(w)) negativeCount++;
    }
    const sentiment: ContentAnalysis['sentiment'] =
      positiveCount > negativeCount
        ? 'positive'
        : negativeCount > positiveCount
          ? 'negative'
          : 'neutral';

    // 5. Thread continuation
    const isThreadContinuation = message.threadId !== undefined;

    // 6. Complexity
    const complexity = estimateComplexity(text);

    // 7. Topics - most frequent discipline-related terms found in text
    const topics = extractTopics(
      lowered,
      this.disciplineKeywords,
      disciplineScores
    );

    // 8. Intent - derive a brief intent label from the top discipline or urgency
    const intent = deriveIntent(
      requiredDisciplines,
      urgency,
      isThreadContinuation
    );

    return {
      topics,
      sentiment,
      urgency,
      intent,
      requiredDisciplines,
      suggestedAgentIds: [],
      language: 'en',
      complexity,
      mentionedAgentNames,
      isThreadContinuation,
    };
  }
}

// ---------------------------------------------------------------------------
// Topic extraction helper
// ---------------------------------------------------------------------------

function extractTopics(
  lowered: string,
  keywordMap: Record<string, string[]>,
  disciplineScores: Record<string, number>
): string[] {
  // Collect all matched keywords across winning disciplines, deduplicated
  const topDisciplines = Object.keys(disciplineScores).slice(0, 3);
  const seen = new Set<string>();
  const topics: string[] = [];

  for (const discipline of topDisciplines) {
    const keywords = keywordMap[discipline] ?? [];
    for (const kw of keywords) {
      if (lowered.includes(kw.toLowerCase()) && !seen.has(kw)) {
        seen.add(kw);
        topics.push(kw);
      }
    }
  }

  return topics.slice(0, 10);
}

// ---------------------------------------------------------------------------
// Keyword merge helper
// ---------------------------------------------------------------------------

function mergeKeywords(
  base: Record<string, string[]>,
  custom: Record<string, string[]>
): Record<string, string[]> {
  const result: Record<string, string[]> = { ...base };
  for (const [discipline, keywords] of Object.entries(custom)) {
    result[discipline] = [...(result[discipline] ?? []), ...keywords];
  }
  return result;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createContentAnalyzer(config?: {
  customKeywords?: Record<string, string[]>;
}): ContentAnalyzer {
  return new ContentAnalyzer(config?.customKeywords);
}
