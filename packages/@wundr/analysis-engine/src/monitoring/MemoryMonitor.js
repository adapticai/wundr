"use strict";
/**
 * Memory Monitor - Comprehensive memory tracking and leak detection
 * Real-time memory profiling with heap snapshot analysis
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryMonitor = void 0;
const tslib_1 = require("tslib");
const events_1 = require("events");
const fs = tslib_1.__importStar(require("fs-extra"));
const path = tslib_1.__importStar(require("path"));
const v8 = tslib_1.__importStar(require("v8"));
/**
 * Advanced memory monitoring with leak detection and profiling
 */
class MemoryMonitor extends events_1.EventEmitter {
    snapshots = [];
    isMonitoring = false;
    monitoringInterval = null;
    gcObserver = null;
    thresholds;
    snapshotInterval;
    maxSnapshots;
    outputDir;
    // GC tracking
    gcStats = {
        count: 0,
        totalDuration: 0,
        averageDuration: 0,
        lastGC: 0
    };
    // Object tracking for leak detection
    objectTracker = new Map();
    constructor(options = {}) {
        super();
        this.snapshotInterval = options.snapshotInterval || 5000; // 5 seconds
        this.maxSnapshots = options.maxSnapshots || 1000;
        this.outputDir = options.outputDir || './memory-profiles';
        this.thresholds = {
            heapWarning: 100 * 1024 * 1024, // 100MB
            heapCritical: 250 * 1024 * 1024, // 250MB
            rssWarning: 200 * 1024 * 1024, // 200MB
            rssCritical: 500 * 1024 * 1024, // 500MB
            growthRateWarning: 1024 * 1024, // 1MB/sec
            growthRateCritical: 5 * 1024 * 1024, // 5MB/sec
            ...options.thresholds
        };
        this.setupGCObserver();
    }
    /**
     * Start memory monitoring
     */
    async startMonitoring() {
        if (this.isMonitoring)
            return;
        this.isMonitoring = true;
        await fs.ensureDir(this.outputDir);
        // Initial snapshot
        this.takeSnapshot();
        // Set up periodic snapshots
        this.monitoringInterval = setInterval(() => {
            this.takeSnapshot();
            this.analyzeMemoryTrends();
        }, this.snapshotInterval);
        this.emit('monitoring-started', {
            interval: this.snapshotInterval,
            thresholds: this.thresholds
        });
    }
    /**
     * Stop memory monitoring
     */
    stopMonitoring() {
        if (!this.isMonitoring)
            return;
        this.isMonitoring = false;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.emit('monitoring-stopped', {
            totalSnapshots: this.snapshots.length,
            monitoringDuration: this.getMonitoringDuration()
        });
    }
    /**
     * Take a memory snapshot
     */
    takeSnapshot() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        const snapshot = {
            timestamp: Date.now(),
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external,
            arrayBuffers: memUsage.arrayBuffers,
            rss: memUsage.rss,
            cpu: (cpuUsage.user + cpuUsage.system) / 1000 // Convert to ms
        };
        // Add V8 heap statistics if available
        try {
            const v8HeapStats = v8.getHeapStatistics();
            snapshot.gcStats = {
                totalHeapSize: v8HeapStats.total_heap_size,
                totalHeapSizeExecutable: v8HeapStats.total_heap_size_executable,
                totalPhysicalSize: v8HeapStats.total_physical_size,
                totalAvailableSize: v8HeapStats.total_available_size,
                usedHeapSize: v8HeapStats.used_heap_size,
                heapSizeLimit: v8HeapStats.heap_size_limit
            };
        }
        catch (error) {
            // V8 statistics not available
        }
        this.addSnapshot(snapshot);
        this.checkThresholds(snapshot);
        return snapshot;
    }
    /**
     * Add snapshot to history
     */
    addSnapshot(snapshot) {
        this.snapshots.push(snapshot);
        // Maintain maximum snapshots
        if (this.snapshots.length > this.maxSnapshots) {
            this.snapshots.shift();
        }
        this.emit('snapshot-taken', snapshot);
    }
    /**
     * Check memory thresholds and emit alerts
     */
    checkThresholds(snapshot) {
        // Heap usage checks
        if (snapshot.heapUsed > this.thresholds.heapCritical) {
            this.emit('memory-alert', {
                type: 'heap-critical',
                current: snapshot.heapUsed,
                threshold: this.thresholds.heapCritical,
                severity: 'critical'
            });
        }
        else if (snapshot.heapUsed > this.thresholds.heapWarning) {
            this.emit('memory-alert', {
                type: 'heap-warning',
                current: snapshot.heapUsed,
                threshold: this.thresholds.heapWarning,
                severity: 'warning'
            });
        }
        // RSS checks
        if (snapshot.rss > this.thresholds.rssCritical) {
            this.emit('memory-alert', {
                type: 'rss-critical',
                current: snapshot.rss,
                threshold: this.thresholds.rssCritical,
                severity: 'critical'
            });
        }
        else if (snapshot.rss > this.thresholds.rssWarning) {
            this.emit('memory-alert', {
                type: 'rss-warning',
                current: snapshot.rss,
                threshold: this.thresholds.rssWarning,
                severity: 'warning'
            });
        }
        // Growth rate checks
        const growthRate = this.calculateGrowthRate();
        if (growthRate > this.thresholds.growthRateCritical) {
            this.emit('memory-alert', {
                type: 'growth-rate-critical',
                current: growthRate,
                threshold: this.thresholds.growthRateCritical,
                severity: 'critical'
            });
        }
        else if (growthRate > this.thresholds.growthRateWarning) {
            this.emit('memory-alert', {
                type: 'growth-rate-warning',
                current: growthRate,
                threshold: this.thresholds.growthRateWarning,
                severity: 'warning'
            });
        }
    }
    /**
     * Analyze memory trends and detect leaks
     */
    analyzeMemoryTrends() {
        if (this.snapshots.length < 10)
            return; // Need minimum samples
        const leakAnalysis = this.detectMemoryLeaks();
        if (leakAnalysis.leakDetected) {
            this.emit('memory-leak-detected', leakAnalysis);
        }
        this.emit('trend-analysis', {
            growthRate: this.calculateGrowthRate(),
            gcFrequency: this.calculateGCFrequency(),
            leakAnalysis
        });
    }
    /**
     * Detect memory leaks using statistical analysis
     */
    detectMemoryLeaks() {
        const recentSnapshots = this.snapshots.slice(-30); // Last 30 snapshots
        const heapValues = recentSnapshots.map(s => s.heapUsed);
        // Calculate trend using linear regression
        const trend = this.calculateLinearTrend(heapValues);
        const growthRate = trend.slope * 1000 / this.snapshotInterval; // bytes per second
        // Determine severity
        let severity = 'low';
        if (growthRate > this.thresholds.growthRateCritical) {
            severity = 'critical';
        }
        else if (growthRate > this.thresholds.growthRateWarning) {
            severity = growthRate > this.thresholds.growthRateWarning * 2 ? 'high' : 'medium';
        }
        // Detect trend direction
        let trendDirection = 'stable';
        if (Math.abs(growthRate) > 1024) { // 1KB threshold
            trendDirection = growthRate > 0 ? 'growing' : 'shrinking';
        }
        const leakDetected = severity !== 'low' && trendDirection === 'growing';
        const recommendations = this.generateRecommendations(severity, growthRate, trendDirection);
        return {
            leakDetected,
            growthRate,
            severity,
            trend: trendDirection,
            recommendations,
            suspiciousObjects: this.identifySuspiciousObjects()
        };
    }
    /**
     * Calculate linear trend using least squares
     */
    calculateLinearTrend(values) {
        const n = values.length;
        if (n < 2)
            return { slope: 0, intercept: 0, correlation: 0 };
        const x = Array.from({ length: n }, (_, i) => i);
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = values.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
        const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
        const sumYY = values.reduce((sum, yi) => sum + yi * yi, 0);
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        // Calculate correlation coefficient
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
        const correlation = denominator !== 0 ? numerator / denominator : 0;
        return { slope, intercept, correlation };
    }
    /**
     * Calculate memory growth rate (bytes per second)
     */
    calculateGrowthRate() {
        if (this.snapshots.length < 2)
            return 0;
        const recent = this.snapshots.slice(-10); // Last 10 snapshots
        if (recent.length < 2)
            return 0;
        const firstSnapshot = recent[0];
        const lastSnapshot = recent[recent.length - 1];
        if (!firstSnapshot || !lastSnapshot)
            return 0;
        const heapDiff = lastSnapshot.heapUsed - firstSnapshot.heapUsed;
        const timeDiff = (lastSnapshot.timestamp - firstSnapshot.timestamp) / 1000; // seconds
        return timeDiff > 0 ? heapDiff / timeDiff : 0;
    }
    /**
     * Calculate GC frequency
     */
    calculateGCFrequency() {
        const duration = this.getMonitoringDuration();
        return duration > 0 ? (this.gcStats.count / duration) * 60000 : 0; // GCs per minute
    }
    /**
     * Generate memory optimization recommendations
     */
    generateRecommendations(severity, growthRate, trend) {
        const recommendations = [];
        if (severity === 'critical') {
            recommendations.push('URGENT: Memory usage is critical. Consider restarting the application.');
            recommendations.push('Take heap snapshot for detailed analysis of memory usage.');
        }
        if (trend === 'growing') {
            recommendations.push('Memory usage is steadily increasing. Check for memory leaks.');
            recommendations.push('Review recent code changes that might cause memory retention.');
        }
        if (growthRate > 1024 * 1024) { // 1MB/s
            recommendations.push('High memory growth rate detected. Profile memory allocations.');
            recommendations.push('Consider implementing object pooling for frequently created objects.');
        }
        if (this.gcStats.averageDuration > 100) { // 100ms
            recommendations.push('GC pauses are long. Consider tuning Node.js GC parameters.');
            recommendations.push('Reduce object allocation frequency to minimize GC pressure.');
        }
        // General recommendations
        recommendations.push('Enable --expose-gc flag to manually trigger garbage collection.');
        recommendations.push('Use WeakMap and WeakSet for temporary object references.');
        recommendations.push('Implement streaming for large data processing.');
        recommendations.push('Monitor and limit cache sizes to prevent unbounded growth.');
        return recommendations;
    }
    /**
     * Identify suspicious objects that might cause leaks
     */
    identifySuspiciousObjects() {
        // This is a simplified implementation
        // In a real scenario, you'd use heap snapshots to analyze object types
        const suspiciousObjects = [];
        // Analyze object tracker if available
        for (const [type, data] of this.objectTracker.entries()) {
            const recentGrowth = data.trend.slice(-5).reduce((sum, val) => sum + val, 0) / 5;
            if (recentGrowth > 0 && data.count > 1000) {
                suspiciousObjects.push({
                    type,
                    count: data.count,
                    size: data.size,
                    growth: recentGrowth
                });
            }
        }
        return suspiciousObjects.sort((a, b) => b.growth - a.growth);
    }
    /**
     * Set up GC observer for tracking garbage collection
     */
    setupGCObserver() {
        try {
            // Use performance observer for GC tracking
            const { PerformanceObserver } = require('perf_hooks');
            this.gcObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach((entry) => {
                    if (entry.entryType === 'gc') {
                        this.gcStats.count++;
                        this.gcStats.totalDuration += entry.duration;
                        this.gcStats.averageDuration = this.gcStats.totalDuration / this.gcStats.count;
                        this.gcStats.lastGC = Date.now();
                        this.emit('gc-event', {
                            type: entry.kind,
                            duration: entry.duration,
                            timestamp: entry.startTime
                        });
                    }
                });
            });
            this.gcObserver.observe({ type: 'gc' });
        }
        catch (error) {
            // GC observer not available
            console.warn('GC observer not available:', error.message);
        }
    }
    /**
     * Force garbage collection (requires --expose-gc)
     */
    forceGC() {
        if (global.gc) {
            const before = process.memoryUsage();
            global.gc();
            const after = process.memoryUsage();
            this.emit('gc-forced', {
                before,
                after,
                freed: before.heapUsed - after.heapUsed
            });
        }
        else {
            this.emit('gc-unavailable', {
                message: 'Garbage collection not available. Run with --expose-gc flag.'
            });
        }
    }
    /**
     * Generate heap snapshot
     */
    async generateHeapSnapshot() {
        try {
            const filename = `heap-snapshot-${Date.now()}.heapsnapshot`;
            const filepath = path.join(this.outputDir, filename);
            const snapshot = v8.getHeapSnapshot();
            const writeStream = fs.createWriteStream(filepath);
            await new Promise((resolve, reject) => {
                snapshot.pipe(writeStream);
                writeStream.on('finish', () => resolve());
                writeStream.on('error', reject);
            });
            this.emit('heap-snapshot-generated', { filepath });
            return filepath;
        }
        catch (error) {
            this.emit('heap-snapshot-error', error);
            throw error;
        }
    }
    /**
     * Get current memory metrics
     */
    getMetrics() {
        const current = this.snapshots[this.snapshots.length - 1] || this.takeSnapshot();
        const peak = this.snapshots.reduce((max, snapshot) => snapshot.heapUsed > max.heapUsed ? snapshot : max, current);
        const average = this.calculateAverages();
        const leakAnalysis = this.detectMemoryLeaks();
        return {
            current,
            peak,
            average,
            trend: {
                heapGrowthRate: this.calculateGrowthRate(),
                gcFrequency: this.calculateGCFrequency(),
                gcDuration: this.gcStats.averageDuration
            },
            leakAnalysis
        };
    }
    /**
     * Calculate average memory usage
     */
    calculateAverages() {
        if (this.snapshots.length === 0) {
            const current = process.memoryUsage();
            return {
                heapUsed: current.heapUsed,
                heapTotal: current.heapTotal,
                rss: current.rss
            };
        }
        const totals = this.snapshots.reduce((acc, snapshot) => ({
            heapUsed: acc.heapUsed + snapshot.heapUsed,
            heapTotal: acc.heapTotal + snapshot.heapTotal,
            rss: acc.rss + snapshot.rss
        }), { heapUsed: 0, heapTotal: 0, rss: 0 });
        const count = this.snapshots.length;
        return {
            heapUsed: totals.heapUsed / count,
            heapTotal: totals.heapTotal / count,
            rss: totals.rss / count
        };
    }
    /**
     * Get monitoring duration in milliseconds
     */
    getMonitoringDuration() {
        if (this.snapshots.length < 2)
            return 0;
        const lastSnapshot = this.snapshots[this.snapshots.length - 1];
        const firstSnapshot = this.snapshots[0];
        return lastSnapshot?.timestamp && firstSnapshot?.timestamp
            ? lastSnapshot.timestamp - firstSnapshot.timestamp
            : 0;
    }
    /**
     * Export memory data to file
     */
    async exportData(format = 'json') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `memory-data-${timestamp}.${format}`;
        const filepath = path.join(this.outputDir, filename);
        let content;
        if (format === 'csv') {
            const headers = 'timestamp,heapUsed,heapTotal,external,arrayBuffers,rss,cpu\n';
            const rows = this.snapshots.map(s => `${s.timestamp},${s.heapUsed},${s.heapTotal},${s.external},${s.arrayBuffers},${s.rss},${s.cpu}`).join('\n');
            content = headers + rows;
        }
        else {
            content = JSON.stringify({
                metadata: {
                    startTime: this.snapshots[0]?.timestamp,
                    endTime: this.snapshots[this.snapshots.length - 1]?.timestamp,
                    totalSnapshots: this.snapshots.length,
                    monitoringDuration: this.getMonitoringDuration(),
                    thresholds: this.thresholds
                },
                gcStats: this.gcStats,
                snapshots: this.snapshots,
                metrics: this.getMetrics()
            }, null, 2);
        }
        await fs.writeFile(filepath, content);
        this.emit('data-exported', { filepath, format, size: content.length });
        return filepath;
    }
    /**
     * Clean up resources
     */
    cleanup() {
        this.stopMonitoring();
        if (this.gcObserver) {
            this.gcObserver.disconnect();
            this.gcObserver = null;
        }
        this.snapshots.length = 0;
        this.objectTracker.clear();
        this.removeAllListeners();
    }
}
exports.MemoryMonitor = MemoryMonitor;
//# sourceMappingURL=MemoryMonitor.js.map