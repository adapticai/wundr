'use client';

import { Button, Input } from '@genesis/ui';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useState } from 'react';

import { GitHubIcon, GoogleIcon } from '../../../components/icons';

/**
 * Login page component for user authentication.
 *
 * Provides multiple authentication methods:
 * - OAuth providers (GitHub, Google)
 * - Email/password form (for future implementation)
 *
 * Features a modern, responsive design with dark mode support.
 */
export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  /**
   * Handles OAuth sign-in with the specified provider.
   * @param provider - OAuth provider name (e.g., 'github', 'google')
   */
  const handleOAuthSignIn = async (provider: string) => {
    setIsLoading(true);
    try {
      await signIn(provider, { callbackUrl: '/dashboard' });
    } catch {
      // Error will be handled by NextAuth error page
      setIsLoading(false);
    }
  };

  /**
   * Handles email/password form submission.
   * Currently a placeholder for future credential-based auth.
   */
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signIn('credentials', {
        email,
        password,
        callbackUrl: '/dashboard',
      });
    } catch {
      setIsLoading(false);
    }
  };

  return (
    <div className='space-y-6'>
      {/* Page Header */}
      <div className='space-y-2 text-center'>
        <h2 className='text-2xl font-semibold tracking-tight'>Welcome back</h2>
        <p className='text-sm text-muted-foreground'>
          Sign in to your account to continue
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

      {/* Email/Password Form */}
      <form onSubmit={handleEmailSignIn} className='space-y-4'>
        <Input
          type='email'
          placeholder='Email address'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          autoComplete='email'
          required
        />
        <Input
          type='password'
          placeholder='Password'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          autoComplete='current-password'
          required
        />
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
