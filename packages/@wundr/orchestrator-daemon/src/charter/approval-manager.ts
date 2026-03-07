/**
 * Approval Manager
 *
 * Manages the lifecycle of approval requests for actions that require human
 * (or auto-approved policy) sign-off before the orchestrator may proceed.
 *
 * Flow:
 *   1. Caller invokes `requestApproval(action, charter, context)`.
 *   2. `checkAutoApproval` is run; if the action qualifies the request is
 *      immediately resolved as approved.
 *   3. Otherwise an `ApprovalRequest` is stored with status `pending` and
 *      the `approval:pending` event is emitted.
 *   4. An external actor (human, upstream agent, webhook) calls
 *      `processApproval(requestId, approved, approver)`.
 *   5. The request status is updated and the appropriate event is emitted.
 *
 * Events emitted (via Node.js EventEmitter):
 *   - `approval:pending`  — a new request is waiting for a decision.
 *   - `approval:approved` — a request was approved (by human or auto-policy).
 *   - `approval:rejected` — a request was rejected.
 *   - `approval:expired`  — a pending request timed out (if TTL is set).
 *
 * @module @wundr/orchestrator-daemon/charter/approval-manager
 */

import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

import type { Charter } from './loader';
import { Logger } from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

/** Lifecycle status of an approval request. */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

/**
 * A single approval request record. Once created the `id` and `createdAt`
 * fields are immutable; only `status`, `resolvedAt`, and `resolvedBy` change.
 */
export interface ApprovalRequest {
  /** Unique request identifier (UUID v4). */
  id: string;
  /** ID of the orchestrator that owns this request. */
  orchestratorId: string;
  /** High-level description of the action that requires approval. */
  action: string;
  /** Arbitrary context data provided by the caller (e.g. tool name, params). */
  context: Record<string, unknown>;
  /** Current lifecycle status. */
  status: ApprovalStatus;
  /** Whether this request was resolved automatically by policy (no human). */
  autoApproved: boolean;
  /** Timestamp (ms) when this request was created. */
  createdAt: number;
  /** Timestamp (ms) when this request was resolved, if applicable. */
  resolvedAt?: number;
  /** Identity of the approver: `"auto-policy"`, a human ID, or an agent ID. */
  resolvedBy?: string;
  /** Optional rejection or approval note provided at resolution time. */
  note?: string;
  /** Optional TTL (ms since epoch) after which the request expires automatically. */
  expiresAt?: number;
}

/**
 * Payload emitted with `approval:pending`, `approval:approved`,
 * `approval:rejected`, and `approval:expired` events.
 */
export interface ApprovalEvent {
  request: ApprovalRequest;
}

// ============================================================================
// ApprovalManager
// ============================================================================

/**
 * Manages the full lifecycle of approval requests.
 *
 * @example
 * ```ts
 * const manager = new ApprovalManager();
 *
 * manager.on('approval:pending', ({ request }) => {
 *   // Notify Slack, email, etc.
 * });
 *
 * const request = await manager.requestApproval(
 *   'deploy_to_production',
 *   charter,
 *   { environment: 'prod', service: 'api' },
 *   { orchestratorId: 'orch-001' }
 * );
 *
 * if (request.autoApproved) {
 *   // Proceed immediately.
 * }
 * ```
 */
export class ApprovalManager extends EventEmitter {
  private readonly logger: Logger;

  /** All requests, keyed by request ID. */
  private readonly requests: Map<string, ApprovalRequest> = new Map();

  /** Default TTL for pending requests (ms). 0 means no TTL. */
  private readonly defaultTtlMs: number;

