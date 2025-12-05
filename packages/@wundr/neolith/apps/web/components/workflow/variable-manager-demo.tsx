'use client';

/**
 * Demo component showcasing the Variable Manager
 *
 * This file demonstrates how to integrate the variable management system
 * into a workflow editor. It shows:
 * - Variable definition and management
 * - Variable usage in step configurations
 * - Variable validation
 * - Real-time variable reference resolution
 */

import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  validateVariableReferences,
  replaceVariableReferences,
} from './variable-validation';

import { VariableManager, VariableInput, VariablePicker } from './index';

import type { ScopedWorkflowVariable } from './variable-manager';

/**
 * Demo steps for the example workflow
 */
const DEMO_STEPS = [
  { id: 'step1', name: 'Send Welcome Message' },
  { id: 'step2', name: 'Create User Profile' },
  { id: 'step3', name: 'Assign Default Role' },
];

/**
 * Demo component showing variable manager usage
 */
export function VariableManagerDemo() {
  // State for variables
  const [variables, setVariables] = React.useState<ScopedWorkflowVariable[]>([
    {
      id: 'var1',
      name: 'userName',
      type: 'string',
      description: 'Name of the user joining the workspace',
      defaultValue: 'Guest',
      scope: 'global',
    },
    {
      id: 'var2',
      name: 'userEmail',
      type: 'string',
      description: 'Email address of the user',
      defaultValue: 'user@example.com',
      scope: 'global',
    },
    {
      id: 'var3',
      name: 'welcomeDelay',
      type: 'number',
      description: 'Delay in seconds before sending welcome message',
      defaultValue: 5,
      scope: 'global',
    },
    {
      id: 'var4',
      name: 'isAdmin',
      type: 'boolean',
      description: 'Whether the user has admin privileges',
      defaultValue: false,
      scope: 'global',
    },
    {
      id: 'var5',
      name: 'channelId',
      type: 'string',
      description: 'Channel ID for welcome message',
      defaultValue: 'general',
      scope: 'step',
      stepId: 'step1',
    },
  ]);

  // State for step configurations
  const [stepConfigs, setStepConfigs] = React.useState({
    step1: {
      message:
        'Welcome ${variable.userName}! We sent a confirmation to ${variable.userEmail}.',
      channelId: '${variable.channelId}',
    },
    step2: {
      profileData:
        '{"name": "${variable.userName}", "email": "${variable.userEmail}", "isAdmin": ${variable.isAdmin}}',
    },
    step3: {
      roleId: '${variable.isAdmin} ? "admin" : "member"',
    },
  });

  // State for preview values
  const [previewValues, setPreviewValues] = React.useState<Record<string, any>>(
    {
      userName: 'John Doe',
      userEmail: 'john.doe@example.com',
      welcomeDelay: 10,
      isAdmin: true,
      channelId: 'welcome',
    }
  );

  // Get preview for a step configuration
  const getPreview = (text: string): string => {
    return replaceVariableReferences(text, previewValues);
  };

  // Validate step configuration
  const validateConfig = (text: string) => {
    return validateVariableReferences(text, variables);
  };

  return (
    <div className='container mx-auto py-8 space-y-8'>
      <div>
        <h1 className='text-3xl font-bold mb-2'>Workflow Variables Demo</h1>
        <p className='text-muted-foreground'>
          A comprehensive demonstration of the workflow variable management
          system
        </p>
      </div>

      <Tabs defaultValue='manager' className='w-full'>
        <TabsList className='grid w-full grid-cols-3'>
          <TabsTrigger value='manager'>Variable Manager</TabsTrigger>
          <TabsTrigger value='usage'>Variable Usage</TabsTrigger>
          <TabsTrigger value='preview'>Preview & Testing</TabsTrigger>
        </TabsList>

        {/* Variable Manager Tab */}
        <TabsContent value='manager' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Variable Management</CardTitle>
              <CardDescription>
                Define and manage variables that can be used throughout your
                workflow
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VariableManager
                variables={variables}
                onVariablesChange={setVariables}
                availableSteps={DEMO_STEPS}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Current Variables</CardTitle>
              <CardDescription>
                Summary of all defined variables
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='space-y-4'>
                <div>
                  <h4 className='text-sm font-medium mb-2'>Global Variables</h4>
                  <div className='flex flex-wrap gap-2'>
                    {variables
                      .filter(v => v.scope === 'global')
                      .map(v => (
                        <Badge key={v.id} variant='secondary'>
                          {v.name}: {v.type}
                        </Badge>
                      ))}
                    {variables.filter(v => v.scope === 'global').length ===
                      0 && (
                      <span className='text-sm text-muted-foreground'>
                        No global variables defined
                      </span>
                    )}
                  </div>
                </div>
                <Separator />
                <div>
                  <h4 className='text-sm font-medium mb-2'>Step Variables</h4>
                  <div className='flex flex-wrap gap-2'>
                    {variables
                      .filter(v => v.scope === 'step')
                      .map(v => (
                        <Badge key={v.id} variant='outline'>
                          {v.name}: {v.type} (
                          {DEMO_STEPS.find(s => s.id === v.stepId)?.name})
                        </Badge>
                      ))}
                    {variables.filter(v => v.scope === 'step').length === 0 && (
                      <span className='text-sm text-muted-foreground'>
                        No step variables defined
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Variable Usage Tab */}
        <TabsContent value='usage' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Send Welcome Message</CardTitle>
              <CardDescription>
                Configure the welcome message with variable references
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div>
                <label className='text-sm font-medium mb-2 block'>
                  Welcome Message
                </label>
                <VariableInput
                  value={stepConfigs.step1.message}
                  onChange={value =>
                    setStepConfigs({
                      ...stepConfigs,
                      step1: { ...stepConfigs.step1, message: value },
                    })
                  }
                  variables={variables}
                  currentStepId='step1'
                  multiline
                />
              </div>

              <div>
                <label className='text-sm font-medium mb-2 block'>
                  Channel ID
                </label>
                <VariableInput
                  value={stepConfigs.step1.channelId}
                  onChange={value =>
                    setStepConfigs({
                      ...stepConfigs,
                      step1: { ...stepConfigs.step1, channelId: value },
                    })
                  }
                  variables={variables}
                  currentStepId='step1'
                />
              </div>

              {/* Validation Results */}
              {(() => {
                const messageValidation = validateConfig(
                  stepConfigs.step1.message
                );
                const channelValidation = validateConfig(
                  stepConfigs.step1.channelId
                );
                const hasErrors =
                  !messageValidation.isValid || !channelValidation.isValid;

                if (hasErrors) {
                  return (
                    <div className='p-4 bg-destructive/10 border border-destructive/20 rounded-md'>
                      <h4 className='text-sm font-medium text-destructive mb-2'>
                        Validation Errors
                      </h4>
                      <ul className='text-sm text-destructive space-y-1'>
                        {messageValidation.errors.map((error, i) => (
                          <li key={i}>Message: {error.message}</li>
                        ))}
                        {channelValidation.errors.map((error, i) => (
                          <li key={i}>Channel: {error.message}</li>
                        ))}
                      </ul>
                    </div>
                  );
                }

                return (
                  <div className='p-4 bg-green-500/10 border border-green-500/20 rounded-md'>
                    <p className='text-sm text-green-700 dark:text-green-400'>
                      All variable references are valid
                    </p>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Step 2: Create User Profile</CardTitle>
              <CardDescription>
                Configure user profile data with variables
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div>
                <label className='text-sm font-medium mb-2 block'>
                  Profile Data (JSON)
                </label>
                <VariableInput
                  value={stepConfigs.step2.profileData}
                  onChange={value =>
                    setStepConfigs({
                      ...stepConfigs,
                      step2: { ...stepConfigs.step2, profileData: value },
                    })
                  }
                  variables={variables}
                  currentStepId='step2'
                  multiline
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Variable Picker Example</CardTitle>
              <CardDescription>
                Standalone variable picker component
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VariablePicker
                variables={variables}
                onSelect={ref => alert(`Selected: ${ref}`)}
                placeholder='Select a variable'
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preview & Testing Tab */}
        <TabsContent value='preview' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Preview Values</CardTitle>
              <CardDescription>
                Set test values to preview how variables will be resolved
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              {variables.map(variable => (
                <div key={variable.id}>
                  <label className='text-sm font-medium mb-2 block'>
                    {variable.name}{' '}
                    <span className='text-muted-foreground'>
                      ({variable.type})
                    </span>
                  </label>
                  <input
                    type='text'
                    className='w-full h-10 px-3 py-2 text-sm border rounded-md bg-background'
                    value={
                      previewValues[variable.name] !== undefined
                        ? String(previewValues[variable.name])
                        : ''
                    }
                    onChange={e =>
                      setPreviewValues({
                        ...previewValues,
                        [variable.name]: e.target.value,
                      })
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Step Configuration Preview</CardTitle>
              <CardDescription>
                See how your configuration will look with real values
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div>
                <h4 className='text-sm font-medium mb-2'>
                  Step 1 - Welcome Message
                </h4>
                <div className='p-4 bg-muted rounded-md space-y-2'>
                  <div>
                    <span className='text-xs text-muted-foreground'>
                      Template:
                    </span>
                    <pre className='text-xs mt-1 p-2 bg-background rounded border'>
                      {stepConfigs.step1.message}
                    </pre>
                  </div>
                  <div>
                    <span className='text-xs text-muted-foreground'>
                      Preview:
                    </span>
                    <pre className='text-xs mt-1 p-2 bg-background rounded border'>
                      {getPreview(stepConfigs.step1.message)}
                    </pre>
                  </div>
                </div>
              </div>

              <div>
                <h4 className='text-sm font-medium mb-2'>
                  Step 2 - Profile Data
                </h4>
                <div className='p-4 bg-muted rounded-md space-y-2'>
                  <div>
                    <span className='text-xs text-muted-foreground'>
                      Template:
                    </span>
                    <pre className='text-xs mt-1 p-2 bg-background rounded border font-mono'>
                      {stepConfigs.step2.profileData}
                    </pre>
                  </div>
                  <div>
                    <span className='text-xs text-muted-foreground'>
                      Preview:
                    </span>
                    <pre className='text-xs mt-1 p-2 bg-background rounded border font-mono'>
                      {getPreview(stepConfigs.step2.profileData)}
                    </pre>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
