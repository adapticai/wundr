'use client';

import { useState, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { AGENT_TYPE_METADATA, AVAILABLE_TOOLS } from '@/types/agent';

import type {
  Agent,
  AgentType,
  UpdateAgentInput,
  AvailableTool,
} from '@/types/agent';

interface AgentDetailPanelProps {
  agent: Agent;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, input: UpdateAgentInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isLoading?: boolean;
}

export function AgentDetailPanel({
  agent,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  isLoading = false,
}: AgentDetailPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [name, setName] = useState(agent.name);
  const [type, setType] = useState(agent.type);
  const [description, setDescription] = useState(agent.description);
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt);
  const [temperature, setTemperature] = useState(agent.config.temperature);
  const [maxTokens, setMaxTokens] = useState(agent.config.maxTokens);
  const [selectedTools, setSelectedTools] = useState<AvailableTool[]>(
    agent.tools
  );

  const handleSave = async () => {
    if (!name.trim()) {
      console.error('Agent name is required');
      return;
    }

    if (maxTokens < 256 || maxTokens > 32000) {
      console.error('Max tokens must be between 256 and 32000');
      return;
    }

    try {
      const input: UpdateAgentInput = {
        name: name.trim(),
        type: type as AgentType,
        description: description.trim() || undefined,
        systemPrompt: systemPrompt.trim() || undefined,
        config: {
          temperature,
          maxTokens,
        },
        tools: selectedTools,
      };

      await onUpdate(agent.id, input);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update agent:', error);
    }
  };

  const handleCancel = () => {
    setName(agent.name);
    setType(agent.type);
    setDescription(agent.description);
    setSystemPrompt(agent.systemPrompt);
    setTemperature(agent.config.temperature);
    setMaxTokens(agent.config.maxTokens);
    setSelectedTools(agent.tools);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    try {
      await onDelete(agent.id);
      setShowDeleteConfirm(false);
      onClose();
    } catch (error) {
      console.error('Failed to delete agent:', error);
      setShowDeleteConfirm(false);
    }
  };

  const handleToolToggle = (tool: AvailableTool) => {
    setSelectedTools(prev =>
      prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool]
    );
  };

  // Handle Escape key to close panel
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const metadata = AGENT_TYPE_METADATA[agent.type];

  if (!metadata) {
    console.error(`Unknown agent type: ${agent.type}`);
    return null;
  }

  const statusColor = {
    active: 'bg-green-500/10 text-green-500 border-green-500/20',
    paused: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    inactive: 'bg-stone-500/10 text-stone-500 border-stone-500/20',
  }[agent.status];

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-end bg-black/50'
      onClick={onClose}
      role='dialog'
      aria-modal='true'
      aria-labelledby='agent-detail-title'
    >
      <div
        className='h-full w-full max-w-2xl bg-card shadow-lg'
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className='border-b px-6 py-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-stone-800 text-xl'>
                {metadata.icon}
              </div>
              <div>
                <h2
                  id='agent-detail-title'
                  className='text-lg font-semibold text-foreground'
                >
                  {isEditing ? 'Edit Agent' : agent.name}
                </h2>
                <p className='text-sm text-muted-foreground'>
                  {metadata.label}
                </p>
              </div>
            </div>
            <button
              type='button'
              onClick={onClose}
              className='rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground'
              aria-label='Close panel'
            >
              <XIcon className='h-5 w-5' />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className='h-[calc(100%-140px)] overflow-y-auto px-6 py-6'>
          {!isEditing ? (
            <div className='space-y-6'>
              {/* Status */}
              <div>
                <Badge variant='outline' className={statusColor}>
                  {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                </Badge>
              </div>

              {/* Description */}
              {agent.description && (
                <div>
                  <h3 className='mb-2 text-sm font-medium text-foreground'>
                    Description
                  </h3>
                  <p className='text-sm text-muted-foreground'>
                    {agent.description}
                  </p>
                </div>
              )}

              {/* Stats */}
              <div>
                <h3 className='mb-3 text-sm font-medium text-foreground'>
                  Performance
                </h3>
                <div className='grid grid-cols-2 gap-4'>
                  <div className='rounded-lg border border-border bg-background p-3'>
                    <p className='text-2xl font-semibold text-foreground'>
                      {agent.stats.tasksCompleted}
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      Tasks Completed
                    </p>
                  </div>
                  <div className='rounded-lg border border-border bg-background p-3'>
                    <p className='text-2xl font-semibold text-foreground'>
                      {agent.stats.successRate}%
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      Success Rate
                    </p>
                  </div>
                  <div className='rounded-lg border border-border bg-background p-3'>
                    <p className='text-2xl font-semibold text-foreground'>
                      {agent.stats.avgResponseTime > 0
                        ? `${Math.round(agent.stats.avgResponseTime / 1000)}s`
                        : '-'}
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      Avg Response Time
                    </p>
                  </div>
                  <div className='rounded-lg border border-border bg-background p-3'>
                    <p className='text-2xl font-semibold text-foreground'>
                      {agent.stats.lastActive
                        ? new Date(agent.stats.lastActive).toLocaleDateString()
                        : 'Never'}
                    </p>
                    <p className='text-xs text-muted-foreground'>Last Active</p>
                  </div>
                </div>
              </div>

              {/* Configuration */}
              <div>
                <h3 className='mb-3 text-sm font-medium text-foreground'>
                  Configuration
                </h3>
                <div className='space-y-2 rounded-lg border border-border bg-background p-4 text-sm'>
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Model</span>
                    <span className='font-medium text-foreground'>
                      {agent.config.model}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Temperature</span>
                    <span className='font-medium text-foreground'>
                      {agent.config.temperature.toFixed(1)}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Max Tokens</span>
                    <span className='font-medium text-foreground'>
                      {agent.config.maxTokens}
                    </span>
                  </div>
                </div>
              </div>

              {/* System Prompt */}
              {agent.systemPrompt && (
                <div>
                  <h3 className='mb-2 text-sm font-medium text-foreground'>
                    System Prompt
                  </h3>
                  <div className='rounded-lg border border-border bg-background p-4'>
                    <p className='whitespace-pre-wrap text-sm text-muted-foreground'>
                      {agent.systemPrompt}
                    </p>
                  </div>
                </div>
              )}

              {/* Tools */}
              {agent.tools.length > 0 && (
                <div>
                  <h3 className='mb-2 text-sm font-medium text-foreground'>
                    Available Tools
                  </h3>
                  <div className='flex flex-wrap gap-2'>
                    {agent.tools.map(tool => (
                      <Badge key={tool} variant='secondary'>
                        {tool.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className='space-y-4'>
              {/* Edit Form */}
              <div>
                <Label htmlFor='edit-name'>Agent Name</Label>
                <Input
                  id='edit-name'
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div>
                <Label htmlFor='edit-description'>Description</Label>
                <Textarea
                  id='edit-description'
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  disabled={isLoading}
                />
              </div>

              <div>
                <Label htmlFor='edit-system-prompt'>System Prompt</Label>
                <Textarea
                  id='edit-system-prompt'
                  value={systemPrompt}
                  onChange={e => setSystemPrompt(e.target.value)}
                  rows={4}
                  disabled={isLoading}
                />
              </div>

              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <Label htmlFor='edit-temperature'>
                    Temperature: {temperature.toFixed(1)}
                  </Label>
                  <input
                    id='edit-temperature'
                    type='range'
                    min='0'
                    max='1'
                    step='0.1'
                    value={temperature}
                    onChange={e => setTemperature(parseFloat(e.target.value))}
                    disabled={isLoading}
                    className='w-full'
                  />
                </div>

                <div>
                  <Label htmlFor='edit-max-tokens'>Max Tokens</Label>
                  <Input
                    id='edit-max-tokens'
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
          )}
        </div>

        {/* Footer */}
        <div className='border-t px-6 py-4'>
          {showDeleteConfirm ? (
            <div className='flex items-center justify-between'>
              <p className='text-sm text-foreground'>
                Are you sure you want to delete this agent?
              </p>
              <div className='flex gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant='destructive'
                  size='sm'
                  onClick={handleDelete}
                  disabled={isLoading}
                >
                  {isLoading ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          ) : isEditing ? (
            <div className='flex items-center justify-end gap-2'>
              <Button
                variant='outline'
                onClick={handleCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isLoading || !name.trim()}>
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          ) : (
            <div className='flex items-center justify-between'>
              <Button
                variant='destructive'
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isLoading}
              >
                Delete Agent
              </Button>
              <Button onClick={() => setIsEditing(true)} disabled={isLoading}>
                Edit Agent
              </Button>
            </div>
          )}
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
