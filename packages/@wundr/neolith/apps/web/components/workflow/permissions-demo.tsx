'use client';

/**
 * Demo/Example: Workflow Permissions Integration
 *
 * This file demonstrates how to integrate the workflow permissions
 * and sharing components into a workflow settings page.
 *
 * NOTE: This is an example file showing integration patterns.
 * Adapt the API calls and state management to your specific implementation.
 */

import React, { useState, useCallback } from 'react';

import {
  WorkflowPermissions,
  ShareDialog,
  QuickShareButton,
  type WorkflowPermission,
  type WorkflowAccessLog,
  type WorkflowSharingConfig,
  type WorkflowPermissionLevel,
  type PermissionSubjectType,
  type ShareableEntity,
  type ShareRecipient,
} from '@/components/workflow';
import { useToast } from '@/hooks/use-toast';

import type { WorkflowId } from '@/types/workflow';

interface WorkflowPermissionsPageProps {
  workflowId: WorkflowId;
  workflowName: string;
  workspaceSlug: string;
}

/**
 * Example integration of workflow permissions and sharing
 */
export function WorkflowPermissionsPage({
  workflowId,
  workflowName,
  workspaceSlug,
}: WorkflowPermissionsPageProps) {
  const { toast } = useToast();

  // State management
  const [permissions, setPermissions] = useState<WorkflowPermission[]>([
    // Example data - replace with API fetch
    {
      id: 'perm-1',
      subjectType: 'user',
      subjectId: 'user-1',
      subjectName: 'John Doe',
      subjectEmail: 'john@example.com',
      subjectAvatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=john',
      level: 'edit',
      grantedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      grantedBy: 'admin-1',
    },
    {
      id: 'perm-2',
      subjectType: 'team',
      subjectId: 'team-1',
      subjectName: 'Engineering Team',
      level: 'view',
      inheritedFrom: 'workspace',
      grantedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
      grantedBy: 'admin-1',
    },
  ]);

  const [accessLog, setAccessLog] = useState<WorkflowAccessLog[]>([
    // Example data - replace with API fetch
    {
      id: 'log-1',
      userId: 'user-1',
      userName: 'John Doe',
      userAvatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=john',
      action: 'edited',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      details: 'Updated workflow trigger configuration',
    },
    {
      id: 'log-2',
      userId: 'user-2',
      userName: 'Jane Smith',
      userAvatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jane',
      action: 'executed',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
    },
  ]);

  const [sharingConfig, setSharingConfig] = useState<WorkflowSharingConfig>({
    visibility: 'workspace',
    allowPublicAccess: false,
    requireApproval: false,
    inheritWorkspacePermissions: true,
  });

  const [workspacePermissions] = useState<WorkflowPermission[]>([
    // Example inherited permissions
    {
      id: 'wp-1',
      subjectType: 'team',
      subjectId: 'team-1',
      subjectName: 'Engineering Team',
      level: 'view',
      inheritedFrom: 'workspace',
      grantedAt: new Date(Date.now() - 86400000 * 30).toISOString(),
      grantedBy: 'system',
    },
  ]);

  const [currentShares] = useState<ShareableEntity[]>([
    // Users/teams currently with access
    {
      id: 'user-1',
      type: 'user',
      name: 'John Doe',
      email: 'john@example.com',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=john',
      currentPermission: 'edit',
    },
  ]);

  // API interaction handlers
  const handleUpdatePermission = useCallback(
    async (permissionId: string, level: WorkflowPermissionLevel) => {
      try {
        // Replace with actual API call
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/workflows/${workflowId}/permissions/${permissionId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ level }),
          },
        );

        if (!response.ok) {
throw new Error('Failed to update permission');
}

        // Update local state
        setPermissions((prev) =>
          prev.map((p) => (p.id === permissionId ? { ...p, level } : p)),
        );

        // Add to access log
        setAccessLog((prev) => [
          {
            id: `log-${Date.now()}`,
            userId: 'current-user',
            userName: 'You',
            action: 'permission_changed',
            timestamp: new Date().toISOString(),
            details: `Changed permission to ${level}`,
          },
          ...prev,
        ]);

        toast({
          title: 'Permission updated',
          description: 'Permission level has been updated successfully.',
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to update permission. Please try again.',
          variant: 'destructive',
        });
      }
    },
    [workflowId, workspaceSlug, toast],
  );

  const handleRemovePermission = useCallback(
    async (permissionId: string) => {
      try {
        // Replace with actual API call
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/workflows/${workflowId}/permissions/${permissionId}`,
          {
            method: 'DELETE',
          },
        );

        if (!response.ok) {
throw new Error('Failed to remove permission');
}

        // Update local state
        setPermissions((prev) => prev.filter((p) => p.id !== permissionId));

        toast({
          title: 'Permission removed',
          description: 'Access has been revoked successfully.',
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to remove permission. Please try again.',
          variant: 'destructive',
        });
      }
    },
    [workflowId, workspaceSlug, toast],
  );

  const handleAddPermission = useCallback(
    async (
      subjectType: PermissionSubjectType,
      subjectId: string,
      level: WorkflowPermissionLevel,
    ) => {
      try {
        // Replace with actual API call
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/workflows/${workflowId}/permissions`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subjectType, subjectId, level }),
          },
        );

        if (!response.ok) {
throw new Error('Failed to add permission');
}

        const newPermission = await response.json();
        setPermissions((prev) => [...prev, newPermission]);

        toast({
          title: 'Permission added',
          description: 'Access has been granted successfully.',
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to add permission. Please try again.',
          variant: 'destructive',
        });
      }
    },
    [workflowId, workspaceSlug, toast],
  );

  const handleUpdateSharingConfig = useCallback(
    async (config: Partial<WorkflowSharingConfig>) => {
      try {
        // Replace with actual API call
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/workflows/${workflowId}/sharing-config`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
          },
        );

        if (!response.ok) {
throw new Error('Failed to update sharing config');
}

        // Update local state
        setSharingConfig((prev) => ({ ...prev, ...config }));

        toast({
          title: 'Settings updated',
          description: 'Sharing configuration has been updated.',
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to update settings. Please try again.',
          variant: 'destructive',
        });
      }
    },
    [workflowId, workspaceSlug, toast],
  );

  const handleGenerateShareLink = useCallback(async (): Promise<string> => {
    try {
      // Replace with actual API call
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/workflows/${workflowId}/share-link/generate`,
        {
          method: 'POST',
        },
      );

      if (!response.ok) {
throw new Error('Failed to generate share link');
}

      const { shareLink } = await response.json();

      // Update local state
      setSharingConfig((prev) => ({ ...prev, publicShareLink: shareLink }));

      toast({
        title: 'Share link generated',
        description: 'Link has been copied to clipboard.',
      });

      return shareLink;
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate share link. Please try again.',
        variant: 'destructive',
      });
      throw error;
    }
  }, [workflowId, workspaceSlug, toast]);

  const handleRevokeShareLink = useCallback(async () => {
    try {
      // Replace with actual API call
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/workflows/${workflowId}/share-link`,
        {
          method: 'DELETE',
        },
      );

      if (!response.ok) {
throw new Error('Failed to revoke share link');
}

      // Update local state
      setSharingConfig((prev) => ({ ...prev, publicShareLink: undefined }));

      toast({
        title: 'Share link revoked',
        description: 'The public share link has been disabled.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to revoke share link. Please try again.',
        variant: 'destructive',
      });
    }
  }, [workflowId, workspaceSlug, toast]);

  const handleCopyShareLink = useCallback(
    (link: string) => {
      navigator.clipboard.writeText(link);
      toast({
        title: 'Copied!',
        description: 'Share link copied to clipboard.',
      });
    },
    [toast],
  );

  const handleShare = useCallback(
    async (recipients: ShareRecipient[], message?: string) => {
      try {
        // Replace with actual API call
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/workflows/${workflowId}/share`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipients, message }),
          },
        );

        if (!response.ok) {
throw new Error('Failed to share workflow');
}

        // Update permissions list
        const newPermissions = await response.json();
        setPermissions((prev) => [...prev, ...newPermissions]);

        toast({
          title: 'Workflow shared',
          description: `Shared with ${recipients.length} ${recipients.length === 1 ? 'person' : 'people'}.`,
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to share workflow. Please try again.',
          variant: 'destructive',
        });
        throw error;
      }
    },
    [workflowId, workspaceSlug, toast],
  );

  const handleSearchEntities = useCallback(
    async (query: string, type: 'user' | 'team'): Promise<ShareableEntity[]> => {
      try {
        // Replace with actual API call
        const endpoint =
          type === 'user'
            ? `/api/workspaces/${workspaceSlug}/users/search`
            : `/api/workspaces/${workspaceSlug}/teams/search`;

        const response = await fetch(`${endpoint}?q=${encodeURIComponent(query)}`);

        if (!response.ok) {
throw new Error('Search failed');
}

        return await response.json();
      } catch (error) {
        console.error('Search error:', error);
        return [];
      }
    },
    [workspaceSlug],
  );

  return (
    <div className="container max-w-4xl py-8 space-y-8">
      {/* Header with Quick Share */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{workflowName}</h1>
          <p className="text-muted-foreground mt-1">Manage workflow access and permissions</p>
        </div>
        <QuickShareButton
          workflowId={workflowId}
          workflowName={workflowName}
          currentShares={currentShares}
          onShare={handleShare}
          onSearchEntities={handleSearchEntities}
          variant="default"
          size="default"
          showLabel={true}
        />
      </div>

      {/* Permissions Management */}
      <WorkflowPermissions
        workflowId={workflowId}
        workflowName={workflowName}
        permissions={permissions}
        accessLog={accessLog}
        sharingConfig={sharingConfig}
        workspacePermissions={workspacePermissions}
        isOwner={true} // Set based on actual ownership
        onUpdatePermission={handleUpdatePermission}
        onRemovePermission={handleRemovePermission}
        onAddPermission={handleAddPermission}
        onUpdateSharingConfig={handleUpdateSharingConfig}
        onGenerateShareLink={handleGenerateShareLink}
        onRevokeShareLink={handleRevokeShareLink}
        onCopyShareLink={handleCopyShareLink}
      />
    </div>
  );
}

/**
 * Example: Simple integration in a workflow header
 */
export function WorkflowHeaderWithShare({
  workflowId,
  workflowName,
  workspaceSlug,
}: WorkflowPermissionsPageProps) {
  const { toast } = useToast();
  const [currentShares, setCurrentShares] = useState<ShareableEntity[]>([]);

  const handleShare = async (recipients: ShareRecipient[], message?: string) => {
    // Implementation here
    console.log('Sharing with:', recipients, message);
  };

  const handleSearchEntities = async (
    query: string,
    type: 'user' | 'team',
  ): Promise<ShareableEntity[]> => {
    // Implementation here
    return [];
  };

  return (
    <div className="flex items-center justify-between p-4 border-b">
      <h2 className="text-xl font-semibold">{workflowName}</h2>
      <QuickShareButton
        workflowId={workflowId}
        workflowName={workflowName}
        currentShares={currentShares}
        onShare={handleShare}
        onSearchEntities={handleSearchEntities}
        variant="outline"
        size="sm"
      />
    </div>
  );
}
