/**
 * Utility functions for the Analysis Engine
 */

import * as crypto from 'crypto';
import * as path from 'path';

/**
 * Generate a normalized hash from content for duplicate detection
 */
export function generateNormalizedHash(content: any): string {
  const normalized =
    typeof content === 'string'
      ? content.trim().replace(/\s+/g, ' ')
      : JSON.stringify(content, Object.keys(content).sort());

  return crypto
    .createHash('sha256')
    .update(normalized)
    .digest('hex')
    .substring(0, 16);
}

/**
 * Generate semantic hash using structural information
 */
export function generateSemanticHash(structure: any): string {
  // Extract structural elements for semantic comparison
  const semanticContent = {
    methods: structure.methods?.map((m: any) => m.name).sort(),
    properties: structure.properties?.map((p: any) => p.name).sort(),
    type: structure.type,
    baseClass: structure.baseClass,
    interfaces: structure.interfaces?.sort(),
  };

  return generateNormalizedHash(semanticContent);
}

/**
 * Calculate similarity between two entities
 */
export function calculateSimilarity(entity1: any, entity2: any): number {
  if (entity1.normalizedHash === entity2.normalizedHash) {
    return 1.0;
  }

  if (entity1.semanticHash === entity2.semanticHash) {
    return 0.9;
  }

  // Calculate Jaccard similarity for method/property names
  const set1 = new Set([
    ...(entity1.members?.methods?.map((m: any) => m.name) || []),
    ...(entity1.members?.properties?.map((p: any) => p.name) || []),
  ]);

  const set2 = new Set([
    ...(entity2.members?.methods?.map((m: any) => m.name) || []),
    ...(entity2.members?.properties?.map((p: any) => p.name) || []),
  ]);

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function for rate limiting
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Chunk array for batch processing
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Process items concurrently with concurrency limit
 */
export async function processConcurrently<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number = 10
): Promise<R[]> {
  const results: R[] = [];
  const chunks = chunk(items, concurrency);

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(chunk.map(item => processor(item)));
    results.push(...chunkResults);
  }

  return results;
}

/**
 * Create unique identifier
 */
export function createId(): string {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Normalize file path for consistent comparison
 */
export function normalizeFilePath(filePath: string): string {
  return path.resolve(filePath).replace(/\\/g, '/');
}

/**
 * Get relative path from base directory
 */
export function getRelativePath(filePath: string, baseDir: string): string {
  return path.relative(baseDir, filePath).replace(/\\/g, '/');
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Format duration in human readable format
 */
export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }

  const seconds = milliseconds / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = seconds / 60;
  if (minutes < 60) {
    return `${Math.floor(minutes)}m ${Math.floor(seconds % 60)}s`;
  }

  const hours = minutes / 60;
  return `${Math.floor(hours)}h ${Math.floor(minutes % 60)}m`;
}

/**
 * Deep merge objects
 */
export function deepMerge<T extends Record<string, any>>(
  target: T,
  ...sources: Partial<T>[]
): T {
  const result = { ...target };

  for (const source of sources) {
    for (const key in source) {
      const targetValue = result[key];
      const sourceValue = source[key];

      if (
        targetValue &&
        sourceValue &&
        typeof targetValue === 'object' &&
        typeof sourceValue === 'object' &&
        !Array.isArray(targetValue) &&
        !Array.isArray(sourceValue)
      ) {
        result[key] = deepMerge(targetValue, sourceValue);
      } else if (sourceValue !== undefined) {
        result[key] = sourceValue as any;
      }
    }
  }

  return result;
}

/**
 * Validate entity against schema
 */
export function validateEntity(entity: any): boolean {
  return (
    typeof entity === 'object' &&
    entity !== null &&
    typeof entity.name === 'string' &&
    typeof entity.type === 'string' &&
    typeof entity.file === 'string' &&
    typeof entity.line === 'number'
  );
}

/**
 * Filter entities by criteria
 */
export function filterEntities(
  entities: any[],
  criteria: {
    types?: string[];
    files?: string[];
    exported?: boolean;
    minComplexity?: number;
    maxComplexity?: number;
  }
): any[] {
  return entities.filter(entity => {
    if (criteria.types && !criteria.types.includes(entity.type)) {
      return false;
    }

    if (
      criteria.files &&
      !criteria.files.some(file => entity.file.includes(file))
    ) {
      return false;
    }

    if (
      criteria.exported !== undefined &&
      (entity.exportType === 'none') !== !criteria.exported
    ) {
      return false;
    }

    if (
      criteria.minComplexity !== undefined &&
      (entity.complexity?.cyclomatic || 0) < criteria.minComplexity
    ) {
      return false;
    }

    if (
      criteria.maxComplexity !== undefined &&
      (entity.complexity?.cyclomatic || 0) > criteria.maxComplexity
    ) {
      return false;
    }

    return true;
  });
}
