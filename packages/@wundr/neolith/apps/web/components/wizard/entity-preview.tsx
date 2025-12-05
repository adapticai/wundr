/**
 * Entity Preview Component
 * Live preview of entity being created with edit capabilities
 * @module components/wizard/entity-preview
 */
'use client';

import {
  User,
  Building2,
  Workflow as WorkflowIcon,
  MessageSquare,
  Hash,
  Bot,
  Edit2,
  AlertCircle,
  CheckCircle2,
  Users,
  Target,
  Zap,
} from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { EntityType } from '@/lib/ai';
import { getEntityDisplayName } from '@/lib/ai';
import { cn } from '@/lib/utils';

export interface EntityPreviewProps {
  /** Type of entity */
  entityType: EntityType;
  /** Extracted entity data */
  data: Record<string, unknown>;
  /** Callback when user wants to edit a field */
  onEdit?: (fieldName: string) => void;
  /** Show edit buttons */
  showEditButtons?: boolean;
  /** Compact mode */
  compact?: boolean;
}

/**
 * EntityPreview - Visual preview of entity with validation indicators
 *
 * Features:
 * - Type-specific layouts and icons
 * - Field validation indicators
 * - Edit buttons for each field
 * - Missing field warnings
 * - Array/object field rendering
 * - Progress indicators
 */
