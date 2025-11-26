/**
 * Appearance Settings Component
 * @module components/settings/appearance-settings
 */
'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const themes = [
    { value: 'light', label: 'Light', icon: Sun, description: 'Light theme' },
    { value: 'dark', label: 'Dark', icon: Moon, description: 'Dark theme' },
    { value: 'system', label: 'System', icon: Monitor, description: 'Match system' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Appearance</h2>
        <p className="text-muted-foreground">
          Customize how the application looks on your device.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>
            Select your preferred theme for the interface.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={theme}
            onValueChange={setTheme}
            className="grid grid-cols-3 gap-4"
          >
            {themes.map(({ value, label, icon: Icon, description }) => (
              <Label
                key={value}
                className={cn(
                  'flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer',
                  theme === value && 'border-primary'
                )}
              >
                <RadioGroupItem value={value} className="sr-only" />
                <Icon className="mb-3 h-6 w-6" />
                <span className="font-medium">{label}</span>
                <span className="text-xs text-muted-foreground">{description}</span>
                {theme === value && (
                  <Check className="mt-2 h-4 w-4 text-primary" />
                )}
              </Label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Theme Preview Card */}
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            See how your selected theme looks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemePreview />
        </CardContent>
      </Card>
    </div>
  );
}

function ThemePreview() {
  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-primary" />
        <div className="space-y-1">
          <div className="h-4 w-24 rounded bg-foreground/80" />
          <div className="h-3 w-32 rounded bg-muted-foreground/50" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="h-8 w-20 rounded bg-primary" />
        <div className="h-8 w-20 rounded border" />
      </div>
    </div>
  );
}
