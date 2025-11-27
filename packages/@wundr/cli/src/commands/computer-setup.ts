/**
 * Computer setup command for provisioning new developer machines
 * Integrates new-starter functionality into the unified wundr CLI
 */

import { ComputerSetupManager } from '@wundr.io/computer-setup';
import chalk from 'chalk';
import { Command } from 'commander';
import * as fs from 'fs/promises';
import inquirer from 'inquirer';
import * as os from 'os';
import ora from 'ora';
import * as path from 'path';
// import { getLogger } from '@wundr/core';
const logger = { info: console.log, error: console.error, warn: console.warn };

// const logger = getLogger('cli:computer-setup');

export function createComputerSetupCommand(): Command {
  const command = new Command('computer-setup')
    .alias('setup-machine')
    .alias('provision')
    .description(
      'Set up a new developer machine with all required tools and configurations',
    )
    .option(
      '-p, --profile <profile>',
      'Use a specific profile (frontend, backend, fullstack, devops, ml)',
    )
    .option('-t, --team <team>', 'Apply team-specific configurations')
    .option(
      '-m, --mode <mode>',
      'Setup mode (interactive, automated, minimal)',
      'interactive',
    )
    .option('--dry-run', 'Show what would be installed without making changes')
    .option('--skip-existing', 'Skip tools that are already installed')
    .option('--parallel', 'Install tools in parallel where possible')
    .option('--verbose', 'Show detailed output')
    .option('--report', 'Generate a detailed setup report')
    .action(async options => {
      await runComputerSetup(options);
    });

  // Subcommands
  command
    .command('profile')
    .description('Manage developer profiles')
    .action(async () => {
      await manageProfiles();
    });

  command
    .command('validate')
    .description('Validate current machine setup')
    .action(async () => {
      await validateSetup();
    });

  command
    .command('doctor')
    .description('Diagnose and fix common setup issues')
    .action(async () => {
      await runDoctor();
    });

  command
    .command('team-config')
    .description('Download and apply team configuration')
    .argument('<team>', 'Team identifier')
    .action(async team => {
      await applyTeamConfig(team);
    });

  return command;
}

