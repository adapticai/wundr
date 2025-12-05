'use client';

import { useState, useCallback, useEffect } from 'react';

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
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  AGENT_TYPE_METADATA,
  AVAILABLE_TOOLS,
  DEFAULT_MODEL_CONFIGS,
} from '@/types/agent';

import type { CreateAgentInput, AgentType, AvailableTool } from '@/types/agent';

interface CreateAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (input: CreateAgentInput) => Promise<void>;
  isLoading?: boolean;
}

const AGENT_TYPES: AgentType[] = [
  'task',
  'research',
  'coding',
  'data',
  'qa',
  'support',
  'custom',
];

const AVAILABLE_MODELS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'claude-3-opus', label: 'Claude 3 Opus' },
  { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
  { value: 'claude-3-haiku', label: 'Claude 3 Haiku' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
] as const;

export function CreateAgentModal({
  isOpen,
  onClose,
  onCreate,
  isLoading = false,
}: CreateAgentModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AgentType>('task');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('claude-3-haiku');
  const [temperature, setTemperature] = useState(0.5);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [selectedTools, setSelectedTools] = useState<AvailableTool[]>([]);

  const resetForm = useCallback(() => {
    setName('');
    setType('task');
    setDescription('');
    setSystemPrompt('');
    setSelectedModel('claude-3-haiku');
    setTemperature(0.5);
    setMaxTokens(2048);
    setSelectedTools([]);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleTypeChange = useCallback((newType: AgentType) => {
    setType(newType);
    const defaultConfig = DEFAULT_MODEL_CONFIGS[newType];
    setSelectedModel(defaultConfig.model);
    setTemperature(defaultConfig.temperature);
    setMaxTokens(defaultConfig.maxTokens);
  }, []);

  const handleToolToggle = useCallback((tool: AvailableTool) => {
    setSelectedTools(prev =>
      prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool]
    );
  }, []);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      console.error('Agent name is required');
      return;
    }

    if (maxTokens < 256 || maxTokens > 32000) {
      console.error('Max tokens must be between 256 and 32000');
      return;
    }

    try {
      const input: CreateAgentInput = {
        name: name.trim(),
        type,
        description: description.trim() || undefined,
        config: {
          model: selectedModel,
          temperature,
          maxTokens,
        },
        systemPrompt: systemPrompt.trim() || undefined,
        tools: selectedTools.length > 0 ? selectedTools : undefined,
      };

      await onCreate(input);
      handleClose();
    } catch (error) {
      console.error('Failed to create agent:', error);
    }
  }, [
    name,
    type,
    description,
    selectedModel,
    temperature,
    maxTokens,
    systemPrompt,
    selectedTools,
    onCreate,
    handleClose,
  ]);

  const canCreate = name.trim().length > 0;

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, handleClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'
      onClick={handleClose}
      role='dialog'
      aria-modal='true'
      aria-labelledby='create-agent-title'
    >
      <div
        className='w-full max-w-2xl rounded-lg bg-card shadow-lg'
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className='border-b px-6 py-4'>
          <div className='flex items-center justify-between'>
            <h2
              id='create-agent-title'
              className='text-lg font-semibold text-foreground'
            >
              Create New Agent
            </h2>
            <button
              type='button'
              onClick={handleClose}
              className='rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground'
              aria-label='Close dialog'
            >
              <XIcon className='h-5 w-5' />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className='max-h-[70vh] overflow-y-auto px-6 py-6'>
          <div className='space-y-4'>
            {/* Name */}
            <div>
              <Label htmlFor='agent-name'>
                Agent Name <span className='text-red-500'>*</span>
              </Label>
              <Input
                id='agent-name'
                type='text'
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder='e.g., Code Reviewer'
                disabled={isLoading}
              />
            </div>

            {/* Type */}
            <div>
              <Label htmlFor='agent-type'>
                Agent Type <span className='text-red-500'>*</span>
              </Label>
              <Select
                value={type}
                onValueChange={handleTypeChange}
                disabled={isLoading}
              >
                <SelectTrigger id='agent-type'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGENT_TYPES.map(agentType => {
                    const metadata = AGENT_TYPE_METADATA[agentType];
                    return (
                      <SelectItem key={agentType} value={agentType}>
                        <span className='flex items-center gap-2'>
                          <span>{metadata.icon}</span>
                          <span>{metadata.label}</span>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className='mt-1 text-xs text-muted-foreground'>
                {AGENT_TYPE_METADATA[type].description}
              </p>
            </div>

            {/* Description */}
            <div>
              <Label htmlFor='agent-description'>Description</Label>
              <Textarea
                id='agent-description'
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Briefly describe this agent's purpose..."
                rows={2}
                disabled={isLoading}
              />
            </div>

            {/* Model Configuration */}
            <div className='space-y-3 rounded-lg border border-border bg-background p-4'>
              <h3 className='text-sm font-medium text-foreground'>
                Model Configuration
              </h3>

              <div>
                <Label htmlFor='agent-model'>Model</Label>
                <Select
                  value={selectedModel}
                  onValueChange={setSelectedModel}
                  disabled={isLoading}
                >
                  <SelectTrigger id='agent-model'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_MODELS.map(model => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <Label htmlFor='agent-temperature'>
                    Temperature: {temperature.toFixed(1)}
                  </Label>
                  <input
                    id='agent-temperature'
                    type='range'
                    min='0'
                    max='1'
                    step='0.1'
                    value={temperature}
                    onChange={e => setTemperature(parseFloat(e.target.value))}
                    disabled={isLoading}
                    className='w-full'
                  />
                  <p className='mt-1 text-xs text-muted-foreground'>
                    Higher = more creative, lower = more focused
                  </p>
                </div>

                <div>
                  <Label htmlFor='agent-max-tokens'>Max Tokens</Label>
                  <Input
                    id='agent-max-tokens'
                    type='number'
                    min='256'
                    max='32000'
                    step='256'
                    value={maxTokens}
                    onChange={e => {
                      const value = parseInt(e.target.value, 10);
                      if (!isNaN(value)) {
                        setMaxTokens(value);
                      }
                    }}
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>

            {/* System Prompt */}
            <div>
              <Label htmlFor='agent-system-prompt'>System Prompt</Label>
              <Textarea
                id='agent-system-prompt'
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                placeholder="Define the agent's role and behavior..."
                rows={3}
                disabled={isLoading}
              />
              <p className='mt-1 text-xs text-muted-foreground'>
                Leave empty to use the default prompt for this agent type
              </p>
            </div>

            {/* Tools */}
            <div>
              <Label>Available Tools</Label>
              <div className='mt-2 grid grid-cols-2 gap-2'>
                {AVAILABLE_TOOLS.map(tool => (
                  <button
                    key={tool}
                    type='button'
                    onClick={() => handleToolToggle(tool)}
                    disabled={isLoading}
                    className={cn(
                      'rounded-md border px-3 py-2 text-sm transition-colors',
                      selectedTools.includes(tool)
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-foreground hover:border-primary hover:bg-accent'
                    )}
                  >
                    {tool.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className='flex items-center justify-end gap-2 border-t px-6 py-4'>
          <Button variant='outline' onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!canCreate || isLoading}>
            {isLoading ? 'Creating...' : 'Create Agent'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function XIcon({ className }: { className?: string }) {
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
      <path d='M18 6 6 18' />
      <path d='m6 6 12 12' />
    </svg>
  );
}
