/**
 * Orchestrator Template Selector Component
 * Grid view of templates for quick orchestrator creation
 * @module components/orchestrators/template-selector
 */
'use client';

import {
  Code2,
  Users,
  Lightbulb,
  Palette,
  Settings,
  BarChart,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import type { OrchestratorTemplate } from '@/lib/templates/orchestrator-templates';

export interface TemplateSelectorProps {
  templates: OrchestratorTemplate[];
  onSelectTemplate: (template: OrchestratorTemplate) => void;
  onCustomCreate: () => void;
  isLoading?: boolean;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Code2,
  Users,
  Lightbulb,
  Palette,
  Settings,
  BarChart,
};

/**
 * TemplateSelector - Grid of orchestrator templates for quick creation
 */
export function TemplateSelector({
  templates,
  onSelectTemplate,
  onCustomCreate,
  isLoading = false,
}: TemplateSelectorProps) {
  const [search, setSearch] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState<string>('all');
  const [disciplineFilter, setDisciplineFilter] = React.useState<string>('all');

  // Filter templates
  const filteredTemplates = React.useMemo(() => {
    return templates.filter(template => {
      const matchesSearch =
        !search ||
        template.name.toLowerCase().includes(search.toLowerCase()) ||
        template.description.toLowerCase().includes(search.toLowerCase()) ||
        template.tags.some(tag =>
          tag.toLowerCase().includes(search.toLowerCase())
        );

      const matchesCategory =
        categoryFilter === 'all' || template.category === categoryFilter;

      const matchesDiscipline =
        disciplineFilter === 'all' || template.discipline === disciplineFilter;

      return matchesSearch && matchesCategory && matchesDiscipline;
    });
  }, [templates, search, categoryFilter, disciplineFilter]);

  // Get unique disciplines
  const disciplines = React.useMemo(() => {
    const uniqueDisciplines = new Set(templates.map(t => t.discipline));
    return Array.from(uniqueDisciplines).sort();
  }, [templates]);

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
        <div>
          <h2 className='text-2xl font-semibold tracking-tight'>
            Choose a Template
          </h2>
          <p className='text-sm text-muted-foreground'>
            Get started quickly with pre-configured orchestrator templates
          </p>
        </div>
        <Button variant='outline' onClick={onCustomCreate} disabled={isLoading}>
          <Sparkles className='mr-2 h-4 w-4' />
          Create Custom
        </Button>
      </div>

      {/* Filters */}
      <div className='flex flex-col gap-4 md:flex-row md:items-center'>
        <Input
          placeholder='Search templates...'
          value={search}
          onChange={e => setSearch(e.target.value)}
          className='md:max-w-xs'
          disabled={isLoading}
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className='md:w-[180px]' disabled={isLoading}>
            <SelectValue placeholder='Category' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Categories</SelectItem>
            <SelectItem value='leadership'>Leadership</SelectItem>
            <SelectItem value='support'>Support</SelectItem>
            <SelectItem value='technical'>Technical</SelectItem>
            <SelectItem value='operations'>Operations</SelectItem>
          </SelectContent>
        </Select>
        <Select value={disciplineFilter} onValueChange={setDisciplineFilter}>
          <SelectTrigger className='md:w-[180px]' disabled={isLoading}>
            <SelectValue placeholder='Discipline' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Disciplines</SelectItem>
            {disciplines.map(discipline => (
              <SelectItem key={discipline} value={discipline}>
                {discipline}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12'>
            <p className='text-sm text-muted-foreground'>
              No templates found matching your filters
            </p>
            <Button
              variant='ghost'
              onClick={() => {
                setSearch('');
                setCategoryFilter('all');
                setDisciplineFilter('all');
              }}
              className='mt-4'
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {filteredTemplates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              onSelect={() => onSelectTemplate(template)}
              disabled={isLoading}
            />
          ))}
        </div>
      )}

      {/* Results count */}
      {filteredTemplates.length > 0 && (
        <p className='text-sm text-muted-foreground'>
          Showing {filteredTemplates.length} of {templates.length} templates
        </p>
      )}
    </div>
  );
}

/**
 * TemplateCard - Individual template card
 */
function TemplateCard({
  template,
  onSelect,
  disabled = false,
}: {
  template: OrchestratorTemplate;
  onSelect: () => void;
  disabled?: boolean;
}) {
  const Icon = template.icon ? ICON_MAP[template.icon] : null;

  return (
    <Card
      className={cn(
        'group relative cursor-pointer transition-all hover:shadow-md',
        disabled && 'pointer-events-none opacity-50'
      )}
      onClick={onSelect}
    >
      <CardHeader>
        <div className='flex items-start justify-between'>
          <div className='flex items-center gap-3'>
            {Icon && (
              <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10'>
                <Icon className='h-5 w-5 text-primary' />
              </div>
            )}
            <div>
              <CardTitle className='text-base'>{template.name}</CardTitle>
              <p className='mt-1 text-xs text-muted-foreground'>
                {template.discipline}
              </p>
            </div>
          </div>
          <ArrowRight className='h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100' />
        </div>
        <CardDescription className='mt-3 line-clamp-2'>
          {template.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='flex flex-wrap gap-1'>
          <Badge variant='secondary' className='text-xs'>
            {template.category}
          </Badge>
          {template.tags.slice(0, 2).map(tag => (
            <Badge key={tag} variant='outline' className='text-xs'>
              {tag}
            </Badge>
          ))}
          {template.tags.length > 2 && (
            <Badge variant='outline' className='text-xs'>
              +{template.tags.length - 2}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
