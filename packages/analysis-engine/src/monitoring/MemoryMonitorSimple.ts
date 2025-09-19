/**
 * @fileoverview Simplified Memory Monitor for immediate functionality
 * Basic memory monitoring with proper TypeScript types
 */

import { EventEmitter } from 'events';
import * as path from 'path';

import * as fs from 'fs-extra';

export interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
  arrayBuffers: number;
}

export interface MemoryMetrics {
  data: MemorySnapshot;
  peak: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
    timestamp: number;
  };
  average: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
  };
  leakAnalysis: {
    detected: boolean;
    growthRate: number;
    leakDetected: boolean;
    severity: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface MonitorConfig {
  snapshotInterval: number;
  maxSnapshots: number;
  outputDir: string;
  thresholds: {
    heapWarning: number;
    heapCritical: number;
    growthRateWarning: number;
    growthRateCritical: number;
  };
}

/**
 * Simplified memory monitoring
 */
export class MemoryMonitor extends EventEmitter {
  private config: MonitorConfig;
  private snapshots: MemorySnapshot[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  constructor(config: Partial<MonitorConfig>) {
    super();
    
    this.config = {
      snapshotInterval: 5000,
      maxSnapshots: 720,
      outputDir: './memory-profiles',
      thresholds: {
        heapWarning: 256 * 1024 * 1024,
        heapCritical: 512 * 1024 * 1024,
        growthRateWarning: 10 * 1024 * 1024,
        growthRateCritical: 50 * 1024 * 1024,
      },
      ...config,
    };
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
return;
}

    this.isMonitoring = true;
    this.snapshots = [];

    await fs.ensureDir(this.config.outputDir);

    this.monitoringInterval = setInterval(() => {
      this.takeSnapshot();
    }, this.config.snapshotInterval);

    this.takeSnapshot();
    this.emit('monitoring-started');
  }

  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
return;
}

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.takeSnapshot();
    this.emit('monitoring-stopped');
  }

  private takeSnapshot(): void {
    const memory = process.memoryUsage();
    
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
      rss: memory.rss,
      external: memory.external,
      arrayBuffers: memory.arrayBuffers,
    };

    this.snapshots.push(snapshot);

    if (this.snapshots.length > this.config.maxSnapshots) {
      this.snapshots.shift();
    }

    this.checkThresholds(snapshot);
    this.emit('snapshot-taken', snapshot);
  }

  private checkThresholds(snapshot: MemorySnapshot): void {
    if (snapshot.heapUsed > this.config.thresholds.heapCritical) {
      this.emit('memory-alert', {
        type: 'heap-critical',
        severity: 'critical',
        current: snapshot.heapUsed,
        threshold: this.config.thresholds.heapCritical,
      });
    } else if (snapshot.heapUsed > this.config.thresholds.heapWarning) {
      this.emit('memory-alert', {
        type: 'heap-warning',
        severity: 'warning',
        current: snapshot.heapUsed,
        threshold: this.config.thresholds.heapWarning,
      });
    }
  }

  getSnapshot(): MemorySnapshot | null {
    const lastSnapshot = this.snapshots[this.snapshots.length - 1];
    return lastSnapshot || null;
  }

  getMetrics(): MemoryMetrics {
    if (this.snapshots.length === 0) {
      const currentMemory = process.memoryUsage();
      return {
        data: {
          timestamp: Date.now(),
          ...currentMemory,
        },
        peak: {
          heapUsed: currentMemory.heapUsed,
          heapTotal: currentMemory.heapTotal,
          rss: currentMemory.rss,
          external: currentMemory.external,
          timestamp: Date.now(),
        },
        average: {
          heapUsed: currentMemory.heapUsed,
          heapTotal: currentMemory.heapTotal,
          rss: currentMemory.rss,
          external: currentMemory.external,
        },
        leakAnalysis: {
          detected: false,
          growthRate: 0,
          leakDetected: false,
          severity: 'low',
        },
      };
    }

    const latest = this.snapshots[this.snapshots.length - 1]!;
    
    const peak = this.snapshots.reduce((p, s) => ({
      heapUsed: Math.max(p.heapUsed, s.heapUsed),
      heapTotal: Math.max(p.heapTotal, s.heapTotal),
      rss: Math.max(p.rss, s.rss),
      external: Math.max(p.external, s.external),
      timestamp: s.heapUsed > p.heapUsed ? s.timestamp : p.timestamp,
    }), {
      heapUsed: 0,
      heapTotal: 0,
      rss: 0,
      external: 0,
      timestamp: 0,
    });

    const average = this.snapshots.reduce((sum, s) => ({
      heapUsed: sum.heapUsed + s.heapUsed,
      heapTotal: sum.heapTotal + s.heapTotal,
      rss: sum.rss + s.rss,
      external: sum.external + s.external,
    }), { heapUsed: 0, heapTotal: 0, rss: 0, external: 0 });

    const count = this.snapshots.length;
    average.heapUsed /= count;
    average.heapTotal /= count;
    average.rss /= count;
    average.external /= count;

    return {
      data: latest,
      peak,
      average,
      leakAnalysis: {
        detected: false,
        growthRate: 0,
        leakDetected: false,
        severity: 'low',
      },
    };
  }

  async exportData(format: 'json' = 'json'): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `memory-profile-${timestamp}.${format}`;
    const filepath = path.join(this.config.outputDir, filename);

    await fs.ensureDir(this.config.outputDir);

    const data = {
      config: this.config,
      metrics: this.getMetrics(),
      snapshots: this.snapshots,
    };
    
    await fs.writeJSON(filepath, data, { spaces: 2 });
    return filepath;
  }

  async cleanup(): Promise<void> {
    await this.stopMonitoring();
    this.snapshots = [];
  }
}