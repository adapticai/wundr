"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

import {
  runClientServiceTests,
  isBrowserSafe,
  testClientServicesInstantiation,
  testClientServiceValidation,
  TestResult as ServiceTestResult,
  TestSuite,
  MockService,
  createMockEndpoint
} from '@/lib/services/client/test-client-services';

interface TestResult {
  success: boolean;
  errors: string[];
}

interface TestResults {
  browserSafe: boolean;
  instantiation: TestResult;
  validation: TestResult;
}

export default function ClientServicesTest() {
  const [testResults, setTestResults] = useState<TestResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const runTests = async () => {
    setIsLoading(true);

    try {
      // Create a mock service for testing
      const mockService: MockService = {
        id: 'test-service',
        name: 'Test Service',
        baseUrl: 'https://api.test.com',
        endpoints: [
          createMockEndpoint('GET', '/health', { status: 'ok' }, 200),
          createMockEndpoint('GET', '/api/status', { healthy: true }, 200)
        ],
        config: {
          enableLogging: false,
          logLevel: 'info',
          persistState: false,
          enableCors: true,
          defaultDelay: 0
        },
        state: {
          data: {},
          status: 'pending',
          requestCount: 0,
          errorCount: 0,
          metrics: {
            avgResponseTime: 0,
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            errorRate: 0,
            memoryUsage: 0,
            lastUpdated: new Date()
          }
        },
        interceptors: []
      };

      // Run tests
      const browserSafe = isBrowserSafe(mockService);
      const services = ['ClientReportService', 'ClientScriptService', 'ClientBatchService', 'ClientTemplateService'];
      const results = await runClientServiceTests(services);

      // Group results by test type
      const instantiationTests = results.filter(r => r.name.includes('instantiation') || r.name.includes('Health check'));
      const validationTests = results.filter(r => r.name.includes('validation') || r.name.includes('Parameter'));

      setTestResults({
        browserSafe,
        instantiation: {
          success: instantiationTests.length > 0 && instantiationTests.every(t => t.status === 'passed'),
          errors: instantiationTests
            .filter(t => t.status === 'failed')
            .map(t => t.error?.message || `${t.name} failed`)
        },
        validation: {
          success: validationTests.length > 0 && validationTests.every(t => t.status === 'passed'),
          errors: validationTests
            .filter(t => t.status === 'failed')
            .map(t => t.error?.message || `${t.name} failed`)
        },
      });
      
    } catch (error) {
      console.error('Test execution failed:', error);
      setTestResults({
        browserSafe: false,
        instantiation: { 
          success: false, 
          errors: [`Test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`] 
        },
        validation: { success: false, errors: [] },
      });
    } finally {
      setIsLoading(false);
    }
  };

  const runTestsOnMount = async () => {
    // Automatically run tests when component mounts
    await runTests();
  };

  useEffect(() => {
    runTestsOnMount();
  }, []);

  const getStatusIcon = (success: boolean | undefined) => {
    if (success === undefined) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return success ? 
      <CheckCircle className="h-4 w-4 text-green-500" /> : 
      <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getStatusBadge = (success: boolean | undefined) => {
    if (success === undefined) return <Badge variant="secondary">Unknown</Badge>;
    return success ? 
      <Badge variant="default" className="bg-green-500">Pass</Badge> : 
      <Badge variant="destructive">Fail</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Client Services Test</h2>
          <p className="text-sm text-muted-foreground">
            Verify that client services work in browser context without Node.js dependencies
          </p>
        </div>
        <Button onClick={runTests} disabled={isLoading}>
          {isLoading ? 'Running Tests...' : 'Run Tests'}
        </Button>
      </div>

      {testResults && (
        <div className="grid gap-4">
          {/* Browser Compatibility */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  {getStatusIcon(testResults.browserSafe)}
                  Browser Compatibility
                </CardTitle>
                {getStatusBadge(testResults.browserSafe)}
              </div>
              <CardDescription>
                Tests if browser APIs (fetch, URL, EventSource, etc.) are available
              </CardDescription>
            </CardHeader>
            <CardContent>
              {testResults.browserSafe ? (
                <p className="text-sm text-green-600">
                  ✅ All required browser APIs are available
                </p>
              ) : (
                <p className="text-sm text-red-600">
                  ❌ Missing required browser APIs
                </p>
              )}
            </CardContent>
          </Card>

          {/* Service Instantiation */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  {getStatusIcon(testResults.instantiation.success)}
                  Service Instantiation
                </CardTitle>
                {getStatusBadge(testResults.instantiation.success)}
              </div>
              <CardDescription>
                Tests if client services can be instantiated without Node.js dependencies
              </CardDescription>
            </CardHeader>
            <CardContent>
              {testResults.instantiation.success ? (
                <p className="text-sm text-green-600">
                  ✅ All client services instantiated successfully
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-red-600">
                    ❌ Service instantiation failed
                  </p>
                  {testResults.instantiation.errors.map((error, index) => (
                    <div key={index} className="text-xs bg-red-50 p-2 rounded">
                      {error}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Parameter Validation */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  {getStatusIcon(testResults.validation.success)}
                  Parameter Validation
                </CardTitle>
                {getStatusBadge(testResults.validation.success)}
              </div>
              <CardDescription>
                Tests client-side parameter validation functions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {testResults.validation.success ? (
                <p className="text-sm text-green-600">
                  ✅ Parameter validation working correctly
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-red-600">
                    ❌ Parameter validation failed
                  </p>
                  {testResults.validation.errors.map((error, index) => (
                    <div key={index} className="text-xs bg-red-50 p-2 rounded">
                      {error}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Overall Status */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  {getStatusIcon(
                    testResults.browserSafe && 
                    testResults.instantiation.success && 
                    testResults.validation.success
                  )}
                  Overall Status
                </CardTitle>
                {getStatusBadge(
                  testResults.browserSafe && 
                  testResults.instantiation.success && 
                  testResults.validation.success
                )}
              </div>
            </CardHeader>
            <CardContent>
              {testResults.browserSafe && 
               testResults.instantiation.success && 
               testResults.validation.success ? (
                <div className="text-sm text-green-600">
                  <p>🎉 All tests passed! Client services are browser-safe and ready to use.</p>
                  <div className="mt-4 p-3 bg-green-50 rounded">
                    <p className="font-medium">Available Services:</p>
                    <ul className="mt-1 space-y-1 text-xs">
                      <li>• ClientReportService - Generate and export reports</li>
                      <li>• ClientScriptService - Execute and manage scripts</li>
                      <li>• ClientBatchService - Batch processing operations</li>
                      <li>• ClientTemplateService - Template management and generation</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-red-600">
                  <p>❌ Some tests failed. Client services may not work correctly in browser context.</p>
                  <p className="mt-2 text-xs">
                    Check the individual test results above for specific issues.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!testResults && !isLoading && (
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              Click "Run Tests" to verify client services are working correctly
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}