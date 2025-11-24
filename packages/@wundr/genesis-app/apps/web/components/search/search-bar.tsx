'use client';

import { clsx } from 'clsx';
import { useRouter } from 'next/navigation';
import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Props for the SearchBar component
 */
export interface SearchBarProps {
  /** The workspace ID to search within */
  workspaceId: string;
  /** Placeholder text for the search input */
  placeholder?: string;
  /** Optional CSS class name */
  className?: string;
  /** Callback when search is submitted (if not provided, navigates to search page) */
  onSearch?: (query: string) => void;
  /** Whether to auto-focus the search input */
  autoFocus?: boolean;
}

export function SearchBar({
  workspaceId,
  placeholder = 'Search messages, files, and more...',
  className,
  onSearch,
  autoFocus = false,
}: SearchBarProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ text: string; type: string }>>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Fetch suggestions
  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoadingSuggestions(true);
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/search/suggestions?q=${encodeURIComponent(query)}`,
        );
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.suggestions || []);
        }
      } catch {
        // Ignore errors
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, workspaceId]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        if (onSearch) {
          onSearch(query);
        } else {
          router.push(`/${workspaceId}/search?q=${encodeURIComponent(query)}`);
        }
      }
    },
    [query, onSearch, router, workspaceId],
  );

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      setQuery(suggestion);
      if (onSearch) {
        onSearch(suggestion);
      } else {
        router.push(`/${workspaceId}/search?q=${encodeURIComponent(suggestion)}`);
      }
      setSuggestions([]);
    },
    [onSearch, router, workspaceId],
  );

  // Keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={clsx('relative', className)}>
      <form onSubmit={handleSubmit}>
        <div
          className={clsx(
            'relative flex items-center',
            'bg-muted rounded-lg',
            'border-2 transition-colors',
            isFocused ? 'border-primary' : 'border-transparent',
          )}
        >
          {/* Search icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4 ml-3 text-muted-foreground"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className={clsx(
              'flex-1 px-3 py-2',
              'bg-transparent',
              'text-foreground placeholder:text-muted-foreground',
              'focus:outline-none',
            )}
          />

          {/* Keyboard shortcut hint */}
          <div
            className={clsx(
              'hidden md:flex items-center gap-1 mr-3',
              'text-xs text-muted-foreground',
            )}
          >
            <kbd className="px-1.5 py-0.5 bg-background rounded border border-border font-mono">
              Cmd
            </kbd>
            <kbd className="px-1.5 py-0.5 bg-background rounded border border-border font-mono">
              K
            </kbd>
          </div>
        </div>
      </form>

      {/* Suggestions dropdown */}
      {isFocused && (suggestions.length > 0 || isLoadingSuggestions) && (
        <div
          className={clsx(
            'absolute top-full left-0 right-0 mt-1 z-50',
            'bg-card border border-border rounded-lg shadow-lg',
            'max-h-64 overflow-auto',
          )}
        >
          {isLoadingSuggestions ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Searching...
            </div>
          ) : (
            suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion.text)}
                className={clsx(
                  'w-full px-4 py-2 text-left',
                  'flex items-center gap-3',
                  'hover:bg-muted transition-colors',
                )}
              >
                <span className="text-xs text-muted-foreground uppercase">
                  {suggestion.type}
                </span>
                <span className="text-foreground">{suggestion.text}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default SearchBar;
