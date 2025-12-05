'use client';

import { X, ChevronUp, ChevronDown, Search } from 'lucide-react';
import { useState, useCallback, useEffect, useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import type { Message } from '@/types/chat';

interface DMSearchPanelProps {
  /** Whether the search panel is open */
  isOpen: boolean;
  /** All messages to search through */
  messages: Message[];
  /** Callback to close the panel */
  onClose: () => void;
  /** Callback to scroll to a specific message */
  onScrollToMessage: (messageId: string) => void;
  /** Additional CSS classes */
  className?: string;
}

interface SearchResult {
  message: Message;
  snippet: string;
  matchIndex: number;
}

/**
 * DM Search Panel Component
 *
 * Provides an in-conversation search interface with:
 * - Real-time search filtering
 * - Result count and navigation
 * - Keyboard shortcuts (Cmd+F to open, Escape to close, Enter to navigate)
 * - Highlighted search results in the conversation
 */
export function DMSearchPanel({
  isOpen,
  messages,
  onClose,
  onScrollToMessage,
  className,
}: DMSearchPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentResultIndex, setCurrentResultIndex] = useState(0);

  // Search results with snippets
  const searchResults = useMemo<SearchResult[]>(() => {
    if (!searchQuery.trim()) {
      return [];
    }

    const query = searchQuery.toLowerCase();
    return messages
      .filter(msg => {
        // Search in message content
        if (msg.content.toLowerCase().includes(query)) {
          return true;
        }
        // Search in author name
        if (msg.author?.name?.toLowerCase().includes(query)) {
          return true;
        }
        // Search in attachments
        if (
          msg.attachments?.some(att => att.name.toLowerCase().includes(query))
        ) {
          return true;
        }
        return false;
      })
      .map((msg, index) => {
        // Get snippet context
        const contentLower = msg.content.toLowerCase();
        const queryIndex = contentLower.indexOf(query);
        let snippet = msg.content;
        if (queryIndex !== -1 && msg.content.length > 100) {
          const start = Math.max(0, queryIndex - 40);
          const end = Math.min(msg.content.length, queryIndex + query.length + 40);
          snippet =
            (start > 0 ? '...' : '') +
            msg.content.slice(start, end) +
            (end < msg.content.length ? '...' : '');
        }
        return {
          message: msg,
          snippet: snippet.slice(0, 150),
          matchIndex: index,
        };
      });
  }, [messages, searchQuery]);

  const totalResults = searchResults.length;
  const hasResults = totalResults > 0;
  const currentResult = hasResults ? searchResults[currentResultIndex] : null;

  // Reset current index when search query changes
  useEffect(() => {
    setCurrentResultIndex(0);
  }, [searchQuery]);

  // Navigate to previous result
  const handlePrevious = useCallback(() => {
    if (!hasResults) {
return;
}
    const newIndex = currentResultIndex === 0
      ? totalResults - 1
      : currentResultIndex - 1;
    setCurrentResultIndex(newIndex);
    onScrollToMessage(searchResults[newIndex].message.id);
  }, [currentResultIndex, hasResults, onScrollToMessage, searchResults, totalResults]);

  // Navigate to next result
  const handleNext = useCallback(() => {
    if (!hasResults) {
return;
}
    const newIndex = currentResultIndex === totalResults - 1
      ? 0
      : currentResultIndex + 1;
    setCurrentResultIndex(newIndex);
    onScrollToMessage(searchResults[newIndex].message.id);
  }, [currentResultIndex, hasResults, onScrollToMessage, searchResults, totalResults]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) {
return;
}

    const handleKeyDown = (e: KeyboardEvent) => {
      // Close on Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Navigate with Enter (next) and Shift+Enter (previous)
      if (e.key === 'Enter' && hasResults) {
        e.preventDefault();
        if (e.shiftKey) {
          handlePrevious();
        } else {
          handleNext();
        }
        return;
      }

      // Navigate with arrow keys
      if (e.key === 'ArrowUp' && hasResults) {
        e.preventDefault();
        handlePrevious();
        return;
      }

      if (e.key === 'ArrowDown' && hasResults) {
        e.preventDefault();
        handleNext();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, hasResults, handleNext, handlePrevious]);

  // Add global keyboard shortcut for Cmd+F
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Cmd+F or Ctrl+F to open search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        if (!isOpen) {
          // Parent component should handle opening
          // This is just to prevent browser's default search
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen]);

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 border-b bg-background px-4 py-2',
        className,
      )}
    >
      {/* Search icon */}
      <Search className='h-4 w-4 text-muted-foreground shrink-0' />

      {/* Search input */}
      <div className='flex-1 max-w-md'>
        <Input
          type='text'
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder='Search messages...'
          autoFocus
          className='h-8 text-sm'
        />
      </div>

      {/* Results count and navigation */}
      {searchQuery.trim() && (
        <div className='flex items-center gap-2 shrink-0'>
          {/* Results badge */}
          <Badge variant='secondary' className='font-mono text-xs'>
            {hasResults
              ? `${currentResultIndex + 1} / ${totalResults}`
              : '0 results'}
          </Badge>

          {/* Navigation buttons */}
          <div className='flex items-center gap-0.5'>
            <Button
              variant='ghost'
              size='icon'
              className='h-7 w-7'
              onClick={handlePrevious}
              disabled={!hasResults}
              title='Previous result (Shift+Enter or ↑)'
            >
              <ChevronUp className='h-4 w-4' />
            </Button>
            <Button
              variant='ghost'
              size='icon'
              className='h-7 w-7'
              onClick={handleNext}
              disabled={!hasResults}
              title='Next result (Enter or ↓)'
            >
              <ChevronDown className='h-4 w-4' />
            </Button>
          </div>
        </div>
      )}

      {/* Close button */}
      <Button
        variant='ghost'
        size='icon'
        className='h-7 w-7 shrink-0'
        onClick={onClose}
        title='Close search (Escape)'
      >
        <X className='h-4 w-4' />
      </Button>

      {/* Keyboard shortcuts hint */}
      {!searchQuery.trim() && (
        <div className='hidden md:flex items-center gap-2 text-xs text-muted-foreground ml-auto'>
          <span>Press</span>
          <kbd className='px-1.5 py-0.5 bg-muted rounded border text-xs'>Esc</kbd>
          <span>to close</span>
        </div>
      )}
    </div>
  );
}

/**
 * Hook to highlight search results in message content
 * Use this in the MessageItem component to highlight matching text
 */
export function useSearchHighlight(
  content: string,
  searchQuery: string,
): React.ReactNode {
  return useMemo(() => {
    if (!searchQuery.trim()) {
      return content;
    }

    const query = searchQuery.toLowerCase();
    const contentLower = content.toLowerCase();
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let matchIndex = contentLower.indexOf(query);
    let key = 0;

    while (matchIndex !== -1) {
      // Add text before match
      if (matchIndex > lastIndex) {
        parts.push(
          <span key={key++}>{content.slice(lastIndex, matchIndex)}</span>,
        );
      }

      // Add highlighted match
      parts.push(
        <mark
          key={key++}
          className='bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-100 rounded px-0.5'
        >
          {content.slice(matchIndex, matchIndex + query.length)}
        </mark>,
      );

      lastIndex = matchIndex + query.length;
      matchIndex = contentLower.indexOf(query, lastIndex);
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(<span key={key++}>{content.slice(lastIndex)}</span>);
    }

    return <>{parts}</>;
  }, [content, searchQuery]);
}
