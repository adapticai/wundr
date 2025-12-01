'use client';

import { AppHeader } from '@/components/layout/app-header';
import { DynamicPageHeader } from '@/components/layout/dynamic-page-header';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { PageHeaderProvider } from '@/contexts/page-header-context';

interface WorkspaceLayoutClientProps {
  children: React.ReactNode;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
}

export function WorkspaceLayoutClient({
  children,
  user,
}: WorkspaceLayoutClientProps) {
  return (
    <PageHeaderProvider>
      <SidebarInset>
        <header className='flex h-16 shrink-0 items-center gap-2 border-b px-4'>
          <SidebarTrigger className='-ml-1' />
          <Separator orientation='vertical' className='mr-2 h-4' />
          <DynamicPageHeader />
          <div className='ml-auto'>
            <AppHeader user={user} compact />
          </div>
        </header>
        <main className='flex-1'>
          <div className='container mx-auto p-6'>{children}</div>
        </main>
      </SidebarInset>
    </PageHeaderProvider>
  );
}
