'use client';

/**
 * Step Configuration Forms
 *
 * Type-specific configuration forms for workflow steps with:
 * - React Hook Form integration
 * - Zod schema validation
 * - Real-time validation feedback
 * - Variable picker integration
 * - Intelligent field suggestions
 */

import { Info, HelpCircle } from 'lucide-react';
import { useFormContext } from 'react-hook-form';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
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

import { VariablePicker } from './variable-picker';

import type { ScopedWorkflowVariable } from './variable-manager';
import type { StepType } from '@/lib/workflow/step-types';

// ============================================================================
// Common Props Interface
// ============================================================================

interface ConfigFormProps {
  stepType: StepType<unknown>;
  availableVariables: ScopedWorkflowVariable[];
  readOnly?: boolean;
}

// ============================================================================
// TRIGGER CONFIGURATION FORM
// ============================================================================

export function TriggerConfigForm({
  stepType,
  availableVariables,
  readOnly,
}: ConfigFormProps) {
  const stepId = stepType.id;

  if (stepId === 'trigger.webhook') {
    return <WebhookTriggerConfig readOnly={readOnly} />;
  }

  if (stepId === 'trigger.schedule') {
    return <ScheduleTriggerConfig readOnly={readOnly} />;
  }

  if (stepId === 'trigger.message') {
    return <MessageTriggerConfig readOnly={readOnly} />;
  }

  return (
    <Alert>
      <Info className='h-4 w-4' />
      <AlertDescription>
        Configuration form for {stepType.name} is not yet implemented.
      </AlertDescription>
    </Alert>
  );
}

