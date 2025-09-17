#!/usr/bin/env node
/**
 * Build Validation System
 * Continuous build monitoring and regression detection
 */

const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class BuildValidator {
  constructor() {
    this.logFile = path.join(__dirname, '../logs/build-validation.log');
    this.metricsFile = path.join(__dirname, '../logs/build-metrics.json');
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}\n`;

    console.log(`${level}: ${message}`);
    fs.appendFileSync(this.logFile, logEntry);
  }

  async runBuild() {
    this.log('🔧 Starting build validation...', 'INFO');
    const startTime = Date.now();

    try {
      // Run the build with output capture
      this.log('Executing: pnpm build', 'DEBUG');

      const buildOutput = execSync('pnpm build', {
        cwd: path.join(__dirname, '..'),
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const buildTime = Date.now() - startTime;
      this.log(`✅ Build completed successfully in ${buildTime}ms`, 'SUCCESS');

      // Record metrics
      this.recordBuildMetrics({
        timestamp: new Date().toISOString(),
        success: true,
        buildTime,
        output: buildOutput.length,
        errors: 0
      });

      return { success: true, buildTime, output: buildOutput };

    } catch (error) {
      const buildTime = Date.now() - startTime;
      this.log(`❌ Build failed after ${buildTime}ms`, 'ERROR');
      this.log(`Error: ${error.message}`, 'ERROR');

      // Record failure metrics
      this.recordBuildMetrics({
        timestamp: new Date().toISOString(),
        success: false,
        buildTime,
        error: error.message,
        errors: 1
      });

      return { success: false, buildTime, error: error.message };
    }
  }

  recordBuildMetrics(metrics) {
    let existingMetrics = [];

    if (fs.existsSync(this.metricsFile)) {
      try {
        const content = fs.readFileSync(this.metricsFile, 'utf8');
        existingMetrics = JSON.parse(content);
      } catch (e) {
        this.log('Failed to read existing metrics file', 'WARN');
      }
    }

    existingMetrics.push(metrics);

    // Keep only last 100 build records
    if (existingMetrics.length > 100) {
      existingMetrics = existingMetrics.slice(-100);
    }

    fs.writeFileSync(this.metricsFile, JSON.stringify(existingMetrics, null, 2));
  }

  analyzeBuildTrends() {
    if (!fs.existsSync(this.metricsFile)) {
      this.log('No metrics available for trend analysis', 'WARN');
      return null;
    }

    const metrics = JSON.parse(fs.readFileSync(this.metricsFile, 'utf8'));
    const recentBuilds = metrics.slice(-10); // Last 10 builds

    const successfulBuilds = recentBuilds.filter(m => m.success);
    const failedBuilds = recentBuilds.filter(m => !m.success);

    const avgBuildTime = successfulBuilds.length > 0
      ? successfulBuilds.reduce((sum, m) => sum + m.buildTime, 0) / successfulBuilds.length
      : 0;

    const successRate = (successfulBuilds.length / recentBuilds.length) * 100;

    const analysis = {
      totalBuilds: recentBuilds.length,
      successfulBuilds: successfulBuilds.length,
      failedBuilds: failedBuilds.length,
      successRate: Math.round(successRate),
      avgBuildTime: Math.round(avgBuildTime),
      lastBuildSuccess: recentBuilds[recentBuilds.length - 1]?.success || false
    };

    this.log(`📊 Build Analysis: ${analysis.successRate}% success rate, avg: ${analysis.avgBuildTime}ms`, 'INFO');

    return analysis;
  }

  async validatePostCommit() {
    this.log('🔍 Running post-commit build validation...', 'INFO');

    const result = await this.runBuild();
    const analysis = this.analyzeBuildTrends();

    if (!result.success) {
      this.log('🚨 CRITICAL: Build failure detected after commit!', 'ERROR');
      this.log('📧 Consider sending notifications to team', 'WARN');
    }

    if (analysis && analysis.successRate < 80) {
      this.log(`⚠️  WARNING: Build success rate is low (${analysis.successRate}%)`, 'WARN');
    }

    return { buildResult: result, analysis };
  }

  async continuousMonitoring(intervalMs = 300000) { // 5 minutes default
    this.log(`🔄 Starting continuous build monitoring (interval: ${intervalMs}ms)`, 'INFO');

    const monitor = async () => {
      try {
        await this.validatePostCommit();
      } catch (error) {
        this.log(`Monitor error: ${error.message}`, 'ERROR');
      }
    };

    // Initial run
    await monitor();

    // Set up interval
    setInterval(monitor, intervalMs);
  }

  generateReport() {
    if (!fs.existsSync(this.metricsFile)) {
      return 'No build metrics available';
    }

    const metrics = JSON.parse(fs.readFileSync(this.metricsFile, 'utf8'));
    const analysis = this.analyzeBuildTrends();

    const report = `
# Build Validation Report

Generated: ${new Date().toISOString()}

## Summary
- Total Builds Tracked: ${metrics.length}
- Recent Success Rate: ${analysis?.successRate || 0}%
- Average Build Time: ${analysis?.avgBuildTime || 0}ms
- Last Build Status: ${analysis?.lastBuildSuccess ? '✅ Success' : '❌ Failed'}

## Recent Build History
${metrics.slice(-5).map(m =>
  `- ${m.timestamp}: ${m.success ? '✅' : '❌'} (${m.buildTime}ms)`
).join('\n')}

## Recommendations
${analysis?.successRate < 90 ? '- ⚠️ Consider investigating build stability issues' : '- ✅ Build stability looks good'}
${analysis?.avgBuildTime > 60000 ? '- ⚠️ Build time optimization may be needed' : '- ✅ Build performance is acceptable'}
`;

    return report;
  }
}

// CLI Interface
if (require.main === module) {
  const validator = new BuildValidator();
  const command = process.argv[2];

  switch (command) {
    case 'build':
      validator.runBuild().then(result => {
        process.exit(result.success ? 0 : 1);
      });
      break;

    case 'validate':
      validator.validatePostCommit().then(result => {
        process.exit(result.buildResult.success ? 0 : 1);
      });
      break;

    case 'monitor':
      const interval = parseInt(process.argv[3]) || 300000;
      validator.continuousMonitoring(interval);
      break;

    case 'report':
      console.log(validator.generateReport());
      break;

    case 'trends':
      const analysis = validator.analyzeBuildTrends();
      if (analysis) {
        console.log(JSON.stringify(analysis, null, 2));
      }
      break;

    default:
      console.log(`
Usage: node build-validation.js <command>

Commands:
  build      - Run a single build validation
  validate   - Run post-commit validation
  monitor    - Start continuous monitoring
  report     - Generate build report
  trends     - Show build trend analysis
`);
      process.exit(1);
  }
}

module.exports = BuildValidator;