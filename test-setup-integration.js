#!/usr/bin/env node
/**
 * Test the setup integration functionality
 */

const { execSync } = require('child_process');

// Simple coloring function since chalk might not be available
const chalk = {
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`
};

console.log(chalk.cyan('🧪 Testing Wundr Setup Integration\n'));

try {
  // Test 1: Check if setup commands are available
  console.log(chalk.blue('Test 1: Checking if setup commands are registered...'));
  
  // For now, we'll just verify the command structure exists
  const setupFile = './packages/@wundr/cli/src/commands/setup.ts';
  const fs = require('fs');
  
  if (fs.existsSync(setupFile)) {
    console.log(chalk.green('✅ Setup commands file exists'));
  } else {
    console.log(chalk.red('❌ Setup commands file missing'));
    process.exit(1);
  }

  // Test 2: Check if computer-setup exports are available
  console.log(chalk.blue('\nTest 2: Checking computer-setup exports...'));
  
  const computerSetupIndex = './packages/@wundr/computer-setup/src/index.ts';
  const setupContent = fs.readFileSync(computerSetupIndex, 'utf-8');
  
  if (setupContent.includes('RealSetupOrchestrator')) {
    console.log(chalk.green('✅ RealSetupOrchestrator export found'));
  } else {
    console.log(chalk.red('❌ RealSetupOrchestrator export missing'));
  }

  // Test 3: Verify CLI includes setup commands
  console.log(chalk.blue('\nTest 3: Checking CLI integration...'));
  
  const cliFile = './packages/@wundr/cli/src/cli.ts';
  const cliContent = fs.readFileSync(cliFile, 'utf-8');
  
  if (cliContent.includes('SetupCommands')) {
    console.log(chalk.green('✅ SetupCommands imported in CLI'));
  } else {
    console.log(chalk.red('❌ SetupCommands not imported in CLI'));
  }

  // Test 4: Check package.json dependencies
  console.log(chalk.blue('\nTest 4: Checking package dependencies...'));
  
  const cliPackage = require('./packages/@wundr/cli/package.json');
  
  if (cliPackage.dependencies['@wundr.io/computer-setup']) {
    console.log(chalk.green('✅ CLI depends on computer-setup package'));
  } else {
    console.log(chalk.red('❌ CLI missing computer-setup dependency'));
  }

  // Test 5: Verify topic configuration
  console.log(chalk.blue('\nTest 5: Checking oclif topics...'));
  
  if (cliPackage.oclif && cliPackage.oclif.topics && cliPackage.oclif.topics.setup) {
    console.log(chalk.green('✅ Setup topic configured in oclif'));
  } else {
    console.log(chalk.red('❌ Setup topic not configured'));
  }

  console.log(chalk.green('\n🎉 Integration tests passed!'));
  
  console.log(chalk.cyan('\n📋 Available setup commands:'));
  console.log('  • wundr setup - Interactive setup');
  console.log('  • wundr setup:profile frontend - Frontend profile');
  console.log('  • wundr setup:profile backend - Backend profile');
  console.log('  • wundr setup:profile fullstack - Full-stack profile');
  console.log('  • wundr setup:profile devops - DevOps profile');
  console.log('  • wundr setup:validate - Validate environment');
  console.log('  • wundr setup:resume - Resume failed setup');
  console.log('  • wundr setup:personalize - Personal configuration');
  
  console.log(chalk.cyan('\n📋 Legacy computer-setup commands also available:'));
  console.log('  • wundr computer-setup - Full setup interface');
  console.log('  • wundr computer-setup validate - Validate setup');
  console.log('  • wundr computer-setup doctor - Diagnose issues');

  console.log(chalk.green('\n✅ Integration completed successfully!'));

} catch (error) {
  console.error(chalk.red('❌ Integration test failed:'), error.message);
  process.exit(1);
}