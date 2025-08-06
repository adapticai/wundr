/**
 * Custom Analytics Plugin for Wundr Dashboard
 * Example plugin showing advanced integration capabilities
 */

const fs = require('fs').promises;
const path = require('path');

class CustomAnalyticsPlugin {
  constructor() {
    this.data = new Map();
    this.config = {};
    this.logger = null;
    this.api = null;
  }

  /**
   * Plugin initialization
   */
  async initialize(context) {
    const { api, logger, config, hooks } = context;
    
    this.api = api;
    this.logger = logger;
    this.config = config;
    
    this.logger.info('Custom Analytics Plugin initializing...');
    
    // Register menu items
    api.addMenuItem({
      id: 'custom-analytics',
      label: 'Custom Analytics',
      path: '/custom-analytics',
      icon: 'chart-line',
      group: 'analytics',
      order: 100
    });
    
    api.addMenuItem({
      id: 'performance-trends',
      label: 'Performance Trends',
      path: '/performance-trends',
      icon: 'trending-up',
      group: 'analytics',
      order: 101
    });
    
    // Register API routes
    api.addRoute('/api/custom-metrics', this.customMetricsApi.bind(this));
    
    // Register hooks
    hooks.afterAnalysis(this.onAnalysisComplete.bind(this));
    hooks.onConfigChange(this.onConfigChange.bind(this));
    
    // Load historical data
    await this.loadHistoricalData();
    
    // Start periodic sync if enabled
    if (config.enableExternalSync) {
      this.startPeriodicSync();
    }
    
    this.logger.info('Custom Analytics Plugin initialized successfully');
  }

  /**
   * Hook: After analysis completion
   */
  async onAnalysisComplete(data) {
    this.logger.info('Processing analysis results for custom analytics');
    
    try {
      // Calculate custom metrics
      const customMetrics = await this.calculateCustomMetrics(data);
      
      // Store metrics
      await this.storeMetrics(customMetrics);
      
      // Update trends
      await this.updateTrends(customMetrics);
      
      // Sync with external service if configured
      if (this.config.enableExternalSync) {
        await this.syncWithExternalService(customMetrics);
      }
      
      this.logger.info('Custom analytics processing completed');
      
    } catch (error) {
      this.logger.error('Failed to process custom analytics:', error);
    }
    
    return data; // Pass through original data
  }

  /**
   * Hook: Configuration change
   */
  async onConfigChange(config) {
    this.logger.info('Configuration changed, updating plugin settings');
    this.config = { ...this.config, ...config };
    
    if (config.enableExternalSync && !this.syncInterval) {
      this.startPeriodicSync();
    } else if (!config.enableExternalSync && this.syncInterval) {
      this.stopPeriodicSync();
    }
  }

  /**
   * Calculate custom metrics from analysis data
   */
  async calculateCustomMetrics(analysisData) {
    const metrics = {
      timestamp: new Date().toISOString(),
      codeComplexity: this.calculateComplexityScore(analysisData),
      testCoverage: this.calculateTestCoverage(analysisData),
      technicalDebt: this.calculateTechnicalDebt(analysisData),
      maintainabilityIndex: this.calculateMaintainabilityIndex(analysisData),
      performanceScore: await this.calculatePerformanceScore(analysisData),
    };
    
    // Add custom business metrics
    metrics.businessMetrics = {
      featureVelocity: await this.calculateFeatureVelocity(),
      bugDensity: this.calculateBugDensity(analysisData),
      refactoringOpportunities: this.identifyRefactoringOpportunities(analysisData),
    };
    
    return metrics;
  }

  /**
   * Store metrics for historical tracking
   */
  async storeMetrics(metrics) {
    const dataDir = path.join(process.cwd(), 'wundr-dashboard/data');
    const metricsFile = path.join(dataDir, 'custom-metrics.json');
    
    try {
      // Ensure directory exists
      await fs.mkdir(dataDir, { recursive: true });
      
      // Load existing metrics
      let historicalMetrics = [];
      try {
        const existing = await fs.readFile(metricsFile, 'utf-8');
        historicalMetrics = JSON.parse(existing);
      } catch (error) {
        // File doesn't exist yet, start fresh
      }
      
      // Add new metrics
      historicalMetrics.push(metrics);
      
      // Keep only last 100 entries
      if (historicalMetrics.length > 100) {
        historicalMetrics = historicalMetrics.slice(-100);
      }
      
      // Save updated metrics
      await fs.writeFile(metricsFile, JSON.stringify(historicalMetrics, null, 2));
      
      this.logger.debug('Custom metrics stored successfully');
      
    } catch (error) {
      this.logger.error('Failed to store custom metrics:', error);
    }
  }

