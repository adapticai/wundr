# @wundr.io/slack-agent

Complete Slack user agent capabilities for VP (Virtual Principal) agents operating as full Slack workspace members.

## Overview

The `@wundr.io/slack-agent` package enables VP agents to operate as real Slack users within workspaces. Unlike traditional bots, VP agents:

- Appear as full workspace members with their own user accounts
- Send messages that look like they come from a real user
- Have their own profile, status, and presence
- Can perform all user-level operations (DMs, reactions, file sharing, etc.)

This package provides a unified `SlackUserAgent` class that integrates 19 capability modules, giving VP agents comprehensive Slack functionality through a single interface.

## Installation

```bash
npm install @wundr.io/slack-agent @slack/web-api @slack/socket-mode
```

## Quick Start

```typescript
import { SlackUserAgent } from '@wundr.io/slack-agent';

const agent = new SlackUserAgent({
  userToken: process.env.SLACK_USER_TOKEN!,    // xoxp-...
  botToken: process.env.SLACK_BOT_TOKEN!,      // xoxb-...
  appToken: process.env.SLACK_APP_TOKEN!,      // xapp-...
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
  vpIdentity: {
    name: 'Ada VP',
    firstName: 'Ada',
    lastName: 'VP',
    email: 'ada@adaptic.ai',
  },
});

// Start the agent (connects via Socket Mode for real-time events)
await agent.start();

// Send a message
await agent.sendMessage('C123456', 'Hello from Ada!');

// React to a message
await agent.addReaction('C123456', '1234567890.123456', 'thumbsup');

// Set status
await agent.setStatus('Working on feature', ':computer:');

// Listen for messages
agent.onMessage(async (event) => {
  console.log(`Received message: ${event.text}`);
  if (event.text?.includes('hello')) {
    await agent.sendMessage(event.channel!, 'Hello back!');
  }
});

// Stop the agent when done
await agent.stop();
```

### Using Factory Functions

```typescript
import { createSlackUserAgent, createSlackUserAgentFromEnv } from '@wundr.io/slack-agent';

// Create with explicit config
const agent = createSlackUserAgent({
  userToken: 'xoxp-...',
  botToken: 'xoxb-...',
  appToken: 'xapp-...',
  signingSecret: '...',
  vpIdentity: { name: 'Ada', firstName: 'Ada', lastName: 'VP', email: 'ada@adaptic.ai' },
});

// Or create from environment variables
const agentFromEnv = createSlackUserAgentFromEnv();
```

## Configuration

### SlackUserAgentConfig Interface

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `userToken` | `string` | Yes | User token (xoxp-) for user-level operations |
| `botToken` | `string` | Yes | Bot token (xoxb-) for bot operations |
| `appToken` | `string` | Yes | App token (xapp-) for Socket Mode real-time events |
| `signingSecret` | `string` | Yes | Slack App signing secret for request verification |
| `vpIdentity` | `VPIdentity` | Yes | VP agent identity configuration |
| `debug` | `boolean` | No | Enable debug logging (default: `false`) |
| `autoConnect` | `boolean` | No | Auto-connect on start (default: `true`) |
| `defaultTeamId` | `string` | No | Default team ID for Enterprise Grid |

### VPIdentity Interface

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Full display name |
| `firstName` | `string` | Yes | First name |
| `lastName` | `string` | Yes | Last name |
| `email` | `string` | Yes | Email address |
| `avatarPath` | `string` | No | Path to avatar image file |
| `title` | `string` | No | Job title |
| `pronouns` | `string` | No | Pronouns |
| `timezone` | `string` | No | Timezone identifier |

### Environment Variables

When using `createSlackUserAgentFromEnv()`:

```bash
# Required
SLACK_USER_TOKEN=xoxp-...
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SLACK_SIGNING_SECRET=...

# VP Identity
VP_NAME=Ada VP
VP_FIRST_NAME=Ada
VP_LAST_NAME=VP
VP_EMAIL=ada@adaptic.ai
VP_AVATAR_PATH=/path/to/avatar.png
VP_TITLE=Virtual Principal Agent
VP_PRONOUNS=they/them
VP_TIMEZONE=America/New_York

# Optional
SLACK_DEBUG=true
SLACK_TEAM_ID=T123456
```

## Capabilities

The package provides 19 capability modules, all accessible through the unified `SlackUserAgent` class:

