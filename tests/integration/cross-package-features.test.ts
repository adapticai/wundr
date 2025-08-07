/**
 * Cross-Package Integration Tests
 * Tests the interaction between different packages and modules
 */

import { AnalysisService } from '@/analysis/enhanced-ast-analyzer';
import { ConsolidationManager } from '@/consolidation/consolidation-manager';
import { PatternStandardizer } from '@/standardization/pattern-standardizer';
import { DriftDetectionService } from '@/governance/DriftDetectionService';
import { GovernanceSystem } from '@/governance/governance-system';
import { BaseService } from '@/core/BaseService';
import { TEST_FIXTURES } from '@fixtures/sample-project';
import { promises as fs } from 'fs';
import path from 'path';

describe('Cross-Package Integration Tests', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(process.cwd(), 'temp-integration-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Analysis to Consolidation Pipeline', () => {
    test('should analyze project and feed results to consolidation', async () => {
      // Create test project with duplicates
      await createProjectFromFixture(tempDir, TEST_FIXTURES.PROJECT_WITH_DUPLICATES);
      
      // Step 1: Analyze project
      const analysisService = new AnalysisService();
      const analysisResult = await analysisService.analyzeProject(tempDir);
      
      expect(analysisResult.success).toBe(true);
      expect(analysisResult.data).toBeDefined();
      expect(analysisResult.data.duplicates).toHaveLength.greaterThan(0);
      
      // Step 2: Use analysis results for consolidation
      const consolidationManager = new ConsolidationManager();
      const consolidationResult = await consolidationManager.consolidateDuplicates(
        tempDir,
        { 
          analysisData: analysisResult.data,
          createBackup: true,
          dryRun: false
        }
      );
      
      expect(consolidationResult.success).toBe(true);
      expect(consolidationResult.data.operationsPerformed).toBeGreaterThan(0);
    });

    test('should handle analysis errors gracefully in consolidation pipeline', async () => {
      // Create invalid project structure
      await fs.writeFile(path.join(tempDir, 'invalid.ts'), 'invalid TypeScript syntax {{}}');
      
      const analysisService = new AnalysisService();
      const analysisResult = await analysisService.analyzeProject(tempDir);
      
      // Analysis should handle errors gracefully
      expect(analysisResult.success).toBe(false);
      expect(analysisResult.error).toBeDefined();
      
      // Consolidation should handle failed analysis
      const consolidationManager = new ConsolidationManager();
      const consolidationResult = await consolidationManager.consolidateDuplicates(
        tempDir,
        { analysisData: null }
      );
      
      expect(consolidationResult.success).toBe(false);
      expect(consolidationResult.error?.message).toContain('analysis data');
    });
  });

  describe('Standardization to Governance Integration', () => {
    test('should standardize patterns and update governance metrics', async () => {
      // Create project with pattern issues
      await createProjectFromFixture(tempDir, TEST_FIXTURES.PROJECT_WITH_PATTERN_ISSUES);
      
      // Step 1: Standardize patterns
      const patternStandardizer = new PatternStandardizer();
      const standardizationResult = await patternStandardizer.standardizePatterns(tempDir);
      
      expect(standardizationResult.success).toBe(true);
      expect(standardizationResult.data.fixesApplied).toBeGreaterThan(0);
      
      // Step 2: Update governance metrics
      const governanceSystem = new GovernanceSystem({ outputDir: tempDir });
      await governanceSystem.initialize();
      
      const governanceResult = await governanceSystem.updateMetrics({
        standardizationResults: standardizationResult.data,
        projectPath: tempDir
      });
      
      expect(governanceResult.success).toBe(true);
      expect(governanceResult.data.metricsUpdated).toBe(true);
    });

    test('should detect drift after standardization', async () => {
      await createProjectFromFixture(tempDir, TEST_FIXTURES.PROJECT_WITH_PATTERN_ISSUES);
      
      // Create baseline before standardization
      const driftDetectionService = new DriftDetectionService({ outputDir: tempDir });
      await driftDetectionService.initialize();
      
      const baselineResult = await driftDetectionService.createBaseline(tempDir);
      expect(baselineResult.success).toBe(true);
      
      // Apply standardization
      const patternStandardizer = new PatternStandardizer();
      await patternStandardizer.standardizePatterns(tempDir);
      
      // Detect drift after standardization
      const driftResult = await driftDetectionService.detectDrift(tempDir);
      
      expect(driftResult.success).toBe(true);
      expect(driftResult.data.driftDetected).toBe(true);
      expect(driftResult.data.changes).toHaveLength.greaterThan(0);
    });
  });

  describe('Full Workflow Integration', () => {
    test('should execute complete analysis-consolidation-standardization-governance workflow', async () => {
      // Create complex test project
      await createProjectFromFixture(tempDir, TEST_FIXTURES.SAMPLE_TYPESCRIPT_PROJECT);
      await addDuplicatesToProject(tempDir);
      await addPatternIssuesToProject(tempDir);
      
      const workflowResults: any[] = [];
      
      // Step 1: Analysis
      const analysisService = new AnalysisService();
      const analysisResult = await analysisService.analyzeProject(tempDir);
      workflowResults.push({ step: 'analysis', result: analysisResult });
      
      expect(analysisResult.success).toBe(true);
      
      // Step 2: Consolidation
      const consolidationManager = new ConsolidationManager();
      const consolidationResult = await consolidationManager.consolidateDuplicates(
        tempDir,
        { 
          analysisData: analysisResult.data,
          createBackup: true
        }
      );
      workflowResults.push({ step: 'consolidation', result: consolidationResult });
      
      expect(consolidationResult.success).toBe(true);
      
      // Step 3: Pattern Standardization
      const patternStandardizer = new PatternStandardizer();
      const standardizationResult = await patternStandardizer.standardizePatterns(tempDir);
      workflowResults.push({ step: 'standardization', result: standardizationResult });
      
      expect(standardizationResult.success).toBe(true);
      
      // Step 4: Governance Update
      const governanceSystem = new GovernanceSystem({ outputDir: tempDir });
      await governanceSystem.initialize();
      
      const governanceResult = await governanceSystem.generateReport({
        analysisResults: analysisResult.data,
        consolidationResults: consolidationResult.data,
        standardizationResults: standardizationResult.data
      });
      workflowResults.push({ step: 'governance', result: governanceResult });
      
      expect(governanceResult.success).toBe(true);
      
      // Verify workflow completed successfully
      const allSuccessful = workflowResults.every(({ result }) => result.success);
      expect(allSuccessful).toBe(true);
      
      // Verify output files were created
      const governanceOutputExists = await fs.access(
        path.join(tempDir, 'governance-report.json')
      ).then(() => true).catch(() => false);
      
      expect(governanceOutputExists).toBe(true);
    });

    test('should handle partial workflow failures gracefully', async () => {
      await createProjectFromFixture(tempDir, TEST_FIXTURES.SAMPLE_TYPESCRIPT_PROJECT);
      
      // Make a file read-only to cause consolidation failure
      const readOnlyFile = path.join(tempDir, 'src', 'services', 'UserService.ts');
      await fs.chmod(readOnlyFile, 0o444);
      
      // Step 1: Analysis (should succeed)
      const analysisService = new AnalysisService();
      const analysisResult = await analysisService.analyzeProject(tempDir);
      expect(analysisResult.success).toBe(true);
      
      // Step 2: Consolidation (should fail due to read-only file)
      const consolidationManager = new ConsolidationManager();
      const consolidationResult = await consolidationManager.consolidateDuplicates(
        tempDir,
        { analysisData: analysisResult.data }
      );
      expect(consolidationResult.success).toBe(false);
      
      // Step 3: Continue with standardization despite consolidation failure
      const patternStandardizer = new PatternStandardizer();
      const standardizationResult = await patternStandardizer.standardizePatterns(tempDir);
      
      // Should succeed for files it can modify
      expect(standardizationResult.success).toBe(true);
      
      // Step 4: Governance should handle mixed results
      const governanceSystem = new GovernanceSystem({ outputDir: tempDir });
      await governanceSystem.initialize();
      
      const governanceResult = await governanceSystem.generateReport({
        analysisResults: analysisResult.data,
        consolidationResults: null, // Failed step
        standardizationResults: standardizationResult.data
      });
      
      expect(governanceResult.success).toBe(true);
      expect(governanceResult.data.warnings).toContain('consolidation');
    });
  });

  describe('Service Communication and Events', () => {
    test('should properly emit and handle events across services', async () => {
      await createProjectFromFixture(tempDir, TEST_FIXTURES.SAMPLE_TYPESCRIPT_PROJECT);
      
      const eventLog: Array<{ service: string; event: string; data: any }> = [];
      
      // Set up event listeners
      const services = [
        new AnalysisService(),
        new ConsolidationManager(),
        new PatternStandardizer(),
        new GovernanceSystem({ outputDir: tempDir })
      ];
      
      services.forEach(service => {
        service.on('initialized', (data) => {
          eventLog.push({ service: service.constructor.name, event: 'initialized', data });
        });
        
        service.on('operation-complete', (data) => {
          eventLog.push({ service: service.constructor.name, event: 'operation-complete', data });
        });
      });
      
      // Initialize all services
      await Promise.all(services.map(service => service.initialize()));
      
      // Execute operations
      const analysisService = services[0] as AnalysisService;
      await analysisService.analyzeProject(tempDir);
      
      // Verify events were emitted
      const initEvents = eventLog.filter(log => log.event === 'initialized');
      expect(initEvents).toHaveLength(4);
      
      const operationEvents = eventLog.filter(log => log.event === 'operation-complete');
      expect(operationEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration and Environment Integration', () => {
    test('should share configuration across services', async () => {
      const sharedConfig = {
        outputDir: tempDir,
        enableLogging: true,
        maxConcurrency: 5
      };
      
      const services = [
        new AnalysisService(sharedConfig),
        new ConsolidationManager(sharedConfig),
        new PatternStandardizer(sharedConfig),
        new GovernanceSystem(sharedConfig)
      ];
      
      // Verify all services have the same configuration
      services.forEach(service => {
        expect(service['config'].outputDir).toBe(tempDir);
        expect(service['config'].enableLogging).toBe(true);
        expect(service['config'].maxConcurrency).toBe(5);
      });
      
      await Promise.all(services.map(service => service.initialize()));
      
      // Verify health checks work consistently
      const healthChecks = services.map(service => service.getHealth());
      healthChecks.forEach(health => {
        expect(health.success).toBe(true);
        expect(health.data?.status).toBe('healthy');
      });
    });

    test('should handle environment-specific configurations', async () => {
      // Test different environments
      const environments = ['development', 'test', 'production'];
      
      for (const env of environments) {
        process.env.NODE_ENV = env;
        
        const analysisService = new AnalysisService();
        await analysisService.initialize();
        
        const health = analysisService.getHealth();
        expect(health.success).toBe(true);
        
        // Verify environment-specific behavior
        if (env === 'production') {
          expect(analysisService['config'].enableLogging).toBe(false);
        } else {
          expect(analysisService['config'].enableLogging).toBe(true);
        }
      }
      
      // Reset environment
      process.env.NODE_ENV = 'test';
    });
  });

  // Helper functions
  async function createProjectFromFixture(dir: string, fixture: any) {
    for (const file of fixture.files) {
      const filePath = path.join(dir, file.path);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, file.content);
    }
    
    if (fixture.packageJson) {
      await fs.writeFile(
        path.join(dir, 'package.json'),
        JSON.stringify(fixture.packageJson, null, 2)
      );
    }
  }

  async function addDuplicatesToProject(dir: string) {
    const duplicateFunction = `
function validateInput(input: string): boolean {
  return input && input.trim().length > 0;
}`;

    // Add duplicate function to multiple files
    const files = ['src/utils/validation.ts', 'src/helpers/input.ts'];
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      
      const content = `
${duplicateFunction}

export class ${path.basename(file, '.ts')} {
  validate(input: string): boolean {
    return validateInput(input);
  }
}`;
      
      await fs.writeFile(filePath, content);
    }
  }

  async function addPatternIssuesToProject(dir: string) {
    const patternIssuesFile = path.join(dir, 'src/legacy/LegacyCode.ts');
    await fs.mkdir(path.dirname(patternIssuesFile), { recursive: true });
    
    const content = `
export class LegacyCode {
  process(data: any): any {
    if (!data) {
      throw 'Data is required'; // String throw issue
    }
    
    return fetch('/api/process')
      .then(response => response.json())  // Promise chain issue
      .then(result => {
        return data && data.items ? data.items : []; // No optional chaining
      });
  }
}`;
    
    await fs.writeFile(patternIssuesFile, content);
  }
});