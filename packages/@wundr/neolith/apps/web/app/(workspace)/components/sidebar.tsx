'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { ChannelList } from '@/components/channel';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Logo } from '@/components/ui/Logo';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useChannelMutations, useChannels, useDirectMessages } from '@/hooks/use-channel';
import { useRealtimeSidebar } from '@/hooks/use-realtime-sidebar';
import { cn } from '@/lib/utils';

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
  const workspaceId = (params.workspaceSlug as string) || currentWorkspace?.id || '';

  const [showWorkspaceSwitcher, setShowWorkspaceSwitcher] = useState(false);

  // Fetch channels and DMs for current workspace
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

  // Use realtime SSE for starred items
  const {
    starredChannels,
    starredDMs,
    updateChannelStarStatus,
    updateDMStarStatus,
  } = useRealtimeSidebar({
    workspaceSlug: workspaceId,
    enabled: !!workspaceId,
  });

  // Handle channel star toggle with optimistic updates
  const handleChannelStarChange = useCallback((channelId: string, isStarred: boolean) => {
    console.log('[Sidebar] handleChannelStarChange called:', { channelId, isStarred });
    // Find the channel from ALL channels (including already starred ones)
    const channel = allChannels.find((c) => c.id === channelId);
    console.log('[Sidebar] Found channel:', channel?.name);
    updateChannelStarStatus(channelId, isStarred, channel);
  }, [allChannels, updateChannelStarStatus]);

  // Handle DM star toggle with optimistic updates
  const handleDMStarChange = useCallback((dmId: string, isStarred: boolean) => {
    // Find the DM from the directMessages list
    const dm = directMessages.find((d) => d.id === dmId);
    updateDMStarStatus(dmId, isStarred, dm);
  }, [directMessages, updateDMStarStatus]);
  const { createChannel } = useChannelMutations();

  const handleCreateChannel = useCallback(
    async (input: {
      name: string;
      type: 'public' | 'private';
      description?: string;
      memberIds?: string[];
    }) => {
      await createChannel(workspaceId, input);
      // Refetch channels after creation
      await refetchChannels();
    },
    [workspaceId, createChannel, refetchChannels],
  );

  const handleRetry = useCallback(async () => {
    await Promise.all([refetchChannels(), refetchDMs()]);
  }, [refetchChannels, refetchDMs]);

  const navItems = [
    { href: `/${workspaceId}/dashboard`, icon: <DashboardIcon />, label: 'Dashboard' },
    { href: `/${workspaceId}/orchestrators`, icon: <OrchestratorsIcon />, label: 'Orchestrators' },
    { href: `/${workspaceId}/agents`, icon: <AgentsIcon />, label: 'Agents' },
    { href: `/${workspaceId}/workflows`, icon: <WorkflowsIcon />, label: 'Workflows' },
    { href: `/${workspaceId}/deployments`, icon: <DeploymentsIcon />, label: 'Deployments' },
    { href: `/${workspaceId}/later`, icon: <LaterIcon />, label: 'Later' },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 border-r border-stone-800 bg-stone-950 lg:block">
      <div className="flex h-full flex-col">
        {/* Spacer for macOS Electron window controls (traffic lights) */}
        <div className="h-8 shrink-0 [-webkit-app-region:drag]" />
        {/* Workspace Switcher */}
        <div className="relative border-b border-stone-800">
          <button
            type="button"
            onClick={() => setShowWorkspaceSwitcher(!showWorkspaceSwitcher)}
            className="flex h-14 w-full items-center gap-3 px-4 hover:bg-stone-900"
          >
            {currentWorkspace?.icon ? (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-800 text-sm font-bold text-stone-100">
                {currentWorkspace.icon}
              </div>
            ) : currentWorkspace?.name ? (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-800 text-sm font-bold text-stone-100">
                {currentWorkspace.name.charAt(0).toUpperCase()}
              </div>
            ) : (
              <Logo className="h-6 w-auto text-stone-100" />
            )}
            <div className="flex-1 text-left">
              <p className="font-semibold text-stone-100">
                {currentWorkspace?.name || 'Neolith'}
              </p>
            </div>
            <ChevronDownIcon
              className={cn(
                'h-4 w-4 text-stone-400 transition-transform',
                showWorkspaceSwitcher && 'rotate-180',
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
              <div className="absolute left-2 right-2 top-full z-20 mt-1 rounded-md border border-stone-800 bg-stone-900 py-1 shadow-lg">
                {workspaces.map((workspace) => (
                  <Link
                    key={workspace.id}
                    href={`/${workspace.id}/dashboard`}
                    onClick={() => setShowWorkspaceSwitcher(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 text-stone-100 hover:bg-stone-800',
                      workspace.id === currentWorkspace?.id && 'bg-stone-800/50',
                    )}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-800 text-sm font-bold text-stone-100">
                      {workspace.icon || workspace.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium">{workspace.name}</span>
                    {workspace.id === currentWorkspace?.id && (
                      <CheckIcon className="ml-auto h-4 w-4 text-stone-400" />
                    )}
                  </Link>
                ))}
                <div className="my-1 h-px bg-stone-800" />
                <Link
                  href="/workspaces/new"
                  onClick={() => setShowWorkspaceSwitcher(false)}
                  className="flex items-center gap-3 px-3 py-2 text-stone-400 hover:bg-stone-800 hover:text-stone-100"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-dashed border-stone-700">
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
          {navItems.map((item) =>
            item.label === 'Later' ? (
              <LaterNavItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                workspaceId={workspaceId}
                isActive={pathname === item.href || pathname?.startsWith(`${item.href}/`)}
              />
            ) : (
              <NavItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                isActive={pathname === item.href || pathname?.startsWith(`${item.href}/`)}
              />
            ),
          )}
        </nav>

        <div className="h-px bg-stone-800" />

        {/* Channel List */}
        <div className="flex-1 overflow-hidden">
          <ChannelList
            workspaceId={workspaceId}
            channels={[...publicChannels, ...privateChannels]}
            directMessages={directMessages}
            starredChannels={starredChannels}
            starredDMs={starredDMs}
            isLoading={isChannelsLoading || isDMsLoading}
            error={channelsError || dmsError}
            onCreateChannel={handleCreateChannel}
            onRetry={handleRetry}
            onChannelStarChange={handleChannelStarChange}
            onDMStarChange={handleDMStarChange}
            className="h-full"
          />
        </div>

        {/* User Section */}
        <div className="border-t border-stone-800 p-3">
          <Link
            href={`/${workspaceId}/settings/profile`}
            className="flex items-center gap-3 rounded-lg p-2 hover:bg-stone-900"
          >
            <UserAvatar
              user={{
                name: user?.name,
                image: user?.image,
                status: 'online',
              }}
              size="lg"
              shape="rounded"
              showStatus
              fallbackClassName="bg-stone-800 text-stone-100"
            />
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-stone-100">
                {user?.name || 'User'}
              </p>
              <p className="truncate text-xs text-stone-400">
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
          ? 'bg-stone-900 text-stone-100'
          : 'text-stone-400 hover:bg-stone-900 hover:text-stone-100',
      )}
    >
      <span className="flex h-5 w-5 items-center justify-center">{icon}</span>
      {label}
    </Link>
  );
}

