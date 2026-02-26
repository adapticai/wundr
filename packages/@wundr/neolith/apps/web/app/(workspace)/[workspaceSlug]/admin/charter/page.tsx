'use client';

import { BookOpen, ChevronDown, ChevronRight, Clock, FileText } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { CharterViewerEditor } from '@/components/orchestrator/charter-viewer-editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageHeader } from '@/contexts/page-header-context';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrchestratorSummary {
  id: string;
  title: string;
  discipline: string | null;
  role: string;
  hasCharter: boolean;
  charterVersion: number | null;
  charterUpdatedAt: string | null;
}

// ─── Shared principles derived from common charter patterns ───────────────────

const ORG_PRINCIPLES = [
  { title: 'Transparency', description: 'All decisions and actions are logged and auditable.' },
  { title: 'Least Privilege', description: 'Orchestrators operate with the minimum permissions required.' },
  { title: 'Escalation First', description: 'Ambiguous or high-impact actions are escalated before execution.' },
  { title: 'Collaboration', description: 'Orchestrators coordinate across disciplines to deliver outcomes.' },
  { title: 'Continuous Learning', description: 'Charters are versioned and refined based on operational feedback.' },
];

// ─── Charter Page ─────────────────────────────────────────────────────────────

export default function CharterPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { setPageHeader } = usePageHeader();

  const [orchestrators, setOrchestrators] = useState<OrchestratorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setPageHeader(
      'Organization Charter',
      'Manage charters that define each orchestrator\'s identity, capabilities, and operating boundaries'
    );
  }, [setPageHeader]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/workspaces/${workspaceSlug}/admin/orchestrators?limit=100`);
        if (!res.ok) return;
        const data = await res.json();
        const rows = (data.orchestrators ?? []) as Array<{
          id: string;
          title: string;
          discipline: string | null;
          role: string;
        }>;
        setOrchestrators(
          rows.map(o => ({
            id: o.id,
            title: o.title,
            discipline: o.discipline,
            role: o.role,
            hasCharter: false,
            charterVersion: null,
            charterUpdatedAt: null,
          }))
        );
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [workspaceSlug]);

  const toggle = (id: string) =>
    setExpandedId(prev => (prev === id ? null : id));

  return (
    <div className="space-y-8">
      {/* Orchestrator charter list */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">Orchestrator Charters</h2>
          {!loading && (
            <Badge variant="secondary" className="ml-1">
              {orchestrators.length}
            </Badge>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardHeader className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-8 w-24" />
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : orchestrators.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No orchestrators found in this workspace.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {orchestrators.map(orch => {
              const isExpanded = expandedId === orch.id;
              return (
                <Card key={orch.id} className="overflow-hidden">
                  <CardHeader className="py-4">
                    <div className="flex items-center justify-between gap-4">
                      {/* Left: orchestrator info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary text-sm font-semibold">
                          {orch.title.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{orch.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {orch.discipline && (
                              <Badge variant="outline" className="text-xs">
                                {orch.discipline}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground truncate">
                              {orch.role}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: charter status + toggle */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right hidden sm:block">
                          {orch.charterVersion != null ? (
                            <>
                              <p className="text-xs font-medium text-green-600">
                                Active — v{orch.charterVersion}
                              </p>
                              {orch.charterUpdatedAt && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                                  <Clock className="h-3 w-3" />
                                  {new Date(orch.charterUpdatedAt).toLocaleDateString()}
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-xs text-muted-foreground">No charter</p>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggle(orch.id)}
                          className="gap-1.5"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronDown className="h-4 w-4" />
                              Close
                            </>
                          ) : (
                            <>
                              <ChevronRight className="h-4 w-4" />
                              View / Edit
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="border-t pt-4 pb-4">
                      <CharterViewerEditor orchestratorId={orch.id} />
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Organization-wide principles */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">Organization-wide Principles</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ORG_PRINCIPLES.map(p => (
            <Card key={p.title}>
              <CardContent className="pt-4 pb-4">
                <p className="font-medium text-sm">{p.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
