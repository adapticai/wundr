import { prisma } from '@neolith/database';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { AppHeader } from '@/components/layout/app-header';
import { GlobalSearchBar } from '@/components/layout/global-search-bar';
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { WorkspaceSidebar } from '@/components/workspace';
import { PageHeaderProvider } from '@/contexts/page-header-context';
import { auth } from '@/lib/auth';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Workspace',
  description: 'Manage your Neolith organization',
};

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get('sidebar_state')?.value === 'true';

  // Redirect to login if not authenticated
  if (!session?.user?.id) {
    redirect('/login');
  }

  // Check if user has any workspaces
  const workspaceCount = await prisma.workspaceMember.count({
    where: {
      userId: session.user.id,
    },
  });

  // Redirect to workspace creation if user has no workspaces
  if (workspaceCount === 0) {
    redirect('/workspaces/new');
  }

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <WorkspaceSidebar user={session?.user} />
      <SidebarInset>
        <PageHeaderProvider>
          {/* Draggable region for Electron window - aligns with sidebar traffic light spacer */}
          <header className='flex h-14 shrink-0 items-center gap-2 border-b px-4'>
            <SidebarTrigger className='-ml-1' />
            <div className='flex-1 flex justify-center'>
              <GlobalSearchBar className='w-full max-w-3xl' />
            </div>
            <AppHeader user={session?.user} compact />
          </header>
          <main className='flex-1 overflow-auto'>{children}</main>
        </PageHeaderProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
