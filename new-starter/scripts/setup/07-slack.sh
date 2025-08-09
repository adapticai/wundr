#!/bin/bash

set -euo pipefail
# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Source common utilities
source "${SCRIPT_DIR}/scripts/setup/common.sh"
log() {
    echo -e "[SLACK] $1" | tee -a "$LOG_FILE"
}

install_slack() {
    log "Installing Slack..."
    
    if [[ "$OS" == "macos" ]]; then
        if [[ -d "/Applications/Slack.app" ]]; then
            log "Slack already installed"
        else
            brew install --cask slack
            log "Slack installed"
        fi
    elif [[ "$OS" == "linux" ]]; then
        if ! command -v slack &> /dev/null; then
            wget -q -O - https://packagecloud.io/slacktechnologies/slack/gpgkey | sudo apt-key add -
            echo "deb https://packagecloud.io/slacktechnologies/slack/debian/ jessie main" | sudo tee /etc/apt/sources.list.d/slack.list
            sudo apt-get update
            sudo apt-get install -y slack-desktop
            log "Slack installed"
        else
            log "Slack already installed"
        fi
    fi
}

configure_slack_cli() {
    log "Installing Slack CLI..."
    
    if ! command -v slack &> /dev/null; then
        if [[ "$OS" == "macos" ]]; then
            curl -fsSL https://downloads.slack-edge.com/slack-cli/install.sh | bash
        elif [[ "$OS" == "linux" ]]; then
            curl -fsSL https://downloads.slack-edge.com/slack-cli/install.sh | bash
        fi
        
        log "Slack CLI installed"
    else
        log "Slack CLI already installed"
    fi
}

setup_slack_workflow() {
    log "Setting up Slack workflow integrations..."
    
    mkdir -p "${SCRIPT_DIR}/templates/slack"
    
    cat > "${SCRIPT_DIR}/templates/slack/manifest.json" << 'EOF'
{
  "display_information": {
    "name": "Development Bot",
    "description": "Bot for development team notifications",
    "background_color": "#4A154B"
  },
  "features": {
    "app_home": {
      "home_tab_enabled": true,
      "messages_tab_enabled": true,
      "messages_tab_read_only_enabled": false
    },
    "bot_user": {
      "display_name": "DevBot",
      "always_online": true
    },
    "slash_commands": [
      {
        "command": "/deploy",
        "description": "Deploy to environment",
        "usage_hint": "[environment] [branch]",
        "should_escape": false
      },
      {
        "command": "/pr",
        "description": "Create or review pull request",
        "usage_hint": "[action] [url]",
        "should_escape": false
      },
      {
        "command": "/status",
        "description": "Check service status",
        "usage_hint": "[service]",
        "should_escape": false
      }
    ]
  },
  "oauth_config": {
    "scopes": {
      "bot": [
        "channels:history",
        "channels:read",
        "chat:write",
        "commands",
        "groups:history",
        "groups:read",
        "im:history",
        "im:read",
        "im:write",
        "mpim:history",
        "mpim:read",
        "mpim:write",
        "users:read",
        "files:write",
        "files:read"
      ]
    }
  },
  "settings": {
    "event_subscriptions": {
      "bot_events": [
        "app_mention",
        "message.channels",
        "message.groups",
        "message.im",
        "message.mpim"
      ]
    },
    "interactivity": {
      "is_enabled": true
    },
    "org_deploy_enabled": false,
    "socket_mode_enabled": true
  }
}
EOF
    
    cat > "${SCRIPT_DIR}/templates/slack/webhook-handler.js" << 'EOF'
const { WebClient } = require('@slack/web-api');
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
      text: `Hello <@${event.user}>! How can I help you?`,
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
    text: `Deploying ${branch || 'main'} to ${environment || 'staging'}...`
  };
}

async function handlePR(command) {
  const [action, url] = command.text.split(' ');
  return {
    response_type: 'ephemeral',
    text: `Processing PR ${action}: ${url}`
  };
}

async function handleStatus(command) {
  const service = command.text.trim();
  return {
    response_type: 'ephemeral',
    text: `Checking status for ${service || 'all services'}...`
  };
}

module.exports = {
  web,
  slackEvents,
  slackInteractions,
  handleSlashCommand
};
EOF
    
    cat > "${SCRIPT_DIR}/templates/slack/github-integration.js" << 'EOF'
const { WebClient } = require('@slack/web-api');
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
          text: `*PR ${action}:* <${pull_request.html_url}|#${pull_request.number} - ${pull_request.title}>`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Repository:*\n${repository.full_name}`
          },
          {
            type: 'mrkdwn',
            text: `*Author:*\n<${pull_request.user.html_url}|${pull_request.user.login}>`
          },
          {
            type: 'mrkdwn',
            text: `*Branch:*\n${pull_request.head.ref} → ${pull_request.base.ref}`
          },
          {
            type: 'mrkdwn',
            text: `*Status:*\n${pull_request.state}`
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
          url: `${pull_request.html_url}/files`
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
    text: `${emoji} *CI Status:* ${context} - ${state}`,
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
EOF
    
    log "Slack workflow templates created"
}

install_slack_sdk() {
    log "Installing Slack SDK for development..."
    
    if [[ -f "${SCRIPT_DIR}/package.json" ]]; then
        npm install --save-dev @slack/web-api @slack/events-api @slack/interactive-messages @slack/bolt
    else
        cat > "${SCRIPT_DIR}/templates/slack/package.json" << 'EOF'
{
  "name": "slack-integrations",
  "version": "1.0.0",
  "description": "Slack integrations for development workflow",
  "dependencies": {
    "@slack/web-api": "^6.9.0",
    "@slack/events-api": "^3.0.1",
    "@slack/interactive-messages": "^2.0.0",
    "@slack/bolt": "^3.13.0",
    "@octokit/rest": "^20.0.0",
    "dotenv": "^16.3.0"
  }
}
EOF
        log "Slack SDK package.json template created"
    fi
}

create_slack_env_template() {
    log "Creating Slack environment template..."
    
    cat > "${SCRIPT_DIR}/templates/slack/.env.example" << EOF
# Slack Configuration
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
EOF
    
    log "Slack environment template created"
}

main() {
    log "Starting Slack setup..."
    
    install_slack
    configure_slack_cli
    setup_slack_workflow
    install_slack_sdk
    create_slack_env_template
    
    log "Slack setup completed"
    log "Note: You'll need to configure Slack workspace authentication after setup"
}

main