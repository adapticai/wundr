import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { Sidebar } from './components/sidebar';
import { AppHeader } from '@/components/layout/app-header';

export const metadata: Metadata = {
  title: 'Workspace',
  description: 'Manage your Genesis organization',
};

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <Sidebar user={session?.user} />

      {/* Mobile Header */}
      <MobileHeader />

      {/* Main Content */}
      <main className="flex-1 lg:pl-64">
        <div className="min-h-screen pt-16 lg:pt-0">
          {/* Desktop Header */}
          <div className="hidden lg:block">
            <AppHeader user={session?.user} />
          </div>
          <div className="container mx-auto p-6">{children}</div>
        </div>
      </main>
    </div>
  );
}

function MobileHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b bg-background px-4 lg:hidden">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          G
        </div>
        <span className="font-semibold">Genesis</span>
      </div>
      <button
        type="button"
        className="rounded-lg p-2 hover:bg-accent"
        aria-label="Open menu"
      >
        <MenuIcon />
      </button>
    </header>
  );
}

function MenuIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}