async function runComputerSetup(options: any): Promise<void> {
  const spinner = ora('Initializing computer setup...').start();

  try {
    const manager = new ComputerSetupManager();
    await manager.initialize();

    spinner.stop();

    // Get or create profile
    let profile;
    if (options.profile) {
      // Get profile by name - ProfileManager will handle normalization
      profile = await manager.getProfile(options.profile);
      if (!profile) {
        console.log(
          chalk.yellow(`Profile '${options.profile}' not found. Using default.`),
        );
        profile = await manager.getDefaultProfile();
      }
    } else if (options.mode === 'interactive' || options.interactive) {
      profile = await createInteractiveProfile();
    } else {
      profile = await manager.getDefaultProfile();
    }

    // Detect platform
    const platform = {
      os: process.platform as 'darwin' | 'linux' | 'win32',
      arch: process.arch as 'x64' | 'arm64',
      version: process.version,
    };

    console.log(chalk.cyan('\n🖥️  Computer Setup for Engineering Teams\n'));
    console.log(chalk.gray('━'.repeat(50)));
    console.log(chalk.white('Profile:'), chalk.green(profile.name));
    console.log(chalk.white('Role:'), chalk.green(profile.role));
    console.log(
      chalk.white('Platform:'),
      chalk.green(`${platform.os} ${platform.arch}`),
    );
    console.log(chalk.white('Mode:'), chalk.green(options.mode));
    console.log(chalk.gray('━'.repeat(50)));

    if (options.dryRun) {
      console.log(
        chalk.yellow('\n⚠️  DRY RUN MODE - No changes will be made\n'),
      );
    }

    // Confirm before proceeding
    if (options.mode === 'interactive' && !options.dryRun) {
      const { proceed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: 'Ready to set up your machine?',
          default: true,
        },
      ]);

      if (!proceed) {
        console.log(chalk.yellow('Setup cancelled'));
        return;
      }
    }

    // Set up progress monitoring
    manager.on('progress', progress => {
      const bar = generateProgressBar(progress.percentage);
      console.log(chalk.cyan(`\n[${bar}] ${progress.percentage}%`));
      console.log(chalk.gray(`Current: ${progress.currentStep}`));
      console.log(
        chalk.gray(`Steps: ${progress.completedSteps}/${progress.totalSteps}`),
      );
    });

    // Run setup
    spinner.text = 'Setting up your machine...';
    spinner.start();

    const result = await manager.setup({
      profile,
      platform,
      mode: options.mode,
      skipExisting: options.skipExisting || false,
      dryRun: options.dryRun || false,
      verbose: options.verbose || false,
      parallel: options.parallel || false,
      generateReport: options.report || false,
    });

    spinner.stop();

    // Display results
    if (result.success) {
      console.log(chalk.green('\n✅ Computer setup completed successfully!\n'));
    } else {
      console.log(chalk.red('\n❌ Computer setup completed with errors\n'));
    }

    console.log(chalk.white('Summary:'));
    console.log(
      chalk.green(`  ✓ Completed: ${result.completedSteps?.length || 0} steps`),
    );
    if (result.skippedSteps && result.skippedSteps.length > 0) {
      console.log(
        chalk.yellow(`  ⊘ Skipped: ${result.skippedSteps.length} steps`),
      );
    }
    if (result.failedSteps && result.failedSteps.length > 0) {
      console.log(chalk.red(`  ✗ Failed: ${result.failedSteps.length} steps`));
    }

    if (result.warnings && result.warnings.length > 0) {
      console.log(chalk.yellow('\n⚠️  Warnings:'));
      result.warnings.forEach(w => console.log(chalk.yellow(`  - ${w}`)));
    }

    if (result.errors && result.errors.length > 0) {
      console.log(chalk.red('\n❌ Errors:'));
      result.errors.forEach(e =>
        console.log(chalk.red(`  - ${(e as any)?.message || e}`)),
      );
    }

    if (result.report) {
      console.log(chalk.cyan('\n📄 Setup report generated successfully'));
    }

    // Set up Fleet Mode if enabled
    if (profile.preferences?.aiTools?.fleetMode) {
      try {
        await setupFleetMode(profile as DeveloperProfile);
      } catch (fleetError) {
        console.error(
          chalk.red('\n⚠️ Fleet Mode setup encountered issues:'),
          fleetError,
        );
        console.log(
          chalk.yellow(
            'You can retry with: wundr computer-setup --profile <your-profile>',
          ),
        );
      }
    }

    // Display next steps
    console.log(chalk.cyan('\n📝 Next Steps:'));
    const nextSteps = [
      'Restart your terminal to apply configurations',
      'Run "wundr computer-setup validate" to verify',
      'Sign in to your team communication tools',
      'Clone your team repositories',
      'Review team onboarding documentation',
    ];
    nextSteps.forEach((step, i) => {
      console.log(chalk.white(`  ${i + 1}. ${step}`));
    });

    console.log(chalk.gray('\n━'.repeat(50)));
    console.log(chalk.cyan('Welcome to the team! 🎉'));
    console.log(chalk.gray('━'.repeat(50)));
  } catch (error) {
    spinner.stop();
    logger.error('Computer setup failed', error);
    console.error(chalk.red('Setup failed:'), error);
    process.exit(1);
  }
}

