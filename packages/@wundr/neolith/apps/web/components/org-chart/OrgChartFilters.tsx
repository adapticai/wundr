'use client';

import { Filter } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface OrgChartFiltersProps {
  selectedDisciplines: string[];
  selectedStatuses: string[];
  onDisciplineToggle: (discipline: string) => void;
  onStatusToggle: (status: string) => void;
  onClearFilters: () => void;
  className?: string;
}

const DISCIPLINES = [
  'Engineering',
  'Product',
  'Design',
  'Marketing',
  'Sales',
  'Operations',
  'Finance',
  'Human Resources',
  'Customer Success',
  'Legal',
  'Research',
  'Data Science',
];

const STATUSES = [
  { value: 'ONLINE', label: 'Online', color: 'bg-green-500' },
  { value: 'BUSY', label: 'Busy', color: 'bg-yellow-500' },
  { value: 'AWAY', label: 'Away', color: 'bg-orange-500' },
  { value: 'OFFLINE', label: 'Offline', color: 'bg-stone-500' },
];

export function OrgChartFilters({
  selectedDisciplines,
  selectedStatuses,
  onDisciplineToggle,
  onStatusToggle,
  onClearFilters,
  className,
}: OrgChartFiltersProps) {
  const activeFilterCount =
    selectedDisciplines.length + selectedStatuses.length;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant='outline'
            size='sm'
            className='bg-stone-900 border-stone-800 text-stone-100 hover:bg-stone-800'
          >
            <Filter className='h-4 w-4 mr-2' />
            Filters
            {activeFilterCount > 0 && (
              <Badge
                variant='secondary'
                className='ml-2 bg-stone-700 text-stone-100'
              >
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align='start'
          className='w-56 bg-stone-900 border-stone-800'
        >
          <DropdownMenuLabel className='text-stone-100'>
            Discipline
          </DropdownMenuLabel>
          <DropdownMenuSeparator className='bg-stone-800' />
          {DISCIPLINES.map(discipline => (
            <DropdownMenuCheckboxItem
              key={discipline}
              checked={selectedDisciplines.includes(discipline)}
              onCheckedChange={() => onDisciplineToggle(discipline)}
              className='text-stone-300 focus:bg-stone-800 focus:text-stone-100'
            >
              {discipline}
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator className='bg-stone-800' />
          <DropdownMenuLabel className='text-stone-100'>
            Status
          </DropdownMenuLabel>
          <DropdownMenuSeparator className='bg-stone-800' />
          {STATUSES.map(status => (
            <DropdownMenuCheckboxItem
              key={status.value}
              checked={selectedStatuses.includes(status.value)}
              onCheckedChange={() => onStatusToggle(status.value)}
              className='text-stone-300 focus:bg-stone-800 focus:text-stone-100'
            >
              <div className='flex items-center gap-2'>
                <div className={cn('h-2 w-2 rounded-full', status.color)} />
                {status.label}
              </div>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {activeFilterCount > 0 && (
        <Button
          variant='ghost'
          size='sm'
          onClick={onClearFilters}
          className='text-stone-400 hover:text-stone-100 hover:bg-stone-800'
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}
