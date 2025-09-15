#!/usr/bin/env node

const { ClaudeInstaller } = require('../packages/@wundr/computer-setup/dist/installers/claude-installer');

async function testValidation() {
  console.log('Testing Claude installer validation...\n');
  
  const installer = new ClaudeInstaller();
  
  try {
    const isValid = await installer.validate();
    
    if (isValid) {
      console.log('✅ Claude validation PASSED');
    } else {
      console.log('❌ Claude validation FAILED');
    }
    
    // Also run the check method directly for more details
    console.log('\nRunning detailed check...');
    const checkResult = await installer.check();
    console.log('Check result:', checkResult);
    
  } catch (error) {
    console.error('Error during validation:', error);
  }
}

testValidation();