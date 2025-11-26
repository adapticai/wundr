/**
 * Empty Search Component
 * @module components/empty-states/empty-search
 */
'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

interface EmptySearchProps {
  query?: string;
  onClearSearch?: () => void;
}

export function EmptySearch({ query, onClearSearch }: EmptySearchProps) {
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description={
        query
          ? `No results found for "${query}". Try adjusting your search terms.`
          : 'No results found. Try a different search query.'
      }
      action={
        onClearSearch
          ? {
              label: 'Clear Search',
              onClick: onClearSearch,
              variant: 'outline',
            }
          : undefined
      }
    />
  );
}
