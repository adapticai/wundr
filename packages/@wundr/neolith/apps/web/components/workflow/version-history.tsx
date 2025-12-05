'use client';

import {
  Clock,
  GitBranch,
  RotateCcw,
  FileText,
  CheckCircle2,
  Edit3,
  User,
  Calendar,
  MessageSquare,
  GitCommit,
  GitMerge,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import { WorkflowDiff } from './workflow-diff';

import type { Workflow } from '@/types/workflow';

/**
 * Workflow version state
 */
export type VersionState = 'draft' | 'published' | 'archived';

/**
 * Change type for version history
 */
export type ChangeType =
  | 'created'
  | 'updated'
  | 'published'
  | 'branched'
  | 'merged'
  | 'restored'
  | 'archived';

/**
 * Workflow version with metadata
 */
export interface WorkflowVersion {
  id: string;
  versionNumber: number;
  state: VersionState;
  workflow: Workflow;
  changeType: ChangeType;
  changeNotes?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  parentVersionId?: string;
  branchName?: string;
  tags: string[];
}

/**
 * Version branch
 */
export interface VersionBranch {
  id: string;
  name: string;
  description?: string;
  baseVersionId: string;
  headVersionId: string;
  createdBy: string;
  createdAt: string;
  mergedAt?: string;
  mergedIntoVersionId?: string;
  status: 'active' | 'merged' | 'abandoned';
}

/**
 * Props for VersionHistory component
 */
export interface VersionHistoryProps {
  workflowId: string;
  versions: WorkflowVersion[];
  branches?: VersionBranch[];
  currentVersionId: string;
  onRestore?: (versionId: string) => void;
  onCompare?: (versionId1: string, versionId2: string) => void;
  onCreateBranch?: (
    baseVersionId: string,
    branchName: string,
    description?: string
  ) => void;
  onMergeBranch?: (branchId: string, targetVersionId: string) => void;
  onPublish?: (versionId: string, notes?: string) => void;
  onAddNotes?: (versionId: string, notes: string) => void;
  className?: string;
}

/**
 * Change type configuration for display
 */
const CHANGE_TYPE_CONFIG: Record<
  ChangeType,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }
> = {
  created: {
    label: 'Created',
    icon: FileText,
    color: 'text-blue-600 dark:text-blue-400',
  },
  updated: {
    label: 'Updated',
    icon: Edit3,
    color: 'text-gray-600 dark:text-gray-400',
  },
  published: {
    label: 'Published',
    icon: CheckCircle2,
    color: 'text-green-600 dark:text-green-400',
  },
  branched: {
    label: 'Branched',
    icon: GitBranch,
    color: 'text-purple-600 dark:text-purple-400',
  },
  merged: {
    label: 'Merged',
    icon: GitMerge,
    color: 'text-indigo-600 dark:text-indigo-400',
  },
  restored: {
    label: 'Restored',
    icon: RotateCcw,
    color: 'text-orange-600 dark:text-orange-400',
  },
  archived: {
    label: 'Archived',
    icon: AlertCircle,
    color: 'text-red-600 dark:text-red-400',
  },
};

/**
 * Version state badge configuration
 */
const VERSION_STATE_CONFIG: Record<
  VersionState,
  { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
  draft: { label: 'Draft', variant: 'secondary' },
  published: { label: 'Published', variant: 'default' },
  archived: { label: 'Archived', variant: 'outline' },
};

/**
 * Format relative time
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'Just now';
  }
  if (diffMins < 60) {
    return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  }
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  }
  if (diffDays < 7) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Version timeline item component
 */
