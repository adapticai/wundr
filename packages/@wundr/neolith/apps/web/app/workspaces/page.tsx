'use client';

import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GitHubIcon, GoogleIcon } from '@/components/icons';

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
      setError(err instanceof Error ? err.message : 'Failed to load workspaces');
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
          // No invites endpoint yet - set empty array
          setInvites([]);
          return;
        }
        throw new Error('Failed to fetch invites');
      }
      const data = await response.json();
      setInvites(data.invites || []);
    } catch (err) {
      console.error('Error fetching invites:', err);
      // Don't set error for invites - it's optional
      setInvites([]);
    } finally {
      setIsLoadingInvites(false);
    }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    try {
      setProcessingInvite(inviteId);
      const response = await fetch(`/api/workspaces/invites/${inviteId}/accept`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to accept invite');
      }

      // Refresh both lists
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
      const response = await fetch(`/api/workspaces/invites/${inviteId}/decline`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to decline invite');
      }

      // Refresh invites list
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
      await signIn(provider, {
        callbackUrl: '/workspaces',
      });
    } catch (err) {
      console.error('Error linking account:', err);
      setError('Failed to link account');
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
    <div className="max-w-5xl mx-auto py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Workspaces</h1>
        <p className="text-muted-foreground mt-2">
          Access and manage your workspaces or link another account
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          <p className="font-medium">Error</p>
          <p className="mt-1">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => setError(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="workspaces" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="workspaces">Your Workspaces</TabsTrigger>
          <TabsTrigger value="invites">
            Pending Invites
            {invites.length > 0 && (
              <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {invites.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="link">Link Account</TabsTrigger>
        </TabsList>

        {/* Your Workspaces Tab */}
        <TabsContent value="workspaces" className="mt-6">
          {isLoadingWorkspaces ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-10 bg-muted rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : workspaces.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {workspaces.map((workspace) => (
                <Card
                  key={workspace.id}
                  className="hover:border-primary transition-colors cursor-pointer"
                  onClick={() => handleWorkspaceClick(workspace.id)}
                >
                  <CardHeader>
                    <CardTitle>{workspace.name}</CardTitle>
                    <CardDescription>
                      {workspace.description || 'No description'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Role: <span className="font-medium">{workspace.role}</span>
                      </span>
                      <Button size="sm" variant="outline">
                        Open
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Create New Workspace Tile */}
              <Card
                className="hover:border-primary transition-colors cursor-pointer border-dashed"
                onClick={handleCreateWorkspace}
              >
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="rounded-full bg-primary/10 p-4 mb-4">
                    <PlusIcon className="h-8 w-8 text-primary" />
                  </div>
                  <p className="text-lg font-medium">Create New Workspace</p>
                  <p className="text-sm text-muted-foreground text-center mt-1">
                    Set up a new workspace
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <WorkspaceIcon />
                </div>
                <p className="text-lg font-medium mb-2">No workspaces found</p>
                <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                  You don&apos;t have access to any workspaces with this account.
                  Create a new workspace to get started.
                </p>
                <Button onClick={handleCreateWorkspace} size="lg">
                  <PlusIcon className="mr-2 h-5 w-5" />
                  Create New Workspace
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Pending Invites Tab */}
        <TabsContent value="invites" className="mt-6">
          {isLoadingInvites ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <div className="h-10 bg-muted rounded flex-1" />
                      <div className="h-10 bg-muted rounded flex-1" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : invites.length > 0 ? (
            <div className="space-y-4">
              {invites.map((invite) => (
                <Card key={invite.id}>
                  <CardHeader>
                    <CardTitle>{invite.workspaceName}</CardTitle>
                    <CardDescription>
                      Invited by {invite.invitedBy} on{' '}
                      {new Date(invite.createdAt).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        onClick={() => handleAcceptInvite(invite.id)}
                        disabled={processingInvite === invite.id}
                      >
                        {processingInvite === invite.id ? 'Accepting...' : 'Accept'}
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleDeclineInvite(invite.id)}
                        disabled={processingInvite === invite.id}
                      >
                        {processingInvite === invite.id ? 'Declining...' : 'Decline'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <InboxIcon />
                </div>
                <p className="text-lg font-medium mb-2">No pending invites</p>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  You don&apos;t have any pending workspace invitations at the moment.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Link Account Tab */}
        <TabsContent value="link" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Link Another Account</CardTitle>
              <CardDescription>
                Sign in with another email account to access workspaces associated
                with that account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={() => handleLinkAccount('google')}
                  disabled={linkingAccount}
                >
                  <GoogleIcon className="mr-2 h-5 w-5" />
                  {linkingAccount ? 'Connecting...' : 'Link Google Account'}
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={() => handleLinkAccount('github')}
                  disabled={linkingAccount}
                >
                  <GitHubIcon className="mr-2 h-5 w-5" />
                  {linkingAccount ? 'Connecting...' : 'Link GitHub Account'}
                </Button>
              </div>

              <div className="rounded-md bg-muted p-4 text-sm">
                <p className="font-medium mb-2">How it works</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Sign in with another email account</li>
                  <li>Your accounts will be linked automatically</li>
                  <li>
                    Access workspaces from all linked accounts in one place
                  </li>
                  <li>Switch between accounts seamlessly</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function WorkspaceIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-muted-foreground"
    >
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-muted-foreground"
    >
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}
