/**
 * Speaker Selection Strategies for AutoGen-style Group Chat
 *
 * Implements various strategies for selecting the next speaker in a
 * multi-agent conversation, including round-robin, LLM-selected, and priority-based.
 */

import type {
  ChatParticipant,
  Message,
  ChatContext,
  SpeakerSelectionConfig,
  SpeakerSelectionResult,
  SpeakerSelectionStrategy,
  SpeakerSelectionMethod,
  TransitionRule,
} from './types';

/**
 * Factory function to create speaker selection strategies
 * @param method - The speaker selection method to use
 * @returns The appropriate speaker selection strategy
 */
export function createSpeakerSelector(
  method: SpeakerSelectionMethod,
): SpeakerSelectionStrategy {
  switch (method) {
    case 'round_robin':
      return new RoundRobinSelector();
    case 'random':
      return new RandomSelector();
    case 'llm_selected':
      return new LLMSelector();
    case 'priority':
      return new PrioritySelector();
    case 'manual':
      return new ManualSelector();
    case 'auto':
      return new AutoSelector();
    default:
      return new RoundRobinSelector();
  }
}

/**
 * Round-robin speaker selection - cycles through participants in order
 */
export class RoundRobinSelector implements SpeakerSelectionStrategy {
  private currentIndex = 0;

  /**
   * Select the next speaker using round-robin ordering
   * @param participants - Available participants
   * @param messages - Message history
   * @param context - Current chat context
   * @param _config - Optional configuration (unused)
   * @returns Speaker selection result
   */
  async selectSpeaker(
    participants: ChatParticipant[],
    messages: Message[],
    _context: ChatContext,
    _config?: SpeakerSelectionConfig,
  ): Promise<SpeakerSelectionResult> {
    const activeParticipants = participants.filter(
      p => p.status === 'active' || p.status === 'idle',
    );

    if (activeParticipants.length === 0) {
      throw new Error('No active participants available for selection');
    }

    // Find the last speaker and get the next one
    const lastMessage = messages[messages.length - 1];
    if (lastMessage) {
      const lastSpeakerIndex = activeParticipants.findIndex(
        p => p.name === lastMessage.name,
      );
      if (lastSpeakerIndex !== -1) {
        this.currentIndex = (lastSpeakerIndex + 1) % activeParticipants.length;
      }
    }

    const selectedParticipant = activeParticipants[this.currentIndex];
    if (!selectedParticipant) {
      throw new Error('Failed to select participant in round-robin');
    }

    return {
      speaker: selectedParticipant.name,
      reason: `Round-robin selection: position ${this.currentIndex + 1} of ${activeParticipants.length}`,
      confidence: 1.0,
      alternatives: activeParticipants
        .filter(p => p.name !== selectedParticipant.name)
        .map(p => p.name),
    };
  }

  /**
   * Reset the round-robin index
   */
  reset(): void {
    this.currentIndex = 0;
  }
}

/**
 * Random speaker selection - randomly selects from available participants
 */
export class RandomSelector implements SpeakerSelectionStrategy {
  /**
   * Select the next speaker randomly
   * @param participants - Available participants
   * @param messages - Message history
   * @param context - Current chat context
   * @param config - Optional configuration
   * @returns Speaker selection result
   */
  async selectSpeaker(
    participants: ChatParticipant[],
    messages: Message[],
    context: ChatContext,
    config?: SpeakerSelectionConfig,
  ): Promise<SpeakerSelectionResult> {
    const activeParticipants = participants.filter(
      p => p.status === 'active' || p.status === 'idle',
    );

    if (activeParticipants.length === 0) {
      throw new Error('No active participants available for selection');
    }

    // Optionally exclude the last speaker
    const lastMessage = messages[messages.length - 1];
    let eligibleParticipants = activeParticipants;

    if (lastMessage && activeParticipants.length > 1) {
      eligibleParticipants = activeParticipants.filter(
        p => p.name !== lastMessage.name,
      );
    }

    // Apply weights if configured
    let selectedParticipant: ChatParticipant;
    if (config?.weights && Object.keys(config.weights).length > 0) {
      selectedParticipant = this.weightedSelection(
        eligibleParticipants,
        config.weights,
      );
    } else {
      const randomIndex = Math.floor(
        Math.random() * eligibleParticipants.length,
      );
      selectedParticipant = eligibleParticipants[randomIndex]!;
    }

    return {
      speaker: selectedParticipant.name,
      reason: 'Random selection from eligible participants',
      confidence: 1 / eligibleParticipants.length,
      alternatives: eligibleParticipants
        .filter(p => p.name !== selectedParticipant.name)
        .map(p => p.name),
    };
  }

