import { Installer } from '../types';
import { execAsync, fileExists, createDirectory, copyDirectory, writeFile } from '../utils';
import * as path from 'path';
import * as fs from 'fs/promises';
import { homedir } from 'os';

/**
 * Comprehensive Claude and Claude-Flow installer for complete AI integration
 * Includes: Claude CLI, Claude Flow, MCP tools, agents, and Chrome browser
 */
export class ClaudeInstaller implements Installer {
  name = 'Claude Code & Claude Flow';
  
  private readonly homeDir = homedir();
  private readonly claudeDir = path.join(this.homeDir, '.claude');
  private readonly agentsDir = path.join(this.claudeDir, 'agents');
  private readonly commandsDir = path.join(this.claudeDir, 'commands');
  private readonly helpersDir = path.join(this.claudeDir, 'helpers');
  private readonly mcpServers = [
    'claude-flow',
    'ruv-swarm',
    'firecrawl',
    'context7',
    'playwright',
    'browser',
    'sequentialthinking'
  ];

  async check(): Promise<boolean> {
    try {
      // Check if Claude CLI is installed
      const { stdout: claudeVersion } = await execAsync('claude --version');
      
      // Check if Claude Flow is installed
      const { stdout: flowVersion } = await execAsync('npx claude-flow@alpha --version');
      
      // Check if Chrome is installed (for Browser MCP)
      const chromeExists = await fileExists('/Applications/Google Chrome.app');
      
      // Check if .claude directory exists with proper structure
      const claudeDirExists = await fileExists(this.claudeDir);
      const agentsDirExists = await fileExists(this.agentsDir);
      
      return claudeVersion.includes('claude') && 
             flowVersion.includes('claude-flow') && 
             chromeExists && 
             claudeDirExists && 
             agentsDirExists;
    } catch {
      return false;
    }
  }

  async install(): Promise<void> {
    console.log('🤖 Installing Claude Code & Claude Flow ecosystem...');
    
    // Step 1: Install Claude CLI if not present
    await this.installClaudeCLI();
    
    // Step 2: Install Chrome for Browser MCP
    await this.installChrome();
    
    // Step 3: Setup Claude directory structure
    await this.setupClaudeDirectory();
    
    // Step 4: Install and configure MCP servers
    await this.installMCPServers();
    
    // Step 5: Configure Claude settings with hooks
    await this.configureClaudeSettings();
    
    // Step 6: Setup all 54 agents
    await this.setupAgents();
    
    // Step 7: Install Browser MCP Chrome extension
    await this.installBrowserExtension();
    
    // Step 8: Setup quality enforcement
    await this.setupQualityEnforcement();
    
    // Step 9: Create global CLAUDE.md generator
    await this.setupClaudeMdGenerator();
    
    console.log('✅ Claude Code & Claude Flow ecosystem installed successfully!');
  }

  private async installClaudeCLI(): Promise<void> {
    console.log('📦 Installing Claude CLI...');
    try {
      await execAsync('npm install -g @anthropic/claude-cli');
    } catch {
      // Try with sudo if needed
      await execAsync('sudo npm install -g @anthropic/claude-cli');
    }
  }

  private async installChrome(): Promise<void> {
    const chromeExists = await fileExists('/Applications/Google Chrome.app');
    if (!chromeExists) {
      console.log('🌐 Installing Google Chrome...');
      
      // Download Chrome DMG
      await execAsync('curl -L -o ~/Downloads/googlechrome.dmg "https://dl.google.com/chrome/mac/stable/GGRO/googlechrome.dmg"');
      
      // Mount and install Chrome
      await execAsync('hdiutil attach ~/Downloads/googlechrome.dmg');
      await execAsync('cp -R "/Volumes/Google Chrome/Google Chrome.app" /Applications/');
      await execAsync('hdiutil detach "/Volumes/Google Chrome"');
      
      // Set as default browser
      await execAsync('open -a "Google Chrome" --args --make-default-browser');
      
      // Clean up
      await execAsync('rm ~/Downloads/googlechrome.dmg');
    }
  }

  private async setupClaudeDirectory(): Promise<void> {
    console.log('📁 Setting up Claude directory structure...');
    
    // Create all necessary directories
    await createDirectory(this.claudeDir);
    await createDirectory(this.agentsDir);
    await createDirectory(this.commandsDir);
    await createDirectory(this.helpersDir);
    await createDirectory(path.join(this.claudeDir, '.claude-flow'));
    await createDirectory(path.join(this.claudeDir, '.roo'));
  }

