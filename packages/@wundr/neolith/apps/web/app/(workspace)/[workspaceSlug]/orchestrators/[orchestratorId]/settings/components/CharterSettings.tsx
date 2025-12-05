'use client';

/**
 * Charter Settings Component
 *
 * Integrated charter management with editor, version history, and diff viewer.
 * Provides a complete interface for managing orchestrator charters.
 */

import { History, Edit2, Eye, GitCompare } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

import { CharterDiff } from '@/components/charter/charter-diff';
import { CharterEditor } from '@/components/charter/charter-editor';
import { CharterPreview } from '@/components/charter/charter-preview';
import { CharterVersionHistory } from '@/components/charter/charter-version-history';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

import type { OrchestratorCharter } from '@/types/orchestrator';

interface CharterVersion {
  id: string;
  version: number;
  createdAt: Date;
  createdBy: string;
  changeLog: string | null;
  isActive: boolean;
  charterData: Record<string, unknown>;
}

interface CharterSettingsProps {
  orchestratorId: string;
  charterId?: string;
  disabled?: boolean;
}

export function CharterSettings({
  orchestratorId,
  charterId,
  disabled = false,
}: CharterSettingsProps) {
  const [activeView, setActiveView] = useState<'current' | 'edit' | 'history'>(
    'current'
  );
  const [currentCharter, setCurrentCharter] =
    useState<OrchestratorCharter | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // Version comparison state
  const [compareDialog, setCompareDialog] = useState(false);
  const [compareVersions, setCompareVersions] = useState<{
    v1: CharterVersion | null;
    v2: CharterVersion | null;
  }>({ v1: null, v2: null });

  // Version preview state
  const [previewDialog, setPreviewDialog] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<CharterVersion | null>(
    null
  );

  /**
   * Fetch current active charter
   */
  const fetchCurrentCharter = useCallback(async () => {
    if (!charterId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `/api/orchestrators/${orchestratorId}/charter`
      );

      if (response.ok) {
        const data = await response.json();
        setCurrentCharter(data.data.charterData as OrchestratorCharter);
      } else if (response.status === 404) {
        // No charter exists yet
        setCurrentCharter(null);
      } else {
        throw new Error('Failed to fetch charter');
      }
    } catch (error) {
      console.error('Error fetching charter:', error);
      toast.error('Failed to load charter');
    } finally {
      setLoading(false);
    }
  }, [orchestratorId, charterId]);

  useEffect(() => {
    fetchCurrentCharter();
  }, [fetchCurrentCharter]);

  /**
   * Handle charter save
   */
  const handleSaveCharter = useCallback(
    async (charter: OrchestratorCharter) => {
      try {
        const changeLog = prompt(
          'Enter a description of changes (optional):',
          'Charter updated'
        );
        if (changeLog === null) {
          return; // User cancelled
        }

        const response = await fetch(
          `/api/orchestrators/${orchestratorId}/charter`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              charterId: charterId || `${orchestratorId}-charter`,
              charterData: charter,
              changeLog: changeLog || 'Charter updated',
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Failed to save charter');
        }

        const result = await response.json();
        setCurrentCharter(result.data.charterData as OrchestratorCharter);
        setIsEditing(false);
        setActiveView('current');
        toast.success('Charter saved successfully');

        // Refresh charter data
        await fetchCurrentCharter();
      } catch (error) {
        console.error('Error saving charter:', error);
        toast.error(
          error instanceof Error ? error.message : 'Failed to save charter'
        );
        throw error;
      }
    },
    [orchestratorId, charterId, fetchCurrentCharter]
  );

  /**
   * Handle version comparison
   */
  const handleCompare = useCallback(
    async (v1Number: number, v2Number: number) => {
      if (!charterId) {
        return;
      }

      try {
        const [version1Response, version2Response] = await Promise.all([
          fetch(
            `/api/charters/${charterId}/versions?limit=100&offset=0&status=all`
          ),
          fetch(
            `/api/charters/${charterId}/versions?limit=100&offset=0&status=all`
          ),
        ]);

        if (!version1Response.ok || !version2Response.ok) {
          throw new Error('Failed to fetch versions');
        }

        const data1 = await version1Response.json();
        const data2 = await version2Response.json();

        const v1 = data1.data.find(
          (v: CharterVersion) => v.version === v1Number
        );
        const v2 = data2.data.find(
          (v: CharterVersion) => v.version === v2Number
        );

        if (v1 && v2) {
          setCompareVersions({ v1, v2 });
          setCompareDialog(true);
        }
      } catch (error) {
        console.error('Error fetching versions for comparison:', error);
        toast.error('Failed to load versions for comparison');
      }
    },
    [charterId]
  );

  /**
   * Handle version preview
   */
  const handleVersionSelect = useCallback((version: CharterVersion) => {
    setPreviewVersion(version);
    setPreviewDialog(true);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className='flex items-center justify-center py-12'>
          <div className='text-muted-foreground'>Loading charter...</div>
        </CardContent>
      </Card>
    );
  }

  // If no charter exists and not editing, show create prompt
  if (!currentCharter && !isEditing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Charter Configuration</CardTitle>
          <CardDescription>
            Define the mission, values, and operational parameters for this
            orchestrator
          </CardDescription>
        </CardHeader>
        <CardContent className='flex flex-col items-center justify-center space-y-4 py-12'>
          <div className='text-center text-muted-foreground'>
            No charter has been created yet
          </div>
          <Button onClick={() => setIsEditing(true)} disabled={disabled}>
            <Edit2 className='mr-2 h-4 w-4' />
            Create Charter
          </Button>
        </CardContent>
      </Card>
    );
  }

  // If editing, show editor
  if (isEditing) {
    return (
      <CharterEditor
        orchestratorId={orchestratorId}
        initialCharter={currentCharter || undefined}
        onSave={handleSaveCharter}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  // Show current charter with tabs for different views
  return (
    <div className='space-y-6'>
      <Tabs value={activeView} onValueChange={v => setActiveView(v as any)}>
        <div className='flex items-center justify-between'>
          <TabsList>
            <TabsTrigger value='current' className='gap-2'>
              <Eye className='h-4 w-4' />
              Current
            </TabsTrigger>
            <TabsTrigger value='history' className='gap-2'>
              <History className='h-4 w-4' />
              History
            </TabsTrigger>
          </TabsList>
          <div className='flex gap-2'>
            {activeView === 'current' && (
              <Button
                variant='outline'
                onClick={() => setIsEditing(true)}
                disabled={disabled}
              >
                <Edit2 className='mr-2 h-4 w-4' />
                Edit Charter
              </Button>
            )}
          </div>
        </div>

        <TabsContent value='current' className='mt-6'>
          {currentCharter && <CharterPreview charter={currentCharter} />}
        </TabsContent>

        <TabsContent value='history' className='mt-6'>
          {charterId && (
            <CharterVersionHistory
              orchestratorId={orchestratorId}
              charterId={charterId}
              onVersionSelect={handleVersionSelect}
              onCompare={handleCompare}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Version Preview Dialog */}
      <Dialog open={previewDialog} onOpenChange={setPreviewDialog}>
        <DialogContent className='max-w-4xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Charter Version {previewVersion?.version}</DialogTitle>
            <DialogDescription>
              Created on{' '}
              {previewVersion &&
                new Date(previewVersion.createdAt).toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>
          {previewVersion && (
            <div className='space-y-4'>
              {previewVersion.changeLog && (
                <div className='rounded-lg border p-4 bg-muted/30'>
                  <h4 className='text-sm font-semibold mb-2'>Change Log</h4>
                  <p className='text-sm text-muted-foreground'>
                    {previewVersion.changeLog}
                  </p>
                </div>
              )}
              <CharterPreview
                charter={
                  previewVersion.charterData as unknown as OrchestratorCharter
                }
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Version Comparison Dialog */}
      <Dialog open={compareDialog} onOpenChange={setCompareDialog}>
        <DialogContent className='max-w-6xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <GitCompare className='h-5 w-5' />
              Compare Charter Versions
            </DialogTitle>
            <DialogDescription>
              Comparing version {compareVersions.v1?.version} with version{' '}
              {compareVersions.v2?.version}
            </DialogDescription>
          </DialogHeader>
          {compareVersions.v1 && compareVersions.v2 && (
            <CharterDiff
              oldCharter={
                compareVersions.v1.charterData as unknown as OrchestratorCharter
              }
              newCharter={
                compareVersions.v2.charterData as unknown as OrchestratorCharter
              }
              oldVersion={compareVersions.v1.version}
              newVersion={compareVersions.v2.version}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
