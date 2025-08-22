import { test, expect, Page, BrowserContext } from '@playwright/test';
import { promises as fs } from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

test.describe('Scalability and Memory Management', () => {
  let page: Page;
  let context: BrowserContext;
  let tempDir: string;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    
    // Create temporary directory for scalability tests
    tempDir = path.join(process.cwd(), 'temp-scalability-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
  });

  test.afterEach(async () => {
    await context.close();
    
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test('should handle analysis without memory exhaustion', async () => {
    // 1. Create memory-intensive project
    await createMemoryIntensiveProject(tempDir, 2000); // 2000 files
    
    // 2. Monitor memory usage during analysis
    const memoryBefore = process.memoryUsage();
    
    const childProcess = exec(
      `node --max-old-space-size=1024 ./bin/wundr.js analyze --memory-profile --path ${tempDir}`,
      { cwd: process.cwd() }
    );
    
    let maxMemoryUsage = 0;
    const memoryMonitor = setInterval(async () => {
      try {
        const { stdout } = await execAsync(`ps -p ${childProcess.pid} -o rss=`);
        const memoryKB = parseInt(stdout.trim());
        const memoryMB = memoryKB / 1024;
        
        if (memoryMB > maxMemoryUsage) {
          maxMemoryUsage = memoryMB;
        }
      } catch {
        // Process might have ended
      }
    }, 1000);
    
    // 3. Wait for completion
    await new Promise((resolve, reject) => {
      childProcess.on('exit', (code) => {
        if (code === 0) {
          resolve(code);
        } else {
          reject(new Error(`Process exited with code ${code}`));
        }
      });
      childProcess.on('error', reject);
    });
    
    clearInterval(memoryMonitor);
    
    // Memory usage should stay within limits
    expect(maxMemoryUsage).toBeLessThan(800); // Should stay under 800MB
    
    // 4. Verify analysis completed successfully
    const outputFiles = await fs.readdir(tempDir);
    expect(outputFiles.some(file => file.includes('analysis') || file.includes('report'))).toBe(true);
  });

  test('should provide incremental analysis for large projects', async () => {
    // 1. Create baseline project
    await createLargeProject(tempDir, 1000);
    
    // 2. Run initial analysis
    await execAsync(
      `node ./bin/wundr.js analyze --baseline --output ${tempDir}/baseline.json --path ${tempDir}`
    );
    
    const baselineExists = await fs.access(path.join(tempDir, 'baseline.json'))
      .then(() => true).catch(() => false);
    expect(baselineExists).toBe(true);
    
    // 3. Make incremental changes
    const newFilesDir = path.join(tempDir, 'src/new-features');
    await fs.mkdir(newFilesDir, { recursive: true });
    
    for (let i = 0; i < 50; i++) {
      await fs.writeFile(
        path.join(newFilesDir, `feature${i}.ts`),
        `export class Feature${i} { process() { return "feature-${i}"; } }`
      );
    }
    
    // 4. Run incremental analysis
    const startIncremental = Date.now();
    
    const { stdout } = await execAsync(
      `node ./bin/wundr.js analyze --incremental --baseline ${tempDir}/baseline.json --path ${tempDir}`
    );
    
    const incrementalTime = Date.now() - startIncremental;
    
    expect(stdout).toContain('Incremental analysis complete');
    expect(stdout).toContain('New files detected:');
    expect(stdout).toMatch(/New files detected: 5\d/); // Should detect ~50 new files
    
    // Incremental analysis should be much faster
    expect(incrementalTime).toBeLessThan(30000); // Under 30 seconds
    
    // 5. Verify incremental results in dashboard
    await execAsync(
      `node ./bin/wundr.js analyze --incremental --baseline ${tempDir}/baseline.json --report --output ${tempDir}/incremental-analysis.json --path ${tempDir}`
    );
    
    await page.goto('/dashboard/upload');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(tempDir, 'incremental-analysis.json'));
    await page.click('button:has-text("Upload Analysis")');
    
    await page.goto('/dashboard/analysis/changes');
    
    // Should show incremental changes
    await expect(page.locator('.incremental-summary')).toBeVisible();
    await expect(page.locator('.new-files')).toContainText('50');
    await expect(page.locator('.changed-files')).toBeVisible();
  });

  test('should handle concurrent analysis of multiple large projects', async () => {
    // 1. Create multiple project directories
    const project1Dir = path.join(tempDir, 'project1');
    const project2Dir = path.join(tempDir, 'project2');
    const project3Dir = path.join(tempDir, 'project3');
    
    await Promise.all([
      createLargeProject(project1Dir, 500),
      createLargeProject(project2Dir, 500),
      createLargeProject(project3Dir, 500)
    ]);
    
    // 2. Run concurrent analyses
    const startTime = Date.now();
    
    const analyses = await Promise.all([
      execAsync(`node ./bin/wundr.js analyze --output ${project1Dir}/analysis.json --path ${project1Dir}`),
      execAsync(`node ./bin/wundr.js analyze --output ${project2Dir}/analysis.json --path ${project2Dir}`),
      execAsync(`node ./bin/wundr.js analyze --output ${project3Dir}/analysis.json --path ${project3Dir}`)
    ]);
    
    const totalTime = Date.now() - startTime;
    
    // All analyses should complete successfully
    analyses.forEach(({ stdout }) => {
      expect(stdout).toContain('Analysis complete');
      expect(stdout).toContain('Files analyzed: 500');
    });
    
    // Concurrent execution should be faster than sequential
    expect(totalTime).toBeLessThan(120000); // Under 2 minutes total
    
    // 3. Load all analyses into dashboard
    await page.goto('/dashboard/projects');
    
    for (let i = 1; i <= 3; i++) {
      await page.click('button:has-text("Import Project")');
      
      const modal = page.locator('.import-modal');
      await expect(modal).toBeVisible();
      
      const fileInput = modal.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(tempDir, `project${i}`, 'analysis.json'));
      
      await page.fill('input[name="project-name"]', `Large Project ${i}`);
      await page.click('button:has-text("Import")');
      
      await expect(page.locator('.import-success')).toBeVisible();
      await page.click('button:has-text("Close")');
    }
    
    // 4. Verify all projects are listed
    const projectItems = page.locator('.project-item');
    await expect(projectItems).toHaveCount(3);
    
    // 5. Test cross-project comparison
    await page.click('button:has-text("Compare Projects")');
    await page.check('input[value="Large Project 1"]');
    await page.check('input[value="Large Project 2"]');
    await page.click('button:has-text("Generate Comparison")');
    
    await expect(page.locator('.comparison-results')).toBeVisible();
    const comparisonMetricCount = await page.locator('.comparison-metric').count();
    expect(comparisonMetricCount).toBeGreaterThan(5);
  });

  test('should optimize memory usage during large file processing', async () => {
    // 1. Create extremely large files
    await createLargeFilesProject(tempDir);
    
    // 2. Monitor memory usage during processing
    const memoryBefore = process.memoryUsage();
    
    const { stdout } = await execAsync(
      `node --max-old-space-size=512 ./bin/wundr.js analyze --streaming --chunk-size 1000 --path ${tempDir}`,
      { timeout: 300000 } // 5 minutes timeout
    );
    
    expect(stdout).toContain('Streaming analysis complete');
    expect(stdout).toContain('Memory optimized');
    
    // 3. Verify results accuracy despite streaming
    const analysisFile = path.join(tempDir, 'streaming-analysis.json');
    expect(await fs.access(analysisFile).then(() => true).catch(() => false)).toBe(true);
    
    const analysisData = JSON.parse(await fs.readFile(analysisFile, 'utf-8'));
    expect(analysisData.summary.totalFiles).toBeGreaterThan(100);
    expect(analysisData.summary.processedInChunks).toBe(true);
  });

  test('should provide real-time progress for long-running analyses', async () => {
    // 1. Create project that will take time to analyze
    await createTimeIntensiveProject(tempDir);
    
    // 2. Start analysis with progress reporting
    const childProcess = exec(
      `node ./bin/wundr.js analyze --progress --real-time --path ${tempDir}`,
      { cwd: process.cwd() }
    );
    
    const progressUpdates: string[] = [];
    
    // 3. Monitor progress updates
    childProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Progress:')) {
        progressUpdates.push(output.trim());
      }
    });
    
    // 4. Wait for completion
    await new Promise((resolve, reject) => {
      childProcess.on('exit', (code) => {
        if (code === 0) {
          resolve(code);
        } else {
          reject(new Error(`Process exited with code ${code}`));
        }
      });
      childProcess.on('error', reject);
    });
    
    // 5. Verify progress was reported
    expect(progressUpdates.length).toBeGreaterThan(5);
    expect(progressUpdates[0]).toMatch(/Progress: \d+%/);
    expect(progressUpdates[progressUpdates.length - 1]).toContain('Progress: 100%');
  });
});

