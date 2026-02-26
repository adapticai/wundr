'use client';

import { Loader2, Plus, X } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type {
  ContextConfig,
  PluginConfig,
  SkillDefinition,
} from '@/lib/validations/session-manager';

interface SessionManagerConfigPanelProps {
  sessionManagerId: string;
  orchestratorId: string;
  initialData?: {
    name: string;
    description?: string;
    pluginConfigs: PluginConfig[];
    skillDefinitions: SkillDefinition[];
    contextConfig?: ContextConfig;
    mcpTools: string[];
    maxConcurrentSubagents: number;
    tokenBudgetPerHour: number;
    isGlobal: boolean;
  };
  onSave?: () => void;
}

const PLUGIN_TYPES = [
  'MEMORY',
  'TOOL',
  'SKILL',
  'CONTEXT',
  'INTEGRATION',
  'MONITORING',
  'SECURITY',
] as const;

const CAPABILITY_LEVELS = [
  'beginner',
  'intermediate',
  'advanced',
  'expert',
] as const;

function TagInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');

  function addTag() {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInput('');
  }

  return (
    <div className='space-y-2'>
      <div className='flex gap-2'>
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder={placeholder}
        />
        <Button type='button' variant='outline' size='sm' onClick={addTag}>
          <Plus className='h-4 w-4' />
        </Button>
      </div>
      {values.length > 0 && (
        <div className='flex flex-wrap gap-1'>
          {values.map(v => (
            <Badge key={v} variant='secondary' className='gap-1'>
              {v}
              <button
                type='button'
                onClick={() => onChange(values.filter(x => x !== v))}
              >
                <X className='h-3 w-3' />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function SessionManagerConfigPanel({
  sessionManagerId,
  orchestratorId: _orchestratorId,
  initialData,
  onSave,
}: SessionManagerConfigPanelProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [general, setGeneral] = useState({
    name: initialData?.name ?? '',
    description: initialData?.description ?? '',
    maxConcurrentSubagents: initialData?.maxConcurrentSubagents ?? 20,
    tokenBudgetPerHour: initialData?.tokenBudgetPerHour ?? 100000,
    isGlobal: initialData?.isGlobal ?? false,
  });

  const [plugins, setPlugins] = useState<PluginConfig[]>(
    initialData?.pluginConfigs ?? []
  );

  const [skills, setSkills] = useState<SkillDefinition[]>(
    initialData?.skillDefinitions ?? []
  );

  const [context, setContext] = useState<ContextConfig>(
    initialData?.contextConfig ?? {}
  );

  const [mcpTools, setMcpTools] = useState<string[]>(
    initialData?.mcpTools ?? []
  );

  function addPlugin() {
    setPlugins(prev => [
      ...prev,
      {
        name: '',
        type: 'TOOL',
        version: '',
        configuration: {},
        enabled: true,
        priority: 50,
      },
    ]);
  }

  function removePlugin(index: number) {
    setPlugins(prev => prev.filter((_, i) => i !== index));
  }

  function updatePlugin(index: number, patch: Partial<PluginConfig>) {
    setPlugins(prev =>
      prev.map((p, i) => (i === index ? { ...p, ...patch } : p))
    );
  }

  function addSkill() {
    setSkills(prev => [
      ...prev,
      {
        name: '',
        description: '',
        functionName: '',
        parameters: {},
        capabilityLevel: 'intermediate',
        requiredTools: [],
        estimatedTokens: undefined,
      },
    ]);
  }

  function removeSkill(index: number) {
    setSkills(prev => prev.filter((_, i) => i !== index));
  }

  function updateSkill(index: number, patch: Partial<SkillDefinition>) {
    setSkills(prev =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
    );
  }

  async function handleSave() {
    if (!general.name) {
      toast({
        title: 'Error',
        description: 'Name is required',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/session-managers/${sessionManagerId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...general,
            pluginConfigs: plugins,
            skillDefinitions: skills,
            contextConfig: context,
            mcpTools,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to save configuration');

      toast({
        title: 'Success',
        description: 'Configuration saved successfully',
      });
      onSave?.();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to save configuration',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='space-y-4'>
      <Tabs defaultValue='general'>
        <TabsList className='grid w-full grid-cols-5'>
          <TabsTrigger value='general'>General</TabsTrigger>
          <TabsTrigger value='plugins'>Plugins</TabsTrigger>
          <TabsTrigger value='skills'>Skills</TabsTrigger>
          <TabsTrigger value='context'>Context</TabsTrigger>
          <TabsTrigger value='mcp'>MCP Tools</TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value='general' className='space-y-4 pt-4'>
          <div className='grid gap-2'>
            <Label htmlFor='name'>
              Name <span className='text-destructive'>*</span>
            </Label>
            <Input
              id='name'
              value={general.name}
              onChange={e => setGeneral({ ...general, name: e.target.value })}
              placeholder='Engineering Session Manager'
              disabled={loading}
            />
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='description'>Description</Label>
            <Textarea
              id='description'
              value={general.description}
              onChange={e =>
                setGeneral({ ...general, description: e.target.value })
              }
              placeholder='Manages engineering tasks and code development'
              rows={2}
              disabled={loading}
            />
          </div>
          <div className='grid gap-2'>
            <Label>
              Max Concurrent Subagents: {general.maxConcurrentSubagents}
            </Label>
            <Slider
              value={[general.maxConcurrentSubagents]}
              onValueChange={([v]) =>
                setGeneral({ ...general, maxConcurrentSubagents: v })
              }
              min={1}
              max={50}
              step={1}
              disabled={loading}
            />
          </div>
          <div className='grid gap-2'>
            <Label>
              Token Budget Per Hour:{' '}
              {general.tokenBudgetPerHour.toLocaleString()}
            </Label>
            <Slider
              value={[general.tokenBudgetPerHour]}
              onValueChange={([v]) =>
                setGeneral({ ...general, tokenBudgetPerHour: v })
              }
              min={10000}
              max={500000}
              step={10000}
              disabled={loading}
            />
          </div>
          <div className='flex items-center justify-between'>
            <Label htmlFor='isGlobal'>
              Global (available to all orchestrators)
            </Label>
            <Switch
              id='isGlobal'
              checked={general.isGlobal}
              onCheckedChange={checked =>
                setGeneral({ ...general, isGlobal: checked })
              }
              disabled={loading}
            />
          </div>
        </TabsContent>

        {/* Plugins Tab */}
        <TabsContent value='plugins' className='space-y-4 pt-4'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={addPlugin}
            disabled={loading}
          >
            <Plus className='mr-2 h-4 w-4' /> Add Plugin
          </Button>
          {plugins.map((plugin, i) => (
            <Card key={i}>
              <CardHeader className='flex flex-row items-center justify-between pb-2 pt-3 px-4'>
                <CardTitle className='text-sm font-medium'>
                  Plugin {i + 1}
                </CardTitle>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={() => removePlugin(i)}
                >
                  <X className='h-4 w-4' />
                </Button>
              </CardHeader>
              <CardContent className='space-y-3 px-4 pb-4'>
                <div className='grid grid-cols-2 gap-3'>
                  <div className='grid gap-1'>
                    <Label>Name</Label>
                    <Input
                      value={plugin.name}
                      onChange={e => updatePlugin(i, { name: e.target.value })}
                      placeholder='my-plugin'
                    />
                  </div>
                  <div className='grid gap-1'>
                    <Label>Type</Label>
                    <Select
                      value={plugin.type}
                      onValueChange={v =>
                        updatePlugin(i, { type: v as PluginConfig['type'] })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PLUGIN_TYPES.map(t => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className='grid grid-cols-2 gap-3'>
                  <div className='grid gap-1'>
                    <Label>Version</Label>
                    <Input
                      value={plugin.version ?? ''}
                      placeholder='1.0.0'
                      onChange={e =>
                        updatePlugin(i, { version: e.target.value })
                      }
                    />
                  </div>
                  <div className='flex items-center justify-between pt-5'>
                    <Label>Enabled</Label>
                    <Switch
                      checked={plugin.enabled}
                      onCheckedChange={checked =>
                        updatePlugin(i, { enabled: checked })
                      }
                    />
                  </div>
                </div>
                <div className='grid gap-1'>
                  <Label>Priority: {plugin.priority}</Label>
                  <Slider
                    value={[plugin.priority]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={([v]) => updatePlugin(i, { priority: v })}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Skills Tab */}
        <TabsContent value='skills' className='space-y-4 pt-4'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={addSkill}
            disabled={loading}
          >
            <Plus className='mr-2 h-4 w-4' /> Add Skill
          </Button>
          {skills.map((skill, i) => (
            <Card key={i}>
              <CardHeader className='flex flex-row items-center justify-between pb-2 pt-3 px-4'>
                <CardTitle className='text-sm font-medium'>
                  Skill {i + 1}
                </CardTitle>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={() => removeSkill(i)}
                >
                  <X className='h-4 w-4' />
                </Button>
              </CardHeader>
              <CardContent className='space-y-3 px-4 pb-4'>
                <div className='grid grid-cols-2 gap-3'>
                  <div className='grid gap-1'>
                    <Label>Name</Label>
                    <Input
                      value={skill.name}
                      placeholder='code-review'
                      onChange={e => updateSkill(i, { name: e.target.value })}
                    />
                  </div>
                  <div className='grid gap-1'>
                    <Label>Function Name</Label>
                    <Input
                      value={skill.functionName}
                      placeholder='performCodeReview'
                      onChange={e =>
                        updateSkill(i, { functionName: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className='grid gap-1'>
                  <Label>Description</Label>
                  <Textarea
                    value={skill.description}
                    rows={2}
                    placeholder='Reviews code for quality and correctness'
                    onChange={e =>
                      updateSkill(i, { description: e.target.value })
                    }
                  />
                </div>
                <div className='grid grid-cols-2 gap-3'>
                  <div className='grid gap-1'>
                    <Label>Capability Level</Label>
                    <Select
                      value={skill.capabilityLevel}
                      onValueChange={v =>
                        updateSkill(i, {
                          capabilityLevel:
                            v as SkillDefinition['capabilityLevel'],
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CAPABILITY_LEVELS.map(l => (
                          <SelectItem key={l} value={l}>
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='grid gap-1'>
                    <Label>Estimated Tokens</Label>
                    <Input
                      type='number'
                      value={skill.estimatedTokens ?? ''}
                      placeholder='1000'
                      onChange={e =>
                        updateSkill(i, {
                          estimatedTokens: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        })
                      }
                    />
                  </div>
                </div>
                <div className='grid gap-1'>
                  <Label>Required Tools</Label>
                  <TagInput
                    values={skill.requiredTools}
                    placeholder='Add tool name'
                    onChange={v => updateSkill(i, { requiredTools: v })}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Context Tab */}
        <TabsContent value='context' className='space-y-4 pt-4'>
          <div className='grid gap-2'>
            <Label>System Prompt</Label>
            <Textarea
              value={context.systemPrompt ?? ''}
              onChange={e =>
                setContext({ ...context, systemPrompt: e.target.value })
              }
              placeholder='You are a helpful assistant...'
              rows={4}
              disabled={loading}
            />
          </div>
          <div className='grid gap-2'>
            <Label>CLAUDE.md Content</Label>
            <Textarea
              value={context.claudeMdContent ?? ''}
              onChange={e =>
                setContext({ ...context, claudeMdContent: e.target.value })
              }
              placeholder='# Project instructions...'
              rows={4}
              className='font-mono text-sm'
              disabled={loading}
            />
          </div>
          <div className='grid gap-2'>
            <Label>Workspace Context</Label>
            <Textarea
              value={context.workspaceContext ?? ''}
              rows={3}
              disabled={loading}
              onChange={e =>
                setContext({ ...context, workspaceContext: e.target.value })
              }
            />
          </div>
          <div className='grid gap-2'>
            <Label>Custom Instructions</Label>
            <Textarea
              value={context.customInstructions ?? ''}
              rows={3}
              disabled={loading}
              onChange={e =>
                setContext({ ...context, customInstructions: e.target.value })
              }
            />
          </div>
          <div className='grid gap-2'>
            <Label>File Patterns</Label>
            <TagInput
              values={context.filePatterns ?? []}
              placeholder='**/*.ts'
              onChange={v => setContext({ ...context, filePatterns: v })}
            />
          </div>
          <div className='grid gap-2'>
            <Label>Exclude Patterns</Label>
            <TagInput
              values={context.excludePatterns ?? []}
              placeholder='node_modules/**'
              onChange={v => setContext({ ...context, excludePatterns: v })}
            />
          </div>
          <div className='grid gap-2'>
            <Label>Environment Variables</Label>
            <div className='space-y-2'>
              {Object.entries(context.environmentVariables ?? {}).map(
                ([key, value]) => (
                  <div key={key} className='flex gap-2 items-center'>
                    <Input value={key} readOnly className='flex-1' />
                    <Input
                      value={value}
                      className='flex-1'
                      onChange={e =>
                        setContext({
                          ...context,
                          environmentVariables: {
                            ...(context.environmentVariables ?? {}),
                            [key]: e.target.value,
                          },
                        })
                      }
                    />
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={() => {
                        const next = {
                          ...(context.environmentVariables ?? {}),
                        };
                        delete next[key];
                        setContext({ ...context, environmentVariables: next });
                      }}
                    >
                      <X className='h-4 w-4' />
                    </Button>
                  </div>
                )
              )}
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => {
                  const key = `VAR_${Date.now()}`;
                  setContext({
                    ...context,
                    environmentVariables: {
                      ...(context.environmentVariables ?? {}),
                      [key]: '',
                    },
                  });
                }}
              >
                <Plus className='mr-2 h-4 w-4' /> Add Variable
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* MCP Tools Tab */}
        <TabsContent value='mcp' className='space-y-4 pt-4'>
          <div className='space-y-2'>
            {mcpTools.map((tool, i) => (
              <div key={i} className='flex gap-2 items-center'>
                <Input
                  value={tool}
                  onChange={e =>
                    setMcpTools(prev =>
                      prev.map((t, idx) => (idx === i ? e.target.value : t))
                    )
                  }
                  placeholder='mcp__tool-name'
                />
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={() =>
                    setMcpTools(prev => prev.filter((_, idx) => idx !== i))
                  }
                >
                  <X className='h-4 w-4' />
                </Button>
              </div>
            ))}
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => setMcpTools(prev => [...prev, ''])}
              disabled={loading}
            >
              <Plus className='mr-2 h-4 w-4' /> Add MCP Tool
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <div className='flex justify-end pt-2'>
        <Button onClick={handleSave} disabled={loading}>
          {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
          Save Configuration
        </Button>
      </div>
    </div>
  );
}

export default SessionManagerConfigPanel;
