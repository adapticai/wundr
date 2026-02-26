import { Logo } from '@/components/ui/Logo';
import { AppHeader } from '@/components/layout/app-header';
import { auth } from '@/lib/auth';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Workspaces — Neolith',
  description: 'Select or create a workspace to get started with Neolith.',
};

export default async function WorkspacesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className='min-h-screen flex flex-col bg-background'>
      <header className='border-b'>
        <div className='container mx-auto px-4 h-16 flex items-center justify-between'>
          <Logo className='h-5 text-foreground' />
          <AppHeader user={session?.user} compact />
        </div>
      </header>
      <main className='flex-1'>
        <div className='container mx-auto p-6'>{children}</div>
      </main>
    </div>
  );
}
