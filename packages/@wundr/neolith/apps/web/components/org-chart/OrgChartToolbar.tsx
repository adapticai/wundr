'use client';

import { cn } from '@/lib/utils';

import { OrgChartExport } from './OrgChartExport';
import { OrgChartFilters } from './OrgChartFilters';
import { OrgChartSearch } from './OrgChartSearch';


interface OrgChartToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  matchCount?: number;
  selectedDisciplines: string[];
  selectedStatuses: string[];
  onDisciplineToggle: (discipline: string) => void;
  onStatusToggle: (status: string) => void;
  onClearFilters: () => void;
  chartElementId: string;
  orgName: string;
  className?: string;
}

export function OrgChartToolbar({
  searchQuery,
  onSearchChange,
  matchCount,
  selectedDisciplines,
  selectedStatuses,
  onDisciplineToggle,
  onStatusToggle,
  onClearFilters,
  chartElementId,
  orgName,
  className,
}: OrgChartToolbarProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row gap-4 items-start sm:items-center', className)}>
      <OrgChartSearch
        value={searchQuery}
        onChange={onSearchChange}
        matchCount={matchCount}
        className="flex-1 w-full sm:w-auto"
      />
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <OrgChartFilters
          selectedDisciplines={selectedDisciplines}
          selectedStatuses={selectedStatuses}
          onDisciplineToggle={onDisciplineToggle}
          onStatusToggle={onStatusToggle}
          onClearFilters={onClearFilters}
        />
        <OrgChartExport chartElementId={chartElementId} orgName={orgName} />
      </div>
    </div>
  );
}
