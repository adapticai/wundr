'use client';

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  ChevronDown,
  Plus,
  Trash2,
  RotateCcw,
  Code2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

// Entity Type Definitions
export type EntityType =
  | 'workspace'
  | 'orchestrator'
  | 'workflow'
  | 'session-manager'
  | 'channel'
  | 'subagent';

// Zod Schemas
const workspaceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  purpose: z.string().min(10, 'Purpose must be at least 10 characters'),
  teamStructure: z
    .array(
      z.object({
        role: z.string().min(1, 'Role is required'),
        count: z.number().min(1, 'Count must be at least 1'),
        responsibilities: z.string().optional(),
      })
    )
    .min(1, 'At least one team structure entry is required'),
});

const orchestratorSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .optional(),
  role: z.string().min(1, 'Role is required'),
  goals: z
    .array(z.string().min(1, 'Goal cannot be empty'))
    .min(1, 'At least one goal is required'),
  capabilities: z
    .array(z.string().min(1, 'Capability cannot be empty'))
    .min(1, 'At least one capability is required'),
  personality: z
    .string()
    .min(10, 'Personality description must be at least 10 characters'),
});

const workflowSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  trigger: z.string().min(1, 'Trigger is required'),
  steps: z
    .array(
      z.object({
        name: z.string().min(1, 'Step name is required'),
        action: z.string().min(1, 'Action is required'),
        params: z.record(z.any()).optional(),
      })
    )
    .min(1, 'At least one step is required'),
  conditions: z
    .array(
      z.object({
        field: z.string().min(1, 'Field is required'),
        operator: z.enum(['equals', 'contains', 'greater_than', 'less_than']),
        value: z.string().min(1, 'Value is required'),
      })
    )
    .optional(),
});

const sessionManagerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  scope: z.enum(['global', 'workspace', 'user']),
  permissions: z
    .array(z.string().min(1, 'Permission cannot be empty'))
    .min(1, 'At least one permission is required'),
  rules: z
    .array(
      z.object({
        type: z.string().min(1, 'Rule type is required'),
        condition: z.string().min(1, 'Condition is required'),
        action: z.string().min(1, 'Action is required'),
      })
    )
    .min(1, 'At least one rule is required'),
});

const channelSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().optional(),
  type: z.enum(['public', 'private', 'direct']).optional(),
  members: z.array(z.string()).optional(),
});

const subagentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
  parentId: z.string().optional(),
});

type WorkspaceData = z.infer<typeof workspaceSchema>;
type OrchestratorData = z.infer<typeof orchestratorSchema>;
type WorkflowData = z.infer<typeof workflowSchema>;
type SessionManagerData = z.infer<typeof sessionManagerSchema>;
type ChannelData = z.infer<typeof channelSchema>;
type SubagentData = z.infer<typeof subagentSchema>;

type EntityData =
  | WorkspaceData
  | OrchestratorData
  | WorkflowData
  | SessionManagerData
  | ChannelData
  | SubagentData;

const entitySchemas = {
  workspace: workspaceSchema,
  orchestrator: orchestratorSchema,
  workflow: workflowSchema,
  'session-manager': sessionManagerSchema,
  channel: channelSchema,
  subagent: subagentSchema,
};

