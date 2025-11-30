/**
 * Token Budget Tracker Integration Example
 *
 * This example shows how to integrate the TokenBudgetTracker with the OrchestratorDaemon
 * to enforce token budgets and monitor usage.
 */

import { OrchestratorDaemon } from '../src/core/orchestrator-daemon';
import { TokenBudgetTracker } from '../src/budget/token-tracker';
import { BudgetConfig } from '../src/budget/types';

/**
 * Example 1: Basic Integration
 */
async function basicIntegration() {
  // Configure budget tracker
  const budgetConfig: BudgetConfig = {
    defaultBudget: {
      hourly: 100000,   // 100k tokens per hour
      daily: 1000000,   // 1M tokens per day
      monthly: 20000000 // 20M tokens per month
    },
    orchestratorBudgets: {
      'orchestrator-tier1': {
        hourly: 200000,
        daily: 2000000,
        monthly: 40000000
      }
    },
    thresholds: [0.5, 0.75, 0.9, 1.0],
    reservationTTL: 15 * 60 * 1000, // 15 minutes
    enableOverrides: true,
    redis: {
      host: 'localhost',
      port: 6379,
      keyPrefix: 'orchestrator'
    }
  };

  // Initialize components
  const daemon = new OrchestratorDaemon({
    name: 'orchestrator-daemon',
    port: 8787,
    host: '127.0.0.1',
    maxSessions: 100,
    heartbeatInterval: 30000,
    shutdownTimeout: 10000,
    verbose: true
  });

  const tracker = new TokenBudgetTracker(budgetConfig);

  // Set up event listeners
  setupEventHandlers(daemon, tracker);

  // Start daemon
  await daemon.start();

  console.log('Orchestrator Daemon with Budget Tracking started');
}

/**
 * Setup event handlers for budget enforcement
 */
function setupEventHandlers(
  daemon: OrchestratorDaemon,
  tracker: TokenBudgetTracker
) {
  // 1. Pre-flight budget check when session is spawned
  daemon.on('session:spawned', async (session) => {
    console.log(`Session spawned: ${session.id}`);

    // Estimate initial tokens needed for session
    const estimatedTokens = 10000;

    // Check budget across all periods
    const checks = await Promise.all([
      tracker.checkBudget(session.orchestratorId, estimatedTokens, 'hourly'),
      tracker.checkBudget(session.orchestratorId, estimatedTokens, 'daily'),
      tracker.checkBudget(session.orchestratorId, estimatedTokens, 'monthly')
    ]);

    // If any period is exceeded, stop the session
    const anyExceeded = checks.some(check => !check.allowed);
    if (anyExceeded) {
      console.warn(`Budget exceeded for ${session.orchestratorId}, stopping session`);
      await daemon.stop();

      const exceededPeriods = checks
        .filter(c => !c.allowed)
        .map(c => c.period)
        .join(', ');
      console.warn(`Exceeded periods: ${exceededPeriods}`);
    } else {
      console.log(`Budget check passed for session ${session.id}`);
    }
  });

  // 2. Track usage when session completes
  daemon.on('session:completed', async (session) => {
    console.log(`Session completed: ${session.id}`);

    // Track actual usage
    await tracker.trackUsage({
      orchestratorId: session.orchestratorId,
      sessionId: session.id,
      timestamp: new Date(),
      promptTokens: Math.floor(session.metrics.tokensUsed * 0.3),
      completionTokens: Math.floor(session.metrics.tokensUsed * 0.7),
      totalTokens: session.metrics.tokensUsed,
      model: 'claude-sonnet-4.5',
      metadata: {
        duration: session.metrics.duration,
        tasksCompleted: session.metrics.tasksCompleted
      }
    });

    // Get updated stats
    const stats = await tracker.getUsageStats(session.orchestratorId, 'hourly');
    console.log(`
      Usage Stats for ${session.orchestratorId}:
      Used: ${stats.totalUsed} / ${stats.limit} (${stats.percentUsed.toFixed(1)}%)
      Remaining: ${stats.remaining}
    `);
  });

  // 3. Handle threshold events
  tracker.on('threshold:50', (event) => {
    console.log(`⚠️  50% budget used: ${event.orchestratorId} (${event.period})`);
    // Send notification to team
  });

  tracker.on('threshold:75', (event) => {
    console.log(`⚠️⚠️  75% budget used: ${event.orchestratorId} (${event.period})`);
    // Send alert email
  });

  tracker.on('threshold:90', (event) => {
    console.log(`🚨 90% budget used: ${event.orchestratorId} (${event.period})`);
    // Alert on-call engineer
    // Consider pausing low-priority tasks
  });

  tracker.on('budget:exceeded', async (event) => {
    console.log(`🚨🚨 Budget exceeded: ${event.orchestratorId} (${event.period})`);
    // Pause orchestrator
    // Escalate to management
    // Send PagerDuty alert
  });

  // 4. Track all usage
  tracker.on('usage:tracked', (usage) => {
    console.log(`Tracked ${usage.totalTokens} tokens for ${usage.orchestratorId}`);
  });
}

