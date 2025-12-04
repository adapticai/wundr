'use client';

/**
 * Capability Toggle Component
 *
 * Individual capability configuration with toggle and settings.
 */

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

import type {
  CapabilityConfig,
  PermissionLevel,
} from '@/lib/validations/orchestrator-config';

interface CapabilityToggleProps {
  capability: {
    type: string;
    name: string;
    description: string;
    icon: string;
  };
  config?: CapabilityConfig;
  onToggle: (enabled: boolean) => void;
  onPermissionChange: (level: PermissionLevel) => void;
  onRateLimitChange: (field: string, value: string) => void;
  disabled?: boolean;
  isAdmin?: boolean;
}

export function CapabilityToggle({
  capability,
  config,
  onToggle,
  onPermissionChange,
  onRateLimitChange,
  disabled,
  isAdmin,
}: CapabilityToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const enabled = config?.enabled ?? false;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className='border rounded-lg p-4'
    >
      <div className='flex items-start justify-between gap-4'>
        <div className='flex items-start gap-3 flex-1'>
          <div className='text-2xl mt-1'>{capability.icon}</div>
          <div className='flex-1 space-y-1'>
            <div className='flex items-center gap-2'>
              <Label
                htmlFor={`capability-${capability.type}`}
                className='text-base font-medium'
              >
                {capability.name}
              </Label>
              {enabled && (
                <CollapsibleTrigger asChild>
                  <button
                    type='button'
                    className='p-1 hover:bg-accent rounded-sm transition-colors'
                  >
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                </CollapsibleTrigger>
              )}
            </div>
            <p className='text-sm text-muted-foreground'>
              {capability.description}
            </p>
          </div>
        </div>
        <Switch
          id={`capability-${capability.type}`}
          checked={enabled}
          onCheckedChange={onToggle}
          disabled={disabled}
        />
      </div>

      {enabled && (
        <CollapsibleContent className='mt-4 space-y-4 border-t pt-4'>
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor={`permission-${capability.type}`}>
                Permission Level
              </Label>
              <Select
                value={config?.permissionLevel || 'read'}
                onValueChange={value =>
                  onPermissionChange(value as PermissionLevel)
                }
                disabled={disabled}
              >
                <SelectTrigger id={`permission-${capability.type}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='read'>Read</SelectItem>
                  <SelectItem value='write'>Write</SelectItem>
                  {isAdmin && <SelectItem value='admin'>Admin</SelectItem>}
                </SelectContent>
              </Select>
              <p className='text-xs text-muted-foreground'>
                Control the level of access this capability has
              </p>
            </div>
          </div>

          <div className='grid gap-4 md:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor={`rate-hour-${capability.type}`}>
                Max Per Hour
              </Label>
              <Input
                id={`rate-hour-${capability.type}`}
                type='number'
                min='1'
                value={config?.rateLimit?.maxPerHour || ''}
                onChange={e => onRateLimitChange('maxPerHour', e.target.value)}
                placeholder='No limit'
                disabled={disabled}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor={`rate-day-${capability.type}`}>Max Per Day</Label>
              <Input
                id={`rate-day-${capability.type}`}
                type='number'
                min='1'
                value={config?.rateLimit?.maxPerDay || ''}
                onChange={e => onRateLimitChange('maxPerDay', e.target.value)}
                placeholder='No limit'
                disabled={disabled}
              />
            </div>
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}
