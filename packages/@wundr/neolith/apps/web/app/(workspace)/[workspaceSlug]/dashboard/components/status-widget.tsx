'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface UserStatus {
  emoji: string;
  message: string;
  expiresAt?: string;
}

interface StatusPreset {
  emoji: string;
  message: string;
  duration?: number; // minutes
}

const STATUS_PRESETS: StatusPreset[] = [
  { emoji: '💬', message: 'In a meeting', duration: 60 },
  { emoji: '🏖️', message: 'On vacation', duration: 480 },
  { emoji: '🍽️', message: 'At lunch', duration: 60 },
  { emoji: '🏠', message: 'Working remotely' },
  { emoji: '⏰', message: 'Away', duration: 30 },
  { emoji: '🎯', message: 'Focusing' },
];

interface StatusWidgetProps {
  workspaceSlug: string;
  onSetCustomStatus?: () => void;
}

export function StatusWidget({ workspaceSlug, onSetCustomStatus }: StatusWidgetProps) {
  const [status, setStatus] = useState<UserStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/workspaces/${workspaceSlug}/status`);

        if (!response.ok) {
          throw new Error('Failed to fetch status');
        }

        const data = await response.json();
        setStatus(data.status || null);
        setError(null);
      } catch (err) {
        console.error('Error fetching status:', err);
        setError('Failed to load status');
        setStatus(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();
  }, [workspaceSlug]);

  const handlePresetClick = async (preset: StatusPreset) => {
    try {
      setIsUpdating(true);
      const expiresAt = preset.duration
        ? new Date(Date.now() + preset.duration * 60000).toISOString()
        : undefined;

      const response = await fetch(`/api/workspaces/${workspaceSlug}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emoji: preset.emoji,
          message: preset.message,
          expiresAt,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      const data = await response.json();
      setStatus(data.status);
      setError(null);
    } catch (err) {
      console.error('Error updating status:', err);
      setError('Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClearStatus = async () => {
    try {
      setIsUpdating(true);
      const response = await fetch(`/api/workspaces/${workspaceSlug}/status`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to clear status');
      }

      setStatus(null);
      setError(null);
    } catch (err) {
      console.error('Error clearing status:', err);
      setError('Failed to clear status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCustomStatus = () => {
    if (onSetCustomStatus) {
      onSetCustomStatus();
    } else {
      // Open a modal or navigate to status settings
      // For now, just log
      console.log('Open custom status dialog');
    }
  };

  if (isLoading) {
    return <StatusWidgetSkeleton />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Your Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <p className="font-medium">Error</p>
            <p className="mt-1 text-xs">{error}</p>
          </div>
        )}

        {/* Current Status */}
        <div className="rounded-lg border p-4 bg-muted/50">
          {status ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{status.emoji}</span>
                <div>
                  <p className="text-sm font-medium">{status.message}</p>
                  {status.expiresAt && (
                    <p className="text-xs text-muted-foreground">
                      Until {new Date(status.expiresAt).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearStatus}
                disabled={isUpdating}
              >
                Clear
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">
              No status set
            </p>
          )}
        </div>

        {/* Quick Presets */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Quick presets</p>
          <div className="grid grid-cols-2 gap-2">
            {STATUS_PRESETS.map((preset, index) => (
              <PresetButton
                key={index}
                preset={preset}
                onClick={() => handlePresetClick(preset)}
                disabled={isUpdating}
                isActive={
                  status?.emoji === preset.emoji &&
                  status?.message === preset.message
                }
              />
            ))}
          </div>
        </div>

        {/* Custom Status Link */}
        <Button
          variant="outline"
          className="w-full"
          onClick={handleCustomStatus}
          disabled={isUpdating}
        >
          Set custom status
        </Button>
      </CardContent>
    </Card>
  );
}

interface PresetButtonProps {
  preset: StatusPreset;
  onClick: () => void;
  disabled: boolean;
  isActive: boolean;
}

function PresetButton({ preset, onClick, disabled, isActive }: PresetButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border text-left',
        'hover:bg-accent hover:text-accent-foreground transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        isActive && 'bg-accent border-primary'
      )}
    >
      <span className="text-lg">{preset.emoji}</span>
      <span className="text-xs font-medium truncate">{preset.message}</span>
    </button>
  );
}

function StatusWidgetSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-24" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}
