import { test, expect, Page, BrowserContext } from '@playwright/test';
import { promises as fs } from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

test.describe('Enterprise-Scale Project Analysis', () => {
  let page: Page;
  let context: BrowserContext;
  let tempDir: string;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    
    // Create temporary directory for large project tests
    tempDir = path.join(process.cwd(), 'temp-enterprise-analysis-' + Date.now());
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

  test('should analyze massive monorepo efficiently', async () => {
    // 1. Create enterprise-scale project structure
    await createEnterpriseMonorepo(tempDir);
    
    const startTime = Date.now();
    
    // 2. Run comprehensive analysis via CLI
    const { stdout } = await execAsync(
      `node ./bin/wundr.js analyze --comprehensive --output ${tempDir}/enterprise-analysis.json --path ${tempDir}`,
      { timeout: 180000 } // 3 minutes timeout for large project
    );
    
    const analysisTime = Date.now() - startTime;
    
    expect(stdout).toContain('Analysis complete');
    expect(stdout).toContain('Files analyzed:');
    expect(stdout).toMatch(/Files analyzed: [1-9]\d{3,}/); // Should analyze 1000+ files
    
    // Analysis should complete within 2.5 minutes for enterprise project
    expect(analysisTime).toBeLessThan(150000);
    
    // 3. Verify comprehensive analysis results
    const analysisFile = path.join(tempDir, 'enterprise-analysis.json');
    const analysisData = JSON.parse(await fs.readFile(analysisFile, 'utf-8'));
    
    expect(analysisData.summary.totalFiles).toBeGreaterThan(1000);
    expect(analysisData.summary.totalLinesOfCode).toBeGreaterThan(50000);
    expect(analysisData.duplicates).toBeDefined();
    expect(analysisData.circularDependencies).toBeDefined();
    expect(analysisData.complexityMetrics).toBeDefined();
    
    // 4. Load analysis into dashboard
    await page.goto('/dashboard/upload');
    
    const fileInput = page.locator('input[type="file"][accept=".json"]');
    await fileInput.setInputFiles(analysisFile);
    await page.click('button:has-text("Upload Analysis")');
    
    await expect(page.locator('.analysis-imported')).toBeVisible({ timeout: 30000 });
    
    // 5. Verify dashboard can handle large dataset
    await page.goto('/dashboard/analysis');
    
    // Dashboard should load without timeout
    await expect(page.locator('[data-testid="files-count"]')).toBeVisible({ timeout: 15000 });
    
    const displayedFileCount = await page.locator('[data-testid="files-count"]').textContent();
    expect(parseInt(displayedFileCount || '0')).toBeGreaterThan(1000);
  });

  test('should handle multi-language polyglot repository', async () => {
    // 1. Create polyglot project with multiple languages
    await createPolyglotProject(tempDir);
    
    // 2. Analyze with language-specific rules
    const { stdout } = await execAsync(
      `node ./bin/wundr.js analyze --languages typescript,javascript,python,java,go --path ${tempDir}`,
      { timeout: 120000 }
    );
    
    expect(stdout).toContain('Analysis complete');
    expect(stdout).toContain('Languages detected:');
    expect(stdout).toContain('TypeScript');
    expect(stdout).toContain('JavaScript');
    expect(stdout).toContain('Python');
    expect(stdout).toContain('Java');
    expect(stdout).toContain('Go');
    
    // 3. Verify language-specific metrics in dashboard
    await page.goto('/dashboard/upload');
    
    // Create and upload analysis
    await execAsync(
      `node ./bin/wundr.js analyze --languages typescript,javascript,python,java,go --report --output ${tempDir}/polyglot-analysis.json --path ${tempDir}`
    );
    
    const analysisFile = path.join(tempDir, 'polyglot-analysis.json');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(analysisFile);
    await page.click('button:has-text("Upload Analysis")');
    
    await page.goto('/dashboard/analysis/languages');
    
    // Verify language breakdown
    await expect(page.locator('.language-breakdown')).toBeVisible();
    const languageItemCount = await page.locator('.language-item').count();
    expect(languageItemCount).toBeGreaterThan(4);
    
    // Test language-specific filtering
    await page.selectOption('select[name="language-filter"]', 'typescript');
    await page.click('button:has-text("Apply Filter")');
    
    await expect(page.locator('.filtered-results')).toBeVisible();
    await expect(page.locator('.file-item')).toContainText('.ts');
  });

  test('should detect complex dependency patterns in large codebases', async () => {
    // 1. Create project with complex dependency patterns
    await createComplexDependencyProject(tempDir);
    
    // 2. Run dependency analysis
    const { stdout } = await execAsync(
      `node ./bin/wundr.js analyze --circular --dependency-depth 5 --path ${tempDir}`
    );
    
    expect(stdout).toContain('Circular dependencies detected:');
    expect(stdout).toContain('Dependency chains analyzed');
    expect(stdout).toMatch(/Maximum dependency depth: \d+/);
    
    // 3. Visualize complex dependencies in dashboard
    await execAsync(
      `node ./bin/wundr.js analyze --circular --dependency-depth 5 --report --output ${tempDir}/dependency-analysis.json --path ${tempDir}`
    );
    
    await page.goto('/dashboard/upload');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(tempDir, 'dependency-analysis.json'));
    await page.click('button:has-text("Upload Analysis")');
    
    await page.goto('/dashboard/analysis/dependencies');
    await page.waitForSelector('.dependency-graph', { timeout: 20000 });
    
    // Test complex dependency visualization
    const nodes = page.locator('.node');
    const edges = page.locator('.edge');
    
    const nodeCount = await nodes.count();
    const edgeCount = await edges.count();
    
    expect(nodeCount).toBeGreaterThan(50);
    expect(edgeCount).toBeGreaterThan(100);
    
    // Test circular dependency highlighting
    await page.click('button:has-text("Highlight Circular")');
    await expect(page.locator('.circular-highlight')).toBeVisible();
    
    // Test dependency path analysis
    await page.click('.node:first-child');
    await expect(page.locator('.dependency-path')).toBeVisible();
  });

  test('should identify performance bottlenecks in large applications', async () => {
    // 1. Create performance-heavy project
    await createPerformanceTestProject(tempDir);
    
    // 2. Run performance analysis
    const { stdout } = await execAsync(
      `node ./bin/wundr.js analyze --performance --memory-usage --path ${tempDir}`
    );
    
    expect(stdout).toContain('Performance analysis complete');
    expect(stdout).toContain('Memory hotspots detected:');
    expect(stdout).toContain('Computational complexity:');
    
    // 3. Analyze results in dashboard
    await execAsync(
      `node ./bin/wundr.js analyze --performance --memory-usage --report --output ${tempDir}/performance-analysis.json --path ${tempDir}`
    );
    
    await page.goto('/dashboard/upload');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(tempDir, 'performance-analysis.json'));
    await page.click('button:has-text("Upload Analysis")');
    
    await page.goto('/dashboard/analysis/performance');
    
    // Verify performance metrics display
    await expect(page.locator('.performance-overview')).toBeVisible();
    await expect(page.locator('.hotspot-list')).toBeVisible();
    
    // Test performance issue details
    await page.click('.hotspot-item:first-child');
    await expect(page.locator('.hotspot-details')).toBeVisible();
    await expect(page.locator('.complexity-score')).toBeVisible();
    
    // Test performance recommendations
    await expect(page.locator('.recommendations')).toBeVisible();
    const recommendationCount = await page.locator('.recommendation-item').count();
    expect(recommendationCount).toBeGreaterThan(3);
  });
});

