/**
 * Performance Benchmark Suite
 * Tests system performance under various conditions and workloads
 */

import { performance, PerformanceObserver } from 'perf_hooks';
import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { AnalysisService } from '@/analysis/enhanced-ast-analyzer';
import { ConsolidationManager } from '@/consolidation/consolidation-manager';
import { PatternStandardizer } from '@/standardization/pattern-standardizer';
import { DriftDetectionService } from '@/governance/DriftDetectionService';

describe('Performance Benchmarks', () => {
  let tempDir: string;
  let performanceData: PerformanceEntry[] = [];

  beforeAll(() => {
    // Set up performance observer
    const obs = new PerformanceObserver((list) => {
      performanceData.push(...list.getEntries());
    });
    obs.observe({ entryTypes: ['measure'] });
  });

  beforeEach(async () => {
    tempDir = path.join(process.cwd(), 'temp-perf-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  afterAll(() => {
    // Generate performance report
    generatePerformanceReport();
  });

  describe('Analysis Performance', () => {
    test('should analyze small projects efficiently', async () => {
      await createTestProject(tempDir, 10); // 10 files
      
      const analysisService = new AnalysisService();
      
      performance.mark('analysis-start');
      const result = await analysisService.analyzeProject(tempDir);
      performance.mark('analysis-end');
      performance.measure('small-project-analysis', 'analysis-start', 'analysis-end');
      
      const measure = performance.getEntriesByName('small-project-analysis')[0];
      
      expect(result).toBeDefined();
      expect(measure.duration).toBeLessThan(5000); // Less than 5 seconds
      expect(result.files).toHaveLength(10);
    });

    test('should analyze medium projects within time limits', async () => {
      await createTestProject(tempDir, 100); // 100 files
      
      const analysisService = new AnalysisService();
      
      performance.mark('medium-analysis-start');
      const result = await analysisService.analyzeProject(tempDir);
      performance.mark('medium-analysis-end');
      performance.measure('medium-project-analysis', 'medium-analysis-start', 'medium-analysis-end');
      
      const measure = performance.getEntriesByName('medium-project-analysis')[0];
      
      expect(result).toBeDefined();
      expect(measure.duration).toBeLessThan(30000); // Less than 30 seconds
      expect(result.files).toHaveLength(100);
    });

    test('should handle large projects efficiently', async () => {
      await createTestProject(tempDir, 1000); // 1000 files
      
      const analysisService = new AnalysisService();
      
      performance.mark('large-analysis-start');
      const result = await analysisService.analyzeProject(tempDir);
      performance.mark('large-analysis-end');
      performance.measure('large-project-analysis', 'large-analysis-start', 'large-analysis-end');
      
      const measure = performance.getEntriesByName('large-project-analysis')[0];
      
      expect(result).toBeDefined();
      expect(measure.duration).toBeLessThan(120000); // Less than 2 minutes
      expect(result.files).toHaveLength(1000);
    });

    test('should maintain consistent performance with repeated analyses', async () => {
      await createTestProject(tempDir, 50);
      const analysisService = new AnalysisService();
      const times: number[] = [];
      
      // Run analysis 5 times
      for (let i = 0; i < 5; i++) {
        performance.mark(`repeated-analysis-${i}-start`);
        await analysisService.analyzeProject(tempDir);
        performance.mark(`repeated-analysis-${i}-end`);
        performance.measure(`repeated-analysis-${i}`, `repeated-analysis-${i}-start`, `repeated-analysis-${i}-end`);
        
        const measure = performance.getEntriesByName(`repeated-analysis-${i}`)[0];
        times.push(measure.duration);
      }
      
      // Calculate variance
      const mean = times.reduce((a, b) => a + b) / times.length;
      const variance = times.reduce((a, b) => a + Math.pow(b - mean, 2)) / times.length;
      const standardDeviation = Math.sqrt(variance);
      
      // Standard deviation should be less than 20% of mean (consistent performance)
      expect(standardDeviation / mean).toBeLessThan(0.2);
    });
  });

  describe('Consolidation Performance', () => {
    test('should consolidate duplicates efficiently', async () => {
      await createProjectWithDuplicates(tempDir, 50);
      
      const consolidationManager = new ConsolidationManager();
      
      performance.mark('consolidation-start');
      const result = await consolidationManager.consolidateDuplicates(tempDir);
      performance.mark('consolidation-end');
      performance.measure('duplicate-consolidation', 'consolidation-start', 'consolidation-end');
      
      const measure = performance.getEntriesByName('duplicate-consolidation')[0];
      
      expect(result).toBeDefined();
      expect(measure.duration).toBeLessThan(15000); // Less than 15 seconds
    });

    test('should handle batch operations efficiently', async () => {
      await createProjectWithDuplicates(tempDir, 200);
      
      const consolidationManager = new ConsolidationManager();
      
      performance.mark('batch-consolidation-start');
      const result = await consolidationManager.processBatches(tempDir);
      performance.mark('batch-consolidation-end');
      performance.measure('batch-consolidation', 'batch-consolidation-start', 'batch-consolidation-end');
      
      const measure = performance.getEntriesByName('batch-consolidation')[0];
      
      expect(result).toBeDefined();
      expect(measure.duration).toBeLessThan(60000); // Less than 1 minute
    });
  });

  describe('Pattern Standardization Performance', () => {
    test('should standardize patterns across large codebase', async () => {
      await createProjectWithPatternIssues(tempDir, 100);
      
      const patternStandardizer = new PatternStandardizer();
      
      performance.mark('standardization-start');
      const result = await patternStandardizer.standardizePatterns(tempDir);
      performance.mark('standardization-end');
      performance.measure('pattern-standardization', 'standardization-start', 'standardization-end');
      
      const measure = performance.getEntriesByName('pattern-standardization')[0];
      
      expect(result).toBeDefined();
      expect(measure.duration).toBeLessThan(45000); // Less than 45 seconds
    });
  });

  describe('Drift Detection Performance', () => {
    test('should detect drift in reasonable time', async () => {
      await createProjectWithDrift(tempDir, 75);
      
      const driftDetectionService = new DriftDetectionService();
      
      performance.mark('drift-detection-start');
      const result = await driftDetectionService.detectDrift(tempDir);
      performance.mark('drift-detection-end');
      performance.measure('drift-detection', 'drift-detection-start', 'drift-detection-end');
      
      const measure = performance.getEntriesByName('drift-detection')[0];
      
      expect(result).toBeDefined();
      expect(measure.duration).toBeLessThan(20000); // Less than 20 seconds
    });
  });

  describe('Memory Usage Benchmarks', () => {
    test('should maintain reasonable memory usage during analysis', async () => {
      await createTestProject(tempDir, 500);
      
      const initialMemory = process.memoryUsage();
      
      const analysisService = new AnalysisService();
      await analysisService.analyzeProject(tempDir);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be less than 100MB for 500 files
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });

    test('should handle memory pressure gracefully', async () => {
      await createTestProject(tempDir, 2000); // Very large project
      
      const analysisService = new AnalysisService();
      
      // This test should not crash or throw out-of-memory errors
      const result = await analysisService.analyzeProject(tempDir);
      
      expect(result).toBeDefined();
      expect(result.files).toHaveLength(2000);
    });
  });

  describe('Concurrent Operation Benchmarks', () => {
    test('should handle multiple concurrent analyses', async () => {
      const projects = await Promise.all([
        createTestProject(path.join(tempDir, 'project1'), 25),
        createTestProject(path.join(tempDir, 'project2'), 25),
        createTestProject(path.join(tempDir, 'project3'), 25),
        createTestProject(path.join(tempDir, 'project4'), 25),
      ]);
      
      const analysisService = new AnalysisService();
      
      performance.mark('concurrent-analysis-start');
      
      const results = await Promise.all([
        analysisService.analyzeProject(path.join(tempDir, 'project1')),
        analysisService.analyzeProject(path.join(tempDir, 'project2')),
        analysisService.analyzeProject(path.join(tempDir, 'project3')),
        analysisService.analyzeProject(path.join(tempDir, 'project4')),
      ]);
      
      performance.mark('concurrent-analysis-end');
      performance.measure('concurrent-analysis', 'concurrent-analysis-start', 'concurrent-analysis-end');
      
      const measure = performance.getEntriesByName('concurrent-analysis')[0];
      
      expect(results).toHaveLength(4);
      expect(measure.duration).toBeLessThan(60000); // Should complete within 1 minute
      
      // Verify all analyses completed successfully
      results.forEach((result, index) => {
        expect(result.files).toHaveLength(25);
      });
    });
  });

  describe('CLI Performance Benchmarks', () => {
    test('should execute CLI commands efficiently', async () => {
      await createTestProject(tempDir, 50);
      
      performance.mark('cli-analysis-start');
      
      try {
        const output = execSync(`node ./bin/wundr.js analyze --path ${tempDir}`, {
          timeout: 30000,
          encoding: 'utf-8'
        });
        
        performance.mark('cli-analysis-end');
        performance.measure('cli-analysis', 'cli-analysis-start', 'cli-analysis-end');
        
        const measure = performance.getEntriesByName('cli-analysis')[0];
        
        expect(output).toContain('Analysis complete');
        expect(measure.duration).toBeLessThan(25000); // Less than 25 seconds
      } catch (error) {
        console.error('CLI execution failed:', error);
        throw error;
      }
    });
  });

  // Helper functions for creating test projects
  async function createTestProject(dir: string, fileCount: number) {
    await fs.mkdir(path.join(dir, 'src'), { recursive: true });
    
    for (let i = 0; i < fileCount; i++) {
      const content = generateTypeScriptFile(i);
      await fs.writeFile(path.join(dir, `src/file${i}.ts`), content);
    }
    
    await fs.writeFile(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: `test-project-${fileCount}`, version: '1.0.0' })
    );
  }

  async function createProjectWithDuplicates(dir: string, fileCount: number) {
    await fs.mkdir(path.join(dir, 'src'), { recursive: true });
    
    const duplicateCode = `
      function validateEmail(email: string): boolean {
        return /^[^@]+@[^@]+\\.[^@]+$/.test(email);
      }
      
      function formatDate(date: Date): string {
        return date.toISOString().split('T')[0];
      }
    `;
    
    for (let i = 0; i < fileCount; i++) {
      const content = `
        ${duplicateCode}
        
        export class Module${i} {
          private id = ${i};
          
          validate(email: string) {
            return validateEmail(email);
          }
          
          format(date: Date) {
            return formatDate(date);
          }
        }
      `;
      await fs.writeFile(path.join(dir, `src/duplicate${i}.ts`), content);
    }
  }

  async function createProjectWithPatternIssues(dir: string, fileCount: number) {
    await fs.mkdir(path.join(dir, 'src'), { recursive: true });
    
    for (let i = 0; i < fileCount; i++) {
      const content = `
        // Pattern issues: string throws, promise chains, etc.
        export class PatternIssue${i} {
          process() {
            if (Math.random() < 0.5) {
              throw 'String error message'; // Issue: string throw
            }
            
            return fetch('api/data')
              .then(response => response.json())  // Issue: promise chain
              .then(data => this.transform(data))
              .catch(error => {
                throw 'Processing failed'; // Issue: string throw
              });
          }
          
          transform(data: any) {
            return data && data.items ? data.items : []; // Issue: no optional chaining
          }
        }
      `;
      await fs.writeFile(path.join(dir, `src/pattern${i}.ts`), content);
    }
  }

  async function createProjectWithDrift(dir: string, fileCount: number) {
    await fs.mkdir(path.join(dir, 'src'), { recursive: true });
    
    for (let i = 0; i < fileCount; i++) {
      const content = `
        // Drift issues: inconsistent patterns, naming conventions, etc.
        export class DriftExample${i} {
          private data_value = ${i}; // Issue: snake_case vs camelCase
          private dataValue = ${i + 1};
          
          getData() { // Issue: inconsistent method naming
            return this.data_value;
          }
          
          get_data_value() { // Issue: snake_case method name
            return this.dataValue;
          }
        }
      `;
      await fs.writeFile(path.join(dir, `src/drift${i}.ts`), content);
    }
  }

  function generateTypeScriptFile(index: number): string {
    return `
      import { BaseService } from '../core/BaseService';
      
      export interface DataInterface${index} {
        id: number;
        name: string;
        active: boolean;
      }
      
      export class DataService${index} extends BaseService {
        private data: DataInterface${index}[] = [];
        
        constructor() {
          super('DataService${index}');
        }
        
        async loadData(): Promise<DataInterface${index}[]> {
          // Simulate async operation
          return new Promise((resolve) => {
            setTimeout(() => {
              this.data = Array.from({ length: 10 }, (_, i) => ({
                id: i + ${index} * 10,
                name: \`Item \${i + ${index} * 10}\`,
                active: Math.random() > 0.5
              }));
              resolve(this.data);
            }, Math.random() * 100);
          });
        }
        
        filterData(predicate: (item: DataInterface${index}) => boolean): DataInterface${index}[] {
          return this.data.filter(predicate);
        }
        
        findById(id: number): DataInterface${index} | undefined {
          return this.data.find(item => item.id === id);
        }
        
        updateItem(id: number, updates: Partial<DataInterface${index}>): boolean {
          const index = this.data.findIndex(item => item.id === id);
          if (index === -1) return false;
          
          this.data[index] = { ...this.data[index], ...updates };
          return true;
        }
      }
    `;
  }

  function generatePerformanceReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalMeasurements: performanceData.length,
        averageDuration: performanceData.reduce((sum, entry) => sum + entry.duration, 0) / performanceData.length,
        measurements: performanceData.map(entry => ({
          name: entry.name,
          duration: entry.duration,
          startTime: entry.startTime
        }))
      },
      benchmarks: {
        smallProjectAnalysis: performanceData.find(entry => entry.name === 'small-project-analysis')?.duration || 0,
        mediumProjectAnalysis: performanceData.find(entry => entry.name === 'medium-project-analysis')?.duration || 0,
        largeProjectAnalysis: performanceData.find(entry => entry.name === 'large-project-analysis')?.duration || 0,
        duplicateConsolidation: performanceData.find(entry => entry.name === 'duplicate-consolidation')?.duration || 0,
        patternStandardization: performanceData.find(entry => entry.name === 'pattern-standardization')?.duration || 0,
        driftDetection: performanceData.find(entry => entry.name === 'drift-detection')?.duration || 0,
        concurrentAnalysis: performanceData.find(entry => entry.name === 'concurrent-analysis')?.duration || 0,
        cliAnalysis: performanceData.find(entry => entry.name === 'cli-analysis')?.duration || 0,
      }
    };
    
    // Write performance report
    try {
      const reportPath = path.join(process.cwd(), 'performance-report.json');
      require('fs').writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`Performance report generated: ${reportPath}`);
    } catch (error) {
      console.error('Could not write performance report:', error);
    }
  }
});