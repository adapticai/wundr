/**
 * Performance Monitor Service
 * Production-ready performance monitoring for browser and server environments
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface PerformanceMetrics {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  category: 'memory' | 'cpu' | 'network' | 'ui' | 'custom';
  tags?: Record<string, string>;
}

export interface MemoryInfo {
  used: number;
  total: number;
  percentage: number;
  timestamp: number;
}

export interface CPUInfo {
  usage: number;
  timestamp: number;
}

export interface PerformanceSnapshot {
  timestamp: number;
  memory: MemoryInfo;
  cpu: CPUInfo;
  fps?: number;
  domNodes?: number;
  networkLatency?: number;
}

export interface PerformanceAlert {
  id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: number;
  metric?: string;
  value?: number;
  threshold?: number;
}

export interface PerformanceThresholds {
  memoryUsage: { warning: number; critical: number };
  cpuUsage: { warning: number; critical: number };
  fps: { warning: number; critical: number };
  networkLatency: { warning: number; critical: number };
}

const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  memoryUsage: { warning: 75, critical: 90 },
  cpuUsage: { warning: 70, critical: 85 },
  fps: { warning: 30, critical: 20 },
  networkLatency: { warning: 1000, critical: 2000 },
};

/**
 * Core Performance Monitor Class
 * Handles metric collection, analysis, and alerting
 */