interface LaterNavItemProps {
  href: string;
  icon: React.ReactNode;
  workspaceId: string;
  isActive?: boolean;
}

interface SavedItemPreview {
  id: string;
  itemType: 'MESSAGE' | 'FILE';
  createdAt: string;
  message: {
    content: string;
    author: {
      name: string | null;
      displayName: string | null;
    };
  } | null;
  file: {
    originalName: string;
  } | null;
}

function LaterNavItem({ href, icon, workspaceId, isActive }: LaterNavItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<SavedItemPreview[]>([]);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && workspaceId) {
      setIsLoading(true);
      fetch(`/api/workspaces/${workspaceId}/saved-items?status=IN_PROGRESS&limit=5`)
        .then((res) => res.json())
        .then((data) => {
          setItems(data.data || []);
          setCount(data.pagination?.totalCount || 0);
        })
        .catch((err) => {
          console.error('Failed to fetch saved items:', err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, workspaceId]);

  return (
    <HoverCard openDelay={300} closeDelay={100} onOpenChange={setIsOpen}>
      <HoverCardTrigger asChild>
        <Link
          href={href}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isActive
              ? 'bg-stone-900 text-stone-100'
              : 'text-stone-400 hover:bg-stone-900 hover:text-stone-100',
          )}
        >
          <span className="flex h-5 w-5 items-center justify-center">{icon}</span>
          Later
          {count > 0 && (
            <span className="ml-auto rounded-full bg-stone-800 px-1.5 py-0.5 text-xs">
              {count}
            </span>
          )}
        </Link>
      </HoverCardTrigger>
      <HoverCardContent side="right" align="start" className="w-72 bg-stone-900 border-stone-800 p-0">
        <div className="p-3 border-b border-stone-800">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-stone-100">Saved for later</h4>
            {count > 0 && (
              <span className="text-xs text-stone-400">{count} item{count !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-600 border-t-stone-300" />
            </div>
          ) : items.length === 0 ? (
            <div className="p-4 text-center text-sm text-stone-500">
              No saved items yet
            </div>
          ) : (
            <div className="divide-y divide-stone-800">
              {items.map((item) => (
                <div key={item.id} className="p-3 hover:bg-stone-800/50">
                  {item.itemType === 'MESSAGE' && item.message ? (
                    <div>
                      <p className="text-xs text-stone-400 mb-1">
                        {item.message.author.displayName || item.message.author.name || 'Unknown'}
                      </p>
                      <p className="text-sm text-stone-300 line-clamp-2">
                        {item.message.content}
                      </p>
                    </div>
                  ) : item.itemType === 'FILE' && item.file ? (
                    <div className="flex items-center gap-2">
                      <FileIcon className="h-4 w-4 text-stone-400 shrink-0" />
                      <p className="text-sm text-stone-300 truncate">
                        {item.file.originalName}
                      </p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
        {items.length > 0 && (
          <div className="p-2 border-t border-stone-800">
            <Link
              href={href}
              className="block w-full rounded px-3 py-1.5 text-center text-xs text-stone-400 hover:bg-stone-800 hover:text-stone-100"
            >
              View all saved items
            </Link>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

function FileIcon({ className }: { className?: string }) {
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
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
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

function OrchestratorsIcon() {
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

function LaterIcon() {
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
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
    </svg>
  );
}
