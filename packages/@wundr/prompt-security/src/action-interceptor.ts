import type {
  Action,
  ActionDecision,
  ActionParameters,
  ActionRule,
  ActionType,
  AuditDetails,
  AuditEntry,
  SecureActionResult,
  SecurityConfig,
  TrustLevel,
} from './types';

/**
 * Default action rules applied when no custom rules are provided
 */
const DEFAULT_ACTION_RULES: ActionRule[] = [
  {
    id: 'deny-untrusted-system-commands',
    name: 'Deny untrusted system commands',
    actionTypes: ['system_command'],
    decision: 'deny',
    priority: 100,
    enabled: true,
    reason: 'System commands from untrusted sources are not allowed',
  },
  {
    id: 'deny-untrusted-code-execution',
    name: 'Deny untrusted code execution',
    actionTypes: ['code_execution'],
    decision: 'deny',
    priority: 100,
    enabled: true,
    reason: 'Code execution from untrusted sources is not allowed',
  },
  {
    id: 'sandbox-untrusted-file-operations',
    name: 'Sandbox untrusted file operations',
    actionTypes: ['file_write', 'file_delete'],
    decision: 'sandbox',
    priority: 90,
    enabled: true,
    reason: 'File modifications from untrusted sources require sandboxing',
  },
  {
    id: 'confirm-network-requests',
    name: 'Require confirmation for network requests',
    actionTypes: ['network_request'],
    decision: 'require_confirmation',
    priority: 80,
    enabled: true,
    reason: 'Network requests require user confirmation',
  },
  {
    id: 'allow-trusted-read',
    name: 'Allow trusted file reads',
    actionTypes: ['file_read'],
    decision: 'allow',
    priority: 50,
    enabled: true,
    reason: 'File reads from trusted sources are allowed',
  },
];

/**
 * Listener function type for action events
 */
type ActionEventListener = (action: Action, result: SecureActionResult) => void;

/**
 * ActionInterceptor class isolates action decisions from execution.
 *
 * This pattern separates the decision-making process from the actual
 * execution of actions, providing a defense layer against prompt
 * injection attacks that attempt to execute unauthorized actions.
 *
 * @example
 * ```typescript
 * const interceptor = new ActionInterceptor(config);
 *
 * const action: Action = {
 *   id: 'action-1',
 *   type: 'file_write',
 *   target: '/tmp/output.txt',
 *   parameters: { content: 'Hello World' },
 *   source: { origin: 'llm', trustLevel: 'untrusted' },
 *   timestamp: new Date()
 * };
 *
 * const result = await interceptor.intercept(action, async () => {
 *   await fs.writeFile('/tmp/output.txt', 'Hello World');
 *   return { success: true };
 * });
 *
 * if (result.allowed) {
 *   console.log('Action executed:', result.result);
 * } else {
 *   console.log('Action blocked:', result.reason);
 * }
 * ```
 */
export class ActionInterceptor {
  private readonly config: SecurityConfig;
  private readonly rules: ActionRule[];
  private readonly listeners: ActionEventListener[] = [];

