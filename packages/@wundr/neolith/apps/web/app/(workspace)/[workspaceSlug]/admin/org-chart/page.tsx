'use client';

import {
  AlertCircle,
  Edit2,
  Network,
  Plus,
  Save,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { InteractiveOrgChart } from '@/components/orchestrator/interactive-org-chart';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageHeader } from '@/contexts/page-header-context';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrchestratorRow {
  id: string;
  title: string;
  discipline: string | null;
  role: string;
  parentId: string | null;
  status: string;
}

interface EditState {
  role: string;
  parentId: string; // '__none__' means root
}

const ROLES = [
  'Orchestrator',
  'Senior Orchestrator',
  'Lead Orchestrator',
  'Principal Orchestrator',
  'Chief Orchestrator',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeMaxDepth(rows: OrchestratorRow[]): number {
  if (rows.length === 0) return 0;
  function childDepth(id: string, seen = new Set<string>()): number {
    if (seen.has(id)) return 0;
    seen.add(id);
    const children = rows.filter(r => r.parentId === id);
    if (children.length === 0) return 0;
    return 1 + Math.max(...children.map(c => childDepth(c.id, new Set(seen))));
  }
  const roots = rows.filter(r => !r.parentId);
  if (roots.length === 0) return 1;
  return 1 + Math.max(...roots.map(r => childDepth(r.id)));
}

function ParentSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: OrchestratorRow[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className='h-8 text-xs'>
        <SelectValue placeholder='No parent (root)' />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value='__none__' className='text-xs'>
          No parent (root)
        </SelectItem>
        {options.map(o => (
          <SelectItem key={o.id} value={o.id} className='text-xs'>
            {o.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── Edit Node Row ────────────────────────────────────────────────────────────

function EditNodeRow({
  node,
  allNodes,
  edits,
  onRoleChange,
  onParentChange,
  onDelete,
}: {
  node: OrchestratorRow;
  allNodes: OrchestratorRow[];
  edits: Map<string, EditState>;
  onRoleChange: (id: string, role: string) => void;
  onParentChange: (id: string, parentId: string) => void;
  onDelete: (node: OrchestratorRow) => void;
}) {
  const state = edits.get(node.id);
  const currentRole = state?.role ?? node.role;
  const currentParentId = state?.parentId ?? node.parentId ?? '__none__';

  return (
    <Card>
      <CardContent className='py-3 px-4'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4'>
          <div className='flex items-center gap-3 min-w-0 flex-1'>
            <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary text-sm font-semibold'>
              {node.title.substring(0, 2).toUpperCase()}
            </div>
            <div className='min-w-0'>
              <p className='font-medium text-sm truncate'>{node.title}</p>
              {node.discipline && (
                <Badge variant='outline' className='text-xs mt-0.5'>
                  {node.discipline}
                </Badge>
              )}
            </div>
          </div>

          <div className='flex flex-col gap-1 min-w-[160px]'>
            <Label className='text-xs text-muted-foreground'>Role</Label>
            <Select
              value={currentRole}
              onValueChange={v => onRoleChange(node.id, v)}
            >
              <SelectTrigger className='h-8 text-xs'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map(r => (
                  <SelectItem key={r} value={r} className='text-xs'>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='flex flex-col gap-1 min-w-[180px]'>
            <Label className='text-xs text-muted-foreground'>Reports to</Label>
            <ParentSelect
              value={currentParentId}
              onChange={v => onParentChange(node.id, v)}
              options={allNodes.filter(n => n.id !== node.id)}
            />
          </div>

          <Button
            variant='ghost'
            size='icon'
            className='h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0'
            onClick={() => onDelete(node)}
            aria-label={`Remove ${node.title}`}
          >
            <Trash2 className='h-4 w-4' />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  value,
  label,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className='flex items-center gap-3 py-4'>
        <Icon className='h-5 w-5 text-muted-foreground shrink-0' />
        <div>
          <p className='text-2xl font-bold tabular-nums'>
            {loading ? <Skeleton className='h-7 w-8 inline-block' /> : value}
          </p>
          <p className='text-xs text-muted-foreground'>{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrgChartPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { setPageHeader } = usePageHeader();
  const { toast } = useToast();

  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orchestrators, setOrchestrators] = useState<OrchestratorRow[]>([]);
  const [edits, setEdits] = useState<Map<string, EditState>>(new Map());
  const [deleteTarget, setDeleteTarget] = useState<OrchestratorRow | null>(
    null
  );

  // Add dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addRole, setAddRole] = useState(ROLES[0]);
  const [addParentId, setAddParentId] = useState('__none__');
  const [addSaving, setAddSaving] = useState(false);

  useEffect(() => {
    setPageHeader(
      'Organization Chart',
      "Visualize and manage your organization's Orchestrator hierarchy"
    );
  }, [setPageHeader]);

  const loadOrchestrators = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/orchestrators?limit=200`
      );
      if (!res.ok) throw new Error('Failed to fetch orchestrators');
      const data = await res.json();
      const rows: OrchestratorRow[] = (data.orchestrators ?? []).map(
        (o: any) => ({
          id: o.id,
          title: o.title,
          discipline: o.discipline ?? null,
          role: o.role ?? 'Orchestrator',
          parentId: o.parentId ?? null,
          status: o.status ?? 'OFFLINE',
        })
      );
      setOrchestrators(rows);
      setEdits(new Map());
    } catch (err) {
      toast({
        title: 'Error',
        description:
          err instanceof Error ? err.message : 'Failed to load orchestrators',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [workspaceSlug, toast]);

  useEffect(() => {
    void loadOrchestrators();
  }, [loadOrchestrators]);

  // ─── Edit handlers ────────────────────────────────────────────────────────

  const patchEdit = useCallback(
    (id: string, patch: Partial<EditState>) => {
      setEdits(prev => {
        const next = new Map(prev);
        const existing = next.get(id);
        const node = orchestrators.find(o => o.id === id);
        next.set(id, {
          role: existing?.role ?? node?.role ?? ROLES[0],
          parentId: existing?.parentId ?? node?.parentId ?? '__none__',
          ...patch,
        });
        return next;
      });
    },
    [orchestrators]
  );

  const handleSave = useCallback(async () => {
    if (edits.size === 0) {
      setIsEditMode(false);
      return;
    }
    setSaving(true);
    try {
      const updates = Array.from(edits.entries()).map(([id, s]) => ({
        id,
        role: s.role,
        parentId: s.parentId === '__none__' ? null : s.parentId,
      }));
      const res = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/orchestrators`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to save changes');
      }
      toast({ title: 'Saved', description: 'Hierarchy updated successfully.' });
      setIsEditMode(false);
      await loadOrchestrators();
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [edits, workspaceSlug, toast, loadOrchestrators]);

  const handleAdd = useCallback(async () => {
    if (!addTitle.trim()) return;
    setAddSaving(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/orchestrators`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: addTitle.trim(),
            role: addRole,
            parentId: addParentId === '__none__' ? null : addParentId,
          }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to create orchestrator');
      }
      toast({
        title: 'Created',
        description: `${addTitle.trim()} added to the hierarchy.`,
      });
      setAddOpen(false);
      setAddTitle('');
      setAddRole(ROLES[0]);
      setAddParentId('__none__');
      await loadOrchestrators();
    } catch (err) {
      toast({
        title: 'Create failed',
        description: err instanceof Error ? err.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setAddSaving(false);
    }
  }, [addTitle, addRole, addParentId, workspaceSlug, toast, loadOrchestrators]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/orchestrators/${deleteTarget.id}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to remove orchestrator');
      }
      toast({
        title: 'Removed',
        description: `${deleteTarget.title} removed from the hierarchy.`,
      });
      setDeleteTarget(null);
      await loadOrchestrators();
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  }, [deleteTarget, workspaceSlug, toast, loadOrchestrators]);

  const depth = computeMaxDepth(orchestrators);
  const unassigned = orchestrators.filter(
    o => !o.role || o.role === 'Orchestrator'
  ).length;

  return (
    <div className='space-y-6'>
      {/* Top bar */}
      <div className='flex flex-wrap items-center justify-end gap-3'>
        <div className='flex items-center gap-2'>
          {isEditMode ? (
            <>
              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  setEdits(new Map());
                  setIsEditMode(false);
                }}
                disabled={saving}
                className='gap-1.5'
              >
                <X className='h-4 w-4' />
                Cancel
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setAddOpen(true)}
                disabled={saving}
                className='gap-1.5'
              >
                <Plus className='h-4 w-4' />
                Add Orchestrator
              </Button>
              <Button
                size='sm'
                onClick={handleSave}
                disabled={saving}
                className='gap-1.5'
              >
                <Save className='h-4 w-4' />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <Button
              variant='outline'
              size='sm'
              onClick={() => setIsEditMode(true)}
              className='gap-1.5'
            >
              <Edit2 className='h-4 w-4' />
              Edit Hierarchy
            </Button>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className='grid grid-cols-3 gap-4'>
        <StatCard
          icon={Users}
          value={orchestrators.length}
          label='Total Orchestrators'
          loading={loading}
        />
        <StatCard
          icon={Network}
          value={depth}
          label='Hierarchy Depth'
          loading={loading}
        />
        <StatCard
          icon={AlertCircle}
          value={unassigned}
          label='Unassigned Roles'
          loading={loading}
        />
      </div>

      {/* View mode */}
      {!isEditMode && <InteractiveOrgChart workspaceId={workspaceSlug} />}

      {/* Edit mode */}
      {isEditMode && (
        <div className='space-y-3'>
          <p className='text-sm text-muted-foreground'>
            Adjust roles and reporting lines below, then click Save Changes.
          </p>
          {loading ? (
            <div className='space-y-3'>
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <CardContent className='py-3 px-4'>
                    <div className='flex items-center gap-4'>
                      <Skeleton className='h-9 w-9 rounded-md shrink-0' />
                      <Skeleton className='h-4 flex-1' />
                      <Skeleton className='h-8 w-36' />
                      <Skeleton className='h-8 w-40' />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : orchestrators.length === 0 ? (
            <Card>
              <CardContent className='py-10 text-center text-sm text-muted-foreground'>
                No orchestrators found. Add one to get started.
              </CardContent>
            </Card>
          ) : (
            <div className='space-y-2'>
              {orchestrators.map(node => (
                <EditNodeRow
                  key={node.id}
                  node={node}
                  allNodes={orchestrators}
                  edits={edits}
                  onRoleChange={(id, role) => patchEdit(id, { role })}
                  onParentChange={(id, parentId) => patchEdit(id, { parentId })}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add orchestrator dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Add Orchestrator</DialogTitle>
          </DialogHeader>
          <div className='space-y-4 py-2'>
            <div className='space-y-1.5'>
              <Label htmlFor='add-title'>Name</Label>
              <Input
                id='add-title'
                placeholder='e.g. VP Engineering'
                value={addTitle}
                onChange={e => setAddTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && void handleAdd()}
              />
            </div>
            <div className='space-y-1.5'>
              <Label>Role</Label>
              <Select value={addRole} onValueChange={setAddRole}>
                <SelectTrigger className='h-9'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1.5'>
              <Label>Reports to (parent)</Label>
              <ParentSelect
                value={addParentId}
                onChange={setAddParentId}
                options={orchestrators}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setAddOpen(false)}
              disabled={addSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={!addTitle.trim() || addSaving}
            >
              {addSaving ? 'Adding...' : 'Add Orchestrator'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove orchestrator?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove{' '}
              <span className='font-semibold'>{deleteTarget?.title}</span> from
              the hierarchy. Child orchestrators will become root nodes. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              onClick={handleDeleteConfirm}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
