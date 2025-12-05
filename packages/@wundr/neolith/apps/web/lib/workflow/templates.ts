/**
 * Workflow Templates Library
 *
 * Pre-built workflow templates for common automation scenarios.
 * Each template provides a ready-to-use workflow configuration that can be
 * customized by the user.
 */

import type {
  WorkflowTemplate,
  TriggerConfig,
  ActionConfig,
  WorkflowVariable,
} from '@/types/workflow';

/**
 * Template: New Member Onboarding
 *
 * Automatically welcomes new members, assigns roles, invites to channels,
 * and sends helpful resources when someone joins the workspace.
 */
export const NEW_MEMBER_ONBOARDING_TEMPLATE: WorkflowTemplate = {
  id: 'new-member-onboarding',
  name: 'New Member Onboarding',
  description:
    'Automatically welcome new members, assign roles, and invite them to key channels when they join the workspace.',
  category: 'onboarding',
  trigger: {
    type: 'user_join',
  } as TriggerConfig,
  actions: [
    {
      type: 'send_dm',
      order: 1,
      config: {
        userId: '{{trigger.user.id}}',
        message:
          "Welcome to {{workspace.name}}! 🎉\n\nWe're excited to have you here. I've added you to a few key channels to help you get started.\n\nIf you need any help, just mention me or reach out in #general!",
      },
    },
    {
      type: 'invite_to_channel',
      order: 2,
      config: {
        channelId: '{{channel.general}}',
        userId: '{{trigger.user.id}}',
      },
    },
    {
      type: 'invite_to_channel',
      order: 3,
      config: {
        channelId: '{{channel.announcements}}',
        userId: '{{trigger.user.id}}',
      },
    },
    {
      type: 'assign_role',
      order: 4,
      config: {
        roleId: '{{role.member}}',
        userId: '{{trigger.user.id}}',
      },
    },
    {
      type: 'send_message',
      order: 5,
      config: {
        channelId: '{{channel.general}}',
        message:
          'Please welcome {{trigger.user.name}} to the team! 👋\n\nFeel free to introduce yourself!',
      },
    },
  ] as Array<Omit<ActionConfig, 'id'>>,
  variables: [
    {
      name: 'channel.general',
      type: 'string',
      description: 'General discussion channel ID',
    },
    {
      name: 'channel.announcements',
      type: 'string',
      description: 'Announcements channel ID',
    },
    {
      name: 'role.member',
      type: 'string',
      description: 'Default member role ID',
    },
  ] as Array<Omit<WorkflowVariable, 'source'>>,
  usageCount: 1247,
  tags: ['onboarding', 'welcome', 'automation', 'member'],
};

/**
 * Template: Task Assignment and Escalation
 *
 * Routes task mentions to the right team, sets deadlines, and automatically
 * escalates if no response is received within a time window.
 */
export const TASK_ASSIGNMENT_TEMPLATE: WorkflowTemplate = {
  id: 'task-assignment-escalation',
  name: 'Task Assignment and Escalation',
  description:
    'Automatically assign tasks when mentioned, set reminders, and escalate to management if not completed within the deadline.',
  category: 'automation',
  trigger: {
    type: 'keyword',
    keyword: {
      keywords: ['@task', 'TODO:', 'ACTION:'],
      matchType: 'contains',
    },
  } as TriggerConfig,
  actions: [
    {
      type: 'add_reaction',
      order: 1,
      config: {
        emoji: '✅',
      },
    },
    {
      type: 'send_dm',
      order: 2,
      config: {
        userId: '{{assignee.id}}',
        message:
          'You\'ve been assigned a new task:\n\n"{{trigger.message.content}}"\n\nChannel: #{{trigger.channel.name}}\nDeadline: {{task.deadline}}\n\nPlease acknowledge by reacting to the message.',
      },
    },
    {
      type: 'wait',
      order: 3,
      config: {
        duration: 24,
        unit: 'hours',
      },
    },
    {
      type: 'condition',
      order: 4,
      config: {
        condition: {
          field: 'trigger.message.reactions',
          operator: 'contains',
          value: '{{assignee.id}}',
        },
        elseActions: ['escalate_to_manager'],
      },
    },
    {
      type: 'send_dm',
      order: 5,
      config: {
        userId: '{{manager.id}}',
        message:
          '⚠️ Task Escalation Alert\n\nThe following task has not been acknowledged after 24 hours:\n\n"{{trigger.message.content}}"\n\nAssigned to: {{assignee.name}}\nChannel: #{{trigger.channel.name}}',
      },
    },
  ] as Array<Omit<ActionConfig, 'id'>>,
  variables: [
    {
      name: 'assignee.id',
      type: 'string',
      description: 'User ID of the person to assign the task to',
    },
    {
      name: 'manager.id',
      type: 'string',
      description: 'User ID of the manager to escalate to',
    },
    {
      name: 'task.deadline',
      type: 'string',
      description: 'Task deadline (human-readable)',
      defaultValue: '3 days',
    },
  ] as Array<Omit<WorkflowVariable, 'source'>>,
  usageCount: 892,
  tags: ['tasks', 'escalation', 'management', 'automation'],
};

