'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Bot,
  Workflow,
  Rocket,
  Bookmark,
  Settings,
  HelpCircle,
  LogOut,
  Bell,
  ChevronsUpDown,
  CreditCard,
  Shield,
  Palette,
  User,
} from 'lucide-react';

import { WorkspaceSwitcher } from './workspace-switcher';
import { ChannelList, CollapsedChannelIcons } from '@/components/channel';
import { CreateChannelDialog } from '@/components/channel/create-channel-dialog';
import { useChannels, useDirectMessages, useChannelMutations } from '@/hooks/use-channel';
import { useRealtimeSidebar } from '@/hooks/use-realtime-sidebar';
import { useUserPresence, usePresenceHeartbeat } from '@/hooks/use-presence';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/ui/user-avatar';
import { ConnectedUserAvatar } from '@/components/presence/user-avatar-with-presence';

interface WorkspaceSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
}

// Navigation items configuration
const navItems = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    url: '/dashboard',
    isActive: true,
  },
  {
    title: 'Orchestrators',
    icon: Users,
    url: '/orchestrators',
  },
  {
    title: 'Agents',
    icon: Bot,
    url: '/agents',
  },
  {
    title: 'Workflows',
    icon: Workflow,
    url: '/workflows',
  },
  {
    title: 'Deployments',
    icon: Rocket,
    url: '/deployments',
  },
  {
    title: 'Later',
    icon: Bookmark,
    url: '/later',
  },
];

const secondaryItems = [
  {
    title: 'Workspace Settings',
    icon: Settings,
    url: '/admin/settings',
  },
  {
    title: 'Help & Support',
    icon: HelpCircle,
    url: '/help',
  },
];