  /**
   * Perform weighted random selection
   * @param participants - Participants to select from
   * @param weights - Weight for each participant
   * @returns Selected participant
   */
  private weightedSelection(
    participants: ChatParticipant[],
    weights: Record<string, number>,
  ): ChatParticipant {
    const totalWeight = participants.reduce(
      (sum, p) => sum + (weights[p.name] || 1),
      0,
    );

    let random = Math.random() * totalWeight;

    for (const participant of participants) {
      const weight = weights[participant.name] || 1;
      random -= weight;
      if (random <= 0) {
        return participant;
      }
    }

    // Fallback to last participant
    return participants[participants.length - 1]!;
  }
}

/**
 * LLM-based speaker selection - uses an LLM to determine the best next speaker
 */
export class LLMSelector implements SpeakerSelectionStrategy {
  /**
   * Select the next speaker using LLM reasoning
   * @param participants - Available participants
   * @param messages - Message history
   * @param context - Current chat context
   * @param config - Configuration including LLM settings
   * @returns Speaker selection result
   */
  async selectSpeaker(
    participants: ChatParticipant[],
    messages: Message[],
    context: ChatContext,
    config?: SpeakerSelectionConfig,
  ): Promise<SpeakerSelectionResult> {
    const activeParticipants = participants.filter(
      p => p.status === 'active' || p.status === 'idle',
    );

    if (activeParticipants.length === 0) {
      throw new Error('No active participants available for selection');
    }

    // Build the selection prompt
    const selectionPrompt = this.buildSelectionPrompt(
      activeParticipants,
      messages,
      context,
      config,
    );

    // Simulate LLM selection (in real implementation, call actual LLM)
    const selectedName = await this.simulateLLMSelection(
      selectionPrompt,
      activeParticipants,
      messages,
    );

    const selectedParticipant = activeParticipants.find(
      p => p.name === selectedName,
    );

    if (!selectedParticipant) {
      // Fallback to first active participant
      const fallback = activeParticipants[0]!;
      return {
        speaker: fallback.name,
        reason: 'LLM selection fallback: invalid selection returned',
        confidence: 0.5,
        alternatives: activeParticipants
          .filter(p => p.name !== fallback.name)
          .map(p => p.name),
      };
    }

    return {
      speaker: selectedParticipant.name,
      reason:
        'LLM selected based on conversation context and participant capabilities',
      confidence: 0.85,
      alternatives: activeParticipants
        .filter(p => p.name !== selectedParticipant.name)
        .map(p => p.name),
    };
  }

  /**
   * Build the prompt for LLM speaker selection
   * @param participants - Available participants
   * @param messages - Message history
   * @param context - Chat context
   * @param config - Selection configuration
   * @returns Formatted prompt string
   */
  private buildSelectionPrompt(
    participants: ChatParticipant[],
    messages: Message[],
    context: ChatContext,
    config?: SpeakerSelectionConfig,
  ): string {
    const participantDescriptions = participants
      .map(
        p => `- ${p.name}: ${p.description || p.systemPrompt.slice(0, 100)}...`,
      )
      .join('\n');

    const recentMessages = messages
      .slice(-5)
      .map(m => `${m.name}: ${m.content.slice(0, 200)}`)
      .join('\n');

    const basePrompt =
      config?.selectorPrompt ||
      'You are a conversation moderator. Select the most appropriate next speaker.';

    return `${basePrompt}

## Available Participants:
${participantDescriptions}

## Recent Conversation:
${recentMessages}

## Context:
- Current round: ${context.currentRound}
- Previous speaker: ${context.previousSpeaker || 'None'}

Based on the conversation flow and participant expertise, who should speak next?
Return only the participant name.`;
  }

