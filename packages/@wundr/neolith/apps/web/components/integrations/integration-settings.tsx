'use client';

import { useState, useCallback } from 'react';

import { cn } from '@/lib/utils';
import { INTEGRATION_PROVIDERS, INTEGRATION_STATUS_CONFIG } from '@/types/integration';

import type { IntegrationConfig, WebhookEventType } from '@/types/integration';

/**
 * Props for the IntegrationSettings component
 */
export interface IntegrationSettingsProps {
  /** The integration configuration to edit */
  integration: IntegrationConfig;
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback to close the dialog */
  onClose: () => void;
  /** Callback fired when saving changes */
  onSave: (updates: Partial<IntegrationConfig>) => Promise<void>;
  /** Callback to disconnect the integration */
  onDisconnect: () => Promise<void>;
  /** Additional CSS class names */
  className?: string;
}

interface ChannelMapping {
  sourceId: string;
  sourceName: string;
  targetId: string;
  targetName: string;
}

export function IntegrationSettings({
  integration,
  isOpen,
  onClose,
  onSave,
  onDisconnect,
  className,
}: IntegrationSettingsProps) {
  const [name, setName] = useState(integration.name);
  const [description, setDescription] = useState(integration.description || '');
  const [channelMappings, setChannelMappings] = useState<ChannelMapping[]>(
    integration.config.channelMappings || [],
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    integration.config.notificationPreferences?.enabled ?? true,
  );
  const [selectedEvents, setSelectedEvents] = useState<WebhookEventType[]>(
    integration.config.notificationPreferences?.events || [],
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'channels' | 'notifications' | 'danger'>(
    'general',
  );

  const provider = INTEGRATION_PROVIDERS[integration.provider];
  const statusConfig = INTEGRATION_STATUS_CONFIG[integration.status];

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);

    try {
      await onSave({
        name,
        description: description || undefined,
        config: {
          ...integration.config,
          channelMappings,
          notificationPreferences: {
            enabled: notificationsEnabled,
            events: selectedEvents,
          },
        },
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  }, [
    name,
    description,
    channelMappings,
    notificationsEnabled,
    selectedEvents,
    integration.config,
    onSave,
    onClose,
  ]);

  const handleDisconnect = useCallback(async () => {
    setIsDisconnecting(true);
    setError(null);

    try {
      await onDisconnect();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect integration');
    } finally {
      setIsDisconnecting(false);
      setShowDisconnectConfirm(false);
    }
  }, [onDisconnect, onClose]);

  const handleEventToggle = useCallback((event: WebhookEventType) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }, []);

  const handleRemoveMapping = useCallback((index: number) => {
    setChannelMappings((prev) => prev.filter((_, i) => i !== index));
  }, []);

  if (!isOpen) {
return null;
}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={cn(
          'relative z-10 w-full max-w-2xl rounded-lg border bg-card shadow-xl',
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <ProviderIcon provider={integration.provider} className="h-10 w-10" />
            <div>
              <h2 id="settings-dialog-title" className="text-lg font-semibold text-foreground">
                {integration.name}
              </h2>
              <p className="text-sm text-muted-foreground">{provider.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
                statusConfig.bgColor,
                statusConfig.color,
              )}
            >
              {statusConfig.label}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Close"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-6">
          {(['general', 'channels', 'notifications', 'danger'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                'relative px-4 py-3 text-sm font-medium transition-colors',
                activeTab === tab
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
                tab === 'danger' && 'text-red-500 hover:text-red-600',
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="max-h-[50vh] overflow-y-auto p-6">
          {activeTab === 'general' && (
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label htmlFor="settings-name" className="block text-sm font-medium text-foreground">
                  Name
                </label>
                <input
                  id="settings-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="settings-description"
                  className="block text-sm font-medium text-foreground"
                >
                  Description
                </label>
                <textarea
                  id="settings-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Add a description for this integration..."
                />
              </div>

              {/* Integration Info */}
              <div className="rounded-lg bg-muted/50 p-4">
                <h4 className="text-sm font-medium text-foreground">Integration Details</h4>
                <dl className="mt-2 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Provider</dt>
                    <dd className="text-foreground">{provider.name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Created</dt>
                    <dd className="text-foreground">
                      {new Date(integration.createdAt).toLocaleDateString()}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Last Updated</dt>
                    <dd className="text-foreground">
                      {new Date(integration.updatedAt).toLocaleDateString()}
                    </dd>
                  </div>
                  {integration.lastSyncAt && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Last Synced</dt>
                      <dd className="text-foreground">
                        {new Date(integration.lastSyncAt).toLocaleString()}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          )}

          {activeTab === 'channels' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configure channel mappings between this integration and your workspace.
              </p>

              {channelMappings.length === 0 ? (
                <div className="rounded-lg border border-dashed py-8 text-center">
                  <ChannelIcon className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">No channel mappings configured</p>
                  <button
                    type="button"
                    className="mt-2 text-sm text-primary hover:underline"
                  >
                    Add channel mapping
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {channelMappings.map((mapping, index) => (
                    <div
                      key={`${mapping.sourceId}-${mapping.targetId}`}
                      className="flex items-center justify-between rounded-lg border bg-background p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-foreground">{mapping.sourceName}</span>
                        <ArrowRightIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-foreground">{mapping.targetName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveMapping(index)}
                        className="rounded p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                        aria-label="Remove mapping"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-4">
              {/* Enable/Disable */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-foreground">Enable Notifications</h4>
                  <p className="text-xs text-muted-foreground">
                    Receive notifications from this integration
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notificationsEnabled}
                  onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                  className={cn(
                    'relative h-6 w-11 rounded-full transition-colors',
                    notificationsEnabled ? 'bg-primary' : 'bg-muted',
                  )}
                >
                  <span
                    className={cn(
                      'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
                      notificationsEnabled && 'translate-x-5',
                    )}
                  />
                </button>
              </div>

              {/* Event Selection */}
              {notificationsEnabled && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-foreground">Events</h4>
                  <div className="space-y-2">
                    {([
                      { type: 'message.created' as const, label: 'New Messages' },
                      { type: 'message.updated' as const, label: 'Message Updates' },
                      { type: 'channel.created' as const, label: 'Channel Created' },
                      { type: 'member.joined' as const, label: 'Member Joined' },
                      { type: 'orchestrator.message' as const, label: 'Orchestrator Messages' },
                      { type: 'task.completed' as const, label: 'Task Completed' },
                      { type: 'workflow.triggered' as const, label: 'Workflow Triggered' },
                    ]).map(({ type, label }) => (
                      <label
                        key={type}
                        className="flex items-center gap-3 rounded-lg border bg-background p-3 cursor-pointer hover:bg-accent"
                      >
                        <input
                          type="checkbox"
                          checked={selectedEvents.includes(type)}
                          onChange={() => handleEventToggle(type)}
                          className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-foreground">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'danger' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
                <h4 className="text-sm font-medium text-red-600">Danger Zone</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Once you disconnect this integration, you will need to reconnect and reconfigure it.
                </p>
                {!showDisconnectConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowDisconnectConfirm(true)}
                    className="mt-4 rounded-md border border-red-500 bg-transparent px-4 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-500 hover:text-white"
                  >
                    Disconnect Integration
                  </button>
                ) : (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm font-medium text-red-600">
                      Are you sure you want to disconnect this integration?
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDisconnectConfirm(false)}
                        disabled={isDisconnecting}
                        className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleDisconnect}
                        disabled={isDisconnecting}
                        className="flex items-center gap-2 rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                      >
                        {isDisconnecting ? (
                          <>
                            <LoadingSpinner className="h-4 w-4" />
                            Disconnecting...
                          </>
                        ) : (
                          'Yes, Disconnect'
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 rounded-md bg-red-500/10 p-3 text-sm text-red-600">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <LoadingSpinner className="h-4 w-4" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ProviderIconProps {
  provider: string;
  className?: string;
}

function ProviderIcon({ provider, className }: ProviderIconProps) {
  const config = INTEGRATION_PROVIDERS[provider as keyof typeof INTEGRATION_PROVIDERS];

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-lg bg-primary/10 text-lg font-semibold text-primary',
        className,
      )}
    >
      {config?.icon || 'IN'}
    </div>
  );
}

// Icons
function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ChannelIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 9h16" />
      <path d="M4 15h16" />
      <path d="M10 3 8 21" />
      <path d="M16 3 14 21" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
