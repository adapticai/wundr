'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Hash,
  Users,
  UserCog,
  Mail,
  Plug,
  Webhook,
  Key,
  Shield,
  FileText,
  CreditCard,
  Wallet,
  Menu,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';

import type { NavSection, NavItem } from './layout';

interface AdminSettingsLayoutClientProps {
  children: React.ReactNode;
  workspaceSlug: string;
  workspaceName: string;
  workspaceIcon?: string | null;
  userRole: string;
  memberCount: number;
  channelCount: number;
  sections: NavSection[];
}

const iconMap: Record<string, LucideIcon> = {
  Building2,
  Hash,
  Users,
  UserCog,
  Mail,
  Plug,
  Webhook,
  Key,
  Shield,
  FileText,
  CreditCard,
  Wallet,
};

export function AdminSettingsLayoutClient({
  children,
  workspaceSlug,
  workspaceName,
  workspaceIcon,
  userRole,
  memberCount,
  channelCount,
  sections,
}: AdminSettingsLayoutClientProps) {
  // The main workspace sidebar is auto-collapsed when in admin routes (width: 5.5rem)
  // We position our settings sidebar after that collapsed sidebar
  return (
    <div className='flex min-h-screen bg-background'>
      {/* Desktop Sidebar - positioned after the collapsed main sidebar */}
      <aside className='hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:left-[5.5rem] lg:border-r lg:bg-muted/30 lg:z-10'>
        <AdminSettingsSidebar
          workspaceSlug={workspaceSlug}
          workspaceName={workspaceName}
          workspaceIcon={workspaceIcon}
          userRole={userRole}
          memberCount={memberCount}
          channelCount={channelCount}
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
              <AdminSettingsSidebar
                workspaceSlug={workspaceSlug}
                workspaceName={workspaceName}
                workspaceIcon={workspaceIcon}
                userRole={userRole}
                memberCount={memberCount}
                channelCount={channelCount}
                sections={sections}
              />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main Content - account for both collapsed main sidebar (5.5rem) + settings sidebar (16rem) */}
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

interface AdminSettingsSidebarProps {
  workspaceSlug: string;
  workspaceName: string;
  workspaceIcon?: string | null;
  userRole: string;
  memberCount: number;
  channelCount: number;
  sections: NavSection[];
}

function AdminSettingsSidebar({
  workspaceSlug,
  workspaceName,
  workspaceIcon,
  userRole,
  memberCount,
  channelCount,
  sections,
}: AdminSettingsSidebarProps) {
  return (
    <div className='flex h-full flex-col'>
      {/* Header */}
      <div className='flex h-14 items-center justify-between border-b px-6'>
        <h2 className='text-lg font-semibold tracking-tight'>
          Workspace Settings
        </h2>
      </div>

      {/* Back to Workspace Link with Icon */}
      <div className='border-b px-4 py-3'>
        <Link
          href={`/${workspaceSlug}/dashboard`}
          className='flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group'
        >
          <ArrowLeft className='h-4 w-4 transition-transform group-hover:-translate-x-0.5' />
          <div className='flex items-center gap-2 flex-1 min-w-0'>
            {workspaceIcon ? (
              <div className='h-5 w-5 rounded flex-shrink-0 overflow-hidden'>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={workspaceIcon}
                  alt=''
                  className='h-full w-full object-cover'
                />
              </div>
            ) : (
              <div className='h-5 w-5 rounded bg-primary/10 flex items-center justify-center flex-shrink-0'>
                <span className='text-xs font-semibold text-primary'>
                  {workspaceName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <span className='truncate'>{workspaceName}</span>
          </div>
        </Link>

        {/* Admin Badge */}
        <div className='mt-2 flex items-center gap-2'>
          <Badge
            variant={userRole === 'OWNER' ? 'default' : 'secondary'}
            className='text-xs'
          >
            {userRole === 'OWNER' ? 'Owner' : 'Admin'}
          </Badge>
        </div>
      </div>

      {/* Workspace Quick Stats */}
      <div className='border-b px-4 py-3 bg-muted/50'>
        <div className='space-y-1 text-xs'>
          <div className='flex justify-between'>
            <span className='text-muted-foreground'>Members:</span>
            <span className='font-medium'>{memberCount}</span>
          </div>
          <div className='flex justify-between'>
            <span className='text-muted-foreground'>Channels:</span>
            <span className='font-medium'>{channelCount}</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className='flex-1 overflow-y-auto px-3 py-4'>
        <div className='space-y-6'>
          {sections.map(section => (
            <AdminSettingsNavSection key={section.title} section={section} />
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

interface AdminSettingsNavSectionProps {
  section: NavSection;
}

function AdminSettingsNavSection({ section }: AdminSettingsNavSectionProps) {
  return (
    <div className='space-y-1'>
      <h3 className='px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
        {section.title}
      </h3>
      <div className='space-y-0.5'>
        {section.items.map(item => (
          <AdminSettingsNavItem key={item.href} item={item} />
        ))}
      </div>
    </div>
  );
}

interface AdminSettingsNavItemProps {
  item: NavItem;
}

function AdminSettingsNavItem({ item }: AdminSettingsNavItemProps) {
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
          : 'text-muted-foreground'
      )}
    >
      <Icon className={cn('h-4 w-4', isActive && 'text-primary')} />
      <span>{item.label}</span>
    </Link>
  );
}
