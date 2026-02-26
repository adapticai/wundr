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
 * Validates invitation token and allows users to accept invitations.
 * - Shows invitation details (who invited, workspace name)
 * - "Accept" button for logged-in users
 * - "Create Account" / "Login" buttons for non-authenticated users
 * - Handles expired/invalid/revoked invitations gracefully
 *
 * @param props - Component props with token parameter
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
          setError(data.error || 'Failed to load invitation');
          return;
        }

        setInvitation(data.invitation);
      } catch (err) {
        setError('An error occurred while loading the invitation');
        console.error('Error fetching invitation:', err);
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
        setError(data.error || 'Failed to accept invitation');
        return;
      }

      // Redirect to workspace after successful acceptance
      router.push(`/${data.membership.workspace.slug}/dashboard`);
    } catch (err) {
      setError('An error occurred while accepting the invitation');
      console.error('Error accepting invitation:', err);
    } finally {
      setIsAccepting(false);
    }
  };

  /**
   * Render loading state
   */
  if (isLoading || sessionStatus === 'loading') {
    return (
      <div className='space-y-6'>
        <div className='space-y-2 text-center'>
          <h2 className='text-2xl font-semibold tracking-tight'>
            Loading invitation...
          </h2>
        </div>
        <div className='flex justify-center'>
          <div className='h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent' />
        </div>
      </div>
    );
  }

  /**
   * Render error state
   */
  if (error && !invitation) {
    return (
      <div className='space-y-6'>
        <div className='space-y-2 text-center'>
          <div className='flex justify-center'>
            <XCircle className='h-16 w-16 text-destructive' />
          </div>
          <h2 className='text-2xl font-semibold tracking-tight'>
            Invalid Invitation
          </h2>
          <p className='text-sm text-muted-foreground'>{error}</p>
        </div>
        <div className='flex justify-center'>
          <Button asChild>
            <Link href='/login'>Go to Login</Link>
          </Button>
        </div>
      </div>
    );
  }

  /**
   * Render expired invitation
   */
  if (invitation?.status === 'EXPIRED') {
    return (
      <div className='space-y-6'>
        <div className='space-y-2 text-center'>
          <div className='flex justify-center'>
            <Clock className='h-16 w-16 text-muted-foreground' />
          </div>
          <h2 className='text-2xl font-semibold tracking-tight'>
            Invitation Expired
          </h2>
          <p className='text-sm text-muted-foreground'>
            This invitation to{' '}
            <span className='font-medium'>{invitation.workspaceName}</span> has
            expired.
          </p>
          <p className='text-xs text-muted-foreground'>
            Please contact the workspace admin for a new invitation.
          </p>
        </div>
        <div className='flex justify-center'>
          <Button asChild>
            <Link href='/login'>Go to Login</Link>
          </Button>
        </div>
      </div>
    );
  }

  /**
   * Render revoked invitation
   */
  if (invitation?.status === 'REVOKED') {
    return (
      <div className='space-y-6'>
        <div className='space-y-2 text-center'>
          <div className='flex justify-center'>
            <XCircle className='h-16 w-16 text-destructive' />
          </div>
          <h2 className='text-2xl font-semibold tracking-tight'>
            Invitation Revoked
          </h2>
          <p className='text-sm text-muted-foreground'>
            This invitation to{' '}
            <span className='font-medium'>{invitation.workspaceName}</span> has
            been revoked.
          </p>
          <p className='text-xs text-muted-foreground'>
            Please contact the workspace admin if you believe this is an error.
          </p>
        </div>
        <div className='flex justify-center'>
          <Button asChild>
            <Link href='/login'>Go to Login</Link>
          </Button>
        </div>
      </div>
    );
  }

  /**
   * Render already accepted invitation
   */
  if (invitation?.status === 'ACCEPTED') {
    return (
      <div className='space-y-6'>
        <div className='space-y-2 text-center'>
          <div className='flex justify-center'>
            <CheckCircle className='h-16 w-16 text-green-500' />
          </div>
          <h2 className='text-2xl font-semibold tracking-tight'>
            Invitation Already Accepted
          </h2>
          <p className='text-sm text-muted-foreground'>
            This invitation has already been accepted.
          </p>
        </div>
        <div className='flex justify-center'>
          <Button asChild>
            <Link href={`/${invitation.workspaceSlug}/dashboard`}>
              Go to Workspace
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  /**
   * Check if user's email matches invitation email
   */
  const emailMatches =
    session?.user?.email?.toLowerCase() === invitation?.email.toLowerCase();

  /**
   * Render valid invitation
   */
  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='space-y-2 text-center'>
        <div className='flex justify-center'>
          <Mail className='h-16 w-16 text-primary' />
        </div>
        <h2 className='text-2xl font-semibold tracking-tight'>
          Workspace Invitation
        </h2>
        <p className='text-sm text-muted-foreground'>
          You&apos;ve been invited to join a workspace
        </p>
      </div>

      {/* Invitation Details Card */}
      <div className='rounded-lg border border-border bg-card p-6 space-y-4'>
        <div className='space-y-3'>
          <div className='flex items-start gap-3'>
            <Users className='h-5 w-5 text-muted-foreground mt-0.5' />
            <div>
              <p className='text-sm font-medium'>Workspace</p>
              <p className='text-sm text-muted-foreground'>
                {invitation?.workspaceName}
              </p>
            </div>
          </div>

          <div className='flex items-start gap-3'>
            <Mail className='h-5 w-5 text-muted-foreground mt-0.5' />
            <div>
              <p className='text-sm font-medium'>Invited Email</p>
              <p className='text-sm text-muted-foreground'>
                {invitation?.email}
              </p>
            </div>
          </div>

          {invitation?.inviterName && (
            <div className='flex items-start gap-3'>
              <UserCircle className='h-5 w-5 text-muted-foreground mt-0.5' />
              <div>
                <p className='text-sm font-medium'>Invited by</p>
                <p className='text-sm text-muted-foreground'>
                  {invitation.inviterName}
                  {invitation.inviterEmail && ` (${invitation.inviterEmail})`}
                </p>
              </div>
            </div>
          )}

          <div className='flex items-start gap-3'>
            <ShieldCheck className='h-5 w-5 text-muted-foreground mt-0.5' />
            <div>
              <p className='text-sm font-medium'>Role</p>
              <p className='text-sm text-muted-foreground capitalize'>
                {invitation?.role.toLowerCase()}
              </p>
            </div>
          </div>

          <div className='flex items-start gap-3'>
            <Clock className='h-5 w-5 text-muted-foreground mt-0.5' />
            <div>
              <p className='text-sm font-medium'>Expires</p>
              <p className='text-sm text-muted-foreground'>
                {invitation?.expiresAt &&
                  new Date(invitation.expiresAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className='rounded-md bg-destructive/10 p-3 text-sm text-destructive'>
          {error}
        </div>
      )}

      {/* Email Mismatch Warning */}
      {session && !emailMatches && (
        <div className='rounded-md bg-yellow-500/10 p-3 text-sm text-yellow-600 dark:text-yellow-500'>
          <div className='flex items-start gap-2'>
            <AlertCircle className='h-4 w-4 mt-0.5 flex-shrink-0' />
            <p>
              This invitation was sent to{' '}
              <span className='font-medium'>{invitation?.email}</span>, but
              you&apos;re logged in as{' '}
              <span className='font-medium'>{session.user.email}</span>. You may
              need to log in with the invited email address.
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
            {isAccepting ? 'Accepting...' : 'Accept Invitation'}
          </Button>
          {!emailMatches && (
            <Button variant='outline' className='w-full' asChild>
              <Link href='/login'>Log in with {invitation?.email}</Link>
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
              Sign in to existing account
            </Link>
          </Button>
        </div>
      )}

      {/* Footer */}
      <p className='text-center text-xs text-muted-foreground'>
        By accepting this invitation, you will gain access to the workspace and
        its resources.
      </p>
    </div>
  );
}
