'use client';

import {
  Inbox,
  LayoutGrid,
  Plus,
  Link as LinkIcon,
  AlertCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';

import { GitHubIcon, GoogleIcon } from '@/components/icons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';
}

interface WorkspaceInvite {
  id: string;
  workspaceSlug: string;
  workspaceName: string;
  invitedBy: string;
  createdAt: string;
}

const ROLE_LABELS: Record<Workspace['role'], string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
  GUEST: 'Guest',
};

export default function WorkspacesPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);
  const [isLoadingInvites, setIsLoadingInvites] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingInvite, setProcessingInvite] = useState<string | null>(null);
  const [linkingAccount, setLinkingAccount] = useState(false);

  useEffect(() => {
    fetchWorkspaces();
    fetchInvites();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      setIsLoadingWorkspaces(true);
      const response = await fetch('/api/workspaces');
      if (!response.ok) {
        throw new Error('Failed to fetch workspaces');
      }
      const data = await response.json();
      setWorkspaces(data.workspaces || []);
    } catch (err) {
      console.error('Error fetching workspaces:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load workspaces'
      );
    } finally {
      setIsLoadingWorkspaces(false);
    }
  };

  const fetchInvites = async () => {
    try {
      setIsLoadingInvites(true);
      const response = await fetch('/api/workspaces/invites');
      if (!response.ok) {
        if (response.status === 404) {
          setInvites([]);
          return;
        }
        throw new Error('Failed to fetch invites');
      }
      const data = await response.json();
      setInvites(data.invites || []);
    } catch (err) {
      console.error('Error fetching invites:', err);
      setInvites([]);
    } finally {
      setIsLoadingInvites(false);
    }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    try {
      setProcessingInvite(inviteId);
      const response = await fetch(
        `/api/workspaces/invites/${inviteId}/accept`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new Error('Failed to accept invite');
      }

      await Promise.all([fetchWorkspaces(), fetchInvites()]);
    } catch (err) {
      console.error('Error accepting invite:', err);
      setError(err instanceof Error ? err.message : 'Failed to accept invite');
    } finally {
      setProcessingInvite(null);
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    try {
      setProcessingInvite(inviteId);
      const response = await fetch(
        `/api/workspaces/invites/${inviteId}/decline`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new Error('Failed to decline invite');
      }

      await fetchInvites();
    } catch (err) {
      console.error('Error declining invite:', err);
      setError(err instanceof Error ? err.message : 'Failed to decline invite');
    } finally {
      setProcessingInvite(null);
    }
  };

  const handleLinkAccount = async (provider: 'google' | 'github') => {
    try {
      setLinkingAccount(true);
      await signIn(provider, { callbackUrl: '/workspaces' });
    } catch (err) {
      console.error('Error linking account:', err);
      setError('Failed to link account. Please try again.');
      setLinkingAccount(false);
    }
  };

  const handleWorkspaceClick = (workspaceSlug: string) => {
    router.push(`/${workspaceSlug}/dashboard`);
  };

  const handleCreateWorkspace = () => {
    router.push('/workspaces/new');
  };

  return (
    <div className='max-w-5xl mx-auto py-8'>
      {/* Header */}
      <div className='mb-8'>
        <h1 className='text-3xl font-bold'>Workspaces</h1>
        <p className='text-muted-foreground mt-2'>
          Select a workspace to open, accept pending invitations, or link
          another account to consolidate access.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant='destructive' className='mb-6'>
          <AlertCircle className='h-4 w-4' />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription className='flex items-center justify-between gap-4'>
            <span>{error}</span>
            <Button
              variant='outline'
              size='sm'
              onClick={() => setError(null)}
              className='shrink-0'
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs defaultValue='workspaces' className='w-full'>
        <TabsList className='grid w-full grid-cols-3'>
          <TabsTrigger value='workspaces'>
            <LayoutGrid className='mr-2 h-4 w-4' />
            Your Workspaces
          </TabsTrigger>
          <TabsTrigger value='invites'>
            <Inbox className='mr-2 h-4 w-4' />
            Invitations
            {invites.length > 0 && (
              <span
                className='ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground'
                aria-label={`${invites.length} pending invitation${invites.length === 1 ? '' : 's'}`}
              >
                {invites.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value='link'>
            <LinkIcon className='mr-2 h-4 w-4' />
            Link Account
          </TabsTrigger>
        </TabsList>

        {/* Your Workspaces Tab */}
        <TabsContent value='workspaces' className='mt-6'>
          {isLoadingWorkspaces ? (
            <div
              className='grid gap-4 md:grid-cols-2'
              aria-label='Loading workspaces'
              aria-busy='true'
            >
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className='h-6 w-3/4' />
                    <Skeleton className='h-4 w-1/2 mt-2' />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className='h-10 w-full' />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : workspaces.length > 0 ? (
            <div className='grid gap-4 md:grid-cols-2'>
              {workspaces.map(workspace => (
                <Card
                  key={workspace.id}
                  className='hover:border-primary transition-colors cursor-pointer'
                  onClick={() => handleWorkspaceClick(workspace.slug)}
                  role='button'
                  tabIndex={0}
                  aria-label={`Open workspace: ${workspace.name}`}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleWorkspaceClick(workspace.slug);
                    }
                  }}
                >
                  <CardHeader>
                    <CardTitle>{workspace.name}</CardTitle>
                    <CardDescription>
                      {workspace.description ?? 'No description provided.'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className='flex items-center justify-between'>
                      <span className='text-sm text-muted-foreground'>
                        Role:{' '}
                        <span className='font-medium text-foreground'>
                          {ROLE_LABELS[workspace.role]}
                        </span>
                      </span>
                      <Button
                        size='sm'
                        variant='outline'
                        tabIndex={-1}
                        aria-hidden='true'
                      >
                        Open
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Create New Workspace Tile */}
              <Card
                className='hover:border-primary transition-colors cursor-pointer border-dashed'
                onClick={handleCreateWorkspace}
                role='button'
                tabIndex={0}
                aria-label='Create a new workspace'
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCreateWorkspace();
                  }
                }}
              >
                <CardContent className='flex flex-col items-center justify-center py-12'>
                  <div className='rounded-full bg-primary/10 p-4 mb-4'>
                    <Plus className='h-8 w-8 text-primary' />
                  </div>
                  <p className='text-lg font-medium'>Create New Workspace</p>
                  <p className='text-sm text-muted-foreground text-center mt-1'>
                    Set up a dedicated space for a new team or project
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className='flex flex-col items-center justify-center py-16'>
                <div className='rounded-full bg-muted p-4 mb-4'>
                  <LayoutGrid className='h-6 w-6 text-muted-foreground' />
                </div>
                <p className='text-lg font-medium mb-2'>No workspaces yet</p>
                <p className='text-sm text-muted-foreground text-center max-w-md mb-6'>
                  You don&apos;t belong to any workspaces with this account.
                  Create your first workspace to get started.
                </p>
                <Button onClick={handleCreateWorkspace} size='lg'>
                  <Plus className='mr-2 h-5 w-5' />
                  Create Your First Workspace
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Pending Invites Tab */}
        <TabsContent value='invites' className='mt-6'>
          {isLoadingInvites ? (
            <div
              className='space-y-4'
              aria-label='Loading invitations'
              aria-busy='true'
            >
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className='h-6 w-3/4' />
                    <Skeleton className='h-4 w-1/2 mt-2' />
                  </CardHeader>
                  <CardContent>
                    <div className='flex gap-2'>
                      <Skeleton className='h-10 flex-1' />
                      <Skeleton className='h-10 flex-1' />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : invites.length > 0 ? (
            <div
              className='space-y-4'
              role='list'
              aria-label='Pending invitations'
            >
              {invites.map(invite => (
                <Card key={invite.id} role='listitem'>
                  <CardHeader>
                    <CardTitle>{invite.workspaceName}</CardTitle>
                    <CardDescription>
                      Invited by{' '}
                      <span className='font-medium text-foreground'>
                        {invite.invitedBy}
                      </span>{' '}
                      on{' '}
                      {new Date(invite.createdAt).toLocaleDateString(
                        undefined,
                        {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        }
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className='flex gap-2'>
                      <Button
                        className='flex-1'
                        onClick={() => handleAcceptInvite(invite.id)}
                        disabled={processingInvite === invite.id}
                        aria-label={`Accept invitation to ${invite.workspaceName}`}
                      >
                        {processingInvite === invite.id
                          ? 'Accepting...'
                          : 'Accept'}
                      </Button>
                      <Button
                        variant='outline'
                        className='flex-1'
                        onClick={() => handleDeclineInvite(invite.id)}
                        disabled={processingInvite === invite.id}
                        aria-label={`Decline invitation to ${invite.workspaceName}`}
                      >
                        {processingInvite === invite.id
                          ? 'Declining...'
                          : 'Decline'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className='flex flex-col items-center justify-center py-16'>
                <div className='rounded-full bg-muted p-4 mb-4'>
                  <Inbox className='h-6 w-6 text-muted-foreground' />
                </div>
                <p className='text-lg font-medium mb-2'>
                  No pending invitations
                </p>
                <p className='text-sm text-muted-foreground text-center max-w-md'>
                  You&apos;re all caught up. Workspace invitations sent to your
                  email address will appear here.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Link Account Tab */}
        <TabsContent value='link' className='mt-6'>
          <Card>
            <CardHeader>
              <CardTitle>Link Another Account</CardTitle>
              <CardDescription>
                Connect an additional sign-in method to access workspaces
                associated with other email addresses, all from one place.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-3'>
                <Button
                  variant='outline'
                  size='lg'
                  className='w-full'
                  onClick={() => handleLinkAccount('google')}
                  disabled={linkingAccount}
                  aria-label='Link a Google account'
                >
                  <GoogleIcon className='mr-2 h-5 w-5' />
                  {linkingAccount ? 'Connecting...' : 'Link Google Account'}
                </Button>

                <Button
                  variant='outline'
                  size='lg'
                  className='w-full'
                  onClick={() => handleLinkAccount('github')}
                  disabled={linkingAccount}
                  aria-label='Link a GitHub account'
                >
                  <GitHubIcon className='mr-2 h-5 w-5' />
                  {linkingAccount ? 'Connecting...' : 'Link GitHub Account'}
                </Button>
              </div>

              <div className='rounded-md bg-muted p-4 text-sm'>
                <p className='font-medium mb-2'>How it works</p>
                <ul className='list-disc list-inside space-y-1 text-muted-foreground'>
                  <li>Sign in with another account to link it</li>
                  <li>Both accounts are associated automatically</li>
                  <li>All your workspaces appear together in one view</li>
                  <li>Switch between linked accounts at any time</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
