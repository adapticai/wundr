#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const packagesDir = path.join(__dirname, '..', 'packages', '@wundr');
const packages = fs
  .readdirSync(packagesDir)
  .filter(
    p => p !== 'neolith' && fs.statSync(path.join(packagesDir, p)).isDirectory()
  );

let updated = 0;

packages.forEach(pkgName => {
  const pkgJsonPath = path.join(packagesDir, pkgName, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

    if (!pkgJson.publishConfig) {
      pkgJson.publishConfig = { access: 'public' };
      fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n');
      console.log(`✓ Added publishConfig to ${pkgJson.name}`);
      updated++;
    } else {
      console.log(`⊘ ${pkgJson.name} already has publishConfig`);
    }
  }
});

console.log(`\n✓ Updated ${updated} packages`);
