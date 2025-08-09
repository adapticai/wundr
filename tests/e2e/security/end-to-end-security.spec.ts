import { test, expect, Page, BrowserContext } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';

const execAsync = promisify(exec);

test.describe('End-to-End Security and Compliance Tests', () => {
  let page: Page;
  let context: BrowserContext;
  let tempDir: string;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext({
      // Security headers for testing
      extraHTTPHeaders: {
        'X-Test-Security': 'enabled'
      }
    });
    page = await context.newPage();
    
    // Create temporary directory for security tests
    tempDir = path.join(process.cwd(), 'temp-security-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
  });

  test.afterEach(async () => {
    await context.close();
    
    // Secure cleanup - overwrite sensitive files before deletion
    try {
      const files = await fs.readdir(tempDir, { recursive: true, withFileTypes: true });
      for (const file of files) {
        if (file.isFile()) {
          const filePath = path.join(file.path, file.name);
          const stats = await fs.stat(filePath);
          // Overwrite with random data
          await fs.writeFile(filePath, crypto.randomBytes(stats.size));
        }
      }
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test.describe('Authentication and Authorization Security', () => {
    test('should enforce secure authentication flow', async () => {
      // 1. Test login form security
      await page.goto('/dashboard/login');
      
      // Verify secure form attributes
      const passwordInput = page.locator('input[type="password"]');
      await expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
      
      const loginForm = page.locator('form[action*="/login"]');
      await expect(loginForm).toHaveAttribute('method', 'POST');
      
      // 2. Test invalid login attempts
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'invalid-password');
      await page.click('button[type="submit"]');
      
      // Should not reveal if email exists
      await expect(page.locator('.error-message')).toContainText('Invalid credentials');
      
      // 3. Test rate limiting
      for (let i = 0; i < 6; i++) {
        await page.fill('input[name="password"]', `invalid-${i}`);
        await page.click('button[type="submit"]');
        await page.waitForTimeout(500);
      }
      
      // Should trigger rate limiting
      await expect(page.locator('.rate-limit-error')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('.rate-limit-error')).toContainText('Too many attempts');
    });

    test('should implement secure session management', async () => {
      // 1. Login with valid credentials
      await page.goto('/dashboard/login');
      await page.fill('input[name="email"]', 'admin@example.com');
      await page.fill('input[name="password"]', 'secure-password');
      await page.click('button[type="submit"]');
      
      await expect(page).toHaveURL('/dashboard');
      
      // 2. Verify secure session cookies
      const cookies = await context.cookies();
      const sessionCookie = cookies.find(c => c.name.includes('session'));
      
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie?.secure).toBe(true);
      expect(sessionCookie?.httpOnly).toBe(true);
      expect(sessionCookie?.sameSite).toBe('Strict');
      
      // 3. Test session timeout
      await page.evaluate(() => {
        // Fast-forward time to simulate session timeout
        Date.now = () => Date.now() + 30 * 60 * 1000; // 30 minutes
      });
      
      await page.reload();
      await expect(page).toHaveURL('/dashboard/login');
      await expect(page.locator('.session-expired')).toBeVisible();
    });

    test('should prevent privilege escalation', async () => {
      // 1. Login as regular user
      await loginAsUser(page, 'user@example.com', 'user-password');
      
      // 2. Attempt to access admin-only features
      await page.goto('/dashboard/admin/users');
      await expect(page).toHaveURL('/dashboard/access-denied');
      await expect(page.locator('.access-denied-message')).toContainText('Insufficient privileges');
      
      // 3. Test API endpoint access
      const response = await page.request.get('/api/admin/users');
      expect(response.status()).toBe(403);
      
      // 4. Test client-side permission enforcement
      await page.goto('/dashboard/settings');
      await expect(page.locator('.admin-section')).not.toBeVisible();
    });
  });

  test.describe('Input Validation and XSS Prevention', () => {
    test('should prevent XSS attacks in dashboard inputs', async () => {
      await loginAsAdmin(page);
      
      // 1. Test XSS in project name input
      const xssPayload = '<script>alert("XSS")</script>';
      
      await page.goto('/dashboard/projects/new');
      await page.fill('input[name="project-name"]', xssPayload);
      await page.click('button:has-text("Create Project")');
      
      // Verify XSS payload is sanitized
      await expect(page.locator('.project-name-display')).not.toContainText('<script>');
      await expect(page.locator('.project-name-display')).toContainText('&lt;script&gt;');
      
      // 2. Test XSS in file upload analysis
      const maliciousFile = path.join(tempDir, 'malicious.js');
      await fs.writeFile(maliciousFile, 'console.log("<img src=x onerror=alert(1)>");');
      
      await page.goto('/dashboard/upload');
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(maliciousFile);
      await page.click('button:has-text("Upload")');
      
      await page.waitForSelector('.analysis-results', { timeout: 10000 });
      
      // Verify code display is escaped
      const codeDisplay = page.locator('.code-preview');
      await expect(codeDisplay).not.toContainText('<img src=x');
      await expect(codeDisplay).toContainText('&lt;img src=x');
    });

    test('should validate and sanitize CLI command inputs', async () => {
      await createTestProject(tempDir);
      
      // 1. Test command injection in path parameter
      const maliciousPath = `${tempDir}; rm -rf /tmp/test-data; echo "injected"`;
      
      try {
        await execAsync(`node ./bin/wundr.js analyze --path "${maliciousPath}"`);
      } catch (error: any) {
        expect(error.stderr).toContain('Invalid path');
        expect(error.code).toBe(1);
      }
      
      // 2. Test SQL injection in filter parameters
      const sqlInjection = "'; DROP TABLE files; --";
      
      try {
        await execAsync(`node ./bin/wundr.js analyze --filter "${sqlInjection}" --path ${tempDir}`);
      } catch (error: any) {
        expect(error.stderr).toContain('Invalid filter');
      }
      
      // 3. Verify legitimate paths still work
      const { stdout } = await execAsync(`node ./bin/wundr.js analyze --path "${tempDir}"`);
      expect(stdout).toContain('Analysis complete');
    });

    test('should prevent path traversal attacks', async () => {
      await loginAsAdmin(page);
      
      // 1. Test path traversal in file viewer
      await page.goto('/dashboard/files');
      
      // Attempt to access files outside project directory
      const pathTraversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '....//....//....//etc/passwd'
      ];
      
      for (const maliciousPath of pathTraversalAttempts) {
        const response = await page.request.get(`/api/files/view?path=${encodeURIComponent(maliciousPath)}`);
        expect(response.status()).toBe(400);
        
        const body = await response.text();
        expect(body).toContain('Invalid path');
      }
    });
  });

  test.describe('Data Protection and Privacy', () => {
    test('should encrypt sensitive data in storage', async () => {
      await loginAsAdmin(page);
      
      // 1. Store sensitive configuration
      await page.goto('/dashboard/settings/credentials');
      await page.fill('input[name="api-key"]', 'sensitive-api-key-12345');
      await page.fill('input[name="database-url"]', 'postgres://user:pass@localhost:5432/db');
      await page.click('button:has-text("Save Credentials")');
      
      await expect(page.locator('.credentials-saved')).toBeVisible();
      
      // 2. Verify data is encrypted in storage
      const storageData = await page.evaluate(() => localStorage.getItem('wundr-credentials'));
      expect(storageData).toBeDefined();
      expect(storageData).not.toContain('sensitive-api-key-12345');
      expect(storageData).not.toContain('postgres://user:pass');
      
      // 3. Verify credentials are properly decrypted when loaded
      await page.reload();
      await page.goto('/dashboard/settings/credentials');
      
      const apiKeyValue = await page.locator('input[name="api-key"]').inputValue();
      expect(apiKeyValue).toBe('sensitive-api-key-12345');
    });

    test('should implement secure credential lifecycle in CLI', async () => {
      // 1. Set credentials via CLI
      const credentialFile = path.join(tempDir, 'credentials.env');
      await fs.writeFile(credentialFile, 'API_KEY=secret-key-123\nDB_PASSWORD=super-secret');
      
      const { stdout } = await execAsync(
        `node ./bin/wundr.js config set-credentials --file ${credentialFile}`
      );
      
      expect(stdout).toContain('Credentials stored securely');
      
      // 2. Verify credentials are encrypted on disk
      const configDir = path.join(process.cwd(), '.wundr');
      const credentialsFile = path.join(configDir, 'credentials.enc');
      
      if (await fs.access(credentialsFile).then(() => true).catch(() => false)) {
        const encryptedContent = await fs.readFile(credentialsFile, 'utf-8');
        expect(encryptedContent).not.toContain('secret-key-123');
        expect(encryptedContent).not.toContain('super-secret');
      }
      
      // 3. Test credential rotation
      const newCredentialFile = path.join(tempDir, 'new-credentials.env');
      await fs.writeFile(newCredentialFile, 'API_KEY=rotated-key-456\nDB_PASSWORD=new-password');
      
      const { stdout: rotateOutput } = await execAsync(
        `node ./bin/wundr.js config rotate-credentials --file ${newCredentialFile}`
      );
      
      expect(rotateOutput).toContain('Credentials rotated successfully');
      
      // 4. Test credential deletion
      const { stdout: deleteOutput } = await execAsync(
        `node ./bin/wundr.js config delete-credentials --confirm`
      );
      
      expect(deleteOutput).toContain('Credentials deleted securely');
    });

    test('should handle GDPR data subject requests', async () => {
      await loginAsAdmin(page);
      
      // 1. Create user data for testing
      await page.goto('/dashboard/admin/users');
      await page.click('button:has-text("Add User")');
      await page.fill('input[name="email"]', 'gdpr-test@example.com');
      await page.fill('input[name="name"]', 'GDPR Test User');
      await page.click('button:has-text("Create User")');
      
      // 2. Test data export (Right to Portability)
      await page.click('.user-item:has-text("gdpr-test@example.com") .actions-menu');
      await page.click('button:has-text("Export Data")');
      
      const download = await page.waitForEvent('download');
      const exportPath = path.join(tempDir, 'user-data-export.json');
      await download.saveAs(exportPath);
      
      const exportData = JSON.parse(await fs.readFile(exportPath, 'utf-8'));
      expect(exportData.email).toBe('gdpr-test@example.com');
      expect(exportData.name).toBe('GDPR Test User');
      
      // 3. Test data deletion (Right to Erasure)
      await page.click('.user-item:has-text("gdpr-test@example.com") .actions-menu');
      await page.click('button:has-text("Delete User Data")');
      await page.fill('input[name="confirmation"]', 'DELETE');
      await page.click('button:has-text("Confirm Deletion")');
      
      await expect(page.locator('.deletion-complete')).toBeVisible();
      
      // 4. Verify data is actually removed
      await page.reload();
      await expect(page.locator('.user-item:has-text("gdpr-test@example.com")')).not.toBeVisible();
    });
  });

  test.describe('Network Security and Transport Layer', () => {
    test('should enforce HTTPS and secure headers', async () => {
      // 1. Test security headers
      const response = await page.goto('/dashboard');
      const headers = response?.headers();
      
      expect(headers?.['strict-transport-security']).toContain('max-age=');
      expect(headers?.['x-content-type-options']).toBe('nosniff');
      expect(headers?.['x-frame-options']).toBe('DENY');
      expect(headers?.['x-xss-protection']).toBe('1; mode=block');
      expect(headers?.['content-security-policy']).toBeDefined();
      
      // 2. Test CSP policy effectiveness
      await page.addInitScript(() => {
        window.cspViolations = [];
        document.addEventListener('securitypolicyviolation', (e) => {
          (window as any).cspViolations.push({
            directive: e.violatedDirective,
            blocked: e.blockedURI
          });
        });
      });
      
      // Attempt to inject inline script (should be blocked by CSP)
      await page.evaluate(() => {
        const script = document.createElement('script');
        script.innerHTML = 'console.log("CSP bypass attempt")';
        document.head.appendChild(script);
      });
      
      const violations = await page.evaluate(() => (window as any).cspViolations);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].directive).toContain('script-src');
    });

    test('should validate SSL/TLS configuration', async () => {
      // 1. Test secure WebSocket connections
      await loginAsAdmin(page);
      await page.goto('/dashboard/monitoring');
      
      // Start real-time monitoring
      await page.click('button:has-text("Start Real-time Monitor")');
      
      // 2. Verify WebSocket uses secure protocol
      const wsConnections = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('*')).map(el => 
          (el as any).src || (el as any).href
        ).filter(url => url && url.startsWith('wss://'));
      });
      
      expect(wsConnections.length).toBeGreaterThan(0);
      
      // 3. Test certificate validation
      const response = await page.request.get('/api/health');
      expect(response.ok()).toBe(true);
      
      // Verify no mixed content warnings
      const consoleLogs = [];
      page.on('console', msg => {
        if (msg.type() === 'warning' && msg.text().includes('mixed content')) {
          consoleLogs.push(msg.text());
        }
      });
      
      await page.reload();
      expect(consoleLogs).toHaveLength(0);
    });
  });

  test.describe('Compliance and Audit Features', () => {
    test('should generate security audit reports', async () => {
      await loginAsAdmin(page);
      
      // 1. Navigate to audit section
      await page.goto('/dashboard/security/audit');
      
      // 2. Configure audit parameters
      await page.selectOption('select[name="audit-scope"]', 'comprehensive');
      await page.check('input[name="include-authentication"]');
      await page.check('input[name="include-authorization"]');
      await page.check('input[name="include-data-protection"]');
      
      // 3. Start security audit
      await page.click('button:has-text("Start Security Audit")');
      
      // 4. Wait for audit completion
      await expect(page.locator('.audit-progress')).toBeVisible();
      await expect(page.locator('.audit-complete')).toBeVisible({ timeout: 30000 });
      
      // 5. Verify audit results
      await expect(page.locator('.audit-summary')).toBeVisible();
      await expect(page.locator('.security-score')).toContainText(/\d+/);
      
      const securityItems = await page.locator('.security-check-item').count();
      expect(securityItems).toBeGreaterThan(10);
      
      // 6. Export audit report
      await page.click('button:has-text("Export Audit Report")');
      
      const download = await page.waitForEvent('download');
      const auditPath = path.join(tempDir, 'security-audit.json');
      await download.saveAs(auditPath);
      
      const auditData = JSON.parse(await fs.readFile(auditPath, 'utf-8'));
      expect(auditData).toHaveProperty('timestamp');
      expect(auditData).toHaveProperty('securityScore');
      expect(auditData).toHaveProperty('vulnerabilities');
      expect(auditData.vulnerabilities).toBeInstanceOf(Array);
    });

    test('should track and log security events', async () => {
      await loginAsAdmin(page);
      
      // 1. Generate various security events
      await page.goto('/dashboard/settings/security');
      await page.click('button:has-text("Change Password")');
      await page.fill('input[name="current-password"]', 'admin-password');
      await page.fill('input[name="new-password"]', 'new-secure-password-123');
      await page.click('button:has-text("Update Password")');
      
      // 2. View security event log
      await page.goto('/dashboard/security/events');
      
      // 3. Verify password change is logged
      await expect(page.locator('.event-item')).toContainText('Password changed');
      await expect(page.locator('.event-timestamp')).toBeVisible();
      
      // 4. Test event filtering
      await page.selectOption('select[name="event-type"]', 'authentication');
      await page.click('button:has-text("Apply Filter")');
      
      const authEvents = await page.locator('.event-item').count();
      expect(authEvents).toBeGreaterThan(0);
      
      // 5. Test event export for compliance
      await page.click('button:has-text("Export Security Log")');
      await page.selectOption('select[name="format"]', 'csv');
      await page.click('button:has-text("Download Log")');
      
      const download = await page.waitForEvent('download');
      const logPath = path.join(tempDir, 'security-events.csv');
      await download.saveAs(logPath);
      
      const logContent = await fs.readFile(logPath, 'utf-8');
      expect(logContent).toContain('timestamp,event_type,user,description');
      expect(logContent).toContain('Password changed');
    });
  });

  // Helper functions
  async function loginAsUser(page: Page, email: string, password: string) {
    await page.goto('/dashboard/login');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
  }

  async function loginAsAdmin(page: Page) {
    await loginAsUser(page, 'admin@example.com', 'admin-secure-password');
  }

  async function createTestProject(dir: string) {
    const files = [
      { path: 'src/index.ts', content: 'export { default } from "./main";' },
      { path: 'src/main.ts', content: 'import { config } from "./config"; export default config;' },
      { path: 'src/config.ts', content: 'export const config = { apiKey: "test-key" };' },
      { path: 'package.json', content: '{"name": "security-test", "version": "1.0.0"}' }
    ];

    for (const file of files) {
      const filePath = path.join(dir, file.path);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, file.content);
    }
  }
});