'use client';

import { Button, Input } from '@neolith/ui';
import { Eye, EyeOff, Check, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

/**
 * Password requirements checklist component
 */
function PasswordRequirements({ password }: { password: string }) {
  const requirements = [
    {
      label: 'At least 8 characters',
      met: password.length >= 8,
    },
    {
      label: 'One uppercase letter',
      met: /[A-Z]/.test(password),
    },
    {
      label: 'One lowercase letter',
      met: /[a-z]/.test(password),
    },
    {
      label: 'One number',
      met: /\d/.test(password),
    },
  ];

  return (
    <div className='space-y-2 rounded-md border border-border bg-muted/30 p-3'>
      <p className='text-xs font-medium text-foreground'>
        Password must contain:
      </p>
      <ul className='space-y-1'>
        {requirements.map((req, index) => (
          <li
            key={index}
            className='flex items-center gap-2 text-xs'
          >
            {req.met ? (
              <Check className='h-3.5 w-3.5 text-green-600 dark:text-green-400' />
            ) : (
              <X className='h-3.5 w-3.5 text-muted-foreground' />
            )}
            <span
              className={
                req.met
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-muted-foreground'
              }
            >
              {req.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Password strength indicator component
 */
function PasswordStrength({ password }: { password: string }) {
  const getStrength = (
    pwd: string,
  ): { score: number; label: string; color: string } => {
    if (!pwd) {
      return { score: 0, label: '', color: '' };
    }

    let score = 0;
    if (pwd.length >= 8) {
      score += 1;
    }
    if (pwd.length >= 12) {
      score += 1;
    }
    if (/[a-z]/.test(pwd)) {
      score += 1;
    }
    if (/[A-Z]/.test(pwd)) {
      score += 1;
    }
    if (/\d/.test(pwd)) {
      score += 1;
    }
    if (/[^a-zA-Z\d]/.test(pwd)) {
      score += 1;
    }

    if (score <= 2) {
      return { score: 1, label: 'Weak', color: 'bg-red-500' };
    }
    if (score <= 4) {
      return { score: 2, label: 'Medium', color: 'bg-yellow-500' };
    }
    return { score: 3, label: 'Strong', color: 'bg-green-500' };
  };

  const strength = getStrength(password);

  if (!password) {
    return null;
  }

  return (
    <div className='space-y-2'>
      <div className='flex gap-2'>
        {[1, 2, 3].map(level => (
          <div
            key={level}
            className={`h-1 flex-1 rounded ${level <= strength.score ? strength.color : 'bg-muted'}`}
          />
        ))}
      </div>
      <p className='text-xs text-muted-foreground'>
        Password strength: <span className='font-medium'>{strength.label}</span>
      </p>
    </div>
  );
}

/**
 * Loading fallback for the reset password form
 */
function ResetPasswordLoading() {
  return (
    <div className='space-y-6'>
      <div className='space-y-2 text-center'>
        <h2 className='text-2xl font-semibold tracking-tight'>
          Set new password
        </h2>
        <p className='text-sm text-muted-foreground'>Loading...</p>
      </div>
      <div className='space-y-4'>
        <div className='h-10 w-full animate-pulse rounded bg-muted' />
        <div className='h-10 w-full animate-pulse rounded bg-muted' />
        <div className='h-10 w-full animate-pulse rounded bg-muted' />
      </div>
    </div>
  );
}

/**
 * Reset Password form content component.
 * Separated to allow Suspense boundary for useSearchParams.
 */
function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [passwordsMatch, setPasswordsMatch] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Extract token from URL on mount
  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setError('No reset token provided. Please use the link from your email.');
    }
  }, [searchParams]);

  // Check if passwords match
  useEffect(() => {
    if (confirmPassword) {
      setPasswordsMatch(password === confirmPassword);
    } else {
      setPasswordsMatch(true);
    }
  }, [password, confirmPassword]);

  /**
   * Handles password reset form submission.
   * Sends the new password to the API along with the reset token.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Validation
    if (!token) {
      setError('No reset token provided. Please use the link from your email.');
      return;
    }

    if (!password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      setError(
        'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      );
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setSuccess(true);
      setPassword('');
      setConfirmPassword('');

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='space-y-6'>
      {/* Page Header */}
      <div className='space-y-2 text-center'>
        <h2 className='text-2xl font-semibold tracking-tight'>
          Set new password
        </h2>
        <p className='text-sm text-muted-foreground'>
          Enter your new password below
        </p>
        {token && (
          <p className='text-xs text-muted-foreground/80'>
            Link valid for 1 hour
          </p>
        )}
      </div>

      {/* Success Message */}
      {success && (
        <div className='rounded-md bg-green-500/10 p-4 text-sm text-green-600 dark:text-green-400'>
          <p className='font-medium'>Password reset successful!</p>
          <p className='mt-1 text-xs'>Redirecting to login page...</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className='rounded-md bg-destructive/10 p-3 text-sm text-destructive'>
          {error}
        </div>
      )}

      {/* Password Reset Form */}
      {!success && token && (
        <form onSubmit={handleSubmit} className='space-y-4'>
          {/* Password Requirements - Always Visible */}
          <PasswordRequirements password={password} />

          <div className='space-y-2'>
            <div className='relative'>
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder='New password'
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setPassword(e.target.value)
                }
                disabled={isLoading}
                autoComplete='new-password'
                autoFocus
                required
                className='pr-10'
              />
              <button
                type='button'
                onClick={() => setShowPassword(!showPassword)}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors'
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className='h-4 w-4' />
                ) : (
                  <Eye className='h-4 w-4' />
                )}
              </button>
            </div>
            <PasswordStrength password={password} />
          </div>

          <div className='space-y-2'>
            <div className='relative'>
              <Input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder='Confirm new password'
                value={confirmPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setConfirmPassword(e.target.value)
                }
                disabled={isLoading}
                autoComplete='new-password'
                required
                className='pr-10'
              />
              <button
                type='button'
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors'
                tabIndex={-1}
              >
                {showConfirmPassword ? (
                  <EyeOff className='h-4 w-4' />
                ) : (
                  <Eye className='h-4 w-4' />
                )}
              </button>
            </div>
            {!passwordsMatch && confirmPassword && (
              <p className='text-xs text-destructive'>Passwords do not match</p>
            )}
          </div>

          <Button
            type='submit'
            className='w-full'
            disabled={
              isLoading || !passwordsMatch || !password || !confirmPassword
            }
          >
            {isLoading ? 'Resetting password...' : 'Reset password'}
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

/**
 * Reset Password page component for completing password reset.
 *
 * Allows users to set a new password using the reset token from their email.
 * Includes password strength validation and confirmation matching.
 *
 * Features a modern, responsive design with dark mode support matching
 * the existing authentication pages.
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordLoading />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