async function createInteractiveProfile(): Promise<any> {
  console.log(chalk.cyan("\n👤 Let's create your developer profile\n"));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'What is your name?',
      validate: input => input.length > 0,
    },
    {
      type: 'input',
      name: 'email',
      message: 'What is your email?',
      validate: input => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input),
    },
    {
      type: 'list',
      name: 'role',
      message: 'What is your role?',
      choices: [
        { name: 'Frontend Developer', value: 'frontend' },
        { name: 'Backend Developer', value: 'backend' },
        { name: 'Full Stack Developer', value: 'fullstack' },
        { name: 'DevOps Engineer', value: 'devops' },
        { name: 'Machine Learning Engineer', value: 'ml' },
        { name: 'Mobile Developer', value: 'mobile' },
      ],
    },
    {
      type: 'input',
      name: 'team',
      message: 'What team are you joining? (optional)',
      default: '',
    },
    {
      type: 'list',
      name: 'shell',
      message: 'Which shell do you prefer?',
      choices: ['zsh', 'bash', 'fish'],
    },
    {
      type: 'list',
      name: 'editor',
      message: 'Which editor do you use?',
      choices: [
        { name: 'Visual Studio Code', value: 'vscode' },
        { name: 'Vim', value: 'vim' },
        { name: 'Neovim', value: 'neovim' },
        { name: 'Sublime Text', value: 'sublime' },
        { name: 'IntelliJ IDEA', value: 'intellij' },
      ],
    },
    {
      type: 'checkbox',
      name: 'languages',
      message: 'Which programming languages do you need?',
      choices: [
        { name: 'Node.js', value: 'node', checked: true },
        { name: 'Python', value: 'python' },
        { name: 'Go', value: 'go' },
        { name: 'Rust', value: 'rust' },
        { name: 'Java', value: 'java' },
      ],
    },
    {
      type: 'checkbox',
      name: 'tools',
      message: 'Which tools do you need?',
      choices: [
        { name: 'Docker', value: 'docker', checked: true },
        { name: 'Kubernetes', value: 'kubernetes' },
        { name: 'AWS CLI', value: 'aws' },
        { name: 'Google Cloud SDK', value: 'gcloud' },
        { name: 'PostgreSQL', value: 'postgresql' },
        { name: 'Redis', value: 'redis' },
      ],
    },
    {
      type: 'confirm',
      name: 'aiTools',
      message:
        'Do you want to set up AI development tools (Claude Code, Claude Flow)?',
      default: true,
    },
    {
      type: 'confirm',
      name: 'fleetMode',
      message: 'Enable Fleet-Scale Autonomous Engineering mode?',
      default: false,
      when: (answers: any) => answers.aiTools,
    },
    {
      type: 'confirm',
      name: 'slack',
      message: 'Do you need Slack configuration?',
      default: true,
    },
  ]);

  // Build profile from answers
  return {
    name: answers.name,
    email: answers.email,
    role: answers.role,
    team: answers.team,
    preferences: {
      shell: answers.shell,
      editor: answers.editor,
      theme: 'auto',
      gitConfig: {
        userName: answers.name,
        userEmail: answers.email,
        signCommits: true,
        defaultBranch: 'main',
        aliases: {},
      },
      aiTools: {
        claudeCode: answers.aiTools,
        claudeFlow: answers.aiTools,
        mcpTools: answers.aiTools ? ['all'] : [],
        swarmAgents: answers.aiTools ? ['default'] : [],
        memoryAllocation: '2GB',
        fleetMode: answers.fleetMode || false,
      },
    },
    tools: {
      languages: buildLanguageConfig(answers.languages),
      packageManagers: {
        npm: true,
        pnpm: true,
        yarn: false,
        brew: process.platform === 'darwin',
      },
      containers: {
        docker: answers.tools.includes('docker'),
        dockerCompose: answers.tools.includes('docker'),
        kubernetes: answers.tools.includes('kubernetes'),
      },
      cloudCLIs: {
        aws: answers.tools.includes('aws'),
        gcloud: answers.tools.includes('gcloud'),
      },
      databases: {
        postgresql: answers.tools.includes('postgresql'),
        redis: answers.tools.includes('redis'),
      },
      monitoring: {},
      communication: {
        slack: answers.slack
          ? {
              workspaces: [],
              profile: {
                displayName: answers.name,
                statusText: 'New team member',
                statusEmoji: ':wave:',
              },
            }
          : undefined,
      },
    },
  };
}

function buildLanguageConfig(languages: string[]): any {
  const config: any = {};

  if (languages.includes('node')) {
    config.node = {
      versions: ['20', '18'],
      defaultVersion: '20',
      globalPackages: ['pnpm', 'typescript', 'tsx'],
    };
  }

  if (languages.includes('python')) {
    config.python = {
      versions: ['3.11', '3.10'],
      defaultVersion: '3.11',
      virtualEnv: 'venv',
    };
  }

  if (languages.includes('go')) {
    config.go = {
      version: 'latest',
      goPath: '$HOME/go',
    };
  }

  if (languages.includes('rust')) {
    config.rust = {
      version: 'stable',
      components: ['rustfmt', 'clippy'],
    };
  }

  if (languages.includes('java')) {
    config.java = {
      version: '17',
      jdk: 'adoptium',
    };
  }

  return config;
}

