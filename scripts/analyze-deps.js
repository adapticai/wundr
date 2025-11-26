#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const packagesDir = path.join(__dirname, '..', 'packages', '@wundr');
const packages = fs
  .readdirSync(packagesDir)
  .filter(
    p => p !== 'neolith' && fs.statSync(path.join(packagesDir, p)).isDirectory()
  );

const pkgData = [];

packages.forEach(pkgName => {
  const pkgJsonPath = path.join(packagesDir, pkgName, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    const deps = pkgJson.dependencies || {};
    const workspaceDeps = Object.entries(deps)
      .filter(([_, version]) => version.includes('workspace:'))
      .map(([name, _]) => name);

    pkgData.push({
      name: pkgJson.name,
      version: pkgJson.version,
      path: pkgName,
      workspaceDeps,
      hasPublishConfig: !!pkgJson.publishConfig,
    });
  }
});

console.log(JSON.stringify(pkgData, null, 2));
