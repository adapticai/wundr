'use client';

import { useState, useMemo, useCallback } from 'react';

import { cn } from '@/lib/utils';
import { TEMPLATE_CATEGORY_CONFIG, TRIGGER_TYPE_CONFIG } from '@/types/workflow';

import type { WorkflowTemplate, WorkflowTemplateCategory } from '@/types/workflow';

export interface TemplateGalleryProps {
  templates: WorkflowTemplate[];
  isLoading?: boolean;
  onUseTemplate: (template: WorkflowTemplate) => void;
  className?: string;
}

export function TemplateGallery({
  templates,
  isLoading = false,
  onUseTemplate,
  className,
}: TemplateGalleryProps) {
  const [selectedCategory, setSelectedCategory] = useState<WorkflowTemplateCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewTemplate, setPreviewTemplate] = useState<WorkflowTemplate | null>(null);

  // Get unique categories from templates
  const availableCategories = useMemo(() => {
    const categories = new Set(templates.map((t) => t.category));
    return Array.from(categories);
  }, [templates]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      // Category filter
      if (selectedCategory !== 'all' && template.category !== selectedCategory) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          template.name.toLowerCase().includes(query) ||
          template.description.toLowerCase().includes(query) ||
          template.tags.some((tag) => tag.toLowerCase().includes(query));
        if (!matchesSearch) {
return false;
}
      }

      return true;
    });
  }, [templates, selectedCategory, searchQuery]);

  const handleUseTemplate = useCallback((template: WorkflowTemplate) => {
    setPreviewTemplate(null);
    onUseTemplate(template);
  }, [onUseTemplate]);

  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        {/* Category Tabs Skeleton */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 w-24 animate-pulse rounded-md bg-muted" />
          ))}
        </div>

        {/* Grid Skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <TemplateCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Workflow Templates</h2>
          <p className="text-sm text-muted-foreground">
            Start with a pre-built template and customize it to your needs.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:w-64"
            aria-label="Search templates"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={cn(
            'shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            selectedCategory === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80',
          )}
        >
          All Templates
        </button>
        {availableCategories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setSelectedCategory(category)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
              selectedCategory === category
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            <CategoryIcon category={category} className="h-4 w-4" />
            {TEMPLATE_CATEGORY_CONFIG[category].label}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-12">
          <TemplateEmptyIcon className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">No templates found</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {searchQuery.trim()
              ? 'Try adjusting your search query.'
              : 'No templates available in this category.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onPreview={() => setPreviewTemplate(template)}
              onUse={() => handleUseTemplate(template)}
            />
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewTemplate && (
        <TemplatePreviewModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          onUse={() => handleUseTemplate(previewTemplate)}
        />
      )}
    </div>
  );
}

interface TemplateCardProps {
  template: WorkflowTemplate;
  onPreview: () => void;
  onUse: () => void;
}

function TemplateCard({ template, onPreview, onUse }: TemplateCardProps) {
  const triggerConfig = TRIGGER_TYPE_CONFIG[template.trigger.type];
  const categoryConfig = TEMPLATE_CATEGORY_CONFIG[template.category];

  return (
    <div className="group flex flex-col rounded-lg border bg-card transition-all hover:border-primary/50 hover:shadow-md">
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <CategoryIcon category={template.category} className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-foreground">{template.name}</h3>
          <p className="text-sm text-muted-foreground">{categoryConfig.label}</p>
        </div>
      </div>

      {/* Description */}
      <p className="px-4 pb-4 text-sm text-muted-foreground line-clamp-2">
        {template.description}
      </p>

      {/* Tags */}
      {template.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 px-4 pb-4">
          {template.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {tag}
            </span>
          ))}
          {template.tags.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{template.tags.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Metadata */}
      <div className="mt-auto border-t px-4 py-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <TriggerIcon className="h-3.5 w-3.5" />
              {triggerConfig.label}
            </span>
            <span className="flex items-center gap-1">
              <ActionCountIcon className="h-3.5 w-3.5" />
              {template.actions.length} actions
            </span>
          </div>
          <span className="flex items-center gap-1">
            <UsageIcon className="h-3.5 w-3.5" />
            {template.usageCount} uses
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex border-t">
        <button
          type="button"
          onClick={onPreview}
          className="flex-1 px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Preview
        </button>
        <div className="w-px bg-border" />
        <button
          type="button"
          onClick={onUse}
          className="flex-1 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
        >
          Use Template
        </button>
      </div>
    </div>
  );
}

