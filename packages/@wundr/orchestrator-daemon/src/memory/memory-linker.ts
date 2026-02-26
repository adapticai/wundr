/**
 * MemoryLinker - Cross-reference linking between memory entries
 *
 * Automatically detects related entries across sections and scopes,
 * and stores bidirectional links in entry metadata. This helps surface
 * related memories when one is accessed.
 *
 * For example, an error pattern entry that references a tool usage
 * entry will link them so that searching for one surfaces the other.
 *
 * @packageDocumentation
 */

import { Logger } from '../utils/logger';

import type {
  ParsedMemoryFile,
  MemoryEntry,
  MemoryFileManager,
} from './memory-file-manager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A detected link between two memory entries.
 */
export interface MemoryLink {
  /** Source entry text */
  sourceText: string;
  /** Source section title */
  sourceSection: string;
  /** Target entry text */
  targetText: string;
  /** Target section title */
  targetSection: string;
  /** Similarity score that triggered the link */
  similarity: number;
  /** How the link was detected */
  reason:
    | 'keyword-overlap'
    | 'error-fix-pair'
    | 'same-topic'
    | 'explicit-reference';
}

/**
 * Result of a linking pass.
 */
export interface LinkingResult {
  /** Number of new links created */
  newLinks: number;
  /** Total links that exist after the pass */
  totalLinks: number;
  /** Entries that were updated with new link metadata */
  updatedEntries: number;
}

/**
 * Configuration for the MemoryLinker.
 */
export interface MemoryLinkerConfig {
  /** Minimum keyword overlap to create a link */
  minOverlapThreshold: number;
  /** Maximum links per entry */
  maxLinksPerEntry: number;
  /** Whether to auto-link error patterns to tool usage entries */
  linkErrorsToTools: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: MemoryLinkerConfig = {
  minOverlapThreshold: 0.3,
  maxLinksPerEntry: 5,
  linkErrorsToTools: true,
};

const logger = new Logger('MemoryLinker');

// ---------------------------------------------------------------------------
// MemoryLinker
// ---------------------------------------------------------------------------

export class MemoryLinker {
  private config: MemoryLinkerConfig;
  private fileManager: MemoryFileManager;

