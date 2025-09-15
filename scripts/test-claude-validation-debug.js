#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function testValidation() {
  console.log('Testing Claude installer validation with debug info...\n');
  
  const homeDir = require('os').homedir();
  const claudeDir = path.join(homeDir, '.claude');
  
  // Check Claude Flow
  console.log('1. Checking Claude Flow:');
  try {
    const result = execSync('npx claude-flow@alpha --version', { 
      encoding: 'utf8', 
      stdio: 'pipe',
      timeout: 15000 
    });
    console.log('   ✅ Claude Flow version:', result.trim());
  } catch (error) {
    console.log('   ❌ Claude Flow check failed:', error.message);
  }
  
  // Check Claude directory
  console.log('\n2. Checking Claude directory:');
  if (fs.existsSync(claudeDir)) {
    console.log('   ✅ Claude directory exists:', claudeDir);
    const contents = fs.readdirSync(claudeDir);
    console.log('   Contents:', contents.join(', '));
  } else {
    console.log('   ❌ Claude directory does not exist');
  }
  
  // Check Claude CLI
  console.log('\n3. Checking Claude CLI:');
  try {
    const result = execSync('which claude', { encoding: 'utf8', stdio: 'pipe' });
    console.log('   ✅ Claude CLI found at:', result.trim());
  } catch {
    console.log('   ℹ️ Claude CLI not found (expected)');
  }
  
  // Now test the actual validation
  console.log('\n4. Running ClaudeInstaller validation:');
  try {
    const ClaudeInstaller = require('../packages/@wundr/computer-setup/dist/installers/claude-installer').default;
    console.log('   Loaded ClaudeInstaller:', typeof ClaudeInstaller);
    
    if (ClaudeInstaller && typeof ClaudeInstaller.validate === 'function') {
      const isValid = await ClaudeInstaller.validate();
      console.log('   Validation result:', isValid);
    } else {
      console.log('   ❌ ClaudeInstaller or validate method not found');
    }
  } catch (error) {
    console.error('   ❌ Error loading ClaudeInstaller:', error.message);
  }
}

testValidation();