#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const version = process.argv[2];
if (!version) {
  console.error('Usage: node update-versions.js <version>');
  process.exit(1);
}

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
    const oldVersion = pkgJson.version;
    pkgJson.version = version;
    fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n');
    console.log(`✓ ${pkgJson.name}: ${oldVersion} → ${version}`);
    updated++;
  }
});

console.log(`\n✓ Updated ${updated} packages to version ${version}`);
