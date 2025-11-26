#!/usr/bin/env node

/**
 * Pre-build script for Neolith Desktop App
 *
 * This script:
 * 1. Builds the desktop app's Electron code
 * 2. Copies the web app's output directory to the desktop app
 * 3. Prepares the app for packaging
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const appDir = __dirname.replace('/scripts', '');
const webAppDir = path.join(appDir, '../web');
const desktopOutDir = path.join(appDir, 'out');

console.log('Desktop build script starting...');
console.log('App directory:', appDir);
console.log('Web app directory:', webAppDir);
console.log('Desktop out directory:', desktopOutDir);

// Step 1: Build the web app if not already built
console.log('\n1. Checking web app build...');
const webOutDir = path.join(webAppDir, 'out');
if (!fs.existsSync(webOutDir)) {
  console.log('Web app not built, building now...');
  try {
    execSync('npm run build', { cwd: webAppDir, stdio: 'inherit' });
    console.log('Web app built successfully');
  } catch (error) {
    console.error('Failed to build web app:', error.message);
    process.exit(1);
  }
}

// Step 2: Copy web app out directory to desktop app
console.log('\n2. Copying web app output...');
if (fs.existsSync(desktopOutDir)) {
  console.log('Removing existing out directory...');
  fs.rmSync(desktopOutDir, { recursive: true, force: true });
}

try {
  // Copy the entire web app out directory
  const src = webOutDir;
  const dest = desktopOutDir;

  // Create destination directory
  fs.mkdirSync(dest, { recursive: true });

  // Recursively copy files
  const copyRecursive = (src, dest) => {
    const files = fs.readdirSync(src);
    files.forEach(file => {
      const srcPath = path.join(src, file);
      const destPath = path.join(dest, file);
      const stat = fs.statSync(srcPath);

      if (stat.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        copyRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    });
  };

  copyRecursive(src, dest);
  console.log('Web app output copied successfully');
} catch (error) {
  console.error('Failed to copy web app output:', error.message);
  process.exit(1);
}

console.log('\nDesktop build preparation complete!');
console.log('Next.js app is available at:', desktopOutDir);
