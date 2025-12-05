'use client';

import { Moon, Palette, Sun, Volume2, VolumeX, Zap } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';

interface QuickSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickSettingsModal({
  open,
  onOpenChange,
}: QuickSettingsModalProps) {
  const { theme, setTheme } = useTheme();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Load preferences from localStorage
    const savedSound = localStorage.getItem('soundEnabled');
    const savedMotion = localStorage.getItem('reducedMotion');
    if (savedSound !== null) {
setSoundEnabled(savedSound === 'true');
}
    if (savedMotion !== null) {
setReducedMotion(savedMotion === 'true');
}
  }, []);

  const handleSoundToggle = (enabled: boolean) => {
    setSoundEnabled(enabled);
    localStorage.setItem('soundEnabled', enabled.toString());
  };

  const handleMotionToggle = (enabled: boolean) => {
    setReducedMotion(enabled);
    localStorage.setItem('reducedMotion', enabled.toString());
    if (enabled) {
      document.documentElement.classList.add('reduce-motion');
    } else {
      document.documentElement.classList.remove('reduce-motion');
    }
  };

  if (!mounted) {
return null;
}

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Quick Settings
          </DialogTitle>
          <DialogDescription>
            Quickly adjust common settings without leaving your workflow
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Theme Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Appearance
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('light')}
                className="gap-2"
              >
                <Sun className="h-4 w-4" />
                Light
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('dark')}
                className="gap-2"
              >
                <Moon className="h-4 w-4" />
                Dark
              </Button>
              <Button
                variant={theme === 'system' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('system')}
                className="gap-2"
              >
                System
              </Button>
            </div>
          </div>

          <Separator />

          {/* Sound Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sound" className="flex items-center gap-2">
                {soundEnabled ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4" />
                )}
                Sound Effects
              </Label>
              <p className="text-xs text-muted-foreground">
                Play sounds for notifications and actions
              </p>
            </div>
            <Switch
              id="sound"
              checked={soundEnabled}
              onCheckedChange={handleSoundToggle}
            />
          </div>

          <Separator />

          {/* Reduced Motion Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="motion" className="text-sm font-medium">
                Reduce Motion
              </Label>
              <p className="text-xs text-muted-foreground">
                Minimize animations and transitions
              </p>
            </div>
            <Switch
              id="motion"
              checked={reducedMotion}
              onCheckedChange={handleMotionToggle}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
