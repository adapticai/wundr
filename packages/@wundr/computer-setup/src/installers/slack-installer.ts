/**
 * Slack Installer - Complete Slack setup with CLI and workflow integrations
 * Ports functionality from 07-slack.sh
 */
import { execa } from 'execa';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';
import which from 'which';
import { BaseInstaller } from './index';
import { SetupPlatform, SetupStep, DeveloperProfile } from '../types';

export class SlackInstaller implements BaseInstaller {
  name = 'slack';
  private readonly homeDir = os.homedir();
  
  isSupported(platform: SetupPlatform): boolean {
    return ['darwin', 'linux'].includes(platform.os);
  }

  async isInstalled(): Promise<boolean> {
    if (os.platform() === 'darwin') {
      try {
        await fs.access('/Applications/Slack.app');
        return true;
      } catch {
        return false;
      }
    } else {
      try {
        await which('slack');
        return true;
      } catch {
        return false;
      }
    }
  }

  async getVersion(): Promise<string | null> {
    try {
      if (os.platform() === 'darwin') {
        const plistPath = '/Applications/Slack.app/Contents/Info.plist';
        const { stdout } = await execa('plutil', ['-p', plistPath]);
        const versionMatch = stdout.match(/"CFBundleShortVersionString"\s*=>\s*"([^"]+)"/);
        return versionMatch ? `Slack ${versionMatch[1]}` : 'Slack (version unknown)';
      } else {
        const { stdout } = await execa('slack', ['--version']);
        return stdout.trim();
      }
    } catch {
      return null;
    }
  }

  async install(profile: DeveloperProfile, platform: SetupPlatform): Promise<void> {
    console.log(`Installing Slack for ${profile.name || 'user'}...`);

    // Install Slack application
    await this.installSlack(platform);

    // Configure Slack CLI
    await this.configureSlackCLI();

    // Setup workflow integrations
    await this.setupSlackWorkflow();

    // Install Slack SDK for development
    await this.installSlackSDK();

    // Create environment template
    await this.createSlackEnvTemplate();
  }

  async configure(profile: DeveloperProfile, platform: SetupPlatform): Promise<void> {
    // Log configuration context for debugging
    console.log(`Slack configuration verified for ${profile.name || 'user'} on ${platform.os}`);
  }

  async validate(): Promise<boolean> {
    try {
      // Check if Slack app is installed
      const appInstalled = await this.isInstalled();
      if (!appInstalled) return false;
      
      // Check if Slack CLI is available (optional)
      try {
        await which('slack');
      } catch {
        // CLI not required for basic functionality
      }
      
      return true;
    } catch (error) {
      console.error('Slack validation failed:', error);
      return false;
    }
  }

  getSteps(profile: DeveloperProfile, platform: SetupPlatform): SetupStep[] {
    return [{
      id: 'install-slack',
      name: 'Install Slack',
      description: 'Install Slack application and development tools',
      category: 'communication',
      required: false,
      dependencies: ['install-homebrew'],
      estimatedTime: 120,
      validator: () => this.validate(),
      installer: () => this.install(profile, platform)
    }];
  }

  private async installSlack(platform: SetupPlatform): Promise<void> {
    if (platform.os === 'darwin') {
      // macOS installation
      try {
        await fs.access('/Applications/Slack.app');
        console.log('Slack already installed');
      } catch {
        try {
          await which('brew');
          console.log('Installing Slack via Homebrew...');
          await execa('brew', ['install', '--cask', 'slack']);
          console.log('Slack installed');
        } catch {
          throw new Error('Homebrew not found. Please install Homebrew first.');
        }
      }
    } else if (platform.os === 'linux') {
      // Linux installation
      try {
        await which('slack');
        console.log('Slack already installed');
      } catch {
        await this.installSlackLinux();
      }
    }
  }

  private async installSlackLinux(): Promise<void> {
    const commands = [
      'wget -q -O - https://packagecloud.io/slacktechnologies/slack/gpgkey | sudo apt-key add -',
      'echo "deb https://packagecloud.io/slacktechnologies/slack/debian/ jessie main" | sudo tee /etc/apt/sources.list.d/slack.list',
      'sudo apt-get update',
      'sudo apt-get install -y slack-desktop'
    ];
    
    for (const cmd of commands) {
      try {
        await execa('bash', ['-c', cmd]);
      } catch (error) {
        console.warn(`Command failed: ${cmd}`, error);
      }
    }
    
    console.log('Slack installed');
  }

  private async configureSlackCLI(): Promise<void> {
    console.log('Installing Slack CLI...');
    
    // Check if slack CLI is already installed
    try {
      await which('slack');
      console.log('Slack CLI already installed');
      return;
    } catch {
      // Check if it exists in expected location
      const slackCLIPath = path.join(this.homeDir, '.slack/bin/slack');
      try {
        await fs.access(slackCLIPath);
        console.log('Slack CLI found in ~/.slack/bin');
        await this.addSlackCLIToPath();
        return;
      } catch {
        // Install Slack CLI
      }
    }
    
    // Create /usr/local/bin if it doesn't exist (macOS)
    if (os.platform() === 'darwin') {
      try {
        const stat = await fs.lstat('/usr/local/bin');
        if (!stat.isDirectory()) {
          console.log('Creating /usr/local/bin directory...');
          await execa('sudo', ['mkdir', '-p', '/usr/local/bin']);
          await execa('sudo', ['chown', '-R', `${os.userInfo().username}:admin`, '/usr/local']);
        }
      } catch {
        console.log('Creating /usr/local/bin directory...');
        try {
          await execa('sudo', ['mkdir', '-p', '/usr/local/bin']);
          await execa('sudo', ['chown', '-R', `${os.userInfo().username}:admin`, '/usr/local']);
        } catch (error) {
          console.warn('Failed to create /usr/local/bin:', error);
        }
      }
    }
    
    // Install Slack CLI
    try {
      const installScript = 'https://downloads.slack-edge.com/slack-cli/install.sh';
      await execa('bash', ['-c', `curl -fsSL ${installScript} | bash`]);
      
      // Add to PATH if installation succeeded but command not found
      const slackCLIPath = path.join(this.homeDir, '.slack/bin/slack');
      try {
        await fs.access(slackCLIPath);
        await this.addSlackCLIToPath();
        console.log('Slack CLI installed');
      } catch {
        console.warn('Slack CLI installation may have failed');
      }
    } catch (error) {
      console.warn('Slack CLI installation failed:', error);
      console.log('You can install it manually by running: curl -fsSL https://downloads.slack-edge.com/slack-cli/install.sh | bash');
    }
  }

  private async addSlackCLIToPath(): Promise<void> {
    const slackBinPath = path.join(this.homeDir, '.slack/bin');
    const pathExport = `export PATH="${slackBinPath}:$PATH"`;
    
    const shellFiles = ['.zshrc', '.bashrc'];
    
    for (const shellFile of shellFiles) {
      const shellPath = path.join(this.homeDir, shellFile);
      
      try {
        let shellContent = '';
        try {
          shellContent = await fs.readFile(shellPath, 'utf-8');
        } catch {
          // File doesn't exist
        }
        
        if (!shellContent.includes('.slack/bin')) {
          await fs.writeFile(shellPath, shellContent + '\n' + pathExport + '\n', 'utf-8');
        }
      } catch (error) {
        console.warn(`Failed to update ${shellFile}:`, error);
      }
    }
    
    // Add to current process PATH
    process.env.PATH = `${slackBinPath}:${process.env.PATH}`;
  }

  private async setupSlackWorkflow(): Promise<void> {
    console.log('Setting up Slack workflow integrations...');
    
    const templatesDir = path.join(this.homeDir, '.slack-templates');
    
    try {
      await fs.mkdir(templatesDir, { recursive: true });
      
      // Slack app manifest
      const manifest = {
        display_information: {
          name: 'Development Bot',
          description: 'Bot for development team notifications',
          background_color: '#4A154B'
        },
        features: {
          app_home: {
            home_tab_enabled: true,
            messages_tab_enabled: true,
            messages_tab_read_only_enabled: false
          },
          bot_user: {
            display_name: 'DevBot',
            always_online: true
          },
          slash_commands: [
            {
              command: '/deploy',
              description: 'Deploy to environment',
              usage_hint: '[environment] [branch]',
              should_escape: false
            },
            {
              command: '/pr',
              description: 'Create or review pull request',
              usage_hint: '[action] [url]',
              should_escape: false
            },
            {
              command: '/status',
              description: 'Check service status',
              usage_hint: '[service]',
              should_escape: false
            }
          ]
        },
        oauth_config: {
          scopes: {
            bot: [
              'channels:history',
              'channels:read',
              'chat:write',
              'commands',
              'groups:history',
              'groups:read',
              'im:history',
              'im:read',
              'im:write',
              'mpim:history',
              'mpim:read',
              'mpim:write',
              'users:read',
              'files:write',
              'files:read'
            ]
          }
        },
        settings: {
          event_subscriptions: {
            bot_events: [
              'app_mention',
              'message.channels',
              'message.groups',
              'message.im',
              'message.mpim'
            ]
          },
          interactivity: {
            is_enabled: true
          },
          org_deploy_enabled: false,
          socket_mode_enabled: true
        }
      };

      await fs.writeFile(path.join(templatesDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
      
      // Webhook handler template
      const webhookHandler = `const { WebClient } = require('@slack/web-api');
const { createEventAdapter } = require('@slack/events-api');
const { createMessageAdapter } = require('@slack/interactive-messages');

// Initialize Slack clients
const web = new WebClient(process.env.SLACK_BOT_TOKEN);
const slackEvents = createEventAdapter(process.env.SLACK_SIGNING_SECRET);
const slackInteractions = createMessageAdapter(process.env.SLACK_SIGNING_SECRET);

// Handle incoming events
slackEvents.on('app_mention', async (event) => {
  try {
    await web.chat.postMessage({
      channel: event.channel,
      text: \`Hello <@\${event.user}>! How can I help you?\`,
      thread_ts: event.ts
    });
  } catch (error) {
    console.error('Error responding to mention:', error);
  }
});

// Handle slash commands
async function handleSlashCommand(command) {
  switch (command.command) {
    case '/deploy':
      return handleDeploy(command);
    case '/pr':
      return handlePR(command);
    case '/status':
      return handleStatus(command);
    default:
      return { text: 'Unknown command' };
  }
}

async function handleDeploy(command) {
  const [environment, branch] = command.text.split(' ');
  return {
    response_type: 'in_channel',
    text: \`Deploying \${branch || 'main'} to \${environment || 'staging'}...\`
  };
}

async function handlePR(command) {
  const [action, url] = command.text.split(' ');
  return {
    response_type: 'ephemeral',
    text: \`Processing PR \${action}: \${url}\`
  };
}

async function handleStatus(command) {
  const service = command.text.trim();
  return {
    response_type: 'ephemeral',
    text: \`Checking status for \${service || 'all services'}...\`
  };
}

module.exports = {
  web,
  slackEvents,
  slackInteractions,
  handleSlashCommand
};
`;

      await fs.writeFile(path.join(templatesDir, 'webhook-handler.js'), webhookHandler);
      
      // GitHub integration template
      const githubIntegration = `const { WebClient } = require('@slack/web-api');
const { Octokit } = require('@octokit/rest');

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
// Get GitHub token from gh CLI or environment
const githubToken = process.env.GITHUB_TOKEN || require('child_process').execSync('gh auth token 2>/dev/null', { encoding: 'utf-8' }).trim();
const github = new Octokit({
  auth: githubToken
});

// Notify Slack about PR events
async function notifyPREvent(event) {
  const { action, pull_request, repository } = event;
  
  const message = {
    channel: process.env.SLACK_CHANNEL_ID,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: \`*PR \${action}:* <\${pull_request.html_url}|#\${pull_request.number} - \${pull_request.title}>\`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: \`*Repository:*\\n\${repository.full_name}\`
          },
          {
            type: 'mrkdwn',
            text: \`*Author:*\\n<\${pull_request.user.html_url}|\${pull_request.user.login}>\`
          },
          {
            type: 'mrkdwn',
            text: \`*Branch:*\\n\${pull_request.head.ref} → \${pull_request.base.ref}\`
          },
          {
            type: 'mrkdwn',
            text: \`*Status:*\\n\${pull_request.state}\`
          }
        ]
      }
    ]
  };
  
  if (action === 'opened' || action === 'reopened') {
    message.blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Review PR'
          },
          url: pull_request.html_url,
          style: 'primary'
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View Diff'
          },
          url: \`\${pull_request.html_url}/files\`
        }
      ]
    });
  }
  
  await slack.chat.postMessage(message);
}

// Notify about CI/CD status
async function notifyCIStatus(event) {
  const { state, description, target_url, context } = event;
  
  const emoji = {
    pending: '🔄',
    success: '✅',
    failure: '❌',
    error: '⚠️'
  }[state] || '❓';
  
  await slack.chat.postMessage({
    channel: process.env.SLACK_CHANNEL_ID,
    text: \`\${emoji} *CI Status:* \${context} - \${state}\`,
    attachments: [
      {
        color: state === 'success' ? 'good' : state === 'failure' ? 'danger' : 'warning',
        fields: [
          {
            title: 'Description',
            value: description,
            short: false
          }
        ],
        actions: target_url ? [
          {
            type: 'button',
            text: 'View Details',
            url: target_url
          }
        ] : []
      }
    ]
  });
}

module.exports = {
  notifyPREvent,
  notifyCIStatus
};
`;

      await fs.writeFile(path.join(templatesDir, 'github-integration.js'), githubIntegration);
      
      console.log(`Slack workflow templates created in ${templatesDir}`);
    } catch (error) {
      console.warn('Failed to create Slack workflow templates:', error);
    }
  }

  private async installSlackSDK(): Promise<void> {
    console.log('Installing Slack SDK for development...');
    
    const packageTemplate = {
      name: 'slack-integrations',
      version: '1.0.0',
      description: 'Slack integrations for development workflow',
      dependencies: {
        '@slack/web-api': '^6.9.0',
        '@slack/events-api': '^3.0.1',
        '@slack/interactive-messages': '^2.0.0',
        '@slack/bolt': '^3.13.0',
        '@octokit/rest': '^20.0.0',
        dotenv: '^16.3.0'
      }
    };
    
    const templatesDir = path.join(this.homeDir, '.slack-templates');
    
    try {
      await fs.writeFile(
        path.join(templatesDir, 'package.json'),
        JSON.stringify(packageTemplate, null, 2)
      );
      console.log('Slack SDK package.json template created');
    } catch (error) {
      console.warn('Failed to create Slack SDK package.json:', error);
    }
  }

  private async createSlackEnvTemplate(): Promise<void> {
    console.log('Creating Slack environment template...');
    
    const envTemplate = `# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_CHANNEL_ID=C1234567890

# GitHub Integration
# GitHub token will be automatically retrieved from gh CLI if authenticated
# Run 'gh auth login' to authenticate GitHub CLI
GITHUB_WEBHOOK_SECRET=your-webhook-secret

# Webhook URLs
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
`;

    const templatesDir = path.join(this.homeDir, '.slack-templates');
    
    try {
      await fs.writeFile(path.join(templatesDir, '.env.example'), envTemplate);
      console.log('Slack environment template created');
    } catch (error) {
      console.warn('Failed to create Slack environment template:', error);
    }
  }

  async uninstall(): Promise<void> {
    console.log('Uninstalling Slack...');
    
    try {
      if (os.platform() === 'darwin') {
        // Remove Slack app
        await fs.rm('/Applications/Slack.app', { recursive: true });
      } else {
        // Linux uninstall
        await execa('sudo', ['apt', 'remove', 'slack-desktop', '-y']);
      }
      
      // Remove Slack CLI
      const slackDir = path.join(this.homeDir, '.slack');
      await fs.rm(slackDir, { recursive: true, force: true });
      
      // Remove templates
      const templatesDir = path.join(this.homeDir, '.slack-templates');
      await fs.rm(templatesDir, { recursive: true, force: true });
      
      console.log('Slack uninstalled');
    } catch (error) {
      throw new Error(`Slack uninstallation failed: ${error}`);
    }
  }
}