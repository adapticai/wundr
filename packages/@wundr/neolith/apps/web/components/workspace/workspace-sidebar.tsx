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
  Settings,
  Plus,
  HelpCircle,
  ChevronRight,
  LogOut,
  Bell,
  ChevronsUpDown,
  BadgeCheck,
  CreditCard,
} from 'lucide-react';

import { WorkspaceSwitcher } from './workspace-switcher';
import { ChannelList } from '@/components/channel';
import { CreateChannelDialog } from '@/components/channel/create-channel-dialog';
import { CreateConversationDialog } from '@/components/channel/create-conversation-dialog';
import { useChannels, useDirectMessages, useChannelMutations } from '@/hooks/use-channel';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface WorkspaceSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user?: {
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
];

const settingsItems = [
  {
    title: 'Settings',
    icon: Settings,
    url: '/settings',
    items: [
      { title: 'Profile', url: '/settings/profile' },
      { title: 'Preferences', url: '/settings/preferences' },
      { title: 'Security', url: '/settings/security' },
      { title: 'Notifications', url: '/settings/notifications' },
    ],
  },
];

const secondaryItems = [
  {
    title: 'Help & Support',
    icon: HelpCircle,
    url: '/help',
  },
];

export function WorkspaceSidebar({ user, ...props }: WorkspaceSidebarProps) {
  const pathname = usePathname();
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  // Fetch channels and DMs
  const {
    publicChannels,
    privateChannels,
    starredChannels,
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

  // Dialog states
  const [isCreateChannelDialogOpen, setIsCreateChannelDialogOpen] = React.useState(false);
  const [isCreateDMDialogOpen, setIsCreateDMDialogOpen] = React.useState(false);

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

  const handleCreateDM = React.useCallback(
    async () => {
      // Refetch DMs after creation
      await refetchDMs();
    },
    [refetchDMs],
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
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
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

        {/* Settings with submenu */}
        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarMenu>
            {settingsItems.map((item) => (
              <Collapsible
                key={item.title}
                asChild
                defaultOpen={isActive(item.url)}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip={item.title}>
                      <item.icon />
                      <span>{item.title}</span>
                      <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items?.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={isActive(subItem.url)}
                          >
                            <Link href={`/${workspaceId}${subItem.url}`}>
                              <span>{subItem.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Channels Section */}
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Channels</SidebarGroupLabel>
          <SidebarGroupAction
            title="Create Channel"
            onClick={() => setIsCreateChannelDialogOpen(true)}
          >
            <Plus />
            <span className="sr-only">Create Channel</span>
          </SidebarGroupAction>
          <SidebarGroupContent>
            <ChannelList
              workspaceId={workspaceId}
              channels={[...publicChannels, ...privateChannels]}
              directMessages={directMessages}
              starredChannels={starredChannels}
              isLoading={isChannelsLoading || isDMsLoading}
              error={channelsError || dmsError}
              onCreateChannel={handleCreateChannel}
              onCreateDM={handleCreateDM}
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={user?.image || undefined} alt={user?.name || 'User'} />
                    <AvatarFallback className="rounded-lg">
                      {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
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
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={user?.image || undefined} alt={user?.name || 'User'} />
                      <AvatarFallback className="rounded-lg">
                        {user?.name?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
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
                      <BadgeCheck className="mr-2 h-4 w-4" />
                      Account
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/${workspaceId}/admin/billing`}>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Billing
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/${workspaceId}/settings/notifications`}>
                      <Bell className="mr-2 h-4 w-4" />
                      Notifications
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

      {/* Create DM Dialog */}
      <CreateConversationDialog
        isOpen={isCreateDMDialogOpen}
        onClose={() => setIsCreateDMDialogOpen(false)}
        onCreateDM={handleCreateDM}
        workspaceId={workspaceId}
      />
    </Sidebar>
  );
}
