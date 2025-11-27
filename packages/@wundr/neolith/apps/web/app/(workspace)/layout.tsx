import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { AppHeader } from '@/components/layout/app-header';
import { GlobalSearchBar } from '@/components/layout/global-search-bar';
import { WorkspaceSidebar } from '@/components/workspace';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { PageHeaderProvider } from '@/contexts/page-header-context';
import { DynamicPageHeader } from '@/components/layout/dynamic-page-header';
import { auth } from '@/lib/auth';
import { prisma } from '@neolith/database';

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
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <DynamicPageHeader />
            <GlobalSearchBar />
            <div className="ml-auto">
              <AppHeader user={session?.user} compact />
            </div>
          </header>
          <main className="flex-1">
            <div className="container mx-auto p-6">{children}</div>
          </main>
        </PageHeaderProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
