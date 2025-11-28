'use client';

import { X, UserPlus, Users, Mail, Bot, MessageSquare } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
  onClose,
  onAddPeople,
  onViewProfile,
  onStartDM,
  className,
}: DMDetailsPanelProps) {
  if (!isOpen) return null;

  const statusColors = {
    online: 'bg-green-500',
    away: 'bg-yellow-500',
    busy: 'bg-red-500',
    offline: 'bg-gray-400',
  };

  const isGroupDM = members.length > 1;

  return (
    <div
      className={cn(
        'flex w-80 flex-col border-l bg-background',
        className
      )}
    >
      {/* Header */}
      <div className="flex h-12 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">
            {isGroupDM ? 'Members' : 'Details'}
          </span>
          <span className="text-xs text-muted-foreground">
            ({members.length})
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          {/* Add People Button */}
          {onAddPeople && (
            <Button
              variant="outline"
              className="mb-4 w-full justify-start gap-2"
              onClick={onAddPeople}
            >
              <UserPlus className="h-4 w-4" />
              Add people
            </Button>
          )}

          {/* Members List */}
          <div className="space-y-1">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {isGroupDM ? 'In this conversation' : 'Profile'}
            </p>

            {members.map((member) => {
              const isCurrentUser = member.id === currentUserId;

              return (
                <div
                  key={member.id}
                  className="group flex items-center gap-3 rounded-md p-2 hover:bg-accent transition-colors"
                >
                  {/* Avatar with status */}
                  <div className="relative">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={member.image || undefined} alt={member.name} />
                      <AvatarFallback>
                        {member.isOrchestrator ? (
                          <Bot className="h-4 w-4" />
                        ) : (
                          member.name.charAt(0).toUpperCase()
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
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                        AI
                      </span>
                    )}
                  </div>

                  {/* Name and email */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-sm truncate">
                        {member.name}
                      </span>
                      {isCurrentUser && (
                        <span className="text-xs text-muted-foreground">(you)</span>
                      )}
                    </div>
                    {member.email && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{member.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions - visible on hover */}
                  {!isCurrentUser && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onViewProfile && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onViewProfile(member.id)}
                          title="View profile"
                        >
                          <Users className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {onStartDM && isGroupDM && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onStartDM(member.id)}
                          title="Message directly"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
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
      <div className="border-t p-4 text-xs text-muted-foreground">
        <p>
          {isGroupDM
            ? `This is a private group conversation between ${members.length} people.`
            : 'This is a private conversation between you and this person.'}
        </p>
      </div>
    </div>
  );
}
