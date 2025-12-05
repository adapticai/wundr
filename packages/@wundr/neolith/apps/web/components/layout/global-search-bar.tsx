'use client';

import {
  Clock,
  File,
  FileText,
  Hash,
  Image,
  Loader2,
  MessageSquarePlus,
  Music,
  Search,
  Settings,
  User,
  Users,
  Video,
  Bot,
  PlusCircle,
  UserPlus,
  Archive,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useFilePreview } from '@/components/file-preview';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { cn, getInitials } from '@/lib/utils';

/**
 * Props for the GlobalSearchBar component
 */
export interface GlobalSearchBarProps {
  /** Optional CSS class name */
  className?: string;
}

/**
 * Search result types
 */
type SearchResultType =
  | 'channel'
  | 'dm'
  | 'user'
  | 'orchestrator'
  | 'message'
  | 'file';

interface SearchResult {
  id: string;
  type: SearchResultType;
  name: string;
  description?: string;
  image?: string | null;
  metadata?: {
    channelName?: string;
    memberCount?: number;
    participants?: string[];
    email?: string;
    isGroup?: boolean;
    mimeType?: string;
    size?: number;
    url?: string;
    thumbnailUrl?: string | null;
  };
}

interface RecentItem {
  id: string;
  type: 'channel' | 'dm' | 'user';
  name: string;
  image?: string | null;
  timestamp: number;
}

/**
 * Personalized suggestion types from the command-palette API
 */
interface ChannelSuggestion {
  type: 'channel';
  id: string;
  name: string;
  description: string | null;
  channelType: string;
  memberCount: number;
  lastActivityAt: string | null;
}

interface DMSuggestion {
  type: 'dm';
  id: string;
  name: string;
  participants: Array<{
    id: string;
    name: string | null;
    avatarUrl: string | null;
    isOrchestrator: boolean;
  }>;
  lastMessageAt: string | null;
}

interface PersonSuggestion {
  type: 'person';
  id: string;
  name: string | null;
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
  status: string;
  isOrchestrator: boolean;
  role?: string | null;
  discipline?: string | null;
}

interface FileSuggestion {
  type: 'file';
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  thumbnailUrl: string | null;
  channelName?: string;
  uploadedAt: string;
}

interface QuickAction {
  type: 'action';
  id: string;
  label: string;
  description: string;
  icon: string;
  shortcut?: string;
  path: string;
}

interface PersonalizedSuggestions {
  recentChannels: ChannelSuggestion[];
  recentDMs: DMSuggestion[];
  recentPeople: PersonSuggestion[];
  recentFiles: FileSuggestion[];
  quickActions: QuickAction[];
}

/**
 * Global Search Bar Component
 *
 * A command palette-style search component using shadcn/ui Command.
 * Features immediate suggestions, recent items, quick actions, and typeahead search.
 */
