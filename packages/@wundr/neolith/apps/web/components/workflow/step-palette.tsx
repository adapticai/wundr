'use client';

/**
 * Step Palette Component
 *
 * A comprehensive palette of available workflow steps that users can drag
 * and drop into their workflow canvas. Supports:
 * - Category-based organization
 * - Search and filtering
 * - Drag and drop functionality
 * - Step details preview
 */

import { Search, X, ChevronDown, ChevronRight } from 'lucide-react';
import { useState, useMemo } from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  ALL_STEP_TYPES,
  STEP_CATEGORIES,
  getStepsByCategory,
  searchSteps,
  type StepCategory,
  type StepType,
} from '@/lib/workflow/step-types';

export interface StepPaletteProps {
  onStepSelect?: (step: StepType<unknown>) => void;
  onStepDragStart?: (step: StepType<unknown>, event: React.DragEvent) => void;
  className?: string;
  compact?: boolean;
  initialExpanded?: StepCategory[];
}

export function StepPalette({
  onStepSelect,
  onStepDragStart,
  className,
  compact = false,
  initialExpanded = ['triggers', 'actions'],
}: StepPaletteProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<StepCategory | 'all'>(
    'all',
  );
  const [expandedCategories, setExpandedCategories] = useState<Set<StepCategory>>(
    new Set(initialExpanded),
  );

  // Filter steps based on search and category
  const filteredSteps = useMemo(() => {
    if (searchQuery) {
      return searchSteps(searchQuery);
    }

    if (selectedCategory === 'all') {
      return ALL_STEP_TYPES;
    }

    return getStepsByCategory(selectedCategory);
  }, [searchQuery, selectedCategory]);

  // Group steps by category for display
  const groupedSteps = useMemo(() => {
    const groups = new Map<StepCategory, StepType<unknown>[]>();

    filteredSteps.forEach(step => {
      const existing = groups.get(step.category) || [];
      groups.set(step.category, [...existing, step]);
    });

    return groups;
  }, [filteredSteps]);

  const handleStepClick = (step: StepType<unknown>) => {
    onStepSelect?.(step);
  };

  const handleDragStart = (step: StepType<unknown>, event: React.DragEvent) => {
    event.dataTransfer.setData('application/json', JSON.stringify({ stepId: step.id }));
    event.dataTransfer.effectAllowed = 'copy';
    onStepDragStart?.(step, event);
  };

  const toggleCategory = (category: StepCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  return (
    <div className={cn('flex h-full flex-col bg-muted/30', className)}>
      {/* Header */}
      <div className='border-b bg-background p-4'>
        <h2 className='mb-3 text-sm font-semibold text-foreground'>
          Workflow Steps
        </h2>

        {/* Search */}
        <div className='relative'>
          <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            type='text'
            placeholder='Search steps...'
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className='pl-9 pr-9'
          />
          {searchQuery && (
            <button
              type='button'
              onClick={clearSearch}
              className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
            >
              <X className='h-4 w-4' />
            </button>
          )}
        </div>

        {/* Category Filter */}
        {!compact && !searchQuery && (
          <div className='mt-3 flex flex-wrap gap-2'>
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              size='sm'
              onClick={() => setSelectedCategory('all')}
            >
              All
            </Button>
            {Object.values(STEP_CATEGORIES).map(category => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? 'default' : 'outline'}
                size='sm'
                onClick={() => setSelectedCategory(category.id)}
              >
                {category.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Steps List */}
      <div className='flex-1 overflow-auto'>
        <div className='p-4'>
          {searchQuery ? (
            // Search results view
            <div className='space-y-2'>
              <p className='mb-3 text-xs text-muted-foreground'>
                {filteredSteps.length} result{filteredSteps.length !== 1 ? 's' : ''}
              </p>
              {filteredSteps.map(step => (
                <StepCard
                  key={step.id}
                  step={step}
                  compact={compact}
                  onClick={() => handleStepClick(step)}
                  onDragStart={e => handleDragStart(step, e)}
                />
              ))}
            </div>
          ) : (
            // Category-grouped view
            <Accordion
              type='multiple'
              value={Array.from(expandedCategories)}
              className='space-y-2'
            >
              {Array.from(groupedSteps.entries()).map(([category, steps]) => {
                const categoryInfo = STEP_CATEGORIES[category];
                return (
                  <AccordionItem
                    key={category}
                    value={category}
                    className='rounded-lg border bg-background'
                  >
                    <AccordionTrigger
                      className='px-4 py-3 hover:no-underline'
                      onClick={() => toggleCategory(category)}
                    >
                      <div className='flex items-center gap-2'>
                        <categoryInfo.icon
                          className={cn('h-4 w-4', categoryInfo.color)}
                        />
                        <span className='text-sm font-medium'>
                          {categoryInfo.label}
                        </span>
                        <Badge variant='secondary' className='ml-1'>
                          {steps.length}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className='px-4 pb-4 pt-2'>
                      <div className='space-y-2'>
                        {steps.map(step => (
                          <StepCard
                            key={step.id}
                            step={step}
                            compact={compact}
                            onClick={() => handleStepClick(step)}
                            onDragStart={e => handleDragStart(step, e)}
                          />
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}

          {filteredSteps.length === 0 && (
            <div className='py-12 text-center'>
              <p className='text-sm text-muted-foreground'>No steps found</p>
              {searchQuery && (
                <Button
                  variant='link'
                  size='sm'
                  onClick={clearSearch}
                  className='mt-2'
                >
                  Clear search
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      {!compact && (
        <div className='border-t bg-background p-3'>
          <p className='text-xs text-muted-foreground'>
            Drag and drop steps onto the canvas or click to add
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Step Card Component
// ============================================================================

interface StepCardProps {
  step: StepType<unknown>;
  compact?: boolean;
  onClick?: () => void;
  onDragStart?: (event: React.DragEvent) => void;
}

function StepCard({ step, compact, onClick, onDragStart }: StepCardProps) {
  const Icon = step.icon;

  return (
    <HoverCard openDelay={300}>
      <HoverCardTrigger asChild>
        <button
          type='button'
          draggable
          onClick={onClick}
          onDragStart={onDragStart}
          className={cn(
            'group flex w-full items-start gap-3 rounded-md border bg-card p-3 text-left transition-all',
            'hover:border-primary hover:shadow-sm',
            'active:scale-[0.98]',
            'cursor-grab active:cursor-grabbing',
          )}
        >
          {/* Icon */}
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
              'bg-muted group-hover:bg-primary/10',
            )}
          >
            <Icon className={cn('h-4 w-4', step.color)} />
          </div>

          {/* Content */}
          <div className='min-w-0 flex-1'>
            <div className='flex items-start justify-between gap-2'>
              <h3 className='text-sm font-medium text-foreground'>{step.name}</h3>
              {step.deprecated && (
                <Badge variant='outline' className='text-xs'>
                  Deprecated
                </Badge>
              )}
            </div>
            {!compact && (
              <p className='mt-1 line-clamp-2 text-xs text-muted-foreground'>
                {step.description}
              </p>
            )}
            {step.tags && step.tags.length > 0 && !compact && (
              <div className='mt-2 flex flex-wrap gap-1'>
                {step.tags.slice(0, 3).map(tag => (
                  <Badge
                    key={tag}
                    variant='secondary'
                    className='text-xs font-normal'
                  >
                    {tag}
                  </Badge>
                ))}
                {step.tags.length > 3 && (
                  <Badge variant='secondary' className='text-xs font-normal'>
                    +{step.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </button>
      </HoverCardTrigger>
      <HoverCardContent side='right' className='w-80'>
        <StepDetailPreview step={step} />
      </HoverCardContent>
    </HoverCard>
  );
}

// ============================================================================
// Step Detail Preview Component
// ============================================================================

interface StepDetailPreviewProps {
  step: StepType<unknown>;
}

function StepDetailPreview({ step }: StepDetailPreviewProps) {
  const Icon = step.icon;
  const categoryInfo = STEP_CATEGORIES[step.category];

  return (
    <div className='space-y-3'>
      {/* Header */}
      <div className='flex items-start gap-3'>
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            'bg-primary/10',
          )}
        >
          <Icon className={cn('h-5 w-5', step.color)} />
        </div>
        <div className='min-w-0 flex-1'>
          <h3 className='font-semibold text-foreground'>{step.name}</h3>
          <div className='mt-1 flex items-center gap-2'>
            <categoryInfo.icon className={cn('h-3 w-3', categoryInfo.color)} />
            <span className='text-xs text-muted-foreground'>
              {categoryInfo.label}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className='text-sm text-muted-foreground'>{step.description}</p>

      {/* Ports */}
      <div className='space-y-2'>
        {step.inputs.length > 0 && (
          <div>
            <h4 className='mb-1.5 text-xs font-semibold text-foreground'>
              Inputs
            </h4>
            <div className='space-y-1'>
              {step.inputs.map(port => (
                <div
                  key={port.id}
                  className='flex items-center gap-2 text-xs text-muted-foreground'
                >
                  <div className='h-1.5 w-1.5 rounded-full bg-blue-500' />
                  <span>
                    {port.label}
                    {port.required && (
                      <span className='ml-1 text-red-500'>*</span>
                    )}
                  </span>
                  {port.dataType && (
                    <Badge variant='outline' className='ml-auto text-xs'>
                      {port.dataType}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {step.outputs.length > 0 && (
          <div>
            <h4 className='mb-1.5 text-xs font-semibold text-foreground'>
              Outputs
            </h4>
            <div className='space-y-1'>
              {step.outputs.map(port => (
                <div
                  key={port.id}
                  className='flex items-center gap-2 text-xs text-muted-foreground'
                >
                  <div className='h-1.5 w-1.5 rounded-full bg-green-500' />
                  <span>{port.label}</span>
                  {port.dataType && (
                    <Badge variant='outline' className='ml-auto text-xs'>
                      {port.dataType}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tags */}
      {step.tags && step.tags.length > 0 && (
        <div>
          <h4 className='mb-1.5 text-xs font-semibold text-foreground'>Tags</h4>
          <div className='flex flex-wrap gap-1'>
            {step.tags.map(tag => (
              <Badge key={tag} variant='secondary' className='text-xs'>
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Deprecated Warning */}
      {step.deprecated && (
        <div className='rounded-md border border-yellow-500/50 bg-yellow-500/10 p-2'>
          <p className='text-xs text-yellow-600 dark:text-yellow-400'>
            This step is deprecated and may be removed in a future version.
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Compact Step Palette Component
// ============================================================================

export interface CompactStepPaletteProps {
  onStepSelect?: (step: StepType<unknown>) => void;
  onStepDragStart?: (step: StepType<unknown>, event: React.DragEvent) => void;
  className?: string;
}

export function CompactStepPalette(props: CompactStepPaletteProps) {
  return <StepPalette {...props} compact />;
}
