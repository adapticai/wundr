/**
 * Command Palette Component
 * Global command palette for quick navigation and actions
 * @module components/ui/command-palette
 */
'use client';

import {
  Home,
  MessageSquare,
  Users,
  Settings,
  BarChart3,
  Workflow,
  Building2,
  Search,
  FileText,
  Bell,
  Calendar,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';


interface CommandPaletteProps {
  workspaceId?: string;
}

interface CommandAction {
  icon: React.ElementType;
  label: string;
  path: string;
  keywords?: string[];
}

export function CommandPalette({ workspaceId }: CommandPaletteProps) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const navigate = (path: string) => {
    router.push(path);
    setOpen(false);
  };

  const basePath = workspaceId ? `/workspaces/${workspaceId}` : '';

  const navigationActions: CommandAction[] = [
    {
      icon: Home,
      label: 'Dashboard',
      path: `${basePath}/dashboard`,
      keywords: ['home', 'overview'],
    },
    {
      icon: MessageSquare,
      label: 'Channels',
      path: `${basePath}/channels`,
      keywords: ['chat', 'messages', 'conversation'],
    },
    {
      icon: Users,
      label: 'Virtual People',
      path: `${basePath}/vps`,
      keywords: ['vp', 'agents', 'bots', 'people'],
    },
    {
      icon: Workflow,
      label: 'Workflows',
      path: `${basePath}/workflows`,
      keywords: ['automation', 'flow', 'process'],
    },
    {
      icon: BarChart3,
      label: 'Analytics',
      path: `${basePath}/analytics`,
      keywords: ['stats', 'metrics', 'reports', 'data'],
    },
    {
      icon: Calendar,
      label: 'Tasks',
      path: `${basePath}/tasks`,
      keywords: ['todo', 'assignments'],
    },
    {
      icon: FileText,
      label: 'Documents',
      path: `${basePath}/documents`,
      keywords: ['files', 'docs'],
    },
    {
      icon: Bell,
      label: 'Notifications',
      path: `${basePath}/notifications`,
      keywords: ['alerts', 'updates'],
    },
  ];

  const settingsActions: CommandAction[] = [
    {
      icon: Settings,
      label: 'Settings',
      path: `${basePath}/settings`,
      keywords: ['preferences', 'config'],
    },
    {
      icon: Building2,
      label: 'Admin',
      path: `${basePath}/admin`,
      keywords: ['administration', 'manage'],
    },
    {
      icon: Zap,
      label: 'Integrations',
      path: `${basePath}/integrations`,
      keywords: ['connect', 'apps'],
    },
  ];

  const quickActions: CommandAction[] = [
    {
      icon: MessageSquare,
      label: 'New Channel',
      path: `${basePath}/channels/new`,
      keywords: ['create channel'],
    },
    {
      icon: Users,
      label: 'Create VP',
      path: `${basePath}/vps/new`,
      keywords: ['create virtual person', 'new agent'],
    },
    {
      icon: Workflow,
      label: 'New Workflow',
      path: `${basePath}/workflows/new`,
      keywords: ['create workflow', 'automation'],
    },
    {
      icon: Search,
      label: 'Search',
      path: `${basePath}/search`,
      keywords: ['find', 'lookup'],
    },
  ];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Quick Actions">
          {quickActions.map((action) => (
            <CommandItem
              key={action.path}
              onSelect={() => navigate(action.path)}
              keywords={action.keywords}
            >
              <action.icon className="mr-2 h-4 w-4" />
              {action.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigation">
          {navigationActions.map((action) => (
            <CommandItem
              key={action.path}
              onSelect={() => navigate(action.path)}
              keywords={action.keywords}
            >
              <action.icon className="mr-2 h-4 w-4" />
              {action.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Settings">
          {settingsActions.map((action) => (
            <CommandItem
              key={action.path}
              onSelect={() => navigate(action.path)}
              keywords={action.keywords}
            >
              <action.icon className="mr-2 h-4 w-4" />
              {action.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
