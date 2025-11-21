/**
 * Merge Strategy Test Suite
 *
 * Comprehensive tests for merge strategies, three-way merge,
 * conflict resolution, and file validators.
 */

// Mock logger before importing modules
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import {
  MergeStrategyManager,
  createMergeManager,
  detectFileType,
} from '../../src/lib/merge-strategy';

import {
  threeWayMerge as threeWayMergeAlgorithm,
  resolveConflictMarkers,
  mergeMarkdown,
  createUnifiedDiff,
  LineStatus,
  ConflictStrategy,
  MergeableFileType,
  DEFAULT_USER_MARKERS,
} from '../../src/lib/three-way-merge';

import {
  validateFile,
  validateMergedContent,
  validateFiles,
  createValidationSummary,
  CommonSchemas,
  jsonValidator,
  yamlValidator,
  markdownValidator,
  scriptValidator,
} from '../../src/lib/file-validators';

describe('MergeStrategyManager', () => {
  let manager: MergeStrategyManager;

  beforeEach(() => {
    manager = createMergeManager();
  });

  describe('threeWayMerge', () => {
    it('should return original when all versions are identical', async () => {
      const content = 'line 1\nline 2\nline 3';
      const result = await manager.threeWayMerge({
        base: content,
        user: content,
        target: content,
      });

      expect(result.success).toBe(true);
      expect(result.content).toBe(content);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should take target when user has not modified', async () => {
      const base = 'line 1\nline 2';
      const user = 'line 1\nline 2';
      const target = 'line 1\nline 2\nline 3';

      const result = await manager.threeWayMerge({ base, user, target });

      expect(result.success).toBe(true);
      expect(result.content).toBe(target);
    });

    it('should keep user when target has not changed', async () => {
      const base = 'line 1\nline 2';
      const user = 'line 1\nline 2\nuser addition';
      const target = 'line 1\nline 2';

      const result = await manager.threeWayMerge({ base, user, target });

      expect(result.success).toBe(true);
      expect(result.content).toBe(user);
    });

    it('should auto-resolve conflicts with user priority by default', async () => {
      const base = 'line 1\noriginal\nline 3';
      const user = 'line 1\nuser change\nline 3';
      const target = 'line 1\ntarget change\nline 3';

      const result = await manager.threeWayMerge({ base, user, target });

      expect(result.success).toBe(true);
      expect(result.content).toContain('user change');
    });
  });

  describe('JSON merge', () => {
    it('should deep merge JSON objects', async () => {
      const base = JSON.stringify({ a: 1, b: { c: 2 } }, null, 2);
      const user = JSON.stringify({ a: 1, b: { c: 2 }, userField: 'test' }, null, 2);
      const target = JSON.stringify({ a: 1, b: { c: 2, d: 3 } }, null, 2);

      const result = await manager.threeWayMerge({
        base,
        user,
        target,
        fileType: 'json',
      });

      expect(result.success).toBe(true);
      const merged = JSON.parse(result.content!);
      expect(merged.userField).toBe('test');
      expect(merged.b.d).toBe(3);
    });
  });

  describe('detectFileType', () => {
    it('should detect JSON files', () => {
      expect(detectFileType('/path/to/file.json')).toBe('json');
    });

    it('should detect YAML files', () => {
      expect(detectFileType('/path/to/file.yaml')).toBe('yaml');
      expect(detectFileType('/path/to/file.yml')).toBe('yaml');
    });

    it('should detect markdown files', () => {
      expect(detectFileType('/path/to/file.md')).toBe('markdown');
    });

    it('should detect TypeScript files', () => {
      expect(detectFileType('/path/to/file.ts')).toBe('typescript');
    });

    it('should return text for unknown extensions', () => {
      expect(detectFileType('/path/to/file.xyz')).toBe('text');
    });
  });
});

