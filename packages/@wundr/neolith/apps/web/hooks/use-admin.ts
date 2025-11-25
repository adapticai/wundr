'use client';

import { useState, useCallback, useEffect } from 'react';
import useSWR from 'swr';

// =============================================================================
// Types
// =============================================================================

/**
 * Member status in the workspace
 */
export type MemberStatus = 'active' | 'suspended' | 'pending';

/**
 * Workspace member information
 */
export interface Member {
  /** Unique member ID */
  id: string;
  /** Member's display name */
  name: string | null;
  /** Member's email address */
  email: string | null;
  /** Current membership status */
  status: MemberStatus;
  /** ID of the assigned role */
  roleId: string | null;
  /** Role details if included */
  role?: Role;
  /** When the member joined */
  joinedAt: Date;
  /** Last activity timestamp */
  lastActiveAt?: Date;
  /** Profile image URL */
  image?: string | null;
}

/**
 * Role definition for workspace permissions
 */
export interface Role {
  /** Unique role ID */
  id: string;
  /** Display name of the role */
  name: string;
  /** Description of the role's purpose */
  description?: string;
  /** List of permission identifiers */
  permissions: string[];
  /** Whether this is the default role for new members */
  isDefault?: boolean;
  /** Number of members with this role */
  memberCount?: number;
}

/**
 * Invite status for workspace invitations
 */
export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

/**
 * Workspace invitation
 */
export interface Invite {
  /** Unique invite ID */
  id: string;
  /** Email address the invite was sent to */
  email: string;
  /** ID of the role assigned to the invite */
  roleId?: string;
  /** Current invite status */
  status: InviteStatus;
  /** When the invite expires */
  expiresAt: Date;
  /** When the invite was created */
  createdAt: Date;
  /** ID of the user who created the invite */
  invitedBy?: string;
}

/**
 * Notification default settings
 */
export interface NotificationDefaults {
  /** Whether email notifications are enabled by default */
  email: boolean;
  /** Whether push notifications are enabled by default */
  push: boolean;
  /** Whether desktop notifications are enabled by default */
  desktop: boolean;
}

/**
 * Workspace visibility settings
 */
export type WorkspaceVisibility = 'public' | 'private';

/**
 * Workspace settings configuration
 */
export interface WorkspaceSettings {
  /** Workspace display name */
  name: string;
  /** URL-friendly slug */
  slug: string;
  /** Workspace description */
  description?: string;
  /** Visibility setting */
  visibility: WorkspaceVisibility;
  /** Whether guest access is allowed */
  allowGuestAccess: boolean;
  /** Default role ID for new members */
  defaultRole?: string;
  /** Message retention period in days */
  messageRetention?: number;
  /** File retention period in days */
  fileRetention?: number;
  /** Whether 2FA is required */
  twoFactorRequired: boolean;
  /** Whether SSO is enabled */
  ssoEnabled: boolean;
  /** Default notification settings */
  notificationDefaults: NotificationDefaults;
}

/**
 * Billing plan types
 */
export type BillingPlan = 'free' | 'starter' | 'pro' | 'enterprise';

/**
 * Billing status types
 */
export type BillingStatus = 'active' | 'past_due' | 'canceled' | 'trialing';

/**
 * Invoice status types
 */
export type InvoiceStatus = 'paid' | 'pending' | 'failed';

/**
 * Invoice record
 */
export interface Invoice {
  /** Unique invoice ID */
  id: string;
  /** Invoice amount in cents */
  amount: number;
  /** Currency code (e.g., 'USD') */
  currency: string;
  /** Payment status */
  status: InvoiceStatus;
  /** Invoice date */
  date: Date;
  /** URL to download the invoice PDF */
  pdfUrl?: string;
}

/**
 * Billing information for the workspace
 */
export interface BillingInfo {
  /** Current billing plan */
  plan: BillingPlan;
  /** Subscription status */
  status: BillingStatus;
  /** When the current billing period ends */
  currentPeriodEnd?: Date;
  /** Maximum number of members allowed */
  memberLimit: number;
  /** Maximum storage in bytes */
  storageLimit: number;
  /** Current storage used in bytes */
  storageUsed: number;
  /** List of enabled features */
  features: string[];
  /** Invoice history */
  invoices: Invoice[];
}

