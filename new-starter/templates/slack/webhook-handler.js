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