  /** Timer handle for TTL expiry sweeps. */
  private expiryTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options?: {
    /**
     * Default TTL for pending requests in milliseconds.
     * When a request is not resolved within this window it is automatically
     * expired. Set to 0 (default) to disable TTL.
     */
    defaultTtlMs?: number;
    /**
     * How often to sweep for expired requests (ms). Default: 30 000.
     */
    expiryCheckIntervalMs?: number;
  }) {
    super();
    this.logger = new Logger('ApprovalManager');
    this.defaultTtlMs = options?.defaultTtlMs ?? 0;

    const checkInterval = options?.expiryCheckIntervalMs ?? 30_000;
    if (this.defaultTtlMs > 0) {
      this.expiryTimer = setInterval(() => {
        this.sweepExpired();
      }, checkInterval);
    }
  }

  /**
   * Stop the expiry sweep timer. Call this when shutting down.
   */
  stop(): void {
    if (this.expiryTimer !== null) {
      clearInterval(this.expiryTimer);
      this.expiryTimer = null;
    }
  }

  // --------------------------------------------------------------------------
  // requestApproval
  // --------------------------------------------------------------------------

  /**
   * Create a new approval request for `action`.
   *
   * If `checkAutoApproval` determines the action qualifies for auto-approval
   * the returned request will already have `status: 'approved'` and
   * `autoApproved: true`. The `approval:approved` event is emitted in this
   * case (not `approval:pending`).
   *
   * @param action         - High-level action identifier.
   * @param charter        - Charter whose `safetyHeuristics.autoApprove` list
   *                         is consulted for auto-approval eligibility.
   * @param context        - Arbitrary metadata to attach to the request.
   * @param opts.orchestratorId - ID of the requesting orchestrator.
   * @param opts.ttlMs          - Per-request TTL override (ms). 0 = no TTL.
   */
  requestApproval(
    action: string,
    charter: Charter,
    context: Record<string, unknown> = {},
    opts?: { orchestratorId?: string; ttlMs?: number }
  ): ApprovalRequest {
    const now = Date.now();
    const ttlMs = opts?.ttlMs !== undefined ? opts.ttlMs : this.defaultTtlMs;

    const request: ApprovalRequest = {
      id: crypto.randomUUID(),
      orchestratorId: opts?.orchestratorId ?? 'unknown',
      action,
      context,
      status: 'pending',
      autoApproved: false,
      createdAt: now,
      expiresAt: ttlMs > 0 ? now + ttlMs : undefined,
    };

    // Check auto-approval before storing the request.
    const autoResult = this.checkAutoApproval(action, charter);
    if (autoResult.autoApprove) {
      request.status = 'approved';
      request.autoApproved = true;
      request.resolvedAt = now;
      request.resolvedBy = 'auto-policy';
      request.note = autoResult.reason;

      this.requests.set(request.id, request);
      this.logger.info(
        `Auto-approved request ${request.id} for action "${action}": ${autoResult.reason ?? 'matched auto-approve policy'}`
      );
      this.emit('approval:approved', { request } satisfies ApprovalEvent);
      return request;
    }

    // Store and emit pending event.
    this.requests.set(request.id, request);
    this.logger.info(
      `Approval request ${request.id} created for action "${action}" ` +
        `(orchestrator: ${request.orchestratorId})`
    );
    this.emit('approval:pending', { request } satisfies ApprovalEvent);
    return request;
  }

  // --------------------------------------------------------------------------
  // processApproval
  // --------------------------------------------------------------------------

  /**
   * Record a human or agent decision on a pending approval request.
   *
   * Emits `approval:approved` or `approval:rejected` depending on the
   * `approved` parameter. Returns the updated request record.
   *
   * Throws if the request ID is unknown or if the request is not in `pending`
   * status.
   *
   * @param requestId - ID of the request to resolve.
   * @param approved  - `true` to approve, `false` to reject.
   * @param approver  - Identifier of the entity making the decision.
   * @param note      - Optional note or reason.
   */
  processApproval(
    requestId: string,
    approved: boolean,
    approver: string,
    note?: string
  ): ApprovalRequest {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`No approval request found with ID: ${requestId}`);
    }

    if (request.status !== 'pending') {
      throw new Error(
        `Approval request ${requestId} is already in "${request.status}" status and cannot be updated`
      );
    }

    const now = Date.now();
    request.status = approved ? 'approved' : 'rejected';
    request.resolvedAt = now;
    request.resolvedBy = approver;
    if (note) {
      request.note = note;
    }

    const eventName: 'approval:approved' | 'approval:rejected' = approved
      ? 'approval:approved'
      : 'approval:rejected';

    this.logger.info(
      `Approval request ${requestId} ${approved ? 'approved' : 'rejected'} ` +
        `by "${approver}"${note ? `: ${note}` : ''}`
    );
    this.emit(eventName, { request } satisfies ApprovalEvent);
    return request;
  }

  // --------------------------------------------------------------------------
  // getPendingApprovals
  // --------------------------------------------------------------------------

  /**
   * Return all pending approval requests for a given orchestrator.
   *
   * If `orchestratorId` is omitted, returns all pending requests across all
   * orchestrators.
   */
  getPendingApprovals(orchestratorId?: string): ApprovalRequest[] {
    const pending: ApprovalRequest[] = [];
    for (const request of this.requests.values()) {
      if (request.status !== 'pending') {
        continue;
      }
      if (orchestratorId && request.orchestratorId !== orchestratorId) {
        continue;
      }
      pending.push(request);
    }
    return pending;
  }

  /**
   * Return a single request by ID, or `undefined` if not found.
   */
  getRequest(requestId: string): ApprovalRequest | undefined {
    return this.requests.get(requestId);
  }

  /**
   * Return all requests (any status) for a given orchestrator.
   */
  getRequestsForOrchestrator(orchestratorId: string): ApprovalRequest[] {
    return Array.from(this.requests.values()).filter(
      r => r.orchestratorId === orchestratorId
    );
  }

  // --------------------------------------------------------------------------
  // checkAutoApproval
  // --------------------------------------------------------------------------

  /**
   * Determine whether `action` qualifies for automatic approval based on the
   * charter's `safetyHeuristics.autoApprove` list.
   *
   * Returns `{ autoApprove: true, reason }` when the action matches, or
   * `{ autoApprove: false }` when manual approval is required.
   *
   * The matching strategy is case-insensitive substring or exact match,
   * consistent with how `ConstraintEnforcer.validateAction` works.
   */
  checkAutoApproval(
    action: string,
    charter: Charter
  ): { autoApprove: boolean; reason?: string } {
    const normalizedAction = action.trim().toLowerCase();

    for (const autoApprovePattern of charter.safetyHeuristics.autoApprove) {
      const normalizedPattern = autoApprovePattern.trim().toLowerCase();
      if (
        normalizedAction === normalizedPattern ||
        normalizedAction.includes(normalizedPattern) ||
        normalizedPattern.includes(normalizedAction)
      ) {
        return {
          autoApprove: true,
          reason: `Matched auto-approve pattern: "${autoApprovePattern}"`,
        };
      }
    }

    return { autoApprove: false };
  }

  // --------------------------------------------------------------------------
  // TTL sweep
  // --------------------------------------------------------------------------

  /**
   * Expire any pending requests that have passed their TTL.
   * Called automatically when `defaultTtlMs > 0`.
   */
  sweepExpired(): void {
    const now = Date.now();
    for (const request of this.requests.values()) {
      if (
        request.status === 'pending' &&
        request.expiresAt !== undefined &&
        now >= request.expiresAt
      ) {
        request.status = 'expired';
        request.resolvedAt = now;
        request.resolvedBy = 'system';
        request.note = 'Request expired without a decision';

        this.logger.warn(
          `Approval request ${request.id} for action "${request.action}" expired`
        );
        this.emit('approval:expired', { request } satisfies ApprovalEvent);
      }
    }
  }

  /**
   * Purge resolved (approved/rejected/expired) requests older than
   * `maxAgeMs` milliseconds from the in-memory store.
   *
   * Call periodically to prevent unbounded memory growth in long-running
   * daemons.
   */
  purgeResolved(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const threshold = Date.now() - maxAgeMs;
    let purged = 0;
    for (const [id, request] of this.requests.entries()) {
      if (
        request.status !== 'pending' &&
        (request.resolvedAt ?? 0) < threshold
      ) {
        this.requests.delete(id);
        purged++;
      }
    }
    if (purged > 0) {
      this.logger.debug(`Purged ${purged} resolved approval request(s).`);
    }
    return purged;
  }
}
