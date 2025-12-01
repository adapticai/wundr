'use client';

import { useState, useMemo, useCallback } from 'react';
import { Search, Check, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

/**
 * Tool definition from neolith-mcp-server registry
 */
export interface MCPTool {
  name: string;
  description: string;
  category:
    | 'workspace'
    | 'channels'
    | 'messaging'
    | 'files'
    | 'users'
    | 'search'
    | 'orchestrators'
    | 'session-managers'
    | 'subagents';
}

/**
 * Props for CharterTools component
 */
export interface CharterToolsProps {
  /** Currently selected tool names */
  selectedTools: string[];
  /** Callback when tool selection changes */
  onChange: (tools: string[]) => void;
  /** Available MCP tools from the server */
  availableTools: MCPTool[];
  /** Optional className for styling */
  className?: string;
  /** Whether the component is in a loading state */
  isLoading?: boolean;
  /** Whether the component is disabled */
  disabled?: boolean;
}

/**
 * Category metadata for display
 */
const CATEGORY_METADATA: Record<
  string,
  {
    label: string;
    description: string;
    variant: 'default' | 'secondary' | 'outline';
  }
> = {
  messaging: {
    label: 'Messaging',
    description: 'Send, edit, and manage messages',
    variant: 'default',
  },
  channels: {
    label: 'Channels',
    description: 'Create and manage channels',
    variant: 'secondary',
  },
  files: {
    label: 'Files',
    description: 'Upload, download, and share files',
    variant: 'outline',
  },
  users: {
    label: 'Users',
    description: 'Manage user profiles and presence',
    variant: 'default',
  },
  search: {
    label: 'Search',
    description: 'Search across messages, files, and content',
    variant: 'secondary',
  },
  orchestrators: {
    label: 'Orchestrators',
    description: 'Coordinate and delegate to other orchestrators',
    variant: 'outline',
  },
  'session-managers': {
    label: 'Session Managers',
    description: 'Manage conversation sessions',
    variant: 'default',
  },
  subagents: {
    label: 'Subagents',
    description: 'Work with specialized subagents',
    variant: 'secondary',
  },
  workspace: {
    label: 'Workspace',
    description: 'Manage workspace settings and members',
    variant: 'outline',
  },
};

/**
 * CharterTools Component
 *
 * Allows selecting which MCP tools an orchestrator can use.
 * Tools are grouped by category with search/filter functionality.
 */
export function CharterTools({
  selectedTools,
  onChange,
  availableTools,
  className,
  isLoading = false,
  disabled = false,
}: CharterToolsProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Group tools by category
  const toolsByCategory = useMemo(() => {
    const grouped = new Map<string, MCPTool[]>();

    for (const tool of availableTools) {
      const category = tool.category;
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(tool);
    }

    // Sort tools within each category by name
    for (const tools of grouped.values()) {
      tools.sort((a, b) => a.name.localeCompare(b.name));
    }

    return grouped;
  }, [availableTools]);

  // Filter tools based on search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) {
      return toolsByCategory;
    }

    const query = searchQuery.toLowerCase();
    const filtered = new Map<string, MCPTool[]>();

    for (const [category, tools] of toolsByCategory.entries()) {
      const matchingTools = tools.filter(
        tool =>
          tool.name.toLowerCase().includes(query) ||
          tool.description.toLowerCase().includes(query) ||
          category.toLowerCase().includes(query)
      );

      if (matchingTools.length > 0) {
        filtered.set(category, matchingTools);
      }
    }

    return filtered;
  }, [toolsByCategory, searchQuery]);

  // Handle selecting/deselecting a tool
  const handleToolToggle = useCallback(
    (toolName: string) => {
      if (disabled || isLoading) return;

      const isSelected = selectedTools.includes(toolName);
      const updated = isSelected
        ? selectedTools.filter(name => name !== toolName)
        : [...selectedTools, toolName];

      onChange(updated);
    },
    [selectedTools, onChange, disabled, isLoading]
  );

  // Handle selecting/deselecting all tools in a category
  const handleCategoryToggle = useCallback(
    (category: string) => {
      if (disabled || isLoading) return;

      const categoryTools = toolsByCategory.get(category) || [];
      const categoryToolNames = categoryTools.map(t => t.name);
      const allSelected = categoryToolNames.every(name =>
        selectedTools.includes(name)
      );

      const updated = allSelected
        ? selectedTools.filter(name => !categoryToolNames.includes(name))
        : [...new Set([...selectedTools, ...categoryToolNames])];

      onChange(updated);
    },
    [toolsByCategory, selectedTools, onChange, disabled, isLoading]
  );

  // Handle select all / deselect all
  const handleToggleAll = useCallback(() => {
    if (disabled || isLoading) return;

    const allToolNames = availableTools.map(t => t.name);
    const allSelected = allToolNames.every(name =>
      selectedTools.includes(name)
    );

    onChange(allSelected ? [] : allToolNames);
  }, [availableTools, selectedTools, onChange, disabled, isLoading]);

  const selectedCount = selectedTools.length;
  const totalCount = availableTools.length;
  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with search and actions */}
      <div className='flex items-center justify-between gap-4'>
        <div className='flex-1'>
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              type='text'
              placeholder='Search tools by name or description...'
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              disabled={disabled || isLoading}
              className='pl-9'
            />
            {searchQuery && (
              <button
                type='button'
                onClick={() => setSearchQuery('')}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
                aria-label='Clear search'
              >
                <X className='h-4 w-4' />
              </button>
            )}
          </div>
        </div>
        <div className='flex items-center gap-3'>
          <span className='text-sm text-muted-foreground'>
            {selectedCount} / {totalCount} selected
          </span>
          <button
            type='button'
            onClick={handleToggleAll}
            disabled={disabled || isLoading || totalCount === 0}
            className='text-sm font-medium text-primary hover:underline disabled:opacity-50 disabled:no-underline'
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      </div>

      {/* Tool categories */}
      {filteredCategories.size === 0 ? (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12'>
            <p className='text-center text-muted-foreground'>
              {searchQuery
                ? 'No tools match your search'
                : 'No tools available'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className='space-y-4'>
          {Array.from(filteredCategories.entries()).map(([category, tools]) => {
            const metadata = CATEGORY_METADATA[category] || {
              label: category,
              description: '',
              variant: 'default' as const,
            };

            const categoryToolNames = tools.map(t => t.name);
            const categorySelectedCount = categoryToolNames.filter(name =>
              selectedTools.includes(name)
            ).length;
            const categoryAllSelected =
              categorySelectedCount === categoryToolNames.length &&
              categoryToolNames.length > 0;

            return (
              <Card key={category}>
                <CardHeader className='pb-3'>
                  <div className='flex items-start justify-between'>
                    <div className='flex-1 space-y-1'>
                      <div className='flex items-center gap-2'>
                        <CardTitle className='text-base'>
                          {metadata.label}
                        </CardTitle>
                        <Badge variant={metadata.variant}>
                          {categorySelectedCount} / {categoryToolNames.length}
                        </Badge>
                      </div>
                      {metadata.description && (
                        <CardDescription className='text-xs'>
                          {metadata.description}
                        </CardDescription>
                      )}
                    </div>
                    <button
                      type='button'
                      onClick={() => handleCategoryToggle(category)}
                      disabled={disabled || isLoading}
                      className='ml-4 text-xs font-medium text-primary hover:underline disabled:opacity-50 disabled:no-underline'
                    >
                      {categoryAllSelected ? 'Deselect' : 'Select'} All
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className='space-y-3'>
                    {tools.map(tool => {
                      const isSelected = selectedTools.includes(tool.name);
                      const toolId = `tool-${tool.name}`;

                      return (
                        <div
                          key={tool.name}
                          className={cn(
                            'flex items-start gap-3 rounded-md border p-3 transition-colors',
                            isSelected
                              ? 'border-primary bg-primary/5'
                              : 'border-border bg-background hover:bg-accent/50',
                            disabled || isLoading
                              ? 'cursor-not-allowed opacity-50'
                              : 'cursor-pointer'
                          )}
                          onClick={() => handleToolToggle(tool.name)}
                        >
                          <Checkbox
                            id={toolId}
                            checked={isSelected}
                            onCheckedChange={() => handleToolToggle(tool.name)}
                            disabled={disabled || isLoading}
                            className='mt-0.5'
                          />
                          <div className='flex-1 space-y-1'>
                            <Label
                              htmlFor={toolId}
                              className='cursor-pointer font-mono text-xs font-medium leading-tight'
                            >
                              {tool.name}
                            </Label>
                            <p className='text-xs text-muted-foreground leading-relaxed'>
                              {tool.description}
                            </p>
                          </div>
                          {isSelected && (
                            <Check className='h-4 w-4 flex-shrink-0 text-primary' />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
