'use client';

import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';

import { InviteDialog } from '@/components/channel/invite-dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useChannel, useChannelMembers, useChannelMutations, useChannelPermissions } from '@/hooks/use-channel';
import { cn } from '@/lib/utils';

import type { ChannelMember } from '@/types/channel';

type Tab = 'overview' | 'members' | 'permissions' | 'advanced';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'members', label: 'Members' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'advanced', label: 'Advanced' },
];

// Mock current user ID - in production, this comes from auth
const MOCK_CURRENT_USER_ID = 'user-1';

export default function ChannelSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;
  const channelId = params.channelId as string;

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

  const { channel, isLoading: isChannelLoading, refetch: refetchChannel } = useChannel(channelId);
  const { members, onlineMembers, offlineMembers, isLoading: isMembersLoading, refetch: refetchMembers } =
    useChannelMembers(channelId);
  const { permissions, isLoading: isPermissionsLoading } = useChannelPermissions(
    channelId,
    MOCK_CURRENT_USER_ID,
  );
  const {
    updateChannel,
    deleteChannel,
    archiveChannel,
    inviteMembers,
    removeMember,
    changeMemberRole,
    isLoading: isMutating,
  } = useChannelMutations();

  const isLoading = isChannelLoading || isPermissionsLoading;

  // Redirect if user doesn't have permission to view settings
  useEffect(() => {
    if (!isPermissionsLoading && !permissions.canEdit) {
      router.push(`/${workspaceId}/channels/${channelId}`);
    }
  }, [isPermissionsLoading, permissions.canEdit, router, workspaceId, channelId]);

  const handleBack = useCallback(() => {
    router.push(`/${workspaceId}/channels/${channelId}`);
  }, [router, workspaceId, channelId]);

  const handleInvite = useCallback(
    async (userIds: string[], role: 'admin' | 'member') => {
      const success = await inviteMembers(channelId, userIds, role);
      if (success) {
        refetchMembers();
      }
    },
    [channelId, inviteMembers, refetchMembers],
  );

  const handleRemoveMember = useCallback(
    async (userId: string) => {
      const success = await removeMember(channelId, userId);
      if (success) {
        refetchMembers();
      }
    },
    [channelId, removeMember, refetchMembers],
  );

  const handleChangeRole = useCallback(
    async (userId: string, role: 'admin' | 'member') => {
      const success = await changeMemberRole(channelId, userId, role);
      if (success) {
        refetchMembers();
      }
    },
    [channelId, changeMemberRole, refetchMembers],
  );

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-muted-foreground">Channel not found</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="flex h-14 items-center gap-4 border-b px-6">
        <button
          type="button"
          onClick={handleBack}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Go back"
        >
          <BackIcon className="h-5 w-5" />
        </button>
        <div>
          <h1 className="font-semibold text-foreground">Channel Settings</h1>
          <p className="text-xs text-muted-foreground">#{channel.name}</p>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Tabs sidebar */}
        <div className="w-48 border-r bg-muted/30 p-4">
          <nav className="space-y-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-background/50 hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <OverviewTab
              channel={channel}
              onUpdate={async (input) => {
                const updated = await updateChannel(channelId, input);
                if (updated) {
                  refetchChannel();
                }
              }}
              isLoading={isMutating}
              canEdit={permissions.canEdit}
            />
          )}

          {activeTab === 'members' && (
            <MembersTab
              members={members}
              onlineMembers={onlineMembers}
              offlineMembers={offlineMembers}
              currentUserId={MOCK_CURRENT_USER_ID}
              permissions={permissions}
              onInvite={() => setIsInviteDialogOpen(true)}
              onRemove={handleRemoveMember}
              onChangeRole={handleChangeRole}
              isLoading={isMembersLoading}
            />
          )}

          {activeTab === 'permissions' && (
            <PermissionsTab
              channelId={channelId}
              channelType={channel.type}
              permissions={permissions}
            />
          )}

          {activeTab === 'advanced' && (
            <AdvancedTab
              channel={channel}
              onArchive={async () => {
                const success = await archiveChannel(channelId);
                if (success) {
                  router.push(`/${workspaceId}`);
                }
              }}
              onDelete={async () => {
                const success = await deleteChannel(channelId);
                if (success) {
                  router.push(`/${workspaceId}`);
                }
              }}
              isLoading={isMutating}
              permissions={permissions}
            />
          )}
        </div>
      </div>

      {/* Invite Dialog */}
      <InviteDialog
        isOpen={isInviteDialogOpen}
        onClose={() => setIsInviteDialogOpen(false)}
        onInvite={handleInvite}
        workspaceId={workspaceId}
        channelName={channel.name}
        existingMemberIds={members.map((m) => m.userId)}
      />
    </div>
  );
}

// Overview Tab
interface OverviewTabProps {
  channel: {
    name: string;
    description?: string;
    type: string;
  };
  onUpdate: (input: { name?: string; description?: string }) => Promise<void>;
  isLoading: boolean;
  canEdit: boolean;
}

