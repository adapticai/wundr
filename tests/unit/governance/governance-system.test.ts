/**
 * Unit tests for GovernanceSystem
 */

import { GovernanceSystem } from '../../../scripts/governance/governance-system';
import { createMockDriftReport, TempFileManager, spyOnConsole } from '../../utilities/test-helpers';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Mock dependencies
jest.mock('fs');
jest.mock('child_process');
jest.mock('@octokit/rest');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('GovernanceSystem', () => {
  let governance: GovernanceSystem;
  let tempFileManager: TempFileManager;
  let consoleSpy: ReturnType<typeof spyOnConsole>;

  beforeEach(() => {
    jest.clearAllMocks();
    tempFileManager = new TempFileManager();
    consoleSpy = spyOnConsole();

    // Mock file system operations
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockImplementation();
    mockFs.writeFileSync.mockImplementation();
    mockFs.readFileSync.mockReturnValue('{}');
    mockFs.readdirSync.mockReturnValue([]);
    mockFs.copyFileSync.mockImplementation();

    // Mock exec operations
    mockExecSync.mockReturnValue('');

    // Clear environment variables
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.CI;

    governance = new GovernanceSystem();
  });

  afterEach(() => {
    tempFileManager.cleanup();
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize directories on creation', () => {
      expect(mockFs.mkdirSync).toHaveBeenCalledWith('.governance/baselines', { recursive: true });
      expect(mockFs.mkdirSync).toHaveBeenCalledWith('.governance/reports', { recursive: true });
    });

    it('should initialize GitHub client when token is provided', () => {
      process.env.GITHUB_TOKEN = 'test-token';
      
      const newGovernance = new GovernanceSystem();
      
      // The octokit client should be initialized (private property)
      expect((newGovernance as any).octokit).toBeDefined();
    });

    it('should not initialize GitHub client without token', () => {
      expect((governance as any).octokit).toBeUndefined();
    });
  });

  describe('detectDrift', () => {
    beforeEach(() => {
      // Mock the analysis report
      const mockAnalysisReport = {
        timestamp: '2024-01-01T00:00:00.000Z',
        summary: {
          totalEntities: 10,
          duplicateClusters: 2,
          circularDependencies: 1,
          unusedExports: 5
        },
        entities: [
          { 
            name: 'User', 
            type: 'interface', 
            file: 'src/user.ts',
            normalizedHash: 'abc123',
            complexity: 5
          }
        ]
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockAnalysisReport));
      mockExecSync.mockReturnValue('Analysis completed');
    });

    it('should detect drift and return report', async () => {
      // Mock baseline - older snapshot with fewer entities
      const mockBaseline = {
        timestamp: '2023-12-01T00:00:00.000Z',
        metrics: {
          totalEntities: 8,
          duplicateCount: 1,
          avgComplexity: 3,
          circularDeps: 0,
          unusedExports: 3
        },
        entities: new Map([
          ['src/user.ts:User:interface', 'abc123']
        ])
      };

      // Mock getBaseline to return our test baseline
      (governance as any).getBaseline = jest.fn().mockReturnValue(mockBaseline);

      const report = await governance.detectDrift();

      expect(report).toBeDefined();
      expect(report.timestamp).toBeDefined();
      expect(report.baseline).toEqual(mockBaseline);
      expect(report.current).toBeDefined();
      expect(report.drift).toBeDefined();
      expect(report.recommendations).toBeInstanceOf(Array);
      expect(report.severity).toBeDefined();
    });

    it('should calculate drift correctly', async () => {
      const mockBaseline = {
        timestamp: '2023-12-01T00:00:00.000Z',
        metrics: {
          totalEntities: 5,
          duplicateCount: 1,
          avgComplexity: 3,
          circularDeps: 0,
          unusedExports: 2
        },
        entities: new Map()
      };

      (governance as any).getBaseline = jest.fn().mockReturnValue(mockBaseline);

      const report = await governance.detectDrift();

      expect(report.drift.newDuplicates).toBe(1); // 2 - 1
      expect(report.drift.addedEntities).toBeGreaterThanOrEqual(0);
      expect(report.drift.complexityIncrease).toBeGreaterThanOrEqual(0);
      expect(report.drift.newCircularDeps).toBe(1); // 1 - 0
      expect(report.drift.newUnusedExports).toBe(3); // 5 - 2
    });

    it('should handle no baseline (initial run)', async () => {
      mockFs.readdirSync.mockReturnValue([]); // No baseline files

      const report = await governance.detectDrift();

      expect(report).toBeDefined();
      expect(report.baseline.metrics.totalEntities).toBe(0);
      expect(report.drift.addedEntities).toBeGreaterThan(0);
    });

    it('should save report after detection', async () => {
      const mockBaseline = {
        timestamp: '2023-12-01T00:00:00.000Z',
        metrics: { totalEntities: 0, duplicateCount: 0, avgComplexity: 0, circularDeps: 0, unusedExports: 0 },
        entities: new Map()
      };

      (governance as any).getBaseline = jest.fn().mockReturnValue(mockBaseline);

      await governance.detectDrift();

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('drift-'),
        expect.stringContaining('"timestamp"')
      );
      expect(mockFs.copyFileSync).toHaveBeenCalledWith(
        expect.stringContaining('drift-'),
        expect.stringContaining('latest.json')
      );
    });
  });

  describe('severity calculation', () => {
    it('should return critical for severe drift', () => {
      const drift = {
        newDuplicates: 10,
        removedEntities: 0,
        addedEntities: 5,
        complexityIncrease: 15,
        newCircularDeps: 2,
        newUnusedExports: 1,
        violatedStandards: []
      };

      const severity = (governance as any).calculateSeverity(drift);
      expect(severity).toBe('critical');
    });

    it('should return high for moderate drift', () => {
      const drift = {
        newDuplicates: 3,
        removedEntities: 0,
        addedEntities: 2,
        complexityIncrease: 7,
        newCircularDeps: 0,
        newUnusedExports: 5,
        violatedStandards: [{ severity: 'error' }]
      };

      const severity = (governance as any).calculateSeverity(drift);
      expect(severity).toBe('high');
    });

    it('should return medium for minor drift', () => {
      const drift = {
        newDuplicates: 1,
        removedEntities: 0,
        addedEntities: 1,
        complexityIncrease: 3,
        newCircularDeps: 0,
        newUnusedExports: 25,
        violatedStandards: []
      };

      const severity = (governance as any).calculateSeverity(drift);
      expect(severity).toBe('medium');
    });

    it('should return low for minimal drift', () => {
      const drift = {
        newDuplicates: 0,
        removedEntities: 0,
        addedEntities: 1,
        complexityIncrease: 1,
        newCircularDeps: 0,
        newUnusedExports: 8,
        violatedStandards: [{ severity: 'warning' }]
      };

      const severity = (governance as any).calculateSeverity(drift);
      expect(severity).toBe('low');
    });

    it('should return none for no drift', () => {
      const drift = {
        newDuplicates: 0,
        removedEntities: 0,
        addedEntities: 0,
        complexityIncrease: 0,
        newCircularDeps: 0,
        newUnusedExports: 0,
        violatedStandards: []
      };

      const severity = (governance as any).calculateSeverity(drift);
      expect(severity).toBe('none');
    });
  });

  describe('recommendations generation', () => {
    it('should generate appropriate recommendations for different drift types', () => {
      const drift = {
        newDuplicates: 3,
        removedEntities: 0,
        addedEntities: 5,
        complexityIncrease: 8,
        newCircularDeps: 1,
        newUnusedExports: 15,
        violatedStandards: [
          { severity: 'error' as const, rule: 'test-rule', file: 'test.ts', line: 1, message: 'test' }
        ]
      };

      const recommendations = (governance as any).generateRecommendations(drift);

      expect(recommendations).toContain(
        expect.stringContaining('3 new duplicate(s) detected')
      );
      expect(recommendations).toContain(
        expect.stringContaining('complexity increased by 8')
      );
      expect(recommendations).toContain(
        expect.stringContaining('1 new circular dependencies')
      );
      expect(recommendations).toContain(
        expect.stringContaining('1 standard violations')
      );
    });

    it('should provide positive feedback when no drift detected', () => {
      const drift = {
        newDuplicates: 0,
        removedEntities: 0,
        addedEntities: 0,
        complexityIncrease: 0,
        newCircularDeps: 0,
        newUnusedExports: 0,
        violatedStandards: []
      };

      const recommendations = (governance as any).generateRecommendations(drift);

      expect(recommendations).toContain(
        expect.stringContaining('No significant drift detected')
      );
    });
  });

  describe('governance enforcement', () => {
    it('should handle critical drift in CI environment', async () => {
      process.env.CI = 'true';
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation();

      const report = createMockDriftReport('critical');

      await (governance as any).enforceGovernance(report);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '.governance-block',
        'Critical drift detected. Fix before proceeding.'
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      processExitSpy.mockRestore();
    });

    it('should create GitHub issue for critical drift when configured', async () => {
      process.env.GITHUB_TOKEN = 'test-token';
      process.env.GITHUB_REPOSITORY = 'owner/repo';
      const mockOctokit = {
        issues: {
          create: jest.fn().mockResolvedValue({})
        }
      };
      (governance as any).octokit = mockOctokit;

      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation();
      const report = createMockDriftReport('critical');

      await (governance as any).enforceGovernance(report);

      expect(mockOctokit.issues.create).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        title: '🚨 Critical Code Drift Detected',
        body: expect.stringContaining('Critical Code Drift Detected'),
        labels: ['critical', 'code-quality', 'drift']
      });

      processExitSpy.mockRestore();
    });

    it('should comment on PR for high drift', async () => {
      process.env.CI = 'true';
      process.env.GITHUB_EVENT_NAME = 'pull_request';
      process.env.GITHUB_EVENT_NUMBER = '123';
      process.env.GITHUB_REPOSITORY = 'owner/repo';

      const mockOctokit = {
        issues: {
          createComment: jest.fn().mockResolvedValue({})
        }
      };
      (governance as any).octokit = mockOctokit;

      const report = createMockDriftReport('high');

      await (governance as any).enforceGovernance(report);

      expect(mockOctokit.issues.createComment).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 123,
        body: expect.stringContaining('Code Drift Warning')
      });
    });

    it('should handle low drift without blocking', async () => {
      const report = createMockDriftReport('low');

      await (governance as any).enforceGovernance(report);

      expect(consoleSpy.log).toHaveBeenCalledWith('🟢 Low drift detected');
      expect(mockFs.writeFileSync).not.toHaveBeenCalledWith('.governance-block', expect.any(String));
    });
  });

  describe('standards violations detection', () => {
    it('should parse ESLint output and filter custom rules', () => {
      const eslintOutput = JSON.stringify([
        {
          filePath: '/src/test.ts',
          messages: [
            {
              ruleId: 'no-wrapper-pattern',
              severity: 2,
              line: 10,
              message: 'Avoid wrapper pattern'
            },
            {
              ruleId: 'no-console',
              severity: 1,
              line: 15,
              message: 'Unexpected console statement'
            }
          ]
        }
      ]);

      mockExecSync.mockReturnValue(eslintOutput);

      const violations = (governance as any).checkStandardsViolations();

      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('no-wrapper-pattern');
      expect(violations[0].severity).toBe('error');
      expect(violations[0].file).toBe('/src/test.ts');
      expect(violations[0].line).toBe(10);
    });

    it('should handle ESLint errors gracefully', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('ESLint failed');
      });

      const violations = (governance as any).checkStandardsViolations();

      expect(violations).toEqual([]);
    });
  });

  describe('baseline management', () => {
    it('should return latest baseline when available', () => {
      mockFs.readdirSync.mockReturnValue(['baseline-2024-01-01.json', 'baseline-2024-01-02.json']);
      const mockBaseline = {
        timestamp: '2024-01-02T00:00:00.000Z',
        metrics: { totalEntities: 10, duplicateCount: 1, avgComplexity: 5, circularDeps: 0, unusedExports: 2 },
        entities: new Map()
      };
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockBaseline));

      const baseline = (governance as any).getBaseline('latest');

      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('baseline-2024-01-02.json'),
        'utf-8'
      );
      expect(baseline.timestamp).toBe('2024-01-02T00:00:00.000Z');
    });

    it('should create initial baseline when none exists', () => {
      mockFs.readdirSync.mockReturnValue([]);

      const baseline = (governance as any).getBaseline('latest');

      expect(baseline.metrics.totalEntities).toBe(0);
      expect(baseline.metrics.duplicateCount).toBe(0);
      expect(baseline.entities).toEqual(new Map());
    });

    it('should return specific baseline version', () => {
      const mockBaseline = {
        timestamp: '2024-01-01T00:00:00.000Z',
        metrics: { totalEntities: 5, duplicateCount: 0, avgComplexity: 3, circularDeps: 0, unusedExports: 1 },
        entities: new Map()
      };
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockBaseline));

      const baseline = (governance as any).getBaseline('v1.0.0');

      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('v1.0.0.json'),
        'utf-8'
      );
    });
  });

  describe('weekly reporting', () => {
    it('should generate weekly governance report', async () => {
      const mockReports = [
        createMockDriftReport('high'),
        createMockDriftReport('medium'),
        createMockDriftReport('low')
      ];

      mockFs.readdirSync.mockReturnValue(['drift-1.json', 'drift-2.json', 'drift-3.json']);
      mockFs.readFileSync
        .mockReturnValueOnce(JSON.stringify(mockReports[0]))
        .mockReturnValueOnce(JSON.stringify(mockReports[1]))
        .mockReturnValueOnce(JSON.stringify(mockReports[2]));

      await governance.createWeeklyReport();

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('weekly-'),
        expect.stringContaining('"totalDriftEvents"')
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.md'),
        expect.stringContaining('# Weekly Governance Report')
      );
    });

    it('should calculate trends correctly', () => {
      const reports = [
        {
          timestamp: '2024-01-01T00:00:00.000Z',
          drift: { newDuplicates: 5, complexityIncrease: 10, violatedStandards: [] }
        },
        {
          timestamp: '2024-01-02T00:00:00.000Z',
          drift: { newDuplicates: 3, complexityIncrease: 5, violatedStandards: [] }
        }
      ];

      const trends = (governance as any).calculateTrends(reports);

      expect(trends.duplicates).toBe('improving');
      expect(trends.complexity).toBe('improving');
      expect(trends.overall).toBe('improving');
    });

    it('should identify top violations', () => {
      const reports = [
        {
          drift: {
            violatedStandards: [
              { rule: 'no-wrapper-pattern' },
              { rule: 'consistent-error-handling' }
            ]
          }
        },
        {
          drift: {
            violatedStandards: [
              { rule: 'no-wrapper-pattern' },
              { rule: 'no-wrapper-pattern' }
            ]
          }
        }
      ];

      const topViolations = (governance as any).getTopViolations(reports);

      expect(topViolations[0].rule).toBe('no-wrapper-pattern');
      expect(topViolations[0].count).toBe(3);
      expect(topViolations[1].rule).toBe('consistent-error-handling');
      expect(topViolations[1].count).toBe(1);
    });
  });

  describe('ESLint rules generation', () => {
    it('should generate custom ESLint rules', () => {
      governance.generateESLintRules();

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '.eslint-rules/custom-governance.js',
        expect.stringContaining('no-wrapper-pattern')
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '.eslint-rules/custom-governance.js',
        expect.stringContaining('consistent-error-handling')
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '.eslint-rules/custom-governance.js',
        expect.stringContaining('no-duplicate-enums')
      );
    });
  });

  describe('utility methods', () => {
    it('should calculate average complexity correctly', () => {
      const entities = [
        { complexity: 5 },
        { complexity: 10 },
        { complexity: 15 },
        { name: 'NoComplexity' } // Should be ignored
      ];

      const avgComplexity = (governance as any).calculateAvgComplexity(entities);

      expect(avgComplexity).toBe(10); // (5 + 10 + 15) / 3
    });

    it('should return 0 for empty complexity array', () => {
      const entities = [{ name: 'test' }];

      const avgComplexity = (governance as any).calculateAvgComplexity(entities);

      expect(avgComplexity).toBe(0);
    });

    it('should identify custom ESLint rules', () => {
      expect((governance as any).isCustomRule('no-wrapper-pattern')).toBe(true);
      expect((governance as any).isCustomRule('consistent-error-handling')).toBe(true);
      expect((governance as any).isCustomRule('no-console')).toBe(false);
      expect((governance as any).isCustomRule('prefer-const')).toBe(false);
    });

    it('should format GitHub issue correctly', () => {
      const report = createMockDriftReport('critical');
      report.drift.newDuplicates = 5;
      report.drift.complexityIncrease = 12.5;
      report.recommendations = ['Fix duplicates', 'Reduce complexity'];

      const issueBody = (governance as any).formatGitHubIssue(report);

      expect(issueBody).toContain('Critical Code Drift Detected');
      expect(issueBody).toContain('Severity: critical');
      expect(issueBody).toContain('New Duplicates: 5');
      expect(issueBody).toContain('Complexity Increase: 12.5');
      expect(issueBody).toContain('- Fix duplicates');
      expect(issueBody).toContain('- Reduce complexity');
    });

    it('should format PR comment correctly', () => {
      const report = createMockDriftReport('high');
      report.recommendations = ['Address high priority issues'];

      const comment = (governance as any).formatPRComment(report);

      expect(comment).toContain('Code Drift Warning');
      expect(comment).toContain('severity: **high**');
      expect(comment).toContain('- Address high priority issues');
    });
  });

  describe('error handling', () => {
    it('should handle analysis execution errors', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Analysis failed');
      });

      await expect(governance.detectDrift()).rejects.toThrow('Analysis failed');
    });

    it('should handle missing analysis report file', async () => {
      mockExecSync.mockReturnValue(''); // Successful execution
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      await expect(governance.detectDrift()).rejects.toThrow('File not found');
    });

    it('should handle invalid JSON in analysis report', async () => {
      mockExecSync.mockReturnValue('');
      mockFs.readFileSync.mockReturnValue('invalid json');

      await expect(governance.detectDrift()).rejects.toThrow();
    });
  });

  describe('report filtering by time period', () => {
    it('should filter reports by time period correctly', () => {
      const now = Date.now();
      const reports = [
        { timestamp: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString() }, // 2 days ago
        { timestamp: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString() }, // 5 days ago  
        { timestamp: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString() } // 10 days ago
      ];

      mockFs.readdirSync.mockReturnValue(['drift-1.json', 'drift-2.json', 'drift-3.json']);
      mockFs.readFileSync
        .mockReturnValueOnce(JSON.stringify(reports[0]))
        .mockReturnValueOnce(JSON.stringify(reports[1]))
        .mockReturnValueOnce(JSON.stringify(reports[2]));

      const filtered = (governance as any).getReportsForPeriod(7); // Last 7 days

      expect(filtered).toHaveLength(2); // Only reports from last 7 days
    });
  });
});