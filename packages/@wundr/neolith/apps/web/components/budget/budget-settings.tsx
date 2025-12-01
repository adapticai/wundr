'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, Save, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BudgetConfiguration {
  hourlyLimit: number;
  dailyLimit: number;
  monthlyLimit: number;
  autoPauseEnabled: boolean;
  warningThreshold: number;
  criticalThreshold: number;
}

export interface BudgetSettingsProps {
  config: BudgetConfiguration;
  className?: string;
  onSave?: (config: BudgetConfiguration) => void;
  onReset?: () => void;
  isSaving?: boolean;
}

const DEFAULT_CONFIG: BudgetConfiguration = {
  hourlyLimit: 100000,
  dailyLimit: 1000000,
  monthlyLimit: 10000000,
  autoPauseEnabled: true,
  warningThreshold: 75,
  criticalThreshold: 90,
};

const formatTokens = (tokens: number): string => {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toLocaleString();
};

const validateConfig = (
  config: BudgetConfiguration
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (config.hourlyLimit <= 0) {
    errors.push('Hourly limit must be greater than 0');
  }
  if (config.dailyLimit <= 0) {
    errors.push('Daily limit must be greater than 0');
  }
  if (config.monthlyLimit <= 0) {
    errors.push('Monthly limit must be greater than 0');
  }
  if (config.hourlyLimit * 24 > config.dailyLimit) {
    errors.push('Daily limit should be at least 24x hourly limit');
  }
  if (config.dailyLimit * 30 > config.monthlyLimit) {
    errors.push('Monthly limit should be at least 30x daily limit');
  }
  if (config.warningThreshold >= config.criticalThreshold) {
    errors.push('Warning threshold must be less than critical threshold');
  }
  if (config.warningThreshold < 0 || config.warningThreshold > 100) {
    errors.push('Warning threshold must be between 0 and 100');
  }
  if (config.criticalThreshold < 0 || config.criticalThreshold > 100) {
    errors.push('Critical threshold must be between 0 and 100');
  }

  return { valid: errors.length === 0, errors };
};

