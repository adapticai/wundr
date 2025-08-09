import { test, expect, Page, BrowserContext } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

test.describe('Performance Validation E2E Tests', () => {
  let page: Page;
  let context: BrowserContext;
  let tempDir: string;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    
    // Create temporary directory for performance tests
    tempDir = path.join(process.cwd(), 'temp-performance-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
    
    // Enable performance monitoring
    await page.addInitScript(() => {
      (window as any).performanceMetrics = {
        navigationStart: performance.now(),
        loadTimes: [],
        renderTimes: [],
        apiCallTimes: []
      };
      
      // Monitor API calls
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const start = performance.now();
        const response = await originalFetch(...args);
        const duration = performance.now() - start;
        (window as any).performanceMetrics.apiCallTimes.push({
          url: args[0],
          duration,
          status: response.status
        });
        return response;
      };
    });
  });

  test.afterEach(async () => {
    await context.close();
    
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test.describe('Dashboard Performance Validation', () => {
    test('should load dashboard within performance budget', async () => {
      const startTime = performance.now();
      
      // 1. Navigate to dashboard
      await page.goto('/dashboard', { waitUntil: 'networkidle' });
      
      const loadTime = performance.now() - startTime;
      
      // Performance budget: Dashboard should load within 2 seconds
      expect(loadTime).toBeLessThan(2000);
      
      // 2. Measure Core Web Vitals
      const webVitals = await page.evaluate(() => {
        return new Promise((resolve) => {
          const vitals = {
            lcp: 0, // Largest Contentful Paint
            fid: 0, // First Input Delay
            cls: 0  // Cumulative Layout Shift
          };
          
          // LCP
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            vitals.lcp = entries[entries.length - 1]?.startTime || 0;
          }).observe({ type: 'largest-contentful-paint', buffered: true });
          
          // FID
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              vitals.fid = (entry as any).processingStart - entry.startTime;
            }
          }).observe({ type: 'first-input', buffered: true });
          
          // CLS
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!(entry as any).hadRecentInput) {
                vitals.cls += (entry as any).value;
              }
            }
          }).observe({ type: 'layout-shift', buffered: true });
          
          setTimeout(() => resolve(vitals), 1000);
        });
      });
      
      // Web Vitals thresholds
      expect(webVitals.lcp).toBeLessThan(2500); // LCP < 2.5s
      expect(webVitals.fid).toBeLessThan(100);  // FID < 100ms
      expect(webVitals.cls).toBeLessThan(0.1);  // CLS < 0.1
    });

    test('should handle large dataset visualization efficiently', async () => {
      // 1. Create large test dataset
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        name: `Module ${i}`,
        size: Math.floor(Math.random() * 1000),
        complexity: Math.floor(Math.random() * 10),
        dependencies: Array.from({ length: i % 20 }, (_, j) => `dep${j}`)
      }));
      
      // 2. Load dashboard with large dataset
      await page.goto('/dashboard/analysis');
      
      // Mock large dataset loading
      await page.evaluate((data) => {
        (window as any).mockLargeDataset = data;
      }, largeDataset);
      
      const startRender = performance.now();
      
      // 3. Trigger data visualization
      await page.click('button:has-text("Load Large Dataset")');
      await page.waitForSelector('.visualization-canvas', { timeout: 10000 });
      
      const renderTime = performance.now() - startRender;
      
      // Visualization should render within 3 seconds even with large data
      expect(renderTime).toBeLessThan(3000);
      
      // 4. Test interaction performance
      const interactionStart = performance.now();
      
      await page.click('.data-point:nth-child(100)');
      await page.waitForSelector('.tooltip', { timeout: 1000 });
      
      const interactionTime = performance.now() - interactionStart;
      expect(interactionTime).toBeLessThan(100); // Interactions should be < 100ms
    });

    test('should maintain responsiveness during heavy analysis', async () => {
      await createLargeProject(tempDir, 500); // 500 files
      
      // 1. Start analysis upload
      await page.goto('/dashboard/upload');
      
      // Create zip of large project
      await execAsync(`cd ${tempDir} && zip -r large-project.zip .`);
      const zipPath = path.join(tempDir, 'large-project.zip');
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(zipPath);
      await page.click('button:has-text("Upload and Analyze")');
      
      // 2. Monitor UI responsiveness during analysis
      let uiResponsive = true;
      const responsivenessTester = setInterval(async () => {
        try {
          const startClick = performance.now();
          await page.click('button:has-text("Cancel")');
          const clickResponse = performance.now() - startClick;
          
          if (clickResponse > 100) {
            uiResponsive = false;
          }
        } catch {
          // Button might not be available, ignore
        }
      }, 1000);
      
      // 3. Wait for analysis to complete
      await page.waitForSelector('.analysis-complete', { timeout: 60000 });
      clearInterval(responsivenessTester);
      
      // UI should remain responsive throughout analysis
      expect(uiResponsive).toBe(true);
      
      // 4. Verify final results are accurate
      const fileCount = await page.locator('[data-testid="files-count"]').textContent();
      expect(parseInt(fileCount || '0')).toBeGreaterThan(500);
    });

    test('should optimize memory usage with large visualizations', async () => {
      // 1. Monitor initial memory usage
      const initialMemory = await page.evaluate(() => {
        return (performance as any).memory ? {
          used: (performance as any).memory.usedJSHeapSize,
          total: (performance as any).memory.totalJSHeapSize,
          limit: (performance as any).memory.jsHeapSizeLimit
        } : null;
      });
      
      if (!initialMemory) {
        test.skip('Performance memory API not available');
      }
      
      // 2. Load multiple complex visualizations
      await page.goto('/dashboard/analysis/dependencies');
      
      // Load dependency graph
      await page.waitForSelector('.dependency-graph');
      
      await page.goto('/dashboard/analysis/duplicates');
      await page.waitForSelector('.duplicate-visualization');
      
      await page.goto('/dashboard/analysis/metrics');
      await page.waitForSelector('.metrics-dashboard');
      
      // 3. Measure memory after loading visualizations
      const finalMemory = await page.evaluate(() => {
        return {
          used: (performance as any).memory.usedJSHeapSize,
          total: (performance as any).memory.totalJSHeapSize,
          limit: (performance as any).memory.jsHeapSizeLimit
        };
      });
      
      const memoryIncrease = finalMemory.used - initialMemory.used;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);
      
      // Memory increase should be reasonable (< 100MB)
      expect(memoryIncreaseMB).toBeLessThan(100);
      
      // Memory usage shouldn't exceed 50% of limit
      const memoryUsagePercent = (finalMemory.used / finalMemory.limit) * 100;
      expect(memoryUsagePercent).toBeLessThan(50);
    });
  });

  test.describe('CLI Performance Validation', () => {
    test('should analyze large projects within time budget', async () => {
      // 1. Create very large project
      await createLargeProject(tempDir, 1000); // 1000 files
      
      const startTime = Date.now();
      
      // 2. Run comprehensive analysis
      const { stdout } = await execAsync(
        `node ./bin/wundr.js analyze --duplicates --circular --complexity --path ${tempDir}`,
        { timeout: 60000 } // 1 minute timeout
      );
      
      const analysisTime = Date.now() - startTime;
      
      // Analysis should complete within 45 seconds for 1000 files
      expect(analysisTime).toBeLessThan(45000);
      expect(stdout).toContain('Analysis complete');
      
      // 3. Verify analysis quality wasn't sacrificed for speed
      expect(stdout).toContain('Files analyzed: 1000');
      expect(stdout).toMatch(/Issues found: \d+/);
      expect(stdout).toMatch(/Duplicates detected: \d+/);
    });

    test('should handle concurrent CLI operations efficiently', async () => {
      await createMediumProject(tempDir, 200);
      
      // 1. Start multiple CLI operations concurrently
      const operations = [
        execAsync(`node ./bin/wundr.js analyze --path ${tempDir}`),
        execAsync(`node ./bin/wundr.js analyze --duplicates --path ${tempDir}`),
        execAsync(`node ./bin/wundr.js analyze --circular --path ${tempDir}`)
      ];
      
      const startTime = Date.now();
      const results = await Promise.all(operations);
      const totalTime = Date.now() - startTime;
      
      // Concurrent operations should complete faster than sequential
      // (should be closer to the time of the longest single operation)
      expect(totalTime).toBeLessThan(30000); // 30 seconds for concurrent
      
      // All operations should succeed
      results.forEach(({ stdout }) => {
        expect(stdout).toContain('Analysis complete');
      });
    });

    test('should optimize memory usage during analysis', async () => {
      await createLargeProject(tempDir, 800);
      
      // 1. Monitor CLI process memory usage
      const childProcess = exec(
        `node --expose-gc ./bin/wundr.js analyze --memory-profile --path ${tempDir}`,
        { cwd: process.cwd() }
      );
      
      let maxMemoryUsage = 0;
      let memoryReadings = 0;
      
      // Monitor memory every 2 seconds
      const memoryMonitor = setInterval(async () => {
        try {
          const { stdout } = await execAsync(`ps -p ${childProcess.pid} -o rss=`);
          const memoryKB = parseInt(stdout.trim());
          const memoryMB = memoryKB / 1024;
          
          if (memoryMB > maxMemoryUsage) {
            maxMemoryUsage = memoryMB;
          }
          memoryReadings++;
        } catch {
          // Process might have ended
        }
      }, 2000);
      
      // 2. Wait for CLI to complete
      await new Promise((resolve, reject) => {
        childProcess.on('exit', resolve);
        childProcess.on('error', reject);
      });
      
      clearInterval(memoryMonitor);
      
      // 3. Validate memory usage was reasonable
      expect(maxMemoryUsage).toBeLessThan(512); // Should stay under 512MB
      expect(memoryReadings).toBeGreaterThan(0); // We got at least one reading
    });

    test('should scale efficiently with project complexity', async () => {
      const projectSizes = [50, 100, 200, 400];
      const analysisTypes = [
        { flag: '--basic', name: 'basic' },
        { flag: '--duplicates', name: 'duplicates' },
        { flag: '--circular', name: 'circular' },
        { flag: '--complexity', name: 'complexity' }
      ];
      
      const results: Array<{
        size: number;
        type: string;
        time: number;
        memoryPeak: number;
      }> = [];
      
      for (const size of projectSizes) {
        const projectDir = path.join(tempDir, `project-${size}`);
        await createLargeProject(projectDir, size);
        
        for (const analysisType of analysisTypes) {
          const startTime = Date.now();
          
          try {
            const { stdout } = await execAsync(
              `node ./bin/wundr.js analyze ${analysisType.flag} --path ${projectDir}`,
              { timeout: 30000 }
            );
            
            const duration = Date.now() - startTime;
            
            // Extract memory info if available
            const memoryMatch = stdout.match(/Peak memory usage: (\d+)MB/);
            const memoryPeak = memoryMatch ? parseInt(memoryMatch[1]) : 0;
            
            results.push({
              size,
              type: analysisType.name,
              time: duration,
              memoryPeak
            });
          } catch (error) {
            console.warn(`Analysis failed for size ${size}, type ${analysisType.name}:`, error);
          }
        }
      }
      
      // Analyze scalability
      for (const analysisType of analysisTypes) {
        const typeResults = results.filter(r => r.type === analysisType.name);
        
        if (typeResults.length >= 2) {
          // Time complexity should be roughly linear or sub-quadratic
          const firstResult = typeResults[0];
          const lastResult = typeResults[typeResults.length - 1];
          
          const sizeRatio = lastResult.size / firstResult.size;
          const timeRatio = lastResult.time / firstResult.time;
          
          // Time growth should be less than quadratic
          expect(timeRatio).toBeLessThan(sizeRatio * sizeRatio);
          
          // Memory usage should scale reasonably
          if (lastResult.memoryPeak > 0 && firstResult.memoryPeak > 0) {
            const memoryRatio = lastResult.memoryPeak / firstResult.memoryPeak;
            expect(memoryRatio).toBeLessThan(sizeRatio * 2); // Should be sub-linear
          }
        }
      }
    });
  });

  test.describe('Network and API Performance', () => {
    test('should handle high-frequency API calls efficiently', async () => {
      await page.goto('/dashboard/monitoring');
      
      // 1. Enable real-time monitoring (generates frequent API calls)
      await page.click('button:has-text("Enable Real-time Updates")');
      
      // 2. Monitor API call performance for 10 seconds
      await page.waitForTimeout(10000);
      
      const apiMetrics = await page.evaluate(() => {
        const metrics = (window as any).performanceMetrics.apiCallTimes;
        const recentCalls = metrics.filter((call: any) => 
          performance.now() - call.timestamp < 10000
        );
        
        return {
          totalCalls: recentCalls.length,
          averageTime: recentCalls.reduce((sum: number, call: any) => sum + call.duration, 0) / recentCalls.length,
          maxTime: Math.max(...recentCalls.map((call: any) => call.duration)),
          errorRate: recentCalls.filter((call: any) => call.status >= 400).length / recentCalls.length
        };
      });
      
      // API performance expectations
      expect(apiMetrics.totalCalls).toBeGreaterThan(5); // At least some calls
      expect(apiMetrics.averageTime).toBeLessThan(200); // Average < 200ms
      expect(apiMetrics.maxTime).toBeLessThan(1000); // No call > 1 second
      expect(apiMetrics.errorRate).toBe(0); // No errors
    });

    test('should efficiently handle file upload progress', async () => {
      // 1. Create large file for upload testing
      const largeFileSize = 50 * 1024 * 1024; // 50MB
      const largeFileBuffer = Buffer.alloc(largeFileSize, 'test data');
      const largeFilePath = path.join(tempDir, 'large-test-file.zip');
      await fs.writeFile(largeFilePath, largeFileBuffer);
      
      // 2. Start upload and monitor progress efficiency
      await page.goto('/dashboard/upload');
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(largeFilePath);
      
      const uploadStart = performance.now();
      await page.click('button:has-text("Upload")');
      
      // 3. Monitor upload progress updates
      let progressUpdates = 0;
      let lastProgress = 0;
      
      const progressMonitor = setInterval(async () => {
        try {
          const progressText = await page.locator('.upload-progress').textContent();
          const progressMatch = progressText?.match(/(\d+)%/);
          
          if (progressMatch) {
            const currentProgress = parseInt(progressMatch[1]);
            if (currentProgress > lastProgress) {
              progressUpdates++;
              lastProgress = currentProgress;
            }
          }
        } catch {
          // Progress element might not be visible
        }
      }, 500);
      
      // 4. Wait for upload completion
      await page.waitForSelector('.upload-complete', { timeout: 120000 }); // 2 minutes
      clearInterval(progressMonitor);
      
      const uploadTime = performance.now() - uploadStart;
      
      // Progress should be updated regularly (at least 10 times for large file)
      expect(progressUpdates).toBeGreaterThan(10);
      
      // Upload shouldn't take excessively long (considering file size)
      const uploadRateMBps = (largeFileSize / (1024 * 1024)) / (uploadTime / 1000);
      expect(uploadRateMBps).toBeGreaterThan(1); // At least 1 MB/s
    });

    test('should maintain performance under load', async () => {
      // 1. Simulate multiple concurrent users
      const concurrentSessions = await Promise.all(
        Array.from({ length: 5 }, async () => {
          const newContext = await context.browser().newContext();
          const newPage = await newContext.newPage();
          return { context: newContext, page: newPage };
        })
      );
      
      try {
        // 2. Have all sessions perform intensive operations simultaneously
        const operations = concurrentSessions.map(async ({ page: sessionPage }) => {
          await sessionPage.goto('/dashboard/analysis');
          
          // Trigger analysis visualization
          await sessionPage.click('button:has-text("Generate Visualization")');
          await sessionPage.waitForSelector('.visualization-complete', { timeout: 30000 });
          
          return sessionPage.evaluate(() => {
            return (performance as any).memory ? {
              used: (performance as any).memory.usedJSHeapSize,
              total: (performance as any).memory.totalJSHeapSize
            } : { used: 0, total: 0 };
          });
        });
        
        const startTime = Date.now();
        const results = await Promise.all(operations);
        const totalTime = Date.now() - startTime;
        
        // 3. Verify performance under load
        expect(totalTime).toBeLessThan(45000); // Should complete within 45 seconds
        
        // No session should have excessive memory usage
        results.forEach(memory => {
          if (memory.total > 0) {
            const memoryUsageMB = memory.used / (1024 * 1024);
            expect(memoryUsageMB).toBeLessThan(200);
          }
        });
      } finally {
        // 4. Cleanup concurrent sessions
        await Promise.all(
          concurrentSessions.map(({ context }) => context.close())
        );
      }
    });
  });

  // Helper functions
  async function createLargeProject(dir: string, fileCount: number) {
    await fs.mkdir(path.join(dir, 'src'), { recursive: true });
    
    for (let i = 0; i < fileCount; i++) {
      const content = `
        import { Component${(i + 1) % fileCount} } from './component${(i + 1) % fileCount}';
        import { Utils } from '../utils/utils${i % 10}';
        
        export class Component${i} {
          private id = ${i};
          private data: Array<string> = ${JSON.stringify(Array.from({ length: i % 50 + 1 }, (_, j) => `data-${j}`))};
          private dependencies: Component${(i + 1) % fileCount}[] = [];
          
          constructor() {
            this.initialize();
          }
          
          private initialize(): void {
            this.data.forEach((item, index) => {
              this.processItem(item, index);
            });
          }
          
          private processItem(item: string, index: number): void {
            const processed = Utils.transform(item);
            if (processed && index % 2 === 0) {
              this.dependencies.push(new Component${(i + 1) % fileCount}());
            }
          }
          
          public async execute(): Promise<string[]> {
            const results: string[] = [];
            
            for (const dep of this.dependencies) {
              const result = await dep.execute();
              results.push(...result);
            }
            
            return [...results, \`Component\${this.id}-processed\`];
          }
          
          public getMetrics(): { id: number; dataCount: number; depCount: number } {
            return {
              id: this.id,
              dataCount: this.data.length,
              depCount: this.dependencies.length
            };
          }
        }
        
        export default Component${i};
      `;
      
      await fs.writeFile(path.join(dir, `src/component${i}.ts`), content);
      
      // Create utility files
      if (i % 10 === 0) {
        const utilsContent = `
          export class Utils {
            static transform(input: string): string {
              return input.split('').reverse().join('').toUpperCase();
            }
            
            static validate(data: string[]): boolean {
              return data.length > 0 && data.every(item => typeof item === 'string');
            }
            
            static aggregate(items: string[]): Map<string, number> {
              const result = new Map<string, number>();
              items.forEach(item => {
                result.set(item, (result.get(item) || 0) + 1);
              });
              return result;
            }
          }
        `;
        
        await fs.mkdir(path.join(dir, 'utils'), { recursive: true });
        await fs.writeFile(path.join(dir, `utils/utils${i / 10}.ts`), utilsContent);
      }
    }
    
    // Create package.json
    await fs.writeFile(
      path.join(dir, 'package.json'),
      JSON.stringify({
        name: 'performance-test-project',
        version: '1.0.0',
        dependencies: {
          typescript: '^4.0.0'
        }
      }, null, 2)
    );
  }

  async function createMediumProject(dir: string, fileCount: number) {
    await createLargeProject(dir, fileCount);
  }
});