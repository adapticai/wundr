'use client';

import { Button, Input, Label } from '@neolith/ui';
import { Check, X, Eye, EyeOff } from 'lucide-react';
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
        <h2 className='text-2xl font-semibold tracking-tight'>
          Create an account
        </h2>
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
        <div className='h-10 w-full animate-pulse rounded-md bg-muted' />
        <div className='h-10 w-full animate-pulse rounded-md bg-muted' />
      </div>
    </div>
  );
}

/**
 * Password requirements checklist item
 */
function RequirementItem({ met, label }: { met: boolean; label: string }) {
  return (
    <li className='flex items-center gap-2 text-xs'>
      {met ? (
        <Check
          className='h-3.5 w-3.5 text-green-600 dark:text-green-400'
          aria-hidden='true'
        />
      ) : (
        <X className='h-3.5 w-3.5 text-muted-foreground' aria-hidden='true' />
      )}
      <span
        className={
          met ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
        }
      >
        {label}
      </span>
    </li>
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password validation state
  const [passwordValidation, setPasswordValidation] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
  });

  // Determine callback URL based on invite token
  const callbackUrl = inviteToken ? `/invite/${inviteToken}` : '/dashboard';

  /**
   * Validates password against all requirements
   */
  const validatePassword = (pwd: string) => {
    const validation = {
      minLength: pwd.length >= 8,
      hasUppercase: /[A-Z]/.test(pwd),
      hasLowercase: /[a-z]/.test(pwd),
      hasNumber: /[0-9]/.test(pwd),
    };
    setPasswordValidation(validation);
    return Object.values(validation).every(Boolean);
  };

  /**
   * Handles password input change with validation
   */
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    validatePassword(newPassword);
  };

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
   */
  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please check and try again.');
      return;
    }

    // Validate password strength
    if (!validatePassword(password)) {
      setError(
        'Your password does not meet all the requirements listed below.'
      );
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.message || 'Registration failed. Please try again.'
        );
      }

      // Sign in after successful registration
      await signIn('credentials', {
        email,
        password,
        callbackUrl,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Registration failed. Please try again.'
      );
      setIsLoading(false);
    }
  };

  const passwordsMatch = confirmPassword === '' || password === confirmPassword;
  const allRequirementsMet = Object.values(passwordValidation).every(Boolean);

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
            : 'Get started — it only takes a minute'}
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
          aria-label='Sign up with GitHub'
        >
          <GitHubIcon className='mr-2 h-5 w-5' aria-hidden='true' />
          Sign up with GitHub
        </Button>

        <Button
          variant='outline'
          size='lg'
          className='w-full'
          onClick={() => handleOAuthSignUp('google')}
          disabled={isLoading}
          aria-label='Sign up with Google'
        >
          <GoogleIcon className='mr-2 h-5 w-5' aria-hidden='true' />
          Sign up with Google
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
      <form onSubmit={handleEmailSignUp} className='space-y-4' noValidate>
        <div className='space-y-2'>
          <Label htmlFor='name'>Full name</Label>
          <Input
            id='name'
            type='text'
            placeholder='Jane Smith'
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setName(e.target.value)
            }
            disabled={isLoading}
            autoComplete='name'
            required
          />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='register-email'>Email address</Label>
          <Input
            id='register-email'
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
          <Label htmlFor='register-password'>Password</Label>
          <div className='relative'>
            <Input
              id='register-password'
              type={showPassword ? 'text' : 'password'}
              placeholder='Create a password'
              value={password}
              onChange={handlePasswordChange}
              disabled={isLoading}
              autoComplete='new-password'
              required
              className='pr-10'
              aria-describedby={password ? 'password-requirements' : undefined}
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
          {password && (
            <div
              id='password-requirements'
              className='space-y-1 rounded-md bg-muted/50 p-3'
              role='status'
              aria-label='Password requirements'
            >
              <p className='text-xs font-medium text-muted-foreground mb-1'>
                Password must contain:
              </p>
              <ul className='space-y-1'>
                <RequirementItem
                  met={passwordValidation.minLength}
                  label='At least 8 characters'
                />
                <RequirementItem
                  met={passwordValidation.hasUppercase}
                  label='One uppercase letter'
                />
                <RequirementItem
                  met={passwordValidation.hasLowercase}
                  label='One lowercase letter'
                />
                <RequirementItem
                  met={passwordValidation.hasNumber}
                  label='One number'
                />
              </ul>
            </div>
          )}
        </div>
        <div className='space-y-2'>
          <Label htmlFor='confirm-password'>Confirm password</Label>
          <div className='relative'>
            <Input
              id='confirm-password'
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder='Repeat your password'
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
            isLoading || !passwordsMatch || (!!password && !allRequirementsMet)
          }
        >
          {isLoading ? 'Creating account...' : 'Create account'}
        </Button>
      </form>

      {/* Login Link */}
      <p className='text-center text-sm text-muted-foreground'>
        Already have an account?{' '}
        <Link
          href='/login'
          className='font-medium text-primary hover:underline'
        >
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
 * - Email/password credentials
 *
 * Supports invitation flow via ?invite=token query parameter.
 */
export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterFormLoading />}>
      <RegisterForm />
    </Suspense>
  );
}
