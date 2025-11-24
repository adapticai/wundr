import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Authentication',
  description: 'Sign in to your Genesis account',
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
          <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-2xl font-bold text-primary-foreground'>
            G
          </div>
          <h1 className='text-2xl font-bold'>Genesis</h1>
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
