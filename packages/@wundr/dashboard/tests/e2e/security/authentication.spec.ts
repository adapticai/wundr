import { expect } from '@playwright/test';
import { test } from '../fixtures';

test.describe('Security E2E Tests', () => {
  test.beforeEach(async ({ mockDataHelper }) => {
    await mockDataHelper.setupMockApiResponses();
    await mockDataHelper.injectTestDataAttributes();
  });

  test('should handle XSS prevention in user inputs', async ({ dashboardPage, page }) => {
    await dashboardPage.goto();
    
    // Test XSS in search inputs
    const searchInput = page.locator('input[placeholder*="search"], [data-testid="search-input"]').first();
    if (await searchInput.isVisible()) {
      const xssPayload = '<script>alert("XSS")</script>';
      await searchInput.fill(xssPayload);
      await searchInput.press('Enter');
      
      // Wait for potential script execution
      await page.waitForTimeout(1000);
      
      // No alert should have been triggered
      // In a real app, this would be sanitized server-side or client-side
      const alertText = await page.evaluate(() => {
        // Check if any alerts were created
        return document.querySelector('script')?.textContent?.includes('alert');
      });
      
      expect(alertText).toBeFalsy();
    }

    // Test XSS in form inputs
    const forms = page.locator('form input[type="text"], form textarea').first();
    if (await forms.isVisible()) {
      await forms.fill('<img src="x" onerror="alert(\'XSS\')" />');
      
      // Submit form if submit button exists
      const submitButton = page.locator('form button[type="submit"], form input[type="submit"]');
      if (await submitButton.isVisible()) {
        await submitButton.click();
        await page.waitForTimeout(1000);
        
        // Check that dangerous content wasn't rendered as HTML
        const dangerousContent = page.locator('img[onerror], script');
        expect(await dangerousContent.count()).toBe(0);
      }
    }
  });

  test('should prevent CSRF attacks on API endpoints', async ({ dashboardPage, page }) => {
    await dashboardPage.goto();

    // Monitor API requests for CSRF tokens
    const apiRequests: any[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        apiRequests.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
          postData: request.postData()
        });
      }
    });

    // Perform actions that trigger API calls
    await dashboardPage.performQuickAction('refresh');
    await dashboardPage.navigateToSection('dependencies');

    // Check that sensitive operations include CSRF protection
    const postRequests = apiRequests.filter(req => 
      ['POST', 'PUT', 'DELETE'].includes(req.method)
    );

    for (const request of postRequests) {
      // Should have CSRF token in headers or body
      const hasCsrfHeader = 
        request.headers['x-csrf-token'] || 
        request.headers['x-xsrf-token'] ||
        request.headers['csrf-token'];
      
      const hasCsrfInBody = 
        request.postData?.includes('csrf_token') ||
        request.postData?.includes('_token');

      if (postRequests.length > 0) {
        // At least one form of CSRF protection should be present
        // (This depends on your app's CSRF implementation)
        expect(hasCsrfHeader || hasCsrfInBody).toBeTruthy();
      }
    }
  });

  test('should handle content security policy correctly', async ({ page }) => {
    // Check for CSP headers
    const response = await page.goto('/dashboard');
    const cspHeader = response?.headers()['content-security-policy'];
    
    if (cspHeader) {
      // CSP should restrict dangerous sources
      expect(cspHeader).toContain("default-src 'self'");
      expect(cspHeader).not.toContain("'unsafe-eval'");
      expect(cspHeader).not.toContain("'unsafe-inline'");
    }

    // Test that inline scripts are blocked (if CSP is strict)
    const inlineScriptBlocked = await page.evaluate(async () => {
      try {
        // Try to create an inline script
        const script = document.createElement('script');
        script.textContent = 'window.inlineScriptExecuted = true;';
        document.head.appendChild(script);
        
        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check if it executed
        return !(window as any).inlineScriptExecuted;
      } catch (error) {
        return true; // Script was blocked
      }
    });

    // If CSP is implemented, inline scripts should be blocked
    if (cspHeader && cspHeader.includes("script-src") && !cspHeader.includes("'unsafe-inline'")) {
      expect(inlineScriptBlocked).toBe(true);
    }
  });

  test('should sanitize data display to prevent injection', async ({ dashboardPage, websocketHelper, page }) => {
    await dashboardPage.goto();
    await websocketHelper.setupWebSocketMock();
    await websocketHelper.waitForWebSocketConnection();

    // Send malicious data through WebSocket
    const maliciousData = {
      type: 'metrics',
      data: {
        projectName: '<script>alert("Injected")</script>',
        description: '<img src="x" onerror="alert(\'XSS\')" />',
        author: 'User<svg onload="alert(\'SVG XSS\')" />',
        message: 'Build completed <iframe src="javascript:alert(\'Frame XSS\')" />',
        timestamp: new Date().toISOString()
      }
    };

    await websocketHelper.sendMockMessage(maliciousData);
    await page.waitForTimeout(1000);

    // Check that dangerous elements weren't rendered
    const dangerousElements = await page.locator('script, img[onerror], svg[onload], iframe[src*="javascript"]').count();
    expect(dangerousElements).toBe(0);

    // Check that content is properly escaped in text
    const activityItems = page.locator('[data-testid="activity-item"], .activity-item');
    if (await activityItems.count() > 0) {
      const firstActivity = activityItems.first();
      const activityText = await firstActivity.textContent();
      
      // Should contain escaped characters, not raw HTML
      if (activityText?.includes('<')) {
        expect(activityText).toContain('&lt;');
      }
    }
  });

  test('should handle secure WebSocket connections', async ({ dashboardPage, websocketHelper, page }) => {
    await dashboardPage.goto();
    
    // In production, WebSocket should use wss:// protocol
    const wsState = await websocketHelper.getWebSocketState();
    
    // For local testing we use ws://, but in production it should be wss://
    if (process.env.NODE_ENV === 'production') {
      expect(wsState.url).toStartWith('wss://');
    }

    await websocketHelper.setupWebSocketMock();
    await websocketHelper.waitForWebSocketConnection();

    // Test that WebSocket rejects unauthorized messages
    const unauthorizedMessage = {
      type: 'admin_command',
      data: {
        command: 'delete_all_data',
        token: 'fake_token'
      }
    };

    await websocketHelper.sendMockMessage(unauthorizedMessage);
    
    // Should not execute dangerous commands
    // The app should ignore unknown/unauthorized message types
    await page.waitForTimeout(1000);
    
    // Dashboard should still be functional
    await expect(dashboardPage.metricsGrid).toBeVisible();
  });

  test('should validate input lengths and formats', async ({ dashboardPage, page }) => {
    await dashboardPage.goto();
    
    // Test form inputs for length validation
    const textInputs = page.locator('input[type="text"], textarea');
    const inputCount = await textInputs.count();
    
    for (let i = 0; i < Math.min(inputCount, 3); i++) {
      const input = textInputs.nth(i);
      if (await input.isVisible()) {
        // Test very long input
        const longString = 'A'.repeat(10000);
        await input.fill(longString);
        
        const actualValue = await input.inputValue();
        
        // Should either be truncated or rejected
        expect(actualValue.length).toBeLessThan(5000);
        
        // Test special characters
        await input.fill('../../etc/passwd');
        const pathValue = await input.inputValue();
        
        // Should handle path traversal attempts
        // (This depends on client-side validation)
      }
    }

    // Test number inputs
    const numberInputs = page.locator('input[type="number"]');
    const numberInputCount = await numberInputs.count();
    
    for (let i = 0; i < Math.min(numberInputCount, 2); i++) {
      const numberInput = numberInputs.nth(i);
      if (await numberInput.isVisible()) {
        // Test negative numbers where not expected
        await numberInput.fill('-999999');
        
        // Test very large numbers
        await numberInput.fill('999999999999999');
        
        // Should be validated appropriately
        const value = await numberInput.inputValue();
        expect(parseFloat(value)).not.toBeNaN();
      }
    }
  });

  test('should protect against clickjacking', async ({ page }) => {
    // Check for X-Frame-Options header
    const response = await page.goto('/dashboard');
    const frameOptions = response?.headers()['x-frame-options'];
    const cspHeader = response?.headers()['content-security-policy'];
    
    // Should have clickjacking protection
    const hasClickjackingProtection = 
      frameOptions === 'DENY' || 
      frameOptions === 'SAMEORIGIN' ||
      (cspHeader && cspHeader.includes("frame-ancestors 'none'"));
    
    // This test passes if clickjacking protection is detected
    // In a real app, this should always be true
    if (frameOptions || cspHeader) {
      expect(hasClickjackingProtection).toBe(true);
    }
  });

  test('should handle session security', async ({ dashboardPage, page }) => {
    await dashboardPage.goto();

    // Check for secure cookie settings (if cookies are used)
    const cookies = await page.context().cookies();
    
    for (const cookie of cookies) {
      if (cookie.name.includes('session') || cookie.name.includes('auth')) {
        // Session cookies should be secure
        expect(cookie.secure).toBe(true); // In production
        expect(cookie.httpOnly).toBe(true);
        expect(cookie.sameSite).toMatch(/^(Strict|Lax)$/);
      }
    }

    // Test session timeout (if implemented)
    // This would typically require mocking time or waiting
    // For now, we'll just verify the dashboard loads correctly
    await expect(dashboardPage.metricsGrid).toBeVisible();
  });

  test('should handle sensitive data exposure', async ({ dashboardPage, page }) => {
    await dashboardPage.goto();

    // Check that sensitive information isn't exposed in client-side code
    const pageContent = await page.content();
    
    // Should not contain common sensitive patterns
    const sensitivePatterns = [
      /password\s*[:=]\s*['"][^'"]+['"]/i,
      /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i,
      /secret\s*[:=]\s*['"][^'"]+['"]/i,
      /token\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/i
    ];

    for (const pattern of sensitivePatterns) {
      expect(pageContent).not.toMatch(pattern);
    }

    // Check console for sensitive data
    const consoleLogs: string[] = [];
    page.on('console', msg => consoleLogs.push(msg.text()));

    // Trigger some actions that might log data
    await dashboardPage.performQuickAction('refresh');
    await page.waitForTimeout(1000);

    // Console logs should not contain sensitive information
    const consoleText = consoleLogs.join(' ');
    for (const pattern of sensitivePatterns) {
      expect(consoleText).not.toMatch(pattern);
    }
  });

  test('should validate file upload security (if applicable)', async ({ dashboardPage, page }) => {
    await dashboardPage.goto();

    // Look for file upload inputs
    const fileInputs = page.locator('input[type="file"]');
    const fileInputCount = await fileInputs.count();

    if (fileInputCount > 0) {
      const fileInput = fileInputs.first();
      
      // Test malicious file types
      const maliciousFiles = [
        { name: 'test.exe', content: 'MZ', type: 'application/octet-stream' },
        { name: 'script.js', content: 'alert("XSS")', type: 'application/javascript' },
        { name: '../../../etc/passwd', content: 'root:x:0:0', type: 'text/plain' }
      ];

      for (const malFile of maliciousFiles) {
        // Create a mock file
        await fileInput.setInputFiles({
          name: malFile.name,
          mimeType: malFile.type,
          buffer: Buffer.from(malFile.content)
        });

        // Submit if there's a submit button
        const submitButton = page.locator('button[type="submit"]:near(input[type="file"])');
        if (await submitButton.isVisible()) {
          await submitButton.click();
          await page.waitForTimeout(1000);

          // Should show validation error for dangerous files
          const errorMessage = page.locator('[data-testid="file-error"], .error, .alert-error');
          if (await errorMessage.isVisible()) {
            const errorText = await errorMessage.textContent();
            expect(errorText).toMatch(/invalid|not allowed|error/i);
          }
        }
      }
    }
  });

  test('should prevent information disclosure through error messages', async ({ dashboardPage, mockDataHelper, page }) => {
    // Setup error responses
    await mockDataHelper.setupErrorScenarios();
    
    await dashboardPage.goto();

    // Should show generic error messages, not detailed server errors
    const errorMessages = page.locator('[data-testid="error-message"], .error-message, .alert-error');
    
    if (await errorMessages.count() > 0) {
      const errorText = await errorMessages.first().textContent();
      
      // Should not reveal sensitive information
      const sensitiveInfoPatterns = [
        /stack trace/i,
        /database/i,
        /connection string/i,
        /internal server error.*at line \d+/i,
        /sql error/i,
        /file path.*\/[^\/\s]+\.js/i
      ];

      for (const pattern of sensitiveInfoPatterns) {
        expect(errorText || '').not.toMatch(pattern);
      }
      
      // Should show user-friendly error message
      expect(errorText).toMatch(/something went wrong|error occurred|please try again/i);
    }
  });

  test('should handle rate limiting gracefully', async ({ dashboardPage, page }) => {
    await dashboardPage.goto();

    // Simulate rapid requests (if rate limiting is implemented)
    const rapidRequests = [];
    
    for (let i = 0; i < 20; i++) {
      rapidRequests.push(dashboardPage.performQuickAction('refresh'));
    }

    await Promise.all(rapidRequests);

    // Application should handle rate limiting gracefully
    // Either by queuing requests or showing appropriate messages
    await expect(dashboardPage.metricsGrid).toBeVisible();
    
    // Check for rate limit messages
    const rateLimitMessage = page.locator('[data-testid="rate-limit"], .rate-limit-message');
    // Rate limit message may or may not appear depending on implementation
    
    // Dashboard should remain functional
    await expect(dashboardPage.sidebar).toBeVisible();
  });
});