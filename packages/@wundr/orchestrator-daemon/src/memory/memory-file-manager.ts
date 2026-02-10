/**
 * MemoryFileManager - Low-level MEMORY.md file operations
 *
 * Handles reading, writing, parsing, section management, line counting,
 * topic overflow, versioning, rollback, and size management for
 * structured markdown memory files.
 *
 * File format:
 *   # Auto-Memories
 *   ## Section Title
 *   - Entry text <!-- auto:confidence=0.8,date=2026-02-09,category=correction -->
 *     - Sub-entry detail
 *   ## Another Section
 *   - Another entry
 *
 * Inspired by OpenClaw's memory indexing and file sync patterns.
 *
 * @packageDocumentation
 */

import crypto from 'node:crypto';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { Logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Metadata stored as an HTML comment after an entry (invisible to readers).
 * Format: <!-- auto:confidence=0.8,date=2026-02-09,category=correction -->
 */
export interface EntryMetadata {
  /** Detection confidence when this entry was created */
  confidence?: number;
  /** ISO date string when this entry was first added */
  dateAdded?: string;
  /** ISO date string when this entry was last confirmed still valid */
  dateConfirmed?: string;
  /** Detection category that produced this entry */
  category?: string;
  /** Whether this entry has been marked stale */
  stale?: boolean;
  /** Cross-reference links to other entries */
  links?: string[];
  /** Version number of this entry */
  version?: number;
  /** Source session ID that produced this entry */
  sourceSession?: string;
}

/**
 * A single bullet-point entry inside a memory section.
 */
export interface MemoryEntry {
  /** Entry text (the bullet point content, without the leading `- `) */
  text: string;
  /** Sub-entries (indented child bullets, without leading `  - `) */
  children: string[];
  /** 1-based line number of this entry in the file */
  line: number;
  /** Optional inline metadata parsed from HTML comment */
  metadata?: EntryMetadata;
}

/**
 * A section (## header) inside a memory file.
 */
export interface MemorySection {
  /** Section title (e.g., "User Preferences") */
  title: string;
  /** Entries in this section */
  entries: MemoryEntry[];
  /** 1-based start line of the section header */
  startLine: number;
  /** 1-based end line of the last content in the section */
  endLine: number;
}

/**
 * Parsed representation of a MEMORY.md file.
 */
export interface ParsedMemoryFile {
  /** Absolute file path */
  path: string;
  /** Raw file content */
  raw: string;
  /** Parsed sections */
  sections: MemorySection[];
  /** Total line count */
  lineCount: number;
  /** Whether the file exists on disk */
  exists: boolean;
  /** Content hash for change detection */
  hash?: string;
}

/**
 * Result of a consolidation operation.
 */
export interface ConsolidationResult {
  /** Number of entries moved to overflow files */
  movedEntries: number;
  /** Overflow files created or updated */
  overflowFiles: string[];
  /** Lines before consolidation */
  linesBefore: number;
  /** Lines after consolidation */
  linesAfter: number;
}

/**
 * A snapshot of a memory file for versioning.
 */
export interface MemoryVersion {
  /** Version number */
  version: number;
  /** ISO timestamp when the version was created */
  timestamp: string;
  /** Content hash of this version */
  hash: string;
  /** Serialized file content */
  content: string;
  /** Human-readable reason for the version */
  reason: string;
}

/**
 * Configuration for the MemoryFileManager.
 */
export interface MemoryFileManagerConfig {
  /** Maximum lines per MEMORY.md file before triggering consolidation */
  maxLines: number;
  /** Directory name for topic overflow files (relative to MEMORY.md parent) */
  overflowDirName: string;
  /** Minimum entries in a section before it is eligible for overflow */
  overflowThreshold: number;
  /** Maximum number of versions to retain per file */
  maxVersions: number;
  /** Maximum total file size in bytes across all memory files */
  maxTotalSizeBytes: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: MemoryFileManagerConfig = {
  maxLines: 200,
  overflowDirName: 'memory',
  overflowThreshold: 5,
  maxVersions: 10,
  maxTotalSizeBytes: 512 * 1024, // 512 KB
};

const FILE_HEADER = '# Auto-Memories\n';

/** Regex to match section headers: ## Title */
const SECTION_HEADER_RE = /^##\s+(.+)$/;

/** Regex to match top-level bullet entry: - text */
const ENTRY_RE = /^- (.+)$/;

/** Regex to match child bullet: two+ spaces then - text */
const CHILD_RE = /^\s{2,}- (.+)$/;

/** Regex to match inline metadata comment */
const METADATA_RE = /<!--\s*auto:([^>]+)\s*-->$/;

/** Patterns that look like secrets -- used for redaction */
const SECRET_PATTERNS = [
  /(?:api[_-]?key|token|secret|password|credential|auth)[=:]\s*\S+/i,
  /(?:sk-|pk_|ghp_|gho_|glpat-|xox[bpas]-)\S{10,}/,
  /Bearer\s+\S{20,}/i,
  /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/,
];

const logger = new Logger('MemoryFileManager');

// ---------------------------------------------------------------------------
// MemoryFileManager
// ---------------------------------------------------------------------------

export class MemoryFileManager {
  private config: MemoryFileManagerConfig;

  constructor(config?: Partial<MemoryFileManagerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // -------------------------------------------------------------------------
  // Reading and Parsing
  // -------------------------------------------------------------------------

  /**
   * Read and parse a MEMORY.md file.
   *
   * Returns a ParsedMemoryFile even if the file does not exist (with
   * `exists: false` and empty sections). This makes the caller's logic
   * simpler since it can always work with the parsed structure.
   */
  async read(filePath: string): Promise<ParsedMemoryFile> {
    const absPath = path.resolve(filePath);
    let raw = '';
    let exists = false;

    try {
      raw = await fs.readFile(absPath, 'utf-8');
      exists = true;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        logger.error(`Failed to read memory file: ${absPath}`, err);
        throw err;
      }
    }

    const sections = this.parseContent(raw);
    const lineCount = raw ? raw.split('\n').length : 0;
    const hash = raw ? this.hashContent(raw) : undefined;

    return { path: absPath, raw, sections, lineCount, exists, hash };
  }

  /**
   * Parse raw markdown content into sections and entries.
   */
  parseContent(raw: string): MemorySection[] {
    if (!raw.trim()) {
      return [];
    }

    const lines = raw.split('\n');
    const sections: MemorySection[] = [];
    let currentSection: MemorySection | null = null;
    let currentEntry: MemoryEntry | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const lineNo = i + 1;

      // Check for section header
      const headerMatch = SECTION_HEADER_RE.exec(line);
      if (headerMatch) {
        // Flush current entry
        if (currentEntry && currentSection) {
          currentSection.entries.push(currentEntry);
          currentEntry = null;
        }
        // Flush current section
        if (currentSection) {
          currentSection.endLine = lineNo - 1;
          sections.push(currentSection);
        }
        currentSection = {
          title: headerMatch[1]!.trim(),
          entries: [],
          startLine: lineNo,
          endLine: lineNo,
        };
        continue;
      }

      if (!currentSection) {
        continue;
      }

      // Check for top-level entry
      const entryMatch = ENTRY_RE.exec(line);
      if (entryMatch) {
        // Flush previous entry
        if (currentEntry) {
          currentSection.entries.push(currentEntry);
        }
        const { text, metadata } = this.extractMetadata(entryMatch[1]!);
        currentEntry = {
          text,
          children: [],
          line: lineNo,
          metadata,
        };
        currentSection.endLine = lineNo;
        continue;
      }

      // Check for child entry
      const childMatch = CHILD_RE.exec(line);
      if (childMatch && currentEntry) {
        currentEntry.children.push(childMatch[1]!);
        currentSection.endLine = lineNo;
        continue;
      }
    }

    // Flush final entry and section
    if (currentEntry && currentSection) {
      currentSection.entries.push(currentEntry);
    }
    if (currentSection) {
      currentSection.endLine = currentSection.endLine || lines.length;
      sections.push(currentSection);
    }

    return sections;
  }

  // -------------------------------------------------------------------------
  // Writing
  // -------------------------------------------------------------------------

  /**
   * Write a ParsedMemoryFile back to disk.
   *
   * Reconstructs the markdown from the parsed sections. Optionally creates
   * a version snapshot before overwriting.
   */
  async write(
    filePath: string,
    file: ParsedMemoryFile,
    options?: { createVersion?: boolean; versionReason?: string },
  ): Promise<void> {
    const absPath = path.resolve(filePath);
    await this.ensureDir(absPath);

    // Create version snapshot before overwriting (if requested and file exists)
    if (options?.createVersion) {
      await this.createVersion(
        absPath,
        options.versionReason ?? 'auto-save',
      );
    }

    const content = this.serializeFile(file);

    // Check size budget before writing
    const sizeBytes = Buffer.byteLength(content, 'utf-8');
    if (sizeBytes > this.config.maxTotalSizeBytes) {
      logger.warn(
        `Memory file ${absPath} exceeds size limit ` +
        `(${sizeBytes} > ${this.config.maxTotalSizeBytes}). ` +
        'Consider consolidation.',
      );
    }

    await fs.writeFile(absPath, content, 'utf-8');
    logger.debug(
      `Wrote memory file: ${absPath} (${content.split('\n').length} lines)`,
    );
  }

  /**
   * Serialize a ParsedMemoryFile to markdown string.
   */
  serializeFile(file: ParsedMemoryFile): string {
    const lines: string[] = [FILE_HEADER];

    for (const section of file.sections) {
      lines.push(`## ${section.title}`);
      for (const entry of section.entries) {
        const metaComment = this.serializeMetadata(entry.metadata);
        const suffix = metaComment ? ` ${metaComment}` : '';
        lines.push(`- ${entry.text}${suffix}`);
        for (const child of entry.children) {
          lines.push(`  - ${child}`);
        }
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  // -------------------------------------------------------------------------
  // Entry Operations
  // -------------------------------------------------------------------------

  /**
   * Append an entry to a section in a memory file.
   *
   * Creates the file and/or section if they do not exist. Deduplicates
   * against existing entries by text comparison.
   */
  async append(
    filePath: string,
    sectionTitle: string,
    entryText: string,
    metadata?: EntryMetadata,
  ): Promise<boolean> {
    // Redact secrets before storing
    if (this.containsSecret(entryText)) {
      logger.warn('Blocked memory entry containing potential secret');
      return false;
    }

    const file = await this.read(filePath);

    // Find or create section
    let section = file.sections.find(
      s => s.title.toLowerCase() === sectionTitle.toLowerCase(),
    );

    if (!section) {
      section = {
        title: sectionTitle,
        entries: [],
        startLine: file.lineCount + 1,
        endLine: file.lineCount + 1,
      };
      file.sections.push(section);
    }

    // Check for duplicates
    const normalized = this.normalizeEntry(entryText);
    const isDuplicate = section.entries.some(
      e => this.normalizeEntry(e.text) === normalized,
    );

    if (isDuplicate) {
      logger.debug(`Skipped duplicate entry: "${entryText.slice(0, 60)}..."`);
      return false;
    }

    // Check for semantic duplicates (similar meaning)
    const isSemDupe = this.isSemanticDuplicate(entryText, section.entries);
    if (isSemDupe) {
      logger.debug(
        `Skipped semantically similar entry: "${entryText.slice(0, 60)}..."`,
      );
      return false;
    }

    // Append
    const entry: MemoryEntry = {
      text: entryText,
      children: [],
      line: 0, // Will be recalculated on write
      metadata: {
        ...metadata,
        dateAdded:
          metadata?.dateAdded ?? new Date().toISOString().split('T')[0],
        version: 1,
      },
    };

    section.entries.push(entry);

    // Write back
    await this.write(filePath, file);
    return true;
  }

  /**
   * Remove an entry from a section by text match.
   */
  async remove(
    filePath: string,
    sectionTitle: string,
    entryText: string,
  ): Promise<boolean> {
    const file = await this.read(filePath);
    const section = file.sections.find(
      s => s.title.toLowerCase() === sectionTitle.toLowerCase(),
    );

    if (!section) {
      return false;
    }

    const normalized = this.normalizeEntry(entryText);
    const before = section.entries.length;
    section.entries = section.entries.filter(
      e => this.normalizeEntry(e.text) !== normalized,
    );

    if (section.entries.length === before) {
      return false;
    }

    // Remove empty sections
    if (section.entries.length === 0) {
      file.sections = file.sections.filter(s => s !== section);
    }

    await this.write(filePath, file, {
      createVersion: true,
      versionReason: 'entry-removed',
    });
    return true;
  }

  /**
   * Update an existing entry's text. Increments the version number.
   */
  async update(
    filePath: string,
    sectionTitle: string,
    oldEntryText: string,
    newEntryText: string,
  ): Promise<boolean> {
    if (this.containsSecret(newEntryText)) {
      logger.warn('Blocked memory entry update containing potential secret');
      return false;
    }

    const file = await this.read(filePath);
    const section = file.sections.find(
      s => s.title.toLowerCase() === sectionTitle.toLowerCase(),
    );

    if (!section) {
      return false;
    }

    const normalizedOld = this.normalizeEntry(oldEntryText);
    const entry = section.entries.find(
      e => this.normalizeEntry(e.text) === normalizedOld,
    );

    if (!entry) {
      return false;
    }

    entry.text = newEntryText;
    entry.metadata = {
      ...entry.metadata,
      dateConfirmed: new Date().toISOString().split('T')[0],
      version: (entry.metadata?.version ?? 0) + 1,
    };

    await this.write(filePath, file, {
      createVersion: true,
      versionReason: 'entry-updated',
    });
    return true;
  }

  // -------------------------------------------------------------------------
  // Consolidation and Overflow
  // -------------------------------------------------------------------------

  /**
   * Check whether a memory file needs consolidation.
   */
  async needsConsolidation(filePath: string): Promise<boolean> {
    const file = await this.read(filePath);
    return file.lineCount > this.config.maxLines;
  }

  /**
   * Consolidate a memory file by moving large sections to overflow files.
   *
   * The consolidation algorithm:
   * 1. Identify sections with more entries than overflowThreshold
   * 2. Move excess entries to `memory/<topic>.md` files
   * 3. Add a link entry in the main file's "Links" section
   * 4. Merge duplicate entries where possible
   */
  async consolidate(filePath: string): Promise<ConsolidationResult> {
    const file = await this.read(filePath);
    const parentDir = path.dirname(filePath);
    const overflowDir = path.join(parentDir, this.config.overflowDirName);
    const linesBefore = file.lineCount;
    let movedEntries = 0;
    const overflowFiles: string[] = [];

    // Sort sections by entry count descending to move the largest first
    const sortedSections = [...file.sections]
      .filter(s => s.title !== 'Links')
      .sort((a, b) => b.entries.length - a.entries.length);

    for (const section of sortedSections) {
      if (section.entries.length <= this.config.overflowThreshold) {
        continue;
      }

      // Calculate how many entries to keep inline
      const keepCount = Math.max(
        2,
        Math.floor(this.config.overflowThreshold * 0.6),
      );
      const toMove = section.entries.slice(keepCount);

      if (toMove.length === 0) {
        continue;
      }

      // Create or update overflow file
      const topicSlug = this.slugify(section.title);
      const overflowPath = path.join(overflowDir, `${topicSlug}.md`);
      await this.ensureDir(overflowPath);

      const overflowFile = await this.read(overflowPath);
      let overflowSection = overflowFile.sections.find(
        s => s.title.toLowerCase() === section.title.toLowerCase(),
      );

      if (!overflowSection) {
        overflowSection = {
          title: section.title,
          entries: [],
          startLine: 0,
          endLine: 0,
        };
        overflowFile.sections.push(overflowSection);
      }

      // Move entries, deduplicating
      for (const entry of toMove) {
        const normalized = this.normalizeEntry(entry.text);
        const exists = overflowSection.entries.some(
          e => this.normalizeEntry(e.text) === normalized,
        );
        if (!exists) {
          overflowSection.entries.push(entry);
          movedEntries++;
        }
      }

      await this.write(overflowPath, overflowFile);
      overflowFiles.push(overflowPath);

      // Remove moved entries from main file
      const sectionInFile = file.sections.find(
        s => s.title === section.title,
      );
      if (sectionInFile) {
        sectionInFile.entries = sectionInFile.entries.slice(0, keepCount);
      }

      // Add link if not already present
      this.ensureLinkEntry(file, section.title, overflowPath, parentDir);
    }

    if (movedEntries > 0) {
      await this.write(filePath, file, {
        createVersion: true,
        versionReason: `consolidation: moved ${movedEntries} entries`,
      });
    }

    const linesAfter = this.serializeFile(file).split('\n').length;

    return {
      movedEntries,
      overflowFiles,
      linesBefore,
      linesAfter,
    };
  }

  /**
   * Get the line count of a memory file.
   */
  async lineCount(filePath: string): Promise<number> {
    try {
      const content = await fs.readFile(path.resolve(filePath), 'utf-8');
      return content.split('\n').length;
    } catch {
      return 0;
    }
  }

  // -------------------------------------------------------------------------
  // Versioning
  // -------------------------------------------------------------------------

  /**
   * Create a version snapshot of a memory file.
   */
  async createVersion(filePath: string, reason: string): Promise<boolean> {
    const absPath = path.resolve(filePath);

    let content: string;
    try {
      content = await fs.readFile(absPath, 'utf-8');
    } catch {
      return false;
    }

    const versionsDir = path.join(path.dirname(absPath), '.versions');
    await this.ensureDir(path.join(versionsDir, 'placeholder'));

    const versions = await this.listVersions(absPath);
    const nextVersion = (versions[versions.length - 1]?.version ?? 0) + 1;

    const version: MemoryVersion = {
      version: nextVersion,
      timestamp: new Date().toISOString(),
      hash: this.hashContent(content),
      content,
      reason,
    };

    const versionPath = path.join(
      versionsDir,
      `${path.basename(absPath, '.md')}_v${nextVersion}.json`,
    );
    await fs.writeFile(versionPath, JSON.stringify(version, null, 2), 'utf-8');

    // Prune old versions
    if (versions.length >= this.config.maxVersions) {
      const toPrune = versions.slice(
        0,
        versions.length - this.config.maxVersions + 1,
      );
      for (const v of toPrune) {
        const prunePath = path.join(
          versionsDir,
          `${path.basename(absPath, '.md')}_v${v.version}.json`,
        );
        try {
          await fs.unlink(prunePath);
        } catch {
          // Ignore missing version files
        }
      }
    }

    logger.debug(
      `Created version ${nextVersion} of ${absPath}: ${reason}`,
    );
    return true;
  }

  /**
   * List all versions of a memory file, sorted by version number.
   */
  async listVersions(filePath: string): Promise<MemoryVersion[]> {
    const absPath = path.resolve(filePath);
    const versionsDir = path.join(path.dirname(absPath), '.versions');
    const prefix = path.basename(absPath, '.md') + '_v';

    let entries: string[];
    try {
      entries = await fs.readdir(versionsDir);
    } catch {
      return [];
    }

    const versions: MemoryVersion[] = [];
    for (const entry of entries) {
      if (!entry.startsWith(prefix) || !entry.endsWith('.json')) {
        continue;
      }
      try {
        const raw = await fs.readFile(
          path.join(versionsDir, entry),
          'utf-8',
        );
        const version = JSON.parse(raw) as MemoryVersion;
        versions.push(version);
      } catch {
        // Skip corrupted version files
      }
    }

    return versions.sort((a, b) => a.version - b.version);
  }

  /**
   * Rollback a memory file to a specific version.
   */
  async rollback(filePath: string, targetVersion: number): Promise<boolean> {
    const versions = await this.listVersions(filePath);
    const target = versions.find(v => v.version === targetVersion);

    if (!target) {
      logger.warn(
        `Version ${targetVersion} not found for ${filePath}`,
      );
      return false;
    }

    // Create a version of the current state before rolling back
    await this.createVersion(filePath, `pre-rollback-to-v${targetVersion}`);

    const absPath = path.resolve(filePath);
    await fs.writeFile(absPath, target.content, 'utf-8');

    logger.info(
      `Rolled back ${filePath} to version ${targetVersion}`,
    );
    return true;
  }

  // -------------------------------------------------------------------------
  // Size Management
  // -------------------------------------------------------------------------

  /**
   * Get the total size in bytes across all memory files in a directory tree.
   */
  async getTotalSize(baseDir: string): Promise<number> {
    let total = 0;

    const entries = await this.listMemoryFilesRecursive(baseDir);
    for (const entry of entries) {
      try {
        const stat = await fs.stat(entry);
        total += stat.size;
      } catch {
        // Skip inaccessible files
      }
    }

    return total;
  }

  /**
   * Check whether the total memory file size exceeds the configured limit.
   */
  async isOverSizeLimit(baseDir: string): Promise<boolean> {
    const total = await this.getTotalSize(baseDir);
    return total > this.config.maxTotalSizeBytes;
  }

  /**
   * List all .md files recursively under a base directory.
   */
  private async listMemoryFilesRecursive(baseDir: string): Promise<string[]> {
    const results: string[] = [];

    let names: string[];
    try {
      names = await fs.readdir(baseDir);
    } catch {
      return results;
    }

    for (const name of names) {
      const fullPath = path.join(baseDir, name);
      let stat: Awaited<ReturnType<typeof fs.stat>>;
      try {
        stat = await fs.stat(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        // Skip .versions directory
        if (name === '.versions') {
          continue;
        }
        const subFiles = await this.listMemoryFilesRecursive(fullPath);
        results.push(...subFiles);
      } else if (stat.isFile() && name.endsWith('.md')) {
        results.push(fullPath);
      }
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Semantic Deduplication
  // -------------------------------------------------------------------------

  /**
   * Check if a new entry is semantically similar to any existing entry.
   *
   * Uses a bag-of-words cosine similarity approach with stop-word removal.
   * This is a lightweight heuristic; for production use with large corpuses,
   * consider embedding-based similarity (as OpenClaw does).
   */
  isSemanticDuplicate(
    newText: string,
    existingEntries: MemoryEntry[],
    threshold = 0.75,
  ): boolean {
    const newTokens = this.tokenize(newText);
    if (newTokens.length === 0) {
      return false;
    }

    for (const entry of existingEntries) {
      const existingTokens = this.tokenize(entry.text);
      if (existingTokens.length === 0) {
        continue;
      }

      const similarity = this.cosineSimilarity(newTokens, existingTokens);
      if (similarity >= threshold) {
        return true;
      }
    }

    return false;
  }

  /**
   * Tokenize text into a bag of normalized words (stop-words removed).
   */
  private tokenize(text: string): string[] {
    const stopWords = new Set([
      'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'could', 'should', 'may', 'might', 'shall', 'can',
      'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
      'it', 'its', 'this', 'that', 'and', 'or', 'but', 'not', 'if',
      'then', 'else', 'when', 'up', 'out', 'so', 'no', 'as',
    ]);

    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1 && !stopWords.has(w));
  }

  /**
   * Compute cosine similarity between two bags of words.
   */
  private cosineSimilarity(tokensA: string[], tokensB: string[]): number {
    const freqA = this.termFrequency(tokensA);
    const freqB = this.termFrequency(tokensB);

    const allTerms = new Set([...freqA.keys(), ...freqB.keys()]);
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (const term of allTerms) {
      const a = freqA.get(term) ?? 0;
      const b = freqB.get(term) ?? 0;
      dotProduct += a * b;
      normA += a * a;
      normB += b * b;
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }

  /**
   * Compute term frequency map.
   */
  private termFrequency(tokens: string[]): Map<string, number> {
    const freq = new Map<string, number>();
    for (const token of tokens) {
      freq.set(token, (freq.get(token) ?? 0) + 1);
    }
    return freq;
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  /**
   * Ensure parent directories exist for a file path.
   */
  async ensureDir(filePath: string): Promise<void> {
    const dir = path.dirname(path.resolve(filePath));
    try {
      fsSync.mkdirSync(dir, { recursive: true });
    } catch {
      // Ignore if already exists
    }
  }

  /**
   * Check if text contains patterns that look like secrets.
   */
  containsSecret(text: string): boolean {
    return SECRET_PATTERNS.some(pattern => pattern.test(text));
  }

  /**
   * Find an entry across all sections by text.
   */
  findEntry(
    file: ParsedMemoryFile,
    entryText: string,
  ): { section: MemorySection; entry: MemoryEntry } | null {
    const normalized = this.normalizeEntry(entryText);
    for (const section of file.sections) {
      for (const entry of section.entries) {
        if (this.normalizeEntry(entry.text) === normalized) {
          return { section, entry };
        }
      }
    }
    return null;
  }

  /**
   * Get all entries across all sections.
   */
  getAllEntries(file: ParsedMemoryFile): MemoryEntry[] {
    return file.sections.flatMap(s => s.entries);
  }

  /**
   * Compute a content hash for change detection.
   */
  hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Normalize entry text for comparison (lowercase, trim, collapse whitespace).
   */
  normalizeEntry(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[`'"]/g, '');
  }

  // -------------------------------------------------------------------------
  // Private Helpers
  // -------------------------------------------------------------------------

  /**
   * Extract inline metadata comment from entry text.
   */
  private extractMetadata(text: string): {
    text: string;
    metadata?: EntryMetadata;
  } {
    const match = METADATA_RE.exec(text);
    if (!match) {
      return { text: text.trim() };
    }

    const cleanText = text.slice(0, match.index).trim();
    const pairs = match[1]!.split(',');
    const metadata: EntryMetadata = {};

    for (const pair of pairs) {
      const [key, value] = pair.split('=').map(s => s.trim());
      if (!key || !value) {
continue;
}

      switch (key) {
        case 'confidence':
          metadata.confidence = parseFloat(value);
          break;
        case 'date':
          metadata.dateAdded = value;
          break;
        case 'confirmed':
          metadata.dateConfirmed = value;
          break;
        case 'category':
          metadata.category = value;
          break;
        case 'stale':
          metadata.stale = value === 'true';
          break;
        case 'version':
          metadata.version = parseInt(value, 10);
          break;
        case 'links':
          metadata.links = value.split(';').filter(Boolean);
          break;
        case 'session':
          metadata.sourceSession = value;
          break;
      }
    }

    return { text: cleanText, metadata };
  }

  /**
   * Serialize metadata to an HTML comment string.
   */
  private serializeMetadata(metadata?: EntryMetadata): string {
    if (!metadata) {
      return '';
    }

    const parts: string[] = [];
    if (metadata.confidence !== undefined) {
      parts.push(`confidence=${metadata.confidence}`);
    }
    if (metadata.dateAdded) {
      parts.push(`date=${metadata.dateAdded}`);
    }
    if (metadata.dateConfirmed) {
      parts.push(`confirmed=${metadata.dateConfirmed}`);
    }
    if (metadata.category) {
      parts.push(`category=${metadata.category}`);
    }
    if (metadata.stale) {
      parts.push('stale=true');
    }
    if (metadata.version !== undefined) {
      parts.push(`version=${metadata.version}`);
    }
    if (metadata.links && metadata.links.length > 0) {
      parts.push(`links=${metadata.links.join(';')}`);
    }
    if (metadata.sourceSession) {
      parts.push(`session=${metadata.sourceSession}`);
    }

    if (parts.length === 0) {
      return '';
    }

    return `<!-- auto:${parts.join(',')} -->`;
  }

  /**
   * Create a URL-safe slug from a section title.
   */
  private slugify(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Ensure a link entry exists in the "Links" section.
   */
  private ensureLinkEntry(
    file: ParsedMemoryFile,
    topicTitle: string,
    overflowPath: string,
    parentDir: string,
  ): void {
    let linksSection = file.sections.find(
      s => s.title.toLowerCase() === 'links',
    );

    if (!linksSection) {
      linksSection = {
        title: 'Links',
        entries: [],
        startLine: 0,
        endLine: 0,
      };
      file.sections.push(linksSection);
    }

    const relativePath = path.relative(parentDir, overflowPath);
    const linkText = `[${topicTitle}](${relativePath})`;
    const normalized = this.normalizeEntry(linkText);
    const exists = linksSection.entries.some(
      e => this.normalizeEntry(e.text) === normalized,
    );

    if (!exists) {
      linksSection.entries.push({
        text: linkText,
        children: [],
        line: 0,
      });
    }
  }
}
