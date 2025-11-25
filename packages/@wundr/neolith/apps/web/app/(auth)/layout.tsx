import { Logo } from '@/components/ui/Logo';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Authentication',
  description: 'Sign in to your Neolith account',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className='flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-muted'>
      {/* Auth Container */}
      <div className='w-full max-w-md space-y-8 px-4'>
        {/* Logo */}
        <div className='flex flex-col items-center gap-2'>
          <Logo />
          <h1 className='text-2xl font-bold'>Neolith</h1>
        </div>

        {/* Auth Content */}
        <div className='rounded-xl border bg-card p-8 shadow-sm'>
          {children}
        </div>

        {/* Footer Links */}
        <div className='text-center text-sm text-muted-foreground'>
          <p>
            By continuing, you agree to our{' '}
            <a href='/terms' className='underline hover:text-foreground'>
              Terms of Service
            </a>{' '}
            and{' '}
            <a href='/privacy' className='underline hover:text-foreground'>
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
