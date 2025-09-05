#!/usr/bin/env node

/**
 * UI Test Runner Script
 * Provides an easy interface to run different test suites
 */

const { execSync, spawn } = require('child_process');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(message) {
  console.log('\n' + '='.repeat(60));
  log(message, 'bright');
  console.log('='.repeat(60) + '\n');
}

function checkDashboardAvailability() {
  header('Checking Dashboard Availability');
  
  const dashboards = [
    { name: 'Web Client', port: 3000, url: 'http://localhost:3000' },
    { name: 'Wundr Dashboard', port: 3001, url: 'http://localhost:3001' }
  ];

  for (const dashboard of dashboards) {
    try {
      execSync(`curl -s ${dashboard.url}`, { timeout: 5000 });
      log(`✅ ${dashboard.name} (port ${dashboard.port}) - Available`, 'green');
    } catch (error) {
      log(`❌ ${dashboard.name} (port ${dashboard.port}) - Not Available`, 'red');
      log(`   To start: cd to dashboard directory and run 'npm run dev'`, 'yellow');
    }
  }
  console.log('');
}

function runPlaywrightTest(testFile, options = {}) {
  const { headed = false, debug = false, ui = false } = options;
  
  let command = ['npx', 'playwright', 'test'];
  
  if (testFile) {
    command.push(testFile);
  }
  
  if (headed) command.push('--headed');
  if (debug) command.push('--debug');
  if (ui) command.push('--ui');
  
  log(`Running: ${command.join(' ')}`, 'cyan');
  
  const child = spawn(command[0], command.slice(1), {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  return new Promise((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Test failed with code ${code}`));
      }
    });
  });
}

async function runTestSuite(suiteName, options = {}) {
  const testSuites = {
    'smoke': {
      file: 'smoke-tests.spec.ts',
      description: 'Quick smoke tests - essential functionality validation'
    },
    'comprehensive': {
      file: 'comprehensive-ui-audit.spec.ts', 
      description: 'Comprehensive UI audit - complete validation'
    },
    'links': {
      file: 'broken-links-audit.spec.ts',
      description: 'Broken links detection and validation'
    },
    'errors': {
      file: 'runtime-errors-detection.spec.ts',
      description: 'JavaScript runtime errors monitoring'
    },
    'components': {
      file: 'missing-components-validation.spec.ts',
      description: 'Missing components and rendering validation'
    },
    'navigation': {
      file: 'navigation-issues-detection.spec.ts',
      description: 'Navigation functionality and routing issues'
    },
    'api': {
      file: 'api-endpoint-validation.spec.ts',
      description: 'API endpoint health and functionality checks'
    },
    'integration': {
      file: 'wundr-dashboard-integration.spec.ts',
      description: 'Cross-dashboard integration testing'
    },
    'all': {
      file: null,
      description: 'Run all test suites'
    }
  };

  const suite = testSuites[suiteName];
  
  if (!suite) {
    log(`❌ Unknown test suite: ${suiteName}`, 'red');
    log('\nAvailable test suites:', 'yellow');
    Object.entries(testSuites).forEach(([name, info]) => {
      log(`  ${name.padEnd(12)} - ${info.description}`, 'cyan');
    });
    return;
  }

  header(`Running Test Suite: ${suiteName}`);
  log(suite.description, 'blue');
  console.log('');

  try {
    await runPlaywrightTest(suite.file, options);
    log(`✅ ${suiteName} tests completed successfully`, 'green');
  } catch (error) {
    log(`❌ ${suiteName} tests failed: ${error.message}`, 'red');
    throw error;
  }
}

function showUsage() {
  header('UI Test Runner - Usage');
  
  log('Usage: node scripts/run-ui-tests.js [options] [test-suite]', 'bright');
  console.log('');
  
  log('Test Suites:', 'yellow');
  log('  smoke         - Quick smoke tests (recommended first)', 'cyan');
  log('  comprehensive - Complete UI audit', 'cyan');
  log('  links         - Broken links detection', 'cyan');
  log('  errors        - Runtime errors monitoring', 'cyan');
  log('  components    - Missing components validation', 'cyan');
  log('  navigation    - Navigation issues detection', 'cyan');
  log('  api           - API endpoint validation', 'cyan');
  log('  integration   - Cross-dashboard integration', 'cyan');
  log('  all           - Run all test suites', 'cyan');
  console.log('');
  
  log('Options:', 'yellow');
  log('  --headed      - Run tests with browser UI visible', 'cyan');
  log('  --debug       - Run tests in debug mode', 'cyan');
  log('  --ui          - Run tests with Playwright UI', 'cyan');
  log('  --check       - Only check dashboard availability', 'cyan');
  log('  --report      - Show test report after completion', 'cyan');
  console.log('');
  
  log('Examples:', 'yellow');
  log('  node scripts/run-ui-tests.js smoke', 'cyan');
  log('  node scripts/run-ui-tests.js comprehensive --headed', 'cyan');
  log('  node scripts/run-ui-tests.js all --ui', 'cyan');
  log('  node scripts/run-ui-tests.js --check', 'cyan');
  console.log('');
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showUsage();
    return;
  }

  // Parse options
  const options = {
    headed: args.includes('--headed'),
    debug: args.includes('--debug'),
    ui: args.includes('--ui'),
    check: args.includes('--check'),
    report: args.includes('--report')
  };

  // Always check dashboard availability first
  checkDashboardAvailability();

  if (options.check) {
    return;
  }

  // Get test suite name (first non-option argument)
  const testSuite = args.find(arg => !arg.startsWith('--')) || 'smoke';

  try {
    if (testSuite === 'all') {
      const suites = ['smoke', 'comprehensive', 'links', 'errors', 'components', 'navigation', 'api'];
      
      for (const suite of suites) {
        await runTestSuite(suite, options);
        console.log(''); // Add spacing between test suites
      }
      
      log('✅ All test suites completed successfully!', 'green');
      
    } else {
      await runTestSuite(testSuite, options);
    }

    if (options.report) {
      header('Generating Test Report');
      try {
        execSync('npx playwright show-report', { stdio: 'inherit' });
      } catch (error) {
        log('❌ Failed to generate report', 'red');
      }
    }

  } catch (error) {
    log(`❌ Test execution failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  log('\n\n❌ Test execution interrupted by user', 'yellow');
  process.exit(1);
});

// Run the script
main().catch(error => {
  console.error('Script error:', error);
  process.exit(1);
});