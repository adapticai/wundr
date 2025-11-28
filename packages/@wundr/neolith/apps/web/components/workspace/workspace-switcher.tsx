'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronsUpDown, Plus, Building2, AlertCircle } from 'lucide-react';

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
import { Badge } from '@/components/ui/badge';
import { useUserWorkspaces } from '@/hooks/use-workspaces';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan?: string;
  avatarUrl?: string | null;
  settings?: Record<string, unknown> | null;
}

// Helper to determine workspace plan/tier from settings
function getWorkspacePlan(workspace: Workspace): string {
  if (workspace.plan) return workspace.plan;
  if (workspace.settings && typeof workspace.settings === 'object') {
    const settings = workspace.settings as { plan?: string };
    if (settings.plan) return settings.plan;
  }
  return 'Free';
}

// Helper to get plan badge variant
function getPlanBadgeVariant(plan: string): 'default' | 'secondary' | 'outline' {
  const normalizedPlan = plan.toLowerCase();
  if (normalizedPlan === 'enterprise') return 'default';
  if (normalizedPlan === 'pro') return 'secondary';
  return 'outline';
}

// Loading skeleton component
function WorkspaceSwitcherSkeleton() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" disabled>
          <Skeleton className="size-8 rounded-lg" />
          <div className="grid flex-1 gap-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="size-4 ml-auto" />
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
          size="lg"
          onClick={onRetry}
          className="text-destructive hover:text-destructive"
        >
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-destructive/10">
            <AlertCircle className="size-4" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">Error loading workspaces</span>
            <span className="truncate text-xs">Click to retry</span>
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
  const activeWorkspace = workspaces.find((w) => w.slug === currentWorkspaceSlug || w.id === currentWorkspaceSlug) || workspaces[0];

  // Keyboard shortcuts for workspace switching (Cmd+1, Cmd+2, etc.)
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Cmd/Ctrl + number keys (1-9)
      if ((event.metaKey || event.ctrlKey) && event.key >= '1' && event.key <= '9') {
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

  const handleWorkspaceChange = (workspace: Workspace) => {
    router.push(`/${workspace.slug}/dashboard`);
  };

  const handleCreateWorkspace = () => {
    router.push('/workspaces/new');
  };

  const activePlan = getWorkspacePlan(activeWorkspace);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                {activeWorkspace.avatarUrl ? (
                  <span className="text-sm font-bold">
                    {activeWorkspace.name.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <Building2 className="size-4" />
                )}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {activeWorkspace.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {activePlan}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Workspaces
            </DropdownMenuLabel>
            {workspaces.map((workspace, index) => {
              const plan = getWorkspacePlan(workspace);

              return (
                <DropdownMenuItem
                  key={workspace.id}
                  onClick={() => handleWorkspaceChange(workspace)}
                  className="gap-2 p-2"
                >
                  <div className="flex size-6 items-center justify-center rounded-sm border">
                    {workspace.avatarUrl ? (
                      <span className="text-xs font-bold">
                        {workspace.name.charAt(0).toUpperCase()}
                      </span>
                    ) : (
                      <Building2 className="size-4 shrink-0" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                    <span className="truncate font-medium">{workspace.name}</span>
                    <Badge
                      variant={getPlanBadgeVariant(plan)}
                      className="w-fit text-[10px] px-1.5 py-0"
                    >
                      {plan}
                    </Badge>
                  </div>
                  {index < 9 && (
                    <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
                  )}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleCreateWorkspace} className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <Plus className="size-4" />
              </div>
              <span className="font-medium text-muted-foreground">Add workspace</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