// Helper functions for creating test projects
async function createEnterpriseMonorepo(dir: string) {
  const packages = [
    'core', 'ui', 'api', 'database', 'auth', 'notifications', 
    'analytics', 'payments', 'reporting', 'admin', 'mobile-app', 'web-app'
  ];
  
  for (const pkg of packages) {
    const pkgDir = path.join(dir, 'packages', pkg);
    await fs.mkdir(pkgDir, { recursive: true });
    
    // Create package structure
    await createLargeProject(path.join(pkgDir, 'src'), 100);
    
    // Create package.json
    await fs.writeFile(
      path.join(pkgDir, 'package.json'),
      JSON.stringify({
        name: `@enterprise/${pkg}`,
        version: '1.0.0',
        dependencies: packages
          .filter(p => p !== pkg)
          .slice(0, 3)
          .reduce((deps, dep) => ({ ...deps, [`@enterprise/${dep}`]: '1.0.0' }), {})
      }, null, 2)
    );
  }
  
  // Create root package.json
  await fs.writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({
      name: 'enterprise-monorepo',
      version: '1.0.0',
      workspaces: ['packages/*']
    }, null, 2)
  );
}

async function createPolyglotProject(dir: string) {
  // TypeScript/JavaScript services
  await createLargeProject(path.join(dir, 'services/api'), 200);
  await createLargeProject(path.join(dir, 'services/web'), 150);
  
  // Python data processing
  const pythonDir = path.join(dir, 'data-processing');
  await fs.mkdir(pythonDir, { recursive: true });
  
  for (let i = 0; i < 50; i++) {
    await fs.writeFile(
      path.join(pythonDir, `processor${i}.py`),
      `
import pandas as pd
import numpy as np

class DataProcessor${i}:
    def __init__(self, data_source):
        self.data = pd.read_csv(data_source)
        
    def process(self):
        # Complex data processing logic
        result = self.data.groupby('category').agg({
            'value': ['mean', 'std', 'count']
        })
        return result
        
    def analyze_trends(self):
        return self.data.rolling(window=30).mean()
        `
    );
  }
  
  // Java microservices  
  const javaDir = path.join(dir, 'java-services/src/main/java/com/enterprise');
  await fs.mkdir(javaDir, { recursive: true });
  
  for (let i = 0; i < 30; i++) {
    await fs.writeFile(
      path.join(javaDir, `Service${i}.java`),
      `
package com.enterprise;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.*;

@SpringBootApplication
@RestController
public class Service${i} {
    
    public static void main(String[] args) {
        SpringApplication.run(Service${i}.class, args);
    }
    
    @GetMapping("/api/service${i}/health")
    public ResponseEntity<Map<String, String>> health() {
        Map<String, String> status = new HashMap<>();
        status.put("status", "UP");
        status.put("service", "Service${i}");
        return ResponseEntity.ok(status);
    }
}
      `
    );
  }
  
  // Go services
  const goDir = path.join(dir, 'go-services');
  await fs.mkdir(goDir, { recursive: true });
  
  for (let i = 0; i < 20; i++) {
    await fs.writeFile(
      path.join(goDir, `service${i}.go`),
      `
package main

import (
    "encoding/json"
    "fmt"
    "net/http"
)

type Service${i}Handler struct {
    id int
}

func NewService${i}Handler() *Service${i}Handler {
    return &Service${i}Handler{id: ${i}}
}

func (s *Service${i}Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    response := map[string]interface{}{
        "service": "Service${i}",
        "id": s.id,
        "status": "running",
    }
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
}

func main() {
    handler := NewService${i}Handler()
    http.Handle("/", handler)
    fmt.Printf("Service${i} starting on port %d\\n", 8000 + ${i})
    http.ListenAndServe(":8${i.toString().padStart(3, '0')}", nil)
}
      `
    );
  }
}

