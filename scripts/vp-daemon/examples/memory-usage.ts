/**
 * VP-Daemon Memory System Usage Examples
 *
 * Demonstrates common patterns and best practices for using the VP memory system.
 */

import { createMemoryAPI } from '../memory-api';

// ============================================================================
// Example 1: Basic Task Management
// ============================================================================

async function example1_basicTasks() {
  console.log('\n=== Example 1: Basic Task Management ===\n');

  const memory = await createMemoryAPI();

  // Create a task
  await memory.createTask({
    taskId: 'refactor-auth',
    description: 'Refactor authentication module to use JWT',
    priority: 8,
    metadata: {
      module: 'auth',
      type: 'refactor',
      estimatedHours: 16,
    },
  });

  console.log('Task created:', memory.getTask('refactor-auth'));

  // Start the task
  await memory.startTask('refactor-auth', 'slot-1');
  console.log('Task started');

  // Simulate work...

  // Complete the task
  await memory.completeTask('refactor-auth', {
    filesChanged: 23,
    testsAdded: 45,
    success: true,
  });

  console.log('Task completed:', memory.getTask('refactor-auth'));

  await memory.shutdown();
}

// ============================================================================
// Example 2: Decision Recording and Retrieval
// ============================================================================

async function example2_decisions() {
  console.log('\n=== Example 2: Decision Recording ===\n');

  const memory = await createMemoryAPI();

  // Record a series of decisions
  const decisions = [
    {
      action: 'approve_pr',
      rationale: 'All checks passed, 2 approvals',
      outcome: 'approved' as const,
      context: 'PR #123: Add rate limiting',
    },
    {
      action: 'deploy_staging',
      rationale: 'Tests passed, ready for QA',
      outcome: 'approved' as const,
      context: 'Deploy v2.3.0 to staging',
    },
    {
      action: 'deploy_production',
      rationale: 'After hours deployment detected',
      outcome: 'escalated' as const,
      context: 'Deploy v2.3.0 to production',
      escalationTriggers: ['after-hours', 'production'],
    },
  ];

  for (const decision of decisions) {
    await memory.recordDecision({
      sessionId: 'session-1',
      agentId: 'agent-1',
      ...decision,
      policyChecks: {
        'tests-passed': true,
        'approvals-met': true,
      },
    });
  }

  console.log('Recorded', decisions.length, 'decisions');

  // Retrieve recent decisions
  const recent = await memory.getRecentDecisions('agent-1', 5);
  console.log('\nRecent decisions:', recent.length);
  for (const decision of recent) {
    const content = decision.content as any;
    console.log(`  - ${content.action}: ${content.outcome}`);
  }

  await memory.shutdown();
}

// ============================================================================
// Example 3: Policy Management
// ============================================================================

async function example3_policies() {
  console.log('\n=== Example 3: Policy Management ===\n');

  const memory = await createMemoryAPI();

  // Define policies
  const policies = [
    {
      policyId: 'no-force-push',
      name: 'No Force Push',
      rule: 'git push --force is forbidden on protected branches (main, master, develop)',
      examples: [
        {
          description: 'Force push to feature branch',
          outcome: 'pass' as const,
        },
        {
          description: 'Force push to main branch',
          outcome: 'fail' as const,
        },
      ],
    },
    {
      policyId: 'deployment-hours',
      name: 'Deployment Hours',
      rule: 'Production deployments only 9 AM - 5 PM EST on weekdays',
      examples: [
        {
          description: 'Deploy Tuesday 10 AM',
          outcome: 'pass' as const,
        },
        {
          description: 'Deploy Saturday 11 PM',
          outcome: 'fail' as const,
        },
      ],
    },
    {
      policyId: 'require-tests',
      name: 'Require Tests',
      rule: 'All PRs must include tests with >80% coverage',
      examples: [],
    },
  ];

  for (const policy of policies) {
    await memory.addPolicy(policy);
  }

  console.log('Added', policies.length, 'policies');

  // Simulate violations
  await memory.recordViolation('no-force-push');
  await memory.recordViolation('deployment-hours');
  await memory.recordViolation('deployment-hours');

  // Get violated policies
  const violated = memory.getViolatedPolicies();
  console.log('\nPolicies with violations:');
  for (const policy of violated) {
    console.log(
      `  - ${policy.name}: ${policy.violationCount} violation(s)`,
    );
  }

  await memory.shutdown();
}

// ============================================================================
// Example 4: Pattern Learning
// ============================================================================

