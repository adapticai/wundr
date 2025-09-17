#!/usr/bin/env tsx

/**
 * Performance Monitor CLI - Run performance impact analysis
 */

import { PerformanceImpactAnalyzer } from '../src/performance-impact-analyzer.js';
import { getLogger } from '../packages/@wundr/core/src/logger/index.js';

const logger = getLogger().child({ module: 'performance-monitor-cli' });

async function main() {
  const analyzer = new PerformanceImpactAnalyzer();

  try {
    console.log('🔍 Performance Impact Analysis Starting...\n');

    // Establish baseline
    console.log('📊 Establishing performance baseline...');
    const baseline = await analyzer.establishBaseline();
    console.log('✅ Baseline established');
    console.log(`   - Console usage: ${baseline.consoleUsageCount} instances`);
    console.log(`   - Build time: ${(baseline.buildTime / 1000).toFixed(2)}s`);
    console.log(`   - Lint time: ${(baseline.lintTime / 1000).toFixed(2)}s`);
    console.log(`   - Failed builds: ${baseline.failedBuilds.length}`);
    console.log(`   - Failed lints: ${baseline.failedLints.length}\n`);

    // Analyze current performance
    console.log('🔬 Analyzing post-change performance...');
    const report = await analyzer.analyzePostChangePerformance();

    // Save detailed report
    const reportPath = `/Users/layla/wundr/.claude-flow/metrics/performance-impact-report.json`;
    await analyzer.saveReport(report, reportPath);

    // Display summary
    console.log('\n📋 Performance Impact Summary:');
    console.log('=====================================');
    const summary = analyzer.generateSummary(report);
    console.log(summary);

    // Alert on critical issues
    if (report.criticalIssues.length > 0) {
      console.log('🚨 CRITICAL ISSUES DETECTED:');
      for (const issue of report.criticalIssues) {
        console.log(`   ❌ ${issue.type}: ${issue.description}`);
        console.log(`      Components: ${issue.affectedComponents.join(', ')}`);
      }
      console.log('');
    }

    // Performance verdict
    if (report.impact.overallImpact === 'negative' && report.impact.severity === 'critical') {
      console.log('🔴 VERDICT: CRITICAL PERFORMANCE REGRESSION - IMMEDIATE ACTION REQUIRED');
      process.exit(1);
    } else if (report.impact.overallImpact === 'negative') {
      console.log('🟡 VERDICT: PERFORMANCE DEGRADATION DETECTED - REVIEW RECOMMENDED');
      process.exit(1);
    } else if (report.impact.overallImpact === 'positive') {
      console.log('🟢 VERDICT: PERFORMANCE IMPROVEMENTS DETECTED');
    } else {
      console.log('⚪ VERDICT: PERFORMANCE IMPACT NEUTRAL');
    }

    console.log(`\n📄 Detailed report saved: ${reportPath}`);

  } catch (error) {
    logger.error('Performance analysis failed', { error });
    console.error('❌ Performance analysis failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}