  /**
   * Creates a new ActionInterceptor instance
   *
   * @param config - Security configuration
   */
  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = this.mergeWithDefaults(config);
    this.rules = this.getSortedRules();
  }

  /**
   * Intercepts an action and decides whether to allow execution
   *
   * @param action - The action to intercept
   * @param executor - Function that executes the action if allowed
   * @returns Promise resolving to the secure action result
   */
  async intercept<T>(
    action: Action,
    executor: () => Promise<T>
  ): Promise<SecureActionResult<T>> {
    const auditTrail: AuditEntry[] = [];
    const startTime = Date.now();

    this.addAuditEntry(
      auditTrail,
      'interception_started',
      'Action interception initiated',
      {
        actionId: action.id,
        actionType: action.type,
        target: action.target,
      }
    );

    // Validate the action
    const validationResult = this.validateAction(action);
    if (!validationResult.valid) {
      this.addAuditEntry(
        auditTrail,
        'validation_failed',
        validationResult.reason ?? 'Unknown validation error'
      );
      return this.createDeniedResult<T>(
        auditTrail,
        [],
        validationResult.reason
      );
    }

    // Evaluate rules
    const matchedRules: string[] = [];
    let decision: ActionDecision = 'allow';
    let reason: string | undefined;

    for (const rule of this.rules) {
      if (!rule.enabled) {
        continue;
      }

      const matches = this.ruleMatches(rule, action);
      if (matches) {
        matchedRules.push(rule.id);
        this.addAuditEntry(
          auditTrail,
          'rule_matched',
          `Rule "${rule.name}" matched`,
          {
            ruleId: rule.id,
            decision: rule.decision,
          }
        );

        // Apply the decision (first matching rule wins due to priority sorting)
        decision = rule.decision;
        reason = rule.reason;
        break;
      }
    }

    // Check trust level overrides
    decision = this.applyTrustLevelOverrides(action, decision, auditTrail);

    this.addAuditEntry(auditTrail, 'decision_made', `Decision: ${decision}`, {
      decision,
      reason,
      matchedRules,
    });

    // Execute based on decision
    let result: SecureActionResult<T>;

    switch (decision) {
      case 'allow':
        result = await this.executeAction(
          action,
          executor,
          auditTrail,
          matchedRules
        );
        break;
      case 'deny':
        result = this.createDeniedResult<T>(auditTrail, matchedRules, reason);
        break;
      case 'require_confirmation':
        result = this.createConfirmationRequiredResult<T>(
          auditTrail,
          matchedRules,
          reason
        );
        break;
      case 'sandbox':
        result = await this.executeSandboxed(
          action,
          executor,
          auditTrail,
          matchedRules
        );
        break;
      default:
        result = this.createDeniedResult<T>(
          auditTrail,
          matchedRules,
          'Unknown decision type'
        );
    }

    // Notify listeners
    this.notifyListeners(action, result as SecureActionResult);

    // Add final audit entry
    this.addAuditEntry(
      auditTrail,
      'interception_completed',
      'Action interception completed',
      {
        duration: Date.now() - startTime,
        allowed: result.allowed,
      }
    );

    return result;
  }

  /**
   * Evaluates an action without executing it
   *
   * @param action - The action to evaluate
   * @returns The decision that would be made for this action
   */
  evaluate(action: Action): {
    decision: ActionDecision;
    reason?: string;
    matchedRules: string[];
  } {
    const matchedRules: string[] = [];
    let decision: ActionDecision = 'allow';
    let reason: string | undefined;

    // Validate first
    const validationResult = this.validateAction(action);
    if (!validationResult.valid) {
      return {
        decision: 'deny',
        reason: validationResult.reason,
        matchedRules: [],
      };
    }

    // Evaluate rules
    for (const rule of this.rules) {
      if (!rule.enabled) {
        continue;
      }

      if (this.ruleMatches(rule, action)) {
        matchedRules.push(rule.id);
        decision = rule.decision;
        reason = rule.reason;
        break;
      }
    }

    // Apply trust level overrides
    decision = this.applyTrustLevelOverrides(action, decision, []);

    return { decision, reason, matchedRules };
  }

  /**
   * Adds a custom action rule
   *
   * @param rule - The rule to add
   */
  addRule(rule: ActionRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Removes a rule by ID
   *
   * @param ruleId - The ID of the rule to remove
   * @returns True if the rule was removed
   */
  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex(r => r.id === ruleId);
    if (index !== -1) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Gets all configured rules
   *
   * @returns Array of action rules
   */
  getRules(): ActionRule[] {
    return [...this.rules];
  }

  /**
   * Adds a listener for action events
   *
   * @param listener - The listener function
   */
  addListener(listener: ActionEventListener): void {
    this.listeners.push(listener);
  }

  /**
   * Removes a listener
   *
   * @param listener - The listener to remove
   */
  removeListener(listener: ActionEventListener): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Creates an action object with proper defaults
   *
   * @param type - Action type
   * @param target - Target resource
   * @param parameters - Action parameters (type-safe based on action type)
   * @param source - Action source
   * @returns A properly structured Action object
   */
  createAction<T extends ActionType>(
    type: T,
    target: string,
    parameters: ActionParameters,
    source: {
      origin: 'user' | 'llm' | 'system' | 'plugin';
      trustLevel: TrustLevel;
    }
  ): Action<T> {
    return {
      id: this.generateActionId(),
      type,
      target,
      parameters,
      source,
      timestamp: new Date(),
    } as Action<T>;
  }

  private mergeWithDefaults(config: Partial<SecurityConfig>): SecurityConfig {
    return {
      enabled: config.enabled ?? true,
      strictMode: config.strictMode ?? false,
      maxInputLength: config.maxInputLength ?? 100000,
      maxOutputLength: config.maxOutputLength ?? 100000,
      injectionPatterns: config.injectionPatterns ?? [],
      sensitivePatterns: config.sensitivePatterns ?? [],
      actionRules: config.actionRules ?? DEFAULT_ACTION_RULES,
      contextSettings: config.contextSettings ?? {
        enableSeparation: true,
        maxContextTokens: 8000,
        contextSeparator: '---CONTEXT_BOUNDARY---',
        trustedTags: ['system', 'verified', 'admin'],
        untrustedTags: ['user', 'external', 'unverified'],
      },
      auditConfig: config.auditConfig ?? {
        enabled: true,
        logSecurityEvents: true,
        logActionInterceptions: true,
        logSanitization: true,
        includeContent: false,
      },
    };
  }

  private getSortedRules(): ActionRule[] {
    const rules = [...this.config.actionRules];
    return rules.sort((a, b) => b.priority - a.priority);
  }

  private validateAction(action: Action): { valid: boolean; reason?: string } {
    if (!action.id) {
      return { valid: false, reason: 'Action ID is required' };
    }

    if (!action.type) {
      return { valid: false, reason: 'Action type is required' };
    }

    if (!action.target) {
      return { valid: false, reason: 'Action target is required' };
    }

    if (!action.source) {
      return { valid: false, reason: 'Action source is required' };
    }

    if (!action.source.origin) {
      return { valid: false, reason: 'Action source origin is required' };
    }

    if (!action.source.trustLevel) {
      return { valid: false, reason: 'Action source trust level is required' };
    }

    return { valid: true };
  }

  private ruleMatches(rule: ActionRule, action: Action): boolean {
    // Check if action type matches
    if (!rule.actionTypes.includes(action.type)) {
      return false;
    }

    // Evaluate condition if present
    if (rule.condition) {
      try {
        return this.evaluateCondition(rule.condition, action);
      } catch {
        // If condition evaluation fails, don't match
        return false;
      }
    }

    return true;
  }

  private evaluateCondition(condition: string, action: Action): boolean {
    // Safe condition evaluation using predefined patterns
    // This is intentionally limited to prevent injection
    const patterns: Record<string, (a: Action) => boolean> = {
      'source.trustLevel === "untrusted"': a =>
        a.source.trustLevel === 'untrusted',
      'source.trustLevel === "semi-trusted"': a =>
        a.source.trustLevel === 'semi-trusted',
      'source.trustLevel === "trusted"': a => a.source.trustLevel === 'trusted',
      'source.trustLevel === "system"': a => a.source.trustLevel === 'system',
      'source.origin === "llm"': a => a.source.origin === 'llm',
      'source.origin === "user"': a => a.source.origin === 'user',
      'source.origin === "system"': a => a.source.origin === 'system',
      'source.origin === "plugin"': a => a.source.origin === 'plugin',
    };

    const evaluator = patterns[condition];
    return evaluator ? evaluator(action) : false;
  }

  private applyTrustLevelOverrides(
    action: Action,
    currentDecision: ActionDecision,
    auditTrail: AuditEntry[]
  ): ActionDecision {
    const trustLevel = action.source.trustLevel;

    // In strict mode, untrusted sources are always denied for dangerous actions
    if (this.config.strictMode && trustLevel === 'untrusted') {
      const dangerousTypes: ActionType[] = [
        'system_command',
        'code_execution',
        'file_write',
        'file_delete',
        'database_query',
      ];

      if (dangerousTypes.includes(action.type)) {
        this.addAuditEntry(
          auditTrail,
          'trust_override',
          'Strict mode override: denying untrusted dangerous action'
        );
        return 'deny';
      }
    }

    // System-level trust always allows
    if (trustLevel === 'system') {
      return 'allow';
    }

    return currentDecision;
  }

  private async executeAction<T>(
    action: Action,
    executor: () => Promise<T>,
    auditTrail: AuditEntry[],
    matchedRules: string[]
  ): Promise<SecureActionResult<T>> {
    try {
      this.addAuditEntry(
        auditTrail,
        'execution_started',
        'Action execution started'
      );
      const result = await executor();
      this.addAuditEntry(
        auditTrail,
        'execution_completed',
        'Action execution completed successfully'
      );

      return {
        allowed: true,
        decision: 'allow',
        result,
        matchedRules,
        auditTrail,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.addAuditEntry(
        auditTrail,
        'execution_failed',
        `Action execution failed: ${errorMessage}`
      );

      return {
        allowed: true,
        decision: 'allow',
        error: error instanceof Error ? error : new Error(errorMessage),
        matchedRules,
        auditTrail,
      };
    }
  }

  private async executeSandboxed<T>(
    _action: Action,
    executor: () => Promise<T>,
    auditTrail: AuditEntry[],
    matchedRules: string[]
  ): Promise<SecureActionResult<T>> {
    // In a real implementation, this would execute in an isolated environment
    // For now, we execute with additional monitoring
    this.addAuditEntry(
      auditTrail,
      'sandbox_started',
      'Sandboxed execution started'
    );

    try {
      const result = await executor();
      this.addAuditEntry(
        auditTrail,
        'sandbox_completed',
        'Sandboxed execution completed'
      );

      return {
        allowed: true,
        decision: 'sandbox',
        result,
        matchedRules,
        auditTrail,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.addAuditEntry(
        auditTrail,
        'sandbox_failed',
        `Sandboxed execution failed: ${errorMessage}`
      );

      return {
        allowed: true,
        decision: 'sandbox',
        error: error instanceof Error ? error : new Error(errorMessage),
        matchedRules,
        auditTrail,
      };
    }
  }

  private createDeniedResult<T>(
    auditTrail: AuditEntry[],
    matchedRules: string[],
    reason?: string
  ): SecureActionResult<T> {
    return {
      allowed: false,
      decision: 'deny',
      reason: reason ?? 'Action denied by security policy',
      matchedRules,
      auditTrail,
    };
  }

  private createConfirmationRequiredResult<T>(
    auditTrail: AuditEntry[],
    matchedRules: string[],
    reason?: string
  ): SecureActionResult<T> {
    return {
      allowed: false,
      decision: 'require_confirmation',
      reason: reason ?? 'Action requires user confirmation',
      matchedRules,
      auditTrail,
    };
  }

  private addAuditEntry(
    auditTrail: AuditEntry[],
    event: string,
    description: string,
    details?: AuditDetails
  ): void {
    auditTrail.push({
      timestamp: new Date(),
      event,
      description,
      details,
    });
  }

  private notifyListeners(action: Action, result: SecureActionResult): void {
    for (const listener of this.listeners) {
      try {
        listener(action, result);
      } catch {
        // Ignore listener errors to prevent disruption
      }
    }
  }

  private generateActionId(): string {
    return `action-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
