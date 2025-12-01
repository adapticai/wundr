/**
 * @neolith/core - Charter Constraint Enforcer
 *
 * Validates orchestrator actions against charter constraints.
 * Enforces governance rules for commands, file paths, actions, and approvals.
 *
 * Phase 3.3.1: Charter Constraint Enforcement
 *
 * @packageDocumentation
 */

import type { GovernanceCharter, CharterConstraints } from '../types/charter';

// =============================================================================
// Types
// =============================================================================

/**
 * Represents a request for an orchestrator to perform an action.
 */
export interface ActionRequest {
  /** Type of action being requested */
  type: 'execute_command' | 'file_access' | 'api_call' | 'tool_call' | string;

  /** Command to execute (for execute_command type) */
  command?: string;

  /** File path being accessed (for file_access type) */
  path?: string;

  /** Action identifier (for custom action types) */
  action?: string;

  /** Additional metadata about the request */
  metadata?: Record<string, unknown>;
}

/**
 * Result of validating an action against charter constraints.
 */
export interface ValidationResult {
  /** Whether the action is allowed, denied, or requires approval */
  allowed: boolean | 'pending_approval';

  /** Reason for denial or approval requirement */
  reason?: string;

  /** The specific constraint that was violated or triggered */
  constraint?: string;
}

// =============================================================================
// Charter Constraint Enforcer
// =============================================================================

/**
 * Enforces charter constraints on orchestrator actions.
 *
 * This class validates actions against:
 * - Forbidden commands
 * - Forbidden file paths
 * - Forbidden actions
 * - Actions requiring approval
 *
 * @example
 * ```typescript
 * const enforcer = new CharterConstraintEnforcer(charter);
 *
 * const result = enforcer.validateAction({
 *   type: 'execute_command',
 *   command: 'npm install',
 * });
 *
 * if (result.allowed === true) {
 *   // Execute the action
 * } else if (result.allowed === 'pending_approval') {
 *   // Request approval
 * } else {
 *   // Deny the action
 * }
 * ```
 */
export class CharterConstraintEnforcer {
  private readonly charter: GovernanceCharter;
  private readonly constraints: CharterConstraints;

  /**
   * Creates a new CharterConstraintEnforcer.
   *
   * @param charter - The governance charter to enforce
   */
  constructor(charter: GovernanceCharter) {
    this.charter = charter;
    this.constraints = charter.constraints;
  }

  /**
   * Validates an action request against charter constraints.
   *
   * @param action - The action request to validate
   * @returns Validation result indicating whether action is allowed
   *
   * @example
   * ```typescript
   * const result = enforcer.validateAction({
   *   type: 'execute_command',
   *   command: 'rm -rf /',
   * });
   * // result.allowed === false
   * // result.reason === 'Command contains forbidden pattern: rm -rf /'
   * ```
   */
  validateAction(action: ActionRequest): ValidationResult {
    // Check based on action type
    switch (action.type) {
      case 'execute_command':
        if (action.command) {
          return this.validateCommand(action.command);
        }
        break;

      case 'file_access':
        if (action.path) {
          return this.validatePath(action.path);
        }
        break;

      case 'api_call':
      case 'tool_call':
        if (action.action) {
          return this.validateCustomAction(action.action);
        }
        break;

      default:
        if (action.action) {
          return this.validateCustomAction(action.action);
        }
    }

    // If no specific validation matched, allow by default
    return { allowed: true };
  }

