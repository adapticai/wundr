/**
 * Model Selector Component
 * Dropdown for selecting AI models with detailed information
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AI_MODELS,
  getModelById,
  getModelsByProvider,
  getProviderName,
} from '@/lib/ai/models';
import { cn } from '@/lib/utils';
import { Check, ChevronDown, Eye, Info, Sparkles, Zap } from 'lucide-react';
import { useState } from 'react';

import { ProviderBadge } from './provider-badge';

import type { AIModel, AIProvider } from '@/lib/ai/models';

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
  className?: string;
  providers?: AIProvider[];
  showDetails?: boolean;
}

function ModelDetails({ model }: { model: AIModel }) {
  return (
    <div className='flex flex-col gap-1 text-xs text-muted-foreground'>
      <div className='flex items-center gap-2 flex-wrap'>
        <Badge variant='secondary' className='text-xs'>
          {(model.contextLength / 1000).toFixed(0)}K context
        </Badge>
        {model.capabilities.vision && (
          <Badge variant='outline' className='text-xs flex items-center gap-1'>
            <Eye className='h-3 w-3' />
            Vision
          </Badge>
        )}
        {model.capabilities.reasoning && (
          <Badge variant='outline' className='text-xs flex items-center gap-1'>
            <Sparkles className='h-3 w-3' />
            Reasoning
          </Badge>
        )}
        {model.capabilities.functionCalling && (
          <Badge variant='outline' className='text-xs flex items-center gap-1'>
            <Zap className='h-3 w-3' />
            Tools
          </Badge>
        )}
      </div>
      <div className='flex items-center gap-2'>
        <span className='text-xs'>
          ${model.pricing.input.toFixed(2)}/${model.pricing.output.toFixed(2)}{' '}
          per 1M tokens
        </span>
      </div>
    </div>
  );
}

export function ModelSelector({
  value,
  onChange,
  disabled = false,
  className,
  providers = ['openai', 'anthropic', 'deepseek'],
  showDetails = true,
}: ModelSelectorProps) {
  const selectedModel = getModelById(value);

  // Group models by provider
  const modelsByProvider = providers.reduce(
    (acc, provider) => {
      acc[provider] = getModelsByProvider(provider);
      return acc;
    },
    {} as Record<AIProvider, AIModel[]>
  );

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={cn('w-full', className)}>
        <SelectValue>
          {selectedModel ? (
            <div className='flex items-center gap-2'>
              <ProviderBadge provider={selectedModel.provider} size='sm' />
              <span className='font-medium'>{selectedModel.name}</span>
              {selectedModel.isRecommended && (
                <Badge variant='secondary' className='text-xs'>
                  Recommended
                </Badge>
              )}
            </div>
          ) : (
            'Select a model'
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className='max-h-[400px]'>
        {providers.map(provider => {
          const models = modelsByProvider[provider];
          if (!models?.length) return null;

          return (
            <SelectGroup key={provider}>
              <SelectLabel className='flex items-center gap-2 py-2'>
                <ProviderBadge provider={provider} size='sm' />
              </SelectLabel>
              {models.map(model => (
                <SelectItem key={model.id} value={model.id} className='py-3'>
                  <div className='flex flex-col gap-1'>
                    <div className='flex items-center gap-2'>
                      <span className='font-medium'>{model.name}</span>
                      {model.isRecommended && (
                        <Badge variant='secondary' className='text-xs'>
                          Recommended
                        </Badge>
                      )}
                    </div>
                    <p className='text-xs text-muted-foreground line-clamp-1'>
                      {model.description}
                    </p>
                    {showDetails && <ModelDetails model={model} />}
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}

/**
 * Compact model selector for constrained spaces
 */
export function ModelSelectorCompact({
  value,
  onChange,
  disabled = false,
  className,
}: Omit<ModelSelectorProps, 'providers' | 'showDetails'>) {
  const selectedModel = getModelById(value);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={cn('w-[200px]', className)}>
        <SelectValue>
          {selectedModel ? (
            <div className='flex items-center gap-2'>
              <ProviderBadge
                provider={selectedModel.provider}
                size='sm'
                showIcon={false}
              />
              <span className='text-sm truncate'>{selectedModel.name}</span>
            </div>
          ) : (
            'Select model'
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.values(AI_MODELS).map(model => (
          <SelectItem key={model.id} value={model.id}>
            <div className='flex items-center gap-2'>
              <ProviderBadge
                provider={model.provider}
                size='sm'
                showIcon={false}
              />
              <span className='text-sm'>{model.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
