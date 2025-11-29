'use client';

import { Button, Input } from '@neolith/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Suspense, useState } from 'react';

import { GitHubIcon, GoogleIcon } from '../../../components/icons';

/**
 * Loading fallback for the registration form
 */
function RegisterFormLoading() {
  return (
    <div className='space-y-6'>
      <div className='space-y-2 text-center'>
        <h2 className='text-2xl font-semibold tracking-tight'>Create an account</h2>
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
 * Registration form component that uses useSearchParams
 */
function RegisterForm() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  // Determine callback URL based on invite token
  const callbackUrl = inviteToken ? `/invite/${inviteToken}` : '/dashboard';

  /**
   * Handles OAuth sign-up with the specified provider.
   * @param provider - OAuth provider name (e.g., 'github', 'google')
   */
  const handleOAuthSignUp = async (provider: string) => {
    setIsLoading(true);
    try {
      await signIn(provider, { callbackUrl });
    } catch {
      setIsLoading(false);
    }
  };

  /**
   * Handles email/password registration form submission.
   * Currently a placeholder for future credential-based registration.
   */
  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength (basic check)
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    try {
      // In a real implementation, this would call a registration API
      // then sign in the user
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Registration failed');
      }

      // Sign in after successful registration
      await signIn('credentials', {
        email,
        password,
        callbackUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      setIsLoading(false);
    }
  };

  return (
    <div className='space-y-6'>
      {/* Page Header */}
      <div className='space-y-2 text-center'>
        <h2 className='text-2xl font-semibold tracking-tight'>
          Create an account
        </h2>
        <p className='text-sm text-muted-foreground'>
          {inviteToken
            ? 'Create an account to accept your workspace invitation'
            : 'Get started with Neolith today'}
        </p>
      </div>

      {/* OAuth Providers */}
      <div className='space-y-3'>
        <Button
          variant='outline'
          size='lg'
          className='w-full'
          onClick={() => handleOAuthSignUp('github')}
          disabled={isLoading}
        >
          <GitHubIcon className='mr-2 h-5 w-5' />
          Sign up with GitHub
        </Button>

        <Button
          variant='outline'
          size='lg'
          className='w-full'
          onClick={() => handleOAuthSignUp('google')}
          disabled={isLoading}
        >
          <GoogleIcon className='mr-2 h-5 w-5' />
          Sign up with Google
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
        <div className='rounded-md bg-destructive/10 p-3 text-sm text-destructive'>
          {error}
        </div>
      )}

      {/* Email/Password Form */}
      <form onSubmit={handleEmailSignUp} className='space-y-4'>
        <Input
          type='text'
          placeholder='Full name'
          value={name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          disabled={isLoading}
          autoComplete='name'
          required
        />
        <Input
          type='email'
          placeholder='Email address'
          value={email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
          disabled={isLoading}
          autoComplete='email'
          required
        />
        <Input
          type='password'
          placeholder='Password'
          value={password}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
          disabled={isLoading}
          autoComplete='new-password'
          required
        />
        <Input
          type='password'
          placeholder='Confirm password'
          value={confirmPassword}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
          disabled={isLoading}
          autoComplete='new-password'
          required
        />
        <Button type='submit' className='w-full' disabled={isLoading}>
          {isLoading ? 'Creating account...' : 'Create account'}
        </Button>
      </form>

      {/* Login Link */}
      <p className='text-center text-sm text-muted-foreground'>
        Already have an account?{' '}
        <Link href='/login' className='font-medium text-primary hover:underline'>
          Sign in
        </Link>
      </p>
    </div>
  );
}

/**
 * Registration page component for new user sign-up.
 *
 * Provides multiple registration methods:
 * - OAuth providers (GitHub, Google)
 * - Email/password form (for future implementation)
 *
 * Features a modern, responsive design with dark mode support.
 * Supports invitation flow via ?invite=token query parameter.
 */
export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterFormLoading />}>
      <RegisterForm />
    </Suspense>
  );
}
