'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  AGENT_TYPE_METADATA,
  AVAILABLE_TOOLS,
  DEFAULT_MODEL_CONFIGS,
} from '@/types/agent';

import type { Capability } from './capability-badges';
import type { AgentType, AvailableTool } from '@/types/agent';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AGENT_TYPES: AgentType[] = [
  'task',
  'research',
  'coding',
  'data',
  'qa',
  'support',
  'custom',
];

const AVAILABLE_MODELS = [
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6', tier: 'opus' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', tier: 'sonnet' },
  {
    value: 'claude-haiku-4-5-20251001',
    label: 'Claude Haiku 4.5',
    tier: 'haiku',
  },
] as const;

const MODEL_BADGE_COLORS: Record<string, string> = {
  opus: 'bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400',
  sonnet: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400',
  haiku:
    'bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400',
};

const TOOL_LABELS: Record<AvailableTool, string> = {
  web_search: 'Web Search',
  code_execution: 'Code Execution',
  file_operations: 'File Operations',
  data_analysis: 'Data Analysis',
  api_calls: 'API Calls',
  database_query: 'Database Query',
  image_generation: 'Image Generation',
  text_analysis: 'Text Analysis',
  translation: 'Translation',
  summarization: 'Summarization',
};

const CAPABILITY_LABELS: Record<Capability, string> = {
  canReadFiles: 'Read Files',
  canWriteFiles: 'Write Files',
  canExecuteCommands: 'Execute Commands',
  canAccessNetwork: 'Network Access',
  canSpawnSubAgents: 'Spawn Sub-Agents',
};

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

export const agentEditorSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  type: z.enum([
    'task',
    'research',
    'coding',
    'data',
    'qa',
    'support',
    'custom',
  ] as const),
  description: z.string().max(500, 'Description is too long').optional(),
  systemPrompt: z.string().optional(),
  model: z.string().min(1, 'Model is required'),
  temperature: z.number().min(0).max(1),
  maxTokens: z.number().int().min(256).max(32000),
  tools: z.array(z.string()),
  capabilities: z.object({
    canReadFiles: z.boolean(),
    canWriteFiles: z.boolean(),
    canExecuteCommands: z.boolean(),
    canAccessNetwork: z.boolean(),
    canSpawnSubAgents: z.boolean(),
  }),
  tags: z.array(z.string()),
  status: z.enum(['active', 'paused', 'inactive'] as const).optional(),
});

export type AgentEditorValues = z.infer<typeof agentEditorSchema>;

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

export const DEFAULT_CAPABILITIES: AgentEditorValues['capabilities'] = {
  canReadFiles: false,
  canWriteFiles: false,
  canExecuteCommands: false,
  canAccessNetwork: false,
  canSpawnSubAgents: false,
};

