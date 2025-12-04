/**
 * Workflow Preview Component
 * Visual preview of workflow structure
 */
'use client';

import { TRIGGER_TYPE_CONFIG, ACTION_TYPE_CONFIG } from '@/types/workflow';

import type { TriggerConfig, ActionConfig } from '@/types/workflow';

interface WorkflowPreviewProps {
  name: string;
  description?: string;
  trigger: TriggerConfig;
  actions: ActionConfig[];
}

export function WorkflowPreview({
  name,
  description,
  trigger,
  actions,
}: WorkflowPreviewProps) {
  const triggerConfig = TRIGGER_TYPE_CONFIG[trigger.type];

  return (
    <div className='space-y-6'>
      {/* Workflow Info */}
      <div className='rounded-lg border bg-card p-6'>
        <h2 className='text-lg font-semibold text-foreground'>
          {name || 'Untitled Workflow'}
        </h2>
        {description && (
          <p className='mt-2 text-sm text-muted-foreground'>{description}</p>
        )}
      </div>

      {/* Workflow Flow */}
      <div className='rounded-lg border bg-card p-6'>
        <h3 className='mb-4 text-sm font-semibold text-foreground'>
          Workflow Flow
        </h3>

        {/* Trigger */}
        <div className='flex items-center gap-3 rounded-md bg-blue-500/10 p-4'>
          <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20'>
            <TriggerIcon className='h-5 w-5 text-blue-600 dark:text-blue-400' />
          </div>
          <div className='flex-1'>
            <p className='font-medium text-foreground'>
              Trigger: {triggerConfig?.label || trigger.type}
            </p>
            <p className='text-sm text-muted-foreground'>
              {triggerConfig?.description ||
                'When this happens, the workflow starts'}
            </p>
          </div>
        </div>

        {/* Actions */}
        {actions.length > 0 ? (
          actions.map((action, index) => {
            const actionConfig = ACTION_TYPE_CONFIG[action.type];
            return (
              <div key={action.id}>
                {/* Flow Line */}
                <div className='ml-5 h-6 w-0.5 bg-border' />

                {/* Action */}
                <div className='flex items-center gap-3 rounded-md bg-muted/50 p-4'>
                  <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10'>
                    <span className='text-sm font-semibold text-primary'>
                      {index + 1}
                    </span>
                  </div>
                  <div className='flex-1'>
                    <p className='font-medium text-foreground'>
                      {actionConfig?.label || action.type.replace(/_/g, ' ')}
                    </p>
                    {'message' in action.config && action.config.message && (
                      <p className='mt-1 text-sm text-muted-foreground line-clamp-2'>
                        {String(action.config.message)}
                      </p>
                    )}
                    {'channelId' in action.config &&
                      action.config.channelId && (
                        <p className='mt-1 text-xs text-muted-foreground'>
                          Channel: {String(action.config.channelId)}
                        </p>
                      )}
                    {'url' in action.config && action.config.url && (
                      <p className='mt-1 text-xs text-muted-foreground'>
                        URL: {String(action.config.url)}
                      </p>
                    )}
                    {action.errorHandling && (
                      <div className='mt-2 flex items-center gap-2 text-xs text-muted-foreground'>
                        <ErrorHandlingIcon className='h-3 w-3' />
                        <span>
                          On error: {action.errorHandling.onError}
                          {action.errorHandling.retryCount &&
                            ` (retry ${action.errorHandling.retryCount}x)`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className='mt-4 text-center text-sm text-muted-foreground'>
            No actions configured yet
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className='grid gap-4 sm:grid-cols-3'>
        <div className='rounded-lg border bg-card p-4'>
          <div className='flex items-center gap-2'>
            <TriggerIcon className='h-4 w-4 text-muted-foreground' />
            <span className='text-sm font-medium text-muted-foreground'>
              Trigger
            </span>
          </div>
          <p className='mt-1 text-lg font-semibold text-foreground'>
            {triggerConfig?.label || trigger.type}
          </p>
        </div>

        <div className='rounded-lg border bg-card p-4'>
          <div className='flex items-center gap-2'>
            <ActionsIcon className='h-4 w-4 text-muted-foreground' />
            <span className='text-sm font-medium text-muted-foreground'>
              Actions
            </span>
          </div>
          <p className='mt-1 text-lg font-semibold text-foreground'>
            {actions.length}
          </p>
        </div>

        <div className='rounded-lg border bg-card p-4'>
          <div className='flex items-center gap-2'>
            <ErrorHandlingIcon className='h-4 w-4 text-muted-foreground' />
            <span className='text-sm font-medium text-muted-foreground'>
              Error Handling
            </span>
          </div>
          <p className='mt-1 text-lg font-semibold text-foreground'>
            {actions.filter(a => a.errorHandling).length} configured
          </p>
        </div>
      </div>
    </div>
  );
}

// Icons
function TriggerIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M13 2 3 14h9l-1 8 10-12h-9l1-8z' />
    </svg>
  );
}

function ActionsIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <polyline points='9 11 12 14 22 4' />
      <path d='M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' />
    </svg>
  );
}

function ErrorHandlingIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' />
      <line x1='12' x2='12' y1='9' y2='13' />
      <line x1='12' x2='12.01' y1='17' y2='17' />
    </svg>
  );
}