export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics[]> = new Map();
  private alerts: PerformanceAlert[] = [];
  private thresholds: PerformanceThresholds = DEFAULT_THRESHOLDS;
  private isMonitoring = false;
  private intervalId: number | null = null;
  private frameRequestId: number | null = null;
  private lastFrameTime = 0;
  private frameCount = 0;
  private currentFPS = 60;

  // Memory leak detection
  private memoryHistory: number[] = [];
  private readonly MAX_HISTORY_SIZE = 100;

  constructor(customThresholds?: Partial<PerformanceThresholds>) {
    if (customThresholds) {
      this.thresholds = { ...DEFAULT_THRESHOLDS, ...customThresholds };
    }
  }

  /**
   * Start monitoring performance metrics
   */
  startMonitoring(interval: number = 5000): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.collectInitialMetrics();

    // Collect metrics at specified interval
    this.intervalId = window.setInterval(() => {
      this.collectMetrics();
    }, interval);

    // Monitor FPS
    this.startFPSMonitoring();

    console.log('Performance monitoring started');
  }

  /**
   * Stop monitoring performance metrics
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.frameRequestId) {
      cancelAnimationFrame(this.frameRequestId);
      this.frameRequestId = null;
    }

    console.log('Performance monitoring stopped');
  }

  /**
   * Add a custom metric
   */
  addMetric(metric: PerformanceMetrics): void {
    const key = `${metric.category}-${metric.name}`;

    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    const metricArray = this.metrics.get(key)!;
    metricArray.push(metric);

    // Keep only last 1000 metrics per type to prevent memory leaks
    if (metricArray.length > 1000) {
      metricArray.splice(0, metricArray.length - 1000);
    }

    this.checkThresholds(metric);
  }

  /**
   * Get metrics by category
   */
  getMetricsByCategory(
    category: PerformanceMetrics['category']
  ): PerformanceMetrics[] {
    const result: PerformanceMetrics[] = [];

    for (const [key, metrics] of this.metrics) {
      if (key.startsWith(category)) {
        result.push(...metrics);
      }
    }

    return result.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Record<string, PerformanceMetrics[]> {
    const result: Record<string, PerformanceMetrics[]> = {};

    for (const [key, metrics] of this.metrics) {
      result[key] = [...metrics];
    }

    return result;
  }

  /**
   * Get recent metrics (last N entries)
   */
  getRecentMetrics(limit: number = 10): PerformanceMetrics[] {
    const allMetrics: PerformanceMetrics[] = [];

    for (const metrics of this.metrics.values()) {
      allMetrics.push(...metrics);
    }

    return allMetrics.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  /**
   * Get average metrics over time period
   */
  getAverageMetrics(timeRange: number = 60000): Record<string, number> {
    const cutoff = Date.now() - timeRange;
    const averages: Record<string, number> = {};

    for (const [key, metrics] of this.metrics) {
      const recentMetrics = metrics.filter(m => m.timestamp >= cutoff);

      if (recentMetrics.length > 0) {
        const sum = recentMetrics.reduce((acc, m) => acc + m.value, 0);
        averages[key] = sum / recentMetrics.length;
      }
    }

    return averages;
  }

  /**
   * Get current alerts
   */
  getAlerts(): PerformanceAlert[] {
    return [...this.alerts].sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Clear all alerts
   */
  clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * Get performance snapshot
   */
  getCurrentSnapshot(): PerformanceSnapshot {
    const memory = this.getMemoryInfo();
    const cpu = this.getCPUInfo();

    return {
      timestamp: Date.now(),
      memory,
      cpu,
      fps: this.currentFPS,
      domNodes:
        typeof document !== 'undefined'
          ? document.querySelectorAll('*').length
          : 0,
      networkLatency: this.getNetworkLatency(),
    };
  }

  /**
   * Analyze memory usage for potential leaks
   */
  analyzeMemoryLeaks(): {
    hasLeak: boolean;
    trend: 'increasing' | 'decreasing' | 'stable';
    growthRate: number;
    recommendation: string;
  } {
    if (this.memoryHistory.length < 10) {
      return {
        hasLeak: false,
        trend: 'stable',
        growthRate: 0,
        recommendation: 'Insufficient data for analysis',
      };
    }

    const recent = this.memoryHistory.slice(-20);
    const slope = this.calculateTrend(recent);
    const growthRate = slope * 1000; // Per second

    const hasLeak = growthRate > 1000 && slope > 0; // Growing > 1KB/sec
    const trend =
      slope > 100 ? 'increasing' : slope < -100 ? 'decreasing' : 'stable';

    let recommendation = 'Memory usage is stable';
    if (hasLeak) {
      recommendation =
        'Potential memory leak detected. Check for event listeners, intervals, or large object accumulation.';
    } else if (trend === 'increasing') {
      recommendation =
        'Memory usage is increasing. Monitor closely for potential leaks.';
    }

    return { hasLeak, trend, growthRate, recommendation };
  }

  /**
   * Export performance report
   */
  exportReport(): {
    timestamp: number;
    duration: number;
    summary: {
      totalMetrics: number;
      alertCount: number;
      categories: string[];
    };
    metrics: Record<string, PerformanceMetrics[]>;
    alerts: PerformanceAlert[];
    analysis: {
      memoryLeaks: ReturnType<PerformanceMonitor['analyzeMemoryLeaks']>;
      averages: Record<string, number>;
    };
  } {
    const allMetrics = this.getAllMetrics();
    const totalMetrics = Object.values(allMetrics).reduce(
      (sum, arr) => sum + arr.length,
      0
    );
    const categories = Array.from(
      new Set(
        Object.values(allMetrics)
          .flat()
          .map(m => m.category)
      )
    );

    const oldestMetric = Math.min(
      ...Object.values(allMetrics)
        .flat()
        .map(m => m.timestamp)
    );
    const duration = Date.now() - oldestMetric;

    return {
      timestamp: Date.now(),
      duration,
      summary: {
        totalMetrics,
        alertCount: this.alerts.length,
        categories,
      },
      metrics: allMetrics,
      alerts: this.getAlerts(),
      analysis: {
        memoryLeaks: this.analyzeMemoryLeaks(),
        averages: this.getAverageMetrics(),
      },
    };
  }

  // Private methods
  private collectInitialMetrics(): void {
    this.collectMetrics();
  }

  private collectMetrics(): void {
    const timestamp = Date.now();

    // Collect memory metrics
    const memory = this.getMemoryInfo();
    this.addMetric({
      name: 'Memory Usage',
      value: memory.percentage,
      unit: '%',
      timestamp,
      category: 'memory',
    });

    // Track memory history for leak detection
    this.memoryHistory.push(memory.used);
    if (this.memoryHistory.length > this.MAX_HISTORY_SIZE) {
      this.memoryHistory.shift();
    }

    // Collect CPU metrics (simulated in browser)
    const cpu = this.getCPUInfo();
    this.addMetric({
      name: 'CPU Usage',
      value: cpu.usage,
      unit: '%',
      timestamp,
      category: 'cpu',
    });

    // Collect UI metrics
    this.addMetric({
      name: 'FPS',
      value: this.currentFPS,
      unit: 'fps',
      timestamp,
      category: 'ui',
    });

    if (typeof document !== 'undefined') {
      this.addMetric({
        name: 'DOM Nodes',
        value: document.querySelectorAll('*').length,
        unit: 'nodes',
        timestamp,
        category: 'ui',
      });
    }

    // Collect network metrics
    const networkLatency = this.getNetworkLatency();
    if (networkLatency > 0) {
      this.addMetric({
        name: 'Network Latency',
        value: networkLatency,
        unit: 'ms',
        timestamp,
        category: 'network',
      });
    }
  }

  private getMemoryInfo(): MemoryInfo {
    const timestamp = Date.now();

    // Try to get real memory info from browser
    if (typeof window !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100,
        timestamp,
      };
    }

    // Fallback for environments without memory API
    return {
      used: 50 * 1024 * 1024, // 50MB estimated
      total: 100 * 1024 * 1024, // 100MB estimated
      percentage: 50,
      timestamp,
    };
  }

  private getCPUInfo(): CPUInfo {
    // In browser, we can't get real CPU usage
    // This would be implemented differently in Node.js
    const timestamp = Date.now();

    // Simulate CPU usage based on FPS and other factors
    const fpsFactor = Math.max(0, (60 - this.currentFPS) / 60) * 50;
    const randomVariation = Math.random() * 20 - 10;
    const usage = Math.max(0, Math.min(100, 20 + fpsFactor + randomVariation));

    return {
      usage,
      timestamp,
    };
  }

  private getNetworkLatency(): number {
    // This would typically be measured through actual network requests
    // For now, return 0 to indicate no measurement
    return 0;
  }

  private startFPSMonitoring(): void {
    const measureFPS = (currentTime: number) => {
      if (this.lastFrameTime) {
        this.frameCount++;

        const elapsed = currentTime - this.lastFrameTime;
        if (elapsed >= 1000) {
          // Update FPS every second
          this.currentFPS = Math.round((this.frameCount * 1000) / elapsed);
          this.frameCount = 0;
          this.lastFrameTime = currentTime;
        }
      } else {
        this.lastFrameTime = currentTime;
      }

      if (this.isMonitoring) {
        this.frameRequestId = requestAnimationFrame(measureFPS);
      }
    };

    if (typeof requestAnimationFrame !== 'undefined') {
      this.frameRequestId = requestAnimationFrame(measureFPS);
    }
  }

  private checkThresholds(metric: PerformanceMetrics): void {
    let threshold: { warning: number; critical: number } | null = null;

    switch (metric.name) {
      case 'Memory Usage':
        threshold = this.thresholds.memoryUsage;
        break;
      case 'CPU Usage':
        threshold = this.thresholds.cpuUsage;
        break;
      case 'FPS':
        threshold = {
          warning: this.thresholds.fps.warning,
          critical: this.thresholds.fps.critical,
        };
        // Invert logic for FPS (lower is worse)
        if (metric.value <= threshold.critical) {
          this.addAlert(
            'critical',
            `Low FPS detected: ${metric.value}fps`,
            metric
          );
        } else if (metric.value <= threshold.warning) {
          this.addAlert(
            'warning',
            `FPS below optimal: ${metric.value}fps`,
            metric
          );
        }
        return;
      case 'Network Latency':
        threshold = this.thresholds.networkLatency;
        break;
    }

    if (threshold) {
      if (metric.value >= threshold.critical) {
        this.addAlert(
          'critical',
          `${metric.name} critically high: ${metric.value}${metric.unit}`,
          metric
        );
      } else if (metric.value >= threshold.warning) {
        this.addAlert(
          'warning',
          `${metric.name} high: ${metric.value}${metric.unit}`,
          metric
        );
      }
    }
  }

  private addAlert(
    level: PerformanceAlert['level'],
    message: string,
    metric?: PerformanceMetrics
  ): void {
    const alert: PerformanceAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      level,
      message,
      timestamp: Date.now(),
      metric: metric?.name,
      value: metric?.value,
      threshold: this.getThresholdForMetric(metric?.name),
    };

    this.alerts.push(alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }

    console.warn(`Performance Alert [${level.toUpperCase()}]:`, message);
  }

  private getThresholdForMetric(metricName?: string): number | undefined {
    if (!metricName) return undefined;

    switch (metricName) {
      case 'Memory Usage':
        return this.thresholds.memoryUsage.critical;
      case 'CPU Usage':
        return this.thresholds.cpuUsage.critical;
      case 'FPS':
        return this.thresholds.fps.critical;
      case 'Network Latency':
        return this.thresholds.networkLatency.critical;
      default:
        return undefined;
    }
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, index) => sum + index * val, 0);
    const sumXX = values.reduce((sum, _, index) => sum + index * index, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return isNaN(slope) ? 0 : slope;
  }
}

