'use client';

import {
  Users,
  X,
  Search,
  UserPlus,
  MoreVertical,
  Crown,
  Shield,
  Trash2,
  Loader2,
  AlertCircle,
  Mail,
} from 'lucide-react';
import { useCallback, useEffect, useState, useMemo } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import type { User } from '@/types/chat';

/**
 * Channel member data from API
 */
interface ChannelMember {
  id: string;
  userId: string;
  channelId: string;
  role: 'ADMIN' | 'MEMBER';
  joinedAt: string | Date;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    isOrchestrator: boolean;
    status: string | null;
  };
}

/**
 * Workspace member data for inviting
 */
interface WorkspaceMember {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    isOrchestrator: boolean;
  };
}

/**
 * Props for the ChannelMembersPanel component
 */
interface ChannelMembersPanelProps {
  channelId: string;
  channelName: string;
  workspaceSlug: string;
  isOpen: boolean;
  onClose: () => void;
  canManageMembers: boolean;
  currentUserId?: string;
}

/**
 * Channel Members Panel
 *
 * Comprehensive member management UI with:
 * - Member list with roles and status
 * - Search/filter functionality
 * - Invite new members
 * - Remove members (with confirmation)
 * - Role management (promote/demote)
 */
export function ChannelMembersPanel({
  channelId,
  channelName,
  workspaceSlug,
  isOpen,
  onClose,
  canManageMembers,
  currentUserId,
}: ChannelMembersPanelProps) {
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const { toast } = useToast();

  // Fetch channel members
  const fetchMembers = useCallback(async () => {
    if (!channelId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/channels/${channelId}/members`);

      if (!response.ok) {
        throw new Error('Failed to fetch channel members');
      }

      const result = await response.json();
      setMembers(result.data || []);
    } catch (err) {
      console.error('Failed to fetch channel members:', err);
      setError('Failed to load channel members');
      setMembers([]);
    } finally {
      setIsLoading(false);
    }
  }, [channelId]);

  // Fetch on open or channel change
  useEffect(() => {
    if (isOpen) {
      fetchMembers();
    }
  }, [isOpen, fetchMembers]);

  // Filter members by search query
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) {
      return members;
    }

    const query = searchQuery.toLowerCase();
    return members.filter(
      member =>
        member.user.name?.toLowerCase().includes(query) ||
        member.user.displayName?.toLowerCase().includes(query) ||
        member.user.email?.toLowerCase().includes(query)
    );
  }, [members, searchQuery]);

  // Sort members: Admins first, then by join date
  const sortedMembers = useMemo(() => {
    return [...filteredMembers].sort((a, b) => {
      // Admins first
      if (a.role === 'ADMIN' && b.role !== 'ADMIN') return -1;
      if (a.role !== 'ADMIN' && b.role === 'ADMIN') return 1;

      // Then by join date (earliest first)
      const dateA = new Date(a.joinedAt).getTime();
      const dateB = new Date(b.joinedAt).getTime();
      return dateA - dateB;
    });
  }, [filteredMembers]);

  const memberCount = members.length;
  const adminCount = members.filter(m => m.role === 'ADMIN').length;

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className='fixed inset-y-0 right-0 z-50 w-full max-w-md border-l bg-background shadow-xl flex flex-col'>
        {/* Header */}
        <div className='flex h-14 items-center justify-between border-b px-4'>
          <div className='flex items-center gap-2'>
            <Users className='h-5 w-5 text-muted-foreground' />
            <h2 className='font-semibold'>Members</h2>
            <Badge variant='secondary' className='ml-1'>
              {memberCount}
            </Badge>
          </div>
          <Button variant='ghost' size='icon' onClick={onClose}>
            <X className='h-5 w-5' />
          </Button>
        </div>

        {/* Info bar */}
        <div className='border-b bg-muted/30 px-4 py-3'>
          <div className='flex items-center justify-between'>
            <p className='text-xs text-muted-foreground'>
              {canManageMembers
                ? `Manage members of #{channelName}`
                : `View members of #{channelName}`}
            </p>
            {canManageMembers && (
              <Button
                size='sm'
                variant='default'
                onClick={() => setShowInviteDialog(true)}
                className='h-7 text-xs'
              >
                <UserPlus className='h-3 w-3 mr-1' />
                Invite
              </Button>
            )}
          </div>
        </div>

        {/* Search bar */}
        <div className='px-4 py-3 border-b'>
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              placeholder='Search members...'
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className='pl-9'
            />
          </div>
        </div>

        {/* Content */}
        <div className='flex-1 overflow-y-auto'>
          {isLoading ? (
            <div className='flex items-center justify-center py-12'>
              <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
            </div>
          ) : error ? (
            <div className='flex flex-col items-center justify-center gap-2 py-12 px-4'>
              <AlertCircle className='h-8 w-8 text-destructive' />
              <p className='text-sm text-muted-foreground'>{error}</p>
              <Button variant='outline' size='sm' onClick={fetchMembers}>
                Try again
              </Button>
            </div>
          ) : sortedMembers.length === 0 ? (
            <div className='flex flex-col items-center justify-center gap-2 py-12 px-4 text-center'>
              <Users className='h-12 w-12 text-muted-foreground/40' />
              <p className='text-sm font-medium'>
                {searchQuery ? 'No members found' : 'No members'}
              </p>
              <p className='text-xs text-muted-foreground'>
                {searchQuery
                  ? 'Try a different search query'
                  : 'Invite members to get started'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className='w-12'></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMembers.map(member => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    channelId={channelId}
                    canManage={canManageMembers}
                    isCurrentUser={member.userId === currentUserId}
                    isLastAdmin={member.role === 'ADMIN' && adminCount === 1}
                    onMemberUpdated={fetchMembers}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Invite Members Dialog */}
      {showInviteDialog && (
        <InviteMembersDialog
          channelId={channelId}
          channelName={channelName}
          workspaceSlug={workspaceSlug}
          isOpen={showInviteDialog}
          onClose={() => setShowInviteDialog(false)}
          onMembersAdded={fetchMembers}
        />
      )}
    </>
  );
}

/**
 * Member Row Component
 */
interface MemberRowProps {
  member: ChannelMember;
  channelId: string;
  canManage: boolean;
  isCurrentUser: boolean;
  isLastAdmin: boolean;
  onMemberUpdated: () => void;
}

function MemberRow({
  member,
  channelId,
  canManage,
  isCurrentUser,
  isLastAdmin,
  onMemberUpdated,
}: MemberRowProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const { toast } = useToast();

  const displayName =
    member.user.displayName || member.user.name || 'Unknown User';
  const isOnline = member.user.status === 'ONLINE';

  // Update member role
  const handleRoleChange = useCallback(
    async (newRole: 'ADMIN' | 'MEMBER') => {
      if (newRole === member.role) return;

      setIsUpdating(true);

      try {
        const response = await fetch(
          `/api/channels/${channelId}/members/${member.userId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: newRole }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to update member role');
        }

        toast({
          title: 'Role updated',
          description: `${displayName} is now ${newRole === 'ADMIN' ? 'an admin' : 'a member'}`,
        });

        onMemberUpdated();
      } catch (err) {
        console.error('Failed to update member role:', err);
        toast({
          title: 'Error',
          description:
            err instanceof Error ? err.message : 'Failed to update member role',
          variant: 'destructive',
        });
      } finally {
        setIsUpdating(false);
      }
    },
    [channelId, member.userId, member.role, displayName, onMemberUpdated, toast]
  );

  // Remove member
  const handleRemove = useCallback(async () => {
    setIsUpdating(true);

    try {
      const response = await fetch(
        `/api/channels/${channelId}/members/${member.userId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to remove member');
      }

      toast({
        title: 'Member removed',
        description: `${displayName} has been removed from the channel`,
      });

      onMemberUpdated();
    } catch (err) {
      console.error('Failed to remove member:', err);
      toast({
        title: 'Error',
        description:
          err instanceof Error ? err.message : 'Failed to remove member',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
      setShowRemoveDialog(false);
    }
  }, [channelId, member.userId, displayName, onMemberUpdated, toast]);

  return (
    <>
      <TableRow>
        <TableCell>
          <div className='flex items-center gap-3'>
            <div className='relative'>
              <UserAvatar
                user={{
                  name: displayName,
                  image: member.user.avatarUrl,
                }}
                size='sm'
                shape='rounded'
              />
              {isOnline && (
                <div className='absolute bottom-0 right-0 h-2 w-2 rounded-full bg-green-500 ring-2 ring-background' />
              )}
            </div>
            <div className='min-w-0 flex-1'>
              <div className='flex items-center gap-2'>
                <p className='text-sm font-medium truncate'>{displayName}</p>
                {isCurrentUser && (
                  <Badge variant='secondary' className='text-xs'>
                    You
                  </Badge>
                )}
                {member.user.isOrchestrator && (
                  <Badge variant='outline' className='text-xs'>
                    AI
                  </Badge>
                )}
              </div>
              {member.user.email && (
                <p className='text-xs text-muted-foreground truncate'>
                  {member.user.email}
                </p>
              )}
            </div>
          </div>
        </TableCell>
        <TableCell>
          <div className='flex items-center gap-2'>
            {member.role === 'ADMIN' ? (
              <Shield className='h-4 w-4 text-primary' />
            ) : null}
            <span className='text-sm capitalize'>
              {member.role.toLowerCase()}
            </span>
          </div>
        </TableCell>
        <TableCell>
          {canManage && !isCurrentUser && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-8 w-8'
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <Loader2 className='h-4 w-4 animate-spin' />
                  ) : (
                    <MoreVertical className='h-4 w-4' />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuItem
                  onClick={() =>
                    handleRoleChange(member.role === 'ADMIN' ? 'MEMBER' : 'ADMIN')
                  }
                  disabled={isLastAdmin}
                >
                  {member.role === 'ADMIN' ? (
                    <>
                      <Users className='h-4 w-4 mr-2' />
                      Demote to Member
                    </>
                  ) : (
                    <>
                      <Shield className='h-4 w-4 mr-2' />
                      Promote to Admin
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowRemoveDialog(true)}
                  className='text-destructive'
                  disabled={isLastAdmin}
                >
                  <Trash2 className='h-4 w-4 mr-2' />
                  Remove from channel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </TableCell>
      </TableRow>

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{displayName}</strong> from
              this channel? They will lose access to all messages and files.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Invite Members Dialog Component
 */
interface InviteMembersDialogProps {
  channelId: string;
  channelName: string;
  workspaceSlug: string;
  isOpen: boolean;
  onClose: () => void;
  onMembersAdded: () => void;
}

function InviteMembersDialog({
  channelId,
  channelName,
  workspaceSlug,
  isOpen,
  onClose,
  onMembersAdded,
}: InviteMembersDialogProps) {
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>(
    []
  );
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  // Fetch workspace members (excluding current channel members)
  useEffect(() => {
    const fetchWorkspaceMembers = async () => {
      setIsLoading(true);

      try {
        const [wsResponse, channelResponse] = await Promise.all([
          fetch(`/api/workspaces/${workspaceSlug}/members?limit=100`),
          fetch(`/api/channels/${channelId}/members`),
        ]);

        if (!wsResponse.ok || !channelResponse.ok) {
          throw new Error('Failed to fetch members');
        }

        const wsResult = await wsResponse.json();
        const channelResult = await channelResponse.json();

        const channelMemberIds = new Set(
          (channelResult.data || []).map((m: ChannelMember) => m.userId)
        );

        // Filter out users already in the channel
        const availableMembers = (wsResult.data || []).filter(
          (m: WorkspaceMember) => !channelMemberIds.has(m.userId)
        );

        setWorkspaceMembers(availableMembers);
      } catch (err) {
        console.error('Failed to fetch workspace members:', err);
        toast({
          title: 'Error',
          description: 'Failed to load workspace members',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      fetchWorkspaceMembers();
    }
  }, [isOpen, channelId, workspaceSlug, toast]);

  // Filter members by search
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) {
      return workspaceMembers;
    }

    const query = searchQuery.toLowerCase();
    return workspaceMembers.filter(
      member =>
        member.user.name?.toLowerCase().includes(query) ||
        member.user.displayName?.toLowerCase().includes(query) ||
        member.user.email?.toLowerCase().includes(query)
    );
  }, [workspaceMembers, searchQuery]);

  // Toggle user selection
  const toggleUser = useCallback((userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  }, []);

  // Add selected members
  const handleAddMembers = useCallback(async () => {
    if (selectedUserIds.length === 0) return;

    setIsAdding(true);

    try {
      const response = await fetch(`/api/channels/${channelId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: selectedUserIds,
          role: 'MEMBER',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add members');
      }

      const result = await response.json();

      toast({
        title: 'Members added',
        description: result.message || 'Members added successfully',
      });

      onMembersAdded();
      onClose();
    } catch (err) {
      console.error('Failed to add members:', err);
      toast({
        title: 'Error',
        description:
          err instanceof Error ? err.message : 'Failed to add members',
        variant: 'destructive',
      });
    } finally {
      setIsAdding(false);
    }
  }, [channelId, selectedUserIds, onMembersAdded, onClose, toast]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle>Invite Members</DialogTitle>
          <DialogDescription>
            Add workspace members to #{channelName}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          {/* Search */}
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              placeholder='Search members...'
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className='pl-9'
            />
          </div>

          {/* Member List */}
          <div className='max-h-[300px] overflow-y-auto rounded-md border'>
            {isLoading ? (
              <div className='flex items-center justify-center py-8'>
                <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className='flex flex-col items-center justify-center gap-2 py-8 text-center'>
                <Users className='h-8 w-8 text-muted-foreground/40' />
                <p className='text-sm text-muted-foreground'>
                  {searchQuery
                    ? 'No members found'
                    : 'All workspace members are already in this channel'}
                </p>
              </div>
            ) : (
              <div className='divide-y'>
                {filteredMembers.map(member => {
                  const displayName =
                    member.user.displayName || member.user.name || 'Unknown';
                  const isSelected = selectedUserIds.includes(member.userId);

                  return (
                    <label
                      key={member.id}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent transition-colors',
                        isSelected && 'bg-accent/50'
                      )}
                    >
                      <input
                        type='checkbox'
                        checked={isSelected}
                        onChange={() => toggleUser(member.userId)}
                        className='h-4 w-4 rounded border-gray-300'
                      />
                      <UserAvatar
                        user={{
                          name: displayName,
                          image: member.user.avatarUrl,
                        }}
                        size='sm'
                        shape='rounded'
                      />
                      <div className='min-w-0 flex-1'>
                        <div className='flex items-center gap-2'>
                          <p className='text-sm font-medium truncate'>
                            {displayName}
                          </p>
                          {member.user.isOrchestrator && (
                            <Badge variant='outline' className='text-xs'>
                              AI
                            </Badge>
                          )}
                        </div>
                        {member.user.email && (
                          <p className='text-xs text-muted-foreground truncate'>
                            {member.user.email}
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected count */}
          {selectedUserIds.length > 0 && (
            <p className='text-sm text-muted-foreground'>
              {selectedUserIds.length} member
              {selectedUserIds.length === 1 ? '' : 's'} selected
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onClose} disabled={isAdding}>
            Cancel
          </Button>
          <Button
            onClick={handleAddMembers}
            disabled={selectedUserIds.length === 0 || isAdding}
          >
            {isAdding ? (
              <>
                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                Adding...
              </>
            ) : (
              <>
                <UserPlus className='h-4 w-4 mr-2' />
                Add {selectedUserIds.length > 0 ? `(${selectedUserIds.length})` : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ChannelMembersPanel;
