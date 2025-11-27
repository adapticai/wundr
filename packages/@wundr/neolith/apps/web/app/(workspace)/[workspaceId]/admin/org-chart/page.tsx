'use client';

import { AlertCircle } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { OrgChart } from '@/components/org-chart';
import type { OrgNode } from '@/components/org-chart/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import type { VPApiResponse } from '@/types/api';

interface Workspace {
  id: string;
  name: string;
}

export default function OrgChartPage() {
  const params = useParams();
  const workspaceId = params?.workspaceId as string;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [vps, setVPs] = useState<OrgNode[]>([]);

  useEffect(() => {
    async function fetchOrgData() {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch workspace data
        const workspaceRes = await fetch(`/api/workspaces/${workspaceId}`);
        if (!workspaceRes.ok) {
          throw new Error('Failed to fetch workspace');
        }
        const workspaceData = await workspaceRes.json();
        setWorkspace(workspaceData);

        // Fetch VPs for this workspace
        const orchestratorsRes = await fetch(`/api/workspaces/${workspaceId}/orchestrators`);
        if (!vpsRes.ok) {
          throw new Error('Failed to fetch Orchestrators');
        }
        const orchestratorsData = await orchestratorsRes.json();

        // Transform Orchestrator data to OrgNode format
        const orgNodes: OrgNode[] = orchestratorsData.orchestrators?.map((vp: VPApiResponse) => ({
          id: vp.id,
          name: vp.title,
          title: vp.description || 'Orchestrator',
          discipline: vp.discipline || 'General',
          status: vp.status || 'OFFLINE',
          avatarUrl: vp.avatarUrl,
        })) || [];

        setVPs(orgNodes);
      } catch (err) {
        console.error('Error fetching org data:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    if (workspaceId) {
      fetchOrgData();
    }
  }, [workspaceId]);

  if (isLoading) {
    return (
      <div className="flex min-h-[600px] items-center justify-center">
        <LoadingSpinner className="h-8 w-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-stone-100">Organization Chart</h1>
          <p className="text-stone-400 mt-2">
            Visualize and manage your organization&apos;s Orchestrator hierarchy
          </p>
        </div>

        <OrgChart
          workspaceId={workspaceId}
          orgName={workspace?.name || 'Organization'}
          orchestrators={vps}
        />
      </div>
    </div>
  );
}
