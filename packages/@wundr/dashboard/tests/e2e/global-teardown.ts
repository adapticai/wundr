import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting Global E2E Test Teardown');
  
  // Clean up any test data, stop services, etc.
  // This is where you'd cleanup test users, remove test data, etc.
  
  console.log('✅ Global teardown completed');
}

export default globalTeardown;