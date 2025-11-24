'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';
import { TRIGGER_TYPE_CONFIG } from '@/types/workflow';

import type { TriggerConfig, TriggerType } from '@/types/workflow';

export interface TriggerConfigPanelProps {
  trigger: TriggerConfig;
  onChange: (trigger: TriggerConfig) => void;
  className?: string;
}

export function TriggerConfigPanel({
  trigger,
  onChange,
  className,
}: TriggerConfigPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleTypeChange = (type: TriggerType) => {
    onChange({ type });
  };

  return (
    <div className={cn('rounded-lg border bg-card', className)}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-4"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
            <TriggerIcon type={trigger.type} className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-left">
            <p className="font-medium text-foreground">
              {TRIGGER_TYPE_CONFIG[trigger.type].label}
            </p>
            <p className="text-sm text-muted-foreground">
              {TRIGGER_TYPE_CONFIG[trigger.type].description}
            </p>
          </div>
        </div>
        <ChevronIcon
          className={cn(
            'h-5 w-5 text-muted-foreground transition-transform',
            isExpanded && 'rotate-180',
          )}
        />
      </button>

      {/* Configuration */}
      {isExpanded && (
        <div className="border-t p-4">
          {/* Trigger Type Selector */}
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-foreground">
              Trigger Type
            </label>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.keys(TRIGGER_TYPE_CONFIG) as TriggerType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleTypeChange(type)}
                  className={cn(
                    'flex items-center gap-2 rounded-md border p-3 text-left text-sm transition-colors',
                    trigger.type === type
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-accent',
                  )}
                >
                  <TriggerIcon type={type} className="h-4 w-4 shrink-0" />
                  <span className="truncate">{TRIGGER_TYPE_CONFIG[type].label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Type-specific Configuration */}
          {trigger.type === 'schedule' && (
            <ScheduleConfig
              schedule={trigger.schedule}
              onChange={(schedule) => onChange({ ...trigger, schedule })}
            />
          )}

          {trigger.type === 'message' && (
            <MessageConfig
              message={trigger.message}
              onChange={(message) => onChange({ ...trigger, message })}
            />
          )}

          {trigger.type === 'keyword' && (
            <KeywordConfig
              keyword={trigger.keyword}
              onChange={(keyword) => onChange({ ...trigger, keyword })}
            />
          )}

          {(trigger.type === 'channel_join' || trigger.type === 'channel_leave') && (
            <ChannelConfig
              channel={trigger.channel}
              onChange={(channel) => onChange({ ...trigger, channel })}
            />
          )}

          {trigger.type === 'reaction' && (
            <ReactionConfig
              reaction={trigger.reaction}
              onChange={(reaction) => onChange({ ...trigger, reaction })}
            />
          )}

          {trigger.type === 'mention' && (
            <MentionConfig
              mention={trigger.mention}
              onChange={(mention) => onChange({ ...trigger, mention })}
            />
          )}

          {trigger.type === 'webhook' && (
            <WebhookConfig
              webhook={trigger.webhook}
              onChange={(webhook) => onChange({ ...trigger, webhook })}
            />
          )}

          {trigger.type === 'user_join' && (
            <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
              This trigger fires when a new user joins the workspace. No additional configuration needed.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Schedule Configuration
interface ScheduleConfigProps {
  schedule?: TriggerConfig['schedule'];
  onChange: (schedule: TriggerConfig['schedule']) => void;
}

function ScheduleConfig({ schedule, onChange }: ScheduleConfigProps) {
  const [scheduleType, setScheduleType] = useState<'simple' | 'cron'>('simple');
  const [simpleConfig, setSimpleConfig] = useState({
    frequency: 'daily',
    time: '09:00',
    dayOfWeek: '1',
    dayOfMonth: '1',
  });

  const handleSimpleChange = (updates: Partial<typeof simpleConfig>) => {
    const newConfig = { ...simpleConfig, ...updates };
    setSimpleConfig(newConfig);

    // Convert to cron
    let cron = '';
    const [hours, minutes] = newConfig.time.split(':');
    switch (newConfig.frequency) {
      case 'hourly':
        cron = `${minutes} * * * *`;
        break;
      case 'daily':
        cron = `${minutes} ${hours} * * *`;
        break;
      case 'weekly':
        cron = `${minutes} ${hours} * * ${newConfig.dayOfWeek}`;
        break;
      case 'monthly':
        cron = `${minutes} ${hours} ${newConfig.dayOfMonth} * *`;
        break;
    }
    onChange({ cron, timezone: schedule?.timezone });
  };

  return (
    <div className="space-y-4">
      {/* Schedule Type Toggle */}
      <div className="flex rounded-md border border-input">
        <button
          type="button"
          onClick={() => setScheduleType('simple')}
          className={cn(
            'flex-1 px-3 py-2 text-sm font-medium transition-colors',
            scheduleType === 'simple'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent',
          )}
        >
          Simple
        </button>
        <button
          type="button"
          onClick={() => setScheduleType('cron')}
          className={cn(
            'flex-1 px-3 py-2 text-sm font-medium transition-colors',
            scheduleType === 'cron'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent',
          )}
        >
          Cron Expression
        </button>
      </div>

      {scheduleType === 'simple' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Frequency */}
          <div>
            <label htmlFor="frequency" className="mb-1.5 block text-sm font-medium text-foreground">
              Frequency
            </label>
            <select
              id="frequency"
              value={simpleConfig.frequency}
              onChange={(e) => handleSimpleChange({ frequency: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {/* Time */}
          <div>
            <label htmlFor="time" className="mb-1.5 block text-sm font-medium text-foreground">
              Time
            </label>
            <input
              id="time"
              type="time"
              value={simpleConfig.time}
              onChange={(e) => handleSimpleChange({ time: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Day of Week (for weekly) */}
          {simpleConfig.frequency === 'weekly' && (
            <div>
              <label htmlFor="dayOfWeek" className="mb-1.5 block text-sm font-medium text-foreground">
                Day of Week
              </label>
              <select
                id="dayOfWeek"
                value={simpleConfig.dayOfWeek}
                onChange={(e) => handleSimpleChange({ dayOfWeek: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="0">Sunday</option>
                <option value="1">Monday</option>
                <option value="2">Tuesday</option>
                <option value="3">Wednesday</option>
                <option value="4">Thursday</option>
                <option value="5">Friday</option>
                <option value="6">Saturday</option>
              </select>
            </div>
          )}

          {/* Day of Month (for monthly) */}
          {simpleConfig.frequency === 'monthly' && (
            <div>
              <label htmlFor="dayOfMonth" className="mb-1.5 block text-sm font-medium text-foreground">
                Day of Month
              </label>
              <select
                id="dayOfMonth"
                value={simpleConfig.dayOfMonth}
                onChange={(e) => handleSimpleChange({ dayOfMonth: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {Array.from({ length: 28 }, (_, i) => (
                  <option key={i + 1} value={String(i + 1)}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      ) : (
        <div>
          <label htmlFor="cron" className="mb-1.5 block text-sm font-medium text-foreground">
            Cron Expression
          </label>
          <input
            id="cron"
            type="text"
            value={schedule?.cron || ''}
            onChange={(e) => onChange({ ...schedule, cron: e.target.value })}
            placeholder="*/15 * * * *"
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Format: minute hour day month day-of-week (e.g., &quot;0 9 * * 1-5&quot; for weekdays at 9am)
          </p>
        </div>
      )}

      {/* Timezone */}
      <div>
        <label htmlFor="timezone" className="mb-1.5 block text-sm font-medium text-foreground">
          Timezone
        </label>
        <select
          id="timezone"
          value={schedule?.timezone || 'UTC'}
          onChange={(e) => onChange({ ...schedule, cron: schedule?.cron || '', timezone: e.target.value })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="UTC">UTC</option>
          <option value="America/New_York">Eastern Time</option>
          <option value="America/Chicago">Central Time</option>
          <option value="America/Denver">Mountain Time</option>
          <option value="America/Los_Angeles">Pacific Time</option>
          <option value="Europe/London">London</option>
          <option value="Europe/Paris">Paris</option>
          <option value="Asia/Tokyo">Tokyo</option>
          <option value="Asia/Singapore">Singapore</option>
          <option value="Australia/Sydney">Sydney</option>
        </select>
      </div>
    </div>
  );
}

// Message Configuration
interface MessageConfigProps {
  message?: TriggerConfig['message'];
  onChange: (message: TriggerConfig['message']) => void;
}

function MessageConfig({ message, onChange }: MessageConfigProps) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="message-pattern" className="mb-1.5 block text-sm font-medium text-foreground">
          Message Pattern (optional)
        </label>
        <input
          id="message-pattern"
          type="text"
          value={message?.pattern || ''}
          onChange={(e) => onChange({ ...message, pattern: e.target.value })}
          placeholder="e.g., /help or ^deploy.*"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Regex pattern to match messages. Leave empty to match all messages.
        </p>
      </div>

      <div>
        <label htmlFor="channel-ids" className="mb-1.5 block text-sm font-medium text-foreground">
          Specific Channels (optional)
        </label>
        <input
          id="channel-ids"
          type="text"
          value={message?.channelIds?.join(', ') || ''}
          onChange={(e) =>
            onChange({
              ...message,
              channelIds: e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="Channel IDs, comma-separated"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Leave empty to listen to all channels.
        </p>
      </div>
    </div>
  );
}

// Keyword Configuration
interface KeywordConfigProps {
  keyword?: TriggerConfig['keyword'];
  onChange: (keyword: TriggerConfig['keyword']) => void;
}

function KeywordConfig({ keyword, onChange }: KeywordConfigProps) {
  const [newKeyword, setNewKeyword] = useState('');

  const handleAddKeyword = () => {
    if (newKeyword.trim()) {
      const keywords = [...(keyword?.keywords || []), newKeyword.trim()];
      onChange({ ...keyword, keywords, matchType: keyword?.matchType || 'contains' });
      setNewKeyword('');
    }
  };

  const handleRemoveKeyword = (index: number) => {
    const keywords = [...(keyword?.keywords || [])];
    keywords.splice(index, 1);
    onChange({ ...keyword, keywords, matchType: keyword?.matchType || 'contains' });
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="match-type" className="mb-1.5 block text-sm font-medium text-foreground">
          Match Type
        </label>
        <select
          id="match-type"
          value={keyword?.matchType || 'contains'}
          onChange={(e) =>
            onChange({
              ...keyword,
              keywords: keyword?.keywords || [],
              matchType: e.target.value as 'exact' | 'contains' | 'regex',
            })
          }
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="exact">Exact Match</option>
          <option value="contains">Contains</option>
          <option value="regex">Regular Expression</option>
        </select>
      </div>

      <div>
        <label htmlFor="add-keyword" className="mb-1.5 block text-sm font-medium text-foreground">
          Keywords
        </label>
        <div className="flex gap-2">
          <input
            id="add-keyword"
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
            placeholder="Add a keyword"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="button"
            onClick={handleAddKeyword}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add
          </button>
        </div>
        {keyword?.keywords && keyword.keywords.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {keyword.keywords.map((kw, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-sm text-primary"
              >
                {kw}
                <button
                  type="button"
                  onClick={() => handleRemoveKeyword(index)}
                  className="ml-1 rounded-full p-0.5 hover:bg-primary/20"
                  aria-label={`Remove ${kw}`}
                >
                  <XIcon className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Channel Configuration
interface ChannelConfigProps {
  channel?: TriggerConfig['channel'];
  onChange: (channel: TriggerConfig['channel']) => void;
}

function ChannelConfig({ channel, onChange }: ChannelConfigProps) {
  return (
    <div>
      <label htmlFor="channel-filter" className="mb-1.5 block text-sm font-medium text-foreground">
        Specific Channels (optional)
      </label>
      <input
        id="channel-filter"
        type="text"
        value={channel?.channelIds?.join(', ') || ''}
        onChange={(e) =>
          onChange({
            channelIds: e.target.value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          })
        }
        placeholder="Channel IDs, comma-separated"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <p className="mt-1.5 text-xs text-muted-foreground">
        Leave empty to listen to all channels.
      </p>
    </div>
  );
}

// Reaction Configuration
interface ReactionConfigProps {
  reaction?: TriggerConfig['reaction'];
  onChange: (reaction: TriggerConfig['reaction']) => void;
}

function ReactionConfig({ reaction, onChange }: ReactionConfigProps) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="reaction-emoji" className="mb-1.5 block text-sm font-medium text-foreground">
          Specific Emoji (optional)
        </label>
        <input
          id="reaction-emoji"
          type="text"
          value={reaction?.emoji || ''}
          onChange={(e) => onChange({ ...reaction, emoji: e.target.value })}
          placeholder="e.g., :thumbsup: or the emoji character"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Leave empty to trigger on any reaction.
        </p>
      </div>

      <div>
        <label htmlFor="reaction-channels" className="mb-1.5 block text-sm font-medium text-foreground">
          Specific Channels (optional)
        </label>
        <input
          id="reaction-channels"
          type="text"
          value={reaction?.channelIds?.join(', ') || ''}
          onChange={(e) =>
            onChange({
              ...reaction,
              channelIds: e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="Channel IDs, comma-separated"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    </div>
  );
}

// Mention Configuration
interface MentionConfigProps {
  mention?: TriggerConfig['mention'];
  onChange: (mention: TriggerConfig['mention']) => void;
}

function MentionConfig({ mention, onChange }: MentionConfigProps) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="mention-users" className="mb-1.5 block text-sm font-medium text-foreground">
          Mentioned Users (optional)
        </label>
        <input
          id="mention-users"
          type="text"
          value={mention?.userIds?.join(', ') || ''}
          onChange={(e) =>
            onChange({
              ...mention,
              userIds: e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="User IDs, comma-separated"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Trigger when these users are mentioned. Leave empty for any mention.
        </p>
      </div>

      <div>
        <label htmlFor="mention-vps" className="mb-1.5 block text-sm font-medium text-foreground">
          Mentioned VPs (optional)
        </label>
        <input
          id="mention-vps"
          type="text"
          value={mention?.vpIds?.join(', ') || ''}
          onChange={(e) =>
            onChange({
              ...mention,
              vpIds: e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="VP IDs, comma-separated"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    </div>
  );
}

// Webhook Configuration
interface WebhookConfigProps {
  webhook?: TriggerConfig['webhook'];
  onChange: (webhook: TriggerConfig['webhook']) => void;
}

function WebhookConfig({ webhook, onChange }: WebhookConfigProps) {
  const webhookUrl = `https://api.genesis.app/webhooks/trigger/${webhook?.secret || 'YOUR_SECRET'}`;

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="webhook-secret" className="mb-1.5 block text-sm font-medium text-foreground">
          Webhook Secret
        </label>
        <input
          id="webhook-secret"
          type="text"
          value={webhook?.secret || ''}
          onChange={(e) => onChange({ secret: e.target.value })}
          placeholder="Enter a secret key"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="rounded-md bg-muted/50 p-4">
        <p className="mb-2 text-sm font-medium text-foreground">Webhook URL</p>
        <code className="block break-all rounded bg-background p-2 text-xs text-muted-foreground">
          {webhookUrl}
        </code>
        <p className="mt-2 text-xs text-muted-foreground">
          Send a POST request to this URL to trigger the workflow.
        </p>
      </div>
    </div>
  );
}

// Trigger Icon component
interface TriggerIconProps {
  type: TriggerType;
  className?: string;
}

function TriggerIcon({ type, className }: TriggerIconProps) {
  const icons: Record<TriggerType, React.ReactNode> = {
    schedule: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    message: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    keyword: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
        <path d="M7 7h.01" />
      </svg>
    ),
    channel_join: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" y1="8" x2="19" y2="14" />
        <line x1="22" y1="11" x2="16" y2="11" />
      </svg>
    ),
    channel_leave: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="22" y1="11" x2="16" y2="11" />
      </svg>
    ),
    user_join: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <polyline points="16 11 18 13 22 9" />
      </svg>
    ),
    reaction: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
      </svg>
    ),
    mention: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
      </svg>
    ),
    webhook: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
  };

  return <>{icons[type]}</>;
}

// Icons
function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
