'use client';

import { useState } from 'react';
import {
  UserPlus,
  Users,
  Mail,
  Bot,
  MessageSquare,
  Bell,
  BellOff,
  Star,
  Archive,
  Trash2,
  Link2,
  Plus,
  FileText,
  Puzzle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { cn, getInitials } from '@/lib/utils';

interface DMUser {
  id: string;
  name: string;
  email?: string;
  image?: string | null;
  status?: 'online' | 'offline' | 'away' | 'busy';
  isOrchestrator?: boolean;
  title?: string;
}

interface ConversationDetailsDialogProps {
  isOpen: boolean;
  conversationId: string;
  conversationName?: string;
  members: DMUser[];
  currentUserId?: string;
  isStarred?: boolean;
  isMuted?: boolean;
  onClose: () => void;
  onAddPeople?: () => void;
  onViewProfile?: (userId: string) => void;
  onStartDM?: (userId: string) => void;
  onToggleStar?: () => void;
  onToggleMute?: () => void;
  onArchive?: () => void;
  onLeave?: () => void;
}

/**
 * Conversation Details Dialog
 *
 * Slack-style modal for viewing and managing conversation details with tabs:
 * - About: Conversation info and description
 * - Members: List of participants with actions
 * - Tabs: Manage canvas tabs and links
 * - Integrations: Connected apps and bots
 * - Settings: Notification and conversation settings
 */
export function ConversationDetailsDialog({
  isOpen,
  conversationName,
  members,
  currentUserId,
  isStarred = false,
  isMuted = false,
  onClose,
  onAddPeople,
  onViewProfile,
  onStartDM,
  onToggleStar,
  onToggleMute,
  onArchive,
  onLeave,
}: ConversationDetailsDialogProps) {
  const [activeTab, setActiveTab] = useState('about');

  const statusColors = {
    online: 'bg-green-500',
    away: 'bg-yellow-500',
    busy: 'bg-red-500',
    offline: 'bg-gray-400',
  };

  const isGroupDM = members.length > 1;

  // Generate display name from members if not provided
  const displayName =
    conversationName ||
    members
      .filter(m => m.id !== currentUserId)
      .map(m => m.name.split(' ')[0])
      .join(', ');

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className='sm:max-w-lg max-h-[85vh] flex flex-col p-0 gap-0'>
        {/* Header with conversation avatar(s) */}
        <DialogHeader className='p-6 pb-4'>
          <div className='flex items-start gap-4'>
            {/* Stacked or single avatar */}
            {isGroupDM ? (
              <div className='relative h-16 w-16'>
                {members.slice(0, 2).map((member, index) => (
                  <Avatar
                    key={member.id}
                    className={cn(
                      'absolute h-10 w-10 border-2 border-background',
                      index === 0 ? 'top-0 left-0 z-10' : 'bottom-0 right-0'
                    )}
                  >
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
                ))}
                {members.length > 2 && (
                  <div className='absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium'>
                    +{members.length - 2}
                  </div>
                )}
              </div>
            ) : (
              <div className='relative'>
                <Avatar className='h-16 w-16'>
                  <AvatarImage
                    src={members[0]?.image || undefined}
                    alt={members[0]?.name}
                  />
                  <AvatarFallback className='text-xl'>
                    {members[0]?.isOrchestrator ? (
                      <Bot className='h-8 w-8' />
                    ) : (
                      getInitials(members[0]?.name)
                    )}
                  </AvatarFallback>
                </Avatar>
                {members[0]?.status && (
                  <span
                    className={cn(
                      'absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-background',
                      statusColors[members[0].status]
                    )}
                  />
                )}
              </div>
            )}

            <div className='flex-1 min-w-0'>
              <DialogTitle className='text-xl truncate'>
                {displayName}
              </DialogTitle>
              {members.length === 1 && members[0]?.title && (
                <p className='text-sm text-muted-foreground mt-1'>
                  {members[0].title}
                </p>
              )}
              {isGroupDM && (
                <p className='text-sm text-muted-foreground mt-1'>
                  {members.length} members
                </p>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className='flex items-center gap-2 mt-4'>
            {onToggleStar && (
              <Button
                variant='outline'
                size='sm'
                onClick={onToggleStar}
                className={cn(isStarred && 'text-yellow-500')}
              >
                <Star
                  className={cn('h-4 w-4 mr-1', isStarred && 'fill-yellow-500')}
                />
                {isStarred ? 'Starred' : 'Star'}
              </Button>
            )}
            {onToggleMute && (
              <Button variant='outline' size='sm' onClick={onToggleMute}>
                {isMuted ? (
                  <>
                    <BellOff className='h-4 w-4 mr-1' />
                    Muted
                  </>
                ) : (
                  <>
                    <Bell className='h-4 w-4 mr-1' />
                    Notifications
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogHeader>

        <Separator />

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className='flex-1 flex flex-col min-h-0'
        >
          <TabsList className='w-full justify-start rounded-none border-b bg-transparent px-6 h-auto py-0'>
            <TabsTrigger
              value='about'
              className='rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3'
            >
              About
            </TabsTrigger>
            <TabsTrigger
              value='members'
              className='rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3'
            >
              Members
            </TabsTrigger>
            <TabsTrigger
              value='tabs'
              className='rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3'
            >
              Tabs
            </TabsTrigger>
            <TabsTrigger
              value='integrations'
              className='rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3'
            >
              Integrations
            </TabsTrigger>
            <TabsTrigger
              value='settings'
              className='rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3'
            >
              Settings
            </TabsTrigger>
          </TabsList>

          {/* About Tab */}
          <TabsContent value='about' className='flex-1 overflow-y-auto m-0 p-6'>
            <div className='space-y-6'>
              {/* Description */}
              <div>
                <Label className='text-sm font-semibold'>Description</Label>
                <p className='text-sm text-muted-foreground mt-1'>
                  {isGroupDM
                    ? `This is a private group conversation between ${members.length} people.`
                    : 'This is a private conversation between you and this person.'}
                </p>
              </div>

              {/* Created info */}
              <div>
                <Label className='text-sm font-semibold'>Created</Label>
                <p className='text-sm text-muted-foreground mt-1'>
                  This conversation was created recently.
                </p>
              </div>

              {/* Contact info for single user */}
              {!isGroupDM && members[0] && (
                <div className='space-y-3'>
                  {members[0].email && (
                    <div>
                      <Label className='text-sm font-semibold'>Email</Label>
                      <div className='flex items-center gap-2 mt-1'>
                        <Mail className='h-4 w-4 text-muted-foreground' />
                        <a
                          href={`mailto:${members[0].email}`}
                          className='text-sm text-primary hover:underline'
                        >
                          {members[0].email}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Members Tab */}
          <TabsContent
            value='members'
            className='flex-1 overflow-y-auto m-0 p-6'
          >
            <div className='space-y-4'>
              {/* Add People Button */}
              {onAddPeople && (
                <Button
                  variant='outline'
                  className='w-full justify-start gap-2'
                  onClick={onAddPeople}
                >
                  <UserPlus className='h-4 w-4' />
                  Add people
                </Button>
              )}

              {/* Members List */}
              <div className='space-y-1'>
                <p className='text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2'>
                  {isGroupDM
                    ? `${members.length} members`
                    : 'In this conversation'}
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
                        {member.title && (
                          <p className='text-xs text-muted-foreground truncate'>
                            {member.title}
                          </p>
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
          </TabsContent>

          {/* Tabs Tab */}
          <TabsContent value='tabs' className='flex-1 overflow-y-auto m-0 p-6'>
            <div className='space-y-4'>
              <p className='text-sm text-muted-foreground'>
                Add tabs to organize files, links, and resources for this
                conversation.
              </p>

              {/* Placeholder tabs */}
              <div className='space-y-2'>
                <div className='flex items-center gap-3 rounded-md border p-3'>
                  <FileText className='h-5 w-5 text-muted-foreground' />
                  <div className='flex-1'>
                    <p className='font-medium text-sm'>Canvas</p>
                    <p className='text-xs text-muted-foreground'>
                      Collaborative document
                    </p>
                  </div>
                </div>
              </div>

              <Button variant='outline' className='w-full justify-start gap-2'>
                <Plus className='h-4 w-4' />
                Add a tab
              </Button>
            </div>
          </TabsContent>

          {/* Integrations Tab */}
          <TabsContent
            value='integrations'
            className='flex-1 overflow-y-auto m-0 p-6'
          >
            <div className='space-y-4'>
              <p className='text-sm text-muted-foreground'>
                Connect apps and services to enhance this conversation.
              </p>

              {/* No integrations state */}
              <div className='rounded-md border border-dashed p-6 text-center'>
                <Puzzle className='h-8 w-8 mx-auto text-muted-foreground mb-2' />
                <p className='font-medium text-sm'>No integrations yet</p>
                <p className='text-xs text-muted-foreground mt-1'>
                  Add apps to automate workflows and stay connected.
                </p>
                <Button variant='outline' size='sm' className='mt-4'>
                  <Plus className='h-4 w-4 mr-1' />
                  Add an app
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent
            value='settings'
            className='flex-1 overflow-y-auto m-0 p-6'
          >
            <div className='space-y-6'>
              {/* Notification settings */}
              <div className='space-y-4'>
                <Label className='text-sm font-semibold'>Notifications</Label>

                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <p className='text-sm font-medium'>Mute conversation</p>
                    <p className='text-xs text-muted-foreground'>
                      Stop receiving notifications from this conversation
                    </p>
                  </div>
                  <Switch checked={isMuted} onCheckedChange={onToggleMute} />
                </div>
              </div>

              <Separator />

              {/* Conversation name (for group DMs) */}
              {isGroupDM && (
                <>
                  <div className='space-y-2'>
                    <Label className='text-sm font-semibold'>
                      Conversation name
                    </Label>
                    <Input
                      placeholder='Enter a name for this conversation'
                      defaultValue={conversationName || ''}
                    />
                    <p className='text-xs text-muted-foreground'>
                      Give this conversation a custom name for easy reference.
                    </p>
                  </div>

                  <Separator />
                </>
              )}

              {/* Copy link */}
              <div>
                <Button
                  variant='outline'
                  className='w-full justify-start gap-2'
                >
                  <Link2 className='h-4 w-4' />
                  Copy link to conversation
                </Button>
              </div>

              <Separator />

              {/* Danger zone */}
              <div className='space-y-3'>
                <Label className='text-sm font-semibold text-destructive'>
                  Danger zone
                </Label>

                {onArchive && (
                  <Button
                    variant='outline'
                    className='w-full justify-start gap-2'
                    onClick={onArchive}
                  >
                    <Archive className='h-4 w-4' />
                    Archive conversation
                  </Button>
                )}

                {onLeave && (
                  <Button
                    variant='outline'
                    className='w-full justify-start gap-2 text-destructive hover:text-destructive'
                    onClick={onLeave}
                  >
                    <Trash2 className='h-4 w-4' />
                    Leave conversation
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
