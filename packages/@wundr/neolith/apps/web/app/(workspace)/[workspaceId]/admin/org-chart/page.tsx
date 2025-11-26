'use client';

import { AlertCircle } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';

import { OrgChart } from '@/components/org-chart';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

import type { OrgNode } from '@/components/org-chart/types';

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
        const vpsRes = await fetch(`/api/workspaces/${workspaceId}/vps`);
        if (!vpsRes.ok) {
          throw new Error('Failed to fetch Virtual Persons');
        }
        const vpsData = await vpsRes.json();

        // Transform VP data to OrgNode format
        const orgNodes: OrgNode[] = vpsData.vps?.map((vp: any) => ({
          id: vp.id,
          name: vp.title,
          title: vp.description || 'Virtual Person',
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
            Visualize and manage your organization&apos;s Virtual Person hierarchy
          </p>
        </div>

        <OrgChart
          workspaceId={workspaceId}
          orgName={workspace?.name || 'Organization'}
          vps={vps}
        />
      </div>
    </div>
  );
}
