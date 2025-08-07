import { FullConfig } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function globalTeardown(config: FullConfig) {
  console.log('🛑 Starting E2E test teardown...');
  
  try {
    // Clean up test data
    console.log('🧹 Cleaning up test data...');
    await cleanupTestData();
    
    // Stop any running services
    console.log('🔌 Stopping test services...');
    await stopTestServices();
    
    // Archive test results if needed
    console.log('📋 Archiving test results...');
    await archiveTestResults();
    
    console.log('✅ E2E test teardown completed successfully');
  } catch (error) {
    console.error('❌ E2E test teardown failed:', error);
  }
}

async function cleanupTestData() {
  // Clean up any test-specific files
  const testFiles = [
    './test-output/*',
    './e2e-test-data/*',
    './.temp-test-files/*'
  ];
  
  for (const pattern of testFiles) {
    try {
      await execAsync(`rm -rf ${pattern}`);
    } catch {
      // Ignore errors - files might not exist
    }
  }
}

async function stopTestServices() {
  // Stop any test-specific services that might be running
  // This could include test databases, mock servers, etc.
  
  try {
    // Kill any remaining Node processes that might be running
    await execAsync('pkill -f "node.*test" || true');
  } catch {
    // Ignore errors - processes might not exist
  }
}

async function archiveTestResults() {
  // Archive test results for CI/CD systems
  if (process.env.CI) {
    try {
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      await execAsync(`mkdir -p ./test-archives`);
      await execAsync(`cp -r ./test-results ./test-archives/results-${timestamp}`);
    } catch (error) {
      console.warn('Could not archive test results:', error);
    }
  }
}

export default globalTeardown;