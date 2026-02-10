/**
 * Skill Search / Metadata Index
 *
 * Provides full-text and faceted search across registered skills.
 * Builds an inverted index from skill metadata (name, description,
 * tags, category, source) for fast querying.
 *
 * @module skills/skill-search
 */

import type {
  SkillEntry,
  SkillSearchQuery,
  SkillSearchResult,
  SkillSource,
} from './types';

// ---------------------------------------------------------------------------
// Index
// ---------------------------------------------------------------------------

/**
 * Internal term entry in the inverted index.
 */
interface IndexEntry {
  skillName: string;
  /** Which field the term was extracted from */
  field: string;
  /** Boost factor for this field (name > tags > description) */
  boost: number;
}

/**
 * In-memory search index for skills metadata.
 *
 * Supports:
 * - Free-text search across name, description, and tags
 * - Faceted filtering by category, source, context, and model
 * - Ranked results using TF-IDF-like scoring
 *
 * Usage:
 * ```typescript
 * const index = new SkillSearchIndex();
 * index.rebuild(registry.getAllEntries());
 *
 * const results = index.search({ text: 'docker', category: 'devops' });
 * ```
 */
export class SkillSearchIndex {
  /**
   * Inverted index: term -> list of matching skills with boost info.
   */
  private termIndex = new Map<string, IndexEntry[]>();

  /**
   * All indexed entries by name for O(1) lookup.
   */
  private entriesByName = new Map<string, SkillEntry>();

  /**
   * Category index for faceted filtering.
   */
  private categoryIndex = new Map<string, Set<string>>();

  /**
   * Source index for faceted filtering.
   */
  private sourceIndex = new Map<SkillSource, Set<string>>();

  /**
   * Context index for faceted filtering.
   */
  private contextIndex = new Map<string, Set<string>>();

  /**
   * Model index for faceted filtering.
   */
  private modelIndex = new Map<string, Set<string>>();

  /**
   * Rebuild the entire index from a fresh set of entries.
   */
  rebuild(entries: SkillEntry[]): void {
    this.termIndex.clear();
    this.entriesByName.clear();
    this.categoryIndex.clear();
    this.sourceIndex.clear();
    this.contextIndex.clear();
    this.modelIndex.clear();

    for (const entry of entries) {
      this.indexEntry(entry);
    }
  }

  /**
   * Search the index with a query.
   *
   * @param query - Search parameters
   * @returns Ranked search results
   */
  search(query: SkillSearchQuery): SkillSearchResult[] {
    const limit = query.limit ?? 50;

    // Start with all entries
    let candidateNames: Set<string> | undefined;

    // Apply faceted filters first (narrowing)
    if (query.category) {
      candidateNames = intersect(candidateNames, this.categoryIndex.get(query.category));
    }

    if (query.source) {
      candidateNames = intersect(candidateNames, this.sourceIndex.get(query.source));
    }

    if (query.context) {
      candidateNames = intersect(candidateNames, this.contextIndex.get(query.context));
    }

    if (query.model) {
      candidateNames = intersect(candidateNames, this.modelIndex.get(query.model));
    }

    // Apply name substring filter
    if (query.name) {
      const nameLower = query.name.toLowerCase();
      const nameMatches = new Set<string>();
      for (const name of (candidateNames ?? this.entriesByName.keys())) {
        if (name.toLowerCase().includes(nameLower)) {
          nameMatches.add(name);
        }
      }
      candidateNames = nameMatches;
    }

    // Apply tag filter
    if (query.tags && query.tags.length > 0) {
      const tagSet = new Set(query.tags.map(t => t.toLowerCase()));
      const tagMatches = new Set<string>();
      for (const name of (candidateNames ?? this.entriesByName.keys())) {
        const entry = this.entriesByName.get(name);
        if (!entry) {
continue;
}
        const entryTags = entry.skill.tags.map(t => t.toLowerCase());
        if (entryTags.some(t => tagSet.has(t))) {
          tagMatches.add(name);
        }
      }
      candidateNames = tagMatches;
    }

    // Full-text scoring
    if (query.text && query.text.trim().length > 0) {
      return this.textSearch(query.text, candidateNames, limit);
    }

    // No text query -- return all candidates sorted by name
    const candidates = candidateNames ?? new Set(this.entriesByName.keys());
    const results: SkillSearchResult[] = [];

    for (const name of candidates) {
      const entry = this.entriesByName.get(name);
      if (!entry) {
continue;
}
      results.push({
        entry,
        score: 1.0,
        matchedFields: [],
      });
      if (results.length >= limit) {
break;
}
    }

    return results;
  }

