'use client';

import * as React from 'react';
import {
  BookOpen,
  Copy,
  FileCode,
  Home,
  Lightbulb,
  LineChart,
  Network,
  Settings,
  Upload,
  Sparkles,
} from 'lucide-react';
import { WundrLogo } from '@/components/logos';

import { NavMain } from '@/components/nav-main';
import { NavProjects } from '@/components/nav-projects';
import { NavSecondary } from '@/components/nav-secondary';
import { NavUser } from '@/components/nav-user';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

const data = {
  user: {
    name: 'Admin',
    email: 'admin@wundr.io',
    avatar: '/avatars/default.jpg',
  },
  navMain: [
    {
      title: 'Overview',
      url: '/dashboard',
      icon: Home,
      isActive: true,
      items: [
        {
          title: 'Summary',
          url: '/dashboard',
        },
        {
          title: 'Load Report',
          url: '/dashboard/load-report',
        },
      ],
    },
    {
      title: 'File Browser',
      url: '/dashboard/files',
      icon: FileCode,
      items: [
        {
          title: 'Browse Files',
          url: '/dashboard/files',
        },
      ],
    },
    {
      title: 'Analysis',
      url: '/dashboard/analysis',
      icon: LineChart,
      items: [
        {
          title: 'Entities',
          url: '/dashboard/analysis/entities',
        },
        {
          title: 'Duplicates',
          url: '/dashboard/analysis/duplicates',
        },
        {
          title: 'Dependencies',
          url: '/dashboard/analysis/dependencies',
        },
        {
          title: 'Circular Dependencies',
          url: '/dashboard/analysis/circular',
        },
      ],
    },
    {
      title: 'Recommendations',
      url: '/dashboard/recommendations',
      icon: Lightbulb,
      items: [
        {
          title: 'All Recommendations',
          url: '/dashboard/recommendations',
        },
        {
          title: 'Critical',
          url: '/dashboard/recommendations/critical',
        },
        {
          title: 'High Priority',
          url: '/dashboard/recommendations/high',
        },
      ],
    },
    {
      title: 'Documentation',
      url: '/dashboard/docs',
      icon: BookOpen,
      items: [
        {
          title: 'Getting Started',
          url: '/dashboard/docs/getting-started',
        },
        {
          title: 'Templates',
          url: '/dashboard/docs/templates',
        },
        {
          title: 'Golden Patterns',
          url: '/dashboard/docs/patterns',
        },
        {
          title: 'API Reference',
          url: '/dashboard/docs/api',
        },
        {
          title: 'Markdown Demo',
          url: '/dashboard/markdown-demo',
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: 'About Wundr',
      url: '/dashboard/about',
      icon: Sparkles,
    },
    {
      title: 'Settings',
      url: '/dashboard/settings',
      icon: Settings,
    },
    {
      title: 'Upload Report',
      url: '/dashboard/upload',
      icon: Upload,
    },
  ],
  projects: [
    {
      name: 'Service Templates',
      url: '/dashboard/templates/services',
      icon: FileCode,
    },
    {
      name: 'Consolidation Batches',
      url: '/dashboard/templates/batches',
      icon: Copy,
    },
    {
      name: 'Migration Reports',
      url: '/dashboard/reports',
      icon: Network,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar variant='inset' {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size='lg' asChild>
              <a href='/dashboard'>
                <div className='flex aspect-square size-8 items-center justify-center'>
                  <WundrLogo size={32} theme='auto' />
                </div>
                <div className='grid flex-1 text-left text-sm leading-tight'>
                  <span className='truncate font-semibold'>Wundr</span>
                  <span className='truncate text-xs text-muted-foreground'>by Lumic.ai</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className='px-3 py-2'>
          <ThemeToggle />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavProjects projects={data.projects} />
        <NavSecondary items={data.navSecondary} className='mt-auto' />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
