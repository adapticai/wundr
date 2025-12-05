'use client';

/**
 * Tool Execution Demo Component
 *
 * Demonstrates AI tool calling with various tools and result rendering.
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToolExecution } from '@/lib/ai/hooks/use-tool-execution';
import { ToolResult } from './tool-result';
import { PlayCircle, Trash2, Loader2 } from 'lucide-react';

const DEMO_WORKSPACE_ID = 'demo-workspace';

const EXAMPLE_TOOLS = [
  {
    name: 'list_workflows',
    category: 'workflow' as const,
    description: 'List all workflows in workspace',
    example: { status: 'active', limit: 5 },
  },
  {
    name: 'search_messages',
    category: 'search' as const,
    description: 'Search for messages',
    example: { query: 'meeting', limit: 10 },
  },
  {
    name: 'search_users',
    category: 'search' as const,
    description: 'Search for users',
    example: { query: 'john', limit: 5 },
  },
  {
    name: 'generate_analytics',
    category: 'data' as const,
    description: 'Generate analytics report',
    example: { metric: 'user_activity', timeRange: '7d', groupBy: 'day' },
  },
  {
    name: 'calculate_statistics',
    category: 'data' as const,
    description: 'Calculate statistics from data',
    example: {
      data: [12, 45, 23, 67, 89, 34, 56, 78, 90, 23],
      metrics: ['mean', 'median', 'stddev', 'percentiles'],
    },
  },
  {
    name: 'execute_workflow',
    category: 'workflow' as const,
    description: 'Execute a workflow (requires approval)',
    example: { workflowId: 'wf_123', async: true },
  },
];

export function ToolExecutionDemo() {
  const [selectedTool, setSelectedTool] = React.useState(EXAMPLE_TOOLS[0]);
  const [inputJson, setInputJson] = React.useState(
    JSON.stringify(EXAMPLE_TOOLS[0].example, null, 2)
  );
  const [isExecuting, setIsExecuting] = React.useState(false);

  const { executeTool, approveTool, rejectTool, clearHistory, executions } =
    useToolExecution({
      workspaceId: DEMO_WORKSPACE_ID,
      onSuccess: result => {
        console.log('Tool executed successfully:', result);
      },
      onError: error => {
        console.error('Tool execution failed:', error);
      },
    });

  const handleToolChange = (toolName: string) => {
    const tool = EXAMPLE_TOOLS.find(t => t.name === toolName);
    if (tool) {
      setSelectedTool(tool);
      setInputJson(JSON.stringify(tool.example, null, 2));
    }
  };

  const handleExecute = async () => {
    setIsExecuting(true);
    try {
      const input = JSON.parse(inputJson);
      await executeTool(selectedTool.name, input);
    } catch (error) {
      console.error('Invalid JSON input:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleExecuteParallel = async () => {
    setIsExecuting(true);
    try {
      const tools = [
        { name: 'search_messages', input: { query: 'update', limit: 5 } },
        { name: 'search_users', input: { query: 'admin', limit: 5 } },
        {
          name: 'calculate_statistics',
          input: {
            data: [10, 20, 30, 40, 50],
            metrics: ['mean', 'median'],
          },
        },
      ];

      for (const tool of tools) {
        await executeTool(tool.name, tool.input);
      }
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className='space-y-6 p-6 max-w-7xl mx-auto'>
      <div>
        <h1 className='text-3xl font-bold mb-2'>AI Tool Execution Demo</h1>
        <p className='text-muted-foreground'>
          Test AI tool calling with various tools and see real-time results
        </p>
      </div>

      <Tabs defaultValue='execute' className='space-y-4'>
        <TabsList>
          <TabsTrigger value='execute'>Execute Tools</TabsTrigger>
          <TabsTrigger value='results'>
            Results ({executions.length})
          </TabsTrigger>
          <TabsTrigger value='examples'>Examples</TabsTrigger>
        </TabsList>

        <TabsContent value='execute' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Execute Tool</CardTitle>
              <CardDescription>
                Select a tool and provide input parameters to execute
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='tool-select'>Tool</Label>
                <Select
                  value={selectedTool.name}
                  onValueChange={handleToolChange}
                >
                  <SelectTrigger id='tool-select'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXAMPLE_TOOLS.map(tool => (
                      <SelectItem key={tool.name} value={tool.name}>
                        {tool.name} - {tool.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='input-json'>Input (JSON)</Label>
                <Textarea
                  id='input-json'
                  value={inputJson}
                  onChange={e => setInputJson(e.target.value)}
                  className='font-mono text-sm min-h-[200px]'
                  placeholder='{"param": "value"}'
                />
              </div>

              <div className='flex gap-2'>
                <Button onClick={handleExecute} disabled={isExecuting}>
                  {isExecuting ? (
                    <>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      Executing...
                    </>
                  ) : (
                    <>
                      <PlayCircle className='mr-2 h-4 w-4' />
                      Execute Tool
                    </>
                  )}
                </Button>
                <Button
                  variant='outline'
                  onClick={handleExecuteParallel}
                  disabled={isExecuting}
                >
                  Execute Multiple (Demo)
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='results' className='space-y-4'>
          <div className='flex items-center justify-between mb-4'>
            <h2 className='text-xl font-semibold'>Execution Results</h2>
            <Button
              variant='outline'
              size='sm'
              onClick={clearHistory}
              disabled={executions.length === 0}
            >
              <Trash2 className='mr-2 h-4 w-4' />
              Clear All
            </Button>
          </div>

          {executions.length === 0 ? (
            <Card>
              <CardContent className='py-12 text-center text-muted-foreground'>
                No executions yet. Execute a tool to see results here.
              </CardContent>
            </Card>
          ) : (
            <div className='space-y-4'>
              {executions
                .slice()
                .reverse()
                .map((execution, index) => (
                  <ToolResult
                    key={index}
                    toolName={execution.toolName}
                    category={
                      EXAMPLE_TOOLS.find(t => t.name === execution.toolName)
                        ?.category || 'system'
                    }
                    success={execution.status === 'success'}
                    data={execution.result?.data}
                    error={execution.error}
                    metadata={{
                      executionTime: execution.executionTime,
                      cached: execution.result?.metadata?.cached,
                      requiresApproval:
                        execution.result?.metadata?.requiresApproval,
                      approvalId: execution.result?.metadata?.approvalId,
                    }}
                    onApprove={approveTool}
                    onReject={rejectTool}
                  />
                ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value='examples' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Tool Examples</CardTitle>
              <CardDescription>
                Example tool calls with expected inputs and outputs
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              {EXAMPLE_TOOLS.map(tool => (
                <div
                  key={tool.name}
                  className='space-y-2 pb-4 border-b last:border-0'
                >
                  <div className='flex items-center justify-between'>
                    <div>
                      <h3 className='font-semibold'>{tool.name}</h3>
                      <p className='text-sm text-muted-foreground'>
                        {tool.description}
                      </p>
                    </div>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => handleToolChange(tool.name)}
                    >
                      Load Example
                    </Button>
                  </div>
                  <pre className='text-xs bg-muted p-3 rounded overflow-x-auto'>
                    {JSON.stringify(tool.example, null, 2)}
                  </pre>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