/**
 * Admin action types for audit logging
 */
export type AdminActionType =
  | 'member.invited'
  | 'member.removed'
  | 'member.suspended'
  | 'member.unsuspended'
  | 'member.role_changed'
  | 'role.created'
  | 'role.updated'
  | 'role.deleted'
  | 'settings.updated'
  | 'billing.plan_changed'
  | 'channel.created'
  | 'channel.deleted'
  | 'channel.archived'
  | string;

/**
 * Admin action details with structured data
 */
export interface AdminActionDetails {
  /** Previous value for change actions */
  previousValue?: string | number | boolean;
  /** New value for change actions */
  newValue?: string | number | boolean;
  /** Reason for the action */
  reason?: string;
  /** IP address of the actor */
  ipAddress?: string;
  /** User agent of the actor */
  userAgent?: string;
  /** Additional context */
  [key: string]: string | number | boolean | undefined;
}

/**
 * Admin action for audit logging
 */
export interface AdminAction {
  /** Unique action ID */
  id: string;
  /** Type of action performed */
  type: AdminActionType;
  /** ID of the user who performed the action */
  actorId: string;
  /** Display name of the actor */
  actorName?: string;
  /** Type of entity affected (e.g., 'member', 'role', 'channel') */
  targetType?: string;
  /** ID of the affected entity */
  targetId?: string;
  /** Display name of the affected entity */
  targetName?: string;
  /** Additional details about the action */
  details?: AdminActionDetails;
  /** When the action was performed */
  createdAt: Date;
}

// =============================================================================
// Fetcher
// =============================================================================

/**
 * Generic fetcher function for SWR
 */
const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch');
  }
  return res.json() as Promise<T>;
};

// =============================================================================
// useMembers Hook
// =============================================================================

/**
 * Options for filtering members
 */
export interface UseMembersOptions {
  /** Filter by member status */
  status?: MemberStatus;
  /** Search query for name or email */
  search?: string;
  /** Maximum number of members per page */
  limit?: number;
}

/**
 * Return type for the useMembers hook
 */
export interface UseMembersReturn {
  /** List of workspace members */
  members: Member[];
  /** Total count of members (ignoring pagination) */
  total: number;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Whether there are more members to load */
  hasMore: boolean;
  /** Error object if fetch failed */
  error?: Error;
  /** Function to load the next page of members */
  loadMore: () => void;
  /** Update a member's information */
  updateMember: (memberId: string, updates: Partial<Member>) => Promise<void>;
  /** Suspend a member */
  suspendMember: (memberId: string) => Promise<void>;
  /** Remove a member from the workspace */
  removeMember: (memberId: string) => Promise<void>;
}

/**
 * Hook for managing workspace members
 *
 * Provides paginated access to workspace members with filtering,
 * searching, and mutation capabilities.
 *
 * @param workspaceId - The workspace ID
 * @param options - Optional filtering and pagination options
 * @returns Members data and management functions
 *
 * @example
 * ```tsx
 * function MembersList() {
 *   const { members, isLoading, updateMember, suspendMember } = useMembers(
 *     'workspace-123',
 *     { status: 'active', limit: 20 }
 *   );
 *
 *   return (
 *     <ul>
 *       {members.map(member => (
 *         <li key={member.id}>{member.name}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useMembers(
  workspaceId: string,
  options: UseMembersOptions = {},
): UseMembersReturn {
  const [page, setPage] = useState(1);
  const limit = options.limit ?? 50;

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(options.status && { status: options.status }),
    ...(options.search && { search: options.search }),
  });

  const { data, error, isLoading, mutate } = useSWR<{
    members: Member[];
    total: number;
    hasMore: boolean;
  }>(`/api/workspaces/${workspaceId}/members?${queryParams}`, fetcher);

  const updateMember = useCallback(
    async (memberId: string, updates: Partial<Member>) => {
      await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      await mutate();
    },
    [workspaceId, mutate],
  );

  const suspendMember = useCallback(
    async (memberId: string) => {
      await fetch(`/api/workspaces/${workspaceId}/members/${memberId}/suspend`, {
        method: 'POST',
      });
      await mutate();
    },
    [workspaceId, mutate],
  );

  const removeMember = useCallback(
    async (memberId: string) => {
      await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
        method: 'DELETE',
      });
      await mutate();
    },
    [workspaceId, mutate],
  );

  return {
    members: data?.members ?? [],
    total: data?.total ?? 0,
    isLoading,
    hasMore: data?.hasMore ?? false,
    error: error as Error | undefined,
    loadMore: () => setPage((p) => p + 1),
    updateMember,
    suspendMember,
    removeMember,
  };
}

// =============================================================================
// useRoles Hook
// =============================================================================

/**
 * Return type for the useRoles hook
 */
