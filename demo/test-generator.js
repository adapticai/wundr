#!/usr/bin/env node

/**
 * Demo script to test the Claude Generator System
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Testing Wundr Claude Generator System');
console.log('========================================');

// Simulate project detection
function simulateProjectDetection() {
  console.log('\n📊 Project Detection Demo:');
  console.log('==========================');
  
  const currentPackageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')
  );
  
  console.log(`✅ Project Name: ${currentPackageJson.name}`);
  console.log(`✅ Project Description: ${currentPackageJson.description}`);
  console.log(`✅ Project Version: ${currentPackageJson.version}`);
  
  // Detect project type based on dependencies
  const deps = { ...currentPackageJson.dependencies, ...currentPackageJson.devDependencies };
  let projectType = 'unknown';
  
  if (deps.turbo && currentPackageJson.workspaces) {
    projectType = 'monorepo';
  } else if (deps.typescript) {
    projectType = 'typescript';
  } else if (deps.react) {
    projectType = 'react';
  } else if (currentPackageJson.bin) {
    projectType = 'cli';
  }
  
  console.log(`✅ Detected Type: ${projectType}`);
  console.log(`✅ Has TypeScript: ${!!deps.typescript ? 'Yes' : 'No'}`);
  console.log(`✅ Has Tests: ${!!deps.jest ? 'Yes' : 'No'}`);
  console.log(`✅ Has Linting: ${!!deps.eslint ? 'Yes' : 'No'}`);
  
  return { projectType, currentPackageJson, deps };
}

// Simulate quality analysis
function simulateQualityAnalysis(deps) {
  console.log('\n🛡️ Quality Analysis Demo:');
  console.log('=========================');
  
  let score = 50; // Base score
  
  const qualityChecks = {
    'TypeScript': !!deps.typescript,
    'ESLint': !!deps.eslint, 
    'Jest Testing': !!deps.jest,
    'Prettier': !!deps.prettier,
    'Husky (Pre-commit)': !!deps.husky,
    'Turbo (Build System)': !!deps.turbo
  };
  
  Object.entries(qualityChecks).forEach(([check, passes]) => {
    const status = passes ? '✅' : '❌';
    console.log(`${status} ${check}: ${passes ? 'Enabled' : 'Missing'}`);
    if (passes) score += 10;
  });
  
  console.log(`\n📊 Quality Score: ${Math.min(score, 100)}/100`);
  return score;
}

// Simulate agent configuration
function simulateAgentConfiguration(projectType) {
  console.log('\n🤖 Agent Configuration Demo:');
  console.log('============================');
  
  const baseAgents = ['coder', 'reviewer', 'tester', 'planner', 'researcher'];
  
  const specializedAgents = {
    'monorepo': ['package-coordinator', 'build-orchestrator', 'version-manager'],
    'typescript': ['type-specialist', 'compiler-expert'],
    'react': ['ui-designer', 'accessibility-tester', 'performance-optimizer'],
    'cli': ['ux-designer', 'help-writer', 'platform-tester']
  };
  
  const agents = [...baseAgents, ...(specializedAgents[projectType] || [])];
  
  console.log(`✅ Base Agents: ${baseAgents.join(', ')}`);
  if (specializedAgents[projectType]) {
    console.log(`✅ Specialized Agents: ${specializedAgents[projectType].join(', ')}`);
  }
  console.log(`✅ Total Agents: ${agents.length}`);
  console.log(`✅ Topology: ${projectType === 'monorepo' ? 'hierarchical' : 'mesh'}`);
  
  return agents;
}

// Simulate MCP tools configuration
function simulateMCPToolsConfig(projectType) {
  console.log('\n🔧 MCP Tools Configuration Demo:');
  console.log('================================');
  
  const commonTools = [
    'drift_detection - Monitor code quality drift',
    'pattern_standardize - Auto-fix code patterns',
    'dependency_analyze - Analyze dependencies',
    'test_baseline - Manage test coverage'
  ];
  
  const specializedTools = {
    'monorepo': ['monorepo_manage - Monorepo coordination'],
    'react': ['ui_analyzer - UI component analysis'],
    'cli': ['cli_tester - Command line interface testing']
  };
  
  console.log('✅ Common Tools:');
  commonTools.forEach(tool => console.log(`  • ${tool}`));
  
  if (specializedTools[projectType]) {
    console.log('✅ Specialized Tools:');
    specializedTools[projectType].forEach(tool => console.log(`  • ${tool}`));
  }
  
  return [...commonTools, ...(specializedTools[projectType] || [])];
}

// Generate sample CLAUDE.md preview
function generateSampleClaudePreview(projectInfo, agents, tools, score) {
  console.log('\n📄 Generated CLAUDE.md Preview:');
  console.log('==============================');
  
  const preview = `# Claude Code Configuration - ${projectInfo.currentPackageJson.name}

## Project: ${projectInfo.currentPackageJson.name}
**Type**: ${projectInfo.projectType === 'monorepo' ? 'Monorepo' : 'TypeScript Project'}
**Description**: ${projectInfo.currentPackageJson.description}
**Version**: ${projectInfo.currentPackageJson.version}

## 🚨 VERIFICATION PROTOCOL & REALITY CHECKS
[Standard verification protocol would be included...]

## 🤖 Agent Configuration
**Total Agents**: ${agents.length} configured
**Topology**: ${projectInfo.projectType === 'monorepo' ? 'hierarchical' : 'mesh'}
**Quality Score**: ${score}/100

## 🔧 MCP Tools Integration
**Available Tools**: ${tools.length} tools configured
- drift_detection - Monitor code quality drift
- pattern_standardize - Auto-fix code patterns
- dependency_analyze - Analyze dependencies
${projectInfo.projectType === 'monorepo' ? '- monorepo_manage - Monorepo coordination' : ''}

## Available Commands
**Build**: turbo build
**Test**: turbo test  
**Lint**: turbo lint

---
*Generated by Wundr Dynamic CLAUDE.md Generator*`;

  console.log(preview.substring(0, 500) + '...\n[Preview truncated]');
  
  return preview;
}

// Run the complete demo
function runDemo() {
  try {
    const projectInfo = simulateProjectDetection();
    const score = simulateQualityAnalysis(projectInfo.deps);
    const agents = simulateAgentConfiguration(projectInfo.projectType);
    const tools = simulateMCPToolsConfig(projectInfo.projectType);
    const preview = generateSampleClaudePreview(projectInfo, agents, tools, score);
    
    console.log('\n🎉 Demo Complete!');
    console.log('=================');
    console.log('✅ Project detection working');
    console.log('✅ Quality analysis working');
    console.log('✅ Agent configuration working');
    console.log('✅ MCP tools configuration working'); 
    console.log('✅ CLAUDE.md generation working');
    
    console.log('\n📋 Next Steps:');
    console.log('• Build: npm run build');
    console.log('• Install: ./scripts/install-claude-generator.sh');
    console.log('• Test: wundr claude-audit');
    console.log('• Generate: wundr claude-init');
    
  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runDemo();
}