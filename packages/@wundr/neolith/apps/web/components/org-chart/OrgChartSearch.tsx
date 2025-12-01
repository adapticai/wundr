'use client';

import { Search, X } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface OrgChartSearchProps {
  value: string;
  onChange: (value: string) => void;
  matchCount?: number;
  className?: string;
}

export function OrgChartSearch({
  value,
  onChange,
  matchCount,
  className,
}: OrgChartSearchProps) {
  return (
    <div className={cn('relative flex items-center', className)}>
      <Search className='absolute left-3 h-4 w-4 text-stone-400' />
      <Input
        type='text'
        placeholder='Search by name, discipline, or status...'
        value={value}
        onChange={e => onChange(e.target.value)}
        className='pl-9 pr-20 bg-stone-900 border-stone-800 text-stone-100 placeholder:text-stone-500'
        aria-label='Search organization chart'
      />
      {value && (
        <div className='absolute right-3 flex items-center gap-2'>
          {matchCount !== undefined && (
            <span className='text-xs text-stone-400' aria-live='polite'>
              {matchCount} match{matchCount !== 1 ? 'es' : ''}
            </span>
          )}
          <button
            type='button'
            onClick={() => onChange('')}
            className='text-stone-400 hover:text-stone-100 transition-colors'
            aria-label='Clear search'
          >
            <X className='h-4 w-4' />
          </button>
        </div>
      )}
    </div>
  );
}
