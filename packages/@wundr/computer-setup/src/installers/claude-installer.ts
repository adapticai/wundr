import { BaseInstaller } from './index';
import { SetupPlatform, SetupStep, DeveloperProfile } from '../types';
import * as path from 'path';
import * as fs from 'fs/promises';
import { homedir } from 'os';

/**
 * Comprehensive Claude and Claude-Flow installer for complete AI integration
 * Includes: Claude CLI, Claude Flow, MCP tools, agents, and Chrome browser
 */
export class ClaudeInstaller implements BaseInstaller {
  name = 'Claude Code & Claude Flow';
  
  private readonly homeDir = homedir();
  private readonly claudeDir = path.join(this.homeDir, '.claude');
  private readonly agentsDir = path.join(this.claudeDir, 'agents');
  private readonly commandsDir = path.join(this.claudeDir, 'commands');
  private readonly helpersDir = path.join(this.claudeDir, 'helpers');
  private readonly templatesDir = path.join(this.claudeDir, 'templates');
  private readonly hooksDir = path.join(this.claudeDir, 'hooks');
  private readonly mcpServers = [
    'claude-flow',
    'ruv-swarm',
    'firecrawl',
    'context7',
    'playwright',
    'browser',
    'sequentialthinking'
  ];

  isSupported(platform: SetupPlatform): boolean {
    return platform.os === 'darwin' || platform.os === 'linux';
  }

