/**
 * AI Prompt Library Component
 *
 * Browser and manager for AI prompt templates with features:
 * - Category filtering
 * - Search functionality
 * - Sorting (by name, usage, stars, recent)
 * - Starring templates
 * - Cloning templates
 * - Quick preview and use
 *
 * @module components/ai/prompt-library
 */

'use client';

import {
  Search,
  Star,
  Copy,
  TrendingUp,
  Clock,
  Tag,
  MoreVertical,
  Plus,
  Filter,
  SortAsc,
} from 'lucide-react';
import * as React from 'react';

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  PROMPT_CATEGORIES,
  type PromptTemplate,
  type PromptCategory,
} from '@/lib/ai/prompt-templates';

interface PromptLibraryProps {
  workspaceId?: string;
  onSelectTemplate?: (template: PromptTemplate) => void;
  onEditTemplate?: (template: PromptTemplate) => void;
  onCreateNew?: () => void;
  className?: string;
}

export function PromptLibrary({
  workspaceId,
  onSelectTemplate,
  onEditTemplate,
  onCreateNew,
  className,
}: PromptLibraryProps) {
  const [templates, setTemplates] = React.useState<PromptTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = React.useState<
    PromptTemplate[]
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [category, setCategory] = React.useState<PromptCategory | 'all'>('all');
  const [sortBy, setSortBy] = React.useState<
    'name' | 'usage' | 'stars' | 'recent'
  >('recent');
  const [showStarred, setShowStarred] = React.useState(false);

  // Fetch templates
  const fetchTemplates = React.useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        sortBy,
        includeSystem: 'true',
        ...(category !== 'all' && { category }),
        ...(search && { search }),
        ...(showStarred && { starred: 'true' }),
        ...(workspaceId && { workspaceId }),
      });

      const response = await fetch(`/api/ai/prompts?${params}`);
      if (!response.ok) throw new Error('Failed to fetch templates');

      const data = await response.json();
      setTemplates(data.data || []);
      setFilteredTemplates(data.data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  }, [sortBy, category, search, showStarred, workspaceId]);

  React.useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Handle star toggle
  const handleStarToggle = async (
    templateId: string,
    event: React.MouseEvent
  ) => {
    event.stopPropagation();

    try {
      const response = await fetch(`/api/ai/prompts/${templateId}/star`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to toggle star');

      // Refresh templates
      await fetchTemplates();
    } catch (error) {
      console.error('Error toggling star:', error);
    }
  };

  // Handle clone
  const handleClone = async (templateId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    try {
      const response = await fetch(`/api/ai/prompts/${templateId}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });

      if (!response.ok) throw new Error('Failed to clone template');

      // Refresh templates
      await fetchTemplates();
    } catch (error) {
      console.error('Error cloning template:', error);
    }
  };

  // Handle use template
  const handleUse = async (template: PromptTemplate) => {
    // Track usage
    if (!template.id.startsWith('system-')) {
      await fetch(`/api/ai/prompts/${template.id}/use`, {
        method: 'POST',
      });
    }

    onSelectTemplate?.(template);
  };

  return (
    <div className={cn('flex flex-col space-y-6', className)}>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-2xl font-bold'>Prompt Library</h2>
          <p className='text-sm text-muted-foreground'>
            Browse and manage AI prompt templates
          </p>
        </div>
        {onCreateNew && (
          <Button onClick={onCreateNew}>
            <Plus className='mr-2 h-4 w-4' />
            New Template
          </Button>
        )}
      </div>

      {/* Filters and Search */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center'>
        <div className='relative flex-1'>
          <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            placeholder='Search templates...'
            value={search}
            onChange={e => setSearch(e.target.value)}
            className='pl-9'
          />
        </div>

        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger className='w-[180px]'>
            <SortAsc className='mr-2 h-4 w-4' />
            <SelectValue placeholder='Sort by' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='recent'>Most Recent</SelectItem>
            <SelectItem value='name'>Name (A-Z)</SelectItem>
            <SelectItem value='usage'>Most Used</SelectItem>
            <SelectItem value='stars'>Most Starred</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant={showStarred ? 'default' : 'outline'}
          size='icon'
          onClick={() => setShowStarred(!showStarred)}
          title='Show starred only'
        >
          <Star className={cn('h-4 w-4', showStarred && 'fill-current')} />
        </Button>
      </div>

      {/* Category Tabs */}
      <Tabs value={category} onValueChange={(v: any) => setCategory(v)}>
        <TabsList className='w-full justify-start overflow-x-auto'>
          <TabsTrigger value='all'>All</TabsTrigger>
          {(
            Object.entries(PROMPT_CATEGORIES) as [
              PromptCategory,
              (typeof PROMPT_CATEGORIES)[PromptCategory],
            ][]
          ).map(([key, { label, icon }]) => (
            <TabsTrigger key={key} value={key}>
              <span className='mr-1'>{icon}</span>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Templates Grid */}
      {loading ? (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {[...Array(6)].map((_, i) => (
            <Card key={i} className='animate-pulse'>
              <CardHeader>
                <div className='h-6 bg-muted rounded' />
                <div className='h-4 bg-muted rounded w-3/4' />
              </CardHeader>
              <CardContent>
                <div className='space-y-2'>
                  <div className='h-3 bg-muted rounded' />
                  <div className='h-3 bg-muted rounded w-5/6' />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12'>
            <Search className='h-12 w-12 text-muted-foreground mb-4' />
            <h3 className='text-lg font-semibold mb-2'>No templates found</h3>
            <p className='text-sm text-muted-foreground text-center mb-4'>
              Try adjusting your search or filters
            </p>
            {onCreateNew && (
              <Button onClick={onCreateNew} variant='outline'>
                <Plus className='mr-2 h-4 w-4' />
                Create New Template
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {filteredTemplates.map(template => (
            <PromptTemplateCard
              key={template.id}
              template={template}
              onUse={handleUse}
              onStar={handleStarToggle}
              onClone={handleClone}
              onEdit={onEditTemplate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface PromptTemplateCardProps {
  template: PromptTemplate & { isStarred?: boolean };
  onUse: (template: PromptTemplate) => void;
  onStar: (templateId: string, event: React.MouseEvent) => void;
  onClone: (templateId: string, event: React.MouseEvent) => void;
  onEdit?: (template: PromptTemplate) => void;
}

function PromptTemplateCard({
  template,
  onUse,
  onStar,
  onClone,
  onEdit,
}: PromptTemplateCardProps) {
  const category = PROMPT_CATEGORIES[template.category as PromptCategory];

  return (
    <Card
      className='cursor-pointer transition-all hover:shadow-md'
      onClick={() => onUse(template)}
    >
      <CardHeader>
        <div className='flex items-start justify-between'>
          <div className='flex-1 min-w-0'>
            <div className='flex items-center gap-2 mb-1'>
              <span className='text-lg'>{category?.icon}</span>
              {template.isSystem && (
                <Badge variant='secondary' className='text-xs'>
                  System
                </Badge>
              )}
            </div>
            <CardTitle className='text-base truncate'>
              {template.name}
            </CardTitle>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
              <Button variant='ghost' size='icon' className='h-8 w-8'>
                <MoreVertical className='h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem onClick={() => onUse(template)}>
                Use Template
              </DropdownMenuItem>
              <DropdownMenuItem onClick={e => onClone(template.id, e)}>
                <Copy className='mr-2 h-4 w-4' />
                Clone
              </DropdownMenuItem>
              {onEdit && !template.isSystem && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={e => {
                      e.stopPropagation();
                      onEdit(template);
                    }}
                  >
                    Edit
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <CardDescription className='line-clamp-2'>
          {template.description}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className='flex flex-wrap gap-1 mb-3'>
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

        <div className='text-xs text-muted-foreground'>
          {template.variables.length} variable
          {template.variables.length !== 1 ? 's' : ''}
        </div>
      </CardContent>

      <CardFooter className='flex items-center justify-between text-sm text-muted-foreground border-t pt-4'>
        <div className='flex items-center gap-3'>
          <Button
            variant='ghost'
            size='sm'
            className='h-7 px-2'
            onClick={e => onStar(template.id, e)}
          >
            <Star
              className={cn(
                'h-3 w-3 mr-1',
                template.isStarred && 'fill-current text-yellow-500'
              )}
            />
            {template.starCount}
          </Button>

          <div className='flex items-center'>
            <TrendingUp className='h-3 w-3 mr-1' />
            {template.usageCount}
          </div>
        </div>

        {template.author && (
          <div
            className='text-xs truncate max-w-[120px]'
            title={template.author}
          >
            by {template.author}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