| Capability | Description | Key Methods |
|------------|-------------|-------------|
| **proactive-messaging** | Initiate DMs, group chats, channel posts | `sendMessage()`, `sendDM()`, `scheduleMessage()` |
| **file-operations** | Upload, download, share files | `uploadFile()`, `downloadFile()`, `shareFile()` |
| **reactions** | Add/remove emoji reactions | `addReaction()`, `removeReaction()`, `getReactions()` |
| **channel-management** | Create, archive, rename channels | `createChannel()`, `archiveChannel()`, `setChannelTopic()` |
| **channel-membership** | Join, leave, invite to channels | `joinChannel()`, `leaveChannel()`, `inviteToChannel()` |
| **presence-status** | Set online/away, custom status | `setStatus()`, `setPresence()`, `setInMeeting()` |
| **message-management** | Edit, delete, pin messages | `editMessage()`, `deleteMessage()`, `pinMessage()` |
| **threading** | Reply to threads, get thread info | `replyToThread()` |
| **search** | Search messages, files, users | `searchMessages()`, `searchFiles()`, `searchUsers()` |
| **profile-management** | Update profile, photo, custom fields | `setDisplayName()`, `setProfilePhoto()` |
| **dnd-controls** | Do Not Disturb settings | `enableDnd()`, `disableDnd()`, `isDndActive()` |
| **reminders** | Create and manage reminders | `createReminder()`, `remindMeIn()`, `listReminders()` |
| **starred-items** | Star/unstar messages and files | `starMessage()`, `unstarMessage()`, `listStarredItems()` |
| **bookmarks** | Manage channel bookmarks | `addBookmark()`, `removeBookmark()`, `listBookmarks()` |
| **usergroups** | Manage @mention groups | `createUsergroup()`, `addUsergroupMembers()` |
| **scheduled-messages** | Schedule future messages | `scheduleMessage()` (via proactive-messaging) |
| **canvas** | Create/edit Slack canvases | Available via direct capability access |
| **huddles-calls** | Huddle integration | Available via direct capability access |
| **workflows** | Trigger Slack workflows | Available via direct capability access |

## Individual Capability Usage

Each capability module can be used independently for more granular control:

### Proactive Messaging

```typescript
import { ProactiveMessenger, createProactiveMessengerFromEnv } from '@wundr.io/slack-agent';

const messenger = createProactiveMessengerFromEnv();

// Send DM
await messenger.sendDM('U123456', 'Hello!');

// Send to channel with options
await messenger.postToChannel('C123456', 'Team update', {
  threadTs: '1234567890.123456',  // Reply in thread
  unfurlLinks: false,
});

// Send BlockKit message
await messenger.postToChannel('C123456', {
  blocks: [
    { type: 'section', text: { type: 'mrkdwn', text: '*Important Update*' } }
  ],
  text: 'Important Update',  // Fallback for notifications
});

// Schedule a message
await messenger.scheduleMessage(
  'C123456',
  'Reminder: Meeting in 15 minutes!',
  new Date(Date.now() + 15 * 60 * 1000)
);
```

### File Operations

```typescript
import { SlackFileOperations, createFileOperations } from '@wundr.io/slack-agent';

const fileOps = createFileOperations(process.env.SLACK_BOT_TOKEN!);

// Upload from path
await fileOps.uploadFileFromPath('./report.pdf', ['C123456'], {
  title: 'Q4 Report',
  initialComment: 'Here is the quarterly report.',
});

// Upload from buffer
await fileOps.uploadFileFromBuffer(
  Buffer.from('console.log("Hello!")'),
  'hello.js',
  ['C123456']
);

// Download a file
const buffer = await fileOps.downloadFile(fileUrl);

// Upload code snippet
await fileOps.uploadCodeSnippet(
  'function hello() { return "world"; }',
  'snippet.ts',
  'typescript',
  ['C123456'],
  'TypeScript Example'
);
```

### Reactions

```typescript
import { SlackReactions, CommonEmojis } from '@wundr.io/slack-agent';

const reactions = new SlackReactions(process.env.SLACK_USER_TOKEN!);

// Add reaction
await reactions.addReaction('C123456', '1234567890.123456', 'thumbsup');

// Use smart reaction helpers
await reactions.acknowledge('C123456', '1234567890.123456');  // eyes emoji
await reactions.approve('C123456', '1234567890.123456');      // thumbsup emoji
await reactions.complete('C123456', '1234567890.123456');     // white_check_mark

// Bulk add reactions
await reactions.bulkAddReactions('C123456', '1234567890.123456', ['fire', 'rocket', 'star']);

// Use common emoji constants
await reactions.addReaction('C123456', '1234567890.123456', CommonEmojis.SHIP_IT);
```