export function WorkspaceSidebar({ user, ...props }: WorkspaceSidebarProps) {
  const pathname = usePathname();
  const params = useParams();
  const workspaceId = params.workspaceSlug as string;

  // Fetch real-time presence status for current user
  const currentUserPresence = useUserPresence(user?.id ?? '');
  const currentUserStatus = currentUserPresence?.status ?? 'online';

  // Enable heartbeat to keep current user's presence active
  usePresenceHeartbeat(!!user?.id);

  // Fetch channels and DMs
  const {
    channels: allChannels,
    publicChannels,
    privateChannels,
    isLoading: isChannelsLoading,
    error: channelsError,
    refetch: refetchChannels,
  } = useChannels(workspaceId);

  const {
    directMessages,
    isLoading: isDMsLoading,
    error: dmsError,
    refetch: refetchDMs,
  } = useDirectMessages(workspaceId);

  const { createChannel } = useChannelMutations();

  // Real-time sidebar updates via SSE
  const {
    channels: realtimeChannels,
    directMessages: realtimeDMs,
    starredChannels,
    starredDMs,
    isConnected: isRealtimeConnected,
    updateChannelStarStatus,
    updateDMStarStatus,
  } = useRealtimeSidebar({
    workspaceSlug: workspaceId,
    initialChannels: [...publicChannels, ...privateChannels],
    initialDirectMessages: directMessages,
    enabled: !isChannelsLoading && !isDMsLoading,
  });

  // Use realtime data if connected, otherwise fall back to fetched data
  const effectiveChannels = isRealtimeConnected && realtimeChannels.length > 0
    ? realtimeChannels
    : [...publicChannels, ...privateChannels];
  const effectiveDMs = isRealtimeConnected && realtimeDMs.length > 0
    ? realtimeDMs
    : directMessages;

  // Handle channel star toggle with optimistic updates
  const handleChannelStarChange = React.useCallback((channelId: string, isStarred: boolean) => {
    console.log('[WorkspaceSidebar] handleChannelStarChange:', { channelId, isStarred });
    const channel = allChannels.find((c) => c.id === channelId);
    updateChannelStarStatus(channelId, isStarred, channel);
  }, [allChannels, updateChannelStarStatus]);

  // Handle DM star toggle with optimistic updates
  const handleDMStarChange = React.useCallback((dmId: string, isStarred: boolean) => {
    console.log('[WorkspaceSidebar] handleDMStarChange:', { dmId, isStarred });
    const dm = directMessages.find((d) => d.id === dmId);
    updateDMStarStatus(dmId, isStarred, dm);
  }, [directMessages, updateDMStarStatus]);

  // Dialog states
  const [isCreateChannelDialogOpen, setIsCreateChannelDialogOpen] = React.useState(false);

  // Prevent hydration mismatch for DropdownMenu (Radix generates different IDs on server vs client)
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleCreateChannel = React.useCallback(
    async (input: {
      name: string;
      type: 'public' | 'private';
      description?: string;
      memberIds?: string[];
    }) => {
      await createChannel(workspaceId, input);
      await refetchChannels();
      setIsCreateChannelDialogOpen(false);
    },
    [workspaceId, createChannel, refetchChannels],
  );

  const handleRetry = React.useCallback(async () => {
    await Promise.all([refetchChannels(), refetchDMs()]);
  }, [refetchChannels, refetchDMs]);

  const isActive = (url: string) => {
    const fullUrl = `/${workspaceId}${url}`;
    return pathname === fullUrl || pathname?.startsWith(`${fullUrl}/`);
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <WorkspaceSwitcher />
      </SidebarHeader>

      <SidebarContent>
        {/* Platform Navigation */}
        <SidebarGroup>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(item.url)}
                  tooltip={item.title}
                >
                  <Link href={`/${workspaceId}${item.url}`}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Collapsed Channel Icons - Only visible when sidebar is collapsed */}
        <SidebarGroup className="hidden group-data-[collapsible=icon]:block">
          <SidebarGroupContent>
            <CollapsedChannelIcons
              channels={effectiveChannels}
              directMessages={effectiveDMs}
              starredChannels={starredChannels}
              starredDMs={starredDMs}
            />
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Channels Section - Only visible when sidebar is expanded */}
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupContent>
            <ChannelList
              workspaceId={workspaceId}
              currentUserId={user?.id}
              channels={effectiveChannels}
              directMessages={effectiveDMs}
              starredChannels={starredChannels}
              starredDMs={starredDMs}
              isLoading={isChannelsLoading || isDMsLoading}
              error={channelsError || dmsError}
              onCreateChannel={handleCreateChannel}
              onChannelStarChange={handleChannelStarChange}
              onDMStarChange={handleDMStarChange}
              onRetry={handleRetry}
              className="h-full"
            />
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Secondary Navigation */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild size="sm">
                    <Link href={`/${workspaceId}${item.url}`}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {mounted ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    {user?.id ? (
                      <ConnectedUserAvatar
                        user={{ id: user.id, name: user?.name ?? 'User', image: user?.image }}
                        size="md"
                        showPresence
                      />
                    ) : (
                      <UserAvatar
                        user={{ name: user?.name, image: user?.image }}
                        size="md"
                        shape="rounded"
                      />
                    )}
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{user?.name || 'User'}</span>
                      <span className="truncate text-xs">{user?.email || 'user@example.com'}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    {user?.id ? (
                      <ConnectedUserAvatar
                        user={{ id: user.id, name: user?.name ?? 'User', image: user?.image }}
                        size="md"
                        showPresence
                      />
                    ) : (
                      <UserAvatar
                        user={{ name: user?.name, image: user?.image }}
                        size="md"
                        shape="rounded"
                      />
                    )}
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{user?.name || 'User'}</span>
                      <span className="truncate text-xs">{user?.email || 'user@example.com'}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem asChild>
                    <Link href={`/${workspaceId}/settings/profile`}>
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/${workspaceId}/settings/security`}>
                      <Shield className="mr-2 h-4 w-4" />
                      Security
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/${workspaceId}/settings/notifications`}>
                      <Bell className="mr-2 h-4 w-4" />
                      Notifications
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/${workspaceId}/settings/appearance`}>
                      <Palette className="mr-2 h-4 w-4" />
                      Appearance
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem asChild>
                    <Link href={`/${workspaceId}/admin/billing`}>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Billing
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/api/auth/signout">
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <SidebarMenuButton size="lg">
                <UserAvatar
                  user={{ name: user?.name, image: user?.image }}
                  size="md"
                  shape="rounded"
                  showStatus
                  status={currentUserStatus}
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{user?.name || 'User'}</span>
                  <span className="truncate text-xs">{user?.email || 'user@example.com'}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />

      {/* Create Channel Dialog */}
      <CreateChannelDialog
        isOpen={isCreateChannelDialogOpen}
        onClose={() => setIsCreateChannelDialogOpen(false)}
        onCreate={handleCreateChannel}
        workspaceId={workspaceId}
      />

    </Sidebar>
  );
}
