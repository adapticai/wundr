'use client';

import { useCallback, useEffect, useState } from 'react';

// =============================================================================
// Types
// =============================================================================

/**
 * Workspace visibility enum
 */
export type WorkspaceVisibility = 'PUBLIC' | 'PRIVATE' | 'INTERNAL';

/**
 * Workspace role enum
 */
export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';

/**
 * Organization information
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  avatarUrl?: string | null;
  description?: string | null;
  settings?: Record<string, unknown>;
}

/**
 * Workspace settings
 */
export interface WorkspaceSettings {
  theme?: string;
  notifications?: boolean;
  [key: string]: unknown;
}

/**
 * Workspace data structure
 */
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  avatarUrl?: string | null;
  visibility: WorkspaceVisibility;
  settings: WorkspaceSettings;
  plan?: string;
  organizationId: string;
  organization?: Organization;
  createdAt: Date;
  updatedAt: Date;
  /** User's role in this workspace */
  role?: WorkspaceRole;
  /** Whether the user is a member of this workspace */
  isMember?: boolean;
  /** Count of members and channels */
  _count?: {
    workspaceMembers: number;
    channels: number;
  };
}

/**
 * Workspace invite status
 */
export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

/**
 * User information for invites
 */
export interface InviteUser {
  id: string;
  email: string;
  name?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
}

/**
 * Workspace invite data structure
 */
export interface WorkspaceInvite {
  id: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
    avatarUrl?: string | null;
    organization?: {
      id: string;
      name: string;
      slug: string;
    };
  };
  invitedBy: InviteUser;
  role: WorkspaceRole;
  status: InviteStatus;
  createdAt: Date;
  expiresAt?: Date | null;
}

/**
 * Response from /api/workspaces (paginated)
 */
export interface WorkspacesResponse {
  data: Workspace[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * Return type for the useUserWorkspaces hook
 */
export interface UseUserWorkspacesReturn {
  /** All workspaces the user is a member of */
  workspaces: Workspace[];
  /** Pending workspace invites */
  invites: WorkspaceInvite[];
  /** Whether workspaces are loading */
  isLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Refetch workspaces and invites */
  refetch: () => Promise<void>;
}

// =============================================================================
// Hook: useUserWorkspaces
// =============================================================================

/**
 * Hook for fetching user's workspaces and pending invites
 *
 * Fetches from GET /api/user/workspaces which returns:
 * - workspaces: All workspaces the authenticated user is a member of
 * - invites: All pending workspace invitations
 *
 * @returns Object containing workspaces, invites, loading state, error, and refetch function
 *
 * @example
 * ```tsx
 * const { workspaces, invites, isLoading, error, refetch } = useUserWorkspaces();
 *
 * if (isLoading) return <Spinner />;
 * if (error) return <ErrorMessage error={error} />;
 *
 * return (
 *   <div>
 *     <h2>My Workspaces</h2>
 *     {workspaces.map(workspace => (
 *       <WorkspaceCard key={workspace.id} workspace={workspace} />
 *     ))}
 *
 *     {invites.length > 0 && (
 *       <div>
 *         <h2>Pending Invites</h2>
 *         {invites.map(invite => (
 *           <InviteCard key={invite.id} invite={invite} />
 *         ))}
 *       </div>
 *     )}
 *   </div>
 * );
 * ```
 */
export function useUserWorkspaces(): UseUserWorkspacesReturn {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUserWorkspaces = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/user/workspaces');

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch workspaces');
      }

      const data = await response.json();

      // Transform workspaces with date parsing and ensure proper types
      const transformedWorkspaces = (data.workspaces || []).map((workspace: any) => ({
        ...workspace,
        createdAt: new Date(workspace.createdAt),
        updatedAt: new Date(workspace.updatedAt),
        settings: workspace.settings || {},
        visibility: workspace.visibility || 'PRIVATE',
      }));

      // Transform invites with date parsing
      const transformedInvites = (data.invites || []).map((invite: any) => ({
        ...invite,
        createdAt: new Date(invite.createdAt),
        expiresAt: invite.expiresAt ? new Date(invite.expiresAt) : null,
      }));

      setWorkspaces(transformedWorkspaces);
      setInvites(transformedInvites);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setWorkspaces([]);
      setInvites([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserWorkspaces();
  }, [fetchUserWorkspaces]);

  return {
    workspaces,
    invites,
    isLoading,
    error,
    refetch: fetchUserWorkspaces,
  };
}

// =============================================================================
// Hook: useWorkspace
// =============================================================================

export interface UseWorkspaceReturn {
  workspace: Workspace | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Fetches a single workspace by ID
 *
 * @param workspaceId - The workspace ID to fetch
 * @returns Object containing workspace data, loading state, and refetch function
 *
 * @example
 * ```tsx
 * const { workspace, isLoading, error } = useWorkspace('workspace-123');
 * ```
 */
export function useWorkspace(workspaceId: string | null): UseWorkspaceReturn {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchWorkspace = useCallback(async () => {
    if (!workspaceId) {
      setWorkspace(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/workspaces/${workspaceId}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch workspace: ${response.statusText}`);
      }

      const result = await response.json();
      setWorkspace(result.data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch workspace');
      setError(error);
      console.error('[useWorkspace] Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  return {
    workspace,
    isLoading,
    error,
    refetch: fetchWorkspace,
  };
}