export function EntityPreview({
  entityType,
  data,
  onEdit,
  showEditButtons = true,
  compact = false,
}: EntityPreviewProps) {
  const icon = getEntityIcon(entityType);
  const requiredFields = getRequiredFieldsForEntity(entityType);
  const missingFields = requiredFields.filter(field => {
    const value = data[field];
    if (Array.isArray(value)) {
      return value.length === 0;
    }
    return value === undefined || value === null || value === '';
  });

  const completionPercentage =
    ((requiredFields.length - missingFields.length) / requiredFields.length) *
    100;

  return (
    <div className={cn('space-y-6', compact && 'space-y-4')}>
      {/* Header */}
      <div className='flex items-start justify-between'>
        <div className='flex items-start gap-4'>
          <div className='rounded-lg bg-primary/10 p-3'>{icon}</div>
          <div>
            <h3 className='text-xl font-semibold'>
              {(data.name as string) ||
                `New ${getEntityDisplayName(entityType)}`}
            </h3>
            <p className='text-sm text-muted-foreground'>
              {getEntityDisplayName(entityType)}
            </p>
          </div>
        </div>

        {/* Completion Badge */}
        <Badge
          variant={completionPercentage === 100 ? 'default' : 'secondary'}
          className='gap-1'
        >
          {completionPercentage === 100 ? (
            <CheckCircle2 className='h-3 w-3' />
          ) : (
            <AlertCircle className='h-3 w-3' />
          )}
          {Math.round(completionPercentage)}% Complete
        </Badge>
      </div>

      {/* Missing Fields Warning */}
      {missingFields.length > 0 && (
        <Card className='border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950'>
          <CardContent className='pt-6'>
            <div className='flex items-start gap-3'>
              <AlertCircle className='h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5' />
              <div className='flex-1'>
                <p className='font-medium text-amber-900 dark:text-amber-100'>
                  Missing Required Fields
                </p>
                <p className='text-sm text-amber-700 dark:text-amber-200 mt-1'>
                  The following fields are required: {missingFields.join(', ')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entity-Specific Preview */}
      {entityType === 'workspace' && (
        <WorkspacePreview
          data={data}
          onEdit={onEdit}
          showEdit={showEditButtons}
        />
      )}
      {entityType === 'orchestrator' && (
        <OrchestratorPreview
          data={data}
          onEdit={onEdit}
          showEdit={showEditButtons}
        />
      )}
      {entityType === 'session-manager' && (
        <SessionManagerPreview
          data={data}
          onEdit={onEdit}
          showEdit={showEditButtons}
        />
      )}
      {entityType === 'workflow' && (
        <WorkflowPreview
          data={data}
          onEdit={onEdit}
          showEdit={showEditButtons}
        />
      )}
      {entityType === 'channel' && (
        <ChannelPreview
          data={data}
          onEdit={onEdit}
          showEdit={showEditButtons}
        />
      )}
      {entityType === 'subagent' && (
        <SubagentPreview
          data={data}
          onEdit={onEdit}
          showEdit={showEditButtons}
        />
      )}
    </div>
  );
}

/** Workspace Preview */
function WorkspacePreview({
  data,
  onEdit,
  showEdit,
}: {
  data: Record<string, unknown>;
  onEdit?: (field: string) => void;
  showEdit: boolean;
}) {
  return (
    <div className='space-y-4'>
      <PreviewField
        label='Name'
        value={data.name as string}
        icon={<Building2 className='h-4 w-4' />}
        onEdit={() => onEdit?.('name')}
        showEdit={showEdit}
      />
      <PreviewField
        label='Description'
        value={data.description as string}
        onEdit={() => onEdit?.('description')}
        showEdit={showEdit}
      />
      <PreviewField
        label='Purpose'
        value={data.purpose as string}
        onEdit={() => onEdit?.('purpose')}
        showEdit={showEdit}
      />
      {!!data.organizationType && (
        <PreviewField
          label='Organization Type'
          value={String(data.organizationType)}
          icon={<Building2 className='h-4 w-4' />}
        />
      )}
      {!!data.teamSize && (
        <PreviewField
          label='Team Size'
          value={String(data.teamSize)}
          icon={<Users className='h-4 w-4' />}
        />
      )}
      {!!data.teamStructure && Array.isArray(data.teamStructure) && (
        <ArrayField
          label='Team Structure'
          items={data.teamStructure}
          renderItem={(item: any) => (
            <div className='text-sm'>
              <span className='font-medium'>{String(item.role ?? '')}</span>
              {item.count && ` (${String(item.count)})`}
              {item.responsibilities && (
                <p className='text-muted-foreground mt-1'>
                  {String(item.responsibilities)}
                </p>
              )}
            </div>
          )}
        />
      )}
    </div>
  );
}

/** Orchestrator Preview */
function OrchestratorPreview({
  data,
  onEdit,
  showEdit,
}: {
  data: Record<string, unknown>;
  onEdit?: (field: string) => void;
  showEdit: boolean;
}) {
  return (
    <div className='space-y-4'>
      <PreviewField
        label='Name'
        value={data.name as string}
        icon={<User className='h-4 w-4' />}
        onEdit={() => onEdit?.('name')}
        showEdit={showEdit}
      />
      <PreviewField
        label='Role'
        value={data.role as string}
        icon={<Badge className='h-4 w-4' />}
        onEdit={() => onEdit?.('role')}
        showEdit={showEdit}
      />
      <PreviewField
        label='Description'
        value={data.description as string}
        onEdit={() => onEdit?.('description')}
        showEdit={showEdit}
      />
      {!!data.capabilities && Array.isArray(data.capabilities) && (
        <ArrayField
          label='Capabilities'
          items={data.capabilities}
          icon={<Zap className='h-4 w-4' />}
          renderItem={(item: unknown) => (
            <Badge variant='secondary'>{String(item)}</Badge>
          )}
        />
      )}
      {!!data.goals && Array.isArray(data.goals) && (
        <ArrayField
          label='Goals'
          items={data.goals}
          icon={<Target className='h-4 w-4' />}
          renderItem={(item: unknown) => (
            <li className='text-sm list-disc ml-4'>{String(item)}</li>
          )}
        />
      )}
      {!!data.communicationStyle && (
        <PreviewField
          label='Communication Style'
          value={String(data.communicationStyle)}
          icon={<MessageSquare className='h-4 w-4' />}
        />
      )}
    </div>
  );
}

/** Session Manager Preview */
function SessionManagerPreview({
  data,
  onEdit,
  showEdit,
}: {
  data: Record<string, unknown>;
  onEdit?: (field: string) => void;
  showEdit: boolean;
}) {
  return (
    <div className='space-y-4'>
      <PreviewField
        label='Name'
        value={data.name as string}
        icon={<Bot className='h-4 w-4' />}
        onEdit={() => onEdit?.('name')}
        showEdit={showEdit}
      />
      <PreviewField
        label='Responsibilities'
        value={data.responsibilities as string}
        onEdit={() => onEdit?.('responsibilities')}
        showEdit={showEdit}
      />
      {!!data.parentOrchestrator && (
        <PreviewField
          label='Parent Orchestrator'
          value={String(data.parentOrchestrator)}
          icon={<User className='h-4 w-4' />}
        />
      )}
      {!!data.context && (
        <PreviewField
          label='Context'
          value={String(data.context)}
          icon={<MessageSquare className='h-4 w-4' />}
        />
      )}
      {!!data.escalationCriteria && Array.isArray(data.escalationCriteria) && (
        <ArrayField
          label='Escalation Criteria'
          items={data.escalationCriteria}
          renderItem={(item: unknown) => (
            <li className='text-sm list-disc ml-4'>{String(item)}</li>
          )}
        />
      )}
    </div>
  );
}

/** Workflow Preview */
function WorkflowPreview({
  data,
  onEdit,
  showEdit,
}: {
  data: Record<string, unknown>;
  onEdit?: (field: string) => void;
  showEdit: boolean;
}) {
  const trigger = data.trigger as {
    type: string;
    config?: Record<string, unknown>;
  };
  const actions = data.actions as Array<{
    action: string;
    description: string;
  }>;

  return (
    <div className='space-y-4'>
      <PreviewField
        label='Name'
        value={data.name as string}
        icon={<WorkflowIcon className='h-4 w-4' />}
        onEdit={() => onEdit?.('name')}
        showEdit={showEdit}
      />
      <PreviewField
        label='Description'
        value={data.description as string}
        onEdit={() => onEdit?.('description')}
        showEdit={showEdit}
      />
      {trigger && (
        <Card>
          <CardHeader>
            <CardTitle className='text-sm'>Trigger</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge>{trigger.type}</Badge>
            {trigger.config && (
              <pre className='text-xs mt-2 p-2 bg-muted rounded'>
                {JSON.stringify(trigger.config, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>
      )}
      {actions && actions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className='text-sm'>
              Actions ({actions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            {actions.map((action, idx) => (
              <div key={idx} className='flex items-start gap-3'>
                <div className='flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium'>
                  {idx + 1}
                </div>
                <div className='flex-1'>
                  <p className='font-medium text-sm'>{action.action}</p>
                  <p className='text-sm text-muted-foreground'>
                    {action.description}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** Channel Preview */
function ChannelPreview({
  data,
  onEdit,
  showEdit,
}: {
  data: Record<string, unknown>;
  onEdit?: (field: string) => void;
  showEdit: boolean;
}) {
  return (
    <div className='space-y-4'>
      <PreviewField
        label='Name'
        value={data.name as string}
        icon={<Hash className='h-4 w-4' />}
        onEdit={() => onEdit?.('name')}
        showEdit={showEdit}
      />
      {!!data.description && (
        <PreviewField label='Description' value={String(data.description)} />
      )}
      {!!data.type && (
        <PreviewField
          label='Type'
          value={String(data.type)}
          icon={<MessageSquare className='h-4 w-4' />}
        />
      )}
      {!!data.members && Array.isArray(data.members) && (
        <ArrayField
          label='Members'
          items={data.members}
          icon={<Users className='h-4 w-4' />}
          renderItem={(item: unknown) => (
            <Badge variant='outline'>{String(item)}</Badge>
          )}
        />
      )}
    </div>
  );
}

/** Subagent Preview */
function SubagentPreview({
  data,
  onEdit,
  showEdit,
}: {
  data: Record<string, unknown>;
  onEdit?: (field: string) => void;
  showEdit: boolean;
}) {
  return (
    <div className='space-y-4'>
      <PreviewField
        label='Name'
        value={data.name as string}
        icon={<Bot className='h-4 w-4' />}
        onEdit={() => onEdit?.('name')}
        showEdit={showEdit}
      />
      {!!data.description && (
        <PreviewField
          label='Description'
          value={String(data.description)}
          onEdit={() => onEdit?.('description')}
          showEdit={showEdit}
        />
      )}
      {!!data.capabilities && Array.isArray(data.capabilities) && (
        <ArrayField
          label='Capabilities'
          items={data.capabilities}
          icon={<Zap className='h-4 w-4' />}
          renderItem={(item: unknown) => (
            <Badge variant='secondary'>{String(item)}</Badge>
          )}
        />
      )}
      {!!data.parentId && (
        <PreviewField
          label='Parent Agent'
          value={String(data.parentId)}
          icon={<User className='h-4 w-4' />}
        />
      )}
    </div>
  );
}

/** Preview Field Component */
function PreviewField({
  label,
  value,
  icon,
  onEdit,
  showEdit = false,
}: {
  label: string;
  value?: string;
  icon?: React.ReactNode;
  onEdit?: () => void;
  showEdit?: boolean;
}) {
  const isEmpty = !value || value.trim() === '';

  return (
    <Card className={cn(isEmpty && 'border-dashed border-amber-200')}>
      <CardContent className='pt-6'>
        <div className='flex items-start justify-between gap-4'>
          <div className='flex-1'>
            <div className='flex items-center gap-2 mb-2'>
              {icon}
              <p className='text-sm font-medium'>{label}</p>
            </div>
            {isEmpty ? (
              <p className='text-sm text-muted-foreground italic'>
                Not provided
              </p>
            ) : (
              <p className='text-sm whitespace-pre-wrap'>{value}</p>
            )}
          </div>
          {showEdit && onEdit && (
            <Button
              variant='ghost'
              size='sm'
              onClick={onEdit}
              className='shrink-0'
            >
              <Edit2 className='h-3 w-3' />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Array Field Component */
function ArrayField({
  label,
  items,
  icon,
  renderItem,
}: {
  label: string;
  items: unknown[];
  icon?: React.ReactNode;
  renderItem: (item: unknown, index: number) => React.ReactNode;
}) {
  const isEmpty = items.length === 0;

  return (
    <Card className={cn(isEmpty && 'border-dashed border-amber-200')}>
      <CardHeader>
        <div className='flex items-center gap-2'>
          {icon}
          <CardTitle className='text-sm'>
            {label} ({items.length})
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <p className='text-sm text-muted-foreground italic'>No items</p>
        ) : (
          <div className='space-y-2 flex flex-wrap gap-2'>
            {items.map((item, idx) => (
              <React.Fragment key={idx}>{renderItem(item, idx)}</React.Fragment>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Get entity icon */
function getEntityIcon(entityType: EntityType) {
  const icons: Record<EntityType, React.ReactNode> = {
    workspace: <Building2 className='h-6 w-6 text-primary' />,
    orchestrator: <User className='h-6 w-6 text-primary' />,
    'session-manager': <Bot className='h-6 w-6 text-primary' />,
    workflow: <WorkflowIcon className='h-6 w-6 text-primary' />,
    channel: <Hash className='h-6 w-6 text-primary' />,
    subagent: <Bot className='h-6 w-6 text-primary' />,
  };

  return icons[entityType];
}

/** Get required fields for entity type */
function getRequiredFieldsForEntity(entityType: EntityType): string[] {
  const fieldMap: Record<EntityType, string[]> = {
    workspace: ['name', 'description', 'purpose'],
    orchestrator: ['name', 'role', 'description', 'capabilities'],
    'session-manager': ['name', 'responsibilities'],
    workflow: ['name', 'description', 'trigger', 'actions'],
    channel: ['name', 'type'],
    subagent: ['name', 'description', 'capabilities'],
  };

  return fieldMap[entityType] || ['name', 'description'];
}
