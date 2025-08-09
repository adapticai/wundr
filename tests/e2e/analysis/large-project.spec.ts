import { test, expect, Page, BrowserContext } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

test.describe('Large Project Analysis E2E Tests', () => {
  let page: Page;
  let context: BrowserContext;
  let tempDir: string;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    
    // Create temporary directory for large project tests
    tempDir = path.join(process.cwd(), 'temp-large-analysis-' + Date.now());
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

  test.describe('Enterprise-Scale Project Analysis', () => {
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
      await expect(page.locator('.language-item')).toHaveCount.greaterThan(4);
      
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
      await expect(page.locator('.recommendation-item')).toHaveCount.greaterThan(3);
    });
  });

  test.describe('Scalability and Memory Management', () => {
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
      await expect(page.locator('.comparison-metric')).toHaveCount.greaterThan(5);
    });
  });

  test.describe('Advanced Analysis Features', () => {
    test('should perform architectural analysis on large systems', async () => {
      // 1. Create microservices-style architecture
      await createMicroservicesProject(tempDir);
      
      // 2. Run architectural analysis
      const { stdout } = await execAsync(
        `node ./bin/wundr.js analyze --architecture --service-boundaries --path ${tempDir}`
      );
      
      expect(stdout).toContain('Architectural analysis complete');
      expect(stdout).toContain('Services detected:');
      expect(stdout).toContain('Service boundaries:');
      expect(stdout).toContain('Cross-service dependencies:');
      
      // 3. Visualize architecture in dashboard
      await execAsync(
        `node ./bin/wundr.js analyze --architecture --service-boundaries --report --output ${tempDir}/architecture-analysis.json --path ${tempDir}`
      );
      
      await page.goto('/dashboard/upload');
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(tempDir, 'architecture-analysis.json'));
      await page.click('button:has-text("Upload Analysis")');
      
      await page.goto('/dashboard/analysis/architecture');
      
      // Verify architectural visualization
      await expect(page.locator('.architecture-diagram')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('.service-node')).toHaveCount.greaterThan(5);
      await expect(page.locator('.service-boundary')).toHaveCount.greaterThan(3);
      
      // Test service interaction analysis
      await page.click('.service-node:first-child');
      await expect(page.locator('.service-details')).toBeVisible();
      await expect(page.locator('.service-dependencies')).toBeVisible();
      
      // Test boundary violations detection
      await page.click('button:has-text("Show Violations")');
      await expect(page.locator('.boundary-violation')).toBeVisible();
    });

    test('should provide security analysis for large codebases', async () => {
      // 1. Create project with security issues
      await createSecurityTestProject(tempDir);
      
      // 2. Run security analysis
      const { stdout } = await execAsync(
        `node ./bin/wundr.js analyze --security --vulnerabilities --secrets --path ${tempDir}`
      );
      
      expect(stdout).toContain('Security analysis complete');
      expect(stdout).toContain('Vulnerabilities detected:');
      expect(stdout).toContain('Secrets found:');
      expect(stdout).toContain('Security score:');
      
      // 3. Review security results in dashboard
      await execAsync(
        `node ./bin/wundr.js analyze --security --vulnerabilities --secrets --report --output ${tempDir}/security-analysis.json --path ${tempDir}`
      );
      
      await page.goto('/dashboard/upload');
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(tempDir, 'security-analysis.json'));
      await page.click('button:has-text("Upload Analysis")');
      
      await page.goto('/dashboard/analysis/security');
      
      // Verify security dashboard
      await expect(page.locator('.security-overview')).toBeVisible();
      await expect(page.locator('.vulnerability-list')).toBeVisible();
      await expect(page.locator('.secrets-detected')).toBeVisible();
      
      // Test vulnerability details
      await page.click('.vulnerability-item:first-child');
      await expect(page.locator('.vulnerability-details')).toBeVisible();
      await expect(page.locator('.remediation-steps')).toBeVisible();
      
      // Test security recommendations
      await expect(page.locator('.security-recommendations')).toBeVisible();
      await expect(page.locator('.recommendation-priority')).toContainText(/High|Medium|Low/);
    });

    test('should generate comprehensive technical debt reports', async () => {
      // 1. Create project with various technical debt patterns
      await createTechnicalDebtProject(tempDir);
      
      // 2. Analyze technical debt
      const { stdout } = await execAsync(
        `node ./bin/wundr.js analyze --tech-debt --complexity --maintainability --path ${tempDir}`
      );
      
      expect(stdout).toContain('Technical debt analysis complete');
      expect(stdout).toContain('Debt ratio:');
      expect(stdout).toContain('Maintenance burden:');
      expect(stdout).toMatch(/Estimated refactoring effort: \d+ hours/);
      
      // 3. Visualize technical debt in dashboard
      await execAsync(
        `node ./bin/wundr.js analyze --tech-debt --complexity --maintainability --report --output ${tempDir}/debt-analysis.json --path ${tempDir}`
      );
      
      await page.goto('/dashboard/upload');
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(tempDir, 'debt-analysis.json'));
      await page.click('button:has-text("Upload Analysis")');
      
      await page.goto('/dashboard/analysis/technical-debt');
      
      // Verify debt visualization
      await expect(page.locator('.debt-overview')).toBeVisible();
      await expect(page.locator('.debt-heatmap')).toBeVisible();
      await expect(page.locator('.refactoring-priorities')).toBeVisible();
      
      // Test debt trend analysis
      await page.click('tab:has-text("Trends")');
      await expect(page.locator('.debt-trend-chart')).toBeVisible();
      
      // Test refactoring plan generation
      await page.click('button:has-text("Generate Refactoring Plan")');
      await expect(page.locator('.refactoring-plan')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.refactoring-task')).toHaveCount.greaterThan(5);
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
    
    @PostMapping("/api/service${i}/process")
    public ResponseEntity<ProcessResult> process(@RequestBody ProcessRequest request) {
        ProcessResult result = processData(request);
        return ResponseEntity.ok(result);
    }
    
    private ProcessResult processData(ProcessRequest request) {
        // Complex business logic
        return new ProcessResult(request.getId(), "processed");
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
    "log"
    "net/http"
    "strconv"
)

type Service${i}Handler struct {
    id int
}

func NewService${i}Handler() *Service${i}Handler {
    return &Service${i}Handler{id: ${i}}
}

func (s *Service${i}Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    switch r.Method {
    case "GET":
        s.handleGet(w, r)
    case "POST":
        s.handlePost(w, r)
    default:
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
    }
}

func (s *Service${i}Handler) handleGet(w http.ResponseWriter, r *http.Request) {
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
    
    port := ":" + strconv.Itoa(8000 + ${i})
    fmt.Printf("Service${i} starting on port %s\\n", port)
    log.Fatal(http.ListenAndServe(port, nil))
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
  
  public getDependencies(): string[] {
    return [${dependencies.map(dep => `'${dep}'`).join(', ')}];
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
  
  // Memory-intensive operation
  public analyzePatterns(): Map<string, number[]> {
    const patterns = new Map<string, number[]>();
    
    // Create large memory footprint
    for (let i = 0; i < this.data.length; i++) {
      const pattern = this.data.slice(i, i + 100).join('-');
      if (!patterns.has(pattern)) {
        patterns.set(pattern, []);
      }
      patterns.get(pattern)!.push(i);
    }
    
    return patterns;
  }
  
  public getOperationsCount(): number {
    return this.operations;
  }
}
        `
      );
    }
    
    // Create memory leak simulation
    await fs.writeFile(
      path.join(srcDir, 'memoryleak.ts'),
      `
export class MemoryLeakSimulator {
  private static instances: MemoryLeakSimulator[] = [];
  private largeData: Buffer[] = [];
  
  constructor() {
    // Keep reference to all instances (memory leak)
    MemoryLeakSimulator.instances.push(this);
    
    // Allocate large buffers
    for (let i = 0; i < 1000; i++) {
      this.largeData.push(Buffer.alloc(1024 * 1024)); // 1MB each
    }
  }
  
  public process(): void {
    // Process data but never clean up
    this.largeData.forEach(buffer => {
      buffer.fill(Math.floor(Math.random() * 256));
    });
  }
  
  // Missing cleanup method
  // public cleanup(): void { ... }
}
      `
    );
  }

  async function createMicroservicesProject(dir: string) {
    const services = [
      'user-service', 'auth-service', 'payment-service', 'notification-service',
      'analytics-service', 'reporting-service', 'api-gateway', 'config-service'
    ];
    
    for (const service of services) {
      const serviceDir = path.join(dir, service, 'src');
      await fs.mkdir(serviceDir, { recursive: true });
      
      // Create service structure
      await createLargeProject(serviceDir, 50);
      
      // Create service-specific files
      await fs.writeFile(
        path.join(serviceDir, 'service.ts'),
        `
import { ServiceConfig } from '../config/config';
import { ServiceRegistry } from '../registry/registry';

export class ${service.split('-').map(word => 
  word.charAt(0).toUpperCase() + word.slice(1)
).join('')} {
  private config: ServiceConfig;
  private registry: ServiceRegistry;
  
  constructor() {
    this.config = new ServiceConfig();
    this.registry = new ServiceRegistry();
  }
  
  public async start(): Promise<void> {
    await this.registry.register('${service}', {
      host: this.config.host,
      port: this.config.port,
      health: '/health'
    });
  }
  
  public async stop(): Promise<void> {
    await this.registry.unregister('${service}');
  }
}
        `
      );
      
      // Create package.json with service dependencies
      const dependencies = services
        .filter(s => s !== service)
        .slice(0, 3)
        .reduce((deps, dep) => ({ ...deps, [dep]: '1.0.0' }), {});
        
      await fs.writeFile(
        path.join(dir, service, 'package.json'),
        JSON.stringify({
          name: service,
          version: '1.0.0',
          dependencies
        }, null, 2)
      );
    }
  }

  async function createSecurityTestProject(dir: string) {
    const srcDir = path.join(dir, 'src');
    await fs.mkdir(srcDir, { recursive: true });
    
    // Create files with security issues
    await fs.writeFile(
      path.join(srcDir, 'vulnerable-auth.ts'),
      `
// Hardcoded secrets (security issue)
const API_KEY = 'sk-1234567890abcdef';
const JWT_SECRET = 'super-secret-key';
const DB_PASSWORD = 'admin123';

export class VulnerableAuth {
  // SQL injection vulnerability
  public authenticateUser(username: string, password: string): boolean {
    const query = \`SELECT * FROM users WHERE username = '\${username}' AND password = '\${password}'\`;
    // Direct query execution without sanitization
    return this.executeQuery(query);
  }
  
  // Insecure password storage
  public storePassword(password: string): void {
    localStorage.setItem('password', password); // Plain text storage
  }
  
  // XSS vulnerability
  public displayUserData(userData: any): string {
    return \`<div>\${userData.name}</div>\`; // Unescaped output
  }
  
  private executeQuery(query: string): boolean {
    // Mock implementation
    return Math.random() > 0.5;
  }
}
      `
    );
    
    await fs.writeFile(
      path.join(srcDir, 'insecure-crypto.ts'),
      `
import crypto from 'crypto';

export class InsecureCrypto {
  // Weak encryption algorithm
  public encrypt(data: string): string {
    const cipher = crypto.createCipher('des', 'weak-key'); // Deprecated algorithm
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }
  
  // Predictable random number generation
  public generateToken(): string {
    return Math.random().toString(36); // Not cryptographically secure
  }
  
  // Weak hash function
  public hashPassword(password: string): string {
    return crypto.createHash('md5').update(password).digest('hex'); // MD5 is weak
  }
}
      `
    );
  }

  async function createTechnicalDebtProject(dir: string) {
    const srcDir = path.join(dir, 'src');
    await fs.mkdir(srcDir, { recursive: true });
    
    // Create files with various technical debt patterns
    await fs.writeFile(
      path.join(srcDir, 'legacy-code.ts'),
      `
// TODO: Refactor this entire class - it's gotten out of hand
export class LegacySystem {
  // HACK: This is a temporary fix from 2019
  private temporaryFix = true;
  
  // @deprecated Use newMethod instead
  public oldMethod(data: any): any {
    // Massive method with multiple responsibilities
    if (data.type === 'user') {
      // User handling logic
      if (data.status === 'active') {
        // Active user logic
        for (let i = 0; i < data.permissions.length; i++) {
          if (data.permissions[i].type === 'admin') {
            // Admin permission logic
            if (data.permissions[i].scope === 'global') {
              // Global admin logic
              return this.processGlobalAdmin(data);
            } else {
              // Local admin logic
              return this.processLocalAdmin(data);
            }
          }
        }
      }
    } else if (data.type === 'system') {
      // System handling logic (duplicated elsewhere)
      return this.processSystem(data);
    }
    
    // FIXME: This will break with new data formats
    return { result: 'unknown', processed: false };
  }
  
  // Copy-pasted method (code duplication)
  private processGlobalAdmin(data: any): any {
    const result = {
      processed: true,
      permissions: [],
      timestamp: Date.now()
    };
    
    // Complex nested logic
    for (const perm of data.permissions) {
      if (perm.active && perm.validated) {
        result.permissions.push({
          id: perm.id,
          type: perm.type,
          granted: true
        });
      }
    }
    
    return result;
  }
  
  // Almost identical to processGlobalAdmin (code duplication)
  private processLocalAdmin(data: any): any {
    const result = {
      processed: true,
      permissions: [],
      timestamp: Date.now()
    };
    
    for (const perm of data.permissions) {
      if (perm.active && perm.validated && perm.scope === 'local') {
        result.permissions.push({
          id: perm.id,
          type: perm.type,
          granted: true
        });
      }
    }
    
    return result;
  }
  
  private processSystem(data: any): any {
    throw new Error('Not implemented yet'); // Technical debt
  }
}
      `
    );
    
    // Create more technical debt examples
    await fs.writeFile(
      path.join(srcDir, 'god-object.ts'),
      `
// God object anti-pattern - handles everything
export class DataManager {
  // Too many responsibilities
  
  // Database operations
  public saveUser(user: any): void { /* implementation */ }
  public loadUser(id: string): any { /* implementation */ }
  public deleteUser(id: string): void { /* implementation */ }
  
  // File operations
  public readFile(path: string): string { /* implementation */ }
  public writeFile(path: string, content: string): void { /* implementation */ }
  
  // Network operations
  public sendRequest(url: string): any { /* implementation */ }
  public uploadFile(file: any): void { /* implementation */ }
  
  // Validation
  public validateEmail(email: string): boolean { /* implementation */ }
  public validatePassword(password: string): boolean { /* implementation */ }
  
  // Encryption
  public encrypt(data: string): string { /* implementation */ }
  public decrypt(data: string): string { /* implementation */ }
  
  // Logging
  public log(message: string): void { /* implementation */ }
  public error(error: Error): void { /* implementation */ }
  
  // Configuration
  public getConfig(key: string): any { /* implementation */ }
  public setConfig(key: string, value: any): void { /* implementation */ }
  
  // Too many methods, too many responsibilities
}
      `
    );
  }

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
  
  public getCachedData(key: string): any {
    const data = this.dataCache.get(key);
    if (data) {
      data.metadata.accessed++;
    }
    return data;
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
});