  /**
   * Simulate LLM selection (placeholder for actual LLM call)
   * @param prompt - Selection prompt
   * @param participants - Available participants
   * @param messages - Message history
   * @returns Selected participant name
   */
  private async simulateLLMSelection(
    _prompt: string,
    participants: ChatParticipant[],
    messages: Message[],
  ): Promise<string> {
    // In a real implementation, this would call an actual LLM
    // For now, use heuristics to simulate intelligent selection

    const lastMessage = messages[messages.length - 1];

    // Find participant most relevant to the last message content
    if (lastMessage) {
      const relevantParticipant = this.findMostRelevantParticipant(
        lastMessage.content,
        participants,
      );
      if (relevantParticipant) {
        return relevantParticipant.name;
      }
    }

    // Exclude last speaker and select randomly
    const eligibleParticipants = lastMessage
      ? participants.filter(p => p.name !== lastMessage.name)
      : participants;

    const randomIndex = Math.floor(Math.random() * eligibleParticipants.length);
    return eligibleParticipants[randomIndex]?.name || participants[0]!.name;
  }

  /**
   * Find the participant most relevant to the given content
   * @param content - Message content to analyze
   * @param participants - Available participants
   * @returns Most relevant participant or null
   */
  private findMostRelevantParticipant(
    content: string,
    participants: ChatParticipant[],
  ): ChatParticipant | null {
    const contentLower = content.toLowerCase();

    // Score each participant based on capability match
    let bestMatch: ChatParticipant | null = null;
    let bestScore = 0;

    for (const participant of participants) {
      let score = 0;

      // Check capabilities
      for (const capability of participant.capabilities) {
        if (contentLower.includes(capability.toLowerCase())) {
          score += 2;
        }
      }

      // Check if participant is mentioned
      if (contentLower.includes(participant.name.toLowerCase())) {
        score += 5;
      }

      // Check description keywords
      if (participant.description) {
        const descWords = participant.description.toLowerCase().split(/\s+/);
        for (const word of descWords) {
          if (word.length > 4 && contentLower.includes(word)) {
            score += 1;
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = participant;
      }
    }

    return bestScore > 0 ? bestMatch : null;
  }
}

/**
 * Priority-based speaker selection - selects based on configured priority order
 */
export class PrioritySelector implements SpeakerSelectionStrategy {
  /**
   * Select the next speaker based on priority order
   * @param participants - Available participants
   * @param messages - Message history
   * @param context - Current chat context
   * @param config - Configuration with priority order
   * @returns Speaker selection result
   */
  async selectSpeaker(
    participants: ChatParticipant[],
    messages: Message[],
    context: ChatContext,
    config?: SpeakerSelectionConfig,
  ): Promise<SpeakerSelectionResult> {
    const activeParticipants = participants.filter(
      p => p.status === 'active' || p.status === 'idle',
    );

    if (activeParticipants.length === 0) {
      throw new Error('No active participants available for selection');
    }

    const priorityOrder = config?.priorityOrder || [];
    const lastMessage = messages[messages.length - 1];

    // Check transition rules first
    if (config?.transitionRules && lastMessage) {
      const nextSpeaker = this.applyTransitionRules(
        lastMessage.name,
        config.transitionRules,
        activeParticipants,
      );
      if (nextSpeaker) {
        return {
          speaker: nextSpeaker.name,
          reason: `Transition rule: ${lastMessage.name} -> ${nextSpeaker.name}`,
          confidence: 0.9,
          alternatives: activeParticipants
            .filter(p => p.name !== nextSpeaker.name)
            .map(p => p.name),
        };
      }
    }

    // Check allowed transitions
    if (config?.allowedTransitions && lastMessage) {
      const allowed = config.allowedTransitions[lastMessage.name];
      if (allowed && allowed.length > 0) {
        const eligibleParticipants = activeParticipants.filter(p =>
          allowed.includes(p.name),
        );
        if (eligibleParticipants.length > 0) {
          const selected = eligibleParticipants[0]!;
          return {
            speaker: selected.name,
            reason: `Allowed transition from ${lastMessage.name}`,
            confidence: 0.85,
            alternatives: eligibleParticipants.slice(1).map(p => p.name),
          };
        }
      }
    }

    // Select based on priority order
    for (const priorityName of priorityOrder) {
      const participant = activeParticipants.find(p => p.name === priorityName);
      if (
        participant &&
        (!lastMessage || participant.name !== lastMessage.name)
      ) {
        return {
          speaker: participant.name,
          reason: `Priority selection: rank ${priorityOrder.indexOf(priorityName) + 1}`,
          confidence: 0.95,
          alternatives: activeParticipants
            .filter(p => p.name !== participant.name)
            .map(p => p.name),
        };
      }
    }

    // Fallback to first available participant
    const fallback =
      activeParticipants.find(
        p => !lastMessage || p.name !== lastMessage.name,
      ) || activeParticipants[0]!;

    return {
      speaker: fallback.name,
      reason: 'Priority fallback: no priority match found',
      confidence: 0.5,
      alternatives: activeParticipants
        .filter(p => p.name !== fallback.name)
        .map(p => p.name),
    };
  }

  /**
   * Apply transition rules to determine next speaker
   * @param fromSpeaker - Current speaker name
   * @param rules - Transition rules
   * @param participants - Available participants
   * @returns Next speaker or null
   */
  private applyTransitionRules(
    fromSpeaker: string,
    rules: TransitionRule[],
    participants: ChatParticipant[],
  ): ChatParticipant | null {
    // Find rules matching the current speaker
    const matchingRules = rules.filter(rule => rule.from === fromSpeaker);

    if (matchingRules.length === 0) {
      return null;
    }

    // Sort by weight if available
    matchingRules.sort((a, b) => (b.weight || 0) - (a.weight || 0));

    // Find the first valid transition
    for (const rule of matchingRules) {
      for (const toName of rule.to) {
        const participant = participants.find(
          p =>
            p.name === toName && (p.status === 'active' || p.status === 'idle'),
        );
        if (participant) {
          return participant;
        }
      }
    }

    return null;
  }
}

/**
 * Manual speaker selection - expects explicit selection from context
 */
export class ManualSelector implements SpeakerSelectionStrategy {
  /**
   * Select the next speaker from manual specification
   * @param participants - Available participants
   * @param messages - Message history
   * @param context - Current chat context with manual selection
   * @returns Speaker selection result
   */
  async selectSpeaker(
    participants: ChatParticipant[],
    _messages: Message[],
    context: ChatContext,
  ): Promise<SpeakerSelectionResult> {
    const activeParticipants = participants.filter(
      p => p.status === 'active' || p.status === 'idle',
    );

    if (activeParticipants.length === 0) {
      throw new Error('No active participants available for selection');
    }

    // Check for manually specified next speaker in context state
    const manualSelection = context.state['nextSpeaker'] as string | undefined;

    if (manualSelection) {
      const participant = activeParticipants.find(
        p => p.name === manualSelection,
      );
      if (participant) {
        return {
          speaker: participant.name,
          reason: 'Manual selection from context',
          confidence: 1.0,
          alternatives: activeParticipants
            .filter(p => p.name !== participant.name)
            .map(p => p.name),
        };
      }
    }

    // If no manual selection, wait or use fallback
    throw new Error(
      'Manual selection mode requires nextSpeaker in context state',
    );
  }
}

/**
 * Auto speaker selection - intelligently chooses selection strategy based on context
 */
export class AutoSelector implements SpeakerSelectionStrategy {
  private roundRobin = new RoundRobinSelector();
  private llm = new LLMSelector();
  private priority = new PrioritySelector();

  /**
   * Automatically select the best strategy and next speaker
   * @param participants - Available participants
   * @param messages - Message history
   * @param context - Current chat context
   * @param config - Selection configuration
   * @returns Speaker selection result
   */
  async selectSpeaker(
    participants: ChatParticipant[],
    messages: Message[],
    context: ChatContext,
    config?: SpeakerSelectionConfig,
  ): Promise<SpeakerSelectionResult> {
    const activeParticipants = participants.filter(
      p => p.status === 'active' || p.status === 'idle',
    );

    if (activeParticipants.length === 0) {
      throw new Error('No active participants available for selection');
    }

    // Determine best strategy based on context
    const strategy = this.determineStrategy(
      activeParticipants,
      messages,
      context,
      config,
    );

    let result: SpeakerSelectionResult;

    switch (strategy) {
      case 'priority':
        result = await this.priority.selectSpeaker(
          participants,
          messages,
          context,
          config,
        );
        break;
      case 'llm':
        result = await this.llm.selectSpeaker(
          participants,
          messages,
          context,
          config,
        );
        break;
      case 'round_robin':
      default:
        result = await this.roundRobin.selectSpeaker(
          participants,
          messages,
          context,
          config,
        );
        break;
    }

    return {
      ...result,
      reason: `Auto-selected ${strategy} strategy: ${result.reason}`,
    };
  }

  /**
   * Determine the best selection strategy for current context
   * @param participants - Active participants
   * @param messages - Message history
   * @param context - Chat context
   * @param config - Selection configuration
   * @returns Strategy name to use
   */
  private determineStrategy(
    participants: ChatParticipant[],
    messages: Message[],
    context: ChatContext,
    config?: SpeakerSelectionConfig,
  ): 'priority' | 'llm' | 'round_robin' {
    // Use priority if transition rules or priority order are configured
    if (
      config?.transitionRules?.length ||
      config?.priorityOrder?.length ||
      config?.allowedTransitions
    ) {
      return 'priority';
    }

    // Use LLM for complex conversations with many participants
    if (participants.length > 3 && messages.length > 5) {
      return 'llm';
    }

    // Use LLM if participants have distinct capabilities
    const uniqueCapabilities = new Set(
      participants.flatMap(p => p.capabilities),
    );
    if (uniqueCapabilities.size > participants.length * 2) {
      return 'llm';
    }

    // Default to round-robin for simple cases
    return 'round_robin';
  }
}

/**
 * Speaker selection manager that wraps all strategies
 */
export class SpeakerSelectionManager {
  private strategies: Map<SpeakerSelectionMethod, SpeakerSelectionStrategy> =
    new Map();
  private currentStrategy: SpeakerSelectionStrategy;
  private method: SpeakerSelectionMethod;

  /**
   * Create a new speaker selection manager
   * @param method - Initial selection method
   */
  constructor(method: SpeakerSelectionMethod = 'round_robin') {
    this.method = method;
    this.currentStrategy = createSpeakerSelector(method);
    this.initializeStrategies();
  }

  /**
   * Initialize all available strategies
   */
  private initializeStrategies(): void {
    this.strategies.set('round_robin', new RoundRobinSelector());
    this.strategies.set('random', new RandomSelector());
    this.strategies.set('llm_selected', new LLMSelector());
    this.strategies.set('priority', new PrioritySelector());
    this.strategies.set('manual', new ManualSelector());
    this.strategies.set('auto', new AutoSelector());
  }

  /**
   * Select the next speaker using the current strategy
   * @param participants - Available participants
   * @param messages - Message history
   * @param context - Chat context
   * @param config - Selection configuration
   * @returns Speaker selection result
   */
  async selectSpeaker(
    participants: ChatParticipant[],
    messages: Message[],
    context: ChatContext,
    config?: SpeakerSelectionConfig,
  ): Promise<SpeakerSelectionResult> {
    return this.currentStrategy.selectSpeaker(
      participants,
      messages,
      context,
      config,
    );
  }

  /**
   * Change the selection method
   * @param method - New selection method
   */
  setMethod(method: SpeakerSelectionMethod): void {
    this.method = method;
    const strategy = this.strategies.get(method);
    if (strategy) {
      this.currentStrategy = strategy;
    } else {
      this.currentStrategy = createSpeakerSelector(method);
      this.strategies.set(method, this.currentStrategy);
    }
  }

  /**
   * Get the current selection method
   * @returns Current method
   */
  getMethod(): SpeakerSelectionMethod {
    return this.method;
  }

  /**
   * Get a specific strategy instance
   * @param method - Selection method
   * @returns Strategy instance
   */
  getStrategy(method: SpeakerSelectionMethod): SpeakerSelectionStrategy {
    const strategy = this.strategies.get(method);
    if (!strategy) {
      const newStrategy = createSpeakerSelector(method);
      this.strategies.set(method, newStrategy);
      return newStrategy;
    }
    return strategy;
  }
}
