'use client';

import { Button } from '@neolith/ui';
import {
  CheckCircle2,
  XCircle,
  Mail,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

/**
 * Verification status types
 */
type VerificationStatus =
  | 'verifying'
  | 'success'
  | 'error'
  | 'expired'
  | 'invalid';

/**
 * Loading fallback for the verify email page
 */
function VerifyEmailLoading() {
  return (
    <div className='space-y-6'>
      <div className='space-y-2 text-center'>
        <h2 className='text-2xl font-semibold tracking-tight'>
          Verify your email
        </h2>
        <p className='text-sm text-muted-foreground'>
          Verifying your email address...
        </p>
      </div>
      <div className='flex justify-center py-8'>
        <Loader2
          className='h-16 w-16 animate-spin text-primary'
          aria-hidden='true'
        />
      </div>
    </div>
  );
}

/**
 * Verify Email content component.
 * Separated to allow Suspense boundary for useSearchParams.
 */
function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<VerificationStatus>('verifying');
  const [error, setError] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState('');
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');

  // Extract token and email from URL on mount and verify
  useEffect(() => {
    const tokenParam = searchParams.get('token');
    const emailParam = searchParams.get('email');
    if (!tokenParam) {
      setStatus('invalid');
      setError(
        'No verification token found. Please use the link from your email or request a new one.'
      );
      return;
    }

    setToken(tokenParam);
    if (emailParam) {
      setEmail(emailParam);
    }
    verifyEmail(tokenParam);
  }, [searchParams]);

  /**
   * Verify the email using the token
   */
  const verifyEmail = async (verificationToken: string) => {
    try {
      setStatus('verifying');
      setError('');

      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verificationToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 400) {
          setStatus('invalid');
          setError(
            data.error ||
              'This verification link is invalid. Please request a new one.'
          );
        } else if (response.status === 410) {
          setStatus('expired');
          setError(
            data.error ||
              'This verification link has expired. Please request a new one.'
          );
        } else {
          setStatus('error');
          setError(
            data.error ||
              'Verification failed. Please try again or request a new link.'
          );
        }
        return;
      }

      setStatus('success');

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err) {
      setStatus('error');
      setError(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred. Please try again.'
      );
    }
  };

  /**
   * Resend verification email
   */
  const handleResendEmail = async () => {
    setIsResending(true);
    setResendSuccess(false);
    setResendError('');

    try {
      // The resend endpoint expects an email address per the API schema.
      // We use the email from the URL param if available, otherwise fall back
      // to the token so the server can look up the associated email.
      const body = email ? { email } : { token };

      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || 'Failed to resend verification email. Please try again.'
        );
      }

      setResendSuccess(true);
    } catch (err) {
      setResendError(
        err instanceof Error
          ? err.message
          : 'Failed to resend verification email. Please try again.'
      );
    } finally {
      setIsResending(false);
    }
  };

  /**
   * Render content based on verification status
   */
  const renderContent = () => {
    switch (status) {
      case 'verifying':
        return (
          <div className='flex flex-col items-center gap-4 py-8'>
            <Loader2
              className='h-16 w-16 animate-spin text-primary'
              aria-hidden='true'
            />
            <p className='text-sm text-muted-foreground'>
              Verifying your email address...
            </p>
          </div>
        );

      case 'success':
        return (
          <>
            <div className='flex justify-center py-6'>
              <div className='rounded-full bg-green-500/10 p-4'>
                <CheckCircle2
                  className='h-16 w-16 text-green-600 dark:text-green-400'
                  aria-hidden='true'
                />
              </div>
            </div>
            <div className='rounded-md bg-green-500/10 p-4 text-center'>
              <p className='font-medium text-green-600 dark:text-green-400'>
                Email verified successfully
              </p>
              <p className='mt-2 text-sm text-green-600/80 dark:text-green-400/80'>
                Your email address has been confirmed. You can now sign in.
              </p>
              <p className='mt-2 text-xs text-muted-foreground'>
                Redirecting to the login page...
              </p>
            </div>
            <Button onClick={() => router.push('/login')} className='w-full'>
              Continue to login
            </Button>
          </>
        );

      case 'expired':
        return (
          <>
            <div className='flex justify-center py-6'>
              <div className='rounded-full bg-yellow-500/10 p-4'>
                <AlertCircle
                  className='h-16 w-16 text-yellow-600 dark:text-yellow-400'
                  aria-hidden='true'
                />
              </div>
            </div>
            <div className='rounded-md bg-yellow-500/10 p-4 text-center'>
              <p className='font-medium text-yellow-600 dark:text-yellow-400'>
                Verification link expired
              </p>
              <p className='mt-2 text-sm text-yellow-600/80 dark:text-yellow-400/80'>
                {error}
              </p>
            </div>

            {resendSuccess && (
              <div
                role='status'
                aria-live='polite'
                className='rounded-md bg-green-500/10 p-3 text-center text-sm text-green-600 dark:text-green-400'
              >
                New verification email sent. Please check your inbox.
              </div>
            )}

            {resendError && (
              <div
                role='alert'
                className='rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive'
              >
                {resendError}
              </div>
            )}

            <Button
              onClick={handleResendEmail}
              disabled={isResending || resendSuccess}
              className='w-full'
            >
              {isResending ? (
                <>
                  <Loader2
                    className='mr-2 h-4 w-4 animate-spin'
                    aria-hidden='true'
                  />
                  Sending...
                </>
              ) : resendSuccess ? (
                <>
                  <CheckCircle2 className='mr-2 h-4 w-4' aria-hidden='true' />
                  Email sent
                </>
              ) : (
                <>
                  <Mail className='mr-2 h-4 w-4' aria-hidden='true' />
                  Resend verification email
                </>
              )}
            </Button>
          </>
        );

      case 'invalid':
      case 'error':
        return (
          <>
            <div className='flex justify-center py-6'>
              <div className='rounded-full bg-destructive/10 p-4'>
                <XCircle
                  className='h-16 w-16 text-destructive'
                  aria-hidden='true'
                />
              </div>
            </div>
            <div className='rounded-md bg-destructive/10 p-4 text-center'>
              <p className='font-medium text-destructive'>
                {status === 'invalid'
                  ? 'Invalid verification link'
                  : 'Verification failed'}
              </p>
              <p className='mt-2 text-sm text-destructive/80'>{error}</p>
            </div>

            {token && (
              <>
                {resendSuccess && (
                  <div
                    role='status'
                    aria-live='polite'
                    className='rounded-md bg-green-500/10 p-3 text-center text-sm text-green-600 dark:text-green-400'
                  >
                    New verification email sent. Please check your inbox.
                  </div>
                )}

                {resendError && (
                  <div
                    role='alert'
                    className='rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive'
                  >
                    {resendError}
                  </div>
                )}

                <Button
                  onClick={handleResendEmail}
                  disabled={isResending || resendSuccess}
                  className='w-full'
                  variant='outline'
                >
                  {isResending ? (
                    <>
                      <Loader2
                        className='mr-2 h-4 w-4 animate-spin'
                        aria-hidden='true'
                      />
                      Sending...
                    </>
                  ) : resendSuccess ? (
                    <>
                      <CheckCircle2
                        className='mr-2 h-4 w-4'
                        aria-hidden='true'
                      />
                      Email sent
                    </>
                  ) : (
                    <>
                      <Mail className='mr-2 h-4 w-4' aria-hidden='true' />
                      Resend verification email
                    </>
                  )}
                </Button>
              </>
            )}
          </>
        );
    }
  };

  return (
    <div className='space-y-6' aria-live='polite'>
      {/* Page Header */}
      <div className='space-y-2 text-center'>
        <h2 className='text-2xl font-semibold tracking-tight'>
          {status === 'success' ? 'Email verified' : 'Verify your email'}
        </h2>
        <p className='text-sm text-muted-foreground'>
          {status === 'verifying' &&
            'Please wait while we verify your email address.'}
          {status === 'success' &&
            'Your email has been successfully confirmed.'}
          {status === 'expired' && 'Your verification link has expired.'}
          {status === 'invalid' && 'The verification link is not valid.'}
          {status === 'error' &&
            'We encountered a problem verifying your email.'}
        </p>
      </div>

      {/* Status Content */}
      {renderContent()}

      {/* Back to Login Link */}
      {status !== 'success' && (
        <div className='text-center'>
          <Link
            href='/login'
            className='text-sm text-muted-foreground hover:text-primary transition-colors'
          >
            Back to login
          </Link>
        </div>
      )}

      {/* Register Link */}
      {(status === 'invalid' || status === 'error') && (
        <p className='text-center text-sm text-muted-foreground'>
          Don&apos;t have an account?{' '}
          <Link
            href='/register'
            className='font-medium text-primary hover:underline'
          >
            Create an account
          </Link>
        </p>
      )}
    </div>
  );
}

/**
 * Verify Email page component for email verification.
 *
 * Handles email verification using tokens sent during registration.
 * Provides feedback for all verification states and allows users to
 * resend verification emails when the token has expired.
 *
 * @example
 * URL: /verify-email?token=abc123xyz
 */
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailLoading />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