  /**
   * Update trend analysis
   */
  async updateTrends(currentMetrics) {
    const trends = {
      complexity: this.calculateTrend('codeComplexity', currentMetrics.codeComplexity),
      coverage: this.calculateTrend('testCoverage', currentMetrics.testCoverage),
      debt: this.calculateTrend('technicalDebt', currentMetrics.technicalDebt),
      maintainability: this.calculateTrend('maintainabilityIndex', currentMetrics.maintainabilityIndex),
    };
    
    // Store trends
    this.data.set('trends', trends);
    
    this.logger.debug('Trends updated:', trends);
  }

  /**
   * Sync with external analytics service
   */
  async syncWithExternalService(metrics) {
    const externalUrl = process.env.ANALYTICS_API_URL;
    const apiKey = process.env.ANALYTICS_API_KEY;
    
    if (!externalUrl || !apiKey) {
      this.logger.warn('External analytics service not configured');
      return;
    }
    
    try {
      const response = await fetch(externalUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'X-Source': 'wundr-dashboard'
        },
        body: JSON.stringify({
          project: this.config.projectName || 'unknown',
          metrics,
          timestamp: new Date().toISOString()
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      this.logger.info('Successfully synced with external analytics service');
      
    } catch (error) {
      this.logger.error('Failed to sync with external service:', error);
    }
  }

  /**
   * API endpoint for custom metrics
   */
  async customMetricsApi(req, res) {
    try {
      const { timeframe = '7d', metric } = req.query;
      
      // Load historical data
      const dataFile = path.join(process.cwd(), 'wundr-dashboard/data/custom-metrics.json');
      let metrics = [];
      
      try {
        const data = await fs.readFile(dataFile, 'utf-8');
        metrics = JSON.parse(data);
      } catch (error) {
        // No data available yet
      }
      
      // Filter by timeframe
      const cutoff = this.getTimeframeCutoff(timeframe);
      const filteredMetrics = metrics.filter(m => new Date(m.timestamp) >= cutoff);
      
      // Filter by specific metric if requested
      if (metric) {
        const result = filteredMetrics.map(m => ({
          timestamp: m.timestamp,
          value: this.getNestedValue(m, metric)
        }));
        return res.json(result);
      }
      
      // Return all metrics
      res.json(filteredMetrics);
      
    } catch (error) {
      this.logger.error('Custom metrics API error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * React component for custom analytics page
   */
  component({ data, config }) {
    const trends = this.data.get('trends') || {};
    
    return React.createElement('div', { className: 'custom-analytics-page' }, [
      React.createElement('h1', { key: 'title' }, 'Custom Analytics'),
      
      // Metrics cards
      React.createElement('div', { key: 'metrics', className: 'metrics-grid' }, [
        this.createMetricCard('Code Complexity', trends.complexity),
        this.createMetricCard('Test Coverage', trends.coverage),
        this.createMetricCard('Technical Debt', trends.debt),
        this.createMetricCard('Maintainability', trends.maintainability),
      ]),
      
      // Charts
      React.createElement('div', { key: 'charts', className: 'charts-section' }, [
        React.createElement('h2', null, 'Trends'),
        React.createElement('div', { id: 'complexity-chart' }),
        React.createElement('div', { id: 'coverage-chart' }),
      ]),
      
      // Business metrics
      React.createElement('div', { key: 'business', className: 'business-metrics' }, [
        React.createElement('h2', null, 'Business Metrics'),
        React.createElement('div', { className: 'business-grid' }, [
          React.createElement('div', null, `Feature Velocity: ${data.featureVelocity || 'N/A'}`),
          React.createElement('div', null, `Bug Density: ${data.bugDensity || 'N/A'}`),
        ])
      ])
    ]);
  }

  /**
   * Helper methods
   */
  createMetricCard(title, trend) {
    const trendClass = trend?.direction === 'up' ? 'trend-up' : 
                      trend?.direction === 'down' ? 'trend-down' : 'trend-stable';
    
    return React.createElement('div', { className: 'metric-card' }, [
      React.createElement('h3', null, title),
      React.createElement('div', { className: `trend ${trendClass}` }, 
        `${trend?.value || 'N/A'} (${trend?.change || '0%'})`
      )
    ]);
  }

  calculateComplexityScore(data) {
    // Custom complexity calculation logic
    const files = data.files || [];
    const totalComplexity = files.reduce((sum, file) => sum + (file.complexity || 0), 0);
    return files.length > 0 ? totalComplexity / files.length : 0;
  }

  calculateTestCoverage(data) {
    // Calculate test coverage from analysis data
    return data.coverage?.percentage || 0;
  }

  calculateTechnicalDebt(data) {
    // Calculate technical debt score
    const issues = data.issues || [];
    const debtIssues = issues.filter(issue => issue.category === 'debt');
    return debtIssues.length;
  }

  calculateMaintainabilityIndex(data) {
    // Microsoft Maintainability Index calculation (simplified)
    const complexity = this.calculateComplexityScore(data);
    const linesOfCode = data.totalLines || 1;
    const coverage = this.calculateTestCoverage(data);
    
    // Simplified formula
    return Math.max(0, 171 - 5.2 * Math.log(linesOfCode) - 0.23 * complexity + 16.2 * Math.log(coverage + 1));
  }

  async calculatePerformanceScore(data) {
    // Custom performance scoring logic
    // Could integrate with lighthouse, web vitals, etc.
    return Math.random() * 100; // Placeholder
  }

  async calculateFeatureVelocity() {
    // Calculate feature delivery velocity
    // Could integrate with git commits, PR data, etc.
    return '3.2 features/sprint'; // Placeholder
  }

  calculateBugDensity(data) {
    const bugs = (data.issues || []).filter(issue => issue.severity === 'bug');
    const linesOfCode = data.totalLines || 1;
    return (bugs.length / linesOfCode * 1000).toFixed(2); // Bugs per 1000 lines
  }

  identifyRefactoringOpportunities(data) {
    // Identify code that needs refactoring
    const opportunities = [];
    
    (data.files || []).forEach(file => {
      if (file.complexity > 10) {
        opportunities.push({
          file: file.path,
          reason: 'High complexity',
          priority: 'high'
        });
      }
      if (file.duplicateLines > 20) {
        opportunities.push({
          file: file.path,
          reason: 'Code duplication',
          priority: 'medium'
        });
      }
    });
    
    return opportunities;
  }

  calculateTrend(metric, currentValue) {
    // Calculate trend based on historical data
    const historical = this.data.get('historical') || [];
    if (historical.length < 2) {
      return { value: currentValue, change: '0%', direction: 'stable' };
    }
    
    const previous = historical[historical.length - 2][metric];
    const change = ((currentValue - previous) / previous * 100).toFixed(1);
    const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';
    
    return {
      value: currentValue,
      change: `${change}%`,
      direction
    };
  }

  async loadHistoricalData() {
    try {
      const dataFile = path.join(process.cwd(), 'wundr-dashboard/data/custom-metrics.json');
      const data = await fs.readFile(dataFile, 'utf-8');
      this.data.set('historical', JSON.parse(data));
    } catch (error) {
      // No historical data available
      this.data.set('historical', []);
    }
  }

  startPeriodicSync() {
    if (this.syncInterval) return;
    
    const interval = this.config.refreshInterval || 30000;
    this.syncInterval = setInterval(() => {
      this.logger.debug('Running periodic sync...');
      // Could trigger re-analysis or data refresh
    }, interval);
  }

  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  getTimeframeCutoff(timeframe) {
    const now = new Date();
    switch (timeframe) {
      case '24h': return new Date(now - 24 * 60 * 60 * 1000);
      case '7d': return new Date(now - 7 * 24 * 60 * 60 * 1000);
      case '30d': return new Date(now - 30 * 24 * 60 * 60 * 1000);
      default: return new Date(0);
    }
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Cleanup when plugin is unloaded
   */
  async cleanup() {
    this.logger.info('Custom Analytics Plugin cleaning up...');
    
    this.stopPeriodicSync();
    this.data.clear();
    
    this.logger.info('Custom Analytics Plugin cleanup completed');
  }
}

// Export plugin instance
module.exports = new CustomAnalyticsPlugin();