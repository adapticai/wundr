'use client';

import { Button, Input } from '@neolith/ui';
import Link from 'next/link';
import { useState } from 'react';

/**
 * Forgot Password page component for password reset requests.
 *
 * Allows users to request a password reset by entering their email address.
 * A reset link will be sent to the provided email if the account exists.
 *
 * Features a modern, responsive design with dark mode support matching
 * the existing authentication pages.
 */
export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  /**
   * Handles forgot password form submission.
   * Sends a password reset request to the API.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send reset email');
      }

      // Always show success message (security best practice - don't reveal if email exists)
      setSuccess(true);
      setEmail('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to send reset email'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='space-y-6'>
      {/* Page Header */}
      <div className='space-y-2 text-center'>
        <h2 className='text-2xl font-semibold tracking-tight'>
          Reset your password
        </h2>
        <p className='text-sm text-muted-foreground'>
          Enter your email address and we&apos;ll send you a link to reset your
          password
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <div className='rounded-md bg-green-500/10 p-4 text-sm text-green-600 dark:text-green-400'>
          <p className='font-medium'>Check your email</p>
          <p className='mt-1 text-xs'>
            If an account exists with that email, we&apos;ve sent password reset
            instructions.
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className='rounded-md bg-destructive/10 p-3 text-sm text-destructive'>
          {error}
        </div>
      )}

      {/* Email Form */}
      {!success && (
        <form onSubmit={handleSubmit} className='space-y-4'>
          <Input
            type='email'
            placeholder='Email address'
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setEmail(e.target.value)
            }
            disabled={isLoading}
            autoComplete='email'
            autoFocus
            required
          />
          <Button type='submit' className='w-full' disabled={isLoading}>
            {isLoading ? 'Sending...' : 'Send reset link'}
          </Button>
        </form>
      )}

      {/* Back to Login Link */}
      <div className='text-center'>
        <Link
          href='/login'
          className='text-sm text-muted-foreground hover:text-primary transition-colors'
        >
          Back to login
        </Link>
      </div>

      {/* Register Link */}
      {!success && (
        <p className='text-center text-sm text-muted-foreground'>
          Don&apos;t have an account?{' '}
          <Link
            href='/register'
            className='font-medium text-primary hover:underline'
          >
            Sign up
          </Link>
        </p>
      )}
    </div>
  );
}
