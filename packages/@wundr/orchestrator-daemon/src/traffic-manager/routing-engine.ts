import { EventEmitter } from 'eventemitter3';
import type {
  AgentCapabilityProfile,
  AgentSeniority,
  ContentAnalysis,
  InboundMessageEnvelope,
  MessagePriority,
  RoutingDecision,
  RoutingRule,
  TrafficManagerConfig,
} from './types.js';
import type { AgentRegistry } from './agent-registry.js';
import type { ContentAnalyzer } from './content-analyzer.js';

interface RoutingEngineEvents {
  'message:routed': (decision: RoutingDecision) => void;
  'message:escalated': (decision: RoutingDecision) => void;
  'message:fallback': (decision: RoutingDecision) => void;
}

function seniorityRank(seniority: AgentSeniority): number {
  const ranks: Record<AgentSeniority, number> = {
    ic: 1,
    manager: 2,
    director: 3,
    vp: 4,
    ceo: 5,
  };
  return ranks[seniority];
}

function priorityRank(priority: MessagePriority): number {
  // MessagePriority enum values are already 0-4, re-map to named 1-5 for clarity
  return (priority as number) + 1;
}

export class RoutingEngine extends EventEmitter<RoutingEngineEvents> {
  constructor(
    private readonly registry: AgentRegistry,
    private readonly analyzer: ContentAnalyzer,
    private readonly config: TrafficManagerConfig
  ) {
    super();
  }

  route(envelope: InboundMessageEnvelope): RoutingDecision {
    const start = Date.now();
    const analysis =
      envelope.analysis ?? this.analyzer.analyze(envelope.message);
    const originalPriority = analysis.urgency;

    const decision = this.resolve(envelope, analysis, originalPriority, start);

    if (decision.escalated) {
      this.emit('message:escalated', decision);
    } else if (decision.matchedBy === 'fallback') {
      this.emit('message:fallback', decision);
    } else {
      this.emit('message:routed', decision);
    }

    return decision;
  }

  private resolve(
    envelope: InboundMessageEnvelope,
    analysis: ContentAnalysis,
    originalPriority: MessagePriority,
    start: number
  ): RoutingDecision {
    const build = (
      agentId: string,
      confidence: number,
      matchedBy: RoutingDecision['matchedBy'],
      reasoning: string,
      escalated = false
    ): RoutingDecision => ({
      selectedAgentId: agentId,
      confidence,
      reasoning,
      matchedBy,
      fallbackChain: this.buildFallbackChain(
        agentId,
        analysis.requiredDisciplines[0]
      ),
      routingLatencyMs: Date.now() - start,
      escalated,
      originalPriority,
      effectivePriority: escalated
        ? (Math.max(
            originalPriority,
            this.config.escalationThreshold
          ) as MessagePriority)
        : originalPriority,
    });

    // 1. Direct @mention
    for (const name of analysis.mentionedAgentNames) {
      const agent = this.registry
        .listAgents()
        .find(a => a.name.toLowerCase() === name.toLowerCase());
      if (agent && agent.status === 'available') {
        return build(
          agent.id,
          1.0,
          'direct_mention',
          `Directly mentioned: @${name}`
        );
      }
    }

    // 2. Thread continuity
    if (analysis.isThreadContinuation && analysis.threadAgentId) {
      const agent = this.registry.getAgent(analysis.threadAgentId);
      if (agent && agent.status === 'available') {
        return build(
          agent.id,
          0.95,
          'thread_continuity',
          `Continuing thread with ${agent.name}`
        );
      }
    }

    // 3. Binding rules (sorted ascending by priority number = lower fires first)
    const sortedRules = [...this.config.routingRules]
      .filter(r => r.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      if (this.matchesRule(rule, envelope, analysis)) {
        const agent = this.registry.getAgent(rule.targetAgentId);
        if (agent && agent.status === 'available') {
          return build(
            agent.id,
            0.9,
            'binding_rule',
            `Matched rule "${rule.name}"`
          );
        }
        // Try fallback agent from rule if primary is unavailable
        if (rule.fallbackAgentId) {
          const fallback = this.registry.getAgent(rule.fallbackAgentId);
          if (fallback && fallback.status === 'available') {
            return build(
              fallback.id,
              0.85,
              'binding_rule',
              `Rule "${rule.name}" fallback agent`
            );
          }
        }
      }
    }

    // 4. Discipline match
    const disciplineMatch = this.bestDisciplineMatch(
      analysis.requiredDisciplines
    );
    if (disciplineMatch) {
      const confidence = disciplineMatch.status === 'available' ? 0.85 : 0.7;
      return build(
        disciplineMatch.id,
        confidence,
        'discipline_match',
        `Best match for disciplines: ${analysis.requiredDisciplines.join(', ')}`
      );
    }

    // 5. Seniority escalation
    if (
      (analysis.urgency as number) >=
      (this.config.escalationThreshold as number)
    ) {
      const senior = this.registry
        .findBySeniority('director')
        .filter(a => a.status === 'available')
        .sort((a, b) => a.currentLoad - b.currentLoad)[0];
      if (senior) {
        return build(
          senior.id,
          0.8,
          'seniority_escalation',
          `Escalated due to urgency (${analysis.urgency}) >= threshold (${this.config.escalationThreshold})`,
          true
        );
      }
    }

    // 6. Load balance - lowest load among all available
    const available = this.registry.listAvailable();
    if (available.length > 0) {
      const lowest = available.reduce((best, a) =>
        a.currentLoad < best.currentLoad ? a : best
      );
      return build(
        lowest.id,
        0.5,
        'load_balance',
        `Load balanced to ${lowest.name}`
      );
    }

    // 7. Fallback
    return build(
      this.config.defaultAgentId,
      0.3,
      'fallback',
      'No suitable agent found, routing to default'
    );
  }

