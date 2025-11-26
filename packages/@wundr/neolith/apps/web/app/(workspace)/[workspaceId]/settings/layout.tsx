import { prisma } from '@neolith/database';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { cn } from '@/lib/utils';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Manage your profile and workspace settings',
};

interface SettingsLayoutProps {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}

/**
 * Settings section layout with sidebar navigation
 */
export default async function SettingsLayout({
  children,
  params,
}: SettingsLayoutProps) {
  const { workspaceId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Verify user has access to this workspace
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId: session.user.id,
    },
  });

  if (!membership) {
    redirect('/dashboard');
  }

  const navItems = [
    { href: `/${workspaceId}/settings/profile`, label: 'Profile', icon: UserIcon },
    { href: `/${workspaceId}/settings/integrations`, label: 'Integrations', icon: PlugIcon },
    { href: `/${workspaceId}/settings/notifications`, label: 'Notifications', icon: BellIcon },
    { href: `/${workspaceId}/settings/security`, label: 'Security', icon: ShieldIcon },
  ];

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Settings Sidebar */}
      <aside className="hidden w-64 border-r bg-card lg:block">
        <div className="flex h-full flex-col">
          {/* Breadcrumb Header */}
          <div className="border-b px-4 py-3">
            <nav className="flex items-center gap-1 text-sm text-muted-foreground">
              <Link
                href={`/${workspaceId}/dashboard`}
                className="hover:text-foreground"
              >
                Workspace
              </Link>
              <ChevronRightIcon className="h-4 w-4" />
              <span className="font-medium text-foreground">Settings</span>
            </nav>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-3">
            {navItems.map((item) => (
              <SettingsNavItem
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
              />
            ))}
          </nav>

          {/* Footer */}
          <div className="border-t p-4">
            <p className="text-xs text-muted-foreground">
              Changes are saved automatically.
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile Navigation */}
      <MobileSettingsNav workspaceId={workspaceId} navItems={navItems} />

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-6">{children}</div>
      </main>
    </div>
  );
}

interface NavItemProps {
  href: string;
  label: string;
  icon: React.FC<{ className?: string }>;
}

function SettingsNavItem({ href, label, icon: Icon }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
        'text-muted-foreground hover:bg-accent hover:text-foreground',
        'transition-colors',
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

interface MobileSettingsNavProps {
  workspaceId: string;
  navItems: NavItemProps[];
}

function MobileSettingsNav({ workspaceId: _workspaceId, navItems }: MobileSettingsNavProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background lg:hidden">
      <nav className="flex justify-around px-2 py-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-1 rounded-lg p-2 text-muted-foreground hover:text-foreground"
          >
            <item.icon className="h-5 w-5" />
            <span className="text-xs">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

// Icons
function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function PlugIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 22v-5" />
      <path d="M9 8V2" />
      <path d="M15 8V2" />
      <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
