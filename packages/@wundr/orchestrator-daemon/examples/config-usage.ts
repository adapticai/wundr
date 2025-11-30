/**
 * Configuration Usage Example
 *
 * Demonstrates how to use the configuration system in the orchestrator-daemon.
 */

import {
  getConfig,
  validateRequiredEnv,
  loadConfig,
  resetConfig,
} from '../src/config';

/**
 * Example 1: Basic usage with singleton
 */
function example1_basicUsage() {
  console.log('\n=== Example 1: Basic Usage ===\n');

  try {
    // Get configuration (lazy-loaded singleton)
    const config = getConfig();

    console.log('Daemon Configuration:');
    console.log(`  Name: ${config.daemon.name}`);
    console.log(`  Host: ${config.daemon.host}`);
    console.log(`  Port: ${config.daemon.port}`);
    console.log(`  Max Sessions: ${config.daemon.maxSessions}`);
    console.log(`  Verbose: ${config.daemon.verbose}`);

    console.log('\nOpenAI Configuration:');
    console.log(`  Model: ${config.openai.model}`);
    console.log(`  API Key: ${config.openai.apiKey.substring(0, 10)}...`);

    console.log('\nMonitoring:');
    console.log(`  Metrics Enabled: ${config.monitoring.metrics.enabled}`);
    console.log(`  Metrics Port: ${config.monitoring.metrics.port}`);
  } catch (error) {
    console.error('Configuration Error:', error instanceof Error ? error.message : error);
  }
}

/**
 * Example 2: Validating required environment variables early
 */