async function createComplexDependencyProject(dir: string) {
  const modules = [];
  
  // Create interconnected modules with circular dependencies
  for (let i = 0; i < 100; i++) {
    modules.push(`Module${i}`);
  }
  
  const srcDir = path.join(dir, 'src');
  await fs.mkdir(srcDir, { recursive: true });
  
  for (let i = 0; i < modules.length; i++) {
    const dependencies = [];
    
    // Create various dependency patterns
    if (i > 0) dependencies.push(`Module${i - 1}`);
    if (i < modules.length - 1) dependencies.push(`Module${i + 1}`);
    if (i % 5 === 0 && i < modules.length - 5) {
      for (let j = 1; j <= 3; j++) {
        dependencies.push(`Module${i + j}`);
      }
    }
    
    // Create some circular dependencies
    if (i % 7 === 0) {
      dependencies.push(`Module${(i + 14) % modules.length}`);
      dependencies.push(`Module${(i + 21) % modules.length}`);
    }
    
    const imports = dependencies.map(dep => `import { ${dep} } from './${dep.toLowerCase()}';`).join('\n');
    const usage = dependencies.map(dep => `  private ${dep.toLowerCase()}: ${dep};`).join('\n');
    
    const content = `
${imports}

export class ${modules[i]} {
${usage}
  
  constructor() {
    ${dependencies.map(dep => `    this.${dep.toLowerCase()} = new ${dep}();`).join('\n')}
  }
  
  public process(): string[] {
    const results: string[] = [];
    ${dependencies.map(dep => `    results.push(this.${dep.toLowerCase()}.getId());`).join('\n')}
    return results;
  }
  
  public getId(): string {
    return '${modules[i]}-${i}';
  }
}
    `;
    
    await fs.writeFile(path.join(srcDir, `${modules[i].toLowerCase()}.ts`), content);
  }
}

async function createPerformanceTestProject(dir: string) {
  const srcDir = path.join(dir, 'src');
  await fs.mkdir(srcDir, { recursive: true });
  
  // Create performance-heavy algorithms
  const algorithms = [
    'BubbleSort', 'QuickSort', 'MergeSort', 'HeapSort',
    'LinearSearch', 'BinarySearch', 'DijkstraAlgorithm',
    'DynamicProgramming', 'BacktrackingSolver'
  ];
  
  for (const algo of algorithms) {
    await fs.writeFile(
      path.join(srcDir, `${algo.toLowerCase()}.ts`),
      `
export class ${algo} {
  private data: number[] = [];
  private operations = 0;
  
  constructor(size: number = 10000) {
    // Create large dataset
    for (let i = 0; i < size; i++) {
      this.data.push(Math.floor(Math.random() * size));
    }
  }
  
  // Intentionally inefficient algorithm for testing
  public execute(): number[] {
    this.operations = 0;
    const result = [...this.data];
    
    // O(n^3) complexity for demonstration
    for (let i = 0; i < result.length; i++) {
      for (let j = 0; j < result.length; j++) {
        for (let k = 0; k < result.length; k++) {
          this.operations++;
          if (result[i] > result[j]) {
            // Unnecessary computation
            const temp = result[i];
            result[i] = result[j];
            result[j] = temp;
          }
        }
      }
    }
    
    return result;
  }
  
  public getOperationsCount(): number {
    return this.operations;
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