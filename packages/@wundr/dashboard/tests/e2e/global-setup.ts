import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting Global E2E Test Setup');
  
  // Start browser for setup
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Wait for the application to be ready
  try {
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="dashboard-ready"]', { timeout: 30000 });
    console.log('✅ Application is ready for testing');
  } catch (error) {
    console.warn('⚠️  Application not fully ready, continuing with tests');
  }

  // Setup test data or authentication if needed
  // This is where you'd setup test users, seed data, etc.

  await browser.close();
  console.log('✅ Global setup completed');
}

export default globalSetup;