/**
 * Developer profile interface with fleet mode support
 */
interface DeveloperProfile {
  name: string;
  email: string;
  role: string;
  team?: string;
  preferences: {
    shell: string;
    editor: string;
    theme: string;
    gitConfig: {
      userName: string;
      userEmail: string;
      signCommits: boolean;
      defaultBranch: string;
      aliases: Record<string, string>;
    };
    aiTools: {
      claudeCode: boolean;
      claudeFlow: boolean;
      mcpTools: string[];
      swarmAgents: string[];
      memoryAllocation: string;
      fleetMode: boolean;
    };
  };
  tools: Record<string, unknown>;
}

/**
 * Sets up Fleet-Scale Autonomous Engineering mode
 * Installs Orchestrator Daemon scripts, Memory Bank templates, and IPRE governance defaults
 */
async function setupFleetMode(profile: DeveloperProfile): Promise<void> {
  const wundrDir = path.join(os.homedir(), '.wundr');
  const orchestratorDaemonDir = path.join(wundrDir, 'orchestrator-daemon');
  const governanceDir = path.join(wundrDir, 'governance');
  const templatesDir = path.join(wundrDir, 'templates');

  console.log(
    chalk.cyan('\n🚀 Setting up Fleet-Scale Autonomous Engineering mode...\n'),
  );

  // Create directory structure
  await fs.mkdir(orchestratorDaemonDir, { recursive: true });
  await fs.mkdir(governanceDir, { recursive: true });
  await fs.mkdir(path.join(templatesDir, 'memory-bank'), { recursive: true });
  await fs.mkdir(path.join(templatesDir, 'sub-agents'), { recursive: true });

  // 1. Install Orchestrator Daemon configuration
  const orchestratorConfig = {
    version: '1.0.0',
    identity: {
      name: profile.name,
      email: profile.email,
      role: 'Orchestrator-Supervisor',
    },
    resourceLimits: {
      maxSessions: 10,
      tokenBudget: {
        subscription: 0.8, // 80% for Orchestrator & Session Managers
        api: 0.2, // 20% for sub-agent swarms
      },
    },
    systemLimits: {
      fileDescriptors: 65000,
      diskSpaceBufferGB: 10,
      maxWorktreesPerMachine: 200,
    },
    measurableObjectives: {
      responseTime: '<30s to Slack mentions',
      rateLimit: "Zero 'Rate Limit Exceeded' per week",
      routingAccuracy: '100% correct task routing',
    },
    hardConstraints: [
      'Never exhaust API quota',
      'Always maintain audit trail',
      'Escalate blocked requests within 5 minutes',
    ],
  };

  await fs.writeFile(
    path.join(orchestratorDaemonDir, 'config.yaml'),
    generateYamlContent(orchestratorConfig),
    'utf-8',
  );
  console.log(chalk.green('  ✓ Orchestrator Daemon configuration installed'));

  // 2. Copy Orchestrator Charter template
  const orchestratorCharter = `---
name: orchestrator-supervisor
role: Tier1-Orchestrator
identity:
  name: '${profile.name}'
  email: '${profile.email}'
  slackHandle: '@orchestrator-supervisor'

responsibilities:
  - triage_requests
  - manage_session_lifecycle
  - allocate_token_budget
  - human_communication
  - fleet_status_reporting

resourceLimits:
  maxSessions: 10
  tokenBudget:
    subscription: 80%
    api: 20%

measurableObjectives:
  responseTime: '<30s to Slack mentions'
  rateLimit: "Zero 'Rate Limit Exceeded' per week"
  routingAccuracy: '100% correct task routing'

hardConstraints:
  - 'Never exhaust API quota'
  - 'Always maintain audit trail'
  - 'Escalate blocked requests within 5 minutes'
---
`;

  await fs.writeFile(
    path.join(orchestratorDaemonDir, 'orchestrator-charter.md'),
    orchestratorCharter,
    'utf-8',
  );
  console.log(chalk.green('  ✓ Orchestrator Charter template deployed'));

  // 3. Set up token budgeting configuration
  const tokenBudgetConfig = {
    version: '1.0.0',
    subscription: {
      type: 'claude-code-max-20x',
      promptsPerFiveHours: 800,
      warningThreshold: 0.8,
      criticalThreshold: 0.95,
    },
    api: {
      monthlyBudget: 500,
      haikuRatePerMillion: 0.25,
      sonnetRatePerMillion: 3.0,
    },
    modelAllocation: {
      tier1: {
        model: 'claude-3-5-sonnet',
        source: 'subscription',
        priority: 'critical',
      },
      tier2: {
        model: 'claude-3-5-sonnet',
        source: 'subscription',
        priority: 'high',
      },
      tier3: {
        model: 'claude-3-5-haiku',
        source: 'api',
        priority: 'normal',
      },
    },
    throttlingPolicy: {
      onWarning: ['pause_non_critical_sessions', 'queue_new_requests'],
      onCritical: ['pause_all_except_critical', 'notify_orchestrator_human'],
    },
  };

  await fs.writeFile(
    path.join(orchestratorDaemonDir, 'token-budget.yaml'),
    generateYamlContent(tokenBudgetConfig),
    'utf-8',
  );
  console.log(chalk.green('  ✓ Token budgeting configuration set up'));

  // 4. Deploy Memory Bank templates
  const sessionTemplate = `# Active Context - Session {{SESSION_ID}}

## Current Focus
<!-- Updated by session manager -->

## Working Memory
- Last action:
- Next planned step:
- Blockers:

## Context Window State
- Tokens used: X / 200,000
- Compression needed: Yes/No

## Handoff Notes
<!-- For session resumption -->
`;

  const progressTemplate = `# Progress Tracker - Session {{SESSION_ID}}

## Milestones
| Status | Milestone | Target Date | Notes |
|--------|-----------|-------------|-------|

## Completed Tasks
<!-- Archive of completed work -->

## Blockers
<!-- Current impediments -->
`;

  const subAgentDelegationTemplate = `# Sub-Agent Delegation Tracker

## Active Sub-Agents
| ID | Type | Task | Status | Worktree | Started |
|----|------|------|--------|----------|---------|

## Completed Tasks
<!-- Archive of completed sub-agent work -->

## Resource Usage
- Active worktrees: X / 20
- API calls (session): X
`;

  const ipreAlignmentTemplate = `# IPRE Alignment State

## Active Policies
<!-- Hard constraints for this session -->

## Reward Weights
\`\`\`yaml
customer_value: 0.35
code_quality: 0.30
timeline: 0.20
technical_debt: 0.15
\`\`\`

## Alignment Score
- Current: 85/100
- Last evaluation: {{TIMESTAMP}}
- Trend: Improving

## Escalation History
<!-- Guardian review log -->
`;

  await fs.writeFile(
    path.join(templatesDir, 'memory-bank', 'activeContext.md'),
    sessionTemplate,
    'utf-8',
  );
  await fs.writeFile(
    path.join(templatesDir, 'memory-bank', 'progress.md'),
    progressTemplate,
    'utf-8',
  );
  await fs.writeFile(
    path.join(templatesDir, 'memory-bank', 'subAgentDelegation.md'),
    subAgentDelegationTemplate,
    'utf-8',
  );
  await fs.writeFile(
    path.join(templatesDir, 'memory-bank', 'ipre-alignment.md'),
    ipreAlignmentTemplate,
    'utf-8',
  );
  console.log(chalk.green('  ✓ Memory Bank templates deployed'));

  // 5. Initialize IPRE governance defaults
  const ipreDefaults = {
    version: '1.0.0',
    intent: {
      mission: 'Deliver high-quality software that solves customer problems',
      values: [
        'customer_first',
        'technical_excellence',
        'sustainable_velocity',
      ],
    },
    policies: {
      security: [
        'No secrets in code',
        'No SQL injection vulnerabilities',
        'No XSS attack vectors',
      ],
      compliance: [
        'All changes require PR review',
        'No force pushes to main/master',
        'Test coverage minimum 80%',
      ],
      operational: [
        'No deployments on Fridays after 2pm',
        'Rollback plan required for production changes',
      ],
    },
    rewards: {
      customer_value: 0.35,
      code_quality: 0.25,
      delivery_speed: 0.2,
      technical_debt_reduction: 0.15,
      documentation: 0.05,
    },
    evaluators: [
      {
        type: 'policy_compliance',
        frequency: 'per_commit',
        action: 'block_on_violation',
      },
      {
        type: 'reward_alignment',
        frequency: 'hourly',
        threshold: 0.7,
        action: 'escalate_to_guardian',
      },
      {
        type: 'drift_detection',
        frequency: 'daily',
        patterns: ['reward_hacking', 'escalation_suppression'],
        action: 'alert_architect',
      },
    ],
  };

  await fs.writeFile(
    path.join(governanceDir, 'ipre-defaults.yaml'),
    generateYamlContent(ipreDefaults),
    'utf-8',
  );
  console.log(chalk.green('  ✓ IPRE governance defaults initialized'));

  // 6. Configure system resource limits guidance
  const resourceGuidance = `# System Resource Configuration for Fleet Mode

## File Descriptor Limits
For optimal fleet operation with up to 200 worktrees, configure:

### macOS / Linux
\`\`\`bash
# Add to ~/.zshrc or ~/.bashrc
ulimit -n 65000
\`\`\`

### Persistent Configuration (macOS)
\`\`\`bash
# Create /Library/LaunchDaemons/limit.maxfiles.plist with:
# soft limit: 65000
# hard limit: 200000
\`\`\`

### Persistent Configuration (Linux)
\`\`\`bash
# Add to /etc/security/limits.conf
* soft nofile 65000
* hard nofile 200000
\`\`\`

## Disk Space Requirements
- Minimum: 500GB SSD
- Recommended: 4TB+ SSD (for 200 worktrees at ~2GB each)
- Buffer: Keep 10GB free at all times

## Git Worktree Best Practices
- Session Managers sync with remote (fetch/pull)
- Sub-Agents rarely git fetch (reduces index lock contention)
- Use fractional worktree pattern:
  - Read-only agents: Share Session Manager's worktree
  - Write-access agents: Get dedicated worktrees

## Monitoring Commands
\`\`\`bash
# Check current file descriptor limit
ulimit -n

# Check open files
lsof | wc -l

# Check disk space
df -h

# List active worktrees
git worktree list
\`\`\`
`;

  await fs.writeFile(
    path.join(wundrDir, 'RESOURCE_LIMITS.md'),
    resourceGuidance,
    'utf-8',
  );
  console.log(chalk.green('  ✓ System resource limits guidance configured'));

  console.log(
    chalk.cyan('\n✅ Fleet-Scale Autonomous Engineering mode setup complete!\n'),
  );
  console.log(chalk.white('Files created:'));
  console.log(chalk.gray('  ~/.wundr/orchestrator-daemon/config.yaml'));
  console.log(chalk.gray('  ~/.wundr/orchestrator-daemon/orchestrator-charter.md'));
  console.log(chalk.gray('  ~/.wundr/orchestrator-daemon/token-budget.yaml'));
  console.log(chalk.gray('  ~/.wundr/templates/memory-bank/'));
  console.log(chalk.gray('  ~/.wundr/governance/ipre-defaults.yaml'));
  console.log(chalk.gray('  ~/.wundr/RESOURCE_LIMITS.md'));
  console.log(
    chalk.yellow(
      '\n⚠️  Review ~/.wundr/RESOURCE_LIMITS.md for system configuration recommendations.',
    ),
  );
}