// Props
export interface EntityReviewFormProps {
  entityType: EntityType;
  extractedData: EntityData;
  onSubmit: (data: EntityData) => void | Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

// Helper to detect changes
function getChangedFields(original: any, current: any, path = ''): string[] {
  const changes: string[] = [];

  if (typeof original !== 'object' || typeof current !== 'object') {
    if (original !== current) {
      changes.push(path);
    }
    return changes;
  }

  const allKeys = new Set([
    ...Object.keys(original || {}),
    ...Object.keys(current || {}),
  ]);

  allKeys.forEach(key => {
    const newPath = path ? `${path}.${key}` : key;
    if (Array.isArray(original?.[key]) && Array.isArray(current?.[key])) {
      if (JSON.stringify(original[key]) !== JSON.stringify(current[key])) {
        changes.push(newPath);
      }
    } else if (
      typeof original?.[key] === 'object' &&
      typeof current?.[key] === 'object'
    ) {
      changes.push(...getChangedFields(original[key], current[key], newPath));
    } else if (original?.[key] !== current?.[key]) {
      changes.push(newPath);
    }
  });

  return changes;
}

export function EntityReviewForm({
  entityType,
  extractedData,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: EntityReviewFormProps) {
  const [showJsonEditor, setShowJsonEditor] = React.useState(false);
  const [jsonError, setJsonError] = React.useState<string | null>(null);
  const [jsonValue, setJsonValue] = React.useState('');

  const schema = entitySchemas[entityType];
  const form = useForm({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any),
    defaultValues: extractedData,
  });

  const changedFields = React.useMemo(() => {
    return getChangedFields(extractedData, form.watch());
  }, [extractedData, form.watch()]);

  const hasChanges = changedFields.length > 0;

  const resetToAI = () => {
    form.reset(extractedData);
  };

  const toggleJsonEditor = () => {
    if (!showJsonEditor) {
      setJsonValue(JSON.stringify(form.getValues(), null, 2));
      setJsonError(null);
    }
    setShowJsonEditor(!showJsonEditor);
  };

  const applyJsonChanges = () => {
    try {
      const parsed = JSON.parse(jsonValue);
      const validated = schema.parse(parsed);
      form.reset(validated);
      setJsonError(null);
      setShowJsonEditor(false);
    } catch (error) {
      if (error instanceof z.ZodError) {
        setJsonError(
          error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('\n')
        );
      } else if (error instanceof SyntaxError) {
        setJsonError(`Invalid JSON: ${error.message}`);
      } else {
        setJsonError('Failed to parse JSON');
      }
    }
  };

  const handleSubmit = form.handleSubmit(async data => {
    await onSubmit(data);
  });

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-2xl font-bold'>
            Review {entityType.replace('-', ' ')} Configuration
          </h2>
          <p className='text-sm text-muted-foreground mt-1'>
            Review and edit the AI-extracted configuration below
          </p>
        </div>
        <div className='flex items-center gap-2'>
          {hasChanges && (
            <Badge variant='secondary' className='gap-1'>
              <AlertCircle className='h-3 w-3' />
              {changedFields.length} change
              {changedFields.length !== 1 ? 's' : ''}
            </Badge>
          )}
          {!hasChanges && (
            <Badge variant='outline' className='gap-1'>
              <CheckCircle2 className='h-3 w-3' />
              No changes
            </Badge>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className='flex items-center gap-2'>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={resetToAI}
          disabled={!hasChanges}
        >
          <RotateCcw className='h-4 w-4 mr-2' />
          Reset to AI suggestions
        </Button>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={toggleJsonEditor}
        >
          <Code2 className='h-4 w-4 mr-2' />
          {showJsonEditor ? 'Hide' : 'Show'} JSON Editor
        </Button>
      </div>

      {/* JSON Editor */}
      {showJsonEditor && (
        <Card>
          <CardHeader>
            <CardTitle className='text-lg'>JSON Editor</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <Textarea
              value={jsonValue}
              onChange={e => setJsonValue(e.target.value)}
              className='font-mono text-sm min-h-[300px]'
              placeholder='Enter JSON configuration...'
            />
            {jsonError && (
              <div className='bg-destructive/10 border border-destructive/20 rounded-md p-3'>
                <p className='text-sm text-destructive font-mono whitespace-pre-wrap'>
                  {jsonError}
                </p>
              </div>
            )}
            <div className='flex gap-2'>
              <Button onClick={applyJsonChanges}>Apply Changes</Button>
              <Button variant='outline' onClick={toggleJsonEditor}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form */}
      <Form {...form}>
        <form onSubmit={handleSubmit} className='space-y-6'>
          {entityType === 'workspace' && (
            <WorkspaceFields form={form} changedFields={changedFields} />
          )}
          {entityType === 'orchestrator' && (
            <OrchestratorFields form={form} changedFields={changedFields} />
          )}
          {entityType === 'workflow' && (
            <WorkflowFields form={form} changedFields={changedFields} />
          )}
          {entityType === 'session-manager' && (
            <SessionManagerFields form={form} changedFields={changedFields} />
          )}

          {/* Submit Actions */}
          <div className='flex items-center justify-end gap-3 pt-6 border-t'>
            {onCancel && (
              <Button
                type='button'
                variant='outline'
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            )}
            <Button type='submit' disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Entity'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

// Field Components
interface FieldComponentProps {
  form: any;
  changedFields: string[];
}

function FieldWrapper({
  children,
  isChanged,
}: {
  children: React.ReactNode;
  isChanged: boolean;
}) {
  return (
    <div
      className={cn(
        'relative',
        isChanged && 'ring-2 ring-primary/20 rounded-md p-3 -m-3'
      )}
    >
      {isChanged && (
        <Badge variant='secondary' className='absolute -top-2 -right-2 text-xs'>
          Modified
        </Badge>
      )}
      {children}
    </div>
  );
}

function WorkspaceFields({ form, changedFields }: FieldComponentProps) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'teamStructure',
  });

  return (
    <div className='space-y-6'>
      <FieldWrapper isChanged={changedFields.includes('name')}>
        <FormField
          control={form.control}
          name='name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Workspace Name</FormLabel>
              <FormControl>
                <Input placeholder='Enter workspace name...' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </FieldWrapper>

      <FieldWrapper isChanged={changedFields.includes('description')}>
        <FormField
          control={form.control}
          name='description'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder='Describe the workspace...'
                  className='min-h-[100px]'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </FieldWrapper>

      <FieldWrapper isChanged={changedFields.includes('purpose')}>
        <FormField
          control={form.control}
          name='purpose'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Purpose</FormLabel>
              <FormControl>
                <Textarea
                  placeholder='What is the purpose of this workspace?'
                  className='min-h-[100px]'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </FieldWrapper>

      <Collapsible defaultOpen>
        <Card>
          <CardHeader>
            <CollapsibleTrigger className='flex items-center justify-between w-full hover:opacity-80'>
              <CardTitle className='text-lg'>Team Structure</CardTitle>
              <ChevronDown className='h-5 w-5 transition-transform duration-200 [&[data-state=open]]:rotate-180' />
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className='space-y-4'>
              {fields.map((field, index) => (
                <FieldWrapper
                  key={field.id}
                  isChanged={changedFields.some(f =>
                    f.startsWith(`teamStructure.${index}`)
                  )}
                >
                  <Card>
                    <CardContent className='pt-6 space-y-4'>
                      <div className='flex items-start justify-between gap-4'>
                        <div className='flex-1 space-y-4'>
                          <FormField
                            control={form.control}
                            name={`teamStructure.${index}.role`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Role</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder='e.g., Developer, Designer...'
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`teamStructure.${index}.count`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Count</FormLabel>
                                <FormControl>
                                  <Input
                                    type='number'
                                    min={1}
                                    {...field}
                                    onChange={e =>
                                      field.onChange(parseInt(e.target.value))
                                    }
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`teamStructure.${index}.responsibilities`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  Responsibilities (Optional)
                                </FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder='Describe responsibilities...'
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <Button
                          type='button'
                          variant='destructive'
                          size='icon'
                          onClick={() => remove(index)}
                          disabled={fields.length === 1}
                        >
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </FieldWrapper>
              ))}

              <Button
                type='button'
                variant='outline'
                onClick={() =>
                  append({ role: '', count: 1, responsibilities: '' })
                }
                className='w-full'
              >
                <Plus className='h-4 w-4 mr-2' />
                Add Team Member
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}

function OrchestratorFields({ form, changedFields }: FieldComponentProps) {
  const {
    fields: goalFields,
    append: appendGoal,
    remove: removeGoal,
  } = useFieldArray({
    control: form.control,
    name: 'goals',
  });

  const {
    fields: capabilityFields,
    append: appendCapability,
    remove: removeCapability,
  } = useFieldArray({
    control: form.control,
    name: 'capabilities',
  });

  return (
    <div className='space-y-6'>
      <FieldWrapper isChanged={changedFields.includes('name')}>
        <FormField
          control={form.control}
          name='name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>OrchestratorName</FormLabel>
              <FormControl>
                <Input placeholder='Enter orchestrator name...' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </FieldWrapper>

      <FieldWrapper isChanged={changedFields.includes('role')}>
        <FormField
          control={form.control}
          name='role'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <FormControl>
                <Input
                  placeholder='e.g., Project Manager, Team Lead...'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </FieldWrapper>

      <Accordion
        type='multiple'
        defaultValue={['goals', 'capabilities', 'personality']}
      >
        <AccordionItem value='goals'>
          <AccordionTrigger>Goals ({goalFields.length})</AccordionTrigger>
          <AccordionContent className='space-y-3'>
            {goalFields.map((field, index) => (
              <FieldWrapper
                key={field.id}
                isChanged={changedFields.includes(`goals.${index}`)}
              >
                <div className='flex items-start gap-2'>
                  <FormField
                    control={form.control}
                    name={`goals.${index}`}
                    render={({ field }) => (
                      <FormItem className='flex-1'>
                        <FormControl>
                          <Input placeholder='Enter goal...' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    onClick={() => removeGoal(index)}
                    disabled={goalFields.length === 1}
                  >
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </div>
              </FieldWrapper>
            ))}
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => appendGoal('')}
            >
              <Plus className='h-4 w-4 mr-2' />
              Add Goal
            </Button>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value='capabilities'>
          <AccordionTrigger>
            Capabilities ({capabilityFields.length})
          </AccordionTrigger>
          <AccordionContent className='space-y-3'>
            {capabilityFields.map((field, index) => (
              <FieldWrapper
                key={field.id}
                isChanged={changedFields.includes(`capabilities.${index}`)}
              >
                <div className='flex items-start gap-2'>
                  <FormField
                    control={form.control}
                    name={`capabilities.${index}`}
                    render={({ field }) => (
                      <FormItem className='flex-1'>
                        <FormControl>
                          <Input placeholder='Enter capability...' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    onClick={() => removeCapability(index)}
                    disabled={capabilityFields.length === 1}
                  >
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </div>
              </FieldWrapper>
            ))}
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => appendCapability('')}
            >
              <Plus className='h-4 w-4 mr-2' />
              Add Capability
            </Button>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value='personality'>
          <AccordionTrigger>Personality</AccordionTrigger>
          <AccordionContent>
            <FieldWrapper isChanged={changedFields.includes('personality')}>
              <FormField
                control={form.control}
                name='personality'
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the orchestrator's personality and communication style..."
                        className='min-h-[120px]'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FieldWrapper>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function WorkflowFields({ form, changedFields }: FieldComponentProps) {
  const {
    fields: stepFields,
    append: appendStep,
    remove: removeStep,
  } = useFieldArray({
    control: form.control,
    name: 'steps',
  });

  const {
    fields: conditionFields,
    append: appendCondition,
    remove: removeCondition,
  } = useFieldArray({
    control: form.control,
    name: 'conditions',
  });

  return (
    <div className='space-y-6'>
      <FieldWrapper isChanged={changedFields.includes('name')}>
        <FormField
          control={form.control}
          name='name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Workflow Name</FormLabel>
              <FormControl>
                <Input placeholder='Enter workflow name...' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </FieldWrapper>

      <FieldWrapper isChanged={changedFields.includes('description')}>
        <FormField
          control={form.control}
          name='description'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder='Describe the workflow...'
                  className='min-h-[100px]'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </FieldWrapper>

      <FieldWrapper isChanged={changedFields.includes('trigger')}>
        <FormField
          control={form.control}
          name='trigger'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Trigger</FormLabel>
              <FormControl>
                <Input
                  placeholder='e.g., on_message, on_schedule...'
                  {...field}
                />
              </FormControl>
              <FormDescription>
                What event triggers this workflow?
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </FieldWrapper>

      <Collapsible defaultOpen>
        <Card>
          <CardHeader>
            <CollapsibleTrigger className='flex items-center justify-between w-full hover:opacity-80'>
              <CardTitle className='text-lg'>
                Workflow Steps ({stepFields.length})
              </CardTitle>
              <ChevronDown className='h-5 w-5 transition-transform duration-200 [&[data-state=open]]:rotate-180' />
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className='space-y-4'>
              {stepFields.map((field, index) => (
                <FieldWrapper
                  key={field.id}
                  isChanged={changedFields.some(f =>
                    f.startsWith(`steps.${index}`)
                  )}
                >
                  <Card>
                    <CardContent className='pt-6 space-y-4'>
                      <div className='flex items-start justify-between gap-4'>
                        <div className='flex-1 space-y-4'>
                          <FormField
                            control={form.control}
                            name={`steps.${index}.name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Step Name</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder='e.g., Send notification...'
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`steps.${index}.action`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Action</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder='e.g., send_email, create_task...'
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`steps.${index}.params`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Parameters (JSON)</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder='{"key": "value"}'
                                    className='font-mono text-sm'
                                    value={
                                      field.value
                                        ? JSON.stringify(field.value, null, 2)
                                        : ''
                                    }
                                    onChange={e => {
                                      try {
                                        const parsed = e.target.value
                                          ? JSON.parse(e.target.value)
                                          : {};
                                        field.onChange(parsed);
                                      } catch {
                                        // Keep the string value for editing
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <Button
                          type='button'
                          variant='destructive'
                          size='icon'
                          onClick={() => removeStep(index)}
                          disabled={stepFields.length === 1}
                        >
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </FieldWrapper>
              ))}

              <Button
                type='button'
                variant='outline'
                onClick={() => appendStep({ name: '', action: '', params: {} })}
                className='w-full'
              >
                <Plus className='h-4 w-4 mr-2' />
                Add Step
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible>
        <Card>
          <CardHeader>
            <CollapsibleTrigger className='flex items-center justify-between w-full hover:opacity-80'>
              <CardTitle className='text-lg'>Conditions (Optional)</CardTitle>
              <ChevronDown className='h-5 w-5 transition-transform duration-200 [&[data-state=open]]:rotate-180' />
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className='space-y-4'>
              {conditionFields?.map((field, index) => (
                <FieldWrapper
                  key={field.id}
                  isChanged={changedFields.some(f =>
                    f.startsWith(`conditions.${index}`)
                  )}
                >
                  <Card>
                    <CardContent className='pt-6'>
                      <div className='flex items-start gap-4'>
                        <div className='flex-1 grid grid-cols-3 gap-4'>
                          <FormField
                            control={form.control}
                            name={`conditions.${index}.field`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Field</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder='e.g., status'
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`conditions.${index}.operator`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Operator</FormLabel>
                                <FormControl>
                                  <select
                                    className='flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                                    {...field}
                                  >
                                    <option value='equals'>Equals</option>
                                    <option value='contains'>Contains</option>
                                    <option value='greater_than'>
                                      Greater Than
                                    </option>
                                    <option value='less_than'>Less Than</option>
                                  </select>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`conditions.${index}.value`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Value</FormLabel>
                                <FormControl>
                                  <Input placeholder='Value' {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <Button
                          type='button'
                          variant='destructive'
                          size='icon'
                          onClick={() => removeCondition(index)}
                        >
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </FieldWrapper>
              ))}

              <Button
                type='button'
                variant='outline'
                onClick={() =>
                  appendCondition({ field: '', operator: 'equals', value: '' })
                }
                className='w-full'
              >
                <Plus className='h-4 w-4 mr-2' />
                Add Condition
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}

function SessionManagerFields({ form, changedFields }: FieldComponentProps) {
  const {
    fields: permissionFields,
    append: appendPermission,
    remove: removePermission,
  } = useFieldArray({
    control: form.control,
    name: 'permissions',
  });

  const {
    fields: ruleFields,
    append: appendRule,
    remove: removeRule,
  } = useFieldArray({
    control: form.control,
    name: 'rules',
  });

  return (
    <div className='space-y-6'>
      <FieldWrapper isChanged={changedFields.includes('name')}>
        <FormField
          control={form.control}
          name='name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Session Manager Name</FormLabel>
              <FormControl>
                <Input placeholder='Enter session manager name...' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </FieldWrapper>

      <FieldWrapper isChanged={changedFields.includes('scope')}>
        <FormField
          control={form.control}
          name='scope'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Scope</FormLabel>
              <FormControl>
                <select
                  className='flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  {...field}
                >
                  <option value='global'>Global</option>
                  <option value='workspace'>Workspace</option>
                  <option value='user'>User</option>
                </select>
              </FormControl>
              <FormDescription>Scope of session management</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </FieldWrapper>

      <Accordion type='multiple' defaultValue={['permissions', 'rules']}>
        <AccordionItem value='permissions'>
          <AccordionTrigger>
            Permissions ({permissionFields.length})
          </AccordionTrigger>
          <AccordionContent className='space-y-3'>
            {permissionFields.map((field, index) => (
              <FieldWrapper
                key={field.id}
                isChanged={changedFields.includes(`permissions.${index}`)}
              >
                <div className='flex items-start gap-2'>
                  <FormField
                    control={form.control}
                    name={`permissions.${index}`}
                    render={({ field }) => (
                      <FormItem className='flex-1'>
                        <FormControl>
                          <Input
                            placeholder='e.g., read, write, delete...'
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    onClick={() => removePermission(index)}
                    disabled={permissionFields.length === 1}
                  >
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </div>
              </FieldWrapper>
            ))}
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => appendPermission('')}
            >
              <Plus className='h-4 w-4 mr-2' />
              Add Permission
            </Button>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value='rules'>
          <AccordionTrigger>Rules ({ruleFields.length})</AccordionTrigger>
          <AccordionContent className='space-y-4'>
            {ruleFields.map((field, index) => (
              <FieldWrapper
                key={field.id}
                isChanged={changedFields.some(f =>
                  f.startsWith(`rules.${index}`)
                )}
              >
                <Card>
                  <CardContent className='pt-6'>
                    <div className='flex items-start gap-4'>
                      <div className='flex-1 space-y-4'>
                        <FormField
                          control={form.control}
                          name={`rules.${index}.type`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Rule Type</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder='e.g., timeout, max_sessions...'
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`rules.${index}.condition`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Condition</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder='e.g., idle > 30min...'
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`rules.${index}.action`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Action</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder='e.g., terminate, notify...'
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <Button
                        type='button'
                        variant='destructive'
                        size='icon'
                        onClick={() => removeRule(index)}
                        disabled={ruleFields.length === 1}
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </FieldWrapper>
            ))}
            <Button
              type='button'
              variant='outline'
              onClick={() =>
                appendRule({ type: '', condition: '', action: '' })
              }
              className='w-full'
            >
              <Plus className='h-4 w-4 mr-2' />
              Add Rule
            </Button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
