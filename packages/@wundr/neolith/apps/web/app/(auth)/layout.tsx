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
    <div className='flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-stone-950 to-stone-900'>
      {/* Auth Container */}
      <div className='w-full max-w-md space-y-8 px-4'>
        {/* Logo */}
        <div className='flex justify-center'>
          <Logo className='h-12 w-auto text-stone-100' />
        </div>

        {/* Auth Content */}
        <div className='rounded-xl border border-stone-800 bg-stone-900 p-8 shadow-lg'>
          {children}
        </div>

        {/* Footer Links */}
        <div className='text-center text-sm text-stone-500'>
          <p>
            By continuing, you agree to our{' '}
            <a href='/terms' className='underline hover:text-stone-300'>
              Terms of Service
            </a>{' '}
            and{' '}
            <a href='/privacy' className='underline hover:text-stone-300'>
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
