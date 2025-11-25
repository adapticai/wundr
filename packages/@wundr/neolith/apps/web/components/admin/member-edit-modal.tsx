'use client';

import { useState, useEffect, useCallback } from 'react';

import { cn } from '@/lib/utils';

import type { WorkspaceMember } from './member-list';

/**
 * Props for the MemberEditModal component.
 */
export interface MemberEditModalProps {
  /** The member to edit, or null if no member is selected */
  member: WorkspaceMember | null;
  /** The workspace ID for API calls */
  workspaceId: string;
  /** List of available roles to assign to the member */
  availableRoles: { id: string; name: string }[];
  /** Callback when the modal should close */
  onClose: () => void;
  /** Callback after successful save operation */
  onSave: () => void;
  /** Additional CSS classes to apply */
  className?: string;
}

interface ActivityEntry {
  id: string;
  action: string;
  timestamp: string;
  details?: string;
}

export function MemberEditModal({
  member,
  workspaceId,
  availableRoles,
  onClose,
  onSave,
  className,
}: MemberEditModalProps) {
  const [selectedRole, setSelectedRole] = useState(member?.role || '');
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'activity' | 'danger'>('details');

  const fetchMemberDetails = useCallback(async () => {
    if (!member) {
return;
}

    setIsLoading(true);
    try {
      const [detailsRes, activityRes] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}/admin/members/${member.id}`),
        fetch(`/api/workspaces/${workspaceId}/admin/members/${member.id}/activity`),
      ]);

      if (detailsRes.ok) {
        const data = await detailsRes.json();
        setCustomFields(data.customFields || {});
      }
      if (activityRes.ok) {
        const data = await activityRes.json();
        setActivity(data.activity || []);
      }
    } catch {
      // Handle error
    } finally {
      setIsLoading(false);
    }
  }, [member, workspaceId]);

  useEffect(() => {
    if (member) {
      setSelectedRole(member.role);
      fetchMemberDetails();
    }
  }, [member, fetchMemberDetails]);

  const handleSaveRole = async () => {
    if (!member) {
return;
}

    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/admin/members/${member.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: selectedRole, customFields }),
        },
      );
      if (response.ok) {
        onSave();
      }
    } catch {
      // Handle error
    } finally {
      setIsSaving(false);
    }
  };

  const handleSuspend = async () => {
    if (!member) {
return;
}
    if (!confirm(`Are you sure you want to suspend ${member.name}?`)) {
return;
}

    try {
      await fetch(`/api/workspaces/${workspaceId}/admin/members/${member.id}/suspend`, {
        method: 'POST',
      });
      onSave();
    } catch {
      // Handle error
    }
  };

  const handleActivate = async () => {
    if (!member) {
return;
}

    try {
      await fetch(`/api/workspaces/${workspaceId}/admin/members/${member.id}/activate`, {
        method: 'POST',
      });
      onSave();
    } catch {
      // Handle error
    }
  };

  const handleRemove = async () => {
    if (!member) {
return;
}
    if (
      !confirm(
        `Are you sure you want to remove ${member.name} from this workspace? This action cannot be undone.`,
      )
    ) {
return;
}

    try {
      await fetch(`/api/workspaces/${workspaceId}/admin/members/${member.id}`, {
        method: 'DELETE',
      });
      onSave();
    } catch {
      // Handle error
    }
  };

  if (!member) {
return null;
}

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={cn(
          'w-full max-w-2xl bg-card border border-border rounded-xl shadow-lg',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg font-medium">
              {member.image ? (
                <img
                  src={member.image}
                  alt={member.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                member.name.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{member.name}</h2>
              <p className="text-sm text-muted-foreground">{member.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-border px-4">
          <nav className="flex gap-4" aria-label="Member edit tabs">
            {(['details', 'activity', 'danger'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'py-3 text-sm font-medium border-b-2 transition-colors capitalize',
                  activeTab === tab
                    ? tab === 'danger'
                      ? 'border-destructive text-destructive'
                      : 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {tab === 'danger' ? 'Danger Zone' : tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[60vh] overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {activeTab === 'details' && (
                <div className="space-y-6">
                  {/* Role selector */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Role
                    </label>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      className="w-full max-w-xs px-3 py-2 rounded-lg bg-muted border border-border text-foreground"
                    >
                      {availableRoles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Custom fields */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Custom Fields
                    </label>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          Department
                        </label>
                        <input
                          type="text"
                          value={customFields.department || ''}
                          onChange={(e) =>
                            setCustomFields((prev) => ({ ...prev, department: e.target.value }))
                          }
                          className="w-full max-w-xs px-3 py-2 rounded-lg bg-muted border border-border text-foreground"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          value={customFields.title || ''}
                          onChange={(e) =>
                            setCustomFields((prev) => ({ ...prev, title: e.target.value }))
                          }
                          className="w-full max-w-xs px-3 py-2 rounded-lg bg-muted border border-border text-foreground"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          Notes
                        </label>
                        <textarea
                          value={customFields.notes || ''}
                          onChange={(e) =>
                            setCustomFields((prev) => ({ ...prev, notes: e.target.value }))
                          }
                          className="w-full max-w-xs px-3 py-2 rounded-lg bg-muted border border-border text-foreground"
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Member info */}
                  <div className="p-3 bg-muted rounded-lg space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Joined</span>
                      <span className="text-foreground">
                        {new Date(member.joinedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <span
                        className={cn(
                          'capitalize',
                          member.status === 'active'
                            ? 'text-green-500'
                            : member.status === 'suspended'
                            ? 'text-red-500'
                            : 'text-yellow-500',
                        )}
                      >
                        {member.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Active</span>
                      <span className="text-foreground">
                        {member.lastActiveAt
                          ? new Date(member.lastActiveAt).toLocaleString()
                          : 'Never'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'activity' && (
                <div className="space-y-4">
                  {activity.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No activity recorded
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {activity.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-start gap-3 p-3 bg-muted rounded-lg"
                        >
                          <div className="w-2 h-2 mt-2 rounded-full bg-primary" />
                          <div className="flex-1">
                            <p className="text-sm text-foreground">{entry.action}</p>
                            {entry.details && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {entry.details}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(entry.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'danger' && (
                <div className="space-y-4">
                  <div className="p-4 border border-yellow-500/30 bg-yellow-500/5 rounded-lg">
                    <h3 className="text-sm font-medium text-yellow-500 mb-2">
                      Suspend Member
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Suspending this member will prevent them from accessing the workspace.
                      They can be reactivated later.
                    </p>
                    {member.status === 'suspended' ? (
                      <button
                        type="button"
                        onClick={handleActivate}
                        className="px-4 py-2 bg-green-500/10 text-green-500 rounded-lg text-sm hover:bg-green-500/20"
                      >
                        Activate Member
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSuspend}
                        className="px-4 py-2 bg-yellow-500/10 text-yellow-500 rounded-lg text-sm hover:bg-yellow-500/20"
                      >
                        Suspend Member
                      </button>
                    )}
                  </div>

                  <div className="p-4 border border-destructive/30 bg-destructive/5 rounded-lg">
                    <h3 className="text-sm font-medium text-destructive mb-2">
                      Remove Member
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Removing this member will permanently remove them from the workspace.
                      This action cannot be undone.
                    </p>
                    <button
                      type="button"
                      onClick={handleRemove}
                      className="px-4 py-2 bg-destructive/10 text-destructive rounded-lg text-sm hover:bg-destructive/20"
                    >
                      Remove Member
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {activeTab === 'details' && (
          <div className="flex justify-end gap-2 p-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveRole}
              disabled={isSaving}
              className={cn(
                'px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export default MemberEditModal;
