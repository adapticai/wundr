'use client';

import { Button, Input, Label } from '@neolith/ui';
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
          <li key={index} className='flex items-center gap-2 text-xs'>
            {req.met ? (
              <Check
                className='h-3.5 w-3.5 text-green-600 dark:text-green-400'
                aria-hidden='true'
              />
            ) : (
              <X
                className='h-3.5 w-3.5 text-muted-foreground'
                aria-hidden='true'
              />
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
    pwd: string
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
      return { score: 2, label: 'Fair', color: 'bg-yellow-500' };
    }
    return { score: 3, label: 'Strong', color: 'bg-green-500' };
  };

  const strength = getStrength(password);

  if (!password) {
    return null;
  }

  return (
    <div
      className='space-y-1.5'
      aria-live='polite'
      aria-label={`Password strength: ${strength.label}`}
    >
      <div className='flex gap-1.5'>
        {[1, 2, 3].map(level => (
          <div
            key={level}
            className={`h-1 flex-1 rounded-full transition-colors ${level <= strength.score ? strength.color : 'bg-muted'}`}
          />
        ))}
      </div>
      <p className='text-xs text-muted-foreground'>
        Strength: <span className='font-medium'>{strength.label}</span>
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
        <div className='h-16 w-full animate-pulse rounded-md bg-muted' />
        <div className='h-10 w-full animate-pulse rounded-md bg-muted' />
        <div className='h-10 w-full animate-pulse rounded-md bg-muted' />
        <div className='h-10 w-full animate-pulse rounded-md bg-muted' />
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordsMatch = confirmPassword === '' || password === confirmPassword;

  // Extract token from URL on mount
  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setError(
        'This link appears to be invalid. Please request a new password reset from the login page.'
      );
    }
  }, [searchParams]);

  /**
   * Handles password reset form submission.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!token) {
      setError(
        'This link appears to be invalid. Please request a new password reset.'
      );
      return;
    }

    if (!password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please check and try again.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      setError(
        'Password must contain at least one uppercase letter, one lowercase letter, and one number.'
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
        throw new Error(
          data.error || 'Failed to reset password. Please try again.'
        );
      }

      setSuccess(true);
      setPassword('');
      setConfirmPassword('');

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to reset password. Please try again.'
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
          Set new password
        </h2>
        <p className='text-sm text-muted-foreground'>
          {success
            ? 'Your password has been updated successfully.'
            : 'Choose a strong password to secure your account.'}
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <div
          role='status'
          aria-live='polite'
          className='rounded-md bg-green-500/10 p-4 text-center text-sm text-green-600 dark:text-green-400'
        >
          <p className='font-medium'>Password updated</p>
          <p className='mt-1 text-xs'>Redirecting you to the login page...</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div
          role='alert'
          aria-live='polite'
          className='rounded-md bg-destructive/10 p-3 text-sm text-destructive'
        >
          {error}
          {!token && (
            <Link
              href='/forgot-password'
              className='ml-1 font-medium underline hover:no-underline'
            >
              Request a new link
            </Link>
          )}
        </div>
      )}

      {/* Password Reset Form */}
      {!success && token && (
        <form onSubmit={handleSubmit} className='space-y-4' noValidate>
          {/* Password Requirements */}
          <PasswordRequirements password={password} />

          <div className='space-y-2'>
            <Label htmlFor='new-password'>New password</Label>
            <div className='relative'>
              <Input
                id='new-password'
                type={showPassword ? 'text' : 'password'}
                placeholder='Enter new password'
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setPassword(e.target.value)
                }
                disabled={isLoading}
                autoComplete='new-password'
                autoFocus
                required
                className='pr-10'
                aria-describedby='password-strength'
              />
              <button
                type='button'
                onClick={() => setShowPassword(!showPassword)}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors'
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className='h-4 w-4' aria-hidden='true' />
                ) : (
                  <Eye className='h-4 w-4' aria-hidden='true' />
                )}
              </button>
            </div>
            <div id='password-strength'>
              <PasswordStrength password={password} />
            </div>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='confirm-new-password'>Confirm new password</Label>
            <div className='relative'>
              <Input
                id='confirm-new-password'
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder='Repeat new password'
                value={confirmPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setConfirmPassword(e.target.value)
                }
                disabled={isLoading}
                autoComplete='new-password'
                required
                className='pr-10'
                aria-describedby={
                  !passwordsMatch && confirmPassword
                    ? 'confirm-password-error'
                    : undefined
                }
              />
              <button
                type='button'
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors'
                tabIndex={-1}
                aria-label={
                  showConfirmPassword
                    ? 'Hide confirm password'
                    : 'Show confirm password'
                }
              >
                {showConfirmPassword ? (
                  <EyeOff className='h-4 w-4' aria-hidden='true' />
                ) : (
                  <Eye className='h-4 w-4' aria-hidden='true' />
                )}
              </button>
            </div>
            {!passwordsMatch && confirmPassword && (
              <p
                id='confirm-password-error'
                className='text-xs text-destructive'
                role='alert'
              >
                Passwords do not match
              </p>
            )}
          </div>

          <Button
            type='submit'
            className='w-full'
            disabled={
              isLoading || !passwordsMatch || !password || !confirmPassword
            }
          >
            {isLoading ? 'Updating password...' : 'Update password'}
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
    </div>
  );
}

/**
 * Reset Password page component for completing password reset.
 *
 * Allows users to set a new password using the reset token from their email.
 * Includes password strength feedback and confirmation matching.
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordLoading />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