  private async installMCPServers(): Promise<void> {
    console.log('🔧 Installing MCP servers...');
    
    // Install Claude Flow
    await execAsync('npx claude mcp add claude-flow npx claude-flow@alpha mcp start');
    
    // Install Firecrawl MCP
    await execAsync('npx claude mcp add firecrawl npx @firecrawl/mcp-server');
    
    // Install Context7 MCP
    await execAsync('npx claude mcp add context7 npx @context7/mcp-server');
    
    // Install Playwright MCP
    await execAsync('npx claude mcp add playwright npx @playwright/mcp-server');
    
    // Install Browser MCP
    await execAsync('npx claude mcp add browser npx @browser/mcp-server');
    
    // Install Sequential Thinking MCP
    await execAsync('npm install -g @modelcontextprotocol/server-sequentialthinking');
    await execAsync('npx claude mcp add sequentialthinking node ~/.npm-global/lib/node_modules/@modelcontextprotocol/server-sequentialthinking/dist/index.js');
  }

  private async configureClaudeSettings(): Promise<void> {
    console.log('⚙️ Configuring Claude settings with advanced hooks...');
    
    const settings = {
      "claudeCodeOptions": {
        "enabledMcpjsonServers": this.mcpServers,
        "gitAutoCompact": true,
        "gitStatusIgnorePattern": "\\.claude-flow/|\\.roo/|node_modules/|dist/|build/",
        "contextCompactionThreshold": 100000,
        "enableHooks": true,
        "enableAgentCoordination": true,
        "enableNeuralTraining": true,
        "enablePerformanceTracking": true
      },
      "hooks": {
        "preToolUse": [
          {
            "pattern": ".*",
            "command": "npx claude-flow@alpha hooks pre-task --description \"${tool}\"",
            "description": "Initialize task tracking"
          },
          {
            "pattern": "Write|Edit|MultiEdit",
            "command": "npx claude-flow@alpha hooks validate-write --file \"${file_path}\"",
            "description": "Validate file write safety"
          }
        ],
        "postToolUse": [
          {
            "pattern": "Write|Edit|MultiEdit",
            "command": "npx prettier --write \"${file_path}\" 2>/dev/null || true",
            "description": "Auto-format code"
          },
          {
            "pattern": ".*",
            "command": "npx claude-flow@alpha hooks post-edit --file \"${file_path}\" --memory-key \"swarm/${agent}/${step}\"",
            "description": "Update memory and patterns"
          }
        ],
        "sessionStart": [
          {
            "command": "npx claude-flow@alpha hooks session-start --profile \"${profile}\"",
            "description": "Initialize session with profile"
          }
        ],
        "sessionEnd": [
          {
            "command": "npx claude-flow@alpha hooks session-end --export-metrics true",
            "description": "Export session metrics"
          }
        ],
        "preCompactGuidance": [
          {
            "command": "npx claude-flow@alpha hooks compact-guidance --preserve-critical true",
            "description": "Guide context compaction"
          }
        ]
      },
      "permissions": {
        "allowCommands": [
          "npm run build",
          "npm run test",
          "npm run lint",
          "npm run typecheck",
          "npx claude-flow.*",
          "git status",
          "git diff",
          "git add",
          "git commit",
          "docker.*",
          "node.*",
          "npx.*"
        ],
        "denyCommands": [
          "rm -rf /",
          "sudo rm -rf",
          ":(){ :|:& };:",
          "mkfs.*",
          "dd if=/dev/zero"
        ]
      },
      "mcpServers": {
        "claude-flow": {
          "command": "npx",
          "args": ["claude-flow@alpha", "mcp", "start"],
          "env": {
            "CLAUDE_FLOW_MEMORY_BACKEND": "sqlite",
            "CLAUDE_FLOW_MEMORY_PATH": "~/.claude/.claude-flow/memory.db",
            "CLAUDE_FLOW_ENABLE_NEURAL": "true",
            "CLAUDE_FLOW_ENABLE_METRICS": "true"
          }
        },
        "firecrawl": {
          "command": "npx",
          "args": ["@firecrawl/mcp-server"],
          "env": {
            "FIRECRAWL_API_KEY": "${FIRECRAWL_API_KEY}"
          }
        },
        "context7": {
          "command": "npx",
          "args": ["@context7/mcp-server"],
          "env": {
            "CONTEXT7_API_KEY": "${CONTEXT7_API_KEY}"
          }
        },
        "playwright": {
          "command": "npx",
          "args": ["@playwright/mcp-server"],
          "env": {
            "PLAYWRIGHT_BROWSERS_PATH": "~/.cache/ms-playwright"
          }
        },
        "browser": {
          "command": "npx",
          "args": ["@browser/mcp-server"],
          "env": {
            "BROWSER_CHROME_PATH": "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
          }
        },
        "sequentialthinking": {
          "command": "node",
          "args": ["~/.npm-global/lib/node_modules/@modelcontextprotocol/server-sequentialthinking/dist/index.js"]
        }
      }
    };
    
    await writeFile(
      path.join(this.claudeDir, 'settings.json'),
      JSON.stringify(settings, null, 2)
    );
  }

