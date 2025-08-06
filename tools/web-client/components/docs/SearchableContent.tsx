'use client';

import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, X, Filter, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  title: string;
  content: string;
  section?: string;
  url: string;
  type: 'heading' | 'paragraph' | 'code' | 'list';
  score: number;
  highlights: string[];
}

interface SearchableContentProps {
  content: string;
  onNavigate?: (sectionId: string) => void;
  className?: string;
}

export function SearchableContent({ content, onNavigate, className }: SearchableContentProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);

  // Parse content into searchable segments
  const searchableSegments = useMemo(() => {
    const segments: SearchResult[] = [];
    const lines = content.split('\n');
    let currentSection = '';
    let segmentId = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Detect headings
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const title = headingMatch[2];
        if (level <= 2) {
          currentSection = title;
        }
        
        segments.push({
          id: `heading-${segmentId++}`,
          title,
          content: title,
          section: currentSection,
          url: `#${title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')}`,
          type: 'heading',
          score: 0,
          highlights: []
        });
        continue;
      }

      // Detect code blocks
      if (line.startsWith('```')) {
        const codeLines = [];
        i++; // Skip opening ```
        while (i < lines.length && !lines[i].startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        
        const codeContent = codeLines.join('\n');
        if (codeContent.trim()) {
          segments.push({
            id: `code-${segmentId++}`,
            title: 'Code Block',
            content: codeContent,
            section: currentSection,
            url: `#code-${segmentId}`,
            type: 'code',
            score: 0,
            highlights: []
          });
        }
        continue;
      }

      // Detect list items
      const listMatch = line.match(/^[\s]*[-*+]\s+(.+)$/);
      if (listMatch) {
        segments.push({
          id: `list-${segmentId++}`,
          title: 'List Item',
          content: listMatch[1],
          section: currentSection,
          url: `#list-${segmentId}`,
          type: 'list',
          score: 0,
          highlights: []
        });
        continue;
      }

      // Regular paragraphs
      if (line.trim() && !line.startsWith('#') && !line.startsWith('```')) {
        segments.push({
          id: `paragraph-${segmentId++}`,
          title: 'Paragraph',
          content: line,
          section: currentSection,
          url: `#paragraph-${segmentId}`,
          type: 'paragraph',
          score: 0,
          highlights: []
        });
      }
    }

    return segments;
  }, [content]);

  // Search functionality
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase();
    const results = searchableSegments
      .map(segment => {
        const contentLower = segment.content.toLowerCase();
        const titleLower = segment.title.toLowerCase();
        const sectionLower = segment.section?.toLowerCase() || '';

        let score = 0;
        const highlights: string[] = [];

        // Title matches (highest priority)
        if (titleLower.includes(query)) {
          score += 10;
          highlights.push(`Title: "${segment.title}"`);
        }

        // Section matches
        if (sectionLower.includes(query)) {
          score += 5;
          highlights.push(`Section: "${segment.section}"`);
        }

        // Content matches
        if (contentLower.includes(query)) {
          score += 1;
          
          // Extract surrounding context
          const index = contentLower.indexOf(query);
          const start = Math.max(0, index - 30);
          const end = Math.min(segment.content.length, index + query.length + 30);
          const context = segment.content.substring(start, end);
          highlights.push(`"...${context}..."`);
        }

        return {
          ...segment,
          score,
          highlights
        };
      })
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20); // Limit results

    return results;
  }, [searchQuery, searchableSegments]);

  // Filter by content type
  const filteredResults = useMemo(() => {
    if (selectedFilters.length === 0) return searchResults;
    return searchResults.filter(result => selectedFilters.includes(result.type));
  }, [searchResults, selectedFilters]);

  const availableFilters = useMemo(() => {
    return [
      { key: 'heading', label: 'Headings', count: searchResults.filter(r => r.type === 'heading').length },
      { key: 'paragraph', label: 'Content', count: searchResults.filter(r => r.type === 'paragraph').length },
      { key: 'code', label: 'Code', count: searchResults.filter(r => r.type === 'code').length },
      { key: 'list', label: 'Lists', count: searchResults.filter(r => r.type === 'list').length }
    ].filter(filter => filter.count > 0);
  }, [searchResults]);

  const handleFilterToggle = (filterKey: string) => {
    setSelectedFilters(prev =>
      prev.includes(filterKey)
        ? prev.filter(f => f !== filterKey)
        : [...prev, filterKey]
    );
  };

  const handleResultClick = (result: SearchResult) => {
    if (onNavigate) {
      onNavigate(result.url.replace('#', ''));
    }
    setIsSearchActive(false);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'heading': return '📋';
      case 'code': return '💻';
      case 'list': return '📝';
      default: return '📄';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'heading': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'code': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'list': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search Input */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search in this document..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearchActive(!!e.target.value.trim());
            }}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setIsSearchActive(false);
              }}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Search Results */}
      {isSearchActive && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">
                Search Results ({filteredResults.length})
              </CardTitle>
              
              {/* Filters */}
              {availableFilters.length > 0 && (
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <div className="flex gap-1">
                    {availableFilters.map(filter => (
                      <Button
                        key={filter.key}
                        variant={selectedFilters.includes(filter.key) ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleFilterToggle(filter.key)}
                        className="h-6 text-xs"
                      >
                        {filter.label} ({filter.count})
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {filteredResults.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No results found for &quot;{searchQuery}&quot;
              </p>
            ) : (
              filteredResults.map(result => (
                <div
                  key={result.id}
                  onClick={() => handleResultClick(result)}
                  className="p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">{getTypeIcon(result.type)}</span>
                        <Badge variant="secondary" className={cn('text-xs', getTypeColor(result.type))}>
                          {result.type}
                        </Badge>
                        {result.section && (
                          <span className="text-xs text-muted-foreground">
                            in {result.section}
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-1">
                        {result.highlights.map((highlight, index) => (
                          <p key={index} className="text-sm text-muted-foreground line-clamp-2">
                            {highlight.replace(/"/g, '&quot;')}
                          </p>
                        ))}
                      </div>
                    </div>
                    
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SearchableContent;