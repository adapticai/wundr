/**
 * Intent classification for natural language commands
 */
export interface Intent {
  name: string;
  confidence: number;
  entities: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Intent classification patterns
 */
export interface IntentPattern {
  intent: string;
  patterns: RegExp[];
  entityExtractors: Record<string, (match: RegExpMatchArray) => any>;
  priority: number;
}

/**
 * Intent classifier for natural language processing
 */
export class IntentClassifier {
  private patterns: IntentPattern[];

  constructor() {
    this.patterns = this.initializePatterns();
  }

  /**
   * Classify user intent from natural language input
   */
  classifyIntent(input: string): Intent[] {
    const results: Intent[] = [];
    const normalizedInput = input.toLowerCase().trim();

    for (const pattern of this.patterns) {
      for (const regex of pattern.patterns) {
        const match = normalizedInput.match(regex);

        if (match) {
          const entities: Record<string, any> = {};

          // Extract entities using pattern extractors
          for (const [entityName, extractor] of Object.entries(
            pattern.entityExtractors
          )) {
            try {
              entities[entityName] = extractor(match);
            } catch (error) {
              // Skip failed entity extraction
            }
          }

          const confidence = this.calculateConfidence(
            match,
            pattern,
            normalizedInput
          );

          results.push({
            name: pattern.intent,
            confidence,
            entities,
            metadata: {
              matchedPattern: regex.source,
              priority: pattern.priority,
            },
          });
        }
      }
    }

    // Sort by confidence and priority
    return results.sort((a, b) => {
      const confidenceDiff = b.confidence - a.confidence;
      if (Math.abs(confidenceDiff) < 0.1) {
        return (
          (b.metadata?.['priority'] || 0) - (a.metadata?.['priority'] || 0)
        );
      }
      return confidenceDiff;
    });
  }

  /**
   * Get the best intent classification
   */
  getBestIntent(input: string): Intent | null {
    const intents = this.classifyIntent(input);
    return intents.length > 0 && intents[0] ? intents[0] : null;
  }

  /**
   * Check if input matches a specific intent
   */
  matchesIntent(
    input: string,
    intentName: string,
    minConfidence = 0.7
  ): boolean {
    const intents = this.classifyIntent(input);
    const matchedIntent = intents.find(intent => intent.name === intentName);
    return matchedIntent ? matchedIntent.confidence >= minConfidence : false;
  }