describe('ThreeWayMergeAlgorithm', () => {
  describe('basic merge scenarios', () => {
    it('should handle identical content', () => {
      const content = 'line 1\nline 2\nline 3';
      const result = threeWayMergeAlgorithm(content, content, content);

      expect(result.success).toBe(true);
      expect(result.conflicts).toHaveLength(0);
      expect(result.content).toBe(content);
    });

    it('should detect conflicts when both modify same line', () => {
      const base = 'line 1\noriginal\nline 3';
      const ours = 'line 1\nours change\nline 3';
      const theirs = 'line 1\ntheirs change\nline 3';

      const result = threeWayMergeAlgorithm(base, ours, theirs);

      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.success).toBe(false);
    });
  });

  describe('line status tracking', () => {
    it('should track unchanged lines', () => {
      const content = 'line 1\nline 2';
      const result = threeWayMergeAlgorithm(content, content, content);

      const unchangedLines = result.lines.filter(l => l.status === LineStatus.UNCHANGED);
      expect(unchangedLines.length).toBeGreaterThan(0);
    });
  });

  describe('statistics', () => {
    it('should provide accurate merge statistics', () => {
      const base = 'line 1\nline 2\nline 3';
      const ours = 'line 1\nline 2\nline 3';
      const theirs = 'line 1\nline 2\nline 3';

      const result = threeWayMergeAlgorithm(base, ours, theirs);

      expect(result.statistics.totalLines).toBeGreaterThanOrEqual(0);
      expect(result.statistics.conflictLines).toBe(0);
    });
  });
});

describe('ConflictMarkerResolution', () => {
  it('should resolve conflicts with KEEP_EXISTING strategy', () => {
    const content = 'before\n<<<<<<< OURS\nour content\n=======\ntheir content\n>>>>>>> THEIRS\nafter';

    const resolved = resolveConflictMarkers(content, ConflictStrategy.KEEP_EXISTING);

    expect(resolved).toContain('our content');
    expect(resolved).not.toContain('their content');
    expect(resolved).not.toContain('<<<<<<<');
  });

  it('should resolve conflicts with USE_TEMPLATE strategy', () => {
    const content = 'before\n<<<<<<< OURS\nour content\n=======\ntheir content\n>>>>>>> THEIRS\nafter';

    const resolved = resolveConflictMarkers(content, ConflictStrategy.USE_TEMPLATE);

    expect(resolved).not.toContain('our content');
    expect(resolved).toContain('their content');
  });

  it('should resolve conflicts with MERGE strategy', () => {
    const content = 'before\n<<<<<<< OURS\nour content\n=======\ntheir content\n>>>>>>> THEIRS\nafter';

    const resolved = resolveConflictMarkers(content, ConflictStrategy.MERGE);

    expect(resolved).toContain('our content');
    expect(resolved).toContain('their content');
  });
});

describe('MarkdownMerge', () => {
  it('should preserve user sections during merge', () => {
    const base = '# Doc\n\nContent\n\n<!-- USER_START -->\nUser notes\n<!-- USER_END -->\n\nMore content';
    const ours = '# Doc\n\nContent\n\n<!-- USER_START -->\nModified user notes\n<!-- USER_END -->\n\nMore content';
    const theirs = '# Doc\n\nUpdated content\n\n<!-- USER_START -->\nUser notes\n<!-- USER_END -->\n\nUpdated more content';

    const result = mergeMarkdown(base, ours, theirs, true);

    expect(result.content).toContain('Modified user notes');
  });
});

describe('UnifiedDiff', () => {
  it('should create unified diff output', () => {
    const base = 'line 1\nline 2';
    const ours = 'line 1\nline 2\nline 3';
    const theirs = 'line 1\nline 2';

    const mergeResult = threeWayMergeAlgorithm(base, ours, theirs);
    const diff = createUnifiedDiff(mergeResult, 'original', 'modified', 'template');

    expect(diff).toContain('--- original');
    expect(diff).toContain('+++ modified / template');
  });
});

