import { prisma } from '@neolith/database';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { cn } from '@/lib/utils';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Console',
  description: 'Manage your workspace settings, members, roles, and billing',
};

interface AdminLayoutProps {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}

/**
 * Admin section layout with sidebar navigation and admin-only access check
 */
export default async function AdminLayout({
  children,
  params,
}: AdminLayoutProps) {
  const { workspaceId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Check if user is admin or owner of this workspace
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId: session.user.id,
    },
  });

  if (!membership || !['admin', 'owner'].includes(membership.role)) {
    redirect(`/${workspaceId}/dashboard`);
  }

  const navItems = [
    { href: `/${workspaceId}/admin`, label: 'Overview', icon: DashboardIcon },
    { href: `/${workspaceId}/admin/settings`, label: 'Settings', icon: SettingsIcon },
    { href: `/${workspaceId}/admin/members`, label: 'Members', icon: UsersIcon },
    { href: `/${workspaceId}/admin/roles`, label: 'Roles', icon: ShieldIcon },
    { href: `/${workspaceId}/admin/billing`, label: 'Billing', icon: CreditCardIcon },
    { href: `/${workspaceId}/admin/activity`, label: 'Activity', icon: ActivityIcon },
    { href: `/${workspaceId}/admin/vp-health`, label: 'VP Health', icon: HeartPulseIcon },
  ];

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Admin Sidebar */}
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
              <span className="font-medium text-foreground">Admin</span>
            </nav>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-3">
            {navItems.map((item) => (
              <AdminNavItem
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
              Admin access is logged for security purposes.
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile Navigation */}
      <MobileAdminNav workspaceId={workspaceId} navItems={navItems} />

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

function AdminNavItem({ href, label, icon: Icon }: NavItemProps) {
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

interface MobileAdminNavProps {
  workspaceId: string;
  navItems: NavItemProps[];
}

function MobileAdminNav({ workspaceId: _workspaceId, navItems }: MobileAdminNavProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background lg:hidden">
      <nav className="flex justify-around px-2 py-2">
        {navItems.slice(0, 5).map((item) => (
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
function DashboardIcon({ className }: { className?: string }) {
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
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
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
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
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
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
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

function CreditCardIcon({ className }: { className?: string }) {
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
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}

function ActivityIcon({ className }: { className?: string }) {
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
      <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
    </svg>
  );
}

function HeartPulseIcon({ className }: { className?: string }) {
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
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      <path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />
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