  /**
   * Initialize intent patterns
   */
  private initializePatterns(): IntentPattern[] {
    return [
      // Analysis intents
      {
        intent: 'analyze_project',
        patterns: [
          /analyze\s+(?:the\s+)?project/i,
          /scan\s+(?:the\s+)?project/i,
          /check\s+(?:the\s+)?project/i,
          /examine\s+(?:the\s+)?project/i,
        ],
        entityExtractors: {},
        priority: 10,
      },
      {
        intent: 'analyze_dependencies',
        patterns: [
          /analyze\s+dependencies/i,
          /check\s+dependencies/i,
          /dependency\s+analysis/i,
          /deps?\s+check/i,
          /find\s+dependency\s+issues/i,
        ],
        entityExtractors: {},
        priority: 10,
      },
      {
        intent: 'analyze_duplicates',
        patterns: [
          /find\s+duplicates?/i,
          /duplicate\s+(?:code|analysis)/i,
          /check\s+for\s+duplicates?/i,
          /detect\s+duplicates?/i,
        ],
        entityExtractors: {},
        priority: 10,
      },
      {
        intent: 'analyze_quality',
        patterns: [
          /code\s+quality/i,
          /quality\s+check/i,
          /analyze\s+quality/i,
          /check\s+code\s+quality/i,
        ],
        entityExtractors: {},
        priority: 10,
      },
      {
        intent: 'analyze_path',
        patterns: [
          /analyze\s+(.+?)(?:\s|$)/i,
          /scan\s+(.+?)(?:\s|$)/i,
          /check\s+(.+?)(?:\s|$)/i,
        ],
        entityExtractors: {
          path: match => match[1]?.trim(),
        },
        priority: 8,
      },

      // Creation intents
      {
        intent: 'create_service',
        patterns: [
          /create\s+(?:a\s+)?service/i,
          /new\s+service/i,
          /generate\s+service/i,
          /make\s+(?:a\s+)?service/i,
        ],
        entityExtractors: {
          name: match => this.extractServiceName(match.input || ''),
        },
        priority: 10,
      },
      {
        intent: 'create_component',
        patterns: [
          /create\s+(?:a\s+)?component/i,
          /new\s+component/i,
          /generate\s+component/i,
          /make\s+(?:a\s+)?component/i,
        ],
        entityExtractors: {
          name: match => this.extractComponentName(match.input || ''),
        },
        priority: 10,
      },
      {
        intent: 'create_template',
        patterns: [
          /create\s+(?:a\s+)?template/i,
          /new\s+template/i,
          /generate\s+template/i,
          /make\s+(?:a\s+)?template/i,
        ],
        entityExtractors: {
          type: match => this.extractTemplateType(match.input || ''),
        },
        priority: 10,
      },

      // Initialization intents
      {
        intent: 'init_project',
        patterns: [
          /init(?:ialize)?\s+(?:a\s+)?project/i,
          /setup\s+(?:a\s+)?project/i,
          /start\s+(?:a\s+)?new\s+project/i,
          /create\s+(?:a\s+)?new\s+project/i,
        ],
        entityExtractors: {
          name: match => this.extractProjectName(match.input || ''),
          type: match => this.extractProjectType(match.input || ''),
        },
        priority: 10,
      },
      {
        intent: 'init_config',
        patterns: [
          /init(?:ialize)?\s+config/i,
          /setup\s+config/i,
          /create\s+config/i,
          /configure\s+wundr/i,
        ],
        entityExtractors: {},
        priority: 10,
      },

      // Dashboard intents
      {
        intent: 'start_dashboard',
        patterns: [
          /start\s+dashboard/i,
          /open\s+dashboard/i,
          /show\s+dashboard/i,
          /launch\s+dashboard/i,
          /run\s+dashboard/i,
        ],
        entityExtractors: {
          port: match => this.extractPort(match.input || ''),
          open: match => /open/.test(match.input || ''),
        },
        priority: 10,
      },

      // Governance intents
      {
        intent: 'apply_governance',
        patterns: [
          /apply\s+governance/i,
          /governance\s+check/i,
          /compliance\s+check/i,
          /enforce\s+rules/i,
        ],
        entityExtractors: {},
        priority: 10,
      },

      // Watch intents
      {
        intent: 'watch_files',
        patterns: [
          /watch\s+files?/i,
          /monitor\s+files?/i,
          /auto\s+run/i,
          /continuous\s+(?:build|test|check)/i,
        ],
        entityExtractors: {
          pattern: match => this.extractWatchPattern(match.input || ''),
          command: match => this.extractWatchCommand(match.input || ''),
        },
        priority: 10,
      },

      // Batch intents
      {
        intent: 'run_batch',
        patterns: [
          /run\s+batch/i,
          /execute\s+batch/i,
          /batch\s+(?:operation|job|process)/i,
          /run\s+multiple\s+commands/i,
        ],
        entityExtractors: {
          file: match => this.extractBatchFile(match.input || ''),
        },
        priority: 10,
      },

      // Plugin intents
      {
        intent: 'manage_plugins',
        patterns: [
          /manage\s+plugins?/i,
          /plugin\s+(?:list|install|remove)/i,
          /add\s+plugin/i,
          /install\s+plugin/i,
        ],
        entityExtractors: {
          action: match => this.extractPluginAction(match.input || ''),
          name: match => this.extractPluginName(match.input || ''),
        },
        priority: 10,
      },

      // Help intents
      {
        intent: 'get_help',
        patterns: [
          /help/i,
          /how\s+(?:do\s+i|to)/i,
          /what\s+(?:is|does)/i,
          /show\s+(?:commands|options)/i,
          /usage/i,
        ],
        entityExtractors: {
          topic: match => this.extractHelpTopic(match.input || ''),
        },
        priority: 8,
      },

      // Generic action intents
      {
        intent: 'generic_action',
        patterns: [
          /^(analyze|create|init|start|run|execute|show|open|install|remove|add|delete|update)/i,
        ],
        entityExtractors: {
          action: match => match[1]?.toLowerCase(),
          target: match => this.extractActionTarget(match.input || ''),
        },
        priority: 5,
      },
    ];
  }

