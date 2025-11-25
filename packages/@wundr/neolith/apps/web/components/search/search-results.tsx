'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Typed data for message search results
 */
export interface MessageResultData {
  messageId: string;
  content: string;
  channelId: string;
  channelName: string;
  senderName: string;
  sentAt: string;
}

/**
 * Typed data for file search results
 */
export interface FileResultData {
  fileId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  channelName: string;
  uploaderName: string;
  uploadedAt: string;
}

/**
 * Typed data for channel search results
 */
export interface ChannelResultData {
  channelId: string;
  name: string;
  description?: string;
  memberCount: number;
  isPrivate: boolean;
}

/**
 * Typed data for user search results
 */
export interface UserResultData {
  userId: string;
  name: string;
  email: string;
  role: string;
  discipline?: string;
  avatarUrl?: string;
}

/**
 * Typed data for VP (Virtual Person) search results
 */
export interface VPResultData {
  vpId: string;
  name: string;
  discipline: string;
  status: string;
  capabilities: string[];
}

/**
 * Union type for all search result data types
 */
export type SearchResultData =
  | MessageResultData
  | FileResultData
  | ChannelResultData
  | UserResultData
  | VPResultData;

/**
 * Search result type identifiers
 */
export type SearchResultType = 'message' | 'file' | 'channel' | 'user' | 'vp';

/**
 * Highlighted text fragments for search results
 */
export interface SearchHighlight {
  /** Highlighted content fragments */
  content?: string[];
  /** Highlighted title fragments */
  title?: string[];
  /** Highlighted file name fragments */
  fileName?: string[];
}

/**
 * Represents a single search result with typed data
 */
export interface SearchResult {
  /** Unique identifier for the search result */
  id: string;
  /** Type of the search result */
  type: SearchResultType;
  /** Relevance score from the search engine */
  score: number;
  /** Highlighted text fragments matching the search query */
  highlight?: SearchHighlight;
  /** Type-specific data for the search result */
  data: SearchResultData;
}

/**
 * Filter options for search results
 */
export interface SearchFilters {
  /** Filter by result types */
  types?: SearchResultType[];
  /** Filter by specific channel IDs */
  channelIds?: string[];
  /** Filter by date range */
  dateRange?: {
    /** Start date in ISO format */
    start: string;
    /** End date in ISO format */
    end: string;
  };
}

/**
 * Props for the SearchResults component
 */