// Helper functions for creating test projects
async function createMemoryIntensiveProject(dir: string, fileCount: number) {
  const srcDir = path.join(dir, 'src');
  await fs.mkdir(srcDir, { recursive: true });
  
  for (let i = 0; i < fileCount; i++) {
    await fs.writeFile(
      path.join(srcDir, `intensive${i}.ts`),
      `
export class MemoryIntensive${i} {
  private largeArray: number[][] = [];
  private dataCache: Map<string, any> = new Map();
  
  constructor() {
    // Create memory-intensive structures
    for (let j = 0; j < 1000; j++) {
      this.largeArray.push(Array.from({ length: 1000 }, () => Math.random()));
    }
    
    // Fill cache with data
    for (let k = 0; k < 10000; k++) {
      this.dataCache.set(\`key-\${k}\`, {
        data: Array.from({ length: 100 }, () => Math.random()),
        metadata: { created: Date.now(), accessed: 0 }
      });
    }
  }
  
  public processData(): number[][] {
    // Memory-intensive operations
    const result: number[][] = [];
    
    for (const row of this.largeArray) {
      const processedRow = row.map(val => {
        // Complex calculation
        let computed = val;
        for (let i = 0; i < 100; i++) {
          computed = Math.sin(computed) * Math.cos(computed);
        }
        return computed;
      });
      result.push(processedRow);
    }
    
    return result;
  }
}
      `
    );
  }
}

