import { Page, CDPSession } from '@playwright/test';

export class PerformanceHelper {
  readonly page: Page;
  private cdpSession: CDPSession | null = null;

  constructor(page: Page) {
    this.page = page;
  }

  async startPerformanceMonitoring() {
    this.cdpSession = await this.page.context().newCDPSession(this.page);
    await this.cdpSession.send('Performance.enable');
    await this.cdpSession.send('Runtime.enable');
    await this.cdpSession.send('HeapProfiler.enable');
  }

  async stopPerformanceMonitoring() {
    if (this.cdpSession) {
      await this.cdpSession.send('Performance.disable');
      await this.cdpSession.send('Runtime.disable');
      await this.cdpSession.send('HeapProfiler.disable');
      await this.cdpSession.detach();
      this.cdpSession = null;
    }
  }

  async measurePageLoadPerformance() {
    const navigationPromise = this.page.waitForLoadState('networkidle');
    const startTime = Date.now();
    
    await this.page.goto('/dashboard');
    await navigationPromise;
    
    const endTime = Date.now();
    const loadTime = endTime - startTime;

    // Get performance metrics from Navigation Timing API
    const performanceMetrics = await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (!navigation) return null;

      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        domInteractive: navigation.domInteractive - navigation.fetchStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
        largestContentfulPaint: 0, // Will be populated by LCP observer
        cumulativeLayoutShift: 0,  // Will be populated by CLS observer
        firstInputDelay: 0,        // Will be populated by FID observer
      };
    });

    return {
      totalLoadTime: loadTime,
      ...performanceMetrics
    };
  }

  async measureWebSocketPerformance() {
    let messageCount = 0;
    let totalLatency = 0;
    let maxLatency = 0;
    let minLatency = Infinity;

    await this.page.evaluate(() => {
      (window as any).__webSocketMetrics = {
        messagesSent: 0,
        messagesReceived: 0,
        latencies: []
      };

      const originalWebSocket = window.WebSocket;
      window.WebSocket = class extends originalWebSocket {
        constructor(...args: ConstructorParameters<typeof originalWebSocket>) {
          super(...args);
          
          this.addEventListener('message', (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.timestamp) {
                const latency = Date.now() - new Date(data.timestamp).getTime();
                (window as any).__webSocketMetrics.latencies.push(latency);
                (window as any).__webSocketMetrics.messagesReceived++;
              }
            } catch (e) {
              // Ignore parse errors
            }
          });

          const originalSend = this.send;
          this.send = function(data: string) {
            (window as any).__webSocketMetrics.messagesSent++;
            return originalSend.call(this, data);
          };
        }
      };
    });

    // Wait for some WebSocket activity
    await this.page.waitForTimeout(5000);

    const metrics = await this.page.evaluate(() => {
      const metrics = (window as any).__webSocketMetrics;
      if (!metrics || metrics.latencies.length === 0) {
        return { averageLatency: 0, maxLatency: 0, minLatency: 0, messageCount: 0 };
      }

      const latencies = metrics.latencies;
      const sum = latencies.reduce((a: number, b: number) => a + b, 0);
      
      return {
        averageLatency: sum / latencies.length,
        maxLatency: Math.max(...latencies),
        minLatency: Math.min(...latencies),
        messageCount: latencies.length,
        messagesSent: metrics.messagesSent,
        messagesReceived: metrics.messagesReceived
      };
    });

    return metrics;
  }

  async measureChartRenderPerformance() {
    const startTime = Date.now();
    
    // Wait for chart to be visible
    await this.page.locator('[data-testid="overview-chart"]').waitFor();
    
    // Measure chart rendering time
    const renderTime = await this.page.evaluate(() => {
      const chart = document.querySelector('[data-testid="overview-chart"]');
      if (!chart) return 0;

      const startTime = performance.now();
      
      // Trigger a chart update/redraw
      const event = new CustomEvent('resize');
      window.dispatchEvent(event);
      
      return performance.now() - startTime;
    });

    const endTime = Date.now();
    
    return {
      totalTime: endTime - startTime,
      renderTime: renderTime,
      fps: await this.measureFPS()
    };
  }

  async measureFPS() {
    return await this.page.evaluate(async () => {
      return new Promise<number>((resolve) => {
        let frames = 0;
        const startTime = performance.now();
        
        function countFrame() {
          frames++;
          if (performance.now() - startTime < 1000) {
            requestAnimationFrame(countFrame);
          } else {
            resolve(frames);
          }
        }
        
        requestAnimationFrame(countFrame);
      });
    });
  }

  async measureMemoryUsage() {
    if (!this.cdpSession) {
      await this.startPerformanceMonitoring();
    }

    const heapUsage = await this.cdpSession!.send('Runtime.getHeapUsage');
    const performanceMetrics = await this.cdpSession!.send('Performance.getMetrics');
    
    const jsHeapUsedSize = performanceMetrics.metrics.find(
      (metric: any) => metric.name === 'JSHeapUsedSize'
    )?.value || 0;

    const jsHeapTotalSize = performanceMetrics.metrics.find(
      (metric: any) => metric.name === 'JSHeapTotalSize'
    )?.value || 0;

    return {
      used: heapUsage.usedSize,
      total: heapUsage.totalSize,
      jsHeapUsed: jsHeapUsedSize,
      jsHeapTotal: jsHeapTotalSize,
      memoryUsagePercentage: jsHeapTotalSize > 0 ? (jsHeapUsedSize / jsHeapTotalSize) * 100 : 0
    };
  }

  async measureNetworkPerformance() {
    const responses: any[] = [];
    
    this.page.on('response', response => {
      responses.push({
        url: response.url(),
        status: response.status(),
        size: response.headers()['content-length'] || 0,
        timing: null, // response.timing() not available in Playwright
        contentType: response.headers()['content-type'] || ''
      });
    });

    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');

    const totalSize = responses.reduce((sum, res) => sum + parseInt(res.size) || 0, 0);
    const avgResponseTime = responses.reduce((sum, res) => 
      sum + (res.timing?.responseEnd - res.timing?.requestStart || 0), 0
    ) / responses.length;

    return {
      totalRequests: responses.length,
      totalSize: totalSize,
      averageResponseTime: avgResponseTime,
      responses: responses.map(r => ({
        url: r.url,
        status: r.status,
        size: r.size,
        responseTime: r.timing?.responseEnd - r.timing?.requestStart || 0
      }))
    };
  }

  async startContinuousMonitoring(duration: number = 30000) {
    const metrics: any[] = [];
    const startTime = Date.now();
    
    const interval = setInterval(async () => {
      const currentTime = Date.now();
      if (currentTime - startTime > duration) {
        clearInterval(interval);
        return;
      }

      try {
        const memory = await this.measureMemoryUsage();
        const fps = await this.measureFPS();
        
        metrics.push({
          timestamp: currentTime,
          memory,
          fps,
          elapsed: currentTime - startTime
        });
      } catch (error) {
        console.warn('Error collecting performance metrics:', error);
      }
    }, 1000);

    return new Promise<any[]>((resolve) => {
      setTimeout(() => {
        clearInterval(interval);
        resolve(metrics);
      }, duration);
    });
  }

  async generatePerformanceReport(testName: string, metrics: any) {
    const report = {
      testName,
      timestamp: new Date().toISOString(),
      metrics,
      summary: {
        passed: true,
        issues: []
      }
    };

    // Define performance thresholds
    const thresholds = {
      pageLoadTime: 3000,     // 3 seconds
      memoryUsage: 50,        // 50MB
      fps: 30,                // 30 FPS
      chartRenderTime: 500,   // 500ms
      wsLatency: 200          // 200ms
    };

    // Check against thresholds
    if (metrics.totalLoadTime > thresholds.pageLoadTime) {
      report.summary.passed = false;
      (report.summary.issues as string[]).push(`Page load time ${metrics.totalLoadTime}ms exceeds threshold ${thresholds.pageLoadTime}ms`);
    }

    if (metrics.memory && metrics.memory.used > thresholds.memoryUsage * 1024 * 1024) {
      report.summary.passed = false;
      (report.summary.issues as string[]).push(`Memory usage ${Math.round(metrics.memory.used / 1024 / 1024)}MB exceeds threshold ${thresholds.memoryUsage}MB`);
    }

    if (metrics.fps && metrics.fps < thresholds.fps) {
      report.summary.passed = false;
      (report.summary.issues as string[]).push(`FPS ${metrics.fps} below threshold ${thresholds.fps}`);
    }

    return report;
  }

  async runPerformanceBenchmark() {
    await this.startPerformanceMonitoring();
    
    const pageLoad = await this.measurePageLoadPerformance();
    const wsPerformance = await this.measureWebSocketPerformance();
    const chartPerformance = await this.measureChartRenderPerformance();
    const memory = await this.measureMemoryUsage();
    const network = await this.measureNetworkPerformance();

    await this.stopPerformanceMonitoring();

    return {
      pageLoad,
      websocket: wsPerformance,
      chart: chartPerformance,
      memory,
      network,
      timestamp: new Date().toISOString()
    };
  }
}