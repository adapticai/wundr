#!/usr/bin/env node

/**
 * Development runner for Wundr CLI
 * Handles module resolution for workspace packages
 */

const path = require('path');
const Module = require('module');

// Store original resolver
const originalResolveFilename = Module._resolveFilename;

// Custom resolver for workspace packages
Module._resolveFilename = function (request, parent, isMain) {
  // Handle @wundr/* packages
  if (request.startsWith('@wundr/')) {
    const packageName = request.replace('@wundr/', '');
    const possiblePaths = [
      path.join(__dirname, 'packages', '@wundr', packageName, 'src', 'index.ts'),
      path.join(__dirname, 'packages', '@wundr', packageName, 'lib', 'index.js'),
      path.join(__dirname, 'packages', '@wundr', packageName, 'dist', 'index.js'),
    ];
    
    for (const possiblePath of possiblePaths) {
      try {
        return originalResolveFilename.call(this, possiblePath, parent, isMain);
      } catch (e) {
        // Try next path
      }
    }
  }
  
  // Default resolution
  return originalResolveFilename.call(this, request, parent, isMain);
};

// Register tsx for TypeScript support
require('tsx/cjs');

// Get command line arguments
const args = process.argv.slice(2);

// Determine which module to run
let entryModule = './packages/@wundr/cli/src/index.ts';

if (args[0] === 'computer-setup-dev') {
  entryModule = './packages/@wundr/computer-setup/dev.ts';
  args.shift(); // Remove the first argument
}

// Load and run the module
try {
  const mainModule = require(entryModule);
  
  // If it exports a main function, call it
  if (typeof mainModule.main === 'function') {
    mainModule.main().catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
  }
} catch (error) {
  console.error('Failed to load module:', error);
  process.exit(1);
}