/**
 * Charter Usage Examples
 *
 * Demonstrates how to load, validate, and use orchestrator charters
 */

import { loadCharter, getDefaultCharter, saveCharter } from '../src/charter';

async function main() {
  console.log('=== Orchestrator Charter Examples ===\n');

  // Example 1: Get default charter
  console.log('1. Getting default charter...');
  const defaultCharter = getDefaultCharter();
  console.log(`   Name: ${defaultCharter.name}`);
  console.log(`   Tier: ${defaultCharter.tier}`);
  console.log(`   Max Sessions: ${defaultCharter.resourceLimits.maxSessions}`);
  console.log(`   Model: ${defaultCharter.operationalSettings.defaultModel}\n`);

  // Example 2: Load charter from template
  console.log('2. Loading charter from template...');
  const templatePath = './templates/orchestrator-charter.yaml';
  try {
    const charter = await loadCharter(templatePath, { useEnvOverrides: false });
    console.log(`   Loaded: ${charter.identity.name}`);
    console.log(`   Capabilities: ${charter.capabilities.length} capabilities`);
    console.log(
      `   Responsibilities: ${charter.responsibilities.length} responsibilities\n`
    );
  } catch (error) {
    console.log(
      `   Note: Using defaults (template can be found at: ${templatePath})\n`
    );
  }

  // Example 3: Create and save a custom charter
  console.log('3. Creating custom charter...');
  const customCharter = {
    ...defaultCharter,
    name: 'code-review-orchestrator',
    tier: 2,
    identity: {
      name: 'Code Review Specialist',
      description: 'Specialized orchestrator for code review tasks',
      personality: 'Detail-oriented, constructive, and thorough',
    },
    capabilities: ['code_review', 'static_analysis', 'documentation'],
    responsibilities: [
      'review_pull_requests',
      'suggest_improvements',
      'ensure_standards',
    ],
    resourceLimits: {
      ...defaultCharter.resourceLimits,
      maxSessions: 5,
      maxConcurrentTasks: 3,
    },
  };

  console.log(`   Created: ${customCharter.identity.name}`);
  console.log(`   Tier: ${customCharter.tier}`);
  console.log(`   Max Sessions: ${customCharter.resourceLimits.maxSessions}\n`);

  // Example 4: Apply environment variable overrides
  console.log('4. Testing environment variable overrides...');
  process.env.ORCHESTRATOR_NAME = 'env-override-test';
  process.env.ORCHESTRATOR_MAX_SESSIONS = '15';
  process.env.ORCHESTRATOR_MODEL = 'gpt-4o';

  const charterWithEnv = await loadCharter(undefined, {
    useEnvOverrides: true,
  });
  console.log(`   Name (from env): ${charterWithEnv.name}`);
  console.log(
    `   Max Sessions (from env): ${charterWithEnv.resourceLimits.maxSessions}`
  );
  console.log(
    `   Model (from env): ${charterWithEnv.operationalSettings.defaultModel}\n`
  );

  // Clean up env vars
  delete process.env.ORCHESTRATOR_NAME;
  delete process.env.ORCHESTRATOR_MAX_SESSIONS;
  delete process.env.ORCHESTRATOR_MODEL;

  // Example 5: Demonstrate safety heuristics
  console.log('5. Safety heuristics example...');
  console.log(
    `   Auto-approve rules: ${defaultCharter.safetyHeuristics.autoApprove.length}`
  );
  console.log(
    `   Require confirmation: ${defaultCharter.safetyHeuristics.requireConfirmation.length}`
  );
  console.log(
    `   Always reject: ${defaultCharter.safetyHeuristics.alwaysReject.length}`
  );
  console.log(
    `   Escalate: ${defaultCharter.safetyHeuristics.escalate.length}\n`
  );

  // Example 6: Token budget management
  console.log('6. Token budget configuration...');
  console.log(
    `   Hourly budget: ${defaultCharter.resourceLimits.tokenBudget.hourly.toLocaleString()} tokens`
  );
  console.log(
    `   Daily budget: ${defaultCharter.resourceLimits.tokenBudget.daily.toLocaleString()} tokens`
  );
  console.log(
    `   Per session: ${defaultCharter.resourceLimits.maxTokensPerSession.toLocaleString()} tokens\n`
  );

  console.log('✅ All examples completed successfully!');
}

// Run examples
main().catch(error => {
  console.error('Error running examples:', error);
  process.exit(1);
});
