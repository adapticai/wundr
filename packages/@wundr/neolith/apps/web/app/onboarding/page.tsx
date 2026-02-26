/**
 * Onboarding Page
 *
 * New user onboarding flow using the Organization Genesis Wizard.
 * Creates an organization and workspace for the user.
 *
 * @module app/onboarding/page
 */

import { redirect } from 'next/navigation';

import { OrgGenesisWizard } from '@/components/org-genesis';
import { Logo } from '@/components/ui/Logo';
import { auth } from '@/lib/auth';

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Get started — Neolith',
  description:
    'Set up your organization and workspace to get started with Neolith.',
};

export default async function OnboardingPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  return (
    <div className='flex min-h-screen flex-col bg-stone-950'>
      <header className='border-b border-stone-800 px-6 py-4'>
        <div className='mx-auto flex max-w-4xl items-center justify-between'>
          <Logo className='h-6 text-stone-100' />
          <div className='flex items-center gap-2 text-sm text-stone-400'>
            <span>Signed in as</span>
            <span className='font-medium text-stone-200'>
              {session.user.email}
            </span>
          </div>
        </div>
      </header>

      <main className='flex flex-1 flex-col items-center justify-center px-6 py-12'>
        <div className='w-full max-w-4xl'>
          <div className='mb-8 text-center'>
            <h1 className='text-3xl font-bold text-stone-100'>
              Welcome to Neolith
            </h1>
            <p className='mt-2 text-stone-400'>
              Let&apos;s create your organization and first workspace. This only
              takes a couple of minutes.
            </p>
          </div>

          <OrgGenesisWizard />
        </div>
      </main>

      <footer className='border-t border-stone-800 px-6 py-4'>
        <div className='mx-auto max-w-4xl text-center text-sm text-stone-500'>
          <p>
            Need help?{' '}
            <a
              href='mailto:support@neolith.ai'
              className='text-stone-400 underline-offset-4 hover:text-stone-200 hover:underline'
            >
              Contact support
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
