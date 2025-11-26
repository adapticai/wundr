'use client';

import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { OrgChartVisualization } from './org-chart-visualization';

import type { OrgGenerationResponse } from '@/lib/validations/org-genesis';

/**
 * Organization Preview Component
 *
 * Displays the generated organization with multiple view modes:
 * - Visual org chart
 * - Mission, vision, values
 * - Detailed VP and discipline breakdown
 */
interface OrgPreviewProps {
  orgData: OrgGenerationResponse;
  onRegenerate: () => void;
  onCustomize: () => void;
  onAccept: () => void;
  isRegenerating?: boolean;
}

export function OrgPreview({
  orgData,
  onRegenerate,
  onCustomize,
  onAccept,
  isRegenerating = false,
}: OrgPreviewProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'structure' | 'details'>('overview');
  const { manifest, vps, disciplines, agents } = orgData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">{manifest.name}</h2>
          <p className="text-muted-foreground">{manifest.type}</p>
        </div>

        <Badge variant="outline" className="text-xs">
          Generated {new Date(manifest.createdAt).toLocaleDateString()}
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="structure">Structure</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Mission</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{manifest.mission}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vision</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{manifest.vision}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Core Values</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {manifest.values.map((value, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {index + 1}
                    </div>
                    <p className="text-muted-foreground">{value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Organization Summary</CardTitle>
              <CardDescription>
                {manifest.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border bg-muted/50 p-4 text-center">
                  <div className="text-3xl font-bold text-primary">{vps.length}</div>
                  <div className="text-sm text-muted-foreground">Leadership Roles</div>
                </div>
                <div className="rounded-lg border bg-muted/50 p-4 text-center">
                  <div className="text-3xl font-bold text-primary">{disciplines.length}</div>
                  <div className="text-sm text-muted-foreground">Disciplines</div>
                </div>
                <div className="rounded-lg border bg-muted/50 p-4 text-center">
                  <div className="text-3xl font-bold text-primary">{agents.length}</div>
                  <div className="text-sm text-muted-foreground">AI Agents</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Structure Tab */}
        <TabsContent value="structure" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Organization Chart</CardTitle>
              <CardDescription>
                Visual representation of your organization structure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OrgChartVisualization orgData={orgData} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4 mt-6">
          {vps.map((vp) => {
            const vpDisciplines = disciplines.filter((d) => d.vpId === vp.id);

            return (
              <Card key={vp.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{vp.title}</CardTitle>
                      <CardDescription>{vp.name}</CardDescription>
                    </div>
                    <Badge variant="secondary">
                      {vpDisciplines.length} Disciplines
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Responsibilities */}
                  <div>
                    <h4 className="mb-2 text-sm font-semibold">Responsibilities</h4>
                    <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                      {vp.responsibilities.map((resp, i) => (
                        <li key={i}>{resp}</li>
                      ))}
                    </ul>
                  </div>

                  {/* KPIs */}
                  <div>
                    <h4 className="mb-2 text-sm font-semibold">Key Performance Indicators</h4>
                    <div className="flex flex-wrap gap-2">
                      {vp.kpis.map((kpi, i) => (
                        <Badge key={i} variant="outline">
                          {kpi}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Disciplines */}
                  {vpDisciplines.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-sm font-semibold">Disciplines</h4>
                      <div className="space-y-3">
                        {vpDisciplines.map((discipline) => {
                          const disciplineAgents = agents.filter(
                            (a) => a.disciplineId === discipline.id,
                          );

                          return (
                            <div
                              key={discipline.id}
                              className="rounded-lg border bg-muted/50 p-3"
                            >
                              <div className="mb-2 flex items-start justify-between">
                                <div>
                                  <div className="font-medium">{discipline.name}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {discipline.description}
                                  </div>
                                </div>
                                {disciplineAgents.length > 0 && (
                                  <Badge variant="secondary" className="text-xs">
                                    {disciplineAgents.length} Agents
                                  </Badge>
                                )}
                              </div>

                              {discipline.capabilities.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {discipline.capabilities.map((cap, i) => (
                                    <span
                                      key={i}
                                      className="rounded bg-background px-2 py-0.5 text-xs text-muted-foreground"
                                    >
                                      {cap}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/50 p-4">
        <div className="text-sm text-muted-foreground">
          Ready to create this organization?
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onRegenerate}
            disabled={isRegenerating}
          >
            {isRegenerating ? 'Regenerating...' : 'Regenerate'}
          </Button>
          <Button
            variant="outline"
            onClick={onCustomize}
          >
            Customize
          </Button>
          <Button onClick={onAccept}>
            Create Organization
          </Button>
        </div>
      </div>
    </div>
  );
}
