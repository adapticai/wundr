/**
 * Subagent Create Modal
 *
 * Form for creating a new Subagent with capabilities and MCP tools.
 */

'use client';

import { ChevronDown, ChevronRight, Loader2, X } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

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
const PREDEFINED_CAPABILITIES = [
  'Code Generation',
  'Code Review',
  'Testing',
  'Documentation',
  'API Design',
  'Database',
  'DevOps',
  'Security',
  'ML/AI',
  'Frontend',
  'Backend',
  'Mobile',
];
const TOOL_OPTIONS = [
  'Read',
  'Write',
  'Edit',
  'Bash',
  'Glob',
  'Grep',
  'WebFetch',
  'WebSearch',
  'NotebookEdit',
];
const MODEL_OPTIONS = [
  { value: 'claude-opus-4-6', label: 'Claude Opus 4 (most capable)' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4 (balanced)' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku (fastest)' },
];

const DEFAULT_FORM = {
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
  selectedCapabilities: [] as string[],
  selectedTools: [] as string[],
  customMcpTools: [] as string[],
  maxTurnsPerTask: 25,
  tokenBudget: 10000,
  timeoutMinutes: 10,
  model: 'claude-sonnet-4-6',
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card className='border border-border'>
      <CardHeader
        className='py-3 px-4 cursor-pointer select-none'
        onClick={() => setOpen(v => !v)}
      >
        <CardTitle className='text-sm font-medium flex items-center gap-2'>
          {open ? (
            <ChevronDown className='h-4 w-4 text-muted-foreground' />
          ) : (
            <ChevronRight className='h-4 w-4 text-muted-foreground' />
          )}
          {title}
        </CardTitle>
      </CardHeader>
      {open && <CardContent className='px-4 pb-4 pt-0'>{children}</CardContent>}
    </Card>
  );
}

