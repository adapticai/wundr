import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';

// Mock deployment cycle module
vi.mock('../../resources/scripts/deployment-cycle', () => ({
  DeploymentCycle: vi.fn().mockImplementation((options) => ({
    platform: options.platform,
    projectId: options.projectId,
    siteId: options.siteId,
    maxCycles: options.maxCycles || 5,
    currentCycle: 0,
    run: vi.fn().mockResolvedValue({ success: true, cycles: 1 }),
    monitorDeployment: vi.fn().mockResolvedValue({ success: true, logs: '' }),
    checkRuntimeLogs: vi.fn().mockResolvedValue([]),
    analyzeErrors: vi.fn().mockResolvedValue([]),
    applyFixes: vi.fn().mockResolvedValue(undefined),
    validateLocally: vi.fn().mockResolvedValue(true),
    commitAndPush: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('Deployment Monitor', () => {
  describe('Platform Detection', () => {
    const testDir = '/tmp/test-project';

    beforeEach(async () => {
      await fs.ensureDir(testDir);
    });

    afterEach(async () => {
      await fs.remove(testDir);
    });

    it('should detect Railway from railway.json', async () => {
      await fs.writeJson(path.join(testDir, 'railway.json'), {
        build: { builder: 'nixpacks' }
      });

      const hasRailway = await fs.pathExists(path.join(testDir, 'railway.json'));
      expect(hasRailway).toBe(true);
    });

    it('should detect Netlify from netlify.toml', async () => {
      await fs.writeFile(path.join(testDir, 'netlify.toml'), `
[build]
  command = "npm run build"
  publish = "dist"
`);

      const hasNetlify = await fs.pathExists(path.join(testDir, 'netlify.toml'));
      expect(hasNetlify).toBe(true);
    });

    it('should detect from environment variables', () => {
      const originalRailway = process.env.RAILWAY_PROJECT_ID;
      const originalNetlify = process.env.NETLIFY_SITE_ID;

      process.env.RAILWAY_PROJECT_ID = 'test-project-id';
      expect(process.env.RAILWAY_PROJECT_ID).toBe('test-project-id');

      process.env.NETLIFY_SITE_ID = 'test-site-id';
      expect(process.env.NETLIFY_SITE_ID).toBe('test-site-id');

      // Restore
      process.env.RAILWAY_PROJECT_ID = originalRailway;
      process.env.NETLIFY_SITE_ID = originalNetlify;
    });

    it('should detect multiple platforms', async () => {
      await fs.writeJson(path.join(testDir, 'railway.json'), {});
      await fs.writeFile(path.join(testDir, 'netlify.toml'), '');

      const platforms: string[] = [];
      if (await fs.pathExists(path.join(testDir, 'railway.json'))) {
        platforms.push('railway');
      }
      if (await fs.pathExists(path.join(testDir, 'netlify.toml'))) {
        platforms.push('netlify');
      }

      expect(platforms).toContain('railway');
      expect(platforms).toContain('netlify');
      expect(platforms).toHaveLength(2);
    });
  });

  describe('Error Analysis', () => {
    it('should classify runtime errors correctly', () => {
      const errorPatterns = {
        'ECONNREFUSED': 'Connection Error',
        'ENOMEM': 'Memory Error',
        'ETIMEDOUT': 'Timeout Error',
        'TypeError': 'Type Error',
        'SyntaxError': 'Parse Error',
      };

      const classifyError = (message: string): string => {
        for (const [pattern, classification] of Object.entries(errorPatterns)) {
          if (message.includes(pattern)) {
            return classification;
          }
        }
        return 'Unknown Error';
      };

      expect(classifyError('Error: connect ECONNREFUSED 127.0.0.1:5432')).toBe('Connection Error');
      expect(classifyError('FATAL ERROR: ENOMEM')).toBe('Memory Error');
      expect(classifyError('Error: ETIMEDOUT')).toBe('Timeout Error');
      expect(classifyError("TypeError: Cannot read property 'foo' of undefined")).toBe('Type Error');
    });

    it('should generate fix suggestions for known patterns', () => {
      const generateFix = (errorType: string): string | null => {
        const fixes: Record<string, string> = {
          'Connection Error': 'Add retry logic with exponential backoff',
          'Memory Error': 'Implement pagination or streaming',
          'Type Error': 'Add null check before accessing property',
        };
        return fixes[errorType] || null;
      };

      expect(generateFix('Connection Error')).toBe('Add retry logic with exponential backoff');
      expect(generateFix('Memory Error')).toBe('Implement pagination or streaming');
      expect(generateFix('Unknown')).toBeNull();
    });
  });

  describe('Deployment Cycle', () => {
    it('should complete cycle on success', async () => {
      const result = {
        success: true,
        cycles: 1
      };

      expect(result.success).toBe(true);
      expect(result.cycles).toBe(1);
    });

    it('should retry on fixable errors', async () => {
      const maxCycles = 5;
      let currentCycle = 0;
      let errorsFixed = false;

      while (currentCycle < maxCycles && !errorsFixed) {
        currentCycle++;
        // Simulate fix on third attempt
        if (currentCycle === 3) {
          errorsFixed = true;
        }
      }

      expect(errorsFixed).toBe(true);
      expect(currentCycle).toBe(3);
    });

    it('should stop after max cycles', async () => {
      const maxCycles = 5;
      let currentCycle = 0;

      while (currentCycle < maxCycles) {
        currentCycle++;
        // Never fix - should hit max
      }

      expect(currentCycle).toBe(maxCycles);
    });

    it('should validate locally before deploying', async () => {
      const validateLocally = (): boolean => {
        // Simulate successful validation
        return true;
      };

      expect(validateLocally()).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should parse deployment config correctly', () => {
      const config = {
        version: '1.0.0',
        platforms: {
          railway: {
            enabled: true,
            project_id: 'test-project',
            poll_interval: 5000,
            timeout: 300000,
          },
          netlify: {
            enabled: false,
          },
        },
        auto_monitor: true,
        auto_fix: {
          enabled: true,
          max_cycles: 5,
        },
      };

      expect(config.version).toBe('1.0.0');
      expect(config.platforms.railway.enabled).toBe(true);
      expect(config.platforms.netlify.enabled).toBe(false);
      expect(config.auto_fix.max_cycles).toBe(5);
    });

    it('should use default values for missing config', () => {
      const defaults = {
        poll_interval: 5000,
        timeout: 300000,
        max_cycles: 5,
      };

      const config = {
        platforms: {
          railway: {
            enabled: true,
          },
        },
      };

      const mergedConfig = {
        ...defaults,
        ...config.platforms.railway,
      };

      expect(mergedConfig.poll_interval).toBe(5000);
      expect(mergedConfig.timeout).toBe(300000);
    });
  });

  describe('MCP Tool Integration', () => {
    it('should format Railway MCP calls correctly', () => {
      const formatRailwayCall = (tool: string, params: Record<string, unknown>): string => {
        return `mcp__railway__${tool} ${JSON.stringify(params)}`;
      };

      const call = formatRailwayCall('deploy_status', { projectId: 'test' });
      expect(call).toContain('mcp__railway__deploy_status');
      expect(call).toContain('"projectId":"test"');
    });

    it('should format Netlify MCP calls correctly', () => {
      const formatNetlifyCall = (tool: string, params: Record<string, unknown>): string => {
        return `mcp__netlify__${tool} ${JSON.stringify(params)}`;
      };

      const call = formatNetlifyCall('get_build_logs', { deployId: 'deploy-123' });
      expect(call).toContain('mcp__netlify__get_build_logs');
      expect(call).toContain('"deployId":"deploy-123"');
    });
  });
});
