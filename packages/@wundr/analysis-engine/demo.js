#!/usr/bin/env node
/**
 * Demo script for the Analysis Engine
 */

const { analyzeProject } = require('./dist/simple-analyzer');
const path = require('path');

async function runDemo() {
  console.log('🔍 Analysis Engine Demo');
  console.log('========================\n');

  try {
    const targetDir = path.join(__dirname, 'tests/fixtures');
    console.log(`Analyzing: ${targetDir}\n`);

    const report = await analyzeProject(targetDir);

    console.log('📊 Analysis Results:');
    console.log(`- Files analyzed: ${report.summary.totalFiles}`);
    console.log(`- Entities found: ${report.summary.totalEntities}`);
    console.log(`- Duplicate clusters: ${report.summary.duplicateClusters}`);
    console.log(
      `- Average complexity: ${report.summary.averageComplexity.toFixed(1)}`
    );
    console.log(`- Quality score: ${report.summary.technicalDebt.score}/100`);
    console.log(`- Analysis time: ${report.performance.analysisTime}ms`);

    if (report.duplicates.length > 0) {
      console.log('\n🔄 Duplicates Found:');
      report.duplicates.forEach((cluster, index) => {
        console.log(
          `${index + 1}. ${cluster.entities.length} duplicate ${cluster.type}s (${cluster.severity})`
        );
        cluster.entities.forEach(entity => {
          console.log(`   - ${entity.name} in ${path.basename(entity.file)}`);
        });
      });
    }

    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach((rec, index) => {
        console.log(
          `${index + 1}. [${rec.priority.toUpperCase()}] ${rec.title}`
        );
        console.log(`   ${rec.description}`);
        console.log(`   Estimated effort: ${rec.estimatedTimeHours}h\n`);
      });
    }

    console.log('✅ Demo completed successfully!');
  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    process.exit(1);
  }
}

// Run the demo
runDemo();