export function GlobalSearchBar({ className }: GlobalSearchBarProps) {
  const router = useRouter();
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { openPreview } = useFilePreview();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] =
    useState<PersonalizedSuggestions | null>(null);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const suggestionsLoadedRef = useRef(false);

  // Load recent items from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(`recent-items-${workspaceSlug}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setRecentItems(parsed.slice(0, 5));
      } catch (error) {
        console.error('Failed to parse recent items:', error);
      }
    }
  }, [workspaceSlug]);

  // Fetch personalized suggestions when dialog opens
  const fetchSuggestions = useCallback(async () => {
    if (!workspaceSlug || suggestionsLoadedRef.current) {
      return;
    }

    setIsSuggestionsLoading(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/command-palette`,
      );

      if (response.ok) {
        const data: PersonalizedSuggestions = await response.json();
        setSuggestions(data);
        suggestionsLoadedRef.current = true;
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    } finally {
      setIsSuggestionsLoading(false);
    }
  }, [workspaceSlug]);

  // Fetch suggestions when dialog opens
  useEffect(() => {
    if (open && !suggestionsLoadedRef.current) {
      fetchSuggestions();
    }
  }, [open, fetchSuggestions]);

  // Reset suggestions when workspace changes
  useEffect(() => {
    suggestionsLoadedRef.current = false;
    setSuggestions(null);
  }, [workspaceSlug]);

  // Save recent item to localStorage
  const saveRecentItem = useCallback(
    (item: Omit<RecentItem, 'timestamp'>) => {
      const newItem: RecentItem = {
        ...item,
        timestamp: Date.now(),
      };

      const updated = [
        newItem,
        ...recentItems.filter(r => r.id !== item.id),
      ].slice(0, 5);

      setRecentItems(updated);
      localStorage.setItem(
        `recent-items-${workspaceSlug}`,
        JSON.stringify(updated),
      );
    },
    [recentItems, workspaceSlug],
  );

  // Debounced search function
  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setResults([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/search?q=${encodeURIComponent(searchQuery)}&types=channels,users,orchestrators,dms,files&limit=20`,
        );

        if (response.ok) {
          const responseData = await response.json();
          const transformedResults: SearchResult[] = [];

          // Handle new unified data format from search API
          if (responseData.data && Array.isArray(responseData.data)) {
            for (const item of responseData.data) {
              switch (item.type) {
                case 'channel':
                  transformedResults.push({
                    id: item.id,
                    type: 'channel',
                    name: item.name,
                    description: item.description,
                    metadata: {
                      memberCount: item.memberCount,
                    },
                  });
                  break;
                case 'user':
                  transformedResults.push({
                    id: item.id,
                    type: 'user',
                    name: item.displayName || item.name || item.email,
                    description: item.email,
                    image: item.avatarUrl,
                    metadata: {
                      email: item.email,
                    },
                  });
                  break;
                case 'orchestrator':
                  transformedResults.push({
                    id: item.id,
                    type: 'orchestrator',
                    name: item.displayName || item.name || 'Orchestrator',
                    description: item.role || item.discipline || 'Orchestrator',
                    image: item.avatarUrl,
                  });
                  break;
                case 'dm':
                  transformedResults.push({
                    id: item.id,
                    type: 'dm',
                    name:
                      item.name ||
                      item.participants
                        ?.map((p: { name: string }) => p.name)
                        .join(', '),
                    description:
                      item.participants?.length > 2
                        ? `${item.participants.length} people`
                        : undefined,
                    image:
                      item.participants?.length === 2
                        ? item.participants[0].avatarUrl
                        : null,
                    metadata: {
                      isGroup: item.participants?.length > 2,
                      participants: item.participants?.map(
                        (p: { name: string }) => p.name,
                      ),
                    },
                  });
                  break;
                case 'file':
                  transformedResults.push({
                    id: item.id,
                    type: 'file',
                    name: item.originalName || item.filename,
                    description: item.channelName
                      ? `in #${item.channelName}`
                      : undefined,
                    image: item.thumbnailUrl || item.url,
                    metadata: {
                      mimeType: item.mimeType,
                      size: item.size,
                      url: item.url,
                      thumbnailUrl: item.thumbnailUrl,
                      channelName: item.channelName,
                    },
                  });
                  break;
              }
            }
          }

          setResults(transformedResults);
        }
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [workspaceSlug],
  );

  // Handle query change with debounce
  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (value.trim().length >= 2) {
        setIsLoading(true);
        debounceTimerRef.current = setTimeout(() => {
          performSearch(value);
        }, 300);
      } else {
        setResults([]);
        setIsLoading(false);
      }
    },
    [performSearch],
  );

  // Handle result selection
  const handleSelect = useCallback(
    (result: SearchResult) => {
      // Save to recent items (skip files for now)
      if (result.type !== 'file') {
        saveRecentItem({
          id: result.id,
          type:
            result.type === 'orchestrator'
              ? 'user'
              : result.type === 'message'
                ? 'channel'
                : result.type,
          name: result.name,
          image: result.image,
        });
      }

      setOpen(false);
      setQuery('');
      setResults([]);

      // Navigate based on result type
      switch (result.type) {
        case 'channel':
          router.push(`/${workspaceSlug}/channels/${result.id}`);
          break;
        case 'dm':
          router.push(`/${workspaceSlug}/dm/${result.id}`);
          break;
        case 'user':
          // Start a DM with the user
          router.push(`/${workspaceSlug}/messages/new?user=${result.id}`);
          break;
        case 'orchestrator':
          router.push(`/${workspaceSlug}/orchestrators/${result.id}`);
          break;
        case 'message':
          if (result.metadata?.channelName) {
            router.push(`/${workspaceSlug}/channels/${result.id}`);
          }
          break;
        case 'file':
          // Open file preview modal
          if (result.metadata?.url) {
            openPreview({
              id: result.id,
              url: result.metadata.url,
              originalName: result.name,
              mimeType: result.metadata.mimeType || 'application/octet-stream',
              size: result.metadata.size || 0,
              thumbnailUrl: result.metadata.thumbnailUrl,
            });
          } else {
            // Fetch the file URL if not available in metadata
            fetch(`/api/files/${result.id}/download?inline=true`)
              .then(res => res.json())
              .then(data => {
                if (data.data?.url) {
                  openPreview({
                    id: result.id,
                    url: data.data.url,
                    originalName: result.name,
                    mimeType:
                      result.metadata?.mimeType || 'application/octet-stream',
                    size: result.metadata?.size || 0,
                    thumbnailUrl: result.metadata?.thumbnailUrl,
                  });
                }
              })
              .catch(err => console.error('Error opening file preview:', err));
          }
          break;
      }
    },
    [router, saveRecentItem, workspaceSlug, openPreview],
  );

  // Handle recent item selection
  const handleRecentSelect = useCallback(
    (item: RecentItem) => {
      setOpen(false);
      setQuery('');

      switch (item.type) {
        case 'channel':
          router.push(`/${workspaceSlug}/channels/${item.id}`);
          break;
        case 'dm':
          router.push(`/${workspaceSlug}/dm/${item.id}`);
          break;
        case 'user':
          router.push(`/${workspaceSlug}/messages/new?user=${item.id}`);
          break;
      }
    },
    [router, workspaceSlug],
  );

  // Handle quick action selection (for dynamic quick actions from API)
  const handleQuickActionPath = useCallback(
    (path: string) => {
      setOpen(false);
      setQuery('');
      router.push(path);
    },
    [router],
  );

  // Handle channel suggestion selection
  const handleChannelSuggestion = useCallback(
    (channel: ChannelSuggestion) => {
      saveRecentItem({
        id: channel.id,
        type: 'channel',
        name: channel.name,
      });
      setOpen(false);
      setQuery('');
      router.push(`/${workspaceSlug}/channels/${channel.id}`);
    },
    [router, saveRecentItem, workspaceSlug],
  );

  // Handle DM suggestion selection
  const handleDMSuggestion = useCallback(
    (dm: DMSuggestion) => {
      const participantName = dm.participants[0]?.name || dm.name;
      const participantImage = dm.participants[0]?.avatarUrl;
      saveRecentItem({
        id: dm.id,
        type: 'dm',
        name: participantName,
        image: participantImage,
      });
      setOpen(false);
      setQuery('');
      router.push(`/${workspaceSlug}/dm/${dm.id}`);
    },
    [router, saveRecentItem, workspaceSlug],
  );

  // Handle person suggestion selection
  const handlePersonSuggestion = useCallback(
    (person: PersonSuggestion) => {
      saveRecentItem({
        id: person.id,
        type: 'user',
        name: person.displayName || person.name || person.email,
        image: person.avatarUrl,
      });
      setOpen(false);
      setQuery('');
      router.push(`/${workspaceSlug}/messages/new?user=${person.id}`);
    },
    [router, saveRecentItem, workspaceSlug],
  );

  // Handle file suggestion selection
  const handleFileSuggestion = useCallback(
    async (file: FileSuggestion) => {
      setOpen(false);
      setQuery('');
      // Open file preview modal
      try {
        const response = await fetch(
          `/api/files/${file.id}/download?inline=true`,
        );
        const data = await response.json();
        if (data.data?.url) {
          openPreview({
            id: file.id,
            url: data.data.url,
            originalName: file.originalName,
            mimeType: file.mimeType,
            size: file.size,
            thumbnailUrl: file.thumbnailUrl,
          });
        }
      } catch (err) {
        console.error('Error opening file preview:', err);
      }
    },
    [openPreview],
  );

  // Helper to get icon for quick actions
  const getQuickActionIcon = useCallback((iconName: string) => {
    switch (iconName) {
      case 'message-square-plus':
        return <MessageSquarePlus className='mr-2 h-4 w-4' />;
      case 'hash':
        return <Hash className='mr-2 h-4 w-4' />;
      case 'search':
        return <Search className='mr-2 h-4 w-4' />;
      case 'plus-circle':
        return <PlusCircle className='mr-2 h-4 w-4' />;
      case 'user-plus':
        return <UserPlus className='mr-2 h-4 w-4' />;
      case 'settings':
        return <Settings className='mr-2 h-4 w-4' />;
      default:
        return <Settings className='mr-2 h-4 w-4' />;
    }
  }, []);

  // Handle legacy quick actions (settings menu)
  const handleQuickAction = useCallback(
    (action: string) => {
      setOpen(false);
      setQuery('');

      switch (action) {
        case 'profile':
          router.push(`/${workspaceSlug}/settings/profile`);
          break;
        case 'billing':
          router.push(`/${workspaceSlug}/settings/billing`);
          break;
        case 'settings':
          router.push(`/${workspaceSlug}/settings`);
          break;
      }
    },
    [router, workspaceSlug],
  );

  // Keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(open => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Helper function to get file icon based on mime type
  const getFileIcon = useCallback((mimeType?: string) => {
    if (!mimeType) {
      return File;
    }
    if (mimeType.startsWith('image/')) {
      return Image;
    }
    if (mimeType.startsWith('video/')) {
      return Video;
    }
    if (mimeType.startsWith('audio/')) {
      return Music;
    }
    if (
      mimeType.includes('pdf') ||
      mimeType.includes('document') ||
      mimeType.includes('text')
    ) {
      return FileText;
    }
    if (
      mimeType.includes('zip') ||
      mimeType.includes('tar') ||
      mimeType.includes('rar')
    ) {
      return Archive;
    }
    return File;
  }, []);

  // Group results by type
  const channelResults = results.filter(r => r.type === 'channel');
  const dmResults = results.filter(r => r.type === 'dm');
  const userResults = results.filter(
    r => r.type === 'user' || r.type === 'orchestrator',
  );
  const fileResults = results.filter(r => r.type === 'file');

  return (
    <>
      {/* Search trigger button */}
      <button
        type='button'
        onClick={() => setOpen(true)}
        className={cn(
          'flex items-center gap-2 px-3 h-9 w-full rounded-md border border-input bg-muted/50 hover:bg-muted/80 transition-colors',
          className,
        )}
        aria-label='Search'
      >
        <Search className='h-4 w-4 text-muted-foreground shrink-0' />
        <span className='text-sm text-muted-foreground truncate'>
          Search messages, channels, and people...
        </span>
        <kbd className='hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-xs font-medium text-muted-foreground ml-auto shrink-0'>
          <span className='text-xs'>⌘</span>K
        </kbd>
      </button>

      {/* Command Dialog */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder='Type a command or search...'
          value={query}
          onValueChange={handleQueryChange}
        />
        <CommandList>
          {/* Loading state */}
          {isLoading && (
            <div className='flex items-center justify-center py-6'>
              <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />
              <span className='ml-2 text-sm text-muted-foreground'>
                Searching...
              </span>
            </div>
          )}

          {/* Empty state when searching */}
          {query.length >= 2 && !isLoading && results.length === 0 && (
            <CommandEmpty>
              No results found for &quot;{query}&quot;
            </CommandEmpty>
          )}

          {/* Search results */}
          {query.length >= 2 && !isLoading && results.length > 0 && (
            <>
              {channelResults.length > 0 && (
                <CommandGroup heading='Channels'>
                  {channelResults.map(result => (
                    <CommandItem
                      key={result.id}
                      value={`channel-${result.id}`}
                      onSelect={() => handleSelect(result)}
                      className='cursor-pointer'
                    >
                      <Hash className='mr-2 h-4 w-4 text-muted-foreground' />
                      <div className='flex flex-col flex-1'>
                        <span>{result.name}</span>
                        {result.description && (
                          <span className='text-xs text-muted-foreground truncate'>
                            {result.description}
                          </span>
                        )}
                      </div>
                      {result.metadata?.memberCount !== undefined && (
                        <span className='text-xs text-muted-foreground'>
                          {result.metadata.memberCount} members
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {dmResults.length > 0 && (
                <>
                  {channelResults.length > 0 && <CommandSeparator />}
                  <CommandGroup heading='Direct Messages'>
                    {dmResults.map(result => (
                      <CommandItem
                        key={result.id}
                        value={`dm-${result.id}`}
                        onSelect={() => handleSelect(result)}
                        className='cursor-pointer'
                      >
                        {result.metadata?.isGroup ? (
                          <Users className='mr-2 h-4 w-4 text-muted-foreground' />
                        ) : (
                          <Avatar className='mr-2 h-5 w-5'>
                            <AvatarImage src={result.image || undefined} />
                            <AvatarFallback className='text-[10px]'>
                              {getInitials(result.name)}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div className='flex flex-col flex-1'>
                          <span>{result.name}</span>
                          {result.description && (
                            <span className='text-xs text-muted-foreground'>
                              {result.description}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}

              {userResults.length > 0 && (
                <>
                  {(channelResults.length > 0 || dmResults.length > 0) && (
                    <CommandSeparator />
                  )}
                  <CommandGroup heading='People'>
                    {userResults.map(result => (
                      <CommandItem
                        key={result.id}
                        value={`user-${result.id}`}
                        onSelect={() => handleSelect(result)}
                        className='cursor-pointer'
                      >
                        {result.type === 'orchestrator' ? (
                          <div className='mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10'>
                            <Bot className='h-3 w-3 text-primary' />
                          </div>
                        ) : (
                          <Avatar className='mr-2 h-5 w-5'>
                            <AvatarImage src={result.image || undefined} />
                            <AvatarFallback className='text-[10px]'>
                              {getInitials(result.name)}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div className='flex flex-col flex-1'>
                          <span>{result.name}</span>
                          {result.description && (
                            <span className='text-xs text-muted-foreground'>
                              {result.description}
                            </span>
                          )}
                        </div>
                        {result.type === 'orchestrator' && (
                          <span className='text-xs text-primary'>AI</span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}

              {fileResults.length > 0 && (
                <>
                  {(channelResults.length > 0 ||
                    dmResults.length > 0 ||
                    userResults.length > 0) && <CommandSeparator />}
                  <CommandGroup heading='Files'>
                    {fileResults.map(result => {
                      const FileIcon = getFileIcon(result.metadata?.mimeType);
                      const isImage =
                        result.metadata?.mimeType?.startsWith('image/');
                      // Use thumbnailUrl first, then file URL for images
                      const imagePreviewUrl =
                        result.metadata?.thumbnailUrl ||
                        (isImage ? result.metadata?.url : null);
                      return (
                        <CommandItem
                          key={result.id}
                          value={`file-${result.id}`}
                          onSelect={() => handleSelect(result)}
                          className='cursor-pointer'
                        >
                          {isImage && imagePreviewUrl ? (
                            <div className='mr-2 h-8 w-8 shrink-0 overflow-hidden rounded'>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={imagePreviewUrl}
                                alt={result.name}
                                className='h-full w-full object-cover'
                              />
                            </div>
                          ) : (
                            <FileIcon className='mr-2 h-4 w-4 text-muted-foreground' />
                          )}
                          <div className='flex flex-col flex-1 min-w-0'>
                            <span className='truncate'>{result.name}</span>
                            {result.description && (
                              <span className='text-xs text-muted-foreground'>
                                {result.description}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </>
              )}
            </>
          )}

          {/* Default suggestions when no query */}
          {query.length < 2 && !isLoading && (
            <>
              {/* Loading state for suggestions */}
              {isSuggestionsLoading && (
                <div className='flex items-center justify-center py-6'>
                  <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />
                  <span className='ml-2 text-sm text-muted-foreground'>
                    Loading suggestions...
                  </span>
                </div>
              )}

              {/* Quick Actions from API */}
              {suggestions?.quickActions &&
                suggestions.quickActions.length > 0 && (
                  <>
                    <CommandGroup heading='Quick Actions'>
                      {suggestions.quickActions.map(action => (
                        <CommandItem
                          key={action.id}
                          value={`action-${action.id}`}
                          onSelect={() => handleQuickActionPath(action.path)}
                          className='cursor-pointer'
                        >
                          {getQuickActionIcon(action.icon)}
                          <div className='flex flex-col flex-1'>
                            <span>{action.label}</span>
                            <span className='text-xs text-muted-foreground'>
                              {action.description}
                            </span>
                          </div>
                          {action.shortcut && (
                            <CommandShortcut>{action.shortcut}</CommandShortcut>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    <CommandSeparator />
                  </>
                )}

              {/* Recent Channels from API */}
              {suggestions?.recentChannels &&
                suggestions.recentChannels.length > 0 && (
                  <>
                    <CommandGroup heading='Recent Channels'>
                      {suggestions.recentChannels.map(channel => (
                        <CommandItem
                          key={channel.id}
                          value={`channel-${channel.id}`}
                          onSelect={() => handleChannelSuggestion(channel)}
                          className='cursor-pointer'
                        >
                          <Hash className='mr-2 h-4 w-4 text-muted-foreground' />
                          <div className='flex flex-col flex-1'>
                            <span>{channel.name}</span>
                            {channel.description && (
                              <span className='text-xs text-muted-foreground truncate max-w-[200px]'>
                                {channel.description}
                              </span>
                            )}
                          </div>
                          <span className='text-xs text-muted-foreground'>
                            {channel.memberCount} members
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    <CommandSeparator />
                  </>
                )}

              {/* Recent DMs from API */}
              {suggestions?.recentDMs && suggestions.recentDMs.length > 0 && (
                <>
                  <CommandGroup heading='Recent Messages'>
                    {suggestions.recentDMs.map(dm => {
                      const participant = dm.participants[0];
                      const isGroup = dm.participants.length > 1;
                      return (
                        <CommandItem
                          key={dm.id}
                          value={`dm-${dm.id}`}
                          onSelect={() => handleDMSuggestion(dm)}
                          className='cursor-pointer'
                        >
                          {isGroup ? (
                            <Users className='mr-2 h-4 w-4 text-muted-foreground' />
                          ) : participant?.isOrchestrator ? (
                            <div className='mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10'>
                              <Bot className='h-3 w-3 text-primary' />
                            </div>
                          ) : (
                            <Avatar className='mr-2 h-5 w-5'>
                              <AvatarImage
                                src={participant?.avatarUrl || undefined}
                              />
                              <AvatarFallback className='text-[10px]'>
                                {(participant?.name || dm.name || 'D')
                                  .charAt(0)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <span>
                            {isGroup
                              ? dm.participants.map(p => p.name).join(', ')
                              : participant?.name || dm.name}
                          </span>
                          {participant?.isOrchestrator && (
                            <span className='text-xs text-primary ml-auto'>
                              AI
                            </span>
                          )}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}

              {/* Recent People from API */}
              {suggestions?.recentPeople &&
                suggestions.recentPeople.length > 0 && (
                  <>
                    <CommandGroup heading="People You've Contacted">
                      {suggestions.recentPeople.map(person => (
                        <CommandItem
                          key={person.id}
                          value={`person-${person.id}`}
                          onSelect={() => handlePersonSuggestion(person)}
                          className='cursor-pointer'
                        >
                          {person.isOrchestrator ? (
                            <div className='mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10'>
                              <Bot className='h-3 w-3 text-primary' />
                            </div>
                          ) : (
                            <Avatar className='mr-2 h-5 w-5'>
                              <AvatarImage
                                src={person.avatarUrl || undefined}
                              />
                              <AvatarFallback className='text-[10px]'>
                                {(
                                  person.displayName ||
                                  person.name ||
                                  person.email
                                )
                                  .charAt(0)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div className='flex flex-col flex-1'>
                            <span>
                              {person.displayName ||
                                person.name ||
                                person.email}
                            </span>
                            {person.isOrchestrator && person.role && (
                              <span className='text-xs text-muted-foreground'>
                                {person.role}
                              </span>
                            )}
                          </div>
                          {person.isOrchestrator && (
                            <span className='text-xs text-primary'>AI</span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    <CommandSeparator />
                  </>
                )}

              {/* Recent Files from API */}
              {suggestions?.recentFiles &&
                suggestions.recentFiles.length > 0 && (
                  <>
                    <CommandGroup heading='Recent Files'>
                      {suggestions.recentFiles.map(file => (
                        <CommandItem
                          key={file.id}
                          value={`file-${file.id}`}
                          onSelect={() => handleFileSuggestion(file)}
                          className='cursor-pointer'
                        >
                          <File className='mr-2 h-4 w-4 text-muted-foreground' />
                          <div className='flex flex-col flex-1'>
                            <span className='truncate max-w-[200px]'>
                              {file.originalName}
                            </span>
                            {file.channelName && (
                              <span className='text-xs text-muted-foreground'>
                                in #{file.channelName}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    <CommandSeparator />
                  </>
                )}

              {/* Fallback to localStorage recent items if no API suggestions */}
              {!suggestions &&
                !isSuggestionsLoading &&
                recentItems.length > 0 && (
                  <>
                    <CommandGroup heading='Recent'>
                      {recentItems.map(item => (
                        <CommandItem
                          key={item.id}
                          value={`recent-${item.id}`}
                          onSelect={() => handleRecentSelect(item)}
                          className='cursor-pointer'
                        >
                          {item.type === 'channel' ? (
                            <Hash className='mr-2 h-4 w-4 text-muted-foreground' />
                          ) : item.image ? (
                            <Avatar className='mr-2 h-5 w-5'>
                              <AvatarImage src={item.image} />
                              <AvatarFallback className='text-[10px]'>
                                {getInitials(item.name)}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <Clock className='mr-2 h-4 w-4 text-muted-foreground' />
                          )}
                          <span>{item.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    <CommandSeparator />
                  </>
                )}

              {/* Settings (always shown) */}
              <CommandGroup heading='Settings'>
                <CommandItem onSelect={() => handleQuickAction('profile')}>
                  <User className='mr-2 h-4 w-4' />
                  <span>Profile</span>
                  <CommandShortcut>⌘P</CommandShortcut>
                </CommandItem>
                <CommandItem onSelect={() => handleQuickAction('settings')}>
                  <Settings className='mr-2 h-4 w-4' />
                  <span>Settings</span>
                  <CommandShortcut>⌘,</CommandShortcut>
                </CommandItem>
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}

export default GlobalSearchBar;