describe('FileValidators', () => {
  describe('JSON Validator', () => {
    it('should validate valid JSON', () => {
      const content = '{"name": "test", "version": "1.0.0"}';
      const result = jsonValidator.validate(content);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid JSON', () => {
      const content = '{"name": "test", invalid}';
      const result = jsonValidator.validate(content);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate against schema', () => {
      const content = '{"name": "test", "version": "1.0.0"}';
      const result = jsonValidator.validate(content, CommonSchemas.packageJson);

      expect(result.valid).toBe(true);
    });
  });

  describe('YAML Validator', () => {
    it('should validate valid YAML', () => {
      const content = 'name: test\nversion: 1.0.0';
      const result = yamlValidator.validate(content);

      expect(result.valid).toBe(true);
    });

    it('should detect tabs in YAML', () => {
      const content = 'name: test\n\tversion: 1.0.0';
      const result = yamlValidator.validate(content);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'TAB_CHARACTER')).toBe(true);
    });
  });

  describe('Markdown Validator', () => {
    it('should validate valid markdown', () => {
      const content = '# Title\n\nSome content\n\n## Section\n\nMore content';
      const result = markdownValidator.validate(content);

      expect(result.valid).toBe(true);
    });

    it('should warn about multiple H1 headings', () => {
      const content = '# Title 1\n\n# Title 2';
      const result = markdownValidator.validate(content);

      expect(result.warnings.some(w => w.code === 'MULTIPLE_H1')).toBe(true);
    });

    it('should detect unclosed code blocks', () => {
      const content = '# Title\n\n```javascript\ncode here\n';
      const result = markdownValidator.validate(content);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'UNCLOSED_CODE_BLOCK')).toBe(true);
    });
  });

  describe('Script Validator', () => {
    it('should validate valid shell script', () => {
      const content = '#!/bin/bash\nset -e\necho "Hello"';
      const result = scriptValidator.validate(content);

      expect(result.valid).toBe(true);
    });

    it('should detect dangerous commands', () => {
      const content = '#!/bin/bash\nrm -rf /';
      const result = scriptValidator.validate(content);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'DANGEROUS_COMMAND')).toBe(true);
    });
  });

  describe('validateFile', () => {
    it('should auto-detect file type and validate', () => {
      const content = '{"name": "test", "version": "1.0.0"}';
      const result = validateFile('/path/to/package.json', content);

      expect(result.valid).toBe(true);
    });
  });

  describe('validateMergedContent', () => {
    it('should auto-detect schema for package.json', () => {
      const content = '{"name": "test", "version": "1.0.0"}';
      const result = validateMergedContent('/path/to/package.json', content);

      expect(result.valid).toBe(true);
    });
  });

  describe('validateFiles (batch)', () => {
    it('should validate multiple files', () => {
      const files = [
        { path: '/test.json', content: '{"valid": true}' },
        { path: '/test.md', content: '# Valid Markdown' },
      ];

      const results = validateFiles(files);

      expect(results.size).toBe(2);
      expect(results.get('/test.json')?.valid).toBe(true);
      expect(results.get('/test.md')?.valid).toBe(true);
    });
  });

  describe('createValidationSummary', () => {
    it('should create accurate summary', () => {
      const results = new Map([
        ['/valid.json', { valid: true, errors: [], warnings: [], suggestions: [] }],
        ['/invalid.json', { valid: false, errors: [{ path: 'root', message: 'error', code: 'ERR' }], warnings: [], suggestions: [] }],
      ]);

      const summary = createValidationSummary(results);

      expect(summary.totalFiles).toBe(2);
      expect(summary.validFiles).toBe(1);
      expect(summary.invalidFiles).toBe(1);
      expect(summary.totalErrors).toBe(1);
    });
  });
});

describe('ConflictStrategy Enum', () => {
  it('should have all required strategies', () => {
    expect(ConflictStrategy.KEEP_EXISTING).toBe('KEEP_EXISTING');
    expect(ConflictStrategy.USE_TEMPLATE).toBe('USE_TEMPLATE');
    expect(ConflictStrategy.MERGE).toBe('MERGE');
    expect(ConflictStrategy.PROMPT).toBe('PROMPT');
  });
});