/**
 * Template: Channel Message Routing
 *
 * Intelligently routes messages from a public channel to specialized channels
 * based on keywords, mentions, or content analysis.
 */
export const CHANNEL_ROUTING_TEMPLATE: WorkflowTemplate = {
  id: 'channel-message-routing',
  name: 'Channel Message Routing',
  description:
    'Automatically route messages to specialized channels based on keywords, ensuring the right teams see relevant content.',
  category: 'automation',
  trigger: {
    type: 'message',
    message: {
      channelIds: ['{{source.channel}}'],
    },
  } as TriggerConfig,
  actions: [
    {
      type: 'condition',
      order: 1,
      config: {
        condition: {
          field: 'trigger.message.content',
          operator: 'contains',
          value: 'bug|error|issue',
        },
        thenActions: ['send_to_bugs'],
      },
    },
    {
      type: 'send_message',
      order: 2,
      config: {
        channelId: '{{channel.bugs}}',
        message:
          '🐛 Potential bug report from #{{trigger.channel.name}}:\n\n> {{trigger.message.content}}\n\nPosted by: {{trigger.user.name}}\n[View original message]({{trigger.message.url}})',
      },
    },
    {
      type: 'condition',
      order: 3,
      config: {
        condition: {
          field: 'trigger.message.content',
          operator: 'contains',
          value: 'feature|enhancement|suggestion',
        },
        thenActions: ['send_to_features'],
      },
    },
    {
      type: 'send_message',
      order: 4,
      config: {
        channelId: '{{channel.features}}',
        message:
          '💡 Feature suggestion from #{{trigger.channel.name}}:\n\n> {{trigger.message.content}}\n\nSuggested by: {{trigger.user.name}}\n[View original message]({{trigger.message.url}})',
      },
    },
    {
      type: 'add_reaction',
      order: 5,
      config: {
        emoji: '📋',
      },
    },
  ] as Array<Omit<ActionConfig, 'id'>>,
  variables: [
    {
      name: 'source.channel',
      type: 'string',
      description: 'Source channel to monitor',
    },
    {
      name: 'channel.bugs',
      type: 'string',
      description: 'Bug tracking channel ID',
    },
    {
      name: 'channel.features',
      type: 'string',
      description: 'Feature requests channel ID',
    },
  ] as Array<Omit<WorkflowVariable, 'source'>>,
  usageCount: 634,
  tags: ['routing', 'organization', 'automation', 'channels'],
};

/**
 * Template: Scheduled Report Generation
 *
 * Generates and sends automated reports on a schedule (daily, weekly, monthly)
 * with key metrics and summaries.
 */