export function buildDefaultValues(
  partial?: Partial<AgentEditorValues>
): AgentEditorValues {
  const type: AgentType = (partial?.type as AgentType) ?? 'task';
  const defaultConfig = DEFAULT_MODEL_CONFIGS[type];
  return {
    name: '',
    type,
    description: '',
    systemPrompt: '',
    model: defaultConfig.model,
    temperature: defaultConfig.temperature,
    maxTokens: defaultConfig.maxTokens,
    tools: [],
    capabilities: DEFAULT_CAPABILITIES,
    tags: [],
    status: 'active',
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ToolSelector({
  selected,
  onChange,
  disabled,
}: {
  selected: string[];
  onChange: (tools: string[]) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState('');

  const filtered = AVAILABLE_TOOLS.filter(tool =>
    TOOL_LABELS[tool].toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (tool: AvailableTool) => {
    onChange(
      selected.includes(tool)
        ? selected.filter(t => t !== tool)
        : [...selected, tool]
    );
  };

  return (
    <div className='space-y-2'>
      <div className='relative'>
        <SearchIcon className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
        <Input
          placeholder='Search tools...'
          value={search}
          onChange={e => setSearch(e.target.value)}
          className='pl-9'
          disabled={disabled}
        />
      </div>
      <div className='grid grid-cols-2 gap-2'>
        {filtered.map(tool => {
          const isSelected = selected.includes(tool);
          return (
            <button
              key={tool}
              type='button'
              disabled={disabled}
              onClick={() => toggle(tool)}
              className={cn(
                'flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors',
                isSelected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-accent'
              )}
            >
              <span>{TOOL_LABELS[tool]}</span>
              {isSelected && <CheckIcon className='h-3.5 w-3.5 shrink-0' />}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <p className='text-xs text-muted-foreground'>
          {selected.length} tool{selected.length !== 1 ? 's' : ''} selected
        </p>
      )}
    </div>
  );
}

function TagInput({
  tags,
  onChange,
  disabled,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}) {
  const [input, setInput] = useState('');

  const addTag = useCallback(
    (value: string) => {
      const tag = value.trim().toLowerCase().replace(/\s+/g, '-');
      if (tag && !tags.includes(tag)) {
        onChange([...tags, tag]);
      }
      setInput('');
    },
    [tags, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter(t => t !== tag));
  };

  return (
    <div className='space-y-2'>
      <div className='flex flex-wrap gap-1.5 rounded-md border border-input bg-background px-3 py-2 min-h-9 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2'>
        {tags.map(tag => (
          <Badge key={tag} variant='secondary' className='gap-1'>
            {tag}
            <button
              type='button'
              disabled={disabled}
              onClick={() => removeTag(tag)}
              className='ml-0.5 rounded-full hover:bg-muted-foreground/20'
            >
              <XSmallIcon className='h-3 w-3' />
            </button>
          </Badge>
        ))}
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => input && addTag(input)}
          placeholder={tags.length === 0 ? 'Add tags...' : ''}
          disabled={disabled}
          className='flex-1 min-w-20 bg-transparent text-sm outline-none placeholder:text-muted-foreground'
        />
      </div>
      <p className='text-xs text-muted-foreground'>
        Press Enter or comma to add a tag
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface AgentEditorProps {
  defaultValues?: Partial<AgentEditorValues>;
  onSubmit: (values: AgentEditorValues) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  submitLabel?: string;
  /** Show the status field (useful in edit mode) */
  showStatus?: boolean;
}

/**
 * AgentEditor is a full-featured form for creating or editing an agent.
 * It uses React Hook Form + Zod for validation.
 */
export function AgentEditor({
  defaultValues,
  onSubmit,
  onCancel,
  isLoading = false,
  submitLabel = 'Save',
  showStatus = false,
}: AgentEditorProps) {
  const [activeTab, setActiveTab] = useState<
    'basic' | 'model' | 'tools' | 'capabilities' | 'tags'
  >('basic');

  const form = useForm<AgentEditorValues>({
    resolver: zodResolver(agentEditorSchema),
    defaultValues: buildDefaultValues(defaultValues),
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = form;

  const watchedType = watch('type') as AgentType;
  const watchedModel = watch('model');
  const watchedTemperature = watch('temperature');
  const watchedTools = watch('tools');
  const watchedCapabilities = watch('capabilities');
  const watchedTags = watch('tags');

  // When type changes, update model defaults
  const handleTypeChange = useCallback(
    (newType: string) => {
      const type = newType as AgentType;
      setValue('type', type);
      const defaults = DEFAULT_MODEL_CONFIGS[type];
      setValue('model', defaults.model);
      setValue('temperature', defaults.temperature);
      setValue('maxTokens', defaults.maxTokens);
    },
    [setValue]
  );

  const modelTier =
    AVAILABLE_MODELS.find(m => m.value === watchedModel)?.tier ?? 'haiku';

  const tabs = [
    { id: 'basic' as const, label: 'Basic' },
    { id: 'model' as const, label: 'Model' },
    {
      id: 'tools' as const,
      label: `Tools${watchedTools.length > 0 ? ` (${watchedTools.length})` : ''}`,
    },
    { id: 'capabilities' as const, label: 'Capabilities' },
    {
      id: 'tags' as const,
      label: `Tags${watchedTags.length > 0 ? ` (${watchedTags.length})` : ''}`,
    },
  ];

  const handleFormSubmit = handleSubmit(async values => {
    await onSubmit(values);
  });

  return (
    <form onSubmit={handleFormSubmit} className='flex flex-col gap-6'>
      {/* Tab navigation */}
      <div className='flex gap-1 rounded-lg bg-muted p-1'>
        {tabs.map(tab => (
          <button
            key={tab.id}
            type='button'
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Basic */}
      {activeTab === 'basic' && (
        <div className='space-y-4'>
          <div className='space-y-1.5'>
            <Label htmlFor='agent-name'>
              Name <span className='text-red-500'>*</span>
            </Label>
            <Input
              id='agent-name'
              placeholder='e.g., Code Reviewer'
              disabled={isLoading}
              {...register('name')}
            />
            {errors.name && (
              <p className='text-xs text-red-500'>{errors.name.message}</p>
            )}
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='agent-type'>Type</Label>
            <Select
              value={watchedType}
              onValueChange={handleTypeChange}
              disabled={isLoading}
            >
              <SelectTrigger id='agent-type'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGENT_TYPES.map(t => (
                  <SelectItem key={t} value={t}>
                    <span className='flex items-center gap-2'>
                      <span>{AGENT_TYPE_METADATA[t].icon}</span>
                      <span>{AGENT_TYPE_METADATA[t].label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className='text-xs text-muted-foreground'>
              {AGENT_TYPE_METADATA[watchedType]?.description}
            </p>
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='agent-description'>Description</Label>
            <Textarea
              id='agent-description'
              placeholder="Briefly describe this agent's purpose..."
              rows={2}
              disabled={isLoading}
              {...register('description')}
            />
            {errors.description && (
              <p className='text-xs text-red-500'>
                {errors.description.message}
              </p>
            )}
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='agent-system-prompt'>Charter (System Prompt)</Label>
            <Textarea
              id='agent-system-prompt'
              placeholder="Define the agent's role, behaviour, and boundaries..."
              rows={6}
              disabled={isLoading}
              className='font-mono text-sm'
              {...register('systemPrompt')}
            />
            <p className='text-xs text-muted-foreground'>
              Leave empty to use the default prompt for this agent type.
            </p>
          </div>

          {showStatus && (
            <div className='space-y-1.5'>
              <Label htmlFor='agent-status'>Status</Label>
              <Select
                value={watch('status') ?? 'active'}
                onValueChange={v =>
                  setValue('status', v as 'active' | 'paused' | 'inactive')
                }
                disabled={isLoading}
              >
                <SelectTrigger id='agent-status'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='active'>Active</SelectItem>
                  <SelectItem value='paused'>Paused</SelectItem>
                  <SelectItem value='inactive'>Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {/* Tab: Model */}
      {activeTab === 'model' && (
        <div className='space-y-4'>
          <div className='space-y-1.5'>
            <Label htmlFor='agent-model'>Model</Label>
            <Select
              value={watchedModel}
              onValueChange={v => setValue('model', v)}
              disabled={isLoading}
            >
              <SelectTrigger id='agent-model'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_MODELS.map(m => (
                  <SelectItem key={m.value} value={m.value}>
                    <span className='flex items-center gap-2'>
                      <Badge
                        variant='outline'
                        className={cn('text-xs', MODEL_BADGE_COLORS[m.tier])}
                      >
                        {m.tier}
                      </Badge>
                      {m.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className='text-xs text-muted-foreground'>
              Current:{' '}
              <Badge
                variant='outline'
                className={cn('text-xs', MODEL_BADGE_COLORS[modelTier])}
              >
                {modelTier}
              </Badge>
            </p>
          </div>

          <div className='space-y-1.5'>
            <div className='flex items-center justify-between'>
              <Label htmlFor='agent-temperature'>Temperature</Label>
              <span className='text-sm font-medium tabular-nums'>
                {watchedTemperature.toFixed(2)}
              </span>
            </div>
            <input
              id='agent-temperature'
              type='range'
              min='0'
              max='1'
              step='0.01'
              value={watchedTemperature}
              onChange={e =>
                setValue('temperature', parseFloat(e.target.value))
              }
              disabled={isLoading}
              className='w-full accent-primary'
            />
            <div className='flex justify-between text-xs text-muted-foreground'>
              <span>Deterministic</span>
              <span>Creative</span>
            </div>
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='agent-max-tokens'>Max Tokens</Label>
            <Input
              id='agent-max-tokens'
              type='number'
              min='256'
              max='32000'
              step='256'
              disabled={isLoading}
              {...register('maxTokens', { valueAsNumber: true })}
            />
            {errors.maxTokens && (
              <p className='text-xs text-red-500'>{errors.maxTokens.message}</p>
            )}
            <p className='text-xs text-muted-foreground'>
              Range: 256 – 32,000 tokens
            </p>
          </div>
        </div>
      )}

      {/* Tab: Tools */}
      {activeTab === 'tools' && (
        <div className='space-y-2'>
          <p className='text-sm text-muted-foreground'>
            Select the tools this agent is allowed to use.
          </p>
          <ToolSelector
            selected={watchedTools}
            onChange={tools => setValue('tools', tools)}
            disabled={isLoading}
          />
        </div>
      )}

      {/* Tab: Capabilities */}
      {activeTab === 'capabilities' && (
        <div className='space-y-3'>
          <p className='text-sm text-muted-foreground'>
            Toggle the permissions granted to this agent.
          </p>
          {(Object.keys(watchedCapabilities) as Capability[]).map(cap => (
            <div
              key={cap}
              className='flex items-center justify-between rounded-lg border border-border bg-card p-3'
            >
              <div>
                <p className='text-sm font-medium text-foreground'>
                  {CAPABILITY_LABELS[cap]}
                </p>
              </div>
              <Switch
                checked={watchedCapabilities[cap]}
                onCheckedChange={checked =>
                  setValue('capabilities', {
                    ...watchedCapabilities,
                    [cap]: checked,
                  })
                }
                disabled={isLoading}
                aria-label={CAPABILITY_LABELS[cap]}
              />
            </div>
          ))}
        </div>
      )}

      {/* Tab: Tags */}
      {activeTab === 'tags' && (
        <div className='space-y-2'>
          <p className='text-sm text-muted-foreground'>
            Tags help with agent discovery and organisation.
          </p>
          <TagInput
            tags={watchedTags}
            onChange={tags => setValue('tags', tags)}
            disabled={isLoading}
          />
        </div>
      )}

      {/* Footer actions */}
      <div className='flex items-center justify-end gap-2 border-t border-border pt-4'>
        {onCancel && (
          <Button
            type='button'
            variant='outline'
            onClick={onCancel}
            disabled={isLoading}
          >
            Discard
          </Button>
        )}
        <Button
          type='submit'
          disabled={isLoading || (!isDirty && !!defaultValues)}
        >
          {isLoading ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2.5'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <polyline points='20 6 9 17 4 12' />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <circle cx='11' cy='11' r='8' />
      <line x1='21' y1='21' x2='16.65' y2='16.65' />
    </svg>
  );
}

function XSmallIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2.5'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M18 6 6 18' />
      <path d='m6 6 12 12' />
    </svg>
  );
}
