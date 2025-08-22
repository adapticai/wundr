/**
 * Utility functions for the Analysis Engine
 */
/**
 * Generate a normalized hash from content for duplicate detection
 */
export declare function generateNormalizedHash(content: any): string;
/**
 * Generate semantic hash using structural information
 */
export declare function generateSemanticHash(structure: any): string;
/**
 * Calculate similarity between two entities
 */
export declare function calculateSimilarity(entity1: any, entity2: any): number;
/**
 * Debounce function for performance optimization
 */
export declare function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void;
/**
 * Throttle function for rate limiting
 */
export declare function throttle<T extends (...args: any[]) => any>(func: T, limit: number): (...args: Parameters<T>) => void;
/**
 * Chunk array for batch processing
 */
export declare function chunk<T>(array: T[], size: number): T[][];
/**
 * Process items concurrently with concurrency limit
 */
export declare function processConcurrently<T, R>(items: T[], processor: (item: T) => Promise<R>, concurrency?: number): Promise<R[]>;
/**
 * Create unique identifier
 */
export declare function createId(): string;
/**
 * Normalize file path for consistent comparison
 */
export declare function normalizeFilePath(filePath: string): string;
/**
 * Get relative path from base directory
 */
export declare function getRelativePath(filePath: string, baseDir: string): string;
/**
 * Format file size in human readable format
 */
export declare function formatFileSize(bytes: number): string;
/**
 * Format duration in human readable format
 */
export declare function formatDuration(milliseconds: number): string;
/**
 * Deep merge objects
 */
export declare function deepMerge<T extends Record<string, any>>(target: T, ...sources: Partial<T>[]): T;
/**
 * Validate entity against schema
 */
export declare function validateEntity(entity: any): boolean;
/**
 * Filter entities by criteria
 */
export declare function filterEntities(entities: any[], criteria: {
    types?: string[];
    files?: string[];
    exported?: boolean;
    minComplexity?: number;
    maxComplexity?: number;
}): any[];
//# sourceMappingURL=index.d.ts.map