  private async setupAgents(): Promise<void> {
    console.log('🤖 Setting up 54 specialized agents...');
    
    // Agent categories and configurations
    const agentCategories = {
      'core': ['coder', 'reviewer', 'tester', 'planner', 'researcher'],
      'swarm': ['hierarchical-coordinator', 'mesh-coordinator', 'adaptive-coordinator', 
                'collective-intelligence-coordinator', 'swarm-memory-manager'],
      'consensus': ['byzantine-coordinator', 'raft-manager', 'gossip-coordinator', 
                    'consensus-builder', 'crdt-synchronizer', 'quorum-manager', 'security-manager'],
      'performance': ['perf-analyzer', 'performance-benchmarker', 'task-orchestrator', 
                      'memory-coordinator', 'smart-agent'],
      'github': ['github-modes', 'pr-manager', 'code-review-swarm', 'issue-tracker', 
                 'release-manager', 'workflow-automation', 'project-board-sync', 
                 'repo-architect', 'multi-repo-swarm', 'sync-coordinator', 
                 'release-swarm', 'swarm-pr', 'swarm-issue'],
      'sparc': ['sparc-coord', 'sparc-coder', 'specification', 'pseudocode', 
                'architecture', 'refinement'],
      'specialized': ['backend-dev', 'mobile-dev', 'ml-developer', 'cicd-engineer', 
                      'api-docs', 'system-architect', 'code-analyzer', 
                      'base-template-generator', 'production-validator', 
                      'tdd-london-swarm', 'migration-planner', 'swarm-init']
    };
    
    for (const [category, agents] of Object.entries(agentCategories)) {
      const categoryDir = path.join(this.agentsDir, category);
      await createDirectory(categoryDir);
      
      for (const agent of agents) {
        await this.createAgentConfig(categoryDir, agent, category);
      }
    }
  }

  private async createAgentConfig(dir: string, agentName: string, category: string): Promise<void> {
    const agentConfig = {
      name: agentName,
      category,
      description: this.getAgentDescription(agentName),
      capabilities: this.getAgentCapabilities(agentName),
      tools: this.getAgentTools(agentName),
      configuration: {
        maxTokens: 8000,
        temperature: 0.7,
        topP: 0.9,
        enableMemory: true,
        enableLearning: true
      },
      hooks: {
        preTask: `npx claude-flow@alpha agent init --type ${agentName}`,
        postTask: `npx claude-flow@alpha agent complete --type ${agentName}`,
        onError: `npx claude-flow@alpha agent error --type ${agentName}`
      }
    };
    
    await writeFile(
      path.join(dir, `${agentName}.json`),
      JSON.stringify(agentConfig, null, 2)
    );
  }

  private getAgentDescription(agentName: string): string {
    const descriptions: Record<string, string> = {
      'coder': 'Implementation specialist for writing clean, efficient code',
      'reviewer': 'Code review and quality assurance specialist',
      'tester': 'Comprehensive testing and quality assurance specialist',
      'planner': 'Strategic planning and task orchestration agent',
      'researcher': 'Deep research and information gathering specialist',
      'hierarchical-coordinator': 'Queen-led hierarchical swarm coordination',
      'mesh-coordinator': 'Peer-to-peer mesh network swarm',
      'adaptive-coordinator': 'Dynamic topology switching coordinator',
      'byzantine-coordinator': 'Byzantine fault-tolerant consensus protocols',
      'sparc-coord': 'SPARC methodology orchestrator',
      'github-modes': 'Comprehensive GitHub integration',
      'ml-developer': 'Machine learning model development',
      'mobile-dev': 'React Native mobile application development',
      'backend-dev': 'Backend API development specialist',
      'system-architect': 'System architecture design expert'
    };
    
    return descriptions[agentName] || `Specialized agent for ${agentName} tasks`;
  }