async function createLargeProject(dir: string, fileCount: number) {
  await fs.mkdir(dir, { recursive: true });
  
  for (let i = 0; i < fileCount; i++) {
    const content = `
      export class Component${i} {
        private id = ${i};
        private dependencies: string[] = ${JSON.stringify(Array.from({ length: i % 10 }, (_, j) => `dep${j}`))};
        
        public process(): Promise<string> {
          return new Promise((resolve) => {
            setTimeout(() => resolve(\`Component \${this.id} processed\`), 10);
          });
        }
        
        public getDependencies(): string[] {
          return this.dependencies;
        }
      }
      
      export default Component${i};
    `;
    
    await fs.writeFile(path.join(dir, `component${i}.ts`), content);
  }
}

async function createLargeFilesProject(dir: string) {
  const srcDir = path.join(dir, 'src');
  await fs.mkdir(srcDir, { recursive: true });
  
  // Create several very large files (simulating real-world large codebases)
  for (let i = 0; i < 20; i++) {
    let content = `// Large file ${i} with extensive content\n\n`;
    
    // Generate lots of classes and methods
    for (let j = 0; j < 100; j++) {
      content += `
export class LargeClass${i}_${j} {
  private data: any[] = [];
  private config: Record<string, any> = {};
  
  constructor() {
    this.initializeData();
    this.setupConfig();
  }
  
  private initializeData(): void {
    for (let k = 0; k < 50; k++) {
      this.data.push({
        id: \`item-\${k}\`,
        value: Math.random() * 1000,
        timestamp: Date.now(),
        metadata: {
          created: new Date().toISOString(),
          type: 'generated',
          index: k
        }
      });
    }
  }
  
  private setupConfig(): void {
    this.config = {
      maxItems: 1000,
      processTimeout: 30000,
      retryAttempts: 3,
      bufferSize: 8192,
      enableLogging: true,
      compressionLevel: 6
    };
  }
  
  public processData(): any[] {
    return this.data.map(item => ({
      ...item,
      processed: true,
      processedAt: Date.now()
    }));
  }
  
  public getData(): any[] {
    return [...this.data];
  }
  
  public getConfig(): Record<string, any> {
    return { ...this.config };
  }
}
      `;
    }
    
    await fs.writeFile(path.join(srcDir, `large-file-${i}.ts`), content);
  }
}

