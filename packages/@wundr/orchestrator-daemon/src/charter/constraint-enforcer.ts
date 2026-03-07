/**
 * Charter Constraint Enforcer
 *
 * Validates commands, file paths, and actions against the hard constraints
 * defined in an agent charter. Integrates with the BudgetTracker to check
 * resource limits at enforcement time.
 *
 * Constraint checks are evaluated in order:
 *   1. Forbidden commands (substring + normalized match)
 *   2. Forbidden paths (prefix match after normalization)
 *   3. Forbidden actions (exact match)
 *   4. Approval-required actions
 *   5. Resource budget limits (delegated to BudgetTracker)
 *
 * All public methods return a ConstraintResult so callers can decide
 * whether to block, prompt, or pass through the operation.
 *
 * @module @wundr/orchestrator-daemon/charter/constraint-enforcer
 */

import * as nodePath from 'node:path';
import * as nodeOs from 'node:os';

import type { Charter } from './loader';
import type { BudgetTracker } from './budget-tracker';
import { Logger } from '../utils/logger';

// ============================================================================
// Result type
// ============================================================================

/**
 * The result returned from every enforcement check.
 *
 * - `allowed: true` with `requiresApproval: undefined` means the operation
 *   may proceed immediately.
 * - `allowed: true` with `requiresApproval: true` means the operation is
 *   permitted but must be approved before execution.
 * - `allowed: false` means the operation is blocked by a hard constraint.
 */
export interface ConstraintResult {
  /** Whether the operation is permitted (possibly pending approval). */
  allowed: boolean;
  /** Human-readable explanation when the operation is blocked or gated. */
  reason?: string;
  /** True when an approval gate is required before the operation executes. */
  requiresApproval?: boolean;
}

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Expand `~` to the current user's home directory, if present.
 */
function expandHome(value: string): string {
  if (value === '~') {
    return nodeOs.homedir();
  }
  if (value.startsWith('~/')) {
    return nodePath.join(nodeOs.homedir(), value.slice(2));
  }
  return value;
}

/**
 * Normalize a shell command string for comparison: lowercase and collapse
 * internal whitespace so `rm  -rf  /` still matches `rm -rf /`.
 */
