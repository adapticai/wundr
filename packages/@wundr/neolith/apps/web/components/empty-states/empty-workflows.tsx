/**
 * Empty Workflows Component
 * @module components/empty-states/empty-workflows
 */
'use client';

import * as React from 'react';
import { Workflow } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

interface EmptyWorkflowsProps {
  onCreateWorkflow?: () => void;
  onViewExamples?: () => void;
}

export function EmptyWorkflows({
  onCreateWorkflow,
  onViewExamples,
}: EmptyWorkflowsProps) {
  return (
    <EmptyState
      icon={Workflow}
      title='No workflows yet'
      description='Build automated workflows to streamline your processes and connect your tools.'
      action={
        onCreateWorkflow
          ? {
              label: 'Create Workflow',
              onClick: onCreateWorkflow,
            }
          : undefined
      }
      secondaryAction={
        onViewExamples
          ? {
              label: 'View Examples',
              onClick: onViewExamples,
            }
          : undefined
      }
    />
  );
}
