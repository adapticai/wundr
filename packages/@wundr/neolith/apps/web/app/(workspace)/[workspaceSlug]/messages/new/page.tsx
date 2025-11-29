'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { X, Users, Bot, Mail, Check, Hash, BellOff } from 'lucide-react';

import { MessageInput } from '@/components/chat';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn, getInitials } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';

/**
 * Result types for the search dropdown
 */
type ResultType = 'channel' | 'group_dm' | 'user' | 'orchestrator' | 'email';

interface SearchResult {
  id: string; // Unique key for React (composite: type-originalId)
  _originalId: string; // Original database ID for API calls/navigation
  name: string;
  email?: string;
  image?: string | null;
  type: ResultType;
  status?: 'online' | 'offline' | 'away' | 'busy';
  subtitle?: string;
  // For group DMs
  participants?: { id: string; name: string; image?: string | null }[];
  participantCount?: number;
  // For users
  title?: string;
  notificationStatus?: string;
}

interface Recipient {
  id: string;
  name: string;
  email?: string;
  image?: string | null;
  type: 'user' | 'orchestrator' | 'email';
  status?: 'online' | 'offline' | 'away' | 'busy';
  title?: string;
  notificationStatus?: string;
}

/**
 * New Message Composer Page
 *
 * Slack-style interface for creating new DM conversations with:
 * - To: field with comprehensive search (channels, group DMs, users, orchestrators, email)
 * - Profile card when single user selected
 * - Multi-participant intro with side-by-side avatars
 */