### Presence and Status

```typescript
import { PresenceStatusManager, PresetStatuses } from '@wundr.io/slack-agent';
import { WebClient } from '@slack/web-api';

const client = new WebClient(process.env.SLACK_USER_TOKEN);
const presence = new PresenceStatusManager(client);

// Set presence
await presence.setPresence('auto');  // Active
await presence.setPresence('away');  // Away

// Set custom status
await presence.setStatus('Reviewing PRs', ':eyes:', new Date(Date.now() + 3600000));

// Use preset statuses
await presence.setInMeeting(60);     // 60 minute meeting
await presence.setFocusing(120);     // 2 hour focus block
await presence.setLunching();        // Out for lunch
await presence.setOutOfOffice(new Date('2024-02-01'));

// Clear status
await presence.clearStatus();
```

### Search

```typescript
import { SlackSearchCapability } from '@wundr.io/slack-agent';
import { WebClient } from '@slack/web-api';

const client = new WebClient(process.env.SLACK_USER_TOKEN);
const search = new SlackSearchCapability(client);

// Search messages
const messages = await search.searchMessages('project deadline', {
  sort: 'timestamp',
  sortDir: 'desc',
  count: 20,
});

// Search with modifiers
const fromUser = await search.searchMessages('from:@john in:#engineering has:link');

// Search files
const files = await search.searchFiles('quarterly report', { count: 10 });

// Search users
const users = await search.searchUsers('john');
```

### Channel Management

```typescript
import { ChannelManager } from '@wundr.io/slack-agent';
import { WebClient } from '@slack/web-api';

const client = new WebClient(process.env.SLACK_BOT_TOKEN);
const channels = new ChannelManager(client);

// Create channels
const publicChannel = await channels.createChannel('project-updates', {
  topic: 'Project status updates',
  purpose: 'Share project updates and announcements',
  initialMembers: ['U123456', 'U789012'],
});

const privateChannel = await channels.createPrivateChannel('secret-project');

// Manage channels
await channels.setTopic('C123456', 'New topic');
await channels.archiveChannel('C123456');
await channels.renameChannel('C123456', 'new-name');

// List channels
const { channels: allChannels } = await channels.listChannels({
  memberOnly: true,
  namePattern: 'project-',
});
```

## Event Handling

The `SlackUserAgent` uses Socket Mode for real-time event handling:

```typescript
// Register event handlers
agent.onMessage(async (event) => {
  console.log(`Message from ${event.user}: ${event.text}`);
});

agent.onMention(async (event) => {
  console.log('Agent was mentioned!');
  await agent.sendMessage(event.channel!, 'You called?');
});

agent.onReactionAdded(async (event) => {
  console.log(`Reaction added: ${event.reaction}`);
});

agent.onReactionRemoved(async (event) => {
  console.log(`Reaction removed: ${event.reaction}`);
});

// Generic event handler
agent.onEvent('channel_created', async (event) => {
  console.log(`New channel created: ${event.channel}`);
});

// Available event types:
// - message, app_mention
// - reaction_added, reaction_removed
// - member_joined_channel, member_left_channel
// - channel_created, channel_deleted, channel_archive, channel_unarchive
// - user_change, team_join
// - file_shared, file_created, file_deleted
// - pin_added, pin_removed
// - star_added, star_removed
```

## Direct Capability Access

For advanced use cases, access capability modules directly:

```typescript
// Access raw capability modules
const rawReactions = agent.reactions;
const rawProfile = agent.profile;
const rawSearch = agent.search;
const rawPresence = agent.presence;
const rawChannels = agent.channels;
const rawMembership = agent.membership;
const rawDnd = agent.dnd;
const rawFiles = agent.files;
const rawThreading = agent.threading;
const rawMessages = agent.messages;
const rawReminders = agent.reminders;
const rawStars = agent.stars;
const rawProactive = agent.proactive;
const rawBookmarks = agent.bookmarks;
const rawUsergroups = agent.usergroups;

// Access underlying WebClients
const userClient = agent.userWebClient;
const botClient = agent.botWebClient;

// Use static constants
const thumbsUp = SlackUserAgent.Emojis.THUMBS_UP;
const inMeetingStatus = SlackUserAgent.StatusPresets.IN_MEETING;
```