describe('MergeableFileType Enum', () => {
  it('should have all required file types', () => {
    expect(MergeableFileType.JSON).toBe('json');
    expect(MergeableFileType.YAML).toBe('yaml');
    expect(MergeableFileType.MARKDOWN).toBe('md');
    expect(MergeableFileType.SCRIPT).toBe('script');
    expect(MergeableFileType.CONFIG).toBe('config');
    expect(MergeableFileType.UNKNOWN).toBe('unknown');
  });
});

describe('User Section Markers', () => {
  it('should have markers for all file types', () => {
    expect(DEFAULT_USER_MARKERS[MergeableFileType.JSON]).toBeDefined();
    expect(DEFAULT_USER_MARKERS[MergeableFileType.YAML]).toBeDefined();
    expect(DEFAULT_USER_MARKERS[MergeableFileType.MARKDOWN]).toBeDefined();
    expect(DEFAULT_USER_MARKERS[MergeableFileType.SCRIPT]).toBeDefined();
    expect(DEFAULT_USER_MARKERS[MergeableFileType.CONFIG]).toBeDefined();
    expect(DEFAULT_USER_MARKERS[MergeableFileType.UNKNOWN]).toBeDefined();
  });

  it('should have start and end markers', () => {
    for (const fileType of Object.values(MergeableFileType)) {
      const markers = DEFAULT_USER_MARKERS[fileType];
      expect(markers.start).toBeDefined();
      expect(markers.end).toBeDefined();
      expect(markers.start.length).toBeGreaterThan(0);
      expect(markers.end.length).toBeGreaterThan(0);
    }
  });
});

describe('Common Schemas', () => {
  describe('packageJson schema', () => {
    it('should validate valid package.json', () => {
      const valid = {
        name: 'test-package',
        version: '1.0.0',
        description: 'A test package',
      };

      const result = CommonSchemas.packageJson.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
      const invalid = {
        description: 'Missing name and version',
      };

      const result = CommonSchemas.packageJson.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('tsConfig schema', () => {
    it('should validate valid tsconfig', () => {
      const valid = {
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
          strict: true,
        },
        include: ['src/**/*'],
        exclude: ['node_modules'],
      };

      const result = CommonSchemas.tsConfig.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });
});

describe('Merge Decision Tree Documentation', () => {
  /**
   * Decision tree for merge strategy selection:
   *
   * 1. Are files identical? -> KEEP_EXISTING (no merge needed)
   *    |
   *    v (No)
   * 2. What is the file type?
   *    |
   *    +-> JSON -> MERGE (deep merge with user preservation)
   *    |          Risk: LOW
   *    |
   *    +-> YAML -> MERGE (careful handling of nested structures)
   *    |          Risk: MEDIUM, requires review
   *    |
   *    +-> Markdown -> MERGE (three-way with section preservation)
   *    |              Risk: MEDIUM, requires review
   *    |
   *    +-> Script -> PROMPT (manual review required)
   *    |            Risk: HIGH
   *    |
   *    +-> Config -> KEEP_EXISTING (environment-specific)
   *    |            Risk: MEDIUM, requires review
   *    |
   *    +-> Unknown -> PROMPT (manual review required)
   *                   Risk: HIGH
   */
  it('should document the merge decision tree', () => {
    const decisionTree = {
      'Step 1: Check if files identical': {
        result: 'KEEP_EXISTING',
        reason: 'No merge needed',
      },
      'Step 2: Determine file type': {
        JSON: { strategy: 'MERGE', riskLevel: 'LOW' },
        YAML: { strategy: 'MERGE', riskLevel: 'MEDIUM' },
        Markdown: { strategy: 'MERGE', riskLevel: 'MEDIUM' },
        Script: { strategy: 'PROMPT', riskLevel: 'HIGH' },
        Config: { strategy: 'KEEP_EXISTING', riskLevel: 'MEDIUM' },
        Unknown: { strategy: 'PROMPT', riskLevel: 'HIGH' },
      },
    };

    expect(decisionTree['Step 1: Check if files identical']).toBeDefined();
    expect(decisionTree['Step 2: Determine file type']).toBeDefined();
  });
});
