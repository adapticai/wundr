'use client';

import * as React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { 
  Search, 
  Filter, 
  X, 
  Clock, 
  FileText, 
  Tag, 
  ChevronRight,
  Sparkles,
  TrendingUp
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { DocPage, searchDocs, SearchResult, docCategories } from '@/lib/docs-utils';

interface AdvancedSearchProps {
  pages: DocPage[];
  onResultSelect?: (page: DocPage, snippet?: string) => void;
  className?: string;
}

export function AdvancedSearch({ pages, onResultSelect, className = '' }: AdvancedSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Get all available tags
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    pages.forEach(page => {
      page.tags?.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [pages]);

  // Filter pages based on selected filters
  const filteredPages = useMemo(() => {
    return pages.filter(page => {
      const categoryMatch = selectedCategories.length === 0 || 
        selectedCategories.includes(page.category);
      
      const tagMatch = selectedTags.length === 0 || 
        selectedTags.some(tag => page.tags?.includes(tag));
      
      return categoryMatch && tagMatch;
    });
  }, [pages, selectedCategories, selectedTags]);

  // Perform search
  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    
    const results = searchDocs(query, filteredPages);
    return results;
  }, [query, filteredPages]);

  const handleSearch = useCallback((searchQuery: string) => {
    setQuery(searchQuery);
    setIsOpen(searchQuery.length > 0);
    
    // Add to recent searches if not empty and not already present
    if (searchQuery.trim() && !recentSearches.includes(searchQuery)) {
      setRecentSearches(prev => [searchQuery, ...prev.slice(0, 4)]);
    }
  }, [recentSearches]);

  const handleResultClick = useCallback((result: SearchResult, snippet?: string) => {
    onResultSelect?.(result.page, snippet);
    setIsOpen(false);
    setQuery('');
  }, [onResultSelect]);

  const toggleCategory = useCallback((category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedCategories([]);
    setSelectedTags([]);
  }, []);

  const hasFilters = selectedCategories.length > 0 || selectedTags.length > 0;

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search documentation... (try 'error handling' or 'TypeScript')"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => setIsOpen(query.length > 0 || recentSearches.length > 0)}
          className="pl-10 pr-24"
        />
        
        {/* Filters Button */}
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className={`h-7 px-2 ${hasFilters ? 'text-primary' : ''}`}
              >
                <Filter className="h-3 w-3" />
                {hasFilters && (
                  <Badge variant="secondary" className="ml-1 h-4 w-4 p-0 text-xs">
                    {selectedCategories.length + selectedTags.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="flex items-center justify-between">
                Filters
                {hasFilters && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearFilters}
                    className="h-auto p-0 text-xs"
                  >
                    Clear
                  </Button>
                )}
              </DropdownMenuLabel>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Categories
              </DropdownMenuLabel>
              {docCategories.map(category => (
                <DropdownMenuCheckboxItem
                  key={category.value}
                  checked={selectedCategories.includes(category.value)}
                  onCheckedChange={() => toggleCategory(category.value)}
                >
                  {category.label}
                </DropdownMenuCheckboxItem>
              ))}
              
              <DropdownMenuSeparator />
              
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Tags
              </DropdownMenuLabel>
              {allTags.slice(0, 10).map(tag => (
                <DropdownMenuCheckboxItem
                  key={tag}
                  checked={selectedTags.includes(tag)}
                  onCheckedChange={() => toggleTag(tag)}
                >
                  {tag}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Active Filters */}
      {hasFilters && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedCategories.map(category => {
            const cat = docCategories.find(c => c.value === category);
            return (
              <Badge 
                key={category} 
                variant="secondary" 
                className="text-xs"
              >
                {cat?.label}
                <button 
                  onClick={() => toggleCategory(category)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
          
          {selectedTags.map(tag => (
            <Badge 
              key={tag} 
              variant="outline" 
              className="text-xs"
            >
              <Tag className="h-3 w-3 mr-1" />
              {tag}
              <button 
                onClick={() => toggleTag(tag)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Search Results Dropdown */}
      {isOpen && (
        <Card className="absolute top-full left-0 right-0 mt-2 z-50 shadow-lg max-h-96 overflow-y-auto">
          <CardContent className="p-0">
            {/* Recent Searches */}
            {!query && recentSearches.length > 0 && (
              <div className="p-3 border-b">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Clock className="h-4 w-4" />
                  Recent searches
                </div>
                <div className="space-y-1">
                  {recentSearches.map((search, index) => (
                    <button
                      key={index}
                      onClick={() => handleSearch(search)}
                      className="block w-full text-left px-2 py-1 text-sm hover:bg-muted rounded"
                    >
                      {search}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search Results */}
            {query && searchResults.length > 0 && (
              <div className="p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <Sparkles className="h-4 w-4" />
                  Search results ({searchResults.length})
                </div>
                
                <div className="space-y-3">
                  {searchResults.map((result, index) => (
                    <SearchResultItem
                      key={result.page.id}
                      result={result}
                      onClick={handleResultClick}
                      rank={index + 1}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* No Results */}
            {query && searchResults.length === 0 && (
              <div className="p-6 text-center text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No results found for "{query}"</p>
                <p className="text-xs mt-1">Try different keywords or check your filters</p>
              </div>
            )}

            {/* Close Button */}
            <div className="sticky bottom-0 bg-background/80 backdrop-blur-sm border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="w-full text-xs"
              >
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface SearchResultItemProps {
  result: SearchResult;
  onClick: (result: SearchResult, snippet?: string) => void;
  rank: number;
}

function SearchResultItem({ result, onClick, rank }: SearchResultItemProps) {
  const { page, matchType, relevanceScore } = result;
  
  // Create a simple match representation
  const primaryMatch = { field: matchType, content: page.title, snippet: page.description?.substring(0, 150) + '...' || '' };

  return (
    <button
      onClick={() => onClick(result, primaryMatch?.snippet)}
      className="block w-full text-left p-3 hover:bg-muted rounded-lg transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary mt-0.5">
          {rank}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-sm truncate" 
                dangerouslySetInnerHTML={{ __html: page.title }} 
            />
            <Badge variant="outline" className="text-xs flex-shrink-0">
              {page.category}
            </Badge>
            {relevanceScore > 50 && (
              <TrendingUp className="h-3 w-3 text-green-500 flex-shrink-0" />
            )}
          </div>
          
          <p className="text-xs text-muted-foreground mb-2 line-clamp-2" 
             dangerouslySetInnerHTML={{ 
               __html: page.description || '' 
             }} 
          />
          
          {primaryMatch && primaryMatch.field === 'content' && (
            <div className="text-xs bg-muted/50 p-2 rounded mt-2">
              <span dangerouslySetInnerHTML={{ __html: primaryMatch.snippet }} />
            </div>
          )}
          
          <div className="flex items-center gap-2 mt-2">
            {page.tags?.slice(0, 3)?.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            
            <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto" />
          </div>
        </div>
      </div>
    </button>
  );
}