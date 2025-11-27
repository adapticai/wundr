'use client';

import {
  Hash,
  MessageSquare,
  User,
  Workflow,
  Users,
  Clock,
  Search,
  Loader2,
} from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { useState, useCallback, useRef, useEffect } from 'react';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
type SearchResultType = 'channel' | 'message' | 'member' | 'workflow' | 'vp';

interface SearchResult {
  id: string;
  type: SearchResultType;
  name: string;
  description?: string;
  metadata?: {
    channelName?: string;
    memberCount?: number;
    lastActive?: string;
  };
}

interface RecentSearch {
  query: string;
  timestamp: number;
}

/**
 * Global Search Bar Component
 *
 * A command palette-style search component for the workspace header that allows
 * users to quickly search across channels, direct messages, members, workflows, and VPs.
 *
 * Features:
 * - Keyboard shortcut support (Cmd/Ctrl + K)
 * - Debounced API calls
 * - Recent searches tracking
 * - Categorized results
 * - Loading states
 * - Direct navigation to results
 */
export function GlobalSearchBar({ className }: GlobalSearchBarProps) {
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load recent searches from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(`recent-searches-${workspaceId}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setRecentSearches(parsed.slice(0, 5)); // Keep only 5 most recent
      } catch (error) {
        console.error('Failed to parse recent searches:', error);
      }
    }
  }, [workspaceId]);

  // Save recent searches to localStorage
  const saveRecentSearch = useCallback(
    (searchQuery: string) => {
      if (!searchQuery.trim()) return;

      const newSearch: RecentSearch = {
        query: searchQuery.trim(),
        timestamp: Date.now(),
      };

      const updated = [
        newSearch,
        ...recentSearches.filter((s) => s.query !== searchQuery.trim()),
      ].slice(0, 5);

      setRecentSearches(updated);
      localStorage.setItem(`recent-searches-${workspaceId}`, JSON.stringify(updated));
    },
    [recentSearches, workspaceId]
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
          `/api/workspaces/${workspaceId}/search?q=${encodeURIComponent(searchQuery)}&limit=15&highlight=true`
        );

        if (response.ok) {
          const data = await response.json();

          // Transform API response to our SearchResult format
          const transformedResults: SearchResult[] = data.data.map((item: any) => {
            switch (item.type) {
              case 'channel':
                return {
                  id: item.id,
                  type: 'channel' as SearchResultType,
                  name: item.name,
                  description: item.description,
                  metadata: {
                    memberCount: item.memberCount,
                  },
                };
              case 'message':
                return {
                  id: item.id,
                  type: 'message' as SearchResultType,
                  name: item.content.substring(0, 100) + (item.content.length > 100 ? '...' : ''),
                  description: `by ${item.authorName}`,
                  metadata: {
                    channelName: item.channelName,
                  },
                };
              default:
                return {
                  id: item.id,
                  type: item.type as SearchResultType,
                  name: item.name || item.filename || 'Unknown',
                  description: item.description,
                };
            }
          });

          setResults(transformedResults);
        }
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [workspaceId]
  );

  // Handle query change with debounce
  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (value.trim().length >= 2) {
        debounceTimerRef.current = setTimeout(() => {
          performSearch(value);
        }, 300);
      } else {
        setResults([]);
        setIsLoading(false);
      }
    },
    [performSearch]
  );

  // Handle result selection
  const handleSelect = useCallback(
    (result: SearchResult) => {
      saveRecentSearch(query);
      setOpen(false);
      setQuery('');
      setResults([]);

      // Navigate based on result type
      switch (result.type) {
        case 'channel':
          router.push(`/${workspaceId}/channels/${result.id}`);
          break;
        case 'message':
          if (result.metadata?.channelName) {
            router.push(`/${workspaceId}/channels/${result.id}`);
          }
          break;
        case 'member':
          router.push(`/${workspaceId}/members/${result.id}`);
          break;
        case 'workflow':
          router.push(`/${workspaceId}/workflows/${result.id}`);
          break;
        case 'vp':
          router.push(`/${workspaceId}/orchestrators/${result.id}`);
          break;
      }
    },
    [query, router, saveRecentSearch, workspaceId]
  );

  // Handle recent search click
  const handleRecentSearchClick = useCallback(
    (searchQuery: string) => {
      setQuery(searchQuery);
      performSearch(searchQuery);
    },
    [performSearch]
  );

  // Keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
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

  // Get icon for result type
  const getResultIcon = (type: SearchResultType) => {
    switch (type) {
      case 'channel':
        return Hash;
      case 'message':
        return MessageSquare;
      case 'member':
        return User;
      case 'workflow':
        return Workflow;
      case 'vp':
        return Users;
      default:
        return Search;
    }
  };

  // Get label for result type
  const getResultTypeLabel = (type: SearchResultType): string => {
    switch (type) {
      case 'channel':
        return 'Channel';
      case 'message':
        return 'Message';
      case 'member':
        return 'Member';
      case 'workflow':
        return 'Workflow';
      case 'vp':
        return 'Orchestrator';
      default:
        return 'Result';
    }
  };

  // Group results by type
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = [];
    }
    acc[result.type].push(result);
    return acc;
  }, {} as Record<SearchResultType, SearchResult[]>);

  return (
    <>
      {/* Search trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex items-center gap-2 px-3 h-9 rounded-lg border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors',
          className
        )}
        aria-label="Search"
      >
        <Search className="h-4 w-4 text-muted-foreground" />
        <span className="hidden md:inline-block text-sm text-muted-foreground">
          Search...
        </span>
        <kbd className="hidden md:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground ml-auto">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Command Dialog */}
      <Command
        shouldFilter={false}
        className={cn(
          'fixed left-[50%] top-[50%] z-50 w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] rounded-lg border bg-popover shadow-lg',
          open ? 'block' : 'hidden'
        )}
      >
        <div className="relative">
          <CommandInput
            placeholder="Search channels, people, workflows..."
            value={query}
            onValueChange={handleQueryChange}
            className="border-b"
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        <CommandList className="max-h-[400px]">
          {!query && recentSearches.length > 0 && (
            <CommandGroup heading="Recent Searches">
              {recentSearches.map((search, index) => (
                <CommandItem
                  key={index}
                  onSelect={() => handleRecentSearchClick(search.query)}
                  className="cursor-pointer"
                >
                  <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{search.query}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {query && results.length === 0 && !isLoading && (
            <CommandEmpty>No results found for &quot;{query}&quot;</CommandEmpty>
          )}

          {query && results.length > 0 && (
            <>
              {Object.entries(groupedResults).map(([type, items], groupIndex) => (
                <div key={type}>
                  {groupIndex > 0 && <CommandSeparator />}
                  <CommandGroup heading={`${getResultTypeLabel(type as SearchResultType)}s`}>
                    {items.map((result) => {
                      const Icon = getResultIcon(result.type);
                      return (
                        <CommandItem
                          key={result.id}
                          onSelect={() => handleSelect(result)}
                          className="cursor-pointer"
                        >
                          <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                          <div className="flex flex-col flex-1 gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{result.name}</span>
                              {result.metadata?.memberCount !== undefined && (
                                <Badge variant="secondary" className="text-xs">
                                  {result.metadata.memberCount} members
                                </Badge>
                              )}
                            </div>
                            {result.description && (
                              <span className="text-xs text-muted-foreground">
                                {result.description}
                              </span>
                            )}
                            {result.metadata?.channelName && (
                              <span className="text-xs text-muted-foreground">
                                in #{result.metadata.channelName}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </div>
              ))}
            </>
          )}
        </CommandList>
      </Command>

      {/* Backdrop overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/80"
          onClick={() => {
            setOpen(false);
            setQuery('');
            setResults([]);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
              setQuery('');
              setResults([]);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Close search"
        />
      )}
    </>
  );
}

export default GlobalSearchBar;
