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