function VersionTimelineItem({
  version,
  isCurrentVersion,
  isMostRecent,
  onRestore,
  onCompare,
  onPublish,
  onAddNotes,
}: {
  version: WorkflowVersion;
  isCurrentVersion: boolean;
  isMostRecent: boolean;
  onRestore?: (versionId: string) => void;
  onCompare?: (versionId: string) => void;
  onPublish?: (versionId: string) => void;
  onAddNotes?: (versionId: string, notes: string) => void;
}) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [isEditingNotes, setIsEditingNotes] = React.useState(false);
  const [notes, setNotes] = React.useState(version.changeNotes || '');

  const config = CHANGE_TYPE_CONFIG[version.changeType];
  const Icon = config.icon;
  const stateConfig = VERSION_STATE_CONFIG[version.state];

  const handleSaveNotes = () => {
    if (onAddNotes && notes !== version.changeNotes) {
      onAddNotes(version.id, notes);
    }
    setIsEditingNotes(false);
  };

  return (
    <div className='relative flex gap-4 pb-8 group'>
      {/* Timeline connector */}
      {!isMostRecent && (
        <div className='absolute left-[19px] top-8 bottom-0 w-0.5 bg-border' />
      )}

      {/* Timeline dot */}
      <div
        className={cn(
          'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-background transition-colors',
          isCurrentVersion ? 'border-primary bg-primary/10' : 'border-border'
        )}
      >
        <Icon className={cn('h-5 w-5', config.color)} />
      </div>

      {/* Content */}
      <div className='flex-1 space-y-3 pt-0.5'>
        <div className='flex items-start justify-between gap-4'>
          <div className='flex-1 space-y-1'>
            <div className='flex items-center gap-2 flex-wrap'>
              <h4 className='text-sm font-semibold'>
                Version {version.versionNumber}
              </h4>
              <Badge variant={stateConfig.variant} className='text-xs'>
                {stateConfig.label}
              </Badge>
              {isCurrentVersion && (
                <Badge variant='outline' className='text-xs'>
                  Current
                </Badge>
              )}
              {version.branchName && (
                <Badge variant='outline' className='text-xs gap-1'>
                  <GitBranch className='h-3 w-3' />
                  {version.branchName}
                </Badge>
              )}
              {version.tags.map(tag => (
                <Badge key={tag} variant='secondary' className='text-xs'>
                  {tag}
                </Badge>
              ))}
            </div>
            <div className='flex items-center gap-2 text-xs text-muted-foreground'>
              <span className={cn('font-medium', config.color)}>
                {config.label}
              </span>
              <span>•</span>
              <span className='flex items-center gap-1'>
                <User className='h-3 w-3' />
                {version.createdByName}
              </span>
              <span>•</span>
              <span className='flex items-center gap-1'>
                <Clock className='h-3 w-3' />
                {formatRelativeTime(version.createdAt)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className='flex items-center gap-1'>
            {!isCurrentVersion && onRestore && (
              <Button
                variant='ghost'
                size='sm'
                onClick={() => onRestore(version.id)}
                className='h-8 gap-1.5'
              >
                <RotateCcw className='h-3.5 w-3.5' />
                Restore
              </Button>
            )}
            {onCompare && (
              <Button
                variant='ghost'
                size='sm'
                onClick={() => onCompare(version.id)}
                className='h-8 gap-1.5'
              >
                <FileText className='h-3.5 w-3.5' />
                Compare
              </Button>
            )}
            {version.state === 'draft' && onPublish && (
              <Button
                variant='ghost'
                size='sm'
                onClick={() => onPublish(version.id)}
                className='h-8 gap-1.5'
              >
                <CheckCircle2 className='h-3.5 w-3.5' />
                Publish
              </Button>
            )}
            <Button
              variant='ghost'
              size='sm'
              onClick={() => setIsExpanded(!isExpanded)}
              className='h-8 w-8 p-0'
            >
              {isExpanded ? (
                <ChevronDown className='h-4 w-4' />
              ) : (
                <ChevronRight className='h-4 w-4' />
              )}
            </Button>
          </div>
        </div>

        {/* Expanded details */}
        {isExpanded && (
          <div className='space-y-3 pt-2 border-l-2 border-border pl-4'>
            {/* Change notes */}
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <label className='text-xs font-medium text-muted-foreground flex items-center gap-1.5'>
                  <MessageSquare className='h-3.5 w-3.5' />
                  Change Notes
                </label>
                {!isEditingNotes && onAddNotes && (
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => setIsEditingNotes(true)}
                    className='h-6 text-xs'
                  >
                    <Edit3 className='h-3 w-3 mr-1' />
                    Edit
                  </Button>
                )}
              </div>
              {isEditingNotes ? (
                <div className='space-y-2'>
                  <Textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder='Add notes about this version...'
                    className='min-h-[80px] text-sm'
                  />
                  <div className='flex gap-2'>
                    <Button
                      size='sm'
                      onClick={handleSaveNotes}
                      className='h-7 text-xs'
                    >
                      Save
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => {
                        setNotes(version.changeNotes || '');
                        setIsEditingNotes(false);
                      }}
                      className='h-7 text-xs'
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className='text-sm text-muted-foreground'>
                  {version.changeNotes || 'No notes provided'}
                </p>
              )}
            </div>

            {/* Metadata */}
            <div className='grid grid-cols-2 gap-3 text-xs'>
              <div className='space-y-1'>
                <span className='text-muted-foreground'>Created</span>
                <div className='font-mono'>
                  {new Date(version.createdAt).toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
              <div className='space-y-1'>
                <span className='text-muted-foreground'>Version ID</span>
                <div className='font-mono truncate'>{version.id}</div>
              </div>
            </div>

            {/* Workflow summary */}
            <div className='space-y-2'>
              <span className='text-xs font-medium text-muted-foreground'>
                Workflow Configuration
              </span>
              <div className='rounded-md bg-muted/50 p-3 space-y-2 text-xs'>
                <div className='flex items-center justify-between'>
                  <span className='text-muted-foreground'>Status</span>
                  <Badge variant='outline' className='text-xs'>
                    {version.workflow.status}
                  </Badge>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-muted-foreground'>Actions</span>
                  <span className='font-medium'>
                    {version.workflow.actions.length}
                  </span>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-muted-foreground'>Variables</span>
                  <span className='font-medium'>
                    {version.workflow.variables?.length || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Version history component with timeline view
 */
export function VersionHistory({
  workflowId,
  versions,
  branches = [],
  currentVersionId,
  onRestore,
  onCompare,
  onCreateBranch,
  onMergeBranch,
  onPublish,
  onAddNotes,
  className,
}: VersionHistoryProps) {
  const [compareVersionId, setCompareVersionId] = React.useState<string | null>(
    null
  );
  const [showCompareDialog, setShowCompareDialog] = React.useState(false);
  const [selectedBranch, setSelectedBranch] = React.useState<string>('main');
  const [newBranchName, setNewBranchName] = React.useState('');
  const [newBranchDescription, setNewBranchDescription] = React.useState('');
  const [showBranchDialog, setShowBranchDialog] = React.useState(false);
  const [selectedVersionForBranch, setSelectedVersionForBranch] =
    React.useState<string | null>(null);

  // Sort versions by creation date (most recent first)
  const sortedVersions = React.useMemo(() => {
    return [...versions].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [versions]);

  // Filter versions by branch
  const filteredVersions = React.useMemo(() => {
    if (selectedBranch === 'main') {
      return sortedVersions.filter(v => !v.branchName);
    }
    return sortedVersions.filter(v => v.branchName === selectedBranch);
  }, [sortedVersions, selectedBranch]);

  // Get branch options
  const branchOptions = React.useMemo(() => {
    const mainBranch = { value: 'main', label: 'Main Branch' };
    const branchNames = branches
      .filter(b => b.status === 'active')
      .map(b => ({ value: b.name, label: b.name }));
    return [mainBranch, ...branchNames];
  }, [branches]);

  const handleCompare = (versionId: string) => {
    if (compareVersionId === null) {
      setCompareVersionId(versionId);
    } else {
      if (onCompare) {
        onCompare(compareVersionId, versionId);
        setShowCompareDialog(true);
      }
      setCompareVersionId(null);
    }
  };

  const handleCreateBranch = () => {
    if (onCreateBranch && selectedVersionForBranch && newBranchName) {
      onCreateBranch(
        selectedVersionForBranch,
        newBranchName,
        newBranchDescription
      );
      setShowBranchDialog(false);
      setNewBranchName('');
      setNewBranchDescription('');
      setSelectedVersionForBranch(null);
    }
  };

  const currentVersion = versions.find(v => v.id === currentVersionId);
  const compareVersion1 = versions.find(v => v.id === compareVersionId);
  const compareVersion2 = currentVersion;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='space-y-1'>
          <h3 className='text-lg font-semibold'>Version History</h3>
          <p className='text-sm text-muted-foreground'>
            {filteredVersions.length} version
            {filteredVersions.length !== 1 ? 's' : ''} in this branch
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className='w-[180px]'>
              <GitBranch className='h-4 w-4 mr-2' />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {branchOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {onCreateBranch && (
            <Dialog open={showBranchDialog} onOpenChange={setShowBranchDialog}>
              <DialogTrigger asChild>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setSelectedVersionForBranch(currentVersionId)}
                >
                  <GitBranch className='h-4 w-4 mr-2' />
                  New Branch
                </Button>
              </DialogTrigger>
              <DialogContent className='max-w-md'>
                <DialogHeader>
                  <DialogTitle>Create New Branch</DialogTitle>
                  <DialogDescription>
                    Create a new branch from the current version to experiment
                    with changes.
                  </DialogDescription>
                </DialogHeader>
                <div className='space-y-4 py-4'>
                  <div className='space-y-2'>
                    <label className='text-sm font-medium'>Branch Name</label>
                    <Input
                      value={newBranchName}
                      onChange={e => setNewBranchName(e.target.value)}
                      placeholder='feature/new-feature'
                    />
                  </div>
                  <div className='space-y-2'>
                    <label className='text-sm font-medium'>
                      Description (Optional)
                    </label>
                    <Textarea
                      value={newBranchDescription}
                      onChange={e => setNewBranchDescription(e.target.value)}
                      placeholder='Describe the purpose of this branch...'
                      className='min-h-[80px]'
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant='outline'
                    onClick={() => setShowBranchDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateBranch}
                    disabled={!newBranchName}
                  >
                    Create Branch
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Separator />

      {/* Compare mode indicator */}
      {compareVersionId !== null && (
        <div className='rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2 text-sm'>
              <FileText className='h-4 w-4 text-blue-600 dark:text-blue-400' />
              <span className='font-medium text-blue-900 dark:text-blue-100'>
                Compare mode active
              </span>
              <span className='text-blue-700 dark:text-blue-300'>
                Select another version to compare
              </span>
            </div>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => setCompareVersionId(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Version timeline */}
      <ScrollArea className='h-[600px] pr-4'>
        <div className='space-y-0'>
          {filteredVersions.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-12 text-center'>
              <GitCommit className='h-12 w-12 text-muted-foreground/50 mb-4' />
              <h4 className='text-sm font-medium text-muted-foreground'>
                No versions in this branch
              </h4>
              <p className='text-xs text-muted-foreground mt-1'>
                Switch to another branch or create a new version
              </p>
            </div>
          ) : (
            filteredVersions.map((version, index) => (
              <VersionTimelineItem
                key={version.id}
                version={version}
                isCurrentVersion={version.id === currentVersionId}
                isMostRecent={index === 0}
                onRestore={onRestore}
                onCompare={handleCompare}
                onPublish={onPublish}
                onAddNotes={onAddNotes}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Compare dialog */}
      {showCompareDialog && compareVersion1 && compareVersion2 && (
        <Dialog open={showCompareDialog} onOpenChange={setShowCompareDialog}>
          <DialogContent className='max-w-6xl max-h-[90vh]'>
            <DialogHeader>
              <DialogTitle>Compare Versions</DialogTitle>
              <DialogDescription>
                Comparing version {compareVersion1.versionNumber} with version{' '}
                {compareVersion2.versionNumber}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className='h-[70vh]'>
              <WorkflowDiff
                oldVersion={compareVersion1}
                newVersion={compareVersion2}
              />
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
