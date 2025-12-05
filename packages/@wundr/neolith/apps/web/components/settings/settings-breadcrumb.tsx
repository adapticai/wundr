'use client';

import { ChevronRight, Home, Settings as SettingsIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

interface SettingsBreadcrumbProps {
  workspaceSlug: string;
}

interface BreadcrumbSegment {
  label: string;
  href?: string;
}

export function SettingsBreadcrumb({ workspaceSlug }: SettingsBreadcrumbProps) {
  const pathname = usePathname();

  const breadcrumbs = useMemo(() => {
    const segments: BreadcrumbSegment[] = [
      { label: 'Home', href: `/${workspaceSlug}/dashboard` },
      { label: 'Settings', href: `/${workspaceSlug}/settings` },
    ];

    // Parse the pathname to extract the current settings page
    const settingsMatch = pathname.match(/\/settings\/([^/]+)/);
    if (settingsMatch) {
      const page = settingsMatch[1];
      const pageLabels: Record<string, string> = {
        profile: 'Profile',
        security: 'Security',
        privacy: 'Privacy & Data',
        'workspace-preferences': 'Workspace Preferences',
        notifications: 'Notifications',
        appearance: 'Appearance',
        accessibility: 'Accessibility',
        language: 'Language & Region',
        'keyboard-shortcuts': 'Keyboard Shortcuts',
        integrations: 'Integrations',
        'connected-apps': 'Connected Apps',
        email: 'Email Preferences',
      };

      if (pageLabels[page]) {
        segments.push({ label: pageLabels[page] });
      }
    }

    return segments;
  }, [pathname, workspaceSlug]);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbs.map((segment, index) => {
          const isLast = index === breadcrumbs.length - 1;
          const isFirst = index === 0;

          return (
            <div key={segment.href || segment.label} className="flex items-center">
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{segment.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link
                      href={segment.href!}
                      className="flex items-center gap-1.5"
                    >
                      {isFirst && <Home className="h-3.5 w-3.5" />}
                      {index === 1 && <SettingsIcon className="h-3.5 w-3.5" />}
                      <span>{segment.label}</span>
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </div>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