async function createTimeIntensiveProject(dir: string) {
  const srcDir = path.join(dir, 'src');
  await fs.mkdir(srcDir, { recursive: true });
  
  // Create many files that will take time to process
  for (let i = 0; i < 500; i++) {
    const content = `
// Time-intensive file ${i}
import { ComplexProcessor } from './complex-processor';
import { DataAnalyzer } from './data-analyzer';
import { PatternMatcher } from './pattern-matcher';

export class TimeIntensiveClass${i} {
  private processor = new ComplexProcessor();
  private analyzer = new DataAnalyzer();
  private matcher = new PatternMatcher();
  
  constructor() {
    this.initialize();
  }
  
  private initialize(): void {
    // Complex initialization logic
    const data = this.generateComplexData();
    this.processor.configure(data);
    this.analyzer.setup(data);
    this.matcher.loadPatterns(data);
  }
  
  private generateComplexData(): any {
    const data = [];
    for (let j = 0; j < 100; j++) {
      data.push({
        id: j,
        patterns: this.generatePatterns(j),
        calculations: this.performCalculations(j),
        relationships: this.mapRelationships(j)
      });
    }
    return data;
  }
  
  private generatePatterns(seed: number): any[] {
    // Complex pattern generation
    return Array.from({ length: 20 }, (_, i) => ({
      type: \`pattern-\${seed}-\${i}\`,
      weight: Math.sin(seed * i) * Math.cos(i),
      connections: Array.from({ length: 5 }, (_, k) => seed + i + k)
    }));
  }
  
  private performCalculations(input: number): any {
    // Mathematical calculations
    let result = input;
    for (let i = 0; i < 50; i++) {
      result = Math.sqrt(result * Math.PI + Math.E);
      result = Math.log(result + 1);
      result = Math.abs(result * Math.sin(i));
    }
    return { final: result, iterations: 50 };
  }
  
  private mapRelationships(nodeId: number): any[] {
    // Relationship mapping
    return Array.from({ length: 15 }, (_, i) => ({
      source: nodeId,
      target: (nodeId + i * 3) % 100,
      strength: Math.random(),
      type: i % 2 === 0 ? 'dependency' : 'association'
    }));
  }
  
  public process(): Promise<any> {
    return new Promise((resolve) => {
      // Simulate time-intensive processing
      setTimeout(() => {
        const results = {
          processed: true,
          timestamp: Date.now(),
          classId: ${i},
          complexity: this.calculateComplexity()
        };
        resolve(results);
      }, Math.random() * 100 + 50); // Random delay 50-150ms
    });
  }
  
  private calculateComplexity(): number {
    // Complex calculation
    let complexity = 0;
    for (let i = 0; i < 100; i++) {
      complexity += Math.pow(i, 2) * Math.log(i + 1);
    }
    return complexity;
  }
}

export default TimeIntensiveClass${i};
    `;
    
    await fs.writeFile(path.join(srcDir, `time-intensive-${i}.ts`), content);
  }
}