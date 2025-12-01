'use client';

import type { OrgGenerationResponse } from '@/lib/validations/org-genesis';

/**
 * Organization Chart Visualization Component
 *
 * Displays the generated organization structure as a hierarchical tree chart.
 * Shows Orchestrators, their disciplines, and agent counts.
 */
interface OrgChartVisualizationProps {
  orgData: OrgGenerationResponse;
}

export function OrgChartVisualization({ orgData }: OrgChartVisualizationProps) {
  const { manifest, orchestrators, disciplines, agents } = orgData;

  // Group disciplines by Orchestrator
  const disciplinesByOrchestrator = disciplines.reduce(
    (acc, discipline) => {
      if (!acc[discipline.orchestratorId]) {
        acc[discipline.orchestratorId] = [];
      }
      acc[discipline.orchestratorId].push(discipline);
      return acc;
    },
    {} as Record<string, typeof disciplines>
  );

  // Count agents by discipline
  const agentsByDiscipline = agents.reduce(
    (acc, agent) => {
      acc[agent.disciplineId] = (acc[agent.disciplineId] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className='space-y-6'>
      {/* Organization Root */}
      <div className='flex flex-col items-center'>
        <div className='rounded-lg border-2 border-primary bg-primary/5 px-6 py-4 text-center'>
          <h3 className='text-lg font-bold text-primary'>{manifest.name}</h3>
          <p className='text-sm text-muted-foreground'>{manifest.type}</p>
        </div>

        {/* Connecting line */}
        <div className='h-8 w-0.5 bg-border' />
      </div>

      {/* Orchestrators and Disciplines */}
      <div className='space-y-8'>
        {orchestrators.map((orchestrator, orchestratorIndex) => {
          const orchestratorDisciplines =
            disciplinesByOrchestrator[orchestrator.id] || [];

          return (
            <div key={orchestrator.id} className='relative'>
              {/* OrchestratorNode */}
              <div className='flex items-start gap-4'>
                <div className='flex-shrink-0'>
                  <div className='flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'>
                    AI
                  </div>
                </div>

                <div className='flex-1 rounded-lg border bg-card p-4'>
                  <h4 className='font-semibold'>{orchestrator.title}</h4>
                  <p className='text-sm text-muted-foreground'>
                    {orchestrator.name}
                  </p>

                  {/* Disciplines under this Orchestrator */}
                  {orchestratorDisciplines.length > 0 && (
                    <div className='mt-4 space-y-3'>
                      <div className='text-xs font-medium text-muted-foreground'>
                        DISCIPLINES ({orchestratorDisciplines.length})
                      </div>

                      <div className='grid gap-2 sm:grid-cols-2'>
                        {orchestratorDisciplines.map(discipline => {
                          const agentCount =
                            agentsByDiscipline[discipline.id] || 0;

                          return (
                            <div
                              key={discipline.id}
                              className='rounded border bg-muted/50 p-3'
                            >
                              <div className='flex items-start justify-between gap-2'>
                                <div className='flex-1 min-w-0'>
                                  <div className='font-medium text-sm truncate'>
                                    {discipline.name}
                                  </div>
                                  <div className='text-xs text-muted-foreground line-clamp-2'>
                                    {discipline.description}
                                  </div>
                                </div>

                                {agentCount > 0 && (
                                  <div className='flex-shrink-0 flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary'>
                                    <AgentIcon className='h-3 w-3' />
                                    {agentCount}
                                  </div>
                                )}
                              </div>

                              {/* Capabilities */}
                              {discipline.capabilities.length > 0 && (
                                <div className='mt-2 flex flex-wrap gap-1'>
                                  {discipline.capabilities
                                    .slice(0, 3)
                                    .map((cap, i) => (
                                      <span
                                        key={i}
                                        className='rounded bg-background px-1.5 py-0.5 text-xs text-muted-foreground'
                                      >
                                        {cap}
                                      </span>
                                    ))}
                                  {discipline.capabilities.length > 3 && (
                                    <span className='rounded bg-background px-1.5 py-0.5 text-xs text-muted-foreground'>
                                      +{discipline.capabilities.length - 3}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* KPIs */}
                  {orchestrator.kpis.length > 0 && (
                    <div className='mt-4 space-y-2'>
                      <div className='text-xs font-medium text-muted-foreground'>
                        KEY PERFORMANCE INDICATORS
                      </div>
                      <ul className='space-y-1'>
                        {orchestrator.kpis.slice(0, 3).map((kpi, i) => (
                          <li
                            key={i}
                            className='flex items-start gap-2 text-sm'
                          >
                            <CheckIcon className='h-4 w-4 flex-shrink-0 text-green-600 dark:text-green-400 mt-0.5' />
                            <span className='text-muted-foreground'>{kpi}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Connecting line to next Orchestrator */}
              {orchestratorIndex < orchestrators.length - 1 && (
                <div className='ml-5 h-6 w-0.5 bg-border' />
              )}
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className='grid grid-cols-3 gap-4 rounded-lg border bg-muted/50 p-4'>
        <div className='text-center'>
          <div className='text-2xl font-bold text-primary'>
            {orchestrators.length}
          </div>
          <div className='text-xs text-muted-foreground'>Orchestrators</div>
        </div>
        <div className='text-center'>
          <div className='text-2xl font-bold text-primary'>
            {disciplines.length}
          </div>
          <div className='text-xs text-muted-foreground'>Disciplines</div>
        </div>
        <div className='text-center'>
          <div className='text-2xl font-bold text-primary'>{agents.length}</div>
          <div className='text-xs text-muted-foreground'>Agents</div>
        </div>
      </div>
    </div>
  );
}

function AgentIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' />
      <circle cx='9' cy='7' r='4' />
      <path d='M22 21v-2a4 4 0 0 0-3-3.87' />
      <path d='M16 3.13a4 4 0 0 1 0 7.75' />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <polyline points='20 6 9 17 4 12' />
    </svg>
  );
}
