'use client';

import { Button } from '@neolith/ui';
import {
  CheckCircle,
  XCircle,
  Clock,
  Mail,
  Users,
  AlertCircle,
  UserCircle,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

/**
 * Invitation status types
 */
type InviteStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';

/**
 * Invitation details returned from the API
 */
interface InvitationDetails {
  id: string;
  email: string;
  role: string;
  workspaceName: string;
  workspaceSlug: string;
  inviterName: string | null;
  inviterEmail: string | null;
  expiresAt: string;
  status: InviteStatus;
}

/**
 * Component props
 */
interface InvitePageProps {
  params: Promise<{ token: string }>;
}

/**
 * Invitation acceptance page component.
 *
 * Validates invitation token and allows users to accept workspace invitations.
 * Shows invitation details and presents the correct action based on auth state.
 * Handles expired, revoked, and already-accepted invitations gracefully.
 */
export default function InvitePage({ params }: InvitePageProps) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [token, setToken] = useState<string>('');
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState('');

  // Unwrap params on mount
  useEffect(() => {
    params.then(p => setToken(p.token));
  }, [params]);

  // Fetch invitation details
  useEffect(() => {
    if (!token) {
      return;
    }

    const fetchInvitation = async () => {
      try {
        setIsLoading(true);
        setError('');

        const response = await fetch(`/api/invites/${token}`);
        const data = await response.json();

        if (!response.ok) {
          setError(
            data.error ||
              'This invitation could not be found or has already been used.'
          );
          return;
        }

        setInvitation(data.invitation);
      } catch {
        setError(
          'Unable to load the invitation. Please check your connection and try again.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    void fetchInvitation();
  }, [token]);

  /**
   * Handle invitation acceptance
   */
  const handleAccept = async () => {
    if (!token || !session?.user) {
      return;
    }

    try {
      setIsAccepting(true);
      setError('');

      const response = await fetch(`/api/invites/${token}`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error || 'Unable to accept the invitation. Please try again.'
        );
        return;
      }

      // Redirect to workspace after successful acceptance
      router.push(`/${data.membership.workspace.slug}/dashboard`);
    } catch {
      setError(
        'Unable to accept the invitation. Please check your connection and try again.'
      );
    } finally {
      setIsAccepting(false);
    }
  };

  /**
   * Loading state
   */
  if (isLoading || sessionStatus === 'loading') {
    return (
      <div className='space-y-6'>
        <div className='space-y-2 text-center'>
          <h2 className='text-2xl font-semibold tracking-tight'>
            Loading invitation
          </h2>
          <p className='text-sm text-muted-foreground'>
            Please wait a moment...
          </p>
        </div>
        <div className='flex justify-center py-4'>
          <div
            className='h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent'
            role='status'
            aria-label='Loading'
          />
        </div>
      </div>
    );
  }

  /**
   * Error state — invitation not found or failed to load
   */
  if (error && !invitation) {
    return (
      <div className='space-y-6'>
        <div className='space-y-4 text-center'>
          <div className='flex justify-center'>
            <div className='rounded-full bg-destructive/10 p-4'>
              <XCircle
                className='h-12 w-12 text-destructive'
                aria-hidden='true'
              />
            </div>
          </div>
          <div className='space-y-1'>
            <h2 className='text-2xl font-semibold tracking-tight'>
              Invitation not found
            </h2>
            <p className='text-sm text-muted-foreground'>{error}</p>
          </div>
        </div>
        <Button asChild className='w-full'>
          <Link href='/login'>Go to login</Link>
        </Button>
      </div>
    );
  }

  /**
   * Expired invitation
   */
  if (invitation?.status === 'EXPIRED') {
    return (
      <div className='space-y-6'>
        <div className='space-y-4 text-center'>
          <div className='flex justify-center'>
            <div className='rounded-full bg-muted p-4'>
              <Clock
                className='h-12 w-12 text-muted-foreground'
                aria-hidden='true'
              />
            </div>
          </div>
          <div className='space-y-1'>
            <h2 className='text-2xl font-semibold tracking-tight'>
              Invitation expired
            </h2>
            <p className='text-sm text-muted-foreground'>
              This invitation to{' '}
              <span className='font-medium text-foreground'>
                {invitation.workspaceName}
              </span>{' '}
              has expired.
            </p>
            <p className='text-sm text-muted-foreground'>
              Please ask a workspace admin to send you a new invitation.
            </p>
          </div>
        </div>
        <Button asChild className='w-full'>
          <Link href='/login'>Go to login</Link>
        </Button>
      </div>
    );
  }

  /**
   * Revoked invitation
   */
  if (invitation?.status === 'REVOKED') {
    return (
      <div className='space-y-6'>
        <div className='space-y-4 text-center'>
          <div className='flex justify-center'>
            <div className='rounded-full bg-destructive/10 p-4'>
              <XCircle
                className='h-12 w-12 text-destructive'
                aria-hidden='true'
              />
            </div>
          </div>
          <div className='space-y-1'>
            <h2 className='text-2xl font-semibold tracking-tight'>
              Invitation revoked
            </h2>
            <p className='text-sm text-muted-foreground'>
              This invitation to{' '}
              <span className='font-medium text-foreground'>
                {invitation.workspaceName}
              </span>{' '}
              has been revoked.
            </p>
            <p className='text-sm text-muted-foreground'>
              Please contact the workspace admin if you believe this is an
              error.
            </p>
          </div>
        </div>
        <Button asChild className='w-full'>
          <Link href='/login'>Go to login</Link>
        </Button>
      </div>
    );
  }

  /**
   * Already accepted invitation
   */
  if (invitation?.status === 'ACCEPTED') {
    return (
      <div className='space-y-6'>
        <div className='space-y-4 text-center'>
          <div className='flex justify-center'>
            <div className='rounded-full bg-green-500/10 p-4'>
              <CheckCircle
                className='h-12 w-12 text-green-600 dark:text-green-400'
                aria-hidden='true'
              />
            </div>
          </div>
          <div className='space-y-1'>
            <h2 className='text-2xl font-semibold tracking-tight'>
              Already a member
            </h2>
            <p className='text-sm text-muted-foreground'>
              This invitation has already been accepted. You&apos;re already a
              member of{' '}
              <span className='font-medium text-foreground'>
                {invitation.workspaceName}
              </span>
              .
            </p>
          </div>
        </div>
        <Button asChild className='w-full'>
          <Link href={`/${invitation.workspaceSlug}/dashboard`}>
            Go to workspace
          </Link>
        </Button>
      </div>
    );
  }

  /**
   * Check if the signed-in user's email matches the invited email
   */
  const emailMatches =
    session?.user?.email?.toLowerCase() === invitation?.email.toLowerCase();

  /**
   * Valid pending invitation
   */
  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='space-y-2 text-center'>
        <div className='flex justify-center'>
          <div className='rounded-full bg-primary/10 p-4'>
            <Mail className='h-12 w-12 text-primary' aria-hidden='true' />
          </div>
        </div>
        <h2 className='text-2xl font-semibold tracking-tight'>
          You&apos;ve been invited
        </h2>
        <p className='text-sm text-muted-foreground'>
          You&apos;ve been invited to join a workspace on Neolith
        </p>
      </div>

      {/* Invitation Details */}
      <div className='rounded-lg border border-border bg-muted/30 p-4 space-y-3'>
        <div className='flex items-start gap-3'>
          <Users
            className='h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0'
            aria-hidden='true'
          />
          <div className='min-w-0'>
            <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
              Workspace
            </p>
            <p className='text-sm font-medium truncate'>
              {invitation?.workspaceName}
            </p>
          </div>
        </div>

        <div className='flex items-start gap-3'>
          <Mail
            className='h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0'
            aria-hidden='true'
          />
          <div className='min-w-0'>
            <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
              Invited email
            </p>
            <p className='text-sm truncate'>{invitation?.email}</p>
          </div>
        </div>

        {invitation?.inviterName && (
          <div className='flex items-start gap-3'>
            <UserCircle
              className='h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0'
              aria-hidden='true'
            />
            <div className='min-w-0'>
              <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
                Invited by
              </p>
              <p className='text-sm truncate'>
                {invitation.inviterName}
                {invitation.inviterEmail && (
                  <span className='text-muted-foreground'>
                    {' '}
                    ({invitation.inviterEmail})
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        <div className='flex items-start gap-3'>
          <ShieldCheck
            className='h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0'
            aria-hidden='true'
          />
          <div className='min-w-0'>
            <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
              Role
            </p>
            <p className='text-sm capitalize'>
              {invitation?.role.toLowerCase()}
            </p>
          </div>
        </div>

        <div className='flex items-start gap-3'>
          <Clock
            className='h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0'
            aria-hidden='true'
          />
          <div className='min-w-0'>
            <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
              Expires
            </p>
            <p className='text-sm'>
              {invitation?.expiresAt &&
                new Date(invitation.expiresAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
            </p>
          </div>
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

      {/* Email Mismatch Warning */}
      {session && !emailMatches && (
        <div
          role='alert'
          className='rounded-md bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400'
        >
          <div className='flex items-start gap-2'>
            <AlertCircle
              className='h-4 w-4 mt-0.5 flex-shrink-0'
              aria-hidden='true'
            />
            <p>
              This invitation was sent to{' '}
              <span className='font-medium'>{invitation?.email}</span>, but
              you&apos;re signed in as{' '}
              <span className='font-medium'>{session.user.email}</span>. You
              must sign in with the invited email address to accept.
            </p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {session ? (
        <div className='space-y-3'>
          <Button
            className='w-full'
            onClick={handleAccept}
            disabled={isAccepting || !emailMatches}
          >
            {isAccepting ? 'Accepting invitation...' : 'Accept invitation'}
          </Button>
          {!emailMatches && (
            <Button variant='outline' className='w-full' asChild>
              <Link href={`/login?invite=${token}`}>
                Sign in as {invitation?.email}
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className='space-y-3'>
          <Button className='w-full' asChild>
            <Link href={`/register?invite=${token}`}>Create an account</Link>
          </Button>
          <Button variant='outline' className='w-full' asChild>
            <Link href={`/login?invite=${token}`}>
              Sign in to an existing account
            </Link>
          </Button>
        </div>
      )}

      {/* Footer */}
      <p className='text-center text-xs text-muted-foreground'>
        By accepting, you will join the workspace and gain access to its
        resources based on your assigned role.
      </p>
    </div>
  );
}
