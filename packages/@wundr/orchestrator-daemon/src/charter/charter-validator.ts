/**
 * Charter Validator
 *
 * Provides three public functions:
 *
 *   - `validateCharter(charter)` — validate that a charter is well-formed,
 *     returning a result with errors and warnings.
 *
 *   - `validateCharterUpdate(current, proposed)` — validate a proposed update
 *     against the current charter, enforcing immutability rules (e.g., you
 *     cannot change the tier) and flagging unsafe relaxations of constraints.
 *
 *   - `mergeCharters(parent, child)` — produce a merged charter where the
 *     child inherits the parent's constraints. The merged charter is always at
 *     least as restrictive as the parent.
 *
 * The `validateCharter` function is intentionally separate from the Zod schema
 * validation that already exists in `loader.ts`; it adds semantic/business-rule
 * validation on top of structural schema validation.
 *
 * @module @wundr/orchestrator-daemon/charter/charter-validator
 */

import type { Charter } from './loader';

// ============================================================================
// Result types
// ============================================================================

/**
 * A validation error that blocks charter acceptance.
 */
export interface CharterValidationError {
  /** Machine-readable code for programmatic handling. */
  code: string;
  /** Human-readable description of the problem. */
  message: string;
  /** Dot-notation path to the invalid field (e.g. `"resourceLimits.tokenBudget.hourly"`). */
  field?: string;
}

/**
 * A validation warning that does not block acceptance but should be addressed.
 */
export interface CharterValidationWarning {
  /** Machine-readable code. */
  code: string;
  /** Human-readable description. */
  message: string;
  /** Dot-notation path to the concerning field. */
  field?: string;
  /** Suggested fix or improvement. */
  suggestion?: string;
}

/**
 * Combined result of a validation pass.
 */
export interface CharterValidationResult {
  valid: boolean;
  errors: CharterValidationError[];
  warnings: CharterValidationWarning[];
}

// ============================================================================
// validateCharter
// ============================================================================

/**
 * Validate that `charter` is semantically well-formed.
 *
 * Structural validation (required fields, types) is performed by the Zod
 * schema in `loader.ts`. This function focuses on business rules:
 *
 * - Tier is 1, 2, or 3.
 * - Names and directives are non-empty.
 * - Resource limits are positive and internally consistent.
 * - Token budget hourly <= daily (hourly budget cannot exceed daily budget).
 * - Safety heuristics lists have no duplicates within themselves.
 * - `alwaysReject` and `autoApprove` lists are disjoint.
 *
 * @param charter - The charter object to validate.
 */
