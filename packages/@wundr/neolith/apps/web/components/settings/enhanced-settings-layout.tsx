'use client';

import {
  ArrowLeft,
  Bell,
  ChevronDown,
  Eye,
  Globe,
  Keyboard,
  Lock,
  Menu,
  Palette,
  RotateCcw,
  Save,
  Settings,
  Shield,
  User,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { QuickSettingsModal } from './quick-settings-modal';
import { SettingsHeader } from './settings-header';

import type {
  NavSection,
  NavItem,
} from '../../app/(workspace)/[workspaceSlug]/settings/layout';

interface EnhancedSettingsLayoutProps {
  children: React.ReactNode;
  workspaceSlug: string;
  workspaceName: string;
  sections: NavSection[];
  pageTitle?: string;
  pageDescription?: string;
  showQuickActions?: boolean;
  onSave?: () => Promise<void>;
  onReset?: () => void;
  isSaving?: boolean;
  hasUnsavedChanges?: boolean;
}

const iconMap: Record<string, LucideIcon> = {
  User,
  Shield,
  Lock,
  Settings,
  Bell,
  Palette,
  Eye,
  Globe,
  Keyboard,
};

export function EnhancedSettingsLayout({
  children,
  workspaceSlug,
  workspaceName,
  sections,
  pageTitle,
  pageDescription,
  showQuickActions = false,
  onSave,
  onReset,
  isSaving = false,
  hasUnsavedChanges = false,
}: EnhancedSettingsLayoutProps) {
  const [quickSettingsOpen, setQuickSettingsOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set()
  );

  const toggleSection = (sectionTitle: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionTitle)) {
        next.delete(sectionTitle);
      } else {
        next.add(sectionTitle);
      }
      return next;
    });
  };

  return (
    <TooltipProvider>
      <div className='flex min-h-screen bg-background'>
        {/* Desktop Sidebar */}
        <aside className='hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:border-r lg:bg-muted/30'>
          <SettingsSidebar
            workspaceSlug={workspaceSlug}
            workspaceName={workspaceName}
            sections={sections}
            collapsedSections={collapsedSections}
            onToggleSection={toggleSection}
            onQuickSettings={() => setQuickSettingsOpen(true)}
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

            <div className='flex items-center gap-2'>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={() => setQuickSettingsOpen(true)}
                  >
                    <Zap className='h-5 w-5' />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Quick Settings</TooltipContent>
              </Tooltip>

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
                    collapsedSections={collapsedSections}
                    onToggleSection={toggleSection}
                    onQuickSettings={() => setQuickSettingsOpen(true)}
                  />
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className='flex-1 lg:pl-64'>
          <div className='pt-14 lg:pt-0'>
            <div className='mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8'>
              {/* Page Header with Breadcrumb */}
              {pageTitle && (
                <SettingsHeader
                  workspaceSlug={workspaceSlug}
                  title={pageTitle}
                  description={pageDescription}
                />
              )}

              {/* Quick Actions Bar */}
              {showQuickActions && (onSave || onReset) && (
                <div className='flex items-center justify-between border-b pb-4 mb-6'>
                  <div className='flex items-center gap-2'>
                    {hasUnsavedChanges && (
                      <span className='text-sm text-amber-600 dark:text-amber-500 font-medium'>
                        Unsaved changes
                      </span>
                    )}
                  </div>
                  <div className='flex items-center gap-2'>
                    {onReset && (
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={onReset}
                        disabled={!hasUnsavedChanges || isSaving}
                      >
                        <RotateCcw className='h-4 w-4 mr-2' />
                        Reset
                      </Button>
                    )}
                    {onSave && (
                      <Button
                        size='sm'
                        onClick={onSave}
                        disabled={!hasUnsavedChanges || isSaving}
                      >
                        <Save className='h-4 w-4 mr-2' />
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Page Content */}
              <div className='space-y-6'>{children}</div>
            </div>
          </div>
        </main>

        <QuickSettingsModal
          open={quickSettingsOpen}
          onOpenChange={setQuickSettingsOpen}
        />
      </div>
    </TooltipProvider>
  );
}

interface SettingsSidebarProps {
  workspaceSlug: string;
  workspaceName: string;
  sections: NavSection[];
  collapsedSections: Set<string>;
  onToggleSection: (sectionTitle: string) => void;
  onQuickSettings: () => void;
}

function SettingsSidebar({
  workspaceSlug,
  workspaceName,
  sections,
  collapsedSections,
  onToggleSection,
  onQuickSettings,
}: SettingsSidebarProps) {
  return (
    <div className='flex h-full flex-col'>
      {/* Header */}
      <div className='flex h-14 items-center justify-between border-b px-6'>
        <h2 className='text-lg font-semibold tracking-tight'>Settings</h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='ghost'
              size='icon'
              className='h-8 w-8'
              onClick={onQuickSettings}
            >
              <Zap className='h-4 w-4' />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Quick Settings (⌘,)</TooltipContent>
        </Tooltip>
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
      <ScrollArea className='flex-1 px-3 py-4'>
        <nav className='space-y-6'>
          {sections.map(section => (
            <SettingsNavSection
              key={section.title}
              section={section}
              isCollapsed={collapsedSections.has(section.title)}
              onToggle={() => onToggleSection(section.title)}
            />
          ))}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className='border-t px-4 py-4'>
        <div className='space-y-2'>
          <p className='text-xs text-muted-foreground'>
            Changes are saved automatically
          </p>
          <div className='flex flex-wrap gap-1 text-xs text-muted-foreground'>
            <kbd className='px-1.5 py-0.5 rounded bg-muted border'>⌘K</kbd>
            <span>to search</span>
            <kbd className='px-1.5 py-0.5 rounded bg-muted border'>⌘,</kbd>
            <span>quick settings</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SettingsNavSectionProps {
  section: NavSection;
  isCollapsed: boolean;
  onToggle: () => void;
}

function SettingsNavSection({
  section,
  isCollapsed,
  onToggle,
}: SettingsNavSectionProps) {
  return (
    <div className='space-y-1'>
      <button
        onClick={onToggle}
        className='flex w-full items-center justify-between px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors group'
      >
        <span>{section.title}</span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 transition-transform duration-200',
            isCollapsed && '-rotate-90'
          )}
        />
      </button>
      {!isCollapsed && (
        <div className='space-y-0.5'>
          {section.items.map(item => (
            <SettingsNavItem key={item.href} item={item} />
          ))}
        </div>
      )}
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
          : 'text-muted-foreground'
      )}
    >
      <Icon className={cn('h-4 w-4', isActive && 'text-primary')} />
      <span>{item.label}</span>
    </Link>
  );
}
