'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';

/**
 * Props for the AdminSidebar component.
 */
export interface AdminSidebarProps {
  /** The current navigation path for highlighting active items */
  currentPath: string;
  /** The workspace ID for building navigation URLs */
  workspaceId: string;
  /** Callback when a navigation item is clicked */
  onNavigate: (path: string) => void;
  /** Additional CSS classes to apply */
  className?: string;
}

interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
}

const NAV_SECTIONS: NavSection[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      {
        id: 'general',
        label: 'General Settings',
        path: '/admin/settings',
        icon: <SettingsIcon className="h-4 w-4" />,
      },
      {
        id: 'security',
        label: 'Security',
        path: '/admin/security',
        icon: <ShieldIcon className="h-4 w-4" />,
      },
    ],
  },
  {
    id: 'people',
    label: 'People',
    items: [
      {
        id: 'members',
        label: 'Members',
        path: '/admin/members',
        icon: <UsersIcon className="h-4 w-4" />,
      },
      {
        id: 'roles',
        label: 'Roles',
        path: '/admin/roles',
        icon: <BadgeIcon className="h-4 w-4" />,
      },
    ],
  },
  {
    id: 'automation',
    label: 'Automation',
    items: [
      {
        id: 'integrations',
        label: 'Integrations',
        path: '/admin/integrations',
        icon: <PlugIcon className="h-4 w-4" />,
      },
      {
        id: 'workflows',
        label: 'Workflows',
        path: '/admin/workflows',
        icon: <WorkflowIcon className="h-4 w-4" />,
      },
    ],
  },
  {
    id: 'billing',
    label: 'Account',
    items: [
      {
        id: 'billing',
        label: 'Billing',
        path: '/admin/billing',
        icon: <CreditCardIcon className="h-4 w-4" />,
      },
      {
        id: 'activity',
        label: 'Activity Log',
        path: '/admin/activity',
        icon: <ActivityIcon className="h-4 w-4" />,
      },
    ],
  },
];

export function AdminSidebar({
  currentPath,
  workspaceId,
  onNavigate,
  className,
}: AdminSidebarProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const isActive = (path: string) => {
    return currentPath === path || currentPath.startsWith(path + '/');
  };

  return (
    <nav
      className={cn(
        'w-64 h-full border-r border-border bg-card overflow-y-auto',
        className,
      )}
      aria-label="Admin navigation"
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">Admin Console</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Workspace settings</p>
      </div>

      {/* Navigation sections */}
      <div className="p-2">
        {NAV_SECTIONS.map((section) => {
          const isCollapsed = collapsedSections.has(section.id);

          return (
            <div key={section.id} className="mb-2">
              {/* Section header */}
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className={cn(
                  'flex w-full items-center justify-between px-3 py-2',
                  'text-xs font-semibold uppercase tracking-wider',
                  'text-muted-foreground hover:text-foreground',
                  'transition-colors rounded-md',
                )}
                aria-expanded={!isCollapsed}
              >
                {section.label}
                <ChevronIcon
                  className={cn(
                    'h-3 w-3 transition-transform',
                    isCollapsed ? '-rotate-90' : '',
                  )}
                />
              </button>

              {/* Section items */}
              {!isCollapsed && (
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = isActive(item.path);
                    const fullPath = `/${workspaceId}${item.path}`;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onNavigate(fullPath)}
                        className={cn(
                          'flex w-full items-center gap-3 px-3 py-2 rounded-md',
                          'text-sm font-medium transition-colors',
                          active
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                        )}
                        aria-current={active ? 'page' : undefined}
                      >
                        {item.icon}
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

// Icon components
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function BadgeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
    </svg>
  );
}

function PlugIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22v-5" />
      <path d="M9 8V2" />
      <path d="M15 8V2" />
      <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
    </svg>
  );
}

function WorkflowIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="8" height="8" x="3" y="3" rx="2" />
      <path d="M7 11v4a2 2 0 0 0 2 2h4" />
      <rect width="8" height="8" x="13" y="13" rx="2" />
    </svg>
  );
}

function CreditCardIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default AdminSidebar;
