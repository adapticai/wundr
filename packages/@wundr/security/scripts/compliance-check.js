#!/usr/bin/env node

const { ComplianceReporter } = require('../dist/index.js');
const path = require('path');
const fs = require('fs');

async function main() {
  const args = process.argv.slice(2);
  const framework = args[0] || 'soc2-type2';
  const outputPath = args[1] || './compliance-reports';
  const assessor = args[2] || 'Automated System';

  console.log('📋 Starting compliance assessment...');
  console.log(`Framework: ${framework}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Assessor: ${assessor}`);

  try {
    // Initialize compliance reporter
    const compliance = new ComplianceReporter();

    // Ensure output directory exists
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    // Generate compliance report
    console.log('\n🔍 Performing compliance assessment...');
    const report = await compliance.generateReport(framework, {
      assessor,
      includeEvidence: true,
      reportPeriod: {
        start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
        end: new Date()
      }
    });

    // Export reports in multiple formats
    console.log('\n📄 Exporting reports...');
    const jsonFile = await compliance.exportReport(report, 'json', outputPath);
    const htmlFile = await compliance.exportReport(report, 'html', outputPath);
    const csvFile = await compliance.exportReport(report, 'csv', outputPath);

    // Display summary
    console.log('\n✅ Compliance assessment completed!');
    console.log('\n📊 Summary:');
    console.log(`  Framework: ${report.framework.name} v${report.framework.version}`);
    console.log(`  Total Requirements: ${report.summary.totalRequirements}`);
    console.log(`  Compliant: ${report.summary.compliant} (${report.summary.compliancePercentage}%)`);
    console.log(`  Non-Compliant: ${report.summary.nonCompliant}`);
    console.log(`  Partial: ${report.summary.partial}`);
    console.log(`  Not Applicable: ${report.summary.notApplicable}`);

    if (report.findings.length > 0) {
      console.log('\n⚠️ Findings:');
      report.findings.forEach((finding, index) => {
        console.log(`  ${index + 1}. [${finding.severity.toUpperCase()}] ${finding.title}`);
        console.log(`     ${finding.description}`);
      });
    }

    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.title}`);
        console.log(`     ${rec.description}`);
      });
    }

    console.log('\n📄 Reports exported:');
    console.log(`  - JSON: ${jsonFile}`);
    console.log(`  - HTML: ${htmlFile}`);
    console.log(`  - CSV: ${csvFile}`);

    // Track compliance trends if available
    try {
      console.log('\n📈 Compliance Trends:');
      const trends = await compliance.trackCompliance(framework);
      
      console.log('  Recent Progress:');
      trends.trend.forEach(point => {
        console.log(`    ${point.date.toDateString()}: ${point.compliancePercentage}%`);
      });

      if (trends.improvements.length > 0) {
        console.log('\n  ✅ Improvements:');
        trends.improvements.forEach(improvement => {
          console.log(`    - ${improvement}`);
        });
      }

      if (trends.degradations.length > 0) {
        console.log('\n  ⚠️ Areas needing attention:');
        trends.degradations.forEach(degradation => {
          console.log(`    - ${degradation}`);
        });
      }
    } catch (error) {
      console.warn('Could not retrieve compliance trends:', error.message);
    }

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Compliance assessment failed:', error);
    process.exit(1);
  }
}

// Show help if requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: node compliance-check.js [framework] [output-path] [assessor]

Arguments:
  framework    Compliance framework (default: soc2-type2)
               Available: soc2-type2, hipaa
  output-path  Directory for report output (default: ./compliance-reports)
  assessor     Name of person/system performing assessment (default: Automated System)

Examples:
  node compliance-check.js
  node compliance-check.js soc2-type2 ./reports "John Doe"
  node compliance-check.js hipaa ./hipaa-reports "Security Team"
  `);
  process.exit(0);
}

if (require.main === module) {
  main();
}