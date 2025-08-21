const { WebClient } = require('@slack/web-api');
const { createEventAdapter } = require('@slack/events-api');
const { createMessageAdapter } = require('@slack/interactive-messages');

// Initialize Slack clients
const web = new WebClient(process.env.SLACK_BOT_TOKEN);
const slackEvents = createEventAdapter(process.env.SLACK_SIGNING_SECRET);
const slackInteractions = createMessageAdapter(process.env.SLACK_SIGNING_SECRET);

// Configuration
const CONFIG = {
  botName: '{{BOT_NAME}}',
  defaultChannel: '{{DEFAULT_CHANNEL}}',
  allowedUsers: [{{#ALLOWED_USERS}}'{{.}}',{{/ALLOWED_USERS}}],
  commands: {
    deploy: {{ENABLE_DEPLOY_COMMAND}},
    pr: {{ENABLE_PR_COMMAND}},
    status: {{ENABLE_STATUS_COMMAND}}
  }
};

// Handle incoming events
slackEvents.on('app_mention', async (event) => {
  try {
    await web.chat.postMessage({
      channel: event.channel,
      text: `Hello <@${event.user}>! I'm ${CONFIG.botName}. How can I help you?`,
      thread_ts: event.ts
    });
  } catch (error) {
    console.error('Error responding to mention:', error);
  }
});

// Handle direct messages
slackEvents.on('message', async (event) => {
  // Only respond to DMs (not channel messages)
  if (event.channel_type === 'im' && !event.bot_id) {
    try {
      await web.chat.postMessage({
        channel: event.channel,
        text: `Hi! You can use these commands:\n${getAvailableCommands()}`
      });
    } catch (error) {
      console.error('Error responding to DM:', error);
    }
  }
});

// Handle slash commands
async function handleSlashCommand(command) {
  // Check if user is authorized
  if (CONFIG.allowedUsers.length > 0 && !CONFIG.allowedUsers.includes(command.user_name)) {
    return { text: 'You are not authorized to use this command.' };
  }

  switch (command.command) {
    case '/deploy':
      return CONFIG.commands.deploy ? handleDeploy(command) : { text: 'Deploy command is disabled.' };
    case '/pr':
      return CONFIG.commands.pr ? handlePR(command) : { text: 'PR command is disabled.' };
    case '/status':
      return CONFIG.commands.status ? handleStatus(command) : { text: 'Status command is disabled.' };
    default:
      return { text: `Unknown command. Available commands: ${getAvailableCommands()}` };
  }
}

async function handleDeploy(command) {
  const [environment, branch] = command.text.split(' ');
  const validEnvironments = ['{{VALID_ENVIRONMENTS}}'].filter(Boolean);
  
  if (validEnvironments.length > 0 && !validEnvironments.includes(environment)) {
    return {
      response_type: 'ephemeral',
      text: `Invalid environment. Valid environments: ${validEnvironments.join(', ')}`
    };
  }

  return {
    response_type: 'in_channel',
    text: `🚀 Deploying ${branch || 'main'} to ${environment || 'staging'}...\n_This is a simulated deployment. Integrate with your actual deployment system._`
  };
}

async function handlePR(command) {
  const [action, url] = command.text.split(' ');
  const validActions = ['create', 'review', 'merge', 'close'];
  
  if (!validActions.includes(action)) {
    return {
      response_type: 'ephemeral',
      text: `Invalid action. Valid actions: ${validActions.join(', ')}`
    };
  }

  return {
    response_type: 'ephemeral',
    text: `📋 Processing PR ${action}: ${url || 'No URL provided'}\n_This is a simulated action. Integrate with your actual PR management system._`
  };
}

async function handleStatus(command) {
  const service = command.text.trim();
  const availableServices = ['{{AVAILABLE_SERVICES}}'].filter(Boolean);
  
  if (service && availableServices.length > 0 && !availableServices.includes(service)) {
    return {
      response_type: 'ephemeral',
      text: `Unknown service. Available services: ${availableServices.join(', ')}`
    };
  }

  return {
    response_type: 'ephemeral',
    text: `📊 Checking status for ${service || 'all services'}...\n_This is a simulated status check. Integrate with your actual monitoring system._`
  };
}

function getAvailableCommands() {
  const commands = [];
  if (CONFIG.commands.deploy) commands.push('/deploy');
  if (CONFIG.commands.pr) commands.push('/pr');
  if (CONFIG.commands.status) commands.push('/status');
  return commands.join(', ');
}

// Error handling
slackEvents.on('error', (error) => {
  console.error('Slack Events API error:', error);
});

slackInteractions.on('error', (error) => {
  console.error('Slack Interactive Messages error:', error);
});

module.exports = {
  web,
  slackEvents,
  slackInteractions,
  handleSlashCommand,
  CONFIG
};