  /**
   * Get all unique categories in the index.
   */
  getCategories(): string[] {
    return Array.from(this.categoryIndex.keys()).sort();
  }

  /**
   * Get all unique tags across all indexed skills.
   */
  getAllTags(): string[] {
    const tags = new Set<string>();
    for (const entry of this.entriesByName.values()) {
      for (const tag of entry.skill.tags) {
        tags.add(tag);
      }
    }
    return Array.from(tags).sort();
  }

  /**
   * Get the total number of indexed skills.
   */
  get size(): number {
    return this.entriesByName.size;
  }

  // -------------------------------------------------------------------------
  // Indexing
  // -------------------------------------------------------------------------

  private indexEntry(entry: SkillEntry): void {
    const name = entry.skill.name;
    this.entriesByName.set(name, entry);

    // Index name terms (highest boost)
    for (const term of tokenize(name)) {
      this.addTerm(term, name, 'name', 3.0);
    }

    // Index description terms
    for (const term of tokenize(entry.skill.description)) {
      this.addTerm(term, name, 'description', 1.0);
    }

    // Index tags (high boost)
    for (const tag of entry.skill.tags) {
      for (const term of tokenize(tag)) {
        this.addTerm(term, name, 'tags', 2.0);
      }
    }

    // Index category
    const category = entry.metadata?.category;
    if (category) {
      addToSetIndex(this.categoryIndex, category, name);
      for (const term of tokenize(category)) {
        this.addTerm(term, name, 'category', 1.5);
      }
    }

    // Index source
    addToSetIndex(this.sourceIndex, entry.skill.source, name);

    // Index context
    const context = entry.skill.frontmatter.context ?? 'inline';
    addToSetIndex(this.contextIndex, context, name);

    // Index model
    const model = entry.skill.frontmatter.model;
    if (model) {
      addToSetIndex(this.modelIndex, model, name);
    }
  }

  private addTerm(term: string, skillName: string, field: string, boost: number): void {
    const existing = this.termIndex.get(term);
    const entry: IndexEntry = { skillName, field, boost };
    if (existing) {
      existing.push(entry);
    } else {
      this.termIndex.set(term, [entry]);
    }
  }

  // -------------------------------------------------------------------------
  // Text Search
  // -------------------------------------------------------------------------

  private textSearch(
    text: string,
    candidates: Set<string> | undefined,
    limit: number,
  ): SkillSearchResult[] {
    const queryTerms = tokenize(text);
    if (queryTerms.length === 0) {
return [];
}

    // Score accumulator
    const scores = new Map<string, { score: number; fields: Set<string> }>();

    for (const queryTerm of queryTerms) {
      // Exact and prefix matches
      for (const [indexTerm, entries] of this.termIndex) {
        if (!indexTerm.startsWith(queryTerm) && indexTerm !== queryTerm) {
continue;
}

        const exactBonus = indexTerm === queryTerm ? 2.0 : 1.0;

        for (const entry of entries) {
          if (candidates && !candidates.has(entry.skillName)) {
continue;
}

          const existing = scores.get(entry.skillName);
          const termScore = entry.boost * exactBonus;

          if (existing) {
            existing.score += termScore;
            existing.fields.add(entry.field);
          } else {
            scores.set(entry.skillName, {
              score: termScore,
              fields: new Set([entry.field]),
            });
          }
        }
      }
    }

    // Normalize scores and build results
    const maxScore = Math.max(...Array.from(scores.values()).map(s => s.score), 1);
    const results: SkillSearchResult[] = [];

    for (const [name, { score, fields }] of scores) {
      const entry = this.entriesByName.get(name);
      if (!entry) {
continue;
}

      results.push({
        entry,
        score: score / maxScore,
        matchedFields: Array.from(fields),
      });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Tokenize a string into searchable terms.
 * Splits on non-alphanumeric characters, lowercases, and filters short tokens.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 2);
}

/**
 * Add a name to a set-indexed map.
 */
function addToSetIndex<K>(
  index: Map<K, Set<string>>,
  key: K,
  name: string,
): void {
  const existing = index.get(key);
  if (existing) {
    existing.add(name);
  } else {
    index.set(key, new Set([name]));
  }
}

/**
 * Intersect a candidate set with a filter set.
 * If candidates is undefined, returns the filter set (or undefined).
 */
function intersect(
  candidates: Set<string> | undefined,
  filter: Set<string> | undefined,
): Set<string> | undefined {
  if (!filter) {
    // Filter matches nothing
    return candidates ?? undefined;
  }

  if (!candidates) {
    return new Set(filter);
  }

  const result = new Set<string>();
  for (const name of candidates) {
    if (filter.has(name)) {
      result.add(name);
    }
  }
  return result;
}