  private matchesRule(
    rule: RoutingRule,
    envelope: InboundMessageEnvelope,
    analysis: ContentAnalysis
  ): boolean {
    const { conditions } = rule;

    if (conditions.channelPattern) {
      const pattern = new RegExp(conditions.channelPattern, 'i');
      if (!pattern.test(envelope.channelId)) return false;
    }

    if (conditions.senderPattern) {
      const senderId = envelope.message.sender.id ?? '';
      const pattern = new RegExp(conditions.senderPattern, 'i');
      if (!pattern.test(senderId)) return false;
    }

    if (conditions.contentKeywords && conditions.contentKeywords.length > 0) {
      const text = envelope.message.content.text.toLowerCase();
      const hasKeyword = conditions.contentKeywords.some(kw =>
        text.includes(kw.toLowerCase())
      );
      if (!hasKeyword) return false;
    }

    if (conditions.messageTypes && conditions.messageTypes.length > 0) {
      if (!conditions.messageTypes.includes(envelope.message.chatType))
        return false;
    }

    if (conditions.minPriority !== undefined) {
      if ((analysis.urgency as number) < (conditions.minPriority as number))
        return false;
    }

    return true;
  }

  private bestDisciplineMatch(
    requiredDisciplines: readonly string[]
  ): AgentCapabilityProfile | null {
    if (requiredDisciplines.length === 0) return null;

    const allCandidates: AgentCapabilityProfile[] = [];

    for (const discipline of requiredDisciplines) {
      allCandidates.push(...this.registry.findByDiscipline(discipline));
    }

    if (allCandidates.length === 0) return null;

    // Prefer available agents, then sort by seniority weight * (1 - load)
    const weights = this.config.seniorityWeights;
    return (
      allCandidates.sort((a, b) => {
        const aAvail = a.status === 'available' ? 1 : 0;
        const bAvail = b.status === 'available' ? 1 : 0;
        if (aAvail !== bAvail) return bAvail - aAvail;
        const aScore = (weights[a.seniority] ?? 1) * (1 - a.currentLoad);
        const bScore = (weights[b.seniority] ?? 1) * (1 - b.currentLoad);
        return bScore - aScore;
      })[0] ?? null
    );
  }

  private buildFallbackChain(
    primaryAgentId: string,
    discipline?: string
  ): string[] {
    const chain: string[] = [];

    // Same discipline agents sorted by load (excluding primary)
    if (discipline) {
      const sameDiscipline = this.registry
        .findByDiscipline(discipline)
        .filter(a => a.id !== primaryAgentId && a.status === 'available')
        .sort((a, b) => a.currentLoad - b.currentLoad);
      for (const a of sameDiscipline) {
        if (chain.length >= 3) break;
        chain.push(a.id);
      }
    }

    // Fill remaining slots from any available agent sorted by load
    if (chain.length < 3) {
      const others = this.registry
        .listAvailable()
        .filter(a => a.id !== primaryAgentId && !chain.includes(a.id))
        .sort((a, b) => a.currentLoad - b.currentLoad);
      for (const a of others) {
        if (chain.length >= 3) break;
        chain.push(a.id);
      }
    }

    return chain;
  }
}

export function createRoutingEngine(
  registry: AgentRegistry,
  analyzer: ContentAnalyzer,
  config: TrafficManagerConfig
): RoutingEngine {
  return new RoutingEngine(registry, analyzer, config);
}
