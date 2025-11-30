/**
 * Settings Navigation Component
 * @module components/settings/settings-nav
 */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Settings,
  User,
  Bell,
  Shield,
  Palette,
  Plug,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Navigation item configuration
 */
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
  disabled?: boolean;
}

/**
 * Navigation section with header and items
 */
export interface NavSection {
  label: string;
  items: NavItem[];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

/**
 * Settings Navigation Props
 */
interface SettingsNavProps {
  workspaceId: string;
  sections?: NavSection[];
  className?: string;
}

/**
 * Desktop Settings Navigation
 */
export function SettingsNav({
  workspaceId,
  sections,
  className,
}: SettingsNavProps) {
  const pathname = usePathname();
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(
      sections
        ?.filter(section => section.defaultCollapsed)
        .map(section => section.label) || []
    )
  );

  const defaultSections: NavSection[] = [
    {
      label: 'Account',
      items: [
        { href: `/${workspaceId}/settings`, label: 'General', icon: Settings },
        {
          href: `/${workspaceId}/settings/profile`,
          label: 'Profile',
          icon: User,
        },
      ],
    },
    {
      label: 'Preferences',
      items: [
        {
          href: `/${workspaceId}/settings/appearance`,
          label: 'Appearance',
          icon: Palette,
        },
        {
          href: `/${workspaceId}/settings/notifications`,
          label: 'Notifications',
          icon: Bell,
          badge: 3,
        },
      ],
    },
    {
      label: 'Advanced',
      items: [
        {
          href: `/${workspaceId}/settings/integrations`,
          label: 'Integrations',
          icon: Plug,
        },
        {
          href: `/${workspaceId}/settings/security`,
          label: 'Security',
          icon: Shield,
        },
      ],
    },
  ];

  const navSections = sections || defaultSections;

  const toggleSection = (sectionLabel: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionLabel)) {
        next.delete(sectionLabel);
      } else {
        next.add(sectionLabel);
      }
      return next;
    });
  };

  return (
    <nav className={cn('flex flex-col space-y-6', className)}>
      {navSections.map((section, sectionIndex) => {
        const isCollapsed = collapsedSections.has(section.label);

        return (
          <div key={`${section.label}-${sectionIndex}`} className='space-y-1'>
            {section.collapsible ? (
              <button
                onClick={() => toggleSection(section.label)}
                className='flex w-full items-center justify-between px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground'
              >
                {section.label}
                {isCollapsed ? (
                  <ChevronRight className='h-4 w-4' />
                ) : (
                  <ChevronDown className='h-4 w-4' />
                )}
              </button>
            ) : (
              <div className='px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
                {section.label}
              </div>
            )}

            {!isCollapsed && (
              <div className='space-y-1'>
                {section.items.map(item => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;

                  if (item.disabled) {
                    return (
                      <div
                        key={item.href}
                        className='flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground/50 opacity-50'
                      >
                        <Icon className='h-4 w-4' />
                        <span className='flex-1'>{item.label}</span>
                        {item.badge && (
                          <span className='rounded-full bg-muted px-2 py-0.5 text-xs'>
                            {item.badge}
                          </span>
                        )}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      )}
                    >
                      <Icon className='h-4 w-4' />
                      <span className='flex-1'>{item.label}</span>
                      {item.badge && (
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs',
                            isActive
                              ? 'bg-primary-foreground/20 text-primary-foreground'
                              : 'bg-primary/10 text-primary'
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

/**
 * Mobile Settings Navigation Props
 */
interface MobileSettingsNavProps {
  workspaceId: string;
  sections?: NavSection[];
  className?: string;
}

/**
 * Mobile Settings Navigation (Horizontal Scrollable)
 */
export function MobileSettingsNav({
  workspaceId,
  sections,
  className,
}: MobileSettingsNavProps) {
  const pathname = usePathname();

  const defaultSections: NavSection[] = [
    {
      label: 'Account',
      items: [
        { href: `/${workspaceId}/settings`, label: 'General', icon: Settings },
        {
          href: `/${workspaceId}/settings/profile`,
          label: 'Profile',
          icon: User,
        },
      ],
    },
    {
      label: 'Preferences',
      items: [
        {
          href: `/${workspaceId}/settings/appearance`,
          label: 'Appearance',
          icon: Palette,
        },
        {
          href: `/${workspaceId}/settings/notifications`,
          label: 'Notifications',
          icon: Bell,
          badge: 3,
        },
      ],
    },
    {
      label: 'Advanced',
      items: [
        {
          href: `/${workspaceId}/settings/integrations`,
          label: 'Integrations',
          icon: Plug,
        },
        {
          href: `/${workspaceId}/settings/security`,
          label: 'Security',
          icon: Shield,
        },
      ],
    },
  ];

  const navSections = sections || defaultSections;

  // Flatten all items for horizontal scroll
  const allItems = navSections.flatMap(section => section.items);

  return (
    <nav
      className={cn(
        'flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent',
        className
      )}
    >
      {allItems.map(item => {
        const isActive = pathname === item.href;
        const Icon = item.icon;

        if (item.disabled) {
          return (
            <div
              key={item.href}
              className='relative flex shrink-0 flex-col items-center gap-1 rounded-lg px-4 py-2 text-muted-foreground/50 opacity-50'
            >
              <Icon className='h-5 w-5' />
              <span className='text-xs font-medium'>{item.label}</span>
              {item.badge && (
                <span className='absolute right-2 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[10px]'>
                  {item.badge}
                </span>
              )}
            </div>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'relative flex shrink-0 flex-col items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <Icon className='h-5 w-5' />
            <span className='text-xs'>{item.label}</span>
            {item.badge && (
              <span
                className={cn(
                  'absolute right-2 top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px]',
                  isActive
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-primary/10 text-primary'
                )}
              >
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