export default function NewMessagePage() {
  const params = useParams();
  const router = useRouter();
  const workspaceSlug = params.workspaceSlug as string;
  const { user: authUser, isLoading: isAuthLoading } = useAuth();

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showInitialSuggestions, setShowInitialSuggestions] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Convert auth user to local User type
  const currentUser = useMemo(() => {
    if (!authUser) return null;
    return {
      id: authUser.id,
      name: authUser.name || 'Unknown User',
      email: authUser.email || '',
      image: authUser.image,
      status: 'online' as const,
    };
  }, [authUser]);

  // Load initial suggestions (channels, recent DMs, users)
  useEffect(() => {
    if (!workspaceSlug || recipients.length > 0) return;

    const loadInitialSuggestions = async () => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/search?q=*&types=channels,dms,users,orchestrators&limit=10`
        );

        if (response.ok) {
          const responseData = await response.json();
          const searchData = responseData.data || [];
          const results: SearchResult[] = [];
          const seenIds = new Set<string>(); // Track seen IDs to avoid duplicates

          // Filter channels from search results
          const channels = searchData.filter((item: any) => item.type === 'channel').slice(0, 3);
          for (const channel of channels) {
            const uniqueKey = `channel-${channel.id}`;
            if (seenIds.has(uniqueKey)) continue;
            seenIds.add(uniqueKey);
            results.push({
              id: uniqueKey,
              _originalId: channel.id,
              name: channel.name,
              type: 'channel',
              subtitle: channel.isPrivate ? 'Private channel' : 'Public channel',
            });
          }

          // Filter DMs (group conversations) from search results
          const dms = searchData.filter((item: any) => item.type === 'dm').slice(0, 3);
          for (const dm of dms) {
            const uniqueKey = `dm-${dm.id}`;
            if (seenIds.has(uniqueKey)) continue;
            if (dm.participants && dm.participants.length > 1) {
              seenIds.add(uniqueKey);
              const names = dm.participants
                .filter((p: any) => p.id !== currentUser?.id)
                .map((p: any) => p.name)
                .join(', ');
              results.push({
                id: uniqueKey,
                _originalId: dm.id,
                name: names,
                type: 'group_dm',
                participants: dm.participants,
                participantCount: dm.participants.length,
              });
            }
          }

          // Filter users from search results
          const users = searchData.filter((item: any) => item.type === 'user').slice(0, 5);
          for (const user of users) {
            if (user.id === currentUser?.id) continue;
            const uniqueKey = `user-${user.id}`;
            if (seenIds.has(uniqueKey)) continue;
            seenIds.add(uniqueKey);
            results.push({
              id: uniqueKey,
              _originalId: user.id,
              name: user.displayName || user.name || user.email,
              email: user.email,
              image: user.avatarUrl || user.image,
              type: 'user',
              status: user.status || 'offline',
              subtitle: user.email,
              title: user.title || user.role,
            });
          }

          // Filter orchestrators from search results
          const orchestrators = searchData.filter((item: any) => item.type === 'orchestrator').slice(0, 3);
          for (const orch of orchestrators) {
            const uniqueKey = `orchestrator-${orch.id}`;
            if (seenIds.has(uniqueKey)) continue;
            seenIds.add(uniqueKey);
            results.push({
              id: uniqueKey,
              _originalId: orch.id,
              name: orch.name,
              image: orch.avatarUrl,
              type: 'orchestrator',
              subtitle: 'Orchestrator',
            });
          }

          setSearchResults(results);
        }
      } catch (error) {
        console.error('Error loading initial suggestions:', error);
      }
    };

    loadInitialSuggestions();
  }, [workspaceSlug, currentUser?.id, recipients.length]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      if (recipients.length === 0 && showInitialSuggestions) {
        // Keep initial suggestions
        return;
      }
      setSearchResults([]);
      return;
    }

    setShowInitialSuggestions(false);

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/search?q=${encodeURIComponent(searchQuery)}&types=channels,dms,users,orchestrators`
        );

        if (response.ok) {
          const responseData = await response.json();
          const searchData = responseData.data || [];
          const results: SearchResult[] = [];
          const seenIds = new Set<string>(); // Track seen IDs to avoid duplicates

          // Filter channels that match from search results
          const channels = searchData.filter((item: any) => item.type === 'channel');
          for (const channel of channels) {
            const uniqueKey = `channel-${channel.id}`;
            if (seenIds.has(uniqueKey)) continue;
            seenIds.add(uniqueKey);
            results.push({
              id: uniqueKey,
              _originalId: channel.id,
              name: channel.name,
              type: 'channel',
              subtitle: channel.isPrivate ? 'Private channel' : 'Public channel',
            });
          }

          // Filter DMs (group conversations) that match from search results
          const dms = searchData.filter((item: any) => item.type === 'dm');
          for (const dm of dms) {
            const uniqueKey = `dm-${dm.id}`;
            if (seenIds.has(uniqueKey)) continue;
            const participants = dm.participants || [];
            if (participants.length > 1) {
              seenIds.add(uniqueKey);
              const names = participants
                .filter((p: any) => p.id !== currentUser?.id)
                .map((p: any) => p.name)
                .join(', ');
              results.push({
                id: uniqueKey,
                _originalId: dm.id,
                name: names,
                type: 'group_dm',
                participants: participants,
                participantCount: participants.length,
              });
            }
          }

          // Filter users from search results
          const users = searchData.filter((item: any) => item.type === 'user');
          for (const user of users) {
            if (user.id === currentUser?.id) continue;
            if (recipients.some((r) => r.id === user.id)) continue;
            const uniqueKey = `user-${user.id}`;
            if (seenIds.has(uniqueKey)) continue;
            seenIds.add(uniqueKey);

            results.push({
              id: uniqueKey,
              _originalId: user.id,
              name: user.displayName || user.name || user.email,
              email: user.email,
              image: user.avatarUrl || user.image,
              type: 'user',
              status: user.status || 'offline',
              subtitle: user.email,
              title: user.title || user.role,
              notificationStatus: user.notificationStatus,
            });
          }

          // Filter orchestrators from search results
          const orchestrators = searchData.filter((item: any) => item.type === 'orchestrator');
          for (const orch of orchestrators) {
            if (recipients.some((r) => r.id === orch.id)) continue;
            const uniqueKey = `orchestrator-${orch.id}`;
            if (seenIds.has(uniqueKey)) continue;
            seenIds.add(uniqueKey);

            results.push({
              id: uniqueKey,
              _originalId: orch.id,
              name: orch.name,
              image: orch.avatarUrl,
              type: 'orchestrator',
              subtitle: 'Orchestrator',
            });
          }

          // Check if query looks like an email
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (emailRegex.test(searchQuery) && !recipients.some((r) => r.email === searchQuery)) {
            results.push({
              id: `email-${searchQuery}`,
              _originalId: searchQuery,
              name: searchQuery,
              email: searchQuery,
              type: 'email',
              subtitle: 'Invite via email',
            });
          }

          setSearchResults(results);
          setHighlightedIndex(0);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, workspaceSlug, currentUser?.id, recipients, showInitialSuggestions]);

  // Handle result selection
  const handleSelectResult = useCallback(
    (result: SearchResult) => {
      // Use _originalId for navigation/data (id is the composite React key)
      const originalId = result._originalId;

      // If it's a channel or existing group DM, navigate directly
      if (result.type === 'channel') {
        router.push(`/${workspaceSlug}/channel/${originalId}`);
        return;
      }

      if (result.type === 'group_dm') {
        router.push(`/${workspaceSlug}/dm/${originalId}`);
        return;
      }

      // Add as recipient (use originalId for API calls)
      setRecipients((prev) => [
        ...prev,
        {
          id: originalId,
          name: result.name,
          email: result.email,
          image: result.image,
          type: result.type as 'user' | 'orchestrator' | 'email',
          status: result.status,
          title: result.title,
          notificationStatus: result.notificationStatus,
        },
      ]);
      setSearchQuery('');
      setSearchResults([]);
      setShowInitialSuggestions(false);
      inputRef.current?.focus();
    },
    [router, workspaceSlug]
  );

  // Handle recipient removal
  const handleRemoveRecipient = useCallback((recipientId: string) => {
    setRecipients((prev) => prev.filter((r) => r.id !== recipientId));
    inputRef.current?.focus();
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Backspace' && !searchQuery && recipients.length > 0) {
        setRecipients((prev) => prev.slice(0, -1));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, searchResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && searchResults.length > 0) {
        e.preventDefault();
        handleSelectResult(searchResults[highlightedIndex]);
      } else if (e.key === 'Escape') {
        setSearchQuery('');
        setSearchResults([]);
      }
    },
    [searchQuery, recipients.length, searchResults, highlightedIndex, handleSelectResult]
  );

  // Handle sending message
  const handleSendMessage = useCallback(
    async (content: string, mentions: string[], _attachments: File[]) => {
      if (recipients.length === 0 || !currentUser) return;

      try {
        const recipientIds = recipients.filter((r) => r.type !== 'email').map((r) => r.id);
        const emailInvites = recipients.filter((r) => r.type === 'email').map((r) => r.email!);

        const response = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceSlug,
            recipientIds,
            emailInvites,
            initialMessage: content,
            mentions,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const conversationId = data.id || data.channelId;
          router.push(`/${workspaceSlug}/dm/${conversationId}`);
        }
      } catch (error) {
        console.error('Error creating conversation:', error);
      }
    },
    [recipients, currentUser, workspaceSlug, router]
  );

  // Auto-save indicator
  useEffect(() => {
    if (recipients.length > 0 || searchQuery) {
      setLastSaved(new Date());
    }
  }, [recipients, searchQuery]);

  if (isAuthLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-muted-foreground">Please sign in to send messages.</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="flex h-12 items-center justify-between border-b px-4">
        <h1 className="font-semibold">New message</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {lastSaved && (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Saved a moment ago</span>
            </>
          )}
        </div>
      </div>

      {/* To: Field */}
      <div className="border-b px-4 py-2">
        <div
          className={cn(
            'flex flex-wrap items-center gap-2 rounded-md border bg-background px-3 py-2 transition-colors',
            isFocused && 'border-primary ring-1 ring-primary'
          )}
          onClick={() => inputRef.current?.focus()}
        >
          <span className="text-sm font-medium text-muted-foreground">To:</span>

          {/* Recipient chips */}
          {recipients.map((recipient) => (
            <RecipientChip
              key={recipient.id}
              recipient={recipient}
              onRemove={() => handleRemoveRecipient(recipient.id)}
            />
          ))}

          {/* Search input */}
          <div className="relative flex-1 min-w-[200px]">
            <Input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 200)}
              onKeyDown={handleKeyDown}
              placeholder={
                recipients.length === 0
                  ? '#a-channel, @somebody or somebody@example.com'
                  : ''
              }
              className="border-0 p-0 h-7 focus-visible:ring-0 shadow-none"
            />

            {/* Search dropdown */}
            {(searchResults.length > 0 || isSearching) && isFocused && (
              <div
                ref={resultsRef}
                className="absolute left-0 top-full mt-1 w-[450px] rounded-md border bg-popover shadow-lg z-50"
              >
                {isSearching ? (
                  <div className="flex items-center justify-center py-4">
                    <LoadingSpinner size="sm" />
                  </div>
                ) : (
                  <div className="max-h-[350px] overflow-y-auto py-1">
                    {searchResults.map((result, index) => (
                      <SearchResultItem
                        key={result.id}
                        result={result}
                        isHighlighted={index === highlightedIndex}
                        onSelect={() => handleSelectResult(result)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profile Card - Single recipient */}
      {recipients.length === 1 && (
        <SingleRecipientCard recipient={recipients[0]} workspaceSlug={workspaceSlug} />
      )}

      {/* Multi-participant intro */}
      {recipients.length > 1 && (
        <MultiRecipientIntro recipients={recipients} />
      )}

      {/* Empty state when no recipients */}
      {recipients.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Users className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>Add recipients to start a conversation</p>
          </div>
        </div>
      )}

      {/* Message input */}
      {recipients.length > 0 && (
        <div className="mt-auto">
          <MessageInput
            channelId="new"
            currentUser={currentUser}
            placeholder={`Message ${recipients.map((r) => r.name.split(' ')[0]).join(', ')}`}
            onSend={handleSendMessage}
          />
        </div>
      )}

      {/* Message input (disabled) when no recipients */}
      {recipients.length === 0 && (
        <div className="mt-auto">
          <MessageInput
            channelId="new"
            currentUser={currentUser}
            placeholder="Start a new message"
            onSend={handleSendMessage}
            disabled
          />
        </div>
      )}
    </div>
  );
}

/**
 * Recipient chip component
 */
function RecipientChip({
  recipient,
  onRemove,
}: {
  recipient: Recipient;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-accent px-2 py-1 text-sm">
      {recipient.type === 'user' && recipient.image ? (
        <Avatar className="h-4 w-4">
          <AvatarImage src={recipient.image} alt={recipient.name} />
          <AvatarFallback className="text-[10px]">
            {getInitials(recipient.name)}
          </AvatarFallback>
        </Avatar>
      ) : recipient.type === 'orchestrator' ? (
        <Bot className="h-3 w-3" />
      ) : (
        <Mail className="h-3 w-3" />
      )}
      <span className="max-w-[150px] truncate">{recipient.name}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="rounded-full p-0.5 hover:bg-background/50 transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

/**
 * Search result item component
 */
function SearchResultItem({
  result,
  isHighlighted,
  onSelect,
}: {
  result: SearchResult;
  isHighlighted: boolean;
  onSelect: () => void;
}) {
  const statusColors = {
    online: 'bg-green-500',
    away: 'bg-yellow-500',
    busy: 'bg-red-500',
    offline: 'bg-gray-400',
  };

  const renderIcon = () => {
    switch (result.type) {
      case 'channel':
        return (
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
            <Hash className="h-5 w-5 text-muted-foreground" />
          </div>
        );
      case 'group_dm':
        return (
          <div className="flex -space-x-2">
            {result.participants?.slice(0, 2).map((p, i) => (
              <Avatar key={p.id} className="h-7 w-7 border-2 border-popover" style={{ zIndex: 2 - i }}>
                <AvatarImage src={p.image || undefined} alt={p.name} />
                <AvatarFallback className="text-[10px]">{getInitials(p.name)}</AvatarFallback>
              </Avatar>
            ))}
            {(result.participantCount || 0) > 2 && (
              <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-popover bg-muted text-[10px] font-medium">
                {result.participantCount}
              </div>
            )}
          </div>
        );
      case 'orchestrator':
        return (
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
        );
      case 'email':
        return (
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-500/10">
            <Mail className="h-5 w-5 text-blue-500" />
          </div>
        );
      default:
        return (
          <div className="relative">
            <Avatar className="h-9 w-9">
              <AvatarImage src={result.image || undefined} alt={result.name} />
              <AvatarFallback>{getInitials(result.name)}</AvatarFallback>
            </Avatar>
            {result.status && (
              <span
                className={cn(
                  'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-popover',
                  statusColors[result.status]
                )}
              />
            )}
          </div>
        );
    }
  };

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
        isHighlighted ? 'bg-accent' : 'hover:bg-accent/50'
      )}
    >
      {renderIcon()}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{result.name}</span>
          {result.status === 'online' && (
            <span className="text-xs text-green-600">Active</span>
          )}
        </div>
        {result.subtitle && (
          <div className="text-sm text-muted-foreground truncate">{result.subtitle}</div>
        )}
      </div>
    </button>
  );
}

/**
 * Single recipient profile card (Slack-style)
 */
function SingleRecipientCard({
  recipient,
  workspaceSlug,
}: {
  recipient: Recipient;
  workspaceSlug: string;
}) {
  const router = useRouter();

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
      {/* Large avatar */}
      <Avatar className="h-32 w-32 mb-4">
        <AvatarImage src={recipient.image || undefined} alt={recipient.name} />
        <AvatarFallback className="text-4xl">{getInitials(recipient.name)}</AvatarFallback>
      </Avatar>

      {/* Name and status */}
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-xl font-semibold">{recipient.name}</h2>
        {recipient.status === 'online' && (
          <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
        )}
      </div>

      {/* Title/role */}
      {recipient.title && (
        <p className="text-muted-foreground mb-4">{recipient.title}</p>
      )}

      {/* Description */}
      <p className="text-center text-muted-foreground mb-4 max-w-md">
        This conversation is just between you and{' '}
        <button
          onClick={() => router.push(`/${workspaceSlug}/profile/${recipient.id}`)}
          className="text-primary hover:underline"
        >
          @{recipient.name}
        </button>
        . Take a look at their profile to learn more about them.
      </p>

      {/* View profile button */}
      <Button
        variant="secondary"
        onClick={() => router.push(`/${workspaceSlug}/profile/${recipient.id}`)}
      >
        View profile
      </Button>

      {/* Notification status */}
      {recipient.notificationStatus === 'paused' && (
        <div className="flex items-center gap-2 mt-6 text-sm text-muted-foreground">
          <BellOff className="h-4 w-4" />
          <span>{recipient.name} has paused their notifications</span>
        </div>
      )}
    </div>
  );
}

/**
 * Multi-recipient intro (Slack-style side-by-side avatars)
 */
function MultiRecipientIntro({
  recipients,
}: {
  recipients: Recipient[];
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
      {/* Side-by-side avatars (not stacked) */}
      <div className="flex gap-2 mb-6">
        {recipients.slice(0, 4).map((recipient) => (
          <Avatar key={recipient.id} className="h-16 w-16">
            <AvatarImage src={recipient.image || undefined} alt={recipient.name} />
            <AvatarFallback className="text-xl">{getInitials(recipient.name)}</AvatarFallback>
          </Avatar>
        ))}
        {recipients.length > 4 && (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-medium">
            +{recipients.length - 4}
          </div>
        )}
      </div>

      {/* Description with @mentions */}
      <p className="text-center text-muted-foreground mb-4 max-w-md">
        This is the very beginning of your direct message history with{' '}
        {recipients.map((r, i) => (
          <span key={r.id}>
            <span className="text-primary">@{r.name}</span>
            {i < recipients.length - 2 && ', '}
            {i === recipients.length - 2 && ' and '}
          </span>
        ))}
        .
      </p>

      {/* Notification info */}
      <p className="text-sm text-muted-foreground">
        You'll be notified for <span className="font-medium">every new message</span> in this
        conversation.{' '}
        <button className="text-primary hover:underline">Change this setting</button>
      </p>
    </div>
  );
}
