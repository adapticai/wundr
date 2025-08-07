#!/usr/bin/env node

const { SecurityManager } = require('../dist/index.js');
const path = require('path');
const fs = require('fs');

async function main() {
  const args = process.argv.slice(2);
  const targetPath = args[0] || process.cwd();
  const outputPath = args[1] || './security-reports';

  console.log('🔍 Starting comprehensive security scan...');
  console.log(`Target: ${targetPath}`);
  console.log(`Output: ${outputPath}`);

  try {
    // Initialize security manager
    const security = new SecurityManager();
    await security.initialize();

    // Ensure output directory exists
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    // Perform comprehensive scan
    console.log('\n📊 Performing security scan...');
    const results = await security.performSecurityScan(targetPath);

    // Generate reports
    console.log('\n📋 Generating reports...');
    const reportFiles = await security.generateSecurityReport(targetPath, outputPath);

    // Display summary
    console.log('\n✅ Security scan completed!');
    console.log('\n📈 Summary:');
    
    if (results.secrets) {
      console.log(`  Secrets: ${results.secrets.matches.length} found`);
      console.log(`    Critical: ${results.secrets.summary.critical}`);
      console.log(`    High: ${results.secrets.summary.high}`);
    }

    if (results.vulnerabilities) {
      console.log(`  Vulnerabilities: ${results.vulnerabilities.vulnerabilities.length} found`);
      console.log(`    Critical: ${results.vulnerabilities.summary.critical}`);
      console.log(`    High: ${results.vulnerabilities.summary.high}`);
    }

    if (results.staticAnalysis) {
      console.log(`  Static Analysis: ${results.staticAnalysis.issues.length} issues`);
      console.log(`    Critical: ${results.staticAnalysis.summary.critical}`);
      console.log(`    Error: ${results.staticAnalysis.summary.error}`);
    }

    if (results.compliance) {
      console.log(`  Compliance: ${results.compliance.summary.compliancePercentage}% compliant`);
    }

    console.log('\n📄 Reports generated:');
    reportFiles.forEach(file => {
      console.log(`  - ${file}`);
    });

    // Cleanup
    await security.cleanup();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Security scan failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}