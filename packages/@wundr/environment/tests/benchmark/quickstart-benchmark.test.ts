/**
 * Benchmark tests for quickstart installer
 * Validates <5 minute (300 seconds) setup requirement
 */

import { execSync, spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { QuickstartInstaller } from '../../src/installers/quickstart-installer';
import { CacheManager } from '../../src/installers/cache-manager';

// Test timeout: 10 minutes to allow for slower CI environments
jest.setTimeout(600000);

interface BenchmarkResult {
  preset: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  toolsInstalled: string[];
  errors: string[];
  cacheHitRate?: number;
  memoryUsage?: number;
  passed: boolean;
}

describe('Quickstart Benchmark Tests', () => {
  let testDir: string;
  let cacheManager: CacheManager;
  const TARGET_TIME = 300; // 5 minutes in seconds
  const results: BenchmarkResult[] = [];

  beforeAll(async () => {
    // Setup isolated test environment
    testDir = await fs.mkdtemp(join(tmpdir(), 'wundr-benchmark-'));
    cacheManager = new CacheManager();
    
    // Precache essentials for consistent testing
    await cacheManager.precacheEssentials();
  });

  afterAll(async () => {
    // Cleanup test directory
    try {
      execSync(`rm -rf "${testDir}"`, { stdio: 'ignore' });
    } catch {
      // Ignore cleanup errors
    }

    // Generate benchmark report
    await generateBenchmarkReport(results);
  });

  describe('Preset Benchmarks', () => {
    test('minimal preset should complete under 2 minutes', async () => {
      const result = await benchmarkPreset('minimal', 120);
      expect(result.passed).toBe(true);
      expect(result.duration).toBeLessThan(120);
    });

    test('standard preset should complete under 5 minutes', async () => {
      const result = await benchmarkPreset('standard', TARGET_TIME);
      expect(result.passed).toBe(true);
      expect(result.duration).toBeLessThan(TARGET_TIME);
    });

    test('full preset should complete under 7 minutes', async () => {
      const result = await benchmarkPreset('full', 420);
      expect(result.passed).toBe(true);
      expect(result.duration).toBeLessThan(420);
    });
  });

  describe('Parallel Installation Benchmarks', () => {
    test('parallel installation should be faster than sequential', async () => {
      const parallelResult = await benchmarkInstallation({
        profile: 'developer',
        preset: 'standard',
        parallelJobs: 4,
        skipAI: true
      });

      const sequentialResult = await benchmarkInstallation({
        profile: 'developer',
        preset: 'standard',
        parallelJobs: 1,
        skipAI: true
      });

      expect(parallelResult.duration).toBeLessThan(sequentialResult.duration);
      expect(parallelResult.duration / sequentialResult.duration).toBeLessThan(0.7);
    });

    test('optimal parallel job count should minimize installation time', async () => {
      const jobCounts = [1, 2, 4, 8];
      const timings: Array<{ jobs: number; duration: number }> = [];

      for (const jobs of jobCounts) {
        const result = await benchmarkInstallation({
          profile: 'developer',
          preset: 'standard',
          parallelJobs: jobs,
          skipAI: true
        });
        
        timings.push({ jobs, duration: result.duration });
      }

      // Find optimal job count (should be 4 for most systems)
      const optimal = timings.reduce((min, current) => 
        current.duration < min.duration ? current : min
      );

      expect(optimal.jobs).toBeGreaterThan(1);
      expect(optimal.jobs).toBeLessThanOrEqual(8);
    });
  });

  describe('Cache Performance Benchmarks', () => {
    test('cached installation should be significantly faster', async () => {
      // First run (cold cache)
      const coldResult = await benchmarkInstallation({
        profile: 'developer',
        preset: 'minimal',
        cacheOnly: false
      });

      // Second run (warm cache)
      const warmResult = await benchmarkInstallation({
        profile: 'developer',
        preset: 'minimal',
        cacheOnly: false
      });

      expect(warmResult.duration).toBeLessThan(coldResult.duration * 0.6);
      expect(warmResult.cacheHitRate).toBeGreaterThan(0.7);
    });

    test('cache-only mode should fail gracefully when cache is empty', async () => {
      await cacheManager.clear();
      
      const result = await benchmarkInstallation({
        profile: 'developer',
        preset: 'minimal',
        cacheOnly: true
      }, false); // Don't expect success

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Memory and Resource Benchmarks', () => {
    test('installation should not exceed memory limits', async () => {
      const result = await benchmarkInstallation({
        profile: 'developer',
        preset: 'standard'
      });

      expect(result.memoryUsage).toBeDefined();
      expect(result.memoryUsage!).toBeLessThan(512 * 1024 * 1024); // 512MB
    });

    test('concurrent installations should not interfere', async () => {
      const promises = [
        benchmarkInstallation({ profile: 'developer', preset: 'minimal' }),
        benchmarkInstallation({ profile: 'developer', preset: 'minimal' }),
        benchmarkInstallation({ profile: 'developer', preset: 'minimal' })
      ];

      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result.passed).toBe(true);
        expect(result.duration).toBeLessThan(TARGET_TIME);
      });
    });
  });

  describe('Platform-Specific Benchmarks', () => {
    test('macOS installation should meet performance targets', async () => {
      if (process.platform !== 'darwin') {
        return; // Skip on non-macOS
      }

      const result = await benchmarkInstallation({
        profile: 'developer',
        preset: 'standard'
      });

      expect(result.passed).toBe(true);
      expect(result.duration).toBeLessThan(TARGET_TIME);
    });

    test('Linux installation should meet performance targets', async () => {
      if (process.platform !== 'linux') {
        return; // Skip on non-Linux
      }

      const result = await benchmarkInstallation({
        profile: 'developer',
        preset: 'standard'
      });

      expect(result.passed).toBe(true);
      expect(result.duration).toBeLessThan(TARGET_TIME * 1.2); // Allow 20% longer on Linux
    });
  });

  describe('Stress Tests', () => {
    test('rapid consecutive installations should maintain performance', async () => {
      const iterations = 5;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const result = await benchmarkInstallation({
          profile: 'developer',
          preset: 'minimal'
        });
        
        durations.push(result.duration);
        expect(result.passed).toBe(true);
      }

      // Performance should not degrade significantly
      const firstDuration = durations[0];
      const lastDuration = durations[durations.length - 1];
      expect(lastDuration).toBeLessThan(firstDuration * 1.3);
    });

    test('installation should handle system load gracefully', async () => {
      // Create artificial system load
      const loadProcess = spawn('yes', [], { stdio: 'ignore' });
      
      try {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Let load build up
        
        const result = await benchmarkInstallation({
          profile: 'developer',
          preset: 'minimal'
        });

        expect(result.passed).toBe(true);
        expect(result.duration).toBeLessThan(TARGET_TIME * 1.5); // Allow 50% longer under load
      } finally {
        loadProcess.kill();
      }
    });
  });

  /**
   * Helper functions
   */
  async function benchmarkPreset(preset: string, timeLimit: number): Promise<BenchmarkResult> {
    return benchmarkInstallation({
      profile: 'developer',
      preset: preset as any,
      skipAI: true
    });
  }

  async function benchmarkInstallation(
    options: {
      profile: 'developer';
      preset?: string;
      parallelJobs?: number;
      skipAI?: boolean;
      cacheOnly?: boolean;
    },
    expectSuccess = true
  ): Promise<BenchmarkResult> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    const installer = new QuickstartInstaller({
      profile: 'human',
      skipPrompts: true,
      skipAI: options.skipAI || false,
      cacheOnly: options.cacheOnly || false,
      parallelJobs: options.parallelJobs || 4,
      timeout: 600000, // 10 minutes
      preset: (options.preset as any) || 'standard'
    });

    const result: BenchmarkResult = {
      preset: options.preset || 'standard',
      startTime,
      endTime: 0,
      duration: 0,
      success: false,
      toolsInstalled: [],
      errors: [],
      passed: false
    };

    try {
      // Run installation
      await installer.analyze();
      await installer.installParallel();
      await installer.configure();
      
      if (!options.skipAI) {
        await installer.setupAIAgentsQuick();
      }

      result.success = true;
      result.toolsInstalled = await getInstalledTools();
      
      // Get cache hit rate if available
      const stats = await cacheManager.getStats();
      result.cacheHitRate = stats.hitRate;
      
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : String(error));
    } finally {
      result.endTime = Date.now();
      result.duration = (result.endTime - result.startTime) / 1000; // Convert to seconds
      result.memoryUsage = process.memoryUsage().heapUsed - startMemory;
      
      // Check if benchmark passed
      const timeTarget = options.preset === 'minimal' ? 120 :
                        options.preset === 'full' ? 420 :
                        TARGET_TIME;
      
      result.passed = result.success && result.duration < timeTarget;
      
      results.push(result);
    }

    return result;
  }

  async function getInstalledTools(): Promise<string[]> {
    const tools = ['git', 'node', 'npm', 'brew', 'code', 'docker', 'claude'];
    const installed: string[] = [];

    for (const tool of tools) {
      try {
        execSync(`which ${tool}`, { stdio: 'ignore' });
        installed.push(tool);
      } catch {
        // Tool not installed
      }
    }

    return installed;
  }

  async function generateBenchmarkReport(results: BenchmarkResult[]): Promise<void> {
    const reportPath = join(process.cwd(), 'benchmark-report.json');
    
    const report = {
      timestamp: new Date().toISOString(),
      platform: process.platform,
      nodeVersion: process.version,
      totalTests: results.length,
      passedTests: results.filter(r => r.passed).length,
      failedTests: results.filter(r => !r.passed).length,
      averageDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
      fastestDuration: Math.min(...results.map(r => r.duration)),
      slowestDuration: Math.max(...results.map(r => r.duration)),
      targetTime: TARGET_TIME,
      results: results.map(r => ({
        preset: r.preset,
        duration: r.duration,
        passed: r.passed,
        success: r.success,
        toolsInstalled: r.toolsInstalled.length,
        errors: r.errors.length,
        cacheHitRate: r.cacheHitRate
      }))
    };

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log('\n📊 Benchmark Summary:');
    console.log(`Total Tests: ${report.totalTests}`);
    console.log(`Passed: ${report.passedTests}`);
    console.log(`Failed: ${report.failedTests}`);
    console.log(`Average Duration: ${report.averageDuration.toFixed(1)}s`);
    console.log(`Target Time: ${TARGET_TIME}s`);
    console.log(`Report saved to: ${reportPath}`);
  }
});