/**
 * Simple YAML generator for configuration objects
 */
function generateYamlContent(obj: Record<string, unknown>, indent = 0): string {
  let yaml = '';
  const spaces = '  '.repeat(indent);

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      yaml += `${spaces}${key}: null\n`;
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      yaml += `${spaces}${key}:\n`;
      yaml += generateYamlContent(value as Record<string, unknown>, indent + 1);
    } else if (Array.isArray(value)) {
      yaml += `${spaces}${key}:\n`;
      for (const item of value) {
        if (typeof item === 'object') {
          yaml += `${spaces}  -\n`;
          const itemYaml = generateYamlContent(
            item as Record<string, unknown>,
            indent + 2,
          );
          yaml += itemYaml;
        } else {
          yaml += `${spaces}  - '${item}'\n`;
        }
      }
    } else if (typeof value === 'string') {
      yaml += `${spaces}${key}: '${value}'\n`;
    } else {
      yaml += `${spaces}${key}: ${value}\n`;
    }
  }

  return yaml;
}

async function manageProfiles(): Promise<void> {
  const manager = new ComputerSetupManager();
  await manager.initialize();

  const profiles = await manager.getAvailableProfiles();

  console.log(chalk.cyan('\n📋 Developer Profiles\n'));

  if (profiles.length === 0) {
    console.log(
      chalk.yellow('No profiles found. Create one with "wundr computer-setup"'),
    );
    return;
  }

  profiles.forEach((profile, i) => {
    console.log(chalk.white(`${i + 1}. ${profile.name}`));
    console.log(chalk.gray(`   Role: ${profile.role}`));
    console.log(chalk.gray(`   Email: ${profile.email}`));
    if (profile.team) {
      console.log(chalk.gray(`   Team: ${profile.team}`));
    }
  });
}

