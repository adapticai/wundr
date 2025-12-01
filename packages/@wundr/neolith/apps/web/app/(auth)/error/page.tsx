'use client';

import { Button } from '@neolith/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

/**
 * Error messages for different authentication error types.
 * Based on NextAuth.js error codes.
 */
const errorMessages: Record<string, { title: string; description: string }> = {
  Configuration: {
    title: 'Server Configuration Error',
    description:
      'There is a problem with the server configuration. Please contact support if this issue persists.',
  },
  AccessDenied: {
    title: 'Access Denied',
    description:
      'You do not have permission to sign in. Please contact your administrator.',
  },
  Verification: {
    title: 'Verification Error',
    description:
      'The verification link may have expired or already been used. Please try signing in again.',
  },
  OAuthSignin: {
    title: 'OAuth Sign-in Error',
    description:
      'There was a problem signing in with the selected provider. Please try again.',
  },
  OAuthCallback: {
    title: 'OAuth Callback Error',
    description:
      'There was a problem completing the authentication. Please try signing in again.',
  },
  OAuthCreateAccount: {
    title: 'Account Creation Error',
    description:
      'There was a problem creating your account with the selected provider. Please try again or use a different method.',
  },
  EmailCreateAccount: {
    title: 'Account Creation Error',
    description:
      'There was a problem creating your account. The email may already be in use.',
  },
  Callback: {
    title: 'Callback Error',
    description:
      'There was a problem with the authentication callback. Please try again.',
  },
  OAuthAccountNotLinked: {
    title: 'Account Not Linked',
    description:
      'This email is already associated with another account. Please sign in with the original provider.',
  },
  EmailSignin: {
    title: 'Email Sign-in Error',
    description:
      'There was a problem sending the sign-in email. Please check your email address and try again.',
  },
  CredentialsSignin: {
    title: 'Sign-in Failed',
    description:
      'The credentials you provided are incorrect. Please check your email and password and try again.',
  },
  SessionRequired: {
    title: 'Session Required',
    description:
      'You need to be signed in to access this page. Please sign in to continue.',
  },
  Default: {
    title: 'Authentication Error',
    description:
      'An unexpected error occurred during authentication. Please try again.',
  },
};

/**
 * Error content component that reads search params.
 */
function ErrorContent() {
  const searchParams = useSearchParams();
  const errorType = searchParams.get('error') || 'Default';
  const errorInfo = errorMessages[errorType] || errorMessages.Default;

  return (
    <div className='space-y-6'>
      {/* Error Icon */}
      <div className='flex justify-center'>
        <div className='flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            className='h-8 w-8 text-destructive'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
            strokeWidth={2}
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
            />
          </svg>
        </div>
      </div>

      {/* Error Message */}
      <div className='space-y-2 text-center'>
        <h2 className='text-2xl font-semibold tracking-tight text-destructive'>
          {errorInfo.title}
        </h2>
        <p className='text-sm text-muted-foreground'>{errorInfo.description}</p>
      </div>

      {/* Error Code (for debugging) */}
      {errorType !== 'Default' && (
        <div className='text-center'>
          <code className='rounded bg-muted px-2 py-1 text-xs text-muted-foreground'>
            Error code: {errorType}
          </code>
        </div>
      )}

      {/* Actions */}
      <div className='space-y-3'>
        <Link href='/login' className='block'>
          <Button className='w-full'>Try signing in again</Button>
        </Link>
        <Link href='/' className='block'>
          <Button variant='outline' className='w-full'>
            Go to homepage
          </Button>
        </Link>
      </div>

      {/* Help Link */}
      <p className='text-center text-sm text-muted-foreground'>
        Need help?{' '}
        <Link
          href='/support'
          className='font-medium text-primary hover:underline'
        >
          Contact support
        </Link>
      </p>
    </div>
  );
}

/**
 * Authentication error page component.
 *
 * Displays user-friendly error messages for various authentication
 * failures, including OAuth errors, credential errors, and session issues.
 *
 * Reads the error type from the URL search params and displays
 * an appropriate message with recovery options.
 */
export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className='space-y-6 text-center'>
          <div className='flex justify-center'>
            <div className='h-16 w-16 animate-pulse rounded-full bg-muted' />
          </div>
          <div className='space-y-2'>
            <div className='mx-auto h-6 w-48 animate-pulse rounded bg-muted' />
            <div className='mx-auto h-4 w-64 animate-pulse rounded bg-muted' />
          </div>
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}