export function BudgetSettings({
  config,
  className,
  onSave,
  onReset,
  isSaving = false,
}: BudgetSettingsProps) {
  const [localConfig, setLocalConfig] =
    React.useState<BudgetConfiguration>(config);
  const [hasChanges, setHasChanges] = React.useState(false);
  const [validationErrors, setValidationErrors] = React.useState<string[]>([]);

  React.useEffect(() => {
    setLocalConfig(config);
    setHasChanges(false);
  }, [config]);

  React.useEffect(() => {
    const isDifferent = JSON.stringify(localConfig) !== JSON.stringify(config);
    setHasChanges(isDifferent);

    const validation = validateConfig(localConfig);
    setValidationErrors(validation.errors);
  }, [localConfig, config]);

  const handleSave = () => {
    const validation = validateConfig(localConfig);
    if (validation.valid) {
      onSave?.(localConfig);
    }
  };

  const handleReset = () => {
    setLocalConfig(DEFAULT_CONFIG);
    onReset?.();
  };

  const updateConfig = (
    key: keyof BudgetConfiguration,
    value: number | boolean
  ) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle>Budget Settings</CardTitle>
            <CardDescription>
              Configure token budget limits and alert thresholds
            </CardDescription>
          </div>
          {hasChanges && (
            <Badge variant='outline' className='ml-2'>
              Unsaved changes
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className='space-y-6'>
        {/* Budget Limits */}
        <div className='space-y-4'>
          <div>
            <h3 className='text-sm font-medium mb-3'>Budget Limits</h3>
            <div className='grid gap-4'>
              {/* Hourly Limit */}
              <div className='grid gap-2'>
                <div className='flex items-center justify-between'>
                  <Label htmlFor='hourly-limit'>Hourly Limit</Label>
                  <span className='text-xs text-muted-foreground'>
                    {formatTokens(localConfig.hourlyLimit)}
                  </span>
                </div>
                <Input
                  id='hourly-limit'
                  type='number'
                  min='0'
                  step='1000'
                  value={localConfig.hourlyLimit}
                  onChange={e =>
                    updateConfig('hourlyLimit', Number(e.target.value))
                  }
                />
                <p className='text-xs text-muted-foreground'>
                  Maximum tokens allowed per hour
                </p>
              </div>

              {/* Daily Limit */}
              <div className='grid gap-2'>
                <div className='flex items-center justify-between'>
                  <Label htmlFor='daily-limit'>Daily Limit</Label>
                  <span className='text-xs text-muted-foreground'>
                    {formatTokens(localConfig.dailyLimit)}
                  </span>
                </div>
                <Input
                  id='daily-limit'
                  type='number'
                  min='0'
                  step='10000'
                  value={localConfig.dailyLimit}
                  onChange={e =>
                    updateConfig('dailyLimit', Number(e.target.value))
                  }
                />
                <p className='text-xs text-muted-foreground'>
                  Maximum tokens allowed per day
                </p>
              </div>

              {/* Monthly Limit */}
              <div className='grid gap-2'>
                <div className='flex items-center justify-between'>
                  <Label htmlFor='monthly-limit'>Monthly Limit</Label>
                  <span className='text-xs text-muted-foreground'>
                    {formatTokens(localConfig.monthlyLimit)}
                  </span>
                </div>
                <Input
                  id='monthly-limit'
                  type='number'
                  min='0'
                  step='100000'
                  value={localConfig.monthlyLimit}
                  onChange={e =>
                    updateConfig('monthlyLimit', Number(e.target.value))
                  }
                />
                <p className='text-xs text-muted-foreground'>
                  Maximum tokens allowed per month
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Alert Thresholds */}
          <div>
            <h3 className='text-sm font-medium mb-3'>Alert Thresholds</h3>
            <div className='grid gap-4'>
              {/* Warning Threshold */}
              <div className='grid gap-2'>
                <div className='flex items-center justify-between'>
                  <Label htmlFor='warning-threshold'>Warning Threshold</Label>
                  <span className='text-xs text-muted-foreground'>
                    {localConfig.warningThreshold}%
                  </span>
                </div>
                <Input
                  id='warning-threshold'
                  type='number'
                  min='0'
                  max='100'
                  value={localConfig.warningThreshold}
                  onChange={e =>
                    updateConfig('warningThreshold', Number(e.target.value))
                  }
                />
                <p className='text-xs text-muted-foreground'>
                  Show warning when usage exceeds this percentage
                </p>
              </div>

              {/* Critical Threshold */}
              <div className='grid gap-2'>
                <div className='flex items-center justify-between'>
                  <Label htmlFor='critical-threshold'>Critical Threshold</Label>
                  <span className='text-xs text-muted-foreground'>
                    {localConfig.criticalThreshold}%
                  </span>
                </div>
                <Input
                  id='critical-threshold'
                  type='number'
                  min='0'
                  max='100'
                  value={localConfig.criticalThreshold}
                  onChange={e =>
                    updateConfig('criticalThreshold', Number(e.target.value))
                  }
                />
                <p className='text-xs text-muted-foreground'>
                  Show critical alert when usage exceeds this percentage
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Auto-Pause */}
          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <Label htmlFor='auto-pause'>Auto-Pause on Budget Exceeded</Label>
              <p className='text-xs text-muted-foreground'>
                Automatically pause LLM requests when budget limit is reached
              </p>
            </div>
            <Switch
              id='auto-pause'
              checked={localConfig.autoPauseEnabled}
              onCheckedChange={checked =>
                updateConfig('autoPauseEnabled', checked)
              }
            />
          </div>
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className='rounded-lg border border-destructive/20 bg-destructive/10 p-3'>
            <div className='flex gap-2'>
              <AlertCircle className='h-4 w-4 text-destructive shrink-0 mt-0.5' />
              <div className='space-y-1'>
                <p className='text-sm font-medium text-destructive'>
                  Configuration Errors
                </p>
                <ul className='text-xs text-destructive/90 space-y-1 list-disc list-inside'>
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className='flex justify-end gap-2 pt-2'>
          <Button variant='outline' onClick={handleReset} disabled={isSaving}>
            <RotateCcw className='h-4 w-4 mr-2' />
            Reset to Defaults
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || validationErrors.length > 0 || isSaving}
          >
            {isSaving ? (
              <>
                <div className='h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent' />
                Saving...
              </>
            ) : (
              <>
                <Save className='h-4 w-4 mr-2' />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
