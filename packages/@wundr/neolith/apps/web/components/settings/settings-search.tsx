'use client';

import {
  Bell,
  Eye,
  Globe,
  Keyboard,
  Lock,
  Mail,
  Palette,
  Search,
  Settings,
  Shield,
  User,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

interface SettingsSearchProps {
  workspaceSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SearchItem {
  label: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
  keywords: string[];
}

export function SettingsSearch({
  workspaceSlug,
  open,
  onOpenChange,
}: SettingsSearchProps) {
  const router = useRouter();
  const [searchItems] = useState<SearchItem[]>([
    {
      label: 'Profile',
      description: 'Manage your personal information',
      href: `/${workspaceSlug}/settings/profile`,
      icon: User,
      category: 'Account',
      keywords: ['name', 'email', 'avatar', 'photo', 'bio'],
    },
    {
      label: 'Security',
      description: 'Password and authentication settings',
      href: `/${workspaceSlug}/settings/security`,
      icon: Shield,
      category: 'Account',
      keywords: ['password', 'two-factor', '2fa', 'authentication', 'login'],
    },
    {
      label: 'Privacy & Data',
      description: 'Control your data and privacy settings',
      href: `/${workspaceSlug}/settings/privacy`,
      icon: Lock,
      category: 'Account',
      keywords: ['data', 'privacy', 'gdpr', 'export', 'delete'],
    },
    {
      label: 'Workspace Preferences',
      description: 'Customize your workspace settings',
      href: `/${workspaceSlug}/settings/workspace-preferences`,
      icon: Settings,
      category: 'Preferences',
      keywords: ['workspace', 'defaults', 'timezone'],
    },
    {
      label: 'Notifications',
      description: 'Control how you receive notifications',
      href: `/${workspaceSlug}/settings/notifications`,
      icon: Bell,
      category: 'Preferences',
      keywords: ['alerts', 'email', 'push', 'digest'],
    },
    {
      label: 'Appearance',
      description: 'Customize colors and themes',
      href: `/${workspaceSlug}/settings/appearance`,
      icon: Palette,
      category: 'Preferences',
      keywords: ['theme', 'dark mode', 'light mode', 'colors', 'ui'],
    },
    {
      label: 'Accessibility',
      description: 'Accessibility options and features',
      href: `/${workspaceSlug}/settings/accessibility`,
      icon: Eye,
      category: 'Preferences',
      keywords: ['a11y', 'screen reader', 'keyboard', 'contrast'],
    },
    {
      label: 'Language & Region',
      description: 'Language, timezone, and regional settings',
      href: `/${workspaceSlug}/settings/language`,
      icon: Globe,
      category: 'Preferences',
      keywords: ['language', 'locale', 'timezone', 'date', 'time'],
    },
    {
      label: 'Keyboard Shortcuts',
      description: 'View and customize keyboard shortcuts',
      href: `/${workspaceSlug}/settings/keyboard-shortcuts`,
      icon: Keyboard,
      category: 'Preferences',
      keywords: ['hotkeys', 'shortcuts', 'commands'],
    },
    {
      label: 'Email Preferences',
      description: 'Manage email notification preferences',
      href: `/${workspaceSlug}/settings/email`,
      icon: Mail,
      category: 'Preferences',
      keywords: ['email', 'digest', 'unsubscribe'],
    },
  ]);

  const handleSelect = useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router]
  );

  // Group items by category
  const groupedItems = searchItems.reduce(
    (acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<string, SearchItem[]>
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder='Search settings...' />
      <CommandList>
        <CommandEmpty>No settings found.</CommandEmpty>
        {Object.entries(groupedItems).map(([category, items]) => (
          <CommandGroup key={category} heading={category}>
            {items.map(item => (
              <CommandItem
                key={item.href}
                value={`${item.label} ${item.description} ${item.keywords.join(' ')}`}
                onSelect={() => handleSelect(item.href)}
              >
                <item.icon className='mr-2 h-4 w-4' />
                <div className='flex flex-col'>
                  <span>{item.label}</span>
                  <span className='text-xs text-muted-foreground'>
                    {item.description}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
