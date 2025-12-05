'use client';

import { CheckCircle2, Circle, Clock, Moon, XCircle } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface StatusOption {
  type: 'available' | 'busy' | 'away' | 'dnd';
  label: string;
  emoji: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const STATUS_OPTIONS: StatusOption[] = [
  {
    type: 'available',
    label: 'Available',
    emoji: '🟢',
    icon: CheckCircle2,
    color: 'text-green-500',
  },
  {
    type: 'busy',
    label: 'Busy',
    emoji: '🔴',
    icon: Circle,
    color: 'text-red-500',
  },
  {
    type: 'away',
    label: 'Away',
    emoji: '🟡',
    icon: Clock,
    color: 'text-yellow-500',
  },
  {
    type: 'dnd',
    label: 'Do Not Disturb',
    emoji: '🔴',
    icon: Moon,
    color: 'text-red-500',
  },
];

interface QuickStatusSwitcherProps {
  currentStatus?: {
    type: 'available' | 'busy' | 'away' | 'dnd';
    emoji?: string;
    message?: string;
  };
  onStatusChange: (
    status: StatusOption,
    clearAfter?: { value: number; unit: 'minutes' | 'hours' },
  ) => Promise<void>;
  onClearStatus: () => Promise<void>;
  onCustomStatus: () => void;
}

const CLEAR_OPTIONS = [
  { label: "Don't clear", value: null },
  { label: '30 minutes', value: 30, unit: 'minutes' as const },
  { label: '1 hour', value: 60, unit: 'minutes' as const },
  { label: '2 hours', value: 120, unit: 'minutes' as const },
  { label: '4 hours', value: 240, unit: 'minutes' as const },
  { label: 'Today', value: null },
];

export function QuickStatusSwitcher({
  currentStatus,
  onStatusChange,
  onClearStatus,
  onCustomStatus,
}: QuickStatusSwitcherProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusChange = async (status: StatusOption) => {
    setIsUpdating(true);
    try {
      await onStatusChange(status);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClearStatus = async () => {
    setIsUpdating(true);
    try {
      await onClearStatus();
    } finally {
      setIsUpdating(false);
    }
  };

  const currentStatusOption = STATUS_OPTIONS.find(
    opt => opt.type === currentStatus?.type,
  );
  const StatusIcon = currentStatusOption?.icon || Circle;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          disabled={isUpdating}
        >
          <StatusIcon
            className={cn('h-4 w-4', currentStatusOption?.color || 'text-muted-foreground')}
          />
          <span className="text-sm">
            {currentStatus?.message || currentStatusOption?.label || 'Set status'}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Quick status</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {STATUS_OPTIONS.map(status => {
          const Icon = status.icon;
          const isActive = currentStatus?.type === status.type;

          return (
            <DropdownMenuItem
              key={status.type}
              onClick={() => handleStatusChange(status)}
              className="flex items-center gap-3"
            >
              <Icon className={cn('h-4 w-4', status.color)} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{status.label}</span>
                  {isActive && (
                    <CheckCircle2 className="h-3 w-3 text-primary" />
                  )}
                </div>
              </div>
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={onCustomStatus}>
          <span className="text-sm">Set custom status...</span>
        </DropdownMenuItem>

        {currentStatus && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleClearStatus}>
              <XCircle className="h-4 w-4 mr-2" />
              <span className="text-sm">Clear status</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