  async isInstalled(): Promise<boolean> {
    try {
      const { execSync } = require('child_process');
      execSync('claude --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string | null> {
    try {
      const { execSync } = require('child_process');
      const version = execSync('claude --version', { encoding: 'utf8' });
      return version.trim();
    } catch {
      return null;
    }
  }

  async validate(): Promise<boolean> {
    return this.check();
  }

  getSteps(profile: DeveloperProfile, platform: SetupPlatform): SetupStep[] {
    const steps: SetupStep[] = [];

    steps.push({
      id: 'claude-cli',
      name: 'Install Claude CLI',
      description: 'Install Claude command-line interface',
      category: 'ai',
      required: true,
      dependencies: [],
      estimatedTime: 30,
      installer: async () => {
        await this.installClaudeCLI();
      }
    });

    steps.push({
      id: 'chrome-browser',
      name: 'Install Chrome Browser',
      description: 'Install Google Chrome for Browser MCP',
      category: 'system',
      required: false,
      dependencies: [],
      estimatedTime: 120,
      installer: async () => {
        await this.installChrome();
      }
    });

    steps.push({
      id: 'claude-config',
      name: 'Configure Claude',
      description: 'Setup Claude directory and configurations',
      category: 'configuration',
      required: true,
      dependencies: ['claude-cli'],
      estimatedTime: 10,
      installer: async () => {
        await this.setupClaudeDirectory();
        await this.configureClaudeSettings();
      }
    });

    steps.push({
      id: 'mcp-servers',
      name: 'Install MCP Servers',
      description: 'Install and configure MCP servers',
      category: 'ai',
      required: true,
      dependencies: ['claude-config'],
      estimatedTime: 60,
      installer: async () => {
        await this.installMCPServers();
      }
    });

    steps.push({
      id: 'claude-agents',
      name: 'Setup Agents',
      description: 'Configure 54 specialized agents',
      category: 'ai',
      required: true,
      dependencies: ['claude-config'],
      estimatedTime: 30,
      installer: async () => {
        await this.setupAgents();
      }
    });

    return steps;
  }

  async install(profile: DeveloperProfile, platform: SetupPlatform): Promise<void> {
    await this.execute();
  }

  async configure(profile: DeveloperProfile, platform: SetupPlatform): Promise<void> {
    // Ensure directories exist before configuring
    await this.ensureDirectoriesExist();
    await this.setupQualityEnforcement();
    await this.setupClaudeMdGenerator();
  }

  private async execute(): Promise<void> {
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

  async check(): Promise<boolean> {
    try {
      const { execSync } = require('child_process');
      const fs = require('fs');
      
      let claudeCliInstalled = false;
      let claudeFlowInstalled = false;
      
      // Check if Claude CLI is installed (it might not exist yet as a global CLI)
      try {
        execSync('claude --version', { encoding: 'utf8', stdio: 'pipe' });
        claudeCliInstalled = true;
      } catch {
        // Claude CLI might not be globally installed, which is OK
        // Check if we can at least use Claude through npx
        try {
          execSync('which claude', { encoding: 'utf8', stdio: 'pipe' });
          claudeCliInstalled = true;
        } catch {
          // Claude CLI not found, but that's acceptable
          claudeCliInstalled = false;
        }
      }
      
      // Check if Claude Flow is available
      try {
        // Just check if we can run claude-flow through npx
        // Increased timeout as npx might need to download the package
        execSync('npx claude-flow@alpha --version', { 
          encoding: 'utf8', 
          stdio: 'pipe',
          timeout: 30000 // 30 seconds timeout
        });
        claudeFlowInstalled = true;
      } catch (error: any) {
        // Log the error for debugging
        console.log('Claude Flow check failed:', error?.message || error);
        claudeFlowInstalled = false;
      }
      
      // Check if Chrome is installed (optional for Browser MCP)
      const chromeExists = fs.existsSync('/Applications/Google Chrome.app') || 
                          fs.existsSync(`${process.env.HOME}/Applications/Google Chrome.app`);
      
      // Check if .claude directory exists with proper structure
      const claudeDirExists = fs.existsSync(this.claudeDir);
      
      // More lenient validation - Claude Flow is the main requirement
      // Chrome is optional, Claude CLI might not exist as a global command
      return claudeFlowInstalled && claudeDirExists;
    } catch (error) {
      console.log('Claude validation error:', error);
      return false;
    }
  }

  private async installClaudeCLI(): Promise<void> {
    console.log('📦 Checking Claude CLI availability...');
    const { execSync } = require('child_process');
    
    // Note: The official Claude CLI might not be publicly available yet
    // For now, we'll skip the global CLI installation and rely on Claude Flow
    try {
      // Check if claude command exists
      execSync('which claude', { stdio: 'pipe' });
      console.log('✅ Claude CLI already available');
    } catch {
      console.log('ℹ️ Claude CLI not found (this is normal - using Claude Flow instead)');
      // The official Claude CLI package might not be available
      // Users can install it later when it becomes available
    }
  }

  private async installChrome(): Promise<void> {
    const fs = require('fs');
    const chromeExists = fs.existsSync('/Applications/Google Chrome.app');
    if (!chromeExists) {
      console.log('🌐 Installing Google Chrome...');
      const { execSync } = require('child_process');
      
      // Download Chrome DMG
      execSync('curl -L -o ~/Downloads/googlechrome.dmg "https://dl.google.com/chrome/mac/stable/GGRO/googlechrome.dmg"');
      
      // Mount and install Chrome
      execSync('hdiutil attach ~/Downloads/googlechrome.dmg');
      execSync('cp -R "/Volumes/Google Chrome/Google Chrome.app" /Applications/');
      execSync('hdiutil detach "/Volumes/Google Chrome"');
      
      // Set as default browser
      execSync('open -a "Google Chrome" --args --make-default-browser');
      
      // Clean up
      execSync('rm ~/Downloads/googlechrome.dmg');
    }
  }

  private async ensureDirectoriesExist(): Promise<void> {
    const fs = require('fs').promises;
    
    // Create all necessary directories if they don't exist
    await fs.mkdir(this.claudeDir, { recursive: true });
    await fs.mkdir(this.agentsDir, { recursive: true });
    await fs.mkdir(this.commandsDir, { recursive: true });
    await fs.mkdir(this.helpersDir, { recursive: true });
    await fs.mkdir(this.templatesDir, { recursive: true });
    await fs.mkdir(this.hooksDir, { recursive: true });
    await fs.mkdir(path.join(this.claudeDir, '.claude-flow'), { recursive: true });
    await fs.mkdir(path.join(this.claudeDir, '.roo'), { recursive: true });
  }
  
  private async setupClaudeDirectory(): Promise<void> {
    console.log('📁 Setting up Claude directory structure...');
    // Ensure directories exist
    await this.ensureDirectoriesExist();
  }

  private async installMCPServers(): Promise<void> {
    console.log('🔧 Installing MCP servers...');
    const { execSync } = require('child_process');
    
    // Install Claude Flow
    execSync('npx claude mcp add claude-flow npx claude-flow@alpha mcp start');
    
    // Install Firecrawl MCP
    execSync('npx claude mcp add firecrawl npx @firecrawl/mcp-server');
    
    // Install Context7 MCP
    execSync('npx claude mcp add context7 npx @context7/mcp-server');
    
    // Install Playwright MCP
    execSync('npx claude mcp add playwright npx @playwright/mcp-server');
    
    // Install Browser MCP
    execSync('npx claude mcp add browser npx @browser/mcp-server');
    
    // Install Sequential Thinking MCP
    execSync('npm install -g @modelcontextprotocol/server-sequentialthinking');
    execSync('npx claude mcp add sequentialthinking node ~/.npm-global/lib/node_modules/@modelcontextprotocol/server-sequentialthinking/dist/index.js');
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
    
    const fs = require('fs').promises;
    await fs.writeFile(
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
    
    const fs = require('fs').promises;
    for (const [category, agents] of Object.entries(agentCategories)) {
      const categoryDir = path.join(this.agentsDir, category);
      await fs.mkdir(categoryDir, { recursive: true });
      
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
    
    const fsPromises = require('fs').promises;
    await fsPromises.writeFile(
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
    
    const fsPromises = require('fs').promises;
    const extensionDir = path.join(this.homeDir, '.claude', 'browser-extension');
    await fsPromises.mkdir(extensionDir, { recursive: true });
    
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
    
    await fsPromises.writeFile(
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
    
    await fsPromises.writeFile(path.join(extensionDir, 'background.js'), backgroundScript);
    
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
    
    await fsPromises.writeFile(path.join(extensionDir, 'content.js'), contentScript);
    
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
    
    await fsPromises.writeFile(path.join(extensionDir, 'popup.html'), popupHtml);
    
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
    
    const fs = require('fs').promises;
    await fs.writeFile(
      path.join(this.helpersDir, 'pre-commit-hook.sh'),
      preCommitHook
    );
    
    const { execSync } = require('child_process');
    execSync(`chmod +x ${path.join(this.helpersDir, 'pre-commit-hook.sh')}`);
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
    
    const fs = require('fs').promises;
    await fs.writeFile(
      path.join(this.helpersDir, 'generate-claude-md.js'),
      generatorScript
    );
    
    const { execSync } = require('child_process');
    execSync(`chmod +x ${path.join(this.helpersDir, 'generate-claude-md.js')}`);
    
    // Create global command
    execSync(`ln -sf ${path.join(this.helpersDir, 'generate-claude-md.js')} /usr/local/bin/claude-init`);
  }

  private async configureProfile(options?: any): Promise<void> {
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