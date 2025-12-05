'use client';

import {
  ArrowLeft,
  Bell,
  Eye,
  Menu,
  Palette,
  Shield,
  User,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

import type { NavSection, NavItem } from './layout';

interface SettingsLayoutClientProps {
  children: React.ReactNode;
  workspaceSlug: string;
  workspaceName: string;
  sections: NavSection[];
}

const iconMap: Record<string, LucideIcon> = {
  User,
  Shield,
  Bell,
  Palette,
  Eye,
};

export function SettingsLayoutClient({
  children,
  workspaceSlug,
  workspaceName,
  sections,
}: SettingsLayoutClientProps) {
  return (
    <div className='flex min-h-screen bg-background'>
      {/* Desktop Sidebar */}
      <aside className='hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:border-r lg:bg-muted/30'>
        <SettingsSidebar
          workspaceSlug={workspaceSlug}
          workspaceName={workspaceName}
          sections={sections}
        />
      </aside>

      {/* Mobile Header */}
      <div className='lg:hidden fixed top-0 left-0 right-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
        <div className='flex h-14 items-center justify-between px-4'>
          <Link
            href={`/${workspaceSlug}/dashboard`}
            className='flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors'
          >
            <ArrowLeft className='h-4 w-4' />
            <span>Back to workspace</span>
          </Link>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant='ghost' size='icon'>
                <Menu className='h-5 w-5' />
              </Button>
            </SheetTrigger>
            <SheetContent side='left' className='w-64 p-0'>
              <SettingsSidebar
                workspaceSlug={workspaceSlug}
                workspaceName={workspaceName}
                sections={sections}
              />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main Content */}
      <main className='flex-1 lg:pl-64'>
        <div className='pt-14 lg:pt-0'>
          <div className='mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12'>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

interface SettingsSidebarProps {
  workspaceSlug: string;
  workspaceName: string;
  sections: NavSection[];
}

function SettingsSidebar({
  workspaceSlug,
  workspaceName,
  sections,
}: SettingsSidebarProps) {
  return (
    <div className='flex h-full flex-col'>
      {/* Header */}
      <div className='flex h-14 items-center border-b px-6'>
        <h2 className='text-lg font-semibold tracking-tight'>Settings</h2>
      </div>

      {/* Back to Workspace Link */}
      <div className='border-b px-4 py-3'>
        <Link
          href={`/${workspaceSlug}/dashboard`}
          className='flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group'
        >
          <ArrowLeft className='h-4 w-4 transition-transform group-hover:-translate-x-0.5' />
          <span className='truncate'>{workspaceName}</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className='flex-1 overflow-y-auto px-3 py-4'>
        <div className='space-y-6'>
          {sections.map(section => (
            <SettingsNavSection key={section.title} section={section} />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className='border-t px-4 py-4'>
        <p className='text-xs text-muted-foreground'>
          Changes are saved automatically
        </p>
      </div>
    </div>
  );
}

interface SettingsNavSectionProps {
  section: NavSection;
}

function SettingsNavSection({ section }: SettingsNavSectionProps) {
  return (
    <div className='space-y-1'>
      <h3 className='px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
        {section.title}
      </h3>
      <div className='space-y-0.5'>
        {section.items.map(item => (
          <SettingsNavItem key={item.href} item={item} />
        ))}
      </div>
    </div>
  );
}

interface SettingsNavItemProps {
  item: NavItem;
}

function SettingsNavItem({ item }: SettingsNavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === item.href;
  const Icon = iconMap[item.icon];

  if (!Icon) {
    return null;
  }

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all',
        'hover:bg-accent hover:text-accent-foreground',
        isActive
          ? 'bg-accent text-accent-foreground shadow-sm'
          : 'text-muted-foreground',
      )}
    >
      <Icon className={cn('h-4 w-4', isActive && 'text-primary')} />
      <span>{item.label}</span>
    </Link>
  );
}
