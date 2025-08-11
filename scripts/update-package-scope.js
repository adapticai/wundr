#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// eslint-disable-next-line no-console
console.log('🔄 Updating package names from @wundr to @wundr.io...\n');

// Find all package.json files
const packageFiles = glob.sync('packages/**/package.json', {
  ignore: ['**/node_modules/**'],
});

// Also update root package.json
packageFiles.push('package.json');

let updatedCount = 0;

packageFiles.forEach(file => {
  try {
    const filePath = path.resolve(file);
    const content = fs.readFileSync(filePath, 'utf8');
    const pkg = JSON.parse(content);

    let updated = false;

    // Update package name
    if (pkg.name && pkg.name.startsWith('@wundr/')) {
      const oldName = pkg.name;
      pkg.name = pkg.name.replace('@wundr/', '@wundr.io/');
      // eslint-disable-next-line no-console
      console.log(`✅ ${oldName} → ${pkg.name}`);
      updated = true;
    }

    // Update dependencies
    [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ].forEach(depType => {
      if (pkg[depType]) {
        Object.keys(pkg[depType]).forEach(dep => {
          if (dep.startsWith('@wundr/')) {
            pkg[depType][dep.replace('@wundr/', '@wundr.io/')] =
              pkg[depType][dep];
            delete pkg[depType][dep];
            updated = true;
          }
        });
      }
    });

    // Update bin entries if needed
    if (pkg.bin && typeof pkg.bin === 'object') {
      const newBin = {};
      Object.entries(pkg.bin).forEach(([key, value]) => {
        newBin[key] = value;
      });
      pkg.bin = newBin;
    }

    if (updated) {
      // Write back with proper formatting
      fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n');
      updatedCount++;
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`❌ Error processing ${file}:`, error.message);
  }
});

// eslint-disable-next-line no-console
console.log(`\n✅ Updated ${updatedCount} package.json files`);
// eslint-disable-next-line no-console
console.log('\n📝 Next steps:');
// eslint-disable-next-line no-console
console.log('1. Review the changes with: git diff');
// eslint-disable-next-line no-console
console.log('2. Commit the changes');
// eslint-disable-next-line no-console
console.log('3. Push to trigger the release workflow');
