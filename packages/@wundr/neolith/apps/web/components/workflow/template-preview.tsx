'use client';

/**
 * Workflow Template Preview Component
 *
 * Displays a detailed preview of a workflow template showing the trigger,
 * actions, variables, and flow visualization.
 */

import {
  Clock,
  MessageSquare,
  Tag,
  UserPlus,
  UserMinus,
  UserCheck,
  Smile,
  AtSign,
  Link,
  Mail,
  PlusSquare,
  Shield,
  Globe,
  GitBranch,
  Bot,
  ArrowRight,
  Settings,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  TRIGGER_TYPE_CONFIG,
  ACTION_TYPE_CONFIG,
  TEMPLATE_CATEGORY_CONFIG,
} from '@/types/workflow';

import type { WorkflowTemplate, ActionConfig } from '@/types/workflow';

interface TemplatePreviewProps {
  template: WorkflowTemplate;
  className?: string;
}

/**
 * Icon mapping for trigger types
 */
const TriggerIcon = {
  schedule: Clock,
  message: MessageSquare,
  keyword: Tag,
  channel_join: UserPlus,
  channel_leave: UserMinus,
  user_join: UserCheck,
  reaction: Smile,
  mention: AtSign,
  webhook: Link,
} as const;

/**
 * Icon mapping for action types
 */
const ActionIcon = {
  send_message: MessageSquare,
  send_dm: Mail,
  create_channel: PlusSquare,
  invite_to_channel: UserPlus,
  assign_role: Shield,
  add_reaction: Smile,
  http_request: Globe,
  wait: Clock,
  condition: GitBranch,
  notify_orchestrator: Bot,
} as const;