export const SCHEDULED_REPORT_TEMPLATE: WorkflowTemplate = {
  id: 'scheduled-report-generation',
  name: 'Scheduled Report Generation',
  description:
    'Automatically generate and send scheduled reports with key metrics, summaries, and insights to specified channels.',
  category: 'scheduling',
  trigger: {
    type: 'schedule',
    schedule: {
      cron: '0 9 * * 1',
      timezone: 'America/New_York',
    },
  } as TriggerConfig,
  actions: [
    {
      type: 'http_request',
      order: 1,
      config: {
        url: '{{api.endpoint}}/reports/weekly',
        method: 'GET',
        headers: {
          Authorization: 'Bearer {{api.token}}',
          'Content-Type': 'application/json',
        },
      },
      errorHandling: {
        onError: 'retry',
        retryCount: 3,
        retryDelay: 60000,
      },
    },
    {
      type: 'send_message',
      order: 2,
      config: {
        channelId: '{{channel.reports}}',
        message:
          '📊 Weekly Report - {{current.date}}\n\n**Key Metrics:**\n• Active Users: {{report.activeUsers}}\n• Messages Sent: {{report.messageCount}}\n• Tasks Completed: {{report.tasksCompleted}}\n• Response Time: {{report.avgResponseTime}}ms\n\n**Top Performers:**\n{{report.topPerformers}}\n\n**Action Items:**\n{{report.actionItems}}',
      },
    },
    {
      type: 'send_dm',
      order: 3,
      config: {
        userId: '{{manager.id}}',
        message:
          'Your weekly report has been generated and posted to #{{channel.reports.name}}.\n\nHighlights:\n• {{report.highlight1}}\n• {{report.highlight2}}\n• {{report.highlight3}}',
      },
    },
  ] as Array<Omit<ActionConfig, 'id'>>,
  variables: [
    {
      name: 'api.endpoint',
      type: 'string',
      description: 'API endpoint for report data',
    },
    {
      name: 'api.token',
      type: 'string',
      description: 'API authentication token',
    },
    {
      name: 'channel.reports',
      type: 'string',
      description: 'Channel to post reports',
    },
    {
      name: 'manager.id',
      type: 'string',
      description: 'Manager user ID to notify',
    },
  ] as Array<Omit<WorkflowVariable, 'source'>>,
  usageCount: 458,
  tags: ['reports', 'scheduling', 'metrics', 'analytics'],
};

/**
 * Template: Orchestrator Handoff
 *
 * Detects when a message requires AI assistance and hands off to an
 * Orchestrator agent for intelligent response.
 */
export const ORCHESTRATOR_HANDOFF_TEMPLATE: WorkflowTemplate = {
  id: 'orchestrator-handoff',
  name: 'Orchestrator Handoff',
  description:
    'Automatically detect when messages need AI assistance and hand off to an Orchestrator agent for intelligent responses.',
  category: 'automation',
  trigger: {
    type: 'mention',
    mention: {
      orchestratorIds: ['{{orchestrator.id}}'],
    },
  } as TriggerConfig,
  actions: [
    {
      type: 'add_reaction',
      order: 1,
      config: {
        emoji: '🤖',
      },
    },
    {
      type: 'notify_orchestrator',
      order: 2,
      config: {
        orchestratorId: '{{orchestrator.id}}',
        message:
          'User {{trigger.user.name}} needs assistance in #{{trigger.channel.name}}:\n\n{{trigger.message.content}}\n\nContext: {{trigger.message.thread}}',
      },
      errorHandling: {
        onError: 'continue',
      },
    },
    {
      type: 'condition',
      order: 3,
      config: {
        condition: {
          field: 'orchestrator.response.status',
          operator: 'equals',
          value: 'failed',
        },
        thenActions: ['fallback_message'],
      },
    },
    {
      type: 'send_message',
      order: 4,
      config: {
        channelId: '{{trigger.channel.id}}',
        message:
          "I'm currently unavailable, but I've logged your request. A team member will follow up shortly.",
      },
    },
  ] as Array<Omit<ActionConfig, 'id'>>,
  variables: [
    {
      name: 'orchestrator.id',
      type: 'string',
      description: 'Orchestrator agent ID to hand off to',
    },
  ] as Array<Omit<WorkflowVariable, 'source'>>,
  usageCount: 1823,
  tags: ['orchestrator', 'ai', 'handoff', 'automation'],
};

/**
 * Template: Approval Workflow
 *
 * Creates a multi-step approval process with notifications, timeouts,
 * and automatic status tracking.
 */
