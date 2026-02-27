'use client';

import {
  CheckCircle2Icon,
  HashIcon,
  MessageSquareIcon,
  SparklesIcon,
  UsersIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface MemberDashboardSectionProps {
  workspaceId: string;
  workspaceSlug: string;
}

interface MemberData {
  isNewMember: boolean;
  joinedDate: string;
  checklist: {
    id: string;
    label: string;
    completed: boolean;
    href?: string;
  }[];
  suggestedChannels: {
    id: string;
    name: string;
    description: string;
    memberCount: number;
  }[];
  recommendedOrchestrators: {
    id: string;
    name: string;
    description: string;
    category: string;
  }[];
  teamSpotlight: {
    id: string;
    name: string;
    displayName: string | null;
    avatarUrl: string | null;
    role: string;
  }[];
}

/**
 * Get initials from a name
 */
function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function MemberDashboardSection({
  workspaceId,
  workspaceSlug,
}: MemberDashboardSectionProps) {
  const [data, setData] = useState<MemberData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMemberData = async () => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/dashboard/member-info`
        );

        if (response.ok) {
          const result = await response.json();
          setData(result.data);
        } else {
          // API not available yet - use empty data with default checklist
          setData({
            isNewMember: true,
            joinedDate: new Date().toISOString(),
            checklist: [
              {
                id: '1',
                label: 'Complete your profile',
                completed: false,
                href: `/${workspaceSlug}/settings/profile`,
              },
              {
                id: '2',
                label: 'Join your first channel',
                completed: false,
                href: `/${workspaceSlug}/channels`,
              },
              { id: '3', label: 'Send your first message', completed: false },
              {
                id: '4',
                label: 'Explore orchestrators',
                completed: false,
                href: `/${workspaceSlug}/orchestrators`,
              },
            ],
            suggestedChannels: [],
            recommendedOrchestrators: [],
            teamSpotlight: [],
          });
        }
      } catch (error) {
        console.error('Failed to fetch member data:', error);
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMemberData();
  }, [workspaceId]);

  if (isLoading) {
    return (
      <div className='space-y-6'>
        <div className='h-8 w-48 bg-muted animate-pulse rounded' />
        <div className='grid gap-4'>
          {[...Array(3)].map((_, i) => (
            <div key={i} className='h-40 bg-muted animate-pulse rounded-lg' />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const completedTasks = data.checklist.filter(item => item.completed).length;
  const totalTasks = data.checklist.length;
  const progressPercentage =
    totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <div className='space-y-6'>
      {/* Welcome Message */}
      <div>
        <h2 className='text-2xl font-bold tracking-tight'>
          Welcome to your workspace!
        </h2>
        <p className='text-muted-foreground'>
          {data.isNewMember
            ? "Let's get you started with the essentials"
            : "Here's what's happening in your workspace"}
        </p>
      </div>

      {/* Getting Started Checklist */}
      {data.isNewMember && (
        <Card>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <div>
                <CardTitle className='text-base flex items-center gap-2'>
                  <SparklesIcon className='h-4 w-4' />
                  Getting Started
                </CardTitle>
                <CardDescription>
                  {completedTasks} of {totalTasks} tasks completed
                </CardDescription>
              </div>
              <span className='text-sm font-medium text-muted-foreground'>
                {Math.round(progressPercentage)}%
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className='space-y-3'>
              {data.checklist.map(item => (
                <div key={item.id} className='flex items-center gap-3'>
                  <CheckCircle2Icon
                    className={`h-5 w-5 flex-shrink-0 ${
                      item.completed
                        ? 'text-green-600'
                        : 'text-muted-foreground/30'
                    }`}
                  />
                  {item.href ? (
                    <a
                      href={item.href}
                      className='text-sm hover:underline flex-1'
                    >
                      {item.label}
                    </a>
                  ) : (
                    <span className='text-sm flex-1'>{item.label}</span>
                  )}
                </div>
              ))}
            </div>
            <div className='mt-4 h-2 bg-muted rounded-full overflow-hidden'>
              <div
                className='h-full bg-primary transition-all duration-300'
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Suggested Channels */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base flex items-center gap-2'>
            <HashIcon className='h-4 w-4' />
            Channels
          </CardTitle>
          <CardDescription>
            Browse and join channels in your workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.suggestedChannels.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-6 text-center'>
              <div className='rounded-full bg-muted p-3 mb-3'>
                <HashIcon className='h-5 w-5 text-muted-foreground' />
              </div>
              <p className='text-sm font-medium text-muted-foreground'>
                No channels yet
              </p>
              <p className='text-xs text-muted-foreground mt-1'>
                Channels will appear here once they are created
              </p>
              <a
                href={`/${workspaceSlug}/channels`}
                className='text-xs text-primary hover:underline mt-3'
              >
                Browse all channels
              </a>
            </div>
          ) : (
            <div className='space-y-3'>
              {data.suggestedChannels.map(channel => (
                <a
                  key={channel.id}
                  href={`/${workspaceSlug}/channels/${channel.id}`}
                  className='flex items-start justify-between p-3 rounded-lg border hover:bg-accent transition-colors'
                >
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2'>
                      <span className='font-medium text-sm'>
                        #{channel.name}
                      </span>
                      {channel.memberCount > 0 && (
                        <Badge variant='secondary' className='text-xs'>
                          {channel.memberCount} members
                        </Badge>
                      )}
                    </div>
                    <p className='text-xs text-muted-foreground mt-1'>
                      {channel.description}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommended Orchestrators */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base flex items-center gap-2'>
            <MessageSquareIcon className='h-4 w-4' />
            Orchestrators
          </CardTitle>
          <CardDescription>
            AI assistants available in your workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.recommendedOrchestrators.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-6 text-center'>
              <div className='rounded-full bg-muted p-3 mb-3'>
                <MessageSquareIcon className='h-5 w-5 text-muted-foreground' />
              </div>
              <p className='text-sm font-medium text-muted-foreground'>
                No orchestrators yet
              </p>
              <p className='text-xs text-muted-foreground mt-1'>
                Orchestrators will appear here once they are set up
              </p>
              <a
                href={`/${workspaceSlug}/orchestrators`}
                className='text-xs text-primary hover:underline mt-3'
              >
                Browse orchestrators
              </a>
            </div>
          ) : (
            <div className='space-y-3'>
              {data.recommendedOrchestrators.map(orchestrator => (
                <a
                  key={orchestrator.id}
                  href={`/${workspaceSlug}/orchestrators/${orchestrator.id}`}
                  className='flex items-start justify-between p-3 rounded-lg border hover:bg-accent transition-colors'
                >
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2'>
                      <span className='font-medium text-sm'>
                        {orchestrator.name}
                      </span>
                      <Badge variant='outline' className='text-xs'>
                        {orchestrator.category}
                      </Badge>
                    </div>
                    <p className='text-xs text-muted-foreground mt-1'>
                      {orchestrator.description}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Spotlight */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base flex items-center gap-2'>
            <UsersIcon className='h-4 w-4' />
            Team Members
          </CardTitle>
          <CardDescription>Meet your workspace teammates</CardDescription>
        </CardHeader>
        <CardContent>
          {data.teamSpotlight.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-6 text-center'>
              <div className='rounded-full bg-muted p-3 mb-3'>
                <UsersIcon className='h-5 w-5 text-muted-foreground' />
              </div>
              <p className='text-sm font-medium text-muted-foreground'>
                No other members yet
              </p>
              <p className='text-xs text-muted-foreground mt-1'>
                Invite teammates to get started
              </p>
            </div>
          ) : (
            <div className='grid gap-4 md:grid-cols-2'>
              {data.teamSpotlight.map(member => (
                <div
                  key={member.id}
                  className='flex items-center gap-3 p-3 rounded-lg border'
                >
                  <Avatar className='h-10 w-10'>
                    <AvatarImage
                      src={member.avatarUrl || undefined}
                      alt={member.name}
                    />
                    <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                  </Avatar>
                  <div className='flex-1 min-w-0'>
                    <p className='text-sm font-medium truncate'>
                      {member.displayName || member.name}
                    </p>
                    <p className='text-xs text-muted-foreground truncate'>
                      {member.role}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
