/**
 * Subagent Create Modal
 *
 * Form for creating a new Subagent with capabilities and MCP tools.
 */

'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SubagentCreateProps {
  sessionManagerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

const AVAILABLE_MCP_TOOLS = [
  'file_read',
  'file_write',
  'edit',
  'bash',
  'git',
  'web_fetch',
  'search',
  'glob',
  'grep',
  'test_runner',
  'lint_check',
  'git_diff',
];

const SCOPE_OPTIONS = [
  { value: 'UNIVERSAL', label: 'Universal (all orchestrators)' },
  { value: 'DISCIPLINE', label: 'Discipline (within discipline)' },
  { value: 'WORKSPACE', label: 'Workspace (within workspace)' },
  { value: 'PRIVATE', label: 'Private (only this SM)' },
];

const WORKTREE_OPTIONS = [
  { value: 'none', label: 'None (read-only access)' },
  { value: 'read', label: 'Read (shared worktree)' },
  { value: 'write', label: 'Write (dedicated worktree)' },
];

export function SubagentCreate({
  sessionManagerId,
  open,
  onOpenChange,
  onCreated,
}: SubagentCreateProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    charterId: '',
    scope: 'DISCIPLINE',
    tier: 3,
    isGlobal: false,
    mcpTools: [] as string[],
    capabilities: [] as string[],
    maxTokensPerTask: 50000,
    worktreeRequirement: 'none',
  });
  const [newCapability, setNewCapability] = useState('');

  function addMcpTool(tool: string) {
    if (!formData.mcpTools.includes(tool)) {
      setFormData({ ...formData, mcpTools: [...formData.mcpTools, tool] });
    }
  }

  function removeMcpTool(tool: string) {
    setFormData({
      ...formData,
      mcpTools: formData.mcpTools.filter(t => t !== tool),
    });
  }

  function addCapability() {
    if (newCapability && !formData.capabilities.includes(newCapability)) {
      setFormData({
        ...formData,
        capabilities: [...formData.capabilities, newCapability],
      });
      setNewCapability('');
    }
  }

  function removeCapability(cap: string) {
    setFormData({
      ...formData,
      capabilities: formData.capabilities.filter(c => c !== cap),
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name || !formData.charterId) {
      toast({
        title: 'Error',
        description: 'Name and Charter ID are required',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/session-managers/${sessionManagerId}/subagents`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            charterData: { name: formData.name, version: 1 },
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to create subagent');

      toast({ title: 'Success', description: 'Subagent created successfully' });
      onOpenChange(false);
      onCreated?.();

      // Reset form
      setFormData({
        name: '',
        description: '',
        charterId: '',
        scope: 'DISCIPLINE',
        tier: 3,
        isGlobal: false,
        mcpTools: [],
        capabilities: [],
        maxTokensPerTask: 50000,
        worktreeRequirement: 'none',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to create subagent',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[600px] max-h-[90vh] overflow-y-auto'>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Subagent</DialogTitle>
            <DialogDescription>
              Subagents are specialized workers that perform tasks under Session
              Manager coordination.
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-4 py-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div className='grid gap-2'>
                <Label htmlFor='name'>Name *</Label>
                <Input
                  id='name'
                  value={formData.name}
                  onChange={e =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder='code-surgeon'
                />
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='charterId'>Charter ID *</Label>
                <Input
                  id='charterId'
                  value={formData.charterId}
                  onChange={e =>
                    setFormData({ ...formData, charterId: e.target.value })
                  }
                  placeholder='code-surgeon-v1'
                />
              </div>
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='description'>Description</Label>
              <Textarea
                id='description'
                value={formData.description}
                onChange={e =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder='Precise code modifier for refactoring and bug fixing'
                rows={2}
              />
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div className='grid gap-2'>
                <Label>Scope</Label>
                <Select
                  value={formData.scope}
                  onValueChange={v => setFormData({ ...formData, scope: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='grid gap-2'>
                <Label>Worktree Requirement</Label>
                <Select
                  value={formData.worktreeRequirement}
                  onValueChange={v =>
                    setFormData({ ...formData, worktreeRequirement: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WORKTREE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className='flex items-center justify-between'>
              <Label htmlFor='isGlobal'>
                Global (available to all session managers)
              </Label>
              <Switch
                id='isGlobal'
                checked={formData.isGlobal}
                onCheckedChange={checked =>
                  setFormData({ ...formData, isGlobal: checked })
                }
              />
            </div>

            <div className='grid gap-2'>
              <Label>MCP Tools</Label>
              <div className='flex flex-wrap gap-2 mb-2'>
                {formData.mcpTools.map(tool => (
                  <Badge
                    key={tool}
                    variant='secondary'
                    className='cursor-pointer'
                    onClick={() => removeMcpTool(tool)}
                  >
                    {tool} <X className='h-3 w-3 ml-1' />
                  </Badge>
                ))}
              </div>
              <div className='flex flex-wrap gap-1'>
                {AVAILABLE_MCP_TOOLS.filter(
                  t => !formData.mcpTools.includes(t)
                ).map(tool => (
                  <Badge
                    key={tool}
                    variant='outline'
                    className='cursor-pointer hover:bg-secondary'
                    onClick={() => addMcpTool(tool)}
                  >
                    + {tool}
                  </Badge>
                ))}
              </div>
            </div>

            <div className='grid gap-2'>
              <Label>Capabilities</Label>
              <div className='flex flex-wrap gap-2 mb-2'>
                {formData.capabilities.map(cap => (
                  <Badge
                    key={cap}
                    variant='secondary'
                    className='cursor-pointer'
                    onClick={() => removeCapability(cap)}
                  >
                    {cap} <X className='h-3 w-3 ml-1' />
                  </Badge>
                ))}
              </div>
              <div className='flex gap-2'>
                <Input
                  value={newCapability}
                  onChange={e => setNewCapability(e.target.value)}
                  placeholder='Add capability...'
                  onKeyDown={e =>
                    e.key === 'Enter' && (e.preventDefault(), addCapability())
                  }
                />
                <Button type='button' variant='outline' onClick={addCapability}>
                  Add
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={loading}>
              {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              Create Subagent
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default SubagentCreate;
