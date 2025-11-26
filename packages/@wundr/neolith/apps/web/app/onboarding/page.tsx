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
import { auth } from '@/lib/auth';

export const metadata = {
  title: 'Welcome to Neolith - Create Your Organization',
  description: 'Set up your organization and workspace to get started with Neolith.',
};

export default async function OnboardingPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen flex-col bg-stone-950">
      <header className="border-b border-stone-800 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
              <span className="text-sm font-bold text-white">N</span>
            </div>
            <span className="text-lg font-semibold text-stone-100">Neolith</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-stone-400">
            <span>Signed in as</span>
            <span className="font-medium text-stone-200">{session.user.email}</span>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-4xl">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-stone-100">Welcome to Neolith</h1>
            <p className="mt-2 text-stone-400">
              Let&apos;s set up your organization and get you started with AI-powered collaboration.
            </p>
          </div>

          <OrgGenesisWizard />
        </div>
      </main>

      <footer className="border-t border-stone-800 px-6 py-4">
        <div className="mx-auto max-w-4xl text-center text-sm text-stone-500">
          <p>Need help? Contact support@neolith.ai</p>
        </div>
      </footer>
    </div>
  );
}
