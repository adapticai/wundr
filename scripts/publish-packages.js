#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const packagesDir = path.join(__dirname, '..', 'packages', '@wundr');

// Define publishing order based on dependencies
const publishOrder = [
  // Tier 1: No workspace dependencies
  'core',
  'governance',
  'guardian-dashboard',
  'computer-setup',
  'config',
  'agent-delegation',
  'agent-eval',
  'agent-memory',
  'agent-observability',
  'ai-integration',
  'analysis-engine',
  'autogen-orchestrator',
  'crew-orchestrator',
  'dashboard',
  'docs',
  'environment',
  'hydra-config',
  'langgraph-orchestrator',
  'mcp-registry',
  'org-genesis',
  'plugin-system',
  'project-templates',
  'prompt-security',
  'prompt-templates',
  'risk-twin',
  'security',
  'slack-agent',
  'structured-output',
  'token-budget',
  'typechat-output',

  // Tier 2: Depends on core
  'rag-utils',

  // Tier 3: Depends on rag-utils
  'jit-tools',

  // Tier 4: Depends on multiple packages
  'cli',

  // Tier 5: Depends on cli
  'mcp-server',
];

const backupDir = path.join(__dirname, '..', '.package-json-backups');

function ensureBackupDir() {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
}

function backupPackageJson(pkgPath) {
  const pkgJsonPath = path.join(packagesDir, pkgPath, 'package.json');
  const backupPath = path.join(
    backupDir,
    `${pkgPath.replace(/\//g, '-')}-package.json`
  );
  fs.copyFileSync(pkgJsonPath, backupPath);
  console.log(`✓ Backed up ${pkgPath}/package.json`);
}

function restorePackageJson(pkgPath) {
  const pkgJsonPath = path.join(packagesDir, pkgPath, 'package.json');
  const backupPath = path.join(
    backupDir,
    `${pkgPath.replace(/\//g, '-')}-package.json`
  );
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, pkgJsonPath);
    console.log(`✓ Restored ${pkgPath}/package.json`);
  }
}

function updateWorkspaceDeps(pkgPath) {
  const pkgJsonPath = path.join(packagesDir, pkgPath, 'package.json');
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

  let modified = false;

  // Add publishConfig if missing
  if (!pkgJson.publishConfig) {
    pkgJson.publishConfig = { access: 'public' };
    modified = true;
  }

  // Replace workspace:* dependencies
  if (pkgJson.dependencies) {
    for (const [depName, depVersion] of Object.entries(pkgJson.dependencies)) {
      if (depVersion.includes('workspace:')) {
        // Use caret range for flexibility
        pkgJson.dependencies[depName] = '^1.0.0';
        modified = true;
        console.log(`  └─ ${depName}: ${depVersion} → ^1.0.0`);
      }
    }
  }

  if (modified) {
    fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n');
    console.log(`✓ Updated ${pkgPath}/package.json`);
  }

  return modified;
}

function buildPackage(pkgPath) {
  const pkgDir = path.join(packagesDir, pkgPath);
  const pkgJsonPath = path.join(pkgDir, 'package.json');
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

  if (pkgJson.scripts && pkgJson.scripts.build) {
    console.log(`\n📦 Building ${pkgJson.name}...`);
    try {
      execSync('pnpm run build', { cwd: pkgDir, stdio: 'inherit' });
      console.log(`✓ Built ${pkgJson.name}`);
      return true;
    } catch (_error) {
      console.error(`❌ Failed to build ${pkgJson.name}`);
      return false;
    }
  } else {
    console.log(`⊘ No build script for ${pkgJson.name}, skipping`);
    return true;
  }
}

function publishPackage(pkgPath, dryRun = false) {
  const pkgDir = path.join(packagesDir, pkgPath);
  const pkgJsonPath = path.join(pkgDir, 'package.json');
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

  console.log(`\n📤 Publishing ${pkgJson.name}@${pkgJson.version}...`);

  try {
    const cmd = dryRun
      ? 'npm publish --dry-run --access public'
      : 'npm publish --access public';

    execSync(cmd, { cwd: pkgDir, stdio: 'inherit' });
    console.log(`✓ Published ${pkgJson.name}@${pkgJson.version}`);
    return true;
  } catch (_error) {
    console.error(`❌ Failed to publish ${pkgJson.name}`);
    return false;
  }
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const skipBuild = args.includes('--skip-build');

  console.log('\n🚀 Publishing Wundr Packages');
  console.log('─'.repeat(50));
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Build: ${skipBuild ? 'SKIPPED' : 'ENABLED'}`);
  console.log('─'.repeat(50));

  ensureBackupDir();

  // Phase 1: Backup and update all package.json files
  console.log('\n📋 Phase 1: Backing up and updating package.json files...\n');
  for (const pkgPath of publishOrder) {
    backupPackageJson(pkgPath);
    updateWorkspaceDeps(pkgPath);
  }

  // Phase 2: Build all packages
  const failedBuilds = [];
  if (!skipBuild) {
    console.log('\n🔨 Phase 2: Building all packages...\n');
    for (const pkgPath of publishOrder) {
      if (!buildPackage(pkgPath)) {
        console.error(
          `\n❌ Build failed for ${pkgPath}. Skipping this package.`
        );
        failedBuilds.push(pkgPath);
      }
    }
    if (failedBuilds.length > 0) {
      console.log(
        `\n⚠️  ${failedBuilds.length} packages failed to build and will be skipped:\n   ${failedBuilds.join(', ')}\n`
      );
    }
  }

  // Phase 3: Publish in order
  console.log('\n📦 Phase 3: Publishing packages in dependency order...\n');
  const published = [];
  const failed = [];

  for (const pkgPath of publishOrder) {
    // Skip packages that failed to build
    if (failedBuilds.includes(pkgPath)) {
      console.log(`\n⊘ Skipping ${pkgPath} (build failed)\n`);
      failed.push(pkgPath);
      continue;
    }

    if (publishPackage(pkgPath, dryRun)) {
      published.push(pkgPath);
      // Wait a bit between publishes to avoid rate limiting
      if (!dryRun) {
        console.log('⏱️  Waiting 2 seconds...');
        execSync('sleep 2');
      }
    } else {
      failed.push(pkgPath);
      console.log('\n⚠️  Continuing despite failure...\n');
    }
  }

  // Phase 4: Restore package.json files
  console.log('\n🔄 Phase 4: Restoring package.json files...\n');
  for (const pkgPath of publishOrder) {
    restorePackageJson(pkgPath);
  }

  // Summary
  console.log('\n' + '═'.repeat(50));
  console.log('📊 Publishing Summary');
  console.log('═'.repeat(50));
  console.log(`✓ Successfully published: ${published.length}`);
  if (failedBuilds.length > 0) {
    console.log(`⚠️  Failed to build: ${failedBuilds.length}`);
    console.log('   Build failures:', failedBuilds.join(', '));
  }
  if (failed.length > failedBuilds.length) {
    console.log(`❌ Failed to publish: ${failed.length - failedBuilds.length}`);
    const publishFailed = failed.filter(p => !failedBuilds.includes(p));
    if (publishFailed.length > 0) {
      console.log('   Publish failures:', publishFailed.join(', '));
    }
  }
  console.log('═'.repeat(50) + '\n');

  if (published.length === 0) {
    console.error('❌ No packages were published successfully!');
    process.exit(1);
  }
}

main();
