'use client';

import {
  BarChart3,
  Bot,
  Bookmark,
  LayoutDashboard,
  Network,
  Rocket,
  Settings,
  Workflow,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import * as React from 'react';

import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar';
import { WorkspaceSwitcher } from '@/components/workspace/workspace-switcher';

const navMain = [
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: LayoutDashboard,
    isActive: true,
  },
  {
    title: 'Orchestrators',
    url: '/orchestrators',
    icon: Network,
    items: [
      { title: 'All Orchestrators', url: '/orchestrators' },
      { title: 'New Orchestrator', url: '/orchestrators/new' },
    ],
  },
  {
    title: 'Agents',
    url: '/agents',
    icon: Bot,
  },
  {
    title: 'Workflows',
    url: '/workflows',
    icon: Workflow,
    items: [
      { title: 'All Workflows', url: '/workflows' },
      { title: 'New Workflow', url: '/workflows/new' },
    ],
  },
  {
    title: 'Analytics',
    url: '/analytics',
    icon: BarChart3,
    items: [
      { title: 'Overview', url: '/analytics/overview' },
      { title: 'Performance', url: '/analytics/performance' },
      { title: 'Team', url: '/analytics/team' },
      { title: 'Usage', url: '/analytics/usage' },
    ],
  },
  {
    title: 'Deployments',
    url: '/deployments',
    icon: Rocket,
  },
  {
    title: 'Saved',
    url: '/later',
    icon: Bookmark,
  },
  {
    title: 'Settings',
    url: '/settings/profile',
    icon: Settings,
    items: [
      { title: 'Profile', url: '/settings/profile' },
      { title: 'Appearance', url: '/settings/appearance' },
      { title: 'Notifications', url: '/settings/notifications' },
      { title: 'Security', url: '/settings/security' },
    ],
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = useSession();

  const user = {
    name: session?.user?.name || 'User',
    email: session?.user?.email || '',
    avatar: session?.user?.image || '',
    status: 'online' as const,
  };

  return (
    <Sidebar collapsible='icon' {...props}>
      <SidebarHeader>
        <WorkspaceSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
