/**
 * Natural Language Parser for Workflows
 *
 * Utilities for parsing natural language descriptions into workflow components.
 * Provides regex-based pattern matching for common workflow patterns.
 *
 * @module lib/workflow/natural-language-parser
 */

import type {
  TriggerConfig,
  ActionConfig,
  TriggerType,
  ActionType,
} from '@/types/workflow';

/**
 * Common workflow patterns
 */
export const TRIGGER_PATTERNS = {
  schedule: [
    /every (day|hour|week|month|minute)/i,
    /at (\d+:\d+|\d+ (am|pm))/i,
    /on (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
    /(daily|weekly|hourly|monthly)/i,
  ],
  message: [
    /when (a |someone )?message/i,
    /message (is )?(posted|sent|received)/i,
    /in (the )?(channel|#)/i,
  ],
  keyword: [
    /when (someone says|keyword|word|phrase)/i,
    /detect(s|ing)? (word|keyword|phrase)/i,
  ],
  channel_join: [
    /when (someone|user) join(s)? (a |the )?channel/i,
    /user join(s)? channel/i,
  ],
  channel_leave: [
    /when (someone|user) leave(s)? (a |the )?channel/i,
    /user leave(s)? channel/i,
  ],
  user_join: [
    /when (a )?new user join(s)?/i,
    /user join(s)? (the )?workspace/i,
    /new member/i,
  ],
  reaction: [
    /when (someone|user) react(s)?/i,
    /reaction (is )?added/i,
    /emoji (is )?added/i,
  ],
  mention: [/when (someone|user) mention(s)?/i, /@mention/i],
  webhook: [/webhook/i, /external (event|trigger)/i, /http (request|call)/i],
} as const;

export const ACTION_PATTERNS = {
  send_message: [
    /send (a )?message/i,
    /post (to|in) (channel|#)/i,
    /notify (the )?(channel|team)/i,
  ],
  send_dm: [
    /send (a )?(dm|direct message)/i,
    /message (the )?user/i,
    /notify (the )?user/i,
  ],
  create_channel: [
    /create (a )?channel/i,
    /new channel/i,
    /make (a )?channel/i,
  ],
  invite_to_channel: [/invite (to|into) channel/i, /add (user )?to channel/i],
  assign_role: [/assign (a )?role/i, /give (a )?role/i, /set role/i],
  add_reaction: [/add (a )?reaction/i, /react with/i, /add emoji/i],
  http_request: [
    /http (request|call)/i,
    /api (request|call)/i,
    /webhook/i,
    /external (service|api)/i,
  ],
  wait: [/wait/i, /delay/i, /pause/i, /sleep/i],
  condition: [/if/i, /when.*then/i, /check (if|whether)/i, /condition/i],
  notify_orchestrator: [
    /notify (the )?orchestrator/i,
    /alert (the )?agent/i,
    /trigger (the )?orchestrator/i,
  ],
} as const;

/**
 * Extract channel names/IDs from text
 */
export function extractChannels(text: string): string[] {
  const channelPattern = /#([a-z0-9_-]+)/gi;
  const matches = text.matchAll(channelPattern);
  return Array.from(matches, m => m[1]);
}

/**
 * Extract user mentions from text
 */
export function extractUsers(text: string): string[] {
  const userPattern = /@([a-z0-9_-]+)/gi;
  const matches = text.matchAll(userPattern);
  return Array.from(matches, m => m[1]);
}

/**
 * Extract keywords from text
 */
export function extractKeywords(text: string): string[] {
  const keywordPattern = /"([^"]+)"|'([^']+)'/g;
  const matches = text.matchAll(keywordPattern);
  return Array.from(matches, m => m[1] || m[2]);
}

/**
 * Extract time/schedule information
 */
export function extractSchedule(text: string): {
  cron?: string;
  description: string;
} | null {
  // Daily patterns
  if (/every day|daily/i.test(text)) {
    const timeMatch = text.match(/at (\d+):?(\d+)?/i);
    if (timeMatch) {
      const hour = timeMatch[1];
      const minute = timeMatch[2] || '0';
      return {
        cron: `${minute} ${hour} * * *`,
        description: `Daily at ${hour}:${minute.padStart(2, '0')}`,
      };
    }
    return {
      cron: '0 9 * * *',
      description: 'Daily at 9:00 AM',
    };
  }

  // Hourly patterns
  if (/every hour|hourly/i.test(text)) {
    return {
      cron: '0 * * * *',
      description: 'Every hour',
    };
  }

  // Weekly patterns
  const dayMatch = text.match(
    /on (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i
  );
  if (dayMatch || /every week|weekly/i.test(text)) {
    const dayMap: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };
    const day = dayMatch ? dayMap[dayMatch[1].toLowerCase()] : 1; // Default to Monday
    return {
      cron: `0 9 * * ${day}`,
      description: `Weekly on ${dayMatch?.[1] || 'Monday'} at 9:00 AM`,
    };
  }

  return null;
}

/**
 * Detect trigger type from natural language
 */
export function detectTriggerType(text: string): TriggerType | null {
  for (const [type, patterns] of Object.entries(TRIGGER_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return type as TriggerType;
      }
    }
  }
  return null;
}

/**
 * Detect action types from natural language
 */
export function detectActionTypes(text: string): ActionType[] {
  const actions: ActionType[] = [];

  for (const [type, patterns] of Object.entries(ACTION_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        actions.push(type as ActionType);
        break; // Only add each action type once
      }
    }
  }

  return actions;
}

/**
 * Parse natural language into trigger configuration
 */
