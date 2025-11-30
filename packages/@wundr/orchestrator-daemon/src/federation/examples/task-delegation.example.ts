/**
 * Example: Task Delegation with TaskDelegator
 *
 * This example demonstrates how to use the TaskDelegator class to delegate
 * tasks between orchestrators in a multi-orchestrator federation.
 */

import { TaskDelegator, InMemoryDelegationTracker } from '../task-delegator';
import type { OrchestratorInfo, DelegationContext, DelegationCallback } from '../types';
import type { Task } from '../../types';

async function main() {
  console.log('=== Task Delegation Example ===\n');

  // 1. Create a TaskDelegator instance
  const tracker = new InMemoryDelegationTracker();
  const delegator = new TaskDelegator(tracker, {
    defaultTimeout: 60000, // 1 minute
    maxRetries: 3,
    retryDelay: 5000, // 5 seconds
    backoffMultiplier: 2,
  });

  // 2. Set up event listeners
  delegator.on('delegation:started', ({ delegationId, task, targetOrchestrator }) => {
    console.log(`✓ Delegation started: ${delegationId}`);
    console.log(`  Task: ${task.description}`);
    console.log(`  Target: ${targetOrchestrator}\n`);
  });

  delegator.on('delegation:callback', (callback: DelegationCallback) => {
    console.log(`✓ Callback received for delegation: ${callback.delegationId}`);
    console.log(`  Status: ${callback.status}\n`);
  });

  delegator.on('delegation:timeout', ({ delegationId }) => {
    console.log(`✗ Delegation timeout: ${delegationId}\n`);
  });

  delegator.on('delegation:retried', ({ originalDelegationId, newDelegationId, retryCount }) => {
    console.log(`↻ Retrying delegation ${originalDelegationId}`);
    console.log(`  New delegation ID: ${newDelegationId}`);
    console.log(`  Retry count: ${retryCount}\n`);
  });

  // 3. Define available orchestrators
  const orchestrators: OrchestratorInfo[] = [
    {
      id: 'orch-backend',
      name: 'Backend Orchestrator',
      tier: 2,
      capabilities: ['code', 'testing', 'api-design'],
      currentLoad: 3,
      maxLoad: 10,
      available: true,
      lastSeen: new Date(),
    },
    {
      id: 'orch-ml',
      name: 'ML Orchestrator',
      tier: 3,
      capabilities: ['research', 'analysis', 'ml-training'],
      currentLoad: 7,
      maxLoad: 10,
      available: true,
      lastSeen: new Date(),
    },
    {
      id: 'orch-frontend',
      name: 'Frontend Orchestrator',
      tier: 1,
      capabilities: ['code', 'ui-design'],
      currentLoad: 1,
      maxLoad: 5,
      available: true,
      lastSeen: new Date(),
    },
  ];

  // 4. Create a task to delegate
  const task: Task = {
    id: 'task-001',
    type: 'code',
    description: 'Implement user authentication API endpoint',
    priority: 'high',
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {
      estimatedComplexity: 'medium',
      requiredSkills: ['backend', 'security'],
    },
  };

  // 5. Select the best orchestrator for the task
  console.log('Step 1: Selecting best orchestrator...');
  const context: DelegationContext = {
    priority: 'high',
    timeout: 120000, // 2 minutes
    requiredCapabilities: ['code', 'api-design'],
    excludedOrchestrators: ['orch-frontend'], // Frontend not suitable for backend tasks
  };

  const selectedOrchestrator = delegator.selectBestOrchestrator(task, orchestrators, context);

  if (!selectedOrchestrator) {
    console.log('✗ No suitable orchestrator found\n');
    return;
  }

  console.log(`✓ Selected: ${selectedOrchestrator.name} (${selectedOrchestrator.id})`);
  console.log(`  Capabilities: ${selectedOrchestrator.capabilities.join(', ')}`);
  console.log(`  Current load: ${selectedOrchestrator.currentLoad}/${selectedOrchestrator.maxLoad}\n`);

  // 6. Delegate the task
  console.log('Step 2: Delegating task...');
  const delegationId = await delegator.delegate(
    task,
    selectedOrchestrator,
    context,
    'local-orchestrator'
  );

  console.log(`✓ Task delegated successfully`);
  console.log(`  Delegation ID: ${delegationId}\n`);

  // 7. Simulate receiving callbacks (in a real scenario, these would come from the remote orchestrator)
  console.log('Step 3: Simulating task execution...\n');

  // Simulate progress callback after 1 second
  setTimeout(async () => {
    const progressCallback: DelegationCallback = {
      delegationId,
      status: 'in_progress',
      timestamp: new Date(),
      data: { progress: 0.5, message: 'Implementing authentication logic...' },
    };
    await delegator.handleCallback(progressCallback);
  }, 1000);

  // Simulate completion callback after 3 seconds
  setTimeout(async () => {
    const completionCallback: DelegationCallback = {
      delegationId,
      status: 'completed',
      result: {
        success: true,
        timestamp: new Date(),
        sessionId: 'session-123',
        metadata: {
          filesCreated: ['auth.controller.ts', 'auth.service.ts', 'auth.test.ts'],
          linesOfCode: 250,
          metrics: {
            duration: 3000,
            tokensUsed: 1500,
            tasksCompleted: 1,
          },
        },
      },
      timestamp: new Date(),
    };
    await delegator.handleCallback(completionCallback);

    // 8. Check final status
    console.log('\nStep 4: Checking final status...');
    const finalDelegation = await delegator.getDelegationStatus(delegationId);
    console.log(`Status: ${finalDelegation?.status}`);
    console.log(`Result: ${JSON.stringify(finalDelegation?.result, null, 2)}\n`);

    // 9. Cleanup
    await delegator.shutdown();
    console.log('✓ Delegator shutdown complete');
  }, 3000);
}

