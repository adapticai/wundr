'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  X,
  Settings,
  Bell,
  UserPlus,
  Users,
  Loader2,
  MoreHorizontal,
  Crown,
  UserMinus,
  ShieldCheck,
  Shield
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useMultiplePresence } from '@/hooks/use-presence';

import type { Channel, ChannelMember, ChannelPermissions } from '@/types/channel';

/**
 * Props for the ChannelDetailsPanel component
 */
interface ChannelDetailsPanelProps {
  channel: Channel;
  permissions: ChannelPermissions;
  isOpen: boolean;
  onClose: () => void;
  onEditChannel: () => void;
  onEditNotifications: () => void;
  onInvite: () => void;
  onRemoveMember: (userId: string) => Promise<void>;
  onChangeMemberRole: (userId: string, role: 'admin' | 'member') => Promise<void>;
  currentUserId: string;
}

/**
 * Channel Details Panel
 *
 * Slide-out panel showing channel details, members, and management options.
 */
export function ChannelDetailsPanel({
  channel,
  permissions,
  isOpen,
  onClose,
  onEditChannel,
  onEditNotifications,
  onInvite,
  onRemoveMember,
  onChangeMemberRole,
  currentUserId,
}: ChannelDetailsPanelProps) {
  const [activeTab, setActiveTab] = useState<'about' | 'members'>('about');
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  // Get member user IDs for presence fetching
  const memberUserIds = useMemo(() => {
    return members.map((member) => member.userId);
  }, [members]);

  // Fetch real-time presence for all members
  const presenceMap = useMultiplePresence(memberUserIds);

  // Fetch members when switching to members tab
  useEffect(() => {
    if (activeTab === 'members' && isOpen) {
      setIsLoadingMembers(true);
      fetch(`/api/channels/${channel.id}/members`)
        .then((res) => {
          if (!res.ok) {
            throw new Error('Failed to fetch members');
          }
          return res.json();
        })
        .then((data) => {
          setMembers(data.data || []);
        })
        .catch((error) => {
          console.error('Failed to fetch members:', error);
          setMembers([]);
        })
        .finally(() => {
          setIsLoadingMembers(false);
        });
    }
  }, [activeTab, isOpen, channel.id]);

  const handleRemoveMember = useCallback(async (userId: string) => {
    await onRemoveMember(userId);
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
  }, [onRemoveMember]);

  const handleChangeRole = useCallback(async (userId: string, role: 'admin' | 'member') => {
    await onChangeMemberRole(userId, role);
    setMembers((prev) =>
      prev.map((m) => (m.userId === userId ? { ...m, role } : m))
    );
  }, [onChangeMemberRole]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l bg-background shadow-xl">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <h2 className="font-semibold">Channel details</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Channel info */}
      <div className="border-b p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-xl font-semibold">
            #
          </div>
          <div>
            <h3 className="font-semibold">{channel.name}</h3>
            <p className="text-sm text-muted-foreground">
              {channel.type === 'private' ? 'Private channel' : 'Public channel'}
            </p>
          </div>
        </div>
        {channel.description && (
          <p className="mt-3 text-sm text-muted-foreground">{channel.description}</p>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex border-b p-2">
        {permissions.canEdit && (
          <Button variant="ghost" className="flex-1" onClick={onEditChannel}>
            <Settings className="mr-2 h-4 w-4" />
            Edit
          </Button>
        )}
        <Button variant="ghost" className="flex-1" onClick={onEditNotifications}>
          <Bell className="mr-2 h-4 w-4" />
          Notifications
        </Button>
        {permissions.canInvite && (
          <Button variant="ghost" className="flex-1" onClick={onInvite}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          type="button"
          onClick={() => setActiveTab('about')}
          className={cn(
            'flex-1 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
            activeTab === 'about'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          About
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('members')}
          className={cn(
            'flex-1 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
            activeTab === 'members'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Users className="mr-2 inline h-4 w-4" />
          Members ({channel.memberCount})
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'about' ? (
          <div className="p-4 space-y-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Topic</h4>
              <p className="text-sm">{channel.description || 'No topic set'}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Created</h4>
              <p className="text-sm">{new Date(channel.createdAt).toLocaleDateString()}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Type</h4>
              <p className="text-sm capitalize">{channel.type}</p>
            </div>
          </div>
        ) : (
          <div className="p-4">
            {isLoadingMembers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-1">
                {members.map((member) => {
                  const presence = presenceMap.get(member.userId);
                  const status = presence?.status || 'offline';
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between rounded-lg p-2 hover:bg-accent"
                    >
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          user={{
                            name: member.user.name,
                            image: member.user.image,
                          }}
                          size="md"
                          shape="rounded"
                          showStatus
                          status={status}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{member.user.name}</span>
                            {member.role === 'admin' && (
                              <Crown className="h-3.5 w-3.5 text-yellow-500" />
                            )}
                            {member.userId === currentUserId && (
                              <span className="text-xs text-muted-foreground">(you)</span>
                            )}
                          </div>
                          {member.user.email && (
                            <span className="text-xs text-muted-foreground">{member.user.email}</span>
                          )}
                        </div>
                      </div>

                    {/* Member actions */}
                    {permissions.canRemoveMembers && member.userId !== currentUserId && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {permissions.canChangeRoles && (
                            <>
                              {member.role === 'member' ? (
                                <DropdownMenuItem onClick={() => handleChangeRole(member.userId, 'admin')}>
                                  <ShieldCheck className="mr-2 h-4 w-4" />
                                  Make admin
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => handleChangeRole(member.userId, 'member')}>
                                  <Shield className="mr-2 h-4 w-4" />
                                  Remove admin
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                            </>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleRemoveMember(member.userId)}
                            className="text-destructive focus:text-destructive"
                          >
                            <UserMinus className="mr-2 h-4 w-4" />
                            Remove from channel
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChannelDetailsPanel;
