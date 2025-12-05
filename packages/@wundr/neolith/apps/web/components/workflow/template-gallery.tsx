'use client';

/**
 * Workflow Template Gallery Component
 *
 * Displays a gallery of pre-built workflow templates that users can browse,
 * preview, and use to create new workflows.
 */

import { Search, Sparkles, TrendingUp, Filter } from 'lucide-react';
import { useState, useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  WORKFLOW_TEMPLATES,
  searchTemplates,
  getPopularTemplates,
  getTemplatesByCategories,
} from '@/lib/workflow/templates';
import { TEMPLATE_CATEGORY_CONFIG } from '@/types/workflow';

import { TemplatePreview } from './template-preview';

import type {
  WorkflowTemplate,
  WorkflowTemplateCategory,
} from '@/types/workflow';

interface TemplateGalleryProps {
  /**
   * Callback when user selects "Use Template"
   */
  onUseTemplate?: (template: WorkflowTemplate) => void;
  /**
   * Optional CSS class name
   */
  className?: string;
}

type ViewMode = 'all' | 'popular' | 'category';

export function TemplateGallery({
  onUseTemplate,
  className,
}: TemplateGalleryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] =
    useState<WorkflowTemplateCategory | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [previewTemplate, setPreviewTemplate] =
    useState<WorkflowTemplate | null>(null);

  // Filter templates based on search and category
  const filteredTemplates = useMemo(() => {
    if (viewMode === 'popular') {
      return getPopularTemplates(6);
    }

    let templates = WORKFLOW_TEMPLATES;

    if (searchQuery) {
      templates = searchTemplates(searchQuery) as typeof WORKFLOW_TEMPLATES;
    }

    if (selectedCategory) {
      templates = templates.filter(t => t.category === selectedCategory);
    }

    return templates;
  }, [searchQuery, selectedCategory, viewMode]);

  // Get templates grouped by category
  const templatesByCategory = useMemo(() => {
    return getTemplatesByCategories();
  }, []);

  const categories = Object.keys(
    TEMPLATE_CATEGORY_CONFIG
  ) as WorkflowTemplateCategory[];

  const handleUseTemplate = (template: WorkflowTemplate) => {
    setPreviewTemplate(null);
    onUseTemplate?.(template);
  };

  return (
    <div className={className}>
      {/* Header */}
      <div className='mb-6 space-y-4'>
        <div className='flex items-center justify-between'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>
              Workflow Templates
            </h2>
            <p className='text-sm text-muted-foreground'>
              Get started quickly with pre-built workflow templates
            </p>
          </div>
          <div className='flex gap-2'>
            <Button
              variant={viewMode === 'all' ? 'default' : 'outline'}
              size='sm'
              onClick={() => {
                setViewMode('all');
                setSelectedCategory(null);
              }}
            >
              All Templates
            </Button>
            <Button
              variant={viewMode === 'popular' ? 'default' : 'outline'}
              size='sm'
              onClick={() => setViewMode('popular')}
            >
              <TrendingUp className='mr-2 h-4 w-4' />
              Popular
            </Button>
          </div>
        </div>

        {/* Search and Filter */}
        <div className='flex gap-3'>
          <div className='relative flex-1'>
            <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              placeholder='Search templates...'
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className='pl-10'
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className='flex flex-wrap gap-2'>
          <Button
            variant={selectedCategory === null ? 'default' : 'outline'}
            size='sm'
            onClick={() => {
              setSelectedCategory(null);
              setViewMode('all');
            }}
          >
            <Filter className='mr-2 h-3 w-3' />
            All Categories
          </Button>
          {categories.map(category => {
            const config = TEMPLATE_CATEGORY_CONFIG[category];
            return (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size='sm'
                onClick={() => {
                  setSelectedCategory(category);
                  setViewMode('category');
                }}
              >
                {config.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Templates Grid */}
      {viewMode === 'category' && selectedCategory ? (
        // Category view - show grouped by category
        <div className='space-y-8'>
          {Object.entries(templatesByCategory)
            .filter(
              ([category]) => !selectedCategory || category === selectedCategory
            )
            .map(([category, templates]) => {
              const config =
                TEMPLATE_CATEGORY_CONFIG[category as WorkflowTemplateCategory];
              return (
                <div key={category}>
                  <div className='mb-4'>
                    <h3 className='text-lg font-semibold'>{config.label}</h3>
                    <p className='text-sm text-muted-foreground'>
                      {config.description}
                    </p>
                  </div>
                  <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                    {templates.map(template => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onPreview={() => setPreviewTemplate(template)}
                        onUse={() => handleUseTemplate(template)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      ) : (
        // Regular grid view
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {filteredTemplates.length > 0 ? (
            filteredTemplates.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                onPreview={() => setPreviewTemplate(template)}
                onUse={() => handleUseTemplate(template)}
              />
            ))
          ) : (
            <div className='col-span-full flex flex-col items-center justify-center py-12'>
              <Sparkles className='mb-4 h-12 w-12 text-muted-foreground' />
              <h3 className='mb-2 text-lg font-semibold'>No templates found</h3>
              <p className='text-sm text-muted-foreground'>
                Try adjusting your search or filters
              </p>
            </div>
          )}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog
        open={previewTemplate !== null}
        onOpenChange={open => !open && setPreviewTemplate(null)}
      >
        <DialogContent className='max-h-[90vh] max-w-4xl overflow-y-auto'>
          {previewTemplate && (
            <>
              <DialogHeader>
                <DialogTitle>{previewTemplate.name}</DialogTitle>
                <DialogDescription>
                  {previewTemplate.description}
                </DialogDescription>
              </DialogHeader>
              <TemplatePreview template={previewTemplate} />
              <DialogFooter>
                <Button
                  variant='outline'
                  onClick={() => setPreviewTemplate(null)}
                >
                  Close
                </Button>
                <Button onClick={() => handleUseTemplate(previewTemplate)}>
                  Use This Template
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Individual Template Card Component
 */
interface TemplateCardProps {
  template: WorkflowTemplate;
  onPreview: () => void;
  onUse: () => void;
}

function TemplateCard({ template, onPreview, onUse }: TemplateCardProps) {
  const categoryConfig = TEMPLATE_CATEGORY_CONFIG[template.category];

  return (
    <Card className='flex flex-col transition-shadow hover:shadow-md'>
      <CardHeader>
        <div className='mb-2 flex items-start justify-between'>
          <Badge variant='secondary'>{categoryConfig.label}</Badge>
          {template.usageCount > 500 && (
            <div className='flex items-center gap-1 text-xs text-muted-foreground'>
              <TrendingUp className='h-3 w-3' />
              <span>{formatUsageCount(template.usageCount)}</span>
            </div>
          )}
        </div>
        <CardTitle className='line-clamp-1'>{template.name}</CardTitle>
        <CardDescription className='line-clamp-2'>
          {template.description}
        </CardDescription>
      </CardHeader>

      <CardContent className='flex-1'>
        <div className='space-y-3'>
          {/* Stats */}
          <div className='flex items-center gap-4 text-xs text-muted-foreground'>
            <span>{template.actions.length} actions</span>
            <span>•</span>
            <span>{template.variables?.length || 0} variables</span>
          </div>

          {/* Tags */}
          <div className='flex flex-wrap gap-1'>
            {template.tags.slice(0, 3).map(tag => (
              <Badge key={tag} variant='outline' className='text-xs'>
                {tag}
              </Badge>
            ))}
            {template.tags.length > 3 && (
              <Badge variant='outline' className='text-xs'>
                +{template.tags.length - 3}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className='flex gap-2'>
        <Button
          variant='outline'
          size='sm'
          onClick={onPreview}
          className='flex-1'
        >
          Preview
        </Button>
        <Button size='sm' onClick={onUse} className='flex-1'>
          Use Template
        </Button>
      </CardFooter>
    </Card>
  );
}

/**
 * Format usage count for display
 */
function formatUsageCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
}