  constructor(
    fileManager: MemoryFileManager,
    config?: Partial<MemoryLinkerConfig>
  ) {
    this.fileManager = fileManager;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // -------------------------------------------------------------------------
  // Linking
  // -------------------------------------------------------------------------

  /**
   * Detect and create links between entries in a parsed memory file.
   *
   * Scans all entry pairs across sections and creates bidirectional
   * links when sufficient keyword overlap or pattern matches are found.
   */
  detectLinks(file: ParsedMemoryFile): MemoryLink[] {
    const links: MemoryLink[] = [];
    const allEntries = this.flattenEntries(file);

    for (let i = 0; i < allEntries.length; i++) {
      for (let j = i + 1; j < allEntries.length; j++) {
        const a = allEntries[i]!;
        const b = allEntries[j]!;

        // Skip entries in the same section (they are already grouped)
        if (a.section === b.section) {
          continue;
        }

        // Check for keyword overlap
        const overlap = this.computeOverlap(a.entry.text, b.entry.text);
        if (overlap >= this.config.minOverlapThreshold) {
          links.push({
            sourceText: a.entry.text,
            sourceSection: a.section,
            targetText: b.entry.text,
            targetSection: b.section,
            similarity: overlap,
            reason: 'keyword-overlap',
          });
          continue;
        }

        // Check for error-to-tool links
        if (this.config.linkErrorsToTools) {
          const errorToolLink = this.detectErrorToolLink(a, b);
          if (errorToolLink) {
            links.push(errorToolLink);
            continue;
          }
        }

        // Check for explicit references (backtick mentions)
        const explicitRef = this.detectExplicitReference(a, b);
        if (explicitRef) {
          links.push(explicitRef);
        }
      }
    }

    return links;
  }

  /**
   * Apply detected links to the parsed file by updating entry metadata.
   *
   * Returns the number of entries that were updated.
   */
  applyLinks(file: ParsedMemoryFile, links: MemoryLink[]): number {
    let updatedCount = 0;

    for (const link of links) {
      const sourceUpdated = this.addLinkToEntry(
        file,
        link.sourceSection,
        link.sourceText,
        this.buildLinkId(link.targetSection, link.targetText)
      );

      const targetUpdated = this.addLinkToEntry(
        file,
        link.targetSection,
        link.targetText,
        this.buildLinkId(link.sourceSection, link.sourceText)
      );

      if (sourceUpdated) {
        updatedCount++;
      }
      if (targetUpdated) {
        updatedCount++;
      }
    }

    return updatedCount;
  }

  /**
   * Run a full linking pass on a memory file: detect links and apply them.
   */
  async linkFile(filePath: string): Promise<LinkingResult> {
    const file = await this.fileManager.read(filePath);
    if (!file.exists || file.sections.length === 0) {
      return { newLinks: 0, totalLinks: 0, updatedEntries: 0 };
    }

    const links = this.detectLinks(file);
    const updatedEntries = this.applyLinks(file, links);

    if (updatedEntries > 0) {
      await this.fileManager.write(filePath, file);
      logger.info(
        `Linked ${links.length} pairs, updated ${updatedEntries} entries in ${filePath}`
      );
    }

    // Count total links across all entries
    const totalLinks = this.countTotalLinks(file);

    return {
      newLinks: links.length,
      totalLinks,
      updatedEntries,
    };
  }

  /**
   * Get all entries linked to a specific entry.
   */
  getLinkedEntries(
    file: ParsedMemoryFile,
    entryText: string
  ): Array<{ entry: MemoryEntry; section: string }> {
    const result = this.fileManager.findEntry(file, entryText);
    if (!result || !result.entry.metadata?.links) {
      return [];
    }

    const linked: Array<{ entry: MemoryEntry; section: string }> = [];

    for (const linkId of result.entry.metadata.links) {
      const { section: linkSection, text: linkText } = this.parseLinkId(linkId);
      if (!linkSection || !linkText) {
        continue;
      }

      for (const section of file.sections) {
        if (section.title.toLowerCase() !== linkSection.toLowerCase()) {
          continue;
        }
        for (const entry of section.entries) {
          if (
            this.fileManager.normalizeEntry(entry.text) ===
            this.fileManager.normalizeEntry(linkText)
          ) {
            linked.push({ entry, section: section.title });
          }
        }
      }
    }

    return linked;
  }

  // -------------------------------------------------------------------------
  // Private: Detection
  // -------------------------------------------------------------------------

  /**
   * Flatten all entries from a file into a flat list with section info.
   */
  private flattenEntries(
    file: ParsedMemoryFile
  ): Array<{ entry: MemoryEntry; section: string }> {
    const result: Array<{ entry: MemoryEntry; section: string }> = [];
    for (const section of file.sections) {
      if (section.title === 'Links') {
        continue;
      }
      for (const entry of section.entries) {
        result.push({ entry, section: section.title });
      }
    }
    return result;
  }

  /**
   * Compute keyword overlap between two texts.
   */
  private computeOverlap(textA: string, textB: string): number {
    const tokensA = this.tokenize(textA);
    const tokensB = this.tokenize(textB);

    if (tokensA.length === 0 || tokensB.length === 0) {
      return 0;
    }

    const setB = new Set(tokensB);
    let overlap = 0;
    for (const token of tokensA) {
      if (setB.has(token)) {
        overlap++;
      }
    }

    return overlap / Math.max(tokensA.length, tokensB.length);
  }

  /**
   * Detect an error-to-tool usage link.
   */
  private detectErrorToolLink(
    a: { entry: MemoryEntry; section: string },
    b: { entry: MemoryEntry; section: string }
  ): MemoryLink | null {
    let errorEntry: { entry: MemoryEntry; section: string } | null = null;
    let toolEntry: { entry: MemoryEntry; section: string } | null = null;

    if (a.section === 'Error Patterns' && b.section === 'Tool Usage') {
      errorEntry = a;
      toolEntry = b;
    } else if (b.section === 'Error Patterns' && a.section === 'Tool Usage') {
      errorEntry = b;
      toolEntry = a;
    }

    if (!errorEntry || !toolEntry) {
      return null;
    }

    // Check if the error mentions a tool or command in the tool entry
    const errorLower = errorEntry.entry.text.toLowerCase();
    const toolTokens = this.tokenize(toolEntry.entry.text);

    const hasToolMention = toolTokens.some(
      token => token.length > 3 && errorLower.includes(token)
    );

    if (!hasToolMention) {
      return null;
    }

    return {
      sourceText: errorEntry.entry.text,
      sourceSection: errorEntry.section,
      targetText: toolEntry.entry.text,
      targetSection: toolEntry.section,
      similarity: 0,
      reason: 'error-fix-pair',
    };
  }

  /**
   * Detect explicit references (e.g., backtick-quoted terms).
   */
  private detectExplicitReference(
    a: { entry: MemoryEntry; section: string },
    b: { entry: MemoryEntry; section: string }
  ): MemoryLink | null {
    const backtickTermsA = this.extractBacktickTerms(a.entry.text);
    const backtickTermsB = this.extractBacktickTerms(b.entry.text);

    // Check if A references a term that appears in B
    for (const term of backtickTermsA) {
      if (b.entry.text.toLowerCase().includes(term.toLowerCase())) {
        return {
          sourceText: a.entry.text,
          sourceSection: a.section,
          targetText: b.entry.text,
          targetSection: b.section,
          similarity: 0,
          reason: 'explicit-reference',
        };
      }
    }

    // Check if B references a term that appears in A
    for (const term of backtickTermsB) {
      if (a.entry.text.toLowerCase().includes(term.toLowerCase())) {
        return {
          sourceText: b.entry.text,
          sourceSection: b.section,
          targetText: a.entry.text,
          targetSection: a.section,
          similarity: 0,
          reason: 'explicit-reference',
        };
      }
    }

    return null;
  }

  /**
   * Extract backtick-quoted terms from text.
   */
  private extractBacktickTerms(text: string): string[] {
    const matches = text.match(/`([^`]+)`/g);
    if (!matches) {
      return [];
    }
    return matches
      .map(m => m.replace(/`/g, '').trim())
      .filter(m => m.length > 2);
  }

  // -------------------------------------------------------------------------
  // Private: Link Management
  // -------------------------------------------------------------------------

  /**
   * Build a link ID from section and text.
   */
  private buildLinkId(section: string, text: string): string {
    // Use a compact representation: section::first-20-chars
    const shortText = text.slice(0, 30).replace(/[,;]/g, '').trim();
    return `${section}::${shortText}`;
  }

  /**
   * Parse a link ID back to section and text.
   */
  private parseLinkId(linkId: string): { section: string; text: string } {
    const sepIdx = linkId.indexOf('::');
    if (sepIdx < 0) {
      return { section: '', text: '' };
    }
    return {
      section: linkId.slice(0, sepIdx),
      text: linkId.slice(sepIdx + 2),
    };
  }

  /**
   * Add a link to an entry's metadata.
   */
  private addLinkToEntry(
    file: ParsedMemoryFile,
    sectionTitle: string,
    entryText: string,
    linkId: string
  ): boolean {
    const section = file.sections.find(
      s => s.title.toLowerCase() === sectionTitle.toLowerCase()
    );
    if (!section) {
      return false;
    }

    const normalized = this.fileManager.normalizeEntry(entryText);
    const entry = section.entries.find(
      e => this.fileManager.normalizeEntry(e.text) === normalized
    );
    if (!entry) {
      return false;
    }

    if (!entry.metadata) {
      entry.metadata = {};
    }

    const links = entry.metadata.links ?? [];

    // Check if link already exists
    if (links.includes(linkId)) {
      return false;
    }

    // Enforce max links per entry
    if (links.length >= this.config.maxLinksPerEntry) {
      return false;
    }

    links.push(linkId);
    entry.metadata.links = links;
    return true;
  }

  /**
   * Count total links across all entries in a file.
   */
  private countTotalLinks(file: ParsedMemoryFile): number {
    let total = 0;
    for (const section of file.sections) {
      for (const entry of section.entries) {
        total += entry.metadata?.links?.length ?? 0;
      }
    }
    return total;
  }

  // -------------------------------------------------------------------------
  // Private: Tokenization
  // -------------------------------------------------------------------------

  /**
   * Tokenize text for comparison.
   */
  private tokenize(text: string): string[] {
    const stopWords = new Set([
      'a',
      'an',
      'the',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'shall',
      'can',
      'to',
      'of',
      'in',
      'for',
      'on',
      'with',
      'at',
      'by',
      'from',
      'it',
      'its',
      'this',
      'that',
      'and',
      'or',
      'but',
      'not',
      'if',
      'then',
      'else',
      'when',
      'up',
      'out',
      'so',
      'no',
      'as',
    ]);

    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1 && !stopWords.has(w));
  }
}