  /**
   * Validates a command against forbidden command patterns.
   *
   * @param command - The command string to validate
   * @returns Validation result
   *
   * @example
   * ```typescript
   * const result = enforcer.validateCommand('npm install');
   * // result.allowed === true
   *
   * const result2 = enforcer.validateCommand('sudo rm -rf /');
   * // result2.allowed === false
   * ```
   */
  validateCommand(command: string): ValidationResult {
    const normalizedCommand = command.toLowerCase().trim();

    // Check forbidden commands
    for (const forbidden of this.constraints.forbiddenCommands) {
      const normalizedForbidden = forbidden.toLowerCase();

      // Check if command starts with forbidden pattern or contains it
      if (
        normalizedCommand === normalizedForbidden ||
        normalizedCommand.startsWith(`${normalizedForbidden} `) ||
        normalizedCommand.includes(` ${normalizedForbidden} `) ||
        normalizedCommand.includes(`|${normalizedForbidden}`) ||
        normalizedCommand.includes(`&&${normalizedForbidden}`) ||
        normalizedCommand.includes(`;${normalizedForbidden}`)
      ) {
        return {
          allowed: false,
          reason: `Command contains forbidden pattern: ${forbidden}`,
          constraint: `forbiddenCommands: ${forbidden}`,
        };
      }
    }

    // Check if approval is required
    for (const requiresApproval of this.constraints.requireApprovalFor) {
      if (normalizedCommand.includes(requiresApproval.toLowerCase())) {
        return {
          allowed: 'pending_approval',
          reason: `Command requires approval: ${requiresApproval}`,
          constraint: `requireApprovalFor: ${requiresApproval}`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Validates a file path against forbidden path patterns.
   *
   * @param path - The file path to validate
   * @returns Validation result
   *
   * @example
   * ```typescript
   * const result = enforcer.validatePath('/home/user/file.txt');
   * // result.allowed === true
   *
   * const result2 = enforcer.validatePath('/etc/passwd');
   * // result2.allowed === false
   * ```
   */
  validatePath(path: string): ValidationResult {
    const normalizedPath = this.normalizePath(path);

    // Check forbidden paths
    for (const forbidden of this.constraints.forbiddenPaths) {
      const normalizedForbidden = this.normalizePath(forbidden);

      // Check exact match or if path is within forbidden directory
      if (
        normalizedPath === normalizedForbidden ||
        normalizedPath.startsWith(`${normalizedForbidden}/`) ||
        (normalizedForbidden.includes('*') &&
          this.matchesGlob(normalizedPath, normalizedForbidden))
      ) {
        return {
          allowed: false,
          reason: `Access to path is forbidden: ${forbidden}`,
          constraint: `forbiddenPaths: ${forbidden}`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Validates a custom action against forbidden action patterns.
   *
   * @param action - The action identifier to validate
   * @returns Validation result
   *
   * @example
   * ```typescript
   * const result = enforcer.validateCustomAction('read_data');
   * // result.allowed === true
   *
   * const result2 = enforcer.validateCustomAction('delete_production_data');
   * // result2.allowed === false
   * ```
   */
  private validateCustomAction(action: string): ValidationResult {
    const normalizedAction = action.toLowerCase().trim();

    // Check forbidden actions
    for (const forbidden of this.constraints.forbiddenActions) {
      const normalizedForbidden = forbidden.toLowerCase();

      if (
        normalizedAction === normalizedForbidden ||
        normalizedAction.includes(normalizedForbidden)
      ) {
        return {
          allowed: false,
          reason: `Action is forbidden: ${forbidden}`,
          constraint: `forbiddenActions: ${forbidden}`,
        };
      }
    }

    // Check if approval is required
    for (const requiresApproval of this.constraints.requireApprovalFor) {
      const normalizedRequirement = requiresApproval.toLowerCase();

      if (
        normalizedAction === normalizedRequirement ||
        normalizedAction.includes(normalizedRequirement)
      ) {
        return {
          allowed: 'pending_approval',
          reason: `Action requires approval: ${requiresApproval}`,
          constraint: `requireApprovalFor: ${requiresApproval}`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Checks if an action type requires approval.
   *
   * @param actionType - The type of action
   * @returns True if approval is required
   *
   * @example
   * ```typescript
   * if (enforcer.isApprovalRequired('deploy_production')) {
   *   // Request approval before proceeding
   * }
   * ```
   */
  isApprovalRequired(actionType: string): boolean {
    const normalizedType = actionType.toLowerCase().trim();

    return this.constraints.requireApprovalFor.some(requirement =>
      normalizedType.includes(requirement.toLowerCase())
    );
  }

  /**
   * Returns all constraints that were violated by an action.
   *
   * @param action - The action request to check
   * @returns Array of violated constraint descriptions
   *
   * @example
   * ```typescript
   * const violations = enforcer.getViolatedConstraints({
   *   type: 'execute_command',
   *   command: 'rm -rf /',
   * });
   * // violations === ['forbiddenCommands: rm -rf /']
   * ```
   */
  getViolatedConstraints(action: ActionRequest): string[] {
    const violations: string[] = [];
    const result = this.validateAction(action);

    if (result.allowed === false && result.constraint) {
      violations.push(result.constraint);
    }

    return violations;
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /**
   * Normalizes a file path for comparison.
   *
   * @param path - The path to normalize
   * @returns Normalized path
   */
  private normalizePath(path: string): string {
    // Expand home directory
    let normalized = path.replace(/^~/, process.env.HOME || '~');

    // Remove trailing slashes
    normalized = normalized.replace(/\/+$/, '');

    // Resolve relative paths (basic implementation)
    normalized = normalized.replace(/\/\.\//g, '/');

    return normalized;
  }

  /**
   * Checks if a path matches a glob pattern.
   *
   * @param path - The path to check
   * @param pattern - The glob pattern
   * @returns True if path matches pattern
   */
  private matchesGlob(path: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  /**
   * Gets the charter being enforced.
   *
   * @returns The governance charter
   */
  getCharter(): GovernanceCharter {
    return this.charter;
  }

  /**
   * Gets the constraints being enforced.
   *
   * @returns The charter constraints
   */
  getConstraints(): CharterConstraints {
    return this.constraints;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new charter constraint enforcer.
 *
 * @param charter - The governance charter to enforce
 * @returns A new CharterConstraintEnforcer instance
 *
 * @example
 * ```typescript
 * const enforcer = createCharterConstraintEnforcer(charter);
 * const result = enforcer.validateAction(action);
 * ```
 */
export function createCharterConstraintEnforcer(
  charter: GovernanceCharter
): CharterConstraintEnforcer {
  return new CharterConstraintEnforcer(charter);
}
