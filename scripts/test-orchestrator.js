#!/usr/bin/env node
/**
 * Test script for the Real Setup Orchestrator
 * Demonstrates the orchestrator functionality without running actual installations
 */

const { RealSetupOrchestrator } = require('../packages/@wundr/computer-setup/dist/installers');

async function testOrchestrator() {
  console.log('🧪 Testing Real Setup Orchestrator\n');

  // Create platform info
  const platform = {
    os: process.platform,
    arch: process.arch,
    version: process.version
  };

  console.log(`Platform: ${platform.os} ${platform.arch}`);
  console.log(`Node: ${platform.version}\n`);

  // Create orchestrator
  const orchestrator = new RealSetupOrchestrator(platform);

  // List available profiles
  console.log('📋 Available Developer Profiles:');
  const profiles = orchestrator.getAvailableProfiles();
  profiles.forEach(profile => {
    console.log(`  • ${profile.name}: ${profile.description}`);
    console.log(`    Tools: ${profile.requiredTools.join(', ')}`);
    console.log(`    Estimated time: ${profile.estimatedTimeMinutes} minutes\n`);
  });

  // Check if can resume
  const canResume = await orchestrator.canResume();
  console.log(`🔄 Can resume previous setup: ${canResume ? 'Yes' : 'No'}`);

  console.log('\n✅ Orchestrator test completed successfully!');
  console.log('\n💡 To run actual setup:');
  console.log('   wundr computer-setup --profile frontend');
  console.log('   wundr computer-setup --profile backend');
  console.log('   wundr computer-setup --profile fullstack');
  console.log('   wundr computer-setup --profile devops');
}

testOrchestrator().catch(console.error);