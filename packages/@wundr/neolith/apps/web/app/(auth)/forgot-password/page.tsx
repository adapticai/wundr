'use client';

import { Button, Input, Label } from '@neolith/ui';
import { CheckCircle2, Mail } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

/**
 * Forgot Password page component for password reset requests.
 *
 * Allows users to request a password reset by entering their email address.
 * A reset link will be sent to the provided email if an account exists.
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

      // Always show success (security best practice — do not reveal if email exists)
      setSuccess(true);
      setEmail('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to send reset email. Please try again.'
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
          password.
        </p>
      </div>

      {/* Success State */}
      {success ? (
        <div className='space-y-6'>
          <div
            role='status'
            aria-live='polite'
            className='flex flex-col items-center gap-4 rounded-md bg-green-500/10 p-6 text-center'
          >
            <div className='rounded-full bg-green-500/10 p-3'>
              <CheckCircle2
                className='h-8 w-8 text-green-600 dark:text-green-400'
                aria-hidden='true'
              />
            </div>
            <div className='space-y-1'>
              <p className='font-medium text-green-600 dark:text-green-400'>
                Check your inbox
              </p>
              <p className='text-sm text-green-600/80 dark:text-green-400/80'>
                If an account exists for that email address, we&apos;ve sent
                password reset instructions.
              </p>
            </div>
          </div>
          <p className='text-center text-sm text-muted-foreground'>
            Didn&apos;t receive an email?{' '}
            <button
              type='button'
              onClick={() => setSuccess(false)}
              className='font-medium text-primary hover:underline'
            >
              Try again
            </button>
          </p>
          <div className='text-center'>
            <Link
              href='/login'
              className='text-sm text-muted-foreground hover:text-primary transition-colors'
            >
              Back to login
            </Link>
          </div>
        </div>
      ) : (
        <>
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

          {/* Email Form */}
          <form onSubmit={handleSubmit} className='space-y-4' noValidate>
            <div className='space-y-2'>
              <Label htmlFor='forgot-email'>Email address</Label>
              <div className='relative'>
                <Mail
                  className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground'
                  aria-hidden='true'
                />
                <Input
                  id='forgot-email'
                  type='email'
                  placeholder='you@example.com'
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEmail(e.target.value)
                  }
                  disabled={isLoading}
                  autoComplete='email'
                  autoFocus
                  required
                  className='pl-9'
                />
              </div>
            </div>
            <Button type='submit' className='w-full' disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send reset link'}
            </Button>
          </form>

          {/* Navigation Links */}
          <div className='flex items-center justify-between text-sm'>
            <Link
              href='/login'
              className='text-muted-foreground hover:text-primary transition-colors'
            >
              Back to login
            </Link>
            <Link
              href='/register'
              className='font-medium text-primary hover:underline'
            >
              Create an account
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
