#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
// Simple color functions since chalk import is complex in this environment
const chalk = {
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`
};

// Package directories to check
const packageDirs = [
  '/Users/kirk/wundr',  // Root
  '/Users/kirk/wundr/packages/core',
  '/Users/kirk/wundr/packages/shared-config',
  '/Users/kirk/wundr/packages/@wundr/cli',
  '/Users/kirk/wundr/packages/@wundr/dashboard',
  '/Users/kirk/wundr/packages/@wundr/analysis-engine',
  '/Users/kirk/wundr/tools/web-client'
];

// Scripts to test
const scriptsToTest = ['build', 'lint', 'test', 'typecheck'];

console.log(chalk.blue('\n🔍 Package.json Scripts Verification Report\n'));
console.log('=' .repeat(60));

const results = {
  working: [],
  broken: [],
  missing: []
};

for (const dir of packageDirs) {
  const packageJsonPath = path.join(dir, 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.log(chalk.red(`❌ No package.json found in ${dir}`));
    continue;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const packageName = packageJson.name || path.basename(dir);
  
  console.log(chalk.yellow(`\n📦 Testing ${packageName}`));
  console.log(chalk.gray(`   Location: ${dir}`));
  
  for (const script of scriptsToTest) {
    const scriptCommand = packageJson.scripts?.[script];
    
    if (!scriptCommand) {
      console.log(chalk.gray(`   ⏭️  ${script}: NOT DEFINED`));
      results.missing.push(`${packageName}:${script}`);
      continue;
    }

    try {
      process.chdir(dir);
      
      // Special handling for different scripts
      let command = `npm run ${script}`;
      let timeout = 30000;
      
      if (script === 'build') {
        timeout = 120000; // 2 minutes for builds
      }
      
      if (script === 'test') {
        command = `npm run ${script} --passWithNoTests`; // Allow passing with no tests
      }
      
      execSync(command, { 
        stdio: 'pipe',
        timeout: timeout,
        cwd: dir
      });
      
      console.log(chalk.green(`   ✅ ${script}: WORKING`));
      results.working.push(`${packageName}:${script}`);
      
    } catch (error) {
      console.log(chalk.red(`   ❌ ${script}: FAILED`));
      if (error.stdout) {
        console.log(chalk.gray(`      stdout: ${error.stdout.toString().substring(0, 100)}...`));
      }
      if (error.stderr) {
        console.log(chalk.gray(`      stderr: ${error.stderr.toString().substring(0, 100)}...`));
      }
      results.broken.push(`${packageName}:${script}`);
    }
  }
}

// Summary Report
console.log(chalk.blue('\n📊 SUMMARY REPORT'));
console.log('=' .repeat(60));

console.log(chalk.green(`\n✅ WORKING SCRIPTS (${results.working.length}):`));
results.working.forEach(script => {
  console.log(chalk.green(`   • ${script}`));
});

console.log(chalk.red(`\n❌ BROKEN SCRIPTS (${results.broken.length}):`));
results.broken.forEach(script => {
  console.log(chalk.red(`   • ${script}`));
});

console.log(chalk.gray(`\n⏭️  MISSING SCRIPTS (${results.missing.length}):`));
results.missing.forEach(script => {
  console.log(chalk.gray(`   • ${script}`));
});

// Statistics
const total = results.working.length + results.broken.length + results.missing.length;
const workingPercent = total > 0 ? Math.round((results.working.length / total) * 100) : 0;
const brokenPercent = total > 0 ? Math.round((results.broken.length / total) * 100) : 0;

console.log(chalk.blue('\n📈 STATISTICS:'));
console.log(`   Total Scripts Checked: ${total}`);
console.log(chalk.green(`   Working: ${results.working.length} (${workingPercent}%)`));
console.log(chalk.red(`   Broken: ${results.broken.length} (${brokenPercent}%)`));
console.log(chalk.gray(`   Missing: ${results.missing.length}`));

// Recommendations
console.log(chalk.blue('\n💡 RECOMMENDATIONS:'));

if (results.broken.length > 0) {
  console.log(chalk.yellow('   1. Fix broken scripts by addressing missing dependencies'));
  console.log(chalk.yellow('   2. Check TypeScript compilation errors'));
  console.log(chalk.yellow('   3. Ensure all required files exist'));
}

if (results.missing.length > 0) {
  console.log(chalk.yellow('   4. Add missing scripts to package.json files'));
  console.log(chalk.yellow('   5. Consider using workspace-level scripts for consistency'));
}

if (workingPercent >= 75) {
  console.log(chalk.green('   🎉 Good job! Most scripts are working correctly.'));
} else if (workingPercent >= 50) {
  console.log(chalk.yellow('   ⚠️  Some work needed to improve script reliability.'));
} else {
  console.log(chalk.red('   🚨 Significant issues found. Priority fixes needed.'));
}

console.log(chalk.blue('\n✨ Verification completed!\n'));

// Exit with error code if there are broken scripts
process.exit(results.broken.length > 0 ? 1 : 0);