// Webhook Trigger
function WebhookTriggerConfig({ readOnly }: { readOnly?: boolean }) {
  const { control } = useFormContext();

  return (
    <div className='space-y-4'>
      <FormField
        control={control}
        name='config.method'
        render={({ field }) => (
          <FormItem>
            <FormLabel>HTTP Method</FormLabel>
            <Select
              disabled={readOnly}
              onValueChange={field.onChange}
              defaultValue={field.value || 'POST'}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder='Select method' />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value='GET'>GET</SelectItem>
                <SelectItem value='POST'>POST</SelectItem>
                <SelectItem value='PUT'>PUT</SelectItem>
                <SelectItem value='DELETE'>DELETE</SelectItem>
                <SelectItem value='PATCH'>PATCH</SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>HTTP method that will trigger the workflow</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name='config.authentication.type'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Authentication</FormLabel>
            <Select
              disabled={readOnly}
              onValueChange={field.onChange}
              defaultValue={field.value || 'none'}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder='Select authentication type' />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value='none'>None</SelectItem>
                <SelectItem value='basic'>Basic Auth</SelectItem>
                <SelectItem value='bearer'>Bearer Token</SelectItem>
                <SelectItem value='api-key'>API Key</SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>How to authenticate incoming webhook requests</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <Alert>
        <Info className='h-4 w-4' />
        <AlertDescription>
          Your webhook URL will be generated after saving and can be found in the execution
          history.
        </AlertDescription>
      </Alert>
    </div>
  );
}

// Schedule Trigger
function ScheduleTriggerConfig({ readOnly }: { readOnly?: boolean }) {
  const { control } = useFormContext();

  return (
    <div className='space-y-4'>
      <FormField
        control={control}
        name='config.schedule.cron'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Cron Expression *</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder='0 0 * * *'
                disabled={readOnly}
                className='font-mono text-sm'
              />
            </FormControl>
            <FormDescription>
              Standard cron expression (e.g., &quot;0 0 * * *&quot; for daily at midnight)
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name='config.schedule.timezone'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Timezone</FormLabel>
            <Select disabled={readOnly} onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder='Select timezone' />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value='UTC'>UTC</SelectItem>
                <SelectItem value='America/New_York'>America/New York</SelectItem>
                <SelectItem value='America/Los_Angeles'>America/Los Angeles</SelectItem>
                <SelectItem value='Europe/London'>Europe/London</SelectItem>
                <SelectItem value='Asia/Tokyo'>Asia/Tokyo</SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>Timezone for schedule execution</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <Alert>
        <HelpCircle className='h-4 w-4' />
        <AlertDescription>
          <strong>Cron format:</strong> minute hour day month weekday
          <br />
          Example: &quot;*/15 * * * *&quot; = Every 15 minutes
        </AlertDescription>
      </Alert>
    </div>
  );
}

// Message Trigger
function MessageTriggerConfig({ readOnly }: { readOnly?: boolean }) {
  const { control } = useFormContext();

  return (
    <div className='space-y-4'>
      <FormField
        control={control}
        name='config.message.pattern'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Message Pattern</FormLabel>
            <FormControl>
              <Input {...field} placeholder='Enter regex pattern or keywords' disabled={readOnly} />
            </FormControl>
            <FormDescription>
              Optional pattern to match messages (leave empty for all messages)
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name='config.message.channelIds'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Channel Filter</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={Array.isArray(field.value) ? field.value.join(', ') : ''}
                onChange={e =>
                  field.onChange(
                    e.target.value
                      .split(',')
                      .map(id => id.trim())
                      .filter(Boolean),
                  )
                }
                placeholder='channel-id-1, channel-id-2'
                disabled={readOnly}
              />
            </FormControl>
            <FormDescription>
              Comma-separated channel IDs (leave empty for all channels)
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

// ============================================================================
// ACTION CONFIGURATION FORM
// ============================================================================

export function ActionConfigForm({ stepType, availableVariables, readOnly }: ConfigFormProps) {
  const stepId = stepType.id;

  if (stepId === 'action.send_message') {
    return <SendMessageActionConfig readOnly={readOnly} availableVariables={availableVariables} />;
  }

  if (stepId === 'action.send_dm') {
    return <SendDMActionConfig readOnly={readOnly} availableVariables={availableVariables} />;
  }

  if (stepId === 'action.http_request') {
    return <HttpRequestActionConfig readOnly={readOnly} availableVariables={availableVariables} />;
  }

  if (stepId === 'action.wait') {
    return <WaitActionConfig readOnly={readOnly} />;
  }

  return (
    <Alert>
      <Info className='h-4 w-4' />
      <AlertDescription>
        Configuration form for {stepType.name} is not yet implemented.
      </AlertDescription>
    </Alert>
  );
}

// Send Message Action
function SendMessageActionConfig({
  readOnly,
  availableVariables,
}: {
  readOnly?: boolean;
  availableVariables: ScopedWorkflowVariable[];
}) {
  const { control } = useFormContext();

  return (
    <div className='space-y-4'>
      <FormField
        control={control}
        name='config.channelId'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Channel ID *</FormLabel>
            <FormControl>
              <Input {...field} placeholder='channel-123' disabled={readOnly} />
            </FormControl>
            <div className='mt-2'>
              <VariablePicker
                variables={availableVariables}
                onSelect={varName => field.onChange(`\${variable.${varName}}`)}
                placeholder='Insert variable'
              />
            </div>
            <FormDescription>The channel to send the message to</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name='config.message'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Message *</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                placeholder='Enter your message...'
                disabled={readOnly}
                rows={4}
                className='resize-none'
              />
            </FormControl>
            <div className='mt-2'>
              <VariablePicker
                variables={availableVariables}
                onSelect={varName =>
                  field.onChange((field.value || '') + `\${variable.${varName}}`)
                }
                placeholder='Insert variable'
              />
            </div>
            <FormDescription>Message content (supports variables)</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

// Send DM Action
function SendDMActionConfig({
  readOnly,
  availableVariables,
}: {
  readOnly?: boolean;
  availableVariables: ScopedWorkflowVariable[];
}) {
  const { control } = useFormContext();

  return (
    <div className='space-y-4'>
      <FormField
        control={control}
        name='config.userId'
        render={({ field }) => (
          <FormItem>
            <FormLabel>User ID *</FormLabel>
            <FormControl>
              <Input {...field} placeholder='user-123' disabled={readOnly} />
            </FormControl>
            <div className='mt-2'>
              <VariablePicker
                variables={availableVariables}
                onSelect={varName => field.onChange(`\${variable.${varName}}`)}
                placeholder='Insert variable'
              />
            </div>
            <FormDescription>The user to send the DM to</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name='config.message'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Message *</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                placeholder='Enter your message...'
                disabled={readOnly}
                rows={4}
                className='resize-none'
              />
            </FormControl>
            <div className='mt-2'>
              <VariablePicker
                variables={availableVariables}
                onSelect={varName =>
                  field.onChange((field.value || '') + `\${variable.${varName}}`)
                }
                placeholder='Insert variable'
              />
            </div>
            <FormDescription>DM content (supports variables)</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

// HTTP Request Action
function HttpRequestActionConfig({
  readOnly,
  availableVariables,
}: {
  readOnly?: boolean;
  availableVariables: ScopedWorkflowVariable[];
}) {
  const { control, watch } = useFormContext();
  const method = watch('config.method');

  return (
    <div className='space-y-4'>
      <FormField
        control={control}
        name='config.url'
        render={({ field }) => (
          <FormItem>
            <FormLabel>URL *</FormLabel>
            <FormControl>
              <Input {...field} placeholder='https://api.example.com/endpoint' disabled={readOnly} />
            </FormControl>
            <div className='mt-2'>
              <VariablePicker
                variables={availableVariables}
                onSelect={varName => field.onChange((field.value || '') + `\${variable.${varName}}`)}
                placeholder='Insert variable'
              />
            </div>
            <FormDescription>The endpoint URL to call</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name='config.method'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Method *</FormLabel>
            <Select
              disabled={readOnly}
              onValueChange={field.onChange}
              defaultValue={field.value || 'GET'}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder='Select method' />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value='GET'>GET</SelectItem>
                <SelectItem value='POST'>POST</SelectItem>
                <SelectItem value='PUT'>PUT</SelectItem>
                <SelectItem value='DELETE'>DELETE</SelectItem>
                <SelectItem value='PATCH'>PATCH</SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>HTTP method to use</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {(method === 'POST' || method === 'PUT' || method === 'PATCH') && (
        <FormField
          control={control}
          name='config.body'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Request Body</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder='{"key": "value"}'
                  disabled={readOnly}
                  rows={6}
                  className='resize-none font-mono text-sm'
                />
              </FormControl>
              <div className='mt-2'>
                <VariablePicker
                  variables={availableVariables}
                  onSelect={varName =>
                    field.onChange((field.value || '') + `\${variable.${varName}}`)
                  }
                  placeholder='Insert variable'
                />
              </div>
              <FormDescription>JSON request body (supports variables)</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      <FormField
        control={control}
        name='config.timeout'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Timeout (seconds)</FormLabel>
            <FormControl>
              <Input
                {...field}
                type='number'
                min={1}
                max={300}
                placeholder='30'
                disabled={readOnly}
                onChange={e => field.onChange(parseInt(e.target.value) || 30)}
              />
            </FormControl>
            <FormDescription>Request timeout in seconds (1-300)</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

// Wait Action
function WaitActionConfig({ readOnly }: { readOnly?: boolean }) {
  const { control } = useFormContext();

  return (
    <div className='space-y-4'>
      <FormField
        control={control}
        name='config.duration'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Duration *</FormLabel>
            <FormControl>
              <Input
                {...field}
                type='number'
                min={1}
                placeholder='5'
                disabled={readOnly}
                onChange={e => field.onChange(parseInt(e.target.value) || 1)}
              />
            </FormControl>
            <FormDescription>How long to wait</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name='config.unit'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Time Unit *</FormLabel>
            <Select
              disabled={readOnly}
              onValueChange={field.onChange}
              defaultValue={field.value || 'seconds'}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder='Select unit' />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value='seconds'>Seconds</SelectItem>
                <SelectItem value='minutes'>Minutes</SelectItem>
                <SelectItem value='hours'>Hours</SelectItem>
                <SelectItem value='days'>Days</SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>Time unit for the duration</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

// ============================================================================
// CONDITION CONFIGURATION FORM
// ============================================================================

export function ConditionConfigForm({
  stepType,
  availableVariables,
  readOnly,
}: ConfigFormProps) {
  const { control } = useFormContext();

  return (
    <div className='space-y-4'>
      <FormField
        control={control}
        name='config.field'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Field to Check *</FormLabel>
            <FormControl>
              <Input {...field} placeholder='trigger.message.content' disabled={readOnly} />
            </FormControl>
            <div className='mt-2'>
              <VariablePicker
                variables={availableVariables}
                onSelect={varName => field.onChange(`variable.${varName}`)}
                placeholder='Insert variable'
              />
            </div>
            <FormDescription>The field or variable to evaluate</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name='config.operator'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Operator *</FormLabel>
            <Select
              disabled={readOnly}
              onValueChange={field.onChange}
              defaultValue={field.value || 'equals'}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder='Select operator' />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value='equals'>Equals</SelectItem>
                <SelectItem value='not_equals'>Not Equals</SelectItem>
                <SelectItem value='contains'>Contains</SelectItem>
                <SelectItem value='not_contains'>Does Not Contain</SelectItem>
                <SelectItem value='greater_than'>Greater Than</SelectItem>
                <SelectItem value='less_than'>Less Than</SelectItem>
                <SelectItem value='exists'>Exists</SelectItem>
                <SelectItem value='not_exists'>Does Not Exist</SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>Comparison operator</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name='config.value'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Value *</FormLabel>
            <FormControl>
              <Input {...field} placeholder='Expected value' disabled={readOnly} />
            </FormControl>
            <div className='mt-2'>
              <VariablePicker
                variables={availableVariables}
                onSelect={varName => field.onChange(`\${variable.${varName}}`)}
                placeholder='Insert variable'
              />
            </div>
            <FormDescription>The value to compare against</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <Alert>
        <Info className='h-4 w-4' />
        <AlertDescription>
          Connect the &quot;Then&quot; output for actions when the condition is true, and
          &quot;Else&quot; for when it&apos;s false.
        </AlertDescription>
      </Alert>
    </div>
  );
}

// ============================================================================
// LOOP CONFIGURATION FORM
// ============================================================================

export function LoopConfigForm({ stepType, availableVariables, readOnly }: ConfigFormProps) {
  const { control, watch } = useFormContext();
  const loopType = watch('config.type') || 'count';

  return (
    <div className='space-y-4'>
      <FormField
        control={control}
        name='config.type'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Loop Type *</FormLabel>
            <Select
              disabled={readOnly}
              onValueChange={field.onChange}
              defaultValue={field.value || 'count'}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder='Select loop type' />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value='count'>Repeat N Times</SelectItem>
                <SelectItem value='array'>For Each Item</SelectItem>
                <SelectItem value='while'>While Condition</SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>Type of loop to execute</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {loopType === 'count' && (
        <FormField
          control={control}
          name='config.count'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Iterations *</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type='number'
                  min={1}
                  max={1000}
                  placeholder='10'
                  disabled={readOnly}
                  onChange={e => field.onChange(parseInt(e.target.value) || 1)}
                />
              </FormControl>
              <FormDescription>Number of times to repeat (1-1000)</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {loopType === 'array' && (
        <FormField
          control={control}
          name='config.array'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Array *</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder='variable.items or ["a", "b", "c"]'
                  disabled={readOnly}
                />
              </FormControl>
              <div className='mt-2'>
                <VariablePicker
                  variables={availableVariables.filter(v => v.type === 'array')}
                  onSelect={varName => field.onChange(`variable.${varName}`)}
                  placeholder='Insert variable'
                />
              </div>
              <FormDescription>Array to iterate over</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {loopType === 'while' && (
        <FormField
          control={control}
          name='config.condition'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Condition *</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder='variable.counter < 10'
                  disabled={readOnly}
                />
              </FormControl>
              <FormDescription>Condition to evaluate (loop continues while true)</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      <FormField
        control={control}
        name='config.maxIterations'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Max Iterations</FormLabel>
            <FormControl>
              <Input
                {...field}
                type='number'
                min={1}
                max={10000}
                placeholder='1000'
                disabled={readOnly}
                onChange={e => field.onChange(parseInt(e.target.value) || 1000)}
              />
            </FormControl>
            <FormDescription>
              Safety limit to prevent infinite loops (default: 1000)
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <Alert>
        <Info className='h-4 w-4' />
        <AlertDescription>
          Connect steps to the loop body output. They will execute for each iteration.
        </AlertDescription>
      </Alert>
    </div>
  );
}

// ============================================================================
// INTEGRATION CONFIGURATION FORM
// ============================================================================

export function IntegrationConfigForm({
  stepType,
  availableVariables,
  readOnly,
}: ConfigFormProps) {
  return (
    <Alert>
      <Info className='h-4 w-4' />
      <AlertDescription>
        Integration configuration forms will be available soon. Each integration will have
        provider-specific settings.
      </AlertDescription>
    </Alert>
  );
}

// ============================================================================
// DATA CONFIGURATION FORM
// ============================================================================

export function DataConfigForm({ stepType, availableVariables, readOnly }: ConfigFormProps) {
  const { control } = useFormContext();

  return (
    <div className='space-y-4'>
      <FormField
        control={control}
        name='config.operation'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Operation *</FormLabel>
            <Select
              disabled={readOnly}
              onValueChange={field.onChange}
              defaultValue={field.value || 'transform'}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder='Select operation' />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value='transform'>Transform</SelectItem>
                <SelectItem value='filter'>Filter</SelectItem>
                <SelectItem value='map'>Map</SelectItem>
                <SelectItem value='reduce'>Reduce</SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>Data operation to perform</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <Alert>
        <Info className='h-4 w-4' />
        <AlertDescription>
          Advanced data transformation features will be available in the next release.
        </AlertDescription>
      </Alert>
    </div>
  );
}

// ============================================================================
// UTILITY CONFIGURATION FORM
// ============================================================================

export function UtilityConfigForm({ stepType, availableVariables, readOnly }: ConfigFormProps) {
  return (
    <Alert>
      <Info className='h-4 w-4' />
      <AlertDescription>
        Utility configuration will vary by step type. Advanced settings coming soon.
      </AlertDescription>
    </Alert>
  );
}
