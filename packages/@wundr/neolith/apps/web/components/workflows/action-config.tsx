'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';
import type { ActionConfig, ActionType, WorkflowVariable } from '@/types/workflow';
import { ACTION_TYPE_CONFIG, DEFAULT_ACTION_CONFIGS } from '@/types/workflow';

export interface ActionConfigPanelProps {
  action: ActionConfig;
  onChange: (updates: Partial<ActionConfig>) => void;
  availableVariables: WorkflowVariable[];
  onClose: () => void;
  className?: string;
}

export function ActionConfigPanel({
  action,
  onChange,
  availableVariables,
  onClose,
  className,
}: ActionConfigPanelProps) {
  const [showVariables, setShowVariables] = useState(false);

  const handleTypeChange = (type: ActionType) => {
    // Use default config for the selected action type
    const defaultConfig = DEFAULT_ACTION_CONFIGS[type] || {};
    onChange({ type, config: defaultConfig });
  };

  const handleConfigChange = (updates: Partial<ActionConfig['config']>) => {
    onChange({ config: { ...action.config, ...updates } });
  };

  const handleErrorHandlingChange = (updates: Partial<NonNullable<ActionConfig['errorHandling']>>) => {
    onChange({
      errorHandling: {
        onError: action.errorHandling?.onError || 'stop',
        ...action.errorHandling,
        ...updates,
      },
    });
  };

  const insertVariable = (variableName: string) => {
    const textToCopy = `{{${variableName}}}`;
    navigator.clipboard.writeText(textToCopy);
    setShowVariables(false);
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Configure Action</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Close panel"
        >
          <XIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Action Type Selector */}
      <div>
        <label className="mb-2 block text-sm font-medium text-foreground">
          Action Type
        </label>
        <select
          value={action.type}
          onChange={(e) => handleTypeChange(e.target.value as ActionType)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {(Object.keys(ACTION_TYPE_CONFIG) as ActionType[]).map((type) => (
            <option key={type} value={type}>
              {ACTION_TYPE_CONFIG[type].label}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {ACTION_TYPE_CONFIG[action.type].description}
        </p>
      </div>

      {/* Variable Helper */}
      <div>
        <button
          type="button"
          onClick={() => setShowVariables(!showVariables)}
          className="flex w-full items-center justify-between rounded-md border border-dashed border-primary/50 bg-primary/5 p-3 text-sm text-primary hover:bg-primary/10"
        >
          <span className="flex items-center gap-2">
            <VariableIcon className="h-4 w-4" />
            Insert Variable
          </span>
          <ChevronIcon className={cn('h-4 w-4 transition-transform', showVariables && 'rotate-180')} />
        </button>
        {showVariables && availableVariables.length > 0 && (
          <div className="mt-2 max-h-40 overflow-auto rounded-md border bg-background p-2">
            {availableVariables.map((variable) => (
              <button
                key={variable.name}
                type="button"
                onClick={() => insertVariable(variable.name)}
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <span className="font-mono text-xs">{`{{${variable.name}}}`}</span>
                <span className="text-xs text-muted-foreground">{variable.type}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Type-specific Configuration */}
      <div className="space-y-4">
        {(action.type === 'send_message' || action.type === 'send_dm') && (
          <MessageActionConfig
            config={action.config}
            onChange={handleConfigChange}
            isDM={action.type === 'send_dm'}
          />
        )}

        {action.type === 'create_channel' && (
          <CreateChannelConfig
            config={action.config}
            onChange={handleConfigChange}
          />
        )}

        {action.type === 'invite_to_channel' && (
          <InviteToChannelConfig
            config={action.config}
            onChange={handleConfigChange}
          />
        )}

        {action.type === 'assign_role' && (
          <AssignRoleConfig
            config={action.config}
            onChange={handleConfigChange}
          />
        )}

        {action.type === 'add_reaction' && (
          <AddReactionConfig
            config={action.config}
            onChange={handleConfigChange}
          />
        )}

        {action.type === 'http_request' && (
          <HttpRequestConfig
            config={action.config}
            onChange={handleConfigChange}
          />
        )}

        {action.type === 'wait' && (
          <WaitConfig
            config={action.config}
            onChange={handleConfigChange}
          />
        )}

        {action.type === 'condition' && (
          <ConditionConfig
            config={action.config}
            onChange={handleConfigChange}
          />
        )}

        {action.type === 'notify_orchestrator' && (
          <NotifyOrchestratorConfig
            config={action.config}
            onChange={handleConfigChange}
          />
        )}
      </div>

      {/* Error Handling */}
      <div className="border-t pt-4">
        <h4 className="mb-3 text-sm font-medium text-foreground">Error Handling</h4>
        <div className="space-y-3">
          <div>
            <label htmlFor="error-behavior" className="mb-1.5 block text-sm text-muted-foreground">
              On Error
            </label>
            <select
              id="error-behavior"
              value={action.errorHandling?.onError || 'stop'}
              onChange={(e) =>
                handleErrorHandlingChange({
                  onError: e.target.value as 'stop' | 'continue' | 'retry',
                })
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="stop">Stop workflow</option>
              <option value="continue">Continue to next action</option>
              <option value="retry">Retry action</option>
            </select>
          </div>

          {action.errorHandling?.onError === 'retry' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="retry-count" className="mb-1.5 block text-sm text-muted-foreground">
                  Retry Count
                </label>
                <input
                  id="retry-count"
                  type="number"
                  min="1"
                  max="10"
                  value={action.errorHandling?.retryCount || 3}
                  onChange={(e) =>
                    handleErrorHandlingChange({ retryCount: parseInt(e.target.value) })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label htmlFor="retry-delay" className="mb-1.5 block text-sm text-muted-foreground">
                  Retry Delay (ms)
                </label>
                <input
                  id="retry-delay"
                  type="number"
                  min="100"
                  step="100"
                  value={action.errorHandling?.retryDelay || 1000}
                  onChange={(e) =>
                    handleErrorHandlingChange({ retryDelay: parseInt(e.target.value) })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Message Action Configuration
interface MessageActionConfigProps {
  config: ActionConfig['config'];
  onChange: (updates: Partial<ActionConfig['config']>) => void;
  isDM: boolean;
}

function MessageActionConfig({ config, onChange, isDM }: MessageActionConfigProps) {
  return (
    <div className="space-y-4">
      {isDM ? (
        <div>
          <label htmlFor="user-id" className="mb-1.5 block text-sm font-medium text-foreground">
            User ID
          </label>
          <input
            id="user-id"
            type="text"
            value={config.userId || ''}
            onChange={(e) => onChange({ userId: e.target.value })}
            placeholder="Enter user ID or use {{trigger.user.id}}"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      ) : (
        <div>
          <label htmlFor="channel-id" className="mb-1.5 block text-sm font-medium text-foreground">
            Channel ID
          </label>
          <input
            id="channel-id"
            type="text"
            value={config.channelId || ''}
            onChange={(e) => onChange({ channelId: e.target.value })}
            placeholder="Enter channel ID or use {{trigger.channel.id}}"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      )}

      <div>
        <label htmlFor="message" className="mb-1.5 block text-sm font-medium text-foreground">
          Message
        </label>
        <textarea
          id="message"
          value={config.message || ''}
          onChange={(e) => onChange({ message: e.target.value })}
          placeholder="Enter your message. Use {{variable}} to insert dynamic content."
          rows={4}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Supports Markdown formatting and variable interpolation.
        </p>
      </div>
    </div>
  );
}

// Create Channel Configuration
interface CreateChannelConfigProps {
  config: ActionConfig['config'];
  onChange: (updates: Partial<ActionConfig['config']>) => void;
}

function CreateChannelConfig({ config, onChange }: CreateChannelConfigProps) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="channel-name" className="mb-1.5 block text-sm font-medium text-foreground">
          Channel Name
        </label>
        <input
          id="channel-name"
          type="text"
          value={config.channelName || ''}
          onChange={(e) => onChange({ channelName: e.target.value })}
          placeholder="Enter channel name"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div>
        <label htmlFor="channel-type" className="mb-1.5 block text-sm font-medium text-foreground">
          Channel Type
        </label>
        <select
          id="channel-type"
          value={config.channelType || 'public'}
          onChange={(e) => onChange({ channelType: e.target.value as 'public' | 'private' })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>
      </div>
    </div>
  );
}

// Invite to Channel Configuration
interface InviteToChannelConfigProps {
  config: ActionConfig['config'];
  onChange: (updates: Partial<ActionConfig['config']>) => void;
}

function InviteToChannelConfig({ config, onChange }: InviteToChannelConfigProps) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="invite-channel-id" className="mb-1.5 block text-sm font-medium text-foreground">
          Channel ID
        </label>
        <input
          id="invite-channel-id"
          type="text"
          value={config.channelId || ''}
          onChange={(e) => onChange({ channelId: e.target.value })}
          placeholder="Enter channel ID"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div>
        <label htmlFor="invite-user-id" className="mb-1.5 block text-sm font-medium text-foreground">
          User ID
        </label>
        <input
          id="invite-user-id"
          type="text"
          value={config.userId || ''}
          onChange={(e) => onChange({ userId: e.target.value })}
          placeholder="Enter user ID or use {{trigger.user.id}}"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    </div>
  );
}

// Assign Role Configuration
interface AssignRoleConfigProps {
  config: ActionConfig['config'];
  onChange: (updates: Partial<ActionConfig['config']>) => void;
}

function AssignRoleConfig({ config, onChange }: AssignRoleConfigProps) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="role-id" className="mb-1.5 block text-sm font-medium text-foreground">
          Role ID
        </label>
        <input
          id="role-id"
          type="text"
          value={config.roleId || ''}
          onChange={(e) => onChange({ roleId: e.target.value })}
          placeholder="Enter role ID"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div>
        <label htmlFor="role-user-id" className="mb-1.5 block text-sm font-medium text-foreground">
          User ID
        </label>
        <input
          id="role-user-id"
          type="text"
          value={config.userId || ''}
          onChange={(e) => onChange({ userId: e.target.value })}
          placeholder="Enter user ID or use {{trigger.user.id}}"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    </div>
  );
}

// Add Reaction Configuration
interface AddReactionConfigProps {
  config: ActionConfig['config'];
  onChange: (updates: Partial<ActionConfig['config']>) => void;
}

function AddReactionConfig({ config, onChange }: AddReactionConfigProps) {
  return (
    <div>
      <label htmlFor="emoji" className="mb-1.5 block text-sm font-medium text-foreground">
        Emoji
      </label>
      <input
        id="emoji"
        type="text"
        value={config.emoji || ''}
        onChange={(e) => onChange({ emoji: e.target.value })}
        placeholder="Enter emoji (e.g., :thumbsup: or actual emoji)"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}

// HTTP Request Configuration
interface HttpRequestConfigProps {
  config: ActionConfig['config'];
  onChange: (updates: Partial<ActionConfig['config']>) => void;
}

function HttpRequestConfig({ config, onChange }: HttpRequestConfigProps) {
  const [headersText, setHeadersText] = useState(
    config.headers ? JSON.stringify(config.headers, null, 2) : '{}',
  );

  const handleHeadersChange = (text: string) => {
    setHeadersText(text);
    try {
      const headers = JSON.parse(text);
      onChange({ headers });
    } catch {
      // Invalid JSON, don't update
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="http-method" className="mb-1.5 block text-sm font-medium text-foreground">
            Method
          </label>
          <select
            id="http-method"
            value={config.method || 'POST'}
            onChange={(e) =>
              onChange({ method: e.target.value as 'GET' | 'POST' | 'PUT' | 'DELETE' })
            }
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>

        <div>
          <label htmlFor="http-url" className="mb-1.5 block text-sm font-medium text-foreground">
            URL
          </label>
          <input
            id="http-url"
            type="text"
            value={config.url || ''}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="https://api.example.com/webhook"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div>
        <label htmlFor="http-headers" className="mb-1.5 block text-sm font-medium text-foreground">
          Headers (JSON)
        </label>
        <textarea
          id="http-headers"
          value={headersText}
          onChange={(e) => handleHeadersChange(e.target.value)}
          placeholder='{"Content-Type": "application/json"}'
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {config.method !== 'GET' && (
        <div>
          <label htmlFor="http-body" className="mb-1.5 block text-sm font-medium text-foreground">
            Body
          </label>
          <textarea
            id="http-body"
            value={config.body || ''}
            onChange={(e) => onChange({ body: e.target.value })}
            placeholder='{"key": "{{trigger.message.content}}"}'
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      )}
    </div>
  );
}

// Wait Configuration
interface WaitConfigProps {
  config: ActionConfig['config'];
  onChange: (updates: Partial<ActionConfig['config']>) => void;
}

function WaitConfig({ config, onChange }: WaitConfigProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="wait-duration" className="mb-1.5 block text-sm font-medium text-foreground">
          Duration
        </label>
        <input
          id="wait-duration"
          type="number"
          min="1"
          value={config.duration || 1}
          onChange={(e) => onChange({ duration: parseInt(e.target.value) })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div>
        <label htmlFor="wait-unit" className="mb-1.5 block text-sm font-medium text-foreground">
          Unit
        </label>
        <select
          id="wait-unit"
          value={config.unit || 'seconds'}
          onChange={(e) =>
            onChange({ unit: e.target.value as 'seconds' | 'minutes' | 'hours' | 'days' })
          }
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="seconds">Seconds</option>
          <option value="minutes">Minutes</option>
          <option value="hours">Hours</option>
          <option value="days">Days</option>
        </select>
      </div>
    </div>
  );
}

// Condition Configuration
interface ConditionConfigProps {
  config: ActionConfig['config'];
  onChange: (updates: Partial<ActionConfig['config']>) => void;
}

function ConditionConfig({ config, onChange }: ConditionConfigProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-md bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
        Conditional actions allow branching based on variable values.
      </div>

      <div>
        <label htmlFor="condition-field" className="mb-1.5 block text-sm font-medium text-foreground">
          Field
        </label>
        <input
          id="condition-field"
          type="text"
          value={config.condition?.field || ''}
          onChange={(e) =>
            onChange({
              condition: {
                ...config.condition,
                field: e.target.value,
                operator: config.condition?.operator || 'equals',
                value: config.condition?.value || '',
              },
            })
          }
          placeholder="e.g., trigger.message.content"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div>
        <label htmlFor="condition-operator" className="mb-1.5 block text-sm font-medium text-foreground">
          Operator
        </label>
        <select
          id="condition-operator"
          value={config.condition?.operator || 'equals'}
          onChange={(e) =>
            onChange({
              condition: {
                ...config.condition,
                field: config.condition?.field || '',
                operator: e.target.value as 'equals' | 'contains' | 'greater_than' | 'less_than' | 'exists',
                value: config.condition?.value || '',
              },
            })
          }
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="equals">Equals</option>
          <option value="contains">Contains</option>
          <option value="greater_than">Greater than</option>
          <option value="less_than">Less than</option>
          <option value="exists">Exists</option>
        </select>
      </div>

      <div>
        <label htmlFor="condition-value" className="mb-1.5 block text-sm font-medium text-foreground">
          Value
        </label>
        <input
          id="condition-value"
          type="text"
          value={config.condition?.value || ''}
          onChange={(e) =>
            onChange({
              condition: {
                ...config.condition,
                field: config.condition?.field || '',
                operator: config.condition?.operator || 'equals',
                value: e.target.value,
              },
            })
          }
          placeholder="Value to compare"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    </div>
  );
}

// Notify Orchestrator Configuration
interface NotifyOrchestratorConfigProps {
  config: ActionConfig['config'];
  onChange: (updates: Partial<ActionConfig['config']>) => void;
}

function NotifyOrchestratorConfig({ config, onChange }: NotifyOrchestratorConfigProps) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="orchestrator-id" className="mb-1.5 block text-sm font-medium text-foreground">
          OrchestratorID
        </label>
        <input
          id="orchestrator-id"
          type="text"
          value={config.orchestratorId || ''}
          onChange={(e) => onChange({ orchestratorId: e.target.value })}
          placeholder="Enter OrchestratorID"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          The Orchestrator agent will be notified and can respond to the trigger.
        </p>
      </div>

      <div>
        <label htmlFor="orchestrator-message" className="mb-1.5 block text-sm font-medium text-foreground">
          Context Message (optional)
        </label>
        <textarea
          id="orchestrator-message"
          value={config.message || ''}
          onChange={(e) => onChange({ message: e.target.value })}
          placeholder="Additional context for the Orchestrator"
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    </div>
  );
}

// Icons
function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function VariableIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h3" />
      <path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" />
      <path d="M12 20v-8a2 2 0 0 1 2-2h0" />
      <path d="m6 10 6 6" />
      <path d="m12 10-6 6" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