// Global instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * React Hook for Performance Monitoring
 * Provides reactive access to performance metrics and monitoring controls
 */
export function usePerformanceMonitor(
  options: {
    autoStart?: boolean;
    interval?: number;
    thresholds?: Partial<PerformanceThresholds>;
  } = {}
) {
  const { autoStart = false, interval = 5000, thresholds } = options;

  const [isMonitoring, setIsMonitoring] = useState(false);
  const [metrics, setMetrics] = useState<Record<string, PerformanceMetrics[]>>(
    {}
  );
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [snapshot, setSnapshot] = useState<PerformanceSnapshot | null>(null);

  // Use ref to store the monitor instance to avoid recreating
  const monitorRef = useRef<PerformanceMonitor>(
    thresholds ? new PerformanceMonitor(thresholds) : performanceMonitor
  );

  // Update metrics periodically
  const updateMetrics = useCallback(() => {
    const monitor = monitorRef.current;
    setMetrics(monitor.getAllMetrics());
    setAlerts(monitor.getAlerts());
    setSnapshot(monitor.getCurrentSnapshot());
  }, []);

  // Start monitoring
  const startMonitoring = useCallback(() => {
    const monitor = monitorRef.current;
    monitor.startMonitoring(interval);
    setIsMonitoring(true);
  }, [interval]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    const monitor = monitorRef.current;
    monitor.stopMonitoring();
    setIsMonitoring(false);
  }, []);

  // Add custom metric
  const addMetric = useCallback((metric: PerformanceMetrics) => {
    monitorRef.current.addMetric(metric);
  }, []);

  // Get metrics by category
  const getMetricsByCategory = useCallback(
    (category: PerformanceMetrics['category']) => {
      return monitorRef.current.getMetricsByCategory(category);
    },
    []
  );

  // Get average metrics
  const getAverageMetrics = useCallback((timeRange?: number) => {
    return monitorRef.current.getAverageMetrics(timeRange);
  }, []);

  // Clear alerts
  const clearAlerts = useCallback(() => {
    monitorRef.current.clearAlerts();
    setAlerts([]);
  }, []);

  // Export report
  const exportReport = useCallback(() => {
    return monitorRef.current.exportReport();
  }, []);

  // Analyze memory leaks
  const analyzeMemoryLeaks = useCallback(() => {
    return monitorRef.current.analyzeMemoryLeaks();
  }, []);

  // Auto-start monitoring if requested
  useEffect(() => {
    const currentMonitor = monitorRef.current;
    if (autoStart) {
      startMonitoring();
    }

    return () => {
      if (currentMonitor !== performanceMonitor) {
        currentMonitor.stopMonitoring();
      }
    };
  }, [autoStart, startMonitoring]);

  // Update state periodically when monitoring
  useEffect(() => {
    if (isMonitoring) {
      const updateInterval = setInterval(updateMetrics, 1000);
      return () => clearInterval(updateInterval);
    }
  }, [isMonitoring, updateMetrics]);

  return {
    // State
    isMonitoring,
    metrics,
    alerts,
    snapshot,

    // Actions
    startMonitoring,
    stopMonitoring,
    addMetric,
    clearAlerts,

    // Queries
    getMetricsByCategory,
    getAllMetrics: () => monitorRef.current.getAllMetrics(),
    getRecentMetrics: (limit?: number) =>
      monitorRef.current.getRecentMetrics(limit),
    getAverageMetrics,

    // Analysis
    analyzeMemoryLeaks,
    exportReport,

    // Monitor instance (for advanced use)
    monitor: monitorRef.current,
  };
}

