'use client';

/**
 * AI Model Management Component
 *
 * Provides controls for:
 * - Enabling/disabling AI models
 * - Configuring rate limits
 * - Setting up usage alerts
 * - Managing model availability
 *
 * @module components/admin/ai-model-management
 */

import { useState } from 'react';
import { toast } from 'sonner';

import { AVAILABLE_MODELS } from '@/lib/ai/providers';
import type { AIProvider } from '@/lib/ai/providers';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

interface RateLimits {
  requestsPerMinute: number;
  tokensPerMinute: number;
  costPerDay: number;
}

interface Alerts {
  enabled: boolean;
  thresholds: number[];
  recipients: string[];
}

interface AIModelManagementProps {
  workspaceId: string;
  workspaceSlug: string;
  enabledModels: string[];
  rateLimits: RateLimits;
  alerts: Alerts;
}

export function AIModelManagement({
  workspaceId,
  workspaceSlug,
  enabledModels: initialEnabledModels,
  rateLimits: initialRateLimits,
  alerts: initialAlerts,
}: AIModelManagementProps) {
  const [enabledModels, setEnabledModels] = useState<Set<string>>(
    new Set(initialEnabledModels)
  );
  const [rateLimits, setRateLimits] = useState<RateLimits>(initialRateLimits);
  const [alerts, setAlerts] = useState<Alerts>(initialAlerts);
  const [isSaving, setIsSaving] = useState(false);

  // Group models by provider
  const modelsByProvider = Object.entries(AVAILABLE_MODELS).reduce(
    (acc, [modelId, metadata]) => {
      if (!acc[metadata.provider]) {
        acc[metadata.provider] = [];
      }
      acc[metadata.provider].push({ id: modelId, ...metadata });
      return acc;
    },
    {} as Record<
      AIProvider,
      Array<{ id: string } & (typeof AVAILABLE_MODELS)[string]>
    >
  );

  const handleToggleModel = (modelId: string) => {
    const newEnabled = new Set(enabledModels);
    if (newEnabled.has(modelId)) {
      newEnabled.delete(modelId);
    } else {
      newEnabled.add(modelId);
    }
    setEnabledModels(newEnabled);
  };

  const handleToggleProvider = (provider: AIProvider, enabled: boolean) => {
    const newEnabled = new Set(enabledModels);
    const providerModels = modelsByProvider[provider] || [];

    for (const model of providerModels) {
      if (enabled) {
        newEnabled.add(model.id);
      } else {
        newEnabled.delete(model.id);
      }
    }

    setEnabledModels(newEnabled);
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/ai`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enabledModels: Array.from(enabledModels),
            rateLimits,
            alerts,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      toast.success('AI settings saved successfully');
    } catch (error) {
      console.error('Error saving AI settings:', error);
      toast.error('Failed to save AI settings');
    } finally {
      setIsSaving(false);
    }
  };

  const providerEnabled = (provider: AIProvider) => {
    const providerModels = modelsByProvider[provider] || [];
    return providerModels.every(m => enabledModels.has(m.id));
  };

  return (
    <div className='space-y-6'>
      {/* Model Availability */}
      <div>
        <h3 className='text-lg font-semibold mb-4'>Model Availability</h3>
        <div className='space-y-6'>
          {Object.entries(modelsByProvider).map(([provider, models]) => (
            <Card key={provider}>
              <CardHeader>
                <div className='flex items-center justify-between'>
                  <div>
                    <CardTitle className='text-base capitalize'>
                      {provider}
                    </CardTitle>
                    <CardDescription>
                      {models.length} model{models.length !== 1 ? 's' : ''}{' '}
                      available
                    </CardDescription>
                  </div>
                  <div className='flex items-center space-x-2'>
                    <Label htmlFor={`provider-${provider}`}>Enable All</Label>
                    <Switch
                      id={`provider-${provider}`}
                      checked={providerEnabled(provider as AIProvider)}
                      onCheckedChange={checked =>
                        handleToggleProvider(provider as AIProvider, checked)
                      }
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className='space-y-3'>
                  {models.map(model => (
                    <div
                      key={model.id}
                      className='flex items-center justify-between p-3 border rounded-lg'
                    >
                      <div className='flex-1'>
                        <div className='font-medium'>{model.name}</div>
                        <div className='text-sm text-muted-foreground'>
                          {model.contextWindow.toLocaleString()} tokens • $
                          {model.costPer1kTokens.input}/1K in • $
                          {model.costPer1kTokens.output}/1K out
                        </div>
                        <div className='text-xs text-muted-foreground mt-1'>
                          {model.supportsTools && 'Tools '}
                          {model.supportsStreaming && 'Streaming'}
                        </div>
                      </div>
                      <Switch
                        checked={enabledModels.has(model.id)}
                        onCheckedChange={() => handleToggleModel(model.id)}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Separator />

      {/* Rate Limits */}
      <div>
        <h3 className='text-lg font-semibold mb-4'>Rate Limits</h3>
        <Card>
          <CardContent className='pt-6 space-y-4'>
            <div className='grid gap-4 md:grid-cols-3'>
              <div className='space-y-2'>
                <Label htmlFor='requests-per-minute'>Requests per Minute</Label>
                <Input
                  id='requests-per-minute'
                  type='number'
                  value={rateLimits.requestsPerMinute}
                  onChange={e =>
                    setRateLimits({
                      ...rateLimits,
                      requestsPerMinute: parseInt(e.target.value) || 0,
                    })
                  }
                />
                <p className='text-xs text-muted-foreground'>
                  Max requests per minute per user
                </p>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='tokens-per-minute'>Tokens per Minute</Label>
                <Input
                  id='tokens-per-minute'
                  type='number'
                  value={rateLimits.tokensPerMinute}
                  onChange={e =>
                    setRateLimits({
                      ...rateLimits,
                      tokensPerMinute: parseInt(e.target.value) || 0,
                    })
                  }
                />
                <p className='text-xs text-muted-foreground'>
                  Max tokens per minute per user
                </p>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='cost-per-day'>Cost Limit per Day ($)</Label>
                <Input
                  id='cost-per-day'
                  type='number'
                  value={rateLimits.costPerDay}
                  onChange={e =>
                    setRateLimits({
                      ...rateLimits,
                      costPerDay: parseFloat(e.target.value) || 0,
                    })
                  }
                />
                <p className='text-xs text-muted-foreground'>
                  Max daily cost for workspace
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Usage Alerts */}
      <div>
        <h3 className='text-lg font-semibold mb-4'>Usage Alerts</h3>
        <Card>
          <CardContent className='pt-6 space-y-4'>
            <div className='flex items-center justify-between'>
              <div>
                <Label htmlFor='alerts-enabled'>Enable Usage Alerts</Label>
                <p className='text-sm text-muted-foreground'>
                  Receive notifications when usage thresholds are reached
                </p>
              </div>
              <Switch
                id='alerts-enabled'
                checked={alerts.enabled}
                onCheckedChange={checked =>
                  setAlerts({ ...alerts, enabled: checked })
                }
              />
            </div>

            {alerts.enabled && (
              <>
                <Separator />
                <div className='space-y-2'>
                  <Label>Alert Thresholds (%)</Label>
                  <div className='flex gap-2'>
                    {alerts.thresholds.map((threshold, index) => (
                      <Input
                        key={index}
                        type='number'
                        value={threshold}
                        onChange={e => {
                          const newThresholds = [...alerts.thresholds];
                          newThresholds[index] = parseInt(e.target.value) || 0;
                          setAlerts({ ...alerts, thresholds: newThresholds });
                        }}
                        className='w-20'
                      />
                    ))}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Alert when usage reaches these percentages of daily limit
                  </p>
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='alert-recipients'>Alert Recipients</Label>
                  <Input
                    id='alert-recipients'
                    type='text'
                    placeholder='email@example.com, email2@example.com'
                    value={alerts.recipients.join(', ')}
                    onChange={e =>
                      setAlerts({
                        ...alerts,
                        recipients: e.target.value
                          .split(',')
                          .map(s => s.trim()),
                      })
                    }
                  />
                  <p className='text-xs text-muted-foreground'>
                    Comma-separated email addresses
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <div className='flex justify-end'>
        <Button onClick={handleSaveSettings} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
