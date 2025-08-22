/**
 * Streaming File Processor - Memory-optimized file processing with streaming
 * Reduces memory footprint from 500MB to <100MB for large codebases
 */
import { EventEmitter } from 'events';
import * as ts from 'typescript';
export interface StreamingConfig {
    chunkSize: number;
    maxMemoryUsage: number;
    enableGzipCompression: boolean;
    workerPoolSize: number;
    bufferSize: number;
    backpressureThreshold: number;
}
export interface FileChunk {
    id: string;
    filePath: string;
    content: Buffer;
    startLine: number;
    endLine: number;
    isComplete: boolean;
    metadata: {
        size: number;
        encoding: string;
        timestamp: number;
    };
}
export interface StreamingMetrics {
    bytesProcessed: number;
    filesProcessed: number;
    chunksProcessed: number;
    memoryPeak: number;
    memoryAverage: number;
    processingRate: number;
    errorCount: number;
}
/**
 * High-performance streaming file processor with memory optimization
 */
export declare class StreamingFileProcessor extends EventEmitter {
    private config;
    private metrics;
    private memoryMonitor;
    private activeStreams;
    private processingQueue;
    private backpressureActive;
    private bufferPool;
    private chunkPool;
    private transformPool;
    constructor(config?: Partial<StreamingConfig>);
    /**
     * Stream process multiple files with memory optimization
     */
    streamProcessFiles(filePaths: string[], processor: (chunk: FileChunk) => Promise<any>): Promise<StreamingMetrics>;
    /**
     * Stream process a single file with chunking
     */
    streamProcessFile(filePath: string, processor: (chunk: FileChunk) => Promise<any>): Promise<void>;
    /**
     * Process small files directly without chunking
     */
    private processSmallFile;
    /**
     * Process large files with streaming and chunking
     */
    private processLargeFile;
    /**
     * Create a chunking transform stream
     */
    private createChunkTransform;
    /**
     * Create a processing transform stream
     */
    private createProcessingTransform;
    /**
     * Process files in batches for memory management
     */
    private processBatch;
    /**
     * Create batches from file paths
     */
    private createBatches;
    /**
     * Check for memory backpressure and pause processing if needed
     */
    private checkBackpressure;
    /**
     * Wait for memory to be released
     */
    private waitForMemoryRelease;
    /**
     * Initialize memory monitoring
     */
    private initializeMemoryMonitoring;
    /**
     * Initialize object pools for memory efficiency
     */
    private initializePools;
    /**
     * Get a buffer from the pool or create new
     */
    private getBuffer;
    /**
     * Release buffer back to pool
     */
    private releaseBuffer;
    /**
     * Create a chunk object from pool
     */
    private createChunk;
    /**
     * Release chunk back to pool
     */
    private releaseChunk;
    /**
     * Generate unique chunk ID
     */
    private generateChunkId;
    /**
     * Count lines in buffer
     */
    private countLines;
    /**
     * Cleanup resources
     */
    private cleanup;
    /**
     * Get current metrics
     */
    getMetrics(): StreamingMetrics;
}
/**
 * Streaming AST processor for TypeScript files
 */
export declare class StreamingASTProcessor {
    private streamProcessor;
    private program;
    constructor(config?: Partial<StreamingConfig>);
    /**
     * Process TypeScript files with streaming AST parsing
     */
    processTypeScriptFiles(files: string[], processor: (node: ts.Node, sourceFile: ts.SourceFile) => void): Promise<StreamingMetrics>;
    /**
     * Visit AST nodes with memory-efficient streaming
     */
    private visitNodeStreaming;
    /**
     * Get metrics from underlying stream processor
     */
    getMetrics(): StreamingMetrics;
}
//# sourceMappingURL=StreamingFileProcessor.d.ts.map