/**
 * Example 2: LLM Call with Token Reservation
 */
async function llmCallWithReservation(
  tracker: TokenBudgetTracker,
  orchestratorId: string
) {
  // Estimate tokens needed (based on prompt length, etc.)
  const estimatedTokens = 5000;

  // Reserve tokens before making the call
  const reservation = await tracker.reserveTokens(
    orchestratorId,
    estimatedTokens,
    'hourly'
  );

  if (!reservation.success) {
    console.error(`Reservation failed: ${reservation.error}`);
    return null;
  }

  console.log(`Reserved ${estimatedTokens} tokens (ID: ${reservation.reservationId})`);

  try {
    // Make the LLM call (pseudo-code)
    const response = await makeLLMCall({
      prompt: 'Your prompt here',
      model: 'claude-sonnet-4.5',
      max_tokens: 2000
    });

    // Release reservation with actual usage
    await tracker.releaseReservation(
      reservation.reservationId!,
      response.usage.total_tokens
    );

    // Track the actual usage
    await tracker.trackUsage({
      orchestratorId,
      sessionId: 'session-123',
      timestamp: new Date(),
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
      model: response.model,
      requestId: response.id
    });

    console.log(`Used ${response.usage.total_tokens} tokens (released reservation)`);

    return response;
  } catch (error) {
    // Release reservation on error (0 tokens used)
    await tracker.releaseReservation(reservation.reservationId!, 0);
    console.error('LLM call failed:', error);
    throw error;
  }
}

/**
 * Example 3: Budget Override for Priority Tasks
 */
async function handlePriorityTask(
  tracker: TokenBudgetTracker,
  orchestratorId: string,
  taskPriority: 'low' | 'medium' | 'high' | 'critical'
) {
  const estimatedTokens = 50000;

  // Check budget
  const check = await tracker.checkBudget(orchestratorId, estimatedTokens, 'hourly');

  if (!check.allowed && taskPriority === 'critical') {
    console.log('Budget exceeded, but task is critical - setting override');

    // Set temporary budget override
    await tracker.setBudgetOverride({
      orchestratorId,
      period: 'hourly',
      additionalTokens: 100000,
      reason: 'Critical production incident - customer impact',
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
      createdBy: 'on-call-engineer',
      metadata: {
        priority: taskPriority,
        ticketId: 'INC-12345',
        approvedBy: 'engineering-manager'
      }
    });

    console.log('Budget override set - proceeding with critical task');
  } else if (!check.allowed) {
    console.log('Budget exceeded and task is not critical - rejecting');
    throw new Error('Budget exceeded');
  }

  // Proceed with task
  await llmCallWithReservation(tracker, orchestratorId);
}

/**
 * Example 4: Monitoring Dashboard Data
 */
async function getDashboardData(
  tracker: TokenBudgetTracker,
  orchestratorIds: string[]
) {
  const dashboard = {
    timestamp: new Date(),
    orchestrators: [] as any[]
  };

  for (const orchestratorId of orchestratorIds) {
    const [hourly, daily, monthly] = await Promise.all([
      tracker.getUsageStats(orchestratorId, 'hourly'),
      tracker.getUsageStats(orchestratorId, 'daily'),
      tracker.getUsageStats(orchestratorId, 'monthly')
    ]);

    dashboard.orchestrators.push({
      id: orchestratorId,
      hourly: {
        used: hourly.totalUsed,
        limit: hourly.limit,
        percentUsed: hourly.percentUsed,
        remaining: hourly.remaining
      },
      daily: {
        used: daily.totalUsed,
        limit: daily.limit,
        percentUsed: daily.percentUsed,
        remaining: daily.remaining
      },
      monthly: {
        used: monthly.totalUsed,
        limit: monthly.limit,
        percentUsed: monthly.percentUsed,
        remaining: monthly.remaining
      },
      topModels: hourly.topModels,
      breakdown: hourly.breakdown
    });
  }

  return dashboard;
}

/**
 * Pseudo-code for LLM call (replace with actual implementation)
 */
async function makeLLMCall(params: any): Promise<any> {
  // Replace with actual LLM API call
  return {
    id: 'req-123',
    model: params.model,
    usage: {
      prompt_tokens: 1000,
      completion_tokens: 2000,
      total_tokens: 3000
    },
    choices: [
      {
        message: {
          role: 'assistant',
          content: 'Response here'
        }
      }
    ]
  };
}

/**
 * Main entry point
 */
async function main() {
  try {
    await basicIntegration();
  } catch (error) {
    console.error('Failed to start:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export {
  basicIntegration,
  llmCallWithReservation,
  handlePriorityTask,
  getDashboardData
};
