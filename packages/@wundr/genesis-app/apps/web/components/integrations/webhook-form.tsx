'use client';

import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { Webhook, WebhookEventType } from '@/types/integration';
import { WEBHOOK_EVENTS } from '@/types/integration';

export interface WebhookFormProps {
  webhook?: Webhook | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: WebhookFormData) => Promise<void>;
  className?: string;
}

export interface WebhookFormData {
  name: string;
  url: string;
  events: WebhookEventType[];
  headers: Array<{ key: string; value: string }>;
  retryPolicy: {
    maxRetries: number;
    retryDelay: number;
    exponentialBackoff: boolean;
  };
}

const DEFAULT_RETRY_POLICY = {
  maxRetries: 3,
  retryDelay: 1000,
  exponentialBackoff: true,
};

export function WebhookForm({
  webhook,
  isOpen,
  onClose,
  onSubmit,
  className,
}: WebhookFormProps) {
  const isEditing = !!webhook;

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<WebhookEventType[]>([]);
  const [headers, setHeaders] = useState<Array<{ key: string; value: string }>>([]);
  const [retryPolicy, setRetryPolicy] = useState(DEFAULT_RETRY_POLICY);
  const [showSecret, setShowSecret] = useState(false);
  const [generatedSecret, setGeneratedSecret] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when webhook changes
  useEffect(() => {
    if (webhook) {
      setName(webhook.name);
      setUrl(webhook.url);
      setEvents(webhook.events);
      setHeaders(
        webhook.headers
          ? Object.entries(webhook.headers).map(([key, value]) => ({ key, value }))
          : [],
      );
      setRetryPolicy(webhook.retryPolicy);
      setGeneratedSecret('');
    } else {
      setName('');
      setUrl('');
      setEvents([]);
      setHeaders([]);
      setRetryPolicy(DEFAULT_RETRY_POLICY);
      // Generate a new secret for new webhooks
      setGeneratedSecret(generateSecret());
    }
    setErrors({});
    setShowSecret(false);
  }, [webhook, isOpen]);

  const handleEventToggle = useCallback((event: WebhookEventType) => {
    setEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }, []);

  const handleSelectAllEvents = useCallback(() => {
    const allEvents = Object.keys(WEBHOOK_EVENTS) as WebhookEventType[];
    setEvents((prev) => (prev.length === allEvents.length ? [] : allEvents));
  }, []);

  const handleAddHeader = useCallback(() => {
    setHeaders((prev) => [...prev, { key: '', value: '' }]);
  }, []);

  const handleUpdateHeader = useCallback(
    (index: number, field: 'key' | 'value', value: string) => {
      setHeaders((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: value };
        return updated;
      });
    },
    [],
  );

  const handleRemoveHeader = useCallback((index: number) => {
    setHeaders((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleCopySecret = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generatedSecret);
    } catch {
      // Fallback for browsers without clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = generatedSecret;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }, [generatedSecret]);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!url.trim()) {
      newErrors.url = 'URL is required';
    } else {
      try {
        new URL(url);
        if (!url.startsWith('https://')) {
          newErrors.url = 'URL must use HTTPS';
        }
      } catch {
        newErrors.url = 'Invalid URL format';
      }
    }

    if (events.length === 0) {
      newErrors.events = 'At least one event must be selected';
    }

    // Validate headers
    for (const header of headers) {
      if (header.key.trim() && !header.value.trim()) {
        newErrors.headers = 'All header values must be filled';
        break;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, url, events, headers]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!validate()) return;

      setIsSubmitting(true);

      try {
        await onSubmit({
          name: name.trim(),
          url: url.trim(),
          events,
          headers: headers.filter((h) => h.key.trim() && h.value.trim()),
          retryPolicy,
        });
        onClose();
      } catch (err) {
        setErrors({
          submit: err instanceof Error ? err.message : 'Failed to save webhook',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [name, url, events, headers, retryPolicy, validate, onSubmit, onClose],
  );

  if (!isOpen) return null;

  const allEvents = Object.entries(WEBHOOK_EVENTS) as [WebhookEventType, { label: string; description: string }][];
  const allSelected = events.length === allEvents.length;

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
        aria-labelledby="webhook-form-title"
      >
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h2 id="webhook-form-title" className="text-lg font-semibold text-foreground">
              {isEditing ? 'Edit Webhook' : 'Create Webhook'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Close"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="max-h-[60vh] overflow-y-auto p-6 space-y-6">
            {/* Name */}
            <div>
              <label htmlFor="webhook-name" className="block text-sm font-medium text-foreground">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="webhook-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Webhook"
                className={cn(
                  'mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1',
                  errors.name
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                    : 'border-input focus:border-primary focus:ring-primary',
                )}
              />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
            </div>

            {/* URL */}
            <div>
              <label htmlFor="webhook-url" className="block text-sm font-medium text-foreground">
                Endpoint URL <span className="text-red-500">*</span>
              </label>
              <input
                id="webhook-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.example.com/webhooks"
                className={cn(
                  'mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1',
                  errors.url
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                    : 'border-input focus:border-primary focus:ring-primary',
                )}
              />
              {errors.url && <p className="mt-1 text-xs text-red-500">{errors.url}</p>}
              <p className="mt-1 text-xs text-muted-foreground">
                Must be a valid HTTPS URL that can receive POST requests
              </p>
            </div>

            {/* Secret (only for new webhooks) */}
            {!isEditing && generatedSecret && (
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Signing Secret
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      value={generatedSecret}
                      readOnly
                      className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm font-mono focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    >
                      {showSecret ? (
                        <EyeOffIcon className="h-4 w-4" />
                      ) : (
                        <EyeIcon className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopySecret}
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors hover:bg-accent"
                    title="Copy secret"
                  >
                    <CopyIcon className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-1 text-xs text-yellow-600">
                  Save this secret now. You will not be able to see it again.
                </p>
              </div>
            )}

            {/* Events */}
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-foreground">
                  Events <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleSelectAllEvents}
                  className="text-xs text-primary hover:underline"
                >
                  {allSelected ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div
                className={cn(
                  'mt-2 grid gap-2 sm:grid-cols-2 rounded-md border p-3',
                  errors.events ? 'border-red-500' : 'border-border',
                )}
              >
                {allEvents.map(([event, config]) => (
                  <label
                    key={event}
                    className="flex items-start gap-3 rounded-md p-2 cursor-pointer hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      checked={events.includes(event)}
                      onChange={() => handleEventToggle(event)}
                      className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-primary"
                    />
                    <div>
                      <p className="text-sm font-medium text-foreground">{config.label}</p>
                      <p className="text-xs text-muted-foreground">{config.description}</p>
                    </div>
                  </label>
                ))}
              </div>
              {errors.events && <p className="mt-1 text-xs text-red-500">{errors.events}</p>}
            </div>

            {/* Custom Headers */}
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-foreground">
                  Custom Headers
                </label>
                <button
                  type="button"
                  onClick={handleAddHeader}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <PlusIcon className="h-3 w-3" />
                  Add header
                </button>
              </div>
              {headers.length > 0 && (
                <div className="mt-2 space-y-2">
                  {headers.map((header, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={header.key}
                        onChange={(e) => handleUpdateHeader(index, 'key', e.target.value)}
                        placeholder="Header name"
                        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <input
                        type="text"
                        value={header.value}
                        onChange={(e) => handleUpdateHeader(index, 'value', e.target.value)}
                        placeholder="Header value"
                        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveHeader(index)}
                        className="rounded p-2 text-red-500 hover:bg-red-500/10"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {errors.headers && <p className="mt-1 text-xs text-red-500">{errors.headers}</p>}
            </div>

            {/* Retry Policy */}
            <div>
              <label className="block text-sm font-medium text-foreground">Retry Policy</label>
              <div className="mt-2 grid gap-4 sm:grid-cols-3 rounded-md border border-border p-4">
                <div>
                  <label htmlFor="max-retries" className="block text-xs text-muted-foreground">
                    Max Retries
                  </label>
                  <input
                    id="max-retries"
                    type="number"
                    min="0"
                    max="10"
                    value={retryPolicy.maxRetries}
                    onChange={(e) =>
                      setRetryPolicy((prev) => ({
                        ...prev,
                        maxRetries: parseInt(e.target.value) || 0,
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label htmlFor="retry-delay" className="block text-xs text-muted-foreground">
                    Retry Delay (ms)
                  </label>
                  <input
                    id="retry-delay"
                    type="number"
                    min="100"
                    max="60000"
                    step="100"
                    value={retryPolicy.retryDelay}
                    onChange={(e) =>
                      setRetryPolicy((prev) => ({
                        ...prev,
                        retryDelay: parseInt(e.target.value) || 1000,
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={retryPolicy.exponentialBackoff}
                      onChange={(e) =>
                        setRetryPolicy((prev) => ({
                          ...prev,
                          exponentialBackoff: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-foreground">Exponential Backoff</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-600">
                {errors.submit}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner className="h-4 w-4" />
                  {isEditing ? 'Saving...' : 'Creating...'}
                </>
              ) : isEditing ? (
                'Save Changes'
              ) : (
                'Create Webhook'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Utility functions
function generateSecret(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
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

function EyeIcon({ className }: { className?: string }) {
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
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
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
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
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
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
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
      <path d="M12 5v14" />
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