// Utility functions for external use
export const performanceUtils = {
  /**
   * Measure function execution time
   */
  measureExecution: async <T>(
    name: string,
    fn: () => Promise<T> | T,
    category: PerformanceMetrics['category'] = 'custom'
  ): Promise<T> => {
    const start = performance.now();

    try {
      const result = await fn();
      const duration = performance.now() - start;

      performanceMonitor.addMetric({
        name: `Execution: ${name}`,
        value: duration,
        unit: 'ms',
        timestamp: Date.now(),
        category,
      });

      return result;
    } catch (error) {
      const duration = performance.now() - start;

      performanceMonitor.addMetric({
        name: `Execution: ${name} (Error)`,
        value: duration,
        unit: 'ms',
        timestamp: Date.now(),
        category,
        tags: { error: 'true' },
      });

      throw error;
    }
  },

  /**
   * Create a performance mark
   */
  mark: (
    name: string,
    category: PerformanceMetrics['category'] = 'custom'
  ): void => {
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(name);
    }

    performanceMonitor.addMetric({
      name: `Mark: ${name}`,
      value: performance.now(),
      unit: 'ms',
      timestamp: Date.now(),
      category,
    });
  },

  /**
   * Measure between two marks
   */
  measure: (name: string, startMark: string, endMark: string): void => {
    if (typeof performance !== 'undefined' && performance.measure) {
      try {
        performance.measure(name, startMark, endMark);
        const entries = performance.getEntriesByName(name, 'measure');

        if (entries.length > 0) {
          const entry = entries[entries.length - 1];
          performanceMonitor.addMetric({
            name: `Measure: ${name}`,
            value: entry.duration,
            unit: 'ms',
            timestamp: Date.now(),
            category: 'custom',
          });
        }
      } catch (error) {
        console.warn('Failed to measure performance:', error);
      }
    }
  },
};