export const APPROVAL_WORKFLOW_TEMPLATE: WorkflowTemplate = {
  id: 'approval-workflow',
  name: 'Approval Workflow',
  description:
    'Multi-step approval process with notifications, deadlines, and automatic status tracking for requests.',
  category: 'automation',
  trigger: {
    type: 'keyword',
    keyword: {
      keywords: ['APPROVAL_REQUEST:', '@approve'],
      matchType: 'contains',
    },
  } as TriggerConfig,
  actions: [
    {
      type: 'add_reaction',
      order: 1,
      config: {
        emoji: '⏳',
      },
    },
    {
      type: 'create_channel',
      order: 2,
      config: {
        channelName: 'approval-{{trigger.message.id}}',
        channelType: 'private',
      },
    },
    {
      type: 'invite_to_channel',
      order: 3,
      config: {
        channelId: '{{created.channel.id}}',
        userId: '{{trigger.user.id}}',
      },
    },
    {
      type: 'invite_to_channel',
      order: 4,
      config: {
        channelId: '{{created.channel.id}}',
        userId: '{{approver.id}}',
      },
    },
    {
      type: 'send_message',
      order: 5,
      config: {
        channelId: '{{created.channel.id}}',
        message:
          '📋 **Approval Request**\n\nRequested by: {{trigger.user.name}}\nRequest: {{trigger.message.content}}\n\n{{approver.name}}, please review and respond with:\n• ✅ to approve\n• ❌ to reject\n• 💬 to request more information',
      },
    },
    {
      type: 'send_dm',
      order: 6,
      config: {
        userId: '{{approver.id}}',
        message:
          '🔔 New approval request from {{trigger.user.name}}\n\nPlease review in #approval-{{trigger.message.id}}\n\nDeadline: {{approval.deadline}}',
      },
    },
    {
      type: 'wait',
      order: 7,
      config: {
        duration: 48,
        unit: 'hours',
      },
    },
    {
      type: 'condition',
      order: 8,
      config: {
        condition: {
          field: 'approval.status',
          operator: 'equals',
          value: 'pending',
        },
        thenActions: ['send_reminder'],
      },
    },
    {
      type: 'send_dm',
      order: 9,
      config: {
        userId: '{{approver.id}}',
        message:
          '⚠️ Reminder: Approval request from {{trigger.user.name}} is still pending.\n\nPlease review in #approval-{{trigger.message.id}}',
      },
    },
  ] as Array<Omit<ActionConfig, 'id'>>,
  variables: [
    {
      name: 'approver.id',
      type: 'string',
      description: 'User ID of the approver',
    },
    {
      name: 'approval.deadline',
      type: 'string',
      description: 'Approval deadline (human-readable)',
      defaultValue: '48 hours',
    },
  ] as Array<Omit<WorkflowVariable, 'source'>>,
  usageCount: 721,
  tags: ['approval', 'workflow', 'automation', 'governance'],
};

/**
 * All available workflow templates
 */
export const WORKFLOW_TEMPLATES: readonly WorkflowTemplate[] = [
  NEW_MEMBER_ONBOARDING_TEMPLATE,
  TASK_ASSIGNMENT_TEMPLATE,
  CHANNEL_ROUTING_TEMPLATE,
  SCHEDULED_REPORT_TEMPLATE,
  ORCHESTRATOR_HANDOFF_TEMPLATE,
  APPROVAL_WORKFLOW_TEMPLATE,
] as const;

/**
 * Get a template by ID
 */
export function getTemplateById(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find(template => template.id === id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(
  category: WorkflowTemplate['category']
): readonly WorkflowTemplate[] {
  return WORKFLOW_TEMPLATES.filter(template => template.category === category);
}

/**
 * Search templates by name, description, or tags
 */
export function searchTemplates(query: string): readonly WorkflowTemplate[] {
  const lowerQuery = query.toLowerCase();
  return WORKFLOW_TEMPLATES.filter(
    template =>
      template.name.toLowerCase().includes(lowerQuery) ||
      template.description.toLowerCase().includes(lowerQuery) ||
      template.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Get most popular templates (sorted by usage count)
 */
export function getPopularTemplates(
  limit: number = 3
): readonly WorkflowTemplate[] {
  return [...WORKFLOW_TEMPLATES]
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, limit);
}

/**
 * Get templates grouped by category
 */
export function getTemplatesByCategories(): Record<
  WorkflowTemplate['category'],
  WorkflowTemplate[]
> {
  return WORKFLOW_TEMPLATES.reduce(
    (acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = [];
      }
      acc[template.category].push(template);
      return acc;
    },
    {} as Record<WorkflowTemplate['category'], WorkflowTemplate[]>
  );
}