async function example4_patterns() {
  console.log('\n=== Example 4: Pattern Learning ===\n');

  const memory = await createMemoryAPI();

  // Learn patterns from repeated observations
  await memory.learnPattern({
    patternId: 'npe-user-service',
    name: 'NPE in User Service',
    description: 'Recurring NullPointerException in UserService.getProfile() when session expired',
    confidence: 0.6,
    tags: ['error', 'user-service', 'npe'],
  });

  await memory.learnPattern({
    patternId: 'slow-query-reports',
    name: 'Slow Report Queries',
    description: 'Report generation queries consistently exceed 5s threshold',
    confidence: 0.8,
    tags: ['performance', 'reports', 'database'],
  });

  console.log('Learned 2 patterns');

  // Reinforce patterns when observed again
  await memory.reinforcePattern('npe-user-service');
  await memory.reinforcePattern('npe-user-service');
  await memory.reinforcePattern('slow-query-reports');

  // Get high-confidence patterns
  const highConfidence = memory.getHighConfidencePatterns(0.7);
  console.log('\nHigh-confidence patterns:');
  for (const pattern of highConfidence) {
    console.log(
      `  - ${pattern.name}: ${(pattern.confidence * 100).toFixed(1)}% (${pattern.occurrenceCount} occurrences)`,
    );
  }

  await memory.shutdown();
}

// ============================================================================
// Example 5: Context Compilation
// ============================================================================

async function example5_context() {
  console.log('\n=== Example 5: Context Compilation ===\n');

  const memory = await createMemoryAPI();

  // Set up some state
  await memory.createTask({
    taskId: 'urgent-fix',
    description: 'Fix critical production bug',
    priority: 10,
  });

  await memory.addPolicy({
    policyId: 'critical-approval',
    name: 'Critical Fix Approval',
    rule: 'Critical production fixes require guardian approval',
  });

  await memory.learnPattern({
    patternId: 'prod-hotfix',
    name: 'Production Hotfix Pattern',
    description: 'Standard pattern for emergency production fixes',
    confidence: 0.9,
    tags: ['production', 'hotfix'],
  });

  // Compile context
  const context = await memory.compileVPContext({
    systemPrompt: `You are the Virtual Principal managing production incidents.
Always follow established policies and patterns.`,
    maxTokens: 8000,
  });

  console.log('Context compiled:');
  console.log(`  System prompt tokens: ${context.systemPrompt.length / 4}`);
  console.log(`  Scratchpad entries: ${context.scratchpadEntries.length}`);
  console.log(`  Episodic entries: ${context.episodicEntries.length}`);
  console.log(`  Semantic entries: ${context.semanticEntries.length}`);
  console.log(`  Total tokens: ${context.totalTokens}`);
  console.log(`  Utilization: ${(context.utilization * 100).toFixed(1)}%`);

  await memory.shutdown();
}

// ============================================================================
// Example 6: Memory Search
// ============================================================================

async function example6_search() {
  console.log('\n=== Example 6: Memory Search ===\n');

  const memory = await createMemoryAPI();

  // Create some searchable content
  await memory.createTask({
    taskId: 'deploy-1',
    description: 'Deploy authentication service',
    priority: 8,
  });

  await memory.createTask({
    taskId: 'deploy-2',
    description: 'Deploy user management service',
    priority: 7,
  });

  await memory.createTask({
    taskId: 'refactor-1',
    description: 'Refactor authentication module',
    priority: 5,
  });

  // Search for deployment tasks
  const deployTasks = await memory.searchTasks('deploy', 10);
  console.log('Deploy tasks found:', deployTasks.length);
  for (const task of deployTasks) {
    console.log(`  - ${task.taskId}: ${task.description}`);
  }

  // Complex query
  const results = await memory.search(
    memory
      .query()
      .withQuery('authentication')
      .withTypes('task')
      .limit(5)
      .build(),
  );

  console.log('\nAuthentication-related memories:', results.totalCount);

  await memory.shutdown();
}

// ============================================================================
// Example 7: Memory Maintenance
// ============================================================================