export function parseTriggerFromText(
  text: string
): Partial<TriggerConfig> | null {
  const triggerType = detectTriggerType(text);
  if (!triggerType) {
    return null;
  }

  const config: Partial<TriggerConfig> = {
    type: triggerType,
  } as any;

  switch (triggerType) {
    case 'schedule': {
      const schedule = extractSchedule(text);
      if (schedule?.cron) {
        (config as any).schedule = {
          cron: schedule.cron,
        };
      }
      break;
    }

    case 'message': {
      const channels = extractChannels(text);
      if (channels.length > 0) {
        (config as any).message = {
          channelIds: channels,
        };
      }
      break;
    }

    case 'keyword': {
      const keywords = extractKeywords(text);
      if (keywords.length > 0) {
        (config as any).keyword = {
          keywords,
          matchType: 'contains' as const,
        };
      }
      break;
    }

    case 'channel_join':
    case 'channel_leave': {
      const channels = extractChannels(text);
      if (channels.length > 0) {
        (config as any).channel = {
          channelIds: channels,
        };
      }
      break;
    }

    case 'reaction': {
      const emojiMatch = text.match(/:[a-z0-9_]+:|[\u{1F300}-\u{1F9FF}]/u);
      if (emojiMatch) {
        (config as any).reaction = {
          emoji: emojiMatch[0],
        };
      }
      break;
    }

    case 'mention': {
      const users = extractUsers(text);
      if (users.length > 0) {
        (config as any).mention = {
          userIds: users,
        };
      }
      break;
    }
  }

  return config;
}

/**
 * Generate action configuration suggestions from text
 */
export function suggestActionsFromText(text: string): Array<{
  type: ActionType;
  suggestedConfig: Record<string, unknown>;
}> {
  const actionTypes = detectActionTypes(text);
  const suggestions: Array<{
    type: ActionType;
    suggestedConfig: Record<string, unknown>;
  }> = [];

  for (const actionType of actionTypes) {
    const config: Record<string, unknown> = {};

    switch (actionType) {
      case 'send_message': {
        const channels = extractChannels(text);
        if (channels.length > 0) {
          config.channelId = channels[0];
        }
        // Extract message content after "send message" or similar
        const messageMatch = text.match(
          /send message[: ]+"([^"]+)"|send message[: ]+'([^']+)'/i
        );
        if (messageMatch) {
          config.message = messageMatch[1] || messageMatch[2];
        }
        break;
      }

      case 'send_dm': {
        const users = extractUsers(text);
        if (users.length > 0) {
          config.userId = users[0];
        }
        break;
      }

      case 'create_channel': {
        const nameMatch = text.match(
          /channel (called|named) ["']?([a-z0-9_-]+)["']?/i
        );
        if (nameMatch) {
          config.channelName = nameMatch[2];
        }
        config.channelType = /private/i.test(text) ? 'private' : 'public';
        break;
      }

      case 'wait': {
        const durationMatch = text.match(/(\d+)\s*(second|minute|hour|day)s?/i);
        if (durationMatch) {
          config.duration = parseInt(durationMatch[1], 10);
          config.unit = durationMatch[2].toLowerCase();
        }
        break;
      }

      case 'add_reaction': {
        const emojiMatch = text.match(/:[a-z0-9_]+:|[\u{1F300}-\u{1F9FF}]/u);
        if (emojiMatch) {
          config.emoji = emojiMatch[0];
        }
        break;
      }

      case 'http_request': {
        const urlMatch = text.match(/https?:\/\/[^\s]+/i);
        if (urlMatch) {
          config.url = urlMatch[0];
        }
        config.method = /post/i.test(text) ? 'POST' : 'GET';
        break;
      }
    }

    suggestions.push({
      type: actionType,
      suggestedConfig: config,
    });
  }

  return suggestions;
}

/**
 * Extract workflow name from natural language
 */
export function suggestWorkflowName(text: string): string {
  // Try to extract from "called" or "named" patterns
  const namedMatch = text.match(/(?:called|named) ["']?([^"'\n]{3,50})["']?/i);
  if (namedMatch) {
    return namedMatch[1];
  }

  // Generate from trigger and action
  const trigger = detectTriggerType(text);
  const actions = detectActionTypes(text);

  if (trigger && actions.length > 0) {
    const triggerLabel = trigger.replace(/_/g, ' ');
    const actionLabel = actions[0].replace(/_/g, ' ');
    return `${triggerLabel} → ${actionLabel}`;
  }

  return 'New Workflow';
}

/**
 * Validate and score natural language description
 * Returns confidence score (0-1) and missing elements
 */
export function analyzeWorkflowDescription(text: string): {
  confidence: number;
  hasTrigger: boolean;
  hasActions: boolean;
  missingElements: string[];
  suggestions: string[];
} {
  const hasTrigger = detectTriggerType(text) !== null;
  const actions = detectActionTypes(text);
  const hasActions = actions.length > 0;

  const missingElements: string[] = [];
  const suggestions: string[] = [];

  if (!hasTrigger) {
    missingElements.push('trigger');
    suggestions.push(
      'Specify when the workflow should run (e.g., "when a message is posted", "every day at 9am")'
    );
  }

  if (!hasActions) {
    missingElements.push('actions');
    suggestions.push(
      'Describe what should happen (e.g., "send a message", "notify the user")'
    );
  }

  // Calculate confidence score
  let confidence = 0;
  if (hasTrigger) {
    confidence += 0.5;
  }
  if (hasActions) {
    confidence += 0.3;
  }
  if (actions.length > 1) {
    confidence += 0.1;
  } // Bonus for multiple actions
  if (extractChannels(text).length > 0 || extractUsers(text).length > 0) {
    confidence += 0.1; // Bonus for specific references
  }

  return {
    confidence: Math.min(confidence, 1),
    hasTrigger,
    hasActions,
    missingElements,
    suggestions,
  };
}
