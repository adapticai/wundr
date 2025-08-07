import { FullConfig } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E test setup...');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.CI = 'true';
  
  try {
    // Build the project if not in CI
    if (!process.env.CI) {
      console.log('📦 Building project for E2E tests...');
      await execAsync('npm run build');
    }
    
    // Clean up any existing test data
    console.log('🧹 Cleaning up test environment...');
    await cleanupTestEnvironment();
    
    // Initialize test database or other setup
    console.log('🗄️ Setting up test database...');
    await setupTestDatabase();
    
    console.log('✅ E2E test setup completed successfully');
  } catch (error) {
    console.error('❌ E2E test setup failed:', error);
    process.exit(1);
  }
}

async function cleanupTestEnvironment() {
  // Clean up any test files or directories
  const testDirs = [
    './test-output',
    './e2e-test-data',
    './.temp-test-files'
  ];
  
  for (const dir of testDirs) {
    try {
      await execAsync(`rm -rf ${dir}`);
    } catch {
      // Ignore errors - directory might not exist
    }
  }
}

async function setupTestDatabase() {
  // Set up test database or mock data
  // This could include seeding test data, creating test users, etc.
  
  // For now, just ensure required directories exist
  const requiredDirs = [
    './test-output',
    './e2e-test-data'
  ];
  
  for (const dir of requiredDirs) {
    try {
      await execAsync(`mkdir -p ${dir}`);
    } catch (error) {
      console.warn(`Could not create directory ${dir}:`, error);
    }
  }
}

export default globalSetup;