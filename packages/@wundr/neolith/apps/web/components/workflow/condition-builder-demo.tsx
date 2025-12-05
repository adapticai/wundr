'use client';

/**
 * Condition Builder Demo
 *
 * Interactive demonstration of the condition builder component showing:
 * - Basic condition creation
 * - Nested condition groups
 * - Template application
 * - Real-time validation
 * - Natural language preview
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle } from 'lucide-react';

import {
  ConditionBuilder,
  type ConditionGroup,
  validateConditionGroup,
  explainConditionGroup,
} from './condition-builder';
import type { ScopedWorkflowVariable } from './variable-manager';

// ============================================================================
// Demo Variables
// ============================================================================

const DEMO_VARIABLES: ScopedWorkflowVariable[] = [
  {
    id: 'v1',
    name: 'trigger.payload.email',
    type: 'string',
    defaultValue: '',
    description: 'User email from webhook',
    scope: 'global',
  },
  {
    id: 'v2',
    name: 'trigger.payload.priority',
    type: 'string',
    defaultValue: 'medium',
    description: 'Task priority level',
    scope: 'global',
  },
  {
    id: 'v3',
    name: 'trigger.payload.value',
    type: 'number',
    defaultValue: 0,
    description: 'Transaction value',
    scope: 'global',
  },
  {
    id: 'v4',
    name: 'trigger.payload.status',
    type: 'string',
    defaultValue: 'pending',
    description: 'Item status',
    scope: 'global',
  },
  {
    id: 'v5',
    name: 'trigger.payload.archived',
    type: 'boolean',
    defaultValue: false,
    description: 'Archive status',
    scope: 'global',
  },
  {
    id: 'v6',
    name: 'trigger.payload.enabled',
    type: 'boolean',
    defaultValue: true,
    description: 'Feature enabled flag',
    scope: 'global',
  },
  {
    id: 'v7',
    name: 'trigger.payload.tier',
    type: 'string',
    defaultValue: 'free',
    description: 'Subscription tier',
    scope: 'global',
  },
  {
    id: 'v8',
    name: 'trigger.payload.credits',
    type: 'number',
    defaultValue: 0,
    description: 'Available credits',
    scope: 'global',
  },
  {
    id: 'v9',
    name: 'trigger.payload.tags',
    type: 'array',
    defaultValue: [],
    description: 'Item tags',
    scope: 'global',
  },
];

// ============================================================================
// Demo Component
// ============================================================================

export function ConditionBuilderDemo() {
  const [simpleCondition, setSimpleCondition] = React.useState<ConditionGroup>({
    id: 'root-simple',
    operator: 'AND',
    conditions: [
      {
        id: 'c1',
        variable: 'trigger.payload.status',
        operator: 'equals',
        value: 'approved',
        type: 'literal',
      },
    ],
  });

  const [nestedCondition, setNestedCondition] = React.useState<ConditionGroup>({
    id: 'root-nested',
    operator: 'AND',
    conditions: [
      {
        id: 'c1',
        variable: 'trigger.payload.enabled',
        operator: 'equals',
        value: 'true',
        type: 'literal',
      },
      {
        id: 'g1',
        operator: 'OR',
        conditions: [
          {
            id: 'c2',
            variable: 'trigger.payload.tier',
            operator: 'in_array',
            value: '["premium", "enterprise"]',
            type: 'literal',
          },
          {
            id: 'c3',
            variable: 'trigger.payload.credits',
            operator: 'greater_than',
            value: '100',
            type: 'literal',
          },
        ],
      },
    ],
  });

  const simpleErrors = validateConditionGroup(simpleCondition, DEMO_VARIABLES);
  const nestedErrors = validateConditionGroup(nestedCondition, DEMO_VARIABLES);

  return (
    <div className='space-y-6 p-6'>
      <div>
        <h1 className='text-3xl font-bold'>Condition Builder Demo</h1>
        <p className='text-muted-foreground mt-2'>
          Interactive examples showing the capabilities of the condition builder
        </p>
      </div>

      <Tabs defaultValue='simple' className='w-full'>
        <TabsList className='grid w-full grid-cols-3'>
          <TabsTrigger value='simple'>Simple Conditions</TabsTrigger>
          <TabsTrigger value='nested'>Nested Groups</TabsTrigger>
          <TabsTrigger value='templates'>Templates</TabsTrigger>
        </TabsList>

        {/* Simple Conditions Tab */}
        <TabsContent value='simple' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Simple Condition Building</CardTitle>
              <CardDescription>
                Create basic conditions with comparison operators
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConditionBuilder
                value={simpleCondition}
                onChange={setSimpleCondition}
                variables={DEMO_VARIABLES}
                showPreview
                showTemplates
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Validation Status</CardTitle>
            </CardHeader>
            <CardContent>
              {simpleErrors.length === 0 ? (
                <Alert>
                  <CheckCircle2 className='h-4 w-4 text-green-500' />
                  <AlertDescription>
                    All conditions are valid and ready to use
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant='destructive'>
                  <XCircle className='h-4 w-4' />
                  <AlertDescription>
                    Found {simpleErrors.length} validation error(s)
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Natural Language Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className='text-sm bg-muted p-4 rounded-lg overflow-x-auto'>
                {explainConditionGroup(simpleCondition, DEMO_VARIABLES)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Nested Groups Tab */}
        <TabsContent value='nested' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Nested Condition Groups</CardTitle>
              <CardDescription>
                Create complex logic with nested AND/OR groups
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConditionBuilder
                value={nestedCondition}
                onChange={setNestedCondition}
                variables={DEMO_VARIABLES}
                showPreview
                showTemplates
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Validation Status</CardTitle>
            </CardHeader>
            <CardContent>
              {nestedErrors.length === 0 ? (
                <Alert>
                  <CheckCircle2 className='h-4 w-4 text-green-500' />
                  <AlertDescription>
                    All nested conditions are valid
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant='destructive'>
                  <XCircle className='h-4 w-4' />
                  <AlertDescription>
                    Found {nestedErrors.length} validation error(s)
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Natural Language Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className='text-sm bg-muted p-4 rounded-lg overflow-x-auto'>
                {explainConditionGroup(nestedCondition, DEMO_VARIABLES)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value='templates' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Condition Templates</CardTitle>
              <CardDescription>
                Start with pre-built patterns for common scenarios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='space-y-4'>
                <Alert>
                  <AlertDescription>
                    Click the "Templates" button in the condition builder to apply
                    pre-built patterns including:
                  </AlertDescription>
                </Alert>

                <div className='grid gap-4'>
                  <Card>
                    <CardHeader>
                      <CardTitle className='text-lg'>Email Validation</CardTitle>
                      <CardDescription>
                        Comprehensive email validation with domain checking
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className='space-y-2'>
                        <Badge>3 conditions</Badge>
                        <Badge variant='secondary'>AND logic</Badge>
                        <p className='text-sm text-muted-foreground mt-2'>
                          Checks for non-empty email, valid format, and specific domain
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className='text-lg'>Priority Routing</CardTitle>
                      <CardDescription>
                        Route high-value or urgent items
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className='space-y-2'>
                        <Badge>2 conditions</Badge>
                        <Badge variant='secondary'>OR logic</Badge>
                        <p className='text-sm text-muted-foreground mt-2'>
                          Matches items with high priority or value above threshold
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className='text-lg'>Status Check</CardTitle>
                      <CardDescription>
                        Filter approved and active items
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className='space-y-2'>
                        <Badge>2 conditions</Badge>
                        <Badge variant='secondary'>AND logic</Badge>
                        <p className='text-sm text-muted-foreground mt-2'>
                          Filters for approved status and not archived
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className='text-lg'>Complex Business Logic</CardTitle>
                      <CardDescription>
                        Advanced nested conditions for sophisticated routing
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className='space-y-2'>
                        <Badge>2 groups</Badge>
                        <Badge variant='secondary'>Nested AND/OR</Badge>
                        <p className='text-sm text-muted-foreground mt-2'>
                          Enabled flag with premium tier or sufficient credits
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Feature Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='space-y-2'>
              <h4 className='font-medium'>Visual Builder</h4>
              <ul className='text-sm text-muted-foreground space-y-1'>
                <li>• AND/OR logical groups</li>
                <li>• Unlimited nesting depth</li>
                <li>• Collapsible groups</li>
                <li>• Drag-and-drop reordering</li>
              </ul>
            </div>
            <div className='space-y-2'>
              <h4 className='font-medium'>Operators</h4>
              <ul className='text-sm text-muted-foreground space-y-1'>
                <li>• Comparison (equals, greater than, etc.)</li>
                <li>• String operations (contains, starts with, etc.)</li>
                <li>• Array operations (in array, etc.)</li>
                <li>• Empty checks</li>
                <li>• Regex matching</li>
              </ul>
            </div>
            <div className='space-y-2'>
              <h4 className='font-medium'>Validation</h4>
              <ul className='text-sm text-muted-foreground space-y-1'>
                <li>• Real-time error checking</li>
                <li>• Type-aware operators</li>
                <li>• Variable reference validation</li>
                <li>• Required value checks</li>
              </ul>
            </div>
            <div className='space-y-2'>
              <h4 className='font-medium'>Developer Experience</h4>
              <ul className='text-sm text-muted-foreground space-y-1'>
                <li>• TypeScript support</li>
                <li>• Natural language preview</li>
                <li>• Pre-built templates</li>
                <li>• Copy condition text</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
