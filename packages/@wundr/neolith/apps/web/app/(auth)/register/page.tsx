'use client';

import { Button, Input } from '@neolith/ui';
import { Eye, EyeOff } from 'lucide-react';
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

    // Validate password strength - must match backend requirements
    if (!validatePassword(password)) {
      setError(
        'Password must contain at least 8 characters, one uppercase letter, one lowercase letter, and one number',
      );
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
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setName(e.target.value)
          }
          disabled={isLoading}
          autoComplete='name'
          required
        />
        <Input
          type='email'
          placeholder='Email address'
          value={email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setEmail(e.target.value)
          }
          disabled={isLoading}
          autoComplete='email'
          required
        />
        <div className='space-y-2'>
          <div className='relative'>
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder='Password'
              value={password}
              onChange={handlePasswordChange}
              disabled={isLoading}
              autoComplete='new-password'
              required
            />
            <button
              type='button'
              onClick={() => setShowPassword(!showPassword)}
              className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className='h-5 w-5' />
              ) : (
                <Eye className='h-5 w-5' />
              )}
            </button>
          </div>
          {password && (
            <div className='space-y-1 rounded-md bg-muted/50 p-3 text-xs'>
              <p className='font-medium text-muted-foreground mb-1'>
                Password requirements:
              </p>
              <div className='space-y-1'>
                <div className='flex items-center gap-2'>
                  {passwordValidation.minLength ? (
                    <span className='text-green-600'>✓</span>
                  ) : (
                    <span className='text-destructive'>✗</span>
                  )}
                  <span
                    className={
                      passwordValidation.minLength
                        ? 'text-green-600'
                        : 'text-muted-foreground'
                    }
                  >
                    At least 8 characters
                  </span>
                </div>
                <div className='flex items-center gap-2'>
                  {passwordValidation.hasUppercase ? (
                    <span className='text-green-600'>✓</span>
                  ) : (
                    <span className='text-destructive'>✗</span>
                  )}
                  <span
                    className={
                      passwordValidation.hasUppercase
                        ? 'text-green-600'
                        : 'text-muted-foreground'
                    }
                  >
                    One uppercase letter
                  </span>
                </div>
                <div className='flex items-center gap-2'>
                  {passwordValidation.hasLowercase ? (
                    <span className='text-green-600'>✓</span>
                  ) : (
                    <span className='text-destructive'>✗</span>
                  )}
                  <span
                    className={
                      passwordValidation.hasLowercase
                        ? 'text-green-600'
                        : 'text-muted-foreground'
                    }
                  >
                    One lowercase letter
                  </span>
                </div>
                <div className='flex items-center gap-2'>
                  {passwordValidation.hasNumber ? (
                    <span className='text-green-600'>✓</span>
                  ) : (
                    <span className='text-destructive'>✗</span>
                  )}
                  <span
                    className={
                      passwordValidation.hasNumber
                        ? 'text-green-600'
                        : 'text-muted-foreground'
                    }
                  >
                    One number
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className='relative'>
          <Input
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder='Confirm password'
            value={confirmPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setConfirmPassword(e.target.value)
            }
            disabled={isLoading}
            autoComplete='new-password'
            required
          />
          <button
            type='button'
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
            aria-label={
              showConfirmPassword ? 'Hide password' : 'Show password'
            }
          >
            {showConfirmPassword ? (
              <EyeOff className='h-5 w-5' />
            ) : (
              <Eye className='h-5 w-5' />
            )}
          </button>
        </div>
        <Button type='submit' className='w-full' disabled={isLoading}>
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
