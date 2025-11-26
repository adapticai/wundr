/**
 * Entity Type Selector
 * UI for selecting what type of entity to create
 * @module components/creation/entity-type-selector
 */
'use client';

import * as React from 'react';
import {
  Bot,
  Workflow,
  MessageSquare,
  FolderKanban,
  Users,
  GitBranch,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EntityType } from './types';

export interface EntityTypeInfo {
  id: EntityType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  color: string;
}

export const ENTITY_TYPES: EntityTypeInfo[] = [
  {
    id: 'orchestrator',
    label: 'Orchestrator',
    icon: Bot,
    description: 'Autonomous agent with charter and role',
    color: 'text-blue-500',
  },
  {
    id: 'session-manager',
    label: 'Session Manager',
    icon: Users,
    description: 'Monitors channels and orchestrates conversations',
    color: 'text-purple-500',
  },
  {
    id: 'subagent',
    label: 'Subagent',
    icon: GitBranch,
    description: 'Specialized worker for specific tasks',
    color: 'text-green-500',
  },
  {
    id: 'workflow',
    label: 'Workflow',
    icon: Workflow,
    description: 'Automated process flow with steps',
    color: 'text-orange-500',
  },
  {
    id: 'channel',
    label: 'Channel',
    icon: MessageSquare,
    description: 'Communication space for teams and agents',
    color: 'text-pink-500',
  },
  {
    id: 'workspace',
    label: 'Workspace',
    icon: FolderKanban,
    description: 'Collaborative space for teams and projects',
    color: 'text-indigo-500',
  },
];

export interface EntityTypeSelectorProps {
  /** Callback when entity type is selected */
  onSelect: (entityType: EntityType) => void;
  /** Currently selected entity type (if any) */
  selected?: EntityType;
  /** Whether to show as compact list or grid */
  variant?: 'grid' | 'list';
  /** Whether selector is disabled */
  disabled?: boolean;
}

/**
 * EntityTypeSelector - Allows users to choose which type of entity to create
 *
 * Features:
 * - Visual cards for each entity type
 * - Icon, label, and description
 * - Grid or list layout
 * - Keyboard navigation
 * - Accessibility support
 */
export function EntityTypeSelector({
  onSelect,
  selected,
  variant = 'grid',
  disabled = false,
}: EntityTypeSelectorProps) {
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    entityType: EntityType,
  ) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(entityType);
    }
  };

  if (variant === 'list') {
    return (
      <div className="space-y-2" role="list" aria-label="Select entity type">
        {ENTITY_TYPES.map((type) => (
          <EntityTypeButton
            key={type.id}
            type={type}
            selected={selected === type.id}
            onSelect={onSelect}
            onKeyDown={handleKeyDown}
            disabled={disabled}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      role="list"
      aria-label="Select entity type"
    >
      {ENTITY_TYPES.map((type) => (
        <EntityTypeCard
          key={type.id}
          type={type}
          selected={selected === type.id}
          onSelect={onSelect}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

/**
 * EntityTypeCard - Card representation of an entity type (for grid layout)
 */
interface EntityTypeCardProps {
  type: EntityTypeInfo;
  selected: boolean;
  onSelect: (entityType: EntityType) => void;
  disabled: boolean;
}

function EntityTypeCard({
  type,
  selected,
  onSelect,
  disabled,
}: EntityTypeCardProps) {
  const Icon = type.icon;

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        selected && 'ring-2 ring-primary',
        disabled && 'cursor-not-allowed opacity-50',
      )}
      onClick={() => !disabled && onSelect(type.id)}
      role="listitem"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
          e.preventDefault();
          onSelect(type.id);
        }
      }}
      aria-selected={selected}
      aria-disabled={disabled}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg bg-muted',
              selected && 'bg-primary/10',
            )}
          >
            <Icon className={cn('h-5 w-5', type.color)} />
          </div>
          <CardTitle className="text-base">{type.label}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-sm">{type.description}</CardDescription>
      </CardContent>
    </Card>
  );
}

/**
 * EntityTypeButton - Button representation of an entity type (for list layout)
 */
interface EntityTypeButtonProps {
  type: EntityTypeInfo;
  selected: boolean;
  onSelect: (entityType: EntityType) => void;
  onKeyDown: (
    e: React.KeyboardEvent<HTMLButtonElement>,
    entityType: EntityType,
  ) => void;
  disabled: boolean;
}

function EntityTypeButton({
  type,
  selected,
  onSelect,
  onKeyDown,
  disabled,
}: EntityTypeButtonProps) {
  const Icon = type.icon;

  return (
    <Button
      variant={selected ? 'default' : 'outline'}
      className="h-auto w-full justify-start gap-3 px-4 py-3"
      onClick={() => onSelect(type.id)}
      onKeyDown={(e) => onKeyDown(e, type.id)}
      disabled={disabled}
      role="listitem"
      aria-selected={selected}
    >
      <Icon className={cn('h-5 w-5', selected ? 'text-primary-foreground' : type.color)} />
      <div className="flex flex-col items-start gap-0.5">
        <span className="font-medium">{type.label}</span>
        <span className={cn(
          'text-xs',
          selected ? 'text-primary-foreground/80' : 'text-muted-foreground',
        )}>
          {type.description}
        </span>
      </div>
    </Button>
  );
}

/**
 * Get entity type info by ID
 */
export function getEntityTypeInfo(entityType: EntityType): EntityTypeInfo | undefined {
  return ENTITY_TYPES.find((t) => t.id === entityType);
}
