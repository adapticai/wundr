#!/usr/bin/env node

/**
 * Wundr CLI Entry Point
 * 
 * This is the main executable for the Wundr CLI tool.
 * It handles cross-platform compatibility and bootstraps the CLI.
 */

const path = require('path');
const { existsSync } = require('fs');

// Check for development vs production environment
const isDevelopment = process.env.NODE_ENV === 'development';
const srcPath = path.join(__dirname, '..', 'src', 'index.ts');
const distPath = path.join(__dirname, '..', 'dist', 'index.js');

// In development, use ts-node if available and TypeScript files exist
if (isDevelopment && existsSync(srcPath)) {
  try {
    // Try to use ts-node for development
    require('ts-node/register');
    require(srcPath);
  } catch (error) {
    console.warn('ts-node not available, using compiled JavaScript');
    if (existsSync(distPath)) {
      require(distPath);
    } else {
      console.error('No compiled JavaScript found. Please run "npm run build" first.');
      process.exit(1);
    }
  }
} else if (existsSync(distPath)) {
  // Production: use compiled JavaScript
  require(distPath);
} else {
  console.error('Wundr CLI not properly installed. Please reinstall the package.');
  process.exit(1);
}