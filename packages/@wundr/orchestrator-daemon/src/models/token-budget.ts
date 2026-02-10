/**
 * Token Budget Manager - Per-session token budget enforcement
 *
 * Tracks cumulative token usage per session and enforces configurable budget
 * limits. Supports both hard limits (block requests) and soft limits (warn
 * but allow). Budget windows can be time-based (resets periodically) or
 * lifetime (never resets until manually cleared).
 */

import { EventEmitter } from 'eventemitter3';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BudgetWindowKind = 'lifetime' | 'hourly' | 'daily';

export interface SessionBudget {
  /** Maximum total tokens (input + output) allowed */
  maxTotalTokens: number;
  /** Maximum cost in USD allowed (zero = unlimited) */
  maxCostUsd: number;
  /** Budget window type */
  window: BudgetWindowKind;
}

export interface SessionUsage {
  sessionId: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  requestCount: number;
  windowStart: number;
  lastRequestAt: number;
}

export interface BudgetCheck {
  /** Whether the request is within budget */
  allowed: boolean;
  /** Whether the session is near its budget limit (>80% consumed) */
  warning: boolean;
  /** Remaining token budget */
  remainingTokens: number;
  /** Remaining cost budget in USD */
  remainingCostUsd: number;
  /** Percentage of budget consumed (0-100) */
  consumedPercent: number;
  /** Human-readable message if blocked or warning */
  message?: string;
}

export interface TokenBudgetConfig {
  /** Default budget applied to sessions without an explicit budget */
  defaultBudget?: Partial<SessionBudget>;
  /** Warning threshold as a percentage of budget consumed (default: 80) */
  warningThresholdPercent?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_TOTAL_TOKENS = 2_000_000;
const DEFAULT_MAX_COST_USD = 10;
const DEFAULT_WINDOW: BudgetWindowKind = 'daily';
const DEFAULT_WARNING_PERCENT = 80;

const WINDOW_DURATIONS_MS: Record<BudgetWindowKind, number> = {
  lifetime: Infinity,
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
};

// ---------------------------------------------------------------------------
// TokenBudgetManager class
// ---------------------------------------------------------------------------

interface TokenBudgetEvents {
  'budget:warning': (sessionId: string, check: BudgetCheck) => void;
  'budget:exceeded': (sessionId: string, check: BudgetCheck) => void;
  'budget:reset': (sessionId: string) => void;
}

export class TokenBudgetManager extends EventEmitter<TokenBudgetEvents> {
  private readonly sessions: Map<string, SessionUsage> = new Map();
  private readonly budgets: Map<string, SessionBudget> = new Map();
  private readonly defaultBudget: SessionBudget;
  private readonly warningThresholdPercent: number;

  constructor(config?: TokenBudgetConfig) {
    super();
    this.defaultBudget = {
      maxTotalTokens: config?.defaultBudget?.maxTotalTokens ?? DEFAULT_MAX_TOTAL_TOKENS,
      maxCostUsd: config?.defaultBudget?.maxCostUsd ?? DEFAULT_MAX_COST_USD,
      window: config?.defaultBudget?.window ?? DEFAULT_WINDOW,
    };
    this.warningThresholdPercent = config?.warningThresholdPercent ?? DEFAULT_WARNING_PERCENT;
  }

  // -------------------------------------------------------------------------
  // Budget configuration
  // -------------------------------------------------------------------------

  /**
   * Set a custom budget for a specific session.
   */
  setSessionBudget(sessionId: string, budget: Partial<SessionBudget>): void {
    this.budgets.set(sessionId, {
      maxTotalTokens: budget.maxTotalTokens ?? this.defaultBudget.maxTotalTokens,
      maxCostUsd: budget.maxCostUsd ?? this.defaultBudget.maxCostUsd,
      window: budget.window ?? this.defaultBudget.window,
    });
  }

  /**
   * Get the effective budget for a session.
   */
  getSessionBudget(sessionId: string): SessionBudget {
    return this.budgets.get(sessionId) ?? this.defaultBudget;
  }

  // -------------------------------------------------------------------------
  // Budget checking
  // -------------------------------------------------------------------------