function normalizeCommand(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Normalize a file path: expand home directory, resolve against cwd, and
 * convert to lower case on case-insensitive platforms.
 */
function normalizePath(raw: string): string {
  const expanded = expandHome(raw.trim());
  const resolved = nodePath.isAbsolute(expanded)
    ? expanded
    : nodePath.resolve(process.cwd(), expanded);

  // On macOS/Windows file systems are case-insensitive; normalise to lower so
  // pattern comparison is consistent.
  return process.platform === 'win32' || process.platform === 'darwin'
    ? resolved.toLowerCase()
    : resolved;
}

/**
 * Return true if `subject` starts with `prefix` or equals `prefix`.
 * Prefix matching is used for path comparisons: a charter that forbids `/etc`
 * should also block `/etc/hosts`.
 */
function startsWithOrEquals(subject: string, prefix: string): boolean {
  if (subject === prefix) {
    return true;
  }
  const sep = nodePath.sep;
  return subject.startsWith(prefix + sep) || subject.startsWith(prefix + '/');
}

// ============================================================================
// ConstraintEnforcer
// ============================================================================

/**
 * Evaluates incoming operations against the hard constraints defined in a
 * charter and optionally checks the resource budget via a `BudgetTracker`.
 *
 * Instantiate once per orchestrator/session lifecycle and reuse across
 * enforcement calls. The `budgetTracker` parameter is optional; when omitted
 * `checkResourceBudget` always returns allowed.
 *
 * @example
 * ```ts
 * const enforcer = new ConstraintEnforcer(budgetTracker);
 *
 * // Before executing a shell command:
 * const result = enforcer.validateCommand('rm -rf /', charter);
 * if (!result.allowed) {
 *   throw new ConstraintViolationError(result.reason ?? 'Command blocked');
 * }
 * ```
 */
export class ConstraintEnforcer {
  private readonly logger: Logger;
  private readonly budgetTracker: BudgetTracker | undefined;

  constructor(budgetTracker?: BudgetTracker) {
    this.logger = new Logger('ConstraintEnforcer');
    this.budgetTracker = budgetTracker;
  }

  // --------------------------------------------------------------------------
  // validateCommand
  // --------------------------------------------------------------------------

  /**
   * Check whether a shell command is permitted by the charter.
   *
   * Evaluation order:
   *   1. Compare the normalized command against each `forbiddenCommands` entry
   *      using substring matching (the forbidden entry can be a prefix or
   *      a full-command pattern).
   *   2. Check `requireApprovalFor` entries. Commands that match a
   *      requireApprovalFor pattern are permitted but gated.
   *
   * @param command - Raw shell command string as it would be executed.
   * @param charter - The charter whose constraints are authoritative.
   */
  validateCommand(command: string, charter: Charter): ConstraintResult {
    const normalized = normalizeCommand(command);

    // Step 1: Forbidden commands take precedence.
    for (const forbidden of charter.safetyHeuristics.alwaysReject) {
      const normalizedForbidden = normalizeCommand(forbidden);
      if (
        normalized === normalizedForbidden ||
        normalized.includes(normalizedForbidden)
      ) {
        this.logger.warn(
          `Command blocked by charter constraint: "${forbidden}" matched in "${command}"`
        );
        return {
          allowed: false,
          reason: `Command is forbidden by charter: "${forbidden}"`,
        };
      }
    }

    // Also check the legacy `hardConstraints` array on the daemon types that
    // stores plain strings (e.g. "rm -rf /"). The Charter from loader.ts uses
    // safetyHeuristics, so we branch defensively.
    const constraintCharter = charter as unknown as {
      hardConstraints?: string[];
    };
    if (Array.isArray(constraintCharter.hardConstraints)) {
      for (const rule of constraintCharter.hardConstraints) {
        const normalizedRule = normalizeCommand(rule);
        if (
          normalized === normalizedRule ||
          normalized.includes(normalizedRule)
        ) {
          this.logger.warn(
            `Command blocked by hardConstraints rule: "${rule}"`
          );
          return {
            allowed: false,
            reason: `Command is forbidden by charter constraint: "${rule}"`,
          };
        }
      }
    }

    // Step 2: Approval-required patterns.
    for (const approvalPattern of charter.safetyHeuristics
      .requireConfirmation) {
      const normalizedPattern = normalizeCommand(approvalPattern);
      if (
        normalized === normalizedPattern ||
        normalized.includes(normalizedPattern)
      ) {
        this.logger.info(
          `Command requires approval per charter: "${approvalPattern}"`
        );
        return {
          allowed: true,
          requiresApproval: true,
          reason: `Command requires approval by charter: "${approvalPattern}"`,
        };
      }
    }

    return { allowed: true };
  }

  // --------------------------------------------------------------------------
  // validatePath
  // --------------------------------------------------------------------------

  /**
   * Check whether accessing a file system path is permitted by the charter.
   *
   * The charter's `safetyHeuristics.alwaysReject` list may contain file path
   * patterns such as `.env`, `/root`, or `~/.ssh`. A path is forbidden when
   * the normalized request path starts with (or equals) a normalized forbidden
   * entry.
   *
   * @param filePath - The path being accessed (may be relative or absolute).
   * @param charter  - The charter whose constraints are authoritative.
   */
  validatePath(filePath: string, charter: Charter): ConstraintResult {
    const normalizedRequest = normalizePath(filePath);

    // Check safetyHeuristics.alwaysReject for path-like entries.
    for (const forbidden of charter.safetyHeuristics.alwaysReject) {
      // Heuristic: if the forbidden entry contains a path separator, treat
      // it as a path pattern; otherwise treat it as a command pattern and skip.
      const isForbiddenPath =
        forbidden.includes('/') ||
        forbidden.includes('\\') ||
        forbidden.startsWith('.') ||
        forbidden.startsWith('~');

      if (!isForbiddenPath) {
        continue;
      }

      const normalizedForbidden = normalizePath(forbidden);

      if (startsWithOrEquals(normalizedRequest, normalizedForbidden)) {
        this.logger.warn(
          `Path access blocked by charter: "${forbidden}" matched "${filePath}"`
        );
        return {
          allowed: false,
          reason: `Path access is forbidden by charter: "${forbidden}"`,
        };
      }
    }

    // Check hardConstraints (daemon types flavour).
    const constraintCharter = charter as unknown as {
      hardConstraints?: string[];
    };
    if (Array.isArray(constraintCharter.hardConstraints)) {
      for (const rule of constraintCharter.hardConstraints) {
        const isForbiddenPath =
          rule.includes('/') ||
          rule.includes('\\') ||
          rule.startsWith('.') ||
          rule.startsWith('~');

        if (!isForbiddenPath) {
          continue;
        }

        const normalizedRule = normalizePath(rule);
        if (startsWithOrEquals(normalizedRequest, normalizedRule)) {
          this.logger.warn(
            `Path access blocked by hardConstraints: "${rule}" matched "${filePath}"`
          );
          return {
            allowed: false,
            reason: `Path access is forbidden by charter constraint: "${rule}"`,
          };
        }
      }
    }

    return { allowed: true };
  }

  // --------------------------------------------------------------------------
  // validateAction
  // --------------------------------------------------------------------------

  /**
   * Check whether a high-level action is permitted by the charter.
   *
   * Actions are matched against `safetyHeuristics.alwaysReject` (exact or
   * substring) and `safetyHeuristics.requireConfirmation` (approval gate).
   * Actions in `safetyHeuristics.escalate` are also gated as approval-required
   * since they need human review.
   *
   * @param action  - A high-level action identifier such as
   *                  `"deploy_to_production"` or `"delete_user_data"`.
   * @param charter - The charter whose constraints are authoritative.
   */
  validateAction(action: string, charter: Charter): ConstraintResult {
    const normalizedAction = action.trim().toLowerCase();

    // Step 1: Always-reject list.
    for (const forbidden of charter.safetyHeuristics.alwaysReject) {
      // For action checking, only use entries that look like action names
      // (no path separators).
      const isForbiddenPath =
        forbidden.includes('/') ||
        forbidden.includes('\\') ||
        forbidden.startsWith('~');

      if (isForbiddenPath) {
        continue;
      }

      const normalizedForbidden = forbidden.trim().toLowerCase();
      if (
        normalizedAction === normalizedForbidden ||
        normalizedAction.includes(normalizedForbidden) ||
        normalizedForbidden.includes(normalizedAction)
      ) {
        this.logger.warn(
          `Action blocked by charter: "${forbidden}" matched "${action}"`
        );
        return {
          allowed: false,
          reason: `Action is forbidden by charter: "${forbidden}"`,
        };
      }
    }

    // Step 2: Require-confirmation list.
    for (const approvalPattern of charter.safetyHeuristics
      .requireConfirmation) {
      const normalizedPattern = approvalPattern.trim().toLowerCase();
      if (
        normalizedAction === normalizedPattern ||
        normalizedAction.includes(normalizedPattern) ||
        normalizedPattern.includes(normalizedAction)
      ) {
        this.logger.info(
          `Action requires approval per charter: "${approvalPattern}"`
        );
        return {
          allowed: true,
          requiresApproval: true,
          reason: `Action requires approval by charter: "${approvalPattern}"`,
        };
      }
    }

    // Step 3: Escalation list — treat as approval-required.
    for (const escalatePattern of charter.safetyHeuristics.escalate) {
      const normalizedPattern = escalatePattern.trim().toLowerCase();
      if (
        normalizedAction === normalizedPattern ||
        normalizedAction.includes(normalizedPattern) ||
        normalizedPattern.includes(normalizedAction)
      ) {
        this.logger.info(
          `Action requires escalation per charter: "${escalatePattern}"`
        );
        return {
          allowed: true,
          requiresApproval: true,
          reason: `Action requires escalation/approval by charter: "${escalatePattern}"`,
        };
      }
    }

    return { allowed: true };
  }

  // --------------------------------------------------------------------------
  // checkResourceBudget
  // --------------------------------------------------------------------------

  /**
   * Verify that the orchestrator is within the resource limits defined in
   * the charter.
   *
   * Delegates token-budget and session-count checks to the `BudgetTracker`
   * (if one was supplied at construction time). Memory and CPU checks are
   * based on `process.memoryUsage()` and are intentionally lightweight.
   *
   * When no `BudgetTracker` was provided this method always returns allowed.
   *
   * @param orchestratorId - Identifier for the orchestrator being checked.
   * @param charter        - The charter whose resource limits are authoritative.
   */
  checkResourceBudget(
    orchestratorId: string,
    charter: Charter
  ): ConstraintResult {
    if (!this.budgetTracker) {
      return { allowed: true };
    }

    const limits = charter.resourceLimits;

    // Token budget check.
    const withinBudget = this.budgetTracker.isWithinBudget(
      orchestratorId,
      charter
    );
    if (!withinBudget) {
      const hourlyUsage = this.budgetTracker.getHourlyUsage(orchestratorId);
      this.logger.warn(
        `Orchestrator "${orchestratorId}" has exceeded token budget. ` +
          `Hourly usage: ${hourlyUsage} / ${limits.tokenBudget.hourly}`
      );
      return {
        allowed: false,
        reason:
          `Token budget exceeded: ${hourlyUsage} tokens used this hour ` +
          `(limit: ${limits.tokenBudget.hourly})`,
      };
    }

    // Concurrent-sessions check.
    const report = this.budgetTracker.getUsageReport(orchestratorId);
    if (report.activeSessions > limits.maxConcurrentTasks) {
      this.logger.warn(
        `Orchestrator "${orchestratorId}" has too many active sessions: ` +
          `${report.activeSessions} / ${limits.maxConcurrentTasks}`
      );
      return {
        allowed: false,
        reason:
          `Concurrent session limit exceeded: ${report.activeSessions} active sessions ` +
          `(limit: ${limits.maxConcurrentTasks})`,
      };
    }

    // Memory check (lightweight — based on process heap usage).
    const memUsageMB = process.memoryUsage().heapUsed / (1024 * 1024);
    const maxMemMB = limits.maxSessions * 50; // rough heuristic: 50MB per session slot

    if (memUsageMB > maxMemMB) {
      this.logger.warn(
        `Orchestrator "${orchestratorId}" memory usage high: ` +
          `${memUsageMB.toFixed(1)} MB / ${maxMemMB} MB`
      );
      return {
        allowed: false,
        reason:
          `Memory limit exceeded: ${memUsageMB.toFixed(1)} MB used ` +
          `(estimated limit: ${maxMemMB} MB)`,
      };
    }

    return { allowed: true };
  }
}

// ============================================================================
// Error type
// ============================================================================

/**
 * Error thrown when a constraint violation blocks an operation.
 *
 * Catch this in the session executor to surface a meaningful error to the
 * caller without exposing internal policy details to untrusted output.
 */
export class ConstraintViolationError extends Error {
  public readonly orchestratorId: string | undefined;
  public readonly constraint: string | undefined;

  constructor(
    message: string,
    opts?: { orchestratorId?: string; constraint?: string }
  ) {
    super(message);
    this.name = 'ConstraintViolationError';
    this.orchestratorId = opts?.orchestratorId;
    this.constraint = opts?.constraint;
  }
}