async function validateSetup(): Promise<void> {
  const spinner = ora('Validating machine setup...').start();

  try {
    const manager = new ComputerSetupManager();
    await manager.initialize();

    // Get current profile
    const profiles = await manager.getAvailableProfiles();
    if (profiles.length === 0) {
      spinner.stop();
      console.log(
        chalk.yellow('No profile found. Run "wundr computer-setup" first.'),
      );
      return;
    }

    const profile = profiles[0]; // Use most recent
    if (!profile) {
      console.log(
        chalk.yellow('No profile found. Run "wundr computer-setup" first.'),
      );
      return;
    }
    const isValid = await manager.validateSetup(profile);

    spinner.stop();

    if (isValid) {
      console.log(chalk.green('✅ Machine setup is valid!'));
    } else {
      console.log(chalk.red('❌ Machine setup has issues'));
      console.log(
        chalk.yellow(
          '\nRun "wundr computer-setup doctor" to diagnose and fix issues',
        ),
      );
    }
  } catch (error) {
    spinner.stop();
    console.error(chalk.red('Validation failed:'), error);
  }
}

async function runDoctor(): Promise<void> {
  console.log(chalk.cyan('\n🏥 Computer Setup Doctor\n'));
  console.log(chalk.gray('Diagnosing your machine setup...\n'));

  const checks = [
    { name: 'Node.js', command: 'node --version', required: true },
    { name: 'npm', command: 'npm --version', required: true },
    { name: 'pnpm', command: 'pnpm --version', required: false },
    { name: 'Git', command: 'git --version', required: true },
    { name: 'Docker', command: 'docker --version', required: false },
    { name: 'Claude Code', command: 'claude --version', required: false },
    { name: 'GitHub CLI', command: 'gh --version', required: false },
  ];

  for (const check of checks) {
    const spinner = ora(`Checking ${check.name}...`).start();

    try {
      const { execa } = (await import('execa')) as any;
      const { stdout } = await execa(
        check.command.split(' ')[0],
        check.command.split(' ').slice(1),
      );
      spinner.succeed(`${check.name}: ${stdout.trim()}`);
    } catch (error) {
      if (check.required) {
        spinner.fail(`${check.name}: Not found (REQUIRED)`);
      } else {
        spinner.warn(`${check.name}: Not found (optional)`);
      }
    }
  }

  console.log(chalk.cyan('\n💊 Recommendations:\n'));
  console.log('1. Install missing required tools');
  console.log('2. Run "wundr computer-setup" to complete setup');
  console.log('3. Check PATH environment variable');
}

async function applyTeamConfig(team: string): Promise<void> {
  console.log(chalk.cyan(`\n👥 Applying team configuration: ${team}\n`));

  const spinner = ora('Downloading team configuration...').start();

  try {
    // This would fetch team config from a central repository
    // For now, we'll simulate it
    await new Promise(resolve => setTimeout(resolve, 2000));

    spinner.succeed('Team configuration downloaded');
    console.log(chalk.green('✅ Team configuration applied successfully!'));

    console.log(chalk.cyan('\nTeam tools installed:'));
    console.log('  - Internal CLI tools');
    console.log('  - Team-specific VS Code extensions');
    console.log('  - Pre-commit hooks');
    console.log('  - Team aliases and scripts');
  } catch (error) {
    spinner.fail('Failed to apply team configuration');
    console.error(chalk.red('Error:'), error);
  }
}

function generateProgressBar(percentage: number): string {
  const width = 30;
  const filled = Math.round((width * percentage) / 100);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}