export function TemplatePreview({ template, className }: TemplatePreviewProps) {
  const categoryConfig = TEMPLATE_CATEGORY_CONFIG[template.category];
  const triggerConfig = TRIGGER_TYPE_CONFIG[template.trigger.type];
  const TriggerIconComponent = TriggerIcon[template.trigger.type];

  return (
    <div className={className}>
      <div className="space-y-6">
        {/* Overview */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{categoryConfig.label}</Badge>
            <Badge variant="outline">
              {template.usageCount.toLocaleString()} uses
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1">
            {template.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        {/* Trigger */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <TriggerIconComponent className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Trigger</CardTitle>
                <CardDescription className="text-xs">
                  {triggerConfig.description}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge>{triggerConfig.label}</Badge>
              </div>
              <TriggerDetails trigger={template.trigger} />
            </div>
          </CardContent>
        </Card>

        {/* Actions Flow */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Actions ({template.actions.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Steps that will be executed when the workflow is triggered
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {template.actions.map((action, index) => (
                <div key={index} className="space-y-2">
                  <ActionPreview action={action} order={index + 1} />
                  {index < template.actions.length - 1 && (
                    <div className="flex justify-center">
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Variables */}
        {template.variables && template.variables.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <div>
                  <CardTitle className="text-base">
                    Variables ({template.variables.length})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Configuration values you'll need to provide
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {template.variables.map((variable) => (
                  <div
                    key={variable.name}
                    className="flex items-start justify-between rounded-lg border p-3"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono">
                          {variable.name}
                        </code>
                        <Badge variant="outline" className="text-xs">
                          {variable.type}
                        </Badge>
                      </div>
                      {variable.description && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {variable.description}
                        </p>
                      )}
                      {variable.defaultValue && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Default: <code>{String(variable.defaultValue)}</code>
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Usage Tips */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">How to use this template</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm">
              <li className="flex gap-2">
                <span className="font-semibold">1.</span>
                <span>
                  Click "Use This Template" to create a new workflow from this
                  template
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold">2.</span>
                <span>
                  Configure the required variables (marked in the workflow editor)
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold">3.</span>
                <span>Customize actions and trigger settings as needed</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold">4.</span>
                <span>Test your workflow before activating it</span>
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Action Preview Component
 */
interface ActionPreviewProps {
  action: Omit<ActionConfig, 'id'>;
  order: number;
}

function ActionPreview({ action, order }: ActionPreviewProps) {
  const actionConfig = ACTION_TYPE_CONFIG[action.type];
  const IconComponent = ActionIcon[action.type];

  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {order}
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <IconComponent className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">{actionConfig.label}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {actionConfig.description}
        </p>
        <ActionConfigPreview action={action} />
        {action.errorHandling && (
          <div className="mt-2 rounded border border-orange-200 bg-orange-50 p-2 dark:border-orange-900 dark:bg-orange-950/20">
            <p className="text-xs text-orange-700 dark:text-orange-400">
              Error handling:{' '}
              <span className="font-semibold">{action.errorHandling.onError}</span>
              {action.errorHandling.retryCount && (
                <span> • Retries: {action.errorHandling.retryCount}</span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Display trigger-specific details
 */
function TriggerDetails({ trigger }: { trigger: WorkflowTemplate['trigger'] }) {
  switch (trigger.type) {
    case 'schedule':
      return (
        <div className="rounded-lg bg-muted/50 p-3 text-xs">
          <div className="space-y-1">
            <div>
              <span className="font-semibold">Schedule:</span>{' '}
              <code>{trigger.schedule.cron}</code>
            </div>
            {trigger.schedule.timezone && (
              <div>
                <span className="font-semibold">Timezone:</span>{' '}
                {trigger.schedule.timezone}
              </div>
            )}
          </div>
        </div>
      );

    case 'keyword':
      return (
        <div className="rounded-lg bg-muted/50 p-3 text-xs">
          <div>
            <span className="font-semibold">Keywords:</span>{' '}
            {trigger.keyword.keywords.join(', ')}
          </div>
          <div>
            <span className="font-semibold">Match type:</span>{' '}
            {trigger.keyword.matchType}
          </div>
        </div>
      );

    case 'message':
      return (
        <div className="rounded-lg bg-muted/50 p-3 text-xs">
          <div>Triggers when a message is posted</div>
          {trigger.message.channelIds && (
            <div className="mt-1">
              <span className="font-semibold">Channels:</span> Specific channels
              configured
            </div>
          )}
        </div>
      );

    case 'mention':
      return (
        <div className="rounded-lg bg-muted/50 p-3 text-xs">
          <div>Triggers when mentioned in a message</div>
        </div>
      );

    default:
      return (
        <div className="rounded-lg bg-muted/50 p-3 text-xs">
          <div>Configured when workflow is created</div>
        </div>
      );
  }
}

/**
 * Display action-specific configuration
 */
function ActionConfigPreview({ action }: { action: Omit<ActionConfig, 'id'> }) {
  const config = action.config as Record<string, unknown>;

  return (
    <div className="space-y-1 rounded-lg bg-muted/30 p-2 text-xs font-mono">
      {Object.entries(config).map(([key, value]) => {
        // Handle nested objects
        if (typeof value === 'object' && value !== null) {
          return (
            <div key={key} className="space-y-1">
              <div className="font-semibold text-muted-foreground">{key}:</div>
              <div className="ml-2 space-y-1">
                {Object.entries(value as Record<string, unknown>).map(
                  ([nestedKey, nestedValue]) => (
                    <div key={nestedKey}>
                      <span className="text-muted-foreground">{nestedKey}:</span>{' '}
                      {formatValue(nestedValue)}
                    </div>
                  ),
                )}
              </div>
            </div>
          );
        }

        return (
          <div key={key}>
            <span className="text-muted-foreground">{key}:</span>{' '}
            {formatValue(value)}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
  if (typeof value === 'string') {
    // Truncate long strings
    if (value.length > 100) {
      return `"${value.substring(0, 100)}..."`;
    }
    return `"${value}"`;
  }
  if (Array.isArray(value)) {
    return `[${value.join(', ')}]`;
  }
  return String(value);
}
