'use client';

import { useState, useCallback } from 'react';
import { X, UserPlus, Users, Mail, Bot, MessageSquare } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn, getInitials } from '@/lib/utils';
import { DMAddPeopleModal } from './dm-add-people-modal';
import { useToast } from '@/hooks/use-toast';

interface DMUser {
  id: string;
  name: string;
  email?: string;
  image?: string | null;
  status?: 'online' | 'offline' | 'away' | 'busy';
  isOrchestrator?: boolean;
}

interface DMDetailsPanelProps {
  isOpen: boolean;
  members: DMUser[];
  currentUserId?: string;
  workspaceId: string;
  channelId: string;
  conversationName?: string;
  onClose: () => void;
  onAddPeople?: () => void;
  onViewProfile?: (userId: string) => void;
  onStartDM?: (userId: string) => void;
  className?: string;
}

/**
 * DM Details Panel
 *
 * Shows conversation members with the ability to:
 * - View all members
 * - Add more people to the conversation
 * - View individual profiles
 * - Start 1:1 DMs with members
 */
export function DMDetailsPanel({
  isOpen,
  members,
  currentUserId,
  workspaceId,
  channelId,
  conversationName,
  onClose,
  onAddPeople,
  onViewProfile,
  onStartDM,
  className,
}: DMDetailsPanelProps) {
  const { toast } = useToast();
  const [isAddPeopleModalOpen, setIsAddPeopleModalOpen] = useState(false);

  if (!isOpen) return null;

  const statusColors = {
    online: 'bg-green-500',
    away: 'bg-yellow-500',
    busy: 'bg-red-500',
    offline: 'bg-gray-400',
  };

  const isGroupDM = members.length > 1;
  const existingMemberIds = members.map(m => m.id);

  const handleOpenAddPeopleModal = useCallback(() => {
    if (onAddPeople) {
      onAddPeople();
    }
    setIsAddPeopleModalOpen(true);
  }, [onAddPeople]);

  const handleCloseAddPeopleModal = useCallback(() => {
    setIsAddPeopleModalOpen(false);
  }, []);

  const handleAddMembers = useCallback(
    async (userIds: string[]) => {
      try {
        const response = await fetch(`/api/channels/${channelId}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to add members');
        }

        toast({
          title: 'Members added',
          description: `Successfully added ${userIds.length} ${userIds.length === 1 ? 'person' : 'people'} to the conversation`,
        });
      } catch (error) {
        toast({
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'Failed to add members',
          variant: 'destructive',
        });
        throw error;
      }
    },
    [channelId, toast]
  );

  const handleInviteByEmail = useCallback(
    async (emails: string[]) => {
      try {
        const response = await fetch(`/api/channels/${channelId}/invite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emails }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to send invitations');
        }

        toast({
          title: 'Invitations sent',
          description: `Successfully sent ${emails.length} ${emails.length === 1 ? 'invitation' : 'invitations'}`,
        });
      } catch (error) {
        toast({
          title: 'Error',
          description:
            error instanceof Error
              ? error.message
              : 'Failed to send invitations',
          variant: 'destructive',
        });
        throw error;
      }
    },
    [channelId, toast]
  );

  return (
    <div className={cn('flex w-80 flex-col border-l bg-background', className)}>
      {/* Header */}
      <div className='flex h-12 items-center justify-between border-b px-4'>
        <div className='flex items-center gap-2'>
          <Users className='h-4 w-4 text-muted-foreground' />
          <span className='font-semibold text-sm'>
            {isGroupDM ? 'Members' : 'Details'}
          </span>
          <span className='text-xs text-muted-foreground'>
            ({members.length})
          </span>
        </div>
        <Button
          variant='ghost'
          size='icon'
          className='h-7 w-7'
          onClick={onClose}
        >
          <X className='h-4 w-4' />
        </Button>
      </div>

      <div className='flex-1 overflow-y-auto'>
        <div className='p-4'>
          {/* Add People Button */}
          <Button
            variant='outline'
            className='mb-4 w-full justify-start gap-2'
            onClick={handleOpenAddPeopleModal}
          >
            <UserPlus className='h-4 w-4' />
            Add people
          </Button>

          {/* Members List */}
          <div className='space-y-1'>
            <p className='mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
              {isGroupDM ? 'In this conversation' : 'Profile'}
            </p>

            {members.map(member => {
              const isCurrentUser = member.id === currentUserId;

              return (
                <div
                  key={member.id}
                  className='group flex items-center gap-3 rounded-md p-2 hover:bg-accent transition-colors'
                >
                  {/* Avatar with status */}
                  <div className='relative'>
                    <Avatar className='h-9 w-9'>
                      <AvatarImage
                        src={member.image || undefined}
                        alt={member.name}
                      />
                      <AvatarFallback>
                        {member.isOrchestrator ? (
                          <Bot className='h-4 w-4' />
                        ) : (
                          getInitials(member.name)
                        )}
                      </AvatarFallback>
                    </Avatar>
                    {member.status && (
                      <span
                        className={cn(
                          'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background',
                          statusColors[member.status]
                        )}
                      />
                    )}
                    {member.isOrchestrator && (
                      <span className='absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground'>
                        AI
                      </span>
                    )}
                  </div>

                  {/* Name and email */}
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-1'>
                      <span className='font-medium text-sm truncate'>
                        {member.name}
                      </span>
                      {isCurrentUser && (
                        <span className='text-xs text-muted-foreground'>
                          (you)
                        </span>
                      )}
                    </div>
                    {member.email && (
                      <div className='flex items-center gap-1 text-xs text-muted-foreground truncate'>
                        <Mail className='h-3 w-3' />
                        <span className='truncate'>{member.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions - visible on hover */}
                  {!isCurrentUser && (
                    <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                      {onViewProfile && (
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-7 w-7'
                          onClick={() => onViewProfile(member.id)}
                          title='View profile'
                        >
                          <Users className='h-3.5 w-3.5' />
                        </Button>
                      )}
                      {onStartDM && isGroupDM && (
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-7 w-7'
                          onClick={() => onStartDM(member.id)}
                          title='Message directly'
                        >
                          <MessageSquare className='h-3.5 w-3.5' />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className='border-t p-4 text-xs text-muted-foreground'>
        <p>
          {isGroupDM
            ? `This is a private group conversation between ${members.length} people.`
            : 'This is a private conversation between you and this person.'}
        </p>
      </div>

      {/* Add People Modal */}
      <DMAddPeopleModal
        isOpen={isAddPeopleModalOpen}
        onClose={handleCloseAddPeopleModal}
        onAddMembers={handleAddMembers}
        onInviteByEmail={handleInviteByEmail}
        workspaceId={workspaceId}
        existingMemberIds={existingMemberIds}
        conversationName={conversationName}
      />
    </div>
  );
}
