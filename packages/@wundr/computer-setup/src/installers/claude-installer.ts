import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import { homedir } from 'os';
import * as path from 'path';

import { Logger } from '../utils/logger';

import type { DeveloperProfile, SetupPlatform, SetupStep } from '../types';
import type { BaseInstaller } from './index';

const logger = new Logger({ name: 'ClaudeInstaller' });

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
  private readonly scriptsDir = path.join(this.claudeDir, 'scripts');
  // Bundled resources directory (packaged with npm module)
  private readonly resourcesDir = path.join(__dirname, '../../resources');
  private readonly bundledAgentsDir = path.join(this.resourcesDir, 'agents');
  private readonly bundledTemplatesDir = path.join(
    this.resourcesDir,
    'templates'
  );
  private readonly bundledCommandsDir = path.join(
    this.resourcesDir,
    'commands'
  );
  private readonly bundledScriptsDir = path.join(this.resourcesDir, 'scripts');
  private readonly mcpServers = [
    'claude-flow',
    'ruv-swarm',
    'firecrawl',
    'context7',
    'playwright',
    'browser',
    'sequentialthinking',
    // Deployment platform MCP servers
    'railway',
    'netlify',
  ];

  isSupported(platform: SetupPlatform): boolean {
    return platform.os === 'darwin' || platform.os === 'linux';
  }

  async isInstalled(): Promise<boolean> {
    try {
      execSync('claude --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string | null> {
    try {
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

    // Determine if user wants AI tools based on profile preferences
    const wantsAiTools = profile.preferences?.aiTools?.claudeCode !== false;

    steps.push({
      id: 'claude-cli',
      name: 'Install Claude CLI',
      description: 'Install Claude command-line interface',
      category: 'ai',
      required: wantsAiTools,
      dependencies: [],
      estimatedTime: 30,
      installer: async () => {
        await this.installClaudeCLI();
      },
    });

    // Chrome is only needed on macOS and Linux (not in headless environments)
    // Check if browser MCP is in the list of MCP tools
    const mcpTools = profile.preferences?.aiTools?.mcpTools || [];
    const needsChrome =
      ['darwin', 'linux'].includes(platform.os) &&
      mcpTools.some(tool => tool.toLowerCase().includes('browser'));

    steps.push({
      id: 'chrome-browser',
      name: 'Install Chrome Browser',
      description: `Install Google Chrome for Browser MCP on ${platform.os}`,
      category: 'system',
      required: false,
      dependencies: [],
      estimatedTime: platform.os === 'darwin' ? 120 : 180, // Longer on Linux
      installer: async () => {
        if (needsChrome) {
          await this.installChrome();
        }
      },
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
      },
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
      },
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
      },
    });

    steps.push({
      id: 'claude-commands',
      name: 'Setup Slash Commands',
      description: 'Install corrected hive-mind and other slash commands',
      category: 'ai',
      required: true,
      dependencies: ['claude-config'],
      estimatedTime: 10,
      installer: async () => {
        await this.setupCommands();
      },
    });

    return steps;
  }

  async install(
    profile: DeveloperProfile,
    platform: SetupPlatform
  ): Promise<void> {
    // Store profile and platform for use in execute
    this.currentProfile = profile;
    this.currentPlatform = platform;
    await this.execute();
  }

  // Store current installation context
  private currentProfile?: DeveloperProfile;
  private currentPlatform?: SetupPlatform;

  async configure(
    profile: DeveloperProfile,
    platform: SetupPlatform
  ): Promise<void> {
    // Ensure directories exist before configuring
    await this.ensureDirectoriesExist();
    await this.setupQualityEnforcement();
    await this.setupClaudeMdGenerator();

    // Apply profile-specific configurations
    if (profile.preferences?.aiTools?.mcpTools) {
      // User has specific MCP tool preferences
      logger.info(
        `Configuring MCP tools for ${profile.name} on ${platform.os}`
      );
    }
  }

  private async execute(): Promise<void> {
    logger.info('Installing Claude Code & Claude Flow ecosystem...');

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

    // Step 6.5: Setup slash commands with correct MCP tool names
    await this.setupCommands();

    // Step 7: Install Browser MCP Chrome extension
    await this.installBrowserExtension();

    // Step 8: Setup quality enforcement
    await this.setupQualityEnforcement();

    // Step 9: Create global CLAUDE.md generator
    await this.setupClaudeMdGenerator();

    // Step 10: Setup hardware-adaptive optimization scripts
    await this.setupOptimizationScripts();

    logger.info('Claude Code & Claude Flow ecosystem installed successfully!');
  }

  async check(): Promise<boolean> {
    try {
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

      // Log Claude CLI status for debugging purposes
      if (!claudeCliInstalled) {
        logger.debug('Claude CLI not found - will use npx fallback');
      }

      // Check if Claude Flow is available
      try {
        // Just check if we can run claude-flow through npx
        // Increased timeout as npx might need to download the package
        execSync('npx claude-flow@alpha --version', {
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 30000, // 30 seconds timeout
        });
        claudeFlowInstalled = true;
      } catch (error: unknown) {
        // Log the error for debugging
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.debug('Claude Flow check failed:', errorMessage);
        claudeFlowInstalled = false;
      }

      // Check if Chrome is installed (optional for Browser MCP)
      const chromeExists =
        fsSync.existsSync('/Applications/Google Chrome.app') ||
        fsSync.existsSync(`${process.env.HOME}/Applications/Google Chrome.app`);

      // Log Chrome status for debugging (optional dependency)
      if (!chromeExists) {
        logger.debug('Chrome not found - Browser MCP features will be limited');
      }

      // Check if .claude directory exists with proper structure
      const claudeDirExists = fsSync.existsSync(this.claudeDir);

      // More lenient validation - Claude Flow is the main requirement
      // Chrome is optional, Claude CLI might not exist as a global command
      return claudeFlowInstalled && claudeDirExists;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.debug('Claude validation error:', errorMessage);
      return false;
    }
  }

  private async installClaudeCLI(): Promise<void> {
    logger.info('Installing Claude Code CLI...');

    // Install @anthropic-ai/claude-code globally via npm
    logger.info('Installing @anthropic-ai/claude-code globally...');
    try {
      execSync('npm install -g @anthropic-ai/claude-code', {
        stdio: 'inherit',
      });
      logger.info('Claude Code CLI installed successfully');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to install Claude Code CLI:', errorMessage);
      throw error;
    }

    // Create a global wrapper script that uses resource manager for session pooling
    const wrapperScript = `#!/bin/bash
# Claude Code CLI Wrapper - Resource Managed
# Auto-generated by Wundr Computer Setup
#
# Features enabled:
# - Session pooling (limits concurrent Claude instances)
# - Stale session cleanup
# - Hardware-adaptive V8 memory optimization
#
# To bypass resource manager: CLAUDE_SKIP_RESOURCE_MANAGER=1 claude [args]

# Load NVM if available
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"

# Check for bypass flag
if [ "\${CLAUDE_SKIP_RESOURCE_MANAGER:-}" = "1" ]; then
  # Direct execution without resource manager
  CLAUDE_BIN=$(command -v claude 2>/dev/null || find "$NVM_DIR/versions/node" -name claude -type f 2>/dev/null | head -n 1)
  if [ -n "$CLAUDE_BIN" ] && [ "$CLAUDE_BIN" != "$0" ]; then
    exec "$CLAUDE_BIN" "$@"
  fi
  exec npx @anthropic-ai/claude-code "$@"
fi

# Use resource manager if available (includes session pooling + hardware optimization)
RESOURCE_MANAGER="$HOME/.claude/scripts/claude-resource-manager"
if [ -f "$RESOURCE_MANAGER" ] && [ -x "$RESOURCE_MANAGER" ]; then
  exec "$RESOURCE_MANAGER" "$@"
fi

# Fallback to hardware-optimized wrapper
OPTIMIZED="$HOME/.claude/scripts/claude-optimized"
if [ -f "$OPTIMIZED" ] && [ -x "$OPTIMIZED" ]; then
  exec "$OPTIMIZED" "$@"
fi

# Final fallback: find claude binary directly
CLAUDE_BIN=$(find "$NVM_DIR/versions/node" -name claude -type f 2>/dev/null | head -n 1)
if [ -n "$CLAUDE_BIN" ]; then
  exec "$CLAUDE_BIN" "$@"
fi

# Last resort: use npx
exec npx @anthropic-ai/claude-code "$@"
`;

    // Write wrapper to /usr/local/bin/claude
    const wrapperPath = '/usr/local/bin/claude';
    const tempFile = '/tmp/claude-wrapper.sh';

    try {
      // First write to temp location
      await fs.writeFile(tempFile, wrapperScript);
      execSync(`chmod +x ${tempFile}`);

      // Try to move to /usr/local/bin (may require sudo)
      try {
        execSync(`mv ${tempFile} ${wrapperPath}`, { stdio: 'pipe' });
        logger.info('Created global claude wrapper at /usr/local/bin/claude');
      } catch (mvError: unknown) {
        // If regular mv fails, try with sudo
        const mvErrorMessage =
          mvError instanceof Error ? mvError.message : String(mvError);
        logger.info(
          `Regular move failed (${mvErrorMessage}), trying with sudo...`
        );
        try {
          execSync(`sudo mv ${tempFile} ${wrapperPath}`, { stdio: 'inherit' });
          logger.info('Created global claude wrapper at /usr/local/bin/claude');
        } catch (sudoError: unknown) {
          const sudoErrorMessage =
            sudoError instanceof Error ? sudoError.message : String(sudoError);
          logger.warn(
            `Could not create /usr/local/bin/claude wrapper: ${sudoErrorMessage}`
          );
          logger.warn(
            'Claude will use shell alias instead (requires terminal restart)'
          );
          logger.warn('To install wrapper manually, run:');
          logger.warn(`sudo mv ${tempFile} ${wrapperPath}`);
        }
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to create wrapper script:', errorMessage);
      logger.warn(
        'Claude will use shell alias instead (requires terminal restart)'
      );
    }

    // Also add to shell configs for redundancy
    await this.addToShellConfig();
  }

  private async addToShellConfig(): Promise<void> {
    const shellConfigs = [
      path.join(this.homeDir, '.zshrc'),
      path.join(this.homeDir, '.bashrc'),
      path.join(this.homeDir, '.bash_profile'),
    ];

    const configBlock = `
# ═══════════════════════════════════════════════════════════════════════════
# Claude Code - Resource Managed Configuration (Auto-generated by Wundr)
# ═══════════════════════════════════════════════════════════════════════════
#
# Features:
# - Session pooling (limits concurrent Claude instances)
# - Stale session cleanup
# - Hardware-adaptive V8 memory optimization
#
# To bypass: CLAUDE_SKIP_RESOURCE_MANAGER=1 claude [args]

# Ensure PATH includes usr/local/bin
export PATH="/usr/local/bin:$PATH"

# Hardware-adaptive V8 memory configuration
if [ -f "$HOME/.claude/scripts/detect-hardware-limits.js" ]; then
  eval "$(node $HOME/.claude/scripts/detect-hardware-limits.js export 2>/dev/null)"
fi

# Alias 'claude' to use resource-managed wrapper (includes session pooling)
if [ -f "$HOME/.claude/scripts/claude-resource-manager" ]; then
  alias claude="$HOME/.claude/scripts/claude-resource-manager"
elif [ -f "$HOME/.claude/scripts/claude-optimized" ]; then
  # Fallback to hardware-optimized if resource manager not available
  alias claude="$HOME/.claude/scripts/claude-optimized"
else
  # Final fallback to standard claude
  alias claude='npx @anthropic-ai/claude-code'
fi

# Convenience aliases for Claude tools
alias claude-stats='node $HOME/.claude/scripts/detect-hardware-limits.js 2>/dev/null || echo "Optimization scripts not installed"'
alias claude-cleanup='$HOME/.claude/scripts/claude-resource-manager --cleanup-stale 2>/dev/null || $HOME/.claude/scripts/cleanup-zombies.sh 2>/dev/null || echo "Cleanup script not installed"'
alias claude-pool-status='$HOME/.claude/scripts/claude-resource-manager --pool-status 2>/dev/null || echo "Resource manager not installed"'
alias claude-orchestrate='node $HOME/.claude/scripts/orchestrator.js'

# ═══════════════════════════════════════════════════════════════════════════
`;

    for (const configFile of shellConfigs) {
      try {
        const exists = await fs
          .access(configFile)
          .then(() => true)
          .catch(() => false);
        if (exists) {
          const content = await fs.readFile(configFile, 'utf8');
          // Check for both old and new config block headers (idempotency)
          const hasOldConfig = content.includes(
            'Claude Code - Hardware-Adaptive Configuration'
          );
          const hasNewConfig = content.includes(
            'Claude Code - Resource Managed Configuration'
          );
          if (!hasOldConfig && !hasNewConfig) {
            await fs.appendFile(configFile, configBlock);
            logger.info(
              `Added Claude hardware-adaptive and resource-managed config to ${path.basename(configFile)}`
            );
          } else if (hasOldConfig && !hasNewConfig) {
            // Upgrade from old config to new config
            logger.info(
              `Existing Claude config found in ${path.basename(configFile)} - run 'source ~/${path.basename(configFile)}' after setup to get resource manager features`
            );
          } else {
            logger.debug(
              `Claude config already exists in ${path.basename(configFile)}, skipping`
            );
          }
        }
      } catch {
        // Shell config file doesn't exist - this is expected behavior
        // Many systems only have one shell config (e.g., .zshrc but not .bashrc)
      }
    }
  }

  private async installChrome(): Promise<void> {
    const chromeExists = fsSync.existsSync('/Applications/Google Chrome.app');
    if (!chromeExists) {
      logger.info('Installing Google Chrome...');

      // Download Chrome DMG
      execSync(
        'curl -L -o ~/Downloads/googlechrome.dmg "https://dl.google.com/chrome/mac/stable/GGRO/googlechrome.dmg"'
      );

      // Mount and install Chrome
      execSync('hdiutil attach ~/Downloads/googlechrome.dmg');
      execSync(
        'cp -R "/Volumes/Google Chrome/Google Chrome.app" /Applications/'
      );
      execSync('hdiutil detach "/Volumes/Google Chrome"');

      // Set as default browser
      execSync('open -a "Google Chrome" --args --make-default-browser');

      // Clean up
      execSync('rm ~/Downloads/googlechrome.dmg');
    }
  }

  private async ensureDirectoriesExist(): Promise<void> {
    // Create all necessary directories if they don't exist
    await fs.mkdir(this.claudeDir, { recursive: true });
    await fs.mkdir(this.agentsDir, { recursive: true });
    await fs.mkdir(this.commandsDir, { recursive: true });
    await fs.mkdir(this.helpersDir, { recursive: true });
    await fs.mkdir(this.templatesDir, { recursive: true });
    await fs.mkdir(this.hooksDir, { recursive: true });
    await fs.mkdir(this.scriptsDir, { recursive: true });
    await fs.mkdir(path.join(this.claudeDir, '.claude-flow'), {
      recursive: true,
    });
    await fs.mkdir(path.join(this.claudeDir, '.roo'), { recursive: true });
  }

  private async setupClaudeDirectory(): Promise<void> {
    logger.info('Setting up Claude directory structure...');
    // Ensure directories exist
    await this.ensureDirectoriesExist();
  }

  private async installMCPServers(): Promise<void> {
    logger.info('Installing MCP servers...');

    // Check if claude CLI is available
    try {
      execSync('which claude', { stdio: 'pipe' });
    } catch {
      logger.info(
        'Claude CLI not found - MCP servers require Claude Code CLI to be installed first'
      );
      logger.info(
        'You can install MCP servers later using: claude mcp add <name> <command>'
      );
      return;
    }

    const installMCP = (name: string, command: string) => {
      try {
        execSync(command, { stdio: 'pipe', timeout: 30000 });
        logger.info(`Installed ${name}`);
      } catch (error: unknown) {
        const errorObj = error as {
          stderr?: Buffer;
          stdout?: Buffer;
          message?: string;
        };
        const stderr = errorObj.stderr?.toString() || '';
        const stdout = errorObj.stdout?.toString() || '';
        const message = errorObj.message || '';
        if (
          stderr.includes('already exists') ||
          stdout.includes('already exists')
        ) {
          logger.debug(`${name} already installed, skipping`);
        } else if (stderr.includes('could not determine executable')) {
          logger.warn(`${name} package not found in npm registry, skipping`);
        } else {
          logger.warn(`Failed to install ${name}: ${message}`);
        }
      }
    };

    // Install Claude Flow
    installMCP(
      'claude-flow',
      'claude mcp add claude-flow npx claude-flow@alpha mcp start'
    );

    // Install Firecrawl MCP
    installMCP(
      'firecrawl',
      'claude mcp add firecrawl npx @firecrawl/mcp-server'
    );

    // Install Context7 MCP
    installMCP('context7', 'claude mcp add context7 npx @context7/mcp-server');

    // Install Playwright MCP
    installMCP(
      'playwright',
      'claude mcp add playwright npx @playwright/mcp-server'
    );

    // Install Browser MCP
    installMCP('browser', 'claude mcp add browser npx @browser/mcp-server');

    // Install Sequential Thinking MCP
    try {
      execSync(
        'npm install -g @modelcontextprotocol/server-sequentialthinking',
        { stdio: 'pipe' }
      );
      installMCP(
        'sequentialthinking',
        'claude mcp add sequentialthinking node ~/.npm-global/lib/node_modules/@modelcontextprotocol/server-sequentialthinking/dist/index.js'
      );
    } catch {
      logger.warn(
        'Sequential Thinking MCP not available in registry, skipping'
      );
    }

    // Install Railway MCP Server for deployment monitoring
    installMCP('railway', 'claude mcp add railway npx @railway/mcp-server');

    // Install Netlify MCP Server for deployment monitoring
    installMCP('netlify', 'claude mcp add netlify npx @netlify/mcp');
  }

  private async configureClaudeSettings(): Promise<void> {
    logger.info('Configuring Claude settings with advanced hooks...');

    const settings = {
      claudeCodeOptions: {
        enabledMcpjsonServers: this.mcpServers,
        gitAutoCompact: true,
        gitStatusIgnorePattern:
          '\\.claude-flow/|\\.roo/|node_modules/|dist/|build/',
        contextCompactionThreshold: 100000,
        enableHooks: true,
        enableAgentCoordination: true,
        enableNeuralTraining: true,
        enablePerformanceTracking: true,
      },
      hooks: {
        preToolUse: [
          {
            pattern: '.*',
            command:
              'npx claude-flow@alpha hooks pre-task --description "${tool}"',
            description: 'Initialize task tracking',
          },
          {
            pattern: 'Write|Edit|MultiEdit',
            command:
              'npx claude-flow@alpha hooks validate-write --file "${file_path}"',
            description: 'Validate file write safety',
          },
        ],
        postToolUse: [
          {
            pattern: 'Write|Edit|MultiEdit',
            command: 'npx prettier --write "${file_path}" 2>/dev/null || true',
            description: 'Auto-format code',
          },
          {
            pattern: '.*',
            command:
              'npx claude-flow@alpha hooks post-edit --file "${file_path}" --memory-key "swarm/${agent}/${step}"',
            description: 'Update memory and patterns',
          },
        ],
        sessionStart: [
          {
            command:
              'npx claude-flow@alpha hooks session-start --profile "${profile}"',
            description: 'Initialize session with profile',
          },
        ],
        sessionEnd: [
          {
            command:
              'npx claude-flow@alpha hooks session-end --export-metrics true',
            description: 'Export session metrics',
          },
        ],
        preCompactGuidance: [
          {
            command:
              'npx claude-flow@alpha hooks compact-guidance --preserve-critical true',
            description: 'Guide context compaction',
          },
        ],
      },
      permissions: {
        allowCommands: [
          'npm run build',
          'npm run test',
          'npm run lint',
          'npm run typecheck',
          'npx claude-flow.*',
          'git status',
          'git diff',
          'git add',
          'git commit',
          'docker.*',
          'node.*',
          'npx.*',
        ],
        denyCommands: [
          'rm -rf /',
          'sudo rm -rf',
          ':(){ :|:& };:',
          'mkfs.*',
          'dd if=/dev/zero',
        ],
      },
      mcpServers: {
        'claude-flow': {
          command: 'npx',
          args: ['claude-flow@alpha', 'mcp', 'start'],
          env: {
            CLAUDE_FLOW_MEMORY_BACKEND: 'sqlite',
            CLAUDE_FLOW_MEMORY_PATH: '~/.claude/.claude-flow/memory.db',
            CLAUDE_FLOW_ENABLE_NEURAL: 'true',
            CLAUDE_FLOW_ENABLE_METRICS: 'true',
          },
        },
        firecrawl: {
          command: 'npx',
          args: ['@firecrawl/mcp-server'],
          env: {
            FIRECRAWL_API_KEY: '${FIRECRAWL_API_KEY}',
          },
        },
        context7: {
          command: 'npx',
          args: ['@context7/mcp-server'],
          env: {
            CONTEXT7_API_KEY: '${CONTEXT7_API_KEY}',
          },
        },
        playwright: {
          command: 'npx',
          args: ['@playwright/mcp-server'],
          env: {
            PLAYWRIGHT_BROWSERS_PATH: '~/.cache/ms-playwright',
          },
        },
        browser: {
          command: 'npx',
          args: ['@browser/mcp-server'],
          env: {
            BROWSER_CHROME_PATH:
              '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          },
        },
        sequentialthinking: {
          command: 'node',
          args: [
            '~/.npm-global/lib/node_modules/@modelcontextprotocol/server-sequentialthinking/dist/index.js',
          ],
        },
        railway: {
          command: 'npx',
          args: ['@railway/mcp-server'],
          env: {
            RAILWAY_API_TOKEN: '${RAILWAY_API_TOKEN}',
            RAILWAY_PROJECT_ID: '${RAILWAY_PROJECT_ID}',
          },
          description: 'Railway deployment platform monitoring and management',
        },
        netlify: {
          command: 'npx',
          args: ['@netlify/mcp'],
          env: {
            NETLIFY_ACCESS_TOKEN: '${NETLIFY_ACCESS_TOKEN}',
            NETLIFY_SITE_ID: '${NETLIFY_SITE_ID}',
          },
          description: 'Netlify deployment and build monitoring',
        },
      },
    };
    await fs.writeFile(
      path.join(this.claudeDir, 'settings.json'),
      JSON.stringify(settings, null, 2)
    );
  }

  private async setupAgents(): Promise<void> {
    logger.info('Setting up 80+ specialized agents...');

    // Copy bundled agent .md files from package resources
    const bundledAgentsExist = await fs
      .access(this.bundledAgentsDir)
      .then(() => true)
      .catch(() => false);

    if (bundledAgentsExist) {
      logger.info('Copying bundled agent .md files...');
      try {
        // Copy all agent .md files from bundled resources to global .claude/agents
        execSync(`cp -R "${this.bundledAgentsDir}"/* "${this.agentsDir}"/`, {
          stdio: 'pipe',
        });
        const agentCount = execSync(
          `find "${this.agentsDir}" -name "*.md" | wc -l`,
          { encoding: 'utf8' }
        ).trim();
        logger.info(`Installed ${agentCount} agent definition files`);
      } catch {
        logger.warn(
          'Could not copy bundled agent files, will generate configs instead'
        );
      }
    } else {
      logger.warn('No bundled agent files found, generating basic configs...');
    }

    // Agent categories and configurations
    const agentCategories = {
      core: ['coder', 'reviewer', 'tester', 'planner', 'researcher'],
      swarm: [
        'hierarchical-coordinator',
        'mesh-coordinator',
        'adaptive-coordinator',
        'collective-intelligence-coordinator',
        'swarm-memory-manager',
      ],
      consensus: [
        'byzantine-coordinator',
        'raft-manager',
        'gossip-coordinator',
        'consensus-builder',
        'crdt-synchronizer',
        'quorum-manager',
        'security-manager',
      ],
      performance: [
        'perf-analyzer',
        'performance-benchmarker',
        'task-orchestrator',
        'memory-coordinator',
        'smart-agent',
      ],
      github: [
        'github-modes',
        'pr-manager',
        'code-review-swarm',
        'issue-tracker',
        'release-manager',
        'workflow-automation',
        'project-board-sync',
        'repo-architect',
        'multi-repo-swarm',
        'sync-coordinator',
        'release-swarm',
        'swarm-pr',
        'swarm-issue',
      ],
      sparc: [
        'sparc-coord',
        'sparc-coder',
        'specification',
        'pseudocode',
        'architecture',
        'refinement',
      ],
      specialized: [
        'backend-dev',
        'mobile-dev',
        'ml-developer',
        'cicd-engineer',
        'api-docs',
        'system-architect',
        'code-analyzer',
        'base-template-generator',
        'production-validator',
        'tdd-london-swarm',
        'migration-planner',
        'swarm-init',
      ],
      devops: ['deployment-monitor', 'log-analyzer', 'debug-refactor'],
    };

    // Create JSON configs for agents that don't have .md files
    for (const [category, agents] of Object.entries(agentCategories)) {
      const categoryDir = path.join(this.agentsDir, category);
      await fs.mkdir(categoryDir, { recursive: true });

      for (const agent of agents) {
        // Only create JSON config if .md doesn't exist
        const mdPath = path.join(categoryDir, `${agent}.md`);
        const mdExists = await fs
          .access(mdPath)
          .then(() => true)
          .catch(() => false);
        if (!mdExists) {
          await this.createAgentConfig(categoryDir, agent, category);
        }
      }
    }

    logger.info('Agent setup complete');

    // Setup deployment agents
    await this.setupDeploymentAgents();
  }

  private async setupDeploymentAgents(): Promise<void> {
    logger.info('Setting up deployment monitoring agents...');

    const devopsDir = path.join(this.agentsDir, 'devops');
    await fs.mkdir(devopsDir, { recursive: true });

    // Copy bundled deployment agent .md files
    const bundledDeploymentAgentsDir = path.join(
      this.bundledAgentsDir,
      'devops'
    );
    const bundledExists = await fs
      .access(bundledDeploymentAgentsDir)
      .then(() => true)
      .catch(() => false);

    if (bundledExists) {
      try {
        execSync(`cp -R "${bundledDeploymentAgentsDir}"/* "${devopsDir}"/`, {
          stdio: 'pipe',
        });
        logger.info(
          'Installed deployment agents: deployment-monitor, log-analyzer, debug-refactor'
        );
      } catch {
        logger.warn('Could not copy deployment agent files');
      }
    }
  }

  private async setupCommands(): Promise<void> {
    logger.info('Setting up slash commands with corrected MCP tools...');

    // Copy bundled command .md files from package resources
    const bundledCommandsExist = await fs
      .access(this.bundledCommandsDir)
      .then(() => true)
      .catch(() => false);

    if (bundledCommandsExist) {
      logger.info('Copying bundled command .md files...');
      try {
        // Copy all command .md files from bundled resources to global .claude/commands
        execSync(
          `cp -R "${this.bundledCommandsDir}"/* "${this.commandsDir}"/`,
          { stdio: 'pipe' }
        );
        const commandCount = execSync(
          `find "${this.commandsDir}" -name "*.md" | wc -l`,
          { encoding: 'utf8' }
        ).trim();
        logger.info(`Installed ${commandCount} slash command files`);
        logger.info('Available commands: /hive-swarm, /hive-strategic');
      } catch {
        logger.warn('Could not copy bundled command files');
      }
    } else {
      logger.warn(
        `No bundled command files found at: ${this.bundledCommandsDir}`
      );
    }

    logger.info('Command setup complete');
  }

  private async createAgentConfig(
    dir: string,
    agentName: string,
    category: string
  ): Promise<void> {
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
        enableLearning: true,
      },
      hooks: {
        preTask: `npx claude-flow@alpha agent init --type ${agentName}`,
        postTask: `npx claude-flow@alpha agent complete --type ${agentName}`,
        onError: `npx claude-flow@alpha agent error --type ${agentName}`,
      },
    };

    await fs.writeFile(
      path.join(dir, `${agentName}.json`),
      JSON.stringify(agentConfig, null, 2)
    );
  }

  private getAgentDescription(agentName: string): string {
    const descriptions: Record<string, string> = {
      coder: 'Implementation specialist for writing clean, efficient code',
      reviewer: 'Code review and quality assurance specialist',
      tester: 'Comprehensive testing and quality assurance specialist',
      planner: 'Strategic planning and task orchestration agent',
      researcher: 'Deep research and information gathering specialist',
      'hierarchical-coordinator': 'Queen-led hierarchical swarm coordination',
      'mesh-coordinator': 'Peer-to-peer mesh network swarm',
      'adaptive-coordinator': 'Dynamic topology switching coordinator',
      'byzantine-coordinator': 'Byzantine fault-tolerant consensus protocols',
      'sparc-coord': 'SPARC methodology orchestrator',
      'github-modes': 'Comprehensive GitHub integration',
      'ml-developer': 'Machine learning model development',
      'mobile-dev': 'React Native mobile application development',
      'backend-dev': 'Backend API development specialist',
      'system-architect': 'System architecture design expert',
    };

    return (
      descriptions[agentName] || `Specialized agent for ${agentName} tasks`
    );
  }

  private getAgentCapabilities(agentName: string): string[] {
    const baseCapabilities = ['task-execution', 'memory-access', 'learning'];

    const specificCapabilities: Record<string, string[]> = {
      coder: ['code-generation', 'refactoring', 'optimization'],
      reviewer: ['code-analysis', 'vulnerability-detection', 'best-practices'],
      tester: ['unit-testing', 'integration-testing', 'e2e-testing'],
      planner: ['task-decomposition', 'dependency-analysis', 'scheduling'],
      researcher: ['web-search', 'documentation-analysis', 'synthesis'],
    };

    return [...baseCapabilities, ...(specificCapabilities[agentName] || [])];
  }

  private getAgentTools(agentName: string): string[] {
    const baseTools = ['Read', 'Write', 'Edit', 'Bash'];

    const specificTools: Record<string, string[]> = {
      coder: ['MultiEdit', 'TodoWrite'],
      reviewer: ['Grep', 'Glob', 'WebSearch'],
      tester: ['Bash', 'TodoWrite'],
      planner: ['TodoWrite', 'Task'],
      researcher: ['WebSearch', 'WebFetch', 'Grep'],
    };

    return [...baseTools, ...(specificTools[agentName] || [])];
  }

  private async installBrowserExtension(): Promise<void> {
    logger.info('Installing Browser MCP Chrome extension...');
    const extensionDir = path.join(
      this.homeDir,
      '.claude',
      'browser-extension'
    );
    await fs.mkdir(extensionDir, { recursive: true });

    // Create manifest.json
    const manifest = {
      manifest_version: 3,
      name: 'Browser MCP Bridge',
      version: '1.0.0',
      description: 'Bridge for Browser MCP server',
      permissions: ['activeTab', 'storage', 'debugger'],
      background: {
        service_worker: 'background.js',
      },
      content_scripts: [
        {
          matches: ['<all_urls>'],
          js: ['content.js'],
        },
      ],
      action: {
        default_popup: 'popup.html',
      },
    };

    await fs.writeFile(
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

    await fs.writeFile(
      path.join(extensionDir, 'background.js'),
      backgroundScript
    );

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

    await fs.writeFile(path.join(extensionDir, 'content.js'), contentScript);

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

    await fs.writeFile(path.join(extensionDir, 'popup.html'), popupHtml);

    logger.info(
      'Chrome extension created. Load it manually from chrome://extensions'
    );
  }

  private async setupQualityEnforcement(): Promise<void> {
    logger.info('Setting up quality enforcement...');

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

    await fs.writeFile(
      path.join(this.helpersDir, 'pre-commit-hook.sh'),
      preCommitHook
    );
    execSync(`chmod +x ${path.join(this.helpersDir, 'pre-commit-hook.sh')}`);
  }

  private async setupClaudeMdGenerator(): Promise<void> {
    logger.info('Setting up global CLAUDE.md generator...');

    // Copy bundled CLAUDE.md template from package resources
    const bundledTemplate = path.join(
      this.bundledTemplatesDir,
      'CLAUDE.md.template'
    );
    const bundledTemplateExists = await fs
      .access(bundledTemplate)
      .then(() => true)
      .catch(() => false);

    if (bundledTemplateExists) {
      logger.info('Installing bundled CLAUDE.md template');
      const templatePath = path.join(this.templatesDir, 'CLAUDE.md.template');
      try {
        const claudeMdContent = await fs.readFile(bundledTemplate, 'utf8');
        await fs.writeFile(templatePath, claudeMdContent);
        logger.info('Installed CLAUDE.md template');
      } catch {
        logger.warn('Could not install CLAUDE.md template');
      }
    } else {
      logger.warn('No bundled CLAUDE.md template found');
    }

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

    await fs.writeFile(
      path.join(this.helpersDir, 'generate-claude-md.js'),
      generatorScript
    );
    execSync(`chmod +x ${path.join(this.helpersDir, 'generate-claude-md.js')}`);

    // Create global command
    try {
      execSync(
        `ln -sf ${path.join(this.helpersDir, 'generate-claude-md.js')} /usr/local/bin/claude-init`
      );
      logger.info('Created global claude-init command');
    } catch {
      logger.warn(
        'Could not create /usr/local/bin/claude-init - may need sudo'
      );
    }
  }

  private async setupOptimizationScripts(): Promise<void> {
    logger.info('Setting up hardware-adaptive Claude optimization scripts...');

    // Copy bundled optimization scripts to global ~/.claude/scripts
    const bundledScriptsExist = await fs
      .access(this.bundledScriptsDir)
      .then(() => true)
      .catch(() => false);

    if (bundledScriptsExist) {
      logger.info('Installing optimization scripts...');
      try {
        // Copy all scripts from bundled resources to global .claude/scripts
        execSync(`cp -R "${this.bundledScriptsDir}"/* "${this.scriptsDir}"/`, {
          stdio: 'pipe',
        });

        // Make scripts executable
        execSync(`chmod +x "${this.scriptsDir}/claude-optimized"`, {
          stdio: 'pipe',
        });
        execSync(`chmod +x "${this.scriptsDir}/cleanup-zombies.sh"`, {
          stdio: 'pipe',
        });

        logger.info('Optimization scripts installed to ~/.claude/scripts');
        logger.info('  - detect-hardware-limits.js - Hardware detection');
        logger.info('  - claude-optimized - Optimized Claude wrapper');
        logger.info('  - orchestrator.js - Fault-tolerant orchestration');
        logger.info('  - cleanup-zombies.sh - Process cleanup utility');
      } catch {
        logger.warn('Could not copy optimization scripts');
        logger.warn(
          'Scripts can be manually installed from adapticai/engine/scripts'
        );
      }
    } else {
      logger.warn('No bundled optimization scripts found');
      logger.warn(`Expected at: ${this.bundledScriptsDir}`);
    }
  }

  private async configureProfile(options?: {
    profile?: string;
  }): Promise<void> {
    // Additional configuration based on profile
    if (options?.profile) {
      logger.info(`Configuring for ${options.profile} profile...`);

      const profileConfigs: Record<string, string[]> = {
        fullstack: ['backend-dev', 'mobile-dev', 'system-architect'],
        frontend: ['react-developer', 'mobile-dev', 'ui-specialist'],
        backend: ['backend-dev', 'api-docs', 'system-architect'],
        devops: ['cicd-engineer', 'workflow-automation', 'perf-analyzer'],
      };

      const agents = profileConfigs[options.profile] || [];
      for (const agent of agents) {
        await this.createAgentConfig(this.agentsDir, agent, 'profile-specific');
      }
    }
  }
}

export default new ClaudeInstaller();