async function example7_maintenance() {
  console.log('\n=== Example 7: Memory Maintenance ===\n');

  const memory = await createMemoryAPI();

  // Check health
  const health = memory.needsMaintenance();
  console.log('Memory health:', health.reason);
  console.log('  Needs consolidation:', health.needsConsolidation);
  console.log('  Needs compaction:', health.needsCompaction);
  console.log('  Needs pruning:', health.needsPruning);

  // Get statistics
  const stats = memory.getStats();
  console.log('\nMemory statistics:');
  console.log('  Total memories:', stats.totalMemories);
  console.log('  Active sessions:', stats.activeSessions);
  console.log(
    '  Scratchpad: ',
    stats.tiers.scratchpad.memoryCount,
    'memories,',
    (stats.tiers.scratchpad.utilization * 100).toFixed(1) + '%',
    'full',
  );
  console.log(
    '  Episodic: ',
    stats.tiers.episodic.memoryCount,
    'memories,',
    (stats.tiers.episodic.utilization * 100).toFixed(1) + '%',
    'full',
  );
  console.log(
    '  Semantic: ',
    stats.tiers.semantic.memoryCount,
    'memories,',
    (stats.tiers.semantic.utilization * 100).toFixed(1) + '%',
    'full',
  );

  // Run maintenance if needed
  if (health.needsConsolidation) {
    console.log('\nRunning consolidation...');
    await memory.consolidate();
  }

  if (health.needsCompaction) {
    console.log('Running compaction...');
    await memory.compact();
  }

  if (health.needsPruning) {
    console.log('Pruning old memories...');
    const result = await memory.pruneOldMemories({
      scratchpadMaxAgeDays: 1,
      episodicMaxAgeDays: 30,
    });
    console.log(`  Pruned: ${result.pruned}, Preserved: ${result.preserved}`);
  }

  // Save to disk
  await memory.save();
  console.log('\nMemory saved to disk');

  await memory.shutdown();
}

// ============================================================================
// Example 8: Session Workflow
// ============================================================================

async function example8_sessionWorkflow() {
  console.log('\n=== Example 8: Complete Session Workflow ===\n');

  const memory = await createMemoryAPI();

  // 1. Session starts
  console.log('1. Starting session...');

  // 2. Triage request comes in
  console.log('2. Processing triage request...');
  await memory.createTask({
    taskId: 'session-task-1',
    description: 'Fix broken user registration',
    priority: 9,
    metadata: {
      source: 'slack',
      sender: 'john@example.com',
    },
  });

  // 3. Task assigned and started
  console.log('3. Task assigned to slot...');
  await memory.startTask('session-task-1', 'slot-1');

  // 4. Agent makes decisions
  console.log('4. Recording decisions...');
  await memory.recordDecision({
    sessionId: 'session-example',
    agentId: 'coder-agent',
    action: 'analyze_logs',
    rationale: 'Need to understand error pattern',
    outcome: 'approved',
    context: 'User registration failures',
  });

  await memory.recordDecision({
    sessionId: 'session-example',
    agentId: 'coder-agent',
    action: 'apply_fix',
    rationale: 'Found missing validation check',
    outcome: 'approved',
    context: 'Add email validation',
  });

  // 5. Check against policies
  console.log('5. Checking policies...');
  const policies = memory.getAllPolicies();
  console.log(`   ${policies.length} policies active`);

  // 6. Complete task
  console.log('6. Completing task...');
  await memory.completeTask('session-task-1', {
    success: true,
    filesChanged: 3,
    linesAdded: 45,
    linesRemoved: 12,
  });

  // 7. Record session
  console.log('7. Recording session...');
  await memory.recordSession({
    sessionId: 'session-example',
    slot: { id: 'slot-1' } as any,
    taskCount: 1,
    decisionsCount: 2,
    escalationsCount: 0,
    summary: 'Successfully fixed user registration validation bug',
  });

  // 8. Get session summary
  console.log('8. Session summary:');
  const summary = await memory.getActiveSummary();
  console.log('   Active tasks:', summary.activeTasks);
  console.log('   Policies:', summary.policies);
  console.log('   Patterns:', summary.patterns);
  console.log(
    '   Memory utilization:',
    (summary.memoryUtilization * 100).toFixed(1) + '%',
  );

  // 9. Save and shutdown
  console.log('9. Saving and shutting down...');
  await memory.save();
  await memory.shutdown();

  console.log('\nSession workflow complete!');
}

// ============================================================================
// Run Examples
// ============================================================================

async function runExamples() {
  console.log('VP-Daemon Memory System Examples');
  console.log('=================================');

  try {
    await example1_basicTasks();
    await example2_decisions();
    await example3_policies();
    await example4_patterns();
    await example5_context();
    await example6_search();
    await example7_maintenance();
    await example8_sessionWorkflow();

    console.log('\n=================================');
    console.log('All examples completed successfully!');
  } catch (error) {
    console.error('\nError running examples:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runExamples().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export {
  example1_basicTasks,
  example2_decisions,
  example3_policies,
  example4_patterns,
  example5_context,
  example6_search,
  example7_maintenance,
  example8_sessionWorkflow,
};