function TemplateCardSkeleton() {
  return (
    <div className="flex flex-col rounded-lg border bg-card">
      <div className="flex items-start gap-3 p-4">
        <div className="h-10 w-10 animate-pulse rounded-lg bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-32 animate-pulse rounded bg-muted" />
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="space-y-2 px-4 pb-4">
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
      </div>
      <div className="mt-auto border-t px-4 py-3">
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
      </div>
      <div className="flex border-t">
        <div className="h-10 flex-1 animate-pulse bg-muted" />
        <div className="h-10 flex-1 animate-pulse bg-muted" />
      </div>
    </div>
  );
}

interface TemplatePreviewModalProps {
  template: WorkflowTemplate;
  onClose: () => void;
  onUse: () => void;
}

function TemplatePreviewModal({ template, onClose, onUse }: TemplatePreviewModalProps) {
  const triggerConfig = TRIGGER_TYPE_CONFIG[template.trigger.type];
  const categoryConfig = TEMPLATE_CATEGORY_CONFIG[template.category];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-background shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-preview-title"
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b bg-background p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <CategoryIcon category={template.category} className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 id="template-preview-title" className="font-semibold text-foreground">
                {template.name}
              </h2>
              <p className="text-sm text-muted-foreground">{categoryConfig.label}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close preview"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Description */}
          <div>
            <h3 className="text-sm font-medium text-foreground">Description</h3>
            <p className="mt-2 text-sm text-muted-foreground">{template.description}</p>
          </div>

          {/* Tags */}
          {template.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-foreground">Tags</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {template.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-sm text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Trigger */}
          <div>
            <h3 className="text-sm font-medium text-foreground">Trigger</h3>
            <div className="mt-2 flex items-center gap-3 rounded-md bg-blue-500/10 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
                <TriggerIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-foreground">{triggerConfig.label}</p>
                <p className="text-sm text-muted-foreground">{triggerConfig.description}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div>
            <h3 className="text-sm font-medium text-foreground">
              Actions ({template.actions.length})
            </h3>
            <div className="mt-2 space-y-2">
              {template.actions.map((action, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 rounded-md bg-muted/50 p-3"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    {index + 1}
                  </span>
                  <span className="text-sm text-foreground">
                    {action.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Variables */}
          {template.variables && template.variables.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-foreground">Variables</h3>
              <div className="mt-2 space-y-2">
                {template.variables.map((variable, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <p className="font-mono text-sm text-foreground">{variable.name}</p>
                      {variable.description && (
                        <p className="text-xs text-muted-foreground">{variable.description}</p>
                      )}
                    </div>
                    <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {variable.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-background p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onUse}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Use This Template
          </button>
        </div>
      </div>
    </div>
  );
}

// Category Icon component
interface CategoryIconProps {
  category: WorkflowTemplateCategory;
  className?: string;
}

function CategoryIcon({ category, className }: CategoryIconProps) {
  const icons: Record<WorkflowTemplateCategory, React.ReactNode> = {
    onboarding: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" y1="8" x2="19" y2="14" />
        <line x1="22" y1="11" x2="16" y2="11" />
      </svg>
    ),
    notifications: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    ),
    moderation: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      </svg>
    ),
    productivity: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    integration: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <path d="M12 2v6.5l3-3" />
        <path d="M12 2v6.5l-3-3" />
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <path d="M7 15h.01" />
        <path d="M17 15h.01" />
      </svg>
    ),
    custom: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  };

  return <>{icons[category]}</>;
}

// Icons
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function TemplateEmptyIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  );
}

function TriggerIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function ActionCountIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function UsageIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