## Health Checks

Monitor agent health:

```typescript
const health = await agent.healthCheck();

console.log(`Healthy: ${health.healthy}`);
console.log(`User client: ${health.userClientConnected}`);
console.log(`Bot client: ${health.botClientConnected}`);
console.log(`Socket Mode: ${health.socketModeConnected}`);
console.log(`User ID: ${health.userId}`);
console.log(`Team ID: ${health.teamId}`);

if (!health.healthy) {
  console.error('Errors:', health.errors);
}
```

## API Reference

### Main Exports

```typescript
// Primary class
export { SlackUserAgent } from '@wundr.io/slack-agent';

// Factory functions
export { createSlackUserAgent, createSlackUserAgentFromEnv } from '@wundr.io/slack-agent';

// Types
export type {
  VPIdentity,
  SlackUserAgentConfig,
  HealthCheckResult,
  SlackEventType,
  SlackEvent,
  EventHandler,
} from '@wundr.io/slack-agent';

// Individual capabilities
export { ProactiveMessenger, createProactiveMessenger } from '@wundr.io/slack-agent';
export { SlackFileOperations, createFileOperations } from '@wundr.io/slack-agent';
export { SlackReactions, CommonEmojis } from '@wundr.io/slack-agent';
export { ChannelManager } from '@wundr.io/slack-agent';
export { ChannelMembershipManager } from '@wundr.io/slack-agent';
export { PresenceStatusManager, PresetStatuses } from '@wundr.io/slack-agent';
export { ProfileManager } from '@wundr.io/slack-agent';
export { SlackSearchCapability } from '@wundr.io/slack-agent';
export { DndControlsManager } from '@wundr.io/slack-agent';
export { ReminderManager } from '@wundr.io/slack-agent';
export { StarredItemsManager } from '@wundr.io/slack-agent';
export { BookmarkManager } from '@wundr.io/slack-agent';
export { UsergroupManager } from '@wundr.io/slack-agent';
export { SlackThreadingCapability } from '@wundr.io/slack-agent';
export { SlackCanvasCapability } from '@wundr.io/slack-agent';
export { SlackWorkflowCapability } from '@wundr.io/slack-agent';
export { ScheduledMessagesManager } from '@wundr.io/slack-agent';
```

## Requirements

- **Node.js**: 18.0.0 or higher
- **Slack Workspace**: With appropriate admin permissions to install apps
- **Slack App**: Configured with required OAuth scopes

### Required OAuth Scopes

**User Token Scopes (xoxp-):**
- `users.profile:read`, `users.profile:write` - Profile management
- `users:read`, `users:write` - User operations
- `dnd:read`, `dnd:write` - Do Not Disturb
- `stars:read`, `stars:write` - Starred items
- `search:read` - Search functionality
- `reminders:read`, `reminders:write` - Reminders
- `reactions:read`, `reactions:write` - Reactions

**Bot Token Scopes (xoxb-):**
- `chat:write` - Send messages
- `channels:read`, `channels:write`, `channels:manage` - Channel operations
- `groups:read`, `groups:write` - Private channel operations
- `im:read`, `im:write` - Direct messages
- `mpim:read`, `mpim:write` - Group DMs
- `files:read`, `files:write` - File operations
- `users:read` - User information
- `usergroups:read`, `usergroups:write` - Usergroup management
- `bookmarks:read`, `bookmarks:write` - Bookmarks
- `pins:read`, `pins:write` - Pinned items

**App Token (xapp-):**
- Requires Socket Mode to be enabled in your Slack App settings

## Error Handling

Each capability module exports specific error classes:

```typescript
import {
  ProactiveMessagingError,
  ProactiveMessagingErrorCode,
  ChannelManagementError,
  PresenceStatusError,
  DndError,
  ReminderError,
} from '@wundr.io/slack-agent';

try {
  await agent.sendMessage('C123456', 'Hello!');
} catch (error) {
  if (error instanceof ProactiveMessagingError) {
    switch (error.code) {
      case ProactiveMessagingErrorCode.CHANNEL_NOT_FOUND:
        console.error('Channel does not exist');
        break;
      case ProactiveMessagingErrorCode.RATE_LIMITED:
        console.error('Rate limited, retry later');
        break;
      case ProactiveMessagingErrorCode.PERMISSION_DENIED:
        console.error('Missing required permissions');
        break;
    }
  }
}
```

## License

MIT
