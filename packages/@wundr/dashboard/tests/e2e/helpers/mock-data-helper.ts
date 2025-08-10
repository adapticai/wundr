import { Page } from '@playwright/test';

export class MockDataHelper {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async setupMockApiResponses() {
    // Mock all API routes with realistic data
    await this.page.route('**/api/metrics**', async route => {
      const metrics = this.generateMockMetrics();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(metrics)
      });
    });

    await this.page.route('**/api/projects**', async route => {
      const projects = this.generateMockProjects();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(projects)
      });
    });

    await this.page.route('**/api/analysis**', async route => {
      const analysis = this.generateMockAnalysis();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(analysis)
      });
    });

    await this.page.route('**/api/dependencies**', async route => {
      const dependencies = this.generateMockDependencies();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(dependencies)
      });
    });

    await this.page.route('**/api/performance**', async route => {
      const performance = this.generateMockPerformanceData();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(performance)
      });
    });

    await this.page.route('**/api/activity**', async route => {
      const activity = this.generateMockActivity();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(activity)
      });
    });
  }

  async setupErrorScenarios() {
    await this.page.route('**/api/metrics**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error', code: 'METRICS_ERROR' })
      });
    });
  }

  async setupSlowApiResponses(delay: number = 3000) {
    await this.page.route('**/api/**', async route => {
      await new Promise(resolve => setTimeout(resolve, delay));
      await route.continue();
    });
  }

  generateMockMetrics() {
    return {
      success: true,
      data: {
        overview: {
          totalProjects: 12,
          activeProjects: 8,
          totalTests: 2456,
          testCoverage: 87.3,
          buildSuccessRate: 94.2,
          avgBuildTime: 142
        },
        realtime: {
          cpu: Math.floor(Math.random() * 100),
          memory: Math.floor(Math.random() * 100),
          disk: Math.floor(Math.random() * 100),
          network: Math.floor(Math.random() * 50),
          activeConnections: Math.floor(Math.random() * 200),
          timestamp: new Date().toISOString()
        },
        trends: this.generateTrendData()
      },
      timestamp: new Date().toISOString()
    };
  }

  generateMockProjects() {
    const projects = [];
    const projectNames = ['Dashboard', 'API Gateway', 'User Service', 'Analytics Engine', 'CLI Tools', 'Mobile App'];
    const statuses = ['active', 'maintenance', 'deprecated'];
    const technologies = ['React', 'Node.js', 'Python', 'Go', 'TypeScript', 'Rust'];

    for (let i = 0; i < 6; i++) {
      projects.push({
        id: `project_${i + 1}`,
        name: projectNames[i],
        status: statuses[Math.floor(Math.random() * statuses.length)],
        technology: technologies[Math.floor(Math.random() * technologies.length)],
        coverage: 60 + Math.floor(Math.random() * 40),
        tests: 100 + Math.floor(Math.random() * 500),
        lastUpdate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        health: Math.floor(Math.random() * 100),
        dependencies: Math.floor(Math.random() * 50),
        vulnerabilities: Math.floor(Math.random() * 5)
      });
    }

    return { success: true, data: projects };
  }

  generateMockAnalysis() {
    return {
      success: true,
      data: {
        codeQuality: {
          overall: 85.2,
          maintainability: 88.1,
          reliability: 82.3,
          security: 89.7,
          coverage: 87.3
        },
        complexity: {
          cyclomaticComplexity: 12.4,
          cognitiveComplexity: 15.2,
          linesOfCode: 45230,
          technicalDebt: 8.2
        },
        issues: [
          {
            severity: 'high',
            type: 'security',
            message: 'Potential XSS vulnerability in user input handling',
            file: 'src/components/UserInput.tsx',
            line: 42
          },
          {
            severity: 'medium',
            type: 'maintainability',
            message: 'Function complexity exceeds threshold',
            file: 'src/utils/dataProcessor.ts',
            line: 156
          }
        ],
        trends: {
          qualityTrend: 'improving',
          coverageTrend: 'stable',
          complexityTrend: 'degrading'
        }
      }
    };
  }

  generateMockDependencies() {
    const dependencies: any[] = [];
    const packages = [
      'react', 'next', 'typescript', 'playwright', 'jest', 'webpack',
      'lodash', 'moment', 'axios', 'express', 'mongoose', 'd3'
    ];

    packages.forEach((pkg, index) => {
      dependencies.push({
        name: pkg,
        version: `${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`,
        latestVersion: `${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 10) + 1}.${Math.floor(Math.random() * 10)}`,
        outdated: Math.random() > 0.7,
        vulnerabilities: Math.random() > 0.8 ? Math.floor(Math.random() * 3) + 1 : 0,
        size: Math.floor(Math.random() * 1000) + 100,
        type: Math.random() > 0.5 ? 'production' : 'development'
      });
    });

    return {
      success: true,
      data: {
        total: dependencies.length,
        outdated: dependencies.filter(d => d.outdated).length,
        vulnerabilities: dependencies.reduce((sum, d) => sum + d.vulnerabilities, 0),
        totalSize: dependencies.reduce((sum, d) => sum + d.size, 0),
        dependencies
      }
    };
  }

  generateMockPerformanceData() {
    const days = 30;
    const performanceData = [];

    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      performanceData.push({
        date: date.toISOString().split('T')[0],
        buildTime: 120 + Math.floor(Math.random() * 60),
        testTime: 45 + Math.floor(Math.random() * 30),
        deployTime: 180 + Math.floor(Math.random() * 120),
        bundleSize: 2.5 + Math.random() * 0.5,
        pageLoadTime: 1.2 + Math.random() * 0.8,
        memoryUsage: 40 + Math.random() * 20,
        cpuUsage: 30 + Math.random() * 40
      });
    }

    return {
      success: true,
      data: {
        current: performanceData[performanceData.length - 1],
        history: performanceData,
        thresholds: {
          buildTime: 300,
          testTime: 120,
          deployTime: 600,
          bundleSize: 5.0,
          pageLoadTime: 3.0,
          memoryUsage: 80,
          cpuUsage: 80
        }
      }
    };
  }

  generateMockActivity() {
    const activities = [];
    const types = ['build', 'test', 'deploy', 'commit', 'merge', 'release'];
    const statuses = ['success', 'failed', 'pending', 'cancelled'];
    const authors = ['Alice Johnson', 'Bob Smith', 'Carol Davis', 'David Wilson', 'Eve Brown'];

    for (let i = 0; i < 20; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      activities.push({
        id: `activity_${i + 1}`,
        type,
        status,
        message: this.getActivityMessage(type, status),
        author: authors[Math.floor(Math.random() * authors.length)],
        timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
        duration: Math.floor(Math.random() * 300) + 30,
        project: `Project ${Math.floor(Math.random() * 5) + 1}`,
        branch: Math.random() > 0.5 ? 'main' : `feature/branch-${Math.floor(Math.random() * 100)}`
      });
    }

    return {
      success: true,
      data: activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    };
  }

  private getActivityMessage(type: string, status: string): string {
    const messages: Record<string, Record<string, string[]>> = {
      build: {
        success: ['Build completed successfully', 'All tests passed', 'Build artifacts generated'],
        failed: ['Build failed due to compilation errors', 'Tests failed', 'Linting issues found'],
        pending: ['Build in progress', 'Running tests', 'Compiling sources'],
        cancelled: ['Build cancelled by user', 'Build timeout', 'Build stopped']
      },
      test: {
        success: ['All tests passed', 'Test coverage improved', 'No test failures'],
        failed: ['Unit tests failed', 'Integration tests failed', 'E2E tests failed'],
        pending: ['Running test suite', 'Executing tests', 'Test in progress'],
        cancelled: ['Tests cancelled', 'Test run stopped', 'Test timeout']
      },
      deploy: {
        success: ['Deployed to production', 'Staging deployment successful', 'Hot fix deployed'],
        failed: ['Deployment failed', 'Rollback initiated', 'Health check failed'],
        pending: ['Deployment in progress', 'Preparing deployment', 'Running pre-deploy checks'],
        cancelled: ['Deployment cancelled', 'Rollback completed', 'Deploy stopped']
      }
    };

    const typeMessages = messages[type] || messages.build;
    const statusMessages = typeMessages[status] || typeMessages.success;
    return statusMessages[Math.floor(Math.random() * statusMessages.length)];
  }

  private generateTrendData() {
    const days = 30;
    const trends = [];

    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      trends.push({
        date: date.toISOString().split('T')[0],
        builds: Math.floor(Math.random() * 20) + 5,
        tests: Math.floor(Math.random() * 50) + 20,
        deployments: Math.floor(Math.random() * 5) + 1,
        coverage: 70 + Math.random() * 30,
        quality: 60 + Math.random() * 40,
        performance: 50 + Math.random() * 50
      });
    }

    return trends;
  }

  async injectTestDataAttributes() {
    await this.page.addInitScript(() => {
      // Add test data attributes to DOM elements for easier testing
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === 1) { // Element node
                const element = node as Element;
                
                // Add test IDs based on component patterns
                if (element.querySelector('.metric-card') || element.classList.contains('metric-card')) {
                  element.setAttribute('data-testid', 'metric-card');
                }
                
                if (element.querySelector('.chart-container') || element.classList.contains('chart-container')) {
                  element.setAttribute('data-testid', 'chart-container');
                }
                
                if (element.querySelector('.activity-item') || element.classList.contains('activity-item')) {
                  element.setAttribute('data-testid', 'activity-item');
                }
              }
            });
          }
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    });
  }

  async waitForDataLoad() {
    // Wait for all API calls to complete
    await this.page.waitForLoadState('networkidle');
    
    // Wait for common loading indicators to disappear
    await this.page.waitForSelector('[data-testid="loading"]', { state: 'hidden', timeout: 10000 }).catch(() => {});
    await this.page.waitForSelector('.loading', { state: 'hidden', timeout: 10000 }).catch(() => {});
    await this.page.waitForSelector('[data-loading="true"]', { state: 'hidden', timeout: 10000 }).catch(() => {});
  }
}