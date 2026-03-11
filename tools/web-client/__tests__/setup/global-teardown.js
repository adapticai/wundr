/**
 * Jest global teardown - runs once after all test suites
 */

const path = require('path');
const fs = require('fs');

module.exports = async () => {
  console.log('🧹 Cleaning up test environment...');

  // Clean up temporary test files
  const tempDir = path.join(process.cwd(), '__tests__/temp');
  if (fs.existsSync(tempDir)) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log('📁 Cleaned up temporary test files');
    } catch (error) {
      console.warn('⚠️  Could not clean up temp directory:', error.message);
    }
  }

  // Generate test summary if running in CI
  if (process.env.CI) {
    console.log('📊 Generating test summary for CI...');
    // Add CI-specific cleanup or reporting here
  }

  // Reset environment variables
  delete process.env.NEXT_PUBLIC_TEST_MODE;

  console.log('✅ Test environment cleanup complete');
};