function OverviewTab({ channel, onUpdate, isLoading, canEdit }: OverviewTabProps) {
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description || '');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setName(channel.name);
    setDescription(channel.description || '');
    setHasChanges(false);
  }, [channel.name, channel.description]);

  useEffect(() => {
    setHasChanges(name !== channel.name || description !== (channel.description || ''));
  }, [name, description, channel.name, channel.description]);

  const handleSave = async () => {
    await onUpdate({
      name: name !== channel.name ? name : undefined,
      description: description !== (channel.description || '') ? description : undefined,
    });
    setHasChanges(false);
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Channel Overview</h2>
        <p className="text-sm text-muted-foreground">
          Basic information about this channel
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="channel-name" className="mb-1 block text-sm font-medium text-foreground">
            Channel name
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              #
            </span>
            <input
              id="channel-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEdit || isLoading}
              className="w-full rounded-md border border-input bg-background py-2 pl-7 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
              maxLength={80}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="channel-description"
            className="mb-1 block text-sm font-medium text-foreground"
          >
            Description
          </label>
          <textarea
            id="channel-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!canEdit || isLoading}
            placeholder="What is this channel about?"
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
            maxLength={250}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">Visibility</label>
          <div className="flex items-center gap-2 rounded-md border border-input bg-stone/30 px-3 py-2">
            {channel.type === 'private' ? (
              <>
                <LockIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Private channel</span>
              </>
            ) : (
              <>
                <HashIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Public channel</span>
              </>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Channel visibility cannot be changed after creation
          </p>
        </div>
      </div>

      {canEdit && hasChanges && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setName(channel.name);
              setDescription(channel.description || '');
            }}
            disabled={isLoading}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isLoading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}

// Members Tab
interface MembersTabProps {
  members: ChannelMember[];
  onlineMembers: ChannelMember[];
  offlineMembers: ChannelMember[];
  currentUserId: string;
  permissions: {
    canInvite: boolean;
    canRemoveMembers: boolean;
    canChangeRoles: boolean;
  };
  onInvite: () => void;
  onRemove: (userId: string) => Promise<void>;
  onChangeRole: (userId: string, role: 'admin' | 'member') => Promise<void>;
  isLoading: boolean;
}

function MembersTab({
  members,
  onlineMembers,
  offlineMembers,
  currentUserId,
  permissions,
  onInvite,
  onRemove,
  onChangeRole,
  isLoading,
}: MembersTabProps) {
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);

  const handleRemove = async (userId: string) => {
    setProcessingUserId(userId);
    await onRemove(userId);
    setProcessingUserId(null);
  };

  const handleChangeRole = async (userId: string, role: 'admin' | 'member') => {
    setProcessingUserId(userId);
    await onChangeRole(userId, role);
    setProcessingUserId(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Members ({members.length})</h2>
          <p className="text-sm text-muted-foreground">Manage who has access to this channel</p>
        </div>
        {permissions.canInvite && (
          <button
            type="button"
            onClick={onInvite}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <InviteIcon className="h-4 w-4" />
            Add People
          </button>
        )}
      </div>

      {/* Online members */}
      {onlineMembers.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Online - {onlineMembers.length}
          </h3>
          <div className="space-y-1">
            {onlineMembers.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                currentUserId={currentUserId}
                permissions={permissions}
                onRemove={handleRemove}
                onChangeRole={handleChangeRole}
                isProcessing={processingUserId === member.userId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Offline members */}
      {offlineMembers.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Offline - {offlineMembers.length}
          </h3>
          <div className="space-y-1">
            {offlineMembers.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                currentUserId={currentUserId}
                permissions={permissions}
                onRemove={handleRemove}
                onChangeRole={handleChangeRole}
                isProcessing={processingUserId === member.userId}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface MemberRowProps {
  member: ChannelMember;
  currentUserId: string;
  permissions: {
    canRemoveMembers: boolean;
    canChangeRoles: boolean;
  };
  onRemove: (userId: string) => void;
  onChangeRole: (userId: string, role: 'admin' | 'member') => void;
  isProcessing: boolean;
}

function MemberRow({
  member,
  currentUserId,
  permissions,
  onRemove,
  onChangeRole,
  isProcessing,
}: MemberRowProps) {
  const [showMenu, setShowMenu] = useState(false);
  const isCurrentUser = member.userId === currentUserId;
  const canManage = (permissions.canChangeRoles || permissions.canRemoveMembers) && !isCurrentUser;

  return (
    <div className="relative flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent/50">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium overflow-hidden">
        {member.user.image ? (
          <Image
            src={member.user.image}
            alt={member.user.name}
            width={40}
            height={40}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          member.user.name.charAt(0).toUpperCase()
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {member.user.name}
            {isCurrentUser && (
              <span className="ml-1 text-xs text-muted-foreground">(you)</span>
            )}
          </span>
          {member.role === 'admin' && (
            <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
              Admin
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
      </div>

      {canManage && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            disabled={isProcessing}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <MoreIcon className="h-4 w-4" />
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-md border bg-card py-1 shadow-lg">
                {permissions.canChangeRoles && (
                  <button
                    type="button"
                    onClick={() => {
                      onChangeRole(member.userId, member.role === 'admin' ? 'member' : 'admin');
                      setShowMenu(false);
                    }}
                    disabled={isProcessing}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent disabled:opacity-50"
                  >
                    {member.role === 'admin' ? 'Remove admin' : 'Make admin'}
                  </button>
                )}
                {permissions.canRemoveMembers && (
                  <button
                    type="button"
                    onClick={() => {
                      onRemove(member.userId);
                      setShowMenu(false);
                    }}
                    disabled={isProcessing}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent disabled:opacity-50"
                  >
                    Remove from channel
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Permissions Tab
interface PermissionsTabProps {
  channelId: string;
  channelType: string;
  permissions: {
    canEdit: boolean;
  };
}

function PermissionsTab({ channelType, permissions }: PermissionsTabProps) {
  const [postingPermission, setPostingPermission] = useState('everyone');
  const [mentionPermission, setMentionPermission] = useState('everyone');

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Permissions</h2>
        <p className="text-sm text-muted-foreground">
          Control what members can do in this channel
        </p>
      </div>

      <div className="space-y-6">
        {/* Posting permission */}
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            Who can post messages?
          </label>
          <div className="space-y-2">
            {['everyone', 'admins'].map((option) => (
              <label key={option} className="flex cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  name="posting"
                  value={option}
                  checked={postingPermission === option}
                  onChange={(e) => setPostingPermission(e.target.value)}
                  disabled={!permissions.canEdit}
                  className="h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-foreground capitalize">{option}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Mention permission */}
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            Who can use @channel and @here?
          </label>
          <div className="space-y-2">
            {['everyone', 'admins', 'no one'].map((option) => (
              <label key={option} className="flex cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  name="mention"
                  value={option}
                  checked={mentionPermission === option}
                  onChange={(e) => setMentionPermission(e.target.value)}
                  disabled={!permissions.canEdit}
                  className="h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-foreground capitalize">{option}</span>
              </label>
            ))}
          </div>
        </div>

        {channelType === 'public' && (
          <div className="rounded-md border border-border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">
              This is a public channel. Anyone in the workspace can join and view messages.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Advanced Tab
interface AdvancedTabProps {
  channel: {
    name: string;
    isArchived?: boolean;
  };
  onArchive: () => Promise<void>;
  onDelete: () => Promise<void>;
  isLoading: boolean;
  permissions: {
    canArchive: boolean;
    canDelete: boolean;
  };
}

function AdvancedTab({
  channel,
  onArchive,
  onDelete,
  isLoading,
  permissions,
}: AdvancedTabProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const canDelete = deleteConfirmText === channel.name;

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Advanced Settings</h2>
        <p className="text-sm text-muted-foreground">
          Danger zone - these actions cannot be easily undone
        </p>
      </div>

      {/* Archive section */}
      {permissions.canArchive && !channel.isArchived && (
        <div className="rounded-lg border border-border p-4">
          <h3 className="font-medium text-foreground">Archive this channel</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Archiving will hide the channel from the channel list. Members can still access the
            message history.
          </p>
          <button
            type="button"
            onClick={onArchive}
            disabled={isLoading}
            className="mt-4 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            {isLoading ? 'Archiving...' : 'Archive Channel'}
          </button>
        </div>
      )}

      {/* Delete section */}
      {permissions.canDelete && (
        <div className="rounded-lg border border-destructive/50 p-4">
          <h3 className="font-medium text-destructive">Delete this channel</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            This action is irreversible. All messages and files will be permanently deleted.
          </p>

          {!showDeleteConfirm ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isLoading}
              className="mt-4 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
            >
              Delete Channel
            </button>
          ) : (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-foreground">
                Type <span className="font-medium">#{channel.name}</span> to confirm deletion:
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={channel.name}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-destructive focus:outline-none focus:ring-1 focus:ring-destructive"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText('');
                  }}
                  disabled={isLoading}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={!canDelete || isLoading}
                  className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
                >
                  {isLoading ? 'Deleting...' : 'Permanently Delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Icons
function BackIcon({ className }: { className?: string }) {
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
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function HashIcon({ className }: { className?: string }) {
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
      <path d="M4 9h16" />
      <path d="M4 15h16" />
      <path d="M10 3 8 21" />
      <path d="M16 3 14 21" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
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
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function InviteIcon({ className }: { className?: string }) {
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
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" x2="19" y1="8" y2="14" />
      <line x1="22" x2="16" y1="11" y2="11" />
    </svg>
  );
}

function MoreIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  );
}
