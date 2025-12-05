'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import * as z from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// Internal form schema that uses objects for field arrays
const sessionManagerFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  responsibilities: z
    .string()
    .min(10, 'Responsibilities must be at least 10 characters'),
  parentOrchestrator: z.string().optional(),
  context: z.string().optional(),
  channels: z.array(z.object({ value: z.string() })),
  escalationCriteria: z.array(z.object({ value: z.string() })),
});

type SessionManagerFormData = z.infer<typeof sessionManagerFormSchema>;

// External data type with string arrays
export interface SessionManagerData {
  name: string;
  responsibilities: string;
  parentOrchestrator?: string;
  context?: string;
  channels: string[];
  escalationCriteria: string[];
}

interface SessionManagerReviewFormProps {
  initialData: Partial<SessionManagerData>;
  onSubmit: (data: SessionManagerData) => void | Promise<void>;
  onBack?: () => void;
  isSubmitting?: boolean;
  workspaceSlug: string;
}

export function SessionManagerReviewForm({
  initialData,
  onSubmit,
  onBack,
  isSubmitting = false,
  workspaceSlug,
}: SessionManagerReviewFormProps) {
  const [orchestrators, setOrchestrators] = React.useState<
    Array<{ id: string; name: string }>
  >([]);
  const [isLoadingOrchestrators, setIsLoadingOrchestrators] =
    React.useState(true);

  const form = useForm<SessionManagerFormData>({
    resolver: zodResolver(sessionManagerFormSchema),
    defaultValues: {
      name: initialData.name || '',
      responsibilities: initialData.responsibilities || '',
      parentOrchestrator: initialData.parentOrchestrator || '',
      context: initialData.context || '',
      channels: (initialData.channels || []).map(value => ({ value })),
      escalationCriteria: (initialData.escalationCriteria || []).map(value => ({
        value,
      })),
    },
  });

  const {
    fields: escalationFields,
    append: appendEscalation,
    remove: removeEscalation,
  } = useFieldArray({
    control: form.control,
    name: 'escalationCriteria' as const,
  });

  const {
    fields: channelFields,
    append: appendChannel,
    remove: removeChannel,
  } = useFieldArray({
    control: form.control,
    name: 'channels' as const,
  });

  // Fetch available orchestrators
  React.useEffect(() => {
    async function fetchOrchestrators() {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/orchestrators`
        );
        if (response.ok) {
          const data = await response.json();
          setOrchestrators(data.orchestrators || []);
        }
      } catch (error) {
        console.error('Failed to fetch orchestrators:', error);
      } finally {
        setIsLoadingOrchestrators(false);
      }
    }
    fetchOrchestrators();
  }, [workspaceSlug]);

  const handleSubmit = form.handleSubmit(async data => {
    // Transform the data back to the expected format with string arrays
    const transformedData = {
      ...data,
      channels: data.channels.map(item => item.value),
      escalationCriteria: data.escalationCriteria.map(item => item.value),
    };
    await onSubmit(transformedData as SessionManagerData);
  });

  const isValid = form.formState.isValid;
  const hasChanges = form.formState.isDirty;

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle>Review Session Manager Configuration</CardTitle>
            <p className='text-sm text-muted-foreground mt-1'>
              Review and edit the AI-extracted configuration
            </p>
          </div>
          <div className='flex items-center gap-2'>
            {isValid ? (
              <Badge variant='outline' className='gap-1'>
                <CheckCircle2 className='h-3 w-3' />
                Valid
              </Badge>
            ) : (
              <Badge variant='destructive' className='gap-1'>
                <AlertCircle className='h-3 w-3' />
                Invalid
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={handleSubmit} className='space-y-6'>
            {/* Basic Information */}
            <div className='space-y-4'>
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Session Manager Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='e.g., Customer Support Manager'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='responsibilities'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsibilities *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='Describe what this session manager is responsible for...'
                        className='min-h-[100px]'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      What conversations, channels, or contexts does this
                      manage?
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='context'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Context</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='e.g., Customer support tickets, Slack #support channel'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Specific channel or context being managed
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='parentOrchestrator'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent Orchestrator</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isLoadingOrchestrators}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              isLoadingOrchestrators
                                ? 'Loading orchestrators...'
                                : 'Select parent orchestrator'
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {orchestrators.map(orchestrator => (
                          <SelectItem
                            key={orchestrator.id}
                            value={orchestrator.id}
                          >
                            {orchestrator.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Which orchestrator should this session manager report to?
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Channels */}
            <Card>
              <CardHeader>
                <CardTitle className='text-lg'>Channels</CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                {channelFields.map((field, index) => (
                  <div key={field.id} className='flex items-start gap-2'>
                    <FormField
                      control={form.control}
                      name={`channels.${index}.value`}
                      render={({ field }) => (
                        <FormItem className='flex-1'>
                          <FormControl>
                            <Input
                              placeholder='e.g., #support, email, tickets'
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
                      onClick={() => removeChannel(index)}
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </div>
                ))}
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => appendChannel({ value: '' })}
                  className='w-full'
                >
                  <Plus className='h-4 w-4 mr-2' />
                  Add Channel
                </Button>
              </CardContent>
            </Card>

            {/* Escalation Criteria */}
            <Card>
              <CardHeader>
                <CardTitle className='text-lg'>Escalation Criteria</CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                {escalationFields.map((field, index) => (
                  <div key={field.id} className='flex items-start gap-2'>
                    <FormField
                      control={form.control}
                      name={`escalationCriteria.${index}.value`}
                      render={({ field }) => (
                        <FormItem className='flex-1'>
                          <FormControl>
                            <Input
                              placeholder='e.g., Requires technical expertise, High-value customer'
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
                      onClick={() => removeEscalation(index)}
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </div>
                ))}
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => appendEscalation({ value: '' })}
                  className='w-full'
                >
                  <Plus className='h-4 w-4 mr-2' />
                  Add Escalation Criterion
                </Button>
                <FormDescription className='text-xs'>
                  Define when this session manager should escalate to the parent
                  orchestrator
                </FormDescription>
              </CardContent>
            </Card>

            {/* Submit Actions */}
            <div className='flex items-center justify-end gap-3 pt-6 border-t'>
              {onBack && (
                <Button
                  type='button'
                  variant='outline'
                  onClick={onBack}
                  disabled={isSubmitting}
                >
                  Back
                </Button>
              )}
              <Button type='submit' disabled={isSubmitting || !isValid}>
                {isSubmitting ? 'Creating...' : 'Create Session Manager'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
