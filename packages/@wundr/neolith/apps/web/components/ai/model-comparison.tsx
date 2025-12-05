/**
 * Model Comparison Component
 * Side-by-side comparison of AI models
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AI_MODELS,
  getModelsByProvider,
  getProviderName,
} from '@/lib/ai/models';
import { cn } from '@/lib/utils';
import {
  Check,
  ChevronRight,
  Eye,
  GitCompare,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { useState } from 'react';

import { ProviderBadge } from './provider-badge';

import type { AIModel, AIProvider } from '@/lib/ai/models';

interface ModelComparisonProps {
  selectedModels?: string[];
  onSelectModel?: (modelId: string) => void;
  trigger?: React.ReactNode;
}

function CapabilityIcon({
  enabled,
  label,
}: {
  enabled: boolean;
  label: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-xs',
        enabled ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
      )}
      title={label}
    >
      {enabled ? (
        <Check className='h-4 w-4' />
      ) : (
        <X className='h-4 w-4 opacity-50' />
      )}
      <span className='hidden sm:inline'>{label}</span>
    </div>
  );
}

function ModelComparisonTable({ models }: { models: AIModel[] }) {
  return (
    <div className='overflow-x-auto'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-[200px]'>Feature</TableHead>
            {models.map(model => (
              <TableHead key={model.id} className='text-center min-w-[180px]'>
                <div className='flex flex-col gap-2 items-center'>
                  <ProviderBadge provider={model.provider} size='sm' />
                  <span className='font-semibold'>{model.name}</span>
                  {model.isRecommended && (
                    <Badge variant='secondary' className='text-xs'>
                      Recommended
                    </Badge>
                  )}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Context Length */}
          <TableRow>
            <TableCell className='font-medium'>Context Length</TableCell>
            {models.map(model => (
              <TableCell key={model.id} className='text-center'>
                {(model.contextLength / 1000).toFixed(0)}K tokens
              </TableCell>
            ))}
          </TableRow>

          {/* Max Output */}
          <TableRow>
            <TableCell className='font-medium'>Max Output</TableCell>
            {models.map(model => (
              <TableCell key={model.id} className='text-center'>
                {(model.maxOutputTokens / 1000).toFixed(1)}K tokens
              </TableCell>
            ))}
          </TableRow>

          {/* Pricing - Input */}
          <TableRow>
            <TableCell className='font-medium'>Input Price</TableCell>
            {models.map(model => (
              <TableCell key={model.id} className='text-center'>
                <div className='flex flex-col'>
                  <span className='font-mono text-sm'>
                    ${model.pricing.input.toFixed(2)}
                  </span>
                  <span className='text-xs text-muted-foreground'>
                    per 1M tokens
                  </span>
                </div>
              </TableCell>
            ))}
          </TableRow>

          {/* Pricing - Output */}
          <TableRow>
            <TableCell className='font-medium'>Output Price</TableCell>
            {models.map(model => (
              <TableCell key={model.id} className='text-center'>
                <div className='flex flex-col'>
                  <span className='font-mono text-sm'>
                    ${model.pricing.output.toFixed(2)}
                  </span>
                  <span className='text-xs text-muted-foreground'>
                    per 1M tokens
                  </span>
                </div>
              </TableCell>
            ))}
          </TableRow>

          {/* Capabilities Header */}
          <TableRow className='bg-muted/50'>
            <TableCell className='font-semibold' colSpan={models.length + 1}>
              Capabilities
            </TableCell>
          </TableRow>

          {/* Vision */}
          <TableRow>
            <TableCell className='font-medium flex items-center gap-2'>
              <Eye className='h-4 w-4' />
              Vision
            </TableCell>
            {models.map(model => (
              <TableCell key={model.id} className='text-center'>
                {model.capabilities.vision ? (
                  <Check className='h-5 w-5 text-green-600 dark:text-green-400 mx-auto' />
                ) : (
                  <X className='h-5 w-5 text-muted-foreground mx-auto opacity-50' />
                )}
              </TableCell>
            ))}
          </TableRow>

          {/* Function Calling */}
          <TableRow>
            <TableCell className='font-medium flex items-center gap-2'>
              <Zap className='h-4 w-4' />
              Function Calling
            </TableCell>
            {models.map(model => (
              <TableCell key={model.id} className='text-center'>
                {model.capabilities.functionCalling ? (
                  <Check className='h-5 w-5 text-green-600 dark:text-green-400 mx-auto' />
                ) : (
                  <X className='h-5 w-5 text-muted-foreground mx-auto opacity-50' />
                )}
              </TableCell>
            ))}
          </TableRow>

          {/* Reasoning */}
          <TableRow>
            <TableCell className='font-medium flex items-center gap-2'>
              <Sparkles className='h-4 w-4' />
              Advanced Reasoning
            </TableCell>
            {models.map(model => (
              <TableCell key={model.id} className='text-center'>
                {model.capabilities.reasoning ? (
                  <Check className='h-5 w-5 text-green-600 dark:text-green-400 mx-auto' />
                ) : (
                  <X className='h-5 w-5 text-muted-foreground mx-auto opacity-50' />
                )}
              </TableCell>
            ))}
          </TableRow>

          {/* Streaming */}
          <TableRow>
            <TableCell className='font-medium'>Streaming</TableCell>
            {models.map(model => (
              <TableCell key={model.id} className='text-center'>
                {model.capabilities.streaming ? (
                  <Check className='h-5 w-5 text-green-600 dark:text-green-400 mx-auto' />
                ) : (
                  <X className='h-5 w-5 text-muted-foreground mx-auto opacity-50' />
                )}
              </TableCell>
            ))}
          </TableRow>

          {/* JSON Mode */}
          <TableRow>
            <TableCell className='font-medium'>JSON Mode</TableCell>
            {models.map(model => (
              <TableCell key={model.id} className='text-center'>
                {model.capabilities.json ? (
                  <Check className='h-5 w-5 text-green-600 dark:text-green-400 mx-auto' />
                ) : (
                  <X className='h-5 w-5 text-muted-foreground mx-auto opacity-50' />
                )}
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

export function ModelComparison({
  selectedModels = [],
  onSelectModel,
  trigger,
}: ModelComparisonProps) {
  const [open, setOpen] = useState(false);

  // Default to comparing recommended models or first 3 models
  const modelsToCompare =
    selectedModels.length > 0
      ? selectedModels.map(id => AI_MODELS[id]).filter(Boolean)
      : Object.values(AI_MODELS)
          .filter(m => m.isRecommended)
          .slice(0, 3);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant='outline' className='flex items-center gap-2'>
            <GitCompare className='h-4 w-4' />
            Compare Models
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className='max-w-6xl max-h-[90vh]'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <GitCompare className='h-5 w-5' />
            Model Comparison
          </DialogTitle>
          <DialogDescription>
            Compare capabilities, pricing, and features across AI models
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className='max-h-[calc(90vh-120px)] pr-4'>
          <ModelComparisonTable models={modelsToCompare} />
          {onSelectModel && (
            <div className='mt-6 flex items-center justify-end gap-2'>
              <Button variant='outline' onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Provider comparison view
 */
export function ProviderComparison() {
  const providers: AIProvider[] = ['openai', 'anthropic', 'deepseek'];

  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-2'>
        <GitCompare className='h-5 w-5' />
        <h3 className='text-lg font-semibold'>Provider Comparison</h3>
      </div>

      {providers.map(provider => {
        const models = getModelsByProvider(provider);
        const recommended = models.filter(m => m.isRecommended);

        return (
          <div key={provider} className='space-y-3'>
            <div className='flex items-center gap-3'>
              <ProviderBadge provider={provider} />
              <span className='text-sm text-muted-foreground'>
                {models.length} model{models.length !== 1 ? 's' : ''}
                {recommended.length > 0 &&
                  ` (${recommended.length} recommended)`}
              </span>
            </div>

            <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
              {models.map(model => (
                <div
                  key={model.id}
                  className={cn(
                    'rounded-lg border p-4 hover:bg-accent/50 transition-colors',
                    model.isRecommended && 'border-primary'
                  )}
                >
                  <div className='flex items-start justify-between mb-2'>
                    <div>
                      <h4 className='font-medium'>{model.name}</h4>
                      <p className='text-xs text-muted-foreground mt-1'>
                        {model.description}
                      </p>
                    </div>
                    {model.isRecommended && (
                      <Badge variant='secondary' className='text-xs'>
                        Recommended
                      </Badge>
                    )}
                  </div>

                  <div className='mt-3 space-y-2'>
                    <div className='flex items-center justify-between text-sm'>
                      <span className='text-muted-foreground'>Context</span>
                      <span className='font-medium'>
                        {(model.contextLength / 1000).toFixed(0)}K
                      </span>
                    </div>
                    <div className='flex items-center justify-between text-sm'>
                      <span className='text-muted-foreground'>Pricing</span>
                      <span className='font-mono text-xs'>
                        ${model.pricing.input.toFixed(2)}/$
                        {model.pricing.output.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className='mt-3 pt-3 border-t flex flex-wrap gap-2'>
                    {model.capabilities.vision && (
                      <Badge variant='outline' className='text-xs'>
                        <Eye className='h-3 w-3 mr-1' />
                        Vision
                      </Badge>
                    )}
                    {model.capabilities.reasoning && (
                      <Badge variant='outline' className='text-xs'>
                        <Sparkles className='h-3 w-3 mr-1' />
                        Reasoning
                      </Badge>
                    )}
                    {model.capabilities.functionCalling && (
                      <Badge variant='outline' className='text-xs'>
                        <Zap className='h-3 w-3 mr-1' />
                        Tools
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