  /**
   * Check whether a session has remaining budget for a new request.
   * Does not modify usage -- call recordUsage() after the request completes.
   */
  checkBudget(sessionId: string): BudgetCheck {
    const budget = this.getSessionBudget(sessionId);
    const usage = this.getOrCreateUsage(sessionId);

    // Auto-reset if the window has expired
    this.maybeResetWindow(sessionId, usage, budget);

    const totalTokens = usage.totalInputTokens + usage.totalOutputTokens;
    const remainingTokens = Math.max(0, budget.maxTotalTokens - totalTokens);
    const remainingCostUsd = budget.maxCostUsd > 0
      ? Math.max(0, budget.maxCostUsd - usage.totalCostUsd)
      : Infinity;

    const tokenPercent = budget.maxTotalTokens > 0
      ? (totalTokens / budget.maxTotalTokens) * 100
      : 0;
    const costPercent = budget.maxCostUsd > 0
      ? (usage.totalCostUsd / budget.maxCostUsd) * 100
      : 0;
    const consumedPercent = Math.min(100, Math.max(tokenPercent, costPercent));

    const tokenExceeded = remainingTokens <= 0;
    const costExceeded = budget.maxCostUsd > 0 && remainingCostUsd <= 0;
    const allowed = !tokenExceeded && !costExceeded;
    const warning = allowed && consumedPercent >= this.warningThresholdPercent;

    let message: string | undefined;
    if (!allowed) {
      if (tokenExceeded) {
        message = `Session token budget exceeded: ${totalTokens.toLocaleString()} / ${budget.maxTotalTokens.toLocaleString()} tokens used`;
      } else {
        message = `Session cost budget exceeded: $${usage.totalCostUsd.toFixed(4)} / $${budget.maxCostUsd.toFixed(2)} spent`;
      }
    } else if (warning) {
      message = `Session budget ${consumedPercent.toFixed(0)}% consumed (${totalTokens.toLocaleString()} tokens, $${usage.totalCostUsd.toFixed(4)})`;
    }

    const check: BudgetCheck = {
      allowed,
      warning,
      remainingTokens,
      remainingCostUsd: remainingCostUsd === Infinity ? -1 : remainingCostUsd,
      consumedPercent,
      message,
    };

    if (!allowed) {
      this.emit('budget:exceeded', sessionId, check);
    } else if (warning) {
      this.emit('budget:warning', sessionId, check);
    }

    return check;
  }

  // -------------------------------------------------------------------------
  // Usage tracking
  // -------------------------------------------------------------------------

  /**
   * Record token usage after a completed request.
   */
  recordUsage(params: {
    sessionId: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  }): void {
    const usage = this.getOrCreateUsage(params.sessionId);
    const budget = this.getSessionBudget(params.sessionId);

    this.maybeResetWindow(params.sessionId, usage, budget);

    usage.totalInputTokens += params.inputTokens;
    usage.totalOutputTokens += params.outputTokens;
    usage.totalCostUsd += params.costUsd;
    usage.requestCount++;
    usage.lastRequestAt = Date.now();
  }

  /**
   * Get current usage for a session.
   */
  getUsage(sessionId: string): SessionUsage | null {
    return this.sessions.get(sessionId) ?? null;
  }

  /**
   * Reset usage for a session (start a fresh budget window).
   */
  resetUsage(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.emit('budget:reset', sessionId);
  }

  /**
   * Remove all tracked sessions.
   */
  clear(): void {
    this.sessions.clear();
    this.budgets.clear();
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private getOrCreateUsage(sessionId: string): SessionUsage {
    let usage = this.sessions.get(sessionId);
    if (!usage) {
      usage = {
        sessionId,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCostUsd: 0,
        requestCount: 0,
        windowStart: Date.now(),
        lastRequestAt: 0,
      };
      this.sessions.set(sessionId, usage);
    }
    return usage;
  }

  private maybeResetWindow(
    sessionId: string,
    usage: SessionUsage,
    budget: SessionBudget,
  ): void {
    if (budget.window === 'lifetime') {
      return;
    }
    const windowDuration = WINDOW_DURATIONS_MS[budget.window];
    const now = Date.now();
    if (now - usage.windowStart >= windowDuration) {
      usage.totalInputTokens = 0;
      usage.totalOutputTokens = 0;
      usage.totalCostUsd = 0;
      usage.requestCount = 0;
      usage.windowStart = now;
      this.emit('budget:reset', sessionId);
    }
  }
}
