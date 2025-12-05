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
        <div className='h-12 w-full animate-pulse rounded-md bg-muted' />
        <div className='h-12 w-full animate-pulse rounded-md bg-muted' />
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
        setError('Invalid email or password');
        setIsLoading(false);
      } else if (result?.ok) {
        // Redirect based on invite token or default to dashboard
        window.location.href = callbackUrl;
      }
    } catch {
      setError('An error occurred. Please try again.');
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
        >
          <GitHubIcon className='mr-2 h-5 w-5' />
          Continue with GitHub
        </Button>

        <Button
          variant='outline'
          size='lg'
          className='w-full'
          onClick={() => handleOAuthSignIn('google')}
          disabled={isLoading}
        >
          <GoogleIcon className='mr-2 h-5 w-5' />
          Continue with Google
        </Button>
      </div>

      {/* Divider */}
      <div className='relative'>
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
      <form onSubmit={handleEmailSignIn} className='space-y-4'>
        <div className='space-y-2'>
          <Label htmlFor='email'>Email</Label>
          <Input
            id='email'
            type='email'
            placeholder='Enter your email'
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setEmail(e.target.value)
            }
            disabled={isLoading}
            autoComplete='email'
            required
            aria-label='Email address'
          />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='password'>Password</Label>
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
              aria-label='Password'
            />
            <button
              type='button'
              onClick={() => setShowPassword(!showPassword)}
              className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className='h-4 w-4' />
              ) : (
                <Eye className='h-4 w-4' />
              )}
            </button>
          </div>
        </div>
        <Button type='submit' className='w-full' disabled={isLoading}>
          {isLoading ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>

      {/* Forgot Password Link */}
      <div className='text-center'>
        <Link
          href='/forgot-password'
          className='text-sm text-muted-foreground hover:text-primary transition-colors'
        >
          Forgot your password?
        </Link>
      </div>

      {/* Register Link */}
      <p className='text-center text-sm text-muted-foreground'>
        Don&apos;t have an account?{' '}
        <Link
          href='/register'
          className='font-medium text-primary hover:underline'
        >
          Sign up
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
 * - Email/password form (for future implementation)
 *
 * Features a modern, responsive design with dark mode support.
 * Supports invitation flow via ?invite=token query parameter.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormLoading />}>
      <LoginForm />
    </Suspense>
  );
}
