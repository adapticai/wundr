/**
 * Memory Monitor - Comprehensive memory tracking and leak detection
 * Real-time memory profiling with heap snapshot analysis
 */
import { EventEmitter } from 'events';
export interface MemorySnapshot {
    timestamp: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
    rss: number;
    cpu: number;
    gcStats?: {
        totalHeapSize: number;
        totalHeapSizeExecutable: number;
        totalPhysicalSize: number;
        totalAvailableSize: number;
        usedHeapSize: number;
        heapSizeLimit: number;
    };
}
export interface MemoryLeakAnalysis {
    leakDetected: boolean;
    growthRate: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    trend: 'stable' | 'growing' | 'shrinking';
    recommendations: string[];
    suspiciousObjects: Array<{
        type: string;
        count: number;
        size: number;
        growth: number;
    }>;
}
export interface MemoryMetrics {
    current: MemorySnapshot;
    peak: MemorySnapshot;
    average: {
        heapUsed: number;
        heapTotal: number;
        rss: number;
    };
    trend: {
        heapGrowthRate: number;
        gcFrequency: number;
        gcDuration: number;
    };
    leakAnalysis: MemoryLeakAnalysis;
}
export interface MemoryThresholds {
    heapWarning: number;
    heapCritical: number;
    rssWarning: number;
    rssCritical: number;
    growthRateWarning: number;
    growthRateCritical: number;
}
/**
 * Advanced memory monitoring with leak detection and profiling
 */
export declare class MemoryMonitor extends EventEmitter {
    private snapshots;
    private isMonitoring;
    private monitoringInterval;
    private gcObserver;
    private thresholds;
    private snapshotInterval;
    private maxSnapshots;
    private outputDir;
    private gcStats;
    private objectTracker;
    constructor(options?: {
        snapshotInterval?: number;
        maxSnapshots?: number;
        outputDir?: string;
        thresholds?: Partial<MemoryThresholds>;
    });
    /**
     * Start memory monitoring
     */
    startMonitoring(): Promise<void>;
    /**
     * Stop memory monitoring
     */
    stopMonitoring(): void;
    /**
     * Take a memory snapshot
     */
    takeSnapshot(): MemorySnapshot;
    /**
     * Add snapshot to history
     */
    private addSnapshot;
    /**
     * Check memory thresholds and emit alerts
     */
    private checkThresholds;
    /**
     * Analyze memory trends and detect leaks
     */
    private analyzeMemoryTrends;
    /**
     * Detect memory leaks using statistical analysis
     */
    detectMemoryLeaks(): MemoryLeakAnalysis;
    /**
     * Calculate linear trend using least squares
     */
    private calculateLinearTrend;
    /**
     * Calculate memory growth rate (bytes per second)
     */
    calculateGrowthRate(): number;
    /**
     * Calculate GC frequency
     */
    private calculateGCFrequency;
    /**
     * Generate memory optimization recommendations
     */
    private generateRecommendations;
    /**
     * Identify suspicious objects that might cause leaks
     */
    private identifySuspiciousObjects;
    /**
     * Set up GC observer for tracking garbage collection
     */
    private setupGCObserver;
    /**
     * Force garbage collection (requires --expose-gc)
     */
    forceGC(): void;
    /**
     * Generate heap snapshot
     */
    generateHeapSnapshot(): Promise<string>;
    /**
     * Get current memory metrics
     */
    getMetrics(): MemoryMetrics;
    /**
     * Calculate average memory usage
     */
    private calculateAverages;
    /**
     * Get monitoring duration in milliseconds
     */
    private getMonitoringDuration;
    /**
     * Export memory data to file
     */
    exportData(format?: 'json' | 'csv'): Promise<string>;
    /**
     * Clean up resources
     */
    cleanup(): void;
}
//# sourceMappingURL=MemoryMonitor.d.ts.map