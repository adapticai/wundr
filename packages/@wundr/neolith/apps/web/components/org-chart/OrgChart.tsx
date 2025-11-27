'use client';

import { useEffect, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';

import { OrgChartEmptyState } from './OrgChartEmptyState';
import { OrgChartNode } from './OrgChartNode';
import { OrgChartToolbar } from './OrgChartToolbar';


import type { OrgNode } from './types';

interface OrgChartProps {
  workspaceId: string;
  orgName: string;
  orchestrators: OrgNode[];
  className?: string;
}

export function OrgChart({ workspaceId, orgName, orchestrators, className }: OrgChartProps) {
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
  const filteredOrchestrators = useMemo(() => {
    let filtered = orchestrators;

    // Apply discipline filter
    if (selectedDisciplines.length > 0) {
      filtered = filtered.filter((orch) => selectedDisciplines.includes(orch.discipline));
    }

    // Apply status filter
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter((orch) => selectedStatuses.includes(orch.status));
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (orch) =>
          orch.name.toLowerCase().includes(query) ||
          orch.title.toLowerCase().includes(query) ||
          orch.discipline.toLowerCase().includes(query) ||
          orch.status.toLowerCase().includes(query),
      );
    }

    return filtered;
  }, [orchestrators, selectedDisciplines, selectedStatuses, searchQuery]);

  // Calculate match highlighting
  const highlightedOrchestrators = useMemo(() => {
    if (!searchQuery.trim()) {
return new Set<string>();
}
    return new Set(filteredOrchestrators.map((orch) => orch.id));
  }, [filteredOrchestrators, searchQuery]);

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
  if (orchestrators.length === 0) {
    return <OrgChartEmptyState workspaceId={workspaceId} className={className} />;
  }

  // Group orchestrators by discipline for tablet/desktop view
  const orchestratorsByDiscipline = useMemo(() => {
    const grouped = new Map<string, OrgNode[]>();
    filteredOrchestrators.forEach((orch) => {
      const existing = grouped.get(orch.discipline) || [];
      grouped.set(orch.discipline, [...existing, orch]);
    });
    return grouped;
  }, [filteredOrchestrators]);

  return (
    <div className={cn('space-y-6', className)}>
      <OrgChartToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        matchCount={searchQuery ? filteredOrchestrators.length : undefined}
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
        {filteredOrchestrators.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-stone-400">
              No Orchestrators match your search and filter criteria.
            </p>
          </div>
        ) : isMobile ? (
          // Mobile: Horizontal scroll with snap
          <div className="flex gap-4 pb-4" style={{ minWidth: 'max-content' }}>
            {filteredOrchestrators.map((orch) => (
              <div key={orch.id} className="snap-center" style={{ minWidth: '200px' }}>
                <OrgChartNode
                  node={orch}
                  isHighlighted={highlightedOrchestrators.has(orch.id)}
                  isDimmed={searchQuery.trim() !== '' && !highlightedOrchestrators.has(orch.id)}
                />
              </div>
            ))}
          </div>
        ) : isTablet ? (
          // Tablet: Compact grid view
          <div className="grid grid-cols-2 gap-4">
            {filteredOrchestrators.map((orch) => (
              <OrgChartNode
                key={orch.id}
                node={orch}
                isHighlighted={highlightedOrchestrators.has(orch.id)}
                isDimmed={searchQuery.trim() !== '' && !highlightedOrchestrators.has(orch.id)}
              />
            ))}
          </div>
        ) : (
          // Desktop: Full tree view grouped by discipline
          <div className="space-y-8">
            {Array.from(orchestratorsByDiscipline.entries()).map(([discipline, disciplineOrchestrators]) => (
              <div key={discipline}>
                <h3 className="text-lg font-semibold text-stone-100 mb-4 pb-2 border-b border-stone-800">
                  {discipline}
                </h3>
                <div className="grid grid-cols-3 xl:grid-cols-4 gap-4">
                  {disciplineOrchestrators.map((orch) => (
                    <OrgChartNode
                      key={orch.id}
                      node={orch}
                      isHighlighted={highlightedOrchestrators.has(orch.id)}
                      isDimmed={searchQuery.trim() !== '' && !highlightedOrchestrators.has(orch.id)}
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
