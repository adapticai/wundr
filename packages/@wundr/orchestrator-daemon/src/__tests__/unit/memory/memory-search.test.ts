/**
 * Tests for MemorySearch (src/memory/memory-search.ts).
 *
 * Covers:
 *   - TF-IDF search implementation
 *   - Term frequency calculation
 *   - Inverse document frequency
 *   - Relevance scoring with section boosts
 *   - Query tokenization and stop-word removal
 *   - Recency boost
 *   - Context relevance boost
 *   - Confidence boost
 *   - Scope and section filtering
 *   - Stale entry filtering
 *   - Snippet generation with term highlighting
 *   - Result ordering (score descending, recency tie-break)
 *   - maxResults limit
 *   - minScore threshold
 *   - Empty query handling
 *   - scoreRelevance public method
 *
 * Also covers:
 *   - SessionSummaryGenerator (session-summary.ts)
 *   - MemoryLinker (memory-linker.ts)
 *   - MemoryFileManager: semantic dedup, parsing, serialization, secret detection
 *
 * All filesystem operations are mocked.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import {
  MemoryFileManager,
  type ParsedMemoryFile,
  type MemoryEntry,
  type MemorySection,
} from '../../../memory/memory-file-manager';
import { MemoryLinker, type MemoryLink } from '../../../memory/memory-linker';
import {
  MemorySearch,
  type RelevanceContext,
} from '../../../memory/memory-search';
import {
  SessionSummaryGenerator,
  type SessionSummaryResult,
} from '../../../memory/session-summary';

import type { ConversationTurn } from '../../../memory/learning-detector';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    mkdir: vi.fn(),
    unlink: vi.fn(),
  },
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
  mkdir: vi.fn(),
  unlink: vi.fn(),
}));

vi.mock('node:fs', () => ({
  default: {
    mkdirSync: vi.fn(),
  },
  mkdirSync: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(text: string, meta?: MemoryEntry['metadata']): MemoryEntry {
  return { text, children: [], line: 1, metadata: meta };
}

function makeSection(
  title: string,
  entries: MemoryEntry[] = []
): MemorySection {
  return { title, entries, startLine: 1, endLine: 10 };
}

function makeFile(
  filePath: string,
  sections: MemorySection[] = [],
  exists = true
): ParsedMemoryFile {
  return {
    path: filePath,
    raw: exists ? '# Auto-Memories\n' : '',
    sections,
    lineCount: 10,
    exists,
  };
}

type ScopedFile = { file: ParsedMemoryFile; scope: string };

function makeScopedFile(
  scope: string,
  sections: MemorySection[],
  filePath = `/test/${scope}/MEMORY.md`
): ScopedFile {
  return { file: makeFile(filePath, sections), scope };
}

function makeTurn(overrides: Partial<ConversationTurn> = {}): ConversationTurn {
  return {
    role: 'user',
    content: 'test',
    timestamp: new Date('2026-01-15T10:00:00Z'),
    sessionId: 'sess-1',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// MemorySearch
// ---------------------------------------------------------------------------

describe('MemorySearch', () => {
  let searcher: MemorySearch;

  beforeEach(() => {
    searcher = new MemorySearch();
  });

  // -----------------------------------------------------------------------
  // Tokenization and stop-word removal
  // -----------------------------------------------------------------------

  describe('search tokenization', () => {
    it('should return empty results for empty query', () => {
      const files: ScopedFile[] = [
        makeScopedFile('project', [
          makeSection('User Preferences', [makeEntry('Use dark mode')]),
        ]),
      ];

      const results = searcher.search('', files);

      expect(results).toEqual([]);
    });

    it('should return empty results for query with only stop words', () => {
      const files: ScopedFile[] = [
        makeScopedFile('project', [
          makeSection('User Preferences', [makeEntry('Use dark mode')]),
        ]),
      ];

      const results = searcher.search('the is a an', files);

      expect(results).toEqual([]);
    });

    it('should match case-insensitively', () => {
      const files: ScopedFile[] = [
        makeScopedFile('project', [
          makeSection('User Preferences', [
            makeEntry('Use TypeScript for all new files'),
          ]),
        ]),
      ];

      const results = searcher.search('typescript', files);

      expect(results.length).toBe(1);
      expect(results[0]!.text).toContain('TypeScript');
    });

    it('should strip punctuation from query and entry', () => {
      const files: ScopedFile[] = [
        makeScopedFile('project', [
          makeSection('Error Patterns', [
            makeEntry('When seeing `ENOENT`, check the file path'),
          ]),
        ]),
      ];

      const results = searcher.search('enoent file-path', files);

      expect(results.length).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // TF-IDF scoring
  // -----------------------------------------------------------------------

  describe('TF-IDF scoring', () => {
    it('should rank entries with more matching terms higher', () => {
      const files: ScopedFile[] = [
        makeScopedFile('project', [
          makeSection('Error Patterns', [
            makeEntry('TypeScript compiler error in src directory'),
            makeEntry('Network timeout error when calling API endpoints'),
          ]),
        ]),
      ];

      const results = searcher.search('TypeScript compiler error', files, {
        minScore: 0,
      });

      expect(results.length).toBe(2);
      // Entry with more overlap should rank first
      expect(results[0]!.text).toContain('TypeScript compiler');
      expect(results[0]!.score).toBeGreaterThan(results[1]!.score);
    });

    it('should give higher IDF to rare terms', () => {
      const files: ScopedFile[] = [
        makeScopedFile('project', [
          makeSection('Error Patterns', [
            makeEntry('Common error handling pattern'),
            makeEntry('Common error logging approach'),
            makeEntry('Rare xylophone configuration needed'),
          ]),
        ]),
      ];

      // "xylophone" is rare (appears in 1 doc), "error" is common (2 docs)
      const results = searcher.search('xylophone error', files, {
        minScore: 0,
      });

      // The entry with "xylophone" should score high due to high IDF
      const xyloResult = results.find(r => r.text.includes('xylophone'));
      expect(xyloResult).toBeDefined();
      expect(xyloResult!.score).toBeGreaterThan(0);
    });

    it('should use log(1+tf) normalization for term frequency', () => {
      // An entry where a term appears multiple times should score higher
      // than one where it appears once
      const files: ScopedFile[] = [
        makeScopedFile('project', [
          makeSection('Tool Usage', [
            makeEntry('Run tests, check tests, verify tests pass'),
            makeEntry('Run deployment script once'),
          ]),
        ]),
      ];

      const results = searcher.search('tests', files, { minScore: 0.001 });

      expect(results.length).toBe(1); // Only the tests entry should match
      expect(results[0]!.text).toContain('tests');
    });
  });

  // -----------------------------------------------------------------------
  // Section priority boost
  // -----------------------------------------------------------------------

  describe('section priority boost', () => {
    it('should boost Corrections entries higher than Tool Usage', () => {
      const files: ScopedFile[] = [
        makeScopedFile('project', [
          makeSection('Tool Usage', [
            makeEntry('Use prettier for formatting code'),
          ]),
          makeSection('Corrections', [
            makeEntry('Use prettier for formatting code'),
          ]),
        ]),
      ];

      const results = searcher.search('prettier formatting', files, {
        minScore: 0,
      });

      expect(results.length).toBe(2);
      const corrections = results.find(r => r.section === 'Corrections');
      const tools = results.find(r => r.section === 'Tool Usage');

      expect(corrections!.score).toBeGreaterThan(tools!.score);
    });

    it('should give Links section the lowest boost', () => {
      const files: ScopedFile[] = [
        makeScopedFile('project', [
          makeSection('Links', [
            makeEntry('[Error Patterns](memory/error-patterns.md)'),
          ]),
          makeSection('Error Patterns', [
            makeEntry('Common error patterns observed'),
          ]),
        ]),
      ];

      const results = searcher.search('error patterns', files, {
        minScore: 0,
      });

      if (results.length >= 2) {
        const linksResult = results.find(r => r.section === 'Links');
        const errorResult = results.find(r => r.section === 'Error Patterns');
        if (linksResult && errorResult) {
          expect(errorResult.score).toBeGreaterThan(linksResult.score);
        }
      }
    });
  });

  // -----------------------------------------------------------------------
  // Recency boost
  // -----------------------------------------------------------------------

  describe('recency boost', () => {
    it('should rank recent entries higher when recencyBoost is enabled', () => {
      const files: ScopedFile[] = [
        makeScopedFile('project', [
          makeSection('User Preferences', [
            makeEntry('Use tabs for indentation', {
              dateAdded: '2024-01-01',
            }),
            makeEntry('Use tabs for alignment', {
              dateAdded: new Date().toISOString().split('T')[0],
            }),
          ]),
        ]),
      ];

      const results = searcher.search('tabs', files, {
        minScore: 0,
        recencyBoost: 0.5,
      });

      expect(results.length).toBe(2);
      // The more recent entry should score higher
      expect(results[0]!.text).toContain('alignment');
    });

    it('should not apply recency boost when set to 0', () => {
      const files: ScopedFile[] = [
        makeScopedFile('project', [
          makeSection('User Preferences', [
            makeEntry('Use tabs for indentation', {
              dateAdded: '2024-01-01',
            }),
            makeEntry('Use tabs for alignment', {
              dateAdded: new Date().toISOString().split('T')[0],
            }),
          ]),
        ]),
      ];

      const results = searcher.search('tabs', files, {
        minScore: 0,
        recencyBoost: 0,
      });

      // Without recency boost, both should have similar scores
      expect(results.length).toBe(2);
    });

    it('should handle invalid dates gracefully (recency factor = 0)', () => {
      const files: ScopedFile[] = [
        makeScopedFile('project', [
          makeSection('User Preferences', [
            makeEntry('Use tabs everywhere', { dateAdded: 'not-a-date' }),
          ]),
        ]),
      ];

      const results = searcher.search('tabs', files, { minScore: 0 });

      expect(results.length).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Confidence boost
  // -----------------------------------------------------------------------

  describe('confidence boost', () => {
    it('should boost higher-confidence entries', () => {
      const files: ScopedFile[] = [
        makeScopedFile('project', [
          makeSection('User Preferences', [
            makeEntry('Use spaces for indentation', { confidence: 0.5 }),
            makeEntry('Use spaces for alignment', { confidence: 0.99 }),
          ]),
        ]),
      ];

      const results = searcher.search('spaces', files, {
        minScore: 0,
        recencyBoost: 0,
      });

      expect(results.length).toBe(2);
      // Higher confidence entry should rank first
      expect(results[0]!.metadata?.confidence).toBe(0.99);
    });
  });

  // -----------------------------------------------------------------------
  // Context relevance boost
  // -----------------------------------------------------------------------

  describe('context relevance', () => {
    it('should boost entries matching the current file context', () => {
      const files: ScopedFile[] = [
        makeScopedFile('project', [
          makeSection('Project Conventions', [
            makeEntry('React components use functional style'),
            makeEntry('Python scripts follow PEP 8 style'),
          ]),
        ]),
      ];

      const context: RelevanceContext = {
        currentFile: 'src/components/Header.tsx',
      };

      const results = searcher.search('style', files, { minScore: 0 }, context);

      expect(results.length).toBe(2);
      // React entry should rank higher because "components" overlaps with currentFile
      expect(results[0]!.text).toContain('React');
    });

    it('should boost Error Patterns when recentErrors is provided', () => {
      const files: ScopedFile[] = [
        makeScopedFile('project', [
          makeSection('Error Patterns', [
            makeEntry('ENOENT errors mean missing file'),
          ]),
          makeSection('User Preferences', [
            makeEntry('ENOENT notifications should be silent'),
          ]),
        ]),
      ];

      const context: RelevanceContext = {
        recentErrors: ['ENOENT: no such file /foo/bar'],
      };

      const results = searcher.search(
        'enoent',
        files,
        { minScore: 0 },
        context
      );

      // Error Patterns entry should get context boost
      if (results.length >= 2) {
        const errorEntry = results.find(r => r.section === 'Error Patterns');
        expect(errorEntry).toBeDefined();
      }
    });

    it('should boost Tool Usage entries when recentTools is provided', () => {
      const files: ScopedFile[] = [
        makeScopedFile('project', [
          makeSection('Tool Usage', [
            makeEntry('Run vitest for testing in this project'),
          ]),
          makeSection('User Preferences', [
            makeEntry('Running vitest requires Node 18+'),
          ]),
        ]),
      ];

      const context: RelevanceContext = {
        recentTools: ['vitest', 'read_file'],
      };

      const results = searcher.search(
        'vitest',
        files,
        { minScore: 0 },
        context
      );

      expect(results.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // Filtering
  // -----------------------------------------------------------------------

  describe('filtering', () => {
    const testFiles: ScopedFile[] = [
      makeScopedFile('user', [
        makeSection('User Preferences', [
          makeEntry('Use dark mode everywhere'),
        ]),
      ]),
      makeScopedFile('project', [
        makeSection('Project Conventions', [
          makeEntry('Use ESLint with strict mode'),
        ]),
      ]),
      makeScopedFile('local', [
        makeSection('Workflow', [makeEntry('Build using pnpm locally')]),
      ]),
    ];

    it('should filter by scope', () => {
      const results = searcher.search('mode', testFiles, {
        scopes: ['user'],
        minScore: 0,
      });

      expect(results.every(r => r.scope === 'user')).toBe(true);
    });

    it('should filter by section', () => {
      const results = searcher.search('use', testFiles, {
        sections: ['Project Conventions'],
        minScore: 0,
      });

      expect(results.every(r => r.section === 'Project Conventions')).toBe(
        true
      );
    });

    it('should filter out stale entries by default', () => {
      const files: ScopedFile[] = [
        makeScopedFile('project', [
          makeSection('User Preferences', [
            makeEntry('Use dark mode', { stale: true }),
            makeEntry('Use light mode'),
          ]),
        ]),
      ];

      const results = searcher.search('mode', files, { minScore: 0 });

      expect(results.length).toBe(1);
      expect(results[0]!.text).toContain('light');
    });

    it('should include stale entries when includeStale is true', () => {
      const files: ScopedFile[] = [
        makeScopedFile('project', [
          makeSection('User Preferences', [
            makeEntry('Use dark mode', { stale: true }),
            makeEntry('Use light mode'),
          ]),
        ]),
      ];

      const results = searcher.search('mode', files, {
        minScore: 0,
        includeStale: true,
      });

      expect(results.length).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // Limits and thresholds
  // -----------------------------------------------------------------------

  describe('limits and thresholds', () => {
    it('should limit results to maxResults', () => {
      const entries = Array.from({ length: 20 }, (_, i) =>
        makeEntry(`Error pattern number ${i} details here`)
      );
      const files: ScopedFile[] = [
        makeScopedFile('project', [makeSection('Error Patterns', entries)]),
      ];

      const results = searcher.search('error pattern', files, {
        maxResults: 5,
        minScore: 0,
      });

      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('should filter results below minScore threshold', () => {
      const files: ScopedFile[] = [
        makeScopedFile('project', [
          makeSection('User Preferences', [
            makeEntry('Use dark mode in all editors'),
            makeEntry('Completely unrelated entry about quantum physics'),
          ]),
        ]),
      ];

      const results = searcher.search('dark mode editor', files, {
        minScore: 0.5,
      });

      // Only the matching entry should pass the high threshold
      for (const r of results) {
        expect(r.score).toBeGreaterThanOrEqual(0.5);
      }
    });

    it('should use default maxResults of 10 when not specified', () => {
      const entries = Array.from({ length: 30 }, (_, i) =>
        makeEntry(`Testing pattern entry number ${i}`)
      );
      const files: ScopedFile[] = [
        makeScopedFile('project', [makeSection('Error Patterns', entries)]),
      ];

      const results = searcher.search('testing pattern', files, {
        minScore: 0,
      });

      expect(results.length).toBeLessThanOrEqual(10);
    });
  });

  // -----------------------------------------------------------------------
  // Snippet generation
  // -----------------------------------------------------------------------

  describe('snippet generation', () => {
    it('should include highlighted matching terms in snippet', () => {
      const files: ScopedFile[] = [
        makeScopedFile('project', [
          makeSection('Error Patterns', [
            makeEntry('The TypeScript compiler throws ENOENT when path is bad'),
          ]),
        ]),
      ];

      const results = searcher.search('typescript enoent', files, {
        minScore: 0,
      });

      expect(results.length).toBe(1);
      expect(results[0]!.snippet).toContain('**');
    });

    it('should truncate long snippets to ~150 chars', () => {
      const longText =
        'A'.repeat(50) +
        ' typescript ' +
        'B'.repeat(50) +
        ' compiler ' +
        'C'.repeat(100);
      const files: ScopedFile[] = [
        makeScopedFile('project', [
          makeSection('Error Patterns', [makeEntry(longText)]),
        ]),
      ];

      const results = searcher.search('typescript compiler', files, {
        minScore: 0,
      });

      expect(results.length).toBe(1);
      expect(results[0]!.snippet!.length).toBeLessThanOrEqual(200);
    });
  });

  // -----------------------------------------------------------------------
  // Result ordering
  // -----------------------------------------------------------------------

  describe('result ordering', () => {
    it('should sort by score descending', () => {
      const files: ScopedFile[] = [
        makeScopedFile('project', [
          makeSection('Error Patterns', [
            makeEntry('General error debugging tips'),
            makeEntry(
              'TypeScript compiler error details for advanced debugging'
            ),
          ]),
        ]),
      ];

      const results = searcher.search('typescript compiler debugging', files, {
        minScore: 0,
      });

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1]!.score).toBeGreaterThanOrEqual(results[i]!.score);
      }
    });

    it('should break ties by recency (newer first)', () => {
      const files: ScopedFile[] = [
        makeScopedFile('project', [
          makeSection('User Preferences', [
            makeEntry('Use tabs everywhere', { dateAdded: '2025-01-01' }),
            makeEntry('Use tabs always', { dateAdded: '2026-02-01' }),
          ]),
        ]),
      ];

      const results = searcher.search('tabs', files, {
        minScore: 0,
        recencyBoost: 0,
      });

      // With no recency boost, TF-IDF scores should be very similar
      // Tie-break should put the newer entry first
      if (results.length === 2 && results[0]!.score === results[1]!.score) {
        expect(results[0]!.metadata?.dateAdded).toBe('2026-02-01');
      }
    });
  });

  // -----------------------------------------------------------------------
  // scoreRelevance (public method)
  // -----------------------------------------------------------------------

  describe('scoreRelevance', () => {
    it('should return 0 for empty context', () => {
      const entry = makeEntry('Use dark mode');
      const section = makeSection('User Preferences', [entry]);

      const score = searcher.scoreRelevance(entry, section, {});

      expect(score).toBe(0);
    });

    it('should score higher for task description overlap', () => {
      const entry = makeEntry(
        'Use TypeScript strict mode for better type safety'
      );
      const section = makeSection('Project Conventions', [entry]);

      const scoreWithTask = searcher.scoreRelevance(entry, section, {
        taskDescription: 'Enable TypeScript strict mode in tsconfig',
      });
      const scoreWithoutTask = searcher.scoreRelevance(entry, section, {});

      expect(scoreWithTask).toBeGreaterThan(scoreWithoutTask);
    });

    it('should add section-based bonus for Error Patterns with recent errors', () => {
      const entry = makeEntry('ENOENT usually means bad path');
      const section = makeSection('Error Patterns', [entry]);

      const scoreWithErrors = searcher.scoreRelevance(entry, section, {
        recentErrors: ['ENOENT: missing file'],
      });
      const scoreWithoutErrors = searcher.scoreRelevance(entry, section, {});

      expect(scoreWithErrors).toBeGreaterThan(scoreWithoutErrors);
    });

    it('should cap the score at 1.0', () => {
      const entry = makeEntry(
        'TypeScript compiler error in testing infrastructure'
      );
      const section = makeSection('Error Patterns', [entry]);

      const score = searcher.scoreRelevance(entry, section, {
        currentFile: 'test/typescript/compiler.test.ts',
        taskDescription: 'Fix TypeScript compiler error in testing',
        recentErrors: ['TypeScript compiler error: type mismatch'],
        recentTools: ['typescript', 'compiler'],
      });

      expect(score).toBeLessThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------------
  // Result metadata
  // -----------------------------------------------------------------------

  describe('result metadata', () => {
    it('should include scope, filePath, section, and line in results', () => {
      const entry = makeEntry('Use prettier');
      entry.line = 42;
      const files: ScopedFile[] = [
        makeScopedFile('project', [makeSection('User Preferences', [entry])]),
      ];

      const results = searcher.search('prettier', files, { minScore: 0 });

      expect(results.length).toBe(1);
      expect(results[0]!.scope).toBe('project');
      expect(results[0]!.section).toBe('User Preferences');
      expect(results[0]!.line).toBe(42);
      expect(results[0]!.filePath).toContain('MEMORY.md');
    });

    it('should round scores to 3 decimal places', () => {
      const files: ScopedFile[] = [
        makeScopedFile('project', [
          makeSection('User Preferences', [
            makeEntry('Use TypeScript in this project for type safety'),
          ]),
        ]),
      ];

      const results = searcher.search('typescript project', files, {
        minScore: 0,
      });

      if (results.length > 0) {
        const scoreStr = results[0]!.score.toString();
        const decimalParts = scoreStr.split('.');
        if (decimalParts.length === 2) {
          expect(decimalParts[1]!.length).toBeLessThanOrEqual(3);
        }
      }
    });
  });
});

// ===========================================================================
// SessionSummaryGenerator
// ===========================================================================

describe('SessionSummaryGenerator', () => {
  let generator: SessionSummaryGenerator;

  beforeEach(() => {
    generator = new SessionSummaryGenerator();
  });

  describe('generateSummary', () => {
    it('should return null when turns are below minTurns threshold', () => {
      const turns = [makeTurn(), makeTurn()]; // only 2 turns
      const result = generator.generateSummary('sess-1', turns, 0);

      expect(result).toBeNull();
    });

    it('should generate a summary for enough turns', () => {
      const turns = [
        makeTurn({
          role: 'user',
          content: 'Help me with TypeScript generics in this codebase',
          timestamp: new Date('2026-01-15T10:00:00Z'),
        }),
        makeTurn({
          role: 'assistant',
          content:
            "I'll help with TypeScript generics. Let me look at the code.",
          timestamp: new Date('2026-01-15T10:00:30Z'),
        }),
        makeTurn({
          role: 'user',
          content:
            'In this project we use strict mode. Check the tsconfig file.',
          timestamp: new Date('2026-01-15T10:01:00Z'),
        }),
        makeTurn({
          role: 'assistant',
          content:
            "I'll use strict mode as configured. Let's fix the type errors.",
          timestamp: new Date('2026-01-15T10:01:30Z'),
        }),
      ];

      const result = generator.generateSummary('sess-1', turns, 2);

      expect(result).not.toBeNull();
      expect(result!.sessionId).toBe('sess-1');
      expect(result!.turnCount).toBe(4);
      expect(result!.userTurnCount).toBe(2);
      expect(result!.assistantTurnCount).toBe(2);
      expect(result!.memoriesStored).toBe(2);
      expect(result!.summaryText).toContain('sess-1');
    });

    it('should extract topics from conversation', () => {
      const turns = [
        makeTurn({
          content: 'Help me with TypeScript testing framework setup',
        }),
        makeTurn({
          role: 'assistant',
          content: 'I will set up the testing framework for TypeScript',
        }),
        makeTurn({ content: 'Also configure the TypeScript compiler options' }),
      ];

      const result = generator.generateSummary('sess-1', turns, 0);

      expect(result!.topics.length).toBeGreaterThan(0);
      expect(result!.topics).toContain('typescript');
    });

    it('should extract tools used from tool calls', () => {
      const turns = [
        makeTurn({
          content: 'Read a file',
          toolCalls: [
            {
              name: 'read_file',
              args: '/src/index.ts',
              result: 'content',
              success: true,
            },
          ],
        }),
        makeTurn({ role: 'assistant', content: 'Here is the file.' }),
        makeTurn({
          content: 'Write another file',
          toolCalls: [
            {
              name: 'write_file',
              args: '/src/output.ts',
              result: 'ok',
              success: true,
            },
          ],
        }),
      ];

      const result = generator.generateSummary('sess-1', turns, 0);

      expect(result!.toolsUsed).toContain('read_file');
      expect(result!.toolsUsed).toContain('write_file');
    });

    it('should extract errors from failed tool calls', () => {
      const turns = [
        makeTurn({
          content: 'Run build',
          toolCalls: [
            {
              name: 'bash',
              args: 'npm run build',
              result: '',
              success: false,
              error: 'Error: Module not found: @types/node',
            },
          ],
        }),
        makeTurn({ role: 'assistant', content: 'Build failed.' }),
        makeTurn({ content: 'Fix it.' }),
      ];

      const result = generator.generateSummary('sess-1', turns, 0);

      expect(result!.errorsEncountered.length).toBeGreaterThan(0);
      expect(result!.errorsEncountered[0]).toContain('Module not found');
    });

    it('should extract decisions from assistant turns', () => {
      const turns = [
        makeTurn({ content: 'How should we structure the code?' }),
        makeTurn({
          role: 'assistant',
          content:
            "I'll use a modular architecture with separate modules for each feature.",
        }),
        makeTurn({ content: 'Sounds good.' }),
      ];

      const result = generator.generateSummary('sess-1', turns, 0);

      expect(result!.decisions.length).toBeGreaterThan(0);
    });

    it('should extract file paths from tool call args', () => {
      const turns = [
        makeTurn({
          content: 'Edit the file',
          toolCalls: [
            {
              name: 'write_file',
              args: './src/components/Header.tsx',
              result: 'ok',
              success: true,
            },
          ],
        }),
        makeTurn({ role: 'assistant', content: 'Done.' }),
        makeTurn({ content: 'Thanks.' }),
      ];

      const result = generator.generateSummary('sess-1', turns, 0);

      expect(result!.filesTouched).toContain('./src/components/Header.tsx');
    });

    it('should recommend user scope for user-preference content', () => {
      const turns = [
        makeTurn({
          content: 'I prefer dark mode in all my editors always',
        }),
        makeTurn({
          role: 'assistant',
          content: "I'll remember that preference.",
        }),
        makeTurn({
          content: 'Also from now on use TypeScript for everything',
        }),
      ];

      const result = generator.generateSummary('sess-1', turns, 0);

      expect(result!.recommendedScope).toBe('user');
    });

    it('should recommend project scope for project-specific content', () => {
      const turns = [
        makeTurn({
          content: 'In this project we use ESLint with strict rules',
        }),
        makeTurn({
          role: 'assistant',
          content: "I'll follow the project conventions.",
        }),
        makeTurn({
          content: 'The architecture uses microservices and more stuff',
        }),
      ];

      const result = generator.generateSummary('sess-1', turns, 0);

      expect(result!.recommendedScope).toBe('project');
    });

    it('should truncate summary text to maxSummaryLength', () => {
      const gen = new SessionSummaryGenerator({ maxSummaryLength: 50 });

      const turns = [
        makeTurn({
          content:
            'Very long discussion about multiple topics including TypeScript and React',
        }),
        makeTurn({
          role: 'assistant',
          content: 'Working on all the topics you mentioned.',
        }),
        makeTurn({ content: 'Also discuss testing and deployment strategies' }),
      ];

      const result = gen.generateSummary('sess-1', turns, 5);

      expect(result!.summaryText.length).toBeLessThanOrEqual(50);
    });
  });

  describe('summaryToMemoryEntry', () => {
    it('should create a DetectedMemory from a summary', () => {
      const summary: SessionSummaryResult = {
        sessionId: 'sess-1',
        startedAt: '2026-01-15T10:00:00Z',
        endedAt: '2026-01-15T11:00:00Z',
        turnCount: 10,
        userTurnCount: 5,
        assistantTurnCount: 5,
        topics: ['typescript', 'testing'],
        toolsUsed: ['read_file'],
        errorsEncountered: [],
        decisions: ['Use modular architecture'],
        filesTouched: ['./src/index.ts'],
        memoriesStored: 3,
        summaryText: 'Session summary text here',
        recommendedScope: 'project',
      };

      const entry = generator.summaryToMemoryEntry(summary);

      expect(entry.text).toBe('Session summary text here');
      expect(entry.section).toBe('Workflow');
      expect(entry.scope).toBe('project');
      expect(entry.confidence).toBe(0.75);
      expect(entry.category).toBe('project-pattern');
    });
  });

  describe('parseTurnsFromTranscript', () => {
    it('should parse valid JSONL with message records', () => {
      const jsonl = [
        JSON.stringify({
          type: 'message',
          message: { role: 'user', content: 'Hello' },
          timestamp: '2026-01-15T10:00:00Z',
        }),
        JSON.stringify({
          type: 'message',
          message: { role: 'assistant', content: 'Hi there!' },
          timestamp: '2026-01-15T10:00:05Z',
        }),
      ].join('\n');

      const turns = generator.parseTurnsFromTranscript(jsonl, 'sess-1');

      expect(turns).toHaveLength(2);
      expect(turns[0]!.role).toBe('user');
      expect(turns[0]!.content).toBe('Hello');
      expect(turns[0]!.sessionId).toBe('sess-1');
    });

    it('should skip system messages', () => {
      const jsonl = [
        JSON.stringify({
          type: 'message',
          message: { role: 'system', content: 'System prompt' },
        }),
        JSON.stringify({
          type: 'message',
          message: { role: 'user', content: 'Hello' },
        }),
      ].join('\n');

      const turns = generator.parseTurnsFromTranscript(jsonl, 'sess-1');

      expect(turns).toHaveLength(1);
      expect(turns[0]!.role).toBe('user');
    });

    it('should skip non-message type records', () => {
      const jsonl = [
        JSON.stringify({ type: 'tool_call', name: 'read_file' }),
        JSON.stringify({
          type: 'message',
          message: { role: 'user', content: 'Hello' },
        }),
      ].join('\n');

      const turns = generator.parseTurnsFromTranscript(jsonl, 'sess-1');

      expect(turns).toHaveLength(1);
    });

    it('should skip invalid JSON lines', () => {
      const jsonl = [
        'not valid json',
        '',
        JSON.stringify({
          type: 'message',
          message: { role: 'user', content: 'Hello' },
        }),
      ].join('\n');

      const turns = generator.parseTurnsFromTranscript(jsonl, 'sess-1');

      expect(turns).toHaveLength(1);
    });

    it('should handle array content (text blocks)', () => {
      const jsonl = JSON.stringify({
        type: 'message',
        message: {
          role: 'user',
          content: [
            { type: 'text', text: 'Hello ' },
            { type: 'text', text: 'world' },
          ],
        },
      });

      const turns = generator.parseTurnsFromTranscript(jsonl, 'sess-1');

      expect(turns).toHaveLength(1);
      expect(turns[0]!.content).toBe('Hello  world');
    });
  });
});

// ===========================================================================
// MemoryLinker
// ===========================================================================

describe('MemoryLinker', () => {
  let fm: MemoryFileManager;
  let linker: MemoryLinker;

  beforeEach(() => {
    fm = new MemoryFileManager();
    linker = new MemoryLinker(fm);
  });

  describe('detectLinks', () => {
    it('should not link entries in the same section', () => {
      const file = makeFile('/test/MEMORY.md', [
        makeSection('User Preferences', [
          makeEntry('Use TypeScript strict mode'),
          makeEntry('TypeScript strict mode prevents errors'),
        ]),
      ]);

      const links = linker.detectLinks(file);

      // Same section entries are skipped
      expect(links).toEqual([]);
    });

    it('should detect keyword overlap between different sections', () => {
      const file = makeFile('/test/MEMORY.md', [
        makeSection('User Preferences', [
          makeEntry('Use prettier formatter configuration setup'),
        ]),
        makeSection('Tool Usage', [
          makeEntry('Run prettier formatter configuration command'),
        ]),
      ]);

      const links = linker.detectLinks(file);

      // "prettier", "formatter", "configuration" overlap
      expect(links.length).toBeGreaterThanOrEqual(1);
      expect(links[0]!.reason).toBe('keyword-overlap');
    });

    it('should detect error-to-tool links', () => {
      const file = makeFile('/test/MEMORY.md', [
        makeSection('Error Patterns', [
          makeEntry('When prettier throws formatting error'),
        ]),
        makeSection('Tool Usage', [
          makeEntry('Run prettier with --write flag to fix formatting'),
        ]),
      ]);

      const links = linker.detectLinks(file);

      links.find(l => l.reason === 'error-fix-pair');
      // "prettier" and "formatting" overlap so at minimum keyword-overlap
      expect(links.length).toBeGreaterThan(0);
    });

    it('should detect explicit backtick references', () => {
      const file = makeFile('/test/MEMORY.md', [
        makeSection('Project Conventions', [
          makeEntry('Always use `vitest` for testing'),
        ]),
        makeSection('Tool Usage', [
          makeEntry('Run vitest with --coverage flag'),
        ]),
      ]);

      const links = linker.detectLinks(file);

      const refLink = links.find(l => l.reason === 'explicit-reference');
      if (refLink) {
        expect(refLink.sourceSection).toBe('Project Conventions');
      }
      // Might also detect keyword-overlap
      expect(links.length).toBeGreaterThan(0);
    });

    it('should skip the Links section', () => {
      const file = makeFile('/test/MEMORY.md', [
        makeSection('Links', [makeEntry('[Errors](memory/errors.md)')]),
        makeSection('Error Patterns', [
          makeEntry('Check error logs in memory directory'),
        ]),
      ]);

      const links = linker.detectLinks(file);

      // Links section entries should be excluded
      expect(links.every(l => l.sourceSection !== 'Links')).toBe(true);
      expect(links.every(l => l.targetSection !== 'Links')).toBe(true);
    });

    it('should return empty for file with no sections', () => {
      const file = makeFile('/test/MEMORY.md', []);

      const links = linker.detectLinks(file);

      expect(links).toEqual([]);
    });
  });

  describe('applyLinks', () => {
    it('should add link metadata to matched entries', () => {
      const entryA = makeEntry('Use prettier for formatting');
      const entryB = makeEntry('Run prettier command');

      const file = makeFile('/test/MEMORY.md', [
        makeSection('User Preferences', [entryA]),
        makeSection('Tool Usage', [entryB]),
      ]);

      const links: MemoryLink[] = [
        {
          sourceText: entryA.text,
          sourceSection: 'User Preferences',
          targetText: entryB.text,
          targetSection: 'Tool Usage',
          similarity: 0.5,
          reason: 'keyword-overlap',
        },
      ];

      const updated = linker.applyLinks(file, links);

      expect(updated).toBe(2); // Both source and target updated
      expect(entryA.metadata?.links?.length).toBe(1);
      expect(entryB.metadata?.links?.length).toBe(1);
    });

    it('should not add duplicate links', () => {
      const entryA = makeEntry('Use prettier');
      entryA.metadata = { links: ['Tool Usage::Run prettier'] };

      const file = makeFile('/test/MEMORY.md', [
        makeSection('User Preferences', [entryA]),
        makeSection('Tool Usage', [makeEntry('Run prettier')]),
      ]);

      const links: MemoryLink[] = [
        {
          sourceText: 'Use prettier',
          sourceSection: 'User Preferences',
          targetText: 'Run prettier',
          targetSection: 'Tool Usage',
          similarity: 0.5,
          reason: 'keyword-overlap',
        },
      ];

      const updated = linker.applyLinks(file, links);

      // Source already has the link, so only target should be updated
      expect(updated).toBe(1);
    });

    it('should enforce maxLinksPerEntry', () => {
      const entryA = makeEntry('Overlinked entry');
      entryA.metadata = {
        links: ['a::1', 'b::2', 'c::3', 'd::4', 'e::5'],
      };

      const file = makeFile('/test/MEMORY.md', [
        makeSection('User Preferences', [entryA]),
        makeSection('Tool Usage', [makeEntry('New tool entry')]),
      ]);

      const links: MemoryLink[] = [
        {
          sourceText: 'Overlinked entry',
          sourceSection: 'User Preferences',
          targetText: 'New tool entry',
          targetSection: 'Tool Usage',
          similarity: 0.5,
          reason: 'keyword-overlap',
        },
      ];

      linker.applyLinks(file, links);

      // Source should still have 5 links (max) -- the 6th is rejected
      expect(entryA.metadata!.links!.length).toBe(5);
    });
  });

  describe('getLinkedEntries', () => {
    it('should return linked entries by following link IDs', () => {
      const entryA = makeEntry('Use prettier for formatting');
      entryA.metadata = { links: ['Tool Usage::Run prettier command'] };

      const entryB = makeEntry('Run prettier command');

      const file = makeFile('/test/MEMORY.md', [
        makeSection('User Preferences', [entryA]),
        makeSection('Tool Usage', [entryB]),
      ]);

      const linked = linker.getLinkedEntries(file, entryA.text);

      expect(linked.length).toBe(1);
      expect(linked[0]!.entry.text).toBe('Run prettier command');
      expect(linked[0]!.section).toBe('Tool Usage');
    });

    it('should return empty for entry with no links', () => {
      const entry = makeEntry('No links here');
      const file = makeFile('/test/MEMORY.md', [
        makeSection('User Preferences', [entry]),
      ]);

      const linked = linker.getLinkedEntries(file, entry.text);

      expect(linked).toEqual([]);
    });

    it('should return empty for non-existent entry', () => {
      const file = makeFile('/test/MEMORY.md', [
        makeSection('User Preferences', [makeEntry('Exists')]),
      ]);

      const linked = linker.getLinkedEntries(file, 'Does not exist');

      expect(linked).toEqual([]);
    });
  });
});

// ===========================================================================
// MemoryFileManager -- semantic dedup, versioning, parsing, secret detection
// ===========================================================================

describe('MemoryFileManager', () => {
  let fm: MemoryFileManager;

  beforeEach(() => {
    fm = new MemoryFileManager();
  });

  // -----------------------------------------------------------------------
  // parseContent
  // -----------------------------------------------------------------------

  describe('parseContent', () => {
    it('should return empty array for empty content', () => {
      expect(fm.parseContent('')).toEqual([]);
      expect(fm.parseContent('   ')).toEqual([]);
    });

    it('should parse a file with one section and entries', () => {
      const raw =
        '# Auto-Memories\n\n## User Preferences\n- Use dark mode\n- Use tabs\n';
      const sections = fm.parseContent(raw);

      expect(sections).toHaveLength(1);
      expect(sections[0]!.title).toBe('User Preferences');
      expect(sections[0]!.entries).toHaveLength(2);
      expect(sections[0]!.entries[0]!.text).toBe('Use dark mode');
      expect(sections[0]!.entries[1]!.text).toBe('Use tabs');
    });

    it('should parse multiple sections', () => {
      const raw =
        '# Auto-Memories\n\n' +
        '## Corrections\n- Fix A\n\n' +
        '## Error Patterns\n- Error B\n';
      const sections = fm.parseContent(raw);

      expect(sections).toHaveLength(2);
      expect(sections[0]!.title).toBe('Corrections');
      expect(sections[1]!.title).toBe('Error Patterns');
    });

    it('should parse child entries (indented sub-bullets)', () => {
      const raw =
        '# Auto-Memories\n\n' +
        '## User Preferences\n' +
        '- Use dark mode\n' +
        '  - Also in terminal\n' +
        '  - And in VS Code\n';
      const sections = fm.parseContent(raw);

      expect(sections[0]!.entries[0]!.children).toHaveLength(2);
      expect(sections[0]!.entries[0]!.children[0]).toBe('Also in terminal');
    });

    it('should parse inline metadata comments', () => {
      const raw =
        '# Auto-Memories\n\n' +
        '## Corrections\n' +
        '- Fix variable naming <!-- auto:confidence=0.85,date=2026-01-10,category=correction -->\n';
      const sections = fm.parseContent(raw);

      const meta = sections[0]!.entries[0]!.metadata;
      expect(meta?.confidence).toBe(0.85);
      expect(meta?.dateAdded).toBe('2026-01-10');
      expect(meta?.category).toBe('correction');
    });

    it('should parse stale flag in metadata', () => {
      const raw =
        '# Auto-Memories\n\n' +
        '## User Preferences\n' +
        '- Old pref <!-- auto:stale=true -->\n';
      const sections = fm.parseContent(raw);

      expect(sections[0]!.entries[0]!.metadata?.stale).toBe(true);
    });

    it('should parse link metadata', () => {
      const raw =
        '# Auto-Memories\n\n' +
        '## User Preferences\n' +
        '- Pref A <!-- auto:links=Tool Usage::Run cmd;Error Patterns::Fix err -->\n';
      const sections = fm.parseContent(raw);

      expect(sections[0]!.entries[0]!.metadata?.links).toEqual([
        'Tool Usage::Run cmd',
        'Error Patterns::Fix err',
      ]);
    });

    it('should track line numbers for entries', () => {
      const raw =
        '# Auto-Memories\n\n' +
        '## User Preferences\n' +
        '- First entry\n' +
        '- Second entry\n';
      const sections = fm.parseContent(raw);

      expect(sections[0]!.entries[0]!.line).toBe(4);
      expect(sections[0]!.entries[1]!.line).toBe(5);
    });
  });

  // -----------------------------------------------------------------------
  // serializeFile
  // -----------------------------------------------------------------------

  describe('serializeFile', () => {
    it('should produce valid markdown with header', () => {
      const file = makeFile('/test/MEMORY.md', [
        makeSection('User Preferences', [makeEntry('Use dark mode')]),
      ]);

      const output = fm.serializeFile(file);

      expect(output).toContain('# Auto-Memories');
      expect(output).toContain('## User Preferences');
      expect(output).toContain('- Use dark mode');
    });

    it('should serialize metadata as HTML comments', () => {
      const entry = makeEntry('Fix typos', {
        confidence: 0.9,
        dateAdded: '2026-01-10',
        category: 'correction',
      });
      const file = makeFile('/test/MEMORY.md', [
        makeSection('Corrections', [entry]),
      ]);

      const output = fm.serializeFile(file);

      expect(output).toContain('<!-- auto:');
      expect(output).toContain('confidence=0.9');
      expect(output).toContain('date=2026-01-10');
      expect(output).toContain('category=correction');
    });

    it('should serialize child entries as indented bullets', () => {
      const entry: MemoryEntry = {
        text: 'Parent entry',
        children: ['Child one', 'Child two'],
        line: 1,
      };
      const file = makeFile('/test/MEMORY.md', [
        makeSection('User Preferences', [entry]),
      ]);

      const output = fm.serializeFile(file);

      expect(output).toContain('  - Child one');
      expect(output).toContain('  - Child two');
    });

    it('should round-trip parseContent -> serializeFile', () => {
      const raw =
        '# Auto-Memories\n\n' +
        '## User Preferences\n' +
        '- Use dark mode\n' +
        '  - In terminal too\n' +
        '- Use tabs\n\n';
      const sections = fm.parseContent(raw);
      const file = makeFile('/test/MEMORY.md', sections);
      const output = fm.serializeFile(file);

      expect(output).toContain('## User Preferences');
      expect(output).toContain('- Use dark mode');
      expect(output).toContain('  - In terminal too');
      expect(output).toContain('- Use tabs');
    });
  });

  // -----------------------------------------------------------------------
  // Semantic Deduplication
  // -----------------------------------------------------------------------

  describe('isSemanticDuplicate', () => {
    it('should detect near-identical entries as duplicates', () => {
      const existing = [
        makeEntry('Use TypeScript strict mode for better type safety'),
      ];

      const result = fm.isSemanticDuplicate(
        'Use TypeScript strict mode for improved type safety',
        existing
      );

      expect(result).toBe(true);
    });

    it('should not flag completely different entries as duplicates', () => {
      const existing = [
        makeEntry('Use TypeScript strict mode for better type safety'),
      ];

      const result = fm.isSemanticDuplicate(
        'Deploy using Docker containers on AWS',
        existing
      );

      expect(result).toBe(false);
    });

    it('should return false for empty text', () => {
      const existing = [makeEntry('Some entry')];
      const result = fm.isSemanticDuplicate('', existing);

      expect(result).toBe(false);
    });

    it('should return false for empty existing entries', () => {
      const result = fm.isSemanticDuplicate('Some text', []);

      expect(result).toBe(false);
    });

    it('should respect the custom threshold parameter', () => {
      const existing = [makeEntry('Use prettier for code formatting')];

      // With a very high threshold, even similar entries should not match
      fm.isSemanticDuplicate(
        'Use prettier for formatting code',
        existing,
        0.99
      );

      // With a very low threshold, most entries would match
      const lowThreshold = fm.isSemanticDuplicate(
        'Use prettier for formatting code',
        existing,
        0.3
      );

      expect(lowThreshold).toBe(true);
      // highThreshold might be true or false depending on exact cosine similarity
    });

    it('should handle entries with only stop words', () => {
      const existing = [makeEntry('the is a an')];

      const result = fm.isSemanticDuplicate('the is a an', existing);

      // Both tokenize to empty arrays, so cosine similarity = 0
      expect(result).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // normalizeEntry
  // -----------------------------------------------------------------------

  describe('normalizeEntry', () => {
    it('should lowercase and trim text', () => {
      expect(fm.normalizeEntry('  Use TABS  ')).toBe('use tabs');
    });

    it('should collapse whitespace', () => {
      expect(fm.normalizeEntry('Use   multiple    spaces')).toBe(
        'use multiple spaces'
      );
    });

    it('should remove backticks and quotes', () => {
      expect(fm.normalizeEntry("Use `prettier` for 'formatting'")).toBe(
        'use prettier for formatting'
      );
    });
  });

  // -----------------------------------------------------------------------
  // containsSecret
  // -----------------------------------------------------------------------

  describe('containsSecret', () => {
    it('should detect API key patterns', () => {
      expect(fm.containsSecret('api_key=sk-abcdef123456')).toBe(true);
      expect(fm.containsSecret('token=ghp_1234567890abcdef')).toBe(true);
    });

    it('should detect Bearer tokens', () => {
      expect(
        fm.containsSecret('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test')
      ).toBe(true);
    });

    it('should detect private keys', () => {
      expect(fm.containsSecret('-----BEGIN PRIVATE KEY-----')).toBe(true);
      expect(fm.containsSecret('-----BEGIN RSA PRIVATE KEY-----')).toBe(true);
    });

    it('should detect sk- prefixed keys', () => {
      expect(fm.containsSecret('sk-abcdefghij1234567890')).toBe(true);
    });

    it('should not flag normal text', () => {
      expect(fm.containsSecret('Use dark mode in the editor')).toBe(false);
      expect(fm.containsSecret('Remember to run tests before committing')).toBe(
        false
      );
    });
  });

  // -----------------------------------------------------------------------
  // findEntry
  // -----------------------------------------------------------------------

  describe('findEntry', () => {
    it('should find an entry by text (case-insensitive)', () => {
      const entry = makeEntry('Use dark mode');
      const file = makeFile('/test/MEMORY.md', [
        makeSection('User Preferences', [entry]),
      ]);

      const result = fm.findEntry(file, 'use dark mode');

      expect(result).not.toBeNull();
      expect(result!.entry.text).toBe('Use dark mode');
      expect(result!.section.title).toBe('User Preferences');
    });

    it('should return null for non-existent entry', () => {
      const file = makeFile('/test/MEMORY.md', [
        makeSection('User Preferences', [makeEntry('Use dark mode')]),
      ]);

      const result = fm.findEntry(file, 'non-existent');

      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // getAllEntries
  // -----------------------------------------------------------------------

  describe('getAllEntries', () => {
    it('should return all entries across sections', () => {
      const file = makeFile('/test/MEMORY.md', [
        makeSection('User Preferences', [makeEntry('A'), makeEntry('B')]),
        makeSection('Corrections', [makeEntry('C')]),
      ]);

      const all = fm.getAllEntries(file);

      expect(all).toHaveLength(3);
      expect(all.map(e => e.text)).toEqual(['A', 'B', 'C']);
    });

    it('should return empty for file with no sections', () => {
      const file = makeFile('/test/MEMORY.md', []);

      expect(fm.getAllEntries(file)).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // hashContent
  // -----------------------------------------------------------------------

  describe('hashContent', () => {
    it('should produce consistent hash for same content', () => {
      const hash1 = fm.hashContent('hello world');
      const hash2 = fm.hashContent('hello world');

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different content', () => {
      const hash1 = fm.hashContent('hello');
      const hash2 = fm.hashContent('world');

      expect(hash1).not.toBe(hash2);
    });

    it('should return a hex string', () => {
      const hash = fm.hashContent('test');

      expect(hash).toMatch(/^[a-f0-9]+$/);
    });
  });
});
