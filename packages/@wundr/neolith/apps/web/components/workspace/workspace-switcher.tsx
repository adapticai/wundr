'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserWorkspaces } from '@/hooks/use-workspaces';
import { AlertCircle, Building2, ChevronsUpDown, Plus } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import * as React from 'react';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  avatarUrl?: string | null;
  settings?: Record<string, unknown> | null;
}

// Loading skeleton component
function WorkspaceSwitcherSkeleton() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size='lg' disabled>
          <Skeleton className='size-8 rounded-lg' />
          <div className='grid flex-1 gap-1'>
            <Skeleton className='h-4 w-24' />
            <Skeleton className='h-3 w-16' />
          </div>
          <Skeleton className='size-4 ml-auto' />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

// Error state component
function WorkspaceSwitcherError({ onRetry }: { onRetry: () => void }) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size='lg'
          onClick={onRetry}
          className='text-destructive hover:text-destructive'
        >
          <div className='flex aspect-square size-8 items-center justify-center rounded-lg bg-destructive/10'>
            <AlertCircle className='size-4' />
          </div>
          <div className='grid flex-1 text-left text-sm leading-tight'>
            <span className='truncate font-semibold'>
              Error loading workspaces
            </span>
            <span className='truncate text-xs'>Click to retry</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function WorkspaceSwitcher() {
  const router = useRouter();
  const params = useParams();
  const { isMobile } = useSidebar();
  const { workspaces, isLoading, error, refetch } = useUserWorkspaces();

  const currentWorkspaceSlug = params.workspaceSlug as string;
  // Match workspace by slug (URL param) or fall back to id for compatibility
  const activeWorkspace =
    workspaces.find(
      w => w.slug === currentWorkspaceSlug || w.id === currentWorkspaceSlug
    ) || workspaces[0];

  // Keyboard shortcuts for workspace switching (Cmd+1, Cmd+2, etc.)
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Cmd/Ctrl + number keys (1-9)
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key >= '1' &&
        event.key <= '9'
      ) {
        const index = parseInt(event.key) - 1;
        if (workspaces[index]) {
          event.preventDefault();
          router.push(`/${workspaces[index].slug}/dashboard`);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [workspaces, router]);

  // Show loading skeleton
  if (isLoading) {
    return <WorkspaceSwitcherSkeleton />;
  }

  // Show error state
  if (error) {
    return <WorkspaceSwitcherError onRetry={refetch} />;
  }

  // No active workspace
  if (!activeWorkspace) {
    return null;
  }

  const handleWorkspaceChange = async (workspace: Workspace) => {
    // Update user's current workspace preference in backend
    try {
      await fetch('/api/users/me/current-workspace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceSlug: workspace.slug }),
      });
    } catch (error) {
      // Non-blocking - continue with navigation even if preference update fails
      console.error('Failed to update current workspace preference:', error);
    }
    router.push(`/${workspace.slug}/dashboard`);
  };

  const handleCreateWorkspace = () => {
    router.push('/workspaces/new');
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              className='border min-w-9 min-h-9 data-[state=open]:border-white data-[state=open]:text-sidebar-accent-foreground hover:bg-none hover:opacity-80'
            >
              <div className='flex shrink-0 aspect-square size-9 items-center justify-center rounded-lg bg-card text-sidebar-primary-foreground overflow-hidden'>
                {activeWorkspace.avatarUrl ? (
                  <Avatar className='size-9 rounded-none'>
                    <AvatarImage
                      src={activeWorkspace.avatarUrl}
                      alt={activeWorkspace.name}
                    />
                    <AvatarFallback className='text-[10px]'>
                      {activeWorkspace.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <Building2 className='size-4 shrink-0 m-2' />
                )}
              </div>
              <div className='grid flex-1 text-left text-sm leading-tight'>
                <span className='truncate font-semibold'>
                  {activeWorkspace.name}
                </span>
              </div>
              <ChevronsUpDown className='ml-auto size-4' />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg'
            align='start'
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className='text-xs text-muted-foreground'>
              Workspaces
            </DropdownMenuLabel>
            {workspaces.map((workspace, index) => {
              return (
                <DropdownMenuItem
                  key={workspace.id}
                  onClick={() => handleWorkspaceChange(workspace)}
                  className='gap-2'
                >
                  <div className='flex size-6 items-center justify-center rounded-sm border overflow-hidden'>
                    {workspace.avatarUrl ? (
                      <Avatar className='h-6 w-6 rounded-none'>
                        <AvatarImage
                          src={workspace.avatarUrl}
                          alt={workspace.name}
                        />
                        <AvatarFallback className='text-[10px]'>
                          {workspace.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <Building2 className='size-4 shrink-0 m-2' />
                    )}
                  </div>
                  <div className='font-bold text-sm'>{workspace.name}</div>

                  {index < 9 && (
                    <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
                  )}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleCreateWorkspace}
              className='gap-2 p-2'
            >
              <div className='flex size-6 items-center justify-center rounded-md border bg-background'>
                <Plus className='size-4' />
              </div>
              <span className='font-medium text-muted-foreground'>
                Add workspace
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