export function validateCharter(charter: unknown): CharterValidationResult {
  const errors: CharterValidationError[] = [];
  const warnings: CharterValidationWarning[] = [];

  if (!charter || typeof charter !== 'object') {
    errors.push({
      code: 'CHARTER_NOT_OBJECT',
      message: 'Charter must be a non-null object.',
    });
    return { valid: false, errors, warnings };
  }

  const c = charter as Record<string, unknown>;

  // ---------- name / role ----------
  if (!c.name || typeof c.name !== 'string' || !(c.name as string).trim()) {
    errors.push({
      code: 'CHARTER_MISSING_NAME',
      message: 'Charter must have a non-empty "name" string.',
      field: 'name',
    });
  }

  if (!c.role || typeof c.role !== 'string' || !(c.role as string).trim()) {
    errors.push({
      code: 'CHARTER_MISSING_ROLE',
      message: 'Charter must have a non-empty "role" string.',
      field: 'role',
    });
  }

  // ---------- tier ----------
  if (
    c.tier === undefined ||
    typeof c.tier !== 'number' ||
    ![1, 2, 3].includes(c.tier as number)
  ) {
    errors.push({
      code: 'CHARTER_INVALID_TIER',
      message: 'Charter "tier" must be 1, 2, or 3.',
      field: 'tier',
    });
  }

  // ---------- identity ----------
  const identity = c.identity as Record<string, unknown> | undefined;
  if (!identity || typeof identity !== 'object') {
    errors.push({
      code: 'CHARTER_MISSING_IDENTITY',
      message: 'Charter must have an "identity" object.',
      field: 'identity',
    });
  } else {
    if (
      !identity.name ||
      typeof identity.name !== 'string' ||
      !(identity.name as string).trim()
    ) {
      errors.push({
        code: 'CHARTER_IDENTITY_MISSING_NAME',
        message: 'Charter identity must have a non-empty "name".',
        field: 'identity.name',
      });
    }
    if (
      !identity.description ||
      typeof identity.description !== 'string' ||
      !(identity.description as string).trim()
    ) {
      warnings.push({
        code: 'CHARTER_IDENTITY_MISSING_DESCRIPTION',
        message: 'Charter identity has no "description".',
        field: 'identity.description',
        suggestion: "Add a description explaining the agent's purpose.",
      });
    }
    if (
      !identity.personality ||
      typeof identity.personality !== 'string' ||
      !(identity.personality as string).trim()
    ) {
      warnings.push({
        code: 'CHARTER_IDENTITY_MISSING_PERSONALITY',
        message: 'Charter identity has no "personality".',
        field: 'identity.personality',
        suggestion:
          "Add a personality description to guide the agent's communication style.",
      });
    }
  }

  // ---------- capabilities ----------
  if (!Array.isArray(c.capabilities)) {
    errors.push({
      code: 'CHARTER_MISSING_CAPABILITIES',
      message: 'Charter must have a "capabilities" array.',
      field: 'capabilities',
    });
  } else if ((c.capabilities as unknown[]).length === 0) {
    warnings.push({
      code: 'CHARTER_EMPTY_CAPABILITIES',
      message: 'Charter has an empty "capabilities" array.',
      field: 'capabilities',
      suggestion: 'Define at least one capability for the agent.',
    });
  }

  // ---------- resourceLimits ----------
  const limits = c.resourceLimits as Record<string, unknown> | undefined;
  if (!limits || typeof limits !== 'object') {
    errors.push({
      code: 'CHARTER_MISSING_RESOURCE_LIMITS',
      message: 'Charter must have a "resourceLimits" object.',
      field: 'resourceLimits',
    });
  } else {
    validatePositiveNumber(limits, 'maxSessions', 'resourceLimits', errors);
    validatePositiveNumber(
      limits,
      'maxTokensPerSession',
      'resourceLimits',
      errors
    );
    validatePositiveNumber(
      limits,
      'maxConcurrentTasks',
      'resourceLimits',
      errors
    );

    const budget = limits.tokenBudget as Record<string, unknown> | undefined;
    if (!budget || typeof budget !== 'object') {
      errors.push({
        code: 'CHARTER_MISSING_TOKEN_BUDGET',
        message: 'Charter resourceLimits must have a "tokenBudget" object.',
        field: 'resourceLimits.tokenBudget',
      });
    } else {
      validatePositiveNumber(
        budget,
        'hourly',
        'resourceLimits.tokenBudget',
        errors
      );
      validatePositiveNumber(
        budget,
        'daily',
        'resourceLimits.tokenBudget',
        errors
      );

      const hourly = budget.hourly as number;
      const daily = budget.daily as number;
      if (
        typeof hourly === 'number' &&
        typeof daily === 'number' &&
        hourly > daily
      ) {
        errors.push({
          code: 'CHARTER_BUDGET_INCONSISTENT',
          message:
            'resourceLimits.tokenBudget.hourly cannot exceed tokenBudget.daily.',
          field: 'resourceLimits.tokenBudget',
        });
      }
    }
  }

  // ---------- safetyHeuristics ----------
  const safety = c.safetyHeuristics as Record<string, unknown> | undefined;
  if (!safety || typeof safety !== 'object') {
    errors.push({
      code: 'CHARTER_MISSING_SAFETY_HEURISTICS',
      message: 'Charter must have a "safetyHeuristics" object.',
      field: 'safetyHeuristics',
    });
  } else {
    validateStringArray(safety, 'autoApprove', 'safetyHeuristics', errors);
    validateStringArray(
      safety,
      'requireConfirmation',
      'safetyHeuristics',
      errors
    );
    validateStringArray(safety, 'alwaysReject', 'safetyHeuristics', errors);
    validateStringArray(safety, 'escalate', 'safetyHeuristics', errors);

    // alwaysReject and autoApprove must be disjoint.
    if (
      Array.isArray(safety.alwaysReject) &&
      Array.isArray(safety.autoApprove)
    ) {
      const rejectSet = new Set(
        (safety.alwaysReject as string[]).map(s => s.trim().toLowerCase())
      );
      for (const pattern of safety.autoApprove as string[]) {
        if (rejectSet.has(pattern.trim().toLowerCase())) {
          errors.push({
            code: 'CHARTER_HEURISTICS_CONFLICT',
            message: `Pattern "${pattern}" appears in both "alwaysReject" and "autoApprove".`,
            field: 'safetyHeuristics',
          });
        }
      }
    }

    // Warn if alwaysReject is empty.
    if (
      Array.isArray(safety.alwaysReject) &&
      (safety.alwaysReject as string[]).length === 0
    ) {
      warnings.push({
        code: 'CHARTER_EMPTY_ALWAYS_REJECT',
        message: 'Charter safetyHeuristics.alwaysReject is empty.',
        field: 'safetyHeuristics.alwaysReject',
        suggestion:
          'Add baseline dangerous commands (e.g. "rm -rf /") to the alwaysReject list.',
      });
    }
  }

  // ---------- operationalSettings ----------
  const ops = c.operationalSettings as Record<string, unknown> | undefined;
  if (!ops || typeof ops !== 'object') {
    errors.push({
      code: 'CHARTER_MISSING_OPERATIONAL_SETTINGS',
      message: 'Charter must have an "operationalSettings" object.',
      field: 'operationalSettings',
    });
  } else {
    if (
      !ops.defaultModel ||
      typeof ops.defaultModel !== 'string' ||
      !(ops.defaultModel as string).trim()
    ) {
      errors.push({
        code: 'CHARTER_MISSING_DEFAULT_MODEL',
        message:
          'Charter operationalSettings.defaultModel must be a non-empty string.',
        field: 'operationalSettings.defaultModel',
      });
    }

    if (
      typeof ops.temperature !== 'number' ||
      (ops.temperature as number) < 0 ||
      (ops.temperature as number) > 2
    ) {
      errors.push({
        code: 'CHARTER_INVALID_TEMPERATURE',
        message:
          'Charter operationalSettings.temperature must be a number between 0 and 2.',
        field: 'operationalSettings.temperature',
      });
    }

    if (typeof ops.timeoutMs !== 'number' || (ops.timeoutMs as number) <= 0) {
      errors.push({
        code: 'CHARTER_INVALID_TIMEOUT',
        message:
          'Charter operationalSettings.timeoutMs must be a positive number.',
        field: 'operationalSettings.timeoutMs',
      });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ============================================================================
// validateCharterUpdate
// ============================================================================

/**
 * Validate a proposed charter update against the current charter.
 *
 * Rules enforced:
 * - `tier` is immutable — cannot be changed after creation.
 * - `name` and `role` are immutable.
 * - The proposed charter must itself pass `validateCharter`.
 * - Relaxing constraints (removing entries from `alwaysReject` or
 *   `requireConfirmation`) produces a warning.
 * - Reducing resource limits (hourly/daily token budget, maxSessions) below
 *   the current values is allowed but produces a warning if the reduction is
 *   large (>50%).
 * - Adding new entries to `autoApprove` that are in the parent's `alwaysReject`
 *   list is an error.
 *
 * @param current  - The currently active charter.
 * @param proposed - The proposed replacement charter.
 */
export function validateCharterUpdate(
  current: Charter,
  proposed: Charter
): CharterValidationResult {
  const errors: CharterValidationError[] = [];
  const warnings: CharterValidationWarning[] = [];

  // Step 1: Validate the proposed charter on its own.
  const baseResult = validateCharter(proposed);
  errors.push(...baseResult.errors);
  warnings.push(...baseResult.warnings);

  // Step 2: Immutability checks.
  if (proposed.tier !== current.tier) {
    errors.push({
      code: 'CHARTER_UPDATE_TIER_IMMUTABLE',
      message: `Charter "tier" is immutable: cannot change from ${current.tier} to ${proposed.tier}.`,
      field: 'tier',
    });
  }

  if (proposed.name !== current.name) {
    warnings.push({
      code: 'CHARTER_UPDATE_NAME_CHANGED',
      message: `Charter "name" changed from "${current.name}" to "${proposed.name}".`,
      field: 'name',
      suggestion:
        'Changing the name may affect traceability. Confirm this is intentional.',
    });
  }

  if (proposed.role !== current.role) {
    warnings.push({
      code: 'CHARTER_UPDATE_ROLE_CHANGED',
      message: `Charter "role" changed from "${current.role}" to "${proposed.role}".`,
      field: 'role',
    });
  }

  // Step 3: Check for constraint relaxation in safetyHeuristics.
  const currentReject = new Set(
    current.safetyHeuristics.alwaysReject.map(s => s.trim().toLowerCase())
  );
  const proposedReject = new Set(
    proposed.safetyHeuristics.alwaysReject.map(s => s.trim().toLowerCase())
  );

  for (const pattern of currentReject) {
    if (!proposedReject.has(pattern)) {
      warnings.push({
        code: 'CHARTER_UPDATE_REJECT_RELAXED',
        message: `Entry "${pattern}" was removed from safetyHeuristics.alwaysReject.`,
        field: 'safetyHeuristics.alwaysReject',
        suggestion:
          'Removing entries from alwaysReject reduces security posture. Confirm this is intentional.',
      });
    }
  }

  const currentConfirm = new Set(
    current.safetyHeuristics.requireConfirmation.map(s =>
      s.trim().toLowerCase()
    )
  );
  const proposedConfirm = new Set(
    proposed.safetyHeuristics.requireConfirmation.map(s =>
      s.trim().toLowerCase()
    )
  );

  for (const pattern of currentConfirm) {
    if (!proposedConfirm.has(pattern)) {
      warnings.push({
        code: 'CHARTER_UPDATE_CONFIRMATION_RELAXED',
        message: `Entry "${pattern}" was removed from safetyHeuristics.requireConfirmation.`,
        field: 'safetyHeuristics.requireConfirmation',
        suggestion:
          'Removing confirmation requirements reduces approval coverage.',
      });
    }
  }

  // Step 4: Auto-approve / alwaysReject conflict across update.
  const proposedAutoApprove = proposed.safetyHeuristics.autoApprove.map(s =>
    s.trim().toLowerCase()
  );
  for (const pattern of proposedAutoApprove) {
    if (currentReject.has(pattern)) {
      errors.push({
        code: 'CHARTER_UPDATE_AUTO_APPROVE_CONFLICTS_REJECT',
        message:
          `Pattern "${pattern}" is in the proposed autoApprove list but was in the ` +
          `current alwaysReject list.`,
        field: 'safetyHeuristics.autoApprove',
      });
    }
  }

  // Step 5: Warn on significant resource limit reductions.
  const currentHourly = current.resourceLimits.tokenBudget.hourly;
  const proposedHourly = proposed.resourceLimits.tokenBudget.hourly;
  if (proposedHourly < currentHourly * 0.5) {
    warnings.push({
      code: 'CHARTER_UPDATE_BUDGET_REDUCED_SIGNIFICANTLY',
      message:
        `tokenBudget.hourly reduced by more than 50%: ` +
        `${currentHourly} -> ${proposedHourly}.`,
      field: 'resourceLimits.tokenBudget.hourly',
    });
  }

  const currentMaxSessions = current.resourceLimits.maxSessions;
  const proposedMaxSessions = proposed.resourceLimits.maxSessions;
  if (proposedMaxSessions < currentMaxSessions * 0.5) {
    warnings.push({
      code: 'CHARTER_UPDATE_MAX_SESSIONS_REDUCED_SIGNIFICANTLY',
      message:
        `resourceLimits.maxSessions reduced by more than 50%: ` +
        `${currentMaxSessions} -> ${proposedMaxSessions}.`,
      field: 'resourceLimits.maxSessions',
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ============================================================================
// mergeCharters
// ============================================================================

/**
 * Merge a parent charter with a child charter so that the child always
 * inherits the parent's constraints.
 *
 * Merge semantics:
 * - `safetyHeuristics.alwaysReject`: union (child gets all parent entries).
 * - `safetyHeuristics.requireConfirmation`: union.
 * - `safetyHeuristics.escalate`: union.
 * - `safetyHeuristics.autoApprove`: intersection (only entries present in
 *   BOTH parent and child are kept — parent may restrict auto-approvals).
 * - `resourceLimits.tokenBudget`: minimum of parent and child values.
 * - `resourceLimits.maxSessions`: minimum.
 * - `resourceLimits.maxConcurrentTasks`: minimum.
 * - `resourceLimits.maxTokensPerSession`: minimum.
 * - `tier`, `name`, `role`, `identity`, `capabilities`, `operationalSettings`:
 *   taken from the child (the child defines its own identity).
 *
 * The returned charter passes through `validateCharter` before being returned.
 * If validation fails the function still returns the merged charter but the
 * caller can call `validateCharter` again to inspect the issues.
 *
 * @param parent - Tier-1 (Orchestrator) charter.
 * @param child  - Tier-2 (Session Manager) or lower charter.
 */
export function mergeCharters(parent: Charter, child: Charter): Charter {
  // Safety heuristics: union of restricted lists, intersection of auto-approvals.
  const parentAutoApproveSet = new Set(
    parent.safetyHeuristics.autoApprove.map(s => s.trim().toLowerCase())
  );
  const childAutoApproveSet = new Set(
    child.safetyHeuristics.autoApprove.map(s => s.trim().toLowerCase())
  );
  const mergedAutoApprove = child.safetyHeuristics.autoApprove.filter(
    s =>
      parentAutoApproveSet.has(s.trim().toLowerCase()) &&
      childAutoApproveSet.has(s.trim().toLowerCase())
  );

  const mergedAlwaysReject = deduplicatedUnion(
    parent.safetyHeuristics.alwaysReject,
    child.safetyHeuristics.alwaysReject
  );

  const mergedRequireConfirmation = deduplicatedUnion(
    parent.safetyHeuristics.requireConfirmation,
    child.safetyHeuristics.requireConfirmation
  );

  const mergedEscalate = deduplicatedUnion(
    parent.safetyHeuristics.escalate,
    child.safetyHeuristics.escalate
  );

  // Resource limits: take the minimum across parent and child.
  const mergedLimits = {
    maxSessions: Math.min(
      parent.resourceLimits.maxSessions,
      child.resourceLimits.maxSessions
    ),
    maxTokensPerSession: Math.min(
      parent.resourceLimits.maxTokensPerSession,
      child.resourceLimits.maxTokensPerSession
    ),
    maxConcurrentTasks: Math.min(
      parent.resourceLimits.maxConcurrentTasks,
      child.resourceLimits.maxConcurrentTasks
    ),
    tokenBudget: {
      hourly: Math.min(
        parent.resourceLimits.tokenBudget.hourly,
        child.resourceLimits.tokenBudget.hourly
      ),
      daily: Math.min(
        parent.resourceLimits.tokenBudget.daily,
        child.resourceLimits.tokenBudget.daily
      ),
    },
  };

  const merged: Charter = {
    // Child identity and operational configuration.
    name: child.name,
    role: child.role,
    tier: child.tier,
    identity: { ...child.identity },
    capabilities: [...child.capabilities],
    responsibilities: [...child.responsibilities],
    operationalSettings: { ...child.operationalSettings },

    // Merged resource limits (most restrictive).
    resourceLimits: mergedLimits,

    // Merged safety heuristics.
    safetyHeuristics: {
      autoApprove: mergedAutoApprove,
      requireConfirmation: mergedRequireConfirmation,
      alwaysReject: mergedAlwaysReject,
      escalate: mergedEscalate,
    },
  };

  return merged;
}

// ============================================================================
// Private helpers
// ============================================================================

function validatePositiveNumber(
  obj: Record<string, unknown>,
  field: string,
  parentField: string,
  errors: CharterValidationError[]
): void {
  const value = obj[field];
  if (typeof value !== 'number' || value <= 0) {
    errors.push({
      code: `CHARTER_INVALID_${field.toUpperCase()}`,
      message: `${parentField}.${field} must be a positive number.`,
      field: `${parentField}.${field}`,
    });
  }
}

function validateStringArray(
  obj: Record<string, unknown>,
  field: string,
  parentField: string,
  errors: CharterValidationError[]
): void {
  const value = obj[field];
  if (!Array.isArray(value)) {
    errors.push({
      code: `CHARTER_MISSING_${field.toUpperCase()}`,
      message: `${parentField}.${field} must be an array.`,
      field: `${parentField}.${field}`,
    });
    return;
  }

  const arr = value as unknown[];
  for (let i = 0; i < arr.length; i++) {
    if (typeof arr[i] !== 'string') {
      errors.push({
        code: `CHARTER_INVALID_${field.toUpperCase()}_ENTRY`,
        message: `${parentField}.${field}[${i}] must be a string.`,
        field: `${parentField}.${field}[${i}]`,
      });
    }
  }
}

/**
 * Merge two string arrays into a deduplicated union (case-insensitive).
 * Preserves the original casing of the first occurrence.
 */
function deduplicatedUnion(a: string[], b: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of [...a, ...b]) {
    const key = item.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item.trim());
    }
  }

  return result;
}
