'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ChannelList } from '@/components/channel';
import { useChannels, useDirectMessages, useChannelMutations } from '@/hooks/use-channel';

interface Workspace {
  id: string;
  name: string;
  icon?: string;
}

interface SidebarProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  workspaces?: Workspace[];
  currentWorkspace?: Workspace | null;
}

export function Sidebar({ user, workspaces = [], currentWorkspace }: SidebarProps) {
  const pathname = usePathname();
  const params = useParams();
  const workspaceId = (params.workspaceId as string) || currentWorkspace?.id || '';

  const [showWorkspaceSwitcher, setShowWorkspaceSwitcher] = useState(false);

  // Fetch channels and DMs for current workspace
  const {
    publicChannels,
    privateChannels,
    starredChannels,
    isLoading: isChannelsLoading,
  } = useChannels(workspaceId);

  const { directMessages, isLoading: isDMsLoading } = useDirectMessages(workspaceId);
  const { createChannel } = useChannelMutations();

  const handleCreateChannel = useCallback(
    async (input: {
      name: string;
      type: 'public' | 'private';
      description?: string;
      memberIds?: string[];
    }) => {
      await createChannel(workspaceId, input);
    },
    [workspaceId, createChannel]
  );

  const navItems = [
    { href: `/${workspaceId}/dashboard`, icon: <DashboardIcon />, label: 'Dashboard' },
    { href: `/${workspaceId}/vps`, icon: <VPsIcon />, label: 'Virtual Persons' },
    { href: `/${workspaceId}/agents`, icon: <AgentsIcon />, label: 'Agents' },
    { href: `/${workspaceId}/workflows`, icon: <WorkflowsIcon />, label: 'Workflows' },
    { href: `/${workspaceId}/deployments`, icon: <DeploymentsIcon />, label: 'Deployments' },
    { href: `/${workspaceId}/settings`, icon: <SettingsIcon />, label: 'Settings' },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 border-r bg-card lg:block dark:bg-card">
      <div className="flex h-full flex-col">
        {/* Workspace Switcher */}
        <div className="relative border-b">
          <button
            type="button"
            onClick={() => setShowWorkspaceSwitcher(!showWorkspaceSwitcher)}
            className="flex h-14 w-full items-center gap-3 px-4 hover:bg-accent"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              {currentWorkspace?.icon || currentWorkspace?.name?.charAt(0).toUpperCase() || 'G'}
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-foreground">
                {currentWorkspace?.name || 'Genesis'}
              </p>
            </div>
            <ChevronDownIcon
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                showWorkspaceSwitcher && 'rotate-180'
              )}
            />
          </button>

          {/* Workspace dropdown */}
          {showWorkspaceSwitcher && workspaces.length > 0 && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowWorkspaceSwitcher(false)}
              />
              <div className="absolute left-2 right-2 top-full z-20 mt-1 rounded-md border bg-card py-1 shadow-lg">
                {workspaces.map((workspace) => (
                  <Link
                    key={workspace.id}
                    href={`/${workspace.id}/dashboard`}
                    onClick={() => setShowWorkspaceSwitcher(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 hover:bg-accent',
                      workspace.id === currentWorkspace?.id && 'bg-accent/50'
                    )}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-sm font-bold">
                      {workspace.icon || workspace.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium">{workspace.name}</span>
                    {workspace.id === currentWorkspace?.id && (
                      <CheckIcon className="ml-auto h-4 w-4 text-primary" />
                    )}
                  </Link>
                ))}
                <div className="my-1 h-px bg-border" />
                <Link
                  href="/workspaces/new"
                  onClick={() => setShowWorkspaceSwitcher(false)}
                  className="flex items-center gap-3 px-3 py-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-dashed">
                    <PlusIcon className="h-4 w-4" />
                  </div>
                  <span className="text-sm">Create workspace</span>
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Main Navigation */}
        <nav className="space-y-1 p-3">
          {navItems.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              isActive={pathname === item.href || pathname?.startsWith(`${item.href}/`)}
            />
          ))}
        </nav>

        <div className="h-px bg-border" />

        {/* Channel List */}
        <div className="flex-1 overflow-hidden">
          <ChannelList
            workspaceId={workspaceId}
            channels={[...publicChannels, ...privateChannels]}
            directMessages={directMessages}
            starredChannels={starredChannels}
            isLoading={isChannelsLoading || isDMsLoading}
            onCreateChannel={handleCreateChannel}
            className="h-full"
          />
        </div>

        {/* User Section */}
        <div className="border-t p-3">
          <Link
            href={`/${workspaceId}/settings/profile`}
            className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent"
          >
            <div className="relative">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                {user?.image ? (
                  <img
                    src={user.image}
                    alt={user.name || 'User'}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  user?.name?.charAt(0).toUpperCase() || 'U'
                )}
              </div>
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-green-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {user?.name || 'User'}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user?.email || 'user@example.com'}
              </p>
            </div>
          </Link>
        </div>
      </div>
    </aside>
  );
}

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
}

function NavItem({ href, icon, label, isActive }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-accent text-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      <span className="flex h-5 w-5 items-center justify-center">{icon}</span>
      {label}
    </Link>
  );
}

// Navigation Icons
function DashboardIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  );
}

function AgentsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  );
}

function WorkflowsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="8" height="8" x="3" y="3" rx="2" />
      <path d="M7 11v4a2 2 0 0 0 2 2h4" />
      <rect width="8" height="8" x="13" y="13" rx="2" />
    </svg>
  );
}

function DeploymentsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function VPsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}
