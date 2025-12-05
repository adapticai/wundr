'use client';

import { clsx } from 'clsx';
import { useState, useRef, useEffect } from 'react';

import { useToast } from '@/hooks/use-toast';

export interface DateRangePickerProps {
  from?: Date;
  to?: Date;
  onSelect: (range: { from?: Date; to?: Date }) => void;
  className?: string;
}

export function DateRangePicker({
  from,
  to,
  onSelect,
  className,
}: DateRangePickerProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [fromInput, setFromInput] = useState(from ? formatDate(from) : '');
  const [toInput, setToInput] = useState(to ? formatDate(to) : '');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleApply = () => {
    const fromDate = fromInput ? new Date(fromInput) : undefined;
    const toDate = toInput ? new Date(toInput) : undefined;

    if (fromDate && isNaN(fromDate.getTime())) {
      toast({
        variant: 'destructive',
        title: 'Invalid Date',
        description: 'Please enter a valid "from" date.',
      });
      return;
    }

    if (toDate && isNaN(toDate.getTime())) {
      toast({
        variant: 'destructive',
        title: 'Invalid Date',
        description: 'Please enter a valid "to" date.',
      });
      return;
    }

    if (fromDate && toDate && fromDate > toDate) {
      toast({
        variant: 'destructive',
        title: 'Invalid Date Range',
        description: 'Start date must be before end date.',
      });
      return;
    }

    onSelect({ from: fromDate, to: toDate });
    setIsOpen(false);
  };

  const handleClear = () => {
    setFromInput('');
    setToInput('');
    onSelect({});
    setIsOpen(false);
  };

  const displayText =
    from || to
      ? `${from ? formatDisplayDate(from) : '...'} - ${to ? formatDisplayDate(to) : '...'}`
      : 'Custom range';

  return (
    <div className={clsx('relative', className)} ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
          'bg-muted text-muted-foreground hover:bg-muted/80',
          (from || to) && 'bg-primary/10 text-primary',
        )}
      >
        <CalendarIcon />
        {displayText}
      </button>

      {isOpen && (
        <div className='absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-lg shadow-lg p-4 z-50'>
          <div className='space-y-4'>
            <div>
              <label className='block text-sm font-medium text-foreground mb-1'>
                From
              </label>
              <input
                type='date'
                value={fromInput}
                onChange={e => setFromInput(e.target.value)}
                className='w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-foreground mb-1'>
                To
              </label>
              <input
                type='date'
                value={toInput}
                onChange={e => setToInput(e.target.value)}
                className='w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary'
              />
            </div>

            <div className='flex gap-2 pt-2'>
              <button
                onClick={handleClear}
                className='flex-1 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors'
              >
                Clear
              </button>
              <button
                onClick={handleApply}
                className='flex-1 px-3 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors'
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      className='w-4 h-4'
    >
      <rect x='3' y='4' width='18' height='18' rx='2' ry='2' />
      <line x1='16' y1='2' x2='16' y2='6' />
      <line x1='8' y1='2' x2='8' y2='6' />
      <line x1='3' y1='10' x2='21' y2='10' />
    </svg>
  );
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