export interface UseRolesReturn {
  /** List of roles in the workspace */
  roles: Role[];
  /** Whether roles are currently loading */
  isLoading: boolean;
  /** Error object if fetch failed */
  error?: Error;
  /** Create a new role */
  createRole: (role: Omit<Role, 'id'>) => Promise<Role>;
  /** Update an existing role */
  updateRole: (roleId: string, updates: Partial<Role>) => Promise<void>;
  /** Delete a role */
  deleteRole: (roleId: string) => Promise<void>;
}

/**
 * Hook for managing workspace roles
 *
 * Provides CRUD operations for workspace roles and permissions.
 *
 * @param workspaceId - The workspace ID
 * @returns Roles data and management functions
 *
 * @example
 * ```tsx
 * function RolesManager() {
 *   const { roles, createRole, updateRole, deleteRole } = useRoles('workspace-123');
 *
 *   const handleCreateRole = async () => {
 *     await createRole({
 *       name: 'Editor',
 *       description: 'Can edit content',
 *       permissions: ['content.edit', 'content.read']
 *     });
 *   };
 *
 *   return <RoleList roles={roles} />;
 * }
 * ```
 */
export function useRoles(workspaceId: string): UseRolesReturn {
  const { data, error, isLoading, mutate } = useSWR<{ roles: Role[] }>(
    `/api/workspaces/${workspaceId}/roles`,
    fetcher,
  );

  const createRole = useCallback(
    async (role: Omit<Role, 'id'>): Promise<Role> => {
      const res = await fetch(`/api/workspaces/${workspaceId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(role),
      });
      const created = await res.json();
      await mutate();
      return created;
    },
    [workspaceId, mutate],
  );

  const updateRole = useCallback(
    async (roleId: string, updates: Partial<Role>) => {
      await fetch(`/api/workspaces/${workspaceId}/roles/${roleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      await mutate();
    },
    [workspaceId, mutate],
  );

  const deleteRole = useCallback(
    async (roleId: string) => {
      await fetch(`/api/workspaces/${workspaceId}/roles/${roleId}`, {
        method: 'DELETE',
      });
      await mutate();
    },
    [workspaceId, mutate],
  );

  return {
    roles: data?.roles ?? [],
    isLoading,
    error: error as Error | undefined,
    createRole,
    updateRole,
    deleteRole,
  };
}

// =============================================================================
// useInvites Hook
// =============================================================================

/**
 * Return type for the useInvites hook
 */
export interface UseInvitesReturn {
  /** List of pending and recent invites */
  invites: Invite[];
  /** Whether invites are currently loading */
  isLoading: boolean;
  /** Error object if fetch failed */
  error?: Error;
  /** Send invites to multiple email addresses */
  createInvites: (emails: string[], roleId?: string) => Promise<void>;
  /** Revoke a pending invite */
  revokeInvite: (inviteId: string) => Promise<void>;
  /** Resend an invite email */
  resendInvite: (inviteId: string) => Promise<void>;
}

/**
 * Hook for managing workspace invitations
 *
 * Provides functionality to send, revoke, and resend workspace invitations.
 *
 * @param workspaceId - The workspace ID
 * @returns Invites data and management functions
 *
 * @example
 * ```tsx
 * function InviteManager() {
 *   const { invites, createInvites, revokeInvite } = useInvites('workspace-123');
 *
 *   const handleInvite = async () => {
 *     await createInvites(['user@example.com'], 'role-123');
 *   };
 *
 *   return <InviteList invites={invites} />;
 * }
 * ```
 */
export function useInvites(workspaceId: string): UseInvitesReturn {
  const { data, error, isLoading, mutate } = useSWR<{ invites: Invite[] }>(
    `/api/workspaces/${workspaceId}/invites`,
    fetcher,
  );

  const createInvites = useCallback(
    async (emails: string[], roleId?: string) => {
      await fetch(`/api/workspaces/${workspaceId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails, roleId }),
      });
      await mutate();
    },
    [workspaceId, mutate],
  );

  const revokeInvite = useCallback(
    async (inviteId: string) => {
      await fetch(`/api/workspaces/${workspaceId}/invites/${inviteId}`, {
        method: 'DELETE',
      });
      await mutate();
    },
    [workspaceId, mutate],
  );

  const resendInvite = useCallback(
    async (inviteId: string) => {
      await fetch(`/api/workspaces/${workspaceId}/invites/${inviteId}/resend`, {
        method: 'POST',
      });
    },
    [workspaceId],
  );

  return {
    invites: data?.invites ?? [],
    isLoading,
    error: error as Error | undefined,
    createInvites,
    revokeInvite,
    resendInvite,
  };
}

// =============================================================================
// useWorkspaceSettings Hook
// =============================================================================

/**
 * Return type for the useWorkspaceSettings hook
 */
export interface UseWorkspaceSettingsReturn {
  /** Current workspace settings */
  settings: WorkspaceSettings | null;
  /** Whether settings are currently loading */
  isLoading: boolean;
  /** Error object if fetch failed */
  error?: Error;
  /** Update workspace settings */
  updateSettings: (updates: Partial<WorkspaceSettings>) => Promise<void>;
}

/**
 * Hook for managing workspace settings
 *
 * Provides access to and modification of workspace-level configuration.
 *
 * @param workspaceId - The workspace ID
 * @returns Settings data and update function
 *
 * @example
 * ```tsx
 * function SettingsForm() {
 *   const { settings, updateSettings } = useWorkspaceSettings('workspace-123');
 *
 *   const handleSave = async () => {
 *     await updateSettings({ name: 'New Workspace Name' });
 *   };
 *
 *   return <Form initialData={settings} onSubmit={handleSave} />;
 * }
 * ```
 */
export function useWorkspaceSettings(workspaceId: string): UseWorkspaceSettingsReturn {
  const { data, error, isLoading, mutate } = useSWR<{ settings: WorkspaceSettings }>(
    `/api/workspaces/${workspaceId}/settings`,
    fetcher,
  );

  const updateSettings = useCallback(
    async (updates: Partial<WorkspaceSettings>) => {
      await fetch(`/api/workspaces/${workspaceId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      await mutate();
    },
    [workspaceId, mutate],
  );

  return {
    settings: data?.settings ?? null,
    isLoading,
    error: error as Error | undefined,
    updateSettings,
  };
}

// =============================================================================
// useBilling Hook
// =============================================================================

/**
 * Return type for the useBilling hook
 */
export interface UseBillingReturn {
  /** Current billing information */
  billing: BillingInfo | null;
  /** Whether billing data is currently loading */
  isLoading: boolean;
  /** Error object if fetch failed */
  error?: Error;
  /** Change the subscription plan */
  updatePlan: (plan: BillingPlan) => Promise<void>;
  /** Cancel the subscription */
  cancelSubscription: () => Promise<void>;
  /** Download an invoice PDF */
  downloadInvoice: (invoiceId: string) => Promise<void>;
}

/**
 * Hook for managing workspace billing
 *
 * Provides access to billing information, plan changes, and invoice management.
 *
 * @param workspaceId - The workspace ID
 * @returns Billing data and management functions
 *
 * @example
 * ```tsx
 * function BillingPage() {
 *   const { billing, updatePlan, cancelSubscription } = useBilling('workspace-123');
 *
 *   const handleUpgrade = async () => {
 *     await updatePlan('pro');
 *   };
 *
 *   return <BillingDetails billing={billing} onUpgrade={handleUpgrade} />;
 * }
 * ```
 */
export function useBilling(workspaceId: string): UseBillingReturn {
  const { data, error, isLoading, mutate } = useSWR<{ billing: BillingInfo }>(
    `/api/workspaces/${workspaceId}/billing`,
    fetcher,
  );

  const updatePlan = useCallback(
    async (plan: BillingInfo['plan']) => {
      await fetch(`/api/workspaces/${workspaceId}/billing/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      await mutate();
    },
    [workspaceId, mutate],
  );

  const cancelSubscription = useCallback(async () => {
    await fetch(`/api/workspaces/${workspaceId}/billing/cancel`, {
      method: 'POST',
    });
    await mutate();
  }, [workspaceId, mutate]);

  const downloadInvoice = useCallback(
    async (invoiceId: string) => {
      const res = await fetch(`/api/workspaces/${workspaceId}/billing/invoices/${invoiceId}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [workspaceId],
  );

  return {
    billing: data?.billing ?? null,
    isLoading,
    error: error as Error | undefined,
    updatePlan,
    cancelSubscription,
    downloadInvoice,
  };
}

// =============================================================================
// useAdminActivity Hook
// =============================================================================

/**
 * Options for filtering admin activity
 */
export interface UseAdminActivityOptions {
  /** Filter by action type */
  type?: AdminActionType;
  /** Filter by actor ID */
  actorId?: string;
  /** Maximum number of activities per page */
  limit?: number;
}

/**
 * Return type for the useAdminActivity hook
 */
export interface UseAdminActivityReturn {
  /** List of admin activities */
  activities: AdminAction[];
  /** Total count of activities (ignoring pagination) */
  total: number;
  /** Whether activities are currently loading */
  isLoading: boolean;
  /** Whether there are more activities to load */
  hasMore: boolean;
  /** Error object if fetch failed */
  error?: Error;
  /** Load the next page of activities */
  loadMore: () => void;
  /** Refresh the activity list */
  refresh: () => void;
}

/**
 * Hook for viewing admin activity/audit log
 *
 * Provides paginated access to admin actions with filtering capabilities.
 *
 * @param workspaceId - The workspace ID
 * @param options - Optional filtering and pagination options
 * @returns Activity data and pagination functions
 *
 * @example
 * ```tsx
 * function ActivityLog() {
 *   const { activities, loadMore, hasMore } = useAdminActivity(
 *     'workspace-123',
 *     { type: 'member.invited', limit: 50 }
 *   );
 *
 *   return (
 *     <div>
 *       {activities.map(activity => (
 *         <ActivityItem key={activity.id} activity={activity} />
 *       ))}
 *       {hasMore && <button onClick={loadMore}>Load More</button>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAdminActivity(
  workspaceId: string,
  options: UseAdminActivityOptions = {},
): UseAdminActivityReturn {
  const [page, setPage] = useState(1);
  const [allActivities, setAllActivities] = useState<AdminAction[]>([]);
  const limit = options.limit ?? 50;

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(options.type && { type: options.type }),
    ...(options.actorId && { actorId: options.actorId }),
  });

  const { data, error, isLoading, mutate } = useSWR<{
    activities: AdminAction[];
    total: number;
    hasMore: boolean;
  }>(`/api/workspaces/${workspaceId}/activity?${queryParams}`, fetcher);

  useEffect(() => {
    if (data?.activities) {
      if (page === 1) {
        setAllActivities(data.activities);
      } else {
        setAllActivities((prev) => [...prev, ...data.activities]);
      }
    }
  }, [data, page]);

  return {
    activities: allActivities,
    total: data?.total ?? 0,
    isLoading,
    hasMore: data?.hasMore ?? false,
    error: error as Error | undefined,
    loadMore: () => setPage((p) => p + 1),
    refresh: () => {
      setPage(1);
      setAllActivities([]);
      mutate();
    },
  };
}

