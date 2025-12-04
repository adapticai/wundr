/**
 * Orchestrator Review Form Component
 *
 * Allows users to review and edit extracted orchestrator data before creation.
 * Provides inputs for all orchestrator fields with validation.
 *
 * @module components/wizard/orchestrator-review-form
 */
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { X, Plus } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
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

/**
 * Validation schema for orchestrator data
 */
const orchestratorSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  role: z.string().min(1, 'Role is required').max(100, 'Role too long'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(1000),
  capabilities: z.array(z.string()).optional(),
  communicationStyle: z
    .enum(['professional', 'friendly', 'technical', 'casual'])
    .optional(),
  goals: z.array(z.string()).optional(),
  channels: z.array(z.string()).optional(),
});

/**
 * Exported type for orchestrator form data
 */
export type OrchestratorFormData = z.infer<typeof orchestratorSchema>;

export interface OrchestratorReviewFormProps {
  initialData: Partial<OrchestratorFormData>;
  onSubmit: (data: OrchestratorFormData) => void;
  onBack: () => void;
  isSubmitting?: boolean;
}

export function OrchestratorReviewForm({
  initialData,
  onSubmit,
  onBack,
  isSubmitting = false,
}: OrchestratorReviewFormProps) {
  const [newCapability, setNewCapability] = React.useState('');
  const [newGoal, setNewGoal] = React.useState('');
  const [newChannel, setNewChannel] = React.useState('');

  const form = useForm<OrchestratorFormData>({
    resolver: zodResolver(orchestratorSchema),
    defaultValues: {
      name: initialData.name || '',
      role: initialData.role || '',
      description: initialData.description || '',
      capabilities: initialData.capabilities || [],
      communicationStyle: initialData.communicationStyle || 'professional',
      goals: initialData.goals || [],
      channels: initialData.channels || [],
    },
  });

  const capabilities = form.watch('capabilities') || [];
  const goals = form.watch('goals') || [];
  const channels = form.watch('channels') || [];

  const handleAddCapability = () => {
    if (newCapability.trim() && !capabilities.includes(newCapability.trim())) {
      form.setValue('capabilities', [...capabilities, newCapability.trim()]);
      setNewCapability('');
    }
  };

  const handleRemoveCapability = (capability: string) => {
    form.setValue(
      'capabilities',
      capabilities.filter(c => c !== capability)
    );
  };

  const handleAddGoal = () => {
    if (newGoal.trim() && !goals.includes(newGoal.trim())) {
      form.setValue('goals', [...goals, newGoal.trim()]);
      setNewGoal('');
    }
  };

  const handleRemoveGoal = (goal: string) => {
    form.setValue(
      'goals',
      goals.filter(g => g !== goal)
    );
  };

  const handleAddChannel = () => {
    if (newChannel.trim() && !channels.includes(newChannel.trim())) {
      form.setValue('channels', [...channels, newChannel.trim()]);
      setNewChannel('');
    }
  };

  const handleRemoveChannel = (channel: string) => {
    form.setValue(
      'channels',
      channels.filter(c => c !== channel)
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review Orchestrator Configuration</CardTitle>
        <CardDescription>
          Review and edit the agent details before creation
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
            {/* Basic Information */}
            <div className='space-y-4'>
              <h3 className='text-lg font-semibold'>Basic Information</h3>

              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agent Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='e.g., Sarah the Support Lead'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      A friendly name for this orchestrator
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='role'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='e.g., Customer Support Lead'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Primary role or discipline
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='description'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='Describe what this orchestrator does...'
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Detailed description of responsibilities
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Capabilities */}
            <div className='space-y-4'>
              <h3 className='text-lg font-semibold'>Capabilities</h3>

              <FormField
                control={form.control}
                name='capabilities'
                render={() => (
                  <FormItem>
                    <FormLabel>Agent Capabilities</FormLabel>
                    <div className='space-y-3'>
                      <div className='flex gap-2'>
                        <Input
                          placeholder='e.g., Handle customer inquiries'
                          value={newCapability}
                          onChange={e => setNewCapability(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCapability();
                            }
                          }}
                        />
                        <Button
                          type='button'
                          variant='outline'
                          size='icon'
                          onClick={handleAddCapability}
                        >
                          <Plus className='h-4 w-4' />
                        </Button>
                      </div>

                      {capabilities.length > 0 && (
                        <div className='flex flex-wrap gap-2'>
                          {capabilities.map(capability => (
                            <Badge
                              key={capability}
                              variant='secondary'
                              className='gap-1'
                            >
                              {capability}
                              <button
                                type='button'
                                onClick={() =>
                                  handleRemoveCapability(capability)
                                }
                                className='ml-1 rounded-full hover:bg-muted-foreground/20'
                              >
                                <X className='h-3 w-3' />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <FormDescription>
                      Key capabilities this agent possesses
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Communication Style */}
            <div className='space-y-4'>
              <h3 className='text-lg font-semibold'>Communication</h3>

              <FormField
                control={form.control}
                name='communicationStyle'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Communication Style</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select a communication style' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='professional'>
                          Professional
                        </SelectItem>
                        <SelectItem value='friendly'>Friendly</SelectItem>
                        <SelectItem value='technical'>Technical</SelectItem>
                        <SelectItem value='casual'>Casual</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      How this agent communicates with users
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Goals */}
            <div className='space-y-4'>
              <h3 className='text-lg font-semibold'>Goals & Objectives</h3>

              <FormField
                control={form.control}
                name='goals'
                render={() => (
                  <FormItem>
                    <FormLabel>Primary Goals</FormLabel>
                    <div className='space-y-3'>
                      <div className='flex gap-2'>
                        <Input
                          placeholder='e.g., Maintain 95% customer satisfaction'
                          value={newGoal}
                          onChange={e => setNewGoal(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddGoal();
                            }
                          }}
                        />
                        <Button
                          type='button'
                          variant='outline'
                          size='icon'
                          onClick={handleAddGoal}
                        >
                          <Plus className='h-4 w-4' />
                        </Button>
                      </div>

                      {goals.length > 0 && (
                        <div className='flex flex-wrap gap-2'>
                          {goals.map(goal => (
                            <Badge
                              key={goal}
                              variant='secondary'
                              className='gap-1'
                            >
                              {goal}
                              <button
                                type='button'
                                onClick={() => handleRemoveGoal(goal)}
                                className='ml-1 rounded-full hover:bg-muted-foreground/20'
                              >
                                <X className='h-3 w-3' />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <FormDescription>
                      Key objectives for this agent
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Channels */}
            <div className='space-y-4'>
              <h3 className='text-lg font-semibold'>Channels</h3>

              <FormField
                control={form.control}
                name='channels'
                render={() => (
                  <FormItem>
                    <FormLabel>Monitored Channels</FormLabel>
                    <div className='space-y-3'>
                      <div className='flex gap-2'>
                        <Input
                          placeholder='e.g., #customer-support'
                          value={newChannel}
                          onChange={e => setNewChannel(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddChannel();
                            }
                          }}
                        />
                        <Button
                          type='button'
                          variant='outline'
                          size='icon'
                          onClick={handleAddChannel}
                        >
                          <Plus className='h-4 w-4' />
                        </Button>
                      </div>

                      {channels.length > 0 && (
                        <div className='flex flex-wrap gap-2'>
                          {channels.map(channel => (
                            <Badge
                              key={channel}
                              variant='secondary'
                              className='gap-1'
                            >
                              {channel}
                              <button
                                type='button'
                                onClick={() => handleRemoveChannel(channel)}
                                className='ml-1 rounded-full hover:bg-muted-foreground/20'
                              >
                                <X className='h-3 w-3' />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <FormDescription>
                      Channels this agent will monitor
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
      </CardContent>

      <CardFooter className='flex justify-between'>
        <Button
          type='button'
          variant='outline'
          onClick={onBack}
          disabled={isSubmitting}
        >
          Back to Conversation
        </Button>
        <Button onClick={form.handleSubmit(onSubmit)} disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Orchestrator'}
        </Button>
      </CardFooter>
    </Card>
  );
}