function example2_earlyValidation() {
  console.log('\n=== Example 2: Early Validation ===\n');

  try {
    // Validate required environment variables before loading full config
    validateRequiredEnv();
    console.log('✓ All required environment variables are set');
  } catch (error) {
    console.error('✗ Missing required environment variables:');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Example 3: Loading fresh configuration
 */
function example3_freshLoad() {
  console.log('\n=== Example 3: Fresh Load ===\n');

  try {
    // Load configuration fresh (not cached)
    const config = loadConfig();

    console.log('Configuration loaded successfully');
    console.log(`Environment: ${config.env}`);
    console.log(`Debug Mode: ${config.debug}`);
  } catch (error) {
    console.error('Configuration Error:', error instanceof Error ? error.message : error);
  }
}

/**
 * Example 4: Conditional feature usage
 */
function example4_conditionalFeatures() {
  console.log('\n=== Example 4: Conditional Features ===\n');

  const config = getConfig();

  // Check for Redis (distributed mode)
  if (config.redis) {
    console.log('✓ Distributed mode enabled');
    console.log(`  Redis URL: ${config.redis.url}`);
    console.log(`  Redis DB: ${config.redis.db}`);
    // Initialize Redis connection...
  } else {
    console.log('ℹ Standalone mode (no Redis configured)');
  }

  // Check for database persistence
  if (config.database) {
    console.log('✓ Database persistence enabled');
    console.log(`  Database URL: ${config.database.url?.substring(0, 30)}...`);
    // Initialize database connection...
  } else {
    console.log('ℹ In-memory storage (no database configured)');
  }

  // Check for Neolith integration
  if (config.neolith?.apiUrl) {
    console.log('✓ Neolith integration enabled');
    console.log(`  API URL: ${config.neolith.apiUrl}`);
    // Initialize Neolith client...
  } else {
    console.log('ℹ Neolith integration not configured');
  }

  // Check for Anthropic
  if (config.anthropic?.apiKey) {
    console.log('✓ Anthropic API configured');
    console.log(`  Model: ${config.anthropic.model}`);
  } else {
    console.log('ℹ Anthropic API not configured');
  }
}

/**
 * Example 5: Security configuration
 */
function example5_securityConfig() {
  console.log('\n=== Example 5: Security Configuration ===\n');

  const config = getConfig();

  console.log('Security Settings:');
  console.log(`  JWT Secret Length: ${config.security.jwtSecret.length} characters`);
  console.log(`  JWT Expiration: ${config.security.jwtExpiration}`);
  console.log(`  CORS Enabled: ${config.security.cors.enabled}`);
  if (config.security.cors.enabled) {
    console.log(`  CORS Origins: ${config.security.cors.origins.join(', ')}`);
  }
  console.log(`  Rate Limiting: ${config.security.rateLimit.enabled}`);
  if (config.security.rateLimit.enabled) {
    console.log(`    Max Requests: ${config.security.rateLimit.max} per ${config.security.rateLimit.windowMs}ms`);
  }
}

/**
 * Example 6: Memory and budget configuration
 */
function example6_memoryAndBudget() {
  console.log('\n=== Example 6: Memory and Budget Configuration ===\n');

  const config = getConfig();

  console.log('Memory Management:');
  console.log(`  Max Heap: ${config.memory.maxHeapMB}MB`);
  console.log(`  Max Context Tokens: ${config.memory.maxContextTokens.toLocaleString()}`);
  console.log(`  Compaction Enabled: ${config.memory.compaction.enabled}`);
  console.log(`  Compaction Threshold: ${(config.memory.compaction.threshold * 100).toFixed(0)}%`);

  console.log('\nToken Budget:');
  console.log(`  Daily: ${config.tokenBudget.daily.toLocaleString()} tokens`);
  console.log(`  Weekly: ${config.tokenBudget.weekly.toLocaleString()} tokens`);
  console.log(`  Monthly: ${config.tokenBudget.monthly.toLocaleString()} tokens`);
  console.log(`  Alert Threshold: ${(config.tokenBudget.alerts.threshold * 100).toFixed(0)}%`);
}

/**
 * Example 7: Using in OrchestratorDaemon initialization
 */
async function example7_daemonInitialization() {
  console.log('\n=== Example 7: Daemon Initialization ===\n');

  try {
    const config = getConfig();

    // Would initialize daemon like this:
    // const daemon = new OrchestratorDaemon({
    //   name: config.daemon.name,
    //   port: config.daemon.port,
    //   host: config.daemon.host,
    //   maxSessions: config.daemon.maxSessions,
    //   heartbeatInterval: config.health.heartbeatInterval,
    //   shutdownTimeout: config.health.shutdownTimeout,
    //   verbose: config.daemon.verbose,
    // });

    console.log('Daemon would be initialized with:');
    console.log(`  ${config.daemon.host}:${config.daemon.port}`);
    console.log(`  Max ${config.daemon.maxSessions} sessions`);
    console.log(`  Heartbeat every ${config.health.heartbeatInterval}ms`);
    console.log(`  ${config.daemon.verbose ? 'Verbose' : 'Normal'} logging`);
  } catch (error) {
    console.error('Initialization Error:', error instanceof Error ? error.message : error);
  }
}

/**
 * Example 8: Testing with resetConfig
 */
function example8_testingUsage() {
  console.log('\n=== Example 8: Testing Usage ===\n');

  // In tests, you might want to reset config between tests
  console.log('Resetting config for testing...');
  resetConfig();

  // Override environment for test
  process.env.DAEMON_PORT = '9999';
  process.env.DAEMON_VERBOSE = 'true';

  const testConfig = getConfig();
  console.log(`Test config port: ${testConfig.daemon.port}`);
  console.log(`Test config verbose: ${testConfig.daemon.verbose}`);

  // Clean up
  resetConfig();
}

/**
 * Main execution
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Orchestrator Daemon Configuration Usage Examples       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Run all examples
  example2_earlyValidation();
  example1_basicUsage();
  example3_freshLoad();
  example4_conditionalFeatures();
  example5_securityConfig();
  example6_memoryAndBudget();
  await example7_daemonInitialization();
  example8_testingUsage();

  console.log('\n✓ All examples completed\n');
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export {
  example1_basicUsage,
  example2_earlyValidation,
  example3_freshLoad,
  example4_conditionalFeatures,
  example5_securityConfig,
  example6_memoryAndBudget,
  example7_daemonInitialization,
  example8_testingUsage,
};