export interface SearchResultsProps {
  /** The workspace ID to search within */
  workspaceId: string;
  /** The search query string */
  query: string;
  /** Optional filters to narrow search results */
  filters?: SearchFilters;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Props for individual search result renderers
 */
interface ResultRendererProps {
  /** The search result to render */
  result: SearchResult;
  /** The workspace ID for constructing URLs */
  workspaceId: string;
}

function MessageResult({ result, workspaceId }: ResultRendererProps) {
  const data = result.data as MessageResultData;

  return (
    <Link
      href={`/${workspaceId}/channel/${data.channelId}?message=${data.messageId}`}
      className={cn(
        'block p-4 rounded-lg',
        'hover:bg-accent transition-colors',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium font-heading">
          {data.senderName?.charAt(0) || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground font-sans">{data.senderName}</span>
            <span className="text-xs text-muted-foreground font-sans">in #{data.channelName}</span>
            <span className="text-xs text-muted-foreground font-sans">
              {new Date(data.sentAt).toLocaleDateString()}
            </span>
          </div>
          <p
            className="text-sm text-muted-foreground mt-1 line-clamp-2 font-sans"
            dangerouslySetInnerHTML={{
              __html: result.highlight?.content?.[0] || data.content,
            }}
          />
        </div>
      </div>
    </Link>
  );
}

function FileResult({ result, workspaceId }: ResultRendererProps) {
  const data = result.data as FileResultData;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) {
return `${bytes} B`;
}
    if (bytes < 1024 * 1024) {
return `${(bytes / 1024).toFixed(1)} KB`;
}
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <a
      href={`/api/workspaces/${workspaceId}/files/${data.fileId}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-center gap-4 p-4 rounded-lg',
        'hover:bg-accent transition-colors',
      )}
    >
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-5 h-5 text-primary"
        >
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate font-sans">{data.fileName}</p>
        <p className="text-xs text-muted-foreground font-sans">
          {formatSize(data.fileSize)} - Uploaded by {data.uploaderName} in #{data.channelName}
        </p>
      </div>
    </a>
  );
}

function ChannelResult({ result, workspaceId }: ResultRendererProps) {
  const data = result.data as ChannelResultData;

  return (
    <Link
      href={`/${workspaceId}/channel/${data.channelId}`}
      className={cn(
        'flex items-center gap-4 p-4 rounded-lg',
        'hover:bg-accent transition-colors',
      )}
    >
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <span className="text-primary font-medium font-heading">#</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground font-heading">{data.name}</span>
          {data.isPrivate && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-3 h-3 text-muted-foreground"
            >
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          )}
        </div>
        {data.description && (
          <p className="text-sm text-muted-foreground truncate font-sans">{data.description}</p>
        )}
        <p className="text-xs text-muted-foreground font-sans">{data.memberCount} members</p>
      </div>
    </Link>
  );
}

function UserResult({ result, workspaceId }: ResultRendererProps) {
  const data = result.data as UserResultData;

  return (
    <Link
      href={`/${workspaceId}/dm/${data.userId}`}
      className={cn(
        'flex items-center gap-4 p-4 rounded-lg',
        'hover:bg-accent transition-colors',
      )}
    >
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
        {data.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.avatarUrl} alt={data.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-primary font-medium font-heading">{data.name?.charAt(0) || '?'}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground font-sans">{data.name}</p>
        <p className="text-sm text-muted-foreground font-sans">{data.email}</p>
        <p className="text-xs text-muted-foreground font-sans">
          {data.role}{data.discipline && ` - ${data.discipline}`}
        </p>
      </div>
    </Link>
  );
}

function VPResult({ result, workspaceId }: ResultRendererProps) {
  const data = result.data as VPResultData;

  return (
    <Link
      href={`/${workspaceId}/vp/${data.vpId}`}
      className={cn(
        'flex items-center gap-4 p-4 rounded-lg',
        'hover:bg-accent transition-colors',
      )}
    >
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-5 h-5 text-primary-foreground"
        >
          <path d="M12 8V4H8" />
          <rect width="16" height="12" x="4" y="8" rx="2" />
          <path d="M2 14h2" />
          <path d="M20 14h2" />
          <path d="M15 13v2" />
          <path d="M9 13v2" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground font-heading">{data.name}</span>
          <span
            className={cn(
              'px-1.5 py-0.5 text-xs rounded font-sans',
              data.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400',
            )}
          >
            {data.status}
          </span>
        </div>
        <p className="text-sm text-muted-foreground font-sans">{data.discipline}</p>
        <p className="text-xs text-muted-foreground truncate font-sans">
          {data.capabilities?.slice(0, 3).join(' - ')}
        </p>
      </div>
    </Link>
  );
}

export function SearchResults({
  workspaceId,
  query,
  filters,
  className,
}: SearchResultsProps) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const fetchResults = useCallback(async () => {
    if (!query.trim()) {
      setResults([]);
      setTotal(0);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        q: query,
        limit: String(pageSize),
        offset: String(page * pageSize),
      });

      if (filters?.types?.length) {
        params.set('types', filters.types.join(','));
      }
      if (filters?.channelIds?.length) {
        params.set('channels', filters.channelIds.join(','));
      }
      if (filters?.dateRange) {
        params.set('from', filters.dateRange.start);
        params.set('to', filters.dateRange.end);
      }

      const response = await fetch(
        `/api/workspaces/${workspaceId}/search?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setResults(data.results || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, query, filters, page]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <div className="w-8 h-8 border-4 border-stone-200 dark:border-stone-800 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('text-center py-12', className)}>
        <p className="text-destructive font-sans">{error}</p>
        <Button onClick={fetchResults} className="mt-4 font-sans">
          Try again
        </Button>
      </div>
    );
  }

  if (results.length === 0 && query.trim()) {
    return (
      <div className={cn('text-center py-12', className)}>
        <p className="text-muted-foreground font-sans">No results found for &quot;{query}&quot;</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Results count */}
      {total > 0 && (
        <p className="text-sm text-muted-foreground mb-4">
          {total} result{total !== 1 ? 's' : ''} for &quot;{query}&quot;
        </p>
      )}

      {/* Results list */}
      <div className="space-y-2">
        {results.map((result) => {
          switch (result.type) {
            case 'message':
              return <MessageResult key={result.id} result={result} workspaceId={workspaceId} />;
            case 'file':
              return <FileResult key={result.id} result={result} workspaceId={workspaceId} />;
            case 'channel':
              return <ChannelResult key={result.id} result={result} workspaceId={workspaceId} />;
            case 'user':
              return <UserResult key={result.id} result={result} workspaceId={workspaceId} />;
            case 'vp':
              return <VPResult key={result.id} result={result} workspaceId={workspaceId} />;
            default:
              return null;
          }
        })}
      </div>

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="font-sans"
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground font-sans">
            Page {page + 1} of {Math.ceil(total / pageSize)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={(page + 1) * pageSize >= total}
            className="font-sans"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

export default SearchResults;