  private getAgentCapabilities(agentName: string): string[] {
    const baseCapabilities = ['task-execution', 'memory-access', 'learning'];
    
    const specificCapabilities: Record<string, string[]> = {
      'coder': ['code-generation', 'refactoring', 'optimization'],
      'reviewer': ['code-analysis', 'vulnerability-detection', 'best-practices'],
      'tester': ['unit-testing', 'integration-testing', 'e2e-testing'],
      'planner': ['task-decomposition', 'dependency-analysis', 'scheduling'],
      'researcher': ['web-search', 'documentation-analysis', 'synthesis']
    };
    
    return [...baseCapabilities, ...(specificCapabilities[agentName] || [])];
  }

  private getAgentTools(agentName: string): string[] {
    const baseTools = ['Read', 'Write', 'Edit', 'Bash'];
    
    const specificTools: Record<string, string[]> = {
      'coder': ['MultiEdit', 'TodoWrite'],
      'reviewer': ['Grep', 'Glob', 'WebSearch'],
      'tester': ['Bash', 'TodoWrite'],
      'planner': ['TodoWrite', 'Task'],
      'researcher': ['WebSearch', 'WebFetch', 'Grep']
    };
    
    return [...baseTools, ...(specificTools[agentName] || [])];
  }

  private async installBrowserExtension(): Promise<void> {
    console.log('🔌 Installing Browser MCP Chrome extension...');
    
    const extensionDir = path.join(this.homeDir, '.claude', 'browser-extension');
    await createDirectory(extensionDir);
    
    // Create manifest.json
    const manifest = {
      "manifest_version": 3,
      "name": "Browser MCP Bridge",
      "version": "1.0.0",
      "description": "Bridge for Browser MCP server",
      "permissions": ["activeTab", "storage", "debugger"],
      "background": {
        "service_worker": "background.js"
      },
      "content_scripts": [{
        "matches": ["<all_urls>"],
        "js": ["content.js"]
      }],
      "action": {
        "default_popup": "popup.html"
      }
    };
    
    await writeFile(
      path.join(extensionDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );
    
    // Create background script
    const backgroundScript = `
// Browser MCP Bridge - Background Service Worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'MCP_COMMAND') {
    // Forward to MCP server
    fetch('http://localhost:3000/mcp/browser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.data)
    })
    .then(response => response.json())
    .then(data => sendResponse(data))
    .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});`;
    
    await writeFile(path.join(extensionDir, 'background.js'), backgroundScript);
    
    // Create content script
    const contentScript = `
// Browser MCP Bridge - Content Script
window.addEventListener('message', (event) => {
  if (event.data.type === 'MCP_BROWSER_ACTION') {
    chrome.runtime.sendMessage({
      type: 'MCP_COMMAND',
      data: event.data
    });
  }
});`;
    
    await writeFile(path.join(extensionDir, 'content.js'), contentScript);
    
    // Create popup HTML
    const popupHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Browser MCP</title>
  <style>
    body { width: 200px; padding: 10px; }
    .status { color: green; }
  </style>
</head>
<body>
  <h3>Browser MCP</h3>
  <p class="status">Connected</p>
</body>
</html>`;
    
    await writeFile(path.join(extensionDir, 'popup.html'), popupHtml);
    
    console.log('📌 Chrome extension created. Load it manually from chrome://extensions');
  }

  private async setupQualityEnforcement(): Promise<void> {
    console.log('📊 Setting up quality enforcement...');
    
    // Create pre-commit hook template
    const preCommitHook = `#!/bin/bash
# Claude Code Quality Enforcement Hook

echo "🔍 Running quality checks..."

# Type checking
if [ -f "tsconfig.json" ]; then
  echo "📝 Type checking..."
  npm run typecheck || exit 1
fi

# Linting
if [ -f ".eslintrc.json" ] || [ -f ".eslintrc.js" ]; then
  echo "🧹 Linting..."
  npm run lint || exit 1
fi

# Tests
if [ -f "package.json" ] && grep -q '"test"' package.json; then
  echo "🧪 Running tests..."
  npm test || exit 1
fi

# Claude Flow validation
echo "🤖 Validating with Claude Flow..."
npx claude-flow@alpha validate --pre-commit || exit 1

echo "✅ All quality checks passed!"`;
    
    await writeFile(
      path.join(this.helpersDir, 'pre-commit-hook.sh'),
      preCommitHook
    );
    
    await execAsync(`chmod +x ${path.join(this.helpersDir, 'pre-commit-hook.sh')}`);
  }

  private async setupClaudeMdGenerator(): Promise<void> {
    console.log('📝 Setting up global CLAUDE.md generator...');
    
    // Create the generator script
    const generatorScript = `#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Check if in a git repository
try {
  execSync('git rev-parse --git-dir', { stdio: 'ignore' });
} catch {
  console.error('❌ Not in a git repository');
  process.exit(1);
}

// Read package.json if it exists
let projectInfo = {
  name: path.basename(process.cwd()),
  description: 'Project repository',
  scripts: {}
};

if (fs.existsSync('package.json')) {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  projectInfo = {
    name: pkg.name || projectInfo.name,
    description: pkg.description || projectInfo.description,
    scripts: pkg.scripts || {}
  };
}

// Detect project type
const hasTypeScript = fs.existsSync('tsconfig.json');
const hasReact = fs.existsSync('package.json') && 
  fs.readFileSync('package.json', 'utf8').includes('react');
const hasNext = fs.existsSync('next.config.js');
const isMonorepo = fs.existsSync('lerna.json') || fs.existsSync('pnpm-workspace.yaml');

// Generate CLAUDE.md content
const claudeMd = \`# Claude Code Configuration - \${projectInfo.name}

## Project: \${projectInfo.name}
\${projectInfo.description}

## 🚨 CRITICAL: VERIFICATION PROTOCOL

### MANDATORY: ALWAYS VERIFY, NEVER ASSUME
**After EVERY code change:**
1. **TEST IT**: Run the actual command and show real output
2. **PROVE IT**: Show file contents, build results, test output
3. **FAIL LOUDLY**: If something fails, say "❌ FAILED:" immediately

## Project Type
- TypeScript: \${hasTypeScript ? 'Yes' : 'No'}
- React: \${hasReact ? 'Yes' : 'No'}
- Next.js: \${hasNext ? 'Yes' : 'No'}
- Monorepo: \${isMonorepo ? 'Yes' : 'No'}

## Available Scripts
\${Object.entries(projectInfo.scripts)
  .map(([key, value]) => \`- \\\`npm run \${key}\\\`: \${value}\`)
  .join('\\n')}

## Quality Standards
- Always run \\\`npm run build\\\` after changes
- Always run \\\`npm run test\\\` if available
- Always run \\\`npm run lint\\\` before committing
- Always run \\\`npm run typecheck\\\` for TypeScript projects

## Agent Configuration
\${hasTypeScript ? '- Use typescript-specialist agent for type-safe code' : ''}
\${hasReact ? '- Use react-developer agent for component development' : ''}
\${hasNext ? '- Use nextjs-specialist agent for Next.js features' : ''}
\${isMonorepo ? '- Use monorepo-manager agent for package coordination' : ''}

## MCP Tools
- claude-flow: Orchestration and coordination
- firecrawl: Web scraping if needed
- playwright: E2E testing
\${hasReact ? '- browser: Real browser testing' : ''}

Generated on: \${new Date().toISOString()}
\`;

// Write CLAUDE.md
fs.writeFileSync('CLAUDE.md', claudeMd);
console.log('✅ CLAUDE.md generated successfully!');

// Initialize Claude Flow
console.log('🚀 Initializing Claude Flow...');
execSync('npx claude-flow@alpha init', { stdio: 'inherit' });
`;
    
    await writeFile(
      path.join(this.helpersDir, 'generate-claude-md.js'),
      generatorScript
    );
    
    await execAsync(`chmod +x ${path.join(this.helpersDir, 'generate-claude-md.js')}`);
    
    // Create global command
    await execAsync(`ln -sf ${path.join(this.helpersDir, 'generate-claude-md.js')} /usr/local/bin/claude-init`);
  }

  async configure(options?: any): Promise<void> {
    // Additional configuration based on profile
    if (options?.profile) {
      console.log(`🎯 Configuring for ${options.profile} profile...`);
      
      const profileConfigs: Record<string, string[]> = {
        'fullstack': ['backend-dev', 'mobile-dev', 'system-architect'],
        'frontend': ['react-developer', 'mobile-dev', 'ui-specialist'],
        'backend': ['backend-dev', 'api-docs', 'system-architect'],
        'devops': ['cicd-engineer', 'workflow-automation', 'perf-analyzer']
      };
      
      const agents = profileConfigs[options.profile] || [];
      for (const agent of agents) {
        await this.createAgentConfig(this.agentsDir, agent, 'profile-specific');
      }
    }
  }
}

export default new ClaudeInstaller();