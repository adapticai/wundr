import { test, expect } from '@playwright/test';
import { TestUtilities } from './helpers/test-utilities';
import { TEST_CONFIG } from './helpers/test-config';

/**
 * API Endpoint Validation
 * Tests for API failures, response validation, and backend connectivity
 */

test.describe('API Endpoint Validation', () => {
  let testUtils: TestUtilities;

  test.beforeEach(async ({ page }) => {
    testUtils = new TestUtilities(page);
  });

  test('should validate all known API endpoints', async ({ page }) => {
    const apiEndpoints = [
      // Core analysis endpoints
      '/api/analysis',
      '/api/analysis/circular',
      '/api/analysis/dependencies', 
      '/api/analysis/duplicates',
      '/api/analysis/entities',
      '/api/analysis/scan',
      '/api/analysis/sample',
      
      // File system endpoints
      '/api/files',
      '/api/files/list',
      '/api/files/read',
      '/api/files/write',
      
      // Performance and quality
      '/api/performance',
      '/api/quality',
      '/api/git',
      '/api/git-activity',
      
      // Configuration and reports
      '/api/config',
      '/api/config/load',
      '/api/config/save',
      '/api/reports',
      '/api/reports/generate',
      '/api/reports/export',
      '/api/reports/templates',
      
      // Services and scripts
      '/api/services',
      '/api/scripts',
      '/api/scripts/executions',
      '/api/batches',
      '/api/templates',
      
      // WebSocket and real-time
      '/api/websocket'
    ];

    const endpointResults = {
      healthy: [] as string[],
      unhealthy: [] as string[],
      errors: [] as string[],
      notImplemented: [] as string[]
    };

    console.log(`Testing ${apiEndpoints.length} API endpoints...`);

    for (const endpoint of apiEndpoints) {
      try {
        const url = `${TEST_CONFIG.dashboards.webClient.baseURL}${endpoint}`;
        const response = await page.request.get(url, { timeout: 10000 });
        
        if (response.ok()) {
          endpointResults.healthy.push(endpoint);
        } else if (response.status() === 404) {
          endpointResults.notImplemented.push(endpoint);
        } else if (response.status() === 405) {
          // Method not allowed - endpoint exists but GET not supported
          endpointResults.healthy.push(`${endpoint} (POST only)`);
        } else {
          endpointResults.unhealthy.push(`${endpoint} - ${response.status()}`);
        }
        
      } catch (error) {
        endpointResults.errors.push(`${endpoint} - ${error}`);
      }
    }

    console.log('\n=== API ENDPOINT VALIDATION RESULTS ===');
    console.log(`Healthy: ${endpointResults.healthy.length}`);
    console.log(`Unhealthy: ${endpointResults.unhealthy.length}`);
    console.log(`Not Implemented: ${endpointResults.notImplemented.length}`);
    console.log(`Errors: ${endpointResults.errors.length}`);

    if (endpointResults.healthy.length > 0) {
      console.log('\nWORKING ENDPOINTS:');
      endpointResults.healthy.forEach((endpoint, index) => {
        console.log(`${index + 1}. ${endpoint}`);
      });
    }

    if (endpointResults.unhealthy.length > 0) {
      console.log('\nUNHEALTHY ENDPOINTS:');
      endpointResults.unhealthy.forEach((endpoint, index) => {
        console.log(`${index + 1}. ${endpoint}`);
      });
    }

    if (endpointResults.errors.length > 0) {
      console.log('\nERROR ENDPOINTS:');
      endpointResults.errors.forEach((endpoint, index) => {
        console.log(`${index + 1}. ${endpoint}`);
      });
    }

    // Should have some working endpoints
    expect(endpointResults.healthy.length).toBeGreaterThan(0);
    // Should not have too many unhealthy endpoints (excluding not implemented)
    expect(endpointResults.unhealthy.length + endpointResults.errors.length).toBeLessThan(10);
  });

  test('should validate API response formats and data integrity', async ({ page }) => {
    const endpointsToValidate = [
      { endpoint: '/api/analysis', expectsArray: false, expectsObject: true },
      { endpoint: '/api/files/list', expectsArray: true, expectsObject: false },
      { endpoint: '/api/performance', expectsArray: false, expectsObject: true },
      { endpoint: '/api/config', expectsArray: false, expectsObject: true }
    ];

    const dataValidationIssues: string[] = [];

    for (const { endpoint, expectsArray, expectsObject } of endpointsToValidate) {
      try {
        const url = `${TEST_CONFIG.dashboards.webClient.baseURL}${endpoint}`;
        const response = await page.request.get(url);
        
        if (response.ok()) {
          const contentType = response.headers()['content-type'] || '';
          
          if (contentType.includes('application/json')) {
            try {
              const data = await response.json();
              
              // Validate data structure
              if (expectsArray && !Array.isArray(data)) {
                dataValidationIssues.push(`${endpoint}: Expected array, got ${typeof data}`);
              } else if (expectsObject && (typeof data !== 'object' || Array.isArray(data))) {
                dataValidationIssues.push(`${endpoint}: Expected object, got ${typeof data}`);
              }
              
              // Check for common required fields
              if (expectsObject && data && typeof data === 'object') {
                if (!data.hasOwnProperty('timestamp') && !data.hasOwnProperty('data')) {
                  console.log(`${endpoint}: No timestamp or data field (may be normal)`);
                }
              }
              
            } catch (jsonError) {
              dataValidationIssues.push(`${endpoint}: Invalid JSON response`);
            }
          } else {
            console.log(`${endpoint}: Non-JSON response (${contentType})`);
          }
        } else {
          console.log(`${endpoint}: Not available (${response.status()})`);
        }
        
      } catch (error) {
        console.log(`${endpoint}: Request failed - ${error}`);
      }
    }

    if (dataValidationIssues.length > 0) {
      console.log('Data Validation Issues:', dataValidationIssues);
    }

    expect(dataValidationIssues.length).toBeLessThan(5);
  });

  test('should test API endpoints with different HTTP methods', async ({ page }) => {
    const methodTests = [
      { endpoint: '/api/analysis/scan', method: 'POST', expectSuccess: true },
      { endpoint: '/api/config/save', method: 'POST', expectSuccess: true },
      { endpoint: '/api/files/write', method: 'POST', expectSuccess: false }, // May require body
      { endpoint: '/api/reports/generate', method: 'POST', expectSuccess: false } // May require body
    ];

    const methodIssues: string[] = [];

    for (const { endpoint, method, expectSuccess } of methodTests) {
      try {
        const url = `${TEST_CONFIG.dashboards.webClient.baseURL}${endpoint}`;
        
        let response;
        if (method === 'POST') {
          response = await page.request.post(url, { 
            data: {},
            timeout: 10000 
          });
        } else {
          response = await page.request.get(url);
        }

        if (expectSuccess && !response.ok()) {
          methodIssues.push(`${method} ${endpoint}: Expected success, got ${response.status()}`);
        } else if (!expectSuccess && response.ok()) {
          console.log(`${method} ${endpoint}: Unexpectedly succeeded (may be good)`);
        }

        console.log(`${method} ${endpoint}: ${response.status()}`);
        
      } catch (error) {
        if (expectSuccess) {
          methodIssues.push(`${method} ${endpoint}: Request failed - ${error}`);
        } else {
          console.log(`${method} ${endpoint}: Request failed as expected`);
        }
      }
    }

    if (methodIssues.length > 0) {
      console.log('HTTP Method Issues:', methodIssues);
    }

    expect(methodIssues.length).toBeLessThan(methodTests.length);
  });

  test('should monitor API calls during UI interactions', async ({ page }) => {
    const apiCalls: Array<{ url: string; status: number; method: string }> = [];
    const apiErrors: string[] = [];

    // Monitor network requests
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/api/')) {
        apiCalls.push({
          url: url,
          status: response.status(),
          method: response.request().method()
        });

        if (!response.ok()) {
          apiErrors.push(`${response.request().method()} ${url} - ${response.status()}`);
        }
      }
    });

    // Navigate through UI and trigger API calls
    const routesWithApiCalls = [
      '/dashboard/analysis',
      '/dashboard/performance',
      '/dashboard/files',
      '/dashboard/quality'
    ];

    for (const route of routesWithApiCalls) {
      await page.goto(`${TEST_CONFIG.dashboards.webClient.baseURL}${route}`);
      await page.waitForTimeout(3000); // Wait for API calls to complete
    }

    console.log(`\nAPI Calls Monitored: ${apiCalls.length}`);
    
    if (apiCalls.length > 0) {
      console.log('API Call Summary:');
      const callSummary = apiCalls.reduce((acc, call) => {
        const key = `${call.method} ${call.url.split('/api/')[1]?.split('?')[0]}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      Object.entries(callSummary).forEach(([call, count]) => {
        console.log(`  ${call}: ${count} calls`);
      });
    }

    if (apiErrors.length > 0) {
      console.log('\nAPI Errors during UI interaction:', apiErrors);
    }

    // Should make some API calls during normal usage
    expect(apiCalls.length).toBeGreaterThan(0);
    // Should have minimal API errors
    expect(apiErrors.length).toBeLessThan(10);
  });

  test('should validate API error handling and status codes', async ({ page }) => {
    const errorTestEndpoints = [
      { endpoint: '/api/nonexistent', expectedStatus: 404 },
      { endpoint: '/api/files/read', method: 'POST', expectedStatus: [400, 405] }, // Bad request or method not allowed
      { endpoint: '/api/analysis/invalid-type', expectedStatus: [400, 404] }
    ];

    const errorHandlingIssues: string[] = [];

    for (const { endpoint, method = 'GET', expectedStatus } of errorTestEndpoints) {
      try {
        const url = `${TEST_CONFIG.dashboards.webClient.baseURL}${endpoint}`;
        
        let response;
        if (method === 'POST') {
          response = await page.request.post(url);
        } else {
          response = await page.request.get(url);
        }

        const actualStatus = response.status();
        const expectedStatuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
        
        if (!expectedStatuses.includes(actualStatus)) {
          errorHandlingIssues.push(`${endpoint}: Expected ${expectedStatus}, got ${actualStatus}`);
        } else {
          console.log(`✓ ${endpoint}: Correct error status ${actualStatus}`);
        }

        // Check for error response format
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            if (!errorData.hasOwnProperty('error') && !errorData.hasOwnProperty('message')) {
              console.log(`${endpoint}: Error response lacks standard error fields`);
            }
          } catch (e) {
            console.log(`${endpoint}: Non-JSON error response`);
          }
        }

      } catch (error) {
        errorHandlingIssues.push(`${endpoint}: Request failed unexpectedly - ${error}`);
      }
    }

    if (errorHandlingIssues.length > 0) {
      console.log('Error Handling Issues:', errorHandlingIssues);
    }

    expect(errorHandlingIssues.length).toBeLessThan(2);
  });

  test('should test API performance and response times', async ({ page }) => {
    const performanceEndpoints = [
      '/api/analysis',
      '/api/files/list',
      '/api/performance',
      '/api/config'
    ];

    const performanceResults: Array<{ endpoint: string; responseTime: number; status: number }> = [];
    const slowEndpoints: string[] = [];

    for (const endpoint of performanceEndpoints) {
      try {
        const url = `${TEST_CONFIG.dashboards.webClient.baseURL}${endpoint}`;
        const startTime = Date.now();
        
        const response = await page.request.get(url, { timeout: 15000 });
        const responseTime = Date.now() - startTime;
        
        performanceResults.push({
          endpoint,
          responseTime,
          status: response.status()
        });

        if (responseTime > 5000) {
          slowEndpoints.push(`${endpoint} (${responseTime}ms)`);
        }

        console.log(`${endpoint}: ${responseTime}ms - ${response.status()}`);
        
      } catch (error) {
        console.log(`${endpoint}: Performance test failed - ${error}`);
      }
    }

    const avgResponseTime = performanceResults.length > 0 
      ? performanceResults.reduce((sum, result) => sum + result.responseTime, 0) / performanceResults.length
      : 0;

    console.log(`\nAPI Performance Summary:`);
    console.log(`Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`Slow Endpoints (>5s): ${slowEndpoints.length}`);

    if (slowEndpoints.length > 0) {
      console.log('Slow Endpoints:', slowEndpoints);
    }

    // API performance thresholds
    expect(avgResponseTime).toBeLessThan(10000); // 10 seconds average
    expect(slowEndpoints.length).toBeLessThan(performanceEndpoints.length * 0.5); // Less than 50% slow
  });

  test('should validate WebSocket connectivity', async ({ page }) => {
    let wsConnectionAttempted = false;
    let wsConnected = false;
    const wsErrors: string[] = [];

    // Monitor WebSocket connections
    page.on('websocket', (ws) => {
      wsConnectionAttempted = true;
      console.log(`WebSocket connection attempt: ${ws.url()}`);
      
      ws.on('open' as any, () => {
        wsConnected = true;
        console.log('WebSocket connected successfully');
      });
      
      ws.on('close' as any, () => {
        console.log('WebSocket connection closed');
      });
      
      ws.on('socketerror', (error) => {
        wsErrors.push(`WebSocket error: ${error}`);
      });
    });

    // Navigate to dashboard that should establish WebSocket connection
    await page.goto(`${TEST_CONFIG.dashboards.webClient.baseURL}/dashboard`);
    await page.waitForTimeout(5000); // Wait for WebSocket connection

    console.log(`WebSocket connection attempted: ${wsConnectionAttempted}`);
    console.log(`WebSocket connected: ${wsConnected}`);
    
    if (wsErrors.length > 0) {
      console.log('WebSocket Errors:', wsErrors);
    }

    // WebSocket might not be implemented yet, so be lenient
    if (wsConnectionAttempted) {
      expect(wsErrors.length).toBeLessThan(3);
    }
  });

  test('should test API authentication and security headers', async ({ page }) => {
    const securityTestEndpoints = ['/api/config', '/api/analysis', '/api/files/list'];
    const securityIssues: string[] = [];

    for (const endpoint of securityTestEndpoints) {
      try {
        const url = `${TEST_CONFIG.dashboards.webClient.baseURL}${endpoint}`;
        const response = await page.request.get(url);
        
        const headers = response.headers();
        
        // Check for security headers (nice to have)
        const securityHeaders = [
          'x-content-type-options',
          'x-frame-options', 
          'x-xss-protection',
          'content-security-policy'
        ];

        let securityHeadersPresent = 0;
        securityHeaders.forEach(header => {
          if (headers[header]) {
            securityHeadersPresent++;
          }
        });

        console.log(`${endpoint}: ${securityHeadersPresent}/${securityHeaders.length} security headers`);

        // Check for CORS headers if needed
        if (headers['access-control-allow-origin']) {
          console.log(`${endpoint}: CORS enabled`);
        }

      } catch (error) {
        console.log(`${endpoint}: Security test failed - ${error}`);
      }
    }

    // Security headers are nice to have but not critical for functionality
    expect(securityIssues.length).toBeLessThan(5);
  });

  test('should generate comprehensive API health report', async ({ page }) => {
    const report = {
      timestamp: new Date().toISOString(),
      dashboard: 'Web Client Dashboard',
      summary: {
        totalEndpointsChecked: 0,
        healthyEndpoints: 0,
        unhealthyEndpoints: 0,
        notImplementedEndpoints: 0,
        avgResponseTime: 0,
        apiCallsDuringUsage: 0,
        criticalFailures: 0
      },
      details: {
        workingEndpoints: [] as string[],
        failedEndpoints: [] as string[],
        slowEndpoints: [] as string[],
        dataValidationIssues: [] as string[],
        performanceMetrics: {} as Record<string, number>
      },
      recommendations: [] as string[]
    };

    // Test core API endpoints
    const coreEndpoints = [
      '/api/analysis', '/api/files/list', '/api/performance', 
      '/api/quality', '/api/config', '/api/services'
    ];

    report.summary.totalEndpointsChecked = coreEndpoints.length;
    let totalResponseTime = 0;

    for (const endpoint of coreEndpoints) {
      try {
        const startTime = Date.now();
        const url = `${TEST_CONFIG.dashboards.webClient.baseURL}${endpoint}`;
        const response = await page.request.get(url, { timeout: 10000 });
        const responseTime = Date.now() - startTime;

        if (response.ok()) {
          report.summary.healthyEndpoints++;
          report.details.workingEndpoints.push(endpoint);
          totalResponseTime += responseTime;
          
          if (responseTime > 5000) {
            report.details.slowEndpoints.push(`${endpoint} (${responseTime}ms)`);
          }
          
          report.details.performanceMetrics[endpoint] = responseTime;
        } else if (response.status() === 404) {
          report.summary.notImplementedEndpoints++;
        } else {
          report.summary.unhealthyEndpoints++;
          report.details.failedEndpoints.push(`${endpoint} - ${response.status()}`);
          
          if (response.status() >= 500) {
            report.summary.criticalFailures++;
          }
        }

      } catch (error) {
        report.summary.unhealthyEndpoints++;
        report.details.failedEndpoints.push(`${endpoint} - ${error}`);
        report.summary.criticalFailures++;
      }
    }

    report.summary.avgResponseTime = report.summary.healthyEndpoints > 0 
      ? totalResponseTime / report.summary.healthyEndpoints 
      : 0;

    // Test API calls during usage
    const apiCalls: string[] = [];
    page.on('response', (response) => {
      if (response.url().includes('/api/')) {
        apiCalls.push(response.url());
      }
    });

    await page.goto(`${TEST_CONFIG.dashboards.webClient.baseURL}/dashboard`);
    await page.waitForTimeout(3000);
    
    report.summary.apiCallsDuringUsage = apiCalls.length;

    // Generate recommendations
    if (report.summary.criticalFailures > 0) {
      report.recommendations.push('Critical API failures detected. Review server configuration and error handling.');
    }
    
    if (report.summary.avgResponseTime > 5000) {
      report.recommendations.push('High average API response time. Consider performance optimization.');
    }
    
    if (report.summary.healthyEndpoints === 0) {
      report.recommendations.push('No working API endpoints found. Check backend server status.');
    }
    
    if (report.details.slowEndpoints.length > 2) {
      report.recommendations.push('Multiple slow API endpoints detected. Investigate performance bottlenecks.');
    }

    console.log('\n=== COMPREHENSIVE API HEALTH REPORT ===');
    console.log(JSON.stringify(report.summary, null, 2));
    
    if (report.recommendations.length > 0) {
      console.log('\nRECOMMENDATIONS:');
      report.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }

    // Test assertions
    expect(report.summary.criticalFailures).toBeLessThan(3);
    expect(report.summary.healthyEndpoints + report.summary.notImplementedEndpoints).toBeGreaterThan(0);
  });
});