// Advanced example: Handling delegation failures and retries
async function failureExample() {
  console.log('\n=== Failure and Retry Example ===\n');

  const tracker = new InMemoryDelegationTracker();
  const delegator = new TaskDelegator(tracker, {
    defaultTimeout: 10000,
    maxRetries: 2,
    retryDelay: 2000,
    backoffMultiplier: 2,
  });

  const task: Task = {
    id: 'task-002',
    type: 'research',
    description: 'Analyze ML model performance',
    priority: 'critical',
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const orchestrator: OrchestratorInfo = {
    id: 'orch-ml',
    name: 'ML Orchestrator',
    tier: 3,
    capabilities: ['research', 'analysis'],
    currentLoad: 5,
    maxLoad: 10,
    available: true,
    lastSeen: new Date(),
  };

  // Listen for retry events
  delegator.on('delegation:retried', ({ retryCount }) => {
    console.log(`Retry attempt ${retryCount}...`);
  });

  const delegationId = await delegator.delegate(task, orchestrator, {}, 'local');

  // Simulate a failure
  setTimeout(async () => {
    const failureCallback: DelegationCallback = {
      delegationId,
      status: 'failed',
      result: {
        success: false,
        error: 'Out of memory error',
        timestamp: new Date(),
      },
      timestamp: new Date(),
    };
    await delegator.handleCallback(failureCallback);
    console.log('Task failed, automatic retry triggered\n');
  }, 1000);

  // Give time for retries
  setTimeout(async () => {
    await delegator.shutdown();
  }, 10000);
}

// Example: Cancelling a delegation
async function cancellationExample() {
  console.log('\n=== Cancellation Example ===\n');

  const tracker = new InMemoryDelegationTracker();
  const delegator = new TaskDelegator(tracker);

  const task: Task = {
    id: 'task-003',
    type: 'code',
    description: 'Refactor legacy code',
    priority: 'low',
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const orchestrator: OrchestratorInfo = {
    id: 'orch-backend',
    name: 'Backend Orchestrator',
    tier: 2,
    capabilities: ['code'],
    currentLoad: 5,
    maxLoad: 10,
    available: true,
    lastSeen: new Date(),
  };

  const delegationId = await delegator.delegate(task, orchestrator, {}, 'local');
  console.log(`Task delegated: ${delegationId}`);

  // Cancel after 1 second
  setTimeout(async () => {
    await delegator.cancelDelegation(delegationId);
    console.log('✓ Delegation cancelled successfully');

    const delegation = await delegator.getDelegationStatus(delegationId);
    console.log(`Final status: ${delegation?.status}\n`);

    await delegator.shutdown();
  }, 1000);
}

// Run examples
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n--- Running additional examples in 5 seconds ---');
      setTimeout(() => {
        failureExample().catch(console.error);
      }, 5000);
      setTimeout(() => {
        cancellationExample().catch(console.error);
      }, 15000);
    })
    .catch(console.error);
}

export { main, failureExample, cancellationExample };