export function SubagentCreate({
  sessionManagerId,
  open,
  onOpenChange,
  onCreated,
}: SubagentCreateProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ ...DEFAULT_FORM });
  const [newCapability, setNewCapability] = useState('');
  const [newMcpTool, setNewMcpTool] = useState('');

  function addMcpTool(tool: string) {
    if (!formData.mcpTools.includes(tool))
      setFormData({ ...formData, mcpTools: [...formData.mcpTools, tool] });
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
  function togglePredefinedCapability(cap: string) {
    const selected = formData.selectedCapabilities.includes(cap)
      ? formData.selectedCapabilities.filter(c => c !== cap)
      : [...formData.selectedCapabilities, cap];
    setFormData({ ...formData, selectedCapabilities: selected });
  }
  function toggleTool(tool: string) {
    const selected = formData.selectedTools.includes(tool)
      ? formData.selectedTools.filter(t => t !== tool)
      : [...formData.selectedTools, tool];
    setFormData({ ...formData, selectedTools: selected });
  }
  function addCustomMcpTool() {
    const trimmed = newMcpTool.trim();
    if (trimmed && !formData.customMcpTools.includes(trimmed)) {
      setFormData({
        ...formData,
        customMcpTools: [...formData.customMcpTools, trimmed],
      });
      setNewMcpTool('');
    }
  }
  function removeCustomMcpTool(tool: string) {
    setFormData({
      ...formData,
      customMcpTools: formData.customMcpTools.filter(t => t !== tool),
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
      setFormData({ ...DEFAULT_FORM });
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

            {/* Enhanced collapsible sections */}
            <Section title='Capability Selection'>
              <div className='grid grid-cols-2 gap-2'>
                {PREDEFINED_CAPABILITIES.map(cap => (
                  <div key={cap} className='flex items-center gap-2'>
                    <Checkbox
                      id={`cap-${cap}`}
                      checked={formData.selectedCapabilities.includes(cap)}
                      onCheckedChange={() => togglePredefinedCapability(cap)}
                    />
                    <Label
                      htmlFor={`cap-${cap}`}
                      className='font-normal cursor-pointer'
                    >
                      {cap}
                    </Label>
                  </div>
                ))}
              </div>
            </Section>

            <Section title='Tool Configuration'>
              <div className='grid grid-cols-2 gap-2'>
                {TOOL_OPTIONS.map(tool => (
                  <div key={tool} className='flex items-center gap-2'>
                    <Checkbox
                      id={`tool-${tool}`}
                      checked={formData.selectedTools.includes(tool)}
                      onCheckedChange={() => toggleTool(tool)}
                    />
                    <Label
                      htmlFor={`tool-${tool}`}
                      className='font-normal cursor-pointer'
                    >
                      {tool}
                    </Label>
                  </div>
                ))}
              </div>
            </Section>

            <Section title='MCP Tools (Custom)'>
              <div className='grid gap-3'>
                <div className='flex flex-wrap gap-2'>
                  {formData.customMcpTools.length === 0 ? (
                    <span className='text-sm text-muted-foreground'>
                      No custom MCP tools added
                    </span>
                  ) : (
                    formData.customMcpTools.map(tool => (
                      <Badge
                        key={tool}
                        variant='secondary'
                        className='cursor-pointer'
                        onClick={() => removeCustomMcpTool(tool)}
                      >
                        {tool} <X className='h-3 w-3 ml-1' />
                      </Badge>
                    ))
                  )}
                </div>
                <div className='flex gap-2'>
                  <Input
                    value={newMcpTool}
                    onChange={e => setNewMcpTool(e.target.value)}
                    placeholder='mcp_tool_name'
                    onKeyDown={e =>
                      e.key === 'Enter' &&
                      (e.preventDefault(), addCustomMcpTool())
                    }
                  />
                  <Button
                    type='button'
                    variant='outline'
                    onClick={addCustomMcpTool}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </Section>

            <Section title='Resource Limits'>
              <div className='grid gap-5'>
                <div className='grid gap-2'>
                  <div className='flex items-center justify-between'>
                    <Label>Max turns per task</Label>
                    <span className='text-sm text-muted-foreground'>
                      {formData.maxTurnsPerTask}
                    </span>
                  </div>
                  <Slider
                    min={1}
                    max={100}
                    step={1}
                    value={[formData.maxTurnsPerTask]}
                    onValueChange={([v]) =>
                      setFormData({ ...formData, maxTurnsPerTask: v })
                    }
                  />
                  <div className='flex justify-between text-xs text-muted-foreground'>
                    <span>1</span>
                    <span>100</span>
                  </div>
                </div>
                <div className='grid gap-2'>
                  <div className='flex items-center justify-between'>
                    <Label>Token budget</Label>
                    <span className='text-sm text-muted-foreground'>
                      {formData.tokenBudget >= 1000
                        ? `${formData.tokenBudget / 1000}k`
                        : formData.tokenBudget}
                    </span>
                  </div>
                  <Slider
                    min={1000}
                    max={100000}
                    step={1000}
                    value={[formData.tokenBudget]}
                    onValueChange={([v]) =>
                      setFormData({ ...formData, tokenBudget: v })
                    }
                  />
                  <div className='flex justify-between text-xs text-muted-foreground'>
                    <span>1k</span>
                    <span>100k</span>
                  </div>
                </div>
                <div className='grid gap-2'>
                  <div className='flex items-center justify-between'>
                    <Label>Timeout (minutes)</Label>
                    <span className='text-sm text-muted-foreground'>
                      {formData.timeoutMinutes}
                    </span>
                  </div>
                  <Slider
                    min={1}
                    max={60}
                    step={1}
                    value={[formData.timeoutMinutes]}
                    onValueChange={([v]) =>
                      setFormData({ ...formData, timeoutMinutes: v })
                    }
                  />
                  <div className='flex justify-between text-xs text-muted-foreground'>
                    <span>1</span>
                    <span>60</span>
                  </div>
                </div>
              </div>
            </Section>

            <Section title='Model Selection'>
              <div className='grid gap-2'>
                <Label>Model</Label>
                <Select
                  value={formData.model}
                  onValueChange={v => setFormData({ ...formData, model: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODEL_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </Section>
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
