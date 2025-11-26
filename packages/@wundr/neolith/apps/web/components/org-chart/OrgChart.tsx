'use client';

import { useState, useMemo, useEffect } from 'react';

import { cn } from '@/lib/utils';

import { OrgChartEmptyState } from './OrgChartEmptyState';
import { OrgChartNode } from './OrgChartNode';
import { OrgChartToolbar } from './OrgChartToolbar';


import type { OrgNode } from './types';

interface OrgChartProps {
  workspaceId: string;
  orgName: string;
  vps: OrgNode[];
  className?: string;
}

export function OrgChart({ workspaceId, orgName, vps, className }: OrgChartProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  // Detect viewport size
  useEffect(() => {
    const checkViewport = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
    };

    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  // Filter and search logic
  const filteredVPs = useMemo(() => {
    let filtered = vps;

    // Apply discipline filter
    if (selectedDisciplines.length > 0) {
      filtered = filtered.filter((vp) => selectedDisciplines.includes(vp.discipline));
    }

    // Apply status filter
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter((vp) => selectedStatuses.includes(vp.status));
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (vp) =>
          vp.name.toLowerCase().includes(query) ||
          vp.title.toLowerCase().includes(query) ||
          vp.discipline.toLowerCase().includes(query) ||
          vp.status.toLowerCase().includes(query),
      );
    }

    return filtered;
  }, [vps, selectedDisciplines, selectedStatuses, searchQuery]);

  // Calculate match highlighting
  const highlightedVPs = useMemo(() => {
    if (!searchQuery.trim()) {
return new Set<string>();
}
    return new Set(filteredVPs.map((vp) => vp.id));
  }, [filteredVPs, searchQuery]);

  const handleDisciplineToggle = (discipline: string) => {
    setSelectedDisciplines((prev) =>
      prev.includes(discipline) ? prev.filter((d) => d !== discipline) : [...prev, discipline],
    );
  };

  const handleStatusToggle = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    );
  };

  const handleClearFilters = () => {
    setSelectedDisciplines([]);
    setSelectedStatuses([]);
  };

  // Empty state
  if (vps.length === 0) {
    return <OrgChartEmptyState workspaceId={workspaceId} className={className} />;
  }

  // Group VPs by discipline for tablet/desktop view
  const vpsByDiscipline = useMemo(() => {
    const grouped = new Map<string, OrgNode[]>();
    filteredVPs.forEach((vp) => {
      const existing = grouped.get(vp.discipline) || [];
      grouped.set(vp.discipline, [...existing, vp]);
    });
    return grouped;
  }, [filteredVPs]);

  return (
    <div className={cn('space-y-6', className)}>
      <OrgChartToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        matchCount={searchQuery ? filteredVPs.length : undefined}
        selectedDisciplines={selectedDisciplines}
        selectedStatuses={selectedStatuses}
        onDisciplineToggle={handleDisciplineToggle}
        onStatusToggle={handleStatusToggle}
        onClearFilters={handleClearFilters}
        chartElementId="org-chart-content"
        orgName={orgName}
      />

      <div
        id="org-chart-content"
        className={cn(
          'rounded-lg border border-stone-800 bg-stone-950 p-6',
          isMobile && 'overflow-x-auto',
          isMobile && 'snap-x snap-mandatory',
        )}
      >
        {filteredVPs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-stone-400">
              No Virtual Persons match your search and filter criteria.
            </p>
          </div>
        ) : isMobile ? (
          // Mobile: Horizontal scroll with snap
          <div className="flex gap-4 pb-4" style={{ minWidth: 'max-content' }}>
            {filteredVPs.map((vp) => (
              <div key={vp.id} className="snap-center" style={{ minWidth: '200px' }}>
                <OrgChartNode
                  node={vp}
                  isHighlighted={highlightedVPs.has(vp.id)}
                  isDimmed={searchQuery.trim() !== '' && !highlightedVPs.has(vp.id)}
                />
              </div>
            ))}
          </div>
        ) : isTablet ? (
          // Tablet: Compact grid view
          <div className="grid grid-cols-2 gap-4">
            {filteredVPs.map((vp) => (
              <OrgChartNode
                key={vp.id}
                node={vp}
                isHighlighted={highlightedVPs.has(vp.id)}
                isDimmed={searchQuery.trim() !== '' && !highlightedVPs.has(vp.id)}
              />
            ))}
          </div>
        ) : (
          // Desktop: Full tree view grouped by discipline
          <div className="space-y-8">
            {Array.from(vpsByDiscipline.entries()).map(([discipline, disciplineVPs]) => (
              <div key={discipline}>
                <h3 className="text-lg font-semibold text-stone-100 mb-4 pb-2 border-b border-stone-800">
                  {discipline}
                </h3>
                <div className="grid grid-cols-3 xl:grid-cols-4 gap-4">
                  {disciplineVPs.map((vp) => (
                    <OrgChartNode
                      key={vp.id}
                      node={vp}
                      isHighlighted={highlightedVPs.has(vp.id)}
                      isDimmed={searchQuery.trim() !== '' && !highlightedVPs.has(vp.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
