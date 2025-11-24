'use client';

import { useState, useCallback, useEffect } from 'react';
import useSWR from 'swr';

// Types
interface Member {
  id: string;
  name: string | null;
  email: string | null;
  status: 'active' | 'suspended' | 'pending';
  roleId: string | null;
  role?: Role;
  joinedAt: Date;
  lastActiveAt?: Date;
  image?: string | null;
}

interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  isDefault?: boolean;
  memberCount?: number;
}

interface Invite {
  id: string;
  email: string;
  roleId?: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: Date;
  createdAt: Date;
  invitedBy?: string;
}

interface WorkspaceSettings {
  name: string;
  slug: string;
  description?: string;
  visibility: 'public' | 'private';
  allowGuestAccess: boolean;
  defaultRole?: string;
  messageRetention?: number;
  fileRetention?: number;
  twoFactorRequired: boolean;
  ssoEnabled: boolean;
  notificationDefaults: {
    email: boolean;
    push: boolean;
    desktop: boolean;
  };
}

interface BillingInfo {
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  currentPeriodEnd?: Date;
  memberLimit: number;
  storageLimit: number;
  storageUsed: number;
  features: string[];
  invoices: Invoice[];
}

interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed';
  date: Date;
  pdfUrl?: string;
}

interface AdminAction {
  id: string;
  type: string;
  actorId: string;
  actorName?: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  details?: Record<string, unknown>;
  createdAt: Date;
}

// Fetcher
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
throw new Error('Failed to fetch');
}
  return res.json();
};

// Members Hook
interface UseMembersOptions {
  status?: 'active' | 'suspended' | 'pending';
  search?: string;
  limit?: number;
}

interface UseMembersReturn {
  members: Member[];
  total: number;
  isLoading: boolean;
  hasMore: boolean;
  error?: Error;
  loadMore: () => void;
  updateMember: (memberId: string, updates: Partial<Member>) => Promise<void>;
  suspendMember: (memberId: string) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
}

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

// Roles Hook
interface UseRolesReturn {
  roles: Role[];
  isLoading: boolean;
  error?: Error;
  createRole: (role: Omit<Role, 'id'>) => Promise<Role>;
  updateRole: (roleId: string, updates: Partial<Role>) => Promise<void>;
  deleteRole: (roleId: string) => Promise<void>;
}

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

// Invites Hook
interface UseInvitesReturn {
  invites: Invite[];
  isLoading: boolean;
  error?: Error;
  createInvites: (emails: string[], roleId?: string) => Promise<void>;
  revokeInvite: (inviteId: string) => Promise<void>;
  resendInvite: (inviteId: string) => Promise<void>;
}

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

// Workspace Settings Hook
interface UseWorkspaceSettingsReturn {
  settings: WorkspaceSettings | null;
  isLoading: boolean;
  error?: Error;
  updateSettings: (updates: Partial<WorkspaceSettings>) => Promise<void>;
}

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

// Billing Hook
interface UseBillingReturn {
  billing: BillingInfo | null;
  isLoading: boolean;
  error?: Error;
  updatePlan: (plan: BillingInfo['plan']) => Promise<void>;
  cancelSubscription: () => Promise<void>;
  downloadInvoice: (invoiceId: string) => Promise<void>;
}

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

// Admin Activity Hook
interface UseAdminActivityOptions {
  type?: string;
  actorId?: string;
  limit?: number;
}

interface UseAdminActivityReturn {
  activities: AdminAction[];
  total: number;
  isLoading: boolean;
  hasMore: boolean;
  error?: Error;
  loadMore: () => void;
  refresh: () => void;
}

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

// Export types
export type {
  Member,
  Role,
  Invite,
  WorkspaceSettings,
  BillingInfo,
  Invoice,
  AdminAction,
  UseMembersOptions,
  UseMembersReturn,
  UseRolesReturn,
  UseInvitesReturn,
  UseWorkspaceSettingsReturn,
  UseBillingReturn,
  UseAdminActivityOptions,
  UseAdminActivityReturn,
};
