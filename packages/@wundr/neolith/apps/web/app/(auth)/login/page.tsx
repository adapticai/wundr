'use client';

import { Button, Input, Label } from '@neolith/ui';
import { Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Suspense, useState } from 'react';

import { GitHubIcon, GoogleIcon } from '../../../components/icons';

/**
 * Loading fallback for the login form
 */
function LoginFormLoading() {
  return (
    <div className='space-y-6'>
      <div className='space-y-2 text-center'>
        <h2 className='text-2xl font-semibold tracking-tight'>Welcome back</h2>
        <p className='text-sm text-muted-foreground'>Loading...</p>
      </div>
      <div className='space-y-3'>
        <div className='h-10 w-full animate-pulse rounded-md bg-muted' />
        <div className='h-10 w-full animate-pulse rounded-md bg-muted' />
      </div>
      <div className='h-px w-full bg-muted' />
      <div className='space-y-4'>
        <div className='h-10 w-full animate-pulse rounded-md bg-muted' />
        <div className='h-10 w-full animate-pulse rounded-md bg-muted' />
        <div className='h-10 w-full animate-pulse rounded-md bg-muted' />
      </div>
    </div>
  );
}

/**
 * Login form component that uses useSearchParams
 */
function LoginForm() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Determine callback URL based on invite token
  const callbackUrl = inviteToken ? `/invite/${inviteToken}` : '/dashboard';

  /**
   * Handles OAuth sign-in with the specified provider.
   * @param provider - OAuth provider name (e.g., 'github', 'google')
   */
  const handleOAuthSignIn = async (provider: string) => {
    setIsLoading(true);
    setError('');
    try {
      await signIn(provider, { callbackUrl });
    } catch {
      // Error will be handled by NextAuth error page
      setIsLoading(false);
    }
  };

  /**
   * Handles email/password form submission.
   */
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Incorrect email or password. Please try again.');
        setIsLoading(false);
      } else if (result?.ok) {
        window.location.href = callbackUrl;
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className='space-y-6'>
      {/* Page Header */}
      <div className='space-y-2 text-center'>
        <h2 className='text-2xl font-semibold tracking-tight'>Welcome back</h2>
        <p className='text-sm text-muted-foreground'>
          {inviteToken
            ? 'Sign in to accept your workspace invitation'
            : 'Sign in to your account to continue'}
        </p>
      </div>

      {/* OAuth Providers */}
      <div className='space-y-3'>
        <Button
          variant='outline'
          size='lg'
          className='w-full'
          onClick={() => handleOAuthSignIn('github')}
          disabled={isLoading}
          aria-label='Continue with GitHub'
        >
          <GitHubIcon className='mr-2 h-5 w-5' aria-hidden='true' />
          Continue with GitHub
        </Button>

        <Button
          variant='outline'
          size='lg'
          className='w-full'
          onClick={() => handleOAuthSignIn('google')}
          disabled={isLoading}
          aria-label='Continue with Google'
        >
          <GoogleIcon className='mr-2 h-5 w-5' aria-hidden='true' />
          Continue with Google
        </Button>
      </div>

      {/* Divider */}
      <div className='relative' role='separator' aria-hidden='true'>
        <div className='absolute inset-0 flex items-center'>
          <span className='w-full border-t border-border' />
        </div>
        <div className='relative flex justify-center text-xs uppercase'>
          <span className='bg-card px-2 text-muted-foreground'>
            Or continue with email
          </span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div
          role='alert'
          aria-live='polite'
          className='rounded-md bg-destructive/10 p-3 text-sm text-destructive'
        >
          {error}
        </div>
      )}

      {/* Email/Password Form */}
      <form onSubmit={handleEmailSignIn} className='space-y-4' noValidate>
        <div className='space-y-2'>
          <Label htmlFor='email'>Email address</Label>
          <Input
            id='email'
            type='email'
            placeholder='you@example.com'
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setEmail(e.target.value)
            }
            disabled={isLoading}
            autoComplete='email'
            required
          />
        </div>
        <div className='space-y-2'>
          <div className='flex items-center justify-between'>
            <Label htmlFor='password'>Password</Label>
            <Link
              href='/forgot-password'
              className='text-xs text-muted-foreground hover:text-primary transition-colors'
              tabIndex={0}
            >
              Forgot password?
            </Link>
          </div>
          <div className='relative'>
            <Input
              id='password'
              type={showPassword ? 'text' : 'password'}
              placeholder='Enter your password'
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setPassword(e.target.value)
              }
              disabled={isLoading}
              autoComplete='current-password'
              required
              className='pr-10'
            />
            <button
              type='button'
              onClick={() => setShowPassword(!showPassword)}
              className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors'
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className='h-4 w-4' aria-hidden='true' />
              ) : (
                <Eye className='h-4 w-4' aria-hidden='true' />
              )}
            </button>
          </div>
        </div>
        <Button type='submit' className='w-full' disabled={isLoading}>
          {isLoading ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>

      {/* Register Link */}
      <p className='text-center text-sm text-muted-foreground'>
        Don&apos;t have an account?{' '}
        <Link
          href='/register'
          className='font-medium text-primary hover:underline'
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}

/**
 * Login page component for user authentication.
 *
 * Provides multiple authentication methods:
 * - OAuth providers (GitHub, Google)
 * - Email/password credentials
 *
 * Supports invitation flow via ?invite=token query parameter.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormLoading />}>
      <LoginForm />
    </Suspense>
  );
}
