/**
 * Spec Review Form Component
 * Editable form view of generated entity spec
 * @module components/creation/spec-review-form
 */
'use client';

import * as React from 'react';
import { ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import type { EntityType, EntitySpec } from './types';

export interface SpecReviewFormProps {
  entityType: EntityType;
  spec: EntitySpec;
  onConfirm: (spec: EntitySpec) => void;
  onBackToChat: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

/**
 * SpecReviewForm - Form for reviewing and editing generated entity specs
 *
 * Features:
 * - Editable fields for all spec properties
 * - Validation feedback
 * - Confidence indicator
 * - Missing fields warnings
 * - AI suggestions display
 * - Preview of what will be created
 */
export function SpecReviewForm({
  entityType,
  spec: initialSpec,
  onConfirm,
  onBackToChat,
  onCancel,
  isSubmitting = false,
}: SpecReviewFormProps) {
  const [spec, setSpec] = React.useState<EntitySpec>(initialSpec);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  // Update spec when initialSpec changes
  React.useEffect(() => {
    setSpec(initialSpec);
  }, [initialSpec]);

  const handleFieldChange = (field: keyof EntitySpec, value: unknown) => {
    setSpec(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validateSpec = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!spec.name?.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!spec.description?.trim()) {
      newErrors.description = 'Description is required';
    }

    if (
      (entityType === 'orchestrator' ||
        entityType === 'session-manager' ||
        entityType === 'subagent') &&
      !spec.role?.trim()
    ) {
      newErrors.role = 'Role is required for agents';
    }

    if (
      (entityType === 'orchestrator' ||
        entityType === 'session-manager' ||
        entityType === 'subagent') &&
      !spec.charter?.trim()
    ) {
      newErrors.charter = 'Charter is required for agents';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConfirm = () => {
    if (validateSpec()) {
      onConfirm(spec);
    }
  };

  const showRoleField =
    entityType === 'orchestrator' ||
    entityType === 'session-manager' ||
    entityType === 'subagent';
  const showCharterField =
    entityType === 'orchestrator' ||
    entityType === 'session-manager' ||
    entityType === 'subagent';

  return (
    <div className='flex h-full flex-col'>
      {/* Header */}
      <div className='border-b px-6 py-4'>
        <div className='flex items-center gap-2'>
          <Button
            variant='ghost'
            size='icon'
            onClick={onBackToChat}
            disabled={isSubmitting}
            aria-label='Back to conversation'
          >
            <ArrowLeft className='h-4 w-4' />
          </Button>
          <div>
            <h2 className='text-lg font-semibold'>
              Review {getEntityDisplayName(entityType)}
            </h2>
            <p className='text-sm text-muted-foreground'>
              Review and edit the details before creating
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className='flex-1 overflow-y-auto px-6 py-4'>
        <div className='mx-auto max-w-2xl space-y-6'>
          {/* Confidence Indicator */}
          <ConfidenceIndicator confidence={spec.confidence} />

          {/* Missing Fields Warning */}
          {spec.missingFields.length > 0 && (
            <Alert>
              <AlertCircle className='h-4 w-4' />
              <AlertDescription>
                Some fields may need attention: {spec.missingFields.join(', ')}
              </AlertDescription>
            </Alert>
          )}

          {/* AI Suggestions */}
          {spec.suggestions.length > 0 && (
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-sm font-medium'>
                  AI Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className='space-y-1 text-sm text-muted-foreground'>
                  {spec.suggestions.map((suggestion, i) => (
                    <li key={i} className='flex gap-2'>
                      <span className='text-primary'>•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Form Fields */}
          <div className='space-y-4'>
            {/* Name */}
            <div className='space-y-2'>
              <Label htmlFor='name' className='required'>
                Name
              </Label>
              <Input
                id='name'
                value={spec.name}
                onChange={e => handleFieldChange('name', e.target.value)}
                placeholder={`Enter ${entityType} name`}
                className={cn(errors.name && 'border-destructive')}
                disabled={isSubmitting}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'name-error' : undefined}
              />
              {errors.name && (
                <p id='name-error' className='text-sm text-destructive'>
                  {errors.name}
                </p>
              )}
            </div>

            {/* Description */}
            <div className='space-y-2'>
              <Label htmlFor='description' className='required'>
                Description
              </Label>
              <Textarea
                id='description'
                value={spec.description}
                onChange={e => handleFieldChange('description', e.target.value)}
                placeholder={`Describe the purpose of this ${entityType}`}
                rows={3}
                className={cn(errors.description && 'border-destructive')}
                disabled={isSubmitting}
                aria-invalid={!!errors.description}
                aria-describedby={
                  errors.description ? 'description-error' : undefined
                }
              />
              {errors.description && (
                <p id='description-error' className='text-sm text-destructive'>
                  {errors.description}
                </p>
              )}
            </div>

            {/* Role (for agents) */}
            {showRoleField && (
              <div className='space-y-2'>
                <Label htmlFor='role' className='required'>
                  Role
                </Label>
                <Input
                  id='role'
                  value={spec.role || ''}
                  onChange={e => handleFieldChange('role', e.target.value)}
                  placeholder='e.g., Customer Support Lead, Research Analyst'
                  className={cn(errors.role && 'border-destructive')}
                  disabled={isSubmitting}
                  aria-invalid={!!errors.role}
                  aria-describedby={errors.role ? 'role-error' : undefined}
                />
                {errors.role && (
                  <p id='role-error' className='text-sm text-destructive'>
                    {errors.role}
                  </p>
                )}
              </div>
            )}

            {/* Charter (for agents) */}
            {showCharterField && (
              <div className='space-y-2'>
                <Label htmlFor='charter' className='required'>
                  Charter
                </Label>
                <Textarea
                  id='charter'
                  value={spec.charter || ''}
                  onChange={e => handleFieldChange('charter', e.target.value)}
                  placeholder='Define the responsibilities and guidelines for this agent'
                  rows={5}
                  className={cn(errors.charter && 'border-destructive')}
                  disabled={isSubmitting}
                  aria-invalid={!!errors.charter}
                  aria-describedby={
                    errors.charter ? 'charter-error' : undefined
                  }
                />
                {errors.charter && (
                  <p id='charter-error' className='text-sm text-destructive'>
                    {errors.charter}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Preview */}
          <SpecPreview spec={spec} entityType={entityType} />
        </div>
      </div>

      {/* Footer */}
      <div className='border-t px-6 py-4'>
        <div className='flex items-center justify-between'>
          <Button variant='ghost' onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              onClick={onBackToChat}
              disabled={isSubmitting}
            >
              Back to Chat
            </Button>
            <Button onClick={handleConfirm} disabled={isSubmitting}>
              {isSubmitting
                ? 'Creating...'
                : `Create ${getEntityDisplayName(entityType)}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ConfidenceIndicator - Shows AI confidence in the generated spec
 */
function ConfidenceIndicator({ confidence }: { confidence: number }) {
  const percentage = Math.round(confidence * 100);
  const level =
    confidence >= 0.8 ? 'high' : confidence >= 0.5 ? 'medium' : 'low';

  const colors = {
    high: 'text-green-600 bg-green-50 border-green-200',
    medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    low: 'text-orange-600 bg-orange-50 border-orange-200',
  };

  return (
    <div className={cn('rounded-lg border p-4', colors[level])}>
      <div className='flex items-center gap-2'>
        <CheckCircle2 className='h-4 w-4' />
        <span className='text-sm font-medium'>
          AI Confidence: {percentage}%
        </span>
      </div>
      <p className='mt-1 text-xs opacity-80'>
        {level === 'high' &&
          'The AI is confident this spec is complete and accurate.'}
        {level === 'medium' &&
          'The AI has a reasonable understanding but some details may need refinement.'}
        {level === 'low' &&
          'The AI needs more information. Consider continuing the conversation.'}
      </p>
    </div>
  );
}

/**
 * SpecPreview - Shows a preview of what will be created
 */
function SpecPreview({
  spec,
  entityType,
}: {
  spec: EntitySpec;
  entityType: EntityType;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-sm font-medium'>Preview</CardTitle>
        <CardDescription>
          This is what will be created based on your specification
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-3'>
        <PreviewField label='Type' value={getEntityDisplayName(entityType)} />
        <PreviewField label='Name' value={spec.name || '(not set)'} />
        <PreviewField
          label='Description'
          value={spec.description || '(not set)'}
        />
        {spec.role && <PreviewField label='Role' value={spec.role} />}
        {spec.charter && (
          <PreviewField label='Charter' value={spec.charter} multiline />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * PreviewField - Individual field in the preview
 */
function PreviewField({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <div className='text-xs font-medium text-muted-foreground'>{label}</div>
      <div
        className={cn(
          'mt-1 text-sm',
          multiline && 'whitespace-pre-wrap',
          !value.trim() && 'italic text-muted-foreground'
        )}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * Get entity display name for UI
 */
function getEntityDisplayName(entityType: EntityType): string {
  const names: Record<EntityType, string> = {
    workspace: 'Workspace',
    orchestrator: 'Orchestrator',
    'session-manager': 'Session Manager',
    subagent: 'Subagent',
    workflow: 'Workflow',
    channel: 'Channel',
  };
  return names[entityType] || entityType;
}