  /**
   * Calculate confidence score for a match
   */
  private calculateConfidence(
    match: RegExpMatchArray,
    pattern: IntentPattern,
    normalizedInput: string
  ): number {
    let confidence = 0.7; // Base confidence

    // Boost confidence for exact matches
    if (match[0] === normalizedInput) {
      confidence += 0.2;
    }

    // Boost confidence for longer matches
    const matchRatio = match[0].length / normalizedInput.length;
    confidence += Math.min(0.2, matchRatio * 0.3);

    // Boost confidence for high-priority patterns
    if (pattern.priority >= 10) {
      confidence += 0.1;
    }

    // Cap confidence at 1.0
    return Math.min(1.0, confidence);
  }

  // Entity extraction helper methods
  private extractServiceName(input: string): string | undefined {
    const match = input.match(
      /(?:service\s+)?(?:called\s+|named\s+)?([A-Z][a-zA-Z]*)/
    );
    return match?.[1];
  }

  private extractComponentName(input: string): string | undefined {
    const match = input.match(
      /(?:component\s+)?(?:called\s+|named\s+)?([A-Z][a-zA-Z]*)/
    );
    return match?.[1];
  }

  private extractTemplateType(input: string): string | undefined {
    const match = input.match(/template\s+for\s+([a-zA-Z]+)/);
    return match?.[1];
  }

  private extractProjectName(input: string): string | undefined {
    const match = input.match(/project\s+(?:called\s+|named\s+)?([a-zA-Z-_]+)/);
    return match?.[1];
  }

  private extractProjectType(input: string): string | undefined {
    const types = ['node', 'react', 'typescript', 'express', 'next', 'vue'];
    for (const type of types) {
      if (input.includes(type)) {
        return type;
      }
    }
    return undefined;
  }

  private extractPort(input: string): number | undefined {
    const match = input.match(/port\s+(\d+)/);
    return match && match[1] ? parseInt(match[1], 10) : undefined;
  }

  private extractWatchPattern(input: string): string | undefined {
    const match = input.match(/watch\s+"([^"]+)"/);
    return match?.[1];
  }

  private extractWatchCommand(input: string): string | undefined {
    const match = input.match(/run\s+"([^"]+)"/);
    return match?.[1];
  }

  private extractBatchFile(input: string): string | undefined {
    const match = input.match(
      /batch\s+(?:file\s+)?([^\s]+\.(?:json|yaml|yml))/
    );
    return match?.[1];
  }

  private extractPluginAction(input: string): string | undefined {
    const actions = ['install', 'remove', 'list', 'enable', 'disable'];
    for (const action of actions) {
      if (input.includes(action)) {
        return action;
      }
    }
    return undefined;
  }

  private extractPluginName(input: string): string | undefined {
    const match = input.match(/plugin\s+([a-zA-Z-_@\/]+)/);
    return match?.[1];
  }

  private extractHelpTopic(input: string): string | undefined {
    const match = input.match(/help\s+(?:with\s+)?([a-zA-Z]+)/);
    return match?.[1];
  }

  private extractActionTarget(input: string): string | undefined {
    const words = input.split(/\s+/);
    // Return words after the action verb
    return words.slice(1).join(' ') || undefined;
  }
}
