/**
 * Client Services Test Suite
 * Tests client-side service functionality to ensure browser compatibility
 */

// Test interfaces
export interface TestResult {
  success: boolean;
  name: string;
  message?: string;
  error?: any;
  duration?: number;
}

export interface TestSuite {
  name: string;
  tests: TestResult[];
  passed: number;
  failed: number;
  duration: number;
}

// Mock client services for testing
export class ClientReportService {
  private baseUrl: string;

  constructor(baseUrl: string = '/api/reports') {
    this.baseUrl = baseUrl;
  }

  async generateReport(type: string, data: any): Promise<any> {
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 10));

    return {
      id: `report-${Date.now()}`,
      type,
      data,
      timestamp: Date.now(),
      status: 'completed',
    };
  }

  async exportReport(
    reportId: string,
    format: 'json' | 'csv' | 'pdf'
  ): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 5));

    return {
      success: true,
      downloadUrl: `${this.baseUrl}/${reportId}/export?format=${format}`,
      format,
    };
  }

  validateReportData(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data) {
      errors.push('Report data is required');
    }

    if (data && typeof data !== 'object') {
      errors.push('Report data must be an object');
    }

    if (data && !data.timestamp) {
      errors.push('Report must have a timestamp');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

export class ClientScriptService {
  private scripts: Map<string, any> = new Map();

  constructor() {
    // Initialize with some mock scripts
    this.scripts.set('test-script', {
      id: 'test-script',
      name: 'Test Script',
      content: 'console.log("Hello from test script")',
      parameters: [],
    });
  }

  async executeScript(
    scriptId: string,
    parameters: Record<string, any> = {}
  ): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 15));

    const script = this.scripts.get(scriptId);
    if (!script) {
      throw new Error(`Script not found: ${scriptId}`);
    }

    return {
      executionId: `exec-${Date.now()}`,
      scriptId,
      parameters,
      output: `Executed script: ${script.name}`,
      status: 'success',
      timestamp: Date.now(),
    };
  }

  getAvailableScripts(): Array<{
    id: string;
    name: string;
    description?: string;
  }> {
    return Array.from(this.scripts.entries()).map(([id, script]) => ({
      id,
      name: script.name,
      description: script.description,
    }));
  }

  validateScriptParameters(
    scriptId: string,
    parameters: Record<string, any>
  ): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const script = this.scripts.get(scriptId);

    if (!script) {
      errors.push(`Script not found: ${scriptId}`);
      return { isValid: false, errors };
    }

    // Basic parameter validation
    if (parameters && typeof parameters !== 'object') {
      errors.push('Parameters must be an object');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

export class ClientBatchService {
  private batches: Map<string, any> = new Map();

  async createBatch(config: {
    name: string;
    jobs: Array<{ id: string; type: string; data: any }>;
  }): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 8));

    const batchId = `batch-${Date.now()}`;
    const batch = {
      id: batchId,
      ...config,
      status: 'pending',
      createdAt: Date.now(),
      progress: 0,
    };

    this.batches.set(batchId, batch);

    return batch;
  }

  async getBatchStatus(batchId: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 3));

    const batch = this.batches.get(batchId);
    if (!batch) {
      throw new Error(`Batch not found: ${batchId}`);
    }

    return {
      ...batch,
      progress: Math.min(100, batch.progress + Math.random() * 20),
    };
  }

  validateBatchConfig(config: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config) {
      errors.push('Batch configuration is required');
      return { isValid: false, errors };
    }

    if (!config.name) {
      errors.push('Batch name is required');
    }

    if (!Array.isArray(config.jobs)) {
      errors.push('Batch jobs must be an array');
    } else if (config.jobs.length === 0) {
      errors.push('Batch must contain at least one job');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

export class ClientTemplateService {
  private templates: Map<string, any> = new Map();

  constructor() {
    // Initialize with mock templates
    this.templates.set('basic-template', {
      id: 'basic-template',
      name: 'Basic Template',
      content:
        '// Basic template content\nconsole.log("Generated from template");',
      variables: ['name', 'version'],
    });
  }

  async generateFromTemplate(
    templateId: string,
    variables: Record<string, any>
  ): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 12));

    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    let content = template.content;

    // Simple variable substitution
    Object.entries(variables).forEach(([key, value]) => {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    });

    return {
      templateId,
      variables,
      generatedContent: content,
      timestamp: Date.now(),
    };
  }

  getAvailableTemplates(): Array<{
    id: string;
    name: string;
    variables: string[];
  }> {
    return Array.from(this.templates.entries()).map(([id, template]) => ({
      id,
      name: template.name,
      variables: template.variables,
    }));
  }

  validateTemplateVariables(
    templateId: string,
    variables: Record<string, any>
  ): {
    isValid: boolean;
    errors: string[];
    missingVariables?: string[];
  } {
    const errors: string[] = [];
    const template = this.templates.get(templateId);

    if (!template) {
      errors.push(`Template not found: ${templateId}`);
      return { isValid: false, errors };
    }

    const missingVariables = template.variables.filter(
      (v: string) =>
        !(v in variables) || variables[v] === undefined || variables[v] === ''
    );

    if (missingVariables.length > 0) {
      errors.push(`Missing required variables: ${missingVariables.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      missingVariables:
        missingVariables.length > 0 ? missingVariables : undefined,
    };
  }
}

/**
 * Check if required browser APIs are available
 */
export function isBrowserSafe(): boolean {
  try {
    // Check for required APIs
    const requiredAPIs = [
      'fetch',
      'Promise',
      'Map',
      'Set',
      'JSON',
      'Date',
      'setTimeout',
      'clearTimeout',
    ];

    const globalScope = typeof window !== 'undefined' ? window : global;

    for (const api of requiredAPIs) {
      if (
        !(api in globalScope) &&
        typeof globalScope[api as keyof typeof globalScope] === 'undefined'
      ) {
        console.warn(`Required API not available: ${api}`);
        return false;
      }
    }

    // Check for URL constructor
    if (typeof URL === 'undefined') {
      console.warn('URL constructor not available');
      return false;
    }

    // Check for EventSource (for real-time features)
    if (typeof EventSource === 'undefined') {
      console.warn(
        'EventSource API not available (real-time features may not work)'
      );
      // This is not a breaking requirement, so continue
    }

    return true;
  } catch (error) {
    console.error('Error checking browser compatibility:', error);
    return false;
  }
}

/**
 * Test client service instantiation
 */
export async function testClientServicesInstantiation(): Promise<TestSuite> {
  const tests: TestResult[] = [];
  const startTime = Date.now();

  // Test ClientReportService
  try {
    const start = performance.now();
    const reportService = new ClientReportService();
    const duration = performance.now() - start;

    tests.push({
      success: true,
      name: 'ClientReportService instantiation',
      duration,
    });
  } catch (error) {
    tests.push({
      success: false,
      name: 'ClientReportService instantiation',
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Test ClientScriptService
  try {
    const start = performance.now();
    const scriptService = new ClientScriptService();
    const duration = performance.now() - start;

    tests.push({
      success: true,
      name: 'ClientScriptService instantiation',
      duration,
    });
  } catch (error) {
    tests.push({
      success: false,
      name: 'ClientScriptService instantiation',
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Test ClientBatchService
  try {
    const start = performance.now();
    const batchService = new ClientBatchService();
    const duration = performance.now() - start;

    tests.push({
      success: true,
      name: 'ClientBatchService instantiation',
      duration,
    });
  } catch (error) {
    tests.push({
      success: false,
      name: 'ClientBatchService instantiation',
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Test ClientTemplateService
  try {
    const start = performance.now();
    const templateService = new ClientTemplateService();
    const duration = performance.now() - start;

    tests.push({
      success: true,
      name: 'ClientTemplateService instantiation',
      duration,
    });
  } catch (error) {
    tests.push({
      success: false,
      name: 'ClientTemplateService instantiation',
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  const passed = tests.filter(t => t.success).length;
  const failed = tests.filter(t => !t.success).length;
  const totalDuration = Date.now() - startTime;

  return {
    name: 'Client Services Instantiation',
    tests,
    passed,
    failed,
    duration: totalDuration,
  };
}

/**
 * Test client service validation functions
 */
export async function testClientServiceValidation(): Promise<TestSuite> {
  const tests: TestResult[] = [];
  const startTime = Date.now();

  try {
    const reportService = new ClientReportService();
    const scriptService = new ClientScriptService();
    const batchService = new ClientBatchService();
    const templateService = new ClientTemplateService();

    // Test report validation
    try {
      const start = performance.now();
      const validation = reportService.validateReportData({
        timestamp: Date.now(),
        data: 'test',
      });
      const duration = performance.now() - start;

      tests.push({
        success: validation.isValid,
        name: 'Report data validation',
        duration,
        message: validation.isValid
          ? 'Valid report data'
          : validation.errors.join(', '),
      });
    } catch (error) {
      tests.push({
        success: false,
        name: 'Report data validation',
        error,
        message: error instanceof Error ? error.message : 'Validation failed',
      });
    }

    // Test script parameter validation
    try {
      const start = performance.now();
      const validation = scriptService.validateScriptParameters('test-script', {
        param1: 'value1',
      });
      const duration = performance.now() - start;

      tests.push({
        success: validation.isValid,
        name: 'Script parameter validation',
        duration,
        message: validation.isValid
          ? 'Valid script parameters'
          : validation.errors.join(', '),
      });
    } catch (error) {
      tests.push({
        success: false,
        name: 'Script parameter validation',
        error,
        message: error instanceof Error ? error.message : 'Validation failed',
      });
    }

    // Test batch configuration validation
    try {
      const start = performance.now();
      const validation = batchService.validateBatchConfig({
        name: 'Test Batch',
        jobs: [{ id: 'job1', type: 'test', data: {} }],
      });
      const duration = performance.now() - start;

      tests.push({
        success: validation.isValid,
        name: 'Batch configuration validation',
        duration,
        message: validation.isValid
          ? 'Valid batch configuration'
          : validation.errors.join(', '),
      });
    } catch (error) {
      tests.push({
        success: false,
        name: 'Batch configuration validation',
        error,
        message: error instanceof Error ? error.message : 'Validation failed',
      });
    }

    // Test template variable validation
    try {
      const start = performance.now();
      const validation = templateService.validateTemplateVariables(
        'basic-template',
        {
          name: 'Test',
          version: '1.0.0',
        }
      );
      const duration = performance.now() - start;

      tests.push({
        success: validation.isValid,
        name: 'Template variable validation',
        duration,
        message: validation.isValid
          ? 'Valid template variables'
          : validation.errors.join(', '),
      });
    } catch (error) {
      tests.push({
        success: false,
        name: 'Template variable validation',
        error,
        message: error instanceof Error ? error.message : 'Validation failed',
      });
    }
  } catch (error) {
    tests.push({
      success: false,
      name: 'Service validation setup',
      error,
      message: 'Failed to initialize services for validation testing',
    });
  }

  const passed = tests.filter(t => t.success).length;
  const failed = tests.filter(t => !t.success).length;
  const totalDuration = Date.now() - startTime;

  return {
    name: 'Client Service Validation',
    tests,
    passed,
    failed,
    duration: totalDuration,
  };
}

/**
 * Test actual service functionality (async operations)
 */
export async function testClientServiceFunctionality(): Promise<TestSuite> {
  const tests: TestResult[] = [];
  const startTime = Date.now();

  try {
    const reportService = new ClientReportService();
    const scriptService = new ClientScriptService();
    const batchService = new ClientBatchService();
    const templateService = new ClientTemplateService();

    // Test report generation
    try {
      const start = performance.now();
      const report = await reportService.generateReport('test', {
        sample: 'data',
      });
      const duration = performance.now() - start;

      tests.push({
        success: report && report.id && report.type === 'test',
        name: 'Report generation',
        duration,
        message: report
          ? `Generated report: ${report.id}`
          : 'Failed to generate report',
      });
    } catch (error) {
      tests.push({
        success: false,
        name: 'Report generation',
        error,
        message:
          error instanceof Error ? error.message : 'Report generation failed',
      });
    }

    // Test script execution
    try {
      const start = performance.now();
      const result = await scriptService.executeScript('test-script', {
        param: 'value',
      });
      const duration = performance.now() - start;

      tests.push({
        success: result && result.executionId && result.status === 'success',
        name: 'Script execution',
        duration,
        message: result
          ? `Executed: ${result.executionId}`
          : 'Script execution failed',
      });
    } catch (error) {
      tests.push({
        success: false,
        name: 'Script execution',
        error,
        message:
          error instanceof Error ? error.message : 'Script execution failed',
      });
    }

    // Test batch creation
    try {
      const start = performance.now();
      const batch = await batchService.createBatch({
        name: 'Test Batch',
        jobs: [{ id: 'job1', type: 'test', data: {} }],
      });
      const duration = performance.now() - start;

      tests.push({
        success: batch && batch.id && batch.status === 'pending',
        name: 'Batch creation',
        duration,
        message: batch ? `Created batch: ${batch.id}` : 'Batch creation failed',
      });
    } catch (error) {
      tests.push({
        success: false,
        name: 'Batch creation',
        error,
        message:
          error instanceof Error ? error.message : 'Batch creation failed',
      });
    }

    // Test template generation
    try {
      const start = performance.now();
      const result = await templateService.generateFromTemplate(
        'basic-template',
        {
          name: 'TestApp',
          version: '1.0.0',
        }
      );
      const duration = performance.now() - start;

      tests.push({
        success:
          result &&
          result.generatedContent &&
          result.templateId === 'basic-template',
        name: 'Template generation',
        duration,
        message: result
          ? 'Template generated successfully'
          : 'Template generation failed',
      });
    } catch (error) {
      tests.push({
        success: false,
        name: 'Template generation',
        error,
        message:
          error instanceof Error ? error.message : 'Template generation failed',
      });
    }
  } catch (error) {
    tests.push({
      success: false,
      name: 'Service functionality setup',
      error,
      message: 'Failed to initialize services for functionality testing',
    });
  }

  const passed = tests.filter(t => t.success).length;
  const failed = tests.filter(t => !t.success).length;
  const totalDuration = Date.now() - startTime;

  return {
    name: 'Client Service Functionality',
    tests,
    passed,
    failed,
    duration: totalDuration,
  };
}

/**
 * Run all client service tests
 */
export async function runClientServiceTests(): Promise<TestSuite[]> {
  const suites: TestSuite[] = [];

  try {
    // Run all test suites
    const instantiationSuite = await testClientServicesInstantiation();
    const validationSuite = await testClientServiceValidation();
    const functionalitySuite = await testClientServiceFunctionality();

    suites.push(instantiationSuite, validationSuite, functionalitySuite);

    // Log summary
    const totalTests = suites.reduce(
      (sum, suite) => sum + suite.tests.length,
      0
    );
    const totalPassed = suites.reduce((sum, suite) => sum + suite.passed, 0);
    const totalFailed = suites.reduce((sum, suite) => sum + suite.failed, 0);

    console.log(`Client Service Tests Summary:`);
    console.log(`  Total Tests: ${totalTests}`);
    console.log(`  Passed: ${totalPassed}`);
    console.log(`  Failed: ${totalFailed}`);
    console.log(
      `  Success Rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%`
    );

    suites.forEach(suite => {
      console.log(
        `  ${suite.name}: ${suite.passed}/${suite.tests.length} passed (${suite.duration}ms)`
      );
    });
  } catch (error) {
    console.error('Failed to run client service tests:', error);
  }

  return suites;
}

// Export service instances for external use
export const clientServices = {
  report: new ClientReportService(),
  script: new ClientScriptService(),
  batch: new ClientBatchService(),
  template: new ClientTemplateService(),
};

// Export test runner function for component use
export { runClientServiceTests as default };
